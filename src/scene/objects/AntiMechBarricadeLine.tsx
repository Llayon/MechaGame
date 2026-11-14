import { useMemo } from 'react';
import { getTerrainHeight } from '../../map/terrainMath';

export interface BarricadeNode {
  x: number;
  z: number;
  rotY: number;
  kind: 'dragon-tooth' | 'hedgehog' | 'jersey-block';
  scale?: number;
}

export interface AntiMechBarricadeLineProps {
  nodes: ReadonlyArray<BarricadeNode>;
}

/**
 * Line of concrete anti-mech dragon's teeth, steel-beam Czech hedgehogs, and
 * heavy armored jersey blast blocks (~4-5.5 m tall) grounded to terrain height.
 */
export function AntiMechBarricadeLine({ nodes }: AntiMechBarricadeLineProps) {
  const placed = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        y: getTerrainHeight(n.x, n.z) - 0.14,
        scale: n.scale ?? 1,
      })),
    [nodes],
  );

  return (
    <group>
      {placed.map((item, idx) => (
        <group
          key={`anti-mech-${idx}`}
          position={[item.x, item.y, item.z]}
          rotation={[0, item.rotY, 0]}
          scale={item.scale}
        >
          {item.kind === 'dragon-tooth' && (
            <>
              {/* Heavy recessed concrete footing */}
              <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.1, 0.52, 1.9]} />
                <meshStandardMaterial color="#868D93" roughness={0.84} metalness={0.05} />
              </mesh>
              {/* Tapered tetrahedral-style armored concrete pyramid block */}
              <mesh position={[0, 0.92, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.52, 1.12, 1.15, 4]} />
                <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
              </mesh>
              {/* Steel impact cap & terracotta ochre warning collar */}
              <mesh position={[0, 1.38, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <cylinderGeometry args={[0.38, 0.56, 0.24, 4]} />
                <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.48} />
              </mesh>
              <mesh position={[0, 0.72, 0.78]} rotation={[-0.36, 0, 0]} castShadow>
                <boxGeometry args={[1.15, 0.18, 0.1]} />
                <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.2} />
              </mesh>
            </>
          )}

          {item.kind === 'hedgehog' && (
            <>
              {/* Anchored concrete pad */}
              <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.35, 1.5, 0.36, 6]} />
                <meshStandardMaterial color="#8E959B" roughness={0.82} metalness={0.06} />
              </mesh>
              {/* 3 crossed heavy steel I-beam caltrops */}
              {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((yaw, bIdx) => (
                <group key={bIdx} rotation={[0, yaw, 0]}>
                  <mesh position={[0, 0.92, 0]} rotation={[0.72, 0, 0.42]} castShadow receiveShadow>
                    <boxGeometry args={[0.26, 2.35, 0.26]} />
                    <meshStandardMaterial color="#49525C" roughness={0.54} metalness={0.62} />
                  </mesh>
                  {/* Welded gusset plate */}
                  <mesh position={[0, 0.95, 0]} castShadow>
                    <boxGeometry args={[0.42, 0.42, 0.42]} />
                    <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.32} />
                  </mesh>
                </group>
              ))}
            </>
          )}

          {item.kind === 'jersey-block' && (
            <>
              {/* Wide concrete base */}
              <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.6, 0.62, 1.55]} />
                <meshStandardMaterial color="#8E959B" roughness={0.82} metalness={0.05} />
              </mesh>
              {/* Sloped concrete shield body */}
              <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.35, 0.88, 0.96]} />
                <meshStandardMaterial color="#9BA1A6" roughness={0.8} metalness={0.08} />
              </mesh>
              {/* Steel corner armor ribs & warning band */}
              {[-1.4, 0, 1.4].map((rx, rIdx) => (
                <mesh key={rIdx} position={[rx, 0.78, 0]} castShadow>
                  <boxGeometry args={[0.22, 1.15, 1.18]} />
                  <meshStandardMaterial color="#525B66" roughness={0.58} metalness={0.5} />
                </mesh>
              ))}
              <mesh position={[0, 1.18, 0.5]} castShadow>
                <boxGeometry args={[2.5, 0.16, 0.08]} />
                <meshStandardMaterial color="#8F5642" roughness={0.65} metalness={0.2} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}
