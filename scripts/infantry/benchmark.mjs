import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browser, sleep, until } from './cdp.mjs';

const software = process.argv.includes('--software');
const dest = 'docs/infantry/benchmarks/' + (software ? 'swiftshader' : 'amd-desktop');
mkdirSync(dest, { recursive: true });
const app = await browser({ software });
const reports = [], switches = [];
try {
  await app.navigate((process.env.LAB_ORIGIN || 'http://127.0.0.1:3000') + '/?lab=infantry');
  async function configure(settings) {
    const started = performance.now();
    await app.evaluate(`window.__infantryLab.configure(${JSON.stringify(settings)})`);
    await until(() => app.evaluate(`Boolean(window.__infantryLab.inspect()?.calls) && Object.entries(${JSON.stringify(settings)}).every(([k,v])=>window.__infantryLab.inspect()?.settings[k]===v)`));
    switches.push({ settings, latencyMs: performance.now() - started });
  }
  for (const count of [20, 100, 200, 20, 100, 200, 20]) {
    await configure({ count, animation: 'mixed', preset: 'high', shadows: false, batches: 1, camera: 'medium' });
    await sleep(100);
  }
  const cases = [];
  for (const count of software ? [20, 100, 200] : [1, 20, 100, 200]) {
    for (const animation of software ? ['mixed'] : count === 1 ? ['idle', 'run'] : ['idle', 'run', 'mixed']) {
      for (const batches of count === 1 ? [1] : [1, 10]) cases.push({ count, animation, batches, shadows: false, camera: 'medium', matricesEveryFrame: false });
    }
  }
  if (!software) {
    for (const batches of [1, 10]) {
      cases.push({ count: 200, animation: 'mixed', batches, shadows: true, camera: 'medium', matricesEveryFrame: false });
      cases.push({ count: 200, animation: 'mixed', batches, shadows: false, camera: 'close', matricesEveryFrame: false });
      cases.push({ count: 200, animation: 'mixed', batches, shadows: false, camera: 'medium', matricesEveryFrame: true });
    }
  }
  for (let index = 0; index < cases.length; index++) {
    const settings = cases[index];
    await configure({ ...settings, individualPhases: true, travel: false, preset: 'high' });
    for (let repeat = 0; repeat < 2; repeat++) {
      const report = await app.evaluate('window.__infantryLab.capture(1000, 2000)');
      assert.ok(report.capture.rendererStats.sampleCount > 1);
      assert.equal(report.cpu.skeletonUpdates, 0);
      if (!settings.matricesEveryFrame) assert.equal(report.cpu.instanceMatrixUpdates, 0);
      report.repeat = repeat; report.scenario = index;
      reports.push(report);
      writeFileSync(`${dest}/${String(index).padStart(2, '0')}-${repeat}.json`, JSON.stringify(report, null, 2));
    }
    const s = reports.at(-1).capture.rendererStats;
    console.log(`${index + 1}/${cases.length} n=${settings.count} ${settings.animation} batches=${settings.batches} shadows=${settings.shadows} camera=${settings.camera}: ${s.fps.toFixed(1)} FPS p95=${s.p95Ms.toFixed(2)} calls=${s.drawCallsMean.toFixed(1)}`);
  }
  if (!software) {
    await configure({ count: 20, animation: 'run', batches: 1, camera: 'medium', shadows: false, matricesEveryFrame: false });
    const pending = app.evaluate('window.__infantryLab.capture(0, 3500)');
    const sequence = [100, 200, 20, 100, 200, 20];
    for (const count of sequence) { await sleep(350); await configure({ count, animation: count === 100 ? 'idle' : 'run' }); }
    const transition = await pending;
    transition.transitionSequence = sequence;
    writeFileSync(`${dest}/transitions.json`, JSON.stringify(transition, null, 2));
  }
  assert.equal(app.errors.length, 0, JSON.stringify(app.errors).slice(0, 3000));
  const columns = ['scenario','repeat','count','animation','batches','shadows','camera','matrixUploads','fps','p50','p95','p99','calls','triangles','jsP95','gpuP95','software'];
  const rows = reports.map(r => {
    const s = r.capture.rendererStats;
    return [r.scenario, r.repeat, r.settings.count, r.settings.animation, r.settings.batches, r.settings.shadows, r.settings.camera,
      r.cpu.instanceMatrixUpdates, s.fps, s.p50Ms, s.p95Ms, s.p99Ms, s.drawCallsMean, s.trianglesMean,
      r.cpu.jsUpdateMs.p95, r.gpuTimeMs?.p95 ?? '', r.capture.environment.softwareMode];
  });
  writeFileSync(`${dest}/summary.csv`, [columns, ...rows].map(r => r.join(',')).join('\n'));
  writeFileSync(`${dest}/index.json`, JSON.stringify({ createdAt: new Date().toISOString(), software, switches, scenarios: cases,
    warmupMs: 1000, captureMs: 2000, repeats: 2, viewport: [1280, 800], reports: reports.map(r => ({ scenario: r.scenario, repeat: r.repeat, settings: r.settings, stats: r.capture.rendererStats, cpu: r.cpu, gpuTimeMs: r.gpuTimeMs, capabilities: r.runtime.capabilities })),
    limitations: ['Short isolated lab measurements, not a full mission acceptance test', 'DEVICE QA NOT VERIFIED: no physical phone', 'Not a smartphone benchmark, including the software run'] }, null, 2));
} finally { await app.close(); }
