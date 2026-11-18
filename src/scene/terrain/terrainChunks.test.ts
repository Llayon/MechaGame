import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { tileGrid, createTileMesh } from './terrainChunks';

test('every mixed-resolution tile keeps unit perimeter edges, consistent winding and complete surface area', () => {
  const w = 37, h = 29;
  const source = new THREE.PlaneGeometry(w, h, w, h).rotateX(-Math.PI / 2);
  const position = source.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, Math.sin(position.getX(i)) * .5);
  const tiles = tileGrid(source, w, h, 16, 16, false);
  assert.equal(tiles.length, 6);
  for (const tile of tiles) {
    const positions = tile.attributes.position.data;
    const width = tile.bounds.max.x - tile.bounds.min.x;
    const height = tile.bounds.max.z - tile.bounds.min.z;
    for (const { start, count } of tile.ranges) {
      const edges = new Map<string, { count: number; length: number }>();
      let area = 0;
      for (let k = start; k < start + count; k += 3) {
        const ids = tile.indices.slice(k, k + 3);
        const [a,b,c] = Array.from(ids, i => i * 3);
        const cross = (positions[b+2] - positions[a+2]) * (positions[c] - positions[a])
          - (positions[b] - positions[a]) * (positions[c+2] - positions[a+2]);
        assert.ok(cross > 0, 'degenerate or inverted triangle');
        area += cross / 2;
        for (let e = 0; e < 3; e++) {
          const i = ids[e], j = ids[(e+1)%3];
          const key = Math.min(i,j) + '/' + Math.max(i,j);
          const edge = edges.get(key);
          if (edge) edge.count++;
          else edges.set(key, { count: 1, length: Math.hypot(positions[i*3]-positions[j*3], positions[i*3+2]-positions[j*3+2]) });
        }
      }
      const boundary = [...edges.values()].filter(e => e.count === 1);
      assert.equal(area, width * height);
      assert.equal(boundary.length, 2 * (width + height));
      assert.ok(boundary.every(e => e.length === 1));
      assert.ok([...edges.values()].every(e => e.count <= 2));
    }
  }
});

test('terrain shadow draw range is restored before color rendering', () => {
  const source = new THREE.PlaneGeometry(32, 32, 32, 32).rotateX(-Math.PI / 2);
  const [tile] = tileGrid(source, 32, 32, 32, 32, false);
  const material = new THREE.MeshBasicMaterial();
  const batch = createTileMesh(tile, material);
  const camera = new THREE.PerspectiveCamera();
  batch.select(800, camera, 1, 1);
  const geo = batch.mesh.geometry;
  assert.equal(geo.drawRange.count, 32 * 32 * 6);
  const args = [null!, new THREE.Scene(), camera, camera, geo, material, new THREE.Group()] as const;
  batch.mesh.onBeforeShadow(...args);
  assert.ok(geo.drawRange.count < 32 * 32 * 6 / 4);
  batch.mesh.onAfterShadow(...args);
  assert.equal(geo.drawRange.count, 32 * 32 * 6);
  camera.position.set(1000, 2000, 2000);
  camera.updateMatrixWorld();
  batch.select(800, camera, 1, 1);
  assert.equal(batch.mesh.userData.lodLevel, 2);
});
