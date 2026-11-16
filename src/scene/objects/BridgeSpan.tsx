import { useMemo } from 'react';
import {
  BridgeSpec,
  SLAB_BASE_Y,
  WATER_LEVEL,
  getBridgeSectionOffsets,
  getTerrainHeight,
  lerp,
} from '../../map/terrainMath';
import type { LightingPreset } from '../../map/sectors';
import { getOvergrownConcreteMaterial } from './concreteMaterials';
import { BlastScreen } from './BlastScreen';
import { BridgeArchPylon } from './BridgeArchPylon';
import { CargoContainer } from './CargoContainer';
import { GantryCrane } from './GantryCrane';
import { SteppedViaductSpan } from './SteppedViaductSpan';
import { VehicleWreck } from './VehicleWreck';
import { VolumetricSearchlight } from './VolumetricSearchlight';

export interface BridgeSpanProps {
  spec: BridgeSpec;
  lightingPreset?: LightingPreset;
  isSoftwareGl?: boolean;
}

export function BridgeSpan({
  spec,
  lightingPreset = 'dusk',
  isSoftwareGl = false,
}: BridgeSpanProps) {
  if (spec.style === 'viaduct') {
    return (
      <SteppedViaductSpan
        spec={spec}
        lightingPreset={lightingPreset}
        isSoftwareGl={isSoftwareGl}
      />
    );
  }

  const dx = spec.end[0] - spec.start[0];
  const dz = spec.end[1] - spec.start[1];
  const dy = spec.endY - spec.startY;
  const horizLen = Math.hypot(dx, dz);
  const spanLen = Math.hypot(horizLen, dy);
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, horizLen);

  const midX = (spec.start[0] + spec.end[0]) * 0.5;
  const midY = (spec.startY + spec.endY) * 0.5;
  const midZ = (spec.start[1] + spec.end[1]) * 0.5;

  const isTruss = spec.style === 'truss';
  const isCenterBridge = spec.id === 'bridge-center';
  const bridgeConc = useMemo(() => getOvergrownConcreteMaterial('#9BA1A6', 'bridge', { roughness: 0.82, metalness: 0.08 }), []);
  const bridgeConcDark = useMemo(() => getOvergrownConcreteMaterial('#8E959B', 'bridge', { roughness: 0.84, metalness: 0.06 }), []);

  const piers = useMemo(() => {
    const fractions = [0.28, 0.72];
    return fractions.map((f) => {
      const horizOffset = (f - 0.5) * horizLen;
      const worldX = spec.start[0] + dx * f;
      const worldZ = spec.start[1] + dz * f;
      const deckYAtPier = lerp(spec.startY, spec.endY, f);
      const terrainY = getTerrainHeight(worldX, worldZ);
      const footingY = Math.min(terrainY - 1.5, WATER_LEVEL - 4.5);
      const pierTopOffset = deckYAtPier - midY - 0.68;
      const pierBottomOffset = footingY - midY;
      const pierH = Math.max(2.5, pierTopOffset - pierBottomOffset);
      const pierCenterY = (pierTopOffset + pierBottomOffset) * 0.5;
      return {
        f,
        horizOffset,
        pierTopOffset,
        pierH,
        pierCenterY,
      };
    });
  }, [dx, dz, horizLen, midY, spec.endY, spec.start, spec.startY]);

  const abutments = useMemo(() => {
    const ends = [
      {
        sign: -1,
        worldX: spec.start[0],
        worldZ: spec.start[1],
        deckYAtEnd: spec.startY,
      },
      {
        sign: 1,
        worldX: spec.end[0],
        worldZ: spec.end[1],
        deckYAtEnd: spec.endY,
      },
    ];
    return ends.map((end) => {
      const groundY = getTerrainHeight(end.worldX, end.worldZ);
      const bottomY = Math.min(groundY - 2.5, SLAB_BASE_Y + 0.5);
      const topY = end.deckYAtEnd + 0.35;
      const height = Math.max(4.5, topY - bottomY);
      const centerY = (topY + bottomY) * 0.5 - midY;
      const localZ = end.sign * (horizLen * 0.5 - 0.6);
      const deckSurfaceY = end.deckYAtEnd - midY;
      return {
        ...end,
        height,
        centerY,
        localZ,
        deckSurfaceY,
      };
    });
  }, [horizLen, midY, spec.end, spec.endY, spec.start, spec.startY]);

  // Tall through-truss for Crossing A (5.4 units = ~20.25 m clearance for 8-14 m mechs)
  const trussLen = spanLen * 0.88;
  const trussBays = 8;
  const bayLen = trussLen / trussBays;
  const trussH = 5.4;
  const diagLen = Math.hypot(bayLen, trussH);
  const diagAngle = Math.atan2(bayLen, trussH);

  // 40-50 m bridge section stations for concrete arch-pylons, containers, and vehicle wrecks
  const sectionOffsets = useMemo(() => getBridgeSectionOffsets(spec), [spec]);
  const sectionBays = useMemo(() => {
    const bays: Array<{ zMid: number; side: number; idx: number }> = [];
    for (let i = 0; i < sectionOffsets.length - 1; i++) {
      bays.push({
        zMid: (sectionOffsets[i] + sectionOffsets[i + 1]) * 0.5,
        side: i % 2 === 0 ? 1 : -1,
        idx: i,
      });
    }
    return bays;
  }, [sectionOffsets]);

  return (
    <group position={[midX, midY, midZ]} rotation={[0, yaw, 0]}>
      {/* PITCHED SPAN ASSEMBLY (deck, rails, girders, trusses, open tunnel gallery) */}
      <group rotation={[pitch, 0, 0]}>
        {/* Main structural concrete deck (1.0 unit thick -> top at +0.50) */}
        <mesh position={[0, 0, 0]} material={bridgeConc} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 1.0, spanLen + 1.2]} />
        </mesh>

        {/* Top walkable / drivable paved deck strip (top at +0.53) */}
        <mesh position={[0, 0.51, 0]} receiveShadow>
          <boxGeometry args={[spec.width * 0.84, 0.04, spanLen + 1.5]} />
          <meshStandardMaterial color="#58616B" roughness={0.82} metalness={0.06} />
        </mesh>

        {/* Sci-Fi ice-cyan (#00E5FF) emissive guide strips along deck curbs, parapet top rims, outer fascias & portals */}
        {[-1, 1].map((side) => {
          const xStrip = side * (spec.width * 0.43);
          const xParapetTop = side * (spec.width * 0.5 - 0.22);
          const xOuterFascia = side * (spec.width * 0.5 + 0.04);
          return (
            <group key={`nav-${side}`}>
              {/* Inner roadway curb strip */}
              <mesh position={[xStrip, 0.56, 0]}>
                <boxGeometry args={[0.16, 0.06, spanLen + 0.4]} />
                <meshStandardMaterial
                  color="#00E5FF"
                  emissive="#00E5FF"
                  emissiveIntensity={1.85}
                  toneMapped={false}
                  roughness={0.2}
                />
              </mesh>
              {/* Top rim of concrete parapet (visible from overview camera above guardrails) */}
              <mesh position={[xParapetTop, 1.49, 0]}>
                <boxGeometry args={[0.16, 0.08, spanLen]} />
                <meshStandardMaterial
                  color="#00E5FF"
                  emissive="#00E5FF"
                  emissiveIntensity={1.95}
                  toneMapped={false}
                  roughness={0.18}
                />
              </mesh>
              {/* Outer deck side fascia light strip */}
              <mesh position={[xOuterFascia, 0.2, 0]}>
                <boxGeometry args={[0.08, 0.14, spanLen + 0.5]} />
                <meshStandardMaterial
                  color="#00E5FF"
                  emissive="#00E5FF"
                  emissiveIntensity={1.75}
                  toneMapped={false}
                  roughness={0.2}
                />
              </mesh>
              {[-1, 1].map((endSign) => (
                <mesh
                  key={`beacon-${endSign}`}
                  position={[
                    side * (spec.width * 0.48),
                    1.72,
                    endSign * (spanLen * 0.49),
                  ]}
                >
                  <boxGeometry args={[0.3, 0.68, 0.3]} />
                  <meshStandardMaterial
                    color="#00E5FF"
                    emissive="#00E5FF"
                    emissiveIntensity={2.05}
                    toneMapped={false}
                    roughness={0.18}
                  />
                </mesh>
              ))}
            </group>
          );
        })}


        {/* Side steel girders / concrete parapets + under-deck I-beam stringers */}
        {[-1, 1].map((side) => {
          const xEdge = side * (spec.width * 0.5 - 0.22);
          const xUnder = side * (spec.width * 0.34);
          return (
            <group key={side}>
              <mesh position={[xEdge, 0.95, 0]} material={bridgeConc} castShadow>
                <boxGeometry args={[0.45, 1.0, spanLen]} />
              </mesh>
              <mesh position={[xUnder, -0.82, 0]} castShadow>
                <boxGeometry args={[0.55, 0.85, spanLen * 0.94]} />
                <meshStandardMaterial color="#525B66" roughness={0.62} metalness={0.5} />
              </mesh>
            </group>
          );
        })}

        {/* Tall Warren Through-Truss for Crossing A (mech-scale clearance) */}
        {isTruss && (
          <group position={[0, 0.5, 0]}>
            {[-1, 1].map((side) => {
              const xSide = side * (spec.width * 0.45);
              return (
                <group key={side}>
                  <mesh position={[xSide, trussH, 0]} castShadow>
                    <boxGeometry args={[0.38, 0.38, trussLen]} />
                    <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
                  </mesh>
                  {Array.from({ length: trussBays + 1 }).map((_, i) => {
                    const zNode = (i / trussBays - 0.5) * trussLen;
                    return (
                      <mesh key={i} position={[xSide, trussH * 0.5, zNode]} castShadow>
                        <boxGeometry args={[0.32, trussH, 0.32]} />
                        <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
                      </mesh>
                    );
                  })}
                  {Array.from({ length: trussBays }).map((_, i) => {
                    const zMid = ((i + 0.5) / trussBays - 0.5) * trussLen;
                    const dir = i % 2 === 0 ? 1 : -1;
                    return (
                      <mesh
                        key={i}
                        position={[xSide, trussH * 0.5, zMid]}
                        rotation={[dir * diagAngle, 0, 0]}
                        castShadow
                      >
                        <boxGeometry args={[0.25, diagLen, 0.25]} />
                        <meshStandardMaterial color="#5C6672" roughness={0.55} metalness={0.55} />
                      </mesh>
                    );
                  })}
                </group>
              );
            })}

            {Array.from({ length: trussBays + 1 }).map((_, i) => {
              const zNode = (i / trussBays - 0.5) * trussLen;
              return (
                <mesh key={i} position={[0, trussH, zNode]} castShadow>
                  <boxGeometry args={[spec.width * 0.96, 0.32, 0.32]} />
                  <meshStandardMaterial color="#525B66" roughness={0.55} metalness={0.58} />
                </mesh>
              );
            })}
          </group>
        )}

        {/* 40-50 m Bridge Sections: Massive Concrete Arch-Pylons, Cargo Containers & Scorched Wrecks */}
        <group position={[0, 0.53, 0]}>
          {sectionOffsets.map((zOff, idx) => (
            <BridgeArchPylon
              key={`arch-${idx}`}
              position={[0, 0, zOff]}
              span={isTruss ? spec.width + 1.2 : spec.width + 0.5}
              clearHeight={isTruss ? 6.0 : 5.4}
            />
          ))}
          {(isTruss || isCenterBridge) && sectionOffsets.length > 0 && (
            <VolumetricSearchlight
              position={[
                0,
                (isTruss ? 6.0 : 5.4) + 1.1,
                sectionOffsets[isTruss ? Math.floor(sectionOffsets.length * 0.5) : 0],
              ]}
              lightingPreset={lightingPreset}
              isSoftwareGl={isSoftwareGl}
              baseYaw={isTruss ? -2.35 : -2.85}
              basePitch={0.42}
              sweepAmp={0.68}
              sweepSpeed={isTruss ? 0.34 : 0.42}
              phase={isTruss ? 2.1 : 4.2}
              beamLength={40}
              beamRadius={7.0}
              housingScale={1.25}
            />
          )}

          {sectionBays.map(({ zMid, side, idx }) => {
            const containerColor = idx % 2 === 0 ? '#8F5642' : '#7D4B3A';
            const laneOffset = spec.width * 0.275;
            return (
              <group key={`bay-${idx}`}>
                <CargoContainer
                  position={[side * laneOffset, 0, zMid - 0.9]}
                  rotationY={side * 0.14}
                  width={1.5}
                  length={3.4}
                  height={1.45}
                  color={containerColor}
                  stacked={idx % 2 === 0}
                />
                <VehicleWreck
                  position={[-side * (spec.width * 0.28), 0, zMid + 1.2]}
                  rotationY={side * 1.15 + idx * 0.4}
                  scale={1.2}
                />
              </group>
            );
          })}
        </group>

        {/* Central Bridge Tactical Sniper Screens (16 m) & Overhead Gantry Arch */}
        {isCenterBridge && (
          <group position={[0, 0.5, 0]}>
            <BlastScreen
              position={[spec.width * 0.5 - 0.22, 0, -5.8]}
              rotationY={-Math.PI / 2}
              width={9.5}
              height={4.3}
            />
            <BlastScreen
              position={[spec.width * 0.5 - 0.22, 0, 5.8]}
              rotationY={-Math.PI / 2}
              width={9.5}
              height={4.3}
            />
            <GantryCrane
              position={[0, 0, 0]}
              rotationY={0}
              span={spec.width + 1.8}
              height={6.2}
              depth={5.2}
            />
          </group>
        )}

      </group>

      {/* VERTICAL PIERS & TRESTLE BENTS (always upright in world Y) */}
      {piers.map((p, idx) => (
        <group key={idx} position={[0, 0, p.horizOffset]}>
          <mesh position={[0, p.pierTopOffset - 0.25, 0]} material={bridgeConc} castShadow receiveShadow>
            <boxGeometry args={[spec.width * 0.98, 1.1, 1.9]} />
          </mesh>

          <group>
            {[-spec.width * 0.28, spec.width * 0.28].map((lx, cIdx) => (
              <mesh key={cIdx} position={[lx, p.pierCenterY, 0]} material={bridgeConc} castShadow receiveShadow>
                <boxGeometry args={[1.4, p.pierH, 1.6]} />
              </mesh>
            ))}
            <mesh
              position={[0, p.pierCenterY - p.pierH * 0.5 + 2.1, 0]}
              material={bridgeConcDark}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[spec.width * 0.92, 4.2, 2.3]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* DEEP ANCHORED CONCRETE ABUTMENTS & WING WALLS AT BOTH ENDS */}
      {abutments.map((ab, idx) => (
        <group key={idx} position={[0, 0, ab.localZ]}>
          <mesh position={[0, ab.centerY, 0]} material={bridgeConc} castShadow receiveShadow>
            <boxGeometry args={[spec.width + 1.6, ab.height, 3.2]} />
          </mesh>
          <mesh position={[0, ab.deckSurfaceY + 0.16, ab.sign * 1.35]} material={bridgeConcDark} receiveShadow>
            <boxGeometry args={[spec.width * 0.9, 0.6, 2.2]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                side * (spec.width * 0.5 + 0.65),
                ab.deckSurfaceY - 1.4,
                ab.sign * 1.35,
              ]}
              rotation={[0, side * ab.sign * -0.22, 0]}
              material={bridgeConc}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.75, 4.2, 3.6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
