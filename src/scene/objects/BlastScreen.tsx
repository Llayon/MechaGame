export interface BlastScreenProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
}

/**
 * Heavy 12-15 m tall armored concrete blast/sniper deflection screen.
 * Built as a composite steel-and-concrete assembly to break elevated Citadel LoS.
 */
export function BlastScreen({
  position,
  rotationY = 0,
  width = 14.0,
  height = 3.8,
}: BlastScreenProps) {
  const buttressCount = Math.max(3, Math.round(width / 4.2));
  const buttressXs = Array.from({ length: buttressCount }, (_, i) => {
    if (buttressCount === 1) return 0;
    return ((i / (buttressCount - 1)) - 0.5) * (width * 0.82);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Reinforced concrete base footing */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.8, 0.5, 1.9]} />
        <meshStandardMaterial color="#8E959B" roughness={0.8} metalness={0.06} />
      </mesh>

      {/* Main sloped concrete ballistic shield wall */}
      <mesh position={[0, height * 0.5 + 0.2, 0]} rotation={[0.07, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.95]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
      </mesh>

      {/* Steel top parapet cap & terracotta/amber visor strip */}
      <mesh position={[0, height + 0.26, -0.1]} castShadow>
        <boxGeometry args={[width + 0.3, 0.34, 1.15]} />
        <meshStandardMaterial color="#525B66" roughness={0.6} metalness={0.45} />
      </mesh>
      <mesh position={[0, height * 0.78, 0.44]} castShadow>
        <boxGeometry args={[width * 0.94, 0.26, 0.12]} />
        <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
      </mesh>

      {/* Heavy steel rear I-beam buttress ribs */}
      {buttressXs.map((bx, idx) => (
        <group key={idx} position={[bx, 0.3, -0.58]}>
          <mesh position={[0, height * 0.46, 0]} rotation={[0.18, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.45, height * 0.96, 0.72]} />
            <meshStandardMaterial color="#49525C" roughness={0.55} metalness={0.58} />
          </mesh>
          <mesh position={[0, 0.25, -0.42]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.5, 0.9]} />
            <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
