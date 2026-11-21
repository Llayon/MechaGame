import { gzipSync } from 'node:zlib';
import type { TerrainTile } from '../src/scene/terrain/terrainChunks';
import type { TerrainTiles } from '../src/scene/terrain/terrainTileCodec';

function packPart(tiles: TerrainTile[]) {
  const positions: number[] = [], indices: number[] = [];
  const vertices = new Map<string, number>();
  for (const tile of tiles) {
    const source = tile.attributes.position.data;
    const range = tile.ranges[tile.shoreline ? 0 : tile.ranges.length - 1];
    for (let i = range.start; i < range.start + range.count; i++) {
      const offset = tile.indices[i] * 3;
      const x = Math.round(source[offset] * 32);
      const y = Math.round(source[offset + 1] * 32);
      const z = Math.round(source[offset + 2] * 32);
      const key = x + ',' + y + ',' + z;
      let id = vertices.get(key);
      if (id === undefined) {
        id = vertices.size;
        vertices.set(key, id);
        positions.push(x, y, z);
      }
      indices.push(id);
    }
  }
  const wide = vertices.size > 65535;
  const data = Buffer.alloc(8 + positions.length * 2 + indices.length * (wide ? 4 : 2));
  data.writeUInt32LE(vertices.size, 0);
  data.writeUInt32LE(indices.length, 4);
  let offset = 8;
  for (let axis = 0; axis < 3; axis++) {
    let previous = 0;
    for (let i = axis; i < positions.length; i += 3) {
      const value = positions[i];
      offset = data.writeUInt16LE((value - previous) & 65535, offset);
      previous = value;
    }
  }
  let previous = 0;
  for (const id of indices) {
    const delta = id - previous;
    offset = wide ? data.writeUInt32LE(delta >>> 0, offset) : data.writeUInt16LE(delta & 65535, offset);
    previous = id;
  }
  return data;
}

export function packOverview(tiles: TerrainTiles) {
  return gzipSync(Buffer.concat([Buffer.from('OVR2'), packPart(tiles.ground), packPart(tiles.mountains)]), { level: 9 });
}