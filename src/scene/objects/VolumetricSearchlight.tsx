import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';

export interface VolumetricSearchlightProps {
  position: [number, number, number];
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  /** Initial horizontal aim angle in radians (local Y rotation; +Z is forward). */
  baseYaw?: number;
  /** Downward tilt pitch in radians (positive tilts beam downward toward terrain). */
  basePitch?: number;
  /** Horizontal sweep amplitude in radians. */
  sweepAmp?: number;
  /** Sweep angular frequency in rad/s. */
  sweepSpeed?: number;
  /** Phase offset so multiple towers don't move in lockstep. */
  phase?: number;
  /** Length of the volumetric light shaft in world units. */
  beamLength?: number;
  /** Far cone radius at the end of the shaft. */
  beamRadius?: number;
  /** Optional housing visual scale. */
  housingScale?: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPos = -mvPos.xyz;
    vViewDir = normalize(vViewPos);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vViewPos;

  float h2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float n2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x),
      mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    float distToCamera = length(vViewPos);
    vec3 viewDir = normalize(vViewDir);

    // 1. Soft Fresnel silhouette dissolve so cone edges never read as hard triangles
    float ndotv = abs(dot(normalize(vNormalView), viewDir));
    float edgeSoft = pow(clamp(ndotv, 0.0, 1.0), 2.4);

    // 2. Axial falloff: smooth start right at the lens (vUv.y=1) & smooth fade into sky/ground (vUv.y=0)
    float nearLens = (1.0 - smoothstep(0.94, 1.0, vUv.y));
    float tailFade = smoothstep(0.0, 0.34, vUv.y) * pow(clamp(vUv.y, 0.0, 1.0), 1.35);

    // 3. Camera near fade prevents sharp clipping planes if the Mech walks through the beam
    float nearCameraFade = smoothstep(3.5, 11.5, distToCamera);

    // 4. Two-layer scrolling procedural dust motes & volumetric streaks inside the shaft
    float dust1 = n2(vec2(vUv.x * 6.0 + uTime * 0.08 + uPhase, vUv.y * 4.5 - uTime * 0.34));
    float dust2 = n2(vec2(vUv.x * 13.0 - uTime * 0.06 - uPhase * 0.7, vUv.y * 9.0 - uTime * 0.16));
    float volumetricStreaks = 0.62 + (dust1 * 0.62 + dust2 * 0.38) * 0.72;

    float coreBoost = 1.0 + 0.9 * pow(clamp(vUv.y, 0.0, 1.0), 3.2);
    float alpha = edgeSoft * nearLens * tailFade * nearCameraFade * volumetricStreaks * uOpacity;

    gl_FragColor = vec4(uColor * coreBoost, clamp(alpha, 0.0, 1.0));
  }
`;

let sharedLensFlareTex: THREE.CanvasTexture | null = null;

function getSharedLensFlareTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (sharedLensFlareTex) return sharedLensFlareTex;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size * 0.5;
  const radial = ctx.createRadialGradient(half, half, 0, half, half, half);
  radial.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
  radial.addColorStop(0.18, 'rgba(255, 234, 180, 0.86)');
  radial.addColorStop(0.45, 'rgba(255, 196, 110, 0.28)');
  radial.addColorStop(1.0, 'rgba(255, 160, 60, 0.0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Crisp subtle 4-point optical cross-flare
  const hGrad = ctx.createLinearGradient(0, half, size, half);
  hGrad.addColorStop(0.0, 'rgba(255, 235, 190, 0.0)');
  hGrad.addColorStop(0.5, 'rgba(255, 252, 235, 0.65)');
  hGrad.addColorStop(1.0, 'rgba(255, 235, 190, 0.0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(2, half - 2, size - 4, 4);

  const vGrad = ctx.createLinearGradient(half, 0, half, size);
  vGrad.addColorStop(0.0, 'rgba(255, 235, 190, 0.0)');
  vGrad.addColorStop(0.5, 'rgba(255, 252, 235, 0.45)');
  vGrad.addColorStop(1.0, 'rgba(255, 235, 190, 0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(half - 1.5, 6, 3, size - 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  sharedLensFlareTex = tex;
  return tex;
}

/**
 * Gimballed tactical searchlight housing + Fresnel-softened, dust-streaked volumetric
 * additive cone shader with camera-near fade and optical starburst lens flare.
 * Active in dusk and night presets for Citadel bastions and bridge KPP.
 */
export function VolumetricSearchlight({
  position,
  lightingPreset,
  isSoftwareGl,
  baseYaw = 0,
  basePitch = 0.4,
  sweepAmp = 0.58,
  sweepSpeed = 0.36,
  phase = 0,
  beamLength = 58,
  beamRadius = 10.5,
  housingScale = 1,
}: VolumetricSearchlightProps) {
  const yawGroupRef = useRef<THREE.Group>(null);
  const pitchGroupRef = useRef<THREE.Group>(null);

  const active = lightingPreset === 'dusk' || lightingPreset === 'night';

  const { beamGeom, beamMat, flareMat } = useMemo(() => {
    // Open-ended cone extending forward along +Z from origin (0,0,0) -> (0,0,+beamLength)
    const geom = new THREE.CylinderGeometry(
      0.24 * housingScale,
      beamRadius,
      beamLength,
      26,
      1,
      true,
    );
    // CylinderGeometry runs +Y (top, rTop=0.24) to -Y (bottom, rBottom=beamRadius).
    // Rotate +X by -90 deg so top (uv.y=1) sits at z=0 and bottom (uv.y=0) extends to +Z!
    geom.translate(0, -beamLength * 0.5, 0);
    geom.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color('#FFD796') },
        uOpacity: { value: 0.32 },
        uTime: { value: 0 },
        uPhase: { value: phase },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const lensMat = new THREE.SpriteMaterial({
      map: getSharedLensFlareTexture(),
      color: new THREE.Color('#FFE4AE'),
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    return { beamGeom: geom, beamMat: mat, flareMat: lensMat };
  }, [beamLength, beamRadius, housingScale, phase]);

  useEffect(() => {
    return () => {
      beamGeom.dispose();
      beamMat.dispose();
      flareMat.dispose();
    };
  }, [beamGeom, beamMat, flareMat]);

  useEffect(() => {
    if (lightingPreset === 'night') {
      beamMat.uniforms.uColor.value.set('#FFE2A8');
      beamMat.uniforms.uOpacity.value = 0.34;
      flareMat.color.set('#FFF0C8');
      flareMat.opacity = 0.88;
    } else if (lightingPreset === 'dusk') {
      beamMat.uniforms.uColor.value.set('#FFD48A');
      beamMat.uniforms.uOpacity.value = 0.32;
      flareMat.color.set('#FFE0A2');
      flareMat.opacity = 0.78;
    } else {
      beamMat.uniforms.uOpacity.value = 0;
      flareMat.opacity = 0;
    }
  }, [lightingPreset, beamMat, flareMat]);

  // Ensure initial pose looks asymmetrical even on single-frame demand render
  useEffect(() => {
    if (yawGroupRef.current) {
      yawGroupRef.current.rotation.y = baseYaw + Math.sin(phase) * sweepAmp;
    }
    if (pitchGroupRef.current) {
      pitchGroupRef.current.rotation.x = basePitch + Math.sin(phase * 0.7) * 0.05;
    }
  }, [baseYaw, basePitch, sweepAmp, phase]);

  const { paused, clockRef } = useSceneSimulation();

  useFrame(() => {
    if (paused) return;
    if (!active) return;
    const t = clockRef.current.elapsed;
    beamMat.uniforms.uTime.value = t;
    if (isSoftwareGl && t < 0.05) return;

    if (yawGroupRef.current) {
      yawGroupRef.current.rotation.y =
        baseYaw + Math.sin(t * sweepSpeed + phase) * sweepAmp;
    }
    if (pitchGroupRef.current) {
      pitchGroupRef.current.rotation.x =
        basePitch + Math.sin(t * sweepSpeed * 0.65 + phase * 1.3) * 0.055;
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      {/* Armored turret base pedestal */}
      <mesh position={[0, 0.14 * housingScale, 0]} castShadow>
        <cylinderGeometry args={[0.3 * housingScale, 0.36 * housingScale, 0.28 * housingScale, 10]} />
        <meshStandardMaterial color="#4A545E" roughness={0.62} metalness={0.45} />
      </mesh>

      <group ref={yawGroupRef} position={[0, 0.42 * housingScale, 0]}>
        {/* Yoke arms */}
        {[-0.24 * housingScale, 0.24 * housingScale].map((ox, i) => (
          <mesh key={i} position={[ox, 0, 0]}>
            <boxGeometry args={[0.08 * housingScale, 0.32 * housingScale, 0.14 * housingScale]} />
            <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.5} />
          </mesh>
        ))}

        <group ref={pitchGroupRef}>
          {/* Searchlight projector drum */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.25 * housingScale, 0.21 * housingScale, 0.44 * housingScale, 12]} />
            <meshStandardMaterial color="#3A434C" roughness={0.52} metalness={0.6} />
          </mesh>

          {/* Emissive amber-white lens face */}
          <mesh position={[0, 0, 0.23 * housingScale]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.21 * housingScale, 0.21 * housingScale, 0.04 * housingScale, 12]} />
            <meshBasicMaterial
              color={lightingPreset === 'night' ? '#FFF0C9' : '#FFD38A'}
              toneMapped={false}
            />
          </mesh>

          {/* Blinding optical starburst lens flare sprite */}
          <sprite
            position={[0, 0, 0.28 * housingScale]}
            scale={[2.25 * housingScale, 2.25 * housingScale, 1]}
            material={flareMat}
          />

          {/* Volumetric additive Fresnel shaft with scrolling dust & near-camera fade */}
          <mesh
            position={[0, 0, 0.24 * housingScale]}
            geometry={beamGeom}
            material={beamMat}
            frustumCulled={false}
          />
        </group>
      </group>
    </group>
  );
}
