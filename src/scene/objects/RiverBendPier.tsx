import { WATER_LEVEL } from '../../map/terrainMath';
import { CargoContainer } from './CargoContainer';
import { GantryCrane } from './GantryCrane';
import { StorageTank } from './StorageTank';

export interface RiverBendPierProps {
  position?: readonly [number, number];
  rotationY?: number;
}

/**
 * Industrial river pier with portal & jib cranes, moored barge, stacked cargo
 * barricades, and wide bank ramps at the SE river bend for flanking toward
 * the East Bridge and Point E.
 */
export function RiverBendPier({
  position = [101, 108],
  rotationY = -0.32,
}: RiverBendPierProps) {
  const [px, pz] = position;
  const deckY = WATER_LEVEL + 3.65;

  return (
    <group position={[px, WATER_LEVEL, pz]} rotation={[0, rotationY, 0]}>
      {/* Main Reinforced Concrete Quay Deck (82 x 112 m) */}
      <mesh position={[0, deckY - 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[21.5, 1.15, 29.5]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
      </mesh>
      {/* Inland Concrete Retaining Apron anchoring cleanly into East Bank */}
      <mesh position={[10.5, deckY - 1.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.8, 2.2, 26.5]} />
        <meshStandardMaterial color="#868D93" roughness={0.84} metalness={0.06} />
      </mesh>

      {/* Sloped Concrete Access Ramps on North & East Shore Approaches (for non-jump-jet Mechs) */}
      <mesh position={[11.8, deckY - 0.48, -11.5]} rotation={[0.14, 0, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[8.5, 1.0, 9.2]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
      </mesh>
      <mesh position={[2.2, deckY - 0.52, -16.8]} rotation={[0.19, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[12.5, 1.0, 7.6]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
      </mesh>

      {/* Heavy Concrete Caisson Pilings extending down into riverbed */}
      {[
        [-8.2, -11.5],
        [-8.2, -3.8],
        [-8.2, 3.8],
        [-8.2, 11.5],
        [-1.8, -11.5],
        [-1.8, 0],
        [-1.8, 11.5],
      ].map(([cx, cz], idx) => (
        <mesh key={`piling-${idx}`} position={[cx, deckY * 0.5 - 2.2, cz]} castShadow receiveShadow>
          <cylinderGeometry args={[1.05, 1.25, deckY + 4.4, 10]} />
          <meshStandardMaterial color="#525B66" roughness={0.84} metalness={0.1} />
        </mesh>
      ))}

      {/* Riverfront Concrete Bumper Curb & Ice-Cyan (#00E5FF) Quay Navigation Trim */}
      <mesh position={[-10.45, deckY + 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.36, 29.2]} />
        <meshStandardMaterial color="#525B66" roughness={0.72} metalness={0.22} />
      </mesh>
      <mesh position={[-10.72, deckY + 0.22, 0]}>
        <boxGeometry args={[0.16, 0.14, 28.4]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive="#00E5FF"
          emissiveIntensity={1.65}
          toneMapped={false}
          roughness={0.2}
        />
      </mesh>
      {[-11.8, -4.0, 4.0, 11.8].map((bz, idx) => (
        <group key={`bollard-${idx}`} position={[-9.9, deckY + 0.02, bz]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.34, 0.72, 8]} />
            <meshStandardMaterial color="#49525C" roughness={0.55} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.76, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.18, 8]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.8}
              toneMapped={false}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Portal Gantry Crane on the North Pier Section (~20 m tall) */}
      <GantryCrane
        position={[-1.2, deckY, -6.5]}
        rotationY={Math.PI / 2}
        span={9.6}
        height={5.4}
        depth={4.8}
      />

      {/* Tall Dockside Rotating Jib / Boom Crane on South-West Riverfront Corner (~24 m tall) */}
      <group position={[-6.8, deckY, 8.8]} rotation={[0, -0.52, 0]}>
        {/* Reinforced octagonal crane pedestal */}
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.55, 1.95, 1.7, 8]} />
          <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.12} />
        </mesh>
        {/* Steel slewing tower mast */}
        <mesh position={[0, 3.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.65, 3.1, 1.65]} />
          <meshStandardMaterial color="#525B66" roughness={0.56} metalness={0.55} />
        </mesh>
        {/* Terracotta ochre machinery house & counterweight block */}
        <mesh position={[0.35, 5.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 1.35, 2.15]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.28} />
        </mesh>
        <mesh position={[2.3, 5.05, 0]} castShadow>
          <boxGeometry args={[1.25, 1.45, 2.25]} />
          <meshStandardMaterial color="#49525C" roughness={0.62} metalness={0.48} />
        </mesh>
        {/* Long angled lattice-style steel boom arm reaching over river barge */}
        <mesh position={[-4.1, 7.35, 0]} rotation={[0, 0, -0.48]} castShadow receiveShadow>
          <boxGeometry args={[9.8, 0.56, 0.68]} />
          <meshStandardMaterial color="#525B66" roughness={0.52} metalness={0.6} />
        </mesh>
        {/* Top A-frame gantry stays & tension cables */}
        <mesh position={[-0.6, 6.45, 0]} rotation={[0, 0, 0.25]} castShadow>
          <boxGeometry args={[0.32, 2.05, 1.1]} />
          <meshStandardMaterial color="#49525C" roughness={0.54} metalness={0.62} />
        </mesh>
        <mesh position={[-4.0, 8.2, 0]} rotation={[0, 0, -1.24]}>
          <cylinderGeometry args={[0.06, 0.06, 6.9, 6]} />
          <meshStandardMaterial color="#2c333b" roughness={0.38} metalness={0.78} />
        </mesh>
        {/* Suspended hoist cable & heavy cargo container load */}
        <mesh position={[-7.6, 6.5, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 5.4, 6]} />
          <meshStandardMaterial color="#2c333b" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[-7.6, 3.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 1.4, 3.4]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
        </mesh>
      </group>

      {/* Stacked Mech-Cover Cargo Containers & Fuel Cisterns along Pier */}
      <CargoContainer
        position={[5.8, deckY, -8.8]}
        rotationY={0.12}
        width={1.7}
        length={4.2}
        height={1.45}
        color="#8F5642"
        stacked
      />
      <CargoContainer
        position={[5.4, deckY, 2.5]}
        rotationY={-0.16}
        width={1.7}
        length={4.0}
        height={1.45}
        color="#525B66"
        stacked
      />
      <CargoContainer
        position={[1.8, deckY, 10.2]}
        rotationY={1.32}
        width={1.65}
        length={3.8}
        height={1.45}
        color="#8F5642"
      />
      <StorageTank position={[7.4, deckY, 9.6]} radius={1.65} height={2.8} color="#8F5642" />
      <StorageTank position={[7.5, deckY, 5.8]} radius={1.45} height={2.45} color="#9BA1A6" />

      {/* Moored Industrial River Barge floating beside Quay */}
      <group position={[-15.2, 0.1, -1.5]} rotation={[0, 0.04, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.4, 1.35, 16.5]} />
          <meshStandardMaterial color="#49525C" roughness={0.72} metalness={0.38} />
        </mesh>
        {/* Coaming rim */}
        <mesh position={[0, 1.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.8, 0.36, 15.2]} />
          <meshStandardMaterial color="#8F5642" roughness={0.68} metalness={0.24} />
        </mesh>
        <CargoContainer
          position={[0.4, 1.48, -3.5]}
          rotationY={0.05}
          width={1.65}
          length={3.8}
          height={1.4}
          color="#8F5642"
        />
        <CargoContainer
          position={[-0.3, 1.48, 3.2]}
          rotationY={-0.08}
          width={1.65}
          length={3.8}
          height={1.4}
          color="#525B66"
          stacked
        />
      </group>
    </group>
  );
}
