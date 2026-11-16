import test from 'node:test';
import assert from 'node:assert/strict';
import { createChiseledRockGeometry } from './rockGeometry';
import { generateRockOutcropsData } from '../../map/worldStructures';
import { getRoadNormalizedDistance } from '../../map/terrainMath';
import { MECH_SPAWN } from '../../map/mechKinematics';

test('createChiseledRockGeometry produces 80 flat-shaded triangles with finite normals and broad base', () => {
  const geo = createChiseledRockGeometry(1);
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');

  // Icosahedron(1, 1) has 80 triangles -> 240 non-indexed vertices
  assert.equal(pos.count, 240);
  assert.equal(norm.count, 240);

  let minY = Infinity;
  let maxY = -Infinity;
  let sumLowerR = 0;
  let countLower = 0;
  let sumUpperR = 0;
  let countUpper = 0;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    assert.ok(
      Number.isFinite(norm.getX(i)) &&
        Number.isFinite(norm.getY(i)) &&
        Number.isFinite(norm.getZ(i)),
    );
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const r = Math.hypot(x, z);
    if (y < -0.1) {
      sumLowerR += r;
      countLower++;
    } else if (y > 0.3) {
      sumUpperR += r;
      countUpper++;
    }
  }

  assert.ok(minY < -0.4 && maxY > 0.65);
  assert.ok(countLower > 0 && countUpper > 0);
  assert.ok(
    sumLowerR / countLower > sumUpperR / countUpper,
    'Rock base should be wider than upper peak for natural ground stability',
  );
  geo.dispose();
});

test('generateRockOutcropsData produces hero + satellite clusters clear of spawn and roads with 3-axis rotations', () => {
  const rocks = generateRockOutcropsData();
  assert.ok(rocks.length >= 400 && rocks.length <= 860, `Expected 400..860 rocks, got ${rocks.length}`);

  let heroCount = 0;
  let rubbleCount = 0;
  for (const r of rocks) {
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.z));
    assert.ok(Number.isFinite(r.rotX) && Number.isFinite(r.rotY) && Number.isFinite(r.rotZ));
    assert.ok(Math.hypot(r.x - MECH_SPAWN.x, r.z - MECH_SPAWN.z) > 10, 'No rocks near spawn');
    assert.ok(getRoadNormalizedDistance(r.x, r.z) > 1.0, 'No rocks on road surface');
    if (r.tier === 'hero') heroCount++;
    if (r.tier === 'rubble') rubbleCount++;
  }

  assert.ok(heroCount >= 60, `Expected substantial hero boulders, got ${heroCount}`);
  assert.ok(rubbleCount >= 180, `Expected substantial small rubble satellites, got ${rubbleCount}`);
});
