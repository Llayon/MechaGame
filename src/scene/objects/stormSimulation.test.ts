import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STORM_LAYERS,
  STORM_LAYER_SPECS,
  STORM_PRESETS,
  createStormSimulation,
  evaluateLightningEnvelope,
  resetStormSimulation,
  stepStormSimulation,
} from './stormSimulation';

test('storm simulation fires periodic strobe lightning strikes and schedules delayed thunder', () => {
  const storm = createStormSimulation('night');
  assert.equal(STORM_LAYER_SPECS.length, MAX_STORM_LAYERS);
  assert.equal(storm.flashIntensity, 0);

  let strikeSeen = false;
  let peakCloudGlow = 0;
  let peakBoltGlow = 0;
  let thunderSeen = false;

  for (let i = 0; i < 160; i++) {
    const res = stepStormSimulation(storm, 0.05, 'night');
    if (res.strikeStarted) strikeSeen = true;
    if (res.thunderTriggered) thunderSeen = true;
    peakCloudGlow = Math.max(peakCloudGlow, storm.flashIntensity);
    peakBoltGlow = Math.max(peakBoltGlow, storm.boltIntensity);
  }

  assert.equal(strikeSeen, true);
  assert.equal(thunderSeen, true);
  assert.ok(peakCloudGlow > 0.75, `Expected bright cloud sheet-lightning peak, got ${peakCloudGlow}`);
  assert.ok(peakBoltGlow > 0.65, `Expected bright bolt strobe peak, got ${peakBoltGlow}`);

  // After strike finishes (~0.7s without hitting next 7.5s cooldown), glow returns cleanly to 0
  for (let i = 0; i < 20; i++) {
    stepStormSimulation(storm, 0.05, 'night');
  }
  assert.equal(storm.flashIntensity, 0);
  assert.equal(storm.boltIntensity, 0);
});

test('lightning strobe envelope shows multi-restrike modulation and resets cleanly per lighting preset', () => {
  const peakA = evaluateLightningEnvelope(0.08).boltGlow;
  const dip = evaluateLightningEnvelope(0.15).boltGlow;
  const restrike = evaluateLightningEnvelope(0.21).boltGlow;
  const tail = evaluateLightningEnvelope(0.85).cloudGlow;
  assert.ok(peakA > dip, 'First stroke should dip before restrike');
  assert.ok(restrike > dip, 'Secondary restrike should pulse back up');
  assert.ok(tail > 0 && tail < 0.25, 'Cloud scatter tail should decay smoothly');
  assert.equal(evaluateLightningEnvelope(1.0).cloudGlow, 0);

  const storm = createStormSimulation('dusk');
  stepStormSimulation(storm, STORM_PRESETS.dusk.initialDelaySec + 0.1, 'dusk');
  assert.ok(storm.flashIntensity > 0);

  resetStormSimulation(storm, 'day');
  assert.equal(storm.flashIntensity, 0);
  assert.equal(storm.boltIntensity, 0);
  assert.equal(storm.thunderPending, false);
  assert.equal(storm.cooldownTimer, STORM_PRESETS.day.initialDelaySec);
});
