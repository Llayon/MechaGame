import { useMemo } from 'react';
import * as THREE from 'three';
import { getOvergrownConcreteMaterial } from './concreteMaterials';
import { getInteriorWindowMaterial } from '../visualPolish';

export interface IndustrialHallProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  length?: number;
  height?: number;
  wallColor?: string;
  corrugatedMap: THREE.Texture;
}

/**
 * Large Mech-scale industrial workshop (10-14 m tall, ~32-45 m footprint)
 * providing close-quarters brawling ambush corridors and sniper cover.
 */
export function IndustrialHall({
  position,
  rotationY = 0,
  width = 8.8,
  length = 11.8,
  height = 3.5,
  wallColor = '#9BA1A6',
  corrugatedMap,
}: IndustrialHallProps) {
  const bodyH = height * 0.78;
  const roofH = height * 0.14;
  const ventH = height * 0.12;
  const colXs = [-length * 0.35, 0, length * 0.35];

  const plinthMat = useMemo(
    () => getOvergrownConcreteMaterial('#8E959B', 'wall', { roughness: 0.84, metalness: 0.06 }),
    [],
  );
  const wallMat = useMemo(
    () =>
      getOvergrownConcreteMaterial(wallColor, 'wall', {
        roughness: 0.82,
        metalness: 0.14,
        bumpMap: corrugatedMap,
        bumpScale: 0.03,
      }),
    [wallColor, corrugatedMap],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Concrete foundation plinth */}
      <mesh position={[0, 0.14, 0]} material={plinthMat} castShadow receiveShadow>
        <boxGeometry args={[width + 0.6, 0.28, length + 0.6]} />
      </mesh>

      {/* Main corrugated concrete & clad factory hall */}
      <mesh position={[0, bodyH * 0.5 + 0.22, 0]} material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[width, bodyH, length]} />
      </mesh>

      {/* Pitched/stepped steel roof deck & upper clerestory ridge vent */}
      <mesh position={[0, bodyH + roofH * 0.5 + 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.45, roofH, length + 0.45]} />
        <meshStandardMaterial color="#525B66" roughness={0.62} metalness={0.42} />
      </mesh>
      <mesh position={[0, bodyH + roofH + ventH * 0.5 + 0.18, 0]} castShadow>
        <boxGeometry args={[width * 0.46, ventH, length * 0.82]} />
        <meshStandardMaterial color="#616B76" roughness={0.55} metalness={0.48} />
      </mesh>

      {/* Front & back Mech bay roll-up shutter doors */}
      {[-1, 1].map((side) => (
        <mesh
          key={`door-${side}`}
          position={[0, bodyH * 0.4 + 0.2, side * (length * 0.5 + 0.04)]}
          castShadow
        >
          <boxGeometry args={[width * 0.54, bodyH * 0.76, 0.1]} />
          <meshStandardMaterial color="#384048" roughness={0.58} metalness={0.45} />
        </mesh>
      ))}

      {/* Side exterior structural ribs & terracotta hazard trim band */}
      {[-1, 1].map((side) => (
        <group key={`side-${side}`}>
          {colXs.map((cz, idx) => (
            <mesh
              key={idx}
              position={[side * (width * 0.5 + 0.16), bodyH * 0.52 + 0.15, cz]}
              castShadow
            >
              <boxGeometry args={[0.34, bodyH * 0.96, 0.45]} />
              <meshStandardMaterial color="#525B66" roughness={0.6} metalness={0.48} />
            </mesh>
          ))}
          <mesh position={[side * (width * 0.5 + 0.03), bodyH * 0.85, 0]}>
            <boxGeometry args={[0.08, 0.22, length * 0.96]} />
            <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
          </mesh>
          {/* Industrial clerestory window strip with 3D Interior Mapping */}
          <mesh
            position={[side * (width * 0.5 + 0.045), bodyH * 0.62 + 0.14, 0]}
            material={getInteriorWindowMaterial()}
          >
            <boxGeometry args={[0.08, bodyH * 0.24, length * 0.88]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
