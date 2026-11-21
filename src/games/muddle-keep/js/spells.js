/* ------------------------------------------------------------------ *
 * Keeper spells
 * Four little bits of mischief paid for with mana: Zoomies, Soup of
 * Health, Rally Yell and Zap. Cooldowns are tracked per spell.
 * ------------------------------------------------------------------ */

export class SpellBook {
  constructor(game) {
    this.game = game;
    this.cooldowns = new Map();
  }

  def(id) {
    return this.game.content.spellById.get(id) ?? null;
  }

  isUnlocked(id) {
    const def = this.def(id);
    if (!def) return false;
    return this.game.economy.spells.has(id);
  }

  cooldownLeft(id) {
    return this.cooldowns.get(id) ?? 0;
  }

  update(dt) {
    for (const [id, left] of this.cooldowns) {
      if (left - dt <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, left - dt);
    }
  }

  cast(id, x, y) {
    const game = this.game;
    const def = this.def(id);
    if (!def) return { ok: false, reason: 'unknown' };
    if (!this.isUnlocked(id)) return { ok: false, reason: 'locked' };
    if (this.cooldownLeft(id) > 0) return { ok: false, reason: 'cooldown' };
    if (game.economy.mana < def.cost) return { ok: false, reason: 'mana' };

    game.economy.mana -= def.cost;
    this.cooldowns.set(id, def.cooldown);
    game.stats.spells += 1;
    game.emit('spell', { id, x, y, name: def.name });

    if (id === 'haste') {
      game.creatures.forEachNear(x, y, def.radius, (creature) => {
        creature.haste = 9;
        creature.mood = Math.min(100, creature.mood + 2);
        game.emit('haste', { x: creature.x, y: creature.y });
      });
    } else if (id === 'heal') {
      game.creatures.forEachNear(x, y, def.radius, (creature) => {
        game.creatures.heal(creature, creature.maxHp * 0.4);
        game.emit('heal', { x: creature.x, y: creature.y });
      });
    } else if (id === 'rally') {
      for (const creature of game.creatures.list) {
        if (creature.dead || creature.left) continue;
        creature.rally = 7;
        creature.path = null;
        creature.destination = null;
        creature.repath = 0;
        if (creature.state !== 'carried') creature.state = 'idle';
      }
      game.emit('rally', { x, y });
    } else if (id === 'zap') {
      game.heroes.zap(x, y, def.radius, 65);
      game.emit('zap', { x, y, radius: def.radius });
      for (const hero of game.heroes.list) {
        if (!hero.dead && Math.hypot(hero.x - (x + 0.5), hero.y - (y + 0.5)) <= def.radius) {
          game.emit('lightning', {
            x1: x + 0.5,
            y1: y + 0.5,
            x2: hero.x,
            y2: hero.y,
          });
        }
      }
    }

    return { ok: true };
  }
}
