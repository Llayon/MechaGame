import type { WorldAssets } from '../map/worldAssets';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WorldLodDriver } from '../lod/WorldLodDriver';
import {
  createInitialAdaptiveState,
  effectiveGraphics,
  type AdaptiveState,
} from '../lod/adaptiveQuality';
import { loadPlayerBattleEntry, type BattleScene } from './loadBattleScene';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SceneSimulationProvider } from './SceneSimulation';
import { ScenePerformanceProbe } from '../perf/ScenePerformanceProbe';
import { PLAYER_MODEL_LAYER } from './playerModelLayer';
import { stepInfantrySkirmishes } from '../game/infantrySkirmishes';
import { INFANTRY_SITES, type InfantrySite } from '../map/infantryEncounters';
import { frameInfantryEncounter } from './infantryCamera';
import type { CombatAimState } from '../game/combatAim';
import { resolveGraphicsRuntime } from '../game/graphicsSettings';
import type { GraphicsPreset, GraphicsSettings } from '../game/graphicsSettings';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { LightingPreset, SECTORS, SectorId } from '../map/sectors';
import { TerrainSlab } from './TerrainSlab';
import { RiverWater } from './terrain/RiverWater';
import { Structures } from './Structures';
import { BRIDGE_SHADOW_LAYER } from './objects/bridgeBatches';
import { FoliageAndUnits } from './FoliageAndUnits';
import { TacticalMarkers } from './TacticalMarkers';
import { ProceduralSky } from './ProceduralSky';
import { installHeightFogShader, syncHeightFogScatter } from './heightFog';
import {
  advanceWaterCausticsTime,
  installPbrMultiBounceAoShader,
  syncWaterCausticsParams,
} from './waterCausticsAndAo';
import {
  advanceFoliageWindTime,
  installGlobalDitheringShader,
  syncFoliageLightingParams,
} from './foliageLighting';
import {
  installGlobalSpecularAaShader,
  syncInteriorWindowParams,
} from './visualPolish';
import {
  getToneMappingExposure,
  parseToneMappingMode,
  type ToneMappingMode,
} from './atmosphereToneMapping';
import type { MechDriveInput } from './objects/MechState';
import { DropshipFlyby } from './objects/DropshipFlyby';
import { HologramSigns } from './objects/HologramSigns';
import { VolumetricSunShafts } from './objects/VolumetricSunShafts';
import { StormFront } from './objects/StormFront';
import { useLazyRef } from '../utils/useLazyRef';
import { createWaterVfxPool } from './objects/waterVfxPool';
import { createGroundTrailsPool } from './objects/groundTrailsPool';
import { createMuzzleFlashPool } from './objects/muzzleFlashPool';
import { createMissileRibbonPool } from './objects/missileRibbonPool';
import {
  MAX_CASING_INSTANCES,
  MAX_DEBRIS_INSTANCES,
  createBallisticPropPool,
} from './objects/debrisBallisticsPool';
import {
  MAX_TRACER_INSTANCES,
  createTracerPool,
} from './objects/tracerPool';
import {
  MAX_CRATER_DECALS,
  createCraterPool,
} from './objects/craterPool';
import { createHeatShimmerPool } from './objects/heatShimmerPool';
import {
  MechTelemetrySnapshot,
  getWalkableSurfaceY,
} from '../map/mechKinematics';
import type { CombatSimulationState } from '../game/combatTypes';

installHeightFogShader();
installPbrMultiBounceAoShader();
installGlobalSpecularAaShader();
installGlobalDitheringShader();

let cachedSoftwareWebGL: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  if (cachedSoftwareWebGL !== null) return cachedSoftwareWebGL;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareWebGL = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareWebGL = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareWebGL;
  } catch {
    cachedSoftwareWebGL = true;
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
  focusedSite: InfantrySite | null;
  activeSector: SectorId;
  transitionNonce: number;
  resetNonce: number;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  useTouchControls?: boolean;
  paused: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
  isSoftwareGl: boolean;
  sunLightRef: React.RefObject<THREE.DirectionalLight | null>;
  sunPos: readonly [number, number, number];
  shadowMapSize: number;
  toneMappingMode: ToneMappingMode;
  graphicsPreset: GraphicsPreset;
}

function CameraRig({
  focusedSite,
  activeSector,
  transitionNonce,
  resetNonce,
  lightingPreset,
  driveMode,
  useTouchControls = false,
  paused,
  mechPoseRef,
  driveInputRef,
  combatRef,
  isSoftwareGl,
  sunLightRef,
  sunPos,
  shadowMapSize,
  toneMappingMode,
  graphicsPreset,
}: CameraRigProps) {
  const { camera, scene, gl, invalidate, size } = useThree();
  useLayoutEffect(() => {
    if (new URLSearchParams(location.search).has('debugAim')) Object.assign(window, { orbitAngle: () => controlsRef.current?.getAzimuthalAngle() });
  }, []);
  const focusAspect = focusedSite ? size.width / Math.max(1, size.height) : 1;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const transitioningRef = useRef(false);
  const firstMountRef = useRef(true);
  const prevDriveModeRef = useRef(false);
  const programmaticUpdateRef = useRef(false);
  const lastTrackedMechPos = useRef(new THREE.Vector3());

  useEffect(() => {
    gl.toneMapping =
      toneMappingMode === 'aces'
        ? THREE.ACESFilmicToneMapping
        : THREE.AgXToneMapping;
    gl.toneMappingExposure = getToneMappingExposure(
      toneMappingMode,
      lightingPreset,
    );
    syncHeightFogScatter(lightingPreset, sunPos);
    syncWaterCausticsParams(lightingPreset, graphicsPreset, sunPos);
    syncFoliageLightingParams(lightingPreset, sunPos);
    syncInteriorWindowParams(lightingPreset);
    invalidate();
  }, [gl, toneMappingMode, lightingPreset, graphicsPreset, sunPos, invalidate]);

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
    if (!isSoftwareGl || paused) return;
    let cancelled = false;
    let timerId = 0;
    let idleTicksRemaining = 2;

    const scheduleStep = (delayMs: number) => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        if (cancelled) return;
        invalidate();
        const d = driveInputRef.current;
        const c = combatRef.current;
        const active =
          (driveMode && c.missionStatus === 'playing') ||
          (!driveMode && focusedSite !== null && (c.missionStatus === 'idle' || c.missionStatus === 'playing')) ||
          d.forward !== 0 ||
          d.turn !== 0 ||
          d.turretTurn !== 0 ||
          (driveMode &&
            (d.fire ||
              d.laserFire ||
              d.pointerLaserFire ||
              d.heavyFire ||
              d.missileSalvo ||
              d.repair ||
              d.dash ||
              d.centerTurret ||
              Math.abs(d.turretAimDelta ?? 0) > 0.001 ||
              c.laserActive ||
              c.playerMissiles.length > 0 ||
              c.projectiles.length > 0 ||
              c.heavyBeams.length > 0 ||
              c.dashTimer > 0 ||
              c.hitstopTimer > 0));
        if (active) {
          idleTicksRemaining = 1;
          scheduleStep(220);
        } else if (idleTicksRemaining > 0) {
          idleTicksRemaining -= 1;
          scheduleStep(280);
        }
      }, delayMs);
    };

    const wake = () => {
      if (cancelled) return;
      idleTicksRemaining = 1;
      scheduleStep(50);
    };

    if (driveMode || focusedSite) wake();
    window.addEventListener('keydown', wake);
    window.addEventListener('keyup', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('pointerup', wake);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('keyup', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('pointerup', wake);
    };
  }, [isSoftwareGl, driveMode, focusedSite, paused, invalidate, driveInputRef, combatRef]);

  // Handle entering/exiting Drive Mode vs Sector Overview fly-to
  useEffect(() => {
    const wasDrive = prevDriveModeRef.current;
    prevDriveModeRef.current = driveMode;

    if (driveMode) {
      const m = mechPoseRef.current;
      lastTrackedMechPos.current.set(m.x, m.y, m.z);

      const sinY = Math.sin(m.yaw);
      const cosY = Math.cos(m.yaw);
      const chaseDist = 13.8;
      const sideOffset = 2.45;
      const desiredX = m.x - sinY * chaseDist + cosY * sideOffset;
      const desiredZ = m.z - cosY * chaseDist - sinY * sideOffset;
      const groundAtCam = getWalkableSurfaceY(desiredX, desiredZ).y;
      const desiredY = Math.max(m.y + 5.7, groundAtCam + 1.8);

      _goalPos.set(desiredX, desiredY, desiredZ);
      _goalTarget.set(
        m.x + sinY * 4.5 - cosY * 1.45,
        m.y + 2.95,
        m.z + cosY * 4.5 + sinY * 1.45,
      );

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
    if (focusedSite && camera instanceof THREE.PerspectiveCamera) {
      const view = frameInfantryEncounter(combatRef.current.infantry.soldiers,
        INFANTRY_SITES.indexOf(focusedSite), focusAspect, camera.fov, sunPos);
      _goalTarget.copy(view.target);
      _goalPos.copy(view.position);
    }

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
    focusedSite,
    focusAspect,
    transitionNonce,
    resetNonce,
    camera,
    invalidate,
    isSoftwareGl,
    sunLightRef,
    sunPos,
    shadowMapSize,
    mechPoseRef,
  ]);

  useFrame((_, delta) => {
    if (paused) return;
    if (!isSoftwareGl) {
      advanceFoliageWindTime(delta);
      if (graphicsPreset !== 'low') {
        advanceWaterCausticsTime(delta);
      }
    }
    if (driveMode) return; // CombatCamera exclusively owns battle view.
    const status = combatRef.current.missionStatus;
    if (focusedSite && (status === 'idle' || status === 'playing')) {
      stepInfantrySkirmishes(combatRef.current.infantry, delta);
    }
    const controls = controlsRef.current;
    if (!controls) return;

    if (driveMode) {
      const m = mechPoseRef.current;
      const dx = m.x - lastTrackedMechPos.current.x;
      const dy = m.y - lastTrackedMechPos.current.y;
      const dz = m.z - lastTrackedMechPos.current.z;
      lastTrackedMechPos.current.set(m.x, m.y, m.z);

      if (transitioningRef.current) {
        const sinY = Math.sin(m.yaw);
        const cosY = Math.cos(m.yaw);
        _goalPos.x += dx;
        _goalPos.y += dy;
        _goalPos.z += dz;
        _goalTarget.set(
          m.x + sinY * 4.5 - cosY * 1.45,
          m.y + 2.95,
          m.z + cosY * 4.5 + sinY * 1.45,
        );

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
      } else if (useTouchControls) {
        // Mobile touch drive: auto-follow behind turret aim axis so touch-drag aiming stays centered
        const lookYaw = m.yaw + m.turretYaw;
        const sinL = Math.sin(lookYaw);
        const cosL = Math.cos(lookYaw);
        const chaseDist = 14.2;
        const sideOffset = 1.25;
        const desiredX = m.x - sinL * chaseDist + cosL * sideOffset;
        const desiredZ = m.z - cosL * chaseDist - sinL * sideOffset;
        const desiredY = m.y + 5.7;
        const targetX = m.x + sinL * 5.2 - cosL * 0.45;
        const targetZ = m.z + cosL * 5.2 + sinL * 0.45;
        const followLambda = isSoftwareGl ? 18.0 : 6.0;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, followLambda, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, followLambda, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, followLambda, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetX, followLambda, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, m.y + 2.9, 8.0, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetZ, followLambda, delta);
      } else {
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;
        controls.target.x += dx;
        controls.target.y = THREE.MathUtils.damp(controls.target.y, m.y + 2.95, 8.0, delta);
        controls.target.z += dz;
      }

      // Prevent chase camera from clipping underneath terrain or river water
      const camGround = getWalkableSurfaceY(
        camera.position.x,
        camera.position.z,
        m.onBridge ? undefined : m.y + 1.5,
      ).y;
      const minCamY = Math.max(1.2, camGround + 1.35);
      if (camera.position.y < minCamY) {
        camera.position.y = THREE.MathUtils.damp(camera.position.y, minCamY, 12.0, delta);
      }

      programmaticUpdateRef.current = true;
      controls.update();
      programmaticUpdateRef.current = false;

      // Apply decaying quadratic trauma camera shake during heavy impacts/explosions
      const shake = combatRef.current.trauma * combatRef.current.trauma;
      if (shake > 0.002 && !isSoftwareGl) {
        const t = combatRef.current.elapsedSec * 42;
        camera.position.x += Math.sin(t * 1.1) * shake * 0.38;
        camera.position.y += Math.cos(t * 1.37) * shake * 0.28;
      }

      syncShadowFrustum(sunLightRef.current, camera, controls.target, sunPos, shadowMapSize);
      return;
    }

    // Overview keyboard panning (WASD / Arrows) & orbit yaw (Q / E)
    const kb = driveInputRef.current;
    if (kb.forward !== 0 || kb.turn !== 0 || kb.turretTurn !== 0) {
      transitioningRef.current = false;
      const dt = Math.min(delta, 0.05);
      const speedScale = kb.sprint ? 1.85 : 1.0;
      const camDist = camera.position.distanceTo(controls.target);
      const panSpeed = Math.max(26, camDist * 0.42) * speedScale * dt;

      let fwdX = controls.target.x - camera.position.x;
      let fwdZ = controls.target.z - camera.position.z;
      const fwdLen = Math.hypot(fwdX, fwdZ) || 1;
      fwdX /= fwdLen;
      fwdZ /= fwdLen;
      const rightX = -fwdZ;
      const rightZ = fwdX;

      const moveFwd = kb.forward * panSpeed;
      const moveRight = -kb.turn * panSpeed;
      const dxPan = fwdX * moveFwd + rightX * moveRight;
      const dzPan = fwdZ * moveFwd + rightZ * moveRight;

      const nextTx = Math.max(-195, Math.min(195, controls.target.x + dxPan));
      const nextTz = Math.max(-160, Math.min(160, controls.target.z + dzPan));
      const appliedDx = nextTx - controls.target.x;
      const appliedDz = nextTz - controls.target.z;

      controls.target.x = nextTx;
      controls.target.z = nextTz;
      camera.position.x += appliedDx;
      camera.position.z += appliedDz;

      if (kb.turretTurn !== 0) {
        const yawStep = kb.turretTurn * 1.15 * dt;
        const ox = camera.position.x - controls.target.x;
        const oz = camera.position.z - controls.target.z;
        const cosA = Math.cos(yawStep);
        const sinA = Math.sin(yawStep);
        camera.position.x = controls.target.x + (ox * cosA + oz * sinA);
        camera.position.z = controls.target.z + (-ox * sinA + oz * cosA);
      }

      programmaticUpdateRef.current = true;
      controls.update();
      programmaticUpdateRef.current = false;
      syncShadowFrustum(sunLightRef.current, camera, controls.target, sunPos, shadowMapSize);
      if (isSoftwareGl) invalidate();
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
      enabled={!paused && !driveMode}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.07}
      minDistance={driveMode || focusedSite ? 6.5 : 18}
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

function BalancedShadowCadence({
  lightRef, aimRef, lightingPreset, transitionNonce, resetNonce, driveMode, paused, shadowMapSize,
}: {
  lightRef: React.RefObject<THREE.DirectionalLight | null>;
  aimRef: React.RefObject<CombatAimState>;
  lightingPreset: LightingPreset;
  transitionNonce: number;
  resetNonce: number;
  driveMode: boolean;
  paused: boolean;
  shadowMapSize: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const frames = useRef(0);
  const precise = useRef(false);

  useLayoutEffect(() => {
    const shadow = lightRef.current?.shadow;
    if (!shadow) return;
    shadow.autoUpdate = false;
    shadow.needsUpdate = true;
    frames.current = 0;
    invalidate();
    return () => {
      shadow.autoUpdate = true;
      shadow.needsUpdate = true;
    };
  }, [lightRef, lightingPreset, transitionNonce, resetNonce, driveMode, paused, shadowMapSize, invalidate]);

  useFrame(() => {
    if (paused) return;
    const shadow = lightRef.current?.shadow;
    if (!shadow) return;
    const usingPrecisionCamera = driveMode && aimRef.current.precise;
    if (usingPrecisionCamera !== precise.current) {
      precise.current = usingPrecisionCamera;
      frames.current = 0;
    }
    if (frames.current % 2 === 0) shadow.needsUpdate = true;
    frames.current++;
  });
  return null;
}

function ReportFirstTerrainRender({ onReady, onBattleFrame, driveMode }: {
  onReady: () => void;
  onBattleFrame: (renderer: THREE.WebGLRenderer) => void;
  driveMode: boolean;
}) {
  const scene = useThree((state) => state.scene);
  const terrainReported = useRef(false);
  const combatReported = useRef(false);
  useLayoutEffect(() => {
    if (terrainReported.current && (!driveMode || combatReported.current)) return;
    const previous = scene.onAfterRender;
    const report: typeof previous = function (...args) {
      previous.apply(scene, args);
      scene.onAfterRender = previous;
      if (!terrainReported.current) {
        terrainReported.current = true;
        performance.mark('overview-first-draw');
        onReady();
      }
      if (driveMode && !combatReported.current) {
        combatReported.current = true;
        performance.mark('mecha-first-controllable-frame');
        onBattleFrame(args[0]);
      }
    };
    scene.onAfterRender = report;
    return () => {
      if (scene.onAfterRender === report) scene.onAfterRender = previous;
    };
  }, [scene, onReady, onBattleFrame, driveMode]);
  return null;
}

export interface MapSceneProps {
  focusedSite: InfantrySite | null;
  world: WorldAssets | null;
  battle: BattleScene | null;
  preparingBattle: boolean;
  grassMap: Uint8Array<ArrayBuffer> | null;
  onTerrainReady: () => void;
  activeSector: SectorId;
  transitionNonce: number;
  resetNonce: number;
  lightingPreset: LightingPreset;
  graphics: GraphicsSettings;
  adaptation: AdaptiveState;
  drsResetNonce: number;
  drsSamplingPaused?: boolean;
  onAdaptationChange: (next: AdaptiveState) => void;
  onContextLost?: () => void;
  driveMode: boolean;
  useTouchControls?: boolean;
  paused: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  aimRef: React.MutableRefObject<CombatAimState>;
  combatRef: React.MutableRefObject<CombatSimulationState>;
  showMarkers: boolean;
  showUnits: boolean;
  showMist: boolean;
  showWireframeGrid: boolean;
  onSelectSector: (id: SectorId) => void;
  onEnterDriveMode: () => void;
  onMissionEnded: (outcome: 'victory' | 'defeat') => void;
}

import { CompactGround, compactReady } from './terrain/CompactGround';
import { OverviewGround, deferSky, hasGroundMap } from './terrain/OverviewGround';
import { LandmarkMeshes, StageDriver, landmarksReady, lastStage } from './LandmarkOverview';
export function MapScene({
  focusedSite,
  world,
  battle,
  preparingBattle,
  grassMap,
  onTerrainReady,
  activeSector,
  transitionNonce,
  resetNonce,
  lightingPreset,
  graphics: preferences,
  adaptation,
  drsResetNonce,
  drsSamplingPaused = false,
  onAdaptationChange,
  onContextLost,
  driveMode,
  useTouchControls = false,
  paused,
  mechPoseRef,
  driveInputRef,
  aimRef,
  combatRef,
  showMarkers,
  showUnits,
  showMist,
  showWireframeGrid,
  onSelectSector,
  onEnterDriveMode,
  onMissionEnded,
}: MapSceneProps) {
  const [stage, setStage] = useState(() => landmarksReady() ? 0 : lastStage);
  const advance = useCallback(() => setStage(s => Math.min(lastStage + 5, s + 1)), []);
  const optimized = landmarksReady() && (hasGroundMap() || deferSky);
  const streamed = compactReady() && landmarksReady();
  const detailLevels = [0,0,1,2,2,3,4,4,4,4,5,6,7,8,9,10,11];
  const waterReady = Boolean(world) && stage >= 7;
  const [terrainCompiling, setTerrainCompiling] = useState(false);
  // The horizon shares the ground program, so neither region should force its first draw while it compiles.
  const nearReady = Boolean(world) && stage >= 8 && !(driveMode && terrainCompiling);
  const farReady = nearReady && stage >= 9;
  const level = streamed ? detailLevels[Math.min(stage, detailLevels.length - 1)] : optimized ? Math.max(0, stage - (stage >= 2 ? 1 : 0) - (stage >= 5 ? 1 : 0)) : stage;
  const stagedSky = optimized && deferSky && stage < (streamed ? 1 : 2) && !driveMode;
  const stagedGround = optimized && hasGroundMap() && stage < 5 && !driveMode;
  const [enteredBattle, setEnteredBattle] = useState(false);
  useEffect(() => { if (driveMode) setEnteredBattle(true); }, [driveMode]);
  const battleRequested = driveMode || enteredBattle;
  const activeAdaptation = useMemo(
    () => (preferences.autoQuality ? adaptation : createInitialAdaptiveState(preferences)),
    [preferences, adaptation],
  );
  const [contextRestoredNonce, setContextRestoredNonce] = useState(0);
  const onContextLostRef = useRef(onContextLost);
  onContextLostRef.current = onContextLost;
  const graphics = useMemo(
    () => effectiveGraphics(preferences, activeAdaptation),
    [preferences, activeAdaptation],
  );
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const [earlyTerrain, setEarlyTerrain] = useState(false);
  const onBattleFrame = useCallback((renderer: THREE.WebGLRenderer) => {
    if (!isSoftwareGl && renderer.extensions.has('KHR_parallel_shader_compile')) setEarlyTerrain(true);
  }, [isSoftwareGl]);
  const prepareMech = preparingBattle && !isSoftwareGl && !stagedSky;
  const [earlyPlayer, setEarlyPlayer] = useState<Awaited<ReturnType<typeof loadPlayerBattleEntry>> | null>(null);
  useEffect(() => {
    if (!prepareMech || earlyPlayer) return;
    let active = true;
    // The details loader owns the retry UI if this shared import fails.
    loadPlayerBattleEntry().then(player => {
      if (active) setEarlyPlayer(player);
    }).catch(() => {});
    return () => { active = false; };
  }, [prepareMech, earlyPlayer]);
  const player = battle ?? earlyPlayer;
  const PlayerMech = player?.SovietMech;
  const ShellCasingMesh = player?.ShellCasingMesh;
  const showCombat = battle && (level >= 10 || battleRequested);
  // CI benchmarking opts into a continuous frame loop on software renderers.
  const query = useMemo(() => new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  ), []);
  const benchmarkContinuousFrames = query.get('benchmark') === '1';
  const splitBridgeBatches = query.get('bridgeCells') === '96';
  const halfRateShadows = preferences.preset === 'balanced' && query.get('shadowCadence') === '2';
  const toneMappingMode = useMemo(
    () =>
      parseToneMappingMode(
        typeof window === 'undefined' ? '' : window.location.search,
      ),
    [],
  );
  const lightCfg = LIGHTING_CONFIGS[lightingPreset];
  syncHeightFogScatter(lightingPreset, lightCfg.keyPos);
  syncWaterCausticsParams(lightingPreset, graphics.preset, lightCfg.keyPos);
  syncFoliageLightingParams(lightingPreset, lightCfg.keyPos);
  syncInteriorWindowParams(lightingPreset);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const waterVfxPoolRef = useLazyRef(createWaterVfxPool);
  const groundTrailsPoolRef = useLazyRef(createGroundTrailsPool);
  const muzzleFlashPoolRef = useLazyRef(createMuzzleFlashPool);
  const missileRibbonPoolRef = useLazyRef(createMissileRibbonPool);
  const casingsPoolRef = useLazyRef(() => createBallisticPropPool(MAX_CASING_INSTANCES));
  const debrisPoolRef = useLazyRef(() => createBallisticPropPool(MAX_DEBRIS_INSTANCES));
  const craterPoolRef = useLazyRef(() => createCraterPool(MAX_CRATER_DECALS));
  const tracerPoolRef = useLazyRef(() => createTracerPool(MAX_TRACER_INSTANCES));
  const heatShimmerPoolRef = useLazyRef(createHeatShimmerPool);
  const quality = useMemo(() => resolveGraphicsRuntime(
    graphics, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, isSoftwareGl,
  ), [graphics, isSoftwareGl]);
  // Keep valid map dimensions when shadows are disabled.
  const shadowMapSize = quality.shadowMapSize || 512;

  return (
    <div
      data-testid="map-canvas-container"
      data-sector={activeSector}
      data-landmark-stage={level}
      data-terrain-stage={stage}
      data-lighting={lightingPreset}
      data-tone-mapping={toneMappingMode}
      data-caustics={graphics.preset === 'low' ? 'off' : 'on'}
      data-drive-mode={driveMode ? 'true' : 'false'}
      data-graphics-preset={graphics.preset}
      data-adaptive-step={activeAdaptation.cascadeStep}
      data-drs-scale={graphics.resolutionScale}
      data-object-detail={graphics.objectDetail}
      data-auto-quality={preferences.autoQuality}
      data-target-fps={preferences.targetFps}
      data-render-dpr={quality.dpr}
      data-shadows={quality.shadowEnabled ? 'on' : 'off'}
      data-shadow-map-size={quality.shadowMapSize}
      onPointerDown={() => {
        if (document.activeElement instanceof HTMLButtonElement) {
          document.activeElement.blur();
        }
        window.focus();
      }}
      className="relative w-full h-full bg-[#091016]"
    >
      <Canvas
        frameloop={paused || (isSoftwareGl && !benchmarkContinuousFrames) ? 'demand' : 'always'}
        dpr={quality.dpr}
        shadows={quality.shadowEnabled}
        camera={{
          position: [...SECTORS.overview.cameraPos],
          fov: 35,
          near: 2,
          far: 3200,
        }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping:
            toneMappingMode === 'aces'
              ? THREE.ACESFilmicToneMapping
              : THREE.AgXToneMapping,
          toneMappingExposure: getToneMappingExposure(
            toneMappingMode,
            lightingPreset,
          ),
        }}
        onCreated={({ gl, camera, raycaster, scene }) => {
          performance.mark('canvas-created');
          if (query.has('startupTrace')) Object.assign(window,{startupRenderer:gl});
          if(query.has('bake')) Object.assign(window,{bakeScene:scene,bakeRenderer:gl,threeForBake:THREE});
          camera.layers.enable(PLAYER_MODEL_LAYER);
          raycaster.layers.enable(PLAYER_MODEL_LAYER);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onContextLostRef.current?.();
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setContextRestoredNonce((n) => n + 1);
          });
        }}
      >
        <SceneSimulationProvider paused={paused}>
        <StageDriver limit={streamed ? lastStage + 5 : optimized ? lastStage + 2 : lastStage} stage={stage} advance={advance} paused={paused || (streamed && !world && stage >= 6)} />
        <ReportFirstTerrainRender onReady={onTerrainReady} onBattleFrame={onBattleFrame} driveMode={driveMode} />
        <WorldLodDriver
          settings={preferences}
          paused={paused || drsSamplingPaused}
          adaptation={activeAdaptation}
          resetNonce={drsResetNonce + contextRestoredNonce}
          onAdaptationChange={onAdaptationChange}
        />
        <color attach="background" args={[lightCfg.bg]} />
        <fogExp2 attach="fog" args={[lightCfg.fogColor, lightCfg.fogDensity]} />

        {!stagedSky && <ProceduralSky
          lightingPreset={lightingPreset}
          sunPos={lightCfg.keyPos}
          isSoftwareGl={isSoftwareGl}
        />}

        {/* Tactical Lighting Rig: key sun (dynamic shadow frustum), sky rim fill, & warm ground bounce */}
        <hemisphereLight
          args={[lightCfg.hemiSky, lightCfg.hemiGround, lightCfg.hemiIntensity]}
        />
        <directionalLight
          key={'sun-shadow-'+graphics.shadows}
          ref={sunLightRef}
          position={lightCfg.keyPos}
          color={lightCfg.keyColor}
          intensity={lightCfg.keyIntensity}
          castShadow={quality.shadowEnabled}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-near={20}
          shadow-camera-layers-mask={1 | (1 << BRIDGE_SHADOW_LAYER) | (1 << PLAYER_MODEL_LAYER)}
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
          focusedSite={focusedSite}
          activeSector={activeSector}
          transitionNonce={transitionNonce}
          resetNonce={resetNonce}
          lightingPreset={lightingPreset}
          driveMode={driveMode}
          useTouchControls={useTouchControls}
          paused={paused}
          mechPoseRef={mechPoseRef}
          driveInputRef={driveInputRef}
          combatRef={combatRef}
          isSoftwareGl={isSoftwareGl}
          sunLightRef={sunLightRef}
          sunPos={lightCfg.keyPos}
          shadowMapSize={shadowMapSize}
          toneMappingMode={toneMappingMode}
          graphicsPreset={graphics.preset}
        />

        <group name="perf:terrain">
          {streamed ? <>
            {(!nearReady || !farReady) && <CompactGround near={!nearReady} far={!farReady} water={waterReady} />}
            {world && (waterReady || (!isSoftwareGl && stage >= 5)) && <RiverWater
              data={world.water} isSoftwareGl={isSoftwareGl} visible={waterReady}
            />}
            {world && (nearReady || (driveMode && earlyTerrain) || (!isSoftwareGl && stage >= 5)) && <TerrainSlab
              nearVisible={nearReady} far={farReady} water={false} tiles={world.terrain} waterDepth={world.water}
              onCompilingChange={driveMode ? setTerrainCompiling : undefined}
              showWireframeGrid={showWireframeGrid} isSoftwareGl={isSoftwareGl}
            />}
          </> : world && (stagedGround ? <OverviewGround tiles={world.terrain} /> : <TerrainSlab waterDepth={world.water} tiles={world.terrain} showWireframeGrid={showWireframeGrid} isSoftwareGl={isSoftwareGl} />)}
        </group>

        <group name="perf:structures">
          {level<4 && <LandmarkMeshes stage={level} select={onSelectSector}/>}
          {(!streamed || level >= 1) && <Structures stage={level} quarryDetails={!streamed || stage >= 4}
            preparingBattle={preparingBattle}
            splitBridgeBatches={splitBridgeBatches}
            lightingPreset={lightingPreset}
            driveMode={driveMode}
            distantWar={quality.distantWar}
            isSoftwareGl={isSoftwareGl}
            onSelectSector={(id) => {
              if (!driveMode) onSelectSector(id);
            }}
          />}
          {level >= 5 && <DropshipFlyby
            lightingPreset={lightingPreset}
            sunPos={lightCfg.keyPos}
            visible={quality.distantWar}
            driveMode={driveMode}
            isSoftwareGl={isSoftwareGl}
            mechPoseRef={mechPoseRef}
            combatRef={combatRef}
          />}
          {level >= 5 && <HologramSigns
            lightingPreset={lightingPreset}
            combatRef={combatRef}
          />}
        </group>

        {PlayerMech && (prepareMech || (battle && (level >= 6 || battleRequested))) && <group name="perf:mech">
        <PlayerMech
          prepareOnly={prepareMech}
          aimRef={aimRef}
          driveMode={driveMode}
          paused={paused}
          resetNonce={resetNonce}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
          mechPoseRef={mechPoseRef}
          driveInputRef={driveInputRef}
          combatRef={combatRef}
          waterVfxPoolRef={waterVfxPoolRef}
          groundTrailsPoolRef={groundTrailsPoolRef}
          muzzleFlashPoolRef={muzzleFlashPoolRef}
          missileRibbonPoolRef={missileRibbonPoolRef}
          casingsPoolRef={casingsPoolRef}
          tracerPoolRef={tracerPoolRef}
          onShadowFocus={(focus, cam) => syncShadowFrustum(
            sunLightRef.current, cam, focus, lightCfg.keyPos, shadowMapSize)}
          heatShimmerPoolRef={heatShimmerPoolRef}
          onSelectMech={onEnterDriveMode}
          onMissionEnded={onMissionEnded}
        />
        </group>}

        {halfRateShadows && quality.shadowEnabled && (
          <BalancedShadowCadence
            key={graphics.shadows}
            lightRef={sunLightRef}
            aimRef={aimRef}
            lightingPreset={lightingPreset}
            transitionNonce={transitionNonce}
            resetNonce={resetNonce}
            driveMode={driveMode}
            paused={paused}
            shadowMapSize={shadowMapSize}
          />
        )}
        {ShellCasingMesh && (prepareMech || showCombat) && (
          <ShellCasingMesh>
            {(casingMesh, hideEmptyCasings) => showCombat && (
              <group name="perf:combat">
                {driveMode || focusedSite
                  ? <battle.InfantryActors combatRef={combatRef} visible={driveMode || showUnits} isSoftwareGl={isSoftwareGl} />
                  : showUnits && <battle.InfantryCrowd combatRef={combatRef} />}
                <battle.CombatActors
                  combatRef={combatRef}
                  driveMode={driveMode}
                  isSoftwareGl={isSoftwareGl || quality.reducedParticles}
                  waterVfxPoolRef={waterVfxPoolRef}
                  groundTrailsPoolRef={groundTrailsPoolRef}
                  muzzleFlashPoolRef={muzzleFlashPoolRef}
                  missileRibbonPoolRef={missileRibbonPoolRef}
                  debrisPoolRef={debrisPoolRef}
                  craterPoolRef={craterPoolRef}
                  heatShimmerPoolRef={heatShimmerPoolRef}
                />
                <battle.WaterEffects
                  poolRef={waterVfxPoolRef}
                  lightingPreset={lightingPreset}
                  isSoftwareGl={isSoftwareGl || quality.reducedParticles}
                  resetNonce={resetNonce}
                />
                <battle.GroundTrails
                  poolRef={groundTrailsPoolRef}
                  isSoftwareGl={isSoftwareGl || quality.reducedParticles}
                  resetNonce={resetNonce}
                />
                <battle.MuzzleFlashes
                  poolRef={muzzleFlashPoolRef}
                  resetNonce={resetNonce}
                />
                <battle.MissileRibbons
                  poolRef={missileRibbonPoolRef}
                  lightingPreset={lightingPreset}
                  resetNonce={resetNonce}
                />
                <battle.ShellCasingsAndDebris
                  casingMesh={casingMesh}
                  hideEmptyCasings={hideEmptyCasings}
                  casingsPoolRef={casingsPoolRef}
                  debrisPoolRef={debrisPoolRef}
                  waterVfxPoolRef={waterVfxPoolRef}
                  resetNonce={resetNonce}
                />
                <battle.Tracers
                  poolRef={tracerPoolRef}
                  resetNonce={resetNonce}
                />
                <battle.CuttingLaserBeam
                  combatRef={combatRef}
                  craterPoolRef={craterPoolRef}
                  heatShimmerPoolRef={heatShimmerPoolRef}
                  resetNonce={resetNonce}
                />
                <battle.HeatShimmer
                  poolRef={heatShimmerPoolRef}
                  lightingPreset={lightingPreset}
                  resetNonce={resetNonce}
                />
              </group>
            )}
          </ShellCasingMesh>
        )}

        <group name="perf:foliage">
        {world && <FoliageAndUnits stage={level} grassMap={grassMap}
          showUnits={showUnits}
          showMist={showMist}
          vegetation={graphics.vegetation}
          atmosphere={graphics.atmosphere}
          isSoftwareGl={isSoftwareGl}
          driveMode={driveMode}
          lightingPreset={lightingPreset}
          sunPos={lightCfg.keyPos}
          mechPoseRef={mechPoseRef}
          combatRef={combatRef}
        />}
        </group>

        {level >= 11 && <group name="perf:shafts">
        <VolumetricSunShafts
          lightingPreset={lightingPreset}
          sunPos={lightCfg.keyPos}
          visible={showMist && quality.fullAtmosphere}
          isSoftwareGl={isSoftwareGl}
        />
        <StormFront
          lightingPreset={lightingPreset}
          atmosphere={graphics.atmosphere}
          isSoftwareGl={isSoftwareGl}
          resetNonce={resetNonce}
        />
        </group>}

        <TacticalMarkers
          visible={showMarkers && !driveMode && !focusedSite}
          activeSector={activeSector}
          onSelectSector={onSelectSector}
        />
        <ScenePerformanceProbe
          adaptiveStep={activeAdaptation.cascadeStep}
          drsScale={graphics.resolutionScale}
          baseResolutionScale={preferences.resolutionScale}
          drsRecoveryWait={activeAdaptation.recoveryWait}
          drsContextLost={activeAdaptation.contextLostFallback}
          paused={paused}
          driveMode={driveMode}
          lightingPreset={lightingPreset}
          graphics={graphics}
          renderDpr={quality.dpr}
          shadowMapSize={quality.shadowMapSize}
          isSoftwareGl={isSoftwareGl}
          benchmarkContinuousFrames={benchmarkContinuousFrames}
        />
        </SceneSimulationProvider>
      </Canvas>
    </div>
  );
}
