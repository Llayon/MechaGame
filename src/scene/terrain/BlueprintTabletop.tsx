import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { MAP_DEPTH, MAP_WIDTH, SLAB_BASE_Y } from '../../map/terrainMath';
import { createBlueprintGridTexture } from '../textures';

export function BlueprintTabletop() {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const blueprintGrid = useMemo(() => createBlueprintGridTexture(maxAniso), [maxAniso]);

  useEffect(() => {
    return () => blueprintGrid.dispose();
  }, [blueprintGrid]);

  return (
    <group>
      {/* Tactical Blueprint Tabletop Grid */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, SLAB_BASE_Y - 0.35, 0]}
        receiveShadow
      >
        <planeGeometry args={[MAP_WIDTH + 60, MAP_DEPTH + 60]} />
        <meshStandardMaterial
          map={blueprintGrid}
          roughness={0.95}
          metalness={0.05}
          color="#d8ebff"
        />
      </mesh>

      {/* Dark contact shadow pad under the terrain slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SLAB_BASE_Y - 0.15, 0]}>
        <planeGeometry args={[MAP_WIDTH + 6, MAP_DEPTH + 6]} />
        <meshBasicMaterial color="#03070b" transparent opacity={0.78} depthWrite={false} />
      </mesh>

      {/* Bottom cap of cutaway slab */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, SLAB_BASE_Y, 0]}>
        <planeGeometry args={[MAP_WIDTH, MAP_DEPTH]} />
        <meshStandardMaterial color="#151412" roughness={0.95} metalness={0.05} />
      </mesh>
    </group>
  );
}
