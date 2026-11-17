import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const atlas = read('public/assets/infantry/animation.json');
assert.equal(sha('public/assets/infantry/source.glb'), atlas.sourceSha256);
assert.equal(readFileSync('public/assets/infantry/animation.rgba16f').length, atlas.byteLength);
const browsers = ['smoke', 'smoke-hardware', 'smoke-edge'].map(name => {
  const report = read(`docs/infantry/browser/${name}.json`);
  assert.equal(report.errors.length, 0);
  assert.ok(report.imageAssertions.visorPixels > 8 && report.imageAssertions.changedPosePixels > 1000);
  assert.deepEqual(report.snapshots.map(s => s.activeInstances), [20,100,200,20]);
  assert.equal(report.snapshots[0].geometries, report.snapshots.at(-1).geometries);
  assert.equal(report.snapshots[0].textures, report.snapshots.at(-1).textures);
  return { name, passed: true, renderer: report.final.capabilities.renderer, imageAssertions: report.imageAssertions };
});
const videos = ['animations/idle', 'animations/run', 'animations/fire', 'browser/20-mixed', 'browser/100-mixed', 'browser/200-mixed'].map(name => {
  const path = `docs/infantry/${name}.mp4`;
  const probe = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration,size','-of','json',path], { windowsHide:true, encoding:'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const format = JSON.parse(probe.stdout).format;
  assert.ok(+format.duration > .5 && +format.size > 1000);
  return { path, seconds:+format.duration, bytes:+format.size };
});
const hardware = read('docs/infantry/benchmarks/amd-desktop/index.json');
assert.equal(hardware.reports.length, 52);
assert.ok(hardware.reports.every(r=>r.cpu.skeletonUpdates===0));
assert.ok(hardware.reports.filter(r=>!r.settings.matricesEveryFrame).every(r=>r.cpu.instanceMatrixUpdates===0));
const baseline = read('docs/infantry/browser/game-baseline-regression.json');
const regression = read('docs/infantry/browser/game-regression.json');
const regressionPassed = regression.exitCode === 0;
const baselineFailure = !regressionPassed && baseline.exitCode === 1 &&
  ['game-regression', 'game-baseline-regression'].every(name =>
    /Trusted canvas click failed to capture pointer/.test(readFileSync(`docs/infantry/browser/${name}.log`,'utf8')));
assert.ok(regressionPassed || baselineFailure, 'Investigate a new gameplay regression');
for (const name of ['README','architecture','model-audit','performance-results','reproduce','visual-review']) {
  const text = readFileSync(`docs/infantry/${name}.md`, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (!/^https?:/.test(match[1])) assert.ok(existsSync(`docs/infantry/${match[1]}`), `Missing linked artifact: ${match[1]}`);
  }
}
const rawLog = existsSync('.tools/infantry-tests.log') ? readFileSync('.tools/infantry-tests.log') : Buffer.alloc(0);
const log = rawLog.toString(rawLog[0] === 0xff && rawLog[1] === 0xfe ? 'utf16le' : 'utf8');
writeFileSync('docs/infantry/qa-results.json', JSON.stringify({
  createdAt:new Date().toISOString(), codeCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  status:'HOLD', reason:'Final art approval, Death settling, state blending and physical-device QA outstanding',
  sourceSha256:atlas.sourceSha256, exportedGlbSha256:sha('public/assets/infantry/infantry-rigged.glb'),
  animationSha256:sha('public/assets/infantry/animation.rgba16f'),
  blenderRoundtrip:read('docs/infantry/roundtrip-metrics.json'),
  unitTestSummary: /144 pass/.test(log) && /0 fail/.test(log) ? { passed:144, failed:0, files:37 } : null,
  infantryBrowsers:browsers, videos,
  hardwareCaptures:hardware.reports.length, softwareCaptures:read('docs/infantry/benchmarks/swiftshader/index.json').reports.length,
  gameRegression:{passed:regressionPassed, identicalFailureOnBaseline:baselineFailure, baselineCommit:'919aa20', assertion:baselineFailure?'Trusted canvas click failed to capture pointer':null},
  physicalMobileVerified:false, independentBrowserEngineVerified:false, longLeakTestVerified:false,
}, null, 2));
console.log('PASS artifact integrity; final quality remains HOLD');
