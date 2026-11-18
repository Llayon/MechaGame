import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadWorldAssets, type WorldAssets } from './map/worldAssets';
import './index.css';

function GameEntry() {
  const [world, setWorld] = useState<WorldAssets>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const bakedTerrain = new URLSearchParams(window.location.search).get('terrain') === 'baked';
    loadWorldAssets(bakedTerrain, controller.signal).then(
      (loaded) => { if (!controller.signal.aborted) setWorld(loaded); },
      () => {
        if (controller.signal.aborted) return;
        controller.abort();
        setFailed(true);
      },
    );
    return () => controller.abort();
  }, [attempt]);

  if (world) return <App world={world} />;
  return (
    <main className="grid h-dvh place-items-center bg-[#091016] text-cyan-100">
      {failed ? (
        <div className="space-y-4 text-center" role="alert">
          <p>Не удалось загрузить карту.</p>
          <button
            className="rounded border border-cyan-400 px-4 py-2"
            onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}
          >
            Повторить
          </button>
        </div>
      ) : <p role="status">Загрузка карты…</p>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<GameEntry />);
