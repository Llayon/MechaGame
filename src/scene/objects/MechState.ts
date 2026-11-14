import type * as THREE from 'three';
import { MECH_SPAWN, SmoothSpring } from '../../map/mechKinematics';

/** Input commands supplied by keyboard, touch, or future AI systems. */
export interface MechDriveInput {
  forward: number;
  turn: number;
  turretTurn: number;
  fire: boolean;
  sprint: boolean;
  crouch: boolean;
}
export interface ParticleItem {
  type: 'dust' | 'splash' | 'smoke' | 'shell' | 'tracer';
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  initialOpacity: number;
}

/** Mutable world simulation state with no React dependency. */
export function createMechState() {
  return {
    simTime: 0,
    x: MECH_SPAWN.x,
    z: MECH_SPAWN.z,
    y: MECH_SPAWN.y,
    yaw: MECH_SPAWN.yaw,
    turretYaw: 0,
    gaitPhase: 0,
    gaitBlend: 0,
    currentOmega: 5.4,
    dieselRevBoost: 0,
    wasMoving: false,
    lastStepParticleTime: [0, 0],
    springSwayX: new SmoothSpring(0, 6.2),
    springBounceY: new SmoothSpring(0, 8.5),
    springSurgeZ: new SmoothSpring(0, 6.5),
    springPelvisRoll: new SmoothSpring(0, 6.0),
    springPelvisPitch: new SmoothSpring(0, 6.5),
    springTurretYaw: new SmoothSpring(0, 5.8),
    springGunPitch: new SmoothSpring(0, 6.5),
    springAntennaX: new SmoothSpring(0, 7.5),
    springAntennaZ: new SmoothSpring(0, 7.5),
    particles: [] as ParticleItem[],
    settledFrames: 0,
  };
}
export type MechState = ReturnType<typeof createMechState>;
