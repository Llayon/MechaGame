import { useEffect, useRef, useState } from 'react';
import { createHangarViewer, type Pylon } from './hangarViewer';
import { WEAPONS } from './weaponCatalog';

const stockLabels = { left: 'Ракетный блок', right: 'Автопушка' };
const labels = { left: 'Левый пилон', right: 'Правый пилон' };
type Viewer = Awaited<ReturnType<typeof createHangarViewer>>;

function PylonSelect({ side, viewer }: { side: Pylon; viewer: Viewer | null }) {
  const [selected, setSelected] = useState('stock');
  const [installed, setInstalled] = useState('stock');
  const [status, setStatus] = useState<'loading' | 'error'>();
  const sequence = useRef(0);

  async function selectWeapon(id: string) {
    if (!viewer) return;
    const attempt = ++sequence.current;
    const isCurrent = () => attempt === sequence.current;
    setSelected(id);
    setStatus('loading');
    try {
      const modulePath = WEAPONS.find((weapon) => weapon.id === id)?.module;
      if (await viewer.setWeapon(side, modulePath, isCurrent) && isCurrent()) {
        setInstalled(id);
        setStatus(undefined);
      }
    } catch {
      if (isCurrent()) {
        setSelected(installed);
        setStatus('error');
      }
    }
  }

  return (
    <label>
      {labels[side]}
      <select
        disabled={!viewer}
        value={selected}
        aria-busy={status === 'loading'}
        onChange={(event) => void selectWeapon(event.target.value)}
      >
        <option value="stock">{stockLabels[side]}</option>
        {WEAPONS.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.title}</option>)}
      </select>
      <span className="hangar-pylon-status" aria-live="polite">
        {status === 'loading' && 'Устанавливаем…'}
        {status === 'error' && 'Не удалось загрузить модель.'}
      </span>
    </label>
  );
}

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
    <div className="hangar-viewer">
      <div className="hangar-canvas" ref={container} style={{ visibility: ready && !failed ? 'visible' : 'hidden' }} />
      <div className="hangar-pylons" role="group" aria-label="Примерка оружия">
        <PylonSelect side="left" viewer={ready ? viewer : null} />
        <PylonSelect side="right" viewer={ready ? viewer : null} />
        <p role="status">{failed ? '3D-просмотр недоступен.' : ready ? 'Примерка оружия' : 'Готовим 3D-модель…'}</p>
      </div>
    </div>
  );
}
