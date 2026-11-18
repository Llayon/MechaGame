import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticParts } from './staticBatches';
import { getOvergrownConcreteMaterial } from './concreteMaterials';
import { buildMechModel, type MechMaterials } from './MechModel';

test('static instances preserve nested transforms, sector hit geometry and moving parts across rebuilds', () => {
  const root = new THREE.Group();
  root.position.set(150, 8, 42);
  root.rotation.y = 0.6;
  const rail = new THREE.Group();
  rail.position.x = 2;
  root.add(rail);
  const first = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const second = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  second.position.x = 3;
  const scanning = new THREE.Group();
  scanning.userData.lodDynamic = true;
  const lamp = first.clone();
  scanning.add(lamp);
  root.add(first, scanning);
  rail.add(second);

  const batch = batchStaticParts(root, { cellSize: Infinity });
  assert.equal(batch.batches.length, 1);
  const draw = batch.batches[0].mesh;
  assert.ok(draw instanceof THREE.InstancedMesh);
  assert.equal(draw.count, 2);
  assert.equal(lamp.visible, true);
  assert.equal(first.visible, false);
  assert.equal(second.visible, false);
  const matrix = new THREE.Matrix4();
  // Traversal encounters the rail's child first.
  draw.getMatrixAt(0, matrix);
  const center = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(center.distanceTo(new THREE.Vector3(5, 0, 0)) < 1e-6);
  root.updateMatrixWorld(true);
  const target = new THREE.Vector3().setFromMatrixPosition(second.matrixWorld);
  const ray = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0, 3, 0)), new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(root).some(hit => hit.object === second));
  assert.equal(ray.intersectObject(draw).length, 0);
  batch.dispose();
  assert.equal(first.visible && second.visible, true);
  assert.equal(draw.parent, null);
  first.geometry.dispose();
  first.material.dispose();
  second.geometry.dispose();
  second.material.dispose();
});

test('merged concrete keeps the source Y of every vertex and excludes invisible geometry', () => {
  const root = new THREE.Group();
  const material = getOvergrownConcreteMaterial('#808080');
  const pier = new THREE.Mesh(new THREE.BoxGeometry(1,4,1), material);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3,1,3), material);
  pier.position.y = 11;
  deck.position.y = 15;
  const hidden = pier.clone();
  hidden.visible = false;
  root.add(pier, deck, hidden);
  const batch = batchStaticParts(root, { cellSize: Infinity });
  const draw = batch.batches.find(part => part.mesh.name === 'Static batch')!.mesh;
  assert.ok(!(draw instanceof THREE.InstancedMesh));
  assert.equal((draw.material as THREE.MeshStandardMaterial).defines?.BATCHED_CONCRETE, 1);
  const local = draw.geometry.getAttribute('aConcreteSourceY');
  const position = draw.geometry.getAttribute('position');
  assert.equal(local.count, 72);
  for (let i = 0; i < 72; i++) {
    assert.equal(position.getY(i) - local.getX(i), i < 36 ? 11 : 15);
  }
  batch.dispose();
  assert.equal(hidden.visible, false);
  assert.equal(material.defines?.BATCHED_CONCRETE, undefined);
  pier.geometry.dispose();
  deck.geometry.dispose();
});

test('mech rigid batches retain gun/pod anchors, actuators, independent joints and two moving ammo belts', () => {
  const materials = new Map<PropertyKey, THREE.Material>();
  const rig = buildMechModel(new Proxy({} as MechMaterials, { get(_, name) {
    if (!materials.has(name)) materials.set(name, new THREE.MeshStandardMaterial());
    return materials.get(name);
  } }));
  try {
    let batched = 0;
    rig.root.traverse(o => { if (o.name === 'Static batch') batched++; });
    assert.ok(batched > 4);
    assert.equal(rig.dynamicAmmoBelts.length, 2);
    assert.ok(rig.dynamicAmmoBelts.every(b => b.instances.visible && b.instances.count === 22 &&
      b.instances.parent === b.linkTransform.parent));
    assert.equal(rig.gunBarrels.length, 4);
    for (const gun of rig.gunBarrels) {
      assert.equal(gun.muzzleAnchor.parent, gun.mesh);
      const before = gun.muzzleAnchor.getWorldPosition(new THREE.Vector3());
      gun.mesh.position.z -= 0.25;
      const after = gun.muzzleAnchor.getWorldPosition(new THREE.Vector3());
      assert.ok(before.distanceTo(after) > 0.02);
    }
    assert.ok(rig.missilePodAnchors.every(anchor => anchor.parent?.parent === rig.turretPivot));
    assert.ok(rig.legs.every(leg => leg.hipBoot.visible && leg.ankleBoot.visible &&
      leg.pistons.every(piston => piston.rod.visible && piston.barrel.visible)));
    assert.ok(rig.grabRails.every(r => r.mesh.visible));
    assert.ok(rig.mtoBlock.visible && rig.mtoGrille.visible);
  } finally {
    rig.dispose();
    materials.forEach(material => material.dispose());
  }
});

test('a joint packs only immutable solids while preserving changing lights, textured parts and instanced ammo', () => {
  const joint = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: 0x202c44, roughness: 0.82, metalness: 0.31 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xe2ddb9, roughness: 0.72, metalness: 0.15 });
  const light = stripe.clone();
  const texture = new THREE.Texture();
  const textured = new THREE.MeshStandardMaterial({ map: texture });
  const box = new THREE.BoxGeometry();
  const belt = new THREE.InstancedMesh(box, armor, 22);
  const lightMesh = new THREE.Mesh(box, light);
  const texturedMesh = new THREE.Mesh(box, textured);
  joint.add(new THREE.Mesh(box, armor), new THREE.Mesh(box, stripe), belt, lightMesh, texturedMesh);
  const batch = batchStaticParts(joint, {
    cellSize: Infinity, directChildrenOnly: true, immutableJointMaterials: new Set([armor, stripe, textured]),
  });
  try {
    assert.equal(batch.batches.length, 1);
    const draw = batch.batches[0].mesh;
    assert.ok(draw instanceof THREE.InstancedMesh);
    assert.equal(draw.count, 2);
    const albedo = draw.geometry.getAttribute('aAlbedoRough') as THREE.InstancedBufferAttribute;
    const emission = draw.geometry.getAttribute('aEmissionMetal') as THREE.InstancedBufferAttribute;
    for (const [i, material] of [armor, stripe].entries()) {
      assert.deepEqual(Array.from(albedo.array.slice(i * 4, i * 4 + 4)),
        [...material.color.toArray(), material.roughness].map(Math.fround));
      assert.equal(emission.getW(i), Math.fround(material.metalness));
    }
    light.emissiveIntensity = 2.8;
    assert.equal(lightMesh.visible && lightMesh.material.emissiveIntensity === 2.8, true);
    assert.equal(texturedMesh.visible && texturedMesh.material.map === texture, true);
    assert.equal(belt.visible && belt.count === 22, true);
  } finally {
    batch.dispose();
    belt.dispose();
    box.dispose();
    texture.dispose();
    for (const material of [armor, stripe, textured, light]) material.dispose();
  }
});
test('shared PBR draws preserve per-part linear color, emissive radiance, metalness and roughness', () => {
  for (const instanced of [false, true]) {
    const root = new THREE.Group();
    const first = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({
      color: '#339944', roughness: 0.25, metalness: 0.75,
    }));
    const second = new THREE.Mesh(new THREE.BoxGeometry(instanced ? 1 : 2, 1, 1), new THREE.MeshStandardMaterial({
      color: '#ff8866', emissive: '#55aacc', emissiveIntensity: 3.1, roughness: 0.9, metalness: 0.15,
    }));
    root.add(first, second);
    const result = batchStaticParts(root, { cellSize: Infinity });
    const draw = result.batches[0].mesh;
    assert.equal(draw instanceof THREE.InstancedMesh, instanced);
    const tint = draw.geometry.getAttribute('aAlbedoRough');
    const glow = draw.geometry.getAttribute('aEmissionMetal');
    const index = instanced ? 1 : 36;
    assert.ok(Math.abs(tint.getY(index) - second.material.color.g) < 1e-6);
    assert.ok(Math.abs(tint.getW(index) - 0.9) < 1e-6);
    assert.ok(Math.abs(glow.getZ(index) - second.material.emissive.b * 3.1) < 1e-6);
    assert.ok(Math.abs(glow.getW(index) - 0.15) < 1e-6);
    assert.equal(first.geometry.hasAttribute('aAlbedoRough'), false);
    result.dispose();
    for (const mesh of [first, second]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
});
