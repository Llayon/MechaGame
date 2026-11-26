import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_WAVE_OCTAVES,
  computeAlpineSlopeMasks,
  computeAnalyticLineCoverage,
  computeHollowCrestBias,
  computeSlabJointMask,
  computeTriplanarWeights,
  computeWaterOctaveWaveAa,
  evaluateCheckerboardShadowKeep,
} from './surfaceDetailMath';

describe('surfaceDetailMath', () => {
  it('computeWaterOctaveWaveAa attenuates fine ripples first and converts lost slope variance monotonically into satin roughness', () => {
    const near = computeWaterOctaveWaveAa(0.05, 0.08, 0.05, 0);
    const mid = computeWaterOctaveWaveAa(1.2, 0.08, 0.05, 0);
    const far = computeWaterOctaveWaveAa(6.0, 0.08, 0.05, 0);

    // At every positive footprint, shorter wavelengths drop out faster than longer swells
    assert.ok(mid.octaveRetention[0] > mid.octaveRetention[1]);
    assert.ok(mid.octaveRetention[1] > mid.octaveRetention[2]);

    // Lost variance & roughness increase strictly monotonically with world pixel footprint
    assert.ok(near.lostVariance < mid.lostVariance && mid.lostVariance < far.lostVariance);
    assert.ok(near.roughness < mid.roughness && mid.roughness < far.roughness);
    assert.ok(near.clearcoatRoughness < mid.clearcoatRoughness && mid.clearcoatRoughness < far.clearcoatRoughness);

    // Close up retains crisp glossy water; far distance lands in calm satin band (~0.35..0.44)
    assert.ok(near.roughness < 0.12, `expected glossy near water, got ${near.roughness}`);
    assert.ok(far.roughness >= 0.34 && far.roughness <= 0.44, `expected satin far water, got ${far.roughness}`);

    // Wave octaves are strictly incommensurate & have orthonormal rotation matrices
    assert.ok(WATER_WAVE_OCTAVES[0].wavelengthM > WATER_WAVE_OCTAVES[1].wavelengthM);
    assert.ok(WATER_WAVE_OCTAVES[1].wavelengthM > WATER_WAVE_OCTAVES[2].wavelengthM);
    for (const oct of WATER_WAVE_OCTAVES) {
      const [m00, m01, m10, m11] = oct.rot;
      const det = m00 * m11 - m01 * m10;
      assert.ok(Math.abs(det - 1) < 1e-4, `expected orthonormal rotation det=1, got ${det}`);
    }
  });

  it('computeAnalyticLineCoverage gives 1 inside resolved lines and attenuates sub-pixel lines without aliasing', () => {
    // Fully resolved stripe: hw = 0.05m, fw = 0.02m
    assert.equal(computeAnalyticLineCoverage(0, 0.05, 0.02), 1);
    assert.ok(Math.abs(computeAnalyticLineCoverage(0.05, 0.05, 0.02) - 0.5) < 1e-12);
    assert.equal(computeAnalyticLineCoverage(0.08, 0.05, 0.02), 0);

    // Sub-pixel line (fw >> 2*hw): exact coverage = 2*hw / fw (fades cleanly to 0 at distance)
    const covFar = computeAnalyticLineCoverage(0, 0.03, 0.6);
    assert.ok(Math.abs(covFar - 0.1) < 1e-6, `expected exact sub-pixel coverage 0.1, got ${covFar}`);

    const covVeryFar = computeAnalyticLineCoverage(0, 0.03, 3.0);
    assert.ok(covVeryFar < covFar && covVeryFar > 0);

    // Periodic concrete slab grid peaks on joint lines and stays 0 in slab interior
    const onJoint = computeSlabJointMask(6.0, 2.3, 6.0, 6.0, 0.04, 0.02, 0.02);
    const inCenter = computeSlabJointMask(3.0, 3.0, 6.0, 6.0, 0.04, 0.02, 0.02);
    assert.equal(onJoint, 1);
    assert.equal(inCenter, 0);
  });

  it('computeHollowCrestBias and computeAlpineSlopeMasks separate damp hollows, dry crests, alpine scree, and sheer rock', () => {
    const hollow = computeHollowCrestBias(1.5, 6.0, 0.85);
    const crest = computeHollowCrestBias(18.0, 12.0, 0.0);
    assert.ok(hollow < -0.5, `expected negative hollow bias, got ${hollow}`);
    assert.ok(crest > 0.5, `expected positive crest bias, got ${crest}`);

    const flatMeadow = computeAlpineSlopeMasks(8, 5, 0.5, 0.5, 0.5);
    const screeApron = computeAlpineSlopeMasks(23, 12, 0.5, 0.5, 0.5);
    const sheerCliff = computeAlpineSlopeMasks(42, 16, 0.5, 0.5, 0.5);

    assert.equal(flatMeadow.rockWeight, 0);
    assert.equal(flatMeadow.screeWeight, 0);
    assert.ok(screeApron.screeWeight > 0.7 && screeApron.rockWeight < 0.1, 'mid-slope should form contrasty alpine scree band');
    assert.equal(sheerCliff.rockWeight, 1);
    assert.ok(sheerCliff.screeWeight < 0.12);
  });

  it('computeTriplanarWeights normalizes cleanly and isolates vertical cliff projections', () => {
    const [wx, wy, wz] = computeTriplanarWeights(1, 0, 0);
    assert.equal(wx, 1);
    assert.equal(wy, 0);
    assert.equal(wz, 0);

    const diag = computeTriplanarWeights(0.6, 0.5, 0.62);
    const sum = diag[0] + diag[1] + diag[2];
    assert.ok(Math.abs(sum - 1) < 1e-6);
    assert.ok(diag[0] > 0 && diag[1] > 0 && diag[2] > 0);
  });

  it('evaluateCheckerboardShadowKeep hits exact 25% (glass25) and 50% (lattice50) texel coverage', () => {
    let keep25 = 0;
    let keep50 = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (evaluateCheckerboardShadowKeep(x, y, 'glass25')) keep25++;
        if (evaluateCheckerboardShadowKeep(x, y, 'lattice50')) keep50++;
      }
    }
    assert.equal(keep25, 16); // 16 / 64 = 25%
    assert.equal(keep50, 32); // 32 / 64 = 50%
  });
});
