import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MechTelemetrySnapshot } from '../../map/mechKinematics';
import {
  GRASS_INSTANCE_COUNT_GPU,
  GRASS_INSTANCE_COUNT_SW,
  GRASS_MAX_Y,
  GRASS_MIN_Y,
  GRASS_PATCH_RADIUS_GPU,
  GRASS_PATCH_RADIUS_SW,
  GRASS_SPAN_D,
  GRASS_SPAN_W,
  bakeTerrainGrassMap,
  createGrassClumpGeometry,
} from '../../map/grassField';

const TEX_W = 512;
const TEX_H = 448;

export interface GrassFieldProps {
  driveMode: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  isSoftwareGl: boolean;
}

interface GrassRuntimeProps {
  visible: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  isSoftwareGl: boolean;
}

function GrassFieldMesh({ visible, mechPoseRef, isSoftwareGl }: GrassRuntimeProps) {
  const patchRadius = isSoftwareGl ? GRASS_PATCH_RADIUS_SW : GRASS_PATCH_RADIUS_GPU;
  const patchSize = patchRadius * 2;
  const instanceCount = isSoftwareGl ? GRASS_INSTANCE_COUNT_SW : GRASS_INSTANCE_COUNT_GPU;

  const uniformsRef = useRef({
    uTime: { value: 0.75 },
    uWindowCenter: { value: new THREE.Vector2(mechPoseRef.current.x, mechPoseRef.current.z) },
    uMechPos: {
      value: new THREE.Vector3(
        mechPoseRef.current.x,
        mechPoseRef.current.y,
        mechPoseRef.current.z,
      ),
    },
    uPatchSize: { value: patchSize },
    uPatchRadius: { value: patchRadius },
    uTerrainSpan: { value: new THREE.Vector2(GRASS_SPAN_W, GRASS_SPAN_D) },
    uTerrainTexSize: { value: new THREE.Vector2(TEX_W, TEX_H) },
    uHeightRange: { value: new THREE.Vector2(GRASS_MIN_Y, GRASS_MAX_Y) },
    uTerrainMap: { value: null as THREE.DataTexture | null },
  });

  const terrainMap = useMemo(() => {
    const data = bakeTerrainGrassMap(TEX_W, TEX_H);
    const tex = new THREE.DataTexture(
      data,
      TEX_W,
      TEX_H,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // NearestFilter + manual highp bilinear in vertex shader prevents 8-bit UNORM
    // hardware interpolation artifacts across 16-bit R/G channel wraps.
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.flipY = false;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    uniformsRef.current.uTerrainMap.value = tex;
    return tex;
  }, []);

  const geometry = useMemo(() => {
    const bladeHeight = isSoftwareGl ? 0.35 : 0.32;
    const bladeWidth = isSoftwareGl ? 0.084 : 0.046;
    return createGrassClumpGeometry(instanceCount, patchSize, bladeHeight, bladeWidth);
  }, [instanceCount, patchSize, isSoftwareGl]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.90,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    mat.customProgramCacheKey = () => 'sector7-sliding-grass-v1';

    mat.onBeforeCompile = (shader) => {
      const u = uniformsRef.current;
      shader.uniforms.uTime = u.uTime;
      shader.uniforms.uWindowCenter = u.uWindowCenter;
      shader.uniforms.uMechPos = u.uMechPos;
      shader.uniforms.uPatchSize = u.uPatchSize;
      shader.uniforms.uPatchRadius = u.uPatchRadius;
      shader.uniforms.uTerrainSpan = u.uTerrainSpan;
      shader.uniforms.uTerrainTexSize = u.uTerrainTexSize;
      shader.uniforms.uHeightRange = u.uHeightRange;
      shader.uniforms.uTerrainMap = u.uTerrainMap;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute vec4 aOffset;

uniform float uTime;
uniform vec2 uWindowCenter;
uniform vec3 uMechPos;
uniform float uPatchSize;
uniform float uPatchRadius;
uniform vec2 uTerrainSpan;
uniform vec2 uTerrainTexSize;
uniform vec2 uHeightRange;
uniform sampler2D uTerrainMap;

varying vec2 vGrassMeta;
varying float vGrassMacro;
varying vec3 vGrassTerrNormal;

float grassHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

vec3 decodeGrassSample( vec2 uv ) {
  vec4 t = texture2D( uTerrainMap, clamp( uv, vec2( 0.0 ), vec2( 1.0 ) ) );
  float packed16 = floor( t.r * 255.0 + 0.5 ) * 256.0 + floor( t.g * 255.0 + 0.5 );
  float h = mix( uHeightRange.x, uHeightRange.y, packed16 / 65535.0 );
  return vec3( h, t.b, t.a );
}

vec4 sampleTerrainBilinear( vec2 worldXZ, out float outMacro ) {
  vec2 uv = worldXZ / uTerrainSpan + 0.5;
  vec2 texelPos = uv * uTerrainTexSize - 0.5;
  vec2 i0 = floor( texelPos );
  vec2 f = clamp( texelPos - i0, 0.0, 1.0 );
  vec2 invSize = 1.0 / uTerrainTexSize;

  vec3 s00 = decodeGrassSample( ( i0 + vec2( 0.5, 0.5 ) ) * invSize );
  vec3 s10 = decodeGrassSample( ( i0 + vec2( 1.5, 0.5 ) ) * invSize );
  vec3 s01 = decodeGrassSample( ( i0 + vec2( 0.5, 1.5 ) ) * invSize );
  vec3 s11 = decodeGrassSample( ( i0 + vec2( 1.5, 1.5 ) ) * invSize );

  vec3 s0 = mix( s00, s10, f.x );
  vec3 s1 = mix( s01, s11, f.x );
  vec3 interp = mix( s0, s1, f.y );
  outMacro = interp.z;

  vec2 cellStep = uTerrainSpan * invSize;
  float dhdx = mix( s10.x - s00.x, s11.x - s01.x, f.y ) / cellStep.x;
  float dhdz = mix( s01.x - s00.x, s11.x - s10.x, f.x ) / cellStep.y;

  return vec4( interp.x, interp.y, dhdx, dhdz );
}`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
vec2 grassRel = mod( aOffset.xy - uWindowCenter + uPatchSize * 0.5, uPatchSize ) - uPatchSize * 0.5;
vec2 grassWorldXZ = uWindowCenter + grassRel;

float grassMacro = 0.5;
vec4 grassTerr = sampleTerrainBilinear( grassWorldXZ, grassMacro );
float grassGroundY = grassTerr.x;
float grassSuit = grassTerr.y;

vec3 grassTerrN = normalize( vec3( -grassTerr.z, 1.0, -grassTerr.w ) );
vGrassTerrNormal = normalize( normalMatrix * grassTerrN );

float grassYaw = aOffset.w;
float cy = cos( grassYaw );
float sy = sin( grassYaw );
vec3 rotBladeNormal = vec3(
  objectNormal.x * cy - objectNormal.z * sy,
  objectNormal.y,
  objectNormal.x * sy + objectNormal.z * cy
);
objectNormal = normalize( mix( rotBladeNormal, grassTerrN, 0.72 ) );`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float distCenter = length( grassRel );
float edgeFade = 1.0 - smoothstep( uPatchRadius * 0.72, uPatchRadius * 0.98, distCenter );
float patchDensity = 0.72 + 0.28 * grassMacro;
float suitFade = smoothstep( 0.14, 0.72, grassSuit );
float finalScale = aOffset.z * edgeFade * suitFade * patchDensity;

float hNorm = clamp( uv.y, 0.0, 1.0 );
float tintSeed = grassHash( floor( grassWorldXZ * 2.0 + 0.5 ) );
vGrassMeta = vec2( hNorm, tintSeed );
vGrassMacro = grassMacro;

if ( finalScale <= 0.008 ) {
  // Collapse masked/out-of-radius tufts into degenerate zero-area triangles below ground
  transformed = vec3( 0.0, -50.0, 0.0 );
} else {
  vec3 bladeLocal = transformed;
  bladeLocal.y *= finalScale;
  bladeLocal.xz *= mix( 0.85, 1.22, finalScale / max( 0.01, aOffset.z ) );

  vec3 bladeWorld = vec3(
    bladeLocal.x * cy - bladeLocal.z * sy,
    bladeLocal.y,
    bladeLocal.x * sy + bladeLocal.z * cy
  );

  // World-space multi-frequency wind gust wave
  float bend = hNorm * hNorm;
  float gust = sin( uTime * 2.15 + grassWorldXZ.x * 0.34 + grassWorldXZ.y * 0.26 );
  float flutter = sin( uTime * 4.6 + grassWorldXZ.x * 0.95 - grassWorldXZ.y * 0.72 );
  bladeWorld.x += ( gust * 0.058 + flutter * 0.016 ) * bend * finalScale;
  bladeWorld.z += ( cos( uTime * 1.85 + grassWorldXZ.y * 0.31 ) * 0.042 + flutter * 0.012 ) * bend * finalScale;

  // Mech foot-trample radial parting around Object 316
  vec2 toTuft = grassWorldXZ - uMechPos.xz;
  float distMech = length( toTuft );
  float dyMech = abs( grassGroundY - uMechPos.y );
  if ( distMech < 2.6 && dyMech < 2.2 ) {
    float pushStrength = ( 1.0 - smoothstep( 0.45, 2.6, distMech ) ) * bend;
    vec2 pushDir = distMech > 0.001 ? toTuft / distMech : vec2( 1.0, 0.0 );
    bladeWorld.xz += pushDir * pushStrength * 0.32;
    bladeWorld.y -= pushStrength * 0.14 * finalScale;
  }

  transformed = vec3(
    grassWorldXZ.x + bladeWorld.x,
    grassGroundY - 0.018 + bladeWorld.y,
    grassWorldXZ.y + bladeWorld.z
  );
}`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vGrassMeta;
varying float vGrassMacro;
varying vec3 vGrassTerrNormal;

vec3 grassSrgb2Lin( vec3 c ) {
  return pow( max( c, vec3( 0.0 ) ), vec3( 2.2 ) );
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float gh = clamp( vGrassMeta.x, 0.0, 1.0 );
float gSeed = vGrassMeta.y;
float gMacro = vGrassMacro;

// Match terrainShader.ts linear moss/olive palette at root so blades emerge seamlessly
vec3 colMossDeep = grassSrgb2Lin( vec3( 0.165, 0.245, 0.180 ) );
vec3 colMossRich = grassSrgb2Lin( vec3( 0.235, 0.325, 0.220 ) );
vec3 colGrassOlive = grassSrgb2Lin( vec3( 0.285, 0.345, 0.245 ) );
vec3 colGrassDry = grassSrgb2Lin( vec3( 0.340, 0.375, 0.305 ) );

vec3 rootBase = mix( colMossDeep, colMossRich, smoothstep( 0.20, 0.80, gMacro * 0.7 + gSeed * 0.3 ) );
vec3 rootMeadow = mix( colGrassOlive, colGrassDry, smoothstep( 0.35, 0.88, gMacro ) );
vec3 rootCol = mix( rootBase, rootMeadow, smoothstep( 0.32, 0.74, gMacro ) );

vec3 tipFresh = grassSrgb2Lin( vec3( 0.315, 0.405, 0.235 ) );
vec3 tipWarm = grassSrgb2Lin( vec3( 0.415, 0.420, 0.285 ) );
vec3 tipCol = mix( tipFresh, tipWarm, smoothstep( 0.30, 0.88, gMacro * 0.55 + gSeed * 0.45 ) );

diffuseColor.rgb = mix( rootCol * 0.66, tipCol, smoothstep( 0.06, 0.92, gh ) ) * ( 0.88 + gSeed * 0.22 );`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
normal = normalize( mix( normal, normalize( vGrassTerrNormal ), 0.86 ) );
nonPerturbedNormal = normal;`,
        );
    };

    return mat;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      terrainMap.dispose();
    };
  }, [geometry, material, terrainMap]);

  useFrame((_, delta) => {
    if (!visible) return;
    const m = mechPoseRef.current;
    const u = uniformsRef.current;
    // Offset sliding window slightly ahead of Mech facing so forward vista has maximal grass coverage
    const forwardBias = isSoftwareGl ? 8.0 : 8.0;
    u.uWindowCenter.value.set(
      m.x + Math.sin(m.yaw) * forwardBias,
      m.z + Math.cos(m.yaw) * forwardBias,
    );
    u.uMechPos.value.set(m.x, m.y, m.z);
    if (!isSoftwareGl) {
      u.uTime.value += Math.min(delta, 0.05);
    }
  });

  return (
    <mesh
      visible={visible}
      geometry={geometry}
      material={material}
      receiveShadow={!isSoftwareGl}
      castShadow={false}
      frustumCulled={false}
    />
  );
}

/**
 * GPU Sliding-Window grass meadow active in Drive Mode.
 * Lazily bakes the 512x448 height/suitability map on first Drive Mode entry so Overview load stays instant.
 */
export function GrassField({ driveMode, mechPoseRef, isSoftwareGl }: GrassFieldProps) {
  const [hasActivated, setHasActivated] = useState(driveMode);

  useEffect(() => {
    if (driveMode && !hasActivated) {
      setHasActivated(true);
    }
  }, [driveMode, hasActivated]);

  if (!hasActivated) return null;

  return (
    <GrassFieldMesh
      visible={driveMode}
      mechPoseRef={mechPoseRef}
      isSoftwareGl={isSoftwareGl}
    />
  );
}
