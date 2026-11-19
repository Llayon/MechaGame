import { useEffect, useRef, useState } from 'react';
import { createHangarViewer } from './hangarViewer';
import { HangarLoadout } from './HangarLoadout';

type Viewer = Awaited<ReturnType<typeof createHangarViewer>>;

export default function HangarPreview() {
  const container = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const controller = new AbortController();
    void createHangarViewer(container.current, controller.signal, () => {
      performance.mark('mecha-hangar-preview-ready');
      setReady(true);
    }).then((created) => {
      if (!controller.signal.aborted) setViewer(created);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, []);

  return (
    <>
      <div className="hangar-canvas" ref={container} style={{ visibility: ready && !failed ? 'visible' : 'hidden' }} />
      {!failed && <p className="hangar-orbit-hint" role="status">
        {ready ? 'Потяните, чтобы повернуть меха' : 'Готовим 3D-модель…'}
      </p>}
      <HangarLoadout viewer={ready ? viewer : null} failed={failed} />
    </>
  );
}
