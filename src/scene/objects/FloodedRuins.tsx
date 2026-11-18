import { StaticStructure } from './StaticStructure';
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  EAST_CROSSING_ABUTMENT_STUBS,
  FLOODED_RUIN_CLUSTERS,
} from '../../map/floodedRuins';
import { SLAB_BASE_Y, WATER_LEVEL, getTerrainHeight } from '../../map/terrainMath';
import type { LightingPreset } from '../../map/sectors';
import { getOvergrownConcreteMaterial } from './concreteMaterials';

export interface FloodedRuinsProps {
  lightingPreset?: LightingPreset;
}

export function FloodedRuins({ lightingPreset = 'dusk' }: FloodedRuinsProps) {
  const ruinConc = useMemo(
    () => getOvergrownConcreteMaterial('#93999E', 'ruin', { roughness: 0.86, metalness: 0.06 }),
    [],
  );
  const deckConc = useMemo(
    () => getOvergrownConcreteMaterial('#868D94', 'bridge', { roughness: 0.82, metalness: 0.08 }),
    [],
  );
  const darkAsphaltMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4F5760',
        roughness: 0.85,
        metalness: 0.05,
      }),
    [],
  );
  const rustedSteelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6E3B2B',
        roughness: 0.62,
        metalness: 0.48,
      }),
    [],
  );
  const paintedCraneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9D4F30',
        roughness: 0.48,
        metalness: 0.36,
      }),
    [],
  );
  const darkIronMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#343C45',
        roughness: 0.5,
        metalness: 0.65,
      }),
    [],
  );
  const containerTealMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#415A61',
        roughness: 0.54,
        metalness: 0.32,
      }),
    [],
  );
  const hazardYellowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#C78A28',
        roughness: 0.56,
        metalness: 0.24,
      }),
    [],
  );

  const beaconEmissive = lightingPreset === 'night' ? 2.1 : lightingPreset === 'dusk' ? 1.5 : 0.95;

  const abutmentGeoms = useMemo(() => {
    return EAST_CROSSING_ABUTMENT_STUBS.map((stub) => {
      const groundY = getTerrainHeight(stub.x, stub.z);
      const bottomY = Math.min(groundY - 2.5, SLAB_BASE_Y + 0.5);
      const topY = stub.deckY + 0.35;
      const height = Math.max(4.5, topY - bottomY);
      const centerY = (topY + bottomY) * 0.5 - stub.deckY;
      return { stub, height, centerY };
    });
  }, []);

  const subFloorY = WATER_LEVEL - 4.8;
  const pumpHall = FLOODED_RUIN_CLUSTERS[0];
  const manifold = FLOODED_RUIN_CLUSTERS[1];
  const collapsedPier = FLOODED_RUIN_CLUSTERS[2];
  const intakeCaisson = FLOODED_RUIN_CLUSTERS[3];
  const gantryFrame = FLOODED_RUIN_CLUSTERS[4];
  const groundedBarge = FLOODED_RUIN_CLUSTERS[5];

  return (
    <StaticStructure revision={lightingPreset} name="flooded-eastern-ruins">
      {/* 1. Broken East Crossing Shore Abutment Stubs + Collapsed Deck Ends */}
      {abutmentGeoms.map(({ stub, height, centerY }) => (
        <group
          key={stub.id}
          position={[stub.x, stub.deckY, stub.z]}
          rotation={[0, stub.yaw, 0]}
        >
          {/* Deep anchored concrete abutment base */}
          <mesh position={[0, centerY, -0.4]} material={deckConc} castShadow receiveShadow>
            <boxGeometry args={[stub.width + 1.5, height, 3.8]} />
          </mesh>
          {/* Intact shore stub deck extending shortly out over bank */}
          <mesh position={[0, 0.0, 1.3]} material={deckConc} castShadow receiveShadow>
            <boxGeometry args={[stub.width, 0.95, 3.6]} />
          </mesh>
          {/* Asphalt strip on stub */}
          <mesh position={[0, 0.5, 1.1]} material={darkAsphaltMat} receiveShadow>
            <boxGeometry args={[stub.width * 0.84, 0.05, 3.2]} />
          </mesh>
          {/* Side parapet stubs */}
          {[-1, 1].map((side) => (
            <mesh
              key={`parapet-${side}`}
              position={[side * (stub.width * 0.5 - 0.22), 0.95, 0.6]}
              material={ruinConc}
              castShadow
            >
              <boxGeometry args={[0.45, 1.0, 4.2]} />
            </mesh>
          ))}
          {/* Jersey barricade blocks across broken deck drop-off + amber hazard beacons */}
          {[-2.5, 0, 2.5].map((bx, bIdx) => (
            <group key={`barricade-${bIdx}`} position={[bx, 0.92, 2.2]}>
              <mesh material={hazardYellowMat} castShadow receiveShadow>
                <boxGeometry args={[2.1, 0.88, 0.72]} />
              </mesh>
              <mesh position={[0, 0.58, 0]}>
                <boxGeometry args={[0.26, 0.24, 0.26]} />
                <meshStandardMaterial
                  color="#FF7A1A"
                  emissive="#FF7A1A"
                  emissiveIntensity={beaconEmissive}
                  toneMapped={false}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ))}
          {/* Collapsed concrete deck section pitched steeply down toward river */}
          <group position={[0, -0.55, 4.6]} rotation={[stub.collapsedDropPitch, 0, 0]}>
            <mesh material={ruinConc} castShadow receiveShadow>
              <boxGeometry args={[stub.width * 0.92, 0.85, 4.6]} />
            </mesh>
            <mesh position={[0, 0.44, 0]} material={darkAsphaltMat} receiveShadow>
              <boxGeometry args={[stub.width * 0.78, 0.04, 4.2]} />
            </mesh>
            {/* Protruding sheared steel I-beams & rebar */}
            {[-2.8, -1.0, 1.1, 2.7].map((rx, rIdx) => (
              <mesh
                key={`rebar-${rIdx}`}
                position={[rx, -0.15, 2.8]}
                rotation={[0.08 * (rIdx % 2 === 0 ? 1 : -1), 0.05 * rx, 0]}
                material={rustedSteelMat}
                castShadow
              >
                <boxGeometry args={[0.18, 0.22, 1.9]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* 2. Flooded Pump Station Hall (navigable 6.4 u center lane between twin concrete blast walls) */}
      <group position={[pumpHall.x, WATER_LEVEL, pumpHall.z]} rotation={[0, pumpHall.rotY, 0]}>
        {/* Submerged foundation floor slab */}
        <mesh position={[0, subFloorY + 1.2, 0]} material={deckConc} receiveShadow>
          <boxGeometry args={[9.4, 2.4, 9.0]} />
        </mesh>
        {/* Twin side walls with pilasters & jagged upper cornice */}
        {[-1, 1].map((side) => (
          <group key={`hall-wall-${side}`} position={[side * 3.8, 0, 0]}>
            <mesh position={[0, -0.7, 0]} material={ruinConc} castShadow receiveShadow>
              <boxGeometry args={[1.2, 7.6, 8.2]} />
            </mesh>
            {[-2.8, 0, 2.8].map((pz, pIdx) => (
              <mesh
                key={`pilaster-${pIdx}`}
                position={[side * 0.35, -0.5, pz]}
                material={deckConc}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.55, 8.0, 0.9]} />
              </mesh>
            ))}
            {/* Rusted corrugated upper wall remnant */}
            <mesh
              position={[0, 2.85, side * -1.1]}
              rotation={[0, 0, side * 0.04]}
              material={rustedSteelMat}
              castShadow
            >
              <boxGeometry args={[0.42, 1.3, 4.6]} />
            </mesh>
          </group>
        ))}
        {/* Elevated overhead pipe-bridge truss (> 4.5 u above water so Mech walks cleanly underneath) */}
        <mesh position={[0, 4.75, -1.8]} material={darkIronMat} castShadow>
          <boxGeometry args={[8.4, 0.55, 0.65]} />
        </mesh>
        <mesh position={[0, 5.2, 1.6]} material={rustedSteelMat} castShadow>
          <boxGeometry args={[8.2, 0.42, 0.48]} />
        </mesh>
      </group>

      {/* 3. Flooded Pipeline Manifold & Vertical Surge Tank */}
      <group position={[manifold.x, WATER_LEVEL, manifold.z]} rotation={[0, manifold.rotY, 0]}>
        <mesh position={[0, -1.0, 0]} material={ruinConc} castShadow receiveShadow>
          <boxGeometry args={[5.2, 7.4, 3.2]} />
        </mesh>
        {/* Surge tank cylinder */}
        <mesh position={[1.1, 0.6, 0]} material={rustedSteelMat} castShadow receiveShadow>
          <cylinderGeometry args={[1.15, 1.25, 6.2, 12]} />
        </mesh>
        <mesh position={[1.1, 3.7, 0]} material={darkIronMat} castShadow>
          <cylinderGeometry args={[1.32, 1.32, 0.28, 12]} />
        </mesh>
        {/* Broken horizontal steel feeder pipes */}
        {[-0.65, 0.65].map((pz, idx) => (
          <mesh
            key={`pipe-${idx}`}
            position={[-1.4, 1.55, pz]}
            rotation={[0, 0, Math.PI / 2]}
            material={darkIronMat}
            castShadow
          >
            <cylinderGeometry args={[0.38, 0.42, 4.2, 8]} />
          </mesh>
        ))}
        {/* Catwalk platform remnant */}
        <mesh position={[-1.4, 2.7, 0]} material={paintedCraneMat} castShadow>
          <boxGeometry args={[2.3, 0.18, 2.8]} />
        </mesh>
      </group>

      {/* 4. Collapsed East Bridge Center Pier & Leaning Deck Slab */}
      <group
        position={[collapsedPier.x, WATER_LEVEL, collapsedPier.z]}
        rotation={[0, collapsedPier.rotY, 0]}
      >
        {/* Broad submerged pile cap base */}
        <mesh position={[0, -2.5, 0]} material={deckConc} receiveShadow>
          <boxGeometry args={[7.8, 5.0, 4.6]} />
        </mesh>
        {/* Twin broken bridge pier shafts */}
        {[-1, 1].map((side) => (
          <mesh
            key={`pier-col-${side}`}
            position={[side * 2.2, 0.1, 0]}
            material={ruinConc}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.5, 6.0, 1.8]} />
          </mesh>
        ))}
        {/* Crosshead pier cap tilted slightly */}
        <mesh
          position={[0, 2.55, 0]}
          rotation={[0.08, 0, -0.09]}
          material={deckConc}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[6.8, 1.0, 2.2]} />
        </mesh>
        {/* Leaning collapsed concrete bridge deck chunk leaning into river */}
        <mesh
          position={[0.2, 1.15, 0.4]}
          rotation={[0.42, 0.08, -0.14]}
          material={ruinConc}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[6.4, 0.85, 4.6]} />
        </mesh>
        {/* Exposed twisted steel I-beams & rebar */}
        {[-1.8, 0.1, 1.9].map((gx, gIdx) => (
          <mesh
            key={`girder-${gIdx}`}
            position={[gx, 2.25, 1.6]}
            rotation={[0.48, 0.12 * (gIdx - 1), -0.1]}
            material={rustedSteelMat}
            castShadow
          >
            <boxGeometry args={[0.26, 0.35, 3.2]} />
          </mesh>
        ))}
      </group>

      {/* 5. Submerged Cooling-Water Intake Tower Caisson */}
      <group
        position={[intakeCaisson.x, WATER_LEVEL, intakeCaisson.z]}
        rotation={[0, intakeCaisson.rotY, 0]}
      >
        <mesh position={[0, -1.2, 0]} material={ruinConc} castShadow receiveShadow>
          <cylinderGeometry args={[2.35, 2.65, 7.6, 12]} />
        </mesh>
        <mesh position={[0, 2.75, 0]} material={deckConc} castShadow receiveShadow>
          <cylinderGeometry args={[2.55, 2.4, 0.5, 12]} />
        </mesh>
        {/* Intake grate recess frame */}
        <mesh position={[0, 1.0, 2.15]} material={darkIronMat} castShadow>
          <boxGeometry args={[2.1, 1.8, 0.45]} />
        </mesh>
        {/* Rooftop pump motor house + beacon mast */}
        <mesh position={[-0.35, 3.45, -0.25]} material={rustedSteelMat} castShadow>
          <boxGeometry args={[1.6, 1.1, 1.5]} />
        </mesh>
        <mesh position={[1.1, 4.15, 0.7]} material={darkIronMat} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 2.4, 6]} />
        </mesh>
      </group>

      {/* 6. Half-Sunken Port Gantry Crane Frame (5.4 u clear under-portal lane) */}
      <group
        position={[gantryFrame.x, WATER_LEVEL, gantryFrame.z]}
        rotation={[0, gantryFrame.rotY, 0]}
      >
        {/* Twin leg caissons & angled steel portal legs */}
        {[-1, 1].map((side) => (
          <group key={`gantry-leg-${side}`} position={[side * 3.4, 0, 0]}>
            <mesh position={[0, -1.6, 0]} material={deckConc} castShadow receiveShadow>
              <boxGeometry args={[1.5, 6.8, 4.1]} />
            </mesh>
            <mesh position={[0, 3.25, -1.2]} material={paintedCraneMat} castShadow>
              <boxGeometry args={[0.52, 4.8, 0.52]} />
            </mesh>
            <mesh position={[0, 3.25, 1.2]} material={paintedCraneMat} castShadow>
              <boxGeometry args={[0.52, 4.8, 0.52]} />
            </mesh>
          </group>
        ))}
        {/* Counterweight housing on west caisson */}
        <mesh position={[-3.4, 2.6, 0]} material={rustedSteelMat} castShadow receiveShadow>
          <boxGeometry args={[1.35, 1.7, 3.2]} />
        </mesh>
        {/* High horizontal crane bridge girder & tilted boom arm */}
        <mesh position={[0, 5.55, 0]} rotation={[0, 0, -0.05]} material={paintedCraneMat} castShadow>
          <boxGeometry args={[8.4, 0.72, 2.8]} />
        </mesh>
        <mesh position={[1.8, 6.2, -0.5]} material={darkIronMat} castShadow>
          <boxGeometry args={[1.8, 1.35, 1.4]} />
        </mesh>
        <mesh
          position={[4.6, 6.85, 0]}
          rotation={[0, 0, 0.32]}
          material={paintedCraneMat}
          castShadow
        >
          <boxGeometry args={[6.8, 0.42, 0.85]} />
        </mesh>
      </group>

      {/* 7. Grounded / Half-Submerged Industrial Cargo Barge & Container */}
      <group
        position={[groundedBarge.x, WATER_LEVEL, groundedBarge.z]}
        rotation={[0.06, groundedBarge.rotY, 0.14]}
      >
        {/* Main steel barge hull anchored deep below bed */}
        <mesh position={[0, -1.1, 0]} material={darkIronMat} castShadow receiveShadow>
          <boxGeometry args={[4.4, 5.6, 10.2]} />
        </mesh>
        {/* Rusted upper deck coaming & bulwarks */}
        <mesh position={[0, 1.85, 0]} material={rustedSteelMat} castShadow receiveShadow>
          <boxGeometry args={[4.55, 0.35, 10.35]} />
        </mesh>
        {/* Rear wheelhouse superstructure */}
        <mesh position={[0, 2.85, -3.5]} material={deckConc} castShadow receiveShadow>
          <boxGeometry args={[2.9, 1.8, 2.2]} />
        </mesh>
        <mesh position={[0, 3.9, -3.5]} material={paintedCraneMat} castShadow>
          <boxGeometry args={[2.4, 0.35, 1.8]} />
        </mesh>
        {/* Cargo container resting on barge deck (tactical cover height) */}
        <mesh
          position={[-0.25, 2.85, 1.45]}
          rotation={[0, 0.08, 0]}
          material={containerTealMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.1, 1.75, 4.6]} />
        </mesh>
        {/* Timber/rubber dock bumper pilings beside barge bow */}
        <mesh position={[2.6, 0.4, 3.2]} rotation={[0.08, 0, -0.1]} material={rustedSteelMat} castShadow>
          <cylinderGeometry args={[0.32, 0.35, 5.8, 8]} />
        </mesh>
      </group>
    </StaticStructure>
  );
}
