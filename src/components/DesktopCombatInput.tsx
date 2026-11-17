import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { MechDriveInput } from '../scene/objects/MechState';
import { MOUSE_ELEVATION_SENSITIVITY, MOUSE_YAW_SENSITIVITY } from '../game/combatAim';

interface Props {
  driveMode: boolean;
  paused: boolean;
  gameOver: boolean;
  useTouchControls: boolean;
  driveInputRef: MutableRefObject<MechDriveInput>;
}

/**
 * Click on game canvas requests pointer lock. Mouse delta changes view;
 * LMB fires, RMB focuses. Release, blur, pause and exiting combat clear input.
 */
export function DesktopCombatInput({driveMode, paused, gameOver, useTouchControls, driveInputRef}: Props) {
  useEffect(() => {
    const active = driveMode && !paused && !gameOver && !useTouchControls;
    const input = driveInputRef.current;
    if (!active) {
      input.precisionAim = false;
      input.gunAimDelta = 0;
      input.turretAimDelta = 0;
      if (document.pointerLockElement) document.exitPointerLock?.();
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      const canvas = event.target;
      if (!(canvas instanceof HTMLCanvasElement) ||
          !canvas.closest('[data-testid="map-canvas-container"]')) return;
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      if (event.button === 0) input.fire = true;
      if (event.button === 2) input.precisionAim = true;
      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock?.();
      }
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!document.pointerLockElement) return;
      input.turretAimDelta = (input.turretAimDelta ?? 0) +
        event.movementX * MOUSE_YAW_SENSITIVITY;
      input.gunAimDelta = (input.gunAimDelta ?? 0) -
        event.movementY * MOUSE_ELEVATION_SENSITIVITY;
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) input.fire = false;
      if (event.button === 2) input.precisionAim = false;
    };
    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) event.preventDefault();
    };
    const onUnlock = () => {
      if (document.pointerLockElement) return;
      input.fire = false;
      input.precisionAim = false;
      input.turretAimDelta = 0;
      input.gunAimDelta = 0;
    };
    const onBlur = () => {
      input.fire = false;
      input.precisionAim = false;
      input.turretAimDelta = 0;
      input.gunAimDelta = 0;
      if (document.pointerLockElement) document.exitPointerLock?.();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onUnlock);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onUnlock);
      window.removeEventListener('blur', onBlur);
      input.precisionAim = false;
      input.fire = false;
      input.gunAimDelta = 0;
      input.turretAimDelta = 0;
      if (document.pointerLockElement) document.exitPointerLock?.();
    };
  }, [driveMode, paused, gameOver, useTouchControls, driveInputRef]);
  return null;
}
