import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import { packOverview } from './packOverview';
import { bakeTerrainGrassMap } from '../src/map/grassField';
import { bakeWaterDepthData } from '../src/map/waterDepth';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from '../src/map/worldMapDimensions';
import { generateGroundTiles, generateMountainTiles } from '../src/scene/terrain/generateTerrain';
import { encodeTerrainTiles, type TerrainTiles } from '../src/scene/terrain/terrainTileCodec';

type BakeTarget = 'overview' | 'grass' | 'water' | 'terrain' | 'all';

function writeAtomic(cacheDir: string, fingerprint: string, key: string, data: Uint8Array): void {
  mkdirSync(cacheDir, { recursive: true });
  const target = path.join(cacheDir, `${fingerprint}-${key}.bin`);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, target);
}

async function main() {
  const [cacheDir, fingerprint, targetArg] = process.argv.slice(2);
  if (!cacheDir || !fingerprint || !targetArg) {
    throw new Error('Usage: bakeWorldAsset.ts <cacheDir> <fingerprint> <overview|grass|water|terrain|all>');
  }
  const target = targetArg as BakeTarget;

  let tiles: TerrainTiles | undefined;
  const getTiles = (): TerrainTiles =>
    (tiles ??= {
      ground: generateGroundTiles(),
      mountains: generateMountainTiles(),
    });

  if (target === 'water' || target === 'all') {
    writeAtomic(cacheDir, fingerprint, 'water', bakeWaterDepthData(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT));
  }
  if (target === 'grass' || target === 'all') {
    writeAtomic(cacheDir, fingerprint, 'grass', bakeTerrainGrassMap(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT));
  }
  if (target === 'overview' || target === 'terrain' || target === 'all') {
    const bakedTiles = getTiles();
    writeAtomic(cacheDir, fingerprint, 'overview', packOverview(bakedTiles));
    await MeshoptEncoder.ready;
    writeAtomic(cacheDir, fingerprint, 'terrain', new Uint8Array(encodeTerrainTiles(bakedTiles, MeshoptEncoder)));
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
