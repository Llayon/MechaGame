import { useRef, useState } from 'react';
import type { createHangarViewer, Pylon } from './hangarViewer';
import { WEAPONS } from './weaponCatalog';

type Viewer = Awaited<ReturnType<typeof createHangarViewer>>;
const stockLabels = { left: 'Ракетный блок', right: 'Автопушка' };
const labels = { left: 'Левый пилон', right: 'Правый пилон' };

function PylonSelect({ side, viewer }: { side: Pylon; viewer?: Viewer | null }) {
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
      <span className="hangar-select">
        <select disabled={!viewer} value={selected} aria-busy={status === 'loading'}
          onChange={(event) => void selectWeapon(event.target.value)}>
          <option value="stock">{stockLabels[side]}</option>
          {WEAPONS.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.title}</option>)}
        </select>
      </span>
      <span className="hangar-pylon-status" aria-live="polite">
        {status === 'loading' && 'Устанавливаем…'}
        {status === 'error' && 'Не удалось загрузить модель.'}
      </span>
    </label>
  );
}

export function HangarLoadout({ viewer, failed }: { viewer?: Viewer | null; failed?: boolean }) {
  return (
    <div className="hangar-pylons" role="group" aria-label="Примерка оружия">
      <p className="hangar-loadout-title">Примерка оружия</p>
      <PylonSelect side="left" viewer={viewer} />
      <PylonSelect side="right" viewer={viewer} />
      {failed && <p className="hangar-preview-error" role="status">3D-просмотр недоступен.</p>}
    </div>
  );
}
