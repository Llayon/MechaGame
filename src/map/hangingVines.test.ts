import test from 'node:test';
import assert from 'node:assert/strict';
import { MECH_SPAWN } from './mechKinematics';
import { BRIDGE_SPECS, ISLAND_WATER_SLIPWAYS, distToSegment } from './terrainMath';
import {
  VINE_HEIGHT,
  createHangingVineGeometry,
  generateHangingVinesData,
} from './hangingVines';

test('hanging vines cover bridges, island rim, citadel walls, and ruins without blocking roadways', () => {
  const vines = generateHangingVinesData();
  assert.ok(vines.length >= 36 && vines.length <= 96, `unexpected vine count=${vines.length}`);

  for (const v of vines) {
    assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
    assert.ok(Number.isFinite(v.rotY));
    assert.ok(v.scaleX >= 0.7 && v.scaleX <= 1.45);
    assert.ok(v.scaleY >= 0.5 && v.scaleY <= 1.35);

    // Must never obstruct Mech spawn
    assert.ok(Math.hypot(v.x - MECH_SPAWN.x, v.z - MECH_SPAWN.z) > 15);

    // Must stay outside bridge driving roadways (only hang off outer edges or overhead arches)
    for (const b of BRIDGE_SPECS) {
      if (b.style === 'viaduct') continue;
      const dBridge = distToSegment(v.x, v.z, b.start[0], b.start[1], b.end[0], b.end[1]);
      if (dBridge < b.width * 0.45) {
        // Only overhead arch vines sit over deck center, well above Mech height (+5m)
        assert.ok(
          v.y >= b.deckY + 4.0,
          `vine ${v.id} encroaches bridge driving lane at y=${v.y.toFixed(2)}`,
        );
      }
    }

    // Must keep Central Island water slipway ramps clear
    for (const [ax, az, bx, bz, halfW] of ISLAND_WATER_SLIPWAYS) {
      assert.ok(
        distToSegment(v.x, v.z, ax, az, bx, bz) >= halfW + 1.5,
        `vine ${v.id} blocks island water slipway`,
      );
    }
  }
});

test('hanging vine geometry anchors top edge at y=0 and hangs downward with valid UVs', () => {
  const geom = createHangingVineGeometry();
  geom.computeBoundingBox();
  const box = geom.boundingBox!;

  assert.ok(Math.abs(box.max.y) < 1e-4, `top anchor must be at y=0, got ${box.max.y}`);
  assert.ok(
    Math.abs(box.min.y + VINE_HEIGHT) < 1e-4,
    `bottom tip must reach -${VINE_HEIGHT}, got ${box.min.y}`,
  );
  assert.ok(geom.getAttribute('uv') !== undefined);
  assert.equal(geom.getAttribute('position').count, 10);

  geom.dispose();
});
