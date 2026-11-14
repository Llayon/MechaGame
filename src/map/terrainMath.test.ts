import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  BRIDGE_SPECS,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_TERRACES,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  ISLAND_DECK_RADIUS,
  MAP_DEPTH,
  MAP_HALF_D,
  MAP_HALF_W,
  MAP_WIDTH,
  METERS_PER_UNIT,
  ROAD_HALF_WIDTH,
  ROAD_MAIN_WEST,
  ROCKY_WATER_RAMPS,
  SCALE_X,
  SCALE_Z,
  SLAB_BASE_Y,
  VIADUCT_BASTION_HALF,
  VIADUCT_ELBOW,
  VIADUCT_ELBOW_Y,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  getAnalyticalTerrainNormal,
  getBridgeDeckYAt,
  getBridgeSectionOffsets,
  getCitadelTerraceNormalizedDistance,
  getExtendedTerrainHeight,
  getRiverInfo,
  getRoadNormalizedDistance,
  getRockRampNormalizedDistance,
  getShoalNormalizedDistance,
  getSurfaceKind,
  getTerrainHeight,
  getTerrainSlope,
  getViaductDeckYAtT,
  lerp,
  noise2D,
  smoothstep,
} from './terrainMath';
import { SECTOR_ORDER, SECTORS, TACTICAL_PINS } from './sectors';

test('Stage 2 zone scales: Helipad 200-250 m from shore, Island 200-250 m diameter, Citadel 3x area', () => {
  const widthMeters = MAP_WIDTH * METERS_PER_UNIT;
  const depthMeters = MAP_DEPTH * METERS_PER_UNIT;
  assert.ok(widthMeters >= 1400 && depthMeters >= 1150, `arena=${widthMeters}x${depthMeters} m`);

  const citadelDeltaMeters =
    (getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) - WATER_LEVEL) *
    METERS_PER_UNIT;
  assert.ok(
    citadelDeltaMeters >= 60 && citadelDeltaMeters <= 80,
    `citadel height delta=${citadelDeltaMeters.toFixed(1)} m must be 60-80 m`,
  );

  const roadWidthMeters = ROAD_HALF_WIDTH * 2 * METERS_PER_UNIT;
  assert.ok(
    roadWidthMeters >= 30 && roadWidthMeters <= 35,
    `road width=${roadWidthMeters.toFixed(1)} m must be 30-35 m`,
  );

  // Zone 1: Helipad Base nearest apron edge must be 200-250 m from river shoreline
  const cos = Math.cos(-0.22);
  const sin = Math.sin(-0.22);
  const padPts: Array<[number, number]> = [];
  for (let lx = -30; lx <= 30; lx += 5) {
    for (let lz = -22; lz <= 22; lz += 5) {
      padPts.push([
        AIRFIELD_CENTER_X + lx * cos - lz * sin,
        AIRFIELD_CENTER_Z + lx * sin + lz * cos,
      ]);
    }
  }
  let minShoreUnits = Infinity;
  for (let x = -MAP_HALF_W; x <= MAP_HALF_W; x += 3) {
    for (let z = -MAP_HALF_D; z <= MAP_HALF_D; z += 3) {
      if (getRiverInfo(x, z).channelMask > 0.15) {
        for (const [px, pz] of padPts) {
          const d = Math.hypot(x - px, z - pz);
          if (d < minShoreUnits) minShoreUnits = d;
        }
      }
    }
  }
  const minShoreMeters = minShoreUnits * METERS_PER_UNIT;
  assert.ok(
    minShoreMeters >= 200 && minShoreMeters <= 250,
    `Airfield shore setback=${minShoreMeters.toFixed(1)} m must be 200-250 m`,
  );

  // Zone 2: Central Industrial Island diameter 200-250 m
  const islandDiameterMeters = ISLAND_DECK_RADIUS * 2 * METERS_PER_UNIT;
  assert.ok(
    islandDiameterMeters >= 200 && islandDiameterMeters <= 250,
    `Island diameter=${islandDiameterMeters.toFixed(1)} m must be 200-250 m`,
  );

  // Zone 3: Citadel courtyard >= 3x larger than Stage 1 (Stage 1 octagon area ≈ 2018 sq units)
  const stage1Area = 2 * Math.SQRT2 * 29.5 * (29.5 * 0.82);
  const stage2Area = 2 * Math.SQRT2 * CITADEL_WALL_RX * CITADEL_WALL_RZ;
  assert.ok(
    stage2Area / stage1Area >= 2.95,
    `Citadel courtyard area ratio=${(stage2Area / stage1Area).toFixed(2)}x must be >= 3x`,
  );
});

test('terrain heightfield is finite across entire slab grid', () => {
  for (let x = -MAP_HALF_W; x <= MAP_HALF_W; x += 10) {
    for (let z = -MAP_HALF_D; z <= MAP_HALF_D; z += 10) {
      const h = getTerrainHeight(x, z);
      assert.equal(Number.isFinite(h), true, `non-finite height at (${x}, ${z})`);
      assert.ok(h > SLAB_BASE_Y, `height ${h} must be above slab base ${SLAB_BASE_Y}`);
    }
  }
});

test('river channel is submerged below water level while central island rises above water', () => {
  const northChannelX = -3.2 * SCALE_X;
  const northChannelZ = -6.9 * SCALE_Z;
  const southChannelX = -4.2 * SCALE_X;
  const southChannelZ = 6.8 * SCALE_Z;

  const northChannelY = getTerrainHeight(northChannelX, northChannelZ);
  const southChannelY = getTerrainHeight(southChannelX, southChannelZ);
  const islandCenterY = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z);

  assert.ok(
    northChannelY < WATER_LEVEL - 1.5,
    `north channel Y=${northChannelY} should be underwater`,
  );
  assert.ok(
    southChannelY < WATER_LEVEL - 1.5,
    `south channel Y=${southChannelY} should be underwater`,
  );
  assert.ok(
    islandCenterY > WATER_LEVEL + 4.5,
    `central island Y=${islandCenterY} should rise above water`,
  );
  assert.equal(getSurfaceKind(ISLAND_CENTER_X, ISLAND_CENTER_Z), 'concrete');
  assert.equal(getRiverInfo(northChannelX, northChannelZ).channelMask > 0.7, true);
});

test('helipad staging pad and 3x highland citadel plateau are flat enough for buildings', () => {
  const h1 = getTerrainHeight(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z);
  const h2 = getTerrainHeight(AIRFIELD_CENTER_X + 12, AIRFIELD_CENTER_Z - 4);
  const h3 = getTerrainHeight(AIRFIELD_CENTER_X - 10, AIRFIELD_CENTER_Z + 5);
  assert.ok(Math.abs(h1 - h2) < 0.25 && Math.abs(h1 - h3) < 0.25, 'airfield pad should be flat');

  const c1 = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  const c2 = getTerrainHeight(CITADEL_CENTER_X + 24, CITADEL_CENTER_Z + 12);
  const c3 = getTerrainHeight(CITADEL_CENTER_X - 24, CITADEL_CENTER_Z - 14);
  assert.ok(c1 > 17.5, `citadel plateau Y=${c1} should be ~18.5 units`);
  assert.ok(Math.abs(c1 - c2) < 0.35 && Math.abs(c1 - c3) < 0.35, 'citadel plateau should be flat');
});

test('bridges span cleanly at 30-35 m width and anchor flush on dry banks', () => {
  for (const bridge of BRIDGE_SPECS) {
    assert.ok(bridge.deckY > WATER_LEVEL + 4.5, `${bridge.id} deck must clear water`);
    assert.ok(bridge.startY > WATER_LEVEL + 4.0, `${bridge.id} start must clear water`);
    assert.ok(bridge.endY > WATER_LEVEL + 4.0, `${bridge.id} end must clear water`);
    const spanLen = Math.hypot(
      bridge.end[0] - bridge.start[0],
      bridge.end[1] - bridge.start[1],
    );
    assert.ok(spanLen > 25, `${bridge.id} span length ${spanLen} must be valid`);

    const widthMeters = bridge.width * METERS_PER_UNIT;
    assert.ok(
      widthMeters >= 30 && widthMeters <= 35,
      `${bridge.id} width=${widthMeters.toFixed(1)} m must be 30-35 m`,
    );

    const slopeDeg =
      (Math.atan2(Math.abs(bridge.endY - bridge.startY), spanLen) * 180) / Math.PI;
    assert.ok(slopeDeg < 22, `${bridge.id} slope ${slopeDeg.toFixed(1)}° must be walkable`);

    if (bridge.style !== 'viaduct') {
      const startCh = getRiverInfo(bridge.start[0], bridge.start[1]).channelMask;
      const endCh = getRiverInfo(bridge.end[0], bridge.end[1]).channelMask;
      assert.ok(startCh < 0.2, `${bridge.id} start must rest on dry bank, got channelMask=${startCh}`);
      assert.ok(endCh < 0.2, `${bridge.id} end must rest on dry bank, got channelMask=${endCh}`);

      const roadStartTop = getTerrainHeight(bridge.start[0], bridge.start[1]) + 0.16;
      const roadEndTop = getTerrainHeight(bridge.end[0], bridge.end[1]) + 0.16;
      assert.ok(
        Math.abs(bridge.startY + 0.52 - roadStartTop) < 0.3,
        `${bridge.id} start deck must sit flush with road`,
      );
      assert.ok(
        Math.abs(bridge.endY + 0.52 - roadEndTop) < 0.3,
        `${bridge.id} end deck must sit flush with road`,
      );
    } else {
      const islandSlabTop = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z) + 0.7;
      assert.ok(
        Math.abs(bridge.startY + 0.52 - islandSlabTop) < 0.3,
        `viaduct start must meet central island deck cleanly`,
      );
      const citadelSlabTop = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) + 0.55;
      assert.ok(
        Math.abs(bridge.endY + 0.52 - citadelSlabTop) < 0.3,
        `viaduct end must meet Citadel plateau cleanly`,
      );
    }
  }
});

test('walkable river, quarry, and island ramps have gentle <21 deg slope for non-jump-jet Mechs', () => {
  for (let idx = 0; idx < WALKABLE_RAMPS.length; idx++) {
    const [ax, az, bx, bz] = WALKABLE_RAMPS[idx];
    let maxDeg = 0;
    for (let t = 0.08; t <= 0.92; t += 0.1) {
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const deg = (Math.atan(getTerrainSlope(x, z)) * 180) / Math.PI;
      if (deg > maxDeg) maxDeg = deg;
    }
    assert.ok(maxDeg < 21, `ramp #${idx} maxDeg=${maxDeg.toFixed(1)}° must be walkable (<21°)`);
  }
});

test('all sector presets and tactical pins have valid coordinates', () => {
  for (const id of SECTOR_ORDER) {
    const s = SECTORS[id];
    assert.ok(s, `missing sector ${id}`);
    assert.equal(s.cameraPos.length, 3);
    assert.equal(s.cameraTarget.length, 3);
    assert.ok(s.minimapPos[0] >= 0 && s.minimapPos[0] <= 1);
    assert.ok(s.minimapPos[1] >= 0 && s.minimapPos[1] <= 1);
  }
  assert.ok(TACTICAL_PINS.length >= 5);
  for (const pin of TACTICAL_PINS) {
    assert.ok(pin.yOffset > getTerrainHeight(pin.x, pin.z), `pin ${pin.id} must sit above ground`);
  }
});

test('Stage 3 bridges are segmented with arches and cover every 40-50 m', () => {
  for (const bridge of BRIDGE_SPECS) {
    const offsets = getBridgeSectionOffsets(bridge);
    assert.ok(offsets.length >= 4, `${bridge.id} should have >= 4 section stations`);
    for (let i = 0; i < offsets.length - 1; i++) {
      const gapMeters = (offsets[i + 1] - offsets[i]) * METERS_PER_UNIT;
      assert.ok(
        gapMeters >= 38 && gapMeters <= 52,
        `${bridge.id} section gap=${gapMeters.toFixed(1)} m must be ~40-50 m`,
      );
    }
    if (bridge.style === 'viaduct') {
      const spanLen = Math.hypot(
        bridge.end[0] - bridge.start[0],
        bridge.end[1] - bridge.start[1],
        bridge.endY - bridge.startY,
      );
      const tunnelStartZ = spanLen * 0.5 - 18.3;
      assert.ok(
        offsets[offsets.length - 1] < tunnelStartZ - 1.5,
        'viaduct cover sections must stay clear of tunnel portal',
      );
    }
  }
});

test('Stage 3 riverbanks have 4 wide rocky exit ramps from riverbed to dry flank', () => {
  assert.ok(ROCKY_WATER_RAMPS.length >= 4, 'must have at least 4 rocky shoreline ramps');
  for (let i = 0; i < ROCKY_WATER_RAMPS.length; i++) {
    const [ax, az, bx, bz, halfW] = ROCKY_WATER_RAMPS[i];
    assert.ok(halfW * 2 * METERS_PER_UNIT >= 50, `rocky ramp #${i} must be >= 50 m wide`);
    const dryH = getTerrainHeight(ax, az);
    const wetH = getTerrainHeight(bx, bz);
    assert.ok(dryH > WATER_LEVEL + 2.5, `rocky ramp #${i} dry end must reach dry ground (${dryH})`);
    assert.ok(wetH < WATER_LEVEL - 0.5, `rocky ramp #${i} wet end must reach riverbed (${wetH})`);
    assert.equal(getSurfaceKind(ax, az), 'rock');
  }
});

test('Stage 3 Citadel slope features 3 jump-jet terraces with 15-20 m vertical steps', () => {
  assert.equal(CITADEL_TERRACES.length, 3);
  const citadelTopM = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) * METERS_PER_UNIT;

  const terraceElevs = CITADEL_TERRACES.map((t) => {
    const h = getTerrainHeight(t.x, t.z);
    const slopeDeg = (Math.atan(getTerrainSlope(t.x, t.z)) * 180) / Math.PI;
    assert.ok(slopeDeg < 12, `terrace ${t.id} landing pad must be flat, got ${slopeDeg.toFixed(1)}°`);
    assert.equal(getSurfaceKind(t.x, t.z), 'rock');
    return h * METERS_PER_UNIT;
  });

  // SW stair-step: valley (~20 m) -> sw-low (~36.8 m) -> sw-high (~52.9 m) -> Citadel (~69.4 m)
  const swStepUp = terraceElevs[1] - terraceElevs[0];
  const swStepToTop = citadelTopM - terraceElevs[1];
  const nwStepToTop = citadelTopM - terraceElevs[2];
  assert.ok(swStepUp >= 14 && swStepUp <= 21, `sw step=${swStepUp.toFixed(1)} m`);
  assert.ok(swStepToTop >= 14 && swStepToTop <= 21, `sw top step=${swStepToTop.toFixed(1)} m`);
  assert.ok(nwStepToTop >= 14 && nwStepToTop <= 21, `nw top step=${nwStepToTop.toFixed(1)} m`);
});

test('2-Flight Serpentine Citadel viaduct has crisp dogleg turn, level central bastion, walkable slopes (<20°), and clear cliff cut', () => {
  const viaduct = BRIDGE_SPECS.find((b) => b.style === 'viaduct');
  assert.ok(viaduct, 'viaduct spec must exist');

  // Verify serpentine bend angle between Flight 1 and Flight 2 is >= 35 degrees
  const dx1 = VIADUCT_ELBOW[0] - viaduct.start[0];
  const dz1 = VIADUCT_ELBOW[1] - viaduct.start[1];
  const len1 = Math.hypot(dx1, dz1);
  const dx2 = viaduct.end[0] - VIADUCT_ELBOW[0];
  const dz2 = viaduct.end[1] - VIADUCT_ELBOW[1];
  const len2 = Math.hypot(dx2, dz2);
  const dot = (dx1 * dx2 + dz1 * dz2) / (len1 * len2);
  const turnDeg = (Math.acos(dot) * 180) / Math.PI;
  assert.ok(turnDeg >= 35 && turnDeg <= 75, `serpentine turn angle=${turnDeg.toFixed(1)}° must form clear dogleg`);

  // Flight 1 & Flight 2 slopes must be walkable (<20 deg)
  const f1Deg =
    (Math.atan2(Math.abs(VIADUCT_ELBOW_Y - viaduct.startY), len1 - VIADUCT_BASTION_HALF) * 180) /
    Math.PI;
  const f2Deg =
    (Math.atan2(Math.abs(viaduct.endY - VIADUCT_ELBOW_Y), len2 - VIADUCT_BASTION_HALF) * 180) /
    Math.PI;
  assert.ok(f1Deg < 20, `Flight 1 slope=${f1Deg.toFixed(1)}° must be <20°`);
  assert.ok(f2Deg < 20, `Flight 2 slope=${f2Deg.toFixed(1)}° must be <20°`);

  // Level 1D profile sanity check
  const hubA = getViaductDeckYAtT(viaduct.startY, viaduct.endY, 0.42);
  const hubB = getViaductDeckYAtT(viaduct.startY, viaduct.endY, 0.58);
  assert.ok(Math.abs(hubA - hubB) < 0.01, 'Bastion plateau profile must be flat');

  // Central Bastion-Crossway deck & Flight 2 cliff cut must remain clear of terrain clipping
  for (const [px, pz] of [
    VIADUCT_ELBOW,
    [VIADUCT_ELBOW[0] + 6, VIADUCT_ELBOW[1] - 5],
    [lerp(VIADUCT_ELBOW[0], viaduct.end[0], 0.55), lerp(VIADUCT_ELBOW[1], viaduct.end[1], 0.55)],
    [lerp(VIADUCT_ELBOW[0], viaduct.end[0], 0.8), lerp(VIADUCT_ELBOW[1], viaduct.end[1], 0.8)],
  ]) {
    const deckY = getBridgeDeckYAt(viaduct, px, pz);
    assert.ok(deckY !== null, `Viaduct deck should cover (${px.toFixed(1)}, ${pz.toFixed(1)})`);
    const groundY = getTerrainHeight(px, pz);
    assert.ok(
      groundY < deckY! - 0.1,
      `Cliff terrain ${groundY.toFixed(2)} must sit below viaduct deck ${deckY!.toFixed(2)} at (${px.toFixed(1)}, ${pz.toFixed(1)})`,
    );
  }
});

test('Outer mountain ring frames Citadel rear & borders seamlessly while keeping serpentine road & river portals open', () => {
  // Border stitching: extended height exactly at perimeter must match getTerrainHeight
  for (const [bx, bz] of [
    [-MAP_HALF_W, 0],
    [MAP_HALF_W, -60],
    [40, -MAP_HALF_D],
    [-30, MAP_HALF_D],
  ]) {
    const inner = getTerrainHeight(bx, bz);
    const outer = getExtendedTerrainHeight(bx, bz);
    assert.ok(Math.abs(inner - outer) < 1e-4, `perimeter stitch mismatch at (${bx}, ${bz})`);
  }

  // Mountain massif behind Citadel rises above the Citadel plateau (18.5 units)
  const citadelY = getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z);
  const rearPeakY = getExtendedTerrainHeight(150, -215);
  assert.ok(
    rearPeakY > citadelY + 4.0,
    `Rear mountain peak (${rearPeakY.toFixed(1)}) should rise cleanly behind Citadel (${citadelY.toFixed(1)})`,
  );

  // NW & SE extended river portals stay submerged below water level
  assert.ok(getExtendedTerrainHeight(-150, -220) < WATER_LEVEL - 0.5, 'NW outer river gorge must stay carved');
  assert.ok(getExtendedTerrainHeight(135, 230) < WATER_LEVEL - 0.5, 'SE outer river gorge must stay carved');

  // Serpentine Citadel road remains smoothly graded (no mountain wall blocking road)
  for (const [rx, rz] of ROAD_MAIN_WEST.slice(8)) {
    const slopeDeg = (Math.atan(getTerrainSlope(rx, rz)) * 180) / Math.PI;
    assert.ok(slopeDeg < 26, `Serpentine road at (${rx}, ${rz}) slope=${slopeDeg.toFixed(1)}° must stay navigable`);
  }
});

test('Analytical heightfield normals are normalized, upward-facing, flat on pads, and continuous across perimeter seam', () => {
  // Flat pads (Airfield & Citadel center) should have nearly vertical upward normals
  for (const [px, pz] of [
    [AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z],
    [CITADEL_CENTER_X, CITADEL_CENTER_Z],
  ]) {
    const n = getAnalyticalTerrainNormal(px, pz);
    const len = Math.hypot(n.nx, n.ny, n.nz);
    assert.ok(Math.abs(len - 1) < 1e-6, `normal must be unit length, got ${len}`);
    assert.ok(n.ny > 0.995, `flat pad normal ny=${n.ny} should be ~1.0`);
  }

  // Citadel terraces & steep outer mountain slopes should produce finite, smooth, upward normals
  for (const [sx, sz] of [
    [CITADEL_TERRACES[0].x, CITADEL_TERRACES[0].z],
    [CITADEL_TERRACES[1].x, CITADEL_TERRACES[1].z],
    [CITADEL_TERRACES[2].x, CITADEL_TERRACES[2].z],
    [150, -215],
    [-MAP_HALF_W, -40],
    [MAP_HALF_W, 30],
    [45, -MAP_HALF_D],
  ]) {
    const n = getAnalyticalTerrainNormal(sx, sz);
    assert.ok(Number.isFinite(n.nx) && Number.isFinite(n.ny) && Number.isFinite(n.nz));
    const len = Math.hypot(n.nx, n.ny, n.nz);
    assert.ok(Math.abs(len - 1) < 1e-6, `normal at (${sx}, ${sz}) must be unit length`);
    assert.ok(n.ny > 0.15, `normal at (${sx}, ${sz}) must point upward, ny=${n.ny}`);
  }
});

test('noise2D and smoothstep use Ken Perlin C2 quintic curve with continuous 2nd derivatives across cell boundaries', () => {
  // smoothstep(0, 1, 0.5) == 0.5 and symmetric, and near 0/1 has vanishing 2nd derivative (cubic was 6.0!)
  assert.ok(Math.abs(smoothstep(0, 1, 0.5) - 0.5) < 1e-9);
  const eps = 1e-4;
  const secondDerivNearZero =
    (smoothstep(0, 1, 0) - 2 * smoothstep(0, 1, eps) + smoothstep(0, 1, 2 * eps)) / (eps * eps);
  assert.ok(Math.abs(secondDerivNearZero) < 0.01, `quintic 2nd deriv near 0 should vanish (~0.006 vs cubic 6.0), got ${secondDerivNearZero}`);

  // Check noise2D 2nd derivative across integer lattice x = 4.0
  const d2Left =
    (noise2D(4 - 2 * eps, 7.37) - 2 * noise2D(4 - eps, 7.37) + noise2D(4, 7.37)) / (eps * eps);
  const d2Right =
    (noise2D(4, 7.37) - 2 * noise2D(4 + eps, 7.37) + noise2D(4 + 2 * eps, 7.37)) / (eps * eps);
  assert.ok(Math.abs(d2Left) < 0.01 && Math.abs(d2Right) < 0.01, `C2 noise 2nd deriv across grid must vanish, got ${d2Left} vs ${d2Right}`);
});

test('Continuous SDF zone helpers return < 1 inside features and > 1 outside without step discontinuities', () => {
  // Center of road vs far hillside
  assert.ok(getRoadNormalizedDistance(-140, 92) < 0.1);
  assert.ok(getRoadNormalizedDistance(0, 140) > 2.0);

  // Center of Citadel terrace vs outside
  assert.ok(getCitadelTerraceNormalizedDistance(CITADEL_TERRACES[0].x, CITADEL_TERRACES[0].z) < 0.05);
  assert.ok(getCitadelTerraceNormalizedDistance(0, 0) > 2.0);

  // Shoal & walkable rocky ramps
  assert.ok(getShoalNormalizedDistance(-63, 48) < 0.1);
  assert.ok(getRockRampNormalizedDistance(118, -1) < 0.1);
  assert.ok(getShoalNormalizedDistance(122, -78) > 3.0);
});



