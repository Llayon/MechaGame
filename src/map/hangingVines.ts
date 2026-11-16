import * as THREE from 'three';
import {
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ISLAND_DECK_RADIUS,
  ISLAND_WATER_SLIPWAYS,
  VIADUCT_BASTION_HALF,
  VIADUCT_ELBOW,
  VIADUCT_ELBOW_Y,
  distToSegment,
  getBridgeSectionOffsets,
  getTerrainHeight,
  lerp,
} from './terrainMath';
import { LEFT_OUTPOST_POS } from './worldStructures';

export interface HangingVineSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scaleX: number;
  scaleY: number;
  phase: number;
  tint: readonly [number, number, number];
}

export const VINE_WIDTH = 2.8;
export const VINE_HEIGHT = 2.4;

function seeded(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function makeTint(seed: number): readonly [number, number, number] {
  const r = 0.82 + seeded(seed * 3.1 + 1.2) * 0.18;
  const g = 0.88 + seeded(seed * 5.7 + 2.4) * 0.12;
  const b = 0.74 + seeded(seed * 7.3 + 4.1) * 0.16;
  return [r, g, b];
}

/**
 * Generates deterministic world-space anchor points for hanging ivy/vines along
 * bridge outer cornices, arch-pylon crowns, the Central Island retaining rim,
 * Citadel fortress walls, and the Forward Outpost Ruins.
 */
export function generateHangingVinesData(): HangingVineSpec[] {
  const vines: HangingVineSpec[] = [];
  let idx = 0;

  // 1. River bridges (outer deck cornices + selected arch-pylon upper crowns)
  for (const spec of BRIDGE_SPECS) {
    if (spec.style === 'viaduct') continue;
    const dx = spec.end[0] - spec.start[0];
    const dz = spec.end[1] - spec.start[1];
    const horizLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    // Lateral unit vector (+right side of bridge)
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    const spanFracs = [0.18, 0.34, 0.5, 0.66, 0.82];
    for (let sIdx = 0; sIdx < spanFracs.length; sIdx++) {
      const f = spanFracs[sIdx];
      const side = (sIdx + idx) % 2 === 0 ? 1 : -1;
      // Place cleanly outside deck concrete fascia (+0.32) below top rail so vines drape visibly without obscuring road or cyan strip
      const lat = side * (spec.width * 0.5 + 0.32);
      const px = spec.start[0] + dx * f + rx * lat;
      const pz = spec.start[1] + dz * f + rz * lat;
      const deckY = lerp(spec.startY, spec.endY, f);
      vines.push({
        id: `${spec.id}-edge-${sIdx}`,
        x: px,
        y: deckY + 0.22,
        z: pz,
        rotY: yaw + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5),
        scaleX: 0.96 + seeded(idx * 2.1) * 0.36,
        scaleY: 0.95 + seeded(idx * 3.7) * 0.38,
        phase: seeded(idx * 4.3) * Math.PI * 2,
        tint: makeTint(idx),
      });
      idx++;
    }

    // Arch-pylon upper crown beams (high overhead, clear of Mech drive lane)
    const sectionOffsets = getBridgeSectionOffsets(spec);
    const isTruss = spec.style === 'truss';
    const clearH = isTruss ? 6.0 : 5.4;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);

    sectionOffsets.forEach((zOff, aIdx) => {
      if (aIdx % 2 === 1) return;
      const f = zOff / horizLen + 0.5;
      const deckY = lerp(spec.startY, spec.endY, f);
      const faceSign = aIdx === 0 ? -1 : 1;
      const archLat = (aIdx === 0 ? -1 : 1) * (spec.width * 0.18);
      const px = spec.start[0] + dx * f + fx * faceSign * 1.04 + rx * archLat;
      const pz = spec.start[1] + dz * f + fz * faceSign * 1.04 + rz * archLat;
      vines.push({
        id: `${spec.id}-arch-${aIdx}`,
        x: px,
        y: deckY + clearH + 0.68,
        z: pz,
        rotY: yaw + (faceSign < 0 ? Math.PI : 0),
        scaleX: 0.85 + seeded(idx * 1.9) * 0.3,
        scaleY: 0.58 + seeded(idx * 2.7) * 0.24,
        phase: seeded(idx * 5.1) * Math.PI * 2,
        tint: makeTint(idx),
      });
      idx++;
    });
  }

  // 2. Serpentine Citadel Viaduct (Flight 1 edges + Central Concrete Bastion outer rim)
  const viaduct = BRIDGE_SPECS.find((b) => b.style === 'viaduct');
  if (viaduct) {
    const dx1 = VIADUCT_ELBOW[0] - viaduct.start[0];
    const dz1 = VIADUCT_ELBOW[1] - viaduct.start[1];
    const yaw1 = Math.atan2(dx1, dz1);
    const rx1 = Math.cos(yaw1);
    const rz1 = -Math.sin(yaw1);

    for (const [f, side] of [
      [0.24, -1],
      [0.48, 1],
      [0.72, -1],
    ] as const) {
      const lat = side * (viaduct.width * 0.5 + 0.32);
      const px = viaduct.start[0] + dx1 * f + rx1 * lat;
      const pz = viaduct.start[1] + dz1 * f + rz1 * lat;
      const py = lerp(viaduct.startY, VIADUCT_ELBOW_Y, f);
      vines.push({
        id: `viaduct-f1-${idx}`,
        x: px,
        y: py + 0.22,
        z: pz,
        rotY: yaw1 + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5),
        scaleX: 0.94 + seeded(idx * 2.3) * 0.3,
        scaleY: 0.92 + seeded(idx * 3.1) * 0.34,
        phase: seeded(idx * 4.9) * Math.PI * 2,
        tint: makeTint(idx),
      });
      idx++;
    }

    // Bastion hub outer faces away from road openings
    for (const angDeg of [35, 125, 215, 305]) {
      const rad = (angDeg * Math.PI) / 180;
      const rEdge = VIADUCT_BASTION_HALF + 0.32;
      const px = VIADUCT_ELBOW[0] + Math.sin(rad) * rEdge;
      const pz = VIADUCT_ELBOW[1] + Math.cos(rad) * rEdge;
      vines.push({
        id: `viaduct-bastion-${idx}`,
        x: px,
        y: VIADUCT_ELBOW_Y + 0.16,
        z: pz,
        rotY: rad,
        scaleX: 0.95 + seeded(idx * 1.7) * 0.25,
        scaleY: 0.9 + seeded(idx * 2.9) * 0.34,
        phase: seeded(idx * 3.7) * Math.PI * 2,
        tint: makeTint(idx),
      });
      idx++;
    }
  }

  // 3. Central Industrial Island retaining rim overlooking river water (clear of sloped apron flare +1.5)
  const islandY = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z);
  const rimCount = 20;
  for (let i = 0; i < rimCount; i++) {
    const theta = (i / rimCount) * Math.PI * 2 + 0.18;
    const px = ISLAND_CENTER_X + Math.sin(theta) * (ISLAND_DECK_RADIUS + 1.56);
    const pz = ISLAND_CENTER_Z + Math.cos(theta) * (ISLAND_DECK_RADIUS + 1.56);

    // Keep clear of bridge portals & rocky island slipways
    let nearCrossing = false;
    for (const b of BRIDGE_SPECS) {
      if (
        Math.hypot(px - b.start[0], pz - b.start[1]) < 8.5 ||
        Math.hypot(px - b.end[0], pz - b.end[1]) < 8.5
      ) {
        nearCrossing = true;
        break;
      }
    }
    if (!nearCrossing) {
      for (const [ax, az, bx, bz, halfW] of ISLAND_WATER_SLIPWAYS) {
        if (distToSegment(px, pz, ax, az, bx, bz) < halfW + 4.0) {
          nearCrossing = true;
          break;
        }
      }
    }
    if (nearCrossing || i % 3 === 1) continue;

    vines.push({
      id: `island-rim-${i}`,
      x: px,
      y: islandY + 0.28,
      z: pz,
      rotY: theta,
      scaleX: 1.0 + seeded(idx * 2.5) * 0.35,
      scaleY: 0.72 + seeded(idx * 3.3) * 0.26,
      phase: seeded(idx * 6.1) * Math.PI * 2,
      tint: makeTint(idx),
    });
    idx++;
  }

  // 4. Citadel outer fortress walls (outer concrete parapet, skipping gate portals)
  const citY = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const isGate = i === 1 || i === 3;
    const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8;
    const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8;
    const x0 = CITADEL_CENTER_X + Math.cos(a0) * CITADEL_WALL_RX;
    const z0 = CITADEL_CENTER_Z + Math.sin(a0) * CITADEL_WALL_RZ;
    const x1 = CITADEL_CENTER_X + Math.cos(a1) * CITADEL_WALL_RX;
    const z1 = CITADEL_CENTER_Z + Math.sin(a1) * CITADEL_WALL_RZ;

    const segDx = x1 - x0;
    const segDz = z1 - z0;
    const segLen = Math.hypot(segDx, segDz);
    const midX = (x0 + x1) * 0.5;
    const midZ = (z0 + z1) * 0.5;
    // Outward normal pointing away from Citadel courtyard center
    let nx = midX - CITADEL_CENTER_X;
    let nz = midZ - CITADEL_CENTER_Z;
    const nLen = Math.hypot(nx, nz) || 1;
    nx /= nLen;
    nz /= nLen;
    const outRotY = Math.atan2(nx, nz);
    const tx = segDx / segLen;
    const tz = segDz / segLen;

    const offsets = isGate ? [-segLen * 0.36, segLen * 0.36] : [-segLen * 0.24, segLen * 0.24];
    for (const sOff of offsets) {
      const px = midX + tx * sOff + nx * (isGate ? 1.44 : 1.24);
      const pz = midZ + tz * sOff + nz * (isGate ? 1.44 : 1.24);
      vines.push({
        id: `citadel-wall-${i}-${idx}`,
        x: px,
        y: citY + (isGate ? 6.45 : 3.45),
        z: pz,
        rotY: outRotY,
        scaleX: 1.0 + seeded(idx * 2.2) * 0.35,
        scaleY: (isGate ? 1.05 : 0.85) + seeded(idx * 3.8) * 0.3,
        phase: seeded(idx * 5.7) * Math.PI * 2,
        tint: makeTint(idx),
      });
      idx++;
    }
  }

  // 5. Left Plateau Forward Outpost Ruins (broken casemate roof & breached perimeter walls)
  const [outX, outZ] = LEFT_OUTPOST_POS;
  const outY = getTerrainHeight(outX, outZ);
  const outRot = 0.42;
  const cosO = Math.cos(outRot);
  const sinO = Math.sin(outRot);
  const localRuins: ReadonlyArray<[number, number, number, number]> = [
    [-2.4, 2.75, 0.8, 0.2],
    [-5.4, 2.75, 5.8, 0.05],
    [4.6, 2.55, 5.5, 0.25],
    [7.4, 2.5, -1.5, Math.PI * 0.5],
  ];
  for (let rIdx = 0; rIdx < localRuins.length; rIdx++) {
    const [lx, ly, lz, lRot] = localRuins[rIdx];
    const wx = outX + lx * cosO + lz * sinO;
    const wz = outZ - lx * sinO + lz * cosO;
    vines.push({
      id: `outpost-ruin-${rIdx}`,
      x: wx,
      y: outY + ly,
      z: wz,
      rotY: outRot + lRot,
      scaleX: 0.9 + seeded(idx * 2.7) * 0.3,
      scaleY: 0.72 + seeded(idx * 3.1) * 0.24,
      phase: seeded(idx * 4.4) * Math.PI * 2,
      tint: makeTint(idx),
    });
    idx++;
  }

  return vines;
}

/**
 * Builds the low-poly segmented curtain plane (4 vertical subdivisions)
 * anchored strictly at top edge y = 0 and hanging down to y = -VINE_HEIGHT.
 */
export function createHangingVineGeometry(): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(VINE_WIDTH, VINE_HEIGHT, 1, 4);
  geom.translate(0, -VINE_HEIGHT * 0.5, 0);
  return geom;
}
