import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import type { LightingPreset } from '../../map/sectors';
import {
  MAX_HEAT_SHIMMER_SLOTS,
  computeHeatShimmerRenderData,
  resetHeatShimmerPool,
  stepHeatShimmerPool,
  type HeatShimmerPoolState,
  type HeatShimmerRenderData,
} from './heatShimmerPool';

export interface HeatShimmerProps {
  poolRef: React.MutableRefObject<HeatShimmerPoolState>;
  lightingPreset: LightingPreset;
  resetNonce: number;
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);

const _shimmerTf: HeatShimmerRenderData = {
  x: 0,
  y: 0,
  z: 0,
  scaleX: 0,
  scaleY: 0,
  lifeNorm: 0,
  alpha: 0,
  seed: 0,
  riseSpeed: 1,
  warmTint: 0.4,
};

const PRESET_HAZE_GAIN: Record<LightingPreset, number> = {
  day: 1.0,
  dusk: 1.08,
  night: 0.72,
};

function createHeatShimmerGeometry(): {
  geom: THREE.BufferGeometry;
  stateAttr: THREE.InstancedBufferAttribute;
  tintAttr: THREE.InstancedBufferAttribute;
  stateData: Float32Array;
  tintData: Float32Array;
} {
  // Bottom-anchored unit quad: x in [-0.5, 0.5], y in [0, 1]
  const geom = new THREE.PlaneGeometry(1, 1);
  geom.translate(0, 0.5, 0);

  const stateData = new Float32Array(MAX_HEAT_SHIMMER_SLOTS * 4);
  const stateAttr = new THREE.InstancedBufferAttribute(stateData, 4);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aShimmerState', stateAttr);

  const tintData = new Float32Array(MAX_HEAT_SHIMMER_SLOTS);
  const tintAttr = new THREE.InstancedBufferAttribute(tintData, 1);
  tintAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aShimmerTint', tintAttr);

  return { geom, stateAttr, tintAttr, stateData, tintData };
}

function createHeatShimmerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPresetGain: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
attribute vec4 aShimmerState;
attribute float aShimmerTint;

varying vec2 vUv;
varying vec4 vShimmerState;
varying float vWarmTint;

void main() {
  vUv = uv;
  vShimmerState = aShimmerState;
  vWarmTint = aShimmerTint;

  #ifdef USE_INSTANCING
    vec3 worldCenter = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
    float wScale = length( instanceMatrix[0].xyz );
    float hScale = length( instanceMatrix[1].xyz );
  #else
    vec3 worldCenter = vec3( 0.0 );
    float wScale = 1.0;
    float hScale = 1.0;
  #endif

  vec3 camRight = vec3( viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0] );
  vec3 camUp = normalize( mix(
    vec3( 0.0, 1.0, 0.0 ),
    vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] ),
    0.35
  ) );

  vec3 worldPos = worldCenter
    + camRight * ( position.x * wScale )
    + camUp * ( position.y * hScale );

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( worldPos, 1.0 );
}
`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uPresetGain;

varying vec2 vUv;
varying vec4 vShimmerState;
varying float vWarmTint;

void main() {
  float alphaEnv = vShimmerState.x;
  float seed = vShimmerState.z;
  float riseSpeed = vShimmerState.w;

  if ( alphaEnv <= 0.002 ) discard;

  float y = vUv.y;
  float xNorm = ( vUv.x - 0.5 ) * 2.0;

  // Soft plume taper and convective lateral sway without hard quad edges
  float sway = sin( y * 5.2 - uTime * 3.4 * riseSpeed + seed * 6.2831 ) * 0.16 * y;
  float xRadial = abs( xNorm + sway ) / mix( 0.86, 1.12, y );
  float xMask = 1.0 - smoothstep( 0.10, 0.96, xRadial );
  float yBot = smoothstep( 0.0, 0.18, y );
  float yTop = 1.0 - smoothstep( 0.44, 0.98, y );
  float plumeMask = xMask * yBot * yTop;
  if ( plumeMask <= 0.004 ) discard;

  // Smooth multi-octave scrolling thermal convection waves (no high-freq stippling at low DPR)
  float tScroll = uTime * 3.8 * riseSpeed + seed * 19.0;
  float warpX = xNorm * 3.8 + sin( y * 7.2 - tScroll * 1.1 ) * 0.85;
  float bandA = 0.5 + 0.5 * sin( warpX * 1.5 + y * 8.5 - tScroll * 1.5 );
  float bandB = 0.5 + 0.5 * cos( xNorm * 5.2 - y * 10.5 + tScroll * 1.2 + seed * 11.0 );
  float waveMix = bandA * 0.58 + bandB * 0.42;

  float mirageStreaks = smoothstep( 0.28, 0.94, waveMix );
  float hotBase = 1.0 - smoothstep( 0.04, 0.52, y );

  vec3 warmAir = vec3( 1.0, 0.92, 0.78 );
  vec3 emberAir = vec3( 1.0, 0.68, 0.30 );
  vec3 tintCol = mix( warmAir, emberAir, clamp( vWarmTint * ( 0.48 + 0.52 * hotBase ), 0.0, 1.0 ) );

  float alpha = plumeMask * ( 0.18 + mirageStreaks * 0.82 ) * alphaEnv * 0.24 * uPresetGain;
  if ( alpha <= 0.004 ) discard;

  vec3 outCol = tintCol * ( 0.75 + mirageStreaks * 0.75 );
  gl_FragColor = vec4( outCol, alpha );
}
`,
  });
}

/**
 * Single draw-call procedural Heat Haze / Convective Shimmer billboard pool.
 * Simulates rising hot air distortion behind mech exhausts, explosions, burning wrecks,
 * and laser molten slag without costly screen-space refraction framebuffer copies.
 */
export function HeatShimmer({
  poolRef,
  lightingPreset,
  resetNonce,
}: HeatShimmerProps) {
  const { paused } = useSceneSimulation();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveRef = useRef(false);
  const animTimeRef = useRef(0);
  const prevResetNonceRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const geo = createHeatShimmerGeometry();
    const mat = createHeatShimmerMaterial();
    return { ...geo, mat };
  }, []);

  useEffect(() => {
    setup.mat.uniforms.uPresetGain.value = PRESET_HAZE_GAIN[lightingPreset];
  }, [lightingPreset, setup]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_HEAT_SHIMMER_SLOTS; i++) {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.stateData[i * 4] = 0;
      }
      mesh.instanceMatrix.needsUpdate = true;
      setup.stateAttr.needsUpdate = true;
    }
    return () => {
      setup.geom.dispose();
      setup.mat.dispose();
    };
  }, [setup]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetHeatShimmerPool(poolRef.current);
    hadActiveRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    animTimeRef.current += dt;
    setup.mat.uniforms.uTime.value = animTimeRef.current;

    const pool = poolRef.current;
    if (pool.activeCount === 0 && !hadActiveRef.current && !pool.dirty) return;

    const mesh = meshRef.current;
    if (!mesh) return;

    const slots = pool.slots;
    let renderedActive = 0;
    for (let i = 0; i < slots.length; i++) {
      if (computeHeatShimmerRenderData(slots[i], _shimmerTf)) {
        _pos.set(_shimmerTf.x, _shimmerTf.y, _shimmerTf.z);
        _scale.set(_shimmerTf.scaleX, _shimmerTf.scaleY, 1);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);

        const base = i * 4;
        setup.stateData[base] = _shimmerTf.alpha;
        setup.stateData[base + 1] = _shimmerTf.lifeNorm;
        setup.stateData[base + 2] = _shimmerTf.seed;
        setup.stateData[base + 3] = _shimmerTf.riseSpeed;
        setup.tintData[i] = _shimmerTf.warmTint;
        renderedActive++;
      } else {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.stateData[i * 4] = 0;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    setup.stateAttr.needsUpdate = true;
    setup.tintAttr.needsUpdate = true;
    pool.dirty = false;

    const remainingActive = stepHeatShimmerPool(pool, dt);
    hadActiveRef.current = renderedActive > 0 || remainingActive > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      name="heat-shimmer-haze"
      args={[setup.geom, setup.mat, MAX_HEAT_SHIMMER_SLOTS]}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}
