import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOG_SCATTER_PRESETS,
  TONE_EXPOSURE_BY_MODE,
  computeFogInScattering,
  getToneMappingExposure,
  parseToneMappingMode,
} from './atmosphereToneMapping';

test('parseToneMappingMode defaults to agx and supports aces A/B query switch', () => {
  assert.equal(parseToneMappingMode(''), 'agx');
  assert.equal(parseToneMappingMode('?graphics=high'), 'agx');
  assert.equal(parseToneMappingMode('?tonemapping=agx'), 'agx');
  assert.equal(parseToneMappingMode('?tonemapping=AGX'), 'agx');
  assert.equal(parseToneMappingMode('?tonemapping=aces'), 'aces');
  assert.equal(parseToneMappingMode('?tonemapping=ACES'), 'aces');
  assert.equal(parseToneMappingMode('tonemapping=acesfilmic&autostart=1'), 'aces');
  assert.equal(parseToneMappingMode('?tonemapping=unknown'), 'agx');
});

test('TONE_EXPOSURE_BY_MODE calibrates AgX slightly brighter than ACES across presets', () => {
  for (const preset of ['day', 'dusk', 'night'] as const) {
    const agxExp = getToneMappingExposure('agx', preset);
    const acesExp = getToneMappingExposure('aces', preset);
    assert.ok(agxExp > acesExp, `Expected AgX exposure (${agxExp}) > ACES (${acesExp}) for ${preset}`);
    assert.equal(agxExp, TONE_EXPOSURE_BY_MODE.agx[preset]);
  }
});

test('computeFogInScattering increases monotonically as view direction aligns with sun', () => {
  const camPos = [0, 12, 0] as const;
  const sunDir = [0, 0.35, -0.9367] as const;
  const preset = FOG_SCATTER_PRESETS.dusk;

  const opposite = computeFogInScattering({
    camPos,
    worldPos: [0, 8, 240],
    sunDir,
    fogFactor: 0.42,
    power: preset.power,
    strength: preset.strength,
  });
  const oblique = computeFogInScattering({
    camPos,
    worldPos: [180, 18, -160],
    sunDir,
    fogFactor: 0.42,
    power: preset.power,
    strength: preset.strength,
  });
  const aligned = computeFogInScattering({
    camPos,
    worldPos: [0, 96, -240],
    sunDir,
    fogFactor: 0.42,
    power: preset.power,
    strength: preset.strength,
  });

  assert.equal(opposite.sunCos, 0);
  assert.equal(opposite.scatterWeight, 0);
  assert.ok(oblique.scatterWeight > opposite.scatterWeight);
  assert.ok(aligned.scatterWeight > oblique.scatterWeight);
  assert.ok(aligned.scatterWeight <= 0.82);
});

test('preset hierarchy enforces dusk > day > night solar in-scattering at matching alignment', () => {
  const camPos = [0, 10, 0] as const;
  const sunDir = [0.4, 0.38, -0.834] as const;
  const worldPos = [100, 105, -210] as const;
  const fogFactor = 0.45;

  const dusk = computeFogInScattering({
    camPos,
    worldPos,
    sunDir,
    fogFactor,
    power: FOG_SCATTER_PRESETS.dusk.power,
    strength: FOG_SCATTER_PRESETS.dusk.strength,
  });
  const day = computeFogInScattering({
    camPos,
    worldPos,
    sunDir,
    fogFactor,
    power: FOG_SCATTER_PRESETS.day.power,
    strength: FOG_SCATTER_PRESETS.day.strength,
  });
  const night = computeFogInScattering({
    camPos,
    worldPos,
    sunDir,
    fogFactor,
    power: FOG_SCATTER_PRESETS.night.power,
    strength: FOG_SCATTER_PRESETS.night.strength,
  });

  assert.ok(dusk.scatterWeight > day.scatterWeight, `dusk (${dusk.scatterWeight}) should exceed day (${day.scatterWeight})`);
  assert.ok(day.scatterWeight > night.scatterWeight, `day (${day.scatterWeight}) should exceed night (${night.scatterWeight})`);
  assert.ok(night.scatterWeight > 0.03, `night (${night.scatterWeight}) should retain subtle lunar glow`);
});

test('computeFogInScattering preserves foreground clarity and handles degenerate inputs safely', () => {
  const nearForeground = computeFogInScattering({
    camPos: [0, 10, 0],
    worldPos: [5, 11, -12],
    sunDir: [5, 1, -12],
    fogFactor: 0.01,
    power: FOG_SCATTER_PRESETS.dusk.power,
    strength: FOG_SCATTER_PRESETS.dusk.strength,
  });
  assert.equal(nearForeground.scatterWeight, 0);

  const degenerate = computeFogInScattering({
    camPos: [10, 10, 10],
    worldPos: [10, 10, 10],
    sunDir: [0, 0, 0],
    fogFactor: Number.NaN,
    power: -5,
    strength: 99,
  });
  assert.equal(degenerate.sunCos, 0);
  assert.equal(degenerate.phase, 0);
  assert.equal(degenerate.scatterWeight, 0);
});
