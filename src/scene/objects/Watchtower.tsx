import { LightingPreset } from '../../map/sectors';
import { getInteriorWindowMaterial } from '../visualPolish';

export interface WatchtowerProps {
  position: [number, number, number];
  lightingPreset: LightingPreset;
}

export function Watchtower({ position, lightingPreset }: WatchtowerProps) {
  const lampOn = lightingPreset === 'night' || lightingPreset === 'dusk';

  return (
    <group position={position}>
      {/* Concrete plinth */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.3, 0.95]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* 4 corner steel legs */}
      {[
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 1.0, lz]} castShadow>
          <boxGeometry args={[0.08, 1.6, 0.08]} />
          <meshStandardMaterial color="#525B66" roughness={0.62} metalness={0.48} />
        </mesh>
      ))}
      {/* Mid platform */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.68, 0.07, 0.68]} />
        <meshStandardMaterial color="#8E959B" roughness={0.8} metalness={0.18} />
      </mesh>
      {/* Armored cab */}
      <mesh position={[0, 1.98, 0]} castShadow>
        <boxGeometry args={[0.88, 0.58, 0.88]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Glass window band with 3D Interior Mapping parallax */}
      <mesh position={[0, 2.04, 0]} material={getInteriorWindowMaterial()}>
        <boxGeometry args={[0.91, 0.16, 0.91]} />
      </mesh>
      {/* Roof cap & beacon */}
      <mesh position={[0, 2.34, 0]} castShadow>
        <boxGeometry args={[1.04, 0.12, 1.04]} />
        <meshStandardMaterial color="#525B66" roughness={0.65} metalness={0.4} />
      </mesh>
      <mesh position={[0, 2.52, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.28, 8]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive={lampOn ? '#00E5FF' : '#004855'}
          emissiveIntensity={lampOn ? 1.55 : 0.25}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}
