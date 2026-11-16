import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKY_BIRD_FLOCKS,
  SKY_BIRD_TOTAL_COUNT,
  computeBirdFlapState,
  createBirdGeometry,
  evaluateBirdWorldPosition,
  generateSkyBirdsData,
} from './skyBirds';

test('createBirdGeometry builds exactly 4 triangles with rigid body/tail and articulated wingtips', () => {
  const geom = createBirdGeometry();
  const pos = geom.getAttribute('position');
  const wing = geom.getAttribute('aWingWeight');

  assert.equal(pos.count, 12);
  assert.equal(pos.count / 3, 4);
  assert.equal(wing.count, 12);

  // Body (0..2) and tail (3..5) must stay rigid (0 wing flex)
  for (let i = 0; i < 6; i++) {
    assert.equal(wing.getX(i), 0);
  }
  // Wingtips (index 7 left, index 11 right) have full weight 1.0
  assert.equal(wing.getX(7), 1.0);
  assert.equal(wing.getX(11), 1.0);
  assert.ok(Math.abs(pos.getX(7)) > 1.0);
  assert.ok(Math.abs(pos.getX(11)) > 1.0);

  geom.dispose();
});

test('generateSkyBirdsData is deterministic and keeps all birds above combat clearance', () => {
  const birdsA = generateSkyBirdsData();
  const birdsB = generateSkyBirdsData();

  assert.equal(birdsA.length, SKY_BIRD_TOTAL_COUNT);
  assert.equal(birdsA.length, 36);
  assert.deepEqual(birdsA, birdsB);

  for (const bird of birdsA) {
    assert.ok(bird.radius >= 14, `radius too tight: ${bird.radius}`);
    assert.ok(Math.abs(bird.angularSpeed) > 0.1);
    for (const t of [0, 1.5, 4.2, 11.7]) {
      const [x, y, z] = evaluateBirdWorldPosition(bird, t);
      assert.ok(Number.isFinite(x) && Number.isFinite(z));
      assert.ok(y >= 38.0, `bird ${bird.flockId} dipped too low (${y}) at t=${t}`);
      const radialDist = Math.hypot(x - bird.anchor[0], z - bird.anchor[2]);
      assert.ok(Math.abs(radialDist - bird.radius) < 1e-4);
    }
  }
});

test('computeBirdFlapState alternates between active flapping and calm soaring glides', () => {
  let maxActivity = 0;
  let minActivity = 1;
  for (let i = 0; i < 40; i++) {
    const t = i * 0.25;
    const { flapActivity } = computeBirdFlapState(t, 0.25, 7.5);
    maxActivity = Math.max(maxActivity, flapActivity);
    minActivity = Math.min(minActivity, flapActivity);
  }
  assert.ok(maxActivity > 0.85, `expected active flapping phase, got ${maxActivity}`);
  assert.ok(minActivity < 0.15, `expected calm glide phase, got ${minActivity}`);
  assert.equal(SKY_BIRD_FLOCKS.length, 4);
});
