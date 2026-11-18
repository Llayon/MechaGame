import test from 'node:test';
import assert from 'node:assert/strict';
import { getWalkableSurfaceY } from './mechKinematics';
import { MAP_HALF_D, MAP_HALF_W } from './terrainMath';
import { resolveWorldObstacles } from './worldColliders';
import {
  INFANTRY_PER_SITE, INFANTRY_SITES, getInfantryPost, getInfantrySlot, getInfantrySquad,
} from './infantryEncounters';

type Point = { x: number; z: number };

function sampleLeg(from: Point, to: Point, site: string) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.3));
  let previousY = getWalkableSurfaceY(from.x, from.z).y;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const { y, inWater, onBridge } = getWalkableSurfaceY(x, z);
    const location = site + ' (' + x.toFixed(1) + ', ' + z.toFixed(1) + ')';
    assert.ok(Math.abs(x) < MAP_HALF_W && Math.abs(z) < MAP_HALF_D, location);
    assert.ok(!inWater && y > 0, location);
    if (site === 'crossing') assert.ok(onBridge, location);
    assert.ok(Math.abs(y - previousY) < 0.16, 'Height discontinuity at ' + location);
    assert.ok(!resolveWorldObstacles(x, z, y, 0.16).collided, 'Obstructed at ' + location);
    previousY = y;
  }
}

test('all five sectors have room for both starting formations', () => {
  assert.equal(new Set(INFANTRY_SITES.map(site => site.sectorId)).size, 5);
  assert.equal(INFANTRY_SITES.length, 5);
  for (const site of INFANTRY_SITES) {
    const slots: Point[] = [];
    for (const team of ['friendly', 'enemy'] as const) {
      for (let i = 0; i < INFANTRY_PER_SITE[team]; i++) {
        const p = getInfantrySlot(site, team, i);
        assert.ok(slots.every(q => Math.hypot(p.x - q.x, p.z - q.z) > 0.38));
        slots.push(p);
        sampleLeg(p, team === 'enemy' ? p : {
          x: p.x + Math.sin(site.yaw) * 1.2,
          z: p.z + Math.cos(site.yaw) * 1.2,
        }, site.sectorId);
      }
    }
  }
});

test('squads can walk their beats and retreat to hard cover from either direction', () => {
  for (const site of INFANTRY_SITES) {
    for (let i = 0; i < INFANTRY_PER_SITE.enemy; i++) {
      const { squadIndex, memberIndex } = getInfantrySquad(i);
      const { patrol: [a, b], cover } = getInfantryPost(site, squadIndex, memberIndex);
      sampleLeg(a, b, site.sectorId);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        sampleLeg({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, cover, site.sectorId);
      }

      // Trace back through the assigned cover edge. Its obstacle must exist at this elevation.
      const facing = site.posts[squadIndex][2] * Math.PI / 180;
      const y = getWalkableSurfaceY(cover.x, cover.z).y;
      const obstacle = [0.45, 0.7, 0.95, 1.2, 1.45, 1.7].map(distance =>
        resolveWorldObstacles(cover.x - distance * Math.sin(facing),
          cover.z - distance * Math.cos(facing), y, 0.16)).find(hit => hit.collided);
      assert.ok(obstacle, 'Missing cover at ' + site.id + ' squad ' + squadIndex);
      if (site.sectorId === 'crossing' && squadIndex >= 3 && squadIndex <= 5) {
        assert.equal(obstacle.hitTag, 'bridge-deck');
      }
      if ((site.sectorId === 'citadel' || site.sectorId === 'quarry') && squadIndex === 3) {
        assert.equal(obstacle.hitTag, 'bunker');
      }
    }
  }
});
