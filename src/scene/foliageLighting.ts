import * as THREE from 'three';
import type { LightingPreset } from '../map/sectors';
import {
  FOLIAGE_TRANSMITTANCE_PRESETS,
  FOLIAGE_TRANSMITTANCE_TINT,
  WIND_WAVE_CONFIG,
} from './foliageLightingMath';

let ditheringPatched = false;

/**
 * Shared Float32Array(4) uniform buffers synchronizing wind wave phase, sun direction,
 * and subsurface foliage transmittance across pine forests, Titan breach pines, shrubs,
 * fern accents, hanging vines, and sliding grass with zero per-frame allocations.
 *
 * - `foliageSunTimeBuffer`: [sunDir.x, sunDir.y, sunDir.z, windTimeSec]
 * - `foliageTransTintBuffer`: [sunLinearR, sunLinearG, sunLinearB, strength]
 */
const foliageSunTimeBuffer = new Float32Array([0.386, 0.372, -0.844, 1.1]);
const foliageTransTintBuffer = new Float32Array([1.0, 0.44, 0.14, 0.92]);

export const FOLIAGE_LIGHTING_UNIFORMS = {
  uFoliageSunTime: { value: foliageSunTimeBuffer },
  uFoliageTransTint: { value: foliageTransTintBuffer },
};

export function bindFoliageLightingUniforms(
  uniforms: Record<string, THREE.IUniform>,
): void {
  uniforms.uFoliageSunTime = FOLIAGE_LIGHTING_UNIFORMS.uFoliageSunTime;
  uniforms.uFoliageTransTint = FOLIAGE_LIGHTING_UNIFORMS.uFoliageTransTint;
}

export function syncFoliageLightingParams(
  lightingPreset: LightingPreset,
  sunPos?: readonly [number, number, number],
): void {
  const cfg = FOLIAGE_TRANSMITTANCE_PRESETS[lightingPreset];
  const pos = sunPos ?? cfg.defaultSunPos;
  const len = Math.hypot(pos[0], pos[1], pos[2]);
  if (len > 1e-5) {
    foliageSunTimeBuffer[0] = pos[0] / len;
    foliageSunTimeBuffer[1] = pos[1] / len;
    foliageSunTimeBuffer[2] = pos[2] / len;
  } else {
    foliageSunTimeBuffer[0] = 0;
    foliageSunTimeBuffer[1] = 1;
    foliageSunTimeBuffer[2] = 0;
  }
  foliageTransTintBuffer[0] = cfg.sunLinearRgb[0];
  foliageTransTintBuffer[1] = cfg.sunLinearRgb[1];
  foliageTransTintBuffer[2] = cfg.sunLinearRgb[2];
  foliageTransTintBuffer[3] = cfg.strength;
}

export function advanceFoliageWindTime(deltaSec: number): void {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return;
  foliageSunTimeBuffer[3] =
    (foliageSunTimeBuffer[3] + Math.min(deltaSec, 0.05)) % 4000.0;
}

// Initialize default dusk buffers immediately at module load
syncFoliageLightingParams('dusk');

/**
 * Shared vertex-shader traveling wind wave helper (coherent west-southwest gusts
 * sweeping across world XZ + quadratic height profile + branch/leaf flutter).
 */
export const GLSL_FOLIAGE_WIND_PARS = /* glsl */ `
uniform vec4 uFoliageSunTime;

vec3 s7TravelingWindOffset(
  vec2 worldXZ,
  float heightNorm,
  float amplitude,
  float flutterPhase,
  float flutterAmp
) {
  float h = clamp( heightNorm, 0.0, 1.0 );
  float t = uFoliageSunTime.w;
  float g = dot( worldXZ, vec2( ${WIND_WAVE_CONFIG.waveDirX.toFixed(3)}, ${WIND_WAVE_CONFIG.waveDirZ.toFixed(3)} ) ) - t * ${WIND_WAVE_CONFIG.waveSpeed.toFixed(2)};
  float b = h * h * ( 0.16 + 0.13 * sin( g ) + 0.06 * sin( g * 2.3 + 1.7 ) ) * amplitude;
  vec3 offset = vec3(
    b * ${WIND_WAVE_CONFIG.pushDirX.toFixed(2)},
    -b * b * 0.04,
    b * ${WIND_WAVE_CONFIG.pushDirZ.toFixed(2)}
  );
  if ( flutterAmp > 0.0001 ) {
    float f = sin( t * 2.6 + flutterPhase * 43.0 + worldXZ.x * 0.9 + worldXZ.y * 0.7 )
      * flutterAmp * clamp( h * 1.6, 0.0, 1.0 );
    offset += vec3( f, f * 0.6, -f * 0.7 );
  }
  return offset;
}

vec3 s7WorldToLocalOffset( mat3 worldMat, vec3 worldOffset ) {
  vec3 c0 = worldMat[0];
  vec3 c1 = worldMat[1];
  vec3 c2 = worldMat[2];
  return vec3(
    dot( c0, worldOffset ) / max( dot( c0, c0 ), 0.0001 ),
    dot( c1, worldOffset ) / max( dot( c1, c1 ), 0.0001 ),
    dot( c2, worldOffset ) / max( dot( c2, c2 ), 0.0001 )
  );
}
`;

/**
 * Shared fragment-shader subsurface foliage transmittance helper.
 * Adds warm amber-green backlit glow when looking through needles, leaves, or vines
 * toward the active sun/moon azimuth while keeping shadowed bark grounded.
 */
export const GLSL_FOLIAGE_TRANSMITTANCE_PARS = /* glsl */ `
uniform vec4 uFoliageSunTime;
uniform vec4 uFoliageTransTint;

vec3 s7ComputeFoliageTransmittance(
  vec3 worldPos,
  vec3 worldNormal,
  vec3 albedo,
  float translucency
) {
  float trans = clamp( translucency, 0.0, 1.0 );
  float strength = uFoliageTransTint.w;
  if ( trans <= 0.001 || strength <= 0.001 ) return vec3( 0.0 );

  vec3 viewRay = worldPos - cameraPosition;
  float viewLen = max( length( viewRay ), 0.0001 );
  vec3 rd = viewRay / viewLen;
  vec3 L = uFoliageSunTime.xyz;
  vec3 N = normalize( worldNormal );

  float viewSun = clamp( dot( rd, L ), 0.0, 1.0 );
  float backPhase = 0.25 + 0.75 * pow( viewSun, 3.0 );
  float ndl = dot( N, L );
  float backFace = clamp( -ndl, 0.0, 1.0 ) * 0.7 + 0.3;
  float wrapFace = clamp( ndl * 0.5 + 0.5, 0.0, 1.0 );

  vec3 leafTint = vec3( ${FOLIAGE_TRANSMITTANCE_TINT[0].toFixed(2)}, ${FOLIAGE_TRANSMITTANCE_TINT[1].toFixed(2)}, ${FOLIAGE_TRANSMITTANCE_TINT[2].toFixed(2)} );
  vec3 backLight = albedo * leafTint * uFoliageTransTint.rgb * ( backPhase * backFace * 0.42 * trans * strength );
  vec3 wrapLight = albedo * uFoliageTransTint.rgb * ( wrapFace * 0.14 * trans * strength );
  return backLight + wrapLight;
}
`;

/**
 * Standalone GLSL snippet for triangular Interleaved Gradient Noise (IGN) micro-dithering
 * (amplitude +/- 1/255), suitable for custom ShaderMaterials such as ProceduralSky.
 */
export const GLSL_IGN_DITHER_SNIPPET = /* glsl */ `
float s7SkyIgnA = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
float s7SkyIgnB = fract( 52.9829189 * fract( dot( gl_FragCoord.xy + vec2( 37.0, 17.0 ), vec2( 0.06711056, 0.00583715 ) ) ) );
gl_FragColor.rgb += vec3( ( s7SkyIgnA + s7SkyIgnB - 1.0 ) / 255.0 );
`;

/**
 * Globally upgrades Three.js color-output fragment shaders (`dithering_fragment`) with
 * Jimenez triangular Interleaved Gradient Noise (+/- 1/255) after tone mapping, sRGB
 * encoding, and height fog — eliminating 8-bit gradient banding in canyon haze and dusk/night shadows.
 * Only color shaders include `dithering_fragment` (depth/shadow shaders remain untouched).
 */
export function installGlobalDitheringShader(): void {
  if (ditheringPatched) return;
  ditheringPatched = true;

  THREE.ShaderChunk.dithering_pars_fragment = /* glsl */ `
float s7IgnNoise( const in vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}

vec3 dithering( vec3 color ) {
  float n = s7IgnNoise( gl_FragCoord.xy ) + s7IgnNoise( gl_FragCoord.xy + vec2( 37.0, 17.0 ) ) - 1.0;
  return color + vec3( n / 255.0 );
}
`;

  THREE.ShaderChunk.dithering_fragment = /* glsl */ `
gl_FragColor.rgb = dithering( gl_FragColor.rgb );
`;
}
