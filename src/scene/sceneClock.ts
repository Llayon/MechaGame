/** Shared deterministic scene time. Never advance gameplay time while paused. */
export interface SceneClock {
  elapsed: number;
  ticks: number;
}

/**
 * Bound simulation advancement after slow frames and tab resuming; ignore invalid deltas.
 * All scene systems read the same clock so no state.clock wall-time jump can occur.
 */
export function advanceSceneClock(clock: SceneClock, rawDelta: number, paused: boolean): number {
  if (!paused && Number.isFinite(rawDelta) && rawDelta > 0) {
    clock.elapsed += Math.min(rawDelta, 0.05);
    clock.ticks++;
  }
  return clock.elapsed;
}
