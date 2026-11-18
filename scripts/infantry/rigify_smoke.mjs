import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browser, until, sleep } from './cdp.mjs';

const dest='docs/infantry/playground/rigify';
mkdirSync(dest+'/images',{recursive:true});
const app=await browser({software:process.argv.includes('--software'),width:1440,height:900,edge:process.argv.includes('--edge')});
const inspect=()=>app.evaluate('window.__infantryDemo.inspect()');
const configure=patch=>app.evaluate(`window.__infantryDemo.configure(${JSON.stringify(patch)})`);
try {
  await app.send('Page.navigate',{url:(process.env.LAB_ORIGIN||'http://127.0.0.1:3000')+'/?demo=infantry'});
  await until(()=>app.evaluate('window.__infantryDemo?.inspect()?.ready'),45000);
  await configure({lod:0,previewAnimation:'run',paused:true,phase:.2});
  await app.evaluate("document.querySelector('[data-testid=\"inspect-front\"]').click()");
  await sleep(500);
  const poses={},results=[];
  for(const rig of ['rigify','rigifyTwist','mixamo']) {
    await configure({rig});await until(async()=>(await inspect())?.rig===rig);await sleep(350);
    const start=await inspect();
    assert.equal(start.bones,rig==='mixamo'?14:18);assert.equal(start.missionMounted,false);
    assert.ok(Math.abs(start.phase-.2)<1e-5);
    await app.screenshot(`${dest}/images/${rig}-run-phase020.png`);
    poses[rig]=await app.evaluate('window.__infantryDemo.pose()');
    assert.ok(poses[rig].length>3000&&poses[rig].every(Number.isFinite));
    for(const lod of [0,1,2]) for(const animation of ['idle','walk','run','crouch','crouchWalk','jump']) {
      await configure({lod,previewAnimation:animation,paused:true,phase:.4});
      await until(async()=>{const s=await inspect();return s.lod===lod&&s.animation===animation&&Math.abs(s.phase-.4)<1e-5;});
      const pose=await app.evaluate('window.__infantryDemo.pose()');assert.ok(pose.every(Number.isFinite));
      const xs=pose.filter((_,i)=>i%3===0),ys=pose.filter((_,i)=>i%3===1),zs=pose.filter((_,i)=>i%3===2);
      assert.ok(Math.max(...xs)-Math.min(...xs)<.8&&Math.max(...ys)-Math.min(...ys)<.8&&Math.max(...zs)-Math.min(...zs)<.8,'Exploded skin');
      results.push(await inspect());
    }
    await configure({lod:0,previewAnimation:'run',phase:.2});await sleep(150);
  }
  const standard=poses.rigify,twist=poses.rigifyTwist,original=poses.mixamo;
  assert.equal(standard.length,twist.length);
  const delta=standard.reduce((max,v,i)=>Math.max(max,Math.abs(v-twist[i])),0);
  assert.ok(delta>.001,'Variants must have visibly different deformations');
  const restoredDelta=twist.reduce((max,v,i)=>Math.max(max,Math.abs(v-original[i])),0);
  assert.ok(restoredDelta<.0001,`Restored twist changed original motion: ${restoredDelta}`);
  const resourceCycles=[];
  for(let repeat=0;repeat<3;repeat++)for(const rig of ['rigify','rigifyTwist','mixamo']) {
    await configure({rig});await until(async()=>(await inspect())?.rig===rig);await sleep(150);
    // Three uploads each LOD's textures lazily on first render. Warm the same
    // LODs before comparing resource counters across rig replacement cycles.
    for(const lod of [1,2,0]) {await configure({lod});await until(async()=>(await inspect())?.lod===lod);await sleep(80);}
    resourceCycles.push(await inspect());
  }
  for(let i=3;i<resourceCycles.length;i++) {
    assert.equal(resourceCycles[i].textures,resourceCycles[i-3].textures,'Texture growth');
    assert.equal(resourceCycles[i].geometries,resourceCycles[i-3].geometries,'Geometry growth');
  }
  await configure({rig:'rigify',previewAnimation:'run',paused:false,phase:0});
  await until(async()=>(await inspect())?.rig==='rigify');await sleep(300);
  const before=(await inspect()).phase;await sleep(150);assert.notEqual((await inspect()).phase,before,'Animation did not play');
  await configure({paused:true,phase:.25});await sleep(100);
  const paused=(await inspect()).phase;await sleep(200);assert.equal((await inspect()).phase,paused,'Pause does not hold the same pose');
  if(process.argv.includes('--video')) {
    const frames='.tools/rigify-video';mkdirSync(frames,{recursive:true});let index=0;
    for(const rig of ['rigify','rigifyTwist','mixamo']) {
      await configure({rig,previewAnimation:'run',paused:true,phase:0});await until(async()=>(await inspect())?.rig===rig);await sleep(150);
      for(let frame=0;frame<30;frame++) {
        const phase=(frame/15/.7)%1;await configure({phase});await until(async()=>Math.abs((await inspect()).phase-phase)<1e-4);
        await app.screenshot(`${frames}/${String(index++).padStart(4,'0')}.png`);
      }
    }
    const ff=spawnSync('ffmpeg',['-y','-v','error','-threads','2','-framerate','15','-i',frames+'/%04d.png','-filter_threads','1','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-crf','22',dest+'/rigify-comparison.mp4'],{windowsHide:true});
    assert.equal(ff.status,0,String(ff.stderr));
  }
  assert.equal(app.errors.length,0,JSON.stringify(app.errors).slice(0,2000));
  const report={passed:true,createdAt:new Date().toISOString(),browser:process.argv.includes('--edge')?'Edge':'Chrome',software:process.argv.includes('--software'),
    maximumStandardVsTwistVertexComponentDelta:delta,maximumRestoredVsOriginalVertexComponentDelta:restoredDelta,
    results,resourceCycles,errors:app.errors,limitations:['One animated hero, not a GPU crowd performance benchmark','Physical mobile QA not verified','Crouch/crouchWalk/jump are still explicitly attributed prototypes']};
  writeFileSync(`${dest}/browser-${process.argv.includes('--edge')?'edge':'chrome'}.json`,JSON.stringify(report,null,2));
  console.log('PASS Rigify: three variants, 54 LOD/state poses, same-phase pause, finite skinning, independent wrist bones, stable resource cycles',JSON.stringify({delta,restoredDelta}));
} finally {await app.close();}
