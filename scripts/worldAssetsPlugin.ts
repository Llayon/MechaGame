import { packOverview } from './packOverview';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { bakeTerrainGrassMap } from '../src/map/grassField';
import { bakeWaterDepthData } from '../src/map/waterDepth';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from '../src/map/worldMapDimensions';

import { generateGroundTiles, generateMountainTiles } from '../src/scene/terrain/generateTerrain';
import { encodeTerrainTiles } from '../src/scene/terrain/terrainTileCodec';

const moduleId = 'virtual:world-asset-paths';
const resolvedId = '\0' + moduleId;

export function worldAssetsPlugin(): Plugin {
  let assets: ReturnType<typeof bakeAssets> | undefined;
  const getAssets = () => assets ??= bakeAssets();
  let base = '/';

  return {
    name: 'world-assets',
    configResolved(config) { base = config.base; },
    transformIndexHtml() {
      const overview = getAssets().find(asset => asset.key === 'overview')!;
      const urls = [overview.path, 'landmarks.bin.gz', 'landmark-color.webp', 'overview-ground.webp'].map(path => base + path);
      return [{
        tag: 'script', injectTo: 'head-prepend',
        children: `(() => {
          const query = new URLSearchParams(location.search);
          if (query.get('entry') !== 'landmarks' || query.get('surface') !== 'stream' || query.get('terrain') !== 'baked' || query.get('autostart') === '1') return;
          for (const href of ${JSON.stringify(urls)}) {
            const link = document.createElement('link');
            link.rel = 'preload'; link.as = 'fetch'; link.crossOrigin = 'anonymous'; link.href = href;
            document.head.append(link);
          }
        })();`
      }];
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        const paths = Object.fromEntries(getAssets().map(({ key, path }) => [key, path]));
        return 'export default ' + JSON.stringify(paths);
      }
    },
    buildStart() {
      if (this.environment.config.consumer !== 'client' || this.environment.mode !== 'build') return;
      for (const { path, data } of getAssets()) {
        this.emitFile({ type: 'asset', fileName: path, source: data });
      }
    },
    configureServer(server) {
      getAssets();
      const prefix = server.config.base + 'assets/world/';
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (!path?.startsWith(prefix)) return next();
        const asset = getAssets().find((item) => server.config.base + item.path === path);
        if (!asset) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(asset.data);
      });
    },
  };
}

function bakeAssets() {
  const tiles = {ground: generateGroundTiles(), mountains: generateMountainTiles()};
  return [
    { key: 'overview', data: packOverview(tiles) },
    { key: 'grass', data: bakeTerrainGrassMap(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) },
    { key: 'water', data: bakeWaterDepthData(WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT) },
    {
      key: 'terrain',
      data: new Uint8Array(encodeTerrainTiles(tiles)),
    },
  ].map(({ key, data }) => {
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
    return { key, path: `assets/world/${key}-${hash}.bin`, data };
  });
}
