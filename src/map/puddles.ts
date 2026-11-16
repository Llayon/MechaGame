import * as THREE from 'three';

export interface PuddleSample {
  wetness: number;
  wetSoil: number;
  waterFactor: number;
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function mod289(x: number): number {
  return x - Math.floor(x / 289) * 289;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Mediump-safe procedural hash matching GLSL `puddleHash` (mod 289 + Dave Hoskins arithmetic).
 */
export function puddleHash21(px: number, pz: number): number {
  const mx = mod289(px);
  const mz = mod289(pz);
  let qx = fract(mx * 0.1031);
  let qz = fract(mz * 0.1030);
  const d = qx * (qz + 33.33) + qz * (qx + 33.33);
  qx += d;
  qz += d;
  return fract((qx + qz) * qx);
}

export function puddleNoise2D(px: number, pz: number): number {
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = px - ix;
  const fz = pz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = puddleHash21(ix, iz);
  const b = puddleHash21(ix + 1, iz);
  const c = puddleHash21(ix, iz + 1);
  const d = puddleHash21(ix + 1, iz + 1);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/**
 * Evaluates rain puddle & wet-soil border factors at world (x, y, z) with surface normal ny.
 * Pure JS mirror of the GLSL puddle field so footsteps and unit tests stay synced 1:1.
 */
export function evaluatePuddleAt(
  x: number,
  y: number,
  z: number,
  ny: number,
  options: { isRoad?: boolean; exclusionMask?: number } = {},
): PuddleSample {
  const { isRoad = false, exclusionMask = 0 } = options;
  if (y <= 1.35 || y >= 14.5 || ny <= 0.962 || exclusionMask >= 0.999) {
    return { wetness: 0, wetSoil: 0, waterFactor: 0 };
  }

  const altGate = smoothstep(1.35, 2.0, y) * (1 - smoothstep(11.5, 14.5, y));
  const flatGate = smoothstep(0.968, 0.995, ny);

  const n1 = puddleNoise2D(x * 0.075 + 4.2, z * 0.075 - 2.7);
  const n2 = puddleNoise2D(x * 0.21 - 1.5, z * 0.21 + 6.1);
  const field = n1 * 0.68 + n2 * 0.32;

  const threshold = isRoad ? 0.585 : 0.625;
  const rawWetness = (field - threshold) * 2.4;
  const wetness = Math.max(0, rawWetness) * altGate * flatGate * (1 - exclusionMask);

  const wetSoil = smoothstep(0.0, 0.16, wetness);
  const waterFactor = smoothstep(0.16, 0.195, wetness);
  return { wetness, wetSoil, waterFactor };
}

export const GLSL_PUDDLE_HELPERS = /* glsl */ `
float puddleHash( vec2 p ) {
  p = mod( p, 289.0 );
  vec2 q = fract( p * vec2( 0.1031, 0.1030 ) );
  q += dot( q, q.yx + 33.33 );
  return fract( ( q.x + q.y ) * q.x );
}

float puddleNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = puddleHash( i );
  float b = puddleHash( i + vec2( 1.0, 0.0 ) );
  float c = puddleHash( i + vec2( 0.0, 1.0 ) );
  float d = puddleHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
`;

/**
 * Patches a MeshStandardMaterial (such as RoadNetwork dirt roads) with PBR rain puddles:
 * porosity darkening around rims, sharp water boundary, flattened normal with wind ripples,
 * and low roughness so Scene.environment + directional sun + FogExp2 + shadows work physically.
 */
export function createRoadPuddleMaterial(
  puddleTimeUniform: { value: number },
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#5A6067',
    roughness: 0.86,
    metalness: 0.05,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  mat.customProgramCacheKey = () => 'sector7-road-puddles-v2';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPuddleTime = puddleTimeUniform;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vRoadUv;
varying vec3 vPuddleWorldPos;
varying vec3 vPuddleWorldNormal;
varying vec3 vPuddleUp;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vRoadUv = uv;
vPuddleWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vPuddleWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
vPuddleUp = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPuddleTime;
varying vec2 vRoadUv;
varying vec3 vPuddleWorldPos;
varying vec3 vPuddleWorldNormal;
varying vec3 vPuddleUp;
${GLSL_PUDDLE_HELPERS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// 1. Feathered noisy spline-decal road shoulder (melts smoothly into grass/soil)
float roadU = vRoadUv.x;
float shoulderNoise = ( puddleNoise( vec2( vRoadUv.y * 1.9, 2.3 ) ) - 0.5 ) * 0.14
  + ( puddleNoise( vec2( vRoadUv.y * 5.2, 8.7 ) ) - 0.5 ) * 0.06;
float roadEdgeAlpha = smoothstep( 0.0, 0.18, roadU + shoulderNoise )
  * smoothstep( 1.0, 0.82, roadU - shoulderNoise );
if ( roadEdgeAlpha < 0.015 ) discard;

// 2. Twin compacted Mech/convoy wheel ruts + gravelly center crown
float trackLeft = exp( -pow( ( roadU - 0.28 ) / 0.075, 2.0 ) );
float trackRight = exp( -pow( ( roadU - 0.72 ) / 0.075, 2.0 ) );
float trackRut = clamp( trackLeft + trackRight, 0.0, 1.0 );
float centerCrown = exp( -pow( ( roadU - 0.50 ) / 0.12, 2.0 ) );

diffuseColor.rgb *= mix( 1.0, 0.81, trackRut );
diffuseColor.rgb *= mix( 1.0, 1.07, centerCrown * 0.5 );

// 3. Close-range gravel micro-detail fading past ~42m
float rDetailFade = 1.0 - smoothstep( 14.0, 42.0, length( vViewPosition ) );
if ( rDetailFade > 0.001 ) {
  float rGravel = puddleNoise( vPuddleWorldPos.xz * 6.8 );
  diffuseColor.rgb *= mix( 1.0, 0.88 + rGravel * 0.24, rDetailFade );
}

diffuseColor.a *= roadEdgeAlpha;

// 4. Lowland PBR rain puddles
float puddleNY = clamp( normalize( vPuddleWorldNormal ).y, 0.0, 1.0 );
float puddleWetSoil = 0.0;
float puddleWater = 0.0;
if ( vPuddleWorldPos.y > 1.35 && vPuddleWorldPos.y < 14.5 && puddleNY > 0.962 ) {
  float pAltGate = smoothstep( 1.35, 2.0, vPuddleWorldPos.y ) * ( 1.0 - smoothstep( 11.5, 14.5, vPuddleWorldPos.y ) );
  float pFlatGate = smoothstep( 0.968, 0.995, puddleNY );
  float pN1 = puddleNoise( vPuddleWorldPos.xz * 0.075 + vec2( 4.2, -2.7 ) );
  float pN2 = puddleNoise( vPuddleWorldPos.xz * 0.21 + vec2( -1.5, 6.1 ) );
  float pField = pN1 * 0.68 + pN2 * 0.32;
  float pWetness = max( 0.0, ( pField - 0.585 ) * 2.4 ) * pAltGate * pFlatGate;
  puddleWetSoil = smoothstep( 0.0, 0.16, pWetness );
  puddleWater = smoothstep( 0.16, 0.195, pWetness );
  diffuseColor.rgb *= mix( 1.0, 0.42, puddleWetSoil );
  diffuseColor.rgb *= mix( 1.0, 0.66, puddleWater );
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix( 0.88, 0.70, trackRut );
roughnessFactor = mix( roughnessFactor, 0.60, puddleWetSoil );
roughnessFactor = mix( roughnessFactor, 0.045, puddleWater );`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix( metalnessFactor, 0.10, puddleWater );`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if ( puddleWater > 0.001 ) {
  vec2 rUv = vPuddleWorldPos.xz * 2.5 + vec2( uPuddleTime * 0.55, uPuddleTime * 0.35 );
  float ripA = ( puddleNoise( rUv ) - 0.5 ) * 0.04;
  float ripB = ( puddleNoise( rUv + vec2( 3.7, -2.1 ) ) - 0.5 ) * 0.04;
  vec3 flatWaterViewN = normalize( vPuddleUp + vec3( ripA, 0.0, ripB ) );
  normal = normalize( mix( normal, flatWaterViewN, puddleWater ) );
}`,
      );
  };

  return mat;
}
