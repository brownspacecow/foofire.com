// Crypt Crawl chiptune engine — authentic NES-style sound, synthesized
// in code. No audio files. Three channels, like the NES:
//   square   — melody + SFX lead
//   triangle — bass
//   noise    — percussion (hits, hats)
// Nothing here uses sine or sawtooth. Volumes are kept low and
// kid-friendly. Music starts only after a user gesture (DESCEND) and
// loops seamlessly via a lookahead step sequencer.

/** MIDI note number -> frequency in Hz. */
export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// ---- the dungeon loop: an original 4-bar A-minor tune ----
// 32 eighth-note steps at 132 BPM (one loop ≈ 7.3 s).
// melody: square-wave lead. bass: triangle-wave roots.
// hat: 1 on off-beat steps (soft noise ticks), 0 elsewhere.
export const MUSIC = {
  bpm: 132,
  steps: 32,
  melody: [
    69, 69, 72, 76, 74, 72, 69, 67, // bar 1: A A C E | D C A G
    69, 69, 72, 76, 74, 76, 74, 72, // bar 2: A A C E | D E D C
    65, 65, 69, 72, 74, 72, 69, 65, // bar 3: F F A C | D C A F
    64, 64, 67, 71, 69, null, null, null, // bar 4: E E G B | A . . .
  ],
  bass: [
    45, null, 45, null, 45, null, 45, null, // bar 1: A
    45, null, 45, null, 45, null, 45, null, // bar 2: A
    41, null, 41, null, 41, null, 41, null, // bar 3: F
    40, null, 40, null, 40, null, 45, null, // bar 4: E, walk up to A
  ],
  hat: [
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
  ],
};

// ---- SFX as pure data: each note is { m (MIDI), t (offset s), d (dur s),
// w ('square'|'triangle'), v (volume) } or { noise: true, t, d, v, f }.
// The engine in this file plays them; node tests validate the tables.
export const SFX = {
  blip: [{ m: 81, t: 0, d: 0.06, w: 'square', v: 0.05 }], // button press
  pop: [
    { m: 72, t: 0, d: 0.05, w: 'square', v: 0.06 },
    { m: 76, t: 0.04, d: 0.05, w: 'square', v: 0.06 },
    { m: 79, t: 0.08, d: 0.06, w: 'square', v: 0.06 },
  ], // match pop: quick square arpeggio up
  hit: [
    { noise: true, t: 0, d: 0.12, v: 0.1, f: 1200 },
    { m: 45, t: 0, d: 0.14, w: 'square', v: 0.09 },
  ], // sword hit: noise burst + low square thud
  hurt: [
    { m: 67, t: 0, d: 0.09, w: 'square', v: 0.07 },
    { m: 63, t: 0.09, d: 0.09, w: 'square', v: 0.07 },
    { m: 58, t: 0.18, d: 0.12, w: 'square', v: 0.07 },
  ], // monster bite: descending square notes
  heal: [
    { m: 72, t: 0, d: 0.07, w: 'triangle', v: 0.06 },
    { m: 76, t: 0.06, d: 0.07, w: 'triangle', v: 0.06 },
    { m: 79, t: 0.12, d: 0.07, w: 'triangle', v: 0.06 },
    { m: 84, t: 0.18, d: 0.12, w: 'triangle', v: 0.06 },
  ], // heal: ascending triangle arpeggio
  coin: [
    { m: 83, t: 0, d: 0.07, w: 'square', v: 0.06 },
    { m: 88, t: 0.07, d: 0.14, w: 'square', v: 0.06 },
  ], // coin: classic two-note square ding
  clear: [
    { m: 72, t: 0, d: 0.11, w: 'square', v: 0.06 },
    { m: 76, t: 0.09, d: 0.11, w: 'square', v: 0.06 },
    { m: 79, t: 0.18, d: 0.11, w: 'square', v: 0.06 },
    { m: 84, t: 0.27, d: 0.2, w: 'square', v: 0.06 },
  ], // floor clear: short 4-note fanfare
  boss: [
    { m: 45, t: 0, d: 0.18, w: 'square', v: 0.07 },
    { m: 43, t: 0.18, d: 0.18, w: 'square', v: 0.07 },
    { m: 45, t: 0.36, d: 0.18, w: 'square', v: 0.07 },
    { m: 41, t: 0.54, d: 0.3, w: 'square', v: 0.07 },
  ], // boss appear: low warning notes
  relic: [
    { m: 84, t: 0, d: 0.06, w: 'square', v: 0.06 },
    { m: 88, t: 0.05, d: 0.06, w: 'square', v: 0.06 },
    { m: 91, t: 0.1, d: 0.06, w: 'square', v: 0.06 },
    { m: 96, t: 0.15, d: 0.14, w: 'square', v: 0.06 },
  ], // relic pick: sparkle arpeggio
  over: [
    { m: 67, t: 0, d: 0.16, w: 'square', v: 0.07 },
    { m: 63, t: 0.16, d: 0.16, w: 'square', v: 0.07 },
    { m: 60, t: 0.32, d: 0.16, w: 'square', v: 0.07 },
    { m: 55, t: 0.48, d: 0.3, w: 'square', v: 0.07 },
  ], // game over: descending jingle
  shuffle: [
    { m: 76, t: 0, d: 0.05, w: 'square', v: 0.05 },
    { m: 79, t: 0.05, d: 0.05, w: 'square', v: 0.05 },
    { m: 76, t: 0.1, d: 0.05, w: 'square', v: 0.05 },
    { m: 79, t: 0.15, d: 0.08, w: 'square', v: 0.05 },
  ], // no-moves shuffle: quick square shuffle
};

export class Chiptune {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.muted = false;
    this.musicTimer = null;
    this.nextStepTime = 0;
    this.step = 0;
  }

  ensureCtx() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { /* audio unavailable */ }
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (m) this.stopMusic();
  }

  tone({ type, freq, when, dur, vol }) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(when);
      o.stop(when + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  noise({ when, dur, vol, freq }) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 4000;
      filter.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      src.start(when);
      src.stop(when + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  playNote(note, when) {
    if (note.noise) {
      this.noise({ when, dur: note.d, vol: note.v, freq: note.f });
    } else {
      this.tone({
        type: note.w || 'square',
        freq: midiToFreq(note.m),
        when,
        dur: note.d,
        vol: note.v,
      });
    }
  }

  playSfx(name) {
    if (this.muted) return;
    const table = SFX[name];
    if (!table) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const note of table) this.playNote(note, now + note.t);
  }

  // Named SFX, matching the game.js call sites.
  blip() { this.playSfx('blip'); }
  pop() { this.playSfx('pop'); }
  hit() { this.playSfx('hit'); }
  hurt() { this.playSfx('hurt'); }
  heal() { this.playSfx('heal'); }
  coin() { this.playSfx('coin'); }
  clear() { this.playSfx('clear'); }
  boss() { this.playSfx('boss'); }
  relic() { this.playSfx('relic'); }
  over() { this.playSfx('over'); }
  shuffle() { this.playSfx('shuffle'); }

  // Drag-path tick: pitch climbs with the path, like a rising arpeggio.
  tick(step) {
    if (this.muted) return;
    this.ensureCtx();
    if (!this.ctx) return;
    this.tone({
      type: 'square',
      freq: 440 + step * 60,
      when: this.ctx.currentTime,
      dur: 0.04,
      vol: 0.035,
    });
  }

  // ---- background music: lookahead step sequencer ----
  get stepDur() {
    return 60 / MUSIC.bpm / 2; // eighth notes
  }

  startMusic() {
    if (this.muted || this.musicTimer) return;
    this.ensureCtx();
    if (!this.ctx) return;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    if (!this.ctx) return;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % MUSIC.steps;
      this.nextStepTime += this.stepDur;
    }
  }

  scheduleStep(i, when) {
    const mel = MUSIC.melody[i];
    if (mel !== null && mel !== undefined) {
      this.tone({ type: 'square', freq: midiToFreq(mel), when, dur: this.stepDur * 0.92, vol: 0.045 });
    }
    const bass = MUSIC.bass[i];
    if (bass !== null && bass !== undefined) {
      this.tone({ type: 'triangle', freq: midiToFreq(bass), when, dur: this.stepDur * 1.8, vol: 0.07 });
    }
    if (MUSIC.hat[i]) {
      this.noise({ when, dur: 0.03, vol: 0.015, freq: 7000 });
    }
  }
}

export function createChiptune() {
  return new Chiptune();
}
