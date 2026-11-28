import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHICS_CRASH_SENTINEL_KEY, GRAPHICS_PRESETS, GRAPHICS_STORAGE_KEY, MIN_RESOLUTION_SCALE,
  beginGraphicsStartupSentinel, bootGraphicsSettings, changeGraphicsSetting,
  clearGraphicsStartupSentinel, defaultGraphicsSettings, readGraphicsSettings,
  recommendAutoQuality, recommendGraphicsPreset, resolveGraphicsRuntime,
  sanitizeGraphicsSettings, stepDownGraphicsPreset, withGraphicsPreset,
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
  assert.equal(
    sanitizeGraphicsSettings({ ...withGraphicsPreset('low'), resolutionScale: 0.3 }).resolutionScale,
    MIN_RESOLUTION_SCALE,
  );
});

test('custom settings survive serialization, corruption and invalid values', () => {
  const base = withGraphicsPreset('high');
  const custom = changeGraphicsSetting(base, 'resolutionScale', .75);
  assert.equal(custom.preset, 'custom');
  assert.equal(custom.resolutionScale, .75);
  assert.equal(changeGraphicsSetting(custom, 'shadows', 'off').shadows, 'off');
  const withAuto = changeGraphicsSetting(base, 'autoQuality', true);
  assert.equal(withAuto.preset, 'high');
  assert.equal(withAuto.autoQuality, true);
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
  assert.equal(recommendAutoQuality({mobile:true}), true);
  assert.equal(recommendAutoQuality({mobile:false,deviceMemoryGB:4}), true);
  assert.equal(recommendAutoQuality({mobile:false,hardwareConcurrency:16}), false);
});

test('cold-start crash sentinel steps down one preset tier after interrupted startup and disarms after first frame', () => {
  assert.equal(stepDownGraphicsPreset('ultra'), 'high');
  assert.equal(stepDownGraphicsPreset('high'), 'balanced');
  assert.equal(stepDownGraphicsPreset('balanced'), 'low');
  assert.equal(stepDownGraphicsPreset('low'), 'low');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  store.set(GRAPHICS_STORAGE_KEY, JSON.stringify({ version: 1, settings: withGraphicsPreset('ultra') }));

  // 1. Clean cold start: keeps 'ultra' and arms crash sentinel
  const cleanBoot = bootGraphicsSettings(mockStorage);
  assert.equal(cleanBoot.downgradedFromCrash, false);
  assert.equal(cleanBoot.settings.preset, 'ultra');
  assert.equal(store.get(GRAPHICS_CRASH_SENTINEL_KEY), '1');

  // 2. Next boot WITHOUT clearGraphicsStartupSentinel (simulated tab/GPU driver crash during compile):
  // steps down ultra -> high and persists safer preset
  const crashRecovery1 = bootGraphicsSettings(mockStorage);
  assert.equal(crashRecovery1.downgradedFromCrash, true);
  assert.equal(crashRecovery1.settings.preset, 'high');
  assert.equal(readGraphicsSettings(mockStorage).preset, 'high');
  assert.equal(store.get(GRAPHICS_CRASH_SENTINEL_KEY), '1');

  // 3. Another crash before first frame: steps down high -> balanced
  const crashRecovery2 = bootGraphicsSettings(mockStorage);
  assert.equal(crashRecovery2.downgradedFromCrash, true);
  assert.equal(crashRecovery2.settings.preset, 'balanced');

  // 4. First overview frame completes: clearGraphicsStartupSentinel disarms sentinel
  clearGraphicsStartupSentinel(mockStorage);
  assert.equal(store.has(GRAPHICS_CRASH_SENTINEL_KEY), false);

  // 5. Subsequent normal reload keeps 'balanced' without stepping down
  const afterCleanFinish = bootGraphicsSettings(mockStorage);
  assert.equal(afterCleanFinish.downgradedFromCrash, false);
  assert.equal(afterCleanFinish.settings.preset, 'balanced');

  // Direct sentinel helpers also work independently
  clearGraphicsStartupSentinel(mockStorage);
  assert.deepEqual(beginGraphicsStartupSentinel(mockStorage), { hadUncleanStartup: false });
  assert.deepEqual(beginGraphicsStartupSentinel(mockStorage), { hadUncleanStartup: true });
});

