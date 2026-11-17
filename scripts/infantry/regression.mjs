import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { until } from './cdp.mjs';

// Run the existing gameplay smoke unchanged against a production preview.
let server;
try {
  try { await fetch('http://127.0.0.1:4173'); } catch {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { windowsHide: true, stdio: 'ignore' });
    await until(async () => (await fetch('http://127.0.0.1:4173')).ok);
  }
  let log = '';
  const child = spawn(process.execPath, ['scripts/control-smoke.mjs'], { windowsHide: true,
    env: { ...process.env, CHROME: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { log += data; process.stdout.write(data); });
  child.stderr.on('data', data => { log += data; process.stderr.write(data); });
  const exitCode = await new Promise(resolve => child.on('close', resolve));
  mkdirSync('docs/infantry/browser', { recursive: true });
  writeFileSync('docs/infantry/browser/game-regression.log', log);
  writeFileSync('docs/infantry/browser/game-regression.json', JSON.stringify({ createdAt: new Date().toISOString(), script: 'scripts/control-smoke.mjs', exitCode, softwareMode: true, notHardwareBenchmark: true }, null, 2));
  if (exitCode !== 0) process.exitCode = 1;
} finally { server?.kill(); }
