import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chooseLod, lodJitter, projectedPixels, readWorldLod } from '../../lod/worldLod';
import { SLAB_BASE_Y } from '../../map/terrainMath';
import type { PineTreeInstance } from '../../map/worldStructures';
import { createUnifiedPineTreeGeometry, PINE_TREE_TOTAL_HEIGHT } from './pineGeometry';

/** Two crossed, two-sided pine silhouettes. Geometry follows the root matrix
 * even when the tree lies on its side; the distant forest needs no alpha pass. */
function createPineCards() {
  const vertices: number[] = [], normals: number[] = [], colors: number[] = [], tips: number[] = [];
  const bark = new THREE.Color('#493327'), bottom = new THREE.Color('#253c2a'), top = new THREE.Color('#528050');
  const points = [[-.055, 0], [.055, 0], [.055, .49], [-.055, .49],
    [-.55, .32], [.55, .32], [0, 1.75], [-.34, 1.05], [.34, 1.05], [0, PINE_TREE_TOTAL_HEIGHT]];
  for (const cross of [false, true]) for (const sign of [1, -1]) {
    for (const tri of [[0,1,2], [0,2,3], [4,5,6], [7,8,9]]) {
      for (const id of sign === 1 ? tri : [...tri].reverse()) {
        const [x,y] = points[id];
        // Slightly offset the top tier toward each side to avoid coplanar overlap.
        const offset = id >= 7 ? .012 * sign : 0;
        vertices.push(cross ? offset : x, y, cross ? -x : offset);
        normals.push(cross ? sign * .45 : 0, .89, cross ? 0 : sign * .45);
        const c = id < 4 ? bark : id === 6 || id === 9 ? top : bottom;
        colors.push(c.r,c.g,c.b);
        tips.push(id === 9 ? 1 : 0);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aNeedleTip', new THREE.Float32BufferAttribute(tips, 1));
  return geometry;
}

const thresholds = [75, 17];
export function createPineBatches(trees: readonly PineTreeInstance[], material: THREE.Material, depth: THREE.Material) {
  const levels = [createUnifiedPineTreeGeometry(), createUnifiedPineTreeGeometry(true), createPineCards()];
  const geometry = mergeGeometries(levels)!;
  let offset = 0;
  const ranges = levels.map(level => {
    const start = offset, count = level.getAttribute('position').count;
    offset += count;
    level.dispose();
    return { start, count };
  });
  const cells = new Map<string, number[]>();
  for (let id = 0; id < trees.length; id++) {
    const t = trees[id], key = Math.floor(t.x / 40) + ',' + Math.floor(t.z / 40);
    const ids = cells.get(key);
    if (ids) ids.push(id);
    else cells.set(key, [id]);
  }
  const cellOf = new Uint16Array(trees.length), slotOf = new Uint16Array(trees.length);
  const group = new THREE.Group();
  const batches = Array.from(cells.values(), (ids, i) => {
    const geo = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geometry.attributes)) geo.setAttribute(name, attr);
    const sway = new THREE.InstancedBufferAttribute(new Float32Array(ids.length).fill(1), 1);
    sway.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTreeSway', sway);
    const mesh = new THREE.InstancedMesh(geo, material, ids.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.customDepthMaterial = depth;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.lodLevel = 0;
    const bounds = new THREE.Box3();
    const shadowFootprint = new THREE.Box3();
    const point = new THREE.Vector3();
    let radius = 0;
    for (const [slot, id] of ids.entries()) {
      cellOf[id] = i;
      slotOf[id] = slot;
      const t = trees[id];
      bounds.expandByPoint(point.set(t.x, t.y, t.z));
      radius = Math.max(radius, PINE_TREE_TOTAL_HEIGHT * t.heightScale + t.widthScale * .9);
    }
    // Enclose every falling orientation and wind displacement. No bounds rebuild in gameplay.
    bounds.expandByScalar(radius);
    mesh.boundingBox = bounds;
    mesh.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    let shadowLevel = 0;
    const setRange = (n: number) => geo.setDrawRange(ranges[n].start, ranges[n].count);
    setRange(0);
    mesh.onBeforeShadow = () => setRange(shadowLevel);
    mesh.onAfterShadow = () => setRange(mesh.userData.lodLevel);
    group.add(mesh);
    return {
      mesh, sway,
      update(camera: THREE.Camera, view: ReturnType<typeof readWorldLod>, frustum: THREE.Frustum, sun: readonly number[]) {
        const dist = Math.max(1, bounds.distanceToPoint(camera.position));
        const axis = camera.matrixWorldInverse.elements;
        const z0 = axis[2] >= 0 ? bounds.max.x : bounds.min.x;
        const z1 = axis[6] >= 0 ? bounds.max.y : bounds.min.y;
        const z2 = axis[10] >= 0 ? bounds.max.z : bounds.min.z;
        const nearDepth = -(axis[2] * z0 + axis[6] * z1 + axis[10] * z2 + axis[14]);
        const px = projectedPixels(radius * .45, nearDepth > 0 ? nearDepth : dist, view);
        const level = chooseLod(px, mesh.userData.lodLevel, thresholds, i);
        mesh.userData.lodLevel = level;
        setRange(level);
        shadowLevel = Math.max(level, chooseLod(px * view.shadowScale, shadowLevel, [100, 32], i));
        mesh.castShadow = view.shadowScale > 0;
        if (mesh.castShadow && level === 2 && sun[1] > 0) {
          // Project the entire cell down to the slab floor. A caster outside
          // the eye frustum can still have a long visible shadow at dusk.
          const reach = (bounds.max.y - SLAB_BASE_Y) / sun[1];
          const dx = -sun[0] * reach, dz = -sun[2] * reach;
          shadowFootprint.copy(bounds);
          shadowFootprint.min.x += Math.min(0, dx);
          shadowFootprint.max.x += Math.max(0, dx);
          shadowFootprint.min.z += Math.min(0, dz);
          shadowFootprint.max.z += Math.max(0, dz);
          shadowFootprint.min.y = Math.min(bounds.min.y, SLAB_BASE_Y);
          const receiverDist = Math.max(1, shadowFootprint.distanceToPoint(camera.position));
          const stretch = 1 + Math.hypot(sun[0], sun[2]) / sun[1];
          const shadowPixels = projectedPixels(radius * .45 * stretch, receiverDist, view) * view.shadowScale;
          mesh.castShadow = shadowPixels >= 12 * lodJitter(i) && frustum.intersectsBox(shadowFootprint);
        }
      },
    };
  });
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  return {
    group,
    setMatrixAt(id: number, matrix: THREE.Matrix4) {
      const mesh = batches[cellOf[id]].mesh;
      mesh.setMatrixAt(slotOf[id], matrix);
      mesh.instanceMatrix.needsUpdate = true;
    },
    setColorAt(id: number, color: THREE.Color) {
      const mesh = batches[cellOf[id]].mesh;
      mesh.setColorAt(slotOf[id], color);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setSway(id: number, amount: number) {
      const sway = batches[cellOf[id]].sway;
      sway.setX(slotOf[id], amount);
      sway.needsUpdate = true;
    },
    update(camera: THREE.Camera, sun: readonly number[]) {
      const view = readWorldLod(camera);
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      for (const batch of batches) batch.update(camera, view, frustum, sun);
    },
    dispose() {
      for (const { mesh } of batches) {
        mesh.dispose();
        mesh.geometry.dispose();
      }
      geometry.dispose();
    },
  };
}
