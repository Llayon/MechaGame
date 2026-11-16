import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createHorizonLandmarksGeometry } from '../../map/horizonLandmarks';

/**
 * Distant "Old World" horizon silhouettes (broken orbital spire, slumped colossus frame,
 * and collapsed canyon viaduct) placed outside the playable perimeter in 1 merged Draw Call.
 */
export function HorizonLandmarks() {
  const geometry = useMemo(() => createHorizonLandmarksGeometry(), []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.22,
        flatShading: true,
        fog: true,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
