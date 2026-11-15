import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateRockOutcropsData } from '../../map/worldStructures';

const _dummy = new THREE.Object3D();

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function RockOutcrops() {
  const rockRef = useRef<THREE.InstancedMesh>(null);

  const rocks = useMemo(() => generateRockOutcropsData(), []);

  useEffect(() => {
    const rMesh = rockRef.current;
    if (!rMesh) return;
    const c1 = new THREE.Color('#464F59');
    const c2 = new THREE.Color('#5C6672');
    const tmp = new THREE.Color();

    rocks.forEach((r, i) => {
      _dummy.position.set(r.x, r.y + r.sy * 0.28, r.z);
      _dummy.rotation.set(0.2 * i, r.rotY, 0.1 * i);
      _dummy.scale.set(r.sx, r.sy, r.sz);
      _dummy.updateMatrix();
      rMesh.setMatrixAt(i, _dummy.matrix);
      tmp.copy(c1).lerp(c2, seededRand(i + 500));
      rMesh.setColorAt(i, tmp);
    });
    rMesh.instanceMatrix.needsUpdate = true;
    if (rMesh.instanceColor) rMesh.instanceColor.needsUpdate = true;
    rMesh.computeBoundingSphere();
  }, [rocks]);

  return (
    <instancedMesh
      ref={rockRef}
      args={[undefined, undefined, rocks.length]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.86} metalness={0.04} />
    </instancedMesh>
  );
}
