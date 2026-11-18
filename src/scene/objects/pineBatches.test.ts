import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readWorldLod } from '../../lod/worldLod';
import { createPineBatches } from './pineBatches';
import { createGrassBands } from './grassBands';
import { GRASS_INSTANCE_COUNT_GPU } from '../../map/grassField';

test('tree pose, sway and local slot survive crossing LOD thresholds in both directions', () => {
  const tree = { x: 0, y: 0, z: 0, heightScale: 1, widthScale: 1, rotY: 0, tiltX: 0, tiltZ: 0, tint: 0 };
  const trees = [tree, {...tree, x: 82}, {...tree, x: 4}];
  const renderer = createPineBatches(trees, new THREE.MeshBasicMaterial(), new THREE.MeshDepthMaterial());
  assert.equal(renderer.group.children.length, 2);
  const first = renderer.group.children[0] as THREE.InstancedMesh;
  const camera = new THREE.PerspectiveCamera();
  const pose = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(4, 0, 0);
  renderer.setMatrixAt(2, pose);
  renderer.setSway(2, 0);
  camera.updateMatrixWorld();
  renderer.update(camera, [10, 6, 2]);
  const highCount = first.geometry.drawRange.count;
  camera.position.set(0, 0, 500);
  camera.updateMatrixWorld();
  renderer.update(camera, [10, 6, 2]);
  assert.equal(first.userData.lodLevel, 2);
  assert.ok(first.geometry.drawRange.count < highCount / 4);
  camera.position.set(0, 0, 0);
  camera.updateMatrixWorld();
  renderer.update(camera, [10, 6, 2]);
  const restored = new THREE.Matrix4();
  first.getMatrixAt(1, restored);
  assert.equal(first.geometry.getAttribute('aTreeSway').getX(1), 0);
  assert.ok(restored.elements.every((v,i) => Math.abs(v - pose.elements[i]) < .000001));
  assert.equal(first.geometry.drawRange.count, highCount);
  renderer.dispose();
});

test('an offscreen far tree casts only when its projected shadow reaches the camera', () => {
  const tree = { x: 80, y: 6, z: -150, heightScale: 1, widthScale: 1, rotY: 0, tiltX: 0, tiltZ: 0, tint: 0 };
  const renderer = createPineBatches([tree], new THREE.MeshBasicMaterial(), new THREE.MeshDepthMaterial());
  const camera = new THREE.PerspectiveCamera(20, 1, .1, 1000);
  camera.position.y = 4;
  camera.updateMatrixWorld();
  readWorldLod(camera).focalPixels = 500;
  const mesh = renderer.group.children[0] as THREE.InstancedMesh;
  renderer.update(camera, [1, 1, 0]);
  assert.equal(mesh.userData.lodLevel, 2);
  assert.equal(mesh.castShadow, false);
  renderer.update(camera, [8, 1, 0]);
  assert.equal(mesh.castShadow, true);
  readWorldLod(camera).shadowScale = 0;
  renderer.update(camera, [8, 1, 0]);
  assert.equal(mesh.castShadow, false);
  renderer.dispose();
});

test('grass compacts original periodic seeds while retaining flowering stalks in each LOD', () => {
  const pixels = new Uint8Array(32 * 32 * 4);
  const bare = createGrassBands(false, pixels, 32, 32);
  bare.update(0, 0, 1);
  assert.ok(bare.geometries.every(g => g.instanceCount === 0));
  const lush = createGrassBands(false, pixels.fill(255), 32, 32);
  lush.update(0, 0, 1);
  const counts = lush.geometries.map(g => g.instanceCount);
  assert.ok(counts.every(x => x > 0));
  lush.update(64, -64, 1);
  assert.deepEqual(lush.geometries.map(g => g.instanceCount), counts);
  const triangles = lush.geometries.reduce((sum,g) => sum + g.instanceCount * g.index!.count / 3, 0);
  assert.ok(triangles < GRASS_INSTANCE_COUNT_GPU * 33 * .65);
  for (const g of lush.geometries) {
    const flower = g.getAttribute('aBudMask');
    assert.ok([...g.index!.array].some(i => flower.getX(i) > .8));
  }
  bare.dispose(); lush.dispose();
});
