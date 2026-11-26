import { useMemo } from 'react';
import { getCheckerboardShadowMaterial } from '../surfaceDetail';

export interface ExcavatorProps {
  position: [number, number, number];
  rotationY?: number;
}

export function Excavator({ position, rotationY = 0 }: ExcavatorProps) {
  const glassShadowMat = useMemo(() => getCheckerboardShadowMaterial('glass25'), []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Undercarriage tracks */}
      <mesh position={[-0.32, 0.12, 0]} castShadow>
        <boxGeometry args={[0.2, 0.22, 1.15]} />
        <meshStandardMaterial color="#262624" roughness={0.85} metalness={0.25} />
      </mesh>
      <mesh position={[0.32, 0.12, 0]} castShadow>
        <boxGeometry args={[0.2, 0.22, 1.15]} />
        <meshStandardMaterial color="#262624" roughness={0.85} metalness={0.25} />
      </mesh>
      {/* Rotating upper deck */}
      <mesh position={[0, 0.34, -0.08]} castShadow>
        <boxGeometry args={[0.74, 0.24, 0.88]} />
        <meshStandardMaterial color="#c99326" roughness={0.48} metalness={0.28} />
      </mesh>
      {/* Operator cab */}
      <mesh position={[-0.18, 0.62, 0.08]} castShadow customDepthMaterial={glassShadowMat}>
        <boxGeometry args={[0.34, 0.38, 0.42]} />
        <meshPhysicalMaterial color="#1f2c33" roughness={0.18} metalness={0.2} clearcoat={0.8} />
      </mesh>
      {/* Boom */}
      <mesh position={[0.18, 0.82, 0.42]} rotation={[-0.55, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.95, 0.16]} />
        <meshStandardMaterial color="#c99326" roughness={0.46} metalness={0.3} />
      </mesh>
      {/* Stick */}
      <mesh position={[0.18, 0.84, 0.92]} rotation={[0.78, 0, 0]} castShadow>
        <boxGeometry args={[0.11, 0.78, 0.13]} />
        <meshStandardMaterial color="#c99326" roughness={0.46} metalness={0.3} />
      </mesh>
      {/* Bucket */}
      <mesh position={[0.18, 0.46, 1.16]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.28, 0.24, 0.26]} />
        <meshStandardMaterial color="#3a3b38" roughness={0.65} metalness={0.55} />
      </mesh>
    </group>
  );
}
