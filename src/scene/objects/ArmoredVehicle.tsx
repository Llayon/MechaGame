export interface ArmoredVehicleProps {
  position: [number, number, number];
  rotationY?: number;
  color?: string;
  hasCannon?: boolean;
}

export function ArmoredVehicle({
  position,
  rotationY = 0,
  color = '#525748',
  hasCannon = true,
}: ArmoredVehicleProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Left & right tracks */}
      <mesh position={[-0.36, 0.14, 0]} castShadow>
        <boxGeometry args={[0.18, 0.24, 1.25]} />
        <meshStandardMaterial color="#232523" roughness={0.85} metalness={0.25} />
      </mesh>
      <mesh position={[0.36, 0.14, 0]} castShadow>
        <boxGeometry args={[0.18, 0.24, 1.25]} />
        <meshStandardMaterial color="#232523" roughness={0.85} metalness={0.25} />
      </mesh>
      {/* Main armored hull */}
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.26, 1.32]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.2} />
      </mesh>
      {/* Turret */}
      <mesh position={[0, 0.46, -0.05]} castShadow>
        <boxGeometry args={[0.46, 0.19, 0.56]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.28} />
      </mesh>
      {/* Cannon barrel or commander hatch */}
      {hasCannon ? (
        <mesh position={[0, 0.47, 0.54]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.038, 0.78, 8]} />
          <meshStandardMaterial color="#323530" roughness={0.4} metalness={0.65} />
        </mesh>
      ) : (
        <mesh position={[0, 0.57, 0.05]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.06, 8]} />
          <meshStandardMaterial color="#2d302b" roughness={0.5} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
}
