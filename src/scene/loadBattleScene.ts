export const loadPlayerMech = () => import('./objects/SovietMech');

export async function loadBattleScene() {
  const [{ SovietMech }, actors] = await Promise.all([loadPlayerMech(), import('./battleActors')]);
  return { SovietMech, ...actors };
}

export type BattleScene = Awaited<ReturnType<typeof loadBattleScene>>;
