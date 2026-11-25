import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUSTICS_CONFIG,
  CAUSTICS_PRESETS,
  computeMultiBounceAO,
  computeSpecularOcclusion,
  computeUnderwaterCaustics,
  computeWallBounceCaustics,
  resolveCausticsStrengths,
} from './waterCausticsMath';

test('resolveCausticsStrengths follows day > dusk > night hierarchy and disables on low preset', () => {
  const day = resolveCausticsStrengths('day', 'high');
  const dusk = resolveCausticsStrengths('dusk', 'balanced');
  const night = resolveCausticsStrengths('night', 'high');
  const lowDay = resolveCausticsStrengths('day', 'low');

  assert.equal(day.enabled, true);
  assert.equal(dusk.enabled, true);
  assert.equal(night.enabled, true);
  assert.ok(day.underwaterStrength > dusk.underwaterStrength);
  assert.ok(dusk.underwaterStrength > night.underwaterStrength);
  assert.ok(day.wallBounceStrength > dusk.wallBounceStrength);
  assert.ok(dusk.wallBounceStrength > night.wallBounceStrength);

  assert.equal(lowDay.enabled, false);
  assert.equal(lowDay.underwaterStrength, 0);
  assert.equal(lowDay.wallBounceStrength, 0);
});

test('computeUnderwaterCaustics obeys Beer-Lambert spectral absorption and fades with depth and distance', () => {
  const sunDir = CAUSTICS_PRESETS.day.defaultSunPos;
  const shallow = computeUnderwaterCaustics({
    worldPos: [12, -0.35, -8],
    worldNormal: [0, 1, 0],
    sunDir,
    lightingPreset: 'day',
    graphicsPreset: 'high',
    riverMask: 1,
    camDist: 40,
    pixelSize: 0.04,
    timeSec: 1.8,
  });
  const deep = computeUnderwaterCaustics({
    worldPos: [12, -2.0, -8],
    worldNormal: [0, 1, 0],
    sunDir,
    lightingPreset: 'day',
    graphicsPreset: 'high',
    riverMask: 1,
    camDist: 40,
    pixelSize: 0.04,
    timeSec: 1.8,
  });
  const farAway = computeUnderwaterCaustics({
    worldPos: [12, -0.35, -8],
    worldNormal: [0, 1, 0],
    sunDir,
    lightingPreset: 'day',
    graphicsPreset: 'high',
    riverMask: 1,
    camDist: CAUSTICS_CONFIG.fadeDistEnd + 20,
    pixelSize: 0.04,
    timeSec: 1.8,
  });
  const aboveWater = computeUnderwaterCaustics({
    worldPos: [12, 1.5, -8],
    worldNormal: [0, 1, 0],
    sunDir,
    lightingPreset: 'day',
    graphicsPreset: 'high',
    riverMask: 1,
    camDist: 40,
    pixelSize: 0.04,
    timeSec: 1.8,
  });

  assert.ok(shallow[0] > 0 && shallow[1] > 0 && shallow[2] > 0);
  // Red absorbs faster than blue-green in deeper water relative to initial daylight ratios
  const shallowRedToGreen = shallow[0] / shallow[1];
  const deepRedToGreen = deep[0] / deep[1];
  assert.ok(deepRedToGreen < shallowRedToGreen);
  assert.ok(deep[1] < shallow[1]);
  assert.deepEqual(farAway, [0, 0, 0]);
  assert.deepEqual(aboveWater, [0, 0, 0]);
});

test('computeWallBounceCaustics highlights vertical piers near waterline and zeros out horizontal decks and high walls', () => {
  const sunDir = CAUSTICS_PRESETS.dusk.defaultSunPos;
  const verticalPier = computeWallBounceCaustics({
    worldPos: [22, 0.75, -18],
    worldNormal: [0.6, 0.0, -0.8],
    sunDir,
    lightingPreset: 'dusk',
    graphicsPreset: 'balanced',
    riverMask: 1,
    camDist: 55,
    pixelSize: 0.05,
    timeSec: 2.1,
  });
  const horizontalDeck = computeWallBounceCaustics({
    worldPos: [22, 0.75, -18],
    worldNormal: [0, 1, 0],
    sunDir,
    lightingPreset: 'dusk',
    graphicsPreset: 'balanced',
    riverMask: 1,
    camDist: 55,
    pixelSize: 0.05,
    timeSec: 2.1,
  });
  const highWall = computeWallBounceCaustics({
    worldPos: [22, 5.5, -18],
    worldNormal: [0.6, 0.0, -0.8],
    sunDir,
    lightingPreset: 'dusk',
    graphicsPreset: 'balanced',
    riverMask: 1,
    camDist: 55,
    pixelSize: 0.05,
    timeSec: 2.1,
  });
  const lowPreset = computeWallBounceCaustics({
    worldPos: [22, 0.75, -18],
    worldNormal: [0.6, 0.0, -0.8],
    sunDir,
    lightingPreset: 'dusk',
    graphicsPreset: 'low',
    riverMask: 1,
    camDist: 55,
    pixelSize: 0.05,
    timeSec: 2.1,
  });

  // Dusk bounce should be warm golden (R > B)
  assert.ok(verticalPier[0] > 0.01);
  assert.ok(verticalPier[0] > verticalPier[2]);
  assert.deepEqual(horizontalDeck, [0, 0, 0]);
  assert.deepEqual(highWall, [0, 0, 0]);
  assert.deepEqual(lowPreset, [0, 0, 0]);
});

test('computeMultiBounceAO preserves warm chromatic inter-reflection and stays >= linear AO', () => {
  const ao = 0.45;
  const terracotta: [number, number, number] = [0.62, 0.3, 0.16];
  const bounced = computeMultiBounceAO(ao, terracotta);

  assert.ok(bounced[0] > ao, `Red bounce (${bounced[0]}) should exceed scalar AO (${ao})`);
  assert.ok(bounced[1] >= ao);
  assert.ok(bounced[2] >= ao);
  assert.ok(bounced[0] > bounced[1] && bounced[1] > bounced[2]);

  const unoccluded = computeMultiBounceAO(1.0, terracotta);
  assert.deepEqual(unoccluded, [1, 1, 1]);

  const pitchDark = computeMultiBounceAO(0.0, terracotta);
  assert.deepEqual(pitchDark, [0, 0, 0]);
});

test('computeSpecularOcclusion suppresses indirect specular in cavities and at grazing angles', () => {
  const unoccluded = computeSpecularOcclusion(0.2, 1.0, 0.25);
  const smoothOccludedFront = computeSpecularOcclusion(0.85, 0.45, 0.2);
  const smoothOccludedGrazing = computeSpecularOcclusion(0.08, 0.45, 0.2);
  const deepCavity = computeSpecularOcclusion(0.2, 0.2, 0.35);

  assert.equal(unoccluded, 1);
  assert.ok(smoothOccludedGrazing < smoothOccludedFront);
  assert.ok(deepCavity < smoothOccludedFront);
  assert.ok(deepCavity >= 0 && deepCavity <= 1);
});
