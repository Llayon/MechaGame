import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';
import { DEFAULT_POWERLINE_POLE_COORDS } from '../../map/worldStructures';

export interface PowerlineNetworkProps {
  coords?: ReadonlyArray<readonly [number, number]>;
}

export function PowerlineNetwork({
  coords = DEFAULT_POWERLINE_POLE_COORDS,
}: PowerlineNetworkProps) {
  const poles = useMemo(
    () => coords.map(([x, z]) => ({ x, y: getTerrainHeight(x, z), z })),
    [coords],
  );

  return (
    <group>
      {poles.map((p, idx) => {
        const next = poles[idx + 1];
        let wireSpan = 0;
        let wireAngle = 0;
        let wireMidX = 0;
        let wireMidY = 0;
        let wireMidZ = 0;
        if (next) {
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const dz = next.z - p.z;
          wireSpan = Math.hypot(dx, dy, dz);
          wireAngle = Math.atan2(dx, dz);
          wireMidX = dx * 0.5;
          wireMidY = dy * 0.5 + 2.3;
          wireMidZ = dz * 0.5;
        }
        return (
          <group key={idx} position={[p.x, p.y, p.z]}>
            <mesh position={[0, 1.25, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.09, 2.5, 6]} />
              <meshStandardMaterial color="#4b3e31" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.38, 0]} castShadow>
              <boxGeometry args={[0.78, 0.08, 0.08]} />
              <meshStandardMaterial color="#4b3e31" roughness={0.9} />
            </mesh>
            {next && (
              <mesh
                position={[wireMidX, wireMidY, wireMidZ]}
                rotation={[Math.PI / 2, 0, -wireAngle]}
              >
                <cylinderGeometry args={[0.02, 0.02, wireSpan, 4]} />
                <meshBasicMaterial color="#96a3ab" transparent opacity={0.55} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
