import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Ray, Vector3 } from 'three';
import { AIM_ELEVATION_MIN, AIM_ELEVATION_MAX, aimDirection } from './combatAim';
import {
  COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION, setCombatCameraEye, setCombatCameraShoulder,
} from './combatCameraSettings';

test('combat view uses the selected close shoulder camera geometry', () => {
  assert.deepEqual(COMBAT_CAMERA_DEFAULT, {
    distance: 10, heightAboveMech: 4.8, shoulderOffset: 3.55, fovDegrees: 45,
  });
  assert.deepEqual(COMBAT_CAMERA_PRECISION, {
    distance: 7.8, heightAboveMech: 4.8, shoulderOffset: 3.55, fovDegrees: 29,
  });
  assert.ok(COMBAT_CAMERA_PRECISION.distance < COMBAT_CAMERA_DEFAULT.distance);
  assert.ok(COMBAT_CAMERA_DEFAULT.heightAboveMech > 3.1);
});

test('a downward-looking boom rises behind the shoulder and keeps the mech on screen-right', () => {
  const preset = COMBAT_CAMERA_DEFAULT;
  const shoulder = setCombatCameraShoulder(new Vector3(), 4, 2, 8, Math.PI / 2, true, preset);
  assert.deepEqual(shoulder.toArray(), [4, 2 + 4.8 - 0.65, 8 - 3.55]);
  const direction = new Vector3(...aimDirection(Math.PI / 2, AIM_ELEVATION_MIN));
  const eye = setCombatCameraEye(new Vector3(), shoulder, direction, preset.distance);
  assert.ok(eye.y > shoulder.y && eye.x < shoulder.x);
  const camera = new PerspectiveCamera(preset.fovDegrees, 16 / 9, 0.1, 1200);
  camera.position.copy(eye);
  camera.lookAt(shoulder);
  camera.updateMatrixWorld();
  assert.ok(new Vector3(4, 2 + 3, 8).project(camera).x > 0);
});

test('the central ray clears the hull through the full pitch range, standing or crouched', () => {
  for (const yaw of [0, 0.6, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const elevation of [AIM_ELEVATION_MIN, 0, AIM_ELEVATION_MAX]) {
      for (const crouched of [false, true]) {
        const direction = new Vector3(...aimDirection(yaw, elevation));
        const horizontal = new Vector3(direction.x, 0, direction.z).normalize();
        for (const preset of [COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION]) {
          const shoulder = setCombatCameraShoulder(new Vector3(), 0, 0, 0, yaw, crouched, preset);
          const eye = setCombatCameraEye(new Vector3(), shoulder, direction, preset.distance);
          const ray = new Ray(eye.clone().setY(0), horizontal);
          assert.ok(Math.abs(ray.distanceToPoint(new Vector3()) - 3.55) < 1e-9);
          assert.ok(ray.distanceToPoint(new Vector3()) > 2.5, 'sightline crossed the mech footprint');
        }
      }
    }
  }
});

test('a sighted ground point stays at screen center throughout a precision zoom transition', () => {
  const normal = COMBAT_CAMERA_DEFAULT, precision = COMBAT_CAMERA_PRECISION;
  const yaw = 0.72, elevation = -0.16, ground = 4;
  const direction = new Vector3(...aimDirection(yaw, elevation));
  const shoulder = setCombatCameraShoulder(new Vector3(), -21, ground, 13, yaw, false, normal);
  const groundPoint = shoulder.clone().addScaledVector(direction, (ground - shoulder.y) / direction.y);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const anchor = setCombatCameraShoulder(new Vector3(), -21, ground, 13, yaw, false, precision);
    const distance = normal.distance + t * (precision.distance - normal.distance);
    const fov = normal.fovDegrees + t * (precision.fovDegrees - normal.fovDegrees);
    const camera = new PerspectiveCamera(fov, 16 / 9, 0.1, 1200);
    setCombatCameraEye(camera.position, anchor, direction, distance);
    camera.lookAt(anchor);
    camera.updateMatrixWorld();
    const pixel = groundPoint.clone().project(camera);
    assert.ok(Math.hypot(pixel.x, pixel.y) < 1e-9);
  }
});
