import * as THREE from 'three';

export interface QuonsetHangarProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  length?: number;
  height?: number;
  color?: string;
  roughness?: number;
  corrugatedMap: THREE.Texture;
}

export function QuonsetHangar({
  position,
  rotationY = 0,
  width = 1.6,
  length = 2.8,
  height = 1.05,
  color = '#9BA1A6',
  roughness = 0.8,
  corrugatedMap,
}: QuonsetHangarProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Concrete foundation apron */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[width + 0.25, 0.1, length + 0.25]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
      </mesh>
      {/* Half-cylinder barrel vault (rotated -PI/2 around X so +Z arcs upward to +Y) */}
      <mesh
        position={[0, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width * 0.5, length, height]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 1, 16, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial
          color={color}
          roughness={roughness}
          metalness={0.18}
          bumpMap={corrugatedMap}
          bumpScale={0.035}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Front & back recessed hangar doors */}
      <mesh position={[0, height * 0.42, length * 0.5 + 0.01]} castShadow>
        <boxGeometry args={[width * 0.68, height * 0.72, 0.06]} />
        <meshStandardMaterial color="#2f3538" roughness={0.65} metalness={0.4} />
      </mesh>
      <mesh position={[0, height * 0.42, -length * 0.5 - 0.01]} castShadow>
        <boxGeometry args={[width * 0.68, height * 0.72, 0.06]} />
        <meshStandardMaterial color="#2f3538" roughness={0.65} metalness={0.4} />
      </mesh>
    </group>
  );
}
