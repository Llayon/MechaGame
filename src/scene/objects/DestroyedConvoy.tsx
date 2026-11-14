import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';
import { CargoContainer } from './CargoContainer';
import { VehicleWreck } from './VehicleWreck';

export interface DestroyedConvoyProps {
  position: readonly [number, number];
  rotationY?: number;
  scale?: number;
}

/**
 * Destroyed military supply & armored convoy cluster (scorched APC wrecks,
 * overturned trailer, spilled armored crates) grounded cleanly to terrain height
 * to break open-field LoS in front of the starting Helipad Base (HQ).
 */
export function DestroyedConvoy({
  position,
  rotationY = 0,
  scale = 1,
}: DestroyedConvoyProps) {
  const [px, pz] = position;
  const baseY = useMemo(() => getTerrainHeight(px, pz) - 0.08, [px, pz]);

  return (
    <group position={[px, baseY, pz]} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Lead scorched armored transport wreck */}
      <VehicleWreck position={[-3.4, 0, -1.6]} rotationY={0.42} scale={1.35} />

      {/* Rear damaged escort APC */}
      <VehicleWreck position={[3.8, 0, 1.9]} rotationY={-0.68} scale={1.25} />

      {/* Overturned heavy logistics trailer frame */}
      <group position={[0.4, 0.45, 0.2]} rotation={[0.14, 0.28, 0.42]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.75, 4.8]} />
          <meshStandardMaterial color="#3c3a37" roughness={0.88} metalness={0.34} />
        </mesh>
        <mesh position={[0, 0.65, -0.8]} castShadow>
          <boxGeometry args={[1.85, 0.42, 2.2]} />
          <meshStandardMaterial color="#8F5642" roughness={0.68} metalness={0.22} />
        </mesh>
        {[-1.3, 0, 1.3].map((wz, wIdx) => (
          <mesh key={wIdx} position={[1.05, -0.18, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.26, 10]} />
            <meshStandardMaterial color="#1f2021" roughness={0.92} metalness={0.18} />
          </mesh>
        ))}
      </group>

      {/* Spilled terracotta & steel cargo containers forming hull-down cover */}
      <CargoContainer
        position={[-1.4, 0, 2.6]}
        rotationY={0.55}
        width={1.6}
        length={3.5}
        height={1.45}
        color="#8F5642"
        stacked
      />
      <CargoContainer
        position={[2.8, 0, -2.5]}
        rotationY={-0.38}
        width={1.55}
        length={3.2}
        height={1.4}
        color="#525B66"
      />

      {/* Scorched concrete roadbed / impact crater pads */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.4, 14]} />
        <meshStandardMaterial color="#2f3234" roughness={0.96} metalness={0.05} />
      </mesh>
    </group>
  );
}
