import * as THREE from 'three';

/**
 * Shared live uniform references injected into terrain, concrete, and river shaders.
 * Updating `.value` once per frame in DropshipFlyby drives all receiving materials with 0 allocations.
 */
export const FLYBY_SHADOW_UNIFORMS = {
  uFlybyShipPos: { value: new THREE.Vector2(0, 0) },
  uFlybyShipYaw: { value: 0 },
  uFlybyShadowStrength: { value: 0 },
};

export const GLSL_FLYBY_SHADOW_PARS = /* glsl */ `
uniform vec2 uFlybyShipPos;
uniform float uFlybyShipYaw;
uniform float uFlybyShadowStrength;

float sampleFlybyShipShadow( vec3 worldPos ) {
  if ( uFlybyShadowStrength <= 0.001 ) return 0.0;
  vec2 rel = worldPos.xz - uFlybyShipPos;
  float c = cos( uFlybyShipYaw );
  float s = sin( uFlybyShipYaw );
  // Rotate world offset into dropship local XZ (local.x = wingspan, local.y = nose-tail along +Z)
  vec2 local = vec2( rel.x * c - rel.y * s, rel.x * s + rel.y * c );
  if ( abs( local.x ) > 24.0 || abs( local.y ) > 28.0 ) return 0.0;

  float hullDist = length( local / vec2( 4.6, 17.5 ) );
  float wingDist = length( ( local - vec2( 0.0, -2.0 ) ) / vec2( 15.5, 5.8 ) );
  float shipShape = min( hullDist, wingDist );
  float mask = 1.0 - smoothstep( 0.58, 1.14, shipShape );
  return mask * uFlybyShadowStrength;
}
`;

export function bindFlybyShadowUniforms(uniforms: Record<string, THREE.IUniform>): void {
  uniforms.uFlybyShipPos = FLYBY_SHADOW_UNIFORMS.uFlybyShipPos;
  uniforms.uFlybyShipYaw = FLYBY_SHADOW_UNIFORMS.uFlybyShipYaw;
  uniforms.uFlybyShadowStrength = FLYBY_SHADOW_UNIFORMS.uFlybyShadowStrength;
}
