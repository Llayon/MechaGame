import { INFANTRY_PER_SITE, INFANTRY_SITES, getInfantryPost, getInfantrySlot, getInfantrySquad } from '../map/infantryEncounters';
import { getWalkableSurfaceY } from '../map/mechKinematics';
import { hasLineOfSight } from '../map/worldRaycaster';

export type InfantrySide = 'friendly' | 'enemy';
export type InfantryRole = 'rifleman' | 'patrol' | 'guard' | 'spotter';
interface Position { x: number; y: number; z: number }
const { friendly: FRIENDLIES, enemy: ENEMIES } = INFANTRY_PER_SITE;
const SITE_SIZE = FRIENDLIES + ENEMIES;
const STEP = 1 / 20;
const MAX_HP = 12;
const SUPPORT_RADIUS = 48;
const MECH_RIFLE_RANGE = 16;

export interface InfantrySoldier extends Position {
  id: number;
  siteIndex: number;
  side: InfantrySide;
  role: InfantryRole;
  squadIndex: number;
  designating: boolean;
  inCover: boolean;
  yaw: number;
  hp: number;
  moving: boolean;
  lastShotAt: number;
  targetId: number;
  shotTargetX: number;
  shotTargetY: number;
  shotTargetZ: number;
  route: readonly [Position, Position];
  cover: Position;
  destination: 0 | 1;
  holdUntil: number;
  nextShotAt: number;
  aimAtMechUntil: number;
  seed: number;
}

export interface InfantrySkirmishes {
  elapsed: number;
  remainder: number;
  soldiers: InfantrySoldier[];
  sites: {
    friendlyAlive: number;
    enemyAlive: number;
    alarmRaised: boolean;
    spotterContact: boolean;
    nextScanAt: number;
    nextMechShotAt: number;
    nextShooter: number;
  }[];
}

// Independent streams keep all five encounters reproducible across mission restarts.
function random(soldier: InfantrySoldier): number {
  soldier.seed = (Math.imul(soldier.seed, 1664525) + 1013904223) >>> 0;
  return soldier.seed / 4294967296;
}

function grounded({ x, z }: { x: number; z: number }): Position {
  return { x, z, y: getWalkableSurfaceY(x, z).y };
}

function deployment(site: typeof INFANTRY_SITES[number], side: InfantrySide, index: number) {
  if (side === 'friendly') {
    const start = grounded(getInfantrySlot(site, side, index));
    const advance = grounded({ x: start.x + Math.sin(site.yaw), z: start.z + Math.cos(site.yaw) });
    return { role: 'rifleman' as const, squadIndex: Math.floor(index / 5),
      route: [start, advance] as const, cover: start };
  }
  const { squadIndex, memberIndex } = getInfantrySquad(index);
  const role: InfantryRole = squadIndex < 3 ? 'patrol' : squadIndex === 6 && memberIndex < 2 ? 'spotter' : 'guard';
  const { patrol, cover } = getInfantryPost(site, squadIndex, memberIndex);
  return { role, squadIndex, route: [grounded(patrol[0]), grounded(patrol[1])] as const, cover: grounded(cover) };
}

export function createInfantrySkirmishes(): InfantrySkirmishes {
  const soldiers: InfantrySoldier[] = [];
  for (const [siteIndex, site] of INFANTRY_SITES.entries()) {
    for (let slot = 0; slot < SITE_SIZE; slot++) {
      const friendly = slot < FRIENDLIES;
      const side = friendly ? 'friendly' : 'enemy';
      const post = deployment(site, side, friendly ? slot : slot - FRIENDLIES);
      const { x, y, z } = post.route[0];
      const id = soldiers.length;
      const soldier: InfantrySoldier = {
        ...post, id, siteIndex, side, x, y, z, yaw: site.yaw + (friendly ? 0 : Math.PI),
        hp: MAX_HP, moving: false, designating: false, inCover: false, targetId: -1,
        lastShotAt: -Infinity, shotTargetX: x, shotTargetY: y, shotTargetZ: z,
        destination: 1, holdUntil: 0, nextShotAt: 0, aimAtMechUntil: 0,
        seed: Math.imul(id + 1, 2654435761) >>> 0,
      };
      soldier.holdUntil = friendly ? 0.3 + 5 * random(soldier) : 0.4 + 1.3 * post.squadIndex;
      soldier.nextShotAt = 0.4 + 2.1 * random(soldier);
      soldiers.push(soldier);
    }
  }
  return {
    soldiers, elapsed: 0, remainder: 0,
    sites: INFANTRY_SITES.map((_, i) => ({
      friendlyAlive: FRIENDLIES, enemyAlive: ENEMIES, alarmRaised: false, spotterContact: false,
      nextScanAt: i * 0.12, nextMechShotAt: 0, nextShooter: 0,
    })),
  };
}

export function damageInfantrySoldier(
  state: InfantrySkirmishes, soldier: InfantrySoldier, damage: number,
): void {
  if (soldier.hp <= 0 || !(damage > 0)) return;
  soldier.hp = Math.max(0, soldier.hp - damage);
  if (soldier.hp > 0) return;
  soldier.moving = false;
  soldier.targetId = -1;
  const site = state.sites[soldier.siteIndex];
  if (soldier.side === 'friendly') site.friendlyAlive--;
  else site.enemyAlive--;
  if (site.enemyAlive === 0) site.alarmRaised = false;
  if (soldier.designating) {
    soldier.designating = false;
    site.spotterContact = state.soldiers.some(s => s.siteIndex === soldier.siteIndex && s.designating);
  }
}

// Armor reads the radio net for its local area. Direct visual contact and a
// previously broadcast alarm have different lifetimes.
export function getInfantrySupport(state: InfantrySkirmishes, x: number, z: number) {
  let alarmRaised = false;
  let spotterContact = false;
  for (const [i, site] of INFANTRY_SITES.entries()) {
    if ((site.x - x) ** 2 + (site.z - z) ** 2 > SUPPORT_RADIUS ** 2) continue;
    alarmRaised ||= state.sites[i].alarmRaised;
    spotterContact ||= state.sites[i].spotterContact;
  }
  return { alarmRaised, spotterContact };
}

function scanForMech(state: InfantrySkirmishes, index: number, mech: Position | undefined) {
  const site = state.sites[index];
  if (state.elapsed < site.nextScanAt || site.enemyAlive === 0) return;
  site.nextScanAt = state.elapsed + 0.75;
  site.spotterContact = false;
  const start = index * SITE_SIZE + FRIENDLIES;
  for (let i = start; i < start + ENEMIES; i++) {
    const soldier = state.soldiers[i];
    if (soldier.hp <= 0 || (site.alarmRaised && soldier.role !== 'spotter')) continue;
    soldier.designating = false;
    if (!mech) continue;
    const range = soldier.role === 'spotter' ? 40 : 23;
    if ((mech.x - soldier.x) ** 2 + (mech.z - soldier.z) ** 2 > range ** 2) continue;
    if (!hasLineOfSight(soldier.x, soldier.y + 0.42, soldier.z, mech.x, mech.y + 2.3, mech.z)) continue;
    site.alarmRaised = true;
    if (soldier.role === 'spotter') {
      soldier.designating = true;
      site.spotterContact = true;
    }
  }
}

function acquireTarget(state: InfantrySkirmishes, soldier: InfantrySoldier): InfantrySoldier | undefined {
  const previous = state.soldiers[soldier.targetId];
  if (previous && previous.hp > 0) return previous;
  const friendly = soldier.side === 'friendly';
  const start = soldier.siteIndex * SITE_SIZE + (friendly ? FRIENDLIES : 0);
  const count = friendly ? ENEMIES : FRIENDLIES;
  const offset = Math.floor(random(soldier) * count);
  for (let i = 0; i < count; i++) {
    const target = state.soldiers[start + (offset + i) % count];
    if (target.hp > 0) {
      soldier.targetId = target.id;
      return target;
    }
  }
  soldier.targetId = -1;
}

function moveTowards(soldier: InfantrySoldier, goal: Position, speed: number): boolean {
  const dx = goal.x - soldier.x;
  const dz = goal.z - soldier.z;
  const distance = Math.hypot(dx, dz);
  const fraction = distance > 0 ? Math.min(1, STEP * speed / distance) : 1;
  soldier.moving = fraction < 1;
  if (soldier.moving) soldier.yaw = Math.atan2(dx, dz);
  soldier.x += dx * fraction;
  soldier.y += (goal.y - soldier.y) * fraction;
  soldier.z += dz * fraction;
  return fraction === 1;
}

function updatePosition(soldier: InfantrySoldier, time: number, alarm: boolean, hasOpponent: boolean) {
  soldier.moving = false;
  if (soldier.side === 'enemy' && alarm) {
    if (!soldier.inCover) soldier.inCover = moveTowards(soldier, soldier.cover, 1.4);
    return;
  }
  if (time < soldier.holdUntil) return;
  if (soldier.role !== 'patrol' && !(soldier.role === 'rifleman' && hasOpponent)) return;
  if (moveTowards(soldier, soldier.route[soldier.destination], 0.75)) {
    soldier.destination = soldier.destination === 1 ? 0 : 1;
    // Equal route spacing and dwell time keep patrol squad members together.
    soldier.holdUntil = time + (soldier.role === 'patrol' ? 4 : 9 + 14 * random(soldier));
  }
}

function engageMech(state: InfantrySkirmishes, siteIndex: number, mech: Position, onHit?: (damage: number) => void) {
  const site = state.sites[siteIndex];
  if (!site.alarmRaised || state.elapsed < site.nextMechShotAt) return;
  site.nextMechShotAt = state.elapsed + 0.5;
  const start = siteIndex * SITE_SIZE + FRIENDLIES;
  // Rotate the sentry on watch. Test at most one line of fire per opportunity.
  for (let i = 0; i < ENEMIES; i++) {
    const slot = site.nextShooter;
    site.nextShooter = (slot + 1) % ENEMIES;
    const s = state.soldiers[start + slot];
    if (s.hp <= 0 || !s.inCover || s.role === 'spotter' || state.elapsed < s.nextShotAt) continue;
    if ((s.x - mech.x) ** 2 + (s.z - mech.z) ** 2 > MECH_RIFLE_RANGE ** 2) continue;
    if (!hasLineOfSight(s.x, s.y + 0.35, s.z, mech.x, mech.y + 1.9, mech.z)) return;
    s.targetId = -1;
    s.yaw = Math.atan2(mech.x - s.x, mech.z - s.z);
    s.lastShotAt = state.elapsed;
    s.shotTargetX = mech.x;
    s.shotTargetY = mech.y + 1.9;
    s.shotTargetZ = mech.z;
    s.aimAtMechUntil = state.elapsed + 0.4;
    s.nextShotAt = state.elapsed + 2;
    site.nextMechShotAt = state.elapsed + (site.friendlyAlive ? 7 : 4);
    onHit?.(1);
    return;
  }
}

function tick(state: InfantrySkirmishes, mech?: Position, onMechHit?: (damage: number) => void): number | null {
  state.elapsed += STEP;
  let newAlarm: number | null = null;
  for (let i = 0; i < state.sites.length; i++) {
    const alreadyRaised = state.sites[i].alarmRaised;
    scanForMech(state, i, mech);
    if (!alreadyRaised && state.sites[i].alarmRaised) newAlarm ??= i;
    if (mech) engageMech(state, i, mech, onMechHit);
  }
  for (const soldier of state.soldiers) {
    if (soldier.hp <= 0) continue;
    const site = state.sites[soldier.siteIndex];
    const hasOpponent = (soldier.side === 'friendly' ? site.enemyAlive : site.friendlyAlive) > 0;
    updatePosition(soldier, state.elapsed, site.alarmRaised, hasOpponent);
    if (state.elapsed < soldier.aimAtMechUntil) continue;
    if (soldier.designating && mech) {
      soldier.targetId = -1;
      soldier.yaw = Math.atan2(mech.x - soldier.x, mech.z - soldier.z);
      continue;
    }
    if (!hasOpponent) { soldier.targetId = -1; continue; }
    const target = acquireTarget(state, soldier);
    if (!target || soldier.moving) continue;
    soldier.yaw = Math.atan2(target.x - soldier.x, target.z - soldier.z);
    if (state.elapsed < soldier.nextShotAt) continue;
    soldier.nextShotAt = state.elapsed + 1.8 + 2.2 * random(soldier);
    if (!hasLineOfSight(soldier.x, soldier.y + 0.35, soldier.z, target.x, target.y + 0.32, target.z)) {
      soldier.targetId = -1;
      continue;
    }
    soldier.lastShotAt = state.elapsed;
    soldier.shotTargetX = target.x;
    soldier.shotTargetY = target.y + 0.32;
    soldier.shotTargetZ = target.z;
    const chance = soldier.side === 'friendly' ? 0.36 : 0.16;
    if (random(soldier) < chance) damageInfantrySoldier(state, target, 1);
  }
  return newAlarm;
}

export function stepInfantrySkirmishes(
  state: InfantrySkirmishes, delta: number, mech?: Position, onMechHit?: (damage: number) => void,
): number | null {
  if (!Number.isFinite(delta) || delta <= 0) return null;
  let newAlarm: number | null = null;
  state.remainder += Math.min(delta, 0.25);
  while (state.remainder >= STEP - 1e-9) {
    state.remainder = Math.max(0, state.remainder - STEP);
    const alarm = tick(state, mech, onMechHit);
    newAlarm ??= alarm;
  }
  return newAlarm;
}
