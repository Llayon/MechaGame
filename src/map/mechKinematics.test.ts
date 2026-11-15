import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  MAP_HALF_D,
  MAP_HALF_W,
  METERS_PER_UNIT,
  VIADUCT_ELBOW,
  VIADUCT_ELBOW_Y,
} from './terrainMath';
import {
  MECH_L1,
  MECH_L2,
  MECH_L3,
  MECH_SCALE,
  MECH_SPAWN,
  SmoothSpring,
  clampMechPosition,
  getWalkableSurfaceY,
  sampleMechFootSupport,
  solveReverseJointIKAngles,
  worldSpeedToKmh,
} from './mechKinematics';

test('Mech spawns cleanly on Airfield concrete apron at calibrated ~13 m height scale', () => {
  const surf = getWalkableSurfaceY(MECH_SPAWN.x, MECH_SPAWN.z);
  assert.equal(surf.inWater, false);
  assert.equal(surf.onBridge, false);
  assert.ok(Math.abs(surf.y - MECH_SPAWN.y) < 0.05, `spawn surface mismatch: ${surf.y} vs ${MECH_SPAWN.y}`);

  const mechHeightMeters = 4.44 * MECH_SCALE * METERS_PER_UNIT;
  assert.ok(
    mechHeightMeters >= 12.0 && mechHeightMeters <= 14.5,
    `Mech height=${mechHeightMeters.toFixed(1)} m must match 8-14 m arena scale`,
  );
});

test('getWalkableSurfaceY tracks bridges, island deck, serpentine viaduct bastion, and Citadel courtyard', () => {
  const bridgeMidX = (BRIDGE_SPECS[1].start[0] + BRIDGE_SPECS[1].end[0]) * 0.5;
  const bridgeMidZ = (BRIDGE_SPECS[1].start[1] + BRIDGE_SPECS[1].end[1]) * 0.5;
  const bSurf = getWalkableSurfaceY(bridgeMidX, bridgeMidZ);
  assert.equal(bSurf.onBridge, true);
  assert.equal(bSurf.inWater, false);
  assert.ok(Math.abs(bSurf.y - (BRIDGE_SPECS[1].deckY + 0.52)) < 0.15);

  const hubSurf = getWalkableSurfaceY(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1]);
  assert.equal(hubSurf.onBridge, true);
  assert.ok(Math.abs(hubSurf.y - (VIADUCT_ELBOW_Y + 0.52)) < 0.05);

  const islandSurf = getWalkableSurfaceY(ISLAND_CENTER_X, ISLAND_CENTER_Z);
  assert.equal(islandSurf.inWater, false);
  assert.ok(islandSurf.y > 6.5);

  const citadelSurf = getWalkableSurfaceY(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  assert.ok(citadelSurf.y > 18.8);

  // Passing underneath a bridge with low currentY must NOT snap Mech up onto overhead deck
  const underBridgeSurf = getWalkableSurfaceY(bridgeMidX, bridgeMidZ, 0.0);
  assert.equal(underBridgeSurf.onBridge, false);
  assert.equal(underBridgeSurf.inWater, true);
  assert.ok(underBridgeSurf.y < 0.0, `expected riverbed below water, got ${underBridgeSurf.y}`);

  // Walking along the bridge deck keeps Mech on the bridge
  const onDeckSurf = getWalkableSurfaceY(bridgeMidX, bridgeMidZ, BRIDGE_SPECS[1].deckY + 0.5);
  assert.equal(onDeckSurf.onBridge, true);
});

test('worldSpeedToKmh converts world units/sec into accurate km/h', () => {
  const walkKmh = worldSpeedToKmh(2.35);
  const sprintKmh = worldSpeedToKmh(3.45);
  assert.ok(Math.abs(walkKmh - 2.35 * METERS_PER_UNIT * 3.6) < 1e-6);
  assert.ok(walkKmh > 28 && walkKmh < 36, `expected realistic heavy mech walk km/h, got ${walkKmh}`);
  assert.ok(sprintKmh > 42 && sprintKmh < 52, `expected realistic heavy mech sprint km/h, got ${sprintKmh}`);
});

test('3-joint reverse-joint IK solver reaches foot targets accurately without NaNs', () => {
  const samples: Array<[number, number, number]> = [
    [0.12, -2.35, 0.0],
    [-0.1, -2.15, 0.85],
    [0.05, -2.0, -0.75],
    [0.0, -1.5, 0.3],
  ];

  for (const [lx, ly, lz] of samples) {
    const ik = solveReverseJointIKAngles(lx, ly, lz);
    assert.equal(Number.isFinite(ik.hipRollZ), true);
    assert.equal(Number.isFinite(ik.hipRotX), true);
    assert.equal(Number.isFinite(ik.kneeBend), true);
    assert.equal(Number.isFinite(ik.hockBend), true);
    assert.ok(ik.hipRollZ >= -0.22 && ik.hipRollZ <= 0.22);
    assert.ok(ik.kneeBend >= 0.05 && ik.kneeBend <= 2.45);

    // Forward kinematics planar check (distance from hip to ankle matches target distance)
    const endY = -(
      MECH_L1 +
      MECH_L2 * Math.cos(ik.kneeBend) +
      MECH_L3 * Math.cos(ik.kneeBend - ik.hockBend)
    );
    const endZ = -(
      MECH_L2 * Math.sin(ik.kneeBend) +
      MECH_L3 * Math.sin(ik.kneeBend - ik.hockBend)
    );
    const targetDist = Math.hypot(lx, ly, lz);
    const solvedDist = Math.hypot(endY, endZ);
    assert.ok(
      Math.abs(targetDist - solvedDist) < 0.04,
      `IK reach mismatch: target=${targetDist.toFixed(3)} solved=${solvedDist.toFixed(3)}`,
    );
  }
});

test('sampleMechFootSupport returns bounded ankle pitch/roll across pads and bridges', () => {
  const flatSupport = sampleMechFootSupport(MECH_SPAWN.x, MECH_SPAWN.z, MECH_SPAWN.yaw);
  assert.ok(Math.abs(flatSupport.pitch) < 0.05);
  assert.ok(Math.abs(flatSupport.roll) < 0.05);
  assert.equal(flatSupport.inWater, false);

  const viaduct = BRIDGE_SPECS[3];
  const vx = (viaduct.start[0] + VIADUCT_ELBOW[0]) * 0.5;
  const vz = (viaduct.start[1] + VIADUCT_ELBOW[1]) * 0.5;
  const rampSupport = sampleMechFootSupport(vx, vz, Math.atan2(VIADUCT_ELBOW[0] - viaduct.start[0], VIADUCT_ELBOW[1] - viaduct.start[1]));
  assert.equal(rampSupport.onBridge, true);
  assert.ok(rampSupport.pitch >= -0.34 && rampSupport.pitch <= 0.34);
});

test('clampMechPosition respects arena bounds and SmoothSpring converges smoothly', () => {
  const clamped = clampMechPosition(MAP_HALF_W + 50, -MAP_HALF_D - 50, 0, 0);
  assert.ok(clamped.x <= MAP_HALF_W - 10 + 1e-6);
  assert.ok(clamped.z >= -(MAP_HALF_D - 10) - 1e-6);

  const spring = new SmoothSpring(0, 8.0);
  for (let i = 0; i < 60; i++) {
    spring.update(1.0, 1 / 60);
  }
  assert.ok(Math.abs(spring.x - 1.0) < 0.02);
});
