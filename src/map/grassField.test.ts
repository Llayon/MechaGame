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
  createFernBushGeometry,
  createGrassClumpGeometry,
  decodeTerrainHeight16,
  encodeTerrainHeight16,
  generateGrassBushAccentsData,
  wrapGrassOffset,
} from './grassField';
import { getRoadNormalizedDistance } from './terrainMath';
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

  // Steep slopes (ny < 0.75) must be masked out cleanly
  assert.equal(checkSuitability(-75, 85) > 0 ? computeGrassSuitabilityMask(-75, 85, 6.0, 0.70) : 0, 0);

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

test('createGrassClumpGeometry constructs 7-element wildflower tussock with Vertex Colors and aBudMask', () => {
  const geo = createGrassClumpGeometry(100, 32, 0.30, 0.044);
  assert.equal(geo.instanceCount, 100);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const color = geo.getAttribute('color');
  const budMask = geo.getAttribute('aBudMask');
  const offset = geo.getAttribute('aOffset');

  // 4 grass blades (7 verts each) + 1 fern leaf (5 verts) + 2 tall stalks (7 verts each) = 47 verts
  assert.equal(pos.count, 47);
  assert.equal(uv.count, 47);
  assert.equal(color.count, 47);
  assert.equal(budMask.count, 47);
  assert.equal(offset.count, 100);

  let hasGroundBase = false;
  let hasTallStalkTip = false;
  let budCount = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = uv.getY(i);
    const bud = budMask.getX(i);
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(y) && Number.isFinite(pos.getZ(i)));
    assert.ok(Number.isFinite(color.getX(i)) && Number.isFinite(color.getY(i)) && Number.isFinite(color.getZ(i)));
    if (y === 0 && v === 0) hasGroundBase = true;
    if (y > 0.30 * 1.4 && v === 1) hasTallStalkTip = true;
    if (bud > 0.8) budCount++;
  }
  assert.ok(hasGroundBase, 'Expected grounded vertices at y=0, v=0');
  assert.ok(hasTallStalkTip, 'Expected tall seed/flower stalks reaching > 1.4x base height');
  assert.ok(budCount >= 4, `Expected widened bud tip vertices with high aBudMask, got ${budCount}`);
  geo.dispose();
});

test('generateGrassBushAccentsData places Layer 2 bushes cleanly outside water/roads and createFernBushGeometry is valid', () => {
  const bushes = generateGrassBushAccentsData(184);
  assert.ok(bushes.length >= 100 && bushes.length <= 184, `Expected 100..184 bushes, got ${bushes.length}`);

  for (const b of bushes) {
    assert.ok(Math.abs(b.x) < MAP_HALF_W && Math.abs(b.z) < MAP_HALF_D);
    assert.ok(b.y > WATER_LEVEL + 0.6, `Bush y=${b.y} too close to water`);
    assert.ok(getRoadNormalizedDistance(b.x, b.z) >= 1.03, 'Bush must stay off road surface');
    assert.ok(Number.isFinite(b.rotY) && Number.isFinite(b.scale) && b.scale > 0.5);
  }

  const fernGeo = createFernBushGeometry();
  const pos = fernGeo.getAttribute('position');
  const color = fernGeo.getAttribute('color');
  assert.equal(pos.count, 49); // 7 fronds * 7 verts
  assert.equal(color.count, 49);
  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
  }
  fernGeo.dispose();
});
