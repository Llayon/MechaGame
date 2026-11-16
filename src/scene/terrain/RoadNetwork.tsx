import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  ALL_ROADS,
  BRIDGE_SPECS,
  ROAD_HALF_WIDTH,
  WATER_LEVEL,
  getBridgeDeckYAt,
  getRiverInfo,
  getTerrainHeight,
} from '../../map/terrainMath';
import { createRoadPuddleMaterial } from '../../map/puddles';

export interface RoadNetworkProps {
  puddleTimeUniform: { value: number };
}

export function RoadNetwork({ puddleTimeUniform }: RoadNetworkProps) {
  const roadGeometry = useMemo(() => {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vCount = 0;

    for (const road of ALL_ROADS) {
      const curve = new THREE.CatmullRomCurve3(
        road.map(([x, z]) => new THREE.Vector3(x, getTerrainHeight(x, z), z)),
        false,
        'catmullrom',
        0.35,
      );
      const samples = 180;
      const halfWidth = ROAD_HALF_WIDTH;

      let prevLeft: THREE.Vector3 | null = null;
      let prevRight: THREE.Vector3 | null = null;
      let prevCenter: THREE.Vector3 | null = null;
      let accDist = 0;
      let prevV = 0;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        const river = getRiverInfo(pt.x, pt.z);

        // Check if point lies strictly inside any road bridge span (between abutments)
        let onBridgeSpan = false;
        for (let bIdx = 0; bIdx < 3; bIdx++) {
          const b = BRIDGE_SPECS[bIdx];
          const dx = b.end[0] - b.start[0];
          const dz = b.end[1] - b.start[1];
          const lenSq = dx * dx + dz * dz;
          const projT = ((pt.x - b.start[0]) * dx + (pt.z - b.start[1]) * dz) / lenSq;
          if (projT > 0.02 && projT < 0.98 && getBridgeDeckYAt(b, pt.x, pt.z) !== null) {
            onBridgeSpan = true;
            break;
          }
        }

        const hCenter = getTerrainHeight(pt.x, pt.z);
        if (prevCenter) {
          accDist += Math.hypot(pt.x - prevCenter.x, pt.z - prevCenter.z);
        }
        prevCenter = pt;
        const currV = accDist * 0.16;

        if (onBridgeSpan || river.channelMask > 0.35 || hCenter < WATER_LEVEL + 0.45) {
          prevLeft = null;
          prevRight = null;
          prevV = currV;
          continue;
        }

        const perpX = -tangent.z;
        const perpZ = tangent.x;
        const len = Math.hypot(perpX, perpZ) || 1;
        const nx = (perpX / len) * halfWidth;
        const nz = (perpZ / len) * halfWidth;

        const lx = pt.x + nx;
        const lz = pt.z + nz;
        const rx = pt.x - nx;
        const rz = pt.z - nz;

        const ly = getTerrainHeight(lx, lz) + 0.16;
        const ry = getTerrainHeight(rx, rz) + 0.16;

        const leftV = new THREE.Vector3(lx, ly, lz);
        const rightV = new THREE.Vector3(rx, ry, rz);

        if (prevLeft && prevRight) {
          positions.push(
            prevLeft.x, prevLeft.y, prevLeft.z,
            prevRight.x, prevRight.y, prevRight.z,
            leftV.x, leftV.y, leftV.z,
            rightV.x, rightV.y, rightV.z,
          );
          uvs.push(
            0, prevV,
            1, prevV,
            0, currV,
            1, currV,
          );
          for (let k = 0; k < 4; k++) normals.push(0, 1, 0);
          indices.push(vCount, vCount + 1, vCount + 2);
          indices.push(vCount + 1, vCount + 3, vCount + 2);
          vCount += 4;
        }

        prevLeft = leftV;
        prevRight = rightV;
        prevV = currV;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const roadMaterial = useMemo(
    () => createRoadPuddleMaterial(puddleTimeUniform),
    [puddleTimeUniform],
  );

  useEffect(() => {
    return () => {
      roadGeometry.dispose();
      roadMaterial.dispose();
    };
  }, [roadGeometry, roadMaterial]);

  return (
    <mesh geometry={roadGeometry} material={roadMaterial} receiveShadow />
  );
}
