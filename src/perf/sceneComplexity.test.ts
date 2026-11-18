import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyzeSceneComplexity } from './sceneComplexity';

test('visible scene object inventory separates named rendering subsystems', () => {
  const scene = new THREE.Scene();
  const terrain = new THREE.Group();
  terrain.name = 'perf:terrain';
  scene.add(terrain);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.castShadow = true;
  terrain.add(mesh);
  const vegetation = new THREE.Group();
  vegetation.name = 'perf:foliage';
  scene.add(vegetation);
  const transparent = new THREE.MeshBasicMaterial({transparent:true});
  const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), transparent, 10);
  instances.count = 4;
  instances.frustumCulled = false;
  vegetation.add(instances);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), transparent);
  hidden.visible = false;
  vegetation.add(hidden);
  const r = analyzeSceneComplexity(scene);
  assert.equal(r.total.visibleMeshes, 2);
  assert.equal(r.total.drawCallCandidates, 2);
  assert.equal(r.total.shadowCasters, 1);
  assert.equal(r.total.instancedMeshes, 1);
  assert.equal(r.total.activeInstances, 4);
  assert.equal(r.total.transparentMeshes, 1);
  assert.equal(r.total.alwaysRenderedMeshes, 1);
  assert.equal(r.groups.terrain.estimatedTriangles, 12);
  assert.equal(r.groups.foliage.estimatedTriangles, 48);
  assert.equal(r.total.uniqueGeometries, 2);
  assert.equal(r.total.uniqueMaterials, 2);
  assert.ok(r.limitations.some(x=>x.includes('GPU')));
});

test('scene inventory gracefully handles all hidden content', () => {
  const scene = new THREE.Scene();
  const wrapper = new THREE.Group(); wrapper.visible=false;wrapper.name='perf:hidden';
  wrapper.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()));
  scene.add(wrapper);
  const report = analyzeSceneComplexity(scene);
  assert.equal(report.total.visibleMeshes, 0);
  assert.equal(Object.keys(report.groups).length, 0);
});

test('inventory counts a grass-style instanced geometry only within its draw range and instance capacity', () => {
  const scene = new THREE.Scene();
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(10), 1));
  geo.setDrawRange(3, 3);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.userData.lodLevel = 2;
  scene.add(mesh);
  for (const [count, expected] of [[Infinity, 10], [4, 4], [0, 0]]) {
    geo.instanceCount = count;
    const {total} = analyzeSceneComplexity(scene);
    assert.equal(total.estimatedTriangles, expected);
    assert.equal(total.lodInstances[2] ?? 0, expected);
  }
});
