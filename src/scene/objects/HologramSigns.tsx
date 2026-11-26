import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';
import type { LightingPreset } from '../../map/sectors';
import type { CombatSimulationState } from '../../game/combatTypes';
import {
  SECTOR7_HOLOGRAM_SIGNS,
  createHologramAtlasTexture,
  getHologramLightingParams,
  resolveHologramColorHex,
} from '../../map/hologramSigns';
import { getCheckerboardShadowMaterial } from '../surfaceDetail';

export interface HologramSignsProps {
  visible: boolean;
  lightingPreset: LightingPreset;
  combatRef: MutableRefObject<CombatSimulationState>;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aIconIndex;

  varying vec2 vAtlasUv;
  varying vec2 vLocalUv;
  varying vec3 vColor;
  varying float vPhase;

  #include <fog_pars_vertex>

  void main() {
    float idx = floor(aIconIndex + 0.5);
    float col = mod(idx, 2.0);
    float row = floor(idx / 2.0);
    // 2x2 padded atlas sampling (prevents LinearFilter bleeding across quadrants)
    vec2 quadOrigin = vec2(col * 0.5, (1.0 - row) * 0.5);
    vAtlasUv = quadOrigin + vec2(0.02) + uv * 0.46;
    vLocalUv = uv;

    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0, 0.9, 1.0);
    #endif

    vec4 localPos = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      vPhase = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.61 + instanceMatrix[3][1] * 0.19;
      localPos = instanceMatrix * localPos;
    #else
      vPhase = 0.0;
    #endif

    vec4 mvPosition = modelViewMatrix * localPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uBrightness;
  uniform float uBackingAlpha;
  uniform sampler2D uAtlas;

  varying vec2 vAtlasUv;
  varying vec2 vLocalUv;
  varying vec3 vColor;
  varying float vPhase;

  #include <fog_pars_fragment>

  void main() {
    float pattern = texture2D(uAtlas, vAtlasUv).r;

    // Soft edge dissolve so panels never appear as harsh hard-edged stickers
    float edgeFadeX = smoothstep(0.0, 0.10, vLocalUv.x) * (1.0 - smoothstep(0.90, 1.0, vLocalUv.x));
    float edgeFadeY = smoothstep(0.0, 0.14, vLocalUv.y) * (1.0 - smoothstep(0.86, 1.0, vLocalUv.y));
    float edgeMask = edgeFadeX * edgeFadeY;

    // Subtle HUD corner bracket ticks
    float dEdgeX = min(vLocalUv.x, 1.0 - vLocalUv.x);
    float dEdgeY = min(vLocalUv.y, 1.0 - vLocalUv.y);
    float cornerX = 1.0 - smoothstep(0.14, 0.22, dEdgeX);
    float cornerY = 1.0 - smoothstep(0.20, 0.30, dEdgeY);
    float lineX = (1.0 - smoothstep(0.04, 0.065, dEdgeX)) * cornerY;
    float lineY = (1.0 - smoothstep(0.06, 0.095, dEdgeY)) * cornerX;
    float brackets = clamp(lineX + lineY, 0.0, 1.0) * 0.62;

    // Animated projector scanlines & subtle digital flicker
    float scanline = 0.78 + 0.22 * sin(vLocalUv.y * 78.0 - uTime * 7.5 + vPhase);
    float flicker = 0.92 + 0.08 * sin(uTime * 23.0 + vPhase * 11.0) * cos(uTime * 6.5 - vPhase * 3.0);

    float alpha = (pattern * 0.94 + brackets + uBackingAlpha) * edgeMask * scanline * flicker;
    // Slight dark tint on background glass keeps symbols readable in bright daylight
    vec3 glassTint = vColor * (0.28 + pattern * 0.72 + brackets * 0.65);
    vec3 holoColor = glassTint * uBrightness * (0.95 + pattern * 0.75);

    gl_FragColor = vec4(holoColor, clamp(alpha, 0.0, 0.96));
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

function isCitadelThreatCleared(sim: CombatSimulationState): boolean {
  if (sim.missionStatus === 'victory') return true;
  if (!sim.enemies || sim.enemies.length === 0) return false;
  const citadelEnemies = sim.enemies.filter(
    (e) => e.id.includes('citadel') || e.archetype === 'denial-turret',
  );
  if (citadelEnemies.length === 0) return false;
  return citadelEnemies.every((e) => e.hp <= 0 || e.aiState === 'destroyed');
}

/**
 * Renders all Sector 7 diegetic tactical hologram signs (bridge chevrons, cliff DANGER
 * warnings, command radar displays, and quarry/pier hazard stripes) in 1 Draw Call
 * using a procedural 2x2 CanvasTexture atlas and InstancedMesh.
 */
export function HologramSigns({ lightingPreset, combatRef, visible }: HologramSignsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lastClearedRef = useRef(false);

  const holoDepthMaterial = useMemo(
    () => getCheckerboardShadowMaterial('glass25', THREE.DoubleSide),
    [],
  );

  const { geometry, material, atlasTex, uniforms } = useMemo(() => {
    const tex = createHologramAtlasTexture();
    const geom = new THREE.PlaneGeometry(1, 1);

    const iconIndices = new Float32Array(SECTOR7_HOLOGRAM_SIGNS.length);
    for (let i = 0; i < SECTOR7_HOLOGRAM_SIGNS.length; i++) {
      iconIndices[i] = SECTOR7_HOLOGRAM_SIGNS[i].iconType;
    }
    geom.setAttribute('aIconIndex', new THREE.InstancedBufferAttribute(iconIndices, 1));

    const matUniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uBrightness: { value: 1.25 },
        uBackingAlpha: { value: 0.11 },
        uAtlas: { value: tex },
      },
    ]);

    const mat = new THREE.ShaderMaterial({
      uniforms: matUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: false,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    return { geometry: geom, material: mat, atlasTex: tex, uniforms: matUniforms };
  }, []);

  // Populate instance transforms and initial tactical colors
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const cleared = isCitadelThreatCleared(combatRef.current);
    lastClearedRef.current = cleared;

    for (let i = 0; i < SECTOR7_HOLOGRAM_SIGNS.length; i++) {
      const cfg = SECTOR7_HOLOGRAM_SIGNS[i];
      dummy.position.set(cfg.x, cfg.y, cfg.z);
      dummy.rotation.set(cfg.pitch ?? 0, cfg.yaw, 0, 'YXZ');
      dummy.scale.set(cfg.width, cfg.height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHex(resolveHologramColorHex(cfg, cleared));
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [combatRef]);

  useMeshShaderWarmup(meshRef, !visible);

  // Adapt brightness & backing tint cleanly per time-of-day preset
  useEffect(() => {
    const { brightness, backingAlpha } = getHologramLightingParams(lightingPreset);
    uniforms.uBrightness.value = brightness;
    uniforms.uBackingAlpha.value = backingAlpha;
  }, [lightingPreset, uniforms]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      atlasTex.dispose();
    };
  }, [geometry, material, atlasTex]);

  const { paused, clockRef } = useSceneSimulation();
  const tempColorRef = useRef(new THREE.Color());

  useFrame(() => {
    if (paused) return;
    if (!visible) return;
    uniforms.uTime.value = clockRef.current.elapsed;

    const cleared = isCitadelThreatCleared(combatRef.current);
    if (cleared !== lastClearedRef.current) {
      lastClearedRef.current = cleared;
      const mesh = meshRef.current;
      if (mesh) {
        const col = tempColorRef.current;
        for (let i = 0; i < SECTOR7_HOLOGRAM_SIGNS.length; i++) {
          const cfg = SECTOR7_HOLOGRAM_SIGNS[i];
          if (cfg.clearedColorHex !== undefined) {
            col.setHex(resolveHologramColorHex(cfg, cleared));
            mesh.setColorAt(i, col);
          }
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      visible={visible}
      args={[geometry, material, SECTOR7_HOLOGRAM_SIGNS.length]}
      customDepthMaterial={holoDepthMaterial}
      frustumCulled={false}
      castShadow
      receiveShadow={false}
    />
  );
}
