import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TRACER_INSTANCES,
  computeRicochetDirection,
  createTracerPool,
  maybeSpawnRicochetTracer,
  resetTracerPool,
  spawnTracer,
  stepTracerPool,
} from './tracerPool';

test('spawnTracer wraps ring buffer and resetTracerPool clears active slots', () => {
  assert.equal(MAX_TRACER_INSTANCES, 128);
  const pool = createTracerPool(4);
  for (let i = 0; i < 6; i++) {
    spawnTracer(pool, {
      x: i,
      y: 2,
      z: 3,
      dx: 0,
      dy: 0,
      dz: 1,
    });
  }
  assert.equal(pool.cursor, 2);
  assert.equal(pool.slots.filter((s) => s.active).length, 4);
  assert.equal(pool.slots[0].x, 4);

  resetTracerPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.ok(pool.slots.every((s) => !s.active));
});

test('computeRicochetDirection reflects incoming vector away from outward normal', () => {
  const out = { x: 0, y: 0, z: 0 };
  const ok = computeRicochetDirection(1, -0.25, 0, 0, 1, 0, 1.23, out);
  assert.equal(ok, true);
  const len = Math.hypot(out.x, out.y, out.z);
  assert.ok(Math.abs(len - 1) < 1e-4, `Expected normalized vector, got ${len}`);
  assert.ok(out.x > 0.3, `Expected forward +X deflection, got x=${out.x}`);
  assert.ok(out.y > 0.08, `Expected upward reflection above floor normal, got y=${out.y}`);

  // Ray pointing outward along normal should not ricochet back through surface
  assert.equal(computeRicochetDirection(0, 1, 0, 0, 1, 0, 0.5, out), false);
});

test('maybeSpawnRicochetTracer spawns ricochet on shallow grazing angle and stepTracerPool advances/expires it', () => {
  const pool = createTracerPool(8);
  const spawned = maybeSpawnRicochetTracer(
    pool,
    10,
    2,
    15,
    0.96,
    -0.28,
    0,
    0,
    1,
    0,
    0.77,
    true,
  );
  assert.equal(spawned, true);
  assert.equal(pool.activeCount, 1);
  assert.equal(pool.slots[0].isRicochet, true);
  assert.ok(pool.slots[0].y > 2.0, 'Ricochet origin must be offset slightly off surface');

  const startX = pool.slots[0].x;
  stepTracerPool(pool, 0.04);
  assert.ok(pool.slots[0].x > startX, 'Ricochet tracer should travel along deflected trajectory');

  for (let i = 0; i < 12; i++) {
    stepTracerPool(pool, 0.05);
  }
  assert.equal(pool.activeCount, 0);
});
