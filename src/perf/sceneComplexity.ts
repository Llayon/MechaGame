import * as THREE from 'three';

/**
 * Cheap, on-demand SOURCE OBJECT inventory. It does not issue draw calls or GPU
 * timer queries and must not be advertised as a GPU profile.
 */
export interface SceneComplexityCounts {
  visibleMeshes: number;
  drawCallCandidates: number;
  instancedMeshes: number;
  activeInstances: number;
  estimatedTriangles: number;
  shadowCasters: number;
  transparentMeshes: number;
  alwaysRenderedMeshes: number;
  uniqueGeometries: number;
  uniqueMaterials: number;
  lodInstances: Record<number, number>;
}

export interface SceneComplexityReport {
  createdAt: string;
  scope: 'visible-scene-objects';
  groups: Record<string, SceneComplexityCounts>;
  total: SceneComplexityCounts;
  limitations: string[];
}

interface Bucket {
  counts: Omit<SceneComplexityCounts, 'uniqueGeometries' | 'uniqueMaterials'>;
  geoms: Set<string>;
  materials: Set<string>;
}

function freshBucket(): Bucket {
  return {
    counts: {
      visibleMeshes: 0, drawCallCandidates: 0, instancedMeshes: 0,
      activeInstances: 0, estimatedTriangles: 0,
      shadowCasters: 0, transparentMeshes: 0, alwaysRenderedMeshes: 0,
      lodInstances: {},
    },
    geoms: new Set<string>(),
    materials: new Set<string>(),
  };
}

function finalized(bucket: Bucket): SceneComplexityCounts {
  return {
    ...bucket.counts,
    uniqueGeometries: bucket.geoms.size,
    uniqueMaterials: bucket.materials.size,
  };
}

/** Follows nested JSX groups marked perf:<category>; all other objects are unclassified. */
export function analyzeSceneComplexity(scene: THREE.Scene): SceneComplexityReport {
  const groups = new Map<string, Bucket>();
  const total = freshBucket();
  function add(bucket: Bucket, mesh: THREE.Mesh, level: number | undefined) {
    const geom = mesh.geometry;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const instanced = (mesh as THREE.InstancedMesh).isInstancedMesh;
    const instancedGeom = geom as THREE.InstancedBufferGeometry;
    let count = instanced ? (mesh as THREE.InstancedMesh).count : 1;
    if (!instanced && instancedGeom.isInstancedBufferGeometry) {
      count = instancedGeom.instanceCount;
      for (const attribute of Object.values(geom.attributes)) {
        if (attribute instanceof THREE.InstancedBufferAttribute) {
          count = Math.min(count, attribute.count * attribute.meshPerAttribute);
        } else if (attribute instanceof THREE.InterleavedBufferAttribute &&
                   attribute.data instanceof THREE.InstancedInterleavedBuffer) {
          count = Math.min(count, attribute.count * attribute.data.meshPerAttribute);
        }
      }
    }
    if (!Number.isFinite(count)) count = 0;
    if (count <= 0) return;
    const end = Math.min(geom.index?.count ?? geom.getAttribute('position')?.count ?? 0,
      geom.drawRange.start + geom.drawRange.count);
    const rangeTriangles = (start: number, stop: number) =>
      Math.floor(Math.max(0, Math.min(stop, end) - Math.max(start, geom.drawRange.start)) / 3);
    let triangles = 0;
    let calls = 0;
    if (Array.isArray(mesh.material)) {
      for (const group of geom.groups) {
        if (!mats[group.materialIndex ?? 0]?.visible) continue;
        const n = rangeTriangles(group.start, group.start + group.count);
        triangles += n;
        if (n) calls++;
      }
    } else if (mesh.material.visible) {
      triangles = rangeTriangles(0, end);
      calls = triangles > 0 ? 1 : 0;
    }
    if (!calls) return;
    bucket.counts.visibleMeshes++;
    bucket.counts.drawCallCandidates += calls;
    bucket.counts.estimatedTriangles += triangles * count;
    if (level !== undefined) {
      bucket.counts.lodInstances[level] = (bucket.counts.lodInstances[level] ?? 0) + count;
    }
    if (instanced || instancedGeom.isInstancedBufferGeometry) {
      bucket.counts.instancedMeshes++;
      bucket.counts.activeInstances += count;
    }
    if (mesh.castShadow) bucket.counts.shadowCasters++;
    if (!mesh.frustumCulled) bucket.counts.alwaysRenderedMeshes++;
    if (mats.some(m => m?.transparent)) bucket.counts.transparentMeshes++;
    if (geom?.uuid) bucket.geoms.add(geom.uuid);
    mats.forEach(m => { if (m?.uuid) bucket.materials.add(m.uuid); });
  }
  function walk(node: THREE.Object3D, inheritedGroup: string, inheritedVisible: boolean, parentLod?: number) {
    const level = node.userData.lodLevel ?? parentLod;
    const group = node.name.startsWith('perf:') ? node.name.slice(5) : inheritedGroup;
    const visible = inheritedVisible && node.visible;
    if (!visible) return;
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      if (!groups.has(group)) groups.set(group, freshBucket());
      add(groups.get(group)!, mesh, level);
      add(total, mesh, level);
    }
    for (const child of node.children) walk(child, group, visible, level);
  }
  walk(scene, 'unclassified', true);
  const result: Record<string, SceneComplexityCounts> = {};
  [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, bucket]) => {
    result[name] = finalized(bucket);
  });
  return {
    createdAt: new Date().toISOString(),
    scope: 'visible-scene-objects',
    groups: result,
    total: finalized(total),
    limitations: [
      'Draw-call candidates are object/material counts, not GPU draw calls. Frustum rejection, shaders and multi-pass shadows are not measured.',
      'Triangle estimates include draw ranges, material groups and geometry or mesh instancing.',
      'LOD counts are mesh instances with a declared visual level, before frustum rejection. Actors can have multiple meshes.',
      'GPU time, overdraw, VRAM and CPU scene traversal costs require device-specific profilers.',
    ],
  };
}

declare global {
  interface Window {
    __mechaSceneAudit?: () => SceneComplexityReport;
  }
}
