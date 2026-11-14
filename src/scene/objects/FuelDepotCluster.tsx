import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';
import { StorageTank } from './StorageTank';
import { CargoContainer } from './CargoContainer';

export interface FuelDepotClusterProps {
  position: readonly [number, number];
  rotationY?: number;
}

/**
 * Forward fuel tank depot on the left plateau: concrete containment bund,
 * vertical & horizontal pressurized fuel cisterns, overhead steel pipe manifold,
 * catwalk frame, and cargo cover for flanking mechs.
 */
export function FuelDepotCluster({
  position,
  rotationY = 0.22,
}: FuelDepotClusterProps) {
  const [px, pz] = position;
  const baseY = useMemo(() => getTerrainHeight(px, pz), [px, pz]);

  return (
    <group position={[px, baseY, pz]} rotation={[0, rotationY, 0]}>
      {/* Concrete containment plinth sunk into plateau slope */}
      <mesh position={[0, -0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[17.6, 1.3, 14.2]} />
        <meshStandardMaterial color="#868D93" roughness={0.84} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.26, 0]} receiveShadow>
        <boxGeometry args={[16.2, 0.28, 12.8]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
      </mesh>

      {/* Low perimeter containment bund walls with open access lanes */}
      <mesh position={[0, 0.62, -6.1]} castShadow receiveShadow>
        <boxGeometry args={[15.8, 0.62, 0.55]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh position={[-7.8, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.62, 12.4]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh position={[7.8, 0.62, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.62, 8.6]} />
        <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
      </mesh>

      {/* 3 Vertical Terracotta & Slate Fuel Silos (~12-14 m tall) */}
      <StorageTank position={[-4.5, 0.4, -2.6]} radius={2.15} height={3.55} color="#8F5642" />
      <StorageTank position={[0.4, 0.4, -2.8]} radius={2.05} height={3.35} color="#7D4B3A" />
      <StorageTank position={[4.9, 0.4, -2.3]} radius={1.95} height={3.15} color="#525B66" />

      {/* 2 Horizontal Pressurized Fuel Cisterns on Concrete Saddle Cradles */}
      {[
        { x: -3.2, z: 3.0 },
        { x: 2.8, z: 2.8 },
      ].map((pos, idx) => (
        <group key={`cistern-${idx}`} position={[pos.x, 0.4, pos.z]}>
          {/* Concrete cradles */}
          {[-1.8, 1.8].map((sx, sIdx) => (
            <mesh key={sIdx} position={[sx, 0.55, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.72, 1.1, 2.3]} />
              <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.06} />
            </mesh>
          ))}
          {/* Horizontal cylindrical pressure tank */}
          <mesh position={[0, 1.52, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[1.18, 1.18, 5.4, 16]} />
            <meshStandardMaterial
              color={idx === 0 ? '#8F5642' : '#9BA1A6'}
              roughness={idx === 0 ? 0.65 : 0.76}
              metalness={idx === 0 ? 0.24 : 0.18}
            />
          </mesh>
          {/* Steel rib rings */}
          {[-1.5, 0, 1.5].map((rx, rIdx) => (
            <mesh key={rIdx} position={[rx, 1.52, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[1.24, 1.24, 0.16, 16]} />
              <meshStandardMaterial color="#49525C" roughness={0.55} metalness={0.58} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Overhead Steel Pipe Manifold & Catwalk Bridge linking silos */}
      <mesh position={[0.2, 3.35, -0.3]} castShadow>
        <boxGeometry args={[10.8, 0.24, 0.42]} />
        <meshStandardMaterial color="#49525C" roughness={0.52} metalness={0.62} />
      </mesh>
      {[-4.5, 0.4, 4.9].map((pxPipe, idx) => (
        <mesh key={idx} position={[pxPipe, 2.0, -0.3]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 2.9, 8]} />
          <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
        </mesh>
      ))}

      {/* Supply container & subtle ice-cyan status pylon at depot corner */}
      <CargoContainer
        position={[-6.2, 0.4, 2.8]}
        rotationY={0.14}
        width={1.45}
        length={3.2}
        height={1.3}
        color="#525B66"
      />
      <group position={[7.4, 0.4, 4.9]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.42, 1.5, 0.42]} />
          <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.12} />
        </mesh>
        <mesh position={[0, 1.38, 0]}>
          <boxGeometry args={[0.28, 0.46, 0.48]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={1.75}
            toneMapped={false}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}
