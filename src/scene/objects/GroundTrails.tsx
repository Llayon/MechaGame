import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import {
  MAX_GROUND_TRAILS,
  computeGroundTrailTransform,
  resetGroundTrailsPool,
  stepGroundTrailsPool,
  type GroundTrailTransform,
  type GroundTrailsPoolState,
} from './groundTrailsPool';

export interface GroundTrailsProps {
  poolRef: React.MutableRefObject<GroundTrailsPoolState>;
  isSoftwareGl: boolean;
  resetNonce: number;
}

const _pos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);

const _trailTf: GroundTrailTransform = {
  x: 0,
  y: 0,
  z: 0,
  nx: 0,
  ny: 1,
  nz: 0,
  yaw: 0,
  width: 1,
  length: 1,
  alpha: 0,
  kindId: 0,
  wetness: 0,
};

function createGroundTrailMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.02,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    fog: true,
  });

  mat.customProgramCacheKey = () => 'sector7-ground-trails-pbr-v1';

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aTrailData;
varying vec2 vTrailUv;
varying vec3 vTrailData;
varying vec3 vTrailTangentView;
varying vec3 vTrailBitangentView;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTrailUv = uv;
vTrailData = aTrailData;
#ifdef USE_INSTANCING
  mat3 tMat = mat3( modelViewMatrix ) * mat3( instanceMatrix );
#else
  mat3 tMat = mat3( modelViewMatrix );
#endif
vTrailTangentView = normalize( tMat * vec3( 1.0, 0.0, 0.0 ) );
vTrailBitangentView = normalize( tMat * vec3( 0.0, 0.0, -1.0 ) );`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vTrailUv;
varying vec3 vTrailData;
varying vec3 vTrailTangentView;
varying vec3 vTrailBitangentView;

float trailHash( vec2 p ) {
  p = mod( p, 289.0 );
  vec2 q = fract( p * vec2( 0.1031, 0.1030 ) );
  q += dot( q, q.yx + 33.33 );
  return fract( ( q.x + q.y ) * q.x );
}

float trailNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( trailHash( i ), trailHash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( trailHash( i + vec2( 0.0, 1.0 ) ), trailHash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y
  );
}

float sdRotBox( vec2 p, vec2 center, float angle, vec2 halfSize ) {
  vec2 d = p - center;
  float c = cos( angle );
  float s = sin( angle );
  vec2 r = vec2( d.x * c + d.y * s, -d.x * s + d.y * c );
  vec2 q = abs( r ) - halfSize;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float tAlpha = vTrailData.x;
float tKind = vTrailData.y;
float tWet = vTrailData.z;
if ( tAlpha <= 0.005 ) discard;

// Map UV so p.x in [-0.5..0.5] is right and p.y in [-0.5..0.5] points along +Z forward
vec2 tp = vec2( vTrailUv.x - 0.5, 0.5 - vTrailUv.y );
float tMicro = trailNoise( vTrailUv * 22.0 );
float treadField = 1.0;

if ( tKind < 0.5 ) {
  // 3-toed Soviet Mech footprint: two splayed front claws + center pad + rear heel spur
  float dLeftToe = sdRotBox( tp, vec2( -0.17, 0.24 ), -0.18, vec2( 0.068, 0.145 ) );
  float dRightToe = sdRotBox( tp, vec2( 0.17, 0.24 ), 0.18, vec2( 0.068, 0.145 ) );
  float dMidPad = sdRotBox( tp, vec2( 0.0, 0.02 ), 0.0, vec2( 0.175, 0.135 ) );
  float dHeel = sdRotBox( tp, vec2( 0.0, -0.25 ), 0.0, vec2( 0.115, 0.125 ) );
  treadField = min( min( dLeftToe, dRightToe ), min( dMidPad, dHeel ) );
} else if ( tKind < 1.5 ) {
  // Parallel heel/claw braking & Jet-Dash skid gouges
  float dLeftSkid = sdRotBox( tp, vec2( -0.32, 0.0 ), 0.0, vec2( 0.105, 0.42 ) );
  float dRightSkid = sdRotBox( tp, vec2( 0.32, 0.0 ), 0.0, vec2( 0.105, 0.42 ) );
  treadField = min( dLeftSkid, dRightSkid ) + ( tMicro - 0.5 ) * 0.035;
} else {
  // Parallel armored Scout APC dual tire/track ruts with longitudinal fade
  float dLeftTrack = sdRotBox( tp, vec2( -0.34, 0.0 ), 0.0, vec2( 0.095, 0.44 ) );
  float dRightTrack = sdRotBox( tp, vec2( 0.34, 0.0 ), 0.0, vec2( 0.095, 0.44 ) );
  treadField = min( dLeftTrack, dRightTrack ) + ( tMicro - 0.5 ) * 0.022;
}

if ( treadField > 0.11 ) discard;

float pressMask = 1.0 - smoothstep( -0.025, 0.038, treadField );
float bermMask = smoothstep( 0.012, 0.048, treadField ) * ( 1.0 - smoothstep( 0.048, 0.105, treadField ) );
float cleatWave = 0.5 + 0.5 * sin( ( tp.y - abs( tp.x ) * 0.38 ) * ( tKind >= 1.5 ? 52.0 : 34.0 ) );
float cleatDark = mix( 1.0, 0.72 + 0.28 * cleatWave, pressMask );

vec3 dryPressed = vec3( 0.165, 0.140, 0.112 );
vec3 wetPressed = vec3( 0.075, 0.068, 0.058 );
vec3 dryBerm = vec3( 0.295, 0.255, 0.205 );
vec3 wetBerm = vec3( 0.145, 0.132, 0.110 );

vec3 pressedCol = mix( dryPressed, wetPressed, tWet );
vec3 bermCol = mix( dryBerm, wetBerm, tWet );
vec3 finalCol = mix( bermCol, pressedCol * cleatDark, pressMask );
diffuseColor.rgb *= finalCol * ( 0.88 + tMicro * 0.24 );

float endSoft = 1.0 - smoothstep( 0.34, 0.495, abs( tp.y ) );
float edgeAlpha = clamp( pressMask * 0.84 + bermMask * 0.46, 0.0, 0.90 );
diffuseColor.a = edgeAlpha * tAlpha * ( tKind < 0.5 ? 1.0 : endSoft );
if ( diffuseColor.a < 0.015 ) discard;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix( 0.90, 0.34, vTrailData.z );`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// Perturb surface normal into pressed tread trough & raised side berm
float nBump = ( smoothstep( -0.04, 0.03, treadField ) - smoothstep( 0.03, 0.10, treadField ) ) * 0.58;
float nCleat = ( sin( ( tp.y - abs( tp.x ) * 0.38 ) * 46.0 ) ) * pressMask * 0.24;
vec2 gradDir = normalize( vec2( tp.x, tp.y ) + vec2( 1e-4 ) );
normal = normalize(
  normal
  + vTrailTangentView * ( gradDir.x * nBump + ( tMicro - 0.5 ) * 0.12 )
  + vTrailBitangentView * ( nCleat + gradDir.y * nBump * 0.5 )
);`,
      );
  };

  return mat;
}

export function GroundTrails({
  poolRef,
  isSoftwareGl,
  resetNonce,
}: GroundTrailsProps) {
  const { paused } = useSceneSimulation();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);
  const fadeTickRef = useRef(0);

  const setup = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI * 0.5);

    const trailData = new Float32Array(MAX_GROUND_TRAILS * 3);
    const trailDataAttr = new THREE.InstancedBufferAttribute(trailData, 3);
    trailDataAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('aTrailData', trailDataAttr);

    const mat = createGroundTrailMaterial();
    return { geom, mat, trailData, trailDataAttr };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_GROUND_TRAILS; i++) {
        mesh.setMatrixAt(i, _zeroMat4);
        setup.trailData[i * 3] = 0;
        setup.trailData[i * 3 + 1] = 0;
        setup.trailData[i * 3 + 2] = 0;
      }
      mesh.instanceMatrix.needsUpdate = true;
      setup.trailDataAttr.needsUpdate = true;
    }
    return () => {
      setup.geom.dispose();
      setup.mat.dispose();
    };
  }, [setup]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetGroundTrailsPool(poolRef.current);
    hadActiveRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    const prevActive = pool.activeCount;
    if (prevActive === 0 && !hadActiveRef.current && !pool.dirtyMatrices) return;

    const nowActive = stepGroundTrailsPool(pool, dt);
    fadeTickRef.current += dt;

    // Upload full matrix + trailData when stamped/reset, or fade opacities at ~6 Hz (much lighter on software GL)
    const shouldRefreshFade = fadeTickRef.current >= (isSoftwareGl ? 0.35 : 0.16);
    if (!pool.dirtyMatrices && !shouldRefreshFade && (nowActive > 0 || !hadActiveRef.current)) {
      return;
    }
    if (shouldRefreshFade) fadeTickRef.current = 0;

    const mesh = meshRef.current;
    if (!mesh) return;

    const capacity = pool.slots.length;
    const totalSpawned = pool.totalSpawned;
    const updateMatrices = pool.dirtyMatrices || nowActive === 0;

    for (let i = 0; i < capacity; i++) {
      if (computeGroundTrailTransform(pool.slots[i], totalSpawned, capacity, _trailTf)) {
        if (updateMatrices) {
          _pos.set(_trailTf.x, _trailTf.y, _trailTf.z);
          _normal.set(_trailTf.nx, _trailTf.ny, _trailTf.nz).normalize();
          _fwd.set(Math.sin(_trailTf.yaw), 0, Math.cos(_trailTf.yaw));
          // Project forward onto surface tangent plane so decal sits flush on hills
          _fwd.addScaledVector(_normal, -_fwd.dot(_normal)).normalize();
          _right.crossVectors(_normal, _fwd).normalize();
          _basis.makeBasis(_right, _normal, _fwd);
          _scale.set(_trailTf.width, 1, _trailTf.length);
          _mat.copy(_basis).scale(_scale);
          _mat.setPosition(_pos);
          mesh.setMatrixAt(i, _mat);
        }
        setup.trailData[i * 3] = _trailTf.alpha;
        setup.trailData[i * 3 + 1] = _trailTf.kindId;
        setup.trailData[i * 3 + 2] = _trailTf.wetness;
      } else {
        if (updateMatrices) {
          mesh.setMatrixAt(i, _zeroMat4);
        }
        setup.trailData[i * 3] = 0;
      }
    }

    if (updateMatrices) {
      mesh.instanceMatrix.needsUpdate = true;
      pool.dirtyMatrices = false;
    }
    setup.trailDataAttr.needsUpdate = true;
    hadActiveRef.current = nowActive > 0;
  });

  return (
    <instancedMesh
      ref={meshRef}
      name="ground-splat-trails"
      args={[setup.geom, setup.mat, MAX_GROUND_TRAILS]}
      frustumCulled={false}
      receiveShadow
      renderOrder={1}
    />
  );
}
