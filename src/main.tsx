import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadWorldAssets, type WorldAssets } from './map/worldAssets';
import { prepareGroundMap } from './scene/terrain/OverviewGround';
import { prepareCompactGround } from './scene/terrain/CompactGround';
import { landmarksRequested, loadLandmarks } from './scene/LandmarkOverview';
import './index.css';

const query = new URLSearchParams(location.search);
const baked = query.get('terrain') === 'baked';
const streaming = baked && landmarksRequested && query.get('surface') === 'stream';

function GameEntry() {
  const [world, setWorld] = useState<WorldAssets | null>(null);
  const [preview, setPreview] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const notifyDraw = useCallback(() => setDrawn(true), []);

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    const signal = controller.signal;
    async function start() {
      const artwork = Promise.all([loadLandmarks(signal), prepareGroundMap(signal)]);
      if (streaming) {
        try {
          await Promise.all([artwork, prepareCompactGround(signal)]);
          if (!signal.aborted) setPreview(true);
          return;
        } catch {
          if (signal.aborted) return;
        }
      }
      const [loaded] = await Promise.all([loadWorldAssets(baked, signal), artwork.catch(() => undefined)]);
      if (!signal.aborted) setWorld(loaded);
    }
    start().catch(() => { if (!signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [preview, attempt]);

  useEffect(() => {
    if (!drawn || !preview || world) return;
    const controller = new AbortController();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        performance.mark('full-world-request');
        loadWorldAssets(baked, controller.signal).then(loaded => {
          if (!controller.signal.aborted) {
            performance.mark('full-world-loaded');
            setWorld(loaded);
          }
        }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
      });
    });
    return () => { cancelAnimationFrame(frame); controller.abort(); };
  }, [drawn, preview, world, attempt]);

  function retry() { setFailed(false); setAttempt(n => n + 1); }
  if (world || preview) return <>
    <App world={world} onOverviewDraw={notifyDraw} />
    {failed && <button className="fixed bottom-20 left-4 z-50 rounded bg-slate-900 px-4 py-2 text-white" onClick={retry}>Повторить загрузку деталей карты</button>}
  </>;
  return <main className="grid h-dvh place-items-center bg-[#091016] text-cyan-100">
    {failed ? <div role="alert"><p>Не удалось загрузить карту.</p><button onClick={retry}>Повторить</button></div> : <p role="status">Загрузка карты…</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<GameEntry />);
