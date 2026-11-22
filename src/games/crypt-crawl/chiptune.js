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

// ---- the dungeon loop: an original 16-bar A-minor tune ----
// 128 eighth-note steps at 132 BPM (one loop ≈ 29 s).
// Deliberately, unmistakably minor: the melody leans hard on the minor
// 3rd (C) and minor 6th (F), the bass walks Am–F–Dm–E, and bars 4, 8,
// 12 and 16 use the harmonic-minor raised 7th (G#) as a leading tone
// back to A. No major 3rd (C#) or major 6th (F#) anywhere in the melody.
// Bars 1–4 are the tune players already know. Bars 5–8 answer it: bar 5
// lifts into a higher register, bar 6 turns darker with a long
// descending line, bar 7 climbs back, and bar 8 cadences home to A.
// Bars 9–16 are a third section, a bridge: bars 9–12 wander somewhere
// new (C–G–F–E in the bass, melody drifting through G and B over the
// C and G chords, then a dark descent over F and a G# turn over E),
// bars 13–14 climb back up high over Am and F, bar 15 descends over Dm,
// and bar 16 cadences home to A so the loop point (bar 16 → bar 1,
// both on A) is seamless.
// melody: square-wave lead. bass: triangle-wave roots.
// hat: 1 on off-beat steps (soft noise ticks), 0 elsewhere.
export const MUSIC = {
  bpm: 132,
  steps: 128,
  melody: [
    69, 72, 76, 72, 69, 72, 69, 67, // bar 1 (Am): A C E C | A C A G
    65, 69, 72, 77, 76, 72, 69, 65, // bar 2 (F):  F A C F | E C A F
    62, 65, 69, 74, 72, 69, 65, 62, // bar 3 (Dm): D F A D | C A F D
    64, 68, 71, 76, 71, 68, 69, null, // bar 4 (E→Am): E G# B E | B G# A .
    76, 81, 84, 81, 79, 76, 72, 69, // bar 5 (Am): E A C A | G E C A — lift
    77, 76, 74, 72, 71, 69, 67, 65, // bar 6 (F):  F E D C | B A G F — darker descent
    62, 65, 69, 72, 74, 77, 76, 74, // bar 7 (Dm): D F A C | D F E D — climb back
    64, 68, 71, 76, 79, 76, 72, 69, // bar 8 (E→Am): E G# B E | G E C A — home
    72, 79, 84, 79, 76, 79, 72, 69, // bar 9 (C):  E G C G | E G E A — bridge opens
    67, 71, 74, 79, 74, 71, 67, 64, // bar 10 (G): G B D G | D B G E
    77, 76, 74, 72, 71, 69, 67, 65, // bar 11 (F): F E D C | B A G F — dark descent
    64, 68, 71, 76, 79, 76, 71, 68, // bar 12 (E): E G# B E | G E B G# — turn
    81, 79, 76, 72, 76, 79, 81, 84, // bar 13 (Am): A G E C | E G A C — climb back up
    84, 81, 79, 77, 76, 79, 81, 84, // bar 14 (F): C A G F | E G A C — high
    84, 81, 79, 77, 76, 74, 72, 69, // bar 15 (Dm): C A G F | E D C A — descend
    76, 79, 81, 84, 79, 76, 72, 69, // bar 16 (E→Am): E G A C | G E C A — home
  ],
  bass: [
    45, null, 45, null, 45, null, 45, null, // bar 1: A
    41, null, 41, null, 41, null, 41, null, // bar 2: F
    38, null, 38, null, 38, null, 38, null, // bar 3: D
    40, null, 40, null, 40, null, 45, null, // bar 4: E, walk up to A
    45, null, 45, null, 45, null, 45, null, // bar 5: A
    41, null, 41, null, 41, null, 41, null, // bar 6: F
    38, null, 38, null, 38, null, 38, null, // bar 7: D
    40, null, 40, null, 40, null, 45, null, // bar 8: E, walk up to A
    48, null, 48, null, 48, null, 48, null, // bar 9: C
    43, null, 43, null, 43, null, 43, null, // bar 10: G
    41, null, 41, null, 41, null, 41, null, // bar 11: F
    40, null, 40, null, 40, null, 45, null, // bar 12: E, walk up to A
    45, null, 45, null, 45, null, 45, null, // bar 13: A
    41, null, 41, null, 41, null, 41, null, // bar 14: F
    38, null, 38, null, 38, null, 38, null, // bar 15: D
    40, null, 40, null, 40, null, 45, null, // bar 16: E, walk up to A
  ],
  hat: [
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
    0, 1, 0, 1, 0, 1, 0, 1,
  ],
};

// ---- the boss loop: a separate, faster, tenser tune ----
// Same shape as the main loop (32 eighth-note steps, 4 bars) but at
// 156 BPM with a driving triangle bass on EVERY step (no rests), a hat
// on every step, and a tenser square melody — repeated notes, a
// chromatic descent through Bb and G# in bar 3, and a climb to A5 in
// bar 4 that drops back to A. Still A minor at heart, still original,
// still square/triangle/noise only. One loop ≈ 6.2 s.
export const BOSS_MUSIC = {
  bpm: 156,
  steps: 32,
  melody: [
    69, 69, 72, 69, 69, 72, 76, 74, // bar 1: A A C A | A C E D
    69, 69, 72, 76, 79, 76, 74, 72, // bar 2: A A C E | G E D C
    70, 69, 68, 69, 72, 71, 69, 68, // bar 3: Bb A G# A | C B A G#
    69, 72, 76, 79, 81, 79, 76, 69, // bar 4: A C E G | A G E A
  ],
  bass: [
    45, 45, 45, 45, 45, 45, 45, 45, // bar 1: A, driving
    45, 45, 45, 45, 45, 45, 45, 45, // bar 2: A, driving
    45, 45, 44, 44, 45, 45, 44, 44, // bar 3: A/G# walk
    40, 40, 40, 40, 40, 40, 45, 45, // bar 4: E, lift to A
  ],
  hat: [
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
  ],
};

// ---- SFX as pure data: each note is { m (MIDI), t (offset s), d (dur s),
// w ('square'|'triangle'), v (volume) }, { noise: true, t, d, v, f },
// or a pitch slide { slide: true, m0 (start MIDI), m1 (end MIDI),
// t, d, w, v, vib (vibrato Hz, optional) }.
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
  scream: [
    // Death scream: a square-wave pitch slide falling fast, high to low,
    // with a fast vibrato wobble, layered over a short noise burst, and
    // ending in a low sliding "poof" thud. Bosses play it transposed
    // down an octave and stretched 1.5x (see Chiptune.scream).
    { slide: true, m0: 96, m1: 60, t: 0, d: 0.45, w: 'square', v: 0.09, vib: 28 },
    { noise: true, t: 0, d: 0.3, v: 0.06, f: 2500 },
    { slide: true, m0: 41, m1: 36, t: 0.45, d: 0.15, w: 'square', v: 0.08 },
  ],
};

/** Pure helper: transpose + stretch an SFX table (used for the boss
 *  scream — same scream, an octave lower and 1.5x longer). */
export function transformSfxNotes(table, { shift = 0, stretch = 1 } = {}) {
  return table.map((note) => {
    const n = { ...note };
    n.t = note.t * stretch;
    n.d = note.d * stretch;
    if (n.m !== undefined) n.m += shift;
    if (n.m0 !== undefined) { n.m0 += shift; n.m1 += shift; }
    return n;
  });
}

// ---- match sound, scaled by path length ----
// The longer the drag, the more epic the payoff. Same A-minor arpeggio
// shape throughout, so a 3-tile match is still instantly recognisable:
//   len 3: the short 3-note arpeggio (identical to SFX.pop)
//   len 4: a 4-note arpeggio, brighter and a touch longer
//   len 5: a 5-note arpeggio plus a quiet harmony voice a minor 3rd
//          below on the top notes
//   len 6+: 6+ ascending notes, harmony on the top notes, a noise crash
//          and a low triangle boom underneath — the full fanfare
// Lead notes climb the A-minor ladder [72, 76, 79, 84, 88, 91, 96, ...];
// very long paths cap the ladder at 96 and hold the top note longer.
// All volumes ≤ 0.09 per note, square/triangle/noise only.
const MATCH_LADDER = [72, 76, 79, 84, 88, 91, 96, 96];
export function matchPopNotes(len) {
  const n = Math.max(3, Math.min(len, 8));
  const leadCount = Math.min(n, MATCH_LADDER.length);
  const notes = [];
  for (let i = 0; i < leadCount; i++) {
    notes.push({
      m: MATCH_LADDER[i],
      t: i * 0.04,
      // Len 3 reproduces the old SFX.pop table exactly (final note 0.06);
      // longer paths hold the top note longer for a bigger finish.
      d: i === leadCount - 1 ? (leadCount === 3 ? 0.06 : 0.14) : 0.05,
      w: 'square',
      v: 0.06,
    });
  }
  if (n >= 5) {
    // Harmony voice, a minor 3rd below the top three lead notes.
    for (let i = leadCount - 3; i < leadCount; i++) {
      notes.push({
        m: MATCH_LADDER[i] - 4,
        t: i * 0.04,
        d: 0.07,
        w: 'square',
        v: 0.04,
      });
    }
  }
  if (n >= 6) {
    // Noise crash + low triangle boom for the full epic treatment.
    notes.push({ noise: true, t: 0, d: 0.25, v: 0.08, f: 5000 });
    notes.push({ m: 33, t: 0, d: 0.3, w: 'triangle', v: 0.09 });
  }
  return notes;
}

export class Chiptune {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.muted = false;
    this.musicTimer = null;
    this.nextStepTime = 0;
    this.step = 0;
    // Which loop should be playing: 'main' or 'boss'. `playingMusic` is
    // the table the running sequencer is actually playing (set at start,
    // so a track switch always restarts the sequencer cleanly).
    this.track = 'main';
    this.playingTrack = null;
    this.playingMusic = null;
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

  // A pitch-slide tone: the frequency ramps from `from` to `to`, with an
  // optional fast square-wave vibrato wobble (the death scream's warble).
  slideTone({ type, from, to, when, dur, vol, vib }) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, when);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + dur);
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      let lfo = null;
      if (vib) {
        // Square LFO, ±3% of the starting pitch — square only, so the
        // "no sine/sawtooth" rule still holds for the wobble too.
        lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'square';
        lfo.frequency.value = vib;
        lfoGain.gain.value = from * 0.03;
        lfo.connect(lfoGain);
        lfoGain.connect(o.frequency);
        lfo.start(when);
        lfo.stop(when + dur + 0.02);
      }
      o.start(when);
      o.stop(when + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  playNote(note, when) {
    if (note.noise) {
      this.noise({ when, dur: note.d, vol: note.v, freq: note.f });
    } else if (note.slide) {
      this.slideTone({
        type: note.w || 'square',
        from: midiToFreq(note.m0),
        to: midiToFreq(note.m1),
        when,
        dur: note.d,
        vol: note.v,
        vib: note.vib,
      });
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

  playNotes(notes) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const note of notes) this.playNote(note, now + note.t);
  }

  playSfx(name, opts = {}) {
    if (this.muted) return;
    const table = SFX[name];
    if (!table) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const notes = (opts.shift || opts.stretch)
      ? transformSfxNotes(table, opts)
      : table;
    this.playNotes(notes);
  }

  // Named SFX, matching the game.js call sites.
  blip() { this.playSfx('blip'); }
  // Match pop, scaled by path length: 3 tiles is the short arpeggio,
  // 6+ tiles is the full fanfare (see matchPopNotes).
  pop(len = 3) {
    if (this.muted) return;
    this.ensureCtx();
    if (!this.ctx) return;
    this.playNotes(len <= 3 ? SFX.pop : matchPopNotes(len));
  }
  hit() { this.playSfx('hit'); }
  hurt() { this.playSfx('hurt'); }
  heal() { this.playSfx('heal'); }
  coin() { this.playSfx('coin'); }
  clear() { this.playSfx('clear'); }
  boss() { this.playSfx('boss'); }
  relic() { this.playSfx('relic'); }
  over() { this.playSfx('over'); }
  shuffle() { this.playSfx('shuffle'); }

  // Death scream. Same scream for every monster; bosses get it an octave
  // lower and 1.5x longer (same table, transposed + stretched).
  scream(boss = false) {
    this.playSfx('scream', boss ? { shift: -12, stretch: 1.5 } : {});
  }

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
  // `track` is 'main' or 'boss'. Calling startMusic with a track while
  // the other one is playing restarts the sequencer on the new track —
  // never two loops at once. Calling it with no argument (unpause /
  // unmute) resumes whichever track was selected, and is a no-op when
  // that track is already playing.
  get stepDur() {
    const table = this.playingMusic || MUSIC;
    return 60 / table.bpm / 2; // eighth notes
  }

  startMusic(track) {
    if (track) this.track = track;
    if (this.muted) return;
    if (this.musicTimer) {
      if (this.playingTrack === this.track) return;
      this.stopMusic();
    }
    this.ensureCtx();
    if (!this.ctx) return;
    this.playingTrack = this.track;
    this.playingMusic = this.track === 'boss' ? BOSS_MUSIC : MUSIC;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.playingTrack = null;
    this.playingMusic = null;
  }

  scheduleMusic() {
    if (!this.ctx || !this.playingMusic) return;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % this.playingMusic.steps;
      this.nextStepTime += this.stepDur;
    }
  }

  scheduleStep(i, when) {
    const table = this.playingMusic;
    const mel = table.melody[i];
    if (mel !== null && mel !== undefined) {
      this.tone({ type: 'square', freq: midiToFreq(mel), when, dur: this.stepDur * 0.92, vol: 0.045 });
    }
    const bass = table.bass[i];
    if (bass !== null && bass !== undefined) {
      this.tone({ type: 'triangle', freq: midiToFreq(bass), when, dur: this.stepDur * 1.8, vol: 0.07 });
    }
    if (table.hat[i]) {
      this.noise({ when, dur: 0.03, vol: 0.015, freq: 7000 });
    }
  }
}

export function createChiptune() {
  return new Chiptune();
}
