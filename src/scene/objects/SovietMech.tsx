import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useLazyRef } from '../../utils/useLazyRef';
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
import type { WaterVfxPoolState } from './waterVfxPool';
import type { GroundTrailsPoolState } from './groundTrailsPool';
import {
  spawnMuzzleFlash,
  type MuzzleFlashPoolState,
} from './muzzleFlashPool';
import type { MissileRibbonPoolState } from './missileRibbonPool';
import {
  ejectShellCasing,
  type BallisticPropPool,
} from './debrisBallisticsPool';
import {
  type TracerPoolState,
} from './tracerPool';
import {
  processPlayerShots,
  stepCombatSimulation,
  stepCuttingLaser,
  triggerEmergencyRepair,
  triggerHeavyCannonShot,
  triggerJetDash,
  triggerMissileSalvo,
  type ShotResolution,
} from '../../game/combatSimulation';
import type { CombatSimulationState } from '../../game/combatTypes';
import { combatAudio } from '../../game/combatAudio';
import { predictPhysicalShotEndpoint } from '../../game/weaponReticle';

import { resetCombatAim, updateCombatAim, approachTurretWorldYaw } from '../../game/combatAim';
import type { CombatAimState } from '../../game/combatAim';

const _heavyMuzzleL = new THREE.Vector3();
const _heavyMuzzleR = new THREE.Vector3();
const _heavyOrigin = new THREE.Vector3();
const _heavyDir = new THREE.Vector3();
const _heavyQuat = new THREE.Quaternion();
const _aimMuzzle = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _aimQuat = new THREE.Quaternion();

export type { MechDriveInput } from './MechState';
export interface SovietMechProps {
  driveMode: boolean;
  paused: boolean;
  resetNonce: number;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  aimRef: React.MutableRefObject<CombatAimState>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
  waterVfxPoolRef?: React.MutableRefObject<WaterVfxPoolState>;
  groundTrailsPoolRef?: React.MutableRefObject<GroundTrailsPoolState>;
  muzzleFlashPoolRef?: React.MutableRefObject<MuzzleFlashPoolState>;
  missileRibbonPoolRef?: React.MutableRefObject<MissileRibbonPoolState>;
  casingsPoolRef?: React.MutableRefObject<BallisticPropPool>;
  tracerPoolRef?: React.MutableRefObject<TracerPoolState>;
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
  aimRef,
  combatRef,
  waterVfxPoolRef,
  groundTrailsPoolRef,
  muzzleFlashPoolRef,
  missileRibbonPoolRef,
  casingsPoolRef,
  tracerPoolRef,
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
  const simRef = useLazyRef(createMechState);
  const prevResetNonceRef = useRef(resetNonce);
  const wasLocomotingRef = useRef(false);
  const reticleTickRef = useRef(0);

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

  // Reset the rendered pose before the first frame of the new mission.
  useLayoutEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;

    const oldSim = simRef.current;
    oldSim.particles.forEach((p) => {
      p.mesh.parent?.remove(p.mesh);
      if (p.mat !== mats.brassMat) p.mat.dispose();
    });
    combatAudio.stopLocomotion(true);
    wasLocomotingRef.current = false;
    const freshSim = createMechState();
    simRef.current = freshSim;
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < rig.kickupMesh.count; i++) {
      rig.kickupMesh.setMatrixAt(i, zeroMat);
    }
    rig.kickupMesh.instanceMatrix.needsUpdate = true;

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

    invalidate();
  }, [resetNonce, rig, mats, invalidate]);

  // Never let recorded footsteps from the previous movement/session leak into overview.
  useEffect(() => {
    if (!driveMode) {
      combatAudio.stopEngine();
      combatAudio.stopLocomotion(true);
      wasLocomotingRef.current = false;
    }
    return () => {
      combatAudio.stopEngine();
      combatAudio.stopLocomotion(true);
      wasLocomotingRef.current = false;
    };
  }, [driveMode]);

  useEffect(() => {
    if (paused) {
      // Suspension freezes Web Audio time; stop those sources now so resume is quiet.
      combatAudio.stopLocomotion(true);
      wasLocomotingRef.current = false;
    }
  }, [paused]);

  // Battle view starts aligned to chassis; reset after replay or new drive session.
  useEffect(() => {
    if (driveMode) resetCombatAim(aimRef.current, mechPoseRef.current.yaw);
    else { aimRef.current.precise = false; aimRef.current.reticleVisible = false; aimRef.current.muzzleDirectionValid = false; }
  }, [driveMode, resetNonce, aimRef, mechPoseRef]);

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

    if (
      !driveMode &&
      isSoftwareGl &&
      sim.settledFrames >= 2 &&
      sim.particles.length === 0 &&
      sim.kickupPool.activeCount === 0
    ) {
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
        aimRef.current.yaw = sim.yaw;
        aimRef.current.elevation = -0.025;
      }
      updateCombatAim(aimRef.current,
        driveInputRef.current.turretAimDelta ?? 0,
        driveInputRef.current.gunAimDelta ?? 0);
      driveInputRef.current.turretAimDelta = 0;
      driveInputRef.current.gunAimDelta = 0;
      aimRef.current.precise = !!driveInputRef.current.precisionAim;
    } else {
      driveInputRef.current.dash = false;
      driveInputRef.current.centerTurret = false;
      driveInputRef.current.turretAimDelta = 0;
      driveInputRef.current.gunAimDelta = 0;
      aimRef.current.precise = false;
      aimRef.current.reticleVisible = false;
    }

    const control = resolveMechControl(driveInputRef.current, canControl, combat.dashTimer > 0, sim.inWater);
    const locomoting = canControl && control.isMoving;
    if (!locomoting && wasLocomotingRef.current) {
      // Cut active sample tails on the first stationary frame, without killing gunfire.
      combatAudio.stopLocomotion();
    }
    wasLocomotingRef.current = locomoting;
    const activeFire = control.isFiring && !combat.weaponOverheated;

    // Step combat sim first so hitstop freezes movement/physics cleanly while visual timers tick
    const combatStep = canControl
      ? stepCombatSimulation(combat, sim.x, sim.y, sim.z, activeFire, rawDt, sim.inWater)
      : { simDt: driveMode ? 0 : rawDt, justEnded: null };

    if (combatStep.justEnded) {
      if (combatStep.justEnded === 'victory') combatAudio.playVictorySting();
      else combatAudio.playDefeatSting();
      onMissionEnded?.(combatStep.justEnded);
    }

    const dt = combatStep.simDt;
    if (dt > 0) sim.simTime += dt;
    const elapsed = sim.simTime;

    if (canControl) {
      // Q/E are secondary camera-yaw input; turret speed stays physically limited.
      aimRef.current.yaw += control.turTurn * 1.65 * dt;
      sim.turretYaw = approachTurretWorldYaw(
        sim.turretYaw, sim.yaw + control.targetTurnRate * dt, aimRef.current.yaw, dt);
    }

    const motion = stepMechMovement(rig, sim, control, canControl, dt, elapsed,
      canControl ? -aimRef.current.elevation : undefined, canControl);
    const turretWorldYaw = sim.yaw + motion.tYaw;
    const ik = stepMechIK(rig, sim, dt, control, motion);
    // Event-driven foley: no artificial footsteps generated from a wall-clock timer.
    // Actual IK contacts trigger the weight of the mech; liftoffs trigger hydraulics.
    if (locomoting) {
      for (const impact of ik.footImpacts) {
        combatAudio.playMechFootstep(ik.inWater);
      }
      for (const liftoff of ik.footLiftOffs) {
        combatAudio.playHydraulic();
      }
    }
    combatAudio.syncEngine(
      driveMode && canControl && !paused,
      Math.min(1, Math.abs(control.targetSpeed) / 3.45),
    );
    const shots = stepWeaponSystem(rig, dt, activeFire, motion.gPitch);
    // Record the ACTUAL gun direction every frame. Secondary HUD indicator
    // projects this angular direction from the camera, not the hit-point
    // distance: transitions between enemy/cover/range cannot teleport it.
    if (canControl && rig.gunBarrels.length > 0) {
      const muzzle = rig.gunBarrels[0].muzzleAnchor;
      muzzle.getWorldQuaternion(_aimQuat);
      _aimDir.set(0, 0, 1).applyQuaternion(_aimQuat).normalize();
      const viewAim = aimRef.current;
      viewAim.muzzleDirectionX = _aimDir.x;
      viewAim.muzzleDirectionY = _aimDir.y;
      viewAim.muzzleDirectionZ = _aimDir.z;
      viewAim.muzzleDirectionValid = true;
      // Contact classification is still computed from the real muzzle origin.
      // It affects target feedback only, never visual indicator position.
      if (++reticleTickRef.current % 2 === 0) {
        muzzle.getWorldPosition(_aimMuzzle);
        const predicted = predictPhysicalShotEndpoint(combat,
          _aimMuzzle.x, _aimMuzzle.y, _aimMuzzle.z,
          _aimDir.x, _aimDir.y, _aimDir.z);
        viewAim.reticleHit = predicted.hit;
        viewAim.reticleTargetId = predicted.targetId ?? null;
      }
    } else {
      aimRef.current.muzzleDirectionValid = false;
      aimRef.current.reticleVisible = false;
      aimRef.current.reticleHit = 'range';
      aimRef.current.reticleTargetId = null;
    }

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
            true, // do not magnetize heavy cannon shot toward enemies
          );
          if (heavyRes) {
            combatAudio.playHeavyCannonShot();
            sim.springSurgeZ.v -= 1.8;
            if (muzzleFlashPoolRef?.current) {
              spawnMuzzleFlash(muzzleFlashPoolRef.current, {
                x: _heavyOrigin.x,
                y: _heavyOrigin.y,
                z: _heavyOrigin.z,
                dx: _heavyDir.x,
                dy: _heavyDir.y,
                dz: _heavyDir.z,
                scaleXZ: 1.95,
                scaleZ: 2.15,
                duration: 0.095,
                r: 0.42,
                g: 0.90,
                b: 1.0,
                intensity: 1.75,
              });
            }
            if (casingsPoolRef?.current) {
              barrels[0].mesh.getWorldPosition(_heavyMuzzleL);
              ejectShellCasing(casingsPoolRef.current, {
                x: _heavyMuzzleL.x,
                y: _heavyMuzzleL.y + 0.15,
                z: _heavyMuzzleL.z,
                shootDirX: _heavyDir.x,
                shootDirY: _heavyDir.y,
                shootDirZ: _heavyDir.z,
                outwardSide: barrels[0].side === -1 ? 1 : -1,
                caliberScale: 1.65,
              });
            }
          }
        }
      }

      if (driveInputRef.current.missileSalvo) {
        driveInputRef.current.missileSalvo = false;
        const barrels = rig.gunBarrels;
        const podL = rig.missilePodAnchors?.[1] ?? barrels[2]?.muzzleAnchor ?? barrels[0]?.muzzleAnchor;
        const podR = rig.missilePodAnchors?.[0] ?? barrels[0]?.muzzleAnchor;
        if (podL && podR && barrels.length > 0) {
          podL.getWorldPosition(_heavyMuzzleL);
          podR.getWorldPosition(_heavyMuzzleR);
          barrels[0].muzzleAnchor.getWorldQuaternion(_heavyQuat);
          _heavyDir.set(0, 0, 1).applyQuaternion(_heavyQuat).normalize();
          const launched = triggerMissileSalvo(
            combat,
            { x: _heavyMuzzleL.x, y: _heavyMuzzleL.y, z: _heavyMuzzleL.z },
            { x: _heavyMuzzleR.x, y: _heavyMuzzleR.y, z: _heavyMuzzleR.z },
            _heavyDir.x,
            _heavyDir.y,
            _heavyDir.z,
            sim.x,
            sim.y,
            sim.z,
            turretWorldYaw,
          );
          if (launched && launched.length > 0) {
            combatAudio.playMissileSalvo();
            sim.springPelvisPitch.v += 0.16;
            sim.springSurgeZ.v -= 0.65;
            const flashPool = muzzleFlashPoolRef?.current;
            if (flashPool) {
              for (let mi = 0; mi < launched.length; mi++) {
                const m = launched[mi];
                spawnMuzzleFlash(flashPool, {
                  x: m.x,
                  y: m.y,
                  z: m.z,
                  dx: m.vx,
                  dy: m.vy,
                  dz: m.vz,
                  scaleXZ: 0.78,
                  scaleZ: 1.05,
                  duration: 0.08,
                  r: 1.0,
                  g: 0.54,
                  b: 0.14,
                  intensity: 1.45,
                });
              }
            }
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
      driveInputRef.current.missileSalvo = false;
      driveInputRef.current.repair = false;
    }

    let shotResolutions: ShotResolution[] | undefined;
    if (shots.length > 0 && canControl) {
      combatAudio.playAutocannonShot();
      shotResolutions = processPlayerShots(
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
        true, // physical 37-mm aim, no hidden enemy convergence
      );
    }

    if (canControl && rig.gunBarrels.length > 0) {
      const barrels = rig.gunBarrels;
      barrels[0].muzzleAnchor.getWorldPosition(_heavyMuzzleL);
      if (barrels.length > 1) {
        barrels[1].muzzleAnchor.getWorldPosition(_heavyMuzzleR);
        _heavyOrigin.copy(_heavyMuzzleL).add(_heavyMuzzleR).multiplyScalar(0.5);
      } else {
        _heavyOrigin.copy(_heavyMuzzleL);
      }
      barrels[0].muzzleAnchor.getWorldQuaternion(_heavyQuat);
      _heavyDir.set(0, 0, 1).applyQuaternion(_heavyQuat).normalize();
      const activeBeam = stepCuttingLaser(
        combat,
        _heavyOrigin.x,
        _heavyOrigin.y,
        _heavyOrigin.z,
        _heavyDir.x,
        _heavyDir.y,
        _heavyDir.z,
        control.isLaserFiring,
        rawDt,
        ik.inWater,
      );
      if (activeBeam) {
        combatAudio.playLaserPulse(activeBeam.hasImpact);
      }
    } else {
      stepCuttingLaser(combat, 0, 0, 0, 0, 0, 1, false, rawDt, ik.inWater);
    }

    if (canControl) {
      for (let i = 0; i < combat.pendingImpacts.length; i++) {
        const ev = combat.pendingImpacts[i];
        if (ev.kind === 'explosion') combatAudio.playExplosion();
        else if (ev.kind === 'missile-impact') combatAudio.playMissileImpact();
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
      ik.footLiftOffs,
      shots,
      isSoftwareGl,
      shotResolutions,
      waterVfxPoolRef?.current,
      groundTrailsPoolRef?.current,
      muzzleFlashPoolRef?.current,
      casingsPoolRef?.current,
      tracerPoolRef?.current,
    );

    // Publish live pose for the camera and HUD sampling.
    mechPoseRef.current.x = sim.x;
    mechPoseRef.current.y = sim.y;
    mechPoseRef.current.z = sim.z;
    mechPoseRef.current.yaw = sim.yaw;
    mechPoseRef.current.turretYaw = motion.tYaw;
    mechPoseRef.current.aimTurretYaw = sim.turretYaw;
    mechPoseRef.current.speedKmh = worldSpeedToKmh(Math.abs(control.targetSpeed) * sim.gaitBlend);
    mechPoseRef.current.elevationM = Math.round(sim.y * METERS_PER_UNIT);
    mechPoseRef.current.isFiring = activeFire;
    mechPoseRef.current.isBraced = false;
    mechPoseRef.current.isCrouched = control.isCrouched;
    mechPoseRef.current.inWater = ik.inWater;
    mechPoseRef.current.onBridge = motion.surfCenter.onBridge;
    if (rig.legs.length >= 2) {
      mechPoseRef.current.footLX = rig.legs[0].currentAnkleWorld.x;
      mechPoseRef.current.footLZ = rig.legs[0].currentAnkleWorld.z;
      mechPoseRef.current.footRX = rig.legs[1].currentAnkleWorld.x;
      mechPoseRef.current.footRZ = rig.legs[1].currentAnkleWorld.z;
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
