/**
 * Pure TypeScript mathematical foundation for Sector 7's 3-item optimization & visual polish pack:
 * 1. Early-Z Ground Last flag parsing, percentile statistics (p50 / p95), and canonical A/B benchmark routes.
 * 2. Top-4 active water ripple selection & physically aligned radial normal slope (`dH/dR`) for RiverWater.
 * 3. Targeted 14% dither cross-fade band for PineForest LOD 1 <-> LOD 2 (discrete shadows, disabled on Low).
 *
 * Zero Three.js / DOM dependencies so every formula is deterministically unit-tested under `node:test`.
 */

import { chooseLod, lodJitter } from '../lod/worldLod';
import {
  computeRippleTransform,
  type RippleTransform,
  type WaterRippleSlot,
} from './objects/waterVfxPool';

export const MAX_SHADER_WATER_RIPPLES = 4;

/**
 * Narrow 14% transition band (±7%) strictly around PineForest's LOD 1 <-> LOD 2 boundary
 * (3D conical pine <-> crossed 2D pine cards), keeping dual-draw cells minimal and shadows discrete.
 */
export const PINE_LOD_DITHER_CONFIG = Object.freeze({
  bandHalfFraction: 0.07,
  totalBandFraction: 0.14,
  transitionThresholdIndex: 1,
});

export type GroundLastRouteId = 'refinery-citadel' | 'open-canyon';

export interface BenchmarkWaypoint {
  readonly pos: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export interface GroundLastBenchmarkRoute {
  readonly id: GroundLastRouteId;
  readonly label: string;
  readonly start: BenchmarkWaypoint;
  readonly end: BenchmarkWaypoint;
}

/**
 * Two deterministic camera trajectories for A/B testing Early-Z Ground Last after full load:
 * - `refinery-citadel`: low-angle corridor past Industrial Refinery & Citadel walls (heavy building overdraw over terrain).
 * - `open-canyon`: exposed hillside & canyon ridge sweep (checks for inverse hill-occlusion effect).
 */
export const GROUND_LAST_BENCHMARK_ROUTES: Readonly<
  Record<GroundLastRouteId, GroundLastBenchmarkRoute>
> = Object.freeze({
  'refinery-citadel': {
    id: 'refinery-citadel',
    label: 'Refinery / Citadel dense structures',
    start: { pos: [72, 23, -18], target: [118, 17, -74] },
    end: { pos: [42, 21, -46], target: [122, 16, -78] },
  },
  'open-canyon': {
    id: 'open-canyon',
    label: 'Open canyon hillside sweep',
    start: { pos: [-78, 28, 36], target: [10, 6, -24] },
    end: { pos: [-26, 26, 54], target: [48, 8, -32] },
  },
});

/**
 * Parses `?groundLast=0|1|false|true` from a URL query string.
 * Defaults to `defaultValue` (true) when absent or unrecognized.
 */
export function parseGroundLastFlag(search: string, defaultValue = true): boolean {
  if (!search) return defaultValue;
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  for (const part of trimmed.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = eq >= 0 ? part.slice(0, eq) : part;
    if (key !== 'groundLast') continue;
    const raw = (eq >= 0 ? part.slice(eq + 1) : '').trim().toLowerCase();
    if (raw === '0' || raw === 'false' || raw === 'off') return false;
    if (raw === '1' || raw === 'true' || raw === 'on') return true;
  }
  return defaultValue;
}

/** Computes linear-interpolated percentile `p` in [0, 1] on an already-sorted ascending array. */
export function computePercentile(sortedSamples: readonly number[], p: number): number {
  const n = sortedSamples.length;
  if (n === 0) return 0;
  if (n === 1) return sortedSamples[0];
  const clampedP = Math.max(0, Math.min(1, p));
  const idx = clampedP * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(n - 1, Math.ceil(idx));
  const frac = idx - lo;
  return sortedSamples[lo] + (sortedSamples[hi] - sortedSamples[lo]) * frac;
}

export interface TimingSummary {
  count: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export function summarizeTimingSamples(samples: readonly number[]): TimingSummary {
  const valid = samples.filter((v) => Number.isFinite(v) && v >= 0);
  if (valid.length === 0) {
    return { count: 0, p50Ms: 0, p95Ms: 0, meanMs: 0, minMs: 0, maxMs: 0 };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) sum += sorted[i];
  return {
    count: sorted.length,
    p50Ms: computePercentile(sorted, 0.5),
    p95Ms: computePercentile(sorted, 0.95),
    meanMs: sum / sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

export interface ShaderWaterRipple {
  x: number;
  z: number;
  /** Expanding primary crest radius in world units (matches WaterEffects ring radius). */
  radius: number;
  /** Peak normal slope amplitude (already modulated by fade-in/fade-out and impulse intensity). */
  amplitude: number;
  /** Outer radial cutoff beyond which shader skips trig math completely. */
  outerRadius: number;
  /** Inverse radial Gaussian envelope width (1 / bandWidth). */
  invBandWidth: number;
  /** Angular spatial frequency (rad / world unit) of concentric wavelets. */
  waveFreq: number;
  /** Normalized age progress in [0, 1]. */
  progress: number;
}

const _tmpTf: RippleTransform = {
  x: 0,
  y: 0,
  z: 0,
  scale: 0,
  alpha: 0,
  progress: 0,
};

/**
 * Converts a live `WaterRippleSlot` into shader parameters whose primary wave crest
 * aligns 1:1 with the expanding foam ring in `WaterEffects` (`dist = 0.74 * halfScale`).
 */
export function computeShaderRippleParams(
  slot: Readonly<WaterRippleSlot>,
  out: ShaderWaterRipple,
): boolean {
  if (!computeRippleTransform(slot, _tmpTf)) return false;
  // WaterEffects renders a 1x1 plane scaled by `scale` -> ring radius is `scale * 0.5`,
  // primary crest sits around normalized dist ~ 0.74.
  const halfScale = _tmpTf.scale * 0.5;
  const crestRadius = halfScale * 0.74;
  const bandWidth = Math.max(0.42, halfScale * 0.34);
  const outerRadius = halfScale * 1.18 + bandWidth * 0.65;
  const intensityBoost = Math.min(1.5, 0.72 + slot.intensity * 0.42);
  const amplitude = _tmpTf.alpha * intensityBoost * 0.58;
  if (amplitude <= 0.004) return false;

  out.x = _tmpTf.x;
  out.z = _tmpTf.z;
  out.radius = crestRadius;
  out.amplitude = amplitude;
  out.outerRadius = outerRadius;
  out.invBandWidth = 1 / bandWidth;
  out.waveFreq = (Math.PI * 2) / Math.max(0.45, bandWidth * 0.92);
  out.progress = _tmpTf.progress;
  return true;
}

/**
 * Zero-allocation top-K selection of up to `MAX_SHADER_WATER_RIPPLES` (4) active water impulses,
 * prioritizing impulses closest to `(focusX, focusZ)` with strong remaining wave amplitude.
 * Returns the number of selected ripples written into `outSlots[0..count-1]`.
 */
export function selectTopWaterRipples(
  ripples: readonly WaterRippleSlot[],
  focusX: number,
  focusZ: number,
  outSlots: ShaderWaterRipple[],
  maxCount = MAX_SHADER_WATER_RIPPLES,
): number {
  const limit = Math.min(maxCount, outSlots.length);
  if (limit <= 0) return 0;

  // Tiny inline insertion sort over at most 4 elements (zero heap allocations).
  let count = 0;
  const scores = _topScores;
  const candidate = _candidateRipple;

  for (let i = 0; i < ripples.length; i++) {
    const slot = ripples[i];
    if (!slot.active) continue;
    if (!computeShaderRippleParams(slot, candidate)) continue;

    const dx = candidate.x - focusX;
    const dz = candidate.z - focusZ;
    const distSq = dx * dx + dz * dz;
    // Favor close ripples around the camera/mech while preserving big fresh impacts nearby.
    const score = (candidate.amplitude * (1.25 - candidate.progress * 0.45)) / (1 + distSq * 0.00085);

    if (count < limit || score > scores[count - 1]) {
      let insertAt = count < limit ? count : limit - 1;
      if (count < limit) count++;
      while (insertAt > 0 && score > scores[insertAt - 1]) {
        scores[insertAt] = scores[insertAt - 1];
        copyShaderRipple(outSlots[insertAt - 1], outSlots[insertAt]);
        insertAt--;
      }
      scores[insertAt] = score;
      copyShaderRipple(candidate, outSlots[insertAt]);
    }
  }
  return count;
}

const _topScores = [0, 0, 0, 0, 0, 0, 0, 0];
const _candidateRipple: ShaderWaterRipple = {
  x: 0,
  z: 0,
  radius: 0,
  amplitude: 0,
  outerRadius: 0,
  invBandWidth: 1,
  waveFreq: 4,
  progress: 0,
};

function copyShaderRipple(src: Readonly<ShaderWaterRipple>, dst: ShaderWaterRipple): void {
  dst.x = src.x;
  dst.z = src.z;
  dst.radius = src.radius;
  dst.amplitude = src.amplitude;
  dst.outerRadius = src.outerRadius;
  dst.invBandWidth = src.invBandWidth;
  dst.waveFreq = src.waveFreq;
  dst.progress = src.progress;
}

/**
 * Pure TypeScript mirror of RiverWater's radial normal-slope perturbation `(-dH/dx, +dH/dz)`
 * matching Three.js PlaneGeometry rotated `-PI/2` around X (`T = +X`, `B = -Z`, `N = +Y`).
 */
export function evaluateWaterRippleSlope2D(
  worldX: number,
  worldZ: number,
  ripples: readonly Readonly<ShaderWaterRipple>[],
  activeCount: number,
  pixelSize = 0.05,
): [number, number] {
  const n = Math.min(activeCount, ripples.length, MAX_SHADER_WATER_RIPPLES);
  if (n <= 0) return [0, 0];

  const fw = Math.max(0, Number.isFinite(pixelSize) ? pixelSize : 0);
  // Smooth Nyquist damping so far-away ripples never sparkle as 1-pixel specular noise
  const nyquistKeep = 1 / (1 + fw * fw * 1.45);
  if (nyquistKeep <= 0.005) return [0, 0];

  let slopeT = 0;
  let slopeB = 0;

  for (let i = 0; i < n; i++) {
    const r = ripples[i];
    const dx = worldX - r.x;
    const dz = worldZ - r.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > r.outerRadius * r.outerRadius || distSq < 1e-6) continue;

    const dist = Math.sqrt(distSq);
    const delta = dist - r.radius;
    const u = delta * r.invBandWidth;
    const env = Math.exp(-u * u * 1.85);
    if (env <= 0.004) continue;

    const phase = delta * r.waveFreq;
    // Derivative of H(r) = A * env(r) * cos(phase): dH/dr = -A * env * (sin(phase)*k + cos(phase)*3.7*u*invBand)
    const dHdR =
      -r.amplitude *
      env *
      (Math.sin(phase) * 0.85 + Math.cos(phase) * (u * 0.55));
    const invDist = 1 / dist;
    const dirX = dx * invDist;
    const dirZ = dz * invDist;

    // PlaneGeometry rotated -PI/2 around X: tangent T = +X, bitangent B = -Z -> (-dH/dx, +dH/dz)
    slopeT += -dHdR * dirX * nyquistKeep;
    slopeB += dHdR * dirZ * nyquistKeep;
  }

  return [slopeT, slopeB];
}

export interface PineLodCrossFadeState {
  /** Active draw range level for the primary pine cell mesh (0, 1, or 2). */
  primaryLevel: number;
  /** Outgoing LOD 1 dither dissolve factor in [0, 1); 0 means no dither discard. */
  fadeOut: number;
  /** Incoming LOD 2 card companion factor in [0, 1); > 0 means companion card mesh is visible. */
  cardFadeIn: number;
  /** Strictly discrete shadow level (0, 1, or 2) — shadows never dither. */
  discreteShadowLevel: number;
}

/**
 * Evaluates targeted 14% dither cross-fade strictly on PineForest's LOD 1 <-> LOD 2 transition
 * (3D conical tiers <-> crossed 2D cards), keeping LOD 0 <-> LOD 1 discrete, shadows discrete,
 * and disabling cross-fade completely when `ditherEnabled === false` (Low graphics preset).
 */
export function computePineLodCrossFade(
  pixels: number,
  previousLevel: number,
  thresholds: readonly number[],
  jitterId: number,
  ditherEnabled: boolean,
): PineLodCrossFadeState {
  const discreteLevel = chooseLod(pixels, previousLevel, thresholds, jitterId);
  if (!ditherEnabled || thresholds.length < 2) {
    return {
      primaryLevel: discreteLevel,
      fadeOut: 0,
      cardFadeIn: 0,
      discreteShadowLevel: discreteLevel,
    };
  }

  const jitter = lodJitter(jitterId);
  const thr12 = thresholds[PINE_LOD_DITHER_CONFIG.transitionThresholdIndex] * jitter;
  const halfBand = PINE_LOD_DITHER_CONFIG.bandHalfFraction;
  const bandLo = thr12 * (1 - halfBand);
  const bandHi = thr12 * (1 + halfBand);

  if (pixels > bandLo && pixels < bandHi) {
    // Smoothly dissolve from LOD 1 (at bandHi, t -> 0) into LOD 2 cards (at bandLo, t -> 1).
    const t = Math.max(0.001, Math.min(0.999, (bandHi - pixels) / (bandHi - bandLo)));
    return {
      primaryLevel: 1,
      fadeOut: t,
      cardFadeIn: t,
      discreteShadowLevel: pixels >= thr12 ? 1 : 2,
    };
  }

  // Outside the narrow 14% band, pick pure single-draw level (no hysteresis lag crossing band edges).
  if (pixels <= bandLo) {
    return {
      primaryLevel: 2,
      fadeOut: 0,
      cardFadeIn: 0,
      discreteShadowLevel: 2,
    };
  }

  // Above bandHi: either LOD 0 or LOD 1 (keep LOD 0 <-> LOD 1 hysteresis cleanly).
  const highLevel = discreteLevel === 2 ? 1 : discreteLevel;
  return {
    primaryLevel: highLevel,
    fadeOut: 0,
    cardFadeIn: 0,
    discreteShadowLevel: highLevel,
  };
}

/**
 * Pure TypeScript mirror of PineForest's complementary screen-space IGN dither test.
 * Guarantees exact pixel-for-pixel partition between outgoing LOD 1 and incoming LOD 2 cards
 * (zero holes, zero double-opaque pixel overlap).
 */
export function evaluateComplementaryDither(
  ignSample: number,
  fadeT: number,
): { keepPrimary: boolean; keepSecondary: boolean } {
  const t = Math.max(0, Math.min(1, fadeT));
  if (t <= 0.001) return { keepPrimary: true, keepSecondary: false };
  if (t >= 0.999) return { keepPrimary: false, keepSecondary: true };
  // Primary (LOD 1) keeps pixels with ign >= t; Secondary (LOD 2) keeps pixels with ign < t.
  const keepPrimary = ignSample >= t;
  return { keepPrimary, keepSecondary: !keepPrimary };
}
