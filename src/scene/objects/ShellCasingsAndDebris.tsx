import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { effectVisible } from '../../lod/worldLod';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';
import { combatAudio } from '../../game/combatAudio';
import {
  MAX_DEBRIS_INSTANCES,
  getBallisticSlotVisualFactor,
  resetBallisticPropPool,
  stepBallisticPropPool,
  type BallisticPropPool,
  type BallisticStepEvents,
} from './debrisBallisticsPool';
import { spawnWaterImpact, type WaterVfxPoolState } from './waterVfxPool';

export interface ShellCasingsAndDebrisProps {
  casingMesh: THREE.InstancedMesh;
  hideEmptyCasings: boolean;
  casingsPoolRef: React.MutableRefObject<BallisticPropPool>;
  debrisPoolRef: React.MutableRefObject<BallisticPropPool>;
  waterVfxPoolRef?: React.MutableRefObject<WaterVfxPoolState>;
  resetNonce: number;
}

const _pos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _normQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _layFlatQuat = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  Math.PI * 0.5,
);
const _upAxis = new THREE.Vector3(0, 1, 0);
const _normalVec = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);
const _color = new THREE.Color();

const _casingEvents: BallisticStepEvents = {
  dryBouncedCasings: 0,
  heavyDryBounce: false,
  waterImpactX: 0,
  waterImpactZ: 0,
  hasWaterImpact: false,
};

const _debrisEvents: BallisticStepEvents = {
  dryBouncedCasings: 0,
  heavyDryBounce: false,
  waterImpactX: 0,
  waterImpactZ: 0,
  hasWaterImpact: false,
};

/**
 * Faceted jagged armor plate shard geometry for combat impacts & explosions.
 */
function createArmorDebrisGeometry(): THREE.BufferGeometry {
  const shard = new THREE.DodecahedronGeometry(0.16, 0);
  const pos = shard.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const shear = (vx * 1.4 - vz * 0.9) * 0.28;
    pos.setXYZ(i, vx * 1.35 + shear, vy * 0.34, vz * 0.95 - shear * 0.6);
  }
  shard.computeVertexNormals();
  return shard;
}

function syncPoolToInstancedMesh(
  pool: BallisticPropPool,
  mesh: THREE.InstancedMesh,
  layFlatOnRest: boolean,
  camera: THREE.Camera,
): void {
  const slots = pool.slots;
  let count = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s.active) continue;

    const { coolT, shrinkScale } = getBallisticSlotVisualFactor(s);
    const effScale = s.scale * shrinkScale;
    if (effScale <= 0.005 || !effectVisible(camera, s.x, s.y, s.z, effScale, 1.5)) continue;

    _pos.set(s.x, s.y, s.z);
    if (s.resting) {
      _normalVec.set(s.nx, s.ny, s.nz).normalize();
      _normQuat.setFromUnitVectors(_upAxis, _normalVec);
      _yawQuat.setFromAxisAngle(_upAxis, s.restYaw);
      _quat.copy(_normQuat).multiply(_yawQuat);
      if (layFlatOnRest) {
        _quat.multiply(_layFlatQuat);
      }
    } else {
      _euler.set(s.rx, s.ry, s.rz);
      _quat.setFromEuler(_euler);
    }

    _scaleVec.setScalar(effScale);
    _mat4.compose(_pos, _quat, _scaleVec);
    mesh.setMatrixAt(count, _mat4);

    _color.setRGB(
      s.hotR + (s.coolR - s.hotR) * coolT,
      s.hotG + (s.coolG - s.hotG) * coolT,
      s.hotB + (s.coolB - s.hotB) * coolT,
    );
    mesh.setColorAt(count++, _color);
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function ShellCasingsAndDebris({
  casingMesh,
  hideEmptyCasings,
  casingsPoolRef,
  debrisPoolRef,
  waterVfxPoolRef,
  resetNonce,
}: ShellCasingsAndDebrisProps) {
  const { paused } = useSceneSimulation();
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveCasingsRef = useRef(false);
  const hadActiveDebrisRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const debrisGeom = createArmorDebrisGeometry();

    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.68,
      flatShading: true,
    });

    return { debrisGeom, debrisMat };
  }, []);

  useEffect(() => {
    const dMesh = debrisMeshRef.current;
    if (dMesh) {
      dMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_DEBRIS_INSTANCES; i++) {
        dMesh.setMatrixAt(i, _zeroMat4);
        dMesh.setColorAt(i, _color.setHex(0x3a3734));
      }
      dMesh.instanceMatrix.needsUpdate = true;
      if (dMesh.instanceColor) dMesh.instanceColor.needsUpdate = true;
    }

    return () => {
      setup.debrisGeom.dispose();
      setup.debrisMat.dispose();
    };
  }, [setup]);
  const hideEmptyDebris = useMeshShaderWarmup(debrisMeshRef);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetBallisticPropPool(casingsPoolRef.current);
    resetBallisticPropPool(debrisPoolRef.current);
    hadActiveCasingsRef.current = true;
    hadActiveDebrisRef.current = true;
  }, [resetNonce, casingsPoolRef, debrisPoolRef]);

  useFrame(({camera}, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const waterPool = waterVfxPoolRef?.current;

    // 1) Shell Casings InstancedMesh (1 Draw Call)
    const cPool = casingsPoolRef.current;
    if (cPool.activeCount > 0 || hadActiveCasingsRef.current || cPool.dirty) {
      const remCasings = stepBallisticPropPool(cPool, dt, _casingEvents);
      if (_casingEvents.dryBouncedCasings > 0) {
        combatAudio.playShellClink(_casingEvents.heavyDryBounce);
      }
      if (_casingEvents.hasWaterImpact && waterPool) {
        spawnWaterImpact(
          waterPool,
          _casingEvents.waterImpactX,
          _casingEvents.waterImpactZ,
          0.35,
          { splash: false },
        );
      }
      if (cPool.dirty || remCasings > 0 || hadActiveCasingsRef.current) {
        syncPoolToInstancedMesh(cPool, casingMesh, true, camera);
        casingMesh.visible = !hideEmptyCasings || casingMesh.count > 0;
        cPool.dirty = false;
      }
      hadActiveCasingsRef.current = remCasings > 0;
    }

    // 2) Armor Debris InstancedMesh (1 Draw Call)
    const dPool = debrisPoolRef.current;
    const dMesh = debrisMeshRef.current;
    if (dMesh && (dPool.activeCount > 0 || hadActiveDebrisRef.current || dPool.dirty)) {
      const remDebris = stepBallisticPropPool(dPool, dt, _debrisEvents);
      if (_debrisEvents.hasWaterImpact && waterPool) {
        spawnWaterImpact(
          waterPool,
          _debrisEvents.waterImpactX,
          _debrisEvents.waterImpactZ,
          0.55,
          { splash: true, countScale: 0.45 },
        );
      }
      if (dPool.dirty || remDebris > 0 || hadActiveDebrisRef.current) {
        syncPoolToInstancedMesh(dPool, dMesh, false, camera);
        dMesh.visible = !hideEmptyDebris || dMesh.count > 0;
        dPool.dirty = false;
      }
      hadActiveDebrisRef.current = remDebris > 0;
    }
  });

  return (
    <>
      <primitive object={casingMesh} visible={!hideEmptyCasings} />
      <instancedMesh
        ref={debrisMeshRef}
        name="armor-debris-pool"
        visible={!hideEmptyDebris}
        count={0}
        args={[setup.debrisGeom, setup.debrisMat, MAX_DEBRIS_INSTANCES]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow
      />
    </>
  );
}
