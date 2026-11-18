export const MAX_MUZZLE_FLASHES = 40;

export interface MuzzleFlashSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  roll: number;
  scaleXZ: number;
  scaleZ: number;
  age: number;
  maxAge: number;
  seed: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
}

export interface MuzzleFlashPoolState {
  slots: MuzzleFlashSlot[];
  cursor: number;
  activeCount: number;
  randState: number;
  dirty: boolean;
}

export interface SpawnMuzzleFlashOptions {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  scaleXZ?: number;
  scaleZ?: number;
  duration?: number;
  r?: number;
  g?: number;
  b?: number;
  intensity?: number;
}

export interface MuzzleFlashRenderData {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  roll: number;
  scaleXZ: number;
  scaleZ: number;
  lifeNorm: number;
  seed: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
}

function nextFlashRand(pool: MuzzleFlashPoolState): number {
  pool.randState = (Math.imul(pool.randState, 1664525) + 1013904223) >>> 0;
  return pool.randState / 4294967296;
}

function createEmptySlot(): MuzzleFlashSlot {
  return {
    active: false,
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: 0,
    dz: 1,
    roll: 0,
    scaleXZ: 1,
    scaleZ: 1,
    age: 0,
    maxAge: 0.055,
    seed: 0,
    r: 1.0,
    g: 0.68,
    b: 0.22,
    intensity: 1.25,
  };
}

export function createMuzzleFlashPool(
  capacity = MAX_MUZZLE_FLASHES,
): MuzzleFlashPoolState {
  return {
    slots: Array.from({ length: capacity }, createEmptySlot),
    cursor: 0,
    activeCount: 0,
    randState: 0x51a7f90d,
    dirty: false,
  };
}

export function resetMuzzleFlashPool(pool: MuzzleFlashPoolState): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
    pool.slots[i].age = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
  pool.dirty = true;
}

export function spawnMuzzleFlash(
  pool: MuzzleFlashPoolState,
  opts: SpawnMuzzleFlashOptions,
): number {
  const capacity = pool.slots.length;
  if (capacity === 0) return -1;

  const idx = pool.cursor;
  pool.cursor = (pool.cursor + 1) % capacity;
  const slot = pool.slots[idx];
  const wasActive = slot.active;

  const dirLen = Math.hypot(opts.dx, opts.dy, opts.dz);
  const invLen = dirLen > 1e-5 ? 1 / dirLen : 0;

  const roll = nextFlashRand(pool) * Math.PI * 2;
  const widthJitter = 0.84 + nextFlashRand(pool) * 0.36;
  const lengthJitter = 0.88 + nextFlashRand(pool) * 0.28;
  const seed = nextFlashRand(pool);

  slot.active = true;
  slot.x = opts.x;
  slot.y = opts.y;
  slot.z = opts.z;
  slot.dx = invLen > 0 ? opts.dx * invLen : 0;
  slot.dy = invLen > 0 ? opts.dy * invLen : 0;
  slot.dz = invLen > 0 ? opts.dz * invLen : 1;
  slot.roll = roll;
  slot.scaleXZ = (opts.scaleXZ ?? 1.0) * widthJitter;
  slot.scaleZ = (opts.scaleZ ?? 1.0) * lengthJitter;
  slot.age = 0;
  slot.maxAge = Math.max(0.02, opts.duration ?? 0.055);
  slot.seed = seed;
  slot.r = opts.r ?? 1.0;
  slot.g = opts.g ?? 0.68;
  slot.b = opts.b ?? 0.22;
  slot.intensity = opts.intensity ?? 1.25;

  if (!wasActive) {
    pool.activeCount += 1;
  }
  pool.dirty = true;
  return idx;
}

export function stepMuzzleFlashPool(
  pool: MuzzleFlashPoolState,
  dt: number,
): number {
  if (dt <= 0) return pool.activeCount;
  let activeCount = 0;
  for (let i = 0; i < pool.slots.length; i++) {
    const slot = pool.slots[i];
    if (!slot.active) continue;
    slot.age += dt;
    if (slot.age >= slot.maxAge) {
      slot.active = false;
      continue;
    }
    activeCount++;
  }
  pool.activeCount = activeCount;
  return activeCount;
}

export function computeMuzzleFlashRenderData(
  slot: Readonly<MuzzleFlashSlot>,
  out: MuzzleFlashRenderData,
): boolean {
  if (!slot.active || slot.age >= slot.maxAge) {
    return false;
  }

  const lifeNorm = Math.max(0, Math.min(1, slot.age / slot.maxAge));
  // Rapid initial blast expansion followed by gentle tail contraction before cutoff
  const pop =
    (0.84 + 0.26 * Math.sin(Math.min(1, lifeNorm * 2.4) * Math.PI * 0.5)) *
    (1 - lifeNorm * 0.24);

  out.x = slot.x;
  out.y = slot.y;
  out.z = slot.z;
  out.dx = slot.dx;
  out.dy = slot.dy;
  out.dz = slot.dz;
  out.roll = slot.roll;
  out.scaleXZ = slot.scaleXZ * pop;
  out.scaleZ = slot.scaleZ * pop;
  out.lifeNorm = lifeNorm;
  out.seed = slot.seed;
  out.r = slot.r;
  out.g = slot.g;
  out.b = slot.b;
  out.intensity = slot.intensity;
  return true;
}
