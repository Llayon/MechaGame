import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainTiles } from './terrainTileCodec';
import { WATER_LEVEL } from '../../map/terrainMath';
import { WATER_SPAN_D, WATER_SPAN_W } from '../../map/waterDepth';

const mode = new URLSearchParams(location.search).get('surface');
export const useGroundAtlas = mode === 'atlas' || mode === 'quick' || mode === 'stream';
export const deferSky = mode === 'sky' || mode === 'quick' || mode === 'stream';
let groundMap: THREE.Texture | undefined;

export async function prepareGroundMap(signal: AbortSignal) {
  if (!useGroundAtlas || groundMap) return;
  const response = await fetch(import.meta.env.BASE_URL + 'overview-ground.webp', { signal });
  if (!response.ok) throw Error('Failed to load overview texture');
  const image = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', colorSpaceConversion: 'none' });
  if (signal.aborted) { image.close(); return; }
  groundMap = new THREE.Texture(image);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.needsUpdate = true;
}

export function getGroundMap() { return groundMap; }

export function hasGroundMap() { return Boolean(groundMap); }

export function OverviewGround({ tiles }: { tiles: TerrainTiles }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], uvs: number[] = [], faces: number[] = [];
    for (const tile of [...tiles.ground, ...tiles.mountains]) {
      const source = tile.attributes.position.data;
      const range = tile.ranges[tile.shoreline ? 0 : tile.ranges.length - 1];
      const remap = new Map<number, number>();
      for (let i = range.start; i < range.start + range.count; i++) {
        const original = tile.indices[i];
        let index = remap.get(original);
        if (index === undefined) {
          const x = source[3 * original], y = source[3 * original + 1], z = source[3 * original + 2];
          index = positions.length / 3;
          remap.set(original, index);
          const withinWater = Math.abs(x) <= WATER_SPAN_W / 2 && Math.abs(z) <= WATER_SPAN_D / 2;
          positions.push(x, withinWater ? Math.max(y, WATER_LEVEL) : y, z);
          uvs.push(.5 + x / 1488, .5 - z / 1488);
        }
        faces.push(index);
      }
    }
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mesh.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    mesh.setIndex(faces);
    return mesh;
  }, [tiles]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshBasicMaterial map={groundMap} toneMapped={false} /></mesh>;
}
