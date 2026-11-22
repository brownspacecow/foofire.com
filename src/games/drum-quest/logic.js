/* -------------------------------------------------------------------------
 * Drum Quest — pure game logic (no DOM, no audio).
 * Everything in here is testable with node --test: pattern generation,
 * Copy Cat levels and scoring, and the Beat Builder grid + presets.
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

/* ---------------------------------------------------------------- Copy Cat */

export const COPY_CAT_MIN_LENGTH = 2;
export const COPY_CAT_MAX_LENGTH = 8;
export const COPY_CAT_START_BPM = 70;
export const COPY_CAT_MAX_BPM = 120;

/** Drums a pattern may use at a given level: tom joins from level 5. */
export function copyCatDrums(level) {
  return level >= 5 ? ['kick', 'snare', 'hihat', 'tom'] : ['kick', 'snare', 'hihat'];
}

/** Pattern length grows one hit every two levels: 2, 2, 3, 3, … up to 8. */
export function copyCatLength(level) {
  const safe = Math.max(1, Math.floor(level) || 1);
  return Math.min(
    COPY_CAT_MAX_LENGTH,
    COPY_CAT_MIN_LENGTH + Math.floor((safe - 1) / 2),
  );
}

/** Tempo starts at 70 BPM and climbs 5 BPM a level, up to 120. */
export function copyCatTempo(level) {
  const safe = Math.max(1, Math.floor(level) || 1);
  return Math.min(COPY_CAT_MAX_BPM, COPY_CAT_START_BPM + (safe - 1) * 5);
}

/** Milliseconds between pattern hits at a level (quarter notes). */
export function copyCatStepMs(level) {
  return Math.round(60000 / copyCatTempo(level));
}

/**
 * Build a pattern for a level. No drum repeats back-to-back, so the pattern
 * always feels like a beat instead of a stuck key. `rand` is injectable so
 * tests can use a fixed sequence.
 */
export function generatePattern(level, rand = Math.random) {
  const pool = copyCatDrums(level);
  const length = copyCatLength(level);
  const pattern = [];
  let previous = null;
  for (let i = 0; i < length; i += 1) {
    let pick = pool[Math.floor(rand() * pool.length)];
    // Never the same drum twice in a row (unless the pool has one drum).
    let guard = 0;
    while (pick === previous && pool.length > 1 && guard < 10) {
      pick = pool[Math.floor(rand() * pool.length)];
      guard += 1;
    }
    pattern.push(pick);
    previous = pick;
  }
  return pattern;
}

/**
 * Check one tap against the pattern so far.
 * Returns 'complete' when the whole pattern was matched, 'correct' when the
 * tap was right but the pattern is not finished, or 'wrong' on a miss.
 */
export function checkCopyCatTap(pattern, tapsSoFar, drumId) {
  const nextIndex = tapsSoFar.length;
  if (nextIndex >= pattern.length) return 'wrong';
  if (pattern[nextIndex] !== drumId) return 'wrong';
  return nextIndex + 1 === pattern.length ? 'complete' : 'correct';
}

/** Stars for finishing a pattern: 3 on the first try, 2 on the second, 1 after. */
export function starsForAttempts(attempts) {
  if (attempts <= 1) return 3;
  if (attempts === 2) return 2;
  return 1;
}

export const starString = (stars) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));

/* -------------------------------------------------------------- Beat Builder */

export const BUILDER_STEPS = 8;
export const BUILDER_ROWS = ['kick', 'snare', 'hihat'];
export const BUILDER_MIN_BPM = 60;
export const BUILDER_MAX_BPM = 120;

/** An empty 8-step grid: every row is eight off cells. */
export function emptyGrid() {
  const grid = {};
  for (const row of BUILDER_ROWS) grid[row] = Array(BUILDER_STEPS).fill(false);
  return grid;
}

const gridFromSteps = (stepsByRow) => {
  const grid = emptyGrid();
  for (const [row, steps] of Object.entries(stepsByRow)) {
    if (!BUILDER_ROWS.includes(row)) continue;
    for (const step of steps) {
      if (Number.isInteger(step) && step >= 0 && step < BUILDER_STEPS) {
        grid[row][step] = true;
      }
    }
  }
  return grid;
};

/**
 * Presets. Steps are 0-based eighth notes in one bar:
 * steps 0 and 4 are beats 1 and 3, steps 2 and 6 are beats 2 and 4.
 */
export const BEAT_PRESETS = {
  rock: {
    id: 'rock',
    name: 'Rock Beat',
    blurb: 'Kick on 1 and 3, snare on 2 and 4, hi-hat all the way.',
    grid: gridFromSteps({
      kick: [0, 4],
      snare: [2, 6],
      hihat: [0, 1, 2, 3, 4, 5, 6, 7],
    }),
  },
  'boom-boom-clap': {
    id: 'boom-boom-clap',
    name: 'Boom-Boom-Clap',
    blurb: 'Two kicks, then a clap of the snare. Say it while you play it!',
    grid: gridFromSteps({
      kick: [0, 1, 4],
      snare: [2, 6],
      hihat: [0, 2, 4, 6],
    }),
  },
  'jungle-stomp': {
    id: 'jungle-stomp',
    name: 'Jungle Stomp',
    blurb: 'A bouncy off-beat stomp. The hi-hat hops between the beats.',
    grid: gridFromSteps({
      kick: [0, 3, 4],
      snare: [2, 6],
      hihat: [1, 3, 5, 7],
    }),
  },
};

export const presetById = (id) => BEAT_PRESETS[id] || null;

/** A copy of a preset grid, so editing never mutates the preset itself. */
export function loadPreset(id) {
  const preset = presetById(id);
  if (!preset) return emptyGrid();
  const grid = emptyGrid();
  for (const row of BUILDER_ROWS) grid[row] = [...preset.grid[row]];
  return grid;
}

/** Flip one cell. Out-of-range rows/steps leave the grid unchanged. */
export function toggleCell(grid, row, step) {
  const next = emptyGrid();
  for (const r of BUILDER_ROWS) next[r] = [...(grid[r] || [])];
  if (!BUILDER_ROWS.includes(row)) return next;
  if (!Number.isInteger(step) || step < 0 || step >= BUILDER_STEPS) return next;
  next[row][step] = !next[row][step];
  return next;
}

/** Flatten a grid into the hits of one bar, in step order. */
export function gridToEvents(grid) {
  const events = [];
  for (let step = 0; step < BUILDER_STEPS; step += 1) {
    for (const row of BUILDER_ROWS) {
      if (grid[row] && grid[row][step]) events.push({ step, drum: row });
    }
  }
  return events;
}

/** True when no cell in the grid is on. */
export function isGridEmpty(grid) {
  return BUILDER_ROWS.every((row) => !(grid[row] || []).some(Boolean));
}

/** Milliseconds per eighth-note step at a tempo. */
export function builderStepMs(bpm) {
  const safe = Math.max(BUILDER_MIN_BPM, Math.min(BUILDER_MAX_BPM, bpm || 90));
  return Math.round(60000 / safe / 2);
}

/** Clamp a tempo into the slider range. */
export function clampTempo(bpm) {
  return Math.max(BUILDER_MIN_BPM, Math.min(BUILDER_MAX_BPM, Math.round(bpm) || 90));
}

/** True when a saved grid has the right shape to load. */
export function isValidGrid(value) {
  if (!value || typeof value !== 'object') return false;
  return BUILDER_ROWS.every(
    (row) =>
      Array.isArray(value[row]) &&
      value[row].length === BUILDER_STEPS &&
      value[row].every((cell) => typeof cell === 'boolean'),
  );
}
