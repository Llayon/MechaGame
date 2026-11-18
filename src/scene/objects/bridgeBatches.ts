import * as THREE from 'three';
import { batchStaticParts } from './staticBatches';

export const BRIDGE_SHADOW_LAYER = 1;

export function batchBridgeParts(root: THREE.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const shadowGroup = new THREE.Group();
  shadowGroup.name = 'bridge-shadow-batches';
  const sourceCasters: THREE.Mesh[] = [];

  function collectCasters(object: THREE.Object3D) {
    if (!object.visible || object.userData.lodDynamic) return;
    if (object instanceof THREE.Mesh && object.castShadow) {
      const proxy = object.clone(false);
      proxy.layers.set(BRIDGE_SHADOW_LAYER);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.multiplyMatrices(inverse, object.matrixWorld);
      proxy.raycast = () => {};
      shadowGroup.add(proxy);
      sourceCasters.push(object);
    }
    for (const child of object.children) collectCasters(child);
  }
  for (const child of root.children) collectCasters(child);

  const color = batchStaticParts(root, { cellSize: 96 });
  root.add(shadowGroup);
  const shadow = batchStaticParts(shadowGroup, { cellSize: 64 });
  const colorOnlyCasters = new Map<THREE.Mesh, boolean>();
  for (const { mesh } of color.batches) {
    if (mesh.castShadow) {
      colorOnlyCasters.set(mesh, true);
      mesh.castShadow = false;
    }
  }
  for (const source of sourceCasters) source.castShadow = false;

  return {
    batches: [...color.batches, ...shadow.batches],
    colorOnlyCasters,
    dispose() {
      shadow.dispose();
      shadowGroup.removeFromParent();
      for (const proxy of shadowGroup.children) {
        if (proxy instanceof THREE.InstancedMesh) proxy.dispose();
      }
      color.dispose();
      for (const source of sourceCasters) source.castShadow = true;
    },
  };
}
