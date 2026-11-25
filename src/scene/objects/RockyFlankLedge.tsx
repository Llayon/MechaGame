import { useMemo } from 'react';
import * as THREE from 'three';
import { rockyLedgeBaseY, rockyLedgeGeometry } from '../../map/rockyFlankLedge';
import {
  GLSL_CANYON_LIGHTING_PARS,
  bindCanyonLightingUniforms,
} from '../canyonLighting';

let cachedLedgeMaterial: THREE.MeshStandardMaterial | null = null;

function getRockyFlankLedgeMaterial(): THREE.MeshStandardMaterial {
  if (cachedLedgeMaterial) return cachedLedgeMaterial;

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.04,
  });
  mat.userData.staticBatchable = true;
  mat.customProgramCacheKey = () => 'sector7-rocky-ledge-v1';
  mat.onBeforeCompile = (shader) => {
    bindCanyonLightingUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vLedgeWorldPos;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 s7LedgeWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  s7LedgeWp = instanceMatrix * s7LedgeWp;
#endif
vLedgeWorldPos = ( modelMatrix * s7LedgeWp ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
#define S7_CUSTOM_AO
varying vec3 vLedgeWorldPos;
${GLSL_CANYON_LIGHTING_PARS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float s7SkyVis = s7SampleCanyonSkyVis( vLedgeWorldPos );
float s7BakedFarShadow = s7SampleBakedFarShadow( vLedgeWorldPos );
float s7CascadeFade = s7ComputeCascadeFade( vLedgeWorldPos );
float s7CustomAO = clamp( s7SkyVis, 0.26, 1.0 );`,
      );
  };

  cachedLedgeMaterial = mat;
  return mat;
}

export interface RockyFlankLedgeProps {
  position: readonly [number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Terraced slate rock shelf & boulder cluster (~5-9 m tall cover) anchored cleanly
 * into riverbank slopes for mech hull-down flanking maneuvers.
 */
export function RockyFlankLedge({
  position,
  rotationY = 0,
  scale = 1,
}: RockyFlankLedgeProps) {
  const [px, pz] = position;
  const baseY = useMemo(() => rockyLedgeBaseY(px, pz), [px, pz]);

  return (
    <mesh
      geometry={rockyLedgeGeometry}
      material={getRockyFlankLedgeMaterial()}
      position={[px, baseY, pz]}
      rotation={[0, rotationY, 0]}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}
