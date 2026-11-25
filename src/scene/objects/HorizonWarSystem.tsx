import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import {
  HORIZON_SMOKE_PLUMES,
  HORIZON_WAR_MAX_FLASHES,
  HORIZON_WAR_MAX_TRACERS,
  createDistantCruisersGeometry,
  createHorizonWarState,
  seedInitialHorizonWarAction,
  stepHorizonWar,
} from '../../map/horizonWar';
import { combatAudio } from '../../game/combatAudio';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';

export interface HorizonWarSystemProps {
  visible: boolean;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  isSoftwareGl: boolean;
}

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _color = new THREE.Color();

const SMOKE_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#1E242B'),
  dusk: new THREE.Color('#131217'),
  night: new THREE.Color('#070A0F'),
};

const SMOKE_FOG_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#7FA8D2'),
  dusk: new THREE.Color('#6C5E5A'),
  night: new THREE.Color('#0B1420'),
};

const SMOKE_OPACITY: Record<LightingPreset, number> = {
  day: 0.68,
  dusk: 0.76,
  night: 0.58,
};

function createTracerStreakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.88)');
  grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.25)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(6, 0, 20, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBurstFlashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.16, 'rgba(255, 240, 200, 0.92)');
  grad.addColorStop(0.42, 'rgba(255, 150, 60, 0.35)');
  grad.addColorStop(1.0, 'rgba(255, 80, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const SMOKE_VERTEX_SHADER = /* glsl */ `
  attribute float aPlumePhase;
  attribute float aPlumeSpeed;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying float vPhase;
  varying float vSpeed;

  void main() {
    vUv = uv;
    vPhase = aPlumePhase;
    vSpeed = aPlumeSpeed;

    vec4 mvPos = vec4( position, 1.0 );
    #ifdef USE_INSTANCING
      mvPos = instanceMatrix * mvPos;
    #endif
    mvPos = modelViewMatrix * mvPos;

    vec3 n = normal;
    #ifdef USE_INSTANCING
      n = mat3( instanceMatrix ) * n;
    #endif
    vNormalView = normalize( normalMatrix * n );
    vViewDir = normalize( -mvPos.xyz );
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SMOKE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uSmokeColor;
  uniform vec3 uFogColor;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying float vPhase;
  varying float vSpeed;

  float h2( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
  }

  float n2( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( h2( i ), h2( i + vec2( 1.0, 0.0 ) ), f.x ),
      mix( h2( i + vec2( 0.0, 1.0 ) ), h2( i + vec2( 1.0, 1.0 ) ), f.x ),
      f.y
    );
  }

  void main() {
    // Scroll billowing soot upward along column UV
    float scrollY = vUv.y * 3.4 - uTime * vSpeed + vPhase;
    float billowA = n2( vec2( vUv.x * 6.0 + vPhase, scrollY ) );
    float billowB = n2( vec2( vUv.x * 12.0 - uTime * 0.04, scrollY * 2.1 ) );
    float soot = smoothstep( 0.24, 0.78, billowA * 0.65 + billowB * 0.35 );

    // Soft cylindrical Fresnel dissolve so column sides have no geometric seam
    float ndotv = abs( dot( normalize( vNormalView ), normalize( vViewDir ) ) );
    float sideSoft = pow( clamp( ndotv, 0.0, 1.0 ), 1.45 );

    // Feather base into mountain ridge and disperse high into sky
    float baseFade = smoothstep( 0.0, 0.12, vUv.y );
    float topFade = (1.0 - smoothstep( 0.22, 1.0, vUv.y ));

    float alpha = soot * sideSoft * baseFade * topFade * uOpacity;
    if ( alpha < 0.015 ) discard;

    // Subtle atmospheric haze blend toward distant horizon tint
    vec3 col = mix( uSmokeColor, uFogColor, smoothstep( 0.45, 1.0, vUv.y ) * 0.34 );
    gl_FragColor = vec4( col, alpha );
  }
`;

function syncWarInstancesToGpu(
  state: ReturnType<typeof createHorizonWarState>,
  tracerMesh: THREE.InstancedMesh,
  flashMesh: THREE.InstancedMesh,
  camera: THREE.Camera,
  intensityMul: number,
): void {
  let tracersUpdated = false;
  for (let i = 0; i < state.tracers.length; i++) {
    const t = state.tracers[i];
    if (!t.active) {
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      tracerMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    tracersUpdated = true;
    _dummy.position.set(t.x, t.y, t.z);

    if (t.isOrbital) {
      const shrink = Math.max(0.08, 1.0 - t.life / t.maxLife);
      const yawToCam = Math.atan2(camera.position.x - t.x, camera.position.z - t.z);
      _dummy.quaternion.setFromAxisAngle(_up, yawToCam);
      _dummy.scale.set(t.scaleX * shrink, t.scaleY, 1.0);
    } else {
      _dir.set(t.vx, t.vy, t.vz).normalize();
      _dummy.quaternion.setFromUnitVectors(_up, _dir);
      _dummy.scale.set(t.scaleX, t.scaleY, 1.0);
    }
    _dummy.updateMatrix();
    tracerMesh.setMatrixAt(i, _dummy.matrix);

    _color.setRGB(t.r * intensityMul, t.g * intensityMul, t.b * intensityMul);
    tracerMesh.setColorAt(i, _color);
  }
  tracerMesh.instanceMatrix.needsUpdate = true;
  if (tracersUpdated && tracerMesh.instanceColor) {
    tracerMesh.instanceColor.needsUpdate = true;
  }

  let flashesUpdated = false;
  for (let i = 0; i < state.flashes.length; i++) {
    const f = state.flashes[i];
    if (!f.active) {
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      flashMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    flashesUpdated = true;
    const progress = Math.min(1, Math.max(0, f.life / f.maxLife));
    const currentScale = Math.max(0.05, f.maxSize * Math.sin(progress * Math.PI));

    _dummy.position.set(f.x, f.y, f.z);
    _dummy.quaternion.copy(camera.quaternion);
    _dummy.scale.setScalar(currentScale);
    _dummy.updateMatrix();
    flashMesh.setMatrixAt(i, _dummy.matrix);

    const fade = intensityMul * (1.0 - progress * 0.35);
    _color.setRGB(f.r * fade, f.g * fade, f.b * fade);
    flashMesh.setColorAt(i, _color);
  }
  flashMesh.instanceMatrix.needsUpdate = true;
  if (flashesUpdated && flashMesh.instanceColor) {
    flashMesh.instanceColor.needsUpdate = true;
  }
}

/**
 * 4-layer distant Horizon War orchestra beyond the northern mountain ring:
 *   1. Hovering Old-World dreadnought silhouettes (1 Draw Call)
 *   2. Slow billowing black smoke columns with scrolling GLSL noise (1 Draw Call)
 *   3. Opposing anti-air orange & cyan plasma tracer volleys + Orbital strikes (1 Draw Call)
 *   4. Billboarded flak airburst & artillery horizon flashes (1 Draw Call)
 */
export function HorizonWarSystem({
  visible,
  lightingPreset,
  driveMode,
  isSoftwareGl,
}: HorizonWarSystemProps) {
  const { camera } = useThree();
  const tracerMeshRef = useRef<THREE.InstancedMesh>(null);
  const flashMeshRef = useRef<THREE.InstancedMesh>(null);
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);

  const warStateRef = useRef<ReturnType<typeof createHorizonWarState> | null>(null);
  if (!warStateRef.current) {
    const s = createHorizonWarState();
    seedInitialHorizonWarAction(s);
    warStateRef.current = s;
  }

  const intensityMul = lightingPreset === 'day' ? 0.85 : lightingPreset === 'dusk' ? 1.15 : 1.25;

  // 1. Distant sky cruiser silhouettes (1 merged geometry)
  const cruiserBundle = useMemo(() => {
    const geom = createDistantCruisersGeometry();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.25,
      flatShading: true,
      fog: true,
    });
    return { geom, mat };
  }, []);

  // 2. Giant billowing horizon smoke columns (1 InstancedMesh)
  const smokeBundle = useMemo(() => {
    const geom = new THREE.CylinderGeometry(1, 0.36, 1, 16, 1, true);
    geom.translate(0, 0.5, 0);

    const count = HORIZON_SMOKE_PLUMES.length;
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phases[i] = HORIZON_SMOKE_PLUMES[i].phase;
      speeds[i] = HORIZON_SMOKE_PLUMES[i].speed;
    }
    geom.setAttribute('aPlumePhase', new THREE.InstancedBufferAttribute(phases, 1));
    geom.setAttribute('aPlumeSpeed', new THREE.InstancedBufferAttribute(speeds, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX_SHADER,
      fragmentShader: SMOKE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 2.5 },
        uOpacity: { value: SMOKE_OPACITY.dusk },
        uSmokeColor: { value: SMOKE_COLORS.dusk.clone() },
        uFogColor: { value: SMOKE_FOG_COLORS.dusk.clone() },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    return { geom, mat };
  }, []);

  // 3. Tracers & orbital beams + 4. Flak/Artillery flashes
  const warFXBundle = useMemo(() => {
    const tracerTex = createTracerStreakTexture();
    const flashTex = createBurstFlashTexture();

    const tracerGeom = new THREE.PlaneGeometry(1.15, 19.0);
    tracerGeom.translate(0, 9.5, 0);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      map: tracerTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });

    const flashGeom = new THREE.PlaneGeometry(11.0, 11.0);
    const flashMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      map: flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });

    return { tracerTex, flashTex, tracerGeom, tracerMat, flashGeom, flashMat };
  }, []);

  useEffect(() => {
    smokeBundle.mat.uniforms.uSmokeColor.value.copy(SMOKE_COLORS[lightingPreset]);
    smokeBundle.mat.uniforms.uFogColor.value.copy(SMOKE_FOG_COLORS[lightingPreset]);
    smokeBundle.mat.uniforms.uOpacity.value = SMOKE_OPACITY[lightingPreset];
  }, [lightingPreset, smokeBundle]);

  // Populate static smoke column transforms once
  useEffect(() => {
    const smokeMesh = smokeMeshRef.current;
    if (!smokeMesh) return;
    for (let i = 0; i < HORIZON_SMOKE_PLUMES.length; i++) {
      const p = HORIZON_SMOKE_PLUMES[i];
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(0, p.phase, 0.06 * (i % 2 === 0 ? 1 : -1));
      _dummy.scale.set(p.radiusTop, p.height, p.radiusTop);
      _dummy.updateMatrix();
      smokeMesh.setMatrixAt(i, _dummy.matrix);
    }
    smokeMesh.instanceMatrix.needsUpdate = true;
    smokeMesh.computeBoundingSphere();
  }, []);

  // Initialize tracer & flash instance colors & initial seeded frame
  useEffect(() => {
    const tracerMesh = tracerMeshRef.current;
    const flashMesh = flashMeshRef.current;
    const state = warStateRef.current;
    if (!tracerMesh || !flashMesh || !state) return;

    const hadTracerColors = Boolean(tracerMesh.instanceColor);
    const hadFlashColors = Boolean(flashMesh.instanceColor);
    for (let i = 0; i < HORIZON_WAR_MAX_TRACERS; i++) {
      _color.setRGB(state.tracers[i].r, state.tracers[i].g, state.tracers[i].b);
      tracerMesh.setColorAt(i, _color);
    }
    for (let i = 0; i < HORIZON_WAR_MAX_FLASHES; i++) {
      _color.setRGB(state.flashes[i].r, state.flashes[i].g, state.flashes[i].b);
      flashMesh.setColorAt(i, _color);
    }
    if (!hadTracerColors) warFXBundle.tracerMat.needsUpdate = true;
    if (!hadFlashColors) warFXBundle.flashMat.needsUpdate = true;

    syncWarInstancesToGpu(state, tracerMesh, flashMesh, camera, intensityMul);
  }, [camera, intensityMul, warFXBundle]);

  useMeshShaderWarmup(smokeMeshRef, !visible);
  useMeshShaderWarmup(tracerMeshRef, !visible);
  useMeshShaderWarmup(flashMeshRef, !visible);

  useEffect(() => {
    return () => {
      cruiserBundle.geom.dispose();
      cruiserBundle.mat.dispose();
      smokeBundle.geom.dispose();
      smokeBundle.mat.dispose();
      warFXBundle.tracerTex.dispose();
      warFXBundle.flashTex.dispose();
      warFXBundle.tracerGeom.dispose();
      warFXBundle.tracerMat.dispose();
      warFXBundle.flashGeom.dispose();
      warFXBundle.flashMat.dispose();
    };
  }, [cruiserBundle, smokeBundle, warFXBundle]);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (!visible) return;
    const tracerMesh = tracerMeshRef.current;
    const flashMesh = flashMeshRef.current;
    const state = warStateRef.current;
    if (!tracerMesh || !flashMesh || !state) return;

    if (!isSoftwareGl) {
      const dt = Math.min(delta, 0.05);
      smokeBundle.mat.uniforms.uTime.value += dt;
      const ev = stepHorizonWar(state, dt);
      if (driveMode) {
        if (ev.orbitalStrikes > 0) {
          combatAudio.playDistantCannonade(true);
        } else if (ev.artilleryImpacts > 0) {
          combatAudio.playDistantCannonade(false);
        }
      }
    }

    syncWarInstancesToGpu(state, tracerMesh, flashMesh, camera, intensityMul);
  });

  return (
    <group visible={visible}>
      {/* Distant hovering Old-World sky cruisers (1 Draw Call) */}
      <mesh
        geometry={cruiserBundle.geom}
        material={cruiserBundle.mat}
        castShadow={false}
        receiveShadow={false}
      />

      {/* Tall slow-scrolling black horizon smoke columns (1 Draw Call) */}
      <instancedMesh
        ref={smokeMeshRef}
        args={[smokeBundle.geom, smokeBundle.mat, HORIZON_SMOKE_PLUMES.length]}
        frustumCulled={false}
        renderOrder={2}
      />

      {/* Opposing AA / Plasma tracers + Orbital strike beams (1 Draw Call) */}
      <instancedMesh
        ref={tracerMeshRef}
        args={[warFXBundle.tracerGeom, warFXBundle.tracerMat, HORIZON_WAR_MAX_TRACERS]}
        frustumCulled={false}
        renderOrder={5}
      />

      {/* Billboarded horizon flak airbursts & artillery impact flashes (1 Draw Call) */}
      <instancedMesh
        ref={flashMeshRef}
        args={[warFXBundle.flashGeom, warFXBundle.flashMat, HORIZON_WAR_MAX_FLASHES]}
        frustumCulled={false}
        renderOrder={6}
      />
    </group>
  );
}
