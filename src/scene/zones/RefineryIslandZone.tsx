import { StaticStructure } from '../objects/StaticStructure';
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ISLAND_DECK_RADIUS,
  getTerrainHeight,
} from '../../map/terrainMath';
import { SectorId } from '../../map/sectors';
import { RefineryHall } from '../objects/RefineryHall';
import { IndustrialHall } from '../objects/IndustrialHall';
import { DerrickTower } from '../objects/DerrickTower';
import { StorageTank } from '../objects/StorageTank';
import { BlastScreen } from '../objects/BlastScreen';
import { GantryCrane } from '../objects/GantryCrane';
import { getOvergrownConcreteMaterial } from '../objects/concreteMaterials';

export interface RefineryIslandZoneProps {
  corrugatedTex: THREE.Texture;
  onSelectSector: (id: SectorId) => void;
}

export function RefineryIslandZone({
  corrugatedTex,
  onSelectSector,
}: RefineryIslandZoneProps) {
  const islandY = useMemo(
    () => getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z),
    [],
  );
  const islandConcrete = useMemo(
    () => getOvergrownConcreteMaterial('#9BA1A6', 'bridge', { roughness: 0.82, metalness: 0.08 }),
    [],
  );

  return (
    <StaticStructure
      position={[ISLAND_CENTER_X, islandY, ISLAND_CENTER_Z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSector('refinery');
      }}
    >
      {/* Expanded 230 m diameter concrete industrial deck slab (top at +0.70 above islandY) */}
      <mesh position={[0, 0.25, 0]} material={islandConcrete} receiveShadow castShadow>
        <cylinderGeometry args={[ISLAND_DECK_RADIUS, ISLAND_DECK_RADIUS + 1.5, 0.9, 32]} />
      </mesh>

      {/* Central Landmark Derrick Tower */}
      <group position={[0, 0.68, 0]} scale={4.6}>
        <DerrickTower position={[0, 0, 0]} />
      </group>

      {/* 4 Large Industrial Workshops (12.4-13.7 m tall) encircling the tower for brawling ambushes */}
      <IndustrialHall
        position={[-12.5, 0.68, -11.5]}
        rotationY={0.32}
        width={8.6}
        length={11.6}
        height={3.5}
        wallColor="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />
      <IndustrialHall
        position={[9.5, 0.68, -13.5]}
        rotationY={-0.42}
        width={9.0}
        length={12.0}
        height={3.65}
        wallColor="#8E959B"
        corrugatedMap={corrugatedTex}
      />
      <IndustrialHall
        position={[11.0, 0.68, 12.8]}
        rotationY={0.48}
        width={8.8}
        length={11.8}
        height={3.4}
        wallColor="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />
      <IndustrialHall
        position={[-10.5, 0.68, 16.5]}
        rotationY={-0.25}
        width={8.4}
        length={11.2}
        height={3.3}
        wallColor="#8E959B"
        corrugatedMap={corrugatedTex}
      />

      {/* Brick Refinery Smokestack Hall on the West flank */}
      <group position={[-18.0, 0.68, -1.5]} scale={2.4}>
        <RefineryHall position={[0, 0, 0]} corrugatedMap={corrugatedTex} />
      </group>

      {/* 5 Close-Quarters Storage Tanks (12-13.5 m tall) around brawling lanes */}
      <StorageTank position={[-1.5, 0.68, -19.5]} radius={2.8} height={3.6} color="#8F5642" />
      <StorageTank position={[3.8, 0.68, -21.2]} radius={2.5} height={3.4} color="#7D4B3A" />
      <StorageTank position={[20.0, 0.68, 6.5]} radius={3.0} height={3.5} color="#8F5642" />
      <StorageTank position={[19.5, 0.68, 13.5]} radius={2.6} height={3.2} color="#9BA1A6" />
      <StorageTank position={[-1.0, 0.68, 18.8]} radius={2.8} height={3.6} color="#8F5642" />

      {/* Tall Perimeter Silo Towers (~20-21 m) blocking Citadel sniper corridor */}
      <StorageTank position={[14.5, 0.68, -22.5]} radius={2.4} height={5.6} color="#9BA1A6" />
      <StorageTank position={[19.8, 0.68, -19.2]} radius={2.2} height={5.2} color="#8F5642" />

      {/* Dockside Gantry Cranes (~21 m tall, clear of workshops, tanks, and bridges) */}
      <GantryCrane position={[6.5, 0.68, 22.8]} rotationY={0.22} span={9.5} height={5.6} depth={4.6} />
      <GantryCrane position={[-19.5, 0.68, -15.5]} rotationY={0.72} span={9.2} height={5.6} depth={4.4} />

      {/* Perimeter Armored Concrete Blast Screens (15-17 m tall) on Citadel & Airfield sightlines */}
      <BlastScreen position={[-7.0, 0.68, -25.8]} rotationY={Math.PI - 0.18} width={12.0} height={4.4} />
      <BlastScreen position={[21.5, 0.68, -15.0]} rotationY={Math.PI - 0.85} width={10.5} height={4.4} />
      <BlastScreen position={[-17.5, 0.68, 21.5]} rotationY={-0.55} width={11.0} height={4.1} />
    </StaticStructure>
  );
}
