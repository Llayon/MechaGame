import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SKINS } from './heroAssets';
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
test('playable LODs preserve source maps and faces, and contain finite normalized rig data',()=>{
  for(const level of [0,1,2]) {
    const source=readGlb(`public/assets/infantry-candidate/infantry-candidate-lod${level}.glb`);
    const rig=readGlb(`public/assets/infantry-candidate/demo/infantry-demo-lod${level}.glb`),p=rig.json.meshes[0].primitives[0];
    assert.equal(rig.json.meshes.length,1);assert.equal(rig.json.skins[0].joints.length,14);
    assert.equal(rig.json.accessors[p.indices].count/3,[3999,1999,999][level]);assert.deepEqual(rig.maps(),source.maps());
    assert.deepEqual(new Set(rig.json.animations.map((a:{name:string})=>a.name)),new Set(['idle','walk','run','crouch','crouchWalk','jump']));
    for(const name of ['POSITION','NORMAL','TANGENT','TEXCOORD_0','JOINTS_0','WEIGHTS_0']) assert.ok(rig.accessor(p.attributes[name]).every(Number.isFinite));
    const weights=rig.accessor(p.attributes.WEIGHTS_0);
    for(let i=0;i<weights.length;i+=4) {
      assert.ok(Math.abs(weights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-5);
      assert.ok(weights.slice(i,i+4).filter(w=>w>1e-6).length<=2);
    }
  }
});
test('locomotion loops close and skin palettes have stable unique identifiers',()=>{
  const rig=readGlb('public/assets/infantry-candidate/demo/infantry-demo-lod2.glb');
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
