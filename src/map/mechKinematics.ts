import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ISLAND_DECK_RADIUS,
  MAP_HALF_D,
  MAP_HALF_W,
  METERS_PER_UNIT,
  WATER_LEVEL,
  clamp,
  getBridgeDeckYAt,
  getTerrainHeight,
  getTerrainSlope,
  lerp,
} from './terrainMath';
import { MECH_COLLISION_RADIUS, resolveWorldObstacles } from './worldColliders';

export function worldSpeedToKmh(unitsPerSec: number): number {
  return unitsPerSec * METERS_PER_UNIT * 3.6;
}

// Calibrated so raw Mech height (~4.44) * 0.80 = 3.55 world units (~13.3 m tall, matching 8-14 m arena scale)
export const MECH_SCALE = 0.8;
export const MECH_L1 = 1.12;
export const MECH_L2 = 1.16;
export const MECH_L3 = 0.88;
export const MECH_SOLE_HEIGHT = 0.34;
export const MECH_PELVIS_BASE_Y = 2.32;

// Spawn on the open NE corner of the Airfield tarmac facing the main road & bridges
const AIRFIELD_PAD_Y = getTerrainHeight(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z);
const SPAWN_LOCAL_X = 19.5;
const SPAWN_LOCAL_Z = -1.5;
const AIRFIELD_ROT = -0.22;

export const MECH_SPAWN = {
  x:
    AIRFIELD_CENTER_X +
    SPAWN_LOCAL_X * Math.cos(AIRFIELD_ROT) -
    SPAWN_LOCAL_Z * Math.sin(AIRFIELD_ROT),
  z:
    AIRFIELD_CENTER_Z +
    SPAWN_LOCAL_X * Math.sin(AIRFIELD_ROT) +
    SPAWN_LOCAL_Z * Math.cos(AIRFIELD_ROT),
  // Facing NE toward [-92, 60] road exit & river crossing
  yaw: Math.atan2(22.5, -32.0),
  y: AIRFIELD_PAD_Y + 0.35,
};

const ISLAND_BASE_Y = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z);
const CITADEL_BASE_Y = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z);

/**
 * Exact walkable surface elevation at world (x, z) across terrain, concrete pads,
 * riverbeds/ramps, and all 4 bridges (including the 2-flight serpentine viaduct).
 * When currentY is provided, elevated bridge decks above step-up reach are skipped
 * so units passing underneath bridges do not snap upward onto overhead spans.
 */
export function getWalkableSurfaceY(
  x: number,
  z: number,
  currentY?: number,
): {
  y: number;
  onBridge: boolean;
  inWater: boolean;
} {
  let y = getTerrainHeight(x, z);
  let onBridge = false;

  // 1. Check all 4 bridges / elevated viaduct first
  for (let i = 0; i < BRIDGE_SPECS.length; i++) {
    const deckY = getBridgeDeckYAt(BRIDGE_SPECS[i], x, z);
    if (deckY !== null && deckY > y - 0.35) {
      const withinStepReach = currentY === undefined || currentY >= deckY - 1.35;
      if (withinStepReach) {
        y = Math.max(y, deckY);
        onBridge = true;
      }
    }
  }

  // 2. Airfield concrete apron (60 x 44 rotated -0.22 rad, top at airY + 0.35)
  const adx = x - AIRFIELD_CENTER_X;
  const adz = z - AIRFIELD_CENTER_Z;
  const cosA = Math.cos(0.22);
  const sinA = Math.sin(0.22);
  const alx = adx * cosA - adz * sinA;
  const alz = adx * sinA + adz * cosA;
  if (Math.abs(alx) <= 30.0 && Math.abs(alz) <= 22.0) {
    y = Math.max(y, AIRFIELD_PAD_Y + 0.35);
  }

  // 3. Central Industrial Island concrete deck (radius 30.5, top at islandY + 0.70)
  if (Math.hypot(x - ISLAND_CENTER_X, z - ISLAND_CENTER_Z) <= ISLAND_DECK_RADIUS) {
    y = Math.max(y, ISLAND_BASE_Y + 0.7);
  }

  // 4. Citadel concrete courtyard slab (elliptical octagon, top at citY + 0.55)
  const cdx = (x - CITADEL_CENTER_X) / (CITADEL_WALL_RX + 0.5);
  const cdz = (z - CITADEL_CENTER_Z) / (CITADEL_WALL_RZ + 0.5);
  if (Math.hypot(cdx, cdz) <= 1.0) {
    y = Math.max(y, CITADEL_BASE_Y + 0.55);
  }

  const inWater = !onBridge && y < WATER_LEVEL - 0.05;
  return { y, onBridge, inWater };
}

export interface FootSupportSample {
  ankleY: number;
  pitch: number;
  roll: number;
  inWater: boolean;
  onBridge: boolean;
}

const FOOT_SAMPLE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-0.24, 0.56],
  [0.24, 0.56],
  [-0.28, 0.0],
  [0.28, 0.0],
  [-0.20, -0.52],
  [0.20, -0.52],
];

/**
 * 7-point terrain/deck contact sampler underneath a Mech foot pad.
 * Returns ankle world Y plus terrain-matched pitch & roll.
 */
export function sampleMechFootSupport(
  wx: number,
  wz: number,
  yaw: number,
  scale = MECH_SCALE,
  referenceY?: number,
): FootSupportSample {
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const soleWorldH = MECH_SOLE_HEIGHT * scale;

  let maxReqAnkleY = -Infinity;
  let hFront = 0;
  let hBack = 0;
  let hLeft = 0;
  let hRight = 0;
  let anyInWater = false;
  let anyOnBridge = false;

  for (let i = 0; i < FOOT_SAMPLE_OFFSETS.length; i++) {
    const lx = FOOT_SAMPLE_OFFSETS[i][0] * scale;
    const lz = FOOT_SAMPLE_OFFSETS[i][1] * scale;
    const px = wx + lx * cosY + lz * sinY;
    const pz = wz - lx * sinY + lz * cosY;
    const surf = getWalkableSurfaceY(px, pz, referenceY);
    const gh = surf.y;
    if (surf.inWater) anyInWater = true;
    if (surf.onBridge) anyOnBridge = true;

    if (i === 1 || i === 2) hFront += gh * 0.5;
    if (i === 5 || i === 6) hBack += gh * 0.5;
    if (i === 1 || i === 3 || i === 5) hLeft += gh / 3;
    if (i === 2 || i === 4 || i === 6) hRight += gh / 3;

    if (gh + soleWorldH > maxReqAnkleY) {
      maxReqAnkleY = gh + soleWorldH;
    }
  }

  const pitch = clamp(Math.atan2(hBack - hFront, 1.08 * scale), -0.34, 0.34);
  const roll = clamp(Math.atan2(hLeft - hRight, 0.52 * scale), -0.28, 0.28);
  return {
    ankleY: maxReqAnkleY,
    pitch,
    roll,
    inWater: anyInWater,
    onBridge: anyOnBridge,
  };
}

export interface ReverseJointIKResult {
  hipRollZ: number;
  hipRotX: number;
  kneeBend: number;
  hockBend: number;
}

/**
 * Analytical 3-link reverse-joint IK solver for Soviet Object 316 S-legs.
 * Expects target coordinates in hipAnchor local space (raw unscaled rig units).
 */
export function solveReverseJointIKAngles(
  localX: number,
  localY: number,
  localZ: number,
  l1 = MECH_L1,
  l2 = MECH_L2,
  l3 = MECH_L3,
): ReverseJointIKResult {
  let tx = localX;
  let ty = localY;
  let tz = localZ;

  const maxR = (l1 + l2 + l3) * 0.94;
  const minR = 0.85;
  const distRaw = Math.hypot(tx, ty, tz);
  if (distRaw > maxR && distRaw > 1e-6) {
    const s = maxR / distRaw;
    tx *= s;
    ty *= s;
    tz *= s;
  } else if (distRaw < minR && distRaw > 1e-6) {
    const s = minR / distRaw;
    tx *= s;
    ty *= s;
    tz *= s;
  }

  const rollX = Math.atan2(tx, Math.max(0.6, -ty));
  const hipRollZ = clamp(rollX, -0.22, 0.22);

  const planarY = -Math.hypot(tx, ty);
  const planarZ = tz;
  const D = Math.hypot(planarY, planarZ);
  const targetPitch = Math.atan2(planarZ, -planarY);

  const kRatio = 0.92;
  let lo = 0.05;
  let hi = 2.45;
  const targetDSq = D * D;

  for (let iter = 0; iter < 18; iter++) {
    const mid = 0.5 * (lo + hi);
    const hb = mid * kRatio;
    const cy = l1 + l2 * Math.cos(mid) + l3 * Math.cos(mid - hb);
    const cz = l2 * Math.sin(mid) + l3 * Math.sin(mid - hb);
    if (cy * cy + cz * cz > targetDSq) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const kneeBend = 0.5 * (lo + hi);
  const hockBend = kneeBend * kRatio;

  const endY = -(l1 + l2 * Math.cos(kneeBend) + l3 * Math.cos(kneeBend - hockBend));
  const endZ = -(l2 * Math.sin(kneeBend) + l3 * Math.sin(kneeBend - hockBend));
  const naturalPitch = Math.atan2(endZ, -endY);
  const hipRotX = -(targetPitch - naturalPitch);

  return {
    hipRollZ,
    hipRotX,
    kneeBend,
    hockBend,
  };
}

/**
 * Critically damped spring used for heavy mech hull suspension, turret recoil,
 * and whip antenna physics.
 */
export class SmoothSpring {
  x: number;
  v: number;
  omega: number;

  constructor(val: number, omega: number) {
    this.x = val;
    this.v = 0;
    this.omega = omega;
  }

  update(target: number, dt: number): number {
    const steps = 4;
    const h = Math.min(dt, 0.05) / steps;
    const w = this.omega;
    for (let i = 0; i < steps; i++) {
      const f = -w * w * (this.x - target) - 2 * w * this.v;
      this.v += f * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/**
 * Keeps the Mech inside Sector 7 playable perimeter, resolves sliding collisions against
 * structures/cover/trees/rocks, and resists climbing near-vertical cliffs unless on a bridge.
 */
export function clampMechPosition(
  nextX: number,
  nextZ: number,
  prevX: number,
  prevZ: number,
  currentY?: number,
): { x: number; z: number } {
  const boundX = MAP_HALF_W - 10;
  const boundZ = MAP_HALF_D - 10;
  const prevSurf = getWalkableSurfaceY(prevX, prevZ, currentY);
  const refY = currentY ?? prevSurf.y;

  let cx = clamp(nextX, -boundX, boundX);
  let cz = clamp(nextZ, -boundZ, boundZ);

  const obs = resolveWorldObstacles(cx, cz, refY, MECH_COLLISION_RADIUS);
  cx = clamp(obs.x, -boundX, boundX);
  cz = clamp(obs.z, -boundZ, boundZ);

  const surf = getWalkableSurfaceY(cx, cz, refY);
  if (!surf.onBridge) {
    const slope = getTerrainSlope(cx, cz);
    // Allow downhill escape from steep ground, block climbing sheer >47 deg rock cliffs
    if (slope > 1.08 && surf.y > prevSurf.y + 0.05) {
      const slidX = lerp(prevX, cx, 0.12);
      const slidZ = lerp(prevZ, cz, 0.12);
      const reObs = resolveWorldObstacles(slidX, slidZ, refY, MECH_COLLISION_RADIUS);
      return {
        x: clamp(reObs.x, -boundX, boundX),
        z: clamp(reObs.z, -boundZ, boundZ),
      };
    }
  }

  return { x: cx, z: cz };
}

export interface MechTelemetrySnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  turretYaw: number;
  speedKmh: number;
  elevationM: number;
  isFiring: boolean;
  isBraced: boolean;
  isCrouched: boolean;
  inWater: boolean;
  onBridge: boolean;
}
