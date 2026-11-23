/* -------------------------------------------------------------------------
 * Drum Quest — pure game logic (no DOM, no audio).
 *
 * Jack teaches real grooves, one step at a time. A step is a list of drums
 * that land together, because that is how a beat really works: the kick and
 * hi-hat hit at the same moment, the snare and hi-hat land together on the
 * back beat. Lessons go from a two-drum heartbeat to a full bar with crash
 * and toms, and after the eight hand-written lessons Jack improvises new
 * grooves in the same shape.
 *
 * Everything here is testable with node --test.
 * ---------------------------------------------------------------------- */

/** The six drums, in kit order. `key` is the keyboard key for each pad. */
export const DRUMS = [
  { id: 'kick', label: 'Kick', key: 'a', color: '#ff6b5e' },
  { id: 'snare', label: 'Snare', key: 's', color: '#f4c95d' },
  { id: 'hihat', label: 'Hi-Hat', key: 'd', color: '#7fd8c6' },
  { id: 'tom', label: 'Tom', key: 'f', color: '#b6a3ff' },
  { id: 'crash', label: 'Crash', key: 'g', color: '#f08fa4' },
  // The ride is Free Play only: it never appears in Jack's lessons.
  { id: 'ride', label: 'Ride', key: 'h', color: '#ff9f43' },
];

export const drumById = (id) => DRUMS.find((drum) => drum.id === id) || null;

export const drumByKey = (key) => {
  const lower = String(key || '').toLowerCase();
  return DRUMS.find((drum) => drum.key === lower) || null;
};

const K = 'kick';
const S = 'snare';
const H = 'hihat';
const T = 'tom';
const C = 'crash';

/* ------------------------------------------------------------ the lessons
 *
 * Each lesson is one short groove. Steps are the drums that land together.
 * The order is a real drum teacher's order: find the back beat first, then
 * keep time on the hi-hat, then add a second kick, then fill around the kit.
 */
export const LESSONS = [
  {
    name: 'First Beat',
    tip: 'Kick on 1 and 3, snare on 2 and 4. That is the heartbeat of rock.',
    steps: [[K], [S], [K], [S]],
  },
  {
    name: 'Rock Beat',
    tip: 'The hi-hat keeps time while the kick and snare answer each other.',
    steps: [[K, H], [H], [S, H], [H]],
  },
  {
    name: 'Double Kick',
    tip: 'Two kicks in a row give the beat a little push. Hi-hat never stops.',
    steps: [[K, H], [K], [S, H], [H]],
  },
  {
    name: 'Hi-Hat Hop',
    tip: 'Same beat, twice as long. Count 1 and 2 and 3 and 4 and.',
    steps: [[K, H], [H], [S, H], [H], [K, H], [H], [S, H], [H]],
  },
  {
    name: 'Jungle Stomp',
    tip: 'The snare sneaks in without the hi-hat. Leave a little air there.',
    steps: [[K, H], [H], [S], [H], [K], [H], [S, H], [H]],
  },
  {
    name: 'Crash Landing',
    tip: 'Every bar starts with a crash — the big shiny hello.',
    steps: [[C, K, H], [H], [S, H], [H], [K, H], [H], [S, H], [H]],
  },
  {
    name: 'Tom Fill',
    tip: 'The last two steps walk across the toms. Big arms, big fun.',
    steps: [[K, H], [H], [S, H], [H], [K, H], [T], [S, H], [T, H]],
  },
  {
    name: 'Big Finish',
    tip: 'Crash, toms, back to the beat, then crash again. That is a song ending.',
    steps: [[C, K], [T], [S], [T], [K, H], [H], [S, H], [C]],
  },
];

/** Hand-written lessons, then endless generated ones. */
export const LESSON_COUNT = LESSONS.length;

const clampLevel = (level) => Math.max(1, Math.floor(Number(level)) || 1);

/** Name of the groove Jack teaches at a level. */
export function lessonName(level) {
  const safe = clampLevel(level);
  return LESSONS[safe - 1] ? LESSONS[safe - 1].name : `Jam Session ${safe}`;
}

/** One short coaching line for the lesson. */
export function lessonTip(level) {
  const safe = clampLevel(level);
  return LESSONS[safe - 1]
    ? LESSONS[safe - 1].tip
    : 'Jack made this one up for you. Listen first, then copy it.';
}

/** How many steps are in the bar at a level. */
export function lessonLength(level) {
  const safe = clampLevel(level);
  return LESSONS[safe - 1] ? LESSONS[safe - 1].steps.length : 8;
}

/**
 * Build a groove for a level. The eight hand-written lessons are real fixed
 * beats; after that Jack improvises in the same shape — hi-hat keeping time,
 * kick on 1 and 3, snare on 2 and 4, with a tom or crash thrown in now and
 * then. `rand` is injectable so tests can use a fixed sequence.
 */
export function lessonPattern(level, rand = Math.random) {
  const safe = clampLevel(level);
  const fixed = LESSONS[safe - 1];
  if (fixed) return fixed.steps.map((step) => [...step]);

  const steps = [];
  for (let i = 0; i < 8; i += 1) {
    const step = [H];
    if (i === 0 || i === 4) step.unshift(K);
    else if (i === 2 || i === 6) step.unshift(S);
    else if (i === 3 && rand() < 0.2) step.unshift(K);
    if (i === 0 && rand() < 0.3) step.unshift(C);
    if (i === 7 && rand() < 0.35) step.push(T);
    steps.push(step);
  }
  return steps;
}

/** Demo tempo: slow at first, a little quicker every lesson, capped. */
const LESSON_START_BPM = 64;
const LESSON_BPM_STEP = 3;
const LESSON_MAX_BPM = 104;

export function lessonTempo(level) {
  return Math.min(
    LESSON_MAX_BPM,
    LESSON_START_BPM + (clampLevel(level) - 1) * LESSON_BPM_STEP,
  );
}

/** Milliseconds between demo steps: one beat for short bars, an eighth for long ones. */
export function lessonStepMs(level) {
  const beat = 60000 / lessonTempo(level);
  return Math.round(lessonLength(level) > 4 ? beat / 2 : beat);
}

/** True when every drum in a step has been hit. */
export function stepIsDone(step, hits) {
  return step.every((drum) => (hits || []).includes(drum));
}

/**
 * Check one tap on the step the player is copying.
 * Drums in a step can be hit in any order — two thumbs can land together —
 * and a repeat tap is harmless ('extra'). Returns 'extra' (not in this step,
 * or already hit), 'correct' (step still needs more drums) or 'complete'
 * (this step is finished).
 */
export function checkStepTap(step, hits, drumId) {
  if (!step.includes(drumId)) return 'extra';
  if (hits.includes(drumId)) return 'extra';
  hits.push(drumId);
  return stepIsDone(step, hits) ? 'complete' : 'correct';
}

/** Stars for finishing a lesson: 3 clean, 2 with a couple of slips, 1 after. */
export function lessonStars(mistakes) {
  if (mistakes <= 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

export const starString = (stars) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));

/** "Kick + Hi-Hat", for messages and screen readers. */
export function stepLabel(step) {
  return step.map((id) => (drumById(id) || { label: id }).label).join(' + ');
}
