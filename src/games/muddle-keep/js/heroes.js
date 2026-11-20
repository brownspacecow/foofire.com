/* ------------------------------------------------------------------ *
 * Invaders
 * Tidying knights arrive in waves at the hero gate, prefer to fight
 * creatures in their way, and otherwise march on the Dungeon Heart.
 * If the way is blocked they knock a hole in it.
 * ------------------------------------------------------------------ */

import { findPath, invaderCost, hasLineOfSight } from './path.js';
import { followPath, moveToward, tileDistance } from './movement.js';
import { T } from './tiles.js';

export class Hero {
  constructor(game, def, x, y) {
    this.game = game;
    this.def = def;
    this.x = x;
    this.y = y;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.path = null;
    this.pathIndex = 0;
    this.repath = Math.random() * 0.5;
    this.attackTimer = 0;
    this.target = null;
    this.targetTimer = Math.random() * 0.4;
    this.stun = 0;
    this.stompTimer = 6;
    this.facing = Math.PI;
    this.anim = Math.random() * Math.PI * 2;
    this.dead = false;
    this.hurtFlash = 0;
  }

  get ranged() {
    return Boolean(this.def.ranged);
  }
}

export class HeroManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.waveIndex = 0;
    this.allSpawned = (game.level.waves ?? []).length === 0;
    this.label = '';
    this.tileHp = new Map();
  }

  update(dt) {
    const game = this.game;
    const waves = game.level.waves ?? [];
    if (this.waveIndex < waves.length && game.time >= waves[this.waveIndex].at) {
      this.spawnWave(waves[this.waveIndex]);
      this.waveIndex += 1;
      if (this.waveIndex >= waves.length) this.allSpawned = true;
    }

    for (const hero of this.list) {
      if (hero.dead) continue;
      this.updateHero(hero, dt);
    }
    if (this.list.some((hero) => hero.dead)) {
      this.list = this.list.filter((hero) => !hero.dead);
    }

    if (this.allSpawned && this.list.length === 0 && game.status === 'playing' && game.time > 8) {
      game.win();
    }
  }

  spawnWave(wave) {
    const game = this.game;
    const world = game.world;
    const gate = world.gate;
    let total = 0;
    let slot = 0;
    for (const group of wave.spawn ?? []) {
      const def = game.content.heroById.get(group.type);
      if (!def) continue;
      for (let index = 0; index < group.count; index += 1) {
        const dx = (slot % 3) - 1;
        const dy = Math.floor(slot / 3) - 1;
        const spot =
          world.nearestWalkable(gate.x + dx, gate.y + dy, 7) ?? { x: gate.x, y: gate.y };
        this.list.push(new Hero(game, def, spot.x + 0.5, spot.y + 0.5));
        total += 1;
        slot += 1;
      }
    }
    this.label = wave.label ?? 'Intruders!';
    game.emit('wave', { label: this.label, count: total, index: this.waveIndex });
  }

  updateHero(hero, dt) {
    const game = this.game;
    const world = game.world;
    hero.anim += dt * 5;
    if (hero.hurtFlash > 0) hero.hurtFlash = Math.max(0, hero.hurtFlash - dt);
    if (hero.stun > 0) {
      hero.stun -= dt;
      return;
    }
    if (hero.attackTimer > 0) hero.attackTimer -= dt;
    if (hero.repath > 0) hero.repath -= dt;
    hero.targetTimer -= dt;

    if (hero.targetTimer <= 0) {
      hero.targetTimer = 0.5;
      hero.target = this.nearestCreature(hero);
    }
    if (hero.target && (hero.target.dead || hero.target.left)) hero.target = null;

    if (hero.def.boss) {
      hero.stompTimer -= dt;
      if (hero.stompTimer <= 0) {
        hero.stompTimer = 7;
        this.stomp(hero);
      }
    }

    if (hero.target) {
      const target = hero.target;
      const distance = Math.hypot(hero.x - target.x, hero.y - target.y);
      hero.facing = Math.atan2(target.x - hero.x, target.y - hero.y);
      const inRange = distance <= hero.def.range + 0.45;
      const clear = !hero.ranged || hasLineOfSight(world, hero.x, hero.y, target.x, target.y);
      if (inRange && clear) {
        this.hitCreature(hero, target);
        return;
      }
      if (distance < 6) {
        if (distance < 2.4 && hasLineOfSight(world, hero.x, hero.y, target.x, target.y)) {
          moveToward(hero, target.x, target.y, dt, hero.def.speed);
        } else {
          this.walkTo(hero, Math.floor(target.x), Math.floor(target.y), dt, 0.7);
        }
        return;
      }
      hero.target = null;
    }

    this.march(hero, dt);
  }

  nearestCreature(hero) {
    const radius = hero.ranged ? 5.6 : 4.4;
    let best = null;
    let bestDistance = radius;
    for (const creature of this.game.creatures.list) {
      if (creature.dead || creature.left || creature.carried) continue;
      const distance = Math.hypot(hero.x - creature.x, hero.y - creature.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = creature;
      }
    }
    return best;
  }

  walkTo(hero, tx, ty, dt, repathInterval) {
    const world = this.game.world;
    if (!world.walkable(tx, ty)) {
      hero.path = null;
      return 'nopath';
    }
    if (!hero.path) {
      if (hero.repath > 0) return 'wait';
      hero.path = findPath(world, Math.floor(hero.x), Math.floor(hero.y), tx, ty, {
        costAt: (x, y) => {
          const tile = world.tile(x, y);
          if (tile === T.DUG || tile === T.FLOOR) return 1;
          if (tile === T.DOOR || tile === T.DIRT || tile === T.GOLD) return 6;
          return Infinity;
        },
        maxNodes: 900,
      });
      hero.pathIndex = 0;
      hero.repath = repathInterval;
      if (!hero.path) return 'nopath';
    }
    const next = hero.path[hero.pathIndex];
    if (next) {
      const tile = world.tile(next.x, next.y);
      if (tile !== T.DUG && tile !== T.FLOOR) {
        this.attackBlocker(hero, next);
        return 'blocked';
      }
    }
    if (followPath(hero, dt, hero.def.speed)) {
      hero.path = null;
      return 'arrived';
    }
    return 'moving';
  }

  march(hero, dt) {
    const game = this.game;
    const world = game.world;
    const heart = world.heart;
    const distance = Math.hypot(hero.x - (heart.x + 0.5), hero.y - (heart.y + 0.5));
    hero.facing = Math.atan2(heart.x + 0.5 - hero.x, heart.y + 0.5 - hero.y);

    if (distance < 1.5) {
      this.hitHeart(hero);
      return;
    }

    if (!hero.path && hero.repath <= 0) {
      hero.path = findPath(world, Math.floor(hero.x), Math.floor(hero.y), heart.x, heart.y, {
        costAt: invaderCost(world),
        maxNodes: 1400,
      });
      hero.pathIndex = 0;
      hero.repath = 1.6;
    }

    if (hero.path) {
      const next = hero.path[hero.pathIndex];
      if (next) {
        const tile = world.tile(next.x, next.y);
        if (tile === T.WALL || tile === T.DOOR || tile === T.DIRT || tile === T.GOLD) {
          this.attackBlocker(hero, next);
          return;
        }
        if (followPath(hero, dt, hero.def.speed)) hero.path = null;
        return;
      }
      hero.path = null;
    }

    // No path at all: head straight at the nearest breakable wall.
    const centre = Math.floor(hero.x) + ',' + Math.floor(hero.y);
    const options = world.neighbours(Math.floor(hero.x), Math.floor(hero.y));
    const blocker = options.find((cell) => {
      const tile = world.tile(cell.x, cell.y);
      return tile === T.WALL || tile === T.DOOR || tile === T.DIRT || tile === T.GOLD;
    });
    if (blocker) this.attackBlocker(hero, blocker);
    else if (centre) moveToward(hero, heart.x + 0.5, heart.y + 0.5, dt, hero.def.speed * 0.6);
  }

  attackBlocker(hero, cell) {
    const game = this.game;
    const world = game.world;
    const index = world.idx(cell.x, cell.y);
    const tile = world.tile(cell.x, cell.y);

    if (hero.attackTimer > 0) return;
    hero.attackTimer = hero.def.interval;
    game.emit('hero-attack-tile', { x: cell.x, y: cell.y });

    if (tile === T.WALL || tile === T.DOOR) {
      const result = world.damageWall(index, hero.def.attack * 2.2);
      game.emit('wall-hit', { x: cell.x, y: cell.y });
      if (result.destroyed) {
        hero.path = null;
        hero.repath = 0;
        game.emit('wall-broken', { x: cell.x, y: cell.y });
      }
      return;
    }

    if (tile === T.DIRT || tile === T.GOLD) {
      let hp = this.tileHp.get(index) ?? 32;
      hp -= hero.def.attack * 2.2;
      if (hp <= 0) {
        this.tileHp.delete(index);
        world.dig(index);
        hero.path = null;
        hero.repath = 0;
        game.emit('hero-dug', { x: cell.x, y: cell.y });
      } else {
        this.tileHp.set(index, hp);
        game.emit('dirt-hit', { x: cell.x, y: cell.y });
      }
    }
  }

  hitHeart(hero) {
    if (hero.attackTimer > 0) return;
    hero.attackTimer = hero.def.interval;
    const game = this.game;
    game.world.heart.hp = Math.max(0, game.world.heart.hp - hero.def.attack);
    game.emit('heart-hit', { x: game.world.heart.x, y: game.world.heart.y });
    if (game.world.heart.hp <= 0) game.lose('heart');
  }

  hitCreature(hero, creature) {
    if (hero.attackTimer > 0) return;
    hero.attackTimer = hero.def.interval;
    this.game.emit('attack', {
      fromX: hero.x,
      fromY: hero.y,
      toX: creature.x,
      toY: creature.y,
      kind: hero.ranged ? 'arrow' : 'melee',
      friendly: false,
    });
    this.game.creatures.hurt(creature, hero.def.attack, hero);
  }

  stomp(hero) {
    const game = this.game;
    game.emit('stomp', { x: hero.x, y: hero.y });
    for (const creature of game.creatures.list) {
      if (creature.dead) continue;
      if (Math.hypot(creature.x - hero.x, creature.y - hero.y) < 2.8) {
        game.creatures.hurt(creature, hero.def.attack * 1.2, hero);
      }
    }
  }

  hurt(hero, amount, source) {
    if (hero.dead) return;
    const damage = Math.max(2, amount - (hero.def.defense ?? 0) * 0.7);
    hero.hp -= damage;
    hero.hurtFlash = 0.25;
    this.game.emit('hero-hit', { x: hero.x, y: hero.y, amount: damage });
    if (hero.hp <= 0) {
      hero.dead = true;
      hero.hp = 0;
      const bounty = hero.def.bounty ?? 10;
      const kept = this.game.economy.addGold(bounty, this.game.world);
      this.game.stats.heroes += 1;
      this.game.emit('hero-died', {
        x: hero.x,
        y: hero.y,
        name: hero.def.name,
        boss: Boolean(hero.def.boss),
        bounty: kept,
      });
    }
  }

  zap(x, y, radius, damage) {
    for (const hero of this.list) {
      if (hero.dead) continue;
      if (Math.hypot(hero.x - (x + 0.5), hero.y - (y + 0.5)) <= radius) {
        hero.stun = Math.max(hero.stun, 1.2);
        this.hurt(hero, damage, null);
      }
    }
  }

  serialize() {
    return this.list.map((hero) => ({
      type: hero.def.id,
      x: hero.x,
      y: hero.y,
      hp: hero.hp,
    }));
  }

  restore(list, state = {}) {
    if (!Array.isArray(list)) return;
    this.list = list
      .filter((entry) => this.game.content.heroById.has(entry.type))
      .map((entry) => {
        const def = this.game.content.heroById.get(entry.type);
        const hero = new Hero(this.game, def, entry.x, entry.y);
        hero.hp = Number.isFinite(entry.hp) ? entry.hp : hero.maxHp;
        return hero;
      });
    this.waveIndex = Math.max(0, Math.min(state.waveIndex ?? 0, (this.game.level.waves ?? []).length));
    this.allSpawned =
      state.allSpawned ?? this.waveIndex >= (this.game.level.waves ?? []).length;
    this.label = state.label ?? '';
  }

  nextWaveIn() {
    const waves = this.game.level.waves ?? [];
    if (this.waveIndex >= waves.length) return null;
    return Math.max(0, waves[this.waveIndex].at - this.game.time);
  }
}
