/*
 * Procedural cellar floors: small stone rooms joined by wet corridors.
 * Floors are plain data so a descent can be saved and resumed.
 */
import { ENEMY_POOLS, LORES } from './content.js';

export const MAP_W = 19;
export const MAP_H = 13;
const FOV_RADIUS = 4.4;

export const WALL = 0;
export const FLOOR = 1;
export const STAIRS = 2;
export const ALTAR = 3;

const key = (x, y) => `${x},${y}`;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function createDungeon(seed) {
  return {
    seed,
    w: MAP_W,
    h: MAP_H,
    tiles: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(WALL)),
    seen: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0)),
    rooms: [],
    party: { x: 1, y: 1 },
    prev: { x: 1, y: 1 },
    stairs: null,
    entities: [],
    calm: 0,
    nextUid: 1,
  };
}

export function generateFloor(depth, rng, difficulty = 'dread') {
  const dungeon = createDungeon(rng.seed());

  const isLast = depth >= 6;
  const roomTarget = isLast ? 5 : 5 + Math.floor(depth / 2);
  let attempts = 0;

  while (dungeon.rooms.length < roomTarget && attempts < 260) {
    attempts += 1;
    const wide = isLast && dungeon.rooms.length === roomTarget - 1;
    const w = wide ? rng.int(6, 7) : rng.int(3, 5);
    const h = wide ? rng.int(4, 5) : rng.int(3, 4);
    const x = rng.int(1, MAP_W - w - 2);
    const y = rng.int(1, MAP_H - h - 2);
    const room = { x, y, w, h };
    const overlaps = dungeon.rooms.some(
      (other) =>
        x <= other.x + other.w &&
        x + w >= other.x &&
        y <= other.y + other.h &&
        y + h >= other.y
    );
    if (overlaps) continue;
    dungeon.rooms.push(room);
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) dungeon.tiles[row][col] = FLOOR;
    }
  }

  /* Carve an L between the middle of each room and the next. */
  const middle = (room) => ({
    x: room.x + Math.floor(room.w / 2),
    y: room.y + Math.floor(room.h / 2),
  });
  for (let i = 1; i < dungeon.rooms.length; i += 1) {
    const a = middle(dungeon.rooms[i - 1]);
    const b = middle(dungeon.rooms[i]);
    carveCorridor(dungeon, a, b, rng);
  }

  /* A second route makes the floor feel like a place, not a train line. */
  if (dungeon.rooms.length > 3 && rng.chance(0.7)) {
    const i = rng.int(0, dungeon.rooms.length - 3);
    const j = Math.min(dungeon.rooms.length - 1, i + rng.int(2, 3));
    carveCorridor(dungeon, middle(dungeon.rooms[i]), middle(dungeon.rooms[j]), rng);
  }

  const first = dungeon.rooms[0];
  const last = dungeon.rooms[dungeon.rooms.length - 1];
  const start = middle(first);
  const finish = middle(last);
  dungeon.party = { x: start.x, y: start.y };
  dungeon.prev = { x: start.x, y: start.y };

  if (isLast) {
    dungeon.tiles[finish.y][finish.x] = ALTAR;
    addEntity(dungeon, { kind: 'boss', archetype: 'unnamed', x: finish.x, y: finish.y });
  } else {
    dungeon.tiles[finish.y][finish.x] = STAIRS;
    dungeon.stairs = { x: finish.x, y: finish.y };
  }

  const free = [];
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (dungeon.tiles[y][x] !== FLOOR) continue;
      if (chebyshev({ x, y }, start) < 2) continue;
      if (entityAt(dungeon, x, y)) continue;
      free.push({ x, y });
    }
  }
  const spots = rng.shuffle(free);

  const takeSpot = (filter = () => true) => {
    for (let i = 0; i < spots.length; i += 1) {
      const spot = spots[i];
      if (!filter(spot)) continue;
      if (entityAt(dungeon, spot.x, spot.y)) continue;
      spots.splice(i, 1);
      return spot;
    }
    return null;
  };

  const pool = ENEMY_POOLS[Math.min(ENEMY_POOLS.length - 1, depth - 1)];
  const enemyCount = isLast ? 2 : 2 + Math.floor(depth / 2);
  /* On Dread, deeper floors arrive as packs: one stun should not answer a whole room. */
  const packs = difficulty === 'dread' && depth >= 3;
  let placed = 0;
  while (placed < enemyCount) {
    const spot = takeSpot((s) => chebyshev(s, start) >= 5 && chebyshev(s, finish) >= 1);
    if (!spot) break;
    const packSize = packs
      ? depth >= 4 && placed === 0
        ? Math.min(3, enemyCount)
        : 2
      : 1;
    const mates = [];
    for (let i = 1; i < packSize && placed + i < enemyCount; i += 1) {
      const mate = takeSpot((s) => chebyshev(s, spot) >= 1 && chebyshev(s, spot) <= 2);
      if (!mate) break;
      mates.push(mate);
    }
    const packId = mates.length ? `pack-${depth}-${placed}` : null;
    for (const at of [spot, ...mates]) {
      addEntity(dungeon, {
        kind: 'enemy',
        archetype: rng.pick(pool),
        x: at.x,
        y: at.y,
        pack: packId,
        omen: rng.pick([
          'Something unfolds out of the dark.',
          'The lamp finds it first. It does not seem to mind.',
          'It has been waiting with the patience of furniture.',
          'You hear your own name, badly pronounced.',
        ]),
      });
      placed += 1;
    }
  }

  for (let i = 0; i < 2; i += 1) {
    const spot = takeSpot((s) => chebyshev(s, start) >= 3);
    if (spot) addEntity(dungeon, { kind: 'cache', x: spot.x, y: spot.y });
  }

  if (depth <= 5) {
    const spot = takeSpot((s) => chebyshev(s, start) >= 3);
    if (spot) addEntity(dungeon, { kind: 'shrine', x: spot.x, y: spot.y });
  }

  const loreSpot = takeSpot((s) => chebyshev(s, start) >= 3);
  if (loreSpot) {
    const lore = rng.pick(LORES);
    addEntity(dungeon, { kind: 'lore', loreId: lore.id, x: loreSpot.x, y: loreSpot.y });
  }

  const trapCount = depth >= 3 ? 2 : 1;
  for (let i = 0; i < trapCount; i += 1) {
    const spot = takeSpot((s) => chebyshev(s, start) >= 3);
    if (spot) addEntity(dungeon, { kind: 'trap', x: spot.x, y: spot.y });
  }

  reveal(dungeon);
  return dungeon;
}

function carveCorridor(dungeon, a, b, rng) {
  const carve = (x, y) => {
    if (!inBounds(x, y)) return;
    if (dungeon.tiles[y][x] === WALL) dungeon.tiles[y][x] = FLOOR;
  };
  const horizontalFirst = rng.chance(0.5);
  if (horizontalFirst) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) carve(x, a.y);
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) carve(b.x, y);
  } else {
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) carve(a.x, y);
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) carve(x, b.y);
  }
}

export function addEntity(dungeon, entity) {
  const withId = { uid: `e${dungeon.nextUid}`, ...entity };
  dungeon.nextUid += 1;
  dungeon.entities.push(withId);
  return withId;
}

export function entityAt(dungeon, x, y) {
  return dungeon.entities.find((entity) => entity.x === x && entity.y === y) || null;
}

export function removeEntity(dungeon, uid) {
  dungeon.entities = dungeon.entities.filter((entity) => entity.uid !== uid);
}

export function clearEntities(dungeon, uids) {
  const set = new Set(uids);
  dungeon.entities = dungeon.entities.filter((entity) => !set.has(entity.uid));
}

export function isWalkable(dungeon, x, y) {
  if (!inBounds(x, y)) return false;
  return dungeon.tiles[y][x] !== WALL;
}

export function roomAt(dungeon, x, y) {
  return (
    dungeon.rooms.find(
      (room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h
    ) || null
  );
}

function hasSight(dungeon, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (let guard = 0; guard < 80; guard += 1) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    if (dungeon.tiles[y][x] === WALL) return false;
  }
  return false;
}

/** Mark everything the lamp can reach as seen, and return the currently lit set. */
export function reveal(dungeon) {
  const { x, y } = dungeon.party;
  const visible = new Set();
  const radius = FOV_RADIUS;
  const minX = Math.max(0, Math.floor(x - radius));
  const maxX = Math.min(MAP_W - 1, Math.ceil(x + radius));
  const minY = Math.max(0, Math.floor(y - radius));
  const maxY = Math.min(MAP_H - 1, Math.ceil(y + radius));

  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const distance = Math.hypot(tx - x, ty - y);
      if (distance > radius) continue;
      if (!hasSight(dungeon, x, y, tx, ty)) continue;
      visible.add(key(tx, ty));
      dungeon.seen[ty][tx] = 1;
    }
  }

  const room = roomAt(dungeon, x, y);
  if (room) {
    for (let ty = room.y; ty < room.y + room.h; ty += 1) {
      for (let tx = room.x; tx < room.x + room.w; tx += 1) {
        visible.add(key(tx, ty));
        dungeon.seen[ty][tx] = 1;
      }
    }
  }

  return visible;
}

/** One step per horror toward the lamp; returns an enemy that reached the party. */
export function roamEnemies(dungeon, rng) {
  if (dungeon.calm > 0) {
    dungeon.calm -= 1;
    return null;
  }

  let reached = null;
  const party = dungeon.party;

  for (const enemy of dungeon.entities) {
    if (enemy.kind !== 'enemy') continue;
    if (chebyshev(enemy, party) > 5) continue;

    const dx = Math.sign(party.x - enemy.x);
    const dy = Math.sign(party.y - enemy.y);
    const options = [];
    if (Math.abs(party.x - enemy.x) >= Math.abs(party.y - enemy.y)) {
      if (dx) options.push({ x: enemy.x + dx, y: enemy.y });
      if (dy) options.push({ x: enemy.x, y: enemy.y + dy });
    } else {
      if (dy) options.push({ x: enemy.x, y: enemy.y + dy });
      if (dx) options.push({ x: enemy.x + dx, y: enemy.y });
    }
    const shuffled = rng.shuffle(options);

    for (const option of shuffled) {
      if (option.x === party.x && option.y === party.y) {
        reached = enemy;
        break;
      }
      if (!isWalkable(dungeon, option.x, option.y)) continue;
      if (entityAt(dungeon, option.x, option.y)) continue;
      enemy.x = option.x;
      enemy.y = option.y;
      break;
    }
    if (reached) break;
  }

  return reached;
}

export const ENTITY_INFO = {
  enemy: { glyph: '?', label: 'a horror', className: 'entity-enemy' },
  boss: { glyph: 'Ω', label: 'the thing at the altar', className: 'entity-boss' },
  cache: { glyph: '¤', label: 'a strongbox', className: 'entity-cache' },
  shrine: { glyph: '†', label: 'a shrine', className: 'entity-shrine' },
  lore: { glyph: '§', label: 'a relic of paper', className: 'entity-lore' },
  trap: { glyph: '✶', label: 'a trap', className: 'entity-trap' },
  stairs: { glyph: '▼', label: 'the stair down', className: 'entity-stairs' },
};
