import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import type { LightingPreset } from '../../map/sectors';
import type { AtmosphereQuality } from '../../game/graphicsSettings';
import { combatAudio } from '../../game/combatAudio';
import {
  MAX_STORM_LAYERS,
  STORM_LAYER_SPECS,
  STORM_PRESETS,
  createStormSimulation,
  resetStormSimulation,
  stepStormSimulation,
} from './stormSimulation';

export interface StormFrontProps {
  lightingPreset: LightingPreset;
  atmosphere: AtmosphereQuality;
  isSoftwareGl: boolean;
  resetNonce: number;
}

const STORM_ANCHOR_POS: readonly [number, number, number] = [195, 14, -640];
const STORM_ANCHOR_YAW = -0.38;

const CLOUD_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aLayerData;
  varying vec2 vUv;
  varying vec3 vLayerData;

  void main() {
    vUv = uv;
    vLayerData = aLayerData;
    vec4 mvPos = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      mvPos = instanceMatrix * mvPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * mvPos;
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uCloudOpacity;
  uniform float uHazeStrength;
  uniform float uFlashIntensity;
  uniform float uFlashGain;
  uniform vec2 uFlashPos;
  uniform vec3 uTopColor;
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform vec3 uHorizonHazeColor;
  uniform vec3 uFlashColor;

  varying vec2 vUv;
  varying vec3 vLayerData;

  float stormHash(vec2 p) {
    p = mod(p, 289.0);
    vec2 q = fract(p * vec2(0.1031, 0.1030));
    q += dot(q, q.yx + 33.33);
    return fract((q.x + q.y) * q.x);
  }

  float stormNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(stormHash(i), stormHash(i + vec2(1.0, 0.0)), f.x),
      mix(stormHash(i + vec2(0.0, 1.0)), stormHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float stormFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * stormNoise(p);
      p = p * 2.04 + vec2(13.7, 7.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float depthWeight = vLayerData.x;
    float phase = vLayerData.y;
    float scaleVar = vLayerData.z;

    vec2 p = vec2(vUv.x - 0.5, vUv.y);

    // Anvil cumulonimbus horizontal profile: broad lower shelf + flared upper anvil
    float anvilFlare = smoothstep(0.45, 0.88, vUv.y) * 0.09;
    float halfWidth = 0.34 + anvilFlare - smoothstep(0.82, 0.99, vUv.y) * 0.14;
    float horizMask = 1.0 - smoothstep(halfWidth * 0.42, halfWidth, abs(p.x));

    // Anchor cloud base cleanly behind northern mountain rim and feather billowing crown
    float bottomMask = smoothstep(0.04, 0.28, vUv.y);
    float topMask = 1.0 - smoothstep(0.56, 0.95, vUv.y);
    float envelope = horizMask * bottomMask * topMask;
    if (envelope <= 0.005) discard;

    vec2 noiseUv = vec2(vUv.x * 3.8 * scaleVar + uTime * 0.0075 + phase, vUv.y * 2.9 * scaleVar - phase * 0.4);
    float fbm = stormFbm(noiseUv);
    float detail = stormNoise(noiseUv * 2.6 + vec2(4.2, -1.9));

    float density = smoothstep(0.24, 0.72, envelope * 1.15 + (fbm - 0.48) * 0.55 + (detail - 0.5) * 0.16);
    if (density <= 0.01) discard;

    // Vertical self-shadowing: dark heavy rain-base below, brighter billowing crest above
    float heightShade = clamp(vUv.y * 0.85 + fbm * 0.35 - 0.12, 0.0, 1.0);
    vec3 col = mix(uBaseColor, uTopColor, smoothstep(0.18, 0.82, heightShade));

    // Rim illumination along outer ragged edges (sunset warmth at dusk, moonlight rim at night)
    float edgeRim = smoothstep(0.08, 0.36, density) * (1.0 - smoothstep(0.36, 0.78, density));
    col = mix(col, uRimColor, edgeRim * (0.32 + 0.35 * smoothstep(0.45, 0.92, vUv.y)));

    // Sub-surface sheet-lightning illumination inside the thunderhead around uFlashPos
    if (uFlashIntensity > 0.005) {
      vec2 flashDelta = (p - uFlashPos) * vec2(1.0, 1.45);
      float flashDist = length(flashDelta);
      float coreGlow = exp(-flashDist * 5.8);
      float wideGlow = exp(-flashDist * 2.2);
      float cavityBoost = mix(1.0, 0.42, smoothstep(0.35, 0.95, density));
      float thinEdgeBoost = edgeRim * 1.45 + (1.0 - fbm) * 0.55;
      float scatter = (coreGlow * 1.25 + wideGlow * 0.45) * (cavityBoost + thinEdgeBoost * 0.65);
      col += uFlashColor * scatter * uFlashIntensity * uFlashGain * (0.45 + 0.55 * depthWeight);
    }

    // Controlled local horizon haze at base so the storm sits behind the mountain range cleanly
    float horizonMix = (1.0 - smoothstep(0.0, 0.44, vUv.y)) * uHazeStrength;
    col = mix(col, uHorizonHazeColor, horizonMix);

    float alpha = density * uCloudOpacity * (0.72 + 0.28 * depthWeight);
    gl_FragColor = vec4(col, alpha);
  }
`;

const BOLT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BOLT_FRAGMENT_SHADER = /* glsl */ `
  uniform float uBoltIntensity;
  uniform float uBoltGain;
  uniform float uBoltSeed;
  uniform vec2 uFlashPos;
  uniform vec3 uBoltColor;

  varying vec2 vUv;

  float boltHash(float n) {
    return fract(sin(n * 127.1 + uBoltSeed * 31.7) * 43758.5453);
  }

  float boltJagged(float y, float seed) {
    float n1 = sin(y * 28.0 + seed * 3.1) * 0.022;
    float n2 = sin(y * 67.0 - seed * 7.4) * 0.011;
    float n3 = (abs(fract(y * 19.0 + seed) - 0.5) - 0.25) * 0.036;
    return n1 + n2 + n3;
  }

  float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    if (uBoltIntensity <= 0.005) discard;

    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float slant = (boltHash(1.3) - 0.5) * 0.14;
    vec2 topPt = vec2(uFlashPos.x, min(0.86, uFlashPos.y + 0.24));
    vec2 botPt = vec2(uFlashPos.x + slant, max(0.10, uFlashPos.y - 0.34));

    // Domain-warp x along the trunk for organic jagged lightning channel
    float yRel = clamp((p.y - botPt.y) / max(topPt.y - botPt.y, 0.05), 0.0, 1.0);
    float endTaper = sin(yRel * 3.14159265);
    vec2 warpedP = vec2(p.x - boltJagged(p.y, uBoltSeed) * endTaper, p.y);
    float dMain = sdSeg(warpedP, topPt, botPt);

    // Three diagonal forks splitting off the main trunk
    float forkSignA = boltHash(4.7) > 0.5 ? 1.0 : -1.0;
    vec2 forkStartA = mix(topPt, botPt, 0.32);
    vec2 forkEndA = forkStartA + vec2(forkSignA * 0.11, -0.17);
    vec2 warpA = vec2(p.x - boltJagged(p.y, uBoltSeed + 11.3) * 0.75, p.y);
    float dForkA = sdSeg(warpA, forkStartA, forkEndA);

    vec2 forkStartB = mix(topPt, botPt, 0.54);
    vec2 forkEndB = forkStartB + vec2(-forkSignA * 0.095, -0.15);
    vec2 warpB = vec2(p.x - boltJagged(p.y, uBoltSeed + 23.9) * 0.7, p.y);
    float dForkB = sdSeg(warpB, forkStartB, forkEndB);

    vec2 forkStartC = mix(topPt, botPt, 0.70);
    vec2 forkEndC = forkStartC + vec2(forkSignA * 0.075, -0.11);
    float dForkC = sdSeg(warpA, forkStartC, forkEndC);

    float dForks = min(dForkA, min(dForkB, dForkC));
    float dAll = min(dMain, dForks * 1.18);

    // Mask cleanly inside the cloud horizon bounds so bolts never clip the plane edges
    float edgeMask = smoothstep(0.06, 0.22, vUv.y) * (1.0 - smoothstep(0.78, 0.94, vUv.y));
    float horizMask = 1.0 - smoothstep(0.28, 0.46, abs(p.x));

    float core = exp(-dMain * 360.0) + exp(-dForks * 420.0) * 0.65;
    float corona = exp(-dAll * 52.0) * 0.55;
    float flashGlow = exp(-length((p - uFlashPos) * vec2(1.0, 1.5)) * 7.5) * 0.24;

    float intensity = (core + corona + flashGlow) * edgeMask * horizMask * uBoltIntensity * uBoltGain;
    if (intensity <= 0.004) discard;

    vec3 col = mix(uBoltColor, vec3(1.0), clamp(core * 1.4, 0.0, 1.0));
    gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0));
  }
`;

const _dummy = new THREE.Object3D();

/**
 * Procedural 4-layer horizon storm front positioned beyond the northern ridge.
 * Renders dark storm anvils with internal sheet-lightning scattering and strobe forked bolts
 * without external textures and without washing out behind scene fogExp2.
 */
export function StormFront({
  lightingPreset,
  atmosphere,
  isSoftwareGl,
  resetNonce,
}: StormFrontProps) {
  const active = atmosphere !== 'off';
  const layerCount = atmosphere === 'full' ? MAX_STORM_LAYERS : 2;
  const { paused, clockRef } = useSceneSimulation();
  const { invalidate } = useThree();

  const cloudMeshRef = useRef<THREE.InstancedMesh>(null);
  const boltMeshRef = useRef<THREE.Mesh>(null);
  const stormRef = useRef(createStormSimulation(lightingPreset));
  const prevResetRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const cloudGeom = new THREE.PlaneGeometry(1, 1);
    cloudGeom.translate(0, 0.5, 0);

    const layerData = new Float32Array(MAX_STORM_LAYERS * 3);
    for (let i = 0; i < MAX_STORM_LAYERS; i++) {
      const spec = STORM_LAYER_SPECS[i];
      layerData[i * 3] = spec.depthWeight;
      layerData[i * 3 + 1] = spec.phase;
      layerData[i * 3 + 2] = 0.88 + i * 0.09;
    }
    const layerAttr = new THREE.InstancedBufferAttribute(layerData, 3);
    cloudGeom.setAttribute('aLayerData', layerAttr);

    const preset = STORM_PRESETS.dusk;
    const cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCloudOpacity: { value: preset.cloudOpacity },
        uHazeStrength: { value: preset.hazeStrength },
        uFlashIntensity: { value: 0 },
        uFlashGain: { value: preset.flashGain },
        uFlashPos: { value: new THREE.Vector2(0.06, 0.48) },
        uTopColor: { value: new THREE.Color(preset.cloudTopColor) },
        uBaseColor: { value: new THREE.Color(preset.cloudBaseColor) },
        uRimColor: { value: new THREE.Color(preset.rimColor) },
        uHorizonHazeColor: { value: new THREE.Color(preset.horizonHazeColor) },
        uFlashColor: { value: new THREE.Color(preset.flashColor) },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });

    const boltGeom = new THREE.PlaneGeometry(540, 210);
    boltGeom.translate(0, 105, 0);
    const boltMat = new THREE.ShaderMaterial({
      vertexShader: BOLT_VERTEX_SHADER,
      fragmentShader: BOLT_FRAGMENT_SHADER,
      uniforms: {
        uBoltIntensity: { value: 0 },
        uBoltGain: { value: preset.boltGain },
        uBoltSeed: { value: 1.7 },
        uFlashPos: { value: new THREE.Vector2(0.06, 0.48) },
        uBoltColor: { value: new THREE.Color(preset.boltColor) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    return { cloudGeom, cloudMat, boltGeom, boltMat, layerAttr, layerData };
  }, []);

  useEffect(() => {
    return () => {
      setup.cloudGeom.dispose();
      setup.cloudMat.dispose();
      setup.boltGeom.dispose();
      setup.boltMat.dispose();
    };
  }, [setup]);

  useEffect(() => {
    const cloudMesh = cloudMeshRef.current;
    if (!cloudMesh) return;
    // When reduced, pick outer backdrop + mid flash-diffuser layers
    const layerIndices = atmosphere === 'reduced' ? [0, 2] : [0, 1, 2, 3];
    for (let i = 0; i < layerIndices.length; i++) {
      const idx = layerIndices[i];
      const spec = STORM_LAYER_SPECS[idx];
      _dummy.position.set(spec.offsetX, spec.offsetY, spec.offsetZ);
      _dummy.scale.set(spec.width, spec.height, 1);
      _dummy.updateMatrix();
      cloudMesh.setMatrixAt(i, _dummy.matrix);
      setup.layerData[i * 3] = spec.depthWeight;
      setup.layerData[i * 3 + 1] = spec.phase;
      setup.layerData[i * 3 + 2] = 0.88 + idx * 0.09;
    }
    cloudMesh.count = layerIndices.length;
    cloudMesh.computeBoundingSphere();
    cloudMesh.instanceMatrix.needsUpdate = true;
    setup.layerAttr.needsUpdate = true;
    invalidate();
  }, [atmosphere, setup, invalidate]);

  useEffect(() => {
    const preset = STORM_PRESETS[lightingPreset];
    const cu = setup.cloudMat.uniforms;
    cu.uCloudOpacity.value = preset.cloudOpacity;
    cu.uHazeStrength.value = preset.hazeStrength;
    cu.uFlashGain.value = preset.flashGain;
    (cu.uTopColor.value as THREE.Color).set(preset.cloudTopColor);
    (cu.uBaseColor.value as THREE.Color).set(preset.cloudBaseColor);
    (cu.uRimColor.value as THREE.Color).set(preset.rimColor);
    (cu.uHorizonHazeColor.value as THREE.Color).set(preset.horizonHazeColor);
    (cu.uFlashColor.value as THREE.Color).set(preset.flashColor);

    const bu = setup.boltMat.uniforms;
    bu.uBoltGain.value = preset.boltGain;
    (bu.uBoltColor.value as THREE.Color).set(preset.boltColor);

    resetStormSimulation(stormRef.current, lightingPreset);
    invalidate();
  }, [lightingPreset, setup, invalidate]);

  useEffect(() => {
    if (prevResetRef.current === resetNonce) return;
    prevResetRef.current = resetNonce;
    resetStormSimulation(stormRef.current, lightingPreset);
    setup.cloudMat.uniforms.uFlashIntensity.value = 0;
    setup.boltMat.uniforms.uBoltIntensity.value = 0;
    if (boltMeshRef.current) boltMeshRef.current.visible = false;
  }, [resetNonce, lightingPreset, setup]);

  useFrame((_, delta) => {
    if (paused) return;
    if (!active) return;

    const dt = Math.min(delta, 0.05);
    const storm = stormRef.current;
    const stepRes = stepStormSimulation(storm, dt, lightingPreset);

    if (stepRes.thunderTriggered && !isSoftwareGl) {
      combatAudio.playDistantThunder();
    }

    const cu = setup.cloudMat.uniforms;
    cu.uTime.value = clockRef.current.elapsed;
    cu.uFlashIntensity.value = storm.flashIntensity;
    (cu.uFlashPos.value as THREE.Vector2).set(storm.flashX, storm.flashY);

    const boltMesh = boltMeshRef.current;
    if (boltMesh) {
      const showBolt = storm.boltIntensity > 0.005;
      boltMesh.visible = showBolt;
      if (showBolt) {
        const bu = setup.boltMat.uniforms;
        bu.uBoltIntensity.value = storm.boltIntensity;
        bu.uBoltSeed.value = storm.boltSeed;
        (bu.uFlashPos.value as THREE.Vector2).set(storm.flashX, storm.flashY);
      }
    }
  });

  if (!active) return null;

  return (
    <group
      name="horizon-storm-front"
      position={STORM_ANCHOR_POS}
      rotation={[0, STORM_ANCHOR_YAW, 0]}
    >
      <instancedMesh
        ref={cloudMeshRef}
        name="storm-anvil-layers"
        args={[setup.cloudGeom, setup.cloudMat, MAX_STORM_LAYERS]}
        count={layerCount}
        renderOrder={-5}
      />
      <mesh
        ref={boltMeshRef}
        name="storm-lightning-bolt"
        position={[0, 4, 2]}
        geometry={setup.boltGeom}
        material={setup.boltMat}
        visible={false}
        renderOrder={-4}
      />
    </group>
  );
}
