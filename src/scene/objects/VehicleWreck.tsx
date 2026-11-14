export interface VehicleWreckProps {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Scorched combat vehicle / mech hull wreckage for low-profile flank cover
 * and tactical environmental storytelling in contested forest passes.
 */
export function VehicleWreck({
  position,
  rotationY = 0,
  scale = 1,
}: VehicleWreckProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Half-buried scorched armor chassis */}
      <mesh position={[0, 0.35, 0]} rotation={[0.08, 0, -0.14]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.72, 2.8]} />
        <meshStandardMaterial color="#3d3833" roughness={0.88} metalness={0.32} />
      </mesh>

      {/* Rusted track / leg sponson */}
      <mesh position={[-0.9, 0.24, 0.1]} rotation={[0.08, 0.12, -0.18]} castShadow>
        <boxGeometry args={[0.42, 0.5, 2.55]} />
        <meshStandardMaterial color="#272523" roughness={0.92} metalness={0.28} />
      </mesh>

      {/* Soot-blackened engine deck */}
      <mesh position={[0.1, 0.7, -0.65]} rotation={[0.08, 0.08, -0.14]} castShadow>
        <boxGeometry args={[1.35, 0.24, 1.0]} />
        <meshStandardMaterial color="#1f1e1d" roughness={0.95} metalness={0.18} />
      </mesh>

      {/* Blown-off tilted turret / upper torso shell lying beside hull */}
      <mesh position={[1.15, 0.34, 0.55]} rotation={[0.32, 0.85, 0.42]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.55, 1.3]} />
        <meshStandardMaterial color="#4a433b" roughness={0.82} metalness={0.38} />
      </mesh>

      {/* Snapped barrel / structural spar */}
      <mesh position={[1.55, 0.52, 1.35]} rotation={[1.25, 0.3, -0.45]} castShadow>
        <cylinderGeometry args={[0.08, 0.11, 1.6, 7]} />
        <meshStandardMaterial color="#2c2d2b" roughness={0.62} metalness={0.62} />
      </mesh>
    </group>
  );
}
