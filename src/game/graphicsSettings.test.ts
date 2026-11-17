import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHICS_PRESETS, GRAPHICS_STORAGE_KEY, changeGraphicsSetting, defaultGraphicsSettings,
  readGraphicsSettings, recommendGraphicsPreset, resolveGraphicsRuntime,
  sanitizeGraphicsSettings, withGraphicsPreset,
} from './graphicsSettings';

test('quality presets are grounded in real renderer controls', () => {
  assert.equal(Object.keys(GRAPHICS_PRESETS).length, 4);
  assert.deepEqual(resolveGraphicsRuntime(withGraphicsPreset('low'), 2, false), {
    dpr: 1.4, renderScale: 0.7, shadowEnabled: false, shadowMapSize: 0,
    minimalVegetation: true, reducedVegetation: true, reducedParticles: true,
    atmosphereEnabled: false, fullAtmosphere: false, distantWar: false,
  });
  assert.deepEqual(resolveGraphicsRuntime(withGraphicsPreset('high'), 2, false), {
    dpr: 2, renderScale: 1, shadowEnabled: true, shadowMapSize: 2048,
    minimalVegetation: false, reducedVegetation: false, reducedParticles: false,
    atmosphereEnabled: true, fullAtmosphere: true, distantWar: true,
  });
  assert.equal(resolveGraphicsRuntime(withGraphicsPreset('ultra'), 2, false).shadowMapSize, 3072);
  assert.equal(resolveGraphicsRuntime(withGraphicsPreset('ultra'), 2, true).shadowMapSize, 1024);
  assert.equal(resolveGraphicsRuntime(withGraphicsPreset('ultra'), 2, true).dpr, 1);
});

test('GPU scale is bounded and low preset reduces pixel count', () => {
  const low = resolveGraphicsRuntime(withGraphicsPreset('low'), 2, false);
  const high = resolveGraphicsRuntime(withGraphicsPreset('high'), 2, false);
  assert.ok((low.dpr / high.dpr) ** 2 < .5);
  assert.equal(resolveGraphicsRuntime(withGraphicsPreset('low'), 0, false).dpr, .7);
  assert.equal(resolveGraphicsRuntime(withGraphicsPreset('low'), Number.NaN, false).dpr, .7);
});

test('custom settings survive serialization, corruption and invalid values', () => {
  const base = withGraphicsPreset('high');
  const custom = changeGraphicsSetting(base, 'resolutionScale', .75);
  assert.equal(custom.preset, 'custom');
  assert.equal(custom.resolutionScale, .75);
  assert.equal(changeGraphicsSetting(custom, 'shadows', 'off').shadows, 'off');
  assert.deepEqual(readGraphicsSettings({
    getItem(k) {
      assert.equal(k, GRAPHICS_STORAGE_KEY);
      return JSON.stringify({version:1,settings:custom});
    },
  }), custom);
  assert.equal(readGraphicsSettings({getItem(){return '{invalid json';}}).preset,
    defaultGraphicsSettings().preset);
  const sanitize = sanitizeGraphicsSettings({
    preset: 'high', resolutionScale: Infinity, shadows: 'invalid',
    vegetation: 'full', particles: 'full', atmosphere: 'full',
    distantWar: true,
  }, base);
  assert.deepEqual(sanitize, base);
  assert.equal(sanitizeGraphicsSettings({preset:'high',resolutionScale:.65}, base).preset, 'custom');
});

test('recommendation never assumes that every phone has a powerful GPU', () => {
  assert.equal(recommendGraphicsPreset({mobile:true}), 'balanced');
  assert.equal(recommendGraphicsPreset({mobile:false,deviceMemoryGB:2}), 'low');
  assert.equal(recommendGraphicsPreset({mobile:false,deviceMemoryGB:4}), 'balanced');
  assert.equal(recommendGraphicsPreset({mobile:false,hardwareConcurrency:2}), 'balanced');
  assert.equal(recommendGraphicsPreset({mobile:false,hardwareConcurrency:16}), 'high');
});
