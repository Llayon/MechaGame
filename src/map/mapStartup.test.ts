import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapStartup } from './mapStartup';

const startup = (search: string) => resolveMapStartup(new URLSearchParams(search));

test('ordinary map links use the tested streamed overview', () => {
  const preview = startup('terrain=baked&entry=landmarks&surface=stream');
  assert.equal(preview.streaming, true);
  assert.deepEqual(startup(''), preview);
  assert.deepEqual(startup('graphics=balanced'), preview);
});

test('direct combat and explicit terrain experiments retain their startup paths', () => {
  assert.deepEqual(startup('autostart=1'), { baked: false, landmarks: false, surface: null, streaming: false });
  assert.equal(startup('autostart=1&terrain=baked').baked, true);
  assert.equal(startup('terrain=worker').streaming, false);
  assert.equal(startup('terrain=baked&entry=landmarks&surface=quick').streaming, false);
});
