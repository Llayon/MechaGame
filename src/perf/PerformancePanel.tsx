import { useCallback, useEffect, useState } from 'react';
import { frameProfiler } from './frameMetrics';
import type { CaptureReport } from './frameMetrics';

declare global {
  interface Window {
    __mechaPerf?: {
      startCapture: (durationMs?: number) => void;
      getStatus: () => ReturnType<typeof frameProfiler.getStatus>;
      getLive: () => ReturnType<typeof frameProfiler.getLive>;
      getReport: () => CaptureReport | null;
    };
  }
}

function metric(n: number): string { return Number.isFinite(n) ? n.toFixed(1) : '—'; }
function count(n: number): string { return Math.round(n).toLocaleString('ru-RU'); }

function download(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Enabled with ?profile=1 or F8; never requires React renders on every frame. */
export function PerformancePanel() {
  const [open, setOpen] = useState(
    () => new URLSearchParams(window.location.search).get('profile') === '1',
  );
  const [view, setView] = useState(() => frameProfiler.getLive());
  const [status, setStatus] = useState(() => frameProfiler.getStatus());
  const [report, setReport] = useState<CaptureReport | null>(null);

  const refresh = useCallback(() => {
    setView(frameProfiler.getLive());
    setStatus(frameProfiler.getStatus());
    setReport(frameProfiler.getReport());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'F8') return;
      e.preventDefault();
      setOpen(value => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.__mechaPerf = {
      startCapture: (durationMs?: number) => frameProfiler.startCapture(durationMs ?? 20_000),
      getStatus: () => frameProfiler.getStatus(),
      getLive: () => frameProfiler.getLive(),
      getReport: () => frameProfiler.getReport(),
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') frameProfiler.interrupt();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      delete window.__mechaPerf;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (open) frameProfiler.setEnabled(true);
    else if (!frameProfiler.getStatus().active) frameProfiler.setEnabled(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    refresh();
    const interval = window.setInterval(refresh, 400);
    return () => window.clearInterval(interval);
  }, [open, refresh]);

  const begin = () => {
    frameProfiler.startCapture(20_000);
    refresh();
  };

  const saveSceneInventory = () => {
    const inventory = window.__mechaSceneAudit?.();
    if (!inventory) return;
    download('mech-scene-inventory-' + inventory.createdAt.replace(/[:.]/g, '-') + '.json',
      'application/json', JSON.stringify(inventory, null, 2));
  };

  const save = (csv: boolean) => {
    const data = frameProfiler.getReport();
    if (!data) return;
    const basename = 'mech-profile-' + data.environment.scenario +
      '-' + data.createdAt.replace(/[:.]/g, '-');
    if (!csv) {
      download(basename + '.json', 'application/json', JSON.stringify(data, null, 2));
      return;
    }
    const keys = ['atMs', 'frameMs', 'calls', 'triangles', 'points', 'lines', 'geometries', 'textures'] as const;
    download(basename + '.csv', 'text/csv',
      [keys.join(','), ...data.frames.map(f => keys.map(k => f[k]).join(','))].join('\n'));
  };

  if (!open) return null;
  const stats = view.stats;
  const counters = view.counters;
  const heap = report?.device.jsHeapUsedBytes;
  return (
    <aside data-testid="performance-panel" aria-label="Профилирование производительности"
      className="pointer-events-auto fixed right-3 top-14 z-[100] w-[min(340px,calc(100vw-24px))] rounded-lg border border-sky-500/45 bg-[#08111b]/95 p-3 text-slate-100 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm">PERF · MechaGame</strong>
        <button className="rounded border border-slate-600 px-2 py-1 text-xs"
          onClick={() => setOpen(false)}>Скрыть · F8</button>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        {view.environment.scenario === 'combat' ? 'Бой' : 'Обзор'} · {view.environment.lighting} ·
        {view.environment.softwareMode ? ' Software WebGL' : ' WebGL'} ·
        {view.environment.graphicsPreset ?? 'неизвестно'} · DPR {view.environment.renderDpr ?? '—'} · rAF-интервалы
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-slate-800/80 p-2">
          <div data-testid="perf-fps" className="font-mono text-lg font-bold text-emerald-300">{metric(stats.fps)}</div>
          <div className="text-[10px] text-slate-400">FPS</div>
        </div>
        <div className="rounded bg-slate-800/80 p-2">
          <div className="font-mono text-lg">{metric(stats.p50Ms)}</div>
          <div className="text-[10px] text-slate-400">p50 мс</div>
        </div>
        <div className="rounded bg-slate-800/80 p-2">
          <div className="font-mono text-lg text-amber-300">{metric(stats.p95Ms)}</div>
          <div className="text-[10px] text-slate-400">p95 мс</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
        <span>Кадры: {count(stats.sampleCount)}</span>
        <span>Медленные &gt;33мс: {stats.slowOver33Ms}</span>
        <span>Draw calls: {count(counters.calls)}</span>
        <span>Треугольники: {count(counters.triangles)}</span>
        <span>Геометрии: {count(counters.geometries)}</span>
        <span>Текстуры: {count(counters.textures)}</span>
        <span>JS heap: {heap == null ? 'н/д' : Math.round(heap / 1048576) + ' МБ'}</span>
        <span>VRAM: недоступно</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={begin} disabled={status.active}
          className="rounded bg-amber-500/85 px-2.5 py-2 text-xs font-semibold text-slate-950 disabled:opacity-45">
          {status.active ? 'Запись ' + Math.round(status.progress * 100) + '%' : 'Записать 20 с'}
        </button>
        <button onClick={() => save(false)} disabled={!report}
          className="rounded border border-slate-500 px-2.5 py-2 text-xs disabled:opacity-35">JSON</button>
        <button onClick={() => save(true)} disabled={!report}
          className="rounded border border-slate-500 px-2.5 py-2 text-xs disabled:opacity-35">CSV</button>
        <button data-testid="perf-scene-inventory" onClick={saveSceneInventory}
          className="rounded border border-sky-500/70 px-2.5 py-2 text-xs text-sky-200 hover:bg-sky-500/10">
          Структура сцены · JSON
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        Замеряйте при движении. Структура сцены — это учёт мешей по категориям, не реальные GPU draw calls.
        FPS основан на интервале кадров, а не на GPU timer.
        На телефоне откройте ссылку с параметрами ?autostart=1&amp;profile=1.
      </p>
    </aside>
  );
}
