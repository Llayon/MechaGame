import * as THREE from 'three';
import {
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
} from './terrainMath';

export interface SkyBirdFlockSpec {
  id: string;
  anchor: readonly [number, number, number];
  radiusBase: number;
  radiusSpread: number;
  altitudeSpread: number;
  minAltitude: number;
  count: number;
  speedRange: readonly [number, number];
  clockwise: boolean;
}

export interface SkyBirdInstance {
  flockId: string;
  anchor: readonly [number, number, number];
  radius: number;
  angularSpeed: number;
  phase: number;
  bobAmp: number;
  flapSpeed: number;
  flapPhase: number;
  scale: number;
  tint: readonly [number, number, number];
}

// High-altitude circling flocks placed above Citadel/mountain skyline
// (strictly >= 38 u / ~142 m elevation so silhouettes soar cleanly across sky gaps & peak crests).
export const SKY_BIRD_FLOCKS: readonly SkyBirdFlockSpec[] = [
  {
    id: 'citadel-spire',
    anchor: [CITADEL_CENTER_X - 8, 58.0, CITADEL_CENTER_Z + 4],
    radiusBase: 40,
    radiusSpread: 12,
    altitudeSpread: 6.5,
    minAltitude: 51.0,
    count: 10,
    speedRange: [0.15, 0.23],
    clockwise: true,
  },
  {
    id: 'quarry-rim',
    anchor: [QUARRY_CENTER_X + 2, 46.0, QUARRY_CENTER_Z - 12],
    radiusBase: 32,
    radiusSpread: 9,
    altitudeSpread: 5.0,
    minAltitude: 40.5,
    count: 9,
    speedRange: [0.17, 0.25],
    clockwise: false,
  },
  {
    id: 'northern-gorge',
    anchor: [-44, 45.0, -64],
    radiusBase: 30,
    radiusSpread: 9,
    altitudeSpread: 4.5,
    minAltitude: 39.5,
    count: 8,
    speedRange: [0.18, 0.26],
    clockwise: true,
  },
  {
    id: 'nw-ridge-horizon',
    anchor: [-122, 52.0, -92],
    radiusBase: 36,
    radiusSpread: 11,
    altitudeSpread: 5.5,
    minAltitude: 45.5,
    count: 9,
    speedRange: [0.15, 0.22],
    clockwise: false,
  },
];

export const SKY_BIRD_TOTAL_COUNT = SKY_BIRD_FLOCKS.reduce(
  (sum, flock) => sum + flock.count,
  0,
);

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Pure mirror of the GLSL wing-flap envelope: alternates between calm gliding and
 * active 2-3 beat flapping cycles so circling raptors/crows don't flutter uniformly.
 */
export function computeBirdFlapState(
  time: number,
  flapPhase: number,
  flapSpeed: number,
): { flapActivity: number; wingOffset: number } {
  const soarCycle = Math.sin(time * 0.65 + flapPhase * 2.13);
  const flapActivity = smoothstep(-0.15, 0.45, soarCycle);
  const beat = Math.sin(time * flapSpeed + flapPhase * Math.PI * 2);
  const glideLift = (1 - flapActivity) * 0.14;
  const wingOffset = beat * (0.12 + 0.56 * flapActivity) + glideLift;
  return { flapActivity, wingOffset };
}

/**
 * Pure mirror of the GLSL circular flight path for unit tests and spatial bounds checks.
 */
export function evaluateBirdWorldPosition(
  bird: SkyBirdInstance,
  time: number,
): [number, number, number] {
  const theta = bird.phase + time * bird.angularSpeed;
  const x = bird.anchor[0] + Math.cos(theta) * bird.radius;
  const z = bird.anchor[2] + Math.sin(theta) * bird.radius;
  const y =
    bird.anchor[1] + Math.sin(time * 0.55 + bird.phase * 1.7) * bird.bobAmp;
  return [x, y, z];
}

export function generateSkyBirdsData(
  flocks: readonly SkyBirdFlockSpec[] = SKY_BIRD_FLOCKS,
  seed = 70719,
): SkyBirdInstance[] {
  const rand = createSeededRng(seed);
  const birds: SkyBirdInstance[] = [];

  for (const flock of flocks) {
    const dir = flock.clockwise ? 1 : -1;
    for (let i = 0; i < flock.count; i++) {
      const baseAngle = (i / flock.count) * Math.PI * 2;
      const phase = baseAngle + (rand() - 0.5) * 0.55;
      const radius = Math.max(
        14,
        flock.radiusBase + (rand() - 0.5) * 2 * flock.radiusSpread,
      );
      const bobAmp = 0.8 + rand() * 1.05;
      const rawAlt = flock.anchor[1] + (rand() - 0.45) * 2 * flock.altitudeSpread;
      const anchorY = Math.max(flock.minAltitude + bobAmp, rawAlt);
      const speed =
        flock.speedRange[0] +
        rand() * (flock.speedRange[1] - flock.speedRange[0]);
      const flapSpeed = 6.2 + rand() * 2.8;
      const flapPhase = rand();
      const scale = 1.28 + rand() * 0.44;
      // Subtle cool-charcoal to slate tint variation per bird (normalized 0.82..1.08)
      const shade = 0.84 + rand() * 0.24;

      birds.push({
        flockId: flock.id,
        anchor: [flock.anchor[0], anchorY, flock.anchor[2]],
        radius,
        angularSpeed: speed * dir,
        phase,
        bobAmp,
        flapSpeed,
        flapPhase,
        scale,
        tint: [shade, shade * 1.02, shade * 1.06],
      });
    }
  }

  return birds;
}

/**
 * Builds a single 4-triangle low-poly bird silhouette in local space:
 * +Z = beak/forward, +/-X = wingspan, +Y = up.
 * Includes `aWingWeight` (0 on fuselage/tail, 1 at wingtips) so only wings articulate.
 */
export function createBirdGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  // 4 triangles = 12 non-indexed vertices:
  // 0..2: forward fuselage + beak
  // 3..5: tail fan
  // 6..8: left wing
  // 9..11: right wing
  const positions = new Float32Array([
    // Fuselage / head (+Z)
    0.0, 0.04, 0.56,
    -0.14, 0.01, -0.26,
    0.14, 0.01, -0.26,

    // Tail fan (-Z)
    0.0, 0.02, -0.18,
    0.24, 0.03, -0.76,
    -0.24, 0.03, -0.76,

    // Left wing (-X)
    -0.11, 0.01, 0.24,
    -1.08, 0.08, -0.14,
    -0.11, 0.0, -0.26,

    // Right wing (+X)
    0.11, 0.01, 0.24,
    0.11, 0.0, -0.26,
    1.08, 0.08, -0.14,
  ]);

  const wingWeights = new Float32Array([
    // Fuselage
    0.0, 0.0, 0.0,
    // Tail
    0.0, 0.0, 0.0,
    // Left wing (leading root, tip, trailing root)
    0.04, 1.0, 0.04,
    // Right wing (leading root, trailing root, tip)
    0.04, 0.04, 1.0,
  ]);

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aWingWeight', new THREE.BufferAttribute(wingWeights, 1));
  geom.computeVertexNormals();
  // Encompass the full Sector 7 sky dome so InstancedMesh is never frustum-culled at origin
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 35, 0), 320);

  return geom;
}
