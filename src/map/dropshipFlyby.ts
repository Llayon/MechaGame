import * as THREE from 'three';
import type { LightingPreset } from './sectors';

/**
 * Calibrated for Sector 7 scale (1 unit = 3.75 m):
 * Altitude ~66 units (~248 m) clears the Citadel (18.5 u) and wind turbines (~48 u)
 * while remaining clearly visible in both Overview and Drive Mode sightlines.
 */
export const DROPSHIP_ALTITUDE = 66;
export const DROPSHIP_SPEED = 46;
export const DROPSHIP_MIN_COOLDOWN = 30;
export const DROPSHIP_MAX_COOLDOWN = 42;
export const DROPSHIP_BOUNDS_HALF_DIST = 340;

export interface DropshipFlybyState {
  active: boolean;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  yaw: number;
  speed: number;
  altitude: number;
  timer: number;
  passCount: number;
  rumblePlayedForPass: boolean;
}

export interface DropshipStepResult {
  started: boolean;
  completed: boolean;
  overheadDistSq: number;
}

export interface FlybyShadowProjection {
  shadowX: number;
  shadowZ: number;
  strength: number;
}

const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);

function appendColoredBox(
  positions: number[],
  normals: number[],
  colors: number[],
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  hexColor: string,
): void {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();
  nonIndexed.applyMatrix4(matrix);
  nonIndexed.computeVertexNormals();

  const pos = nonIndexed.getAttribute('position');
  const norm = nonIndexed.getAttribute('normal');
  const col = new THREE.Color(hexColor);

  for (let i = 0; i < pos.count; i++) {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    colors.push(col.r, col.g, col.b);
  }
  nonIndexed.dispose();
}

function addPart(
  positions: number[],
  normals: number[],
  colors: number[],
  geom: THREE.BufferGeometry,
  pos: readonly [number, number, number],
  rot: readonly [number, number, number],
  hexColor: string,
): void {
  _euler.set(rot[0], rot[1], rot[2], 'YXZ');
  _quat.setFromEuler(_euler);
  _pos.set(pos[0], pos[1], pos[2]);
  _mat.compose(_pos, _quat, _scale);
  appendColoredBox(positions, normals, colors, geom, _mat, hexColor);
  geom.dispose();
}

/**
 * Builds a single merged low-poly heavy dropship hull (~92 triangles, 1 Draw Call)
 * facing +Z locally (~26 units long, ~24 units wingspan).
 */
export function createDropshipHullGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  // Main armored fuselage spine
  addPart(
    positions,
    normals,
    colors,
    new THREE.BoxGeometry(4.2, 2.8, 17.5),
    [0, 0, -0.5],
    [0, 0, 0],
    '#29313B',
  );
  // Sloped nose cockpit prow (+Z forward)
  addPart(
    positions,
    normals,
    colors,
    new THREE.ConeGeometry(2.85, 7.6, 4),
    [0, -0.2, 11.8],
    [Math.PI * 0.5, 0, Math.PI * 0.25],
    '#343E4A',
  );
  // Dorsal armored sensor spine & upper bridge hump
  addPart(
    positions,
    normals,
    colors,
    new THREE.BoxGeometry(2.2, 1.35, 11.0),
    [0, 1.75, -1.8],
    [-0.06, 0, 0],
    '#3B4654',
  );
  // Swept gull-wings (left & right)
  for (const side of [-1, 1] as const) {
    addPart(
      positions,
      normals,
      colors,
      new THREE.BoxGeometry(9.6, 0.72, 6.2),
      [side * 6.5, 0.2, -1.4],
      [0.05, side * -0.24, side * -0.07],
      '#242B34',
    );
    // Wingtip armored VTOL thruster nacelle pods
    addPart(
      positions,
      normals,
      colors,
      new THREE.CylinderGeometry(1.15, 1.35, 7.4, 6),
      [side * 10.4, -0.25, -2.6],
      [Math.PI * 0.5, 0, 0],
      '#313A46',
    );
    // Angled V-tail vertical stabilizers
    addPart(
      positions,
      normals,
      colors,
      new THREE.BoxGeometry(0.55, 3.8, 3.6),
      [side * 2.8, 2.0, -8.8],
      [-0.28, 0, side * 0.34],
      '#394452',
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Builds twin glowing plasma thruster cones + nozzle cores behind the dropship nacelles
 * into a single BufferGeometry (1 Draw Call, AdditiveBlending).
 */
export function createDropshipThrusterGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (const side of [-1, 1] as const) {
    // Bright thruster exhaust disc/cone trailing -Z
    addPart(
      positions,
      normals,
      colors,
      new THREE.ConeGeometry(1.2, 6.2, 6),
      [side * 10.4, -0.25, -9.4],
      [-Math.PI * 0.5, 0, 0],
      '#5CE1FF',
    );
    // Inner rear fuselage auxiliary boost nozzle
    addPart(
      positions,
      normals,
      colors,
      new THREE.ConeGeometry(0.95, 4.4, 6),
      [side * 1.4, -0.1, -11.4],
      [-Math.PI * 0.5, 0, 0],
      '#7AE8FF',
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Creates initial dropship state already mid-flight along a scenic diagonal corridor
 * over the Central Island / River Channel so both live play and static software-GL
 * captures immediately witness the ship overhead and its shadow sweeping the arena.
 */
export function createDropshipFlybyState(): DropshipFlybyState {
  const dx = 0.82;
  const dz = -0.57236; // normalized SW -> NE vector across Island toward Citadel
  const len = Math.hypot(dx, dz);
  const dirX = dx / len;
  const dirZ = dz / len;
  return {
    active: true,
    x: 18,
    y: DROPSHIP_ALTITUDE,
    z: -34,
    dirX,
    dirZ,
    yaw: Math.atan2(dirX, dirZ),
    speed: DROPSHIP_SPEED,
    altitude: DROPSHIP_ALTITUDE,
    timer: 0,
    passCount: 1,
    rumblePlayedForPass: false,
  };
}

export function triggerDropshipFlyby(
  state: DropshipFlybyState,
  rng: () => number = Math.random,
): void {
  // Choose dramatic cross-valley heading biased slightly across camera view axes
  const angle = (rng() * Math.PI * 2);
  const dirX = Math.cos(angle);
  const dirZ = Math.sin(angle);
  const lateralOffset = (rng() - 0.5) * 95;
  const perpX = -dirZ;
  const perpZ = dirX;

  state.active = true;
  state.dirX = dirX;
  state.dirZ = dirZ;
  state.yaw = Math.atan2(dirX, dirZ);
  state.altitude = DROPSHIP_ALTITUDE + (rng() - 0.5) * 8;
  state.speed = DROPSHIP_SPEED + (rng() - 0.5) * 8;
  state.x = -dirX * DROPSHIP_BOUNDS_HALF_DIST + perpX * lateralOffset;
  state.y = state.altitude;
  state.z = -dirZ * DROPSHIP_BOUNDS_HALF_DIST + perpZ * lateralOffset;
  state.passCount += 1;
  state.rumblePlayedForPass = false;
}

export function stepDropshipFlyby(
  state: DropshipFlybyState,
  dt: number,
  rng: () => number = Math.random,
  focusX = 0,
  focusZ = 0,
): DropshipStepResult {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  let started = false;
  let completed = false;

  if (!state.active) {
    state.timer -= clampedDt;
    if (state.timer <= 0) {
      triggerDropshipFlyby(state, rng);
      started = true;
    }
    return { started, completed, overheadDistSq: Infinity };
  }

  state.x += state.dirX * state.speed * clampedDt;
  state.z += state.dirZ * state.speed * clampedDt;

  const overheadDistSq =
    (state.x - focusX) * (state.x - focusX) +
    (state.z - focusZ) * (state.z - focusZ);

  const distSqFromOrigin = state.x * state.x + state.z * state.z;
  const exitThreshold = DROPSHIP_BOUNDS_HALF_DIST + 45;
  if (distSqFromOrigin > exitThreshold * exitThreshold) {
    state.active = false;
    state.timer =
      DROPSHIP_MIN_COOLDOWN +
      rng() * (DROPSHIP_MAX_COOLDOWN - DROPSHIP_MIN_COOLDOWN);
    completed = true;
  }

  return { started, completed, overheadDistSq };
}

/**
 * Projects the dropship's shadow onto the valley floor along the active solar direction
 * so it aligns with real building/tree shadows (and disables shadow darkening at night).
 */
export function computeFlybyShadowProjection(
  shipX: number,
  shipY: number,
  shipZ: number,
  sunPos: readonly [number, number, number],
  lightingPreset: LightingPreset,
): FlybyShadowProjection {
  if (lightingPreset === 'night') {
    return { shadowX: shipX, shadowZ: shipZ, strength: 0 };
  }

  const sLen = Math.hypot(sunPos[0], sunPos[1], sunPos[2]) || 1;
  const sx = sunPos[0] / sLen;
  const sy = Math.max(0.32, sunPos[1] / sLen);
  const sz = sunPos[2] / sLen;

  const referenceGroundY = 6.0;
  const dropH = Math.max(0, shipY - referenceGroundY);
  const horizOffset = Math.min(72, (dropH * 0.55) / sy);

  return {
    shadowX: shipX - sx * horizOffset,
    shadowZ: shipZ - sz * horizOffset,
    strength: lightingPreset === 'dusk' ? 0.5 : 0.44,
  };
}
