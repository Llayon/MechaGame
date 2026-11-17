import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browser, sleep, until } from './cdp.mjs';
import { spawnSync } from 'node:child_process';
const dest = 'docs/infantry/browser'; mkdirSync(dest, { recursive: true });
const app = await browser({ software: !process.argv.includes('--hardware'), edge: process.argv.includes('--edge') });
try {
  await app.navigate((process.env.LAB_ORIGIN || 'http://127.0.0.1:3000') + '/?lab=infantry');
  async function configure(settings) {
    await app.evaluate(`window.__infantryLab.configure(${JSON.stringify(settings)})`);
    await until(() => app.evaluate(`Object.entries(${JSON.stringify(settings)}).every(([k,v])=>window.__infantryLab.inspect()?.settings[k]===v)`));
    await sleep(350);
  }
  const snapshots = [];
  for (const count of [20, 100, 200, 20]) {
    await configure({ count, animation: 'mixed', individualPhases: true });
    const view = await app.evaluate('window.__infantryLab.inspect()');
    assert.equal(view.activeInstances, count); assert.equal(view.cpuSkeletonUpdates, 0);
    assert.equal(view.matrixUpdatesLastFrame, 0); assert.equal(view.gameMissionMounted, false);
    assert.equal(new Set(view.instances.map(i => i.phase)).size, count);
    snapshots.push(view);
    await app.screenshot(`${dest}/mixed-${count}.png`);
  }
  assert.equal(snapshots[0].geometries, snapshots.at(-1).geometries);
  assert.equal(snapshots[0].textures, snapshots.at(-1).textures);
  for (const preset of ['low', 'balanced', 'high', 'ultra']) {
    await configure({ count: 20, preset, shadows: true, animation: 'run' });
    await sleep(400);
  }
  await configure({ count: 200, batches: 10, shadows: false });
  assert.equal((await app.evaluate('window.__infantryLab.inspect()')).batches, 10);
  await configure({ count: 1, batches: 1, preset: 'high', camera: 'close', animation: 'run', shadows: true });
  await app.evaluate('window.__infantryLab.setTime(0.21)'); await sleep(200);
  await app.screenshot(`${dest}/close-run.png`);
  await configure({ shadows: false }); await app.screenshot(`${dest}/close-run-no-shadow.png`);
  await configure({ animation: 'idle', shadows: false }); await app.screenshot(`${dest}/close-idle.png`);
  // The previous buffer-ownership bug passed draw-call tests while drawing no
  // character at all. Require original orange visor pixels and a changed pose.
  const pixels = name => {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-i', `${dest}/${name}.png`, '-vf', 'crop=800:500:100:150', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    assert.equal(result.status, 0, String(result.stderr)); return result.stdout;
  };
  const idlePixels = pixels('close-idle'), runPixels = pixels('close-run-no-shadow');
  let visor = 0, changed = 0;
  for (let i = 0; i < idlePixels.length; i += 3) {
    if (idlePixels[i] > 100 && idlePixels[i] > idlePixels[i + 1] * 1.15 && idlePixels[i + 1] > idlePixels[i + 2] * 1.15) visor++;
    if (Math.abs(idlePixels[i] - runPixels[i]) + Math.abs(idlePixels[i + 1] - runPixels[i + 1]) + Math.abs(idlePixels[i + 2] - runPixels[i + 2]) > 35) changed++;
  }
  assert.ok(visor > 8, `Original visor not visible: ${visor} pixels`);
  assert.ok(changed > 1000, `Run and idle poses do not differ: ${changed} pixels`);
  await configure({ animation: 'fire' }); await app.screenshot(`${dest}/close-fire.png`);
  await configure({ animation: 'crouch' }); await app.evaluate('window.__infantryLab.setTime(2)'); await sleep(100); await app.screenshot(`${dest}/close-crouch.png`);
  await configure({ count: 20, camera: 'gameplay', animation: 'mixed' }); await sleep(500); await app.screenshot(`${dest}/gameplay-scale.png`);
  const report = { snapshots, imageAssertions: { visorPixels: visor, changedPosePixels: changed }, final: await app.evaluate('window.__infantryLab.inspect()'), errors: app.errors };
  writeFileSync(`${dest}/smoke${process.argv.includes('--edge') ? '-edge' : process.argv.includes('--hardware') ? '-hardware' : ''}.json`, JSON.stringify(report, null, 2));
  assert.equal(app.errors.length, 0, JSON.stringify(app.errors).slice(0, 4000));
  console.log('PASS infantry browser smoke: counts, phases, states, batch resources, presets, animated shadow shader');
} finally { await app.close(); }
