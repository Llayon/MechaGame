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

/** Weapon cadence and aim, independent of visual particles and React. */
export function stepWeaponSystem(
  rig: MechRig, dt: number, isFiring: boolean, gunPitch: number,
): MechShot[] {
  const shots: MechShot[] = [];
  rig.gunBarrels.forEach((barrel, barrelIndex) => {
    barrel.elevPivot.rotation.x = gunPitch;
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
