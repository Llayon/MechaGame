import { damageInfantrySoldier, type InfantrySkirmishes, type InfantrySoldier } from './infantrySkirmishes';
import { getInfantryPose, type InfantryPose } from './infantryPose';

// Local +Z faces down the rifle. Dimensions follow the baked skin and omit the rifle.
type BodyPart = readonly [x: number, y: number, z: number, radius: number, halfHeight: number];
const standing: readonly BodyPart[] = [
  [0, .125, .014, .127, .14], [0, .31, .035, .13, .127], [0, .422, .03, .075, .067],
];
const volumes: Record<InfantryPose, readonly BodyPart[]> = {
  idle: standing,
  fire: standing,
  run: [[0, .125, .012, .14, .14], [0, .305, .055, .132, .13], [0, .411, .067, .075, .067]],
  crouch: [[-.02, .08, .012, .145, .094], [-.029, .179, .055, .13, .116], [-.034, .269, .078, .074, .063]],
};

export function traceHostileInfantry(
  infantry: InfantrySkirmishes, ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number, limit: number,
): { soldier: InfantrySoldier; distance: number } | null {
  const horizontalLengthSq = dx * dx + dz * dz;
  const lengthSq = horizontalLengthSq + dy * dy;
  if (lengthSq < 1e-9 || limit <= 0) return null;
  let closest = limit;
  let target: InfantrySoldier | null = null;
  for (const soldier of infantry.soldiers) {
    if (soldier.side !== 'enemy' || soldier.hp <= 0) continue;
    // A sphere encloses every pose, skipping pose and part math for distant misses.
    const rx = ox - soldier.x, ry = oy - soldier.y - .24, rz = oz - soldier.z;
    const near = Math.min(closest, Math.max(0, -(rx * dx + ry * dy + rz * dz) / lengthSq));
    if ((rx + near * dx) ** 2 + (ry + near * dy) ** 2 + (rz + near * dz) ** 2 > .34 ** 2) continue;
    const cos = Math.cos(soldier.yaw), sin = Math.sin(soldier.yaw);
    for (const [px, py, pz, radius, halfHeight] of volumes[getInfantryPose(soldier, infantry.elapsed)]) {
      // Rotate the local offset into the world. Scale Y to solve each ellipsoid as a sphere.
      const x = rx - px * cos - pz * sin;
      const z = rz + px * sin - pz * cos;
      const scaleY = radius / halfHeight;
      const y = (oy - soldier.y - py) * scaleY;
      const rayY = dy * scaleY;
      const a = horizontalLengthSq + rayY * rayY;
      const b = x * dx + y * rayY + z * dz;
      const c = x * x + y * y + z * z - radius * radius;
      if (b >= 0 && c > 0) continue;
      const discriminant = b * b - a * c;
      if (discriminant < 0) continue;
      const entry = Math.max(0, (-b - Math.sqrt(discriminant)) / a);
      if (entry < closest) {
        closest = entry;
        target = soldier;
      }
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
    const halfHeight = getInfantryPose(soldier, infantry.elapsed) === 'crouch' ? .17 : .24;
    const distance = Math.hypot(soldier.x - x, soldier.y + halfHeight - y, soldier.z - z);
    if (distance > radius) continue;
    damageInfantrySoldier(infantry, soldier, damage * (1 - 0.5 * distance / radius));
    hit = true;
  }
  return hit;
}
