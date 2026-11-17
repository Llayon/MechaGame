import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workdir = mkdtempSync(join(tmpdir(), 'mecha-audio-cdp-'));
const chromePath = process.env.CHROME || 'google-chrome';
const chrome = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--disable-background-networking', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=0', '--user-data-dir=' + workdir, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, ms, message) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) { last = error; }
    await sleep(180);
  }
  throw Error(message + (last ? ' - ' + String(last) : ''));
}

let ws;
try {
  const portFile = join(workdir, 'DevToolsActivePort');
  const port = await waitFor(() => {
    try { return readFileSync(portFile, 'utf8').split('\n')[0]; }
    catch { return null; }
  }, 12000, 'Chrome remote debugging port not available');

  const target = await waitFor(async () => {
    const all = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
    return all.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
  }, 12000, 'No CDP target');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const pending = new Map();
  let seq = 0;
  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) entry.reject(Error(JSON.stringify(data.error)));
    else entry.resolve(data.result);
  });
  function send(method, params={}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id); reject(Error(method + ' timed out'));
      }, 10000);
      pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const value = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (value.exceptionDetails) throw Error(JSON.stringify(value.exceptionDetails));
    return value.result?.value;
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/audio-decode-smoke.html' });
  const status = await waitFor(async () => {
    const result = await evaluate('document.getElementById("result")?.textContent ?? ""');
    if (result.includes('FAIL')) throw Error(result);
    return result.includes('MECHA-AUDIO-DECODE-PASS') ? result : null;
  }, 40000, 'Recorded audio codec decode did not finish');
  if (status !== 'MECHA-AUDIO-DECODE-PASS: 15 OGG and 15 MP3') throw Error(status);
  console.log(status);
} finally {
  ws?.close();
  chrome.kill('SIGTERM');
  await sleep(150);
  try { rmSync(workdir, { force: true, recursive: true }); } catch {}
}
