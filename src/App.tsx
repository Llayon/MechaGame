import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLazyRef } from './utils/useLazyRef';
import { LightingPreset, SectorId } from './map/sectors';
import type { InfantrySite } from './map/infantryEncounters';
import { METERS_PER_UNIT } from './map/terrainMath';
import { MECH_SPAWN, MechTelemetrySnapshot } from './map/mechKinematics';
import { loadGrassMap, type WorldAssets } from './map/worldAssets';
import { detectSoftwareWebGL, MapScene } from './scene/MapScene';
import type { MechDriveInput } from './scene/objects/SovietMech';
import { TacticalHUD } from './components/TacticalHUD';
import { PerformancePanel } from './perf/PerformancePanel';
import { GraphicsSettingsMenu } from './components/GraphicsSettingsMenu';
import {
  GRAPHICS_PRESETS, readGraphicsSettings, resolveGraphicsRuntime,
  saveGraphicsSettings, withGraphicsPreset,
} from './game/graphicsSettings';
import type { GraphicsSettings } from './game/graphicsSettings';
import {
  applyContextLostFallback,
  clearPersistedDrs,
  createInitialAdaptiveState,
  drsSignature,
  effectiveGraphics,
  readPersistedDrs,
  savePersistedDrs,
  type AdaptiveState,
} from './lod/adaptiveQuality';
import {
  clearMechInput,
  normalizeKeyboardCode,
  syncMechInputFromKeys,
} from './scene/objects/MechController';
import { DesktopCombatInput } from './components/DesktopCombatInput';
import { createCombatAimState } from './game/combatAim';
import {
  createCombatState,
  resetCombatState,
} from './game/combatSimulation';
import { combatAudio } from './game/combatAudio';
import {
  type DeviceLayoutMode,
  type InputControlPreference,
  readBrowserDeviceLayout,
} from './utils/touchControls';

function hasAutostartParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

declare global {
  interface Window {
    __mechaAimDebug?: () => {
      aimYaw: number; elevation: number; precise: boolean;
      reticleVisible: boolean; turretYaw: number; hullYaw: number;
      pendingYaw: number; pendingElevation: number;
      pointerFire: boolean; keyboardFire: boolean; pointerLocked: boolean;
    };
  }
}

function createSpawnPose(): MechTelemetrySnapshot {
  return {
    x: MECH_SPAWN.x,
    y: MECH_SPAWN.y,
    z: MECH_SPAWN.z,
    yaw: MECH_SPAWN.yaw,
    turretYaw: 0,
    speedKmh: 0,
    elevationM: Math.round(MECH_SPAWN.y * METERS_PER_UNIT),
    isFiring: false,
    isBraced: false,
    isCrouched: false,
    inWater: false,
    onBridge: false,
  };
}

export default function App({ world, onOverviewDraw }: { world: WorldAssets | null; onOverviewDraw: () => void }) {
  const autostart = useRef(hasAutostartParam()).current;

  const [activeSector, setActiveSector] = useState<SectorId>('overview');
  const [focusedSite, setFocusedSite] = useState<InfantrySite | null>(null);
  const [transitionNonce, setTransitionNonce] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('dusk');
  const [requestedDriveMode, setDriveMode] = useState(autostart);
  const [terrainReady, setTerrainReady] = useState(false);
  const driveMode = requestedDriveMode && terrainReady && Boolean(world);
  const loadingLabel = useRef<HTMLDivElement>(null);
  const handleTerrainReady = useCallback(() => {
    if (loadingLabel.current) loadingLabel.current.style.visibility = "hidden";
    setTerrainReady(true);
    onOverviewDraw();
  }, [onOverviewDraw]);
  const [paused, setPaused] = useState(false);
  const [graphicsOpen, setGraphicsOpen] = useState(false);
  const graphicsWasRunningRef = useRef(false);
  const urlGraphicsPreset = useRef<keyof typeof GRAPHICS_PRESETS | null>(
    (() => {
      if (typeof window === 'undefined') return null;
      const preset = new URLSearchParams(window.location.search).get('graphics');
      return preset && Object.prototype.hasOwnProperty.call(GRAPHICS_PRESETS, preset)
        ? (preset as keyof typeof GRAPHICS_PRESETS)
        : null;
    })(),
  ).current;

  const [graphics, setGraphics] = useState<GraphicsSettings>(() => {
    // Explicit URL presets make CI A/B benchmarking reproducible.
    if (urlGraphicsPreset) {
      return withGraphicsPreset(urlGraphicsPreset);
    }
    return readGraphicsSettings();
  });

  const [adaptation, setAdaptation] = useState<AdaptiveState>(() => {
    if (!urlGraphicsPreset && graphics.autoQuality) {
      return readPersistedDrs(graphics) ?? createInitialAdaptiveState(graphics);
    }
    return createInitialAdaptiveState(graphics);
  });
  const [drsResetNonce, setDrsResetNonce] = useState(0);

  useEffect(() => {
    if (!urlGraphicsPreset) {
      saveGraphicsSettings(graphics);
    }
  }, [graphics, urlGraphicsPreset]);

  const handleGraphicsChange = useCallback((next: GraphicsSettings) => {
    const signatureChanged = drsSignature(graphics) !== drsSignature(next);
    setGraphics(next);
    if (signatureChanged) {
      if (!urlGraphicsPreset) clearPersistedDrs();
      setAdaptation(createInitialAdaptiveState(next));
    } else if (next.autoQuality && !graphics.autoQuality) {
      const restored = !urlGraphicsPreset ? readPersistedDrs(next) : null;
      setAdaptation(restored ?? createInitialAdaptiveState(next));
    } else if (!next.autoQuality && graphics.autoQuality) {
      setAdaptation(createInitialAdaptiveState(next));
    }
    setDrsResetNonce((n) => n + 1);
  }, [graphics, urlGraphicsPreset]);

  const handleAdaptationChange = useCallback((next: AdaptiveState) => {
    setAdaptation(next);
    if (!urlGraphicsPreset && graphics.autoQuality) {
      savePersistedDrs(graphics, next);
    }
  }, [graphics, urlGraphicsPreset]);

  const handleResetDrs = useCallback(() => {
    if (!urlGraphicsPreset) clearPersistedDrs();
    setAdaptation(createInitialAdaptiveState(graphics));
    setDrsResetNonce((n) => n + 1);
  }, [graphics, urlGraphicsPreset]);

  const handleContextLost = useCallback(() => {
    setAdaptation((prev) => {
      const next = applyContextLostFallback(prev, graphics);
      if (!urlGraphicsPreset && graphics.autoQuality) {
        savePersistedDrs(graphics, next);
      }
      return next;
    });
  }, [graphics, urlGraphicsPreset]);

  const activeDpr = useMemo(() => {
    const active = graphics.autoQuality ? adaptation : createInitialAdaptiveState(graphics);
    const eff = effectiveGraphics(graphics, active);
    const nativeDpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    return resolveGraphicsRuntime(eff, nativeDpr, detectSoftwareWebGL()).dpr;
  }, [graphics, adaptation]);
  const [muted, setMuted] = useState(false);
  const [grassMap, setGrassMap] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [grassFailed, setGrassFailed] = useState(false);
  const needsGrass = Boolean(world) && graphics.vegetation !== 'minimal';
  useEffect(() => {
    if (!needsGrass || grassMap || grassFailed) return;
    const controller = new AbortController();
    loadGrassMap(controller.signal).then(data => {
      if (!controller.signal.aborted) setGrassMap(data);
    }).catch(() => {
      if (!controller.signal.aborted) setGrassFailed(true);
    });
    return () => controller.abort();
  }, [needsGrass, grassMap, grassFailed]);
  const [missionOutcome, setMissionOutcome] = useState<'victory' | 'defeat' | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showUnits, setShowUnits] = useState(true);
  const [showMist, setShowMist] = useState(true);
  const [showWireframeGrid, setShowWireframeGrid] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [inputPref, setInputPref] = useState<InputControlPreference>('auto');
  const [layoutMode, setLayoutMode] = useState<DeviceLayoutMode>(() =>
    readBrowserDeviceLayout('auto'),
  );

  useEffect(() => {
    const refresh = () => {
      setLayoutMode(readBrowserDeviceLayout(inputPref));
    };
    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    const mq =
      typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
    mq?.addEventListener?.('change', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      mq?.removeEventListener?.('change', refresh);
    };
  }, [inputPref]);

  const mechPoseRef = useLazyRef(createSpawnPose);

  const driveInputRef = useRef<MechDriveInput>({
    forward: 0,
    turn: 0,
    turretTurn: 0,
    turretAimDelta: 0,
    gunAimDelta: 0,
    precisionAim: false,
    fire: false,
    laserFire: false,
    pointerLaserFire: false,
    heavyFire: false,
    missileSalvo: false,
    repair: false,
    dash: false,
    centerTurret: false,
    sprint: false,
    crouch: false,
  });

  const aimRef = useLazyRef(() => createCombatAimState(MECH_SPAWN.yaw));
  const combatRef = useLazyRef(() => createCombatState(autostart));

  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Read-only QA hook, available only with an explicit debug URL parameter.
    if (new URLSearchParams(window.location.search).get('debugAim') !== '1') return;
    window.__mechaAimDebug = () => ({
      aimYaw: aimRef.current.yaw,
      elevation: aimRef.current.elevation,
      precise: aimRef.current.precise,
      reticleVisible: aimRef.current.reticleVisible,
      turretYaw: mechPoseRef.current.turretYaw,
      hullYaw: mechPoseRef.current.yaw,
      pendingYaw: driveInputRef.current.turretAimDelta ?? 0,
      pendingElevation: driveInputRef.current.gunAimDelta ?? 0,
      pointerFire: !!driveInputRef.current.pointerFire,
      keyboardFire: driveInputRef.current.fire,
      pointerLocked: Boolean(document.pointerLockElement),
    });
    return () => { delete window.__mechaAimDebug; };
  }, []);

  const syncDriveInputFromKeys = useCallback(() => {
    syncMechInputFromKeys(pressedKeysRef.current, driveInputRef.current);
  }, []);

  const clearDriveInput = useCallback(() => {
    clearMechInput(pressedKeysRef.current, driveInputRef.current);
  }, []);

  // Mirror game shell state onto document.body.dataset.state
  useEffect(() => {
    if (!driveMode) {
      document.body.dataset.state = 'title';
    } else if (missionOutcome !== null) {
      document.body.dataset.state = 'gameover';
    } else if (paused) {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [driveMode, paused, missionOutcome]);

  // Suspend the Web Audio timeline as well as the simulation clock.
  useEffect(() => {
    combatAudio.setPaused(paused);
  }, [paused]);

  const handleSelectSector = useCallback(
    (id: SectorId, site?: InfantrySite) => {
      clearDriveInput();
      if (combatRef.current.missionStatus === 'paused') combatRef.current.missionStatus = 'playing';
      setDriveMode(false);
      setPaused(false);
      setActiveSector(id);
      setFocusedSite(site ?? null);
      if (site) setShowUnits(true);
      setTransitionNonce((n) => n + 1);
    },
    [clearDriveInput],
  );

  const handleResetOverview = useCallback(() => {
    clearDriveInput();
    if (combatRef.current.missionStatus === 'paused') combatRef.current.missionStatus = 'playing';
    setDriveMode(false);
    setPaused(false);
    setActiveSector('overview');
    setFocusedSite(null);
    setTransitionNonce((n) => n + 1);
  }, [clearDriveInput]);

  const driveModeRef = useRef(driveMode);
  driveModeRef.current = driveMode;

  const handleEnterDriveMode = useCallback(() => {
    combatAudio.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.focus();
    if (combatRef.current.missionStatus === 'idle' || combatRef.current.missionStatus === 'paused') {
      combatRef.current.missionStatus = 'playing';
    }
    setPaused(false);
    setDriveMode(true);
  }, []);

  const handleToggleDriveMode = useCallback(() => {
    combatAudio.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.focus();
    if (driveModeRef.current || (requestedDriveMode && !world)) {
      clearDriveInput();
      if (combatRef.current.missionStatus === 'paused') combatRef.current.missionStatus = 'playing';
      setPaused(false);
      setTransitionNonce((n) => n + 1);
      setDriveMode(false);
    } else {
      if (combatRef.current.missionStatus === 'idle' || combatRef.current.missionStatus === 'paused') {
        combatRef.current.missionStatus = 'playing';
      }
      setPaused(false);
      setDriveMode(true);
    }
  }, [clearDriveInput, requestedDriveMode, world]);

  const handleTogglePause = useCallback(() => {
    if (!driveMode || missionOutcome !== null) return;
    clearDriveInput();
    const next = !paused;
    combatRef.current.missionStatus = next ? 'paused' : 'playing';
    combatAudio.setPaused(next);
    setPaused(next);
  }, [driveMode, missionOutcome, paused, clearDriveInput]);

  const handleOpenGraphics = useCallback(() => {
    if (graphicsOpen) return;
    graphicsWasRunningRef.current = driveMode && !paused && missionOutcome === null;
    clearDriveInput();
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (graphicsWasRunningRef.current) {
      combatRef.current.missionStatus = 'paused';
      combatAudio.setPaused(true);
      setPaused(true);
    }
    setGraphicsOpen(true);
  }, [graphicsOpen, driveMode, paused, missionOutcome, clearDriveInput]);

  const handleCloseGraphics = useCallback(() => {
    setGraphicsOpen(false);
    if (graphicsWasRunningRef.current && driveMode && missionOutcome === null) {
      combatRef.current.missionStatus = 'playing';
      combatAudio.setPaused(false);
      setPaused(false);
    }
    graphicsWasRunningRef.current = false;
  }, [driveMode, missionOutcome]);

  const handleRestartMission = useCallback(() => {
    combatAudio.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    clearDriveInput();
    driveInputRef.current.crouch = false;
    resetCombatState(combatRef.current, 'playing');
    setFocusedSite(null);
    mechPoseRef.current = createSpawnPose();
    setMissionOutcome(null);
    setPaused(false);
    setDriveMode(true);
    setResetNonce((n) => n + 1);
  }, [clearDriveInput]);

  const handleToggleMute = useCallback(() => {
    setMuted(combatAudio.toggleMuted());
  }, []);

  const handleMissionEnded = useCallback(
    (outcome: 'victory' | 'defeat') => {
      clearDriveInput();
      setMissionOutcome(outcome);
      setPaused(false);
    },
    [clearDriveInput],
  );

  const keyboardActionsRef = useRef({
    driveMode,
    paused,
    missionOutcome,
    graphicsOpen,
    handleOpenGraphics,
    handleCloseGraphics,
    handleResetOverview,
    handleToggleDriveMode,
    handleTogglePause,
    handleRestartMission,
    handleToggleMute,
    syncDriveInputFromKeys,
    clearDriveInput,
  });
  keyboardActionsRef.current = {
    driveMode,
    paused,
    missionOutcome,
    graphicsOpen,
    handleOpenGraphics,
    handleCloseGraphics,
    handleResetOverview,
    handleToggleDriveMode,
    handleTogglePause,
    handleRestartMission,
    handleToggleMute,
    syncDriveInputFromKeys,
    clearDriveInput,
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctx = keyboardActionsRef.current;
      const code = normalizeKeyboardCode(e.code, e.key);
      if (!code) return;

      if (ctx.graphicsOpen) {
        if (code === 'Escape' || (code === 'KeyG' && !e.repeat)) {
          e.preventDefault();
          ctx.handleCloseGraphics();
        }
        return; // The graphics menu must not control the mech underneath.
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (code === 'KeyG' && !e.repeat) {
        e.preventDefault();
        ctx.handleOpenGraphics();
        return;
      }
      combatAudio.unlock();

      if (code === 'KeyH' && !e.repeat) {
        setHudHidden((prev) => !prev);
        return;
      }
      if (code === 'KeyU' && !e.repeat) {
        ctx.handleToggleMute();
        return;
      }
      if (code === 'KeyM' && !e.repeat) {
        e.preventDefault();
        ctx.handleToggleDriveMode();
        return;
      }
      if (code === 'KeyP' && ctx.driveMode && !e.repeat) {
        ctx.handleTogglePause();
        return;
      }
      if (code === 'KeyR' && ctx.driveMode && !e.repeat) {
        ctx.handleRestartMission();
        return;
      }
      if (code === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
          ctx.clearDriveInput();
        } else {
          ctx.handleResetOverview();
        }
        return;
      }

      if (!ctx.paused && ctx.missionOutcome === null) {
        const isNavKey =
          code === 'Space' ||
          code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight';
        if (isNavKey) {
          e.preventDefault();
          // Ensure Space/Arrows never re-trigger a focused HUD button
          if (document.activeElement instanceof HTMLButtonElement) {
            document.activeElement.blur();
          }
        }

        if (ctx.driveMode) {
          if (code === 'KeyC' && !e.repeat) {
            driveInputRef.current.crouch = !driveInputRef.current.crouch;
            return;
          }
          if (code === 'KeyF' && !e.repeat) {
            driveInputRef.current.heavyFire = true;
            return;
          }
          if (code === 'KeyZ' && !e.repeat) {
            driveInputRef.current.missileSalvo = true;
            return;
          }
          if (code === 'KeyV' && !e.repeat) {
            driveInputRef.current.repair = true;
            return;
          }
          if (code === 'KeyX' && !e.repeat) {
            driveInputRef.current.dash = true;
            return;
          }
          if (code === 'KeyT' && !e.repeat) {
            driveInputRef.current.centerTurret = true;
            return;
          }
        }

        pressedKeysRef.current.add(code);
        ctx.syncDriveInputFromKeys();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = normalizeKeyboardCode(e.code, e.key);
      if (code && pressedKeysRef.current.has(code)) {
        pressedKeysRef.current.delete(code);
        keyboardActionsRef.current.syncDriveInputFromKeys();
      }
    };

    const onBlur = () => {
      keyboardActionsRef.current.clearDriveInput();
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        keyboardActionsRef.current.clearDriveInput();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleCycleInputPref = useCallback(() => {
    setInputPref((prev) => {
      if (prev === 'auto') return layoutMode.useTouchControls ? 'desktop' : 'touch';
      if (prev === 'touch') return 'desktop';
      return 'auto';
    });
  }, [layoutMode.useTouchControls]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#091016]">
      <MapScene
        focusedSite={focusedSite}
        world={world}
        grassMap={grassMap}
        onTerrainReady={handleTerrainReady}
        activeSector={activeSector}
        transitionNonce={transitionNonce}
        resetNonce={resetNonce}
        lightingPreset={lightingPreset}
        graphics={graphics}
        adaptation={adaptation}
        drsResetNonce={drsResetNonce}
        drsSamplingPaused={graphicsOpen}
        onAdaptationChange={handleAdaptationChange}
        onContextLost={handleContextLost}
        driveMode={driveMode}
        useTouchControls={layoutMode.useTouchControls}
        paused={paused}
        mechPoseRef={mechPoseRef}
        driveInputRef={driveInputRef}
        aimRef={aimRef}
        combatRef={combatRef}
        showMarkers={showMarkers}
        showUnits={showUnits}
        showMist={showMist}
        showWireframeGrid={showWireframeGrid}
        onSelectSector={handleSelectSector}
        onEnterDriveMode={handleEnterDriveMode}
        onMissionEnded={handleMissionEnded}
      />
      {needsGrass && grassFailed && <button className="absolute bottom-20 left-4 z-50 rounded bg-slate-900 px-4 py-2 text-white" onClick={() => setGrassFailed(false)}>Повторить загрузку травы</button>}
      {requestedDriveMode && !world && <p role="status" className="pointer-events-none absolute inset-x-0 top-14 text-center text-sm text-cyan-100">Подготовка к бою…</p>}
      {terrainReady ? (
        <>
          <TacticalHUD
            focusedSite={focusedSite}
            activeSector={activeSector}
            lightingPreset={lightingPreset}
            driveMode={driveMode}
            paused={paused}
            muted={muted}
            missionOutcome={missionOutcome}
            layoutMode={layoutMode}
            inputPref={inputPref}
            mechPoseRef={mechPoseRef}
            driveInputRef={driveInputRef}
            aimRef={aimRef}
            combatRef={combatRef}
            resetNonce={resetNonce}
            showMarkers={showMarkers}
            showUnits={showUnits}
            showMist={showMist}
            showWireframeGrid={showWireframeGrid}
            hudHidden={hudHidden}
            onSelectSector={handleSelectSector}
            onResetOverview={handleResetOverview}
            onChangeLighting={setLightingPreset}
            onToggleDriveMode={handleToggleDriveMode}
            onTogglePause={handleTogglePause}
            onRestartMission={handleRestartMission}
            onToggleMute={handleToggleMute}
            onCycleInputPref={handleCycleInputPref}
            onToggleMarkers={() => setShowMarkers((v) => !v)}
            onToggleUnits={() => setShowUnits((v) => !v)}
            onToggleMist={() => setShowMist((v) => !v)}
            onToggleGrid={() => setShowWireframeGrid((v) => !v)}
            onToggleHud={() => setHudHidden((v) => !v)}
          />
          <DesktopCombatInput
            driveMode={driveMode}
            paused={paused}
            gameOver={missionOutcome !== null}
            useTouchControls={layoutMode.useTouchControls}
            driveInputRef={driveInputRef}
          />
          <GraphicsSettingsMenu
            open={graphicsOpen}
            settings={graphics}
            adaptation={adaptation}
            activeDpr={activeDpr}
            onChange={handleGraphicsChange}
            onResetDrs={handleResetDrs}
            onOpen={handleOpenGraphics}
            onClose={handleCloseGraphics}
          />
          <PerformancePanel />
        </>
      ) : (
        <div ref={world ? undefined : loadingLabel} className={`absolute inset-0 z-50 grid place-items-center text-cyan-100 ${world ? "bg-[#091016]" : "pointer-events-none"}`} role="status">
          Загрузка карты…
        </div>
      )}
    </main>
  );
}
