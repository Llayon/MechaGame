import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  const puddleTimeUniform = useMemo(() => ({ value: 1.4 }), []);

  useEffect(() => {
    return () => terrainBump.dispose();
  }, [terrainBump]);

  useFrame((_, delta) => {
    if (isSoftwareGl) return;
    puddleTimeUniform.value += Math.min(delta, 0.05);
  });

  return (
    <group>
      <BlueprintTabletop />
      <TerrainSurface
        terrainBump={terrainBump}
        showWireframeGrid={showWireframeGrid}
        puddleTimeUniform={puddleTimeUniform}
      />
      <OuterMountainRing terrainBump={terrainBump} puddleTimeUniform={puddleTimeUniform} />
      <CutawaySkirt terrainBump={terrainBump} />
      <RoadNetwork puddleTimeUniform={puddleTimeUniform} />
      <RiverWater isSoftwareGl={isSoftwareGl} />
    </group>
  );
}
