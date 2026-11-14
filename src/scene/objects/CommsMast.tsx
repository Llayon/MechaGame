export interface CommsMastProps {
  position: [number, number, number];
  beaconLit: boolean;
}

export function CommsMast({ position, beaconLit }: CommsMastProps) {
  return (
    <group position={position}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.14, 3.1, 6]} />
        <meshStandardMaterial color="#4d5458" roughness={0.45} metalness={0.75} />
      </mesh>
      <mesh position={[0, 3.15, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          color="#e6533c"
          emissive="#ff4d30"
          emissiveIntensity={beaconLit ? 2.2 : 0.6}
        />
      </mesh>
    </group>
  );
}
