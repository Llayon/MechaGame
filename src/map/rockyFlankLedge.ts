import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from './terrainMath';

type Triple = readonly [number, number, number];

function piece(geometry: THREE.BufferGeometry, position: Triple, rotation: Triple,
  color: string, scale: Triple = [1, 1, 1]) {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
  geometry.applyMatrix4(matrix);
  const rgb = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Shared by the visible prefab and its shot surface. Bake local rock transforms once.
const pieces = [
  piece(new THREE.DodecahedronGeometry(3.4), [0, .85, 0], [.04, .15, -.05], '#525B66'),
  piece(new THREE.CylinderGeometry(3.2, 4.1, 1.65, 7).toNonIndexed(),
    [.4, 1.35, -.4], [0, .4, 0], '#49525C'),
  piece(new THREE.DodecahedronGeometry(1.25), [-3.2, 1.75, 1.4], [.12, .6, -.08],
    '#525B66', [1.6, 2.25, 1.35]),
  piece(new THREE.DodecahedronGeometry(1.2), [3.6, 1.5, 1.2], [-.08, -.45, .1],
    '#5B6571', [1.45, 1.85, 1.3]),
  piece(new THREE.DodecahedronGeometry(1.15), [.2, 1.1, -3.5], [.18, .9, .05],
    '#49525C', [1.8, 1.4, 1.2]),
];
export const rockyLedgeGeometry = mergeGeometries(pieces);
rockyLedgeGeometry.computeBoundingBox();
rockyLedgeGeometry.computeBoundingSphere();

export function rockyLedgeBaseY(x: number, z: number) {
  return getTerrainHeight(x, z) - .35;
}

const shotMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
export function createRockyLedgeShotMesh(x: number, z: number, yaw: number, scale: number) {
  const mesh = new THREE.Mesh(rockyLedgeGeometry, shotMaterial);
  mesh.position.set(x, rockyLedgeBaseY(x, z), z);
  mesh.rotation.y = yaw;
  mesh.scale.setScalar(scale);
  mesh.updateMatrixWorld();
  return mesh;
}
