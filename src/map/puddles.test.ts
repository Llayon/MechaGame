import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePuddleAt, puddleHash21 } from './puddles';

test('puddleHash21 stays finite and non-degenerate even at far outer mountain coordinates', () => {
  const samples = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const h = puddleHash21(740 + i, -680 + i * 2);
    assert.ok(Number.isFinite(h) && h >= 0 && h <= 1);
    samples.add(Math.round(h * 1000));
  }
  assert.ok(samples.size > 10, 'hash should not collapse at large world coords');
});

test('evaluatePuddleAt suppresses puddles on slopes, riverbanks, high peaks, and concrete slabs', () => {
  // Too low (riverbank territory <= 1.25)
  assert.equal(evaluatePuddleAt(10, 0.8, 10, 1.0).wetness, 0);
  // Too high (highland cliffs / mountains >= 14.5)
  assert.equal(evaluatePuddleAt(10, 16.0, 10, 1.0).wetness, 0);
  // Too steep (slope < 0.945 normal Y)
  assert.equal(evaluatePuddleAt(10, 4.0, 10, 0.88).wetness, 0);
  // Concrete slab / shore exclusion
  assert.equal(evaluatePuddleAt(10, 4.0, 10, 1.0, { exclusionMask: 1 }).wetness, 0);
});

test('evaluatePuddleAt finds flat lowland road/meadow puddles with damp soil rims and sharp water cores', () => {
  let foundWetRim = false;
  let foundWaterCore = false;

  for (let x = -120; x <= 120; x += 2.5) {
    for (let z = -100; z <= 100; z += 2.5) {
      const sample = evaluatePuddleAt(x, 4.0, z, 0.995, { isRoad: true });
      if (sample.wetSoil > 0.4 && sample.waterFactor < 0.1) {
        foundWetRim = true;
      }
      if (sample.waterFactor > 0.9) {
        foundWaterCore = true;
      }
      if (foundWetRim && foundWaterCore) break;
    }
    if (foundWetRim && foundWaterCore) break;
  }

  assert.ok(foundWetRim, 'expected damp soil margin around puddles');
  assert.ok(foundWaterCore, 'expected standing water puddle core on flat road');
});
