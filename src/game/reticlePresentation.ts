import * as THREE from 'three';

/**
 * Project a camera-to-sight direction into the HUD, clipping rays outside the view.
 */
export function projectMuzzleDirection(
  camera: THREE.Camera,
  direction: THREE.Vector3,
): { x: number; y: number } | null {
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) ||
      !Number.isFinite(direction.z) || direction.lengthSq() < 1e-10) return null;
  const unit = direction.clone().normalize();
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  if (unit.dot(ahead) <= 0.02) return null; // physically behind the player's view
  // The point is placed on a fixed camera-relative sphere. Distance to the
  // collision target and translation/bounce of the muzzle cannot affect it.
  const virtualPoint = camera.position.clone().addScaledVector(unit, 25);
  const projected = virtualPoint.project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) ||
      projected.z < -1 || projected.z > 1 ||
      Math.abs(projected.x) > 1.02 || Math.abs(projected.y) > 1.02) return null;
  return { x: projected.x, y: projected.y };
}

export interface ReticlePoint { x: number; y: number }

/**
 * Small display-only dead-zone suppresses stepping sway. Exponential smoothing
 * is frame-rate independent: real gun physics and shot vectors are unchanged.
 */
export function smoothMuzzleIndicator(
  previous: ReticlePoint | null, target: ReticlePoint, deltaSeconds: number,
): ReticlePoint {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return previous ?? { x: 50, y: 50 };
  }
  if (previous === null || !Number.isFinite(previous.x) || !Number.isFinite(previous.y)) {
    return { x: target.x, y: target.y };
  }
  const dx = target.x - previous.x, dy = target.y - previous.y;
  if (Math.hypot(dx, dy) < 0.16) return previous; // ~1-3 CSS pixels on typical screens
  const dt = Math.min(0.06, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const tau = Math.hypot(dx, dy) > 12 ? 0.085 : 0.14;
  const alpha = 1 - Math.exp(-dt / tau);
  return { x: previous.x + dx * alpha, y: previous.y + dy * alpha };
}
