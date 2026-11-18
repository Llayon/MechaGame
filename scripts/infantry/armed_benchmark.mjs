import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser, sleep, until } from './cdp.mjs';

const software = process.argv.includes('--software');
const edge = process.argv.includes('--edge');
const viewport = { width: 1280, height: 800 };
const destination = join('docs/infantry/benchmarks/vpulse', software ? 'swiftshader' : edge ? 'edge' : 'chrome');
mkdirSync(destination, { recursive: true });
const app = await browser({ software, edge, ...viewport });
const origin = process.env.LAB_ORIGIN || 'http://127.0.0.1:3000';
const inspect = () => app.evaluate('window.__infantryLab.inspect()');
const warmupMs = 800;
const sampleMs = 1500;
const repeats = software ? 1 : 2;
const results = [];

async function configure(patch) {
  await app.evaluate(`window.__infantryLab.configure(${JSON.stringify(patch)})`);
  await until(async () => {
    const runtime = await inspect();
    return runtime?.calls > 0 && Object.entries(patch).every(([key, value]) => runtime.settings[key] === value);
  });
  const view = await inspect();
  assert.equal(view.kit, 'vpulse');
  assert.equal(view.gameMissionMounted, false);
  assert.equal(view.sourceTriangles, 999);
  assert.ok(view.weaponTriangles > 0 && view.weaponTriangles <= 800);
  assert.equal(view.activeInstances, view.settings.count);
  assert.equal(view.weaponBatches, view.batches);
  assert.equal(view.cpuSkeletonUpdates, 0);
  return view;
}

try {
  await app.navigate(`${origin}/?lab=infantry&kit=vpulse`);
  const cases = [20, 100, 200].map(count => ({ count, batches: 1, shadows: false, matricesEveryFrame: false }));
  cases.push({ count: 200, batches: 10, shadows: false, matricesEveryFrame: false });
  if (!software) {
    cases.push({ count: 200, batches: 1, shadows: true, matricesEveryFrame: false });
    cases.push({ count: 200, batches: 1, shadows: false, matricesEveryFrame: true });
  }
  for (const settings of cases) {
    const view = await configure({ animation: 'mixed', preset: 'high', travel: false, camera: 'medium', ...settings });
    assert.ok(new Set(view.instances.map(instance => instance.phase)).size > 1);
    assert.ok(new Set(view.instances.map(instance => instance.animation)).size > 1);
    const modelTriangles = (view.sourceTriangles + view.weaponTriangles) * view.activeInstances;
    assert.equal(view.triangles, modelTriangles * (settings.shadows ? 2 : 1) + 2);
    assert.equal(view.calls, view.batches * (settings.shadows ? 4 : 2) + 2);
    for (let repeat = 1; repeat <= repeats; repeat++) {
      const report = await app.evaluate(`window.__infantryLab.capture(${warmupMs}, ${sampleMs})`);
      const stats = report.capture.rendererStats;
      assert.ok(stats.sampleCount > 1);
      assert.equal(report.cpu.skeletonUpdates, 0);
      if (settings.matricesEveryFrame) {
        // Sharing the WebGL matrix buffer keeps uploads at one per soldier.
        assert.equal(report.cpu.instanceMatrixUpdates, settings.count * report.cpu.uniformUpdates);
      } else {
        assert.equal(report.cpu.instanceMatrixUpdates, 0);
      }
      results.push({ repeat, settings: report.settings, stats, cpu: report.cpu, gpuTimeMs: report.gpuTimeMs,
        resourceBytes: report.runtime.resourceBytes, modelTriangles, calls: view.calls });
      console.log(`${settings.count} soldiers / ${view.batches} body and rifle batches / shadows=${settings.shadows} / repeat=${repeat}: ` +
        `${stats.fps.toFixed(1)} FPS, ${view.calls} draws, ${view.triangles} triangles`);
    }
  }
  if (!edge && !software) for (const count of [20, 100, 200]) {
    await configure({ count, animation: 'mixed', camera: 'medium', batches: 1, shadows: false, matricesEveryFrame: false });
    await app.evaluate('window.__infantryLab.setTime(.33)');
    await sleep(200);
    await app.screenshot(join(destination, `formation-${count}.png`));
  }
  const close = await configure({ count: 1, animation: 'idle', camera: 'close', batches: 1, shadows: true, matricesEveryFrame: false });
  const available = await app.evaluate(`Array.from(document.querySelectorAll('aside select')[0].options, option => option.value)`);
  for (const animation of available.filter(name => name !== 'mixed')) {
    await configure({ animation });
    await app.evaluate('window.__infantryLab.setTime(.33)');
    await sleep(160);
    if (['idle', 'walk', 'crouch', 'fire'].includes(animation) && !edge && !software) {
      await app.screenshot(join(destination, `close-${animation}.png`));
    }
  }
  await app.evaluate('window.__infantryLab.setTime(null)');
  await configure({ count: 200, animation: 'mixed', camera: 'medium', batches: 10, shadows: false });
  const before = await inspect();
  for (let i = 0; i < 3; i++) {
    await configure({ count: 20, batches: 1 });
    await configure({ count: 200, batches: 10 });
  }
  const after = await inspect();
  assert.equal(after.geometries, before.geometries);
  assert.equal(after.textures, before.textures);
  assert.deepEqual(after.resourceBytes, before.resourceBytes);
  await configure({ camera: 'close' });
  const culled = await inspect();
  assert.ok(culled.calls < after.calls, 'Close inspection should cull distant formation batches');
  assert.equal((culled.calls - 2) % 2, 0, 'Body and rifle should be culled together');
  assert.equal(app.errors.length, 0, JSON.stringify(app.errors).slice(0, 4000));
  const environment = close.capabilities;
  const report = { viewport, warmupMs, sampleMs, repeats, environment, available, results,
    culling: { formationDraws: after.calls, closeDraws: culled.calls },
    repeatSwitch: { before: { geometries: before.geometries, textures: before.textures },
      after: { geometries: after.geometries, textures: after.textures } } };
  writeFileSync(join(destination, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  const csv = [['count', 'batches', 'shadows', 'matricesEveryFrame', 'repeat', 'fps', 'p50_ms', 'p95_ms', 'p99_ms',
    'draw_calls', 'triangles', 'cpu_skeleton_updates', 'cpu_matrix_updates']];
  for (const row of results) csv.push([row.settings.count, row.settings.batches, +row.settings.shadows,
    +row.settings.matricesEveryFrame, row.repeat, row.stats.fps, row.stats.p50Ms, row.stats.p95Ms, row.stats.p99Ms,
    row.calls, row.stats.trianglesPeak, row.cpu.skeletonUpdates, row.cpu.instanceMatrixUpdates]);
  writeFileSync(join(destination, 'summary.csv'), csv.map(row => row.join(',')).join('\n') + '\n');
} finally {
  await app.close();
}
