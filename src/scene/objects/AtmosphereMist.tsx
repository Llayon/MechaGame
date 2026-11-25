import { useSceneSimulation } from '../SceneSimulation';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  getTerrainHeight,
} from '../../map/terrainMath';
import { createMistTexture } from '../textures';
import { useMeshShaderWarmup } from './useMeshShaderWarmup';

export interface AtmosphereMistProps {
  visible: boolean;
  isSoftwareGl: boolean;
}

export function AtmosphereMist({ visible, isSoftwareGl }: AtmosphereMistProps) {
  const smokeGroupRef = useRef<THREE.Group>(null);
  const firstPlume = useRef<THREE.Mesh>(null);
  const firstFogSheet = useRef<THREE.Mesh>(null);
  useMeshShaderWarmup(firstPlume, !visible);
  useMeshShaderWarmup(firstFogSheet, !visible);
  const mistTex = useMemo(() => createMistTexture(), []);
  const stackOrigin = useMemo(() => {
    const islandY = getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z);
    return {
      x: ISLAND_CENTER_X - 18.4,
      y: islandY + 11.8,
      z: ISLAND_CENTER_Z - 2.8,
    };
  }, []);

  useEffect(() => {
    return () => mistTex.dispose();
  }, [mistTex]);

  const { paused, clockRef } = useSceneSimulation();

  useFrame((state) => {
    if (paused) return;
    if (!visible || isSoftwareGl || !smokeGroupRef.current) return;
    const t = clockRef.current.elapsed;
    smokeGroupRef.current.children.forEach((child, idx) => {
      const phase = (t * 0.35 + idx * 0.24) % 1;
      child.position.y = stackOrigin.y + phase * 12.0;
      child.position.x = stackOrigin.x + phase * 5.2 + Math.sin(t + idx) * 0.7;
      const s = 0.6 + phase * 1.4;
      child.scale.setScalar(s);
    });
  });

  return (
    <group visible={visible}>
      {/* Smokestack exhaust plumes */}
      <group ref={smokeGroupRef}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            ref={i === 0 ? firstPlume : undefined}
            position={[stackOrigin.x + i * 1.1, stackOrigin.y + i * 2.4, stackOrigin.z]}
          >
            <dodecahedronGeometry args={[1.6, 1]} />
            <meshStandardMaterial
              color="#9FAAB3"
              transparent
              opacity={0.2 - i * 0.035}
              roughness={1}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Low-lying river valley height fog (#688296) separating water channel from upper tiers */}
      {[
        { pos: [-96, 1.4, -120] as const, size: [115, 88] as const, rot: 0.45, op: 0.22 },
        { pos: [-70, 1.6, -72] as const, size: [112, 82] as const, rot: 0.25, op: 0.24 },
        { pos: [-16, 1.7, -48] as const, size: [125, 76] as const, rot: 0.12, op: 0.22 },
        { pos: [34, 1.5, -24] as const, size: [104, 76] as const, rot: -0.45, op: 0.22 },
        { pos: [-56, 1.4, 24] as const, size: [108, 80] as const, rot: -0.35, op: 0.22 },
        { pos: [-10, 1.5, 48] as const, size: [115, 78] as const, rot: 0.18, op: 0.2 },
        { pos: [48, 1.4, 58] as const, size: [112, 82] as const, rot: -0.5, op: 0.22 },
        { pos: [82, 1.3, 118] as const, size: [125, 96] as const, rot: -0.4, op: 0.22 },
      ].map((sheet, idx) => (
        <mesh
          key={`river-fog-${idx}`}
          ref={idx === 0 ? firstFogSheet : undefined}
          position={sheet.pos}
          rotation={[-Math.PI / 2, 0, sheet.rot]}
        >
          <planeGeometry args={sheet.size} />
          <meshBasicMaterial
            map={mistTex}
            color="#688296"
            transparent
            opacity={sheet.op}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Subtle elevated canyon haze sheet hugging low channel walls */}
      {[
        { pos: [-45, 2.9, -56] as const, size: [130, 82] as const, rot: 0.2, op: 0.15 },
        { pos: [20, 2.8, 52] as const, size: [135, 84] as const, rot: -0.3, op: 0.15 },
      ].map((sheet, idx) => (
        <mesh
          key={`river-fog-upper-${idx}`}
          position={sheet.pos}
          rotation={[-Math.PI / 2, 0, sheet.rot]}
        >
          <planeGeometry args={sheet.size} />
          <meshBasicMaterial
            map={mistTex}
            color="#688296"
            transparent
            opacity={sheet.op}
            depthWrite={false}
          />
        </mesh>
      ))}

    </group>
  );
}
