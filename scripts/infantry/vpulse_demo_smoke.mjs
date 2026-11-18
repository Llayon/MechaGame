import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { browser, sleep, until } from './cdp.mjs';

const destination = 'docs/infantry/vpulse';
mkdirSync(`${destination}/images`, { recursive: true });
const weapon = JSON.parse(readFileSync('public/assets/infantry-vpulse/manifest.json'));
const armed = JSON.parse(readFileSync('public/assets/infantry-armed/manifest.json'));
const edge = process.argv.includes('--edge');
const software = process.argv.includes('--software');
const app = await browser({ edge, software, width: 1440, height: 900 });
const inspect = () => app.evaluate('window.__infantryDemo?.inspect()');
const socket = () => app.evaluate('window.__infantryDemo.inspectWeapon()');
const configure = (patch) => app.evaluate(`window.__infantryDemo.configure(${JSON.stringify(patch)})`);
const key = (code, type = 'keyDown') => app.send('Input.dispatchKeyEvent', {
  type, code, key: ({ Space: ' ', AltLeft: 'Alt' })[code] ?? code.replace('Key', '').toLowerCase(),
});
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

try {
  await app.send('Page.navigate', { url: `${process.env.LAB_ORIGIN || 'http://127.0.0.1:3000'}/?demo=infantry&kit=vpulse` });
  await until(async () => (await inspect())?.kit === 'vpulse', 45000);
  const start = await inspect();
  assert.equal(start.missionMounted, false);
  assert.equal(start.lod, 2);
  assert.equal(start.weaponTriangles, weapon.variants.crowd.triangles);
  await app.evaluate(`document.querySelector('[data-testid="inspect-front"]').click()`);
  await sleep(400);
  const clips = armed.clips.map(clip => clip.name);
  const sampled = [];
  const byClip = new Map();
  for (const name of clips) for (const phase of [0, .25, .5, .75, .97]) {
    for (const lod of [0, 1, 2]) {
      await configure({ lod, previewAnimation: name, paused: true, phase });
      await until(async () => {
        const state = await inspect();
        return state.lod === lod && state.animation === name && Math.abs(state.phase - phase) < .00001;
      });
      const state = await inspect();
      const pose = await socket();
      assert.equal(pose.parent, 'hand_R');
      assert.ok(pose.matrix.every(Number.isFinite));
      assert.equal(state.weaponTriangles, weapon.variants[lod === 2 ? 'crowd' : 'close'].triangles);
      const gripToMuzzle = distance(pose.primary, pose.muzzle);
      assert.ok(Math.abs(gripToMuzzle - Math.hypot(...weapon.markers.muzzle)) < .0001, `${name} changed weapon length`);
      const supportDistance = distance(pose.support, pose.handL);
      sampled.push({ name, phase, lod, supportDistance, gripToMuzzle });
      const worst = Math.max(byClip.get(name) ?? 0, supportDistance);
      byClip.set(name, worst);
      if (!edge && lod === 0 && phase === .25 && ['idle', 'walk', 'run', 'crouch', 'jump'].includes(name)) {
        await app.screenshot(`${destination}/images/demo-${name}.png`);
      }
    }
  }
  assert.ok(Math.max(...byClip.values()) < .0002, `Left hand separated from support: ${JSON.stringify(Object.fromEntries(byClip))}`);

  const fire = armed.clips.find(clip => clip.name === 'fire');
  assert.ok(fire && !fire.loop && fire.muzzleTime > 0 && fire.muzzleTime < fire.duration);
  await configure({ lod: 0, previewAnimation: 'fire', paused: true, phase: (fire.muzzleTime + .02) / fire.duration });
  await until(async () => (await inspect()).flashVisible);
  if (!edge) await app.screenshot(`${destination}/images/demo-fire.png`);
  await configure({ lod: 2, previewAnimation: 'gameplay' });
  await until(async () => (await inspect()).animation === 'idle');
  await key('KeyF'); await key('KeyF', 'keyUp');
  await until(async () => (await inspect()).shots === start.shots + 1);
  await until(async () => (await inspect()).animation === 'idle');

  // Check both ordinary controls and a mounted rifle while animated movement drives the skinned mesh.
  const transition = app.evaluate(`new Promise(resolve => {
    const start = performance.now();
    let largestOffset = 0;
    function sample() {
      const pose = window.__infantryDemo.inspectWeapon();
      if (pose) largestOffset = Math.max(largestOffset, Math.hypot(...pose.support.map((x, i) => x - pose.handL[i])));
      if (performance.now() - start < 550) requestAnimationFrame(sample);
      else resolve(largestOffset);
    }
    requestAnimationFrame(sample);
  })`);
  await key('KeyW');
  await until(async () => (await inspect()).animation === 'run' && (await inspect()).speedMeters > 2);
  const idleToRunGripDrift = await transition;
  assert.ok(idleToRunGripDrift < .012, `Idle-to-Run grip drift: ${idleToRunGripDrift}`);
  const run = await inspect();
  await key('KeyW', 'keyUp');
  await until(async () => (await inspect()).animation === 'idle');
  await key('Space'); await key('Space', 'keyUp');
  await until(async () => (await inspect()).animation === 'jump' && (await inspect()).position[1] > .025);
  await until(async () => (await inspect()).grounded);
  await key('KeyC'); await key('KeyC', 'keyUp');
  await until(async () => (await inspect()).animation === 'crouch');
  await key('KeyW');
  await until(async () => (await inspect()).animation === 'crouchWalk');
  await key('KeyW', 'keyUp');
  await key('KeyC'); await key('KeyC', 'keyUp');
  await until(async () => (await inspect()).animation === 'idle');

  await configure({ kit: 'unarmed' });
  await until(async () => (await inspect()).kit === 'unarmed');
  assert.equal((await inspect()).weaponTriangles, 0);
  await configure({ kit: 'vpulse', previewAnimation: 'idle', paused: true });
  await until(async () => (await inspect()).kit === 'vpulse');
  assert.equal((await socket()).parent, 'hand_R');
  assert.deepEqual(app.errors, []);
  const report = { passed: true, browser: edge ? 'Edge' : 'Chrome', software, sampled, run, idleToRunGripDrift,
    largestSupportDistanceByClip: Object.fromEntries(byClip), fire, final: await inspect() };
  writeFileSync(`${destination}/demo-${edge ? 'edge' : 'chrome'}.json`, JSON.stringify(report, null, 2));
  console.log(`PASS ${report.browser}: ${sampled.length} weapon poses, rigid grip, pulse, locomotion and kit switch`);
} finally {
  await app.close();
}
