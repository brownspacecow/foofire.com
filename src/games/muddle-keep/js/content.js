/* ------------------------------------------------------------------ *
 * Content loader
 * Rooms, creatures, spells, traps, intruders and levels all live in
 * /public/data/muddle-keep/*.json. Adding content means adding data.
 * Rows in a level map may be ragged; missing cells are filled with rock.
 * ------------------------------------------------------------------ */

import { CHAR_TILES, T } from './tiles.js';

const DATA_ROOT = new URL('../../../../public/data/muddle-keep/', import.meta.url);

async function getJson(file) {
  const response = await fetch(new URL(file, DATA_ROOT), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
  return response.json();
}

const byId = (list) => new Map(list.map((entry) => [entry.id, entry]));

/**
 * Turn ASCII rows into a tile array plus the special tile positions.
 * Every map gets a heart, a portal and a hero gate; missing ones fall
 * back to sensible positions instead of breaking the level.
 */
export function parseMap(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Level map is empty');
  const h = rows.length;
  const w = rows.reduce((widest, row) => Math.max(widest, String(row).length), 0);
  const tiles = new Uint8Array(w * h);
  let heart = null;
  let portal = null;
  let gate = null;

  for (let y = 0; y < h; y += 1) {
    const row = String(rows[y]);
    for (let x = 0; x < w; x += 1) {
      const char = row[x] ?? '#';
      const tile = CHAR_TILES[char] ?? T.BEDROCK;
      tiles[y * w + x] = tile;
      if (char === 'H') heart = { x, y };
      if (char === 'P') portal = { x, y };
      if (char === 'E') gate = { x, y };
    }
  }

  const findAny = (tile) => {
    for (let i = 0; i < tiles.length; i += 1) {
      if (tiles[i] === tile) return { x: i % w, y: Math.floor(i / w) };
    }
    return null;
  };

  heart = heart ?? findAny(T.FLOOR) ?? { x: 1, y: 1 };
  portal = portal ?? heart;
  gate =
    gate ??
    (() => {
      for (let y = h - 1; y >= 0; y -= 1) {
        for (let x = 0; x < w; x += 1) {
          if (tiles[y * w + x] === T.DIRT) return { x, y };
        }
      }
      return { x: w - 2, y: h - 2 };
    })();

  // The heart and portal squares are part of the dungeon from the start.
  tiles[heart.y * w + heart.x] = T.FLOOR;
  tiles[portal.y * w + portal.x] = T.FLOOR;

  return { w, h, tiles, heart, portal, gate };
}

export async function loadContent() {
  const [roomsFile, creaturesFile, spellsFile, trapsFile, heroesFile, levelsFile] =
    await Promise.all([
      getJson('rooms.json'),
      getJson('creatures.json'),
      getJson('spells.json'),
      getJson('traps.json'),
      getJson('heroes.json'),
      getJson('levels.json'),
    ]);

  const rooms = Array.isArray(roomsFile.rooms) ? roomsFile.rooms : [];
  const research = Array.isArray(roomsFile.research) ? roomsFile.research : [];
  const creatures = Array.isArray(creaturesFile.creatures) ? creaturesFile.creatures : [];
  const spells = Array.isArray(spellsFile.spells) ? spellsFile.spells : [];
  const traps = Array.isArray(trapsFile.traps) ? trapsFile.traps : [];
  const heroes = Array.isArray(heroesFile.heroes) ? heroesFile.heroes : [];
  const levels = (Array.isArray(levelsFile.levels) ? levelsFile.levels : []).map(
    (level, index) => ({
      ...level,
      number: level.number ?? index + 1,
      mapData: parseMap(level.map),
    })
  );

  return {
    rooms,
    roomById: byId(rooms),
    research,
    researchById: byId(research),
    creatures,
    creatureById: byId(creatures),
    spells,
    spellById: byId(spells),
    traps,
    trapById: byId(traps),
    heroes,
    heroById: byId(heroes),
    levels,
    levelById: byId(levels),
  };
}
