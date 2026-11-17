import { IndustrialSampleBank, MECH_PRIMARY_FOOTSTEP } from './industrialAudio';

class CombatAudioEngine {
  private ctx: AudioContext | null = null;
  private readonly samples = new IndustrialSampleBank();
  private muted = false;
  private paused = false;
  private lastShotSoundAt = 0;
  private lastHitSoundAt = 0;
  private lastTreeSnapAt = 0;
  private lastTreeThudAt = 0;
  private lastDistantBoomAt = 0;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.samples.setMuted(muted);
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    this.samples.setMuted(this.muted);
    return this.muted;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Freeze currently playing sources and prevent any new sounds while paused. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    const ctx = this.ctx;
    if (!ctx) return;

    if (paused && ctx.state === 'running') {
      // Resume after a pending suspend if the user toggles pause twice quickly.
      void ctx.suspend().then(() => {
        if (!this.paused && !this.muted && ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      }).catch(() => {});
    } else if (!paused && !this.muted && ctx.state === 'suspended') {
      // Unpausing is a user input, allowing AudioContext.resume() on mobile browsers.
      void ctx.resume().catch(() => {});
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.paused || typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    this.samples.attach(this.ctx);
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  /** Continuous engine volume/pitch is driven by active mech load. */
  syncEngine(active: boolean, load: number): void {
    if (!this.ctx || this.paused || this.muted) {
      if (!active) this.samples.stopEngine();
      return;
    }
    this.samples.syncEngine(active, load);
  }

  stopEngine(): void { this.samples.stopEngine(); }

  /** Fade previous footfalls/hydraulics when movement inputs are released. */
  stopLocomotion(immediate = false): void {
    this.samples.stopLocomotion(immediate ? 0 : 0.085);
  }

  playMechFootstep(inWater: boolean): void {
    if (!this.ensureContext()) return;
    // pgi's single mech_step_002 is the complete primary foot contact.
    // Do not layer Kenney metal over it: the sample already contains the strike.
    if (this.samples.play(MECH_PRIMARY_FOOTSTEP, {
      gain: inWater ? 0.22 : 0.35,
      rate: 0.96 + Math.random() * 0.08,
      lowpass: inWater ? 2300 : 7200,
      group: 'locomotion',
    })) return;

    // Non-blocking legacy fallback until this file is decoded / if unavailable.
    if (this.samples.playVariant(['mech_step_1', 'mech_step_2', 'mech_step_3'], {
      gain: inWater ? 0.24 : 0.34,
      rate: 0.91 + Math.random() * 0.14,
      group: 'locomotion',
    }) && !inWater) {
      this.samples.play('foot_metal', { gain: 0.12, rate: 0.94, group: 'locomotion' });
    }
  }

  playHydraulic(): void {
    if (!this.ensureContext()) return;
    this.samples.playVariant(['hydraulic_a', 'hydraulic_b'], {
      gain: 0.095, rate: 0.88 + Math.random() * 0.18,
      group: 'locomotion',
    });
  }

  playAutocannonShot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastShotSoundAt < 0.055) return;
    this.lastShotSoundAt = now;
    if (this.samples.playVariant(['autocannon_1','autocannon_2','autocannon_3'], {
      gain: 0.34, rate: 0.96 + Math.random() * 0.08,
    })) {
      this.samples.play('recoil', { gain: 0.13, delay: 0.035, rate: 0.92 });
      return;
    }

    const jitter = 0.92 + Math.random() * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(52 * jitter, now + 0.09);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playHeavyCannonShot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.samples.play('heavy_cannon', { gain: 0.64, rate: 0.97 })) {
      this.samples.play('recoil', { gain: 0.27, delay: 0.075, rate: 0.85 });
      return;
    }

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.34);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.37);
    sub.stop(now + 0.37);
  }

  playArmorHit(heavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (!heavy && now - this.lastHitSoundAt < 0.045) return;
    this.lastHitSoundAt = now;
    if (this.samples.playVariant(['armor_hit_1', 'armor_hit_2'], {
      gain: heavy ? 0.42 : 0.24, rate: 0.94 + Math.random() * 0.1,
    })) return;

    const jitter = 0.94 + Math.random() * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((heavy ? 640 : 920) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(220 * jitter, now + 0.075);

    gain.gain.setValueAtTime(heavy ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.samples.play('explosion_debris', { gain: 0.46, rate: 0.89 })) {
      this.samples.play('heavy_cannon', { gain: 0.23, lowpass: 650, rate: 0.83 });
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.42);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t0 = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.085, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.19);
    });
  }

  playRepair(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 493.88, 587.33].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });
  }

  playAlertSiren(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(620, now + 0.18);
    osc.frequency.linearRampToValueAtTime(420, now + 0.36);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playDashBoost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.34);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(72, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.34);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.36);
    sub.stop(now + 0.36);
  }

  playBarrelExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.samples.play('explosion_debris', { gain: 0.5, rate: 0.92 })) {
      this.samples.play('heavy_cannon', { gain: 0.3, lowpass: 1100, rate: 0.83 });
      return;
    }

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.52);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(68, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.56);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.6);
    sub.stop(now + 0.6);
  }

  playLockWarning(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.18);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  playPlayerHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.samples.playVariant(['armor_hit_1','armor_hit_2'], { gain: 0.29, rate: 0.88 })) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(98, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playVictorySting(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [330, 440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.34);
    });
  }

  playDefeatSting(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.63, 220, 174.61];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t0 = now + idx * 0.13;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });
  }

  playTreeSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastTreeSnapAt < 0.09) return;
    this.lastTreeSnapAt = now;

    const jitter = 0.9 + Math.random() * 0.22;
    const osc = ctx.createOscillator();
    const body = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(125 * jitter, now + 0.11);

    body.type = 'triangle';
    body.frequency.setValueAtTime(195 * jitter, now);
    body.frequency.exponentialRampToValueAtTime(68, now + 0.14);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    body.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    body.start(now);
    osc.stop(now + 0.16);
    body.stop(now + 0.16);
  }

  playTreeThud(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastTreeThudAt < 0.08) return;
    this.lastTreeThudAt = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.19);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  /**
   * Muffled low-pass distant horizon cannonade / orbital thunder.
   * Only plays when AudioContext is already unlocked & running (never triggers autoplay warnings).
   */
  playDistantCannonade(orbital = false): void {
    if (this.muted || this.paused || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!orbital && now - this.lastDistantBoomAt < 2.6) return;
    this.lastDistantBoomAt = now;
    if (this.samples.play('heavy_cannon', {
      gain: orbital ? 0.06 : 0.035, lowpass: orbital ? 330 : 215,
      rate: orbital ? 0.75 : 0.82,
    })) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(orbital ? 220 : 165, now);
    filter.Q.setValueAtTime(0.9, now);

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    const jitter = 0.88 + Math.random() * 0.24;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime((orbital ? 84 : 62) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + (orbital ? 1.15 : 0.72));

    sub.type = 'triangle';
    sub.frequency.setValueAtTime((orbital ? 48 : 38) * jitter, now);
    sub.frequency.exponentialRampToValueAtTime(18, now + (orbital ? 1.2 : 0.75));

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(orbital ? 0.075 : 0.042, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (orbital ? 1.25 : 0.78));

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    sub.start(now);
    osc.stop(now + (orbital ? 1.28 : 0.8));
    sub.stop(now + (orbital ? 1.28 : 0.8));
  }

  /**
   * Low-pass Doppler jet/VTOL turbine roar when a heavy dropship passes overhead.
   */
  playDropshipFlyby(): void {
    if (this.muted || this.paused || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.linearRampToValueAtTime(380, now + 0.95);
    filter.frequency.exponentialRampToValueAtTime(135, now + 2.35);
    filter.Q.setValueAtTime(1.1, now);

    const turbine = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    turbine.type = 'sawtooth';
    turbine.frequency.setValueAtTime(84, now);
    turbine.frequency.linearRampToValueAtTime(106, now + 0.9);
    turbine.frequency.exponentialRampToValueAtTime(52, now + 2.35);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(46, now);
    sub.frequency.linearRampToValueAtTime(58, now + 0.9);
    sub.frequency.exponentialRampToValueAtTime(30, now + 2.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.068, now + 0.85);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    turbine.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    turbine.start(now);
    sub.start(now);
    turbine.stop(now + 2.45);
    sub.stop(now + 2.45);
  }
}

export const combatAudio = new CombatAudioEngine();
