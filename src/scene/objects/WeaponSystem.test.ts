import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getMainGunRay, stepWeaponSystem } from './WeaponSystem';
import type { MechRig } from './MechModel';
import { COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION } from '../../game/combatCameraSettings';
import { createCombatState, PLAYER_MAX_RANGE, processPlayerShots } from '../../game/combatSimulation';
import { resolveGunSightPoint } from '../../game/weaponReticle';
import { getWalkableSurfaceY } from '../../map/mechKinematics';

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

function mountedGuns() {
  const hull = new THREE.Group();
  hull.position.set(-12, 3, 20);
  hull.rotation.set(-0.045, 0.37, 0.025);
  hull.scale.setScalar(0.8);
  const gunBarrels = [-1, 1].flatMap(side => {
    const elevPivot = new THREE.Group();
    elevPivot.position.set(side * 1.92, 3.5, 0.6);
    hull.add(elevPivot);
    return [-0.22, 0.22].map(y => {
      const mesh = new THREE.Group();
      mesh.position.set(0, y, side === 1 ? 0.15 : 0.32);
      elevPivot.add(mesh);
      const muzzleAnchor = new THREE.Object3D();
      muzzleAnchor.position.z = 1.52;
      mesh.add(muzzleAnchor);
      return { elevPivot, mesh, muzzleAnchor, side, fireAccum: 0.95, rateHz: 4 };
    });
  });
  return { hull, rig: { gunBarrels } as unknown as MechRig };
}

test('four recoiling gun meshes and the center weapon converge from their own world origins', () => {
  const { hull, rig } = mountedGuns();
  const target = hull.localToWorld(new THREE.Vector3(0.5, 0, 14));
  const shots = stepWeaponSystem(rig, 0.05, true, 0.18, target);
  assert.equal(shots.length, 4);
  const midpoint = new THREE.Vector3();
  for (const shot of shots) {
    midpoint.add(shot.muzzlePosition);
    assert.ok(new THREE.Ray(shot.muzzlePosition, shot.direction).distanceToPoint(target) < 1e-8);
    const barrel = rig.gunBarrels[shot.barrelIndex];
    assert.ok(barrel.muzzleAnchor.getWorldDirection(new THREE.Vector3()).distanceTo(shot.direction) < 1e-8);
  }
  const origin = new THREE.Vector3(), direction = new THREE.Vector3();
  getMainGunRay(rig, origin, direction, target);
  assert.ok(origin.distanceTo(midpoint.multiplyScalar(0.25)) < 1e-8);
  assert.ok(new THREE.Ray(origin, direction).distanceToPoint(target) < 1e-8);
});

test('mechanical trim is bounded, and a point behind the muzzle cannot reverse a barrel', () => {
  const { hull, rig } = mountedGuns();
  const flank = hull.localToWorld(new THREE.Vector3(20, 3.5, 7));
  const shots = stepWeaponSystem(rig, 0.05, true, 0, flank);
  const nominal = hull.getWorldDirection(new THREE.Vector3());
  for (const s of shots) {
    assert.ok(s.direction.angleTo(nominal) < THREE.MathUtils.degToRad(24.01));
    assert.ok(new THREE.Ray(s.muzzlePosition, s.direction).distanceToPoint(flank) > 5);
  }
  const direction = new THREE.Vector3(), origin = new THREE.Vector3();
  getMainGunRay(rig, origin, direction, flank);
  assert.ok(new THREE.Ray(origin, direction).distanceToPoint(flank) > 5);
  const back = hull.localToWorld(new THREE.Vector3(0, 3, -2));
  stepWeaponSystem(rig, 0, false, 0, back);
  getMainGunRay(rig, origin, direction, back);
  assert.ok(direction.distanceTo(nominal) < 1e-8);
  stepWeaponSystem(rig, 0, false, 0, flank);
  stepWeaponSystem(rig, 0, false, 0);
  getMainGunRay(rig, origin, direction);
  assert.ok(direction.distanceTo(nominal) < 1e-8);
});

test('centered shoulder sights hit a bridge spotter near maximum range from either pod; aiming high misses', () => {
  for (const camera of [COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION]) {
    for (const aimedHigh of [false, true]) {
      const state = createCombatState(true);
      const spotter = state.infantry.soldiers.find(s => s.siteIndex === 1 && s.role === 'spotter')!;
      const { hull, rig } = mountedGuns();
      // A clear ground-to-bridge sightline, facing northwest from the opposite bank.
      hull.position.set(22.64, getWalkableSurfaceY(22.64, -106.59).y, -106.59);
      const target = new THREE.Vector3(spotter.x, spotter.y + 0.24, spotter.z);
      const dx = target.x - hull.position.x, dz = target.z - hull.position.z;
      const yaw = Math.atan2(dx, dz) - Math.asin(camera.shoulderOffset / Math.hypot(dx, dz));
      hull.rotation.set(-0.045, yaw, 0.025, 'YXZ');
      const eye = hull.position.clone().add(new THREE.Vector3(
        camera.shoulderOffset * Math.cos(yaw) - camera.distance * Math.sin(yaw),
        camera.heightAboveMech,
        -camera.shoulderOffset * Math.sin(yaw) - camera.distance * Math.cos(yaw),
      ));
      const elevation = Math.atan2(target.y - eye.y, Math.hypot(target.x - eye.x, target.z - eye.z))
        + (aimedHigh ? 0.08 : 0);
      assert.ok(eye.distanceTo(target) > PLAYER_MAX_RANGE);
      const sight = resolveGunSightPoint(state, eye, yaw, elevation, eye.distanceTo(hull.position), new THREE.Vector3());
      const volley = stepWeaponSystem(rig, 0.05, true, -elevation, sight);
      assert.equal(volley.length, 4);
      for (const shot of volley) {
        // Resolve each bore independently against the same undamaged spotter.
        const encounter = createCombatState(true);
        const before = encounter.infantry.soldiers[spotter.id].hp;
        const p = shot.muzzlePosition, d = shot.direction;
        const [hit] = processPlayerShots(encounter, [{
          muzzleX: p.x, muzzleY: p.y, muzzleZ: p.z, dirX: d.x, dirY: d.y, dirZ: d.z,
        }], hull.position.x, hull.position.y, hull.position.z, yaw, true);
        assert.equal(encounter.infantry.soldiers[spotter.id].hp, aimedHigh ? before : 0);
        assert.equal(hit.hitKind === 'enemy', !aimedHigh);
      }
    }
  }
});
