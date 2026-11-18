import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import type { CombatSimulationState } from '../game/combatTypes';
import { useSceneSimulation } from '../scene/SceneSimulation';
import { loadCrowdRenderer } from './crowdRenderer';

export function InfantryCrowd({ combatRef }: { combatRef: MutableRefObject<CombatSimulationState> }) {
  const container = useRef<Group>(null);
  const runtime = useRef<Awaited<ReturnType<typeof loadCrowdRenderer>> | null>(null);
  const { paused, clockRef } = useSceneSimulation();
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const group = container.current!;
    let cancelled = false;
    loadCrowdRenderer()
      .then((renderer) => {
        if (cancelled) {
          renderer.dispose();
          return;
        }
        group.add(renderer.group);
        runtime.current = renderer;
        renderer.update(combatRef.current.infantry.soldiers, camera, clockRef.current.elapsed, gl.shadowMap.enabled);
        invalidate();
      })
      .catch((error) => console.warn('Infantry visuals could not be loaded.', error));
    return () => {
      cancelled = true;
      if (runtime.current) {
        group.remove(runtime.current.group);
        runtime.current.dispose();
        runtime.current = null;
      }
    };
  }, [camera, clockRef, combatRef, gl, invalidate]);
  useFrame(() => {
    if (paused) return;
    runtime.current?.update(combatRef.current.infantry.soldiers, camera, clockRef.current.elapsed, gl.shadowMap.enabled);
  });
  return <group ref={container} />;
}
