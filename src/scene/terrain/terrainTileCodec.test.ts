import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { decodeTerrainTiles, encodeTerrainTiles } from './terrainTileCodec';

test('packed terrain preserves raw vertex bytes, index order and tile metadata', async () => {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const tile = {
    attributes: {
      position: { size: 3, data: new Float32Array([-0, 2, 0, 1, 3, 0, 0, 2, 1]) },
      uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1]) },
    },
    indices: new Uint16Array([2, 0, 1]),
    ranges: [{ start: 0, count: 3, error: 0 }],
    bounds: new Box3(new Vector3(0, 2, 0), new Vector3(1, 3, 1)),
    shoreline: true,
  };
  const tiles = { ground: [tile], mountains: [{ ...tile, shoreline: false }] };
  const raw = encodeTerrainTiles(tiles);
  const packed = encodeTerrainTiles(tiles, MeshoptEncoder);
  assert.deepEqual(new Uint8Array(encodeTerrainTiles(decodeTerrainTiles(packed, MeshoptDecoder))), new Uint8Array(raw));
  assert.deepEqual(decodeTerrainTiles(raw), tiles);
  assert.throws(() => decodeTerrainTiles(packed.slice(0, -4), MeshoptDecoder));
});
