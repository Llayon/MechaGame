import type { LightingPreset } from '../map/sectors';

export interface FoliageTransmittancePreset {
  /** Linear RGB sunlight color multiplied by the warm yellow-green leaf transmittance shift */
  sunLinearRgb: readonly [number, number, number];
  /** Overall subsurface transmittance intensity for this lighting preset */
  strength: number;
  defaultSunPos: readonly [number, number, number];
}

/**
 * Atlantis-inspired deep yellow-green foliage transmittance tint (not chalky white).
 */
export const FOLIAGE_TRANSMITTANCE_TINT: readonly [number, number, number] = [
  0.95, 1.1, 0.38,
];

export const FOLIAGE_TRANSMITTANCE_PRESETS: Record<
  LightingPreset,
  FoliageTransmittancePreset
> = {
  dusk: {
    sunLinearRgb: [1.0, 0.44, 0.14],
    strength: 0.92,
    defaultSunPos: [110, 106, -245],
  },
  day: {
    sunLinearRgb: [1.0, 0.86, 0.56],
    strength: 0.62,
    defaultSunPos: [175, 160, -85],
  },
  night: {
    sunLinearRgb: [0.22, 0.38, 0.65],
    strength: 0.14,
    defaultSunPos: [110, 115, -210],
  },
};

export const WIND_WAVE_CONFIG = {
  /** Traveling wind wave spatial frequency across world XZ (wavelength ~115 units) */
  waveDirX: 0.05,
  waveDirZ: 0.021,
  /** Traveling wave phase speed (radians/sec) */
  waveSpeed: 0.55,
  /** Normalized dominant west-southwest breeze vector */
  pushDirX: 0.94,
  pushDirZ: 0.34,
} as const;

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function fract(x: number): number {
  return x - Math.floor(x);
}

export interface FoliageTransmittanceInput {
  viewRayDir: readonly [number, number, number];
  worldNormal: readonly [number, number, number];
  sunDir: readonly [number, number, number];
  albedo: readonly [number, number, number];
  lightingPreset: LightingPreset;
  /** Per-vertex or per-material translucency mask in [0, 1] (0 for bark, 1 for outer needle tips/leaves) */
  translucency: number;
}

/**
 * Pure TS mirror of Atlantis subsurface foliage transmittance (`sh_light.js`):
 * Strong forward-scattering backlit glow when looking through needles/leaves toward the sun,
 * plus gentle wrap-around illumination along sunlit rims.
 */
export function computeFoliageTransmittance({
  viewRayDir,
  worldNormal,
  sunDir,
  albedo,
  lightingPreset,
  translucency,
}: FoliageTransmittanceInput): [number, number, number] {
  const trans = clamp(translucency, 0, 1);
  if (trans <= 0.001) return [0, 0, 0];

  const cfg = FOLIAGE_TRANSMITTANCE_PRESETS[lightingPreset];
  if (cfg.strength <= 0.001) return [0, 0, 0];

  const vLen = Math.hypot(viewRayDir[0], viewRayDir[1], viewRayDir[2]);
  const nLen = Math.hypot(worldNormal[0], worldNormal[1], worldNormal[2]);
  const sLen = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);
  if (vLen <= 1e-5 || nLen <= 1e-5 || sLen <= 1e-5) return [0, 0, 0];

  const rx = viewRayDir[0] / vLen;
  const ry = viewRayDir[1] / vLen;
  const rz = viewRayDir[2] / vLen;

  const nx = worldNormal[0] / nLen;
  const ny = worldNormal[1] / nLen;
  const nz = worldNormal[2] / nLen;

  const lx = sunDir[0] / sLen;
  const ly = sunDir[1] / sLen;
  const lz = sunDir[2] / sLen;

  // Looking through foliage toward the sun gives dot(viewRayDir, sunDir) -> 1
  const viewSun = clamp(rx * lx + ry * ly + rz * lz, 0, 1);
  const backPhase = 0.25 + 0.75 * Math.pow(viewSun, 3.0);

  const ndl = nx * lx + ny * ly + nz * lz;
  const backFace = clamp(-ndl, 0, 1) * 0.7 + 0.3;
  const wrapFace = clamp(ndl * 0.5 + 0.5, 0, 1);

  const backGain = backPhase * backFace * 0.42 * trans * cfg.strength;
  const wrapGain = wrapFace * 0.14 * trans * cfg.strength;

  return [
    clamp(albedo[0], 0, 1) *
      cfg.sunLinearRgb[0] *
      (FOLIAGE_TRANSMITTANCE_TINT[0] * backGain + wrapGain),
    clamp(albedo[1], 0, 1) *
      cfg.sunLinearRgb[1] *
      (FOLIAGE_TRANSMITTANCE_TINT[1] * backGain + wrapGain),
    clamp(albedo[2], 0, 1) *
      cfg.sunLinearRgb[2] *
      (FOLIAGE_TRANSMITTANCE_TINT[2] * backGain + wrapGain),
  ];
}

export interface TravelingWindInput {
  worldX: number;
  worldZ: number;
  heightNorm: number;
  timeSec: number;
  amplitude: number;
  flutterPhase?: number;
  flutterAmplitude?: number;
}

/**
 * Pure TS mirror of Atlantis traveling west-southwest breeze (`sh_scene.js`):
 * A coherent low-frequency wave travels across terrain slopes with a quadratic
 * height bend profile and subtle branch/leaf flutter.
 */
export function computeTravelingWindOffset({
  worldX,
  worldZ,
  heightNorm,
  timeSec,
  amplitude,
  flutterPhase = 0,
  flutterAmplitude = 0,
}: TravelingWindInput): [number, number, number] {
  const h = clamp(heightNorm, 0, 1);
  const amp = Number.isFinite(amplitude) ? Math.max(0, amplitude) : 0;
  if (h <= 1e-5 || amp <= 1e-5) return [0, 0, 0];

  const g =
    worldX * WIND_WAVE_CONFIG.waveDirX +
    worldZ * WIND_WAVE_CONFIG.waveDirZ -
    timeSec * WIND_WAVE_CONFIG.waveSpeed;

  const bend =
    h * h * (0.16 + 0.13 * Math.sin(g) + 0.06 * Math.sin(g * 2.3 + 1.7)) * amp;

  let dx = bend * WIND_WAVE_CONFIG.pushDirX;
  let dy = -bend * bend * 0.04;
  let dz = bend * WIND_WAVE_CONFIG.pushDirZ;

  if (flutterAmplitude > 0) {
    const f =
      Math.sin(
        timeSec * 2.6 + flutterPhase * 43.0 + worldX * 0.9 + worldZ * 0.7,
      ) *
      flutterAmplitude *
      clamp(h * 1.6, 0, 1);
    dx += f;
    dy += f * 0.6;
    dz -= f * 0.7;
  }

  return [dx, dy, dz];
}

/**
 * Pure TS mirror of Atlantis mip-aware alpha-cutout compensation (`sh_scene.js`):
 * Gently relaxes alphaTest as mip level increases so distant foliage silhouettes
 * retain solid density instead of thinning out or glittering into sparse pixels.
 */
export function computeMipAwareAlphaThreshold(
  baseAlphaTest: number,
  mipLod: number,
  minAlphaTest = 0.14,
): number {
  const safeBase = clamp(baseAlphaTest, 0.05, 0.95);
  const safeMin = clamp(minAlphaTest, 0.02, safeBase);
  const safeLod = clamp(mipLod, 0, 4.0);
  return clamp(safeBase - 0.05 * safeLod, safeMin, safeBase);
}

/**
 * Jimenez Interleaved Gradient Noise in [0, 1).
 */
export function computeIgn(px: number, py: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return 0;
  return fract(52.9829189 * fract(px * 0.06711056 + py * 0.00583715));
}

/**
 * Triangular PDF IGN dither offset in (-1/255, +1/255) matching Atlantis `W_POST`.
 * Eliminates 8-bit color banding across smooth sunset/night sky and height-fog gradients.
 */
export function computeTriangularIgnDither(px: number, py: number): number {
  const n = computeIgn(px, py) + computeIgn(px + 37.0, py + 17.0) - 1.0;
  return n / 255.0;
}
