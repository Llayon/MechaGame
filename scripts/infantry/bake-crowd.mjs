// Rebuild from the reviewed Rigify export without checking out the animation branch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DataUtils, Matrix4, Object3D } from 'three';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

const revision = process.argv[2] || '24b257696d15ecd5e510d9b1090290b2eef6073e';
const source = 'public/assets/infantry-candidate/rigify-demo/';
const destination = 'public/assets/crowd/';
mkdirSync(destination, { recursive: true });
const metadata = JSON.parse(readSource('manifest.json'));
const atlas = { revision, source, bones: [], clips: [], width: 0, height: 0, triangles: [] };

function readSource(name) {
  return execFileSync('git', ['show', revision + ':' + source + name], { maxBuffer: 8_000_000 });
}

function unpack(buffer) {
  const end = 20 + buffer.readUInt32LE(12);
  return { gltf: JSON.parse(buffer.subarray(20, end)), bin: buffer.subarray(end + 8) };
}

function readAccessor({ gltf, bin }, index) {
  const accessor = gltf.accessors[index],
    view = gltf.bufferViews[accessor.bufferView];
  const Type = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[
    accessor.componentType
  ];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
  if (!Type || !width || view.byteStride || accessor.sparse)
    throw Error('Unexpected animation export layout');
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  return new Type(bin.buffer, bin.byteOffset + start, accessor.count * width);
}

function bakeMatrices(model) {
  const { gltf } = model;
  const skin = gltf.skins[0],
    joints = skin.joints;
  atlas.bones = joints.map((i) => gltf.nodes[i].name);
  atlas.width = joints.length * 3;
  const inverseBind = readAccessor(model, skin.inverseBindMatrices);
  const rows = [];
  const frameRate = 30;
  for (const animation of gltf.animations) {
    const nodes = gltf.nodes.map((node) => {
      const obj = new Object3D();
      if (node.translation) obj.position.fromArray(node.translation);
      if (node.rotation) obj.quaternion.fromArray(node.rotation);
      if (node.scale) obj.scale.fromArray(node.scale);
      return obj;
    });
    gltf.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
    const root = new Object3D();
    for (const i of gltf.scenes[gltf.scene].nodes) root.add(nodes[i]);
    const tracks = animation.channels.map(({ sampler, target }) => {
      const data = animation.samplers[sampler];
      const interpolation = data.interpolation || 'LINEAR';
      if (!['STEP', 'LINEAR'].includes(interpolation))
        throw Error('Unsupported interpolation ' + interpolation);
      const property = { translation: 'position', scale: 'scale', rotation: 'quaternion' }[target.path];
      return {
        times: readAccessor(model, data.input),
        values: readAccessor(model, data.output),
        value: nodes[target.node][property],
        next: nodes[target.node][property].clone(),
        interpolation,
        width: target.path === 'rotation' ? 4 : 3,
        key: 0,
      };
    });
    const clip = metadata.clips.find((c) => c.name === animation.name);
    const frames = Math.round(clip.duration * frameRate) + 1;
    atlas.clips.push({
      name: clip.name,
      offset: atlas.height,
      frames,
      duration: clip.duration,
      loop: clip.loop,
    });
    for (let f = 0; f < frames; f++) {
      for (const t of tracks) {
        const time = (f * clip.duration) / (frames - 1);
        while (t.key + 1 < t.times.length && t.times[t.key + 1] <= time + 1e-5) t.key++;
        t.value.fromArray(t.values, t.key * t.width);
        if (t.interpolation === 'LINEAR' && t.key + 1 < t.times.length) {
          const alpha = Math.max(0, (time - t.times[t.key]) / (t.times[t.key + 1] - t.times[t.key]));
          t.next.fromArray(t.values, (t.key + 1) * t.width);
          if (t.width === 4) t.value.slerp(t.next, alpha);
          else t.value.lerp(t.next, alpha);
        }
      }
      root.updateMatrixWorld(true);
      for (let j = 0; j < joints.length; j++) {
        const m = new Matrix4()
          .fromArray(inverseBind, j * 16)
          .premultiply(nodes[joints[j]].matrixWorld).elements;
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 4; c++) rows.push(DataUtils.toHalfFloat(m[c * 4 + r]));
      }
    }
    atlas.height += frames;
  }
  writeFileSync(destination + 'poses.rgba16f', Buffer.from(new Uint16Array(rows).buffer));
}

function packMesh(model, level) {
  const { gltf, bin } = model;
  const prim = gltf.meshes[0].primitives[0];
  const buffers = [],
    accessors = [],
    bufferViews = [];
  let byteLength = 0;
  function put(bytes, properties = {}) {
    bufferViews.push({ ...properties, buffer: 0, byteOffset: byteLength, byteLength: bytes.length });
    const padding = (4 - (bytes.length % 4)) % 4;
    buffers.push(bytes, Buffer.alloc(padding));
    byteLength += bytes.length + padding;
    return bufferViews.length - 1;
  }
  const copyView = (i) => {
    const v = gltf.bufferViews[i],
      start = v.byteOffset ?? 0;
    return put(bin.subarray(start, start + v.byteLength), v);
  };
  const copyAccessor = (i) => {
    const a = gltf.accessors[i];
    accessors.push({ ...a, bufferView: copyView(a.bufferView) });
    return accessors.length - 1;
  };
  const attributes = {};
  for (const [name, id] of Object.entries(prim.attributes)) {
    const attr = { JOINTS_0: '_JOINTS', WEIGHTS_0: '_WEIGHTS' }[name] || name;
    attributes[attr] = copyAccessor(id);
  }
  const meshes = [
    { name: 'LOD' + level, primitives: [{ attributes, material: 0, indices: copyAccessor(prim.indices) }] },
  ];
  atlas.triangles.push(gltf.accessors[prim.indices].count / 3);
  if (level === 2) {
    const index = Uint32Array.from(readAccessor(model, prim.indices));
    const position = readAccessor(model, prim.attributes.POSITION);
    let [simple] = MeshoptSimplifier.simplify(index, position, 3, 900, 1, ['Permissive']);
    if (simple.length > 960) [simple] = MeshoptSimplifier.simplifySloppy(index, position, 3, null, 900, 1);
    if (simple.length < 420 || simple.length > 960)
      throw Error('Unexpected distant mesh size ' + simple.length);
    const small = Uint16Array.from(simple);
    const farIndex = accessors.length;
    accessors.push({
      bufferView: put(Buffer.from(small.buffer), { target: 34963 }),
      componentType: 5123,
      count: small.length,
      type: 'SCALAR',
    });
    meshes.push({ name: 'LOD3', primitives: [{ attributes, material: 0, indices: farIndex }] });
    atlas.triangles.push(small.length / 3);
  }
  const images = gltf.images.map((image) => ({ ...image, bufferView: copyView(image.bufferView) }));
  const doc = {
    asset: gltf.asset,
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ mesh: i, name: m.name })),
    buffers: [{ byteLength }],
    accessors,
    bufferViews,
    meshes,
    materials: gltf.materials,
    images,
    textures: gltf.textures,
    samplers: gltf.samplers,
  };
  const json = Buffer.from(JSON.stringify(doc));
  const jl = Math.ceil(json.length / 4) * 4;
  const header = Buffer.alloc(20),
    binHeader = Buffer.alloc(8);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jl + byteLength, 8);
  header.writeUInt32LE(jl, 12);
  header.write('JSON', 16);
  binHeader.writeUInt32LE(byteLength);
  binHeader.write('BIN\0', 4);
  writeFileSync(
    destination + 'lod' + level + '.glb',
    Buffer.concat([header, json, Buffer.alloc(jl - json.length, 32), binHeader, ...buffers]),
  );
}

await MeshoptSimplifier.ready;
for (const lod of metadata.lods) {
  const model = unpack(readSource(lod.glb));
  if (!lod.level) bakeMatrices(model);
  const names = model.gltf.skins[0].joints.map((i) => model.gltf.nodes[i].name);
  if (JSON.stringify(names) !== JSON.stringify(atlas.bones)) throw Error('Incompatible joint order');
  packMesh(model, lod.level);
}
writeFileSync(destination + 'atlas.json', JSON.stringify(atlas, null, 2) + '\n');
console.log(atlas.triangles, atlas.width, atlas.height);
