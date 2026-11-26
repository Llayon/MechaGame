/**
 * Pure TypeScript mathematical foundation for Sector 7's Atlantis-inspired surface detail pack:
 * 1. 3-Octave rotated river wave normal attenuation & exact lost-variance-to-roughness conversion.
 * 2. Analytic pixel-footprint anti-aliased line coverage (`line(d, hw, fw)`) for concrete slab/wall seams.
 * 3. Contrasty alpine slope biome math: hollow-vs-crest grass, ragged multi-scale scree/rock edges,
 *    and 3-axis triplanar blending weights for sheer canyon cliffs.
 * 4. Stabilized foliage shadow parameters & checkerboard translucent shadow parity (`glass25` / `lattice50`).
 *
 * Zero Three.js / DOM dependencies so every formula is unit-tested directly under `node:test`.
 */

export interface WaterWaveOctaveSpec {
  /** World-space repeat wavelength in meters (incommensurate to eliminate visible tiling). */
  readonly wavelengthM: number;
  /** Weight of this octave's slope contribution to the combined water normal. */
  readonly weight: number;
  /** Normalized slope variance carried by this octave (converted to roughness^2 when sub-pixel). */
  readonly slopeVariance: number;
  /** 2x2 orthonormal rotation matrix [m00, m01, m10, m11] preventing tile alignment. */
  readonly rot: readonly [number, number, number, number];
  /** Drift velocity (u/s, v/s) in world meters per second. */
  readonly drift: readonly [number, number];
  /** Sub-pixel Nyquist cutoff factor relative to world pixel footprint `fw`. */
  readonly nyquistK: number;
}

/**
 * Three incommensurate, rotated wave layers modeled after Noniv/atlantis `sh_fx.js`:
 * - Octave 0 (11.3 m): broad river swell visible well into mid-range overview.
 * - Octave 1 (5.9 m): medium cross-chop at ~37 deg rotation.
 * - Octave 2 (3.1 m): crisp close-range wind ripples at ~113 deg rotation that dissolve first into sheen.
 */
export const WATER_WAVE_OCTAVES: readonly [
  WaterWaveOctaveSpec,
  WaterWaveOctaveSpec,
  WaterWaveOctaveSpec,
] = Object.freeze([
  {
    wavelengthM: 11.3,
    weight: 0.48,
    slopeVariance: 0.042,
    rot: [1.0, 0.0, 0.0, 1.0],
    drift: [0.34, 0.21],
    nyquistK: 0.28,
  },
  {
    wavelengthM: 5.9,
    weight: 0.34,
    slopeVariance: 0.048,
    rot: [0.798636, -0.601815, 0.601815, 0.798636], // ~37 deg
    drift: [-0.26, 0.38],
    nyquistK: 0.54,
  },
  {
    wavelengthM: 3.1,
    weight: 0.24,
    slopeVariance: 0.056,
    rot: [-0.390731, -0.920505, 0.920505, -0.390731], // ~113 deg
    drift: [0.42, -0.31],
    nyquistK: 1.02,
  },
]);

export const SHADOW_STABILITY_CONFIG = Object.freeze({
  /** Gentle macro wind sway multiplier retained in tree shadow depth passes (0.35x = calm, grounded). */
  pineShadowSwayScale: 0.35,
  /** High-frequency twig flutter removed in shadow passes to prevent shadow-texel crawling. */
  pineShadowFlutterScale: 0.0,
  /** Gentle macro sway retained in hanging-vine shadow depth pass. */
  vineShadowSwayScale: 0.32,
  /** Positive mip bias in foliage shadow cutout sampling matching coarser shadow-map texels. */
  vineShadowMipBias: 1.0,
  /** Minimum alpha threshold floor so distant vine shadows never erode to empty gaps. */
  vineShadowAlphaMin: 0.16,
});

export type CheckerboardShadowMode = 'glass25' | 'lattice50';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface WaterOctaveWaveAaResult {
  /** Per-octave active normal retention factor in (0..1], decaying smoothly with pixel footprint. */
  octaveRetention: [number, number, number];
  /** Total lost sub-pixel slope variance converted into specular roughness^2. */
  lostVariance: number;
  /** Resulting base water roughness after variance conservation and foam blend. */
  roughness: number;
  /** Resulting clearcoat roughness after variance conservation. */
  clearcoatRoughness: number;
}

/**
 * Pure TypeScript mirror of the 3-octave water Nyquist attenuation & roughness conservation math.
 * As world pixel footprint `pixelSize` grows, fine ripples drop out of the surface normal first
 * and transfer their exact slope variance into `roughness^2`, producing a calm satin sheen afar
 * with zero 1-pixel specular sparkle.
 */
export function computeWaterOctaveWaveAa(
  pixelSize: number,
  baseRoughness = 0.08,
  baseClearcoatRoughness = 0.05,
  foam = 0,
): WaterOctaveWaveAaResult {
  const fw = Math.max(0, Number.isFinite(pixelSize) ? pixelSize : 0);
  const clampedFoam = clamp(foam, 0, 1);
  const baseR = clamp(baseRoughness, 0.045, 1);
  const baseCcR = clamp(baseClearcoatRoughness, 0.045, 1);

  const retention: [number, number, number] = [1, 1, 1];
  let lostVariance = 0;

  for (let i = 0; i < 3; i++) {
    const oct = WATER_WAVE_OCTAVES[i];
    const x = fw * oct.nyquistK;
    const keep = 1 / (1 + x * x);
    retention[i] = keep;
    lostVariance += (1 - keep) * oct.slopeVariance;
  }

  const cappedVar = Math.min(0.145, lostVariance);
  const cappedCcVar = Math.min(0.118, lostVariance * 0.84);
  const preFoamR = baseR + (0.84 - baseR) * clampedFoam;
  const roughness = Math.min(1, Math.sqrt(preFoamR * preFoamR + cappedVar * (1 - clampedFoam)));
  const clearcoatRoughness = Math.min(1, Math.sqrt(baseCcR * baseCcR + cappedCcVar));

  return {
    octaveRetention: retention,
    lostVariance,
    roughness,
    clearcoatRoughness,
  };
}

/**
 * Exact Atlantis `line(d, hw, fw)` pixel-coverage integral for a centered line of half-width `hw`
 * at signed distance `d` under screen-space pixel width `fw`.
 * Returns 1 when fully inside a resolved line, smoothly anti-aliases across edges, and naturally
 * attenuates to `2 * hw / fw` when the line becomes thinner than one pixel (eliminating moire).
 */
export function computeAnalyticLineCoverage(
  signedDist: number,
  halfWidth: number,
  pixelWidth: number,
): number {
  const d = Number.isFinite(signedDist) ? signedDist : 0;
  const hw = Math.max(0, Number.isFinite(halfWidth) ? halfWidth : 0);
  const fw = Math.max(1e-5, Number.isFinite(pixelWidth) ? pixelWidth : 1e-5);
  const lo = Math.max(d - fw * 0.5, -hw);
  const hi = Math.min(d + fw * 0.5, hw);
  return clamp((hi - lo) / fw, 0, 1);
}

/**
 * Evaluates a 2D periodic architectural expansion-joint grid using `computeAnalyticLineCoverage`.
 */
export function computeSlabJointMask(
  coordX: number,
  coordY: number,
  pitchX: number,
  pitchY: number,
  halfWidth: number,
  fwX: number,
  fwY: number,
): number {
  const wrapDist = (v: number, pitch: number): number => {
    const p = Math.max(1e-4, pitch);
    const m = (((v % p) + p) % p) - p * 0.5;
    return Math.abs(m) - p * 0.5;
  };
  // Distance to nearest grid line at integer multiples of pitch:
  const dX = Math.abs((((coordX / Math.max(1e-4, pitchX) + 0.5) % 1) + 1) % 1 - 0.5) * pitchX;
  const dY = Math.abs((((coordY / Math.max(1e-4, pitchY) + 0.5) % 1) + 1) % 1 - 0.5) * pitchY;
  void wrapDist;
  const lineX = computeAnalyticLineCoverage(dX, halfWidth, fwX);
  const lineY = computeAnalyticLineCoverage(dY, halfWidth, fwY);
  return Math.max(lineX, lineY);
}

/**
 * Computes local alpine terrain hollowness vs ridge crest bias in [-1, +1]:
 * - Negative values (down to -1): damp hollows, gullies, and river meadows -> lush emerald turf.
 * - Positive values (up to +1): exposed crests and high knolls -> sun-bleached dry golden-olive turf.
 */
export function computeHollowCrestBias(
  worldY: number,
  smoothedMipY: number,
  riverVicinity: number,
): number {
  const relHeight = (worldY - smoothedMipY) / 7.5;
  const riverCool = -clamp(riverVicinity, 0, 1) * 0.42;
  const altDry = smoothstep(8.0, 20.0, worldY) * 0.35;
  return clamp(relHeight + riverCool + altDry, -1, 1);
}

export interface AlpineSlopeMasks {
  /** Intermediate bright alpine scree / talus band (0..1) between meadow grass and sheer cliff. */
  screeWeight: number;
  /** Crisp multi-scale ragged solid rock cliff mask (0..1). */
  rockWeight: number;
}

/**
 * Contrasty alpine slope classifier:
 * Produces a sharp, multi-scale ragged boundary from grass -> alpine scree/talus (~18..29 deg) ->
 * stratified cliff rock (> 26..31 deg) so mountain flanks never wash out into a blurry gradient.
 */
export function computeAlpineSlopeMasks(
  slopeDeg: number,
  worldY: number,
  noiseMacro: number,
  noiseMid: number,
  noiseFine: number,
  rockPad = 0,
): AlpineSlopeMasks {
  const raggedShift =
    (noiseMacro - 0.5) * 7.4 +
    (noiseMid - 0.5) * 4.6 +
    (noiseFine - 0.5) * 2.2;
  const effSlope = slopeDeg + raggedShift;

  // Tight, ragged solid rock onset (only 4.2 deg transition band, broken at 3 spatial scales)
  const slopeRock = smoothstep(26.4, 30.6, effSlope);
  const highRock = smoothstep(22.5, 29.0, worldY + (noiseMacro - 0.5) * 6.0 + (noiseMid - 0.5) * 2.4);
  const rockWeight = clamp(Math.max(slopeRock, highRock, clamp(rockPad, 0, 1)), 0, 1);

  // Contrasty alpine scree / talus apron flanking steep slopes & high elevation skirts
  const screeSlopeEnter = smoothstep(17.8, 22.8, effSlope);
  const screeAltEnter = smoothstep(14.0, 21.5, worldY + (noiseMacro - 0.5) * 5.0) * smoothstep(10.5, 17.5, effSlope);
  const screeRaw = Math.max(screeSlopeEnter, screeAltEnter * 0.85);
  const screeWeight = clamp(screeRaw * (1 - rockWeight * 0.92), 0, 1);

  return { screeWeight, rockWeight };
}

/**
 * Normalized 3-axis triplanar projection weights `pow(|N|, 6)` for stretch-free sheer cliffs.
 */
export function computeTriplanarWeights(
  nx: number,
  ny: number,
  nz: number,
): [number, number, number] {
  const len = Math.hypot(nx, ny, nz) || 1;
  const ax = Math.abs(nx / len);
  const ay = Math.abs(ny / len);
  const az = Math.abs(nz / len);
  const wx = Math.pow(ax, 6);
  const wy = Math.pow(ay, 6);
  const wz = Math.pow(az, 6);
  const sum = wx + wy + wz || 1;
  return [wx / sum, wy / sum, wz / sum];
}

/**
 * Atlantis-style shadow-texel checkerboard mask (`fsGlass` / `fsCrystal` in `sh_scene.js`).
 * PCF filtering blurs the regular texel grid into a smooth, translucent half-shadow:
 * - `'glass25'`: keeps 25% of texels (`(px & 1) === 0 && (py & 1) === 0`) for glass & holograms.
 * - `'lattice50'`: keeps 50% of texels (`((px + py) & 1) === 0`) for dense screens & lattices.
 */
export function evaluateCheckerboardShadowKeep(
  px: number,
  py: number,
  mode: CheckerboardShadowMode,
): boolean {
  const ix = Math.floor(px) & 1;
  const iy = Math.floor(py) & 1;
  if (mode === 'glass25') {
    return ix === 0 && iy === 0;
  }
  return ((ix + iy) & 1) === 0;
}
