import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MISSILE_RIBBONS,
  RIBBON_POINTS,
  createMissileRibbonPool,
  releaseMissileRibbon,
  resetMissileRibbonPool,
  spawnMissileRibbon,
  stepMissileRibbonPool,
  updateMissileRibbonHead,
} from './missileRibbonPool';

test('createMissileRibbonPool starts empty with expected capacity', () => {
  const pool = createMissileRibbonPool();
  assert.equal(pool.slots.length, MAX_MISSILE_RIBBONS);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.dirty, false);
});

test('spawnMissileRibbon fills all spine points at origin and distance-samples cleanly', () => {
  const pool = createMissileRibbonPool(8);
  const id = spawnMissileRibbon(pool, 10, 5, -3);
  assert.equal(id, 0);
  assert.equal(pool.activeCount, 1);

  const slot = pool.slots[id];
  for (let p = 0; p < RIBBON_POINTS; p++) {
    assert.equal(slot.historyX[p], 10);
    assert.equal(slot.historyY[p], 5);
    assert.equal(slot.historyZ[p], -3);
  }

  // Small sub-threshold nudge updates only head[0] without shifting spine
  updateMissileRibbonHead(pool, id, 10.1, 5.0, -3.0);
  assert.equal(slot.historyX[0], Math.fround(10.1));
  assert.equal(slot.historyX[1], 10);

  // Larger movement anchors a new spine node
  updateMissileRibbonHead(pool, id, 11.2, 5.4, -2.5);
  assert.equal(slot.historyX[0], Math.fround(11.2));
  assert.equal(slot.historyX[1], Math.fround(11.2));
  assert.equal(slot.historyX[2], 10);
});

test('releaseMissileRibbon fades out smoothly and deactivates cleanly', () => {
  const pool = createMissileRibbonPool(4);
  const id = spawnMissileRibbon(pool, 0, 2, 0);
  releaseMissileRibbon(pool, id);
  assert.equal(pool.slots[id].fadingOut, true);

  const mid = stepMissileRibbonPool(pool, 0.3);
  assert.equal(mid, 1);
  assert.ok(pool.slots[id].alpha > 0 && pool.slots[id].alpha < 1);

  const done = stepMissileRibbonPool(pool, 0.8);
  assert.equal(done, 0);
  assert.equal(pool.slots[id].active, false);
});

test('ring buffer wraps cleanly at capacity and reset clears all slots', () => {
  const pool = createMissileRibbonPool(4);
  for (let i = 0; i < 9; i++) {
    spawnMissileRibbon(pool, i, 0, 0);
  }
  assert.equal(pool.activeCount, 4);
  assert.equal(pool.cursor, 9 % 4);
  assert.equal(pool.slots[0].historyX[0], 8);

  resetMissileRibbonPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.cursor, 0);
  assert.equal(pool.slots.some((s) => s.active), false);
});
