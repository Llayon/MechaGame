import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CombatSimulationState } from '../../game/combatTypes';
import type { InfantrySkirmishes } from '../../game/infantrySkirmishes';
import { getInfantryPose } from '../../game/infantryPose';
import { useSceneSimulation } from '../SceneSimulation';
import { loadInfantryRig } from './infantryRig';

const friendly = new THREE.Color('#7bc9e4');
const hostile = new THREE.Color('#f09a69');
const friendlyTrace = new THREE.Color('#8ceeff');
const hostileTrace = new THREE.Color('#ff9250');
const spotterColor = new THREE.Color('#ffbe52');
const designatingColor = new THREE.Color('#ff392f');
const modelDistance = 65;
const tracerDuration = .15;

/** At overview distance a soldier occupies only a few pixels. Keep a posed silhouette there. */
function silhouetteGeometry() {
  const block = (x: number, y: number, z: number, w: number, h: number, d: number) =>
    new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const pieces = [
    block(0, .302, 0, .178, .18, .10), block(0, .432, .012, .107, .096, .107),
    block(-.05, .11, .03, .062, .22, .072), block(.05, .11, -.026, .062, .22, .072),
    block(0, .302, -.074, .14, .13, .08),
    block(-.072, .32, .052, .05, .057, .14), block(.075, .325, .04, .052, .067, .13),
    block(.054, .344, .142, .035, .035, .255),
  ];
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

function createCrowd(capacity: number) {
  const group = new THREE.Group();
  const proxyMaterial = new THREE.MeshLambertMaterial();
  const proxies = new THREE.InstancedMesh(silhouetteGeometry(), proxyMaterial, capacity);
  proxies.name = 'Infantry · distant formations';
  proxies.count = 0;
  proxies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  proxies.frustumCulled = false;
  const lines = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const colors = new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage);
  lines.setAttribute('position', positions);
  lines.setAttribute('color', colors);
  lines.setDrawRange(0, 0);
  const tracerMaterial = new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, depthWrite: false });
  const tracers = new THREE.LineSegments(lines, tracerMaterial);
  tracers.frustumCulled = false;
  tracers.name = 'Infantry · rifle tracers';
  // A hollow diamond catches the light above the radio operator, even in the overview.
  const diamond = new THREE.RingGeometry(.76, 1, 4);
  const markerMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const markers = new THREE.InstancedMesh(diamond, markerMaterial, capacity);
  markers.name = 'Infantry · enemy spotters';
  markers.count = 0;
  markers.frustumCulled = false;
  markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrix = new THREE.Matrix4();
  const markerScale = new THREE.Vector3();
  const crouchProxy = new THREE.Matrix4().makeScale(1, 2 / 3, 1).setPosition(-.025, 0, .05);
  let rig: Awaited<ReturnType<typeof loadInfantryRig>> | undefined;
  let disposed = false;
  group.add(proxies, tracers, markers);
  return {
    group,
    async load() {
      const loaded = await loadInfantryRig(capacity);
      if (disposed) { loaded.dispose(); return; }
      rig = loaded;
      group.add(rig.root);
    },
    draw(state: InfantrySkirmishes, camera: THREE.Camera) {
      let nearCount = 0, farCount = 0, vertices = 0, spotters = 0;
      for (const soldier of state.soldiers) {
        if (soldier.hp <= 0) continue;
        const { x, y, z, yaw } = soldier;
        const distanceSq = (camera.position.x - x) ** 2 + (camera.position.y - y) ** 2 + (camera.position.z - z) ** 2;
        const ally = soldier.side === 'friendly';
        const color = ally ? friendly : hostile;
        const pose = getInfantryPose(soldier, state.elapsed);
        matrix.makeRotationY(yaw).setPosition(x, y, z);
        if (rig && distanceSq < modelDistance ** 2) rig.set(nearCount++, soldier, pose, state.elapsed, matrix, color);
        else {
          if (pose === 'crouch') matrix.multiply(crouchProxy);
          proxies.setMatrixAt(farCount, matrix);
          proxies.setColorAt(farCount++, color);
        }
        if (soldier.role === 'spotter') {
          const pulse = soldier.designating ? 1.2 + .2 * Math.sin(state.elapsed * 8) : 1;
          const size = THREE.MathUtils.clamp(Math.sqrt(distanceSq) * .003, .13, 1.1) * pulse;
          matrix.makeRotationFromQuaternion(camera.quaternion).scale(markerScale.setScalar(size)).setPosition(x, y + .65 + size, z);
          markers.setMatrixAt(spotters, matrix);
          markers.setColorAt(spotters++, soldier.designating ? designatingColor : spotterColor);
        }
        const flight = (state.elapsed - soldier.lastShotAt) / tracerDuration;
        if (flight < 0 || flight >= 1) continue;
        const sx = x + Math.sin(yaw) * .27, sy = y + .35, sz = z + Math.cos(yaw) * .27;
        const dx = soldier.shotTargetX - sx, dy = soldier.shotTargetY - sy, dz = soldier.shotTargetZ - sz;
        const head = Math.min(1, flight + .30);
        positions.setXYZ(vertices, sx + dx * flight, sy + dy * flight, sz + dz * flight);
        positions.setXYZ(vertices + 1, sx + dx * head, sy + dy * head, sz + dz * head);
        const light = ally ? friendlyTrace : hostileTrace;
        colors.setXYZ(vertices, light.r * .5, light.g * .5, light.b * .5);
        colors.setXYZ(vertices + 1, light.r, light.g, light.b);
        vertices += 2;
      }
      rig?.flush(nearCount);
      proxies.count = farCount;
      proxies.instanceMatrix.needsUpdate = true;
      if (proxies.instanceColor) proxies.instanceColor.needsUpdate = true;
      markers.count = spotters;
      markers.instanceMatrix.needsUpdate = true;
      if (markers.instanceColor) markers.instanceColor.needsUpdate = true;
      positions.needsUpdate = colors.needsUpdate = vertices > 0;
      lines.setDrawRange(0, vertices);
    },
    dispose() {
      disposed = true;
      rig?.dispose();
      proxies.dispose();
      proxies.geometry.dispose();
      proxyMaterial.dispose();
      lines.dispose();
      tracerMaterial.dispose();
      markers.dispose();
      diamond.dispose();
      markerMaterial.dispose();
    },
  };
}

export function InfantryActors({ combatRef, visible }: { combatRef: RefObject<CombatSimulationState>; visible: boolean }) {
  const container = useRef<THREE.Group>(null);
  const crowd = useRef<ReturnType<typeof createCrowd> | null>(null);
  const { invalidate, camera } = useThree();
  const { paused } = useSceneSimulation();
  useEffect(() => {
    const parent = container.current!;
    const next = createCrowd(combatRef.current.infantry.soldiers.length);
    parent.add(next.group);
    crowd.current = next;
    next.draw(combatRef.current.infantry, camera);
    void next.load().then(() => {
      if (crowd.current !== next) return;
      next.draw(combatRef.current.infantry, camera);
      invalidate();
    }).catch(error => console.warn('Infantry model unavailable, using formation silhouettes.', error));
    return () => {
      crowd.current = null;
      parent.remove(next.group);
      next.dispose();
    };
  }, [camera, combatRef, invalidate]);
  useFrame(() => {
    if (paused) return;
    if (visible) crowd.current?.draw(combatRef.current.infantry, camera);
  });
  return <group ref={container} name="perf:infantry" visible={visible} />;
}
