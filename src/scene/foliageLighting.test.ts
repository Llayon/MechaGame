import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLIAGE_TRANSMITTANCE_PRESETS,
  computeFoliageTransmittance,
  computeIgn,
  computeMipAwareAlphaThreshold,
  computeTravelingWindOffset,
  computeTriangularIgnDither,
} from './foliageLightingMath';
import { chooseLod, lodJitter } from '../lod/worldLod';

test('computeFoliageTransmittance peaks when looking through canopy toward sun and follows dusk > day > night', () => {
  const sunDir = FOLIAGE_TRANSMITTANCE_PRESETS.dusk.defaultSunPos;
  const sLen = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);
  const towardSun: [number, number, number] = [
    sunDir[0] / sLen,
    sunDir[1] / sLen,
    sunDir[2] / sLen,
  ];
  const awayFromSun: [number, number, number] = [
    -towardSun[0],
    -towardSun[1],
    -towardSun[2],
  ];
  const backFacingNormal: [number, number, number] = [
    -towardSun[0],
    0.2,
    -towardSun[2],
  ];
  const albedo: [number, number, number] = [0.22, 0.34, 0.18];

  const backlitDusk = computeFoliageTransmittance({
    viewRayDir: towardSun,
    worldNormal: backFacingNormal,
    sunDir,
    albedo,
    lightingPreset: 'dusk',
    translucency: 1,
  });
  const frontlitDusk = computeFoliageTransmittance({
    viewRayDir: awayFromSun,
    worldNormal: backFacingNormal,
    sunDir,
    albedo,
    lightingPreset: 'dusk',
    translucency: 1,
  });
  const backlitDay = computeFoliageTransmittance({
    viewRayDir: towardSun,
    worldNormal: backFacingNormal,
    sunDir,
    albedo,
    lightingPreset: 'day',
    translucency: 1,
  });
  const backlitNight = computeFoliageTransmittance({
    viewRayDir: towardSun,
    worldNormal: backFacingNormal,
    sunDir,
    albedo,
    lightingPreset: 'night',
    translucency: 1,
  });
  const bark = computeFoliageTransmittance({
    viewRayDir: towardSun,
    worldNormal: backFacingNormal,
    sunDir,
    albedo,
    lightingPreset: 'dusk',
    translucency: 0,
  });

  // Backlit canopy must strongly exceed non-backlit view and warm amber-green > blue
  assert.ok(backlitDusk[0] > frontlitDusk[0] * 2.0);
  assert.ok(backlitDusk[1] > backlitDusk[2]);
  // Dusk silhouette glow is stronger in warm red channel than day, and both exceed night
  assert.ok(backlitDusk[0] > backlitDay[0]);
  assert.ok(backlitDay[1] > backlitNight[1] * 2.0);
  assert.deepEqual(bark, [0, 0, 0]);
});

test('computeTravelingWindOffset produces quadratic height bend and coherent traveling gusts', () => {
  const root = computeTravelingWindOffset({
    worldX: 40,
    worldZ: -20,
    heightNorm: 0,
    timeSec: 3.0,
    amplitude: 0.7,
  });
  const mid = computeTravelingWindOffset({
    worldX: 40,
    worldZ: -20,
    heightNorm: 0.5,
    timeSec: 3.0,
    amplitude: 0.7,
  });
  const tip = computeTravelingWindOffset({
    worldX: 40,
    worldZ: -20,
    heightNorm: 1.0,
    timeSec: 3.0,
    amplitude: 0.7,
  });

  assert.deepEqual(root, [0, 0, 0]);
  assert.ok(Math.abs(tip[0] - mid[0] * 4) < 1e-6, 'Quadratic height bend should scale 4x from h=0.5 to h=1.0');
  assert.ok(tip[1] <= 0, 'Bending arcs slightly downward');

  // A point 20 units upwind has the same wave phase earlier/later as the wave travels
  const waveAtT0 = computeTravelingWindOffset({
    worldX: 0,
    worldZ: 0,
    heightNorm: 1,
    timeSec: 0,
    amplitude: 1,
  });
  const waveTraveled = computeTravelingWindOffset({
    worldX: 11,
    worldZ: 0,
    heightNorm: 1,
    timeSec: 1.0, // 11 * 0.05 - 1.0 * 0.55 = 0
    amplitude: 1,
  });
  assert.ok(Math.abs(waveAtT0[0] - waveTraveled[0]) < 1e-6);
});

test('computeMipAwareAlphaThreshold eases monotonically with mip level and stays safely clamped', () => {
  const close = computeMipAwareAlphaThreshold(0.34, 0);
  const mid = computeMipAwareAlphaThreshold(0.34, 2);
  const far = computeMipAwareAlphaThreshold(0.34, 4);
  const extreme = computeMipAwareAlphaThreshold(0.34, 10);

  assert.equal(close, 0.34);
  assert.ok(mid < close);
  assert.ok(far < mid);
  assert.equal(far, 0.14);
  assert.equal(extreme, 0.14);
});

test('lodJitter spans [0.87, 1.13) with low-discrepancy spread and staggers chooseLod thresholds', () => {
  let min = Infinity;
  let max = -Infinity;
  const levelsAtBoundary = new Set<number>();
  for (let i = 0; i < 64; i++) {
    const j = lodJitter(i);
    assert.ok(j >= 0.87 && j < 1.13, `jitter out of range: ${j}`);
    min = Math.min(min, j);
    max = Math.max(max, j);
    levelsAtBoundary.add(chooseLod(30, -1, [50, 30, 12], i));
  }
  assert.ok(min < 0.89 && max > 1.11);
  // At exact threshold 30, staggered instances split cleanly across LOD 1 and LOD 2 (no ring pop)
  assert.deepEqual([...levelsAtBoundary].sort(), [1, 2]);
});

test('triangular IGN dithering stays within +/- 1/255 with near-zero spatial mean', () => {
  let sum = 0;
  const n = 32;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = computeIgn(x, y);
      assert.ok(u >= 0 && u < 1);
      const d = computeTriangularIgnDither(x, y);
      assert.ok(d > -1 / 255 && d < 1 / 255);
      sum += d;
    }
  }
  const mean = sum / (n * n);
  assert.ok(Math.abs(mean) < 0.0005, `Expected near-zero dither mean, got ${mean}`);
});
