import * as THREE from 'three';
import { WATER_LEVEL } from '../../map/terrainMath';
import {
  GLSL_FLYBY_SHADOW_PARS,
  bindFlybyShadowUniforms,
} from '../flybyShadow';
import {
  GLSL_WATER_CAUSTICS_PARS,
  bindWaterCausticsUniforms,
} from '../waterCausticsAndAo';
import {
  GLSL_CANYON_LIGHTING_PARS,
  bindCanyonLightingUniforms,
} from '../canyonLighting';
import { GLSL_ANALYTIC_LINE_PARS } from '../surfaceDetail';

export type ConcreteMossPreset = 'bridge' | 'wall' | 'ruin';

interface PresetSettings {
  wallMoss: number;
  roofMoss: number;
  grimeStrength: number;
}

const PRESET_CONFIG: Record<ConcreteMossPreset, PresetSettings> = {
  // Bridges & viaducts: keep top deck crisp, strong waterline algae & clear pier moss
  bridge: { wallMoss: 0.72, roofMoss: 0.14, grimeStrength: 0.32 },
  // Fortress walls, bunkers, blast screens, industrial concrete: creeping lower moss + rain stains
  wall: { wallMoss: 0.72, roofMoss: 0.28, grimeStrength: 0.36 },
  // Shattered outpost ruins: heavy creeping moss & patchy roof turf
  ruin: { wallMoss: 0.92, roofMoss: 0.62, grimeStrength: 0.44 },
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Returns a cached PBR MeshStandardMaterial patched with 0-triangle procedural
 * waterline algae, climbing concrete moss, damp foundation grime, and weathered patina.
 * Preserves fog, shadows, PBR sunset speculars, and optional corrugated bumpMap.
 */
export function getOvergrownConcreteMaterial(
  colorHex: string,
  preset: ConcreteMossPreset = 'wall',
  options?: {
    roughness?: number;
    metalness?: number;
    bumpMap?: THREE.Texture | null;
    bumpScale?: number;
  },
): THREE.MeshStandardMaterial {
  const roughness = options?.roughness ?? 0.84;
  const metalness = options?.metalness ?? 0.08;
  const bumpMap = options?.bumpMap ?? null;
  const bumpScale = options?.bumpScale ?? 0.03;
  const key = `${colorHex}|${preset}|${roughness}|${metalness}|${bumpMap ? bumpMap.uuid : 'nobump'}|${bumpScale}`;

  const existing = materialCache.get(key);
  if (existing) return existing;

  const cfg = PRESET_CONFIG[preset];
  const matParams: THREE.MeshStandardMaterialParameters = {
    color: colorHex,
    roughness,
    metalness,
    fog: true,
  };
  if (bumpMap) {
    matParams.bumpMap = bumpMap;
    matParams.bumpScale = bumpScale;
  }
  const mat = new THREE.MeshStandardMaterial(matParams);

  mat.userData.localConcrete = true;
  mat.customProgramCacheKey = () => `sector7-weathered-concrete-v5-${preset}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWallMoss = { value: cfg.wallMoss };
    shader.uniforms.uRoofMoss = { value: cfg.roofMoss };
    shader.uniforms.uGrimeStrength = { value: cfg.grimeStrength };
    shader.uniforms.uWaterLevel = { value: WATER_LEVEL };
    shader.uniforms.uWaterBounceMask = {
      value: preset === 'bridge' || preset === 'ruin' ? 1.0 : 0.45,
    };
    shader.uniforms.uWallJointStrength = {
      value: preset === 'bridge' ? 0.0 : preset === 'ruin' ? 0.62 : 0.76,
    };
    bindFlybyShadowUniforms(shader.uniforms);
    bindWaterCausticsUniforms(shader.uniforms);
    bindCanyonLightingUniforms(shader.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vConcWorldPos;
varying vec3 vConcWorldNormal;
varying vec3 vConcLocalPos;
#ifdef BATCHED_CONCRETE
attribute float aConcreteSourceY;
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vConcLocalPos = transformed;
#ifdef BATCHED_CONCRETE
  vConcLocalPos.y = aConcreteSourceY;
#endif
#ifdef USE_INSTANCING
  vec4 cWp = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vConcWorldNormal = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * objectNormal );
#else
  vec4 cWp = modelMatrix * vec4( transformed, 1.0 );
  vConcWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
#endif
vConcWorldPos = cWp.xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
#define S7_CUSTOM_AO
uniform float uWallMoss;
uniform float uRoofMoss;
uniform float uGrimeStrength;
uniform float uWaterLevel;
uniform float uWaterBounceMask;
uniform float uWallJointStrength;
varying vec3 vConcWorldPos;
varying vec3 vConcWorldNormal;
varying vec3 vConcLocalPos;
${GLSL_FLYBY_SHADOW_PARS}
${GLSL_WATER_CAUSTICS_PARS}
${GLSL_CANYON_LIGHTING_PARS}
${GLSL_ANALYTIC_LINE_PARS}

vec3 concSrgb2Lin( vec3 c ) {
  return pow( max( c, vec3( 0.0 ) ), vec3( 2.2 ) );
}

float concHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float concNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( concHash( i ), concHash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( concHash( i + vec2( 0.0, 1.0 ) ), concHash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y
  );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Organic multi-scale world-space noise for concrete mottling, dampness & creeping moss
float cMacro = concNoise( vConcWorldPos.xz * 0.16 + vec2( vConcWorldPos.y * 0.12, -3.1 ) );
float cMed = concNoise( vec2( vConcWorldPos.x * 0.42 + vConcWorldPos.z * 0.39, vConcWorldPos.y * 0.24 ) );
float cFine = concNoise( vConcWorldPos.xz * 1.15 - vec2( vConcWorldPos.y * 0.72, 1.4 ) );
float cOrganic = cMacro * 0.50 + cMed * 0.34 + cFine * 0.16;

// Subtle concrete weathering & rainwater vertical streaks (eliminates sterile uniform gray)
float rainStreak = concNoise( vec2( ( vConcWorldPos.x + vConcWorldPos.z ) * 0.85, vConcWorldPos.y * 0.09 ) );
float patinaMul = mix( 1.0 - uGrimeStrength * 0.32, 1.0 + uGrimeStrength * 0.12, cOrganic * 0.65 + rainStreak * 0.35 );
diffuseColor.rgb *= patinaMul;

vec3 cDampCol = concSrgb2Lin( vec3( 0.185, 0.180, 0.160 ) );
vec3 cMossDark = concSrgb2Lin( vec3( 0.165, 0.245, 0.145 ) );
vec3 cMossBright = concSrgb2Lin( vec3( 0.265, 0.355, 0.195 ) );
vec3 cTurfCol = concSrgb2Lin( vec3( 0.235, 0.315, 0.185 ) );

// 1. River waterline wetness & algae collar on submerged piers, abutments & island quays
float aboveWater = vConcWorldPos.y - uWaterLevel;
float wetZone = 1.0 - smoothstep( -0.3, 1.45 + ( cMed - 0.5 ) * 0.7, aboveWater );
diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 0.56, wetZone * 0.78 );
float algaeBand = smoothstep( -0.65, 0.05, aboveWater ) * ( 1.0 - smoothstep( 0.25, 1.15 + ( cOrganic - 0.5 ) * 0.65, aboveWater ) );
float algaeMask = smoothstep( 0.36, 0.66, algaeBand * ( 0.6 + cFine * 0.7 ) );
diffuseColor.rgb = mix( diffuseColor.rgb, cMossDark * 0.85, algaeMask * 0.82 );

// 2. Vertical wall dampness & creeping moss tongues rising from lower plinths/seams
float wallFactor = 1.0 - smoothstep( 0.45, 0.78, abs( vConcWorldNormal.y ) );
float localBottom = 1.0 - smoothstep( -1.1, 0.45 + ( cMed - 0.5 ) * 0.85, vConcLocalPos.y );
diffuseColor.rgb = mix( diffuseColor.rgb, cDampCol, localBottom * wallFactor * uGrimeStrength * 0.85 );

float climbReach = smoothstep( 0.42, 0.78, cMacro * 0.6 + rainStreak * 0.4 );
float wallMossRaw = max( localBottom * 0.85, climbReach * 0.48 ) * wallFactor;
float wallMoss = smoothstep( 0.34, 0.64, wallMossRaw * ( 0.55 + cOrganic * 0.9 ) ) * uWallMoss;
vec3 mossBlend = mix( cMossDark, cMossBright, cFine );
diffuseColor.rgb = mix( diffuseColor.rgb, mossBlend, wallMoss );

// 3. Upward horizontal ledges/ruin roofs: weathered moss & patchy turf
float topFactor = smoothstep( 0.70, 0.92, vConcWorldNormal.y );
float roofMask = smoothstep( 0.44, 0.72, cOrganic ) * topFactor * uRoofMoss;
diffuseColor.rgb = mix( diffuseColor.rgb, mix( cTurfCol, cMossBright, cFine * 0.6 ), roofMask );

// 3b. Analytic pixel-footprint formwork course lines & expansion seams on building walls (zero moire)
float concSeamMask = 0.0;
if ( uWallJointStrength > 0.01 ) {
  vec3 cAbsN = abs( normalize( vConcWorldNormal ) );
  float wallAxis = cAbsN.x > cAbsN.z ? vConcWorldPos.z : vConcWorldPos.x;
  float fwY = max( fwidth( vConcWorldPos.y ), 1e-4 );
  float fwH = max( fwidth( wallAxis ), 1e-4 );
  float courseH = s7PeriodicLine( vConcWorldPos.y, 1.85, 0.028, fwY );
  float panelV = s7PeriodicLine( wallAxis, 3.70, 0.026, fwH );
  float wallJoint = max( courseH * 0.92, panelV * 0.68 ) * wallFactor;
  float roofJoint = s7GridJointMask( vConcWorldPos.xz, vec2( 4.2, 4.2 ), 0.032 ) * topFactor * 0.58;
  float mossCover = clamp( max( max( wallMoss, roofMask ), algaeMask * 0.8 ), 0.0, 1.0 );
  concSeamMask = clamp( max( wallJoint, roofJoint ) * uWallJointStrength * ( 1.0 - mossCover * 0.72 ), 0.0, 1.0 );
  diffuseColor.rgb *= mix( 1.0, 0.66, concSeamMask );
}

// 4. Overhead dropship flyby SDF shadow across roofs, bridge decks & concrete aprons
float concFlyby = sampleFlybyShipShadow( vConcWorldPos ) * mix( 0.45, 1.0, smoothstep( 0.15, 0.75, vConcWorldNormal.y ) );
diffuseColor.rgb *= ( 1.0 - concFlyby );

// 5. Procedural foundation/waterline seam occlusion + heightmap canyon skyVis & hybrid far shadow
float s7SkyVis = s7SampleCanyonSkyVis( vConcWorldPos );
float s7BakedFarShadow = s7SampleBakedFarShadow( vConcWorldPos );
float s7CascadeFade = s7ComputeCascadeFade( vConcWorldPos );
float s7CustomAO = clamp( ( 1.0 - localBottom * wallFactor * uGrimeStrength * 0.42 - wetZone * 0.18 - concSeamMask * 0.24 ) * s7SkyVis, 0.26, 1.0 );`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
if ( uWaterBounceMask > 0.01 && vConcWorldPos.y > uWaterLevel - 2.65 && vConcWorldPos.y < uWaterLevel + 2.75 ) {
  vec3 concN = normalize( vConcWorldNormal );
  vec2 concFoot = fwidth( vConcWorldPos.xz );
  float concPx = max( concFoot.x, concFoot.y );
  float concCamDist = length( vViewPosition );
  vec3 concWallBounce = s7ComputeWallBounceCaustics( vConcWorldPos, concN, uWaterBounceMask, concCamDist, concPx );
  vec3 concSubCaust = s7ComputeUnderwaterCaustics( vConcWorldPos, concN, uWaterBounceMask, concCamDist, concPx );
  reflectedLight.indirectDiffuse += diffuseColor.rgb * ( concWallBounce + concSubCaust );
}`,
      );
  };

  materialCache.set(key, mat);
  return mat;
}
