import { StaticStructure } from '../objects/StaticStructure';
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_WALL_RX,
  CITADEL_WALL_RZ,
  getTerrainHeight,
} from '../../map/terrainMath';
import { LightingPreset, SectorId } from '../../map/sectors';
import { Watchtower } from '../objects/Watchtower';
import { QuonsetHangar } from '../objects/QuonsetHangar';
import { RadarTower } from '../objects/RadarTower';
import { CommsMast } from '../objects/CommsMast';
import { ArmoredVehicle } from '../objects/ArmoredVehicle';
import { BlastScreen } from '../objects/BlastScreen';
import { CitadelCourtyardBunker } from '../objects/CitadelCourtyardBunker';
import { CitadelEnergyGenerator } from '../objects/CitadelEnergyGenerator';
import { VolumetricSearchlight } from '../objects/VolumetricSearchlight';
import { getOvergrownConcreteMaterial } from '../objects/concreteMaterials';

export interface CitadelZoneProps {
  corrugatedTex: THREE.Texture;
  lightingPreset: LightingPreset;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function CitadelZone({
  corrugatedTex,
  lightingPreset,
  isSoftwareGl,
  onSelectSector,
}: CitadelZoneProps) {
  const citY = useMemo(
    () => getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z),
    [],
  );
  const floodlightsOn = lightingPreset === 'night' || lightingPreset === 'dusk';
  const citConc = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'wall', { roughness: 0.82, metalness: 0.08 }), []);
  const citConcDark = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'wall', { roughness: 0.84, metalness: 0.1 }), []);

  const { citadelWalls, bastions } = useMemo(() => {
    const segs: Array<{
      x: number;
      z: number;
      rotY: number;
      len: number;
      isGate: boolean;
    }> = [];
    const corners: Array<[number, number]> = [];
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8;
      const x0 = Math.cos(a0) * CITADEL_WALL_RX;
      const z0 = Math.sin(a0) * CITADEL_WALL_RZ;
      const x1 = Math.cos(a1) * CITADEL_WALL_RX;
      const z1 = Math.sin(a1) * CITADEL_WALL_RZ;
      corners.push([x0, z0]);
      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const rotY = Math.atan2(x1 - x0, z1 - z0);
      // Wall 1 is South road gate (approx z=+40); Wall 3 is West viaduct tunnel gate (x=-47.6)
      segs.push({ x: mx, z: mz, rotY, len, isGate: i === 1 || i === 3 });
    }
    return { citadelWalls: segs, bastions: corners };
  }, []);

  return (
    <StaticStructure revision={lightingPreset + isSoftwareGl}
      position={[CITADEL_CENTER_X, citY, CITADEL_CENTER_Z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSector('citadel');
      }}
    >
      {/* 3x Larger Octagonal Concrete Courtyard Slab (top at +0.55 above plateau) */}
      <mesh
        position={[0, 0.25, 0]}
        scale={[1, 1, CITADEL_WALL_RZ / CITADEL_WALL_RX]}
        material={citConc}
        receiveShadow
      >
        <cylinderGeometry args={[CITADEL_WALL_RX + 0.5, CITADEL_WALL_RX + 1.5, 0.6, 8]} />
      </mesh>

      {/* Octagonal Fortress Perimeter Walls (11.25 m = 3.0 units: covers Mech torso, exposes turret) */}
      {citadelWalls.map((w, i) =>
        w.isGate ? (
          <group key={i} position={[w.x, 0.52, w.z]} rotation={[0, w.rotY, 0]}>
            {/* Gatehouse flanking bastions */}
            <mesh position={[0, 3.1, -w.len * 0.38]} material={citConc} castShadow receiveShadow>
              <boxGeometry args={[2.6, 6.2, w.len * 0.24]} />
            </mesh>
            <mesh position={[0, 3.1, w.len * 0.38]} material={citConc} castShadow receiveShadow>
              <boxGeometry args={[2.6, 6.2, w.len * 0.24]} />
            </mesh>
            {/* Tall Mech-scale gate lintel (clear height >= 5.8 units = ~22 m) */}
            <mesh position={[0, 6.5, 0]} material={citConcDark} castShadow>
              <boxGeometry args={[2.9, 1.4, w.len * 0.66]} />
            </mesh>
            <mesh position={[0, 5.86, 0]}>
              <boxGeometry args={[3.0, 0.14, w.len * 0.52]} />
              <meshStandardMaterial
                color="#00E5FF"
                emissive="#00E5FF"
                emissiveIntensity={1.8}
                toneMapped={false}
                roughness={0.2}
              />
            </mesh>
          </group>
        ) : (
          <group key={i} position={[w.x, 0.52, w.z]} rotation={[0, w.rotY, 0]}>
            {/* Main hull-down ballistic curtain wall (3.0 units = 11.25 m) */}
            <mesh position={[0, 1.5, 0]} material={citConc} castShadow receiveShadow>
              <boxGeometry args={[2.2, 3.0, w.len + 1.0]} />
            </mesh>
            {/* Armored crenellation merlons (~12.0 m peak) for upper-torso firing ports */}
            {[-0.32, 0, 0.32].map((frac, mIdx) => (
              <mesh
                key={mIdx}
                position={[0, 3.12, frac * w.len]}
                material={citConcDark}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[2.45, 0.28, w.len * 0.2]} />
              </mesh>
            ))}
          </group>
        ),
      )}

      {/* 8 Corner Bastion Watchtowers + 4 Alternating Scanning Searchlights (Dusk/Night) */}
      {bastions.map(([wx, wz], idx) => (
        <group key={idx}>
          <group position={[wx * 0.96, 0.52, wz * 0.96]} scale={3.3}>
            <Watchtower position={[0, 0, 0]} lightingPreset={lightingPreset} />
          </group>
          {idx % 2 === 1 && (
            <VolumetricSearchlight
              position={[wx * 0.96, 0.52 + 2.4 * 3.3, wz * 0.96]}
              lightingPreset={lightingPreset}
              isSoftwareGl={isSoftwareGl}
              baseYaw={Math.atan2(wx, wz)}
              basePitch={0.36}
              sweepAmp={0.62}
              sweepSpeed={0.32 + idx * 0.03}
              phase={idx * 1.45}
              beamLength={62}
              beamRadius={11.0}
              housingScale={1.55}
            />
          )}
        </group>
      ))}

      {/* Central Armored Command Keep dividing the spacious inner combat courtyard */}
      <group position={[0, 0.52, -1.0]}>
        <mesh position={[0, 1.45, 0]} material={citConc} castShadow receiveShadow>
          <cylinderGeometry args={[7.2, 8.2, 2.9, 8]} />
        </mesh>
        <mesh position={[0, 3.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[4.4, 5.2, 1.0, 8]} />
          <meshStandardMaterial color="#525B66" roughness={0.65} metalness={0.35} />
        </mesh>
        <group position={[1.8, 3.7, 0]} scale={3.6}>
          <RadarTower position={[0, 0, 0]} isSoftwareGl={isSoftwareGl} />
        </group>
        <group position={[-2.4, 3.7, -1.5]} scale={3.4}>
          <CommsMast position={[0, 0, 0]} beaconLit={floodlightsOn} />
        </group>
      </group>

      {/* Inner Courtyard Hull-Down Tactical Blast Screens (11 m) for final assault cover */}
      <BlastScreen position={[-17.5, 0.52, 0.5]} rotationY={Math.PI / 2} width={10.5} height={2.9} />
      <BlastScreen position={[17.5, 0.52, 0.5]} rotationY={-Math.PI / 2} width={10.5} height={2.9} />
      <BlastScreen position={[0, 0.52, 17.5]} rotationY={0} width={12.0} height={2.9} />
      <BlastScreen position={[0, 0.52, -18.5]} rotationY={Math.PI} width={12.0} height={2.9} />

      {/* 4 Low-Profile Courtyard Bunkers & Energy Generators (5-7 m tall) in Open Quadrant Lanes */}
      <CitadelEnergyGenerator position={[-24.0, 0.54, -10.5]} rotationY={0.45} />
      <CitadelCourtyardBunker position={[24.5, 0.54, -10.0]} rotationY={-2.35} />
      <CitadelCourtyardBunker position={[-27.5, 0.54, 8.5]} rotationY={0.85} />
      <CitadelEnergyGenerator position={[27.0, 0.54, 9.0]} rotationY={-0.75} />

      {/* 8 Mech-Scale Quonset Hangars ringing the North & South-Flank depot yards */}
      <QuonsetHangar position={[-25.0, 0.52, -23.0]} rotationY={0.18} width={8.4} length={12.6} height={4.6} color="#9BA1A6" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[-9.5, 0.52, -26.5]} rotationY={0.05} width={8.4} length={12.6} height={4.6} color="#8E959B" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[9.5, 0.52, -26.5]} rotationY={-0.05} width={8.4} length={12.6} height={4.6} color="#9BA1A6" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[25.0, 0.52, -23.0]} rotationY={-0.18} width={8.4} length={12.6} height={4.6} color="#8E959B" corrugatedMap={corrugatedTex} />

      <QuonsetHangar position={[-26.5, 0.52, 21.0]} rotationY={-0.22} width={8.0} length={11.8} height={4.4} color="#8E959B" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[-15.0, 0.52, 25.5]} rotationY={0.1} width={7.8} length={11.6} height={4.4} color="#9BA1A6" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[15.0, 0.52, 25.5]} rotationY={-0.1} width={7.8} length={11.6} height={4.4} color="#8E959B" corrugatedMap={corrugatedTex} />
      <QuonsetHangar position={[26.5, 0.52, 21.0]} rotationY={0.22} width={8.0} length={11.8} height={4.4} color="#9BA1A6" corrugatedMap={corrugatedTex} />

      {/* Courtyard Armored Vehicles kept small (1.3x) for Mech scale */}
      <group position={[-8.5, 0.55, 11.5]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={1.4} color="#4B555E" />
      </group>
      <group position={[10.5, 0.55, 10.2]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={-0.8} color="#525B66" hasCannon={false} />
      </group>
      <group position={[11.0, 0.55, -11.5]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={2.3} color="#4B555E" />
      </group>

      {lightingPreset === 'night' && (
        <pointLight
          position={[0, 24, 0]}
          color="#FFB074"
          intensity={180}
          distance={120}
          decay={1.5}
        />
      )}
    </StaticStructure>
  );
}
