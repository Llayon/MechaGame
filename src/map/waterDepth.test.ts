import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ROCKY_WATER_RAMPS,
  WATER_LEVEL,
  getTerrainHeight,
} from './terrainMath';
import {
  MAX_OBSTACLE_DIST,
  MAX_WATER_DEPTH,
  WATER_SPAN_D,
  WATER_SPAN_W,
  bakeWaterDepthData,
  getWaterObstructionDistance,
} from './waterDepth';

test('getWaterObstructionDistance detects every river bridge pier, flooded ruin, and moored barge accurately', () => {
  for (const id of ['bridge-a', 'bridge-center'] as const) {
    const spec = BRIDGE_SPECS.find((b) => b.id === id);
    assert.ok(spec, `Missing bridge spec ${id}`);
    const dx = spec.end[0] - spec.start[0];
    const dz = spec.end[1] - spec.start[1];
    const yaw = Math.atan2(dx, dz);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    for (const f of [0.28, 0.72]) {
      const bx = spec.start[0] + dx * f;
      const bz = spec.start[1] + dz * f;
      for (const lx of [-spec.width * 0.28, spec.width * 0.28]) {
        const px = bx + lx * cos;
        const pz = bz - lx * sin;
        const dInside = getWaterObstructionDistance(px, pz);
        assert.ok(
          dInside < 0,
          `${id} pier at (${px.toFixed(1)}, ${pz.toFixed(1)}) should be <= 0, got ${dInside}`,
        );
        const dOutside = getWaterObstructionDistance(px + 2.0 * cos, pz - 2.0 * sin);
        assert.ok(
          dOutside > 0.4 && dOutside < 2.5,
          `${id} pier ring outside should smoothly grow, got ${dOutside}`,
        );
      }
    }
  }

  // Flooded eastern river ruins (collapsed pier at [57.5, 58.0], barge at [66.0, 26.0])
  assert.ok(getWaterObstructionDistance(57.5, 58.0) < -1.0, 'Collapsed pier should register inside water SDF');
  assert.ok(getWaterObstructionDistance(66.0, 26.0) < -1.0, 'Grounded barge should register inside water SDF');

  // Moored SE river barge center (~[86.1, 101.8] in world)
  const pierRotY = -0.32;
  const bargeX = 101 + -15.2 * Math.cos(pierRotY) + -1.5 * Math.sin(pierRotY);
  const bargeZ = 108 - -15.2 * Math.sin(pierRotY) + -1.5 * Math.cos(pierRotY);
  assert.ok(getWaterObstructionDistance(bargeX, bargeZ) < -1.0, 'Barge center should be inside obstacle SDF');

  // Open water away from structures
  assert.equal(getWaterObstructionDistance(-42, 42), MAX_OBSTACLE_DIST);
});

test('bakeWaterDepthData accurately encodes dry land, shallow shoal ramps, deep channel, and bridge piers', () => {
  const w = 160;
  const h = 140;
  const start = performance.now();
  const data = bakeWaterDepthData(w, h);
  const elapsedMs = performance.now() - start;

  assert.equal(data.length, w * h * 4);
  assert.ok(elapsedMs < 2500, `Expected quick CPU depth bake, took ${elapsedMs.toFixed(1)} ms`);

  const sampleTexel = (wx: number, wz: number) => {
    const u = wx / WATER_SPAN_W + 0.5;
    const v = wz / WATER_SPAN_D + 0.5;
    const ix = Math.max(0, Math.min(w - 1, Math.floor(u * w)));
    const iy = Math.max(0, Math.min(h - 1, Math.floor(v * h)));
    const idx = (iy * w + ix) * 4;
    return {
      depth: (data[idx] / 255) * MAX_WATER_DEPTH,
      obstDist: (data[idx + 1] / 255) * MAX_OBSTACLE_DIST,
    };
  };

  // Dry plateaus must report zero depth
  for (const [dx, dz] of [
    [AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z],
    [CITADEL_CENTER_X, CITADEL_CENTER_Z],
    [ISLAND_CENTER_X, ISLAND_CENTER_Z],
  ]) {
    const s = sampleTexel(dx, dz);
    assert.equal(s.depth, 0, `Dry plateau (${dx}, ${dz}) must have 0 depth`);
  }

  // Deep river channel midpoint under Bridge A
  const bridgeA = BRIDGE_SPECS.find((b) => b.id === 'bridge-a')!;
  const midX = (bridgeA.start[0] + bridgeA.end[0]) * 0.5;
  const midZ = (bridgeA.start[1] + bridgeA.end[1]) * 0.5;
  const midSample = sampleTexel(midX, midZ);
  assert.ok(
    midSample.depth > 1.5 && midSample.depth <= MAX_WATER_DEPTH,
    `River channel midpoint should be deep (>1.5), got ${midSample.depth}`,
  );

  // Shallow ramp midpoint near waterline must fall in shallow range (0 < depth < 1.5)
  const ramp0 = ROCKY_WATER_RAMPS[0];
  let foundShallow = false;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const rx = ramp0[0] + (ramp0[2] - ramp0[0]) * t;
    const rz = ramp0[1] + (ramp0[3] - ramp0[1]) * t;
    const y = getTerrainHeight(rx, rz);
    if (y < WATER_LEVEL - 0.15 && y > WATER_LEVEL - 1.1) {
      const rs = sampleTexel(rx, rz);
      if (rs.depth > 0.05 && rs.depth < 1.35) foundShallow = true;
    }
  }
  assert.ok(foundShallow, 'Shoal ramp waterline transition should encode shallow water depth');
});
