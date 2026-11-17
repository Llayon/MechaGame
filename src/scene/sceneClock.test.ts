import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSceneClock } from './sceneClock';

test('scene clock freezes all ticks for arbitrarily long pause and resumes without catch-up', () => {
  const clock = { elapsed: 12.5, ticks: 250 };
  for (let i = 0; i < 1000; i++) {
    assert.equal(advanceSceneClock(clock, 0.05, true), 12.5);
  }
  assert.equal(clock.ticks, 250);
  assert.equal(advanceSceneClock(clock, 300, false), 12.55);
  assert.equal(clock.ticks, 251);
});

test('scene clock clamps slow frames and ignores invalid or negative deltas', () => {
  const clock = { elapsed: 0, ticks: 0 };
  for (const delta of [0, -1, Number.NaN, Infinity]) {
    advanceSceneClock(clock, delta, false);
  }
  assert.equal(clock.elapsed, 0);
  assert.equal(clock.ticks, 0);
  advanceSceneClock(clock, 0.016, false);
  assert.equal(clock.elapsed, 0.016);
  advanceSceneClock(clock, 0.5, false);
  assert.equal(clock.elapsed, 0.066);
  assert.equal(clock.ticks, 2);
});
