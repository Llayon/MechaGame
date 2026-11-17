/**
 * Independent camera-view intention versus delayed physical turret direction.
 * Angles are world-relative radians: positive yaw looks right (+X), positive
 * elevation looks up. The gun's Three.js pivot uses -elevation (local +Z).
 */
export interface CombatAimState {
  yaw: number;
  elevation: number;
  initialized: boolean;
  precise: boolean;
  reticleX: number;
  reticleY: number;
  reticleVisible: boolean;
  reticleHit: 'enemy' | 'barrel' | 'cover' | 'range';
  reticleTargetId: string | null;
}

export const AIM_ELEVATION_MIN = -0.34;
export const AIM_ELEVATION_MAX = 0.35;
export const MOUSE_YAW_SENSITIVITY = 0.00255;
export const MOUSE_ELEVATION_SENSITIVITY = 0.00225;
export const TURRET_ROTATION_RATE = 2.0;

export function createCombatAimState(yaw: number): CombatAimState {
  return {
    yaw, elevation: -0.025, initialized: false, precise: false,
    reticleX: 0, reticleY: 0, reticleVisible: false,
    reticleHit: 'range', reticleTargetId: null,
  };
}

export function resetCombatAim(aim: CombatAimState, hullYaw: number): void {
  aim.yaw = hullYaw;
  aim.elevation = -0.025;
  aim.precise = false;
  aim.initialized = true;
  aim.reticleX = 0;
  aim.reticleY = 0;
  aim.reticleVisible = false;
  aim.reticleHit = 'range';
  aim.reticleTargetId = null;
}

export function updateCombatAim(
  aim: CombatAimState,
  yawDelta: number,
  elevationDelta: number,
): void {
  if (Number.isFinite(yawDelta)) aim.yaw += Math.max(-0.75, Math.min(0.75, yawDelta));
  if (Number.isFinite(elevationDelta)) {
    aim.elevation = Math.max(AIM_ELEVATION_MIN,
      Math.min(AIM_ELEVATION_MAX, aim.elevation + Math.max(-0.75, Math.min(0.75, elevationDelta))));
  }
}

export function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Bounded step allows a heavy turret to visibly lag the mouse, no spin on wraparound. */
export function approachTurretWorldYaw(
  currentRelativeYaw: number,
  hullYawAfterMovement: number,
  desiredWorldYaw: number,
  dt: number,
): number {
  const relativeDelta = shortestAngleDelta(
    hullYawAfterMovement + currentRelativeYaw, desiredWorldYaw);
  const maxStep = Math.max(0, Math.min(0.05, dt)) * TURRET_ROTATION_RATE;
  return currentRelativeYaw + Math.max(-maxStep, Math.min(maxStep, relativeDelta));
}

/** 3D aim direction corresponding to a desired yaw/elevation. */
export function aimDirection(yaw: number, elevation: number): [number, number, number] {
  const c = Math.cos(elevation);
  return [Math.sin(yaw) * c, Math.sin(elevation), Math.cos(yaw) * c];
}

/** DOM overlay transform, based on physical muzzle ray projected by camera. */
export function projectedReticlePercent(ndcX: number, ndcY: number): { x: number; y: number } {
  return {
    x: Math.max(2, Math.min(98, 50 + ndcX * 50)),
    y: Math.max(3, Math.min(97, 50 - ndcY * 50)),
  };
}
