import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TerrainTile } from './terrainChunks';
import { TerrainTileSet } from './TerrainTileSet';
import { createTerrainSurfaceMaterial } from './terrainShader';

export interface OuterMountainRingProps {
  tiles: TerrainTile[];
  terrainBump: THREE.Texture;
  puddleTimeUniform: { value: number };
}

export function OuterMountainRing({
  tiles,
  terrainBump,
  puddleTimeUniform,
}: OuterMountainRingProps) {
  const mountainMaterial = useMemo(
    () => createTerrainSurfaceMaterial(terrainBump, 0.55, puddleTimeUniform),
    [terrainBump, puddleTimeUniform],
  );

  useEffect(() => {
    return () => {
      mountainMaterial.dispose();
    };
  }, [mountainMaterial]);

  return (
    <TerrainTileSet name="terrain-horizon" tiles={tiles} material={mountainMaterial} />
  );
}
