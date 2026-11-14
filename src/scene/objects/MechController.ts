import * as THREE from 'three';
import type { MechDriveInput } from './MechState';

/** Deterministic, DOM-free normalization of a single frame's commands. */
export function resolveMechControl(input: Readonly<MechDriveInput>, driveMode: boolean) {
    const fwd = driveMode ? THREE.MathUtils.clamp(input.forward, -1, 1) : 0;
    const turn = driveMode ? THREE.MathUtils.clamp(input.turn, -1, 1) : 0;
    const turTurn = driveMode ? THREE.MathUtils.clamp(input.turretTurn, -1, 1) : 0;
    const isCrouched = driveMode && input.crouch;
    const isSprinting = driveMode && input.sprint && !isCrouched && Math.abs(fwd) > 0.1;
    const isFiring = driveMode && input.fire;

    const maxSpeed = isCrouched ? 2.8 : isSprinting ? 6.8 : 5.05;
    const targetSpeed = fwd * maxSpeed;
    const targetTurnRate = turn * (isSprinting ? 1.55 : 1.32);

    const activity = Math.max(Math.abs(fwd), Math.abs(turn));
    const targetOmega = isCrouched ? 4.5 : isSprinting ? 9.0 : 5.4 + activity * 1.8;
    const stepLength = (isCrouched ? 1.45 : isSprinting ? 2.15 : 1.9) * fwd;
    const stepClearance = isCrouched ? 0.28 : isSprinting ? 0.44 : 0.36;
    const crouchOffset = isCrouched ? -0.32 : 0;

    const isMoving = Math.abs(targetSpeed) > 0.08 || Math.abs(targetTurnRate) > 0.05;
  return { fwd, turn, turTurn, isCrouched, isSprinting, isFiring, maxSpeed, targetSpeed,
    targetTurnRate, activity, targetOmega, stepLength, stepClearance, crouchOffset, isMoving };
}
export type MechControl = ReturnType<typeof resolveMechControl>;
