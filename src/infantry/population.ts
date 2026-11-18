import packedLanes from './patrolLanes.json';

export const SQUAD_SIZE = 25;
export const CROWD_CLIPS = ['idle', 'walk', 'run', 'crouch'] as const;
type Clip = (typeof CROWD_CLIPS)[number];

export interface PatrolLane {
  x: number;
  z: number;
  dx: number;
  dz: number;
  heights: number[];
}

export interface Soldier {
  readonly id: number;
  readonly squad: number;
  readonly friendly: boolean;
  readonly lane: PatrolLane;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  distance: number;
  direction: number;
  wait: number;
  clip: Clip;
  phase: number;
}

export const PATROL_LENGTH = 3;
const lanes: PatrolLane[] = packedLanes.map(([x, z, dx, dz, ...heights]) => ({ x, z, dx, dz, heights }));

function placeOnLane(actor: Soldier) {
  const { lane, distance } = actor;
  actor.x = lane.x + lane.dx * distance;
  actor.z = lane.z + lane.dz * distance;
  const k = Math.min(lane.heights.length - 2, Math.floor(distance * 2));
  actor.y = lane.heights[k] + (lane.heights[k + 1] - lane.heights[k]) * (distance * 2 - k);
  actor.yaw = Math.atan2(lane.dx * actor.direction, lane.dz * actor.direction);
}

export function createInfantryPopulation(): Soldier[] {
  return lanes.map((lane, id) => {
    const actor: Soldier = {
      id,
      squad: Math.floor(id / SQUAD_SIZE),
      friendly: id < 50,
      lane,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      hp: 15,
      distance: (id * 0.713) % PATROL_LENGTH,
      direction: id % 2 ? 1 : -1,
      wait: id % 4 === 0 ? (id % 7) + 0.2 : 0,
      clip: 'idle',
      phase: (id * 0.618033989) % 1,
    };
    placeOnLane(actor);
    return actor;
  });
}

export function stepInfantry(
  population: Soldier[],
  dt: number,
  playerX: number,
  playerZ: number,
  alerted: boolean,
) {
  for (const actor of population) {
    if (actor.hp <= 0) continue;
    const nearby = alerted && (actor.x - playerX) ** 2 + (actor.z - playerZ) ** 2 < 30 ** 2;
    if (actor.wait > 0) {
      actor.wait -= dt;
      actor.clip = nearby ? 'crouch' : 'idle';
    } else {
      actor.clip = nearby ? 'run' : 'walk';
      const speed = nearby ? 0.793657 : 0.373513;
      actor.distance += actor.direction * dt * speed;
      if (actor.distance >= PATROL_LENGTH || actor.distance <= 0) {
        actor.distance = Math.max(0, Math.min(PATROL_LENGTH, actor.distance));
        actor.direction *= -1;
        actor.wait = 0.5 + (actor.id % 9) * 0.38;
      }
      placeOnLane(actor);
    }
    // Durations of the authored game clips. Phase is in cycles, independent of the render batch.
    const duration =
      actor.clip === 'walk' ? 29 / 30 : actor.clip === 'run' ? 0.7 : actor.clip === 'idle' ? 2.5 : 2.1;
    actor.phase = (actor.phase + dt / duration) % 1;
  }
}

// Test a compact body ellipsoid against the already normalized shot ray and closest world/vehicle hit.
export function traceHostileInfantry(
  population: Soldier[],
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  limit: number,
) {
  let hit: Soldier | undefined;
  let distance = limit;
  const rx = 0.13,
    ry = 0.24;
  const a = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
  if (a <= 0) return null;
  for (const actor of population) {
    if (actor.hp <= 0 || actor.friendly) continue;
    const ax = x - actor.x,
      ay = y - actor.y - ry,
      az = z - actor.z;
    const b = (ax * dx + az * dz) / (rx * rx) + (ay * dy) / (ry * ry);
    const c = (ax * ax + az * az) / (rx * rx) + (ay * ay) / (ry * ry) - 1;
    const discriminant = b * b - a * c;
    if (discriminant < 0 || (b > 0 && c > 0)) continue;
    const t = Math.max(0, (-b - Math.sqrt(discriminant)) / a);
    if (t < distance) {
      hit = actor;
      distance = t;
    }
  }
  return hit ? { actor: hit, distance } : null;
}

export function splashHostileInfantry(
  population: Soldier[],
  x: number,
  y: number,
  z: number,
  radius: number,
  damage: number,
) {
  let hits = 0;
  for (const actor of population) {
    if (actor.friendly || actor.hp <= 0) continue;
    if ((x - actor.x) ** 2 + (y - actor.y - 0.24) ** 2 + (z - actor.z) ** 2 > radius * radius) continue;
    actor.hp = Math.max(0, actor.hp - damage);
    hits++;
  }
  return hits;
}
