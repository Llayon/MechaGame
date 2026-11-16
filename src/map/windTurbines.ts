import * as THREE from 'three';
import {
  MAP_HALF_D,
  MAP_HALF_W,
  getExtendedTerrainHeight,
} from './terrainMath';

export interface WindTurbineSpec {
  id: string;
  x: number;
  z: number;
  groundY: number;
  yawY: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  angularSpeed: number;
  initialPhase: number;
  beaconPhase: number;
}

export const TOWER_HUB_HEIGHT = 25.0;
export const HUB_FORWARD_OFFSET = 2.75;
export const TOWER_BEACON_HEIGHT = 26.85;
export const BEACON_BACK_OFFSET = -1.35;
export const ROTOR_BLADE_RADIUS = 11.5;

export const WIND_TURBINE_COORDS: ReadonlyArray<{
  id: string;
  x: number;
  z: number;
  yawY: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  angularSpeed: number;
  initialPhase: number;
  beaconPhase: number;
}> = [
  // West flank ridge crest visible on left edge of Overview
  {
    id: 'wt-west-flank',
    x: -248,
    z: -48,
    yawY: 0.34,
    tiltX: 0.0,
    tiltZ: 0.015,
    scale: 0.96,
    angularSpeed: 0.31,
    initialPhase: 0.45,
    beaconPhase: 0.2,
  },
  // NW ridge shoulder — weathered stalled Old-World unit leaning gently
  {
    id: 'wt-nw-derelict',
    x: -236,
    z: -158,
    yawY: -0.18,
    tiltX: 0.035,
    tiltZ: -0.055,
    scale: 0.94,
    angularSpeed: 0.0,
    initialPhase: 1.18,
    beaconPhase: 1.9,
  },
  // NNW ridge saddle framed cleanly beneath Overview compass
  {
    id: 'wt-nnw-saddle',
    x: -64,
    z: -206,
    yawY: -0.26,
    tiltX: 0.0,
    tiltZ: 0.0,
    scale: 0.94,
    angularSpeed: 0.37,
    initialPhase: 2.05,
    beaconPhase: 0.85,
  },
  // NNE saddle directly above Citadel skyline in Drive spawn & Overview
  {
    id: 'wt-nne-saddle',
    x: 148,
    z: -186,
    yawY: -0.36,
    tiltX: 0.0,
    tiltZ: 0.01,
    scale: 0.92,
    angularSpeed: 0.32,
    initialPhase: 0.72,
    beaconPhase: 1.55,
  },
  // East-NE Citadel flank — clear of Orbital Spire, rotor fully unclipped in Drive spawn
  {
    id: 'wt-east-citadel',
    x: 218,
    z: -136,
    yawY: -0.48,
    tiltX: 0.0,
    tiltZ: 0.0,
    scale: 0.96,
    angularSpeed: 0.39,
    initialPhase: 1.64,
    beaconPhase: 2.4,
  },
  // East ridge shoulder right along golden valley corridor
  {
    id: 'wt-east-shoulder',
    x: 218,
    z: -102,
    yawY: -0.58,
    tiltX: 0.0,
    tiltZ: 0.0,
    scale: 1.04,
    angularSpeed: 0.28,
    initialPhase: 2.88,
    beaconPhase: 0.5,
  },
  // East quarry flank visible on right skyline of both Overview & Drive spawn
  {
    id: 'wt-east-quarry',
    x: 218,
    z: -32,
    yawY: -0.72,
    tiltX: 0.0,
    tiltZ: -0.014,
    scale: 0.98,
    angularSpeed: 0.35,
    initialPhase: 3.72,
    beaconPhase: 1.25,
  },
];

export function generateWindTurbinesData(): WindTurbineSpec[] {
  return WIND_TURBINE_COORDS.map((cfg) => ({
    ...cfg,
    groundY: getExtendedTerrainHeight(cfg.x, cfg.z),
  }));
}

export function isWindTurbineOutsideArena(x: number, z: number): boolean {
  return Math.abs(x) > MAP_HALF_W || Math.abs(z) > MAP_HALF_D;
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

function addPart(
  targetPositions: number[],
  targetNormals: number[],
  targetColors: number[],
  geom: THREE.BufferGeometry,
  pos: readonly [number, number, number],
  rot: readonly [number, number, number],
  hexColor: string,
): void {
  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  mat.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), quat, new THREE.Vector3(1, 1, 1));
  appendColoredGeometry(targetPositions, targetNormals, targetColors, geom, mat, hexColor);
  geom.dispose();
}

/**
 * Builds the static tower + deeply anchored ridge plinth + nacelle housing
 * shared across all instanced giant Old-World wind turbines (~110 triangles).
 */
export function createWindTurbineTowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  // Deep concrete anchor pedestal (-12..+3.5 so steep ridge crests never float)
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(2.9, 4.1, 15.5, 6),
    [0, -4.25, 0],
    [0, Math.PI / 6, 0],
    '#525860',
  );

  // Rusted steel foundation collar
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(1.9, 2.35, 3.6, 8),
    [0, 5.1, 0],
    [0, 0, 0],
    '#5D463B',
  );

  // Main tapered tubular pylon shaft (y = 6.8 .. TOWER_HUB_HEIGHT)
  const mastHeight = TOWER_HUB_HEIGHT - 6.8;
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(0.95, 1.85, mastHeight, 8),
    [0, 6.8 + mastHeight * 0.5, 0],
    [0, 0, 0],
    '#ACA89E',
  );

  // Upper yaw ring collar
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(1.18, 1.08, 1.5, 8),
    [0, TOWER_HUB_HEIGHT - 1.1, 0],
    [0, 0, 0],
    '#6B5447',
  );

  // Streamlined generator nacelle body (faces +Z)
  addPart(
    positions,
    normals,
    colors,
    new THREE.BoxGeometry(2.2, 2.2, 5.0),
    [0, TOWER_HUB_HEIGHT, 0.2],
    [0, 0, 0],
    '#B5B0A6',
  );

  // Rear cooling radiator louver housing
  addPart(
    positions,
    normals,
    colors,
    new THREE.BoxGeometry(1.85, 1.65, 1.5),
    [0, TOWER_HUB_HEIGHT + 0.12, -2.85],
    [0, 0, 0],
    '#4A4540',
  );

  // Roof anemometer / aviation beacon mast pylon
  addPart(
    positions,
    normals,
    colors,
    new THREE.BoxGeometry(0.4, 1.15, 0.4),
    [0, TOWER_HUB_HEIGHT + 1.35, BEACON_BACK_OFFSET],
    [0, 0, 0],
    '#494D54',
  );

  // Forward rotor shaft collar
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(0.8, 0.96, 1.0, 8),
    [0, TOWER_HUB_HEIGHT, HUB_FORWARD_OFFSET - 0.3],
    [Math.PI / 2, 0, 0],
    '#52423A',
  );

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Builds the 3-blade rotor assembly centered at local (0, 0, 0), spinning around local +Z.
 * Each blade tapers cleanly toward the tip with an aviation-orange warning band for skyline legibility.
 */
export function createWindTurbineRotorGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  // Aerodynamic nosecone spinner pointing forward (+Z)
  addPart(
    positions,
    normals,
    colors,
    new THREE.ConeGeometry(1.12, 2.3, 8),
    [0, 0, 0.95],
    [Math.PI / 2, 0, 0],
    '#9E9B92',
  );

  // Hub flange ring
  addPart(
    positions,
    normals,
    colors,
    new THREE.CylinderGeometry(1.16, 1.16, 0.78, 8),
    [0, 0, -0.08],
    [Math.PI / 2, 0, 0],
    '#5C483E',
  );

  const bladeMainLen = ROTOR_BLADE_RADIUS - 2.6;
  const bladeTipLen = 2.3;
  const pitch = 0.24; // ~13.7 deg pitch so blades catch golden rim & sky light

  for (let b = 0; b < 3; b++) {
    const angle = (b * Math.PI * 2) / 3;
    const armMat = new THREE.Matrix4().makeRotationZ(angle);

    const addBladeSegment = (
      geom: THREE.BufferGeometry,
      localPos: readonly [number, number, number],
      hexColor: string,
    ) => {
      const localMat = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pitch, 0));
      localMat.compose(
        new THREE.Vector3(localPos[0], localPos[1], localPos[2]),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      const worldMat = new THREE.Matrix4().multiplyMatrices(armMat, localMat);
      appendColoredGeometry(positions, normals, colors, geom, worldMat, hexColor);
      geom.dispose();
    };

    // Root blade cuff
    addBladeSegment(
      new THREE.CylinderGeometry(0.38, 0.52, 1.5, 6),
      [0, 1.15, 0.06],
      '#6E6A63',
    );

    // Tapered main airfoil blade (4-sided diamond/airfoil cross-section for low poly + crisp highlight)
    addBladeSegment(
      new THREE.CylinderGeometry(0.26, 0.72, bladeMainLen, 4),
      [0, 1.7 + bladeMainLen * 0.5, 0.11],
      '#CCC6BA',
    );

    // High-contrast aviation-orange / weathered rust tip band
    addBladeSegment(
      new THREE.CylinderGeometry(0.09, 0.26, bladeTipLen, 4),
      [0, 1.7 + bladeMainLen + bladeTipLen * 0.5 - 0.04, 0.14],
      '#C85A34',
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

export function createWindTurbineBeaconGeometry(): THREE.BufferGeometry {
  return new THREE.OctahedronGeometry(0.58, 0);
}
