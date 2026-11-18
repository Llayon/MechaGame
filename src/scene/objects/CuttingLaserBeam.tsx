import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import { CUTTING_LASER_CONFIG } from '../../game/combatSimulation';
import type { CombatSimulationState } from '../../game/combatTypes';
import { traceLaserCut, type CraterPoolState, type LaserCutPoint } from './craterPool';

export interface CuttingLaserBeamProps {
  combatRef: React.MutableRefObject<CombatSimulationState>;
  craterPoolRef: React.MutableRefObject<CraterPoolState>;
  resetNonce: number;
}

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

function createLaserSheathMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  float wave = 0.78 + 0.22 * sin( vUv.y * 42.0 - uTime * 32.0 );
  float fine = 0.85 + 0.15 * cos( vUv.y * 85.0 + uTime * 48.0 );
  float endFade = smoothstep( 0.0, 0.03, vUv.y ) * ( 1.0 - smoothstep( 0.96, 1.0, vUv.y ) );
  vec3 outerCol = vec3( 0.20, 0.92, 1.0 );
  vec3 hotEdge = vec3( 0.90, 0.99, 1.0 );
  float coreBand = smoothstep( 0.25, 0.85, wave * fine );
  vec3 col = mix( outerCol, hotEdge, coreBand * 0.45 );
  float alpha = clamp( endFade * wave * 0.72 * uIntensity, 0.0, 0.95 );
  gl_FragColor = vec4( col * ( 1.35 * uIntensity ), alpha );
}
`,
  });
}

/**
 * Continuous-wave industrial plasma cutting beam ("Луч-7") with inner plasma core,
 * additive harmonic sheath, impact hotspot flare, and continuous molten-slag trench tracing.
 */
export function CuttingLaserBeam({
  combatRef,
  craterPoolRef,
  resetNonce,
}: CuttingLaserBeamProps) {
  const { paused } = useSceneSimulation();
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const sheathRef = useRef<THREE.Mesh>(null);
  const muzzleFlareRef = useRef<THREE.Mesh>(null);
  const impactFlareRef = useRef<THREE.Mesh>(null);
  const lastCutRef = useRef<LaserCutPoint | null>(null);
  const animTimeRef = useRef(0);
  const prevResetNonceRef = useRef(resetNonce);

  const assets = useMemo(() => {
    const coreGeom = new THREE.CylinderGeometry(0.055, 0.055, 1.0, 8, 1, true);
    const sheathGeom = new THREE.CylinderGeometry(0.15, 0.21, 1.0, 10, 1, true);
    const flareGeom = new THREE.IcosahedronGeometry(0.28, 1);

    const coreMat = new THREE.MeshBasicMaterial({
      color: '#ecfeff',
      transparent: true,
      opacity: 0.96,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    const sheathMat = createLaserSheathMaterial();
    const flareMat = new THREE.MeshBasicMaterial({
      color: '#ff9b3d',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    const muzzleFlareMat = new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });

    return {
      coreGeom,
      sheathGeom,
      flareGeom,
      coreMat,
      sheathMat,
      flareMat,
      muzzleFlareMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      assets.coreGeom.dispose();
      assets.sheathGeom.dispose();
      assets.flareGeom.dispose();
      assets.coreMat.dispose();
      assets.sheathMat.dispose();
      assets.flareMat.dispose();
      assets.muzzleFlareMat.dispose();
    };
  }, [assets]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    lastCutRef.current = null;
    if (groupRef.current) groupRef.current.visible = false;
  }, [resetNonce]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    animTimeRef.current += dt;

    const grp = groupRef.current;
    const beam = combatRef.current.laserBeam;
    if (!grp) return;

    if (!beam) {
      grp.visible = false;
      lastCutRef.current = null;
      return;
    }

    _from.set(beam.x0, beam.y0, beam.z0);
    _to.set(beam.x1, beam.y1, beam.z1);
    _dir.subVectors(_to, _from);
    const len = _dir.length();
    if (len < 0.05) {
      grp.visible = false;
      lastCutRef.current = null;
      return;
    }

    grp.visible = true;
    const pulse = 0.88 + 0.12 * Math.sin(animTimeRef.current * 44.0);
    assets.sheathMat.uniforms.uTime.value = animTimeRef.current;
    assets.sheathMat.uniforms.uIntensity.value = beam.intensity * pulse;

    _dir.multiplyScalar(1 / len);
    _quat.setFromUnitVectors(_upAxis, _dir);

    if (coreRef.current) {
      coreRef.current.position.copy(_from).addScaledVector(_dir, len * 0.5);
      coreRef.current.quaternion.copy(_quat);
      const w = beam.intensity * pulse;
      coreRef.current.scale.set(w, len, w);
    }

    if (sheathRef.current) {
      sheathRef.current.position.copy(_from).addScaledVector(_dir, len * 0.5);
      sheathRef.current.quaternion.copy(_quat);
      const w = (0.95 + 0.25 * beam.intensity) * pulse;
      sheathRef.current.scale.set(w, len, w);
    }

    if (muzzleFlareRef.current) {
      muzzleFlareRef.current.position.copy(_from);
      const ms = 0.85 + 0.28 * Math.sin(animTimeRef.current * 36.0);
      muzzleFlareRef.current.scale.setScalar(ms);
    }

    if (impactFlareRef.current) {
      if (beam.hasImpact && !beam.inWater) {
        impactFlareRef.current.visible = true;
        impactFlareRef.current.position.set(
          beam.x1 + beam.nx * 0.08,
          beam.y1 + beam.ny * 0.08,
          beam.z1 + beam.nz * 0.08,
        );
        const hs = (beam.onEnemy ? 1.45 : 1.15) * (0.85 + 0.25 * Math.cos(animTimeRef.current * 52.0));
        impactFlareRef.current.scale.setScalar(hs);
      } else {
        impactFlareRef.current.visible = false;
      }
    }

    if (beam.hasImpact && !beam.onEnemy && !beam.inWater) {
      lastCutRef.current = traceLaserCut(
        craterPoolRef.current,
        lastCutRef.current,
        beam.x1,
        beam.y1,
        beam.z1,
        beam.nx,
        beam.ny,
        beam.nz,
        CUTTING_LASER_CONFIG.slagRadius,
        lastCutRef.current ?? undefined,
      );
    } else {
      lastCutRef.current = null;
    }
  });

  return (
    <group ref={groupRef} visible={false} name="cutting-laser-beam">
      <mesh
        ref={coreRef}
        geometry={assets.coreGeom}
        material={assets.coreMat}
        frustumCulled={false}
        renderOrder={7}
      />
      <mesh
        ref={sheathRef}
        geometry={assets.sheathGeom}
        material={assets.sheathMat}
        frustumCulled={false}
        renderOrder={7}
      />
      <mesh
        ref={muzzleFlareRef}
        geometry={assets.flareGeom}
        material={assets.muzzleFlareMat}
        frustumCulled={false}
        renderOrder={8}
      />
      <mesh
        ref={impactFlareRef}
        geometry={assets.flareGeom}
        material={assets.flareMat}
        frustumCulled={false}
        renderOrder={8}
      />
    </group>
  );
}
