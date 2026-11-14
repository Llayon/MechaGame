import { useMemo } from 'react';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_TERRACES,
  ISLAND_WATER_SLIPWAYS,
  ROCKY_WATER_RAMPS,
  getTerrainHeight,
} from '../../map/terrainMath';
import { BunkerPillbox } from '../objects/BunkerPillbox';
import { VehicleWreck } from '../objects/VehicleWreck';
import { PowerlineNetwork } from '../objects/PowerlineNetwork';
import { AntiMechBarricadeLine, BarricadeNode } from '../objects/AntiMechBarricadeLine';
import { ForwardOutpostRuins } from '../objects/ForwardOutpostRuins';
import { FuelDepotCluster } from '../objects/FuelDepotCluster';
import { RiverBendPier } from '../objects/RiverBendPier';
import { RockyFlankLedge } from '../objects/RockyFlankLedge';
import { DestroyedConvoy } from '../objects/DestroyedConvoy';
import { BlastScreen } from '../objects/BlastScreen';

export const LEFT_OUTPOST_POS: readonly [number, number] = [-154, -26];
export const LEFT_FUEL_DEPOT_POS: readonly [number, number] = [-162, 4];
export const RIVER_BEND_PIER_POS: readonly [number, number] = [101, 108];
export const RIVER_BEND_LEDGES: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [120, 80], rotY: -0.45, scale: 1.25 },
  { pos: [50, 118], rotY: 0.65, scale: 1.2 },
];

export const HQ_FOREFIELD_CONVOYS: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [-74, 86], rotY: -0.52, scale: 1.05 },
  { pos: [-46, 66], rotY: 0.35, scale: 1.0 },
];

export const HQ_FOREFIELD_ROCK_RIDGES: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  scale: number;
}> = [
  { pos: [-106, 52], rotY: 0.65, scale: 1.25 },
  { pos: [-62, 64], rotY: -0.22, scale: 1.25 },
  { pos: [-28, 70], rotY: -0.35, scale: 1.2 },
];

export const HQ_FOREFIELD_SCREENS: ReadonlyArray<{
  pos: readonly [number, number];
  rotY: number;
  width: number;
  height: number;
}> = [
  { pos: [-92, 82], rotY: 0.55, width: 11.0, height: 3.1 },
  { pos: [-52, 72], rotY: 0.35, width: 10.0, height: 2.95 },
];

export const ANTI_MECH_BARRICADE_NODES: ReadonlyArray<BarricadeNode> = [
  // Front plateau arc shielding Fuel Depot & Bunker from South/HQ approach
  { x: -178, z: 22, rotY: 0.25, kind: 'dragon-tooth', scale: 1.15 },
  { x: -172, z: 24.5, rotY: 0.18, kind: 'hedgehog', scale: 1.15 },
  { x: -165.5, z: 26, rotY: 0.1, kind: 'jersey-block', scale: 1.1 },
  { x: -158.5, z: 26.2, rotY: 0.04, kind: 'dragon-tooth', scale: 1.2 },
  { x: -152, z: 25.5, rotY: -0.05, kind: 'hedgehog', scale: 1.15 },
  { x: -145, z: 24.2, rotY: -0.14, kind: 'jersey-block', scale: 1.1 },
  { x: -137.5, z: 24.5, rotY: -0.22, kind: 'dragon-tooth', scale: 1.15 },
  // East plateau ridge arc facing the West Road & Bridge A approach
  { x: -141, z: -2, rotY: 1.38, kind: 'hedgehog', scale: 1.12 },
  { x: -139.5, z: -9.5, rotY: 1.45, kind: 'jersey-block', scale: 1.1 },
  { x: -137.5, z: -17.5, rotY: 1.48, kind: 'dragon-tooth', scale: 1.2 },
  { x: -135.5, z: -25.5, rotY: 1.52, kind: 'hedgehog', scale: 1.15 },
  { x: -134, z: -33.5, rotY: 1.58, kind: 'jersey-block', scale: 1.08 },
  // HQ Forefield south-east chevron shielding open meadow between HQ and South Channel
  { x: -89, z: 91, rotY: 0.48, kind: 'dragon-tooth', scale: 1.18 },
  { x: -83.5, z: 94, rotY: 0.42, kind: 'jersey-block', scale: 1.15 },
  { x: -78, z: 96, rotY: 0.32, kind: 'hedgehog', scale: 1.18 },
  // Riverbank forward barricade arc facing Central Island fire
  { x: -57, z: 55.5, rotY: 0.15, kind: 'jersey-block', scale: 1.15 },
  { x: -50, z: 56.8, rotY: 0.08, kind: 'hedgehog', scale: 1.15 },
  { x: -43, z: 58, rotY: -0.05, kind: 'dragon-tooth', scale: 1.18 },
];

export const FLANK_EXCLUSION_ZONES: ReadonlyArray<{ x: number; z: number; r: number }> = [
  { x: LEFT_OUTPOST_POS[0], z: LEFT_OUTPOST_POS[1], r: 14.5 },
  { x: LEFT_FUEL_DEPOT_POS[0], z: LEFT_FUEL_DEPOT_POS[1], r: 13.5 },
  { x: RIVER_BEND_PIER_POS[0], z: RIVER_BEND_PIER_POS[1], r: 22.0 },
  { x: 120, z: 80, r: 9.5 },
  { x: 50, z: 118, r: 9.5 },
  { x: -74, z: 86, r: 11.5 },
  { x: -46, z: 66, r: 11.0 },
  { x: -106, z: 52, r: 9.5 },
  { x: -62, z: 64, r: 9.5 },
  { x: -28, z: 70, r: 9.5 },
  { x: -92, z: 82, r: 8.5 },
  { x: -52, z: 72, r: 8.5 },
];

export const BUNKER_COORDS: ReadonlyArray<{ x: number; z: number; rotY: number }> = [
  { x: -136, z: 15, rotY: 1.2 },
  { x: -118, z: -55, rotY: 0.9 },
  { x: -28, z: -104, rotY: 0.15 },
  { x: 34, z: -116, rotY: -0.35 },
  { x: -38, z: 112, rotY: 2.9 },
  { x: 32, z: 102, rotY: -2.5 },
  { x: 134, z: 62, rotY: -1.65 },
  { x: -64, z: 96, rotY: 0.42 },
];

export const WRECK_COORDS: ReadonlyArray<{ x: number; z: number; rotY: number; scale: number }> = [
  { x: -142, z: 32, rotY: 0.8, scale: 1.25 },
  { x: -122, z: -88, rotY: 2.1, scale: 1.3 },
  { x: -22, z: -94, rotY: -0.6, scale: 1.2 },
  { x: 10, z: -105, rotY: 1.35, scale: 1.35 },
  { x: -50, z: 114, rotY: -1.9, scale: 1.25 },
  { x: 12, z: 108, rotY: 0.45, scale: 1.3 },
  { x: 142, z: 34, rotY: 2.5, scale: 1.25 },
  { x: 136, z: 96, rotY: -0.75, scale: 1.3 },
];

const WEST_FLANK_POWERLINE: ReadonlyArray<readonly [number, number]> = [
  [-138, 22],
  [-132, -4],
  [-126, -32],
  [-120, -60],
  [-112, -88],
];

const SOUTH_FLANK_POWERLINE: ReadonlyArray<readonly [number, number]> = [
  [-58, 108],
  [-32, 112],
  [-4, 114],
  [24, 112],
];

/**
 * Places tactical flank cover landmarks (concrete pillboxes/ДОТы, vehicle/mech
 * wreckage, left plateau forward outpost/fuel depot/anti-mech line, SE river
 * bend industrial pier & rocky ledges, flank powerline corridors, rocky
 * water-ramp guides, and mountain jump-jet terrace cover) across contested flanks.
 */
export function FlankCoverZone() {
  const bunkers = useMemo(
    () =>
      BUNKER_COORDS.map((b) => ({
        ...b,
        y: getTerrainHeight(b.x, b.z) - 0.15,
      })),
    [],
  );

  const wrecks = useMemo(
    () =>
      WRECK_COORDS.map((w) => ({
        ...w,
        y: getTerrainHeight(w.x, w.z) - 0.1,
      })),
    [],
  );

  const rampGuides = useMemo(() => {
    const items: Array<{ x: number; y: number; z: number; rotY: number; sx: number; sy: number; sz: number }> = [];
    const beacons: Array<{ x: number; y: number; z: number; rotY: number }> = [];
    const strips: Array<{ x: number; y: number; z: number; yaw: number; pitch: number; segLen: number }> = [];
    const allShoals = [...ROCKY_WATER_RAMPS, ...ISLAND_WATER_SLIPWAYS];
    for (const [ax, az, bx, bz, halfW] of allShoals) {
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const rotY = Math.atan2(dx, dz);
      for (const side of [-1, 1]) {
        for (const t of [0.24, 0.54, 0.82]) {
          const px = ax + dx * t + nx * side * (halfW + 1.5);
          const pz = az + dz * t + nz * side * (halfW + 1.5);
          const py = getTerrainHeight(px, pz);
          items.push({
            x: px,
            y: py + 0.15,
            z: pz,
            rotY: rotY + side * 0.45 + t * 1.1,
            sx: 1.55,
            sy: 1.05,
            sz: 1.85,
          });
        }
        for (const t of [0.16, 0.5, 0.86]) {
          const bxPos = ax + dx * t + nx * side * (halfW + 0.35);
          const bzPos = az + dz * t + nz * side * (halfW + 0.35);
          const byPos = getTerrainHeight(bxPos, bzPos);
          beacons.push({
            x: bxPos,
            y: Math.max(0.18, byPos),
            z: bzPos,
            rotY,
          });
        }
        // Continuous glowing #00E5FF ground guide strips flanking each water exit ramp
        const subSteps = 4;
        for (let s = 0; s < subSteps; s++) {
          const t0 = 0.14 + (s / subSteps) * 0.74;
          const t1 = 0.14 + ((s + 1) / subSteps) * 0.74;
          const x0 = ax + dx * t0 + nx * side * (halfW - 0.1);
          const z0 = az + dz * t0 + nz * side * (halfW - 0.1);
          const x1 = ax + dx * t1 + nx * side * (halfW - 0.1);
          const z1 = az + dz * t1 + nz * side * (halfW - 0.1);
          const y0 = Math.max(0.12, getTerrainHeight(x0, z0)) + 0.16;
          const y1 = Math.max(0.12, getTerrainHeight(x1, z1)) + 0.16;
          const sdx = x1 - x0;
          const sdz = z1 - z0;
          const sdy = y1 - y0;
          const hDist = Math.hypot(sdx, sdz);
          strips.push({
            x: (x0 + x1) * 0.5,
            y: (y0 + y1) * 0.5,
            z: (z0 + z1) * 0.5,
            yaw: Math.atan2(sdx, sdz),
            pitch: -Math.atan2(sdy, hDist),
            segLen: Math.hypot(hDist, sdy) + 0.2,
          });
        }
      }
    }
    return { items, beacons, strips };
  }, []);

  const terraceBarriers = useMemo(() => {
    return CITADEL_TERRACES.map((t) => {
      const outX = t.x - CITADEL_CENTER_X;
      const outZ = t.z - CITADEL_CENTER_Z;
      const len = Math.hypot(outX, outZ);
      const ux = outX / len;
      const uz = outZ / len;
      const bx = t.x + ux * (t.rx * 0.46);
      const bz = t.z + uz * (t.rz * 0.46);
      const by = getTerrainHeight(bx, bz);
      const rotY = Math.atan2(ux, uz);
      return { id: t.id, x: bx, y: by, z: bz, rotY };
    });
  }, []);

  return (
    <group>
      {bunkers.map((b, idx) => (
        <BunkerPillbox
          key={`bunker-${idx}`}
          position={[b.x, b.y, b.z]}
          rotationY={b.rotY}
          scale={1.0}
        />
      ))}

      {wrecks.map((w, idx) => (
        <VehicleWreck
          key={`wreck-${idx}`}
          position={[w.x, w.y, w.z]}
          rotationY={w.rotY}
          scale={w.scale}
        />
      ))}

      {/* Grounded natural rock guide outcrops flanking the 4 wide rocky river exit ramps */}
      {rampGuides.items.map((g, idx) => (
        <mesh
          key={`ramp-guide-${idx}`}
          position={[g.x, g.y, g.z]}
          rotation={[0.15, g.rotY, 0.12]}
          scale={[g.sx, g.sy, g.sz]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#525B66" roughness={0.85} metalness={0.04} />
        </mesh>
      ))}

      {/* Ice-cyan (#00E5FF) shoreline beacon towers & ground lane strips marking sandy-gravel water fords */}
      {rampGuides.beacons.map((b, idx) => (
        <group key={`ramp-beacon-${idx}`} position={[b.x, b.y, b.z]} rotation={[0, b.rotY, 0]}>
          {/* Concrete plinth base */}
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.72, 0.78]} />
            <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.12} />
          </mesh>
          {/* Steel beacon mast (~9 m tall) */}
          <mesh position={[0, 1.38, 0]} castShadow>
            <boxGeometry args={[0.34, 1.65, 0.34]} />
            <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.48} />
          </mesh>
          {/* Glowing #00E5FF dual lantern head & side strip */}
          <mesh position={[0, 1.98, 0]}>
            <boxGeometry args={[0.52, 0.62, 0.52]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={2.15}
              toneMapped={false}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.4, 0.75, 0.14]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.75}
              toneMapped={false}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
      {rampGuides.strips.map((st, idx) => (
        <group
          key={`ramp-strip-${idx}`}
          position={[st.x, st.y, st.z]}
          rotation={[0, st.yaw, 0]}
        >
          <mesh rotation={[st.pitch, 0, 0]}>
            <boxGeometry args={[0.26, 0.09, st.segLen]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.8}
              toneMapped={false}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Grounded rock cover formations along outer rims of Citadel jump-jet flank terraces */}
      {terraceBarriers.map((tb) => (
        <group key={tb.id} position={[tb.x, tb.y, tb.z]} rotation={[0, tb.rotY, 0]}>
          <mesh position={[0, 0.25, 0]} scale={[2.4, 1.05, 1.35]} rotation={[0.1, 0.2, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#525B66" roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[-3.2, 0.2, -0.7]} scale={[1.7, 0.95, 1.2]} rotation={[0.2, 0.8, 0.1]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#49525C" roughness={0.85} />
          </mesh>
          <mesh position={[3.2, 0.2, -0.7]} scale={[1.7, 0.95, 1.2]} rotation={[-0.1, -0.6, 0.15]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#49525C" roughness={0.85} />
          </mesh>
        </group>
      ))}

      <ForwardOutpostRuins position={LEFT_OUTPOST_POS} rotationY={0.42} />
      <FuelDepotCluster position={LEFT_FUEL_DEPOT_POS} rotationY={0.18} />
      <AntiMechBarricadeLine nodes={ANTI_MECH_BARRICADE_NODES} />

      <RiverBendPier position={RIVER_BEND_PIER_POS} rotationY={-0.32} />
      {RIVER_BEND_LEDGES.map((ledge, idx) => (
        <RockyFlankLedge
          key={`river-bend-ledge-${idx}`}
          position={ledge.pos}
          rotationY={ledge.rotY}
          scale={ledge.scale}
        />
      ))}

      {/* HQ Forefield Tactical Cover: Rock Ridges, Destroyed Convoys & Concrete Blast Screens */}
      {HQ_FOREFIELD_ROCK_RIDGES.map((ridge, idx) => (
        <RockyFlankLedge
          key={`hq-ridge-${idx}`}
          position={ridge.pos}
          rotationY={ridge.rotY}
          scale={ridge.scale}
        />
      ))}
      {HQ_FOREFIELD_CONVOYS.map((convoy, idx) => (
        <DestroyedConvoy
          key={`hq-convoy-${idx}`}
          position={convoy.pos}
          rotationY={convoy.rotY}
          scale={convoy.scale}
        />
      ))}
      {HQ_FOREFIELD_SCREENS.map((scr, idx) => (
        <BlastScreen
          key={`hq-screen-${idx}`}
          position={[scr.pos[0], getTerrainHeight(scr.pos[0], scr.pos[1]) - 0.12, scr.pos[1]]}
          rotationY={scr.rotY}
          width={scr.width}
          height={scr.height}
        />
      ))}

      <PowerlineNetwork coords={WEST_FLANK_POWERLINE} />
      <PowerlineNetwork coords={SOUTH_FLANK_POWERLINE} />
    </group>
  );
}
