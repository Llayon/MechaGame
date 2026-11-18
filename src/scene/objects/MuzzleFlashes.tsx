import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import {
  MAX_MUZZLE_FLASHES,
  computeMuzzleFlashRenderData,
  resetMuzzleFlashPool,
  stepMuzzleFlashPool,
  type MuzzleFlashPoolState,
  type MuzzleFlashRenderData,
} from './muzzleFlashPool';

export interface MuzzleFlashesProps {
  poolRef: React.MutableRefObject<MuzzleFlashPoolState>;
  resetNonce: number;
}

const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwdAxis = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();
const _rollQuat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);

const _flashTf: MuzzleFlashRenderData = {
  x: 0,
  y: 0,
  z: 0,
  dx: 0,
  dy: 0,
  dz: 1,
  roll: 0,
  scaleXZ: 1,
  scaleZ: 1,
  lifeNorm: 0,
  seed: 0,
  r: 1,
  g: 0.68,
  b: 0.22,
  intensity: 1,
};

/**
 * 3-plane volumetric muzzle star geometry oriented along +Z with root at z = 0:
 *  - Quad 0: horizontal longitudinal flame petal (z in [0, 1.15])
 *  - Quad 1: vertical longitudinal flame petal (z in [0, 1.15])
 *  - Quad 2: transverse star crown near muzzle cut (z = 0.06) for head-on/rear volume
 */
function createMuzzleStarGeometry(): {
  geom: THREE.BufferGeometry;
  flashStateAttr: THREE.InstancedBufferAttribute;
  flashColorAttr: THREE.InstancedBufferAttribute;
  flashStateData: Float32Array;
  flashColorData: Float32Array;
} {
  const halfW = 0.31;
  const lenZ = 1.15;
  const crownHalf = 0.38;
  const crownZ = 0.06;

  // 12 vertices total (4 per quad)
  const positions = new Float32Array([
    // Quad 0: Horizontal longitudinal petal (XZ plane)
    -halfW, 0, 0,
     halfW, 0, 0,
     halfW, 0, lenZ,
    -halfW, 0, lenZ,
    // Quad 1: Vertical longitudinal petal (YZ plane)
    0, -halfW, 0,
    0,  halfW, 0,
    0,  halfW, lenZ,
    0, -halfW, lenZ,
    // Quad 2: Transverse muzzle crown (XY plane at z = crownZ)
    -crownHalf, -crownHalf, crownZ,
     crownHalf, -crownHalf, crownZ,
     crownHalf,  crownHalf, crownZ,
    -crownHalf,  crownHalf, crownZ,
  ]);

  const uvs = new Float32Array([
    // Quad 0
    0, 0,  1, 0,  1, 1,  0, 1,
    // Quad 1
    0, 0,  1, 0,  1, 1,  0, 1,
    // Quad 2
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  const isCrown = new Float32Array([
    0, 0, 0, 0,
    0, 0, 0, 0,
    1, 1, 1, 1,
  ]);

  const indices = [
    0, 1, 2,   0, 2, 3,
    4, 5, 6,   4, 6, 7,
    8, 9, 10,  8, 10, 11,
  ];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setAttribute('aIsCrown', new THREE.BufferAttribute(isCrown, 1));
  geom.setIndex(indices);

  const flashStateData = new Float32Array(MAX_MUZZLE_FLASHES * 3);
  const flashStateAttr = new THREE.InstancedBufferAttribute(flashStateData, 3);
  flashStateAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aFlashState', flashStateAttr);

  const flashColorData = new Float32Array(MAX_MUZZLE_FLASHES * 3);
  const flashColorAttr = new THREE.InstancedBufferAttribute(flashColorData, 3);
  flashColorAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('aFlashColor', flashColorAttr);

  return { geom, flashStateAttr, flashColorAttr, flashStateData, flashColorData };
}

function createMuzzleFlashMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute float aIsCrown;
attribute vec3 aFlashState;
attribute vec3 aFlashColor;

varying vec2 vUv;
varying float vIsCrown;
varying vec3 vFlashState;
varying vec3 vFlashColor;

void main() {
  vUv = uv;
  vIsCrown = aIsCrown;
  vFlashState = aFlashState;
  vFlashColor = aFlashColor;

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
varying float vIsCrown;
varying vec3 vFlashState;
varying vec3 vFlashColor;

void main() {
  float life = clamp( vFlashState.x, 0.0, 1.0 );
  float seed = vFlashState.y;
  float intensity = vFlashState.z;

  if ( life >= 0.999 || intensity <= 0.001 ) discard;

  float env = ( 0.85 + 0.15 * smoothstep( 0.0, 0.14, life ) )
    * ( 1.0 - smoothstep( 0.20, 1.0, life ) );
  if ( env <= 0.005 ) discard;

  float shape = 0.0;
  float hotCore = 0.0;

  if ( vIsCrown < 0.5 ) {
    // Longitudinal flame petal: vUv.y = 0 sits tightly at barrel muzzle cut, 1 is tip
    float u = vUv.x * 2.0 - 1.0;
    float z = vUv.y;
    float taper = mix( 0.42, 0.07, pow( z, 0.72 ) );
    float tongue = sin( z * 15.0 + seed * 43.0 ) * 0.11
      + cos( z * 24.0 - seed * 31.0 ) * 0.07;
    float radial = abs( u ) / max( 0.05, taper + tongue * z );

    float widthMask = 1.0 - smoothstep( 0.14, 1.04, radial );
    float rootEdge = smoothstep( 0.0, 0.05, z );
    float tipFade = 1.0 - smoothstep( 0.38, 0.98, z + tongue * 0.30 );
    float brakePortFlare = exp( -abs( u ) * 3.2 ) * ( 1.0 - smoothstep( 0.06, 0.36, z ) );

    shape = clamp( widthMask * rootEdge * tipFade + brakePortFlare * 0.45, 0.0, 1.0 );
    hotCore = exp( -radial * radial * 2.4 ) * ( 1.0 - smoothstep( 0.04, 0.58, z ) );
  } else {
    // Transverse 8-pointed star crown at muzzle exit
    vec2 p = vUv * 2.0 - 1.0;
    float r = length( p );
    float ang = atan( p.y, p.x );
    float rays = pow( abs( cos( ang * 3.0 + seed * 6.2831 ) ), 3.0 ) * 0.40
      + pow( abs( cos( ang * 5.0 - seed * 9.4247 ) ), 4.0 ) * 0.26;
    float starOuter = 0.36 + rays;

    float crownBody = 1.0 - smoothstep( 0.10, starOuter, r );
    float crownCore = exp( -r * r * 9.0 );
    shape = clamp( crownBody * 0.76 + crownCore * 0.92, 0.0, 1.0 );
    hotCore = crownCore;
  }

  float alpha = shape * env * 0.95;
  if ( alpha < 0.012 ) discard;

  vec3 whiteHot = vec3( 1.0, 0.98, 0.90 );
  float coolShift = smoothstep( 0.0, 0.55, life );
  vec3 col = mix( whiteHot, vFlashColor, coolShift * ( 1.0 - hotCore * 0.65 ) );

  gl_FragColor = vec4( col * intensity * ( 0.85 + hotCore * 1.15 ) * alpha, alpha );
}
`,
  });
}

export function MuzzleFlashes({ poolRef, resetNonce }: MuzzleFlashesProps) {
  const { paused } = useSceneSimulation();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const geo = createMuzzleStarGeometry();
    const mat = createMuzzleFlashMaterial();
    return { ...geo, mat };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_MUZZLE_FLASHES; i++) {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.flashStateData[i * 3] = 1;
        setup.flashStateData[i * 3 + 1] = 0;
        setup.flashStateData[i * 3 + 2] = 0;
      }
      mesh.instanceMatrix.needsUpdate = true;
      setup.flashStateAttr.needsUpdate = true;
    }
    return () => {
      setup.geom.dispose();
      setup.mat.dispose();
    };
  }, [setup]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetMuzzleFlashPool(poolRef.current);
    hadActiveRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    if (pool.activeCount === 0 && !hadActiveRef.current && !pool.dirty) return;

    const mesh = meshRef.current;
    if (!mesh) return;

    const capacity = pool.slots.length;
    let renderedActive = 0;
    for (let i = 0; i < capacity; i++) {
      if (computeMuzzleFlashRenderData(pool.slots[i], _flashTf)) {
        _pos.set(_flashTf.x, _flashTf.y, _flashTf.z);
        _dir.set(_flashTf.dx, _flashTf.dy, _flashTf.dz);
        _quat.setFromUnitVectors(_fwdAxis, _dir);
        _rollQuat.setFromAxisAngle(_fwdAxis, _flashTf.roll);
        _quat.multiply(_rollQuat);
        _scale.set(_flashTf.scaleXZ, _flashTf.scaleXZ, _flashTf.scaleZ);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);

        const base = i * 3;
        setup.flashStateData[base] = _flashTf.lifeNorm;
        setup.flashStateData[base + 1] = _flashTf.seed;
        setup.flashStateData[base + 2] = _flashTf.intensity;

        setup.flashColorData[base] = _flashTf.r;
        setup.flashColorData[base + 1] = _flashTf.g;
        setup.flashColorData[base + 2] = _flashTf.b;
        renderedActive++;
      } else {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.flashStateData[i * 3] = 1;
        setup.flashStateData[i * 3 + 2] = 0;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    setup.flashStateAttr.needsUpdate = true;
    setup.flashColorAttr.needsUpdate = true;
    pool.dirty = false;

    const remainingActive = stepMuzzleFlashPool(pool, dt);
    hadActiveRef.current = renderedActive > 0 || remainingActive > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      name="muzzle-flash-cards"
      args={[setup.geom, setup.mat, MAX_MUZZLE_FLASHES]}
      frustumCulled={false}
      renderOrder={5}
    />
  );
}
