import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildMechModel } from '../scene/objects/MechModel';
import { createMechMaterials } from '../scene/objects/mechMaterials';
import { createMechState } from '../scene/objects/MechState';
import { resolveMechControl } from '../scene/objects/MechController';
import { stepMechMovement } from '../scene/objects/MechMovementSystem';
import { stepMechIK } from '../scene/objects/MechIKSystem';

/** Static existing Object 316 for scale QA. No SovietMech, mission, AI or audio. */
export function MechReference() {
  const reference = useMemo(() => {
    const materials = createMechMaterials(2), rig = buildMechModel(materials);
    const sim = createMechState(); sim.yaw = 0;
    const input = { forward: 0, turn: 0, turretTurn: 0, fire: false, sprint: false, crouch: false };
    const control = resolveMechControl(input, false);
    for (let i = 0; i < 30; i++) {
      const motion = stepMechMovement(rig, sim, control, false, 1 / 30, 0);
      stepMechIK(rig, sim, 1 / 30, control, motion);
    }
    const group = new THREE.Group(); group.name = 'perf:mech-scale-reference';
    group.add(rig.root, rig.worldFeetGroup);
    group.position.set(2.2 - sim.x, -sim.y, .4 - sim.z);
    return { group, dispose() { rig.dispose(); materials.dispose(); } };
  }, []);
  useEffect(() => () => reference.dispose(), [reference]);
  return <primitive object={reference.group} />;
}
