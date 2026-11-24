import type { LightingPreset } from '../map/sectors';

export type ToneMappingMode = 'agx' | 'aces';

export interface FogScatterPreset {
  sunColorHex: string;
  /** Exponent for the tight forward-scattering solar aureole lobe */
  power: number;
  /** Maximum blend weight of the in-scattered solar tint into base fogColor */
  strength: number;
  /** Fallback sun world position matching LIGHTING_CONFIGS[preset].keyPos */
  defaultSunPos: readonly [number, number, number];
}

export const TONE_EXPOSURE_BY_MODE: Record<
  ToneMappingMode,
  Record<LightingPreset, number>
> = {
  aces: {
    day: 1.14,
    dusk: 0.92,
    night: 0.92,
  },
  agx: {
    day: 1.18,
    dusk: 1.0,
    night: 0.98,
  },
};

export const FOG_SCATTER_PRESETS: Record<LightingPreset, FogScatterPreset> = {
  dusk: {
    sunColorHex: '#E09158',
    power: 5.5,
    strength: 0.62,
    defaultSunPos: [110, 106, -245],
  },
  day: {
    sunColorHex: '#D8E9FA',
    power: 7.0,
    strength: 0.34,
    defaultSunPos: [175, 160, -85],
  },
  night: {
    sunColorHex: '#3D5F8A',
    power: 8.5,
    strength: 0.18,
    defaultSunPos: [110, 115, -210],
  },
};

/**
 * Parses URL search parameters (`?tonemapping=agx|aces`) for A/B tone-mapping evaluation.
 * Defaults to `'agx'` when omitted or unrecognized.
 */
export function parseToneMappingMode(search = ''): ToneMappingMode {
  if (!search) return 'agx';
  const normalized = search.startsWith('?') ? search : `?${search}`;
  const raw = new URLSearchParams(normalized).get('tonemapping');
  if (!raw) return 'agx';
  const value = raw.trim().toLowerCase();
  if (value === 'aces' || value === 'acesfilmic') return 'aces';
  return 'agx';
}

export function getToneMappingExposure(
  mode: ToneMappingMode,
  preset: LightingPreset,
): number {
  return TONE_EXPOSURE_BY_MODE[mode][preset];
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface FogInScatteringInput {
  camPos: readonly [number, number, number];
  worldPos: readonly [number, number, number];
  sunDir: readonly [number, number, number];
  fogFactor: number;
  power: number;
  strength: number;
}

export interface FogInScatteringResult {
  sunCos: number;
  phase: number;
  scatterWeight: number;
}

/**
 * Pure TypeScript mirror of the GLSL dual-lobe Mie height-fog solar in-scattering curve.
 * Preserves foreground contrast (`fogFactor` gating) while warming the canyon mist and
 * horizon corridor toward the active sun/moon azimuth.
 */
export function computeFogInScattering({
  camPos,
  worldPos,
  sunDir,
  fogFactor,
  power,
  strength,
}: FogInScatteringInput): FogInScatteringResult {
  const vx = worldPos[0] - camPos[0];
  const vy = worldPos[1] - camPos[1];
  const vz = worldPos[2] - camPos[2];
  const vLen = Math.hypot(vx, vy, vz);

  const sLen = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);
  if (
    vLen <= 1e-5 ||
    sLen <= 1e-5 ||
    !Number.isFinite(vLen) ||
    !Number.isFinite(sLen)
  ) {
    return { sunCos: 0, phase: 0, scatterWeight: 0 };
  }

  const dot =
    (vx * sunDir[0] + vy * sunDir[1] + vz * sunDir[2]) / (vLen * sLen);
  const sunCos = clamp(dot, 0, 1);

  const safePower = clamp(power, 1.0, 24.0);
  const safeStrength = clamp(strength, 0.0, 1.0);
  const safeFogFactor = clamp(fogFactor, 0.0, 1.0);

  const broadLobe = Math.pow(sunCos, 2.2) * 0.36;
  const tightLobe = Math.pow(sunCos, safePower) * 0.64;
  const phase = clamp(broadLobe + tightLobe, 0.0, 1.0);

  const depthGate = smoothstep(0.03, 0.44, safeFogFactor);
  const worldY = Number.isFinite(worldPos[1]) ? worldPos[1] : 0;
  const horizonLift = 1.0 - 0.25 * smoothstep(28.0, 140.0, Math.max(0.0, worldY));
  const scatterWeight = clamp(
    phase * safeStrength * depthGate * horizonLift,
    0.0,
    0.82,
  );

  return {
    sunCos,
    phase,
    scatterWeight,
  };
}
