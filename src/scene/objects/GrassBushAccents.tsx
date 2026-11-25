import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';
import {
  createFernBushGeometry,
  generateGrassBushAccentsData,
} from '../../map/grassField';
import {
  bindFoliageLightingUniforms,
  GLSL_FOLIAGE_TRANSMITTANCE_PARS,
  GLSL_FOLIAGE_WIND_PARS,
} from '../foliageLighting';

export interface GrassBushAccentsProps {
  isSoftwareGl?: boolean;
  preparing?: boolean;
}

const _dummy = new THREE.Object3D();
const _tint = new THREE.Color();

// Biome tint multipliers over Vertex Colors (kept rich & muted for cohesive canyon palette)
const ROCK_FERN_LOW = new THREE.Color('#3b643b');
const ROCK_FERN_HIGH = new THREE.Color('#588148');
const RUIN_SAGE_LOW = new THREE.Color('#5a6b48');
const RUIN_SAGE_HIGH = new THREE.Color('#778052');
const ROAD_OCHRE_LOW = new THREE.Color('#6b6e3f');
const ROAD_OCHRE_HIGH = new THREE.Color('#958246');

export function GrassBushAccents({ isSoftwareGl = false, preparing = false }: GrassBushAccentsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { bushes, geometry, material } = useMemo(() => {
    const items = generateGrassBushAccentsData(isSoftwareGl ? 96 : 184);
    const geo = createFernBushGeometry();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    mat.customProgramCacheKey = () => 'sector7-fern-bushes-v2';
    mat.onBeforeCompile = (shader) => {
      bindFoliageLightingUniforms(shader.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
${GLSL_FOLIAGE_WIND_PARS}
varying vec3 vFernWorldPos;
varying vec3 vFernWorldNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float bH = clamp( transformed.y / 0.68, 0.0, 1.0 );
#ifdef USE_INSTANCING
  mat4 fernInstWorld = modelMatrix * instanceMatrix;
#else
  mat4 fernInstWorld = modelMatrix;
#endif
vec3 bRoot = ( fernInstWorld * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
vec3 bWind = s7TravelingWindOffset(
  bRoot.xz,
  bH,
  0.26,
  bRoot.x * 0.27 + bRoot.z * 0.21,
  0.015
);
transformed += s7WorldToLocalOffset( mat3( fernInstWorld ), bWind );
vFernWorldPos = ( fernInstWorld * vec4( transformed, 1.0 ) ).xyz;
vFernWorldNormal = normalize( mat3( fernInstWorld ) * objectNormal );`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
${GLSL_FOLIAGE_TRANSMITTANCE_PARS}
varying vec3 vFernWorldPos;
varying vec3 vFernWorldNormal;`,
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
vec3 fernFaceN = normalize( vFernWorldNormal ) * ( gl_FrontFacing ? 1.0 : -1.0 );
reflectedLight.directDiffuse += s7ComputeFoliageTransmittance( vFernWorldPos, fernFaceN, diffuseColor.rgb, 0.72 );`,
        );
    };
    return { bushes: items, geometry: geo, material: mat };
  }, [isSoftwareGl]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < bushes.length; i++) {
      const b = bushes[i];
      _dummy.position.set(b.x, b.y - 0.03, b.z);
      _dummy.rotation.set(0, b.rotY, 0);
      _dummy.scale.set(b.scale * 1.05, b.scale * (0.88 + b.tint * 0.28), b.scale * 1.05);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      if (b.kind === 'rock') {
        _tint.copy(ROCK_FERN_LOW).lerp(ROCK_FERN_HIGH, b.tint);
      } else if (b.kind === 'ruin') {
        _tint.copy(RUIN_SAGE_LOW).lerp(RUIN_SAGE_HIGH, b.tint);
      } else {
        _tint.copy(ROAD_OCHRE_LOW).lerp(ROAD_OCHRE_HIGH, b.tint);
      }
      mesh.setColorAt(i, _tint);
    }
    mesh.count = bushes.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bushes]);

  useMeshShaderWarmup(meshRef, preparing);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (bushes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      visible={!preparing}
      args={[geometry, material, bushes.length]}
      castShadow={false}
      receiveShadow={!isSoftwareGl}
      frustumCulled={false}
    />
  );
}
