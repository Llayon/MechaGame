import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SKINS, ARMED_ASSET_DIRECTORY, HERO_ASSET_DIRECTORY, RIG_VARIANTS } from './heroAssets';
function readGlb(path: string) {
  const bytes = readFileSync(path), length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20,20+length).toString());
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const view = (id: number) => { const v=json.bufferViews[id];return bytes.subarray(28+length+(v.byteOffset??0),28+length+(v.byteOffset??0)+v.byteLength); };
  const accessor = (id: number) => {
    const a=json.accessors[id], v=json.bufferViews[a.bufferView], width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4} as Record<string,number>)[a.type];
    const size=a.componentType===5126?4:a.componentType===5123?2:1;
    return Array.from({length:a.count*width},(_,i)=>{
      const offset=28+length+(v.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/width)*(v.byteStride??width*size)+(i%width)*size;
      return a.componentType===5126?bytes.readFloatLE(offset):a.componentType===5123?bytes.readUInt16LE(offset):bytes.readUInt8(offset);
    });
  };
  const maps = () => {
    const m=json.materials[0];
    return [m.pbrMetallicRoughness.baseColorTexture.index,m.pbrMetallicRoughness.metallicRoughnessTexture.index,m.normalTexture.index].map(i=>
      createHash('sha256').update(view(json.images[json.textures[i].source].bufferView)).digest('hex'));
  };
  return {json,accessor,maps};
}

test('V-Pulse LODs share a normalized grip, a single material and the same attachment markers', () => {
  const path = 'public/assets/infantry-vpulse/';
  const manifest = JSON.parse(readFileSync(path + 'manifest.json', 'utf8'));
  let length = 0;
  for (const [name, budget] of [['close', 4000], ['crowd', 600]] as const) {
    const variant = manifest.variants[name];
    const { json, accessor } = readGlb(path + variant.file);
    const primitive = json.meshes[0].primitives[0];
    assert.equal(json.materials.length, 1);
    assert.equal(json.meshes.length, 1);
    assert.equal(json.meshes[0].primitives.length, 1);
    assert.equal(json.accessors[primitive.indices].count / 3, variant.triangles);
    assert.ok(variant.triangles <= budget);
    assert.ok(accessor(primitive.attributes.POSITION).every(Number.isFinite));
    for (const [marker, expected] of Object.entries(manifest.markers)) {
      const node = json.nodes.find((n: { name: string }) => n.name === marker);
      assert.ok(node, marker);
      assert.deepEqual(node.translation ?? node.matrix?.slice(12, 15) ?? [0, 0, 0], expected);
    }
    const bounds = json.accessors[primitive.attributes.POSITION];
    const span = bounds.max[2] - bounds.min[2];
    assert.ok(span > .20 && span < .24);
    if (length) assert.ok(Math.abs(span - length) < .001);
    length = span;
  }
});

test('armed assets keep body geometry and materials, with a shared rigid hand attachment and timed fire clip', () => {
  const path = `public/${ARMED_ASSET_DIRECTORY}`;
  const manifest = JSON.parse(readFileSync(path + 'manifest.json', 'utf8'));
  const { position, quaternion } = manifest.weaponGrip;
  assert.ok(position.length === 3 && position.every(Number.isFinite));
  assert.ok(quaternion.length === 4 && Math.abs(Math.hypot(...quaternion) - 1) < 1e-5);
  assert.ok(manifest.supportGrip.position.length === 3 && manifest.supportGrip.position.every(Number.isFinite));
  const fire = manifest.clips.find((clip: { name: string }) => clip.name === 'fire');
  assert.ok(fire.muzzleTime > 0 && fire.muzzleTime < fire.duration && !fire.loop);
  for (const [level, triangles] of [3999, 1999, 999].entries()) {
    const original = readGlb(`public/${HERO_ASSET_DIRECTORY}infantry-demo-lod${level}.glb`);
    const armed = readGlb(`${path}infantry-demo-lod${level}.glb`);
    const primitive = armed.json.meshes[0].primitives[0];
    assert.equal(armed.json.meshes.length, 1);
    assert.equal(armed.json.accessors[primitive.indices].count / 3, triangles);
    assert.deepEqual(armed.maps(), original.maps());
    const bones = armed.json.skins[0].joints.map((index: number) => armed.json.nodes[index].name);
    assert.ok(bones.includes('hand_R') && bones.includes('hand_L'));
    for (const clip of manifest.clips) {
      const animation = armed.json.animations.find((item: { name: string }) => item.name === clip.name);
      assert.ok(animation, clip.name);
      const times = armed.accessor(animation.samplers[0].input);
      assert.equal(times[0], 0);
      assert.ok(Math.abs(times.at(-1)! - clip.duration) < .001, clip.name);
    }
  }
});
test('playable LODs preserve source maps and faces, and contain finite normalized rig data',()=>{
  for(const variant of RIG_VARIANTS) for(const level of [0,1,2]) {
    const source=readGlb(`public/assets/infantry-candidate/infantry-candidate-lod${level}.glb`);
    const rig=readGlb(`public/${variant.directory}infantry-demo-lod${level}.glb`),p=rig.json.meshes[0].primitives[0];
    assert.equal(rig.json.meshes.length,1);assert.equal(rig.json.skins[0].joints.length,variant.bones);
    assert.equal(rig.json.accessors[p.indices].count/3,[3999,1999,999][level]);assert.deepEqual(rig.maps(),source.maps());
    assert.deepEqual(new Set(rig.json.animations.map((a:{name:string})=>a.name)),new Set(['idle','walk','run','crouch','crouchWalk','jump','kneel']));
    const manifest=JSON.parse(readFileSync(`public/${variant.directory}manifest.json`,'utf8'));
    for(const clip of rig.json.animations) {
      const duration=manifest.clips.find((c:{name:string})=>c.name===clip.name).duration;
      for(const sampler of clip.samplers) {
        const times=rig.accessor(sampler.input);
        assert.equal(times[0],0,`${variant.id}/${clip.name}: leading unanimated frame`);
        assert.ok(Math.abs(times.at(-1)!-duration)<1e-5,`${variant.id}/${clip.name}: timing mismatch`);
      }
    }
    for(const name of ['POSITION','NORMAL','TANGENT','TEXCOORD_0','JOINTS_0','WEIGHTS_0']) assert.ok(rig.accessor(p.attributes[name]).every(Number.isFinite));
    const weights=rig.accessor(p.attributes.WEIGHTS_0);
    for(let i=0;i<weights.length;i+=4) {
      assert.ok(Math.abs(weights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-5);
      assert.ok(weights.slice(i,i+4).filter(w=>w>1e-6).length<=2);
    }
  }
});
test('Rigify comparisons share motion timing and bind poses, but retain distinct axial rotations',()=>{
  const variants=RIG_VARIANTS.filter(r=>r.id!=='mixamo');
  const manifests=variants.map(r=>JSON.parse(readFileSync(`public/${r.directory}manifest.json`,'utf8')));
  assert.equal(manifests[0].rigifyVariant,'standard');assert.equal(manifests[1].rigifyVariant,'preserved-twist');
  assert.deepEqual(manifests[0].clips,manifests[1].clips);
  const models=variants.map(r=>readGlb(`public/${r.directory}infantry-demo-lod2.glb`));
  assert.deepEqual(models[0].accessor(models[0].json.skins[0].inverseBindMatrices),models[1].accessor(models[1].json.skins[0].inverseBindMatrices));
  for(const model of models) {
    const names=model.json.skins[0].joints.map((i:number)=>model.json.nodes[i].name);
    assert.ok(names.includes('hand_L')&&names.includes('hand_R')&&names.includes('toe_L')&&names.includes('toe_R'));
    assert.ok(names.every((n:string)=>!n.startsWith('MCH-')&&!n.startsWith('ORG-')&&!n.includes('_fk')));
  }
  const rotations=models.map(model=>{
    const clip=model.json.animations.find((a:{name:string})=>a.name==='run');
    const channel=clip.channels.find((c:{target:{node:number;path:string}})=>model.json.nodes[c.target.node].name==='upperarm_L'&&c.target.path==='rotation');
    return model.accessor(clip.samplers[channel.sampler].output);
  });
  assert.ok(rotations[0].some((v,i)=>Math.abs(v-rotations[1][i])>.01));
});
test('locomotion loops close and skin palettes have stable unique identifiers',()=>{
  const rig=readGlb(`public/${HERO_ASSET_DIRECTORY}infantry-demo-lod2.glb`);
  for(const animation of rig.json.animations.filter((a:{name:string})=>a.name!=='jump')) {
    for(const channel of animation.channels) {
      const sampler=animation.samplers[channel.sampler],a=rig.json.accessors[sampler.output],width=a.type==='VEC4'?4:3,values=rig.accessor(sampler.output);
      const first=values.slice(0,width),last=values.slice(-width);
      if(width===4) assert.ok(Math.abs(Math.abs(first.reduce((sum,v,i)=>sum+v*last[i],0))-1)<.002,animation.name);
      else assert.ok(first.every((v,i)=>Math.abs(v-last[i])<1e-5),animation.name);
    }
  }
  assert.equal(SKINS.length,5);assert.equal(new Set(SKINS.map(s=>s.id)).size,5);
  assert.ok(SKINS.every(s=>/^#[a-f0-9]{6}$/i.test(s.color)&&/^#[a-f0-9]{6}$/i.test(s.accent)));
});
test('runtime motions preserve verified Mixamo provenance and selected FBX sources',()=>{
  const manifest=JSON.parse(readFileSync(`public/${HERO_ASSET_DIRECTORY}manifest.json`,'utf8'));
  assert.equal(manifest.animationSource,'mixamo-retargeted-core');
  assert.equal(manifest.mixamoSource.sha256,'002f8d269de68e5dce3d25195caf390d1aa359bbfaae3fcf4c8dc78ec36c3ba5');
  for(const name of ['idle','walk','run']) {
    const clip=manifest.clips.find((c:{name:string})=>c.name===name);
    assert.equal(clip.source,'mixamo');assert.equal(clip.sourceClip,name);assert.equal(clip.sourceSha256,manifest.mixamoSource.sha256);
    if(name!=='idle')assert.ok(clip.movementSpeed>.1&&clip.movementSpeed<1.5);
  }
  assert.deepEqual(manifest.pendingMixamoClips,[]);
  for(const name of ['crouch','crouchWalk','jump','kneel']) {
    const clip=manifest.clips.find((c:{name:string})=>c.name===name);
    assert.equal(clip.source,'mixamo');assert.ok(clip.sourceClip.endsWith('.fbx'));
    const source=manifest.userMotionSources.find((s:{originalSha256:string})=>s.originalSha256===clip.sourceSha256);
    const bytes=readFileSync(source.asset);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.animationOnlySha256);
    assert.ok(bytes.length<source.originalBytes/3,'Donor mesh/textures must be stripped');
  }
  const jump=manifest.clips.find((c:{name:string})=>c.name==='jump');
  assert.equal(jump.verticalRootMotion,'controller');assert.ok(jump.maximumLiftRemovedUnits>.05);
  assert.ok(Math.abs(jump.duration-2*.88/(9.81/3.75))<1/30,'Jump track must match controller airtime');
  const rig=readGlb(`public/${HERO_ASSET_DIRECTORY}infantry-demo-lod2.glb`),old=readGlb('public/assets/infantry-candidate/demo/infantry-demo-lod2.glb');
  for(const name of ['idle','walk','run']) {
    const a=rig.json.animations.find((a:{name:string})=>a.name===name),b=old.json.animations.find((a:{name:string})=>a.name===name);
    const tracks=(model:ReturnType<typeof readGlb>,animation:typeof a)=>animation.channels.map((c:{target:{node:number;path:string};sampler:number})=>({
      node:model.json.nodes[c.target.node].name,path:c.target.path,values:model.accessor(animation.samplers[c.sampler].output),
    }));
    assert.notEqual(JSON.stringify(tracks(rig,a)),JSON.stringify(tracks(old,b)));
  }
});
