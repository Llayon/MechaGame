import * as THREE from 'three';
import type { MechRig } from './MechModel';

/** Produced by the weapon simulation; effect generation consumes these events. */
export interface MechShot {
  barrelIndex: number;
  side: -1 | 1;
  muzzlePosition: THREE.Vector3;
  direction: THREE.Vector3;
  ejectPosition: THREE.Vector3;
}

const muzzleQuat = new THREE.Quaternion();
const forward = new THREE.Vector3(0, 0, 1);
const localSight = new THREE.Vector3();
const trim = new THREE.Quaternion();
const anchorPosition = new THREE.Vector3();
const anchorAxis = new THREE.Vector3();
const MAX_BARREL_TRIM = THREE.MathUtils.degToRad(24);

/** The heavy weapons share a bore axis midway between the physical gun pods. */
export function getMainGunRay(
  rig: MechRig, origin: THREE.Vector3, direction: THREE.Vector3, sightPoint?: THREE.Vector3,
): void {
  origin.set(0, 0, 0);
  direction.set(0, 0, 0);
  for (const { muzzleAnchor } of rig.gunBarrels) {
    muzzleAnchor.getWorldPosition(anchorPosition);
    muzzleAnchor.getWorldDirection(anchorAxis);
    origin.add(anchorPosition);
    // Average displacements to the sight depth. Different muzzle origins have
    // different path lengths even when every barrel intersects the same point.
    const depth = sightPoint ? anchorPosition.subVectors(sightPoint, anchorPosition).dot(anchorAxis) : 1;
    direction.addScaledVector(anchorAxis, depth > 0 ? depth : 1);
  }
  if (rig.gunBarrels.length) {
    origin.divideScalar(rig.gunBarrels.length);
    direction.normalize();
  }
}

/** Weapon cadence and aim, independent of visual particles and React. */
export function stepWeaponSystem(
  rig: MechRig, dt: number, isFiring: boolean, gunPitch: number, sightPoint?: THREE.Vector3,
): MechShot[] {
  const shots: MechShot[] = [];
  rig.gunBarrels.forEach((barrel, barrelIndex) => {
    barrel.elevPivot.rotation.x = gunPitch;
    barrel.mesh.quaternion.identity();
    if (sightPoint) {
      // The mesh translates along its parent for recoil. Solve from that
      // pivot so the rendered barrel, its muzzle and the shot share one line.
      barrel.elevPivot.worldToLocal(localSight.copy(sightPoint)).sub(barrel.mesh.position);
      if (localSight.z > barrel.muzzleAnchor.position.z) {
        trim.setFromUnitVectors(forward, localSight.normalize());
        barrel.mesh.quaternion.rotateTowards(trim, MAX_BARREL_TRIM);
      }
    }
    if (isFiring) {
      barrel.fireAccum += dt * barrel.rateHz;
      if (barrel.fireAccum >= 1) {
        barrel.fireAccum -= 1;
        const muzzlePosition = barrel.muzzleAnchor.getWorldPosition(new THREE.Vector3());
        barrel.muzzleAnchor.getWorldQuaternion(muzzleQuat);
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(muzzleQuat).normalize();
        shots.push({
          barrelIndex,
          side: barrel.side,
          muzzlePosition,
          direction,
          ejectPosition: barrel.mesh.getWorldPosition(new THREE.Vector3()),
        });
      }
    } else {
      barrel.fireAccum = Math.min(0.94, 0.94 - barrelIndex * 0.22);
    }
  });
  return shots;
}
