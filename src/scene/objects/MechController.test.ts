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
test('sprint and crouch preserve existing speeds and priorities', () => {
  assert.equal(resolveMechControl({ ...neutral, forward: 1 }, true).targetSpeed, 5.05);
  assert.equal(resolveMechControl({ ...neutral, forward: 1, sprint: true }, true).targetSpeed, 6.8);
  const c = resolveMechControl({ ...neutral, forward: 1, sprint: true, crouch: true }, true);
  assert.equal(c.targetSpeed, 2.8);
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
