import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {browser,sleep,until} from './cdp.mjs';
const app=await browser({software:false,width:1440,height:900}),frames='.tools/playground-video';mkdirSync(frames,{recursive:true});
try {
 await app.send('Page.navigate',{url:(process.env.LAB_ORIGIN||'http://127.0.0.1:3000')+'/?demo=infantry'});
 await until(()=>app.evaluate('window.__infantryDemo?.inspect()?.ready'));await sleep(800);
 await app.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyS',key:'s'});
 const start=performance.now();
 for(let frame=0;frame<120;frame++) {
  if(frame%24===0)await app.evaluate(`window.__infantryDemo.configure({skin:'${['original','urban','arctic','desert','assault'][frame/24]}',lod:${frame>=72?0:2}})`);
  await sleep(Math.max(0,start+frame*(1000/15)-performance.now()));
  await app.screenshot(`${frames}/${String(frame).padStart(4,'0')}.png`);
 }
 await app.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyS',key:'s'});
 const result=spawnSync('ffmpeg',['-y','-v','error','-threads','2','-filter_threads','1','-framerate','15','-i',frames+'/%04d.png','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-crf','20','docs/infantry/playground/demo-running.mp4'],{windowsHide:true});
 if(result.status!==0)throw Error(String(result.stderr));
 console.log('Recorded playable demo preview (15 fps capture, not an FPS benchmark)');
} finally {await app.close();}
