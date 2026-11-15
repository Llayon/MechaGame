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
  getBridgeDeckYAt,
  getTerrainHeight,
} from './terrainMath';
import {
  BoxCollider,
  CircleCollider,
  ColliderTag,
  WorldCollider,
  queryCollidersAlongSegment,
} from './worldColliders';

export type RayHitKind = 'terrain' | 'bridge' | 'obstacle';

export interface CombatRayHit {
  distance: number;
  x: number;
  y: number;
  z: number;
  kind: RayHitKind;
  tag?: ColliderTag;
}

const AIRFIELD_PAD_Y = getTerrainHeight(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z) + 0.35;
const ISLAND_PAD_Y = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z) + 0.7;
const CITADEL_PAD_Y = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;

const TAG_HEIGHT: Record<ColliderTag, number> = {
  barricade: 1.15,
  wreck: 1.35,
  vehicle: 1.45,
  bunker: 2.55,
  'citadel-wall': 3.15,
  wall: 3.2,
  structure: 4.75,
  rock: 2.2,
  tree: 5.2,
  'bridge-pier': 9.0,
  'bridge-deck': 1.55,
};

function getSolidGroundY(x: number, z: number): number {
  let y = getTerrainHeight(x, z);

  const adx = x - AIRFIELD_CENTER_X;
  const adz = z - AIRFIELD_CENTER_Z;
  const cosA = Math.cos(0.22);
  const sinA = Math.sin(0.22);
  const alx = adx * cosA - adz * sinA;
  const alz = adx * sinA + adz * cosA;
  if (Math.abs(alx) <= 30.0 && Math.abs(alz) <= 22.0) {
    y = Math.max(y, AIRFIELD_PAD_Y);
  }

  if (Math.hypot(x - ISLAND_CENTER_X, z - ISLAND_CENTER_Z) <= ISLAND_DECK_RADIUS) {
    y = Math.max(y, ISLAND_PAD_Y);
  }

  const cdx = (x - CITADEL_CENTER_X) / (CITADEL_WALL_RX + 0.5);
  const cdz = (z - CITADEL_CENTER_Z) / (CITADEL_WALL_RZ + 0.5);
  if (Math.hypot(cdx, cdz) <= 1.0) {
    y = Math.max(y, CITADEL_PAD_Y);
  }

  return y;
}

function getColliderVerticalBounds(c: WorldCollider): [number, number] {
  const baseGround = getSolidGroundY(c.cx, c.cz);
  const minY = c.minY ?? baseGround - 0.5;
  if (c.maxY !== undefined) {
    return [minY, c.maxY];
  }
  const height = TAG_HEIGHT[c.tag] ?? 3.0;
  const baseForTop = c.minY !== undefined ? c.minY : baseGround;
  return [minY, baseForTop + height];
}

function intersectRayCircleColumn(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  c: CircleCollider,
): number | null {
  const [minY, maxY] = getColliderVerticalBounds(c);
  const relX = ox - c.cx;
  const relZ = oz - c.cz;
  const a = dx * dx + dz * dz;

  let tEnter = 0;
  let tExit = maxDist;

  if (a > 1e-9) {
    const b = 2 * (relX * dx + relZ * dz);
    const cc = relX * relX + relZ * relZ - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return null;
    const sqrtD = Math.sqrt(disc);
    const t0 = (-b - sqrtD) / (2 * a);
    const t1 = (-b + sqrtD) / (2 * a);
    tEnter = Math.max(tEnter, t0);
    tExit = Math.min(tExit, t1);
  } else {
    if (relX * relX + relZ * relZ > c.r * c.r) return null;
  }

  if (Math.abs(dy) > 1e-9) {
    const ty0 = (minY - oy) / dy;
    const ty1 = (maxY - oy) / dy;
    tEnter = Math.max(tEnter, Math.min(ty0, ty1));
    tExit = Math.min(tExit, Math.max(ty0, ty1));
  } else if (oy < minY || oy > maxY) {
    return null;
  }

  if (tEnter > tExit || tExit < 0 || tEnter > maxDist) return null;
  return Math.max(0, tEnter);
}

function intersectRayBoxColumn(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  b: BoxCollider,
): number | null {
  const [minY, maxY] = getColliderVerticalBounds(b);
  const relX = ox - b.cx;
  const relZ = oz - b.cz;

  // Inverse rotation from world to box-local space (matches worldColliders.ts)
  const lox = relX * b.cosY - relZ * b.sinY;
  const loz = relX * b.sinY + relZ * b.cosY;
  const ldx = dx * b.cosY - dz * b.sinY;
  const ldz = dx * b.sinY + dz * b.cosY;

  let tEnter = 0;
  let tExit = maxDist;

  // X slab
  if (Math.abs(ldx) > 1e-9) {
    const tx0 = (-b.halfW - lox) / ldx;
    const tx1 = (b.halfW - lox) / ldx;
    tEnter = Math.max(tEnter, Math.min(tx0, tx1));
    tExit = Math.min(tExit, Math.max(tx0, tx1));
  } else if (lox < -b.halfW || lox > b.halfW) {
    return null;
  }

  // Z slab
  if (Math.abs(ldz) > 1e-9) {
    const tz0 = (-b.halfD - loz) / ldz;
    const tz1 = (b.halfD - loz) / ldz;
    tEnter = Math.max(tEnter, Math.min(tz0, tz1));
    tExit = Math.min(tExit, Math.max(tz0, tz1));
  } else if (loz < -b.halfD || loz > b.halfD) {
    return null;
  }

  // Y slab
  if (Math.abs(dy) > 1e-9) {
    const ty0 = (minY - oy) / dy;
    const ty1 = (maxY - oy) / dy;
    tEnter = Math.max(tEnter, Math.min(ty0, ty1));
    tExit = Math.min(tExit, Math.max(ty0, ty1));
  } else if (oy < minY || oy > maxY) {
    return null;
  }

  if (tEnter > tExit || tExit < 0 || tEnter > maxDist) return null;
  return Math.max(0, tEnter);
}

function sampleBridgeDeckHit(px: number, py: number, pz: number): boolean {
  for (let i = 0; i < BRIDGE_SPECS.length; i++) {
    const deckY = getBridgeDeckYAt(BRIDGE_SPECS[i], px, pz);
    if (deckY !== null && py <= deckY + 0.14 && py >= deckY - 0.58) {
      return true;
    }
  }
  return false;
}

/**
 * Casts a 3D combat ray against terrain heightfield, bridge decks, and static world obstacles.
 * Returns the closest hit within maxDist, or null if unobstructed.
 */
export function castCombatRay(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): CombatRayHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9 || maxDist <= 0) return null;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;

  let bestHit: CombatRayHit | null = null;
  let bestDist = maxDist;

  // 1. Static OBB & Cylinder Obstacle Colliders along the XZ segment
  const endX = ox + ndx * maxDist;
  const endZ = oz + ndz * maxDist;
  const candidates = queryCollidersAlongSegment(ox, oz, endX, endZ);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const t =
      c.kind === 'circle'
        ? intersectRayCircleColumn(ox, oy, oz, ndx, ndy, ndz, bestDist, c)
        : intersectRayBoxColumn(ox, oy, oz, ndx, ndy, ndz, bestDist, c);
    if (t !== null && t < bestDist) {
      bestDist = t;
      bestHit = {
        distance: t,
        x: ox + ndx * t,
        y: oy + ndy * t,
        z: oz + ndz * t,
        kind: 'obstacle',
        tag: c.tag,
      };
    }
  }

  // 2. Terrain heightfield + elevated pads + bridge decks up to bestDist
  const step = 1.25;
  let prevT = 0;
  for (let t = 0.5; t <= bestDist; t += step) {
    const px = ox + ndx * t;
    const py = oy + ndy * t;
    const pz = oz + ndz * t;

    if (sampleBridgeDeckHit(px, py, pz)) {
      let lo = prevT;
      let hi = t;
      for (let r = 0; r < 4; r++) {
        const mid = (lo + hi) * 0.5;
        if (sampleBridgeDeckHit(ox + ndx * mid, oy + ndy * mid, oz + ndz * mid)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      if (hi < bestDist) {
        return {
          distance: hi,
          x: ox + ndx * hi,
          y: oy + ndy * hi,
          z: oz + ndz * hi,
          kind: 'bridge',
        };
      }
      break;
    }

    const groundY = getSolidGroundY(px, pz);
    if (py <= groundY) {
      let lo = prevT;
      let hi = t;
      for (let r = 0; r < 4; r++) {
        const mid = (lo + hi) * 0.5;
        const mx = ox + ndx * mid;
        const my = oy + ndy * mid;
        const mz = oz + ndz * mid;
        if (my <= getSolidGroundY(mx, mz)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      if (hi < bestDist) {
        return {
          distance: hi,
          x: ox + ndx * hi,
          y: oy + ndy * hi,
          z: oz + ndz * hi,
          kind: 'terrain',
        };
      }
      break;
    }
    prevT = t;
  }

  return bestHit;
}

/**
 * Returns true if segment A -> B is unobstructed by terrain, bridge decks, or solid obstacles.
 */
export function hasLineOfSight(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.25) return true;
  const hit = castCombatRay(ax, ay, az, dx, dy, dz, dist - 0.35);
  return hit === null;
}
