import * as THREE from 'three';
import type { MechRig, MechMaterials } from './MechModel';
import type { MechState } from './MechState';
import type { MechControl } from './MechController';
import type { MechMotion } from './MechMovementSystem';
import type { MechFootImpact } from './MechIKSystem';
import type { MechShot } from './WeaponSystem';
import {
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
  getRoadNormalizedDistance,
} from '../../map/terrainMath';
import { evaluatePuddleAt } from '../../map/puddles';
import {
  MECH_SCALE,
  MECH_SOLE_HEIGHT,
  shouldEmitTerrainKickup,
} from '../../map/mechKinematics';
import {
  computePebbleTransform,
  spawnKickupBurst,
  stepKickupPool,
  type PebbleTransform,
} from './TerrainKickup';
import {
  spawnWaterImpact,
  type WaterVfxPoolState,
} from './waterVfxPool';
import {
  stampMechFootprint,
  stampMechSkidTrail,
  type GroundTrailsPoolState,
} from './groundTrailsPool';
import {
  spawnMuzzleFlash,
  type MuzzleFlashPoolState,
} from './muzzleFlashPool';

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
const _kickPos = new THREE.Vector3();
const _kickEuler = new THREE.Euler();
const _kickQuat = new THREE.Quaternion();
const _kickScale = new THREE.Vector3();
const _kickMat4 = new THREE.Matrix4();
const _kickZeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);
const _pebbleTf: PebbleTransform = {
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
};

/** Cosmetic-only vibration, ammo feeds, antennae, smoke, kickup debris and particle lifecycle. */
export function stepMechEffects(
  rig: MechRig, sim: MechState, fxParent: THREE.Group | null,
  mats: MechMaterials, dt: number, elapsed: number,
  driveMode: boolean, control: MechControl, motion: MechMotion,
  footImpacts: readonly MechFootImpact[],
  footLiftOffs: readonly MechFootImpact[],
  shots: readonly MechShot[],
  isSoftwareGl: boolean,
  shotDistances?: readonly number[],
  waterVfxPool?: WaterVfxPoolState,
  groundTrailsPool?: GroundTrailsPoolState,
  muzzleFlashPool?: MuzzleFlashPoolState,
): void {
  const { isFiring, isMoving, targetTurnRate } = control;
  const { dieselVib, dieselVibAlt, sinY, cosY } = motion;

  // 1) Parabolic gravel kickup on foot lift-off (4-5 pebbles thrown backward on loose terrain only)
  const moveSign = control.fwd < -0.05 ? -1 : 1;
  const speedScale = control.isDashing
    ? 1.45
    : control.isSprinting
      ? 1.2
      : control.isCrouched
        ? 0.72
        : 0.96;

  for (const lift of footLiftOffs) {
    if (
      elapsed - sim.lastLiftKickupTime[lift.index] <= 0.2 ||
      sim.gaitBlend <= 0.16
    ) {
      continue;
    }
    const groundY = lift.position.y - MECH_SOLE_HEIGHT * MECH_SCALE;
    if (!shouldEmitTerrainKickup(lift.position.x, lift.position.z, groundY, sim.y)) continue;
    sim.lastLiftKickupTime[lift.index] = elapsed;

    spawnKickupBurst(sim.kickupPool, {
      originX: lift.position.x - sinY * 0.22 * moveSign,
      originY: groundY + 0.08,
      originZ: lift.position.z - cosY * 0.22 * moveSign,
      dirX: -sinY * moveSign + cosY * control.turn * 0.28,
      dirZ: -cosY * moveSign - sinY * control.turn * 0.28,
      groundY,
      count: isSoftwareGl ? 4 : 5,
      speedScale,
      coneSpreadRad: 0.58,
    });
  }

  // 2) Braking / hard-turn drift gravel spray from grounded feet (loose terrain only)
  const isBrakingHard =
    Math.abs(sim.prevTargetSpeed) > 1.85 && Math.abs(control.targetSpeed) < 0.45;
  const isHardTurn =
    Math.abs(control.turn) > 0.65 && sim.gaitBlend > 0.35 && Math.abs(control.fwd) > 0.25;
  if (
    driveMode &&
    dt > 0 &&
    (isBrakingHard || isHardTurn) &&
    elapsed - sim.lastDriftKickupTime > 0.18
  ) {
    sim.lastDriftKickupTime = elapsed;
    const skidSign = Math.sign(sim.prevTargetSpeed || control.fwd || 1);
    for (const leg of rig.legs) {
      if (leg.wasSwing) continue;
      const groundY = leg.plantedWorld.y - MECH_SOLE_HEIGHT * MECH_SCALE;
      if (!shouldEmitTerrainKickup(leg.plantedWorld.x, leg.plantedWorld.z, groundY, sim.y)) {
        continue;
      }
      spawnKickupBurst(sim.kickupPool, {
        originX: leg.plantedWorld.x,
        originY: groundY + 0.08,
        originZ: leg.plantedWorld.z,
        dirX: isBrakingHard
          ? sinY * skidSign * 0.85 + cosY * control.turn * 0.55
          : -sinY * skidSign * 0.5 + cosY * control.turn * 0.85,
        dirZ: isBrakingHard
          ? cosY * skidSign * 0.85 - sinY * control.turn * 0.55
          : -cosY * skidSign * 0.5 - sinY * control.turn * 0.85,
        groundY,
        count: isBrakingHard ? 4 : 3,
        speedScale: isBrakingHard ? 1.15 : 1.05,
        coneSpreadRad: 0.82,
      });
    }
  }
  if (
    groundTrailsPool &&
    driveMode &&
    dt > 0 &&
    !sim.inWater &&
    ((control.isDashing && control.isMoving) || isBrakingHard) &&
    elapsed - sim.lastSkidTrailTime >= 0.18
  ) {
    sim.lastSkidTrailTime = elapsed;
    stampMechSkidTrail(groundTrailsPool, sim.x, sim.z, sim.yaw, sim.y);
  }
  sim.prevTargetSpeed = THREE.MathUtils.lerp(
    sim.prevTargetSpeed,
    control.targetSpeed,
    Math.min(1, dt * 8),
  );

  // 3) Translate IK contact events into dust, river/puddle water splashes, and sprint/dash impact gravel
  for (const impact of footImpacts) {
    const groundY = impact.position.y - MECH_SOLE_HEIGHT * MECH_SCALE;
    const isLooseTerrain = shouldEmitTerrainKickup(
      impact.position.x,
      impact.position.z,
      groundY,
      sim.y,
    );
    let footInPuddle = false;
    if (isLooseTerrain && groundY > 1.25 && groundY < 14.5) {
      const normal = getAnalyticalTerrainNormal(impact.position.x, impact.position.z, 1.95, true);
      const onRoad = getRoadNormalizedDistance(impact.position.x, impact.position.z) < 1.0;
      footInPuddle =
        evaluatePuddleAt(impact.position.x, groundY, impact.position.z, normal.ny, {
          isRoad: onRoad,
        }).waterFactor > 0.35;
    }
    const riverFootInWater = groundY < WATER_LEVEL + 0.08;
    const footInWater = riverFootInWater || footInPuddle;
    if (groundTrailsPool && !riverFootInWater && sim.gaitBlend > 0.16) {
      stampMechFootprint(
        groundTrailsPool,
        impact.position.x,
        impact.position.z,
        sim.yaw,
        sim.y,
      );
    }
    if (
      (control.isSprinting || control.isDashing) &&
      sim.gaitBlend > 0.25 &&
      isLooseTerrain
    ) {
      spawnKickupBurst(sim.kickupPool, {
        originX: impact.position.x,
        originY: groundY + 0.06,
        originZ: impact.position.z,
        dirX: -sinY * moveSign,
        dirZ: -cosY * moveSign,
        groundY,
        count: 3,
        speedScale: control.isDashing ? 1.25 : 0.92,
        coneSpreadRad: 1.35,
      });
    }

    if (elapsed - sim.lastStepParticleTime[impact.index] <= 0.22 || sim.gaitBlend <= 0.2) {
      continue;
    }

    if (riverFootInWater && waterVfxPool) {
      sim.lastStepParticleTime[impact.index] = elapsed;
      spawnWaterImpact(waterVfxPool, impact.position.x, impact.position.z, speedScale, {
        dirX: -sinY * moveSign,
        dirZ: -cosY * moveSign,
        countScale: isSoftwareGl ? 0.6 : 1.0,
      });
      continue;
    }

    if (!fxParent || sim.particles.length >= 75) continue;
    sim.lastStepParticleTime[impact.index] = elapsed;
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
        Math.max(WATER_LEVEL + 0.08, groundY + 0.1),
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

  // 3b) Continuous V-shaped hydro-wake trail behind wading / Jet-Dashing Mech
  if (
    waterVfxPool &&
    driveMode &&
    sim.inWater &&
    control.isMoving &&
    (control.isDashing || Math.abs(control.targetSpeed) > 1.35)
  ) {
    const wakeInterval = control.isDashing ? 0.11 : 0.26;
    if (elapsed - sim.lastWaterWakeTime >= wakeInterval) {
      sim.lastWaterWakeTime = elapsed;
      const wakeBack = control.isDashing ? 1.35 : 0.95;
      const sideOffset = 0.72;
      const wxBase = sim.x - sinY * moveSign * wakeBack;
      const wzBase = sim.z - cosY * moveSign * wakeBack;
      const wakeIntensity = control.isDashing ? 1.45 : 0.72;
      spawnWaterImpact(
        waterVfxPool,
        wxBase + cosY * sideOffset,
        wzBase - sinY * sideOffset,
        wakeIntensity,
        {
          dirX: -sinY * moveSign,
          dirZ: -cosY * moveSign,
          splash: control.isDashing,
          countScale: isSoftwareGl ? 0.5 : 0.75,
        },
      );
      spawnWaterImpact(
        waterVfxPool,
        wxBase - cosY * sideOffset,
        wzBase + sinY * sideOffset,
        wakeIntensity,
        { splash: false },
      );
    }
  }

  // Gunfire events are simulated by WeaponSystem, rendered here.
  shots.forEach((shot, shotIdx) => {
    const b = rig.gunBarrels[shot.barrelIndex];
    b.recoilOffset = 0.17;
    sim.springTurretYaw.v += -b.side * (0.36 + Math.random() * 0.14);
    sim.springPelvisPitch.v -= 0.14;
    sim.springSurgeZ.v -= 0.24;
    sim.springBounceY.v -= 0.12;

    if (muzzleFlashPool) {
      spawnMuzzleFlash(muzzleFlashPool, {
        x: shot.muzzlePosition.x,
        y: shot.muzzlePosition.y,
        z: shot.muzzlePosition.z,
        dx: shot.direction.x,
        dy: shot.direction.y,
        dz: shot.direction.z,
        scaleXZ: 0.92,
        scaleZ: 1.05,
        duration: 0.065,
        r: 1.0,
        g: 0.68,
        b: 0.22,
        intensity: 1.32,
      });
    }

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

  rig.gunBarrels.forEach((b) => {
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

    // Step and upload parabolic InstancedMesh gravel kickup transforms
    const prevActive = sim.kickupPool.activeCount;
    const nowActive = stepKickupPool(sim.kickupPool, dt);
    if (nowActive > 0 || prevActive > 0) {
      const slots = sim.kickupPool.slots;
      for (let i = 0; i < slots.length; i++) {
        if (computePebbleTransform(slots[i], _pebbleTf)) {
          _kickPos.set(_pebbleTf.x, _pebbleTf.y, _pebbleTf.z);
          _kickEuler.set(_pebbleTf.rx, _pebbleTf.ry, _pebbleTf.rz);
          _kickQuat.setFromEuler(_kickEuler);
          _kickScale.set(_pebbleTf.sx, _pebbleTf.sy, _pebbleTf.sz);
          _kickMat4.compose(_kickPos, _kickQuat, _kickScale);
          rig.kickupMesh.setMatrixAt(i, _kickMat4);
        } else {
          rig.kickupMesh.setMatrixAt(i, _kickZeroMat4);
        }
      }
      rig.kickupMesh.instanceMatrix.needsUpdate = true;
    }
}
