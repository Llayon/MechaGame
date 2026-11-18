import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInfantrySkirmishes, damageInfantrySoldier, getInfantrySupport, stepInfantrySkirmishes,
} from './infantrySkirmishes';
import { INFANTRY_SITES } from '../map/infantryEncounters';
import { hasLineOfSight } from '../map/worldRaycaster';

test('all five encounters start with their own ten allies and thirty enemies', () => {
  const state = createInfantrySkirmishes();
  assert.equal(state.sites.length, 5);
  assert.equal(state.soldiers.length, 200);
  for (const [index, counts] of state.sites.entries()) {
    const local = state.soldiers.filter(s => s.siteIndex === index && s.hp > 0);
    assert.equal(local.filter(s => s.side === 'friendly').length, 10);
    assert.equal(local.filter(s => s.side === 'enemy').length, 30);
    assert.equal(counts.friendlyAlive, 10);
    assert.equal(counts.enemyAlive, 30);
    const enemies = local.filter(s => s.side === 'enemy');
    const squads = new Set(enemies.map(s => s.squadIndex));
    for (const squad of squads) {
      const count = enemies.filter(s => s.squadIndex === squad).length;
      assert.ok(count >= 3 && count <= 5);
    }
    assert.equal(enemies.filter(s => s.role === 'spotter').length, 2);
  }
});

test('both sides move and exchange fire locally before the fight produces casualties', () => {
  const state = createInfantrySkirmishes();
  for (let frame = 0; frame < 80; frame++) stepInfantrySkirmishes(state, 0.1);
  for (const [index] of state.sites.entries()) {
    const local = state.soldiers.filter(s => s.siteIndex === index);
    for (const side of ['friendly', 'enemy']) {
      assert.ok(local.some(s => s.side === side && s.lastShotAt > 0), `No ${side} fire at site ${index}`);
    }
    for (const soldier of local) {
      if (soldier.targetId < 0) continue;
      const target = state.soldiers[soldier.targetId];
      assert.notEqual(target.side, soldier.side);
      assert.equal(target.siteIndex, soldier.siteIndex);
    }
    assert.ok(local.filter(s => s.role === 'patrol').every(s =>
      Math.hypot(s.x - s.route[0].x, s.z - s.route[0].z) > 0.5));
    assert.ok(local.filter(s => s.role === 'guard').every(s => s.x === s.route[0].x && s.z === s.route[0].z));
  }
  for (let frame = 0; frame < 1800; frame++) stepInfantrySkirmishes(state, 0.1);
  for (const [index, site] of state.sites.entries()) {
    const local = state.soldiers.filter(s => s.siteIndex === index && s.hp > 0);
    assert.equal(local.filter(s => s.side === 'friendly').length, site.friendlyAlive);
    assert.equal(local.filter(s => s.side === 'enemy').length, site.enemyAlive);
    assert.ok(site.friendlyAlive + site.enemyAlive < 40, `No casualties at site ${index}`);
  }
});

test('a resolved encounter stops shooting, and its casualties do not affect other sites', () => {
  const state = createInfantrySkirmishes();
  const control = createInfantrySkirmishes();
  for (const soldier of state.soldiers.filter(s => s.siteIndex === 0 && s.side === 'enemy')) {
    damageInfantrySoldier(state, soldier, 50);
    damageInfantrySoldier(state, soldier, 50);
  }
  for (let frame = 0; frame < 100; frame++) {
    stepInfantrySkirmishes(control, 0.05);
    stepInfantrySkirmishes(state, 0.05);
  }
  assert.equal(state.sites[0].friendlyAlive, 10);
  assert.equal(state.sites[0].enemyAlive, 0);
  assert.ok(state.soldiers.filter(s => s.siteIndex === 0)
    .every(s => s.lastShotAt === -Infinity && s.targetId === -1 && !s.moving));
  assert.deepEqual(state.soldiers.slice(40), control.soldiers.slice(40));
});

test('a sighting alerts nearby armor, sends squads to cover and designates only with a live spotter', () => {
  const state = createInfantrySkirmishes();
  const site = INFANTRY_SITES[0];
  const local = state.soldiers.filter(s => s.siteIndex === 0 && s.side === 'enemy');
  const spotters = local.filter(s => s.role === 'spotter');
  const observer = spotters[0];
  const mech = { x: observer.x, y: observer.y, z: observer.z };
  assert.equal(stepInfantrySkirmishes(state, 0.05, mech), 0);
  const support = () => getInfantrySupport(state, site.x, site.z);
  assert.deepEqual(support(), { alarmRaised: true, spotterContact: true });
  assert.deepEqual(getInfantrySupport(state, 900, 900), { alarmRaised: false, spotterContact: false });
  for (let i = 0; i < 45; i++) stepInfantrySkirmishes(state, 0.1, mech);
  for (const s of local) {
    assert.ok(s.inCover && !s.moving);
    assert.deepEqual([s.x, s.z], [s.cover.x, s.cover.z]);
  }
  for (let i = 0; i < 10; i++) stepInfantrySkirmishes(state, 0.1, { x: 900, y: 8, z: 900 });
  assert.deepEqual(support(), { alarmRaised: true, spotterContact: false });
  const closeMech = { ...observer.cover };
  for (let i = 0; i < 10; i++) stepInfantrySkirmishes(state, 0.1, closeMech);
  assert.equal(support().spotterContact, true);
  for (const s of spotters) damageInfantrySoldier(state, s, 50);
  assert.deepEqual(support(), { alarmRaised: true, spotterContact: false });
  for (const s of local) damageInfantrySoldier(state, s, 50);
  assert.deepEqual(support(), { alarmRaised: false, spotterContact: false });
});

test('fixed steps replay across frame rates and ignore paused or invalid time', () => {
  const fast = createInfantrySkirmishes();
  const slow = createInfantrySkirmishes();
  for (const delta of [0, -1, NaN, Infinity]) stepInfantrySkirmishes(fast, delta);
  assert.deepEqual(fast, slow);
  for (let frame = 0; frame < 600; frame++) stepInfantrySkirmishes(fast, 1 / 60);
  for (let frame = 0; frame < 100; frame++) stepInfantrySkirmishes(slow, 0.1);
  assert.deepEqual(fast.soldiers, slow.soldiers);
  assert.equal(fast.elapsed, slow.elapsed);
  stepInfantrySkirmishes(slow, 3600);
  assert.ok(slow.elapsed - fast.elapsed < 0.251);
});

test('a covered sentry can chip exposed mech armor, with a site-wide cooldown and real obstruction checks', () => {
  const state = createInfantrySkirmishes();
  const guard = state.soldiers.find(s => s.siteIndex === 4 && s.role === 'guard')!;
  for (const s of state.soldiers) if (s !== guard) damageInfantrySoldier(state, s, 50);
  const exposed = { x: 108.45, y: 19.05, z: -69.09 };
  const screened = { x: 88.45, y: 19.05, z: -69.09 };
  const canShoot = (p: typeof exposed) => hasLineOfSight(guard.cover.x, guard.cover.y + 0.35, guard.cover.z,
    p.x, p.y + 1.9, p.z);
  assert.equal(canShoot(exposed), true);
  assert.equal(canShoot(screened), false);
  const times: number[] = [];
  function simulate(seconds: number, mech?: typeof exposed) {
    for (let i = 0; i < seconds * 10; i++) {
      stepInfantrySkirmishes(state, 0.1, mech, damage => {
        assert.equal(damage, 1);
        assert.ok(guard.inCover);
        assert.equal(guard.shotTargetX, mech?.x);
        times.push(state.elapsed);
      });
    }
  }
  simulate(12);
  assert.equal(times.length, 0);
  simulate(15, exposed);
  assert.ok(times.length >= 2 && times.length <= 4);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 4 - 1e-6);
  const hits = times.length;
  simulate(8, screened);
  simulate(8, { x: 180, y: 19.05, z: -69.09 });
  simulate(8);
  assert.equal(times.length, hits);
});
