export interface CargoContainerProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  length?: number;
  height?: number;
  color?: string;
  stacked?: boolean;
}

/**
 * Heavy armored shipping container barricade (5.4 m single / 10.5 m stacked)
 * breaking long-range bridge and courtyard sightlines.
 */
export function CargoContainer({
  position,
  rotationY = 0,
  width = 1.6,
  length = 3.6,
  height = 1.45,
  color = '#8F5642',
  stacked = false,
}: CargoContainerProps) {
  const renderBox = (yBase: number, boxColor: string, yawOffset = 0, zShift = 0) => (
    <group position={[0, yBase, zShift]} rotation={[0, yawOffset, 0]}>
      {/* Main container shell */}
      <mesh position={[0, height * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial color={boxColor} roughness={0.65} metalness={0.22} />
      </mesh>
      {/* Structural corner frame rails */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[sx * (width * 0.48), height * 0.5, sz * (length * 0.48)]}
            castShadow
          >
            <boxGeometry args={[0.14, height + 0.04, 0.14]} />
            <meshStandardMaterial color="#3c444d" roughness={0.6} metalness={0.45} />
          </mesh>
        )),
      )}
      {/* Corrugated rib pilasters along sides */}
      {[-0.3, 0, 0.3].map((f, idx) => (
        <mesh
          key={idx}
          position={[0, height * 0.5, f * length]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width + 0.06, height * 0.82, 0.18]} />
          <meshStandardMaterial color={boxColor} roughness={0.65} metalness={0.25} />
        </mesh>
      ))}
      {/* Tactical hazard stripe band */}
      <mesh position={[0, height * 0.84, 0]}>
        <boxGeometry args={[width + 0.04, 0.14, length * 0.86]} />
        <meshStandardMaterial color="#c48a4e" roughness={0.65} metalness={0.18} />
      </mesh>
    </group>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {renderBox(0, color)}
      {stacked && renderBox(height, '#7A4837', 0.08, 0.12)}
    </group>
  );
}
