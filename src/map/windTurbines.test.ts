import test from 'node:test';
import assert from 'node:assert/strict';
import { HORIZON_LANDMARK_COORDS } from './horizonLandmarks';
import { getExtendedRiverDistance } from './terrainMath';
import {
  WIND_TURBINE_COORDS,
  createWindTurbineBeaconGeometry,
  createWindTurbineRotorGeometry,
  createWindTurbineTowerGeometry,
  generateWindTurbinesData,
  isWindTurbineOutsideArena,
} from './windTurbines';

test('wind turbines sit on high outer mountain ridges clear of arena, river canyon, and ruins', () => {
  const specs = generateWindTurbinesData();
  assert.equal(specs.length, WIND_TURBINE_COORDS.length);
  assert.ok(specs.length >= 5 && specs.length <= 8, `expected 5..8 turbines, got ${specs.length}`);

  const activeCount = specs.filter((s) => Math.abs(s.angularSpeed) > 0.05).length;
  assert.ok(activeCount >= 5, `expected at least 5 turning turbines, got ${activeCount}`);

  for (const spec of specs) {
    assert.ok(
      isWindTurbineOutsideArena(spec.x, spec.z),
      `turbine ${spec.id} (${spec.x}, ${spec.z}) must stay outside playable perimeter`,
    );
    assert.ok(
      spec.groundY >= 18,
      `turbine ${spec.id} should sit on an elevated mountain ridge/saddle, got y=${spec.groundY.toFixed(1)}`,
    );
    const dRiver = getExtendedRiverDistance(spec.x, spec.z);
    assert.ok(
      dRiver >= 45,
      `turbine ${spec.id} too close to river canyon: dRiver=${dRiver.toFixed(1)}`,
    );

    for (const lm of HORIZON_LANDMARK_COORDS) {
      const d = Math.hypot(spec.x - lm.x, spec.z - lm.z);
      assert.ok(
        d >= 50,
        `turbine ${spec.id} overlaps horizon landmark ${lm.id} (dist=${d.toFixed(1)})`,
      );
    }
  }
});

test('wind turbine tower and 3-blade rotor geometries stay lightweight with valid attributes', () => {
  const tower = createWindTurbineTowerGeometry();
  const rotor = createWindTurbineRotorGeometry();
  const beacon = createWindTurbineBeaconGeometry();

  for (const [label, geom, maxTris] of [
    ['tower', tower, 260],
    ['rotor', rotor, 260],
  ] as const) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const col = geom.getAttribute('color');
    const triCount = pos.count / 3;
    assert.ok(triCount > 20 && triCount <= maxTris, `${label} triCount=${triCount}`);
    assert.equal(norm.count, pos.count);
    assert.equal(col.count, pos.count);

    for (let i = 0; i < pos.count; i++) {
      assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
      assert.ok(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i)));
    }
  }

  // Verify 3-blade rotor symmetry around origin (~13u vertical reach, +/-10u horizontal span)
  rotor.computeBoundingBox();
  const box = rotor.boundingBox!;
  assert.ok(box.max.y > 11.5, `top rotor tip should reach > 11.5u, got ${box.max.y.toFixed(2)}`);
  assert.ok(box.min.y < -5.5, `lower rotor blades should sweep below -5.5u, got ${box.min.y.toFixed(2)}`);
  assert.ok(box.max.x > 9.5 && box.min.x < -9.5, 'rotor horizontal sweep should exceed +/-9.5u');

  assert.ok(beacon.getAttribute('position').count >= 6);

  tower.dispose();
  rotor.dispose();
  beacon.dispose();
});
