import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import {
  BEACON_BACK_OFFSET,
  HUB_FORWARD_OFFSET,
  TOWER_BEACON_HEIGHT,
  TOWER_HUB_HEIGHT,
  createWindTurbineBeaconGeometry,
  createWindTurbineRotorGeometry,
  createWindTurbineTowerGeometry,
  generateWindTurbinesData,
} from '../../map/windTurbines';

export interface WindTurbinesProps {
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
}

const _pos = new THREE.Vector3();
const _hubOffset = new THREE.Vector3();
const _beaconOffset = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _towerQuat = new THREE.Quaternion();
const _spinQuat = new THREE.Quaternion();
const _rotorQuat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _color = new THREE.Color();
const _zAxis = new THREE.Vector3(0, 0, 1);

const BEACON_BASE_INTENSITY: Record<LightingPreset, number> = {
  day: 0.72,
  dusk: 1.45,
  night: 1.75,
};

interface CachedTurbineRig {
  hubPos: THREE.Vector3;
  towerQuat: THREE.Quaternion;
  scaleVec: THREE.Vector3;
  phase: number;
  speed: number;
  beaconPhase: number;
}

/**
 * Giant Old-World wind turbines mounted on outer mountain ridge crests.
 * Rendered in 3 batched InstancedMesh Draw Calls (towers/nacelles, rotating 3-blade hubs,
 * and pulsing aviation obstruction beacons) with zero shadow-pass overhead.
 */
export function WindTurbines({ lightingPreset, isSoftwareGl }: WindTurbinesProps) {
  const towerMeshRef = useRef<THREE.InstancedMesh>(null);
  const rotorMeshRef = useRef<THREE.InstancedMesh>(null);
  const beaconMeshRef = useRef<THREE.InstancedMesh>(null);

  const turbines = useMemo(() => generateWindTurbinesData(), []);
  const towerGeo = useMemo(() => createWindTurbineTowerGeometry(), []);
  const rotorGeo = useMemo(() => createWindTurbineRotorGeometry(), []);
  const beaconGeo = useMemo(() => createWindTurbineBeaconGeometry(), []);

  const towerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.24,
        flatShading: true,
        fog: true,
      }),
    [],
  );

  const rotorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0.16,
        flatShading: true,
        fog: true,
      }),
    [],
  );

  const beaconMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        toneMapped: false,
        fog: true,
      }),
    [],
  );

  const rigsRef = useRef<CachedTurbineRig[]>([]);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const towerMesh = towerMeshRef.current;
    const rotorMesh = rotorMeshRef.current;
    const beaconMesh = beaconMeshRef.current;
    if (!towerMesh || !rotorMesh || !beaconMesh) return;

    const rigs: CachedTurbineRig[] = [];
    const baseGain = BEACON_BASE_INTENSITY[lightingPreset];

    for (let i = 0; i < turbines.length; i++) {
      const t = turbines[i];
      _pos.set(t.x, t.groundY, t.z);
      _euler.set(t.tiltX, t.yawY, t.tiltZ, 'YXZ');
      _towerQuat.setFromEuler(_euler);
      _scale.set(t.scale, t.scale, t.scale);

      // 1. Tower + concrete ridge anchor + nacelle matrix
      _mat.compose(_pos, _towerQuat, _scale);
      towerMesh.setMatrixAt(i, _mat);

      // 2. Hub pivot world position derived from tower transform
      _hubOffset
        .set(0, TOWER_HUB_HEIGHT, HUB_FORWARD_OFFSET)
        .multiplyScalar(t.scale)
        .applyQuaternion(_towerQuat)
        .add(_pos);

      _spinQuat.setFromAxisAngle(_zAxis, t.initialPhase);
      _rotorQuat.multiplyQuaternions(_towerQuat, _spinQuat);
      _mat.compose(_hubOffset, _rotorQuat, _scale);
      rotorMesh.setMatrixAt(i, _mat);

      // 3. Nacelle tail aviation warning beacon
      _beaconOffset
        .set(0, TOWER_BEACON_HEIGHT, BEACON_BACK_OFFSET)
        .multiplyScalar(t.scale)
        .applyQuaternion(_towerQuat)
        .add(_pos);
      _mat.compose(_beaconOffset, _towerQuat, _scale);
      beaconMesh.setMatrixAt(i, _mat);

      const isWorking = Math.abs(t.angularSpeed) > 0.01;
      const pulse = isWorking
        ? 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t.beaconPhase), 2.5)
        : 0.14;
      _color.setRGB(
        1.0 * baseGain * pulse,
        0.18 * baseGain * pulse,
        0.1 * baseGain * pulse,
      );
      beaconMesh.setColorAt(i, _color);

      rigs.push({
        hubPos: _hubOffset.clone(),
        towerQuat: _towerQuat.clone(),
        scaleVec: _scale.clone(),
        phase: t.initialPhase,
        speed: t.angularSpeed,
        beaconPhase: t.beaconPhase,
      });
    }

    rigsRef.current = rigs;
    elapsedRef.current = 0;
    towerMesh.instanceMatrix.needsUpdate = true;
    rotorMesh.instanceMatrix.needsUpdate = true;
    beaconMesh.instanceMatrix.needsUpdate = true;
    if (beaconMesh.instanceColor) beaconMesh.instanceColor.needsUpdate = true;
  }, [turbines, lightingPreset]);

  useEffect(() => {
    return () => {
      towerGeo.dispose();
      rotorGeo.dispose();
      beaconGeo.dispose();
      towerMat.dispose();
      rotorMat.dispose();
      beaconMat.dispose();
    };
  }, [towerGeo, rotorGeo, beaconGeo, towerMat, rotorMat, beaconMat]);

  useFrame((_, delta) => {
    if (isSoftwareGl) return;
    const rotorMesh = rotorMeshRef.current;
    const beaconMesh = beaconMeshRef.current;
    const rigs = rigsRef.current;
    if (!rotorMesh || !beaconMesh || rigs.length === 0) return;

    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;
    const t = elapsedRef.current;
    const baseGain = BEACON_BASE_INTENSITY[lightingPreset];
    let rotorDirty = false;

    for (let i = 0; i < rigs.length; i++) {
      const rig = rigs[i];
      const isWorking = Math.abs(rig.speed) > 0.01;
      if (isWorking) {
        rig.phase = (rig.phase + rig.speed * dt) % (Math.PI * 2);
        _spinQuat.setFromAxisAngle(_zAxis, rig.phase);
        _rotorQuat.multiplyQuaternions(rig.towerQuat, _spinQuat);
        _mat.compose(rig.hubPos, _rotorQuat, rig.scaleVec);
        rotorMesh.setMatrixAt(i, _mat);
        rotorDirty = true;
      }

      const pulse = isWorking
        ? 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + rig.beaconPhase), 3.0)
        : 0.12 + 0.08 * Math.max(0, Math.sin(t * 7.5 + rig.beaconPhase));
      _color.setRGB(
        1.0 * baseGain * pulse,
        0.18 * baseGain * pulse,
        0.1 * baseGain * pulse,
      );
      beaconMesh.setColorAt(i, _color);
    }

    if (rotorDirty) rotorMesh.instanceMatrix.needsUpdate = true;
    if (beaconMesh.instanceColor) beaconMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={towerMeshRef}
        args={[towerGeo, towerMat, turbines.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      <instancedMesh
        ref={rotorMeshRef}
        args={[rotorGeo, rotorMat, turbines.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      <instancedMesh
        ref={beaconMeshRef}
        args={[beaconGeo, beaconMat, turbines.length]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}
