import * as THREE from 'three';
import {
  MAP_HALF_D,
  MAP_HALF_W,
  getExtendedTerrainHeight,
} from './terrainMath';

export interface DistantCruiserSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  tiltZ: number;
  scale: number;
}

export interface HorizonSmokePlumeSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  radiusTop: number;
  radiusBottom: number;
  height: number;
  phase: number;
  speed: number;
}

/**
 * Two distant Old-World dreadnought/carrier silhouettes hovering in the northern
 * sky corridor just above the mountain crests, clearly visible in both Overview and Drive Mode.
 */
export const DISTANT_WAR_CRUISERS: readonly DistantCruiserSpec[] = [
  {
    id: 'cruiser-nnw',
    x: -102,
    y: 112,
    z: -365,
    rotY: 0.44,
    tiltZ: -0.05,
    scale: 0.68,
  },
  {
    id: 'cruiser-nne',
    x: 118,
    y: 116,
    z: -355,
    rotY: -0.58,
    tiltZ: 0.04,
    scale: 0.74,
  },
];

const RAW_SMOKE_PLUMES: ReadonlyArray<{
  id: string;
  x: number;
  z: number;
  radiusTop: number;
  radiusBottom: number;
  height: number;
  phase: number;
  speed: number;
}> = [
  {
    id: 'smoke-nw-wreck',
    x: -175,
    z: -305,
    radiusTop: 24,
    radiusBottom: 8.5,
    height: 108,
    phase: 0.2,
    speed: 0.14,
  },
  {
    id: 'smoke-north-ridge',
    x: -42,
    z: -315,
    radiusTop: 22,
    radiusBottom: 7.5,
    height: 102,
    phase: 1.7,
    speed: 0.16,
  },
  {
    id: 'smoke-ne-spire',
    x: 108,
    z: -300,
    radiusTop: 25,
    radiusBottom: 9.0,
    height: 112,
    phase: 3.1,
    speed: 0.13,
  },
  {
    id: 'smoke-east-flank',
    x: 245,
    z: -245,
    radiusTop: 21,
    radiusBottom: 7.5,
    height: 96,
    phase: 4.5,
    speed: 0.15,
  },
];

export const HORIZON_SMOKE_PLUMES: readonly HorizonSmokePlumeSpec[] = RAW_SMOKE_PLUMES.map(
  (p) => ({
    ...p,
    y: Math.max(24, getExtendedTerrainHeight(p.x, p.z) - 8),
  }),
);

export const HORIZON_WAR_MAX_TRACERS = 72;
export const HORIZON_WAR_MAX_FLASHES = 36;

export interface HorizonTracerSlot {
  active: boolean;
  isOrbital: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scaleX: number;
  scaleY: number;
  life: number;
  maxLife: number;
  spawnFlashOnDeath: boolean;
  r: number;
  g: number;
  b: number;
}

export interface HorizonFlashSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  maxSize: number;
  r: number;
  g: number;
  b: number;
}

export interface HorizonWarState {
  tracers: HorizonTracerSlot[];
  flashes: HorizonFlashSlot[];
  aaTimer: number;
  artilleryTimer: number;
  orbitalTimer: number;
  elapsed: number;
}

export interface HorizonWarStepEvents {
  artilleryImpacts: number;
  orbitalStrikes: number;
}

function appendCruiserPart(
  targetPositions: number[],
  targetNormals: number[],
  targetColors: number[],
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
    targetPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    targetNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    targetColors.push(col.r, col.g, col.b);
  }
  nonIndexed.dispose();
}

/**
 * Builds a single merged low-poly BufferGeometry (~110 triangles) containing
 * both hovering distant sky cruisers for 1-Draw-Call silhouette depth.
 */
export function createDistantCruisersGeometry(
  cruisers: readonly DistantCruiserSpec[] = DISTANT_WAR_CRUISERS,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const rootMat = new THREE.Matrix4();
  const localMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const posVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  const parts: ReadonlyArray<{
    size: readonly [number, number, number];
    pos: readonly [number, number, number];
    rot?: readonly [number, number, number];
    color: string;
  }> = [
    // Main armored spine hull (long wedge silhouette)
    { size: [22, 11, 96], pos: [0, 0, 0], color: '#39414A' },
    // Prow armored ram & lower keel
    { size: [14, 7.5, 34], pos: [0, -1.5, 56], rot: [0.06, 0, 0], color: '#424B56' },
    { size: [16, 6.5, 72], pos: [0, -6.5, -4], color: '#2F363E' },
    // Port & Starboard engine/weapon sponsons
    { size: [9.5, 7, 52], pos: [-15.5, -0.5, -16], color: '#343C45' },
    { size: [9.5, 7, 52], pos: [15.5, -0.5, -16], color: '#343C45' },
    // Dorsal command bridge tower & mast
    { size: [10, 12, 22], pos: [0, 10.5, -20], color: '#46505C' },
    { size: [3.2, 14, 4.5], pos: [0, 21, -24], rot: [-0.14, 0, 0], color: '#505A66' },
  ];

  for (const c of cruisers) {
    euler.set(0, c.rotY, c.tiltZ);
    quat.setFromEuler(euler);
    posVec.set(c.x, c.y, c.z);
    scaleVec.setScalar(c.scale);
    rootMat.compose(posVec, quat, scaleVec);

    for (const p of parts) {
      const box = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      euler.set(p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, p.rot?.[2] ?? 0);
      quat.setFromEuler(euler);
      posVec.set(p.pos[0], p.pos[1], p.pos[2]);
      localMat.compose(posVec, quat, one);
      worldMat.multiplyMatrices(rootMat, localMat);
      appendCruiserPart(positions, normals, colors, box, worldMat, p.color);
      box.dispose();
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

export function createHorizonWarState(): HorizonWarState {
  const tracers: HorizonTracerSlot[] = [];
  for (let i = 0; i < HORIZON_WAR_MAX_TRACERS; i++) {
    tracers.push({
      active: false,
      isOrbital: false,
      x: 0,
      y: -9999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scaleX: 1,
      scaleY: 1,
      life: 0,
      maxLife: 1,
      spawnFlashOnDeath: false,
      r: 1,
      g: 1,
      b: 1,
    });
  }

  const flashes: HorizonFlashSlot[] = [];
  for (let i = 0; i < HORIZON_WAR_MAX_FLASHES; i++) {
    flashes.push({
      active: false,
      x: 0,
      y: -9999,
      z: 0,
      life: 0,
      maxLife: 0.4,
      maxSize: 1,
      r: 1,
      g: 0.7,
      b: 0.3,
    });
  }

  return {
    tracers,
    flashes,
    aaTimer: 0.35,
    artilleryTimer: 1.4,
    orbitalTimer: 9.5,
    elapsed: 0,
  };
}

function spawnHorizonFlash(
  state: HorizonWarState,
  x: number,
  y: number,
  z: number,
  size: number,
  r: number,
  g: number,
  b: number,
  duration: number,
): void {
  for (let i = 0; i < state.flashes.length; i++) {
    const f = state.flashes[i];
    if (!f.active) {
      f.active = true;
      f.x = x;
      f.y = y;
      f.z = z;
      f.life = 0;
      f.maxLife = duration;
      f.maxSize = size;
      f.r = r;
      f.g = g;
      f.b = b;
      return;
    }
  }
}

/**
 * Picks a visible horizon angle biased toward the Northern / NW / NE / East
 * mountain amphitheater (-165° to +10°) visible in both Overview and Drive views.
 */
function pickNorthernHorizonAngle(rng: () => number, side?: 'west' | 'east'): number {
  if (side === 'west') {
    // NNW arc (-135° to -95°)
    return -Math.PI * (0.53 + rng() * 0.22);
  }
  if (side === 'east') {
    // NNE arc (-82° to -32°)
    return -Math.PI * (0.18 + rng() * 0.28);
  }
  // Northern amphitheater arc (-138° to -26°)
  return -Math.PI * 0.77 + rng() * Math.PI * 0.62;
}

export function triggerHorizonAntiAirBurst(
  state: HorizonWarState,
  rng: () => number = Math.random,
): void {
  const isOrangeArmy = rng() > 0.48;
  const angle = pickNorthernHorizonAngle(rng, isOrangeArmy ? 'west' : 'east');
  const dist = 285 + rng() * 115;

  const startX = Math.cos(angle) * dist;
  const startZ = Math.sin(angle) * dist;
  const ridgeY = Math.max(38, getExtendedTerrainHeight(startX, startZ) + 4);

  // Aim tracer volley toward the opposing sky cruiser
  const targetCruiser = isOrangeArmy ? DISTANT_WAR_CRUISERS[1] : DISTANT_WAR_CRUISERS[0];
  let dx = targetCruiser.x - startX + (rng() - 0.5) * 85;
  let dy = targetCruiser.y - ridgeY + (rng() - 0.5) * 32;
  let dz = targetCruiser.z - startZ + (rng() - 0.5) * 85;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;

  const speed = 195 + rng() * 65;
  const r = isOrangeArmy ? 1.0 : 0.26;
  const g = isOrangeArmy ? 0.54 : 0.88;
  const b = isOrangeArmy ? 0.14 : 1.0;

  let spawned = 0;
  for (let i = 0; i < state.tracers.length; i++) {
    const t = state.tracers[i];
    if (!t.active) {
      t.active = true;
      t.isOrbital = false;
      t.x = startX + dx * spawned * 16;
      t.y = ridgeY + 4 + dy * spawned * 16;
      t.z = startZ + dz * spawned * 16;
      t.vx = dx * speed;
      t.vy = dy * speed;
      t.vz = dz * speed;
      t.scaleX = 1.25;
      t.scaleY = 0.82;
      t.life = 0;
      t.maxLife = 1.2 + rng() * 0.65;
      t.spawnFlashOnDeath = spawned % 2 === 0;
      t.r = r;
      t.g = g;
      t.b = b;

      spawned++;
      if (spawned >= 6) break;
    }
  }
}

export function triggerHorizonOrbitalStrike(
  state: HorizonWarState,
  rng: () => number = Math.random,
): void {
  const angle = pickNorthernHorizonAngle(rng);
  const dist = 310 + rng() * 90;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const impactY = Math.max(32, getExtendedTerrainHeight(x, z) + 2);

  for (let i = 0; i < state.tracers.length; i++) {
    const t = state.tracers[i];
    if (!t.active) {
      t.active = true;
      t.isOrbital = true;
      t.x = x;
      t.y = impactY;
      t.z = z;
      t.vx = 0;
      t.vy = 0;
      t.vz = 0;
      t.scaleX = 4.2;
      t.scaleY = 12.0;
      t.life = 0;
      t.maxLife = 0.52;
      t.spawnFlashOnDeath = false;
      t.r = 0.55;
      t.g = 0.94;
      t.b = 1.0;

      spawnHorizonFlash(state, x, impactY + 4, z, 1.85, 0.72, 0.96, 1.0, 0.65);
      return;
    }
  }
}

/**
 * Seeds a crisp mid-battle snapshot so even static/demand WebGL captures
 * immediately show opposing tracers, flak airbursts, and an orbital strike.
 */
export function seedInitialHorizonWarAction(state: HorizonWarState): void {
  let seedVal = 23;
  const seededRng = () => {
    seedVal = (seedVal * 1664525 + 1013904223) >>> 0;
    return seedVal / 4294967296;
  };

  triggerHorizonAntiAirBurst(state, seededRng);
  stepHorizonWar(state, 0.25, seededRng);
  triggerHorizonAntiAirBurst(state, seededRng);
  stepHorizonWar(state, 0.22, seededRng);

  // Add crisp mid-sky flak airbursts around the cruisers & ridge saddle
  spawnHorizonFlash(state, -96, 108, -352, 1.25, 1.0, 0.66, 0.22, 0.45);
  spawnHorizonFlash(state, 108, 114, -345, 1.3, 0.35, 0.88, 1.0, 0.45);
  spawnHorizonFlash(state, -18, 76, -310, 1.45, 1.0, 0.44, 0.12, 0.5);

  // Place a crisp cyan orbital strike descending behind the NNE ridge between wind turbines & Citadel
  const ox = 152;
  const oz = -335;
  const oy = Math.max(38, getExtendedTerrainHeight(ox, oz) + 2);
  for (let i = 0; i < state.tracers.length; i++) {
    const t = state.tracers[i];
    if (!t.active) {
      t.active = true;
      t.isOrbital = true;
      t.x = ox;
      t.y = oy;
      t.z = oz;
      t.vx = 0;
      t.vy = 0;
      t.vz = 0;
      t.scaleX = 4.2;
      t.scaleY = 12.0;
      t.life = 0.22;
      t.maxLife = 0.55;
      t.spawnFlashOnDeath = false;
      t.r = 0.55;
      t.g = 0.94;
      t.b = 1.0;
      spawnHorizonFlash(state, ox, oy + 4, oz, 1.6, 0.72, 0.96, 1.0, 0.65);
      break;
    }
  }

  for (const f of state.flashes) {
    if (f.active) f.life = f.maxLife * 0.42;
  }
}

export function stepHorizonWar(
  state: HorizonWarState,
  dt: number,
  rng: () => number = Math.random,
): HorizonWarStepEvents {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  state.elapsed += clampedDt;
  const events: HorizonWarStepEvents = {
    artilleryImpacts: 0,
    orbitalStrikes: 0,
  };

  state.aaTimer -= clampedDt;
  if (state.aaTimer <= 0) {
    triggerHorizonAntiAirBurst(state, rng);
    state.aaTimer = 0.75 + rng() * 1.25;
  }

  state.artilleryTimer -= clampedDt;
  if (state.artilleryTimer <= 0) {
    const angle = pickNorthernHorizonAngle(rng);
    const dist = 365 + rng() * 165;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = Math.max(30, getExtendedTerrainHeight(x, z) + 8 + rng() * 22);
    spawnHorizonFlash(state, x, y, z, 1.55 + rng() * 1.15, 1.0, 0.46, 0.12, 0.46);
    state.artilleryTimer = 1.1 + rng() * 1.8;
    events.artilleryImpacts++;
  }

  state.orbitalTimer -= clampedDt;
  if (state.orbitalTimer <= 0) {
    triggerHorizonOrbitalStrike(state, rng);
    state.orbitalTimer = 14.0 + rng() * 9.0;
    events.orbitalStrikes++;
  }

  for (let i = 0; i < state.tracers.length; i++) {
    const t = state.tracers[i];
    if (!t.active) continue;
    t.life += clampedDt;
    if (t.life >= t.maxLife) {
      t.active = false;
      if (t.spawnFlashOnDeath) {
        spawnHorizonFlash(state, t.x, t.y, t.z, 0.95, t.r, t.g, t.b, 0.28);
      }
      continue;
    }
    t.x += t.vx * clampedDt;
    t.y += t.vy * clampedDt;
    t.z += t.vz * clampedDt;
  }

  for (let i = 0; i < state.flashes.length; i++) {
    const f = state.flashes[i];
    if (!f.active) continue;
    f.life += clampedDt;
    if (f.life >= f.maxLife) {
      f.active = false;
    }
  }

  return events;
}

export function isHorizonPositionOutsideArena(x: number, z: number): boolean {
  return Math.abs(x) > MAP_HALF_W + 40 || Math.abs(z) > MAP_HALF_D + 40;
}
