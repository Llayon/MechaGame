import { StaticStructure } from '../objects/StaticStructure';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  onCrossingReady?: () => void;
  details: boolean;
  prepareDetails: boolean;
  splitBridgeBatches: boolean;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function QuarryAndPassZone({
  onCrossingReady,
  details,
  prepareDetails,
  splitBridgeBatches,
  lightingPreset,
  isSoftwareGl,
  onSelectSector,
}: QuarryAndPassZoneProps) {
  const detailGroup = useRef<Group>(null);
  const crossing = useRef<Group>(null);
  const { gl, camera, scene } = useThree();
  // The ruins submit their stage 4 programs in the layout effect first.
  useEffect(() => {
    if (!onCrossingReady || !crossing.current) return;
    let active = true;
    const reveal = () => {
      if (!active) return;
      active = false;
      onCrossingReady();
    };
    // Keep the overview crossing visible while the detailed bridge programs link.
    const timeout = window.setTimeout(reveal, 1500);
    async function prepare(group: Group) {
      try {
        await gl.compileAsync(group, camera, scene);
      } catch (error) {
        if (!gl.getContext().isContextLost()) console.warn('Bridge shader warmup failed', error);
      } finally {
        reveal();
      }
    }
    void prepare(crossing.current);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [onCrossingReady, gl, camera, scene]);
  const [ready, setReady] = useState(false);
  const mounted = details || prepareDetails;
  const visible = details && (ready || !prepareDetails);
  useLayoutEffect(() => {
    if (!mounted) {
      if (ready) setReady(false);
      return;
    }
    if (!detailGroup.current || ready) return;
    if (!prepareDetails) {
      setReady(true);
      return;
    }
    // StaticStructure has already merged or instanced the visible concrete draws.
    const submitted = new Set<string>();
    const pending: Promise<unknown>[] = [];
    for (const child of detailGroup.current.children) {
      child.traverseVisible(draw => {
        if (!(draw instanceof Mesh || draw instanceof LineSegments)) return;
        const material = draw.material;
        if (Array.isArray(material) || !(draw instanceof LineSegments || material.userData.localConcrete)) return;
        const variant = `${material.id}:${draw instanceof InstancedMesh}`;
        if (submitted.has(variant)) return;
        submitted.add(variant);
        pending.push(gl.compileAsync(draw, camera, scene).catch(error => {
          if (!gl.getContext().isContextLost()) console.warn('Quarry shader warmup failed', error);
        }));
      });
    }
    let active = true;
    const release = () => { if (active) setReady(true); };
    void Promise.all(pending).then(release);
    return () => { active = false; };
  }, [mounted, prepareDetails, ready, gl, camera, scene]);
  useLayoutEffect(() => {
    // Avoid forcing a synchronous ruins draw while the early bridge batch is linking.
    if (!prepareDetails || ready || onCrossingReady) return;
    const timer = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [prepareDetails, ready, onCrossingReady]);
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
      <group name="bake-crossing" ref={crossing} visible={!onCrossingReady}>{BRIDGE_SPECS.map((spec) => (
        <BridgeSpan
          splitBridgeBatches={splitBridgeBatches}
          key={spec.id}
          spec={spec}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
        />
      ))}</group>

      {/* Flooded Eastern River Ruins & Collapsed Bridge Abutments */}
      {mounted && <group ref={detailGroup} visible={visible} name="quarry-details">
        <FloodedRuins lightingPreset={lightingPreset} />

        {/* Northern Canyon Pass (Point B Excavator kept small 1.35x + Powerline Poles) */}
        <StaticStructure
          onClick={visible ? (e) => {
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
          onClick={visible ? (e) => {
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
