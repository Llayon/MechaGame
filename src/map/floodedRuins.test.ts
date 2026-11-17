import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_SPECS,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  distToSegment,
  getTerrainHeight,
} from './terrainMath';
import {
  EAST_CROSSING_ABUTMENT_STUBS,
  FLOODED_RUIN_CLUSTERS,
  getFloodedRuinColliderEntries,
} from './floodedRuins';
import { getWaterObstructionDistance } from './waterDepth';
import { MECH_COLLISION_RADIUS, resolveWorldObstacles, type WorldCollider } from './worldColliders';
import { hasLineOfSight } from './worldRaycaster';

function colliderBoundingRadius(c: WorldCollider): number {
  return c.kind === 'circle' ? c.r : Math.hypot(c.halfW, c.halfD);
}

test('bridge-east is removed from BRIDGE_SPECS while Northern, Central, and Citadel Viaduct remain intact', () => {
  assert.equal(BRIDGE_SPECS.some((b) => b.id === 'bridge-east'), false);
  assert.deepEqual(
    BRIDGE_SPECS.map((b) => b.id),
    ['bridge-a', 'bridge-center', 'viaduct-citadel'],
  );
});

test('all 6 flooded industrial ruins sit in the eastern river channel clear of ramps and with >= 5.0 u corridors', () => {
  assert.equal(FLOODED_RUIN_CLUSTERS.length, 6);

  for (const cluster of FLOODED_RUIN_CLUSTERS) {
    const bedY = getTerrainHeight(cluster.x, cluster.z);
    assert.ok(
      bedY < WATER_LEVEL - 1.0,
      `Ruin ${cluster.id} at (${cluster.x}, ${cluster.z}) should sit underwater, got y=${bedY.toFixed(2)}`,
    );
    for (const [ax, az, bx, bz, halfW] of WALKABLE_RAMPS) {
      const d = distToSegment(cluster.x, cluster.z, ax, az, bx, bz);
      assert.ok(
        d >= halfW + 1.5,
        `Ruin ${cluster.id} must not block walkable ramp corridor (dist=${d.toFixed(2)} vs halfW=${halfW})`,
      );
    }
    assert.ok(
      getWaterObstructionDistance(cluster.x, cluster.z) <= 0.1 || cluster.kind === 'pump-hall' || cluster.kind === 'gantry-frame',
      `Ruin ${cluster.id} should register in water depth obstacle SDF`,
    );
  }

  // Pump hall walls & gantry legs must also register negative SDF at their wall/leg centers
  assert.ok(getWaterObstructionDistance(FLOODED_RUIN_CLUSTERS[2].x, FLOODED_RUIN_CLUSTERS[2].z) < 0);
  assert.ok(getWaterObstructionDistance(FLOODED_RUIN_CLUSTERS[3].x, FLOODED_RUIN_CLUSTERS[3].z) < 0);
  assert.ok(getWaterObstructionDistance(FLOODED_RUIN_CLUSTERS[5].x, FLOODED_RUIN_CLUSTERS[5].z) < 0);

  // Verify >= 5.0 u navigable channels (> 2x Mech diameter 4.6 u) between every distinct cluster collider pair
  const entries = getFloodedRuinColliderEntries();
  const minRequiredGap = Math.max(5.0, MECH_COLLISION_RADIUS * 4.2);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].clusterId === entries[j].clusterId) continue;
      const a = entries[i].collider;
      const b = entries[j].collider;
      const centerDist = Math.hypot(a.cx - b.cx, a.cz - b.cz);
      const approxGap = centerDist - colliderBoundingRadius(a) - colliderBoundingRadius(b);
      assert.ok(
        approxGap >= minRequiredGap,
        `Clearance between ${entries[i].clusterId} and ${entries[j].clusterId} is ${approxGap.toFixed(2)} u (< ${minRequiredGap.toFixed(2)} u)`,
      );
    }
  }
});

test('flooded ruin walls provide real ballistic cover and broken abutment barricades block cliff walk-off', () => {
  // Collapsed center bridge pier (57.5, 58.0) rises to +3.2 above water, blocking torso-level shots
  const pier = FLOODED_RUIN_CLUSTERS[2];
  const dx = Math.cos(pier.rotY) * 9;
  const dz = -Math.sin(pier.rotY) * 9;
  const losBlocked = hasLineOfSight(
    pier.x - dx,
    WATER_LEVEL + 1.5,
    pier.z - dz,
    pier.x + dx,
    WATER_LEVEL + 1.5,
    pier.z + dz,
  );
  assert.equal(losBlocked, false, 'Collapsed bridge pier must block horizontal gunfire at y=+1.5');

  // Open water corridor between pump hall (43, 52) and collapsed pier (57.5, 58) remains walkable and clear
  const midX = 50.2;
  const midZ = 55.0;
  const bedY = getTerrainHeight(midX, midZ);
  assert.equal(resolveWorldObstacles(midX, midZ, bedY).collided, false);

  // Broken East Crossing abutment barricades prevent walking straight off the sheared ledge
  for (const stub of EAST_CROSSING_ABUTMENT_STUBS) {
    const bx = stub.x + Math.sin(stub.yaw) * 2.2;
    const bz = stub.z + Math.cos(stub.yaw) * 2.2;
    const hit = resolveWorldObstacles(bx, bz, stub.deckY + 0.5);
    assert.equal(hit.collided, true, `Broken abutment ${stub.id} barricade must block edge drop-off`);
  }
});
