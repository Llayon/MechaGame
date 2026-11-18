import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  getTerrainHeight,
} from './terrainMath';
import { castCombatRay, hasLineOfSight } from './worldRaycaster';

test('open-air skyward ray finds no obstruction', () => {
  const y0 = getTerrainHeight(-115, 93) + 3.0;
  const hit = castCombatRay(-115, y0, 93, 0.5, 0.45, -0.7, 90);
  assert.equal(hit, null);
});

test('terrain ground blocks downward ray accurately', () => {
  const gx = -115;
  const gz = 93;
  const groundY = getTerrainHeight(gx, gz) + 0.35; // airfield pad
  const hit = castCombatRay(gx, groundY + 4.0, gz, 0, -1, 0, 20);
  assert.ok(hit !== null);
  assert.equal(hit.kind, 'terrain');
  assert.ok(Math.abs(hit.y - groundY) < 0.45, `Expected hit.y near ${groundY}, got ${hit.y}`);
});

test('citadel curtain wall blocks low gunfire while south gate remains open for line of sight', () => {
  const citGround = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;
  // East curtain wall i=7 sits at +CITADEL_WALL_RX * cos(pi/8)
  const wallX = CITADEL_CENTER_X + CITADEL_WALL_RX * Math.cos(Math.PI / 8);
  const blocked = hasLineOfSight(
    wallX - 10,
    citGround + 2.0,
    CITADEL_CENTER_Z,
    wallX + 10,
    citGround + 2.0,
    CITADEL_CENTER_Z,
  );
  assert.equal(blocked, false, 'Expected Citadel East curtain wall to block horizontal LOS');

  // South gate at x = 122, z ≈ -38 should have clear LOS into courtyard at z = -55
  const outsideY = getTerrainHeight(122, -32) + 2.0;
  const insideY = citGround + 2.0;
  const gateOpen = hasLineOfSight(122, outsideY, -32, 122, insideY, -55);
  assert.equal(gateOpen, true, 'Expected Citadel South Gate to allow line of sight');
});

test('waist-high anti-mech barricades block low ground shots while elevated mech turrets shoot over them', () => {
  // Barricade node [-172, 24.5] (hedgehog)
  const bx = -172;
  const bz = 24.5;
  const gy = getTerrainHeight(bx, bz);
  const lowShot = hasLineOfSight(bx, gy + 0.55, bz - 5, bx, gy + 0.55, bz + 5);
  const turretShot = hasLineOfSight(bx, gy + 2.45, bz - 5, bx, gy + 2.45, bz + 5);
  assert.equal(lowShot, false, 'Low shot should be stopped by barricade');
  assert.equal(turretShot, true, 'Elevated Mech turret should clear waist-high barricade');
});

test('ray passes cleanly underneath center bridge deck without false collision', () => {
  const b = BRIDGE_SPECS[1];
  const mx = (b.start[0] + b.end[0]) * 0.5;
  const mz = (b.start[1] + b.end[1]) * 0.5;
  // Shoot horizontally parallel to river underneath deckY (~5.5) at y = 1.6
  const dx = -(b.end[1] - b.start[1]);
  const dz = b.end[0] - b.start[0];
  const len = Math.hypot(dx, dz);
  const ux = (dx / len) * 10;
  const uz = (dz / len) * 10;
  const underClear = hasLineOfSight(mx - ux, 1.6, mz - uz, mx + ux, 1.6, mz + uz);
  assert.equal(underClear, true, 'Expected ray underneath center bridge deck to remain clear');
});

test('castCombatRay returns outward unit surface normals for terrain and vertical walls', () => {
  const gx = -115;
  const gz = 93;
  const groundY = getTerrainHeight(gx, gz) + 0.35;
  const groundHit = castCombatRay(gx, groundY + 5, gz, 0, -1, 0, 20);
  assert.ok(groundHit !== null);
  assert.ok(groundHit.ny > 0.7, `Expected upward terrain normal, got ${groundHit.ny}`);
  const gLen = Math.hypot(groundHit.nx, groundHit.ny, groundHit.nz);
  assert.ok(Math.abs(gLen - 1) < 1e-4, `Expected unit normal length, got ${gLen}`);

  const citGround = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;
  const wallX = CITADEL_CENTER_X + CITADEL_WALL_RX * Math.cos(Math.PI / 8);
  const wallHit = castCombatRay(wallX + 12, citGround + 2.0, CITADEL_CENTER_Z, -1, 0, 0, 30);
  assert.ok(wallHit !== null);
  assert.equal(wallHit.kind, 'obstacle');
  assert.ok(wallHit.nx > 0.5, `Expected outward +X normal facing shooter, got nx=${wallHit.nx}`);
  assert.ok(Math.abs(wallHit.ny) < 0.25, `Expected near-horizontal wall normal, got ny=${wallHit.ny}`);
});

