import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ALL_ROADS,
  BRIDGE_SPECS,
  MAP_HALF_D,
  MAP_HALF_W,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  ROAD_HALF_WIDTH,
  VIADUCT_ELBOW,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  distToPolyline,
  distToSegment,
  fbm2D,
  getAirfieldPadMask,
  getBridgeSegments,
  getCitadelPlateauMask,
  getCitadelTerraceMask,
  getRiverInfo,
  getTerrainHeight,
  getTerrainSlope,
} from '../../map/terrainMath';
import {
  ANTI_MECH_BARRICADE_NODES,
  BUNKER_COORDS,
  FLANK_EXCLUSION_ZONES,
  WRECK_COORDS,
} from '../zones/FlankCoverZone';

const _dummy = new THREE.Object3D();

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function isClearForRock(x: number, z: number): boolean {
  if (Math.abs(x) > MAP_HALF_W - 4.0 || Math.abs(z) > MAP_HALF_D - 4.0) return false;
  if (getAirfieldPadMask(x, z) > 0.15 || getCitadelPlateauMask(x, z) > 0.18) return false;
  if (getCitadelTerraceMask(x, z) > 0.55) return false;
  if (getRiverInfo(x, z).islandMask > 0.22) return false;
  if (Math.hypot(x - VIADUCT_ELBOW[0], z - VIADUCT_ELBOW[1]) < 15.5) return false;

  const dRoad = Math.min(...ALL_ROADS.map((road) => distToPolyline(x, z, road)));
  if (dRoad < ROAD_HALF_WIDTH + 3.8) return false;

  const nearBridge = BRIDGE_SPECS.some((b) =>
    getBridgeSegments(b).some(
      ([s, e]) => distToSegment(x, z, s[0], s[1], e[0], e[1]) < b.width * 0.65 + 3.2,
    ),
  );
  if (nearBridge) return false;

  const nearRamp = WALKABLE_RAMPS.some(
    (r) => distToSegment(x, z, r[0], r[1], r[2], r[3]) < r[4] + 2.8,
  );
  if (nearRamp) return false;

  if (BUNKER_COORDS.some((b) => Math.hypot(x - b.x, z - b.z) < 7.8)) return false;
  if (WRECK_COORDS.some((w) => Math.hypot(x - w.x, z - w.z) < 5.8)) return false;
  if (FLANK_EXCLUSION_ZONES.some((zZone) => Math.hypot(x - zZone.x, z - zZone.z) < zZone.r)) {
    return false;
  }
  if (ANTI_MECH_BARRICADE_NODES.some((n) => Math.hypot(x - n.x, z - n.z) < 4.5)) return false;

  return true;
}

export function RockOutcrops() {
  const rockRef = useRef<THREE.InstancedMesh>(null);

  const rocks = useMemo(() => {
    const list: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      rotY: number;
    }> = [];

    // Cluster boulders deliberately on windswept highland ridges, canyon escarpments, quarry benches & rocky shores
    // rather than uniform dots across open green fields.
    for (let i = 0; i < 3600 && list.length < 820; i++) {
      const cx = (seededRand(i * 5 + 101) * 2 - 1) * (MAP_HALF_W - 6.0);
      const cz = (seededRand(i * 5 + 102) * 2 - 1) * (MAP_HALF_D - 6.0);
      const cy = getTerrainHeight(cx, cz);
      const slope = getTerrainSlope(cx, cz);
      const river = getRiverInfo(cx, cz);

      const isWindsweptHeight = cy > 7.8;
      const isSteepRidge = slope > 0.38;
      const nearShore = river.channelMask > 0.02 && river.channelMask < 0.28;
      const nearQuarry = Math.hypot(cx - QUARRY_CENTER_X, cz - QUARRY_CENTER_Z) < 34;

      if (!isWindsweptHeight && !isSteepRidge && !nearShore && !nearQuarry) continue;
      if (cy < WATER_LEVEL - 0.25) continue;
      if (!isClearForRock(cx, cz)) continue;

      // Natural rock cluster density: larger crag + scree groupings on exposed windy heights & cliff ridges
      const clusterNoise = fbm2D(cx * 0.036 - 1.8, cz * 0.036 + 3.4, 2);
      if (clusterNoise < 0.38 && !nearShore) continue;

      const clusterSize =
        isWindsweptHeight || isSteepRidge
          ? 3 + Math.floor(seededRand(i + 901) * 4)
          : 2 + Math.floor(seededRand(i + 902) * 2);

      for (let k = 0; k < clusterSize && list.length < 820; k++) {
        const ang = seededRand(i * 17 + k * 7 + 301) * Math.PI * 2;
        const dist = k === 0 ? 0 : 1.3 + seededRand(i * 19 + k * 11 + 302) * 3.9;
        const x = cx + Math.cos(ang) * dist;
        const z = cz + Math.sin(ang) * dist;
        if (k > 0 && !isClearForRock(x, z)) continue;
        const y = getTerrainHeight(x, z);
        if (y < WATER_LEVEL - 0.1) continue;

        const isHeroBoulder = k === 0 && (isWindsweptHeight || isSteepRidge);
        const baseScale = isHeroBoulder
          ? 1.25 + seededRand(i * 5 + k + 103) * 1.45
          : 0.55 + seededRand(i * 5 + k + 103) * 0.95;

        list.push({
          x,
          y,
          z,
          sx: baseScale * (0.85 + seededRand(i + k + 201) * 0.6),
          sy: baseScale * (0.58 + seededRand(i + k + 202) * 0.48),
          sz: baseScale * (0.85 + seededRand(i + k + 203) * 0.6),
          rotY: seededRand(i + k + 204) * Math.PI * 2,
        });
      }
    }
    return list;
  }, []);

  useEffect(() => {
    const rMesh = rockRef.current;
    if (!rMesh) return;
    const c1 = new THREE.Color('#464F59');
    const c2 = new THREE.Color('#5C6672');
    const tmp = new THREE.Color();

    rocks.forEach((r, i) => {
      _dummy.position.set(r.x, r.y + r.sy * 0.28, r.z);
      _dummy.rotation.set(0.2 * i, r.rotY, 0.1 * i);
      _dummy.scale.set(r.sx, r.sy, r.sz);
      _dummy.updateMatrix();
      rMesh.setMatrixAt(i, _dummy.matrix);
      tmp.copy(c1).lerp(c2, seededRand(i + 500));
      rMesh.setColorAt(i, tmp);
    });
    rMesh.instanceMatrix.needsUpdate = true;
    if (rMesh.instanceColor) rMesh.instanceColor.needsUpdate = true;
    rMesh.computeBoundingSphere();
  }, [rocks]);

  return (
    <instancedMesh
      ref={rockRef}
      args={[undefined, undefined, rocks.length]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.86} metalness={0.04} />
    </instancedMesh>
  );
}
