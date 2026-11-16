import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTerrainHeight } from '../../map/terrainMath';
import { buildPowerlineCatenarySegments } from '../../map/horizonLandmarks';
import { DEFAULT_POWERLINE_POLE_COORDS } from '../../map/worldStructures';

export interface PowerlineNetworkProps {
  coords?: ReadonlyArray<readonly [number, number]>;
}

export function PowerlineNetwork({
  coords = DEFAULT_POWERLINE_POLE_COORDS,
}: PowerlineNetworkProps) {
  const poles = useMemo(() => {
    return coords.map(([x, z], idx) => {
      const next = coords[idx + 1] ?? coords[idx - 1];
      const prev = coords[idx - 1] ?? coords[idx];
      const dx = (next ? next[0] : x) - (prev ? prev[0] : x);
      const dz = (next ? next[1] : z) - (prev ? prev[1] : z);
      const yaw = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(dx, dz) : 0;
      const tilt = Math.sin(x * 0.37 + z * 0.51) * 0.04;
      return {
        x,
        y: getTerrainHeight(x, z),
        z,
        yaw,
        tilt,
      };
    });
  }, [coords]);

  const wireGeometry = useMemo(() => {
    const verts = buildPowerlineCatenarySegments(poles, 2.38, 0.34, 6);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geom.computeBoundingSphere();
    return geom;
  }, [poles]);

  useEffect(() => {
    return () => {
      wireGeometry.dispose();
    };
  }, [wireGeometry]);

  return (
    <group>
      {poles.map((p, idx) => (
        <group
          key={idx}
          position={[p.x, p.y, p.z]}
          rotation={[0, p.yaw, p.tilt]}
        >
          <mesh position={[0, 1.25, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 2.55, 6]} />
            <meshStandardMaterial color="#4b3e31" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.38, 0]} castShadow>
            <boxGeometry args={[0.84, 0.09, 0.09]} />
            <meshStandardMaterial color="#4b3e31" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={wireGeometry}>
        <lineBasicMaterial color="#7f8e98" transparent opacity={0.62} />
      </lineSegments>
    </group>
  );
}
