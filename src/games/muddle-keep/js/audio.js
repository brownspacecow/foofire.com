/* ------------------------------------------------------------------ *
 * Audio
 * Every sound in Keep is synthesised with Web Audio: thumps,
 * coins, pops, bounces, a sleepy dungeon pad. No audio files.
 * ------------------------------------------------------------------ */

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

class MuddleAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.volume = 0.7;
    this.muted = false;
    this.ambientTimer = null;
    this.ambientWanted = false;
    this.ambientCycle = 0;
    this.lastPlayed = 0;
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
      try {
        const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch {
        /* the browser will let us know */
      }
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
    if (this.ambientWanted) this.startAmbient();
  }

  applySettings(settings) {
    this.volume = Math.max(0, Math.min(1, settings.volume ?? 0.7));
    this.muted = Boolean(settings.muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  tone({ freq, endFreq, dur = 0.15, type = 'sine', gain = 0.12, delay = 0 }) {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + dur + 0.03);
  }

  noise({ dur = 0.12, gain = 0.1, freq = 900, delay = 0, q = 1 }) {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(start);
    source.stop(start + dur);
  }

  arpeggio(notes, step = 0.09, gain = 0.09, type = 'triangle') {
    notes.forEach((midi, index) => {
      this.tone({
        freq: midiToHz(midi),
        dur: 0.26,
        gain,
        type,
        delay: index * step,
      });
    });
  }

  play(name, data = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastPlayed < 28 && name !== 'wave' && name !== 'win') return;
    this.lastPlayed = now;

    switch (name) {
      case 'dig':
        this.noise({ dur: 0.14, gain: 0.2, freq: 260 });
        this.tone({ freq: 120, endFreq: 70, dur: 0.16, type: 'triangle', gain: 0.16 });
        break;
      case 'gold':
      case 'deposit':
        this.arpeggio([84, 88, 91], 0.06, 0.07, 'sine');
        break;
      case 'wall':
        this.noise({ dur: 0.16, gain: 0.16, freq: 180 });
        this.tone({ freq: 90, endFreq: 60, dur: 0.2, gain: 0.12 });
        break;
      case 'room':
        this.arpeggio([72, 76, 79], 0.07, 0.08);
        break;
      case 'room-ready':
        this.arpeggio([67, 72, 76, 79], 0.08, 0.09, 'sine');
        break;
      case 'spawn':
        this.tone({ freq: 300, endFreq: 620, dur: 0.32, type: 'sine', gain: 0.09 });
        this.tone({ freq: 450, endFreq: 900, dur: 0.3, type: 'sine', gain: 0.05, delay: 0.05 });
        break;
      case 'pickup':
        this.tone({ freq: 520, endFreq: 780, dur: 0.12, type: 'sine', gain: 0.08 });
        break;
      case 'drop':
        this.tone({ freq: 300, endFreq: 180, dur: 0.12, type: 'triangle', gain: 0.1 });
        break;
      case 'slap':
        this.noise({ dur: 0.07, gain: 0.24, freq: 1400 });
        this.tone({ freq: 620, endFreq: 320, dur: 0.1, type: 'square', gain: 0.06 });
        break;
      case 'zap':
      case 'lightning':
        this.noise({ dur: 0.22, gain: 0.24, freq: 2400 });
        this.tone({ freq: 900, endFreq: 120, dur: 0.3, type: 'sawtooth', gain: 0.08 });
        break;
      case 'heal':
        this.arpeggio([72, 76, 79, 84], 0.07, 0.06, 'sine');
        break;
      case 'haste':
        this.arpeggio([76, 81, 88], 0.05, 0.06, 'square');
        break;
      case 'rally':
        this.tone({ freq: 220, endFreq: 330, dur: 0.4, type: 'sawtooth', gain: 0.08 });
        break;
      case 'hit':
      case 'creature-hit':
      case 'hero-hit':
        this.noise({ dur: 0.06, gain: 0.12, freq: 700 });
        break;
      case 'creature-died':
        this.arpeggio([64, 60, 55], 0.12, 0.07, 'triangle');
        break;
      case 'hero-died':
        this.arpeggio([79, 83, 88], 0.07, 0.08, 'sine');
        break;
      case 'trap':
        this.tone({ freq: 200, endFreq: 900, dur: 0.22, type: 'sine', gain: 0.1 });
        break;
      case 'wall-hit':
      case 'dirt-hit':
      case 'hero-attack-tile':
        this.noise({ dur: 0.08, gain: 0.1, freq: 240 });
        break;
      case 'levelup':
        this.arpeggio([72, 76, 79, 84, 88], 0.08, 0.1, 'triangle');
        break;
      case 'eat':
        this.tone({ freq: 420, endFreq: 240, dur: 0.1, type: 'sine', gain: 0.08 });
        break;
      case 'train':
        this.tone({ freq: 660, endFreq: 660, dur: 0.05, type: 'square', gain: 0.04 });
        break;
      case 'wave':
        this.tone({ freq: 110, endFreq: 150, dur: 0.9, type: 'sawtooth', gain: 0.1 });
        this.tone({ freq: 165, endFreq: 220, dur: 0.9, type: 'sawtooth', gain: 0.06, delay: 0.05 });
        break;
      case 'heart-hit':
        this.noise({ dur: 0.25, gain: 0.22, freq: 120 });
        this.tone({ freq: 70, endFreq: 45, dur: 0.5, type: 'sine', gain: 0.18 });
        break;
      case 'stomp':
        this.tone({ freq: 60, endFreq: 32, dur: 0.4, type: 'sine', gain: 0.2 });
        this.noise({ dur: 0.3, gain: 0.14, freq: 150 });
        break;
      case 'research':
        this.arpeggio([67, 71, 74, 79, 83], 0.09, 0.08, 'sine');
        break;
      case 'wages':
        this.tone({ freq: 520, dur: 0.15, type: 'sine', gain: 0.06 });
        if (!data.ok) this.tone({ freq: 180, dur: 0.4, type: 'triangle', gain: 0.1, delay: 0.1 });
        break;
      case 'win':
        this.arpeggio([60, 64, 67, 72, 76, 79], 0.14, 0.11, 'triangle');
        break;
      case 'lose':
        this.arpeggio([55, 51, 48, 43], 0.2, 0.11, 'sine');
        break;
      case 'error':
        this.tone({ freq: 220, endFreq: 180, dur: 0.18, type: 'square', gain: 0.06 });
        break;
      case 'click':
        this.tone({ freq: 660, dur: 0.05, type: 'square', gain: 0.04 });
        break;
      default:
        break;
    }
  }

  /* ----------------------------------------------------------- ambience */

  startAmbient() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.ambientTimer) return;
    this.scheduleAmbient();
    this.ambientTimer = window.setInterval(() => this.scheduleAmbient(), 9000);
  }

  stopAmbient() {
    if (this.ambientTimer) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  setAmbient(enabled) {
    this.ambientWanted = Boolean(enabled);
    if (!this.ambientWanted) this.stopAmbient();
    else if (this.ctx?.state === 'running') this.startAmbient();
  }

  scheduleAmbient() {
    if (!this.ctx || !this.master) return;
    const chords = [
      [45, 52, 57],
      [43, 50, 55],
      [41, 48, 53],
      [40, 47, 52],
    ];
    const chord = chords[this.ambientCycle % chords.length];
    this.ambientCycle += 1;
    chord.forEach((midi, index) => {
      this.tone({
        freq: midiToHz(midi),
        dur: 7,
        type: index === 0 ? 'sine' : 'triangle',
        gain: 0.025,
      });
    });
    for (let i = 0; i < 3; i += 1) {
      const note = chord[1 + (i % 2)] + 12 + (i % 2 === 0 ? 0 : 3);
      this.tone({
        freq: midiToHz(note),
        dur: 1.6,
        type: 'sine',
        gain: 0.022,
        delay: 1.5 + i * 2.1,
      });
    }
  }
}

export const audio = new MuddleAudio();
