import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SECTOR7_HOLOGRAM_SIGNS,
  getHologramLightingParams,
  resolveHologramColorHex,
} from './hologramSigns';
import { BRIDGE_SPECS, distToSegment, getTerrainHeight } from './terrainMath';

test('SECTOR7_HOLOGRAM_SIGNS stays within compact 12-24 budget and uses all 4 atlas icons', () => {
  assert.ok(
    SECTOR7_HOLOGRAM_SIGNS.length >= 12 && SECTOR7_HOLOGRAM_SIGNS.length <= 24,
    `Expected 12-24 tactical signs, got ${SECTOR7_HOLOGRAM_SIGNS.length}`,
  );

  const iconCounts = new Set(SECTOR7_HOLOGRAM_SIGNS.map((s) => s.iconType));
  assert.deepEqual([...iconCounts].sort(), [0, 1, 2, 3]);
});

test('all hologram signs sit safely above terrain/water and clear 14 m Mechs on bridges', () => {
  for (const sign of SECTOR7_HOLOGRAM_SIGNS) {
    assert.ok(Number.isFinite(sign.x) && Number.isFinite(sign.y) && Number.isFinite(sign.z));
    assert.ok(Number.isFinite(sign.yaw) && sign.width > 0 && sign.height > 0);
    const groundY = getTerrainHeight(sign.x, sign.z);
    assert.ok(
      sign.y >= Math.max(0.8, groundY + 0.5),
      `Sign ${sign.id} y=${sign.y.toFixed(2)} must clear ground/water ${groundY.toFixed(2)}`,
    );

    // Bridge portals must leave >= 4.4 units vertical clearance above deck for 14 m Mechs
    for (const bridge of BRIDGE_SPECS) {
      if (bridge.style === 'viaduct') continue;
      const d = distToSegment(
        sign.x,
        sign.z,
        bridge.start[0],
        bridge.start[1],
        bridge.end[0],
        bridge.end[1],
      );
      if (d < bridge.width * 0.55) {
        const minPortalY = Math.min(bridge.startY, bridge.endY) + 4.4;
        assert.ok(
          sign.y - sign.height * 0.5 >= minPortalY - 0.3,
          `Bridge sign ${sign.id} bottom must clear Mech height on ${bridge.id}`,
        );
      }
    }
  }
});

test('no two hologram signs occupy the same spot', () => {
  for (let i = 0; i < SECTOR7_HOLOGRAM_SIGNS.length; i++) {
    for (let j = i + 1; j < SECTOR7_HOLOGRAM_SIGNS.length; j++) {
      const a = SECTOR7_HOLOGRAM_SIGNS[i];
      const b = SECTOR7_HOLOGRAM_SIGNS[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      assert.ok(d >= 3.0, `Signs ${a.id} and ${b.id} are too close (${d.toFixed(2)})`);
    }
  }
});

test('citadel clearance color switches tactical warning signs to calm teal without changing bridge signs', () => {
  const citSign = SECTOR7_HOLOGRAM_SIGNS.find((s) => s.zone === 'citadel' && s.clearedColorHex);
  const bridgeSign = SECTOR7_HOLOGRAM_SIGNS.find((s) => s.zone === 'bridge');
  assert.ok(citSign && bridgeSign);

  assert.equal(resolveHologramColorHex(citSign, false), citSign.colorHex);
  assert.equal(resolveHologramColorHex(citSign, true), citSign.clearedColorHex);
  assert.equal(resolveHologramColorHex(bridgeSign, true), bridgeSign.colorHex);

  const day = getHologramLightingParams('day');
  const night = getHologramLightingParams('night');
  assert.ok(day.backingAlpha > night.backingAlpha);
  assert.ok(day.brightness >= night.brightness);
});
