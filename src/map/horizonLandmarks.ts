import * as THREE from 'three';
import {
  MAP_HALF_D,
  MAP_HALF_W,
  getExtendedTerrainHeight,
} from './terrainMath';

export interface HorizonLandmarkSpec {
  id: 'broken-orbital-spire' | 'fallen-colossus-frame' | 'collapsed-canyon-viaduct';
  x: number;
  z: number;
  rotY: number;
  groundY: number;
  peakHeight: number;
}

export const HORIZON_LANDMARK_COORDS: ReadonlyArray<{
  id: HorizonLandmarkSpec['id'];
  x: number;
  z: number;
  rotY: number;
  peakHeight: number;
}> = [
  // NNE skyline behind Citadel: snapped orbital/relay tower rising high to the right of Overview compass & above Citadel in Drive view
  { id: 'broken-orbital-spire', x: 238, z: -186, rotY: -0.62, peakHeight: 92 },
  // North ridge saddle: slumped Old-World colossus / giant excavator frame left of compass
  { id: 'fallen-colossus-frame', x: -16, z: -234, rotY: 0.44, peakHeight: 48 },
  // NW extended river canyon: sheared twin viaduct piers straddling the outer gorge clearly above cliff rim
  { id: 'collapsed-canyon-viaduct', x: -188, z: -214, rotY: 0.84, peakHeight: 48 },
];

export function generateHorizonLandmarksData(): HorizonLandmarkSpec[] {
  return HORIZON_LANDMARK_COORDS.map((item) => ({
    ...item,
    groundY: getExtendedTerrainHeight(item.x, item.z),
  }));
}

interface BoxPartSpec {
  size: readonly [number, number, number];
  pos: readonly [number, number, number];
  rot?: readonly [number, number, number];
  color: string;
}

interface TaperedPartSpec {
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  pos: readonly [number, number, number];
  rot?: readonly [number, number, number];
  color: string;
}

function appendColoredGeometry(
  targetPositions: number[],
  targetNormals: number[],
  targetColors: number[],
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  hexColor: string,
): void {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();
  nonIndexed.applyMatrix4(matrix);
  nonIndexed.computeVertexNormals();

  const pos = nonIndexed.getAttribute('position');
  const norm = nonIndexed.getAttribute('normal');
  const col = new THREE.Color(hexColor);

  for (let i = 0; i < pos.count; i++) {
    targetPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    targetNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    targetColors.push(col.r, col.g, col.b);
  }
  nonIndexed.dispose();
}

function addPartList(
  targetPositions: number[],
  targetNormals: number[],
  targetColors: number[],
  parentMatrix: THREE.Matrix4,
  boxes: readonly BoxPartSpec[],
  cylinders: readonly TaperedPartSpec[] = [],
): void {
  const localMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const vec = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  for (const b of boxes) {
    const geom = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
    euler.set(b.rot?.[0] ?? 0, b.rot?.[1] ?? 0, b.rot?.[2] ?? 0);
    quat.setFromEuler(euler);
    vec.set(b.pos[0], b.pos[1], b.pos[2]);
    localMat.compose(vec, quat, one);
    worldMat.multiplyMatrices(parentMatrix, localMat);
    appendColoredGeometry(
      targetPositions,
      targetNormals,
      targetColors,
      geom,
      worldMat,
      b.color,
    );
    geom.dispose();
  }

  for (const c of cylinders) {
    const geom = new THREE.CylinderGeometry(
      c.radiusTop,
      c.radiusBottom,
      c.height,
      c.radialSegments,
    );
    euler.set(c.rot?.[0] ?? 0, c.rot?.[1] ?? 0, c.rot?.[2] ?? 0);
    quat.setFromEuler(euler);
    vec.set(c.pos[0], c.pos[1], c.pos[2]);
    localMat.compose(vec, quat, one);
    worldMat.multiplyMatrices(parentMatrix, localMat);
    appendColoredGeometry(
      targetPositions,
      targetNormals,
      targetColors,
      geom,
      worldMat,
      c.color,
    );
    geom.dispose();
  }
}

/**
 * Builds a single merged, ultra-low-poly BufferGeometry (~260 triangles total)
 * containing all 3 distant Old-World horizon ruins grounded into the outer mountain ring.
 */
export function createHorizonLandmarksGeometry(
  specs: readonly HorizonLandmarkSpec[] = generateHorizonLandmarksData(),
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const rootMat = new THREE.Matrix4();
  const rootPos = new THREE.Vector3();
  const rootQuat = new THREE.Quaternion();
  const rootEuler = new THREE.Euler();
  const unitScale = new THREE.Vector3(1, 1, 1);

  for (const spec of specs) {
    // Embed foundation 5u below sampled mountain ridge so sloped edges never float
    rootPos.set(spec.x, spec.groundY - 5.0, spec.z);
    rootEuler.set(0, spec.rotY, 0);
    rootQuat.setFromEuler(rootEuler);
    rootMat.compose(rootPos, rootQuat, unitScale);

    if (spec.id === 'broken-orbital-spire') {
      addPartList(
        positions,
        normals,
        colors,
        rootMat,
        [
          // Heavy concrete anchor plinth + side buttresses
          { size: [20, 14, 18], pos: [0, 5, 0], color: '#535A62' },
          { size: [26, 9, 10], pos: [0, 2.5, 0], rot: [0, 0.35, 0], color: '#474E56' },
          // Cross-gantry collar at mid-mast
          { size: [18, 2.6, 5.2], pos: [-2.5, 48, 0.5], rot: [0, 0.12, -0.09], color: '#4B3A32' },
          // Snapped upper cantilevered relay arm leaning into sky
          { size: [4.2, 34, 4.2], pos: [-10.5, 70, 2.2], rot: [0.14, 0.1, 0.44], color: '#44352E' },
          // Sheared dish / stabilizer fin at break point
          { size: [13, 2.2, 4.4], pos: [-16, 81, 3.8], rot: [0.22, -0.3, 0.62], color: '#5A4338' },
        ],
        [
          // Tapered lower mast shaft (4-sided lattice profile)
          {
            radiusTop: 3.6,
            radiusBottom: 6.4,
            height: 52,
            radialSegments: 4,
            pos: [-1.8, 30, 0],
            rot: [0.04, 0.785, -0.08],
            color: '#3C3330',
          },
          // Snapped secondary antenna needle
          {
            radiusTop: 0.7,
            radiusBottom: 1.9,
            height: 22,
            radialSegments: 4,
            pos: [-3.8, 63, -2.2],
            rot: [-0.22, 0.4, -0.18],
            color: '#513D33',
          },
        ],
      );
    } else if (spec.id === 'fallen-colossus-frame') {
      addPartList(
        positions,
        normals,
        colors,
        rootMat,
        [
          // Massive armored ribcage slumped into the mountain saddle
          { size: [26, 13, 16], pos: [0, 9, 0], rot: [0.18, 0.1, -0.28], color: '#483932' },
          // Rear reactor housing / counterweight
          { size: [14, 11, 13], pos: [-14, 11.5, -2], rot: [0.1, 0.15, -0.2], color: '#525860' },
          // Splayed stabilizer leg strut anchored into ridge
          { size: [5.5, 28, 5.5], pos: [14, 4, 8], rot: [0.35, 0.2, -0.68], color: '#39322F' },
          { size: [5.2, 24, 5.2], pos: [-16, 2, 9], rot: [0.42, -0.25, 0.55], color: '#39322F' },
          // Giant broken crane/weapon boom jutting skyward
          { size: [4.2, 42, 4.6], pos: [12, 29, -3], rot: [-0.14, 0.1, -0.62], color: '#594236' },
          // Detached claw / head girder at upper boom tip
          { size: [11, 4.0, 5.0], pos: [25, 45, -5], rot: [0.2, 0.35, -0.35], color: '#433833' },
        ],
        [
          // Ruined turbine ring hub
          {
            radiusTop: 6.2,
            radiusBottom: 7.4,
            height: 7.5,
            radialSegments: 6,
            pos: [-2, 16, 2],
            rot: [0.22, 0, -0.3],
            color: '#5D463B',
          },
        ],
      );
    } else if (spec.id === 'collapsed-canyon-viaduct') {
      addPartList(positions, normals, colors, rootMat, [
        // West canyon pier + cantilevered broken roadway deck
        { size: [11, 34, 12], pos: [-26, 16, 0], rot: [0.02, 0, -0.05], color: '#565D66' },
        { size: [26, 4.2, 13], pos: [-18, 32, 0], rot: [0.03, 0, -0.14], color: '#4D545C' },
        // Snapped steel girder hanging into chasm from West deck
        { size: [16, 2.2, 7.5], pos: [-4, 24.5, 0], rot: [0.08, 0.05, -0.78], color: '#4F3C33' },
        // East canyon pier + broken roadway deck
        { size: [11, 36, 12], pos: [26, 18, 0], rot: [-0.03, 0, 0.06], color: '#565D66' },
        { size: [25, 4.2, 13], pos: [18, 34.5, 0], rot: [-0.02, 0, 0.16], color: '#4D545C' },
        // Second sheared steel truss dipping into gorge from East deck
        { size: [14, 2.0, 7.0], pos: [6, 27.5, 0.5], rot: [-0.06, -0.08, 0.85], color: '#4B3A32' },
      ]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

export function isOutsidePlayableBounds(x: number, z: number): boolean {
  return Math.abs(x) > MAP_HALF_W || Math.abs(z) > MAP_HALF_D;
}

/**
 * Generates vertex pairs for dual sagging catenary powerline wires between adjacent poles.
 * Used with THREE.LineSegments so an entire pole corridor renders its wires in 1 Draw Call.
 */
export function buildPowerlineCatenarySegments(
  poles: ReadonlyArray<{ x: number; y: number; z: number; tiltZ?: number; rotY?: number }>,
  poleArmHeight = 2.38,
  armHalfSpan = 0.34,
  subdivisions = 6,
): Float32Array {
  const segmentsPerWire = subdivisions;
  const wiresPerSpan = 2;
  const spanCount = Math.max(0, poles.length - 1);
  // 2 endpoints * 3 floats per segment
  const verts = new Float32Array(spanCount * wiresPerSpan * segmentsPerWire * 6);
  let ptr = 0;

  for (let i = 0; i < spanCount; i++) {
    const a = poles[i];
    const b = poles[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const horizLen = Math.hypot(dx, dz);
    if (horizLen < 1e-4) continue;

    // Perpendicular lateral vector for the two side insulators on crossbar
    const nx = -dz / horizLen;
    const nz = dx / horizLen;
    // Parabolic gravity sag proportional to span distance
    const sag = Math.min(1.45, Math.max(0.28, horizLen * 0.038));

    for (const side of [-1, 1]) {
      const ax = a.x + nx * side * armHalfSpan;
      const ay = a.y + poleArmHeight;
      const az = a.z + nz * side * armHalfSpan;
      const bx = b.x + nx * side * armHalfSpan;
      const by = b.y + poleArmHeight;
      const bz = b.z + nz * side * armHalfSpan;

      for (let s = 0; s < segmentsPerWire; s++) {
        const t0 = s / segmentsPerWire;
        const t1 = (s + 1) / segmentsPerWire;
        const sag0 = 4 * t0 * (1 - t0) * sag;
        const sag1 = 4 * t1 * (1 - t1) * sag;

        verts[ptr++] = ax + (bx - ax) * t0;
        verts[ptr++] = ay + (by - ay) * t0 - sag0;
        verts[ptr++] = az + (bz - az) * t0;

        verts[ptr++] = ax + (bx - ax) * t1;
        verts[ptr++] = ay + (by - ay) * t1 - sag1;
        verts[ptr++] = az + (bz - az) * t1;
      }
    }
  }

  return verts;
}
