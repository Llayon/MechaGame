import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadWorldAssets } from './map/worldAssets';
import { prepareGroundMap } from './scene/terrain/OverviewGround';
import { prepareCompactGround } from './scene/terrain/CompactGround';
import { loadLandmarks } from './scene/LandmarkOverview';
import { mapStartup } from './map/mapStartup';
import { loadBattleScene, loadPlayerBattleEntry } from './scene/loadBattleScene';
import './index.css';

const { baked, streaming } = mapStartup;
const traceStartup = new URLSearchParams(location.search).has('startupTrace');
if (traceStartup) performance.mark('entry-evaluated');

async function loadDetails(signal: AbortSignal) {
  const [world, battle] = await Promise.all([
    loadWorldAssets(baked, signal),
    loadBattleScene(),
  ]);
  return { world, battle };
}

function GameEntry() {
  const [details, setDetails] = useState<Awaited<ReturnType<typeof loadDetails>> | null>(null);
  const [preview, setPreview] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const notifyDraw = useCallback(() => {
    setDrawn(true);
    // Start the mech transfer at the first overview draw. The details loader
    // awaits the same module and routes failures through the existing retry UI.
    if (streaming) void loadPlayerBattleEntry().catch(() => {});
  }, []);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    const signal = controller.signal;
    async function start() {
      const timed = (name: string, task: Promise<void>) => traceStartup
        ? task.then(() => { if (!signal.aborted) performance.mark(name); })
        : task;
      const artwork = Promise.all([
        timed('overview-landmarks-ready', loadLandmarks(signal)),
        timed('overview-texture-ready', prepareGroundMap(signal)),
      ]);
      if (streaming) {
        try {
          await Promise.all([artwork, timed('overview-mesh-ready', prepareCompactGround(signal))]);
          if (!signal.aborted) {
            if (traceStartup) performance.mark('overview-assets-ready');
            setPreview(true);
          }
          return;
        } catch {
          if (signal.aborted) return;
        }
      }
      const [loaded] = await Promise.all([loadDetails(signal), artwork.catch(() => undefined)]);
      if (!signal.aborted) setDetails(loaded);
    }
    start().catch(() => { if (!signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [preview, attempt]);

  useEffect(() => {
    if (!drawn || !preview || details) return;
    const controller = new AbortController();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        performance.mark('full-world-request');
        loadDetails(controller.signal).then(loaded => {
          if (!controller.signal.aborted) {
            performance.mark('full-world-loaded');
            setDetails(loaded);
          }
        }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
      });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, [drawn, preview, details, attempt]);

  function retry() { setFailed(false); setAttempt(n => n + 1); }
  if (details || preview) return <>
    <App world={details?.world ?? null} battle={details?.battle ?? null} onOverviewDraw={notifyDraw} />
    {failed && <button className="fixed bottom-20 left-4 z-50 rounded bg-slate-900 px-4 py-2 text-white" onClick={retry}>Повторить загрузку деталей карты</button>}
  </>;
  return <main className="grid h-dvh place-items-center bg-[#091016] text-cyan-100">
    {failed ? <div role="alert"><p>Не удалось загрузить карту.</p><button onClick={retry}>Повторить</button></div> : <p role="status">Загрузка карты…</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<GameEntry />);
