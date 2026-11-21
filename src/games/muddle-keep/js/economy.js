/* ------------------------------------------------------------------ *
 * Economy
 * Gold, mana, mushrooms (food), research and wages. All rates are in
 * per-second units so the fixed-timestep simulation stays smooth.
 * ------------------------------------------------------------------ */

export class Economy {
  constructor(level, content) {
    this.level = level;
    this.content = content;
    this.gold = level.startGold ?? 250;
    this.mana = level.startMana ?? 60;
    this.maxMana = 120;
    this.food = 8;
    this.research = 0;
    this.researchTarget = null;
    this.unlocked = new Set();
    this.rooms = new Set(level.availableRooms ?? []);
    this.spells = new Set(level.availableSpells ?? []);
    this.traps = new Set(level.availableTraps ?? []);
    this.wageTimer = 60;
    this.loot = 0;
    this.pickNextResearch();
  }

  maxFood(world) {
    return Math.round(8 + world.roomTiles('hatchery') * 2.5);
  }

  capacity(world) {
    return 450 + world.roomTiles('treasury') * 250;
  }

  canAfford(amount) {
    return this.gold >= amount;
  }

  spend(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  /** Deposit gold, respecting treasury space. Returns how much was kept. */
  addGold(amount, world) {
    const room = Math.max(0, this.capacity(world) - this.gold);
    const kept = Math.max(0, Math.min(amount, room));
    this.gold += kept;
    return kept;
  }

  addMana(amount) {
    this.mana = Math.min(this.maxMana, this.mana + amount);
  }

  pickNextResearch() {
    this.researchTarget =
      this.content.research.find((entry) => !this.unlocked.has(entry.id)) ?? null;
  }

  researchSpellReady(id) {
    return this.spells.has(id);
  }

  isRoomAvailable(id) {
    return this.rooms.has(id);
  }

  isTrapAvailable(id) {
    return this.traps.has(id) && this.rooms.has('workshop');
  }

  update(dt, game) {
    const world = game.world;
    this.mana = Math.min(this.maxMana, this.mana + 0.9 * dt);

    const hatcheryTiles = world.roomTiles('hatchery');
    if (hatcheryTiles >= world.minTilesFor('hatchery')) {
      this.food = Math.min(this.maxFood(world), this.food + hatcheryTiles * 0.02 * dt);
    }

    const libraryTiles = world.roomTiles('library');
    if (libraryTiles >= world.minTilesFor('library') && this.researchTarget) {
      this.research += libraryTiles * 0.045 * dt;
      if (this.research >= this.researchTarget.cost) {
        this.research -= this.researchTarget.cost;
        this.completeResearch(this.researchTarget, game);
        this.pickNextResearch();
      }
    }

    this.wageTimer -= dt;
    if (this.wageTimer <= 0) {
      this.wageTimer += 60;
      this.payday(game);
    }
  }

  completeResearch(entry, game) {
    this.unlocked.add(entry.id);
    if (entry.id === 'zap') this.spells.add('zap');
    if (entry.id === 'door' || entry.id === 'dart') this.traps.add(entry.id);
    game.emit('research', { id: entry.id, name: entry.name });
  }

  payday(game) {
    const total = game.creatures.wageTotal();
    if (total <= 0) return;
    if (this.gold >= total) {
      this.gold -= total;
      game.creatures.adjustMood(3);
      game.emit('wages', { paid: total, ok: true });
    } else {
      const shortfall = total - this.gold;
      this.gold = 0;
      game.creatures.adjustMood(-14);
      game.emit('wages', { paid: 0, ok: false, shortfall });
    }
  }

  restore(data) {
    if (!data) return;
    this.gold = Number(data.gold) || 0;
    this.mana = Number(data.mana) || 0;
    this.food = Number(data.food) || 0;
    this.research = Number(data.research) || 0;
    this.wageTimer = Number(data.wageTimer) || 60;
    if (Array.isArray(data.spells)) data.spells.forEach((id) => this.spells.add(id));
    if (Array.isArray(data.traps)) data.traps.forEach((id) => this.traps.add(id));
    if (Array.isArray(data.rooms)) data.rooms.forEach((id) => this.rooms.add(id));
    if (Array.isArray(data.unlocked)) data.unlocked.forEach((id) => this.unlocked.add(id));
    this.pickNextResearch();
  }

  serialize() {
    return {
      gold: this.gold,
      mana: this.mana,
      food: this.food,
      research: this.research,
      wageTimer: this.wageTimer,
      spells: [...this.spells],
      traps: [...this.traps],
      rooms: [...this.rooms],
      unlocked: [...this.unlocked],
    };
  }
}
