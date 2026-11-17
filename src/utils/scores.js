/* ------------------------------------------------------------------ *
 * High scores
 * The site is static (GitHub Pages), so scores live in localStorage on
 * this device. Each game keeps a top-five list plus its best score.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'foofireHighScores.v1';
const MAX_SCORES = 5;

/** Bests saved by games before this module existed, so old scores survive. */
const LEGACY_BEST_KEYS = {
  'pizza-homestead': 'pizzaHomesteadBest',
};

const toScore = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

const sortScores = (list) => list.sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);

const readStore = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const writeStore = (store) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    /* Storage can be blocked or full: the game still plays, it just forgets. */
  }
};

const readLegacyBest = (gameId) => {
  const key = LEGACY_BEST_KEYS[gameId];
  if (!key) return 0;
  try {
    return toScore(window.localStorage.getItem(key));
  } catch (error) {
    return 0;
  }
};

const normalise = (entries) =>
  Array.isArray(entries)
    ? sortScores(
        entries
          .filter((entry) => entry && toScore(entry.score) > 0)
          .map((entry) => ({ score: toScore(entry.score), at: Number(entry.at) || 0 }))
      )
    : [];

/**
 * Sorted scores for a game, seeding a best saved by an older version so it
 * shows up on the first read (the portal badge reads before any game runs).
 */
const loadEntries = (store, gameId) => {
  const entries = normalise(store[gameId]);
  if (entries.length) return entries;

  const legacy = readLegacyBest(gameId);
  if (legacy > 0) {
    const seeded = [{ score: legacy, at: 0 }];
    store[gameId] = seeded;
    writeStore(store);
    return seeded;
  }

  return entries;
};

/** Top scores for a game, best first. */
export function getScores(gameId) {
  return loadEntries(readStore(), gameId);
}

/** Best score for a game, or 0 when there is none yet. */
export function getBest(gameId) {
  const entries = getScores(gameId);
  return entries.length ? entries[0].score : 0;
}

/**
 * Record a finished score and return the best score now on record, whether
 * this run beat it, and the updated top-five list.
 */
export function submitScore(gameId, score) {
  const value = toScore(score);
  const store = readStore();
  const entries = loadEntries(store, gameId);

  const previousBest = entries.length ? entries[0].score : 0;
  const isBest = value > previousBest;

  if (value > 0) {
    entries.push({ score: value, at: Date.now() });
    store[gameId] = sortScores(entries);
    writeStore(store);
  }

  return {
    best: Math.max(previousBest, value),
    isBest,
    scores: normalise(store[gameId]),
  };
}
