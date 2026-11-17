import {
  BRIDGE_SPECS,
  MAP_DEPTH,
  MAP_HALF_D,
  MAP_HALF_W,
  MAP_WIDTH,
  VIADUCT_BASTION_HALF,
  VIADUCT_ELBOW,
  WATER_LEVEL,
  clamp,
  getExtendedRiverDistance,
  getExtendedTerrainHeight,
  getRiverInfo,
  lerp,
} from './terrainMath';
import { getFloodedRuinWaterObstacles } from './floodedRuins';

export const WATER_SPAN_W = MAP_WIDTH + 160; // 560 units
export const WATER_SPAN_D = MAP_DEPTH + 160; // 492 units
export const MAX_WATER_DEPTH = 4.5; // world units (~16.9 m)
export const MAX_OBSTACLE_DIST = 6.0; // world units (~22.5 m)

interface OrientedBoxObstacle {
  kind: 'box';
  cx: number;
  cz: number;
  cos: number;
  sin: number;
  hx: number;
  hz: number;
}

interface CircleObstacle {
  kind: 'circle';
  cx: number;
  cz: number;
  radius: number;
}

type WaterObstacle = OrientedBoxObstacle | CircleObstacle;

function buildWaterObstacles(): WaterObstacle[] {
  const obstacles: WaterObstacle[] = [];

  for (const spec of BRIDGE_SPECS) {
    if (spec.style === 'viaduct') {
      const dx1 = VIADUCT_ELBOW[0] - spec.start[0];
      const dz1 = VIADUCT_ELBOW[1] - spec.start[1];
      const len1 = Math.hypot(dx1, dz1);
      const f1EndX = spec.start[0] + (dx1 / len1) * (len1 - VIADUCT_BASTION_HALF);
      const f1EndZ = spec.start[1] + (dz1 / len1) * (len1 - VIADUCT_BASTION_HALF);
      const yaw1 = Math.atan2(dx1, dz1);
      const cos1 = Math.cos(yaw1);
      const sin1 = Math.sin(yaw1);
      const f1MidX = (spec.start[0] + f1EndX) * 0.5;
      const f1MidZ = (spec.start[1] + f1EndZ) * 0.5;
      for (const lx of [-spec.width * 0.28, spec.width * 0.28]) {
        obstacles.push({
          kind: 'box',
          cx: f1MidX + lx * cos1,
          cz: f1MidZ - lx * sin1,
          cos: cos1,
          sin: sin1,
          hx: 0.72,
          hz: 0.82,
        });
      }

      const dx2 = spec.end[0] - VIADUCT_ELBOW[0];
      const dz2 = spec.end[1] - VIADUCT_ELBOW[1];
      const hubYaw = (yaw1 + Math.atan2(dx2, dz2)) * 0.5;
      const hCos = Math.cos(hubYaw);
      const hSin = Math.sin(hubYaw);
      for (const [px, pz] of [
        [-6.4, -6.4],
        [6.4, -6.4],
        [-6.4, 6.4],
        [6.4, 6.4],
      ] as const) {
        obstacles.push({
          kind: 'box',
          cx: VIADUCT_ELBOW[0] + px * hCos + pz * hSin,
          cz: VIADUCT_ELBOW[1] - px * hSin + pz * hCos,
          cos: hCos,
          sin: hSin,
          hx: 1.55,
          hz: 1.55,
        });
      }
      continue;
    }

    const dx = spec.end[0] - spec.start[0];
    const dz = spec.end[1] - spec.start[1];
    const yaw = Math.atan2(dx, dz);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    for (const f of [0.28, 0.72]) {
      const bentX = spec.start[0] + dx * f;
      const bentZ = spec.start[1] + dz * f;
      for (const lx of [-spec.width * 0.28, spec.width * 0.28]) {
        obstacles.push({
          kind: 'box',
          cx: bentX + lx * cos,
          cz: bentZ - lx * sin,
          cos,
          sin,
          hx: 0.72,
          hz: 0.82,
        });
      }
    }
  }

  // Industrial RiverBendPier caisson pilings & moored river barge at SE bend
  const pierX = 101;
  const pierZ = 108;
  const pierRotY = -0.32;
  const pCos = Math.cos(pierRotY);
  const pSin = Math.sin(pierRotY);

  const pilings: ReadonlyArray<readonly [number, number]> = [
    [-8.2, -11.5],
    [-8.2, -3.8],
    [-8.2, 3.8],
    [-8.2, 11.5],
    [-1.8, -11.5],
    [-1.8, 0],
    [-1.8, 11.5],
  ];
  for (const [lx, lz] of pilings) {
    obstacles.push({
      kind: 'circle',
      cx: pierX + lx * pCos + lz * pSin,
      cz: pierZ - lx * pSin + lz * pCos,
      radius: 1.18,
    });
  }

  const bargeLocalX = -15.2;
  const bargeLocalZ = -1.5;
  const bargeYaw = pierRotY + 0.04;
  obstacles.push({
    kind: 'box',
    cx: pierX + bargeLocalX * pCos + bargeLocalZ * pSin,
    cz: pierZ - bargeLocalX * pSin + bargeLocalZ * pCos,
    cos: Math.cos(bargeYaw),
    sin: Math.sin(bargeYaw),
    hx: 2.7,
    hz: 8.25,
  });

  obstacles.push(...getFloodedRuinWaterObstacles());

  return obstacles;
}

const WATER_OBSTACLES = buildWaterObstacles();

/**
 * Signed horizontal distance (in world units) from (x, z) to the nearest
 * submerged bridge pier, quay caisson piling, or moored river barge.
 * Returns <= 0 inside the structure footprint.
 */
export function getWaterObstructionDistance(x: number, z: number): number {
  let minD = MAX_OBSTACLE_DIST;
  for (let i = 0; i < WATER_OBSTACLES.length; i++) {
    const ob = WATER_OBSTACLES[i];
    const dx = x - ob.cx;
    const dz = z - ob.cz;
    let d: number;
    if (ob.kind === 'circle') {
      d = Math.hypot(dx, dz) - ob.radius;
    } else {
      const lx = dx * ob.cos - dz * ob.sin;
      const lz = dx * ob.sin + dz * ob.cos;
      const qx = Math.abs(lx) - ob.hx;
      const qz = Math.abs(lz) - ob.hz;
      d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
    }
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Bakes a 2-channel RGBA DataTexture payload across the full 560 x 492 water plane:
 * - R: normalized water depth below WATER_LEVEL (0 on dry land -> 255 at >= MAX_WATER_DEPTH)
 * - G: normalized horizontal distance to nearest underwater bridge pier / piling / barge
 */
export function bakeWaterDepthData(width = 512, height = 448): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  const halfW = WATER_SPAN_W * 0.5;
  const halfD = WATER_SPAN_D * 0.5;

  for (let iy = 0; iy < height; iy++) {
    const v = (iy + 0.5) / height;
    const z = lerp(-halfD, halfD, v);

    for (let ix = 0; ix < width; ix++) {
      const u = (ix + 0.5) / width;
      const x = lerp(-halfW, halfW, u);

      const idx = (iy * width + ix) * 4;
      if (Math.abs(x - z * 0.52) > 106) {
        data[idx] = 0;
        data[idx + 1] = 255;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
        continue;
      }

      const insidePlayable = Math.abs(x) <= MAP_HALF_W && Math.abs(z) <= MAP_HALF_D;
      const nearRiverCorridor = insidePlayable
        ? getRiverInfo(x, z).channelMask > 0
        : getExtendedRiverDistance(x, z) < 38.0;

      if (!nearRiverCorridor) {
        data[idx] = 0;
        data[idx + 1] = 255;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
        continue;
      }

      const terrainY = getExtendedTerrainHeight(x, z);
      const depth = Math.max(0, WATER_LEVEL - terrainY);
      const depthByte = Math.round(clamp(depth / MAX_WATER_DEPTH, 0, 1) * 255);

      let obstByte = 255;
      if (depth > 0.01) {
        const obstDist = Math.max(0, getWaterObstructionDistance(x, z));
        obstByte = Math.round(clamp(obstDist / MAX_OBSTACLE_DIST, 0, 1) * 255);
      }

      data[idx] = depthByte;
      data[idx + 1] = obstByte;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  return data;
}
