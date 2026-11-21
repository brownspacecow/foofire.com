/* ------------------------------------------------------------------ *
 * World
 * The grid: tiles, floor, rooms, walls, doors and traps. This
 * module owns every rule about what a cell is and what can happen to
 * it. Nothing here knows about three.js or the DOM.
 * ------------------------------------------------------------------ */

import { T, diggableTile, walkableTile } from './tiles.js';

const WALL_BASE_HP = 160;
const DOOR_BASE_HP = 130;
const GOLD_PER_SEAM = 130;
const GOLD_PER_MINE = 10;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class World {
  constructor(level, content) {
    this.level = level;
    this.content = content;
    const map = level.mapData;
    this.w = map.w;
    this.h = map.h;
    this.tiles = Uint8Array.from(map.tiles);
    // Claiming is gone: any legacy dug tile is already part of the dungeon.
    for (let index = 0; index < this.tiles.length; index += 1) {
      if (this.tiles[index] === T.DUG) this.tiles[index] = T.FLOOR;
    }
    this.rooms = new Array(this.w * this.h).fill(null);
    this.walls = new Map();
    this.traps = new Map();
    this.designations = new Map();
    this.heart = {
      x: map.heart.x,
      y: map.heart.y,
      hp: level.heartHealth ?? 800,
      maxHp: level.heartHealth ?? 800,
    };
    this.portal = { ...map.portal };
    this.gate = { ...map.gate };
    this.goldPerSeam = GOLD_PER_SEAM;
    this.wallHpBonus = 0;
    this.roomGroups = [];
    this.roomTotals = new Map();
    this.version = 0;
    this.rebuildRooms();
  }

  /* ------------------------------------------------------------ basics */

  idx(x, y) {
    return y * this.w + x;
  }

  xOf(index) {
    return index % this.w;
  }

  yOf(index) {
    return Math.floor(index / this.w);
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  tile(x, y) {
    return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T.BEDROCK;
  }

  setTile(x, y, tile) {
    if (!this.inBounds(x, y)) return;
    this.tiles[this.idx(x, y)] = tile;
    this.version += 1;
  }

  walkable(x, y) {
    return walkableTile(this.tile(x, y));
  }

  diggable(x, y) {
    return diggableTile(this.tile(x, y));
  }

  neighbours(x, y) {
    return NEIGHBOURS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((cell) =>
      this.inBounds(cell.x, cell.y)
    );
  }

  /* -------------------------------------------------------- excavation */

  dig(index) {
    const x = this.xOf(index);
    const y = this.yOf(index);
    const tile = this.tiles[index];
    if (!diggableTile(tile)) return { ok: false };
    this.tiles[index] = T.FLOOR;
    this.walls.delete(index);
    this.designations.delete(index);
    this.version += 1;
    const gold = tile === T.GOLD ? GOLD_PER_SEAM : 0;
    return { ok: true, gold, x, y, wasGold: tile === T.GOLD };
  }

  /** Endless gold seams: mining pays out without changing the tile. */
  mineGold(index) {
    return this.tiles[index] === T.GOLD ? GOLD_PER_MINE : 0;
  }

  /* ------------------------------------------------------------- rooms */

  paintRoom(index, roomId) {
    if (this.tiles[index] !== T.FLOOR) return false;
    this.rooms[index] = roomId;
    this.version += 1;
    this.rebuildRooms();
    return true;
  }

  clearRoom(index) {
    if (!this.rooms[index]) return false;
    this.rooms[index] = null;
    this.version += 1;
    this.rebuildRooms();
    return true;
  }

  /** Flood-fill contiguous room tiles into groups with a centre. */
  rebuildRooms() {
    this.roomGroups = [];
    this.roomTotals = new Map();
    const seen = new Uint8Array(this.tiles.length);
    for (let index = 0; index < this.rooms.length; index += 1) {
      const roomId = this.rooms[index];
      if (!roomId) continue;
      this.roomTotals.set(roomId, (this.roomTotals.get(roomId) ?? 0) + 1);
      if (seen[index]) continue;
      const tiles = [];
      const queue = [index];
      seen[index] = 1;
      while (queue.length) {
        const current = queue.pop();
        tiles.push({ x: this.xOf(current), y: this.yOf(current) });
        const cx = this.xOf(current);
        const cy = this.yOf(current);
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!this.inBounds(nx, ny)) continue;
          const next = this.idx(nx, ny);
          if (seen[next] || this.rooms[next] !== roomId) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
      const cx = tiles.reduce((sum, cell) => sum + cell.x, 0) / tiles.length;
      const cy = tiles.reduce((sum, cell) => sum + cell.y, 0) / tiles.length;
      this.roomGroups.push({ type: roomId, tiles, cx, cy });
    }
  }

  roomTiles(roomId) {
    return this.roomTotals.get(roomId) ?? 0;
  }

  roomGroupsOf(roomId) {
    return this.roomGroups.filter((group) => group.type === roomId);
  }

  minTilesFor(roomId) {
    return this.content.roomById.get(roomId)?.minTiles ?? 4;
  }

  hasRoom(roomId, minTiles = null) {
    const needed = minTiles ?? this.minTilesFor(roomId);
    return this.roomTiles(roomId) >= needed;
  }

  /** Nearest usable tile in a room, for hungry or sleepy creatures. */
  nearestRoomTile(roomId, x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const group of this.roomGroups) {
      if (group.type !== roomId) continue;
      for (const cell of group.tiles) {
        const distance = Math.abs(cell.x - x) + Math.abs(cell.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cell;
        }
      }
    }
    return best;
  }

  roomCenter(roomId) {
    const groups = this.roomGroupsOf(roomId);
    if (!groups.length) return null;
    const biggest = groups.reduce((a, b) => (a.tiles.length >= b.tiles.length ? a : b));
    return { x: biggest.cx, y: biggest.cy };
  }

  randomTileInRoom(roomId, rng = Math.random) {
    const groups = this.roomGroupsOf(roomId);
    if (!groups.length) return null;
    const group = groups[Math.floor(rng() * groups.length)];
    return group.tiles[Math.floor(rng() * group.tiles.length)];
  }

  portalExists() {
    return (
      this.roomTiles('portal') >= this.minTilesFor('portal') ||
      (this.portal && this.walkable(this.portal.x, this.portal.y))
    );
  }

  /* ------------------------------------------------------ walls & traps */

  placeWall(index) {
    if (this.tiles[index] !== T.FLOOR) return false;
    this.tiles[index] = T.WALL;
    this.walls.set(index, WALL_BASE_HP + this.wallHpBonus);
    this.designations.delete(index);
    this.version += 1;
    this.rebuildRooms();
    return true;
  }

  placeDoor(index) {
    if (this.tiles[index] !== T.FLOOR) return false;
    this.tiles[index] = T.DOOR;
    this.walls.set(index, DOOR_BASE_HP);
    this.designations.delete(index);
    this.version += 1;
    return true;
  }

  wallHp(index) {
    return this.walls.get(index) ?? 0;
  }

  damageWall(index, amount) {
    const hp = this.walls.get(index);
    if (hp == null) return { destroyed: false };
    const left = hp - amount;
    if (left > 0) {
      this.walls.set(index, left);
      return { destroyed: false, left };
    }
    this.walls.delete(index);
    this.tiles[index] = T.FLOOR;
    this.designations.delete(index);
    this.version += 1;
    return { destroyed: true };
  }

  /** Relocate the hero gate to a clear floor tile. */
  moveGate(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const index = this.idx(x, y);
    if (this.tiles[index] !== T.FLOOR) return false;
    if (this.heart.x === x && this.heart.y === y) return false;
    if (this.portal.x === x && this.portal.y === y) return false;
    if (this.traps.has(index)) return false;
    if (this.walls.has(index)) return false;
    this.gate = { x, y };
    this.version += 1;
    return true;
  }

  placeTrap(index, trapId) {
    if (this.tiles[index] !== T.FLOOR) return false;
    this.traps.set(index, { type: trapId, cooldown: 0 });
    this.version += 1;
    return true;
  }

  removeTrap(index) {
    if (!this.traps.delete(index)) return false;
    this.version += 1;
    return true;
  }

  trapAt(index) {
    return this.traps.get(index) ?? null;
  }

  /** Called each tick by the simulation so traps can reuse their springs. */
  tickTraps(dt) {
    for (const trap of this.traps.values()) {
      if (trap.cooldown > 0) trap.cooldown = Math.max(0, trap.cooldown - dt);
    }
  }

  /* -------------------------------------------------------------- misc */

  randomWalkableNear(x, y, radius = 5, rng = Math.random) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const nx = Math.round(x + (rng() * 2 - 1) * radius);
      const ny = Math.round(y + (rng() * 2 - 1) * radius);
      if (this.walkable(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  nearestWalkable(x, y, radius = 8) {
    for (let r = 0; r <= radius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > r) continue;
          const nx = Math.round(x + dx);
          const ny = Math.round(y + dy);
          if (this.walkable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  heartTile() {
    return { x: this.heart.x, y: this.heart.y };
  }

  /* --------------------------------------------------------- save data */

  serialize() {
    return {
      tiles: Array.from(this.tiles),
      rooms: this.rooms.map((id) => id ?? ''),
      walls: Array.from(this.walls.entries()),
      traps: Array.from(this.traps.entries()),
      gate: { ...this.gate },
      heartHp: this.heart.hp,
      w: this.w,
      h: this.h,
    };
  }

  restore(data) {
    if (!data || data.w !== this.w || data.h !== this.h) return false;
    if (!Array.isArray(data.tiles) || data.tiles.length !== this.tiles.length) return false;
    this.tiles = Uint8Array.from(data.tiles);
    // Older saves may still contain legacy dug tiles; adopt them.
    for (let index = 0; index < this.tiles.length; index += 1) {
      if (this.tiles[index] === T.DUG) this.tiles[index] = T.FLOOR;
    }
    this.rooms = Array.from({ length: this.w * this.h }, (_, i) => data.rooms?.[i] || null);
    this.walls = new Map(data.walls ?? []);
    this.traps = new Map(data.traps ?? []);
    if (data.gate && Number.isFinite(data.gate.x) && Number.isFinite(data.gate.y)
      && data.gate.x >= 0 && data.gate.y >= 0 && data.gate.x < this.w && data.gate.y < this.h) {
      this.gate = { x: data.gate.x, y: data.gate.y };
    }
    this.heart.hp = Number.isFinite(data.heartHp)
      ? Math.max(1, Math.min(this.heart.maxHp, data.heartHp))
      : this.heart.hp;
    this.version += 1;
    this.rebuildRooms();
    return true;
  }
}
