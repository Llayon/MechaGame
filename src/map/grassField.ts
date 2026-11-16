import * as THREE from 'three';
import {
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  MAP_HALF_D,
  MAP_HALF_W,
  MAP_WIDTH,
  MAP_DEPTH,
  VIADUCT_ELBOW,
  WATER_LEVEL,
  clamp,
  distToSegment,
  fbm2D,
  getAirfieldPadMask,
  getBridgeSegments,
  getCitadelPlateauMask,
  getCitadelTerraceNormalizedDistance,
  getExtendedTerrainHeight,
  getQuarryPadMask,
  getRiverInfo,
  getRoadNormalizedDistance,
  getRockRampNormalizedDistance,
  getShoalNormalizedDistance,
  lerp,
  smoothstep,
} from './terrainMath';

export const GRASS_SPAN_W = MAP_WIDTH + 64; // 464 world units
export const GRASS_SPAN_D = MAP_DEPTH + 64; // 396 world units
export const GRASS_MIN_Y = -6.0;
export const GRASS_MAX_Y = 44.0;

export const GRASS_PATCH_RADIUS_GPU = 32.0;
export const GRASS_PATCH_RADIUS_SW = 22.0;

export const GRASS_INSTANCE_COUNT_GPU = 22500; // 150 x 150 stratified grid
export const GRASS_INSTANCE_COUNT_SW = 1849; // 43 x 43 for software WebGL

export function seededGrassRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Encodes world elevation into 16 bits split across two 8-bit channels (R=MSB, G=LSB).
 * Step precision across [-6..44] is ~0.00076 world units (~2.8 mm).
 */
export function encodeTerrainHeight16(y: number): [number, number] {
  const norm = clamp((y - GRASS_MIN_Y) / (GRASS_MAX_Y - GRASS_MIN_Y), 0, 1);
  const packed = Math.round(norm * 65535);
  return [(packed >> 8) & 255, packed & 255];
}

export function decodeTerrainHeight16(rByte: number, gByte: number): number {
  const packed = (rByte & 255) * 256 + (gByte & 255);
  return GRASS_MIN_Y + (packed / 65535) * (GRASS_MAX_Y - GRASS_MIN_Y);
}

/**
 * Wraps an instance offset cleanly around `center` within [-patchSize/2, patchSize/2)
 * so worldXZ = center + wrappedOffset stays locked in world space while moving.
 */
export function wrapGrassOffset(offset: number, center: number, patchSize: number): number {
  const shifted = offset - center + patchSize * 0.5;
  const wrapped = ((shifted % patchSize) + patchSize) % patchSize;
  return wrapped - patchSize * 0.5;
}

/**
 * Computes normalized [0..1] grass growth suitability at world (x, z),
 * matching terrainShader.ts surface masks so grass grows only on gentle,
 * natural meadows and never pokes through water, pebbles, concrete, roads,
 * bridges, quarry earth, rock ramps, or steep cliffs.
 */
export function computeGrassSuitabilityMask(
  x: number,
  z: number,
  terrainY: number,
  slopeNy: number,
): number {
  // Keep within playable perimeter margin
  if (Math.abs(x) > MAP_HALF_W - 2.5 || Math.abs(z) > MAP_HALF_D - 2.5) {
    return 0;
  }

  // Water & wet shoreline pebble band
  if (terrainY < WATER_LEVEL + 0.55) return 0;
  const river = getRiverInfo(x, z);
  const dryShoreFactor =
    smoothstep(0.55, 1.32, terrainY) * (1 - smoothstep(0.02, 0.14, river.channelMask));
  if (dryShoreFactor <= 0.01) return 0;

  // Exclude Airfield concrete pad, Citadel courtyard concrete, and Central Island deck
  const adx = x - -134.0;
  const adz = z - 99.0;
  const cosA = Math.cos(0.22);
  const sinA = Math.sin(0.22);
  const alx = Math.abs(adx * cosA - adz * sinA);
  const alz = Math.abs(adx * sinA + adz * cosA);
  const airfieldConcrete =
    (1 - smoothstep(29.8, 32.0, alx)) * (1 - smoothstep(21.8, 24.0, alz));
  const airfieldApron = Math.max(airfieldConcrete, smoothstep(0.32, 0.52, getAirfieldPadMask(x, z)));
  if (airfieldApron >= 0.99) return 0;

  const citOctDist = Math.hypot((x - CITADEL_CENTER_X) / 53.4, (z - CITADEL_CENTER_Z) / 45.2);
  const citadelConcrete =
    (1 - smoothstep(0.95, 1.06, citOctDist)) * smoothstep(15.5, 17.5, terrainY);
  const citadelMask = Math.max(citadelConcrete, smoothstep(0.55, 0.85, getCitadelPlateauMask(x, z)));
  if (citadelMask >= 0.99) return 0;

  const islandConcrete =
    smoothstep(0.56, 0.72, river.islandMask) * smoothstep(4.8, 5.4, terrainY);
  if (islandConcrete >= 0.99) return 0;

  // Tactical roads & bridge abutment footprints
  const roadNorm = getRoadNormalizedDistance(x, z);
  const roadFactor = smoothstep(0.96, 1.26, roadNorm);
  if (roadFactor <= 0.01) return 0;

  let bridgeFactor = 1.0;
  if (Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]) < 13.5) {
    return 0;
  }
  for (let i = 0; i < BRIDGE_SPECS.length; i++) {
    const b = BRIDGE_SPECS[i];
    const segs = getBridgeSegments(b);
    for (let s = 0; s < segs.length; s++) {
      const [p0, p1] = segs[s];
      const d = distToSegment(x, z, p0[0], p0[1], p1[0], p1[1]);
      if (d < b.width * 0.68 + 1.8) {
        bridgeFactor = Math.min(
          bridgeFactor,
          smoothstep(b.width * 0.55 + 0.5, b.width * 0.68 + 1.8, d),
        );
      }
    }
  }
  if (bridgeFactor <= 0.01) return 0;

  // Quarry terracotta, rocky shoal/approach ramps, and Citadel terraces
  const quarryFactor = 1 - smoothstep(0.24, 0.52, getQuarryPadMask(x, z));
  const shoalFactor = smoothstep(0.88, 1.18, getShoalNormalizedDistance(x, z));
  const rampFactor = smoothstep(0.88, 1.18, getRockRampNormalizedDistance(x, z));
  const terraceFactor = smoothstep(0.78, 1.12, getCitadelTerraceNormalizedDistance(x, z));

  // Steep slopes (normal.y < 0.75 -> bare rock) & alpine summits (> 18-24 units) turn to bare slate rock
  const slopeFactor = smoothstep(0.75, 0.90, slopeNy);
  const altFactor = 1 - smoothstep(18.0, 24.0, terrainY);

  const concreteClear =
    (1 - airfieldApron) * (1 - citadelMask) * (1 - islandConcrete);

  const mask =
    dryShoreFactor *
    concreteClear *
    roadFactor *
    bridgeFactor *
    quarryFactor *
    shoalFactor *
    rampFactor *
    terraceFactor *
    slopeFactor *
    altFactor;

  return clamp(mask, 0, 1);
}

/**
 * Bakes a 512x448 RGBA Uint8Array lookup texture over GRASS_SPAN_W x GRASS_SPAN_D:
 * - R/G: 16-bit elevation over [GRASS_MIN_Y..GRASS_MAX_Y]
 * - B: [0..255] grass growth suitability mask
 * - A: [0..255] macro meadow variation for organic density & color clumping
 */
export function bakeTerrainGrassMap(width = 512, height = 448): Uint8Array {
  const halfW = GRASS_SPAN_W * 0.5;
  const halfD = GRASS_SPAN_D * 0.5;
  const stepX = GRASS_SPAN_W / width;
  const stepZ = GRASS_SPAN_D / height;

  // Cache height grid once so finite-difference slope costs zero extra heightfield calls
  const heights = new Float32Array(width * height);
  for (let iy = 0; iy < height; iy++) {
    const z = lerp(-halfD, halfD, (iy + 0.5) / height);
    const rowOffset = iy * width;
    for (let ix = 0; ix < width; ix++) {
      const x = lerp(-halfW, halfW, (ix + 0.5) / width);
      heights[rowOffset + ix] = getExtendedTerrainHeight(x, z);
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let iy = 0; iy < height; iy++) {
    const z = lerp(-halfD, halfD, (iy + 0.5) / height);
    const iyPrev = Math.max(0, iy - 1);
    const iyNext = Math.min(height - 1, iy + 1);
    const dzSpan = Math.max(stepZ, (iyNext - iyPrev) * stepZ);

    for (let ix = 0; ix < width; ix++) {
      const x = lerp(-halfW, halfW, (ix + 0.5) / width);
      const ixPrev = Math.max(0, ix - 1);
      const ixNext = Math.min(width - 1, ix + 1);
      const dxSpan = Math.max(stepX, (ixNext - ixPrev) * stepX);

      const h = heights[iy * width + ix];
      const dhdx = (heights[iy * width + ixNext] - heights[iy * width + ixPrev]) / dxSpan;
      const dhdz = (heights[iyNext * width + ix] - heights[iyPrev * width + ix]) / dzSpan;
      const slopeNy = 1 / Math.hypot(dhdx, 1, dhdz);

      const [rByte, gByte] = encodeTerrainHeight16(h);
      const suitability = computeGrassSuitabilityMask(x, z, h, slopeNy);
      const macroVar = fbm2D(x * 0.075 + 2.3, z * 0.075 - 1.9, 2);

      const idx = (iy * width + ix) * 4;
      data[idx] = rByte;
      data[idx + 1] = gByte;
      data[idx + 2] = Math.round(suitability * 255);
      data[idx + 3] = Math.round(clamp(macroVar, 0, 1) * 255);
    }
  }

  return data;
}

interface ClumpBladeSpec {
  kind: 'grass' | 'fern' | 'stalk';
  angle: number;
  offsetX: number;
  offsetZ: number;
  hMult: number;
  wMult: number;
  bend: number;
}

/**
 * Builds a constructed 7-element wildflower-meadow tussock InstancedBufferGeometry (zero extra draw calls):
 * - 4 curved 3-segment grass blades of varied heights/leans
 * - 1 broad low fern/burdock rosette leaf near the base
 * - 2 tall slender stalks (1.36x - 1.48x height) with widened bud/flower tip triangles
 * Includes Vertex Colors (`color`) and `aBudMask` for per-tuft wildflower highlights.
 */
export function createGrassClumpGeometry(
  instanceCount: number,
  patchSize: number,
  baseHeight = 0.30,
  baseWidth = 0.044,
): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  geo.instanceCount = instanceCount;

  const specs: ClumpBladeSpec[] = [
    // 4 curved base blades fanned across ~0.38m footprint
    { kind: 'grass', angle: 0.15, offsetX: 0.02, offsetZ: 0.01, hMult: 1.06, wMult: 1.0, bend: 0.075 },
    { kind: 'grass', angle: 1.52, offsetX: -0.11, offsetZ: 0.06, hMult: 0.90, wMult: 0.95, bend: 0.095 },
    { kind: 'grass', angle: 2.88, offsetX: 0.10, offsetZ: 0.09, hMult: 0.96, wMult: 1.05, bend: 0.085 },
    { kind: 'grass', angle: 4.35, offsetX: -0.09, offsetZ: -0.10, hMult: 0.80, wMult: 0.92, bend: 0.090 },
    // 1 broad fern/burdock leaf low at the base
    { kind: 'fern', angle: 5.45, offsetX: 0.08, offsetZ: -0.08, hMult: 0.62, wMult: 2.35, bend: 0.22 },
    // 2 tall slender sedge/wildflower stalks (~1.36x - 1.48x height) with widened bud tips
    { kind: 'stalk', angle: 0.88, offsetX: -0.04, offsetZ: -0.03, hMult: 1.48, wMult: 0.56, bend: 0.065 },
    { kind: 'stalk', angle: 3.62, offsetX: 0.05, offsetZ: 0.04, hMult: 1.36, wMult: 0.54, bend: 0.072 },
  ];

  // 3-seg blades (grass & stalk): 7 verts, 5 tris. 2-seg fern leaf: 5 verts, 3 tris.
  let totalVerts = 0;
  let totalTris = 0;
  for (const s of specs) {
    totalVerts += s.kind === 'fern' ? 5 : 7;
    totalTris += s.kind === 'fern' ? 3 : 5;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);
  const budMask = new Float32Array(totalVerts);
  const indices = new Uint16Array(totalTris * 3);

  let vPtr = 0;
  let iPtr = 0;

  const pushVertex = (
    rx: number,
    ly: number,
    rz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    cr: number,
    cg: number,
    cb: number,
    bud: number,
  ) => {
    positions[vPtr * 3] = rx;
    positions[vPtr * 3 + 1] = ly;
    positions[vPtr * 3 + 2] = rz;

    normals[vPtr * 3] = nx;
    normals[vPtr * 3 + 1] = ny;
    normals[vPtr * 3 + 2] = nz;

    uvs[vPtr * 2] = u;
    uvs[vPtr * 2 + 1] = v;

    colors[vPtr * 3] = cr;
    colors[vPtr * 3 + 1] = cg;
    colors[vPtr * 3 + 2] = cb;

    budMask[vPtr] = bud;
    vPtr++;
  };

  for (let b = 0; b < specs.length; b++) {
    const cfg = specs[b];
    const cos = Math.cos(cfg.angle);
    const sin = Math.sin(cfg.angle);
    const baseVertex = vPtr;

    const nxRaw = sin * 0.42;
    const nyRaw = 0.88;
    const nzRaw = cos * 0.42;
    const nLen = Math.hypot(nxRaw, nyRaw, nzRaw);
    const nx = nxRaw / nLen;
    const ny = nyRaw / nLen;
    const nz = nzRaw / nLen;

    const H = baseHeight * cfg.hMult;
    const W = baseWidth * cfg.wMult;

    if (cfg.kind === 'fern') {
      // Broad arched fern/burdock rosette leaf (5 verts, 3 tris)
      const pts: Array<[number, number, number, number, number, number, number, number]> = [
        [-W * 0.28, 0.0, 0.0, 0.0, 0.0, 0.44, 0.56, 0.36],
        [W * 0.28, 0.0, 0.0, 1.0, 0.0, 0.44, 0.56, 0.36],
        [-W * 0.56, H * 0.58, cfg.bend * 0.44, 0.0, 0.55, 0.62, 0.82, 0.52],
        [W * 0.56, H * 0.58, cfg.bend * 0.44, 1.0, 0.55, 0.62, 0.82, 0.52],
        [0.0, H, cfg.bend, 0.5, 1.0, 0.78, 0.96, 0.62],
      ];
      for (const [lx, ly, lz, u, v, cr, cg, cb] of pts) {
        const rx = lx * cos - lz * sin + cfg.offsetX;
        const rz = lx * sin + lz * cos + cfg.offsetZ;
        pushVertex(rx, ly, rz, nx, ny, nz, u, v, cr, cg, cb, 0.0);
      }
      indices[iPtr++] = baseVertex + 0;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 4;
    } else if (cfg.kind === 'stalk') {
      // Tall slender stalk ending in a slightly widened blossom/seed-head triangle (7 verts, 5 tris)
      const w0 = W * 0.52;
      const w1 = W * 0.38;
      const wBud = baseWidth * 0.86; // widened bud flare near top
      const pts: Array<[number, number, number, number, number, number, number, number, number]> = [
        [-w0, 0.0, 0.0, 0.0, 0.0, 0.46, 0.54, 0.34, 0.0],
        [w0, 0.0, 0.0, 1.0, 0.0, 0.46, 0.54, 0.34, 0.0],
        [-w1, H * 0.48, cfg.bend * 0.32, 0.0, 0.48, 0.72, 0.82, 0.52, 0.15],
        [w1, H * 0.48, cfg.bend * 0.32, 1.0, 0.48, 0.72, 0.82, 0.52, 0.15],
        [-wBud, H * 0.86, cfg.bend * 0.78, 0.0, 0.86, 0.94, 0.96, 0.78, 0.85],
        [wBud, H * 0.86, cfg.bend * 0.78, 1.0, 0.86, 0.94, 0.96, 0.78, 0.85],
        [0.0, H, cfg.bend, 0.5, 1.0, 1.0, 1.0, 0.92, 1.0],
      ];
      for (const [lx, ly, lz, u, v, cr, cg, cb, bud] of pts) {
        const rx = lx * cos - lz * sin + cfg.offsetX;
        const rz = lx * sin + lz * cos + cfg.offsetZ;
        pushVertex(rx, ly, rz, nx, ny, nz, u, v, cr, cg, cb, bud);
      }
      indices[iPtr++] = baseVertex + 0;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 5;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 5;
      indices[iPtr++] = baseVertex + 6;
    } else {
      // Smoothly arched 3-segment grass blade (7 verts, 5 tris)
      const w0 = W * 0.52;
      const w1 = W * 0.38;
      const w2 = W * 0.21;
      const pts: Array<[number, number, number, number, number, number, number, number]> = [
        [-w0, 0.0, 0.0, 0.0, 0.0, 0.45, 0.56, 0.36],
        [w0, 0.0, 0.0, 1.0, 0.0, 0.45, 0.56, 0.36],
        [-w1, H * 0.34, cfg.bend * 0.20, 0.0, 0.34, 0.68, 0.80, 0.52],
        [w1, H * 0.34, cfg.bend * 0.20, 1.0, 0.34, 0.68, 0.80, 0.52],
        [-w2, H * 0.69, cfg.bend * 0.58, 0.0, 0.69, 0.86, 0.94, 0.66],
        [w2, H * 0.69, cfg.bend * 0.58, 1.0, 0.69, 0.86, 0.94, 0.66],
        [0.0, H, cfg.bend, 0.5, 1.0, 0.98, 1.0, 0.78],
      ];
      for (const [lx, ly, lz, u, v, cr, cg, cb] of pts) {
        const rx = lx * cos - lz * sin + cfg.offsetX;
        const rz = lx * sin + lz * cos + cfg.offsetZ;
        pushVertex(rx, ly, rz, nx, ny, nz, u, v, cr, cg, cb, 0.0);
      }
      indices[iPtr++] = baseVertex + 0;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 1;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 2;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 3;
      indices[iPtr++] = baseVertex + 5;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 4;
      indices[iPtr++] = baseVertex + 5;
      indices[iPtr++] = baseVertex + 6;
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aBudMask', new THREE.BufferAttribute(budMask, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  // Stratified jittered offsets across [0, patchSize) x [0, patchSize) prevent bald spots
  const offsets = new Float32Array(instanceCount * 4);
  const cols = Math.ceil(Math.sqrt(instanceCount));
  const cell = patchSize / cols;

  for (let i = 0; i < instanceCount; i++) {
    const gx = i % cols;
    const gz = Math.floor(i / cols);
    const jx = seededGrassRand(i * 5 + 1);
    const jz = seededGrassRand(i * 5 + 2);
    const scale = 0.74 + seededGrassRand(i * 5 + 3) * 0.62;
    const yaw = seededGrassRand(i * 5 + 4) * Math.PI * 2;

    offsets[i * 4] = (gx + jx) * cell;
    offsets[i * 4 + 1] = (gz + jz) * cell;
    offsets[i * 4 + 2] = scale;
    offsets[i * 4 + 3] = yaw;
  }

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), patchSize * 2);

  return geo;
}

export interface GrassBushAccent {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  kind: 'rock' | 'ruin' | 'road';
  tint: number;
}

/**
 * Layer 2 Accent Foliage: ~180 large fern & scrub bushes clustered strictly along
 * boulders, concrete ruin borders, and road shoulders (never out in open meadows or steep cliffs).
 */
export function generateGrassBushAccentsData(maxCount = 184): GrassBushAccent[] {
  const list: GrassBushAccent[] = [];
  const tryPush = (
    x: number,
    z: number,
    kind: GrassBushAccent['kind'],
    seed: number,
    allowRoadEdge = false,
  ) => {
    if (list.length >= maxCount) return;
    if (Math.abs(x) > MAP_HALF_W - 4 || Math.abs(z) > MAP_HALF_D - 4) return;
    const y = getExtendedTerrainHeight(x, z);
    if (y < WATER_LEVEL + 0.65 || y > 22.0) return;

    const dyx = getExtendedTerrainHeight(x + 0.6, z) - getExtendedTerrainHeight(x - 0.6, z);
    const dyz = getExtendedTerrainHeight(x, z + 0.6) - getExtendedTerrainHeight(x, z - 0.6);
    const ny = 1 / Math.hypot(dyx / 1.2, 1, dyz / 1.2);
    if (ny < 0.75) return;

    const roadNorm = getRoadNormalizedDistance(x, z);
    if (roadNorm < (allowRoadEdge ? 1.03 : 1.06)) return;

    const suit = computeGrassSuitabilityMask(x, z, y, ny);
    if (suit <= 0.02 && !allowRoadEdge) return;

    // Exclude concrete pads & bridges directly
    const padCheck =
      getAirfieldPadMask(x, z) > 0.45 ||
      getCitadelPlateauMask(x, z) > 0.62;
    if (padCheck) return;

    list.push({
      x,
      y,
      z,
      rotY: seededGrassRand(seed * 7 + 1) * Math.PI * 2,
      scale: 0.78 + seededGrassRand(seed * 7 + 2) * 0.72,
      kind,
      tint: seededGrassRand(seed * 7 + 3),
    });
  };

  // 1) Around concrete ruin / airfield tarmac edges & bunkers
  for (let i = 0; i < 160 && list.length < Math.floor(maxCount * 0.35); i++) {
    const ang = seededGrassRand(i * 11 + 17) * Math.PI * 2;
    const rad = 28.5 + seededGrassRand(i * 11 + 18) * 14.0;
    const rx = -134 + Math.cos(ang) * rad * 1.12;
    const rz = 99 + Math.sin(ang) * rad * 0.86;
    tryPush(rx, rz, 'ruin', 1000 + i, true);
  }

  // 2) Along road shoulders & quarry/river bends (sample world grid near roadNorm 1.06..1.48)
  for (let i = 0; i < 900 && list.length < Math.floor(maxCount * 0.68); i++) {
    const x = (seededGrassRand(i * 13 + 31) * 2 - 1) * (MAP_HALF_W - 10);
    const z = (seededGrassRand(i * 13 + 32) * 2 - 1) * (MAP_HALF_D - 10);
    const roadNorm = getRoadNormalizedDistance(x, z);
    if (roadNorm >= 1.06 && roadNorm <= 1.48) {
      tryPush(x, z, 'road', 2000 + i, true);
    }
  }

  // 3) Next to natural rocky outcrops & valley boulders
  for (let i = 0; i < 1200 && list.length < maxCount; i++) {
    const x = (seededGrassRand(i * 17 + 51) * 2 - 1) * (MAP_HALF_W - 10);
    const z = (seededGrassRand(i * 17 + 52) * 2 - 1) * (MAP_HALF_D - 10);
    const y = getExtendedTerrainHeight(x, z);
    const dyx = getExtendedTerrainHeight(x + 1.0, z) - getExtendedTerrainHeight(x - 1.0, z);
    const dyz = getExtendedTerrainHeight(x, z + 1.0) - getExtendedTerrainHeight(x, z - 1.0);
    const ny = 1 / Math.hypot(dyx / 2.0, 1, dyz / 2.0);
    // Tuck beside rocky transitions & lowland creek margins
    if ((ny >= 0.75 && ny <= 0.89) || (y > WATER_LEVEL + 0.7 && y < WATER_LEVEL + 3.2)) {
      tryPush(x, z, 'rock', 3000 + i, false);
    }
  }

  return list;
}

/**
 * Builds a single sculpted 7-frond 3D fern & scrub bush geometry (~28 triangles)
 * anchored cleanly at y=0 with Vertex Colors from shaded core to sunlit frond tips.
 */
export function createFernBushGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const fronds = 7;
  const vertsPerFrond = 7;
  const trisPerFrond = 5;

  const positions = new Float32Array(fronds * vertsPerFrond * 3);
  const normals = new Float32Array(fronds * vertsPerFrond * 3);
  const colors = new Float32Array(fronds * vertsPerFrond * 3);
  const uvs = new Float32Array(fronds * vertsPerFrond * 2);
  const indices = new Uint16Array(fronds * trisPerFrond * 3);

  let vPtr = 0;
  let iPtr = 0;

  for (let f = 0; f < fronds; f++) {
    const isInner = f >= 4;
    const baseVertex = vPtr;
    const yaw = (f / fronds) * Math.PI * 2 + (isInner ? 0.42 : 0.0);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    const len = isInner ? 0.68 : 0.92;
    const height = isInner ? 0.68 : 0.46;
    const w0 = isInner ? 0.11 : 0.14;
    const w1 = isInner ? 0.21 : 0.28;
    const w2 = isInner ? 0.14 : 0.18;

    const pts: Array<[number, number, number, number, number, number, number, number]> = [
      [-w0, 0.0, 0.02, 0.0, 0.0, 0.36, 0.46, 0.30],
      [w0, 0.0, 0.02, 1.0, 0.0, 0.36, 0.46, 0.30],
      [-w1, height * 0.56, len * 0.34, 0.0, 0.42, 0.62, 0.78, 0.48],
      [w1, height * 0.56, len * 0.34, 1.0, 0.42, 0.62, 0.78, 0.48],
      [-w2, height * 0.92, len * 0.72, 0.0, 0.78, 0.84, 0.94, 0.62],
      [w2, height * 0.92, len * 0.72, 1.0, 0.78, 0.84, 0.94, 0.62],
      [0.0, height * 0.80, len, 0.5, 1.0, 0.96, 1.0, 0.74],
    ];

    const nx = sin * 0.35;
    const ny = 0.88;
    const nz = cos * 0.35;
    const nLen = Math.hypot(nx, ny, nz);

    for (const [lx, ly, lz, u, v, cr, cg, cb] of pts) {
      const rx = lx * cos - lz * sin;
      const rz = lx * sin + lz * cos;
      positions[vPtr * 3] = rx;
      positions[vPtr * 3 + 1] = ly;
      positions[vPtr * 3 + 2] = rz;
      normals[vPtr * 3] = nx / nLen;
      normals[vPtr * 3 + 1] = ny / nLen;
      normals[vPtr * 3 + 2] = nz / nLen;
      colors[vPtr * 3] = cr;
      colors[vPtr * 3 + 1] = cg;
      colors[vPtr * 3 + 2] = cb;
      uvs[vPtr * 2] = u;
      uvs[vPtr * 2 + 1] = v;
      vPtr++;
    }

    indices[iPtr++] = baseVertex + 0;
    indices[iPtr++] = baseVertex + 1;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 1;
    indices[iPtr++] = baseVertex + 3;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 3;
    indices[iPtr++] = baseVertex + 4;
    indices[iPtr++] = baseVertex + 3;
    indices[iPtr++] = baseVertex + 5;
    indices[iPtr++] = baseVertex + 4;
    indices[iPtr++] = baseVertex + 4;
    indices[iPtr++] = baseVertex + 5;
    indices[iPtr++] = baseVertex + 6;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}
