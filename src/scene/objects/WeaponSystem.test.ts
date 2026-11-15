import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stepWeaponSystem } from './WeaponSystem';
import type { MechRig } from './MechModel';

function fakeRig(): MechRig {
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(2, 3, 4);
  const barrel = {
    side: -1 as const,
    elevPivot: new THREE.Group(),
    mesh: new THREE.Group(),
    muzzleAnchor,
    rateHz: 4.0,
    fireAccum: 0.9,
  };
  return { gunBarrels: [barrel] } as unknown as MechRig;
}

test('weapons emit a world-space shot event on cadence without creating particles', () => {
  const rig = fakeRig();
  const shots = stepWeaponSystem(rig, 0.05, true, -0.2);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].barrelIndex, 0);
  assert.equal(shots[0].side, -1);
  assert.deepEqual(shots[0].muzzlePosition.toArray(), [2, 3, 4]);
  assert.ok(Math.abs(shots[0].direction.length() - 1) < 1e-9);
  assert.equal(rig.gunBarrels[0].elevPivot.rotation.x, -0.2);
  assert.ok(Math.abs(rig.gunBarrels[0].fireAccum - 0.1) < 1e-9);
});

test('releasing trigger prevents new shots and resets barrel accumulator', () => {
  const rig = fakeRig();
  assert.equal(stepWeaponSystem(rig, 0.05, false, 0).length, 0);
  assert.equal(rig.gunBarrels[0].fireAccum, 0.94);
  assert.equal(stepWeaponSystem(rig, 0.01, true, 0).length, 0);
});
