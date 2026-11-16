import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GLSL's smoothstep(edge0, edge1, x) has undefined results for edge0 >= edge1.
 * Guard literal-edge calls in scene shaders (including template strings).
 * Do not scan src/map, which uses its own valid descending JS interpolation helper.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|glsl|vert|frag)$/.test(item.name) ? [path] : [];
  });
}

test('all literal GLSL smoothstep edges in scene shaders are strictly ascending', () => {
  const invalid: string[] = [];
  let examined = 0;
  for (const path of sourceFiles('src/scene')) {
    const content = readFileSync(path, 'utf8');
    // Match numeric literal pairs; dynamic expressions require separate shader reviews.
    const rx = /\bsmoothstep\s*\(\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,/g;
    for (const match of content.matchAll(rx)) {
      examined++;
      const low = Number(match[1]);
      const high = Number(match[2]);
      if (low >= high) {
        const line = content.slice(0, match.index).split('\n').length;
        invalid.push(`${path}:${line}: lower edge ${low} must be less than upper edge ${high}`);
      }
    }
  }
  assert.ok(examined >= 60, `Expected shader calls to be checked; only found ${examined}`);
  assert.deepEqual(invalid, [], `Invalid GLSL smoothstep edge ordering:\n${invalid.join('\n')}`);
});

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

test('ordered descending fades retain original intended end and midpoint values', () => {
  for (const [lower, upper] of [
    [0.04, 0.28], [0.73, 1.0], [0.87, 1.0],
    [0.22, 1.0], [0.72, 1.0], [0.94, 1.0], [12.0, 42.0],
  ]) {
    const fade = (x: number) => 1 - smoothstep(lower, upper, x);
    assert.equal(fade(lower - 0.01), 1);
    assert.ok(Math.abs(fade((lower + upper) * 0.5) - 0.5) < 1e-10);
    assert.equal(fade(upper + 0.01), 0);
    assert.ok(fade(lower + (upper - lower) * 0.25) >
              fade(lower + (upper - lower) * 0.75));
  }
});
