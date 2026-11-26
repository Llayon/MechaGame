import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_LAST_BENCHMARK_ROUTES,
  MAX_SHADER_WATER_RIPPLES,
  PINE_LOD_DITHER_CONFIG,
  type ShaderWaterRipple,
  computePercentile,
  computePineLodCrossFade,
  computeShaderRippleParams,
  evaluateComplementaryDither,
  evaluateWaterRippleSlope2D,
  parseGroundLastFlag,
  selectTopWaterRipples,
  summarizeTimingSamples,
} from './renderPerfAndVfxMath';
import {
  computeRippleTransform,
  createWaterVfxPool,
  spawnWaterRipple,
  stepWaterVfxPool,
} from './objects/waterVfxPool';

describe('renderPerfAndVfxMath', () => {
  it('parses ?groundLast=0|1 flags and computes exact p50/p95 timing summaries', () => {
    assert.equal(parseGroundLastFlag(''), true);
    assert.equal(parseGroundLastFlag('?graphics=high'), true);
    assert.equal(parseGroundLastFlag('?groundLast=0'), false);
    assert.equal(parseGroundLastFlag('?graphics=high&groundLast=false'), false);
    assert.equal(parseGroundLastFlag('?groundLast=1'), true);
    assert.equal(parseGroundLastFlag('?groundLast=true', false), true);

    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(computePercentile(sorted, 0.5), 5.5);
    assert.ok(Math.abs(computePercentile(sorted, 0.95) - 9.55) < 1e-9);

    const summary = summarizeTimingSamples([12, 8, 20, 10, 16]);
    assert.equal(summary.count, 5);
    assert.equal(summary.p50Ms, 12);
    assert.equal(summary.minMs, 8);
    assert.equal(summary.maxMs, 20);
    assert.ok(summary.p95Ms >= summary.p50Ms && summary.p95Ms <= summary.maxMs);

    assert.ok(GROUND_LAST_BENCHMARK_ROUTES['refinery-citadel']);
    assert.ok(GROUND_LAST_BENCHMARK_ROUTES['open-canyon']);
  });

  it('selects top-4 closest/strongest water ripples and aligns normal wave crest with WaterEffects ring', () => {
    const pool = createWaterVfxPool();
    // Spawn 6 ripples at varying distances from focus (0, 0)
    spawnWaterRipple(pool, 180, 180, 1.0); // very far
    spawnWaterRipple(pool, 4, 2, 1.2); // very close
    spawnWaterRipple(pool, -140, 90, 1.0); // far
    spawnWaterRipple(pool, -6, 3, 1.5); // close + strong
    spawnWaterRipple(pool, 12, -8, 1.0); // near
    spawnWaterRipple(pool, -15, -10, 1.1); // near
    stepWaterVfxPool(pool, 0.25);

    const out: ShaderWaterRipple[] = Array.from({ length: MAX_SHADER_WATER_RIPPLES }, () => ({
      x: 0,
      z: 0,
      radius: 0,
      amplitude: 0,
      outerRadius: 0,
      invBandWidth: 1,
      waveFreq: 4,
      progress: 0,
    }));

    const count = selectTopWaterRipples(pool.ripples, 0, 0, out);
    assert.equal(count, 4);

    // The two very distant ripples (180,180) and (-140,90) must be excluded in favor of the 4 near ones
    for (let i = 0; i < count; i++) {
      const dist = Math.hypot(out[i].x, out[i].z);
      assert.ok(dist < 30, `expected top-4 near ripples, got dist=${dist}`);
      assert.ok(out[i].amplitude > 0.05);
    }

    // Verify primary crest radius tracks computeRippleTransform ring scale cleanly
    const tf = { x: 0, y: 0, z: 0, scale: 0, alpha: 0, progress: 0 };
    assert.equal(computeRippleTransform(pool.ripples[1], tf), true);
    const single: ShaderWaterRipple = { ...out[0] };
    assert.equal(computeShaderRippleParams(pool.ripples[1], single), true);
    assert.ok(Math.abs(single.radius - tf.scale * 0.5 * 0.74) < 1e-6);

    // Evaluate 2D normal slope: zero when empty, zero outside outerRadius, non-zero on ring flank, damped afar
    assert.deepEqual(evaluateWaterRippleSlope2D(single.x + single.radius, single.z, [single], 0, 0.05), [0, 0]);
    assert.deepEqual(
      evaluateWaterRippleSlope2D(single.x + single.outerRadius + 1.0, single.z, [single], 1, 0.05),
      [0, 0],
    );

    const [stNear, sbNear] = evaluateWaterRippleSlope2D(
      single.x + single.radius + 0.22,
      single.z,
      [single],
      1,
      0.04,
    );
    assert.ok(Math.abs(stNear) > 0.02, `expected active radial slope along X, got ${stNear}`);
    assert.ok(Math.abs(sbNear) < 1e-6, `pure +X offset should produce pure tangent slope, got ${sbNear}`);

    const [stFar] = evaluateWaterRippleSlope2D(
      single.x + single.radius + 0.22,
      single.z,
      [single],
      1,
      4.0,
    );
    assert.ok(Math.abs(stFar) < Math.abs(stNear) * 0.1, 'far pixel footprint must Nyquist-damp ripple slope');
  });

  it('computes targeted 14% Pine LOD 1-2 dither cross-fade with discrete shadows and off on Low', () => {
    const thresholds = [75, 17];
    const cellId = 5;

    assert.ok(Math.abs(PINE_LOD_DITHER_CONFIG.totalBandFraction - 0.14) < 1e-9);

    // On Low preset (ditherEnabled=false): never cross-fades at any projected size
    for (const px of [12, 16, 17, 18, 22, 74, 76]) {
      const state = computePineLodCrossFade(px, 1, thresholds, cellId, false);
      assert.equal(state.fadeOut, 0);
      assert.equal(state.cardFadeIn, 0);
    }

    // At LOD 0 <-> LOD 1 boundary (~75 px): no dither cross-fade (only LOD 1 <-> LOD 2 is dithered)
    const lod01 = computePineLodCrossFade(75, 0, thresholds, cellId, true);
    assert.equal(lod01.fadeOut, 0);
    assert.equal(lod01.cardFadeIn, 0);

    // Inside the 14% LOD 1 <-> LOD 2 band: monotonic fadeOut/cardFadeIn in (0,1), discrete shadow switches at midpoint
    // Find exact midpoint for cellId=5 by scanning around 17
    const samples: Array<{ px: number; fade: number; shadow: number }> = [];
    for (let px = 14.0; px <= 21.0; px += 0.2) {
      const s = computePineLodCrossFade(px, 1, thresholds, cellId, true);
      if (s.fadeOut > 0) {
        assert.equal(s.primaryLevel, 1);
        assert.equal(s.fadeOut, s.cardFadeIn);
        assert.ok(s.discreteShadowLevel === 1 || s.discreteShadowLevel === 2);
        samples.push({ px, fade: s.fadeOut, shadow: s.discreteShadowLevel });
      }
    }
    assert.ok(samples.length >= 8, `expected samples inside 14% LOD 1-2 band, got ${samples.length}`);
    // As projected pixels increase (approaching tree), fadeOut toward cards strictly decreases
    for (let i = 1; i < samples.length; i++) {
      assert.ok(samples[i].fade < samples[i - 1].fade);
    }
    // Shadow level switches discretely from 2 (far side) to 1 (near side)
    assert.equal(samples[0].shadow, 2);
    assert.equal(samples[samples.length - 1].shadow, 1);

    // Complementary screen-space dither guarantees zero holes and zero double-pixel overlap
    for (const fadeT of [0.15, 0.5, 0.85]) {
      for (let k = 0; k < 20; k++) {
        const ign = k / 20;
        const { keepPrimary, keepSecondary } = evaluateComplementaryDither(ign, fadeT);
        assert.notEqual(keepPrimary, keepSecondary);
      }
    }
  });
});
