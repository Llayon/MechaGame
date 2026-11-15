import test from 'node:test';
import assert from 'node:assert/strict';
import { PINE_TREE_TOTAL_HEIGHT, createUnifiedPineTreeGeometry } from './pineGeometry';

test('createUnifiedPineTreeGeometry merges trunk and 5 jagged tiers with valid normals and vertex colors', () => {
  const tree = createUnifiedPineTreeGeometry();
  const pos = tree.getAttribute('position');
  const norm = tree.getAttribute('normal');
  const col = tree.getAttribute('color');
  const needleTip = tree.getAttribute('aNeedleTip');

  assert.ok(
    pos && norm && col && needleTip,
    'Merged tree geometry must expose position, normal, color, and aNeedleTip attributes',
  );
  assert.ok(pos.count >= 240, `Expected non-indexed trunk + 5 jagged cone tiers, got ${pos.count} vertices`);

  let minY = Infinity;
  let maxY = -Infinity;
  let hasBark = false;
  let hasFoliage = false;
  let hasZeroTipBark = false;
  let hasBrightOuterTip = false;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const len = Math.hypot(nx, ny, nz);
    assert.ok(Math.abs(len - 1) < 1e-4, `Normal ${i} must stay unit length, got ${len}`);

    const r = col.getX(i);
    const g = col.getY(i);
    const b = col.getZ(i);
    assert.ok(r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1);

    const tip = needleTip.getX(i);
    assert.ok(Number.isFinite(tip) && tip >= 0 && tip <= 1);
    if (r > g && y < 0.75) {
      hasBark = true;
      if (tip === 0) hasZeroTipBark = true;
    }
    if (g > r && y > 0.4) {
      hasFoliage = true;
      if (tip > 0.7) hasBrightOuterTip = true;
    }
  }

  assert.ok(minY >= -0.05 && minY <= 0.02, `Tree root must sit cleanly near y=0, got ${minY}`);
  assert.ok(
    Math.abs(maxY - PINE_TREE_TOTAL_HEIGHT) < 0.06,
    `Tree apex should reach ~${PINE_TREE_TOTAL_HEIGHT}, got ${maxY}`,
  );
  assert.ok(hasBark && hasFoliage, 'Merged geometry must retain both brown bark and green foliage vertex colors');
  assert.ok(
    hasZeroTipBark && hasBrightOuterTip,
    'aNeedleTip must isolate trunk bark (0) from sunlit outer foliage tips (>0.7)',
  );

  tree.dispose();
});
