import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {browser,sleep,until} from './cdp.mjs';
const app=await browser({software:false,width:420,height:920});
try {
 await app.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await app.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await app.send('Page.navigate',{url:(process.env.LAB_ORIGIN||'http://127.0.0.1:3000')+'/?demo=infantry'});
 await until(()=>app.evaluate('window.__infantryDemo?.inspect()?.ready'));await sleep(700);
 const layout=await app.evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,touch:getComputedStyle(document.querySelector('.play-touch')).display,menu:document.querySelector('.play-wardrobe').classList.contains('closed')})`);
 assert.equal(layout.width,390);assert.ok(layout.scrollWidth<=390);assert.notEqual(layout.touch,'none');assert.equal(layout.menu,true);
 const start=await app.evaluate('window.__infantryDemo.inspect()');
 const stick=await app.evaluate(`(()=>{const r=document.querySelector('.play-stick').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const touch=(type,x,y)=>app.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:5,radiusY:5}]});
 await touch('touchStart',stick.x,stick.y);await touch('touchMove',stick.x,stick.y-30);await sleep(900);const moving=await app.evaluate('window.__infantryDemo.inspect()');
 assert.ok(Math.hypot(moving.position[0]-start.position[0],moving.position[2]-start.position[2])>.2);await touch('touchEnd',stick.x,stick.y-30);await sleep(500);
 assert.equal((await app.evaluate('window.__infantryDemo.inspect()')).animation,'idle');
 await app.screenshot('docs/infantry/playground/images/demo-mobile.png');
 await app.evaluate("document.querySelector('.play-menu-toggle').click();document.querySelector('[data-testid=skin-arctic]').click()");await sleep(300);
 assert.equal((await app.evaluate('window.__infantryDemo.inspect()')).skin,'arctic');await app.screenshot('docs/infantry/playground/images/demo-mobile-menu.png');
 assert.equal(app.errors.length,0,JSON.stringify(app.errors));
 writeFileSync('docs/infantry/playground/mobile-smoke.json',JSON.stringify({createdAt:new Date().toISOString(),passed:true,emulatedViewportOnly:true,physicalDeviceVerified:false,layout,start,moving,errors:app.errors},null,2));
 console.log('PASS touch viewport: layout, actual pointer joystick movement, release, skin menu (not a physical phone test)');
} finally {await app.close();}
