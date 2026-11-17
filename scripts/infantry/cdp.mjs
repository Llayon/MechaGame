import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout; let error;
  while (Date.now() < end) {
    try { const result = await fn(); if (result) return result; } catch (e) { error = e; }
    await sleep(150);
  }
  throw Error('Browser condition timed out: ' + (error?.message ?? 'no result'));
}
export async function browser({ software = true, width = 1280, height = 800, edge = false } = {}) {
  const origin = process.env.LAB_ORIGIN || 'http://127.0.0.1:3000';
  let server;
  try { await fetch(origin); } catch {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3000'], { stdio: 'ignore', windowsHide: true });
    await until(async () => (await fetch(origin)).ok);
  }
  const profile = mkdtempSync(join(tmpdir(), 'infantry-cdp-'));
  const executable = edge ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    : process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, `--window-size=${width},${height}`, 'about:blank'];
  if (software) flags.unshift('--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl');
  const processHandle = spawn(executable, flags, { stdio: 'ignore', windowsHide: true });
  let ws;
  const errors = [];
  const close = async () => {
    ws?.close(); processHandle.kill(); server?.kill(); await sleep(400);
    const absolute = resolve(profile);
    if (!absolute.startsWith(resolve(tmpdir()) + sep + 'infantry-cdp-')) throw Error('Unsafe temporary profile path');
    try { rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  };
  try {
    const port = await until(() => readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(p => p.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let id = 0; const pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown' ||
        (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')) errors.push(message.params);
      if (pending.has(message.id)) {
        const callback = pending.get(message.id); pending.delete(message.id);
        message.error ? callback.reject(Error(JSON.stringify(message.error))) : callback.resolve(message.result);
      }
    });
    function send(method, params = {}) {
      const messageId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(messageId); reject(Error('CDP timeout: ' + method)); }, 60000);
        pending.set(messageId, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result?.value;
    }
    await send('Page.enable'); await send('Runtime.enable');
    return { send, evaluate, errors, close,
      async navigate(url) {
        await send('Page.navigate', { url });
        try { await until(() => evaluate('Boolean(window.__infantryLab?.inspect()?.ready)'), 45000); }
        catch (e) { throw Error(e.message + '\n' + await evaluate('document.body.innerText') + '\n' + JSON.stringify(errors).slice(0, 8000)); }
      },
      async screenshot(path) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path, Buffer.from(shot.data, 'base64'));
      },
    };
  } catch (e) { await close(); throw e; }
}
