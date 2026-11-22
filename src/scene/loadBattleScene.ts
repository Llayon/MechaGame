export const loadPlayerBattleEntry = () => import('./playerBattleEntry');

export async function loadBattleScene() {
  const [player, actors] = await Promise.all([loadPlayerBattleEntry(), import('./battleActors')]);
  return { ...player, ...actors };
}

export type BattleScene = Awaited<ReturnType<typeof loadBattleScene>>;
