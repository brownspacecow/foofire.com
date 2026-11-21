/* ------------------------------------------------------------------ *
 * Game
 * One endless run: the world, economy, imps, creatures, invaders and
 * spells stitched together. Player actions (tools) live here too so
 * the UI and input never poke at subsystems directly.
 * ------------------------------------------------------------------ */

import { World } from './world.js';
import { Economy } from './economy.js';
import { TaskQueue, ImpManager } from './tasks.js';
import { CreatureManager } from './creatures.js';
import { HeroManager } from './heroes.js';
import { SpellBook } from './spells.js';
import { T } from './tiles.js';
import { hasLineOfSight } from './path.js';
import { knockBack } from './movement.js';

const WALL_COST = 4;
const TRAP_REFUND = 0.5;
const SLAP_RADIUS = 2.4;
const SLAP_BOOST_TIME = 6;
const SLAP_KNOCKBACK = 0.8;

export class Game {
  constructor(content, level, profile = null) {
    this.content = content;
    this.level = level;
    this.profile = profile;
    this.world = new World(level, content);
    this.economy = new Economy(level, content);
    this.tasks = new TaskQueue(this.world);
    this.imps = new ImpManager(this);
    this.creatures = new CreatureManager(this);
    this.heroes = new HeroManager(this);
    this.spells = new SpellBook(this);
    this.time = 0;
    this.status = 'playing';
    this.timeStopped = false;
    this.tool = { type: 'dig' };
    this.handCreature = null;
    this.handGate = false;
    this.carriedTile = null;
    this.events = [];
    this.readyRooms = new Set();
    this.cameraFocus = { x: this.world.heart.x, y: this.world.heart.y };
    this.stats = { dug: 0, mined: 0, heroes: 0, spells: 0, built: 0 };
    this.spawnStartingCast();
  }

  spawnStartingCast() {
    const world = this.world;
    const heart = world.heart;
    const imps = Math.max(1, this.level.imps ?? 3);
    for (let index = 0; index < imps; index += 1) {
      const spot =
        world.nearestWalkable(heart.x + (index % 3) - 1, heart.y + 1 + Math.floor(index / 3), 7) ??
        heart;
      this.imps.addImp(spot.x, spot.y);
    }
    let slot = 0;
    for (const group of this.level.startCreatures ?? []) {
      for (let index = 0; index < (group.count ?? 0); index += 1) {
        const spot =
          world.nearestWalkable(
            heart.x + 1 + (slot % 3),
            heart.y + 1 + Math.floor(slot / 3),
            8
          ) ?? heart;
        this.creatures.spawn(group.type, spot.x, spot.y);
        slot += 1;
      }
    }
  }

  /* ------------------------------------------------------------- events */

  emit(type, data = {}) {
    this.events.push({ type, ...data, at: this.time });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  /* --------------------------------------------------------------- loop */

  update(dt) {
    if (this.status !== 'playing') return;
    // Planning still works while the clock is stopped: jobs re-evaluate and
    // rooms can become ready, but nothing moves, spends or counts down.
    this.tasks.prune();
    this.tasks.refresh();
    this.checkRooms();
    if (this.timeStopped) return;
    this.time += dt;
    this.world.tickTraps(dt);
    this.economy.update(dt, this);
    this.imps.update(dt);
    this.creatures.update(dt);
    this.heroes.update(dt);
    this.updateTraps();
    this.spells.update(dt);
  }

  checkRooms() {
    for (const room of this.content.rooms) {
      if (this.readyRooms.has(room.id)) continue;
      if (this.world.hasRoom(room.id)) {
        this.readyRooms.add(room.id);
        this.emit('room-ready', { id: room.id, name: room.name, icon: room.icon });
      }
    }
  }

  updateTraps() {
    const world = this.world;
    for (const [index, trap] of world.traps) {
      if (trap.cooldown > 0) continue;
      const def = this.content.trapById.get(trap.type);
      if (!def || def.kind === 'door') continue;
      const tx = world.xOf(index);
      const ty = world.yOf(index);
      let victim = null;
      if (def.kind === 'step') {
        victim = this.heroes.list.find(
          (hero) => !hero.dead && Math.floor(hero.x) === tx && Math.floor(hero.y) === ty
        );
      } else {
        victim = this.heroes.list.find(
          (hero) =>
            !hero.dead &&
            Math.hypot(hero.x - (tx + 0.5), hero.y - (ty + 0.5)) <= def.range &&
            hasLineOfSight(world, tx + 0.5, ty + 0.5, hero.x, hero.y)
        );
      }
      if (!victim) continue;
      trap.cooldown = def.cooldown;
      this.heroes.hurt(victim, def.damage, null);
      this.emit('trap', { x: tx, y: ty, type: def.id });
      if (def.kind === 'auto') {
        this.emit('attack', {
          fromX: tx + 0.5,
          fromY: ty + 0.5,
          toX: victim.x,
          toY: victim.y,
          kind: 'dart',
          friendly: true,
        });
      }
    }
  }

  lose(reason = 'heart') {
    if (this.status !== 'playing') return;
    this.status = 'lost';
    this.emit('lose', { reason });
  }

  /* -------------------------------------------------------------- tools */

  setTool(tool) {
    this.tool = tool;
    // NOTE: do not spread the tool object here — its own `type` field
    // ('dig', 'sell', ...) would overwrite the event's `type: 'tool'`
    // and fan out as a phantom dig/sell event.
    this.emit('tool', { tool: tool.type, id: tool.id });
  }

  setTimeStopped(stopped) {
    if (this.status !== 'playing') return false;
    const next = Boolean(stopped);
    if (this.timeStopped === next) return false;
    this.timeStopped = next;
    this.emit('time-stop', { stopped: next });
    return true;
  }

  error(text) {
    this.emit('error', { text });
    return { ok: false, message: text, emitted: true };
  }

  applyTool(x, y, options = {}) {
    if (this.status !== 'playing') return { ok: false };
    const world = this.world;
    if (!world.inBounds(x, y)) return { ok: false };
    const index = world.idx(x, y);
    const tool = this.tool;

    if (tool.type === 'dig') {
      const existing = this.tasks.tasks.get(index);
      if (options.digMode === 'remove') {
        if (!existing || (existing.kind !== 'dig' && existing.kind !== 'mine')) return { ok: false };
        this.tasks.remove(x, y);
        this.emit('undesignate', { x, y, kind: 'dig' });
        return { ok: true, removed: true };
      }
      if (existing?.kind === 'dig' || existing?.kind === 'mine') return { ok: true };
      if (!world.diggable(x, y)) return { ok: false, message: 'Only dirt and gold can be dug.' };
      const added = this.tasks.add(world.tile(x, y) === T.GOLD ? 'mine' : 'dig', x, y);
      if (added) this.emit('designate', { x, y, kind: 'dig' });
      return { ok: added };
    }

    if (tool.type === 'wall') {
      if (world.tile(x, y) !== T.FLOOR) return { ok: false, message: 'Walls need floor.' };
      if (world.rooms[index]) return { ok: false, message: 'That tile is part of a room.' };
      if (x === world.heart.x && y === world.heart.y) return { ok: false };
      if (!this.economy.spend(WALL_COST)) return this.error('Not enough gold for a wall.');
      const added = this.tasks.add('wall', x, y);
      if (!added) this.economy.addGold(WALL_COST, world);
      return { ok: added };
    }

    if (tool.type === 'room') {
      return this.paintRoom(x, y, tool.id);
    }

    if (tool.type === 'trap') {
      return this.buildTrap(x, y, tool.id);
    }

    if (tool.type === 'sell') {
      return this.sellTile(x, y);
    }

    if (tool.type === 'hand') {
      return this.handAction(x, y);
    }

    if (tool.type === 'slap') {
      return this.slapAt(x, y);
    }

    if (tool.type === 'spell') {
      return this.castAt(x, y, tool.id);
    }

    return { ok: false };
  }

  paintRoom(x, y, roomId) {
    const world = this.world;
    const index = world.idx(x, y);
    const def = this.content.roomById.get(roomId);
    if (!def) return { ok: false };
    if (!this.economy.rooms.has(roomId)) return this.error('That room is not available yet.');
    if (x === world.heart.x && y === world.heart.y) return this.error('Not on the Heart.');
    if (world.tile(x, y) !== T.FLOOR) {
      const tile = world.tile(x, y);
      if (tile === T.DIRT || tile === T.GOLD) {
        return this.error('That is solid dirt — dig it first, then paint.');
      }
      if (tile === T.BEDROCK) return this.error('That is solid rock — it cannot hold a room.');
      if (tile === T.WATER) return this.error('That is water — rooms need dry floor.');
      if (tile === T.LAVA) return this.error('That is lava — rooms need dry floor.');
      if (tile === T.WALL || tile === T.DOOR) {
        return this.error('There is a wall there — sell it first.');
      }
      return this.error('Rooms need floor.');
    }
    if (world.rooms[index] === roomId) return { ok: true };
    if (!this.economy.spend(def.cost)) return this.error(`The ${def.name} needs ${def.cost} gold a tile.`);
    world.paintRoom(index, roomId);
    this.stats.built += 1;
    this.emit('room', { x, y, id: roomId, name: def.name, icon: def.icon });
    const total = world.roomTotals.get(roomId) ?? 0;
    if (def.minTiles && total === 1) {
      this.emit('room-needs', {
        text: `${def.name} needs ${def.minTiles} tiles to work — keep painting.`,
      });
    }
    return { ok: true };
  }

  buildTrap(x, y, trapId) {
    const world = this.world;
    const index = world.idx(x, y);
    const def = this.content.trapById.get(trapId);
    if (!def) return { ok: false };
    if (!world.hasRoom('workshop')) return this.error('Build a Workshop first.');
    if (!this.economy.traps.has(trapId)) return this.error('That trap has not been researched.');
    if (world.tile(x, y) !== T.FLOOR) return this.error('Traps need floor.');
    if (world.trapAt(index) || world.tile(x, y) === T.DOOR) return this.error('There is already something there.');
    if (!this.economy.spend(def.cost)) return this.error(`That needs ${def.cost} gold.`);
    if (def.kind === 'door') world.placeDoor(index);
    else world.placeTrap(index, trapId);
    this.emit('trap-built', { x, y, id: trapId, name: def.name });
    return { ok: true };
  }

  sellTile(x, y) {
    const world = this.world;
    const index = world.idx(x, y);
    const room = world.rooms[index];
    if (room) {
      const def = this.content.roomById.get(room);
      world.clearRoom(index);
      const refund = this.economy.addGold(Math.floor((def?.cost ?? 0) / 2), world);
      this.emit('sell', { x, y, refund });
      return { ok: true };
    }
    const trap = world.trapAt(index);
    if (trap) {
      const def = this.content.trapById.get(trap.type);
      world.removeTrap(index);
      const refund = this.economy.addGold(Math.floor((def?.cost ?? 0) * TRAP_REFUND), world);
      this.emit('sell', { x, y, refund });
      return { ok: true };
    }
    const tile = world.tile(x, y);
    if (tile === T.WALL || tile === T.DOOR) {
      world.walls.delete(index);
      world.setTile(x, y, T.FLOOR);
      const refund = this.economy.addGold(2, world);
      this.emit('sell', { x, y, refund });
      return { ok: true };
    }
    const task = this.tasks.tasks.get(index);
    if (task) {
      this.tasks.remove(x, y);
      const refund = task.kind === 'wall' ? this.economy.addGold(WALL_COST, world) : 0;
      this.emit('sell', { x, y, refund });
      return { ok: true };
    }
    return { ok: false, message: 'Nothing to sell there.' };
  }

  handAction(x, y) {
    if (this.handCreature) {
      return this.dropCreature(x, y);
    }
    if (this.handGate) {
      return this.dropGate(x, y);
    }
    const creature = this.creatures.findAt(x + 0.5, y + 0.5, 0.95);
    if (creature) {
      this.handCreature = creature;
      creature.carried = true;
      creature.path = null;
      creature.state = 'carried';
      this.emit('pickup', { x: creature.x, y: creature.y, name: creature.def.name });
      return { ok: true };
    }
    if (x === this.world.gate.x && y === this.world.gate.y) {
      this.handGate = true;
      this.carriedTile = { x, y };
      this.emit('gate-pickup', { x, y });
      return { ok: true };
    }
    return { ok: false, message: 'Tap a creature or the Hero Gate to pick it up.' };
  }

  dropGate(x, y) {
    if (!this.handGate) return { ok: false };
    if (!this.world.moveGate(x, y)) return this.error('The gate needs a clear floor tile.');
    this.handGate = false;
    this.carriedTile = null;
    this.emit('gate-placed', { x, y });
    return { ok: true };
  }

  dropCreature(x, y) {
    const world = this.world;
    const creature = this.handCreature;
    if (!creature) return { ok: false };
    if (!world.walkable(x, y)) return this.error('Drop creatures on floor.');
    creature.x = x + 0.5;
    creature.y = y + 0.5;
    creature.carried = false;
    creature.state = 'idle';
    creature.path = null;
    creature.destination = null;
    creature.repath = 0;
    this.handCreature = null;
    this.handGate = false;
    this.carriedTile = null;
    this.emit('drop', { x: creature.x, y: creature.y });
    return { ok: true };
  }

  updateCarriedCreature(x, y) {
    if (this.handGate) {
      if (x != null) this.carriedTile = { x, y };
      return;
    }
    if (!this.handCreature || x == null) return;
    this.handCreature.x = x + 0.5;
    this.handCreature.y = y + 0.5;
  }

  slapAt(x, y) {
    let hit = 0;
    const slapX = x + 0.5;
    const slapY = y + 0.5;
    this.creatures.forEachNear(x, y, SLAP_RADIUS, (creature) => {
      if (creature.carried) return;
      creature.mood = Math.min(100, creature.mood + 10);
      creature.slapBoost = Math.max(creature.slapBoost, SLAP_BOOST_TIME);
      creature.slapHop = 1;
      knockBack(this.world, creature, slapX, slapY, SLAP_KNOCKBACK);
      creature.path = null;
      creature.destination = null;
      creature.repath = 0;
      hit += 1;
      this.emit('slap-hit', { x: creature.x, y: creature.y, name: creature.def.name });
    });
    if (this.imps.slap(x, y)) hit += 1;
    this.emit('slap', { x, y, hit });
    return { ok: true, hit };
  }

  castAt(x, y, spellId) {
    if (this.timeStopped) return this.error('Time is stopped — resume to cast spells.');
    const result = this.spells.cast(spellId, x, y);
    if (result.ok) return result;
    if (result.reason === 'mana') return this.error('Not enough mana.');
    if (result.reason === 'cooldown') return this.error('That spell is still fizzing.');
    if (result.reason === 'locked') return this.error('That spell is not unlocked.');
    return { ok: false };
  }

  /* ------------------------------------------------------------- saving */

  snapshot() {
    return {
      v: 2,
      levelId: this.level.id,
      time: this.time,
      status: this.status,
      world: this.world.serialize(),
      economy: this.economy.serialize(),
      creatures: this.creatures.serialize(),
      imps: this.imps.serialize(),
      heroes: this.heroes.serialize(),
      heroState: {
        waveIndex: this.heroes.waveIndex,
        nextWaveAt: this.heroes.nextWaveAt,
        label: this.heroes.label,
      },
      tasks: [...this.tasks.tasks.values()].map((task) => ({
        kind: task.kind,
        x: task.x,
        y: task.y,
      })),
      stats: { ...this.stats },
      readyRooms: [...this.readyRooms],
    };
  }

  restore(data) {
    if (!data) return false;
    if (!this.world.restore(data.world)) return false;
    this.economy.restore(data.economy);
    this.creatures.restore(data.creatures);
    this.imps.restore(data.imps);
    this.time = Number(data.time) || 0;
    this.heroes.restore(data.heroes, data.heroState ?? {});
    this.tasks.clear();
    for (const task of data.tasks ?? []) this.tasks.add(task.kind, task.x, task.y);
    this.stats = { ...this.stats, ...(data.stats ?? {}) };
    this.readyRooms = new Set(data.readyRooms ?? []);
    this.status = data.status === 'lost' ? 'lost' : 'playing';
    return true;
  }

  get waveIn() {
    return this.heroes.nextWaveIn();
  }
}
