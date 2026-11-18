import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PINE_TREE_TOTAL_HEIGHT = 2.15;

interface ConeTierSpec {
  y: number;
  r: number;
  h: number;
  segs: number;
}

const CONE_TIERS: ReadonlyArray<ConeTierSpec> = [
  { y: 0.64, r: 0.57, h: 0.64, segs: 11 },
  { y: 0.99, r: 0.47, h: 0.58, segs: 10 },
  { y: 1.32, r: 0.37, h: 0.52, segs: 9 },
  { y: 1.62, r: 0.26, h: 0.45, segs: 8 },
  { y: 1.91, r: 0.15, h: 0.46, segs: 7 },
];

function paintTrunkColors(
  geo: THREE.BufferGeometry,
  colBottom: THREE.Color,
  colTop: THREE.Color,
): void {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const needleTips = new Float32Array(pos.count);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 0.72));
    c.copy(colBottom).lerp(colTop, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    needleTips[i] = 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aNeedleTip', new THREE.BufferAttribute(needleTips, 1));
}

function softenNormalsToSphere(
  geo: THREE.BufferGeometry,
  center: THREE.Vector3,
  factor: number,
): void {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const radial = new THREE.Vector3();
  const mixed = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    radial.fromBufferAttribute(pos, i).sub(center);
    // Gentle skyward bias so lower bough undersides stay softly lit instead of harsh black
    radial.y = radial.y * 0.72 + 0.34;
    if (radial.lengthSq() < 1e-6) {
      radial.set(0, 1, 0);
    } else {
      radial.normalize();
    }

    mixed.set(
      norm.getX(i) * (1 - factor) + radial.x * factor,
      norm.getY(i) * (1 - factor) + radial.y * factor,
      norm.getZ(i) * (1 - factor) + radial.z * factor,
    );
    if (mixed.lengthSq() < 1e-6) {
      mixed.copy(radial);
    } else {
      mixed.normalize();
    }
    norm.setXYZ(i, mixed.x, mixed.y, mixed.z);
  }
}

/**
 * Builds a single merged, vertex-colored procedural conifer geometry (trunk + 5 jagged
 * organically deformed bough tiers) with blended non-indexed faceted + spherical normals
 * and an `aNeedleTip` attribute for sunlit foliage rim translucency in 1 Draw Call.
 */
export function createUnifiedPineTreeGeometry(simplified = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tmpColor = new THREE.Color();

  // 1. Grounded bark trunk rooted slightly below y=0 (-0.01..0.71)
  const rawTrunk = new THREE.CylinderGeometry(0.045, 0.088, 0.72, simplified ? 4 : 6, 1);
  rawTrunk.translate(0, 0.35, 0);
  const trunk = rawTrunk.toNonIndexed();
  rawTrunk.dispose();
  trunk.deleteAttribute('uv');
  trunk.computeVertexNormals();
  paintTrunkColors(trunk, new THREE.Color('#392416'), new THREE.Color('#5a3d29'));
  parts.push(trunk);

  // 2. Five multi-frequency jagged conifer bough tiers with deepened inner crevice AO
  const darkInnerGreen = new THREE.Color('#162c1e');
  const midPineGreen = new THREE.Color('#325b38');
  const tipGreen = new THREE.Color('#649651');
  const sphereCenter = new THREE.Vector3(0, 1.06, 0);

  const tiers = simplified ? [
    { y: .81, r: .58, h: 1.04, segs: 6 },
    { y: 1.31, r: .41, h: .86, segs: 5 },
    { y: 1.78, r: .25, h: .74, segs: 4 },
  ] : CONE_TIERS;
  tiers.forEach((tier, idx) => {
    const rawCone = new THREE.ConeGeometry(tier.r, tier.h, tier.segs, 1, false);
    const pos = rawCone.getAttribute('position');

    // Deform outer bottom ring into uneven, weight-drooped pine bough claws
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      if (y < 0) {
        const radial = Math.hypot(x, z);
        if (radial > 1e-4) {
          const angle = Math.atan2(z, x);
          const lobes = Math.max(3, Math.floor(tier.segs / 2));
          const wave =
            Math.sin(angle * lobes + idx * 1.73) * 0.70 +
            Math.cos(angle * (lobes + 2) - idx * 2.41) * 0.30;
          const radiusScale = 1.0 + wave * 0.30;
          pos.setX(i, x * radiusScale);
          pos.setZ(i, z * radiusScale);
          pos.setY(i, y - Math.max(0, wave) * (tier.h * 0.19));
        } else {
          // Slightly vault bottom cap center upward so undersides never bulge below bough rims
          pos.setY(i, y + tier.h * 0.09);
        }
      }
    }

    // Subtle organic trunk/crown offset per tier
    const offsetX = Math.sin(idx * 2.3 + 0.4) * 0.025;
    const offsetZ = Math.cos(idx * 1.9 + 1.1) * 0.021;
    rawCone.translate(offsetX, tier.y, offsetZ);

    const nonIndexed = rawCone.toNonIndexed();
    rawCone.dispose();
    nonIndexed.deleteAttribute('uv');
    nonIndexed.computeVertexNormals();

    const nPos = nonIndexed.getAttribute('position');
    const nNorm = nonIndexed.getAttribute('normal');
    const colors = new Float32Array(nPos.count * 3);
    const needleTips = new Float32Array(nPos.count);

    for (let i = 0; i < nPos.count; i++) {
      const vx = nPos.getX(i);
      const vy = nPos.getY(i);
      const vz = nPos.getZ(i);
      const normY = nNorm.getY(i);

      const radialRatio = Math.min(1, Math.hypot(vx - offsetX, vz - offsetZ) / tier.r);
      const heightRatio = Math.max(0, Math.min(1, vy / PINE_TREE_TOTAL_HEIGHT));
      const undersideShade = normY < -0.25 ? 0.54 : 1.0;

      // Stronger inner-trunk AO darkening so branch overlaps read with crisp depth
      const innerCrevice = 0.76 + 0.24 * Math.min(1, radialRatio * 1.45);
      const brightFactor = Math.min(
        1,
        (radialRatio * 0.60 + heightRatio * 0.54) * undersideShade * innerCrevice,
      );

      if (brightFactor < 0.42) {
        tmpColor.copy(darkInnerGreen).lerp(midPineGreen, brightFactor / 0.42);
      } else {
        tmpColor.copy(midPineGreen).lerp(tipGreen, (brightFactor - 0.42) / 0.58);
      }

      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;

      const tipExposure = Math.max(
        0,
        Math.min(1, radialRatio * 0.74 + heightRatio * 0.34),
      );
      needleTips[i] = tipExposure * (normY < -0.25 ? 0.30 : 1.0);
    }

    nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nonIndexed.setAttribute('aNeedleTip', new THREE.BufferAttribute(needleTips, 1));
    softenNormalsToSphere(nonIndexed, sphereCenter, 0.66);
    parts.push(nonIndexed);
  });

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error('Failed to merge pine tree geometry parts');
  }
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
