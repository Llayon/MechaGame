import * as THREE from 'three';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_TERRACES,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  getTerrainHeight,
  lerp,
} from './terrainMath';
import type { LightingPreset } from './sectors';

/** 0 = >>> chevrons, 1 = DANGER triangle, 2 = tactical radar, 3 = hazard stripes */
export type HoloIconType = 0 | 1 | 2 | 3;

export type HologramZone = 'airfield' | 'bridge' | 'island' | 'citadel' | 'quarry';

export interface HologramSignSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  width: number;
  height: number;
  iconType: HoloIconType;
  colorHex: number;
  clearedColorHex?: number;
  zone: HologramZone;
}

export const HOLO_COLOR_CYAN = 0x00e5ff;
export const HOLO_COLOR_TEAL_CLEAR = 0x2ce6b8;
export const HOLO_COLOR_AMBER = 0xffaa1d;
export const HOLO_COLOR_DANGER = 0xff621a;

function buildBridgePortalSigns(): HologramSignSpec[] {
  const signs: HologramSignSpec[] = [];
  for (const spec of BRIDGE_SPECS) {
    const dx = spec.end[0] - spec.start[0];
    const dz = spec.end[1] - spec.start[1];
    const yaw = Math.atan2(dx, dz);

    if (spec.style === 'viaduct') {
      // Overhead chevron sign at start of the ascending Island -> Citadel viaduct
      const t = 0.08;
      const sx = lerp(spec.start[0], 35.0, t);
      const sz = lerp(spec.start[1], -52.0, t);
      const sy = spec.startY + 5.2;
      signs.push({
        id: `holo-${spec.id}-entry`,
        x: sx,
        y: sy,
        z: sz,
        yaw: Math.atan2(35.0 - spec.start[0], -52.0 - spec.start[1]),
        width: 5.2,
        height: 1.85,
        iconType: 0,
        colorHex: HOLO_COLOR_AMBER,
        clearedColorHex: HOLO_COLOR_TEAL_CLEAR,
        zone: 'citadel',
      });
      continue;
    }

    // Main approach portal above bridge abutment threshold (clears arch beams and 14 m Mechs)
    const entryT = 0.015;
    signs.push({
      id: `holo-${spec.id}-entry`,
      x: lerp(spec.start[0], spec.end[0], entryT),
      y: lerp(spec.startY, spec.endY, entryT) + 5.75,
      z: lerp(spec.start[1], spec.end[1], entryT),
      yaw,
      width: 5.4,
      height: 1.8,
      iconType: 0,
      colorHex: HOLO_COLOR_CYAN,
      zone: 'bridge',
    });

    // Return-facing portal at bridge exit
    const exitT = 0.985;
    signs.push({
      id: `holo-${spec.id}-exit`,
      x: lerp(spec.start[0], spec.end[0], exitT),
      y: lerp(spec.startY, spec.endY, exitT) + 5.75,
      z: lerp(spec.start[1], spec.end[1], exitT),
      yaw: yaw + Math.PI,
      width: 5.4,
      height: 1.8,
      iconType: 0,
      colorHex: HOLO_COLOR_CYAN,
      zone: 'bridge',
    });
  }
  return signs;
}

function getSpanClearGroundY(
  x: number,
  z: number,
  yaw: number,
  halfWidth: number,
): number {
  const rx = Math.cos(yaw) * halfWidth;
  const rz = -Math.sin(yaw) * halfWidth;
  return Math.max(
    getTerrainHeight(x, z),
    getTerrainHeight(x - rx, z - rz),
    getTerrainHeight(x + rx, z + rz),
  );
}

function buildZoneTacticalSigns(): HologramSignSpec[] {
  const signs: HologramSignSpec[] = [];

  // 1. Airfield HQ: flanking gate chevron & elevated command radar panel (clear of helipad decals)
  const airGateX = -102.0;
  const airGateZ = 75.5;
  signs.push({
    id: 'holo-hq-exit-guide',
    x: airGateX + 5.4,
    y: getTerrainHeight(airGateX + 5.4, airGateZ + 3.2) + 2.4,
    z: airGateZ + 3.2,
    yaw: 0.56,
    width: 4.2,
    height: 1.75,
    iconType: 0,
    colorHex: HOLO_COLOR_CYAN,
    zone: 'airfield',
  });

  const airRadarX = AIRFIELD_CENTER_X - 18.0;
  const airRadarZ = AIRFIELD_CENTER_Z - 17.5;
  signs.push({
    id: 'holo-hq-radar-panel',
    x: airRadarX,
    y: getTerrainHeight(airRadarX, airRadarZ) + 4.2,
    z: airRadarZ,
    yaw: 0.42,
    pitch: -0.18,
    width: 4.4,
    height: 2.5,
    iconType: 2,
    colorHex: HOLO_COLOR_CYAN,
    zone: 'airfield',
  });

  // 2. Central Industrial Island: central tactical radar & slipway hazard bars
  signs.push({
    id: 'holo-island-radar',
    x: ISLAND_CENTER_X - 12.5,
    y: getTerrainHeight(ISLAND_CENTER_X - 12.5, ISLAND_CENTER_Z + 4.5) + 4.8,
    z: ISLAND_CENTER_Z + 4.5,
    yaw: -0.55,
    width: 4.4,
    height: 2.5,
    iconType: 2,
    colorHex: HOLO_COLOR_CYAN,
    zone: 'island',
  });

  signs.push({
    id: 'holo-island-slipway-se',
    x: 24.5,
    y: getSpanClearGroundY(24.5, 22.0, -0.78, 2.4) + 1.8,
    z: 22.0,
    yaw: -0.78,
    width: 5.0,
    height: 1.35,
    iconType: 3,
    colorHex: HOLO_COLOR_AMBER,
    zone: 'island',
  });

  // 3. Citadel Assault Terraces: jump-jet cliff DANGER triangles
  for (const terrace of CITADEL_TERRACES) {
    const outX = terrace.x - CITADEL_CENTER_X;
    const outZ = terrace.z - CITADEL_CENTER_Z;
    const len = Math.hypot(outX, outZ) || 1;
    const ux = outX / len;
    const uz = outZ / len;
    const sx = terrace.x + ux * (terrace.rx * 0.56);
    const sz = terrace.z + uz * (terrace.rz * 0.56);
    signs.push({
      id: `holo-${terrace.id}-danger`,
      x: sx,
      y: getTerrainHeight(sx, sz) + 3.1,
      z: sz,
      yaw: Math.atan2(ux, uz),
      width: 3.6,
      height: 2.3,
      iconType: 1,
      colorHex: HOLO_COLOR_DANGER,
      clearedColorHex: HOLO_COLOR_TEAL_CLEAR,
      zone: 'citadel',
    });
  }

  // 4. Citadel Cliff Perimeter Hazard Stripes & South Gate Overhead Warning
  const cliffAngles = [0.65, 1.35, 2.25, 3.35];
  for (let i = 0; i < cliffAngles.length; i++) {
    const ang = cliffAngles[i];
    const cx = CITADEL_CENTER_X + Math.cos(ang) * (CITADEL_WALL_RX + 4.8);
    const cz = CITADEL_CENTER_Z + Math.sin(ang) * (CITADEL_WALL_RZ + 4.8);
    const cyaw = Math.atan2(Math.cos(ang), Math.sin(ang));
    signs.push({
      id: `holo-citadel-cliff-${i}`,
      x: cx,
      y: getSpanClearGroundY(cx, cz, cyaw, 2.8) + 2.0,
      z: cz,
      yaw: cyaw,
      width: 5.8,
      height: 1.35,
      iconType: 3,
      colorHex: HOLO_COLOR_AMBER,
      clearedColorHex: HOLO_COLOR_TEAL_CLEAR,
      zone: 'citadel',
    });
  }

  // Elevated South Gate alert hologram directly above Citadel South Gate lintel
  const citY = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  signs.push({
    id: 'holo-citadel-south-gate',
    x: CITADEL_CENTER_X + 0.5,
    y: citY + 9.2,
    z: CITADEL_CENTER_Z + CITADEL_WALL_RZ * 0.92,
    yaw: 0.0,
    width: 4.8,
    height: 2.35,
    iconType: 1,
    colorHex: HOLO_COLOR_DANGER,
    clearedColorHex: HOLO_COLOR_TEAL_CLEAR,
    zone: 'citadel',
  });

  // 5. East Quarry Cliff Rim Hazard & Approach Warning
  const qryX = QUARRY_CENTER_X + 10.0;
  const qryZ = QUARRY_CENTER_Z - 11.0;
  signs.push({
    id: 'holo-quarry-cliff-hazard',
    x: qryX,
    y: getSpanClearGroundY(qryX, qryZ, -0.65, 2.5) + 2.1,
    z: qryZ,
    yaw: -0.65,
    width: 5.2,
    height: 1.45,
    iconType: 3,
    colorHex: HOLO_COLOR_AMBER,
    zone: 'quarry',
  });

  return signs;
}

export const SECTOR7_HOLOGRAM_SIGNS: ReadonlyArray<HologramSignSpec> = [
  ...buildBridgePortalSigns(),
  ...buildZoneTacticalSigns(),
];

export function resolveHologramColorHex(
  spec: HologramSignSpec,
  citadelCleared: boolean,
): number {
  if (citadelCleared && spec.clearedColorHex !== undefined) {
    return spec.clearedColorHex;
  }
  return spec.colorHex;
}

export function getHologramLightingParams(preset: LightingPreset): {
  brightness: number;
  backingAlpha: number;
} {
  if (preset === 'day') {
    return { brightness: 1.35, backingAlpha: 0.18 };
  }
  if (preset === 'night') {
    return { brightness: 1.15, backingAlpha: 0.08 };
  }
  return { brightness: 1.25, backingAlpha: 0.11 };
}

/**
 * Generates a single 256x256 2x2 procedural tactical sign atlas with 14 px padding
 * inside every quadrant so LinearFilter never bleeds across tile edges.
 */
export function createHologramAtlasTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback as unknown as THREE.CanvasTexture;
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // --- Icon 0 (top-left 0..128, 0..128): Triple directional chevrons (>>>) ---
  ctx.lineWidth = 7;
  for (let k = 0; k < 3; k++) {
    const ox = 24 + k * 27;
    ctx.beginPath();
    ctx.moveTo(ox, 34);
    ctx.lineTo(ox + 22, 64);
    ctx.lineTo(ox, 94);
    ctx.stroke();
  }

  // --- Icon 1 (top-right 128..256, 0..128): Hazard triangle + exclamation ---
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(192, 26);
  ctx.lineTo(234, 98);
  ctx.lineTo(150, 98);
  ctx.closePath();
  ctx.stroke();

  ctx.fillRect(189, 50, 6, 26);
  ctx.fillRect(189, 83, 6, 7);

  // --- Icon 2 (bottom-left 0..128, 128..256): Tactical radar / reticle ---
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(64, 192, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(64, 192, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(22, 190, 26, 4);
  ctx.fillRect(80, 190, 26, 4);
  ctx.fillRect(62, 150, 4, 26);
  ctx.fillRect(62, 208, 4, 26);
  // Subtle sweep sector line
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 192);
  ctx.lineTo(89, 167);
  ctx.stroke();

  // --- Icon 3 (bottom-right 128..256, 128..256): Diagonal Hazard Stripes ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(144, 146, 96, 92);
  ctx.clip();
  ctx.lineWidth = 10;
  for (let s = -90; s < 190; s += 24) {
    ctx.beginPath();
    ctx.moveTo(144 + s, 146);
    ctx.lineTo(144 + s + 56, 238);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 3.5;
  ctx.strokeRect(144, 146, 96, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
