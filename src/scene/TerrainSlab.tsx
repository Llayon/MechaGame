import { useSceneSimulation } from './SceneSimulation';
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createTerrainBumpTexture } from './textures';
import { BlueprintTabletop } from './terrain/BlueprintTabletop';
import { TerrainSurface } from './terrain/TerrainSurface';
import { OuterMountainRing } from './terrain/OuterMountainRing';
import { CutawaySkirt } from './terrain/CutawaySkirt';
import { RoadNetwork } from './terrain/RoadNetwork';
import type { TerrainTiles } from './terrain/terrainTileCodec';
import { RiverWater } from './terrain/RiverWater';

interface TerrainSlabProps {
  near?: boolean;
  far?: boolean;
  water?: boolean;
  tiles: TerrainTiles;
  waterDepth: Uint8Array<ArrayBuffer>;
  showWireframeGrid: boolean;
  isSoftwareGl: boolean;
}

export function TerrainSlab({ showWireframeGrid, isSoftwareGl, waterDepth, tiles, near=true, far=true, water=true }: TerrainSlabProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const terrainBump = useMemo(() => createTerrainBumpTexture(maxAniso), [maxAniso]);
  const puddleTimeUniform = useMemo(() => ({ value: 1.4 }), []);

  useEffect(() => {
    return () => terrainBump.dispose();
  }, [terrainBump]);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (isSoftwareGl) return;
    puddleTimeUniform.value += Math.min(delta, 0.05);
  });

  return (
    <group>
      {near && <BlueprintTabletop />}
      {near && <TerrainSurface
        tiles={tiles.ground}
        terrainBump={terrainBump}
        showWireframeGrid={showWireframeGrid}
        puddleTimeUniform={puddleTimeUniform}
      />}
      {far && <OuterMountainRing tiles={tiles.mountains} terrainBump={terrainBump} puddleTimeUniform={puddleTimeUniform} />}
      {near && <CutawaySkirt terrainBump={terrainBump} />}
      {near && <RoadNetwork puddleTimeUniform={puddleTimeUniform} />}
      {water && <RiverWater isSoftwareGl={isSoftwareGl} data={waterDepth} />}
    </group>
  );
}
