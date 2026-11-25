import * as THREE from 'three';
import type { LightingPreset } from '../map/sectors';
import {
  CANYON_HORIZON_PRESETS,
  INTERIOR_WINDOW_PRESETS,
  SPECULAR_AA_CONFIG,
} from './visualPolishMath';

let specularAaPatched = false;
let cachedInteriorWindowMaterial: THREE.MeshStandardMaterial | null = null;

/**
 * Shared live Float32Array(4) uniform buffers synchronizing Interior Mapping window
 * lighting across all Citadel, Factory, Derrick, and Airfield static batches with
 * zero per-frame allocations and zero shader recompilations on lighting preset toggle.
 *
 * - `interiorAmberBuffer`: [amberLinR, amberLinG, amberLinB, glowScale]
 * - `interiorCyanBuffer`:  [cyanLinR,  cyanLinG,  cyanLinB,  glassRoughness]
 */
const interiorAmberBuffer = new Float32Array([1.0, 0.52, 0.16, 1.08]);
const interiorCyanBuffer = new Float32Array([0.12, 0.82, 1.0, 0.14]);

export const INTERIOR_WINDOW_UNIFORMS = {
  uInteriorAmber: { value: interiorAmberBuffer },
  uInteriorCyan: { value: interiorCyanBuffer },
};

export function syncInteriorWindowParams(lightingPreset: LightingPreset): void {
  const cfg = INTERIOR_WINDOW_PRESETS[lightingPreset];
  interiorAmberBuffer[0] = cfg.amberLinearRgb[0];
  interiorAmberBuffer[1] = cfg.amberLinearRgb[1];
  interiorAmberBuffer[2] = cfg.amberLinearRgb[2];
  interiorAmberBuffer[3] = cfg.glowScale;

  interiorCyanBuffer[0] = cfg.cyanLinearRgb[0];
  interiorCyanBuffer[1] = cfg.cyanLinearRgb[1];
  interiorCyanBuffer[2] = cfg.cyanLinearRgb[2];
  interiorCyanBuffer[3] = cfg.glassRoughness;
}

// Initialize default dusk buffers immediately at module load
syncInteriorWindowParams('dusk');

/**
 * Globally upgrades Three.js physical/standard PBR materials (`lights_physical_fragment`)
 * with Atlantis-style perturbed-normal curvature Specular Anti-Aliasing.
 *
 * Unlike Three.js's built-in `nonPerturbedNormal` geometryRoughness, this inspects screen-space
 * derivatives of the final perturbed `normal` so bump maps, corrugated factory cladding,
 * bridge trusses, mech armor creases, and wet rock facets stop shimmering on camera motion.
 *
 * Materials with specialized water AA (`RiverWater`) opt out via `#define S7_SKIP_GLOBAL_SPECULAR_AA`.
 */
export function installGlobalSpecularAaShader(): void {
  if (specularAaPatched) return;
  specularAaPatched = true;

  const anchor = 'material.roughness = min( material.roughness, 1.0 );';
  if (!THREE.ShaderChunk.lights_physical_fragment.includes(anchor)) return;

  THREE.ShaderChunk.lights_physical_fragment =
    THREE.ShaderChunk.lights_physical_fragment.replace(
      anchor,
      `${anchor}
#ifndef S7_SKIP_GLOBAL_SPECULAR_AA
  vec3 s7SpecDnx = dFdx( normal );
  vec3 s7SpecDny = dFdy( normal );
  float s7SpecKr = min( ${SPECULAR_AA_CONFIG.curvatureGain.toFixed(2)} * ( dot( s7SpecDnx, s7SpecDnx ) + dot( s7SpecDny, s7SpecDny ) ), ${SPECULAR_AA_CONFIG.maxVariance.toFixed(2)} );
  material.roughness = min( 1.0, sqrt( material.roughness * material.roughness + s7SpecKr ) );
#endif`,
    );

  const ccAnchor = 'material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );';
  if (THREE.ShaderChunk.lights_physical_fragment.includes(ccAnchor)) {
    THREE.ShaderChunk.lights_physical_fragment =
      THREE.ShaderChunk.lights_physical_fragment.replace(
        ccAnchor,
        `${ccAnchor}
#ifndef S7_SKIP_GLOBAL_SPECULAR_AA
  material.clearcoatRoughness = min( 1.0, sqrt( material.clearcoatRoughness * material.clearcoatRoughness + s7SpecKr * ${SPECULAR_AA_CONFIG.clearcoatScale.toFixed(2)} ) );
#endif`,
      );
  }
}

/**
 * Returns the shared static-batchable Interior Mapping window material.
 * Analytically ray-traces a 3D tactical room behind every glass pane in world space
 * (warm industrial amber posts, cyan radar/console rooms, blinds, steel mullions, and
 * Fresnel canyon/sky reflections) with zero extra room geometry and zero extra draw calls
 * inside `StaticStructure` zones.
 */
export function getInteriorWindowMaterial(): THREE.MeshStandardMaterial {
  if (cachedInteriorWindowMaterial) return cachedInteriorWindowMaterial;

  const mat = new THREE.MeshStandardMaterial({
    color: '#101820',
    roughness: 0.14,
    metalness: 0.18,
    envMapIntensity: 1.35,
  });

  // Allow StaticStructure spatial batching to merge all window bands sharing this material
  mat.userData.staticBatchable = true;
  mat.customProgramCacheKey = () => 'sector7-interior-window-v1';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInteriorAmber = INTERIOR_WINDOW_UNIFORMS.uInteriorAmber;
    shader.uniforms.uInteriorCyan = INTERIOR_WINDOW_UNIFORMS.uInteriorCyan;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWinWorldPos;
varying vec3 vWinWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 s7WinWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  s7WinWp = instanceMatrix * s7WinWp;
#endif
s7WinWp = modelMatrix * s7WinWp;
vWinWorldPos = s7WinWp.xyz;
#ifdef USE_INSTANCING
  vWinWorldNormal = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * objectNormal );
#else
  vWinWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec4 uInteriorAmber;
uniform vec4 uInteriorCyan;
varying vec3 vWinWorldPos;
varying vec3 vWinWorldNormal;

float s7WinHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
vec3 s7WinN0 = normalize( vWinWorldNormal );
float s7WinIsFrame = smoothstep( 0.68, 0.82, abs( s7WinN0.y ) );
roughnessFactor = mix( uInteriorCyan.w, 0.64, s7WinIsFrame );`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 s7WinN = normalize( vWinWorldNormal );
float s7WinCap = smoothstep( 0.68, 0.82, abs( s7WinN.y ) );
vec3 s7WinInteriorGlow = vec3( 0.0 );
float s7WinMullion = 0.0;

if ( s7WinCap < 0.99 ) {
  vec3 s7WinT = normalize( cross( vec3( 0.0, 1.0, 0.0 ), s7WinN ) );
  vec3 s7WinB = normalize( cross( s7WinN, s7WinT ) );
  vec3 s7WinE = normalize( vWinWorldPos - cameraPosition );
  float s7WinEz = max( -dot( s7WinE, s7WinN ), 0.18 );

  // World-space architectural bay grid (1.85 m wide x 1.25 m tall tactical panes)
  float s7WallU = dot( vWinWorldPos, s7WinT ) / 1.85;
  float s7WallV = vWinWorldPos.y / 1.25;
  vec2 s7Cell = floor( vec2( s7WallU, s7WallV ) );
  vec2 s7PaneUv = fract( vec2( s7WallU, s7WallV ) );

  // Anti-aliased steel window mullions between adjacent bays
  float s7EdgeDist = min( s7PaneUv.x, 1.0 - s7PaneUv.x );
  float s7EdgeFw = max( fwidth( s7WallU ), 0.004 );
  s7WinMullion = 1.0 - smoothstep( 0.045, 0.045 + s7EdgeFw * 1.4, s7EdgeDist );

  // Analytic 3D room box ray-trace in the pane's world tangent frame
  vec2 s7Slope = vec2( dot( s7WinE, s7WinT ) * 1.35, dot( s7WinE, s7WinB ) * 1.05 ) / s7WinEz;
  float s7T = 1.0;
  int s7Side = 0; // 0 = back wall, 1 = side wall, 2 = floor/ceiling
  if ( abs( s7Slope.x ) > 0.0001 ) {
    float ts = ( ( s7Slope.x > 0.0 ? 1.0 : 0.0 ) - s7PaneUv.x ) / s7Slope.x;
    if ( ts >= 0.0 && ts < s7T ) {
      s7T = ts;
      s7Side = 1;
    }
  }
  if ( abs( s7Slope.y ) > 0.0001 ) {
    float tf = ( ( s7Slope.y > 0.0 ? 1.0 : 0.0 ) - s7PaneUv.y ) / s7Slope.y;
    if ( tf >= 0.0 && tf < s7T ) {
      s7T = tf;
      s7Side = 2;
    }
  }
  vec2 s7Q = clamp( s7PaneUv + s7Slope * s7T, 0.0, 1.0 );

  // Deterministic room seed per bay and facade orientation
  float s7Seed = s7WinHash( s7Cell + floor( vWinWorldPos.xz * 0.16 ) * 1.37 + s7WinN.xz * 5.7 );
  float s7Seed2 = fract( s7Seed * 13.37 + 0.29 );

  // Room palette: warm industrial amber (~56%), cyan tactical ops (~28%), dim standby (~16%)
  vec3 s7RoomTint = uInteriorAmber.rgb;
  float s7RoomLit = 0.85 + 0.35 * s7Seed2;
  bool s7IsCyan = ( s7Seed >= 0.56 && s7Seed < 0.84 );
  bool s7IsDim = ( s7Seed >= 0.84 );
  if ( s7IsCyan ) {
    s7RoomTint = uInteriorCyan.rgb;
    s7RoomLit = 0.78 + 0.36 * s7Seed2;
  } else if ( s7IsDim ) {
    s7RoomTint = mix( uInteriorAmber.rgb, uInteriorCyan.rgb, 0.5 ) * 0.22;
    s7RoomLit = 0.35;
  }

  // Interior room shading: darker upper corners, brighter floor, bulkhead & console silhouettes
  vec3 s7RoomCol = s7RoomTint * ( 0.42 + 0.58 * ( 1.0 - s7Q.y * 0.55 ) ) * s7RoomLit;
  if ( s7Side == 1 ) {
    s7RoomCol *= 0.62;
  } else if ( s7Side == 2 ) {
    s7RoomCol *= ( s7Slope.y < 0.0 ) ? ( 1.05 - 0.35 * s7T ) : 0.34;
  } else {
    // Back wall architectural ribs & tactical monitor / doorway accents
    float s7Rib = smoothstep( 0.42, 0.50, abs( fract( s7Q.x * 3.0 ) - 0.5 ) );
    s7RoomCol *= ( 1.0 - s7Rib * 0.28 );
    vec2 s7Monitor = abs( s7Q - vec2( 0.28 + 0.44 * s7Seed2, 0.52 ) );
    if ( s7Monitor.x < 0.20 && s7Monitor.y < 0.15 ) {
      vec3 s7ScreenCol = s7IsCyan ? ( uInteriorCyan.rgb * 1.95 ) : mix( uInteriorCyan.rgb * 1.35, uInteriorAmber.rgb * 1.55, s7Seed2 );
      s7RoomCol = mix( s7RoomCol, s7ScreenCol, 0.82 );
    }
    // Overhead fluorescent / industrial fixture bar on upper back wall
    if ( s7Q.y > 0.82 && abs( s7Q.x - 0.5 ) < 0.34 && !s7IsDim ) {
      s7RoomCol *= 1.45;
    }
  }

  // Depth falloff inside the room
  s7RoomCol *= ( 1.0 - 0.46 * s7T );

  // Half-drawn louvered blinds / blast shutters on ~48% of windows (anti-aliased via fwidth)
  if ( s7Seed > 0.52 ) {
    float s7BlindDrop = 0.24 + 0.30 * fract( s7Seed * 7.13 );
    float s7BlindFw = max( fwidth( s7WallV ), 0.004 );
    float s7BlindMask = smoothstep( 1.0 - s7BlindDrop - s7BlindFw, 1.0 - s7BlindDrop + s7BlindFw, s7PaneUv.y );
    float s7Slat = 0.72 + 0.28 * sin( s7PaneUv.y * 42.0 );
    float s7SlatFade = 1.0 - smoothstep( 0.08, 0.24, s7BlindFw );
    vec3 s7BlindCol = vec3( 0.045, 0.055, 0.068 ) * mix( 0.85, s7Slat, s7SlatFade );
    s7RoomCol = mix( s7RoomCol, s7BlindCol, s7BlindMask * 0.86 );
  }

  // Exterior Fresnel glass reflection reduces interior transmission at grazing angles
  float s7NoV = max( dot( -s7WinE, s7WinN ), 0.0 );
  float s7GlassFresnel = 0.08 + 0.92 * pow( 1.0 - s7NoV, 4.0 );
  float s7GlassMask = ( 1.0 - s7WinMullion ) * ( 1.0 - s7WinCap );

  s7WinInteriorGlow = s7RoomCol * uInteriorAmber.w * ( 1.0 - s7GlassFresnel * 0.72 ) * s7GlassMask;
  vec3 s7FrameCol = vec3( 0.055, 0.065, 0.075 );
  vec3 s7DarkGlassCol = vec3( 0.018, 0.028, 0.036 );
  diffuseColor.rgb = mix( s7DarkGlassCol, s7FrameCol, max( s7WinMullion, s7WinCap ) );
} else {
  diffuseColor.rgb = vec3( 0.055, 0.065, 0.075 );
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += s7WinInteriorGlow;`,
      );
  };

  cachedInteriorWindowMaterial = mat;
  return mat;
}

/**
 * Builds a lightweight procedural canyon-ridge & pine-slope horizon band mesh
 * baked once into the offscreen PMREM environment scene in `ProceduralSky`.
 * Gives rivers, wet rock, glass windows, and mech armor authentic mountain-ring
 * reflections near and below the horizon with 0.00 ms per-frame runtime cost.
 */
export function createCanyonHorizonBandMesh(
  lightingPreset: LightingPreset,
): { mesh: THREE.Mesh; dispose: () => void } {
  const cfg = CANYON_HORIZON_PRESETS[lightingPreset];
  const geo = new THREE.CylinderGeometry(420, 420, 320, 64, 1, true);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRidgeCol: { value: new THREE.Color(cfg.ridgeColor) },
      uPineCol: { value: new THREE.Color(cfg.pineColor) },
      uValleyCol: { value: new THREE.Color(cfg.valleyColor) },
      uRimCol: { value: new THREE.Color(cfg.rimHighlight) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vDir = normalize( wp.xyz );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uRidgeCol;
      uniform vec3 uPineCol;
      uniform vec3 uValleyCol;
      uniform vec3 uRimCol;
      varying vec3 vDir;

      void main() {
        float az = atan( vDir.z, vDir.x );
        // Multi-harmonic mountain skyline around Sector 7 canyon ring
        float ridge = 0.075
          + 0.055 * sin( az * 3.0 + 0.6 )
          + 0.036 * sin( az * 7.0 - 1.2 )
          + 0.022 * cos( az * 13.0 + 2.1 )
          + 0.012 * sin( az * 23.0 - 0.5 );
        // Lower river gorge passes on WNW and ESE axes
        float gorgePass = exp( -pow( sin( az - 0.42 ), 2.0 ) * 14.0 );
        float skylineY = ridge * ( 1.0 - gorgePass * 0.52 );

        float mask = 1.0 - smoothstep( skylineY - 0.014, skylineY + 0.014, vDir.y );
        if ( mask <= 0.002 ) discard;

        // Alpine pine belt on lower slopes -> rocky crest -> subtle sunlit rim
        float pineBand = smoothstep( -0.10, 0.04, vDir.y ) * ( 1.0 - smoothstep( skylineY * 0.55, skylineY * 0.92, vDir.y ) );
        float rimBand = smoothstep( skylineY - 0.045, skylineY, vDir.y );
        float lowerMix = 1.0 - smoothstep( -0.22, -0.02, vDir.y );

        vec3 col = mix( uRidgeCol, uPineCol, pineBand * 0.72 );
        col = mix( col, uValleyCol, lowerMix * 0.75 );
        col = mix( col, uRimCol, rimBand * 0.34 );

        gl_FragColor = vec4( col, mask );
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 18;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
