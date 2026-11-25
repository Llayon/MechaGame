import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { discoverWaterfallSites } from '../src/map/waterfalls.ts';

const moduleId = 'virtual:world-asset-paths';
const resolvedId = '\0' + moduleId;
const waterfallSitesId = 'virtual:waterfall-sites';

type WorldAssetKey = 'overview' | 'grass' | 'water' | 'terrain';
type BakeTarget = WorldAssetKey | 'all';

const ASSET_KEYS: readonly WorldAssetKey[] = ['overview', 'grass', 'water', 'terrain'];
const DEV_ASSET_PATHS: Record<WorldAssetKey, string> = {
  overview: 'assets/world/overview.bin',
  grass: 'assets/world/grass.bin',
  water: 'assets/world/water.bin',
  terrain: 'assets/world/terrain.bin',
};

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT_DIR, 'node_modules', '.cache', 'world-assets');
const TSX_CLI = path.join(ROOT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const BAKE_SCRIPT = path.join(ROOT_DIR, 'scripts', 'bakeWorldAsset.ts');
const CACHE_SCHEMA_VERSION = 'v1';

interface BakedAsset {
  key: WorldAssetKey;
  path: string;
  data: Uint8Array;
}

function computeSourceFingerprint(): string {
  const mapDir = path.join(ROOT_DIR, 'src', 'map');
  const files: string[] = [
    path.join(ROOT_DIR, 'scripts', 'worldAssetsPlugin.ts'),
    path.join(ROOT_DIR, 'scripts', 'bakeWorldAsset.ts'),
    path.join(ROOT_DIR, 'scripts', 'packOverview.ts'),
    path.join(ROOT_DIR, 'src', 'scene', 'terrain', 'generateTerrain.ts'),
    path.join(ROOT_DIR, 'src', 'scene', 'terrain', 'terrainChunks.ts'),
    path.join(ROOT_DIR, 'src', 'scene', 'terrain', 'terrainTileCodec.ts'),
  ];
  for (const entry of readdirSync(mapDir).sort()) {
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(path.join(mapDir, entry));
    }
  }
  const hash = createHash('sha256').update(CACHE_SCHEMA_VERSION);
  for (const file of files) {
    hash.update(path.relative(ROOT_DIR, file)).update('\0').update(readFileSync(file));
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

function runBaker(fingerprint: string, target: BakeTarget): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [TSX_CLI, BAKE_SCRIPT, CACHE_DIR, fingerprint, target],
      { cwd: ROOT_DIR, maxBuffer: 4 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve();
      },
    );
  });
}

export function worldAssetsPlugin(): Plugin {
  let base = '/';
  let isServe = false;
  let fingerprint: string | undefined;
  let bakeQueue: Promise<void> = Promise.resolve();
  let tilesBakePromise: Promise<void> | undefined;
  let allBakePromise: Promise<void> | undefined;
  const assetPromises = new Map<WorldAssetKey, Promise<BakedAsset>>();
  let allAssetsPromise: Promise<BakedAsset[]> | undefined;

  const enqueueBaker = (fp: string, target: BakeTarget): Promise<void> => {
    const task = bakeQueue.then(() => runBaker(fp, target));
    bakeQueue = task.catch(() => {});
    return task;
  };

  const getFingerprint = () => (fingerprint ??= computeSourceFingerprint());

  const ensureBaked = async (key: WorldAssetKey): Promise<Uint8Array> => {
    const fp = getFingerprint();
    const cached = readCachedAsset(fp, key);
    if (cached) return cached;

    if (key === 'overview' || key === 'terrain') {
      await (tilesBakePromise ??= enqueueBaker(fp, 'overview').catch((err) => {
        tilesBakePromise = undefined;
        throw err;
      }));
    } else {
      await enqueueBaker(fp, key);
    }

    const fresh = readCachedAsset(fp, key);
    if (!fresh) {
      throw new Error(`World asset "${key}" was not written to cache`);
    }
    return fresh;
  };

  const getAsset = (key: WorldAssetKey): Promise<BakedAsset> => {
    let pending = assetPromises.get(key);
    if (!pending) {
      pending = ensureBaked(key)
        .then((data) => {
          const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
          return { key, path: `assets/world/${key}-${hash}.bin`, data };
        })
        .catch((err) => {
          assetPromises.delete(key);
          throw err;
        });
      assetPromises.set(key, pending);
    }
    return pending;
  };

  const getAllAssets = (): Promise<BakedAsset[]> =>
    (allAssetsPromise ??= (async () => {
      const fp = getFingerprint();
      const missing = ASSET_KEYS.some((key) => !readCachedAsset(fp, key));
      if (missing) {
        await (allBakePromise ??= enqueueBaker(fp, 'all'));
      }
      return Promise.all(ASSET_KEYS.map((key) => getAsset(key)));
    })().catch((err) => {
      allAssetsPromise = undefined;
      allBakePromise = undefined;
      throw err;
    }));

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
      if (id === waterfallSitesId) return '\0' + waterfallSitesId;
    },
    async load(id) {
      if (id === '\0' + waterfallSitesId) {
        return 'export default ' + JSON.stringify(discoverWaterfallSites(4));
      }
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
