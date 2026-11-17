import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import {
  computeFlybyShadowProjection,
  createDropshipFlybyState,
  createDropshipHullGeometry,
  createDropshipThrusterGeometry,
  stepDropshipFlyby,
} from '../../map/dropshipFlyby';
import { FLYBY_SHADOW_UNIFORMS } from '../flybyShadow';
import type { MechTelemetrySnapshot } from '../../map/mechKinematics';
import type { CombatSimulationState } from '../../game/combatTypes';
import { combatAudio } from '../../game/combatAudio';

export interface DropshipFlybyProps {
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  visible: boolean;
  driveMode: boolean;
  isSoftwareGl: boolean;
  mechPoseRef: MutableRefObject<MechTelemetrySnapshot>;
  combatRef: MutableRefObject<CombatSimulationState>;
}

/**
 * Periodically flies a low-poly heavy armored dropship high across Sector 7 (2 Draw Calls:
 * merged fuselage + additive plasma thrusters) while synchronizing the shared analytical
 * solar SDF shadow across terrain, concrete structures, and river water.
 */
export function DropshipFlyby({
  lightingPreset,
  sunPos,
  visible,
  driveMode,
  isSoftwareGl,
  mechPoseRef,
  combatRef,
}: DropshipFlybyProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const thrusterMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const stateRef = useRef(createDropshipFlybyState());

  const { hullGeom, hullMat, thrusterGeom, thrusterMat } = useMemo(() => {
    const hGeom = createDropshipHullGeometry();
    const hMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.42,
      flatShading: true,
      fog: true,
    });

    const tGeom = createDropshipThrusterGeometry();
    const tMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    return { hullGeom: hGeom, hullMat: hMat, thrusterGeom: tGeom, thrusterMat: tMat };
  }, []);

  useEffect(() => {
    thrusterMatRef.current = thrusterMat;
    return () => {
      hullGeom.dispose();
      hullMat.dispose();
      thrusterGeom.dispose();
      thrusterMat.dispose();
    };
  }, [hullGeom, hullMat, thrusterGeom, thrusterMat]);

  // Sync initial seeded frame & clear shadow cleanly when disabled or unmounted
  useEffect(() => {
    const s = stateRef.current;
    if (!visible || !s.active) {
      FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = 0;
      if (shipGroupRef.current) shipGroupRef.current.visible = false;
      return;
    }

    if (shipGroupRef.current) {
      shipGroupRef.current.visible = true;
      shipGroupRef.current.position.set(s.x, s.y, s.z);
      shipGroupRef.current.rotation.set(0, s.yaw, 0);
    }

    const proj = computeFlybyShadowProjection(
      s.x,
      s.y,
      s.z,
      sunPos,
      lightingPreset,
    );
    FLYBY_SHADOW_UNIFORMS.uFlybyShipPos.value.set(proj.shadowX, proj.shadowZ);
    FLYBY_SHADOW_UNIFORMS.uFlybyShipYaw.value = s.yaw;
    FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = proj.strength;
  }, [visible, sunPos, lightingPreset]);

  useEffect(() => {
    return () => {
      FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = 0;
    };
  }, []);

  const { paused, clockRef } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    const grp = shipGroupRef.current;
    if (!grp) return;

    if (!visible) {
      grp.visible = false;
      FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = 0;
      return;
    }

    const s = stateRef.current;
    if (!isSoftwareGl) {
      const focusX = driveMode ? mechPoseRef.current.x : 0;
      const focusZ = driveMode ? mechPoseRef.current.z : 0;
      const res = stepDropshipFlyby(s, Math.min(delta, 0.05), Math.random, focusX, focusZ);

      if (s.active && driveMode && res.overheadDistSq < 92 * 92) {
        if (!s.rumblePlayedForPass) {
          s.rumblePlayedForPass = true;
          combatAudio.playDropshipFlyby();
        }
        // Subtle sub-frame micro-rumble while heavy hull passes directly overhead
        if (combatRef.current.trauma < 0.05) {
          combatRef.current.trauma = Math.min(0.05, combatRef.current.trauma + delta * 0.14);
        }
      }
    }

    if (!s.active) {
      grp.visible = false;
      FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = 0;
      return;
    }

    grp.visible = true;
    const bob = Math.sin(clockRef.current.elapsed * 1.4) * 0.45;
    grp.position.set(s.x, s.y + bob, s.z);
    grp.rotation.set(0.03, s.yaw, Math.sin(clockRef.current.elapsed * 0.9) * 0.045);

    if (thrusterMatRef.current) {
      thrusterMatRef.current.opacity =
        0.78 + 0.16 * Math.sin(clockRef.current.elapsed * 18.0);
    }

    const proj = computeFlybyShadowProjection(
      s.x,
      s.y,
      s.z,
      sunPos,
      lightingPreset,
    );
    FLYBY_SHADOW_UNIFORMS.uFlybyShipPos.value.set(proj.shadowX, proj.shadowZ);
    FLYBY_SHADOW_UNIFORMS.uFlybyShipYaw.value = s.yaw;
    FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength.value = proj.strength;
  });

  if (!visible) return null;

  return (
    <group ref={shipGroupRef} visible={false}>
      <mesh geometry={hullGeom} material={hullMat} castShadow={false} receiveShadow={false} />
      <mesh geometry={thrusterGeom} material={thrusterMat} castShadow={false} receiveShadow={false} />
    </group>
  );
}
