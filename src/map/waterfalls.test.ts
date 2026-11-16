import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATER_LEVEL,
  getAirfieldPadMask,
  getCitadelPlateauMask,
  getCitadelTerraceMask,
  getExtendedTerrainHeight,
  getQuarryPadMask,
} from './terrainMath';
import {
  buildBatchedSplashRingGeometry,
  buildBatchedWaterfallGeometry,
  discoverWaterfallSites,
  distToRiverStructures,
  evaluateWaterfallPoint,
  getWaterfallRockSpecs,
} from './waterfalls';

test('discoverWaterfallSites finds spaced steep river-cliff cascades clear of roads, bridges, and pads', () => {
  const sites = discoverWaterfallSites(4);
  assert.ok(sites.length >= 3 && sites.length <= 4, `expected 3-4 cascades, got ${sites.length}`);

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    assert.ok(site.crestY >= 11.5, `${site.id} crest too low: ${site.crestY}`);
    assert.ok(site.splashY <= -0.2, `${site.id} splash must land in river bed, got ${site.splashY}`);
    assert.ok(
      distToRiverStructures(site.crestX, site.crestZ) >= 14.5,
      `${site.id} crest too close to road/bridge/ramp`,
    );
    assert.ok(
      distToRiverStructures(site.splashX, site.splashZ) >= 12.5,
      `${site.id} splash too close to road/bridge/ramp`,
    );
    assert.equal(getAirfieldPadMask(site.crestX, site.crestZ) > 0.05, false);
    assert.equal(getCitadelPlateauMask(site.crestX, site.crestZ) > 0.08, false);
    assert.equal(getQuarryPadMask(site.crestX, site.crestZ) > 0.1, false);
    assert.equal(getCitadelTerraceMask(site.crestX, site.crestZ) > 0.15, false);

    for (let j = i + 1; j < sites.length; j++) {
      const sep = Math.hypot(site.crestX - sites[j].crestX, site.crestZ - sites[j].crestZ);
      assert.ok(sep >= 44.0, `cascades ${site.id} and ${sites[j].id} overlap (${sep.toFixed(1)})`);
    }
  }
});

test('terrain-conformed waterfall trajectory anchors at cliff crest, clears cliff face, and plunges below water', () => {
  const sites = discoverWaterfallSites(4);
  for (const site of sites) {
    const top = evaluateWaterfallPoint(site, 0, 0);
    assert.ok(Math.abs(top.y - site.crestY) < 0.8, `top edge must anchor near crestY=${site.crestY}`);

    const bottom = evaluateWaterfallPoint(site, 0, 1);
    assert.ok(bottom.y < WATER_LEVEL - 0.2, `bottom must plunge under river surface, got ${bottom.y}`);

    for (let fp = 0.2; fp <= 0.85; fp += 0.15) {
      const pt = evaluateWaterfallPoint(site, 0, fp);
      const groundY = getExtendedTerrainHeight(pt.x, pt.z);
      assert.ok(
        pt.y >= groundY + 0.08,
        `${site.id} mid-cascade fp=${fp.toFixed(2)} clipped underground (${pt.y} < ${groundY})`,
      );
    }
  }
});

test('batched waterfall curtain, splash rings, and headwall rock specs have valid bounds', () => {
  const sites = discoverWaterfallSites(4);
  const curtain = buildBatchedWaterfallGeometry(sites);
  const pos = curtain.getAttribute('position');
  const norm = curtain.getAttribute('normal');
  const uv = curtain.getAttribute('uv');
  const seed = curtain.getAttribute('aSeed');
  const scale = curtain.getAttribute('aFallScale');

  assert.ok(pos.count > 0);
  assert.equal(norm.count, pos.count);
  assert.equal(uv.count, pos.count);
  assert.equal(seed.count, pos.count);
  assert.equal(scale.count, pos.count);

  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
    assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
    const u = uv.getX(i);
    const v = uv.getY(i);
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1);
  }

  const rings = buildBatchedSplashRingGeometry(sites);
  const rPos = rings.getAttribute('position');
  assert.ok(rPos.count > 0);
  for (let i = 0; i < rPos.count; i++) {
    assert.ok(Math.abs(rPos.getY(i) - (WATER_LEVEL + 0.08)) < 1e-4);
  }

  const rocks = getWaterfallRockSpecs(sites);
  assert.equal(rocks.length, sites.length * 4);
  for (const rock of rocks) {
    assert.ok(Number.isFinite(rock.y) && rock.scaleX > 1.5 && rock.scaleY > 1.0);
  }

  curtain.dispose();
  rings.dispose();
});
