import { castCombatRay } from '../map/worldRaycaster';
import { traceHostileInfantry } from './infantryHits';
import type { InfantryRole } from './infantrySkirmishes';
import { BARREL_HIT_RADIUS, ENEMY_CONFIGS, PLAYER_MAX_RANGE, isEnemyAlive } from './combatSimulation';
import type { CombatSimulationState } from './combatTypes';
import type { Vector3 } from 'three';
import { aimDirection } from './combatAim';

export interface PredictedPhysicalImpact {
  distance: number;
  hit: 'enemy' | 'barrel' | 'cover' | 'range';
  targetId?: string;
  infantryRole?: InfantryRole;
}

/**
 * Find the nearest physical contact along a sight or muzzle ray, including world cover.
 */
export function predictPhysicalShotEndpoint(
  state: Readonly<CombatSimulationState>,
  muzzleX: number, muzzleY: number, muzzleZ: number,
  dirX: number, dirY: number, dirZ: number,
  maxDistance = PLAYER_MAX_RANGE,
): PredictedPhysicalImpact {
  const n = Math.hypot(dirX, dirY, dirZ);
  if (!Number.isFinite(n) || n < 0.0001) return { distance: 0, hit: 'range' };
  const dx = dirX / n, dy = dirY / n, dz = dirZ / n;
  const cover = castCombatRay(muzzleX, muzzleY, muzzleZ, dx, dy, dz, maxDistance);
  let closest = cover?.distance ?? maxDistance;
  let kind: PredictedPhysicalImpact['hit'] = cover ? 'cover' : 'range';
  let targetId: string | null = null;

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
      targetId = e.id;
    }
  }
  for (const barrel of state.barrels) {
    if (barrel.destroyed) continue;
    const distance = sphereEntry(barrel.x, barrel.y + 0.95, barrel.z, BARREL_HIT_RADIUS);
    if (distance !== null && distance < closest) {
      closest = distance;
      kind = 'barrel';
      targetId = barrel.id;
    }
  }
  const infantry = traceHostileInfantry(state.infantry, muzzleX, muzzleY, muzzleZ, dx, dy, dz, closest);
  if (infantry) {
    return { distance: infantry.distance, hit: 'enemy', targetId: `infantry-${infantry.soldier.id}`,
      infantryRole: infantry.soldier.role };
  }
  return { distance: closest, hit: kind, ...(targetId ? { targetId } : {}) };
}

/** Range the camera sight along the direction the turret has actually traversed to. */
export function resolveGunSightPoint(
  state: CombatSimulationState, eye: Vector3, yaw: number, elevation: number,
  cameraToMech: number, out: Vector3,
): Vector3 {
  const [dx, dy, dz] = aimDirection(yaw, elevation);
  const hit = predictPhysicalShotEndpoint(state, eye.x, eye.y, eye.z, dx, dy, dz,
    PLAYER_MAX_RANGE + cameraToMech);
  // Aim just inside a contacted body so rounding at its surface cannot lose the hit.
  const depth = hit.distance + (hit.hit === 'enemy' || hit.hit === 'barrel' ? 0.01 : 0);
  return out.set(eye.x + dx * depth, eye.y + dy * depth, eye.z + dz * depth);
}
