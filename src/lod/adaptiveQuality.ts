import { MIN_RESOLUTION_SCALE, type GraphicsSettings } from '../game/graphicsSettings';

export const MIN_DRS_SCALE = MIN_RESOLUTION_SCALE;
export const DRS_QUANTUM = 0.05;
export const MAX_CASCADE_STEP = 4;
/** Kept exported for callers expecting the legacy step ceiling name. */
export const MAX_ADAPTIVE_STEP = MAX_CASCADE_STEP;

export const DRS_WINDOW_SECONDS = 1.0;
export const DRS_SLOW_RATIO = 1.12;
export const DRS_FAST_RATIO = 0.92;
export const DRS_BAD_WINDOWS_REQUIRED = 2;
export const DRS_INITIAL_RECOVERY_WAIT = 4;
export const DRS_MAX_RECOVERY_WAIT = 60;
export const DRS_CONTEXT_LOST_CAP = 0.7;
export const DRS_STORAGE_KEY = 'mech-drs-v1';

/**
 * Pure render-only adaptive state for the unified two-phase cascade:
 * Phase 1 smoothly adjusts `drsScale` from `settings.resolutionScale` down to `MIN_DRS_SCALE`.
 * Phase 2 (`cascadeStep` 1..4) progressively reduces shadows -> object LOD -> vegetation -> particles
 * only after DRS hits the floor or detects a CPU/draw-call bottleneck.
 */
export interface AdaptiveState {
  drsScale: number;
  cascadeStep: number;
  recoveryWait: number;
  contextLostFallback: boolean;
}

interface PersistedDrsRecord {
  version: 1;
  signature: string;
  drsScale: number;
  cascadeStep: number;
  contextLostFallback: boolean;
}

export function quantizeDrsScale(scale: number, maxScale: number): number {
  const upper = Math.max(MIN_DRS_SCALE, Number.isFinite(maxScale) ? maxScale : 1);
  const clamped = Number.isFinite(scale)
    ? Math.max(MIN_DRS_SCALE, Math.min(upper, scale))
    : upper;
  const snapped = Math.round(clamped / DRS_QUANTUM) * DRS_QUANTUM;
  return Math.round(Math.max(MIN_DRS_SCALE, Math.min(upper, snapped)) * 100) / 100;
}

export function createInitialAdaptiveState(settings: GraphicsSettings): AdaptiveState {
  return {
    drsScale: quantizeDrsScale(settings.resolutionScale, settings.resolutionScale),
    cascadeStep: 0,
    recoveryWait: DRS_INITIAL_RECOVERY_WAIT,
    contextLostFallback: false,
  };
}

export function isAdaptiveDegraded(state: AdaptiveState, settings: GraphicsSettings): boolean {
  const base = quantizeDrsScale(settings.resolutionScale, settings.resolutionScale);
  return state.drsScale < base - 1e-4 || state.cascadeStep > 0 || state.contextLostFallback;
}

export function drsSignature(settings: GraphicsSettings): string {
  return [
    settings.preset,
    settings.targetFps,
    settings.resolutionScale.toFixed(2),
    settings.shadows,
    settings.objectDetail,
    settings.vegetation,
    settings.particles,
    settings.atmosphere,
    settings.distantWar ? '1' : '0',
  ].join('|');
}

export function readPersistedDrs(
  settings: GraphicsSettings,
  storage?: Pick<Storage, 'getItem'> | null,
): AdaptiveState | null {
  try {
    const source = storage === undefined
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : storage;
    const raw = source?.getItem(DRS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDrsRecord>;
    if (parsed.version !== 1 || parsed.signature !== drsSignature(settings)) return null;
    if (typeof parsed.drsScale !== 'number' || !Number.isFinite(parsed.drsScale)) return null;
    const drsScale = quantizeDrsScale(parsed.drsScale, settings.resolutionScale);
    const cascadeStep = typeof parsed.cascadeStep === 'number' && Number.isFinite(parsed.cascadeStep)
      ? Math.max(0, Math.min(MAX_CASCADE_STEP, Math.round(parsed.cascadeStep)))
      : 0;
    const contextLostFallback = Boolean(parsed.contextLostFallback);
    const state: AdaptiveState = {
      drsScale,
      cascadeStep,
      recoveryWait: contextLostFallback ? 16 : DRS_INITIAL_RECOVERY_WAIT,
      contextLostFallback,
    };
    return isAdaptiveDegraded(state, settings) ? state : null;
  } catch {
    return null;
  }
}

export function clearPersistedDrs(
  storage?: Pick<Storage, 'removeItem'> | null,
): void {
  try {
    const target = storage === undefined
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : storage;
    target?.removeItem(DRS_STORAGE_KEY);
  } catch {
    // Blocked storage still allows in-session DRS operation.
  }
}

export function savePersistedDrs(
  settings: GraphicsSettings,
  state: AdaptiveState,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  try {
    const target = storage === undefined
      ? (typeof localStorage !== 'undefined' ? localStorage : null)
      : storage;
    if (!target) return;
    if (!isAdaptiveDegraded(state, settings)) {
      target.removeItem(DRS_STORAGE_KEY);
      return;
    }
    const payload: PersistedDrsRecord = {
      version: 1,
      signature: drsSignature(settings),
      drsScale: quantizeDrsScale(state.drsScale, settings.resolutionScale),
      cascadeStep: Math.max(0, Math.min(MAX_CASCADE_STEP, Math.round(state.cascadeStep))),
      contextLostFallback: state.contextLostFallback,
    };
    target.setItem(DRS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Blocked storage still allows in-session DRS operation.
  }
}

export function applyContextLostFallback(
  current: AdaptiveState,
  settings: GraphicsSettings,
): AdaptiveState {
  const cap = quantizeDrsScale(
    Math.min(current.drsScale, Math.min(settings.resolutionScale, DRS_CONTEXT_LOST_CAP)),
    settings.resolutionScale,
  );
  return {
    drsScale: cap,
    cascadeStep: current.cascadeStep,
    recoveryWait: Math.min(DRS_MAX_RECOVERY_WAIT, Math.max(16, current.recoveryWait * 2)),
    contextLostFallback: true,
  };
}

export function effectiveGraphics(
  settings: GraphicsSettings,
  adaptation: AdaptiveState | number,
): GraphicsSettings {
  if (!settings.autoQuality) return settings;
  if (typeof adaptation === 'number') {
    if (adaptation <= 0) return settings;
    return {
      ...settings,
      resolutionScale: quantizeDrsScale(settings.resolutionScale * 0.82, settings.resolutionScale),
      vegetation: adaptation < 3 ? settings.vegetation : settings.vegetation === 'full' ? 'reduced' : 'minimal',
      particles: adaptation >= 4 ? 'reduced' : settings.particles,
    };
  }
  const drsScale = quantizeDrsScale(adaptation.drsScale, settings.resolutionScale);
  const step = Math.max(0, Math.min(MAX_CASCADE_STEP, Math.round(adaptation.cascadeStep)));
  if (Math.abs(drsScale - settings.resolutionScale) < 1e-4 && step === 0) return settings;
  return {
    ...settings,
    resolutionScale: drsScale,
    vegetation: step < 3 ? settings.vegetation : settings.vegetation === 'full' ? 'reduced' : 'minimal',
    particles: step >= 4 ? 'reduced' : settings.particles,
  };
}

/**
 * Outlier-resistant Dynamic Resolution Scaling & cascade controller.
 * Collects ~1s frame windows, discards the single worst frame per window (GC/shader spikes),
 * steps down proportionally after 2 consecutive slow windows, detects CPU bottlenecks,
 * and recovers in strict reverse order with exponential backoff hysteresis.
 */
export class AdaptiveDrsController {
  private windowTime = 0;
  private windowFrames = 0;
  private windowMaxDelta = 0;
  private badWindows = 0;
  private goodWindows = 0;
  private lastDrsDropAvg: number | null = null;
  private drsDropsWithoutGain = 0;

  /** Drops only the in-progress frame window (e.g. pause, hidden tab, or >1s glitch). */
  resetWindow(): void {
    this.windowTime = 0;
    this.windowFrames = 0;
    this.windowMaxDelta = 0;
  }

  /** Full reset for settings changes or manual calibration reset. */
  resetAll(): void {
    this.resetWindow();
    this.badWindows = 0;
    this.goodWindows = 0;
    this.lastDrsDropAvg = null;
    this.drsDropsWithoutGain = 0;
  }

  sample(
    delta: number,
    targetFps: number,
    baseScale: number,
    current: AdaptiveState,
  ): AdaptiveState {
    if (!Number.isFinite(delta) || delta <= 0 || delta >= 1.0) {
      this.resetWindow();
      return current;
    }

    this.windowTime += delta;
    this.windowFrames++;
    if (delta > this.windowMaxDelta) this.windowMaxDelta = delta;

    if (this.windowTime < DRS_WINDOW_SECONDS || this.windowFrames < 2) {
      return current;
    }

    // Discard the single longest frame in the window so one-off GC/shader hitches never trigger drops.
    const trimmedAvg = (this.windowTime - this.windowMaxDelta) / (this.windowFrames - 1);
    this.resetWindow();

    const targetFrame = 1 / Math.max(15, targetFps);
    const ratio = trimmedAvg / targetFrame;
    const upperScale = quantizeDrsScale(baseScale, baseScale);
    const activeScale = quantizeDrsScale(current.drsScale, upperScale);
    const activeStep = Math.max(0, Math.min(MAX_CASCADE_STEP, Math.round(current.cascadeStep)));
    const wait = Math.max(DRS_INITIAL_RECOVERY_WAIT, Math.min(DRS_MAX_RECOVERY_WAIT, current.recoveryWait));

    // Slow window: accumulate toward 2 consecutive slow windows.
    if (ratio > DRS_SLOW_RATIO) {
      this.badWindows++;
      this.goodWindows = 0;
      if (this.badWindows < DRS_BAD_WINDOWS_REQUIRED) return current;
      this.badWindows = 0;

      // Track whether previous DRS reductions actually improved frame time.
      if (this.lastDrsDropAvg !== null) {
        if (trimmedAvg >= this.lastDrsDropAvg * 0.96) {
          this.drsDropsWithoutGain++;
        } else {
          this.drsDropsWithoutGain = 0;
        }
      }

      const wasAtBase = activeScale >= upperScale - 1e-4 && activeStep === 0;
      const nextWait = wasAtBase
        ? Math.max(DRS_INITIAL_RECOVERY_WAIT, wait)
        : Math.min(DRS_MAX_RECOVERY_WAIT, Math.max(DRS_INITIAL_RECOVERY_WAIT, wait * 2));

      const cpuBound = this.drsDropsWithoutGain >= 2;
      const canDropDrs = activeScale > MIN_DRS_SCALE + 1e-4;
      const canEscalateCascade = activeStep < MAX_CASCADE_STEP;

      // Phase 1: Proportional DRS drop while GPU fill-rate bound and above floor.
      if (canDropDrs && (!cpuBound || !canEscalateCascade)) {
        const rawFactor = Math.sqrt(1 / ratio);
        const clampedFactor = Math.max(0.75, Math.min(0.95, rawFactor));
        const candidate = quantizeDrsScale(activeScale * clampedFactor, upperScale);
        const nextScale = quantizeDrsScale(Math.min(activeScale - DRS_QUANTUM, candidate), upperScale);
        this.lastDrsDropAvg = trimmedAvg;
        if (Math.abs(nextScale - activeScale) < 1e-4 && nextWait === wait) return current;
        return {
          drsScale: nextScale,
          cascadeStep: activeStep,
          recoveryWait: nextWait,
          contextLostFallback: current.contextLostFallback,
        };
      }

      // Phase 2: Escalate to LOD / shadow / vegetation / particle reductions.
      if (canEscalateCascade) {
        this.lastDrsDropAvg = null;
        return {
          drsScale: activeScale,
          cascadeStep: activeStep + 1,
          recoveryWait: nextWait,
          contextLostFallback: current.contextLostFallback,
        };
      }

      // Already at absolute floor — still update backoff if it grew.
      if (nextWait !== wait) {
        return { ...current, recoveryWait: nextWait };
      }
      return current;
    }

    // Fast window with clear headroom: count toward exponential backoff recovery.
    if (ratio < DRS_FAST_RATIO) {
      this.goodWindows++;
      this.badWindows = 0;

      const atBase = activeScale >= upperScale - 1e-4 && activeStep === 0;
      if (atBase) {
        // Only relax recoveryWait back to baseline after sustained stability at full quality.
        if (this.goodWindows >= wait && (wait > DRS_INITIAL_RECOVERY_WAIT || current.contextLostFallback)) {
          this.goodWindows = 0;
          this.lastDrsDropAvg = null;
          this.drsDropsWithoutGain = 0;
          return {
            drsScale: upperScale,
            cascadeStep: 0,
            recoveryWait: DRS_INITIAL_RECOVERY_WAIT,
            contextLostFallback: false,
          };
        }
        return current;
      }

      if (this.goodWindows < wait) return current;
      this.goodWindows = 0;
      this.lastDrsDropAvg = null;
      this.drsDropsWithoutGain = 0;

      // Strict reverse order: restore Phase 2 effects before raising resolution scale.
      if (activeStep > 0) {
        return {
          drsScale: activeScale,
          cascadeStep: activeStep - 1,
          recoveryWait: wait,
          contextLostFallback: current.contextLostFallback,
        };
      }

      const stepUp = ratio < 0.68 ? DRS_QUANTUM * 2 : DRS_QUANTUM;
      const nextScale = quantizeDrsScale(activeScale + stepUp, upperScale);
      const reachedBase = nextScale >= upperScale - 1e-4;
      // Double backoff if we previously had repeated drops? Keep current wait until stable at base.
      return {
        drsScale: nextScale,
        cascadeStep: 0,
        recoveryWait: wait,
        contextLostFallback: reachedBase ? false : current.contextLostFallback,
      };
    }

    // Deadband [0.92 .. 1.12]: hold steady with zero oscillation.
    this.badWindows = 0;
    this.goodWindows = 0;
    return current;
  }
}
