import { useMemo } from 'react';
import { getOvergrownConcreteMaterial } from './concreteMaterials';

export interface CitadelCourtyardBunkerProps {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Low-profile reinforced concrete Citadel courtyard bunker (6.2-6.6 m tall = ~1.7 units)
 * providing hull-down firing cover during final fortress courtyard engagements.
 */
export function CitadelCourtyardBunker({
  position,
  rotationY = 0,
  scale = 1,
}: CitadelCourtyardBunkerProps) {
  const concreteMain = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'wall', { roughness: 0.82, metalness: 0.08 }), []);
  const concreteApron = useMemo(() => getOvergrownConcreteMaterial('#868D93', 'wall', { roughness: 0.85, metalness: 0.05 }), []);
  const concreteTrim = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'wall', { roughness: 0.82, metalness: 0.06 }), []);

  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      {/* Heavy concrete slab apron */}
      <mesh position={[0, 0.16, 0]} material={concreteApron} castShadow receiveShadow>
        <boxGeometry args={[7.4, 0.32, 5.2]} />
      </mesh>

      {/* Lower sloped armored concrete casemate */}
      <mesh position={[0, 0.72, 0]} material={concreteMain} castShadow receiveShadow>
        <boxGeometry args={[6.2, 0.85, 4.0]} />
      </mesh>

      {/* Recessed dark ballistic firing embrasure band */}
      <mesh position={[0, 1.24, 0.14]}>
        <boxGeometry args={[5.5, 0.24, 3.55]} />
        <meshStandardMaterial color="#1d2224" roughness={0.62} metalness={0.38} />
      </mesh>

      {/* Heavy overhanging reinforced blast roof (~1.7 units = ~6.4 m peak) */}
      <mesh position={[0, 1.52, 0]} material={concreteMain} castShadow receiveShadow>
        <boxGeometry args={[6.6, 0.36, 4.4]} />
      </mesh>

      {/* Roof armored ventilation cupola & terracotta warning trim */}
      <mesh position={[-1.4, 1.78, -0.4]} castShadow>
        <cylinderGeometry args={[0.55, 0.68, 0.22, 8]} />
        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[1.4, 1.78, -0.4]} castShadow>
        <cylinderGeometry args={[0.45, 0.56, 0.22, 8]} />
        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 2.02]} castShadow>
        <boxGeometry args={[5.2, 0.18, 0.1]} />
        <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
      </mesh>

      {/* Flanking concrete blast cheek walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 3.55, 0.68, 1.1]}
          rotation={[0, side * -0.42, 0]}
          material={concreteTrim}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.65, 1.15, 0.72]} />
        </mesh>
      ))}
    </group>
  );
}
