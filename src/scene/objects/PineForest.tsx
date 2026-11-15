import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAnalyticalTerrainNormal } from '../../map/terrainMath';
import { generatePineForestData } from '../../map/worldStructures';
import { createContactShadowTexture } from '../textures';
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
    tMat.customProgramCacheKey = () => 'sector7-pine-merged-v2';
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

  const { trees, shrubs, logs, rootRocks } = useMemo(() => generatePineForestData(), []);

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
