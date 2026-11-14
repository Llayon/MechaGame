import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';

export interface VolumetricSunShaftsProps {
  lightingPreset: LightingPreset;
  sunPos: readonly [number, number, number];
  visible: boolean;
  isSoftwareGl: boolean;
}

interface ShaftSpec {
  id: string;
  /** World-space anchor around mid-valley / canyon floor target. */
  target: readonly [number, number, number];
  /** Upper radius near ridge saddle. */
  topRadius: number;
  /** Lower flared radius over road/river. */
  bottomRadius: number;
  /** Length along sun vector. */
  length: number;
  /** Phase offset for subtle filament drift. */
  phase: number;
  /** Individual opacity weight. */
  weight: number;
}

// 5 wide shafts aligned to natural ridge saddles left/right of Citadel & canyon river gaps
const VALLEY_SHAFTS: readonly ShaftSpec[] = [
  {
    id: 'saddle-west-viaduct',
    target: [28, 12, -32],
    topRadius: 12,
    bottomRadius: 27,
    length: 135,
    phase: 0.4,
    weight: 1.0,
  },
  {
    id: 'saddle-east-quarry',
    target: [84, 8, 14],
    topRadius: 14,
    bottomRadius: 30,
    length: 132,
    phase: 1.9,
    weight: 0.92,
  },
  {
    id: 'north-channel-bridge-a',
    target: [-54, 4, -48],
    topRadius: 13,
    bottomRadius: 28,
    length: 128,
    phase: 3.1,
    weight: 0.95,
  },
  {
    id: 'south-spine-center-bridge',
    target: [-50, 4, 24],
    topRadius: 11,
    bottomRadius: 26,
    length: 126,
    phase: 4.5,
    weight: 0.88,
  },
  {
    id: 'se-gorge-river-mist',
    target: [26, 2, 46],
    topRadius: 15,
    bottomRadius: 34,
    length: 138,
    phase: 5.6,
    weight: 0.85,
  },
];

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying float vViewDist;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vViewDist = length(mvPos.xyz);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying float vViewDist;

  void main() {
    // 1. Dissolve cone edges via view-space Fresnel so there are no visible geometric borders
    float ndotv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float edgeSoft = pow(clamp(ndotv, 0.0, 1.0), 2.55);

    // 2. Feather softly at both ridge entry (vUv.y=1) and canyon floor (vUv.y=0)
    float upperFade = smoothstep(1.0, 0.72, vUv.y);
    float lowerFade = smoothstep(0.0, 0.34, vUv.y);

    // 3. Soften smoothly when driving the Mech directly through a sunbeam
    float camNearFade = smoothstep(4.5, 22.0, vViewDist);

    // 4. Organic multi-band streaks breaking wide beams into drifting sun rays
    float bandA = 0.65 + 0.35 * sin(vUv.x * 18.84955 + uPhase + uTime * 0.14);
    float bandB = 0.72 + 0.28 * cos(vUv.x * 31.41592 - uPhase * 1.4 - uTime * 0.1);
    float streaks = clamp(bandA * bandB, 0.22, 1.15);

    // 5. Mild Mie forward-scattering boost when looking toward the sun
    vec3 rayFromCam = normalize(vWorldPos - cameraPosition);
    float sunAlign = clamp(dot(rayFromCam, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
    float scatter = mix(0.68, 1.32, pow(sunAlign, 2.1));

    float alpha = edgeSoft * upperFade * lowerFade * camNearFade * streaks * scatter * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const _axisY = new THREE.Vector3(0, 1, 0);

/**
 * Wide atmospheric volumetric sun shafts cutting across ridge saddles and the river gorge.
 * Rich warm golden depth in Dusk ("Закат"), subtly attenuated (~80% dimmer) in Day ("День"),
 * and disabled at Night.
 */
export function VolumetricSunShafts({
  lightingPreset,
  sunPos,
  visible,
  isSoftwareGl,
}: VolumetricSunShaftsProps) {
  const active = visible && lightingPreset !== 'night';
  const groupRef = useRef<THREE.Group>(null);

  const sunDir = useMemo(() => {
    // Use ~13.8 deg golden-hour elevation in Dusk so beams slant cleanly through ridge saddles
    const y = lightingPreset === 'dusk' ? 64 : sunPos[1];
    return new THREE.Vector3(sunPos[0], y, sunPos[2]).normalize();
  }, [lightingPreset, sunPos]);

  const shaftEntries = useMemo(() => {
    return VALLEY_SHAFTS.map((spec) => {
      const geom = new THREE.CylinderGeometry(
        spec.topRadius,
        spec.bottomRadius,
        spec.length,
        24,
        1,
        true,
      );
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new THREE.Color('#FFC074') },
          uSunDir: { value: new THREE.Vector3(0.4, 0.3, -0.85).normalize() },
          uOpacity: { value: 0.14 },
          uTime: { value: 0 },
          uPhase: { value: spec.phase },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false,
      });
      return { spec, geom, mat };
    });
  }, []);

  useEffect(() => {
    return () => {
      shaftEntries.forEach(({ geom, mat }) => {
        geom.dispose();
        mat.dispose();
      });
    };
  }, [shaftEntries]);

  useEffect(() => {
    const baseOpacity = lightingPreset === 'dusk' ? 0.24 : lightingPreset === 'day' ? 0.042 : 0;
    const colorHex = lightingPreset === 'dusk' ? '#FFC278' : '#FFF1CE';

    shaftEntries.forEach(({ spec, mat }) => {
      mat.uniforms.uColor.value.set(colorHex);
      mat.uniforms.uSunDir.value.copy(sunDir);
      mat.uniforms.uOpacity.value = baseOpacity * spec.weight;
    });
  }, [lightingPreset, sunDir, shaftEntries]);

  const shaftTransforms = useMemo(() => {
    const quat = new THREE.Quaternion().setFromUnitVectors(_axisY, sunDir);
    return shaftEntries.map(({ spec, geom, mat }) => {
      // Position cylinder center offset partway up sunDir from the valley target
      const center = new THREE.Vector3(
        spec.target[0],
        spec.target[1],
        spec.target[2],
      ).addScaledVector(sunDir, spec.length * 0.44);
      return { id: spec.id, center, quat, geom, mat };
    });
  }, [sunDir, shaftEntries]);

  useFrame((state) => {
    if (!active || isSoftwareGl) return;
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < shaftEntries.length; i++) {
      shaftEntries[i].mat.uniforms.uTime.value = t;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {shaftTransforms.map((s) => (
        <mesh
          key={s.id}
          position={s.center}
          quaternion={s.quat}
          geometry={s.geom}
          material={s.mat}
          frustumCulled={false}
          renderOrder={4}
        />
      ))}
    </group>
  );
}
