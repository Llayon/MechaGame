import { getInteriorWindowMaterial } from '../visualPolish';

export interface DerrickTowerProps {
  position: [number, number, number];
}

export function DerrickTower({ position }: DerrickTowerProps) {
  return (
    <group position={position}>
      {/* 4 tapered corner steel columns */}
      {[
        [-0.45, -0.45, 0.09, -0.09],
        [0.45, -0.45, -0.09, -0.09],
        [-0.45, 0.45, 0.09, 0.09],
        [0.45, 0.45, -0.09, 0.09],
      ].map(([lx, lz, rz, rx], i) => (
        <mesh key={i} position={[lx * 0.72, 2.65, lz * 0.72]} rotation={[rx, 0, rz]} castShadow>
          <boxGeometry args={[0.11, 5.4, 0.11]} />
          <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.65} />
        </mesh>
      ))}
      {/* Horizontal lattice tiers */}
      {[1.1, 2.3, 3.5, 4.6, 5.2].map((ty, i) => {
        const s = 1.05 - i * 0.12;
        return (
          <mesh key={i} position={[0, ty, 0]} castShadow>
            <boxGeometry args={[s, 0.09, s]} />
            <meshStandardMaterial color="#616B76" roughness={0.52} metalness={0.62} />
          </mesh>
        );
      })}
      {/* Crane operator cab & jib boom */}
      <mesh position={[0, 5.45, 0]} castShadow>
        <boxGeometry args={[0.72, 0.45, 0.72]} />
        <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.28} />
      </mesh>
      <mesh position={[0, 5.5, 0]} material={getInteriorWindowMaterial()}>
        <boxGeometry args={[0.76, 0.18, 0.76]} />
      </mesh>
      <mesh position={[0.95, 5.85, -0.45]} rotation={[0.25, -0.4, -0.35]} castShadow>
        <boxGeometry args={[2.6, 0.14, 0.16]} />
        <meshStandardMaterial color="#525B66" roughness={0.52} metalness={0.68} />
      </mesh>
    </group>
  );
}
