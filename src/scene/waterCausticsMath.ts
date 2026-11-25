import type { GraphicsPreset } from '../game/graphicsSettings';
import type { LightingPreset } from '../map/sectors';

export interface CausticsLightingPreset {
  colorHex: string;
  /** Linear RGB multiplier for caustics light */
  linearRgb: readonly [number, number, number];
  /** Underwater refracted solar caustics strength on shallow riverbeds & shoals */
  underwaterStrength: number;
  /** Upward water-bounced caustic shimmer on bridge piers & coastal rock walls */
  wallBounceStrength: number;
  /** Fallback sun world position matching LIGHTING_CONFIGS[preset].keyPos */
  defaultSunPos: readonly [number, number, number];
}

export const CAUSTICS_CONFIG = {
  waterLevel: 0.0,
  maxUnderwaterDepth: 2.55,
  maxWallBounceHeight: 2.6,
  fadeDistStart: 95.0,
  fadeDistEnd: 195.0,
  nyquistPixelMin: 0.08,
  nyquistPixelMax: 0.36,
  /** Beer-Lambert RGB attenuation per world unit of water depth (red absorbs fastest) */
  absorptionRgb: [0.22, 0.065, 0.045] as readonly [number, number, number],
  /** Slight turquoise tint added to water-bounced light hitting vertical quay/pier walls */
  wallBounceTint: [0.84, 1.0, 0.96] as readonly [number, number, number],
} as const;

export const CAUSTICS_PRESETS: Record<LightingPreset, CausticsLightingPreset> = {
  day: {
    colorHex: '#FFF1C8',
    linearRgb: [1.0, 0.88, 0.58],
    underwaterStrength: 1.05,
    wallBounceStrength: 0.48,
    defaultSunPos: [175, 160, -85],
  },
  dusk: {
    colorHex: '#FFB572',
    linearRgb: [1.0, 0.48, 0.17],
    underwaterStrength: 0.74,
    wallBounceStrength: 0.38,
    defaultSunPos: [110, 106, -245],
  },
  night: {
    colorHex: '#7FAAD8',
    linearRgb: [0.22, 0.4, 0.68],
    underwaterStrength: 0.15,
    wallBounceStrength: 0.08,
    defaultSunPos: [110, 115, -210],
  },
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Returns active underwater and wall-bounce caustic intensities for the current lighting
 * and graphics presets. Disables caustics completely on the `low` graphics preset.
 */
export function resolveCausticsStrengths(
  lightingPreset: LightingPreset,
  graphicsPreset: GraphicsPreset,
): { underwaterStrength: number; wallBounceStrength: number; enabled: boolean } {
  if (graphicsPreset === 'low') {
    return { underwaterStrength: 0, wallBounceStrength: 0, enabled: false };
  }
  const cfg = CAUSTICS_PRESETS[lightingPreset];
  return {
    underwaterStrength: cfg.underwaterStrength,
    wallBounceStrength: cfg.wallBounceStrength,
    enabled: true,
  };
}

/**
 * Jimenez GTAO Multi-Bounce AO polynomial (pure TS mirror of GLSL `s7MultiBounceAO`).
 * Preserves chromatic bounce inside crevices so bright stone, terracotta, moss, and concrete
 * retain saturated warm/cool inter-reflections instead of turning flat gray.
 */
export function computeMultiBounceAO(
  ao: number,
  albedo: readonly [number, number, number],
): [number, number, number] {
  const s = clamp(ao, 0, 1);
  const out: [number, number, number] = [s, s, s];
  for (let i = 0; i < 3; i++) {
    const c = clamp(albedo[i], 0, 1);
    const a = 2.0404 * c - 0.3324;
    const b = -4.7951 * c + 0.6417;
    const d = 2.7552 * c + 0.6903;
    const poly = ((s * a + b) * s + d) * s;
    out[i] = clamp(Math.max(s, poly), 0, 1);
  }
  return out;
}

/**
 * Lagarde / Frostbite & Atlantis horizon specular occlusion.
 * Dampens indirect sky/IBL reflections inside occluded crevices, overhangs, and grazing angles.
 */
export function computeSpecularOcclusion(
  dotNV: number,
  ao: number,
  roughness: number,
): number {
  const nv = clamp(dotNV, 0, 1);
  const s = clamp(ao, 0, 1);
  const r = clamp(roughness, 0.04, 1);
  const exp = Math.pow(2, -16 * r - 1);
  return clamp(Math.pow(Math.max(0, nv + s), exp) - 1 + s, 0, 1);
}

/**
 * Procedural 2-layer rotated caustic wave lattice (zero texture reads).
 * Produces crisp intersecting light filaments (`0..1`) mirroring GLSL `s7CausticGrid`.
 */
export function sampleCausticGrid(x: number, z: number, timeSec: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(timeSec)) {
    return 0;
  }
  const qx = x + Math.sin(z * 1.15 + timeSec * 0.9) * 0.45;
  const qz = z + Math.cos(x * 1.15 - timeSec * 0.85) * 0.45;
  const a = Math.sin(qx * 2.1 + timeSec * 1.25) * Math.cos(qz * 2.1 - timeSec * 1.05);
  const rx = qx * 0.6 - qz * 0.8;
  const rz = qx * 0.8 + qz * 0.6;
  const b = Math.sin(rx * 2.7 - timeSec * 1.1) * Math.cos(rz * 2.7 + timeSec * 1.35);
  const ridge = clamp((1 - Math.abs(a)) * 0.56 + (1 - Math.abs(b)) * 0.52, 0, 1);
  return Math.pow(ridge, 4);
}

export interface UnderwaterCausticsInput {
  worldPos: readonly [number, number, number];
  worldNormal: readonly [number, number, number];
  sunDir: readonly [number, number, number];
  lightingPreset: LightingPreset;
  graphicsPreset: GraphicsPreset;
  riverMask: number;
  camDist: number;
  pixelSize: number;
  timeSec: number;
}

export function computeUnderwaterCaustics({
  worldPos,
  worldNormal,
  sunDir,
  lightingPreset,
  graphicsPreset,
  riverMask,
  camDist,
  pixelSize,
  timeSec,
}: UnderwaterCausticsInput): [number, number, number] {
  const { underwaterStrength } = resolveCausticsStrengths(
    lightingPreset,
    graphicsPreset,
  );
  const rMask = clamp(riverMask, 0, 1);
  if (underwaterStrength <= 0.001 || rMask <= 0.01) return [0, 0, 0];

  const wy = Number.isFinite(worldPos[1]) ? worldPos[1] : 999;
  const dep = CAUSTICS_CONFIG.waterLevel - wy;
  if (dep <= -0.08 || dep > CAUSTICS_CONFIG.maxUnderwaterDepth) return [0, 0, 0];

  const distFade =
    1 - smoothstep(CAUSTICS_CONFIG.fadeDistStart, CAUSTICS_CONFIG.fadeDistEnd, camDist);
  if (distFade <= 0.001) return [0, 0, 0];

  const nyquist =
    1 -
    smoothstep(
      CAUSTICS_CONFIG.nyquistPixelMin,
      CAUSTICS_CONFIG.nyquistPixelMax,
      pixelSize,
    );
  if (nyquist <= 0.001) return [0, 0, 0];

  const posDep = Math.max(dep, 0);
  const sLen = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);
  const sx = sLen > 1e-5 ? sunDir[0] / sLen : 0;
  const sz = sLen > 1e-5 ? sunDir[2] / sLen : 0;

  const rx = worldPos[0] + sx * posDep * 0.95;
  const rz = worldPos[2] + sz * posDep * 0.95;
  const c1 = sampleCausticGrid(rx * 0.58, rz * 0.58, timeSec);
  const c2 = sampleCausticGrid(
    rx * 1.08 + 3.7,
    rz * 1.08 - 2.1,
    -timeSec * 0.85,
  );
  const causticVal = clamp(c1 * 0.65 + c2 * 0.45, 0, 1.35);

  const subMask =
    smoothstep(-0.06, 0.08, dep) *
    (1 - smoothstep(1.65, CAUSTICS_CONFIG.maxUnderwaterDepth, dep));
  const upWeight = clamp((Number.isFinite(worldNormal[1]) ? worldNormal[1] : 1) + 0.35, 0, 1);
  const scale =
    (0.16 + 1.45 * causticVal) *
    underwaterStrength *
    subMask *
    rMask *
    distFade *
    nyquist *
    upWeight;

  const rgb = CAUSTICS_PRESETS[lightingPreset].linearRgb;
  const abs = CAUSTICS_CONFIG.absorptionRgb;
  return [
    rgb[0] * Math.exp(-posDep * abs[0]) * scale,
    rgb[1] * Math.exp(-posDep * abs[1]) * scale,
    rgb[2] * Math.exp(-posDep * abs[2]) * scale,
  ];
}

export interface WallBounceCausticsInput {
  worldPos: readonly [number, number, number];
  worldNormal: readonly [number, number, number];
  sunDir: readonly [number, number, number];
  lightingPreset: LightingPreset;
  graphicsPreset: GraphicsPreset;
  riverMask: number;
  camDist: number;
  pixelSize: number;
  timeSec: number;
}

export function computeWallBounceCaustics({
  worldPos,
  worldNormal,
  sunDir,
  lightingPreset,
  graphicsPreset,
  riverMask,
  camDist,
  pixelSize,
  timeSec,
}: WallBounceCausticsInput): [number, number, number] {
  const { wallBounceStrength } = resolveCausticsStrengths(
    lightingPreset,
    graphicsPreset,
  );
  const rMask = clamp(riverMask, 0, 1);
  if (wallBounceStrength <= 0.001 || rMask <= 0.01) return [0, 0, 0];

  const wy = Number.isFinite(worldPos[1]) ? worldPos[1] : 999;
  const above = wy - CAUSTICS_CONFIG.waterLevel;
  if (above <= -0.15 || above > CAUSTICS_CONFIG.maxWallBounceHeight + 0.1) {
    return [0, 0, 0];
  }

  const ny = Number.isFinite(worldNormal[1]) ? worldNormal[1] : 1;
  const wallFactor = 1 - smoothstep(0.55, 0.92, Math.abs(ny));
  if (wallFactor <= 0.001) return [0, 0, 0];

  const distFade =
    1 - smoothstep(CAUSTICS_CONFIG.fadeDistStart, CAUSTICS_CONFIG.fadeDistEnd, camDist);
  if (distFade <= 0.001) return [0, 0, 0];

  const nyquist =
    1 -
    smoothstep(
      CAUSTICS_CONFIG.nyquistPixelMin,
      CAUSTICS_CONFIG.nyquistPixelMax,
      pixelSize,
    );
  if (nyquist <= 0.001) return [0, 0, 0];

  const hEnv =
    smoothstep(-0.12, 0.08, above) *
    (1 - smoothstep(0.32, CAUSTICS_CONFIG.maxWallBounceHeight, above));

  const hnLen = Math.hypot(worldNormal[0], worldNormal[2]);
  const hsLen = Math.hypot(sunDir[0], sunDir[2]);
  const sunAlign =
    hnLen > 0.001 && hsLen > 0.001
      ? clamp(
          ((worldNormal[0] * sunDir[0] + worldNormal[2] * sunDir[2]) /
            (hnLen * hsLen)) *
            0.5 +
            0.5,
          0,
          1,
        )
      : 0.65;
  const bounceDir = 0.42 + 0.58 * sunAlign;

  const px = (worldPos[0] + worldPos[2]) * 0.65;
  const py = above * 1.45 - timeSec * 0.42;
  const pattern = sampleCausticGrid(px, py, timeSec * 0.9);
  const scale =
    (0.08 + 0.95 * pattern) *
    wallBounceStrength *
    hEnv *
    wallFactor *
    bounceDir *
    rMask *
    distFade *
    nyquist;

  const rgb = CAUSTICS_PRESETS[lightingPreset].linearRgb;
  const tint = CAUSTICS_CONFIG.wallBounceTint;
  return [
    rgb[0] * tint[0] * scale,
    rgb[1] * tint[1] * scale,
    rgb[2] * tint[2] * scale,
  ];
}
