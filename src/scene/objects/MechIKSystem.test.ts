import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MECH_SCALE, sampleMechFootSupport, solveReverseJointIKAngles } from '../../map/mechKinematics';
import { BRIDGE_SPECS } from '../../map/terrainMath';
import { resolveMechControl } from './MechController';
import { plantedFootSupport, stepMechIK } from './MechIKSystem';
import { buildMechModel, type MechMaterials } from './MechModel';
import { stepMechMovement } from './MechMovementSystem';
import { createMechState } from './MechState';

test('planted foot reuses only exact contact samples, including bridge approach height', () => {
  const bridge = BRIDGE_SPECS[1];
  const x = (bridge.start[0] + bridge.end[0]) / 2;
  const z = (bridge.start[1] + bridge.end[1]) / 2;
  const leg = { plantedWorld: new THREE.Vector3(x, 0, z) };
  const deckY = bridge.deckY + 0.5;
  const deck = plantedFootSupport(leg, 0, deckY);
  assert.equal(deck.onBridge, true);
  assert.equal(plantedFootSupport(leg, 0, deckY), deck);
  const bed = plantedFootSupport(leg, 0, 0);
  assert.equal(bed.onBridge, false);
  assert.equal(bed.inWater, true);
  let previous = bed;
  for (const [dx, dz, yaw] of [[0.000001, 0, 0], [0, 0.000001, 0], [0, 0, 0.001]]) {
    leg.plantedWorld.x += dx;
    leg.plantedWorld.z += dz;
    const support = plantedFootSupport(leg, yaw, 0);
    assert.notEqual(support, previous);
    assert.deepEqual(support, sampleMechFootSupport(leg.plantedWorld.x, leg.plantedWorld.z, yaw, MECH_SCALE, 0));
    previous = support;
  }
});

test('feet and hydraulic attachments use the current pelvis and joint transforms', () => {
  const material = new THREE.MeshStandardMaterial();
  const rig = buildMechModel(new Proxy({} as MechMaterials, { get: () => material }));
  try {
    const sim = createMechState();
    const control = resolveMechControl({
      forward: 0, turn: 0, turretTurn: 0, fire: false, sprint: false, crouch: true,
    }, true);
    const dt = 1 / 60;
    for (const yaw of [0.24, -0.31, 0.57]) {
      sim.yaw = yaw;
      const motion = stepMechMovement(rig, sim, control, true, dt, 1);
      stepMechIK(rig, sim, dt, control, motion);
      // Compare against a full traversal, as used by the renderer after simulation.
      rig.root.updateMatrixWorld(true);
      rig.worldFeetGroup.updateMatrixWorld(true);
      for (const leg of rig.legs) {
        const target = leg.plantedWorld.clone().applyMatrix4(leg.hipAnchor.matrixWorld.clone().invert());
        const expected = solveReverseJointIKAngles(target.x, target.y, target.z);
        assert.ok(Math.abs(leg.hipJoint.rotation.x - expected.hipRotX) < 1e-10);
        const ankle = new THREE.Vector3().setFromMatrixPosition(leg.ankleAnchor.matrixWorld);
        assert.ok(leg.footGroup.position.distanceTo(ankle) < 1e-10);
        for (const piston of leg.pistons) {
          const a = new THREE.Vector3().setFromMatrixPosition(piston.a.matrixWorld);
          const b = new THREE.Vector3().setFromMatrixPosition(piston.b.matrixWorld);
          assert.ok(piston.barrel.position.distanceTo(a.clone().lerp(b, 0.28)) < 1e-10);
          assert.ok(piston.rod.position.distanceTo(a.lerp(b, 0.65)) < 1e-10);
        }
      }
    }
  } finally {
    rig.dispose();
    material.dispose();
  }
});
