import { decodeTerrainTiles, type TerrainTiles } from '../scene/terrain/terrainTileCodec';
import paths from 'virtual:world-asset-paths';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from './worldMapDimensions';

export interface WorldAssets {
  terrain: TerrainTiles;
  grass: Uint8Array<ArrayBuffer>;
  water: Uint8Array<ArrayBuffer>;
}

async function loadMap(path: string, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await fetchWorldAsset(path, signal);
  if (buffer.byteLength !== WORLD_MAP_WIDTH * WORLD_MAP_HEIGHT * 4) {
    throw new Error(`Invalid world map size for ${path}`);
  }
  return new Uint8Array(buffer);
}

async function fetchWorldAsset(path: string, signal: AbortSignal) {
  const response = await fetch(import.meta.env.BASE_URL + path, { signal });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.arrayBuffer();
}

function generateTerrainInWorker(signal: AbortSignal): Promise<ArrayBuffer> {
  const worker = new Worker(new URL('../scene/terrain/terrain.worker.ts', import.meta.url), { type: 'module' });
  let abort: () => void;
  return new Promise<ArrayBuffer>((resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<ArrayBuffer>) => resolve(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      reject(new Error(event.message || 'Terrain worker failed to load'));
    };
    worker.onmessageerror = () => reject(new Error('Could not read terrain worker data'));
    worker.postMessage(null);
  }).finally(() => {
    signal.removeEventListener('abort', abort);
    worker.terminate();
  });
}

async function loadBakedTerrain(signal: AbortSignal): Promise<TerrainTiles> {
  const [buffer, { MeshoptDecoder }] = await Promise.all([
    fetchWorldAsset(paths.terrain, signal),
    import('meshoptimizer/decoder'),
  ]);
  await MeshoptDecoder.ready;
  signal.throwIfAborted();
  return decodeTerrainTiles(buffer, MeshoptDecoder);
}

export async function loadWorldAssets(bakedTerrain: boolean, signal: AbortSignal): Promise<WorldAssets> {
  const [grass, water, terrain] = await Promise.all([
    loadMap(paths.grass, signal),
    loadMap(paths.water, signal),
    bakedTerrain ? loadBakedTerrain(signal) : generateTerrainInWorker(signal).then(buffer => decodeTerrainTiles(buffer)),
  ]);
  return { grass, water, terrain };
}
