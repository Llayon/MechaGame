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
