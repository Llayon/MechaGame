import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSceneSimulation } from '../SceneSimulation';
import type { LightingPreset } from '../../map/sectors';
import {
  MAX_WATER_RIPPLES,
  MAX_WATER_SPLASHES,
  computeRippleTransform,
  computeSplashTransform,
  resetWaterVfxPool,
  stepWaterVfxPool,
  type RippleTransform,
  type SplashTransform,
  type WaterVfxPoolState,
} from './waterVfxPool';

export interface WaterEffectsProps {
  poolRef: React.MutableRefObject<WaterVfxPoolState>;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  resetNonce: number;
}

const FOAM_TINTS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#E8F6FC'),
  dusk: new THREE.Color('#F2DED4'),
  night: new THREE.Color('#6F9BB8'),
};

const _dummy = new THREE.Object3D();
const _zeroMat4 = new THREE.Matrix4().makeScale(0, 0, 0);
const _rippleTf: RippleTransform = {
  x: 0,
  y: 0,
  z: 0,
  scale: 0,
  alpha: 0,
  progress: 0,
};
const _splashTf: SplashTransform = {
  x: 0,
  y: 0,
  z: 0,
  scaleX: 0,
  scaleY: 0,
  alpha: 0,
  progress: 0,
};

export function WaterEffects({
  poolRef,
  lightingPreset,
  isSoftwareGl,
  resetNonce,
}: WaterEffectsProps) {
  const { paused } = useSceneSimulation();
  const rippleMeshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  const hadActiveRipplesRef = useRef(false);
  const hadActiveSplashesRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);

  const rippleSetup = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI * 0.5);

    const alphas = new Float32Array(MAX_WATER_RIPPLES);
    const progresses = new Float32Array(MAX_WATER_RIPPLES);
    const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
    const progressAttr = new THREE.InstancedBufferAttribute(progresses, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    progressAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('aAlpha', alphaAttr);
    geom.setAttribute('aProgress', progressAttr);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFoamTint: { value: FOAM_TINTS.day.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aProgress;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vProgress;

        void main() {
          vUv = uv;
          vAlpha = aAlpha;
          vProgress = aProgress;

          vec4 mvPosition = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFoamTint;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vProgress;

        void main() {
          if (vAlpha <= 0.002) discard;

          float dist = length(vUv - 0.5) * 2.0;
          if (dist > 1.0) discard;

          // Primary expanding outer wave crest (strictly ascending smoothstep edges)
          float outerFade = 1.0 - smoothstep(0.86, 1.0, dist);
          float mainRing = smoothstep(0.62, 0.82, dist) * outerFade;

          // Secondary concentric interference ripples radiating outward
          float rippleWave = sin((dist - vProgress * 0.42) * 26.0) * 0.5 + 0.5;
          float ripples = pow(rippleWave, 4.0) * smoothstep(0.14, 0.48, dist) * (1.0 - dist);

          // Soft aerated foam core early in splash life
          float foamCore = (1.0 - smoothstep(0.0, 0.42, dist)) * (1.0 - vProgress) * 0.48;

          float intensity = clamp(mainRing * 0.85 + ripples * 0.48 + foamCore, 0.0, 1.0);
          float finalAlpha = intensity * vAlpha;
          if (finalAlpha <= 0.01) discard;

          gl_FragColor = vec4(uFoamTint, finalAlpha);
        }
      `,
    });

    return { geom, mat, alphas, progresses, alphaAttr, progressAttr };
  }, []);

  const splashSetup = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);

    const alphas = new Float32Array(MAX_WATER_SPLASHES);
    const progresses = new Float32Array(MAX_WATER_SPLASHES);
    const alphaAttr = new THREE.InstancedBufferAttribute(alphas, 1);
    const progressAttr = new THREE.InstancedBufferAttribute(progresses, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    progressAttr.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('aAlpha', alphaAttr);
    geom.setAttribute('aProgress', progressAttr);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFoamTint: { value: FOAM_TINTS.day.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aProgress;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vProgress;

        void main() {
          vUv = uv;
          vAlpha = aAlpha;
          vProgress = aProgress;

          vec4 mvPosition = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFoamTint;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vProgress;

        void main() {
          if (vAlpha <= 0.002) discard;

          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          // Procedural mist plume + crisp satellite droplet beads (zero textures)
          float coreMist = (1.0 - smoothstep(0.08, 0.88, r)) * 0.58;
          float drop1 = 1.0 - smoothstep(0.06, 0.24, length(p - vec2(-0.34, 0.36)));
          float drop2 = 1.0 - smoothstep(0.05, 0.22, length(p - vec2(0.38, 0.24)));
          float drop3 = 1.0 - smoothstep(0.05, 0.20, length(p - vec2(-0.22, -0.40)));
          float drop4 = 1.0 - smoothstep(0.06, 0.23, length(p - vec2(0.30, -0.30)));
          float drop5 = 1.0 - smoothstep(0.05, 0.19, length(p - vec2(0.02, 0.52)));

          float drops = clamp(drop1 + drop2 + drop3 + drop4 + drop5, 0.0, 1.0) * 0.85;
          float shape = clamp(max(coreMist, drops), 0.0, 1.0);
          float finalAlpha = shape * vAlpha * (1.0 - vProgress * 0.35);
          if (finalAlpha <= 0.01) discard;

          gl_FragColor = vec4(uFoamTint, finalAlpha);
        }
      `,
    });

    return { geom, mat, alphas, progresses, alphaAttr, progressAttr };
  }, []);

  useEffect(() => {
    const tint = FOAM_TINTS[lightingPreset];
    rippleSetup.mat.uniforms.uFoamTint.value.copy(tint);
    splashSetup.mat.uniforms.uFoamTint.value.copy(tint);
  }, [lightingPreset, rippleSetup, splashSetup]);

  useEffect(() => {
    const rMesh = rippleMeshRef.current;
    const sMesh = splashMeshRef.current;
    if (rMesh) {
      rMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_WATER_RIPPLES; i++) {
        rMesh.setMatrixAt(i, _zeroMat4);
        rippleSetup.alphas[i] = 0;
        rippleSetup.progresses[i] = 0;
      }
      rMesh.instanceMatrix.needsUpdate = true;
      rippleSetup.alphaAttr.needsUpdate = true;
      rippleSetup.progressAttr.needsUpdate = true;
    }
    if (sMesh) {
      sMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_WATER_SPLASHES; i++) {
        sMesh.setMatrixAt(i, _zeroMat4);
        splashSetup.alphas[i] = 0;
        splashSetup.progresses[i] = 0;
      }
      sMesh.instanceMatrix.needsUpdate = true;
      splashSetup.alphaAttr.needsUpdate = true;
      splashSetup.progressAttr.needsUpdate = true;
    }
    return () => {
      rippleSetup.geom.dispose();
      rippleSetup.mat.dispose();
      splashSetup.geom.dispose();
      splashSetup.mat.dispose();
    };
  }, [rippleSetup, splashSetup]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetWaterVfxPool(poolRef.current);
    hadActiveRipplesRef.current = true;
    hadActiveSplashesRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame(({ camera }, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    const hadRipples = hadActiveRipplesRef.current || pool.activeRipples > 0;
    const hadSplashes = hadActiveSplashesRef.current || pool.activeSplashes > 0;
    if (isSoftwareGl && !hadRipples && !hadSplashes) return;

    const { activeRipples, activeSplashes } = stepWaterVfxPool(pool, dt);

    const rMesh = rippleMeshRef.current;
    if (rMesh && (activeRipples > 0 || hadRipples)) {
      for (let i = 0; i < MAX_WATER_RIPPLES; i++) {
        if (computeRippleTransform(pool.ripples[i], _rippleTf)) {
          _dummy.position.set(_rippleTf.x, _rippleTf.y, _rippleTf.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(_rippleTf.scale, 1.0, _rippleTf.scale);
          _dummy.updateMatrix();
          rMesh.setMatrixAt(i, _dummy.matrix);
          rippleSetup.alphas[i] = _rippleTf.alpha;
          rippleSetup.progresses[i] = _rippleTf.progress;
        } else {
          rMesh.setMatrixAt(i, _zeroMat4);
          rippleSetup.alphas[i] = 0;
          rippleSetup.progresses[i] = 0;
        }
      }
      rMesh.instanceMatrix.needsUpdate = true;
      rippleSetup.alphaAttr.needsUpdate = true;
      rippleSetup.progressAttr.needsUpdate = true;
      hadActiveRipplesRef.current = activeRipples > 0;
    }

    const sMesh = splashMeshRef.current;
    if (sMesh && (activeSplashes > 0 || hadSplashes)) {
      for (let i = 0; i < MAX_WATER_SPLASHES; i++) {
        if (computeSplashTransform(pool.splashes[i], _splashTf)) {
          _dummy.position.set(_splashTf.x, _splashTf.y, _splashTf.z);
          _dummy.quaternion.copy(camera.quaternion);
          _dummy.scale.set(_splashTf.scaleX, _splashTf.scaleY, 1.0);
          _dummy.updateMatrix();
          sMesh.setMatrixAt(i, _dummy.matrix);
          splashSetup.alphas[i] = _splashTf.alpha;
          splashSetup.progresses[i] = _splashTf.progress;
        } else {
          sMesh.setMatrixAt(i, _zeroMat4);
          splashSetup.alphas[i] = 0;
          splashSetup.progresses[i] = 0;
        }
      }
      sMesh.instanceMatrix.needsUpdate = true;
      splashSetup.alphaAttr.needsUpdate = true;
      splashSetup.progressAttr.needsUpdate = true;
      hadActiveSplashesRef.current = activeSplashes > 0;
    }
  });

  return (
    <group name="water-surface-effects">
      <instancedMesh
        ref={rippleMeshRef}
        args={[rippleSetup.geom, rippleSetup.mat, MAX_WATER_RIPPLES]}
        frustumCulled={false}
        renderOrder={3}
      />
      <instancedMesh
        ref={splashMeshRef}
        args={[splashSetup.geom, splashSetup.mat, MAX_WATER_SPLASHES]}
        frustumCulled={false}
        renderOrder={3}
      />
    </group>
  );
}
