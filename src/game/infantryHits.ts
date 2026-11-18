import { damageInfantrySoldier, type InfantrySkirmishes, type InfantrySoldier } from './infantrySkirmishes';

// World-space radii of the standing and crouched body poses.
const STANDING_HALF_HEIGHT = 0.24;
const CROUCHING_HALF_HEIGHT = 0.17;
const BODY_RADIUS = 0.12;

export function traceHostileInfantry(
  infantry: InfantrySkirmishes, ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number, limit: number,
): { soldier: InfantrySoldier; distance: number } | null {
  // Scale Y so the ray/ellipsoid intersection reduces to a ray/sphere test.
  const horizontalLengthSq = dx * dx + dz * dz;
  if (horizontalLengthSq + dy * dy < 1e-9) return null;
  let closest = limit;
  let target: InfantrySoldier | null = null;
  for (const soldier of infantry.soldiers) {
    if (soldier.side !== 'enemy' || soldier.hp <= 0) continue;
    const halfHeight = soldier.inCover ? CROUCHING_HALF_HEIGHT : STANDING_HALF_HEIGHT;
    const yScale = BODY_RADIUS / halfHeight;
    const rayY = dy * yScale;
    const a = horizontalLengthSq + rayY * rayY;
    const x = ox - soldier.x;
    const y = (oy - soldier.y - halfHeight) * yScale;
    const z = oz - soldier.z;
    const b = x * dx + y * rayY + z * dz;
    const c = x * x + y * y + z * z - BODY_RADIUS * BODY_RADIUS;
    if (b >= 0 && c > 0) continue;
    const discriminant = b * b - a * c;
    if (discriminant < 0) continue;
    const entry = Math.max(0, (-b - Math.sqrt(discriminant)) / a);
    if (entry < closest) {
      closest = entry;
      target = soldier;
    }
  }
  return target && { soldier: target, distance: closest };
}

export function damageInfantryInBlast(
  infantry: InfantrySkirmishes, x: number, y: number, z: number, radius: number, damage: number,
): boolean {
  let hit = false;
  for (const soldier of infantry.soldiers) {
    if (soldier.side !== 'enemy' || soldier.hp <= 0) continue;
    const halfHeight = soldier.inCover ? CROUCHING_HALF_HEIGHT : STANDING_HALF_HEIGHT;
    const distance = Math.hypot(soldier.x - x, soldier.y + halfHeight - y, soldier.z - z);
    if (distance > radius) continue;
    damageInfantrySoldier(infantry, soldier, damage * (1 - 0.5 * distance / radius));
    hit = true;
  }
  return hit;
}
