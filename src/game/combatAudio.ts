class CombatAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
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
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
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
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  playAutocannonShot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastShotSoundAt < 0.055) return;
    this.lastShotSoundAt = now;

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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!orbital && now - this.lastDistantBoomAt < 2.6) return;
    this.lastDistantBoomAt = now;

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
}

export const combatAudio = new CombatAudioEngine();
