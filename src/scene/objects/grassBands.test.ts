import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrassClumpGeometry, GRASS_INSTANCE_COUNT_SW, GRASS_PATCH_RADIUS_SW } from '../../map/grassField';
import { createGrassBands } from './grassBands';

test('cell repacks preserve each LOD through wrap ties, cache eviction and detail changes', () => {
  const radius = GRASS_PATCH_RADIUS_SW;
  const period = radius * 2;
  const source = createGrassClumpGeometry(GRASS_INSTANCE_COUNT_SW, period, .35, .084);
  const seeds = source.getAttribute('aOffset').array;
  const bands = createGrassBands(true, new Uint8Array([0, 0, 255, 0]), 1, 1);
  const seam = seeds[0] + radius;
  const path = [[seam, seeds[1], 1], [seam - .6, seeds[1], 1], [-44, -22, .3],
    [88, 44, .75], [88, 44, 1], [seam, seeds[1], 1]];
  for (const [cx, cz, scale] of path) {
    bands.update(cx, cz, scale);
    const expected: number[][] = [[], [], []];
    for (let i = 0; i < seeds.length; i += 4) {
      const dx = seeds[i] + period * Math.floor((cx + radius - seeds[i]) / period) - cx;
      const dz = seeds[i+1] + period * Math.floor((cz + radius - seeds[i+1]) / period) - cz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > radius + .8) continue;
      const random = seeds[i+3] / (2 * Math.PI);
      const lodDistance = distance / radius + (random - .5) * .06;
      const level = lodDistance < .47 * scale ? 0 : lodDistance < .8 * scale ? 1 : 2;
      if (random <= scale * (level === 2 ? .78 : 1)) expected[level].push(seeds[i+3]);
    }
    bands.geometries.forEach((geometry, level) => {
      const offsets = geometry.getAttribute('aOffset');
      const yaws = Array.from({ length: geometry.instanceCount }, (_, slot) => offsets.getW(slot));
      assert.deepEqual(yaws.sort((a, b) => a - b), expected[level].sort((a, b) => a - b));
    });
  }
  bands.dispose();
  source.dispose();
});
