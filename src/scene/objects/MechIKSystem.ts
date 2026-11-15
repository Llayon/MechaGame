import * as THREE from 'three';
import {
  MECH_PELVIS_BASE_Y, MECH_SCALE,
  sampleMechFootSupport, solveReverseJointIKAngles,
} from '../../map/mechKinematics';
import type { MechRig } from './MechModel';
import type { MechState } from './MechState';
import type { MechControl } from './MechController';
import type { MechMotion } from './MechMovementSystem';

const _tmpLocalTarget = new THREE.Vector3();
const _tmpPA = new THREE.Vector3();
const _tmpPB = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _tmpUp = new THREE.Vector3(0, 1, 0);
const _tmpQuat = new THREE.Quaternion();

export interface MechFootImpact { index: number; position: THREE.Vector3 }

/** Grounded/swinging feet, three-joint IK, toe articulation and hydraulic rods. */
export function stepMechIK(
  rig: MechRig, sim: MechState, dt: number,
  control: MechControl, motion: MechMotion,
) {
  const { fwd, stepLength, stepClearance, crouchOffset } = control;
  const { sinY, cosY, bounceY, surfCenter } = motion;
    let lowestFootAnkleY = Infinity;
    let anyInWater = surfCenter.inWater;
  const footImpacts: MechFootImpact[] = [];

    rig.legs.forEach((leg, idx) => {
      const phase = sim.gaitPhase + idx * Math.PI;
      const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const isSwing = cycle < Math.PI && sim.gaitBlend > 0.08;

      const hipLocalX = leg.side * 1.32 * MECH_SCALE;
      const hipWorldX = sim.x + hipLocalX * cosY;
      const hipWorldZ = sim.z - hipLocalX * sinY;

      if (isSwing) {
        const s = cycle / Math.PI;
        const ease = s * s * (3 - 2 * s);
        if (!leg.wasSwing) {
          leg.stepStartWorld.copy(leg.plantedWorld);
          leg.wasSwing = true;
        }
        const leadZ = stepLength * 0.52 * sim.gaitBlend;
        const targetWX = hipWorldX + sinY * leadZ;
        const targetWZ = hipWorldZ + cosY * leadZ;
        const support = sampleMechFootSupport(targetWX, targetWZ, sim.yaw, MECH_SCALE, sim.y);
        leg.stepEndWorld.set(targetWX, support.ankleY, targetWZ);

        const wx = THREE.MathUtils.lerp(leg.stepStartWorld.x, leg.stepEndWorld.x, ease);
        const wz = THREE.MathUtils.lerp(leg.stepStartWorld.z, leg.stepEndWorld.z, ease);
        const baseH = THREE.MathUtils.lerp(leg.stepStartWorld.y, leg.stepEndWorld.y, ease);
        const lift = Math.sin(s * Math.PI) * stepClearance * MECH_SCALE * sim.gaitBlend;

        const midSupport = sampleMechFootSupport(wx, wz, sim.yaw, MECH_SCALE, sim.y);
        const wy = Math.max(baseH + lift, midSupport.ankleY + lift * 0.45);
        if (midSupport.inWater) anyInWater = true;

        leg.currentAnkleWorld.set(wx, wy, wz);
        leg.footPitch = THREE.MathUtils.lerp(
          leg.footPitch,
          Math.sin(s * Math.PI * 2) * 0.22 * Math.sign(fwd || 1),
          dt * 12,
        );
        leg.footRoll = THREE.MathUtils.lerp(
          leg.footRoll,
          midSupport.roll * (1 - Math.sin(s * Math.PI)),
          dt * 10,
        );
      } else {
        if (leg.wasSwing) {
          leg.wasSwing = false;
          leg.plantedWorld.copy(leg.stepEndWorld);
          sim.springBounceY.v -= 1.45 * sim.gaitBlend;
          sim.springPelvisRoll.v += leg.side * 0.48 * sim.gaitBlend;
          sim.springPelvisPitch.v += 0.28 * sim.gaitBlend;

          footImpacts.push({ index: idx, position: leg.plantedWorld.clone() });
        }

        if (sim.gaitBlend < 0.08) {
          const baseForeAft = (idx === 1 ? 0.18 : -0.18) * MECH_SCALE;
          const restWX = hipWorldX + sinY * baseForeAft;
          const restWZ = hipWorldZ + cosY * baseForeAft;
          leg.plantedWorld.x = THREE.MathUtils.lerp(leg.plantedWorld.x, restWX, dt * 10);
          leg.plantedWorld.z = THREE.MathUtils.lerp(leg.plantedWorld.z, restWZ, dt * 10);
        }

        // Guard against drift if turning sharply on spot
        const dFromHip = Math.hypot(
          leg.plantedWorld.x - hipWorldX,
          leg.plantedWorld.z - hipWorldZ,
        );
        if (dFromHip > 1.75 * MECH_SCALE) {
          leg.plantedWorld.x = THREE.MathUtils.lerp(leg.plantedWorld.x, hipWorldX, dt * 8);
          leg.plantedWorld.z = THREE.MathUtils.lerp(leg.plantedWorld.z, hipWorldZ, dt * 8);
        }

        const support = sampleMechFootSupport(
          leg.plantedWorld.x,
          leg.plantedWorld.z,
          sim.yaw,
          MECH_SCALE,
          sim.y,
        );
        if (support.inWater) anyInWater = true;
        leg.plantedWorld.y = support.ankleY;
        leg.currentAnkleWorld.copy(leg.plantedWorld);
        leg.footPitch = THREE.MathUtils.lerp(leg.footPitch, support.pitch, dt * 14);
        leg.footRoll = THREE.MathUtils.lerp(leg.footRoll, support.roll, dt * 14);
      }

      if (leg.currentAnkleWorld.y < lowestFootAnkleY) {
        lowestFootAnkleY = leg.currentAnkleWorld.y;
      }
    });

    // Anchor pelvis cleanly above lowest grounded foot
    const targetPelvisWorldY =
      lowestFootAnkleY + (MECH_PELVIS_BASE_Y + crouchOffset + bounceY) * MECH_SCALE;
    rig.pelvisGroup.position.y = (targetPelvisWorldY - sim.y) / MECH_SCALE;
    rig.root.updateMatrixWorld(true);

    // Solve 3-joint reverse IK and sync hydraulic cylinders + toes
    rig.legs.forEach((leg, idx) => {
      leg.hipAnchor.updateMatrixWorld(true);
      _tmpLocalTarget.copy(leg.currentAnkleWorld);
      leg.hipAnchor.worldToLocal(_tmpLocalTarget);

      const ik = solveReverseJointIKAngles(
        _tmpLocalTarget.x,
        _tmpLocalTarget.y,
        _tmpLocalTarget.z,
      );
      leg.hipJoint.rotation.z = ik.hipRollZ;
      leg.hipJoint.rotation.x = ik.hipRotX;
      leg.kneeJoint.rotation.x = ik.kneeBend;
      leg.hockJoint.rotation.x = -ik.hockBend;
      leg.hipJoint.updateMatrixWorld(true);

      leg.ankleAnchor.getWorldPosition(leg.currentAnkleWorld);
      leg.footGroup.position.copy(leg.currentAnkleWorld);
      leg.footGroup.rotation.set(leg.footPitch, sim.yaw, leg.footRoll);

      const phase = sim.gaitPhase + idx * Math.PI;
      const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const load = cycle >= Math.PI || sim.gaitBlend < 0.1 ? 1.0 : 0.0;

      leg.frontToes.forEach((toe, tIdx) => {
        const splay = (tIdx === 0 ? -1 : 1) * (0.05 * load);
        const digPitch = load > 0.5 ? 0.02 : 0.14;
        toe.rotation.y = THREE.MathUtils.lerp(toe.rotation.y, splay, dt * 12);
        toe.rotation.x = THREE.MathUtils.lerp(toe.rotation.x, digPitch, dt * 12);
      });
      leg.heelPivot.rotation.x = THREE.MathUtils.lerp(
        leg.heelPivot.rotation.x,
        load > 0.5 ? -0.02 : -0.16,
        dt * 12,
      );

      leg.hipBoot.scale.y = 1.0 + leg.hipJoint.rotation.x * 0.18;
      leg.ankleBoot.scale.y = 1.0 - leg.footPitch * 0.25;

      leg.pistons.forEach((p) => {
        p.a.getWorldPosition(_tmpPA);
        p.b.getWorldPosition(_tmpPB);
        const len = _tmpPA.distanceTo(_tmpPB);
        if (len > 1e-4) {
          _tmpDir.subVectors(_tmpPB, _tmpPA).normalize();
          _tmpQuat.setFromUnitVectors(_tmpUp, _tmpDir);

          p.barrel.position.copy(_tmpPA).addScaledVector(_tmpDir, len * 0.28);
          p.barrel.scale.set(1, len * 0.56, 1);
          p.barrel.quaternion.copy(_tmpQuat);

          p.rod.position.copy(_tmpPA).addScaledVector(_tmpDir, len * 0.65);
          p.rod.scale.set(1, len * 0.68, 1);
          p.rod.quaternion.copy(_tmpQuat);
        }
      });
    });
  return { inWater: anyInWater, footImpacts };
}
