import {
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
  getRoadNormalizedDistance,
  getTerrainHeight,
} from '../../map/terrainMath';
import { getWalkableSurfaceY } from '../../map/mechKinematics';
import { evaluatePuddleAt } from '../../map/puddles';

export const MAX_GROUND_TRAILS = 128;
export const GROUND_TRAIL_MIN_NORMAL_Y = 0.78;
export const GROUND_TRAIL_MAX_CORNER_SAG = 0.32;

export type GroundTrailKind = 'mech-foot' | 'mech-skid' | 'apc-track';

export interface GroundTrailSlot {
  active: boolean;
  kind: GroundTrailKind;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  yaw: number;
  width: number;
  length: number;
  wetness: number;
  age: number;
  maxAge: number;
  seq: number;
}

export interface GroundTrailsPoolState {
  slots: GroundTrailSlot[];
  cursor: number;
  totalSpawned: number;
  activeCount: number;
  dirtyMatrices: boolean;
}

export interface GroundTrailTransform {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  yaw: number;
  width: number;
  length: number;
  alpha: number;
  kindId: number;
  wetness: number;
}

export function createGroundTrailsPool(
  capacity = MAX_GROUND_TRAILS,
): GroundTrailsPoolState {
  return {
    slots: Array.from({ length: capacity }, () => ({
      active: false,
      kind: 'mech-foot',
      x: 0,
      y: 0,
      z: 0,
      nx: 0,
      ny: 1,
      nz: 0,
      yaw: 0,
      width: 1.0,
      length: 1.35,
      wetness: 0,
      age: 0,
      maxAge: 20,
      seq: 0,
    })),
    cursor: 0,
    totalSpawned: 0,
    activeCount: 0,
    dirtyMatrices: true,
  };
}

export function resetGroundTrailsPool(pool: GroundTrailsPoolState): void {
  for (let i = 0; i < pool.slots.length; i++) {
    pool.slots[i].active = false;
  }
  pool.cursor = 0;
  pool.totalSpawned = 0;
  pool.activeCount = 0;
  pool.dirtyMatrices = true;
}

export interface TrailGroundSample {
  y: number;
  nx: number;
  ny: number;
  nz: number;
  wetness: number;
}

/**
 * Validates that (x, z) lies on deformable soil/sand/grass/dirt road (never poured concrete,
 * bridge decks, deep river water, sheer cliff edges, or sharp terrain discontinuities).
 */
export function sampleTrailGround(
  x: number,
  z: number,
  yaw: number,
  halfW: number,
  halfL: number,
  referenceY?: number,
): TrailGroundSample | null {
  const surf = getWalkableSurfaceY(x, z, referenceY);
  if (surf.onConcrete || surf.onBridge || surf.inWater || surf.y < WATER_LEVEL + 0.06) {
    return null;
  }

  const n = getAnalyticalTerrainNormal(x, z, 1.45, false);
  if (n.ny < GROUND_TRAIL_MIN_NORMAL_Y) return null;

  // Anti-floating edge guard: reject sharp cliff lips or steep breaks under the decal corners
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const invNy = 1 / Math.max(0.25, n.ny);
  const checkSample = (lx: number, lz: number): number => {
    const wx = x + lx * cosY + lz * sinY;
    const wz = z - lx * sinY + lz * cosY;
    const actualY = getTerrainHeight(wx, wz);
    const dx = wx - x;
    const dz = wz - z;
    const planeY = surf.y - (n.nx * dx + n.nz * dz) * invNy;
    return Math.abs(actualY - planeY);
  };

  const maxDev = Math.max(
    checkSample(halfW, halfL),
    checkSample(-halfW, halfL),
    checkSample(halfW, -halfL),
    checkSample(-halfW, -halfL),
  );
  if (maxDev > GROUND_TRAIL_MAX_CORNER_SAG) return null;

  // Compute moisture from river shoreline proximity or hillside road puddles
  let wetness = 0;
  if (surf.y < WATER_LEVEL + 1.25) {
    wetness = Math.max(0, Math.min(1, 1 - (surf.y - WATER_LEVEL) / 1.25));
  } else if (surf.y < 14.5) {
    const onRoad = getRoadNormalizedDistance(x, z) < 1.0;
    const puddle = evaluatePuddleAt(x, surf.y, z, n.ny, { isRoad: onRoad });
    if (puddle.waterFactor > 0.1 || puddle.wetSoil > 0.1) {
      wetness = Math.max(wetness, Math.min(1, Math.max(puddle.wetness, puddle.wetSoil)));
    }
  }

  return {
    y: surf.y + 0.036,
    nx: n.nx,
    ny: n.ny,
    nz: n.nz,
    wetness,
  };
}

function pushTrailSlot(
  pool: GroundTrailsPoolState,
  kind: GroundTrailKind,
  x: number,
  z: number,
  yaw: number,
  width: number,
  length: number,
  maxAge: number,
  referenceY?: number,
): boolean {
  if (pool.slots.length === 0) return false;
  const ground = sampleTrailGround(x, z, yaw, width * 0.45, length * 0.45, referenceY);
  if (!ground) return false;

  const idx = pool.cursor % pool.slots.length;
  pool.cursor = (pool.cursor + 1) % pool.slots.length;
  pool.totalSpawned += 1;

  const slot = pool.slots[idx];
  if (!slot.active) pool.activeCount += 1;
  slot.active = true;
  slot.kind = kind;
  slot.x = x;
  slot.y = ground.y;
  slot.z = z;
  slot.nx = ground.nx;
  slot.ny = ground.ny;
  slot.nz = ground.nz;
  slot.yaw = yaw;
  slot.width = width;
  slot.length = length;
  slot.wetness = ground.wetness;
  slot.age = 0;
  slot.maxAge = maxAge;
  slot.seq = pool.totalSpawned;
  pool.dirtyMatrices = true;
  return true;
}

/**
 * Stamps a discrete 3-toed heavy Mech footprint on deformable ground.
 */
export function stampMechFootprint(
  pool: GroundTrailsPoolState,
  x: number,
  z: number,
  yaw: number,
  referenceY?: number,
  maxAge = 22.0,
): boolean {
  return pushTrailSlot(pool, 'mech-foot', x, z, yaw, 1.08, 1.44, maxAge, referenceY);
}

/**
 * Stamps twin heel/claw skid gouges during hard braking, drift turns, or ground Jet-Dash.
 */
export function stampMechSkidTrail(
  pool: GroundTrailsPoolState,
  x: number,
  z: number,
  yaw: number,
  referenceY?: number,
  maxAge = 14.0,
): boolean {
  return pushTrailSlot(pool, 'mech-skid', x, z, yaw, 1.92, 1.75, maxAge, referenceY);
}

/**
 * Stamps parallel dual tire/track ruts behind moving enemy Scout APCs on loose terrain.
 */
export function stampApcTrack(
  pool: GroundTrailsPoolState,
  x: number,
  z: number,
  yaw: number,
  referenceY?: number,
  maxAge = 18.0,
): boolean {
  return pushTrailSlot(pool, 'apc-track', x, z, yaw, 1.38, 1.28, maxAge, referenceY);
}

export function stepGroundTrailsPool(
  pool: GroundTrailsPoolState,
  dt: number,
): number {
  if (dt <= 0 || pool.activeCount === 0) return pool.activeCount;
  let alive = 0;
  for (let i = 0; i < pool.slots.length; i++) {
    const s = pool.slots[i];
    if (!s.active) continue;
    s.age += dt;
    if (s.age >= s.maxAge) {
      s.active = false;
      continue;
    }
    alive += 1;
  }
  pool.activeCount = alive;
  return alive;
}

export function computeGroundTrailTransform(
  slot: Readonly<GroundTrailSlot>,
  totalSpawned: number,
  capacity: number,
  out: GroundTrailTransform,
): boolean {
  if (!slot.active || slot.maxAge <= 0) return false;
  const ageT = Math.max(0, Math.min(1, slot.age / slot.maxAge));
  // Hold crisp visibility across 60% of lifetime, then dissolve smoothly
  const timeFade = ageT < 0.6 ? 1.0 : Math.pow(1.0 - (ageT - 0.6) / 0.4, 1.5);

  // Also fade out the oldest ~18 slots before ring-buffer wrap overwrites them
  const slotsBehindHead = Math.max(0, totalSpawned - slot.seq);
  const remainingBeforeWrap = capacity - slotsBehindHead;
  const ringFade =
    remainingBeforeWrap >= 18
      ? 1.0
      : Math.max(0, remainingBeforeWrap / 18);

  const alpha = timeFade * ringFade * 0.92;
  if (alpha <= 0.01) return false;

  out.x = slot.x;
  out.y = slot.y;
  out.z = slot.z;
  out.nx = slot.nx;
  out.ny = slot.ny;
  out.nz = slot.nz;
  out.yaw = slot.yaw;
  out.width = slot.width;
  out.length = slot.length;
  out.alpha = alpha;
  out.kindId = slot.kind === 'mech-foot' ? 0 : slot.kind === 'mech-skid' ? 1 : 2;
  out.wetness = slot.wetness;
  return true;
}
