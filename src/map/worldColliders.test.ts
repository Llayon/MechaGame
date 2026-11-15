import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  getTerrainHeight,
} from './terrainMath';
import { MECH_SPAWN, clampMechPosition } from './mechKinematics';
import {
  MECH_COLLISION_RADIUS,
  getWorldColliderCount,
  resolveWorldObstacles,
} from './worldColliders';
import { BUNKER_COORDS, generatePineForestData } from './worldStructures';

test('worldColliders builds comprehensive static obstacle index and keeps MECH_SPAWN clear', () => {
  const count = getWorldColliderCount();
  assert.ok(count > 2000, `expected >2000 world colliders including forest/rocks, got ${count}`);

  const spawnCheck = resolveWorldObstacles(MECH_SPAWN.x, MECH_SPAWN.z, MECH_SPAWN.y);
  assert.equal(spawnCheck.collided, false);
});

test('clampMechPosition blocks penetration and slides diagonally along Airfield hangar wall', () => {
  // Hangar 1 is at Airfield local (-18, -26) with Airfield rotY = -0.22
  const rot = -0.22;
  const lx = -18.0;
  const lz = -26.0;
  const wx = AIRFIELD_CENTER_X + lx * Math.cos(rot) + lz * Math.sin(rot);
  const wz = AIRFIELD_CENTER_Z - lx * Math.sin(rot) + lz * Math.cos(rot);
  const y = getTerrainHeight(wx, wz) + 0.35;

  // Approach from outside south wall (local z = -18.5 -> -19.2) diagonally along +X
  const prevLX = -18.0;
  const prevLZ = -18.5;
  const prevWX = AIRFIELD_CENTER_X + prevLX * Math.cos(rot) + prevLZ * Math.sin(rot);
  const prevWZ = AIRFIELD_CENTER_Z - prevLX * Math.sin(rot) + prevLZ * Math.cos(rot);

  const nextLX = -16.8;
  const nextLZ = -19.2;
  const nextWX = AIRFIELD_CENTER_X + nextLX * Math.cos(rot) + nextLZ * Math.sin(rot);
  const nextWZ = AIRFIELD_CENTER_Z - nextLX * Math.sin(rot) + nextLZ * Math.cos(rot);

  const resolved = clampMechPosition(nextWX, nextWZ, prevWX, prevWZ, y);
  // Convert resolved world back to hangar local frame
  const dx = resolved.x - wx;
  const dz = resolved.z - wz;
  const resLX = dx * Math.cos(rot) - dz * Math.sin(rot);
  const resLZ = dx * Math.sin(rot) + dz * Math.cos(rot);

  // Must stay outside halfD (5.9) + MECH_COLLISION_RADIUS (1.15) = 7.05, while sliding in +X
  assert.ok(resLZ >= 5.9 + MECH_COLLISION_RADIUS - 1e-4, `Mech penetrated hangar: resLZ=${resLZ}`);
  assert.ok(resLX > 0.5, `Mech should slide diagonally along hangar wall: resLX=${resLX}`);
});

test('Citadel perimeter blocks curtain wall penetration while keeping South Gate open', () => {
  const citY = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;

  // Wall segment 7 is East curtain wall midpoint (x = CITADEL_WALL_RX * cos(pi/8), z = 0)
  const eastWallX = CITADEL_CENTER_X + CITADEL_WALL_RX * Math.cos(Math.PI / 8);
  const eastWallZ = CITADEL_CENTER_Z;
  const wallHit = resolveWorldObstacles(eastWallX, eastWallZ, citY);
  assert.equal(wallHit.collided, true);
  assert.equal(wallHit.hitTag, 'citadel-wall');

  // Wall segment 1 is South Gate (z = +CITADEL_WALL_RZ * cos(pi/8), open central gateway)
  const gateMidX = CITADEL_CENTER_X;
  const gateMidZ = CITADEL_CENTER_Z + CITADEL_WALL_RZ * Math.cos(Math.PI / 8);
  const gateCheck = resolveWorldObstacles(gateMidX, gateMidZ, citY);
  assert.equal(gateCheck.collided, false, 'South Citadel gate should remain passable');
});

test('Bridge height bands isolate under-bridge pier collisions from on-deck cargo cover', () => {
  const centerBridge = BRIDGE_SPECS[1];
  const dx = centerBridge.end[0] - centerBridge.start[0];
  const dz = centerBridge.end[1] - centerBridge.start[1];
  const deckMidY = centerBridge.deckY + 0.52;

  // Under bridge at pier column f = 0.28: should collide at riverbed y=0, clear on bridge deck
  const yaw = Math.atan2(dx, dz);
  const pierSide = centerBridge.width * 0.28;
  const pierX = centerBridge.start[0] + dx * 0.28 + pierSide * Math.cos(yaw);
  const pierZ = centerBridge.start[1] + dz * 0.28 - pierSide * Math.sin(yaw);

  const underPierHit = resolveWorldObstacles(pierX, pierZ, 0.0);
  assert.equal(underPierHit.collided, true);
  assert.equal(underPierHit.hitTag, 'bridge-pier');

  // At deck height, the underwater pier below does NOT block traversal on the deck
  const onDeckCenter = resolveWorldObstacles(
    (centerBridge.start[0] + centerBridge.end[0]) * 0.5,
    (centerBridge.start[1] + centerBridge.end[1]) * 0.5,
    deckMidY,
  );
  assert.notEqual(onDeckCenter.hitTag, 'bridge-pier');
});

test('Bunkers, Central Derrick Tower, and pine trunks block penetration', () => {
  const bunker = BUNKER_COORDS[0];
  const bY = getTerrainHeight(bunker.x, bunker.z);
  assert.equal(resolveWorldObstacles(bunker.x + 1.0, bunker.z, bY).collided, true);

  const derrickY = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z) + 0.7;
  assert.equal(resolveWorldObstacles(ISLAND_CENTER_X + 1.0, ISLAND_CENTER_Z, derrickY).collided, true);

  const tree = generatePineForestData().trees[0];
  assert.equal(resolveWorldObstacles(tree.x + 0.1, tree.z, tree.y).collided, true);
});
