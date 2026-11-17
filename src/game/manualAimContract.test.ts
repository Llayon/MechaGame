import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatState, processPlayerShots, triggerHeavyCannonShot, PLAYER_SHELL_DAMAGE,
  HEAVY_CANNON_DAMAGE,
} from './combatSimulation';
import { MECH_SPAWN } from '../map/mechKinematics';

function oneTarget() {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];
  state.barrels = [];
  enemy.x = MECH_SPAWN.x;
  enemy.z = MECH_SPAWN.z + 18;
  enemy.y = MECH_SPAWN.y;
  return { state, enemy };
}

test('manual 37-mm fire never magnetizes off-axis muzzle shots to a nearby enemy', () => {
  const manual = oneTarget();
  const assisted = oneTarget();
  const shot = [{
    muzzleX: MECH_SPAWN.x,
    muzzleY: MECH_SPAWN.y + 1.0,
    muzzleZ: MECH_SPAWN.z + 1.5,
    dirX: 0.3, dirY: 0, dirZ: 1,
  }];
  const oldHP = manual.enemy.hp;
  const manualRay = processPlayerShots(manual.state, shot,
    MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0, true);
  const legacyRay = processPlayerShots(assisted.state, shot,
    MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0);
  assert.notEqual(manualRay[0]?.hitKind, 'enemy');
  assert.equal(manual.enemy.hp, oldHP);
  assert.equal(legacyRay[0]?.hitKind, 'enemy');
  assert.equal(assisted.enemy.hp, oldHP - PLAYER_SHELL_DAMAGE);
});

test('manual 105-mm shell uses actual barrel quaternion, not an auto-converged target', () => {
  const manual = oneTarget();
  const assisted = oneTarget();
  const args = [
    MECH_SPAWN.x, MECH_SPAWN.y + 1.0, MECH_SPAWN.z + 1.5,
    0.3, 0, 1,
    MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0,
  ] as const;
  const manualHP = manual.enemy.hp;
  const actual = triggerHeavyCannonShot(manual.state, ...args, true);
  const legacy = triggerHeavyCannonShot(assisted.state, ...args);
  assert.ok(actual);
  assert.notEqual(actual.hitKind, 'enemy');
  assert.equal(manual.enemy.hp, manualHP);
  assert.ok(legacy);
  assert.equal(legacy.hitKind, 'enemy');
  assert.equal(assisted.enemy.hp, Math.max(0, manualHP - HEAVY_CANNON_DAMAGE));
});
