import { useSceneSimulation } from './SceneSimulation';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from 'three/addons/objects/Sky.js';
import type { LightingPreset } from '../map/sectors';

export interface ProceduralSkyProps {
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  isSoftwareGl: boolean;
}

interface SkyPresetParams {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudCoverage: number;
  cloudDensity: number;
  cloudElevation: number;
  radianceScale: number;
  horizonCompress: number;
  preethamMix: number;
  envIntensity: number;
  groundColor: string;
  horizonTint: string;
  midSkyTint: string;
  zenithTint: string;
  sunGlowTint: string;
}

const SKY_PRESETS: Record<LightingPreset, SkyPresetParams> = {
  day: {
    turbidity: 1.25,
    rayleigh: 1.85,
    mieCoefficient: 0.0022,
    mieDirectionalG: 0.8,
    cloudCoverage: 0.22,
    cloudDensity: 0.25,
    cloudElevation: 0.48,
    radianceScale: 0.28,
    horizonCompress: 0.75,
    preethamMix: 0.8,
    envIntensity: 0.56,
    groundColor: '#5B6147',
    horizonTint: '#8ABCE8',
    midSkyTint: '#3678C4',
    zenithTint: '#1D529C',
    sunGlowTint: '#9EC8EE',
  },
  dusk: {
    turbidity: 8.2,
    rayleigh: 3.1,
    mieCoefficient: 0.012,
    mieDirectionalG: 0.86,
    cloudCoverage: 0.42,
    cloudDensity: 0.4,
    cloudElevation: 0.45,
    radianceScale: 0.26,
    horizonCompress: 0.95,
    preethamMix: 0.62,
    envIntensity: 0.58,
    groundColor: '#161C24',
    horizonTint: '#7E716B',
    midSkyTint: '#414F63',
    zenithTint: '#1D293B',
    sunGlowTint: '#C97E4B',
  },
  night: {
    turbidity: 1.8,
    rayleigh: 0.45,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.76,
    cloudCoverage: 0.24,
    cloudDensity: 0.25,
    cloudElevation: 0.5,
    radianceScale: 0.25,
    horizonCompress: 1.0,
    preethamMix: 0.25,
    envIntensity: 0.22,
    groundColor: '#070C14',
    horizonTint: '#0B1420',
    midSkyTint: '#08101C',
    zenithTint: '#040810',
    sunGlowTint: '#102036',
  },
};

function configureSkyShader(sky: Sky): void {
  const mat = sky.material as THREE.ShaderMaterial;
  mat.uniforms.uRadianceScale = { value: 0.28 };
  mat.uniforms.uHorizonCompress = { value: 0.75 };
  mat.uniforms.uPreethamMix = { value: 0.8 };
  mat.uniforms.uHorizonTint = { value: new THREE.Color('#8ABCE8') };
  mat.uniforms.uMidSkyTint = { value: new THREE.Color('#3678C4') };
  mat.uniforms.uZenithTint = { value: new THREE.Color('#1D529C') };
  mat.uniforms.uSunGlowTint = { value: new THREE.Color('#9EC8EE') };
  mat.fragmentShader = mat.fragmentShader
    .replace(
      'uniform float time;',
      `uniform float time;
\t\tuniform float uRadianceScale;
\t\tuniform float uHorizonCompress;
\t\tuniform float uPreethamMix;
\t\tuniform vec3 uHorizonTint;
\t\tuniform vec3 uMidSkyTint;
\t\tuniform vec3 uZenithTint;
\t\tuniform vec3 uSunGlowTint;`,
    )
    .replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      `vec3 rawScaled = texColor * uRadianceScale;
      vec3 skyPreetham = rawScaled / ( 1.0 + rawScaled * uHorizonCompress );
      float tLow = smoothstep( -0.17, 0.01, direction.y );
      float tHigh = smoothstep( -0.04, 0.34, direction.y );
      vec3 gradColor = mix( uHorizonTint, uMidSkyTint, tLow );
      gradColor = mix( gradColor, uZenithTint, tHigh );
      vec2 horizDir = normalize( direction.xz + vec2( 1e-5 ) );
      vec2 horizSun = normalize( vSunDirection.xz + vec2( 1e-5 ) );
      float sunAzimuth = pow( max( dot( horizDir, horizSun ), 0.0 ), 3.5 );
      float sunBand = 1.0 - smoothstep( -0.14, 0.20, direction.y );
      gradColor = mix( gradColor, uSunGlowTint, sunAzimuth * sunBand * 0.28 );
      float preethamWeight = smoothstep( -0.05, 0.20, direction.y ) * uPreethamMix;
      vec3 skyOut = mix( gradColor, skyPreetham, preethamWeight );
      gl_FragColor = vec4( skyOut, 1.0 );`,
    );
  mat.needsUpdate = true;
}

function applySkyUniforms(
  sky: Sky,
  lightingPreset: LightingPreset,
  sunPos: readonly [number, number, number],
) {
  const cfg = SKY_PRESETS[lightingPreset];
  const u = sky.material.uniforms;
  u.turbidity.value = cfg.turbidity;
  u.rayleigh.value = cfg.rayleigh;
  u.mieCoefficient.value = cfg.mieCoefficient;
  u.mieDirectionalG.value = cfg.mieDirectionalG;
  u.cloudCoverage.value = cfg.cloudCoverage;
  u.cloudDensity.value = cfg.cloudDensity;
  u.cloudElevation.value = cfg.cloudElevation;
  u.uRadianceScale.value = cfg.radianceScale;
  u.uHorizonCompress.value = cfg.horizonCompress;
  u.uPreethamMix.value = cfg.preethamMix;
  (u.uHorizonTint.value as THREE.Color).set(cfg.horizonTint);
  (u.uMidSkyTint.value as THREE.Color).set(cfg.midSkyTint);
  (u.uZenithTint.value as THREE.Color).set(cfg.zenithTint);
  (u.uSunGlowTint.value as THREE.Color).set(cfg.sunGlowTint);
  u.showSunDisc.value = lightingPreset === 'night' ? 0 : 1;
  u.time.value = 14.0;

  if (lightingPreset === 'night') {
    // Deep below Preetham cutoffAngle (~92.3 deg) so night sky renders true dark indigo
    u.sunPosition.value.set(-120, -56, -150).normalize();
  } else if (lightingPreset === 'dusk') {
    // Warm ~10 deg golden-hour sky elevation complementing the 21.5 deg key sunlight
    u.sunPosition.value.set(sunPos[0], 46, sunPos[2]).normalize();
  } else {
    u.sunPosition.value.set(sunPos[0], sunPos[1], sunPos[2]).normalize();
  }
}

/**
 * Physical Preetham Sky dome (three/addons/objects/Sky.js) paired with a
 * live-baked PMREM environment map so water & metallic surfaces reflect real
 * sky gradients and a shimmering solar reflection trail.
 */
export function ProceduralSky({
  lightingPreset,
  sunPos,
  isSoftwareGl,
}: ProceduralSkyProps) {
  const { gl, scene, invalidate } = useThree();

  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(2600);
    s.frustumCulled = false;
    configureSkyShader(s);
    return s;
  }, []);

  useEffect(() => {
    return () => {
      sky.geometry.dispose();
      sky.material.dispose();
    };
  }, [sky]);

  useEffect(() => {
    const cfg = SKY_PRESETS[lightingPreset];
    applySkyUniforms(sky, lightingPreset, sunPos);

    // Bake PMREM reflections directly from a dedicated offscreen Sky scene
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();

    const envScene = new THREE.Scene();
    const bakeSky = new Sky();
    bakeSky.scale.setScalar(1000);
    configureSkyShader(bakeSky);
    applySkyUniforms(bakeSky, lightingPreset, sunPos);
    envScene.add(bakeSky);

    const groundGeo = new THREE.CircleGeometry(900, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({ color: cfg.groundColor });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = -4;
    envScene.add(groundMesh);

    const envRT = pmrem.fromScene(envScene, 0.003);
    scene.environment = envRT.texture;
    scene.environmentIntensity = cfg.envIntensity;

    bakeSky.geometry.dispose();
    bakeSky.material.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    pmrem.dispose();

    invalidate();

    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      envRT.dispose();
    };
  }, [gl, scene, sky, lightingPreset, sunPos, invalidate]);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (isSoftwareGl) return;
    sky.material.uniforms.time.value += delta;
  });

  return <primitive object={sky} renderOrder={-10} />;
}
