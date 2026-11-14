export interface GantryCraneProps {
  position: [number, number, number];
  rotationY?: number;
  span?: number;
  height?: number;
  depth?: number;
}

/**
 * Industrial 15-18 m tall portal gantry crane with clear span underneath for Mechs
 * and suspended heavy cargo/baffle module to break long-range sniper sightlines.
 */
export function GantryCrane({
  position,
  rotationY = 0,
  span = 11.5,
  height = 5.6,
  depth = 5.6,
}: GantryCraneProps) {
  const halfSpan = span * 0.5;
  const halfDepth = depth * 0.5;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Twin base crane rail beams */}
      {[-halfSpan, halfSpan].map((lx, idx) => (
        <mesh key={idx} position={[lx, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.4, depth + 1.4]} />
          <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
        </mesh>
      ))}

      {/* 4 heavy portal steel legs */}
      {[
        [-halfSpan, -halfDepth],
        [halfSpan, -halfDepth],
        [-halfSpan, halfDepth],
        [halfSpan, halfDepth],
      ].map(([lx, lz], idx) => (
        <mesh key={idx} position={[lx, height * 0.5 + 0.15, lz]} castShadow receiveShadow>
          <boxGeometry args={[0.62, height, 0.62]} />
          <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.55} />
        </mesh>
      ))}

      {/* Side horizontal brace beams */}
      {[-halfSpan, halfSpan].map((lx, idx) => (
        <mesh key={idx} position={[lx, height * 0.55, 0]} castShadow>
          <boxGeometry args={[0.38, 0.38, depth]} />
          <meshStandardMaterial color="#464F59" roughness={0.55} metalness={0.58} />
        </mesh>
      ))}

      {/* Upper double-girder bridge beam + terracotta ochre machinery housing */}
      {[-0.9, 0.9].map((gz, idx) => (
        <mesh key={idx} position={[0, height + 0.28, gz]} castShadow receiveShadow>
          <boxGeometry args={[span + 2.6, 0.78, 0.66]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.9, 0]} castShadow>
        <boxGeometry args={[3.8, 0.72, 2.7]} />
        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.55} />
      </mesh>

      {/* Suspended armored hoist block / ballast shield breaking horizontal LoS (bottom >= 14.5 m clear) */}
      {[-1.3, 1.3].map((cx, idx) => (
        <mesh key={idx} position={[cx, height - 0.35, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.1, 6]} />
          <meshStandardMaterial color="#2c333b" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, height - 1.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 1.4, 2.1]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.18} />
      </mesh>
    </group>
  );
}
