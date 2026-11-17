import * as THREE from 'three';
import {
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  clamp,
  distToSegment,
  getTerrainHeight,
  lerp,
} from './terrainMath';
import type { BoxCollider, CircleCollider } from './worldColliders';

export type TitanWreckId = 'titan-frigate-spine' | 'titan-siege-walker';

export interface TitanDeckRamp {
  id: string;
  start: readonly [number, number];
  end: readonly [number, number];
  startY: number;
  endY: number;
  halfWidth: number;
}

export interface TitanBreachTreeSpec {
  wreckId: TitanWreckId;
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

export interface TitanWreckInfo {
  id: TitanWreckId;
  name: string;
  origin: readonly [number, number];
  rotY: number;
  exclusionRadius: number;
}

const ISLAND_DECK_SURFACE_Y =
  getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z) + 0.7;

const FRIGATE_SOUTH_START: readonly [number, number] = [-12.0, 80.0];
const FRIGATE_ISLAND_END: readonly [number, number] = [-8.0, 28.5];
const FRIGATE_SOUTH_Y = getTerrainHeight(
  FRIGATE_SOUTH_START[0],
  FRIGATE_SOUTH_START[1],
);

const WALKER_ORIGIN: readonly [number, number] = [178.0, 19.5];
const WALKER_YAW = -1.72;
const WALKER_RAMP_START: readonly [number, number] = [162.0, 16.8];
const WALKER_RAMP_MID: readonly [number, number] = [175.0, 18.8];
const WALKER_DECK_END: readonly [number, number] = [180.5, 19.8];
const WALKER_START_Y = getTerrainHeight(
  WALKER_RAMP_START[0],
  WALKER_RAMP_START[1],
);
const WALKER_SHOULDER_Y = 13.6;
const WALKER_CARAPACE_Y = 14.05;

export const TITAN_WRECKS: ReadonlyArray<TitanWreckInfo> = [
  {
    id: 'titan-frigate-spine',
    name: 'Обломок фрегата «Икар-7»',
    origin: [-10.0, 54.25],
    rotY: Math.atan2(
      FRIGATE_ISLAND_END[0] - FRIGATE_SOUTH_START[0],
      FRIGATE_ISLAND_END[1] - FRIGATE_SOUTH_START[1],
    ),
    exclusionRadius: 16.0,
  },
  {
    id: 'titan-siege-walker',
    name: 'Остов титана «Колосс-IV»',
    origin: WALKER_ORIGIN,
    rotY: WALKER_YAW,
    exclusionRadius: 20.0,
  },
];

export const TITAN_WALKABLE_DECKS: ReadonlyArray<TitanDeckRamp> = [
  // 1. Walkable armored dorsal spine of the downed frigate spanning South Bank -> Central Island
  {
    id: 'frigate-spine-bridge',
    start: FRIGATE_SOUTH_START,
    end: FRIGATE_ISLAND_END,
    startY: FRIGATE_SOUTH_Y,
    endY: ISLAND_DECK_SURFACE_Y,
    halfWidth: 2.85,
  },
  // 2a. Colossal Siege Walker lower leg-ramp climbing from East Quarry terrace up to shoulder
  {
    id: 'walker-leg-ramp',
    start: WALKER_RAMP_START,
    end: WALKER_RAMP_MID,
    startY: WALKER_START_Y,
    endY: WALKER_SHOULDER_Y,
    halfWidth: 2.35,
  },
  // 2b. Siege Walker upper chest/shoulder firing platform overlooking the East Quarry
  {
    id: 'walker-shoulder-deck',
    start: WALKER_RAMP_MID,
    end: WALKER_DECK_END,
    startY: WALKER_SHOULDER_Y,
    endY: WALKER_CARAPACE_Y,
    halfWidth: 3.1,
  },
];

/**
 * Returns the walkable armored surface Y on any Titan wreck ramp or shoulder platform,
 * or null if (x, z) is outside Titan deck footprints.
 */
export function getTitanWreckDeckYAt(x: number, z: number): number | null {
  let bestY: number | null = null;
  for (let i = 0; i < TITAN_WALKABLE_DECKS.length; i++) {
    const deck = TITAN_WALKABLE_DECKS[i];
    const dx = deck.end[0] - deck.start[0];
    const dz = deck.end[1] - deck.start[1];
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-6) continue;
    const t = ((x - deck.start[0]) * dx + (z - deck.start[1]) * dz) / lenSq;
    if (t < -0.04 || t > 1.04) continue;
    const px = deck.start[0] + dx * t;
    const pz = deck.start[1] + dz * t;
    if (Math.hypot(x - px, z - pz) > deck.halfWidth) continue;
    const surfaceY = lerp(deck.startY, deck.endY, clamp(t, 0, 1));
    if (bestY === null || surfaceY > bestY) {
      bestY = surfaceY;
    }
  }
  return bestY;
}

/**
 * Exclusion mask used by random forest/boulder generation so wild trees and boulders
 * do not spawn across walkable Titan decks or inside solid buried reactor hulls.
 */
export function isInsideTitanWreckFootprint(
  x: number,
  z: number,
  margin = 0,
): boolean {
  for (let i = 0; i < TITAN_WALKABLE_DECKS.length; i++) {
    const d = TITAN_WALKABLE_DECKS[i];
    if (
      distToSegment(x, z, d.start[0], d.start[1], d.end[0], d.end[1]) <
      d.halfWidth + 2.8 + margin
    ) {
      return true;
    }
  }
  // Frigate port wing-root breach zone on South Bank
  if (Math.hypot(x - -18.5, z - 73.0) < 11.5 + margin) return true;
  // Siege Walker main embedded torso/reactor crater on East Quarry hillside
  if (Math.hypot(x - WALKER_ORIGIN[0], z - WALKER_ORIGIN[1]) < 17.5 + margin) {
    return true;
  }
  return false;
}

function localToWorldXZ(
  originX: number,
  originZ: number,
  rotY: number,
  lx: number,
  lz: number,
): [number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [originX + lx * c + lz * s, originZ - lx * s + lz * c];
}

function makeTitanBox(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  rotY: number,
  minY: number,
  maxY: number,
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
    tag: 'titan-wreck',
  };
}

function makeTitanCircle(
  cx: number,
  cz: number,
  r: number,
  minY: number,
  maxY: number,
): CircleCollider {
  return {
    kind: 'circle',
    cx,
    cz,
    r,
    minY,
    maxY,
    tag: 'titan-wreck',
  };
}

let cachedColliders: ReadonlyArray<BoxCollider | CircleCollider> | null = null;

/**
 * Returns elevation-banded physical cover and obstacle colliders for both Titan wrecks:
 * - Walkable spine & leg-ramp lanes remain open
 * - Flank wing ribs, reactor shields, broken cannon housings, and splayed legs block movement & gunfire
 */
export function getTitanWreckColliders(): ReadonlyArray<
  BoxCollider | CircleCollider
> {
  if (cachedColliders) return cachedColliders;

  const list: Array<BoxCollider | CircleCollider> = [];

  // --- 1. Frigate Spine Bridge side armored bulwarks & bank wing stubs ---
  const fdx = FRIGATE_ISLAND_END[0] - FRIGATE_SOUTH_START[0];
  const fdz = FRIGATE_ISLAND_END[1] - FRIGATE_SOUTH_START[1];
  const fLen = Math.hypot(fdx, fdz);
  const fYaw = Math.atan2(fdx, fdz);
  const fMidX = (FRIGATE_SOUTH_START[0] + FRIGATE_ISLAND_END[0]) * 0.5;
  const fMidZ = (FRIGATE_SOUTH_START[1] + FRIGATE_ISLAND_END[1]) * 0.5;

  // Side dorsal armor ribs along mid-span act as ballistic cover and edge guardrails
  for (const seg of [
    { t0: 0.16, t1: 0.42, side: -1, h: 2.3 },
    { t0: 0.52, t1: 0.80, side: -1, h: 2.55 },
    { t0: 0.22, t1: 0.50, side: 1, h: 2.4 },
    { t0: 0.62, t1: 0.86, side: 1, h: 2.15 },
  ]) {
    const tm = (seg.t0 + seg.t1) * 0.5;
    const deckY = lerp(FRIGATE_SOUTH_Y, ISLAND_DECK_SURFACE_Y, tm);
    const segLen = (seg.t1 - seg.t0) * fLen;
    const localZ = (tm - 0.5) * fLen;
    const [bx, bz] = localToWorldXZ(
      fMidX,
      fMidZ,
      fYaw,
      seg.side * 3.55,
      localZ,
    );
    list.push(
      makeTitanBox(bx, bz, 1.35, segLen, fYaw, deckY - 1.4, deckY + seg.h),
    );
  }

  // Port breached wing root & nacelle armor flanking the South Bank approach (leaves entry open)
  list.push(makeTitanBox(-19.2, 73.0, 8.2, 9.2, -0.36, 0.5, 8.2));
  list.push(makeTitanCircle(-23.0, 67.5, 3.2, 0.0, 8.6));
  // Starboard sheared thruster housing on South Bank edge
  list.push(makeTitanBox(-5.0, 73.5, 3.6, 6.2, 0.22, 0.5, 7.2));

  // --- 2. Siege Walker Colossus-IV embedded torso, reactor shields, & flank leg ---
  const [wOriginX, wOriginZ] = WALKER_ORIGIN;

  // Rear reactor hump & armored carapace spine (deeply embedded into mountain crest)
  const [rx, rz] = localToWorldXZ(wOriginX, wOriginZ, WALKER_YAW, -0.4, -6.0);
  list.push(makeTitanBox(rx, rz, 10.8, 7.4, WALKER_YAW, 8.0, 19.6));

  // South towering shoulder cannon mount / blast shield (cover on right flank of shoulder deck)
  const [sx, sz] = localToWorldXZ(wOriginX, wOriginZ, WALKER_YAW, 5.4, -1.2);
  list.push(makeTitanBox(sx, sz, 4.4, 7.4, WALKER_YAW + 0.14, 8.0, 18.8));

  // North broken collar cowl at the left edge of the shoulder deck
  const [nx, nz] = localToWorldXZ(wOriginX, wOriginZ, WALKER_YAW, -5.2, -0.5);
  list.push(makeTitanBox(nx, nz, 3.6, 6.6, WALKER_YAW - 0.12, 8.0, 16.4));

  // Splayed broken North leg sprawling down toward (167.5, 6.5)
  list.push(makeTitanBox(171.0, 9.2, 3.4, 9.0, -0.78, 7.5, 14.0));
  list.push(makeTitanCircle(167.0, 5.2, 2.4, 7.5, 12.6));

  // Knee actuator drum beside south edge of walkable leg ramp
  list.push(makeTitanCircle(168.8, 22.0, 2.3, 7.5, 13.6));

  cachedColliders = list;
  return cachedColliders;
}

/**
 * Curated weathered pine trees growing directly out of soil-filled hull breaches
 * inside both ancient Titan wrecks.
 */
export const TITAN_BREACH_TREES: ReadonlyArray<TitanBreachTreeSpec> = [
  // Frigate port wing-root breach crater (South Bank shoulder around [-18.5, 73])
  {
    wreckId: 'titan-frigate-spine',
    x: -18.8,
    y: 5.7,
    z: 73.5,
    heightScale: 2.4,
    widthScale: 2.05,
    rotY: 0.4,
    tiltX: 0.08,
    tiltZ: -0.11,
    tint: 0.22,
  },
  {
    wreckId: 'titan-frigate-spine',
    x: -21.0,
    y: 5.25,
    z: 71.5,
    heightScale: 1.9,
    widthScale: 1.72,
    rotY: 1.9,
    tiltX: -0.06,
    tiltZ: -0.14,
    tint: 0.65,
  },
  {
    wreckId: 'titan-frigate-spine',
    x: -17.2,
    y: 5.4,
    z: 70.8,
    heightScale: 1.6,
    widthScale: 1.5,
    rotY: 3.1,
    tiltX: 0.1,
    tiltZ: 0.05,
    tint: 0.45,
  },
  {
    wreckId: 'titan-frigate-spine',
    x: -21.8,
    y: 4.95,
    z: 75.2,
    heightScale: 2.0,
    widthScale: 1.82,
    rotY: 4.8,
    tiltX: -0.09,
    tiltZ: -0.08,
    tint: 0.82,
  },
  // Siege Walker breached upper reactor cavity (East Quarry slope around [181, 21.5])
  {
    wreckId: 'titan-siege-walker',
    x: 180.6,
    y: 16.6,
    z: 22.0,
    heightScale: 2.5,
    widthScale: 2.15,
    rotY: 0.9,
    tiltX: -0.07,
    tiltZ: 0.11,
    tint: 0.35,
  },
  {
    wreckId: 'titan-siege-walker',
    x: 183.0,
    y: 17.0,
    z: 20.4,
    heightScale: 2.1,
    widthScale: 1.88,
    rotY: 2.7,
    tiltX: 0.09,
    tiltZ: 0.06,
    tint: 0.72,
  },
  {
    wreckId: 'titan-siege-walker',
    x: 179.8,
    y: 16.0,
    z: 24.2,
    heightScale: 1.72,
    widthScale: 1.58,
    rotY: 4.2,
    tiltX: -0.11,
    tiltZ: -0.05,
    tint: 0.14,
  },
  {
    wreckId: 'titan-siege-walker',
    x: 170.8,
    y: 11.6,
    z: 8.8,
    heightScale: 1.78,
    widthScale: 1.64,
    rotY: 5.1,
    tiltX: 0.07,
    tiltZ: -0.1,
    tint: 0.56,
  },
];

interface PartBuilder {
  positions: number[];
  normals: number[];
  colors: number[];
  burials: number[];
  deckWear: number[];
}

const _tmpMat = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _tmpPos = new THREE.Vector3();
const _tmpScale = new THREE.Vector3(1, 1, 1);
const _tmpVert = new THREE.Vector3();
const _tmpCol = new THREE.Color();

function appendHullPart(
  builder: PartBuilder,
  rawGeom: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  hexColor: string,
  deckWearWeight = 0.0,
): void {
  const nonIndexed = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom.clone();
  nonIndexed.applyMatrix4(worldMatrix);
  nonIndexed.computeVertexNormals();

  const pos = nonIndexed.getAttribute('position');
  const norm = nonIndexed.getAttribute('normal');
  _tmpCol.set(hexColor);

  for (let i = 0; i < pos.count; i++) {
    _tmpVert.fromBufferAttribute(pos, i);
    const groundY = getTerrainHeight(_tmpVert.x, _tmpVert.z);
    const burialHeight = _tmpVert.y - groundY;

    builder.positions.push(_tmpVert.x, _tmpVert.y, _tmpVert.z);
    builder.normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    builder.colors.push(_tmpCol.r, _tmpCol.g, _tmpCol.b);
    builder.burials.push(burialHeight);
    builder.deckWear.push(deckWearWeight);
  }

  nonIndexed.dispose();
}

function addLocalPart(
  builder: PartBuilder,
  parentMatrix: THREE.Matrix4,
  geom: THREE.BufferGeometry,
  pos: readonly [number, number, number],
  rot: readonly [number, number, number],
  hexColor: string,
  deckWearWeight = 0.0,
  scale: readonly [number, number, number] = [1, 1, 1],
): void {
  _tmpEuler.set(rot[0], rot[1], rot[2]);
  _tmpQuat.setFromEuler(_tmpEuler);
  _tmpPos.set(pos[0], pos[1], pos[2]);
  _tmpScale.set(scale[0], scale[1], scale[2]);
  _tmpMat.compose(_tmpPos, _tmpQuat, _tmpScale);
  _tmpMat.premultiply(parentMatrix);
  appendHullPart(builder, geom, _tmpMat, hexColor, deckWearWeight);
  _tmpScale.set(1, 1, 1);
  geom.dispose();
}

function addWorldOrientedBox(
  builder: PartBuilder,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  width: number,
  thickness: number,
  roll: number,
  yOffset: number,
  hexColor: string,
  deckWearWeight = 0.0,
): void {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const horizLen = Math.hypot(dx, dz);
  const fullLen = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, Math.max(1e-5, horizLen));

  const mx = (start[0] + end[0]) * 0.5;
  const my = (start[1] + end[1]) * 0.5 + yOffset;
  const mz = (start[2] + end[2]) * 0.5;

  const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3(mx, my, mz),
    quat,
    new THREE.Vector3(1, 1, 1),
  );
  const box = new THREE.BoxGeometry(width, thickness, fullLen);
  appendHullPart(builder, box, mat, hexColor, deckWearWeight);
  box.dispose();
}

/**
 * Builds both colossal half-buried Titan wrecks into a single merged BufferGeometry
 * (1 Draw Call total) with custom vertex attributes (`aBurial` and `aDeckWear`) for
 * seamless terrain-skirt grounding, worldNormal.y earth/grass layering, and clear walkable treads.
 */
export function createTitanWrecksGeometry(): THREE.BufferGeometry {
  const builder: PartBuilder = {
    positions: [],
    normals: [],
    colors: [],
    burials: [],
    deckWear: [],
  };

  // =========================================================================
  // 1. DOWNED ORBITAL FRIGATE "IKAR-7" — Faceted Spine Bridge & Wing Crater
  // =========================================================================
  const fStart3: readonly [number, number, number] = [
    FRIGATE_SOUTH_START[0],
    FRIGATE_SOUTH_Y,
    FRIGATE_SOUTH_START[1],
  ];
  const fEnd3: readonly [number, number, number] = [
    FRIGATE_ISLAND_END[0],
    ISLAND_DECK_SURFACE_Y,
    FRIGATE_ISLAND_END[1],
  ];
  const fdx = fEnd3[0] - fStart3[0];
  const fdz = fEnd3[2] - fStart3[2];
  const fLen = Math.hypot(fdx, fdz);
  const fYaw = Math.atan2(fdx, fdz);
  const fPitch = -Math.atan2(fEnd3[1] - fStart3[1], fLen);

  // Main walkable armored dorsal spine deck + inner tread ribs
  addWorldOrientedBox(builder, fStart3, fEnd3, 5.5, 1.25, 0.0, -0.62, '#4A5056', 0.92);
  addWorldOrientedBox(builder, fStart3, fEnd3, 3.0, 0.24, 0.0, -0.09, '#5F6469', 1.0);

  const spineCenterMat = new THREE.Matrix4().compose(
    new THREE.Vector3(
      (fStart3[0] + fEnd3[0]) * 0.5,
      (fStart3[1] + fEnd3[1]) * 0.5,
      (fStart3[2] + fEnd3[2]) * 0.5,
    ),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(fPitch, fYaw, 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );

  // Tapered faceted hexagonal under-hull keel (reads as beveled warship hull rather than plain box)
  const spanHalf = fLen * 0.5;
  addLocalPart(
    builder,
    spineCenterMat,
    new THREE.CylinderGeometry(2.7, 3.8, fLen * 0.96, 6),
    [0, -2.55, 0],
    [Math.PI / 2, Math.PI / 6, 0],
    '#3E3732',
    0.0,
    [1.35, 1.0, 0.85],
  );

  // Angled beveled chevron wing-ribs along bridge flanks (canted outward like shattered hull ribs)
  const ribSpecs: ReadonlyArray<{
    zOff: number;
    side: -1 | 1;
    len: number;
    h: number;
    cant: number;
    yawSkew: number;
    color: string;
  }> = [
    { zOff: -spanHalf * 0.42, side: -1, len: 12.2, h: 2.3, cant: 0.34, yawSkew: -0.08, color: '#58483D' },
    { zOff: spanHalf * 0.34, side: -1, len: 13.0, h: 2.55, cant: 0.28, yawSkew: 0.06, color: '#4E545A' },
    { zOff: -spanHalf * 0.24, side: 1, len: 13.2, h: 2.4, cant: -0.32, yawSkew: 0.07, color: '#51575D' },
    { zOff: spanHalf * 0.48, side: 1, len: 10.8, h: 2.1, cant: -0.28, yawSkew: -0.06, color: '#5E493C' },
  ];
  for (const rib of ribSpecs) {
    addLocalPart(
      builder,
      spineCenterMat,
      new THREE.CylinderGeometry(0.45, 1.05, rib.len, 4),
      [rib.side * 3.55, rib.h * 0.36 - 0.35, rib.zOff],
      [Math.PI / 2 - 0.06, rib.yawSkew, rib.cant],
      rib.color,
      0.08,
      [1.15, 1.0, rib.h * 0.95],
    );
  }

  // Transverse arched hull bulkheads underneath the keel
  for (const zFrac of [-0.46, -0.14, 0.18, 0.46]) {
    addLocalPart(
      builder,
      spineCenterMat,
      new THREE.CylinderGeometry(3.2, 4.4, 2.4, 6),
      [0, -3.25, zFrac * spanHalf],
      [Math.PI / 2, Math.PI / 6, 0.06],
      '#39332F',
      0.0,
      [1.45, 1.0, 0.72],
    );
  }

  // South Bank buried swept delta-wing & breached thruster crater (hosts 4 pines)
  const wingRootMat = new THREE.Matrix4().compose(
    new THREE.Vector3(-18.8, 3.4, 73.2),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, -0.38, -0.22)),
    new THREE.Vector3(1, 1, 1),
  );
  // Swept beveled wing hull plunging deep into bank soil
  addLocalPart(
    builder,
    wingRootMat,
    new THREE.CylinderGeometry(5.6, 8.6, 5.4, 6),
    [-1.2, -0.6, 0],
    [0, 0.25, 0],
    '#4A4E53',
    0.0,
    [1.3, 1.0, 1.15],
  );
  // Jagged upturned port wingtip blade
  addLocalPart(
    builder,
    wingRootMat,
    new THREE.ConeGeometry(4.2, 12.5, 4),
    [-6.6, 3.2, -1.6],
    [-0.18, 0.22, 1.12],
    '#5C483D',
    0.0,
    [0.55, 1.0, 1.1],
  );
  // Shattered cylindrical thruster turbine cowling half-buried at wing edge
  addLocalPart(
    builder,
    wingRootMat,
    new THREE.CylinderGeometry(2.5, 3.1, 11.4, 8),
    [-3.4, 2.2, -5.8],
    [Math.PI / 2 - 0.18, 0.1, 0.14],
    '#454A50',
    0.0,
  );
  // Breach earth mound inside the torn wing hull (where the 4 pines take root)
  addLocalPart(
    builder,
    wingRootMat,
    new THREE.CylinderGeometry(3.8, 5.2, 2.5, 7),
    [0.2, 1.4, 0.2],
    [0, 0.3, 0],
    '#3B3A32',
    0.0,
  );

  // Starboard sheared engine pod on South Bank edge
  addLocalPart(
    builder,
    spineCenterMat,
    new THREE.CylinderGeometry(1.85, 2.35, 9.6, 8),
    [5.4, 0.3, -spanHalf * 0.72],
    [Math.PI / 2 - 0.14, -0.22, -0.18],
    '#524139',
    0.0,
  );

  // Asymmetrical Island-side sheared prow: jagged port wing-spar + low buried starboard wedge
  addLocalPart(
    builder,
    spineCenterMat,
    new THREE.ConeGeometry(2.8, 9.5, 4),
    [-4.6, 0.6, spanHalf * 0.92],
    [-0.36, 0.28, 0.34],
    '#57483F',
    0.0,
    [0.65, 1.0, 1.1],
  );
  addLocalPart(
    builder,
    spineCenterMat,
    new THREE.CylinderGeometry(1.5, 2.1, 5.2, 6),
    [3.9, -1.35, spanHalf * 0.96],
    [Math.PI / 2 - 0.22, -0.24, -0.2],
    '#4A4E53',
    0.0,
  );

  // =========================================================================
  // 2. BURIED SIEGE WALKER "COLOSSUS-IV" — East Quarry Slope & Leg-Ramp
  // =========================================================================
  const wRampStart3: readonly [number, number, number] = [
    WALKER_RAMP_START[0],
    WALKER_START_Y,
    WALKER_RAMP_START[1],
  ];
  const wRampMid3: readonly [number, number, number] = [
    WALKER_RAMP_MID[0],
    WALKER_SHOULDER_Y,
    WALKER_RAMP_MID[1],
  ];
  const wDeckEnd3: readonly [number, number, number] = [
    WALKER_DECK_END[0],
    WALKER_CARAPACE_Y,
    WALKER_DECK_END[1],
  ];

  // Lower splayed giant leg armor plate (walkable ramp!) + hydraulic under-strut
  addWorldOrientedBox(builder, wRampStart3, wRampMid3, 4.5, 1.4, 0.0, -0.7, '#54585D', 0.94);
  addWorldOrientedBox(builder, wRampStart3, wRampMid3, 2.5, 0.26, 0.0, -0.09, '#686D72', 1.0);
  addWorldOrientedBox(builder, wRampStart3, wRampMid3, 3.1, 3.3, 0.04, -2.45, '#423934', 0.0);

  // Upper shoulder/chest carapace firing deck
  addWorldOrientedBox(builder, wRampMid3, wDeckEnd3, 6.2, 1.85, 0.0, -0.92, '#4F545A', 0.9);
  addWorldOrientedBox(builder, wRampMid3, wDeckEnd3, 3.6, 0.25, 0.0, -0.08, '#62676C', 1.0);

  // Giant 3-toed buried ankle/foot anchor embedded into the Quarry shelf at WALKER_RAMP_START
  const footMat = new THREE.Matrix4().compose(
    new THREE.Vector3(WALKER_RAMP_START[0] - 0.8, WALKER_START_Y - 0.95, WALKER_RAMP_START[1] - 0.2),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, WALKER_YAW, 0.0)),
    new THREE.Vector3(1, 1, 1),
  );
  addLocalPart(
    builder,
    footMat,
    new THREE.CylinderGeometry(3.1, 4.2, 3.2, 6),
    [0, 0, 0],
    [0, Math.PI / 6, 0],
    '#4A4E54',
    0.18,
    [1.15, 1.0, 0.85],
  );
  for (const toeX of [-2.4, 0, 2.4]) {
    addLocalPart(
      builder,
      footMat,
      new THREE.BoxGeometry(1.4, 1.6, 3.4),
      [toeX, -0.5, 2.6],
      [0.24, toeX * 0.1, 0],
      '#3F4348',
      0.1,
    );
  }

  // Colossal buried Siege Walker torso, armored cockpit head, twin reactor drums, & breach crater
  const walkerMat = new THREE.Matrix4().compose(
    new THREE.Vector3(WALKER_ORIGIN[0], 11.6, WALKER_ORIGIN[1]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, WALKER_YAW, -0.22)),
    new THREE.Vector3(1, 1, 1),
  );

  // Faceted hexagonal lower torso & buried armored pelvis core
  addLocalPart(
    builder,
    walkerMat,
    new THREE.CylinderGeometry(6.4, 7.6, 9.6, 6),
    [0, -1.7, -1.4],
    [0, Math.PI / 6, 0],
    '#4C5055',
    0.0,
    [1.08, 1.0, 1.12],
  );
  // Towering sloped upper reactor carapace (skyline focal silhouette + cover)
  addLocalPart(
    builder,
    walkerMat,
    new THREE.CylinderGeometry(5.0, 6.6, 5.8, 6),
    [-0.3, 4.3, -4.8],
    [-0.22, Math.PI / 6, 0.08],
    '#5E493D',
    0.0,
    [1.15, 1.0, 0.92],
  );
  // Iconic armored Titan Head / Cockpit Dome with recessed dark visor & chin cannon
  addLocalPart(
    builder,
    walkerMat,
    new THREE.CylinderGeometry(2.3, 3.1, 3.6, 6),
    [-0.6, 3.5, 2.4],
    [Math.PI / 2 - 0.15, 0, 0.1],
    '#565B61',
    0.0,
    [1.25, 0.95, 0.85],
  );
  addLocalPart(
    builder,
    walkerMat,
    new THREE.BoxGeometry(3.4, 0.55, 1.1),
    [-0.6, 3.9, 3.9],
    [-0.1, 0, 0.1],
    '#1F2328',
    0.0,
  );

  // South towering shoulder cannon mount / blast shield (sheared autocannon barrel jutting skyward)
  addLocalPart(
    builder,
    walkerMat,
    new THREE.BoxGeometry(4.6, 5.4, 7.6),
    [5.4, 3.6, -1.4],
    [-0.14, 0.16, -0.18],
    '#52575D',
    0.0,
  );
  addLocalPart(
    builder,
    walkerMat,
    new THREE.CylinderGeometry(0.62, 0.9, 12.8, 7),
    [6.1, 6.3, 5.2],
    [Math.PI / 2 - 0.58, 0.12, -0.14],
    '#3C3A37',
    0.0,
  );
  // North broken shoulder cowl & ribcage collar flanking the firing platform
  addLocalPart(
    builder,
    walkerMat,
    new THREE.BoxGeometry(3.8, 3.9, 6.8),
    [-5.2, 2.2, -0.5],
    [0.12, -0.14, 0.22],
    '#56453C',
    0.0,
  );
  // Giant twin turbine reactor exhaust stacks on the rear carapace
  for (const side of [-1, 1]) {
    addLocalPart(
      builder,
      walkerMat,
      new THREE.CylinderGeometry(2.1, 2.5, 5.6, 8),
      [side * 3.1, 5.6, -7.8],
      [Math.PI / 2 - 0.42, 0, side * 0.12],
      '#413C38',
      0.0,
    );
  }
  // Shattered upper-hull earth bowl where the mountain pines take root
  addLocalPart(
    builder,
    walkerMat,
    new THREE.CylinderGeometry(3.6, 5.0, 2.6, 7),
    [1.8, 3.7, -3.4],
    [0, 0.4, 0],
    '#3E3C33',
    0.0,
  );

  // Splayed broken North leg sprawling down the slope toward (166.8, 5.4)
  const brokenLegStart: readonly [number, number, number] = [174.5, 12.0, 13.5];
  const brokenLegEnd: readonly [number, number, number] = [
    166.8,
    getTerrainHeight(166.8, 5.4) + 0.5,
    5.4,
  ];
  addWorldOrientedBox(
    builder,
    brokenLegStart,
    brokenLegEnd,
    3.2,
    2.9,
    0.34,
    0.4,
    '#4A4845',
    0.0,
  );
  const brokenFootMat = new THREE.Matrix4().compose(
    new THREE.Vector3(166.5, getTerrainHeight(166.5, 5.0) - 0.4, 5.0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, -0.82, 0.24)),
    new THREE.Vector3(1, 1, 1),
  );
  addLocalPart(
    builder,
    brokenFootMat,
    new THREE.CylinderGeometry(2.4, 3.2, 3.0, 6),
    [0, 0, 0],
    [0, Math.PI / 6, 0],
    '#56463D',
    0.0,
  );

  // Knee hydraulic actuator drum beside the ramp
  const kneeMat = new THREE.Matrix4().compose(
    new THREE.Vector3(168.8, 11.4, 21.8),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, -0.45, Math.PI / 2 - 0.22)),
    new THREE.Vector3(1, 1, 1),
  );
  addLocalPart(
    builder,
    kneeMat,
    new THREE.CylinderGeometry(2.1, 2.3, 4.8, 8),
    [0, 0, 0],
    [0, 0, 0],
    '#57483F',
    0.0,
  );

  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(builder.positions, 3),
  );
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(builder.normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
  geom.setAttribute(
    'aBurial',
    new THREE.Float32BufferAttribute(builder.burials, 1),
  );
  geom.setAttribute(
    'aDeckWear',
    new THREE.Float32BufferAttribute(builder.deckWear, 1),
  );
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}
