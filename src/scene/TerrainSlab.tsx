import { useSceneSimulation } from './SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
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
  nearVisible?: boolean;
  far?: boolean;
  water?: boolean;
  tiles: TerrainTiles;
  waterDepth: Uint8Array<ArrayBuffer>;
  showWireframeGrid: boolean;
  isSoftwareGl: boolean;
}

export function TerrainSlab({ showWireframeGrid, isSoftwareGl, waterDepth, tiles, nearVisible=true, far=true, water=true }: TerrainSlabProps) {
  const { gl, scene, camera } = useThree();
  const surfaces = useRef<Group>(null);
  const prepareSurfaces = !nearVisible && gl.extensions.has('KHR_parallel_shader_compile');
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const terrainBump = useMemo(() => createTerrainBumpTexture(maxAniso), [maxAniso]);
  const puddleTimeUniform = useMemo(() => ({ value: 1.4 }), []);

  useEffect(() => {
    return () => terrainBump.dispose();
  }, [terrainBump]);

  const { paused } = useSceneSimulation();

  useEffect(() => {
    if (!prepareSurfaces || !surfaces.current || !scene.environment) return;
    // Compile the actual materials with the live lighting while CompactGround covers these meshes.
    void gl.compileAsync(surfaces.current, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('Terrain shader warmup failed', error);
    });
  }, [prepareSurfaces, gl, camera, scene, tiles]);

  useFrame((_, delta) => {
    if (paused) return;
    if (isSoftwareGl || !nearVisible) return;
    puddleTimeUniform.value += Math.min(delta, 0.05);
  });

  return (
    <group>
      {(nearVisible || prepareSurfaces) && <group ref={surfaces} visible={nearVisible}>
        <BlueprintTabletop />
        <TerrainSurface
          tiles={tiles.ground}
          terrainBump={terrainBump}
          showWireframeGrid={showWireframeGrid}
          puddleTimeUniform={puddleTimeUniform}
        />
        <CutawaySkirt terrainBump={terrainBump} />
        <RoadNetwork puddleTimeUniform={puddleTimeUniform} />
      </group>}
      {far && <OuterMountainRing tiles={tiles.mountains} terrainBump={terrainBump} puddleTimeUniform={puddleTimeUniform} />}
      {water && <RiverWater isSoftwareGl={isSoftwareGl} data={waterDepth} />}
    </group>
  );
}
