import test from 'node:test';
import assert from 'node:assert/strict';
import { IndustrialSampleBank } from './industrialAudio';
import type { IndustrialSample } from './industrialAudio';

type FakeSource = {
  buffer: { duration: number } | null;
  playbackRate: { value: number };
  onended: (() => void) | null;
  stoppedAt: number[];
  start: (at: number) => void;
  stop: (at: number) => void;
  connect: (dest: unknown) => void;
  disconnect: () => void;
};

function fakeAudioBank() {
  const sources: FakeSource[] = [];
  const envelopeEvents: Array<Array<{ op: string; value?: number; at?: number }>> = [];
  const ctx = {
    currentTime: 100,
    state: 'running',
    destination: {},
    createBufferSource() {
      const source: FakeSource = {
        buffer: null, playbackRate: { value: 1 }, onended: null,
        stoppedAt: [],
        start() {},
        stop(at) { this.stoppedAt.push(at); },
        connect() {}, disconnect() {},
      };
      sources.push(source);
      return source;
    },
    createGain() {
      const events: Array<{ op: string; value?: number; at?: number }> = [];
      envelopeEvents.push(events);
      return {
        gain: {
          value: 0.35,
          setValueAtTime(value: number, at: number) {
            events.push({ op: 'set', value, at }); this.value = value;
          },
          linearRampToValueAtTime(value: number, at: number) {
            events.push({ op: 'ramp', value, at }); this.value = value;
          },
          setTargetAtTime(value: number, at: number) {
            events.push({ op: 'target', value, at }); this.value = value;
          },
          cancelScheduledValues(at: number) { events.push({ op: 'cancel', at }); },
        },
        connect() {}, disconnect() {},
      };
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { value: 7200 }, connect() {}, disconnect() {} };
    },
  };
  const bank = new IndustrialSampleBank();
  (bank as unknown as { ctx: AudioContext }).ctx = ctx as unknown as AudioContext;
  const buffers = (bank as unknown as { buffers: Map<IndustrialSample, AudioBuffer> }).buffers;
  for (const name of ['mech_step_002', 'hydraulic_a', 'heavy_cannon'] as const) {
    buffers.set(name, { duration: 1.7 } as AudioBuffer);
  }
  return { bank, sources, envelopeEvents };
}

test('stopLocomotion fades active footsteps and hydraulics but never cuts weapon audio', () => {
  const { bank, sources, envelopeEvents } = fakeAudioBank();
  assert.ok(bank.play('mech_step_002', { group: 'locomotion', gain: 0.35 }));
  assert.ok(bank.play('hydraulic_a', { group: 'locomotion', gain: 0.1 }));
  assert.ok(bank.play('heavy_cannon', { gain: 0.6 }));
  bank.stopLocomotion();
  assert.equal(sources[0].stoppedAt.length, 1);
  assert.equal(sources[1].stoppedAt.length, 1);
  assert.deepEqual(sources[2].stoppedAt, []);
  assert.ok(sources[0].stoppedAt[0] <= 100.1, 'old footstep must not run for its full 1.7 seconds');
  for (const events of envelopeEvents.slice(0, 2)) {
    assert.ok(events.some(e => e.op === 'cancel'), 'clear original 1.7-second gain automation');
    assert.ok(events.some(e => e.op === 'ramp' && e.value === 0.001 && e.at! <= 100.1));
  }
  bank.stopLocomotion();
  assert.equal(sources[0].stoppedAt.length, 1, 'repeated stop must be idempotent');
});

test('immediate stop on pause or overview silences locomotion without waiting for audio clock', () => {
  const { bank, sources, envelopeEvents } = fakeAudioBank();
  bank.play('mech_step_002', { group: 'locomotion' });
  bank.stopLocomotion(0);
  assert.equal(sources[0].stoppedAt[0], 100);
  assert.ok(envelopeEvents[0].some(e => e.op === 'set' && e.value === 0 && e.at === 100));
});

test('new footfalls still play after stopping and retired voice does not consume budget', () => {
  const { bank, sources } = fakeAudioBank();
  bank.play('mech_step_002', { group: 'locomotion' });
  bank.stopLocomotion();
  sources[0].onended?.();
  assert.ok(bank.play('mech_step_002', { group: 'locomotion' }));
  assert.equal(sources.length, 2);
  bank.stopLocomotion();
  assert.equal(sources[1].stoppedAt.length, 1);
});
