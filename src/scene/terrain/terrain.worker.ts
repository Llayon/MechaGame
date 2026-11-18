import { generateGroundTiles, generateMountainTiles } from './generateTerrain';
import { encodeTerrainTiles } from './terrainTileCodec';

self.onmessage = () => {
  const buffer = encodeTerrainTiles({ ground: generateGroundTiles(), mountains: generateMountainTiles() });
  self.postMessage(buffer, { transfer: [buffer] });
};
