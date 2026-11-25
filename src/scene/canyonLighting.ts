import * as THREE from 'three';
import type { LightingPreset } from '../map/sectors';
import { getExtendedTerrainHeight } from '../map/terrainMath';
import {
  CANYON_HEIGHT_MIN,
  CANYON_HEIGHT_RANGE,
  CANYON_MAP_SIZE,
  CANYON_PRESETS,
  CANYON_WORLD_SPAN,
  HYBRID_CASCADE_CONFIG,
  bakeDirectionalTerrainShadowGrid,
  buildCanyonHeightGrid,
  encodeTerrainHeightByte,
} from './canyonLightingMath';

let hybridShadowChunkPatched = false;
let cachedHeightGrid: Float32Array | null = null;
let cachedTexture: THREE.DataTexture | null = null;
let cachedRgba: Uint8Array | null = null;
let activeBakedKey: string | null = null;
const shadowGridCache = new Map<string, Uint8Array>();

/**
 * Shared live Float32Array(4) uniform buffers synchronizing Canyon skyVis and Hybrid Shadows
 * across terrain, roads, concrete structures, and canyon rocks with zero per-frame allocations
 * and zero shader recompilations when changing time-of-day, camera focus, or graphics preset.
 *
 * - `canyonBoundsBuffer`: [invWorldSpanX, invWorldSpanZ, heightMin, heightRange]
 * - `canyonShadowParamsBuffer`: [skyVisStrength, skyVisMin, farShadowStrength, liveShadowsEnabled]
 * - `hybridCascadeBuffer`: [focusX, focusZ, cascadeHalfExtent, 1 / max(halfExtent, 1)]
 */
const canyonBoundsBuffer = new Float32Array([
  1 / CANYON_WORLD_SPAN,
  1 / CANYON_WORLD_SPAN,
  CANYON_HEIGHT_MIN,
  CANYON_HEIGHT_RANGE,
]);

const canyonShadowParamsBuffer = new Float32Array([
  CANYON_PRESETS.dusk.skyVisStrength,
  CANYON_PRESETS.dusk.skyVisMin,
  CANYON_PRESETS.dusk.farShadowStrength,
  1.0,
]);

const hybridCascadeBuffer = new Float32Array([0, 0, 75, 1 / 75]);

function ensureCanyonResources(): {
  heightGrid: Float32Array;
  rgba: Uint8Array;
  texture: THREE.DataTexture;
} {
  if (cachedHeightGrid && cachedRgba && cachedTexture) {
    return {
      heightGrid: cachedHeightGrid,
      rgba: cachedRgba,
      texture: cachedTexture,
    };
  }

  const size = CANYON_MAP_SIZE;
  const heightGrid = buildCanyonHeightGrid(
    getExtendedTerrainHeight,
    size,
    CANYON_WORLD_SPAN,
  );
  const rgba = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    rgba[o] = encodeTerrainHeightByte(heightGrid[i]);
    rgba[o + 1] = 255; // far mountain shadow channel (populated by syncCanyonLightingPreset)
    rgba[o + 2] = 255;
    rgba[o + 3] = 255;
  }

  const texture = new THREE.DataTexture(
    rgba,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = false;
  texture.needsUpdate = true;

  cachedHeightGrid = heightGrid;
  cachedRgba = rgba;
  cachedTexture = texture;

  return { heightGrid, rgba, texture };
}

export const CANYON_LIGHTING_UNIFORMS = {
  uCanyonLightMap: { value: null as THREE.DataTexture | null },
  uCanyonBounds: { value: canyonBoundsBuffer },
  uCanyonShadowParams: { value: canyonShadowParamsBuffer },
  uHybridCascade: { value: hybridCascadeBuffer },
};

export function getCanyonLightMapTexture(): THREE.DataTexture {
  const { texture } = ensureCanyonResources();
  CANYON_LIGHTING_UNIFORMS.uCanyonLightMap.value = texture;
  return texture;
}

export function bindCanyonLightingUniforms(
  uniforms: Record<string, THREE.IUniform>,
): void {
  getCanyonLightMapTexture();
  uniforms.uCanyonLightMap = CANYON_LIGHTING_UNIFORMS.uCanyonLightMap;
  uniforms.uCanyonBounds = CANYON_LIGHTING_UNIFORMS.uCanyonBounds;
  uniforms.uCanyonShadowParams = CANYON_LIGHTING_UNIFORMS.uCanyonShadowParams;
  uniforms.uHybridCascade = CANYON_LIGHTING_UNIFORMS.uHybridCascade;
}

/**
 * Updates canyon skyVis strengths and bakes/activates the cached directional far-mountain
 * shadow channel for the given lighting preset and sun vector (~3 ms first time per preset,
 * 0 ms on subsequent toggles).
 */
export function syncCanyonLightingPreset(
  lightingPreset: LightingPreset,
  sunPos: readonly [number, number, number],
  liveShadowsEnabled: boolean,
): void {
  const cfg = CANYON_PRESETS[lightingPreset];
  canyonShadowParamsBuffer[0] = cfg.skyVisStrength;
  canyonShadowParamsBuffer[1] = cfg.skyVisMin;
  canyonShadowParamsBuffer[2] = cfg.farShadowStrength;
  canyonShadowParamsBuffer[3] = liveShadowsEnabled ? 1.0 : 0.0;

  const { heightGrid, rgba, texture } = ensureCanyonResources();
  CANYON_LIGHTING_UNIFORMS.uCanyonLightMap.value = texture;

  const cacheKey = `${lightingPreset}:${sunPos[0].toFixed(1)},${sunPos[1].toFixed(1)},${sunPos[2].toFixed(1)}`;
  if (activeBakedKey === cacheKey) return;

  let shadowGrid = shadowGridCache.get(cacheKey);
  if (!shadowGrid) {
    shadowGrid = bakeDirectionalTerrainShadowGrid(heightGrid, sunPos, {
      size: CANYON_MAP_SIZE,
      worldSpan: CANYON_WORLD_SPAN,
      softPenumbraSlope: cfg.softPenumbraSlope,
    });
    shadowGridCache.set(cacheKey, shadowGrid);
  }

  for (let i = 0; i < shadowGrid.length; i++) {
    rgba[i * 4 + 1] = shadowGrid[i];
  }
  texture.needsUpdate = true;
  activeBakedKey = cacheKey;
}

/**
 * Updates live near-shadow cascade focus and radius in place with zero allocations.
 */
export function syncHybridShadowCascade(
  focusX: number,
  focusZ: number,
  halfExtent: number,
  liveShadowsEnabled: boolean,
): void {
  const safeHalf = Math.max(halfExtent, 1.0);
  hybridCascadeBuffer[0] = focusX;
  hybridCascadeBuffer[1] = focusZ;
  hybridCascadeBuffer[2] = safeHalf;
  hybridCascadeBuffer[3] = 1.0 / safeHalf;
  canyonShadowParamsBuffer[3] = liveShadowsEnabled ? 1.0 : 0.0;
}

/**
 * Shared GLSL helpers injected ONLY into opting materials (terrain, roads, concrete, rocks).
 * Defines `S7_HYBRID_TERRAIN_SHADOW` so the `lights_fragment_begin` directional sun hook
 * activates exclusively on those 4 material families without altering any other scene shaders.
 * All literal smoothstep edges are strictly ascending.
 */
export const GLSL_CANYON_LIGHTING_PARS = /* glsl */ `
#define S7_HYBRID_TERRAIN_SHADOW
uniform sampler2D uCanyonLightMap;
uniform vec4 uCanyonBounds;
uniform vec4 uCanyonShadowParams;
uniform vec4 uHybridCascade;

float s7SampleCanyonSkyVis( vec3 worldPos ) {
  vec2 uv = worldPos.xz * uCanyonBounds.xy + 0.5;
  float edgeMax = max( abs( uv.x - 0.5 ), abs( uv.y - 0.5 ) );
  float atlasFade = 1.0 - smoothstep( 0.44, 0.50, edgeMax );
  if ( atlasFade <= 0.001 ) return 1.0;

  vec2 suv = clamp( uv, vec2( 0.004 ), vec2( 0.996 ) );
  float hMid = uCanyonBounds.z + textureLod( uCanyonLightMap, suv, 2.0 ).r * uCanyonBounds.w;
  float hBroad = uCanyonBounds.z + textureLod( uCanyonLightMap, suv, 4.0 ).r * uCanyonBounds.w;
  float hMacro = uCanyonBounds.z + textureLod( uCanyonLightMap, suv, 6.0 ).r * uCanyonBounds.w;

  float d0 = max( 0.0, hMid - worldPos.y ) / 14.0;
  float d1 = max( 0.0, hBroad - worldPos.y ) / 30.0;
  float d2 = max( 0.0, hMacro - worldPos.y ) / 56.0;
  float occ = clamp( d0 * 0.42 + d1 * 0.36 + d2 * 0.22, 0.0, 1.0 );
  float rawSkyVis = clamp( 1.0 - occ * uCanyonShadowParams.x, uCanyonShadowParams.y, 1.0 );
  return mix( 1.0, rawSkyVis, atlasFade );
}

float s7SampleBakedFarShadow( vec3 worldPos ) {
  vec2 uv = worldPos.xz * uCanyonBounds.xy + 0.5;
  float edgeMax = max( abs( uv.x - 0.5 ), abs( uv.y - 0.5 ) );
  float atlasFade = 1.0 - smoothstep( 0.45, 0.50, edgeMax );
  if ( atlasFade <= 0.001 ) return 1.0;

  vec2 suv = clamp( uv, vec2( 0.004 ), vec2( 0.996 ) );
  float rawVis = textureLod( uCanyonLightMap, suv, 0.0 ).g;
  float shaded = mix( 1.0, rawVis, uCanyonShadowParams.z );
  return mix( 1.0, shaded, atlasFade );
}

float s7ComputeCascadeFade( vec3 worldPos ) {
  if ( uCanyonShadowParams.w < 0.5 ) return 1.0;
  float radialNorm = length( worldPos.xz - uHybridCascade.xy ) * uHybridCascade.w;
  return smoothstep( ${HYBRID_CASCADE_CONFIG.cascadeFadeStart.toFixed(2)}, ${HYBRID_CASCADE_CONFIG.cascadeFadeEnd.toFixed(2)}, radialNorm );
}

float s7CombineHybridShadow( float liveShadow, float farShadow, float cascadeFade ) {
  float effectiveLive = mix( liveShadow, 1.0, cascadeFade );
  return min( effectiveLive, farShadow );
}
`;

/**
 * Patches `THREE.ShaderChunk.lights_fragment_begin` once (guarded by `#ifdef S7_HYBRID_TERRAIN_SHADOW`)
 * so the key sun (`directionalLights[0]`) seamlessly merges the tightened live shadow cascade with
 * the baked far mountain shadow map with zero double-darkening, and stays active on Low preset.
 * Non-opting materials are completely untouched at compile time.
 */
export function installHybridTerrainShadowShader(): void {
  if (hybridShadowChunkPatched) return;
  hybridShadowChunkPatched = true;

  const target =
    'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';

  if (!THREE.ShaderChunk.lights_fragment_begin.includes(target)) return;

  THREE.ShaderChunk.lights_fragment_begin =
    THREE.ShaderChunk.lights_fragment_begin.replace(
      `#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
\t\tdirectionalLightShadow = directionalLightShadows[ i ];
\t\t${target}
\t\t#endif`,
      `#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
\t\tdirectionalLightShadow = directionalLightShadows[ i ];
\t\tfloat s7DirShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
\t\t#if defined( S7_HYBRID_TERRAIN_SHADOW ) && ( UNROLLED_LOOP_INDEX == 0 )
\t\ts7DirShadow = s7CombineHybridShadow( s7DirShadow, s7BakedFarShadow, s7CascadeFade );
\t\t#endif
\t\tdirectLight.color *= s7DirShadow;
\t\t#elif defined( S7_HYBRID_TERRAIN_SHADOW ) && ( UNROLLED_LOOP_INDEX == 0 )
\t\tdirectLight.color *= s7BakedFarShadow;
\t\t#endif`,
    );
}
