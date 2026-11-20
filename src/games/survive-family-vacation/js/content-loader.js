/* ------------------------------------------------------------------ *
 * Content loader
 * Story, levels, collectibles, dialogue and achievements all live in
 * /public/data/vacation/*.json. Adding a vacation means adding data,
 * not engine code.
 * ------------------------------------------------------------------ */

const DATA_ROOT = new URL('../../../../public/data/vacation/', import.meta.url);

const getJson = async (file) => {
  const response = await fetch(new URL(file, DATA_ROOT), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
  return response.json();
};

export async function loadContent() {
  const [levelsFile, collectiblesFile, dialogFile, cutscenesFile, achievementsFile] =
    await Promise.all([
      getJson('levels.json'),
      getJson('collectibles.json'),
      getJson('dialog.json'),
      getJson('cutscenes.json'),
      getJson('achievements.json'),
    ]);

  const levels = Array.isArray(levelsFile.levels) ? levelsFile.levels : [];
  const memories = Array.isArray(collectiblesFile.memories) ? collectiblesFile.memories : [];
  const clues = Array.isArray(collectiblesFile.clues) ? collectiblesFile.clues : [];
  const secrets = Array.isArray(collectiblesFile.secrets) ? collectiblesFile.secrets : [];

  const byId = (list) => new Map(list.map((entry) => [entry.id, entry]));

  return {
    bounds: levelsFile.bounds ?? { minX: -21, maxX: 21, minZ: -19, maxZ: 19 },
    levels,
    levelById: byId(levels),
    memories,
    memoryById: byId(memories),
    clues,
    clueById: byId(clues),
    secrets,
    secretById: byId(secrets),
    lore: Array.isArray(collectiblesFile.lore) ? collectiblesFile.lore : [],
    signs: dialogFile.signs ?? {},
    people: dialogFile.people ?? {},
    barks: dialogFile.barks ?? {},
    idle: Array.isArray(dialogFile.idle) ? dialogFile.idle : [],
    cutscenes: cutscenesFile,
    achievements: Array.isArray(achievementsFile.achievements)
      ? achievementsFile.achievements
      : [],
    totals: {
      memories: memories.length,
      clues: clues.length,
      secrets: secrets.length,
      levels: levels.length,
      signs: Object.keys(dialogFile.signs ?? {}).length,
    },
  };
}

/** Every item placed in a level, resolved against its catalogue entry. */
export function resolveLevelObjects(level, content) {
  return (level.objects ?? []).map((object) => {
    if (object.kind === 'memory') {
      const memory = content.memoryById.get(object.id);
      return { ...object, name: memory?.name ?? 'Memory', emoji: memory?.emoji ?? '📦', blurb: memory?.blurb ?? '' };
    }
    if (object.kind === 'clue') {
      const clue = content.clueById.get(object.id);
      return { ...object, name: clue?.name ?? 'Clue', emoji: clue?.emoji ?? '🔎', text: clue?.text ?? '' };
    }
    if (object.kind === 'secret') {
      const secret = content.secretById.get(object.id);
      return {
        ...object,
        name: secret?.name ?? 'Golden Secret',
        emoji: secret?.emoji ?? '✨',
        blurb: secret?.blurb ?? '',
        luck: secret?.luck ?? 0,
      };
    }
    if (object.kind === 'sign') {
      return { ...object, text: content.signs[object.id] ?? '' };
    }
    if (object.kind === 'person') {
      const person = content.people[object.id];
      return { ...object, name: person?.who ?? 'Someone', emoji: person?.emoji ?? '👋', lines: person?.lines ?? [] };
    }
    return object;
  });
}

/** Line for a level's intro/outro arrays, tolerant of missing content. */
export function linesFor(level, key) {
  return Array.isArray(level?.[key]) ? level[key] : [];
}
