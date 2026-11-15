import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  MAP_HALF_D,
  MAP_HALF_W,
  ROAD_MAIN_WEST,
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
  getTerrainHeight,
} from './terrainMath';
import {
  GRASS_MAX_Y,
  GRASS_MIN_Y,
  bakeTerrainGrassMap,
  computeGrassSuitabilityMask,
  createGrassClumpGeometry,
  decodeTerrainHeight16,
  encodeTerrainHeight16,
  wrapGrassOffset,
} from './grassField';
import { MECH_SPAWN } from './mechKinematics';

test('16-bit terrain height encode/decode preserves sub-millimeter precision', () => {
  const samples = [GRASS_MIN_Y, -1.25, 0.0, 5.42, 18.5, 31.7, GRASS_MAX_Y];
  for (const h of samples) {
    const [r, g] = encodeTerrainHeight16(h);
    const decoded = decodeTerrainHeight16(r, g);
    assert.ok(
      Math.abs(decoded - h) < 0.002,
      `Height ${h} decoded to ${decoded} (err=${Math.abs(decoded - h)})`,
    );
  }
});

test('wrapGrassOffset stays world-locked around moving center within [-patchSize/2, patchSize/2)', () => {
  const patchSize = 64;
  const offset = 18.5;

  // Across gradual movement inside window, world position = center + rel stays identical
  const w0 = 10.0 + wrapGrassOffset(offset, 10.0, patchSize);
  const w1 = 22.3 + wrapGrassOffset(offset, 22.3, patchSize);
  const w2 = 34.7 + wrapGrassOffset(offset, 34.7, patchSize);

  assert.ok(Math.abs(w0 - offset) < 1e-6);
  assert.ok(Math.abs(w1 - offset) < 1e-6);
  assert.ok(Math.abs(w2 - offset) < 1e-6);

  // Across wrap boundary, shifted world position jumps cleanly by exact integer multiple of patchSize
  const relFar = wrapGrassOffset(offset, 60.0, patchSize);
  assert.ok(relFar >= -patchSize * 0.5 && relFar < patchSize * 0.5);
  assert.ok(Math.abs((60.0 + relFar) - (offset + patchSize)) < 1e-6);
});

test('computeGrassSuitabilityMask excludes water, concrete pads, roads, and steep rock slopes', () => {
  const checkSuitability = (x: number, z: number) => {
    const y = getTerrainHeight(x, z);
    const n = getAnalyticalTerrainNormal(x, z, 1.95, true);
    return computeGrassSuitabilityMask(x, z, y, n.ny);
  };

  // Water channel center must have 0 grass
  assert.equal(checkSuitability(-45, -18), 0);

  // Concrete bases (Helipad spawn, Island deck, Citadel courtyard) must have 0 grass
  assert.equal(checkSuitability(MECH_SPAWN.x, MECH_SPAWN.z), 0);
  assert.equal(checkSuitability(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z), 0);
  assert.equal(checkSuitability(ISLAND_CENTER_X, ISLAND_CENTER_Z), 0);
  assert.equal(checkSuitability(CITADEL_CENTER_X, CITADEL_CENTER_Z), 0);

  // Road centerline must have 0 grass
  const [rx, rz] = ROAD_MAIN_WEST[1];
  assert.equal(checkSuitability(rx, rz), 0);

  // Out-of-bounds must have 0 grass
  assert.equal(checkSuitability(MAP_HALF_W + 5, 0), 0);
  assert.equal(checkSuitability(0, -MAP_HALF_D - 5), 0);

  // Natural gentle meadow off the SW road & east of Helipad must support lush grass
  let foundMeadow = false;
  for (let gx = -90; gx <= -60; gx += 4) {
    for (let gz = 75; gz <= 105; gz += 4) {
      const y = getTerrainHeight(gx, gz);
      const s = checkSuitability(gx, gz);
      if (y > WATER_LEVEL + 1.5 && s > 0.7) {
        foundMeadow = true;
      }
    }
  }
  assert.ok(foundMeadow, 'Expected lush natural grass suitability in SW meadow outside roads/pads');
});

test('bakeTerrainGrassMap produces valid 4-channel texture buffer with non-trivial suitability', () => {
  const w = 64;
  const h = 56;
  const buf = bakeTerrainGrassMap(w, h);
  assert.equal(buf.length, w * h * 4);

  let grassCells = 0;
  let waterOrConcreteZeroCells = 0;
  for (let i = 0; i < w * h; i++) {
    const b = buf[i * 4 + 2];
    if (b > 180) grassCells++;
    if (b === 0) waterOrConcreteZeroCells++;
  }
  assert.ok(grassCells > 200, `Expected substantial grassy cells, got ${grassCells}`);
  assert.ok(waterOrConcreteZeroCells > 200, 'Expected excluded water/pad/border cells');
});

test('createGrassClumpGeometry constructs grounded 5-blade tuft geometry without NaNs', () => {
  const geo = createGrassClumpGeometry(100, 32, 0.30, 0.044);
  assert.equal(geo.instanceCount, 100);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const offset = geo.getAttribute('aOffset');

  assert.equal(pos.count, 25); // 5 blades * 5 verts
  assert.equal(uv.count, 25);
  assert.equal(offset.count, 100);

  let hasGroundBase = false;
  let hasTip = false;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = uv.getY(i);
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(y) && Number.isFinite(pos.getZ(i)));
    if (y === 0 && v === 0) hasGroundBase = true;
    if (y > 0.2 && v === 1) hasTip = true;
  }
  assert.ok(hasGroundBase && hasTip);
  geo.dispose();
});
