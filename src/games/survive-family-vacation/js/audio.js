/* ------------------------------------------------------------------ *
 * Audio
 * All music and sound is synthesised in the browser with Web Audio, so
 * the site stays a static bundle with no audio downloads. Cozy scenes
 * get a plucked folk loop; mystery scenes get drones, wind and bells.
 * ------------------------------------------------------------------ */

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

const CHORDS = {
  cozy: [
    { root: 55, notes: [67, 71, 74, 79] },
    { root: 48, notes: [64, 67, 72, 76] },
    { root: 55, notes: [67, 71, 74, 79] },
    { root: 50, notes: [66, 69, 74, 78] },
  ],
  mystery: [
    { root: 45, notes: [57, 60, 64, 69] },
    { root: 41, notes: [53, 57, 60, 65] },
    { root: 43, notes: [55, 58, 62, 67] },
    { root: 45, notes: [57, 60, 64, 71] },
  ],
  boss: [
    { root: 43, notes: [55, 58, 62, 67] },
    { root: 46, notes: [58, 62, 65, 70] },
    { root: 41, notes: [53, 57, 60, 65] },
    { root: 43, notes: [55, 58, 62, 67] },
  ],
};

export class VacationAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.scene = 'none';
    this.muted = false;
    this.musicVolume = 0.45;
    this.sfxVolume = 0.7;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.unlocked = false;
  }

  /* Browsers only allow audio after a gesture, so the first click or key
     press calls this and every later sound works. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
    } catch (error) {
      return;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.unlocked = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    if (this.scene !== 'none') this.startScheduler();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.ctx) {
      this.musicGain.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
  }

  setScene(scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.step = 0;
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.12;
    if (scene === 'none') this.stopScheduler();
    else this.startScheduler();
  }

  startScheduler() {
    if (this.timer || !this.ctx) return;
    this.timer = window.setInterval(() => this.schedule(), 140);
    this.schedule();
  }

  stopScheduler() {
    if (!this.timer) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    if (!this.ctx || !this.musicGain) return;
    const scene = this.scene;
    if (scene === 'none') return;

    const tempo = scene === 'boss' ? 138 : scene === 'mystery' ? 58 : scene === 'title' ? 84 : 96;
    const eighth = 30 / tempo;
    const horizon = this.ctx.currentTime + 0.5;

    while (this.nextTime < horizon) {
      this.playStep(scene, this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  playStep(scene, step, time, eighth) {
    const chords = CHORDS[scene] ?? CHORDS.cozy;
    const bar = Math.floor(step / 8) % chords.length;
    const chord = chords[bar];
    const inBar = step % 8;

    if (scene === 'mystery') {
      if (inBar === 0) {
        this.drone(midiToHz(chord.root), time, eighth * 8);
        this.wind(time, eighth * 4);
        this.bell(midiToHz(chord.notes[step % chord.notes.length] + 12), time + eighth * 2, 0.7);
      }
      if (inBar === 4 && step % 16 === 4) {
        this.bell(midiToHz(chord.notes[(step + 1) % chord.notes.length] + 12), time, 0.5);
      }
      if (step % 32 === 16) this.bell(midiToHz(chord.root + 36), time, 1.2, 0.05);
      return;
    }

    if (scene === 'boss') {
      this.pluck(midiToHz(chord.root - 12), time, 0.22, 'sawtooth', 0.16);
      this.pluck(midiToHz(chord.root + 12), time + eighth * 0.5, 0.16, 'square', 0.05);
      if (inBar % 2 === 0) {
        this.pluck(midiToHz(chord.notes[(inBar / 2) % chord.notes.length]), time, 0.18, 'triangle', 0.1);
      }
      if (step % 16 === 0) this.kick(time);
      return;
    }

    /* Cozy and title: gentle arpeggio with a walking bass and a whistle. */
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    if (inBar === 0) {
      this.pluck(midiToHz(chord.root), time, 0.5, 'sine', 0.16);
      this.pluck(midiToHz(chord.notes[0]), time + 0.02, 0.7, 'triangle', 0.07);
    }
    if (inBar === 4) this.pluck(midiToHz(chord.root + 7), time, 0.45, 'sine', 0.11);

    const noteIndex = pattern[inBar];
    const midi = chord.notes[noteIndex];
    this.pluck(midiToHz(midi), time, 0.42, 'triangle', 0.1, 1800);

    if (scene !== 'boss' && step % 16 === 6) {
      this.whistle(midiToHz(chord.notes[(step + 2) % chord.notes.length] + 12), time, eighth * 1.6);
    }
  }

  /* ------------------------------------------------------------- voices */
  pluck(freq, time, duration, type = 'triangle', gain = 0.12, cutoff = 2400) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter).connect(amp).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  drone(freq, time, duration) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, time + duration);

    [0, 0.4, -0.4].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * 0.5;
      osc.detune.value = detune * 12;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.1);
    });

    filter.connect(gain).connect(this.musicGain);
  }

  wind(time, duration) {
    const ctx = this.ctx;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i += 1) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      data[i] = last * 2.4;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.6;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.22, time + 0.9);
    amp.gain.linearRampToValueAtTime(0.0001, time + duration);

    source.connect(filter).connect(amp).connect(this.musicGain);
    source.start(time);
    source.stop(time + duration);
  }

  bell(freq, time, duration, gain = 0.09) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(amp).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  whistle(freq, time, duration) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const amp = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain).connect(osc.frequency);

    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.05, time + 0.06);
    amp.gain.linearRampToValueAtTime(0.04, time + duration * 0.7);
    amp.gain.linearRampToValueAtTime(0.0001, time + duration);

    osc.connect(amp).connect(this.musicGain);
    osc.start(time);
    lfo.start(time);
    osc.stop(time + duration + 0.04);
    lfo.stop(time + duration + 0.04);
  }

  kick(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
    amp.gain.setValueAtTime(0.22, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(amp).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  /* ---------------------------------------------------------------- sfx */
  sfx(name) {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + 0.01;

    switch (name) {
      case 'click':
        this.blip(660, now, 0.07, 'square', 0.05);
        break;
      case 'pickup':
        this.blip(784, now, 0.09, 'triangle', 0.12);
        this.blip(1046, now + 0.08, 0.12, 'triangle', 0.12);
        this.blip(1318, now + 0.17, 0.2, 'triangle', 0.1);
        break;
      case 'clue':
        this.blip(523, now, 0.12, 'sine', 0.09);
        this.blip(659, now + 0.1, 0.12, 'sine', 0.08);
        this.blip(880, now + 0.2, 0.3, 'sine', 0.07);
        break;
      case 'secret':
        [523, 659, 784, 1046, 1318].forEach((freq, index) => {
          this.blip(freq, now + index * 0.075, 0.3, 'triangle', 0.09);
        });
        break;
      case 'swap':
        this.blip(392, now, 0.08, 'square', 0.06);
        this.blip(587, now + 0.06, 0.1, 'square', 0.05);
        break;
      case 'investigate':
        this.blip(1200, now, 0.3, 'sine', 0.04);
        this.blip(1600, now + 0.1, 0.3, 'sine', 0.03);
        break;
      case 'fail':
        this.blip(392, now, 0.16, 'sawtooth', 0.08);
        this.blip(311, now + 0.14, 0.2, 'sawtooth', 0.08);
        this.blip(233, now + 0.3, 0.4, 'sawtooth', 0.07);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((freq, index) => {
          this.blip(freq, now + index * 0.12, 0.34, 'triangle', 0.1);
        });
        this.kick(now);
        break;
      case 'boss':
        this.blip(110, now, 0.5, 'sawtooth', 0.12);
        this.blip(82, now + 0.1, 0.6, 'sawtooth', 0.1);
        break;
      case 'bonk':
        this.blip(220, now, 0.14, 'square', 0.11);
        this.blip(160, now + 0.06, 0.18, 'square', 0.08);
        break;
      default:
        break;
    }
  }

  blip(freq, time, duration, type = 'sine', gain = 0.08) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(amp).connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }
}
