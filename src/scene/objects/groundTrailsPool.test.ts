import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  WATER_LEVEL,
} from '../../map/terrainMath';
import { MECH_SPAWN } from '../../map/mechKinematics';
import {
  MAX_GROUND_TRAILS,
  computeGroundTrailTransform,
  createGroundTrailsPool,
  resetGroundTrailsPool,
  stampApcTrack,
  stampMechFootprint,
  stampMechSkidTrail,
  stepGroundTrailsPool,
  type GroundTrailTransform,
} from './groundTrailsPool';

test('Mech footprints and APC tracks stamp on loose dirt/meadow while skipping concrete, bridges, and water', () => {
  const pool = createGroundTrailsPool();

  // Loose grass/soil south-east of Helipad apron (-76, 86) -> accepted
  assert.equal(stampMechFootprint(pool, -76, 86, 0.4), true);
  assert.equal(stampApcTrack(pool, -74, 82, 0.5), true);
  assert.equal(stampMechSkidTrail(pool, -72, 84, 0.4), true);
  assert.equal(pool.activeCount, 3);

  // Airfield concrete pad (MECH_SPAWN) -> rejected
  assert.equal(stampMechFootprint(pool, MECH_SPAWN.x, MECH_SPAWN.z, MECH_SPAWN.yaw, MECH_SPAWN.y), false);
  assert.equal(stampApcTrack(pool, AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z, 0), false);

  // Center bridge deck -> rejected
  const centerBridge = BRIDGE_SPECS.find((b) => b.id === 'bridge-center')!;
  const bx = (centerBridge.start[0] + centerBridge.end[0]) * 0.5;
  const bz = (centerBridge.start[1] + centerBridge.end[1]) * 0.5;
  assert.equal(stampMechFootprint(pool, bx, bz, 0, centerBridge.deckY), false);

  // River bed below water level -> rejected
  assert.equal(stampMechFootprint(pool, -58, -40, 0, WATER_LEVEL), false);
  assert.equal(pool.activeCount, 3);
});

test('ground trail ring buffer fades oldest tail smoothly, expires with age, and resets cleanly', () => {
  const pool = createGroundTrailsPool(32);
  const tf: GroundTrailTransform = {
    x: 0,
    y: 0,
    z: 0,
    nx: 0,
    ny: 1,
    nz: 0,
    yaw: 0,
    width: 1,
    length: 1,
    alpha: 0,
    kindId: 0,
    wetness: 0,
  };

  for (let i = 0; i < 30; i++) {
    assert.equal(stampMechFootprint(pool, -76 + (i % 5) * 1.4, 86 - Math.floor(i / 5) * 1.2, 0.2), true);
  }
  assert.equal(pool.activeCount, 30);

  // Oldest slot should fade smoothly as ring wraps near capacity, newest slot stays strong
  assert.equal(computeGroundTrailTransform(pool.slots[0], pool.totalSpawned, 32, tf), true);
  const oldestAlpha = tf.alpha;
  assert.equal(computeGroundTrailTransform(pool.slots[29], pool.totalSpawned, 32, tf), true);
  const newestAlpha = tf.alpha;
  assert.ok(oldestAlpha < newestAlpha, `Oldest tail alpha (${oldestAlpha}) should fade below newest (${newestAlpha})`);

  // Time aging expires all slots cleanly
  for (let s = 0; s < 25; s++) {
    stepGroundTrailsPool(pool, 1.0);
  }
  assert.equal(pool.activeCount, 0);

  // Reset clears everything
  stampApcTrack(pool, -74, 82, 0.5);
  assert.equal(pool.activeCount, 1);
  resetGroundTrailsPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.totalSpawned, 0);
  assert.equal(MAX_GROUND_TRAILS >= 96, true);
});
