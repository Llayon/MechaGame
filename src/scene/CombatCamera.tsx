import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getWalkableSurfaceY } from '../map/mechKinematics';
import { castCombatRay } from '../map/worldRaycaster';
import { aimDirection, type CombatAimState } from '../game/combatAim';
import {
  COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION, setCombatCameraEye, setCombatCameraShoulder,
} from '../game/combatCameraSettings';
import { projectMuzzleDirection } from '../game/reticlePresentation';
import { PLAYER_MODEL_LAYER } from './playerModelLayer';

const WALL_CLEARANCE = 0.65;
const FLOOR_CLEARANCE = 0.8;

/** The segment starts inside the playable space. Stop on its near side, even at point-blank range. */
function clearTravel(start: THREE.Vector3, unit: THREE.Vector3, length: number, groundY: number): number {
  const hit = castCombatRay(start.x, start.y, start.z, unit.x, unit.y, unit.z, length);
  const limit = hit ? Math.max(0, hit.distance - WALL_CLEARANCE) : length;
  const steps = Math.ceil(limit / FLOOR_CLEARANCE);
  for (let i = 1; i <= steps; i++) {
    const d = limit * i / steps;
    const floor = getWalkableSurfaceY(start.x + unit.x * d, start.z + unit.z * d, groundY);
    if (start.y + unit.y * d < floor.y + FLOOR_CLEARANCE) return limit * (i - 1) / steps;
  }
  return limit;
}

/** Retract immediately at a wall, then extend smoothly once the path clears. */
function followClearance(previous: number, limit: number, dt: number): number {
  return Math.min(limit, THREE.MathUtils.damp(previous, limit, 9, dt));
}

export function useCombatCamera(active: boolean, resetNonce: number) {
  const { camera } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;
  const boom = useMemo(() => ({
    initialized: false, shoulderReach: 0, travel: 0, shoulderHeight: 0,
    desiredTravel: COMBAT_CAMERA_DEFAULT.distance,
    pivot: new THREE.Vector3(), shoulder: new THREE.Vector3(),
    outward: new THREE.Vector3(), forward: new THREE.Vector3(), back: new THREE.Vector3(),
    marker: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    boom.initialized = false;
    if (!active) return;
    const overviewNear = perspective.near;
    const overviewFov = perspective.fov;
    perspective.near = 0.35;
    perspective.updateProjectionMatrix();
    return () => {
      perspective.layers.enable(PLAYER_MODEL_LAYER);
      perspective.near = overviewNear;
      perspective.fov = overviewFov;
      perspective.updateProjectionMatrix();
    };
  }, [active, resetNonce, boom, perspective]);

  // Update after mech movement but before resolving any shot. The rendered sight
  // and the weapon rangefinder then use the same eye, including on the first ADS frame.
  function position(aim: CombatAimState, x: number, y: number, z: number, crouched: boolean, dt: number) {
    const settings = aim.precise ? COMBAT_CAMERA_PRECISION : COMBAT_CAMERA_DEFAULT;
    const first = !boom.initialized;
    setCombatCameraShoulder(boom.shoulder, x, y, z, aim.yaw, crouched, settings);
    const height = boom.shoulder.y - y;
    boom.shoulderHeight = first ? height : THREE.MathUtils.damp(boom.shoulderHeight, height, 12, dt);
    boom.shoulder.y = y + boom.shoulderHeight;
    boom.pivot.set(x, boom.shoulder.y - (settings.heightAboveMech - 3.1), z);

    // First clear the lateral mount, then retract the boom along the sight line.
    // A wall behind the player can shorten the boom without pulling it into the turret.
    boom.outward.subVectors(boom.shoulder, boom.pivot);
    const length = boom.outward.length();
    boom.outward.divideScalar(length);
    const armLimit = clearTravel(boom.pivot, boom.outward, length, y);
    boom.shoulderReach = first ? armLimit : followClearance(boom.shoulderReach, armLimit, dt);
    boom.shoulder.copy(boom.pivot).addScaledVector(boom.outward, boom.shoulderReach);

    boom.forward.set(...aimDirection(aim.yaw, aim.elevation));
    boom.back.copy(boom.forward).negate();
    boom.desiredTravel = first ? settings.distance :
      THREE.MathUtils.damp(boom.desiredTravel, settings.distance, 12, dt);
    const travelLimit = clearTravel(boom.shoulder, boom.back, boom.desiredTravel, y);
    boom.travel = first ? travelLimit : followClearance(boom.travel, travelLimit, dt);
    setCombatCameraEye(camera.position, boom.shoulder, boom.forward, boom.travel);
    camera.lookAt(boom.marker.copy(camera.position).add(boom.forward));
    const fov = first ? settings.fovDegrees : THREE.MathUtils.damp(perspective.fov, settings.fovDegrees, 10, dt);
    if (perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    // The rotating gun pods reach ~2.55 units from the hull center. Leave some
    // room around the crosshair and avoid flickering when riding an obstruction.
    const lateralClearance = settings.shoulderOffset * boom.shoulderReach / length;
    const modelVisible = camera.layers.isEnabled(PLAYER_MODEL_LAYER);
    if (lateralClearance < 2.95) camera.layers.disable(PLAYER_MODEL_LAYER);
    else if (!modelVisible && lateralClearance > 3.15) camera.layers.enable(PLAYER_MODEL_LAYER);
    boom.initialized = true;
  }

  function present(aim: CombatAimState, onShadowFocus: (focus: THREE.Vector3, camera: THREE.Camera) => void) {
    const marker = aim.gunSightValid ? projectMuzzleDirection(camera,
      boom.marker.set(aim.gunSightX, aim.gunSightY, aim.gunSightZ).sub(camera.position)) : null;
    aim.reticleVisible = marker !== null;
    if (marker) {
      aim.reticleX = marker.x;
      aim.reticleY = marker.y;
    }
    onShadowFocus(boom.pivot, camera);
  }

  return { position, present };
}
