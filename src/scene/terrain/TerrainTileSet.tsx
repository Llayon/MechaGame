import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { readWorldLod } from '../../lod/worldLod';
import { useSceneSimulation } from '../SceneSimulation';
import { createTileMesh, type TerrainTile } from './terrainChunks';

export function TerrainTileSet({ tiles, material, name }: {
  tiles: TerrainTile[]; material: THREE.Material; name: string;
}) {
  const batches = useMemo(() => tiles.map(tile => createTileMesh(tile, material)), [tiles, material]);
  const { paused } = useSceneSimulation();
  const elapsed = useRef(1);
  useFrame(({ camera }, dt) => {
    if (paused) return;
    elapsed.current += dt;
    if (elapsed.current < 0.10) return;
    elapsed.current = 0;
    const view = readWorldLod(camera);
    for (const batch of batches) batch.select(view.focalPixels, camera, view.detailScale, view.shadowScale);
  });
  useEffect(() => () => { for (const { mesh } of batches) mesh.geometry.dispose(); }, [batches]);
  return <group name={name}>{batches.map(({ mesh }, i) => <primitive key={i} object={mesh} />)}</group>;
}
