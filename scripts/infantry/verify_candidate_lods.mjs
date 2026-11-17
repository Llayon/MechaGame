import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { browser, until } from './cdp.mjs';

const root='public/assets/infantry-candidate', doc='docs/infantry/candidate-lods';
const metrics=JSON.parse(readFileSync(`${doc}/metrics.json`));
assert.equal(createHash('sha256').update(readFileSync(`${root}/source.glb`)).digest('hex'),metrics.sourceSha256);
const assets=[];
for(const lod of metrics.lods) {
  const bytes=readFileSync(`${root}/${lod.glb}`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  assert.equal(json.meshes.length,1);assert.equal(json.materials.length,1);assert.equal(json.images.length,3);
  assert.ok(json.materials[0].normalTexture);assert.ok(json.materials[0].pbrMetallicRoughness.baseColorTexture);
  assert.ok(json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture);
  const p=json.meshes[0].primitives[0];assert.equal(json.accessors[p.indices].count/3,lod.triangles);
  for(const attr of ['POSITION','NORMAL','TANGENT','TEXCOORD_0']) {
    const a=json.accessors[p.attributes[attr]], view=json.bufferViews[a.bufferView];
    assert.equal(a.componentType,5126);
    const width=({VEC2:2,VEC3:3,VEC4:4})[a.type];
    for(let i=0;i<a.count;i++) {
      const values=Array.from({length:width},(_,c)=>bytes.readFloatLE(28+jsonLength+(view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??width*4)+c*4));
      assert.ok(values.every(Number.isFinite));
      if(attr==='NORMAL'||attr==='TANGENT') assert.ok(Math.abs(Math.hypot(...values.slice(0,3))-1)<.002,`LOD${lod.level} ${attr} ${i}: ${values}`);
    }
  }
  assert.ok(bytes.length<readFileSync(`${root}/source.glb`).length);
  assets.push({level:lod.level,triangles:lod.triangles,glbBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
mkdirSync('.tools/candidate-web',{recursive:true});
await build({entryPoints:['scripts/infantry/candidate_browser_entry.mjs'],outfile:'.tools/candidate-web/app.js',bundle:true,format:'esm',logLevel:'silent'});
const html='<!doctype html><meta charset="utf-8"><title>Candidate LOD normal-map smoke</title><body style="margin:0;background:#18212b"><script type="module" src="/app.js"></script>';
const absolute=resolve(root);
const server=createServer((request,response)=>{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(path==='/') { response.setHeader('Content-Type','text/html');response.end(html);return; }
  if(path==='/app.js') { response.setHeader('Content-Type','text/javascript');response.end(readFileSync('.tools/candidate-web/app.js'));return; }
  const target=resolve(absolute,'.'+path.replace(/^\/assets/,''));
  if(!path.startsWith('/assets/')||!target.startsWith(absolute+sep)) {response.writeHead(404);response.end();return;}
  try { response.end(readFileSync(target)); } catch {response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;process.env.LAB_ORIGIN=origin;
let app;
try {
  app=await browser({software:false,width:820,height:850});
  await app.send('Page.navigate',{url:origin});
  await until(()=>app.evaluate('window.__candidateAssetTest?.ready'),45000);
  const smoke=await app.evaluate('window.__candidateAssetTest');assert.ok(!smoke.error,smoke.error);
  for(const r of smoke.reports) {
    assert.equal(r.triangles,metrics.lods[r.level].triangles);assert.equal(r.calls,1);
    assert.ok(r.changedNormalPixels>1000);assert.ok(r.hasTangents);assert.equal(r.normalColorSpace,'');
    assert.ok(r.textureSizes.every(size=>size[0]===metrics.lods[r.level].textureResolution&&size[1]===size[0]));
  }
  assert.equal(smoke.reports[0].geometries,smoke.reports.at(-1).geometries);
  assert.equal(smoke.reports[0].textures,smoke.reports.at(-1).textures);
  assert.equal(app.errors.length,0,JSON.stringify(app.errors));
  await app.screenshot(`${doc}/images/browser-lod0.png`);
  writeFileSync(`${doc}/verification.json`,JSON.stringify({createdAt:new Date().toISOString(),passed:true,assets,smoke,errors:app.errors,
    limitations:['Static asset shading smoke; not an animation or FPS benchmark','No physical mobile device tested']},null,2));
  console.log('PASS: GLB structure, finite normals/tangents, actual Three.js normal-map shading, LOD resource recycling');
} finally {await app?.close();await new Promise(resolve=>server.close(resolve));}
