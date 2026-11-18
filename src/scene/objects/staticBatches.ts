import * as THREE from 'three';
import { canPackSurface, createPackedSurface, staticMaterialKey, writeSurfaceAttributes } from './staticSurface';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Part = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>; transform: THREE.Matrix4 };

function compatibleGeometry(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  if (a === b) return true;
  // Parameters alone cannot identify geometry whose vertices were edited after construction.
  const attributes = Object.keys(a.attributes);
  if (attributes.length !== Object.keys(b.attributes).length) return false;
  for (const key of [...attributes, 'index']) {
    const left = key === 'index' ? a.index : a.getAttribute(key);
    const right = key === 'index' ? b.index : b.getAttribute(key);
    if (left === right) continue;
    if (!left || !right || left.itemSize !== right.itemSize ||
      left.normalized !== right.normalized || left.array.length !== right.array.length) return false;
    for (let i = 0; i < left.array.length; i++) if (left.array[i] !== right.array[i]) return false;
  }
  return true;
}

export interface StructureBatch {
  mesh: THREE.Mesh;
  bounds: THREE.Sphere;
  fineShadow: boolean;
  decorative: boolean;
  featureRadius: number;
}

/** Bake a bounded static subtree. Actors use directChildrenOnly to keep each joint independent. */
export function batchStaticParts(root: THREE.Group, options: {
  cellSize: number;
  directChildrenOnly?: boolean;
  /** Rigid actors may pack only surfaces whose material properties never change. */
  immutableJointMaterials?: ReadonlySet<THREE.Material>;
  exclude?: ReadonlySet<THREE.Object3D>;
}) {
  const buckets = new Map<string, { parts: Part[]; fineShadow: boolean; featureRadius: number }>();
  const materialKeys = new Map<THREE.Material, string>();
  const hidden: THREE.Mesh[] = [];
  const generated: THREE.Mesh[] = [];
  const packedSurfaces = new Map<string, THREE.MeshStandardMaterial>();
  const ownedMaterials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const batches: StructureBatch[] = [];
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const size = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const center = new THREE.Vector3();

  function collect(object: THREE.Object3D) {
    if (!object.visible || object.userData.lodDynamic || options.exclude?.has(object)) return;
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    if (mesh.isMesh && mesh.type === 'Mesh' && !(mesh as THREE.InstancedMesh).isInstancedMesh &&
        mesh.children.length === 0 && !Array.isArray(mesh.material) &&
        !mesh.material.transparent && !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
        (mesh.material.type === 'MeshStandardMaterial' || mesh.material.type === 'MeshBasicMaterial') &&
        (mesh.material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile || mesh.material.userData.localConcrete) &&
        mesh.geometry.drawRange.start === 0 && mesh.geometry.drawRange.count === Infinity) {
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      if (transform.determinant() <= 0) return;
      const geometry = mesh.geometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      scale.setFromMatrixScale(mesh.matrixWorld);
      box.getSize(size).multiply(scale);
      box.getCenter(center).applyMatrix4(mesh.matrixWorld);
      const sides = [size.x, size.y, size.z].sort((a,b) => a-b);
      const fineShadow = sides[1] < 0.55 && sides[2] < 8;
      const radius = size.length() * 0.5;
      let matKey = materialKeys.get(mesh.material);
      if (matKey === undefined) {
        const preserveMaterial = options.directChildrenOnly && !options.immutableJointMaterials?.has(mesh.material);
        matKey = preserveMaterial ? mesh.material.uuid : staticMaterialKey(mesh.material, canPackSurface(mesh.material));
        materialKeys.set(mesh.material, matKey);
      }
      const attributes = Object.keys(geometry.attributes).sort().join('|');
      const cell = [Math.floor(center.x/options.cellSize), Math.floor(center.z/options.cellSize)];
      const key = [matKey, attributes, mesh.castShadow, mesh.receiveShadow, mesh.layers.mask, mesh.renderOrder,
        options.directChildrenOnly ? false : fineShadow && mesh.castShadow, ...cell].join(':');
      const bucket = buckets.get(key) ?? { parts: [], fineShadow, featureRadius: 0 };
      bucket.parts.push({ mesh, transform });
      bucket.featureRadius = Math.max(bucket.featureRadius, radius);
      buckets.set(key, bucket);
    }
    if (!options.directChildrenOnly) object.children.forEach(collect);
  }
  root.children.forEach(collect);

  for (const {parts, fineShadow, featureRadius} of buckets.values()) {
    const first = parts[0].mesh;
    // Emissive navigation markers should stay legible even when their physical housings are tiny.
    const decorative = !options.directChildrenOnly && featureRadius < 1.6 && parts.every(({ mesh }) => {
      const emissive = (mesh.material as THREE.MeshStandardMaterial).emissive;
      return !emissive || emissive.getHex() === 0;
    });
    if (parts.length === 1) {
      if (!options.directChildrenOnly && ((fineShadow && first.castShadow) || decorative)) {
        first.geometry.computeBoundingSphere();
        batches.push({ mesh: first, fineShadow: fineShadow && first.castShadow, decorative, featureRadius, bounds: first.geometry.boundingSphere!.clone() });
      }
      continue;
    }
    let draw: THREE.Mesh;
    const geometry = first.geometry;
    const pack = canPackSurface(first.material) && parts.some(p => {
      if (p.mesh.material === first.material) return false;
      const surface = p.mesh.material as THREE.MeshStandardMaterial;
      const source = first.material as THREE.MeshStandardMaterial;
      return !surface.color.equals(source.color) || !surface.emissive.equals(source.emissive) ||
        surface.emissiveIntensity !== source.emissiveIntensity ||
        surface.roughness !== source.roughness || surface.metalness !== source.metalness;
    });
    let material = first.material;
    if (pack) {
      const key = materialKeys.get(material)!;
      let surface = packedSurfaces.get(key);
      if (!surface) {
        surface = createPackedSurface(material as THREE.MeshStandardMaterial);
        packedSurfaces.set(key, surface);
      }
      material = surface;
    }
    if (parts.every(p => compatibleGeometry(geometry, p.mesh.geometry))) {
      const shared = pack ? geometry.clone() : geometry;
      if (pack) {
        ownedGeometries.push(shared);
        writeSurfaceAttributes(shared, parts.map(p => p.mesh.material as THREE.MeshStandardMaterial), true);
      }
      const instances = new THREE.InstancedMesh(shared, material, parts.length);
      parts.forEach((p, i) => instances.setMatrixAt(i, p.transform));
      instances.computeBoundingSphere();
      draw = instances;
    } else {
      const pieces = parts.map(({mesh, transform}) => {
        const piece = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        if (pack) writeSurfaceAttributes(piece, [mesh.material as THREE.MeshStandardMaterial], false);
        if (material.userData.localConcrete) {
          const position = piece.getAttribute('position');
          const localY = new Float32Array(position.count);
          for (let i = 0; i < position.count; i++) localY[i] = position.getY(i);
          piece.setAttribute('aConcreteSourceY', new THREE.BufferAttribute(localY, 1));
        }
        piece.applyMatrix4(transform);
        return piece;
      });
      const merged = mergeGeometries(pieces);
      pieces.forEach(p => p.dispose());
      if (!merged) continue;
      if (material.userData.localConcrete) {
        let baked = ownedMaterials.get(material);
        if (!baked) {
          baked = (material as THREE.MeshStandardMaterial).clone();
          baked.onBeforeCompile = material.onBeforeCompile;
          baked.customProgramCacheKey = material.customProgramCacheKey;
          baked.defines = { ...baked.defines, BATCHED_CONCRETE: 1 };
          ownedMaterials.set(material, baked);
        }
        material = baked;
      }
      merged.computeBoundingSphere();
      ownedGeometries.push(merged);
      draw = new THREE.Mesh(merged, material);
    }
    draw.name = 'Static batch';
    draw.castShadow = first.castShadow;
    draw.receiveShadow = first.receiveShadow;
    draw.renderOrder = first.renderOrder;
    draw.layers.mask = first.layers.mask;
    // Original meshes retain the original sector hit tests, including on cleanup/rebuild.
    draw.raycast = () => {};
    root.add(draw);
    generated.push(draw);
    for (const {mesh} of parts) {
      mesh.visible = false;
      hidden.push(mesh);
    }
    const bound = draw instanceof THREE.InstancedMesh ? draw.boundingSphere! : draw.geometry.boundingSphere!;
    batches.push({ mesh: draw, decorative, fineShadow: fineShadow && first.castShadow, bounds: bound.clone(), featureRadius });
  }
  return { batches, dispose() {
    hidden.forEach(mesh => { mesh.visible = true; });
    for (const { mesh, fineShadow, decorative } of batches) {
      if (fineShadow) mesh.castShadow = true;
      if (decorative) {
        mesh.visible = true;
        delete mesh.userData.lodLevel;
      }
    }
    for (const mesh of generated) {
      mesh.removeFromParent();
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
    }
    ownedGeometries.forEach(g => g.dispose());
    ownedMaterials.forEach(m => m.dispose());
    packedSurfaces.forEach(m => m.dispose());
  } };
}
