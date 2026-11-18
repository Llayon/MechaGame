import type * as THREE from 'three';
import { MECH_SPAWN, SmoothSpring } from '../../map/mechKinematics';
import { KICKUP_POOL_SIZE, createKickupPool } from './TerrainKickup';

/** Input commands supplied by keyboard, touch, or future AI systems. */
export interface MechDriveInput {
  forward: number;
  turn: number;
  turretTurn: number;
  turretAimDelta?: number;
  gunAimDelta?: number;
  precisionAim?: boolean;
  fire: boolean;
  /** Separate mouse button state; keyboard event sync must never clear held LMB. */
  pointerFire?: boolean;
  heavyFire?: boolean;
  missileSalvo?: boolean;
  repair?: boolean;
  dash?: boolean;
  centerTurret?: boolean;
  sprint: boolean;
  crouch: boolean;
}
export interface ParticleItem {
  type: 'dust' | 'splash' | 'smoke' | 'tracer';
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
    inWater: false,
    yaw: MECH_SPAWN.yaw,
    turretYaw: 0,
    gaitPhase: 0,
    gaitBlend: 0,
    currentOmega: 5.4,
    dieselRevBoost: 0,
    wasMoving: false,
    prevTargetSpeed: 0,
    lastStepParticleTime: [0, 0],
    lastLiftKickupTime: [0, 0],
    lastDriftKickupTime: 0,
    lastWaterWakeTime: -10,
    lastSkidTrailTime: -10,
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
    kickupPool: createKickupPool(KICKUP_POOL_SIZE),
    settledFrames: 0,
  };
}
export type MechState = ReturnType<typeof createMechState>;
