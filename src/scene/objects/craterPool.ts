import * as THREE from 'three';
import {
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
} from '../../map/terrainMath';
import { getWalkableSurfaceY } from '../../map/mechKinematics';

export const MAX_CRATER_DECALS = 32;

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
}

export interface CraterPoolState {
  decals: CraterDecal[];
  cursor: number;
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
    })),
    cursor: 0,
  };
}

export function resetCraterPool(pool: CraterPoolState): void {
  for (let i = 0; i < pool.decals.length; i++) {
    pool.decals[i].active = false;
  }
  pool.cursor = 0;
}

/**
 * Stamps a normal-aligned crater/scorch decal on solid ground or bridge decks.
 * Suppresses decals submerged in river water or mid-air impacts far above terrain.
 */
export function spawnCraterDecal(
  pool: CraterPoolState,
  x: number,
  impactY: number,
  z: number,
  radius: number,
  intensity = 1.0,
  seedYaw = 0,
): boolean {
  const surface = getWalkableSurfaceY(x, z);
  if (surface.inWater || surface.y <= WATER_LEVEL + 0.28) return false;
  if (Math.abs(impactY - surface.y) > 2.6) return false;

  const n =
    surface.onBridge || surface.onConcrete
      ? { nx: 0, ny: 1, nz: 0 }
      : getAnalyticalTerrainNormal(x, z, 1.8, false);
  if (n.ny < 0.72) return false; // Skip sheer vertical rock faces to prevent grazing-stretch

  const idx = pool.cursor % pool.decals.length;
  pool.cursor = (pool.cursor + 1) % pool.decals.length;

  const slot = pool.decals[idx];
  slot.active = true;
  slot.x = x;
  slot.y = surface.y + 0.045;
  slot.z = z;
  slot.nx = n.nx;
  slot.ny = n.ny;
  slot.nz = n.nz;
  slot.radius = radius;
  slot.yaw = seedYaw;
  slot.intensity = Math.max(0.35, Math.min(1.2, intensity));
  return true;
}

/**
 * Procedural PBR blast crater & scorch decal material:
 * Perturbs surface normal radially into a sunken blast bowl + raised rim ridge
 * so directional sunlight casts realistic crater self-shading without modifying terrain geometry.
 */
export function createCraterDecalMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.94,
    metalness: 0.04,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  mat.customProgramCacheKey = () => 'sector7-crater-decal-v1';

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vCraterUv;
varying vec3 vCraterTangentView;
varying vec3 vCraterBitangentView;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vCraterUv = uv;
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
vec2 cDelta = ( vCraterUv - 0.5 ) * 2.0;
float cDist = length( cDelta );
float cAng = atan( cDelta.y, cDelta.x );
float cRayNoise = craterNoise( vec2( cAng * 4.5 + 1.7, cDist * 4.2 ) );
float cMicro = craterNoise( vCraterUv * 18.0 );
float cWarpedR = cDist + ( cRayNoise - 0.5 ) * 0.22;
if ( cWarpedR > 0.98 ) discard;

// Dark charred carbon center + scorched brown-ash ejecta rays + dusty rim
float cBowl = 1.0 - smoothstep( 0.05, 0.44, cWarpedR );
float cRim = smoothstep( 0.28, 0.46, cWarpedR ) * ( 1.0 - smoothstep( 0.48, 0.72, cWarpedR ) );
float cSootRays = ( 1.0 - smoothstep( 0.35, 0.95, cWarpedR ) ) * ( 0.55 + 0.45 * cRayNoise );

vec3 colChar = vec3( 0.035, 0.032, 0.030 );
vec3 colSoot = vec3( 0.095, 0.082, 0.072 );
vec3 colRimDirt = vec3( 0.26, 0.22, 0.17 );

vec3 craterCol = mix( colSoot, colChar, cBowl );
craterCol = mix( craterCol, colRimDirt, cRim * ( 0.45 + 0.4 * cMicro ) );
diffuseColor.rgb *= craterCol * ( 0.85 + cMicro * 0.3 );

float cAlpha = clamp( cBowl * 0.92 + cRim * 0.76 + cSootRays * 0.52, 0.0, 0.92 );
cAlpha *= ( 1.0 - smoothstep( 0.62, 0.98, cWarpedR ) );
diffuseColor.a = cAlpha;
if ( diffuseColor.a < 0.015 ) discard;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// Analytical concave bowl slope + raised lip ridge normal perturbation in view space
vec2 cRadialDir = cDist > 0.001 ? ( cDelta / cDist ) : vec2( 0.0 );
float cSlopeProfile = 0.0;
if ( cWarpedR < 0.46 ) {
  // Inner concave bowl slopes down toward center (normal leans inward)
  cSlopeProfile = -smoothstep( 0.02, 0.38, cWarpedR ) * ( 1.0 - smoothstep( 0.38, 0.48, cWarpedR ) ) * 0.95;
} else {
  // Outer ejecta rim slopes outward away from rim crest
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
