import {
  SCALE_Y,
  WATER_LEVEL,
  distToSegment,
  getTerrainHeight,
} from './terrainMath';
import type { BoxCollider, CircleCollider, WorldCollider } from './worldColliders';

export const EAST_CROSSING_WEST_ABUTMENT: readonly [number, number] = [32.0, 72.4];
export const EAST_CROSSING_EAST_ABUTMENT: readonly [number, number] = [79.5, 42.0];
export const EAST_CROSSING_WEST_DECK_Y = 1.78 * SCALE_Y;
export const EAST_CROSSING_EAST_DECK_Y = 2.25 * SCALE_Y;
export const EAST_CROSSING_WIDTH = 8.4;

const EAST_DX = EAST_CROSSING_EAST_ABUTMENT[0] - EAST_CROSSING_WEST_ABUTMENT[0];
const EAST_DZ = EAST_CROSSING_EAST_ABUTMENT[1] - EAST_CROSSING_WEST_ABUTMENT[1];
export const EAST_CROSSING_YAW = Math.atan2(EAST_DX, EAST_DZ);

export interface BrokenAbutmentStub {
  id: 'east-abutment-west' | 'east-abutment-east';
  x: number;
  z: number;
  deckY: number;
  yaw: number; // points out over the river from bank edge
  width: number;
  stubLength: number;
  collapsedDropPitch: number;
}

export const EAST_CROSSING_ABUTMENT_STUBS: ReadonlyArray<BrokenAbutmentStub> = [
  {
    id: 'east-abutment-west',
    x: EAST_CROSSING_WEST_ABUTMENT[0],
    z: EAST_CROSSING_WEST_ABUTMENT[1],
    deckY: EAST_CROSSING_WEST_DECK_Y,
    yaw: EAST_CROSSING_YAW,
    width: EAST_CROSSING_WIDTH,
    stubLength: 6.2,
    collapsedDropPitch: 0.28,
  },
  {
    id: 'east-abutment-east',
    x: EAST_CROSSING_EAST_ABUTMENT[0],
    z: EAST_CROSSING_EAST_ABUTMENT[1],
    deckY: EAST_CROSSING_EAST_DECK_Y,
    yaw: EAST_CROSSING_YAW + Math.PI,
    width: EAST_CROSSING_WIDTH,
    stubLength: 6.4,
    collapsedDropPitch: 0.25,
  },
];

export type FloodedRuinKind =
  | 'pump-hall'
  | 'collapsed-pier'
  | 'gantry-frame'
  | 'pipeline-manifold'
  | 'grounded-barge'
  | 'intake-caisson';

export interface FloodedRuinCluster {
  id: string;
  kind: FloodedRuinKind;
  x: number;
  z: number;
  rotY: number;
  exclusionRadius: number;
  coverTopY: number;
}

export const FLOODED_RUIN_CLUSTERS: ReadonlyArray<FloodedRuinCluster> = [
  {
    id: 'ruin-pump-hall',
    kind: 'pump-hall',
    x: 43.0,
    z: 52.0,
    rotY: 0.48,
    exclusionRadius: 6.4,
    coverTopY: WATER_LEVEL + 3.1,
  },
  {
    id: 'ruin-pipeline-manifold',
    kind: 'pipeline-manifold',
    x: 49.5,
    z: 70.5,
    rotY: 0.85,
    exclusionRadius: 4.5,
    coverTopY: WATER_LEVEL + 2.9,
  },
  {
    id: 'ruin-collapsed-pier',
    kind: 'collapsed-pier',
    x: 57.5,
    z: 58.0,
    rotY: EAST_CROSSING_YAW,
    exclusionRadius: 5.4,
    coverTopY: WATER_LEVEL + 3.2,
  },
  {
    id: 'ruin-intake-caisson',
    kind: 'intake-caisson',
    x: 54.5,
    z: 38.5,
    rotY: 0.18,
    exclusionRadius: 3.6,
    coverTopY: WATER_LEVEL + 3.6,
  },
  {
    id: 'ruin-gantry-frame',
    kind: 'gantry-frame',
    x: 73.0,
    z: 58.5,
    rotY: -0.35,
    exclusionRadius: 5.2,
    coverTopY: WATER_LEVEL + 4.3,
  },
  {
    id: 'ruin-grounded-barge',
    kind: 'grounded-barge',
    x: 66.0,
    z: 26.0,
    rotY: -0.42,
    exclusionRadius: 6.8,
    coverTopY: WATER_LEVEL + 3.5,
  },
];

export interface FloodedWaterBoxObstacle {
  kind: 'box';
  cx: number;
  cz: number;
  cos: number;
  sin: number;
  hx: number;
  hz: number;
}

export interface FloodedWaterCircleObstacle {
  kind: 'circle';
  cx: number;
  cz: number;
  radius: number;
}

export type FloodedWaterObstacle = FloodedWaterBoxObstacle | FloodedWaterCircleObstacle;

function localToWorldXZ(
  ox: number,
  oz: number,
  rotY: number,
  lx: number,
  lz: number,
): [number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

function makeBoxCollider(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  rotY: number,
  tag: WorldCollider['tag'],
  minY?: number,
  maxY?: number,
): BoxCollider {
  return {
    kind: 'box',
    cx,
    cz,
    halfW: width * 0.5,
    halfD: depth * 0.5,
    cosY: Math.cos(rotY),
    sinY: Math.sin(rotY),
    minY,
    maxY,
    tag,
  };
}

function makeCircleCollider(
  cx: number,
  cz: number,
  r: number,
  tag: WorldCollider['tag'],
  minY?: number,
  maxY?: number,
): CircleCollider {
  return {
    kind: 'circle',
    cx,
    cz,
    r,
    minY,
    maxY,
    tag,
  };
}

export interface RuinColliderEntry {
  clusterId: string;
  collider: WorldCollider;
}

/**
 * Generates deterministic colliders for all 6 flooded industrial ruins
 * plus shore abutment drop-off barricades at the collapsed East Crossing.
 */
export function getFloodedRuinColliderEntries(): RuinColliderEntry[] {
  const entries: RuinColliderEntry[] = [];
  const subMinY = WATER_LEVEL - 5.5;

  // 1. Broken East Crossing shore abutment barriers & collapsed edge slabs
  // Prevents Mechs walking straight off the 9-unit cliff while keeping side ramps open
  for (const stub of EAST_CROSSING_ABUTMENT_STUBS) {
    const [bx, bz] = localToWorldXZ(stub.x, stub.z, stub.yaw, 0, 2.2);
    entries.push({
      clusterId: stub.id,
      collider: makeBoxCollider(
        bx,
        bz,
        stub.width + 0.6,
        2.1,
        stub.yaw,
        'barricade',
        stub.deckY - 2.5,
        stub.deckY + 3.4,
      ),
    });

    // Side wing walls on abutment head
    for (const side of [-1, 1]) {
      const [wx, wz] = localToWorldXZ(stub.x, stub.z, stub.yaw, side * (stub.width * 0.5 - 0.25), 0.5);
      entries.push({
        clusterId: stub.id,
        collider: makeBoxCollider(
          wx,
          wz,
          0.75,
          4.4,
          stub.yaw,
          'wall',
          stub.deckY - 2.5,
          stub.deckY + 2.4,
        ),
      });
    }
  }

  // 2. Flooded Pump Station Hall: twin broken parallel walls with a 6.4 u navigable bay between them
  {
    const c = FLOODED_RUIN_CLUSTERS[0];
    for (const side of [-1, 1]) {
      const [wx, wz] = localToWorldXZ(c.x, c.z, c.rotY, side * 3.8, 0);
      entries.push({
        clusterId: c.id,
        collider: makeBoxCollider(wx, wz, 1.25, 8.2, c.rotY, 'wall', subMinY, c.coverTopY),
      });
    }
  }

  // 3. Flooded Pipeline Manifold & Surge Tank
  {
    const c = FLOODED_RUIN_CLUSTERS[1];
    entries.push({
      clusterId: c.id,
      collider: makeBoxCollider(c.x, c.z, 5.2, 3.3, c.rotY, 'structure', subMinY, c.coverTopY),
    });
  }

  // 4. Collapsed Center Bridge Pier & Leaning Span Slab
  {
    const c = FLOODED_RUIN_CLUSTERS[2];
    entries.push({
      clusterId: c.id,
      collider: makeBoxCollider(c.x, c.z, 7.2, 4.4, c.rotY, 'bridge-pier', subMinY, c.coverTopY),
    });
  }

  // 5. Submerged Cooling-Water Intake Tower Caisson
  {
    const c = FLOODED_RUIN_CLUSTERS[3];
    entries.push({
      clusterId: c.id,
      collider: makeCircleCollider(c.x, c.z, 2.35, 'structure', subMinY, c.coverTopY),
    });
  }

  // 6. Half-Sunken Port Gantry Crane Frame (twin steel support legs with 5.4 u under-pass clear)
  {
    const c = FLOODED_RUIN_CLUSTERS[4];
    for (const side of [-1, 1]) {
      const [lx, lz] = localToWorldXZ(c.x, c.z, c.rotY, side * 3.4, 0);
      entries.push({
        clusterId: c.id,
        collider: makeBoxCollider(
          lx,
          lz,
          1.4,
          4.1,
          c.rotY,
          'structure',
          subMinY,
          side < 0 ? c.coverTopY : c.coverTopY - 0.6,
        ),
      });
    }
  }

  // 7. Grounded / Capsizing Industrial Cargo Barge + Deck Container
  {
    const c = FLOODED_RUIN_CLUSTERS[5];
    entries.push({
      clusterId: c.id,
      collider: makeBoxCollider(c.x, c.z, 4.4, 10.2, c.rotY, 'wreck', subMinY, c.coverTopY),
    });
  }

  return entries;
}

export function getFloodedRuinColliders(): WorldCollider[] {
  return getFloodedRuinColliderEntries().map((e) => e.collider);
}

/**
 * Water obstruction SDF shapes fed into `waterDepth.ts` so shoreline foam and ripples
 * wrap every flooded concrete pier, pump hall wall, intake caisson, and grounded barge.
 */
export function getFloodedRuinWaterObstacles(): FloodedWaterObstacle[] {
  const obs: FloodedWaterObstacle[] = [];

  // Pump hall twin walls
  {
    const c = FLOODED_RUIN_CLUSTERS[0];
    const cos = Math.cos(c.rotY);
    const sin = Math.sin(c.rotY);
    for (const side of [-1, 1]) {
      const [wx, wz] = localToWorldXZ(c.x, c.z, c.rotY, side * 3.8, 0);
      obs.push({ kind: 'box', cx: wx, cz: wz, cos, sin, hx: 0.68, hz: 4.15 });
    }
  }

  // Pipeline manifold
  {
    const c = FLOODED_RUIN_CLUSTERS[1];
    obs.push({
      kind: 'box',
      cx: c.x,
      cz: c.z,
      cos: Math.cos(c.rotY),
      sin: Math.sin(c.rotY),
      hx: 2.65,
      hz: 1.7,
    });
  }

  // Collapsed bridge pier
  {
    const c = FLOODED_RUIN_CLUSTERS[2];
    obs.push({
      kind: 'box',
      cx: c.x,
      cz: c.z,
      cos: Math.cos(c.rotY),
      sin: Math.sin(c.rotY),
      hx: 3.65,
      hz: 2.25,
    });
  }

  // Intake caisson
  {
    const c = FLOODED_RUIN_CLUSTERS[3];
    obs.push({
      kind: 'circle',
      cx: c.x,
      cz: c.z,
      radius: 2.45,
    });
  }

  // Gantry legs
  {
    const c = FLOODED_RUIN_CLUSTERS[4];
    const cos = Math.cos(c.rotY);
    const sin = Math.sin(c.rotY);
    for (const side of [-1, 1]) {
      const [lx, lz] = localToWorldXZ(c.x, c.z, c.rotY, side * 3.4, 0);
      obs.push({ kind: 'box', cx: lx, cz: lz, cos, sin, hx: 0.75, hz: 2.1 });
    }
  }

  // Grounded cargo barge
  {
    const c = FLOODED_RUIN_CLUSTERS[5];
    obs.push({
      kind: 'box',
      cx: c.x,
      cz: c.z,
      cos: Math.cos(c.rotY),
      sin: Math.sin(c.rotY),
      hx: 2.25,
      hz: 5.15,
    });
  }

  // Fallen broken abutment slabs sticking out into the bank edges
  for (const stub of EAST_CROSSING_ABUTMENT_STUBS) {
    const [sx, sz] = localToWorldXZ(stub.x, stub.z, stub.yaw, 0, stub.stubLength + 2.0);
    obs.push({
      kind: 'box',
      cx: sx,
      cz: sz,
      cos: Math.cos(stub.yaw),
      sin: Math.sin(stub.yaw),
      hx: stub.width * 0.45,
      hz: 2.4,
    });
  }

  return obs;
}

export function isInsideFloodedRuinsFootprint(x: number, z: number, margin = 0): boolean {
  for (let i = 0; i < FLOODED_RUIN_CLUSTERS.length; i++) {
    const c = FLOODED_RUIN_CLUSTERS[i];
    if (Math.hypot(x - c.x, z - c.z) < c.exclusionRadius + margin) {
      return true;
    }
  }
  const corridorDist = distToSegment(
    x,
    z,
    EAST_CROSSING_WEST_ABUTMENT[0],
    EAST_CROSSING_WEST_ABUTMENT[1],
    EAST_CROSSING_EAST_ABUTMENT[0],
    EAST_CROSSING_EAST_ABUTMENT[1],
  );
  if (corridorDist < EAST_CROSSING_WIDTH * 0.75 + margin) {
    return true;
  }
  return false;
}

export function getBrokenAbutmentGroundY(stub: BrokenAbutmentStub): number {
  return getTerrainHeight(stub.x, stub.z);
}
