import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getWalkableSurfaceY } from '../map/mechKinematics';
import { castCombatRay } from '../map/worldRaycaster';
import { aimDirection, type CombatAimState } from '../game/combatAim';
import type { CombatSimulationState } from '../game/combatTypes';
import { predictPhysicalShotEndpoint } from '../game/weaponReticle';
import {
  COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION, aimShoulderAtPoint, combatSightCrossesMech,
  setCombatCameraEye, setCombatCameraShoulder,
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
    initialized: false, precise: false, blend: 0, shoulderFraction: 1, travel: 0, crouchDrop: 0,
    focusDepth: 0, focus: new THREE.Vector3(), previousMech: new THREE.Vector3(),
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
  function position(aim: CombatAimState, combat: CombatSimulationState, x: number, y: number,
    z: number, crouched: boolean, dt: number) {
    const first = !boom.initialized;
    const targetBlend = aim.precise ? 1 : 0;
    const transitioning = !first && boom.blend !== targetBlend;
    boom.forward.set(...aimDirection(aim.yaw, aim.elevation));
    if (first) {
      boom.blend = targetBlend;
      boom.focusDepth = 0;
    } else if (aim.precise !== boom.precise) {
      // Range the point beneath the actual crosshair before moving the eye. Using
      // the next barrel's marker here would pull the view aside during turret lag.
      const eye = camera.position, dir = boom.forward;
      const hit = predictPhysicalShotEndpoint(combat, eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, perspective.far);
      boom.focusDepth = hit.hit !== 'range' && hit.distance > boom.travel + 0.2 ? hit.distance : 0;
    }
    boom.precise = aim.precise;
    if (transitioning) {
      boom.blend = THREE.MathUtils.damp(boom.blend, targetBlend, 13, dt);
      if (Math.abs(boom.blend - targetBlend) < 0.001) boom.blend = targetBlend;
    }
    const normal = COMBAT_CAMERA_DEFAULT, precise = COMBAT_CAMERA_PRECISION;
    const shoulderOffset = THREE.MathUtils.lerp(normal.shoulderOffset, precise.shoulderOffset, boom.blend);
    const mountHeight = THREE.MathUtils.lerp(normal.heightAboveMech, precise.heightAboveMech, boom.blend);
    const drop = crouched ? 0.65 : 0;
    boom.crouchDrop = first ? drop : THREE.MathUtils.damp(boom.crouchDrop, drop, 12, dt);
    const shoulderY = y + mountHeight - boom.crouchDrop;
    boom.pivot.set(x, y + 3.1 - boom.crouchDrop, z);
    if (transitioning && boom.focusDepth > 0) {
      // Reconstruct from the current input direction. Mouse look stays live and
      // walking still translates the camera, even midway through a zoom or reversal.
      boom.focus.set(x, y, z).sub(boom.previousMech).add(camera.position)
        .addScaledVector(boom.forward, boom.focusDepth);
      const fraction = boom.shoulderFraction;
      if (!aimShoulderAtPoint(boom.focus, x, THREE.MathUtils.lerp(boom.pivot.y, shoulderY, fraction),
        z, shoulderOffset * fraction, aim)) boom.focusDepth = 0;
    }
    boom.previousMech.set(x, y, z);

    // First clear the lateral mount, then retract the boom along the sight line.
    // A wall behind the player can shorten the boom without pulling it into the turret.
    setCombatCameraShoulder(boom.shoulder, x, shoulderY, z, aim.yaw, shoulderOffset);
    boom.outward.subVectors(boom.shoulder, boom.pivot);
    const length = boom.outward.length();
    boom.outward.divideScalar(length);
    const fractionLimit = clearTravel(boom.pivot, boom.outward, length, y) / length;
    const previousFraction = boom.shoulderFraction;
    boom.shoulderFraction = first ? fractionLimit : followClearance(previousFraction, fractionLimit, dt);
    boom.shoulder.copy(boom.pivot).addScaledVector(boom.outward, boom.shoulderFraction * length);
    if (transitioning && boom.focusDepth > 0 && previousFraction !== boom.shoulderFraction) {
      // A nearby wall changed the mount used above. Aim from its actual safe position.
      const s = boom.shoulder;
      if (!aimShoulderAtPoint(boom.focus, s.x, s.y, s.z, 0, aim)) boom.focusDepth = 0;
    }

    boom.forward.set(...aimDirection(aim.yaw, aim.elevation));
    boom.back.copy(boom.forward).negate();
    const desiredTravel = THREE.MathUtils.lerp(normal.distance, precise.distance, boom.blend);
    const travelLimit = clearTravel(boom.shoulder, boom.back, desiredTravel, y);
    boom.travel = first ? travelLimit : followClearance(boom.travel, travelLimit, dt);
    setCombatCameraEye(camera.position, boom.shoulder, boom.forward, boom.travel);
    if (transitioning && boom.focusDepth > 0) boom.focusDepth = camera.position.distanceTo(boom.focus);
    camera.lookAt(boom.marker.copy(camera.position).add(boom.forward));
    const fov = THREE.MathUtils.lerp(normal.fovDegrees, precise.fovDegrees, boom.blend);
    if (perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    const modelVisible = camera.layers.isEnabled(PLAYER_MODEL_LAYER);
    const obstructed = combatSightCrossesMech(camera.position, boom.forward, x, y, z,
      boom.crouchDrop, modelVisible ? 0.15 : 0.3);
    if (obstructed) camera.layers.disable(PLAYER_MODEL_LAYER);
    else if (!modelVisible) camera.layers.enable(PLAYER_MODEL_LAYER);
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
