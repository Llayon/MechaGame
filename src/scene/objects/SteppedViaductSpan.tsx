import { StaticStructure } from './StaticStructure';
import { useMemo } from 'react';
import {
  BridgeSpec,
  SLAB_BASE_Y,
  VIADUCT_BASTION_HALF,
  VIADUCT_ELBOW,
  VIADUCT_ELBOW_Y,
  WATER_LEVEL,
  getTerrainHeight,
  lerp,
} from '../../map/terrainMath';
import type { LightingPreset } from '../../map/sectors';
import { getOvergrownConcreteMaterial } from './concreteMaterials';
import { BlastScreen } from './BlastScreen';
import { BridgeArchPylon } from './BridgeArchPylon';
import { CargoContainer } from './CargoContainer';
import { VehicleWreck } from './VehicleWreck';
import { VolumetricSearchlight } from './VolumetricSearchlight';

export interface SteppedViaductSpanProps {
  spec: BridgeSpec;
  lightingPreset?: LightingPreset;
  isSoftwareGl?: boolean;
}

interface FlightGeometry {
  id: string;
  midX: number;
  midY: number;
  midZ: number;
  yaw: number;
  pitch: number;
  slopeLen: number;
  horizLen: number;
  pierBottomOffset: number;
  pierTopOffset: number;
  hasTunnel: boolean;
}

function buildFlight(
  id: string,
  ax: number,
  az: number,
  ay: number,
  bx: number,
  bz: number,
  by: number,
  hasTunnel: boolean,
): FlightGeometry {
  const dx = bx - ax;
  const dz = bz - az;
  const dy = by - ay;
  const horizLen = Math.hypot(dx, dz);
  const slopeLen = Math.hypot(horizLen, dy);
  const midX = (ax + bx) * 0.5;
  const midY = (ay + by) * 0.5;
  const midZ = (az + bz) * 0.5;
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, horizLen);
  const groundY = getTerrainHeight(midX, midZ);
  const footingY = Math.min(groundY - 1.5, WATER_LEVEL - 4.5);
  return {
    id,
    midX,
    midY,
    midZ,
    yaw,
    pitch,
    slopeLen,
    horizLen,
    pierBottomOffset: footingY - midY,
    pierTopOffset: -0.68,
    hasTunnel,
  };
}

/**
 * 2-Flight Serpentine Citadel Viaduct + Massive Central Concrete Bastion-Crossway:
 * Flight 1 (Island -> Bastion) -> Central Bastion-Crossway (47 deg turn & heat-venting cover) -> Flight 2 + Tunnel (Bastion -> Citadel West Gate).
 */
export function SteppedViaductSpan({
  spec,
  lightingPreset = 'dusk',
  isSoftwareGl = false,
}: SteppedViaductSpanProps) {
  const viaductConc = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'bridge', { roughness: 0.82, metalness: 0.08 }), []);
  const viaductConcDark = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'bridge', { roughness: 0.84, metalness: 0.06 }), []);
  const flights = useMemo(() => {
    const dx1 = VIADUCT_ELBOW[0] - spec.start[0];
    const dz1 = VIADUCT_ELBOW[1] - spec.start[1];
    const len1 = Math.hypot(dx1, dz1);
    const f1EndX = spec.start[0] + (dx1 / len1) * (len1 - VIADUCT_BASTION_HALF);
    const f1EndZ = spec.start[1] + (dz1 / len1) * (len1 - VIADUCT_BASTION_HALF);

    const dx2 = spec.end[0] - VIADUCT_ELBOW[0];
    const dz2 = spec.end[1] - VIADUCT_ELBOW[1];
    const len2 = Math.hypot(dx2, dz2);
    const f2StartX = VIADUCT_ELBOW[0] + (dx2 / len2) * VIADUCT_BASTION_HALF;
    const f2StartZ = VIADUCT_ELBOW[1] + (dz2 / len2) * VIADUCT_BASTION_HALF;

    const flight1 = buildFlight(
      'flight-1',
      spec.start[0],
      spec.start[1],
      spec.startY,
      f1EndX,
      f1EndZ,
      VIADUCT_ELBOW_Y,
      false,
    );
    const flight2 = buildFlight(
      'flight-2',
      f2StartX,
      f2StartZ,
      VIADUCT_ELBOW_Y,
      spec.end[0],
      spec.end[1],
      spec.endY,
      true,
    );
    const hubYaw = (flight1.yaw + flight2.yaw) * 0.5;
    return { flight1, flight2, hubYaw };
  }, [spec.end, spec.endY, spec.start, spec.startY]);

  const abutments = useMemo(() => {
    const startGround = getTerrainHeight(spec.start[0], spec.start[1]);
    const endGround = getTerrainHeight(spec.end[0], spec.end[1]);
    const list = [
      {
        x: spec.start[0],
        z: spec.start[1],
        yaw: flights.flight1.yaw,
        sign: -1,
        deckY: spec.startY,
        bottomY: Math.min(startGround - 2.5, SLAB_BASE_Y + 0.5),
      },
      {
        x: spec.end[0],
        z: spec.end[1],
        yaw: flights.flight2.yaw,
        sign: 1,
        deckY: spec.endY,
        bottomY: Math.min(endGround - 2.5, SLAB_BASE_Y + 0.5),
      },
    ];
    return list.map((ab) => {
      const topY = ab.deckY + 0.35;
      const height = Math.max(4.5, topY - ab.bottomY);
      const centerY = (topY + ab.bottomY) * 0.5;
      return { ...ab, height, centerY };
    });
  }, [flights.flight1.yaw, flights.flight2.yaw, spec.end, spec.endY, spec.start, spec.startY]);

  const hubFootingBottomY = useMemo(() => {
    const gy = getTerrainHeight(VIADUCT_ELBOW[0], VIADUCT_ELBOW[1]);
    return Math.min(gy - 1.5, WATER_LEVEL - 4.5);
  }, []);

  const hubWidth = 21.0;
  const hubLength = 21.0;
  const bastionH = 3.85; // ~14.4 m tall concrete bastion shielding 8-14 m Mechs
  const hubPierHeight = Math.max(4.5, VIADUCT_ELBOW_Y - 0.5 - hubFootingBottomY);
  const hubPierCenterY = hubFootingBottomY + hubPierHeight * 0.5;

  const viaductDepth = 2.0;
  const tunnelLen = 17.6;
  const tunnelClearH = 5.4;

  return (
    <StaticStructure revision={lightingPreset + isSoftwareGl} name={spec.id}>
      {/* FLIGHT 1 & FLIGHT 2 ANGLED SERPENTINE SPANS */}
      {[flights.flight1, flights.flight2].map((fl) => {
        const trussLen = fl.slopeLen * 0.88;
        const bays = 6;
        const bayLen = trussLen / bays;
        const diagLen = Math.hypot(bayLen, viaductDepth);
        const diagAngle = Math.atan2(bayLen, viaductDepth);
        const pierH = Math.max(2.5, fl.pierTopOffset - fl.pierBottomOffset);
        const pierCenterY = (fl.pierTopOffset + fl.pierBottomOffset) * 0.5;

        return (
          <group
            key={fl.id}
            position={[fl.midX, fl.midY, fl.midZ]}
            rotation={[0, fl.yaw, 0]}
          >
            {/* Pitched Structural Span */}
            <group rotation={[fl.pitch, 0, 0]}>
              <mesh position={[0, 0, 0]} material={viaductConc} castShadow receiveShadow>
                <boxGeometry args={[spec.width, 1.0, fl.slopeLen + 1.4]} />
              </mesh>
              <mesh position={[0, 0.51, 0]} receiveShadow>
                <boxGeometry args={[spec.width * 0.84, 0.04, fl.slopeLen + 1.5]} />
                <meshStandardMaterial color="#58616B" roughness={0.82} metalness={0.06} />
              </mesh>
              {[-1.5, 1.5].map((rx, idx) => (
                <mesh key={idx} position={[rx, 0.54, 0]} receiveShadow>
                  <boxGeometry args={[0.24, 0.04, fl.slopeLen + 1.0]} />
                  <meshStandardMaterial color="#454E58" roughness={0.45} metalness={0.72} />
                </mesh>
              ))}

              {/* Guardrails, Under-deck Warren Trusses & #00E5FF Navigation Strips */}
              {[-1, 1].map((side) => (
                <group key={`fl-side-${side}`}>
                  <mesh position={[side * (spec.width * 0.5 - 0.22), 0.95, 0]} material={viaductConc} castShadow>
                    <boxGeometry args={[0.45, 1.0, fl.slopeLen + 0.3]} />
                  </mesh>
                  <mesh position={[side * (spec.width * 0.43), 0.56, 0]}>
                    <boxGeometry args={[0.16, 0.06, fl.slopeLen + 0.5]} />
                    <meshStandardMaterial
                      color="#00E5FF"
                      emissive="#00E5FF"
                      emissiveIntensity={1.85}
                      toneMapped={false}
                      roughness={0.2}
                    />
                  </mesh>
                  <mesh position={[side * (spec.width * 0.5 - 0.22), 1.49, 0]}>
                    <boxGeometry args={[0.16, 0.08, fl.slopeLen + 0.3]} />
                    <meshStandardMaterial
                      color="#00E5FF"
                      emissive="#00E5FF"
                      emissiveIntensity={1.95}
                      toneMapped={false}
                      roughness={0.18}
                    />
                  </mesh>
                  <mesh position={[side * (spec.width * 0.5 + 0.04), 0.2, 0]}>
                    <boxGeometry args={[0.08, 0.14, fl.slopeLen + 0.4]} />
                    <meshStandardMaterial
                      color="#00E5FF"
                      emissive="#00E5FF"
                      emissiveIntensity={1.75}
                      toneMapped={false}
                      roughness={0.2}
                    />
                  </mesh>

                  {/* Under-deck steel Warren truss */}
                  <group position={[side * (spec.width * 0.36), -0.5, 0]}>
                    <mesh position={[0, -viaductDepth, 0]} castShadow>
                      <boxGeometry args={[0.3, 0.3, trussLen]} />
                      <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
                    </mesh>
                    {Array.from({ length: bays + 1 }).map((_, bi) => (
                      <mesh
                        key={bi}
                        position={[0, -viaductDepth * 0.5, (bi / bays - 0.5) * trussLen]}
                        castShadow
                      >
                        <boxGeometry args={[0.24, viaductDepth, 0.24]} />
                        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
                      </mesh>
                    ))}
                    {Array.from({ length: bays }).map((_, bi) => (
                      <mesh
                        key={bi}
                        position={[0, -viaductDepth * 0.5, ((bi + 0.5) / bays - 0.5) * trussLen]}
                        rotation={[(bi % 2 === 0 ? 1 : -1) * diagAngle, 0, 0]}
                        castShadow
                      >
                        <boxGeometry args={[0.2, diagLen, 0.2]} />
                        <meshStandardMaterial color="#5C6672" roughness={0.55} metalness={0.55} />
                      </mesh>
                    ))}
                  </group>
                </group>
              ))}

              {/* Protective Arch-Pylons, Cargo Containers & Scorched Wrecks */}
              {!fl.hasTunnel ? (
                <group position={[0, 0.53, 0]}>
                  {[-11.5, 0, 11.5].map((zOff, idx) => (
                    <BridgeArchPylon
                      key={`f1-arch-${idx}`}
                      position={[0, 0, zOff]}
                      span={spec.width + 0.5}
                      clearHeight={5.4}
                    />
                  ))}
                  <CargoContainer
                    position={[spec.width * 0.26, 0, -5.8]}
                    rotationY={0.14}
                    width={1.5}
                    length={3.4}
                    height={1.45}
                    color="#8F5642"
                    stacked
                  />
                  <VehicleWreck
                    position={[-spec.width * 0.26, 0, 5.8]}
                    rotationY={1.25}
                    scale={1.15}
                  />
                </group>
              ) : (
                <group position={[0, 0.53, 0]}>
                  <BridgeArchPylon
                    position={[0, 0, -11.5]}
                    span={spec.width + 0.5}
                    clearHeight={5.4}
                  />
                  <CargoContainer
                    position={[-spec.width * 0.26, 0, -5.5]}
                    rotationY={-0.12}
                    width={1.5}
                    length={3.3}
                    height={1.42}
                    color="#7D4B3A"
                  />
                  <VehicleWreck
                    position={[spec.width * 0.26, 0, -5.0]}
                    rotationY={-1.1}
                    scale={1.15}
                  />

                  {/* Hollow Passable Concrete Tunnel Gallery entering Citadel West Gate */}
                  <group position={[0, -0.03, fl.slopeLen * 0.5 - tunnelLen * 0.5 + 0.3]}>
                    {[-1, 1].map((side) => (
                      <group key={side}>
                        <mesh
                          position={[side * (spec.width * 0.5 + 0.65), tunnelClearH * 0.5, 0]}
                          material={viaductConc}
                          castShadow
                          receiveShadow
                        >
                          <boxGeometry args={[1.3, tunnelClearH, tunnelLen]} />
                        </mesh>
                        {[-5.6, 0, 5.6].map((rz, rIdx) => (
                          <mesh
                            key={rIdx}
                            position={[side * (spec.width * 0.5 + 1.3), tunnelClearH * 0.45, rz]}
                            material={viaductConcDark}
                            castShadow
                            receiveShadow
                          >
                            <boxGeometry args={[0.7, tunnelClearH * 0.9, 1.2]} />
                          </mesh>
                        ))}
                      </group>
                    ))}
                    <mesh position={[0, tunnelClearH + 0.57, 0]} material={viaductConc} castShadow receiveShadow>
                      <boxGeometry args={[spec.width + 2.6, 1.15, tunnelLen + 0.5]} />
                    </mesh>
                    <mesh
                      position={[0, tunnelClearH + 0.72, -tunnelLen * 0.5 + 0.6]}
                      material={viaductConcDark}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[spec.width + 3.4, 1.45, 1.2]} />
                    </mesh>
                    <mesh position={[0, tunnelClearH + 0.12, -tunnelLen * 0.5 + 0.02]}>
                      <boxGeometry args={[spec.width * 0.88, 0.14, 0.1]} />
                      <meshStandardMaterial
                        color="#00E5FF"
                        emissive="#00E5FF"
                        emissiveIntensity={1.65}
                        toneMapped={false}
                        roughness={0.2}
                      />
                    </mesh>
                  </group>
                </group>
              )}
            </group>

            {/* Vertical Canyon Trestle Pier under Flight Midpoint */}
            <group position={[0, 0, 0]}>
              <mesh position={[0, fl.pierTopOffset - 0.25, 0]} material={viaductConc} castShadow receiveShadow>
                <boxGeometry args={[spec.width * 0.98, 1.1, 1.9]} />
              </mesh>
              {[-spec.width * 0.28, spec.width * 0.28].map((lx, cIdx) => (
                <mesh key={cIdx} position={[lx, pierCenterY, 0]} material={viaductConc} castShadow receiveShadow>
                  <boxGeometry args={[1.4, pierH, 1.6]} />
                </mesh>
              ))}
              <mesh position={[0, pierCenterY - pierH * 0.5 + 2.1, 0]} material={viaductConcDark} castShadow receiveShadow>
                <boxGeometry args={[spec.width * 0.92, 4.2, 2.3]} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* CENTRAL CONCRETE BASTION-CROSSWAY (Бастион-перемычка на повороте серпантина) */}
      <group position={[VIADUCT_ELBOW[0], 0, VIADUCT_ELBOW[1]]} rotation={[0, flights.hubYaw, 0]}>
        {/* Main Armored Octagonal-Chamfered Bastion Deck (top at VIADUCT_ELBOW_Y + 0.50) */}
        <mesh position={[0, VIADUCT_ELBOW_Y - 0.1, 0]} material={viaductConc} castShadow receiveShadow>
          <boxGeometry args={[hubWidth, 1.2, hubLength]} />
        </mesh>
        <mesh position={[0, VIADUCT_ELBOW_Y - 0.12, 0]} rotation={[0, Math.PI / 4, 0]} material={viaductConcDark} castShadow receiveShadow>
          <boxGeometry args={[hubWidth * 0.92, 1.14, hubLength * 0.92]} />
        </mesh>
        <mesh position={[0, VIADUCT_ELBOW_Y + 0.51, 0]} receiveShadow>
          <boxGeometry args={[hubWidth - 2.4, 0.04, hubLength - 2.4]} />
          <meshStandardMaterial color="#58616B" roughness={0.82} metalness={0.06} />
        </mesh>

        {/* 4 Heavy Caisson Support Piers Anchoring the Crossway into the Gorge */}
        {[
          [-6.4, -6.4],
          [6.4, -6.4],
          [-6.4, 6.4],
          [6.4, 6.4],
        ].map(([px, pz], idx) => (
          <group key={`hub-pier-${idx}`} position={[px, 0, pz]}>
            <mesh position={[0, hubPierCenterY, 0]} material={viaductConcDark} castShadow receiveShadow>
              <boxGeometry args={[2.1, hubPierHeight, 2.1]} />
            </mesh>
            <mesh position={[0, hubFootingBottomY + 1.8, 0]} material={viaductConc} castShadow receiveShadow>
              <boxGeometry args={[3.2, 3.6, 3.2]} />
            </mesh>
          </group>
        ))}

        {/* Under-deck Steel Cross-Girder Skirt Ring */}
        <mesh position={[0, VIADUCT_ELBOW_Y - 1.1, 0]} castShadow>
          <boxGeometry args={[hubWidth * 0.9, 1.1, hubLength * 0.9]} />
          <meshStandardMaterial color="#525B66" roughness={0.62} metalness={0.44} />
        </mesh>

        {/* Flanking Concrete Bastion Walls (+X & -X sides) with Heat-Venting Louver Bays */}
        {[-1, 1].map((side) => (
          <group key={`hub-wall-${side}`} position={[side * (hubWidth * 0.5 - 1.15), VIADUCT_ELBOW_Y + 0.5, 0]}>
            <mesh position={[0, bastionH * 0.5, 0]} material={viaductConc} castShadow receiveShadow>
              <boxGeometry args={[2.3, bastionH, hubLength * 0.88]} />
            </mesh>
            <mesh position={[-side * 0.12, bastionH + 0.28, 0]} material={viaductConcDark} castShadow>
              <boxGeometry args={[2.65, 0.56, hubLength * 0.92]} />
            </mesh>
            <mesh position={[0, bastionH + 0.62, 0]} castShadow>
              <boxGeometry args={[2.1, 0.18, hubLength * 0.88]} />
              <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.48} />
            </mesh>
            {/* Terracotta tactical band & structural buttresses */}
            <mesh position={[-side * 1.16, bastionH * 0.78, 0]}>
              <boxGeometry args={[0.14, 0.24, hubLength * 0.82]} />
              <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.22} />
            </mesh>
            {[-0.32, 0, 0.32].map((frac, vIdx) => (
              <group key={`hub-vent-${vIdx}`} position={[-side * 1.14, bastionH * 0.42, frac * hubLength * 0.78]}>
                <mesh castShadow>
                  <boxGeometry args={[0.2, 1.4, 2.2]} />
                  <meshStandardMaterial color="#374049" roughness={0.55} metalness={0.6} />
                </mesh>
                <mesh position={[-side * 0.09, 0.12, 0]}>
                  <boxGeometry args={[0.06, 0.24, 1.8]} />
                  <meshStandardMaterial
                    color="#00E5FF"
                    emissive="#00E5FF"
                    emissiveIntensity={1.7}
                    toneMapped={false}
                    roughness={0.2}
                  />
                </mesh>
              </group>
            ))}
            <mesh position={[-side * 1.22, bastionH + 0.58, 0]}>
              <boxGeometry args={[0.18, 0.08, hubLength * 0.88]} />
              <meshStandardMaterial
                color="#00E5FF"
                emissive="#00E5FF"
                emissiveIntensity={1.9}
                toneMapped={false}
                roughness={0.18}
              />
            </mesh>
          </group>
        ))}

        {/* Forward Corner Citadel-Shielding Bastion Spur (blocks Citadel LoS onto Flight 1) */}
        <group position={[5.6, VIADUCT_ELBOW_Y + 0.5, 9.3]}>
          <mesh position={[0, bastionH * 0.52, 0]} material={viaductConc} castShadow receiveShadow>
            <boxGeometry args={[9.2, bastionH * 1.04, 2.1]} />
          </mesh>
          <mesh position={[0, bastionH * 1.04 + 0.28, 0]} castShadow>
            <boxGeometry args={[9.6, 0.56, 2.4]} />
            <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.48} />
          </mesh>
          <mesh position={[0, bastionH * 0.8, -1.08]}>
            <boxGeometry args={[8.4, 0.24, 0.12]} />
            <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.2} />
          </mesh>
        </group>

        {/* Central Heat-Venting Bastion Defilade Screen, Stacked Containers & Wreck Cover */}
        <BlastScreen
          position={[0.8, VIADUCT_ELBOW_Y + 0.52, 0.6]}
          rotationY={-0.38}
          width={8.4}
          height={3.2}
        />
        <CargoContainer
          position={[5.8, VIADUCT_ELBOW_Y + 0.53, -4.6]}
          rotationY={0.28}
          width={1.65}
          length={3.8}
          height={1.5}
          color="#8F5642"
          stacked
        />
        <VehicleWreck
          position={[6.2, VIADUCT_ELBOW_Y + 0.53, 3.8]}
          rotationY={-0.95}
          scale={1.2}
        />

        {/* Viaduct Checkpoint Volumetric Searchlight sweeping Flight 1 & Canyon Approach */}
        <VolumetricSearchlight
          position={[-(hubWidth * 0.5 - 1.15), VIADUCT_ELBOW_Y + 0.5 + bastionH + 0.72, 2.6]}
          lightingPreset={lightingPreset}
          isSoftwareGl={isSoftwareGl}
          baseYaw={-2.55}
          basePitch={0.44}
          sweepAmp={0.55}
          sweepSpeed={0.38}
          phase={0.85}
          beamLength={42}
          beamRadius={7.5}
          housingScale={1.35}
        />
      </group>

      {/* DEEP ANCHORED CONCRETE ABUTMENTS AT ISLAND & CITADEL WEST GATE */}
      {abutments.map((ab, idx) => (
        <group key={`v-ab-${idx}`} position={[ab.x, 0, ab.z]} rotation={[0, ab.yaw, 0]}>
          <mesh position={[0, ab.centerY, 0]} material={viaductConc} castShadow receiveShadow>
            <boxGeometry args={[spec.width + 1.6, ab.height, 3.2]} />
          </mesh>
          <mesh position={[0, ab.deckY + 0.16, ab.sign * 1.35]} material={viaductConcDark} receiveShadow>
            <boxGeometry args={[spec.width * 0.9, 0.6, 2.2]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                side * (spec.width * 0.5 + 0.65),
                ab.deckY - 1.4,
                ab.sign * 1.35,
              ]}
              rotation={[0, side * ab.sign * -0.22, 0]}
              material={viaductConc}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.75, 4.2, 3.6]} />
            </mesh>
          ))}
        </group>
      ))}
    </StaticStructure>
  );
}
