import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { traceHostileInfantry } from './infantryHits';
import { INFANTRY_FIRE_RECOVERY, getInfantryPose } from './infantryPose';
import { createInfantrySkirmishes } from './infantrySkirmishes';

function target() {
  const state = createInfantrySkirmishes();
  const soldier = state.soldiers.find(entry => entry.side === 'enemy')!;
  state.soldiers = [soldier];
  soldier.yaw = 2.1;
  // A side view reveals the helmet's forward displacement in both the run and crouch clips.
  function trace(height: number, forward: number, limit = 2) {
    const sx = Math.sin(soldier.yaw), cx = Math.cos(soldier.yaw);
    return traceHostileInfantry(state, soldier.x - cx + sx * forward, soldier.y + height,
      soldier.z + sx + cx * forward, cx, 0, -sx, limit);
  }
  return { state, soldier, trace };
}

test('the covered fire pose exposes its standing helmet for the baked clip window', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('../../public/assets/infantry-armed/animation.json', import.meta.url), 'utf8'));
  const fire = manifest.clips.find((clip: { name: string }) => clip.name === 'fire');
  assert.ok(Math.abs(INFANTRY_FIRE_RECOVERY - (fire.duration - fire.muzzleTime)) < 1e-9);

  const { state, soldier, trace } = target();
  state.elapsed = 5;
  soldier.inCover = true;
  assert.equal(trace(.44, .03), null);
  soldier.lastShotAt = state.elapsed;
  assert.equal(getInfantryPose(soldier, state.elapsed), 'fire');
  assert.equal(trace(.46, .045)?.soldier, soldier);
  state.elapsed += INFANTRY_FIRE_RECOVERY + .001;
  assert.equal(getInfantryPose(soldier, state.elapsed), 'crouch');
  assert.equal(trace(.44, .03), null);
});

test('rays hit the rotated helmet silhouette in crouch and run and stop at nearer cover', () => {
  const { soldier, trace } = target();
  soldier.inCover = true;
  assert.equal(trace(.304, .117)?.soldier, soldier);
  soldier.moving = true;
  const hit = trace(.457, .085);
  assert.equal(hit?.soldier, soldier);
  assert.ok(hit.distance > .9 && hit.distance < 1);
  assert.equal(trace(.457, .085, hit.distance - .001), null);
  assert.equal(trace(.457, .085, hit.distance + .001)?.soldier, soldier);
  assert.equal(trace(.50, .085), null);
  assert.equal(trace(.32, .3), null);
});
