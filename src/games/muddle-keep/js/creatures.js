/* ------------------------------------------------------------------ *
 * Creatures
 * Autonomous minions with health, attack, defense and speed, plus
 * mood, hunger, sleep and training levels. The Keeper never steers
 * them directly; they decide what they need and go get it.
 * ------------------------------------------------------------------ */

import { findPath, floorCost, hasLineOfSight } from './path.js';
import { followPath, moveToward, tileDistance } from './movement.js';
import { seekRoom, wander, wantsTraining } from './needs.js';

// Monsters notice a hero this far away (tile distance) and head for the
// fight instead of wandering off to eat, sleep or train.
const AGGRO_RANGE = 12;

export class Creature {
  constructor(game, typeId, x, y, options = {}) {
    this.game = game;
    this.typeId = typeId;
    this.def = game.content.creatureById.get(typeId);
    if (!this.def) throw new Error(`Unknown creature type: ${typeId}`);
    this.id = 0;
    this.x = x + 0.5;
    this.y = y + 0.5;
    this.level = options.level ?? 1;
    this.maxHp = this.def.hp + (this.level - 1) * 18;
    this.hp = options.hp ?? this.maxHp;
    this.hunger = options.hunger ?? 8 + Math.random() * 18;
    this.energy = options.energy ?? 70 + Math.random() * 25;
    this.mood = options.mood ?? 78;
    this.state = 'idle';
    this.path = null;
    this.pathIndex = 0;
    this.destination = null;
    this.repath = Math.random() * 0.6;
    this.idleTime = Math.random() * 2;
    this.cooldown = 0;
    this.target = null;
    this.carried = false;
    this.haste = 0;
    this.slapBoost = 0;
    this.slapHop = 0;
    this.rally = 0;
    this.sleepTimer = 0;
    this.leaveTimer = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.anim = Math.random() * Math.PI * 2;
    this.xp = options.xp ?? 0;
    this.dead = false;
    this.left = false;
    this.hurtFlash = 0;
    this.workPulse = 0;
    this.trainTimer = 0;
  }

  get attackPower() {
    const levelBonus = 1 + (this.level - 1) * 0.14;
    const moodBonus = 0.85 + (this.mood / 100) * 0.3;
    return this.def.attack * levelBonus * moodBonus;
  }

  get speed() {
    return this.def.speed * (this.haste > 0 || this.slapBoost > 0 ? 2 : 1);
  }

  get workRate() {
    return this.slapBoost > 0 ? 1.5 : 1;
  }

  get xpNeeded() {
    return 16 + this.level * 12;
  }

  get ranged() {
    return this.def.range > 1.6;
  }
}

export class CreatureManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnTimer = 10;
    this.nextId = 1;
  }

  get count() {
    return this.list.length;
  }

  cap() {
    // Base 5 matches the five starters, so the HUD never reads over-cap.
    return 5 + Math.floor(this.game.world.roomTiles('lair') / 2);
  }

  spawn(typeId, x, y, options = {}) {
    const creature = new Creature(this.game, typeId, x, y, options);
    creature.id = this.nextId;
    this.nextId += 1;
    this.list.push(creature);
    return creature;
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 16;
      this.tryHeartSpawn();
    }
    for (const creature of this.list) {
      this.updateCreature(creature, dt);
    }
    if (this.list.some((creature) => creature.dead || creature.left)) {
      this.list = this.list.filter((creature) => !creature.dead && !creature.left);
    }
  }

  // New monsters burst out of the Dungeon Heart itself, on the open
  // floor ringing it — never through the portal.
  tryHeartSpawn() {
    const game = this.game;
    const world = game.world;
    if (this.list.length >= this.cap()) return;
    const eligible = game.content.creatures.filter((type) => {
      if (!type.needs) return true;
      return world.hasRoom(type.needs.room, type.needs.tiles);
    });
    if (!eligible.length) return;
    const total = eligible.reduce((sum, type) => sum + type.weight, 0);
    let roll = Math.random() * total;
    let chosen = eligible[0];
    for (const type of eligible) {
      roll -= type.weight;
      if (roll <= 0) {
        chosen = type;
        break;
      }
    }
    const dx = Math.floor(Math.random() * 3) - 1;
    const dy = Math.floor(Math.random() * 3) - 1;
    const spot =
      world.nearestWalkable(world.heart.x + dx, world.heart.y + dy, 7) ??
      world.heart;
    if (!spot) return;
    const creature = this.spawn(chosen.id, spot.x, spot.y);
    game.emit('spawn', {
      id: creature.typeId,
      x: creature.x,
      y: creature.y,
      name: chosen.name,
    });
  }

  updateCreature(creature, dt) {
    const game = this.game;
    const world = game.world;
    creature.anim += dt * 3;
    if (creature.hurtFlash > 0) creature.hurtFlash = Math.max(0, creature.hurtFlash - dt);
    if (creature.carried) return;

    if (creature.cooldown > 0) creature.cooldown -= dt;
    if (creature.haste > 0) creature.haste = Math.max(0, creature.haste - dt);
    if (creature.slapBoost > 0) creature.slapBoost = Math.max(0, creature.slapBoost - dt);
    if (creature.slapHop > 0) creature.slapHop = Math.max(0, creature.slapHop - dt / 0.32);
    if (creature.rally > 0) creature.rally = Math.max(0, creature.rally - dt);
    if (creature.repath > 0) creature.repath -= dt;
    if (creature.workPulse > 0) creature.workPulse -= dt;
    if (creature.trainTimer > 0) creature.trainTimer = Math.max(0, creature.trainTimer - dt);

    creature.hunger = Math.min(100, creature.hunger + 0.75 * dt);
    creature.energy = Math.max(0, creature.energy - 0.5 * dt);

    let moodTarget = 72;
    if (creature.hunger > 75) moodTarget -= 22;
    if (creature.energy < 20) moodTarget -= 18;
    if (world.roomTiles('lair') < world.minTilesFor('lair')) moodTarget -= 8;
    creature.mood += (moodTarget - creature.mood) * 0.06 * dt;
    creature.mood = Math.max(0, Math.min(100, creature.mood));

    if (creature.mood < 12) {
      creature.leaveTimer += dt;
      if (creature.leaveTimer > 22) {
        creature.left = true;
        game.emit('creature-left', { name: creature.def.name, x: creature.x, y: creature.y });
        return;
      }
    } else {
      creature.leaveTimer = 0;
    }

    const hero = this.nearestHero(creature);
    if (hero) {
      creature.target = hero;
      this.fight(creature, hero, dt);
      return;
    }
    creature.target = null;

    if (creature.state === 'eat' && creature.hunger < 4) creature.state = 'idle';
    if (creature.state === 'sleep' && creature.energy > 99) creature.state = 'idle';

    if (creature.hunger > 65) {
      seekRoom(this, creature, 'hatchery', 'eat', dt);
      return;
    }
    if (creature.energy < 28) {
      seekRoom(this, creature, 'lair', 'sleep', dt);
      return;
    }
    if (wantsTraining(this, creature)) {
      seekRoom(this, creature, 'training', 'train', dt);
      return;
    }
    wander(this, creature, dt);
  }

  nearestHero(creature) {
    const game = this.game;
    let best = null;
    let bestDistance = creature.rally > 0 ? 60 : AGGRO_RANGE;
    for (const hero of game.heroes.list) {
      if (hero.dead) continue;
      const distance = tileDistance(creature, Math.floor(hero.x), Math.floor(hero.y));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = hero;
      }
    }
    return best;
  }

  fight(creature, hero, dt) {
    const game = this.game;
    const distance = Math.hypot(creature.x - hero.x, creature.y - hero.y);
    creature.facing = Math.atan2(hero.x - creature.x, hero.y - creature.y);
    if (distance <= creature.def.range + 0.45 && this.canReach(creature, hero)) {
      if (creature.cooldown > 0) return;
      creature.cooldown = creature.def.interval / creature.workRate;
      const kind =
        creature.def.role === 'Caster' ? 'magic' : creature.def.range > 2 ? 'spit' : 'melee';
      game.emit('attack', {
        fromX: creature.x,
        fromY: creature.y,
        toX: hero.x,
        toY: hero.y,
        kind,
        friendly: true,
      });
      game.heroes.hurt(hero, creature.attackPower, creature);
      return;
    }
    if (distance < 3 && hasLineOfSight(game.world, creature.x, creature.y, hero.x, hero.y)) {
      moveToward(creature, hero.x, hero.y, dt, creature.speed);
      return;
    }
    this.walkTo(creature, Math.floor(hero.x), Math.floor(hero.y), dt, 0.8, creature.speed);
  }

  canReach(creature, hero) {
    // Melee included: without this a creature next to a wall corner
    // could hit a hero on the other side of the wall.
    return hasLineOfSight(this.game.world, creature.x, creature.y, hero.x, hero.y);
  }

  walkTo(creature, tx, ty, dt, repathInterval = 1.2, speed = creature.speed) {
    const world = this.game.world;
    if (!world.walkable(tx, ty)) return 'nopath';
    if (!creature.path) {
      if (creature.repath > 0) return 'wait';
      creature.path = findPath(world, Math.floor(creature.x), Math.floor(creature.y), tx, ty, {
        costAt: floorCost(world),
        maxNodes: 900,
      });
      creature.pathIndex = 0;
      creature.repath = repathInterval;
      if (!creature.path) return 'nopath';
    }
    if (followPath(creature, dt, speed)) {
      creature.path = null;
      return 'arrived';
    }
    return 'moving';
  }

  hurt(creature, amount, source) {
    if (creature.dead) return;
    const defense = creature.def.defense ?? 0;
    const damage = Math.max(2, amount - defense * 0.6);
    creature.hp -= damage;
    creature.hurtFlash = 0.3;
    creature.mood = Math.max(0, creature.mood - 0.6);
    this.game.emit('creature-hit', { x: creature.x, y: creature.y, amount: damage });
    if (creature.hp <= 0) {
      creature.dead = true;
      creature.hp = 0;
      this.game.emit('creature-died', {
        x: creature.x,
        y: creature.y,
        name: creature.def.name,
      });
    }
  }

  heal(creature, amount) {
    creature.hp = Math.min(creature.maxHp, creature.hp + amount);
    creature.mood = Math.min(100, creature.mood + 2);
  }

  findAt(x, y, radius = 0.9) {
    let best = null;
    let bestDistance = radius;
    for (const creature of this.list) {
      if (creature.dead || creature.left) continue;
      const distance = Math.hypot(creature.x - x, creature.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = creature;
      }
    }
    return best;
  }

  findNearest(x, y, maxDistance = 99) {
    let best = null;
    let bestDistance = maxDistance;
    for (const creature of this.list) {
      if (creature.dead || creature.left || creature.carried) continue;
      const distance = Math.hypot(creature.x - x, creature.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = creature;
      }
    }
    return best;
  }

  forEachNear(x, y, radius, callback) {
    for (const creature of this.list) {
      if (creature.dead || creature.left) continue;
      if (Math.hypot(creature.x - (x + 0.5), creature.y - (y + 0.5)) <= radius) {
        callback(creature);
      }
    }
  }

  adjustMood(amount) {
    for (const creature of this.list) {
      creature.mood = Math.max(0, Math.min(100, creature.mood + amount));
    }
  }

  wageTotal() {
    return this.list.reduce((sum, creature) => sum + creature.def.wage, 0);
  }

  moods() {
    if (!this.list.length) return 0;
    return this.list.reduce((sum, creature) => sum + creature.mood, 0) / this.list.length;
  }

  serialize() {
    return this.list.map((creature) => ({
      type: creature.typeId,
      x: creature.x,
      y: creature.y,
      hp: creature.hp,
      level: creature.level,
      xp: creature.xp,
      hunger: creature.hunger,
      energy: creature.energy,
      mood: creature.mood,
    }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    this.list = [];
    for (const entry of list) {
      if (!this.game.content.creatureById.has(entry.type)) continue;
      const creature = new Creature(this.game, entry.type, entry.x - 0.5, entry.y - 0.5, entry);
      creature.id = this.nextId;
      this.nextId += 1;
      this.list.push(creature);
    }
  }
}
