import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { ANIMATIONS, DEFAULT_LAB, makeInstances, sampleClip } from './types';
import type { AnimationAtlas } from './types';
import { createGpuInfantry } from './gpuAnimation';
import type { InfantryData } from './gpuAnimation';
import { withGraphicsPreset, resolveGraphicsRuntime } from '../game/graphicsSettings';

function glb(path: string) {
  const buffer = readFileSync(path);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const binaryOffset = 28 + buffer.readUInt32LE(12);
  function bytes(view: number) { const v = json.bufferViews[view]; return buffer.subarray(binaryOffset + (v.byteOffset ?? 0), binaryOffset + (v.byteOffset ?? 0) + v.byteLength); }
  function values(index: number): number[] {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView];
    const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 } as Record<string, number>)[a.type];
    const size = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
    return Array.from({ length: a.count * n }, (_, i) => {
      const at = binaryOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + Math.floor(i / n) * (v.byteStride ?? size * n) + (i % n) * size;
      return a.componentType === 5126 ? buffer.readFloatLE(at) : a.componentType === 5123 ? buffer.readUInt16LE(at) : buffer.readUInt8(at);
    });
  }
  return { buffer, json, bytes, values };
}
const source = glb('public/assets/infantry/source.glb');
const rigged = glb('public/assets/infantry/infantry-rigged.glb');
const atlas = JSON.parse(readFileSync('public/assets/infantry/animation.json', 'utf8')) as AnimationAtlas;
const raw = readFileSync('public/assets/infantry/animation.rgba16f');
const floats = Array.from({ length: raw.length / 2 }, (_, i) => THREE.DataUtils.fromHalfFloat(raw.readUInt16LE(i * 2)));
function transform(bone: string, frame: number, p = new THREE.Vector3()) {
  const offset = (frame * atlas.bones.length + atlas.bones.indexOf(bone)) * 8;
  return p.clone().applyQuaternion(new THREE.Quaternion(...floats.slice(offset, offset + 4) as [number, number, number, number]).normalize())
    .add(new THREE.Vector3(...floats.slice(offset + 4, offset + 7) as [number, number, number]));
}

test('original Tripo bytes, mesh topology, maps and exported rig are preserved', () => {
  assert.equal(createHash('sha256').update(source.buffer).digest('hex'), atlas.sourceSha256);
  assert.equal(source.json.meshes.length, 1); assert.equal(source.json.accessors[3].count / 3, 1247);
  assert.equal(rigged.json.meshes.length, 1); assert.equal(rigged.json.skins[0].joints.length, 14);
  const primitive = rigged.json.meshes[0].primitives[0];
  assert.equal(rigged.json.accessors[primitive.indices].count / 3, 1247);
  assert.equal(rigged.json.accessors[primitive.attributes.POSITION].count, 1458); // six normal-seam splits, no new faces
  assert.deepEqual(rigged.json.images.map((im: { bufferView: number }) => createHash('sha256').update(rigged.bytes(im.bufferView)).digest('hex')),
    source.json.images.map((im: { bufferView: number }) => createHash('sha256').update(source.bytes(im.bufferView)).digest('hex')));
  assert.deepEqual(rigged.json.animations.map((a: { name: string }) => a.name), [...ANIMATIONS]);
  assert.equal(rigged.json.materials.length, 1);
  const position = rigged.json.accessors[primitive.attributes.POSITION];
  assert.ok(Math.abs(position.max[1] - position.min[1] - .48) < 1e-6);
  for (const name of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'WEIGHTS_0', 'JOINTS_0']) {
    assert.ok(rigged.values(primitive.attributes[name]).every(Number.isFinite));
  }
  const weights = rigged.values(primitive.attributes.WEIGHTS_0);
  for (let i = 0; i < weights.length; i += 4) assert.ok(Math.abs(weights.slice(i, i + 4).reduce((a, b) => a + b, 0) - 1) < 1e-5);
});

test('atlas has finite normalized rigid transforms, supported dimensions and intact weapon lengths', () => {
  assert.equal(raw.length, atlas.width * atlas.heightTexels * 8);
  assert.ok(atlas.width <= 2048 && atlas.heightTexels <= 2048);
  assert.ok(floats.every(Number.isFinite));
  for (let i = 0; i < floats.length; i += 8) assert.ok(Math.abs(Math.hypot(...floats.slice(i, i + 4)) - 1) < .002);
  const a = new THREE.Vector3(0, .3, .05), b = new THREE.Vector3(.05, .27, .18);
  for (let frame = 0; frame < atlas.heightTexels; frame++) {
    assert.ok(Math.abs(transform('weapon', frame, a).distanceTo(transform('weapon', frame, b)) - a.distanceTo(b)) < 1e-6);
  }
});

test('baked walking/running stance plus root speed locks the foot; loop endpoints match', () => {
  for (const name of ['walk', 'run']) {
    const clip = atlas.clips.find(c => c.name === name)!;
    const start = transform('foot_L', clip.offset);
    const stance = name === 'run' ? .43 : .62;
    for (let frame = 1; frame < (clip.frames - 1) * stance; frame++) {
      const t = frame / atlas.fps;
      const foot = transform('foot_L', clip.offset + frame);
      assert.ok(Math.abs((foot.z + clip.movementSpeed * t) - start.z) < .001, `${name} frame ${frame} sliding`);
    }
    for (const bone of atlas.bones) {
      assert.ok(transform(bone, clip.offset).distanceTo(transform(bone, clip.offset + clip.frames - 1)) < .001);
    }
  }
  const crouch = atlas.clips.find(c => c.name === 'crouch')!;
  assert.equal(sampleClip(crouch, 100, .5).a, crouch.offset + crouch.frames - 1);
});

test('1/20/100/200 instances retain independent states, phases and finite placement', () => {
  for (const count of [1, 20, 100, 200] as const) {
    const instances = makeInstances({ ...DEFAULT_LAB, count });
    assert.equal(instances.length, count);
    assert.equal(new Set(instances.map(s => s.animationPhase)).size, count);
    assert.ok(instances.flatMap(s => s.position).every(Number.isFinite));
    if (count >= 20) assert.equal(new Set(instances.map(s => s.animation)).size, 5);
  }
  const states = makeInstances({ ...DEFAULT_LAB, count: 200, individualPhases: false, animation: 'run' });
  assert.ok(states.every(s => s.animationPhase === 0 && s.animation === 'run'));
  assert.equal(states.filter(s => s.faction === 'friendly').length, 50);
});

test('batch wrappers share vertex buffers/material and own their generation; disposal is idempotent', () => {
  const primitive = rigged.json.meshes[0].primitives[0];
  const geometry = new THREE.BufferGeometry();
  for (const [name, width] of [['POSITION', 3], ['NORMAL', 3], ['TEXCOORD_0', 2], ['JOINTS_0', 4], ['WEIGHTS_0', 4]] as const) {
    const label = ({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' })[name];
    geometry.setAttribute(label, new THREE.Float32BufferAttribute(rigged.values(primitive.attributes[name]), width));
  }
  geometry.setIndex(rigged.values(primitive.indices));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  const bones = rigged.json.skins[0].joints.map((i: number) => { const bone = new THREE.Bone(); bone.name = rigged.json.nodes[i].name; return bone; });
  mesh.skeleton = new THREE.Skeleton(bones);
  const data = { mesh, atlas, binary: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) } as unknown as InfantryData;
  const first = createGpuInfantry(data, { ...DEFAULT_LAB, count: 200, batches: 10 });
  const next = createGpuInfantry(data, { ...DEFAULT_LAB, count: 20 });
  const hidden = createGpuInfantry(data, DEFAULT_LAB, makeInstances(DEFAULT_LAB).map(s => ({ ...s, alive: false })));
  assert.equal(hidden.meshes.length, 0); assert.equal(hidden.instances.length, 0);
  hidden.dispose();
  const rotated = createGpuInfantry(data, { ...DEFAULT_LAB, count: 1, travel: true },
    [{ ...makeInstances({ ...DEFAULT_LAB, count: 1, animation: 'run' })[0], heading: Math.PI / 2 }]);
  assert.ok(rotated.meshes[0].boundingBox!.max.x > rotated.instances[0].movementSpeed * 60);
  rotated.dispose();
  assert.equal(first.meshes.length, 10);
  assert.equal(new Set(first.meshes.map(m => m.material)).size, 1);
  assert.equal(new Set(first.meshes.map(m => m.geometry.getAttribute('position'))).size, 1);
  assert.notEqual(first.meshes[0].geometry.getAttribute('position'), next.meshes[0].geometry.getAttribute('position'));
  assert.equal(first.updateMatrices(), 200);
  assert.ok(first.meshes.every(m => [...m.instanceMatrix.array].every(Number.isFinite)));
  first.dispose(); first.dispose(); next.dispose();
  assert.equal(first.root.children.length, 0);
  assert.equal(geometry.getAttribute('position').count, 1458);
  mesh.skeleton.dispose(); geometry.dispose(); (mesh.material as THREE.Material).dispose();
});

test('all MechaGame presets resolve usable lab DPR and shadows without changing simulation', () => {
  for (const preset of ['low', 'balanced', 'high', 'ultra'] as const) {
    const runtime = resolveGraphicsRuntime(withGraphicsPreset(preset), 3, true);
    assert.ok(Number.isFinite(runtime.dpr) && runtime.dpr > 0 && runtime.dpr <= 1.15);
    assert.ok(runtime.shadowMapSize <= 1024);
  }
});
