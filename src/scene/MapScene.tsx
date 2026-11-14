import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { LightingPreset, SECTORS, SectorId } from '../map/sectors';
import { TerrainSlab } from './TerrainSlab';
import { Structures } from './Structures';
import { FoliageAndUnits } from './FoliageAndUnits';
import { TacticalMarkers } from './TacticalMarkers';
import { ProceduralSky } from './ProceduralSky';
import { installHeightFogShader } from './heightFog';
import { MechDriveInput, SovietMech } from './objects/SovietMech';
import { VolumetricSunShafts } from './objects/VolumetricSunShafts';
import {
  MechTelemetrySnapshot,
  getWalkableSurfaceY,
} from '../map/mechKinematics';

installHeightFogShader();

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface LightingConfig {
  bg: string;
  fogColor: string;
  fogDensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  keyColor: string;
  keyIntensity: number;
  keyPos: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  bounceColor: string;
  bounceIntensity: number;
}

const TONE_EXPOSURE: Record<LightingPreset, number> = {
  day: 1.14,
  dusk: 0.92,
  night: 0.92,
};

const LIGHTING_CONFIGS: Record<LightingPreset, LightingConfig> = {
  day: {
    bg: '#4F8ED6',
    fogColor: '#9EC6EC',
    fogDensity: 0.00028,
    hemiSky: '#78B4EC',
    hemiGround: '#7A6E4A',
    hemiIntensity: 0.42,
    keyColor: '#FFE6A8',
    keyIntensity: 5.35,
    // Crisp ~39 deg ENE sunlight: sculpts mountains, terraces, & buildings while catching river reflections
    keyPos: [175, 160, -85],
    rimColor: '#7DB2E2',
    rimIntensity: 0.2,
    bounceColor: '#F5DF9E',
    bounceIntensity: 0.52,
  },
  dusk: {
    bg: '#2A3647',
    fogColor: '#7E716B',
    fogDensity: 0.00068,
    hemiSky: '#5E7088',
    hemiGround: '#543826',
    hemiIntensity: 0.46,
    keyColor: '#FFA462',
    keyIntensity: 3.15,
    // ~21.5 deg golden sunset in NNE reflection corridor: lifts long valley shadows & keeps water solar trail crisp
    keyPos: [110, 106, -245],
    rimColor: '#5B84AA',
    rimIntensity: 0.56,
    bounceColor: '#E6925A',
    bounceIntensity: 0.44,
  },
  night: {
    bg: '#060C14',
    fogColor: '#0B1420',
    fogDensity: 0.0008,
    hemiSky: '#355373',
    hemiGround: '#0D151F',
    hemiIntensity: 0.42,
    keyColor: '#8BB6E3',
    keyIntensity: 1.25,
    keyPos: [110, 115, -210],
    rimColor: '#3E658A',
    rimIntensity: 0.55,
    bounceColor: '#1E3145',
    bounceIntensity: 0.0,
  },
};

const _goalPos = new THREE.Vector3();
const _goalTarget = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _lightRight = new THREE.Vector3();
const _lightUp = new THREE.Vector3();
const _snappedFocus = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

function syncShadowFrustum(
  light: THREE.DirectionalLight | null,
  camera: THREE.Camera,
  focus: THREE.Vector3,
  sunPos: readonly [number, number, number],
  shadowMapSize: number,
) {
  if (!light) return;
  _sunDir.set(sunPos[0], sunPos[1], sunPos[2]).normalize();
  const camDist = camera.position.distanceTo(focus);
  const halfExtent = THREE.MathUtils.clamp(camDist * 0.44, 32, 210);
  const halfH = halfExtent * 0.92;

  _lightRight.crossVectors(_worldUp, _sunDir).normalize();
  _lightUp.crossVectors(_sunDir, _lightRight).normalize();
  const texel = (halfExtent * 2) / shadowMapSize;
  const u = Math.round(focus.dot(_lightRight) / texel) * texel;
  const v = Math.round(focus.dot(_lightUp) / texel) * texel;
  const w = focus.dot(_sunDir);
  _snappedFocus
    .copy(_lightRight)
    .multiplyScalar(u)
    .addScaledVector(_lightUp, v)
    .addScaledVector(_sunDir, w);

  light.target.position.copy(_snappedFocus);
  light.target.updateMatrixWorld();
  light.position.copy(_snappedFocus).addScaledVector(_sunDir, 320);
  light.updateMatrixWorld();

  const cam = light.shadow.camera;
  if (
    Math.abs(cam.right - halfExtent) > 0.05 ||
    Math.abs(cam.top - halfH) > 0.05
  ) {
    cam.left = -halfExtent;
    cam.right = halfExtent;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.near = 20;
    cam.far = 680;
    cam.updateProjectionMatrix();
  }
}

interface CameraRigProps {
  activeSector: SectorId;
  transitionNonce: number;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  isSoftwareGl: boolean;
  sunLightRef: React.RefObject<THREE.DirectionalLight | null>;
  sunPos: readonly [number, number, number];
  shadowMapSize: number;
}

function CameraRig({
  activeSector,
  transitionNonce,
  lightingPreset,
  driveMode,
  mechPoseRef,
  isSoftwareGl,
  sunLightRef,
  sunPos,
  shadowMapSize,
}: CameraRigProps) {
  const { camera, scene, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const transitioningRef = useRef(false);
  const firstMountRef = useRef(true);
  const prevDriveModeRef = useRef(false);
  const programmaticUpdateRef = useRef(false);
  const lastTrackedMechPos = useRef(new THREE.Vector3());

  useEffect(() => {
    gl.toneMappingExposure = TONE_EXPOSURE[lightingPreset];
    invalidate();
  }, [gl, lightingPreset, invalidate]);

  useEffect(() => {
    const light = sunLightRef.current;
    if (!light) return;
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene, sunLightRef]);

  useEffect(() => {
    const focus = controlsRef.current?.target ?? _goalTarget;
    syncShadowFrustum(sunLightRef.current, camera, focus, sunPos, shadowMapSize);
    invalidate();
  }, [sunPos, shadowMapSize, camera, sunLightRef, invalidate]);

  useEffect(() => {
    if (!isSoftwareGl || !driveMode) return;
    let cancelled = false;
    let timerId = 0;
    let rafId = 0;
    const scheduleNext = () => {
      timerId = window.setTimeout(() => {
        if (cancelled) return;
        invalidate();
        rafId = window.requestAnimationFrame(scheduleNext);
      }, 450);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
    };
  }, [isSoftwareGl, driveMode, invalidate]);

  // Handle entering/exiting Drive Mode vs Sector Overview fly-to
  useEffect(() => {
    const wasDrive = prevDriveModeRef.current;
    prevDriveModeRef.current = driveMode;

    if (driveMode) {
      const m = mechPoseRef.current;
      lastTrackedMechPos.current.set(m.x, m.y, m.z);

      const sinY = Math.sin(m.yaw);
      const cosY = Math.cos(m.yaw);
      const chaseDist = 14.5;
      const sideOffset = 2.4;
      const desiredX = m.x - sinY * chaseDist + cosY * sideOffset;
      const desiredZ = m.z - cosY * chaseDist - sinY * sideOffset;
      const groundAtCam = getWalkableSurfaceY(desiredX, desiredZ).y;
      const desiredY = Math.max(m.y + 5.4, groundAtCam + 1.8);

      _goalPos.set(desiredX, desiredY, desiredZ);
      _goalTarget.set(m.x, m.y + 2.35, m.z);

      if (isSoftwareGl || !wasDrive) {
        if (isSoftwareGl) {
          camera.position.copy(_goalPos);
          if (controlsRef.current) {
            programmaticUpdateRef.current = true;
            controlsRef.current.target.copy(_goalTarget);
            controlsRef.current.update();
            programmaticUpdateRef.current = false;
          } else {
            camera.lookAt(_goalTarget);
          }
          syncShadowFrustum(
            sunLightRef.current,
            camera,
            _goalTarget,
            sunPos,
            shadowMapSize,
          );
          transitioningRef.current = false;
        } else {
          transitioningRef.current = true;
        }
      }
      invalidate();
      return;
    }

    const sector = SECTORS[activeSector];
    _goalPos.set(...sector.cameraPos);
    _goalTarget.set(...sector.cameraTarget);

    if (firstMountRef.current || isSoftwareGl) {
      firstMountRef.current = false;
      camera.position.copy(_goalPos);
      if (controlsRef.current) {
        programmaticUpdateRef.current = true;
        controlsRef.current.target.copy(_goalTarget);
        controlsRef.current.update();
        programmaticUpdateRef.current = false;
      } else {
        camera.lookAt(_goalTarget);
      }
      syncShadowFrustum(sunLightRef.current, camera, _goalTarget, sunPos, shadowMapSize);
      transitioningRef.current = false;
      invalidate();
      return;
    }

    transitioningRef.current = true;
    invalidate();
  }, [
    driveMode,
    activeSector,
    transitionNonce,
    camera,
    invalidate,
    isSoftwareGl,
    sunLightRef,
    sunPos,
    shadowMapSize,
    mechPoseRef,
  ]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (driveMode) {
      const m = mechPoseRef.current;
      const dx = m.x - lastTrackedMechPos.current.x;
      const dy = m.y - lastTrackedMechPos.current.y;
      const dz = m.z - lastTrackedMechPos.current.z;
      lastTrackedMechPos.current.set(m.x, m.y, m.z);

      if (transitioningRef.current) {
        _goalPos.x += dx;
        _goalPos.y += dy;
        _goalPos.z += dz;
        _goalTarget.set(m.x, m.y + 2.35, m.z);

        const lambda = 6.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _goalPos.x, lambda, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _goalPos.y, lambda, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _goalPos.z, lambda, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _goalTarget.x, lambda, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _goalTarget.y, lambda, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _goalTarget.z, lambda, delta);

        if (camera.position.distanceTo(_goalPos) < 0.25) {
          transitioningRef.current = false;
        }
      } else {
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
        controls.target.x += dx;
        controls.target.y = THREE.MathUtils.damp(controls.target.y, m.y + 2.35, 8.0, delta);
        controls.target.z += dz;
      }

      // Prevent chase camera from clipping underneath terrain or river water
      const camGround = getWalkableSurfaceY(camera.position.x, camera.position.z).y;
      const minCamY = Math.max(1.2, camGround + 1.35);
      if (camera.position.y < minCamY) {
        camera.position.y = THREE.MathUtils.damp(camera.position.y, minCamY, 12.0, delta);
      }

      programmaticUpdateRef.current = true;
      controls.update();
      programmaticUpdateRef.current = false;
      syncShadowFrustum(sunLightRef.current, camera, controls.target, sunPos, shadowMapSize);
      return;
    }

    if (!transitioningRef.current) return;

    const lambda = 5.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _goalPos.x, lambda, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _goalPos.y, lambda, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _goalPos.z, lambda, delta);

    controls.target.x = THREE.MathUtils.damp(controls.target.x, _goalTarget.x, lambda, delta);
    controls.target.y = THREE.MathUtils.damp(controls.target.y, _goalTarget.y, lambda, delta);
    controls.target.z = THREE.MathUtils.damp(controls.target.z, _goalTarget.z, lambda, delta);
    programmaticUpdateRef.current = true;
    controls.update();
    programmaticUpdateRef.current = false;

    syncShadowFrustum(sunLightRef.current, camera, controls.target, sunPos, shadowMapSize);

    const posDist = camera.position.distanceTo(_goalPos);
    const tgtDist = controls.target.distanceTo(_goalTarget);
    if (posDist < 0.08 && tgtDist < 0.08) {
      camera.position.copy(_goalPos);
      controls.target.copy(_goalTarget);
      programmaticUpdateRef.current = true;
      controls.update();
      programmaticUpdateRef.current = false;
      syncShadowFrustum(sunLightRef.current, camera, controls.target, sunPos, shadowMapSize);
      transitioningRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={driveMode ? 6.5 : 18}
      maxDistance={driveMode ? 48 : 660}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI / 2 - 0.12}
      onStart={() => {
        transitioningRef.current = false;
      }}
      onChange={() => {
        if (programmaticUpdateRef.current) return;
        if (controlsRef.current) {
          syncShadowFrustum(
            sunLightRef.current,
            camera,
            controlsRef.current.target,
            sunPos,
            shadowMapSize,
          );
        }
        if (isSoftwareGl) invalidate();
      }}
    />
  );
}

export interface MapSceneProps {
  activeSector: SectorId;
  transitionNonce: number;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  showMarkers: boolean;
  showUnits: boolean;
  showMist: boolean;
  showWireframeGrid: boolean;
  onSelectSector: (id: SectorId) => void;
  onEnterDriveMode: () => void;
}

export function MapScene({
  activeSector,
  transitionNonce,
  lightingPreset,
  driveMode,
  mechPoseRef,
  driveInputRef,
  showMarkers,
  showUnits,
  showMist,
  showWireframeGrid,
  onSelectSector,
  onEnterDriveMode,
}: MapSceneProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const lightCfg = LIGHTING_CONFIGS[lightingPreset];
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const shadowMapSize = isSoftwareGl ? 1024 : 2048;

  return (
    <div
      data-testid="map-canvas-container"
      data-sector={activeSector}
      data-lighting={lightingPreset}
      data-drive-mode={driveMode ? 'true' : 'false'}
      className="relative w-full h-full bg-[#091016]"
    >
      <Canvas
        frameloop={isSoftwareGl ? 'demand' : 'always'}
        dpr={isSoftwareGl ? 1 : [1, 2]}
        shadows
        camera={{
          position: [...SECTORS.overview.cameraPos],
          fov: 35,
          near: 2,
          far: 3200,
        }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.92,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
          });
        }}
      >
        <color attach="background" args={[lightCfg.bg]} />
        <fogExp2 attach="fog" args={[lightCfg.fogColor, lightCfg.fogDensity]} />

        <ProceduralSky
          lightingPreset={lightingPreset}
          sunPos={lightCfg.keyPos}
          isSoftwareGl={isSoftwareGl}
        />

        {/* Tactical Lighting Rig: key sun (dynamic shadow frustum), sky rim fill, & warm ground bounce */}
        <hemisphereLight
          args={[lightCfg.hemiSky, lightCfg.hemiGround, lightCfg.hemiIntensity]}
        />
        <directionalLight
          ref={sunLightRef}
          position={lightCfg.keyPos}
          color={lightCfg.keyColor}
          intensity={lightCfg.keyIntensity}
          castShadow
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-near={20}
          shadow-camera-far={680}
          shadow-camera-left={-210}
          shadow-camera-right={210}
          shadow-camera-top={195}
          shadow-camera-bottom={-195}
          shadow-radius={1.15}
          shadow-bias={-0.00022}
          shadow-normalBias={0.03}
        />
        <directionalLight
          position={[-180, 90, 190]}
          color={lightCfg.rimColor}
          intensity={lightCfg.rimIntensity}
        />
        {lightCfg.bounceIntensity > 0 && (
          <directionalLight
            position={[75, 22, 225]}
            color={lightCfg.bounceColor}
            intensity={lightCfg.bounceIntensity}
          />
        )}

        <CameraRig
          activeSector={activeSector}
          transitionNonce={transitionNonce}
          lightingPreset={lightingPreset}
          driveMode={driveMode}
          mechPoseRef={mechPoseRef}
          isSoftwareGl={isSoftwareGl}
          sunLightRef={sunLightRef}
          sunPos={lightCfg.keyPos}
          shadowMapSize={shadowMapSize}
        />

        <TerrainSlab
          showWireframeGrid={showWireframeGrid}
          isSoftwareGl={isSoftwareGl}
        />

        <Structures
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
          onSelectSector={(id) => {
            if (!driveMode) onSelectSector(id);
          }}
        />

        <SovietMech
          driveMode={driveMode}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
          mechPoseRef={mechPoseRef}
          driveInputRef={driveInputRef}
          onSelectMech={onEnterDriveMode}
        />

        <FoliageAndUnits
          showUnits={showUnits}
          showMist={showMist}
          isSoftwareGl={isSoftwareGl}
        />

        <VolumetricSunShafts
          lightingPreset={lightingPreset}
          sunPos={lightCfg.keyPos}
          visible={showMist}
          isSoftwareGl={isSoftwareGl}
        />

        <TacticalMarkers
          visible={showMarkers && !driveMode}
          activeSector={activeSector}
          onSelectSector={onSelectSector}
        />
      </Canvas>
    </div>
  );
}
