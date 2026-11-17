/**
 * Real-time Chrome DevTools Protocol benchmark for the ACTUAL Vite/R3F game.
 * Runs desktop viewport and mobile *emulation* on GitHub's software GPU.
 * Do not compare the results to physical desktop/iPhone GPU performance.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGIN = process.env.BENCH_ORIGIN || 'http://127.0.0.1:4173';
const CHROME = process.env.CHROME || 'google-chrome';
const DEST = process.env.BENCH_OUTPUT || 'benchmarks/results';
const DURATION_MS = Number(process.env.BENCH_DURATION_MS || 8000);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const scenarios = [
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
  let nextId = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
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
  return { ready, send, evaluate, close: () => ws.close() };
}

async function measure(scenario) {
  const userData = mkdtempSync(join(tmpdir(), 'mech-perf-'));
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--no-first-run', '--no-default-browser-check',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl',
    '--remote-debugging-port=0', '--user-data-dir=' + userData,
    '--window-size=' + scenario.width + ',' + scenario.height,
    'about:blank',
  ];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
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
      url: ORIGIN + '/?autostart=1&profile=1&benchmark=1',
    });
    await waitFor(async () => {
      const ok = await cdp.evaluate('Boolean(window.__mechaPerf && document.querySelector("canvas"))');
      return ok;
    }, 35000, 'Game/Canvas/profiler not ready');
    await wait(2500); // Warm up shader compilation and scene mounting.
    await cdp.evaluate('window.__mechaPerf.startCapture(' + DURATION_MS + ')');
    const report = await waitFor(async () => {
      const data = await cdp.evaluate('window.__mechaPerf.getReport()');
      return data?.schemaVersion === 1 ? data : null;
    }, DURATION_MS + 18000, 'Performance capture did not finish');

    if (report.rendererStats.sampleCount < 3) {
      throw Error('Only ' + report.rendererStats.sampleCount + ' actual frames were measured');
    }
    if (report.environment.scenario !== 'combat') {
      throw Error('Benchmark did not enter the active combat scene');
    }
    if (!(report.rendererStats.fps > 0) || !Number.isFinite(report.rendererStats.p95Ms)) {
      throw Error('Invalid report FPS or p95');
    }
    report.automation = {
      scenario: scenario.id,
      host: 'GitHub-hosted ubuntu-latest VM',
      rendererMode: 'Chrome headless + SwiftShader software WebGL',
      mobileEmulation: scenario.mobile,
      physicalPhoneMeasurement: false,
      viewportRequested: scenario,
      note: 'Relative CI software-rendering diagnostic only; not hardware desktop/mobile FPS.',
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
    fps: report.rendererStats.fps,
    frameP50Ms: report.rendererStats.p50Ms,
    frameP95Ms: report.rendererStats.p95Ms,
    frameP99Ms: report.rendererStats.p99Ms,
    drawCallsMean: report.rendererStats.drawCallsMean,
    trianglesMean: report.rendererStats.trianglesMean,
    frames: report.rendererStats.sampleCount,
    renderer: report.environment.renderer,
    device: 'CI Chrome SwiftShader, ' + (scenario.mobile ? 'mobile emulation' : 'desktop viewport'),
  });
  console.log(JSON.stringify(output[output.length - 1], null, 2));
}
writeFileSync(join(DEST, 'summary.json'), JSON.stringify(output, null, 2));
const cells = ['scenario', 'fps', 'frameP50Ms', 'frameP95Ms', 'frameP99Ms',
  'drawCallsMean', 'trianglesMean', 'frames', 'renderer', 'device'];
writeFileSync(join(DEST, 'summary.csv'), [
  cells.join(','),
  ...output.map(row => cells.map(k => JSON.stringify(row[k])).join(',')),
].join('\n'));
console.log('BENCHMARK COMPLETE: ' + output.length + ' measured software-renderer scenarios.');
