import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, LoopOnce, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { METERS_PER_UNIT } from '../../map/terrainMath';
import { ARMED_ASSET_DIRECTORY, RIG_VARIANTS, SOURCE_RIG_DIRECTORY } from './heroAssets';

async function loadGeometry(path: string) {
  const source = readFileSync(`public/${path}`);
  const jsonEnd = 20 + source.readUInt32LE(12);
  const spec = JSON.parse(source.toString('utf8', 20, jsonEnd));
  // Exercise the same loader and skinning as the playground without decoding textures in Bun.
  delete spec.materials;
  delete spec.textures;
  delete spec.images;
  for (const mesh of spec.meshes) {
    for (const primitive of mesh.primitives) delete primitive.material;
  }
  const json = Buffer.from(JSON.stringify(spec));
  const padding = (4 - json.length % 4) % 4;
  const header = Buffer.from(source.subarray(0, 20));
  header.writeUInt32LE(json.length + padding, 12);
  header.writeUInt32LE(20 + json.length + padding + source.length - jsonEnd, 8);
  const data = Buffer.concat([header, json, Buffer.alloc(padding, 0x20), source.subarray(jsonEnd)]);
  return new GLTFLoader().parseAsync(Uint8Array.from(data).buffer, '');
}

test('the rendered Run soles clear the floor between animation keys at every playable LOD', async () => {
  const files = [...RIG_VARIANTS.map(variant => variant.directory), ARMED_ASSET_DIRECTORY]
    .flatMap(directory => [0, 1, 2].map(lod => `${directory}infantry-demo-lod${lod}.glb`));
  files.push(`${SOURCE_RIG_DIRECTORY}infantry-high.glb`);
  const penetrations = [];
  for (const file of files) {
    const { scene, animations } = await loadGeometry(file);
    const run = animations.find(animation => animation.name === 'run');
    const mesh = scene.getObjectByName('DemoInfantry');
    assert.ok(run && mesh instanceof SkinnedMesh, file);
    const mixer = new AnimationMixer(scene);
    const action = mixer.clipAction(run).setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const position = mesh.geometry.getAttribute('position');
    const vertex = new Vector3();
    const minima = [Infinity, Infinity];
    const steps = Math.round(run.duration * 240);
    for (let frame = 0; frame <= steps; frame++) {
      mixer.setTime(run.duration * frame / steps);
      scene.updateMatrixWorld(true);
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        if (vertex.y > .10) continue; // Both boots fit below this bind-pose height.
        const side = vertex.x < 0 ? 0 : 1;
        mesh.applyBoneTransform(i, vertex).applyMatrix4(mesh.matrixWorld);
        minima[side] = Math.min(minima[side], vertex.y);
      }
    }
    // Allow 0.19 mm of float error and check that both boots still approach the ground.
    assert.ok(minima.every(height => height < .003), `${file}: missing sole contact`);
    if (minima.some(height => height < -.00005)) {
      penetrations.push(`${file}: ${minima.map(height => (height * METERS_PER_UNIT * 1000).toFixed(2)).join(' / ')} mm`);
    }
  }
  assert.deepEqual(penetrations, []);
});
