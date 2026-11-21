import { Box3, Vector3 } from 'three';
import type { TerrainTile } from './terrainChunks';
import type { MeshoptEncoder } from 'meshoptimizer/encoder';
import type { MeshoptDecoder } from 'meshoptimizer/decoder';

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

const RAW = 1;
const MESHOPT = 2;
const align = (offset: number) => Math.ceil(offset / 4) * 4;

// A packed stream has a byte-length prefix. Raw worker buffers use the original layout.
export function encodeTerrainTiles({ ground, mountains }: TerrainTiles, encoder?: typeof MeshoptEncoder): ArrayBuffer {
  const blocks: Uint8Array[] = [];
  let payloadSize = 0;
  function append(data: Float32Array | Uint16Array, size: number) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let block: Uint8Array = bytes;
    if (encoder) {
      block = data instanceof Uint16Array
        ? encoder.encodeIndexSequence(bytes, data.length, 2)
        : encoder.encodeVertexBuffer(bytes, data.length / size, size * 4);
    }
    blocks.push(block);
    payloadSize += (encoder ? 4 : 0) + align(block.length);
  }
  function describe(tile: TerrainTile): TileHeader {
    const attributes = Object.entries(tile.attributes).map(([name, { data, size }]): TileHeader['attributes'][number] => {
      append(data, size);
      return [name, size, data.length];
    });
    append(tile.indices, 1);
    return {
      attributes,
      indexLength: tile.indices.length,
      ranges: tile.ranges,
      min: tile.bounds.min.toArray(),
      max: tile.bounds.max.toArray(),
      shoreline: tile.shoreline,
    };
  }

  const header: TerrainHeader = { version: encoder ? MESHOPT : RAW, ground: ground.map(describe), mountains: mountains.map(describe) };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const payloadOffset = align(4 + json.byteLength);
  const buffer = new ArrayBuffer(payloadOffset + payloadSize);
  const view = new DataView(buffer);
  view.setUint32(0, json.byteLength, true);
  new Uint8Array(buffer, 4, json.byteLength).set(json);

  let offset = payloadOffset;
  for (const block of blocks) {
    if (encoder) {
      view.setUint32(offset, block.length, true);
      offset += 4;
    }
    new Uint8Array(buffer, offset, block.length).set(block);
    offset += align(block.length);
  }
  return buffer;
}

export function decodeTerrainTiles(buffer: ArrayBuffer, decoder?: typeof MeshoptDecoder): TerrainTiles {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const json = new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength));
  const header = JSON.parse(json) as TerrainHeader;
  const packedDecoder = header.version === MESHOPT ? decoder : undefined;
  if (header.version !== RAW && !packedDecoder) throw new Error('Unsupported terrain asset version');

  let offset = align(4 + headerLength);
  function readBlock(length: number) {
    const block = new Uint8Array(buffer, offset, length);
    offset += align(length);
    return block;
  }
  function readPackedBlock() {
    const length = view.getUint32(offset, true);
    offset += 4;
    return readBlock(length);
  }
  function decode(tile: TileHeader): TerrainTile {
    const attributes: TerrainTile['attributes'] = {};
    for (const [name, size, length] of tile.attributes) {
      let data: Float32Array;
      if (packedDecoder) {
        data = new Float32Array(length);
        packedDecoder.decodeVertexBuffer(new Uint8Array(data.buffer), length / size, size * 4, readPackedBlock());
      } else {
        data = new Float32Array(buffer, readBlock(length * 4).byteOffset, length);
      }
      attributes[name] = { data, size };
    }
    let indices: Uint16Array;
    if (packedDecoder) {
      indices = new Uint16Array(tile.indexLength);
      packedDecoder.decodeIndexSequence(new Uint8Array(indices.buffer), indices.length, 2, readPackedBlock());
    } else {
      indices = new Uint16Array(buffer, readBlock(tile.indexLength * 2).byteOffset, tile.indexLength);
    }
    const bounds = new Box3(new Vector3(...tile.min), new Vector3(...tile.max));
    return { attributes, indices, bounds, ranges: tile.ranges, shoreline: tile.shoreline };
  }

  const terrain = { ground: header.ground.map(decode), mountains: header.mountains.map(decode) };
  if (offset !== buffer.byteLength || !terrain.ground.length || !terrain.mountains.length) {
    throw new Error('Incomplete terrain asset');
  }
  return terrain;
}
