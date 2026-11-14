import { useMemo } from 'react';
import {
  BRIDGE_SPECS,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  SCALE_X,
  SCALE_Z,
  getTerrainHeight,
} from '../../map/terrainMath';
import { LightingPreset, SectorId } from '../../map/sectors';
import { BridgeSpan } from '../objects/BridgeSpan';
import { Excavator } from '../objects/Excavator';
import { PowerlineNetwork } from '../objects/PowerlineNetwork';

export interface QuarryAndPassZoneProps {
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function QuarryAndPassZone({
  lightingPreset,
  isSoftwareGl,
  onSelectSector,
}: QuarryAndPassZoneProps) {
  const pointBX = -1.8 * SCALE_X;
  const pointBZ = -10.5 * SCALE_Z;
  const quarryExcX = QUARRY_CENTER_X - 1.5;
  const quarryExcZ = QUARRY_CENTER_Z + 0.8;
  const quarryShedX = QUARRY_CENTER_X + 9.5;
  const quarryShedZ = QUARRY_CENTER_Z + 8.5;

  const pointBY = useMemo(() => getTerrainHeight(pointBX, pointBZ), [pointBX, pointBZ]);
  const quarryY = useMemo(
    () => getTerrainHeight(quarryExcX, quarryExcZ),
    [quarryExcX, quarryExcZ],
  );
  const quarryShedY = useMemo(
    () => getTerrainHeight(quarryShedX, quarryShedZ) + 1.4,
    [quarryShedX, quarryShedZ],
  );

  return (
    <group>
      {/* Bridges & Elevated Viaduct */}
      {BRIDGE_SPECS.map((spec) => (
        <BridgeSpan
          key={spec.id}
          spec={spec}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
        />
      ))}

      {/* Northern Canyon Pass (Point B Excavator kept small 1.35x + Powerline Poles) */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelectSector('crossing');
        }}
      >
        <group position={[pointBX, pointBY, pointBZ]} scale={1.35}>
          <Excavator position={[0, 0, 0]} rotationY={2.4} />
        </group>
        <PowerlineNetwork />
      </group>

      {/* East Quarry Excavator (1.35x small scale) & Site Shed */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelectSector('quarry');
        }}
      >
        <group position={[quarryExcX, quarryY, quarryExcZ]} scale={1.35}>
          <Excavator position={[0, 0, 0]} rotationY={-1.9} />
        </group>
        <mesh position={[quarryShedX, quarryShedY, quarryShedZ]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 2.8, 4.2]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.18} />
        </mesh>
      </group>
    </group>
  );
}
