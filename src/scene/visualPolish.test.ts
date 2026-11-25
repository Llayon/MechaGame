import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERIOR_WINDOW_PRESETS,
  SPECULAR_AA_CONFIG,
  WATER_CONTACT_CONFIG,
  computeGeometricSpecularAa,
  computeWaterContact,
  computeWaterfallGravityProfile,
  traceInteriorRoom,
} from './visualPolishMath';

describe('visualPolishMath', () => {
  it('computeGeometricSpecularAa preserves flat smooth surfaces and widens roughness on high normal curvature', () => {
    const flat = computeGeometricSpecularAa(0.2, 0.0);
    assert.ok(Math.abs(flat - 0.2) < 1e-6);

    const curved = computeGeometricSpecularAa(0.2, 0.2);
    assert.ok(curved > flat, 'curved micro-facets should widen roughness');
    assert.ok(curved < 0.45, 'moderate curvature should remain physically bounded');

    // Extreme sub-pixel curvature clamps variance at maxVariance
    const extreme = computeGeometricSpecularAa(0.1, 10.0);
    const expectedExtreme = Math.sqrt(0.01 + SPECULAR_AA_CONFIG.maxVariance);
    assert.ok(Math.abs(extreme - expectedExtreme) < 1e-6);
  });

  it('computeWaterfallGravityProfile accelerates non-linearly via sqrt(h) from crest lip to churning plunge foot', () => {
    const lip = computeWaterfallGravityProfile(1.0, 1.0);
    const mid = computeWaterfallGravityProfile(0.5, 1.0);
    const foot = computeWaterfallGravityProfile(0.0, 1.0);

    assert.equal(lip.fallenMeters, 0);
    assert.ok(mid.tau > lip.tau && foot.tau > mid.tau);
    // Concave sqrt profile: first half of drop changes tau MORE than second half
    const deltaFirstHalf = mid.tau - lip.tau;
    const deltaSecondHalf = foot.tau - mid.tau;
    assert.ok(
      deltaFirstHalf > deltaSecondHalf,
      `tau should follow concave sqrt(h) acceleration (${deltaFirstHalf} > ${deltaSecondHalf})`,
    );
    // Smooth film at lip breaks into frothy strands mid-drop and churns at the foot
    assert.equal(lip.ropeBreakup, 0);
    assert.equal(mid.ropeBreakup, 1);
    assert.equal(lip.footChurn, 0);
    assert.equal(foot.footChurn, 1);
  });

  it('computeWaterContact darkens zero-depth shoreline and pier edges while releasing in open deep water', () => {
    const shore = computeWaterContact(0.0, 4.0);
    const pier = computeWaterContact(2.5, 0.0);
    const openRiver = computeWaterContact(4.0, 4.0);

    assert.ok(Math.abs(shore.contactFactor - WATER_CONTACT_CONFIG.shoreMinFactor) < 1e-6);
    assert.ok(Math.abs(pier.contactFactor - WATER_CONTACT_CONFIG.pierMinFactor) < 1e-6);
    assert.equal(openRiver.contactFactor, 1.0);
    assert.ok(shore.shallowSpecularFactor < openRiver.shallowSpecularFactor);
    assert.equal(openRiver.shallowSpecularFactor, 1.0);
  });

  it('traceInteriorRoom analytically hits back, side, floor, and ceiling surfaces with deterministic room variety', () => {
    const straight = traceInteriorRoom(0.5, 0.5, 0.0, 0.0, 0.2);
    assert.equal(straight.side, 'back');
    assert.equal(straight.depthT, 1.0);
    assert.equal(straight.roomKind, 'amber');
    assert.equal(straight.hasBlinds, false);

    const steepRight = traceInteriorRoom(0.8, 0.5, 2.0, 0.0, 0.7);
    assert.equal(steepRight.side, 'side');
    assert.ok(steepRight.depthT > 0 && steepRight.depthT < 0.2);
    assert.equal(steepRight.roomKind, 'cyan');
    assert.equal(steepRight.hasBlinds, true);

    const lookDown = traceInteriorRoom(0.5, 0.25, 0.0, -2.0, 0.9);
    assert.equal(lookDown.side, 'floor');
    assert.equal(lookDown.roomKind, 'dim');

    const lookUp = traceInteriorRoom(0.5, 0.75, 0.0, 2.0, 0.4);
    assert.equal(lookUp.side, 'ceiling');

    // Preset glow hierarchy: night > dusk > day
    assert.ok(INTERIOR_WINDOW_PRESETS.night.glowScale > INTERIOR_WINDOW_PRESETS.dusk.glowScale);
    assert.ok(INTERIOR_WINDOW_PRESETS.dusk.glowScale > INTERIOR_WINDOW_PRESETS.day.glowScale);
  });
});
