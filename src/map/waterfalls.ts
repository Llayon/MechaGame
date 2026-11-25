import * as THREE from 'three';
import {
  BRIDGE_SPECS,
  ROAD_MAIN_WEST,
  ROAD_SOUTH_EAST,
  ROAD_SOUTH_SPINE,
  WALKABLE_RAMPS,
  WATER_LEVEL,
  clamp,
  distToPolyline,
  distToSegment,
  getAirfieldPadMask,
  getBridgeSegments,
  getCitadelPlateauMask,
  getCitadelTerraceMask,
  getExtendedRiverDistance,
  getExtendedTerrainHeight,
  getQuarryPadMask,
  getRiverInfo,
  lerp,
} from './terrainMath.ts';
import { WATER_SPAN_D, WATER_SPAN_W } from './waterDepth.ts';

export interface WaterfallSite {
  id: string;
  crestX: number;
  crestZ: number;
  crestY: number;
  splashX: number;
  splashZ: number;
  splashY: number;
  dirX: number;
  dirZ: number;
  runLength: number;
  fallHeight: number;
  width: number;
  flowSpeed: number;
  seed: number;
}

export function distToRiverStructures(x: number, z: number): number {
  let minD = Math.min(
    distToPolyline(x, z, ROAD_MAIN_WEST),
    distToPolyline(x, z, ROAD_SOUTH_EAST),
    distToPolyline(x, z, ROAD_SOUTH_SPINE),
  );
  for (const bridge of BRIDGE_SPECS) {
    for (const [a, b] of getBridgeSegments(bridge)) {
      minD = Math.min(minD, distToSegment(x, z, a[0], a[1], b[0], b[1]));
    }
  }
  for (const ramp of WALKABLE_RAMPS) {
    minD = Math.min(minD, distToSegment(x, z, ramp[0], ramp[1], ramp[2], ramp[3]));
  }
  // Keep clear of southeast river pier & moored barge
  minD = Math.min(minD, Math.hypot(x - 101, z - 108) - 8.0);
  return minD;
}

function isInsideWaterSurfaceBounds(x: number, z: number): boolean {
  return (
    Math.abs(x) <= WATER_SPAN_W * 0.5 - 12 &&
    Math.abs(z) <= WATER_SPAN_D * 0.5 - 12
  );
}

function isDeepWaterPoint(x: number, z: number): boolean {
  if (!isInsideWaterSurfaceBounds(x, z)) return false;
  const h = getExtendedTerrainHeight(x, z);
  if (h > -0.2) return false;
  if (Math.abs(x) <= 200 && Math.abs(z) <= 166) {
    const river = getRiverInfo(x, z);
    return river.channelMask > 0.42 && river.islandMask < 0.08;
  }
  return getExtendedRiverDistance(x, z) < 14.0;
}

/**
 * Automatically scans Sector 7's heightfield and river channel to discover
 * steep natural cliff-to-water cascade sites strictly outside roads, bridges,
 * combat pads, and jump-jet terraces.
 */
export function discoverWaterfallSites(maxCount = 4): WaterfallSite[] {
  interface Candidate {
    crestX: number;
    crestZ: number;
    crestY: number;
    splashX: number;
    splashZ: number;
    splashY: number;
    dirX: number;
    dirZ: number;
    runLength: number;
    score: number;
  }

  const candidates: Candidate[] = [];
  const step = 8;

  for (let x = -196; x <= 180; x += step) {
    for (let z = -220; z <= 145; z += step) {
      // Fast spatial pre-cull: cliff crests overhanging water sit within 42 units of river centerlines
      const riverDistApprox =
        Math.abs(x) <= 200 && Math.abs(z) <= 166
          ? getRiverInfo(x, z).distToChannel
          : getExtendedRiverDistance(x, z);
      if (riverDistApprox > 44 || riverDistApprox < 12) continue;

      if (distToRiverStructures(x, z) < 15.0) continue;

      if (
        getAirfieldPadMask(x, z) > 0.02 ||
        getCitadelPlateauMask(x, z) > 0.05 ||
        getQuarryPadMask(x, z) > 0.08 ||
        getCitadelTerraceMask(x, z) > 0.12
      ) {
        continue;
      }

      const crestY = getExtendedTerrainHeight(x, z);
      if (crestY < 11.5 || crestY > 48.0) continue;

      if (Math.abs(x) <= 200 && Math.abs(z) <= 166) {
        if (getRiverInfo(x, z).islandMask > 0.05) continue;
      }

      // Test 12 downhill compass rays, favoring faces oriented toward canyon camera sightlines
      for (let a = 0; a < 12; a++) {
        const rad = (a * Math.PI) / 6;
        const dirX = Math.cos(rad);
        const dirZ = Math.sin(rad);

        // Prefer cascades facing south/southeast/east toward the main Overview & Airfield sightlines
        if (dirZ < -0.18 && dirX < 0.45) continue;

        for (const r of [15, 19, 23, 27]) {
          const sx = x + dirX * r;
          const sz = z + dirZ * r;
          const sideX = -dirZ;
          const sideZ = dirX;
          if (
            !isDeepWaterPoint(sx, sz) ||
            !isDeepWaterPoint(sx - sideX * 5.0, sz - sideZ * 5.0) ||
            !isDeepWaterPoint(sx + sideX * 5.0, sz + sideZ * 5.0)
          ) {
            continue;
          }

          // Ensure trajectory stays clear of roads/bridges/terraces and never crosses rising terrain
          let unobstructed = true;
          for (let s = 0.25; s <= 1.0; s += 0.25) {
            const px = x + dirX * r * s;
            const pz = z + dirZ * r * s;
            if (distToRiverStructures(px, pz) < 13.0) {
              unobstructed = false;
              break;
            }
            if (getCitadelTerraceMask(px, pz) > 0.15) {
              unobstructed = false;
              break;
            }
            const midH = getExtendedTerrainHeight(px, pz);
            if (midH > crestY + 0.35) {
              unobstructed = false;
              break;
            }
          }
          if (!unobstructed) continue;

          const splashY = getExtendedTerrainHeight(sx, sz);
          const slope = crestY / r;
          // Reward crisp vertical drop, steep cliff slope, and facing into camera canyon (+Z / +X)
          const sightBonus = clamp(dirZ * 0.65 + dirX * 0.35, -0.2, 1.0) * 6.0;
          const innerFocusBonus = Math.abs(x) < 140 && Math.abs(z) < 175 ? 4.5 : 0.0;
          const score = Math.min(crestY, 26) * slope + sightBonus + innerFocusBonus;

          candidates.push({
            crestX: x,
            crestZ: z,
            crestY,
            splashX: sx,
            splashZ: sz,
            splashY,
            dirX,
            dirZ,
            runLength: r,
            score,
          });
          break;
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: WaterfallSite[] = [];
  for (const c of candidates) {
    if (
      selected.every(
        (s) => Math.hypot(s.crestX - c.crestX, s.crestZ - c.crestZ) >= 44.0,
      )
    ) {
      const idx = selected.length;
      const width = clamp(8.2 + (c.crestY - 12.0) * 0.24, 8.2, 13.6);
      selected.push({
        id: `canyon-waterfall-${idx + 1}`,
        crestX: c.crestX,
        crestZ: c.crestZ,
        crestY: c.crestY,
        splashX: c.splashX,
        splashZ: c.splashZ,
        splashY: c.splashY,
        dirX: c.dirX,
        dirZ: c.dirZ,
        runLength: c.runLength,
        fallHeight: c.crestY - WATER_LEVEL,
        width,
        flowSpeed: 1.05 + (idx % 3) * 0.14,
        seed: idx * 7.13 + 2.41,
      });
      if (selected.length >= maxCount) break;
    }
  }

  return selected;
}

/**
 * Evaluates a point along a terrain-conformed parabolic waterfall sheet:
 * t = 1.0 at cliff crest lip -> t = 0.0 submerged cleanly into the river splash zone.
 */
export function evaluateWaterfallPoint(
  site: WaterfallSite,
  uAcross: number, // -0.5..+0.5 normalized width
  fallProgress: number, // 0.0 at crest -> 1.0 at splash
): { x: number; y: number; z: number } {
  // Perpendicular horizontal axis along cliff lip
  const sideX = -site.dirZ;
  const sideZ = site.dirX;

  const spreadFactor = 0.72 + fallProgress * 0.56;
  const lateralOffset = uAcross * site.width * spreadFactor;

  // Launch slightly behind the crest lip (-0.95) so top edge emerges organically from rock,
  // arching outward with ballistic horizontal inertia (pow 0.72).
  const fwdDist = -0.95 + Math.pow(fallProgress, 0.72) * (site.runLength + 0.95);

  const x = site.crestX + site.dirX * fwdDist + sideX * lateralOffset;
  const z = site.crestZ + site.dirZ * fwdDist + sideZ * lateralOffset;

  // Parabolic vertical drop from cliff crest lip to below WATER_LEVEL
  const topY = site.crestY - 0.18;
  const bottomY = WATER_LEVEL - 0.75;
  const parabolicY = lerp(topY, bottomY, Math.pow(fallProgress, 1.55));

  // Conform strictly above any intermediate rocky shelf bulge so the sheet never disappears inside terrain
  let y = parabolicY;
  if (fallProgress > 0.06 && fallProgress < 0.92) {
    const groundY = getExtendedTerrainHeight(x, z);
    const archClearance = 0.55 * Math.sin(fallProgress * Math.PI);
    y = Math.max(parabolicY, groundY + archClearance);
  }

  // Slight convex cross-section bow in the center of the water stream
  const centerBow = (1.0 - Math.min(1.0, Math.abs(uAcross) * 2.0)) * 0.6 * Math.sin(fallProgress * Math.PI);
  return {
    x: x + site.dirX * centerBow,
    y,
    z: z + site.dirZ * centerBow,
  };
}

/**
 * Merges all waterfall curtains into a single BufferGeometry (1 Draw Call)
 * with per-vertex seed and aspect scale attributes for resolution-consistent foam streaks.
 */
export function buildBatchedWaterfallGeometry(
  sites: ReadonlyArray<WaterfallSite>,
  segX = 10,
  segY = 18,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const seeds: number[] = [];
  const fallScales: number[] = [];
  const indices: number[] = [];

  const cols = segX + 1;
  const rows = segY + 1;

  for (let sIdx = 0; sIdx < sites.length; sIdx++) {
    const site = sites[sIdx];
    const baseVertex = positions.length / 3;

    // Precompute max terrain profile per row across cascade width so cross-section stays smooth
    const rowMinHeights = new Float32Array(rows);
    for (let r = 0; r < rows; r++) {
      const t = r / segY; // 0 = bottom, 1 = top
      const fp = 1.0 - t;
      let maxRowY = -Infinity;
      for (let c = 0; c < cols; c++) {
        const u = c / segX;
        const pt = evaluateWaterfallPoint(site, u - 0.5, fp);
        if (pt.y > maxRowY) maxRowY = pt.y;
      }
      rowMinHeights[r] = maxRowY;
    }

    for (let r = 0; r < rows; r++) {
      const t = r / segY; // 0 = bottom (river splash), 1 = top (cliff crest)
      const fp = 1.0 - t;
      for (let c = 0; c < cols; c++) {
        const u = c / segX;
        const pt = evaluateWaterfallPoint(site, u - 0.5, fp);
        const smoothRowY =
          fp > 0.06 && fp < 0.92 ? lerp(pt.y, rowMinHeights[r], 0.35) : pt.y;
        positions.push(pt.x, smoothRowY, pt.z);
        uvs.push(u, t);
        seeds.push(site.seed);
        fallScales.push(site.width / 10.5, site.fallHeight / 16.0);
      }
    }

    for (let r = 0; r < segY; r++) {
      for (let c = 0; c < segX; c++) {
        const a = baseVertex + r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        indices.push(a, b, e);
        indices.push(a, e, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geo.setAttribute('aFallScale', new THREE.Float32BufferAttribute(fallScales, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Merges elliptical boiling splash rings on the river surface into 1 Draw Call.
 */
export function buildBatchedSplashRingGeometry(
  sites: ReadonlyArray<WaterfallSite>,
  radialSegments = 24,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const seeds: number[] = [];
  const indices: number[] = [];

  for (const site of sites) {
    const baseVertex = positions.length / 3;
    const impact = evaluateWaterfallPoint(site, 0, 0.96);
    const sideX = -site.dirZ;
    const sideZ = site.dirX;
    const rx = site.width * 1.38;
    const rz = site.width * 1.12;
    const splashY = WATER_LEVEL + 0.08;

    // Center vertex (UV 0.5, 0.5)
    positions.push(impact.x, splashY, impact.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    seeds.push(site.seed);

    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const wx = impact.x + sideX * ca * rx + site.dirX * sa * rz;
      const wz = impact.z + sideZ * ca * rx + site.dirZ * sa * rz;
      positions.push(wx, splashY, wz);
      normals.push(0, 1, 0);
      uvs.push(0.5 + ca * 0.5, 0.5 + sa * 0.5);
      seeds.push(site.seed);
    }

    for (let i = 1; i <= radialSegments; i++) {
      indices.push(baseVertex, baseVertex + i, baseVertex + i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export interface WaterfallHeadwallRockSpec {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
}

/**
 * Places framing dark slate boulders on the left & right flanks of each waterfall crest
 * and plunge edges so cascades read as carving through natural rock ledges instead of grass.
 */
export function getWaterfallRockSpecs(
  sites: ReadonlyArray<WaterfallSite>,
): WaterfallHeadwallRockSpec[] {
  const rocks: WaterfallHeadwallRockSpec[] = [];
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const sideX = -site.dirZ;
    const sideZ = site.dirX;
    const yaw = Math.atan2(site.dirX, site.dirZ);

    // Left & right crest gorge boulders framing the spill notch
    for (const sgn of [-1, 1] as const) {
      const bx = site.crestX + sideX * sgn * (site.width * 0.44) - site.dirX * 0.4;
      const bz = site.crestZ + sideZ * sgn * (site.width * 0.44) - site.dirZ * 0.4;
      const by = getExtendedTerrainHeight(bx, bz);
      const scaleBase = clamp(site.width * 0.34, 2.6, 4.4);
      rocks.push({
        x: bx,
        y: by + scaleBase * 0.28,
        z: bz,
        scaleX: scaleBase * 1.15,
        scaleY: scaleBase * 0.85,
        scaleZ: scaleBase * 1.05,
        rotY: yaw + sgn * 0.6 + i * 0.4,
      });

      // Secondary rocky shoulder just down-slope of crest lip
      const sx = site.crestX + sideX * sgn * (site.width * 0.56) + site.dirX * 2.2;
      const sz = site.crestZ + sideZ * sgn * (site.width * 0.56) + site.dirZ * 2.2;
      const sy = getExtendedTerrainHeight(sx, sz);
      rocks.push({
        x: sx,
        y: sy + scaleBase * 0.22,
        z: sz,
        scaleX: scaleBase * 0.92,
        scaleY: scaleBase * 0.72,
        scaleZ: scaleBase * 0.88,
        rotY: yaw - sgn * 0.9 + i * 0.7,
      });
    }
  }
  return rocks;
}
