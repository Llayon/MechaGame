import { useSceneSimulation } from '../SceneSimulation';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  BRIDGE_SPECS,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  SCALE_X,
  SCALE_Z,
  getBridgeDeckYAt,
  getTerrainHeight,
} from '../../map/terrainMath';

const _vPos = new THREE.Vector3();
const _vNext = new THREE.Vector3();

export interface PatrolConvoyProps {
  visible: boolean;
  isSoftwareGl: boolean;
}

export function PatrolConvoy({ visible, isSoftwareGl }: PatrolConvoyProps) {
  const unit1Ref = useRef<THREE.Group>(null);
  const unit2Ref = useRef<THREE.Group>(null);

  const centerPatrolCurve = useMemo(() => {
    const bridge = BRIDGE_SPECS[1];
    const pts = [
      [-109, 86],
      [-92, 60],
      [bridge.start[0], bridge.start[1]],
      [(bridge.start[0] + bridge.end[0]) * 0.5, (bridge.start[1] + bridge.end[1]) * 0.5],
      [bridge.end[0], bridge.end[1]],
      [-10.0, 3.0],
      [bridge.end[0], bridge.end[1]],
      [(bridge.start[0] + bridge.end[0]) * 0.5, (bridge.start[1] + bridge.end[1]) * 0.5],
      [bridge.start[0], bridge.start[1]],
      [-92, 60],
    ].map(([x, z]) => {
      const bridgeY = getBridgeDeckYAt(bridge, x, z);
      const y = bridgeY !== null ? bridgeY : getTerrainHeight(x, z) + 0.16;
      return new THREE.Vector3(x, y, z);
    });
    return new THREE.CatmullRomCurve3(pts, true);
  }, []);

  const eastPatrolCurve = useMemo(() => {
    const bridge = BRIDGE_SPECS[2];
    const pts = [
      [-56, 86],
      [-12, 94],
      [24, 78],
      [bridge.start[0], bridge.start[1]],
      [(bridge.start[0] + bridge.end[0]) * 0.5, (bridge.start[1] + bridge.end[1]) * 0.5],
      [bridge.end[0], bridge.end[1]],
      [QUARRY_CENTER_X - 4.0, QUARRY_CENTER_Z],
      [bridge.end[0], bridge.end[1]],
      [(bridge.start[0] + bridge.end[0]) * 0.5, (bridge.start[1] + bridge.end[1]) * 0.5],
      [bridge.start[0], bridge.start[1]],
      [24, 78],
      [-12, 94],
    ].map(([x, z]) => {
      const bridgeY = getBridgeDeckYAt(bridge, x, z);
      const y = bridgeY !== null ? bridgeY : getTerrainHeight(x, z) + 0.16;
      return new THREE.Vector3(x, y, z);
    });
    return new THREE.CatmullRomCurve3(pts, true);
  }, []);

  const { paused, clockRef } = useSceneSimulation();

  useFrame((state) => {
    if (paused) return;
    if (!visible) return;
    const t = clockRef.current.elapsed;

    const u1 = ((isSoftwareGl ? 0.28 : t * 0.022) % 1 + 1) % 1;
    centerPatrolCurve.getPointAt(u1, _vPos);
    centerPatrolCurve.getPointAt((u1 + 0.01) % 1, _vNext);
    if (unit1Ref.current) {
      unit1Ref.current.position.copy(_vPos);
      unit1Ref.current.lookAt(_vNext.x, _vPos.y, _vNext.z);
    }

    const u2 = ((isSoftwareGl ? 0.42 : t * 0.018 + 0.35) % 1 + 1) % 1;
    eastPatrolCurve.getPointAt(u2, _vPos);
    eastPatrolCurve.getPointAt((u2 + 0.01) % 1, _vNext);
    if (unit2Ref.current) {
      unit2Ref.current.position.copy(_vPos);
      unit2Ref.current.lookAt(_vNext.x, _vPos.y, _vNext.z);
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Center Bridge Armored Patrol APC (1.35x small scale vs 33.8 m bridge) */}
      <group
        ref={unit1Ref}
        position={[
          (BRIDGE_SPECS[1].start[0] + BRIDGE_SPECS[1].end[0]) * 0.5,
          BRIDGE_SPECS[1].deckY + 0.52,
          (BRIDGE_SPECS[1].start[1] + BRIDGE_SPECS[1].end[1]) * 0.5,
        ]}
        scale={1.35}
      >
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.56, 0.24, 1.1]} />
          <meshStandardMaterial color="#585f4b" roughness={0.62} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.34, -0.05]} castShadow>
          <boxGeometry args={[0.36, 0.14, 0.42]} />
          <meshStandardMaterial color="#4a5040" roughness={0.55} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.36, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.52, 6]} />
          <meshStandardMaterial color="#30332e" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* East Bridge Supply Truck (1.35x small scale vs 31.5 m bridge) */}
      <group
        ref={unit2Ref}
        position={[
          (BRIDGE_SPECS[2].start[0] + BRIDGE_SPECS[2].end[0]) * 0.5,
          BRIDGE_SPECS[2].deckY + 0.52,
          (BRIDGE_SPECS[2].start[1] + BRIDGE_SPECS[2].end[1]) * 0.5,
        ]}
        scale={1.35}
      >
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.52, 0.28, 1.05]} />
          <meshStandardMaterial color="#616655" roughness={0.68} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.26, 0.34]} castShadow>
          <boxGeometry args={[0.48, 0.22, 0.32]} />
          <meshStandardMaterial color="#484d42" roughness={0.6} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}
