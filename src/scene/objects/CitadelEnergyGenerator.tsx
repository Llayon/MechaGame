import { useMemo } from 'react';
import { getCheckerboardShadowMaterial } from '../surfaceDetail';

export interface CitadelEnergyGeneratorProps {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Low-profile armored Citadel courtyard energy generator (~1.8 units = ~6.75 m tall)
 * with twin capacitor drums, terracotta blast shields, and glowing #00E5FF containment coils.
 */
export function CitadelEnergyGenerator({
  position,
  rotationY = 0,
  scale = 1,
}: CitadelEnergyGeneratorProps) {
  const energyShadowMat = useMemo(() => getCheckerboardShadowMaterial('lattice50'), []);

  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      {/* Concrete foundation pad */}
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.8, 0.32, 4.6]} />
        <meshStandardMaterial color="#8E959B" roughness={0.82} metalness={0.06} />
      </mesh>

      {/* Twin armored capacitor drums */}
      {[-1.55, 1.55].map((cx, idx) => (
        <group key={idx} position={[cx, 0.32, 0]}>
          <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.05, 1.15, 1.25, 12]} />
            <meshStandardMaterial color="#525B66" roughness={0.52} metalness={0.58} />
          </mesh>
          <mesh position={[0, 1.38, 0]} castShadow>
            <cylinderGeometry args={[0.88, 1.04, 0.24, 12]} />
            <meshStandardMaterial color="#374049" roughness={0.48} metalness={0.65} />
          </mesh>
          {/* Ice-cyan plasma containment ring */}
          <mesh position={[0, 0.85, 0]} castShadow customDepthMaterial={energyShadowMat}>
            <cylinderGeometry args={[1.14, 1.14, 0.18, 12]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.95}
              toneMapped={false}
              roughness={0.18}
            />
          </mesh>
        </group>
      ))}

      {/* Central transformer manifold bridge */}
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.15, 2.1]} />
        <meshStandardMaterial color="#454E58" roughness={0.56} metalness={0.55} />
      </mesh>
      <mesh position={[0, 1.56, 0]} castShadow>
        <boxGeometry args={[4.4, 0.24, 1.4]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Front & rear angled terracotta blast shielding skirts */}
      {[-1, 1].map((zSign) => (
        <mesh
          key={`shield-${zSign}`}
          position={[0, 0.72, zSign * 1.72]}
          rotation={[zSign * -0.18, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[5.8, 0.95, 0.36]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.24} />
        </mesh>
      ))}

      {/* Side radiator cooling fin ribs */}
      {[-2.85, 2.85].map((sx, sIdx) => (
        <mesh key={`fin-${sIdx}`} position={[sx, 0.74, 0]} castShadow>
          <boxGeometry args={[0.38, 0.96, 2.8]} />
          <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.12} />
        </mesh>
      ))}
    </group>
  );
}
