import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ALL_ROADS,
  BRIDGE_SPECS,
  MAP_HALF_D,
  MAP_HALF_W,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  ROAD_HALF_WIDTH,
  VIADUCT_ELBOW,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  distToPolyline,
  distToSegment,
  fbm2D,
  getAirfieldPadMask,
  getAnalyticalTerrainNormal,
  getBridgeSegments,
  getCitadelPlateauMask,
  getCitadelTerraceMask,
  getRiverInfo,
  getTerrainHeight,
  getTerrainSlope,
} from '../../map/terrainMath';
import { createContactShadowTexture } from '../textures';
import {
  ANTI_MECH_BARRICADE_NODES,
  BUNKER_COORDS,
  FLANK_EXCLUSION_ZONES,
  WRECK_COORDS,
} from '../zones/FlankCoverZone';
import {
  PINE_TREE_TOTAL_HEIGHT,
  createUnifiedPineTreeGeometry,
} from './pineGeometry';

export interface PineForestProps {
  isSoftwareGl?: boolean;
}

const _dummy = new THREE.Object3D();
const _upVec = new THREE.Vector3(0, 1, 0);
const _normalVec = new THREE.Vector3();
const _slopeQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();

// Bright tint modulators multiplied onto baked vertexColors so bark stays brown
// while pine groves exhibit varied cool spruce, boreal, and warm sunlit olive hues.
const PINE_TINT_PALETTE = [
  new THREE.Color('#D4E5DE'),
  new THREE.Color('#E8F4E2'),
  new THREE.Color('#F2F6DA'),
  new THREE.Color('#DFEAD4'),
];

function samplePineTint(t: number, out: THREE.Color): THREE.Color {
  const clamped = Math.max(0, Math.min(0.9999, t));
  const scaled = clamped * (PINE_TINT_PALETTE.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  return out.copy(PINE_TINT_PALETTE[idx]).lerp(PINE_TINT_PALETTE[idx + 1], frac);
}

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function isClearForFoliage(x: number, z: number, extraMargin = 0): boolean {
  if (Math.abs(x) > MAP_HALF_W - 4.5 || Math.abs(z) > MAP_HALF_D - 4.5) return false;
  if (getAirfieldPadMask(x, z) > 0.14) return false;
  if (getCitadelPlateauMask(x, z) > 0.12) return false;
  if (getCitadelTerraceMask(x, z) > 0.25) return false;
  if (Math.hypot(x - QUARRY_CENTER_X, z - QUARRY_CENTER_Z) < 17.5 + extraMargin) return false;
  if (Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]) < 15.2 + extraMargin) return false;

  const dRoad = Math.min(...ALL_ROADS.map((road) => distToPolyline(x, z, road)));
  if (dRoad < ROAD_HALF_WIDTH + 2.9 + extraMargin) return false;

  const nearBridge = BRIDGE_SPECS.some((b) =>
    getBridgeSegments(b).some(
      ([s, e]) => distToSegment(x, z, s[0], s[1], e[0], e[1]) < b.width * 0.65 + 3.0 + extraMargin,
    ),
  );
  if (nearBridge) return false;

  const nearRamp = WALKABLE_RAMPS.some(
    (r) => distToSegment(x, z, r[0], r[1], r[2], r[3]) < r[4] + 2.2 + extraMargin,
  );
  if (nearRamp) return false;

  if (BUNKER_COORDS.some((b) => Math.hypot(x - b.x, z - b.z) < 6.6 + extraMargin)) return false;
  if (WRECK_COORDS.some((w) => Math.hypot(x - w.x, z - w.z) < 5.0 + extraMargin)) return false;
  if (
    FLANK_EXCLUSION_ZONES.some(
      (zZone) => Math.hypot(x - zZone.x, z - zZone.z) < zZone.r + extraMargin,
    )
  ) {
    return false;
  }
  if (ANTI_MECH_BARRICADE_NODES.some((n) => Math.hypot(x - n.x, z - n.z) < 4.4 + extraMargin)) {
    return false;
  }
  return true;
}

const WIND_VERTEX_SWAY = `
  float hNorm = clamp( transformed.y / ${PINE_TREE_TOTAL_HEIGHT.toFixed(2)}, 0.0, 1.0 );
  float bend = hNorm * hNorm;
  #ifdef USE_INSTANCING
    vec3 instRoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #else
    vec3 instRoot = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #endif
  float gustPhase = uWindTime * 1.55 + instRoot.x * 0.13 + instRoot.z * 0.09;
  float flutterPhase = uWindTime * 2.75 + instRoot.x * 0.37 - instRoot.z * 0.29;
  transformed.x += ( sin( gustPhase ) * 0.090 + sin( flutterPhase ) * 0.028 ) * bend;
  transformed.z += ( cos( gustPhase * 0.85 + 1.1 ) * 0.068 + sin( flutterPhase * 1.15 ) * 0.022 ) * bend;
`;

function injectTreeWindSway(
  shader: THREE.WebGLProgramParametersWithUniforms,
  windTimeUniform: { value: number },
) {
  shader.uniforms.uWindTime = windTimeUniform;
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uWindTime;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${WIND_VERTEX_SWAY}`,
    );
}

export function PineForest({ isSoftwareGl = false }: PineForestProps) {
  const treeRef = useRef<THREE.InstancedMesh>(null);
  const contactShadowRef = useRef<THREE.InstancedMesh>(null);
  const shrubRef = useRef<THREE.InstancedMesh>(null);
  const logRef = useRef<THREE.InstancedMesh>(null);
  const rootRockRef = useRef<THREE.InstancedMesh>(null);

  const windTimeUniform = useRef({ value: 0.85 });

  const {
    treeGeo,
    contactGeo,
    contactShadowTex,
    treeMaterial,
    treeDepthMaterial,
    shrubMaterial,
    contactShadowMaterial,
  } = useMemo(() => {
    const uGeo = createUnifiedPineTreeGeometry();
    const csGeo = new THREE.PlaneGeometry(1, 1);
    csGeo.rotateX(-Math.PI / 2);

    const csTex = createContactShadowTexture();

    const tMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.87,
      metalness: 0.02,
    });
    tMat.customProgramCacheKey = () => 'sector7-pine-merged-v1';
    tMat.onBeforeCompile = (shader) => {
      injectTreeWindSway(shader, windTimeUniform.current);
    };

    const tDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });
    tDepthMat.customProgramCacheKey = () => 'sector7-pine-merged-depth-v1';
    tDepthMat.onBeforeCompile = (shader) => {
      injectTreeWindSway(shader, windTimeUniform.current);
    };

    const sMat = new THREE.MeshStandardMaterial({
      roughness: 0.92,
      metalness: 0.01,
    });
    sMat.customProgramCacheKey = () => 'sector7-shrub-wind-v1';
    sMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windTimeUniform.current;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uWindTime;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float sH = clamp( ( transformed.y + 0.35 ) / 0.87, 0.0, 1.0 );
          float sBend = sH * sH;
          #ifdef USE_INSTANCING
            vec3 sRoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          #else
            vec3 sRoot = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          #endif
          transformed.x += sin( uWindTime * 2.1 + sRoot.x * 0.25 + sRoot.z * 0.18 ) * 0.042 * sBend;
          transformed.z += cos( uWindTime * 1.8 + sRoot.z * 0.27 ) * 0.032 * sBend;`,
        );
    };

    const csMat = new THREE.MeshBasicMaterial({
      map: csTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    return {
      treeGeo: uGeo,
      contactGeo: csGeo,
      contactShadowTex: csTex,
      treeMaterial: tMat,
      treeDepthMaterial: tDepthMat,
      shrubMaterial: sMat,
      contactShadowMaterial: csMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      treeGeo.dispose();
      contactGeo.dispose();
      contactShadowTex.dispose();
      treeMaterial.dispose();
      treeDepthMaterial.dispose();
      shrubMaterial.dispose();
      contactShadowMaterial.dispose();
    };
  }, [
    treeGeo,
    contactGeo,
    contactShadowTex,
    treeMaterial,
    treeDepthMaterial,
    shrubMaterial,
    contactShadowMaterial,
  ]);

  const { trees, shrubs, logs, rootRocks } = useMemo(() => {
    const treeList: Array<{
      x: number;
      y: number;
      z: number;
      heightScale: number;
      widthScale: number;
      rotY: number;
      tiltX: number;
      tiltZ: number;
      tint: number;
    }> = [];
    const shrubList: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      rotY: number;
      tint: number;
    }> = [];
    const logList: Array<{
      x: number;
      y: number;
      z: number;
      len: number;
      rad: number;
      rotY: number;
      tiltX: number;
      tint: number;
    }> = [];
    const rootRockList: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      rotY: number;
      tint: number;
    }> = [];

    // 1. Discover sheltered lowland & foothill grove centers (leaving open windy heights rocky & bare)
    const groveCenters: Array<{ x: number; z: number; radius: number; density: number }> = [];
    for (let i = 0; i < 1800 && groveCenters.length < 44; i++) {
      const gx = (seededRand(i * 7 + 11) * 2 - 1) * (MAP_HALF_W - 10.0);
      const gz = (seededRand(i * 7 + 13) * 2 - 1) * (MAP_HALF_D - 10.0);

      const river = getRiverInfo(gx, gz);
      const gy = getTerrainHeight(gx, gz);
      const gSlope = getTerrainSlope(gx, gz);

      // Groves thrive in sheltered lowlands, valley pockets, and hill foothills (1.3..8.4 units)
      if (river.channelMask > 0.04 || river.islandMask > 0.2) continue;
      if (gy < WATER_LEVEL + 1.3 || gy > 8.4) continue;
      if (gSlope > 0.42) continue;
      if (!isClearForFoliage(gx, gz, 2.0)) continue;

      // Favor foothill transitions & sheltered hollows via noise + spacing between groves
      const moisture = fbm2D(gx * 0.025 + 4.2, gz * 0.025 - 2.1, 2);
      if (moisture < 0.42) continue;
      if (groveCenters.some((c) => Math.hypot(gx - c.x, gz - c.z) < 21.0)) continue;

      const radius = 10.5 + seededRand(i * 11 + 3) * 10.5;
      const density = 32 + Math.floor(seededRand(i * 13 + 5) * 40);
      groveCenters.push({ x: gx, z: gz, radius, density });
    }

    // 2. Populate dense conifer groves + understory shrubs, fallen deadwood, and root boulders
    groveCenters.forEach((grove, gIdx) => {
      for (let k = 0; k < grove.density && treeList.length < 2250; k++) {
        const seedBase = gIdx * 1009 + k * 29;
        // Radial Gaussian-like bunching: denser near grove core, feathering at edges
        const u1 = Math.max(0.02, seededRand(seedBase + 1));
        const r = Math.pow(u1, 0.72) * grove.radius;
        const ang = seededRand(seedBase + 2) * Math.PI * 2;
        const x = grove.x + Math.cos(ang) * r;
        const z = grove.z + Math.sin(ang) * r;

        const river = getRiverInfo(x, z);
        const y = getTerrainHeight(x, z);
        const slope = getTerrainSlope(x, z);

        // Strictly avoid water, steep rock cliffs, and windy high ridges (> 9.2 units)
        if (river.channelMask > 0.06 || river.islandMask > 0.22 || y < WATER_LEVEL + 1.0) continue;
        if (y > 9.2 || slope > 0.48) continue;
        if (!isClearForFoliage(x, z)) continue;

        const coreFactor = 1.0 - Math.min(1.0, r / grove.radius);
        const baseScale =
          (0.76 + coreFactor * 0.34 + seededRand(seedBase + 3) * 0.48) * 1.42;
        const rotY = seededRand(seedBase + 4) * Math.PI * 2;
        const tint = seededRand(seedBase + 5);
        const heightScale = baseScale * (0.80 + seededRand(seedBase + 24) * 0.42);
        const widthScale = baseScale * (0.85 + seededRand(seedBase + 25) * 0.32);
        const tiltX = (seededRand(seedBase + 26) - 0.5) * 0.09;
        const tiltZ = (seededRand(seedBase + 27) - 0.5) * 0.09;

        treeList.push({
          x,
          y,
          z,
          heightScale,
          widthScale,
          rotY,
          tiltX,
          tiltZ,
          tint,
        });

        // Understory shrubs tucked around tree bases & grove perimeter
        if (shrubList.length < 1150 && seededRand(seedBase + 6) < 0.56) {
          const sAng = seededRand(seedBase + 7) * Math.PI * 2;
          const sDist = 0.45 + seededRand(seedBase + 8) * 1.35;
          const sxPos = x + Math.cos(sAng) * sDist;
          const szPos = z + Math.sin(sAng) * sDist;
          const syPos = getTerrainHeight(sxPos, szPos);
          if (syPos > WATER_LEVEL + 0.8 && getTerrainSlope(sxPos, szPos) < 0.52) {
            const sBase = 0.48 + seededRand(seedBase + 9) * 0.52;
            shrubList.push({
              x: sxPos,
              y: syPos,
              z: szPos,
              sx: sBase * (1.1 + seededRand(seedBase + 10) * 0.5),
              sy: sBase * (0.62 + seededRand(seedBase + 11) * 0.35),
              sz: sBase * (1.1 + seededRand(seedBase + 12) * 0.5),
              rotY: seededRand(seedBase + 13) * Math.PI * 2,
              tint: seededRand(seedBase + 14),
            });
          }
        }

        // Large boulders nestled at tree roots (especially near foothill edges)
        if (rootRockList.length < 300 && seededRand(seedBase + 15) < (y > 5.0 ? 0.2 : 0.11)) {
          const rAng = seededRand(seedBase + 16) * Math.PI * 2;
          const rDist = 0.55 + seededRand(seedBase + 17) * 1.1;
          const rxPos = x + Math.cos(rAng) * rDist;
          const rzPos = z + Math.sin(rAng) * rDist;
          const ryPos = getTerrainHeight(rxPos, rzPos);
          if (ryPos > WATER_LEVEL + 0.6 && isClearForFoliage(rxPos, rzPos)) {
            const bScale = 0.62 + seededRand(seedBase + 18) * 0.85;
            rootRockList.push({
              x: rxPos,
              y: ryPos,
              z: rzPos,
              sx: bScale * (1.0 + seededRand(seedBase + 19) * 0.55),
              sy: bScale * (0.65 + seededRand(seedBase + 20) * 0.35),
              sz: bScale * (0.95 + seededRand(seedBase + 21) * 0.5),
              rotY: seededRand(seedBase + 22) * Math.PI * 2,
              tint: seededRand(seedBase + 23),
            });
          }
        }
      }

      // Fallen deadwood logs & moss-covered windfall inside each grove
      const logCount = 3 + Math.floor(seededRand(gIdx * 97 + 1) * 4);
      for (let l = 0; l < logCount && logList.length < 220; l++) {
        const lSeed = gIdx * 733 + l * 41;
        const lr = Math.pow(seededRand(lSeed + 1), 0.8) * grove.radius * 0.92;
        const lang = seededRand(lSeed + 2) * Math.PI * 2;
        const lx = grove.x + Math.cos(lang) * lr;
        const lz = grove.z + Math.sin(lang) * lr;
        const ly = getTerrainHeight(lx, lz);
        if (ly < WATER_LEVEL + 1.0 || ly > 9.0 || getTerrainSlope(lx, lz) > 0.38) continue;
        if (!isClearForFoliage(lx, lz)) continue;

        const rotY = seededRand(lSeed + 3) * Math.PI * 2;
        const hAhead = getTerrainHeight(lx + Math.cos(rotY) * 1.1, lz + Math.sin(rotY) * 1.1);
        const hBehind = getTerrainHeight(lx - Math.cos(rotY) * 1.1, lz - Math.sin(rotY) * 1.1);
        const tiltX = Math.atan2(hAhead - hBehind, 2.2);

        logList.push({
          x: lx,
          y: ly,
          z: lz,
          len: 1.85 + seededRand(lSeed + 4) * 1.55,
          rad: 0.13 + seededRand(lSeed + 5) * 0.08,
          rotY,
          tiltX,
          tint: seededRand(lSeed + 6),
        });
      }
    });

    return {
      trees: treeList,
      shrubs: shrubList,
      logs: logList,
      rootRocks: rootRockList,
    };
  }, []);

  useEffect(() => {
    const tMesh = treeRef.current;
    const csMesh = contactShadowRef.current;
    const sMesh = shrubRef.current;
    const lMesh = logRef.current;
    const rMesh = rootRockRef.current;
    if (!tMesh || !csMesh || !sMesh || !lMesh || !rMesh) return;

    tMesh.customDepthMaterial = treeDepthMaterial;

    const colShrubA = new THREE.Color('#273A2C');
    const colShrubB = new THREE.Color('#3B4D36');
    const colLogA = new THREE.Color('#3E3024');
    const colLogB = new THREE.Color('#4B3F31');
    const colRockA = new THREE.Color('#47505A');
    const colRockB = new THREE.Color('#5A6470');
    const tmpCol = new THREE.Color();

    trees.forEach((t, i) => {
      // Single merged tree mesh (trunk + 5 jagged tiers) anchored at y=0
      _dummy.position.set(t.x, t.y, t.z);
      _dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
      _dummy.scale.set(t.widthScale, t.heightScale, t.widthScale);
      _dummy.updateMatrix();
      tMesh.setMatrixAt(i, _dummy.matrix);

      samplePineTint(t.tint, tmpCol);
      tMesh.setColorAt(i, tmpCol);

      // Sloped ground contact AO decal aligned to analytical terrain normal
      const n = getAnalyticalTerrainNormal(t.x, t.z, 1.6, false);
      _normalVec.set(n.nx, n.ny, n.nz).normalize();
      _slopeQuat.setFromUnitVectors(_upVec, _normalVec);
      _yawQuat.setFromAxisAngle(_upVec, t.rotY);

      _dummy.position.set(t.x, t.y + 0.055, t.z);
      _dummy.quaternion.copy(_slopeQuat).multiply(_yawQuat);
      const shadowDiam = t.widthScale * 1.44;
      _dummy.scale.set(shadowDiam, 1, shadowDiam);
      _dummy.updateMatrix();
      csMesh.setMatrixAt(i, _dummy.matrix);
    });

    shrubs.forEach((s, i) => {
      _dummy.position.set(s.x, s.y + s.sy * 0.32, s.z);
      _dummy.rotation.set(0.08 * (s.tint - 0.5), s.rotY, 0.08 * (0.5 - s.tint));
      _dummy.scale.set(s.sx, s.sy, s.sz);
      _dummy.updateMatrix();
      sMesh.setMatrixAt(i, _dummy.matrix);

      tmpCol.copy(colShrubA).lerp(colShrubB, s.tint);
      sMesh.setColorAt(i, tmpCol);
    });

    logs.forEach((l, i) => {
      _dummy.position.set(l.x, l.y + l.rad * 0.55, l.z);
      _dummy.rotation.set(0, l.rotY, 0);
      _dummy.rotateZ(Math.PI / 2 - l.tiltX);
      _dummy.scale.set(l.rad, l.len, l.rad);
      _dummy.updateMatrix();
      lMesh.setMatrixAt(i, _dummy.matrix);

      tmpCol.copy(colLogA).lerp(colLogB, l.tint);
      lMesh.setColorAt(i, tmpCol);
    });

    rootRocks.forEach((r, i) => {
      _dummy.position.set(r.x, r.y + r.sy * 0.22, r.z);
      _dummy.rotation.set(0.22 * (i % 5), r.rotY, 0.14 * (i % 3));
      _dummy.scale.set(r.sx, r.sy, r.sz);
      _dummy.updateMatrix();
      rMesh.setMatrixAt(i, _dummy.matrix);

      tmpCol.copy(colRockA).lerp(colRockB, r.tint);
      rMesh.setColorAt(i, tmpCol);
    });

    for (const m of [tMesh, csMesh, sMesh, lMesh, rMesh]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [trees, shrubs, logs, rootRocks, treeDepthMaterial]);

  useFrame((_, delta) => {
    if (isSoftwareGl) return;
    windTimeUniform.current.value += Math.min(delta, 0.05);
  });

  return (
    <group>
      <instancedMesh
        ref={contactShadowRef}
        args={[contactGeo, contactShadowMaterial, trees.length]}
        renderOrder={1}
      />
      <instancedMesh
        ref={treeRef}
        args={[treeGeo, treeMaterial, trees.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={shrubRef}
        args={[undefined, shrubMaterial, shrubs.length]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[0.52, 0]} />
      </instancedMesh>
      <instancedMesh
        ref={logRef}
        args={[undefined, undefined, logs.length]}
        castShadow
      >
        <cylinderGeometry args={[0.85, 1.0, 1.0, 6]} />
        <meshStandardMaterial roughness={0.94} metalness={0.02} />
      </instancedMesh>
      <instancedMesh
        ref={rootRockRef}
        args={[undefined, undefined, rootRocks.length]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.88} metalness={0.04} />
      </instancedMesh>
    </group>
  );
}
