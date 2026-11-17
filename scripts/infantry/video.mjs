import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browser, until } from './cdp.mjs';

const app = await browser({ software: false });
try {
  await app.navigate((process.env.LAB_ORIGIN || 'http://127.0.0.1:3000') + '/?lab=infantry');
  for (const count of [20, 100, 200]) {
    await app.evaluate(`window.__infantryLab.configure({count:${count},animation:'mixed',individualPhases:true,batches:1,shadows:false,camera:'medium'})`);
    await until(() => app.evaluate(`window.__infantryLab.inspect()?.settings.count===${count}`));
    const frames = `.tools/infantry-video-${count}`; mkdirSync(frames, { recursive: true });
    for (let frame = 0; frame < 45; frame++) {
      await app.evaluate(`window.__infantryLab.setTime(${frame / 15});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      await app.screenshot(`${frames}/${String(frame).padStart(4, '0')}.png`);
    }
    const result = spawnSync('ffmpeg', ['-y', '-v', 'error', '-threads', '2', '-filter_threads', '1', '-framerate', '15', '-i', `${frames}/%04d.png`, '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', '-crf', '20', `docs/infantry/browser/${count}-mixed.mp4`], { windowsHide: true });
    if (result.status !== 0) throw Error(String(result.stderr));
    console.log('Recorded deterministic GPU animation preview: ' + count);
  }
} finally { await app.close(); }
