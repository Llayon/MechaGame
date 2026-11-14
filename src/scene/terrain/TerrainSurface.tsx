import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  MAP_DEPTH,
  MAP_WIDTH,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  fbm2D,
  getAnalyticalTerrainNormal,
  getCitadelTerraceNormalizedDistance,
  getQuarryPadMask,
  getRiverInfo,
  getRoadNormalizedDistance,
  getRockRampNormalizedDistance,
  getShoalNormalizedDistance,
  getTerrainHeight,
} from '../../map/terrainMath';
import { createTerrainSurfaceMaterial } from './terrainShader';

export interface TerrainSurfaceProps {
  terrainBump: THREE.Texture;
  showWireframeGrid: boolean;
}

export function TerrainSurface({
  terrainBump,
  showWireframeGrid,
}: TerrainSurfaceProps) {
  const terrainGeometry = useMemo(() => {
    const segX = 300;
    const segZ = 248;
    const geo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const normals = new Float32Array(pos.count * 3);
    const zoneMasks = new Float32Array(pos.count * 4);
    const surfaceHints = new Float32Array(pos.count * 4);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      // Analytical normal sampled across radius slightly wider than ~1.34 grid step
      const n = getAnalyticalTerrainNormal(x, z, 1.95, true);
      normals[i * 3] = n.nx;
      normals[i * 3 + 1] = n.ny;
      normals[i * 3 + 2] = n.nz;

      const river = getRiverInfo(x, z);
      const qMask = getQuarryPadMask(x, z);
      const qDist = Math.hypot((x - QUARRY_CENTER_X) / 30, (z - QUARRY_CENTER_Z) / 28);
      const quarryNoise = fbm2D(x * 0.05 + 4.3, z * 0.05 - 2.9, 2);
      const qShape = Math.max(0, 1 - (qDist + (quarryNoise - 0.5) * 0.35));
      const quarryBlend = Math.min(1, Math.max(qMask * 0.92, qShape * 0.68));
      const riverVicinityMask =
        1.0 - Math.max(0, Math.min(1, (river.distToChannel - 22.0) / 14.0));

      zoneMasks[i * 4] = river.islandMask;
      zoneMasks[i * 4 + 1] = quarryBlend;
      zoneMasks[i * 4 + 2] = riverVicinityMask;
      zoneMasks[i * 4 + 3] = getRoadNormalizedDistance(x, z);

      surfaceHints[i * 4] = getShoalNormalizedDistance(x, z);
      surfaceHints[i * 4 + 1] = getRockRampNormalizedDistance(x, z);
      surfaceHints[i * 4 + 2] = river.channelMask;
      surfaceHints[i * 4 + 3] = getCitadelTerraceNormalizedDistance(x, z);
    }

    // Adaptive quad triangulation: turn each quad diagonal along the smaller height delta
    const cols = segX + 1;
    const indices = new Uint32Array(segX * segZ * 6);
    let ptr = 0;
    for (let r = 0; r < segZ; r++) {
      for (let c = 0; c < segX; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;

        const yA = pos.getY(a);
        const yB = pos.getY(b);
        const yD = pos.getY(d);
        const yE = pos.getY(e);

        if (Math.abs(yB - yD) <= Math.abs(yA - yE)) {
          indices[ptr++] = a;
          indices[ptr++] = d;
          indices[ptr++] = b;
          indices[ptr++] = d;
          indices[ptr++] = e;
          indices[ptr++] = b;
        } else {
          indices[ptr++] = a;
          indices[ptr++] = d;
          indices[ptr++] = e;
          indices[ptr++] = a;
          indices[ptr++] = e;
          indices[ptr++] = b;
        }
      }
    }

    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aZoneMask', new THREE.BufferAttribute(zoneMasks, 4));
    geo.setAttribute('aSurfaceHint', new THREE.BufferAttribute(surfaceHints, 4));
    return geo;
  }, []);

  const terrainMaterial = useMemo(
    () => createTerrainSurfaceMaterial(terrainBump, 0.28),
    [terrainBump],
  );

  const wireframeGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_DEPTH, 56, 46);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getTerrainHeight(x, z) + 0.35);
    }
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      terrainGeometry.dispose();
      terrainMaterial.dispose();
      wireframeGeometry.dispose();
    };
  }, [terrainGeometry, terrainMaterial, wireframeGeometry]);

  return (
    <group>
      <mesh geometry={terrainGeometry} material={terrainMaterial} castShadow receiveShadow />

      {showWireframeGrid && (
        <mesh geometry={wireframeGeometry}>
          <meshBasicMaterial
            color="#5ea4c7"
            wireframe
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
