import * as THREE from 'three';

let patched = false;

/**
 * Replaces Three.js uniform distance fog with physically-inspired exponential
 * Height Fog so atmospheric haze pools inside the river gorge (~y <= 4) while
 * leaving high sunlit ridges, mountain peaks, and the Citadel crisp and clear.
 */
export function installHeightFogShader(): void {
  if (patched) return;
  patched = true;

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

  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );

#endif
`;
}
