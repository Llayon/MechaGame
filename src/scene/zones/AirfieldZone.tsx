import { StaticStructure } from '../objects/StaticStructure';
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  getTerrainHeight,
} from '../../map/terrainMath';
import { SectorId } from '../../map/sectors';
import { Helicopter } from '../objects/Helicopter';
import { ArmoredVehicle } from '../objects/ArmoredVehicle';
import { QuonsetHangar } from '../objects/QuonsetHangar';
import { getOvergrownConcreteMaterial } from '../objects/concreteMaterials';
import { getInteriorWindowMaterial } from '../visualPolish';

export interface AirfieldZoneProps {
  helipadTex: THREE.Texture;
  corrugatedTex: THREE.Texture;
  isSoftwareGl: boolean;
  onSelectSector: (id: SectorId) => void;
}

export function AirfieldZone({
  helipadTex,
  corrugatedTex,
  isSoftwareGl,
  onSelectSector,
}: AirfieldZoneProps) {
  const airY = useMemo(
    () => getTerrainHeight(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z),
    [],
  );
  const airConcrete = useMemo(
    () => getOvergrownConcreteMaterial('#9BA1A6', 'wall', { roughness: 0.82, metalness: 0.06 }),
    [],
  );

  return (
    <StaticStructure revision={isSoftwareGl}
      position={[AIRFIELD_CENTER_X, airY, AIRFIELD_CENTER_Z]}
      rotation={[0, -0.22, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSector('airfield');
      }}
    >
      {/* Main textured concrete apron with 2 "H" helipads (225 x 165 m), set back 225 m from river */}
      <mesh position={[0, 0.175, 0]} receiveShadow>
        <boxGeometry args={[60, 0.35, 44]} />
        <meshStandardMaterial
          map={helipadTex}
          color="#ffffff"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      {/* Sci-Fi ice-cyan (#00E5FF) perimeter strip framing the helipad apron */}
      {[
        { pos: [0, 0.37, -21.68] as const, size: [59.5, 0.06, 0.28] as const },
        { pos: [0, 0.37, 21.68] as const, size: [59.5, 0.06, 0.28] as const },
        { pos: [-29.68, 0.37, 0] as const, size: [0.28, 0.06, 43.5] as const },
        { pos: [29.68, 0.37, 0] as const, size: [0.28, 0.06, 43.5] as const },
      ].map((edge, idx) => (
        <mesh key={`apron-glow-${idx}`} position={edge.pos}>
          <boxGeometry args={edge.size} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={1.55}
            toneMapped={false}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Point beacons around both "H" helipad circles */}
      {[
        [-10.2, -6.6],
        [10.8, 6.16],
      ].map(([cx, cz], pIdx) => (
        <group key={`pad-beacons-${pIdx}`} position={[cx, 0.39, cz]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i / 8) * Math.PI * 2;
            const r = 7.45;
            return (
              <mesh
                key={i}
                position={[Math.cos(ang) * r, 0, Math.sin(ang) * r]}
              >
                <cylinderGeometry args={[0.24, 0.28, 0.14, 8]} />
                <meshStandardMaterial
                  color="#00E5FF"
                  emissive="#00E5FF"
                  emissiveIntensity={1.75}
                  toneMapped={false}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Low concrete perimeter berms on rear flanks (NE road gate stays wide open) */}
      <mesh position={[-30.6, 1.35, 11.5]} material={airConcrete} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.7, 22.2]} />
      </mesh>
      <mesh position={[0, 1.35, 22.6]} material={airConcrete} castShadow receiveShadow>
        <boxGeometry args={[62.4, 2.7, 1.2]} />
      </mesh>

      {/* Transport Helicopters kept small (1.4x) on massive pads for Mech scale contrast */}
      <group position={[-10.5, 0.35, -6.2]} scale={1.4}>
        <Helicopter position={[0, 0, 0]} rotationY={0.85} rotorSpin={!isSoftwareGl} />
      </group>
      <group position={[11.0, 0.35, 6.2]} scale={1.4}>
        <Helicopter position={[0, 0, 0]} rotationY={1.1} />
      </group>
      <group position={[11.0, 0.35, -6.2]} scale={1.4}>
        <Helicopter position={[0, 0, 0]} rotationY={-0.6} />
      </group>

      {/* Armored Vehicles & APCs kept small (1.3x) */}
      <group position={[-21.0, 0.35, 9.5]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={0.4} color="#4B555E" />
      </group>
      <group position={[-13.0, 0.35, 12.2]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={0.35} color="#525B66" />
      </group>
      <group position={[6.5, 0.35, -13.5]} scale={1.3}>
        <ArmoredVehicle
          position={[0, 0, 0]}
          rotationY={-0.6}
          color="#4B555E"
          hasCannon={false}
        />
      </group>
      <group position={[22.0, 0.35, -10.5]} scale={1.3}>
        <ArmoredVehicle position={[0, 0, 0]} rotationY={-1.1} color="#525B66" />
      </group>

      {/* Perimeter Hangars (13-14.6 m tall = 3.5-3.9 units) shielding start pad from Central Island fire */}
      <QuonsetHangar
        position={[-18.0, 0.35, -26.0]}
        rotationY={0}
        width={8.4}
        length={11.8}
        height={3.8}
        color="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />
      <QuonsetHangar
        position={[-4.5, 0.35, -26.0]}
        rotationY={0}
        width={8.4}
        length={11.8}
        height={3.65}
        color="#8F5642"
        roughness={0.65}
        corrugatedMap={corrugatedTex}
      />
      <QuonsetHangar
        position={[9.5, 0.35, -25.2]}
        rotationY={-0.22}
        width={8.2}
        length={11.4}
        height={3.9}
        color="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />
      {/* East perimeter hangars south of NE road gate (+27.2, -7.3) */}
      <QuonsetHangar
        position={[33.5, 0.35, 6.5]}
        rotationY={Math.PI / 2}
        width={8.2}
        length={11.4}
        height={3.85}
        color="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />
      <QuonsetHangar
        position={[33.5, 0.35, 18.0]}
        rotationY={Math.PI / 2}
        width={7.8}
        length={10.8}
        height={3.55}
        color="#8F5642"
        roughness={0.65}
        corrugatedMap={corrugatedTex}
      />
      {/* West flank hangar */}
      <QuonsetHangar
        position={[-33.5, 0.35, -7.5]}
        rotationY={Math.PI / 2}
        width={7.8}
        length={11.0}
        height={3.5}
        color="#9BA1A6"
        corrugatedMap={corrugatedTex}
      />

      {/* Concrete barracks / flight control blocks with 3D Interior Mapping windows */}
      {[-22.0, -15.5, -9.0].map((cx, i) => (
        <group key={i} position={[cx, 0, 26.5]}>
          <mesh position={[0, 1.9, 0]} material={airConcrete} castShadow receiveShadow>
            <boxGeometry args={[5.0, 3.2, 7.2]} />
          </mesh>
          <mesh position={[0, 2.38, 0]} material={getInteriorWindowMaterial()}>
            <boxGeometry args={[5.08, 0.64, 7.28]} />
          </mesh>
        </group>
      ))}
      {[
        [22.0, 14.0],
        [24.5, 11.5],
        [19.5, 16.0],
      ].map(([kx, kz], i) => (
        <mesh key={i} position={[kx, 1.05, kz]} castShadow>
          <boxGeometry args={[1.6, 1.4, 1.6]} />
          <meshStandardMaterial color="#8F5642" roughness={0.65} />
        </mesh>
      ))}
    </StaticStructure>
  );
}
