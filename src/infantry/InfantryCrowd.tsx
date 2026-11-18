import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import type { CombatSimulationState } from '../game/combatTypes';
import { useSceneSimulation } from '../scene/SceneSimulation';
import { loadCrowdRenderer } from './crowdRenderer';

export function InfantryCrowd({ combatRef }: { combatRef: MutableRefObject<CombatSimulationState> }) {
  const container = useRef<Group>(null);
  const runtime = useRef<Awaited<ReturnType<typeof loadCrowdRenderer>> | null>(null);
  const { paused } = useSceneSimulation();
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
  }, []);
  useFrame(({ camera, gl }) => {
    if (paused) return;
    const combat = combatRef.current;
    runtime.current?.update(combat.infantry, camera, combat.elapsedSec, gl.shadowMap.enabled);
  });
  return <group ref={container} />;
}
