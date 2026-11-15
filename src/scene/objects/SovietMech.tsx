import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import { METERS_PER_UNIT } from '../../map/terrainMath';
import {
  MECH_SCALE,
  MECH_SPAWN,
  sampleMechFootSupport,
  worldSpeedToKmh,
  type MechTelemetrySnapshot,
} from '../../map/mechKinematics';
import { createMechMaterials } from './mechMaterials';
import { buildMechModel } from './MechModel';
import { createMechState, type MechDriveInput } from './MechState';
import { resolveMechControl } from './MechController';
import { stepMechMovement } from './MechMovementSystem';
import { stepMechIK } from './MechIKSystem';
import { stepWeaponSystem } from './WeaponSystem';
import { stepMechEffects } from './MechEffects';
import {
  buildCombatTelemetry,
  findAimAssistTarget,
  processPlayerShots,
  stepCombatSimulation,
  triggerEmergencyRepair,
  triggerHeavyCannonShot,
  triggerJetDash,
} from '../../game/combatSimulation';
import type { CombatSimulationState, CombatTelemetrySnapshot } from '../../game/combatTypes';
import { combatAudio } from '../../game/combatAudio';

const _heavyMuzzleL = new THREE.Vector3();
const _heavyMuzzleR = new THREE.Vector3();
const _heavyOrigin = new THREE.Vector3();
const _heavyDir = new THREE.Vector3();
const _heavyQuat = new THREE.Quaternion();

export type { MechDriveInput } from './MechState';
export interface SovietMechProps {
  driveMode: boolean;
  paused: boolean;
  resetNonce: number;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
  combatTelemetryRef: React.MutableRefObject<CombatTelemetrySnapshot>;
  onSelectMech?: () => void;
  onMissionEnded?: (outcome: 'victory' | 'defeat') => void;
}

/** React Three Fiber adapter: lifecycle, system ordering, combat loop, and lightweight telemetry. */
export function SovietMech({
  driveMode,
  paused,
  resetNonce,
  lightingPreset,
  isSoftwareGl,
  mechPoseRef,
  driveInputRef,
  combatRef,
  combatTelemetryRef,
  onSelectMech,
  onMissionEnded,
}: SovietMechProps) {
  const { gl, invalidate } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const containerRef = useRef<THREE.Group>(null);
  const worldFxRef = useRef<THREE.Group>(null);

  const mats = useMemo(() => createMechMaterials(maxAniso), [maxAniso]);

  useEffect(() => {
    return () => {
      mats.dispose();
    };
  }, [mats]);

  // Adjust emissive intensities to match Sector 7 Day/Dusk/Night lighting
  useEffect(() => {
    const isNight = lightingPreset === 'night';
    const isDusk = lightingPreset === 'dusk';
    mats.opticLensMat.emissiveIntensity = isNight ? 1.85 : isDusk ? 1.05 : 0.45;
    mats.redSensorGlintMat.emissiveIntensity = isNight ? 2.2 : isDusk ? 1.7 : 1.25;
    mats.amberLampMat.emissiveIntensity = isNight ? 1.85 : isDusk ? 1.3 : 0.85;
    mats.redBeaconMat.emissiveIntensity = isNight ? 1.85 : isDusk ? 1.2 : 0.75;
    invalidate();
  }, [lightingPreset, mats, invalidate]);

  const rig = useMemo(() => buildMechModel(mats), [mats]);
  const simRef = useRef(createMechState());
  const prevResetNonceRef = useRef(resetNonce);

  // Dispose geometries & leftover particles on unmount
  useEffect(() => {
    return () => {
      const sim = simRef.current;
      sim.particles.forEach((p) => {
        p.mesh.parent?.remove(p.mesh);
        if (p.mat !== mats.brassMat) p.mat.dispose();
      });
      sim.particles = [];
      rig.dispose();
    };
  }, [rig, mats]);

  // Reset Mech pose, particles & feet cleanly when mission restarts
  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;

    const oldSim = simRef.current;
    oldSim.particles.forEach((p) => {
      p.mesh.parent?.remove(p.mesh);
      if (p.mat !== mats.brassMat) p.mat.dispose();
    });
    const freshSim = createMechState();
    simRef.current = freshSim;

    rig.root.position.set(MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z);
    rig.root.rotation.set(0, MECH_SPAWN.yaw, 0);
    rig.turretPivot.rotation.set(0, 0, 0);
    const sinY = Math.sin(MECH_SPAWN.yaw);
    const cosY = Math.cos(MECH_SPAWN.yaw);
    rig.legs.forEach((leg) => {
      const hipLocalX = leg.side * 1.32 * MECH_SCALE;
      const wx = MECH_SPAWN.x + hipLocalX * cosY;
      const wz = MECH_SPAWN.z - hipLocalX * sinY;
      const sup = sampleMechFootSupport(wx, wz, MECH_SPAWN.yaw, MECH_SCALE, MECH_SPAWN.y);
      leg.plantedWorld.set(wx, sup.ankleY, wz);
      leg.stepStartWorld.copy(leg.plantedWorld);
      leg.stepEndWorld.copy(leg.plantedWorld);
      leg.currentAnkleWorld.copy(leg.plantedWorld);
      leg.wasSwing = false;
    });

    mechPoseRef.current.x = MECH_SPAWN.x;
    mechPoseRef.current.y = MECH_SPAWN.y;
    mechPoseRef.current.z = MECH_SPAWN.z;
    mechPoseRef.current.yaw = MECH_SPAWN.yaw;
    mechPoseRef.current.turretYaw = 0;
    mechPoseRef.current.speedKmh = 0;
    mechPoseRef.current.elevationM = Math.round(MECH_SPAWN.y * METERS_PER_UNIT);
    mechPoseRef.current.isFiring = false;
    mechPoseRef.current.isCrouched = false;
    mechPoseRef.current.inWater = false;
    mechPoseRef.current.onBridge = false;

    combatTelemetryRef.current = buildCombatTelemetry(
      combatRef.current,
      MECH_SPAWN.x,
      MECH_SPAWN.y,
      MECH_SPAWN.z,
      MECH_SPAWN.yaw,
    );
    invalidate();
  }, [resetNonce, rig, mats, mechPoseRef, combatRef, combatTelemetryRef, invalidate]);

  // Reset initial pose cleanly on mount
  useEffect(() => {
    const sim = simRef.current;
    sim.settledFrames = 0;
    invalidate();
  }, [invalidate]);

  useFrame((_, delta) => {
    const rawDt = Math.min(delta, 0.05);
    const sim = simRef.current;
    const fxParent = worldFxRef.current;
    const combat = combatRef.current;

    if (!driveMode && isSoftwareGl && sim.settledFrames >= 2 && sim.particles.length === 0) {
      return;
    }

    if (paused) return;

    sim.settledFrames += 1;

    const canControl = driveMode && combat.missionStatus === 'playing' && combat.playerHp > 0;
    if (canControl) {
      if (driveInputRef.current.dash) {
        driveInputRef.current.dash = false;
        if (triggerJetDash(combat, sim.x, sim.y, sim.z)) {
          combatAudio.playDashBoost();
          sim.springSurgeZ.v += 2.2;
        }
      }
      if (driveInputRef.current.centerTurret) {
        driveInputRef.current.centerTurret = false;
        sim.turretYaw = 0;
      }
      if (driveInputRef.current.turretAimDelta) {
        sim.turretYaw += driveInputRef.current.turretAimDelta;
        driveInputRef.current.turretAimDelta = 0;
      }
    } else {
      driveInputRef.current.dash = false;
      driveInputRef.current.centerTurret = false;
      driveInputRef.current.turretAimDelta = 0;
    }

    const control = resolveMechControl(driveInputRef.current, canControl, combat.dashTimer > 0);
    const activeFire = control.isFiring && !combat.weaponOverheated;

    // Step combat sim first so hitstop freezes movement/physics cleanly while visual timers tick
    const combatStep = canControl
      ? stepCombatSimulation(combat, sim.x, sim.y, sim.z, activeFire, rawDt)
      : { simDt: driveMode ? 0 : rawDt, justEnded: null };

    if (combatStep.justEnded) {
      if (combatStep.justEnded === 'victory') combatAudio.playVictorySting();
      else combatAudio.playDefeatSting();
      onMissionEnded?.(combatStep.justEnded);
    }

    const dt = combatStep.simDt;
    if (dt > 0) {
      sim.simTime += dt;
    }
    const elapsed = sim.simTime;

    const turretWorldYaw = sim.yaw + sim.turretYaw;
    const aimAssist = canControl
      ? findAimAssistTarget(combat, sim.x, sim.y, sim.z, turretWorldYaw)
      : null;
    const desiredPitch = aimAssist?.enemy
      ? aimAssist.gunPitch
      : activeFire
        ? 0.012
        : undefined;

    const motion = stepMechMovement(rig, sim, control, canControl, dt, elapsed, desiredPitch);
    const ik = stepMechIK(rig, sim, dt, control, motion);
    const shots = stepWeaponSystem(rig, dt, activeFire, motion.gPitch);

    // Consume edge-triggered Heavy Cannon (KeyF) and Emergency Repair (KeyV)
    if (canControl) {
      if (driveInputRef.current.heavyFire) {
        driveInputRef.current.heavyFire = false;
        const barrels = rig.gunBarrels;
        if (barrels.length > 0) {
          barrels[0].muzzleAnchor.getWorldPosition(_heavyMuzzleL);
          if (barrels.length > 1) {
            barrels[1].muzzleAnchor.getWorldPosition(_heavyMuzzleR);
            _heavyOrigin.copy(_heavyMuzzleL).add(_heavyMuzzleR).multiplyScalar(0.5);
          } else {
            _heavyOrigin.copy(_heavyMuzzleL);
          }
          barrels[0].muzzleAnchor.getWorldQuaternion(_heavyQuat);
          _heavyDir.set(0, 0, 1).applyQuaternion(_heavyQuat).normalize();
          const heavyRes = triggerHeavyCannonShot(
            combat,
            _heavyOrigin.x,
            _heavyOrigin.y,
            _heavyOrigin.z,
            _heavyDir.x,
            _heavyDir.y,
            _heavyDir.z,
            sim.x,
            sim.y,
            sim.z,
            turretWorldYaw,
          );
          if (heavyRes) {
            combatAudio.playHeavyCannonShot();
            sim.springSurgeZ.v -= 1.8;
          }
        }
      }

      if (driveInputRef.current.repair) {
        driveInputRef.current.repair = false;
        if (triggerEmergencyRepair(combat, sim.x, sim.y, sim.z)) {
          combatAudio.playRepair();
        }
      }
    } else {
      driveInputRef.current.heavyFire = false;
      driveInputRef.current.repair = false;
    }

    let shotDistances: number[] | undefined;
    if (shots.length > 0 && canControl) {
      combatAudio.playAutocannonShot();
      const resolutions = processPlayerShots(
        combat,
        shots.map((s) => ({
          muzzleX: s.muzzlePosition.x,
          muzzleY: s.muzzlePosition.y,
          muzzleZ: s.muzzlePosition.z,
          dirX: s.direction.x,
          dirY: s.direction.y,
          dirZ: s.direction.z,
        })),
        sim.x,
        sim.y,
        sim.z,
        turretWorldYaw,
      );
      shotDistances = resolutions.map((r) => r.distance);
    }

    if (canControl) {
      for (let i = 0; i < combat.pendingImpacts.length; i++) {
        const ev = combat.pendingImpacts[i];
        if (ev.kind === 'explosion') combatAudio.playExplosion();
        else if (ev.kind === 'barrel-explosion') combatAudio.playBarrelExplosion();
        else if (ev.kind === 'heavy-hit') combatAudio.playArmorHit(true);
        else if (ev.kind === 'armor-hit') combatAudio.playArmorHit(false);
        else if (ev.kind === 'player-hit') combatAudio.playPlayerHit();
        else if (ev.kind === 'pickup') combatAudio.playPickup();
        else if (ev.kind === 'telegraph' && ev.heavy) {
          if (ev.y > sim.y + 3) combatAudio.playAlertSiren();
          else combatAudio.playLockWarning();
        }
      }
    }

    stepMechEffects(
      rig,
      sim,
      fxParent,
      mats,
      rawDt,
      elapsed,
      driveMode,
      control,
      motion,
      ik.footImpacts,
      shots,
      isSoftwareGl,
      shotDistances,
    );

    // Publish lightweight telemetry snapshot for camera rig, minimap & combat HUD
    mechPoseRef.current.x = sim.x;
    mechPoseRef.current.y = sim.y;
    mechPoseRef.current.z = sim.z;
    mechPoseRef.current.yaw = sim.yaw;
    mechPoseRef.current.turretYaw = motion.tYaw;
    mechPoseRef.current.speedKmh = worldSpeedToKmh(Math.abs(control.targetSpeed) * sim.gaitBlend);
    mechPoseRef.current.elevationM = Math.round(sim.y * METERS_PER_UNIT);
    mechPoseRef.current.isFiring = activeFire;
    mechPoseRef.current.isBraced = false;
    mechPoseRef.current.isCrouched = control.isCrouched;
    mechPoseRef.current.inWater = ik.inWater;
    mechPoseRef.current.onBridge = motion.surfCenter.onBridge;

    if (driveMode) {
      combatTelemetryRef.current = buildCombatTelemetry(
        combat,
        sim.x,
        sim.y,
        sim.z,
        sim.yaw + sim.turretYaw,
      );
    }
  });

  return (
    <group
      ref={containerRef}
      onClick={(e) => {
        if (!driveMode && onSelectMech) {
          e.stopPropagation();
          onSelectMech();
        }
      }}
    >
      <primitive object={rig.root} />
      <primitive object={rig.worldFeetGroup} />
      <group ref={worldFxRef} />
    </group>
  );
}
