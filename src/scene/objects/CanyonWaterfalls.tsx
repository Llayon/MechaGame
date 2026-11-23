import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import { WATER_LEVEL } from '../../map/terrainMath';
import {
  buildBatchedSplashRingGeometry,
  buildBatchedWaterfallGeometry,
  discoverWaterfallSites,
  evaluateWaterfallPoint,
  getWaterfallRockSpecs,
} from '../../map/waterfalls';
import { createChiseledRockGeometry } from './rockGeometry';
import { createMistTexture } from '../textures';

export interface CanyonWaterfallsProps {
  visible: boolean;
  lightingPreset: LightingPreset;
  showMist: boolean;
  isSoftwareGl: boolean;
}

interface PresetWaterPalette {
  top: string;
  bottom: string;
  foam: string;
  rim: string;
  mist: string;
  mistOpacity: number;
}

const PRESET_PALETTES: Record<LightingPreset, PresetWaterPalette> = {
  day: {
    top: '#246E8F',
    bottom: '#4BAAC8',
    foam: '#E6F5FA',
    rim: '#A2E0F2',
    mist: '#DCEEF6',
    mistOpacity: 0.22,
  },
  dusk: {
    top: '#173E56',
    bottom: '#326A85',
    foam: '#CFC3BA',
    rim: '#C8926E',
    mist: '#B8A89E',
    mistOpacity: 0.2,
  },
  night: {
    top: '#0C2133',
    bottom: '#1A3E56',
    foam: '#7494AC',
    rim: '#4A6E8C',
    mist: '#567086',
    mistOpacity: 0.11,
  },
};

const _rockDummy = new THREE.Object3D();

const WATERFALL_NOISE_GLSL = /* glsl */ `
float wfHash21( vec2 p ) {
  p = mod( p, 289.0 );
  vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

float wfNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( wfHash21( i ), wfHash21( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( wfHash21( i + vec2( 0.0, 1.0 ) ), wfHash21( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}
`;

export function CanyonWaterfalls({
  visible,
  lightingPreset,
  showMist,
  isSoftwareGl,
}: CanyonWaterfallsProps) {
  const { gl, scene, camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const timeUniform = useRef({ value: 2.6 });
  const topColorUniform = useRef({ value: new THREE.Color(PRESET_PALETTES.dusk.top) });
  const bottomColorUniform = useRef({ value: new THREE.Color(PRESET_PALETTES.dusk.bottom) });
  const foamColorUniform = useRef({ value: new THREE.Color(PRESET_PALETTES.dusk.foam) });
  const rimColorUniform = useRef({ value: new THREE.Color(PRESET_PALETTES.dusk.rim) });
  const mistGroupRef = useRef<THREE.Group>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh>(null);

  const sites = useMemo(() => discoverWaterfallSites(4), []);
  const rockSpecs = useMemo(() => getWaterfallRockSpecs(sites), [sites]);
  const curtainGeo = useMemo(() => buildBatchedWaterfallGeometry(sites), [sites]);
  const splashGeo = useMemo(() => buildBatchedSplashRingGeometry(sites), [sites]);
  const rockGeo = useMemo(() => createChiseledRockGeometry(1), []);
  const mistTex = useMemo(() => createMistTexture(), []);

  const mistAnchors = useMemo(
    () =>
      sites.flatMap((site) => {
        const impact = evaluateWaterfallPoint(site, 0, 0.94);
        const sideX = -site.dirZ;
        const sideZ = site.dirX;
        return [
          {
            key: `${site.id}-mist-a`,
            x: impact.x - sideX * site.width * 0.24,
            y: WATER_LEVEL + 1.6,
            z: impact.z - sideZ * site.width * 0.24,
            baseScale: site.width * 1.12,
            phaseOffset: site.seed * 0.17,
            driftX: site.dirX * 1.6,
            driftZ: site.dirZ * 1.6,
          },
          {
            key: `${site.id}-mist-b`,
            x: impact.x + sideX * site.width * 0.24,
            y: WATER_LEVEL + 2.2,
            z: impact.z + sideZ * site.width * 0.24,
            baseScale: site.width * 1.28,
            phaseOffset: site.seed * 0.17 + 0.48,
            driftX: site.dirX * 2.1,
            driftZ: site.dirZ * 2.1,
          },
        ];
      }),
    [sites],
  );

  const { curtainMaterial, splashMaterial, rockMaterial } = useMemo(() => {
    const cMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    cMat.customProgramCacheKey = () => 'sector7-waterfall-curtain-v2';
    cMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWfTime = timeUniform.current;
      shader.uniforms.uWfTopColor = topColorUniform.current;
      shader.uniforms.uWfBottomColor = bottomColorUniform.current;
      shader.uniforms.uWfFoamColor = foamColorUniform.current;
      shader.uniforms.uWfRimColor = rimColorUniform.current;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aSeed;
attribute vec2 aFallScale;
varying vec2 vWfUv;
varying vec3 vWfNormalView;
varying vec3 vWfViewPos;
varying float vWfSeed;
varying vec2 vWfFallScale;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWfUv = uv;
vWfSeed = aSeed;
vWfFallScale = aFallScale;
vWfNormalView = normalize( normalMatrix * normal );
vec4 wfMv = modelViewMatrix * vec4( transformed, 1.0 );
vWfViewPos = -wfMv.xyz;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWfTime;
uniform vec3 uWfTopColor;
uniform vec3 uWfBottomColor;
uniform vec3 uWfFoamColor;
uniform vec3 uWfRimColor;
varying vec2 vWfUv;
varying vec3 vWfNormalView;
varying vec3 vWfViewPos;
varying float vWfSeed;
varying vec2 vWfFallScale;
${WATERFALL_NOISE_GLSL}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float widthScale = max( 0.85, vWfFallScale.x );
float heightScale = max( 0.85, vWfFallScale.y );

// Two parallax scrolling noise layers (major turbulent surges + fine spray streaks)
vec2 streakUv1 = vec2( vWfUv.x * 10.5 * widthScale + vWfSeed, vWfUv.y * 3.1 * heightScale + uWfTime * 1.55 );
vec2 streakUv2 = vec2( vWfUv.x * 20.0 * widthScale + 3.4 - vWfSeed * 0.5, vWfUv.y * 4.7 * heightScale + uWfTime * 1.02 );

float stream1 = wfNoise( streakUv1 );
float stream2 = wfNoise( streakUv2 );
float combinedStreams = stream1 * 0.6 + stream2 * 0.4;

// Crisp Horizon/Zelda-inspired foam ribbons along vertical plunge
float foamStreaks = smoothstep( 0.44, 0.74, combinedStreams );

// Irregular eroded crest lip froth where water spills between headwall boulders
float crestBreakup = ( stream1 - 0.5 ) * 0.14;
float topCrest = smoothstep( 0.82, 0.96, vWfUv.y + crestBreakup ) * 0.56;

// Turbulent boiling spray cloud near river impact (softened at extreme bottom so splash ring dominates)
float splashPulse = wfNoise( vec2( vWfUv.x * 13.5 * widthScale + vWfSeed, uWfTime * 2.7 + vWfUv.y * 4.0 ) );
float bottomSplash = (1.0 - smoothstep( 0.04, 0.28, vWfUv.y )) * clamp( 0.48 + splashPulse * 0.58, 0.0, 1.0 );

float totalFoam = clamp( foamStreaks * 0.84 + topCrest + bottomSplash, 0.0, 1.0 );

vec3 waterBase = mix( uWfBottomColor, uWfTopColor, smoothstep( 0.06, 0.90, vWfUv.y ) );
vec3 viewDir = normalize( vWfViewPos );
float fresnelRim = pow( clamp( 1.0 - abs( dot( normalize( vWfNormalView ), viewDir ) ), 0.0, 1.0 ), 2.2 );
waterBase += uWfRimColor * fresnelRim * 0.30;

diffuseColor.rgb = mix( waterBase, uWfFoamColor, totalFoam );

// Wide organic spray feathering on side edges, jagged crest entry, and water plunge entry
float sideNoise = ( stream2 - 0.5 ) * 0.14;
float sideFade = smoothstep( 0.0, 0.27, vWfUv.x + sideNoise ) * (1.0 - smoothstep( 0.73, 1.0, vWfUv.x - sideNoise ));
float topFade = (1.0 - smoothstep( 0.87, 1.0, vWfUv.y + crestBreakup * 0.8 ));
float bottomFade = smoothstep( 0.0, 0.11, vWfUv.y + ( splashPulse - 0.5 ) * 0.05 );
diffuseColor.a = clamp( ( 0.62 + totalFoam * 0.34 ) * sideFade * topFade * bottomFade, 0.0, 0.92 );
if ( diffuseColor.a < 0.015 ) discard;`,
        );
    };

    const sMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    sMat.customProgramCacheKey = () => 'sector7-waterfall-splash-v2';
    sMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWfTime = timeUniform.current;
      shader.uniforms.uWfBottomColor = bottomColorUniform.current;
      shader.uniforms.uWfFoamColor = foamColorUniform.current;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aSeed;
varying vec2 vWfSplashUv;
varying float vWfSplashSeed;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWfSplashUv = uv;
vWfSplashSeed = aSeed;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWfTime;
uniform vec3 uWfBottomColor;
uniform vec3 uWfFoamColor;
varying vec2 vWfSplashUv;
varying float vWfSplashSeed;
${WATERFALL_NOISE_GLSL}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec2 centered = ( vWfSplashUv - 0.5 ) * 2.0;
float dist = length( centered );
if ( dist > 0.98 ) discard;

float angle = atan( centered.y, centered.x );
float swirl = wfNoise( vec2( angle * 3.0 + vWfSplashSeed, dist * 5.2 - uWfTime * 1.65 ) );
float rippleRing = pow( max( 0.0, sin( dist * 15.0 - uWfTime * 3.2 + swirl * 3.2 ) ), 2.2 );

float coreFroth = 1.0 - smoothstep( 0.12, 0.64, dist );
float edgeFeather = 1.0 - smoothstep( 0.42, 0.95, dist + ( swirl - 0.5 ) * 0.22 );

float foamIntensity = clamp( coreFroth * ( 0.74 + 0.26 * swirl ) + rippleRing * 0.56 * swirl, 0.0, 1.0 );
diffuseColor.rgb = mix( uWfBottomColor, uWfFoamColor, smoothstep( 0.18, 0.72, foamIntensity ) );
diffuseColor.a = clamp( foamIntensity * edgeFeather * 0.92, 0.0, 0.92 );
if ( diffuseColor.a < 0.015 ) discard;`,
        );
    };

    const rMat = new THREE.MeshStandardMaterial({
      color: '#343D44',
      roughness: 0.44,
      metalness: 0.08,
      flatShading: true,
    });

    return { curtainMaterial: cMat, splashMaterial: sMat, rockMaterial: rMat };
  }, []);

  useEffect(() => {
    const mesh = rockMeshRef.current;
    if (!mesh) return;
    rockSpecs.forEach((spec, idx) => {
      _rockDummy.position.set(spec.x, spec.y, spec.z);
      _rockDummy.rotation.set(0.08, spec.rotY, -0.06);
      _rockDummy.scale.set(spec.scaleX, spec.scaleY, spec.scaleZ);
      _rockDummy.updateMatrix();
      mesh.setMatrixAt(idx, _rockDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [rockSpecs]);

  useEffect(() => {
    if (visible || !groupRef.current) return;
    void gl.compileAsync(groupRef.current, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('Waterfall shader warmup failed', error);
    });
  }, [visible, gl, camera, scene]);

  // Sync water/foam tinting smoothly to Day / Dusk / Night presets
  useEffect(() => {
    const pal = PRESET_PALETTES[lightingPreset];
    topColorUniform.current.value.set(pal.top);
    bottomColorUniform.current.value.set(pal.bottom);
    foamColorUniform.current.value.set(pal.foam);
    rimColorUniform.current.value.set(pal.rim);
  }, [lightingPreset]);

  useEffect(() => {
    return () => {
      curtainGeo.dispose();
      splashGeo.dispose();
      rockGeo.dispose();
      curtainMaterial.dispose();
      splashMaterial.dispose();
      rockMaterial.dispose();
      mistTex.dispose();
    };
  }, [curtainGeo, splashGeo, rockGeo, curtainMaterial, splashMaterial, rockMaterial, mistTex]);

  const { paused, clockRef } = useSceneSimulation();

  useFrame((state, delta) => {
    if (paused) return;
    if (isSoftwareGl || !visible) return;
    timeUniform.current.value += Math.min(delta, 0.05);

    if (showMist && mistGroupRef.current) {
      const t = clockRef.current.elapsed;
      mistGroupRef.current.children.forEach((child, idx) => {
        const anchor = mistAnchors[idx];
        if (!anchor) return;
        const cycle = (t * 0.24 + anchor.phaseOffset) % 1;
        child.position.set(
          anchor.x + anchor.driftX * cycle,
          anchor.y + cycle * 4.2,
          anchor.z + anchor.driftZ * cycle,
        );
        const s = anchor.baseScale * (0.78 + cycle * 0.65);
        child.scale.set(s, s * 0.7, 1);
      });
    }
  });

  const mistPalette = PRESET_PALETTES[lightingPreset];

  return (
    <group name="canyon-waterfalls" ref={groupRef} visible={visible}>
      {rockSpecs.length > 0 && (
        <instancedMesh
          ref={rockMeshRef}
          args={[rockGeo, rockMaterial, rockSpecs.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      )}
      <mesh
        geometry={curtainGeo}
        material={curtainMaterial}
        renderOrder={3}
        frustumCulled={false}
      />
      <mesh
        geometry={splashGeo}
        material={splashMaterial}
        renderOrder={3}
        frustumCulled={false}
      />
      {showMist && (
        <group ref={mistGroupRef}>
          {mistAnchors.map((anchor) => (
            <sprite
              key={anchor.key}
              position={[anchor.x, anchor.y, anchor.z]}
              scale={[anchor.baseScale, anchor.baseScale * 0.7, 1]}
              renderOrder={4}
            >
              <spriteMaterial
                map={mistTex}
                color={mistPalette.mist}
                transparent
                opacity={mistPalette.mistOpacity}
                depthWrite={false}
              />
            </sprite>
          ))}
        </group>
      )}
    </group>
  );
}
