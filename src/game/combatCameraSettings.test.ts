import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION } from './combatCameraSettings';

test('combat view uses the selected close shoulder camera geometry', () => {
  assert.deepEqual(COMBAT_CAMERA_DEFAULT, {
    distance: 10, heightAboveMech: 4.8, shoulderOffset: 1.6, fovDegrees: 45,
  });
  assert.deepEqual(COMBAT_CAMERA_PRECISION, {
    distance: 7.8, heightAboveMech: 4, shoulderOffset: 1.15, fovDegrees: 29,
  });
  assert.ok(COMBAT_CAMERA_PRECISION.distance < COMBAT_CAMERA_DEFAULT.distance);
  assert.ok(COMBAT_CAMERA_DEFAULT.heightAboveMech > 3.1);
});
