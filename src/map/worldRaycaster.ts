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
  getAnalyticalTerrainNormal,
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
import { getTitanWreckDeckYAt } from './titanWrecks';

export type RayHitKind = 'terrain' | 'bridge' | 'obstacle';

export interface CombatRayHit {
  distance: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  kind: RayHitKind;
  tag?: ColliderTag;
}

interface RayPrimitiveHit {
  t: number;
  nx: number;
  ny: number;
  nz: number;
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
  'titan-wreck': 4.8,
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
): RayPrimitiveHit | null {
  const [minY, maxY] = getColliderVerticalBounds(c);
  const relX = ox - c.cx;
  const relZ = oz - c.cz;
  const a = dx * dx + dz * dz;

  let tEnter = 0;
  let tExit = maxDist;
  let hitSource: 'side' | 'yMin' | 'yMax' = 'side';

  if (a > 1e-9) {
    const b = 2 * (relX * dx + relZ * dz);
    const cc = relX * relX + relZ * relZ - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return null;
    const sqrtD = Math.sqrt(disc);
    const t0 = (-b - sqrtD) / (2 * a);
    const t1 = (-b + sqrtD) / (2 * a);
    if (t0 > tEnter) {
      tEnter = t0;
      hitSource = 'side';
    }
    tExit = Math.min(tExit, t1);
  } else {
    if (relX * relX + relZ * relZ > c.r * c.r) return null;
  }

  if (Math.abs(dy) > 1e-9) {
    const raw0 = (minY - oy) / dy;
    const raw1 = (maxY - oy) / dy;
    const tyEnter = Math.min(raw0, raw1);
    const tyExit = Math.max(raw0, raw1);
    if (tyEnter > tEnter) {
      tEnter = tyEnter;
      hitSource = raw0 < raw1 ? 'yMin' : 'yMax';
    }
    tExit = Math.min(tExit, tyExit);
  } else if (oy < minY || oy > maxY) {
    return null;
  }

  if (tEnter > tExit || tExit < 0 || tEnter > maxDist) return null;
  const t = Math.max(0, tEnter);

  if (hitSource === 'yMax') {
    return { t, nx: 0, ny: 1, nz: 0 };
  }
  if (hitSource === 'yMin') {
    return { t, nx: 0, ny: -1, nz: 0 };
  }

  const hx = ox + dx * t - c.cx;
  const hz = oz + dz * t - c.cz;
  const hLen = Math.hypot(hx, hz);
  if (hLen > 1e-5) {
    return { t, nx: hx / hLen, ny: 0, nz: hz / hLen };
  }
  return { t, nx: -dx, ny: 0, nz: -dz };
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
): RayPrimitiveHit | null {
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
  let lnx = 0;
  let lny = 1;
  let lnz = 0;

  // X slab
  if (Math.abs(ldx) > 1e-9) {
    const raw0 = (-b.halfW - lox) / ldx;
    const raw1 = (b.halfW - lox) / ldx;
    const txEnter = Math.min(raw0, raw1);
    const txExit = Math.max(raw0, raw1);
    if (txEnter > tEnter) {
      tEnter = txEnter;
      lnx = raw0 < raw1 ? -1 : 1;
      lny = 0;
      lnz = 0;
    }
    tExit = Math.min(tExit, txExit);
  } else if (lox < -b.halfW || lox > b.halfW) {
    return null;
  }

  // Z slab
  if (Math.abs(ldz) > 1e-9) {
    const raw0 = (-b.halfD - loz) / ldz;
    const raw1 = (b.halfD - loz) / ldz;
    const tzEnter = Math.min(raw0, raw1);
    const tzExit = Math.max(raw0, raw1);
    if (tzEnter > tEnter) {
      tEnter = tzEnter;
      lnx = 0;
      lny = 0;
      lnz = raw0 < raw1 ? -1 : 1;
    }
    tExit = Math.min(tExit, tzExit);
  } else if (loz < -b.halfD || loz > b.halfD) {
    return null;
  }

  // Y slab
  if (Math.abs(dy) > 1e-9) {
    const raw0 = (minY - oy) / dy;
    const raw1 = (maxY - oy) / dy;
    const tyEnter = Math.min(raw0, raw1);
    const tyExit = Math.max(raw0, raw1);
    if (tyEnter > tEnter) {
      tEnter = tyEnter;
      lnx = 0;
      lny = raw0 < raw1 ? -1 : 1;
      lnz = 0;
    }
    tExit = Math.min(tExit, tyExit);
  } else if (oy < minY || oy > maxY) {
    return null;
  }

  if (tEnter > tExit || tExit < 0 || tEnter > maxDist) return null;
  const t = Math.max(0, tEnter);

  // Rotate local box normal back to world XZ coordinates
  const nx = lnx * b.cosY + lnz * b.sinY;
  const nz = -lnx * b.sinY + lnz * b.cosY;
  return { t, nx, ny: lny, nz };
}

function sampleBridgeDeckHit(px: number, py: number, pz: number): boolean {
  for (let i = 0; i < BRIDGE_SPECS.length; i++) {
    const deckY = getBridgeDeckYAt(BRIDGE_SPECS[i], px, pz);
    if (deckY !== null && py <= deckY + 0.14 && py >= deckY - 0.58) {
      return true;
    }
  }
  const titanDeckY = getTitanWreckDeckYAt(px, pz);
  if (titanDeckY !== null && py <= titanDeckY + 0.14 && py >= titanDeckY - 0.85) {
    return true;
  }
  return false;
}

/**
 * Casts a 3D combat ray against terrain heightfield, bridge decks, and static world obstacles.
 * Returns the closest hit within maxDist with outward surface normal, or null if unobstructed.
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
    const hit =
      c.kind === 'circle'
        ? intersectRayCircleColumn(ox, oy, oz, ndx, ndy, ndz, bestDist, c)
        : intersectRayBoxColumn(ox, oy, oz, ndx, ndy, ndz, bestDist, c);
    if (hit !== null && hit.t < bestDist) {
      bestDist = hit.t;
      bestHit = {
        distance: hit.t,
        x: ox + ndx * hit.t,
        y: oy + ndy * hit.t,
        z: oz + ndz * hit.t,
        nx: hit.nx,
        ny: hit.ny,
        nz: hit.nz,
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
          nx: 0,
          ny: 1,
          nz: 0,
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
        const hx = ox + ndx * hi;
        const hy = oy + ndy * hi;
        const hz = oz + ndz * hi;
        const n = getAnalyticalTerrainNormal(hx, hz, 1.5, false);
        return {
          distance: hi,
          x: hx,
          y: hy,
          z: hz,
          nx: n.nx,
          ny: n.ny,
          nz: n.nz,
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
