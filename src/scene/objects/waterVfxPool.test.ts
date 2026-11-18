import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_LEVEL } from '../../map/terrainMath';
import { MECH_SPAWN } from '../../map/mechKinematics';
import {
  MAX_WATER_RIPPLES,
  MAX_WATER_SPLASHES,
  computeRippleTransform,
  computeSplashTransform,
  createWaterVfxPool,
  findWaterSurfaceCrossing,
  isRiverWaterImpact,
  resetWaterVfxPool,
  spawnWaterImpact,
  spawnWaterRipple,
  stepWaterVfxPool,
  type RippleTransform,
  type SplashTransform,
} from './waterVfxPool';

test('water ripple and splash pools spawn, step, expire, and reset cleanly without leaking', () => {
  const pool = createWaterVfxPool();
  spawnWaterImpact(pool, -58, -40, 1.0, { dirX: -1, dirZ: 0 });
  assert.equal(pool.activeRipples, 1);
  assert.ok(pool.activeSplashes >= 4 && pool.activeSplashes <= 10);

  const rTf: RippleTransform = { x: 0, y: 0, z: 0, scale: 0, alpha: 0, progress: 0 };
  const sTf: SplashTransform = { x: 0, y: 0, z: 0, scaleX: 0, scaleY: 0, alpha: 0, progress: 0 };

  stepWaterVfxPool(pool, 0.12);
  assert.equal(computeRippleTransform(pool.ripples[0], rTf), true);
  assert.ok(Math.abs(rTf.y - (WATER_LEVEL + 0.04)) < 1e-6);
  assert.ok(rTf.scale > 1.4 && rTf.scale < 8.5, `Ripple scale should stay Sector-7 proportional, got ${rTf.scale}`);
  assert.equal(computeSplashTransform(pool.splashes[0], sTf), true);
  assert.ok(sTf.y > WATER_LEVEL + 0.14, 'Splash droplet should rise above water surface early in arc');

  // After 2.5 seconds both splashes and step ripples expire cleanly
  for (let i = 0; i < 25; i++) {
    stepWaterVfxPool(pool, 0.1);
  }
  assert.equal(pool.activeRipples, 0);
  assert.equal(pool.activeSplashes, 0);

  // Ring buffer wraps safely under heavy burst load
  for (let i = 0; i < MAX_WATER_RIPPLES + 12; i++) {
    spawnWaterRipple(pool, -58 + i * 0.2, -40, 1.2);
  }
  assert.equal(pool.activeRipples, MAX_WATER_RIPPLES);
  assert.ok(pool.splashes.length === MAX_WATER_SPLASHES);

  resetWaterVfxPool(pool);
  assert.equal(pool.activeRipples, 0);
  assert.equal(pool.activeSplashes, 0);
});

test('isRiverWaterImpact and findWaterSurfaceCrossing distinguish river surface from dry land', () => {
  // Open deep river channel near Crossing A (-58, -40)
  assert.equal(isRiverWaterImpact(-58, WATER_LEVEL, -40), true);
  // Mech spawn at Helipad (-109, 86) is dry land well above river
  assert.equal(isRiverWaterImpact(MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z), false);
  // High-elevation hillside puddle cannot spawn ripples at y=0 river plane
  assert.equal(isRiverWaterImpact(-58, WATER_LEVEL + 4.5, -40), false);

  // Shell fired from elevated bank into riverbed (-58, -3.0, -40) resolves exact WATER_LEVEL crossing
  const crossing = findWaterSurfaceCrossing(-75, 5.0, -40, -58, -3.0, -40);
  assert.ok(crossing !== null, 'Shot plunging into river bed should report exact water surface crossing');
  assert.equal(crossing.y, WATER_LEVEL);
  assert.ok(crossing.x > -75 && crossing.x < -58);

  // Shot hitting dry land above water returns null
  assert.equal(
    findWaterSurfaceCrossing(MECH_SPAWN.x, MECH_SPAWN.y + 3, MECH_SPAWN.z, MECH_SPAWN.x + 12, MECH_SPAWN.y, MECH_SPAWN.z),
    null,
  );
});
