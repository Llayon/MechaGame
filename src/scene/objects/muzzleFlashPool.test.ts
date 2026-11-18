import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MUZZLE_FLASHES,
  computeMuzzleFlashRenderData,
  createMuzzleFlashPool,
  resetMuzzleFlashPool,
  spawnMuzzleFlash,
  stepMuzzleFlashPool,
  type MuzzleFlashRenderData,
} from './muzzleFlashPool';

function makeOut(): MuzzleFlashRenderData {
  return {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: 0,
    dz: 1,
    roll: 0,
    scaleXZ: 1,
    scaleZ: 1,
    lifeNorm: 0,
    seed: 0,
    r: 1,
    g: 1,
    b: 1,
    intensity: 1,
  };
}

test('createMuzzleFlashPool starts empty with expected capacity', () => {
  const pool = createMuzzleFlashPool();
  assert.equal(pool.slots.length, MAX_MUZZLE_FLASHES);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.dirty, false);
});

test('spawnMuzzleFlash normalizes direction, clamps duration, and varies roll across shots', () => {
  const pool = createMuzzleFlashPool(8);
  const idx0 = spawnMuzzleFlash(pool, {
    x: 10,
    y: 5,
    z: -4,
    dx: 3,
    dy: 0,
    dz: 4,
    scaleXZ: 0.9,
    scaleZ: 1.1,
    duration: 0.002,
    r: 0.4,
    g: 0.9,
    b: 1.0,
    intensity: 1.6,
  });
  const idx1 = spawnMuzzleFlash(pool, {
    x: 10,
    y: 5,
    z: -4,
    dx: 0,
    dy: 0,
    dz: 0, // fallback to +Z
  });

  assert.equal(idx0, 0);
  assert.equal(idx1, 1);
  assert.equal(pool.activeCount, 2);
  assert.equal(pool.dirty, true);

  const s0 = pool.slots[0];
  assert.ok(Math.abs(s0.dx - 0.6) < 1e-6);
  assert.ok(Math.abs(s0.dz - 0.8) < 1e-6);
  assert.equal(s0.maxAge, 0.02); // clamped floor
  assert.equal(s0.r, 0.4);
  assert.equal(s0.g, 0.9);
  assert.equal(s0.b, 1.0);
  assert.equal(s0.intensity, 1.6);

  const s1 = pool.slots[1];
  assert.deepEqual([s1.dx, s1.dy, s1.dz], [0, 0, 1]);
  assert.notEqual(s0.roll, s1.roll);
  assert.notEqual(s0.seed, s1.seed);
});

test('stepMuzzleFlashPool advances lifeNorm and expires flashes cleanly', () => {
  const pool = createMuzzleFlashPool(4);
  spawnMuzzleFlash(pool, {
    x: 0,
    y: 1,
    z: 2,
    dx: 0,
    dy: 0,
    dz: 1,
    duration: 0.06,
  });

  const out = makeOut();
  assert.equal(computeMuzzleFlashRenderData(pool.slots[0], out), true);
  assert.equal(out.lifeNorm, 0);

  const remaining = stepMuzzleFlashPool(pool, 0.03);
  assert.equal(remaining, 1);
  assert.equal(computeMuzzleFlashRenderData(pool.slots[0], out), true);
  assert.ok(Math.abs(out.lifeNorm - 0.5) < 1e-6);

  const afterExpire = stepMuzzleFlashPool(pool, 0.04);
  assert.equal(afterExpire, 0);
  assert.equal(computeMuzzleFlashRenderData(pool.slots[0], out), false);
});

test('ring buffer wraps cleanly at capacity without exceeding activeCount', () => {
  const pool = createMuzzleFlashPool(4);
  for (let i = 0; i < 10; i++) {
    spawnMuzzleFlash(pool, {
      x: i,
      y: 0,
      z: 0,
      dx: 1,
      dy: 0,
      dz: 0,
      duration: 0.1,
    });
  }
  assert.equal(pool.activeCount, 4);
  assert.equal(pool.cursor, 10 % 4);
  assert.equal(pool.slots[1].x, 9);
});

test('resetMuzzleFlashPool deactivates all slots and marks dirty', () => {
  const pool = createMuzzleFlashPool(4);
  spawnMuzzleFlash(pool, { x: 1, y: 2, z: 3, dx: 0, dy: 0, dz: 1 });
  pool.dirty = false;
  resetMuzzleFlashPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.cursor, 0);
  assert.equal(pool.dirty, true);
  assert.equal(pool.slots.some((s) => s.active), false);
});
