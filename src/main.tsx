import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HangarEntry } from './hangar/HangarEntry';
import { StartupErrorBoundary } from './hangar/StartupErrorBoundary';
import './index.css';

const DirectGameEntry = lazy(() => import('./DirectGameEntry'));
const query = new URLSearchParams(window.location.search);
const showHangar = query.get('menu') === 'hangar' && query.get('autostart') !== '1';

createRoot(document.getElementById('root')!).render(showHangar ? (
  <HangarEntry bakedTerrain={query.get('terrain') !== 'worker'} />
) : (
  <StartupErrorBoundary fallback={
    <main className="grid h-dvh place-items-center p-6 text-cyan-100" role="alert">
      <div className="space-y-4 text-center">
        <p>Не удалось запустить игру.</p>
        <button className="rounded border border-cyan-400 px-4 py-2" onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </div>
    </main>
  }>
    <Suspense fallback={<main className="grid h-dvh place-items-center text-cyan-100" role="status">Загрузка карты…</main>}>
      <DirectGameEntry bakedTerrain={query.get('terrain') === 'baked'} />
    </Suspense>
  </StartupErrorBoundary>
));
