import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { InstancedMesh } from 'three';

/** Call after initializing instance attributes so the program matches the first visible draw. */
export function useEmptyEffectWarmup(ref: RefObject<InstancedMesh | null>): boolean {
  const { gl, camera, scene } = useThree();
  const parallel = gl.extensions.has('KHR_parallel_shader_compile');
  useEffect(() => {
    if (!parallel || !ref.current) return;
    void gl.compileAsync(ref.current, camera, scene).catch(error => {
      if (!gl.getContext().isContextLost()) console.warn('Effect shader warmup failed', error);
    });
  }, [parallel, ref, gl, camera, scene]);
  return parallel;
}
