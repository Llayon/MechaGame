import * as THREE from 'three';
import type { GraphicsPreset } from '../game/graphicsSettings';
import type { LightingPreset } from '../map/sectors';
import {
  CAUSTICS_CONFIG,
  CAUSTICS_PRESETS,
  resolveCausticsStrengths,
} from './waterCausticsMath';

let aoShaderPatched = false;

/**
 * Shared live Float32Array(4) uniform buffers referenced by terrain and concrete shaders.
 * Updating in place drives every receiving material with zero scene traversal, zero
 * shader recompilation, and zero per-frame allocations.
 *
 * - `causticsSunTimeBuffer`: [sunDir.x, sunDir.y, sunDir.z, wavePhaseSec]
 * - `causticsColorStrengthBuffer`: [linearR, linearG, linearB, underwaterStrength]
 * - `causticsBounceMetaBuffer`: [wallBounceStrength, waterLevel, fadeDistStart, fadeDistEnd]
 */
const causticsSunTimeBuffer = new Float32Array([0.386, 0.372, -0.844, 1.8]);
const causticsColorStrengthBuffer = new Float32Array([1.0, 0.48, 0.17, 0.74]);
const causticsBounceMetaBuffer = new Float32Array([
  0.38,
  CAUSTICS_CONFIG.waterLevel,
  CAUSTICS_CONFIG.fadeDistStart,
  CAUSTICS_CONFIG.fadeDistEnd,
]);

export const WATER_CAUSTICS_UNIFORMS = {
  uCausticsSunTime: { value: causticsSunTimeBuffer },
  uCausticsColorStrength: { value: causticsColorStrengthBuffer },
  uCausticsBounceMeta: { value: causticsBounceMetaBuffer },
};

export function bindWaterCausticsUniforms(
  uniforms: Record<string, THREE.IUniform>,
): void {
  uniforms.uCausticsSunTime = WATER_CAUSTICS_UNIFORMS.uCausticsSunTime;
  uniforms.uCausticsColorStrength =
    WATER_CAUSTICS_UNIFORMS.uCausticsColorStrength;
  uniforms.uCausticsBounceMeta = WATER_CAUSTICS_UNIFORMS.uCausticsBounceMeta;
}

export function syncWaterCausticsParams(
  lightingPreset: LightingPreset,
  graphicsPreset: GraphicsPreset,
  sunPos?: readonly [number, number, number],
): void {
  const cfg = CAUSTICS_PRESETS[lightingPreset];
  const pos = sunPos ?? cfg.defaultSunPos;
  const len = Math.hypot(pos[0], pos[1], pos[2]);
  if (len > 1e-5) {
    causticsSunTimeBuffer[0] = pos[0] / len;
    causticsSunTimeBuffer[1] = pos[1] / len;
    causticsSunTimeBuffer[2] = pos[2] / len;
  } else {
    causticsSunTimeBuffer[0] = 0;
    causticsSunTimeBuffer[1] = 1;
    causticsSunTimeBuffer[2] = 0;
  }

  const { underwaterStrength, wallBounceStrength } = resolveCausticsStrengths(
    lightingPreset,
    graphicsPreset,
  );
  causticsColorStrengthBuffer[0] = cfg.linearRgb[0];
  causticsColorStrengthBuffer[1] = cfg.linearRgb[1];
  causticsColorStrengthBuffer[2] = cfg.linearRgb[2];
  causticsColorStrengthBuffer[3] = underwaterStrength;
  causticsBounceMetaBuffer[0] = wallBounceStrength;
}

export function advanceWaterCausticsTime(deltaSec: number): void {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return;
  causticsSunTimeBuffer[3] =
    (causticsSunTimeBuffer[3] + Math.min(deltaSec, 0.05)) % 1000.0;
}

// Initialize default dusk buffers immediately at module load
syncWaterCausticsParams('dusk', 'balanced');

/**
 * Shared GLSL helpers for zero-texture procedural shallow-water refracted caustics
 * (with Beer-Lambert depth absorption) and water-bounced sunlight shimmer on bridge
 * piers, abutments, and coastal rocks. All smoothstep edges are strictly ascending.
 */
export const GLSL_WATER_CAUSTICS_PARS = /* glsl */ `
uniform vec4 uCausticsSunTime;
uniform vec4 uCausticsColorStrength;
uniform vec4 uCausticsBounceMeta;

float s7CausticGrid( vec2 p, float t ) {
  vec2 q = p + vec2( sin( p.y * 1.15 + t * 0.9 ), cos( p.x * 1.15 - t * 0.85 ) ) * 0.45;
  float a = sin( q.x * 2.1 + t * 1.25 ) * cos( q.y * 2.1 - t * 1.05 );
  vec2 r = vec2( q.x * 0.6 - q.y * 0.8, q.x * 0.8 + q.y * 0.6 );
  float b = sin( r.x * 2.7 - t * 1.1 ) * cos( r.y * 2.7 + t * 1.35 );
  float ridge = clamp( ( 1.0 - abs( a ) ) * 0.56 + ( 1.0 - abs( b ) ) * 0.52, 0.0, 1.0 );
  float r2 = ridge * ridge;
  return r2 * r2;
}

vec3 s7ComputeUnderwaterCaustics(
  vec3 worldPos,
  vec3 worldNormal,
  float riverMask,
  float camDist,
  float pixelSize
) {
  float strength = uCausticsColorStrength.w;
  if ( strength <= 0.001 || riverMask <= 0.01 ) return vec3( 0.0 );

  float dep = uCausticsBounceMeta.y - worldPos.y;
  if ( dep <= -0.08 || dep > ${CAUSTICS_CONFIG.maxUnderwaterDepth.toFixed(2)} ) return vec3( 0.0 );

  float distFade = 1.0 - smoothstep( uCausticsBounceMeta.z, uCausticsBounceMeta.w, camDist );
  if ( distFade <= 0.001 ) return vec3( 0.0 );

  float nyquist = 1.0 - smoothstep( ${CAUSTICS_CONFIG.nyquistPixelMin.toFixed(2)}, ${CAUSTICS_CONFIG.nyquistPixelMax.toFixed(2)}, pixelSize );
  if ( nyquist <= 0.001 ) return vec3( 0.0 );

  float posDep = max( dep, 0.0 );
  float t = uCausticsSunTime.w;
  vec2 refractedXZ = worldPos.xz + uCausticsSunTime.xz * posDep * 0.95;
  float c1 = s7CausticGrid( refractedXZ * 0.58, t );
  float c2 = s7CausticGrid( refractedXZ * 1.08 + vec2( 3.7, -2.1 ), -t * 0.85 );
  float causticVal = clamp( c1 * 0.65 + c2 * 0.45, 0.0, 1.35 );

  vec3 transmittance = exp( -posDep * vec3( ${CAUSTICS_CONFIG.absorptionRgb[0].toFixed(3)}, ${CAUSTICS_CONFIG.absorptionRgb[1].toFixed(3)}, ${CAUSTICS_CONFIG.absorptionRgb[2].toFixed(3)} ) );
  float subMask = smoothstep( -0.06, 0.08, dep ) * ( 1.0 - smoothstep( 1.65, ${CAUSTICS_CONFIG.maxUnderwaterDepth.toFixed(2)}, dep ) );
  float upWeight = clamp( worldNormal.y + 0.35, 0.0, 1.0 );

  return uCausticsColorStrength.rgb * transmittance * ( 0.16 + 1.45 * causticVal ) * strength * subMask * riverMask * distFade * nyquist * upWeight;
}

vec3 s7ComputeWallBounceCaustics(
  vec3 worldPos,
  vec3 worldNormal,
  float riverMask,
  float camDist,
  float pixelSize
) {
  float bounceStrength = uCausticsBounceMeta.x;
  if ( bounceStrength <= 0.001 || riverMask <= 0.01 ) return vec3( 0.0 );

  float above = worldPos.y - uCausticsBounceMeta.y;
  if ( above <= -0.15 || above > ${(CAUSTICS_CONFIG.maxWallBounceHeight + 0.1).toFixed(2)} ) return vec3( 0.0 );

  float wallFactor = 1.0 - smoothstep( 0.55, 0.92, abs( worldNormal.y ) );
  if ( wallFactor <= 0.001 ) return vec3( 0.0 );

  float distFade = 1.0 - smoothstep( uCausticsBounceMeta.z, uCausticsBounceMeta.w, camDist );
  if ( distFade <= 0.001 ) return vec3( 0.0 );

  float nyquist = 1.0 - smoothstep( ${CAUSTICS_CONFIG.nyquistPixelMin.toFixed(2)}, ${CAUSTICS_CONFIG.nyquistPixelMax.toFixed(2)}, pixelSize );
  if ( nyquist <= 0.001 ) return vec3( 0.0 );

  float hEnv = smoothstep( -0.12, 0.08, above ) * ( 1.0 - smoothstep( 0.32, ${CAUSTICS_CONFIG.maxWallBounceHeight.toFixed(2)}, above ) );
  vec2 hN = worldNormal.xz;
  float hNLen = length( hN );
  vec2 hS = uCausticsSunTime.xz;
  float hSLen = length( hS );
  float sunAlign = ( hNLen > 0.001 && hSLen > 0.001 )
    ? clamp( dot( hN / hNLen, hS / hSLen ) * 0.5 + 0.5, 0.0, 1.0 )
    : 0.65;
  float bounceDir = 0.42 + 0.58 * sunAlign;

  float t = uCausticsSunTime.w;
  vec2 wallUv = vec2( ( worldPos.x + worldPos.z ) * 0.65, above * 1.45 - t * 0.42 );
  float pattern = s7CausticGrid( wallUv, t * 0.9 );

  return uCausticsColorStrength.rgb
    * vec3( ${CAUSTICS_CONFIG.wallBounceTint[0].toFixed(2)}, ${CAUSTICS_CONFIG.wallBounceTint[1].toFixed(2)}, ${CAUSTICS_CONFIG.wallBounceTint[2].toFixed(2)} )
    * ( 0.08 + 0.95 * pattern )
    * bounceStrength
    * hEnv
    * wallFactor
    * bounceDir
    * riverMask
    * distFade
    * nyquist;
}
`;

/**
 * Globally upgrades Three.js standard/physical PBR shaders (`#define STANDARD`) with:
 * 1) Jimenez GTAO chromatic Multi-Bounce AO so crevices and shadowed undersides retain
 *    natural material hue instead of turning flat gray.
 * 2) Lagarde/Frostbite horizon Specular Occlusion so shadowed joints, bridge undersides,
 *    and damp rock crevices suppress unrealistic grazing sky reflections.
 *
 * Materials that define `S7_CUSTOM_AO` and set `float s7CustomAO` prior to
 * `#include <aomap_fragment>` (such as terrain and weathered concrete) feed their
 * procedural crevice masks directly into the same unified PBR path.
 */
export function installPbrMultiBounceAoShader(): void {
  if (aoShaderPatched) return;
  aoShaderPatched = true;

  THREE.ShaderChunk.aomap_pars_fragment = /* glsl */ `
#ifdef USE_AOMAP

  uniform sampler2D aoMap;
  uniform float aoMapIntensity;

#endif

#if defined( STANDARD )

  vec3 s7MultiBounceAO( const in float ao, const in vec3 albedo ) {
    vec3 a = 2.0404 * albedo - 0.3324;
    vec3 b = -4.7951 * albedo + 0.6417;
    vec3 c = 2.7552 * albedo + 0.6903;
    return max( vec3( ao ), ( ( ao * a + b ) * ao + c ) * ao );
  }

#endif
`;

  THREE.ShaderChunk.aomap_fragment = /* glsl */ `
#if defined( STANDARD )

  float ambientOcclusion = 1.0;

  #ifdef USE_AOMAP

    ambientOcclusion *= ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;

  #endif

  #ifdef S7_CUSTOM_AO

    ambientOcclusion *= clamp( s7CustomAO, 0.22, 1.0 );

  #endif

  float s7WorldNY = dot( viewMatrix[ 1 ].xyz, geometryNormal );
  float s7CavityAO = mix( 0.72, 1.0, smoothstep( -0.75, 0.25, s7WorldNY ) );
  ambientOcclusion = clamp( ambientOcclusion * s7CavityAO, 0.16, 1.0 );

  if ( ambientOcclusion < 0.999 ) {

    vec3 s7BounceAO = s7MultiBounceAO( ambientOcclusion, diffuseColor.rgb );
    reflectedLight.indirectDiffuse *= s7BounceAO;

    float s7DotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    float s7SpecOcc = computeSpecularOcclusion( s7DotNV, ambientOcclusion, material.roughness );
    reflectedLight.indirectSpecular *= s7SpecOcc;

    #if defined( USE_CLEARCOAT )
      clearcoatSpecularIndirect *= computeSpecularOcclusion( s7DotNV, ambientOcclusion, material.clearcoatRoughness );
    #endif

    #if defined( USE_SHEEN )
      sheenSpecularIndirect *= ambientOcclusion;
    #endif

  }

#elif defined( USE_AOMAP )

  float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;

#endif
`;
}
