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

/** The six drums, in kit order. `key` is the keyboard key for each pad. */
export const DRUMS = [
  { id: 'kick', label: 'Kick', emoji: '🥁', key: 'a', color: '#ff6b5e' },
  { id: 'snare', label: 'Snare', emoji: '🪘', key: 's', color: '#f4c95d' },
  { id: 'hihat', label: 'Hi-Hat', emoji: '🎩', key: 'd', color: '#7fd8c6' },
  { id: 'tom', label: 'Tom', emoji: '🥁', key: 'f', color: '#b6a3ff' },
  { id: 'crash', label: 'Crash', emoji: '✨', key: 'g', color: '#f08fa4' },
  // Ride is Free Play only: it never appears in Jack's beats or pools.
  { id: 'ride', label: 'Ride', emoji: '🔔', key: 'h', color: '#ff9f43' },
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

/** Milliseconds for one full Jack-plus-Joel cycle: two bars, no more.
 *  Level 1 is 8 quarter-note steps (8000ms at 60 BPM); from level 3
 *  it is 16 eighth-note steps. If a cycle ever measures longer than
 *  this, a beat has crept in somewhere. */
export function copyCatCycleMs(level) {
  return 2 * copyCatLoopMs(level);
}

/** True when every drum in a step has been hit. */
export function stepIsDone(step, hits) {
  return step.every((drum) => (hits || []).includes(drum));
}

/**
 * Check one tap against the bar Joel is playing.
 * `hitsByStep` is one list of drums hit per step, kept for the whole bar
 * — a tap is never judged by the clock's current step alone, because a
 * 7-year-old's hands don't land exactly on the clock:
 * - A tap credits the earliest step next to the one he is on (the step
 *   before, his step, or the next step) that still needs that drum.
 *   So a hi-hat meant for step 0 still counts when the clock has just
 *   ticked to step 1, a snare tapped a beat early counts for the next
 *   step, and finishing a step early then playing the next step's drums
 *   counts too.
 * - A tap on a drum that is only in steps already done — a double-tap,
 *   or an extra tap on a finished step, even a couple of steps back —
 *   is 'ignored': he hears his drum, he just doesn't lose the bar
 *   for it.
 * - Only a tap on a drum in NO nearby step, and in no finished step
 *   either, is 'wrong': a genuinely wrong drum, like the crash on a
 *   level that has no crash, or a drum two steps too early.
 * The matched step records the hit, so a later tap on the same drum
 * counts for the next step that still needs it. Returns 'ignored',
 * 'wrong', 'correct' (step still needs more drums), 'step' (a step is
 * now complete but the bar is not done), or 'complete' (every step
 * of the bar is now complete).
 */
export function checkCopyCatTap(pattern, stepIndex, hitsByStep, drumId) {
  const nearby = [stepIndex - 1, stepIndex, stepIndex + 1];
  let seenInStep = false;
  for (const i of nearby) {
    const step = pattern[i];
    if (!step || !step.includes(drumId)) continue;
    seenInStep = true;
    const hits = hitsByStep[i] || (hitsByStep[i] = []);
    if (hits.includes(drumId)) continue;
    hits.push(drumId);
    if (!stepIsDone(step, hits)) return 'correct';
    const allDone = pattern.every((s, j) => stepIsDone(s, hitsByStep[j]));
    return allDone ? 'complete' : 'step';
  }
  // No step next to this one still needs the drum. It was either
  // already hit in a nearby step, or it belongs to a step that is
  // already done — an extra tap either way, ignored, never failed.
  if (seenInStep) return 'ignored';
  if (pattern.some((s, j) => s.includes(drumId) && stepIsDone(s, hitsByStep[j]))) {
    return 'ignored';
  }
  return 'wrong';
}

/** Stars for finishing a groove: 3 on the first try, 2 on the second, 1 after. */
export function starsForAttempts(attempts) {
  if (attempts <= 1) return 3;
  if (attempts === 2) return 2;
  return 1;
}

export const starString = (stars) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
