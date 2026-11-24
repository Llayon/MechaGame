import { StaticStructure } from '../objects/StaticStructure';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Group, InstancedMesh, Mesh } from 'three';
import { rockyLedgeGeometry } from '../../map/rockyFlankLedge';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  CITADEL_TERRACES,
  ISLAND_WATER_SLIPWAYS,
  ROCKY_WATER_RAMPS,
  getTerrainHeight,
} from '../../map/terrainMath';
import {
  ANTI_MECH_BARRICADE_NODES,
  BUNKER_COORDS,
  FLANK_EXCLUSION_ZONES,
  HQ_FOREFIELD_CONVOYS,
  HQ_FOREFIELD_ROCK_RIDGES,
  HQ_FOREFIELD_SCREENS,
  LEFT_FUEL_DEPOT_POS,
  LEFT_OUTPOST_POS,
  RIVER_BEND_LEDGES,
  RIVER_BEND_PIER_POS,
  SOUTH_FLANK_POWERLINE,
  WEST_FLANK_POWERLINE,
  WRECK_COORDS,
} from '../../map/worldStructures';
import { BunkerPillbox } from '../objects/BunkerPillbox';
import { VehicleWreck } from '../objects/VehicleWreck';
import { PowerlineNetwork } from '../objects/PowerlineNetwork';
import { AntiMechBarricadeLine } from '../objects/AntiMechBarricadeLine';
import { ForwardOutpostRuins } from '../objects/ForwardOutpostRuins';
import { FuelDepotCluster } from '../objects/FuelDepotCluster';
import { RiverBendPier } from '../objects/RiverBendPier';
import { RockyFlankLedge } from '../objects/RockyFlankLedge';
import { DestroyedConvoy } from '../objects/DestroyedConvoy';
import { BlastScreen } from '../objects/BlastScreen';

export {
  ANTI_MECH_BARRICADE_NODES,
  BUNKER_COORDS,
  FLANK_EXCLUSION_ZONES,
  HQ_FOREFIELD_CONVOYS,
  HQ_FOREFIELD_ROCK_RIDGES,
  HQ_FOREFIELD_SCREENS,
  LEFT_FUEL_DEPOT_POS,
  LEFT_OUTPOST_POS,
  RIVER_BEND_LEDGES,
  RIVER_BEND_PIER_POS,
  WRECK_COORDS,
};

/**
 * Places tactical flank cover landmarks (concrete pillboxes/ДОТы, vehicle/mech
 * wreckage, left plateau forward outpost/fuel depot/anti-mech line, SE river
 * bend industrial pier & rocky ledges, flank powerline corridors, rocky
 * water-ramp guides, and mountain jump-jet terrace cover) across contested flanks.
 */
export function FlankCoverZone({ visible }: { visible: boolean }) {
  const { gl, scene, camera } = useThree();
  const root = useRef<Group>(null);

  useEffect(() => {
    if (visible || !root.current) return;
    // StaticStructure has built its batches in a layout effect. Compile one actual draw
    // for each cold variant, skipping the original meshes that batching hides.
    const draws = root.current.getObjectByName('flank-cover')?.children;
    if (!draws) return;
    const ledge = draws.find(o => o.visible && o instanceof Mesh && o.geometry === rockyLedgeGeometry);
    const rocks = draws.find(o => o.visible && o instanceof InstancedMesh && o.material.toneMapped
      && o.geometry.hasAttribute('aAlbedoRough') && o.geometry.type === 'DodecahedronGeometry');
    for (const draw of [ledge, rocks]) {
      if (draw) void gl.compileAsync(draw, camera, scene).catch(error => {
        if (!gl.getContext().isContextLost()) console.warn('Flank cover shader warmup failed', error);
      });
    }
  }, [visible, gl, scene, camera]);

  return <group ref={root} visible={visible}><FlankCoverStructures /></group>;
}

function FlankCoverStructures() {
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
    <StaticStructure name="flank-cover">
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
    </StaticStructure>
  );
}
