import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_AA_CONFIG,
  buildWaterAntiAliasingGlsl,
  computeWaterAntiAliasing,
} from './waterAntiAliasing';

test('near-field water preserves crisp ripples, specular sharpness, and full shoreline foam contrast', () => {
  const near = computeWaterAntiAliasing({
    pixelSize: 0.12,
    normalGradSq: 0,
    baseRoughness: 0.08,
    baseClearcoatRoughness: 0.05,
    foam: 0,
  });
  assert.ok(Math.abs(near.roughness - 0.08) < 1e-6);
  assert.ok(Math.abs(near.clearcoatRoughness - 0.05) < 1e-6);
  assert.equal(near.normalDamp, 0);
  assert.equal(near.clearcoatNormalDamp, 0);
  assert.equal(near.microFoamWeight, 1);
  assert.equal(near.surfWaveWeight, 1);
});

test('roughness and clearcoat roughness increase monotonically into satin band with footprint and normal slope', () => {
  const footprints = [0.1, 0.35, 0.7, 1.2, 2.0, 3.4, 8.0];
  const samples = footprints.map((pixelSize) =>
    computeWaterAntiAliasing({ pixelSize, normalGradSq: 0, foam: 0 }),
  );

  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].roughness >= samples[i - 1].roughness, 'base roughness must be monotonic');
    assert.ok(
      samples[i].clearcoatRoughness >= samples[i - 1].clearcoatRoughness,
      'clearcoat roughness must be monotonic',
    );
    assert.ok(samples[i].normalDamp >= samples[i - 1].normalDamp, 'normal damping must be monotonic');
    assert.ok(samples[i].microFoamWeight <= samples[i - 1].microFoamWeight, 'micro foam weight must decay');
    assert.ok(samples[i].surfWaveWeight <= samples[i - 1].surfWaveWeight, 'surf wave weight must decay');
  }

  // Far grazing angle reaches natural satin (0.32..0.42), never flat chalk or raw mirror.
  const far = samples[samples.length - 1];
  assert.ok(far.roughness >= 0.34 && far.roughness <= 0.42, `expected satin roughness, got ${far.roughness}`);
  assert.ok(
    far.clearcoatRoughness >= 0.30 && far.clearcoatRoughness <= 0.38,
    `expected satin clearcoat, got ${far.clearcoatRoughness}`,
  );
  assert.equal(far.microFoamWeight, 0);
  assert.equal(far.surfWaveWeight, 0);

  // Mid-range normal derivative variance suppresses sharp fireflies before mipmaps flatten normals.
  const midFlat = computeWaterAntiAliasing({ pixelSize: 0.5, normalGradSq: 0 });
  const midSharpWave = computeWaterAntiAliasing({ pixelSize: 0.5, normalGradSq: 0.18 });
  assert.ok(midSharpWave.roughness > midFlat.roughness + 0.1);
  assert.ok(midSharpWave.clearcoatRoughness > midFlat.clearcoatRoughness + 0.1);
  assert.ok(midSharpWave.roughness <= 0.42);
});

test('dense shoreline foam preserves matte roughness and clearcoat suppression at any distance', () => {
  const nearFoam = computeWaterAntiAliasing({ pixelSize: 0.15, normalGradSq: 0, foam: 0.9 });
  const farFoam = computeWaterAntiAliasing({ pixelSize: 5.0, normalGradSq: 0.5, foam: 0.9 });

  assert.ok(nearFoam.roughness >= 0.75 && nearFoam.roughness <= 0.85);
  assert.ok(farFoam.roughness >= nearFoam.roughness && farFoam.roughness <= 0.9);
  assert.ok(nearFoam.clearcoatFactor < 0.2);
  assert.equal(farFoam.clearcoatFactor, nearFoam.clearcoatFactor);
});

test('non-finite or negative shader inputs stay safely clamped in [0, 1]', () => {
  const safe = computeWaterAntiAliasing({
    pixelSize: Number.NaN,
    normalGradSq: -5,
    clearcoatNormalGradSq: Number.POSITIVE_INFINITY,
    foam: Number.NaN,
  });
  assert.ok(Number.isFinite(safe.roughness) && safe.roughness >= 0.045 && safe.roughness <= 1);
  assert.ok(
    Number.isFinite(safe.clearcoatRoughness) &&
      safe.clearcoatRoughness >= 0.045 &&
      safe.clearcoatRoughness <= 1,
  );
});

test('generated GLSL chunks use strictly ascending smoothstep edges matching WATER_AA_CONFIG', () => {
  const cfg = WATER_AA_CONFIG;
  assert.ok(cfg.footprintMin < cfg.footprintMax);
  assert.ok(cfg.normalDampMin < cfg.normalDampMax);
  assert.ok(cfg.clearcoatNormalDampMin < cfg.clearcoatNormalDampMax);
  assert.ok(cfg.microFoamMin < cfg.microFoamMax);
  assert.ok(cfg.surfWaveMin < cfg.surfWaveMax);

  const chunks = Object.values(buildWaterAntiAliasingGlsl()).join('\n');
  const rx = /\bsmoothstep\s*\(\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,/g;
  let count = 0;
  for (const match of chunks.matchAll(rx)) {
    count++;
    const low = Number(match[1]);
    const high = Number(match[2]);
    assert.ok(low < high, `GLSL smoothstep edge ${low} must be < ${high}`);
  }
  assert.equal(count, 5, 'expected all 5 smoothstep ramps in water AA GLSL');
});
