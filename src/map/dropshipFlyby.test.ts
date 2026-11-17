import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DROPSHIP_BOUNDS_HALF_DIST,
  DROPSHIP_MAX_COOLDOWN,
  DROPSHIP_MIN_COOLDOWN,
  computeFlybyShadowProjection,
  createDropshipFlybyState,
  createDropshipHullGeometry,
  createDropshipThrusterGeometry,
  stepDropshipFlyby,
  triggerDropshipFlyby,
} from './dropshipFlyby';

test('dropship hull and thruster geometries stay lightweight with valid finite attributes', () => {
  const hull = createDropshipHullGeometry();
  const hPos = hull.getAttribute('position');
  const hNorm = hull.getAttribute('normal');
  const hCol = hull.getAttribute('color');

  assert.ok(hPos && hNorm && hCol);
  const tris = hPos.count / 3;
  assert.ok(tris >= 60 && tris <= 180, `Expected ~90-130 hull triangles, got ${tris}`);

  for (let i = 0; i < hPos.count; i++) {
    assert.equal(Number.isFinite(hPos.getX(i)), true);
    assert.equal(Number.isFinite(hPos.getY(i)), true);
    assert.equal(Number.isFinite(hPos.getZ(i)), true);
    assert.equal(Number.isFinite(hNorm.getX(i)), true);
  }
  hull.dispose();

  const thrusters = createDropshipThrusterGeometry();
  const tPos = thrusters.getAttribute('position');
  assert.ok(tPos && tPos.count >= 24);
  thrusters.dispose();
});

test('dropship flyby traverses arena cleanly, exits, and re-triggers after 30-42s cooldown', () => {
  let seed = 77;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const state = createDropshipFlybyState();
  assert.equal(state.active, true);

  let exited = false;
  for (let i = 0; i < 200; i++) {
    const res = stepDropshipFlyby(state, 0.1, rng);
    if (res.completed) {
      exited = true;
      break;
    }
  }
  assert.equal(exited, true, 'Dropship should exit beyond arena bounds within 20s');
  assert.equal(state.active, false);
  assert.ok(
    state.timer >= DROPSHIP_MIN_COOLDOWN && state.timer <= DROPSHIP_MAX_COOLDOWN,
    `Cooldown ${state.timer} outside [${DROPSHIP_MIN_COOLDOWN}, ${DROPSHIP_MAX_COOLDOWN}]`,
  );

  // Advance through cooldown to trigger next flyby
  let retriggered = false;
  for (let i = 0; i < 500; i++) {
    const res = stepDropshipFlyby(state, 0.1, rng);
    if (res.started) {
      retriggered = true;
      break;
    }
  }
  assert.equal(retriggered, true, 'Dropship should trigger second pass after cooldown');
  assert.equal(state.active, true);
  assert.equal(state.passCount, 2);

  triggerDropshipFlyby(state, rng);
  assert.ok(Math.hypot(state.x, state.z) >= DROPSHIP_BOUNDS_HALF_DIST - 50);
});

test('solar flyby shadow projects opposite sun direction in day/dusk and disables cleanly at night', () => {
  const duskSun: readonly [number, number, number] = [110, 106, -245];
  const duskProj = computeFlybyShadowProjection(18, 66, -34, duskSun, 'dusk');
  assert.ok(duskProj.strength > 0.4);
  assert.ok(duskProj.shadowX < 18, 'Sun from +X casts shadow toward -X');
  assert.ok(duskProj.shadowZ > -34, 'Sun from -Z casts shadow toward +Z');
  assert.ok(Math.hypot(duskProj.shadowX - 18, duskProj.shadowZ - -34) <= 72.1);

  const daySun: readonly [number, number, number] = [175, 160, -85];
  const dayProj = computeFlybyShadowProjection(0, 66, 0, daySun, 'day');
  assert.ok(dayProj.strength > 0.35);
  assert.ok(dayProj.shadowX < 0 && dayProj.shadowZ > 0);

  const nightProj = computeFlybyShadowProjection(18, 66, -34, [110, 115, -210], 'night');
  assert.equal(nightProj.strength, 0);
});
