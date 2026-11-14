export const METERS_PER_UNIT = 3.75;

// Coordinate basis preserved from Stage 1 (320 x 266 core), slab expanded to 400 x 332 (1500 x 1245 m)
// so rebuilt Airfield (+220 m setback), 230 m Island, and 3x Citadel have generous perimeter margins.
export const SCALE_X = 320 / 56; // ~5.7143
export const SCALE_Z = 266 / 36; // ~7.3889
export const SCALE_Y = 2.96; // 6.25 * 2.96 = 18.5 units (~69.4 m above water)

export const MAP_WIDTH = 400; // 400 * 3.75 = 1500 m
export const MAP_DEPTH = 332; // 332 * 3.75 = 1245 m
export const MAP_HALF_W = MAP_WIDTH / 2; // 200
export const MAP_HALF_D = MAP_DEPTH / 2; // 166

export const SLAB_BASE_Y = -8.0;
export const WATER_LEVEL = 0.0;

// Calibrated 30-35 m wide roads & bridges (8.4 - 9.0 units at 3.75 m/unit)
export const ROAD_HALF_WIDTH = 4.3; // 8.6 units = 32.25 m full road width

export type SurfaceKind =
  | 'water'
  | 'concrete'
  | 'road'
  | 'rock'
  | 'grass'
  | 'sand';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  // Ken Perlin's C2 quintic curve eliminates 2nd-derivative creases in lighting & blends
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Quantizes continuous elevation into gentle geological rock benches
 * separated by rocky cliff risers, scaled for 12 m Mechs without harsh contour rings.
 */
function terraceHeight(
  hVal: number,
  stepSize: number,
  sharpness: number,
  warp: number,
): number {
  const warped = hVal + warp;
  const phase = warped / stepSize;
  const idx = Math.floor(phase);
  const frac = phase - idx;
  const riser = smoothstep(0.52, 0.98, frac);
  const stepped = (idx + riser) * stepSize - warp;
  return lerp(hVal, stepped, sharpness);
}

// Deterministic 2D hash & C2-continuous quintic value noise
function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * freq, z * freq);
    norm += amplitude;
    freq *= 2.03;
    amplitude *= 0.5;
  }
  return value / norm;
}

export function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-6 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function distToPolyline(
  px: number,
  pz: number,
  pts: ReadonlyArray<readonly [number, number]>,
): number {
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(
      px,
      pz,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1],
    );
    if (d < minD) minD = d;
  }
  return minD;
}

function scalePts(
  pts: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<readonly [number, number]> {
  return pts.map(([x, z]) => [x * SCALE_X, z * SCALE_Z] as const);
}

// River path enters at NW, splits wide around the 230 m central industrial island, and exits at SE.
const RIVER_NORTH_CHANNEL = scalePts([
  [-19.5, -23.5],
  [-15.5, -18.5],
  [-13.0, -13.0],
  [-9.5, -7.8],
  [-3.2, -6.9],
  [3.6, -6.2],
  [7.6, -2.0],
  [9.2, 4.0],
  [10.8, 10.5],
  [14.5, 18.5],
  [17.5, 23.5],
]);

const RIVER_SOUTH_CHANNEL = scalePts([
  [-13.0, -13.0],
  [-10.6, -4.5],
  [-8.6, 2.2],
  [-4.2, 6.8],
  [2.5, 6.9],
  [8.2, 5.4],
  [10.8, 10.5],
]);

export const ISLAND_CENTER_X = -3.0;
export const ISLAND_CENTER_Z = 0.0;
export const ISLAND_DECK_RADIUS = 30.5; // 61.0 units = 228.75 m diameter (200-250 m target)

export const AIRFIELD_CENTER_X = -134.0;
export const AIRFIELD_CENTER_Z = 99.0;

export const CITADEL_CENTER_X = 122.0;
export const CITADEL_CENTER_Z = -78.0;
export const CITADEL_WALL_RX = 51.5; // ~3x larger courtyard footprint than Stage 1 (29.5 x 24.2)
export const CITADEL_WALL_RZ = 43.3;

export const QUARRY_CENTER_X = 18.5 * SCALE_X;
export const QUARRY_CENTER_Z = 4.5 * SCALE_Z;

export interface RiverInfo {
  distToChannel: number;
  channelMask: number; // 1 inside water, 0 on dry land
  islandMask: number; // 1 on central refinery island
}

export function getRiverInfo(x: number, z: number): RiverInfo {
  const nx = x / SCALE_X;
  const nz = z / SCALE_Z;
  const meander = (fbm2D(nx * 0.14 + 3.1, nz * 0.14 - 1.7, 2) - 0.5) * 6.0;
  const dNorth = distToPolyline(x, z, RIVER_NORTH_CHANNEL) + meander * 0.65;
  const dSouth = distToPolyline(x, z, RIVER_SOUTH_CHANNEL) + meander * 0.55;
  const dChannel = Math.min(dNorth, dSouth);

  // Channel half-width ~ 16.4 units (~61.5 m wide river channel)
  const channelWidth = 16.4;
  const rawChannel = 1 - smoothstep(channelWidth - 4.0, channelWidth + 7.2, dChannel);

  // Expanded 230 m Central Industrial Island (~41 x 36 terrain shoulder -> 30.5 radius concrete deck)
  const ix = (x - ISLAND_CENTER_X) / 41.0;
  const iz = (z - ISLAND_CENTER_Z) / 36.0;
  const iDist =
    Math.hypot(ix, iz) + (fbm2D(nx * 0.22 + 11, nz * 0.22 + 7, 2) - 0.5) * 0.14;
  const islandMask = 1 - smoothstep(0.72, 1.12, iDist);

  const channelMask = clamp(rawChannel * (1 - islandMask), 0, 1);
  return {
    distToChannel: dChannel,
    channelMask,
    islandMask,
  };
}

// Road network polylines (world units)
export const ROAD_MAIN_WEST: ReadonlyArray<readonly [number, number]> = [
  [-156, 122],
  [-140, 92],
  [-124, 52],
  [-104, 6],
  [-93, -24],
  [-89.0, -35.0], // Bridge A west abutment
  [-59.0, -56.5], // Bridge A midpoint
  [-29.1, -78.0], // Bridge A east abutment
  [-14.3, -79.8],
  [20.0, -75.4], // Point B cliff road
  [54.0, -106.0], // Serpentine climb around expanded Citadel north/east flank
  [104.0, -138.0],
  [158.0, -136.0],
  [186.0, -100.0],
  [182.0, -56.0],
  [148.0, -38.0],
  [122.0, -38.0], // Citadel South Gate approach
];

export const ROAD_SOUTH_SPINE: ReadonlyArray<readonly [number, number]> = [
  [-109, 86], // Exits Helipad Base NE gate
  [-92, 60],
  [-74, 28], // Center bridge west abutment
  [-52.75, 19.25], // Center bridge midpoint
  [-31.5, 10.5], // Center bridge onto expanded 230 m Island
  [-10.0, 3.0],
];

export const ROAD_SOUTH_EAST: ReadonlyArray<readonly [number, number]> = [
  [-92, 60],
  [-56, 86],
  [-12, 94],
  [24, 78],
  [32.0, 72.4], // East bridge west abutment
  [55.75, 57.2], // East bridge midpoint
  [79.5, 42.0], // East bridge east abutment
  [102.0, 33.25], // East quarry
  [134.0, 14.0],
  [162.0, -14.0],
  [148.0, -38.0], // Joins Citadel South Gate approach
];

export const ALL_ROADS = [
  ROAD_MAIN_WEST,
  ROAD_SOUTH_SPINE,
  ROAD_SOUTH_EAST,
] as const;

export interface BridgeSpec {
  id: string;
  label: string;
  start: readonly [number, number];
  end: readonly [number, number];
  startY: number;
  endY: number;
  deckY: number;
  width: number; // in world units (~3.75 m/unit -> 8.5 units ≈ 32 m)
  style: 'truss' | 'girder' | 'viaduct';
}

export const BRIDGE_SPECS: ReadonlyArray<BridgeSpec> = [
  {
    id: 'bridge-a',
    label: 'Crossing A Truss Bridge',
    start: [-89.0, -35.0],
    end: [-29.1, -78.0],
    startY: 3.10 * SCALE_Y,
    endY: 2.75 * SCALE_Y,
    deckY: 2.925 * SCALE_Y,
    width: 8.6, // 32.25 m
    style: 'truss',
  },
  {
    id: 'bridge-center',
    label: 'Refinery Span Bridge',
    start: [-74.0, 28.0],
    end: [-31.5, 10.5],
    startY: 1.62 * SCALE_Y,
    endY: 2.08 * SCALE_Y,
    deckY: 1.85 * SCALE_Y,
    width: 9.0, // 33.75 m
    style: 'girder',
  },
  {
    id: 'bridge-east',
    label: 'East Quarry Bridge',
    start: [32.0, 72.4],
    end: [79.5, 42.0],
    startY: 1.78 * SCALE_Y,
    endY: 2.25 * SCALE_Y,
    deckY: 2.015 * SCALE_Y,
    width: 8.4, // 31.5 m
    style: 'girder',
  },
  {
    id: 'viaduct-citadel',
    label: 'Elevated Island-to-Citadel Ramp & Tunnel',
    start: [25.0, -3.5],
    end: [74.42, -78.0],
    startY: 2.08 * SCALE_Y,
    endY: 6.2 * SCALE_Y,
    deckY: 4.14 * SCALE_Y,
    width: 8.5, // 31.9 m
    style: 'viaduct',
  },
];

export const BRIDGE_COVER_INTERVAL_M = 45;

/**
 * Computes evenly spaced local Z offsets along a bridge deck every ~40-50 m
 * (10.7-13.3 world units) for arch-pylons, cargo containers, and wrecks.
 * Stops safely ahead of the viaduct's 18-unit upper tunnel gallery.
 */
export function getBridgeSectionOffsets(spec: BridgeSpec): number[] {
  const dx = spec.end[0] - spec.start[0];
  const dz = spec.end[1] - spec.start[1];
  const dy = spec.endY - spec.startY;
  const spanLen = Math.hypot(dx, dz, dy);

  const zMin = spec.style === 'viaduct' ? -spanLen * 0.5 + 8.0 : -spanLen * 0.5 + 6.0;
  const zMax = spec.style === 'viaduct' ? spanLen * 0.5 - 22.0 : spanLen * 0.5 - 6.0;
  const usable = Math.max(12, zMax - zMin);
  const targetStep = BRIDGE_COVER_INTERVAL_M / METERS_PER_UNIT; // 12.0 units = 45 m
  const steps = Math.max(2, Math.round(usable / targetStep));
  const offsets: number[] = [];
  for (let i = 0; i <= steps; i++) {
    offsets.push(lerp(zMin, zMax, i / steps));
  }
  return offsets;
}

export const VIADUCT_ELBOW: readonly [number, number] = [35.0, -52.0];
export const VIADUCT_ELBOW_Y = ((2.08 + 6.2) * 0.5) * SCALE_Y; // ~12.25 units (~46 m mid-climb bastion)
export const VIADUCT_BASTION_HALF = 9.5;
export const VIADUCT_BASTION_RADIUS = 11.4;

export interface ViaductProfilePoint {
  t: number;
  yFrac: number;
}

// Legacy normalized 1D profile preserved for getViaductDeckYAtT queries across the two flights + central bastion
export const VIADUCT_PROFILE_POINTS: ReadonlyArray<ViaductProfilePoint> = [
  { t: 0.0, yFrac: 0.0 },
  { t: 0.4, yFrac: 0.5 }, // Central Bastion-Crossway entry (y ≈ 12.25 / 46 m)
  { t: 0.6, yFrac: 0.5 }, // Level Central Bastion-Crossway maneuvering deck
  { t: 1.0, yFrac: 1.0 }, // Flight 2 upper tunnel ramp into Citadel West Gate (18.35 / 68.8 m)
];

export function getViaductDeckYAtT(
  startY: number,
  endY: number,
  t: number,
): number {
  const ct = clamp(t, 0, 1);
  for (let i = 0; i < VIADUCT_PROFILE_POINTS.length - 1; i++) {
    const a = VIADUCT_PROFILE_POINTS[i];
    const b = VIADUCT_PROFILE_POINTS[i + 1];
    if (ct <= b.t || i === VIADUCT_PROFILE_POINTS.length - 2) {
      const span = Math.max(1e-6, b.t - a.t);
      const localT = clamp((ct - a.t) / span, 0, 1);
      return lerp(startY, endY, lerp(a.yFrac, b.yFrac, localT));
    }
  }
  return endY;
}

export function getBridgeSegments(
  bridge: BridgeSpec,
): ReadonlyArray<readonly [readonly [number, number], readonly [number, number]]> {
  if (bridge.style === 'viaduct') {
    return [
      [bridge.start, VIADUCT_ELBOW],
      [VIADUCT_ELBOW, bridge.end],
    ];
  }
  return [[bridge.start, bridge.end]];
}

export function getBridgeDeckYAt(
  bridge: BridgeSpec,
  x: number,
  z: number,
): number | null {
  if (bridge.style === 'viaduct') {
    // Central Bastion-Crossway octagonal platform around VIADUCT_ELBOW
    const dHub = Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]);
    if (dHub <= VIADUCT_BASTION_RADIUS) {
      return VIADUCT_ELBOW_Y + 0.52;
    }

    // Flight 1: start -> elbow (ramps from startY up to VIADUCT_ELBOW_Y at bastion edge)
    const dx1 = VIADUCT_ELBOW[0] - bridge.start[0];
    const dz1 = VIADUCT_ELBOW[1] - bridge.start[1];
    const len1 = Math.hypot(dx1, dz1);
    const s1 = ((x - bridge.start[0]) * dx1 + (z - bridge.start[1]) * dz1) / len1;
    const ramp1Len = len1 - VIADUCT_BASTION_HALF;
    if (s1 >= -1.5 && s1 <= len1) {
      const px1 = bridge.start[0] + (dx1 / len1) * s1;
      const pz1 = bridge.start[1] + (dz1 / len1) * s1;
      if (Math.hypot(x - px1, z - pz1) <= bridge.width * 0.75) {
        const u1 = clamp(s1 / ramp1Len, 0, 1);
        return lerp(bridge.startY, VIADUCT_ELBOW_Y, u1) + 0.52;
      }
    }

    // Flight 2: elbow -> end (ramps from VIADUCT_ELBOW_Y at bastion edge up to endY)
    const dx2 = bridge.end[0] - VIADUCT_ELBOW[0];
    const dz2 = bridge.end[1] - VIADUCT_ELBOW[1];
    const len2 = Math.hypot(dx2, dz2);
    const s2 = ((x - VIADUCT_ELBOW[0]) * dx2 + (z - VIADUCT_ELBOW[1]) * dz2) / len2;
    if (s2 >= 0 && s2 <= len2 + 1.5) {
      const px2 = VIADUCT_ELBOW[0] + (dx2 / len2) * s2;
      const pz2 = VIADUCT_ELBOW[1] + (dz2 / len2) * s2;
      if (Math.hypot(x - px2, z - pz2) <= bridge.width * 0.75) {
        const u2 = clamp((s2 - VIADUCT_BASTION_HALF) / (len2 - VIADUCT_BASTION_HALF), 0, 1);
        return lerp(VIADUCT_ELBOW_Y, bridge.endY, u2) + 0.52;
      }
    }

    return null;
  }

  const dx = bridge.end[0] - bridge.start[0];
  const dz = bridge.end[1] - bridge.start[1];
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return null;
  const t = ((x - bridge.start[0]) * dx + (z - bridge.start[1]) * dz) / lenSq;
  if (t < -0.04 || t > 1.04) return null;
  const projX = bridge.start[0] + dx * t;
  const projZ = bridge.start[1] + dz * t;
  const perpDist = Math.hypot(x - projX, z - projZ);
  if (perpDist > bridge.width * 0.75) return null;
  const deckBaseY = lerp(bridge.startY, bridge.endY, clamp(t, 0, 1));
  return deckBaseY + 0.52;
}

// Zone masks for flat functional plateaus
export function getAirfieldPadMask(x: number, z: number): number {
  const dx = x - AIRFIELD_CENTER_X;
  const dz = z - AIRFIELD_CENTER_Z;
  const cos = Math.cos(-0.22);
  const sin = Math.sin(-0.22);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const mx = 1 - smoothstep(32.0, 44.0, Math.abs(lx));
  const mz = 1 - smoothstep(24.0, 36.0, Math.abs(lz));
  return mx * mz;
}

export function getCitadelPlateauMask(x: number, z: number): number {
  const dx = (x - CITADEL_CENTER_X) / 66.0;
  const dz = (z - CITADEL_CENTER_Z) / 58.0;
  const dist = Math.hypot(dx, dz);
  // Steep sheer fortress cliffs (~45-55 deg) surrounding the 3x larger plateau
  return 1 - smoothstep(0.82, 1.12, dist);
}

export function getQuarryPadMask(x: number, z: number): number {
  const dx = (x - QUARRY_CENTER_X) / 24.0;
  const dz = (z - QUARRY_CENTER_Z) / 22.0;
  const dist = Math.hypot(dx, dz);
  return 1 - smoothstep(0.65, 1.15, dist);
}

export function getNorthernOutpostMask(x: number, z: number): number {
  const dx = (x + 1.0 * SCALE_X) / 32.0;
  const dz = (z + 10.6 * SCALE_Z) / 18.0;
  const dist = Math.hypot(dx, dz);
  return 1 - smoothstep(0.65, 1.1, dist);
}

// Wide sandy-gravel shoreline exit ramps (<18 deg slope, 57-62 m wide) leading from riverbed out to dry flanks
export const ROCKY_WATER_RAMPS: ReadonlyArray<
  readonly [number, number, number, number, number, number, number]
> = [
  // 1. SW West-Bank Ramp (from South Channel up toward HQ / Helipad flank)
  [-82, 58, -44, 38, 8.2, 4.5, -1.45],
  // 2. NW Forest-Bank Ramp (north of Bridge A onto NW forest flank)
  [-112, -104, -74, -92, 8.0, 6.2, -1.45],
  // 3. North-Center Shelf Ramp (North Channel up to Point B / Citadel west flank)
  [16, -68, 6, -34, 7.8, 6.8, -1.45],
  // 4. SE Quarry-Bank Ramp (South Channel up toward Point E / Citadel foot)
  [104, 48, 64, 82, 8.2, 6.0, -1.45],
  // 5. Right-Bridge West-Bank Shoal Ramp (just west of East Quarry Bridge into South Channel)
  [8, 76, 24, 46, 7.6, 4.2, -1.35],
];

// Central Island sandy-gravel water slipways connecting Island directly into river shoals
export const ISLAND_WATER_SLIPWAYS: ReadonlyArray<
  readonly [number, number, number, number, number, number, number]
> = [
  // Central Island SE shoreline slipway (facing Right Bridge & Point E)
  [18, 22, 44, 38, 7.0, 6.0, -1.4],
  // Central Island NW shoreline slipway (facing Crossing A & HQ)
  [-20, -16, -48, -32, 7.0, 6.0, -1.4],
];

// Wide walkable ramps (<20 deg) for non-jump-jet Mechs between river, quarry, island & flanks
export const WALKABLE_RAMPS: ReadonlyArray<
  readonly [number, number, number, number, number, number, number]
> = [
  ...ROCKY_WATER_RAMPS,
  // East Quarry <-> Citadel South Approach ramp
  [108, 20, 128, -22, 7.0, 6.2, 10.2],
  ...ISLAND_WATER_SLIPWAYS,
];

export interface MountainTerraceSpec {
  id: string;
  x: number;
  z: number;
  rx: number;
  rz: number;
  elevationY: number;
}

// 3 intermediate rock terraces (15-20 m height steps) on the mountain slopes in front of the Citadel
// for flanking jump-jet Mech ascents outside the narrow central viaduct ramp.
export const CITADEL_TERRACES: ReadonlyArray<MountainTerraceSpec> = [
  { id: 'terrace-sw-low', x: 70, z: -16, rx: 12.5, rz: 10.5, elevationY: 9.6 },
  { id: 'terrace-sw-high', x: 93, z: -24, rx: 13.0, rz: 10.5, elevationY: 14.1 },
  { id: 'terrace-nw-mid', x: 54, z: -90, rx: 11.5, rz: 9.5, elevationY: 13.8 },
];

export function isOnRockyWaterRamp(x: number, z: number): boolean {
  for (const [ax, az, bx, bz, halfW] of WALKABLE_RAMPS) {
    if (distToSegment(x, z, ax, az, bx, bz) < halfW * 0.92) return true;
  }
  return false;
}

export function isOnSandGravelShoal(x: number, z: number): boolean {
  for (const [ax, az, bx, bz, halfW] of ROCKY_WATER_RAMPS) {
    if (distToSegment(x, z, ax, az, bx, bz) < halfW * 1.15) return true;
  }
  for (const [ax, az, bx, bz, halfW] of ISLAND_WATER_SLIPWAYS) {
    if (distToSegment(x, z, ax, az, bx, bz) < halfW * 1.15) return true;
  }
  return false;
}

export function getCitadelTerraceMask(x: number, z: number): number {
  let maxMask = 0;
  for (const t of CITADEL_TERRACES) {
    const d = Math.hypot((x - t.x) / t.rx, (z - t.z) / t.rz);
    const m = 1 - smoothstep(0.7, 1.15, d);
    if (m > maxMask) maxMask = m;
  }
  return maxMask;
}

/**
 * Deterministic terrain elevation at any world (x, z) inside the 1500x1245 m arena.
 * Water level = 0, Citadel plateau = 18.5 units (~69.4 m above water).
 */
export function getTerrainHeight(x: number, z: number): number {
  const nx = x / SCALE_X;
  const nz = z / SCALE_Z;

  // Base organic rolling terrain with regional geological strata warp
  const n1 = fbm2D(nx * 0.08 + 5.2, nz * 0.08 + 2.4, 4);
  const n2 = fbm2D(nx * 0.22 - 3.7, nz * 0.22 + 9.1, 3);
  const strataWarp =
    (fbm2D(x * 0.032 + 1.5, z * 0.032 - 2.1, 3) - 0.5) * 1.45 +
    (x * 0.016 - z * 0.012);
  let h = (1.45 + (n1 - 0.45) * 2.1 + (n2 - 0.5) * 0.45) * SCALE_Y;

  // West ridge (stepped rocky escarpment on upper-left behind Bridge A)
  const westDist =
    Math.hypot((nx + 23.0) * 0.78, (nz + 5.5) * 0.78) +
    (n2 - 0.5) * 1.65;
  const westRidgeRaw = (1 - smoothstep(3.6, 13.5, westDist)) * (2.65 * SCALE_Y);
  h += westRidgeRaw;

  // Northern ridge (layered stone escarpment behind Points A & B)
  const northDist =
    Math.hypot((nx - 1.5) * 0.5, nz + 15.8) + (n2 - 0.5) * 1.55;
  const northRidgeRaw = (1 - smoothstep(3.2, 10.6, northDist)) * (2.6 * SCALE_Y);
  h += northRidgeRaw;

  // South-center knoll (terraced outcrop ridge)
  const southDist = Math.hypot((nx + 7.5) * 0.85, nz - 13.0) + (n2 - 0.5) * 1.1;
  const southKnoll = (1 - smoothstep(1.8, 7.2, southDist)) * (0.9 * SCALE_Y);
  h += southKnoll;

  // East quarry hillside (terraced rock ridge)
  const eastDist =
    Math.hypot((nx - 23.0) * 0.76, (nz - 3.5) * 0.82) + (n2 - 0.5) * 1.5;
  const eastHill = (1 - smoothstep(3.2, 11.2, eastDist)) * (1.7 * SCALE_Y);
  h += eastHill;

  // Apply subtle geological terracing to upland hills (above 5.8 units) without contour striping
  const uplandTerraceMask = smoothstep(5.6, 8.2, h);
  if (uplandTerraceMask > 0.001) {
    h = lerp(h, terraceHeight(h, 2.35, 0.46, strataWarp), uplandTerraceMask);
  }

  // Flatten Airfield Staging Base plateau (set back 200-250 m SW from river shore)
  const airfieldMask = getAirfieldPadMask(x, z);
  h = lerp(h, 1.48 * SCALE_Y, airfieldMask);

  // Flatten Northern Cliffside Road Terrace (A-B shelf)
  const northShelfMask = getNorthernOutpostMask(x, z);
  h = lerp(h, 2.55 * SCALE_Y, northShelfMask * 0.82);

  // Flatten East Quarry terrace + stepped mining benches around quarry perimeter
  const quarryMask = getQuarryPadMask(x, z);
  h = lerp(h, 2.05 * SCALE_Y, quarryMask * 0.85);
  const qRingDist = Math.hypot((x - QUARRY_CENTER_X) / 42.0, (z - QUARRY_CENTER_Z) / 40.0);
  if (qRingDist > 0.45 && qRingDist < 1.35) {
    const stepBlend =
      smoothstep(0.45, 0.62, qRingDist) * (1 - smoothstep(1.05, 1.35, qRingDist));
    const bench1 = 2.15 * SCALE_Y;
    const bench2 = 3.15 * SCALE_Y;
    const steppedH = lerp(bench1, bench2, smoothstep(0.76, 0.94, qRingDist));
    h = lerp(h, steppedH, stepBlend * 0.68);
  }

  // Raise 3x Larger Highland Citadel Plateau (~69.4 m above water) atop stepped rock buttresses
  const citadelMask = getCitadelPlateauMask(x, z);
  const citButtressNoise = (fbm2D(x * 0.045 - 1.2, z * 0.045 + 3.8, 3) - 0.5) * 0.24;
  const citRadial =
    Math.hypot((x - CITADEL_CENTER_X) / 68.0, (z - CITADEL_CENTER_Z) / 60.0) +
    citButtressNoise;
  const citadelSkirt = 1 - smoothstep(0.92, 1.46, citRadial);
  h = lerp(h, 4.35 * SCALE_Y, citadelSkirt * 0.54);
  // Carve subtle geological rock ledges around Citadel cliffs without isoline ringing
  const citCliffBand =
    smoothstep(0.84, 1.0, citRadial) *
    (1 - smoothstep(1.36, 1.62, citRadial)) *
    (1 - citadelMask);
  if (citCliffBand > 0.001) {
    h = lerp(h, terraceHeight(h, 2.55, 0.52, strataWarp * 1.3), citCliffBand);
  }
  h = lerp(h, 6.25 * SCALE_Y, citadelMask);

  // Winding serpentine switchback road climbing around Citadel's north/east flank to South Gate
  const serpentinePts: ReadonlyArray<readonly [number, number]> = [
    [20.0, -75.4],
    [54.0, -106.0],
    [104.0, -138.0],
    [158.0, -136.0],
    [186.0, -100.0],
    [182.0, -56.0],
    [148.0, -38.0],
    [122.0, -38.0],
  ];
  const rampDist = distToPolyline(x, z, serpentinePts);
  if (rampDist < 13.0) {
    // Progress along serpentine from [20, -75.4] to [122, -38] via north-east loop
    let bestT = 0;
    let bestD = Infinity;
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < serpentinePts.length - 1; i++) {
      const l = Math.hypot(
        serpentinePts[i + 1][0] - serpentinePts[i][0],
        serpentinePts[i + 1][1] - serpentinePts[i][1],
      );
      segLens.push(l);
      totalLen += l;
    }
    let accLen = 0;
    for (let i = 0; i < serpentinePts.length - 1; i++) {
      const [ax, az] = serpentinePts[i];
      const [bx, bz] = serpentinePts[i + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const lSq = vx * vx + vz * vz;
      const st = clamp(((x - ax) * vx + (z - az) * vz) / lSq, 0, 1);
      const d = Math.hypot(x - (ax + vx * st), z - (az + vz * st));
      if (d < bestD) {
        bestD = d;
        bestT = (accLen + st * segLens[i]) / totalLen;
      }
      accLen += segLens[i];
    }
    const rampY = lerp(2.55, 6.25, smoothstep(0.04, 0.96, bestT)) * SCALE_Y;
    const rampBlend = 1 - smoothstep(5.6, 13.0, rampDist);
    h = lerp(h, rampY, rampBlend * 0.94);
  }

  // Carve River Canyon with coastal shallows bench & Raise 230 m Central Industrial Island
  const river = getRiverInfo(x, z);
  if (river.islandMask > 0.001) {
    const islandTop = (2.05 + (n2 - 0.5) * 0.1) * SCALE_Y;
    h = lerp(h, islandTop, river.islandMask);
  }
  if (river.channelMask > 0.001) {
    // Stepped shallow gravel shelf (-0.28 * SCALE_Y ≈ -3.1 m) near riverbanks before deep thalweg
    const deepFactor = smoothstep(0.45, 0.88, river.channelMask);
    const shallowBed = (-0.28 + (n2 - 0.5) * 0.08) * SCALE_Y;
    const deepBed = (-1.12 + (n2 - 0.5) * 0.12) * SCALE_Y;
    const riverBed = lerp(shallowBed, deepBed, deepFactor);
    h = lerp(h, riverBed, smoothstep(0.02, 0.28, river.channelMask));
  }

  // Stepped canyon riverbank benches & layered stone ledges along the gorge walls
  const bankApron =
    (1 - smoothstep(18.0, 42.0, river.distToChannel)) *
    (1 - river.channelMask) *
    (1 - river.islandMask) *
    (1 - citadelMask) *
    (1 - clamp(northShelfMask * 1.15, 0, 1)) *
    (1 - clamp(airfieldMask * 1.2, 0, 1));
  if (bankApron > 0.001) {
    const rawShelf = lerp(0.55, 2.15, smoothstep(19.0, 39.0, river.distToChannel)) * SCALE_Y;
    const steppedShelf = terraceHeight(rawShelf, 1.65, 0.82, strataWarp * 0.7);
    h = lerp(h, Math.min(h, steppedShelf), bankApron * 0.78);
  }

  // Sculpted layered stone canyon ridges along the NW/North and SE gorge bluffs (clear of roads/ramps)
  const dAnyGorgeRoad = Math.min(
    distToPolyline(x, z, ROAD_MAIN_WEST),
    distToPolyline(x, z, ROAD_SOUTH_EAST),
    distToPolyline(x, z, ROAD_SOUTH_SPINE),
  );
  const gorgeRoadClear = smoothstep(7.5, 15.5, dAnyGorgeRoad);
  const canyonBluffMask =
    smoothstep(23.0, 29.0, river.distToChannel) *
    (1 - smoothstep(35.0, 48.0, river.distToChannel)) *
    (1 - river.islandMask) *
    (1 - clamp(airfieldMask * 1.4, 0, 1)) *
    (1 - clamp(quarryMask * 1.2, 0, 1)) *
    (1 - clamp(citadelMask * 1.2, 0, 1)) *
    gorgeRoadClear;
  if (canyonBluffMask > 0.001) {
    const bluffNoise = fbm2D(x * 0.055 + 4.8, z * 0.055 - 1.9, 3);
    if (bluffNoise > 0.48) {
      const bluffLift = smoothstep(0.48, 0.78, bluffNoise) * 3.8;
      h = terraceHeight(
        h + canyonBluffMask * bluffLift,
        1.75,
        0.78 * canyonBluffMask,
        strataWarp * 0.85,
      );
    }
  }

  // Intermediate jump-jet foothill terraces (15-20 m steps) on front & flank cliffs of Citadel
  for (const terrace of CITADEL_TERRACES) {
    const td = Math.hypot((x - terrace.x) / terrace.rx, (z - terrace.z) / terrace.rz);
    if (td < 1.38) {
      const tBlend = 1 - smoothstep(0.68, 1.38, td);
      h = lerp(h, terrace.elevationY, tBlend * 0.98);
    }
  }

  for (const [ax, az, bx, bz, halfW, y0, y1] of WALKABLE_RAMPS) {
    const rvx = bx - ax;
    const rvz = bz - az;
    const rLenSq = rvx * rvx + rvz * rvz;
    const rt = clamp(((x - ax) * rvx + (z - az) * rvz) / rLenSq, 0, 1);
    const rpx = ax + rvx * rt;
    const rpz = az + rvz * rt;
    const rDist = Math.hypot(x - rpx, z - rpz);
    if (rDist < halfW + 8.0) {
      const rWeight = 1 - smoothstep(halfW * 0.6, halfW + 8.0, rDist);
      const profile = lerp(rt, smoothstep(0.0, 1.0, rt), 0.35);
      const targetY = lerp(y0, y1, profile);
      h = lerp(h, targetY, rWeight * 0.98);
    }
  }

  // Smoothly grade non-bridge ground roads (32 m wide)
  const dRoadWest = distToPolyline(x, z, ROAD_MAIN_WEST.slice(0, 6));
  const dRoadSE = distToPolyline(x, z, ROAD_SOUTH_EAST);
  const dRoadSpine = distToPolyline(x, z, ROAD_SOUTH_SPINE.slice(0, 3));
  const dRoad = Math.min(dRoadWest, dRoadSE, dRoadSpine);
  if (dRoad < 9.5 && river.channelMask < 0.25) {
    const roadSmooth = 1 - smoothstep(4.2, 9.5, dRoad);
    const baseRoadY = h - (n2 - 0.5) * 0.35 * SCALE_Y;
    h = lerp(h, baseRoadY, roadSmooth * 0.78);
  }

  // Smoothly grade dry riverbank approach pads to meet 32 m road bridge decks flush
  if (river.channelMask < 0.35) {
    const dryFactor = 1 - smoothstep(0.08, 0.35, river.channelMask);
    for (let i = 0; i < 3; i++) {
      const b = BRIDGE_SPECS[i];
      const ds = Math.hypot(x - b.start[0], z - b.start[1]);
      if (ds < 14.0) {
        const w = (1 - smoothstep(4.2, 14.0, ds)) * dryFactor;
        h = lerp(h, b.startY + 0.36, w);
      }
      const de = Math.hypot(x - b.end[0], z - b.end[1]);
      if (de < 14.0) {
        const w = (1 - smoothstep(4.2, 14.0, de)) * dryFactor;
        h = lerp(h, b.endY + 0.36, w);
      }
    }
  }

  // Natural Perimeter Mountain Foothills & Citadel Rear Massif (keeps roads, river portals, and zones clear)
  const exRim = smoothstep(MAP_HALF_W - 34, MAP_HALF_W, Math.abs(x));
  const ezRim = smoothstep(MAP_HALF_D - 30, MAP_HALF_D, Math.abs(z));
  const rimEdge = Math.max(exRim, ezRim);
  if (rimEdge > 0.001) {
    const dAnyRoad = Math.min(
      distToPolyline(x, z, ROAD_MAIN_WEST),
      distToPolyline(x, z, ROAD_SOUTH_EAST),
      distToPolyline(x, z, ROAD_SOUTH_SPINE),
    );
    const roadClear = smoothstep(10.5, 22.0, dAnyRoad);
    const nwRiverDist = distToSegment(x, z, -125, -185, -80, -110);
    const seRiverDist = distToSegment(x, z, 75, 110, 115, 185);
    const portalClear = smoothstep(20.0, 42.0, Math.min(nwRiverDist, seRiverDist));
    const pierClear = smoothstep(18.0, 32.0, Math.hypot(x - 101, z - 108));
    const zoneClear =
      (1 - clamp(airfieldMask * 1.4, 0, 1)) *
      (1 - clamp(citadelMask * 1.25, 0, 1)) *
      (1 - clamp(northShelfMask * 1.1, 0, 1)) *
      (1 - clamp(quarryMask * 1.2, 0, 1));

    const ridgeShape = fbm2D(x * 0.026 + 1.4, z * 0.026 - 3.2, 4);
    const cragDetail = fbm2D(x * 0.075 - 4.1, z * 0.075 + 2.7, 3);
    const isBehindCitadel = smoothstep(15, 75, x) * smoothstep(-10, -75, z);
    const isSouthRim = smoothstep(60, 155, z);
    const maxRimLift = lerp(
      lerp(13.5, 6.2, isSouthRim),
      21.5,
      isBehindCitadel,
    );
    const rimLift =
      rimEdge *
      roadClear *
      portalClear *
      pierClear *
      zoneClear *
      maxRimLift *
      (0.55 + ridgeShape * 0.65 + (cragDetail - 0.5) * 0.25);
    h += rimLift;
  }

  // Carve a walkable cliffside trench for Flight 2 (VIADUCT_ELBOW -> Citadel West Gate) & Bastion Hub
  const v = BRIDGE_SPECS[3];
  const dBastion = Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]);
  if (dBastion < 16.5) {
    const hubFloorY = VIADUCT_ELBOW_Y - 0.52;
    const hubCut = 1 - smoothstep(11.4, 16.5, dBastion);
    if (h > hubFloorY) {
      h = lerp(h, hubFloorY, hubCut);
    }
  }

  const vdx = v.end[0] - VIADUCT_ELBOW[0];
  const vdz = v.end[1] - VIADUCT_ELBOW[1];
  const vLenSq = vdx * vdx + vdz * vdz;
  const vt = clamp(((x - VIADUCT_ELBOW[0]) * vdx + (z - VIADUCT_ELBOW[1]) * vdz) / vLenSq, 0, 1.06);
  if (vt > 0.22) {
    const px = VIADUCT_ELBOW[0] + vdx * vt;
    const pz = VIADUCT_ELBOW[1] + vdz * vt;
    const dViaduct = Math.hypot(x - px, z - pz);
    const innerHalfCut = 5.2;
    const outerHalfCut = 10.6;
    if (dViaduct < outerHalfCut) {
      const rampFloorY =
        lerp(VIADUCT_ELBOW_Y, v.endY, clamp((vt - 0.2) / 0.8, 0, 1)) - 0.52;
      const cutWeight =
        smoothstep(0.22, 0.34, vt) * (1 - smoothstep(innerHalfCut, outerHalfCut, dViaduct));
      if (h > rampFloorY) {
        h = lerp(h, rampFloorY, cutWeight);
      }
    }
  }

  return h;
}

export function getExtendedRiverDistance(x: number, z: number): number {
  const dNw = distToSegment(x, z, -111.4, -173.6, -240, -330);
  const dSe = distToSegment(x, z, 100.0, 173.6, 210, 355);
  return Math.min(dNw, dSe);
}

/**
 * Seamless terrain heightfield extending beyond the 400x332 playable bounds
 * into a natural Iron Gorge mountain ring & NW/SE river canyons that melt into horizon fog.
 */
export function getExtendedTerrainHeight(x: number, z: number): number {
  if (
    Math.abs(x) <= MAP_HALF_W + 1e-4 &&
    Math.abs(z) <= MAP_HALF_D + 1e-4
  ) {
    return getTerrainHeight(
      clamp(x, -MAP_HALF_W, MAP_HALF_W),
      clamp(z, -MAP_HALF_D, MAP_HALF_D),
    );
  }

  const cx = clamp(x, -MAP_HALF_W, MAP_HALF_W);
  const cz = clamp(z, -MAP_HALF_D, MAP_HALF_D);
  const baseRimY = getTerrainHeight(cx, cz);
  const outDist = Math.hypot(x - cx, z - cz);

  const macro = fbm2D(x * 0.015 + 8.3, z * 0.015 - 5.1, 4);
  const ridgeA = Math.pow(
    clamp(1 - Math.abs(fbm2D(x * 0.022 + 3.7, z * 0.022 - 8.2, 4) - 0.5) * 2.0, 0, 1),
    1.55,
  );
  const ridgeB = Math.pow(
    clamp(1 - Math.abs(fbm2D(x * 0.052 - 6.1, z * 0.052 + 4.9, 3) - 0.5) * 2.0, 0, 1),
    1.35,
  );
  const crag = fbm2D(x * 0.09 - 2.4, z * 0.09 + 6.7, 2);

  // Higher alpine massif behind Citadel (North & East) and lower gentle foothills on South/SW camera side
  const northEastWeight = smoothstep(-25, 95, x) * smoothstep(25, -95, z);
  const southFrontDamp = 1 - 0.58 * smoothstep(95, 230, z);
  const peakAmp = lerp(20.0, 36.0, northEastWeight) * southFrontDamp;

  // Primary mountain amphitheater (0..280) + distant secondary skyline ridges (180..440)
  const mainBand =
    smoothstep(0, 52, outDist) * (1 - smoothstep(160, 340, outDist));
  const farBand =
    smoothstep(150, 260, outDist) * (1 - smoothstep(350, 500, outDist));
  const sculptedPeaks =
    peakAmp * (0.28 + macro * 0.42 + ridgeA * 0.68) +
    ridgeB * 8.5 +
    (crag - 0.5) * 4.2;
  const rawMountainY =
    baseRimY +
    mainBand * sculptedPeaks +
    farBand * (sculptedPeaks * 0.58 + 4.0);
  // Subtle geological rock shelves with strong lateral warp so outer peaks look natural, not ringed
  const outerStrataWarp =
    (macro - 0.5) * 4.4 + (ridgeA - 0.5) * 2.2 + (x * 0.022 - z * 0.017);
  const mountainTerraceSharpness =
    0.26 * smoothstep(0, 34, outDist) * (1 - smoothstep(260, 460, outDist));
  const mountainY = terraceHeight(
    rawMountainY,
    3.6,
    mountainTerraceSharpness,
    outerStrataWarp,
  );

  // Outer perimeter settles gently above water floor as fog merges it with SkyDome horizon
  const farDrop = smoothstep(280, 510, outDist);
  let h = lerp(mountainY, 1.8, farDrop);

  // Continue NW & SE river gorges through the outer mountain ring
  const dRiver = getExtendedRiverDistance(x, z);
  if (dRiver < 34) {
    const channelBlend = 1 - smoothstep(11, 34, dRiver);
    const bedY = lerp(-2.8, 1.2, smoothstep(10, 26, dRiver));
    h = lerp(h, bedY, channelBlend * (1 - farDrop * 0.7));
  }

  return h;
}

export interface TerrainNormal {
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Analytical heightfield normal computed via an 8-tap isotropic Sobel stencil
 * with a sampling radius slightly larger than the terrain grid step (~1.34 units).
 * Eliminates diagonal triangulation facets and harsh stepped creases without adding triangles.
 */
export function getAnalyticalTerrainNormal(
  x: number,
  z: number,
  eps = 1.95,
  extended = true,
): TerrainNormal {
  const sample = extended ? getExtendedTerrainHeight : getTerrainHeight;
  const hNW = sample(x - eps, z - eps);
  const hN = sample(x, z - eps);
  const hNE = sample(x + eps, z - eps);
  const hW = sample(x - eps, z);
  const hE = sample(x + eps, z);
  const hSW = sample(x - eps, z + eps);
  const hS = sample(x, z + eps);
  const hSE = sample(x + eps, z + eps);

  const dhdx = (hNE + 2 * hE + hSE - (hNW + 2 * hW + hSW)) / (8 * eps);
  const dhdz = (hSW + 2 * hS + hSE - (hNW + 2 * hN + hNE)) / (8 * eps);

  const invLen = 1 / Math.hypot(dhdx, 1, dhdz);
  return {
    nx: -dhdx * invLen,
    ny: invLen,
    nz: -dhdz * invLen,
  };
}

export function getTerrainSlope(x: number, z: number): number {
  const eps = 1.6;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  return Math.hypot(dx, dz);
}

export function getSurfaceKind(x: number, z: number): SurfaceKind {
  const h = getTerrainHeight(x, z);
  if (h < WATER_LEVEL - 0.2) return 'water';

  if (getAirfieldPadMask(x, z) > 0.55) return 'concrete';
  if (getCitadelPlateauMask(x, z) > 0.88) return 'concrete';

  const river = getRiverInfo(x, z);
  if (river.islandMask > 0.65 && h > 1.75 * SCALE_Y) return 'concrete';

  const dRoad = Math.min(
    distToPolyline(x, z, ROAD_MAIN_WEST),
    distToPolyline(x, z, ROAD_SOUTH_SPINE),
    distToPolyline(x, z, ROAD_SOUTH_EAST),
  );
  if (dRoad < ROAD_HALF_WIDTH + 0.9 && river.channelMask < 0.2) return 'road';

  if (isOnRockyWaterRamp(x, z) || getCitadelTerraceMask(x, z) > 0.45) return 'rock';

  const slope = getTerrainSlope(x, z);
  if (slope > 0.34) return 'rock';
  if (h < 0.38 * SCALE_Y) return 'sand';

  return 'grass';
}

export function getRoadNormalizedDistance(x: number, z: number): number {
  const dRoad = Math.min(
    distToPolyline(x, z, ROAD_MAIN_WEST),
    distToPolyline(x, z, ROAD_SOUTH_SPINE),
    distToPolyline(x, z, ROAD_SOUTH_EAST),
  );
  return Math.min(20, dRoad / (ROAD_HALF_WIDTH + 0.9));
}

export function getShoalNormalizedDistance(x: number, z: number): number {
  let minNorm = 20;
  for (const [ax, az, bx, bz, halfW] of ROCKY_WATER_RAMPS) {
    const norm = distToSegment(x, z, ax, az, bx, bz) / (halfW * 1.15);
    if (norm < minNorm) minNorm = norm;
  }
  for (const [ax, az, bx, bz, halfW] of ISLAND_WATER_SLIPWAYS) {
    const norm = distToSegment(x, z, ax, az, bx, bz) / (halfW * 1.15);
    if (norm < minNorm) minNorm = norm;
  }
  return minNorm;
}

export function getRockRampNormalizedDistance(x: number, z: number): number {
  let minNorm = 20;
  for (const [ax, az, bx, bz, halfW] of WALKABLE_RAMPS) {
    const norm = distToSegment(x, z, ax, az, bx, bz) / (halfW * 0.92);
    if (norm < minNorm) minNorm = norm;
  }
  return minNorm;
}

export function getCitadelTerraceNormalizedDistance(x: number, z: number): number {
  let minNorm = 20;
  for (const t of CITADEL_TERRACES) {
    const norm = Math.hypot((x - t.x) / t.rx, (z - t.z) / t.rz);
    if (norm < minNorm) minNorm = norm;
  }
  return minNorm;
}

