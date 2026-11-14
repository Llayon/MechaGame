import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';

export interface RockyFlankLedgeProps {
  position: readonly [number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Terraced slate rock shelf & boulder cluster (~5-9 m tall cover) anchored cleanly
 * into riverbank slopes for mech hull-down flanking maneuvers.
 */
export function RockyFlankLedge({
  position,
  rotationY = 0,
  scale = 1,
}: RockyFlankLedgeProps) {
  const [px, pz] = position;
  const baseY = useMemo(() => getTerrainHeight(px, pz) - 0.35, [px, pz]);

  return (
    <group position={[px, baseY, pz]} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Primary stepped rocky shelf slab */}
      <mesh position={[0, 0.85, 0]} rotation={[0.04, 0.15, -0.05]} castShadow receiveShadow>
        <dodecahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color="#525B66" roughness={0.85} metalness={0.04} />
      </mesh>
      {/* Flat upper rock tactical terrace cap */}
      <mesh position={[0.4, 1.35, -0.4]} rotation={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 4.1, 1.65, 7]} />
        <meshStandardMaterial color="#49525C" roughness={0.86} metalness={0.04} />
      </mesh>
      {/* Flanking tall vertical cover monoliths for 8-14 m mech hull-down cover */}
      <mesh position={[-3.2, 1.75, 1.4]} rotation={[0.12, 0.6, -0.08]} scale={[1.6, 2.25, 1.35]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial color="#525B66" roughness={0.85} metalness={0.04} />
      </mesh>
      <mesh position={[3.6, 1.5, 1.2]} rotation={[-0.08, -0.45, 0.1]} scale={[1.45, 1.85, 1.3]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial color="#5B6571" roughness={0.85} metalness={0.04} />
      </mesh>
      <mesh position={[0.2, 1.1, -3.5]} rotation={[0.18, 0.9, 0.05]} scale={[1.8, 1.4, 1.2]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial color="#49525C" roughness={0.86} metalness={0.04} />
      </mesh>
    </group>
  );
}
