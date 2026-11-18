// Run with bun after changing mission spawn, collision geometry, or walkable surfaces.
import { writeFileSync } from 'node:fs';
import { MECH_SPAWN, getWalkableSurfaceY } from '../../src/map/mechKinematics';
import { resolveWorldObstacles } from '../../src/map/worldColliders';
import { SQUAD_SIZE, PATROL_LENGTH, type PatrolLane } from '../../src/infantry/population';

const squads = [
  [MECH_SPAWN.x + 7, MECH_SPAWN.z - 9],
  [-98, 71],
  [-84, 45],
  [-95, -34],
  [-57, 21],
  [-18, -4],
  [42, -33],
  [91, 61],
] as const;

function makeLanes() {
  let seed = 0x18ab6;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lanes: PatrolLane[] = [];
  for (const [cx, cz] of squads) {
    for (let j = 0; j < SQUAD_SIZE; j++) {
      for (let attempt = 0; ; attempt++) {
        if (attempt >= 600) throw Error('No dry infantry lane in squad ' + lanes.length);
        const span = 10 + Math.min(24, attempt * 0.22);
        const x = cx + (random() - 0.5) * span,
          z = cz + (random() - 0.5) * span;
        const yaw = random() * Math.PI * 2;
        const dx = Math.sin(yaw),
          dz = Math.cos(yaw);
        if (lanes.some((lane) => Math.hypot(lane.x - x, lane.z - z) < 0.65)) continue;
        const heights: number[] = [];
        for (let k = 0; k <= PATROL_LENGTH * 2; k++) {
          const px = x + dx * k * 0.5,
            pz = z + dz * k * 0.5;
          const surface = getWalkableSurfaceY(px, pz, heights.at(-1));
          if (
            surface.inWater ||
            (k && Math.abs(heights[k - 1] - surface.y) > 0.16) ||
            resolveWorldObstacles(px, pz, surface.y + 0.2, 0.12).collided
          )
            break;
          heights.push(surface.y);
        }
        if (heights.length !== PATROL_LENGTH * 2 + 1) continue;
        lanes.push({ x, z, dx, dz, heights });
        break;
      }
    }
  }
  return lanes;
}

const lanes = makeLanes();
const round = (value: number) => Math.round(value * 100_000) / 100_000;
const rows = lanes.map((lane) => [lane.x, lane.z, lane.dx, lane.dz, ...lane.heights].map(round));
writeFileSync(
  'src/infantry/patrolLanes.json',
  '[\n' + rows.map((row) => '  ' + JSON.stringify(row)).join(',\n') + '\n]\n',
);
