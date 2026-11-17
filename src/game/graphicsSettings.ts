/**
 * Graphics quality is a render-only policy. Game simulation, collision
 * geometry, mission timers, IK and aiming must not depend on these options.
 */
export type GraphicsPreset = 'low' | 'balanced' | 'high' | 'ultra' | 'custom';
export type ShadowQuality = 'off' | 'low' | 'high' | 'ultra';
export type VegetationQuality = 'minimal' | 'reduced' | 'full';
export type ParticleQuality = 'reduced' | 'full';
export type AtmosphereQuality = 'off' | 'reduced' | 'full';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolutionScale: number;
  shadows: ShadowQuality;
  vegetation: VegetationQuality;
  particles: ParticleQuality;
  atmosphere: AtmosphereQuality;
  distantWar: boolean;
}

type QualityValues = Omit<GraphicsSettings, 'preset'>;

export const GRAPHICS_STORAGE_KEY = 'mech-graphics-v1';

export const GRAPHICS_PRESETS: Readonly<Record<Exclude<GraphicsPreset, 'custom'>, Readonly<QualityValues>>> = {
  low: {
    resolutionScale: 0.7,
    shadows: 'off',
    vegetation: 'minimal',
    particles: 'reduced',
    atmosphere: 'off',
    distantWar: false,
  },
  balanced: {
    resolutionScale: 0.85,
    shadows: 'low',
    vegetation: 'reduced',
    particles: 'reduced',
    atmosphere: 'reduced',
    distantWar: true,
  },
  high: {
    resolutionScale: 1,
    shadows: 'high',
    vegetation: 'full',
    particles: 'full',
    atmosphere: 'full',
    distantWar: true,
  },
  ultra: {
    resolutionScale: 1.15,
    shadows: 'ultra',
    vegetation: 'full',
    particles: 'full',
    atmosphere: 'full',
    distantWar: true,
  },
};

export function withGraphicsPreset(
  preset: Exclude<GraphicsPreset, 'custom'>,
): GraphicsSettings {
  return { ...GRAPHICS_PRESETS[preset], preset };
}

export function recommendGraphicsPreset(options: {
  mobile: boolean;
  deviceMemoryGB?: number | null;
  hardwareConcurrency?: number | null;
}): Exclude<GraphicsPreset, 'custom'> {
  if (options.deviceMemoryGB != null && options.deviceMemoryGB <= 2) return 'low';
  if (options.mobile || (options.deviceMemoryGB != null && options.deviceMemoryGB <= 4) ||
      (options.hardwareConcurrency != null && options.hardwareConcurrency <= 4)) return 'balanced';
  return 'high';
}

export function defaultGraphicsSettings(): GraphicsSettings {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return withGraphicsPreset('high');
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = window.matchMedia?.('(pointer: coarse)')?.matches ??
    /Android|iPhone|iPad/i.test(navigator.userAgent);
  return withGraphicsPreset(recommendGraphicsPreset({
    mobile, deviceMemoryGB: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency,
  }));
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

const PRESETS = ['low', 'balanced', 'high', 'ultra'] as const;
const SHADOWS = ['off', 'low', 'high', 'ultra'] as const;
const VEGETATION = ['minimal', 'reduced', 'full'] as const;
const PARTICLES = ['reduced', 'full'] as const;
const ATMOSPHERE = ['off', 'reduced', 'full'] as const;

export function sanitizeGraphicsSettings(
  value: unknown,
  fallback: GraphicsSettings = withGraphicsPreset('high'),
): GraphicsSettings {
  if (!value || typeof value !== 'object') return { ...fallback };
  const v = value as Partial<Record<keyof GraphicsSettings, unknown>>;
  const preset = isOneOf(v.preset, PRESETS) ? v.preset :
    v.preset === 'custom' ? 'custom' : fallback.preset;
  const resolution = typeof v.resolutionScale === 'number' && Number.isFinite(v.resolutionScale)
    ? Math.round(Math.max(0.55, Math.min(1.15, v.resolutionScale)) * 20) / 20
    : fallback.resolutionScale;
  const next: GraphicsSettings = {
    preset,
    resolutionScale: resolution,
    shadows: isOneOf(v.shadows, SHADOWS) ? v.shadows : fallback.shadows,
    vegetation: isOneOf(v.vegetation, VEGETATION) ? v.vegetation : fallback.vegetation,
    particles: isOneOf(v.particles, PARTICLES) ? v.particles : fallback.particles,
    atmosphere: isOneOf(v.atmosphere, ATMOSPHERE) ? v.atmosphere : fallback.atmosphere,
    distantWar: typeof v.distantWar === 'boolean' ? v.distantWar : fallback.distantWar,
  };
  if (preset !== 'custom') {
    const expected = GRAPHICS_PRESETS[preset];
    if (Object.keys(expected).every(k =>
      next[k as keyof QualityValues] === expected[k as keyof QualityValues])) {
      return withGraphicsPreset(preset);
    }
    next.preset = 'custom';
  }
  return next;
}

export function readGraphicsSettings(storage?: Pick<Storage, 'getItem'> | null): GraphicsSettings {
  const fallback = defaultGraphicsSettings();
  try {
    const source = storage === undefined
      ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
    const raw = source?.getItem(GRAPHICS_STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as { version?: number; settings?: unknown };
    return stored.version === 1 ? sanitizeGraphicsSettings(stored.settings, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function saveGraphicsSettings(settings: GraphicsSettings): void {
  try {
    localStorage.setItem(GRAPHICS_STORAGE_KEY,
      JSON.stringify({ version: 1, settings: sanitizeGraphicsSettings(settings) }));
  } catch {
    // Browsers with blocked storage still allow graphics changes in this session.
  }
}

export function changeGraphicsSetting<K extends keyof QualityValues>(
  current: GraphicsSettings, key: K, value: QualityValues[K],
): GraphicsSettings {
  return sanitizeGraphicsSettings({ ...current, [key]: value, preset: 'custom' }, current);
}

export interface GraphicsRuntime {
  dpr: number;
  renderScale: number;
  shadowEnabled: boolean;
  shadowMapSize: number;
  minimalVegetation: boolean;
  reducedVegetation: boolean;
  reducedParticles: boolean;
  atmosphereEnabled: boolean;
  fullAtmosphere: boolean;
  distantWar: boolean;
}

/** Computation is pure so CI can verify that quality controls affect GPU work. */
export function resolveGraphicsRuntime(
  settings: GraphicsSettings, nativeDpr: number, isSoftwareGl: boolean,
): GraphicsRuntime {
  const dprBase = Number.isFinite(nativeDpr) && nativeDpr > 0 ? nativeDpr : 1;
  const maxDpr = isSoftwareGl ? 1 : 2;
  const dpr = Math.round(Math.max(0.5,
    Math.min(maxDpr, Math.min(maxDpr, dprBase) * settings.resolutionScale)) * 100) / 100;
  const mapSizes: Record<ShadowQuality, number> = {
    off: 0, low: 1024, high: 2048, ultra: 3072,
  };
  return {
    dpr,
    renderScale: settings.resolutionScale,
    shadowEnabled: settings.shadows !== 'off',
    shadowMapSize: settings.shadows === 'off' ? 0
      : Math.min(mapSizes[settings.shadows], isSoftwareGl ? 1024 : 3072),
    minimalVegetation: settings.vegetation === 'minimal',
    reducedVegetation: settings.vegetation !== 'full',
    reducedParticles: settings.particles === 'reduced',
    atmosphereEnabled: settings.atmosphere !== 'off',
    fullAtmosphere: settings.atmosphere === 'full',
    distantWar: settings.distantWar,
  };
}
