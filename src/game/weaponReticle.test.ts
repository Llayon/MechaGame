import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatState, PLAYER_MAX_RANGE } from './combatSimulation';
import { MECH_SPAWN } from '../map/mechKinematics';
import { predictPhysicalShotEndpoint } from './weaponReticle';

test('predicted muzzle contact respects enemy sphere and uses no hidden aim assist', () => {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];
  state.barrels = [];
  enemy.x = MECH_SPAWN.x;
  enemy.y = MECH_SPAWN.y;
  enemy.z = MECH_SPAWN.z + 18;
  const straight = predictPhysicalShotEndpoint(state,
    MECH_SPAWN.x, MECH_SPAWN.y + 1, MECH_SPAWN.z + 1.5, 0, 0, 1);
  assert.equal(straight.hit, 'enemy');
  assert.equal(straight.targetId, enemy.id);
  assert.ok(straight.distance > 0 && straight.distance < 18);
  const offAxis = predictPhysicalShotEndpoint(state,
    MECH_SPAWN.x, MECH_SPAWN.y + 1, MECH_SPAWN.z + 1.5, 0.4, 0, 1);
  assert.notEqual(offAxis.hit, 'enemy');
  assert.ok(offAxis.distance <= PLAYER_MAX_RANGE);
});

test('degenerate aim vector never reports a bogus impact', () => {
  const state = createCombatState(true);
  assert.deepEqual(predictPhysicalShotEndpoint(state, 0, 0, 0, 0, 0, 0),
    {distance:0, hit:'range'});
});
