import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  MAP_HALF_D,
  MAP_HALF_W,
  getAnalyticalTerrainNormal,
  getExtendedRiverDistance,
  getExtendedTerrainHeight,
  lerp,
  smoothstep,
} from '../../map/terrainMath';
import { createTerrainSurfaceMaterial } from './terrainShader';

export interface OuterMountainRingProps {
  terrainBump: THREE.Texture;
  puddleTimeUniform: { value: number };
}

const OUTER_EXTENT = 540;
const RADIAL_STEPS = 36;
const SEG_X = 300;
const SEG_Z = 248;

/**
 * Seamless outer slate mountain amphitheater stitched vertex-for-vertex to the
 * 400x332 playable perimeter so the terrain transitions naturally into distant
 * mountain peaks and NW/SE river gorges without sharp rectangular slab edges.
 */
export function OuterMountainRing({
  terrainBump,
  puddleTimeUniform,
}: OuterMountainRingProps) {
  const ringGeometry = useMemo(() => {
    const positions: number[] = [];
    const normals: number[] = [];
    const zoneMasks: number[] = [];
    const surfaceHints: number[] = [];
    const indices: number[] = [];

    let vOffset = 0;

    const addStrip = (
      perimeterCount: number,
      samplePoint: (u: number, rNorm: number) => [number, number],
    ) => {
      const cols = perimeterCount + 1;
      const rows = RADIAL_STEPS + 1;

      for (let r = 0; r < rows; r++) {
        const rLinear = r / RADIAL_STEPS;
        // Cluster radial rings denser near the arena rim and mountain massif, stretch gently toward horizon mist
        const rNorm = rLinear * rLinear * 0.58 + rLinear * 0.42;
        // Match inner TerrainSurface eps (1.95) at the rim seam, then scale to match local radial quad spacing
        const radialStep = (OUTER_EXTENT / RADIAL_STEPS) * (1.16 * rLinear + 0.42);
        const normalEps = lerp(1.95, Math.max(2.2, radialStep * 0.78), smoothstep(0, 0.12, rLinear));

        for (let c = 0; c < cols; c++) {
          const u = c / perimeterCount;
          const [x, z] = samplePoint(u, rNorm);
          const y = getExtendedTerrainHeight(x, z);
          positions.push(x, y, z);

          const n = getAnalyticalTerrainNormal(x, z, normalEps, true);
          normals.push(n.nx, n.ny, n.nz);

          const dRiver = getExtendedRiverDistance(x, z);
          const riverVicinity = 1.0 - smoothstep(16.0, 34.0, dRiver);
          const channelApprox = 1.0 - smoothstep(11.0, 22.0, dRiver);

          zoneMasks.push(0.0, 0.0, riverVicinity, 20.0);
          surfaceHints.push(20.0, 20.0, channelApprox, 20.0);
        }
      }

      for (let r = 0; r < RADIAL_STEPS; r++) {
        for (let c = 0; c < perimeterCount; c++) {
          const a = vOffset + r * cols + c;
          const b = a + 1;
          const d = a + cols;
          const e = d + 1;

          const yA = positions[a * 3 + 1];
          const yB = positions[b * 3 + 1];
          const yD = positions[d * 3 + 1];
          const yE = positions[e * 3 + 1];

          // Adaptive quad triangulation: align diagonal with the smaller height difference
          if (Math.abs(yB - yD) <= Math.abs(yA - yE)) {
            indices.push(a, b, d);
            indices.push(b, e, d);
          } else {
            indices.push(a, b, e);
            indices.push(a, e, d);
          }
        }
      }
      vOffset += rows * cols;
    };

    // North outer mountain rim (u: -X -> +X, outward: -Z)
    addStrip(SEG_X, (u, rNorm) => {
      const d = rNorm * OUTER_EXTENT;
      return [lerp(-MAP_HALF_W - d, MAP_HALF_W + d, u), -MAP_HALF_D - d];
    });

    // East outer rim (u: -Z -> +Z, outward: +X)
    addStrip(SEG_Z, (u, rNorm) => {
      const d = rNorm * OUTER_EXTENT;
      return [MAP_HALF_W + d, lerp(-MAP_HALF_D - d, MAP_HALF_D + d, u)];
    });

    // South outer rim (u: +X -> -X, outward: +Z)
    addStrip(SEG_X, (u, rNorm) => {
      const d = rNorm * OUTER_EXTENT;
      return [lerp(MAP_HALF_W + d, -MAP_HALF_W - d, u), MAP_HALF_D + d];
    });

    // West outer rim (u: +Z -> -Z, outward: -X)
    addStrip(SEG_Z, (u, rNorm) => {
      const d = rNorm * OUTER_EXTENT;
      return [-MAP_HALF_W - d, lerp(MAP_HALF_D + d, -MAP_HALF_D - d, u)];
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('aZoneMask', new THREE.Float32BufferAttribute(zoneMasks, 4));
    geo.setAttribute('aSurfaceHint', new THREE.Float32BufferAttribute(surfaceHints, 4));
    geo.setIndex(indices);
    return geo;
  }, []);

  const mountainMaterial = useMemo(
    () => createTerrainSurfaceMaterial(terrainBump, 0.55, puddleTimeUniform),
    [terrainBump, puddleTimeUniform],
  );

  useEffect(() => {
    return () => {
      ringGeometry.dispose();
      mountainMaterial.dispose();
    };
  }, [ringGeometry, mountainMaterial]);

  return (
    <mesh geometry={ringGeometry} material={mountainMaterial} castShadow receiveShadow />
  );
}
