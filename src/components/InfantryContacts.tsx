import { useEffect, useState, type RefObject } from 'react';
import type { CombatSimulationState } from '../game/combatTypes';
import { INFANTRY_SITES, type InfantrySite } from '../map/infantryEncounters';

interface Props {
  combatRef: RefObject<CombatSimulationState>;
  focusedSite: InfantrySite | null;
  onFocus?: (site: InfantrySite) => void;
}

export function InfantryContacts({ combatRef, focusedSite, onFocus }: Props) {
  const read = () => combatRef.current.infantry.sites.map(site => ({
    friendly: site.friendlyAlive, enemy: site.enemyAlive, spotted: site.spotterContact,
  }));
  const [counts, setCounts] = useState(read);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = read();
      setCounts(old => next.some((n, i) => n.friendly !== old[i].friendly ||
        n.enemy !== old[i].enemy || n.spotted !== old[i].spotted) ? next : old);
    }, 250);
    return () => window.clearInterval(timer);
  }, [combatRef]);
  const index = focusedSite ? INFANTRY_SITES.indexOf(focusedSite) : -1;
  const friendly = counts.reduce((sum, site) => sum + site.friendly, 0);
  const enemy = counts.reduce((sum, site) => sum + site.enemy, 0);
  return (
    <div className="mt-1.5 text-[11px] text-slate-300">
      <div className="flex justify-between gap-2">
        <span>Пехота</span>
        <span><b className="text-sky-300">{friendly}</b> своих · <b className="text-orange-300">{enemy}</b> противников</span>
      </div>
      {onFocus && <div className="mt-1 flex gap-1" aria-label="Точки столкновения пехоты">
        {INFANTRY_SITES.map((site, i) => (
          <button key={site.id} type="button" onClick={() => onFocus(site)}
            aria-label={`Пехота · ${site.label}`} aria-pressed={index === i}
            title={`${site.label} · ${counts[i].friendly} своих, ${counts[i].enemy} противников`}
            className="flex-1 rounded border border-slate-600 py-1 text-slate-200 hover:border-amber-400 aria-pressed:border-amber-400 aria-pressed:text-amber-300">
            {i + 1}
          </button>
        ))}
      </div>}
      {index >= 0 && onFocus && <div className="mt-1">{focusedSite?.label} · {counts[index].friendly} × {counts[index].enemy}</div>}
      {counts.some(site => site.spotted) && <div className="mt-1 text-amber-300">Вас видит корректировщик</div>}
    </div>
  );
}
