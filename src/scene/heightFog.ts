import * as THREE from 'three';
import type { LightingPreset } from '../map/sectors';
import { FOG_SCATTER_PRESETS } from './atmosphereToneMapping';

let patched = false;

/**
 * Shared Float32Array(4) uniform buffers referenced directly by `THREE.UniformsLib.fog`.
 * Because Three.js `UniformsUtils.cloneUniforms` clones Vector/Color objects and copies plain
 * Arrays but preserves TypedArray references, every fog-enabled material in the scene
 * automatically reads live updates from these two buffers with zero scene traversal or shader
 * recompilation when switching lighting presets.
 *
 * - `fogSunDirPower`: [sunDir.x, sunDir.y, sunDir.z, tightMiePower]
 * - `fogSunColorStrength`: [linearR, linearG, linearB, scatterStrength]
 */
const fogSunDirPowerBuffer = new Float32Array([0.386, 0.372, -0.844, 5.5]);
const fogSunColorStrengthBuffer = new Float32Array([0.74, 0.28, 0.1, 0.62]);
const fogNearSkyColorStrengthBuffer = new Float32Array([0.11, 0.19, 0.32, 0.56]);
const _scratchColor = new THREE.Color();

/**
 * Updates the shared height-fog solar in-scattering and two-stage aerial perspective
 * uniforms in place for the active lighting preset and sun direction.
 * Zero allocations, zero material recompiles.
 */
export function syncHeightFogScatter(
  preset: LightingPreset,
  sunPos?: readonly [number, number, number],
): void {
  const cfg = FOG_SCATTER_PRESETS[preset];
  const pos = sunPos ?? cfg.defaultSunPos;
  const len = Math.hypot(pos[0], pos[1], pos[2]);
  if (len > 1e-5) {
    fogSunDirPowerBuffer[0] = pos[0] / len;
    fogSunDirPowerBuffer[1] = pos[1] / len;
    fogSunDirPowerBuffer[2] = pos[2] / len;
  } else {
    fogSunDirPowerBuffer[0] = 0.0;
    fogSunDirPowerBuffer[1] = 1.0;
    fogSunDirPowerBuffer[2] = 0.0;
  }
  fogSunDirPowerBuffer[3] = cfg.power;

  _scratchColor.set(cfg.sunColorHex);
  fogSunColorStrengthBuffer[0] = _scratchColor.r;
  fogSunColorStrengthBuffer[1] = _scratchColor.g;
  fogSunColorStrengthBuffer[2] = _scratchColor.b;
  fogSunColorStrengthBuffer[3] = cfg.strength;

  _scratchColor.set(cfg.nearSkyColorHex);
  fogNearSkyColorStrengthBuffer[0] = _scratchColor.r;
  fogNearSkyColorStrengthBuffer[1] = _scratchColor.g;
  fogNearSkyColorStrengthBuffer[2] = _scratchColor.b;
  fogNearSkyColorStrengthBuffer[3] = cfg.nearSkyStrength;
}

// Initialize default dusk buffers immediately at module load
syncHeightFogScatter('dusk');

/**
 * Replaces Three.js uniform distance fog with physically-inspired exponential
 * Height Fog + two-stage aerial perspective (open-sky blue in near/mid canyon gorge
 * transitioning to horizon fog color at distance, per Atlantis `sh_light.js:47-58`)
 * + directional dual-lobe Mie solar in-scattering.
 */
export function installHeightFogShader(): void {
  if (patched) return;
  patched = true;

  const fogLib = THREE.UniformsLib.fog as Record<string, { value: unknown }>;
  fogLib.fogSunDirPower = { value: fogSunDirPowerBuffer };
  fogLib.fogSunColorStrength = { value: fogSunColorStrengthBuffer };
  fogLib.fogNearSkyColorStrength = { value: fogNearSkyColorStrengthBuffer };

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG

  varying float vFogDepth;
  varying vec3 vFogWorldPos;

#endif
`;

  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG

  vFogDepth = - mvPosition.z;
  vec3 fogViewDiff = mvPosition.xyz - viewMatrix[ 3 ].xyz;
  vFogWorldPos = vec3(
    dot( viewMatrix[ 0 ].xyz, fogViewDiff ),
    dot( viewMatrix[ 1 ].xyz, fogViewDiff ),
    dot( viewMatrix[ 2 ].xyz, fogViewDiff )
  );

#endif
`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG

  uniform vec3 fogColor;
  uniform vec4 fogSunDirPower;
  uniform vec4 fogSunColorStrength;
  uniform vec4 fogNearSkyColorStrength;
  varying float vFogDepth;
  varying vec3 vFogWorldPos;

  #ifdef FOG_EXP2

    uniform float fogDensity;

  #else

    uniform float fogNear;
    uniform float fogFar;

  #endif

#endif
`;

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG

  #ifdef FOG_EXP2

    // Exponential height fog anchored to the river canyon floor (y = -1.8)
    float hFogBaseY = -1.8;
    float hFogFalloff = 0.21;
    float h0 = cameraPosition.y - hFogBaseY;
    float h1 = vFogWorldPos.y - hFogBaseY;
    float dh = vFogWorldPos.y - cameraPosition.y;

    float avgHeightDensity;
    if ( abs( dh ) > 0.001 ) {
      avgHeightDensity = ( exp( -hFogFalloff * h0 ) - exp( -hFogFalloff * h1 ) ) / ( hFogFalloff * dh );
    } else {
      avgHeightDensity = exp( -hFogFalloff * h1 );
    }
    avgHeightDensity = clamp( avgHeightDensity, 0.0, 1.35 );

    // Fade in smoothly past near foreground so close-up water & props stay sharp
    float distScale = smoothstep( 25.0, 145.0, vFogDepth );
    float opticalDepth = ( fogDensity * 26.0 ) * vFogDepth * avgHeightDensity * distScale;
    float canyonFog = clamp( 1.0 - exp( -opticalDepth ), 0.0, 0.56 );

    // Gentle distance aerial perspective (> 175 units) separating central base from distant ridges
    float aerialDist = max( 0.0, vFogDepth - 175.0 );
    float aerialRate = max( 0.00058, fogDensity * 1.15 );
    float aerialFog = clamp( ( 1.0 - exp( -aerialRate * aerialDist ) ) * 0.85, 0.0, 0.30 );

    // Subtle outer-perimeter blend (> 435 units) so far mountain skirt meets sky cleanly
    float radialDist = length( vFogWorldPos.xz );
    float outerHorizonFade = smoothstep( 435.0, 565.0, radialDist ) * 0.42;

    float fogFactor = clamp( max( max( canyonFog, outerHorizonFade ), aerialFog ), 0.0, 0.68 );

  #else

    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );

  #endif

  // Two-stage aerial perspective (Atlantis sh_light.js:47-58):
  // Near haze is open-sky blue for mid-ground canyon depth separation; far haze dissolves into horizon fogColor
  float fogHorizonBlend = smoothstep( 55.0, 340.0, vFogDepth );
  float fogCanyonFloorBoost = 1.0 - 0.22 * smoothstep( 18.0, 110.0, max( 0.0, vFogWorldPos.y ) );
  float fogNearSkyWeight = clamp( ( 1.0 - fogHorizonBlend ) * fogNearSkyColorStrength.w * fogCanyonFloorBoost, 0.0, 1.0 );
  vec3 baseAerialColor = mix( fogColor, fogNearSkyColorStrength.rgb, fogNearSkyWeight );

  // Directional dual-lobe Mie solar in-scattering in height fog
  vec3 fogViewRay = vFogWorldPos - cameraPosition;
  float fogViewLen = max( length( fogViewRay ), 0.0001 );
  vec3 fogViewDir = fogViewRay / fogViewLen;
  float fogSunCos = clamp( dot( fogViewDir, fogSunDirPower.xyz ), 0.0, 1.0 );
  float fogMieBroad = pow( fogSunCos, 2.2 ) * 0.36;
  float fogMieTight = pow( fogSunCos, max( 1.0, fogSunDirPower.w ) ) * 0.64;
  float fogScatterPhase = clamp( fogMieBroad + fogMieTight, 0.0, 1.0 );
  float fogDepthGate = smoothstep( 0.03, 0.44, fogFactor );
  float fogHorizonLift = 1.0 - 0.25 * smoothstep( 28.0, 140.0, max( 0.0, vFogWorldPos.y ) );
  float fogScatterWeight = clamp(
    fogScatterPhase * fogSunColorStrength.w * fogDepthGate * fogHorizonLift,
    0.0,
    0.82
  );
  vec3 effectiveFogColor = mix( baseAerialColor, fogSunColorStrength.rgb, fogScatterWeight );

  gl_FragColor.rgb = mix( gl_FragColor.rgb, effectiveFogColor, fogFactor );

#endif
`;
}
