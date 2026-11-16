import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MECH_SPAWN,
  getWalkableSurfaceY,
  shouldEmitTerrainKickup,
} from '../../map/mechKinematics';
import {
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ROAD_MAIN_WEST,
  WATER_LEVEL,
  getTerrainHeight,
} from '../../map/terrainMath';
import {
  KICKUP_POOL_SIZE,
  computePebbleTransform,
  createKickupPool,
  resetKickupPool,
  spawnKickupBurst,
  stepKickupPool,
  type PebbleTransform,
} from './TerrainKickup';

function seededRng(seed = 1337): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('spawnKickupBurst launches backward parabolic pebbles within fixed pool capacity', () => {
  const pool = createKickupPool(40);
  assert.equal(pool.slots.length, KICKUP_POOL_SIZE);

  spawnKickupBurst(pool, {
    originX: 10,
    originY: 2.2,
    originZ: 20,
    dirX: 0,
    dirZ: -1, // thrown backward along -Z
    groundY: 2.0,
    count: 5,
    speedScale: 1.2,
    rng: seededRng(7),
  });

  const active = stepKickupPool(pool, 0.05);
  assert.equal(active, 5);

  const out: PebbleTransform = {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
  };
  for (let i = 0; i < 5; i++) {
    const ok = computePebbleTransform(pool.slots[i], out);
    assert.equal(ok, true);
    assert.ok(out.y > 2.04, `pebble ${i} should arc upward initially, got y=${out.y}`);
    assert.ok(out.z < 20.1, `pebble ${i} should fly backward toward -Z, got z=${out.z}`);
    assert.ok(out.sx > 0 && out.sy > 0 && out.sz > 0);
  }
});

test('pebbles follow y = vy*t - 0.5*g*t^2, clamp above groundY, and expire cleanly', () => {
  const pool = createKickupPool(16);
  spawnKickupBurst(pool, {
    originX: 0,
    originY: 1.0,
    originZ: 0,
    dirX: -1,
    dirZ: 0,
    groundY: 1.0,
    count: 4,
    rng: seededRng(42),
  });

  const out: PebbleTransform = {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
  };

  stepKickupPool(pool, 0.14);
  computePebbleTransform(pool.slots[0], out);
  const peakY = out.y;
  assert.ok(peakY > 1.15, `expected upward parabolic arc, got ${peakY}`);

  // Advance close to end of flight so pebble drops to groundY and clamps cleanly
  stepKickupPool(pool, 0.38);
  if (pool.slots[0].active) {
    computePebbleTransform(pool.slots[0], out);
    assert.ok(out.y >= 1.04, `pebble must never fall below groundY+0.04, got ${out.y}`);
  }

  // Advance past maxLife
  const remaining = stepKickupPool(pool, 1.0);
  assert.equal(remaining, 0);
  assert.equal(computePebbleTransform(pool.slots[0], out), false);
  assert.equal(out.sx, 0);
});

test('ring buffer wraps safely when bursts exceed capacity and resetKickupPool clears all', () => {
  const pool = createKickupPool(8);
  for (let b = 0; b < 5; b++) {
    spawnKickupBurst(pool, {
      originX: b,
      originY: 0.5,
      originZ: 0,
      dirX: 0,
      dirZ: -1,
      groundY: 0.4,
      count: 4,
      rng: seededRng(b + 1),
    });
  }
  const active = stepKickupPool(pool, 0.01);
  assert.equal(active, 8);

  resetKickupPool(pool);
  assert.equal(pool.activeCount, 0);
  assert.equal(stepKickupPool(pool, 0.01), 0);
});

test('shouldEmitTerrainKickup suppresses gravel on concrete slabs, bridges, and water while allowing soil/road/meadow', () => {
  // Airfield concrete Helipad spawn -> no gravel kickup
  const spawnSurf = getWalkableSurfaceY(MECH_SPAWN.x, MECH_SPAWN.z, MECH_SPAWN.y);
  assert.equal(spawnSurf.onConcrete, true);
  assert.equal(shouldEmitTerrainKickup(MECH_SPAWN.x, MECH_SPAWN.z, spawnSurf.y, MECH_SPAWN.y), false);

  // Island concrete deck -> no gravel kickup
  const islandSurf = getWalkableSurfaceY(ISLAND_CENTER_X, ISLAND_CENTER_Z);
  assert.equal(islandSurf.onConcrete, true);
  assert.equal(shouldEmitTerrainKickup(ISLAND_CENTER_X, ISLAND_CENTER_Z, islandSurf.y), false);

  // Citadel concrete courtyard -> no gravel kickup
  const citSurf = getWalkableSurfaceY(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  assert.equal(citSurf.onConcrete, true);
  assert.equal(shouldEmitTerrainKickup(CITADEL_CENTER_X, CITADEL_CENTER_Z, citSurf.y), false);

  // Bridge deck midpoint -> no gravel kickup when mech is on deck
  const b0 = BRIDGE_SPECS[0];
  const bx = (b0.start[0] + b0.end[0]) * 0.5;
  const bz = (b0.start[1] + b0.end[1]) * 0.5;
  const bridgeSurf = getWalkableSurfaceY(bx, bz, Math.max(b0.startY, b0.endY) + 1.0);
  assert.equal(bridgeSurf.onBridge, true);
  assert.equal(shouldEmitTerrainKickup(bx, bz, bridgeSurf.y, bridgeSurf.y), false);

  // Submerged water -> no dry gravel kickup
  assert.equal(shouldEmitTerrainKickup(-45, -18, WATER_LEVEL - 0.5), false);

  // Natural dirt road & grassy hillside off the Helipad -> gravel kickup active
  const [rx, rz] = ROAD_MAIN_WEST[2];
  const roadY = getTerrainHeight(rx, rz);
  assert.equal(shouldEmitTerrainKickup(rx, rz, roadY, roadY), true);
  const meadowY = getTerrainHeight(-80, 90);
  assert.equal(shouldEmitTerrainKickup(-80, 90, meadowY, meadowY), true);
});
