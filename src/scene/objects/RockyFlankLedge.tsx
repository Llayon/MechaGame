import { useMemo } from 'react';
import { rockyLedgeBaseY, rockyLedgeGeometry } from '../../map/rockyFlankLedge';

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
  const baseY = useMemo(() => rockyLedgeBaseY(px, pz), [px, pz]);

  return (
    <mesh geometry={rockyLedgeGeometry} position={[px, baseY, pz]}
      rotation={[0, rotationY, 0]} scale={scale} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} metalness={0.04} />
    </mesh>
  );
}
