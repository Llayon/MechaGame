import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatAimState, resetCombatAim, updateCombatAim, shortestAngleDelta,
  approachTurretWorldYaw, aimDirection, projectedReticlePercent, AIM_ELEVATION_MAX,
  AIM_ELEVATION_MIN, MOUSE_YAW_SENSITIVITY, MOUSE_ELEVATION_SENSITIVITY,
} from './combatAim';

test('mouse horizontal and vertical movement changes view with clamped elevation', () => {
  const aim = createCombatAimState(0);
  resetCombatAim(aim, 0);
  updateCombatAim(aim, 100 * MOUSE_YAW_SENSITIVITY, 100 * MOUSE_ELEVATION_SENSITIVITY);
  assert.ok(aim.yaw > 0);
  assert.ok(aim.elevation > 0);
  updateCombatAim(aim, 0, 1);
  assert.equal(aim.elevation, AIM_ELEVATION_MAX);
  updateCombatAim(aim, 0, -2);
  assert.equal(aim.elevation, AIM_ELEVATION_MIN);
  updateCombatAim(aim, Number.NaN, Infinity);
  assert.ok(Number.isFinite(aim.yaw) && Number.isFinite(aim.elevation));
});

test('mechanical turret tracks shortest path across pi boundary without jumping', () => {
  assert.ok(Math.abs(shortestAngleDelta(Math.PI - 0.01, -Math.PI + 0.01) - 0.02) < 1e-6);
  const next = approachTurretWorldYaw(Math.PI - 0.01, 0, -Math.PI + 0.4, 0.05);
  assert.ok(next > Math.PI - 0.01);
  assert.ok(next < Math.PI + 0.11);
  assert.equal(approachTurretWorldYaw(0, 0, 1.2, 0), 0);
  assert.ok(approachTurretWorldYaw(0, 0, 1.2, 0.05) <= 0.10000001);
});

test('actual look direction includes pitch and maps positive yaw right', () => {
  const front = aimDirection(0, 0);
  assert.ok(Math.abs(front[0]) < 1e-8 && front[2] === 1);
  const right = aimDirection(Math.PI / 2, 0);
  assert.ok(right[0] > 0.99);
  const up = aimDirection(0, 0.2);
  assert.ok(up[1] > 0);
});

test('muzzle reticle projection maps NDC to screen, safely clipped to bounds', () => {
  assert.deepEqual(projectedReticlePercent(0, 0), {x:50, y:50});
  assert.deepEqual(projectedReticlePercent(0.5, 0.5), {x:75, y:25});
  assert.deepEqual(projectedReticlePercent(99, -99), {x:98, y:97});
});
