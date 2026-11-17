import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMechControl, syncMechInputFromKeys, clearMechInput } from './MechController';
import type { MechDriveInput } from './MechState';

const neutral: MechDriveInput = {
  forward: 0, turn: 0, turretTurn: 0, fire: false, sprint: false, crouch: false,
};
test('drive disabled blocks movement, turret rotation and firing', () => {
  const c = resolveMechControl({ ...neutral, forward: 1, turn: -1, turretTurn: 1, fire: true }, false);
  assert.equal(c.targetSpeed, 0);
  assert.equal(c.targetTurnRate, 0);
  assert.equal(c.turTurn, 0);
  assert.equal(c.isFiring, false);
});

test('held left mouse fire survives movement-key synchronization and clears on blur/pause', () => {
  const input: MechDriveInput = { ...neutral, pointerFire: true };
  syncMechInputFromKeys(new Set(['KeyW']), input);
  assert.equal(input.fire, false);
  assert.equal(input.pointerFire, true);
  assert.equal(resolveMechControl(input, true).isFiring, true);
  clearMechInput(new Set(['KeyW']), input);
  assert.equal(input.pointerFire, false);
  assert.equal(resolveMechControl(input, true).isFiring, false);
});
test('sprint and crouch preserve calibrated speeds and priorities', () => {
  assert.equal(resolveMechControl({ ...neutral, forward: 1 }, true).targetSpeed, 2.35);
  assert.equal(resolveMechControl({ ...neutral, forward: 1, sprint: true }, true).targetSpeed, 3.45);
  const c = resolveMechControl({ ...neutral, forward: 1, sprint: true, crouch: true }, true);
  assert.equal(c.targetSpeed, 1.35);
  assert.equal(c.isSprinting, false);
  assert.equal(c.crouchOffset, -0.32);
});
test('analog commands clamp without mutating input', () => {
  const input = Object.freeze({ ...neutral, forward: -10, turn: 5, turretTurn: -3 });
  const c = resolveMechControl(input, true);
  assert.equal(c.fwd, -1);
  assert.equal(c.turn, 1);
  assert.equal(c.turTurn, -1);
  assert.equal(input.forward, -10);
});

test('keyboard input mapping preserves existing bindings, priority and crouch toggle', () => {
  const keys = new Set(['KeyW', 'ArrowDown', 'KeyA', 'KeyQ', 'Space', 'ShiftRight']);
  const input: MechDriveInput = { ...neutral, crouch: true };
  syncMechInputFromKeys(keys, input);
  assert.equal(input.forward, 0);
  assert.equal(input.turn, 1);
  assert.equal(input.turretTurn, 1);
  assert.equal(input.fire, true);
  assert.equal(input.sprint, true);
  clearMechInput(keys, input);
  assert.equal(keys.size, 0);
  assert.equal(input.forward, 0);
  assert.equal(input.fire, false);
  assert.equal(input.crouch, true);
});

test('Jet-Dash boosts mech speed to 6.2 u/s forward or reverse and overrides crouch', () => {
  const fwdDash = resolveMechControl({ ...neutral, crouch: true }, true, true);
  assert.equal(fwdDash.isDashing, true);
  assert.equal(fwdDash.isCrouched, false);
  assert.equal(fwdDash.targetSpeed, 6.2);

  const revDash = resolveMechControl({ ...neutral, forward: -1 }, true, true);
  assert.equal(revDash.targetSpeed, -6.2);
});

