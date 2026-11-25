import type { Camera } from 'three';

export interface WorldLodView {
  focalPixels: number;
  detailScale: number;
  shadowScale: number;
  debug: boolean;
}

const views = new WeakMap<Camera, WorldLodView>();

export function readWorldLod(camera: Camera): WorldLodView {
  let view = views.get(camera);
  if (!view) {
    view = { focalPixels: 768, detailScale: 1, shadowScale: 1, debug: false };
    views.set(camera, view);
  }
  return view;
}

/** Screen diameter uses view-space depth and CSS pixels, independently of framebuffer DPR. */
export function projectedPixels(radiusWorld: number, depthWorld: number, view: WorldLodView) {
  return 2 * radiusWorld * view.focalPixels * view.detailScale / Math.max(0.01, depthWorld);
}

export function viewDepth(camera: Camera, x: number, y: number, z: number) {
  const m = camera.matrixWorldInverse.elements;
  return -(m[2] * x + m[6] * y + m[10] * z + m[14]);
}

/** Omit only decorative geometry below the screen-space budget. Its pool still advances. */
export function effectVisible(camera: Camera, x: number, y: number, z: number, radius: number, minPixels: number) {
  const depth = viewDepth(camera, x, y, z);
  return depth >= -radius && projectedPixels(radius, depth, readWorldLod(camera)) >= minPixels;
}

/** Plastic/golden-ratio low-discrepancy constant matching Atlantis anti-ring LOD jitter (+/-13%). */
export const LOD_JITTER_CONSTANT = 0.7548777;

/**
 * Deterministic per-instance/per-cell LOD threshold multiplier in [0.87, 1.13).
 * Breaks up concentric LOD pop rings around the moving camera.
 */
export function lodJitter(id: number): number {
  const raw = id * LOD_JITTER_CONSTANT;
  const frac = raw - Math.floor(raw);
  return 0.87 + 0.26 * frac;
}

/** Thresholds are ordered from largest to smallest. A negative previous level initializes without hysteresis. */
export function chooseLod(
  pixels: number,
  previous: number,
  thresholds: readonly number[],
  jitterId?: number,
) {
  const effectivePixels =
    jitterId === undefined ? pixels : pixels / lodJitter(jitterId);
  if (previous < 0 || previous > thresholds.length) {
    const index = thresholds.findIndex((threshold) => effectivePixels >= threshold);
    return index < 0 ? thresholds.length : index;
  }
  let level = previous;
  while (level > 0 && effectivePixels >= thresholds[level - 1] * 1.15) level--;
  while (level < thresholds.length && effectivePixels < thresholds[level] * 0.85) level++;
  return level;
}
