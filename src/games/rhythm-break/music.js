/* -------------------------------------------------------------------------
 * Soft Reset — original instrumentals, synthesized live with Web Audio.
 * No audio files, no samples. Everything here is generated in the browser.
 *
 * The compositor builds one flat timeline of musical events (in beats) plus
 * the note chart. The audio scheduler and the game both read the same times,
 * so the notes always land with the drums.
 *
 * Each track has an eight-bar progression, alternating drum/bass/key patterns
 * every two bars, section-end fills, and two different eight-bar lead phrases.
 * ---------------------------------------------------------------------- */

const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/* Chart patterns live on the same 16-step grid as the drums.
 * Each entry is [step, lane]. Lane 0 is the left pad, lane 3 the right. */
const CHART_PATTERNS = {
  a: [
    [0, 0],
    [4, 1],
    [8, 2],
    [12, 3],
  ],
  b: [
    [0, 0],
    [2, 1],
    [4, 2],
    [6, 1],
    [8, 3],
    [10, 2],
    [12, 1],
    [14, 0],
  ],
  c: [
    [0, 2],
    [3, 1],
    [4, 2],
    [7, 3],
    [8, 2],
    [11, 1],
    [12, 0],
    [14, 3],
  ],
  d: [
    [0, 2],
    [2, 3],
    [4, 1],
    [6, 0],
    [8, 1],
    [10, 3],
    [12, 2],
    [13, 1],
    [14, 0],
  ],
  e: [
    [0, 0],
    [2, 1],
    [4, 2],
    [6, 3],
    [8, 2],
    [10, 1],
    [12, 0],
    [14, 1],
    [15, 2],
  ],
  g: [
    [0, 1],
    [6, 2],
    [8, 1],
    [14, 3],
  ],
};

/* Gentle mode swaps the busy patterns for their straight-eighth cousins so
 * a tired brain never has to chase a sixteenth note. */
const GENTLE_SUBSTITUTE = { a: 'a', b: 'b', c: 'b', d: 'b', e: 'b', g: 'g' };

const HATS_8 = [0, 2, 4, 6, 8, 10, 12, 14];

/* ------------------------------------------------------------- Golden Hour */

const GOLDEN_HOUR = {
  id: 'golden-hour',
  title: 'Golden Hour',
  blurb: 'Warm Rhodes chords, dusty drums and a bassline that strolls. For the 4 p.m. kitchen dance.',
  vibe: 'Warm · unhurried',
  bpm: 90,
  swing: 0.05,
  lengthLabel: '1:41',
  echo: 0.2,
  echoWet: 0.22,
  vinylGain: 0.05,
  palette: {
    sky: ['#251027', '#4a2130'],
    glow: '#f6c976',
    haze: '#ff9a8b',
  },
  progression: [
    { voicing: [53, 57, 60, 64, 67], root: 41, alt: 45, fifth: 48 },
    { voicing: [50, 53, 57, 60, 64], root: 38, alt: 41, fifth: 45 },
    { voicing: [52, 55, 59, 62], root: 40, alt: 43, fifth: 47 },
    { voicing: [48, 52, 55, 59, 62], root: 36, alt: 40, fifth: 43 },
    { voicing: [53, 57, 60, 64, 67], root: 41, alt: 45, fifth: 48 },
    { voicing: [50, 53, 57, 60, 64], root: 38, alt: 41, fifth: 45 },
    { voicing: [46, 50, 53, 57, 60], root: 34, alt: 38, fifth: 41 },
    { voicing: [48, 53, 55, 58, 60], root: 36, alt: 39, fifth: 43 },
  ],
  keysPatterns: [
    [
      { step: 0, len: 2.4, gain: 1 },
      { step: 7, len: 1.3, gain: 0.7 },
      { step: 11, len: 1.5, gain: 0.55 },
    ],
    [
      { step: 0, len: 3.2, gain: 0.9 },
      { step: 6, len: 1.2, gain: 0.65 },
      { step: 10, len: 1.6, gain: 0.75 },
    ],
    [
      { step: 2, len: 1.4, gain: 0.7 },
      { step: 8, len: 2.4, gain: 1 },
      { step: 12, len: 1.2, gain: 0.6 },
    ],
  ],
  bassPatterns: [
    [
      { step: 0, note: 'root', len: 2.2, gain: 1 },
      { step: 6, note: 'root', len: 0.8, gain: 0.8 },
      { step: 10, note: 'alt', len: 1.2, gain: 0.9 },
      { step: 14, note: 'fifth', len: 0.7, gain: 0.7 },
    ],
    [
      { step: 0, note: 'root', len: 1.4, gain: 1 },
      { step: 3, note: 'fifth', len: 0.7, gain: 0.7 },
      { step: 7, note: 'root', len: 1, gain: 0.85 },
      { step: 11, note: 'alt', len: 1.4, gain: 0.8 },
      { step: 14, note: 'octave', len: 0.6, gain: 0.6 },
    ],
  ],
  leads: [
    [
      [
        { step: 0, midi: 69, len: 1.2 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 7, midi: 74, len: 0.4 },
        { step: 8, midi: 72, len: 1.4 },
        { step: 14, midi: 69, len: 0.8 },
      ],
      [
        { step: 0, midi: 67, len: 1.1 },
        { step: 4, midi: 69, len: 0.7 },
        { step: 8, midi: 72, len: 1.4 },
        { step: 12, midi: 74, len: 0.7 },
        { step: 14, midi: 72, len: 0.7 },
      ],
      [
        { step: 0, midi: 76, len: 0.8 },
        { step: 3, midi: 74, len: 0.6 },
        { step: 6, midi: 72, len: 0.6 },
        { step: 8, midi: 71, len: 1.2 },
        { step: 12, midi: 72, len: 0.7 },
        { step: 14, midi: 74, len: 0.8 },
      ],
      [
        { step: 0, midi: 72, len: 1.6 },
        { step: 4, midi: 69, len: 0.7 },
        { step: 8, midi: 67, len: 1.6 },
        { step: 12, midi: 64, len: 0.8 },
        { step: 14, midi: 67, len: 0.8 },
      ],
      [
        { step: 0, midi: 72, len: 1.2 },
        { step: 4, midi: 69, len: 0.8 },
        { step: 8, midi: 65, len: 1.6 },
        { step: 12, midi: 69, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 74, len: 1.4 },
        { step: 4, midi: 77, len: 0.8 },
        { step: 8, midi: 76, len: 1.2 },
        { step: 12, midi: 74, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 70, len: 1.6 },
        { step: 4, midi: 74, len: 0.8 },
        { step: 8, midi: 77, len: 1.4 },
        { step: 12, midi: 74, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 72, len: 2.4 },
        { step: 8, midi: 70, len: 0.8 },
        { step: 10, midi: 67, len: 0.8 },
        { step: 12, midi: 65, len: 2.4 },
      ],
    ],
    [
      [
        { step: 0, midi: 65, len: 0.8 },
        { step: 2, midi: 69, len: 0.8 },
        { step: 4, midi: 72, len: 1.2 },
        { step: 8, midi: 74, len: 0.8 },
        { step: 10, midi: 72, len: 0.8 },
        { step: 12, midi: 69, len: 1.6 },
        { step: 14, midi: 67, len: 0.8 },
      ],
      [
        { step: 0, midi: 65, len: 1.2 },
        { step: 4, midi: 69, len: 0.8 },
        { step: 8, midi: 72, len: 0.8 },
        { step: 10, midi: 74, len: 1.2 },
        { step: 12, midi: 72, len: 1.6 },
      ],
      [
        { step: 0, midi: 71, len: 0.8 },
        { step: 2, midi: 74, len: 0.8 },
        { step: 4, midi: 76, len: 1.2 },
        { step: 8, midi: 79, len: 0.8 },
        { step: 10, midi: 77, len: 0.8 },
        { step: 12, midi: 76, len: 1.6 },
        { step: 14, midi: 74, len: 0.8 },
      ],
      [
        { step: 0, midi: 72, len: 2.4 },
        { step: 8, midi: 76, len: 1.2 },
        { step: 10, midi: 74, len: 1.2 },
        { step: 12, midi: 72, len: 0.8 },
        { step: 14, midi: 67, len: 0.8 },
      ],
      [
        { step: 0, midi: 69, len: 0.8 },
        { step: 2, midi: 72, len: 0.8 },
        { step: 4, midi: 77, len: 1.4 },
        { step: 8, midi: 76, len: 0.8 },
        { step: 10, midi: 74, len: 0.8 },
        { step: 12, midi: 72, len: 2 },
      ],
      [
        { step: 0, midi: 74, len: 1.2 },
        { step: 4, midi: 76, len: 0.8 },
        { step: 8, midi: 77, len: 1.2 },
        { step: 12, midi: 81, len: 1.2 },
        { step: 14, midi: 79, len: 0.8 },
      ],
      [
        { step: 0, midi: 77, len: 1.6 },
        { step: 4, midi: 74, len: 0.8 },
        { step: 8, midi: 70, len: 1.2 },
        { step: 10, midi: 74, len: 0.8 },
        { step: 12, midi: 77, len: 1.6 },
      ],
      [
        { step: 0, midi: 79, len: 2.4 },
        { step: 8, midi: 77, len: 0.8 },
        { step: 10, midi: 74, len: 0.8 },
        { step: 12, midi: 72, len: 2.4 },
      ],
    ],
  ],
  drums: {
    soft: [
      { kick: [0, 10], rim: [4, 12], hat: HATS_8 },
      { kick: [0, 7, 10], rim: [4, 12], hat: [0, 2, 4, 6, 8, 9, 10, 12, 14] },
    ],
    verse: [
      { kick: [0, 3, 7, 10, 14], snare: [4, 12], hat: HATS_8, open: [14] },
      {
        kick: [0, 3, 6, 10, 13],
        snare: [4, 12],
        hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
        open: [6, 14],
      },
    ],
    hook: [
      { kick: [0, 3, 7, 10, 13, 15], snare: [4, 12], clap: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [14] },
      {
        kick: [0, 2, 3, 7, 10, 14],
        snare: [4, 12],
        clap: [4, 12],
        hat: [0, 2, 4, 5, 6, 8, 10, 12, 13, 14, 15],
        open: [7, 14],
      },
    ],
  },
  fills: {
    a: [
      { type: 'snare', step: 13, gain: 0.6 },
      { type: 'snare', step: 14, gain: 0.8 },
      { type: 'tom', step: 15, gain: 0.9 },
    ],
    b: [
      { type: 'snare', step: 12, gain: 0.5 },
      { type: 'tom', step: 13, gain: 0.8 },
      { type: 'tom', step: 14, gain: 0.9 },
      { type: 'snare', step: 15, gain: 1 },
    ],
  },
  arrangement: [
    { bars: 2, keys: true, pad: true },
    { bars: 2, drums: 'soft', keys: true, bass: true, fill: 'a' },
    { bars: 8, drums: 'verse', keys: true, bass: true, chart: ['a', 'b'], crash: true, fill: 'a' },
    { bars: 8, drums: 'hook', keys: true, bass: true, lead: 0, chart: ['b', 'c', 'b', 'd'], vox: [12], crash: true, fill: 'b' },
    { bars: 4, drums: 'soft', keys: true, bass: true, pad: true, chart: ['g', 'a'], fill: 'a' },
    { bars: 8, drums: 'hook', keys: true, bass: true, lead: 1, chart: ['c', 'd', 'b', 'e'], crash: true, fill: 'b' },
    { bars: 4, drums: 'verse', keys: true, bass: true, chart: ['b', 'a'], fill: 'a' },
    { bars: 2, keys: true, pad: true },
  ],
};

/* --------------------------------------------------------------- Sunday Drop */

const SUNDAY_DROP = {
  id: 'sunday-drop',
  title: 'Sunday Drop',
  blurb: 'A sun-warmed one-drop: offbeat skanks, a walking bassline and plenty of echo. For the slow part of the afternoon.',
  vibe: 'Sun-warmed · one-drop',
  bpm: 74,
  swing: 0.02,
  lengthLabel: '1:57',
  echo: 0.33,
  echoWet: 0.3,
  vinylGain: 0.02,
  palette: {
    sky: ['#12241d', '#3b2f1d'],
    glow: '#e7c66a',
    haze: '#7ed0a9',
  },
  progression: [
    { voicing: [48, 52, 55, 59], root: 36, alt: 40, fifth: 43 },
    { voicing: [45, 48, 52, 55], root: 33, alt: 36, fifth: 40 },
    { voicing: [53, 57, 60, 64], root: 41, alt: 45, fifth: 48 },
    { voicing: [43, 47, 50, 52], root: 43, alt: 47, fifth: 50 },
    { voicing: [48, 52, 55, 59], root: 36, alt: 40, fifth: 43 },
    { voicing: [45, 48, 52, 55], root: 33, alt: 36, fifth: 40 },
    { voicing: [50, 53, 57, 60], root: 38, alt: 41, fifth: 45 },
    { voicing: [43, 47, 50, 53], root: 43, alt: 47, fifth: 50 },
  ],
  bassPatterns: [
    [
      { step: 0, note: 'root', len: 1.4, gain: 1 },
      { step: 3, note: 'fifth', len: 0.5, gain: 0.7 },
      { step: 6, note: 'octave', len: 0.8, gain: 0.85 },
      { step: 10, note: 'root', len: 1.2, gain: 0.9 },
      { step: 14, note: 'alt', len: 0.6, gain: 0.6 },
    ],
    [
      { step: 0, note: 'root', len: 0.9, gain: 1 },
      { step: 2, note: 'root', len: 0.4, gain: 0.6 },
      { step: 6, note: 'fifth', len: 1.2, gain: 0.85 },
      { step: 9, note: 'octave', len: 0.7, gain: 0.75 },
      { step: 12, note: 'alt', len: 1, gain: 0.8 },
      { step: 15, note: 'root', len: 0.5, gain: 0.6 },
    ],
  ],
  skankPatterns: [[4, 12], [4, 12, 14], [4, 10, 12]],
  organPatterns: [
    [2, 7, 10, 14],
    [2, 6, 10, 14, 15],
  ],
  leads: [
    [
      [
        { step: 0, midi: 67, len: 1.2 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 6, midi: 71, len: 0.8 },
        { step: 8, midi: 67, len: 1.6 },
        { step: 12, midi: 64, len: 0.8 },
        { step: 14, midi: 67, len: 0.8 },
      ],
      [
        { step: 0, midi: 69, len: 1.2 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 8, midi: 76, len: 1.2 },
        { step: 10, midi: 74, len: 0.8 },
        { step: 12, midi: 72, len: 1.6 },
      ],
      [
        { step: 0, midi: 69, len: 1.2 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 8, midi: 77, len: 1.6 },
        { step: 12, midi: 76, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 71, len: 2.4 },
        { step: 8, midi: 74, len: 1.2 },
        { step: 10, midi: 71, len: 0.8 },
        { step: 12, midi: 67, len: 2 },
      ],
      [
        { step: 0, midi: 72, len: 0.8 },
        { step: 2, midi: 74, len: 0.8 },
        { step: 4, midi: 76, len: 1.2 },
        { step: 8, midi: 72, len: 0.8 },
        { step: 10, midi: 69, len: 0.8 },
        { step: 12, midi: 67, len: 1.6 },
      ],
      [
        { step: 0, midi: 69, len: 1.2 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 8, midi: 76, len: 1.2 },
        { step: 12, midi: 79, len: 1.6 },
        { step: 14, midi: 76, len: 0.8 },
      ],
      [
        { step: 0, midi: 77, len: 1.6 },
        { step: 4, midi: 76, len: 0.8 },
        { step: 8, midi: 74, len: 1.2 },
        { step: 10, midi: 72, len: 0.8 },
        { step: 12, midi: 74, len: 1.6 },
      ],
      [
        { step: 0, midi: 71, len: 2.4 },
        { step: 8, midi: 74, len: 0.8 },
        { step: 10, midi: 71, len: 0.8 },
        { step: 12, midi: 67, len: 2.4 },
      ],
    ],
    [
      [
        { step: 0, midi: 76, len: 0.8 },
        { step: 2, midi: 79, len: 0.8 },
        { step: 4, midi: 76, len: 1.2 },
        { step: 8, midi: 72, len: 1.2 },
        { step: 10, midi: 69, len: 0.8 },
        { step: 12, midi: 67, len: 1.6 },
      ],
      [
        { step: 0, midi: 72, len: 1.2 },
        { step: 4, midi: 76, len: 0.8 },
        { step: 8, midi: 79, len: 1.2 },
        { step: 10, midi: 81, len: 0.8 },
        { step: 12, midi: 79, len: 1.6 },
      ],
      [
        { step: 0, midi: 77, len: 1.2 },
        { step: 2, midi: 76, len: 0.8 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 8, midi: 69, len: 1.6 },
        { step: 12, midi: 72, len: 0.8 },
        { step: 14, midi: 76, len: 0.8 },
      ],
      [
        { step: 0, midi: 74, len: 2.4 },
        { step: 8, midi: 71, len: 0.8 },
        { step: 10, midi: 74, len: 0.8 },
        { step: 12, midi: 79, len: 2 },
      ],
      [
        { step: 0, midi: 79, len: 0.8 },
        { step: 2, midi: 76, len: 0.8 },
        { step: 4, midi: 72, len: 1.2 },
        { step: 8, midi: 69, len: 0.8 },
        { step: 10, midi: 72, len: 0.8 },
        { step: 12, midi: 76, len: 1.6 },
      ],
      [
        { step: 0, midi: 81, len: 1.2 },
        { step: 4, midi: 79, len: 0.8 },
        { step: 8, midi: 76, len: 1.2 },
        { step: 12, midi: 72, len: 1.6 },
      ],
      [
        { step: 0, midi: 74, len: 1.2 },
        { step: 4, midi: 77, len: 0.8 },
        { step: 8, midi: 81, len: 1.2 },
        { step: 10, midi: 79, len: 0.8 },
        { step: 12, midi: 77, len: 1.6 },
      ],
      [
        { step: 0, midi: 74, len: 2.4 },
        { step: 8, midi: 71, len: 0.8 },
        { step: 10, midi: 67, len: 0.8 },
        { step: 12, midi: 72, len: 2.4 },
      ],
    ],
  ],
  leadKind: 'melodica',
  drums: {
    soft: [
      { kick: [8], rim: [8], hat: HATS_8 },
      { kick: [8], rim: [8], hat: [0, 2, 3, 4, 6, 8, 10, 12, 14] },
    ],
    verse: [
      { kick: [8], rim: [8], hat: HATS_8, open: [14] },
      { kick: [8], rim: [8, 15], hat: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], open: [11] },
    ],
    chorus: [
      { kick: [8], rim: [8], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [14] },
      {
        kick: [7, 8],
        rim: [8],
        hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14],
        open: [6, 14],
      },
    ],
  },
  fills: {
    a: [
      { type: 'rim', step: 12, gain: 0.6 },
      { type: 'rim', step: 14, gain: 0.8 },
      { type: 'tom', step: 15, gain: 0.9 },
    ],
    b: [
      { type: 'tom', step: 12, gain: 0.7 },
      { type: 'tom', step: 13, gain: 0.8 },
      { type: 'rim', step: 14, gain: 0.9 },
      { type: 'tom', step: 15, gain: 1 },
    ],
  },
  arrangement: [
    { bars: 2, skank: true, bass: true, pad: true },
    { bars: 2, drums: 'soft', skank: true, bass: true, organ: true, fill: 'a' },
    { bars: 8, drums: 'verse', skank: true, bass: true, chart: ['a', 'b'], crash: true, fill: 'a' },
    { bars: 8, drums: 'chorus', skank: true, bass: true, organ: true, lead: 0, chart: ['b', 'c', 'b', 'd'], crash: true, fill: 'b' },
    { bars: 4, skank: true, bass: true, organ: true, pad: true, chart: ['g'] },
    { bars: 8, drums: 'chorus', skank: true, bass: true, organ: true, lead: 1, chart: ['c', 'd', 'b', 'e'], crash: true, fill: 'b' },
    { bars: 4, skank: true, bass: true, organ: true, pad: true },
  ],
};

/* ---------------------------------------------------------------- Slow Pour */

const SLOW_POUR = {
  id: 'slow-pour',
  title: 'Slow Pour',
  blurb: 'Deep sub, brushed drums and late-night chords. Ten minutes after the house goes quiet.',
  vibe: 'Smoky · low light',
  bpm: 82,
  swing: 0.055,
  lengthLabel: '1:40',
  echo: 0.25,
  echoWet: 0.24,
  vinylGain: 0.055,
  palette: {
    sky: ['#121018', '#2c1f2d'],
    glow: '#e2b6ff',
    haze: '#ffb59e',
  },
  progression: [
    { voicing: [48, 51, 55, 58, 62], root: 36, alt: 39, fifth: 43 },
    { voicing: [44, 48, 51, 55, 58], root: 32, alt: 36, fifth: 39 },
    { voicing: [41, 44, 48, 51, 55], root: 29, alt: 32, fifth: 36 },
    { voicing: [43, 47, 50, 53, 56], root: 31, alt: 35, fifth: 38 },
    { voicing: [48, 51, 55, 58, 62], root: 36, alt: 39, fifth: 43 },
    { voicing: [44, 48, 51, 55, 58], root: 32, alt: 36, fifth: 39 },
    { voicing: [49, 53, 56, 60, 63], root: 37, alt: 41, fifth: 44 },
    { voicing: [43, 47, 50, 53, 56], root: 31, alt: 35, fifth: 38 },
  ],
  keysPatterns: [
    [
      { step: 0, len: 3.6, gain: 1 },
      { step: 10, len: 2.2, gain: 0.7 },
    ],
    [
      { step: 0, len: 2.4, gain: 0.8 },
      { step: 6, len: 1.4, gain: 0.55 },
      { step: 10, len: 2.6, gain: 0.9 },
    ],
  ],
  bassPatterns: [
    [
      { step: 0, note: 'root', len: 3.2, gain: 1 },
      { step: 10, note: 'fifth', len: 1.4, gain: 0.7 },
    ],
    [
      { step: 0, note: 'root', len: 2, gain: 1 },
      { step: 6, note: 'alt', len: 1.2, gain: 0.6 },
      { step: 10, note: 'fifth', len: 2, gain: 0.75 },
    ],
  ],
  leads: [
    [
      [
        { step: 0, midi: 67, len: 1.6 },
        { step: 6, midi: 70, len: 0.7 },
        { step: 8, midi: 72, len: 1.2 },
        { step: 12, midi: 70, len: 0.7 },
      ],
      [
        { step: 0, midi: 75, len: 1.6 },
        { step: 4, midi: 72, len: 0.7 },
        { step: 8, midi: 70, len: 1.2 },
        { step: 12, midi: 67, len: 1.6 },
      ],
      [
        { step: 0, midi: 63, len: 1.2 },
        { step: 4, midi: 67, len: 0.7 },
        { step: 8, midi: 70, len: 0.7 },
        { step: 10, midi: 72, len: 0.7 },
        { step: 12, midi: 75, len: 1.6 },
      ],
      [
        { step: 0, midi: 74, len: 2.4 },
        { step: 8, midi: 70, len: 0.7 },
        { step: 10, midi: 67, len: 2.4 },
      ],
      [
        { step: 0, midi: 72, len: 1.2 },
        { step: 4, midi: 75, len: 0.8 },
        { step: 8, midi: 79, len: 1.6 },
        { step: 12, midi: 75, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 70, len: 1.6 },
        { step: 4, midi: 72, len: 0.8 },
        { step: 8, midi: 75, len: 1.2 },
        { step: 12, midi: 77, len: 1.2 },
        { step: 14, midi: 75, len: 0.8 },
      ],
      [
        { step: 0, midi: 77, len: 1.6 },
        { step: 4, midi: 75, len: 0.8 },
        { step: 8, midi: 72, len: 1.2 },
        { step: 10, midi: 70, len: 0.8 },
        { step: 12, midi: 68, len: 1.6 },
      ],
      [
        { step: 0, midi: 70, len: 2.4 },
        { step: 8, midi: 67, len: 1.2 },
        { step: 10, midi: 63, len: 2.4 },
      ],
    ],
    [
      [
        { step: 0, midi: 63, len: 1.2 },
        { step: 3, midi: 67, len: 0.8 },
        { step: 6, midi: 70, len: 0.8 },
        { step: 8, midi: 72, len: 1.6 },
        { step: 12, midi: 75, len: 0.8 },
        { step: 14, midi: 72, len: 0.8 },
      ],
      [
        { step: 0, midi: 75, len: 2.4 },
        { step: 8, midi: 79, len: 0.8 },
        { step: 10, midi: 77, len: 0.8 },
        { step: 12, midi: 75, len: 1.6 },
      ],
      [
        { step: 0, midi: 72, len: 1.2 },
        { step: 4, midi: 70, len: 0.8 },
        { step: 8, midi: 67, len: 1.2 },
        { step: 12, midi: 63, len: 1.6 },
      ],
      [
        { step: 0, midi: 70, len: 2.4 },
        { step: 8, midi: 74, len: 0.8 },
        { step: 10, midi: 70, len: 0.8 },
        { step: 12, midi: 67, len: 2 },
      ],
      [
        { step: 0, midi: 75, len: 1.2 },
        { step: 4, midi: 77, len: 0.8 },
        { step: 8, midi: 79, len: 1.2 },
        { step: 12, midi: 82, len: 1.6 },
      ],
      [
        { step: 0, midi: 81, len: 1.6 },
        { step: 4, midi: 79, len: 0.8 },
        { step: 8, midi: 75, len: 1.2 },
        { step: 10, midi: 72, len: 0.8 },
        { step: 12, midi: 75, len: 1.6 },
      ],
      [
        { step: 0, midi: 77, len: 1.2 },
        { step: 4, midi: 75, len: 0.8 },
        { step: 8, midi: 72, len: 1.6 },
        { step: 12, midi: 70, len: 0.8 },
        { step: 14, midi: 68, len: 0.8 },
      ],
      [
        { step: 0, midi: 70, len: 2.4 },
        { step: 8, midi: 67, len: 1.2 },
        { step: 10, midi: 63, len: 2.4 },
      ],
    ],
  ],
  drums: {
    soft: [
      { kick: [0, 10], rim: [4, 12], hat: HATS_8 },
      {
        kick: [0, 7, 10],
        rim: [4, 12, 15],
        hat: [0, 2, 4, 6, 8, 9, 10, 12, 14],
      },
    ],
    groove: [
      { kick: [0, 3, 7, 10, 14], snare: [4, 12], hat: HATS_8, open: [14] },
      {
        kick: [0, 3, 7, 10, 13],
        snare: [4, 12],
        hat: [0, 2, 4, 6, 7, 8, 10, 12, 14],
        open: [6, 14],
      },
    ],
  },
  fills: {
    a: [
      { type: 'rim', step: 13, gain: 0.6 },
      { type: 'rim', step: 14, gain: 0.7 },
      { type: 'tom', step: 15, gain: 0.8 },
    ],
    b: [
      { type: 'tom', step: 12, gain: 0.7 },
      { type: 'rim', step: 13, gain: 0.8 },
      { type: 'tom', step: 14, gain: 0.8 },
      { type: 'rim', step: 15, gain: 0.9 },
    ],
  },
  arrangement: [
    { bars: 2, keys: true, pad: true },
    { bars: 8, drums: 'soft', keys: true, bass: true, pad: true, chart: ['a', 'g', 'a', 'a'], crash: true, fill: 'a' },
    { bars: 8, drums: 'soft', keys: true, bass: true, lead: 0, pad: true, chart: ['a', 'b', 'b', 'g'], crash: true, fill: 'b' },
    { bars: 4, keys: true, bass: true, pad: true, chart: ['g'], fill: 'a' },
    { bars: 8, drums: 'groove', keys: true, bass: true, lead: 1, pad: true, chart: ['b', 'c', 'b', 'a'], crash: true, fill: 'b' },
    { bars: 4, keys: true, pad: true },
  ],
};

export const TRACKS = [GOLDEN_HOUR, SUNDAY_DROP, SLOW_POUR];

const bassMidi = (chord, kind) => {
  switch (kind) {
    case 'fifth':
      return chord.fifth;
    case 'alt':
      return chord.alt;
    case 'octave':
      return chord.root + 12;
    default:
      return chord.root;
  }
};

const swingBeat = (step, swing) => step * 0.25 + (step % 2 === 1 ? swing : 0);

const pickVariant = (variants, barIndex, every = 2) =>
  variants[Math.floor(barIndex / every) % variants.length];

/**
 * Turn a track spec into a flat event timeline and a playable note chart.
 * `difficulty` is 'gentle' (straight eighths) or 'groove' (adds syncopation).
 */
export function buildSong(track, difficulty = 'gentle') {
  const events = [];
  const notes = [];
  let barCursor = 0;

  for (const section of track.arrangement) {
    for (let b = 0; b < section.bars; b += 1) {
      const globalBar = barCursor + b;
      const chord = track.progression[globalBar % track.progression.length];
      const barBeat = globalBar * 4;
      const at = (step) => barBeat + swingBeat(step, track.swing);

      if (section.drums) {
        const pack = track.drums[section.drums];
        const drums = Array.isArray(pack) ? pickVariant(pack, globalBar) : pack;

        for (const step of drums.kick || []) {
          events.push({ type: 'kick', beat: at(step), gain: 1 });
        }
        for (const step of drums.snare || []) {
          events.push({ type: 'snare', beat: at(step), gain: 0.9 });
        }
        for (const step of drums.clap || []) {
          events.push({ type: 'clap', beat: at(step), gain: 0.7 });
        }
        for (const step of drums.rim || []) {
          events.push({ type: 'rim', beat: at(step), gain: 0.9 });
        }
        for (const step of drums.hat || []) {
          const gain = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.65 : 0.4;
          events.push({ type: 'hat', beat: at(step), gain });
        }
        for (const step of drums.open || []) {
          events.push({ type: 'openhat', beat: at(step), gain: 0.8 });
        }
      }

      if (section.keys && track.keysPatterns) {
        const stabs = pickVariant(track.keysPatterns, globalBar);
        for (const stab of stabs) {
          events.push({
            type: 'chord',
            beat: at(stab.step),
            notes: chord.voicing,
            dur: stab.len,
            gain: stab.gain,
          });
        }
      }

      if (section.bass && track.bassPatterns) {
        const pattern = pickVariant(track.bassPatterns, globalBar);
        for (const note of pattern) {
          events.push({
            type: 'bass',
            beat: at(note.step),
            midi: bassMidi(chord, note.note),
            dur: note.len,
            gain: note.gain,
          });
        }
      }

      if (section.skank && track.skankPatterns) {
        const pattern = pickVariant(track.skankPatterns, globalBar);
        for (const step of pattern) {
          events.push({
            type: 'skank',
            beat: at(step),
            notes: chord.voicing.map((midi) => midi + 12),
            dur: 0.3,
            gain: 1,
          });
        }
      }

      if (section.organ && track.organPatterns) {
        const pattern = pickVariant(track.organPatterns, globalBar);
        for (const step of pattern) {
          events.push({
            type: 'organ',
            beat: at(step),
            notes: chord.voicing.map((midi) => midi + 12),
            dur: 0.6,
            gain: 0.8,
          });
        }
      }

      if (section.pad) {
        events.push({ type: 'pad', beat: barBeat, notes: chord.voicing, dur: 4, gain: 0.9 });
      }

      if (section.arp) {
        for (let step = 0; step < 16; step += 2) {
          const tone = chord.voicing[step % chord.voicing.length] + 12;
          events.push({
            type: 'bell',
            beat: at(step),
            midi: tone,
            gain: step % 4 === 0 ? 1 : 0.55,
          });
        }
      }

      if (typeof section.lead === 'number') {
        const phrase = track.leads[section.lead % track.leads.length];
        const barNotes = phrase[b % phrase.length];
        for (const note of barNotes) {
          events.push({
            type: 'lead',
            kind: track.leadKind,
            beat: at(note.step),
            midi: note.midi,
            dur: note.len,
            gain: 1,
          });
        }
      }

      if (section.vox && b % 2 === 1) {
        for (const step of section.vox) {
          events.push({ type: 'vox', beat: at(step), gain: 0.8 });
        }
      }

      if (section.fill && track.fills && track.fills[section.fill] && b === section.bars - 1) {
        for (const hit of track.fills[section.fill]) {
          events.push({ type: hit.type, beat: at(hit.step), gain: hit.gain ?? 1 });
        }
      }

      if (section.crash && b === 0) {
        events.push({ type: 'crash', beat: barBeat, gain: 0.8 });
      }

      if (section.chart) {
        let name = section.chart[b % section.chart.length];
        if (difficulty === 'gentle') name = GENTLE_SUBSTITUTE[name] || 'a';
        // Mirror every four bars so a repeated pattern still feels like a reply.
        const mirror = Math.floor(b / 4) % 2 === 1;
        for (const [step, rawLane] of CHART_PATTERNS[name]) {
          notes.push({
            beat: at(step),
            lane: mirror ? 3 - rawLane : rawLane,
            strength: step % 4 === 0 ? 1 : 0.7,
          });
        }
      }
    }

    barCursor += section.bars;
  }

  events.sort((left, right) => left.beat - right.beat);
  notes.sort((left, right) => left.beat - right.beat);
  notes.forEach((note, index) => {
    note.id = index;
  });

  const durationBeats = barCursor * 4;
  const secPerBeat = 60 / track.bpm;
  return {
    track,
    difficulty,
    bpm: track.bpm,
    secPerBeat,
    events,
    notes,
    durationBeats,
    durationSeconds: durationBeats * secPerBeat,
    lastNoteBeat: notes.length ? notes[notes.length - 1].beat : 0,
  };
}

/* ------------------------------------------------------------------ engine */

export class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.reverbSend = null;
    this.delaySend = null;
    this.noise = null;
    this.vinyl = null;
    this.timer = 0;
    this.events = [];
    this.index = 0;
    this.startTime = 0;
    this.secPerBeat = 0.5;
    this.session = 0;
    this.running = false;
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

      const sfx = this.ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      this.sfxGain = sfx;

      // A short room for keys, claps and lead notes.
      const send = this.ctx.createGain();
      send.gain.value = 0.8;
      const damp = this.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 3200;
      const convolver = this.ctx.createConvolver();
      convolver.buffer = this._impulseBuffer(1.7);
      send.connect(damp);
      damp.connect(convolver);
      convolver.connect(master);
      this.reverbSend = send;
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  async startSong(song) {
    await this.ensure();
    this.stopSong();

    const ctx = this.ctx;
    const session = this.session + 1;
    this.session = session;

    this.events = song.events;
    this.index = 0;
    this.secPerBeat = song.secPerBeat;

    const music = ctx.createGain();
    music.gain.setValueAtTime(0.0001, ctx.currentTime);
    music.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
    music.connect(this.master);
    this.musicGain = music;

    const delay = ctx.createDelay(1);
    delay.delayTime.value = Math.min(0.9, song.secPerBeat * 0.75);
    const feedback = ctx.createGain();
    feedback.gain.value = song.track.echo ?? 0.22;
    const delayDamp = ctx.createBiquadFilter();
    delayDamp.type = 'lowpass';
    delayDamp.frequency.value = 2400;
    const wet = ctx.createGain();
    wet.gain.value = song.track.echoWet ?? 0.22;
    const send = ctx.createGain();
    send.gain.value = 0.75;
    delay.connect(delayDamp);
    delayDamp.connect(feedback);
    feedback.connect(delay);
    delayDamp.connect(wet);
    wet.connect(music);
    send.connect(delay);
    this.delaySend = send;

    this._startVinyl(music, song.track.vinylGain ?? 0.045);

    // A breath of quiet, then four clicks, then the downbeat.
    this.startTime = ctx.currentTime + 1.4 + song.secPerBeat * 4;
    for (let i = 4; i >= 1; i -= 1) {
      this._click(this.startTime - i * song.secPerBeat, i === 1);
    }

    this.running = true;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 25);
    return session;
  }

  stopSong() {
    this.running = false;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    this.index = 0;
    this.session += 1;

    if (this.vinyl) {
      try {
        this.vinyl.stop();
      } catch (error) {
        /* already stopped */
      }
      this.vinyl = null;
    }

    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      const gain = this.musicGain;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.05);
      window.setTimeout(() => {
        try {
          gain.disconnect();
        } catch (error) {
          /* already disconnected */
        }
      }, 600);
    }
    this.musicGain = null;
    this.delaySend = null;
  }

  async pause() {
    if (!this.ctx) return;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    try {
      await this.ctx.suspend();
    } catch (error) {
      /* nothing to pause */
    }
  }

  async resume() {
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
    } catch (error) {
      /* the browser will keep it muted */
    }
    if (this.running && !this.timer) {
      this.schedule();
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  getSongTime() {
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.startTime;
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0.0001 : 0.9, now + 0.12);
  }

  schedule() {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;
    const horizon = now + 0.22;
    while (this.index < this.events.length) {
      const event = this.events[this.index];
      const when = this.startTime + event.beat * this.secPerBeat;
      if (when > horizon) break;
      if (when >= now - 0.06) this.play(event, Math.max(when, now + 0.004));
      this.index += 1;
    }
  }

  play(event, time) {
    // Chart durations are in beats; the synth envelopes want seconds.
    const dur = (event.dur || 0) * this.secPerBeat;
    switch (event.type) {
      case 'kick':
        this._kick(time, event.gain);
        break;
      case 'snare':
        this._snare(time, event.gain);
        break;
      case 'clap':
        this._clap(time, event.gain);
        break;
      case 'hat':
        this._hat(time, false, event.gain);
        break;
      case 'openhat':
        this._hat(time, true, event.gain);
        break;
      case 'rim':
        this._rim(time, event.gain);
        break;
      case 'tom':
        this._tom(time, event.gain);
        break;
      case 'crash':
        this._crash(time, event.gain);
        break;
      case 'chord':
        this._chord(time, event.notes, dur, event.gain);
        break;
      case 'skank':
        this._skank(time, event.notes, dur, event.gain);
        break;
      case 'organ':
        this._organ(time, event.notes, dur, event.gain);
        break;
      case 'bass':
        this._bass(time, event.midi, dur, event.gain);
        break;
      case 'pad':
        this._pad(time, event.notes, dur, event.gain);
        break;
      case 'bell':
        this._bell(time, event.midi, event.gain);
        break;
      case 'lead':
        if (event.kind === 'melodica') this._melodica(time, event.midi, dur, event.gain);
        else this._lead(time, event.midi, dur, event.gain);
        break;
      case 'vox':
        this._vox(time, event.gain);
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------- sound fx */

  tap(lane, perfect) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400 + lane * 650;
    band.Q.value = 1.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    source.connect(band);
    band.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now, Math.random());
    source.stop(now + 0.06);

    if (perfect) {
      const osc = ctx.createOscillator();
      const shine = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.exponentialRampToValueAtTime(2640, now + 0.08);
      shine.gain.setValueAtTime(0.035, now);
      shine.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(shine);
      shine.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }
  }

  emptyTap() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  miss() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /* ------------------------------------------------------------ drum kit */

  _kick(time, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.75 * gain, time + 0.007);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(env);
    env.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.36);

    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1700;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.09 * gain, time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    click.connect(high);
    high.connect(clickGain);
    clickGain.connect(this.musicGain);
    click.start(time, Math.random() * 1.5);
    click.stop(time + 0.03);
  }

  _snare(time, gain = 1) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1850;
    band.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.22 * gain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
    source.connect(band);
    band.connect(env);
    env.connect(this.musicGain);
    env.connect(this.reverbSend);
    source.start(time, Math.random() * 1.5);
    source.stop(time + 0.21);

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, time);
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.09 * gain, time + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    body.connect(bodyGain);
    bodyGain.connect(this.musicGain);
    body.start(time);
    body.stop(time + 0.12);
  }

  _clap(time, gain = 1) {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i += 1) {
      const at = time + i * 0.012;
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1200;
      band.Q.value = 1.1;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(0.1 * gain, at + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      source.connect(band);
      band.connect(env);
      env.connect(this.musicGain);
      env.connect(this.reverbSend);
      source.start(at, Math.random() * 1.5);
      source.stop(at + 0.13);
    }
  }

  _hat(time, open, gain = 1) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = open ? 6200 : 7600;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 10000;
    band.Q.value = 0.8;
    const env = ctx.createGain();
    const dur = open ? 0.24 : 0.048;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime((open ? 0.06 : 0.085) * gain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    source.connect(high);
    high.connect(band);
    band.connect(env);
    env.connect(this.musicGain);
    source.start(time, Math.random() * 1.5);
    source.stop(time + dur + 0.02);
  }

  _rim(time, gain = 1) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1750;
    band.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.12 * gain, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    source.connect(band);
    band.connect(env);
    env.connect(this.musicGain);
    source.start(time, Math.random() * 1.5);
    source.stop(time + 0.05);
  }

  _tom(time, gain = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.18);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.16 * gain, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(env);
    env.connect(this.musicGain);
    env.connect(this.reverbSend);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  _crash(time, gain = 1) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 5200;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.05 * gain, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
    source.connect(high);
    high.connect(env);
    env.connect(this.musicGain);
    env.connect(this.reverbSend);
    source.start(time, Math.random() * 1.5);
    source.stop(time + 1.15);
  }

  /* --------------------------------------------------------- instruments */

  _chord(time, notes, dur, gain = 1) {
    const ctx = this.ctx;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2600;
    low.Q.value = 0.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.045 * gain, time + 0.016);
    env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.2, dur));
    low.connect(env);
    env.connect(this.musicGain);
    env.connect(this.reverbSend);

    for (const midi of notes) {
      const freq = mtof(midi);
      for (const [mult, amp] of [
        [1, 0.9],
        [2, 0.2],
      ]) {
        const osc = ctx.createOscillator();
        const voice = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        voice.gain.value = amp;
        osc.connect(voice);
        voice.connect(low);
        osc.start(time);
        osc.stop(time + Math.max(0.25, dur) + 0.05);
      }
    }
  }

  _skank(time, notes, dur, gain = 1) {
    const ctx = this.ctx;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 4200;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 480;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 1.1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.05 * gain, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.14, dur));
    high.connect(band);
    band.connect(low);
    low.connect(env);
    env.connect(this.musicGain);
    env.connect(this.delaySend);
    env.connect(this.reverbSend);

    for (const midi of notes) {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = mtof(midi);
      osc.detune.value = Math.random() * 8 - 4;
      voice.gain.value = 0.35;
      osc.connect(voice);
      voice.connect(high);
      osc.start(time);
      osc.stop(time + Math.max(0.16, dur) + 0.05);
    }
  }

  _organ(time, notes, dur, gain = 1) {
    const ctx = this.ctx;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1800;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.028 * gain, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.2, dur));
    low.connect(env);
    env.connect(this.musicGain);
    env.connect(this.delaySend);
    env.connect(this.reverbSend);

    for (const midi of notes) {
      const freq = mtof(midi);
      for (const [mult, amp] of [
        [1, 0.45],
        [2, 0.12],
      ]) {
        const osc = ctx.createOscillator();
        const voice = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq * mult;
        voice.gain.value = amp;
        osc.connect(voice);
        voice.connect(low);
        osc.start(time);
        osc.stop(time + Math.max(0.24, dur) + 0.05);
      }
    }
  }

  _bass(time, midi, dur, gain = 1) {
    const ctx = this.ctx;
    const freq = mtof(midi);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(0.2 * gain, time + 0.012);
    out.gain.setValueAtTime(0.2 * gain, time + Math.max(0.04, dur * 0.5));
    out.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.12, dur));
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    low.Q.value = 0.8;
    out.connect(low);
    low.connect(this.musicGain);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    oscGain.gain.value = 0.7;
    osc.connect(oscGain);
    oscGain.connect(out);
    osc.start(time);
    osc.stop(time + Math.max(0.16, dur) + 0.05);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    subGain.gain.value = 0.9;
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(time);
    sub.stop(time + Math.max(0.16, dur) + 0.05);
  }

  _pad(time, notes, dur, gain = 1) {
    const ctx = this.ctx;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 780;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.02 * gain, time + 0.7);
    env.gain.setValueAtTime(0.02 * gain, time + Math.max(0.85, dur - 0.5));
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    low.connect(env);
    env.connect(this.musicGain);
    env.connect(this.reverbSend);

    for (const midi of notes) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        const voice = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(midi);
        osc.detune.value = detune;
        voice.gain.value = 0.45;
        osc.connect(voice);
        voice.connect(low);
        osc.start(time);
        osc.stop(time + dur + 0.05);
      }
    }
  }

  _bell(time, midi, gain = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(0.032 * gain, time + 0.004);
    out.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-0.5, Math.min(0.5, ((midi % 12) / 12) * 1.2 - 0.6));
      out.connect(panner);
      panner.connect(this.musicGain);
    } else {
      out.connect(this.musicGain);
    }

    const target = panner || this.musicGain;
    for (const [mult, amp] of [
      [1, 1],
      [2.01, 0.25],
    ]) {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = mtof(midi) * mult;
      voice.gain.value = amp;
      osc.connect(voice);
      voice.connect(target);
      osc.start(time);
      osc.stop(time + 0.6);
    }
  }

  _lead(time, midi, dur, gain = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const length = Math.max(0.18, dur);
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(0.075 * gain, time + 0.03);
    out.gain.exponentialRampToValueAtTime(0.0001, time + length);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 3200;
    out.connect(low);
    low.connect(this.delaySend || this.musicGain);
    low.connect(this.reverbSend);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = mtof(midi);
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = mtof(midi) * 2;
    osc2Gain.gain.value = 0.16;
    osc.connect(out);
    osc2.connect(osc2Gain);
    osc2Gain.connect(out);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 4.6;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    lfoGain.connect(osc2.detune);

    for (const node of [osc, osc2, lfo]) {
      node.start(time);
      node.stop(time + length + 0.08);
    }
  }

  _melodica(time, midi, dur, gain = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const length = Math.max(0.2, dur);
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(0.06 * gain, time + 0.045);
    out.gain.setValueAtTime(0.06 * gain, time + length * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, time + length);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2200;
    out.connect(low);
    low.connect(this.delaySend || this.musicGain);
    low.connect(this.reverbSend);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = mtof(midi);
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.value = mtof(midi) * 2;
    bodyGain.gain.value = 0.2;
    osc.connect(out);
    body.connect(bodyGain);
    bodyGain.connect(out);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    for (const node of [osc, body, lfo]) {
      node.start(time);
      node.stop(time + length + 0.08);
    }
  }

  _vox(time, gain = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(0.045 * gain, time + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    const low = ctx.createBiquadFilter();
    low.type = 'bandpass';
    low.frequency.value = 660;
    low.Q.value = 5;
    const high = ctx.createBiquadFilter();
    high.type = 'bandpass';
    high.frequency.value = 1150;
    high.Q.value = 7;
    low.connect(out);
    high.connect(out);
    out.connect(this.musicGain);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(105, time + 0.2);
    osc.connect(low);
    osc.connect(high);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  _click(time, accent) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = accent ? 1560 : 1180;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.1 : 0.06, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    osc.connect(gain);
    gain.connect(this.musicGain || this.master);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  /* --------------------------------------------------------------- beds */

  _startVinyl(destination, level = 0.045) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this._vinylBuffer(2.5);
    source.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 4800;
    const gain = ctx.createGain();
    gain.gain.value = level;
    source.connect(low);
    low.connect(gain);
    gain.connect(destination);
    source.start();
    this.vinyl = source;
  }

  _noiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _vinylBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.05;
    }
    for (let pop = 0; pop < length / 700; pop += 1) {
      const index = Math.floor(Math.random() * (length - 1));
      const amp = 0.25 + Math.random() * 0.6;
      data[index] += amp;
      data[index + 1] -= amp * 0.5;
    }
    return buffer;
  }

  _impulseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    return buffer;
  }
}
