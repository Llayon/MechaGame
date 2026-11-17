/**
 * Local recorded CC0 industrial foley. All assets ship with the game:
 * /public/assets/audio/industrial-v1 — source hashes in SOURCES.json.
 * This module is deliberately DOM-independent at import time.
 */
export const INDUSTRIAL_SAMPLES = [
  'diesel_idle',
  'mech_step_1', 'mech_step_2', 'mech_step_3',
  'hydraulic_a', 'hydraulic_b',
  'autocannon_1', 'autocannon_2', 'autocannon_3',
  'heavy_cannon',
  'armor_hit_1', 'armor_hit_2',
  'foot_metal', 'recoil', 'explosion_debris',
] as const;

export type IndustrialSample = (typeof INDUSTRIAL_SAMPLES)[number];

export interface SamplePlayOptions {
  gain?: number;
  rate?: number;
  lowpass?: number;
  delay?: number;
}

export function soundAssetUrl(name: IndustrialSample, base: string): string {
  const root = base.endsWith('/') ? base : base + '/';
  return root + 'assets/audio/industrial-v1/' + name + '.ogg';
}

export function engineMix(speed: number): { gain: number; rate: number; cutoff: number } {
  const load = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0));
  return {
    gain: 0.07 + load * 0.07,
    rate: 0.8 + load * 0.38,
    cutoff: 750 + load * 1600,
  };
}

export class IndustrialSampleBank {
  private ctx: AudioContext | null = null;
  private buffers = new Map<IndustrialSample, AudioBuffer>();
  private inFlight: Promise<void> | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voices = 0;
  private readonly maxVoices = 22;
  private engine: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private lastEngineUpdate = -1;
  private muted = false;

  attach(ctx: AudioContext): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -15;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.19;
    this.compressor.connect(this.master);
    this.master.connect(ctx.destination);
    void this.preload();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.018);
    }
  }

  isReady(name: IndustrialSample): boolean {
    return this.buffers.has(name);
  }

  preload(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const ctx = this.ctx;
    if (!ctx || typeof fetch === 'undefined') return Promise.resolve();
    const base = import.meta.env.BASE_URL;
    this.inFlight = Promise.allSettled(INDUSTRIAL_SAMPLES.map(async name => {
      const res = await fetch(soundAssetUrl(name, base), { cache: 'force-cache' });
      if (!res.ok) throw Error(name + ': HTTP ' + res.status);
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      if (buffer.duration <= 0.02) throw Error(name + ': empty audio buffer');
      this.buffers.set(name, buffer);
    })).then(results => {
      const errors = results.filter(r => r.status === 'rejected');
      if (errors.length > 0) {
        console.warn('MechaGame audio: some CC0 recordings unavailable, using legacy fallback', errors);
      }
    });
    return this.inFlight;
  }

  play(name: IndustrialSample, opts: SamplePlayOptions = {}): boolean {
    const ctx = this.ctx;
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer || this.muted || this.voices >= this.maxVoices) return false;
    if (ctx.state !== 'running') return false;
    const now = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.max(0.6, Math.min(1.5, opts.rate ?? 1));
    const gain = ctx.createGain();
    const amp = Math.max(0.001, Math.min(1, opts.gain ?? 0.25));
    // Soft envelope avoids clipping when layered guns and metal reverberation overlap.
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.006);
    gain.gain.setTargetAtTime(0.001, now + Math.max(.02, buffer.duration / src.playbackRate.value - 0.09), 0.033);
    if (opts.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = opts.lowpass;
      src.connect(filter);
      filter.connect(gain);
    } else src.connect(gain);
    gain.connect(this.compressor ?? ctx.destination);
    this.voices++;
    src.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      src.disconnect();
      gain.disconnect();
    };
    src.start(now);
    return true;
  }

  playVariant(names: readonly IndustrialSample[], opts: SamplePlayOptions = {}): boolean {
    if (!names.length) return false;
    const idx = Math.floor(Math.random() * names.length);
    return this.play(names[idx], opts);
  }

  /** Single buffered loop, throttled to ~10 automation updates/s. */
  syncEngine(active: boolean, load: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) {
      this.stopEngine();
      return;
    }
    if (!active) {
      this.stopEngine();
      return;
    }
    const buffer = this.buffers.get('diesel_idle');
    if (!buffer || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (!this.engine) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor ?? ctx.destination);
      src.start(now);
      this.engine = src;
      this.engineFilter = filter;
      this.engineGain = gain;
    }
    if (now - this.lastEngineUpdate < 0.095) return;
    this.lastEngineUpdate = now;
    const mix = engineMix(load);
    this.engineGain?.gain.setTargetAtTime(mix.gain, now, 0.08);
    this.engineFilter?.frequency.setTargetAtTime(mix.cutoff, now, 0.09);
    this.engine?.playbackRate.setTargetAtTime(mix.rate, now, 0.11);
  }

  stopEngine(): void {
    const src = this.engine;
    if (!src) return;
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? 0;
    this.engineGain?.gain.setTargetAtTime(0.001, now, 0.04);
    try { src.stop(now + 0.16); } catch { /* already stopped */ }
    this.engine = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.lastEngineUpdate = -1;
  }
}
