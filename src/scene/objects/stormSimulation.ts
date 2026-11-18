import type { LightingPreset } from '../../map/sectors';

export const MAX_STORM_LAYERS = 4;

export interface StormLayerSpec {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  width: number;
  height: number;
  depthWeight: number;
  phase: number;
}

export const STORM_LAYER_SPECS: readonly StormLayerSpec[] = [
  {
    offsetX: 0,
    offsetY: 0,
    offsetZ: -32,
    width: 680,
    height: 235,
    depthWeight: 0.28,
    phase: 0.0,
  },
  {
    offsetX: -52,
    offsetY: 14,
    offsetZ: -12,
    width: 560,
    height: 215,
    depthWeight: 0.56,
    phase: 1.75,
  },
  {
    offsetX: 28,
    offsetY: -4,
    offsetZ: 10,
    width: 510,
    height: 196,
    depthWeight: 0.88,
    phase: 3.45,
  },
  {
    offsetX: -14,
    offsetY: -8,
    offsetZ: 28,
    width: 590,
    height: 132,
    depthWeight: 1.0,
    phase: 5.15,
  },
];

export interface StormPresetConfig {
  cloudTopColor: string;
  cloudBaseColor: string;
  rimColor: string;
  horizonHazeColor: string;
  flashColor: string;
  boltColor: string;
  cloudOpacity: number;
  hazeStrength: number;
  flashGain: number;
  boltGain: number;
  minIntervalSec: number;
  maxIntervalSec: number;
  initialDelaySec: number;
}

export const STORM_PRESETS: Readonly<Record<LightingPreset, StormPresetConfig>> = {
  day: {
    cloudTopColor: '#6E8299',
    cloudBaseColor: '#3B4859',
    rimColor: '#C5D8EB',
    horizonHazeColor: '#98BEE3',
    flashColor: '#DCEEFF',
    boltColor: '#B8E0FF',
    cloudOpacity: 0.44,
    hazeStrength: 0.62,
    flashGain: 0.48,
    boltGain: 0.42,
    minIntervalSec: 15.0,
    maxIntervalSec: 21.0,
    initialDelaySec: 6.5,
  },
  dusk: {
    cloudTopColor: '#4A4E5E',
    cloudBaseColor: '#2A2E3B',
    rimColor: '#D6895E',
    horizonHazeColor: '#7E716B',
    flashColor: '#DCEBFF',
    boltColor: '#A6D7FF',
    cloudOpacity: 0.68,
    hazeStrength: 0.58,
    flashGain: 1.02,
    boltGain: 1.15,
    minIntervalSec: 10.5,
    maxIntervalSec: 16.0,
    initialDelaySec: 4.0,
  },
  night: {
    cloudTopColor: '#162030',
    cloudBaseColor: '#090E17',
    rimColor: '#344D6B',
    horizonHazeColor: '#0B1420',
    flashColor: '#C8E2FF',
    boltColor: '#98CFFF',
    cloudOpacity: 0.92,
    hazeStrength: 0.36,
    flashGain: 1.32,
    boltGain: 1.48,
    minIntervalSec: 7.5,
    maxIntervalSec: 13.0,
    initialDelaySec: 2.8,
  },
};

export interface StormSimulationState {
  rngState: number;
  cooldownTimer: number;
  flashElapsed: number;
  flashDuration: number;
  flashIntensity: number;
  boltIntensity: number;
  flashX: number;
  flashY: number;
  boltSeed: number;
  thunderDelayTimer: number;
  thunderPending: boolean;
}

function nextStormRand(state: StormSimulationState): number {
  let x = (state.rngState | 0) || 0x2f6e2b1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x;
  return (x >>> 0) / 4294967296;
}

export function createStormSimulation(
  lightingPreset: LightingPreset = 'dusk',
  seed = 0x51a7c93,
): StormSimulationState {
  const preset = STORM_PRESETS[lightingPreset];
  return {
    rngState: seed | 0,
    cooldownTimer: preset.initialDelaySec,
    flashElapsed: 0,
    flashDuration: 0,
    flashIntensity: 0,
    boltIntensity: 0,
    flashX: 0.06,
    flashY: 0.48,
    boltSeed: 1.7,
    thunderDelayTimer: 0,
    thunderPending: false,
  };
}

export function resetStormSimulation(
  state: StormSimulationState,
  lightingPreset: LightingPreset,
): void {
  const preset = STORM_PRESETS[lightingPreset];
  state.cooldownTimer = preset.initialDelaySec;
  state.flashElapsed = 0;
  state.flashDuration = 0;
  state.flashIntensity = 0;
  state.boltIntensity = 0;
  state.thunderDelayTimer = 0;
  state.thunderPending = false;
}

/**
 * Evaluates a realistic multi-restrike lightning strobe envelope for normalized flash age [0..1].
 * Returns both cloud sheet-scatter intensity and crisp forked bolt intensity.
 */
export function evaluateLightningEnvelope(u: number): {
  cloudGlow: number;
  boltGlow: number;
} {
  if (u <= 0 || u >= 1) return { cloudGlow: 0, boltGlow: 0 };

  // Primary strike + rapid restrike + minor flicker + lingering sheet-lightning decay
  let boltGlow = 0;
  if (u < 0.08) {
    boltGlow = Math.sin((u / 0.08) * Math.PI * 0.5);
  } else if (u < 0.16) {
    boltGlow = 0.24 + 0.76 * (1 - (u - 0.08) / 0.08);
  } else if (u < 0.26) {
    const p = (u - 0.16) / 0.10;
    boltGlow = 0.22 + 0.72 * Math.sin(p * Math.PI);
  } else if (u < 0.36) {
    const p = (u - 0.26) / 0.10;
    boltGlow = 0.14 + 0.38 * Math.sin(p * Math.PI);
  } else {
    boltGlow = 0.14 * Math.pow(1 - (u - 0.36) / 0.64, 2.2);
  }

  // Cloud interior scatters light slightly broader & lingers across the tail
  const decayTail = u < 0.28 ? 1.0 : Math.pow(Math.max(0, 1 - (u - 0.28) / 0.72), 1.65);
  const cloudGlow = Math.min(1.0, Math.max(boltGlow * 0.92, decayTail * 0.62));
  return { cloudGlow, boltGlow };
}

export function triggerStormStrike(
  state: StormSimulationState,
  lightingPreset: LightingPreset,
): void {
  const preset = STORM_PRESETS[lightingPreset];
  const r1 = nextStormRand(state);
  const r2 = nextStormRand(state);
  const r3 = nextStormRand(state);
  const r4 = nextStormRand(state);

  state.flashX = (r1 - 0.5) * 0.56;
  state.flashY = 0.36 + r2 * 0.34;
  state.boltSeed = 1.0 + r3 * 89.0;
  state.flashDuration = 0.44 + r4 * 0.18;
  state.flashElapsed = 0.001;

  const span = preset.maxIntervalSec - preset.minIntervalSec;
  state.cooldownTimer = preset.minIntervalSec + nextStormRand(state) * span;

  state.thunderPending = true;
  state.thunderDelayTimer = 1.35 + nextStormRand(state) * 0.85;

  const env = evaluateLightningEnvelope(state.flashElapsed / state.flashDuration);
  state.flashIntensity = env.cloudGlow;
  state.boltIntensity = env.boltGlow;
}

export interface StormStepResult {
  strikeStarted: boolean;
  thunderTriggered: boolean;
}

export function stepStormSimulation(
  state: StormSimulationState,
  dt: number,
  lightingPreset: LightingPreset,
): StormStepResult {
  const result: StormStepResult = {
    strikeStarted: false,
    thunderTriggered: false,
  };
  if (dt <= 0) return result;

  if (state.flashDuration > 0 && state.flashElapsed < state.flashDuration) {
    state.flashElapsed += dt;
    const u = state.flashElapsed / state.flashDuration;
    if (u >= 1) {
      state.flashElapsed = 0;
      state.flashDuration = 0;
      state.flashIntensity = 0;
      state.boltIntensity = 0;
    } else {
      const env = evaluateLightningEnvelope(u);
      state.flashIntensity = env.cloudGlow;
      state.boltIntensity = env.boltGlow;
    }
  } else {
    state.flashIntensity = 0;
    state.boltIntensity = 0;
  }

  state.cooldownTimer -= dt;
  if (state.cooldownTimer <= 0) {
    triggerStormStrike(state, lightingPreset);
    result.strikeStarted = true;
  }

  if (state.thunderPending) {
    state.thunderDelayTimer -= dt;
    if (state.thunderDelayTimer <= 0) {
      state.thunderPending = false;
      state.thunderDelayTimer = 0;
      result.thunderTriggered = true;
    }
  }

  return result;
}
