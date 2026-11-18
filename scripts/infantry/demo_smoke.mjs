import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browser, sleep, until } from './cdp.mjs';
const dest='docs/infantry/playground';mkdirSync(dest+'/images',{recursive:true});
const app=await browser({software:process.argv.includes('--software'),width:1440,height:900});
try {
 await app.send('Page.navigate',{url:(process.env.LAB_ORIGIN||'http://127.0.0.1:3000')+'/?demo=infantry'});
 await until(()=>app.evaluate('window.__infantryDemo?.inspect()?.ready'),45000);
 await sleep(1000);
 if(process.argv.includes('--preview')) {await app.screenshot(dest+'/images/demo-preview.png');console.log(await app.evaluate('window.__infantryDemo.inspect()'));}
 else {
 const inspect=()=>app.evaluate('window.__infantryDemo.inspect()');
 const key=(code,type='keyDown')=>app.send('Input.dispatchKeyEvent',{type,code,key:({Space:' ',ShiftLeft:'Shift',AltLeft:'Alt'})[code]||code.replace('Key','').toLowerCase()});
 const start=await inspect();assert.equal(start.lod,2);assert.equal(start.triangles,999);assert.equal(start.missionMounted,false);
 await app.screenshot(dest+'/images/demo-original.png');
 await key('KeyW');await sleep(1300);const run=await inspect();assert.equal(run.animation,'run');assert.ok(Math.hypot(run.position[0]-start.position[0],run.position[2]-start.position[2])>.5);
 await app.screenshot(dest+'/images/demo-run.png');
 await key('ShiftLeft');await sleep(400);const sprint=await inspect();assert.ok(sprint.speedMeters>3.8);await key('ShiftLeft','keyUp');
 await key('KeyW','keyUp');await sleep(600);assert.equal((await inspect()).animation,'idle');
 await key('Space');await key('Space','keyUp');await sleep(160);const jump=await inspect();assert.equal(jump.grounded,false);assert.ok(jump.position[1]>.03);
 await app.screenshot(dest+'/images/demo-jump.png');await sleep(800);assert.equal((await inspect()).grounded,true);
 await key('KeyC');await key('KeyC','keyUp');await sleep(300);assert.equal((await inspect()).animation,'crouch');await app.screenshot(dest+'/images/demo-crouch.png');
 await key('KeyW');await sleep(400);assert.equal((await inspect()).animation,'crouchWalk');await key('KeyW','keyUp');await key('KeyC');await key('KeyC','keyUp');await sleep(300);
 await key('AltLeft');await key('KeyW');await sleep(500);const walk=await inspect();assert.equal(walk.animation,'walk');assert.ok(walk.speedMeters<1.5);await key('KeyW','keyUp');await key('AltLeft','keyUp');await sleep(500);
 await app.evaluate('window.__infantryDemo.reset()');await sleep(300);
 await app.evaluate("document.querySelector('[data-testid=\"inspect-front\"]').click()");await sleep(300);
 const skins=[];
 for(const skin of ['original','urban','arctic','desert','assault']) {
  await app.evaluate(`document.querySelector('[data-testid="skin-${skin}"]').click()`);await until(()=>app.evaluate(`window.__infantryDemo.inspect()?.skin==='${skin}'`));await sleep(300);
  await app.screenshot(`${dest}/images/skin-${skin}.png`);skins.push(await inspect());
 }
 // Actual pixels must differ; a label-only skin switch is not enough.
 const pixels=skin=>{const r=spawnSync('ffmpeg',['-v','error','-threads','2','-i',`${dest}/images/skin-${skin}.png`,'-vf','crop=650:650:250:130','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024,windowsHide:true});assert.equal(r.status,0,String(r.stderr));return r.stdout;};
 const original=pixels('original'),arctic=pixels('arctic');let changed=0;
 for(let i=0;i<original.length;i+=3)if(Math.abs(original[i]-arctic[i])+Math.abs(original[i+1]-arctic[i+1])+Math.abs(original[i+2]-arctic[i+2])>45)changed++;
 assert.ok(changed>2000,`Skins do not visibly change: ${changed}`);
 const lods=[];const position=(await inspect()).position;
 for(const lod of [0,1,2,0,1,2]) {
  await app.evaluate(`window.__infantryDemo.configure({lod:${lod}})`);await until(()=>app.evaluate(`window.__infantryDemo.inspect()?.lod===${lod}`));await sleep(250);
  const data=await inspect();assert.deepEqual(data.position,position);assert.equal(data.triangles,[3999,1999,999][lod]);lods.push(data);
 }
 const stable=await inspect();for(const lod of [0,1,2]){await app.evaluate(`window.__infantryDemo.configure({lod:${lod}})`);await sleep(200);}
 const after=await inspect();assert.equal(after.geometries,stable.geometries);assert.equal(after.textures,stable.textures);
 for(const quality of ['low','balanced','high','ultra']){await app.evaluate(`window.__infantryDemo.configure({quality:'${quality}'})`);await sleep(200);}
 await app.evaluate("window.__infantryDemo.configure({skin:'urban',lod:2,quality:'balanced'})");await sleep(300);await app.screenshot(dest+'/images/demo-final.png');
 assert.equal(app.errors.length,0,JSON.stringify(app.errors).slice(0,4000));
 writeFileSync(dest+'/browser-smoke.json',JSON.stringify({createdAt:new Date().toISOString(),passed:true,start,run,sprint,jump,walk,skins,lods,changedSkinPixels:changed,final:await inspect(),errors:app.errors,limitations:['Static yard and single controlled hero; not a crowd performance measurement','Physical mobile QA not verified']},null,2));
 console.log('PASS demo: real movement, sprint/walk, jump landing, crouch locomotion, five visible skins, three LODs, bounded resources');
 }
} finally {await app.close();}
