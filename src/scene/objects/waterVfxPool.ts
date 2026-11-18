import {
  WATER_LEVEL,
  getTerrainHeight,
} from '../../map/terrainMath';
import {
  WATER_SPAN_D,
  WATER_SPAN_W,
} from '../../map/waterDepth';

export const MAX_WATER_RIPPLES = 36;
export const MAX_WATER_SPLASHES = 64;
export const WATER_SPLASH_GRAVITY = 22.0;

export interface WaterRippleSlot {
  active: boolean;
  x: number;
  z: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  intensity: number;
}

export interface WaterSplashSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  baseSize: number;
}

export interface WaterVfxPoolState {
  ripples: WaterRippleSlot[];
  splashes: WaterSplashSlot[];
  rippleCursor: number;
  splashCursor: number;
  activeRipples: number;
  activeSplashes: number;
  rngState: number;
}

export interface RippleTransform {
  x: number;
  y: number;
  z: number;
  scale: number;
  alpha: number;
  progress: number;
}

export interface SplashTransform {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  progress: number;
}

export interface WaterImpactOptions {
  dirX?: number;
  dirZ?: number;
  countScale?: number;
  ripple?: boolean;
  splash?: boolean;
}

export function createWaterVfxPool(
  maxRipples = MAX_WATER_RIPPLES,
  maxSplashes = MAX_WATER_SPLASHES,
): WaterVfxPoolState {
  return {
    ripples: Array.from({ length: maxRipples }, () => ({
      active: false,
      x: 0,
      z: 0,
      age: 0,
      maxAge: 1.5,
      startScale: 1.4,
      endScale: 6.2,
      intensity: 1.0,
    })),
    splashes: Array.from({ length: maxSplashes }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 0.6,
      baseSize: 1.0,
    })),
    rippleCursor: 0,
    splashCursor: 0,
    activeRipples: 0,
    activeSplashes: 0,
    rngState: 0x5f3759df,
  };
}

export function resetWaterVfxPool(pool: WaterVfxPoolState): void {
  for (let i = 0; i < pool.ripples.length; i++) {
    pool.ripples[i].active = false;
  }
  for (let i = 0; i < pool.splashes.length; i++) {
    pool.splashes[i].active = false;
  }
  pool.rippleCursor = 0;
  pool.splashCursor = 0;
  pool.activeRipples = 0;
  pool.activeSplashes = 0;
}

function nextPoolRandom(pool: WaterVfxPoolState): number {
  let x = (pool.rngState | 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  pool.rngState = x;
  return ((x >>> 0) % 100000) / 100000;
}

/**
 * Returns true only for impacts inside the river channel water surface
 * (excludes dry shorelines and elevated hillside road puddles).
 */
export function isRiverWaterImpact(x: number, y: number, z: number): boolean {
  if (
    Math.abs(x) > WATER_SPAN_W * 0.5 ||
    Math.abs(z) > WATER_SPAN_D * 0.5
  ) {
    return false;
  }
  if (y > WATER_LEVEL + 0.35) return false;
  return getTerrainHeight(x, z) < WATER_LEVEL + 0.08;
}

/**
 * Given a ray segment starting above water (oy > WATER_LEVEL) and hitting submerged terrain
 * below water (hy < WATER_LEVEL - 0.04), returns the exact surface crossing on y = WATER_LEVEL.
 */
export function findWaterSurfaceCrossing(
  ox: number,
  oy: number,
  oz: number,
  hx: number,
  hy: number,
  hz: number,
): { x: number; y: number; z: number } | null {
  if (oy <= WATER_LEVEL + 0.05 || hy >= WATER_LEVEL - 0.04) return null;
  const dy = hy - oy;
  if (Math.abs(dy) < 1e-6) return null;
  const t = (WATER_LEVEL - oy) / dy;
  if (t <= 0 || t >= 1) return null;
  const wx = ox + (hx - ox) * t;
  const wz = oz + (hz - oz) * t;
  if (
    Math.abs(wx) > WATER_SPAN_W * 0.5 ||
    Math.abs(wz) > WATER_SPAN_D * 0.5
  ) {
    return null;
  }
  if (getTerrainHeight(wx, wz) >= WATER_LEVEL - 0.04) return null;
  return { x: wx, y: WATER_LEVEL, z: wz };
}

export function spawnWaterRipple(
  pool: WaterVfxPoolState,
  x: number,
  z: number,
  intensity = 1.0,
): void {
  if (pool.ripples.length === 0) return;
  const clamped = Math.max(0.45, Math.min(2.5, intensity));
  const slot = pool.ripples[pool.rippleCursor % pool.ripples.length];
  pool.rippleCursor = (pool.rippleCursor + 1) % pool.ripples.length;

  if (!slot.active) pool.activeRipples += 1;
  slot.active = true;
  slot.x = x;
  slot.z = z;
  slot.age = 0;
  slot.intensity = clamped;
  // Calibrated to Sector 7 scale (1 unit ≈ 3.75 m): step ~ 6.4 u, dash/105mm ~ 10.2 u, 37mm ~ 4.5 u
  slot.maxAge = 1.05 + clamped * 0.45;
  slot.startScale = 0.85 + clamped * 0.55;
  slot.endScale = 2.4 + clamped * 3.8;
}

export function spawnWaterSplash(
  pool: WaterVfxPoolState,
  x: number,
  z: number,
  intensity = 1.0,
  dirX = 0,
  dirZ = 0,
  countScale = 1.0,
): void {
  if (pool.splashes.length === 0) return;
  const clamped = Math.max(0.45, Math.min(2.5, intensity));
  const count = Math.max(
    2,
    Math.min(14, Math.round((3 + clamped * 3.2) * Math.max(0.35, countScale))),
  );
  const dirLen = Math.hypot(dirX, dirZ);
  const hasDir = dirLen > 0.1;
  const ndx = hasDir ? dirX / dirLen : 0;
  const ndz = hasDir ? dirZ / dirLen : 0;

  for (let k = 0; k < count; k++) {
    const slot = pool.splashes[pool.splashCursor % pool.splashes.length];
    pool.splashCursor = (pool.splashCursor + 1) % pool.splashes.length;

    if (!slot.active) pool.activeSplashes += 1;
    slot.active = true;
    slot.age = 0;
    slot.maxAge = 0.42 + nextPoolRandom(pool) * 0.24 + clamped * 0.06;
    slot.baseSize = (0.72 + nextPoolRandom(pool) * 0.52) * Math.sqrt(clamped);

    const angle = (k / count) * Math.PI * 2 + nextPoolRandom(pool) * 0.65;
    const radialOut = (0.28 + nextPoolRandom(pool) * 0.32) * clamped;
    slot.x = x + Math.cos(angle) * radialOut;
    slot.y = WATER_LEVEL + 0.14;
    slot.z = z + Math.sin(angle) * radialOut;

    const lateralSpeed = (1.6 + nextPoolRandom(pool) * 2.1) * Math.sqrt(clamped);
    const upSpeed = (3.4 + nextPoolRandom(pool) * 2.4) * Math.sqrt(clamped);
    const dirBoost = hasDir ? (1.2 + nextPoolRandom(pool) * 1.4) * clamped : 0;

    slot.vx = Math.cos(angle) * lateralSpeed + ndx * dirBoost;
    slot.vy = upSpeed;
    slot.vz = Math.sin(angle) * lateralSpeed + ndz * dirBoost;
  }
}

export function spawnWaterImpact(
  pool: WaterVfxPoolState,
  x: number,
  z: number,
  intensity = 1.0,
  options?: WaterImpactOptions,
): void {
  const emitRipple = options?.ripple ?? true;
  const emitSplash = options?.splash ?? true;
  if (emitRipple) {
    spawnWaterRipple(pool, x, z, intensity);
  }
  if (emitSplash) {
    spawnWaterSplash(
      pool,
      x,
      z,
      intensity,
      options?.dirX ?? 0,
      options?.dirZ ?? 0,
      options?.countScale ?? 1.0,
    );
  }
}

export function stepWaterVfxPool(
  pool: WaterVfxPoolState,
  dt: number,
): { activeRipples: number; activeSplashes: number } {
  if (dt <= 0) {
    return {
      activeRipples: pool.activeRipples,
      activeSplashes: pool.activeSplashes,
    };
  }

  let activeRipples = 0;
  for (let i = 0; i < pool.ripples.length; i++) {
    const r = pool.ripples[i];
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= r.maxAge) {
      r.active = false;
      continue;
    }
    activeRipples += 1;
  }

  let activeSplashes = 0;
  for (let i = 0; i < pool.splashes.length; i++) {
    const s = pool.splashes[i];
    if (!s.active) continue;
    s.age += dt;
    s.vy -= WATER_SPLASH_GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    if (s.age >= s.maxAge || (s.vy < 0 && s.y < WATER_LEVEL - 0.05)) {
      s.active = false;
      continue;
    }
    activeSplashes += 1;
  }

  pool.activeRipples = activeRipples;
  pool.activeSplashes = activeSplashes;
  return { activeRipples, activeSplashes };
}

export function computeRippleTransform(
  slot: Readonly<WaterRippleSlot>,
  out: RippleTransform,
): boolean {
  if (!slot.active || slot.maxAge <= 0) return false;
  const t = Math.max(0, Math.min(1, slot.age / slot.maxAge));
  const easeOut = 1.0 - Math.pow(1.0 - t, 2.2);
  const scale = slot.startScale + (slot.endScale - slot.startScale) * easeOut;
  const fadeIn = Math.min(t * 10.0, 1.0);
  const fadeOut = Math.pow(1.0 - t, 1.45);

  out.x = slot.x;
  out.y = WATER_LEVEL + 0.04;
  out.z = slot.z;
  out.scale = scale;
  out.alpha = fadeIn * fadeOut * 0.85;
  out.progress = t;
  return out.alpha > 0.002;
}

export function computeSplashTransform(
  slot: Readonly<WaterSplashSlot>,
  out: SplashTransform,
): boolean {
  if (!slot.active || slot.maxAge <= 0) return false;
  const t = Math.max(0, Math.min(1, slot.age / slot.maxAge));
  const scale = slot.baseSize * (0.65 + t * 0.78);
  const stretchY = 1.0 + Math.min(0.65, Math.abs(slot.vy) * 0.045);

  out.x = slot.x;
  out.y = slot.y;
  out.z = slot.z;
  out.scaleX = scale;
  out.scaleY = scale * stretchY;
  out.alpha = (1.0 - t * t) * 0.88;
  out.progress = t;
  return out.alpha > 0.002;
}
