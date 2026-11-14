import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { createTerrainBumpTexture } from './textures';
import { BlueprintTabletop } from './terrain/BlueprintTabletop';
import { TerrainSurface } from './terrain/TerrainSurface';
import { OuterMountainRing } from './terrain/OuterMountainRing';
import { CutawaySkirt } from './terrain/CutawaySkirt';
import { RoadNetwork } from './terrain/RoadNetwork';
import { RiverWater } from './terrain/RiverWater';

interface TerrainSlabProps {
  showWireframeGrid: boolean;
  isSoftwareGl: boolean;
}

export function TerrainSlab({ showWireframeGrid, isSoftwareGl }: TerrainSlabProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const terrainBump = useMemo(() => createTerrainBumpTexture(maxAniso), [maxAniso]);

  useEffect(() => {
    return () => terrainBump.dispose();
  }, [terrainBump]);

  return (
    <group>
      <BlueprintTabletop />
      <TerrainSurface terrainBump={terrainBump} showWireframeGrid={showWireframeGrid} />
      <OuterMountainRing terrainBump={terrainBump} />
      <CutawaySkirt terrainBump={terrainBump} />
      <RoadNetwork />
      <RiverWater isSoftwareGl={isSoftwareGl} />
    </group>
  );
}
