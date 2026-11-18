/**
 * Real-time Chrome DevTools Protocol benchmark for the ACTUAL Vite/R3F game.
 * The CI default uses SwiftShader. Pass --hardware for the local desktop GPU.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGIN = process.env.BENCH_ORIGIN || 'http://127.0.0.1:4173';
const CHROME = process.env.CHROME || 'google-chrome';
const DEST = process.env.BENCH_OUTPUT || 'benchmarks/results';
const DURATION_MS = Number(process.env.BENCH_DURATION_MS || 20000);
const hardware = process.argv.includes('--hardware');
const GRAPHICS_PRESET = process.env.BENCH_GRAPHICS_PRESET || 'high';
if (!['low', 'balanced', 'high', 'ultra'].includes(GRAPHICS_PRESET)) {
  throw Error('Invalid BENCH_GRAPHICS_PRESET: ' + GRAPHICS_PRESET);
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const scenarios = hardware ? [
  { id: 'desktop-hardware', width: 1365, height: 768, dpr: 1, mobile: false },
] : [
  { id: 'desktop-swiftshader', width: 1365, height: 768, dpr: 1, mobile: false },
  { id: 'mobile-emulated-swiftshader', width: 390, height: 844, dpr: 2, mobile: true },
];

async function waitFor(fn, timeoutMs, message) {
  const end = Date.now() + timeoutMs;
  let previousError;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      previousError = error;
    }
    await wait(250);
  }
  throw Error(message + (previousError ? ': ' + String(previousError) : ''));
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const browserEvents = [];
  let nextId = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown' ||
        (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error')) {
      browserEvents.push(msg);
      console.error('Browser event:', JSON.stringify(msg).slice(0, 1400));
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(Error('CDP ' + method + ' timed out'));
      }, 12000);
      pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) throw Error('Browser JS: ' +
      (result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)));
    return result.result?.value;
  }
  return { ready, send, evaluate, browserEvents, close: () => ws.close() };
}

async function measure(scenario) {
  const userData = mkdtempSync(join(tmpdir(), 'mech-perf-'));
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--no-first-run', '--no-default-browser-check',
    ...(hardware ? [] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl']),
    '--remote-debugging-port=0', '--user-data-dir=' + userData,
    '--window-size=' + scenario.width + ',' + scenario.height,
    'about:blank',
  ];
  const chrome = spawn(CHROME, args, { stdio: 'ignore', windowsHide: true });
  let cdp;
  try {
    const portFile = join(userData, 'DevToolsActivePort');
    const port = await waitFor(() => {
      try { return readFileSync(portFile, 'utf8').split('\n')[0]; }
      catch { return null; }
    }, 20000, 'Chrome did not open debugging port');
    const pages = await waitFor(async () => {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      return list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
    }, 10000, 'No Chrome page target');
    cdp = createCdp(pages.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'window.__perfPageErrors = []; window.addEventListener("error", e => window.__perfPageErrors.push(String(e.message))); window.addEventListener("unhandledrejection", e => window.__perfPageErrors.push(String(e.reason)));',
    });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: scenario.width, height: scenario.height,
      deviceScaleFactor: scenario.dpr, mobile: scenario.mobile,
    });
    if (scenario.mobile) {
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true, maxTouchPoints: 5,
      });
      await cdp.send('Network.setUserAgentOverride', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        platform: 'Android',
      });
    }
    await cdp.send('Page.navigate', {
      url: ORIGIN + '/?autostart=1&profile=1&benchmark=1&graphics=' + GRAPHICS_PRESET,
    });
    await waitFor(async () => {
      const ok = await cdp.evaluate('Boolean(window.__mechaPerf?.getLive().environment.scenario === "combat" && document.querySelector("canvas"))');
      return ok;
    }, 35000, 'Game/Canvas/profiler not ready');
    await wait(hardware ? 5000 : 2500);
    console.log('Warmup:', JSON.stringify(await cdp.evaluate(
      '({ visibility: document.visibilityState, state: document.body.dataset.state, profile: window.__mechaPerf?.getLive(), errors: window.__perfPageErrors })'
    )).slice(0, 2400));
    await cdp.evaluate('window.__mechaPerf.startCapture(' + DURATION_MS + ')');
    const report = await waitFor(async () => {
      const data = await cdp.evaluate('window.__mechaPerf.getReport()');
      return data?.schemaVersion === 1 ? data : null;
    }, DURATION_MS + 18000, 'Performance capture did not finish');

    if (report.rendererStats.sampleCount < 1) {
      const diagnostics = await cdp.evaluate(
        '({ visibility: document.visibilityState, state: document.body.dataset.state, url: location.href, canvas: document.querySelector("canvas")?.outerHTML.slice(0,600), profiler: window.__mechaPerf?.getLive(), errors: window.__perfPageErrors })'
      );
      writeFileSync(join(DEST, scenario.id + '-debug.json'),
        JSON.stringify({ diagnostics, browserEvents: cdp.browserEvents, report }, null, 2));
      console.error('Missing frames, diagnostics: ' + JSON.stringify(diagnostics).slice(0, 4000));
      throw Error('Only ' + report.rendererStats.sampleCount + ' actual frames were measured');
    }
    if (report.environment.scenario !== 'combat') {
      throw Error('Benchmark did not enter the active combat scene');
    }
    if (hardware && (report.environment.softwareMode || /swiftshader|llvmpipe|software|unavailable/i.test(report.environment.renderer))) {
      throw Error('Hardware renderer unavailable: ' + report.environment.renderer);
    }
    if (report.environment.graphicsPreset !== GRAPHICS_PRESET) {
      throw Error('Captured graphics preset mismatch: ' + report.environment.graphicsPreset);
    }
    if (!(report.rendererStats.fps > 0) || !Number.isFinite(report.rendererStats.p95Ms)) {
      throw Error('Invalid report FPS or p95');
    }
    if (report.rendererStats.sampleCount < 10) {
      console.warn('LOW-CONFIDENCE BENCHMARK: only ' + report.rendererStats.sampleCount +
        ' frame intervals.');
    }
    report.automation = {
      scenario: scenario.id,
      graphicsPreset: GRAPHICS_PRESET,
      host: process.env.GITHUB_ACTIONS ? 'GitHub Actions ' + process.platform : process.platform,
      rendererMode: hardware ? 'Chrome headless + desktop GPU' : 'Chrome headless + SwiftShader software WebGL',
      mobileEmulation: scenario.mobile,
      physicalPhoneMeasurement: false,
      viewportRequested: scenario,
      note: hardware ? 'Timed at the combat spawn with a fixed camera.' : 'Relative software-rendering diagnostic.',
    };
    return report;
  } finally {
    cdp?.close();
    chrome.kill('SIGTERM');
    await wait(250);
    try { rmSync(userData, { force: true, recursive: true }); }
    catch { /* Chrome may still close; do not mask primary result. */ }
  }
}

mkdirSync(DEST, { recursive: true });
const output = [];
for (const scenario of scenarios) {
  console.log('Profiling ' + scenario.id + '...');
  const report = await measure(scenario);
  writeFileSync(join(DEST, scenario.id + '.json'), JSON.stringify(report, null, 2));
  output.push({
    scenario: scenario.id,
    preset: GRAPHICS_PRESET,
    effectiveDpr: report.environment.renderDpr,
    shadowMapSize: report.environment.shadowMapSize,
    fps: report.rendererStats.fps,
    frameP50Ms: report.rendererStats.p50Ms,
    frameP95Ms: report.rendererStats.p95Ms,
    frameP99Ms: report.rendererStats.p99Ms,
    drawCallsMean: report.rendererStats.drawCallsMean,
    trianglesMean: report.rendererStats.trianglesMean,
    frames: report.rendererStats.sampleCount,
    renderer: report.environment.renderer,
    device: hardware ? 'Local desktop GPU' : 'Chrome SwiftShader, ' + (scenario.mobile ? 'mobile emulation' : 'desktop viewport'),
  });
  console.log(JSON.stringify(output[output.length - 1], null, 2));
}
writeFileSync(join(DEST, 'summary.json'), JSON.stringify(output, null, 2));
const cells = ['scenario', 'preset', 'effectiveDpr', 'shadowMapSize', 'fps', 'frameP50Ms', 'frameP95Ms', 'frameP99Ms',
  'drawCallsMean', 'trianglesMean', 'frames', 'renderer', 'device'];
writeFileSync(join(DEST, 'summary.csv'), [
  cells.join(','),
  ...output.map(row => cells.map(k => JSON.stringify(row[k])).join(',')),
].join('\n'));
console.log('BENCHMARK COMPLETE: ' + output.length + ' measured scenarios.');
