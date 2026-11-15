import {
  ALL_ROADS,
  BRIDGE_SPECS,
  MAP_HALF_D,
  MAP_HALF_W,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  ROAD_HALF_WIDTH,
  SCALE_X,
  SCALE_Z,
  VIADUCT_ELBOW,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  distToPolyline,
  distToSegment,
  fbm2D,
  getAirfieldPadMask,
  getBridgeSegments,
  getCitadelPlateauMask,
  getCitadelTerraceMask,
  getRiverInfo,
  getTerrainHeight,
  getTerrainSlope,
} from './terrainMath';

export interface BarricadeNode {
  x: number;
  z: number;
  rotY: number;
  kind: 'hedgehog' | 'dragon-tooth' | 'jersey-block';
  scale?: number;
}

export const LEFT_OUTPOST_POS: readonly [number, number] = [-154, -26];
export const LEFT_FUEL_DEPOT_POS: readonly [number, number] = [-162, 4];
export const RIVER_BEND_PIER_POS: readonly [number, number] = [101, 108];

export const RIVER_BEND_LEDGES: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [120, 80], rotY: -0.45, scale: 1.25 },
  { pos: [50, 118], rotY: 0.65, scale: 1.2 },
];

export const HQ_FOREFIELD_CONVOYS: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [-74, 86], rotY: -0.52, scale: 1.05 },
  { pos: [-46, 66], rotY: 0.35, scale: 1.0 },
];

export const HQ_FOREFIELD_ROCK_RIDGES: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [-106, 52], rotY: 0.65, scale: 1.25 },
  { pos: [-62, 64], rotY: -0.22, scale: 1.25 },
  { pos: [-28, 70], rotY: -0.35, scale: 1.2 },
];

export const HQ_FOREFIELD_SCREENS: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  width: number;
  height: number;
}> = [
  { pos: [-92, 82], rotY: 0.55, width: 11.0, height: 3.1 },
  { pos: [-52, 72], rotY: 0.35, width: 10.0, height: 2.95 },
];

export const ANTI_MECH_BARRICADE_NODES: ReadonlyArray<BarricadeNode> = [
  { x: -178, z: 22, rotY: 0.25, kind: 'dragon-tooth', scale: 1.15 },
  { x: -172, z: 24.5, rotY: 0.18, kind: 'hedgehog', scale: 1.15 },
  { x: -165.5, z: 26, rotY: 0.1, kind: 'jersey-block', scale: 1.1 },
  { x: -158.5, z: 26.2, rotY: 0.04, kind: 'dragon-tooth', scale: 1.2 },
  { x: -152, z: 25.5, rotY: -0.05, kind: 'hedgehog', scale: 1.15 },
  { x: -145, z: 24.2, rotY: -0.14, kind: 'jersey-block', scale: 1.1 },
  { x: -137.5, z: 24.5, rotY: -0.22, kind: 'dragon-tooth', scale: 1.15 },
  { x: -141, z: -2, rotY: 1.38, kind: 'hedgehog', scale: 1.12 },
  { x: -139.5, z: -9.5, rotY: 1.45, kind: 'jersey-block', scale: 1.1 },
  { x: -137.5, z: -17.5, rotY: 1.48, kind: 'dragon-tooth', scale: 1.2 },
  { x: -135.5, z: -25.5, rotY: 1.52, kind: 'hedgehog', scale: 1.15 },
  { x: -134, z: -33.5, rotY: 1.58, kind: 'jersey-block', scale: 1.08 },
  { x: -89, z: 91, rotY: 0.48, kind: 'dragon-tooth', scale: 1.18 },
  { x: -83.5, z: 94, rotY: 0.42, kind: 'jersey-block', scale: 1.15 },
  { x: -78, z: 96, rotY: 0.32, kind: 'hedgehog', scale: 1.18 },
  { x: -57, z: 55.5, rotY: 0.15, kind: 'jersey-block', scale: 1.15 },
  { x: -50, z: 56.8, rotY: 0.08, kind: 'hedgehog', scale: 1.15 },
  { x: -43, z: 58, rotY: -0.05, kind: 'dragon-tooth', scale: 1.18 },
];

export const FLANK_EXCLUSION_ZONES: ReadonlyArray<{ x: number; z: number; r: number }> = [
  { x: LEFT_OUTPOST_POS[0], z: LEFT_OUTPOST_POS[1], r: 14.5 },
  { x: LEFT_FUEL_DEPOT_POS[0], z: LEFT_FUEL_DEPOT_POS[1], r: 13.5 },
  { x: RIVER_BEND_PIER_POS[0], z: RIVER_BEND_PIER_POS[1], r: 22.0 },
  { x: 120, z: 80, r: 9.5 },
  { x: 50, z: 118, r: 9.5 },
  { x: -74, z: 86, r: 11.5 },
  { x: -46, z: 66, r: 11.0 },
  { x: -106, z: 52, r: 9.5 },
  { x: -62, z: 64, r: 9.5 },
  { x: -28, z: 70, r: 9.5 },
  { x: -92, z: 82, r: 8.5 },
  { x: -52, z: 72, r: 8.5 },
];

export const BUNKER_COORDS: ReadonlyArray<{ x: number; z: number; rotY: number }> = [
  { x: -136, z: 15, rotY: 1.2 },
  { x: -118, z: -55, rotY: 0.9 },
  { x: -28, z: -104, rotY: 0.15 },
  { x: 34, z: -116, rotY: -0.35 },
  { x: -38, z: 112, rotY: 2.9 },
  { x: 32, z: 102, rotY: -2.5 },
  { x: 134, z: 62, rotY: -1.65 },
  { x: -64, z: 96, rotY: 0.42 },
];

export const WRECK_COORDS: ReadonlyArray<{
  x: number;
  z: number;
  rotY: number;
  scale: number;
}> = [
  { x: -142, z: 32, rotY: 0.8, scale: 1.25 },
  { x: -122, z: -88, rotY: 2.1, scale: 1.3 },
  { x: -22, z: -94, rotY: -0.6, scale: 1.2 },
  { x: 10, z: -105, rotY: 1.35, scale: 1.35 },
  { x: -50, z: 114, rotY: -1.9, scale: 1.25 },
  { x: 12, z: 108, rotY: 0.45, scale: 1.3 },
  { x: 142, z: 34, rotY: 2.5, scale: 1.25 },
  { x: 136, z: 96, rotY: -0.75, scale: 1.3 },
];

export const WEST_FLANK_POWERLINE: ReadonlyArray<readonly [number, number]> = [
  [-138, 22],
  [-132, -4],
  [-126, -32],
  [-120, -60],
  [-112, -88],
];

export const SOUTH_FLANK_POWERLINE: ReadonlyArray<readonly [number, number]> = [
  [-58, 108],
  [-32, 112],
  [-4, 114],
  [24, 112],
];

export const DEFAULT_POWERLINE_POLE_COORDS: ReadonlyArray<readonly [number, number]> = [
  [-10.2 * SCALE_X, -9.2 * SCALE_Z],
  [-8.8 * SCALE_X, -9.9 * SCALE_Z],
  [-7.4 * SCALE_X, -10.6 * SCALE_Z],
  [-6.0 * SCALE_X, -11.0 * SCALE_Z],
  [-4.6 * SCALE_X, -11.3 * SCALE_Z],
  [-3.2 * SCALE_X, -11.3 * SCALE_Z],
  [-1.8 * SCALE_X, -11.3 * SCALE_Z],
  [-0.3 * SCALE_X, -11.1 * SCALE_Z],
  [1.2 * SCALE_X, -10.9 * SCALE_Z],
  [2.7 * SCALE_X, -10.65 * SCALE_Z],
  [4.2 * SCALE_X, -10.4 * SCALE_Z],
];

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function isClearForFoliage(x: number, z: number, extraMargin = 0): boolean {
  if (Math.abs(x) > MAP_HALF_W - 4.5 || Math.abs(z) > MAP_HALF_D - 4.5) return false;
  if (getAirfieldPadMask(x, z) > 0.14) return false;
  if (getCitadelPlateauMask(x, z) > 0.12) return false;
  if (getCitadelTerraceMask(x, z) > 0.25) return false;
  if (Math.hypot(x - QUARRY_CENTER_X, z - QUARRY_CENTER_Z) < 17.5 + extraMargin) return false;
  if (Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]) < 15.2 + extraMargin) return false;

  const dRoad = Math.min(...ALL_ROADS.map((road) => distToPolyline(x, z, road)));
  if (dRoad < ROAD_HALF_WIDTH + 2.9 + extraMargin) return false;

  const nearBridge = BRIDGE_SPECS.some((b) =>
    getBridgeSegments(b).some(
      ([s, e]) => distToSegment(x, z, s[0], s[1], e[0], e[1]) < b.width * 0.65 + 3.0 + extraMargin,
    ),
  );
  if (nearBridge) return false;

  const nearRamp = WALKABLE_RAMPS.some(
    (r) => distToSegment(x, z, r[0], r[1], r[2], r[3]) < r[4] + 2.2 + extraMargin,
  );
  if (nearRamp) return false;

  if (BUNKER_COORDS.some((b) => Math.hypot(x - b.x, z - b.z) < 6.6 + extraMargin)) return false;
  if (WRECK_COORDS.some((w) => Math.hypot(x - w.x, z - w.z) < 5.0 + extraMargin)) return false;
  if (
    FLANK_EXCLUSION_ZONES.some(
      (zZone) => Math.hypot(x - zZone.x, z - zZone.z) < zZone.r + extraMargin,
    )
  ) {
    return false;
  }
  if (ANTI_MECH_BARRICADE_NODES.some((n) => Math.hypot(x - n.x, z - n.z) < 4.4 + extraMargin)) {
    return false;
  }
  return true;
}

function isClearForRock(x: number, z: number): boolean {
  if (Math.abs(x) > MAP_HALF_W - 4.0 || Math.abs(z) > MAP_HALF_D - 4.0) return false;
  if (getAirfieldPadMask(x, z) > 0.15 || getCitadelPlateauMask(x, z) > 0.18) return false;
  if (getCitadelTerraceMask(x, z) > 0.55) return false;
  if (getRiverInfo(x, z).islandMask > 0.22) return false;
  if (Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]) < 15.5) return false;

  const dRoad = Math.min(...ALL_ROADS.map((road) => distToPolyline(x, z, road)));
  if (dRoad < ROAD_HALF_WIDTH + 3.8) return false;

  const nearBridge = BRIDGE_SPECS.some((b) =>
    getBridgeSegments(b).some(
      ([s, e]) => distToSegment(x, z, s[0], s[1], e[0], e[1]) < b.width * 0.65 + 3.2,
    ),
  );
  if (nearBridge) return false;

  const nearRamp = WALKABLE_RAMPS.some(
    (r) => distToSegment(x, z, r[0], r[1], r[2], r[3]) < r[4] + 2.8,
  );
  if (nearRamp) return false;

  if (BUNKER_COORDS.some((b) => Math.hypot(x - b.x, z - b.z) < 7.8)) return false;
  if (WRECK_COORDS.some((w) => Math.hypot(x - w.x, z - w.z) < 5.8)) return false;
  if (FLANK_EXCLUSION_ZONES.some((zZone) => Math.hypot(x - zZone.x, z - zZone.z) < zZone.r)) {
    return false;
  }
  if (ANTI_MECH_BARRICADE_NODES.some((n) => Math.hypot(x - n.x, z - n.z) < 4.5)) return false;

  return true;
}

export interface PineTreeInstance {
  x: number;
  y: number;
  z: number;
  heightScale: number;
  widthScale: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  tint: number;
}

export interface PineForestData {
  trees: PineTreeInstance[];
  shrubs: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rotY: number;
    tint: number;
  }>;
  logs: Array<{
    x: number;
    y: number;
    z: number;
    len: number;
    rad: number;
    rotY: number;
    tiltX: number;
    tint: number;
  }>;
  rootRocks: Array<{
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rotY: number;
    tint: number;
  }>;
}

let cachedPineForestData: PineForestData | null = null;

export function generatePineForestData(): PineForestData {
  if (cachedPineForestData) return cachedPineForestData;

  const treeList: PineTreeInstance[] = [];
  const shrubList: PineForestData['shrubs'] = [];
  const logList: PineForestData['logs'] = [];
  const rootRockList: PineForestData['rootRocks'] = [];

  const groveCenters: Array<{ x: number; z: number; radius: number; density: number }> = [];
  for (let i = 0; i < 1800 && groveCenters.length < 44; i++) {
    const gx = (seededRand(i * 7 + 11) * 2 - 1) * (MAP_HALF_W - 10.0);
    const gz = (seededRand(i * 7 + 13) * 2 - 1) * (MAP_HALF_D - 10.0);

    const river = getRiverInfo(gx, gz);
    const gy = getTerrainHeight(gx, gz);
    const gSlope = getTerrainSlope(gx, gz);

    if (river.channelMask > 0.04 || river.islandMask > 0.2) continue;
    if (gy < WATER_LEVEL + 1.3 || gy > 8.4) continue;
    if (gSlope > 0.42) continue;
    if (!isClearForFoliage(gx, gz, 2.0)) continue;

    const moisture = fbm2D(gx * 0.025 + 4.2, gz * 0.025 - 2.1, 2);
    if (moisture < 0.42) continue;
    if (groveCenters.some((c) => Math.hypot(gx - c.x, gz - c.z) < 21.0)) continue;

    const radius = 10.5 + seededRand(i * 11 + 3) * 10.5;
    const density = 32 + Math.floor(seededRand(i * 13 + 5) * 40);
    groveCenters.push({ x: gx, z: gz, radius, density });
  }

  groveCenters.forEach((grove, gIdx) => {
    for (let k = 0; k < grove.density && treeList.length < 2250; k++) {
      const seedBase = gIdx * 1009 + k * 29;
      const u1 = Math.max(0.02, seededRand(seedBase + 1));
      const r = Math.pow(u1, 0.72) * grove.radius;
      const ang = seededRand(seedBase + 2) * Math.PI * 2;
      const x = grove.x + Math.cos(ang) * r;
      const z = grove.z + Math.sin(ang) * r;

      const river = getRiverInfo(x, z);
      const y = getTerrainHeight(x, z);
      const slope = getTerrainSlope(x, z);

      if (river.channelMask > 0.06 || river.islandMask > 0.22 || y < WATER_LEVEL + 1.0) continue;
      if (y > 9.2 || slope > 0.48) continue;
      if (!isClearForFoliage(x, z)) continue;

      const coreFactor = 1.0 - Math.min(1.0, r / grove.radius);
      const baseScale =
        (0.76 + coreFactor * 0.34 + seededRand(seedBase + 3) * 0.48) * 1.42;
      const rotY = seededRand(seedBase + 4) * Math.PI * 2;
      const tint = seededRand(seedBase + 5);
      const heightScale = baseScale * (0.8 + seededRand(seedBase + 24) * 0.42);
      const widthScale = baseScale * (0.85 + seededRand(seedBase + 25) * 0.32);
      const tiltX = (seededRand(seedBase + 26) - 0.5) * 0.09;
      const tiltZ = (seededRand(seedBase + 27) - 0.5) * 0.09;

      treeList.push({
        x,
        y,
        z,
        heightScale,
        widthScale,
        rotY,
        tiltX,
        tiltZ,
        tint,
      });

      if (shrubList.length < 1150 && seededRand(seedBase + 6) < 0.56) {
        const sAng = seededRand(seedBase + 7) * Math.PI * 2;
        const sDist = 0.45 + seededRand(seedBase + 8) * 1.35;
        const sxPos = x + Math.cos(sAng) * sDist;
        const szPos = z + Math.sin(sAng) * sDist;
        const syPos = getTerrainHeight(sxPos, szPos);
        if (syPos > WATER_LEVEL + 0.8 && getTerrainSlope(sxPos, szPos) < 0.52) {
          const sBase = 0.48 + seededRand(seedBase + 9) * 0.52;
          shrubList.push({
            x: sxPos,
            y: syPos,
            z: szPos,
            sx: sBase * (1.1 + seededRand(seedBase + 10) * 0.5),
            sy: sBase * (0.62 + seededRand(seedBase + 11) * 0.35),
            sz: sBase * (1.1 + seededRand(seedBase + 12) * 0.5),
            rotY: seededRand(seedBase + 13) * Math.PI * 2,
            tint: seededRand(seedBase + 14),
          });
        }
      }

      if (rootRockList.length < 300 && seededRand(seedBase + 15) < (y > 5.0 ? 0.2 : 0.11)) {
        const rAng = seededRand(seedBase + 16) * Math.PI * 2;
        const rDist = 0.55 + seededRand(seedBase + 17) * 1.1;
        const rxPos = x + Math.cos(rAng) * rDist;
        const rzPos = z + Math.sin(rAng) * rDist;
        const ryPos = getTerrainHeight(rxPos, rzPos);
        if (ryPos > WATER_LEVEL + 0.6 && isClearForFoliage(rxPos, rzPos)) {
          const bScale = 0.62 + seededRand(seedBase + 18) * 0.85;
          rootRockList.push({
            x: rxPos,
            y: ryPos,
            z: rzPos,
            sx: bScale * (1.0 + seededRand(seedBase + 19) * 0.55),
            sy: bScale * (0.65 + seededRand(seedBase + 20) * 0.35),
            sz: bScale * (0.95 + seededRand(seedBase + 21) * 0.5),
            rotY: seededRand(seedBase + 22) * Math.PI * 2,
            tint: seededRand(seedBase + 23),
          });
        }
      }
    }

    const logCount = 3 + Math.floor(seededRand(gIdx * 97 + 1) * 4);
    for (let l = 0; l < logCount && logList.length < 220; l++) {
      const lSeed = gIdx * 733 + l * 41;
      const lr = Math.pow(seededRand(lSeed + 1), 0.8) * grove.radius * 0.92;
      const lang = seededRand(lSeed + 2) * Math.PI * 2;
      const lx = grove.x + Math.cos(lang) * lr;
      const lz = grove.z + Math.sin(lang) * lr;
      const ly = getTerrainHeight(lx, lz);
      if (ly < WATER_LEVEL + 1.0 || ly > 9.0 || getTerrainSlope(lx, lz) > 0.38) continue;
      if (!isClearForFoliage(lx, lz)) continue;

      const rotY = seededRand(lSeed + 3) * Math.PI * 2;
      const hAhead = getTerrainHeight(lx + Math.cos(rotY) * 1.1, lz + Math.sin(rotY) * 1.1);
      const hBehind = getTerrainHeight(lx - Math.cos(rotY) * 1.1, lz - Math.sin(rotY) * 1.1);
      const tiltX = Math.atan2(hAhead - hBehind, 2.2);

      logList.push({
        x: lx,
        y: ly,
        z: lz,
        len: 1.85 + seededRand(lSeed + 4) * 1.55,
        rad: 0.13 + seededRand(lSeed + 5) * 0.08,
        rotY,
        tiltX,
        tint: seededRand(lSeed + 6),
      });
    }
  });

  cachedPineForestData = {
    trees: treeList,
    shrubs: shrubList,
    logs: logList,
    rootRocks: rootRockList,
  };
  return cachedPineForestData;
}

export interface RockOutcropInstance {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
}

let cachedRockOutcropsData: RockOutcropInstance[] | null = null;

export function generateRockOutcropsData(): RockOutcropInstance[] {
  if (cachedRockOutcropsData) return cachedRockOutcropsData;

  const list: RockOutcropInstance[] = [];
  for (let i = 0; i < 3600 && list.length < 820; i++) {
    const cx = (seededRand(i * 5 + 101) * 2 - 1) * (MAP_HALF_W - 6.0);
    const cz = (seededRand(i * 5 + 102) * 2 - 1) * (MAP_HALF_D - 6.0);
    const cy = getTerrainHeight(cx, cz);
    const slope = getTerrainSlope(cx, cz);
    const river = getRiverInfo(cx, cz);

    const isWindsweptHeight = cy > 7.8;
    const isSteepRidge = slope > 0.38;
    const nearShore = river.channelMask > 0.02 && river.channelMask < 0.28;
    const nearQuarry = Math.hypot(cx - QUARRY_CENTER_X, cz - QUARRY_CENTER_Z) < 34;

    if (!isWindsweptHeight && !isSteepRidge && !nearShore && !nearQuarry) continue;
    if (cy < WATER_LEVEL - 0.25) continue;
    if (!isClearForRock(cx, cz)) continue;

    const clusterNoise = fbm2D(cx * 0.036 - 1.8, cz * 0.036 + 3.4, 2);
    if (clusterNoise < 0.38 && !nearShore) continue;

    const clusterSize =
      isWindsweptHeight || isSteepRidge
        ? 3 + Math.floor(seededRand(i + 901) * 4)
        : 2 + Math.floor(seededRand(i + 902) * 2);

    for (let k = 0; k < clusterSize && list.length < 820; k++) {
      const ang = seededRand(i * 17 + k * 7 + 301) * Math.PI * 2;
      const dist = k === 0 ? 0 : 1.3 + seededRand(i * 19 + k * 11 + 302) * 3.9;
      const x = cx + Math.cos(ang) * dist;
      const z = cz + Math.sin(ang) * dist;
      if (k > 0 && !isClearForRock(x, z)) continue;
      const y = getTerrainHeight(x, z);
      if (y < WATER_LEVEL - 0.1) continue;

      const isHeroBoulder = k === 0 && (isWindsweptHeight || isSteepRidge);
      const baseScale = isHeroBoulder
        ? 1.25 + seededRand(i * 5 + k + 103) * 1.45
        : 0.55 + seededRand(i * 5 + k + 103) * 0.95;

      list.push({
        x,
        y,
        z,
        sx: baseScale * (0.85 + seededRand(i + k + 201) * 0.6),
        sy: baseScale * (0.58 + seededRand(i + k + 202) * 0.48),
        sz: baseScale * (0.85 + seededRand(i + k + 203) * 0.6),
        rotY: seededRand(i + k + 204) * Math.PI * 2,
      });
    }
  }

  cachedRockOutcropsData = list;
  return list;
}
