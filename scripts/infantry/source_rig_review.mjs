import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browser, sleep, until } from './cdp.mjs';

const before = process.argv.includes('--before');
const edge = process.argv.includes('--edge');
const dest = 'docs/infantry/source-rig';
const frames = `.tools/source-run-${before ? 'before' : 'after'}`;
if (!edge) mkdirSync(frames, { recursive: true });
if (!before) mkdirSync(dest, { recursive: true });
const app = await browser({ edge, software: false, width: 1120, height: 768 });
const origin = process.env.LAB_ORIGIN || 'http://127.0.0.1:3000';
const inspect = () => app.evaluate('window.__infantryDemo.inspect()');
const configure = settings => app.evaluate(`window.__infantryDemo.configure(${JSON.stringify(settings)})`);
const key = (code, type) => app.send('Input.dispatchKeyEvent', { code, type, key: code.replace('Key', '').toLowerCase() });
const phaseIs = async (lod, phase) => {
  const state = await inspect();
  return state.lod === lod && state.animation === 'run' && Math.abs(state.phase - phase) < .00001;
};
const file = i => `${frames}/${String(i).padStart(4, '0')}.png`;

async function verifyGpuRun() {
  await app.send('Page.navigate', { url: `${origin}/?demo=infantry&kit=vpulse&lod=source` });
  await until(async () => (await inspect())?.lod === 3, 20000);
  assert.equal((await inspect()).triangles, 40000);
  await app.navigate(`${origin}/?lab=infantry&kit=vpulse`);
  const smoke = [];
  for (const count of [20, 100, 200]) {
    const settings = { count, animation: 'run', preset: 'high', camera: 'medium', batches: 1, shadows: true, travel: false, matricesEveryFrame: false };
    await app.evaluate(`window.__infantryLab.configure(${JSON.stringify(settings)})`);
    const expectedTriangles = (999 + 458) * count * 2 + 2;
    const inspectLab = () => app.evaluate('window.__infantryLab.inspect()');
    await until(async () => {
      const state = await inspectLab();
      return state.settings.count === count && state.settings.animation === 'run' && state.calls === 6 && state.triangles === expectedTriangles;
    });
    const state = await inspectLab();
    assert.equal(state.activeInstances, count);
    assert.equal(new Set(state.instances.map(instance => instance.phase)).size, count);
    assert.equal(state.sourceTriangles, 999);
    assert.equal(state.cpuSkeletonUpdates, 0);
    assert.equal(state.matrixUpdatesLastFrame, 0);
    const { sourceTriangles, weaponTriangles, calls, triangles, cpuSkeletonUpdates, matrixUpdatesLastFrame, capabilities } = state;
    smoke.push({ count, animation: settings.animation, shadows: settings.shadows, sourceTriangles, weaponTriangles, calls, triangles,
      cpuSkeletonUpdates, matrixUpdatesLastFrame, renderer: capabilities.renderer });
  }
  assert.deepEqual(app.errors, []);
  assert.ok(!(await app.evaluate(`performance.getEntriesByType('resource').some(entry => entry.name.includes('infantry-high.glb'))`)));
  writeFileSync(`${dest}/gpu-smoke.json`, JSON.stringify({ passed: true, directSourceLink: true, smoke }, null, 2) + '\n');
  console.log('PASS GPU Run: 20, 100 and 200 independent phases, six draw calls with shadows');
}

try {
  await app.send('Page.navigate', { url: `${origin}/?demo=infantry&kit=vpulse` });
  await until(() => app.evaluate('window.__infantryDemo?.inspect()?.ready'));
  const start = await inspect();
  assert.equal(start.triangles, 999);
  assert.equal(start.missionMounted, false);
  if (!before) assert.ok(!(await app.evaluate(`performance.getEntriesByType('resource').some(entry => entry.name.includes('infantry-high.glb'))`)));

  await app.evaluate(`document.querySelector('[data-testid="inspect-front"]').click()`);
  await sleep(280);
  await app.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: 544, y: 350 });
  await app.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: 445, y: 350 });
  await app.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: 445, y: 350 });
  await sleep(300);
  await app.evaluate(`document.querySelector('.play-menu-toggle').click()`);

  if (!edge) {
    await app.evaluate(`document.body.insertAdjacentHTML('beforeend', '<div id="run-caption" style="position:fixed;left:22px;top:138px;padding:8px 12px;color:#fff;background:#142630;font:18px sans-serif">${before ? 'До правки · LOD 999' : 'После правки · LOD 999'}</div>')`);
    for (let i = 0; i < 42; i++) {
      const phase = (i % 21) / 21;
      await configure({ lod: 2, previewAnimation: 'run', paused: true, phase });
      await until(() => phaseIs(2, phase));
      await app.screenshot(file(i));
    }
    await app.evaluate(`document.querySelector('#run-caption').remove()`);
  }

  if (!before) {
    const phase = .29;
    await configure({ lod: 2, previewAnimation: 'run', paused: true, phase });
    await until(() => phaseIs(2, phase));
    const lightweight = await inspect();
    const beforeSocket = await app.evaluate('window.__infantryDemo.inspectWeapon()');
    await configure({ lod: 3 });
    await until(() => phaseIs(3, phase), 45000);
    const full = await inspect();
    assert.equal(full.triangles, 40000);
    assert.equal(full.bones, 18);
    assert.equal(full.weaponTriangles, 3702);
    assert.deepEqual(full.position, lightweight.position);
    const afterSocket = await app.evaluate('window.__infantryDemo.inspectWeapon()');
    const delta = Math.hypot(...beforeSocket.muzzle.map((v, i) => v - afterSocket.muzzle[i]));
    assert.ok(delta < .0001, `LOD changed muzzle location: ${delta}`);
    if (!edge) await app.screenshot(`${dest}/source-run.png`);
    await configure({ previewAnimation: 'idle', phase: .3 });
    await until(async () => (await inspect()).animation === 'idle');
    if (!edge) await app.screenshot(`${dest}/source-idle.png`);

    await configure({ previewAnimation: 'gameplay' });
    await key('KeyW', 'keyDown');
    await until(async () => (await inspect()).animation === 'run' && (await inspect()).speedMeters > 3.05);
    const samples = await app.evaluate(`new Promise(resolve => {
      const begin = performance.now();
      const values = [];
      function tick() {
        const s = window.__infantryDemo.inspect();
        values.push({ phase: s.phase, speed: s.speedMeters, animation: s.animation });
        if (performance.now() - begin < 1600) requestAnimationFrame(tick);
        else resolve(values);
      }
      requestAnimationFrame(tick);
    })`);
    await key('KeyW', 'keyUp');
    await until(async () => (await inspect()).animation === 'idle');
    assert.ok(samples.every(s => s.animation === 'run' && s.speed > 3.05));
    assert.ok(samples.filter((s, i) => i && samples[i - 1].phase > .8 && s.phase < .2).length >= 2);
    for (const lod of [2, 3, 2, 3]) {
      await configure({ lod });
      await until(async () => (await inspect()).lod === lod);
    }
    const sourceRequests = await app.evaluate(`performance.getEntriesByType('resource').filter(entry => entry.name.includes('infantry-high.glb')).length`);
    assert.equal(sourceRequests, 1);
    assert.deepEqual(app.errors, []);
    writeFileSync(`${dest}/browser-${edge ? 'edge' : 'chrome'}.json`, JSON.stringify({ passed: true, start, full, delta, sourceRequests, steadyRun: samples }, null, 2));
    console.log(`PASS ${edge ? 'Edge' : 'Chrome'}: lazy source rig, same-phase LOD, ${samples.length} steady Run samples`);
    if (!edge) await verifyGpuRun();
  } else {
    assert.deepEqual(app.errors, []);
    console.log('Captured the baseline run');
  }
} finally {
  await app.close();
}

if (!before && !edge) {
  const render = spawnSync('ffmpeg', ['-v', 'error', '-y', '-threads', '2', '-framerate', '15', '-i', '.tools/source-run-before/%04d.png',
    '-threads', '2', '-framerate', '15', '-i', `${frames}/%04d.png`, '-filter_complex_threads', '1',
    '-filter_complex', 'hstack=inputs=2', '-frames:v', '42', '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', '-crf', '23', `${dest}/run-comparison.mp4`], { windowsHide: true });
  assert.equal(render.status, 0, String(render.stderr));
}
