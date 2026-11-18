import type { Vector3 } from 'three';

/** Battle follow-camera geometry in scene world units; overview stays separate. */
export interface CombatCameraPreset {
  distance: number;
  heightAboveMech: number;
  shoulderOffset: number;
  fovDegrees: number;
}

export const COMBAT_CAMERA_DEFAULT: Readonly<CombatCameraPreset> = {
  distance: 10.0,
  heightAboveMech: 4.8,
  shoulderOffset: 3.55,
  fovDegrees: 45,
};

export const COMBAT_CAMERA_PRECISION: Readonly<CombatCameraPreset> = {
  ...COMBAT_CAMERA_DEFAULT,
  distance: 7.8,
  fovDegrees: 29,
};

export function setCombatCameraShoulder(
  out: Vector3, x: number, groundY: number, z: number, yaw: number,
  crouched: boolean, preset: CombatCameraPreset,
): Vector3 {
  // Retain the shoulder view with the mech on the right of the screen.
  return out.set(
    x + Math.cos(yaw) * preset.shoulderOffset,
    groundY + preset.heightAboveMech - (crouched ? 0.65 : 0),
    z - Math.sin(yaw) * preset.shoulderOffset,
  );
}

/** Move along the unit sight direction so changing boom length preserves the center ray. */
export function setCombatCameraEye(
  out: Vector3, shoulder: Vector3, direction: Vector3, boomDistance: number,
): Vector3 {
  return out.copy(shoulder).addScaledVector(direction, -boomDistance);
}
