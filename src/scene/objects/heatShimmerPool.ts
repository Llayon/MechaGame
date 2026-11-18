export const MAX_HEAT_SHIMMER_SLOTS = 48;

export interface HeatShimmerSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  width: number;
  height: number;
  intensity: number;
  age: number;
  maxAge: number;
  seed: number;
  riseSpeed: number;
  warmTint: number;
}

export interface HeatShimmerPoolState {
  slots: HeatShimmerSlot[];
  cursor: number;
  activeCount: number;
  dirty: boolean;
}

export interface SpawnHeatShimmerOptions {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  width?: number;
  height?: number;
  intensity?: number;
  maxAge?: number;
  seed?: number;
  riseSpeed?: number;
  warmTint?: number;
}

export interface HeatShimmerRenderData {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  lifeNorm: number;
  alpha: number;
  seed: number;
  riseSpeed: number;
  warmTint: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createHeatShimmerPool(
  capacity = MAX_HEAT_SHIMMER_SLOTS,
): HeatShimmerPoolState {
  return {
    slots: Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 1.4,
      vz: 0,
      width: 1.0,
      height: 1.8,
      intensity: 0.7,
      age: 0,
      maxAge: 1.4,
      seed: 0.5,
      riseSpeed: 1.0,
      warmTint: 0.4,
    })),
    cursor: 0,
    activeCount: 0,
    dirty: false,
  };
}

export function resetHeatShimmerPool(pool: HeatShimmerPoolState): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
    pool.slots[i].age = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
  pool.dirty = true;
}

export function spawnHeatShimmer(
  pool: HeatShimmerPoolState,
  opts: SpawnHeatShimmerOptions,
): boolean {
  const capacity = pool.slots.length;
  if (capacity === 0) return false;
  if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y) || !Number.isFinite(opts.z)) {
    return false;
  }

  const idx = pool.cursor % capacity;
  pool.cursor = (pool.cursor + 1) % capacity;

  const slot = pool.slots[idx];
  const wasActive = slot.active;

  slot.active = true;
  slot.x = opts.x;
  slot.y = opts.y;
  slot.z = opts.z;
  slot.vx = opts.vx ?? 0;
  slot.vy = opts.vy ?? 1.45;
  slot.vz = opts.vz ?? 0;
  slot.width = Math.max(0.25, opts.width ?? 1.1);
  slot.height = Math.max(0.35, opts.height ?? 2.0);
  slot.intensity = clamp(opts.intensity ?? 0.75, 0.1, 1.5);
  slot.age = 0;
  slot.maxAge = Math.max(0.18, opts.maxAge ?? 1.35);

  const rawSeed =
    opts.seed ??
    Math.abs(Math.sin(opts.x * 17.13 + opts.y * 53.71 + opts.z * 29.43));
  slot.seed = rawSeed - Math.floor(rawSeed);
  slot.riseSpeed = clamp(opts.riseSpeed ?? 1.0, 0.3, 3.0);
  slot.warmTint = clamp(opts.warmTint ?? 0.45, 0, 1);

  if (!wasActive) {
    pool.activeCount += 1;
  }
  pool.dirty = true;
  return true;
}

export function stepHeatShimmerPool(
  pool: HeatShimmerPoolState,
  rawDt: number,
): number {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return pool.activeCount;

  let active = 0;
  let changed = false;
  const drag = Math.max(0, 1 - dt * 1.6);

  for (let i = 0; i < pool.slots.length; i++) {
    const s = pool.slots[i];
    if (!s.active) continue;

    s.age += dt;
    changed = true;
    if (s.age >= s.maxAge) {
      s.active = false;
      continue;
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.vx *= drag;
    s.vz *= drag;
    active++;
  }

  pool.activeCount = active;
  if (changed) pool.dirty = true;
  return active;
}

export function computeHeatShimmerRenderData(
  slot: HeatShimmerSlot,
  out: HeatShimmerRenderData,
): boolean {
  if (!slot.active || slot.age >= slot.maxAge) return false;

  const lifeNorm = clamp(slot.age / Math.max(0.05, slot.maxAge), 0, 1);
  const fadeIn = smoothstep(0.0, 0.16, lifeNorm);
  const fadeOut = 1.0 - smoothstep(0.36, 1.0, lifeNorm);
  const alpha = clamp(slot.intensity * fadeIn * fadeOut, 0, 1);
  if (alpha <= 0.002) return false;

  out.x = slot.x;
  out.y = slot.y;
  out.z = slot.z;
  out.scaleX = slot.width * (0.85 + lifeNorm * 0.52);
  out.scaleY = slot.height * (0.88 + lifeNorm * 0.42);
  out.lifeNorm = lifeNorm;
  out.alpha = alpha;
  out.seed = slot.seed;
  out.riseSpeed = slot.riseSpeed;
  out.warmTint = slot.warmTint;
  return true;
}
