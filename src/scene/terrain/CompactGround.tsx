import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import paths from 'virtual:world-asset-paths';
import { WATER_LEVEL } from '../../map/terrainMath';
import { WATER_SPAN_W, WATER_SPAN_D } from '../../map/waterDepth';
import { getGroundMap } from './OverviewGround';

let parts: THREE.BufferGeometry[] | undefined;

export async function prepareCompactGround(signal: AbortSignal) {
  if (parts) return;
  const response = await fetch(import.meta.env.BASE_URL + paths.overview, {signal});
  if (!response.ok) throw Error('Overview mesh unavailable');
  const bytes = await response.arrayBuffer();
  const compressed = new Uint8Array(bytes)[0] === 0x1f;
  const data = compressed ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes;
  if (new TextDecoder().decode(data.slice(0, 4)) !== 'OVR2') throw Error('Invalid overview mesh');
  const reader = new DataView(data);
  let offset = 4;
  function readPart() {
    const n = reader.getUint32(offset, true), count = reader.getUint32(offset + 4, true);
    offset += 8;
    const wide = n > 65535;
    if (!n || count % 3 || offset + n*6 + count*(wide ? 4 : 2) > data.byteLength) throw Error('Invalid overview geometry');
    const positions = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let axis = 0; axis < 3; axis++) {
      let value = 0;
      for (let i = 0; i < n; i++) {
        value = (value + reader.getUint16(offset, true)) << 16 >> 16;
        offset += 2;
        positions[3*i+axis] = value / 32;
      }
    }
    for (let i = 0; i < n; i++) {
      const x = positions[3*i], y = positions[3*i+1], z = positions[3*i+2];
      positions[3*i+1] = Math.abs(x) <= WATER_SPAN_W/2 && Math.abs(z) <= WATER_SPAN_D/2 ? Math.max(WATER_LEVEL, y) : y;
      positions[3*i+2] = z;
      uv[2*i] = .5+x/1488;
      uv[2*i+1] = .5-z/1488;
    }
    const index = wide ? new Uint32Array(count) : new Uint16Array(count);
    let previousIndex = 0;
    for (let i = 0; i < count; i++) {
      const delta = wide ? reader.getUint32(offset,true) : reader.getUint16(offset,true);
      previousIndex = wide ? (previousIndex + delta) >>> 0 : (previousIndex + delta) & 65535;
      if (previousIndex >= n) throw Error('Invalid overview index');
      index[i] = previousIndex;
      offset += wide ? 4 : 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv,2));
    geometry.setIndex(new THREE.BufferAttribute(index,1));
    return geometry;
  }
  const loaded = [readPart(), readPart()];
  if (offset !== data.byteLength) throw Error('Invalid overview length');
  if (!signal.aborted) parts = loaded;
}

export function compactReady() { return Boolean(parts && getGroundMap()); }

export function CompactGround({near, far, water}:{near:boolean; far:boolean; water:boolean}) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    map: getGroundMap(), toneMapped: false, polygonOffset: water,
    polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  }), [water]);
  useEffect(() => () => material.dispose(), [material]);
  return <group dispose={null}>{parts?.map((geometry,i) => (i === 0 ? near : far) &&
    <mesh key={i} geometry={geometry} material={material} />)}</group>;
}