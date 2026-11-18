import * as THREE from 'three';
import {
  MAP_DEPTH,
  MAP_HALF_D,
  MAP_HALF_W,
  MAP_WIDTH,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  fbm2D,
  getAnalyticalTerrainNormal,
  getCitadelTerraceNormalizedDistance,
  getQuarryPadMask,
  getRiverInfo,
  getExtendedRiverDistance,
  getExtendedTerrainHeight,
  lerp,
  smoothstep,
  getRoadNormalizedDistance,
  getRockRampNormalizedDistance,
  getShoalNormalizedDistance,
  getTerrainHeight,
} from '../../map/terrainMath';
import { tileGrid, type TerrainTile } from './terrainChunks';


export function generateGroundTiles(): TerrainTile[] {
  const segX = 300;
  const segZ = 248;
  const geo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const zoneMasks = new Float32Array(pos.count * 4);
  const surfaceHints = new Float32Array(pos.count * 4);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    // Analytical normal sampled across radius slightly wider than ~1.34 grid step
    const n = getAnalyticalTerrainNormal(x, z, 1.95, true);
    normals[i * 3] = n.nx;
    normals[i * 3 + 1] = n.ny;
    normals[i * 3 + 2] = n.nz;

    const river = getRiverInfo(x, z);
    const qMask = getQuarryPadMask(x, z);
    const qDist = Math.hypot((x - QUARRY_CENTER_X) / 30, (z - QUARRY_CENTER_Z) / 28);
    const quarryNoise = fbm2D(x * 0.05 + 4.3, z * 0.05 - 2.9, 2);
    const qShape = Math.max(0, 1 - (qDist + (quarryNoise - 0.5) * 0.35));
    const quarryBlend = Math.min(1, Math.max(qMask * 0.92, qShape * 0.68));
    const riverVicinityMask =
      1.0 - Math.max(0, Math.min(1, (river.distToChannel - 22.0) / 14.0));

    zoneMasks[i * 4] = river.islandMask;
    zoneMasks[i * 4 + 1] = quarryBlend;
    zoneMasks[i * 4 + 2] = riverVicinityMask;
    zoneMasks[i * 4 + 3] = getRoadNormalizedDistance(x, z);

    surfaceHints[i * 4] = getShoalNormalizedDistance(x, z);
    surfaceHints[i * 4 + 1] = getRockRampNormalizedDistance(x, z);
    surfaceHints[i * 4 + 2] = river.channelMask;
    surfaceHints[i * 4 + 3] = getCitadelTerraceNormalizedDistance(x, z);
  }

  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aZoneMask', new THREE.BufferAttribute(zoneMasks, 4));
  geo.setAttribute('aSurfaceHint', new THREE.BufferAttribute(surfaceHints, 4));
  const tiles = tileGrid(geo, segX, segZ, 32, 32, false);
  geo.dispose();
  return tiles;
}

const OUTER_EXTENT = 540;
const RADIAL_STEPS = 36;
const SEG_X = 300;
const SEG_Z = 248;

/**
 * Seamless outer slate mountain amphitheater stitched vertex-for-vertex to the
 * 400x332 playable perimeter so the terrain transitions naturally into distant
 * mountain peaks and NW/SE river gorges without sharp rectangular slab edges.
 */
export function generateMountainTiles(): TerrainTile[] {
  const tiles: TerrainTile[] = [];
  const addStrip = (
    perimeterCount: number,
    samplePoint: (u: number, rNorm: number) => [number, number],
  ) => {
    const positions: number[] = [];
    const normals: number[] = [];
    const zoneMasks: number[] = [];
    const surfaceHints: number[] = [];
    const cols = perimeterCount + 1;
    const rows = RADIAL_STEPS + 1;

    for (let r = 0; r < rows; r++) {
      const rLinear = r / RADIAL_STEPS;
      // Cluster radial rings denser near the arena rim and mountain massif, stretch gently toward horizon mist
      const rNorm = rLinear * rLinear * 0.58 + rLinear * 0.42;
      // Match inner TerrainSurface eps (1.95) at the rim seam, then scale to match local radial quad spacing
      const radialStep = (OUTER_EXTENT / RADIAL_STEPS) * (1.16 * rLinear + 0.42);
      const normalEps = lerp(1.95, Math.max(2.2, radialStep * 0.78), smoothstep(0, 0.12, rLinear));

      for (let c = 0; c < cols; c++) {
        const u = c / perimeterCount;
        const [x, z] = samplePoint(u, rNorm);
        const y = getExtendedTerrainHeight(x, z);
        positions.push(x, y, z);

        const n = getAnalyticalTerrainNormal(x, z, normalEps, true);
        normals.push(n.nx, n.ny, n.nz);

        const dRiver = getExtendedRiverDistance(x, z);
        const riverVicinity = 1.0 - smoothstep(16.0, 34.0, dRiver);
        const channelApprox = 1.0 - smoothstep(11.0, 22.0, dRiver);

        zoneMasks.push(0.0, 0.0, riverVicinity, 20.0);
        surfaceHints.push(20.0, 20.0, channelApprox, 20.0);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('aZoneMask', new THREE.Float32BufferAttribute(zoneMasks, 4));
    geo.setAttribute('aSurfaceHint', new THREE.Float32BufferAttribute(surfaceHints, 4));
    tiles.push(...tileGrid(geo, perimeterCount, RADIAL_STEPS, 64, 12, true));
    geo.dispose();
  };
  // North outer mountain rim (u: -X -> +X, outward: -Z)
  addStrip(SEG_X, (u, rNorm) => {
    const d = rNorm * OUTER_EXTENT;
    return [lerp(-MAP_HALF_W - d, MAP_HALF_W + d, u), -MAP_HALF_D - d];
  });

  // East outer rim (u: -Z -> +Z, outward: +X)
  addStrip(SEG_Z, (u, rNorm) => {
    const d = rNorm * OUTER_EXTENT;
    return [MAP_HALF_W + d, lerp(-MAP_HALF_D - d, MAP_HALF_D + d, u)];
  });

  // South outer rim (u: +X -> -X, outward: +Z)
  addStrip(SEG_X, (u, rNorm) => {
    const d = rNorm * OUTER_EXTENT;
    return [lerp(MAP_HALF_W + d, -MAP_HALF_W - d, u), MAP_HALF_D + d];
  });

  // West outer rim (u: +Z -> -Z, outward: -X)
  addStrip(SEG_Z, (u, rNorm) => {
    const d = rNorm * OUTER_EXTENT;
    return [-MAP_HALF_W - d, lerp(MAP_HALF_D + d, -MAP_HALF_D - d, u)];
  });

  return tiles;
}
