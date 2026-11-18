import { Box3, Vector3 } from 'three';
import type { TerrainTile } from './terrainChunks';

export interface TerrainTiles {
  ground: TerrainTile[];
  mountains: TerrainTile[];
}

interface TileHeader {
  attributes: [name: string, size: number, length: number][];
  indexLength: number;
  ranges: TerrainTile['ranges'];
  min: [number, number, number];
  max: [number, number, number];
  shoreline: boolean;
}

interface TerrainHeader {
  version: number;
  ground: TileHeader[];
  mountains: TileHeader[];
}

const VERSION = 1;
const align = (offset: number) => Math.ceil(offset / 4) * 4;

export function encodeTerrainTiles({ ground, mountains }: TerrainTiles): ArrayBuffer {
  let payloadSize = 0;
  function describe(tile: TerrainTile): TileHeader {
    const attributes = Object.entries(tile.attributes).map(([name, { data, size }]): TileHeader['attributes'][number] => {
      payloadSize += data.byteLength;
      return [name, size, data.length];
    });
    payloadSize = align(payloadSize + tile.indices.byteLength);
    return {
      attributes,
      indexLength: tile.indices.length,
      ranges: tile.ranges,
      min: tile.bounds.min.toArray(),
      max: tile.bounds.max.toArray(),
      shoreline: tile.shoreline,
    };
  }

  const header: TerrainHeader = { version: VERSION, ground: ground.map(describe), mountains: mountains.map(describe) };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const payloadOffset = align(4 + json.byteLength);
  const buffer = new ArrayBuffer(payloadOffset + payloadSize);
  new DataView(buffer).setUint32(0, json.byteLength, true);
  new Uint8Array(buffer, 4, json.byteLength).set(json);

  let offset = payloadOffset;
  for (const tile of [...ground, ...mountains]) {
    for (const { data } of Object.values(tile.attributes)) {
      new Float32Array(buffer, offset, data.length).set(data);
      offset += data.byteLength;
    }
    new Uint16Array(buffer, offset, tile.indices.length).set(tile.indices);
    offset = align(offset + tile.indices.byteLength);
  }
  return buffer;
}

export function decodeTerrainTiles(buffer: ArrayBuffer): TerrainTiles {
  const headerLength = new DataView(buffer).getUint32(0, true);
  const json = new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength));
  const header = JSON.parse(json) as TerrainHeader;
  if (header.version !== VERSION) throw new Error('Unsupported terrain asset version');

  let offset = align(4 + headerLength);
  function decode(tile: TileHeader): TerrainTile {
    const attributes: TerrainTile['attributes'] = {};
    for (const [name, size, length] of tile.attributes) {
      const data = new Float32Array(buffer, offset, length);
      offset += data.byteLength;
      attributes[name] = { data, size };
    }
    const indices = new Uint16Array(buffer, offset, tile.indexLength);
    offset = align(offset + indices.byteLength);
    const bounds = new Box3(new Vector3(...tile.min), new Vector3(...tile.max));
    return { attributes, indices, bounds, ranges: tile.ranges, shoreline: tile.shoreline };
  }

  const terrain = { ground: header.ground.map(decode), mountains: header.mountains.map(decode) };
  if (offset !== buffer.byteLength || !terrain.ground.length || !terrain.mountains.length) {
    throw new Error('Incomplete terrain asset');
  }
  return terrain;
}
