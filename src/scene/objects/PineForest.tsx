import { useSceneSimulation } from '../SceneSimulation';
import type * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getAnalyticalTerrainNormal, getTerrainHeight } from '../../map/terrainMath';
import { generatePineForestData } from '../../map/worldStructures';
import type { MechTelemetrySnapshot } from '../../map/mechKinematics';
import type { CombatSimulationState } from '../../game/combatTypes';
import { combatAudio } from '../../game/combatAudio';
import { createContactShadowTexture } from '../textures';
import { PINE_TREE_TOTAL_HEIGHT } from './pineGeometry';
import { createPineBatches } from './pineBatches';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';
import {
  checkFallingTreeCollisions,
  createFallingTreesState,
  resetFallingTrees,
  stepFallingTrees,
  type FallingTreeItem,
  type TreeFallStartEvent,
  type TreeGroundImpactEvent,
} from './fallingTrees';

export interface PineForestProps {
  preparing?: boolean;
  isSoftwareGl?: boolean;
  sunPos: readonly [number, number, number];
  driveMode?: boolean;
  mechPoseRef?: React.MutableRefObject<MechTelemetrySnapshot>;
  combatRef?: React.MutableRefObject<CombatSimulationState>;
}

const MAX_WOOD_CHIPS = 56;
const MECH_TREE_KNOCK_RADIUS = 2.15;

interface WoodChipParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
  maxLife: number;
  scale: number;
  r: number;
  g: number;
  b: number;
}

const _dummy = new THREE.Object3D();
const _upVec = new THREE.Vector3(0, 1, 0);
const _normalVec = new THREE.Vector3();
const _slopeQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _baseEuler = new THREE.Euler();
const _baseQuat = new THREE.Quaternion();
const _fallAxis = new THREE.Vector3();
const _fallQuat = new THREE.Quaternion();
const _chipColor = new THREE.Color();

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

const WIND_VERTEX_SWAY = `
  float hNorm = clamp( transformed.y / ${PINE_TREE_TOTAL_HEIGHT.toFixed(2)}, 0.0, 1.0 );
  float bend = hNorm * hNorm * aTreeSway;
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
      uniform float uWindTime;
      attribute float aTreeSway;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      ${WIND_VERTEX_SWAY}`,
    );
}

export function PineForest({
  preparing = false,
  isSoftwareGl = false,
  sunPos,
  driveMode = false,
  mechPoseRef,
  combatRef,
}: PineForestProps) {
  const { gl, scene, camera } = useThree();
  const lodElapsed = useRef(1);
  const contactShadowRef = useRef<THREE.InstancedMesh>(null);
  const shrubRef = useRef<THREE.InstancedMesh>(null);
  const logRef = useRef<THREE.InstancedMesh>(null);
  const rootRockRef = useRef<THREE.InstancedMesh>(null);
  const chipMeshRef = useRef<THREE.InstancedMesh>(null);

  const windTimeUniform = useRef({ value: 0.85 });
  const prevElapsedRef = useRef(0);

  const { trees, shrubs, logs, rootRocks } = useMemo(() => generatePineForestData(), []);
  const fallingState = useMemo(() => createFallingTreesState(trees), [trees]);
  const hitEventsRef = useRef<TreeFallStartEvent[]>([]);
  const dirtyItemsRef = useRef<FallingTreeItem[]>([]);
  const impactEventsRef = useRef<TreeGroundImpactEvent[]>([]);
  const chipCursorRef = useRef(0);
  const chipsRef = useRef<WoodChipParticle[]>(
    Array.from({ length: MAX_WOOD_CHIPS }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      life: 0,
      maxLife: 0.5,
      scale: 1,
      r: 0.3,
      g: 0.2,
      b: 0.12,
    })),
  );

  const {
    contactGeo,
    chipGeo,
    contactShadowTex,
    treeMaterial,
    treeDepthMaterial,
    shrubMaterial,
    contactShadowMaterial,
    chipMaterial,
  } = useMemo(() => {
    const csGeo = new THREE.PlaneGeometry(1, 1);
    csGeo.rotateX(-Math.PI / 2);

    const cGeo = new THREE.BoxGeometry(0.18, 0.08, 0.08);
    const csTex = createContactShadowTexture();

    const tMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.87,
      metalness: 0.02,
    });
    tMat.customProgramCacheKey = () => 'sector7-pine-merged-v3';
    tMat.onBeforeCompile = (shader) => {
      injectTreeWindSway(shader, windTimeUniform.current);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aNeedleTip;
          varying float vNeedleTip;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vNeedleTip = aNeedleTip;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vNeedleTip;`,
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          float needleFresnel = pow( clamp( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 0.0, 1.0 ), 2.2 );
          float tipTranslucency = needleFresnel * clamp( vNeedleTip, 0.0, 1.0 );
          reflectedLight.directDiffuse *= 1.0 + tipTranslucency * 0.58;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * tipTranslucency * 0.24;`,
        );
    };

    const tDepthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });
    tDepthMat.customProgramCacheKey = () => 'sector7-pine-merged-depth-v2';
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

    const cMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.9,
      metalness: 0.02,
    });

    return {
      contactGeo: csGeo,
      chipGeo: cGeo,
      contactShadowTex: csTex,
      treeMaterial: tMat,
      treeDepthMaterial: tDepthMat,
      shrubMaterial: sMat,
      contactShadowMaterial: csMat,
      chipMaterial: cMat,
    };
  }, []);

  const treeBatches = useMemo(() => createPineBatches(trees, treeMaterial, treeDepthMaterial), [trees, treeMaterial, treeDepthMaterial]);
  useEffect(() => () => treeBatches.dispose(), [treeBatches]);

  useEffect(() => {
    return () => {
      contactGeo.dispose();
      chipGeo.dispose();
      contactShadowTex.dispose();
      treeMaterial.dispose();
      treeDepthMaterial.dispose();
      shrubMaterial.dispose();
      contactShadowMaterial.dispose();
      chipMaterial.dispose();
    };
  }, [
    contactGeo,
    chipGeo,
    contactShadowTex,
    treeMaterial,
    treeDepthMaterial,
    shrubMaterial,
    contactShadowMaterial,
    chipMaterial,
  ]);

  const spawnWoodChips = (
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    count: number,
    isGroundPuff: boolean,
  ) => {
    const chips = chipsRef.current;
    for (let i = 0; i < count; i++) {
      const idx = chipCursorRef.current;
      chipCursorRef.current = (chipCursorRef.current + 1) % MAX_WOOD_CHIPS;
      const c = chips[idx];
      const ang = Math.random() * Math.PI * 2;
      const spd = (isGroundPuff ? 2.6 : 3.8) * (0.45 + Math.random() * 0.85);
      c.active = true;
      c.x = x + (Math.random() - 0.5) * (isGroundPuff ? 1.1 : 0.45);
      c.y = y + Math.random() * 0.45;
      c.z = z + (Math.random() - 0.5) * (isGroundPuff ? 1.1 : 0.45);
      c.vx = Math.cos(ang) * spd + dirX * (isGroundPuff ? 1.1 : 2.2);
      c.vy = (isGroundPuff ? 2.0 : 3.2) + Math.random() * 2.8;
      c.vz = Math.sin(ang) * spd + dirZ * (isGroundPuff ? 1.1 : 2.2);
      c.rx = Math.random() * 6;
      c.ry = Math.random() * 6;
      c.life = 0;
      c.maxLife = 0.45 + Math.random() * 0.35;
      c.scale = (isGroundPuff ? 0.9 : 1.1) * (0.65 + Math.random() * 0.7);
      // Mix of bark splinters and pine needles
      if (Math.random() < (isGroundPuff ? 0.72 : 0.48)) {
        c.r = 0.22;
        c.g = 0.40;
        c.b = 0.22;
      } else {
        c.r = 0.34;
        c.g = 0.22;
        c.b = 0.13;
      }
    }
  };

  useEffect(() => {
    const tMesh = treeBatches;
    const csMesh = contactShadowRef.current;
    const sMesh = shrubRef.current;
    const lMesh = logRef.current;
    const rMesh = rootRockRef.current;
    if (!csMesh || !sMesh || !lMesh || !rMesh) return;


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

    for (const m of [csMesh, sMesh, lMesh, rMesh]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [trees, shrubs, logs, rootRocks, treeBatches]);

  useEffect(() => {
    const batch = treeBatches.group.children[0];
    if (!preparing || !batch) return;
    // Each cell now has its instance colors and shares this color program.
    void gl.compileAsync(batch, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('Pine shader warmup failed', error);
    });
  }, [preparing, treeBatches, gl, camera, scene]);

  useMeshShaderWarmup(shrubRef, preparing);

  const { paused } = useSceneSimulation();

  useFrame(({ camera }, delta) => {
    if (paused) return;
    if (preparing) return;
    lodElapsed.current += delta;
    if (lodElapsed.current >= .1) {
      treeBatches.update(camera, sunPos);
      lodElapsed.current = 0;
    }
    const dt = Math.min(delta, 0.05);
    if (!isSoftwareGl) {
      windTimeUniform.current.value += dt;
    }

    const tMesh = treeBatches;
    const csMesh = contactShadowRef.current;
    const fState = fallingState;
    const combat = combatRef?.current;

    // Restore knocked-down trees cleanly when mission is restarted
    if (combat) {
      if (combat.elapsedSec < prevElapsedRef.current - 0.1) {
        const restored = resetFallingTrees(fState);
        if (restored.length > 0 && csMesh) {
          for (let k = 0; k < restored.length; k++) {
            const idx = restored[k];
            const t = trees[idx];
            _dummy.position.set(t.x, t.y, t.z);
            _dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
            _dummy.scale.set(t.widthScale, t.heightScale, t.widthScale);
            _dummy.updateMatrix();
            tMesh.setMatrixAt(idx, _dummy.matrix);
            tMesh.setSway(idx, 1.0);

            const n = getAnalyticalTerrainNormal(t.x, t.z, 1.6, false);
            _normalVec.set(n.nx, n.ny, n.nz).normalize();
            _slopeQuat.setFromUnitVectors(_upVec, _normalVec);
            _yawQuat.setFromAxisAngle(_upVec, t.rotY);
            _dummy.position.set(t.x, t.y + 0.055, t.z);
            _dummy.quaternion.copy(_slopeQuat).multiply(_yawQuat);
            const shadowDiam = t.widthScale * 1.44;
            _dummy.scale.set(shadowDiam, 1, shadowDiam);
            _dummy.updateMatrix();
            csMesh.setMatrixAt(idx, _dummy.matrix);
          }
          csMesh.instanceMatrix.needsUpdate = true;
        }
      }
      prevElapsedRef.current = combat.elapsedSec;
    }

    // Check O(1) spatial grid for trees touched by the walking/dashing Mech
    if (driveMode && mechPoseRef && (!combat || combat.missionStatus === 'playing')) {
      const pose = mechPoseRef.current;
      const hits = checkFallingTreeCollisions(
        fState,
        pose.x,
        pose.y,
        pose.z,
        MECH_TREE_KNOCK_RADIUS,
        getTerrainHeight,
        hitEventsRef.current,
      );

      if (hits.length > 0) {
        combatAudio.playTreeSnap();
        if (combat) {
          combat.trauma = Math.min(1, combat.trauma + 0.08 * Math.min(2, hits.length));
        }
        for (let i = 0; i < hits.length; i++) {
          const ev = hits[i];
          tMesh.setSway(ev.index, 0.0);
          spawnWoodChips(ev.x, ev.y + 0.8, ev.z, ev.dirX, ev.dirZ, isSoftwareGl ? 4 : 7, false);
        }
      }
    }

    // Step only active falling trees (0..4 instances/frame)
    const { dirty, impacts } = stepFallingTrees(
      fState,
      dt,
      dirtyItemsRef.current,
      impactEventsRef.current,
    );

    if (impacts.length > 0) {
      combatAudio.playTreeThud();
      if (combat) {
        combat.trauma = Math.min(1, combat.trauma + 0.05);
      }
      for (let i = 0; i < impacts.length; i++) {
        const imp = impacts[i];
        spawnWoodChips(imp.x, imp.y, imp.z, imp.dirX, imp.dirZ, isSoftwareGl ? 4 : 8, true);
      }
    }

    if (dirty.length > 0 && csMesh) {
      for (let i = 0; i < dirty.length; i++) {
        const item = dirty[i];
        const t = trees[item.index];
        _baseQuat.setFromEuler(_baseEuler.set(t.tiltX, t.rotY, t.tiltZ));
        _fallAxis.set(item.axisX, 0, item.axisZ).normalize();
        _fallQuat.setFromAxisAngle(_fallAxis, item.currentAngle);

        _dummy.position.set(t.x, t.y, t.z);
        _dummy.quaternion.copy(_fallQuat).multiply(_baseQuat);
        _dummy.scale.set(t.widthScale, t.heightScale, t.widthScale);
        _dummy.updateMatrix();
        tMesh.setMatrixAt(item.index, _dummy.matrix);

        // Shrink contact shadow subtly as canopy leaves stump upright center
        const n = getAnalyticalTerrainNormal(t.x, t.z, 1.6, false);
        _normalVec.set(n.nx, n.ny, n.nz).normalize();
        _slopeQuat.setFromUnitVectors(_upVec, _normalVec);
        _yawQuat.setFromAxisAngle(_upVec, t.rotY);
        _dummy.position.set(t.x, t.y + 0.055, t.z);
        _dummy.quaternion.copy(_slopeQuat).multiply(_yawQuat);
        const shadowDiam = t.widthScale * 1.44 * (1 - Math.min(1, item.progress) * 0.42);
        _dummy.scale.set(shadowDiam, 1, shadowDiam);
        _dummy.updateMatrix();
        csMesh.setMatrixAt(item.index, _dummy.matrix);
      }
      csMesh.instanceMatrix.needsUpdate = true;
    }

    // Step splinter & pine needle particle pool
    const chipInst = chipMeshRef.current;
    if (chipInst) {
      let count = 0;
      const chips = chipsRef.current;
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        if (!c.active) continue;
        c.life += dt;
        if (c.life >= c.maxLife) {
          c.active = false;
          continue;
        }
        c.vy -= 13.5 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        const fade = 1 - c.life / c.maxLife;
        _dummy.position.set(c.x, c.y, c.z);
        _dummy.rotation.set(c.rx + c.life * 8, c.ry + c.life * 6, c.life * 5);
        _dummy.scale.setScalar(c.scale * fade);
        _dummy.updateMatrix();
        chipInst.setMatrixAt(count, _dummy.matrix);
        _chipColor.setRGB(c.r, c.g, c.b);
        chipInst.setColorAt(count, _chipColor);
        count++;
      }
      chipInst.count = count;
      chipInst.instanceMatrix.needsUpdate = true;
      if (chipInst.instanceColor) chipInst.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group visible={!preparing}>
      <instancedMesh
        ref={contactShadowRef}
        args={[contactGeo, contactShadowMaterial, trees.length]}
        renderOrder={1}
      />
      <primitive object={treeBatches.group} />
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
      <instancedMesh
        ref={chipMeshRef}
        args={[chipGeo, chipMaterial, MAX_WOOD_CHIPS]}
        frustumCulled={false}
      />
    </group>
  );
}
