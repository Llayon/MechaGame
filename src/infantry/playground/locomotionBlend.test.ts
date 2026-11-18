import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip, AnimationMixer, NumberKeyframeTrack, Object3D } from 'three';
import { LocomotionBlend } from './locomotionBlend';

test('a rapid return to idle keeps the blended pose and removes the retired run action', () => {
  const object = new Object3D();
  const mixer = new AnimationMixer(object);
  const action = (name: string, offset: number) => mixer.clipAction(new AnimationClip(name, 1, [
    new NumberKeyframeTrack('.position[x]', [0, 1], [offset, offset]),
  ]));
  const idle = action('idle', 0);
  const run = action('run', 1);
  const blend = new LocomotionBlend();
  blend.play(idle, 0, 0, false);
  blend.update(.05, 0);
  mixer.update(.05);
  blend.play(run, .8, 0, false);
  blend.update(.075, .8);
  mixer.update(.075);
  const before = object.position.x;
  const runTime = run.time;
  assert.ok(before > 0 && before < 1);

  // The incoming idle action is already partly active. Interrupting the fade
  // must keep both weights and the outgoing action's animation time.
  blend.play(idle, 0, 0, false);
  blend.update(0, .4);
  mixer.update(0);
  assert.ok(Math.abs(object.position.x - before) < 1e-8);
  assert.equal(run.time, runTime);
  assert.equal(run.getEffectiveTimeScale(), .5);
  assert.ok(Math.abs(idle.getEffectiveWeight() + run.getEffectiveWeight() - 1) < 1e-8);
  blend.update(.18, 0);
  mixer.update(.18);
  assert.ok(!run.isScheduled());
  assert.equal(object.position.x, 0);
});
