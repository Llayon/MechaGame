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
  shoulderOffset: 1.6,
  fovDegrees: 45,
};

export const COMBAT_CAMERA_PRECISION: Readonly<CombatCameraPreset> = {
  distance: 7.8,
  heightAboveMech: 4.0,
  shoulderOffset: 1.15,
  fovDegrees: 29,
};
