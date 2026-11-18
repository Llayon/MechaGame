import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeroState, stepHero, heroAnimation, YARD_LIMIT } from './controller';
import type { HeroInput } from './controller';
const idle: HeroInput = { x: 0, z: 0, sprint: false, walk: false, crouch: false, jump: false };
test('hero diagonal speed is bounded; walking, running and sprinting match authored units', () => {
  for (const [patch, expected] of [[{}, 3.2], [{ sprint: true }, 4.5], [{ walk: true }, 1.35], [{ crouch: true }, .8]] as const) {
    const s = createHeroState();
    for (let i = 0; i < 120; i++) stepHero(s, { ...idle, ...patch, x: 1, z: 1 }, 1 / 60, []);
    assert.ok(Math.abs(s.speed * 3.75 - expected) < .01);
    assert.ok(Math.abs(s.x - s.z) < 1e-6);
  }
});
test('collision slides along walls and yard bounds prevent escape', () => {
  const s = createHeroState(), wall = [{ x: .4, z: 0, width: .2, depth: 4, height: .5 }];
  for (let i = 0; i < 100; i++) stepHero(s, { ...idle, x: 1, z: 1 }, 1 / 60, wall);
  assert.ok(s.x < .23 && s.z > .5);
  for (let i = 0; i < 2000; i++) stepHero(s, { ...idle, x: 0, z: 1 }, 1 / 60, []);
  assert.ok(s.z <= YARD_LIMIT);
});
test('jump has real airtime, lands without floor penetration, and can land on a platform', () => {
  const s = createHeroState(); stepHero(s, { ...idle, jump: true }, 1 / 60, []);
  assert.equal(s.grounded, false); assert.equal(heroAnimation(s, idle), 'jump');
  let highest = 0;
  for (let i = 0; i < 90; i++) { stepHero(s, idle, 1 / 60, []); highest = Math.max(highest, s.y); assert.ok(s.y >= 0); }
  assert.ok(highest > .12 && highest < .16); assert.equal(s.grounded, true); assert.equal(s.y, 0);
  s.y = .2; s.grounded = false;
  for (let i = 0; i < 90; i++) stepHero(s, idle, 1 / 60, [{ x: 0, z: 0, width: 1, depth: 1, height: .1 }]);
  assert.equal(s.y, .1); assert.equal(s.grounded, true);
});
test('stopping, crouch states and invalid frame deltas remain finite', () => {
  const s = createHeroState();
  for (let i = 0; i < 60; i++) stepHero(s, { ...idle, z: 1 }, 1 / 60, []);
  assert.equal(heroAnimation(s, idle), 'run'); assert.equal(heroAnimation(s, { ...idle, crouch: true }), 'crouchWalk');
  for (let i = 0; i < 90; i++) stepHero(s, idle, 1 / 60, []);
  assert.equal(heroAnimation(s, idle), 'idle'); assert.equal(heroAnimation(s, { ...idle, crouch: true }), 'crouch');
  const before = { ...s }; stepHero(s, idle, NaN, []); assert.deepEqual(s, before);
  stepHero(s, { ...idle, z: 1 }, 100, []);
  assert.ok(s.z - before.z < .05 && Object.values(s).every(v => typeof v === 'boolean' || Number.isFinite(v)));
});
