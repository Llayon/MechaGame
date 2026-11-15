import * as THREE from 'three';
import type { MechRig, MechMaterials } from './MechModel';
import type { MechState } from './MechState';
import type { MechControl } from './MechController';
import type { MechMotion } from './MechMovementSystem';
import type { MechFootImpact } from './MechIKSystem';
import type { MechShot } from './WeaponSystem';
import { WATER_LEVEL } from '../../map/terrainMath';
import { MECH_SCALE, MECH_SOLE_HEIGHT } from '../../map/mechKinematics';

function cubicBezier(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  out.copy(p0).multiplyScalar(uuu);
  out.addScaledVector(p1, 3 * uu * t);
  out.addScaledVector(p2, 3 * u * tt);
  out.addScaledVector(p3, ttt);
  return out;
}
const _tmpPt = new THREE.Vector3();
const _tmpNextPt = new THREE.Vector3();
const _tmpP1Dyn = new THREE.Vector3();
const _tmpP2Dyn = new THREE.Vector3();
const _tmpExhaustPos = new THREE.Vector3();
const _tmpLook = new THREE.Vector3();

/** Cosmetic-only vibration, ammo feeds, antennae, smoke and particle lifecycle. */
export function stepMechEffects(
  rig: MechRig, sim: MechState, fxParent: THREE.Group | null,
  mats: MechMaterials, dt: number, elapsed: number,
  driveMode: boolean, control: MechControl, motion: MechMotion,
  footImpacts: readonly MechFootImpact[], shots: readonly MechShot[],
  isSoftwareGl: boolean,
  shotDistances?: readonly number[],
): void {
  const { isFiring, isMoving, targetTurnRate } = control;
  const { dieselVib, dieselVibAlt, sinY, cosY } = motion;

  // Translate IK contact events into dust and water splashes.
  for (const impact of footImpacts) {
    if (!fxParent ||
        elapsed - sim.lastStepParticleTime[impact.index] <= 0.22 ||
        sim.gaitBlend <= 0.2 || sim.particles.length >= 75) continue;
    sim.lastStepParticleTime[impact.index] = elapsed;
    const footInWater = impact.position.y - MECH_SOLE_HEIGHT * MECH_SCALE < WATER_LEVEL + 0.08;
    const puffCount = isSoftwareGl ? 3 : 5;
    for (let d = 0; d < puffCount; d++) {
      const ang = (d / puffCount) * Math.PI * 2;
      const pMat = new THREE.MeshBasicMaterial({
        color: footInWater ? 0xbbe8f7 : 0xa08866,
        transparent: true, opacity: footInWater ? 0.52 : 0.4,
        depthWrite: false,
      });
      const pm = new THREE.Mesh(rig.dustGeom, pMat);
      pm.position.set(
        impact.position.x + Math.cos(ang) * 0.35,
        Math.max(WATER_LEVEL + 0.08, impact.position.y - MECH_SOLE_HEIGHT * MECH_SCALE + 0.1),
        impact.position.z + Math.sin(ang) * 0.35,
      );
      fxParent.add(pm);
      sim.particles.push({
        type: footInWater ? 'splash' : 'dust',
        mesh: pm, mat: pMat,
        vel: new THREE.Vector3(
          Math.cos(ang) * (footInWater ? 1.5 : 1.05),
          (footInWater ? 1.2 : 0.65) + Math.random() * 0.5,
          Math.sin(ang) * (footInWater ? 1.5 : 1.05),
        ),
        rotVel: new THREE.Vector3(), life: 0,
        maxLife: footInWater ? 0.65 : 0.8,
        initialOpacity: footInWater ? 0.52 : 0.4,
      });
    }
  }

  // Gunfire events are simulated by WeaponSystem, rendered here.
  shots.forEach((shot, shotIdx) => {
    const b = rig.gunBarrels[shot.barrelIndex];
    b.flashTimer = 0.095;
    b.recoilOffset = 0.17;
    sim.springTurretYaw.v += -b.side * (0.36 + Math.random() * 0.14);
    sim.springPelvisPitch.v -= 0.14;
    sim.springSurgeZ.v -= 0.24;
    sim.springBounceY.v -= 0.12;

    if (!fxParent || sim.particles.length >= 85) return;
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffe57f, transparent: true, opacity: 0.96, toneMapped: false,
    });
    const tracerMesh = new THREE.Mesh(rig.tracerGeom, tracerMat);
    tracerMesh.position.copy(shot.muzzlePosition).addScaledVector(shot.direction, 1.25);
    _tmpLook.copy(tracerMesh.position).add(shot.direction);
    tracerMesh.lookAt(_tmpLook);
    fxParent.add(tracerMesh);
    const maxTracerDist = shotDistances?.[shotIdx];
    const tracerLife =
      maxTracerDist !== undefined
        ? Math.max(0.03, Math.min(0.9, maxTracerDist / 68))
        : 0.9;
    sim.particles.push({
      type: 'tracer', mesh: tracerMesh, mat: tracerMat,
      vel: shot.direction.clone().multiplyScalar(68),
      rotVel: new THREE.Vector3(), life: 0, maxLife: tracerLife, initialOpacity: 0.96,
    });
    if (Math.random() < 0.55) {
      const shellMesh = new THREE.Mesh(rig.shellGeom, mats.brassMat);
      shellMesh.position.copy(shot.ejectPosition);
      fxParent.add(shellMesh);
      sim.particles.push({
        type: 'shell', mesh: shellMesh, mat: mats.brassMat,
        vel: new THREE.Vector3(
          shot.side * (1.8 + Math.random() * 1.4),
          2.4 + Math.random() * 1.2,
          (Math.random() - 0.5) * 1.8,
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14, 0,
        ),
        life: 0, maxLife: 0.9, initialOpacity: 1,
      });
    }
  });

  rig.gunBarrels.forEach((b, bIndex) => {
    if (b.flashTimer > 0) {
      b.flashTimer = Math.max(0, b.flashTimer - dt);
      b.flashMat.opacity = 0.92;
      b.flashMesh.rotation.z = elapsed * 31 + bIndex * 1.7;
    } else {
      b.flashMat.opacity = 0;
    }
    b.recoilOffset = THREE.MathUtils.lerp(b.recoilOffset, 0, dt * 16);
    b.mesh.position.z = b.baseZ - b.recoilOffset;
  });

    // Diesel chassis & grab rail subtle mechanical vibration
    rig.mtoBlock.position.y = rig.mtoBaseY + dieselVib;
    rig.mtoGrille.position.y = rig.mtoGrilleBaseY + dieselVib * 1.35;
    rig.exhaustPipes.forEach((ep, epIdx) => {
      const sign = epIdx === 0 ? 1 : -1;
      ep.mesh.position.x = ep.baseX + dieselVibAlt * 1.4 * sign;
      ep.mesh.position.y = ep.baseY + dieselVib * 1.2;
    });
    rig.grabRails.forEach((gr, grIdx) => {
      const sign = grIdx === 0 ? 1 : -1;
      gr.mesh.position.x = gr.baseX + dieselVibAlt * 1.2 * sign;
      gr.mesh.position.y = gr.baseY + dieselVib;
    });

    // Dynamic 22-link brass ammo belts
    rig.dynamicAmmoBelts.forEach((belt) => {
      const vib =
        (isFiring
          ? Math.sin(elapsed * 32) * 0.025
          : Math.sin(sim.gaitPhase * 2) * 0.015 * sim.gaitBlend) +
        dieselVib * 2.2;
      _tmpP1Dyn.copy(belt.p1).add(new THREE.Vector3(belt.side * vib, -Math.abs(vib) * 0.6, vib));
      _tmpP2Dyn.copy(belt.p2).add(new THREE.Vector3(belt.side * vib * 0.7, 0, -vib));
      belt.links.forEach((lk) => {
        cubicBezier(belt.p0, _tmpP1Dyn, _tmpP2Dyn, belt.p3, lk.t, _tmpPt);
        cubicBezier(
          belt.p0,
          _tmpP1Dyn,
          _tmpP2Dyn,
          belt.p3,
          Math.min(1, lk.t + 0.04),
          _tmpNextPt,
        );
        lk.mesh.position.copy(_tmpPt);
        lk.mesh.lookAt(_tmpNextPt);
      });
    });

    // Whip antenna spring sway
    const antX =
      sim.springAntennaX.update(
        -Math.cos(sim.gaitPhase * 2) * 0.055 * sim.gaitBlend - (isFiring ? 0.028 : 0),
        dt,
      ) +
      dieselVib * 1.6;
    const antZ =
      sim.springAntennaZ.update(
        Math.sin(sim.gaitPhase) * 0.068 * sim.gaitBlend + targetTurnRate * 0.065,
        dt,
      ) +
      dieselVibAlt * 1.6;
    rig.antennaSegments.forEach((seg, idx) => {
      const factor = 1 + idx * 0.13;
      seg.rotation.x = antX * factor;
      seg.rotation.z = antZ * factor;
    });

    // Exhaust diesel smoke when driving
    if (
      driveMode &&
      fxParent &&
      sim.particles.length < 75 &&
      Math.random() < (isMoving ? 0.35 : 0.1) + sim.dieselRevBoost * 0.3
    ) {
      const tip = rig.exhaustTips[Math.floor(Math.random() * rig.exhaustTips.length)];
      tip.getWorldPosition(_tmpExhaustPos);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x3b3f3c,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      const sm = new THREE.Mesh(rig.dustGeom, smokeMat);
      sm.position.copy(_tmpExhaustPos);
      sm.scale.setScalar(0.75);
      fxParent.add(sm);
      sim.particles.push({
        type: 'smoke',
        mesh: sm,
        mat: smokeMat,
        vel: new THREE.Vector3(
          -sinY * 0.8 + (Math.random() - 0.5) * 0.4,
          1.1 + Math.random() * 0.6,
          -cosY * 0.8 + (Math.random() - 0.5) * 0.4,
        ),
        rotVel: new THREE.Vector3(0, 0, 0),
        life: 0,
        maxLife: 1.05,
        initialOpacity: 0.34,
      });
    }

    // Update & recycle active world particles
    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const p = sim.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.parent?.remove(p.mesh);
        if (p.mat !== mats.brassMat) p.mat.dispose();
        sim.particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      if (p.type === 'shell') {
        p.vel.y -= 11.5 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.rotVel.x * dt;
        p.mesh.rotation.y += p.rotVel.y * dt;
      } else if (p.type === 'tracer') {
        p.mesh.position.addScaledVector(p.vel, dt);
        (p.mat as THREE.MeshBasicMaterial).opacity = (1 - t) * p.initialOpacity;
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        const s = (p.type === 'smoke' ? 0.75 : 0.9) + t * (p.type === 'dust' ? 2.2 : 1.8);
        p.mesh.scale.setScalar(s);
        (p.mat as THREE.MeshBasicMaterial).opacity = (1 - t) * p.initialOpacity;
      }
    }
}
