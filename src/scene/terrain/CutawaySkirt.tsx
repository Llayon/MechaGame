import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  MAP_DEPTH,
  MAP_HALF_D,
  MAP_HALF_W,
  MAP_WIDTH,
  SLAB_BASE_Y,
  WATER_LEVEL,
  getTerrainHeight,
  lerp,
} from '../../map/terrainMath';

export interface CutawaySkirtProps {
  terrainBump: THREE.Texture;
}

export function CutawaySkirt({ terrainBump }: CutawaySkirtProps) {
  const skirtGeometry = useMemo(() => {
    const segX = 220;
    const segZ = 180;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const topCol = new THREE.Color('#424A54');
    const midCol = new THREE.Color('#2A313A');
    const botCol = new THREE.Color('#161A20');
    const waterCutCol = new THREE.Color('#1E3A4C');
    const tmp = new THREE.Color();

    let vOffset = 0;

    const addEdgeWall = (pts: Array<[number, number]>) => {
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const yTop = getTerrainHeight(x, z);
        const yMid = lerp(yTop, SLAB_BASE_Y, 0.45);
        const isUnderwater = yTop < WATER_LEVEL;

        positions.push(x, yTop, z);
        tmp.copy(isUnderwater ? waterCutCol : topCol);
        colors.push(tmp.r, tmp.g, tmp.b);

        positions.push(x, yMid, z);
        tmp.copy(isUnderwater ? waterCutCol : midCol);
        colors.push(tmp.r, tmp.g, tmp.b);

        positions.push(x, SLAB_BASE_Y, z);
        colors.push(botCol.r, botCol.g, botCol.b);
      }

      for (let i = 0; i < pts.length - 1; i++) {
        const a = vOffset + i * 3;
        const b = vOffset + (i + 1) * 3;
        indices.push(a, a + 1, b);
        indices.push(b, a + 1, b + 1);
        indices.push(a + 1, a + 2, b + 1);
        indices.push(b + 1, a + 2, b + 2);
      }
      vOffset += pts.length * 3;
    };

    const frontPts: Array<[number, number]> = [];
    for (let i = 0; i <= segX; i++) {
      frontPts.push([-MAP_HALF_W + (i / segX) * MAP_WIDTH, MAP_HALF_D]);
    }
    addEdgeWall(frontPts);

    const rightPts: Array<[number, number]> = [];
    for (let i = 0; i <= segZ; i++) {
      rightPts.push([MAP_HALF_W, MAP_HALF_D - (i / segZ) * MAP_DEPTH]);
    }
    addEdgeWall(rightPts);

    const backPts: Array<[number, number]> = [];
    for (let i = 0; i <= segX; i++) {
      backPts.push([MAP_HALF_W - (i / segX) * MAP_WIDTH, -MAP_HALF_D]);
    }
    addEdgeWall(backPts);

    const leftPts: Array<[number, number]> = [];
    for (let i = 0; i <= segZ; i++) {
      leftPts.push([-MAP_HALF_W, -MAP_HALF_D + (i / segZ) * MAP_DEPTH]);
    }
    addEdgeWall(leftPts);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(() => {
    return () => skirtGeometry.dispose();
  }, [skirtGeometry]);

  return (
    <mesh geometry={skirtGeometry} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.06}
        bumpMap={terrainBump}
        bumpScale={0.35}
      />
    </mesh>
  );
}
