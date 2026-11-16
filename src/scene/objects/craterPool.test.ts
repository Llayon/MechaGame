import test from 'node:test';
import assert from 'node:assert/strict';
import { MECH_SPAWN } from '../../map/mechKinematics';
import { CITADEL_CENTER_X, CITADEL_CENTER_Z } from '../../map/terrainMath';
import {
  MAX_CRATER_DECALS,
  createCraterPool,
  resetCraterPool,
  spawnCraterDecal,
} from './craterPool';

test('spawnCraterDecal grounds onto dry terrain/pads and aligns normal cleanly', () => {
  const pool = createCraterPool(8);
  const ok = spawnCraterDecal(
    pool,
    MECH_SPAWN.x + 12,
    MECH_SPAWN.y,
    MECH_SPAWN.z - 8,
    2.4,
    1.0,
    0.4,
  );
  assert.equal(ok, true);
  assert.equal(pool.decals[0].active, true);
  assert.ok(pool.decals[0].ny > 0.72);
  assert.ok(pool.decals[0].y > 1.0);

  // Citadel pad also accepts craters cleanly
  const okCit = spawnCraterDecal(
    pool,
    CITADEL_CENTER_X,
    19.0,
    CITADEL_CENTER_Z,
    2.8,
    1.0,
    1.1,
  );
  assert.equal(okCit, true);
});

test('spawnCraterDecal suppresses craters in river water and mid-air hits', () => {
  const pool = createCraterPool(8);
  // Deep river channel point
  assert.equal(spawnCraterDecal(pool, -58, 0.0, -40, 2.0), false);
  // High mid-air shot far above ground
  assert.equal(spawnCraterDecal(pool, MECH_SPAWN.x, MECH_SPAWN.y + 12, MECH_SPAWN.z, 2.0), false);
});

test('crater ring buffer wraps at capacity and resetCraterPool clears all', () => {
  const pool = createCraterPool(4);
  for (let i = 0; i < 6; i++) {
    spawnCraterDecal(pool, MECH_SPAWN.x + i * 2, MECH_SPAWN.y, MECH_SPAWN.z, 1.8 + i * 0.1);
  }
  assert.equal(pool.cursor, 2);
  assert.ok(pool.decals.every((d) => d.active));
  assert.ok(Math.abs(pool.decals[0].x - (MECH_SPAWN.x + 8)) < 1e-4);

  resetCraterPool(pool);
  assert.equal(pool.cursor, 0);
  assert.ok(pool.decals.every((d) => !d.active));
  assert.equal(MAX_CRATER_DECALS, 32);
});
