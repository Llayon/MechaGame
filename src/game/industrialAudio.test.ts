import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INDUSTRIAL_SAMPLES, engineMix, soundAssetUrl } from './industrialAudio';

test('15 bundled CC0 sounds have actual non-empty Ogg bitstreams', () => {
  assert.equal(INDUSTRIAL_SAMPLES.length, 15);
  const source = JSON.parse(readFileSync('public/assets/audio/industrial-v1/SOURCES.json', 'utf8')) as
    Array<{ license: string; outputs: unknown[] }>;
  assert.equal(source.length, 6);
  assert.ok(source.every(x => x.license === 'CC0'));
  for (const name of INDUSTRIAL_SAMPLES) {
    const bytes = readFileSync('public/assets/audio/industrial-v1/' + name + '.ogg');
    assert.ok(bytes.byteLength >= 900, name + ' must contain actual audio samples');
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS', name + ' is not a valid Ogg header');
    const mp3 = readFileSync('public/assets/audio/industrial-v1/' + name + '.mp3');
    assert.ok(mp3.byteLength >= 900, name + ' missing MP3 fallback for older Safari');
  }
});

test('audio asset paths work at GitHub Pages subpath and root', () => {
  assert.equal(soundAssetUrl('diesel_idle', '/'),
    '/assets/audio/industrial-v1/diesel_idle.ogg');
  assert.equal(soundAssetUrl('heavy_cannon', '/MechaGame/'),
    '/MechaGame/assets/audio/industrial-v1/heavy_cannon.ogg');
  assert.equal(soundAssetUrl('foot_metal', '/MechaGame'),
    '/MechaGame/assets/audio/industrial-v1/foot_metal.ogg');
  assert.equal(soundAssetUrl('diesel_idle', '/MechaGame/', 'mp3'),
    '/MechaGame/assets/audio/industrial-v1/diesel_idle.mp3');
});

test('diesel engine load mapping is bounded and rises smoothly', () => {
  const idle = engineMix(0);
  const cruising = engineMix(0.4);
  const full = engineMix(1);
  assert.ok(idle.gain < cruising.gain && cruising.gain < full.gain);
  assert.ok(idle.rate < cruising.rate && cruising.rate < full.rate);
  assert.ok(idle.cutoff < cruising.cutoff && cruising.cutoff < full.cutoff);
  assert.deepEqual(engineMix(-2), idle);
  assert.deepEqual(engineMix(2), full);
  assert.deepEqual(engineMix(Number.NaN), idle);
});
