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
  assert.equal(MAX_CRATER_DECALS, 128);
});

import { stepCraterPool, traceLaserCut } from './craterPool';

test('explicit vertical wall normals place ballistic pockmarks offset from wall without terrain clamp', () => {
  const pool = createCraterPool(8);
  const ok = spawnCraterDecal(pool, 140, MECH_SPAWN.y + 4.5, -50, 0.42, 0.9, 0.3, {
    nx: 1,
    ny: 0,
    nz: 0,
    kind: 1,
  });
  assert.equal(ok, true);
  const d = pool.decals[0];
  assert.equal(d.kind, 1);
  assert.ok(Math.abs(d.nx - 1) < 1e-4 && Math.abs(d.ny) < 1e-4);
  assert.ok(d.x > 140.01 && d.x < 140.1, `Expected slight outward offset along +X, got x=${d.x}`);
});

test('stepCraterPool ages decals and expires them past maxAge; traceLaserCut stitches molten slag without bridging air', () => {
  const pool = createCraterPool(16);
  spawnCraterDecal(pool, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 1.2, 1.0, 0, {
    nx: 0,
    ny: 1,
    nz: 0,
    kind: 2,
    maxAge: 0.08,
  });
  assert.equal(pool.activeCount, 1);
  stepCraterPool(pool, 0.05);
  assert.equal(pool.activeCount, 1);
  stepCraterPool(pool, 0.05);
  assert.equal(pool.activeCount, 0);

  let pt = traceLaserCut(pool, null, MECH_SPAWN.x, MECH_SPAWN.y + 1, MECH_SPAWN.z, 0, 1, 0, 0.44);
  const afterFirst = pool.activeCount;
  assert.equal(afterFirst, 1);
  pt = traceLaserCut(pool, pt, MECH_SPAWN.x + 1.2, MECH_SPAWN.y + 1, MECH_SPAWN.z, 0, 1, 0, 0.44);
  assert.ok(pool.activeCount > afterFirst, 'Expected traceLaserCut to stamp intermediate slag decals');
  assert.equal(pool.decals[0].kind, 2);

  // Far jump resets stroke cleanly instead of bridging empty air
  const beforeJump = pool.activeCount;
  pt = traceLaserCut(pool, pt, MECH_SPAWN.x + 25, MECH_SPAWN.y + 1, MECH_SPAWN.z, 0, 1, 0, 0.44);
  assert.equal(pool.activeCount, beforeJump + 1);
});

