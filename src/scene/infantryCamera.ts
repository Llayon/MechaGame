import { Box3, MathUtils, Vector3 } from 'three';
import type { InfantrySoldier } from '../game/infantrySkirmishes';
import { hasLineOfSight } from '../map/worldRaycaster';

const chest = (s: InfantrySoldier) => new Vector3(s.x, s.y + 0.28, s.z);
const center = (points: Vector3[]) => new Box3().setFromPoints(points).getCenter(new Vector3());

/** Frame the nearest pair of opposing squads. Their other posts can span an entire bridge. */
export function frameInfantryEncounter(
  troops: InfantrySoldier[], siteIndex: number, aspect: number, fov: number,
  sun: readonly [number, number, number],
) {
  const local = troops.filter(s => s.siteIndex === siteIndex);
  const living = local.filter(s => s.hp > 0);
  const participants = living.length ? living : local;
  const allies = participants.filter(s => s.side === 'friendly');
  const anchor = allies.length ? allies : participants.filter(s => s.squadIndex === participants[0].squadIndex);
  const points = anchor.map(chest);
  const a = center(points);
  const opponents = participants.filter(s => s.side !== anchor[0].side)
    .sort((u, v) => chest(u).distanceToSquared(a) - chest(v).distanceToSquared(a));
  const nearest = opponents.find(s => hasLineOfSight(a.x, a.y, a.z, s.x, s.y + 0.28, s.z)) ?? opponents[0];
  const b = nearest ? chest(nearest) : a.clone().add(new Vector3(1, 0, 0));
  if (nearest) points.push(...opponents.filter(s => s.squadIndex === nearest.squadIndex).map(chest));
  const target = center(points);

  // Present the fight across the screen, with its lit side towards the viewer.
  const side = new Vector3(b.z - a.z, 0, a.x - b.x).normalize();
  if (side.x * sun[0] + side.z * sun[2] < 0) side.negate();
  const tangent = Math.tan(MathUtils.degToRad(fov * 0.5));
  const width = aspect < 1 ? 0.78 : 0.5;
  const position = new Vector3();
  for (const [sign, elevation] of [[1, 1], [-1, 1], [1, 3.5]]) {
    const backward = new Vector3(side.x * sign, elevation, side.z * sign).normalize();
    const right = new Vector3(backward.z, 0, -backward.x).normalize();
    const up = new Vector3().crossVectors(backward, right);
    let distance = 8.5;
    for (const p of points) {
      const offset = p.clone().sub(target);
      // Keep both formations in the central HUD opening, with room to patrol.
      distance = Math.max(distance, offset.dot(backward) + Math.max(
        (Math.abs(offset.dot(right)) + 0.8) / (tangent * aspect * width),
        (Math.abs(offset.dot(up)) + 0.6) / (tangent * 0.58),
      ));
    }
    position.copy(target).addScaledVector(backward, distance);
    const visible = (p: Vector3) => hasLineOfSight(p.x, p.y, p.z, position.x, position.y, position.z);
    if (elevation > 1 || (visible(a) && visible(b))) break;
  }
  return { target, position };
}
