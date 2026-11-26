import { StaticStructure } from '../objects/StaticStructure';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, InstancedMesh, LineSegments, Mesh } from 'three';
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
import { FloodedRuins } from '../objects/FloodedRuins';
import { PowerlineNetwork } from '../objects/PowerlineNetwork';

export interface QuarryAndPassZoneProps {
  details: boolean;
  prepareDetails: boolean;
  splitBridgeBatches: boolean;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function QuarryAndPassZone({
  details,
  prepareDetails,
  splitBridgeBatches,
  lightingPreset,
  isSoftwareGl,
  onSelectSector,
}: QuarryAndPassZoneProps) {
  const detailGroup = useRef<Group>(null);
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    if (!prepareDetails || !detailGroup.current) return;
    // StaticStructure has already merged or instanced the visible concrete draws.
    const submitted = new Set<string>();
    for (const child of detailGroup.current.children) {
      child.traverseVisible(draw => {
        if (!(draw instanceof Mesh || draw instanceof LineSegments)) return;
        const material = draw.material;
        if (Array.isArray(material) || !(draw instanceof LineSegments || material.userData.localConcrete)) return;
        const variant = `${material.id}:${draw instanceof InstancedMesh}`;
        if (submitted.has(variant)) return;
        submitted.add(variant);
        void gl.compileAsync(draw, camera, scene).catch(error => {
          if (!gl.getContext().isContextLost()) console.warn('Quarry shader warmup failed', error);
        });
      });
    }
  }, [prepareDetails, gl, camera, scene]);
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
      <group name="bake-crossing">{BRIDGE_SPECS.map((spec) => (
        <BridgeSpan
          splitBridgeBatches={splitBridgeBatches}
          key={spec.id}
          spec={spec}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
        />
      ))}</group>

      {/* Flooded Eastern River Ruins & Collapsed Bridge Abutments */}
      {(details || prepareDetails) && <group ref={detailGroup} visible={details} name="quarry-details">
        <FloodedRuins lightingPreset={lightingPreset} />

        {/* Northern Canyon Pass (Point B Excavator kept small 1.35x + Powerline Poles) */}
        <StaticStructure
          onClick={details ? (e) => {
            e.stopPropagation();
            onSelectSector('crossing');
          } : undefined}
        >
          <group position={[pointBX, pointBY, pointBZ]} scale={1.35}>
            <Excavator position={[0, 0, 0]} rotationY={2.4} />
          </group>
          <PowerlineNetwork />
        </StaticStructure>

        {/* East Quarry Excavator (1.35x small scale) & Site Shed */}
        <StaticStructure
          onClick={details ? (e) => {
            e.stopPropagation();
            onSelectSector('quarry');
          } : undefined}
        >
          <group position={[quarryExcX, quarryY, quarryExcZ]} scale={1.35}>
            <Excavator position={[0, 0, 0]} rotationY={-1.9} />
          </group>
          <mesh position={[quarryShedX, quarryShedY, quarryShedZ]} castShadow receiveShadow>
            <boxGeometry args={[5.2, 2.8, 4.2]} />
            <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.18} />
          </mesh>
        </StaticStructure>
      </group>}
    </group>
  );
}
