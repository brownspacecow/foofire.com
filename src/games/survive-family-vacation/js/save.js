/* ------------------------------------------------------------------ *
 * Save profile
 * Everything lives in localStorage: progress, scrapbook, achievements
 * and settings. There is no backend, so a corrupt or blocked store has
 * to be survivable — the game plays, it just forgets.
 * ------------------------------------------------------------------ */

const KEY = 'surviveFamilyVacation.v1';

export const LUCK_TIERS = [
  { at: 0, name: 'A Normal Family', note: 'Nothing strange has happened. Yet.' },
  { at: 6, name: 'Suspiciously Lucky', note: 'Small things are going your way.' },
  { at: 14, name: 'Charmed', note: 'The family survives things it should not.' },
  { at: 24, name: 'Cartoon-Proof', note: 'Physics has quietly given up.' },
  { at: 36, name: 'The Collector Is Nervous', note: 'Something is keeping its distance.' },
];

export const DEFAULT_SETTINGS = {
  music: 0.45,
  sfx: 0.7,
  muted: false,
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  screenShake: true,
};

export const freshSave = () => ({
  v: 1,
  started: false,
  unlocked: 1,
  completed: [],
  memories: [],
  clues: [],
  secrets: [],
  signs: [],
  achievements: [],
  ending: false,
  settings: { ...DEFAULT_SETTINGS },
  stats: { swaps: 0, investigations: 0, crawls: 0, levelRuns: 0 },
});

const uniqueStrings = (value) =>
  Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string'))] : [];

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

/** Merge a stored profile over the defaults so old saves keep working. */
export function normaliseSave(raw) {
  const save = freshSave();
  if (!raw || typeof raw !== 'object') return save;

  save.started = Boolean(raw.started);
  save.ending = Boolean(raw.ending);
  save.unlocked = clampNumber(raw.unlocked, 1, 7, 1);
  /* Level numbers are saved as strings so every collected list is uniform. */
  save.completed = uniqueStrings(
    Array.isArray(raw.completed) ? raw.completed.map((value) => String(value)) : []
  );
  save.memories = uniqueStrings(raw.memories);
  save.clues = uniqueStrings(raw.clues);
  save.secrets = uniqueStrings(raw.secrets);
  save.signs = uniqueStrings(raw.signs);
  save.achievements = uniqueStrings(raw.achievements);

  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  save.settings = {
    music: clampNumber(settings.music, 0, 1, DEFAULT_SETTINGS.music),
    sfx: clampNumber(settings.sfx, 0, 1, DEFAULT_SETTINGS.sfx),
    muted: Boolean(settings.muted),
    reducedMotion: Boolean(settings.reducedMotion),
    highContrast: Boolean(settings.highContrast),
    largeText: Boolean(settings.largeText),
    screenShake: settings.screenShake === undefined ? true : Boolean(settings.screenShake),
  };

  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  save.stats = {
    swaps: clampNumber(stats.swaps, 0, 99999, 0),
    investigations: clampNumber(stats.investigations, 0, 99999, 0),
    crawls: clampNumber(stats.crawls, 0, 99999, 0),
    levelRuns: clampNumber(stats.levelRuns, 0, 99999, 0),
  };

  return save;
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return normaliseSave(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return freshSave();
  }
}

export function persistSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (error) {
    /* ignore */
  }
}

/** Family Luck is derived, not stored, so collected items always agree with it. */
export function luckOf(save) {
  return (
    (save.memories?.length ?? 0) +
    (save.clues?.length ?? 0) * 2 +
    (save.secrets?.length ?? 0) * 3 +
    (save.completed?.length ?? 0) * 5
  );
}

export function tierOf(luck) {
  let tier = LUCK_TIERS[0];
  for (const entry of LUCK_TIERS) {
    if (luck >= entry.at) tier = entry;
  }
  return tier;
}

/** Add an id to one of the collected lists, returning true when it is new. */
export function collect(save, field, id) {
  if (!Array.isArray(save[field])) save[field] = [];
  if (save[field].includes(id)) return false;
  save[field].push(id);
  return true;
}

const progressFor = (goal, save, totals) => {
  switch (goal.type) {
    case 'memories':
      return save.memories.length;
    case 'clues':
      return save.clues.length;
    case 'secrets':
      return save.secrets.length;
    case 'levels':
      return save.completed.length;
    case 'signs':
      return save.signs.length;
    case 'crawls':
      return save.stats.crawls;
    case 'investigations':
      return save.stats.investigations;
    case 'luck':
      return luckOf(save);
    case 'ending':
      return save.ending ? 1 : 0;
    case 'allMemories':
      return totals.memories > 0 && save.memories.length >= totals.memories ? 1 : 0;
    case 'allClues':
      return totals.clues > 0 && save.clues.length >= totals.clues ? 1 : 0;
    case 'allSecrets':
      return totals.secrets > 0 && save.secrets.length >= totals.secrets ? 1 : 0;
    case 'perfect':
      return save.ending &&
        save.memories.length >= totals.memories &&
        save.clues.length >= totals.clues &&
        save.secrets.length >= totals.secrets
        ? 1
        : 0;
    default:
      return 0;
  }
};

/**
 * Unlock every achievement whose goal is now met.
 * Returns the achievement objects that were newly unlocked, so the game
 * can show a toast for each.
 */
export function evaluateAchievements(save, achievements, totals) {
  const newlyEarned = [];
  for (const achievement of achievements) {
    if (save.achievements.includes(achievement.id)) continue;
    if (progressFor(achievement.goal, save, totals) >= achievement.goal.value) {
      save.achievements.push(achievement.id);
      newlyEarned.push(achievement);
    }
  }
  return newlyEarned;
}

/** Progress toward the next luck tier, for the HUD meter. */
export function luckProgress(luck) {
  let index = 0;
  for (let i = 0; i < LUCK_TIERS.length; i += 1) {
    if (luck >= LUCK_TIERS[i].at) index = i;
  }
  const current = LUCK_TIERS[index];
  const next = LUCK_TIERS[index + 1] ?? null;
  const span = next ? next.at - current.at : 1;
  const ratio = next ? Math.min(1, (luck - current.at) / span) : 1;
  return { current, next, ratio };
}
