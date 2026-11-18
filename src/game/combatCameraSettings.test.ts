import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { AIM_ELEVATION_MIN, AIM_ELEVATION_MAX, aimDirection } from './combatAim';
import {
  aimShoulderAtPoint, combatSightCrossesMech, COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION,
  setCombatCameraEye, setCombatCameraShoulder,
} from './combatCameraSettings';

const normal = COMBAT_CAMERA_DEFAULT;
const precise = COMBAT_CAMERA_PRECISION;

test('ordinary view pulls up and back while precision uses its close shoulder', () => {
  assert.deepEqual(normal, { distance: 22, heightAboveMech: 6, shoulderOffset: 1.25, fovDegrees: 50 });
  assert.deepEqual(precise, { distance: 7.8, heightAboveMech: 4.8, shoulderOffset: 3.55, fovDegrees: 29 });
  const groundY = 2;
  const shoulder = setCombatCameraShoulder(new Vector3(), 4, groundY + normal.heightAboveMech - .65,
    8, Math.PI / 2, normal.shoulderOffset);
  assert.deepEqual(shoulder.toArray(), [4, groundY + 6 - .65, 8 - 1.25]);
  const dir = new Vector3(...aimDirection(Math.PI / 2, AIM_ELEVATION_MIN));
  const camera = new PerspectiveCamera(normal.fovDegrees, 16 / 9, .35, 3200);
  setCombatCameraEye(camera.position, shoulder, dir, normal.distance);
  assert.ok(camera.position.y > shoulder.y && camera.position.x < shoulder.x);
  camera.lookAt(shoulder);
  camera.updateMatrixWorld();
  assert.ok(new Vector3(4, groundY + 3, 8).project(camera).x > 0);
});

test('a stationary close or distant target stays at screen center through both zoom transitions', () => {
  const x = -21, y = 4, z = 13;
  const camera = new PerspectiveCamera(50, 16 / 9, .35, 3200);
  const aim = { yaw: 0, elevation: 0 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  for (const [start, end] of [[normal, precise], [precise, normal]]) {
    for (const heading of [-2.75, -.1, .39, Math.PI - .1]) {
      for (const range of [10, 30, 150]) {
        for (const initialPitch of [-.1, .12]) {
          const point = setCombatCameraShoulder(new Vector3(), x, y + start.heightAboveMech, z, heading, start.shoulderOffset)
            .addScaledVector(new Vector3(...aimDirection(heading, initialPitch)), range);
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const height = lerp(start.heightAboveMech, end.heightAboveMech, t);
            const offset = lerp(start.shoulderOffset, end.shoulderOffset, t);
            assert.ok(aimShoulderAtPoint(point, x, y + height, z, offset, aim));
            const shoulder = setCombatCameraShoulder(new Vector3(), x, y + height, z, aim.yaw, offset);
            const dir = new Vector3(...aimDirection(aim.yaw, aim.elevation));
            setCombatCameraEye(camera.position, shoulder, dir, lerp(start.distance, end.distance, t));
            camera.fov = lerp(start.fovDegrees, end.fovDegrees, t);
            camera.lookAt(shoulder);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            const ndc = point.clone().project(camera);
            assert.ok(Math.hypot(ndc.x, ndc.y) < 1e-9 && ndc.z > -1 && ndc.z < 1);
          }
        }
      }
    }
  }
});

test('inside the shoulder orbit, near its tangent or beyond pitch travel, retain the original aim', () => {
  const oldAim = { yaw: 2.5, elevation: .12 };
  for (const point of [new Vector3(1, 4.8, 0), new Vector3(3.55, 4.8, .1),
    new Vector3(0, 20, 12), new Vector3(0, -20, 12)]) {
    const aim = { ...oldAim };
    assert.equal(aimShoulderAtPoint(point, 0, 4.8, 0, 3.55, aim), false);
    assert.deepEqual(aim, oldAim);
  }
});

test('both unobstructed mounts clear the mech across pitch travel, standing and crouched', () => {
  for (const preset of [normal, precise]) {
    for (const yaw of [0, .62, Math.PI, -1.7]) {
      for (const pitch of [AIM_ELEVATION_MIN, 0, AIM_ELEVATION_MAX]) {
        for (const crouched of [false, true]) {
          const dir = new Vector3(...aimDirection(yaw, pitch));
          const shoulder = setCombatCameraShoulder(new Vector3(), 12, 3 + preset.heightAboveMech - (crouched ? .65 : 0),
            -7, yaw, preset.shoulderOffset);
          const eye = setCombatCameraEye(new Vector3(), shoulder, dir, preset.distance);
          assert.equal(combatSightCrossesMech(eye, dir, 12, 3, -7, crouched ? .65 : 0, .15), false);
        }
      }
    }
  }
});

test('a contracted shoulder can cross the gun pods or antenna while a ray pointing away remains clear', () => {
  const forward = new Vector3(0, 0, 1);
  const crosses = (x: number, y: number, z: number, margin = 0) =>
    combatSightCrossesMech(new Vector3(x, y, z), forward, 0, 0, 0, 0, margin);
  assert.ok(crosses(.5, 3.5, -3.4));
  assert.ok(crosses(0, 3.6, 0));
  assert.ok(crosses(.8, 5.2, -2));
  assert.equal(crosses(2, 5.1, -3), false);
  assert.equal(crosses(0, 3.5, 4), false);
  assert.equal(crosses(2.65, 4, -3), false);
  assert.ok(crosses(2.65, 4, -3, .2));
  assert.ok(combatSightCrossesMech(new Vector3(0, 8, 0), new Vector3(0, -1, 0), 0, 0, 0, 0, 0));
});
