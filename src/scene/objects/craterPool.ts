import * as THREE from 'three';
import {
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
} from '../../map/terrainMath';
import { getWalkableSurfaceY } from '../../map/mechKinematics';

export const MAX_CRATER_DECALS = 128;

/**
 * 0 = blast crater (concavity + ejecta + cooling magma cracks)
 * 1 = ballistic impact pockmark (wall/ground bullet scar with glowing rim)
 * 2 = molten slag / cutting laser trench (procedural crack crust + blackbody radiation)
 */
export type CraterDecalKind = 0 | 1 | 2;

export interface CraterDecal {
  active: boolean;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  radius: number;
  yaw: number;
  intensity: number;
  age: number;
  maxAge: number;
  seed: number;
  kind: CraterDecalKind;
}

export interface CraterPoolState {
  decals: CraterDecal[];
  cursor: number;
  activeCount: number;
  dirty: boolean;
}

export interface SpawnCraterOptions {
  nx?: number;
  ny?: number;
  nz?: number;
  kind?: CraterDecalKind;
  maxAge?: number;
  seed?: number;
}

export interface LaserCutPoint {
  x: number;
  y: number;
  z: number;
}

export function createCraterPool(capacity = MAX_CRATER_DECALS): CraterPoolState {
  return {
    decals: Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      nx: 0,
      ny: 1,
      nz: 0,
      radius: 1.5,
      yaw: 0,
      intensity: 1,
      age: 0,
      maxAge: 24,
      seed: 0.5,
      kind: 0,
    })),
    cursor: 0,
    activeCount: 0,
    dirty: false,
  };
}

export function resetCraterPool(pool: CraterPoolState): void {
  for (let i = 0; i < pool.decals.length; i++) {
    pool.decals[i].active = false;
    pool.decals[i].age = 0;
  }
  pool.cursor = 0;
  pool.activeCount = 0;
  pool.dirty = true;
}

/**
 * Stamps a normal-aligned impact, crater, or molten slag decal on walls, bridges, or terrain.
 * When explicit surface normal (opts.nx, ny, nz) is supplied, allows vertical walls and bunkers;
 * otherwise snaps onto dry walkable ground/decks and skips sheer vertical terrain cliffs.
 */
export function spawnCraterDecal(
  pool: CraterPoolState,
  x: number,
  impactY: number,
  z: number,
  radius: number,
  intensity = 1.0,
  seedYaw = 0,
  opts?: SpawnCraterOptions,
): boolean {
  const capacity = pool.decals.length;
  if (capacity === 0) return false;

  const kind: CraterDecalKind = opts?.kind ?? 0;
  const hasExplicitNormal =
    opts?.nx !== undefined && opts?.ny !== undefined && opts?.nz !== undefined;

  let px = x;
  let py = impactY;
  let pz = z;
  let nx = 0;
  let ny = 1;
  let nz = 0;

  if (hasExplicitNormal) {
    const nLen = Math.hypot(opts!.nx!, opts!.ny!, opts!.nz!);
    if (nLen < 1e-5) return false;
    nx = opts!.nx! / nLen;
    ny = opts!.ny! / nLen;
    nz = opts!.nz! / nLen;

    const surface = getWalkableSurfaceY(x, z);
    if (surface.inWater && impactY <= WATER_LEVEL + 0.16) return false;

    const surfaceOffset = kind === 2 ? 0.036 : kind === 1 ? 0.028 : 0.042;
    px += nx * surfaceOffset;
    py += ny * surfaceOffset;
    pz += nz * surfaceOffset;
  } else {
    const surface = getWalkableSurfaceY(x, z);
    if (surface.inWater || surface.y <= WATER_LEVEL + 0.28) return false;
    if (Math.abs(impactY - surface.y) > 2.6) return false;

    const n =
      surface.onBridge || surface.onConcrete
        ? { nx: 0, ny: 1, nz: 0 }
        : getAnalyticalTerrainNormal(x, z, 1.8, false);
    if (n.ny < 0.72) return false;

    nx = n.nx;
    ny = n.ny;
    nz = n.nz;
    py = surface.y + 0.045;
  }

  const idx = pool.cursor % capacity;
  pool.cursor = (pool.cursor + 1) % capacity;

  const slot = pool.decals[idx];
  const wasActive = slot.active;
  slot.active = true;
  slot.x = px;
  slot.y = py;
  slot.z = pz;
  slot.nx = nx;
  slot.ny = ny;
  slot.nz = nz;
  slot.radius = Math.max(0.12, radius);
  slot.yaw = seedYaw;
  slot.intensity = Math.max(0.35, Math.min(1.5, intensity));
  slot.age = 0;
  slot.maxAge = opts?.maxAge ?? (kind === 1 ? 10.5 : kind === 2 ? 15.0 : 28.0);
  const rawSeed = opts?.seed ?? Math.abs(Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719));
  slot.seed = rawSeed - Math.floor(rawSeed);
  slot.kind = kind;

  if (!wasActive) {
    pool.activeCount += 1;
  }
  pool.dirty = true;
  return true;
}

/**
 * Advances cooling & fade-out timers for all active surface decals.
 * Returns the remaining active decal count and marks pool dirty when visual updates occur.
 */
export function stepCraterPool(pool: CraterPoolState, rawDt: number): number {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return pool.activeCount;

  let active = 0;
  let changed = false;
  for (let i = 0; i < pool.decals.length; i++) {
    const d = pool.decals[i];
    if (!d.active) continue;
    d.age += dt;
    changed = true;
    if (d.age >= d.maxAge) {
      d.active = false;
      continue;
    }
    active++;
  }
  pool.activeCount = active;
  if (changed) pool.dirty = true;
  return active;
}

/**
 * Traces a continuous glowing molten-slag trench along terrain or wall surfaces
 * as a cutting beam sweeps between prevPoint and (curX, curY, curZ).
 */
export function traceLaserCut(
  pool: CraterPoolState,
  prevPoint: LaserCutPoint | null,
  curX: number,
  curY: number,
  curZ: number,
  nx: number,
  ny: number,
  nz: number,
  radius = 0.44,
  outPoint?: LaserCutPoint,
): LaserCutPoint {
  const target = outPoint ?? { x: curX, y: curY, z: curZ };
  const stepDist = Math.max(0.18, radius * 0.65);

  if (!prevPoint) {
    spawnCraterDecal(pool, curX, curY, curZ, radius, 1.28, curX * 0.7 + curZ * 0.5, {
      nx,
      ny,
      nz,
      kind: 2,
      maxAge: 15.0,
    });
    target.x = curX;
    target.y = curY;
    target.z = curZ;
    return target;
  }

  const dx = curX - prevPoint.x;
  const dy = curY - prevPoint.y;
  const dz = curZ - prevPoint.z;
  const dist = Math.hypot(dx, dy, dz);

  // If beam jumped across an edge/target gap, start fresh without bridging empty air
  if (dist > radius * 6.0) {
    spawnCraterDecal(pool, curX, curY, curZ, radius, 1.28, curX * 0.9 + curZ * 0.3, {
      nx,
      ny,
      nz,
      kind: 2,
      maxAge: 15.0,
    });
    target.x = curX;
    target.y = curY;
    target.z = curZ;
    return target;
  }

  if (dist < stepDist * 0.78) {
    target.x = prevPoint.x;
    target.y = prevPoint.y;
    target.z = prevPoint.z;
    return target;
  }

  const steps = Math.min(8, Math.floor(dist / stepDist));
  let lastX = prevPoint.x;
  let lastY = prevPoint.y;
  let lastZ = prevPoint.z;
  for (let s = 1; s <= steps; s++) {
    const frac = (s * stepDist) / dist;
    const sx = prevPoint.x + dx * frac;
    const sy = prevPoint.y + dy * frac;
    const sz = prevPoint.z + dz * frac;
    spawnCraterDecal(pool, sx, sy, sz, radius, 1.28, sx * 0.7 + sz * 0.5, {
      nx,
      ny,
      nz,
      kind: 2,
      maxAge: 15.0,
    });
    lastX = sx;
    lastY = sy;
    lastZ = sz;
  }

  target.x = lastX;
  target.y = lastY;
  target.z = lastZ;
  return target;
}

/**
 * Procedural PBR surface decal material (1 Draw Call for all craters, bullet pockmarks, and laser slag):
 * Reads per-instance `aDecalState` = vec4(ageNorm, seed, kind, intensity)
 *   - kind 0: explosive crater bowl with raised lip, normal bump & cooling radial fractures
 *   - kind 1: ballistic impact pockmark with glowing orange rim that cools to soot
 *   - kind 2: cutting laser molten-slag crust with cellular blackbody cooling
 */
export function createCraterDecalMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
    metalness: 0.06,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  mat.customProgramCacheKey = () => 'sector7-crater-decal-v2';

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aDecalState;
varying vec2 vCraterUv;
varying vec4 vDecalState;
varying vec3 vCraterTangentView;
varying vec3 vCraterBitangentView;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCraterUv = uv;
vDecalState = aDecalState;
#ifdef USE_INSTANCING
  mat3 cMat = mat3( modelViewMatrix ) * mat3( instanceMatrix );
#else
  mat3 cMat = mat3( modelViewMatrix );
#endif
vCraterTangentView = normalize( cMat * vec3( 1.0, 0.0, 0.0 ) );
vCraterBitangentView = normalize( cMat * vec3( 0.0, 0.0, -1.0 ) );`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vCraterUv;
varying vec4 vDecalState;
varying vec3 vCraterTangentView;
varying vec3 vCraterBitangentView;

float craterHash( vec2 p ) {
  p = mod( p, 289.0 );
  vec2 q = fract( p * vec2( 0.1031, 0.1030 ) );
  q += dot( q, q.yx + 33.33 );
  return fract( ( q.x + q.y ) * q.x );
}

float craterNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( craterHash( i ), craterHash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( craterHash( i + vec2( 0.0, 1.0 ) ), craterHash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y
  );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float dAge = clamp( vDecalState.x, 0.0, 1.0 );
float dSeed = vDecalState.y;
float dKind = vDecalState.z;
float dIntensity = max( 0.4, vDecalState.w );
float lifeFade = 1.0 - smoothstep( 0.72, 1.0, dAge );

vec2 cDelta = ( vCraterUv - 0.5 ) * 2.0;
float cDist = length( cDelta );
float cAng = atan( cDelta.y, cDelta.x );
vec2 seedShift = vec2( dSeed * 19.3, dSeed * 7.7 );
float cRayNoise = craterNoise( vec2( cAng * 4.5 + 1.7 + dSeed * 6.28, cDist * 4.2 ) );
float cMicro = craterNoise( vCraterUv * 18.0 + seedShift );
float cCrackNoise = craterNoise( vec2( cAng * 10.5 + dSeed * 11.1, cDist * 9.0 ) );
float cWarpedR = cDist + ( cRayNoise - 0.5 ) * ( dKind > 1.5 ? 0.16 : 0.24 );
if ( cWarpedR > 0.98 ) discard;

float cBowl = 1.0 - smoothstep( 0.05, 0.44, cWarpedR );
float cRim = smoothstep( 0.26, 0.46, cWarpedR ) * ( 1.0 - smoothstep( 0.48, 0.74, cWarpedR ) );
float cSootRays = ( 1.0 - smoothstep( 0.34, 0.95, cWarpedR ) ) * ( 0.55 + 0.45 * cRayNoise );

// Radial fractures + molten heat envelope (strictly ascending smoothstep bounds)
float crackPattern = smoothstep( 0.58, 0.86, cCrackNoise ) * ( 1.0 - smoothstep( 0.32, 0.78, cWarpedR ) );
float coreMolten = 1.0 - smoothstep( 0.08, 0.52, cWarpedR );
float coolHot = 1.0 - smoothstep( 0.0, 0.28, dAge );
float coolEmber = 1.0 - smoothstep( 0.18, 0.62, dAge );

vec3 colChar = vec3( 0.032, 0.030, 0.028 );
vec3 colSoot = vec3( 0.095, 0.082, 0.072 );
vec3 colRimDirt = dKind > 0.5 && dKind < 1.5 ? vec3( 0.32, 0.30, 0.28 ) : vec3( 0.26, 0.22, 0.17 );

vec3 craterCol = mix( colSoot, colChar, cBowl );
craterCol = mix( craterCol, colRimDirt, cRim * ( 0.45 + 0.4 * cMicro ) );
diffuseColor.rgb *= craterCol * ( 0.85 + cMicro * 0.3 );

float heatMask = dKind > 1.5
  ? clamp( coreMolten * 0.92 + crackPattern * 0.55, 0.0, 1.0 )
  : dKind > 0.5
    ? clamp( ( 1.0 - smoothstep( 0.10, 0.42, cWarpedR ) ) * 0.8 + crackPattern * 0.45, 0.0, 1.0 )
    : clamp( crackPattern * 0.9 + cBowl * 0.22, 0.0, 1.0 );

float cAlpha = dKind > 1.5
  ? clamp( coreMolten * 0.96 + cSootRays * 0.62, 0.0, 0.96 )
  : clamp( cBowl * 0.94 + cRim * 0.76 + cSootRays * 0.52, 0.0, 0.94 );
cAlpha *= ( 1.0 - smoothstep( 0.62, 0.98, cWarpedR ) ) * lifeFade;
diffuseColor.a = cAlpha;
if ( diffuseColor.a < 0.015 ) discard;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
vec3 glowHot = vec3( 1.95, 0.98, 0.32 );
vec3 glowCoal = vec3( 0.85, 0.18, 0.03 );
float heatStrength = ( dKind > 1.5 ? 1.35 : dKind > 0.5 ? 0.95 : 0.75 ) * dIntensity;
vec3 thermalGlow = mix( glowCoal * coolEmber, glowHot, coolHot ) * heatMask * heatStrength * lifeFade;
totalEmissiveRadiance += thermalGlow;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec2 cRadialDir = cDist > 0.001 ? ( cDelta / cDist ) : vec2( 0.0 );
float cSlopeProfile = 0.0;
if ( cWarpedR < 0.46 ) {
  cSlopeProfile = -smoothstep( 0.02, 0.38, cWarpedR ) * ( 1.0 - smoothstep( 0.38, 0.48, cWarpedR ) ) * 0.95;
} else {
  cSlopeProfile = ( 1.0 - smoothstep( 0.46, 0.74, cWarpedR ) ) * 0.48;
}
float cBump = cSlopeProfile + ( cMicro - 0.5 ) * 0.18;
normal = normalize(
  normal
  + vCraterTangentView * ( cRadialDir.x * cBump )
  + vCraterBitangentView * ( cRadialDir.y * cBump )
);`,
      );
  };

  return mat;
}
