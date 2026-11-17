import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/** Browser smoke on actual mounted R3F scene. Not a hardware FPS benchmark. */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,ms,message){
  const end=Date.now()+ms; let last;
  while(Date.now()<end){
    try {const result=await fn(); if(result)return result;}
    catch(e){last=e;}
    await sleep(180);
  }
  throw Error(message+(last?' '+String(last):''));
}
const profile=mkdtempSync(join(tmpdir(),'mecha-aim-'));
const chrome=spawn(process.env.CHROME||'google-chrome',[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader','--use-angle=swiftshader-webgl',
  '--disable-background-networking','--no-first-run',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank',
],{stdio:'ignore'});
let ws;
let lastAim;
try{
  const port=await waitFor(()=>{
    try{return readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];}
    catch{return null;}
  },15000,'Chrome debugging port unavailable');
  const target=await waitFor(async()=>{
    const all=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
    return all.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
  },15000,'Chrome CDP target unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  const pending=new Map();let seq=0;
  ws.addEventListener('message',e=>{
    const msg=JSON.parse(e.data),p=pending.get(msg.id);
    if(!p)return;
    pending.delete(msg.id);
    msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
  });
  function send(method,params={}){
    const id=++seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},12000);
      pending.set(id,{
        resolve:v=>{clearTimeout(timer);resolve(v);},
        reject:e=>{clearTimeout(timer);reject(e);},
      });
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evalBrowser(expression){
    const r=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
  async function aim(){lastAim=await evalBrowser('window.__mechaAimDebug?.()');return lastAim;}
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    {width:1280,height:768,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',
    {url:'http://127.0.0.1:4173/?autostart=1&benchmark=1&debugAim=1'});
  await waitFor(async()=>await evalBrowser(
    'Boolean(window.__mechaAimDebug && document.body.dataset.state==="playing" && document.querySelector("canvas") && document.querySelector("[data-testid=combat-reticle]"))'),
    45000,'Combat scene, canvas or reticle did not mount');
  const sceneBaseline = await waitFor(async()=>await evalBrowser(
    '(()=>{const s=window.__mechaSceneAudit?.();return s?.total?.visibleMeshes>30 && s?.groups?.structures && s?.groups?.mech ? s : null;})()'
  ),12000,'Per-system scene complexity inventory did not mount');
  console.log('SCENE INVENTORY baseline',
    JSON.stringify({ meshes:sceneBaseline.total.visibleMeshes,
      triangles:sceneBaseline.total.estimatedTriangles,
      sections:Object.keys(sceneBaseline.groups) }));
  const point=await evalBrowser('(function(){const r=document.querySelector("[data-testid=map-canvas-container] canvas").getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()');
  const origin=await aim();
  console.log('INITIAL',JSON.stringify(origin));
  const getReticles = '(()=>{const primary=document.querySelector("[data-testid=combat-reticle]");const secondary=document.querySelector("[data-testid=muzzle-direction-indicator]");if(!primary||!secondary)return null;const b=primary.getBoundingClientRect();return {centerX:b.left+b.width/2,centerY:b.top+b.height/2,viewportX:innerWidth/2,viewportY:innerHeight/2,primaryInlineLeft:primary.style.left,primaryInlineTop:primary.style.top,secondaryPresent:!!secondary,secondaryRole:secondary.getAttribute("data-testid")};})()';
  const initialMarkers=await evalBrowser(getReticles);
  if(!initialMarkers || !initialMarkers.secondaryPresent ||
      Math.abs(initialMarkers.centerX-initialMarkers.viewportX)>2 ||
      Math.abs(initialMarkers.centerY-initialMarkers.viewportY)>2) {
    throw Error('Primary crosshair is not fixed at screen center, or secondary cue missing: '+JSON.stringify(initialMarkers));
  }
  await send('Input.dispatchMouseEvent',
    {type:'mouseMoved',x:point.x,y:point.y,button:'none'});
  await send('Input.dispatchMouseEvent',
    {type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await waitFor(async()=>(await aim())?.pointerFire,5000,'Left click did not set weapon trigger');
  await waitFor(async()=>(await aim())?.pointerLocked,12000,'Trusted canvas click failed to capture pointer');
  await send('Input.dispatchMouseEvent',
    {type:'mouseMoved',x:point.x+160,y:point.y-100,button:'left'});
  await waitFor(async()=>{
    const a=await aim();
    return a&&(a.aimYaw<origin.aimYaw-0.005||a.pendingYaw< -0.005)
      &&(a.elevation>origin.elevation+0.005||a.pendingElevation>0.005);
  },20000,'Mouse-right must rotate view right (negative world yaw) and mouse-up lift aim');
  const movedMarkers=await evalBrowser(getReticles);
  if(!movedMarkers ||
      Math.abs(movedMarkers.centerX-initialMarkers.centerX)>1 ||
      Math.abs(movedMarkers.centerY-initialMarkers.centerY)>1 ||
      movedMarkers.primaryInlineLeft!=='' || movedMarkers.primaryInlineTop!=='') {
    throw Error('Main crosshair moved with camera or physical barrel: '+JSON.stringify(movedMarkers));
  }
  await send('Input.dispatchMouseEvent',
    {type:'mouseReleased',x:point.x+160,y:point.y-100,button:'left',clickCount:1});
  await waitFor(async()=>!(await aim())?.pointerFire,5000,'LMB fire stuck after release');

  // Right mouse button zoom/precision mode controls the same camera and muzzle.
  await send('Input.dispatchMouseEvent',
    {type:'mousePressed',x:point.x+160,y:point.y-100,button:'right',clickCount:1});
  await waitFor(async()=>(await aim())?.precise,15000,
    'RMB was not applied to precision aim');
  await send('Input.dispatchMouseEvent',
    {type:'mouseReleased',x:point.x+160,y:point.y-100,button:'right',clickCount:1});
  await waitFor(async()=>!(await aim())?.precise,15000,
    'Precision aim remained held after RMB release');

  // Escape should release the mouse without leaving active combat.
  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Escape",key:"Escape",bubbles:true}))');
  await waitFor(async()=>await evalBrowser(
    'document.body.dataset.state==="playing" && !document.pointerLockElement'),
    12000,'Escape did not release pointer while retaining combat');
  // Re-capture for the pause/unlock test.
  await send('Input.dispatchMouseEvent',
    {type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await waitFor(async()=>(await aim())?.pointerLocked,12000,
    'Could not recapture mouse after Escape');
  await send('Input.dispatchMouseEvent',
    {type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});

  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyP",key:"p",bubbles:true}))');
  await waitFor(async()=>await evalBrowser(
    'document.body.dataset.state==="paused" && !document.pointerLockElement'),
    12000,'Pause did not unlock mouse');
  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyP",key:"p",bubbles:true}))');
  await waitFor(async()=>await evalBrowser('document.body.dataset.state==="playing"'),
    12000,'Resume failed');
  await send('Emulation.setDeviceMetricsOverride',
    {width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await waitFor(async()=>await evalBrowser(
    'Boolean(document.querySelector("[data-testid=mobile-aim-zone]"))'),
    15000,'Touch aim zone did not mount');
  const before=await aim();
  await evalBrowser('(function(){const z=document.querySelector("[data-testid=mobile-aim-zone]");const mk=(t,x,y)=>new PointerEvent(t,{bubbles:true,pointerType:"touch",pointerId:7,isPrimary:true,clientX:x,clientY:y});z.dispatchEvent(mk("pointerdown",325,380));z.dispatchEvent(mk("pointermove",365,330));z.dispatchEvent(mk("pointerup",365,330));})()');
  await waitFor(async()=>{
    const a=await aim();
    return a&&a.aimYaw<before.aimYaw-0.01&&a.elevation>before.elevation+0.01;
  },25000,'Touch swipe-right must rotate right (negative yaw); swipe-up lifts aim');
  // Verify GRAPHICS controls on the mounted, running game; never just a static menu.
  await evalBrowser('document.querySelector("[data-testid=graphics-open]").click()');
  await waitFor(async()=>await evalBrowser(
    'Boolean(document.querySelector("[data-testid=graphics-settings-dialog]")) && document.body.dataset.state==="paused" && !document.pointerLockElement'
  ),12000,'Opening graphics menu did not pause combat and release mouse');
  await evalBrowser('document.querySelector("[data-testid=graphics-preset-low]").click()');
  await waitFor(async()=>await evalBrowser(
    '(()=>{const c=document.querySelector("[data-testid=map-canvas-container]");return c?.dataset.graphicsPreset==="low" && c.dataset.shadows==="off" && Number(c.dataset.renderDpr)<=0.7 && c.dataset.shadowMapSize==="0";})()'
  ),15000,'Low preset did not change actual R3F scene DPR/shadow configuration');
  const sceneLow = await evalBrowser('window.__mechaSceneAudit?.()');
  if (!sceneLow || sceneLow.total.estimatedTriangles >= sceneBaseline.total.estimatedTriangles) {
    throw Error('Low quality did not reduce visible scene geometry: '+
      JSON.stringify({baseline:sceneBaseline.total.estimatedTriangles,
        low:sceneLow?.total.estimatedTriangles}));
  }
  console.log('SCENE INVENTORY low',
    JSON.stringify({ meshes:sceneLow.total.visibleMeshes,
      triangles:sceneLow.total.estimatedTriangles }));
  await evalBrowser('document.querySelector("[data-testid=graphics-preset-balanced]").click()');
  await waitFor(async()=>await evalBrowser(
    '(()=>{const c=document.querySelector("[data-testid=map-canvas-container]");return c?.dataset.graphicsPreset==="balanced" && c.dataset.shadows==="on" && Number(c.dataset.shadowMapSize)>0;})()'
  ),15000,'Balanced preset did not re-enable render shadows');
  await evalBrowser('document.querySelector("[data-testid=graphics-apply]").click()');
  await waitFor(async()=>await evalBrowser(
    'document.body.dataset.state==="playing" && !document.querySelector("[data-testid=graphics-settings-dialog]")'
  ),12000,'Graphics close did not resume previously running combat');
  const graphicsStored=await evalBrowser('JSON.parse(localStorage.getItem("mech-graphics-v1")).settings.preset');
  if(graphicsStored!=='balanced')throw Error('Graphics preset not persisted: '+graphicsStored);

  // Opening from a user-paused session must NOT accidentally resume gameplay.
  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyP",key:"p",bubbles:true}))');
  await waitFor(async()=>await evalBrowser('document.body.dataset.state==="paused"'),
    12000,'Could not enter user-paused state');
  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyG",key:"g",bubbles:true}))');
  await waitFor(async()=>await evalBrowser(
    'Boolean(document.querySelector("[data-testid=graphics-settings-dialog]"))'
  ),12000,'G did not open graphics menu from pause');
  await evalBrowser('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Escape",key:"Escape",bubbles:true}))');
  await waitFor(async()=>await evalBrowser(
    'document.body.dataset.state==="paused" && !document.querySelector("[data-testid=graphics-settings-dialog]")'
  ),12000,'Escape must close settings without resuming user-paused combat');
  console.log('GRAPHICS-SETTINGS-PASS live:R3F-preset-DPR-shadows, pause:restore, storage:save, G/Escape');
  console.log('GAMEPLAY-AIM-PASS desktop:pointerlock+mouseXY+LMB+RMB+Escape, pause:unlock, touch:swipeXY, crosshair:fixed, muzzle:separate');
  console.log('FINAL',JSON.stringify(await aim()));
}catch(e){
  console.error('GAMEPLAY-AIM-FAIL',String(e));
  console.error('LAST AIM',JSON.stringify(lastAim));
  throw e;
}finally{
  ws?.close();
  chrome.kill('SIGTERM');await sleep(200);
  try{rmSync(profile,{force:true,recursive:true});}catch{}
}
