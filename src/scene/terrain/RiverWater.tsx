import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WATER_LEVEL } from '../../map/terrainMath';
import {
  MAX_OBSTACLE_DIST,
  MAX_WATER_DEPTH,
  WATER_SPAN_D,
  WATER_SPAN_W,
} from '../../map/waterDepth';
import { createWaterNormalTexture } from '../textures';
import {
  GLSL_FLYBY_SHADOW_PARS,
  bindFlybyShadowUniforms,
} from '../flybyShadow';

import { WORLD_MAP_WIDTH as DEPTH_TEX_W, WORLD_MAP_HEIGHT as DEPTH_TEX_H } from '../../map/worldMapDimensions';
import { WATER_AA_CONFIG, buildWaterAntiAliasingGlsl } from './waterAntiAliasing';

export interface RiverWaterProps {
  data: Uint8Array<ArrayBuffer>;
  isSoftwareGl: boolean;
  visible?: boolean;
}

export function RiverWater({ isSoftwareGl, data, visible = true }: RiverWaterProps) {
  const { gl, scene, camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const waterNormal = useMemo(() => createWaterNormalTexture(maxAniso), [maxAniso]);
  const normalScale = useMemo(() => new THREE.Vector2(0.75, 0.75), []);
  const clearcoatNormalScale = useMemo(() => new THREE.Vector2(0.55, 0.55), []);
  const timeUniformRef = useRef({ value: 1.2 });

  const waterDepthTex = useMemo(() => {
    const tex = new THREE.DataTexture(
      data,
      DEPTH_TEX_W,
      DEPTH_TEX_H,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = false;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [data]);

  const waterMaterial = useMemo(() => {
    const aaGlsl = buildWaterAntiAliasingGlsl();
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#0C2232',
      roughness: 0.08,
      metalness: 0.06,
      ior: 1.333,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      clearcoatNormalMap: waterNormal,
      clearcoatNormalScale,
      envMapIntensity: 1.6,
      normalMap: waterNormal,
      normalScale,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    mat.customProgramCacheKey = () => 'sector7-shoreline-water-v3';

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterDepthMap = { value: waterDepthTex };
      shader.uniforms.uWaterSpan = {
        value: new THREE.Vector2(WATER_SPAN_W, WATER_SPAN_D),
      };
      shader.uniforms.uMaxWaterDepth = { value: MAX_WATER_DEPTH };
      shader.uniforms.uMaxObstDist = { value: MAX_OBSTACLE_DIST };
      shader.uniforms.uWaterTime = timeUniformRef.current;
      bindFlybyShadowUniforms(shader.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWaterWorldPos;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
vWaterWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uWaterDepthMap;
uniform vec2 uWaterSpan;
uniform float uMaxWaterDepth;
uniform float uMaxObstDist;
uniform float uWaterTime;
varying vec3 vWaterWorldPos;
${GLSL_FLYBY_SHADOW_PARS}

float waterHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float waterNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  float a = waterHash( i );
  float b = waterHash( i + vec2( 1.0, 0.0 ) );
  float c = waterHash( i + vec2( 0.0, 1.0 ) );
  float d = waterHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

float waterFbm( vec2 p ) {
  float v = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 2; i++ ) {
    v += a * waterNoise( p );
    p *= 2.07;
    a *= 0.5;
  }
  return v / 0.75;
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
${aaGlsl.footprintAndNyquist}
vec2 wDepthUv = vWaterWorldPos.xz / uWaterSpan + 0.5;
vec2 wDepthSample = texture2D( uWaterDepthMap, clamp( wDepthUv, 0.001, 0.999 ) ).rg;
float wDepth = wDepthSample.r * uMaxWaterDepth;
float wObstDist = wDepthSample.g * uMaxObstDist;
float wDepthMeters = wDepth * 3.75;

// Beer-Lambert shallow turquoise transition revealing submerged riverbed pebbles & sandy shoal ramps
float wShallowT = exp( -wDepthMeters * 0.44 );
vec3 wDeepCol = pow( vec3( 0.047, 0.133, 0.196 ), vec3( 2.2 ) );
vec3 wMidCol = pow( vec3( 0.095, 0.305, 0.375 ), vec3( 2.2 ) );
vec3 wShallowCol = pow( vec3( 0.215, 0.515, 0.525 ), vec3( 2.2 ) );
vec3 wBaseCol = mix( wDeepCol, mix( wMidCol, wShallowCol, wShallowT ), smoothstep( 0.0, 0.92, wShallowT ) );

// Organic lacy shoreline & bridge-pier surf foam broken up by 2D quintic FBM (Nyquist-filtered at distance)
float wFbm = waterFbm( vWaterWorldPos.xz * 0.48 + vec2( uWaterTime * 0.045, -uWaterTime * 0.032 ) );
float wMicroRaw = waterNoise( vWaterWorldPos.xz * 2.15 - vec2( uWaterTime * 0.11, uWaterTime * 0.09 ) );
float wMicro = mix( 0.5, wMicroRaw, wMicroWeight );
float wLace = smoothstep( 0.32, 0.72, wFbm * 0.66 + wMicro * 0.34 );

// 1. Shoreline lapping edge & shallow surf wavelets (~0..1.8 m depth)
float wShoreBand = 1.0 - smoothstep( 0.03, 0.46 + wFbm * 0.20, wDepth );
float wWavePhase = wDepth * 16.0 - uWaterTime * 2.2 + wFbm * 5.6;
float wSurfWave = pow( max( 0.0, sin( wWavePhase ) ), 3.0 ) * ( 1.0 - smoothstep( 0.08, 0.54, wDepth ) ) * wSurfWeight;
float wEdgeCrisp = ( 1.0 - smoothstep( 0.015, 0.13, wDepth ) ) * ( 0.54 + 0.46 * wLace );
float wShoreFoam = max( wEdgeCrisp, wShoreBand * wLace * 0.72 + wSurfWave * wLace * 0.52 );

// 2. Bridge pier, quay caisson & moored river barge wake collar (gated strictly inside water)
float wInWater = smoothstep( 0.04, 0.18, wDepth );
float wPierCollar = 1.0 - smoothstep( 0.04, 0.82 + wFbm * 0.34, wObstDist );
float wPierRipple = pow( max( 0.0, sin( wObstDist * 9.0 - uWaterTime * 2.4 + wFbm * 4.4 ) ), 3.0 ) * ( 1.0 - smoothstep( 0.22, 1.65, wObstDist ) ) * wSurfWeight;
float wPierFoam = ( wPierCollar * ( 0.58 + 0.42 * wLace ) + wPierRipple * 0.50 * wLace ) * wInWater;

float wFoam = clamp( max( wShoreFoam, wPierFoam ) * smoothstep( 0.005, 0.035, wDepth ), 0.0, 0.90 );
vec3 wFoamCol = pow( vec3( 0.87, 0.92, 0.94 ), vec3( 2.2 ) );

diffuseColor.rgb = mix( wBaseCol, wFoamCol, wFoam );
diffuseColor.rgb *= ( 1.0 - sampleFlybyShipShadow( vWaterWorldPos ) * 0.85 );
float wWaterAlpha = mix( 0.94, 0.24, pow( wShallowT, 1.35 ) );
float wEdgeFeather = smoothstep( 0.0, 0.035, wDepth );
diffuseColor.a = clamp( max( wWaterAlpha, wFoam * 0.92 ) * wEdgeFeather, 0.0, 0.97 );`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = mix( roughnessFactor, ${WATER_AA_CONFIG.foamRoughness.toFixed(2)}, wFoam );`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
${aaGlsl.normalCaptureAndDamp}`,
        )
        .replace(
          '#include <clearcoat_normal_fragment_maps>',
          `#include <clearcoat_normal_fragment_maps>
${aaGlsl.clearcoatNormalCaptureAndDamp}`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
${aaGlsl.applySpecularAa}`,
        );
    };

    return mat;
  }, [waterNormal, normalScale, clearcoatNormalScale, waterDepthTex]);

  useEffect(() => {
    return () => {
      waterMaterial.dispose();
      waterDepthTex.dispose();
      waterNormal.dispose();
    };
  }, [waterMaterial, waterDepthTex, waterNormal]);

  useEffect(() => {
    if (visible || !meshRef.current || !scene.environment || !gl.extensions.has('KHR_parallel_shader_compile')) return;
    // Compile against the live reflection map while the compact terrain still covers the river.
    void gl.compileAsync(meshRef.current, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('River shader warmup failed', error);
    });
  }, [visible, gl, camera, scene, waterMaterial]);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (isSoftwareGl || !visible) return;
    timeUniformRef.current.value += delta;
    waterNormal.offset.x = (waterNormal.offset.x + delta * 0.018) % 1;
    waterNormal.offset.y = (waterNormal.offset.y + delta * 0.012) % 1;
  });

  return (
    <mesh
      ref={meshRef}
      visible={visible}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, WATER_LEVEL, 0]}
      material={waterMaterial}
      receiveShadow
      renderOrder={2}
    >
      <planeGeometry args={[WATER_SPAN_W, WATER_SPAN_D, 1, 1]} />
    </mesh>
  );
}
