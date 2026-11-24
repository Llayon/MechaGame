import { useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useLazyRef } from '../../utils/useLazyRef';
import { MAX_CASING_INSTANCES } from './debrisBallisticsPool';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';

/**
 * Low-poly 24-tri heavy autocannon/artillery casing with base extractor rim.
 */
function createShellCasingGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.042, 0.042, 0.25, 6);
  const rim = new THREE.CylinderGeometry(0.054, 0.054, 0.032, 6);
  rim.translate(0, -0.115, 0);

  const merged = mergeGeometries([body, rim], false);
  body.dispose();
  rim.dispose();
  if (!merged) {
    return new THREE.CylinderGeometry(0.044, 0.044, 0.25, 6);
  }
  merged.computeVertexNormals();
  return merged;
}

function createShellCasingMesh() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.74,
    roughness: 0.34,
  });
  const mesh = new THREE.InstancedMesh(createShellCasingGeometry(), material, MAX_CASING_INSTANCES);
  mesh.name = 'shell-casings-pool';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Reserve the per-instance color attribute before compiling the program used by ejected casings.
  mesh.setColorAt(0, new THREE.Color(0x9c7a3c));
  return mesh;
}

export function ShellCasingMesh({ children }: {
  children: (mesh: THREE.InstancedMesh, hideEmpty: boolean) => ReactNode;
}) {
  const ref = useLazyRef(createShellCasingMesh);
  const hideEmpty = useMeshShaderWarmup(ref);
  useEffect(() => {
    const mesh = ref.current;
    return () => {
      mesh.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    };
  }, [ref]);
  return children(ref.current, hideEmpty);
}
