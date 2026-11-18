import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browser, sleep, until } from './cdp.mjs';

const frames = '.tools/vpulse-video';
mkdirSync(frames, { recursive: true });
mkdirSync('docs/infantry/vpulse', { recursive: true });
const { clips } = JSON.parse(readFileSync('public/assets/infantry-armed/manifest.json'));
const origin = process.env.LAB_ORIGIN || 'http://127.0.0.1:3000';
const app = await browser({ width: 1280, height: 800, software: false });
const inspect = () => app.evaluate('window.__infantryDemo?.inspect()');
const configure = patch => app.evaluate(`window.__infantryDemo.configure(${JSON.stringify(patch)})`);
let index = 0;
try {
  await app.send('Page.navigate', { url: `${origin}/?demo=infantry&kit=vpulse` });
  await until(async () => (await inspect())?.kit === 'vpulse');
  await app.evaluate(`document.querySelector('[data-testid="inspect-front"]').click()`);
  await sleep(300);
  await app.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: 640, y: 370 });
  await app.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: 540, y: 370 });
  await app.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: 540, y: 370 });
  await sleep(350);
  for (const [name, count] of [['idle', 20], ['walk', 20], ['run', 20], ['crouchWalk', 20], ['fire', 20]]) {
    const clip = clips.find(candidate => candidate.name === name);
    for (let frame = 0; frame < count; frame++) {
      const phase = clip.loop ? (frame / 15 / clip.duration) % 1 : Math.min(frame / 15 / clip.duration, .999);
      await configure({ lod: 0, previewAnimation: name, paused: true, phase });
      await until(async () => {
        const current = await inspect();
        return current.animation === name && Math.abs(current.phase - phase) < 1e-4;
      });
      await app.screenshot(`${frames}/${String(index++).padStart(4, '0')}.png`);
    }
  }
  assert.deepEqual(app.errors, []);
} finally {
  await app.close();
}
const encoder = spawnSync('ffmpeg', ['-y', '-v', 'error', '-threads', '2', '-framerate', '15', '-i', `${frames}/%04d.png`,
  '-frames:v', String(index), '-filter_threads', '1', '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p',
  '-crf', '22', 'docs/infantry/vpulse/vpulse-demo.mp4'], { windowsHide: true });
assert.equal(encoder.status, 0, String(encoder.stderr));
console.log(`Captured ${index} V-Pulse motion frames at 15 fps`);
