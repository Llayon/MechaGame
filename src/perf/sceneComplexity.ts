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
  function add(bucket: Bucket, mesh: THREE.Mesh) {
    const geom = mesh.geometry;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const count = (mesh as THREE.InstancedMesh).isInstancedMesh
      ? Math.max(0, (mesh as THREE.InstancedMesh).count) : 1;
    if (count <= 0) return;
    const triangleCount = geom?.index?.count != null
      ? geom.index.count / 3 : (geom?.getAttribute('position')?.count ?? 0) / 3;
    bucket.counts.visibleMeshes++;
    bucket.counts.drawCallCandidates += mats.length;
    bucket.counts.estimatedTriangles += Math.floor(triangleCount) * count;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      bucket.counts.instancedMeshes++;
      bucket.counts.activeInstances += count;
    }
    if (mesh.castShadow) bucket.counts.shadowCasters++;
    if (!mesh.frustumCulled) bucket.counts.alwaysRenderedMeshes++;
    if (mats.some(m => m?.transparent)) bucket.counts.transparentMeshes++;
    if (geom?.uuid) bucket.geoms.add(geom.uuid);
    mats.forEach(m => { if (m?.uuid) bucket.materials.add(m.uuid); });
  }
  function walk(node: THREE.Object3D, inheritedGroup: string, inheritedVisible: boolean) {
    const group = node.name.startsWith('perf:') ? node.name.slice(5) : inheritedGroup;
    const visible = inheritedVisible && node.visible;
    if (!visible) return;
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      if (!groups.has(group)) groups.set(group, freshBucket());
      add(groups.get(group)!, mesh);
      add(total, mesh);
    }
    for (const child of node.children) walk(child, group, visible);
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
      'Estimated triangles use geometry index or position buffer counts times InstancedMesh.count; they are not hardware triangle throughput.',
      'Only scene objects marked visible are counted. Actual camera frustum, occlusion and material-group passes are not evaluated.',
      'GPU time, overdraw, VRAM and CPU scene traversal costs require device-specific profilers.',
    ],
  };
}

declare global {
  interface Window {
    __mechaSceneAudit?: () => SceneComplexityReport;
  }
}
