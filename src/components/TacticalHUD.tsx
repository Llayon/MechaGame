import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  Grid3x3,
  Keyboard,
  Layers,
  Map as MapIcon,
  MapPin,
  Moon,
  Navigation,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  RotateCw,
  ShieldPlus,
  Sun,
  Sunset,
  Truck,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import {
  LightingPreset,
  SECTORS,
  SECTOR_ORDER,
  SectorId,
} from '../map/sectors';
import { MAP_DEPTH, MAP_HALF_D, MAP_HALF_W, MAP_WIDTH } from '../map/terrainMath';
import type { MechTelemetrySnapshot } from '../map/mechKinematics';
import type { MechDriveInput } from '../scene/objects/SovietMech';
import type { CombatTelemetrySnapshot } from '../game/combatTypes';
import type { DeviceLayoutMode, InputControlPreference } from '../utils/touchControls';
import { MobileControls } from './MobileControls';
import { projectedReticlePercent } from '../game/combatAim';
import { smoothMuzzleIndicator } from '../game/reticlePresentation';
import type { CombatAimState } from '../game/combatAim';

interface TacticalHUDProps {
  activeSector: SectorId;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  paused: boolean;
  muted: boolean;
  missionOutcome: 'victory' | 'defeat' | null;
  layoutMode: DeviceLayoutMode;
  inputPref: InputControlPreference;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  aimRef: React.MutableRefObject<CombatAimState>;
  combatTelemetryRef: React.MutableRefObject<CombatTelemetrySnapshot>;
  showMarkers: boolean;
  showUnits: boolean;
  showMist: boolean;
  showWireframeGrid: boolean;
  hudHidden: boolean;
  onSelectSector: (id: SectorId) => void;
  onResetOverview: () => void;
  onChangeLighting: (preset: LightingPreset) => void;
  onToggleDriveMode: () => void;
  onTogglePause: () => void;
  onRestartMission: () => void;
  onToggleMute: () => void;
  onCycleInputPref: () => void;
  onToggleMarkers: () => void;
  onToggleUnits: () => void;
  onToggleMist: () => void;
  onToggleGrid: () => void;
  onToggleHud: () => void;
}

const MINIMAP_NODES: Array<{ id: SectorId; label: string; x: number; y: number }> = [
  { id: 'airfield', label: 'HQ', x: 30, y: 103 },
  { id: 'crossing', label: 'A·B', x: 106, y: 34 },
  { id: 'refinery', label: 'IND', x: 118, y: 69 },
  { id: 'citadel', label: 'CIT', x: 202, y: 36 },
  { id: 'quarry', label: 'QRY', x: 196, y: 92 },
];

function worldToMinimap(x: number, z: number): { mx: number; my: number } {
  const mx = 18 + ((x + MAP_HALF_W) / MAP_WIDTH) * 204;
  const my = 18 + ((z + MAP_HALF_D) / MAP_DEPTH) * 96;
  return { mx, my };
}

function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function TacticalHUD({
  activeSector,
  lightingPreset,
  driveMode,
  paused,
  muted,
  missionOutcome,
  layoutMode,
  inputPref,
  mechPoseRef,
  driveInputRef,
  aimRef,
  combatTelemetryRef,
  showMarkers,
  showUnits,
  showMist,
  showWireframeGrid,
  hudHidden,
  onSelectSector,
  onResetOverview,
  onChangeLighting,
  onToggleDriveMode,
  onTogglePause,
  onRestartMission,
  onToggleMute,
  onCycleInputPref,
  onToggleMarkers,
  onToggleUnits,
  onToggleMist,
  onToggleGrid,
  onToggleHud,
}: TacticalHUDProps) {
  const sector = SECTORS[activeSector];
  const muzzleIndicatorRef = useRef<HTMLDivElement>(null);
  const sightLabelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!driveMode || paused || missionOutcome !== null || hudHidden) return;
    let raf = 0;
    let lastFrameTime: number | null = null;
    let displayed: { x: number; y: number } | null = null;
    const update = (now: number) => {
      const aim = aimRef.current;
      const marker = muzzleIndicatorRef.current;
      if (marker) {
        if (aim.reticleVisible) {
          const target = projectedReticlePercent(aim.reticleX, aim.reticleY);
          displayed = smoothMuzzleIndicator(displayed, target,
            lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000);
          marker.style.left = displayed.x + '%';
          marker.style.top = displayed.y + '%';
          marker.style.opacity = '0.82';
          const rings = marker.querySelector('[data-testid="muzzle-indicator-ring"]');
          if (rings) rings.setAttribute('stroke',
            aim.reticleHit === 'enemy' ? '#fbbf24' : '#67cfe6');
        } else {
          marker.style.opacity = '0';
          displayed = null;
        }
      }
      if (sightLabelRef.current) {
        sightLabelRef.current.textContent = aim.reticleHit === 'enemy'
          ? 'СТВОЛ · ЦЕЛЬ'
          : aim.reticleHit === 'cover' ? 'СТВОЛ · УКРЫТИЕ'
          : aim.precise ? 'ТОЧНЫЙ ПРИЦЕЛ · ПКМ' : 'НАВЕДЕНИЕ';
      }
      lastFrameTime = now;
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [driveMode, paused, missionOutcome, hudHidden, aimRef]);
  const [mechHud, setMechHud] = useState<MechTelemetrySnapshot>(() => ({
    ...mechPoseRef.current,
  }));
  const [combatHud, setCombatHud] = useState<CombatTelemetrySnapshot>(() => ({
    ...combatTelemetryRef.current,
  }));
  const [ghostHp, setGhostHp] = useState(combatTelemetryRef.current.playerHp);
  const [crouchUi, setCrouchUi] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  // Sync Drive HUD & combat telemetry at ~10 Hz only while driving
  useEffect(() => {
    setMechHud({ ...mechPoseRef.current });
    setCombatHud({ ...combatTelemetryRef.current });
    if (!paused) setGhostHp(combatTelemetryRef.current.playerHp);
    setCrouchUi(driveInputRef.current.crouch);
    if (!driveMode || paused) return;
    const id = window.setInterval(() => {
      const next = mechPoseRef.current;
      const nextCombat = combatTelemetryRef.current;
      const nextCrouch = driveInputRef.current.crouch;
      setCrouchUi((prev) => (prev === nextCrouch ? prev : nextCrouch));
      setMechHud((prev) => {
        if (
          Math.abs(prev.x - next.x) < 0.01 &&
          Math.abs(prev.z - next.z) < 0.01 &&
          Math.abs(prev.yaw - next.yaw) < 0.005 &&
          Math.abs(prev.turretYaw - next.turretYaw) < 0.005 &&
          Math.abs(prev.speedKmh - next.speedKmh) < 0.05 &&
          prev.elevationM === next.elevationM &&
          prev.isFiring === next.isFiring &&
          prev.isCrouched === next.isCrouched &&
          prev.inWater === next.inWater &&
          prev.onBridge === next.onBridge
        ) {
          return prev;
        }
        return { ...next };
      });
      setCombatHud((prev) => {
        if (
          prev.playerHp === nextCombat.playerHp &&
          Math.abs(prev.weaponHeat - nextCombat.weaponHeat) < 0.015 &&
          prev.weaponOverheated === nextCombat.weaponOverheated &&
          Math.abs(prev.laserEnergy - nextCombat.laserEnergy) < 0.015 &&
          prev.laserOverheated === nextCombat.laserOverheated &&
          prev.laserActive === nextCombat.laserActive &&
          Math.abs(prev.heavyCooldown - nextCombat.heavyCooldown) < 0.08 &&
          Math.abs(prev.missileCooldown - nextCombat.missileCooldown) < 0.08 &&
          prev.repairCharges === nextCombat.repairCharges &&
          Math.abs(prev.repairCooldown - nextCombat.repairCooldown) < 0.2 &&
          Math.abs(prev.dashCooldown - nextCombat.dashCooldown) < 0.08 &&
          prev.dashActive === nextCombat.dashActive &&
          prev.combatPhase === nextCombat.combatPhase &&
          prev.alertMessage === nextCombat.alertMessage &&
          prev.targetsDestroyed === nextCombat.targetsDestroyed &&
          prev.targetsTotal === nextCombat.targetsTotal &&
          prev.score === nextCombat.score &&
          prev.bestScore === nextCombat.bestScore &&
          prev.missionRank === nextCombat.missionRank &&
          prev.bestRank === nextCombat.bestRank &&
          prev.pickupBlips.length === nextCombat.pickupBlips.length &&
          prev.barrelBlips.length === nextCombat.barrelBlips.length &&
          prev.threatAngles.length === nextCombat.threatAngles.length &&
          nextCombat.threatAngles.every(
            (a, idx) => Math.abs(a - (prev.threatAngles[idx] ?? 99)) < 0.08,
          ) &&
          prev.shotsFired === nextCombat.shotsFired &&
          prev.shotsHit === nextCombat.shotsHit &&
          prev.hitMarkerActive === nextCombat.hitMarkerActive &&
          Math.abs(prev.playerHitFlash - nextCombat.playerHitFlash) < 0.02 &&
          prev.lockedTarget?.id === nextCombat.lockedTarget?.id &&
          prev.lockedTarget?.hp === nextCombat.lockedTarget?.hp &&
          prev.lockedTarget?.distanceM === nextCombat.lockedTarget?.distanceM &&
          Math.floor(prev.elapsedSec) === Math.floor(nextCombat.elapsedSec) &&
          prev.missionStatus === nextCombat.missionStatus
        ) {
          return prev;
        }
        return { ...nextCombat };
      });
      setGhostHp((prevGhost) => {
        if (prevGhost <= nextCombat.playerHp) return nextCombat.playerHp;
        return Math.max(nextCombat.playerHp, prevGhost - 3.5);
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [driveMode, paused, mechPoseRef, driveInputRef, combatTelemetryRef]);

  const setHoldInput = (
    patch: Partial<
      Pick<MechDriveInput, 'forward' | 'turn' | 'turretTurn' | 'fire' | 'sprint' | 'pointerLaserFire'>
    >,
  ) => {
    Object.assign(driveInputRef.current, patch);
  };

  const minimapMech = worldToMinimap(mechHud.x, mechHud.z);
  const headingDeg = Math.round((((mechHud.yaw * 180) / Math.PI) % 360 + 360) % 360);
  const turretWorldYaw = mechHud.yaw + mechHud.turretYaw;
  const headingSvgDeg = (Math.atan2(Math.sin(mechHud.yaw), -Math.cos(mechHud.yaw)) * 180) / Math.PI;
  const turretSvgDeg =
    (Math.atan2(Math.sin(turretWorldYaw), -Math.cos(turretWorldYaw)) * 180) / Math.PI;
  const surfaceTag = mechHud.onBridge
    ? 'МОСТ / ЭСТАКАДА'
    : mechHud.inWater
      ? 'БРОД'
      : 'ГРУНТ';

  const hpPct = Math.max(0, Math.min(100, (combatHud.playerHp / combatHud.playerMaxHp) * 100));
  const ghostHpPct = Math.max(hpPct, Math.min(100, (ghostHp / combatHud.playerMaxHp) * 100));
  const heatPct = Math.round(combatHud.weaponHeat * 100);
  const laserPct = Math.round(combatHud.laserEnergy * 100);
  const criticalHp = driveMode && combatHud.playerHp > 0 && hpPct <= 30;
  const vignetteOpacity = driveMode
    ? Math.max(
        combatHud.playerHitFlash > 0 ? Math.min(0.55, combatHud.playerHitFlash * 1.9) : 0,
        criticalHp ? 0.24 : 0,
      )
    : 0;

  const isTouch = layoutMode.useTouchControls;
  const showInputSwitcher =
    isTouch || layoutMode.isTouchDevice || inputPref !== 'auto';

  const handleToggleCrouch = () => {
    driveInputRef.current.crouch = !driveInputRef.current.crouch;
    setCrouchUi(driveInputRef.current.crouch);
  };

  const renderMinimapSvg = () => (
    <svg
      viewBox="0 0 240 132"
      className="w-full h-auto rounded border border-slate-700/60 bg-[#081017]"
      role="img"
      aria-label="Схема карты Сектор 7"
    >
      <polygon
        points="18,18 222,18 222,114 18,114"
        fill="#152129"
        stroke="#3d5c70"
        strokeWidth="1.2"
      />
      <path
        d="M 60 18 Q 76 48 92 48 Q 124 44 142 62 Q 158 88 182 114"
        fill="none"
        stroke="#366b85"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 68 34 Q 78 68 96 82 Q 126 88 156 80"
        fill="none"
        stroke="#366b85"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <ellipse
        cx="118"
        cy="66"
        rx="24"
        ry="16"
        fill="#27363b"
        stroke="#587b8f"
        strokeWidth="1"
      />
      <line x1="68" y1="45" x2="88" y2="38" stroke="#c89e52" strokeWidth="2.5" />
      <line x1="78" y1="74" x2="100" y2="70" stroke="#c89e52" strokeWidth="2.5" />
      {/* Collapsed East Crossing abutment stubs + flooded channel ruin markers */}
      <line x1="135" y1="87.5" x2="140.5" y2="85.5" stroke="#c89e52" strokeWidth="2.4" />
      <line x1="155" y1="80" x2="161" y2="78" stroke="#c89e52" strokeWidth="2.4" />
      <rect x="142.5" y="81.5" width="3.2" height="3.2" rx="0.5" fill="#708999" opacity="0.9" />
      <rect x="148.5" y="79" width="3.5" height="2.6" rx="0.5" fill="#708999" opacity="0.9" />
      <rect x="146.5" y="73" width="2.8" height="2.8" rx="0.5" fill="#708999" opacity="0.85" />
      <rect x="151.5" y="84" width="3.2" height="4.0" rx="0.5" fill="#708999" opacity="0.85" />

      {MINIMAP_NODES.map((node) => {
        const isSel = !driveMode && activeSector === node.id;
        return (
          <g
            key={node.id}
            onClick={() => onSelectSector(node.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Перейти к сектору ${SECTORS[node.id].name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSector(node.id);
              }
            }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={isSel ? 12 : 9.5}
              fill={isSel ? '#b98229' : '#182834'}
              stroke={isSel ? '#ffe2a6' : '#7aa0b8'}
              strokeWidth={isSel ? 1.8 : 1.1}
            />
            <text
              x={node.x}
              y={node.y + 3.2}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="7.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Field Supply Crate Blips */}
      {combatHud.pickupBlips.map((pk) => {
        const p = worldToMinimap(pk.x, pk.z);
        return (
          <polygon
            key={pk.id}
            points={`${p.mx},${p.my - 3.2} ${p.mx + 3.2},${p.my} ${p.mx},${p.my + 3.2} ${p.mx - 3.2},${p.my}`}
            fill="#34d399"
            stroke="#064e3b"
            strokeWidth="0.7"
          />
        );
      })}

      {/* Destructible Explosive Canister Blips */}
      {combatHud.barrelBlips.map((b) => {
        const p = worldToMinimap(b.x, b.z);
        return (
          <polygon
            key={b.id}
            points={`${p.mx},${p.my - 3.3} ${p.mx + 2.9},${p.my + 2.3} ${p.mx - 2.9},${p.my + 2.3}`}
            fill="#f97316"
            stroke="#fef3c7"
            strokeWidth="0.7"
          />
        );
      })}

      {/* Enemy Tactical Blips */}
      {combatHud.enemyBlips.map((blip) => {
        const p = worldToMinimap(blip.x, blip.z);
        return blip.alive ? (
          <circle
            key={blip.id}
            cx={p.mx}
            cy={p.my}
            r={blip.archetype === 'denial-turret' ? 3.2 : 2.8}
            fill="#ef4444"
            stroke="#fee2e2"
            strokeWidth="0.7"
          />
        ) : (
          <path
            key={blip.id}
            d={`M${p.mx - 2},${p.my - 2} L${p.mx + 2},${p.my + 2} M${p.mx + 2},${p.my - 2} L${p.mx - 2},${p.my + 2}`}
            stroke="#64748b"
            strokeWidth="1"
          />
        );
      })}

      {/* Live Mech position, hull heading chevron & turret view cone */}
      <g transform={`translate(${minimapMech.mx.toFixed(1)}, ${minimapMech.my.toFixed(1)})`}>
        <g transform={`rotate(${turretSvgDeg.toFixed(1)})`}>
          <polygon points="0,0 -11,-22 11,-22" fill="#fde68a" fillOpacity="0.18" />
        </g>
        <g transform={`rotate(${headingSvgDeg.toFixed(1)})`}>
          <circle r="5.5" fill="#10b981" fillOpacity="0.22" stroke="#34d399" strokeWidth="0.9" />
          <polygon
            points="0,-5.2 4.0,3.8 0,1.8 -4.0,3.8"
            fill="#fef08a"
            stroke="#0b131b"
            strokeWidth="0.8"
          />
        </g>
      </g>
    </svg>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 pt-[max(10px,env(safe-area-inset-top))]">
      {/* Subtle peripheral damage / low-armor vignette */}
      {vignetteOpacity > 0.01 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            boxShadow: `inset 0 0 88px rgba(220, 38, 38, ${vignetteOpacity.toFixed(2)})`,
          }}
        />
      )}

      {/* Fixed player view crosshair + separate damped physical muzzle-direction cue. */}
      {driveMode && !hudHidden && !paused && missionOutcome === null && (
        <div
          aria-hidden="true"
          data-testid="combat-reticle"
          className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative flex h-11 w-11 items-center justify-center">
            {combatHud.threatAngles.length > 0 && (
              <svg
                width="96"
                height="96"
                viewBox="0 0 96 96"
                data-testid="threat-radar"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  fill="none"
                  stroke="#ef4444"
                  strokeOpacity="0.24"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
                {combatHud.threatAngles.map((ang, idx) => (
                  <g
                    key={idx}
                    transform={`rotate(${((ang * 180) / Math.PI).toFixed(1)} 48 48)`}
                  >
                    <polygon
                      points="48,4 43,13 53,13"
                      fill="#ef4444"
                      stroke="#fef08a"
                      strokeWidth="0.9"
                    />
                  </g>
                ))}
              </svg>
            )}
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              className="opacity-90"
            >
              {/* Outer brackets */}
              <path
                d="M12 16 L12 12 L16 12 M28 12 L32 12 L32 16 M32 28 L32 32 L28 32 M16 32 L12 32 L12 28"
                fill="none"
                data-testid="reticle-brackets"
                stroke="#fbbf24"
                strokeWidth="1.6"
                strokeLinecap="square"
              />
              <circle
                cx="22"
                cy="22"
                r="2"
                fill={combatHud.weaponOverheated ? '#ef4444' : '#fde68a'}
              />
              {/* Hit marker X flash */}
              {combatHud.hitMarkerActive && (
                <path
                  d="M15 15 L19 19 M29 15 L25 19 M15 29 L19 25 M29 29 L25 25"
                  stroke="#f87171"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div ref={sightLabelRef} className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-amber-200/80">
              НАВЕДЕНИЕ
            </div>
            {combatHud.lockedTarget &&
             aimRef.current.reticleHit === 'enemy' &&
             aimRef.current.reticleTargetId === combatHud.lockedTarget.id && (
              <div className="absolute left-1/2 top-full mt-5 -translate-x-1/2 whitespace-nowrap rounded border border-amber-400/50 bg-[#0b131b]/92 px-2 py-0.5 text-center shadow">
              <div className="flex items-center gap-2 font-mono-tabular text-[10px] font-semibold text-amber-200">
                <span>{combatHud.lockedTarget.name}</span>
                <span className="text-slate-400">{combatHud.lockedTarget.distanceM} м</span>
              </div>
              <div className="mt-0.5 h-1 w-28 overflow-hidden rounded-sm bg-slate-800">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{
                    width: `${Math.round(
                      (combatHud.lockedTarget.hp / combatHud.lockedTarget.maxHp) * 100,
                    )}%`,
                  }}
                />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {driveMode && !hudHidden && !paused && missionOutcome === null && (
        <div
          ref={muzzleIndicatorRef}
          aria-hidden="true"
          data-testid="muzzle-direction-indicator"
          className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ opacity: 0 }}
        >
          <svg width="30" height="30" viewBox="0 0 30 30">
            <g data-testid="muzzle-indicator-ring" fill="none" stroke="#67cfe6"
              strokeWidth="1.5" strokeLinecap="round" opacity="0.9">
              <circle cx="15" cy="15" r="8.5" strokeDasharray="5 3" />
              <path d="M15 2V5 M15 25V28 M2 15H5 M25 15H28" />
            </g>
            <circle cx="15" cy="15" r="1.5" fill="#67cfe6" />
          </svg>
        </div>
      )}

      {/* TOP BAR & COMPASS TICKS */}
      {hudHidden ? (
        <div aria-hidden="true" />
      ) : (
        <div className="relative z-10 flex items-start justify-between gap-2 sm:gap-4">
          {/* Top-Left Card: Compact Mobile vs Full Desktop */}
          {driveMode ? (
            isTouch ? (
              <section
                aria-label="Телеметрия меха"
                className="pointer-events-auto w-[188px] sm:w-[232px] rounded border border-amber-400/45 bg-[#0b131b]/90 p-2 shadow-lg"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        criticalHp ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                    />
                    <h1 className="font-display text-xs sm:text-sm font-bold tracking-wide text-amber-100 leading-tight truncate">
                      Борт № 316
                    </h1>
                  </div>
                  <span
                    data-testid="combat-phase"
                    className={`rounded px-1.5 py-0.5 font-mono-tabular text-[9px] font-semibold border shrink-0 ${
                      combatHud.combatPhase === 3
                        ? 'bg-red-500/20 text-red-200 border-red-400/45'
                        : combatHud.combatPhase === 2
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                          : 'bg-sky-500/15 text-sky-200 border-sky-400/35'
                    }`}
                  >
                    Ф {combatHud.combatPhase === 3 ? 'III' : combatHud.combatPhase === 2 ? 'II' : 'I'}
                  </span>
                </div>

                {/* Armor HP Bar */}
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                    <span className="text-slate-400">Броня</span>
                    <span
                      data-testid="player-hp"
                      className={`font-bold ${criticalHp ? 'text-red-400' : 'text-emerald-300'}`}
                    >
                      {Math.round(combatHud.playerHp)} / {combatHud.playerMaxHp}
                    </span>
                  </div>
                  <div className="relative mt-0.5 h-1.5 w-full overflow-hidden rounded-sm border border-slate-700/80 bg-slate-900">
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-300/65 transition-all duration-200"
                      style={{ width: `${ghostHpPct}%` }}
                    />
                    <div
                      className={`relative h-full transition-all duration-100 ${
                        criticalHp ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                </div>

                {/* 37-mm Heat Bar */}
                <div className="mt-1">
                  <div className="flex items-center justify-between gap-1 text-[9px] font-mono-tabular">
                    <span className="text-slate-400">37-мм</span>
                    {(mechHud.inWater || combatHud.inWaterCooling) && (
                      <span
                        data-testid="water-cooling-status"
                        className="font-semibold text-[#06B6D4]"
                      >
                        ОХЛАЖДЕНИЕ · 2×
                      </span>
                    )}
                    <span
                      className={`font-semibold ${
                        combatHud.weaponOverheated ? 'text-red-400' : 'text-amber-200'
                      }`}
                    >
                      {combatHud.weaponOverheated ? 'ПЕРЕГРЕВ' : `${heatPct}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-sm bg-slate-900">
                    <div
                      className={`h-full transition-all duration-75 ${
                        combatHud.weaponOverheated
                          ? 'bg-red-500'
                          : heatPct > 70
                            ? 'bg-orange-400'
                            : 'bg-amber-400'
                      }`}
                      style={{ width: `${heatPct}%` }}
                    />
                  </div>
                </div>

                {/* Cutting Laser Capacitor Bar */}
                <div className="mt-1">
                  <div className="flex items-center justify-between gap-1 text-[9px] font-mono-tabular">
                    <span className="text-slate-400">Луч-7</span>
                    <span
                      data-testid="laser-energy-status"
                      className={`font-semibold ${
                        combatHud.laserOverheated
                          ? 'text-red-400'
                          : combatHud.laserActive
                            ? 'text-cyan-200'
                            : 'text-cyan-300'
                      }`}
                    >
                      {combatHud.laserOverheated ? 'РАЗРЯД' : `${laserPct}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-sm bg-slate-900">
                    <div
                      className={`h-full transition-all duration-75 ${
                        combatHud.laserOverheated
                          ? 'bg-red-500'
                          : combatHud.laserActive
                            ? 'bg-cyan-300'
                            : 'bg-cyan-500'
                      }`}
                      style={{ width: `${laserPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-1.5 flex items-center justify-between border-t border-slate-700/60 pt-1 text-[10px] font-mono-tabular">
                  <span data-testid="targets-counter" className="font-bold text-amber-200">
                    Цели {combatHud.targetsDestroyed}/{combatHud.targetsTotal}
                  </span>
                  <span data-testid="combat-score" className="font-bold text-slate-100">
                    {combatHud.score}
                  </span>
                </div>
              </section>
            ) : (
              <section
                aria-label="Телеметрия меха"
                className="pointer-events-auto w-[292px] rounded border border-amber-400/45 bg-[#0b131b]/92 p-3 shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        criticalHp ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                    />
                    <h1 className="font-display text-base font-bold tracking-wide text-amber-100 leading-tight">
                      Борт № 316
                    </h1>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      data-testid="combat-phase"
                      className={`rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold border ${
                        combatHud.combatPhase === 3
                          ? 'bg-red-500/20 text-red-200 border-red-400/45'
                          : combatHud.combatPhase === 2
                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/45'
                            : 'bg-sky-500/15 text-sky-200 border-sky-400/35'
                      }`}
                    >
                      ФАЗА {combatHud.combatPhase === 3 ? 'III' : combatHud.combatPhase === 2 ? 'II' : 'I'}
                    </span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-amber-200 border border-amber-400/35">
                      {surfaceTag}
                    </span>
                  </div>
                </div>

                {/* Armor HP Bar with Trailing Ghost Drain */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                    <span className="uppercase tracking-wider text-slate-400">Броня корпуса</span>
                    <span
                      data-testid="player-hp"
                      className={`font-bold ${criticalHp ? 'text-red-400' : 'text-emerald-300'}`}
                    >
                      {Math.round(combatHud.playerHp)} / {combatHud.playerMaxHp}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 w-full overflow-hidden rounded-sm border border-slate-700/80 bg-slate-900">
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-300/65 transition-all duration-200"
                      style={{ width: `${ghostHpPct}%` }}
                    />
                    <div
                      className={`relative h-full transition-all duration-100 ${
                        criticalHp ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                </div>

                {/* 37-mm Autocannon Thermal Bar */}
                <div className="mt-1.5">
                  <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono-tabular">
                    <span className="uppercase tracking-wider text-slate-400">
                      Нагрев 37-мм
                    </span>
                    <div className="flex items-center gap-2">
                      {(mechHud.inWater || combatHud.inWaterCooling) && (
                        <span
                          data-testid="water-cooling-status"
                          className="font-semibold text-[#06B6D4]"
                        >
                          ОХЛАЖДЕНИЕ · 2×
                        </span>
                      )}
                      <span
                        className={`font-semibold ${
                          combatHud.weaponOverheated ? 'text-red-400' : 'text-amber-200'
                        }`}
                      >
                        {combatHud.weaponOverheated ? 'ПЕРЕГРЕВ' : `${heatPct}%`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-900">
                    <div
                      className={`h-full transition-all duration-75 ${
                        combatHud.weaponOverheated
                          ? 'bg-red-500'
                          : heatPct > 70
                            ? 'bg-orange-400'
                            : 'bg-amber-400'
                      }`}
                      style={{ width: `${heatPct}%` }}
                    />
                  </div>
                </div>

                {/* Cutting Laser "Луч-7" Capacitor Bar */}
                <div className="mt-1.5">
                  <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono-tabular">
                    <span className="uppercase tracking-wider text-slate-400">
                      Резак «Луч-7»
                    </span>
                    <span
                      data-testid="laser-energy-status"
                      className={`font-semibold ${
                        combatHud.laserOverheated
                          ? 'text-red-400'
                          : combatHud.laserActive
                            ? 'text-cyan-200'
                            : 'text-cyan-300'
                      }`}
                    >
                      {combatHud.laserOverheated
                        ? `РАЗРЯД · ${laserPct}%`
                        : combatHud.laserActive
                          ? `ЛУЧ · ${laserPct}%`
                          : `${laserPct}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-900">
                    <div
                      className={`h-full transition-all duration-75 ${
                        combatHud.laserOverheated
                          ? 'bg-red-500'
                          : combatHud.laserActive
                            ? 'bg-cyan-300'
                            : 'bg-cyan-500'
                      }`}
                      style={{ width: `${laserPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-2 text-[11px] font-mono-tabular">
                  <div>
                    <div className="text-[10px] text-slate-400">Скорость</div>
                    <div className="font-bold text-slate-100">
                      {mechHud.speedKmh.toFixed(1)} км/ч
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Цели</div>
                    <div data-testid="targets-counter" className="font-bold text-amber-200">
                      {combatHud.targetsDestroyed} / {combatHud.targetsTotal}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Счёт</div>
                    <div data-testid="combat-score" className="font-bold text-slate-100">
                      {combatHud.score}
                    </div>
                  </div>
                </div>
              </section>
            )
          ) : isTouch ? (
            <section
              aria-label="Сводка карты"
              className="pointer-events-auto max-w-[216px] rounded border border-[#5f86a1]/30 bg-[#0b131b]/90 px-2.5 py-2 shadow-lg"
            >
              <h1 className="font-display text-sm font-bold tracking-wide text-slate-100 leading-tight">
                Сектор 7 · Ущелье
              </h1>
              <div className="mt-0.5 text-[11px] font-medium text-amber-200 truncate">
                {sector.name}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 font-mono-tabular">
                <span>{sector.coordinates}</span>
                <span>+{sector.elevationM} м</span>
              </div>
            </section>
          ) : (
            <section
              aria-label="Сводка карты"
              className="pointer-events-auto w-[264px] rounded border border-[#5f86a1]/30 bg-[#0b131b]/90 p-3 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-lg font-bold tracking-wide text-slate-100 leading-tight">
                    Сектор 7 · Железное Ущелье
                  </h1>
                  <p className="mt-1 text-xs text-slate-400">
                    1500 × 1245 м · Мехи 8–14 м
                  </p>
                </div>
                <svg
                  width="44"
                  height="30"
                  viewBox="0 0 44 30"
                  aria-hidden="true"
                  className="shrink-0 opacity-80"
                >
                  <rect
                    x="1"
                    y="1"
                    width="42"
                    height="28"
                    rx="2"
                    fill="#0e1a24"
                    stroke="#4d748f"
                    strokeWidth="1"
                  />
                  <path
                    d="M6 22 Q16 14 22 16 T38 8"
                    fill="none"
                    stroke="#8dbad8"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M14 5 L20 15 L29 25"
                    fill="none"
                    stroke="#5da3c9"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                </svg>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-slate-700/60 pt-2 text-[11px] text-slate-300 font-mono-tabular">
                <span>{sector.coordinates}</span>
                <span>Отм. +{sector.elevationM} м</span>
              </div>
            </section>
          )}

          {/* Top-Center Compass & Bearing Scale (Desktop) + Tactical Alert Toast */}
          <div
            aria-hidden={!combatHud.alertMessage}
            className="flex flex-col items-center gap-1 pt-0.5 text-slate-400"
          >
            {!isTouch && (
              <div className="hidden md:flex flex-col items-center gap-1 rounded border border-slate-700/55 bg-[#0b131b]/75 px-3 py-1 shadow">
                <div className="flex items-center gap-3 text-[11px] font-mono-tabular tracking-wider text-slate-200">
                  <span>270° W</span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <Compass className="h-3.5 w-3.5" />
                    {driveMode ? `${headingDeg.toString().padStart(3, '0')}° HDG` : '315° NW'}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span>000° N</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-70">
                  {Array.from({ length: 19 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`block w-px bg-slate-300 ${
                        idx % 3 === 0 ? 'h-2' : 'h-1 opacity-60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            {driveMode && combatHud.alertMessage && (
              <div
                role="status"
                data-testid="tactical-alert"
                className="mt-1 rounded border border-amber-400/60 bg-[#0b131b]/95 px-2.5 sm:px-3 py-1 font-mono-tabular text-[10px] sm:text-[11px] font-bold tracking-wide text-amber-200 shadow-lg text-center max-w-[200px] sm:max-w-none"
              >
                {combatHud.alertMessage}
              </div>
            )}
          </div>

          {/* Top-Right Quick Actions & Mobile Mini-Radar */}
          <div className="pointer-events-auto flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {driveMode ? (
                isTouch ? (
                  <>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onToggleMute();
                      }}
                      aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 active:bg-amber-500/25 cursor-pointer"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onTogglePause();
                      }}
                      aria-label={paused ? 'Продолжить' : 'Пауза'}
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 active:bg-amber-500/25 cursor-pointer"
                    >
                      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onRestartMission();
                      }}
                      aria-label="Перезапустить бой"
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 active:bg-amber-500/25 cursor-pointer"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    {layoutMode.isLandscapeMobile && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          setMobileMapOpen((v) => !v);
                        }}
                        aria-pressed={mobileMapOpen}
                        aria-label="Переключить мини-радар"
                        className={`flex h-9 w-9 items-center justify-center rounded border cursor-pointer ${
                          mobileMapOpen
                            ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                            : 'border-slate-600/70 bg-[#0b131b]/92 text-slate-200'
                        }`}
                      >
                        <MapIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      data-testid="input-mode-btn"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onCycleInputPref();
                      }}
                      aria-label="Переключить режим управления ПК/Сенсор"
                      className="flex h-9 w-9 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 active:bg-amber-500/25 cursor-pointer"
                    >
                      <Keyboard className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onToggleDriveMode();
                      }}
                      className="flex h-9 items-center gap-1 rounded border border-amber-400/55 bg-[#0b131b]/92 px-2.5 text-xs font-semibold text-amber-200 active:bg-amber-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                      aria-label="Выйти из режима поездки в обзор"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Обзор</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onToggleMute();
                      }}
                      aria-label={muted ? 'Включить звук (U)' : 'Выключить звук (U)'}
                      className="flex h-8 w-8 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onTogglePause();
                      }}
                      aria-label={paused ? 'Продолжить (P)' : 'Пауза (P)'}
                      className="flex h-8 w-8 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                    >
                      {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onRestartMission();
                      }}
                      aria-label="Перезапустить бой (R)"
                      className="flex h-8 w-8 items-center justify-center rounded border border-slate-600/70 bg-[#0b131b]/92 text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    {showInputSwitcher && (
                      <button
                        type="button"
                        tabIndex={-1}
                        data-testid="input-mode-btn"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onCycleInputPref();
                        }}
                        aria-label="Переключить на сенсорное управление"
                        className="flex h-8 items-center gap-1 rounded border border-slate-600/70 bg-[#0b131b]/92 px-2 text-[11px] font-medium text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                      >
                        <Gamepad2 className="h-3.5 w-3.5" />
                        <span>Сенсор</span>
                      </button>
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onToggleDriveMode();
                      }}
                      className="flex items-center gap-1.5 rounded border border-amber-400/55 bg-[#0b131b]/92 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                      aria-label="Выйти из режима поездки в обзор"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Выйти в обзор (Esc)</span>
                    </button>
                  </>
                )
              ) : isTouch ? (
                <>
                  <button
                    type="button"
                    data-testid="input-mode-btn"
                    onClick={onCycleInputPref}
                    aria-label="Переключить на управление ПК"
                    className="flex h-9 items-center gap-1 rounded border border-[#5f86a1]/35 bg-[#0b131b]/90 px-2.5 text-[11px] font-medium text-slate-200 cursor-pointer"
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    <span>ПК</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResetOverview}
                    className="flex h-9 items-center gap-1 rounded border border-[#5f86a1]/35 bg-[#0b131b]/90 px-2.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                    aria-label="Сбросить камеру к общему виду"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Вид</span>
                  </button>
                </>
              ) : (
                <>
                  {showInputSwitcher && (
                    <button
                      type="button"
                      data-testid="input-mode-btn"
                      onClick={onCycleInputPref}
                      aria-label="Переключить на сенсорный интерфейс"
                      className="flex items-center gap-1.5 rounded border border-[#5f86a1]/35 bg-[#0b131b]/90 px-2.5 py-2 text-xs font-medium text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                    >
                      <Gamepad2 className="h-3.5 w-3.5" />
                      <span>Сенсор</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onResetOverview}
                    className="flex items-center gap-1.5 rounded border border-[#5f86a1]/35 bg-[#0b131b]/90 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-amber-400/60 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                    aria-label="Сбросить камеру к общему виду"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Общий вид</span>
                  </button>
                </>
              )}
            </div>

            {/* Compact Mobile Mini-Radar (Drive Mode only; toggled in landscape) */}
            {driveMode && isTouch && (!layoutMode.isLandscapeMobile || mobileMapOpen) && (
              <section
                aria-label="Компактный радар"
                data-testid="mobile-minimap"
                className="w-[122px] sm:w-[144px] rounded border border-[#5f86a1]/35 bg-[#0b131b]/88 p-1.5 shadow-lg"
              >
                <div className="mb-1 flex items-center justify-between font-mono-tabular text-[9px] text-slate-300">
                  <span>РАДАР</span>
                  <span className="text-amber-300">
                    {combatHud.targetsTotal - combatHud.targetsDestroyed} ц.
                  </span>
                </div>
                {renderMinimapSvg()}
              </section>
            )}
          </div>
        </div>
      )}

      {/* PAUSED / VICTORY / GAME OVER MODAL CARD */}
      {driveMode && (paused || missionOutcome !== null) && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              missionOutcome === 'victory'
                ? 'Победа в Секторе 7'
                : missionOutcome === 'defeat'
                  ? 'Поражение'
                  : 'Пауза'
            }
            className="pointer-events-auto w-[92vw] max-w-[440px] rounded border border-amber-400/55 bg-[#0b131b]/95 p-4 sm:p-5 text-center shadow-2xl"
          >
            <div className="font-mono-tabular text-[11px] uppercase tracking-widest text-amber-300">
              {missionOutcome === 'victory'
                ? 'Задание выполнено'
                : missionOutcome === 'defeat'
                  ? 'Потеря боевой машины'
                  : 'Симуляция приостановлена'}
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-100">
              {missionOutcome === 'victory'
                ? 'Сектор 7 зачищен'
                : missionOutcome === 'defeat'
                  ? 'Борт № 316 уничтожен'
                  : 'Пауза'}
            </h2>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 rounded border border-slate-700/70 bg-[#081017] p-3 font-mono-tabular">
              <div>
                <div className="text-[10px] text-slate-400">Цели</div>
                <div className="mt-0.5 text-sm font-bold text-amber-200">
                  {combatHud.targetsDestroyed} / {combatHud.targetsTotal}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Точность</div>
                <div className="mt-0.5 text-sm font-bold text-slate-100">
                  {combatHud.accuracyPct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">
                  {missionOutcome === 'victory' ? 'Время' : 'Счёт'}
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-100">
                  {missionOutcome === 'victory'
                    ? formatClock(combatHud.elapsedSec)
                    : combatHud.score}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Рекорд</div>
                <div data-testid="best-score" className="mt-0.5 text-sm font-bold text-emerald-300">
                  {combatHud.bestScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Ранг</div>
                <div
                  data-testid="mission-rank"
                  className={`mt-0.5 text-sm font-bold ${
                    combatHud.missionRank === 'S'
                      ? 'text-amber-300'
                      : combatHud.missionRank === 'A'
                        ? 'text-emerald-300'
                        : combatHud.missionRank === 'B'
                          ? 'text-sky-300'
                          : 'text-slate-300'
                  }`}
                >
                  {combatHud.missionRank}
                  {combatHud.bestRank ? (
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      ({combatHud.bestRank})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {paused && missionOutcome === null ? (
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="min-h-[44px] w-full rounded border border-emerald-400/60 bg-emerald-500/25 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/35 cursor-pointer"
                >
                  {isTouch ? 'Продолжить' : 'Продолжить (P)'}
                </button>
              ) : null}
              <button
                type="button"
                data-start="true"
                onClick={onRestartMission}
                className="min-h-[44px] w-full rounded border border-amber-400/70 bg-amber-500/25 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/35 cursor-pointer"
              >
                {missionOutcome === 'defeat'
                  ? isTouch
                    ? 'Повторить штурм'
                    : 'Повторить штурм (R)'
                  : isTouch
                    ? 'В бой снова'
                    : 'В бой снова (R)'}
              </button>
              <button
                type="button"
                onClick={onResetOverview}
                className="min-h-[44px] w-full rounded border border-slate-600/80 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-400 cursor-pointer"
              >
                {isTouch ? 'Вернуться к обзору карты' : 'Вернуться к обзору карты (Esc)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Mobile Touch Controls / Mobile Overview vs Desktop Inspector + Dock + Minimap */}
      {isTouch ? (
        driveMode ? (
          !hudHidden && !paused && missionOutcome === null ? (
            <MobileControls
              driveInputRef={driveInputRef}
              combatHud={combatHud}
              isFiring={mechHud.isFiring}
              crouchUi={crouchUi}
              isLandscapeMobile={layoutMode.isLandscapeMobile}
              onToggleCrouch={handleToggleCrouch}
            />
          ) : (
            <div aria-hidden="true" />
          )
        ) : (
          <div
            data-testid="mobile-overview-dock"
            className="pointer-events-auto relative z-10 flex flex-col gap-2 pb-[max(4px,env(safe-area-inset-bottom))]"
          >
            {mobileLayersOpen && (
              <div className="flex flex-col gap-2 rounded border border-[#5f86a1]/40 bg-[#0b131b]/95 p-2.5 shadow-2xl">
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Слои карты">
                  <button
                    type="button"
                    onClick={onToggleMarkers}
                    aria-pressed={showMarkers}
                    className={`flex min-h-[38px] items-center justify-center gap-1 rounded px-2 text-[11px] font-medium ${
                      showMarkers
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                        : 'border border-slate-700 text-slate-400'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Метки</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleUnits}
                    aria-pressed={showUnits}
                    className={`flex min-h-[38px] items-center justify-center gap-1 rounded px-2 text-[11px] font-medium ${
                      showUnits
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                        : 'border border-slate-700 text-slate-400'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Техника</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleMist}
                    aria-pressed={showMist}
                    className={`flex min-h-[38px] items-center justify-center gap-1 rounded px-2 text-[11px] font-medium ${
                      showMist
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                        : 'border border-slate-700 text-slate-400'
                    }`}
                  >
                    <Wind className="h-3.5 w-3.5" />
                    <span>Дым</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleGrid}
                    aria-pressed={showWireframeGrid}
                    className={`flex min-h-[38px] items-center justify-center gap-1 rounded px-2 text-[11px] font-medium ${
                      showWireframeGrid
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                        : 'border border-slate-700 text-slate-400'
                    }`}
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    <span>Рельеф</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Освещение">
                  {(
                    [
                      { id: 'day', label: 'День', Icon: Sun },
                      { id: 'dusk', label: 'Закат', Icon: Sunset },
                      { id: 'night', label: 'Ночь', Icon: Moon },
                    ] as const
                  ).map(({ id, label, Icon }) => {
                    const active = lightingPreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onChangeLighting(id)}
                        aria-pressed={active}
                        className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded px-2 text-xs font-medium ${
                          active
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                            : 'border border-slate-700 text-slate-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <nav
              aria-label="Секторы и запуск боя"
              className="flex flex-col gap-2 rounded border border-[#5f86a1]/35 bg-[#0b131b]/92 p-2 shadow-xl"
            >
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {SECTOR_ORDER.map((id) => {
                  const isActive = activeSector === id;
                  const shortName: Record<SectorId, string> = {
                    overview: 'Обзор',
                    airfield: 'Вертодром',
                    crossing: 'Мост A·B',
                    refinery: 'Завод',
                    citadel: 'Цитадель',
                    quarry: 'Карьер',
                  };
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectSector(id)}
                      aria-pressed={isActive}
                      className={`min-h-[38px] rounded px-3 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/55'
                          : 'border border-slate-700/70 bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      {shortName[id]}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="mobile-layers-toggle"
                  aria-expanded={mobileLayersOpen}
                  onClick={() => setMobileLayersOpen((v) => !v)}
                  className={`flex min-h-[44px] items-center gap-1.5 rounded border px-3 text-xs font-medium shrink-0 cursor-pointer ${
                    mobileLayersOpen
                      ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                      : 'border-slate-600/80 bg-slate-900/80 text-slate-200'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Слои</span>
                </button>
                <button
                  type="button"
                  data-start="true"
                  onClick={onToggleDriveMode}
                  aria-pressed={driveMode}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded border border-emerald-400/60 bg-emerald-500/25 px-4 text-sm font-bold text-emerald-100 active:bg-emerald-500/40 cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  <span>В бой · Режим меха</span>
                </button>
              </div>
            </nav>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {!hudHidden && (
            <div
              className={`hidden md:flex items-end gap-4 ${
                driveMode ? 'justify-end' : 'justify-between'
              }`}
            >
            {/* Bottom-Left Active Sector Inspector */}
            {!driveMode && (
              <aside
                aria-label="Инспектор сектора"
                className="pointer-events-auto w-[276px] rounded border border-[#5f86a1]/30 bg-[#0b131b]/90 p-3 shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-amber-300/90">
                    {sector.role}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {sector.code} · {sector.elevationM} м
                  </span>
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-slate-100 leading-snug">
                  {sector.name}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  {sector.description}
                </p>
                <div className="mt-2 border-t border-slate-700/60 pt-1.5">
                  <div className="text-[10px] text-slate-400">Объекты сектора</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-200">
                    {sector.assets.map((asset, i) => (
                      <span key={asset} className="whitespace-nowrap">
                        {i > 0 && <span className="mr-2 text-slate-600">·</span>}
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            {/* Bottom-Right Interactive 2D Minimap */}
            <section
              aria-label="Тактическая мини-карта"
              className="pointer-events-auto w-[240px] rounded border border-[#5f86a1]/30 bg-[#0b131b]/90 p-2.5 shadow-lg"
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <span className="font-medium whitespace-nowrap">Мини-карта</span>
                <span className="font-mono-tabular text-slate-400 whitespace-nowrap">
                  {driveMode
                    ? `Цели: ${combatHud.targetsTotal - combatHud.targetsDestroyed}`
                    : 'Клик — переход'}
                </span>
              </div>
              {renderMinimapSvg()}
            </section>
          </div>
        )}

        {/* BOTTOM-CENTER COLLAPSIBLE CONTROL DOCK */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleHud();
            }}
            aria-label={hudHidden ? 'Показать панель управления' : 'Скрыть панель управления'}
            className="pointer-events-auto flex items-center gap-1.5 rounded border border-[#5f86a1]/35 bg-[#0b131b]/95 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-amber-400/60 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
          >
            {hudHidden ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <Eye className="h-3.5 w-3.5" />
                <span>Показать интерфейс (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <EyeOff className="h-3.5 w-3.5" />
                <span>Скрыть интерфейс (H)</span>
              </>
            )}
          </button>

          {!hudHidden &&
            (driveMode ? (
              <nav
                aria-label="Управление мехом в режиме поездки"
                className="pointer-events-auto flex max-w-[96vw] flex-wrap items-center justify-center gap-2 rounded border border-amber-400/45 bg-[#0b131b]/94 px-3 py-2 shadow-xl"
              >
                <div className="flex items-center gap-1" role="group" aria-label="Ход и повороты">
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ forward: 1 })}
                    onPointerUp={() => setHoldInput({ forward: 0 })}
                    onPointerLeave={() => setHoldInput({ forward: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Шаг вперёд (W)"
                  >
                    W Вперёд
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ forward: -1 })}
                    onPointerUp={() => setHoldInput({ forward: 0 })}
                    onPointerLeave={() => setHoldInput({ forward: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Шаг назад (S)"
                  >
                    S Назад
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ turn: 1 })}
                    onPointerUp={() => setHoldInput({ turn: 0 })}
                    onPointerLeave={() => setHoldInput({ turn: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Поворот влево (A)"
                  >
                    A ↺
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ turn: -1 })}
                    onPointerUp={() => setHoldInput({ turn: 0 })}
                    onPointerLeave={() => setHoldInput({ turn: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Поворот вправо (D)"
                  >
                    D ↻
                  </button>
                </div>

                <span className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                <div className="flex items-center gap-1" role="group" aria-label="Башня и вооружение">
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ turretTurn: 1 })}
                    onPointerUp={() => setHoldInput({ turretTurn: 0 })}
                    onPointerLeave={() => setHoldInput({ turretTurn: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Повернуть башню влево (Q)"
                  >
                    Q ↺
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ turretTurn: -1 })}
                    onPointerUp={() => setHoldInput({ turretTurn: 0 })}
                    onPointerLeave={() => setHoldInput({ turretTurn: 0 })}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Повернуть башню вправо (E)"
                  >
                    E ↻
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="center-turret-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      driveInputRef.current.centerTurret = true;
                    }}
                    className="rounded border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-400/60 active:bg-amber-500/25 cursor-pointer"
                    aria-label="Отцентрировать башню (T)"
                  >
                    T ⌖
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      driveInputRef.current.crouch = !driveInputRef.current.crouch;
                      setCrouchUi(driveInputRef.current.crouch);
                    }}
                    aria-pressed={crouchUi}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      crouchUi
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                        : 'border border-slate-600/80 bg-slate-800/80 text-slate-200 hover:border-slate-500'
                    }`}
                    aria-label="Присесть (C)"
                  >
                    Присед (C)
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => setHoldInput({ fire: true })}
                    onPointerUp={() => setHoldInput({ fire: false })}
                    onPointerLeave={() => setHoldInput({ fire: false })}
                    aria-pressed={mechHud.isFiring}
                    className={`flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mechHud.isFiring
                        ? 'border-amber-300 bg-red-500/75 text-white shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                        : 'border-red-400/55 bg-red-600/30 text-amber-100 hover:bg-red-600/45'
                    }`}
                    aria-label="Огонь 37-мм (ЛКМ / Space)"
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-300" />
                    <span>Огонь (ЛКМ / Space)</span>
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
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      combatHud.heavyCooldown <= 0.05
                        ? 'border-sky-400/65 bg-sky-500/20 text-sky-100 hover:bg-sky-500/35'
                        : 'border-slate-700 bg-slate-900/80 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label="Выстрел 105-мм орудия (F)"
                  >
                    <Zap className="h-3.5 w-3.5 text-sky-300" />
                    <span>
                      105-мм (F) ·{' '}
                      {combatHud.heavyCooldown <= 0.05
                        ? 'ГОТОВ'
                        : `${combatHud.heavyCooldown.toFixed(1)}с`}
                    </span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="missile-salvo-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      driveInputRef.current.missileSalvo = true;
                    }}
                    disabled={combatHud.missileCooldown > 0.05}
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      combatHud.missileCooldown <= 0.05
                        ? 'border-orange-400/70 bg-orange-500/20 text-orange-100 hover:bg-orange-500/35'
                        : 'border-slate-700 bg-slate-900/80 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label="Веерный ракетный залп (Z)"
                  >
                    <Rocket className="h-3.5 w-3.5 text-orange-300" />
                    <span>
                      Залп (Z) ·{' '}
                      {combatHud.missileCooldown <= 0.05
                        ? 'ГОТОВ'
                        : `${combatHud.missileCooldown.toFixed(1)}с`}
                    </span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="cutting-laser-btn"
                    onPointerDown={() => setHoldInput({ pointerLaserFire: true })}
                    onPointerUp={() => setHoldInput({ pointerLaserFire: false })}
                    onPointerLeave={() => setHoldInput({ pointerLaserFire: false })}
                    onPointerCancel={() => setHoldInput({ pointerLaserFire: false })}
                    aria-pressed={combatHud.laserActive}
                    aria-disabled={combatHud.laserOverheated}
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      combatHud.laserOverheated
                        ? 'border-red-500/60 bg-slate-900/85 text-red-300'
                        : combatHud.laserActive
                          ? 'border-cyan-200 bg-cyan-500/45 text-white shadow-[0_0_12px_rgba(34,211,238,0.48)]'
                          : 'border-cyan-400/65 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35'
                    }`}
                    aria-label="Удерживать плазменный резак Луч-7 (B)"
                  >
                    <Sun className="h-3.5 w-3.5 text-cyan-300" />
                    <span>
                      Луч (B) · {combatHud.laserOverheated ? 'РАЗРЯД' : `${laserPct}%`}
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
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      combatHud.repairCharges > 0 && combatHud.repairCooldown <= 0.1
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                        : 'border-slate-700 bg-slate-900/80 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label="Полевой ремкомплект (V)"
                  >
                    <ShieldPlus className="h-3.5 w-3.5 text-emerald-300" />
                    <span>
                      Рем ×{combatHud.repairCharges} (V)
                      {combatHud.repairCooldown > 0.1
                        ? ` · ${combatHud.repairCooldown.toFixed(0)}с`
                        : ''}
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
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-bold font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      combatHud.dashActive
                        ? 'border-cyan-300 bg-cyan-500/35 text-white shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                        : combatHud.dashCooldown <= 0.05
                          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
                          : 'border-slate-700 bg-slate-900/80 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label="Реактивный рывок (X)"
                  >
                    <Wind className="h-3.5 w-3.5 text-cyan-300" />
                    <span>
                      Рывок (X) ·{' '}
                      {combatHud.dashActive
                        ? 'РЫВОК'
                        : combatHud.dashCooldown <= 0.05
                          ? 'ГОТОВ'
                          : `${combatHud.dashCooldown.toFixed(1)}с`}
                    </span>
                  </button>
                </div>

                <span className="hidden md:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                <div className="flex items-center gap-1" role="group" aria-label="Освещение">
                  {(
                    [
                      { id: 'day', label: 'День', Icon: Sun },
                      { id: 'dusk', label: 'Закат', Icon: Sunset },
                      { id: 'night', label: 'Ночь', Icon: Moon },
                    ] as const
                  ).map(({ id, label, Icon }) => {
                    const active = lightingPreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onChangeLighting(id);
                        }}
                        aria-pressed={active}
                        aria-label={label}
                        className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                            : 'text-slate-400 border border-transparent hover:text-slate-200'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleDriveMode();
                  }}
                  className="flex items-center gap-1 rounded border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>Обзор (Esc)</span>
                </button>
              </nav>
            ) : (
              <nav
                aria-label="Управление камерой и слоями карты"
                className="pointer-events-auto flex max-w-[95vw] flex-wrap items-center justify-center gap-2 rounded border border-[#5f86a1]/35 bg-[#0b131b]/92 px-3 py-2 shadow-xl"
              >
                <button
                  type="button"
                  data-start="true"
                  onClick={onToggleDriveMode}
                  aria-pressed={driveMode}
                  className="flex items-center gap-1.5 rounded border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30 focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Режим поездки (M)</span>
                </button>

                <span className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                <div className="flex flex-wrap items-center gap-1">
                  {SECTOR_ORDER.map((id) => {
                    const isActive = activeSector === id;
                    const shortName: Record<SectorId, string> = {
                      overview: 'Обзор',
                      airfield: 'Вертодром',
                      crossing: 'Мост A·B',
                      refinery: 'Завод',
                      citadel: 'Цитадель',
                      quarry: 'Карьер',
                    };
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectSector(id)}
                        aria-pressed={isActive}
                        className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                            : 'text-slate-300 border border-transparent hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        {shortName[id]}
                      </button>
                    );
                  })}
                </div>

                <span className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                <div className="flex items-center gap-1" role="group" aria-label="Слои карты">
                  <button
                    type="button"
                    onClick={onToggleMarkers}
                    aria-pressed={showMarkers}
                    aria-label="Переключить тактические маркеры"
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showMarkers
                        ? 'bg-sky-500/18 text-sky-200 border border-sky-400/40'
                        : 'text-slate-400 border border-transparent hover:text-slate-200'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Метки</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleUnits}
                    aria-pressed={showUnits}
                    aria-label="Переключить патрульную технику"
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showUnits
                        ? 'bg-sky-500/18 text-sky-200 border border-sky-400/40'
                        : 'text-slate-400 border border-transparent hover:text-slate-200'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Техника</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleMist}
                    aria-pressed={showMist}
                    aria-label="Переключить дым и туман"
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showMist
                        ? 'bg-sky-500/18 text-sky-200 border border-sky-400/40'
                        : 'text-slate-400 border border-transparent hover:text-slate-200'
                    }`}
                  >
                    <Wind className="h-3.5 w-3.5" />
                    <span>Дым</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleGrid}
                    aria-pressed={showWireframeGrid}
                    aria-label="Переключить сетку высот"
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showWireframeGrid
                        ? 'bg-sky-500/18 text-sky-200 border border-sky-400/40'
                        : 'text-slate-400 border border-transparent hover:text-slate-200'
                    }`}
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    <span>Рельеф</span>
                  </button>
                </div>

                <span className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                <div className="flex items-center gap-1" role="group" aria-label="Освещение">
                  {(
                    [
                      { id: 'day', label: 'День', Icon: Sun },
                      { id: 'dusk', label: 'Закат', Icon: Sunset },
                      { id: 'night', label: 'Ночь', Icon: Moon },
                    ] as const
                  ).map(({ id, label, Icon }) => {
                    const active = lightingPreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onChangeLighting(id)}
                        aria-pressed={active}
                        className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-400/50'
                            : 'text-slate-400 border border-transparent hover:text-slate-200'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>
            ))}
        </div>
      </div>
      )}
    </div>
  );
}
