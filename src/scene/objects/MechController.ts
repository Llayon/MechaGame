import * as THREE from 'three';
import type { MechDriveInput } from './MechState';

export const WATER_SPEED_MULT = 0.82;

/** Deterministic, DOM-free normalization of a single frame's commands. */
export function resolveMechControl(
  input: Readonly<MechDriveInput>,
  driveMode: boolean,
  isDashing = false,
  inWater = false,
) {
  const rawFwd = driveMode ? THREE.MathUtils.clamp(input.forward, -1, 1) : 0;
  const fwd = isDashing ? (Math.abs(rawFwd) > 0.1 ? Math.sign(rawFwd) : 1) : rawFwd;
  const turn = driveMode ? THREE.MathUtils.clamp(input.turn, -1, 1) : 0;
  const turTurn = driveMode ? THREE.MathUtils.clamp(input.turretTurn, -1, 1) : 0;
  const isCrouched = driveMode && input.crouch && !isDashing;
  const isSprinting = driveMode && !isDashing && input.sprint && !isCrouched && Math.abs(fwd) > 0.1;
  const isFiring = driveMode && (input.fire || !!input.pointerFire);

  // Calibrated heavy Mech speeds (world units/sec):
  // 1.35 (~18.2 km/h crouch), 2.35 (~31.7 km/h walk), 3.45 (~46.6 km/h sprint), 6.2 (~83.7 km/h dash)
  // Wading in river water applies a light 18% drag on walking/sprinting while preserving Jet-Dash boost.
  const waterSpeedScale = inWater && !isDashing ? WATER_SPEED_MULT : 1.0;
  const baseMaxSpeed = isDashing ? 6.2 : isCrouched ? 1.35 : isSprinting ? 3.45 : 2.35;
  const maxSpeed = baseMaxSpeed * waterSpeedScale;
  const targetSpeed = fwd * maxSpeed;
  const targetTurnRate = turn * (isDashing ? 0.6 : isSprinting ? 1.35 : 1.18);

  const activity = Math.max(Math.abs(fwd), Math.abs(turn));
  const targetOmega = isDashing ? 10.5 : isCrouched ? 4.4 : isSprinting ? 8.6 : 5.2 + activity * 1.6;
  const stepLength = (isDashing ? 2.4 : isCrouched ? 1.4 : isSprinting ? 2.15 : 1.85) * fwd;
  const stepClearance = isDashing ? 0.48 : isCrouched ? 0.28 : isSprinting ? 0.44 : 0.36;
  const crouchOffset = isCrouched ? -0.32 : 0;

  const isMoving = Math.abs(targetSpeed) > 0.08 || Math.abs(targetTurnRate) > 0.05;
  return {
    fwd,
    turn,
    turTurn,
    isCrouched,
    isSprinting,
    isDashing,
    inWater,
    waterSpeedScale,
    isFiring,
    maxSpeed,
    targetSpeed,
    targetTurnRate,
    activity,
    targetOmega,
    stepLength,
    stepClearance,
    crouchOffset,
    isMoving,
  };
}
export type MechControl = ReturnType<typeof resolveMechControl>;

/** Map keyboard state to commands while keeping event listeners in the UI adapter. */
export function syncMechInputFromKeys(keys: ReadonlySet<string>, input: MechDriveInput): void {
  input.forward =
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  input.turn =
    (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  input.turretTurn = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  input.fire = keys.has('Space');
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
}
export function clearMechInput(keys: Set<string>, input: MechDriveInput): void {
  keys.clear();
  input.forward = 0;
  input.turn = 0;
  input.turretTurn = 0;
  input.turretAimDelta = 0;
  input.gunAimDelta = 0;
  input.precisionAim = false;
  input.fire = false;
  input.pointerFire = false;
  input.heavyFire = false;
  input.repair = false;
  input.dash = false;
  input.centerTurret = false;
  input.sprint = false;
  // Crouch is a persistent toggle, matching the existing input contract.
}

const KEY_TO_CODE_FALLBACK: Record<string, string> = {
  w: 'KeyW', ц: 'KeyW',
  s: 'KeyS', ы: 'KeyS',
  a: 'KeyA', ф: 'KeyA',
  d: 'KeyD', в: 'KeyD',
  q: 'KeyQ', й: 'KeyQ',
  e: 'KeyE', у: 'KeyE',
  m: 'KeyM', ь: 'KeyM',
  c: 'KeyC', с: 'KeyC',
  f: 'KeyF', а: 'KeyF',
  v: 'KeyV', м: 'KeyV',
  x: 'KeyX', ч: 'KeyX',
  t: 'KeyT', е: 'KeyT',
  h: 'KeyH', р: 'KeyH',
  g: 'KeyG', п: 'KeyG',
  p: 'KeyP', з: 'KeyP',
  r: 'KeyR', к: 'KeyR',
  u: 'KeyU', г: 'KeyU',
  ' ': 'Space',
  spacebar: 'Space',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  shift: 'ShiftLeft',
  escape: 'Escape',
};

/** Normalizes KeyboardEvent.code with fallback mapping from KeyboardEvent.key (incl. Cyrillic). */
export function normalizeKeyboardCode(code: string, key = ''): string {
  if (code && code !== 'Unidentified') return code;
  const lower = key.toLowerCase();
  return KEY_TO_CODE_FALLBACK[lower] ?? '';
}
