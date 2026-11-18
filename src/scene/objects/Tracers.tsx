import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import {
  MAX_TRACER_INSTANCES,
  resetTracerPool,
  stepTracerPool,
  type TracerPoolState,
} from './tracerPool';

export interface TracersProps {
  poolRef: React.MutableRefObject<TracerPoolState>;
  resetNonce: number;
}

const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwdAxis = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Two intersecting longitudinal quads along +Z with leading edge at z = 0
 * and trailing tail at z = -1.0, so high-speed rounds never poke through walls.
 */
function createTracerGeometry(): {
  geom: THREE.BufferGeometry;
  stateAttr: THREE.InstancedBufferAttribute;
  colorAttr: THREE.InstancedBufferAttribute;
  stateData: Float32Array;
  colorData: Float32Array;
} {
  const halfW = 0.5;
  const positions = new Float32Array([
    // Quad 0: Horizontal ribbon (XZ)
    -halfW, 0, -1.0,
     halfW, 0, -1.0,
     halfW, 0,  0.0,
    -halfW, 0,  0.0,
    // Quad 1: Vertical ribbon (YZ)
    0, -halfW, -1.0,
    0,  halfW, -1.0,
    0,  halfW,  0.0,
    0, -halfW,  0.0,
  ]);

  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  const indices = [
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
  ];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);

  const stateData = new Float32Array(MAX_TRACER_INSTANCES * 3);
  const stateAttr = new THREE.InstancedBufferAttribute(stateData, 3);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aTracerState', stateAttr);

  const colorData = new Float32Array(MAX_TRACER_INSTANCES * 3);
  const colorAttr = new THREE.InstancedBufferAttribute(colorData, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aTracerColor', colorAttr);

  return { geom, stateAttr, colorAttr, stateData, colorData };
}

function createTracerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute vec3 aTracerState;
attribute vec3 aTracerColor;

varying vec2 vUv;
varying vec3 vTracerState;
varying vec3 vTracerColor;

void main() {
  vUv = uv;
  vTracerState = aTracerState;
  vTracerColor = aTracerColor;

  #ifdef USE_INSTANCING
    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
  #else
    vec4 mvPos = modelViewMatrix * vec4( position, 1.0 );
  #endif
  gl_Position = projectionMatrix * mvPos;
}
`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vTracerState;
varying vec3 vTracerColor;

void main() {
  float lifeNorm = clamp( vTracerState.x, 0.0, 1.0 );
  float isRicochet = vTracerState.y;
  float activeFlag = vTracerState.z;
  if ( activeFlag < 0.5 || lifeNorm >= 0.999 ) discard;

  float radial = abs( vUv.x * 2.0 - 1.0 );
  float widthEnv = 1.0 - smoothstep( 0.08, 0.98, radial );
  // vUv.y = 0 at tail, 1 at leading nose
  float tailFade = smoothstep( 0.0, 0.65, vUv.y );
  float noseCap = 1.0 - smoothstep( 0.88, 1.0, vUv.y );
  float lifeFade = 1.0 - smoothstep( 0.62, 1.0, lifeNorm );

  float core = exp( -radial * radial * 5.2 ) * smoothstep( 0.42, 0.96, vUv.y );
  float alpha = clamp( widthEnv * tailFade * noseCap * lifeFade * 0.95, 0.0, 1.0 );
  if ( alpha < 0.012 ) discard;

  vec3 hotCore = vec3( 1.0, 0.98, 0.88 );
  vec3 col = mix( vTracerColor, hotCore, clamp( core * 0.85, 0.0, 1.0 ) );
  float boost = isRicochet > 0.5 ? 2.1 : 1.7;

  gl_FragColor = vec4( col * boost * alpha, alpha );
}
`,
  });
}

/**
 * Single draw-call pooled 37-mm tracer & ricochet streak renderer.
 */
export function Tracers({ poolRef, resetNonce }: TracersProps) {
  const { paused } = useSceneSimulation();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const geo = createTracerGeometry();
    const mat = createTracerMaterial();
    return { ...geo, mat };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_TRACER_INSTANCES; i++) {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.stateData[i * 3] = 1;
        setup.stateData[i * 3 + 1] = 0;
        setup.stateData[i * 3 + 2] = 0;
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
    resetTracerPool(poolRef.current);
    hadActiveRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    if (pool.activeCount === 0 && !hadActiveRef.current && !pool.dirty) return;

    const mesh = meshRef.current;
    if (!mesh) return;

    const slots = pool.slots;
    let renderedActive = 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const base = i * 3;
      if (!s.active) {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.stateData[base] = 1;
        setup.stateData[base + 2] = 0;
        continue;
      }

      const lifeNorm = Math.min(1, s.life / Math.max(0.02, s.maxLife));
      _pos.set(s.x, s.y, s.z);
      _dir.set(s.dx, s.dy, s.dz);
      _quat.setFromUnitVectors(_fwdAxis, _dir);
      const lenScale = s.length * (s.isRicochet ? 1.0 - lifeNorm * 0.3 : 1.0);
      _scale.set(s.thickness, s.thickness, lenScale);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);

      setup.stateData[base] = lifeNorm;
      setup.stateData[base + 1] = s.isRicochet ? 1 : 0;
      setup.stateData[base + 2] = 1;

      setup.colorData[base] = s.r;
      setup.colorData[base + 1] = s.g;
      setup.colorData[base + 2] = s.b;
      renderedActive++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    setup.stateAttr.needsUpdate = true;
    setup.colorAttr.needsUpdate = true;
    pool.dirty = false;

    const remaining = stepTracerPool(pool, dt);
    hadActiveRef.current = renderedActive > 0 || remaining > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      name="ballistic-tracers"
      args={[setup.geom, setup.mat, MAX_TRACER_INSTANCES]}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}
