import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder='.tools/mixamo';mkdirSync(folder,{recursive:true});
const url='https://raw.githubusercontent.com/mrdoob/three.js/r187/examples/models/gltf/Xbot.glb';
const file=folder+'/Xbot.glb';
if(!existsSync(file)) {
  const response=await fetch(url);if(!response.ok)throw Error('Mixamo example download failed: '+response.status);
  writeFileSync(file,Buffer.from(await response.arrayBuffer()));
}
const bytes=readFileSync(file),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const expected='002f8d269de68e5dce3d25195caf390d1aa359bbfaae3fcf4c8dc78ec36c3ba5';
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Unexpected Xbot source hash; inspect before retargeting');
const report={url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,animations:json.animations.map(a=>a.name),
  attribution:'Mixamo animation source used by the official Three.js r187 skeletal animation example. Donor geometry is not exported into the game.',
  example:'https://threejs.org/examples/webgl_animation_skinning_additive_blending.html',terms:'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html'};
writeFileSync(folder+'/source.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
