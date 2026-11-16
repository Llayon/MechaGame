import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';
import { CargoContainer } from './CargoContainer';
import { getOvergrownConcreteMaterial } from './concreteMaterials';

export interface ForwardOutpostRuinsProps {
  position: readonly [number, number];
  rotationY?: number;
}

/**
 * Ruined forward concrete outpost on the left plateau: fractured bastion walls,
 * collapsed roof slab ramp, damaged command bunker, toppled comms mast, and
 * scorched armored supply containers for mech-scale flank cover.
 */
export function ForwardOutpostRuins({
  position,
  rotationY = 0.42,
}: ForwardOutpostRuinsProps) {
  const [px, pz] = position;
  const baseY = useMemo(() => getTerrainHeight(px, pz), [px, pz]);
  const ruinMain = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'ruin', { roughness: 0.85, metalness: 0.06 }), []);
  const ruinDark = useMemo(() => getOvergrownConcreteMaterial('#868D93', 'ruin', { roughness: 0.88, metalness: 0.05 }), []);
  const ruinMid = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'ruin', { roughness: 0.85, metalness: 0.06 }), []);

  return (
    <group position={[px, baseY, pz]} rotation={[0, rotationY, 0]}>
      {/* Stepped concrete bastion foundation sunk cleanly into plateau slope */}
      <mesh position={[0, -0.45, 0]} material={ruinDark} castShadow receiveShadow>
        <boxGeometry args={[18.5, 1.35, 15.0]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} material={ruinMain} receiveShadow>
        <boxGeometry args={[16.8, 0.3, 13.4]} />
      </mesh>

      {/* Damaged Command Casemate / Pillbox Core */}
      <group position={[-3.2, 0.4, -2.1]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 1.1, 0]} material={ruinMain} castShadow receiveShadow>
          <boxGeometry args={[6.2, 2.2, 5.4]} />
        </mesh>
        {/* Recessed firing slit & scorched upper breach */}
        <mesh position={[0, 1.68, 2.58]}>
          <boxGeometry args={[4.4, 0.34, 0.36]} />
          <meshStandardMaterial color="#1d2224" roughness={0.7} metalness={0.35} />
        </mesh>
        <mesh position={[1.1, 2.28, 0.35]} rotation={[0.08, 0.1, -0.14]} material={ruinMid} castShadow receiveShadow>
          <boxGeometry args={[6.6, 0.48, 5.7]} />
        </mesh>
        {/* Exposed dark rebar steel beams protruding from shattered roof corner */}
        {[
          [2.8, 2.35, 1.8],
          [3.1, 2.28, 0.6],
          [2.7, 2.4, -0.7],
        ].map(([rx, ry, rz], idx) => (
          <mesh
            key={idx}
            position={[rx, ry, rz]}
            rotation={[0.12 * idx, 0.15, -0.32]}
            castShadow
          >
            <cylinderGeometry args={[0.07, 0.08, 1.75, 6]} />
            <meshStandardMaterial color="#374049" roughness={0.5} metalness={0.72} />
          </mesh>
        ))}
      </group>

      {/* Breached Forward Concrete Perimeter Wall & Collapsed Slab Ramp */}
      <mesh position={[-5.4, 1.55, 5.2]} rotation={[0, -0.18, 0]} material={ruinMain} castShadow receiveShadow>
        <boxGeometry args={[6.2, 2.6, 1.05]} />
      </mesh>
      <mesh position={[4.8, 1.4, 4.9]} rotation={[0.05, 0.24, -0.11]} material={ruinMain} castShadow receiveShadow>
        <boxGeometry args={[5.8, 2.4, 1.05]} />
      </mesh>
      {/* Collapsed concrete roof/wall slab leaning at walkable angle in the breach */}
      <mesh position={[0.2, 0.92, 5.1]} rotation={[0.38, 0.12, 0.16]} material={ruinDark} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.55, 3.6]} />
      </mesh>

      {/* East Flank Broken Blast Shield */}
      <mesh position={[6.8, 1.35, -1.6]} rotation={[0, Math.PI / 2 - 0.18, 0.08]} material={ruinMain} castShadow receiveShadow>
        <boxGeometry args={[7.2, 2.4, 0.95]} />
      </mesh>

      {/* Toppled / Bent Lattice Comms Mast with Dim Emergency Beacon */}
      <group position={[3.6, 0.4, -3.6]} rotation={[0.36, 0.4, -0.28]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.6, 0.7, 1.6]} />
          <meshStandardMaterial color="#525B66" roughness={0.68} metalness={0.42} />
        </mesh>
        <mesh position={[0, 3.1, 0]} castShadow>
          <boxGeometry args={[0.48, 5.4, 0.48]} />
          <meshStandardMaterial color="#49525C" roughness={0.54} metalness={0.62} />
        </mesh>
        {/* Crossbar & radar dish */}
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.22]} />
          <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
        </mesh>
        <mesh position={[0.6, 5.5, 0.2]} rotation={[0.45, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.85, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.28} />
        </mesh>
        <mesh position={[0, 5.85, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={1.65}
            toneMapped={false}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Scorched Cargo Containers & Supply Crates inside courtyard */}
      <CargoContainer
        position={[3.8, 0.4, 1.2]}
        rotationY={-0.38}
        width={1.7}
        length={4.0}
        height={1.45}
        color="#8F5642"
        stacked
      />
      <CargoContainer
        position={[-6.0, 0.4, 1.6]}
        rotationY={0.88}
        width={1.6}
        length={3.4}
        height={1.4}
        color="#525B66"
      />
    </group>
  );
}
