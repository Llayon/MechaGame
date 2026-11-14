import { useCallback, useEffect, useRef, useState } from 'react';
import { LightingPreset, SectorId } from './map/sectors';
import { METERS_PER_UNIT } from './map/terrainMath';
import {
  MECH_SPAWN,
  MechTelemetrySnapshot,
} from './map/mechKinematics';
import { MapScene } from './scene/MapScene';
import type { MechDriveInput } from './scene/objects/SovietMech';
import { TacticalHUD } from './components/TacticalHUD';

export default function App() {
  const [activeSector, setActiveSector] = useState<SectorId>('overview');
  const [transitionNonce, setTransitionNonce] = useState(0);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('dusk');
  const [driveMode, setDriveMode] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showUnits, setShowUnits] = useState(true);
  const [showMist, setShowMist] = useState(true);
  const [showWireframeGrid, setShowWireframeGrid] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);

  const mechPoseRef = useRef<MechTelemetrySnapshot>({
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
  });

  const driveInputRef = useRef<MechDriveInput>({
    forward: 0,
    turn: 0,
    turretTurn: 0,
    fire: false,
    sprint: false,
    crouch: false,
  });

  const pressedKeysRef = useRef<Set<string>>(new Set());

  const syncDriveInputFromKeys = useCallback(() => {
    const keys = pressedKeysRef.current;
    const input = driveInputRef.current;
    input.forward =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    input.turn =
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    input.turretTurn =
      (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
    input.fire = keys.has('Space');
    input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }, []);

  const clearDriveInput = useCallback(() => {
    pressedKeysRef.current.clear();
    driveInputRef.current.forward = 0;
    driveInputRef.current.turn = 0;
    driveInputRef.current.turretTurn = 0;
    driveInputRef.current.fire = false;
    driveInputRef.current.sprint = false;
  }, []);

  const handleSelectSector = useCallback(
    (id: SectorId) => {
      clearDriveInput();
      setDriveMode(false);
      setActiveSector(id);
      setTransitionNonce((n) => n + 1);
    },
    [clearDriveInput],
  );

  const handleResetOverview = useCallback(() => {
    clearDriveInput();
    setDriveMode(false);
    setActiveSector('overview');
    setTransitionNonce((n) => n + 1);
  }, [clearDriveInput]);

  const handleToggleDriveMode = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDriveMode((prev) => {
      if (prev) {
        clearDriveInput();
        setTransitionNonce((n) => n + 1);
      }
      return !prev;
    });
  }, [clearDriveInput]);

  const handleEnterDriveMode = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDriveMode(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'KeyH') {
        setHudHidden((prev) => !prev);
        return;
      }
      if (e.code === 'KeyM') {
        handleToggleDriveMode();
        return;
      }
      if (e.code === 'Escape') {
        handleResetOverview();
        return;
      }

      if (driveMode) {
        if (
          e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight'
        ) {
          e.preventDefault();
        }
        if (e.code === 'KeyC' && !e.repeat) {
          driveInputRef.current.crouch = !driveInputRef.current.crouch;
          return;
        }
        pressedKeysRef.current.add(e.code);
        syncDriveInputFromKeys();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pressedKeysRef.current.has(e.code)) {
        pressedKeysRef.current.delete(e.code);
        syncDriveInputFromKeys();
      }
    };

    const onBlur = () => {
      clearDriveInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [driveMode, handleResetOverview, handleToggleDriveMode, syncDriveInputFromKeys, clearDriveInput]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#091016]">
      <MapScene
        activeSector={activeSector}
        transitionNonce={transitionNonce}
        lightingPreset={lightingPreset}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        driveInputRef={driveInputRef}
        showMarkers={showMarkers}
        showUnits={showUnits}
        showMist={showMist}
        showWireframeGrid={showWireframeGrid}
        onSelectSector={handleSelectSector}
        onEnterDriveMode={handleEnterDriveMode}
      />
      <TacticalHUD
        activeSector={activeSector}
        lightingPreset={lightingPreset}
        driveMode={driveMode}
        mechPoseRef={mechPoseRef}
        driveInputRef={driveInputRef}
        showMarkers={showMarkers}
        showUnits={showUnits}
        showMist={showMist}
        showWireframeGrid={showWireframeGrid}
        hudHidden={hudHidden}
        onSelectSector={handleSelectSector}
        onResetOverview={handleResetOverview}
        onChangeLighting={setLightingPreset}
        onToggleDriveMode={handleToggleDriveMode}
        onToggleMarkers={() => setShowMarkers((v) => !v)}
        onToggleUnits={() => setShowUnits((v) => !v)}
        onToggleMist={() => setShowMist((v) => !v)}
        onToggleGrid={() => setShowWireframeGrid((v) => !v)}
        onToggleHud={() => setHudHidden((v) => !v)}
      />
    </main>
  );
}
