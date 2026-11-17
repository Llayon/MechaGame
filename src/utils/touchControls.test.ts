import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeviceLayoutMode,
  computeJoystickAxes,
  computeTouchAimDelta,
  computeTouchAimPitchDelta,
} from './touchControls';

test('computeDeviceLayoutMode distinguishes desktop keyboard from mobile portrait, landscape, and touch devices', () => {
  const desktop = computeDeviceLayoutMode(1440, 900, false, 0);
  assert.equal(desktop.useTouchControls, false);
  assert.equal(desktop.isCompactScreen, false);
  assert.equal(desktop.isLandscapeMobile, false);

  const portraitPhone = computeDeviceLayoutMode(390, 844, true, 5);
  assert.equal(portraitPhone.useTouchControls, true);
  assert.equal(portraitPhone.isCompactScreen, true);
  assert.equal(portraitPhone.isLandscapeMobile, false);

  const landscapePhone = computeDeviceLayoutMode(844, 390, true, 5);
  assert.equal(landscapePhone.useTouchControls, true);
  assert.equal(landscapePhone.isCompactScreen, true);
  assert.equal(landscapePhone.isLandscapeMobile, true);

  const narrowWindowDesktop = computeDeviceLayoutMode(390, 844, false, 0);
  assert.equal(narrowWindowDesktop.useTouchControls, true);

  const forcedDesktopOnTablet = computeDeviceLayoutMode(1024, 768, true, 5, 'desktop');
  assert.equal(forcedDesktopOnTablet.useTouchControls, false);

  const forcedTouchOnDesktop = computeDeviceLayoutMode(1440, 900, false, 0, 'touch');
  assert.equal(forcedTouchOnDesktop.useTouchControls, true);
});

test('computeJoystickAxes applies deadzone, clamps to radius, maps directions, and triggers auto-sprint', () => {
  const center = computeJoystickAxes(2, -3, 50, 0.14);
  assert.equal(center.forward, 0);
  assert.equal(center.turn, 0);
  assert.equal(center.sprint, false);

  // Full push straight up (-Y): full forward + sprint
  const fullUp = computeJoystickAxes(0, -80, 50, 0.14);
  assert.ok(fullUp.forward > 0.99);
  assert.ok(Math.abs(fullUp.turn) < 1e-6);
  assert.equal(fullUp.sprint, true);
  assert.equal(Math.round(fullUp.stickY), -50);

  // Gentle push forward (55%): walk without sprint
  const walkUp = computeJoystickAxes(0, -28, 50, 0.14);
  assert.ok(walkUp.forward > 0.4 && walkUp.forward < 0.6);
  assert.equal(walkUp.sprint, false);

  // Push left (-X): positive turn (leftward yaw)
  const pushLeft = computeJoystickAxes(-50, 0, 50, 0.14);
  assert.ok(pushLeft.turn > 0.99);
  assert.equal(pushLeft.sprint, false);
});

test('touch swipe aims along same camera yaw and elevation as mouse', () => {
  assert.ok(computeTouchAimDelta(20) < 0);
  assert.ok(computeTouchAimDelta(-20) > 0);
  assert.equal(computeTouchAimDelta(500), -0.35);
  assert.equal(computeTouchAimDelta(-500), 0.35);
  assert.ok(computeTouchAimPitchDelta(-20) > 0);
  assert.ok(computeTouchAimPitchDelta(20) < 0);
  assert.equal(computeTouchAimPitchDelta(-500), 0.25);
  assert.equal(computeTouchAimPitchDelta(500), -0.25);
});
