import * as THREE from 'three';

export interface RefineryHallProps {
  position: [number, number, number];
  corrugatedMap: THREE.Texture;
}

export function RefineryHall({ position, corrugatedMap }: RefineryHallProps) {
  return (
    <group position={position}>
      {/* Main terracotta-ochre & steel processing building */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.7, 1.9]} />
        <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.14} />
      </mesh>
      {/* Corrugated steel roof */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[2.55, 0.32, 2.02]} />
        <meshStandardMaterial
          color="#525B66"
          roughness={0.65}
          metalness={0.35}
          bumpMap={corrugatedMap}
          bumpScale={0.025}
        />
      </mesh>
      {/* Twin tall rusted industrial smokestacks */}
      {[-0.65, 0.35].map((sx, idx) => (
        <group key={idx} position={[sx, 2.0, -0.55]}>
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.24, 2.3, 12]} />
            <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
          </mesh>
          <mesh position={[0, 2.35, 0]} castShadow>
            <cylinderGeometry args={[0.19, 0.18, 0.22, 12]} />
            <meshStandardMaterial color="#333940" roughness={0.55} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
