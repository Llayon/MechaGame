import * as THREE from 'three';

export interface TerrainTile {
  attributes: Record<string, { data: Float32Array; size: number }>;
  indices: Uint16Array;
  ranges: { start: number; count: number; error: number }[];
  bounds: THREE.Box3;
  shoreline: boolean;
}

/** Every LOD keeps every perimeter vertex. Boundary fans stitch coarse cells
 * to any neighboring level, including the full-resolution mountain rim. */
export function tileGrid(source: THREE.BufferGeometry, width: number, height: number,
  tileWidth: number, tileHeight: number, outward: boolean): TerrainTile[] {
  const tiles: TerrainTile[] = [];
  const position = source.getAttribute('position');
  for (let top = 0; top < height; top += tileHeight) {
    for (let left = 0; left < width; left += tileWidth) {
      const w = Math.min(tileWidth, width - left);
      const h = Math.min(tileHeight, height - top);
      const stride = w + 1;
      const attributes: TerrainTile['attributes'] = {};
      const bounds = new THREE.Box3();
      const point = new THREE.Vector3();
      for (const [name, attr] of Object.entries(source.attributes)) {
        const data = new Float32Array(stride * (h + 1) * attr.itemSize);
        for (let z = 0; z <= h; z++) {
          for (let x = 0; x <= w; x++) {
            const src = (z + top) * (width + 1) + x + left;
            const dst = (z * stride + x) * attr.itemSize;
            for (let k = 0; k < attr.itemSize; k++) data[dst + k] = attr.getComponent(src, k);
            if (name === 'position') bounds.expandByPoint(point.fromBufferAttribute(position, src));
          }
        }
        attributes[name] = { data, size: attr.itemSize };
      }
      const idx: number[] = [];
      const ranges: TerrainTile['ranges'] = [];
      const positions = attributes.position.data;
      const y = (i: number) => positions[i * 3 + 1];
      const triangle = (a: number, b: number, c: number) => {
        if (outward) idx.push(a, c, b);
        else idx.push(a, b, c);
      };
      for (const step of [1, 2, 4]) {
        const start = idx.length;
        let error = 0;
        for (let z = 0; z < h; z += step) {
          for (let x = 0; x < w; x += step) {
            const sx = Math.min(step, w - x);
            const sz = Math.min(step, h - z);
            const a = z * stride + x, b = a + sx, d = a + sz * stride, e = d + sx;
            const splitBD = Math.abs(y(b) - y(d)) <= Math.abs(y(a) - y(e));
            // Sample the deviation from the proposed coarse diagonal. Shorelines
            // get a tighter tolerance so their projected motion stays small.
            if (step > 1) {
              let errorInCell = 0;
              let low = Infinity;
              let high = -Infinity;
              const ya = y(a), yb = y(b), yd = y(d), ye = y(e);
              const twist = ya - yb - yd + ye;
              for (let dz = 0; dz <= sz; dz++) {
                for (let dx = 0; dx <= sx; dx++) {
                  const u = dx / sx, v = dz / sz;
                  const plane = ya + u * (yb - ya) + v * (yd - ya)
                    + twist * (splitBD ? Math.max(0, u + v - 1) : Math.min(u, v));
                  const sample = y(a + dz * stride + dx);
                  low = Math.min(low, sample);
                  high = Math.max(high, sample);
                  errorInCell = Math.max(errorInCell, Math.abs(sample - plane));
                }
              }
              const shoreline = !outward && low <= 0 && high >= 0;
              error = Math.max(error, errorInCell * (shoreline ? 3 : 1));
            }
            if (step === 1 || (x > 0 && z > 0 && x + sx < w && z + sz < h)) {
              if (splitBD) { triangle(a, d, b); triangle(d, e, b); }
              else { triangle(a, d, e); triangle(a, e, b); }
              continue;
            }
            if (sx === 1 || sz === 1) {
              // Walk the two sides of a thin final strip. Both lists include
              // precisely the boundary samples used by adjacent coarse cells.
              const vertical = sx === 1;
              const length = vertical ? sz : sx;
              const nearStep = (vertical ? x === 0 : z === 0) ? 1 : length;
              const farStep = (vertical ? x + sx === w : z + sz === h) ? 1 : length;
              const strideAlong = vertical ? stride : 1;
              const far = vertical ? b : d;
              let n = 0, f = 0;
              while (n < length || f < length) {
                const nearIndex = a + n * strideAlong;
                const farIndex = far + f * strideAlong;
                let next: number;
                if (n < length && (f === length || n + nearStep <= f + farStep)) {
                  n += nearStep;
                  next = a + n * strideAlong;
                } else {
                  f += farStep;
                  next = far + f * strideAlong;
                }
                if (vertical) triangle(nearIndex, next, farIndex);
                else triangle(nearIndex, farIndex, next);
              }
              continue;
            }
            const center = a + Math.floor(sz / 2) * stride + Math.floor(sx / 2);
            const boundary: number[] = [a];
            if (x === 0) for (let k = 1; k < sz; k++) boundary.push(a + k * stride);
            boundary.push(d);
            if (z + sz === h) for (let k = 1; k < sx; k++) boundary.push(d + k);
            boundary.push(e);
            if (x + sx === w) for (let k = 1; k < sz; k++) boundary.push(e - k * stride);
            boundary.push(b);
            if (z === 0) for (let k = 1; k < sx; k++) boundary.push(b - k);
            for (let k = 0; k < boundary.length; k++) triangle(center, boundary[k], boundary[(k + 1) % boundary.length]);
          }
        }
        ranges.push({ start, count: idx.length - start, error: Math.max(error, ranges.at(-1)?.error ?? 0) });
      }
      const shoreline = !outward && bounds.min.y < -1e-5 && bounds.max.y > 1e-5;
      tiles.push({ attributes, bounds, shoreline, indices: new Uint16Array(idx), ranges });
    }
  }
  return tiles;
}

export function createTileMesh(tile: TerrainTile, material: THREE.Material) {
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(tile.attributes)) {
    geo.setAttribute(name, new THREE.BufferAttribute(attr.data, attr.size));
  }
  geo.setIndex(new THREE.BufferAttribute(tile.indices, 1));
  geo.boundingBox = tile.bounds;
  geo.boundingSphere = tile.bounds.getBoundingSphere(new THREE.Sphere());
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.lodLevel = 0;
  const range = (level: number) => geo.setDrawRange(tile.ranges[level].start, tile.ranges[level].count);
  range(0);
  let shadowLevel = 0;
  const center = tile.bounds.getCenter(new THREE.Vector3());
  const half = tile.bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
  mesh.onBeforeShadow = () => range(shadowLevel);
  mesh.onAfterShadow = () => range(mesh.userData.lodLevel);
  return {
    mesh,
    select(focalPixels: number, camera: THREE.Camera, detail: number, shadow: number) {
      const distance = Math.max(1, tile.bounds.distanceToPoint(camera.position));
      const m = camera.matrixWorldInverse.elements;
      const depth = -(m[2] * center.x + m[6] * center.y + m[10] * center.z + m[14]);
      const nearDepth = depth - Math.abs(m[2]) * half.x - Math.abs(m[6]) * half.y - Math.abs(m[10]) * half.z;
      const pxPerUnit = focalPixels / (depth > 0 ? Math.max(1, nearDepth) : distance);
      // Preserve the original surface near feet, vehicle wheels and bridge entries.
      const fineNearPlayer = distance < 20;

      const old = mesh.userData.lodLevel as number;
      let level = 0;
      for (let i = 1; i < tile.ranges.length; i++) {
        if (fineNearPlayer || tile.shoreline || tile.ranges[i].error * pxPerUnit * detail > (old >= i ? 2.4 : 1.7)) break;
        level = i;
      }
      mesh.userData.lodLevel = level;
      range(level);
      shadowLevel = level;
      for (let i = level + 1; i < tile.ranges.length; i++) {
        if (tile.ranges[i].error * focalPixels / distance * shadow > 4.5) break;
        shadowLevel = i;
      }
    },
  };
}
