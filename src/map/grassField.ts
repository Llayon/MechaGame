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

  // Steep slopes (> ~24-29 deg) & alpine summits (> 18-24 units) turn to bare slate rock
  const slopeFactor = smoothstep(0.865, 0.922, slopeNy);
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

/**
 * Builds a single 3-blade crossed grass tuft InstancedBufferGeometry (9 triangles, zero transparency)
 * with normalized blade height y ∈ [0, 1] and stratified world-wrapping instance offsets.
 */
export function createGrassClumpGeometry(
  instanceCount: number,
  patchSize: number,
  baseHeight = 0.30,
  baseWidth = 0.044,
): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  geo.instanceCount = instanceCount;

  // 5 blades fanned across a ~0.35-unit tussock footprint so clumps look lush from 360°
  const bladeConfigs = [
    { angle: 0.0, offsetX: 0.0, offsetZ: 0.0, hMult: 1.08, bend: 0.06 },
    { angle: 1.26, offsetX: -0.09, offsetZ: 0.06, hMult: 0.92, bend: 0.075 },
    { angle: 2.51, offsetX: 0.08, offsetZ: 0.07, hMult: 0.96, bend: 0.07 },
    { angle: 3.77, offsetX: 0.11, offsetZ: -0.08, hMult: 0.84, bend: 0.08 },
    { angle: 5.03, offsetX: -0.10, offsetZ: -0.07, hMult: 0.88, bend: 0.072 },
  ];

  const vertsPerBlade = 5;
  const trisPerBlade = 3;
  const totalVerts = bladeConfigs.length * vertsPerBlade;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint16Array(bladeConfigs.length * trisPerBlade * 3);

  let vPtr = 0;
  let iPtr = 0;

  for (let b = 0; b < bladeConfigs.length; b++) {
    const cfg = bladeConfigs[b];
    const cos = Math.cos(cfg.angle);
    const sin = Math.sin(cfg.angle);
    const baseVertex = b * vertsPerBlade;

    const w0 = baseWidth * 0.5;
    const w1 = baseWidth * 0.31;
    const h1 = baseHeight * cfg.hMult * 0.54;
    const h2 = baseHeight * cfg.hMult;
    const z1 = cfg.bend * 0.42;
    const z2 = cfg.bend;

    const localPts: Array<[number, number, number, number, number]> = [
      [-w0, 0.0, 0.0, 0.0, 0.0],
      [w0, 0.0, 0.0, 1.0, 0.0],
      [-w1, h1, z1, 0.0, 0.55],
      [w1, h1, z1, 1.0, 0.55],
      [0.0, h2, z2, 0.5, 1.0],
    ];

    // Upward-tilted blade normal rotated with blade yaw
    const nx = sin * 0.42;
    const ny = 0.88;
    const nz = cos * 0.42;
    const nLen = Math.hypot(nx, ny, nz);

    for (let k = 0; k < localPts.length; k++) {
      const [lx, ly, lz, u, v] = localPts[k];
      const rx = lx * cos - lz * sin + cfg.offsetX;
      const rz = lx * sin + lz * cos + cfg.offsetZ;

      positions[vPtr * 3] = rx;
      positions[vPtr * 3 + 1] = ly;
      positions[vPtr * 3 + 2] = rz;

      normals[vPtr * 3] = nx / nLen;
      normals[vPtr * 3 + 1] = ny / nLen;
      normals[vPtr * 3 + 2] = nz / nLen;

      uvs[vPtr * 2] = u;
      uvs[vPtr * 2 + 1] = v;
      vPtr++;
    }

    // Lower quad (2 tris) + upper tip (1 tri)
    indices[iPtr++] = baseVertex + 0;
    indices[iPtr++] = baseVertex + 1;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 1;
    indices[iPtr++] = baseVertex + 3;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 2;
    indices[iPtr++] = baseVertex + 3;
    indices[iPtr++] = baseVertex + 4;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
