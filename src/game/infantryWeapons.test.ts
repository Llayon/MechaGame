import assert from 'node:assert/strict';
import test from 'node:test';
import { MECH_SPAWN } from '../map/mechKinematics';
import { CITADEL_CENTER_X, CITADEL_CENTER_Z, CITADEL_WALL_RX, getTerrainHeight } from '../map/terrainMath';
import {
  createCombatState, processPlayerShots, resetCombatState, stepCombatSimulation, stepCuttingLaser,
  triggerHeavyCannonShot,
} from './combatSimulation';
import { predictPhysicalShotEndpoint } from './weaponReticle';

function setupLane() {
  const state = createCombatState(true);
  const spotter = state.infantry.soldiers.find(s => s.role === 'spotter')!;
  const friendly = state.infantry.soldiers[0];
  const shot = { muzzleX: MECH_SPAWN.x, muzzleY: MECH_SPAWN.y + 2, muzzleZ: MECH_SPAWN.z,
    dirX: 0, dirY: 0, dirZ: 1 };
  Object.assign(spotter, { x: shot.muzzleX, y: shot.muzzleY - 0.24, z: shot.muzzleZ + 5 });
  Object.assign(friendly, { x: spotter.x, y: spotter.y, z: spotter.z - 1 });
  return { state, spotter, friendly, shot };
}

test('physical reticle identifies the spotter hit by the guns and laser', () => {
  for (const weapon of ['autocannon', 'heavy', 'laser'] as const) {
    const { state, spotter, friendly, shot } = setupLane();
    const origin = [shot.muzzleX, shot.muzzleY, shot.muzzleZ] as const;
    const ray = [...origin, 0, 0, 1] as const;
    const predicted = predictPhysicalShotEndpoint(state, ...ray);
    assert.equal(predicted.targetId, `infantry-${spotter.id}`);
    assert.equal(predicted.infantryRole, 'spotter');
    const friendlyHp = friendly.hp;
    if (weapon === 'laser') {
      for (let i = 0; i < 40 && spotter.hp > 0; i++) {
        const beam = stepCuttingLaser(state, ...ray, true, 0.05);
        assert.ok(beam?.onEnemy);
        assert.ok(Math.abs(beam.z1 - shot.muzzleZ - predicted.distance) < 1e-6);
      }
    } else {
      const result = weapon === 'autocannon'
        ? processPlayerShots(state, [shot], ...origin, 0, true)[0]
        : triggerHeavyCannonShot(state, ...ray, ...origin, 0, true);
      assert.equal(result?.hitKind, 'enemy');
      assert.equal(result.distance, predicted.distance);
      assert.equal(state.shotsHit, 1);
    }
    assert.equal(spotter.hp, 0);
    assert.equal(friendly.hp, friendlyHp);
    assert.equal(state.infantry.sites[spotter.siteIndex].enemyAlive, 29);
  }
});

test('a citadel wall stops the predicted and fired shot before infantry', () => {
  const { state, spotter } = setupLane();
  const wallX = CITADEL_CENTER_X + CITADEL_WALL_RX * Math.cos(Math.PI / 8);
  const y = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 2.55;
  Object.assign(spotter, { x: wallX - 4, y: y - 0.24, z: CITADEL_CENTER_Z });
  const hp = spotter.hp;
  const origin = [wallX + 8, y, CITADEL_CENTER_Z] as const;
  assert.equal(predictPhysicalShotEndpoint(state, ...origin, -1, 0, 0).hit, 'cover');
  assert.equal(triggerHeavyCannonShot(state, ...origin, -1, 0, 0, ...origin, 0, true)?.hitKind, 'cover');
  assert.equal(spotter.hp, hp);
});

test('a missile strike damages hostile infantry and restart restores the full deployment', () => {
  const { state, spotter, friendly, shot } = setupLane();
  const another = state.infantry.soldiers.find(s => s.siteIndex === spotter.siteIndex && s.role === 'guard')!;
  Object.assign(another, { x: spotter.x + 1.5, y: spotter.y, z: spotter.z });
  const friendlyHp = friendly.hp;
  state.playerMissiles.push({
    id: 9, x: spotter.x, y: shot.muzzleY, z: spotter.z - 0.8, vx: 0, vy: 0, vz: 30,
    targetEnemyId: null, fallbackX: spotter.x, fallbackY: shot.muzzleY, fallbackZ: spotter.z,
    life: 0, maxLife: 1, damage: 26, active: true,
  });
  const tick = () => stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.05);
  tick();
  assert.equal(state.playerMissiles.length, 0);
  assert.equal(spotter.hp, 0);
  assert.equal(another.hp, 0);
  assert.equal(friendly.hp, friendlyHp);
  const elapsed = state.infantry.elapsed;
  state.missionStatus = 'paused';
  tick();
  assert.equal(state.infantry.elapsed, elapsed);
  resetCombatState(state);
  assert.equal(state.infantry.elapsed, 0);
  assert.ok(state.infantry.sites.every(s => s.friendlyAlive === 10 && s.enemyAlive === 30 && !s.alarmRaised));
});
