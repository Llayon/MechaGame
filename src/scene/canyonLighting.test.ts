import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CANYON_HEIGHT_MAX,
  CANYON_HEIGHT_MIN,
  CANYON_PRESETS,
  bakeDirectionalTerrainShadowGrid,
  buildCanyonHeightGrid,
  combineHybridShadow,
  computeHybridShadowHalfExtent,
  computeSkyVisibilityFromMipHeights,
  decodeTerrainHeightByte,
  encodeTerrainHeightByte,
} from './canyonLightingMath';

describe('canyonLightingMath', () => {
  it('encodeTerrainHeightByte / decodeTerrainHeightByte roundtrips across elevation span and clamps bounds', () => {
    assert.equal(encodeTerrainHeightByte(CANYON_HEIGHT_MIN - 20), 0);
    assert.equal(encodeTerrainHeightByte(CANYON_HEIGHT_MAX + 50), 255);

    for (const h of [-8, 0, 6.5, 18.5, 52, 96]) {
      const encoded = encodeTerrainHeightByte(h);
      const decoded = decodeTerrainHeightByte(encoded);
      assert.ok(
        Math.abs(decoded - h) <= 0.3,
        `expected roundtrip for ${h} within 0.3u, got ${decoded}`,
      );
    }
  });

  it('computeSkyVisibilityFromMipHeights keeps open ridges bright and darkens recessed canyon/quarry floors', () => {
    const ridgeSkyVis = computeSkyVisibilityFromMipHeights(
      42,
      [34, 24, 16],
      CANYON_PRESETS.dusk.skyVisStrength,
      CANYON_PRESETS.dusk.skyVisMin,
    );
    assert.equal(ridgeSkyVis, 1.0);

    const slopeSkyVis = computeSkyVisibilityFromMipHeights(
      14,
      [20, 22, 24],
      CANYON_PRESETS.dusk.skyVisStrength,
      CANYON_PRESETS.dusk.skyVisMin,
    );
    const deepCanyonSkyVis = computeSkyVisibilityFromMipHeights(
      1,
      [22, 34, 48],
      CANYON_PRESETS.dusk.skyVisStrength,
      CANYON_PRESETS.dusk.skyVisMin,
    );

    assert.ok(slopeSkyVis < ridgeSkyVis, 'mid-slope should be dimmer than open ridge');
    assert.ok(
      deepCanyonSkyVis < slopeSkyVis,
      'deep canyon floor should be dimmer than mid-slope',
    );
    assert.ok(
      deepCanyonSkyVis >= CANYON_PRESETS.dusk.skyVisMin,
      'skyVis must stay above safe minimum floor',
    );
  });

  it('bakeDirectionalTerrainShadowGrid casts soft directional shadow downwind of a mountain ridge', () => {
    const size = 64;
    const worldSpan = 256;
    // Tall N-S ridge centered at x = 0 rising to y = 55
    const ridgeGrid = buildCanyonHeightGrid(
      (x) => 4 + 52 * Math.exp(-(x * x) / (18 * 18)),
      size,
      worldSpan,
    );

    // Sun from +X (east) -> west side (-X) must fall in shadow, east side (+X) sunlit
    const eastSunShadow = bakeDirectionalTerrainShadowGrid(
      ridgeGrid,
      [120, 48, 0],
      { size, worldSpan, softPenumbraSlope: 0.05 },
    );

    const midRow = (size >> 1) * size;
    const westLeeward = eastSunShadow[midRow + Math.floor(size * 0.34)] / 255;
    const ridgePeak = eastSunShadow[midRow + (size >> 1)] / 255;
    const eastWindward = eastSunShadow[midRow + Math.floor(size * 0.72)] / 255;

    assert.ok(westLeeward < 0.25, `expected leeward valley in shadow, got ${westLeeward}`);
    assert.ok(ridgePeak > 0.9, `expected ridge crest sunlit, got ${ridgePeak}`);
    assert.ok(eastWindward > 0.95, `expected windward plain sunlit, got ${eastWindward}`);

    // Flip sun to -X (west) -> east side (+X) falls in shadow, west side (-X) becomes sunlit
    const westSunShadow = bakeDirectionalTerrainShadowGrid(
      ridgeGrid,
      [-120, 48, 0],
      { size, worldSpan, softPenumbraSlope: 0.05 },
    );
    const westNowLit = westSunShadow[midRow + Math.floor(size * 0.28)] / 255;
    const eastNowShadow = westSunShadow[midRow + Math.floor(size * 0.66)] / 255;

    assert.ok(westNowLit > 0.95, `expected west plain sunlit when sun is west, got ${westNowLit}`);
    assert.ok(eastNowShadow < 0.25, `expected east plain shadowed when sun is west, got ${eastNowShadow}`);
  });

  it('computeHybridShadowHalfExtent tightens live shadow frustum in Drive Mode and Overview', () => {
    assert.equal(computeHybridShadowHalfExtent(18, true), 34);
    assert.equal(computeHybridShadowHalfExtent(450, true), 34);
    assert.equal(computeHybridShadowHalfExtent(40, false), 34);
    assert.ok(Math.abs(computeHybridShadowHalfExtent(200, false) - 56) < 1e-9);
    assert.equal(computeHybridShadowHalfExtent(600, false), 105);
  });

  it('combineHybridShadow prevents double-darkening, fades smoothly at cascade border, and works on Low preset', () => {
    // Inside cascade: live shadow + baked shadow -> min (never darker than 0 or double-multiplied)
    const bothShadowed = combineHybridShadow(0.2, 0.2, 10, 60, true, 1.0);
    assert.ok(Math.abs(bothShadowed - 0.2) < 1e-6);

    // Inside cascade: live lit (1.0) but distant outer mountain blocks sun (0.15) -> receives mountain shadow
    const outerMountainShadow = combineHybridShadow(1.0, 0.15, 10, 60, true, 1.0);
    assert.ok(Math.abs(outerMountainShadow - 0.15) < 1e-6);

    // Smooth cascade border fade: live shadow (0.0) fades toward farShadow (1.0) across 0.68..0.90 * halfExtent
    const inner = combineHybridShadow(0.0, 1.0, 35, 60, true, 1.0);
    const midEdge = combineHybridShadow(0.0, 1.0, 47.4, 60, true, 1.0);
    const outside = combineHybridShadow(0.0, 1.0, 58, 60, true, 1.0);
    assert.equal(inner, 0.0);
    assert.ok(midEdge > 0.2 && midEdge < 0.8, `expected smooth fade at edge, got ${midEdge}`);
    assert.equal(outside, 1.0);

    // Low preset (liveShadowsEnabled = false): uses baked far shadow directly even inside focus
    const lowPresetShadow = combineHybridShadow(1.0, 0.0, 5, 60, false, 0.85);
    assert.ok(Math.abs(lowPresetShadow - 0.15) < 1e-6);
  });
});
