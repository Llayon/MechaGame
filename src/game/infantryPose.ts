import type { InfantrySoldier } from './infantrySkirmishes';

// The shot starts at the muzzle-flash frame of the 30 fps V-Pulse fire clip.
export const INFANTRY_FIRE_RECOVERY = (35 - 4) / 30;
export type InfantryPose = 'run' | 'fire' | 'crouch' | 'idle';

export function getInfantryPose(soldier: InfantrySoldier, elapsed: number): InfantryPose {
  if (soldier.moving) return 'run';
  const sinceShot = elapsed - soldier.lastShotAt;
  if (sinceShot >= 0 && sinceShot < INFANTRY_FIRE_RECOVERY) return 'fire';
  return soldier.inCover ? 'crouch' : 'idle';
}
