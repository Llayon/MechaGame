import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';
import {
  createFernBushGeometry,
  generateGrassBushAccentsData,
} from '../../map/grassField';

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
  const windUniform = useRef({ value: 0.65 });

  const { bushes, geometry, material } = useMemo(() => {
    const items = generateGrassBushAccentsData(isSoftwareGl ? 96 : 184);
    const geo = createFernBushGeometry();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    mat.customProgramCacheKey = () => 'sector7-fern-bushes-v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windUniform.current;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float bH = clamp( transformed.y / 0.68, 0.0, 1.0 );
float bBend = bH * bH;
#ifdef USE_INSTANCING
  vec3 bRoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
#else
  vec3 bRoot = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
#endif
float bPhase = uWindTime * 1.9 + bRoot.x * 0.27 + bRoot.z * 0.21;
transformed.x += sin( bPhase ) * 0.045 * bBend;
transformed.z += cos( bPhase * 0.85 + 0.9 ) * 0.036 * bBend;`,
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

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (preparing) return;
    if (!isSoftwareGl) {
      windUniform.current.value += Math.min(delta, 0.05);
    }
  });

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
