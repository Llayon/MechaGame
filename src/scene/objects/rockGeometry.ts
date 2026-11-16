import * as THREE from 'three';

/**
 * Generates a chiseled, flat-shaded low-poly granite/slate rock geometry (~80 triangles)
 * via planar slicing and broadened base shaping over an Icosahedron(1, 1).
 * Designed for single-draw-call InstancedMesh rendering with varied 3-axis scaling.
 */
export function createChiseledRockGeometry(seed = 1): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(1, 1);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  // 4 deterministic fracture planes that chisel away spherical roundness
  const planes = [
    new THREE.Vector3(0.82, 0.48, 0.22).normalize(),
    new THREE.Vector3(-0.64, 0.38, 0.66).normalize(),
    new THREE.Vector3(0.16, -0.88, 0.34).normalize(),
    new THREE.Vector3(-0.34, 0.24, -0.89).normalize(),
  ];

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    for (let p = 0; p < planes.length; p++) {
      const d = v.dot(planes[p]);
      if (d > 0.62) {
        v.addScaledVector(planes[p], -(d - 0.62) * 0.78);
      }
    }

    // Subtle multi-axis mineral grain perturbation
    const grain =
      Math.sin(v.x * 3.8 + seed) * Math.cos(v.z * 3.6 - seed * 0.5) * 0.11 +
      Math.sin(v.y * 5.1 + v.x * 2.3 + seed * 1.3) * 0.055;
    v.multiplyScalar(1.0 + grain);

    // Broaden lower base and flatten underside so boulders seat naturally into slopes
    if (v.y < 0) {
      v.y *= 0.62;
      v.x *= 1.18;
      v.z *= 1.18;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  const flatGeom = geom.index ? geom.toNonIndexed() : geom;
  if (flatGeom !== geom) geom.dispose();
  flatGeom.computeVertexNormals();
  flatGeom.computeBoundingSphere();
  return flatGeom;
}
