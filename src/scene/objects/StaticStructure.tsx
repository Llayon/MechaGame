import { useLayoutEffect, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneSimulation } from '../SceneSimulation';
import { lodJitter, projectedPixels, readWorldLod } from '../../lod/worldLod';
import { batchStaticParts } from './staticBatches';
import { batchBridgeParts } from './bridgeBatches';

const center = new THREE.Vector3();

/** Static children can share a draw. Animated subtrees explicitly own their transforms. */
export function StaticStructure({
  revision,
  splitShadowBatches = false,
  ...groupProps
}: ThreeElements['group'] & { revision?: string | boolean; splitShadowBatches?: boolean }) {
  const { paused } = useSceneSimulation();
  const root = useRef<THREE.Group>(null);
  const compiled = useRef<(ReturnType<typeof batchStaticParts> | ReturnType<typeof batchBridgeParts>) | null>(null);
  const timer = useRef(0);
  useLayoutEffect(() => {
    if (!root.current) return;
    const result = splitShadowBatches
      ? batchBridgeParts(root.current)
      : batchStaticParts(root.current, { cellSize: 64 });
    compiled.current = result;
    timer.current = 0;
    return () => { result.dispose(); compiled.current = null; };
  }, [revision, splitShadowBatches]);

  useFrame(({ camera }, dt) => {
    if (paused) return;
    timer.current -= dt;
    if (timer.current > 0 || !compiled.current) return;
    timer.current = 0.12;
    const view = readWorldLod(camera);
    const { batches } = compiled.current;
    const colorOnlyCasters = 'colorOnlyCasters' in compiled.current ? compiled.current.colorOnlyCasters : undefined;
    for (let i = 0; i < batches.length; i++) {
      const part = batches[i];
      if (!part.fineShadow && !part.decorative) continue;
      const jitter = lodJitter(i);
      center.copy(part.bounds.center).applyMatrix4(part.mesh.matrixWorld);
      const radius = part.bounds.radius * part.mesh.matrixWorld.getMaxScaleOnAxis();
      // The nearest edge and extra reach keep grazing-light shadows from popping at screen edges.
      const distance = Math.max(1, center.distanceTo(camera.position) - radius - 35);
      const extent = view.focalPixels * part.featureRadius * view.shadowScale / distance;
      const colorOnly = colorOnlyCasters?.has(part.mesh);
      let castsShadow = colorOnlyCasters?.get(part.mesh) ?? part.mesh.castShadow;
      if (part.fineShadow) {
        castsShadow = extent > (castsShadow ? 3.5 : 4.5) * jitter;
        if (colorOnly) colorOnlyCasters?.set(part.mesh, castsShadow);
        else part.mesh.castShadow = castsShadow;
      }
      if (part.decorative) {
        const depth = -center.applyMatrix4(camera.matrixWorldInverse).z - radius;
        const pixels = projectedPixels(part.featureRadius, depth, view);
        const retained = castsShadow || pixels > (part.mesh.visible ? 1.6 : 2.3) * jitter;
        part.mesh.visible = retained;
        part.mesh.userData.lodLevel = retained ? 0 : 1;
      }
    }
  });
  return <group {...groupProps} ref={root} />;
}
