import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HORIZON_LANDMARK_COORDS,
  buildPowerlineCatenarySegments,
  createHorizonLandmarksGeometry,
  generateHorizonLandmarksData,
  isOutsidePlayableBounds,
} from './horizonLandmarks';

test('all horizon landmarks sit strictly outside playable bounds and ground into outer ridges', () => {
  const specs = generateHorizonLandmarksData();
  assert.equal(specs.length, HORIZON_LANDMARK_COORDS.length);
  assert.equal(specs.length, 3);

  for (const spec of specs) {
    assert.ok(
      isOutsidePlayableBounds(spec.x, spec.z),
      `landmark ${spec.id} at (${spec.x}, ${spec.z}) must sit outside playable arena`,
    );
    assert.ok(Number.isFinite(spec.groundY));
    assert.ok(spec.peakHeight >= 40);
  }
});

test('createHorizonLandmarksGeometry stays ultra-low-poly with finite vertex data', () => {
  const geom = createHorizonLandmarksGeometry();
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const col = geom.getAttribute('color');

  const triCount = pos.count / 3;
  assert.ok(triCount >= 120 && triCount <= 420, `unexpected triCount=${triCount}`);
  assert.equal(norm.count, pos.count);
  assert.equal(col.count, pos.count);

  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    if (y > maxY) maxY = y;
  }
  assert.ok(maxY > 85, `spire crest should pierce high horizon sky, got maxY=${maxY}`);

  geom.dispose();
});

test('buildPowerlineCatenarySegments produces sagging twin wires below straight-line midpoint', () => {
  const poles = [
    { x: 0, y: 10, z: 0 },
    { x: 30, y: 10, z: 0 },
  ];
  const verts = buildPowerlineCatenarySegments(poles, 2.4, 0.35, 6);
  // 1 span * 2 wires * 6 segments * 6 floats = 72 floats
  assert.equal(verts.length, 72);

  // Midpoint of wire 0 lies at segment index 2 end / segment index 3 start (t = 0.5)
  const midY = verts[2 * 6 + 4];
  assert.ok(midY < 10 + 2.4 - 0.5, `expected noticeable sag below 12.4, got ${midY}`);
  assert.ok(midY > 10 + 0.5, `wire should not sag into ground, got ${midY}`);
});
