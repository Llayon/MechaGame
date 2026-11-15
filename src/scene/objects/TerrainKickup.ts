export const KICKUP_POOL_SIZE = 40;
export const KICKUP_GRAVITY = 15.8;

export interface PebbleSlot {
  active: boolean;
  x0: number;
  y0: number;
  z0: number;
  vx: number;
  vy: number;
  vz: number;
  groundY: number;
  t: number;
  maxLife: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  sx: number;
  sy: number;
  sz: number;
}

export interface KickupPool {
  slots: PebbleSlot[];
  cursor: number;
  activeCount: number;
}

export interface PebbleTransform {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
}

export function createKickupPool(capacity = KICKUP_POOL_SIZE): KickupPool {
  const slots: PebbleSlot[] = [];
  for (let i = 0; i < capacity; i++) {
    slots.push({
      active: false,
      x0: 0,
      y0: 0,
      z0: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      groundY: 0,
      t: 0,
      maxLife: 0.65,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
      sx: 1,
      sy: 1,
      sz: 1,
    });
  }
  return { slots, cursor: 0, activeCount: 0 };
}

export function resetKickupPool(pool: KickupPool): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
    pool.slots[i].t = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
}

export interface KickupBurstOptions {
  originX: number;
  originY: number;
  originZ: number;
  /** Normalized horizontal throw direction (typically backward opposite mech movement). */
  dirX: number;
  dirZ: number;
  groundY: number;
  count: number;
  speedScale?: number;
  coneSpreadRad?: number;
  rng?: () => number;
}

/**
 * Emit a burst of low-poly gravel chunks into the fixed ring-buffer pool.
 * Uses pure parabolic flight y(t) = y0 + vy*t - 0.5*g*t^2 with zero allocations.
 */
export function spawnKickupBurst(pool: KickupPool, opts: KickupBurstOptions): void {
  const cap = pool.slots.length;
  if (cap === 0 || opts.count <= 0) return;

  const rng = opts.rng ?? Math.random;
  const speedScale = opts.speedScale ?? 1.0;
  const spread = opts.coneSpreadRad ?? 0.68;

  const dirLen = Math.hypot(opts.dirX, opts.dirZ);
  const baseDirX = dirLen > 1e-4 ? opts.dirX / dirLen : 0;
  const baseDirZ = dirLen > 1e-4 ? opts.dirZ / dirLen : -1;
  const baseAngle = Math.atan2(baseDirX, baseDirZ);

  for (let i = 0; i < opts.count; i++) {
    const slot = pool.slots[pool.cursor];
    pool.cursor = (pool.cursor + 1) % cap;

    const angle = baseAngle + (rng() - 0.5) * 2 * spread;
    const horizSpeed = (2.6 + rng() * 3.1) * speedScale;
    const upSpeed = (3.4 + rng() * 2.6) * Math.min(1.45, 0.78 + speedScale * 0.32);

    const lateralJitter = (rng() - 0.5) * 0.52;
    const fwdJitter = (rng() - 0.5) * 0.3;

    slot.active = true;
    slot.x0 = opts.originX + Math.cos(baseAngle) * lateralJitter + baseDirX * fwdJitter;
    slot.y0 = Math.max(opts.groundY + 0.1, opts.originY);
    slot.z0 = opts.originZ - Math.sin(baseAngle) * lateralJitter + baseDirZ * fwdJitter;
    slot.groundY = opts.groundY;

    slot.vx = Math.sin(angle) * horizSpeed;
    slot.vy = upSpeed;
    slot.vz = Math.cos(angle) * horizSpeed;

    slot.t = 0;
    slot.maxLife = 0.46 + rng() * 0.34;

    slot.rx = rng() * Math.PI * 2;
    slot.ry = rng() * Math.PI * 2;
    slot.rz = rng() * Math.PI * 2;
    slot.vrx = (rng() - 0.5) * 16;
    slot.vry = (rng() - 0.5) * 16;
    slot.vrz = (rng() - 0.5) * 16;

    const baseScale = 0.68 + rng() * 0.78;
    slot.sx = baseScale * (0.85 + rng() * 0.4);
    slot.sy = baseScale * (0.55 + rng() * 0.38);
    slot.sz = baseScale * (0.85 + rng() * 0.4);
  }
}

/** Advance all active pebbles and return active count after pruning expired slots. */
export function stepKickupPool(pool: KickupPool, dt: number): number {
  let active = 0;
  for (let i = 0; i < pool.slots.length; i++) {
    const slot = pool.slots[i];
    if (!slot.active) continue;
    slot.t += dt;
    if (slot.t >= slot.maxLife) {
      slot.active = false;
      continue;
    }
    active++;
  }
  pool.activeCount = active;
  return active;
}

/**
 * Evaluate exact parabolic kinematics y = y0 + vy*t - 0.5*g*t^2 with ground clamp
 * and smooth end-of-life shrink so stones settle onto terrain without clipping below it.
 */
export function computePebbleTransform(
  slot: Readonly<PebbleSlot>,
  out: PebbleTransform,
): boolean {
  if (!slot.active || slot.maxLife <= 0) {
    out.sx = 0;
    out.sy = 0;
    out.sz = 0;
    return false;
  }

  const t = slot.t;
  const rawY = slot.y0 + slot.vy * t - 0.5 * KICKUP_GRAVITY * t * t;
  const grounded = rawY <= slot.groundY;

  // Approximate time of ground touchdown to slow horizontal slide & spin once settled
  let effT = t;
  if (grounded) {
    const disc = slot.vy * slot.vy + 2 * KICKUP_GRAVITY * Math.max(0, slot.y0 - slot.groundY);
    const tHit = (slot.vy + Math.sqrt(Math.max(0, disc))) / KICKUP_GRAVITY;
    const postHit = Math.max(0, t - tHit);
    effT = Math.min(t, tHit + postHit * 0.25);
  }

  out.x = slot.x0 + slot.vx * effT;
  out.z = slot.z0 + slot.vz * effT;
  out.y = Math.max(slot.groundY + 0.04, rawY);

  out.rx = slot.rx + slot.vrx * effT;
  out.ry = slot.ry + slot.vry * effT;
  out.rz = slot.rz + slot.vrz * effT;

  const lifeNorm = Math.min(1, Math.max(0, t / slot.maxLife));
  const shrink = lifeNorm > 0.72 ? Math.max(0, 1 - (lifeNorm - 0.72) / 0.28) : 1;

  out.sx = slot.sx * shrink;
  out.sy = slot.sy * shrink;
  out.sz = slot.sz * shrink;
  return true;
}
