import {
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
} from '../../map/terrainMath';
import { getWalkableSurfaceY } from '../../map/mechKinematics';

export const MAX_CASING_INSTANCES = 72;
export const MAX_DEBRIS_INSTANCES = 44;
export const CASING_GRAVITY = 22.0;

export interface BallisticPropSlot {
  active: boolean;
  resting: boolean;
  submerged: boolean;
  justBouncedDry: boolean;
  justHitWater: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  nx: number;
  ny: number;
  nz: number;
  restYaw: number;
  scale: number;
  restOffset: number;
  restitution: number;
  maxBounces: number;
  bounces: number;
  age: number;
  maxAge: number;
  coolDuration: number;
  hotR: number;
  hotG: number;
  hotB: number;
  coolR: number;
  coolG: number;
  coolB: number;
}

export interface BallisticPropPool {
  slots: BallisticPropSlot[];
  cursor: number;
  activeCount: number;
  dirty: boolean;
}

export interface BallisticStepEvents {
  dryBouncedCasings: number;
  heavyDryBounce: boolean;
  waterImpactX: number;
  waterImpactZ: number;
  hasWaterImpact: boolean;
}

function createEmptySlot(): BallisticPropSlot {
  return {
    active: false,
    resting: false,
    submerged: false,
    justBouncedDry: false,
    justHitWater: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vry: 0,
    vrz: 0,
    nx: 0,
    ny: 1,
    nz: 0,
    restYaw: 0,
    scale: 1,
    restOffset: 0.05,
    restitution: 0.4,
    maxBounces: 3,
    bounces: 0,
    age: 0,
    maxAge: 13.5,
    coolDuration: 2.4,
    hotR: 1.55,
    hotG: 0.72,
    hotB: 0.14,
    coolR: 0.68,
    coolG: 0.53,
    coolB: 0.24,
  };
}

export function createBallisticPropPool(capacity: number): BallisticPropPool {
  const slots: BallisticPropSlot[] = [];
  for (let i = 0; i < capacity; i++) {
    slots.push(createEmptySlot());
  }
  return { slots, cursor: 0, activeCount: 0, dirty: false };
}

export function resetBallisticPropPool(pool: BallisticPropPool): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
    pool.slots[i].resting = false;
    pool.slots[i].submerged = false;
    pool.slots[i].justBouncedDry = false;
    pool.slots[i].justHitWater = false;
    pool.slots[i].bounces = 0;
    pool.slots[i].age = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
  pool.dirty = true;
}

export interface EjectShellCasingOptions {
  x: number;
  y: number;
  z: number;
  shootDirX: number;
  shootDirY: number;
  shootDirZ: number;
  /** Outward side relative to barrel: +1 for right side, -1 for left side. */
  outwardSide: -1 | 1;
  caliberScale?: number;
  rng?: () => number;
}

/**
 * Ejects a hot brass casing perpendicular to turret aim direction into a fixed ring buffer.
 * Zero heap allocations per call.
 */
export function ejectShellCasing(
  pool: BallisticPropPool,
  opts: EjectShellCasingOptions,
): number {
  const cap = pool.slots.length;
  if (cap === 0) return -1;

  const rng = opts.rng ?? Math.random;
  const scale = opts.caliberScale ?? 0.95;

  const dirLen = Math.max(1e-5, Math.hypot(opts.shootDirX, opts.shootDirY, opts.shootDirZ));
  const fx = opts.shootDirX / dirLen;
  const fz = opts.shootDirZ / dirLen;

  // World right = normalize(fwd x up) = (-fz, 0, fx)
  let rx = -fz;
  let rz = fx;
  const rLen = Math.hypot(rx, rz);
  if (rLen > 1e-4) {
    rx /= rLen;
    rz /= rLen;
  } else {
    rx = 1;
    rz = 0;
  }
  rx *= opts.outwardSide;
  rz *= opts.outwardSide;

  const idx = pool.cursor;
  pool.cursor = (pool.cursor + 1) % cap;
  const slot = pool.slots[idx];
  const wasActive = slot.active;

  slot.active = true;
  slot.resting = false;
  slot.submerged = false;
  slot.justBouncedDry = false;
  slot.justHitWater = false;
  slot.x = opts.x;
  slot.y = opts.y;
  slot.z = opts.z;

  const ejectSpeed = (3.4 + rng() * 1.4) * Math.sqrt(scale);
  const backSpeed = 0.7 + rng() * 0.9;
  slot.vx = rx * ejectSpeed - fx * backSpeed;
  slot.vy = (3.3 + rng() * 1.5) * Math.min(1.3, 0.8 + scale * 0.22);
  slot.vz = rz * ejectSpeed - fz * backSpeed;

  slot.rx = rng() * Math.PI * 2;
  slot.ry = rng() * Math.PI * 2;
  slot.rz = rng() * Math.PI * 2;
  slot.vrx = (rng() - 0.5) * 18.0;
  slot.vry = (rng() - 0.5) * 12.0;
  slot.vrz = (rng() - 0.5) * 18.0;
  slot.nx = 0;
  slot.ny = 1;
  slot.nz = 0;
  slot.restYaw = rng() * Math.PI * 2;

  slot.scale = scale;
  slot.restOffset = 0.045 * scale;
  slot.restitution = 0.42;
  slot.maxBounces = 3;
  slot.bounces = 0;
  slot.age = 0;
  slot.maxAge = 13.5;
  slot.coolDuration = 2.4;

  // Incandescent amber-gold cooling into warm weathered brass
  slot.hotR = 1.65;
  slot.hotG = 0.78;
  slot.hotB = 0.16;
  slot.coolR = 0.72;
  slot.coolG = 0.55;
  slot.coolB = 0.24;

  if (!wasActive) pool.activeCount += 1;
  pool.dirty = true;
  return idx;
}

export interface SpawnArmorDebrisOptions {
  x: number;
  y: number;
  z: number;
  count: number;
  speedScale?: number;
  scale?: number;
  rng?: () => number;
}

/**
 * Spawns jagged incandescent armor shards from shell impacts and vehicle explosions.
 */
export function spawnArmorDebrisBurst(
  pool: BallisticPropPool,
  opts: SpawnArmorDebrisOptions,
): void {
  const cap = pool.slots.length;
  if (cap === 0 || opts.count <= 0) return;

  const rng = opts.rng ?? Math.random;
  const speedScale = opts.speedScale ?? 1.0;
  const baseScale = opts.scale ?? 1.0;

  for (let i = 0; i < opts.count; i++) {
    const idx = pool.cursor;
    pool.cursor = (pool.cursor + 1) % cap;
    const slot = pool.slots[idx];
    const wasActive = slot.active;

    const ang = rng() * Math.PI * 2;
    const horiz = (2.8 + rng() * 5.6) * speedScale;
    const shardScale = baseScale * (0.7 + rng() * 0.65);

    slot.active = true;
    slot.resting = false;
    slot.submerged = false;
    slot.justBouncedDry = false;
    slot.justHitWater = false;
    slot.x = opts.x + (rng() - 0.5) * 0.5;
    slot.y = opts.y + rng() * 0.35;
    slot.z = opts.z + (rng() - 0.5) * 0.5;
    slot.vx = Math.cos(ang) * horiz;
    slot.vy = (3.6 + rng() * 5.4) * Math.min(1.4, 0.75 + speedScale * 0.3);
    slot.vz = Math.sin(ang) * horiz;

    slot.rx = rng() * Math.PI * 2;
    slot.ry = rng() * Math.PI * 2;
    slot.rz = rng() * Math.PI * 2;
    slot.vrx = (rng() - 0.5) * 15.0;
    slot.vry = (rng() - 0.5) * 14.0;
    slot.vrz = (rng() - 0.5) * 15.0;
    slot.nx = 0;
    slot.ny = 1;
    slot.nz = 0;
    slot.restYaw = rng() * Math.PI * 2;

    slot.scale = shardScale;
    slot.restOffset = 0.04 * shardScale;
    slot.restitution = 0.34;
    slot.maxBounces = 2;
    slot.bounces = 0;
    slot.age = 0;
    slot.maxAge = 10.5;
    slot.coolDuration = 2.0;

    // White-orange shrapnel glow cooling into scorched gunmetal/olive armor
    const tint = 0.8 + rng() * 0.32;
    slot.hotR = 1.75;
    slot.hotG = 0.54;
    slot.hotB = 0.12;
    slot.coolR = 0.22 * tint;
    slot.coolG = 0.21 * tint;
    slot.coolB = 0.19 * tint;

    if (!wasActive) pool.activeCount += 1;
  }
  pool.dirty = true;
}

/**
 * Advances parabolic flight, walkable surface bounces (terrain, bridges, pads, water),
 * slope-normal resting alignment, and thermal cooling. Zero heap allocations.
 */
export function stepBallisticPropPool(
  pool: BallisticPropPool,
  dt: number,
  outEvents?: BallisticStepEvents,
): number {
  if (outEvents) {
    outEvents.dryBouncedCasings = 0;
    outEvents.heavyDryBounce = false;
    outEvents.hasWaterImpact = false;
  }
  if (dt <= 0) return pool.activeCount;

  let active = 0;
  const slots = pool.slots;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s.active) continue;

    s.justBouncedDry = false;
    s.justHitWater = false;
    s.age += dt;

    if (s.age >= s.maxAge) {
      s.active = false;
      pool.dirty = true;
      continue;
    }

    active += 1;
    if (s.resting) {
      if (s.age > s.maxAge - 1.5) pool.dirty = true;
      continue;
    }

    pool.dirty = true;
    const prevY = s.y;
    if (s.submerged) {
      const drag = Math.exp(-7.5 * dt);
      s.vx *= drag;
      s.vz *= drag;
      s.vy = Math.max(-2.6, s.vy * 0.65 - 4.0 * dt);
    } else {
      s.vy -= CASING_GRAVITY * dt;
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.rx += s.vrx * dt;
    s.ry += s.vry * dt;
    s.rz += s.vrz * dt;

    const surf = getWalkableSurfaceY(s.x, s.z, prevY);

    if (surf.inWater && s.y <= WATER_LEVEL + 0.04) {
      if (!s.submerged) {
        s.submerged = true;
        s.justHitWater = true;
        s.age = Math.max(s.age, s.coolDuration);
        if (outEvents && !outEvents.hasWaterImpact) {
          outEvents.hasWaterImpact = true;
          outEvents.waterImpactX = s.x;
          outEvents.waterImpactZ = s.z;
        }
      }
      if (s.y <= surf.y + s.restOffset) {
        s.y = surf.y + s.restOffset;
        s.resting = true;
        s.nx = 0;
        s.ny = 1;
        s.nz = 0;
        s.age = Math.max(s.age, s.maxAge - 1.6);
      }
      continue;
    }

    const groundTarget = surf.y + s.restOffset;
    if (s.y <= groundTarget) {
      s.y = groundTarget;
      s.bounces += 1;

      if (s.bounces === 1) {
        s.justBouncedDry = true;
        if (outEvents) {
          outEvents.dryBouncedCasings += 1;
          if (s.scale >= 1.3) outEvents.heavyDryBounce = true;
        }
      }

      if (s.bounces >= s.maxBounces || Math.abs(s.vy) < 1.15) {
        s.resting = true;
        if (surf.onBridge || surf.onConcrete) {
          s.nx = 0;
          s.ny = 1;
          s.nz = 0;
        } else {
          const n = getAnalyticalTerrainNormal(s.x, s.z, 1.4, true);
          s.nx = n.nx;
          s.ny = n.ny;
          s.nz = n.nz;
        }
      } else {
        s.vy = -s.vy * s.restitution;
        s.vx *= 0.56;
        s.vz *= 0.56;
        s.vrx *= 0.52;
        s.vry *= 0.52;
        s.vrz *= 0.52;
      }
    }
  }

  pool.activeCount = active;
  return active;
}

/**
 * Computes current linear RGB color (hot metal -> cooled brass/steel) and scale factor (shrink at EOL).
 */
export function getBallisticSlotVisualFactor(slot: Readonly<BallisticPropSlot>): {
  coolT: number;
  shrinkScale: number;
} {
  const coolT = Math.min(1, Math.max(0, slot.age / Math.max(0.01, slot.coolDuration)));
  const fadeWindow = 1.4;
  const remaining = slot.maxAge - slot.age;
  const shrinkScale = remaining < fadeWindow ? Math.max(0, remaining / fadeWindow) : 1;
  return { coolT, shrinkScale };
}
