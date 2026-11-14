import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Flame,
  Grid3x3,
  MapPin,
  Moon,
  Navigation,
  RotateCcw,
  Sun,
  Sunset,
  Truck,
  Wind,
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

interface TacticalHUDProps {
  activeSector: SectorId;
  lightingPreset: LightingPreset;
  driveMode: boolean;
  mechPoseRef: React.MutableRefObject<MechTelemetrySnapshot>;
  driveInputRef: React.MutableRefObject<MechDriveInput>;
  showMarkers: boolean;
  showUnits: boolean;
  showMist: boolean;
  showWireframeGrid: boolean;
  hudHidden: boolean;
  onSelectSector: (id: SectorId) => void;
  onResetOverview: () => void;
  onChangeLighting: (preset: LightingPreset) => void;
  onToggleDriveMode: () => void;
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

export function TacticalHUD({
  activeSector,
  lightingPreset,
  driveMode,
  mechPoseRef,
  driveInputRef,
  showMarkers,
  showUnits,
  showMist,
  showWireframeGrid,
  hudHidden,
  onSelectSector,
  onResetOverview,
  onChangeLighting,
  onToggleDriveMode,
  onToggleMarkers,
  onToggleUnits,
  onToggleMist,
  onToggleGrid,
  onToggleHud,
}: TacticalHUDProps) {
  const sector = SECTORS[activeSector];
  const [mechHud, setMechHud] = useState<MechTelemetrySnapshot>(() => ({
    ...mechPoseRef.current,
  }));
  const [crouchUi, setCrouchUi] = useState(false);

  // Sync Drive HUD telemetry at ~8 Hz only while driving (zero 60 Hz React re-renders)
  useEffect(() => {
    setMechHud({ ...mechPoseRef.current });
    setCrouchUi(driveInputRef.current.crouch);
    if (!driveMode) return;
    const id = window.setInterval(() => {
      setMechHud({ ...mechPoseRef.current });
      setCrouchUi(driveInputRef.current.crouch);
    }, 125);
    return () => window.clearInterval(id);
  }, [driveMode, mechPoseRef, driveInputRef]);

  const setHoldInput = (
    patch: Partial<Pick<MechDriveInput, 'forward' | 'turn' | 'turretTurn' | 'fire' | 'sprint'>>,
  ) => {
    Object.assign(driveInputRef.current, patch);
  };

  const minimapMech = worldToMinimap(mechHud.x, mechHud.z);
  const headingDeg = Math.round((((mechHud.yaw * 180) / Math.PI) % 360 + 360) % 360);
  const surfaceTag = mechHud.onBridge
    ? 'МОСТ / ЭСТАКАДА'
    : mechHud.inWater
      ? 'БРОД'
      : 'ГРУНТ';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">
      {/* TOP BAR & COMPASS TICKS */}
      {hudHidden ? (
        <div aria-hidden="true" />
      ) : (
        <div className="flex items-start justify-between gap-4">
          {/* Top-Left Card: Sector Brief or Live Mech Drive Telemetry */}
          {driveMode ? (
            <section
              aria-label="Телеметрия меха"
              className="pointer-events-auto w-[278px] rounded border border-amber-400/45 bg-[#0b131b]/92 p-3 shadow-lg"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  <h1 className="font-display text-base font-bold tracking-wide text-amber-100 leading-tight">
                    Борт № 316 · Пилот
                  </h1>
                </div>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-amber-200 border border-amber-400/35">
                  {surfaceTag}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-2 text-[11px] font-mono-tabular">
                <div>
                  <div className="text-[10px] text-slate-400">Скорость</div>
                  <div className="font-bold text-slate-100">
                    {mechHud.speedKmh.toFixed(1)} км/ч
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Высота</div>
                  <div className="font-bold text-slate-100">
                    {mechHud.elevationM >= 0 ? `+${mechHud.elevationM}` : mechHud.elevationM} м
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Курс</div>
                  <div className="font-bold text-slate-100">{headingDeg}°</div>
                </div>
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

          {/* Top-Center Compass & Bearing Scale */}
          <div
            aria-hidden="true"
            className="hidden md:flex flex-col items-center gap-1 pt-0.5 text-slate-400"
          >
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular tracking-wider text-slate-300">
              <span>270° W</span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-amber-300/90 font-semibold">
                <Compass className="h-3.5 w-3.5" />
                {driveMode ? `${headingDeg.toString().padStart(3, '0')}° HDG` : '315° NW'}
              </span>
              <span className="text-slate-600">|</span>
              <span>000° N</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              {Array.from({ length: 19 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`block w-px bg-slate-400 ${
                    idx % 3 === 0 ? 'h-2.5' : 'h-1.5 opacity-60'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Top-Right Quick Action */}
          <div className="pointer-events-auto flex items-center gap-2">
            {driveMode ? (
              <button
                type="button"
                onClick={onToggleDriveMode}
                className="flex items-center gap-1.5 rounded border border-amber-400/55 bg-[#0b131b]/92 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Выйти из режима поездки в обзор"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Выйти в обзор (Esc)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onResetOverview}
                className="flex items-center gap-1.5 rounded border border-[#5f86a1]/35 bg-[#0b131b]/90 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-amber-400/60 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Сбросить камеру к общему виду"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Общий вид</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Inspector (left), Control Dock (center), Minimap (right) */}
      <div className="flex flex-col gap-3">
        {!hudHidden && (
          <div
            className={`hidden lg:flex items-end gap-4 ${
              driveMode ? 'justify-end' : 'justify-between'
            }`}
          >
            {/* Bottom-Left Active Sector Inspector (hidden during Ride Mode to keep 3D view wide open) */}
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
                  {driveMode ? 'Борт 316' : 'Клик — переход'}
                </span>
              </div>
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
                <line x1="146" y1="88" x2="170" y2="80" stroke="#c89e52" strokeWidth="2.5" />

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

                {/* Live Mech position & heading beacon */}
                <g transform={`translate(${minimapMech.mx.toFixed(1)}, ${minimapMech.my.toFixed(1)})`}>
                  <circle r="5.5" fill="#10b981" fillOpacity="0.28" stroke="#34d399" strokeWidth="1" />
                  <circle r="2.6" fill="#fef08a" stroke="#0b131b" strokeWidth="0.8" />
                </g>
              </svg>
            </section>
          </div>
        )}

        {/* BOTTOM-CENTER COLLAPSIBLE CONTROL DOCK */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleHud}
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
                {/* Holdable Movement / Turret / Fire controls for mouse & touch alongside WASD */}
                <div className="flex items-center gap-1" role="group" aria-label="Ход и повороты">
                  <button
                    type="button"
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

                {/* Turret & Weapons */}
                <div className="flex items-center gap-1" role="group" aria-label="Башня и вооружение">
                  <button
                    type="button"
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
                    onClick={() => {
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
                    onPointerDown={() => setHoldInput({ fire: true })}
                    onPointerUp={() => setHoldInput({ fire: false })}
                    onPointerLeave={() => setHoldInput({ fire: false })}
                    aria-pressed={mechHud.isFiring}
                    className={`flex items-center gap-1 rounded border px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mechHud.isFiring
                        ? 'border-amber-300 bg-red-500/75 text-white shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                        : 'border-red-400/55 bg-red-600/30 text-amber-100 hover:bg-red-600/45'
                    }`}
                    aria-label="Огонь 37-мм (Space)"
                  >
                    <Flame className="h-3.5 w-3.5 text-amber-300" />
                    <span>Огонь (Space)</span>
                  </button>
                </div>

                <span className="hidden md:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                {/* Lighting Presets & Exit */}
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
                  onClick={onToggleDriveMode}
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
                {/* Enter Mech Drive Mode */}
                <button
                  type="button"
                  onClick={onToggleDriveMode}
                  aria-pressed={driveMode}
                  className="flex items-center gap-1.5 rounded border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30 focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Режим поездки (M)</span>
                </button>

                <span className="hidden sm:block h-5 w-px bg-slate-700/80" aria-hidden="true" />

                {/* Camera Sector Presets */}
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

                {/* Map Layers */}
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

                {/* Time of Day / Lighting Presets */}
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
    </div>
  );
}
