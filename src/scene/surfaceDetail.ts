import * as THREE from 'three';
import {
  GLSL_FOLIAGE_WIND_PARS,
  bindFoliageLightingUniforms,
} from './foliageLighting';
import {
  type CheckerboardShadowMode,
  SHADOW_STABILITY_CONFIG,
  WATER_WAVE_OCTAVES,
} from './surfaceDetailMath';

function f32(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0');
}

/**
 * Shared GLSL analytic pixel-footprint line anti-aliasing (`line(d, hw, fw)` from Atlantis `sh_scene.js`).
 * Computes exact 1D pixel coverage over a stripe of half-width `hw` at distance `d` with pixel width `fw`.
 * Zero moire at distance and razor-sharp expansion joints up close.
 */
export const GLSL_ANALYTIC_LINE_PARS = /* glsl */ `
float s7AnalyticLine( float d, float hw, float fw ) {
  float safeFw = max( fw, 1e-5 );
  return clamp( ( min( d + safeFw * 0.5, hw ) - max( d - safeFw * 0.5, -hw ) ) / safeFw, 0.0, 1.0 );
}

float s7PeriodicLine( float coord, float pitch, float hw, float fw ) {
  float u = fract( coord / pitch + 0.5 ) - 0.5;
  float dist = abs( u ) * pitch;
  return s7AnalyticLine( dist, hw, fw );
}

float s7GridJointMask( vec2 coord, vec2 pitch, float hw ) {
  vec2 fw = max( fwidth( coord ), vec2( 1e-4 ) );
  float lx = s7PeriodicLine( coord.x, pitch.x, hw, fw.x );
  float ly = s7PeriodicLine( coord.y, pitch.y, hw, fw.y );
  return max( lx, ly );
}
`;

/**
 * Shared GLSL helpers for contrasty alpine terrain slopes, hollow-vs-crest grass,
 * and stretch-free 3-axis triplanar stratified cliffs (all smoothstep edges strictly ascending).
 * Relies on `terrNoise` / `terrFbm2` and `uCanyonLightMap` / `uCanyonBounds` already in terrainShader.
 */
export const GLSL_ALPINE_TRIPLANAR_PARS = /* glsl */ `
vec3 s7TriplanarWeights( vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 6.0 ) );
  return w / max( w.x + w.y + w.z, 1e-5 );
}

// Reuses the already-bound heightmap mip pyramid (mip 2.5) to detect damp hollows vs exposed crests.
float s7SampleHollowCrest( vec3 worldPos, float riverVicinity ) {
  vec2 uv = worldPos.xz * uCanyonBounds.xy + 0.5;
  vec2 suv = clamp( uv, vec2( 0.004 ), vec2( 0.996 ) );
  float smoothH = uCanyonBounds.z + textureLod( uCanyonLightMap, suv, 2.5 ).r * uCanyonBounds.w;
  float relH = ( worldPos.y - smoothH ) / 7.5;
  float altDry = smoothstep( 8.0, 20.0, worldPos.y ) * 0.35;
  return clamp( relH - clamp( riverVicinity, 0.0, 1.0 ) * 0.42 + altDry, -1.0, 1.0 );
}

// 3-axis triplanar alpine limestone/slate bedding (~1m strata ledges + undercut shadow + vertical fissures).
// Returns vec3( strataShade [0..1], fissureMask [0..1], ledgeBumpHeight [0..1] ).
vec3 s7SampleTriplanarAlpineRock( vec3 wp, vec3 triW, float macroN, float pixelSize ) {
  float fineKeep = 1.0 - smoothstep( 0.10, 0.42, pixelSize );
  // Warp horizontal bedding gently along X/Z so geological strata dip naturally across cliffs
  float warp = ( macroN - 0.5 ) * 2.8 + ( terrNoise( wp.xz * 0.085 ) - 0.5 ) * 1.4;
  float yBed = wp.y + warp;

  // Coarse (~3.2m) & fine (~1.05m) horizontal rock strata beds + sharp undercut ledge shadow line
  float bedBroad = terrNoise( vec2( wp.x * 0.09 + wp.z * 0.09, yBed * 0.34 ) );
  float bedPhase = fract( yBed * 0.95 + bedBroad * 0.42 );
  float ledgeLip = smoothstep( 0.08, 0.24, bedPhase ) * ( 1.0 - smoothstep( 0.84, 0.98, bedPhase ) );
  float ledgeUndercut = ( 1.0 - smoothstep( 0.0, 0.17, bedPhase ) ) * ( 0.48 + 0.52 * fineKeep );

  // 3-axis triplanar rock crag & fracture projection (zero vertical stretching on sheer cliffs)
  float cragXY = terrFbm2( vec2( wp.x * 0.22, yBed * 0.36 ) );
  float cragZY = terrFbm2( vec2( wp.z * 0.22, yBed * 0.36 + 5.7 ) );
  float cragXZ = terrFbm2( wp.xz * 0.24 + vec2( 3.1, -2.2 ) );
  float triCrag = cragZY * triW.x + cragXZ * triW.y + cragXY * triW.z;

  float grainXY = fineKeep > 0.001 ? terrNoise( vec2( wp.x * 0.88, wp.y * 1.15 ) ) : 0.5;
  float grainZY = fineKeep > 0.001 ? terrNoise( vec2( wp.z * 0.88 + 4.3, wp.y * 1.15 ) ) : 0.5;
  float grainXZ = fineKeep > 0.001 ? terrNoise( wp.xz * 0.92 - vec2( 2.1, 6.4 ) ) : 0.5;
  float triGrain = mix( 0.5, grainZY * triW.x + grainXZ * triW.y + grainXY * triW.z, fineKeep );

  // Crisp vertical & diagonal tectonic fracture cracks across cliff faces
  float crackXY = 1.0 - smoothstep( 0.04, 0.16, abs( terrNoise( vec2( wp.x * 0.38, wp.y * 0.16 ) ) - 0.5 ) );
  float crackZY = 1.0 - smoothstep( 0.04, 0.16, abs( terrNoise( vec2( wp.z * 0.38 + 9.1, wp.y * 0.16 ) ) - 0.5 ) );
  float crackXZ = 1.0 - smoothstep( 0.05, 0.18, abs( terrNoise( wp.xz * 0.34 ) - 0.5 ) );
  float triCrack = crackZY * triW.x + crackXZ * triW.y + crackXY * triW.z;

  float strataVal = clamp( bedBroad * 0.36 + triCrag * 0.38 + ledgeLip * 0.26, 0.0, 1.0 );
  float fissure = clamp( max( triCrack * 0.72, ledgeUndercut * 0.88 ) * ( 0.65 + 0.35 * triGrain ), 0.0, 1.0 );
  float bumpH = clamp( triCrag * 0.48 + ledgeLip * 0.32 + triGrain * 0.20 - ledgeUndercut * 0.25, 0.0, 1.0 );
  return vec3( strataVal, fissure, bumpH );
}
`;

/**
 * Generates 3-octave rotated water normal sampling and exact lost-variance-to-roughness GLSL
 * synchronized with `WATER_WAVE_OCTAVES` in `surfaceDetailMath.ts`.
 */
export function buildWater3OctaveGlsl() {
  const [o0, o1, o2] = WATER_WAVE_OCTAVES;
  return {
    helpers: /* glsl */ `
vec2 s7WaterOctaveSlope( sampler2D nMap, vec2 wpXZ, float invLen, mat2 rotM, vec2 drift, float t ) {
  vec2 uv = ( rotM * wpXZ + drift * t ) * invLen;
  vec2 s = texture2D( nMap, uv ).xy * 2.0 - 1.0;
  // Right-multiplying by orthonormal rotM equals transpose(rotM) * s in all GLSL versions
  return s * rotM;
}
`,
    /**
     * Replaces single-tile normal-map evaluation on the horizontal river plane with 3 rotated,
     * incommensurate wave octaves damped individually by world pixel footprint `wPixelSize`,
     * and records exact lost sub-pixel wave variance (`wLostWaveVar`) for roughness conservation.
     */
    normalEvaluate: /* glsl */ `
float wOctKeep0 = 1.0 / ( 1.0 + pow( wPixelSize * ${f32(o0.nyquistK)}, 2.0 ) );
float wOctKeep1 = 1.0 / ( 1.0 + pow( wPixelSize * ${f32(o1.nyquistK)}, 2.0 ) );
float wOctKeep2 = 1.0 / ( 1.0 + pow( wPixelSize * ${f32(o2.nyquistK)}, 2.0 ) );
float wLostWaveVar =
  ( 1.0 - wOctKeep0 ) * ${f32(o0.slopeVariance)} +
  ( 1.0 - wOctKeep1 ) * ${f32(o1.slopeVariance)} +
  ( 1.0 - wOctKeep2 ) * ${f32(o2.slopeVariance)};
vec2 wCombinedSlope = vec2( 0.0 );

#ifdef USE_NORMALMAP_TANGENTSPACE
  mat2 wRot0 = mat2( ${f32(o0.rot[0])}, ${f32(o0.rot[1])}, ${f32(o0.rot[2])}, ${f32(o0.rot[3])} );
  mat2 wRot1 = mat2( ${f32(o1.rot[0])}, ${f32(o1.rot[1])}, ${f32(o1.rot[2])}, ${f32(o1.rot[3])} );
  mat2 wRot2 = mat2( ${f32(o2.rot[0])}, ${f32(o2.rot[1])}, ${f32(o2.rot[2])}, ${f32(o2.rot[3])} );

  vec2 wSlope0 = s7WaterOctaveSlope( normalMap, vWaterWorldPos.xz, ${f32(1 / o0.wavelengthM)}, wRot0, vec2( ${f32(o0.drift[0])}, ${f32(o0.drift[1])} ), uWaterTime );
  vec2 wSlope1 = s7WaterOctaveSlope( normalMap, vWaterWorldPos.xz, ${f32(1 / o1.wavelengthM)}, wRot1, vec2( ${f32(o1.drift[0])}, ${f32(o1.drift[1])} ), uWaterTime );
  vec2 wSlope2 = s7WaterOctaveSlope( normalMap, vWaterWorldPos.xz, ${f32(1 / o2.wavelengthM)}, wRot2, vec2( ${f32(o2.drift[0])}, ${f32(o2.drift[1])} ), uWaterTime );

  // Slow calm/lively wind-patch modulation (as in Atlantis sh_fx.js) so river sheen breathes organically
  float wCalmPatch = 0.72 + 0.56 * waterNoise( vWaterWorldPos.xz * 0.045 + vec2( uWaterTime * 0.015, -uWaterTime * 0.01 ) );
  wCombinedSlope = (
    wSlope0 * ${f32(o0.weight)} * wOctKeep0 +
    wSlope1 * ${f32(o1.weight)} * wOctKeep1 +
    wSlope2 * ${f32(o2.weight)} * wOctKeep2
  ) * wCalmPatch * ( 1.0 - wFoam * 0.72 );

  vec3 wMapN = normalize( vec3( wCombinedSlope * normalScale, 1.0 ) );
  normal = normalize( tbn * wMapN );
#endif
`,
    clearcoatEvaluate: /* glsl */ `
#ifdef USE_CLEARCOAT_NORMALMAP
  vec3 wCcMapN = normalize( vec3( wCombinedSlope * clearcoatNormalScale, 1.0 ) );
  clearcoatNormal = normalize( tbn2 * wCcMapN );
#endif
`,
    applyLostVariance: /* glsl */ `
float wNormalVar = clamp( wNormalGradSq * 0.62, 0.0, 0.095 );
float wBaseAaVar = min( 0.145, wNormalVar + wLostWaveVar );
material.roughness = min( 1.0, sqrt( material.roughness * material.roughness + wBaseAaVar * ( 1.0 - wFoam ) ) );
#ifdef USE_CLEARCOAT
  float wCcNormalVar = clamp( wCcNormalGradSq * 0.68, 0.0, 0.085 );
  float wCcAaVar = min( 0.118, wCcNormalVar + wLostWaveVar * 0.84 );
  material.clearcoatRoughness = min( 1.0, sqrt( material.clearcoatRoughness * material.clearcoatRoughness + wCcAaVar ) );
  material.clearcoat *= ( 1.0 - wFoam * 0.92 );
#endif
`,
  };
}

const checkerboardDepthCache = new Map<string, THREE.MeshDepthMaterial>();

/**
 * Returns a cached shadow-depth material that writes an Atlantis-style checkerboard texel mask
 * (`glass25`: 25% coverage, `lattice50`: 50% coverage) so PCF shadow filtering produces a clean,
 * soft translucent half-shadow for glass canopies, energy shields, and holographic tactical signs.
 */
export function getCheckerboardShadowMaterial(
  mode: CheckerboardShadowMode,
  side: THREE.Side = THREE.FrontSide,
): THREE.MeshDepthMaterial {
  const key = `${mode}|${side}`;
  const cached = checkerboardDepthCache.get(key);
  if (cached) return cached;

  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side,
  });
  mat.customProgramCacheKey = () => `sector7-checker-shadow-v1-${mode}-${side}`;
  const discardRule =
    mode === 'glass25'
      ? 'if ( ( s7Sp.x & 1 ) + ( s7Sp.y & 1 ) != 0 ) discard;'
      : 'if ( ( ( s7Sp.x + s7Sp.y ) & 1 ) != 0 ) discard;';

  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
ivec2 s7Sp = ivec2( floor( gl_FragCoord.xy ) );
${discardRule}`,
    );
  };

  checkerboardDepthCache.set(key, mat);
  return mat;
}

/**
 * Creates a stabilized shadow-depth material for `HangingVines`:
 * - Strips high-frequency wind flutter & damps macro sway (`0.32x`) so vine shadows never jitter.
 * - Samples the vine alpha texture at a shadow-texel-matched mip level (`textureLod`) with a
 *   mip-aware cutoff floor matching Atlantis's `fsLeaf` shadow coverage technique.
 */
export function createStabilizedVineDepthMaterial(
  vineTexture: THREE.Texture,
  alphaTest: number,
  vineHeight: number,
): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: vineTexture,
    alphaTest,
    side: THREE.DoubleSide,
  });
  mat.customProgramCacheKey = () => 'sector7-hanging-vines-depth-v1';
  mat.onBeforeCompile = (shader) => {
    bindFoliageLightingUniforms(shader.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${GLSL_FOLIAGE_WIND_PARS}
attribute float aVinePhase;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float swayFactor = clamp( -position.y / ${vineHeight.toFixed(1)}, 0.0, 1.0 );
#ifdef USE_INSTANCING
  mat4 vineInstWorld = modelMatrix * instanceMatrix;
#else
  mat4 vineInstWorld = modelMatrix;
#endif
vec3 vineRoot = ( vineInstWorld * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
// Stabilized macro gust only (zero high-frequency flutter) so vine shadows never crawl
vec3 vineWindWorld = s7TravelingWindOffset(
  vineRoot.xz,
  swayFactor,
  ${(0.34 * SHADOW_STABILITY_CONFIG.vineShadowSwayScale).toFixed(4)},
  aVinePhase,
  0.0
);
vec3 vineWindLocal = s7WorldToLocalOffset( mat3( vineInstWorld ), vineWindWorld );
transformed.x += vineWindLocal.x;
transformed.y += vineWindLocal.y;
transformed.z += max( vineWindLocal.z, -0.02 * swayFactor * swayFactor );`,
      );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#ifdef USE_ALPHATEST
  #ifdef USE_MAP
    vec2 vShTex = vMapUv * vec2( 128.0, 256.0 );
    vec2 vShDx = dFdx( vShTex );
    vec2 vShDy = dFdy( vShTex );
    float vShLod = clamp( 0.5 * log2( max( max( dot( vShDx, vShDx ), dot( vShDy, vShDy ) ), 1e-8 ) ) + ${SHADOW_STABILITY_CONFIG.vineShadowMipBias.toFixed(2)}, 0.0, 4.0 );
    float vShAlpha = textureLod( map, vMapUv, vShLod ).a;
    float vShCutoff = clamp( alphaTest - 0.05 * vShLod, ${SHADOW_STABILITY_CONFIG.vineShadowAlphaMin.toFixed(2)}, alphaTest );
    if ( vShAlpha < vShCutoff ) discard;
  #else
    if ( diffuseColor.a < alphaTest ) discard;
  #endif
#endif`,
    );
  };
  return mat;
}
