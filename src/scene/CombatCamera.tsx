import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type { MechTelemetrySnapshot } from '../map/mechKinematics';
import { getWalkableSurfaceY } from '../map/mechKinematics';
import { castCombatRay } from '../map/worldRaycaster';
import { aimDirection } from '../game/combatAim';
import { COMBAT_CAMERA_DEFAULT, COMBAT_CAMERA_PRECISION } from '../game/combatCameraSettings';
import { projectMuzzleDirection } from '../game/reticlePresentation';
import type { CombatAimState } from '../game/combatAim';

interface Props {
  active: boolean;
  paused: boolean;
  resetNonce: number;
  aimRef: MutableRefObject<CombatAimState>;
  mechPoseRef: MutableRefObject<MechTelemetrySnapshot>;
  /** Shadow follows the view while the normal overview camera is suspended. */
  onShadowFocus: (focus: THREE.Vector3, camera: THREE.Camera) => void;
}

/**
 * Restrained over-the-shoulder gameplay camera. No OrbitControls or free-fly
 * while fighting; aims in both axes and physically avoids terrain and cover.
 */
export function CombatCamera({ active, paused, resetNonce, aimRef, mechPoseRef, onShadowFocus }: Props) {
  const { camera, invalidate } = useThree();
  const wasActive = useRef(false);
  const lastResetNonce = useRef(resetNonce);
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraLook = useRef(new THREE.Vector3());
  const lastSafeDistance = useRef(COMBAT_CAMERA_DEFAULT.distance);
  const muzzleDirection = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      lastResetNonce.current = resetNonce;
      return;
    }
    // Camera is reset on drive entry / mission restart without hijacking overview controls.
    wasActive.current = false;
  }, [active, resetNonce]);

  useFrame((_, delta) => {
    if (paused) return;
    if (!active) return;
    const aim = aimRef.current;
    const mech = mechPoseRef.current;
    if (!aim.initialized) return;
    const precise = aim.precise;
    const [dx, dy, dz] = aimDirection(aim.yaw, aim.elevation);
    const c = Math.cos(aim.yaw);
    const s = Math.sin(aim.yaw);

    const settings = precise ? COMBAT_CAMERA_PRECISION : COMBAT_CAMERA_DEFAULT;
    const distance = settings.distance;
    const shoulder = settings.shoulderOffset;
    const eyeY = mech.y + (mech.isCrouched ? 2.45 : 3.1);
    const focalPoint = cameraLook.current.set(mech.x, eyeY, mech.z);
    const wanted = cameraTarget.current.set(
      mech.x - s * distance + c * shoulder,
      mech.y + settings.heightAboveMech + aim.elevation * 1.4,
      mech.z - c * distance - s * shoulder,
    );
    wanted.y = Math.max(wanted.y, getWalkableSurfaceY(wanted.x, wanted.z, mech.y).y + 1.5);

    // Avoid interpenetration by tracing from the mech toward desired camera.
    const ray = wanted.clone().sub(focalPoint);
    const rayDist = ray.length();
    let safeDistance = rayDist;
    if (rayDist > 0.01) {
      ray.multiplyScalar(1 / rayDist);
      const cover = castCombatRay(focalPoint.x, focalPoint.y, focalPoint.z,
        ray.x, ray.y, ray.z, rayDist);
      if (cover && cover.distance < rayDist) {
        safeDistance = Math.max(3.5, cover.distance - 0.7);
      }
    }
    // Terrain checks at intermediate points catch hills not represented by cover colliders.
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      const x = focalPoint.x + ray.x * rayDist * t;
      const y = focalPoint.y + ray.y * rayDist * t;
      const z = focalPoint.z + ray.z * rayDist * t;
      if (y < getWalkableSurfaceY(x, z, mech.y).y + 0.8) {
        safeDistance = Math.min(safeDistance, Math.max(3.5, rayDist * t - 1));
        break;
      }
    }
    lastSafeDistance.current = safeDistance < lastSafeDistance.current
      ? safeDistance
      : THREE.MathUtils.damp(lastSafeDistance.current, safeDistance, 6, Math.min(delta, .05));

    const safeTarget = focalPoint.clone().addScaledVector(ray, lastSafeDistance.current);
    const first = !wasActive.current || lastResetNonce.current !== resetNonce;
    const lambda = precise ? 15 : 9.5;
    if (first) camera.position.copy(safeTarget);
    else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, safeTarget.x, lambda, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, safeTarget.y, lambda, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, safeTarget.z, lambda, delta);
    }
    lastResetNonce.current = resetNonce;
    wasActive.current = true;
    const floorY = getWalkableSurfaceY(camera.position.x, camera.position.z, mech.y).y + 1.25;
    camera.position.y = Math.max(camera.position.y, floorY);

    // Camera points exactly along aim intention; visible reticle depicts lagging gun instead.
    camera.lookAt(camera.position.x + dx * 100, camera.position.y + dy * 100,
      camera.position.z + dz * 100);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = settings.fovDegrees;
    const nextFov = first ? fov : THREE.MathUtils.damp(perspective.fov, fov, 10, delta);
    if (Math.abs(perspective.fov - nextFov) > 0.01) {
      perspective.fov = nextFov;
      perspective.updateProjectionMatrix();
    }
    // Use the final camera pose to show where the guns are pointing at the sighted range.
    if (aim.gunSightValid) {
      muzzleDirection.current.set(aim.gunSightX, aim.gunSightY, aim.gunSightZ).sub(camera.position);
      const projectedGun = projectMuzzleDirection(camera, muzzleDirection.current);
      if (projectedGun) {
        aim.reticleX = projectedGun.x;
        aim.reticleY = projectedGun.y;
        aim.reticleVisible = true;
      } else {
        aim.reticleVisible = false;
      }
    } else {
      aim.reticleVisible = false;
    }
    onShadowFocus(focalPoint, camera);
    invalidate();
  });

  useEffect(() => {
    if (active) return;
    const cameraPerspective = camera as THREE.PerspectiveCamera;
    if (cameraPerspective.fov !== 35) {
      cameraPerspective.fov = 35;
      cameraPerspective.updateProjectionMatrix();
    }
  }, [active, camera]);

  return null;
}
