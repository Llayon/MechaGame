import * as THREE from 'three';
import { MECH_L1, MECH_L2, MECH_L3, MECH_SCALE, MECH_SOLE_HEIGHT, MECH_SPAWN, getWalkableSurfaceY } from '../../map/mechKinematics';
import type { createMechMaterials } from './mechMaterials';
import { KICKUP_POOL_SIZE } from './TerrainKickup';

export type MechMaterials = ReturnType<typeof createMechMaterials>;
export interface LegRig {
  side: -1 | 1;
  hipAnchor: THREE.Group;
  hipJoint: THREE.Group;
  kneeJoint: THREE.Group;
  hockJoint: THREE.Group;
  ankleAnchor: THREE.Object3D;
  footGroup: THREE.Group;
  hipBoot: THREE.Mesh;
  ankleBoot: THREE.Mesh;
  frontToes: THREE.Group[];
  heelPivot: THREE.Group;
  pistons: Array<{
    a: THREE.Object3D;
    b: THREE.Object3D;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
  }>;
  plantedWorld: THREE.Vector3;
  stepStartWorld: THREE.Vector3;
  stepEndWorld: THREE.Vector3;
  currentAnkleWorld: THREE.Vector3;
  wasSwing: boolean;
  footPitch: number;
  footRoll: number;
}

export interface GunBarrelRig {
  side: -1 | 1;
  elevPivot: THREE.Group;
  mesh: THREE.Group;
  baseZ: number;
  flashMesh: THREE.Mesh;
  flashMat: THREE.MeshBasicMaterial;
  muzzleAnchor: THREE.Object3D;
  rateHz: number;
  fireAccum: number;
  flashTimer: number;
  recoilOffset: number;
}

export interface AmmoBeltRig {
  side: -1 | 1;
  links: Array<{ mesh: THREE.Mesh; t: number }>;
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
}
function createSculptedClayGeometry(
  radius: number,
  sx: number,
  sy: number,
  sz: number,
  seed: number,
): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    const n =
      Math.sin(vx * 7.1 + seed) * Math.cos(vz * 6.7 - seed) * 0.24 +
      Math.sin(vy * 9.3 + vx * 4.2) * 0.14;
    const factor = 1.0 + n;
    vx *= factor * sx;
    vy *= factor * sy;
    vz *= factor * sz;
    if (vy < -radius * sy * 0.55) vy = -radius * sy * 0.55;
    pos.setXYZ(i, vx, vy, vz);
  }
  geom.computeVertexNormals();
  return geom;
}

/** Construct the exact Object 316 geometry and expose the rig to simulation systems. */
export function buildMechModel(mats: MechMaterials) {
    const disposableGeoms: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];
    const trackG = <T extends THREE.BufferGeometry>(g: T): T => {
      disposableGeoms.push(g);
      return g;
    };

    const root = new THREE.Group();
    root.scale.setScalar(MECH_SCALE);
    root.position.set(MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z);
    root.rotation.y = MECH_SPAWN.yaw;

    const worldFeetGroup = new THREE.Group();

    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 2.48, 0);
    root.add(pelvisGroup);

    // Sculpted egg-shaped cast pelvis + front keel
    const pelvisGeom = trackG(new THREE.SphereGeometry(1.1, 28, 22));
    const pPos = pelvisGeom.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      let vx = pPos.getX(i);
      let vy = pPos.getY(i);
      let vz = pPos.getZ(i);
      vx *= 1.12 - Math.max(0, -vy) * 0.22;
      vy *= 0.68;
      vz *= 1.12;
      if (vz > 0.25) vz += 0.24 * Math.max(0, 1 - Math.abs(vx) * 1.4);
      pPos.setXYZ(i, vx, vy, vz);
    }
    pelvisGeom.computeVertexNormals();
    const pelvisCore = new THREE.Mesh(pelvisGeom, mats.armorMat);
    pelvisCore.castShadow = pelvisCore.receiveShadow = true;
    pelvisGroup.add(pelvisCore);

    const frontKeel = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.16, 0.62, 0.36)),
      mats.armorMat,
    );
    frontKeel.position.set(0, -0.06, 1.22);
    frontKeel.rotation.x = 0.18;
    frontKeel.castShadow = true;
    pelvisGroup.add(frontKeel);

    const lugGeom = trackG(new THREE.TorusGeometry(0.095, 0.028, 8, 16));
    const thimbleGeom = trackG(new THREE.TorusGeometry(0.06, 0.02, 8, 14));
    [-0.5, 0.5].forEach((rx) => {
      const pelvisLug = new THREE.Mesh(lugGeom, mats.darkSteelMat);
      pelvisLug.position.set(rx, 0.18, 1.18);
      pelvisGroup.add(pelvisLug);

      const thimble = new THREE.Mesh(thimbleGeom, mats.chromeRodMat);
      thimble.position.set(rx, 0.14, 1.24);
      thimble.rotation.y = Math.PI / 2;
      pelvisGroup.add(thimble);
    });

    const pelvisCableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, 0.14, 1.24),
      new THREE.Vector3(-0.26, -0.08, 1.34),
      new THREE.Vector3(0.0, -0.14, 1.38),
      new THREE.Vector3(0.26, -0.08, 1.34),
      new THREE.Vector3(0.5, 0.14, 1.24),
    ]);
    const pelvisTowCable = new THREE.Mesh(
      trackG(new THREE.TubeGeometry(pelvisCableCurve, 28, 0.024, 8, false)),
      mats.towCableMat,
    );
    pelvisTowCable.castShadow = true;
    pelvisGroup.add(pelvisTowCable);

    // Rear MTO engine deck
    const mtoBaseY = 0.08;
    const mtoGrilleBaseY = 0.42;
    const mtoBlock = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(1.48, 0.66, 1.14)),
      mats.armorMat,
    );
    mtoBlock.position.set(0, mtoBaseY, -1.16);
    mtoBlock.castShadow = mtoBlock.receiveShadow = true;
    pelvisGroup.add(mtoBlock);

    const mtoGrille = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(1.18, 0.09, 0.78)),
      mats.darkSteelMat,
    );
    mtoGrille.position.set(0, mtoGrilleBaseY, -1.14);
    pelvisGroup.add(mtoGrille);

    const noStepGeom = trackG(new THREE.PlaneGeometry(0.46, 0.23));
    [-0.58, 0.58].forEach((nx) => {
      const noStepDecal = new THREE.Mesh(noStepGeom, mats.decalNoStepMat);
      noStepDecal.position.set(nx, 0.425, -0.76);
      noStepDecal.rotation.x = -Math.PI / 2;
      pelvisGroup.add(noStepDecal);
    });

    // Turret ring & turret pivot
    const turretRing = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(1.14, 1.24, 0.24, 28)),
      mats.gunmetalBlueMat,
    );
    turretRing.position.set(0, 0.46, 0.04);
    pelvisGroup.add(turretRing);

    const turretPivot = new THREE.Group();
    turretPivot.position.set(0, 0.56, 0.04);
    pelvisGroup.add(turretPivot);

    // Turtle-shaped cast turret hull
    const hullGeom = trackG(new THREE.SphereGeometry(1.48, 36, 26));
    const hPos = hullGeom.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let vx = hPos.getX(i);
      let vy = hPos.getY(i);
      let vz = hPos.getZ(i);
      vy *= vy > 0 ? 0.62 : 0.42;
      vx *= 1.16 - Math.max(0, vy) * 0.14;
      vz *= 1.06;
      if (Math.abs(vx) > 1.1 && vz > -0.1 && vz < 0.95 && vy > -0.15 && vy < 0.35) {
        vx *= 0.92;
      }
      hPos.setXYZ(i, vx, vy, vz);
    }
    hullGeom.computeVertexNormals();
    const turretHull = new THREE.Mesh(hullGeom, mats.armorMat);
    turretHull.position.set(0, 0.54, -0.15);
    turretHull.castShadow = turretHull.receiveShadow = true;
    turretPivot.add(turretHull);

    const lowerSkirt = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(1.38, 1.48, 0.24, 32)),
      mats.armorMat,
    );
    lowerSkirt.scale.set(1.12, 1.0, 1.08);
    lowerSkirt.position.set(0, 0.2, -0.04);
    lowerSkirt.castShadow = true;
    turretPivot.add(lowerSkirt);

    // Protruding yellow face mask with diagonal white stripe
    const maskGeom = trackG(new THREE.SphereGeometry(0.92, 32, 24));
    const mPos = maskGeom.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      let vx = mPos.getX(i);
      let vy = mPos.getY(i);
      let vz = mPos.getZ(i);
      vx *= 0.96 - Math.max(0, vy) * 0.14;
      vy *= 0.68;
      vz *= 0.88;
      if (vz > 0.22) vz += 0.16 * Math.cos(vx * 1.5);
      mPos.setXYZ(i, vx, vy, vz);
    }
    maskGeom.computeVertexNormals();
    const frontMask = new THREE.Mesh(maskGeom, mats.faceMaskMat);
    frontMask.position.set(0, 0.64, 1.18);
    frontMask.rotation.y = -Math.PI / 2;
    frontMask.castShadow = true;
    turretPivot.add(frontMask);

    const collarRing = new THREE.Mesh(
      trackG(new THREE.TorusGeometry(0.92, 0.11, 12, 28, Math.PI * 1.32)),
      mats.armorMat,
    );
    collarRing.position.set(0, 0.6, 1.16);
    collarRing.rotation.set(-0.58, 0, -Math.PI * 0.16);
    turretPivot.add(collarRing);

    const hingeKnuckleGeom = trackG(new THREE.CylinderGeometry(0.095, 0.095, 0.18, 12));
    const hingeStrapGeom = trackG(new THREE.BoxGeometry(0.15, 0.11, 0.32));
    const foreheadRibGeom = trackG(new THREE.BoxGeometry(0.11, 0.13, 0.48));
    [-0.24, 0.24].forEach((hx) => {
      const hingeKnuckle = new THREE.Mesh(hingeKnuckleGeom, mats.mustardArmorMat);
      hingeKnuckle.rotation.z = Math.PI / 2;
      hingeKnuckle.position.set(hx, 1.18, 0.92);
      turretPivot.add(hingeKnuckle);

      const hingeStrap = new THREE.Mesh(hingeStrapGeom, mats.mustardArmorMat);
      hingeStrap.position.set(hx, 1.15, 1.06);
      hingeStrap.rotation.x = 0.3;
      turretPivot.add(hingeStrap);

      const foreheadRib = new THREE.Mesh(foreheadRibGeom, mats.mustardArmorMat);
      foreheadRib.position.set(hx * 1.08, 0.92, 1.54);
      foreheadRib.rotation.set(0.66, hx > 0 ? -0.12 : 0.12, 0);
      turretPivot.add(foreheadRib);
    });

    const noseBridge = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.11, 0.21, 0.32, 4)),
      mats.mustardArmorMat,
    );
    noseBridge.rotation.y = Math.PI / 4;
    noseBridge.rotation.x = 0.26;
    noseBridge.position.set(0, 0.48, 1.88);
    turretPivot.add(noseBridge);

    const noseVent = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.19, 0.065, 0.09)),
      mats.darkSteelMat,
    );
    noseVent.position.set(0, 0.34, 1.94);
    turretPivot.add(noseVent);

    const browGeom = trackG(new THREE.BoxGeometry(0.46, 0.11, 0.34));
    const lowerLidGeom = trackG(new THREE.BoxGeometry(0.4, 0.075, 0.26));
    const socketGeom = trackG(new THREE.BoxGeometry(0.38, 0.16, 0.24));
    const lensGeom = trackG(new THREE.SphereGeometry(0.095, 14, 12));
    const glintGeom = trackG(new THREE.SphereGeometry(0.036, 10, 10));
    [-0.42, 0.42].forEach((sx) => {
      const yawAngle = sx > 0 ? -0.34 : 0.34;
      const tiltAngle = sx > 0 ? -0.18 : 0.18;

      const brow = new THREE.Mesh(browGeom, mats.mustardArmorMat);
      brow.position.set(sx, 0.62, 1.76);
      brow.rotation.set(0.24, yawAngle, tiltAngle);
      turretPivot.add(brow);

      const lowerLid = new THREE.Mesh(lowerLidGeom, mats.mustardArmorMat);
      lowerLid.position.set(sx, 0.43, 1.78);
      lowerLid.rotation.set(-0.14, yawAngle, tiltAngle * 0.6);
      turretPivot.add(lowerLid);

      const socket = new THREE.Mesh(socketGeom, mats.darkSteelMat);
      socket.position.set(sx, 0.52, 1.72);
      socket.rotation.y = yawAngle;
      turretPivot.add(socket);

      const lens = new THREE.Mesh(lensGeom, mats.opticLensMat);
      lens.scale.set(1.35, 0.72, 0.65);
      lens.position.set(sx, 0.52, 1.84);
      lens.rotation.y = yawAngle;
      turretPivot.add(lens);

      const glint = new THREE.Mesh(glintGeom, mats.redSensorGlintMat);
      glint.position.set(sx + (sx > 0 ? -0.02 : 0.02), 0.52, 1.89);
      turretPivot.add(glint);
    });

    // Cheek optical rangefinder sensor
    const cheekSensorGroup = new THREE.Group();
    cheekSensorGroup.position.set(0.78, 0.46, 1.44);
    cheekSensorGroup.rotation.y = -0.38;
    turretPivot.add(cheekSensorGroup);

    cheekSensorGroup.add(
      new THREE.Mesh(trackG(new THREE.BoxGeometry(0.16, 0.18, 0.2)), mats.armorMat),
    );
    const sensorCyl = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.095, 0.11, 0.28, 14)),
      mats.armorMat,
    );
    sensorCyl.rotation.x = Math.PI / 2;
    sensorCyl.position.set(0, 0.06, 0.14);
    cheekSensorGroup.add(sensorCyl);

    const sensorFrontGlass = new THREE.Mesh(
      trackG(new THREE.CircleGeometry(0.08, 14)),
      mats.opticLensMat,
    );
    sensorFrontGlass.position.set(0, 0.06, 0.282);
    cheekSensorGroup.add(sensorFrontGlass);

    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.07, 0.06, 0.06),
      new THREE.Vector3(0.18, 0.02, -0.02),
      new THREE.Vector3(0.16, -0.09, -0.1),
      new THREE.Vector3(0.02, -0.12, -0.12),
    ]);
    cheekSensorGroup.add(
      new THREE.Mesh(
        trackG(new THREE.TubeGeometry(cableCurve, 12, 0.022, 8, false)),
        mats.darkSteelMat,
      ),
    );

    // Massive lower jaw with tow shackles & braided cable
    const lowerJaw = new THREE.Mesh(
      trackG(new THREE.SphereGeometry(0.76, 22, 16)),
      mats.armorMat,
    );
    lowerJaw.scale.set(1.26, 0.38, 0.9);
    lowerJaw.position.set(0, 0.18, 1.38);
    lowerJaw.castShadow = true;
    turretPivot.add(lowerJaw);

    const chinLip = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.86, 0.15, 0.42)),
      mats.armorMat,
    );
    chinLip.position.set(0, 0.18, 1.72);
    chinLip.rotation.x = 0.22;
    turretPivot.add(chinLip);

    const hookHornGeom = trackG(new THREE.TorusGeometry(0.12, 0.036, 8, 16, Math.PI * 1.15));
    const shackleRingGeom = trackG(new THREE.TorusGeometry(0.095, 0.024, 8, 16));
    const jawBossGeom = trackG(new THREE.CylinderGeometry(0.12, 0.13, 0.26, 14));
    const jawThimbleGeom = trackG(new THREE.TorusGeometry(0.055, 0.018, 8, 14));
    [-0.36, 0.36].forEach((hx) => {
      const hookHorn = new THREE.Mesh(hookHornGeom, mats.armorMat);
      hookHorn.position.set(hx, 0.18, 1.84);
      hookHorn.rotation.set(0.2, Math.PI / 2, -0.4);
      turretPivot.add(hookHorn);

      const shackleRing = new THREE.Mesh(shackleRingGeom, mats.darkSteelMat);
      shackleRing.position.set(hx, 0.07, 1.86);
      shackleRing.rotation.y = hx > 0 ? -0.25 : 0.25;
      turretPivot.add(shackleRing);

      const jawBoss = new THREE.Mesh(jawBossGeom, mats.armorMat);
      jawBoss.rotation.z = Math.PI / 2;
      jawBoss.position.set(hx * 2.25, 0.18, 1.48);
      jawBoss.rotation.y = hx > 0 ? -0.35 : 0.35;
      turretPivot.add(jawBoss);

      const jawThimble = new THREE.Mesh(jawThimbleGeom, mats.chromeRodMat);
      jawThimble.position.set(hx, 0.05, 1.9);
      turretPivot.add(jawThimble);
    });

    const jawCableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.36, 0.05, 1.9),
      new THREE.Vector3(-0.18, -0.05, 1.95),
      new THREE.Vector3(0.0, -0.08, 1.97),
      new THREE.Vector3(0.18, -0.05, 1.95),
      new THREE.Vector3(0.36, 0.05, 1.9),
    ]);
    turretPivot.add(
      new THREE.Mesh(
        trackG(new THREE.TubeGeometry(jawCableCurve, 24, 0.02, 8, false)),
        mats.towCableMat,
      ),
    );

    // Side cheeks, hull number "316", and grab rails
    const grabRails: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number }> = [];
    const cheekRibGeom = trackG(new THREE.BoxGeometry(0.16, 0.58, 0.26));
    const sidePlateGeom = trackG(new THREE.BoxGeometry(0.14, 0.54, 0.88));
    const numDecalGeom = trackG(new THREE.PlaneGeometry(0.72, 0.36));
    const flangeGeom = trackG(new THREE.CylinderGeometry(0.045, 0.052, 0.05, 10));

    [-1, 1].forEach((side) => {
      const cheekRib = new THREE.Mesh(cheekRibGeom, mats.armorMat);
      cheekRib.position.set(side * 1.48, 0.56, 0.94);
      cheekRib.rotation.set(0.18, side * 0.42, side * -0.15);
      turretPivot.add(cheekRib);

      const sideCheekPlate = new THREE.Mesh(sidePlateGeom, mats.armorMat);
      sideCheekPlate.position.set(side * 1.54, 0.56, 0.42);
      sideCheekPlate.rotation.y = side * 0.12;
      turretPivot.add(sideCheekPlate);

      const numDecal = new THREE.Mesh(numDecalGeom, mats.decal316Mat);
      numDecal.position.set(side * 1.62, 0.56, 0.42);
      numDecal.rotation.y = side * (Math.PI / 2 + 0.12);
      turretPivot.add(numDecal);

      const railCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.56, 0.88, -0.58),
        new THREE.Vector3(side * 1.7, 0.9, -0.46),
        new THREE.Vector3(side * 1.72, 0.9, 0.26),
        new THREE.Vector3(side * 1.58, 0.88, 0.38),
      ]);
      const grabRail = new THREE.Mesh(
        trackG(new THREE.TubeGeometry(railCurve, 20, 0.022, 8, false)),
        mats.darkSteelMat,
      );
      grabRail.castShadow = true;
      turretPivot.add(grabRail);
      grabRails.push({ mesh: grabRail, baseX: 0, baseY: 0 });

      [-0.58, 0.38].forEach((rz) => {
        const flange = new THREE.Mesh(flangeGeom, mats.armorMat);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(side * 1.56, 0.88, rz);
        turretPivot.add(flange);
      });
    });

    // Commander's cupola with 5 periscopes & whip antenna
    const cupolaGroup = new THREE.Group();
    cupolaGroup.position.set(-0.22, 1.4, -0.14);
    turretPivot.add(cupolaGroup);

    const cupolaBase = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.58, 0.7, 0.26, 24)),
      mats.armorMat,
    );
    cupolaBase.castShadow = true;
    cupolaGroup.add(cupolaBase);

    const hatchLid = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.48, 0.52, 0.09, 22)),
      mats.armorMat,
    );
    hatchLid.position.y = 0.15;
    cupolaGroup.add(hatchLid);

    const periHoodGeom = trackG(new THREE.BoxGeometry(0.18, 0.13, 0.16));
    const periGlassGeom = trackG(new THREE.BoxGeometry(0.13, 0.06, 0.03));
    for (let p = 0; p < 5; p++) {
      const ang = -0.85 + p * 0.425;
      const periGrp = new THREE.Group();
      periGrp.position.set(Math.sin(ang) * 0.56, 0.07, Math.cos(ang) * 0.56);
      periGrp.rotation.y = ang;
      periGrp.add(new THREE.Mesh(periHoodGeom, mats.armorMat));
      const glass = new THREE.Mesh(periGlassGeom, mats.darkSteelMat);
      glass.position.set(0, -0.01, 0.075);
      periGrp.add(glass);
      cupolaGroup.add(periGrp);
    }

    const gunnerDome = new THREE.Mesh(
      trackG(new THREE.SphereGeometry(0.24, 16, 12)),
      mats.armorMat,
    );
    gunnerDome.scale.set(1.0, 0.72, 1.1);
    gunnerDome.position.set(0.54, 1.4, 0.12);
    turretPivot.add(gunnerDome);

    const domeGuard = new THREE.Mesh(
      trackG(new THREE.TorusGeometry(0.26, 0.024, 8, 16, Math.PI)),
      mats.darkSteelMat,
    );
    domeGuard.position.set(0.54, 1.42, 0.12);
    domeGuard.rotation.x = 0.35;
    turretPivot.add(domeGuard);

    const roofMast = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.085, 0.115, 0.48, 14)),
      mats.armorMat,
    );
    roofMast.position.set(-0.46, 1.54, -0.72);
    turretPivot.add(roofMast);

    // Flexible Kulikov whip antenna
    const antennaBaseGroup = new THREE.Group();
    antennaBaseGroup.position.set(-0.84, 1.36, -0.84);
    turretPivot.add(antennaBaseGroup);

    antennaBaseGroup.add(
      new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 14)),
        mats.armorMat,
      ),
    );
    const antInsulator = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.068, 0.082, 0.16, 12)),
      mats.darkSteelMat,
    );
    antInsulator.position.y = 0.11;
    antennaBaseGroup.add(antInsulator);

    const antSpringCup = new THREE.Mesh(
      trackG(new THREE.TorusGeometry(0.065, 0.018, 8, 14)),
      mats.chromeRodMat,
    );
    antSpringCup.rotation.x = Math.PI / 2;
    antSpringCup.position.y = 0.2;
    antennaBaseGroup.add(antSpringCup);

    const antennaSegments: THREE.Group[] = [];
    let prevAntParent: THREE.Object3D = antennaBaseGroup;
    for (let i = 0; i < 10; i++) {
      const segPivot = new THREE.Group();
      segPivot.position.set(0, i === 0 ? 0.21 : 0.195, 0);
      const rTop = 0.021 * (1 - i * 0.075);
      const rBot = 0.023 * (1 - i * 0.07);
      const segMesh = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(rTop, rBot, 0.205, 8)),
        mats.darkSteelMat,
      );
      segMesh.position.y = 0.1;
      segPivot.add(segMesh);
      prevAntParent.add(segPivot);
      antennaSegments.push(segPivot);
      prevAntParent = segPivot;
    }
    const antTipBall = new THREE.Mesh(
      trackG(new THREE.SphereGeometry(0.018, 8, 8)),
      mats.chromeRodMat,
    );
    antTipBall.position.y = 0.205;
    prevAntParent.add(antTipBall);

    // Exhaust pipes, spare pads, canvas tarp roll, ZIP box, & jerrycan
    const exhaustTips: THREE.Object3D[] = [];
    const exhaustPipes: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number }> = [];
    const pipeGeom = trackG(new THREE.CylinderGeometry(0.11, 0.13, 0.65, 12));
    const sparePadGeom = trackG(new THREE.BoxGeometry(0.46, 0.52, 0.14));
    [-0.58, 0.58].forEach((ex) => {
      const pipe = new THREE.Mesh(pipeGeom, mats.darkSteelMat);
      pipe.position.set(ex, 0.9, -1.62);
      pipe.rotation.x = -0.35;
      pipe.castShadow = true;
      turretPivot.add(pipe);
      exhaustPipes.push({ mesh: pipe, baseX: ex, baseY: 0.9 });

      const tip = new THREE.Object3D();
      tip.position.set(0, 0.34, 0);
      pipe.add(tip);
      exhaustTips.push(tip);

      const sparePad = new THREE.Mesh(sparePadGeom, mats.armorMat);
      sparePad.position.set(ex * 1.15, 0.36, -1.72);
      sparePad.rotation.x = 0.18;
      turretPivot.add(sparePad);
    });

    const tarpRollGroup = new THREE.Group();
    tarpRollGroup.position.set(0, 0.74, -1.76);
    turretPivot.add(tarpRollGroup);

    const tarpCyl = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.18, 0.19, 1.18, 18)),
      mats.tarpRollMat,
    );
    tarpCyl.rotation.z = Math.PI / 2;
    tarpCyl.castShadow = true;
    tarpRollGroup.add(tarpCyl);

    const rollEndGeom = trackG(new THREE.TorusGeometry(0.12, 0.055, 8, 14));
    [-0.59, 0.59].forEach((rx) => {
      const rollEnd = new THREE.Mesh(rollEndGeom, mats.tarpRollMat);
      rollEnd.rotation.y = Math.PI / 2;
      rollEnd.position.x = rx;
      tarpRollGroup.add(rollEnd);
    });

    const strapGeom = trackG(new THREE.TorusGeometry(0.195, 0.022, 8, 18));
    const buckleGeom = trackG(new THREE.BoxGeometry(0.05, 0.07, 0.04));
    [-0.36, 0.36].forEach((sx) => {
      const strap = new THREE.Mesh(strapGeom, mats.leatherStrapMat);
      strap.rotation.y = Math.PI / 2;
      strap.position.x = sx;
      tarpRollGroup.add(strap);

      const buckle = new THREE.Mesh(buckleGeom, mats.brassMat);
      buckle.position.set(sx, 0.04, -0.2);
      tarpRollGroup.add(buckle);
    });

    const zipBox = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.86, 0.36, 0.34)),
      mats.armorMat,
    );
    zipBox.position.set(0, 0.4, -1.78);
    zipBox.castShadow = true;
    turretPivot.add(zipBox);

    const jerryCanGroup = new THREE.Group();
    jerryCanGroup.position.set(0.84, 0.88, -1.42);
    turretPivot.add(jerryCanGroup);

    const jerryCan = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.24, 0.42, 0.32)),
      mats.mustardArmorMat,
    );
    jerryCan.castShadow = true;
    jerryCanGroup.add(jerryCan);

    const canCap = new THREE.Mesh(
      trackG(new THREE.CylinderGeometry(0.035, 0.04, 0.06, 10)),
      mats.darkSteelMat,
    );
    canCap.position.set(0, 0.23, 0.09);
    jerryCanGroup.add(canCap);

    const fuelDecal = new THREE.Mesh(
      trackG(new THREE.PlaneGeometry(0.3, 0.15)),
      mats.decalFuelMat,
    );
    fuelDecal.position.set(0.125, 0.02, 0);
    fuelDecal.rotation.y = Math.PI / 2;
    jerryCanGroup.add(fuelDecal);

    // Shoulder weapon pods (4 x 37-mm AA autocannons + 22-link brass belts)
    const gunBarrels: GunBarrelRig[] = [];
    const dynamicAmmoBelts: AmmoBeltRig[] = [];
    const linkGeom = trackG(new THREE.BoxGeometry(0.22, 0.048, 0.075));
    const flashGeom = trackG(new THREE.ConeGeometry(0.24, 0.68, 8));

    ([-1, 1] as const).forEach((side) => {
      const podRoot = new THREE.Group();
      podRoot.position.set(side * 2.02, 0.86, -0.05);
      turretPivot.add(podRoot);

      const trunnionArm = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.34, 0.38, 0.56, 18)),
        mats.darkSteelMat,
      );
      trunnionArm.rotation.z = Math.PI / 2;
      trunnionArm.position.set(-side * 0.42, -0.02, 0.02);
      podRoot.add(trunnionArm);

      const housing = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.7, 0.72, 1.48)),
        mats.armorMat,
      );
      housing.castShadow = housing.receiveShadow = true;
      podRoot.add(housing);

      const topShoulder = new THREE.Mesh(
        trackG(new THREE.SphereGeometry(0.46, 18, 14)),
        mats.armorMat,
      );
      topShoulder.scale.set(0.88, 0.68, 1.56);
      topShoulder.position.set(0, 0.34, -0.06);
      topShoulder.castShadow = true;
      podRoot.add(topShoulder);

      const frontAmberLamp = new THREE.Mesh(
        trackG(new THREE.SphereGeometry(0.06, 8, 8)),
        mats.amberLampMat,
      );
      frontAmberLamp.position.set(side * 0.22, 0.32, 0.64);
      podRoot.add(frontAmberLamp);

      const rearRedLamp = new THREE.Mesh(
        trackG(new THREE.SphereGeometry(0.06, 8, 8)),
        mats.redBeaconMat,
      );
      rearRedLamp.position.set(side * 0.28, 0.28, -0.68);
      podRoot.add(rearRedLamp);

      const starMesh = new THREE.Mesh(
        trackG(new THREE.PlaneGeometry(0.48, 0.48)),
        mats.decalStarMat,
      );
      starMesh.position.set(side * 0.365, 0.06, 0.14);
      starMesh.rotation.y = side * (Math.PI / 2);
      podRoot.add(starMesh);

      const recoilDecal = new THREE.Mesh(
        trackG(new THREE.PlaneGeometry(0.56, 0.28)),
        mats.decalRecoilMat,
      );
      recoilDecal.position.set(side * 0.365, -0.22, 0.28);
      recoilDecal.rotation.y = side * (Math.PI / 2);
      podRoot.add(recoilDecal);

      const scaleDecal = new THREE.Mesh(
        trackG(new THREE.PlaneGeometry(0.42, 0.21)),
        mats.decalScaleMat,
      );
      scaleDecal.position.set(-side * 0.36, 0.02, 0.46);
      scaleDecal.rotation.y = -side * (Math.PI / 2);
      podRoot.add(scaleDecal);

      const ammoDrum = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.54, 0.4, 0.68)),
        mats.greenAmmoMat,
      );
      ammoDrum.position.set(0, -0.56, -0.22);
      ammoDrum.castShadow = true;
      podRoot.add(ammoDrum);

      const ammoCap = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14)),
        mats.darkSteelMat,
      );
      ammoCap.rotation.x = Math.PI / 2;
      ammoCap.position.set(0, -0.56, 0.14);
      podRoot.add(ammoCap);

      const gunElevPivot = new THREE.Group();
      gunElevPivot.position.set(-side * 0.1, -0.04, 0.64);
      podRoot.add(gunElevPivot);

      [-0.22, 0.22].forEach((by, bIdx) => {
        const mantlet = new THREE.Mesh(
          trackG(new THREE.CylinderGeometry(0.105, 0.145, 0.38, 14)),
          mats.darkSteelMat,
        );
        mantlet.rotation.x = Math.PI / 2;
        mantlet.position.set(0, by, 0.16);
        gunElevPivot.add(mantlet);

        const barrelGrp = new THREE.Group();
        barrelGrp.position.set(0, by, 0.32);
        gunElevPivot.add(barrelGrp);

        const tube = new THREE.Mesh(
          trackG(new THREE.CylinderGeometry(0.062, 0.086, 1.34, 12)),
          mats.gunmetalBlueMat,
        );
        tube.rotation.x = Math.PI / 2;
        tube.position.z = 0.64;
        tube.castShadow = true;
        barrelGrp.add(tube);

        const whiteBand = new THREE.Mesh(
          trackG(new THREE.CylinderGeometry(0.066, 0.068, 0.11, 12)),
          mats.whiteStripeMat,
        );
        whiteBand.rotation.x = Math.PI / 2;
        whiteBand.position.z = 1.14;
        barrelGrp.add(whiteBand);

        const muzzle = new THREE.Mesh(
          trackG(new THREE.CylinderGeometry(0.104, 0.07, 0.28, 12)),
          mats.darkSteelMat,
        );
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.z = 1.36;
        barrelGrp.add(muzzle);

        const flashMat = new THREE.MeshBasicMaterial({
          color: 0xffd269,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        disposableMats.push(flashMat);
        const flashMesh = new THREE.Mesh(flashGeom, flashMat);
        flashMesh.position.set(0, 0, 1.54);
        flashMesh.rotation.x = Math.PI / 2;
        barrelGrp.add(flashMesh);

        const muzzleAnchor = new THREE.Object3D();
        muzzleAnchor.position.set(0, 0, 1.52);
        barrelGrp.add(muzzleAnchor);

        gunBarrels.push({
          side,
          elevPivot: gunElevPivot,
          mesh: barrelGrp,
          baseZ: 0.32,
          flashMesh,
          flashMat,
          muzzleAnchor,
          rateHz: 4.4 + (side > 0 ? 0 : 0.25) + bIdx * 0.15,
          fireAccum: 0.94 - (side > 0 ? 0 : 0.25) - bIdx * 0.5,
          flashTimer: 0,
          recoilOffset: 0,
        });
      });

      const links: Array<{ mesh: THREE.Mesh; t: number }> = [];
      for (let i = 0; i < 22; i++) {
        const m = new THREE.Mesh(linkGeom, mats.brassMat);
        podRoot.add(m);
        links.push({ mesh: m, t: i / 21 });
      }
      dynamicAmmoBelts.push({
        side,
        links,
        p0: new THREE.Vector3(side * 0.14, -0.48, -0.48),
        p1: new THREE.Vector3(side * 0.48, -0.74, -1.04),
        p2: new THREE.Vector3(side * 0.46, 0.14, -1.12),
        p3: new THREE.Vector3(side * 0.12, 0.14, -0.68),
      });
    });

    // Reverse-joint S-legs + sculpted mud-caked 3-toe feet
    const bootPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bootPts.push(
        new THREE.Vector2(0.32 + Math.sin(t * Math.PI * 5) * 0.048, -t * 0.42),
      );
    }
    const bootGeom = trackG(new THREE.LatheGeometry(bootPts, 16));
    const pistonBarrelGeom = trackG(
      new THREE.CylinderGeometry(0.078 * MECH_SCALE, 0.078 * MECH_SCALE, 1, 10),
    );
    const pistonRodGeom = trackG(
      new THREE.CylinderGeometry(0.046 * MECH_SCALE, 0.046 * MECH_SCALE, 1, 10),
    );

    const legs: LegRig[] = [];
    const sinSpawn = Math.sin(MECH_SPAWN.yaw);
    const cosSpawn = Math.cos(MECH_SPAWN.yaw);

    ([-1, 1] as const).forEach((side) => {
      const hipAnchor = new THREE.Group();
      hipAnchor.position.set(side * 1.24, -0.14, 0.04);
      pelvisGroup.add(hipAnchor);

      const innerHipDrum = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.46, 0.46, 0.44, 18)),
        mats.darkSteelMat,
      );
      innerHipDrum.rotation.z = Math.PI / 2;
      hipAnchor.add(innerHipDrum);

      const ribGeom = trackG(new THREE.BoxGeometry(0.36, 0.06, 0.94));
      for (let r = 0; r < 6; r++) {
        const rib = new THREE.Mesh(ribGeom, mats.gunmetalBlueMat);
        rib.rotation.x = (r / 6) * Math.PI;
        rib.position.x = side * 0.06;
        hipAnchor.add(rib);
      }

      const hipBoot = new THREE.Mesh(bootGeom, mats.canvasBootMat);
      hipBoot.position.set(side * 0.1, -0.14, 0);
      hipAnchor.add(hipBoot);

      const hipJoint = new THREE.Group();
      hipJoint.position.set(side * 0.24, 0, 0);
      hipAnchor.add(hipJoint);

      const outerHipShield = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.68, 0.68, 0.46, 24)),
        mats.armorMat,
      );
      outerHipShield.rotation.z = Math.PI / 2;
      outerHipShield.position.set(side * 0.14, -0.04, 0);
      outerHipShield.castShadow = true;
      hipJoint.add(outerHipShield);

      const outerHubRing = new THREE.Mesh(
        trackG(new THREE.TorusGeometry(0.34, 0.12, 12, 20)),
        mats.armorMat,
      );
      outerHubRing.rotation.y = Math.PI / 2;
      outerHubRing.position.set(side * 0.36, -0.04, 0);
      hipJoint.add(outerHubRing);

      const hubRecess = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 16)),
        mats.darkSteelMat,
      );
      hubRecess.rotation.z = Math.PI / 2;
      hubRecess.position.set(side * 0.33, -0.04, 0);
      hipJoint.add(hubRecess);

      const thighCrest = new THREE.Mesh(
        trackG(new THREE.TorusGeometry(0.66, 0.16, 12, 24, Math.PI * 0.72)),
        mats.mustardArmorMat,
      );
      thighCrest.position.set(side * 0.16, -0.04, 0.04);
      thighCrest.rotation.set(0, Math.PI / 2, -0.18);
      thighCrest.castShadow = true;
      hipJoint.add(thighCrest);

      const thighArmor = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.52, MECH_L1 * 0.94, 0.66)),
        mats.armorMat,
      );
      thighArmor.position.set(side * 0.04, -MECH_L1 * 0.48, 0.04);
      thighArmor.castShadow = thighArmor.receiveShadow = true;
      hipJoint.add(thighArmor);

      const thighPlate = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.12, 0.44, 0.58)),
        mats.armorMat,
      );
      thighPlate.position.set(side * 0.32, -MECH_L1 * 0.54, 0.06);
      hipJoint.add(thighPlate);

      const sideNum = new THREE.Mesh(
        trackG(new THREE.PlaneGeometry(0.48, 0.24)),
        mats.decal316Mat,
      );
      sideNum.position.set(side * 0.39, -MECH_L1 * 0.54, 0.06);
      sideNum.rotation.y = side * (Math.PI / 2);
      hipJoint.add(sideNum);

      const kneeScoop = new THREE.Mesh(
        trackG(new THREE.SphereGeometry(0.46, 20, 16)),
        mats.mustardArmorMat,
      );
      kneeScoop.scale.set(0.84, 0.88, 0.92);
      kneeScoop.position.set(side * 0.04, -MECH_L1 * 0.86, 0.36);
      kneeScoop.castShadow = true;
      hipJoint.add(kneeScoop);

      const kneeMud = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.62, 0.22, 0.46)),
        mats.terracottaMudMat,
      );
      kneeMud.position.set(side * 0.04, -MECH_L1 * 1.08, 0.36);
      hipJoint.add(kneeMud);

      const p1A = new THREE.Object3D();
      p1A.position.set(side * 0.04, -0.45, 0.26);
      hipJoint.add(p1A);

      // Knee joint & reverse shin
      const kneeJoint = new THREE.Group();
      kneeJoint.position.set(side * 0.04, -MECH_L1, 0);
      hipJoint.add(kneeJoint);

      const kneeDrum = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.34, 0.34, 0.64, 18)),
        mats.armorMat,
      );
      kneeDrum.rotation.z = Math.PI / 2;
      kneeJoint.add(kneeDrum);

      const shinArmor = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.46, MECH_L2 * 0.92, 0.38)),
        mats.armorMat,
      );
      shinArmor.position.set(0, -MECH_L2 * 0.48, -0.04);
      shinArmor.rotation.x = -0.14;
      shinArmor.castShadow = shinArmor.receiveShadow = true;
      kneeJoint.add(shinArmor);

      const shinMud = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.49, 0.34, 0.4)),
        mats.terracottaMudMat,
      );
      shinMud.position.set(0, -MECH_L2 * 0.78, -0.04);
      kneeJoint.add(shinMud);

      const p1B = new THREE.Object3D();
      p1B.position.set(0, -0.48, 0.26);
      kneeJoint.add(p1B);

      const p2A = new THREE.Object3D();
      p2A.position.set(0, -0.28, -0.24);
      kneeJoint.add(p2A);

      // Hock joint & gunmetal pastern fork
      const hockJoint = new THREE.Group();
      hockJoint.position.set(0, -MECH_L2, 0);
      kneeJoint.add(hockJoint);

      const hockDrum = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.3, 0.3, 0.56, 18)),
        mats.armorMat,
      );
      hockDrum.rotation.z = Math.PI / 2;
      hockJoint.add(hockDrum);

      const midKnuckle = new THREE.Mesh(
        trackG(new THREE.CylinderGeometry(0.14, 0.14, 0.44, 14)),
        mats.gunmetalBlueMat,
      );
      midKnuckle.rotation.z = Math.PI / 2;
      midKnuckle.position.set(0, -MECH_L3 * 0.52, 0.12);
      hockJoint.add(midKnuckle);

      const upperForkG = trackG(
        new THREE.CylinderGeometry(0.072, 0.082, MECH_L3 * 0.56, 10),
      );
      const lowerForkG = trackG(
        new THREE.CylinderGeometry(0.068, 0.078, MECH_L3 * 0.52, 10),
      );
      [-0.13, 0.13].forEach((fx) => {
        const upperFork = new THREE.Mesh(upperForkG, mats.gunmetalBlueMat);
        upperFork.position.set(fx, -MECH_L3 * 0.26, 0.06);
        upperFork.rotation.x = -0.22;
        upperFork.castShadow = true;
        hockJoint.add(upperFork);

        const lowerFork = new THREE.Mesh(lowerForkG, mats.gunmetalBlueMat);
        lowerFork.position.set(fx, -MECH_L3 * 0.76, 0.06);
        lowerFork.rotation.x = 0.22;
        lowerFork.castShadow = true;
        hockJoint.add(lowerFork);
      });

      const p2B = new THREE.Object3D();
      p2B.position.set(0, -0.28, -0.18);
      hockJoint.add(p2B);

      const ankleAnchor = new THREE.Object3D();
      ankleAnchor.position.set(0, -MECH_L3, 0);
      hockJoint.add(ankleAnchor);

      // World-space foot group (scaled to MECH_SCALE)
      const footGroup = new THREE.Group();
      footGroup.scale.setScalar(MECH_SCALE);
      worldFeetGroup.add(footGroup);

      footGroup.add(
        new THREE.Mesh(
          trackG(new THREE.SphereGeometry(0.24, 14, 12)),
          mats.gunmetalBlueMat,
        ),
      );

      const ankleBoot = new THREE.Mesh(bootGeom, mats.canvasBootMat);
      ankleBoot.scale.set(0.7, 0.7, 0.7);
      ankleBoot.position.set(0, 0.22, 0);
      footGroup.add(ankleBoot);

      const footCore = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.58, 0.2, 0.68)),
        mats.armorMat,
      );
      footCore.position.set(0, -0.14, 0.04);
      footCore.castShadow = footCore.receiveShadow = true;
      footGroup.add(footCore);

      const centralClay = new THREE.Mesh(
        trackG(createSculptedClayGeometry(0.48, 1.05, 0.58, 1.15, side * 3.1)),
        mats.terracottaMudMat,
      );
      centralClay.position.set(0, -0.21, 0.05);
      centralClay.castShadow = centralClay.receiveShadow = true;
      footGroup.add(centralClay);

      const frontToes: THREE.Group[] = [];
      const toeArmorGeom = trackG(new THREE.BoxGeometry(0.21, 0.14, 0.4));
      [-0.21, 0.21].forEach((tx, tIdx) => {
        const toePivot = new THREE.Group();
        toePivot.position.set(tx, -0.16, 0.32);
        footGroup.add(toePivot);

        const toeArmor = new THREE.Mesh(toeArmorGeom, mats.armorMat);
        toeArmor.position.set(0, -0.02, 0.17);
        toeArmor.castShadow = true;
        toePivot.add(toeArmor);

        const toeClay = new THREE.Mesh(
          trackG(
            createSculptedClayGeometry(
              0.23,
              1.05,
              0.62,
              1.35,
              side * 5.2 + tIdx * 2.4,
            ),
          ),
          mats.terracottaMudMat,
        );
        toeClay.position.set(0, -0.08, 0.22);
        toeClay.castShadow = true;
        toePivot.add(toeClay);

        frontToes.push(toePivot);
      });

      const heelPivot = new THREE.Group();
      heelPivot.position.set(0, -0.16, -0.28);
      footGroup.add(heelPivot);

      const heelArmor = new THREE.Mesh(
        trackG(new THREE.BoxGeometry(0.34, 0.14, 0.36)),
        mats.armorMat,
      );
      heelArmor.position.set(0, -0.02, -0.15);
      heelPivot.add(heelArmor);

      const heelClay = new THREE.Mesh(
        trackG(createSculptedClayGeometry(0.26, 1.15, 0.58, 1.2, side * 7.4)),
        mats.terracottaMudMat,
      );
      heelClay.position.set(0, -0.08, -0.18);
      heelClay.castShadow = true;
      heelPivot.add(heelClay);

      const p1Barrel = new THREE.Mesh(pistonBarrelGeom, mats.darkSteelMat);
      const p1Rod = new THREE.Mesh(pistonRodGeom, mats.chromeRodMat);
      const p2Barrel = new THREE.Mesh(pistonBarrelGeom, mats.darkSteelMat);
      const p2Rod = new THREE.Mesh(pistonRodGeom, mats.chromeRodMat);
      worldFeetGroup.add(p1Barrel, p1Rod, p2Barrel, p2Rod);

      const latW = side * 1.48 * MECH_SCALE;
      const initX = MECH_SPAWN.x + latW * cosSpawn;
      const initZ = MECH_SPAWN.z - latW * sinSpawn;
      const initSurf = getWalkableSurfaceY(initX, initZ);
      const initWorld = new THREE.Vector3(
        initX,
        initSurf.y + MECH_SOLE_HEIGHT * MECH_SCALE,
        initZ,
      );
      footGroup.position.copy(initWorld);

      legs.push({
        side,
        hipAnchor,
        hipJoint,
        kneeJoint,
        hockJoint,
        ankleAnchor,
        footGroup,
        hipBoot,
        ankleBoot,
        frontToes,
        heelPivot,
        pistons: [
          { a: p1A, b: p1B, barrel: p1Barrel, rod: p1Rod },
          { a: p2A, b: p2B, barrel: p2Barrel, rod: p2Rod },
        ],
        plantedWorld: initWorld.clone(),
        stepStartWorld: initWorld.clone(),
        stepEndWorld: initWorld.clone(),
        currentAnkleWorld: initWorld.clone(),
        wasSwing: false,
        footPitch: 0,
        footRoll: 0,
      });
    });

    // Shared particle geometries
    const dustGeom = trackG(new THREE.SphereGeometry(0.18, 6, 6));
    const shellGeom = trackG(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6));
    const tracerGeom = trackG(new THREE.CylinderGeometry(0.065, 0.036, 2.8, 6));
    tracerGeom.rotateX(Math.PI / 2);

    // Low-poly 8-triangle gravel/pebble InstancedMesh pool (single draw call)
    const pebbleGeom = trackG(new THREE.OctahedronGeometry(0.135, 0));
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: true,
    });
    disposableMats.push(pebbleMat);
    const kickupMesh = new THREE.InstancedMesh(pebbleGeom, pebbleMat, KICKUP_POOL_SIZE);
    kickupMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    kickupMesh.frustumCulled = false;
    kickupMesh.castShadow = false;
    kickupMesh.receiveShadow = true;

    const stonePalette = [
      new THREE.Color(0x9e8971),
      new THREE.Color(0x857869),
      new THREE.Color(0xb6956f),
      new THREE.Color(0x6b645c),
      new THREE.Color(0x937b5f),
    ];
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < KICKUP_POOL_SIZE; i++) {
      kickupMesh.setMatrixAt(i, zeroMat);
      kickupMesh.setColorAt(i, stonePalette[i % stonePalette.length]);
    }
    kickupMesh.instanceMatrix.needsUpdate = true;
    if (kickupMesh.instanceColor) kickupMesh.instanceColor.needsUpdate = true;
    worldFeetGroup.add(kickupMesh);

    return {
      root,
      worldFeetGroup,
      pelvisGroup,
      turretPivot,
      mtoBlock,
      mtoGrille,
      mtoBaseY,
      mtoGrilleBaseY,
      exhaustTips,
      exhaustPipes,
      grabRails,
      antennaSegments,
      gunBarrels,
      dynamicAmmoBelts,
      legs,
      dustGeom,
      shellGeom,
      tracerGeom,
      kickupMesh,
      dispose: () => {
        kickupMesh.dispose();
        disposableGeoms.forEach((g) => g.dispose());
        disposableMats.forEach((m) => m.dispose());
      },
    };
}
export type MechRig = ReturnType<typeof buildMechModel>;
