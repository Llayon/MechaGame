import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HEAT_SHIMMER_SLOTS,
  computeHeatShimmerRenderData,
  createHeatShimmerPool,
  resetHeatShimmerPool,
  spawnHeatShimmer,
  stepHeatShimmerPool,
  type HeatShimmerRenderData,
} from './heatShimmerPool';

test('heat shimmer pool spawns, advances buoyantly, and expires cleanly', () => {
  const pool = createHeatShimmerPool(4);
  assert.equal(pool.activeCount, 0);

  const ok = spawnHeatShimmer(pool, {
    x: 10,
    y: 4,
    z: -6,
    vx: 1.0,
    vy: 2.0,
    vz: -0.5,
    width: 1.2,
    height: 2.4,
    intensity: 0.9,
    maxAge: 0.5,
    warmTint: 0.8,
  });
  assert.equal(ok, true);
  assert.equal(pool.activeCount, 1);
  assert.equal(pool.dirty, true);

  // Non-finite spawn coordinates are rejected safely
  assert.equal(spawnHeatShimmer(pool, { x: Number.NaN, y: 0, z: 0 }), false);
  assert.equal(pool.activeCount, 1);

  const tf: HeatShimmerRenderData = {
    x: 0,
    y: 0,
    z: 0,
    scaleX: 0,
    scaleY: 0,
    lifeNorm: 0,
    alpha: 0,
    seed: 0,
    riseSpeed: 0,
    warmTint: 0,
  };

  // Step 0.1s (in 0.05s increments)
  stepHeatShimmerPool(pool, 0.05);
  stepHeatShimmerPool(pool, 0.05);
  assert.equal(pool.activeCount, 1);
  assert.ok(pool.slots[0].y > 4.18);
  assert.equal(computeHeatShimmerRenderData(pool.slots[0], tf), true);
  assert.ok(tf.alpha > 0.4);
  assert.ok(tf.scaleX >= 1.2 * 0.85);

  // Step past maxAge (0.5s) -> expires
  for (let i = 0; i < 10; i++) {
    stepHeatShimmerPool(pool, 0.05);
  }
  assert.equal(pool.activeCount, 0);
  assert.equal(computeHeatShimmerRenderData(pool.slots[0], tf), false);
});

test('heat shimmer ring buffer overwrites oldest slots at capacity and resets', () => {
  const pool = createHeatShimmerPool(3);
  for (let i = 0; i < 5; i++) {
    spawnHeatShimmer(pool, { x: i * 2, y: 1, z: 0, maxAge: 2.0 });
  }
  assert.equal(pool.activeCount, 3);
  // Cursor wrapped: slots[0] = x:6, slots[1] = x:8, slots[2] = x:4
  assert.equal(pool.slots[0].x, 6);
  assert.equal(pool.slots[1].x, 8);
  assert.equal(pool.slots[2].x, 4);

  resetHeatShimmerPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.slots.every((s) => !s.active), true);
  assert.equal(MAX_HEAT_SHIMMER_SLOTS >= 32, true);
});
