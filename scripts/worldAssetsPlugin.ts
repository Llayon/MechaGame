import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import type { Plugin } from 'vite';
import { packOverview } from './packOverview';
import { bakeTerrainGrassMap } from '../src/map/grassField';
import { bakeWaterDepthData } from '../src/map/waterDepth';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from '../src/map/worldMapDimensions';
import { generateGroundTiles, generateMountainTiles } from '../src/scene/terrain/generateTerrain';
import { encodeTerrainTiles, type TerrainTiles } from '../src/scene/terrain/terrainTileCodec';

const moduleId = 'virtual:world-asset-paths';
const resolvedId = '\0' + moduleId;

type WorldAssetKey = 'overview' | 'grass' | 'water' | 'terrain';
const ASSET_KEYS: readonly WorldAssetKey[] = ['overview', 'grass', 'water', 'terrain'];
const DEV_ASSET_PATHS: Record<WorldAssetKey, string> = {
  overview: 'assets/world/overview.bin',
  grass: 'assets/world/grass.bin',
  water: 'assets/world/water.bin',
  terrain: 'assets/world/terrain.bin',
};

const CACHE_DIR = path.resolve(import.meta.dirname, '..', 'node_modules', '.cache', 'world-assets');
const CACHE_SCHEMA_VERSION = 'v1';

interface BakedAsset {
  key: WorldAssetKey;
  path: string;
  data: Uint8Array;
}

function computeSourceFingerprint(): string {
  const root = path.resolve(import.meta.dirname, '..');
  const mapDir = path.join(root, 'src', 'map');
  const files: string[] = [
    path.join(root, 'scripts', 'worldAssetsPlugin.ts'),
    path.join(root, 'scripts', 'packOverview.ts'),
    path.join(root, 'src', 'scene', 'terrain', 'generateTerrain.ts'),
    path.join(root, 'src', 'scene', 'terrain', 'terrainChunks.ts'),
    path.join(root, 'src', 'scene', 'terrain', 'terrainTileCodec.ts'),
  ];
  for (const entry of readdirSync(mapDir).sort()) {
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(path.join(mapDir, entry));
    }
  }
  const hash = createHash('sha256').update(CACHE_SCHEMA_VERSION);
  for (const file of files) {
    hash.update(path.relative(root, file)).update('\0').update(readFileSync(file));
  }
  return hash.digest('hex').slice(0, 16);
}

function readCachedAsset(fingerprint: string, key: WorldAssetKey): Uint8Array | undefined {
  try {
    return new Uint8Array(readFileSync(path.join(CACHE_DIR, `${fingerprint}-${key}.bin`)));
  } catch {
    return undefined;
  }
}

function writeCachedAsset(fingerprint: string, key: WorldAssetKey, data: Uint8Array): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const target = path.join(CACHE_DIR, `${fingerprint}-${key}.bin`);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, target);
  } catch {
    // Disk cache is best-effort; ignore read-only or concurrent rename failures.
  }
}

export function worldAssetsPlugin(): Plugin {
  let base = '/';
  let isServe = false;
  let fingerprint: string | undefined;
  let tilesPromise: Promise<TerrainTiles> | undefined;
  const assetPromises = new Map<WorldAssetKey, Promise<BakedAsset>>();
  let allAssetsPromise: Promise<BakedAsset[]> | undefined;

  const getFingerprint = () => (fingerprint ??= computeSourceFingerprint());

  const getTiles = (): Promise<TerrainTiles> =>
    (tilesPromise ??= Promise.resolve().then(() => ({
      ground: generateGroundTiles(),
      mountains: generateMountainTiles(),
    })));

  const bakeAssetData = async (key: WorldAssetKey): Promise<Uint8Array> => {
    const fp = getFingerprint();
    const cached = readCachedAsset(fp, key);
    if (cached) return cached;

    let data: Uint8Array;
    if (key === 'water') {
      data = bakeWaterDepthData(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT);
    } else if (key === 'grass') {
      data = bakeTerrainGrassMap(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT);
    } else if (key === 'overview') {
      data = packOverview(await getTiles());
    } else {
      await MeshoptEncoder.ready;
      data = new Uint8Array(encodeTerrainTiles(await getTiles(), MeshoptEncoder));
    }
    writeCachedAsset(fp, key, data);
    return data;
  };

  const getAsset = (key: WorldAssetKey): Promise<BakedAsset> => {
    let pending = assetPromises.get(key);
    if (!pending) {
      pending = bakeAssetData(key).then((data) => {
        const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
        return { key, path: `assets/world/${key}-${hash}.bin`, data };
      });
      assetPromises.set(key, pending);
    }
    return pending;
  };

  const getAllAssets = (): Promise<BakedAsset[]> =>
    (allAssetsPromise ??= Promise.all(ASSET_KEYS.map((key) => getAsset(key))));

  return {
    name: 'world-assets',
    configResolved(config) {
      base = config.base;
      isServe = config.command === 'serve';
    },
    async transformIndexHtml() {
      const overviewPath = isServe ? DEV_ASSET_PATHS.overview : (await getAsset('overview')).path;
      const urls = [overviewPath, 'landmarks.bin.gz', 'landmark-color.webp', 'overview-ground.webp'].map(
        (assetPath) => base + assetPath,
      );
      return [{
        tag: 'script',
        injectTo: 'head-prepend',
        children: `(() => {
          const query = new URLSearchParams(location.search);
          if (query.get('autostart') === '1') return;
          const hasOverride = ['entry', 'surface', 'terrain'].some(key => query.has(key));
          if (hasOverride && !(query.get('entry') === 'landmarks' && query.get('surface') === 'stream' && query.get('terrain') === 'baked')) return;
          for (const href of ${JSON.stringify(urls)}) {
            const link = document.createElement('link');
            link.rel = 'preload'; link.as = 'fetch'; link.crossOrigin = 'anonymous'; link.href = href;
            document.head.append(link);
          }
        })();`,
      }];
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    async load(id) {
      if (id === resolvedId) {
        if (isServe) {
          return 'export default ' + JSON.stringify(DEV_ASSET_PATHS);
        }
        const paths = Object.fromEntries((await getAllAssets()).map(({ key, path: assetPath }) => [key, assetPath]));
        return 'export default ' + JSON.stringify(paths);
      }
    },
    async buildStart() {
      if (this.environment.config.consumer !== 'client' || this.environment.mode !== 'build') return;
      for (const { path: fileName, data } of await getAllAssets()) {
        this.emitFile({ type: 'asset', fileName, source: data });
      }
    },
    configureServer(server) {
      const prefix = server.config.base + 'assets/world/';
      server.middlewares.use((req, res, next) => {
        const reqPath = req.url?.split('?')[0];
        if (!reqPath?.startsWith(prefix)) return next();
        const fileName = reqPath.slice(prefix.length);
        const match = /^(overview|grass|water|terrain)(?:-[a-f0-9]+)?\.bin$/.exec(fileName);
        if (!match) return next();
        const key = match[1] as WorldAssetKey;
        getAsset(key)
          .then((asset) => {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(asset.data);
          })
          .catch(next);
      });
    },
  };
}
