export interface BridgeArchPylonProps {
  position: [number, number, number];
  span: number;
  clearHeight?: number;
  pillarWidth?: number;
  depth?: number;
}

/**
 * Massive reinforced concrete bridge arch-pylon framing 40-50 m span sections,
 * providing Mech shoulder-level side cover while leaving the central deck passable.
 */
export function BridgeArchPylon({
  position,
  span,
  clearHeight = 5.4,
  pillarWidth = 1.15,
  depth = 1.65,
}: BridgeArchPylonProps) {
  const sideX = span * 0.5 - pillarWidth * 0.35;

  return (
    <group position={position}>
      {/* Left & right massive concrete arch piers */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * sideX, 0, 0]}>
          {/* Main upright pier shaft */}
          <mesh position={[0, clearHeight * 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[pillarWidth, clearHeight, depth]} />
            <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
          </mesh>
          {/* Lower armored jersey-shoulder plinth */}
          <mesh position={[-side * 0.35, 1.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.95, 2.7, depth + 0.3]} />
            <meshStandardMaterial color="#8E959B" roughness={0.8} metalness={0.06} />
          </mesh>
          {/* Ice-cyan navigational marker strip on inner shoulder */}
          <mesh position={[-side * 0.84, 2.15, 0]}>
            <boxGeometry args={[0.1, 1.05, depth * 0.62]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.55}
              toneMapped={false}
              roughness={0.2}
            />
          </mesh>
          {/* Diagonal arch haunch bracing into overhead beam */}
          <mesh
            position={[-side * 0.65, clearHeight - 0.65, 0]}
            rotation={[0, 0, side * 0.68]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.7, 1.8, depth * 0.86]} />
            <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
          </mesh>
        </group>
      ))}

      {/* Overhead concrete arch crown beam */}
      <mesh position={[0, clearHeight + 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[span + pillarWidth * 0.6, 0.95, depth + 0.25]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
      </mesh>
      {/* Ice-cyan crown beacon bar */}
      {[-1, 1].map((zFace) => (
        <mesh key={zFace} position={[0, clearHeight + 0.45, zFace * (depth * 0.5 + 0.15)]}>
          <boxGeometry args={[span * 0.58, 0.14, 0.08]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={1.85}
            toneMapped={false}
            roughness={0.2}
          />
        </mesh>
      ))}
      {/* Upper structural steel stiffening cap */}
      <mesh position={[0, clearHeight + 1.0, 0]} castShadow>
        <boxGeometry args={[span + pillarWidth * 0.8, 0.22, depth * 0.72]} />
        <meshStandardMaterial color="#525B66" roughness={0.6} metalness={0.45} />
      </mesh>
    </group>
  );
}
