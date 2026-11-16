import { useMemo } from 'react';
import { getOvergrownConcreteMaterial } from './concreteMaterials';

export interface BunkerPillboxProps {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Reinforced concrete flank pillbox (ДОТ) sized for 8-14 m Mech hull-down cover
 * (~10 m tall, ~21 m footprint with armored firing slit and wing walls).
 */
export function BunkerPillbox({
  position,
  rotationY = 0,
  scale = 1,
}: BunkerPillboxProps) {
  const concreteMain = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'wall', { roughness: 0.82, metalness: 0.08 }), []);
  const concreteFoot = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'wall', { roughness: 0.84, metalness: 0.06 }), []);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Concrete foundation apron */}
      <mesh position={[0, 0.25, 0]} material={concreteFoot} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.6, 0.6, 6]} />
      </mesh>

      {/* Lower armored hexagonal casemate body */}
      <mesh position={[0, 1.15, 0]} material={concreteMain} castShadow receiveShadow>
        <cylinderGeometry args={[2.55, 2.95, 1.3, 6]} />
      </mesh>

      {/* Dark recessed firing embrasure band */}
      <mesh position={[0, 1.92, 0.15]}>
        <cylinderGeometry args={[2.38, 2.48, 0.32, 6]} />
        <meshStandardMaterial color="#1d2224" roughness={0.65} metalness={0.35} />
      </mesh>

      {/* Heavy overhanging concrete blast roof slab */}
      <mesh position={[0, 2.28, 0]} material={concreteMain} castShadow receiveShadow>
        <cylinderGeometry args={[2.7, 2.95, 0.48, 6]} />
      </mesh>

      {/* Armored cupola & short comms antenna */}
      <mesh position={[-0.4, 2.66, -0.35]} castShadow>
        <cylinderGeometry args={[0.72, 0.85, 0.34, 8]} />
        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0.9, 3.05, -0.6]}>
        <cylinderGeometry args={[0.04, 0.06, 1.3, 5]} />
        <meshStandardMaterial color="#374049" roughness={0.45} metalness={0.7} />
      </mesh>

      {/* Flanking concrete blast wing walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 3.1, 0.8, 0.95]}
          rotation={[0, side * -0.45, 0]}
          material={concreteMain}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.9, 1.45, 0.72]} />
        </mesh>
      ))}
    </group>
  );
}
