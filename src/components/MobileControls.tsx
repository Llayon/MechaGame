import { useRef, useState } from 'react';
import { Crosshair, Flame, Rocket, ShieldPlus, Sun, Wind, Zap } from 'lucide-react';
import type { CombatTelemetrySnapshot } from '../game/combatTypes';
import type { MechDriveInput } from '../scene/objects/MechState';
import { computeJoystickAxes, computeTouchAimDelta, computeTouchAimPitchDelta } from '../utils/touchControls';

interface MobileControlsProps {
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  combatHud: CombatTelemetrySnapshot;
  isFiring: boolean;
  crouchUi: boolean;
  isLandscapeMobile: boolean;
  onToggleCrouch: () => void;
}

export function MobileControls({
  driveInputRef,
  combatHud,
  isFiring,
  crouchUi,
  isLandscapeMobile,
  onToggleCrouch,
}: MobileControlsProps) {
  const [stickPos, setStickPos] = useState({ x: 0, y: 0, sprint: false, active: false });
  const joyPointerRef = useRef<number | null>(null);
  const joyCenterRef = useRef({ x: 0, y: 0, radius: 44 });

  const firePointerRef = useRef<number | null>(null);
  const laserPointerRef = useRef<number | null>(null);
  const aimPointerRef = useRef<number | null>(null);
  const lastAimXRef = useRef(0);
  const lastAimYRef = useRef(0);

  const joyRadius = isLandscapeMobile ? 38 : 44;

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const { x: cx, y: cy, radius } = joyCenterRef.current;
    const res = computeJoystickAxes(clientX - cx, clientY - cy, radius);
    driveInputRef.current.forward = res.forward;
    driveInputRef.current.turn = res.turn;
    driveInputRef.current.sprint = res.sprint;
    setStickPos({ x: res.stickX, y: res.stickY, sprint: res.sprint, active: true });
  };

  const resetJoystick = () => {
    joyPointerRef.current = null;
    driveInputRef.current.forward = 0;
    driveInputRef.current.turn = 0;
    driveInputRef.current.sprint = false;
    setStickPos({ x: 0, y: 0, sprint: false, active: false });
  };

  const resetFire = () => {
    firePointerRef.current = null;
    driveInputRef.current.fire = false;
  };

  const resetLaser = () => {
    laserPointerRef.current = null;
    driveInputRef.current.pointerLaserFire = false;
  };

  const heatPct = Math.round(combatHud.weaponHeat * 100);
  const laserPct = Math.round(combatHud.laserEnergy * 100);

  return (
    <>
      {/* Full right-half touch swipe zone for 1:1 turret aiming while driving */}
      <div
        data-testid="mobile-aim-zone"
        aria-hidden="true"
        className="pointer-events-auto fixed inset-y-0 right-0 z-0 w-[56%] touch-none"
        onPointerDown={(e) => {
          if (aimPointerRef.current !== null) return;
          aimPointerRef.current = e.pointerId;
          lastAimXRef.current = e.clientX;
          lastAimYRef.current = e.clientY;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture errors on synthetic pointers
          }
        }}
        onPointerMove={(e) => {
          if (aimPointerRef.current !== e.pointerId) return;
          const deltaX = e.clientX - lastAimXRef.current;
          const deltaY = e.clientY - lastAimYRef.current;
          lastAimXRef.current = e.clientX;
          lastAimYRef.current = e.clientY;
          if (Math.abs(deltaX) > 0.25) {
            driveInputRef.current.turretAimDelta =
              (driveInputRef.current.turretAimDelta ?? 0) + computeTouchAimDelta(deltaX);
          }
          if (Math.abs(deltaY) > 0.25) {
            driveInputRef.current.gunAimDelta =
              (driveInputRef.current.gunAimDelta ?? 0) + computeTouchAimPitchDelta(deltaY);
          }
        }}
        onPointerUp={(e) => {
          if (aimPointerRef.current === e.pointerId) {
            aimPointerRef.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (aimPointerRef.current === e.pointerId) {
            aimPointerRef.current = null;
          }
        }}
      />

      {/* Left Virtual Analog Joystick + Right Thumb Combat Arc */}
      <div className="pointer-events-none relative z-10 flex w-full items-end justify-between gap-2 pb-[max(4px,env(safe-area-inset-bottom))]">
        {/* Left Analog Stick */}
        <div
          data-testid="mobile-joystick"
          role="application"
          aria-label="Сенсорный джойстик движения"
          className={`pointer-events-auto relative flex items-center justify-center rounded-full border bg-[#0b131b]/75 shadow-xl touch-none select-none ${
            stickPos.sprint
              ? 'border-cyan-400/80 shadow-[0_0_16px_rgba(34,211,238,0.3)]'
              : stickPos.active
                ? 'border-amber-400/75'
                : 'border-[#5f86a1]/45'
          } ${isLandscapeMobile ? 'h-[100px] w-[100px]' : 'h-[116px] w-[116px]'}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (joyPointerRef.current !== null) return;
            const rect = e.currentTarget.getBoundingClientRect();
            joyPointerRef.current = e.pointerId;
            joyCenterRef.current = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              radius: joyRadius,
            };
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore synthetic capture failures
            }
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (joyPointerRef.current !== e.pointerId) return;
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (joyPointerRef.current === e.pointerId) {
              resetJoystick();
            }
          }}
          onPointerCancel={(e) => {
            if (joyPointerRef.current === e.pointerId) {
              resetJoystick();
            }
          }}
          onLostPointerCapture={() => {
            if (joyPointerRef.current !== null) {
              resetJoystick();
            }
          }}
        >
          {/* Subtle axis crosshairs */}
          <span className="pointer-events-none absolute inset-x-4 h-px bg-slate-500/30" />
          <span className="pointer-events-none absolute inset-y-4 w-px bg-slate-500/30" />
          <span className="pointer-events-none absolute top-1.5 font-mono-tabular text-[9px] font-bold tracking-wider text-slate-400">
            {stickPos.sprint ? 'СПРИНТ' : '▲'}
          </span>
          <span className="pointer-events-none absolute bottom-1.5 text-[9px] text-slate-500">
            ▼
          </span>
          <div
            className={`pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-colors ${
              stickPos.sprint
                ? 'border-cyan-200 bg-cyan-500/45'
                : stickPos.active
                  ? 'border-amber-200 bg-amber-500/45'
                  : 'border-slate-400/60 bg-slate-700/75'
            }`}
            style={{
              transform: `translate(${stickPos.x.toFixed(1)}px, ${stickPos.y.toFixed(1)}px)`,
            }}
          >
            <div className="h-3 w-3 rounded-full bg-amber-100/90" />
          </div>
        </div>

        {/* Right Combat & Turret Cluster */}
        <div
          data-testid="mobile-combat-cluster"
          className="pointer-events-auto flex flex-col items-end gap-1.5 touch-none select-none"
        >
          {/* Quick Turret Rotation & Center Strip */}
          <div className="flex items-center gap-1" role="group" aria-label="Поворот башни">
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.stopPropagation();
                driveInputRef.current.turretTurn = 1;
              }}
              onPointerUp={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              onPointerLeave={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              onPointerCancel={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              className="flex h-9 min-w-[40px] items-center justify-center rounded border border-slate-600/80 bg-[#0b131b]/88 px-2 text-xs font-bold text-slate-200 active:bg-amber-500/30"
              aria-label="Башня влево"
            >
              ↺
            </button>
            <button
              type="button"
              tabIndex={-1}
              data-testid="center-turret-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                driveInputRef.current.centerTurret = true;
              }}
              className="flex h-9 items-center gap-1 rounded border border-slate-600/80 bg-[#0b131b]/88 px-2.5 text-[11px] font-semibold text-slate-200 active:bg-amber-500/30"
              aria-label="Центрировать башню"
            >
              <Crosshair className="h-3.5 w-3.5 text-amber-300" />
              <span>Центр</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.stopPropagation();
                driveInputRef.current.turretTurn = -1;
              }}
              onPointerUp={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              onPointerLeave={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              onPointerCancel={() => {
                driveInputRef.current.turretTurn = 0;
              }}
              className="flex h-9 min-w-[40px] items-center justify-center rounded border border-slate-600/80 bg-[#0b131b]/88 px-2 text-xs font-bold text-slate-200 active:bg-amber-500/30"
              aria-label="Башня вправо"
            >
              ↻
            </button>
          </div>

          {/* Abilities Grid + Primary Fire Trigger */}
          <div className="flex items-end gap-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                data-testid="missile-salvo-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  driveInputRef.current.missileSalvo = true;
                }}
                disabled={combatHud.missileCooldown > 0.05}
                className={`col-span-2 flex h-10 items-center justify-center gap-1.5 rounded border px-2 font-mono-tabular text-[11px] font-bold leading-tight ${
                  combatHud.missileCooldown <= 0.05
                    ? 'border-orange-400/70 bg-[#0b131b]/90 text-orange-100 active:bg-orange-500/35'
                    : 'border-slate-700/80 bg-[#0b131b]/75 text-slate-400'
                }`}
                aria-label="Ракетный залп"
              >
                <Rocket className="h-3.5 w-3.5 text-orange-300" />
                <span>
                  Залп ·{' '}
                  {combatHud.missileCooldown <= 0.05
                    ? 'ГОТОВ'
                    : `${combatHud.missileCooldown.toFixed(1)}с`}
                </span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="heavy-cannon-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  driveInputRef.current.heavyFire = true;
                }}
                disabled={combatHud.heavyCooldown > 0.05}
                className={`flex h-11 min-w-[74px] flex-col items-center justify-center rounded border px-2 font-mono-tabular text-[11px] font-bold leading-tight ${
                  combatHud.heavyCooldown <= 0.05
                    ? 'border-sky-400/70 bg-[#0b131b]/90 text-sky-100 active:bg-sky-500/35'
                    : 'border-slate-700/80 bg-[#0b131b]/75 text-slate-400'
                }`}
                aria-label="105-мм орудие"
              >
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-sky-300" />
                  105-мм
                </span>
                <span className="text-[10px] font-semibold">
                  {combatHud.heavyCooldown <= 0.05
                    ? 'ГОТОВ'
                    : `${combatHud.heavyCooldown.toFixed(1)}с`}
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-testid="dash-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  driveInputRef.current.dash = true;
                }}
                disabled={combatHud.dashCooldown > 0.05}
                className={`flex h-11 min-w-[74px] flex-col items-center justify-center rounded border px-2 font-mono-tabular text-[11px] font-bold leading-tight ${
                  combatHud.dashActive
                    ? 'border-cyan-300 bg-cyan-500/40 text-white'
                    : combatHud.dashCooldown <= 0.05
                      ? 'border-cyan-400/70 bg-[#0b131b]/90 text-cyan-100 active:bg-cyan-500/35'
                      : 'border-slate-700/80 bg-[#0b131b]/75 text-slate-400'
                }`}
                aria-label="Реактивный рывок"
              >
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3 text-cyan-300" />
                  Рывок
                </span>
                <span className="text-[10px] font-semibold">
                  {combatHud.dashActive
                    ? 'РЫВОК'
                    : combatHud.dashCooldown <= 0.05
                      ? 'ГОТОВ'
                      : `${combatHud.dashCooldown.toFixed(1)}с`}
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-testid="repair-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  driveInputRef.current.repair = true;
                }}
                disabled={combatHud.repairCharges <= 0 || combatHud.repairCooldown > 0.1}
                className={`flex h-11 min-w-[74px] items-center justify-center gap-1 rounded border px-2 font-mono-tabular text-[11px] font-bold ${
                  combatHud.repairCharges > 0 && combatHud.repairCooldown <= 0.1
                    ? 'border-emerald-400/65 bg-[#0b131b]/90 text-emerald-100 active:bg-emerald-500/35'
                    : 'border-slate-700/80 bg-[#0b131b]/75 text-slate-400'
                }`}
                aria-label="Ремкомплект"
              >
                <ShieldPlus className="h-3.5 w-3.5 text-emerald-300" />
                <span>
                  ×{combatHud.repairCharges}
                  {combatHud.repairCooldown > 0.1 ? ` ${combatHud.repairCooldown.toFixed(0)}с` : ''}
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-testid="mobile-crouch-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleCrouch();
                }}
                aria-pressed={crouchUi}
                className={`flex h-11 min-w-[74px] items-center justify-center rounded border px-2 text-[11px] font-bold ${
                  crouchUi
                    ? 'border-sky-400/75 bg-sky-500/30 text-sky-100'
                    : 'border-slate-600/80 bg-[#0b131b]/90 text-slate-200'
                }`}
                aria-label="Присед"
              >
                Присед
              </button>
            </div>

            {/* Hold precision zoom; preserves two-thumb movement and aim. */}
            <button
              type="button"
              data-testid="mobile-precision-aim"
              onPointerDown={(e) => {
                e.stopPropagation();
                driveInputRef.current.precisionAim = true;
              }}
              onPointerUp={() => { driveInputRef.current.precisionAim = false; }}
              onPointerCancel={() => { driveInputRef.current.precisionAim = false; }}
              onPointerLeave={() => { driveInputRef.current.precisionAim = false; }}
              className="min-h-[66px] min-w-[44px] rounded-lg border border-sky-400/60 bg-[#0b131b]/90 px-2 text-[10px] font-semibold text-sky-100 touch-none"
              aria-label="Удерживать точный прицел"
            >
              ПРИЦЕЛ
            </button>

            {/* Hold-to-fire Plasma Cutting Laser ("Луч-7") */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="mobile-laser-btn"
              aria-pressed={combatHud.laserActive}
              aria-disabled={combatHud.laserOverheated}
              aria-label="Плазменный резак Луч-7"
              onPointerDown={(e) => {
                e.stopPropagation();
                laserPointerRef.current = e.pointerId;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore synthetic pointer capture error
                }
                driveInputRef.current.pointerLaserFire = true;
              }}
              onPointerUp={(e) => {
                if (laserPointerRef.current === e.pointerId) {
                  resetLaser();
                }
              }}
              onPointerCancel={(e) => {
                if (laserPointerRef.current === e.pointerId) {
                  resetLaser();
                }
              }}
              onLostPointerCapture={() => {
                if (laserPointerRef.current !== null) {
                  resetLaser();
                }
              }}
              className={`flex min-h-[66px] min-w-[46px] flex-col items-center justify-center rounded-lg border px-1.5 font-mono-tabular text-[10px] font-bold touch-none select-none ${
                combatHud.laserOverheated
                  ? 'border-red-400/75 bg-red-950/70 text-red-200'
                  : combatHud.laserActive
                    ? 'border-cyan-200 bg-cyan-500/55 text-white shadow-[0_0_16px_rgba(34,211,238,0.5)]'
                    : 'border-cyan-400/65 bg-[#0b131b]/90 text-cyan-100 active:bg-cyan-500/35'
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-cyan-300" />
              <span className="mt-0.5 leading-none">ЛУЧ</span>
              <span className="mt-0.5 text-[9px] text-cyan-200/85">{laserPct}%</span>
            </button>

            {/* Primary 37-mm Hold-to-Fire Trigger */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="mobile-fire-btn"
              aria-pressed={isFiring}
              aria-label="Огонь 37-мм"
              onPointerDown={(e) => {
                e.stopPropagation();
                firePointerRef.current = e.pointerId;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore synthetic pointer capture error
                }
                driveInputRef.current.fire = true;
              }}
              onPointerUp={(e) => {
                if (firePointerRef.current === e.pointerId) {
                  resetFire();
                }
              }}
              onPointerCancel={(e) => {
                if (firePointerRef.current === e.pointerId) {
                  resetFire();
                }
              }}
              onLostPointerCapture={() => {
                if (firePointerRef.current !== null) {
                  resetFire();
                }
              }}
              className={`flex flex-col items-center justify-center rounded-full border-2 font-mono-tabular font-bold shadow-2xl touch-none select-none ${
                isLandscapeMobile ? 'h-[66px] w-[66px]' : 'h-[76px] w-[76px]'
              } ${
                combatHud.weaponOverheated
                  ? 'border-red-400 bg-red-900/80 text-red-200'
                  : isFiring
                    ? 'border-amber-200 bg-red-500/85 text-white shadow-[0_0_22px_rgba(245,158,11,0.55)]'
                    : 'border-red-400/75 bg-red-600/45 text-amber-100 active:bg-red-500/75'
              }`}
            >
              <Flame className="h-5 w-5 text-amber-200" />
              <span className="mt-0.5 text-[10px] leading-none">
                {combatHud.weaponOverheated ? 'ГРЕВ' : 'ОГОНЬ'}
              </span>
              <span className="mt-0.5 text-[9px] text-amber-200/80">{heatPct}%</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
