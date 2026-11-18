import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { MechDriveInput } from '../scene/objects/MechState';
import { mouseMovementToAimDelta } from '../game/combatAim';

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
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const active = driveMode && !paused && !gameOver && !useTouchControls;
    const input = driveInputRef.current;
    if (!active) {
      setLocked(false);
      input.precisionAim = false;
      input.pointerFire = false;
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
      // Only suppress browser default on RMB so LMB naturally focuses the canvas/iframe
      if (event.button === 2) event.preventDefault();
      if (document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.blur();
      }
      window.focus();
      if (event.button === 0) input.pointerFire = true;
      if (event.button === 2) input.precisionAim = true;
      if (document.pointerLockElement !== canvas) {
        try {
          const maybePromise = canvas.requestPointerLock?.() as unknown;
          if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
            (maybePromise as Promise<unknown>).catch(() => {});
          }
        } catch {
          // The held-button drag path also works in embedded previews that reject pointer lock.
        }
      }
    };
    const onMouseMove = (event: MouseEvent) => {
      const draggingOnScene = (input.precisionAim && (event.buttons & 2) !== 0) ||
        (input.pointerFire && (event.buttons & 1) !== 0);
      if (!document.pointerLockElement && !draggingOnScene) return;
      const { yaw, elevation } = mouseMovementToAimDelta(event.movementX, event.movementY);
      input.turretAimDelta = (input.turretAimDelta ?? 0) + yaw;
      input.gunAimDelta = (input.gunAimDelta ?? 0) + elevation;
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) input.pointerFire = false;
      if (event.button === 2) input.precisionAim = false;
    };
    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) event.preventDefault();
    };
    const onUnlock = () => {
      setLocked(Boolean(document.pointerLockElement));
      if (document.pointerLockElement) return;
      input.pointerFire = false;
      input.precisionAim = false;
      input.turretAimDelta = 0;
      input.gunAimDelta = 0;
    };
    const onBlur = () => {
      input.pointerFire = false;
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
      input.pointerFire = false;
      input.gunAimDelta = 0;
      input.turretAimDelta = 0;
      if (document.pointerLockElement) document.exitPointerLock?.();
    };
  }, [driveMode, paused, gameOver, useTouchControls, driveInputRef]);
  const showHint = driveMode && !paused && !gameOver && !useTouchControls && !locked;
  return showHint ? (
    <div data-testid="desktop-aim-hint" aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-1/2 z-[15] w-max max-w-[94vw] -translate-x-1/2 rounded-md border border-amber-400/35 bg-[#09131d]/85 px-3 py-2 text-center text-[11px] font-medium text-amber-100 shadow-lg">
      ЛКМ — огонь · Удерживайте ПКМ и двигайте мышь для точного прицеливания · Esc — курсор
    </div>
  ) : null;
}
