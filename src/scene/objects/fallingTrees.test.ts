import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { PineTreeInstance } from '../../map/worldStructures';
import {
  TREE_STATE_FALLEN,
  TREE_STATE_FALLING,
  TREE_STATE_STANDING,
  checkFallingTreeCollisions,
  createFallingTreesState,
  evaluateFallAngle,
  resetFallingTrees,
  stepFallingTrees,
} from './fallingTrees';

function makeTree(x: number, y: number, z: number): PineTreeInstance {
  return {
    x,
    y,
    z,
    heightScale: 1.5,
    widthScale: 1.4,
    rotY: 0.7,
    tiltX: 0,
    tiltZ: 0,
    tint: 0.5,
  };
}

test('checkFallingTreeCollisions uses push vector from Mech and adapts targetAngle to slope', () => {
  const flatTree = makeTree(10, 5, 10);
  const downhillTree = makeTree(30, 5, 10);
  const farTree = makeTree(100, 5, 100);
  const state = createFallingTreesState([flatTree, downhillTree, farTree]);

  // Flat terrain: pushing +X from Mech at (8.5, 5, 10)
  const hitFlat = checkFallingTreeCollisions(
    state,
    8.5,
    5,
    10,
    1.8,
    () => 5,
  );
  assert.equal(hitFlat.length, 1);
  assert.equal(hitFlat[0].index, 0);
  assert.ok(hitFlat[0].dirX > 0.99);
  assert.equal(state.states[0], TREE_STATE_FALLING);
  assert.equal(state.states[2], TREE_STATE_STANDING);

  // Verify rotation axis moves local +Y toward +X
  const item = state.active[0];
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(item.axisX, 0, item.axisZ).normalize(),
    item.targetAngle,
  );
  const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(tip.x > 0.9, `Expected fallen trunk +Y tip to point in +X push dir, got x=${tip.x}`);

  // Downhill terrain ahead: ground drops 2m so targetAngle exceeds 90 deg (Math.PI * 0.5)
  const hitDown = checkFallingTreeCollisions(
    state,
    28.5,
    5,
    10,
    1.8,
    (x) => (x > 31 ? 3 : 5),
  );
  assert.equal(hitDown.length, 1);
  assert.ok(
    state.active[1].targetAngle > Math.PI * 0.5,
    `Downhill fall angle should exceed PI/2, got ${state.active[1].targetAngle}`,
  );
});

test('stepFallingTrees follows quadratic gravity, emits impact bounce, and resets cleanly', () => {
  const state = createFallingTreesState([makeTree(0, 2, 0)]);
  checkFallingTreeCollisions(state, -1.2, 2, 0, 1.8, () => 2);

  // Quadratic gravity check: at p=0.25 angle is 1/16 target, at p=0.5 it is 1/4 target
  const target = state.active[0].targetAngle;
  const aEarly = evaluateFallAngle(0.25, target);
  const aMid = evaluateFallAngle(0.5, target);
  assert.ok(Math.abs(aMid / aEarly - 4.0) < 1e-5);

  // Step until ground impact & bounce
  let totalImpacts = 0;
  for (let s = 0; s < 30; s++) {
    const { impacts } = stepFallingTrees(state, 0.05);
    totalImpacts += impacts.length;
  }
  assert.equal(totalImpacts, 1);
  assert.equal(state.states[0], TREE_STATE_FALLEN);
  assert.equal(state.active.length, 0);

  // Bounce check: just after t=1.0, angle dips slightly below targetAngle
  assert.ok(evaluateFallAngle(1.12, target) < target);

  const restored = resetFallingTrees(state);
  assert.deepEqual(restored, [0]);
  assert.equal(state.states[0], TREE_STATE_STANDING);
});
