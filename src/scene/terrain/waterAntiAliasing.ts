/**
 * Single source of truth for river water distance & grazing-angle anti-aliasing.
 *
 * Why two signals are combined:
 * 1. Perturbed-normal screen derivatives (`dFdx/dFdy(normal)`) catch sub-pixel wave
 *    slope variance at mid-range before hardware mipmapping flattens the normal map.
 * 2. World-space pixel footprint (`max(fwidth(worldXZ).x, fwidth(worldXZ).y)`) captures
 *    unresolved sub-pixel wave variance at far distances, grazing angles, and reduced DRS DPR
 *    where mipmapped normals converge toward `(0, 1, 0)` and would otherwise sparkle.
 *
 * The same pixel footprint also Nyquist-filters high-frequency procedural shoreline/pier foam
 * so distant riverbanks stay calm without moire speckles.
 */

export const WATER_AA_CONFIG = Object.freeze({
  /** World-space pixel footprint range for satin specular variance ramp. */
  footprintMin: 0.16,
  footprintMax: 1.35,

  /** Main specular lobe variance parameters (base roughness 0.08 -> ~0.37..0.39 satin). */
  normalVarGain: 0.62,
  normalVarCap: 0.095,
  footprintBaseVar: 0.128,
  baseVarCap: 0.145,

  /** Clearcoat specular lobe variance parameters (base 0.05 -> ~0.33..0.35 satin). */
  clearcoatNormalVarGain: 0.68,
  clearcoatNormalVarCap: 0.085,
  footprintClearcoatVar: 0.105,
  clearcoatVarCap: 0.118,

  /** Mid-to-far footprint normal amplitude damping to prevent blocky specular facets & texel swimming. */
  normalDampMin: 0.24,
  normalDampMax: 1.75,
  normalDampStrength: 0.58,

  clearcoatNormalDampMin: 0.20,
  clearcoatNormalDampMax: 1.50,
  clearcoatNormalDampStrength: 0.68,

  /** Nyquist attenuation for procedural micro-foam noise (freq 2.15) & surf sine wavelets. */
  microFoamMin: 0.22,
  microFoamMax: 0.90,
  surfWaveMin: 0.42,
  surfWaveMax: 2.05,

  /** Dense shoreline/pier foam target roughness (preserved above AA satin band). */
  foamRoughness: 0.84,
  foamClearcoatSuppress: 0.92,
});

export interface WaterAntiAliasingInput {
  /** World-space screen pixel footprint: max(fwidth(worldPos.x), fwidth(worldPos.z)). */
  pixelSize: number;
  /** max(|dFdx(normal)|^2, |dFdy(normal)|^2) prior to normal damping. */
  normalGradSq: number;
  /** max(|dFdx(clearcoatNormal)|^2, |dFdy(clearcoatNormal)|^2) prior to damping. */
  clearcoatNormalGradSq?: number;
  /** Base water material roughness (default 0.08). */
  baseRoughness?: number;
  /** Base water clearcoat roughness (default 0.05). */
  baseClearcoatRoughness?: number;
  /** Foam mask in [0..1]. */
  foam?: number;
}

export interface WaterAntiAliasingResult {
  roughness: number;
  clearcoatRoughness: number;
  clearcoatFactor: number;
  normalDamp: number;
  clearcoatNormalDamp: number;
  microFoamWeight: number;
  surfWaveWeight: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Pure TypeScript mirror of the river fragment shader anti-aliasing math. */
export function computeWaterAntiAliasing(input: WaterAntiAliasingInput): WaterAntiAliasingResult {
  const cfg = WATER_AA_CONFIG;
  const pixelSize = Math.max(0, Number.isFinite(input.pixelSize) ? input.pixelSize : 0);
  const normalGradSq = Math.max(0, Number.isFinite(input.normalGradSq) ? input.normalGradSq : 0);
  const ccGradSq = Math.max(
    0,
    Number.isFinite(input.clearcoatNormalGradSq ?? normalGradSq)
      ? (input.clearcoatNormalGradSq ?? normalGradSq)
      : 0,
  );
  const foam = clamp(input.foam ?? 0, 0, 1);
  const baseR = clamp(input.baseRoughness ?? 0.08, 0.045, 1);
  const baseCcR = clamp(input.baseClearcoatRoughness ?? 0.05, 0.045, 1);

  const microFoamWeight = 1 - smoothstep(cfg.microFoamMin, cfg.microFoamMax, pixelSize);
  const surfWaveWeight = 1 - smoothstep(cfg.surfWaveMin, cfg.surfWaveMax, pixelSize);

  const normalDamp = smoothstep(cfg.normalDampMin, cfg.normalDampMax, pixelSize) * cfg.normalDampStrength;
  const clearcoatNormalDamp =
    smoothstep(cfg.clearcoatNormalDampMin, cfg.clearcoatNormalDampMax, pixelSize) *
    cfg.clearcoatNormalDampStrength;

  const footprintT = smoothstep(cfg.footprintMin, cfg.footprintMax, pixelSize);
  const normalVar = clamp(normalGradSq * cfg.normalVarGain, 0, cfg.normalVarCap);
  const baseAaVar = Math.min(cfg.baseVarCap, normalVar + footprintT * cfg.footprintBaseVar);

  const ccNormalVar = clamp(ccGradSq * cfg.clearcoatNormalVarGain, 0, cfg.clearcoatNormalVarCap);
  const ccAaVar = Math.min(cfg.clearcoatVarCap, ccNormalVar + footprintT * cfg.footprintClearcoatVar);

  const preFoamRoughness = baseR + (cfg.foamRoughness - baseR) * foam;
  const roughness = Math.min(1, Math.sqrt(preFoamRoughness * preFoamRoughness + baseAaVar * (1 - foam)));
  const clearcoatRoughness = Math.min(1, Math.sqrt(baseCcR * baseCcR + ccAaVar));
  const clearcoatFactor = 1 - foam * cfg.foamClearcoatSuppress;

  return {
    roughness,
    clearcoatRoughness,
    clearcoatFactor,
    normalDamp,
    clearcoatNormalDamp,
    microFoamWeight,
    surfWaveWeight,
  };
}

function glslFloat(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');
}

/** Generates synchronized GLSL chunks directly from WATER_AA_CONFIG. */
export function buildWaterAntiAliasingGlsl() {
  const c = WATER_AA_CONFIG;
  return {
    footprintAndNyquist: `
vec2 wWorldFootprint = fwidth( vWaterWorldPos.xz );
float wPixelSize = max( wWorldFootprint.x, wWorldFootprint.y );
float wMicroWeight = 1.0 - smoothstep( ${glslFloat(c.microFoamMin)}, ${glslFloat(c.microFoamMax)}, wPixelSize );
float wSurfWeight = 1.0 - smoothstep( ${glslFloat(c.surfWaveMin)}, ${glslFloat(c.surfWaveMax)}, wPixelSize );`,

    normalCaptureAndDamp: `
vec3 wNdx = dFdx( normal );
vec3 wNdy = dFdy( normal );
float wNormalGradSq = max( dot( wNdx, wNdx ), dot( wNdy, wNdy ) );
float wNormalDamp = smoothstep( ${glslFloat(c.normalDampMin)}, ${glslFloat(c.normalDampMax)}, wPixelSize ) * ${glslFloat(c.normalDampStrength)};
normal = normalize( mix( normal, nonPerturbedNormal, wNormalDamp ) );`,

    clearcoatNormalCaptureAndDamp: `
float wCcNormalGradSq = wNormalGradSq;
#ifdef USE_CLEARCOAT
  vec3 wCcNdx = dFdx( clearcoatNormal );
  vec3 wCcNdy = dFdy( clearcoatNormal );
  wCcNormalGradSq = max( dot( wCcNdx, wCcNdx ), dot( wCcNdy, wCcNdy ) );
  float wCcNormalDamp = smoothstep( ${glslFloat(c.clearcoatNormalDampMin)}, ${glslFloat(c.clearcoatNormalDampMax)}, wPixelSize ) * ${glslFloat(c.clearcoatNormalDampStrength)};
  clearcoatNormal = normalize( mix( clearcoatNormal, nonPerturbedNormal, wCcNormalDamp ) );
#endif`,

    applySpecularAa: `
float wFootprintT = smoothstep( ${glslFloat(c.footprintMin)}, ${glslFloat(c.footprintMax)}, wPixelSize );
float wNormalVar = clamp( wNormalGradSq * ${glslFloat(c.normalVarGain)}, 0.0, ${glslFloat(c.normalVarCap)} );
float wBaseAaVar = min( ${glslFloat(c.baseVarCap)}, wNormalVar + wFootprintT * ${glslFloat(c.footprintBaseVar)} );
material.roughness = min( 1.0, sqrt( material.roughness * material.roughness + wBaseAaVar * ( 1.0 - wFoam ) ) );
#ifdef USE_CLEARCOAT
  float wCcNormalVar = clamp( wCcNormalGradSq * ${glslFloat(c.clearcoatNormalVarGain)}, 0.0, ${glslFloat(c.clearcoatNormalVarCap)} );
  float wCcAaVar = min( ${glslFloat(c.clearcoatVarCap)}, wCcNormalVar + wFootprintT * ${glslFloat(c.footprintClearcoatVar)} );
  material.clearcoatRoughness = min( 1.0, sqrt( material.clearcoatRoughness * material.clearcoatRoughness + wCcAaVar ) );
  material.clearcoat *= ( 1.0 - wFoam * ${glslFloat(c.foamClearcoatSuppress)} );
#endif`,
  };
}
