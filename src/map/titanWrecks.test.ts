import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ROADS,
  BRIDGE_SPECS,
  MAP_HALF_D,
  MAP_HALF_W,
  distToPolyline,
  distToSegment,
  getTerrainHeight,
} from './terrainMath';
import {
  MECH_SPAWN,
  clampMechPosition,
  getWalkableSurfaceY,
} from './mechKinematics';
import { resolveWorldObstacles } from './worldColliders';
import { castCombatRay, hasLineOfSight } from './worldRaycaster';
import {
  TITAN_BREACH_TREES,
  TITAN_WALKABLE_DECKS,
  TITAN_WRECKS,
  createTitanWrecksGeometry,
  getTitanWreckColliders,
  getTitanWreckDeckYAt,
} from './titanWrecks';

test('Titan wrecks sit cleanly inside playable bounds without blocking roads, bridges, or MECH_SPAWN', () => {
  assert.equal(TITAN_WRECKS.length, 2);

  for (const w of TITAN_WRECKS) {
    assert.ok(Math.abs(w.origin[0]) < MAP_HALF_W - 8);
    assert.ok(Math.abs(w.origin[1]) < MAP_HALF_D - 8);
  }

  for (const deck of TITAN_WALKABLE_DECKS) {
    for (const [x, z] of [deck.start, deck.end]) {
      const dRoad = Math.min(...ALL_ROADS.map((r) => distToPolyline(x, z, r)));
      assert.ok(dRoad > 8.0, `Titan deck ${deck.id} endpoint too close to road (${dRoad})`);
      const dBridge = Math.min(
        ...BRIDGE_SPECS.map((b) =>
          distToSegment(x, z, b.start[0], b.start[1], b.end[0], b.end[1]),
        ),
      );
      assert.ok(dBridge > 20.0, `Titan deck ${deck.id} overlaps bridge (${dBridge})`);
    }
  }

  assert.equal(
    resolveWorldObstacles(MECH_SPAWN.x, MECH_SPAWN.z, MECH_SPAWN.y).collided,
    false,
  );
});

test('Frigate spine bridge supports walkable traversal from South Bank to Central Island while keeping under-span river clear', () => {
  const startSurf = getWalkableSurfaceY(-12.0, 80.0);
  const midX = -10.0;
  const midZ = 54.25;
  const midDeckY = getTitanWreckDeckYAt(midX, midZ);
  assert.ok(midDeckY !== null && midDeckY > 4.8 && midDeckY < 6.4);

  // Walking along the spine deck keeps Mech elevated above the river
  const onSpine = getWalkableSurfaceY(midX, midZ, midDeckY!);
  assert.equal(onSpine.onBridge, true);
  assert.equal(onSpine.inWater, false);
  assert.ok(Math.abs(onSpine.y - midDeckY!) < 0.05);

  // Mid-spine walking path must not collide with flank rib guardrails
  assert.equal(resolveWorldObstacles(midX, midZ, midDeckY!).collided, false);

  // Swimming/wading in the river underneath mid-span must NOT snap up onto the frigate spine
  const underSpine = getWalkableSurfaceY(midX, midZ, -2.5);
  assert.equal(underSpine.onBridge, false);
  assert.equal(underSpine.inWater, true);
  assert.ok(underSpine.y < 0);

  // South entry sits flush with riverbank terrain
  assert.ok(Math.abs(startSurf.y - getTerrainHeight(-12.0, 80.0)) < 0.25);
});

test('Siege Walker leg-ramp climbs smoothly onto East Quarry shoulder deck even over steep hillside', () => {
  const footX = 162.0;
  const footZ = 16.8;
  const footSurf = getWalkableSurfaceY(footX, footZ);
  assert.ok(Math.abs(footSurf.y - getTerrainHeight(footX, footZ)) < 0.2);

  // Step forward up the leg-ramp onto shoulder firing deck
  let curX = footX;
  let curZ = footZ;
  let curY = footSurf.y;
  for (let s = 1; s <= 12; s++) {
    const t = s / 12;
    const nextX = 162.0 + (178.5 - 162.0) * t;
    const nextZ = 16.8 + (19.4 - 16.8) * t;
    const nextPos = clampMechPosition(nextX, nextZ, curX, curZ, curY);
    assert.ok(
      Math.hypot(nextPos.x - nextX, nextPos.z - nextZ) < 0.25,
      `Step ${s} blocked climbing walker leg-ramp: wanted (${nextX.toFixed(1)}, ${nextZ.toFixed(1)}), got (${nextPos.x.toFixed(1)}, ${nextPos.z.toFixed(1)})`,
    );
    curX = nextPos.x;
    curZ = nextPos.z;
    curY = getWalkableSurfaceY(curX, curZ, curY).y;
  }
  assert.ok(curY > 13.5, `Expected shoulder deck elevation > 13.5, got ${curY}`);
});

test('Titan armor bulwarks and reactor hull block gunfire and movement for real ballistic cover', () => {
  const colliders = getTitanWreckColliders();
  assert.ok(colliders.length >= 10);

  // Frigate starboard rib guardrail should catch shots aimed laterally across mid-span at chest height
  const midY = getTitanWreckDeckYAt(-10.0, 54.25)!;
  const acrossRibLos = hasLineOfSight(
    -18.0,
    midY + 1.1,
    50.0,
    -2.0,
    midY + 1.1,
    50.0,
  );
  assert.equal(acrossRibLos, false, 'Frigate dorsal armor rib must block lateral gunfire');

  // High overhead gunfire clears waist-high rib cover
  const overheadLos = hasLineOfSight(
    -18.0,
    midY + 4.2,
    50.0,
    -2.0,
    midY + 4.2,
    50.0,
  );
  assert.equal(overheadLos, true, 'High shots above dorsal rib should remain clear');

  // Siege Walker rear reactor shield blocks shots fired across Quarry air toward mountain flank
  const hit = castCombatRay(172, 16.0, 20.5, 1, 0, 0, 25);
  assert.ok(hit !== null);
  assert.equal(hit.tag, 'titan-wreck');
});

test('createTitanWrecksGeometry emits valid finite attributes, buried anchors, and curated breach pines', () => {
  const geom = createTitanWrecksGeometry();
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const col = geom.getAttribute('color');
  const burial = geom.getAttribute('aBurial');
  const wear = geom.getAttribute('aDeckWear');

  assert.ok(pos && pos.count > 300, 'Expected substantial low-poly composite geometry');
  assert.equal(norm.count, pos.count);
  assert.equal(col.count, pos.count);
  assert.equal(burial.count, pos.count);
  assert.equal(wear.count, pos.count);

  let minBurial = Infinity;
  let maxWear = 0;
  for (let i = 0; i < pos.count; i++) {
    assert.equal(Number.isFinite(pos.getX(i)), true);
    assert.equal(Number.isFinite(pos.getY(i)), true);
    assert.equal(Number.isFinite(pos.getZ(i)), true);
    assert.equal(Number.isFinite(burial.getX(i)), true);
    if (burial.getX(i) < minBurial) minBurial = burial.getX(i);
    if (wear.getX(i) > maxWear) maxWear = wear.getX(i);
  }
  assert.ok(minBurial < -0.5, `Expected deeply embedded hull anchors below terrain, got minBurial=${minBurial}`);
  assert.ok(maxWear >= 0.9, 'Expected walkable deck tread markings on spine/ramp plates');
  geom.dispose();

  assert.equal(TITAN_BREACH_TREES.length, 8);
  for (const t of TITAN_BREACH_TREES) {
    assert.ok(t.y >= getTerrainHeight(t.x, t.z), 'Breach tree must sit inside hull crater above local slope');
  }
});
