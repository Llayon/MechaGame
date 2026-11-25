import { readWorldLod } from '../../lod/worldLod';
import { createGrassBands } from './grassBands';
import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { LightingPreset } from '../../map/sectors';
import type { MechTelemetrySnapshot } from '../../map/mechKinematics';
import {
  GRASS_MAX_Y,
  GRASS_MIN_Y,
  GRASS_PATCH_RADIUS_GPU,
  GRASS_PATCH_RADIUS_SW,
  GRASS_SPAN_D,
  GRASS_SPAN_W,
} from '../../map/grassField';

import { WORLD_MAP_WIDTH as TEX_W, WORLD_MAP_HEIGHT as TEX_H } from '../../map/worldMapDimensions';
import {
  bindFoliageLightingUniforms,
  GLSL_FOLIAGE_WIND_PARS,
} from '../foliageLighting';

const BACKLIGHT_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#dce85c'),
  dusk: new THREE.Color('#ffaf45'),
  night: new THREE.Color('#122434'),
};

export interface GrassFieldProps {
  data: Uint8Array<ArrayBuffer>;
  driveMode: boolean;
  preparing: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  isSoftwareGl: boolean;
}

interface GrassRuntimeProps {
  data: Uint8Array<ArrayBuffer>;
  visible: boolean;
  preparing: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  isSoftwareGl: boolean;
}

function GrassFieldMesh({
  data,
  visible,
  preparing,
  mechPoseRef,
  lightingPreset,
  sunPos,
  isSoftwareGl,
}: GrassRuntimeProps) {
  const patchRadius = isSoftwareGl ? GRASS_PATCH_RADIUS_SW : GRASS_PATCH_RADIUS_GPU;
  const patchSize = patchRadius * 2;
  const firstBand = useRef<THREE.Mesh>(null);
  const { gl, camera, scene } = useThree();

  const uniformsRef = useRef({
    uWindowCenter: { value: new THREE.Vector2(mechPoseRef.current.x, mechPoseRef.current.z) },
    uMechPos: {
      value: new THREE.Vector3(
        mechPoseRef.current.x,
        mechPoseRef.current.y,
        mechPoseRef.current.z,
      ),
    },
    uFootL: {
      value: new THREE.Vector2(
        mechPoseRef.current.footLX ?? mechPoseRef.current.x,
        mechPoseRef.current.footLZ ?? mechPoseRef.current.z,
      ),
    },
    uFootR: {
      value: new THREE.Vector2(
        mechPoseRef.current.footRX ?? mechPoseRef.current.x,
        mechPoseRef.current.footRZ ?? mechPoseRef.current.z,
      ),
    },
    uSunDir: {
      value: new THREE.Vector3(sunPos[0], sunPos[1], sunPos[2]).normalize(),
    },
    uSunBacklightColor: {
      value: BACKLIGHT_COLORS[lightingPreset].clone(),
    },
    uPatchSize: { value: patchSize },
    uPatchRadius: { value: patchRadius },
    uTerrainSpan: { value: new THREE.Vector2(GRASS_SPAN_W, GRASS_SPAN_D) },
    uTerrainTexSize: { value: new THREE.Vector2(TEX_W, TEX_H) },
    uHeightRange: { value: new THREE.Vector2(GRASS_MIN_Y, GRASS_MAX_Y) },
    uTerrainMap: { value: null as THREE.DataTexture | null },
  });

  useEffect(() => {
    uniformsRef.current.uSunDir.value.set(sunPos[0], sunPos[1], sunPos[2]).normalize();
    uniformsRef.current.uSunBacklightColor.value.copy(BACKLIGHT_COLORS[lightingPreset]);
  }, [lightingPreset, sunPos]);

  const terrainMap = useMemo(() => {
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
  }, [data]);

  const bands = useMemo(() => createGrassBands(isSoftwareGl, data, TEX_W, TEX_H), [isSoftwareGl, data]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    mat.customProgramCacheKey = () => 'sector7-sliding-grass-v3';

    mat.onBeforeCompile = (shader) => {
      const u = uniformsRef.current;
      bindFoliageLightingUniforms(shader.uniforms);
      shader.uniforms.uWindowCenter = u.uWindowCenter;
      shader.uniforms.uMechPos = u.uMechPos;
      shader.uniforms.uFootL = u.uFootL;
      shader.uniforms.uFootR = u.uFootR;
      shader.uniforms.uSunDir = u.uSunDir;
      shader.uniforms.uSunBacklightColor = u.uSunBacklightColor;
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
${GLSL_FOLIAGE_WIND_PARS}
attribute vec4 aOffset;
attribute float aBudMask;

uniform vec2 uWindowCenter;
uniform vec3 uMechPos;
uniform vec2 uFootL;
uniform vec2 uFootR;
uniform float uPatchSize;
uniform float uPatchRadius;
uniform vec2 uTerrainSpan;
uniform vec2 uTerrainTexSize;
uniform vec2 uHeightRange;
uniform sampler2D uTerrainMap;

varying vec2 vGrassMeta;
varying float vGrassMacro;
varying vec3 vGrassTerrNormal;
varying float vBudMask;
varying float vEdgeDry;
varying float vLowlandWet;
varying float vDryPatch;
varying vec3 vGrassWorldPos;

float grassHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float grassNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( grassHash( i ), grassHash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( grassHash( i + vec2( 0.0, 1.0 ) ), grassHash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y
  );
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

// Altitude & moisture variation: taller lush tufts in lowlands, shorter sun-clipped grass on high ridges & verges
float lowlandWet = 1.0 - smoothstep( 2.2, 6.2, grassGroundY );
float uplandDry = smoothstep( 7.5, 16.5, grassGroundY );
float edgeDry = 1.0 - smoothstep( 0.16, 0.62, grassSuit );
float altHeightScale = mix( 1.0, 1.24, lowlandWet ) * mix( 1.0, 0.70, uplandDry ) * mix( 1.0, 0.76, edgeDry );

// World-locked Perlin-like patch noise for ~20% sun-scorched golden dry patches
float patchN = grassNoise( grassWorldXZ * 0.055 + vec2( 4.1, -2.7 ) ) * 0.65
             + grassNoise( grassWorldXZ * 0.14 - vec2( 1.8, 3.3 ) ) * 0.35;
float dryPatch = smoothstep( 0.58 - uplandDry * 0.14, 0.80, patchN ) * ( 1.0 - lowlandWet * 0.65 );

float finalScale = aOffset.z * edgeFade * suitFade * patchDensity * altHeightScale;

float hNorm = clamp( uv.y, 0.0, 1.0 );
float tintSeed = grassHash( floor( grassWorldXZ * 1.8 + 0.5 ) );
vGrassMeta = vec2( hNorm, tintSeed );
vGrassMacro = grassMacro;
vBudMask = aBudMask;
vEdgeDry = edgeDry;
vLowlandWet = lowlandWet;
vDryPatch = dryPatch;

if ( finalScale <= 0.008 ) {
  // Collapse masked/out-of-radius tufts into degenerate zero-area triangles below ground
  transformed = vec3( 0.0, -50.0, 0.0 );
  vGrassWorldPos = vec3( grassWorldXZ.x, -50.0, grassWorldXZ.y );
} else {
  vec3 bladeLocal = transformed;
  bladeLocal.y *= finalScale;
  bladeLocal.xz *= mix( 0.86, 1.22, finalScale / max( 0.01, aOffset.z ) );

  vec3 bladeWorld = vec3(
    bladeLocal.x * cy - bladeLocal.z * sy,
    bladeLocal.y,
    bladeLocal.x * sy + bladeLocal.z * cy
  );

  // Coherent world-space traveling wind gust wave (synchronized with pine slopes & vines)
  float bend = hNorm * hNorm;
  bladeWorld += s7TravelingWindOffset( grassWorldXZ, hNorm, 0.34 * finalScale, tintSeed, 0.016 * finalScale );

  // Dual-foot + chassis radial trampling under the 60-ton Soviet Mech
  float dyMech = abs( grassGroundY - uMechPos.y );
  if ( dyMech < 2.6 ) {
    vec2 toBody = grassWorldXZ - uMechPos.xz;
    float dBody = length( toBody );
    vec2 toFootL = grassWorldXZ - uFootL;
    float dFootL = length( toFootL );
    vec2 toFootR = grassWorldXZ - uFootR;
    float dFootR = length( toFootR );

    float pushBody = 1.0 - smoothstep( 0.75, 3.2, dBody );
    float pushFootL = 1.0 - smoothstep( 0.45, 2.1, dFootL );
    float pushFootR = 1.0 - smoothstep( 0.45, 2.1, dFootR );

    float trample = clamp( max( pushBody * 0.72, max( pushFootL, pushFootR ) ), 0.0, 1.0 );
    if ( trample > 0.005 ) {
      vec2 pushVec = vec2( 0.0 );
      if ( pushFootL >= pushFootR && pushFootL >= pushBody * 0.72 && dFootL > 0.001 ) {
        pushVec = toFootL / dFootL;
      } else if ( pushFootR >= pushBody * 0.72 && dFootR > 0.001 ) {
        pushVec = toFootR / dFootR;
      } else if ( dBody > 0.001 ) {
        pushVec = toBody / dBody;
      } else {
        pushVec = vec2( 1.0, 0.0 );
      }
      bladeWorld.y *= mix( 1.0, 0.14, trample * smoothstep( 0.05, 0.75, hNorm ) );
      bladeWorld.xz += pushVec * trample * 0.58 * bend;
    }
  }

  vGrassWorldPos = vec3(
    grassWorldXZ.x + bladeWorld.x,
    grassGroundY - 0.018 + bladeWorld.y,
    grassWorldXZ.y + bladeWorld.z
  );
  transformed = vGrassWorldPos;
}`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uSunDir;
uniform vec3 uSunBacklightColor;

varying vec2 vGrassMeta;
varying float vGrassMacro;
varying vec3 vGrassTerrNormal;
varying float vBudMask;
varying float vEdgeDry;
varying float vLowlandWet;
varying float vDryPatch;
varying vec3 vGrassWorldPos;

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
vec3 colMossDeep = grassSrgb2Lin( vec3( 0.145, 0.235, 0.170 ) );
vec3 colMossRich = grassSrgb2Lin( vec3( 0.220, 0.320, 0.210 ) );
vec3 colGrassOlive = grassSrgb2Lin( vec3( 0.275, 0.340, 0.235 ) );
vec3 colGrassDry = grassSrgb2Lin( vec3( 0.430, 0.385, 0.220 ) );
vec3 colVergeBrown = grassSrgb2Lin( vec3( 0.335, 0.295, 0.205 ) );

vec3 rootBase = mix( colMossDeep, colMossRich, smoothstep( 0.18, 0.82, gMacro * 0.7 + gSeed * 0.3 ) );
vec3 rootMeadow = mix( colGrassOlive, colGrassDry, vDryPatch );
vec3 rootCol = mix( rootBase, rootMeadow, smoothstep( 0.26, 0.72, gMacro + vDryPatch * 0.35 ) );
rootCol = mix( rootCol, colMossDeep * 1.05, vLowlandWet * 0.45 );
rootCol = mix( rootCol, colVergeBrown, vEdgeDry * 0.58 );

vec3 tipFresh = grassSrgb2Lin( vec3( 0.310, 0.425, 0.230 ) );
vec3 tipEmerald = grassSrgb2Lin( vec3( 0.250, 0.395, 0.225 ) );
vec3 tipGolden = grassSrgb2Lin( vec3( 0.545, 0.465, 0.225 ) );
vec3 tipWarm = mix( tipFresh, tipEmerald, vLowlandWet * 0.55 );
tipWarm = mix( tipWarm, tipGolden, clamp( vDryPatch * 0.92 + vEdgeDry * 0.35, 0.0, 1.0 ) );

vec3 bladeAlbedo = mix( rootCol * 0.68, tipWarm, smoothstep( 0.05, 0.90, gh ) ) * ( 0.88 + gSeed * 0.22 );
// Multiply by built-in Vertex Color (darker sheltered root -> luminous tip)
vec3 vColTint = diffuseColor.rgb;
diffuseColor.rgb = bladeAlbedo * mix( vec3( 1.0 ), vColTint, 0.58 );

// Tall stalk flower/seed tips (~12% wildflowers across meadow & edges, rest sunlit wheat awns)
if ( vBudMask > 0.45 ) {
  float flowerMask = smoothstep( 0.45, 0.88, vBudMask );
  float flowerRoll = fract( gSeed * 7.31 + gMacro * 3.17 );
  vec3 budCol = tipGolden * 1.18;
  if ( flowerRoll > 0.87 ) {
    // Crimson poppy / wild rose accent
    budCol = grassSrgb2Lin( vec3( 0.74, 0.17, 0.15 ) );
  } else if ( flowerRoll > 0.78 ) {
    // Goldenrod / buttercup yellow
    budCol = grassSrgb2Lin( vec3( 0.86, 0.68, 0.14 ) );
  } else if ( flowerRoll > 0.71 ) {
    // Chamomile cream-white
    budCol = grassSrgb2Lin( vec3( 0.88, 0.85, 0.74 ) );
  } else if ( flowerRoll > 0.66 ) {
    // Wild violet / lavender accent
    budCol = grassSrgb2Lin( vec3( 0.52, 0.32, 0.68 ) );
  }
  diffuseColor.rgb = mix( diffuseColor.rgb, budCol, flowerMask );
}`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
normal = normalize( mix( normal, normalize( vGrassTerrNormal ), 0.86 ) );
nonPerturbedNormal = normal;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
// Fake Subsurface Scattering: backlit translucent golden-green glow toward the sun
vec3 viewLookDir = normalize( vGrassWorldPos - cameraPosition );
vec3 sunDirN = normalize( uSunDir );
float backAlign = pow( max( dot( viewLookDir, sunDirN ), 0.0 ), 2.6 );
float tipTranslucency = smoothstep( 0.22, 0.96, vGrassMeta.x );
totalEmissiveRadiance += uSunBacklightColor * backAlign * tipTranslucency * ( 0.42 + 0.38 * vGrassMacro );`,
        );
    };

    return mat;
  }, []);

  useEffect(() => () => bands.dispose(), [bands]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => terrainMap.dispose(), [terrainMap]);

  useEffect(() => {
    if (!preparing || !firstBand.current) return;
    // All three distance bands share the same material and shader variant.
    void gl.compileAsync(firstBand.current, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('Grass shader warmup failed', error);
    });
  }, [preparing, gl, camera, scene, bands, material]);

  const { paused } = useSceneSimulation();

  useFrame(({ camera }) => {
    if (paused) return;
    if (!visible) return;
    const m = mechPoseRef.current;
    const u = uniformsRef.current;
    // Offset sliding window slightly ahead of Mech facing so forward vista has maximal grass coverage
    const forwardBias = 8.0;
    u.uWindowCenter.value.set(
      m.x + Math.sin(m.yaw) * forwardBias,
      m.z + Math.cos(m.yaw) * forwardBias,
    );
    u.uPatchSize.value = patchSize;
    u.uPatchRadius.value = patchRadius;
    bands.update(u.uWindowCenter.value.x, u.uWindowCenter.value.y, readWorldLod(camera).detailScale);
    u.uMechPos.value.set(m.x, m.y, m.z);
    u.uFootL.value.set(m.footLX ?? m.x, m.footLZ ?? m.z);
    u.uFootR.value.set(m.footRX ?? m.x, m.footRZ ?? m.z);
  });

  return (
    <group visible={visible}>
      {bands.geometries.map((geometry, level) => (
        <mesh key={level} ref={level === 0 ? firstBand : undefined} geometry={geometry} material={material}
          userData={{ lodLevel: level }} receiveShadow={!isSoftwareGl} frustumCulled={false} />
      ))}
    </group>
  );
}

/**
 * GPU Sliding-Window grass meadow active in Drive Mode.
 * Lazily bakes the 512x448 height/suitability map on first Drive Mode entry so Overview load stays instant.
 */
export function GrassField({
  data,
  driveMode,
  preparing,
  mechPoseRef,
  lightingPreset,
  sunPos,
  isSoftwareGl,
}: GrassFieldProps) {
  const [hasActivated, setHasActivated] = useState(driveMode);

  useEffect(() => {
    if (driveMode && !hasActivated) {
      setHasActivated(true);
    }
  }, [driveMode, hasActivated]);

  if (!hasActivated) return null;

  return (
    <GrassFieldMesh
      data={data}
      visible={driveMode && !preparing}
      preparing={preparing}
      mechPoseRef={mechPoseRef}
      lightingPreset={lightingPreset}
      sunPos={sunPos}
      isSoftwareGl={isSoftwareGl}
    />
  );
}
