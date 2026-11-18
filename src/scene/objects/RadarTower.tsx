import { useSceneSimulation } from '../SceneSimulation';
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface RadarTowerProps {
  position: [number, number, number];
  isSoftwareGl: boolean;
}

export function RadarTower({ position, isSoftwareGl }: RadarTowerProps) {
  const radarRef = useRef<THREE.Group>(null);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (isSoftwareGl) return;
    if (radarRef.current) {
      radarRef.current.rotation.y += delta * 0.65;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.28, 2.3, 6]} />
        <meshStandardMaterial color="#42484c" roughness={0.45} metalness={0.7} />
      </mesh>
      <group userData={{ lodDynamic: true }} ref={radarRef} position={[0, 2.45, 0]}>
        <mesh rotation={[0.55, 0, 0]} castShadow>
          <cylinderGeometry args={[0.72, 0.14, 0.28, 14]} />
          <meshStandardMaterial color="#8b9296" roughness={0.35} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.18, 0.2]} castShadow>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <meshStandardMaterial color="#2a2d30" roughness={0.4} metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
