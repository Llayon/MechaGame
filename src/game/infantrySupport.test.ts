import assert from 'node:assert/strict';
import test from 'node:test';
import { getWalkableSurfaceY } from '../map/mechKinematics';
import { createCombatState, stepCombatSimulation } from './combatSimulation';
import { damageInfantrySoldier } from './infantrySkirmishes';
import type { EnemyUnitState } from './combatTypes';

// Airfield forefield. The mech is visible to its spotters and the road to its north.
const mech = { x: -96, z: 52, y: getWalkableSurfaceY(-96, 52).y };
const tick = 0.05;

function fixture(archetype: 'scout-apc' | 'denial-turret', x: number, z: number) {
  const state = createCombatState(true);
  const unit = state.enemies.find(e => e.archetype === archetype)!;
  state.enemies = [unit];
  Object.assign(unit, { x, z, y: getWalkableSurfaceY(x, z).y });
  const step = () => stepCombatSimulation(state, mech.x, mech.y, mech.z, false, tick);
  return { state, unit, step };
}

// Start each sample from the same angular error, including after the APC has moved.
function measureWindup(unit: EnemyUnitState, step: () => void) {
  const yaw = Math.atan2(mech.x - unit.x, mech.z - unit.z) - 0.8;
  Object.assign(unit, { aiState: 'windup', turretYaw: yaw, stateTimer: 0.3, hasAttackToken: true });
  step();
  assert.equal(unit.hasLineOfSight, true);
  assert.equal(unit.aiState, 'windup');
  return { turn: unit.turretYaw - yaw, time: 0.3 - unit.stateTimer };
}

for (const archetype of ['scout-apc', 'denial-turret'] as const) {
  test(archetype + ' tracks and winds up faster only with a local, living spotter', () => {
    const local = fixture(archetype, -96, 60);
    const remote = fixture(archetype, -113, 16);
    const guided = measureWindup(local.unit, local.step);
    const ordinary = measureWindup(remote.unit, remote.step);

    // Both worlds received the same sighting. Only the local unit gets firing guidance.
    assert.ok(remote.state.infantry.soldiers.some(s => s.designating && s.hp > 0));
    const spotters = local.state.infantry.soldiers.filter(s => s.designating && s.hp > 0);
    assert.ok(spotters.length > 0);
    assert.ok(guided.turn > ordinary.turn);
    assert.ok(guided.time > ordinary.time);
    for (const spotter of spotters) {
      damageInfantrySoldier(local.state.infantry, spotter, spotter.hp);
    }
    const afterLoss = measureWindup(local.unit, local.step);
    assert.ok(Math.abs(afterLoss.turn - ordinary.turn) < 1e-8);
    assert.ok(Math.abs(afterLoss.time - ordinary.time) < 1e-8);
    assert.equal(local.state.infantry.sites[spotters[0].siteIndex].alarmRaised, true);
  });
}

test('the airfield alarm alerts a screened turret while rock cover blocks fire', () => {
  const { state, unit, step } = fixture('denial-turret', -137, 52);
  const firstProjectileId = state.nextProjectileId;
  assert.equal(unit.aiState, 'patrol');
  step();
  assert.ok(state.infantry.sites.some(s => s.spotterContact));
  assert.match(state.alertMessage ?? '', /ТРЕВОГА.*вертодрома/i);
  assert.equal(unit.hasLineOfSight, false);
  assert.equal(unit.aiState, 'alert');
  for (let i = 0; i < 5; i++) step();
  assert.equal(unit.aiState, 'alert');
  assert.equal(unit.hasAttackToken, false);
  assert.equal(state.nextProjectileId, firstProjectileId);

  // Loss of direct sight aborts the windup, even with a spotter still transmitting.
  Object.assign(unit, { aiState: 'windup', stateTimer: tick / 2, hasAttackToken: true });
  step();
  assert.equal(unit.aiState, 'alert');
  assert.equal(state.nextProjectileId, firstProjectileId);

  // Cover also intercepts a projectile when a burst was already committed.
  const hp = state.playerHp;
  Object.assign(unit, { aiState: 'attack', burstTimer: 0, burstRemaining: 1 });
  for (let i = 0; i < 18; i++) step();
  assert.equal(state.playerHp, hp);
  assert.equal(state.projectiles.length, 0);
  if (state.nextProjectileId !== firstProjectileId) {
    assert.ok(state.pendingImpacts.some(event => event.kind === 'cover-hit'));
  }
});
