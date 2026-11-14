import * as THREE from 'three';
import type { MechRig, MechMaterials } from './MechModel';
import type { MechState } from './MechState';

const _tmpMuzzlePos = new THREE.Vector3();
const _tmpMuzzleForward = new THREE.Vector3();
const _tmpMuzzleQuat = new THREE.Quaternion();
const _tmpLook = new THREE.Vector3();

/** Existing visual gunfire; collision and damage are not yet implemented. */
export function stepWeaponSystem(
  rig: MechRig, sim: MechState, fxParent: THREE.Group | null,
  mats: MechMaterials, dt: number, elapsed: number,
  isFiring: boolean, gPitch: number,
): void {
    rig.gunBarrels.forEach((b, bIndex) => {
      b.elevPivot.rotation.x = gPitch;
      if (isFiring) {
        b.fireAccum += dt * b.rateHz;
        if (b.fireAccum >= 1) {
          b.fireAccum -= 1;
          b.flashTimer = 0.095;
          b.recoilOffset = 0.17;
          sim.springTurretYaw.v += -b.side * (0.36 + Math.random() * 0.14);
          sim.springPelvisPitch.v -= 0.2;
          sim.springSurgeZ.v -= 0.32;
          sim.springBounceY.v -= 0.18;

          // Spawn glowing 37-mm AA tracer bolt + ejected brass casing
          if (fxParent && sim.particles.length < 85) {
            b.muzzleAnchor.getWorldPosition(_tmpMuzzlePos);
            b.muzzleAnchor.getWorldQuaternion(_tmpMuzzleQuat);
            _tmpMuzzleForward.set(0, 0, 1).applyQuaternion(_tmpMuzzleQuat).normalize();

            const tracerMat = new THREE.MeshBasicMaterial({
              color: 0xffe57f,
              transparent: true,
              opacity: 0.96,
              toneMapped: false,
            });
            const tracerMesh = new THREE.Mesh(rig.tracerGeom, tracerMat);
            tracerMesh.position.copy(_tmpMuzzlePos).addScaledVector(_tmpMuzzleForward, 1.25);
            _tmpLook.copy(tracerMesh.position).add(_tmpMuzzleForward);
            tracerMesh.lookAt(_tmpLook);
            fxParent.add(tracerMesh);

            sim.particles.push({
              type: 'tracer',
              mesh: tracerMesh,
              mat: tracerMat,
              vel: _tmpMuzzleForward.clone().multiplyScalar(68),
              rotVel: new THREE.Vector3(0, 0, 0),
              life: 0,
              maxLife: 0.9,
              initialOpacity: 0.96,
            });

            if (Math.random() < 0.55) {
              const shellMesh = new THREE.Mesh(rig.shellGeom, mats.brassMat);
              b.mesh.getWorldPosition(shellMesh.position);
              fxParent.add(shellMesh);
              sim.particles.push({
                type: 'shell',
                mesh: shellMesh,
                mat: mats.brassMat,
                vel: new THREE.Vector3(
                  b.side * (1.8 + Math.random() * 1.4),
                  2.4 + Math.random() * 1.2,
                  (Math.random() - 0.5) * 1.8,
                ),
                rotVel: new THREE.Vector3(
                  (Math.random() - 0.5) * 14,
                  (Math.random() - 0.5) * 14,
                  0,
                ),
                life: 0,
                maxLife: 0.9,
                initialOpacity: 1,
              });
            }
          }
        }
      } else {
        b.fireAccum = Math.min(0.94, 0.94 - (bIndex * 0.22));
      }

      if (b.flashTimer > 0) {
        b.flashTimer = Math.max(0, b.flashTimer - dt);
        b.flashMat.opacity = 0.92;
        b.flashMesh.rotation.z = elapsed * 31 + bIndex * 1.7;
      } else {
        b.flashMat.opacity = 0;
      }

      b.recoilOffset = THREE.MathUtils.lerp(b.recoilOffset, 0, dt * 16);
      b.mesh.position.z = b.baseZ - b.recoilOffset;
    });
}
