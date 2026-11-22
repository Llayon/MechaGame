import { useEffect, useRef } from 'react';
import { Gauge, RotateCcw, Settings2, X } from 'lucide-react';
import {
  changeGraphicsSetting, MIN_RESOLUTION_SCALE, MAX_RESOLUTION_SCALE, withGraphicsPreset,
} from '../game/graphicsSettings';
import type {
  GraphicsSettings, GraphicsPreset, ShadowQuality,
  VegetationQuality, AtmosphereQuality, ParticleQuality,
} from '../game/graphicsSettings';
import { isAdaptiveDegraded, type AdaptiveState } from '../lod/adaptiveQuality';

interface Props {
  open: boolean;
  settings: GraphicsSettings;
  adaptation: AdaptiveState;
  activeDpr: number;
  onChange: (next: GraphicsSettings) => void;
  onResetDrs: () => void;
  onOpen: () => void;
  onClose: () => void;
}

const PRESETS: { value: Exclude<GraphicsPreset, 'custom'>; name: string; detail: string }[] = [
  { value: 'low', name: 'Экономный', detail: 'Максимум скорости' },
  { value: 'balanced', name: 'Баланс', detail: 'Для телефонов' },
  { value: 'high', name: 'Высокий', detail: 'Качество ПК' },
  { value: 'ultra', name: 'Ультра', detail: 'Мощный GPU' },
];

const shadows: { value: ShadowQuality; label: string }[] = [
  {value:'off',label:'Выключены'},
  {value:'low',label:'Низкие · 1024'},
  {value:'high',label:'Высокие · 2048'},
  {value:'ultra',label:'Ультра · 3072'},
];
const vegetation: { value: VegetationQuality; label: string }[] = [
  {value:'minimal',label:'Минимум · только важные деревья'},
  {value:'reduced',label:'Меньше травы и кустарников'},
  {value:'full',label:'Полная растительность'},
];
const particles: { value: ParticleQuality; label: string }[] = [
  {value:'reduced',label:'Уменьшенные вспышки и обломки'},
  {value:'full',label:'Полные эффекты боя'},
];
const atmosphere: { value: AtmosphereQuality; label: string }[] = [
  {value:'off',label:'Без тумана и лучей'},
  {value:'reduced',label:'Туман без солнечных лучей'},
  {value:'full',label:'Полная атмосфера'},
];

function SettingSelect<T extends string>({
  id,label,description,value,options,onChange,
}:{
  id:string; label:string; description:string; value:T;
  options:{value:T;label:string}[]; onChange:(v:T)=>void;
}) {
  return (
    <label className="grid gap-1.5 rounded-lg border border-slate-600/35 bg-slate-900/40 p-3">
      <span className="text-sm font-medium text-slate-100">{label}</span>
      <span className="text-[11px] text-slate-400">{description}</span>
      <select data-testid={id} value={value}
        onChange={e=>onChange(e.currentTarget.value as T)}
        className="mt-1 min-h-10 w-full rounded border border-slate-600 bg-[#111d2a] px-2 text-sm text-slate-100 outline-offset-2 focus:outline-sky-400">
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Render-only configuration UI. It never changes game simulation or combat state. */
export function GraphicsSettingsMenu({
  open,
  settings,
  adaptation,
  activeDpr,
  onChange,
  onResetDrs,
  onOpen,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const activeScale = settings.autoQuality
    ? Math.min(settings.resolutionScale, adaptation.drsScale)
    : settings.resolutionScale;
  const degraded = settings.autoQuality && isAdaptiveDegraded(adaptation, settings);

  return (
    <>
      {!open && (
        <button type="button" data-testid="graphics-open" onClick={onOpen}
          className="fixed right-3 top-3 z-[120] flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-400/50 bg-[#111b26]/90 px-3 py-2 text-xs font-semibold tracking-wide text-slate-100 shadow-xl backdrop-blur hover:border-amber-300 hover:bg-[#202c39] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
          <Settings2 size={16} aria-hidden="true"/> ГРАФИКА <span className="text-[10px] text-slate-400">G</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#03090d]/85 p-2 backdrop-blur-[5px] sm:p-5">
          <section role="dialog" aria-modal="true" aria-labelledby="graphics-title"
            data-testid="graphics-settings-dialog"
            className="flex max-h-[94dvh] w-full max-w-[690px] flex-col overflow-hidden rounded-xl border border-amber-300/35 bg-[#101b27] text-slate-100 shadow-[0_20px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2"><Gauge size={20} className="text-amber-300"/></span>
                <div>
                  <h2 id="graphics-title" className="text-lg font-bold tracking-wide sm:text-xl">Настройки графики</h2>
                  <p className="text-[11px] text-slate-400">Объект 316 · изменения без перезагрузки</p>
                </div>
              </div>
              <button ref={closeRef} type="button" data-testid="graphics-close" aria-label="Закрыть настройки графики"
                onClick={onClose}
                className="rounded border border-slate-600 p-2 text-slate-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-amber-300">
                <X size={19}/>
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-amber-300/90">Качество</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS.map(preset=>(
                  <button type="button" key={preset.value}
                    data-testid={'graphics-preset-'+preset.value}
                    aria-pressed={settings.preset===preset.value}
                    onClick={()=>onChange(withGraphicsPreset(preset.value))}
                    className={'rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 '+
                      (settings.preset===preset.value
                        ? 'border-amber-400 bg-amber-300/15 text-amber-100'
                        : 'border-slate-600/70 bg-slate-800/45 text-slate-100 hover:border-slate-400')}>
                    <span className="block text-sm font-bold">{preset.name}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">{preset.detail}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>{settings.preset==='custom' ? 'Собственные настройки' : 'Пресет: '+PRESETS.find(p=>p.value===settings.preset)?.name}</span>
                <button type="button" onClick={()=>onChange(withGraphicsPreset('high'))}
                  className="whitespace-nowrap rounded border border-slate-600 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700">
                  Сбросить на высокие
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1.5 rounded-lg border border-slate-600/35 bg-slate-900/40 p-3">
                  <span className="text-sm font-medium">Масштаб рендеринга</span>
                  <span className="text-[11px] text-slate-400">Базовый потолок разрешения GPU (от 50% до 115%)</span>
                  <div className="mt-1 flex items-center gap-3">
                    <input data-testid="graphics-resolution" type="range"
                      min={MIN_RESOLUTION_SCALE} max={MAX_RESOLUTION_SCALE} step="0.05"
                      value={settings.resolutionScale}
                      onChange={e=>onChange(changeGraphicsSetting(settings,'resolutionScale',Number(e.currentTarget.value)))}
                      className="h-8 min-w-0 flex-1 accent-amber-400"
                      aria-label="Масштаб рендеринга" />
                    <span className="w-11 text-right font-mono font-semibold tabular-nums text-amber-200">
                      {Math.round(settings.resolutionScale*100)}%
                    </span>
                  </div>
                  {settings.autoQuality && (
                    <span data-testid="graphics-drs-status"
                      className={'font-mono text-[11px] tabular-nums ' + (degraded ? 'text-amber-300' : 'text-slate-400')}>
                      Авто-масштаб: {Math.round(activeScale * 100)}% · DPR {activeDpr.toFixed(2)}
                      {adaptation.cascadeStep > 0 ? ` · ступень ${adaptation.cascadeStep}` : ''}
                      {adaptation.contextLostFallback ? ' · откат GPU' : ''}
                    </span>
                  )}
                </label>
                <SettingSelect id="graphics-shadows" label="Тени"
                  description="Размер карты теней направленного света"
                  value={settings.shadows} options={shadows}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'shadows',v))}/>
                <SettingSelect id="graphics-object-detail" label="Детализация объектов"
                  description="Дальность детальных моделей и рельефа"
                  value={settings.objectDetail} options={PRESETS.map(p => ({value:p.value, label:p.name}))}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'objectDetail',v))}/>
                <div className="grid gap-2 rounded-lg border border-slate-600/35 bg-slate-900/40 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium text-slate-100">Автоматическая оптимизация</span>
                      <span className="text-[11px] text-slate-400">
                        Сначала плавно снижает разрешение до 50%, затем — тени и детали
                      </span>
                    </span>
                    <input type="checkbox" data-testid="graphics-auto-quality"
                      checked={settings.autoQuality}
                      onChange={e=>onChange(changeGraphicsSetting(settings,'autoQuality',e.currentTarget.checked))}
                      className="h-5 w-5 shrink-0 accent-amber-400" />
                  </label>
                  {settings.autoQuality && (
                    <div className="flex items-center justify-between gap-2 border-t border-slate-700/60 pt-2">
                      <span className="text-[11px] text-slate-400">
                        {degraded ? 'Подобранный масштаб сохранён' : 'Работает на базовом масштабе'}
                      </span>
                      <button
                        type="button"
                        data-testid="graphics-reset-drs"
                        onClick={onResetDrs}
                        className={'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ' +
                          (degraded
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-800')}>
                        <RotateCcw size={13} aria-hidden="true" />
                        Сбросить авто-масштаб
                      </button>
                    </div>
                  )}
                </div>
                {settings.autoQuality && <SettingSelect id="graphics-target-fps" label="Целевая частота кадров"
                  description="Окно ~1 с без выбросов · экспоненциальное ожидание возврата"
                  value={String(settings.targetFps)} options={['30','45','60'].map(value=>({value,label:value+' FPS'}))}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'targetFps',Number(v) as GraphicsSettings['targetFps']))}/>}
                <SettingSelect id="graphics-vegetation" label="Растительность"
                  description="Количество травы, кустов и визуальных деталей"
                  value={settings.vegetation} options={vegetation}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'vegetation',v))}/>
                <SettingSelect id="graphics-particles" label="Частицы боя"
                  description="Количество искр, дымовых всплесков и обломков"
                  value={settings.particles} options={particles}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'particles',v))}/>
                <SettingSelect id="graphics-atmosphere" label="Атмосфера"
                  description="Туман, дымка и прозрачные световые лучи"
                  value={settings.atmosphere} options={atmosphere}
                  onChange={v=>onChange(changeGraphicsSetting(settings,'atmosphere',v))}/>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-600/35 bg-slate-900/40 p-3">
                  <span className="grid gap-1">
                    <span className="text-sm font-medium">Дальний бой на горизонте</span>
                    <span className="text-[11px] text-slate-400">Крейсеры, трассеры и дальние взрывы</span>
                  </span>
                  <input data-testid="graphics-distant-war" type="checkbox"
                    checked={settings.distantWar}
                    onChange={e=>onChange(changeGraphicsSetting(settings,'distantWar',e.currentTarget.checked))}
                    className="h-5 w-5 shrink-0 accent-amber-400" />
                </label>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Настройки сохраняются в браузере. Подобранный динамический масштаб запоминается отдельно и не меняет ваш базовый пресет.
                Ни физика, ни точность стрельбы не меняются. Для сравнения FPS и времени кадра нажми <strong className="text-amber-200">F8</strong>.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-700/70 px-4 py-3 sm:px-6">
              <p className="text-[11px] text-slate-400">Во время настройки бой приостановлен</p>
              <button type="button" data-testid="graphics-apply" onClick={onClose}
                className="min-h-10 whitespace-nowrap rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
                Применить и закрыть
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

