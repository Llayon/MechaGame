import type { GraphicsSettings } from '../game/graphicsSettings';

export const MAX_ADAPTIVE_STEP = 5;

export function effectiveGraphics(settings: GraphicsSettings, step: number): GraphicsSettings {
  if (!settings.autoQuality || step === 0) return settings;
  return {
    ...settings,
    resolutionScale: Math.max(0.55, settings.resolutionScale * 0.82),
    vegetation: step < 4 ? settings.vegetation : settings.vegetation === 'full' ? 'reduced' : 'minimal',
    particles: step >= 5 ? 'reduced' : settings.particles,
  };
}

/** Long windows prevent switchbacks from shader compilation or a single expensive frame. */
export class AdaptiveFrameWindow {
  private time = 0;
  private frames = 0;
  private fastWindows = 0;
  private slowWindows = 0;

  reset() {
    this.time = this.frames = this.fastWindows = this.slowWindows = 0;
  }

  sample(delta: number, target: number, step: number): number {
    if (!Number.isFinite(delta) || delta <= 0 || delta > 1) {
      this.reset();
      return step;
    }
    this.time += delta;
    this.frames++;
    if (this.time < 2) return step;
    const ratio = this.time * target / this.frames;
    this.time = this.frames = 0;
    this.slowWindows = ratio > 1.15 ? this.slowWindows + 1 : 0;
    this.fastWindows = ratio < 1.025 ? this.fastWindows + 1 : 0;
    if (this.slowWindows < 3 && this.fastWindows < 12) return step;
    const next = this.slowWindows >= 3 ? Math.min(MAX_ADAPTIVE_STEP, step + 1) : Math.max(0, step - 1);
    this.reset();
    return next;
  }
}
