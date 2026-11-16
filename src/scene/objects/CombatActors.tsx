import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ENEMY_CONFIGS } from '../../game/combatSimulation';
import type { CombatSimulationState, EnemyUnitState } from '../../game/combatTypes';
import {
  MAX_CRATER_DECALS,
  createCraterDecalMaterial,
  createCraterPool,
  resetCraterPool,
  spawnCraterDecal,
  type CraterPoolState,
} from './craterPool';

const MAX_PROJECTILE_INSTANCES = 40;
const MAX_SPARK_PARTICLES = 96;
const MAX_PICKUP_INSTANCES = 12;
const MAX_HEAVY_BEAMS = 4;
const MAX_BARRELS = 8;

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
  r: number;
  g: number;
  b: number;
}

interface EnemyVisualNode {
  root: THREE.Group;
  hullGroup: THREE.Group;
  turretGroup: THREE.Group;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  laserBeam?: THREE.Mesh;
  armorMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  baseEmissive: THREE.Color;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _vFrom = new THREE.Vector3();
const _vTo = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _qRot = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);

export interface CombatActorsProps {
  combatRef: React.MutableRefObject<CombatSimulationState>;
  driveMode: boolean;
  isSoftwareGl: boolean;
}

export function CombatActors({
  combatRef,
  driveMode,
  isSoftwareGl,
}: CombatActorsProps) {
  const enemiesGroupRef = useRef<THREE.Group>(null);
  const projectileMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null);
  const pickupCrateMeshRef = useRef<THREE.InstancedMesh>(null);
  const pickupCoreMeshRef = useRef<THREE.InstancedMesh>(null);
  const heavyBeamMeshRef = useRef<THREE.InstancedMesh>(null);
  const barrelBodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const barrelBandMeshRef = useRef<THREE.InstancedMesh>(null);
  const craterMeshRef = useRef<THREE.InstancedMesh>(null);
  const lockRingRef = useRef<THREE.Mesh>(null);

  const visualNodesRef = useRef<Map<string, EnemyVisualNode>>(new Map());
  const createEnemyNodeRef = useRef<((enemy: EnemyUnitState) => EnemyVisualNode) | null>(null);
  const sparksRef = useRef<SparkParticle[]>(
    Array.from({ length: MAX_SPARK_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.4,
      baseScale: 0.3,
      r: 1,
      g: 0.6,
      b: 0.2,
    })),
  );
  const sparkCursorRef = useRef(0);
  const craterPoolRef = useRef<CraterPoolState>(createCraterPool(MAX_CRATER_DECALS));
  const craterDirtyRef = useRef(true);
  const prevElapsedRef = useRef(0);

  const sharedGeoms = useMemo(() => {
    const shadowDisc = new THREE.CircleGeometry(1, 20);
    shadowDisc.rotateX(-Math.PI / 2);

    const apcHull = new THREE.BoxGeometry(1.25, 0.56, 2.3);
    const apcGlacis = new THREE.BoxGeometry(1.18, 0.34, 0.65);
    const apcWheel = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
    apcWheel.rotateZ(Math.PI / 2);
    const apcTurret = new THREE.CylinderGeometry(0.45, 0.56, 0.34, 8);
    const apcBarrel = new THREE.CylinderGeometry(0.055, 0.075, 1.35, 6);
    apcBarrel.rotateX(Math.PI / 2);

    const turretBase = new THREE.CylinderGeometry(1.45, 1.72, 1.15, 8);
    const turretCollar = new THREE.CylinderGeometry(1.18, 1.32, 0.32, 8);
    const turretDome = new THREE.BoxGeometry(1.75, 0.86, 1.85);
    const turretBarrel = new THREE.CylinderGeometry(0.09, 0.12, 1.85, 8);
    turretBarrel.rotateX(Math.PI / 2);
    const turretVisor = new THREE.BoxGeometry(0.95, 0.22, 0.16);
    const laserGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);

    const walkerPelvis = new THREE.BoxGeometry(1.35, 0.65, 1.15);
    const walkerLeg = new THREE.BoxGeometry(0.38, 1.35, 0.48);
    const walkerFoot = new THREE.BoxGeometry(0.56, 0.22, 0.78);
    const walkerTorso = new THREE.BoxGeometry(1.75, 1.1, 1.48);
    const walkerShield = new THREE.BoxGeometry(1.55, 0.92, 0.24);
    const walkerPod = new THREE.BoxGeometry(0.48, 0.54, 1.1);
    const walkerVisor = new THREE.BoxGeometry(1.05, 0.22, 0.16);

    const projGeom = new THREE.CylinderGeometry(0.09, 0.13, 1.5, 6);
    const sparkGeom = new THREE.IcosahedronGeometry(0.26, 0);
    const lockRingGeom = new THREE.RingGeometry(1.9, 2.28, 28);
    lockRingGeom.rotateX(-Math.PI / 2);

    const pickupCrateGeom = new THREE.BoxGeometry(1.15, 0.72, 1.15);
    const pickupCoreGeom = new THREE.OctahedronGeometry(0.36, 0);
    const heavyBeamGeom = new THREE.CylinderGeometry(0.16, 0.22, 1.0, 8);
    const barrelBodyGeom = new THREE.CylinderGeometry(0.62, 0.68, 1.8, 10);
    const barrelBandGeom = new THREE.CylinderGeometry(0.69, 0.69, 0.24, 10);
    const craterGeom = new THREE.PlaneGeometry(2, 2);
    craterGeom.rotateX(-Math.PI / 2);

    return {
      shadowDisc,
      apcHull,
      apcGlacis,
      apcWheel,
      apcTurret,
      apcBarrel,
      turretBase,
      turretCollar,
      turretDome,
      turretBarrel,
      turretVisor,
      laserGeom,
      walkerPelvis,
      walkerLeg,
      walkerFoot,
      walkerTorso,
      walkerShield,
      walkerPod,
      walkerVisor,
      projGeom,
      sparkGeom,
      lockRingGeom,
      pickupCrateGeom,
      pickupCoreGeom,
      heavyBeamGeom,
      barrelBodyGeom,
      barrelBandGeom,
      craterGeom,
    };
  }, []);

  const sharedMats = useMemo(() => {
    const darkSteel = new THREE.MeshStandardMaterial({
      color: '#252b31',
      roughness: 0.45,
      metalness: 0.65,
    });
    const concrete = new THREE.MeshStandardMaterial({
      color: '#6b7278',
      roughness: 0.85,
      metalness: 0.08,
    });
    const shadow = new THREE.MeshBasicMaterial({
      color: '#060a0e',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const laser = new THREE.MeshBasicMaterial({
      color: '#ff3b30',
      transparent: true,
      opacity: 0.78,
      toneMapped: false,
      depthWrite: false,
    });
    const proj = new THREE.MeshBasicMaterial({
      color: '#ff6a2b',
      toneMapped: false,
    });
    const spark = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      toneMapped: false,
    });
    const lockRing = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.75,
      toneMapped: false,
      depthWrite: false,
    });
    const pickupCrate = new THREE.MeshStandardMaterial({
      color: '#1e3a34',
      roughness: 0.45,
      metalness: 0.55,
    });
    const pickupCore = new THREE.MeshBasicMaterial({
      color: '#34d399',
      toneMapped: false,
    });
    const heavyBeam = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
      depthWrite: false,
    });
    const barrelBody = new THREE.MeshStandardMaterial({
      color: '#b91c1c',
      roughness: 0.42,
      metalness: 0.48,
    });
    const barrelBand = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      toneMapped: false,
    });
    const craterMat = createCraterDecalMaterial();
    return {
      darkSteel,
      concrete,
      shadow,
      laser,
      proj,
      spark,
      lockRing,
      pickupCrate,
      pickupCore,
      heavyBeam,
      barrelBody,
      barrelBand,
      craterMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(sharedGeoms).forEach((g) => g.dispose());
      Object.values(sharedMats).forEach((m) => m.dispose());
    };
  }, [sharedGeoms, sharedMats]);

  // Build composite 3-10 part 3D models per enemy once and sync imperatively
  useEffect(() => {
    const container = enemiesGroupRef.current;
    if (!container) return;

    const nodes = new Map<string, EnemyVisualNode>();
    const enemies = combatRef.current.enemies;

    const createNode = (enemy: EnemyUnitState): EnemyVisualNode => {
      const root = new THREE.Group();
      const hullGroup = new THREE.Group();
      const turretGroup = new THREE.Group();
      root.add(hullGroup);

      const baseHex =
        enemy.archetype === 'scout-apc'
          ? '#8e4033'
          : enemy.archetype === 'denial-turret'
            ? '#646e78'
            : '#8a2f2b';
      const baseColor = new THREE.Color(baseHex);
      const baseEmissive = new THREE.Color('#000000');

      const armorMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.58,
        metalness: 0.34,
        emissive: baseEmissive,
        emissiveIntensity: 0,
      });

      const eyeMat = new THREE.MeshStandardMaterial({
        color: '#ff4b3a',
        emissive: '#ff3b28',
        emissiveIntensity: 1.75,
        roughness: 0.2,
        toneMapped: false,
      });

      // Contact shadow disc
      const shadowScale = enemy.archetype === 'denial-turret' ? 2.2 : 1.7;
      const shadowMesh = new THREE.Mesh(sharedGeoms.shadowDisc, sharedMats.shadow);
      shadowMesh.position.y = 0.03;
      shadowMesh.scale.setScalar(shadowScale);
      root.add(shadowMesh);

      let leftLeg: THREE.Group | undefined;
      let rightLeg: THREE.Group | undefined;
      let laserBeam: THREE.Mesh | undefined;

      if (enemy.archetype === 'scout-apc') {
        const hull = new THREE.Mesh(sharedGeoms.apcHull, armorMat);
        hull.position.y = 0.55;
        hull.castShadow = hull.receiveShadow = true;
        hullGroup.add(hull);

        const glacis = new THREE.Mesh(sharedGeoms.apcGlacis, armorMat);
        glacis.position.set(0, 0.52, 1.18);
        glacis.rotation.x = 0.35;
        glacis.castShadow = true;
        hullGroup.add(glacis);

        for (let sx = -1; sx <= 1; sx += 2) {
          for (let wz = -0.82; wz <= 0.85; wz += 0.82) {
            const w = new THREE.Mesh(sharedGeoms.apcWheel, sharedMats.darkSteel);
            w.position.set(sx * 0.68, 0.32, wz);
            w.castShadow = true;
            hullGroup.add(w);
          }
        }

        turretGroup.position.set(0, 0.96, 0.05);
        const dome = new THREE.Mesh(sharedGeoms.apcTurret, armorMat);
        dome.castShadow = true;
        turretGroup.add(dome);

        const barrel = new THREE.Mesh(sharedGeoms.apcBarrel, sharedMats.darkSteel);
        barrel.position.set(0, 0.04, 0.82);
        barrel.castShadow = true;
        turretGroup.add(barrel);

        const optic = new THREE.Mesh(sharedGeoms.turretVisor, eyeMat);
        optic.scale.set(0.38, 0.6, 0.9);
        optic.position.set(0, 0.08, 0.52);
        turretGroup.add(optic);

        hullGroup.add(turretGroup);
      } else if (enemy.archetype === 'denial-turret') {
        const base = new THREE.Mesh(sharedGeoms.turretBase, sharedMats.concrete);
        base.position.y = 0.56;
        base.castShadow = base.receiveShadow = true;
        hullGroup.add(base);

        const collar = new THREE.Mesh(sharedGeoms.turretCollar, sharedMats.darkSteel);
        collar.position.y = 1.18;
        collar.castShadow = true;
        hullGroup.add(collar);

        turretGroup.position.set(0, 1.65, 0);
        const dome = new THREE.Mesh(sharedGeoms.turretDome, armorMat);
        dome.castShadow = dome.receiveShadow = true;
        turretGroup.add(dome);

        for (let sx = -0.36; sx <= 0.36; sx += 0.72) {
          const barrel = new THREE.Mesh(sharedGeoms.turretBarrel, sharedMats.darkSteel);
          barrel.position.set(sx, 0.04, 1.12);
          barrel.castShadow = true;
          turretGroup.add(barrel);
        }

        const visor = new THREE.Mesh(sharedGeoms.turretVisor, eyeMat);
        visor.position.set(0, 0.24, 0.94);
        turretGroup.add(visor);

        laserBeam = new THREE.Mesh(sharedGeoms.laserGeom, sharedMats.laser);
        laserBeam.visible = false;
        container.add(laserBeam);

        hullGroup.add(turretGroup);
      } else {
        // charger-walker
        leftLeg = new THREE.Group();
        leftLeg.position.set(-0.56, 1.32, 0);
        const legMeshL = new THREE.Mesh(sharedGeoms.walkerLeg, sharedMats.darkSteel);
        legMeshL.position.y = -0.62;
        legMeshL.castShadow = true;
        leftLeg.add(legMeshL);
        const footL = new THREE.Mesh(sharedGeoms.walkerFoot, armorMat);
        footL.position.set(0, -1.24, 0.14);
        footL.castShadow = true;
        leftLeg.add(footL);
        hullGroup.add(leftLeg);

        rightLeg = new THREE.Group();
        rightLeg.position.set(0.56, 1.32, 0);
        const legMeshR = new THREE.Mesh(sharedGeoms.walkerLeg, sharedMats.darkSteel);
        legMeshR.position.y = -0.62;
        legMeshR.castShadow = true;
        rightLeg.add(legMeshR);
        const footR = new THREE.Mesh(sharedGeoms.walkerFoot, armorMat);
        footR.position.set(0, -1.24, 0.14);
        footR.castShadow = true;
        rightLeg.add(footR);
        hullGroup.add(rightLeg);

        const pelvis = new THREE.Mesh(sharedGeoms.walkerPelvis, sharedMats.darkSteel);
        pelvis.position.y = 1.48;
        pelvis.castShadow = true;
        hullGroup.add(pelvis);

        turretGroup.position.set(0, 2.15, 0);
        const torso = new THREE.Mesh(sharedGeoms.walkerTorso, armorMat);
        torso.castShadow = torso.receiveShadow = true;
        turretGroup.add(torso);

        const shield = new THREE.Mesh(sharedGeoms.walkerShield, armorMat);
        shield.position.set(0, -0.08, 0.84);
        shield.rotation.x = -0.18;
        shield.castShadow = true;
        turretGroup.add(shield);

        for (let sx = -1; sx <= 1; sx += 2) {
          const pod = new THREE.Mesh(sharedGeoms.walkerPod, sharedMats.darkSteel);
          pod.position.set(sx * 1.1, 0.25, 0.24);
          pod.castShadow = true;
          turretGroup.add(pod);
        }

        const visor = new THREE.Mesh(sharedGeoms.walkerVisor, eyeMat);
        visor.position.set(0, 0.28, 0.78);
        turretGroup.add(visor);

        hullGroup.add(turretGroup);
      }

      container.add(root);
      return {
        root,
        hullGroup,
        turretGroup,
        leftLeg,
        rightLeg,
        laserBeam,
        armorMat,
        eyeMat,
        baseColor,
        baseEmissive,
      };
    };

    createEnemyNodeRef.current = createNode;
    for (const enemy of enemies) {
      nodes.set(enemy.id, createNode(enemy));
    }
    visualNodesRef.current = nodes;

    return () => {
      createEnemyNodeRef.current = null;
      nodes.forEach((n) => {
        container.remove(n.root);
        if (n.laserBeam) container.remove(n.laserBeam);
        n.armorMat.dispose();
        n.eyeMat.dispose();
      });
      nodes.clear();
    };
  }, [combatRef, sharedGeoms, sharedMats]);

  const spawnBurst = (
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    scale: number,
    r: number,
    g: number,
    b: number,
    maxLife: number,
  ) => {
    const sparks = sparksRef.current;
    for (let i = 0; i < count; i++) {
      const idx = sparkCursorRef.current;
      sparkCursorRef.current = (sparkCursorRef.current + 1) % MAX_SPARK_PARTICLES;
      const sp = sparks[idx];
      const ang = Math.random() * Math.PI * 2;
      const elev = 0.25 + Math.random() * 1.25;
      const spd = speed * (0.45 + Math.random() * 0.8);
      sp.active = true;
      sp.x = x;
      sp.y = y;
      sp.z = z;
      sp.vx = Math.cos(ang) * spd;
      sp.vy = elev * spd * 0.65;
      sp.vz = Math.sin(ang) * spd;
      sp.life = 0;
      sp.maxLife = maxLife * (0.7 + Math.random() * 0.55);
      sp.baseScale = scale * (0.7 + Math.random() * 0.6);
      sp.r = r;
      sp.g = g;
      sp.b = b;
    }
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const combat = combatRef.current;
    const nodes = visualNodesRef.current;
    const container = enemiesGroupRef.current;

    // Register newly deployed reserve enemies or prune reset ones
    if (container && createEnemyNodeRef.current) {
      if (nodes.size !== combat.enemies.length) {
        for (let i = 0; i < combat.enemies.length; i++) {
          const e = combat.enemies[i];
          if (!nodes.has(e.id)) {
            nodes.set(e.id, createEnemyNodeRef.current(e));
          }
        }
        if (nodes.size > combat.enemies.length) {
          const validIds = new Set(combat.enemies.map((e) => e.id));
          nodes.forEach((n, id) => {
            if (!validIds.has(id)) {
              container.remove(n.root);
              if (n.laserBeam) container.remove(n.laserBeam);
              n.armorMat.dispose();
              n.eyeMat.dispose();
              nodes.delete(id);
            }
          });
        }
      }
    }

    if (combat.elapsedSec < prevElapsedRef.current - 0.1) {
      resetCraterPool(craterPoolRef.current);
      craterDirtyRef.current = true;
    }
    prevElapsedRef.current = combat.elapsedSec;

    // Consume pending impact events into pooled sparks & ground crater decals
    while (combat.pendingImpacts.length > 0) {
      const ev = combat.pendingImpacts.shift()!;
      if (ev.kind === 'explosion') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 10 : 22, 8.5, 1.35, 1.0, 0.52, 0.14, 0.55);
        spawnBurst(ev.x, ev.y + 0.3, ev.z, isSoftwareGl ? 6 : 12, 4.5, 1.85, 0.25, 0.25, 0.25, 0.75);
        if (spawnCraterDecal(craterPoolRef.current, ev.x, ev.y, ev.z, 2.4, 1.0, ev.x * 0.7 + ev.z * 0.3)) {
          craterDirtyRef.current = true;
        }
      } else if (ev.kind === 'barrel-explosion') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 14 : 28, 11.2, 1.75, 1.0, 0.44, 0.1, 0.65);
        spawnBurst(ev.x, ev.y + 0.5, ev.z, isSoftwareGl ? 8 : 16, 6.2, 2.15, 0.98, 0.78, 0.22, 0.52);
        spawnBurst(ev.x, ev.y + 0.9, ev.z, isSoftwareGl ? 6 : 10, 3.8, 2.2, 0.22, 0.22, 0.24, 0.85);
        if (spawnCraterDecal(craterPoolRef.current, ev.x, ev.y, ev.z, 3.3, 1.15, ev.x * 1.1 + ev.z * 0.5)) {
          craterDirtyRef.current = true;
        }
      } else if (ev.kind === 'dash') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 6 : 12, 6.8, 0.9, 0.35, 0.88, 1.0, 0.34);
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 4 : 8, 5.2, 0.75, 1.0, 0.62, 0.18, 0.28);
      } else if (ev.kind === 'heavy-hit') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 8 : 16, 7.6, 1.15, 0.45, 0.92, 1.0, 0.42);
      } else if (ev.kind === 'pickup') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 6 : 12, 4.8, 0.85, 0.2, 0.96, 0.58, 0.48);
      } else if (ev.kind === 'armor-hit') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 3 : 6, 5.2, 0.65, 1.0, 0.85, 0.35, 0.28);
      } else if (ev.kind === 'cover-hit') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 2 : 5, 4.0, 0.55, 0.85, 0.78, 0.64, 0.25);
        if (ev.heavy && spawnCraterDecal(craterPoolRef.current, ev.x, ev.y, ev.z, 1.85, 0.92, ev.x * 0.4 + ev.z * 0.9)) {
          craterDirtyRef.current = true;
        }
      } else if (ev.kind === 'player-hit') {
        spawnBurst(ev.x, ev.y, ev.z, isSoftwareGl ? 4 : 8, 5.5, 0.75, 1.0, 0.32, 0.16, 0.32);
      }
    }

    // Sync enemy visual transforms, hit flash, windup telegraphs & KO topples
    let lockedEnemy: EnemyUnitState | null = null;
    let bestLockedDist = Infinity;

    for (let i = 0; i < combat.enemies.length; i++) {
      const e = combat.enemies[i];
      const node = nodes.get(e.id);
      if (!node) continue;

      node.root.position.set(e.x, e.y, e.z);
      node.hullGroup.rotation.y = e.yaw;
      node.turretGroup.rotation.y = e.turretYaw - e.yaw;

      if (e.aiState === 'destroyed') {
        node.hullGroup.rotation.z = 0.58;
        node.hullGroup.rotation.x = 0.22;
        node.hullGroup.position.y = -0.35;
        node.armorMat.color.setHex(0x1f2326);
        node.armorMat.emissive.setHex(0x000000);
        node.armorMat.emissiveIntensity = 0;
        node.eyeMat.emissiveIntensity = 0;
        if (node.laserBeam) node.laserBeam.visible = false;
        continue;
      }

      if (e.aiState === 'ko') {
        const koProgress = 1 - Math.max(0, e.koTimer) / 0.42;
        node.hullGroup.rotation.z = koProgress * 0.58;
        node.hullGroup.rotation.x = koProgress * 0.22;
        node.hullGroup.position.y = -koProgress * 0.35;
        node.armorMat.emissive.setHex(0xff6b2b);
        node.armorMat.emissiveIntensity = (1 - koProgress) * 2.2;
        node.eyeMat.emissiveIntensity = 0;
        if (node.laserBeam) node.laserBeam.visible = false;
        continue;
      }

      // Active enemy pose reset
      node.hullGroup.rotation.z = 0;
      node.hullGroup.rotation.x = 0;
      node.hullGroup.position.y = 0;
      node.armorMat.color.copy(node.baseColor);

      if (e.hitFlashTimer > 0) {
        node.armorMat.emissive.setHex(0xfff1c9);
        node.armorMat.emissiveIntensity = 1.9;
      } else if (e.aiState === 'windup') {
        node.armorMat.emissive.setHex(0xff3b28);
        node.armorMat.emissiveIntensity = 0.55 + Math.sin(combat.elapsedSec * 24) * 0.35;
      } else {
        node.armorMat.emissive.copy(node.baseEmissive);
        node.armorMat.emissiveIntensity = 0;
      }
      node.eyeMat.emissiveIntensity = e.aiState === 'windup' ? 3.2 : 1.75;

      // Charger walker leg stride & windup crouch
      if (node.leftLeg && node.rightLeg) {
        if (e.aiState === 'windup') {
          node.hullGroup.position.y = -0.25;
          node.leftLeg.rotation.x = 0.15;
          node.rightLeg.rotation.x = -0.15;
        } else {
          const stride =
            e.aiState === 'patrol' || e.aiState === 'alert'
              ? Math.sin(combat.elapsedSec * 9.5 + i) * 0.36
              : 0;
          node.leftLeg.rotation.x = stride;
          node.rightLeg.rotation.x = -stride;
        }
      }

      // Denial Turret laser lock beam telegraph during windup
      if (node.laserBeam) {
        if (e.aiState === 'windup' && driveMode) {
          const cfg = ENEMY_CONFIGS[e.archetype];
          _vFrom.set(e.x, e.y + cfg.hitCenterYOffset + 0.24, e.z);
          _vTo.set(e.aimTargetX, e.aimTargetY, e.aimTargetZ);
          _vDir.subVectors(_vTo, _vFrom);
          const len = _vDir.length();
          if (len > 0.5) {
            node.laserBeam.visible = true;
            node.laserBeam.position.copy(_vFrom).addScaledVector(_vDir, 0.5);
            node.laserBeam.scale.set(1, len, 1);
            _vDir.normalize();
            _qRot.setFromUnitVectors(_upAxis, _vDir);
            node.laserBeam.quaternion.copy(_qRot);
          } else {
            node.laserBeam.visible = false;
          }
        } else {
          node.laserBeam.visible = false;
        }
      }

      if (e.hasLineOfSight && e.distToPlayer < bestLockedDist) {
        bestLockedDist = e.distToPlayer;
        lockedEnemy = e;
      }
    }

    // Subtle ground lock ring beneath closest engaged threat
    if (lockRingRef.current) {
      if (driveMode && lockedEnemy && combat.missionStatus === 'playing') {
        lockRingRef.current.visible = true;
        lockRingRef.current.position.set(lockedEnemy.x, lockedEnemy.y + 0.08, lockedEnemy.z);
        lockRingRef.current.rotation.y += dt * 1.4;
      } else {
        lockRingRef.current.visible = false;
      }
    }

    // Update enemy projectiles InstancedMesh (zero allocations)
    const projInst = projectileMeshRef.current;
    if (projInst) {
      let count = 0;
      const projs = combat.projectiles;
      for (let i = 0; i < projs.length && count < MAX_PROJECTILE_INSTANCES; i++) {
        const p = projs[i];
        if (!p.active) continue;
        _dummy.position.set(p.x, p.y, p.z);
        _vDir.set(p.vx, p.vy, p.vz).normalize();
        _qRot.setFromUnitVectors(_upAxis, _vDir);
        _dummy.quaternion.copy(_qRot);
        const s = p.archetype === 'denial-turret' ? 1.45 : 1.05;
        _dummy.scale.set(s, s * 1.4, s);
        _dummy.updateMatrix();
        projInst.setMatrixAt(count, _dummy.matrix);
        count++;
      }
      projInst.count = count;
      projInst.instanceMatrix.needsUpdate = true;
    }

    // Update pooled spark particles InstancedMesh
    const sparkInst = sparkMeshRef.current;
    if (sparkInst) {
      let count = 0;
      const sparks = sparksRef.current;
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        if (!sp.active) continue;
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          sp.active = false;
          continue;
        }
        sp.vy -= 14.0 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        const fade = 1 - sp.life / sp.maxLife;
        _dummy.position.set(sp.x, sp.y, sp.z);
        _dummy.rotation.set(sp.life * 7, sp.life * 5, 0);
        _dummy.scale.setScalar(sp.baseScale * fade);
        _dummy.updateMatrix();
        sparkInst.setMatrixAt(count, _dummy.matrix);
        _color.setRGB(sp.r, sp.g, sp.b);
        sparkInst.setColorAt(count, _color);
        count++;
      }
      sparkInst.count = count;
      sparkInst.instanceMatrix.needsUpdate = true;
      if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
    }

    // Update spinning field supply pickups (InstancedMesh)
    const crateInst = pickupCrateMeshRef.current;
    const coreInst = pickupCoreMeshRef.current;
    if (crateInst && coreInst) {
      let count = 0;
      const t = combat.elapsedSec;
      for (let i = 0; i < combat.pickups.length && count < MAX_PICKUP_INSTANCES; i++) {
        const pk = combat.pickups[i];
        if (pk.collected) continue;
        const bob = Math.sin(t * 2.6 + i * 1.4) * 0.12;
        _dummy.position.set(pk.x, pk.y + 0.42 + bob, pk.z);
        _dummy.rotation.set(0, t * 1.15 + i, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        crateInst.setMatrixAt(count, _dummy.matrix);

        _dummy.position.set(pk.x, pk.y + 1.18 + bob, pk.z);
        _dummy.rotation.set(t * 1.6, t * 2.1 + i, 0);
        _dummy.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.08);
        _dummy.updateMatrix();
        coreInst.setMatrixAt(count, _dummy.matrix);
        count++;
      }
      crateInst.count = count;
      coreInst.count = count;
      crateInst.instanceMatrix.needsUpdate = true;
      coreInst.instanceMatrix.needsUpdate = true;
    }

    // Update 105mm Heavy Cannon beam trails (InstancedMesh)
    const beamInst = heavyBeamMeshRef.current;
    if (beamInst) {
      let count = 0;
      for (let i = 0; i < combat.heavyBeams.length && count < MAX_HEAVY_BEAMS; i++) {
        const b = combat.heavyBeams[i];
        if (b.life <= 0) continue;
        _vFrom.set(b.x0, b.y0, b.z0);
        _vTo.set(b.x1, b.y1, b.z1);
        _vDir.subVectors(_vTo, _vFrom);
        const len = _vDir.length();
        if (len <= 0.1) continue;
        const widthScale = Math.max(0.15, b.life / b.maxLife);
        _dummy.position.copy(_vFrom).addScaledVector(_vDir, 0.5);
        _vDir.normalize();
        _qRot.setFromUnitVectors(_upAxis, _vDir);
        _dummy.quaternion.copy(_qRot);
        _dummy.scale.set(widthScale, len, widthScale);
        _dummy.updateMatrix();
        beamInst.setMatrixAt(count, _dummy.matrix);
        count++;
      }
      beamInst.count = count;
      beamInst.instanceMatrix.needsUpdate = true;
    }

    // Update destructible explosive hazard canisters (InstancedMesh pair)
    const bBodyInst = barrelBodyMeshRef.current;
    const bBandInst = barrelBandMeshRef.current;
    if (bBodyInst && bBandInst) {
      let count = 0;
      const t = combat.elapsedSec;
      for (let i = 0; i < combat.barrels.length && count < MAX_BARRELS; i++) {
        const b = combat.barrels[i];
        if (b.destroyed) continue;
        const hitPulse = b.hitFlashTimer > 0 ? 1.08 : 1.0;
        _dummy.position.set(b.x, b.y + 0.9, b.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(hitPulse, 1, hitPulse);
        _dummy.updateMatrix();
        bBodyInst.setMatrixAt(count, _dummy.matrix);

        const bandScale = 1 + Math.sin(t * 4.5 + i) * 0.04;
        _dummy.position.set(b.x, b.y + 1.15, b.z);
        _dummy.scale.set(bandScale * hitPulse, 1, bandScale * hitPulse);
        _dummy.updateMatrix();
        bBandInst.setMatrixAt(count, _dummy.matrix);
        count++;
      }
      bBodyInst.count = count;
      bBandInst.count = count;
      bBodyInst.instanceMatrix.needsUpdate = true;
      bBandInst.instanceMatrix.needsUpdate = true;
    }

    // Update persistent ground blast crater decals (InstancedMesh, only when dirty)
    const craterInst = craterMeshRef.current;
    if (craterInst && craterDirtyRef.current) {
      let count = 0;
      const decals = craterPoolRef.current.decals;
      for (let i = 0; i < decals.length; i++) {
        const d = decals[i];
        if (!d.active) continue;
        _dummy.position.set(d.x, d.y, d.z);
        _vDir.set(d.nx, d.ny, d.nz).normalize();
        _qRot.setFromUnitVectors(_upAxis, _vDir);
        _qYaw.setFromAxisAngle(_upAxis, d.yaw);
        _dummy.quaternion.copy(_qRot).multiply(_qYaw);
        _dummy.scale.set(d.radius, 1, d.radius);
        _dummy.updateMatrix();
        craterInst.setMatrixAt(count, _dummy.matrix);
        count++;
      }
      craterInst.count = count;
      craterInst.instanceMatrix.needsUpdate = true;
      craterDirtyRef.current = false;
    }
  });

  return (
    <group>
      <group ref={enemiesGroupRef} />
      <mesh
        ref={lockRingRef}
        geometry={sharedGeoms.lockRingGeom}
        material={sharedMats.lockRing}
        visible={false}
      />
      <instancedMesh
        ref={projectileMeshRef}
        args={[sharedGeoms.projGeom, sharedMats.proj, MAX_PROJECTILE_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparkMeshRef}
        args={[sharedGeoms.sparkGeom, sharedMats.spark, MAX_SPARK_PARTICLES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={pickupCrateMeshRef}
        args={[sharedGeoms.pickupCrateGeom, sharedMats.pickupCrate, MAX_PICKUP_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={pickupCoreMeshRef}
        args={[sharedGeoms.pickupCoreGeom, sharedMats.pickupCore, MAX_PICKUP_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={heavyBeamMeshRef}
        args={[sharedGeoms.heavyBeamGeom, sharedMats.heavyBeam, MAX_HEAVY_BEAMS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={barrelBodyMeshRef}
        args={[sharedGeoms.barrelBodyGeom, sharedMats.barrelBody, MAX_BARRELS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={barrelBandMeshRef}
        args={[sharedGeoms.barrelBandGeom, sharedMats.barrelBand, MAX_BARRELS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={craterMeshRef}
        args={[sharedGeoms.craterGeom, sharedMats.craterMat, MAX_CRATER_DECALS]}
        frustumCulled={false}
        receiveShadow
      />
    </group>
  );
}
