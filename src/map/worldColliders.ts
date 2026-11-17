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
  ISLAND_WATER_SLIPWAYS,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  ROCKY_WATER_RAMPS,
  SCALE_X,
  SCALE_Z,
  VIADUCT_BASTION_HALF,
  VIADUCT_ELBOW,
  VIADUCT_ELBOW_Y,
  WATER_LEVEL,
  clamp,
  getBridgeSectionOffsets,
  lerp,
} from './terrainMath';
import {
  ANTI_MECH_BARRICADE_NODES,
  BUNKER_COORDS,
  DEFAULT_POWERLINE_POLE_COORDS,
  HQ_FOREFIELD_CONVOYS,
  HQ_FOREFIELD_ROCK_RIDGES,
  HQ_FOREFIELD_SCREENS,
  LEFT_FUEL_DEPOT_POS,
  LEFT_OUTPOST_POS,
  RIVER_BEND_LEDGES,
  RIVER_BEND_PIER_POS,
  SOUTH_FLANK_POWERLINE,
  WEST_FLANK_POWERLINE,
  WRECK_COORDS,
  generatePineForestData,
  generateRockOutcropsData,
} from './worldStructures';
import { getTitanWreckColliders } from './titanWrecks';
import { getFloodedRuinColliders } from './floodedRuins';

// Effective XZ bounding radius for Soviet Object 316 at MECH_SCALE = 0.8 (~4.3 m)
export const MECH_COLLISION_RADIUS = 1.15;

export type ColliderTag =
  | 'structure'
  | 'wall'
  | 'citadel-wall'
  | 'bridge-pier'
  | 'bridge-deck'
  | 'bunker'
  | 'wreck'
  | 'barricade'
  | 'rock'
  | 'tree'
  | 'vehicle'
  | 'titan-wreck';

export interface CircleCollider {
  kind: 'circle';
  cx: number;
  cz: number;
  r: number;
  minY?: number;
  maxY?: number;
  tag: ColliderTag;
}

export interface BoxCollider {
  kind: 'box';
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cosY: number;
  sinY: number;
  minY?: number;
  maxY?: number;
  tag: ColliderTag;
}

export type WorldCollider = CircleCollider | BoxCollider;

const CELL_SIZE = 16;

function localToWorldXZ(
  originX: number,
  originZ: number,
  rotY: number,
  lx: number,
  lz: number,
): [number, number] {
  // Matches Three.js Object3D rotation.y convention:
  // worldX = lx * cos(rotY) + lz * sin(rotY)
  // worldZ = -lx * sin(rotY) + lz * cos(rotY)
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [originX + lx * c + lz * s, originZ - lx * s + lz * c];
}

function makeBox(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  rotY: number,
  tag: ColliderTag,
  minY?: number,
  maxY?: number,
): BoxCollider {
  return {
    kind: 'box',
    cx,
    cz,
    halfW: width * 0.5,
    halfD: depth * 0.5,
    cosY: Math.cos(rotY),
    sinY: Math.sin(rotY),
    minY,
    maxY,
    tag,
  };
}

function makeCircle(
  cx: number,
  cz: number,
  r: number,
  tag: ColliderTag,
  minY?: number,
  maxY?: number,
): CircleCollider {
  return {
    kind: 'circle',
    cx,
    cz,
    r,
    minY,
    maxY,
    tag,
  };
}

function buildWorldColliders(): WorldCollider[] {
  const list: WorldCollider[] = [];

  // 1. Airfield Staging Base (rotY = -0.22)
  const airRot = -0.22;
  const addAirBox = (
    lx: number,
    lz: number,
    w: number,
    d: number,
    localRotY: number,
    tag: ColliderTag,
  ) => {
    const [wx, wz] = localToWorldXZ(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z, airRot, lx, lz);
    list.push(makeBox(wx, wz, w, d, airRot + localRotY, tag));
  };
  const addAirCircle = (lx: number, lz: number, r: number, tag: ColliderTag) => {
    const [wx, wz] = localToWorldXZ(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z, airRot, lx, lz);
    list.push(makeCircle(wx, wz, r, tag));
  };

  // Concrete perimeter berms
  addAirBox(-30.6, 11.5, 1.2, 22.2, 0, 'wall');
  addAirBox(0, 22.6, 62.4, 1.2, 0, 'wall');

  // Parked Helicopters (1.4x) & APCs (1.3x)
  addAirCircle(-10.5, -6.2, 2.35, 'vehicle');
  addAirCircle(11.0, 6.2, 2.35, 'vehicle');
  addAirCircle(11.0, -6.2, 2.35, 'vehicle');

  addAirCircle(-21.0, 9.5, 1.55, 'vehicle');
  addAirCircle(-13.0, 12.2, 1.55, 'vehicle');
  addAirCircle(6.5, -13.5, 1.55, 'vehicle');
  addAirCircle(22.0, -10.5, 1.55, 'vehicle');

  // 6 Quonset Hangars
  addAirBox(-18.0, -26.0, 8.4, 11.8, 0, 'structure');
  addAirBox(-4.5, -26.0, 8.4, 11.8, 0, 'structure');
  addAirBox(9.5, -25.2, 8.2, 11.4, -0.22, 'structure');
  addAirBox(33.5, 6.5, 8.2, 11.4, Math.PI / 2, 'structure');
  addAirBox(33.5, 18.0, 7.8, 10.8, Math.PI / 2, 'structure');
  addAirBox(-33.5, -7.5, 7.8, 11.0, Math.PI / 2, 'structure');

  // Concrete barracks & supply crates
  for (const cx of [-22.0, -15.5, -9.0]) {
    addAirBox(cx, 26.5, 5.0, 7.2, 0, 'structure');
  }
  for (const [kx, kz] of [
    [22.0, 14.0],
    [24.5, 11.5],
    [19.5, 16.0],
  ] as const) {
    addAirBox(kx, kz, 1.6, 1.6, 0, 'barricade');
  }

  // 2. Central Refinery Island
  const addIslBox = (
    lx: number,
    lz: number,
    w: number,
    d: number,
    rotY: number,
    tag: ColliderTag,
  ) => {
    list.push(makeBox(ISLAND_CENTER_X + lx, ISLAND_CENTER_Z + lz, w, d, rotY, tag));
  };
  const addIslCircle = (lx: number, lz: number, r: number, tag: ColliderTag) => {
    list.push(makeCircle(ISLAND_CENTER_X + lx, ISLAND_CENTER_Z + lz, r, tag));
  };

  // Central Derrick Tower
  addIslCircle(0, 0, 2.75, 'structure');
  // 4 Industrial Workshops
  addIslBox(-12.5, -11.5, 8.6, 11.6, 0.32, 'structure');
  addIslBox(9.5, -13.5, 9.0, 12.0, -0.42, 'structure');
  addIslBox(11.0, 12.8, 8.8, 11.8, 0.48, 'structure');
  addIslBox(-10.5, 16.5, 8.4, 11.2, -0.25, 'structure');
  // Brick Refinery Smokestack Hall (scale 2.4)
  addIslBox(-18.0, -1.5, 7.0, 5.8, 0, 'structure');
  // 7 Storage Tanks
  addIslCircle(-1.5, -19.5, 2.85, 'structure');
  addIslCircle(3.8, -21.2, 2.55, 'structure');
  addIslCircle(20.0, 6.5, 3.05, 'structure');
  addIslCircle(19.5, 13.5, 2.65, 'structure');
  addIslCircle(-1.0, 18.8, 2.85, 'structure');
  addIslCircle(14.5, -22.5, 2.45, 'structure');
  addIslCircle(19.8, -19.2, 2.25, 'structure');
  // Dockside Gantry Cranes: side rail legs only (center bay clear underneath)
  for (const crane of [
    { x: 6.5, z: 22.8, rotY: 0.22, span: 9.5, depth: 4.6 },
    { x: -19.5, z: -15.5, rotY: 0.72, span: 9.2, depth: 4.4 },
  ]) {
    for (const side of [-1, 1]) {
      const [wx, wz] = localToWorldXZ(
        ISLAND_CENTER_X + crane.x,
        ISLAND_CENTER_Z + crane.z,
        crane.rotY,
        side * crane.span * 0.5,
        0,
      );
      list.push(makeBox(wx, wz, 1.0, crane.depth + 1.4, crane.rotY, 'structure'));
    }
  }
  // 3 Armored Concrete Blast Screens
  addIslBox(-7.0, -25.8, 12.0, 1.4, Math.PI - 0.18, 'wall');
  addIslBox(21.5, -15.0, 10.5, 1.4, Math.PI - 0.85, 'wall');
  addIslBox(-17.5, 21.5, 11.0, 1.4, -0.55, 'wall');

  // 3. Highland Citadel Fortress
  const addCitBox = (
    lx: number,
    lz: number,
    w: number,
    d: number,
    rotY: number,
    tag: ColliderTag,
  ) => {
    list.push(makeBox(CITADEL_CENTER_X + lx, CITADEL_CENTER_Z + lz, w, d, rotY, tag));
  };
  const addCitCircle = (lx: number, lz: number, r: number, tag: ColliderTag) => {
    list.push(makeCircle(CITADEL_CENTER_X + lx, CITADEL_CENTER_Z + lz, r, tag));
  };

  // Octagonal Perimeter Curtain Walls + Open Gateways (i === 1 South Gate, i === 3 West Viaduct Gate)
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8;
    const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8;
    const x0 = Math.cos(a0) * CITADEL_WALL_RX;
    const z0 = Math.sin(a0) * CITADEL_WALL_RZ;
    const x1 = Math.cos(a1) * CITADEL_WALL_RX;
    const z1 = Math.sin(a1) * CITADEL_WALL_RZ;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rotY = Math.atan2(x1 - x0, z1 - z0);
    const isGate = i === 1 || i === 3;
    if (isGate) {
      // Flanking gatehouse bastions only, keeping central roadway/viaduct passage clear
      for (const side of [-1, 1]) {
        const [bx, bz] = localToWorldXZ(
          CITADEL_CENTER_X + mx,
          CITADEL_CENTER_Z + mz,
          rotY,
          0,
          side * len * 0.38,
        );
        list.push(makeBox(bx, bz, 2.6, len * 0.24, rotY, 'citadel-wall'));
      }
    } else {
      addCitBox(mx, mz, 2.3, len + 1.0, rotY, 'citadel-wall');
    }
    // Corner bastion watchtower (scale 3.3)
    addCitCircle(x0 * 0.96, z0 * 0.96, 2.05, 'citadel-wall');
  }

  // Central Armored Command Keep
  addCitCircle(0, -1.0, 8.2, 'structure');
  // 4 Inner Courtyard Blast Screens
  addCitBox(-17.5, 0.5, 10.5, 1.4, Math.PI / 2, 'wall');
  addCitBox(17.5, 0.5, 10.5, 1.4, -Math.PI / 2, 'wall');
  addCitBox(0, 17.5, 12.0, 1.4, 0, 'wall');
  addCitBox(0, -18.5, 12.0, 1.4, Math.PI, 'wall');
  // 4 Courtyard Bunkers & Energy Generators
  addCitBox(-24.0, -10.5, 6.8, 4.6, 0.45, 'bunker');
  addCitBox(24.5, -10.0, 7.4, 5.2, -2.35, 'bunker');
  addCitBox(-27.5, 8.5, 7.4, 5.2, 0.85, 'bunker');
  addCitBox(27.0, 9.0, 6.8, 4.6, -0.75, 'bunker');
  // 8 Quonset Hangars
  addCitBox(-25.0, -23.0, 8.4, 12.6, 0.18, 'structure');
  addCitBox(-9.5, -26.5, 8.4, 12.6, 0.05, 'structure');
  addCitBox(9.5, -26.5, 8.4, 12.6, -0.05, 'structure');
  addCitBox(25.0, -23.0, 8.4, 12.6, -0.18, 'structure');
  addCitBox(-26.5, 21.0, 8.0, 11.8, -0.22, 'structure');
  addCitBox(-15.0, 25.5, 7.8, 11.6, 0.1, 'structure');
  addCitBox(15.0, 25.5, 7.8, 11.6, -0.1, 'structure');
  addCitBox(26.5, 21.0, 8.0, 11.8, 0.22, 'structure');
  // 3 Courtyard Armored Vehicles
  addCitCircle(-8.5, 11.5, 1.55, 'vehicle');
  addCitCircle(10.5, 10.2, 1.55, 'vehicle');
  addCitCircle(11.0, -11.5, 1.55, 'vehicle');

  // 4. Quarry & Pass
  list.push(makeCircle(-1.8 * SCALE_X, -10.5 * SCALE_Z, 2.25, 'vehicle'));
  list.push(makeCircle(QUARRY_CENTER_X - 1.5, QUARRY_CENTER_Z + 0.8, 2.25, 'vehicle'));
  list.push(makeBox(QUARRY_CENTER_X + 9.5, QUARRY_CENTER_Z + 8.5, 5.2, 4.2, 0, 'structure'));

  // Powerline poles (thin poles)
  for (const line of [DEFAULT_POWERLINE_POLE_COORDS, WEST_FLANK_POWERLINE, SOUTH_FLANK_POWERLINE]) {
    for (const [px, pz] of line) {
      list.push(makeCircle(px, pz, 0.35, 'barricade'));
    }
  }

  // 5. Bridges & Elevated Viaduct (Elevation-banded so riverbed traversal never hits bridge cover)
  for (const spec of BRIDGE_SPECS) {
    if (spec.style !== 'viaduct') {
      const dx = spec.end[0] - spec.start[0];
      const dz = spec.end[1] - spec.start[1];
      const horizLen = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const midX = (spec.start[0] + spec.end[0]) * 0.5;
      const midZ = (spec.start[1] + spec.end[1]) * 0.5;
      const minDeckY = Math.min(spec.startY, spec.endY) - 0.85;

      // Side concrete parapets (keeps Mech from walking off the edge while on the deck)
      for (const side of [-1, 1]) {
        const [wx, wz] = localToWorldXZ(
          midX,
          midZ,
          yaw,
          side * (spec.width * 0.5 - 0.22),
          0,
        );
        list.push(makeBox(wx, wz, 0.55, horizLen - 1.5, yaw, 'wall', minDeckY));
      }

      // Underwater / riverbed support pier columns (solid only below the bridge deck)
      for (const f of [0.28, 0.72]) {
        const deckYAtPier = lerp(spec.startY, spec.endY, f);
        const pierX = spec.start[0] + dx * f;
        const pierZ = spec.start[1] + dz * f;
        for (const side of [-1, 1]) {
          const [px, pz] = localToWorldXZ(pierX, pierZ, yaw, side * (spec.width * 0.28), 0);
          list.push(
            makeBox(px, pz, 1.5, 1.7, yaw, 'bridge-pier', undefined, deckYAtPier - 0.75),
          );
        }
      }

      // On-deck CargoContainers & VehicleWrecks cover
      const offsets = getBridgeSectionOffsets(spec);
      const laneOffset = spec.width * 0.275;
      for (let i = 0; i < offsets.length - 1; i++) {
        const zMid = (offsets[i] + offsets[i + 1]) * 0.5;
        const side = i % 2 === 0 ? 1 : -1;
        const [cx, cz] = localToWorldXZ(midX, midZ, yaw, side * laneOffset, zMid - 0.9);
        list.push(
          makeBox(cx, cz, 1.5, 3.4, yaw + side * 0.14, 'bridge-deck', minDeckY),
        );
        const [wx, wz] = localToWorldXZ(
          midX,
          midZ,
          yaw,
          -side * (spec.width * 0.28),
          zMid + 1.2,
        );
        list.push(makeCircle(wx, wz, 1.15, 'bridge-deck', minDeckY));
      }

      if (spec.id === 'bridge-center') {
        for (const side of [-1, 1]) {
          const [gx, gz] = localToWorldXZ(midX, midZ, yaw, side * ((spec.width + 1.8) * 0.5), 0);
          list.push(makeBox(gx, gz, 0.9, 6.2, yaw, 'bridge-deck', minDeckY));
        }
      }
    } else {
      // Serpentine Citadel Viaduct + Central Bastion Crossway
      const dx1 = VIADUCT_ELBOW[0] - spec.start[0];
      const dz1 = VIADUCT_ELBOW[1] - spec.start[1];
      const len1 = Math.hypot(dx1, dz1);
      const yaw1 = Math.atan2(dx1, dz1);
      const f1EndX = spec.start[0] + (dx1 / len1) * (len1 - VIADUCT_BASTION_HALF);
      const f1EndZ = spec.start[1] + (dz1 / len1) * (len1 - VIADUCT_BASTION_HALF);
      const f1MidX = (spec.start[0] + f1EndX) * 0.5;
      const f1MidZ = (spec.start[1] + f1EndZ) * 0.5;
      const f1Horiz = Math.hypot(f1EndX - spec.start[0], f1EndZ - spec.start[1]);

      const dx2 = spec.end[0] - VIADUCT_ELBOW[0];
      const dz2 = spec.end[1] - VIADUCT_ELBOW[1];
      const len2 = Math.hypot(dx2, dz2);
      const yaw2 = Math.atan2(dx2, dz2);
      const f2StartX = VIADUCT_ELBOW[0] + (dx2 / len2) * VIADUCT_BASTION_HALF;
      const f2StartZ = VIADUCT_ELBOW[1] + (dz2 / len2) * VIADUCT_BASTION_HALF;
      const f2MidX = (f2StartX + spec.end[0]) * 0.5;
      const f2MidZ = (f2StartZ + spec.end[1]) * 0.5;
      const f2Horiz = Math.hypot(spec.end[0] - f2StartX, spec.end[1] - f2StartZ);

      // Flight 1 & Flight 2 midpoint canyon trestle piers (solid below flight midpoint deck)
      const f1MidY = (spec.startY + VIADUCT_ELBOW_Y) * 0.5;
      const f2MidY = (VIADUCT_ELBOW_Y + spec.endY) * 0.5;
      for (const side of [-1, 1]) {
        const [p1x, p1z] = localToWorldXZ(f1MidX, f1MidZ, yaw1, side * (spec.width * 0.28), 0);
        list.push(makeBox(p1x, p1z, 1.5, 1.7, yaw1, 'bridge-pier', undefined, f1MidY - 0.75));
        const [p2x, p2z] = localToWorldXZ(f2MidX, f2MidZ, yaw2, side * (spec.width * 0.28), 0);
        list.push(makeBox(p2x, p2z, 1.5, 1.7, yaw2, 'bridge-pier', undefined, f2MidY - 0.75));
      }

      // Flight 1 & 2 side guardrails & cover
      const f1MinY = spec.startY - 0.85;
      const f2MinY = VIADUCT_ELBOW_Y - 0.85;
      for (const side of [-1, 1]) {
        const [g1x, g1z] = localToWorldXZ(
          f1MidX,
          f1MidZ,
          yaw1,
          side * (spec.width * 0.5 - 0.22),
          0,
        );
        list.push(makeBox(g1x, g1z, 0.55, f1Horiz - 1.0, yaw1, 'wall', f1MinY));

        const [g2x, g2z] = localToWorldXZ(
          f2MidX,
          f2MidZ,
          yaw2,
          side * (spec.width * 0.5 - 0.22),
          0,
        );
        list.push(makeBox(g2x, g2z, 0.55, f2Horiz - 1.0, yaw2, 'wall', f2MinY));
      }

      // Flight 1 cargo container & wreck
      {
        const [cx, cz] = localToWorldXZ(f1MidX, f1MidZ, yaw1, spec.width * 0.26, -5.8);
        list.push(makeBox(cx, cz, 1.5, 3.4, yaw1 + 0.14, 'bridge-deck', f1MinY));
        const [wx, wz] = localToWorldXZ(f1MidX, f1MidZ, yaw1, -spec.width * 0.26, 5.8);
        list.push(makeCircle(wx, wz, 1.1, 'bridge-deck', f1MinY));
      }
      // Flight 2 cargo container & wreck
      {
        const [cx, cz] = localToWorldXZ(f2MidX, f2MidZ, yaw2, -spec.width * 0.26, -5.5);
        list.push(makeBox(cx, cz, 1.5, 3.3, yaw2 - 0.12, 'bridge-deck', f2MinY));
        const [wx, wz] = localToWorldXZ(f2MidX, f2MidZ, yaw2, spec.width * 0.26, -5.0);
        list.push(makeCircle(wx, wz, 1.1, 'bridge-deck', f2MinY));
      }

      // Central Bastion-Crossway hub walls, cover, and 4 under-hub caisson piers
      const hubYaw = (yaw1 + yaw2) * 0.5;
      const hubWidth = 21.0;
      const hubLength = 21.0;
      const hubMinY = VIADUCT_ELBOW_Y - 0.85;
      for (const [px, pz] of [
        [-6.4, -6.4],
        [6.4, -6.4],
        [-6.4, 6.4],
        [6.4, 6.4],
      ] as const) {
        const [wx, wz] = localToWorldXZ(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1], hubYaw, px, pz);
        list.push(
          makeBox(wx, wz, 2.2, 2.2, hubYaw, 'bridge-pier', undefined, VIADUCT_ELBOW_Y - 0.8),
        );
      }
      for (const side of [-1, 1]) {
        const [wx, wz] = localToWorldXZ(
          VIADUCT_ELBOW[0],
          VIADUCT_ELBOW[1],
          hubYaw,
          side * (hubWidth * 0.5 - 1.15),
          0,
        );
        list.push(makeBox(wx, wz, 2.3, hubLength * 0.88, hubYaw, 'wall', hubMinY));
      }
      {
        const [sx, sz] = localToWorldXZ(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1], hubYaw, 5.6, 9.3);
        list.push(makeBox(sx, sz, 9.2, 2.1, hubYaw, 'wall', hubMinY));
        const [bsx, bsz] = localToWorldXZ(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1], hubYaw, 0.8, 0.6);
        list.push(makeBox(bsx, bsz, 8.4, 1.2, hubYaw - 0.38, 'wall', hubMinY));
        const [ccx, ccz] = localToWorldXZ(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1], hubYaw, 5.8, -4.6);
        list.push(makeBox(ccx, ccz, 1.65, 3.8, hubYaw + 0.28, 'bridge-deck', hubMinY));
        const [vwx, vwz] = localToWorldXZ(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1], hubYaw, 6.2, 3.8);
        list.push(makeCircle(vwx, vwz, 1.15, 'bridge-deck', hubMinY));
      }
    }
  }

  // 6. Flank Cover Landmarks
  for (const b of BUNKER_COORDS) {
    list.push(makeCircle(b.x, b.z, 3.25, 'bunker'));
  }
  for (const w of WRECK_COORDS) {
    list.push(makeCircle(w.x, w.z, 1.85 * w.scale, 'wreck'));
  }
  for (const n of ANTI_MECH_BARRICADE_NODES) {
    const s = n.scale ?? 1.0;
    if (n.kind === 'jersey-block') {
      list.push(makeBox(n.x, n.z, 3.2 * s, 1.4 * s, n.rotY, 'barricade'));
    } else {
      list.push(makeCircle(n.x, n.z, 1.45 * s, 'barricade'));
    }
  }

  // Forward Outpost Ruins walls & containers (keeping center breach ramp walkable)
  {
    const [ox, oz] = LEFT_OUTPOST_POS;
    const oRot = 0.42;
    const addOutBox = (lx: number, lz: number, w: number, d: number, localRot: number) => {
      const [wx, wz] = localToWorldXZ(ox, oz, oRot, lx, lz);
      list.push(makeBox(wx, wz, w, d, oRot + localRot, 'structure'));
    };
    addOutBox(-3.2, -2.1, 6.4, 5.5, 0.25); // Casemate core
    addOutBox(-5.4, 5.2, 6.2, 1.1, -0.18); // Left breach wall
    addOutBox(4.8, 4.9, 5.8, 1.1, 0.24); // Right breach wall
    addOutBox(6.8, -1.6, 7.2, 1.0, Math.PI / 2 - 0.18); // East blast shield
    addOutBox(3.6, -3.6, 1.6, 1.6, 0.4); // Mast plinth
    addOutBox(3.8, 1.2, 1.7, 4.0, -0.38); // Cargo container 1
    addOutBox(-6.0, 1.6, 1.6, 3.4, 0.88); // Cargo container 2
  }

  // Left Fuel Depot silos & pressurized cisterns
  {
    const [fx, fz] = LEFT_FUEL_DEPOT_POS;
    const fRot = 0.22;
    for (const [lx, lz, r] of [
      [-4.5, -2.6, 2.2],
      [0.4, -2.8, 2.1],
      [4.9, -2.3, 2.0],
    ] as const) {
      const [wx, wz] = localToWorldXZ(fx, fz, fRot, lx, lz);
      list.push(makeCircle(wx, wz, r, 'structure'));
    }
    for (const [lx, lz] of [
      [-3.2, 3.0],
      [2.8, 2.8],
    ] as const) {
      const [wx, wz] = localToWorldXZ(fx, fz, fRot, lx, lz);
      list.push(makeBox(wx, wz, 5.6, 2.5, fRot, 'structure'));
    }
    const [cx, cz] = localToWorldXZ(fx, fz, fRot, -6.2, 2.8);
    list.push(makeBox(cx, cz, 1.5, 3.2, fRot + 0.14, 'structure'));
  }

  // SE River Bend Pier: quay containers, tanks, crane pedestal, gantry legs, pilings & moored barge
  {
    const [px, pz] = RIVER_BEND_PIER_POS;
    const pRot = -0.32;
    const deckY = WATER_LEVEL + 3.65;
    const addPierBox = (
      lx: number,
      lz: number,
      w: number,
      d: number,
      localRot: number,
      tag: ColliderTag,
      minY?: number,
      maxY?: number,
    ) => {
      const [wx, wz] = localToWorldXZ(px, pz, pRot, lx, lz);
      list.push(makeBox(wx, wz, w, d, pRot + localRot, tag, minY, maxY));
    };
    const addPierCircle = (
      lx: number,
      lz: number,
      r: number,
      tag: ColliderTag,
      minY?: number,
      maxY?: number,
    ) => {
      const [wx, wz] = localToWorldXZ(px, pz, pRot, lx, lz);
      list.push(makeCircle(wx, wz, r, tag, minY, maxY));
    };

    // Pilings beneath pier deck
    for (const [cx, cz] of [
      [-8.2, -11.5],
      [-8.2, -3.8],
      [-8.2, 3.8],
      [-8.2, 11.5],
      [-1.8, -11.5],
      [-1.8, 0],
      [-1.8, 11.5],
    ] as const) {
      addPierCircle(cx, cz, 1.25, 'bridge-pier', undefined, deckY - 0.6);
    }
    // Quay cover on deck
    addPierBox(5.8, -8.8, 1.7, 4.2, 0.12, 'structure', deckY - 0.5);
    addPierBox(5.4, 2.5, 1.7, 4.0, -0.16, 'structure', deckY - 0.5);
    addPierBox(1.8, 10.2, 1.65, 3.8, 1.32, 'structure', deckY - 0.5);
    addPierCircle(7.4, 9.6, 1.7, 'structure', deckY - 0.5);
    addPierCircle(7.5, 5.8, 1.5, 'structure', deckY - 0.5);
    addPierCircle(-6.8, 8.8, 1.95, 'structure', deckY - 0.5); // Jib crane pedestal
    // Portal crane rail legs
    for (const side of [-1, 1]) {
      const [lx, lz] = localToWorldXZ(-1.2, -6.5, Math.PI / 2, side * 4.8, 0);
      addPierBox(lx, lz, 0.95, 6.2, Math.PI / 2, 'structure', deckY - 0.5);
    }
    // Moored river barge beside quay
    addPierBox(-15.2, -1.5, 5.4, 16.5, 0.04, 'structure');
  }

  for (const ledge of [...RIVER_BEND_LEDGES, ...HQ_FOREFIELD_ROCK_RIDGES]) {
    list.push(makeCircle(ledge.pos[0], ledge.pos[1], 4.2 * ledge.scale, 'rock'));
  }
  for (const convoy of HQ_FOREFIELD_CONVOYS) {
    list.push(makeBox(convoy.pos[0], convoy.pos[1], 8.6 * convoy.scale, 6.4 * convoy.scale, convoy.rotY, 'wreck'));
  }
  for (const scr of HQ_FOREFIELD_SCREENS) {
    list.push(makeBox(scr.pos[0], scr.pos[1], scr.width, 1.4, scr.rotY, 'wall'));
  }

  // Ramp side guide outcrops & beacons (keep ramp lane clear)
  for (const [ax, az, bx, bz, halfW] of [...ROCKY_WATER_RAMPS, ...ISLAND_WATER_SLIPWAYS]) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    for (const side of [-1, 1]) {
      for (const t of [0.24, 0.54, 0.82]) {
        const px = ax + dx * t + nx * side * (halfW + 1.5);
        const pz = az + dz * t + nz * side * (halfW + 1.5);
        list.push(makeCircle(px, pz, 1.55, 'rock'));
      }
    }
  }

  // Citadel terrace outer rock cover barriers
  for (const t of CITADEL_TERRACES) {
    const outX = t.x - CITADEL_CENTER_X;
    const outZ = t.z - CITADEL_CENTER_Z;
    const len = Math.hypot(outX, outZ);
    const ux = outX / len;
    const uz = outZ / len;
    const bx = t.x + ux * (t.rx * 0.46);
    const bz = t.z + uz * (t.rz * 0.46);
    const rotY = Math.atan2(ux, uz);
    list.push(makeBox(bx, bz, 8.2, 2.8, rotY, 'rock'));
  }

  // 7. Conifer Forest root boulders (pine trunks themselves are crushable via FallingTreesSystem)
  const forest = generatePineForestData();
  for (const rr of forest.rootRocks) {
    const r = Math.max(rr.sx, rr.sz) * 0.72;
    if (r >= 0.45) {
      list.push(makeCircle(rr.x, rr.z, r, 'rock'));
    }
  }

  // 8. Scattered cliff/shoreline/ridge boulders (skip small satellite rubble so Mech walks over debris)
  const outcrops = generateRockOutcropsData();
  for (const r of outcrops) {
    if (r.tier === 'rubble') continue;
    const rad = Math.max(r.sx, r.sz) * 0.78;
    if (rad >= 0.78) {
      list.push(makeCircle(r.x, r.z, rad, 'rock'));
    }
  }

  // 9. Colossal buried Titan wrecks (bulwarks, reactor shields, & splayed flank legs)
  for (const tc of getTitanWreckColliders()) {
    list.push(tc);
  }

  // 10. Eastern river channel flooded industrial ruins & collapsed abutment barricades
  for (const fc of getFloodedRuinColliders()) {
    list.push(fc);
  }

  return list;
}

interface SpatialGrid {
  colliders: WorldCollider[];
  cells: Map<number, number[]>;
}

let cachedGrid: SpatialGrid | null = null;

function hashCell(gx: number, gz: number): number {
  // Pack signed cell coords cleanly into 32-bit key (arena spans +-25 cells)
  return ((gx + 2048) << 12) | (gz + 2048);
}

function getColliderBounds(c: WorldCollider): [number, number, number, number] {
  if (c.kind === 'circle') {
    return [c.cx - c.r, c.cx + c.r, c.cz - c.r, c.cz + c.r];
  }
  const ex = Math.abs(c.halfW * c.cosY) + Math.abs(c.halfD * c.sinY);
  const ez = Math.abs(c.halfW * c.sinY) + Math.abs(c.halfD * c.cosY);
  return [c.cx - ex, c.cx + ex, c.cz - ez, c.cz + ez];
}

function getSpatialGrid(): SpatialGrid {
  if (cachedGrid) return cachedGrid;
  const colliders = buildWorldColliders();
  const cells = new Map<number, number[]>();

  for (let idx = 0; idx < colliders.length; idx++) {
    const [minX, maxX, minZ, maxZ] = getColliderBounds(colliders[idx]);
    const gx0 = Math.floor(minX / CELL_SIZE);
    const gx1 = Math.floor(maxX / CELL_SIZE);
    const gz0 = Math.floor(minZ / CELL_SIZE);
    const gz1 = Math.floor(maxZ / CELL_SIZE);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = hashCell(gx, gz);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(idx);
      }
    }
  }

  cachedGrid = { colliders, cells };
  return cachedGrid;
}

export function getWorldColliderCount(): number {
  return getSpatialGrid().colliders.length;
}

export function queryNearbyColliders(x: number, z: number): WorldCollider[] {
  const { colliders, cells } = getSpatialGrid();
  const gx = Math.floor(x / CELL_SIZE);
  const gz = Math.floor(z / CELL_SIZE);
  const seen = new Set<number>();
  const out: WorldCollider[] = [];
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const bucket = cells.get(hashCell(gx + ox, gz + oz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const id = bucket[i];
        if (!seen.has(id)) {
          seen.add(id);
          out.push(colliders[id]);
        }
      }
    }
  }
  return out;
}

/**
 * Returns all unique WorldColliders whose spatial grid cells intersect or neighbor
 * the XZ segment (x0, z0) -> (x1, z1). Used by ballistic raycasting and enemy LOS.
 */
export function queryCollidersAlongSegment(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): WorldCollider[] {
  const { colliders, cells } = getSpatialGrid();
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (CELL_SIZE * 0.5)));
  const seen = new Set<number>();
  const visitedCells = new Set<number>();
  const out: WorldCollider[] = [];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const gx = Math.floor((x0 + dx * t) / CELL_SIZE);
    const gz = Math.floor((z0 + dz * t) / CELL_SIZE);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = hashCell(gx + ox, gz + oz);
        if (visitedCells.has(key)) continue;
        visitedCells.add(key);
        const bucket = cells.get(key);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const id = bucket[i];
          if (!seen.has(id)) {
            seen.add(id);
            out.push(colliders[id]);
          }
        }
      }
    }
  }
  return out;
}

function pushOutCircle(
  px: number,
  pz: number,
  radius: number,
  c: CircleCollider,
): [number, number] | null {
  const dx = px - c.cx;
  const dz = pz - c.cz;
  const minDist = radius + c.r;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return null;

  const dist = Math.sqrt(distSq);
  if (dist > 1e-6) {
    const push = minDist - dist;
    return [px + (dx / dist) * push, pz + (dz / dist) * push];
  }
  return [px + minDist, pz];
}

function pushOutBox(
  px: number,
  pz: number,
  radius: number,
  b: BoxCollider,
): [number, number] | null {
  // Inverse rotation from world (Three.js +Y rot) to local box frame:
  // lx = dx * cosY - dz * sinY
  // lz = dx * sinY + dz * cosY
  const dx = px - b.cx;
  const dz = pz - b.cz;
  const lx = dx * b.cosY - dz * b.sinY;
  const lz = dx * b.sinY + dz * b.cosY;

  const closestX = clamp(lx, -b.halfW, b.halfW);
  const closestZ = clamp(lz, -b.halfD, b.halfD);
  const diffX = lx - closestX;
  const diffZ = lz - closestZ;
  const distSq = diffX * diffX + diffZ * diffZ;

  if (distSq >= radius * radius) return null;

  let pushLX = 0;
  let pushLZ = 0;
  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pushLX = (diffX / dist) * push;
    pushLZ = (diffZ / dist) * push;
  } else {
    // Center is inside the box: eject along shallowest axis
    const penX = b.halfW - Math.abs(lx) + radius;
    const penZ = b.halfD - Math.abs(lz) + radius;
    if (penX < penZ) {
      pushLX = lx >= 0 ? penX : -penX;
    } else {
      pushLZ = lz >= 0 ? penZ : -penZ;
    }
  }

  // Forward rotate local push delta back to world XZ
  const worldPushX = pushLX * b.cosY + pushLZ * b.sinY;
  const worldPushZ = -pushLX * b.sinY + pushLZ * b.cosY;
  return [px + worldPushX, pz + worldPushZ];
}

/**
 * Resolves 2D circle-vs-world obstacle overlaps iteratively so the Mech smoothly
 * slides along walls, bunkers, hangars, cliffs, tree trunks, and bridge cover.
 */
export function resolveWorldObstacles(
  x: number,
  z: number,
  y: number,
  radius = MECH_COLLISION_RADIUS,
): { x: number; z: number; collided: boolean; hitTag: ColliderTag | null } {
  const { colliders, cells } = getSpatialGrid();
  let curX = x;
  let curZ = z;
  let collided = false;
  let hitTag: ColliderTag | null = null;

  const gx = Math.floor(curX / CELL_SIZE);
  const gz = Math.floor(curZ / CELL_SIZE);

  // Gather candidate indices from 3x3 cells (bounded, zero allocations on fast path)
  const seen = new Set<number>();
  const candidates: number[] = [];
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const bucket = cells.get(hashCell(gx + ox, gz + oz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const id = bucket[i];
        if (!seen.has(id)) {
          seen.add(id);
          candidates.push(id);
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { x: curX, z: curZ, collided: false, hitTag: null };
  }

  for (let iter = 0; iter < 3; iter++) {
    let anyPush = false;
    for (let i = 0; i < candidates.length; i++) {
      const c = colliders[candidates[i]];
      if (c.minY !== undefined && y < c.minY) continue;
      if (c.maxY !== undefined && y > c.maxY) continue;

      const pushed =
        c.kind === 'circle'
          ? pushOutCircle(curX, curZ, radius, c)
          : pushOutBox(curX, curZ, radius, c);
      if (pushed) {
        curX = pushed[0];
        curZ = pushed[1];
        collided = true;
        hitTag = c.tag;
        anyPush = true;
      }
    }
    if (!anyPush) break;
  }

  return { x: curX, z: curZ, collided, hitTag };
}
