import type { Vector3 } from 'three';
import { AIM_ELEVATION_MAX, AIM_ELEVATION_MIN } from './combatAim';

/** Battle follow-camera geometry in scene world units; overview stays separate. */
export interface CombatCameraPreset {
  distance: number;
  heightAboveMech: number;
  shoulderOffset: number;
  fovDegrees: number;
}

export const COMBAT_CAMERA_DEFAULT: Readonly<CombatCameraPreset> = {
  distance: 22,
  heightAboveMech: 6,
  shoulderOffset: 1.25,
  fovDegrees: 50,
};

export const COMBAT_CAMERA_PRECISION: Readonly<CombatCameraPreset> = {
  distance: 7.8,
  heightAboveMech: 4.8,
  shoulderOffset: 3.55,
  fovDegrees: 29,
};

export function setCombatCameraShoulder(
  out: Vector3, x: number, shoulderY: number, z: number, yaw: number, lateralOffset: number,
): Vector3 {
  // Retain the shoulder view with the mech on the right of the screen.
  return out.set(
    x + Math.cos(yaw) * lateralOffset,
    shoulderY,
    z - Math.sin(yaw) * lateralOffset,
  );
}

/** Move along the unit sight direction so changing boom length preserves the center ray. */
export function setCombatCameraEye(
  out: Vector3, shoulder: Vector3, direction: Vector3, boomDistance: number,
): Vector3 {
  return out.copy(shoulder).addScaledVector(direction, -boomDistance);
}

/** Orient an orbiting, laterally offset shoulder so its sightline still passes through the focus. */
export function aimShoulderAtPoint(
  point: Vector3, x: number, shoulderY: number, z: number, lateralOffset: number,
  out: { yaw: number; elevation: number },
): boolean {
  const dx = point.x - x, dz = point.z - z;
  // The shoulder offset and the horizontal forward distance form a right triangle.
  const forward = Math.sqrt(dx * dx + dz * dz - lateralOffset * lateralOffset);
  if (!Number.isFinite(forward) || forward < 0.5) return false;
  const pitch = Math.atan2(point.y - shoulderY, forward);
  if (!Number.isFinite(pitch) || pitch < AIM_ELEVATION_MIN - 1e-10 || pitch > AIM_ELEVATION_MAX + 1e-10) return false;
  out.yaw = Math.atan2(dx, dz) - Math.atan2(lateralOffset, forward);
  out.elevation = Math.max(AIM_ELEVATION_MIN, Math.min(AIM_ELEVATION_MAX, pitch));
  return true;
}

function crossesCylinder(
  eye: Vector3, dir: Vector3, dx: number, dz: number, bottom: number, top: number, radius: number,
): boolean {
  let enter = 0, leave = Infinity;
  if (dir.y === 0) {
    if (eye.y < bottom || eye.y > top) return false;
  } else {
    const base = (bottom - eye.y) / dir.y, cap = (top - eye.y) / dir.y;
    enter = Math.max(0, Math.min(base, cap));
    leave = Math.max(base, cap);
    if (leave < enter) return false;
  }
  // Find the closest XZ approach within the part of the forward ray inside the height slab.
  const horizontalSq = dir.x * dir.x + dir.z * dir.z;
  const nearest = horizontalSq > 0 ? -(dx * dir.x + dz * dir.z) / horizontalSq : enter;
  const t = Math.max(enter, Math.min(leave, nearest));
  return (dx + t * dir.x) ** 2 + (dz + t * dir.z) ** 2 <= radius * radius;
}

export function combatSightCrossesMech(
  eye: Vector3, direction: Vector3, x: number, groundY: number, z: number, crouchDrop: number, margin: number,
): boolean {
  if (direction.lengthSq() === 0) return false;
  const dx = eye.x - x, dz = eye.z - z;
  const hullTop = groundY + 4.5 - crouchDrop;
  // Gun pods rotate around the chassis; only the whip antenna occupies the upper band.
  return crossesCylinder(eye, direction, dx, dz, groundY - margin, hullTop + margin, 2.55 + margin)
    || crossesCylinder(eye, direction, dx, dz, hullTop - margin, groundY + 5.3 - crouchDrop + margin, 1.1 + margin);
}
