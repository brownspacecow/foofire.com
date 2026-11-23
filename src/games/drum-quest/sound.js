/* -------------------------------------------------------------------------
 * Drum Quest — drum sounds, synthesized live with Web Audio.
 * No audio files, no samples. Kick is a sine pitch drop, snare is noise
 * plus a body tone, hi-hat is filtered noise, tom is a pitched sine, and
 * crash is a longer noise wash, and ride is a metallic ping with a
 * longer sustain. Same ideas as rhythm-break's kit, kept small enough
 * for one kid-sized game.
 * ---------------------------------------------------------------------- */

export class DrumSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
  }

  async ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is not available in this browser.');
      this.ctx = new Ctor();
      this.noise = this._noiseBuffer(2);

      const master = this.ctx.createGain();
      master.gain.value = this.muted ? 0.0001 : 0.9;
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.25;
      master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.master = master;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0.0001 : 0.9, now + 0.1);
  }

  /** Play one drum now (or at an AudioContext time when given). */
  async play(drum, when = null, gain = 1) {
    await this.ensure();
    const time = when ?? this.ctx.currentTime;
    switch (drum) {
      case 'kick':
        this._kick(time, gain);
        break;
      case 'snare':
        this._snare(time, gain);
        break;
      case 'hihat':
        this._hat(time, gain);
        break;
      case 'tom':
        this._tom(time, gain);
        break;
      case 'crash':
        this._crash(time, gain);
        break;
      case 'ride':
        this._ride(time, gain);
        break;
      default:
        break;
    }
  }

  /** Short metronome click; accented on beat 1. */
  async click(accent = false) {
    await this.ensure();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = accent ? 1320 : 880;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.1, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** A tiny happy blip for finishing one step of a lesson. */
  async blip(step = 0) {
    await this.ensure();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = [659.25, 739.99, 830.61, 987.77, 1108.73];
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = notes[step % notes.length];
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** A happy little three-note cheer for finishing a pattern. */
  async cheer() {
    await this.ensure();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const at = now + i * 0.09;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(env);
      env.connect(this.master);
      osc.start(at);
      osc.stop(at + 0.3);
    });
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noiseSource(time, duration) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.start(time, Math.random() * 1.5);
    source.stop(time + duration + 0.02);
    return source;
  }

  _kick(time, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.85 * gain, time + 0.007);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(env);
    env.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.36);

    // A little beater click so the kick cuts through on a phone speaker.
    const click = this._noiseSource(time, 0.03);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1700;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.1 * gain, time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    click.connect(high);
    high.connect(clickGain);
    clickGain.connect(this.master);
  }

  _snare(time, gain = 1) {
    const ctx = this.ctx;
    const source = this._noiseSource(time, 0.21);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1850;
    band.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.3 * gain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    source.connect(band);
    band.connect(env);
    env.connect(this.master);

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, time);
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.12 * gain, time + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    body.connect(bodyGain);
    bodyGain.connect(this.master);
    body.start(time);
    body.stop(time + 0.12);
  }

  _hat(time, gain = 1) {
    const ctx = this.ctx;
    const source = this._noiseSource(time, 0.06);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.12 * gain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);
    source.connect(high);
    high.connect(env);
    env.connect(this.master);
  }

  _tom(time, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.18);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.3 * gain, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(env);
    env.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  _crash(time, gain = 1) {
    const ctx = this.ctx;
    const source = this._noiseSource(time, 1.15);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 5200;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.09 * gain, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
    source.connect(high);
    high.connect(env);
    env.connect(this.master);
  }

  /**
   * Ride cymbal: a metallic ping, clearly different from the crash.
   * Inharmonic partials ring out with a long sustain, and only a short,
   * quiet stick tick of noise — no big noise wash like the crash.
   */
  _ride(time, gain = 1) {
    const ctx = this.ctx;
    // Bell-like partials of a ride: a low fundamental plus inharmonic
    // overtones that shimmer instead of washing out.
    const partials = [
      [412, 0.16],
      [587, 0.1],
      [823, 0.08],
      [1187, 0.05],
      [1643, 0.03],
    ];
    for (const [freq, level] of partials) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(level * gain, time + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 1.9);
      osc.connect(env);
      env.connect(this.master);
      osc.start(time);
      osc.stop(time + 1.95);
    }
    // Just the stick tick on the metal, then the ring takes over.
    const tick = this._noiseSource(time, 0.03);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 6000;
    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(0.12 * gain, time);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    tick.connect(high);
    high.connect(tickGain);
    tickGain.connect(this.master);
  }
}
