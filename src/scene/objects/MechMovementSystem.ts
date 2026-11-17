import * as THREE from 'three';
import { clampMechPosition, getWalkableSurfaceY } from '../../map/mechKinematics';
import type { MechRig } from './MechModel';
import type { MechState } from './MechState';
import type { MechControl } from './MechController';

/** Terrain-constrained movement, gait phase and hull/turret springs. */
export function stepMechMovement(
  rig: MechRig, sim: MechState, control: MechControl,
  driveMode: boolean, dt: number, elapsed: number,
  desiredGunPitch?: number,
  manualAiming = false,
) {
  const { fwd, turTurn, isFiring, isMoving, targetSpeed, targetTurnRate,
    targetOmega, crouchOffset } = control;
    if (isMoving && !sim.wasMoving) {
      sim.dieselRevBoost = 1.0;
    }
    sim.wasMoving = isMoving;
    sim.dieselRevBoost = Math.max(0, sim.dieselRevBoost - dt * 0.85);

    const dieselFreq = 330 + sim.dieselRevBoost * 95 + (isFiring ? 35 : 0);
    const dieselVib =
      Math.sin(elapsed * dieselFreq) *
      (0.0014 + sim.dieselRevBoost * 0.0024 + (isMoving ? 0.001 : 0));
    const dieselVibAlt =
      Math.cos(elapsed * (dieselFreq * 1.07)) *
      (0.0012 + sim.dieselRevBoost * 0.002 + (isMoving ? 0.0008 : 0));

    sim.gaitBlend = THREE.MathUtils.lerp(sim.gaitBlend, isMoving ? 1.0 : 0.0, dt * 6.0);
    sim.currentOmega = THREE.MathUtils.lerp(sim.currentOmega, targetOmega, dt * 5.0);
    sim.gaitPhase += sim.currentOmega * dt * (0.25 + 0.75 * sim.gaitBlend);

    // Integrate Mech world coordinates + arena/cliff boundary clamping
    const prevX = sim.x;
    const prevZ = sim.z;
    sim.yaw += targetTurnRate * dt;
    const rawNextX = sim.x + Math.sin(sim.yaw) * targetSpeed * dt;
    const rawNextZ = sim.z + Math.cos(sim.yaw) * targetSpeed * dt;
    const clampedPos = clampMechPosition(rawNextX, rawNextZ, prevX, prevZ, sim.y);
    sim.x = clampedPos.x;
    sim.z = clampedPos.z;

    if (driveMode) {
      if (!manualAiming) sim.turretYaw += turTurn * 1.65 * dt;
    } else {
      // Gentle perimeter scan while parked on standby
      sim.turretYaw = Math.sin(elapsed * 0.42) * 0.32;
    }

    const surfCenter = getWalkableSurfaceY(sim.x, sim.z, sim.y);
    sim.y = surfCenter.y;
    sim.inWater = surfCenter.inWater;

    const rawSwayX = Math.sin(sim.gaitPhase) * 0.14 * sim.gaitBlend;
    const rawBounceY =
      -Math.abs(Math.sin(sim.gaitPhase)) * 0.12 * sim.gaitBlend +
      Math.sin(elapsed * 2.1) * 0.016 * (1 - sim.gaitBlend);
    const rawSurgeZ = Math.cos(sim.gaitPhase * 2) * 0.05 * sim.gaitBlend;
    const rawRoll = -Math.sin(sim.gaitPhase) * 0.042 * sim.gaitBlend;
    const rawPitch =
      (isMoving ? 0.045 * Math.sign(fwd || 1) * sim.gaitBlend : 0) +
      (isFiring ? -0.045 : 0);

    const targetTurretYaw =
      sim.turretYaw -
      (isMoving ? Math.sin(sim.gaitPhase) * 0.045 * sim.gaitBlend : 0);
    const targetGunPitch =
      desiredGunPitch !== undefined
        ? desiredGunPitch
        : isFiring
          ? 0.012
          : -0.02 + Math.cos(sim.gaitPhase * 2) * 0.02 * sim.gaitBlend;

    const swayX = sim.springSwayX.update(rawSwayX, dt);
    const bounceY = sim.springBounceY.update(rawBounceY, dt);
    const surgeZ = sim.springSurgeZ.update(rawSurgeZ, dt);
    const pRoll = sim.springPelvisRoll.update(rawRoll, dt);
    const pPitch = sim.springPelvisPitch.update(rawPitch, dt);
    const tYaw = sim.springTurretYaw.update(targetTurretYaw, dt);
    const gPitch = sim.springGunPitch.update(targetGunPitch, dt);

    rig.root.position.set(sim.x, sim.y, sim.z);
    rig.root.rotation.set(0, sim.yaw, 0);
    rig.pelvisGroup.position.set(swayX, 2.48 + crouchOffset + bounceY, surgeZ);
    rig.pelvisGroup.rotation.set(pPitch, 0, pRoll);
    rig.turretPivot.rotation.set(0, tYaw, 0);
    rig.root.updateMatrixWorld(true);

    const sinY = Math.sin(sim.yaw);
    const cosY = Math.cos(sim.yaw);
  return { surfCenter, sinY, cosY, bounceY, tYaw, gPitch, dieselVib, dieselVibAlt };
}
export type MechMotion = ReturnType<typeof stepMechMovement>;
