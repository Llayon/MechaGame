import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Catch future scene systems that advance on the real R3F clock during pause. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [file] : [];
  });
}

test('every animated scene subsystem gates useFrame before mutating state', () => {
  const missing: string[] = [];
  let guarded = 0;
  for (const file of sourceFiles('src/scene')) {
    const source = readFileSync(file, 'utf8');
    const rx = /\buseFrame\s*\(\s*\([^\n]*?\)\s*=>\s*\{/g;
    for (const match of source.matchAll(rx)) {
      if (file.endsWith('SceneSimulation.tsx')) {
        assert.match(source, /advanceSceneClock\(clockRef\.current, delta, paused\)/);
        continue;
      }
      const callbackStart = match.index + match[0].length;
      const nearStart = source.slice(callbackStart, callbackStart + 850);
      if (!/\bif\s*\(paused\)\s*return\s*;/.test(nearStart)) {
        const line = source.slice(0, match.index).split('\n').length;
        missing.push(`${file}:${line}: scene useFrame not guarded by pause`);
      }
      guarded++;
    }
    assert.ok(!/\b(?:state|_)\.clock\.getElapsedTime\s*\(/.test(source),
      `${file} reads unpaused wall-clock; use shared clockRef.current.elapsed instead`);
  }
  assert.ok(guarded >= 19, `Expected >=19 scene frame subscribers; only scanned ${guarded}`);
  assert.deepEqual(missing, [], missing.join('\n'));
});
