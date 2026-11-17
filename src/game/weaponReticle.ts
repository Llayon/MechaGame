import { castCombatRay } from '../map/worldRaycaster';
import { BARREL_HIT_RADIUS, ENEMY_CONFIGS, PLAYER_MAX_RANGE, isEnemyAlive } from './combatSimulation';
import type { CombatSimulationState } from './combatTypes';

export interface PredictedPhysicalImpact {
  distance: number;
  hit: 'enemy' | 'barrel' | 'cover' | 'range';
}

/**
 * Deterministic non-mutating forecast of the SAME muzzle ray used by manual
 * 37-mm/105-mm gameplay; the reticle never uses aim assist or camera center.
 * Match physical enemy/barrel hit spheres and nearest world-cover occlusion.
 */
export function predictPhysicalShotEndpoint(
  state: Readonly<CombatSimulationState>,
  muzzleX: number, muzzleY: number, muzzleZ: number,
  dirX: number, dirY: number, dirZ: number,
): PredictedPhysicalImpact {
  const n = Math.hypot(dirX, dirY, dirZ);
  if (!Number.isFinite(n) || n < 0.0001) return { distance: 0, hit: 'range' };
  const dx = dirX / n, dy = dirY / n, dz = dirZ / n;
  const cover = castCombatRay(muzzleX, muzzleY, muzzleZ, dx, dy, dz, PLAYER_MAX_RANGE);
  let closest = cover?.distance ?? PLAYER_MAX_RANGE;
  let kind: PredictedPhysicalImpact['hit'] = cover ? 'cover' : 'range';

  const sphereEntry = (cx: number, cy: number, cz: number, radius: number) => {
    const rx = cx - muzzleX, ry = cy - muzzleY, rz = cz - muzzleZ;
    const along = rx * dx + ry * dy + rz * dz;
    if (along < -radius || along > closest + radius) return null;
    const distSq = rx * rx + ry * ry + rz * rz - along * along;
    if (distSq > radius * radius) return null;
    return Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - distSq)));
  };

  for (const e of state.enemies) {
    if (!isEnemyAlive(e)) continue;
    const cfg = ENEMY_CONFIGS[e.archetype];
    const distance = sphereEntry(e.x, e.y + cfg.hitCenterYOffset, e.z, cfg.hitRadius);
    if (distance !== null && distance < closest) {
      closest = distance;
      kind = 'enemy';
    }
  }
  for (const barrel of state.barrels) {
    if (barrel.destroyed) continue;
    const distance = sphereEntry(barrel.x, barrel.y + 0.95, barrel.z, BARREL_HIT_RADIUS);
    if (distance !== null && distance < closest) {
      closest = distance;
      kind = 'barrel';
    }
  }
  return { distance: closest, hit: kind };
}
