import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchBridgeParts, BRIDGE_SHADOW_LAYER } from './bridgeBatches';

test('bridge color and shadow cells render the same sources independently and restore hit geometry', () => {
  const geometry = new THREE.BoxGeometry(6, 2, 6);
  const material = new THREE.MeshStandardMaterial();
  const root = new THREE.Group();
  const sources = [62, 66, 71].map((x) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = x;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
  const result = batchBridgeParts(root);
  const shadowGroup = root.getObjectByName('bridge-shadow-batches')!;
  const color = root.children.filter((mesh): mesh is THREE.InstancedMesh => mesh instanceof THREE.InstancedMesh);
  const shadow = shadowGroup.children.filter((mesh): mesh is THREE.Mesh => mesh instanceof THREE.Mesh && mesh.visible);
  const mainLayers = new THREE.Layers();

  assert.deepEqual(color.map((mesh) => mesh.count), [3]);
  assert.ok(color.every((mesh) => !mesh.castShadow && mesh.receiveShadow));
  assert.equal(shadow.length, 2);
  assert.equal(shadow.reduce((n, mesh) => n + (mesh instanceof THREE.InstancedMesh ? mesh.count : 1), 0), 3);
  assert.ok(shadow.every((mesh) => mesh.castShadow && mesh.layers.isEnabled(BRIDGE_SHADOW_LAYER) && !mesh.layers.test(mainLayers)));
  assert.ok(sources.every((mesh) => !mesh.visible && !mesh.castShadow));

  const ray = new THREE.Raycaster(new THREE.Vector3(62, 10, 0), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObjects(sources).length > 0);
  assert.equal(ray.intersectObjects([...color, ...shadow]).length, 0);
  result.dispose();
  assert.deepEqual(root.children, sources);
  assert.ok(sources.every((mesh) => mesh.visible && mesh.castShadow));
  geometry.dispose();
  material.dispose();
});
