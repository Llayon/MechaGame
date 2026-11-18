import test from 'node:test';
import assert from 'node:assert/strict';
import { MECH_SPAWN } from '../../map/mechKinematics';
import { WATER_LEVEL, getTerrainHeight } from '../../map/terrainMath';
import {
  createBallisticPropPool,
  ejectShellCasing,
  getBallisticSlotVisualFactor,
  resetBallisticPropPool,
  spawnArmorDebrisBurst,
  stepBallisticPropPool,
} from './debrisBallisticsPool';

test('ejectShellCasing throws shells perpendicular to aim direction and settles onto airfield concrete', () => {
  const pool = createBallisticPropPool(8);
  const idx = ejectShellCasing(pool, {
    x: MECH_SPAWN.x,
    y: MECH_SPAWN.y + 3.0,
    z: MECH_SPAWN.z,
    shootDirX: 0,
    shootDirY: 0,
    shootDirZ: 1,
    outwardSide: 1,
    caliberScale: 1.0,
    rng: () => 0.5,
  });

  assert.equal(idx, 0);
  const slot = pool.slots[0];
  assert.equal(slot.active, true);
  // Facing +Z with outwardSide=+1 -> ejects along world -X
  assert.ok(slot.vx < -2.0, `Expected -X ejection velocity, got ${slot.vx}`);
  assert.ok(slot.vy > 2.5, `Expected upward pop, got ${slot.vy}`);

  let firstBounceEvents = 0;
  for (let i = 0; i < 120; i++) {
    const events = {
      dryBouncedCasings: 0,
      heavyDryBounce: false,
      waterImpactX: 0,
      waterImpactZ: 0,
      hasWaterImpact: false,
    };
    stepBallisticPropPool(pool, 0.03, events);
    firstBounceEvents += events.dryBouncedCasings;
  }

  assert.equal(firstBounceEvents, 1, 'Expected exactly one dry first-bounce audio event');
  assert.equal(slot.resting, true, 'Expected shell to finish bouncing and rest on apron');
  assert.ok(slot.y > getTerrainHeight(slot.x, slot.z) + 0.25, 'Must rest on airfield apron slab, not terrain below');
  assert.equal(slot.ny, 1, 'Concrete apron resting normal must be flat vertical');

  const vis = getBallisticSlotVisualFactor(slot);
  assert.equal(vis.coolT, 1, 'Casing should be fully cooled after 3.6s');
});

test('casings entering river water cool immediately and settle without dry bounce audio', () => {
  const pool = createBallisticPropPool(4);
  // Open river channel near Crossing A (-58, -40)
  ejectShellCasing(pool, {
    x: -58,
    y: WATER_LEVEL + 1.2,
    z: -40,
    shootDirX: 0,
    shootDirY: 0,
    shootDirZ: 1,
    outwardSide: 1,
    caliberScale: 1.0,
    rng: () => 0.4,
  });

  let dryBounces = 0;
  let sawWaterHit = false;
  for (let i = 0; i < 90; i++) {
    const events = {
      dryBouncedCasings: 0,
      heavyDryBounce: false,
      waterImpactX: 0,
      waterImpactZ: 0,
      hasWaterImpact: false,
    };
    stepBallisticPropPool(pool, 0.03, events);
    dryBounces += events.dryBouncedCasings;
    if (events.hasWaterImpact) sawWaterHit = true;
  }

  assert.equal(sawWaterHit, true, 'Expected river water entry trigger');
  assert.equal(dryBounces, 0, 'Water impact must suppress dry metallic clink');
  assert.equal(pool.slots[0].submerged, true);
});

test('spawnArmorDebrisBurst wraps ring buffer cleanly and reset clears all slots', () => {
  const pool = createBallisticPropPool(6);
  spawnArmorDebrisBurst(pool, {
    x: MECH_SPAWN.x,
    y: MECH_SPAWN.y + 1.5,
    z: MECH_SPAWN.z,
    count: 10,
    rng: () => 0.5,
  });
  assert.equal(pool.activeCount, 6);
  assert.equal(pool.cursor, 10 % 6);

  resetBallisticPropPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.cursor, 0);
  assert.equal(pool.slots.some((s) => s.active), false);
});
