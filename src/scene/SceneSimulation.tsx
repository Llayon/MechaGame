import { createContext, useContext, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { advanceSceneClock } from './sceneClock';
import type { SceneClock } from './sceneClock';

interface SceneSimulation {
  paused: boolean;
  clockRef: MutableRefObject<SceneClock>;
}

const SceneSimulationContext = createContext<SceneSimulation | null>(null);

/**
 * Single logical scene clock for visual animation, world events and ambience.
 * Runs before other R3F subscribers (priority -100); pause can still allow UI renders.
 */
export function SceneSimulationProvider({
  paused,
  children,
}: {
  paused: boolean;
  children: ReactNode;
}) {
  const clockRef = useRef<SceneClock>({ elapsed: 0, ticks: 0 });
  useFrame((_, delta) => {
    advanceSceneClock(clockRef.current, delta, paused);
  }, -100);
  const value = useMemo(() => ({ paused, clockRef }), [paused]);
  return (
    <SceneSimulationContext.Provider value={value}>
      {children}
    </SceneSimulationContext.Provider>
  );
}

export function useSceneSimulation(): SceneSimulation {
  const value = useContext(SceneSimulationContext);
  if (!value) throw new Error('useSceneSimulation must be inside SceneSimulationProvider');
  return value;
}
