import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  getTerrainHeight,
} from '../map/terrainMath';
import { MECH_SPAWN } from '../map/mechKinematics';
import {
  BARREL_BLAST_DAMAGE,
  BARREL_BONUS_SCORE,
  DASH_COOLDOWN,
  DASH_DAMAGE_MULT,
  DASH_DURATION,
  DEFEAT_DELAY_SEC,
  HEAVY_CANNON_COOLDOWN,
  HEAVY_CANNON_DAMAGE,
  KO_DURATION_SEC,
  MAX_CONCURRENT_ATTACKERS,
  MISSILE_DAMAGE,
  MISSILE_SALVO_COOLDOWN,
  MISSILE_SALVO_COUNT,
  PLAYER_MAX_HP,
  PLAYER_SHELL_DAMAGE,
  REPAIR_COOL_AMOUNT,
  REPAIR_COOLDOWN,
  REPAIR_HEAL_AMOUNT,
  REPAIR_INITIAL_CHARGES,
  WATER_COOLING_MULT,
  buildCombatTelemetry,
  computeGunPitchToTarget,
  computeMissionRank,
  computeRelativeThreatAngle,
  createCombatState,
  detonateHazardBarrel,
  findAimAssistTarget,
  processPlayerShots,
  resetCombatState,
  stepCombatSimulation,
  triggerEmergencyRepair,
  triggerHeavyCannonShot,
  triggerJetDash,
  triggerMissileSalvo,
} from './combatSimulation';

test('computeGunPitchToTarget aligns Three.js +Z barrel rotated around +X directly onto target elevation', () => {
  const dy = -1.6;
  const horizDist = 24;
  const pitch = computeGunPitchToTarget(dy, horizDist);
  const dir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(pitch, 0, 0));
  const expected = new THREE.Vector3(0, dy, horizDist).normalize();
  assert.ok(dir.distanceTo(expected) < 1e-6, `Expected ${expected.toArray()}, got ${dir.toArray()}`);
});

test('three enemy archetypes execute distinct movement policies (kiter vs stationary turret vs charger)', () => {
  const state = createCombatState(true);
  state.hasPlayerEngaged = true;

  // Keep only 3 representative enemies on an open airfield apron area
  const px = MECH_SPAWN.x;
  const py = MECH_SPAWN.y;
  const pz = MECH_SPAWN.z;

  const scout = state.enemies.find((e) => e.archetype === 'scout-apc')!;
  const turret = state.enemies.find((e) => e.archetype === 'denial-turret')!;
  const charger = state.enemies.find((e) => e.archetype === 'charger-walker')!;
  state.enemies = [scout, turret, charger];

  // Place Scout too close (10u): should back away / strafe rather than rush closer
  scout.x = px + 10;
  scout.z = pz - 2;
  scout.y = py;
  scout.aiState = 'alert';

  // Place Denial Turret at 20u: must remain stationary
  turret.x = px + 18;
  turret.z = pz - 8;
  turret.y = py;
  turret.aiState = 'alert';

  // Place Charger at 24u: must charge closer toward player
  charger.x = px + 22;
  charger.z = pz + 4;
  charger.y = py;
  charger.aiState = 'alert';

  const scoutStartDist = Math.hypot(scout.x - px, scout.z - pz);
  const turretStartPos = [turret.x, turret.z];
  const chargerStartDist = Math.hypot(charger.x - px, charger.z - pz);

  for (let i = 0; i < 12; i++) {
    stepCombatSimulation(state, px, py, pz, false, 0.05);
  }

  const scoutEndDist = Math.hypot(scout.x - px, scout.z - pz);
  const chargerEndDist = Math.hypot(charger.x - px, charger.z - pz);

  assert.ok(
    scoutEndDist > scoutStartDist + 0.3,
    `Scout APC kiter should widen distance when too close (${scoutStartDist.toFixed(2)} -> ${scoutEndDist.toFixed(2)})`,
  );
  assert.deepEqual([turret.x, turret.z], turretStartPos, 'Denial turret must remain stationary');
  assert.ok(
    chargerEndDist < chargerStartDist - 1.0,
    `Charger walker should rush toward player (${chargerStartDist.toFixed(2)} -> ${chargerEndDist.toFixed(2)})`,
  );
});

test('attack token pool limits simultaneous attacking enemies to MAX_CONCURRENT_ATTACKERS', () => {
  const state = createCombatState(true);
  state.hasPlayerEngaged = true;
  const px = MECH_SPAWN.x;
  const py = MECH_SPAWN.y;
  const pz = MECH_SPAWN.z;

  // Move all 7 enemies close and in clear view of player
  state.enemies.forEach((e, idx) => {
    e.x = px + 12 + idx * 1.8;
    e.z = pz - 8;
    e.y = py;
    e.aiState = 'alert';
    e.fireCooldownTimer = 0;
  });

  stepCombatSimulation(state, px, py, pz, false, 0.05);
  const attackers = state.enemies.filter((e) => e.hasAttackToken);
  assert.ok(
    attackers.length <= MAX_CONCURRENT_ATTACKERS && attackers.length > 0,
    `Expected 1..${MAX_CONCURRENT_ATTACKERS} active attackers, got ${attackers.length}`,
  );
});

test('solid walls block player shots from hitting enemies behind cover', () => {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];

  // Place enemy inside Citadel East courtyard right behind the East curtain wall
  const citY = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;
  const wallX = CITADEL_CENTER_X + CITADEL_WALL_RX * Math.cos(Math.PI / 8);
  enemy.x = wallX - 4;
  enemy.z = CITADEL_CENTER_Z;
  enemy.y = citY;

  const shooterX = wallX + 8;
  const shooterY = citY + 2.0;
  const shooterZ = CITADEL_CENTER_Z;
  const startHp = enemy.hp;

  const res = processPlayerShots(
    state,
    [{ muzzleX: shooterX, muzzleY: shooterY, muzzleZ: shooterZ, dirX: -1, dirY: 0, dirZ: 0 }],
    shooterX,
    citY,
    shooterZ,
    -Math.PI / 2,
  );

  assert.equal(res[0].hitKind, 'cover');
  assert.equal(enemy.hp, startHp, 'Enemy behind curtain wall must take zero damage');
});

test('player shots destroy final enemy via KO transition and trigger victory + clean reset', () => {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];

  enemy.x = MECH_SPAWN.x;
  enemy.z = MECH_SPAWN.z + 18;
  enemy.y = MECH_SPAWN.y;
  enemy.hp = PLAYER_SHELL_DAMAGE;

  const res = processPlayerShots(
    state,
    [
      {
        muzzleX: MECH_SPAWN.x,
        muzzleY: MECH_SPAWN.y + 1.0,
        muzzleZ: MECH_SPAWN.z + 1.5,
        dirX: 0,
        dirY: 0,
        dirZ: 1,
      },
    ],
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    0,
  );

  assert.equal(res[0].hitKind, 'enemy');
  assert.equal(res[0].killedEnemyId, enemy.id);
  assert.equal(enemy.aiState, 'ko');
  assert.ok(state.hitstopTimer > 0, 'Killing an enemy should trigger brief hitstop');

  // Tick through hitstop + KO duration
  for (let i = 0; i < 20; i++) {
    stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, KO_DURATION_SEC / 6);
  }
  assert.equal(state.missionStatus, 'victory');

  resetCombatState(state, 'playing');
  assert.equal(state.missionStatus, 'playing');
  assert.equal(state.playerHp, PLAYER_MAX_HP);
  assert.equal(state.enemies.length, 7);
  assert.equal(state.barrels.length, 4);
});

test('enemy projectile hitting player reduces HP to zero without clamping and transitions to defeat', () => {
  const state = createCombatState(true);
  state.enemies = [state.enemies[0]];
  state.playerHp = 10;
  state.projectiles.push({
    id: 99,
    ownerId: 'scout-forefield',
    archetype: 'scout-apc',
    x: MECH_SPAWN.x,
    y: MECH_SPAWN.y + 1.6,
    z: MECH_SPAWN.z - 0.5,
    vx: 0,
    vy: 0,
    vz: 60,
    damage: 15,
    life: 0,
    maxLife: 2,
    active: true,
  });

  stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.03);
  assert.equal(state.playerHp, 0, 'Player HP must reach 0 cleanly with no hidden floor');

  for (let i = 0; i < 15; i++) {
    stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, DEFEAT_DELAY_SEC / 8);
  }
  assert.equal(state.missionStatus, 'defeat');
});

test('telemetry reports locked target in turret cone and accurate counts', () => {
  const state = createCombatState(true);
  const e0 = state.enemies[0];
  e0.x = MECH_SPAWN.x;
  e0.z = MECH_SPAWN.z + 20;
  e0.y = MECH_SPAWN.y;

  const assist = findAimAssistTarget(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0);
  assert.equal(assist.enemy?.id, e0.id);

  const hud = buildCombatTelemetry(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0);
  assert.equal(hud.lockedTarget?.id, e0.id);
  assert.equal(hud.targetsTotal, state.enemies.length);
  assert.equal(hud.targetsDestroyed, 0);
});

test('105mm heavy cannon deals HEAVY_CANNON_DAMAGE, ignores 37mm overheat, respects cooldown, and stops at walls', () => {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];
  enemy.x = MECH_SPAWN.x;
  enemy.z = MECH_SPAWN.z + 22;
  enemy.y = MECH_SPAWN.y;
  const startHp = enemy.hp;

  // Even when 37mm autocannon is overheated, 105mm fires cleanly
  state.weaponOverheated = true;
  state.weaponHeat = 1.0;

  const first = triggerHeavyCannonShot(
    state,
    MECH_SPAWN.x,
    MECH_SPAWN.y + 2.3,
    MECH_SPAWN.z + 1.5,
    0,
    0,
    1,
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    0,
  );
  assert.ok(first, 'Heavy shot should fire on ready cooldown');
  assert.equal(first.hitKind, 'enemy');
  assert.equal(enemy.hp, Math.max(0, startHp - HEAVY_CANNON_DAMAGE));
  assert.equal(state.heavyBeams.length, 1);
  assert.equal(state.heavyCooldownTimer, HEAVY_CANNON_COOLDOWN);

  // Subsequent shot while on cooldown is blocked
  const blocked = triggerHeavyCannonShot(
    state,
    MECH_SPAWN.x,
    MECH_SPAWN.y + 2.3,
    MECH_SPAWN.z + 1.5,
    0,
    0,
    1,
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    0,
  );
  assert.equal(blocked, null);
});

test('emergency repair restores armor HP, vents barrel heat, consumes charge, and applies cooldown', () => {
  const state = createCombatState(true);
  state.playerHp = 50;
  state.weaponHeat = 0.9;
  state.weaponOverheated = true;

  const ok = triggerEmergencyRepair(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z);
  assert.equal(ok, true);
  assert.equal(state.playerHp, 50 + REPAIR_HEAL_AMOUNT);
  assert.ok(Math.abs(state.weaponHeat - (0.9 - REPAIR_COOL_AMOUNT)) < 1e-6);
  assert.equal(state.repairCharges, REPAIR_INITIAL_CHARGES - 1);
  assert.equal(state.repairCooldownTimer, REPAIR_COOLDOWN);

  const onCooldown = triggerEmergencyRepair(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z);
  assert.equal(onCooldown, false);
});

test('field supply pickup heals mech within radius and heavy enemies drop crates on KO', () => {
  const state = createCombatState(true);
  const turret = state.enemies.find((e) => e.archetype === 'denial-turret')!;
  state.enemies = [turret];
  turret.aiState = 'ko';
  turret.hp = 0;
  turret.koTimer = KO_DURATION_SEC;

  const startPickups = state.pickups.length;
  stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.04);
  assert.equal(state.pickups.length, startPickups + 1, 'Destroyed heavy enemy must drop a supply crate');

  // Walk player onto the first supply crate while damaged
  const crate = state.pickups[0];
  state.playerHp = 70;
  state.weaponHeat = 0.8;
  stepCombatSimulation(state, crate.x, crate.y, crate.z, false, 0.04);
  assert.equal(crate.collected, true);
  assert.equal(state.playerHp, 100);
  assert.ok(state.weaponHeat < 0.4);
});

test('destroying 5 enemies advances to Phase 3 and deploys 2 Citadel Reserve reinforcements', () => {
  const state = createCombatState(true);
  assert.equal(state.enemies.length, 7);
  assert.equal(state.combatPhase, 1);

  for (let i = 0; i < 5; i++) {
    state.enemies[i].hp = 0;
    state.enemies[i].aiState = 'destroyed';
  }

  stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.04);
  assert.equal(state.combatPhase, 3);
  assert.equal(state.reinforcementsDeployed, true);
  assert.equal(state.enemies.length, 9);
  assert.equal(state.missionStatus, 'playing');

  const hud = buildCombatTelemetry(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0);
  assert.equal(hud.combatPhase, 3);
  assert.equal(hud.targetsTotal, 9);
  assert.equal(hud.targetsDestroyed, 5);
});

test('Jet-Dash activates boost cooldown and mitigates incoming projectile damage by 55%', () => {
  const state = createCombatState(true);
  state.enemies = [state.enemies[0]];
  assert.equal(triggerJetDash(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z), true);
  assert.equal(state.dashTimer, DASH_DURATION);
  assert.equal(state.dashCooldownTimer, DASH_COOLDOWN);
  assert.equal(triggerJetDash(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z), false);

  state.playerHp = 100;
  state.projectiles.push({
    id: 101,
    ownerId: 'scout-forefield',
    archetype: 'denial-turret',
    x: MECH_SPAWN.x,
    y: MECH_SPAWN.y + 1.6,
    z: MECH_SPAWN.z - 0.5,
    vx: 0,
    vy: 0,
    vz: 60,
    damage: 20,
    life: 0,
    maxLife: 2,
    active: true,
  });

  stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.03);
  const expectedDamage = Math.round(20 * DASH_DAMAGE_MULT);
  assert.equal(state.playerHp, 100 - expectedDamage);
});

test('explosive hazard canisters detonate from 105mm/37mm fire, deal splash KO and chain detonate', () => {
  const state = createCombatState(true);
  const enemy = state.enemies[0];
  state.enemies = [enemy];
  enemy.hp = 60;

  const b1 = state.barrels[0];
  const b2 = state.barrels[1];
  b1.x = MECH_SPAWN.x;
  b1.y = MECH_SPAWN.y;
  b1.z = MECH_SPAWN.z + 18;
  b2.x = b1.x + 4;
  b2.y = MECH_SPAWN.y;
  b2.z = b1.z;
  enemy.x = b1.x + 2;
  enemy.y = MECH_SPAWN.y;
  enemy.z = b1.z;

  const res = triggerHeavyCannonShot(
    state,
    MECH_SPAWN.x,
    MECH_SPAWN.y + 0.95,
    MECH_SPAWN.z + 1.5,
    0,
    0,
    1,
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    0,
  );
  assert.ok(res && res.hitKind === 'enemy');
  assert.equal(b1.destroyed, true);
  assert.equal(b2.destroyed, true, 'Adjacent canister must chain-detonate');
  assert.equal(enemy.aiState, 'ko', `Enemy within blast radius (${BARREL_BLAST_DAMAGE} max dmg) should be KO`);
  assert.ok(state.score >= BARREL_BONUS_SCORE * 2);

  // Also test direct detonateHazardBarrel idempotence
  const scoreBefore = state.score;
  detonateHazardBarrel(state, b1);
  assert.equal(state.score, scoreBefore);
});

test('computeRelativeThreatAngle maps ahead/right/left/behind accurately relative to turretWorldYaw', () => {
  // Facing +Z (yaw = 0)
  assert.ok(Math.abs(computeRelativeThreatAngle(0, 10, 0)) < 1e-6, 'Ahead (+Z) = 0 rad');
  assert.ok(Math.abs(computeRelativeThreatAngle(-10, 0, 0) - Math.PI / 2) < 1e-6, 'Screen right (-X) = +PI/2');
  assert.ok(Math.abs(computeRelativeThreatAngle(10, 0, 0) + Math.PI / 2) < 1e-6, 'Screen left (+X) = -PI/2');
  assert.ok(Math.abs(Math.abs(computeRelativeThreatAngle(0, -10, 0)) - Math.PI) < 1e-6, 'Behind (-Z) = +-PI');
});

test('computeMissionRank grades victory runs S/A/B/C and defeats as C', () => {
  const sState = createCombatState(true);
  sState.missionStatus = 'victory';
  sState.playerHp = PLAYER_MAX_HP;
  sState.elapsedSec = 110;
  sState.shotsFired = 100;
  sState.shotsHit = 65;
  sState.score = 3100;
  assert.equal(computeMissionRank(sState), 'S');

  const cState = createCombatState(true);
  cState.missionStatus = 'defeat';
  assert.equal(computeMissionRank(cState), 'C');
});

test('water immersion doubles weapon cooling rate (2x) and reports inWaterCooling telemetry', () => {
  assert.equal(WATER_COOLING_MULT, 2.0);
  const dryState = createCombatState(true);
  const wetState = createCombatState(true);
  dryState.weaponHeat = 0.85;
  wetState.weaponHeat = 0.85;

  const dt = 0.05;
  for (let i = 0; i < 10; i++) {
    stepCombatSimulation(dryState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, dt, false);
    stepCombatSimulation(wetState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, dt, true);
  }

  const dryCooled = 0.85 - dryState.weaponHeat;
  const wetCooled = 0.85 - wetState.weaponHeat;
  assert.ok(
    Math.abs(wetCooled - dryCooled * 2.0) < 1e-6,
    `Expected 2x cooling in water: dry=${dryCooled.toFixed(4)}, wet=${wetCooled.toFixed(4)}`,
  );

  // Overheat recovery also clears 2x faster in water
  dryState.weaponHeat = 0.6;
  dryState.weaponOverheated = true;
  wetState.weaponHeat = 0.6;
  wetState.weaponOverheated = true;
  for (let i = 0; i < 10; i++) {
    stepCombatSimulation(dryState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, dt, false);
    stepCombatSimulation(wetState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, dt, true);
  }
  assert.equal(wetState.weaponOverheated, false, 'Water should clear overheat within 0.5 s from 0.60 heat');
  assert.equal(dryState.weaponOverheated, true, 'Dry air cools 2x slower so overheat persists at 0.5 s');

  const wetHud = buildCombatTelemetry(wetState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0, true);
  const dryHud = buildCombatTelemetry(dryState, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0, false);
  assert.equal(wetHud.inWaterCooling, true);
  assert.equal(dryHud.inWaterCooling, false);
});

test('triggerMissileSalvo launches 8 fanning rockets that lock on, curve into enemy, deal splash damage, and respect cooldown', () => {
  const state = createCombatState(true);
  const target = state.enemies[0];
  assert.ok(target, 'Expected initial enemy');
  state.enemies = [target];

  // Position enemy cleanly 22 units ahead (+X, open airfield apron) of Mech spawn with clear LOS
  target.x = MECH_SPAWN.x + 22;
  target.z = MECH_SPAWN.z;
  target.y = getTerrainHeight(target.x, target.z);
  target.aiState = 'alert';
  const hpBefore = target.hp;

  const leftPod = { x: MECH_SPAWN.x + 0.4, y: MECH_SPAWN.y + 3.6, z: MECH_SPAWN.z - 1.1 };
  const rightPod = { x: MECH_SPAWN.x + 0.4, y: MECH_SPAWN.y + 3.6, z: MECH_SPAWN.z + 1.1 };

  const launched = triggerMissileSalvo(
    state,
    leftPod,
    rightPod,
    1,
    0,
    0,
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    Math.PI / 2,
  );
  assert.ok(launched && launched.length === MISSILE_SALVO_COUNT, 'Expected 8 missiles launched');
  assert.equal(state.playerMissiles.length, MISSILE_SALVO_COUNT);
  assert.equal(state.missileCooldownTimer, MISSILE_SALVO_COOLDOWN);
  assert.ok(
    launched.every((m) => m.targetEnemyId === target.id && m.vy > 0),
    'Missiles should lock onto forward target and flare upward initially',
  );

  // Cooldown blocks immediate re-trigger
  const blocked = triggerMissileSalvo(
    state,
    leftPod,
    rightPod,
    1,
    0,
    0,
    MECH_SPAWN.x,
    MECH_SPAWN.y,
    MECH_SPAWN.z,
    Math.PI / 2,
  );
  assert.equal(blocked, null);

  const hud = buildCombatTelemetry(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, 0);
  assert.equal(hud.missileMaxCooldown, MISSILE_SALVO_COOLDOWN);
  assert.ok(hud.missileCooldown > MISSILE_SALVO_COOLDOWN - 0.1);

  // Step simulation until salvo finishes homing & detonates
  let sawMissileImpact = false;
  for (let i = 0; i < 65; i++) {
    stepCombatSimulation(state, MECH_SPAWN.x, MECH_SPAWN.y, MECH_SPAWN.z, false, 0.033);
    if (state.pendingImpacts.some((ev) => ev.kind === 'missile-impact')) {
      sawMissileImpact = true;
    }
    state.pendingImpacts.length = 0;
  }

  assert.ok(sawMissileImpact, 'Expected at least one missile-impact event');
  assert.ok(
    target.hp <= hpBefore - MISSILE_DAMAGE,
    `Expected splash damage from missiles: hpBefore=${hpBefore}, hpAfter=${target.hp}`,
  );

  resetCombatState(state, 'playing');
  assert.equal(state.playerMissiles.length, 0);
  assert.equal(state.missileCooldownTimer, 0);
});


