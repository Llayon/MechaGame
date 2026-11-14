import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import { METERS_PER_UNIT } from '../../map/terrainMath';
import type { MechTelemetrySnapshot } from '../../map/mechKinematics';
import { createMechMaterials } from './mechMaterials';
import { buildMechModel } from './MechModel';
import { createMechState, type MechDriveInput } from './MechState';
import { resolveMechControl } from './MechController';
import { stepMechMovement } from './MechMovementSystem';
import { stepMechIK } from './MechIKSystem';
import { stepWeaponSystem } from './WeaponSystem';
import { stepMechEffects } from './MechEffects';

export type { MechDriveInput } from './MechState';
export interface SovietMechProps {
  driveMode: boolean;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  onSelectMech?: () => void;
}

/** React Three Fiber adapter: lifecycle, system ordering and lightweight telemetry. */
export function SovietMech({
  driveMode, lightingPreset, isSoftwareGl, mechPoseRef, driveInputRef, onSelectMech,
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
  // Dispose geometries & leftover particles on unmount
  useEffect(() => {
    const sim = simRef.current;
    return () => {
      sim.particles.forEach((p) => {
        p.mesh.parent?.remove(p.mesh);
        if (p.mat !== mats.brassMat) p.mat.dispose();
      });
      sim.particles = [];
      rig.dispose();
    };
  }, [rig, mats]);

  // Reset initial pose cleanly on mount
  useEffect(() => {
    const sim = simRef.current;
    sim.settledFrames = 0;
    invalidate();
  }, [invalidate]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);
    const sim = simRef.current;
    const fxParent = worldFxRef.current;
    if (!driveMode && isSoftwareGl && sim.settledFrames >= 2 && sim.particles.length === 0) return;
    sim.settledFrames += 1;
    sim.simTime += dt;
    const elapsed = sim.simTime;
    const control = resolveMechControl(driveInputRef.current, driveMode);
    const motion = stepMechMovement(rig, sim, control, driveMode, dt, elapsed);
    const ik = stepMechIK(rig, sim, dt, control, motion);
    const shots = stepWeaponSystem(rig, dt, control.isFiring, motion.gPitch);
    stepMechEffects(rig, sim, fxParent, mats, dt, elapsed, driveMode, control, motion, ik.footImpacts, shots, isSoftwareGl);
    const { targetSpeed, isFiring, isCrouched } = control;
    const { tYaw, surfCenter } = motion;
    // Publish lightweight telemetry snapshot for camera rig & minimap HUD
    mechPoseRef.current.x = sim.x;
    mechPoseRef.current.y = sim.y;
    mechPoseRef.current.z = sim.z;
    mechPoseRef.current.yaw = sim.yaw;
    mechPoseRef.current.turretYaw = tYaw;
    mechPoseRef.current.speedKmh = Math.abs(targetSpeed) * sim.gaitBlend * METERS_PER_UNIT;
    mechPoseRef.current.elevationM = Math.round(sim.y * METERS_PER_UNIT);
    mechPoseRef.current.isFiring = isFiring;
    mechPoseRef.current.isBraced = false;
    mechPoseRef.current.isCrouched = isCrouched;
    mechPoseRef.current.inWater = ik.inWater;
    mechPoseRef.current.onBridge = surfCenter.onBridge;
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
