import { ROOMS } from './content.js';
import { levelFor } from './progression.js';

export const SAVE_VERSION = 2;
const SAVE_ID = 'primary';
const FALLBACK_KEY = 'earwarts.save.fallback';
const BACKUP_PREFIX = 'earwarts.save.corrupt.';
const ZERO_STATS = { pitch: 0, rhythm: 0, interval: 0, melody: 0, harmony: 0, perfect: 0 };

const today = () => new Date().toISOString().slice(0, 10);

function yesterdayOf(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function createDefaultSave() {
  const now = new Date().toISOString();
  return {
    version: SAVE_VERSION,
    playerName: '',
    house: '',
    level: 1,
    resonance: 0,
    unlockedRooms: ['great-hall', 'spellcasting-tower'],
    unlockedSpells: ['lumina', 'echo'],
    unlockedPets: ['baby-owl'],
    completedQuests: [],
    achievements: [],
    challengeStats: { ...ZERO_STATS },
    cosmetics: [],
    petAccessory: null,
    tutorialStep: 0,
    streakDays: 1,
    lastPlayedDate: today(),
    audio: { volume: 0.7, muted: false },
    captions: true,
    createdAt: now,
    updatedAt: now,
  };
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const safeArray = (value, allowed) => {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return allowed.filter((id) => value.includes(id) && set.has(id));
};

const safeNumber = (value, fallback, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

function normalise(raw) {
  const base = createDefaultSave();
  const roomIds = ROOMS.map((room) => room.id);
  const spellIds = ['lumina', 'floris', 'leviosa', 'echo'];
  const statSource = isRecord(raw.challengeStats) ? raw.challengeStats : {};
  const legacyWins = isRecord(raw.wins) ? raw.wins : {};

  const stats = {
    pitch: Math.floor(safeNumber(statSource.pitch ?? legacyWins.pitch, 0, 0, 999)),
    rhythm: Math.floor(safeNumber(statSource.rhythm ?? legacyWins.rhythm, 0, 0, 999)),
    interval: Math.floor(safeNumber(statSource.interval ?? legacyWins.interval, 0, 0, 999)),
    melody: Math.floor(safeNumber(statSource.melody ?? legacyWins.melody, 0, 0, 999)),
    harmony: Math.floor(safeNumber(statSource.harmony ?? legacyWins.harmony, 0, 0, 999)),
    perfect: Math.floor(safeNumber(statSource.perfect, 0, 0, 999)),
  };

  const resonance = safeNumber(raw.resonance, 0, 0, 1_000_000);
  const house = typeof raw.house === 'string' ? raw.house : '';
  const unlockedRooms = safeArray(raw.unlockedRooms, roomIds);
  for (const room of ROOMS) {
    if (room.threshold === 0 && !unlockedRooms.includes(room.id)) unlockedRooms.push(room.id);
  }
  for (const room of ROOMS) {
    if (room.threshold <= resonance && !unlockedRooms.includes(room.id)) unlockedRooms.push(room.id);
  }
  unlockedRooms.sort((a, b) => roomIds.indexOf(a) - roomIds.indexOf(b));

  const unlockedSpells = safeArray(raw.unlockedSpells, spellIds);
  for (const initial of ['lumina', 'echo']) {
    if (!unlockedSpells.includes(initial)) unlockedSpells.push(initial);
  }

  const completedQuests = Array.isArray(raw.completedQuests)
    ? raw.completedQuests.filter((id) => typeof id === 'string')
    : [];
  const achievements = Array.isArray(raw.achievements)
    ? raw.achievements.filter((id) => typeof id === 'string')
    : [];
  const cosmetics = Array.isArray(raw.cosmetics)
    ? raw.cosmetics.filter((id) => typeof id === 'string')
    : [];
  const unlockedPets = Array.isArray(raw.unlockedPets)
    ? raw.unlockedPets.filter((id) => typeof id === 'string')
    : [];
  if (unlockedPets.length === 0) unlockedPets.push('baby-owl');

  const audioRaw = isRecord(raw.audio) ? raw.audio : {};
  const lastPlayedDate =
    typeof raw.lastPlayedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastPlayedDate)
      ? raw.lastPlayedDate
      : today();
  const streakRaw = Math.floor(safeNumber(raw.streakDays, 1, 1, 10_000));

  const normalised = {
    ...base,
    playerName: typeof raw.playerName === 'string' ? raw.playerName.trim().slice(0, 24) : '',
    house: ['phoenix', 'dragon', 'owl', 'unicorn'].includes(house) ? house : '',
    resonance,
    level: levelFor(resonance),
    unlockedRooms,
    unlockedSpells,
    unlockedPets,
    completedQuests,
    achievements,
    challengeStats: stats,
    cosmetics,
    petAccessory:
      typeof raw.petAccessory === 'string' && cosmetics.includes(raw.petAccessory)
        ? raw.petAccessory
        : null,
    tutorialStep: Math.floor(safeNumber(raw.tutorialStep, 0, 0, 999)),
    streakDays: streakRaw,
    lastPlayedDate,
    audio: {
      volume: safeNumber(audioRaw.volume, 0.7, 0, 1),
      muted: Boolean(audioRaw.muted),
    },
    captions: raw.captions !== false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };

  if (normalised.lastPlayedDate !== today()) {
    normalised.streakDays =
      normalised.lastPlayedDate === yesterdayOf(today()) ? normalised.streakDays + 1 : 1;
    normalised.lastPlayedDate = today();
  }

  return normalised;
}

export function migrateSave(raw) {
  if (!isRecord(raw)) return null;
  const version = typeof raw.version === 'number' ? raw.version : 1;
  if (version > SAVE_VERSION + 5) return null;
  const save = normalise(raw);
  return {
    save,
    migrated: version < SAVE_VERSION,
    repaired: version === SAVE_VERSION && JSON.stringify(save) !== JSON.stringify(raw),
  };
}

export function exportSaveJson(save) {
  return JSON.stringify({ ...save, version: SAVE_VERSION }, null, 2);
}

export function parseImportedSave(text) {
  try {
    return migrateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- storage */

let databasePromise = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open('earwarts-academy', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('saves')) {
        db.createObjectStore('saves', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export async function readStoredSave() {
  try {
    const db = await openDatabase();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readonly');
      const request = tx.objectStore('saves').get(SAVE_ID);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!record) return null;
    return record.game;
  } catch {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export async function writeStoredSave(save) {
  const record = { id: SAVE_ID, game: save, savedAt: Date.now() };
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    try {
      localStorage.removeItem(FALLBACK_KEY);
    } catch {
      /* optional backup */
    }
  } catch {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(save));
    } catch {
      /* both stores refused; the session stays in memory */
    }
  }
}

export function backupBrokenSave(raw) {
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    localStorage.setItem(`${BACKUP_PREFIX}${Date.now()}`, text.slice(0, 200_000));
  } catch {
    /* a backup is a courtesy */
  }
}

export class SaveSystem {
  constructor() {
    this.queue = Promise.resolve();
  }

  async load() {
    let raw = null;
    try {
      raw = await readStoredSave();
    } catch {
      raw = null;
    }
    if (raw == null) {
      return { save: createDefaultSave(), recovered: false, migrated: false, repaired: false };
    }
    const migrated = migrateSave(raw);
    if (!migrated) {
      backupBrokenSave(raw);
      return { save: createDefaultSave(), recovered: true, migrated: false, repaired: false };
    }
    return {
      save: migrated.save,
      recovered: false,
      migrated: migrated.migrated,
      repaired: migrated.repaired,
    };
  }

  save(save) {
    const snapshot = { ...save, updatedAt: new Date().toISOString() };
    this.queue = this.queue.then(() => writeStoredSave(snapshot)).catch(() => undefined);
  }

  async saveNow(save) {
    this.save(save);
    await this.queue;
  }

  exportFile(save) {
    const blob = new Blob([exportSaveJson(save)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `earwarts-academy-${(save.playerName || 'apprentice')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async importFile(file) {
    const text = await file.text();
    const imported = parseImportedSave(text);
    if (!imported) return null;
    const save = {
      ...imported.save,
      createdAt: imported.save.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.saveNow(save);
    return { save, migrated: imported.migrated };
  }
}

export const saveSystem = new SaveSystem();
