import { useLayoutEffect, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneSimulation } from '../SceneSimulation';
import { projectedPixels, readWorldLod } from '../../lod/worldLod';
import { batchStaticParts } from './staticBatches';

const center = new THREE.Vector3();

/** Static children can share a draw. Animated subtrees explicitly own their transforms. */
export function StaticStructure({ revision, ...groupProps }: ThreeElements['group'] & { revision?: string | boolean }) {
  const { paused } = useSceneSimulation();
  const root = useRef<THREE.Group>(null);
  const compiled = useRef<ReturnType<typeof batchStaticParts> | null>(null);
  const timer = useRef(0);
  useLayoutEffect(() => {
    if (!root.current) return;
    const result = batchStaticParts(root.current, { cellSize: 64 });
    compiled.current = result;
    timer.current = 0;
    return () => { result.dispose(); compiled.current = null; };
  }, [revision]);

  useFrame(({ camera }, dt) => {
    if (paused) return;
    timer.current -= dt;
    if (timer.current > 0 || !compiled.current) return;
    timer.current = 0.12;
    const view = readWorldLod(camera);
    for (const part of compiled.current.batches) {
      if (!part.fineShadow && !part.decorative) continue;
      center.copy(part.bounds.center).applyMatrix4(part.mesh.matrixWorld);
      const radius = part.bounds.radius * part.mesh.matrixWorld.getMaxScaleOnAxis();
      // The nearest edge and extra reach keep grazing-light shadows from popping at screen edges.
      const distance = Math.max(1, center.distanceTo(camera.position) - radius - 35);
      const extent = view.focalPixels * part.featureRadius * view.shadowScale / distance;
      if (part.fineShadow) part.mesh.castShadow = extent > (part.mesh.castShadow ? 3.5 : 4.5);
      if (part.decorative) {
        const depth = -center.applyMatrix4(camera.matrixWorldInverse).z - radius;
        const pixels = projectedPixels(part.featureRadius, depth, view);
        const retained = part.mesh.castShadow || pixels > (part.mesh.visible ? 1.6 : 2.3);
        part.mesh.visible = retained;
        part.mesh.userData.lodLevel = retained ? 0 : 1;
      }
    }
  });
  return <group {...groupProps} ref={root} />;
}
