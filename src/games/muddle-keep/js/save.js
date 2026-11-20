/* ------------------------------------------------------------------ *
 * Save profile
 * Level progress, the current level snapshot and settings live in
 * localStorage. A blocked or corrupt store must never stop the game
 * from playing; it just forgets.
 * ------------------------------------------------------------------ */

const KEY = 'muddleKeep.v1';
const VERSION = 1;

export const DEFAULT_SETTINGS = {
  volume: 0.7,
  muted: false,
  quality: 'high',
};

export function freshProfile() {
  return {
    version: VERSION,
    unlocked: 1,
    best: {},
    current: null,
    settings: { ...DEFAULT_SETTINGS },
    stats: { wins: 0, heroes: 0 },
    seenTips: [],
  };
}

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const number = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

function normaliseSnapshot(raw) {
  if (!isRecord(raw)) return null;
  if (typeof raw.levelId !== 'string') return null;
  if (!isRecord(raw.world) || !Array.isArray(raw.world.tiles)) return null;
  return raw;
}

export function normaliseProfile(raw) {
  const profile = freshProfile();
  if (!isRecord(raw)) return profile;

  profile.unlocked = Math.floor(number(raw.unlocked, 1, 1, 5));
  if (isRecord(raw.settings)) {
    profile.settings = {
      volume: number(raw.settings.volume, DEFAULT_SETTINGS.volume, 0, 1),
      muted: Boolean(raw.settings.muted),
      quality: raw.settings.quality === 'low' ? 'low' : 'high',
    };
  }
  const current = normaliseSnapshot(raw.current);
  if (current && current.status === 'playing') profile.current = current;
  if (isRecord(raw.stats)) {
    profile.stats = {
      wins: Math.floor(number(raw.stats.wins, 0, 0, 10_000)),
      heroes: Math.floor(number(raw.stats.heroes, 0, 0, 1_000_000)),
    };
  }
  if (isRecord(raw.best)) {
    for (const [levelId, value] of Object.entries(raw.best)) {
      const time = number(value, 0, 0, 100_000);
      if (time > 0) profile.best[levelId] = Math.round(time);
    }
  }
  if (Array.isArray(raw.seenTips)) {
    profile.seenTips = raw.seenTips.filter((tip) => typeof tip === 'string').slice(0, 64);
  }
  return profile;
}

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    return normaliseProfile(JSON.parse(raw));
  } catch {
    return freshProfile();
  }
}

export function saveProfile(profile) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage is optional */
  }
}
