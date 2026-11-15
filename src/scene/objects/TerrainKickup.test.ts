import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KICKUP_POOL_SIZE,
  computePebbleTransform,
  createKickupPool,
  resetKickupPool,
  spawnKickupBurst,
  stepKickupPool,
  type PebbleTransform,
} from './TerrainKickup';

function seededRng(seed = 1337): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('spawnKickupBurst launches backward parabolic pebbles within fixed pool capacity', () => {
  const pool = createKickupPool(40);
  assert.equal(pool.slots.length, KICKUP_POOL_SIZE);

  spawnKickupBurst(pool, {
    originX: 10,
    originY: 2.2,
    originZ: 20,
    dirX: 0,
    dirZ: -1, // thrown backward along -Z
    groundY: 2.0,
    count: 5,
    speedScale: 1.2,
    rng: seededRng(7),
  });

  const active = stepKickupPool(pool, 0.05);
  assert.equal(active, 5);

  const out: PebbleTransform = {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
  };
  for (let i = 0; i < 5; i++) {
    const ok = computePebbleTransform(pool.slots[i], out);
    assert.equal(ok, true);
    assert.ok(out.y > 2.04, `pebble ${i} should arc upward initially, got y=${out.y}`);
    assert.ok(out.z < 20.1, `pebble ${i} should fly backward toward -Z, got z=${out.z}`);
    assert.ok(out.sx > 0 && out.sy > 0 && out.sz > 0);
  }
});

test('pebbles follow y = vy*t - 0.5*g*t^2, clamp above groundY, and expire cleanly', () => {
  const pool = createKickupPool(16);
  spawnKickupBurst(pool, {
    originX: 0,
    originY: 1.0,
    originZ: 0,
    dirX: -1,
    dirZ: 0,
    groundY: 1.0,
    count: 4,
    rng: seededRng(42),
  });

  const out: PebbleTransform = {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
  };

  stepKickupPool(pool, 0.14);
  computePebbleTransform(pool.slots[0], out);
  const peakY = out.y;
  assert.ok(peakY > 1.15, `expected upward parabolic arc, got ${peakY}`);

  // Advance close to end of flight so pebble drops to groundY and clamps cleanly
  stepKickupPool(pool, 0.38);
  if (pool.slots[0].active) {
    computePebbleTransform(pool.slots[0], out);
    assert.ok(out.y >= 1.04, `pebble must never fall below groundY+0.04, got ${out.y}`);
  }

  // Advance past maxLife
  const remaining = stepKickupPool(pool, 1.0);
  assert.equal(remaining, 0);
  assert.equal(computePebbleTransform(pool.slots[0], out), false);
  assert.equal(out.sx, 0);
});

test('ring buffer wraps safely when bursts exceed capacity and resetKickupPool clears all', () => {
  const pool = createKickupPool(8);
  for (let b = 0; b < 5; b++) {
    spawnKickupBurst(pool, {
      originX: b,
      originY: 0.5,
      originZ: 0,
      dirX: 0,
      dirZ: -1,
      groundY: 0.4,
      count: 4,
      rng: seededRng(b + 1),
    });
  }
  const active = stepKickupPool(pool, 0.01);
  assert.equal(active, 8);

  resetKickupPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(stepKickupPool(pool, 0.01), 0);
});
