import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type App from '../App';
import type { WorldAssets } from '../map/worldAssets';
import { StartupErrorBoundary } from './StartupErrorBoundary';
import poster from './assets/mech-042.webp';
import './hangar.css';

const HangarPreview = lazy(() => import('./HangarPreview'));

type Phase = 'hangar' | 'loading' | 'scene' | 'battle' | 'error';

interface WorldRequest {
  controller: AbortController;
  assets: Promise<WorldAssets>;
}

interface Battle {
  Game: typeof App;
  world: WorldAssets;
}

function afterPaint(callback: () => void) {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(callback);
  });
  return () => cancelAnimationFrame(frame);
}

export function HangarEntry({ bakedTerrain }: { bakedTerrain: boolean }) {
  const request = useRef<WorldRequest | null>(null);
  const mounted = useRef(false);
  const launchPending = useRef(false);
  const [phase, setPhase] = useState<Phase>('hangar');
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [preparedBattle, setPreparedBattle] = useState<Battle>();
  const [battle, setBattle] = useState<Battle>();
  const playButton = useRef<HTMLButtonElement>(null);
  const transferStatus = useRef<HTMLDivElement>(null);

  const prepareWorld = useCallback(() => {
    if (request.current) return request.current.assets;
    const controller = new AbortController();
    performance.mark('mecha-hangar-world-start');
    const assets = import('../map/worldAssets')
      .then(({ loadWorldAssets }) => {
        controller.signal.throwIfAborted();
        return loadWorldAssets(bakedTerrain, controller.signal);
      })
      .then((world) => {
        performance.mark('mecha-hangar-world-ready');
        return world;
      })
      .catch((error: unknown) => {
        controller.abort();
        if (request.current?.controller === controller) request.current = null;
        throw error;
      });
    request.current = { controller, assets };
    return assets;
  }, [bakedTerrain]);

  useEffect(() => {
    mounted.current = true;
    const cancelPaint = afterPaint(() => {
      performance.mark('mecha-hangar-menu-ready');
      setPreviewEnabled(true);
      // The launch button joins this request, or starts a fresh one after a failed prefetch.
      void prepareWorld().catch(() => {});
    });
    return () => {
      mounted.current = false;
      cancelPaint();
      request.current?.controller.abort();
      request.current = null;
    };
  }, [prepareWorld]);

  useEffect(() => {
    if (phase === 'loading' || phase === 'scene') transferStatus.current?.focus();
    if (phase === 'error') playButton.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (!preparedBattle) return;
    // Give the scene status a paint and release the preview before creating the map canvas.
    return afterPaint(() => {
      performance.mark('mecha-hangar-scene-start');
      setBattle(preparedBattle);
    });
  }, [preparedBattle]);

  const handleLaunchError = useCallback(() => {
    launchPending.current = false;
    setPreparedBattle(undefined);
    setBattle(undefined);
    setPhase('error');
  }, []);

  const handleFirstFrame = useCallback(() => {
    setPhase('battle');
  }, []);

  async function enterBattle() {
    if (launchPending.current) return;
    launchPending.current = true;
    performance.mark('mecha-hangar-enter-battle');
    setPhase('loading');
    try {
      const [{ default: Game }, world] = await Promise.all([import('../App'), prepareWorld()]);
      if (!mounted.current) return;
      setPhase('scene');
      setPreparedBattle({ Game, world });
    } catch {
      if (mounted.current) handleLaunchError();
    }
  }

  const transferring = phase === 'loading' || phase === 'scene';
  const Game = battle?.Game;
  return (
    <>
      {Game && battle && (
        <div className="absolute inset-0" inert={phase !== 'battle'}>
          <StartupErrorBoundary onError={handleLaunchError}>
            <Game world={battle.world} startInDriveMode onFirstControllableFrame={handleFirstFrame} />
          </StartupErrorBoundary>
        </div>
      )}
      {phase !== 'battle' && (
        <main className="hangar" aria-label="Ангар" onKeyDown={phase === 'scene' ? (event) => event.stopPropagation() : undefined}>
          <div className="hangar-layout">
            <section className="hangar-brief">
              <h1>Ангар</h1>
              <p className="hangar-model">Мех Т2-042</p>
              <button
                ref={playButton}
                className="hangar-play"
                type="button"
                onClick={enterBattle}
                disabled={transferring}
              >
                {phase === 'error' ? 'Повторить' : 'В бой'}
              </button>
              <div className="hangar-status" ref={transferStatus} tabIndex={-1} role="status" aria-live="polite">
                {phase === 'loading' && 'Загружаем карту…'}
                {phase === 'scene' && 'Готовим сцену…'}
              </div>
              {phase === 'error' && <p className="hangar-error" role="alert">Не удалось подготовить карту.</p>}
            </section>
            <div className="hangar-stage">
              <img className="hangar-poster" src={poster} alt="Мех Т2-042 на платформе ангара" fetchPriority="high" />
              {previewEnabled && (phase === 'hangar' || phase === 'error') && (
                <StartupErrorBoundary>
                  <Suspense fallback={null}>
                    <HangarPreview />
                  </Suspense>
                </StartupErrorBoundary>
              )}
            </div>
          </div>
        </main>
      )}
    </>
  );
}
