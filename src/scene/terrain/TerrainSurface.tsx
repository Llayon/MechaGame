import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { MAP_DEPTH, MAP_WIDTH, getTerrainHeight } from '../../map/terrainMath';
import {
  getGroundLastEnabled,
  subscribeGroundLastEnabled,
} from '../renderPerfAndVfx';
import type { TerrainTile } from './terrainChunks';
import { TerrainTileSet } from './TerrainTileSet';
import { createTerrainSurfaceMaterial } from './terrainShader';

export interface TerrainSurfaceProps {
  tiles: TerrainTile[];
  terrainBump: THREE.Texture;
  showWireframeGrid: boolean;
  puddleTimeUniform: { value: number };
}

export function TerrainSurface({
  tiles,
  terrainBump,
  showWireframeGrid,
  puddleTimeUniform,
}: TerrainSurfaceProps) {
  const [groundLast, setGroundLast] = useState(getGroundLastEnabled);

  useEffect(() => {
    setGroundLast(getGroundLastEnabled());
    return subscribeGroundLastEnabled(setGroundLast);
  }, []);

  const terrainMaterial = useMemo(
    () => createTerrainSurfaceMaterial(terrainBump, 0.28, puddleTimeUniform),
    [terrainBump, puddleTimeUniform],
  );

  const wireframeGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH, 56, 46);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getTerrainHeight(x, z) + 0.35);
    }
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      terrainMaterial.dispose();
      wireframeGeometry.dispose();
    };
  }, [terrainMaterial, wireframeGeometry]);

  return (
    <group>
      <TerrainTileSet
        name="terrain-ground"
        tiles={tiles}
        material={terrainMaterial}
        renderOrder={groundLast ? 10 : 0}
      />

      {showWireframeGrid && (
        <mesh geometry={wireframeGeometry}>
          <meshBasicMaterial
            color="#5ea4c7"
            wireframe
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
