export type InputControlPreference = 'auto' | 'desktop' | 'touch';

export interface DeviceLayoutMode {
  width: number;
  height: number;
  isTouchDevice: boolean;
  isCompactScreen: boolean;
  isLandscapeMobile: boolean;
  useTouchControls: boolean;
}

export function computeDeviceLayoutMode(
  width: number,
  height: number,
  isCoarsePointer: boolean,
  maxTouchPoints: number,
  preference: InputControlPreference = 'auto',
): DeviceLayoutMode {
  const isTouchDevice = isCoarsePointer || maxTouchPoints > 0;
  const isCompactScreen = width < 900 || height < 540;
  const isLandscapeMobile = width < 1024 && height < 540 && width > height;
  const autoTouch = isTouchDevice || width < 900;
  const useTouchControls =
    preference === 'touch' ? true : preference === 'desktop' ? false : autoTouch;

  return {
    width,
    height,
    isTouchDevice,
    isCompactScreen,
    isLandscapeMobile,
    useTouchControls,
  };
}

export function readBrowserDeviceLayout(
  preference: InputControlPreference = 'auto',
): DeviceLayoutMode {
  if (typeof window === 'undefined') {
    return computeDeviceLayoutMode(1440, 900, false, 0, preference);
  }
  const coarse =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const touchPoints =
    typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : 0;
  return computeDeviceLayoutMode(
    window.innerWidth,
    window.innerHeight,
    coarse,
    touchPoints,
    preference,
  );
}

export interface JoystickAxesResult {
  forward: number;
  turn: number;
  sprint: boolean;
  stickX: number;
  stickY: number;
  magnitude: number;
}

/**
 * Computes normalized Mech forward/turn axes from virtual thumbstick pointer offset.
 * Screen +X is right (negative yaw turn), screen -Y is up (positive forward drive).
 */
export function computeJoystickAxes(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzone = 0.14,
): JoystickAxesResult {
  const safeRadius = Math.max(1, maxRadius);
  const rawDist = Math.hypot(dx, dy);
  if (rawDist < 1e-5) {
    return { forward: 0, turn: 0, sprint: false, stickX: 0, stickY: 0, magnitude: 0 };
  }

  const clampedDist = Math.min(rawDist, safeRadius);
  const ux = dx / rawDist;
  const uy = dy / rawDist;
  const stickX = ux * clampedDist;
  const stickY = uy * clampedDist;
  const normDist = clampedDist / safeRadius;

  if (normDist <= deadzone) {
    return { forward: 0, turn: 0, sprint: false, stickX, stickY, magnitude: 0 };
  }

  const scaled = (normDist - deadzone) / Math.max(1e-5, 1 - deadzone);
  const forward = Math.max(-1, Math.min(1, -uy * scaled));
  const turn = Math.max(-1, Math.min(1, -ux * scaled));
  const sprint = normDist > 0.86 && forward > 0.55;

  return {
    forward,
    turn,
    sprint,
    stickX,
    stickY,
    magnitude: scaled,
  };
}

/**
 * Converts horizontal touch-drag pixels on the aim zone into bounded turret yaw delta (rad).
 * Swiping right (+deltaPxX) aims right (negative turret yaw in Three.js Y-up).
 */
export function computeTouchAimDelta(deltaPxX: number, sensitivity = 0.0065): number {
  const raw = -deltaPxX * sensitivity;
  return Math.max(-0.35, Math.min(0.35, raw));
}
