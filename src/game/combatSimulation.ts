import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  METERS_PER_UNIT,
  clamp,
} from '../map/terrainMath';
import { MECH_SPAWN, getWalkableSurfaceY } from '../map/mechKinematics';
import { resolveWorldObstacles } from '../map/worldColliders';
import { castCombatRay, hasLineOfSight } from '../map/worldRaycaster';
import type {
  CombatImpactEvent,
  CombatPhase,
  CombatSimulationState,
  CombatTelemetrySnapshot,
  EnemyArchetype,
  EnemyArchetypeConfig,
  EnemyProjectile,
  EnemyUnitState,
  HazardBarrel,
  LockedTargetSnapshot,
  MissionRank,
  SupplyPickup,
} from './combatTypes';

export const PLAYER_MAX_HP = 120;
export const PLAYER_SHELL_DAMAGE = 18;
export const PLAYER_MAX_RANGE = 115;
export const MAX_CONCURRENT_ATTACKERS = 3;
export const DEFEAT_DELAY_SEC = 0.45;
export const KO_DURATION_SEC = 0.42;

export const HEAVY_CANNON_COOLDOWN = 3.2;
export const HEAVY_CANNON_DAMAGE = 68;
export const REPAIR_HEAL_AMOUNT = 45;
export const REPAIR_COOL_AMOUNT = 0.35;
export const REPAIR_COOLDOWN = 12.0;
export const REPAIR_INITIAL_CHARGES = 2;
export const SUPPLY_PICKUP_RADIUS = 3.2;
export const RESERVE_DEPLOY_THRESHOLD = 5;

export const DASH_DURATION = 0.36;
export const DASH_COOLDOWN = 4.5;
export const DASH_DAMAGE_MULT = 0.45;

export const BARREL_HP = 36;
export const BARREL_HIT_RADIUS = 1.15;
export const BARREL_BLAST_RADIUS = 11.5;
export const BARREL_BLAST_DAMAGE = 75;
export const BARREL_BONUS_SCORE = 150;

const BEST_SCORE_STORAGE_KEY = 'sect7_best_score';
const BEST_RANK_STORAGE_KEY = 'sect7_best_rank';
const RANK_ORDER: Record<MissionRank, number> = { S: 4, A: 3, B: 2, C: 1 };

export function loadBestCombatRecord(): number {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return 0;
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestCombatRecord(score: number): void {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.max(0, Math.round(score))));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export function loadBestCombatRank(): MissionRank | null {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
    const raw = window.localStorage.getItem(BEST_RANK_STORAGE_KEY);
    if (raw === 'S' || raw === 'A' || raw === 'B' || raw === 'C') return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveBestCombatRank(rank: MissionRank): void {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    window.localStorage.setItem(BEST_RANK_STORAGE_KEY, rank);
  } catch {
    // Ignore storage errors
  }
}

export function computeMissionRank(state: Readonly<CombatSimulationState>): MissionRank {
  if (state.missionStatus === 'defeat') return 'C';
  const hpRatio = state.playerHp / Math.max(1, state.playerMaxHp);
  const acc = state.shotsFired > 0 ? state.shotsHit / state.shotsFired : 0;
  let pts = 0;
  if (hpRatio >= 0.72) pts += 2;
  else if (hpRatio >= 0.4) pts += 1;
  if (state.elapsedSec <= 165) pts += 2;
  else if (state.elapsedSec <= 240) pts += 1;
  if (acc >= 0.45) pts += 1;
  if (state.score >= 2800) pts += 1;
  if (pts >= 5) return 'S';
  if (pts >= 3) return 'A';
  if (pts >= 2) return 'B';
  return 'C';
}

/**
 * Computes screen-relative clockwise angle (rad) to target (dx, dz) from turret world yaw.
 * 0 = straight ahead, +PI/2 = screen right, -PI/2 = screen left, PI = behind.
 */
export function computeRelativeThreatAngle(
  dx: number,
  dz: number,
  turretWorldYaw: number,
): number {
  const sinY = Math.sin(turretWorldYaw);
  const cosY = Math.cos(turretWorldYaw);
  const fwdDot = dx * sinY + dz * cosY;
  const rightDot = dx * -cosY + dz * sinY;
  return Math.atan2(rightDot, fwdDot);
}

export const ENEMY_CONFIGS: Record<EnemyArchetype, EnemyArchetypeConfig> = {
  'scout-apc': {
    label: 'БТР-разведчик',
    maxHp: 100,
    moveSpeed: 3.4,
    chargeSpeed: 4.2,
    aggroRange: 44,
    preferredRange: 21,
    hitRadius: 1.75,
    hitCenterYOffset: 0.95,
    bodyRadius: 1.05,
    damage: 6,
    windupDuration: 0.35,
    fireCooldown: 1.65,
    burstCount: 2,
    burstInterval: 0.2,
    projectileSpeed: 54,
    scoreValue: 250,
  },
  'denial-turret': {
    label: 'Башенный ДОТ ПТО',
    maxHp: 155,
    moveSpeed: 0,
    chargeSpeed: 0,
    aggroRange: 54,
    preferredRange: 34,
    hitRadius: 2.05,
    hitCenterYOffset: 1.45,
    bodyRadius: 1.5,
    damage: 15,
    windupDuration: 0.6,
    fireCooldown: 2.2,
    burstCount: 1,
    burstInterval: 0.1,
    projectileSpeed: 68,
    scoreValue: 400,
  },
  'charger-walker': {
    label: 'Штурмовик «Каратель»',
    maxHp: 140,
    moveSpeed: 3.1,
    chargeSpeed: 5.1,
    aggroRange: 50,
    preferredRange: 10,
    hitRadius: 1.9,
    hitCenterYOffset: 1.75,
    bodyRadius: 1.15,
    damage: 8,
    windupDuration: 0.45,
    fireCooldown: 1.45,
    burstCount: 3,
    burstInterval: 0.16,
    projectileSpeed: 58,
    scoreValue: 350,
  },
};

interface EnemySpawnSpec {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  patrolPoints: ReadonlyArray<readonly [number, number]>;
  yaw: number;
  strafeDir: -1 | 1;
}

const ENEMY_SPAWN_SPECS: ReadonlyArray<EnemySpawnSpec> = [
  {
    id: 'scout-forefield',
    archetype: 'scout-apc',
    name: 'БТР «Выдра-1»',
    patrolPoints: [
      [-92, 56],
      [-78, 36],
    ],
    yaw: 2.5,
    strafeDir: 1,
  },
  {
    id: 'turret-crossing',
    archetype: 'denial-turret',
    name: 'ДОТ «Заслон-1»',
    patrolPoints: [[-75, 21]],
    yaw: 2.65,
    strafeDir: 1,
  },
  {
    id: 'charger-island',
    archetype: 'charger-walker',
    name: 'Дрон «Каратель-1»',
    patrolPoints: [
      [ISLAND_CENTER_X - 11, ISLAND_CENTER_Z + 9],
      [ISLAND_CENTER_X + 6, ISLAND_CENTER_Z + 12],
    ],
    yaw: -1.35,
    strafeDir: -1,
  },
  {
    id: 'scout-island-east',
    archetype: 'scout-apc',
    name: 'БТР «Выдра-2»',
    patrolPoints: [
      [ISLAND_CENTER_X + 18, ISLAND_CENTER_Z + 3],
      [ISLAND_CENTER_X + 11, ISLAND_CENTER_Z - 14],
    ],
    yaw: -0.9,
    strafeDir: 1,
  },
  {
    id: 'turret-citadel-south',
    archetype: 'denial-turret',
    name: 'ДОТ «Цитадель-Юг»',
    patrolPoints: [[CITADEL_CENTER_X - 9, CITADEL_CENTER_Z + 20]],
    yaw: 3.1,
    strafeDir: -1,
  },
  {
    id: 'charger-citadel-keep',
    archetype: 'charger-walker',
    name: 'Страж «Цитадель-П»',
    patrolPoints: [
      [CITADEL_CENTER_X + 13, CITADEL_CENTER_Z + 5],
      [CITADEL_CENTER_X + 9, CITADEL_CENTER_Z - 14],
    ],
    yaw: -1.6,
    strafeDir: 1,
  },
  {
    id: 'turret-citadel-north',
    archetype: 'denial-turret',
    name: 'Энерготурель Севера',
    patrolPoints: [[CITADEL_CENTER_X - 12, CITADEL_CENTER_Z - 17]],
    yaw: -2.5,
    strafeDir: 1,
  },
];

const CITADEL_RESERVE_SPECS: ReadonlyArray<EnemySpawnSpec> = [
  {
    id: 'charger-reserve',
    archetype: 'charger-walker',
    name: 'Штурмовик «Бастион»',
    patrolPoints: [
      [CITADEL_CENTER_X - 4, CITADEL_CENTER_Z - 20],
      [CITADEL_CENTER_X + 6, CITADEL_CENTER_Z - 4],
    ],
    yaw: -2.4,
    strafeDir: -1,
  },
  {
    id: 'scout-reserve',
    archetype: 'scout-apc',
    name: 'БТР «Шквал»',
    patrolPoints: [
      [CITADEL_CENTER_X + 18, CITADEL_CENTER_Z - 14],
      [CITADEL_CENTER_X + 20, CITADEL_CENTER_Z + 12],
    ],
    yaw: -2.0,
    strafeDir: 1,
  },
];

function createInitialPickups(): SupplyPickup[] {
  const coords: ReadonlyArray<{ id: string; x: number; z: number }> = [
    { id: 'supply-crossing', x: -62, z: 24 },
    { id: 'supply-island', x: 18, z: -14 },
  ];
  return coords.map((c) => ({
    id: c.id,
    x: c.x,
    y: getWalkableSurfaceY(c.x, c.z).y,
    z: c.z,
    healAmount: 30,
    coolAmount: 0.45,
    collected: false,
  }));
}

function createInitialBarrels(): HazardBarrel[] {
  const coords: ReadonlyArray<{ id: string; x: number; z: number }> = [
    { id: 'barrel-crossing', x: -79, z: 25 },
    { id: 'barrel-island-west', x: ISLAND_CENTER_X - 6, z: ISLAND_CENTER_Z + 11 },
    { id: 'barrel-island-east', x: ISLAND_CENTER_X + 15, z: ISLAND_CENTER_Z - 3 },
    { id: 'barrel-citadel', x: CITADEL_CENTER_X + 4, z: CITADEL_CENTER_Z - 12 },
  ];
  return coords.map((c) => ({
    id: c.id,
    x: c.x,
    y: getWalkableSurfaceY(c.x, c.z).y,
    z: c.z,
    hp: BARREL_HP,
    maxHp: BARREL_HP,
    hitFlashTimer: 0,
    destroyed: false,
  }));
}

function createEnemyFromSpec(spec: EnemySpawnSpec, index: number): EnemyUnitState {
  const cfg = ENEMY_CONFIGS[spec.archetype];
  const [sx, sz] = spec.patrolPoints[0];
  const sy = getWalkableSurfaceY(sx, sz).y;
  return {
    id: spec.id,
    archetype: spec.archetype,
    name: spec.name,
    x: sx,
    y: sy,
    z: sz,
    yaw: spec.yaw,
    turretYaw: spec.yaw,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    aiState: 'patrol',
    stateTimer: (index % 3) * 0.4,
    fireCooldownTimer: 0.6 + (index % 2) * 0.35,
    burstRemaining: 0,
    burstTimer: 0,
    hitFlashTimer: 0,
    koTimer: 0,
    patrolPoints: spec.patrolPoints,
    patrolIndex: spec.patrolPoints.length > 1 ? 1 : 0,
    strafeDir: spec.strafeDir,
    hasAttackToken: false,
    hasLineOfSight: false,
    distToPlayer: 999,
    aimTargetX: sx,
    aimTargetY: sy + cfg.hitCenterYOffset,
    aimTargetZ: sz,
    droppedSupply: false,
  };
}

export function createCombatState(startPlaying = false): CombatSimulationState {
  return {
    missionStatus: startPlaying ? 'playing' : 'idle',
    combatPhase: 1,
    reinforcementsDeployed: false,
    alertMessage: null,
    alertTimer: 0,
    elapsedSec: 0,
    playerHp: PLAYER_MAX_HP,
    playerMaxHp: PLAYER_MAX_HP,
    playerHitFlash: 0,
    defeatDelayTimer: 0,
    hitstopTimer: 0,
    trauma: 0,
    weaponHeat: 0,
    weaponOverheated: false,
    heavyCooldownTimer: 0,
    repairCharges: REPAIR_INITIAL_CHARGES,
    repairCooldownTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    hasPlayerEngaged: false,
    score: 0,
    bestScore: loadBestCombatRecord(),
    bestRank: loadBestCombatRank(),
    shotsFired: 0,
    shotsHit: 0,
    hitMarkerTimer: 0,
    nextProjectileId: 1,
    nextPickupId: 3,
    enemies: ENEMY_SPAWN_SPECS.map(createEnemyFromSpec),
    barrels: createInitialBarrels(),
    pickups: createInitialPickups(),
    projectiles: [],
    heavyBeams: [],
    pendingImpacts: [],
  };
}

export function resetCombatState(
  state: CombatSimulationState,
  missionStatus: CombatSimulationState['missionStatus'] = 'playing',
): void {
  state.missionStatus = missionStatus;
  state.combatPhase = 1;
  state.reinforcementsDeployed = false;
  state.alertMessage = null;
  state.alertTimer = 0;
  state.elapsedSec = 0;
  state.playerHp = PLAYER_MAX_HP;
  state.playerMaxHp = PLAYER_MAX_HP;
  state.playerHitFlash = 0;
  state.defeatDelayTimer = 0;
  state.hitstopTimer = 0;
  state.trauma = 0;
  state.weaponHeat = 0;
  state.weaponOverheated = false;
  state.heavyCooldownTimer = 0;
  state.repairCharges = REPAIR_INITIAL_CHARGES;
  state.repairCooldownTimer = 0;
  state.dashTimer = 0;
  state.dashCooldownTimer = 0;
  state.hasPlayerEngaged = false;
  state.score = 0;
  state.bestScore = Math.max(state.bestScore, loadBestCombatRecord());
  state.bestRank = state.bestRank ?? loadBestCombatRank();
  state.shotsFired = 0;
  state.shotsHit = 0;
  state.hitMarkerTimer = 0;
  state.nextProjectileId = 1;
  state.nextPickupId = 3;
  state.enemies = ENEMY_SPAWN_SPECS.map(createEnemyFromSpec);
  state.barrels = createInitialBarrels();
  state.pickups = createInitialPickups();
  state.projectiles = [];
  state.heavyBeams = [];
  state.pendingImpacts = [];
}

/**
 * Computes Three.js gunElevPivot.rotation.x so local +Z barrel points vertically toward target dy at horizDist.
 * Rotating +Z around +X by theta gives (0, -sin(theta), cos(theta)), so theta = -atan2(dy, horizDist).
 */
export function computeGunPitchToTarget(dy: number, horizDist: number): number {
  const safeDist = Math.max(1.0, horizDist);
  return clamp(-Math.atan2(dy, safeDist), -0.36, 0.36);
}

export function isEnemyAlive(enemy: Readonly<EnemyUnitState>): boolean {
  return enemy.hp > 0 && enemy.aiState !== 'ko' && enemy.aiState !== 'destroyed';
}

export interface AimAssistResult {
  enemy: EnemyUnitState | null;
  gunPitch: number;
  horizAngleError: number;
  distance: number;
}

/**
 * Finds the best enemy target inside the Mech turret's horizontal aiming cone with clear line of sight
 * and computes exact gun elevation pitch for crisp keyboard-driven turret aiming.
 */
export function findAimAssistTarget(
  state: Readonly<CombatSimulationState>,
  playerX: number,
  playerY: number,
  playerZ: number,
  turretWorldYaw: number,
  maxConeRad = 0.28,
): AimAssistResult {
  const muzzleOriginY = playerY + 2.3;
  const fwdX = Math.sin(turretWorldYaw);
  const fwdZ = Math.cos(turretWorldYaw);

  let bestEnemy: EnemyUnitState | null = null;
  let bestScore = Infinity;
  let bestAngleErr = Math.PI;
  let bestDist = Infinity;
  let bestPitch = 0.012;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (!isEnemyAlive(e)) continue;

    const cfg = ENEMY_CONFIGS[e.archetype];
    const dx = e.x - playerX;
    const dz = e.z - playerZ;
    const horizDist = Math.hypot(dx, dz);
    if (horizDist > PLAYER_MAX_RANGE || horizDist < 0.8) continue;

    const dot = clamp((dx * fwdX + dz * fwdZ) / horizDist, -1, 1);
    const angleErr = Math.acos(dot);
    if (angleErr > maxConeRad) continue;

    const targetY = e.y + cfg.hitCenterYOffset;
    if (!hasLineOfSight(playerX, muzzleOriginY, playerZ, e.x, targetY, e.z)) continue;

    const score = angleErr * 100 + horizDist * 0.25;
    if (score < bestScore) {
      bestScore = score;
      bestEnemy = e;
      bestAngleErr = angleErr;
      bestDist = horizDist;
      bestPitch = computeGunPitchToTarget(targetY - muzzleOriginY, horizDist);
    }
  }

  return {
    enemy: bestEnemy,
    gunPitch: bestPitch,
    horizAngleError: bestAngleErr,
    distance: bestDist,
  };
}

export interface WorldShotInput {
  muzzleX: number;
  muzzleY: number;
  muzzleZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
}

export interface ShotResolution {
  hitKind: 'enemy' | 'cover' | 'miss';
  hitX: number;
  hitY: number;
  hitZ: number;
  distance: number;
  killedEnemyId?: string;
}

function wrapAngleDiff(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function moveEnemyXZ(
  enemy: EnemyUnitState,
  vx: number,
  vz: number,
  dt: number,
  bodyRadius: number,
): void {
  if (Math.abs(vx) < 1e-5 && Math.abs(vz) < 1e-5) return;
  const nextX = enemy.x + vx * dt;
  const nextZ = enemy.z + vz * dt;
  const resolved = resolveWorldObstacles(nextX, nextZ, enemy.y, bodyRadius);
  const clampedX = clamp(resolved.x, -190, 190);
  const clampedZ = clamp(resolved.z, -156, 156);
  const nextSurf = getWalkableSurfaceY(clampedX, clampedZ, enemy.y);
  // Keep ground units out of deep water channels unless crossing a bridge deck
  if (!nextSurf.onBridge && nextSurf.inWater) {
    return;
  }
  enemy.x = clampedX;
  enemy.z = clampedZ;
  enemy.y = nextSurf.y;
}

function spawnEnemyProjectile(
  state: CombatSimulationState,
  owner: EnemyUnitState,
  targetX: number,
  targetY: number,
  targetZ: number,
): void {
  const cfg = ENEMY_CONFIGS[owner.archetype];
  const ox = owner.x + Math.sin(owner.turretYaw) * 1.15;
  const oy = owner.y + cfg.hitCenterYOffset + 0.15;
  const oz = owner.z + Math.cos(owner.turretYaw) * 1.15;
  const dx = targetX - ox;
  const dy = targetY - oy;
  const dz = targetZ - oz;
  const len = Math.max(0.01, Math.hypot(dx, dy, dz));
  const speed = cfg.projectileSpeed;

  const proj: EnemyProjectile = {
    id: state.nextProjectileId++,
    ownerId: owner.id,
    archetype: owner.archetype,
    x: ox,
    y: oy,
    z: oz,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    vz: (dz / len) * speed,
    damage: cfg.damage,
    life: 0,
    maxLife: 2.3,
    active: true,
  };
  state.projectiles.push(proj);
}

function rayHitsHazardBarrel(
  state: Readonly<CombatSimulationState>,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): boolean {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return false;
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  const cover = castCombatRay(ox, oy, oz, nx, ny, nz, PLAYER_MAX_RANGE);
  const maxD = cover ? cover.distance : PLAYER_MAX_RANGE;
  for (let i = 0; i < state.barrels.length; i++) {
    const b = state.barrels[i];
    if (b.destroyed) continue;
    const bx = b.x - ox;
    const by = b.y + 0.95 - oy;
    const bz = b.z - oz;
    const proj = bx * nx + by * ny + bz * nz;
    if (proj < -BARREL_HIT_RADIUS || proj > maxD + BARREL_HIT_RADIUS) continue;
    const perpSq = bx * bx + by * by + bz * bz - proj * proj;
    if (perpSq <= BARREL_HIT_RADIUS * BARREL_HIT_RADIUS) return true;
  }
  return false;
}

/**
 * Processes player weapon shots against world obstacle occlusion + enemy hit spheres.
 * Returns tracer endpoint resolutions and updates heat, hitstop, trauma, and victory.
 */
export function processPlayerShots(
  state: CombatSimulationState,
  shots: ReadonlyArray<WorldShotInput>,
  playerX: number,
  playerY: number,
  playerZ: number,
  turretWorldYaw: number,
): ShotResolution[] {
  const resolutions: ShotResolution[] = [];
  if (state.missionStatus !== 'playing' || shots.length === 0) return resolutions;
  if (state.weaponOverheated) return resolutions;

  state.hasPlayerEngaged = true;
  const aimAssist = findAimAssistTarget(state, playerX, playerY, playerZ, turretWorldYaw, 0.22);

  for (let s = 0; s < shots.length; s++) {
    if (state.weaponOverheated) break;
    const shot = shots[s];
    state.shotsFired += 1;
    state.weaponHeat = clamp(state.weaponHeat + 0.044, 0, 1);
    if (state.weaponHeat >= 0.999) {
      state.weaponOverheated = true;
    }

    let dx = shot.dirX;
    let dy = shot.dirY;
    let dz = shot.dirZ;

    // Gentle reticle convergence (~6 deg) when locked cleanly inside turret crosshair (unless aimed directly at a canister)
    const directBarrelAim = rayHitsHazardBarrel(
      state,
      shot.muzzleX,
      shot.muzzleY,
      shot.muzzleZ,
      dx,
      dy,
      dz,
    );
    if (!directBarrelAim && aimAssist.enemy && aimAssist.horizAngleError <= 0.105) {
      const cfg = ENEMY_CONFIGS[aimAssist.enemy.archetype];
      const tx = aimAssist.enemy.x - shot.muzzleX;
      const ty = aimAssist.enemy.y + cfg.hitCenterYOffset - shot.muzzleY;
      const tz = aimAssist.enemy.z - shot.muzzleZ;
      const tLen = Math.hypot(tx, ty, tz);
      if (tLen > 0.25) {
        dx = tx / tLen;
        dy = ty / tLen;
        dz = tz / tLen;
      }
    } else {
      const len = Math.max(1e-6, Math.hypot(dx, dy, dz));
      dx /= len;
      dy /= len;
      dz /= len;
    }

    const coverHit = castCombatRay(
      shot.muzzleX,
      shot.muzzleY,
      shot.muzzleZ,
      dx,
      dy,
      dz,
      PLAYER_MAX_RANGE,
    );
    const maxTraceDist = coverHit ? coverHit.distance : PLAYER_MAX_RANGE;

    let hitEnemy: EnemyUnitState | null = null;
    let hitEnemyDist = maxTraceDist;
    let hitBarrel: HazardBarrel | null = null;
    let hitBarrelDist = maxTraceDist;

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!isEnemyAlive(e)) continue;
      const cfg = ENEMY_CONFIGS[e.archetype];
      const ex = e.x - shot.muzzleX;
      const ey = e.y + cfg.hitCenterYOffset - shot.muzzleY;
      const ez = e.z - shot.muzzleZ;
      const proj = ex * dx + ey * dy + ez * dz;
      if (proj < -cfg.hitRadius || proj > hitEnemyDist + cfg.hitRadius) continue;

      const distSq = ex * ex + ey * ey + ez * ez;
      const perpSq = distSq - proj * proj;
      if (perpSq > cfg.hitRadius * cfg.hitRadius) continue;

      const entryDist = Math.max(0, proj - Math.sqrt(cfg.hitRadius * cfg.hitRadius - perpSq));
      if (entryDist <= hitEnemyDist) {
        hitEnemyDist = entryDist;
        hitEnemy = e;
      }
    }

    for (let i = 0; i < state.barrels.length; i++) {
      const b = state.barrels[i];
      if (b.destroyed) continue;
      const bx = b.x - shot.muzzleX;
      const by = b.y + 0.95 - shot.muzzleY;
      const bz = b.z - shot.muzzleZ;
      const proj = bx * dx + by * dy + bz * dz;
      if (proj < -BARREL_HIT_RADIUS || proj > hitBarrelDist + BARREL_HIT_RADIUS) continue;

      const distSq = bx * bx + by * by + bz * bz;
      const perpSq = distSq - proj * proj;
      if (perpSq > BARREL_HIT_RADIUS * BARREL_HIT_RADIUS) continue;

      const entryDist = Math.max(
        0,
        proj - Math.sqrt(BARREL_HIT_RADIUS * BARREL_HIT_RADIUS - perpSq),
      );
      if (entryDist < hitBarrelDist) {
        hitBarrelDist = entryDist;
        hitBarrel = b;
      }
    }

    if (hitBarrel && (!hitEnemy || hitBarrelDist <= hitEnemyDist)) {
      const hx = shot.muzzleX + dx * hitBarrelDist;
      const hy = shot.muzzleY + dy * hitBarrelDist;
      const hz = shot.muzzleZ + dz * hitBarrelDist;
      state.shotsHit += 1;
      state.hitMarkerTimer = 0.16;
      hitBarrel.hp = Math.max(0, hitBarrel.hp - PLAYER_SHELL_DAMAGE);
      hitBarrel.hitFlashTimer = 0.1;
      if (hitBarrel.hp <= 0) {
        detonateHazardBarrel(state, hitBarrel);
      } else {
        state.pendingImpacts.push({ kind: 'armor-hit', x: hx, y: hy, z: hz, heavy: false });
      }
      resolutions.push({
        hitKind: 'enemy',
        hitX: hx,
        hitY: hy,
        hitZ: hz,
        distance: hitBarrelDist,
      });
    } else if (hitEnemy) {
      const hx = shot.muzzleX + dx * hitEnemyDist;
      const hy = shot.muzzleY + dy * hitEnemyDist;
      const hz = shot.muzzleZ + dz * hitEnemyDist;

      state.shotsHit += 1;
      state.hitMarkerTimer = 0.14;
      hitEnemy.hp = Math.max(0, hitEnemy.hp - PLAYER_SHELL_DAMAGE);
      hitEnemy.hitFlashTimer = 0.085;
      if (hitEnemy.aiState === 'patrol') {
        hitEnemy.aiState = 'alert';
      }

      if (hitEnemy.hp <= 0) {
        const cfg = ENEMY_CONFIGS[hitEnemy.archetype];
        hitEnemy.aiState = 'ko';
        hitEnemy.koTimer = KO_DURATION_SEC;
        hitEnemy.hasAttackToken = false;
        state.score += cfg.scoreValue;
        if (state.score > state.bestScore) {
          state.bestScore = state.score;
          saveBestCombatRecord(state.bestScore);
        }
        state.hitstopTimer = Math.max(state.hitstopTimer, 0.045);
        state.trauma = clamp(state.trauma + 0.36, 0, 1);
        state.pendingImpacts.push({
          kind: 'explosion',
          x: hitEnemy.x,
          y: hitEnemy.y + cfg.hitCenterYOffset,
          z: hitEnemy.z,
          heavy: true,
        });
        resolutions.push({
          hitKind: 'enemy',
          hitX: hx,
          hitY: hy,
          hitZ: hz,
          distance: hitEnemyDist,
          killedEnemyId: hitEnemy.id,
        });
      } else {
        state.trauma = clamp(state.trauma + 0.05, 0, 1);
        state.pendingImpacts.push({
          kind: 'armor-hit',
          x: hx,
          y: hy,
          z: hz,
          heavy: false,
        });
        resolutions.push({
          hitKind: 'enemy',
          hitX: hx,
          hitY: hy,
          hitZ: hz,
          distance: hitEnemyDist,
        });
      }
    } else if (coverHit) {
      state.pendingImpacts.push({
        kind: 'cover-hit',
        x: coverHit.x,
        y: coverHit.y,
        z: coverHit.z,
        heavy: false,
      });
      resolutions.push({
        hitKind: 'cover',
        hitX: coverHit.x,
        hitY: coverHit.y,
        hitZ: coverHit.z,
        distance: coverHit.distance,
      });
    } else {
      resolutions.push({
        hitKind: 'miss',
        hitX: shot.muzzleX + dx * PLAYER_MAX_RANGE,
        hitY: shot.muzzleY + dy * PLAYER_MAX_RANGE,
        hitZ: shot.muzzleZ + dz * PLAYER_MAX_RANGE,
        distance: PLAYER_MAX_RANGE,
      });
    }
  }

  return resolutions;
}

/**
 * Fires the 105-mm secondary heavy cannon (KeyF). Ignores autocannon heat,
 * punches through stagger/windup, and produces a high-impact heavy beam visual.
 */
export function triggerHeavyCannonShot(
  state: CombatSimulationState,
  muzzleX: number,
  muzzleY: number,
  muzzleZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  turretWorldYaw: number,
): ShotResolution | null {
  if (state.missionStatus !== 'playing' || state.playerHp <= 0) return null;
  if (state.heavyCooldownTimer > 0) return null;

  state.heavyCooldownTimer = HEAVY_CANNON_COOLDOWN;
  state.hasPlayerEngaged = true;
  state.shotsFired += 1;

  const aimAssist = findAimAssistTarget(state, playerX, playerY, playerZ, turretWorldYaw, 0.24);
  let dx = dirX;
  let dy = dirY;
  let dz = dirZ;

  const directBarrelAim = rayHitsHazardBarrel(state, muzzleX, muzzleY, muzzleZ, dx, dy, dz);
  if (!directBarrelAim && aimAssist.enemy && aimAssist.horizAngleError <= 0.14) {
    const cfg = ENEMY_CONFIGS[aimAssist.enemy.archetype];
    const tx = aimAssist.enemy.x - muzzleX;
    const ty = aimAssist.enemy.y + cfg.hitCenterYOffset - muzzleY;
    const tz = aimAssist.enemy.z - muzzleZ;
    const tLen = Math.hypot(tx, ty, tz);
    if (tLen > 0.25) {
      dx = tx / tLen;
      dy = ty / tLen;
      dz = tz / tLen;
    }
  } else {
    const len = Math.max(1e-6, Math.hypot(dx, dy, dz));
    dx /= len;
    dy /= len;
    dz /= len;
  }

  const coverHit = castCombatRay(muzzleX, muzzleY, muzzleZ, dx, dy, dz, PLAYER_MAX_RANGE);
  const maxTraceDist = coverHit ? coverHit.distance : PLAYER_MAX_RANGE;

  let hitEnemy: EnemyUnitState | null = null;
  let hitEnemyDist = maxTraceDist;
  let hitBarrel: HazardBarrel | null = null;
  let hitBarrelDist = maxTraceDist;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (!isEnemyAlive(e)) continue;
    const cfg = ENEMY_CONFIGS[e.archetype];
    const radius = cfg.hitRadius + 0.35;
    const ex = e.x - muzzleX;
    const ey = e.y + cfg.hitCenterYOffset - muzzleY;
    const ez = e.z - muzzleZ;
    const proj = ex * dx + ey * dy + ez * dz;
    if (proj < -radius || proj > hitEnemyDist + radius) continue;

    const distSq = ex * ex + ey * ey + ez * ez;
    const perpSq = distSq - proj * proj;
    if (perpSq > radius * radius) continue;

    const entryDist = Math.max(0, proj - Math.sqrt(radius * radius - perpSq));
    if (entryDist <= hitEnemyDist) {
      hitEnemyDist = entryDist;
      hitEnemy = e;
    }
  }

  for (let i = 0; i < state.barrels.length; i++) {
    const b = state.barrels[i];
    if (b.destroyed) continue;
    const radius = BARREL_HIT_RADIUS + 0.25;
    const bx = b.x - muzzleX;
    const by = b.y + 0.95 - muzzleY;
    const bz = b.z - muzzleZ;
    const proj = bx * dx + by * dy + bz * dz;
    if (proj < -radius || proj > hitBarrelDist + radius) continue;

    const distSq = bx * bx + by * by + bz * bz;
    const perpSq = distSq - proj * proj;
    if (perpSq > radius * radius) continue;

    const entryDist = Math.max(0, proj - Math.sqrt(radius * radius - perpSq));
    if (entryDist < hitBarrelDist) {
      hitBarrelDist = entryDist;
      hitBarrel = b;
    }
  }

  if (hitBarrel && (!hitEnemy || hitBarrelDist <= hitEnemyDist)) {
    const hx = muzzleX + dx * hitBarrelDist;
    const hy = muzzleY + dy * hitBarrelDist;
    const hz = muzzleZ + dz * hitBarrelDist;
    state.heavyBeams.push({
      x0: muzzleX,
      y0: muzzleY,
      z0: muzzleZ,
      x1: hx,
      y1: hy,
      z1: hz,
      life: 0.26,
      maxLife: 0.26,
    });
    state.shotsHit += 1;
    state.hitMarkerTimer = 0.22;
    hitBarrel.hp = 0;
    detonateHazardBarrel(state, hitBarrel);
    return {
      hitKind: 'enemy',
      hitX: hx,
      hitY: hy,
      hitZ: hz,
      distance: hitBarrelDist,
    };
  }

  if (hitEnemy) {
    const hx = muzzleX + dx * hitEnemyDist;
    const hy = muzzleY + dy * hitEnemyDist;
    const hz = muzzleZ + dz * hitEnemyDist;

    state.heavyBeams.push({
      x0: muzzleX,
      y0: muzzleY,
      z0: muzzleZ,
      x1: hx,
      y1: hy,
      z1: hz,
      life: 0.26,
      maxLife: 0.26,
    });

    state.shotsHit += 1;
    state.hitMarkerTimer = 0.22;
    hitEnemy.hp = Math.max(0, hitEnemy.hp - HEAVY_CANNON_DAMAGE);
    hitEnemy.hitFlashTimer = 0.14;

    if (hitEnemy.hp <= 0) {
      const cfg = ENEMY_CONFIGS[hitEnemy.archetype];
      hitEnemy.aiState = 'ko';
      hitEnemy.koTimer = KO_DURATION_SEC;
      hitEnemy.hasAttackToken = false;
      state.score += cfg.scoreValue;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        saveBestCombatRecord(state.bestScore);
      }
      state.hitstopTimer = Math.max(state.hitstopTimer, 0.055);
      state.trauma = clamp(state.trauma + 0.45, 0, 1);
      state.pendingImpacts.push({
        kind: 'explosion',
        x: hitEnemy.x,
        y: hitEnemy.y + cfg.hitCenterYOffset,
        z: hitEnemy.z,
        heavy: true,
      });
      return {
        hitKind: 'enemy',
        hitX: hx,
        hitY: hy,
        hitZ: hz,
        distance: hitEnemyDist,
        killedEnemyId: hitEnemy.id,
      };
    }

    // Heavy shell staggers mobile units & interrupts enemy attack windup
    const cfg = ENEMY_CONFIGS[hitEnemy.archetype];
    if (hitEnemy.aiState === 'windup' || hitEnemy.aiState === 'patrol') {
      hitEnemy.aiState = 'alert';
      hitEnemy.hasAttackToken = false;
      hitEnemy.fireCooldownTimer = Math.max(hitEnemy.fireCooldownTimer, 0.55);
    }
    if (cfg.moveSpeed > 0) {
      moveEnemyXZ(hitEnemy, dx * 24, dz * 24, 0.05, cfg.bodyRadius);
    }

    state.hitstopTimer = Math.max(state.hitstopTimer, 0.025);
    state.trauma = clamp(state.trauma + 0.18, 0, 1);
    state.pendingImpacts.push({
      kind: 'heavy-hit',
      x: hx,
      y: hy,
      z: hz,
      heavy: true,
    });
    return {
      hitKind: 'enemy',
      hitX: hx,
      hitY: hy,
      hitZ: hz,
      distance: hitEnemyDist,
    };
  }

  if (coverHit) {
    state.heavyBeams.push({
      x0: muzzleX,
      y0: muzzleY,
      z0: muzzleZ,
      x1: coverHit.x,
      y1: coverHit.y,
      z1: coverHit.z,
      life: 0.22,
      maxLife: 0.22,
    });
    state.trauma = clamp(state.trauma + 0.08, 0, 1);
    state.pendingImpacts.push({
      kind: 'cover-hit',
      x: coverHit.x,
      y: coverHit.y,
      z: coverHit.z,
      heavy: true,
    });
    return {
      hitKind: 'cover',
      hitX: coverHit.x,
      hitY: coverHit.y,
      hitZ: coverHit.z,
      distance: coverHit.distance,
    };
  }

  const endX = muzzleX + dx * PLAYER_MAX_RANGE;
  const endY = muzzleY + dy * PLAYER_MAX_RANGE;
  const endZ = muzzleZ + dz * PLAYER_MAX_RANGE;
  state.heavyBeams.push({
    x0: muzzleX,
    y0: muzzleY,
    z0: muzzleZ,
    x1: endX,
    y1: endY,
    z1: endZ,
    life: 0.2,
    maxLife: 0.2,
  });
  state.trauma = clamp(state.trauma + 0.06, 0, 1);
  return {
    hitKind: 'miss',
    hitX: endX,
    hitY: endY,
    hitZ: endZ,
    distance: PLAYER_MAX_RANGE,
  };
}

/**
 * Triggers onboard emergency field repair (KeyV): restores armor HP and vents 37mm barrel heat.
 */
export function triggerEmergencyRepair(
  state: CombatSimulationState,
  playerX: number,
  playerY: number,
  playerZ: number,
): boolean {
  if (state.missionStatus !== 'playing' || state.playerHp <= 0) return false;
  if (state.repairCharges <= 0 || state.repairCooldownTimer > 0) return false;
  if (state.playerHp >= state.playerMaxHp && state.weaponHeat < 0.05) {
    state.alertMessage = 'Броня и орудие в норме';
    state.alertTimer = 1.4;
    return false;
  }

  state.repairCharges -= 1;
  state.repairCooldownTimer = REPAIR_COOLDOWN;
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + REPAIR_HEAL_AMOUNT);
  state.weaponHeat = Math.max(0, state.weaponHeat - REPAIR_COOL_AMOUNT);
  if (state.weaponOverheated && state.weaponHeat <= 0.5) {
    state.weaponOverheated = false;
  }
  state.alertMessage = 'Ремкомплект: +45 броня · охлаждение';
  state.alertTimer = 2.0;
  state.pendingImpacts.push({
    kind: 'pickup',
    x: playerX,
    y: playerY + 1.8,
    z: playerZ,
    heavy: true,
  });
  return true;
}

/**
 * Triggers a high-speed tactical Jet-Dash burst (KeyX), granting 55% damage mitigation during boost.
 */
export function triggerJetDash(
  state: CombatSimulationState,
  playerX: number,
  playerY: number,
  playerZ: number,
): boolean {
  if (state.missionStatus !== 'playing' || state.playerHp <= 0) return false;
  if (state.dashCooldownTimer > 0 || state.dashTimer > 0) return false;

  state.dashTimer = DASH_DURATION;
  state.dashCooldownTimer = DASH_COOLDOWN;
  state.pendingImpacts.push({
    kind: 'dash',
    x: playerX,
    y: playerY + 1.2,
    z: playerZ,
    heavy: true,
  });
  return true;
}

/**
 * Detonates a volatile energy canister with splash damage against nearby enemies and chain reactions.
 */
export function detonateHazardBarrel(
  state: CombatSimulationState,
  barrel: HazardBarrel,
): void {
  if (barrel.destroyed) return;
  barrel.destroyed = true;
  barrel.hp = 0;

  state.score += BARREL_BONUS_SCORE;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestCombatRecord(state.bestScore);
  }
  state.hitstopTimer = Math.max(state.hitstopTimer, 0.05);
  state.trauma = clamp(state.trauma + 0.48, 0, 1);
  state.alertMessage = `ДЕТОНАЦИЯ УЗЛА · +${BARREL_BONUS_SCORE}`;
  state.alertTimer = 2.1;
  state.pendingImpacts.push({
    kind: 'barrel-explosion',
    x: barrel.x,
    y: barrel.y + 1.1,
    z: barrel.z,
    heavy: true,
  });

  // Splash damage to nearby enemies
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (!isEnemyAlive(e)) continue;
    const dist = Math.hypot(e.x - barrel.x, e.z - barrel.z);
    if (dist > BARREL_BLAST_RADIUS) continue;

    const cfg = ENEMY_CONFIGS[e.archetype];
    const falloff = 1 - 0.35 * (dist / BARREL_BLAST_RADIUS);
    const dmg = Math.round(BARREL_BLAST_DAMAGE * falloff);
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlashTimer = 0.16;
    if (e.aiState === 'windup' || e.aiState === 'patrol') {
      e.aiState = 'alert';
      e.hasAttackToken = false;
    }

    if (e.hp <= 0) {
      e.aiState = 'ko';
      e.koTimer = KO_DURATION_SEC;
      e.hasAttackToken = false;
      state.score += cfg.scoreValue;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        saveBestCombatRecord(state.bestScore);
      }
      state.pendingImpacts.push({
        kind: 'explosion',
        x: e.x,
        y: e.y + cfg.hitCenterYOffset,
        z: e.z,
        heavy: true,
      });
    }
  }

  // Chain-detonate adjacent volatile canisters
  for (let i = 0; i < state.barrels.length; i++) {
    const other = state.barrels[i];
    if (other.destroyed) continue;
    if (Math.hypot(other.x - barrel.x, other.z - barrel.z) <= BARREL_BLAST_RADIUS * 0.85) {
      detonateHazardBarrel(state, other);
    }
  }
}

/**
 * Advances hitstop, trauma decay, weapon heat, enemy AI policies, projectiles, and win/loss state.
 */
export function stepCombatSimulation(
  state: CombatSimulationState,
  playerX: number,
  playerY: number,
  playerZ: number,
  isFiring: boolean,
  rawDt: number,
): { simDt: number; justEnded: 'victory' | 'defeat' | null } {
  const dt = Math.min(rawDt, 0.05);
  let justEnded: 'victory' | 'defeat' | null = null;

  // Visual timers & heavy beam trails decay even during hitstop freeze
  state.trauma = Math.max(0, state.trauma - dt * 1.85);
  state.playerHitFlash = Math.max(0, state.playerHitFlash - dt);
  state.hitMarkerTimer = Math.max(0, state.hitMarkerTimer - dt);
  if (state.alertTimer > 0) {
    state.alertTimer = Math.max(0, state.alertTimer - dt);
    if (state.alertTimer <= 0) {
      state.alertMessage = null;
    }
  }
  for (let i = state.heavyBeams.length - 1; i >= 0; i--) {
    state.heavyBeams[i].life -= dt;
    if (state.heavyBeams[i].life <= 0) {
      state.heavyBeams.splice(i, 1);
    }
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
  }
  for (let i = 0; i < state.barrels.length; i++) {
    state.barrels[i].hitFlashTimer = Math.max(0, state.barrels[i].hitFlashTimer - dt);
  }

  if (state.missionStatus !== 'playing') {
    return { simDt: 0, justEnded: null };
  }

  // Handle post-death defeat beat before showing Game Over modal
  if (state.playerHp <= 0) {
    state.defeatDelayTimer = Math.max(0, state.defeatDelayTimer - dt);
    if (state.defeatDelayTimer <= 0) {
      state.missionStatus = 'defeat';
      justEnded = 'defeat';
    }
    return { simDt: 0, justEnded };
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return { simDt: 0, justEnded: null };
  }

  const simDt = dt;
  state.elapsedSec += simDt;
  state.heavyCooldownTimer = Math.max(0, state.heavyCooldownTimer - simDt);
  state.repairCooldownTimer = Math.max(0, state.repairCooldownTimer - simDt);
  state.dashTimer = Math.max(0, state.dashTimer - simDt);
  state.dashCooldownTimer = Math.max(0, state.dashCooldownTimer - simDt);

  // Weapon cooling when not firing or recovering from overheat
  const coolRate = state.weaponOverheated ? 0.34 : isFiring ? 0.04 : 0.42;
  state.weaponHeat = Math.max(0, state.weaponHeat - coolRate * simDt);
  if (state.weaponOverheated && state.weaponHeat <= 0.35) {
    state.weaponOverheated = false;
  }

  // Check if player left opening safe pad
  if (
    !state.hasPlayerEngaged &&
    Math.hypot(playerX - MECH_SPAWN.x, playerZ - MECH_SPAWN.z) >= 16
  ) {
    state.hasPlayerEngaged = true;
  }

  const playerAimY = playerY + 1.9;
  let activeTokens = 0;
  for (let i = 0; i < state.enemies.length; i++) {
    if (state.enemies[i].hasAttackToken && isEnemyAlive(state.enemies[i])) {
      activeTokens++;
    } else {
      state.enemies[i].hasAttackToken = false;
    }
  }

  let aliveCount = 0;
  let koActiveCount = 0;
  let destroyedCount = 0;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    const cfg = ENEMY_CONFIGS[e.archetype];

    if (e.aiState === 'destroyed') {
      destroyedCount++;
      continue;
    }
    if (e.aiState === 'ko') {
      destroyedCount++;
      koActiveCount++;
      if (!e.droppedSupply && (e.archetype === 'denial-turret' || e.archetype === 'charger-walker')) {
        e.droppedSupply = true;
        state.pickups.push({
          id: `drop-${state.nextPickupId++}`,
          x: e.x,
          y: e.y,
          z: e.z,
          healAmount: 30,
          coolAmount: 0.45,
          collected: false,
        });
      }
      e.koTimer -= simDt;
      if (e.koTimer <= 0) {
        e.aiState = 'destroyed';
        e.koTimer = 0;
      }
      continue;
    }

    aliveCount++;
    const dx = playerX - e.x;
    const dz = playerZ - e.z;
    const dist = Math.hypot(dx, dz);
    e.distToPlayer = dist;

    const enemyEyeY = e.y + cfg.hitCenterYOffset + 0.15;
    e.hasLineOfSight =
      dist <= cfg.aggroRange + 14 &&
      hasLineOfSight(e.x, enemyEyeY, e.z, playerX, playerAimY, playerZ);

    e.fireCooldownTimer = Math.max(0, e.fireCooldownTimer - simDt);

    const canEngage =
      state.hasPlayerEngaged && dist <= cfg.aggroRange && e.hasLineOfSight;

    if (e.aiState === 'patrol') {
      e.hasAttackToken = false;
      if (canEngage) {
        e.aiState = 'alert';
        e.stateTimer = 0.25;
      } else if (e.patrolPoints.length > 1 && cfg.moveSpeed > 0) {
        const wp = e.patrolPoints[e.patrolIndex];
        const wx = wp[0] - e.x;
        const wz = wp[1] - e.z;
        const wDist = Math.hypot(wx, wz);
        if (wDist < 1.8) {
          e.patrolIndex = (e.patrolIndex + 1) % e.patrolPoints.length;
        } else {
          const desiredYaw = Math.atan2(wx, wz);
          e.yaw += wrapAngleDiff(desiredYaw, e.yaw) * Math.min(1, simDt * 3.5);
          e.turretYaw += wrapAngleDiff(e.yaw, e.turretYaw) * Math.min(1, simDt * 4.0);
          moveEnemyXZ(
            e,
            (wx / wDist) * cfg.moveSpeed * 0.65,
            (wz / wDist) * cfg.moveSpeed * 0.65,
            simDt,
            cfg.bodyRadius,
          );
        }
      } else {
        // Stationary turret sweeps perimeter smoothly
        e.turretYaw += Math.sin(state.elapsedSec * 0.65 + i) * 0.35 * simDt;
      }
      continue;
    }

    // Track player yaw/aim when engaged
    const toPlayerYaw = Math.atan2(dx, dz);
    e.turretYaw += wrapAngleDiff(toPlayerYaw, e.turretYaw) * Math.min(1, simDt * 6.0);
    e.aimTargetX = playerX;
    e.aimTargetY = playerAimY;
    e.aimTargetZ = playerZ;

    // Archetype-specific movement policy while engaged
    if (e.archetype === 'scout-apc') {
      // Kiter / Orbiter: maintain preferredRange (strafe around player, back up if too close)
      const dirX = dx / Math.max(0.1, dist);
      const dirZ = dz / Math.max(0.1, dist);
      const perpX = -dirZ * e.strafeDir;
      const perpZ = dirX * e.strafeDir;
      let radialFactor = 0;
      if (dist > cfg.preferredRange + 4) radialFactor = 0.65;
      else if (dist < cfg.preferredRange - 6) radialFactor = -0.8;

      const vx = (dirX * radialFactor + perpX * 0.85) * cfg.moveSpeed;
      const vz = (dirZ * radialFactor + perpZ * 0.85) * cfg.moveSpeed;
      const moveYaw = Math.atan2(vx, vz);
      e.yaw += wrapAngleDiff(moveYaw, e.yaw) * Math.min(1, simDt * 4.5);
      moveEnemyXZ(e, vx, vz, simDt, cfg.bodyRadius);
    } else if (e.archetype === 'charger-walker') {
      // Line-of-Sight Charger: aggressively closes toward melee/assault range unless mid-windup
      e.yaw += wrapAngleDiff(toPlayerYaw, e.yaw) * Math.min(1, simDt * 5.2);
      if (e.aiState !== 'windup' && dist > cfg.preferredRange) {
        const speed = e.hasLineOfSight ? cfg.chargeSpeed : cfg.moveSpeed;
        const dirX = dx / Math.max(0.1, dist);
        const dirZ = dz / Math.max(0.1, dist);
        moveEnemyXZ(e, dirX * speed, dirZ * speed, simDt, cfg.bodyRadius);
      }
    }

    // Combat AI Attack State Machine (alert -> windup -> attack -> recover)
    if (e.aiState === 'alert') {
      if (!e.hasLineOfSight && dist > cfg.aggroRange * 1.25) {
        e.aiState = 'patrol';
        e.hasAttackToken = false;
        continue;
      }
      if (
        e.hasLineOfSight &&
        dist <= cfg.aggroRange + 4 &&
        e.fireCooldownTimer <= 0 &&
        (e.hasAttackToken || activeTokens < MAX_CONCURRENT_ATTACKERS)
      ) {
        if (!e.hasAttackToken) {
          e.hasAttackToken = true;
          activeTokens++;
        }
        e.aiState = 'windup';
        e.stateTimer = cfg.windupDuration;
        if (e.archetype === 'denial-turret' || e.archetype === 'charger-walker') {
          state.pendingImpacts.push({
            kind: 'telegraph',
            x: e.x,
            y: enemyEyeY,
            z: e.z,
            heavy: e.archetype === 'denial-turret',
          });
        }
      }
    } else if (e.aiState === 'windup') {
      e.stateTimer -= simDt;
      if (!e.hasLineOfSight) {
        e.aiState = 'alert';
        e.hasAttackToken = false;
        continue;
      }
      if (e.stateTimer <= 0) {
        e.aiState = 'attack';
        e.burstRemaining = cfg.burstCount;
        e.burstTimer = 0;
      }
    } else if (e.aiState === 'attack') {
      e.burstTimer -= simDt;
      if (e.burstTimer <= 0 && e.burstRemaining > 0) {
        spawnEnemyProjectile(state, e, playerX, playerAimY, playerZ);
        e.burstRemaining -= 1;
        e.burstTimer = cfg.burstInterval;
      }
      if (e.burstRemaining <= 0) {
        const phaseCooldownMult =
          state.combatPhase === 3 ? 0.82 : state.combatPhase === 2 ? 0.9 : 1.0;
        e.aiState = 'recover';
        e.stateTimer = 0.35;
        e.fireCooldownTimer = cfg.fireCooldown * phaseCooldownMult;
        e.hasAttackToken = false;
      }
    } else if (e.aiState === 'recover') {
      e.stateTimer -= simDt;
      if (e.stateTimer <= 0) {
        e.aiState = 'alert';
      }
    }
  }

  // Step active enemy projectiles with obstacle + terrain + player collision
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life += simDt;
    if (!p.active || p.life >= p.maxLife) {
      state.projectiles.splice(i, 1);
      continue;
    }

    const stepX = p.vx * simDt;
    const stepY = p.vy * simDt;
    const stepZ = p.vz * simDt;
    const stepLen = Math.hypot(stepX, stepY, stepZ);

    // Check terrain / cover occlusion along step
    const coverHit = castCombatRay(p.x, p.y, p.z, stepX, stepY, stepZ, stepLen);
    const maxStep = coverHit ? coverHit.distance : stepLen;

    // Check swept hit against player Mech torso capsule (radius 1.45, y..y+3.3)
    const dirX = stepX / Math.max(1e-6, stepLen);
    const dirY = stepY / Math.max(1e-6, stepLen);
    const dirZ = stepZ / Math.max(1e-6, stepLen);

    const relX = playerX - p.x;
    const relZ = playerZ - p.z;
    const horizStep = Math.hypot(dirX, dirZ);
    const tClosest = horizStep > 1e-4 ? clamp(relX * dirX + relZ * dirZ, 0, maxStep) : 0;
    const sampleX = p.x + dirX * tClosest;
    const sampleY = p.y + dirY * tClosest;
    const sampleZ = p.z + dirZ * tClosest;

    const xzDist = Math.hypot(sampleX - playerX, sampleZ - playerZ);
    if (xzDist <= 1.45 && sampleY >= playerY + 0.15 && sampleY <= playerY + 3.45) {
      const dmg =
        state.dashTimer > 0
          ? Math.max(1, Math.round(p.damage * DASH_DAMAGE_MULT))
          : p.damage;
      state.playerHp = Math.max(0, state.playerHp - dmg);
      state.playerHitFlash = 0.28;
      state.trauma = clamp(state.trauma + 0.28, 0, 1);
      state.pendingImpacts.push({
        kind: 'player-hit',
        x: sampleX,
        y: sampleY,
        z: sampleZ,
        heavy: dmg >= 12,
      });
      state.projectiles.splice(i, 1);
      if (state.playerHp <= 0) {
        state.defeatDelayTimer = DEFEAT_DELAY_SEC;
      }
      continue;
    }

    if (coverHit) {
      state.pendingImpacts.push({
        kind: 'cover-hit',
        x: coverHit.x,
        y: coverHit.y,
        z: coverHit.z,
        heavy: false,
      });
      state.projectiles.splice(i, 1);
      continue;
    }

    p.x += stepX;
    p.y += stepY;
    p.z += stepZ;
  }

  // Collect field supply crates within radius
  for (let i = 0; i < state.pickups.length; i++) {
    const pk = state.pickups[i];
    if (pk.collected) continue;
    if (Math.hypot(playerX - pk.x, playerZ - pk.z) <= SUPPLY_PICKUP_RADIUS) {
      pk.collected = true;
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + pk.healAmount);
      state.weaponHeat = Math.max(0, state.weaponHeat - pk.coolAmount);
      if (state.weaponOverheated && state.weaponHeat <= 0.5) {
        state.weaponOverheated = false;
      }
      state.alertMessage = `Ремблок: +${pk.healAmount} броня`;
      state.alertTimer = 2.0;
      state.pendingImpacts.push({
        kind: 'pickup',
        x: pk.x,
        y: pk.y + 0.9,
        z: pk.z,
        heavy: false,
      });
    }
  }

  // Dynamic Phase Escalation & Citadel Reserve Deployment
  const nextPhase: CombatPhase = destroyedCount >= 5 ? 3 : destroyedCount >= 2 ? 2 : 1;
  if (nextPhase === 2 && state.combatPhase === 1) {
    state.combatPhase = 2;
    state.alertMessage = 'ФАЗА II · УСИЛЕНИЕ ОСТРОВА';
    state.alertTimer = 2.6;
  } else if (nextPhase > state.combatPhase) {
    state.combatPhase = nextPhase;
  }

  if (destroyedCount >= RESERVE_DEPLOY_THRESHOLD && !state.reinforcementsDeployed) {
    state.reinforcementsDeployed = true;
    state.combatPhase = 3;
    const baseIdx = state.enemies.length;
    CITADEL_RESERVE_SPECS.forEach((spec, idx) => {
      const unit = createEnemyFromSpec(spec, baseIdx + idx);
      unit.aiState = 'alert';
      unit.fireCooldownTimer = 0.5;
      state.enemies.push(unit);
      aliveCount++;
    });
    state.alertMessage = 'ТРЕВОГА ЦИТАДЕЛИ · РЕЗЕРВ В БОЮ';
    state.alertTimer = 3.4;
    state.pendingImpacts.push({
      kind: 'telegraph',
      x: CITADEL_CENTER_X,
      y: playerY + 4,
      z: CITADEL_CENTER_Z,
      heavy: true,
    });
  }

  // Victory triggers once all enemies have finished KO explosion
  if (aliveCount === 0 && koActiveCount === 0) {
    state.missionStatus = 'victory';
    justEnded = 'victory';
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      saveBestCombatRecord(state.bestScore);
    }
    const rank = computeMissionRank(state);
    if (!state.bestRank || RANK_ORDER[rank] > RANK_ORDER[state.bestRank]) {
      state.bestRank = rank;
      saveBestCombatRank(rank);
    }
  }

  return { simDt, justEnded };
}

export function buildCombatTelemetry(
  state: Readonly<CombatSimulationState>,
  playerX: number,
  playerY: number,
  playerZ: number,
  turretWorldYaw: number,
): CombatTelemetrySnapshot {
  const targetsTotal = state.enemies.length;
  let targetsDestroyed = 0;
  const threatAngles: number[] = [];

  const enemyBlips = state.enemies.map((e) => {
    const alive = isEnemyAlive(e);
    if (!alive) {
      targetsDestroyed++;
    } else if (e.hasLineOfSight && (e.aiState === 'windup' || e.aiState === 'attack')) {
      threatAngles.push(computeRelativeThreatAngle(e.x - playerX, e.z - playerZ, turretWorldYaw));
    }
    return {
      id: e.id,
      x: e.x,
      z: e.z,
      archetype: e.archetype,
      alive,
    };
  });

  const pickupBlips = state.pickups
    .filter((pk) => !pk.collected)
    .map((pk) => ({ id: pk.id, x: pk.x, z: pk.z }));

  const barrelBlips = state.barrels
    .filter((b) => !b.destroyed)
    .map((b) => ({ id: b.id, x: b.x, z: b.z }));

  const assist = findAimAssistTarget(state, playerX, playerY, playerZ, turretWorldYaw, 0.24);
  let lockedTarget: LockedTargetSnapshot | null = null;
  if (assist.enemy) {
    lockedTarget = {
      id: assist.enemy.id,
      name: assist.enemy.name,
      archetype: assist.enemy.archetype,
      hp: assist.enemy.hp,
      maxHp: assist.enemy.maxHp,
      distanceM: Math.round(assist.distance * METERS_PER_UNIT),
      inLineOfSight: true,
    };
  }

  return {
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    weaponHeat: state.weaponHeat,
    weaponOverheated: state.weaponOverheated,
    heavyCooldown: state.heavyCooldownTimer,
    heavyMaxCooldown: HEAVY_CANNON_COOLDOWN,
    repairCharges: state.repairCharges,
    repairCooldown: state.repairCooldownTimer,
    dashCooldown: state.dashCooldownTimer,
    dashMaxCooldown: DASH_COOLDOWN,
    dashActive: state.dashTimer > 0,
    combatPhase: state.combatPhase,
    alertMessage: state.alertMessage,
    targetsDestroyed,
    targetsTotal,
    score: state.score,
    bestScore: state.bestScore,
    missionRank: computeMissionRank(state),
    bestRank: state.bestRank,
    shotsFired: state.shotsFired,
    shotsHit: state.shotsHit,
    accuracyPct:
      state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0,
    elapsedSec: state.elapsedSec,
    missionStatus: state.missionStatus,
    hitMarkerActive: state.hitMarkerTimer > 0,
    playerHitFlash: state.playerHitFlash,
    lockedTarget,
    enemyBlips,
    pickupBlips,
    barrelBlips,
    threatAngles,
  };
}
