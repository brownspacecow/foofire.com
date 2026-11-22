/* -------------------------------------------------------------------------
 * Drum Quest — pure game logic (no DOM, no audio).
 * Everything in here is testable with node --test: real drum grooves for
 * Jack's lesson, Copy Cat levels and scoring.
 *
 * A groove is a list of STEPS, one bar. Each step is a list of drums hit
 * together on that beat — a real beat has the kick and hi-hat landing at
 * the same time, the snare and hi-hat together, and so on. Levels 1–2
 * are 4 quarter-note steps; from level 3 the bar is 8 eighth-note steps.
 * ---------------------------------------------------------------------- */

/** The five drums, in kit order. `key` is the keyboard key for each pad. */
export const DRUMS = [
  { id: 'kick', label: 'Kick', emoji: '🥁', key: 'a', color: '#ff6b5e' },
  { id: 'snare', label: 'Snare', emoji: '🪘', key: 's', color: '#f4c95d' },
  { id: 'hihat', label: 'Hi-Hat', emoji: '🎩', key: 'd', color: '#7fd8c6' },
  { id: 'tom', label: 'Tom', emoji: '🥁', key: 'f', color: '#b6a3ff' },
  { id: 'crash', label: 'Crash', emoji: '✨', key: 'g', color: '#f08fa4' },
];

export const DRUM_IDS = DRUMS.map((drum) => drum.id);

export const drumById = (id) => DRUMS.find((drum) => drum.id === id) || null;

export const drumByKey = (key) => {
  const lower = String(key || '').toLowerCase();
  return DRUMS.find((drum) => drum.key === lower) || null;
};

/* ------------------------------------------------------------ Jack's beats
 *
 * Every level is a real groove, not a random single-hit sequence. Steps
 * are written as the drums that land together on that beat:
 *   K = kick, S = snare, H = hi-hat, T = tom, C = crash
 * Level 1 is the simplest real rock beat there is: kick and hi-hat on
 * beat 1, hi-hat on the off-beats, snare and hi-hat on beat 3.
 */

const K = 'kick';
const S = 'snare';
const H = 'hihat';
const T = 'tom';
const C = 'crash';

/** Named grooves, one per level. `steps` is the bar; `name` is shown to Joel. */
export const JACK_BEATS = {
  1: {
    name: 'Rock Beat',
    steps: [
      [K, H],
      [H],
      [S, H],
      [H],
    ],
  },
  2: {
    name: 'Boom-Boom-Clap',
    steps: [
      [K, H],
      [K],
      [S, H],
      [H],
    ],
  },
  3: {
    name: 'Hi-Hat Hop',
    steps: [
      [K, H],
      [H],
      [S, H],
      [H],
      [K, H],
      [H],
      [S, H],
      [H],
    ],
  },
  4: {
    name: 'Jungle Stomp',
    steps: [
      [K, H],
      [H],
      [S],
      [H],
      [K],
      [H],
      [S, H],
      [H],
    ],
  },
  5: {
    name: 'Crash Intro',
    steps: [
      [C, K, H],
      [H],
      [S, H],
      [H],
      [K, H],
      [H],
      [S, H],
      [H],
    ],
  },
  6: {
    name: 'Tom Fill',
    steps: [
      [K, H],
      [H],
      [S, H],
      [H],
      [K, H],
      [T],
      [S, H],
      [T, H],
    ],
  },
};

/** Drums a generated groove may use at a given level. Crash joins at 5, tom at 6. */
export function copyCatDrums(level) {
  if (level >= 6) return ['kick', 'snare', 'hihat', 'tom', 'crash'];
  if (level >= 5) return ['kick', 'snare', 'hihat', 'crash'];
  if (level >= 3) return ['kick', 'snare', 'hihat'];
  return ['kick', 'snare', 'hihat'];
}

/** Steps in a bar: 4 quarter notes at levels 1–2, 8 eighth notes after. */
export function copyCatLength(level) {
  const safe = Math.max(1, Math.floor(level) || 1);
  return safe <= 2 ? 4 : 8;
}

/** Tempo starts at 60 BPM and climbs 3 BPM a level, up to 120. */
export const COPY_CAT_START_BPM = 60;
export const COPY_CAT_BPM_STEP = 3;
export const COPY_CAT_MAX_BPM = 120;

export function copyCatTempo(level) {
  const safe = Math.max(1, Math.floor(level) || 1);
  return Math.min(COPY_CAT_MAX_BPM, COPY_CAT_START_BPM + (safe - 1) * COPY_CAT_BPM_STEP);
}

/** Milliseconds per step: quarter notes at levels 1–2, eighth notes after. */
export function copyCatStepMs(level) {
  const tempo = copyCatTempo(level);
  return level <= 2 ? Math.round(60000 / tempo) : Math.round(60000 / tempo / 2);
}

/** Name of the groove Jack teaches at a level. */
export function copyCatBeatName(level) {
  const safe = Math.max(1, Math.floor(level) || 1);
  return JACK_BEATS[safe] ? JACK_BEATS[safe].name : 'Rock Beat';
}

/**
 * Build a groove for a level. The first six levels are Jack's fixed real
 * beats; later levels are generated grooves in the same shape — hi-hat
 * keeping time, kick on beats 1 and 3, snare on 2 and 4, with a tom or
 * crash thrown in now and then. `rand` is injectable so tests can use a
 * fixed sequence.
 */
export function generatePattern(level, rand = Math.random) {
  const safe = Math.max(1, Math.floor(level) || 1);
  if (JACK_BEATS[safe]) return JACK_BEATS[safe].steps.map((step) => [...step]);
  const steps = [];
  for (let i = 0; i < 8; i += 1) {
    const step = [H];
    if (i === 0 || i === 4) step.unshift(K);
    else if (i === 2 || i === 6) step.unshift(S);
    else if (rand() < 0.18) step.unshift(K);
    if (i === 0 && rand() < 0.3) step.unshift(C);
    if (i === 7 && rand() < 0.35) step.push(T);
    steps.push(step);
  }
  return steps;
}

/** Milliseconds for one full bar of the groove — no pause after it. */
export function copyCatLoopMs(level) {
  return copyCatLength(level) * copyCatStepMs(level);
}

/**
 * Check one tap against the step Joel is on.
 * `hitDrums` is the list of drums already hit in the current step.
 * Returns 'wrong' when the drum is not in this step (or was already
 * hit), 'correct' when the tap is right but the step still needs more
 * drums, 'step' when the step is now complete but the bar is not done,
 * or 'complete' when the last step of the bar is complete.
 */
export function checkCopyCatTap(pattern, stepIndex, hitDrums, drumId) {
  const step = pattern[stepIndex];
  if (!step || !step.includes(drumId)) return 'wrong';
  if (hitDrums.includes(drumId)) return 'wrong';
  const done = hitDrums.length + 1 === step.length;
  if (!done) return 'correct';
  return stepIndex + 1 === pattern.length ? 'complete' : 'step';
}

/** Stars for finishing a groove: 3 on the first try, 2 on the second, 1 after. */
export function starsForAttempts(attempts) {
  if (attempts <= 1) return 3;
  if (attempts === 2) return 2;
  return 1;
}

export const starString = (stars) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
