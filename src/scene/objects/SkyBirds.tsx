import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import { createBirdGeometry, generateSkyBirdsData } from '../../map/skyBirds';

export interface SkyBirdsProps {
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
}

const SILHOUETTE_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#1B232E'),
  dusk: new THREE.Color('#231C22'),
  night: new THREE.Color('#0E141D'),
};

const RIM_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#3C4D63'),
  dusk: new THREE.Color('#6F4736'),
  night: new THREE.Color('#172434'),
};

/**
 * GPU-animated soaring bird flocks (1 Draw Call, 0% CPU per-frame loop).
 * Active in `day` and `dusk` high above Citadel, Quarry, and Northern ridges.
 */
export function SkyBirds({ lightingPreset, isSoftwareGl }: SkyBirdsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const birds = useMemo(() => generateSkyBirdsData(), []);

  const uniformsRef = useRef({
    uTime: { value: 2.4 },
    uRimColor: { value: RIM_COLORS[lightingPreset].clone() },
  });

  const geometry = useMemo(() => {
    const geom = createBirdGeometry();
    const count = birds.length;

    const anchorAttr = new Float32Array(count * 3);
    const orbitAttr = new Float32Array(count * 4);
    const flightAttr = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const b = birds[i];
      anchorAttr[i * 3] = b.anchor[0];
      anchorAttr[i * 3 + 1] = b.anchor[1];
      anchorAttr[i * 3 + 2] = b.anchor[2];

      orbitAttr[i * 4] = b.radius;
      orbitAttr[i * 4 + 1] = b.angularSpeed;
      orbitAttr[i * 4 + 2] = b.phase;
      orbitAttr[i * 4 + 3] = b.bobAmp;

      flightAttr[i * 4] = b.flapSpeed;
      flightAttr[i * 4 + 1] = b.flapPhase;
      flightAttr[i * 4 + 2] = b.scale;
      flightAttr[i * 4 + 3] = b.angularSpeed >= 0 ? 1.0 : -1.0;
    }

    geom.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anchorAttr, 3));
    geom.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbitAttr, 4));
    geom.setAttribute('aFlight', new THREE.InstancedBufferAttribute(flightAttr, 4));
    return geom;
  }, [birds]);

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: SILHOUETTE_COLORS.dusk.clone(),
      side: THREE.DoubleSide,
      fog: true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniformsRef.current.uTime;
      shader.uniforms.uRimColor = uniformsRef.current.uRimColor;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aWingWeight;
attribute vec3 aAnchor;
attribute vec4 aOrbit;
attribute vec4 aFlight;
uniform float uTime;
varying float vWingWeight;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWingWeight = aWingWeight;

float radius = aOrbit.x;
float angSpeed = aOrbit.y;
float phase = aOrbit.z;
float bobAmp = aOrbit.w;

float flapSpeed = aFlight.x;
float flapPhase = aFlight.y;
float birdScale = aFlight.z;
float dirSign = aFlight.w;

// Alternates between active wingbeats and thermal gliding
float soarCycle = sin( uTime * 0.65 + flapPhase * 2.13 );
float flapActivity = smoothstep( -0.15, 0.45, soarCycle );
float beat = sin( uTime * flapSpeed + flapPhase * 6.2831853 );
float glideLift = ( 1.0 - flapActivity ) * 0.14;
float wingY = beat * ( 0.12 + 0.56 * flapActivity ) + glideLift;

vec3 localP = position;
localP.y += wingY * aWingWeight;
localP *= birdScale;

// Circular orbit around sky landmark anchor + slow vertical thermal bobbing
float theta = phase + uTime * angSpeed;
float cT = cos( theta );
float sT = sin( theta );
vec3 center = vec3(
  aAnchor.x + cT * radius,
  aAnchor.y + sin( uTime * 0.55 + phase * 1.7 ) * bobAmp,
  aAnchor.z + sT * radius
);

vec3 fwd = normalize( vec3( -sT * dirSign, 0.0, cT * dirSign ) );
vec3 upVec = vec3( 0.0, 1.0, 0.0 );
vec3 rightVec = normalize( cross( fwd, upVec ) );

// Bank wings slightly inward toward circle center
float bankAngle = 0.28 * dirSign * ( 1.0 - 0.35 * flapActivity );
float cB = cos( bankAngle );
float sB = sin( bankAngle );
vec3 bankedRight = rightVec * cB - upVec * sB;
vec3 bankedUp = upVec * cB + rightVec * sB;

transformed = center
  + bankedRight * localP.x
  + bankedUp * localP.y
  + fwd * localP.z;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uRimColor;
varying float vWingWeight;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
diffuseColor.rgb = mix( diffuseColor.rgb, uRimColor, vWingWeight * 0.36 );`,
        );
    };

    mat.customProgramCacheKey = () => 'sector7-sky-birds-v1';
    return mat;
  }, []);

  useEffect(() => {
    material.color.copy(SILHOUETTE_COLORS[lightingPreset]);
    uniformsRef.current.uRimColor.value.copy(RIM_COLORS[lightingPreset]);
  }, [lightingPreset, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const identity = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < birds.length; i++) {
      mesh.setMatrixAt(i, identity);
      const [r, g, b] = birds[i].tint;
      color.setRGB(r, g, b);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [birds]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const visible = lightingPreset !== 'night';

  useFrame((_, delta) => {
    if (!visible) return;
    if (!isSoftwareGl) {
      uniformsRef.current.uTime.value += Math.min(delta, 0.05);
    } else {
      uniformsRef.current.uTime.value = 2.4;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, birds.length]}
      visible={visible}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
