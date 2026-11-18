export type EnemyArchetype = 'scout-apc' | 'denial-turret' | 'charger-walker';

export type EnemyAIState =
  | 'patrol'
  | 'alert'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'ko'
  | 'destroyed';

export type MissionStatus = 'idle' | 'playing' | 'paused' | 'victory' | 'defeat';
export type CombatPhase = 1 | 2 | 3;
export type MissionRank = 'S' | 'A' | 'B' | 'C';

export interface EnemyArchetypeConfig {
  label: string;
  maxHp: number;
  moveSpeed: number;
  chargeSpeed: number;
  aggroRange: number;
  preferredRange: number;
  hitRadius: number;
  hitCenterYOffset: number;
  bodyRadius: number;
  damage: number;
  windupDuration: number;
  fireCooldown: number;
  burstCount: number;
  burstInterval: number;
  projectileSpeed: number;
  scoreValue: number;
}

export interface EnemyUnitState {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  turretYaw: number;
  hp: number;
  maxHp: number;
  aiState: EnemyAIState;
  stateTimer: number;
  fireCooldownTimer: number;
  burstRemaining: number;
  burstTimer: number;
  hitFlashTimer: number;
  koTimer: number;
  patrolPoints: ReadonlyArray<readonly [number, number]>;
  patrolIndex: number;
  strafeDir: -1 | 1;
  hasAttackToken: boolean;
  hasLineOfSight: boolean;
  distToPlayer: number;
  aimTargetX: number;
  aimTargetY: number;
  aimTargetZ: number;
  droppedSupply?: boolean;
}

export interface EnemyProjectile {
  id: number;
  ownerId: string;
  archetype: EnemyArchetype;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface SupplyPickup {
  id: string;
  x: number;
  y: number;
  z: number;
  healAmount: number;
  coolAmount: number;
  collected: boolean;
}

export interface HeavyBeamEvent {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  life: number;
  maxLife: number;
}

export interface HazardBarrel {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  destroyed: boolean;
}

export interface PlayerMissile {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  targetEnemyId: string | null;
  fallbackX: number;
  fallbackY: number;
  fallbackZ: number;
  life: number;
  maxLife: number;
  damage: number;
  active: boolean;
}

export interface ActiveBeamVisual {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  nx: number;
  ny: number;
  nz: number;
  hasImpact: boolean;
  onEnemy: boolean;
  inWater: boolean;
  intensity: number;
}

export interface CuttingLaserConfig {
  id: string;
  label: string;
  dps: number;
  energyDrainPerSec: number;
  rechargePerSec: number;
  overheatResumeThreshold: number;
  maxRange: number;
  slagRadius: number;
  waterCoolingMult: number;
}

export interface CombatImpactEvent {
  kind:
    | 'armor-hit'
    | 'cover-hit'
    | 'explosion'
    | 'barrel-explosion'
    | 'player-hit'
    | 'telegraph'
    | 'pickup'
    | 'heavy-hit'
    | 'dash'
    | 'missile-impact';
  x: number;
  y: number;
  z: number;
  heavy: boolean;
  inWater?: boolean;
  nx?: number;
  ny?: number;
  nz?: number;
  decalKind?: 'crater' | 'bullet';
  decalRadius?: number;
}

export interface LockedTargetSnapshot {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  hp: number;
  maxHp: number;
  distanceM: number;
  inLineOfSight: boolean;
}

export interface EnemyBlip {
  id: string;
  x: number;
  z: number;
  archetype: EnemyArchetype;
  alive: boolean;
}

export interface PickupBlip {
  id: string;
  x: number;
  z: number;
}

export interface BarrelBlip {
  id: string;
  x: number;
  z: number;
}

export interface CombatTelemetrySnapshot {
  playerHp: number;
  playerMaxHp: number;
  weaponHeat: number;
  weaponOverheated: boolean;
  laserEnergy: number;
  laserOverheated: boolean;
  laserActive: boolean;
  inWaterCooling: boolean;
  heavyCooldown: number;
  heavyMaxCooldown: number;
  missileCooldown: number;
  missileMaxCooldown: number;
  repairCharges: number;
  repairCooldown: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  dashActive: boolean;
  combatPhase: CombatPhase;
  alertMessage: string | null;
  targetsDestroyed: number;
  targetsTotal: number;
  score: number;
  bestScore: number;
  missionRank: MissionRank;
  bestRank: MissionRank | null;
  shotsFired: number;
  shotsHit: number;
  accuracyPct: number;
  elapsedSec: number;
  missionStatus: MissionStatus;
  hitMarkerActive: boolean;
  playerHitFlash: number;
  lockedTarget: LockedTargetSnapshot | null;
  enemyBlips: EnemyBlip[];
  pickupBlips: PickupBlip[];
  barrelBlips: BarrelBlip[];
  threatAngles: number[];
}

export interface CombatSimulationState {
  missionStatus: MissionStatus;
  combatPhase: CombatPhase;
  reinforcementsDeployed: boolean;
  alertMessage: string | null;
  alertTimer: number;
  elapsedSec: number;
  playerHp: number;
  playerMaxHp: number;
  playerHitFlash: number;
  defeatDelayTimer: number;
  hitstopTimer: number;
  trauma: number;
  weaponHeat: number;
  weaponOverheated: boolean;
  laserEnergy: number;
  laserOverheated: boolean;
  laserActive: boolean;
  laserBeam: ActiveBeamVisual | null;
  laserTickAccum: number;
  heavyCooldownTimer: number;
  missileCooldownTimer: number;
  repairCharges: number;
  repairCooldownTimer: number;
  dashTimer: number;
  dashCooldownTimer: number;
  hasPlayerEngaged: boolean;
  score: number;
  bestScore: number;
  bestRank: MissionRank | null;
  shotsFired: number;
  shotsHit: number;
  hitMarkerTimer: number;
  nextProjectileId: number;
  nextMissileId: number;
  nextPickupId: number;
  enemies: EnemyUnitState[];
  barrels: HazardBarrel[];
  pickups: SupplyPickup[];
  projectiles: EnemyProjectile[];
  playerMissiles: PlayerMissile[];
  heavyBeams: HeavyBeamEvent[];
  pendingImpacts: CombatImpactEvent[];
}
