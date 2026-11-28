import type { LightingPreset } from '../map/sectors';

export const CANYON_MAP_SIZE = 256;
export const CANYON_WORLD_SPAN = 1024;
export const CANYON_HEIGHT_MIN = -10.0;
export const CANYON_HEIGHT_MAX = 118.0;
export const CANYON_HEIGHT_RANGE = CANYON_HEIGHT_MAX - CANYON_HEIGHT_MIN;

export interface CanyonPresetConfig {
  skyVisStrength: number;
  skyVisMin: number;
  farShadowStrength: number;
  softPenumbraSlope: number;
}

export const CANYON_PRESETS: Record<LightingPreset, CanyonPresetConfig> = {
  day: {
    skyVisStrength: 0.72,
    skyVisMin: 0.36,
    farShadowStrength: 0.80,
    softPenumbraSlope: 0.048,
  },
  dusk: {
    skyVisStrength: 0.84,
    skyVisMin: 0.30,
    farShadowStrength: 0.88,
    softPenumbraSlope: 0.036,
  },
  night: {
    skyVisStrength: 0.62,
    skyVisMin: 0.42,
    farShadowStrength: 0.54,
    softPenumbraSlope: 0.065,
  },
};

export const HYBRID_CASCADE_CONFIG = {
  driveHalfExtent: 34,
  overviewMinHalfExtent: 34,
  overviewMaxHalfExtent: 105,
  overviewDistRatio: 0.28,
  cascadeFadeStart: 0.68,
  cascadeFadeEnd: 0.90,
} as const;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function encodeTerrainHeightByte(heightY: number): number {
  const norm = clamp(
    (heightY - CANYON_HEIGHT_MIN) / CANYON_HEIGHT_RANGE,
    0,
    1,
  );
  return Math.round(norm * 255);
}

export function decodeTerrainHeightByte(byteVal: number): number {
  const norm = clamp(byteVal / 255, 0, 1);
  return CANYON_HEIGHT_MIN + norm * CANYON_HEIGHT_RANGE;
}

/**
 * Samples the extended terrain elevation function onto a centered square grid
 * spanning [-worldSpan/2, +worldSpan/2] along both X and Z.
 */
export function buildCanyonHeightGrid(
  sampleHeight: (x: number, z: number) => number,
  size = CANYON_MAP_SIZE,
  worldSpan = CANYON_WORLD_SPAN,
): Float32Array {
  const grid = new Float32Array(size * size);
  const half = worldSpan * 0.5;
  for (let iz = 0; iz < size; iz++) {
    const v = (iz + 0.5) / size;
    const z = -half + v * worldSpan;
    const row = iz * size;
    for (let ix = 0; ix < size; ix++) {
      const u = (ix + 0.5) / size;
      const x = -half + u * worldSpan;
      grid[row + ix] = sampleHeight(x, z);
    }
  }
  return grid;
}

function sampleGridBilinear(
  grid: Float32Array,
  size: number,
  fx: number,
  fz: number,
): number {
  const maxIdx = size - 1;
  const cx = clamp(fx, 0, maxIdx);
  const cz = clamp(fz, 0, maxIdx);
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const x1 = Math.min(maxIdx, x0 + 1);
  const z1 = Math.min(maxIdx, z0 + 1);
  const tx = cx - x0;
  const tz = cz - z0;

  const r0 = z0 * size;
  const r1 = z1 * size;
  const h00 = grid[r0 + x0];
  const h10 = grid[r0 + x1];
  const h01 = grid[r1 + x0];
  const h11 = grid[r1 + x1];
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

/**
 * Computes a soft baked directional mountain/terrain shadow map (0 = occluded, 255 = sunlit)
 * via progressive heightfield horizon ray-marching toward `sunPos`, followed by a fast
 * separable 3x3 tent filter to remove coarse texel stair-stepping.
 */
export function bakeDirectionalTerrainShadowGrid(
  heightGrid: Float32Array,
  sunPos: readonly [number, number, number],
  options?: {
    size?: number;
    worldSpan?: number;
    softPenumbraSlope?: number;
    maxMarchSteps?: number;
    heightBias?: number;
  },
): Uint8Array {
  const size = options?.size ?? CANYON_MAP_SIZE;
  const worldSpan = options?.worldSpan ?? CANYON_WORLD_SPAN;
  const softPenumbraSlope = options?.softPenumbraSlope ?? 0.042;
  const maxMarchSteps = options?.maxMarchSteps ?? 40;
  const heightBias = options?.heightBias ?? 0.85;

  const raw = new Uint8Array(size * size);
  const horizLen = Math.hypot(sunPos[0], sunPos[2]);
  if (sunPos[1] <= 0.01) {
    raw.fill(0);
    return raw;
  }
  if (horizLen < 1e-4) {
    raw.fill(255);
    return raw;
  }

  const dirX = sunPos[0] / horizLen;
  const dirZ = sunPos[2] / horizLen;
  const sunSlope = sunPos[1] / horizLen;
  const texelWorld = worldSpan / size;
  const maxCoord = size - 1;

  for (let iz = 0; iz < size; iz++) {
    const row = iz * size;
    for (let ix = 0; ix < size; ix++) {
      const h0 = heightGrid[row + ix] + heightBias;
      let maxExcess = 0;
      let distTex = 0;

      for (let step = 1; step <= maxMarchSteps; step++) {
        distTex += 1.0 + step * 0.14;
        const sx = ix + dirX * distTex;
        const sz = iz + dirZ * distTex;
        if (sx < 0 || sx > maxCoord || sz < 0 || sz > maxCoord) break;

        const distWorld = distTex * texelWorld;
        const rayH = h0 + distWorld * sunSlope;
        if (rayH > CANYON_HEIGHT_MAX) break;

        const sampleH = sampleGridBilinear(heightGrid, size, sx, sz);
        const excess = (sampleH - rayH) / distWorld;
        if (excess > maxExcess) {
          maxExcess = excess;
          if (maxExcess >= softPenumbraSlope) break;
        }
      }

      const occ = smoothstep(0.0, softPenumbraSlope, maxExcess);
      raw[row + ix] = Math.round((1 - occ) * 255);
    }
  }

  // Fast separable [1, 2, 1] / 4 tent pass removes diagonal texel stair-stepping
  const tmp = new Uint8Array(size * size);
  const out = new Uint8Array(size * size);

  for (let iz = 0; iz < size; iz++) {
    const row = iz * size;
    for (let ix = 0; ix < size; ix++) {
      const l = ix > 0 ? raw[row + ix - 1] : raw[row + ix];
      const c = raw[row + ix];
      const r = ix < maxCoord ? raw[row + ix + 1] : raw[row + ix];
      tmp[row + ix] = (l + (c << 1) + r + 2) >> 2;
    }
  }

  for (let iz = 0; iz < size; iz++) {
    const row = iz * size;
    const prevRow = (iz > 0 ? iz - 1 : iz) * size;
    const nextRow = (iz < maxCoord ? iz + 1 : iz) * size;
    for (let ix = 0; ix < size; ix++) {
      const u = tmp[prevRow + ix];
      const c = tmp[row + ix];
      const d = tmp[nextRow + ix];
      out[row + ix] = (u + (c << 1) + d + 2) >> 2;
    }
  }

  return out;
}

/**
 * Pure mirror of the 3-tap heightmap-mip canyon sky visibility calculation.
 * Compares fragment height `localY` against 3 progressively coarser mip averages
 * (mid canyon walls, broad valley rim, macro mountain amphitheater).
 */
export function computeSkyVisibilityFromMipHeights(
  localY: number,
  mipHeights: readonly [number, number, number],
  strength = 0.8,
  minSkyVis = 0.32,
): number {
  const d0 = Math.max(0, mipHeights[0] - localY) / 14.0;
  const d1 = Math.max(0, mipHeights[1] - localY) / 30.0;
  const d2 = Math.max(0, mipHeights[2] - localY) / 56.0;
  const occ = clamp(d0 * 0.42 + d1 * 0.36 + d2 * 0.22, 0, 1);
  return clamp(1.0 - occ * clamp(strength, 0, 1), clamp(minSkyVis, 0.1, 1), 1.0);
}

/**
 * Tightened orthographic half-extent for the live near shadow cascade.
 * Cuts Overview shadow-pass area by up to 4x (max 105 vs 210) while keeping
 * crisp 34-unit coverage around the Mech in Drive Mode.
 */
export function computeHybridShadowHalfExtent(
  camDist: number,
  driveMode: boolean,
): number {
  if (driveMode) return HYBRID_CASCADE_CONFIG.driveHalfExtent;
  return clamp(
    camDist * HYBRID_CASCADE_CONFIG.overviewDistRatio,
    HYBRID_CASCADE_CONFIG.overviewMinHalfExtent,
    HYBRID_CASCADE_CONFIG.overviewMaxHalfExtent,
  );
}

/**
 * Combines live near directional shadow with baked far terrain shadow:
 * - Zero double-darkening via `min(effectiveLive, farVis)`
 * - Smooth fade-out of live cascade across [0.68..0.90] of halfExtent
 * - On `Low` preset (`liveShadowsEnabled = false`), returns `farVis` directly
 */
export function combineHybridShadow(
  liveShadow: number,
  bakedFarShadow: number,
  distFromFocus: number,
  cascadeHalfExtent: number,
  liveShadowsEnabled: boolean,
  farShadowStrength = 0.85,
): number {
  const farVis = lerp(
    1.0,
    clamp(bakedFarShadow, 0, 1),
    clamp(farShadowStrength, 0, 1),
  );
  if (!liveShadowsEnabled) return farVis;

  const radialNorm = distFromFocus / Math.max(cascadeHalfExtent, 1.0);
  const cascadeFade = smoothstep(
    HYBRID_CASCADE_CONFIG.cascadeFadeStart,
    HYBRID_CASCADE_CONFIG.cascadeFadeEnd,
    radialNorm,
  );
  const effectiveLive = lerp(clamp(liveShadow, 0, 1), 1.0, cascadeFade);
  return Math.min(effectiveLive, farVis);
}

export const UNDERWATER_SHADOW_EASE_CONFIG = {
  waterLevel: 0.0,
  /** Maximum shadow softening factor under water (Atlantis sh_light.js:236-240) */
  maxEaseFraction: 0.46,
  /** Submerged depth (world units) at which shadow easing reaches maxEaseFraction */
  fullEaseDepth: 1.45,
} as const;

/**
 * Pure TypeScript mirror of Atlantis's underwater refracted-sun shadow easing (`sh_light.js:236-240`):
 * Refracted sunlight under water is steeper than air shadow maps assume, and sky/caustic light
 * enters through the whole water surface. Dry surfaces (`worldY >= waterLevel + 0.05`) keep 100%
 * of their crisp direct shadow, while submerged riverbeds and ruins soften up to 46%.
 */
export function computeUnderwaterShadowEase(
  worldY: number,
  waterLevel = UNDERWATER_SHADOW_EASE_CONFIG.waterLevel,
): number {
  if (!Number.isFinite(worldY)) return 0;
  const subDepth = waterLevel - worldY;
  return (
    smoothstep(-0.05, UNDERWATER_SHADOW_EASE_CONFIG.fullEaseDepth, subDepth) *
    UNDERWATER_SHADOW_EASE_CONFIG.maxEaseFraction
  );
}

export function easeUnderwaterShadow(
  rawShadow: number,
  worldY: number,
  waterLevel = UNDERWATER_SHADOW_EASE_CONFIG.waterLevel,
): number {
  const clamped = clamp(rawShadow, 0, 1);
  const ease = computeUnderwaterShadowEase(worldY, waterLevel);
  return lerp(clamped, 1.0, ease);
}

