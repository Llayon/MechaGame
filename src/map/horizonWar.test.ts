import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTANT_WAR_CRUISERS,
  HORIZON_SMOKE_PLUMES,
  HORIZON_WAR_MAX_FLASHES,
  HORIZON_WAR_MAX_TRACERS,
  createDistantCruisersGeometry,
  createHorizonWarState,
  isHorizonPositionOutsideArena,
  seedInitialHorizonWarAction,
  stepHorizonWar,
  triggerHorizonOrbitalStrike,
} from './horizonWar';
import { getExtendedTerrainHeight } from './terrainMath';

test('distant cruisers and smoke plumes sit safely outside playable arena bounds', () => {
  assert.equal(DISTANT_WAR_CRUISERS.length, 2);
  for (const c of DISTANT_WAR_CRUISERS) {
    assert.ok(isHorizonPositionOutsideArena(c.x, c.z), `${c.id} must be outside playable bounds`);
    assert.ok(c.y >= 100, `${c.id} must hover above horizon mountain ridges`);
  }

  assert.equal(HORIZON_SMOKE_PLUMES.length, 4);
  for (const s of HORIZON_SMOKE_PLUMES) {
    assert.ok(isHorizonPositionOutsideArena(s.x, s.z), `${s.id} must be outside playable bounds`);
    assert.ok(s.height >= 90 && s.radiusTop > s.radiusBottom);
  }
});

test('createDistantCruisersGeometry produces a lightweight merged silhouette geometry', () => {
  const geom = createDistantCruisersGeometry();
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const col = geom.getAttribute('color');

  assert.ok(pos && norm && col);
  const triangles = pos.count / 3;
  assert.ok(triangles >= 80 && triangles <= 300, `unexpected cruiser triangle count=${triangles}`);

  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
    assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
  }

  geom.dispose();
});

test('horizon war simulation steps tracers, flak bursts, and orbital strikes with fixed pools', () => {
  const state = createHorizonWarState();
  assert.equal(state.tracers.length, HORIZON_WAR_MAX_TRACERS);
  assert.equal(state.flashes.length, HORIZON_WAR_MAX_FLASHES);

  seedInitialHorizonWarAction(state);
  const activeTracers = state.tracers.filter((t) => t.active);
  const activeFlashes = state.flashes.filter((f) => f.active);

  assert.ok(activeTracers.length >= 6, 'seeded horizon war should have active opposing tracers');
  assert.ok(activeFlashes.length >= 3, 'seeded horizon war should have active flak/artillery flashes');

  for (const t of activeTracers) {
    assert.ok(isHorizonPositionOutsideArena(t.x, t.z), 'tracers must stay beyond playable arena');
    assert.ok(t.y >= getExtendedTerrainHeight(t.x, t.z) - 20, 'tracers should remain above valley floor');
  }

  let s = 42;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  triggerHorizonOrbitalStrike(state, rng);
  const orbital = state.tracers.find((t) => t.active && t.isOrbital);
  assert.ok(orbital, 'orbital strike should spawn vertical beam slot');
  assert.ok(orbital.scaleX >= 3.5 && orbital.scaleY >= 10);

  let artilleryCount = 0;
  for (let step = 0; step < 60; step++) {
    const ev = stepHorizonWar(state, 0.05, rng);
    artilleryCount += ev.artilleryImpacts;
  }
  assert.ok(artilleryCount >= 1, 'artillery impact timer should fire during 3 seconds of stepping');
  assert.equal(state.tracers.length, HORIZON_WAR_MAX_TRACERS);
  assert.equal(state.flashes.length, HORIZON_WAR_MAX_FLASHES);
});
