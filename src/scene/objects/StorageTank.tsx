export interface StorageTankProps {
  position: [number, number, number];
  radius: number;
  height: number;
  color?: string;
}

export function StorageTank({
  position,
  radius,
  height,
  color = '#8F5642',
}: StorageTankProps) {
  return (
    <group position={position}>
      <mesh position={[0, height * 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 14]} />
        <meshStandardMaterial color={color} roughness={0.65} metalness={0.22} />
      </mesh>
      <mesh position={[0, height + 0.05, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.9, radius, 0.1, 14]} />
        <meshStandardMaterial color="#525B66" roughness={0.65} metalness={0.4} />
      </mesh>
    </group>
  );
}
