import { readFileSync, writeFileSync } from 'node:fs';
const root = 'docs/infantry/benchmarks/';
const hw = JSON.parse(readFileSync(root + 'amd-desktop/index.json'));
const sw = JSON.parse(readFileSync(root + 'swiftshader/index.json'));
const transition = JSON.parse(readFileSync(root + 'amd-desktop/transitions.json'));
const round = x => typeof x === 'number' ? x.toFixed(2) : 'n/a';
const avg = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
function table(data) {
  const rows = data.scenarios.map((settings, scenario) => {
    const reports = data.reports.filter(r => r.scenario === scenario);
    const a = key => avg(reports.map(r => r.stats[key]));
    return `| ${settings.count} | ${settings.animation} | ${settings.batches} | ${settings.shadows} | ${settings.camera} | ${settings.matricesEveryFrame} | ${round(a('fps'))} | ${round(a('p50Ms'))} | ${round(a('p95Ms'))} | ${round(a('p99Ms'))} | ${round(a('drawCallsMean'))} | ${Math.round(a('trianglesMean'))} | ${round(avg(reports.map(r=>r.cpu.jsUpdateMs.p95)))} | ${round(avg(reports.flatMap(r=>r.gpuTimeMs ? [r.gpuTimeMs.p95] : [])))} |`;
  });
  return ['| N | Clip | Batches | Shadow | Camera | CPU matrix uploads | FPS | p50 ms | p95 ms | p99 ms | Calls | Triangles | JS p95 ms | GPU p95 ms |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}
const ts = transition.capture.rendererStats;
writeFileSync('docs/infantry/performance-results.md', `# Measured infantry laboratory results

Generated from committed JSON, ${hw.createdAt}. All numbers below are the arithmetic
mean of the two independently warmed captures for each scenario (percentiles are
averages of capture percentiles, not pooled quantiles). Raw frame samples and CSV
are in [benchmarks](benchmarks/). No FPS is inferred from draw calls.

## Available desktop hardware

Renderer: ${hw.reports[0].capabilities.renderer}.
Headless Chrome production build, high preset, fixed 1280x800 browser window;
actual viewport/DPR are recorded in each raw report. Warmup 1000 ms, capture
2000 ms, repeated twice. These short runs verify this isolated scene; they are
not prolonged thermal, maximum-throughput or full-mission acceptance measurements.
Near 60 FPS indicates scheduling/VSync limitation. JS update excludes renderer
submission; sub-0.1 ms readings are below browser clock precision. GPU timings
are asynchronous fresh timer-query results, and include floor/grid/shadows.

${table(hw)}

One infantry batch without shadows contributes one draw; plane and grid add two.
200 actors submit 249400 character triangles, plus two floor triangles. Animated
shadows add another character pass. The close view can cull whole spatial groups
in configuration B, whereas A retains the entire population. Therefore the
relative benefit depends on camera coverage and vertex work, not merely draw count.

Default frame matrix uploads and CPU skeleton updates are zero. Comparison cases
explicitly upload N matrices/frame; setup writes occur once on creation and are
outside steady-state JS update timing. Their latency is separately recorded in
index.json switches (includes React commit, CDP and 150 ms polling).

Continuous 20→100→200→20 transition capture: ${round(ts.fps)} FPS;
p50/p95/p99 ${round(ts.p50Ms)}/${round(ts.p95Ms)}/${round(ts.p99Ms)} ms;
worst ${round(ts.worstMs)} ms, frames over 33.33 ms ${ts.slowOver33Ms}.
This capture keeps frame history across changes instead of resetting away spikes.

## Software WebGL — correctness/regression only

Renderer: ${sw.reports[0].capabilities.renderer}.
Do not interpret this table as a real GPU or smartphone measurement.

${table(sw)}

## Limits and acceptance

**DEVICE QA NOT VERIFIED.** No physical smartphone, Safari or Firefox was available.
Chrome and Edge are separate browser runs but both use Chromium/ANGLE; they are
not evidence of independent browser-engine compatibility. Resource counters return
to baseline after 20→100→200→20 in smoke tests; no ten-minute leak/thermal test was
performed. Owned geometry/atlas/configuration/matrix byte counts are in raw JSON;
WebGL memory.geometries counts wrappers rather than unique shared vertex buffers,
and total GPU VRAM cannot be inferred from it. Short captures do not prove absence
of all memory leaks. Desktop 200-actor stability and weak-phone >=30 FPS in the
eventual target mission remain acceptance goals. See [device procedure](reproduce.md).
`);
console.log('Wrote reproducible performance-results.md');
