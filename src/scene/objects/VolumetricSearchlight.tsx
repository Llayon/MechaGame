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

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
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

  void main() {
    // Dissolve silhouette edges smoothly so no hard geometric cone edge is ever visible
    float ndotv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float edgeSoft = pow(clamp(ndotv, 0.0, 1.0), 2.35);

    // vUv.y = 1.0 at projector lens -> 0.0 at beam tip
    float nearLens = smoothstep(1.0, 0.94, vUv.y);
    float distFade = pow(clamp(vUv.y, 0.0, 1.0), 1.65) * smoothstep(0.0, 0.24, vUv.y);

    // Subtle drifting mist/dust filaments inside the light shaft
    float mist = 0.84 + 0.16 * sin(vUv.x * 12.56637 + uTime * 0.42 + uPhase)
                             * cos(vUv.y * 7.5 - uTime * 0.35 + uPhase * 0.5);

    float coreBoost = 1.0 + 0.75 * pow(clamp(vUv.y, 0.0, 1.0), 2.4);
    float alpha = edgeSoft * nearLens * distFade * mist * uOpacity;

    gl_FragColor = vec4(uColor * coreBoost, alpha);
  }
`;

/**
 * Gimballed tactical searchlight housing + custom Fresnel-softened additive volumetric
 * cone shader. Active in dusk and night presets for Citadel bastions and bridge KPP.
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

  const { beamGeom, beamMat } = useMemo(() => {
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
      side: THREE.FrontSide,
      toneMapped: false,
    });

    return { beamGeom: geom, beamMat: mat };
  }, [beamLength, beamRadius, housingScale, phase]);

  useEffect(() => {
    return () => {
      beamGeom.dispose();
      beamMat.dispose();
    };
  }, [beamGeom, beamMat]);

  useEffect(() => {
    if (lightingPreset === 'night') {
      beamMat.uniforms.uColor.value.set('#FFE2A8');
      beamMat.uniforms.uOpacity.value = 0.5;
    } else if (lightingPreset === 'dusk') {
      beamMat.uniforms.uColor.value.set('#FFD48A');
      beamMat.uniforms.uOpacity.value = 0.48;
    } else {
      beamMat.uniforms.uOpacity.value = 0;
    }
  }, [lightingPreset, beamMat]);

  // Ensure initial pose looks asymmetrical even on single-frame demand render
  useEffect(() => {
    if (yawGroupRef.current) {
      yawGroupRef.current.rotation.y = baseYaw + Math.sin(phase) * sweepAmp;
    }
    if (pitchGroupRef.current) {
      pitchGroupRef.current.rotation.x = basePitch + Math.sin(phase * 0.7) * 0.05;
    }
  }, [baseYaw, basePitch, sweepAmp, phase]);

  useFrame((state) => {
    if (!active) return;
    const t = state.clock.getElapsedTime();
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

          {/* Volumetric additive Fresnel shaft */}
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
