// Crypt Crawl — a kid-friendly puzzle dungeon crawler.
// Original game for Foofire Games. No external assets, no build step.
// Pure game-logic helpers are exported so they can be unit-checked in node;
// the DOM game only boots when `document` exists.

import { spriteSVG } from './sprites.js';
import { createChiptune } from './chiptune.js';

export const GRID = 6;
export const BEST_KEY = 'foofire-crypt-crawl-best';
export const BEST_GOLD_KEY = 'foofire-crypt-crawl-best-gold';

export const TILE_TYPES = ['sword', 'shield', 'potion', 'coin'];
export const TILE_SPRITE = { sword: 'tile-sword', shield: 'tile-shield', potion: 'tile-potion', coin: 'tile-coin' };
export const TILE_LABEL = { sword: 'Sword', shield: 'Shield', potion: 'Potion', coin: 'Coin' };

export const HEROES = [
  { id: 'pip', name: 'Pip the Penguin', sprite: 'hero-penguin', kind: 'Penguin • Waddler', perk: 'Potions heal +1 extra', desc: 'A brave little penguin who waddled all the way from the South Pole to the crypt. Loves fish, naps, and potions — mostly potions.' },
  { id: 'bramble', name: 'Bramble the Knight', sprite: 'hero-bramble', kind: 'Knight • Shield-bearer', perk: 'Shields block +1 extra', desc: 'A very polite knight. Says "excuse me" before blocking a bite.' },
  { id: 'moss', name: 'Moss the Gardener', sprite: 'hero-moss', kind: 'Gardener • Tough as roots', perk: 'Starts with +10 max HP', desc: 'Grows courage like carrots. Slightly muddy, extremely hard to knock over.' },
  { id: 'wren', name: 'Wren the Scout', sprite: 'hero-wren', kind: 'Scout • Quick feet', perk: 'Swords deal +1 on paths of 5+', desc: 'Small, speedy and impossible to catch. Long sword-paths are her favourite trick.' },
  { id: 'biscuit', name: 'Biscuit the Cook', sprite: 'hero-biscuit', kind: 'Cook • Snack-powered', perk: 'Coins heal 1 HP per 4 matched', desc: 'Believes every problem is a snack problem. Carries a frying pan and a plan.' },
  { id: 'nettle', name: 'Nettle the Wizard', sprite: 'hero-nettle', kind: 'Wizard • First-spell fan', perk: 'First match each floor deals +3', desc: 'A young wizard whose first spell of the day always goes a bit BANG.' },
  { id: 'joel', name: 'Joel', sprite: 'hero-joel', kind: 'Kid • Mohawk charger', perk: 'Swords deal +1 damage', desc: 'A brave 7-year-old with a mighty mohawk and a grin missing its front teeth. Charges into the crypt headfirst — usually yelling.' },
  { id: 'mom', name: 'Mom', sprite: 'hero-mom', kind: 'Mom • Sneaky', perk: 'Connect diagonal tiles', desc: 'Sneaky as they come. Mom slips diagonally through the crypt, taking shortcuts no one else can see.' },
  { id: 'dad', name: 'Dad', sprite: 'hero-dad', kind: 'Dad • Cheater', perk: 'Once per chain, jump across one unrelated tile', desc: 'A loveable cheat. Once per chain, Dad hops clean over a tile that doesn\'t match to keep the chain going.' },
];

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', note: 'Gentle monsters', hp: 30, attackMod: -1 },
  normal: { id: 'normal', name: 'Normal', note: 'The crypt as it was meant to be', hp: 25, attackMod: 0 },
  hard: { id: 'hard', name: 'Hard', note: 'Spiky monsters', hp: 20, attackMod: 1 },
};

export const RELICS = [
  { id: 'sharp-sword', name: 'Sharp Sword', sprite: 'tile-sword', desc: '+1 sword damage' },
  { id: 'sturdy-shield', name: 'Sturdy Shield', sprite: 'tile-shield', desc: '+1 block from shields' },
  { id: 'lucky-coin', name: 'Lucky Coin', sprite: 'tile-coin', desc: '+1 gold per coin tile' },
  { id: 'hearty-stew', name: 'Hearty Stew', sprite: 'relic-stew', desc: '+5 max HP and heal 5' },
  { id: 'soft-boots', name: 'Soft Boots', sprite: 'relic-boots', desc: 'Monster bites hurt 1 less' },
  { id: 'sweet-potion', name: 'Sweet Potion', sprite: 'tile-potion', desc: '+1 healing from potions' },
];

export const MONSTER_POOL = [
  { id: 'slime', name: 'Squeaky Slime', sprite: 'monster-slime' },
  { id: 'bat', name: 'Wobbly Bat', sprite: 'monster-bat' },
  { id: 'spider', name: 'Ticklish Spider', sprite: 'monster-spider' },
  { id: 'skeleton', name: 'Rattly Skeleton', sprite: 'monster-skeleton' },
  { id: 'mushroom', name: 'Grumpy Mushroom', sprite: 'monster-mushroom' },
  { id: 'ghost', name: 'Sneezy Ghost', sprite: 'monster-ghost' },
  { id: 'blob', name: 'Bouncy Blob', sprite: 'monster-blob' },
  { id: 'snake', name: 'Sleepy Snake', sprite: 'monster-snake' },
  { id: 'gremlin', name: 'Giggly Gremlin', sprite: 'monster-gremlin' },
  { id: 'duck', name: 'Dizzy Duck', sprite: 'monster-duck' },
  { id: 'chipmunk', name: 'Cheeky Chipmunk', sprite: 'monster-chipmunk' },
  { id: 'porcupine', name: 'Prickly Porcupine', sprite: 'monster-porcupine' },
  { id: 'jellyfish', name: 'Jumpy Jellyfish', sprite: 'monster-jellyfish' },
  { id: 'snail', name: 'Snoring Snail', sprite: 'monster-snail' },
  { id: 'worm', name: 'Wiggly Worm', sprite: 'monster-worm' },
  { id: 'gnome', name: 'Grumpy Gnome', sprite: 'monster-gnome' },
  { id: 'bee', name: 'Buzzy Bee', sprite: 'monster-bee' },
  { id: 'caterpillar', name: 'Cuddly Caterpillar', sprite: 'monster-caterpillar' },
  { id: 'frog', name: 'Hoppy Frog', sprite: 'monster-frog' },
  { id: 'mole', name: 'Moody Mole', sprite: 'monster-mole' },
  { id: 'squirrel', name: 'Sassy Squirrel', sprite: 'monster-squirrel' },
  { id: 'dormouse', name: 'Dozy Dormouse', sprite: 'monster-dormouse' },
  { id: 'crab', name: 'Crabby Crab', sprite: 'monster-crab' },
  { id: 'shadow', name: 'Shy Shadow', sprite: 'monster-shadow' },
];
export const BOSS_POOL = [
  { id: 'crumb', name: 'King Crumb the Cake Golem', sprite: 'boss-crumb' },
  { id: 'wobble', name: 'Queen Wobble the Jelly Giant', sprite: 'boss-wobble' },
  { id: 'snores', name: 'Sir Snores-a-Lot', sprite: 'boss-snores' },
  { id: 'pumpkin', name: 'The Great Grumbly Pumpkin', sprite: 'boss-pumpkin' },
];
// Boss floors draw from this deck — every boss except King Crumb, who
// appears ONLY as the fake final boss on floor 15, so the gag stays a
// surprise.
export const BOSS_DECK = BOSS_POOL.filter((b) => b.id !== 'crumb');

export function isBossFloor(floor) {
  return floor % 5 === 0;
}

/** Shuffle a list into a fresh deck (Fisher-Yates). Pure: the input is
 *  never mutated. `rand` is injectable so tests can use a seeded roll. */
export function shuffleDeck(items, rand = Math.random) {
  const deck = items.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Draw the next item from a deck. When the deck is empty (or missing),
 *  reshuffle the full pool into a fresh deck first, so a monster can
 *  only repeat after every other monster in the pool has appeared.
 *  Returns [item, remainingDeck]. Pure. */
export function drawFromDeck(deck, pool, rand = Math.random) {
  let d = deck && deck.length ? deck : shuffleDeck(pool, rand);
  const item = d[0];
  return [item, d.slice(1)];
}

/** Monster for a floor. HP/attack scale with floor; difficulty shifts attack.
 *  `pick` is the pool entry drawn from the run's deck (see spawnMonster);
 *  when omitted, the old deterministic cycle is used instead (kept for
 *  tests). Two floors are special:
 *  - Floor 15 is the FAKE final boss: King Crumb, with normal floor-15
 *    boss stats — the gag is in the presentation, not the numbers.
 *  - Floor 20 is the TRUE final boss: the Hollow King, with custom stats
 *    (HP 120, attack 6 + difficulty mod). He never repeats — floors 25+
 *    are normal bosses again. */
export function monsterForFloor(floor, difficultyId = 'normal', pick = null) {
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
  if (floor === 20) {
    return {
      name: 'The Hollow King, Lord of the Crypt',
      sprite: 'boss-hollow-king',
      hp: 120, maxHp: 120,
      attack: Math.max(1, 6 + diff.attackMod),
      isBoss: true, isTrueFinal: true,
    };
  }
  const boss = isBossFloor(floor);
  const entry = pick || (boss
    ? BOSS_POOL[Math.floor(floor / 5 - 1) % BOSS_POOL.length]
    : MONSTER_POOL[(floor - 1) % MONSTER_POOL.length]);
  if (floor === 15) {
    return {
      name: 'King Crumb, the FINAL Boss (definitely)',
      sprite: 'boss-crumb',
      hp: 12 + floor * 4, maxHp: 12 + floor * 4,
      attack: Math.max(1, 1 + Math.ceil(floor / 3) + diff.attackMod),
      isBoss: true, isFakeFinal: true,
    };
  }
  const hp = boss ? 12 + floor * 4 : 10 + floor * 5;
  const attack = boss
    ? Math.max(1, 1 + Math.ceil(floor / 3) + diff.attackMod)
    : Math.max(1, 1 + Math.ceil(floor / 2) + diff.attackMod);
  return { ...entry, hp, maxHp: hp, attack, isBoss: boss };
}

/** The Hollow King's rotating weakness: sword → shield → potion, each
 *  lasting two boss turns. Never coin. `turn` is the number of boss
 *  turns (player matches) completed so far. */
export const WEAKNESS_TYPES = ['sword', 'shield', 'potion'];
export function weaknessForTurn(turn) {
  return WEAKNESS_TYPES[Math.floor(turn / 2) % WEAKNESS_TYPES.length];
}

/** Turns until the crushing blow, counting the blow itself as 1: after
 *  0 turns it is 4 away, after 3 turns it is next. */
export function crushCountdown(turnsDone) {
  return 4 - (turnsDone % 4);
}

/** Is the boss attack about to happen (turn number `turnNo`, 1-based)
 *  a crushing blow? Every 4th boss turn, for 3x attack. */
export function isCrushingTurn(turnNo) {
  return turnNo % 4 === 0;
}

/** Low-health vignette state, from the HP fraction (max HP varies by
 *  hero — Moss has +10 — so the fraction, never a fixed HP number).
 *  Above 1/3 max HP: hidden. At or below 1/3: 'low', strength grows
 *  0 → 1 as HP falls to 0. At or below 1/6: 'crit', a stronger, faster
 *  pulse. `strength` is continuous across the low/crit boundary (0 at
 *  1/3, 0.5 at 1/6, 1 at 0 HP) so the vignette never jumps.
 *  Returns { visible, level: 'none' | 'low' | 'crit', strength }. */
export function lowHpState(hp, maxHp) {
  const frac = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  if (frac > 1 / 3) return { visible: false, level: 'none', strength: 0 };
  const strength = Math.min(1, (1 / 3 - frac) / (1 / 3));
  return { visible: true, level: frac <= 1 / 6 ? 'crit' : 'low', strength };
}

/** Count how many of a relic the run holds. */
export function relicCount(relics, id) {
  return relics.filter((r) => r === id).length;
}

/**
 * Effect of matching `len` tiles of `type`.
 * `heroId` applies the hero perk; `relics` is an array of relic ids;
 * `firstMatchThisFloor` applies Nettle's perk once per floor.
 * `swordBuff` is the shop's Sharp Sword: +5 damage on a sword match.
 * `weakType` is the Hollow King's current weakness (null for every other
 * monster): matches of that type have DOUBLE effect — double damage,
 * double block, or double healing. Coin is never a weakness.
 * Chain bonus: any match of 5+ tiles earns +1 gold per tile beyond 4,
 * whatever the tile type — long chains pay for the shop. It is reported
 * separately as `chainBonus` so the game can show it as its own float.
 * Returns { damage, block, heal, gold, chainBonus, score }.
 */
export function matchEffect(type, len, heroId, relics = [], firstMatchThisFloor = false, swordBuff = false, weakType = null) {
  const bonus = Math.max(0, len - 3);
  const chainBonus = Math.max(0, len - 4);
  const out = { damage: 0, block: 0, heal: 0, gold: 0, chainBonus, score: len * 10 };
  if (type === 'sword') {
    out.damage = 3 + bonus + relicCount(relics, 'sharp-sword');
    if (swordBuff) out.damage += 5;
    if (heroId === 'wren' && len >= 5) out.damage += 1;
    if (heroId === 'joel') out.damage += 1;
    if (heroId === 'nettle' && firstMatchThisFloor) out.damage += 3;
    if (weakType === 'sword') out.damage *= 2;
    out.score += out.damage * 5;
  } else if (type === 'shield') {
    out.block = 3 + bonus + relicCount(relics, 'sturdy-shield');
    if (heroId === 'bramble') out.block += 1;
    if (weakType === 'shield') out.block *= 2;
    out.score += out.block * 5;
  } else if (type === 'potion') {
    out.heal = 3 + bonus + relicCount(relics, 'sweet-potion');
    if (heroId === 'pip') out.heal += 1;
    if (weakType === 'potion') out.heal *= 2;
    out.score += out.heal * 5;
  } else if (type === 'coin') {
    out.gold = len + relicCount(relics, 'lucky-coin');
    if (heroId === 'biscuit') out.heal = Math.floor(len / 4);
    out.score += out.gold * 10;
  }
  // Chain bonus gold, on top of whatever the match already pays, for
  // every tile type — and it scores like other gold (+10 per gold).
  out.gold += chainBonus;
  out.score += chainBonus * 10;
  return out;
}

/** Damage the hero actually takes from a monster bite after block + boots. */
export function biteDamage(attack, block, relics = []) {
  return Math.max(0, attack - block - relicCount(relics, 'soft-boots'));
}

/**
 * Block left after a monster bite absorbs what it can. Block carries
 * over: only the absorbed amount is spent, never the whole bank.
 */
export function absorbBlock(block, attack) {
  return Math.max(0, block - attack);
}

const TILE_PLURAL = { sword: 'swords', shield: 'shields', potion: 'potions', coin: 'coins' };

/**
 * The persistent "Last turn" line: one short record of the turn that
 * just happened, built from the real numbers. `match` is
 * { type, len, fx, healed, weak } where `fx` is a matchEffect result,
 * `healed` is the HP actually gained (potions and Biscuit's coin snack
 * cap at full HP), and `weak` means the match hit the Hollow King's
 * current weakness. `bite` is null until the monster answers, or
 * { monsterName, attack, blocked, taken, crushing } — or
 * { slain: true, boss } when the match killed it. The chain-bonus
 * float vanishes in ~1s and never shows at all under reduced motion,
 * so this line is the only lasting record of what a turn did.
 */
export function lastTurnText(match, bite = null) {
  const { type, len, fx, healed = 0, weak = false } = match;
  const parts = [`${len} ${TILE_PLURAL[type]}`];
  if (type === 'sword') parts.push(`${fx.damage} damage`);
  if (type === 'shield') parts.push(`+${fx.block} block`);
  if (type === 'potion') parts.push(`+${healed} HP`);
  if (type === 'coin') {
    parts.push(fx.chainBonus > 0
      ? `+${fx.gold} gold (incl. +${fx.chainBonus} chain bonus)`
      : `+${fx.gold} gold`);
    if (fx.heal > 0) parts.push(`+${healed} HP`);
  } else if (fx.chainBonus > 0) {
    parts.push(`+${fx.chainBonus} gold chain bonus`);
  }
  if (weak) parts.push('weakness ×2');
  parts.push(`+${fx.score} pts`);
  let line = `Last turn: ${parts.join(' · ')}`;
  if (bite) {
    if (bite.slain) {
      line += bite.boss ? ' — BOSS SLAIN!' : ' — SLAIN!';
    } else if (bite.crushing) {
      line += bite.taken > 0
        ? ` — CRUSHING BLOW ${bite.attack}, blocked ${bite.blocked}, you take ${bite.taken}`
        : bite.blocked > 0
          ? ` — Crushing blow ${bite.attack}, blocked ${bite.blocked}`
          : ' — Crushing blow missed!';
    } else if (bite.taken > 0) {
      line += ` — ${bite.monsterName} bites ${bite.attack}, blocked ${bite.blocked}, you take ${bite.taken}`;
    } else if (bite.blocked > 0) {
      line += ` — ${bite.monsterName} bites ${bite.attack}, blocked ${bite.blocked}`;
    } else {
      line += ` — ${bite.monsterName} bites, missed!`;
    }
  }
  return line;
}

/**
 * The Crypt Shop — what gold buys between floors. Fixed stock, fixed
 * prices, so kids always know what things cost. Relics are NOT sold
 * here: they stay boss rewards only.
 */
export const SHOP_ITEMS = [
  { id: 'stew', name: 'Hearty Stew', sprite: 'relic-stew', desc: 'Heal 10 HP right now', price: 8 },
  { id: 'shield', name: 'Sturdy Shield', sprite: 'tile-shield', desc: '+10 block right now', price: 10 },
  { id: 'sword', name: 'Sharp Sword', sprite: 'tile-sword', desc: 'Your next sword match deals +5 damage', price: 12 },
];

/**
 * A shop player's spendable state: { gold, hp, maxHp, block, swordBuff }.
 * `shopBuy` is pure: it returns a new player object with the purchase
 * applied, or null when the purchase is refused (too little gold, stew
 * at full HP, or a sword buff already held). Gold never goes negative.
 */
export function shopBuy(itemId, p) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return null;
  if (p.gold < item.price) return null;
  if (itemId === 'stew' && p.hp >= p.maxHp) return null;
  if (itemId === 'sword' && p.swordBuff) return null;
  const next = { ...p, gold: p.gold - item.price };
  if (itemId === 'stew') next.hp = Math.min(p.maxHp, p.hp + 10);
  if (itemId === 'shield') next.block = p.block + 10;
  if (itemId === 'sword') next.swordBuff = true;
  return next;
}

/** Why an item cannot be bought right now, or null when it can. */
export function shopDisabledReason(itemId, p) {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return 'Not for sale';
  if (itemId === 'stew' && p.hp >= p.maxHp) return 'Full HP!';
  if (itemId === 'sword' && p.swordBuff) return 'Already sharp!';
  if (p.gold < item.price) return 'Not enough gold';
  return null;
}

/* ------------------------------------------------------------------ *
 * Achievements — 37 in total, built from HEROES / DIFFICULTIES /
 * RELICS so the list never drifts out of sync with the game:
 * 27 wins (9 heroes x 3 difficulties), 6 relic pick-ups, 1
 * collect-'em-all, 3 milestones. Unlocking is idempotent and
 * nothing is ever un-unlocked; progress persists across runs.
 * ------------------------------------------------------------------ */
export const ACHIEVEMENTS_KEY = 'foofire-crypt-crawl-achievements';

export function buildAchievements() {
  const list = [];
  for (const h of HEROES) {
    for (const d of Object.values(DIFFICULTIES)) {
      list.push({
        id: `win-${h.id}-${d.id}`,
        section: 'wins',
        name: `Crypt Conqueror: ${h.name} (${d.name})`,
        desc: `Beat the Hollow King as ${h.name} on ${d.name}.`,
      });
    }
  }
  for (const r of RELICS) {
    list.push({
      id: `relic-${r.id}`,
      section: 'relics',
      name: `Relic Hunter: ${r.name}`,
      desc: `Collect the ${r.name} relic.`,
      relicId: r.id,
    });
  }
  list.push({ id: 'relics-all', section: 'relics', name: 'Relic Master', desc: 'Collect all 6 relics.' });
  list.push({ id: 'first-boss', section: 'milestones', name: 'First Blood', desc: 'Beat your first boss — clear floor 5.' });
  list.push({ id: 'first-win', section: 'milestones', name: 'Crypt Conqueror', desc: 'Beat the Hollow King for the first time.' });
  list.push({ id: 'win-hard', section: 'milestones', name: 'Hardcore Delver', desc: 'Beat the Hollow King on Hard.' });
  return list;
}
export const ACHIEVEMENTS = buildAchievements();

/** Fresh achievement state: unlocked ids + every relic type collected
 *  at least once (across runs — that is what `relics-all` watches). */
export function emptyAchievementState() {
  return { v: 1, unlocked: [], relics: [] };
}

/** Load from a storage-like ({ getItem }). Tolerant of missing keys,
 *  corrupt JSON, and wrong shapes — anything unreadable loads as empty. */
export function loadAchievements(storage) {
  try {
    const raw = storage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return emptyAchievementState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyAchievementState();
    return {
      v: 1,
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked.filter((x) => typeof x === 'string') : [],
      relics: Array.isArray(parsed.relics) ? parsed.relics.filter((x) => typeof x === 'string') : [],
    };
  } catch (e) {
    return emptyAchievementState();
  }
}

export function saveAchievements(storage, data) {
  try {
    storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

/**
 * Record an event and return { state, fresh } — the new achievement
 * state plus the ids newly unlocked by this event (empty when nothing
 * new). Pure: works on a plain state object, no storage, no DOM.
 * Events: { type: 'win', heroId, difficultyId },
 * { type: 'relic', relicId }, { type: 'boss', floor }.
 */
export function recordAchievementEvent(prev, event) {
  const unlocked = new Set(prev.unlocked || []);
  const relics = new Set(prev.relics || []);
  const fresh = [];
  const add = (id) => {
    if (!unlocked.has(id)) { unlocked.add(id); fresh.push(id); }
  };
  if (event.type === 'win') {
    add(`win-${event.heroId}-${event.difficultyId}`);
    add('first-win');
    if (event.difficultyId === 'hard') add('win-hard');
  } else if (event.type === 'relic') {
    add(`relic-${event.relicId}`);
    relics.add(event.relicId);
    if (RELICS.every((r) => relics.has(r.id))) add('relics-all');
  } else if (event.type === 'boss') {
    if (event.floor === 5) add('first-boss');
  }
  return { state: { v: 1, unlocked: [...unlocked], relics: [...relics] }, fresh };
}

export function randomTile(rng = Math.random) {
  const r = rng();
  if (r < 0.3) return 'sword';
  if (r < 0.55) return 'shield';
  if (r < 0.8) return 'potion';
  return 'coin';
}

/**
 * Does this board have a possible move? A move is a drag path of 3+ tiles
 * of the same type. For most heroes the path is connected orthogonally
 * (this is a drag-match game, not a swap-match game), so: does any
 * orthogonally-connected component of one tile type have size >= 3?
 * Mom connects diagonally too, so her flood-fill runs 8-directional.
 * Dad may also use one jump over an unrelated tile per chain, so when
 * the orthogonal check finds nothing his paths are searched separately
 * (see hasDadJumpMove). Null/empty cells are not tiles.
 */
export function hasPossibleMove(board, heroId = null) {
  if (!board || !board.length || !board[0] || !board[0].length) return false;
  const rows = board.length;
  const cols = board[0].length;
  // Mom's paths run diagonally as well as orthogonally.
  const dirs = heroId === 'mom'
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const seen = board.map((row) => row.map(() => false));
  const stack = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = board[r][c];
      if (!type || seen[r][c]) continue;
      // Flood-fill this component; stop as soon as it reaches 3.
      let size = 0;
      stack.push([r, c]);
      seen[r][c] = true;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        size++;
        if (size >= 3) return true;
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (seen[nr][nc] || board[nr][nc] !== type) continue;
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
  }
  // Dad's one jump can open a move no orthogonal component has.
  if (heroId === 'dad') return hasDadJumpMove(board);
  return false;
}

/**
 * For Dad: is there a 3-tile path of one tile type using orthogonal
 * steps plus at most one jump over an unrelated tile? A depth-limited
 * DFS from every tile (paths longer than 3 are never needed — a move
 * only needs 3). Jump landings are the tiles one bridge away: straight
 * two steps, or diagonal via either corner tile (dadJumpBridge checks
 * the bridge is a real, unrelated tile).
 */
function hasDadJumpMove(board) {
  const rows = board.length;
  const cols = board[0].length;
  const inBounds = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const jumpOffsets = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function dfs(r, c, type, visited, jumpUsed) {
    if (visited.size >= 3) return true;
    for (const [dr, dc] of steps) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || board[nr][nc] !== type || visited.has(`${nr},${nc}`)) continue;
      visited.add(`${nr},${nc}`);
      if (dfs(nr, nc, type, visited, jumpUsed)) return true;
      visited.delete(`${nr},${nc}`);
    }
    if (!jumpUsed) {
      for (const [dr, dc] of jumpOffsets) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc) || board[nr][nc] !== type || visited.has(`${nr},${nc}`)) continue;
        if (!dadJumpBridge({ r, c }, { r: nr, c: nc }, board, type)) continue;
        visited.add(`${nr},${nc}`);
        if (dfs(nr, nc, type, visited, true)) return true;
        visited.delete(`${nr},${nc}`);
      }
    }
    return false;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = board[r][c];
      if (!type) continue;
      if (dfs(r, c, type, new Set([`${r},${c}`]), false)) return true;
    }
  }
  return false;
}

/**
 * Gravity + refill for a board with null holes (pure, unit-checked).
 * Kept tiles fall straight down, keeping their order; brand-new tiles
 * drop in from above the board. Returns { board, falls } where falls is
 * a same-size grid of how many rows each tile fell (0 = stayed put).
 * New tiles in a column all fall the same distance — the number of new
 * tiles in that column — so they slide down in lockstep like a column.
 */
export function refillBoardData(board, rng = Math.random) {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map((row) => row.slice());
  const falls = board.map((row) => row.map(() => 0));
  for (let c = 0; c < cols; c++) {
    const kept = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r][c] !== null && board[r][c] !== undefined) kept.push({ type: board[r][c], from: r });
    }
    const nNew = rows - kept.length;
    for (let r = rows - 1, i = 0; r >= 0; r--, i++) {
      if (i < kept.length) {
        next[r][c] = kept[i].type;
        falls[r][c] = r - kept[i].from;
      } else {
        next[r][c] = randomTile(rng);
        falls[r][c] = nNew;
      }
    }
  }
  return { board: next, falls };
}

/**
 * Does this drag path already use Dad's one jump? A jump is any
 * consecutive pair that is not orthogonally adjacent. Derived from the
 * path itself, so backtracking past the jump landing tile refunds the
 * jump automatically — no separate flag to drift out of sync.
 */
export function pathJumpUsed(path) {
  for (let i = 1; i < path.length; i++) {
    if (Math.abs(path[i].r - path[i - 1].r) + Math.abs(path[i].c - path[i - 1].c) !== 1) return true;
  }
  return false;
}

/**
 * For Dad: is there a single unrelated tile B bridging `last` to `pos`?
 * B must be orthogonally adjacent to both ends and a different type from
 * the path (a same-type tile is just a normal step, not a jump). The
 * bridge tile is jumped over, never added to the path.
 */
function dadJumpBridge(last, pos, board, type) {
  const rows = board.length;
  const cols = board[0].length;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const br = last.r + dr;
    const bc = last.c + dc;
    if (br < 0 || br >= rows || bc < 0 || bc >= cols) continue;
    if (Math.abs(br - pos.r) + Math.abs(bc - pos.c) !== 1) continue;
    if (board[br][bc] && board[br][bc] !== type) return { r: br, c: bc };
  }
  return null;
}

/**
 * Next drag path after the pointer lands on `pos`.
 * `path` is a list of same-type tiles, `board` the current tile grid,
 * `heroId` the hero being played (movement perks are hero-keyed).
 * Rules:
 * - Landing on a tile already in the path BACKTRACKS: every tile after
 *   that one is dropped, so the player can choose a different route
 *   from there. Landing on an earlier tile cuts the whole tail off in
 *   one move; landing on the current last tile changes nothing.
 * - Otherwise the tile is added only if it matches the path's type and
 *   is reachable from the current last tile. Reachable means:
 *   orthogonally adjacent (every hero); diagonally adjacent (Mom only
 *   — she sneaks diagonally); or one jump away for Dad — a matching
 *   tile with a single unrelated tile bridging it to the last tile,
 *   once per chain (a normal adjacent step never spends the jump).
 *   A different-type tile, or one that is not reachable, leaves the
 *   path alone.
 * A tile dropped by backtracking is free again at once, so it can be
 * re-added by dragging a new route from the truncated end. The path
 * type never changes. Returns the same array when nothing changes.
 */
export function updateDragPath(path, pos, board, heroId = null) {
  if (!path.length) return [pos];
  const type = board[path[0].r][path[0].c];
  if (board[pos.r][pos.c] !== type) return path;
  const idx = path.findIndex((p) => p.r === pos.r && p.c === pos.c);
  if (idx >= 0) {
    return idx === path.length - 1 ? path : path.slice(0, idx + 1);
  }
  const last = path[path.length - 1];
  const manhattan = Math.abs(last.r - pos.r) + Math.abs(last.c - pos.c);
  if (heroId === 'mom') {
    // Sneaky: diagonal steps count as adjacent.
    if (Math.max(Math.abs(last.r - pos.r), Math.abs(last.c - pos.c)) !== 1) return path;
  } else if (heroId === 'dad') {
    // Cheater: one jump across an unrelated tile per chain. An adjacent
    // step is free and never spends the jump.
    if (manhattan !== 1 && !( !pathJumpUsed(path) && dadJumpBridge(last, pos, board, type) )) return path;
  } else if (manhattan !== 1) {
    return path;
  }
  return [...path, pos];
}

export function randomName() {
  const names = ['Pip', 'Moss', 'Wren', 'Biscuit', 'Nettle', 'Bramble', 'Tilly', 'Finn', 'Poppy', 'Rowan', 'Juniper', 'Sage'];
  return names[Math.floor(Math.random() * names.length)];
}

/* ------------------------------------------------------------------ *
 * DOM game — only boots in a browser.
 * ------------------------------------------------------------------ */
if (typeof document !== 'undefined') {
  const $ = (sel) => document.querySelector(sel);

  // ---- NES chiptune engine: square / triangle / noise only ----
  // All sound (SFX + the looping dungeon tune) comes from chiptune.js.
  // No audio files, no sine/sawtooth. The mute button silences it all.
  let muted = false;
  try { muted = localStorage.getItem('foofireMuted.v1') === '1'; } catch (e) { /* ignore */ }
  const sfx = createChiptune();
  sfx.setMuted(muted);

  // ---- state ----
  const state = {
    screen: 'setup', heroId: 'pip', difficulty: 'normal', heroName: randomName(),
    hp: 25, maxHp: 25, block: 0, gold: 0, score: 0, floor: 1, kills: 0,
    monster: null, board: [], relics: [], firstMatchThisFloor: true, swordBuff: false,
    monsterDeck: [], bossDeck: [], // shuffled decks: no monster repeats until the deck runs out
    dragging: false, path: [], pathType: null, paused: false, over: false,
    settling: false, dying: false, best: 0, bestGold: 0,
    finalTurns: 0, // boss turns completed vs the Hollow King (weakness + crush clock)
    turnId: 0, // turn counter, so a late bite can't label the wrong turn
  };
  try {
    state.best = Number(localStorage.getItem(BEST_KEY) || 0);
    state.bestGold = Number(localStorage.getItem(BEST_GOLD_KEY) || 0);
  } catch (e) { /* ignore */ }

  // ---- last-turn record ----
  // The persistent line under the monster card. `turnMatch` is the
  // match record for the turn in flight; the bite (or the SLAIN!
  // ending) is appended to it when it lands. Only turn results ever
  // write this line — never status, tips, or banners.
  let turnMatch = null;
  let turnLine = 'Last turn: —';
  function renderLastTurn() { $('#last-turn').textContent = turnLine; }

  // ---- achievements (persist across runs) ----
  let achState = loadAchievements(localStorage);
  let achQueue = []; // achievement ids waiting for their celebration banner
  let achCelebrating = false;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- setup screen ----
  const heroGrid = $('#hero-grid');
  const detailEl = $('#hero-detail');
  function renderHeroes() {
    heroGrid.innerHTML = '';
    HEROES.forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-card' + (state.heroId === h.id ? ' selected' : '');
      b.setAttribute('aria-pressed', String(state.heroId === h.id));
      b.innerHTML = `<span class="hero-emoji" aria-hidden="true">${spriteSVG(h.sprite)}</span><span class="hero-name">${h.name}</span>`;
      b.addEventListener('click', () => { state.heroId = h.id; sfx.blip(); renderHeroes(); renderDetail(); });
      heroGrid.appendChild(b);
    });
  }
  function renderDetail() {
    const h = HEROES.find((x) => x.id === state.heroId);
    detailEl.innerHTML = `
      <span class="hero-emoji big" aria-hidden="true">${spriteSVG(h.sprite)}</span>
      <span class="detail-text"><strong>${h.name}</strong><span class="detail-kind">${h.kind}</span>
      <span class="detail-perk">Perk: ${h.perk}</span><span class="detail-desc">${h.desc}</span>
      <span class="detail-flavour">No flaw either — just a brave kid with a torch and a snack.</span></span>`;
  }
  function renderDifficulty() {
    document.querySelectorAll('[data-difficulty]').forEach((b) => {
      const on = b.dataset.difficulty === state.difficulty;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  document.querySelectorAll('[data-difficulty]').forEach((b) => {
    b.addEventListener('click', () => { state.difficulty = b.dataset.difficulty; sfx.blip(); renderDifficulty(); });
  });
  const nameInput = $('#hero-name');
  nameInput.value = state.heroName;
  nameInput.addEventListener('input', () => { state.heroName = nameInput.value.trim() || randomName(); });
  $('#relic-count').textContent = '0/50';
  renderHeroes(); renderDetail(); renderDifficulty(); renderAchievementsButton();

  // ---- board ----
  // Tile buttons are built ONCE per board and reused. The old code called
  // renderBoard() — which did boardEl.innerHTML = '' and rebuilt all 36
  // tile buttons — on every pointerdown AND every pointermove. Rebuilding
  // the DOM under the player's finger destroys the touch target mid-drag,
  // so mobile browsers fire pointercancel and the drag dies. That is the
  // bug Jordan hit. During a drag we now only toggle the `in-path` class
  // on the existing tiles; the DOM is rebuilt only when a new board is
  // dealt or tiles refill (never while dragging).
  const boardEl = $('#board');
  let tileEls = []; // 36 buttons, row-major order, built once per board
  let paintedTypes = []; // last type painted per tile, to avoid rework

  function tileIndex(r, c) { return r * GRID + c; }

  function buildBoard() {
    boardEl.innerHTML = '';
    tileEls = [];
    paintedTypes = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'tile tile-' + state.board[r][c];
        t.dataset.row = r; t.dataset.col = c;
        t.setAttribute('aria-label', `${TILE_LABEL[state.board[r][c]]} tile, row ${r + 1} column ${c + 1}`);
        t.innerHTML = spriteSVG(TILE_SPRITE[state.board[r][c]]);
        boardEl.appendChild(t);
        tileEls.push(t);
        paintedTypes.push(state.board[r][c]);
      }
    }
  }

  // Repaint changed tiles and mark the drag path. Never rebuilds the DOM.
  // `falls` is an optional same-size grid of how many rows each tile fell
  // (from refillBoardData / newBoard) — those tiles animate down into
  // place with the Web Animations API. Tiles are never rebuilt mid-drag
  // or mid-fall; only their classes, sprites and transforms change.
  function paintBoard(falls) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const i = tileIndex(r, c);
        const type = state.board[r][c];
        const t = tileEls[i];
        if (!t) continue;
        if (paintedTypes[i] !== type) {
          paintedTypes[i] = type;
          t.className = 'tile tile-' + type;
          t.innerHTML = spriteSVG(TILE_SPRITE[type]);
          t.setAttribute('aria-label', `${TILE_LABEL[type]} tile, row ${r + 1} column ${c + 1}`);
        }
        t.classList.toggle('in-path', state.path.some((p) => p.r === r && p.c === c));
      }
    }
    if (falls) animateFalls(falls);
  }

  // Tiles that fell slide down from where they were (or from above the
  // board for brand-new tiles). One tile-height step = tile height + the
  // grid gap, measured live so it is exact at any screen size. Staggered
  // a touch per column so the fall ripples across the board. Total is
  // ~230–430ms, so the turn still feels snappy. Skipped entirely when
  // the player prefers reduced motion.
  function animateFalls(falls) {
    if (reducedMotion || !tileEls.length) return;
    const first = tileEls[0];
    const gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    const step = first.offsetHeight + gap;
    if (!step) return;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const d = falls[r] && falls[r][c];
        if (!d) continue;
        const el = tileEls[tileIndex(r, c)];
        if (!el) continue;
        el.animate(
          [
            { transform: `translateY(${-d * step}px)` },
            { transform: 'translateY(0)' },
          ],
          {
            duration: 200 + d * 30,
            delay: c * 12,
            easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
            fill: 'backwards',
          },
        );
      }
    }
  }

  // A fresh board must always have a move — re-deal (silently) if it
  // somehow does not. Fresh tiles drop in from above the board.
  function newBoard() {
    let attempts = 0;
    do {
      state.board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => randomTile()));
      attempts++;
    } while (!hasPossibleMove(state.board, state.heroId) && attempts < 100);
    buildBoard();
    paintBoard(state.board.map((row, r) => row.map(() => r + 1)));
  }

  // Old name, kept for the floor-clear / start-run call sites.
  function renderBoard() { paintBoard(); }

  // Which tile is under a pointer? Hit-test first (exact, gap-aware),
  // grid maths second (so a finger drifting between tiles still tracks).
  function tileAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const tile = el && el.closest ? el.closest('.tile') : null;
    if (tile && boardEl.contains(tile)) {
      return { r: Number(tile.dataset.row), c: Number(tile.dataset.col) };
    }
    const rect = boardEl.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;
    return {
      r: Math.min(GRID - 1, Math.floor((clientY - rect.top) / (rect.height / GRID))),
      c: Math.min(GRID - 1, Math.floor((clientX - rect.left) / (rect.width / GRID))),
    };
  }
  function startDrag(pos) {
    if (state.paused || state.over || state.screen !== 'play' || state.settling || state.dying) return;
    state.dragging = true; state.pathType = state.board[pos.r][pos.c];
    state.path = [pos]; paintBoard();
  }
  function extendDrag(pos) {
    if (!state.dragging) return;
    const next = updateDragPath(state.path, pos, state.board, state.heroId);
    if (next === state.path) return;
    state.path = next;
    // Tick pitch follows path length, so it drops naturally on backtrack.
    sfx.tick(state.path.length);
    paintBoard();
  }
  function cancelDrag() {
    if (!state.dragging) return;
    state.dragging = false; state.path = []; state.pathType = null; paintBoard();
  }
  function endDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.path.length >= 3) resolveMatch();
    state.path = []; state.pathType = null; paintBoard();
  }
  boardEl.addEventListener('pointerdown', (e) => {
    const pos = tileAt(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* capture unavailable */ }
    startDrag(pos);
  });
  // Track on the window, not just the board: with pointer capture the
  // events retarget to the board, but a finger can drift off the board
  // and capture can be lost on some mobile browsers — window listeners
  // keep the drag alive either way.
  window.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    if (e.cancelable) e.preventDefault();
    const pos = tileAt(e.clientX, e.clientY);
    if (pos) extendDrag(pos);
  }, { passive: false });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', cancelDrag);
  boardEl.addEventListener('lostpointercapture', () => {
    // Capture lost mid-drag (interruption, or the old DOM-rebuild bug).
    // End the drag cleanly instead of leaving a stuck path.
    if (state.dragging) cancelDrag();
  });
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
  boardEl.addEventListener('dragstart', (e) => e.preventDefault());

  // ---- HUD / monster ----
  function updateHud() {
    $('#hud-floor').textContent = state.floor;
    $('#hud-hp').textContent = `${Math.max(0, state.hp)} / ${state.maxHp}`;
    $('#hp-fill').style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
    $('#hud-block').textContent = state.block;
    $('#hud-gold').textContent = state.gold;
    $('#hud-score').textContent = state.score;
    $('#hud-best').textContent = `Best floor ${state.best}`;
    $('#relics-row').innerHTML = (state.relics.length
      ? state.relics.map((id) => {
          const r = RELICS.find((x) => x.id === id);
          return `<span class="relic-chip" title="${r.name}: ${r.desc}">${spriteSVG(r.sprite)}<span>${r.name}</span></span>`;
        }).join('')
      : '<span class="relics-empty">No relics yet — beat a boss on floor 5!</span>')
      // The shop's Sharp Sword is a one-match buff, not a relic — show it
      // as a chip here so the player can see it is waiting to be used.
      + (state.swordBuff
        ? `<span class="relic-chip" title="Sharp Sword: your next sword match deals +5 damage">${spriteSVG('tile-sword')}<span>Sharp Sword +5</span></span>`
        : '');
    const m = state.monster;
    if (m) {
      $('#monster-emoji').innerHTML = spriteSVG(m.sprite);
      $('#monster-name').textContent = m.name + (m.isBoss ? ' — BOSS' : '');
      $('#monster-hp').textContent = `${Math.max(0, m.hp)} / ${m.maxHp}`;
      $('#monster-fill').style.width = `${Math.max(0, (m.hp / m.maxHp) * 100)}%`;
      $('#monster-card').classList.toggle('boss', m.isBoss);
    }
    // The Hollow King shows his rotating weakness and the crushing-blow
    // countdown right on the monster card, so the player can strategise.
    const weakEl = $('#monster-weak');
    const crushEl = $('#monster-crush');
    const card = $('#monster-card');
    if (m && m.isTrueFinal) {
      const weak = weaknessForTurn(state.finalTurns);
      weakEl.innerHTML = `Weak to: ${spriteSVG(TILE_SPRITE[weak])} ${TILE_LABEL[weak]}`;
      weakEl.hidden = false;
      const crushIn = crushCountdown(state.finalTurns);
      crushEl.textContent = crushIn === 1 ? 'CRUSHING BLOW NEXT!' : `Crushing blow in ${crushIn}`;
      crushEl.hidden = false;
      // The turn before the crush, the card pulses red as a warning.
      card.classList.toggle('crush-warning', crushIn === 1);
    } else {
      weakEl.hidden = true;
      crushEl.hidden = true;
      card.classList.remove('crush-warning');
    }
    updateLowHp();
  }

  // ---- low-health vignette ----
  // Red edges creep in as HP falls. Hidden on the setup screen, on
  // game over, and anywhere but a live run; updateHud calls this after
  // every match, bite, heal, and shop purchase, so it stays live.
  function updateLowHp() {
    const el = $('#low-hp-vignette');
    const s = (state.over || state.screen !== 'play')
      ? { visible: false, level: 'none', strength: 0 }
      : lowHpState(state.hp, state.maxHp);
    el.classList.toggle('low', s.level === 'low');
    el.classList.toggle('crit', s.level === 'crit');
    // Base opacity grows with strength so the edges deepen as HP falls;
    // the pulse animation throbs around that base (see the CSS).
    el.style.setProperty('--lowhp-opacity', s.visible ? String(0.45 + 0.55 * s.strength) : '0');
  }
  function floatText(text, kind, ms = 1100) {
    // 'slain' is the one float that must still show under reduced motion
    // (it sits still instead of floating up); every other float is motion.
    if (reducedMotion && kind !== 'slain') return;
    const el = document.createElement('span');
    el.className = 'float-text ' + kind;
    el.textContent = text;
    const area = $('#float-layer');
    el.style.left = kind === 'slain' ? '50%' : `${20 + Math.random() * 60}%`;
    area.appendChild(el);
    // A long float (the chain bonus) rises and fades over its whole life
    // instead of vanishing after the 1s animation — see .float-text.long.
    if (ms > 1100) el.classList.add('long');
    if (reducedMotion) el.style.animation = 'none';
    setTimeout(() => el.remove(), ms);
  }
  function banner(text) {
    const b = $('#banner');
    b.querySelector('span').textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 1600);
  }
  function setStatus(text) { $('#status').textContent = text; }

  // ---- achievements ----
  // Record an event, persist, and queue any fresh unlocks for their
  // celebration. The celebration itself only fires once the player is
  // back on the board (see showNextAchievement) — never over an
  // overlay, so a win celebration is never hidden behind the relic
  // picker or the shop.
  function awardAchievements(event) {
    const result = recordAchievementEvent(achState, event);
    if (!result.fresh.length) return;
    achState = result.state;
    saveAchievements(localStorage, achState);
    renderAchievementsButton();
    achQueue.push(...result.fresh);
  }

  function anyOverlayOpen() {
    return ['shop-modal', 'relic-modal', 'fakewin-overlay', 'victory-overlay', 'gameover-overlay', 'achievements-overlay']
      .some((id) => !document.getElementById(id).hidden);
  }

  // One celebration at a time, ~1.7s apart (the banner shows 1.6s).
  // Waits while any overlay is open; if the player leaves for the
  // setup screen, the queued celebrations are dropped — the unlocks
  // themselves are already saved and visible in the panel.
  function showNextAchievement() {
    if (achCelebrating || !achQueue.length) return;
    if (state.screen !== 'play') { achQueue = []; return; }
    if (anyOverlayOpen()) return;
    achCelebrating = true;
    const id = achQueue.shift();
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    banner(`🏆 Achievement unlocked: ${a ? a.name : id}!`);
    sfx.relic();
    setTimeout(() => { achCelebrating = false; showNextAchievement(); }, 1700);
  }

  function renderAchievementsButton() {
    const have = ACHIEVEMENTS.filter((a) => achState.unlocked.includes(a.id)).length;
    $('#achievements-button').textContent = `🏆 ACHIEVEMENTS (${have}/${ACHIEVEMENTS.length})`;
  }

  function renderAchievements() {
    const got = new Set(achState.unlocked);
    const have = ACHIEVEMENTS.filter((a) => got.has(a.id)).length;
    $('#achievements-progress').textContent = `${have} / ${ACHIEVEMENTS.length} achievements`;
    const diffs = Object.values(DIFFICULTIES);
    let html = '<h3>Victories — beat the Hollow King</h3><div class="ach-wins">';
    html += '<span></span>' + diffs.map((d) => `<span class="ach-head">${d.name}</span>`).join('');
    for (const h of HEROES) {
      html += `<span class="ach-hero">${h.name}</span>`;
      for (const d of diffs) {
        const won = got.has(`win-${h.id}-${d.id}`);
        html += `<span class="ach-cell${won ? ' won' : ''}">${won ? '✓' : '·'}</span>`;
      }
    }
    html += '</div>';
    html += '<h3>Relics — collect them all</h3><div class="ach-relics">';
    for (const r of RELICS) {
      const has = got.has(`relic-${r.id}`);
      html += `<span class="ach-relic${has ? ' got' : ''}">${has ? spriteSVG(r.sprite) : '<span class="ach-q">?</span>'}<span>${r.name}</span></span>`;
    }
    const master = got.has('relics-all');
    html += `<span class="ach-relic${master ? ' got' : ''}">${master ? '🏆' : '<span class="ach-q">?</span>'}<span>Relic Master</span></span>`;
    html += '</div>';
    html += '<h3>Milestones</h3>';
    for (const id of ['first-boss', 'first-win', 'win-hard']) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      const has = got.has(id);
      html += `<div class="ach-mile${has ? ' got' : ''}"><span><strong>${a.name}</strong><small>${a.desc}</small></span><span class="ach-state">${has ? '✓' : '·'}</span></div>`;
    }
    $('#achievements-list').innerHTML = html;
  }

  function showAchievements() {
    renderAchievements();
    $('#achievements-overlay').hidden = false;
    sfx.blip();
  }

  // Monsters are dealt from shuffled decks, not picked at random: a
  // monster can only repeat after every other monster in its pool has
  // appeared. Floors 15 and 20 are fixed (fake + true final boss) and
  // draw nothing. The decks live in state for the whole run — "Keep
  // delving" after the true victory keeps dealing from them.
  function spawnMonster() {
    let pick = null;
    if (state.floor !== 15 && state.floor !== 20) {
      if (isBossFloor(state.floor)) {
        const drawn = drawFromDeck(state.bossDeck, BOSS_DECK);
        state.bossDeck = drawn[1];
        pick = drawn[0];
      } else {
        const drawn = drawFromDeck(state.monsterDeck, MONSTER_POOL);
        state.monsterDeck = drawn[1];
        pick = drawn[0];
      }
    }
    state.monster = monsterForFloor(state.floor, state.difficulty, pick);
    state.firstMatchThisFloor = true;
    state.finalTurns = 0;
    const gameEl = $('#crypt-game');
    if (state.monster.isTrueFinal) {
      // The real final boss: the crypt goes dark and scary.
      gameEl.classList.add('final-boss');
      banner('Something ancient wakes below…');
      setStatus('The Hollow King, Lord of the Crypt, blocks the way. Watch his weakness — and mind the crushing blow!');
    } else {
      gameEl.classList.remove('final-boss');
      if (state.monster.isFakeFinal) {
        banner('You have reached the FINAL boss... or have you?');
        setStatus('King Crumb, the FINAL Boss (definitely), blocks the way. Definitely the last one. Probably.');
      }
    }
    if (state.monster.isBoss) sfx.boss();
    updateMusic();
    updateHud();
  }

  // Boss floors get the faster, tenser boss loop; the Hollow King gets
  // his own slow, scary loop; regular floors get the main dungeon tune.
  // startMusic restarts the sequencer only when the track actually
  // changes, so this is a no-op most floors. Only starts music while
  // actually playing — if paused, the unpause handler resumes whichever
  // track was selected.
  function updateMusic() {
    if (state.screen !== 'play' || state.paused || state.over) return;
    const track = !state.monster ? 'main'
      : state.monster.isTrueFinal ? 'final'
      : state.monster.isBoss ? 'boss' : 'main';
    sfx.startMusic(track);
  }

  // Gravity + refill, with per-cell fall distances for the drop
  // animation. Pure logic lives in refillBoardData (unit-checked in node).
  function refillBoard() {
    const result = refillBoardData(state.board);
    state.board = result.board;
    return result.falls;
  }

  // No moves left? Shuffle the whole board for free. No HP loss, no extra
  // monster bite for the shuffle itself — the player just sees the banner
  // and the tiles wobble into their new places. Guarantees the new board
  // has at least one possible move. Returns true when a shuffle happened.
  function ensurePossibleMove() {
    if (hasPossibleMove(state.board, state.heroId)) return false;
    let attempts = 0;
    do {
      state.board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => randomTile()));
      attempts++;
    } while (!hasPossibleMove(state.board, state.heroId) && attempts < 100);
    banner('No moves! Shuffling the crypt…');
    setStatus('No moves left — the crypt shuffled itself, for free! Drag through 3 or more matching tiles.');
    sfx.shuffle();
    if (!reducedMotion) {
      boardEl.classList.add('shuffling');
      setTimeout(() => boardEl.classList.remove('shuffling'), 500);
    }
    return true;
  }

  function resolveMatch() {
    const type = state.pathType;
    const len = state.path.length;
    // endDrag clears state.path right after this call, so capture it.
    const path = state.path.slice();
    // Against the Hollow King, the current weakness doubles its type.
    const weak = state.monster && state.monster.isTrueFinal
      ? weaknessForTurn(state.finalTurns) : null;
    const fx = matchEffect(type, len, state.heroId, state.relics, state.firstMatchThisFloor, state.swordBuff, weak);
    state.firstMatchThisFloor = false;
    state.score += fx.score;
    let healed = 0; // HP actually gained this match (potions / Biscuit's snack cap at full HP)
    // The matched tiles pop, then the rest of the board drops in after a
    // short beat. New drags are blocked while the board is settling so a
    // player cannot grab tiles that are about to fall away.
    state.settling = true;
    if (!reducedMotion) {
      path.forEach((p) => {
        const el = tileEls[tileIndex(p.r, p.c)];
        if (el) el.animate(
          [
            { transform: 'scale(1.08)', opacity: 1 },
            { transform: 'scale(0.2)', opacity: 0 },
          ],
          { duration: 130, easing: 'ease-in', fill: 'forwards' },
        );
      });
    }
    sfx.pop(len); // the match sound grows more epic with the path length
    if (type === 'sword' && fx.damage > 0) {
      state.monster.hp -= fx.damage;
      floatText(`-${fx.damage}`, 'dmg');
      $('#monster-card').classList.add('shake');
      setTimeout(() => $('#monster-card').classList.remove('shake'), 350);
      sfx.hit();
      // The shop's Sharp Sword is spent on the first sword match.
      if (state.swordBuff) {
        state.swordBuff = false;
        floatText('Sharp Sword! +5', 'dmg');
      }
    }
    if (type === 'shield' && fx.block > 0) {
      state.block += fx.block;
      floatText(`+${fx.block} block`, 'block');
      sfx.heal();
    }
    if (type === 'potion' && fx.heal > 0) {
      healed = Math.min(fx.heal, state.maxHp - state.hp);
      state.hp += healed;
      floatText(`+${healed} HP`, 'heal');
      sfx.heal();
    }
    // Gold is awarded for any match now, not just coins: the chain bonus
    // pays gold for long sword/shield/potion chains too. The coin float
    // shows the base treasure only, so the chain bonus float next to it
    // always adds up to the total gold earned.
    if (fx.gold > 0) {
      state.gold += fx.gold;
      if (type === 'coin') {
        floatText(`+${fx.gold - fx.chainBonus} gold`, 'gold');
        if (fx.heal > 0) { healed = Math.min(fx.heal, state.maxHp - state.hp); state.hp += healed; floatText(`+${fx.heal} HP snack!`, 'heal'); }
        sfx.coin();
      }
      if (fx.chainBonus > 0) {
        // The bonus float says what it does to the score (+10 per bonus
        // gold) and stays up 2.5s so there is time to read it.
        floatText(`CHAIN BONUS +${fx.chainBonus} gold · +${fx.chainBonus * 10} pts`, 'gold', 2500);
        if (type !== 'coin') sfx.coin();
      }
    }
    // Hitting the Hollow King's weakness is worth shouting about.
    if (weak && type === weak) floatText('WEAKNESS!', 'weak');
    // Record this turn for the persistent "Last turn" line. The bite
    // (or the SLAIN! ending) is appended to it when it lands.
    state.turnId += 1;
    const turnId = state.turnId;
    turnMatch = { type, len, fx, healed, weak: !!(weak && type === weak) };
    turnLine = lastTurnText(turnMatch, null);
    renderLastTurn();
    updateHud();
    const settleMs = reducedMotion ? 0 : 140;
    setTimeout(() => {
      // Cancel the pop animations first — they hold opacity 0 with fill
      // forwards, and the tile must be visible again before it falls.
      path.forEach((p) => {
        const el = tileEls[tileIndex(p.r, p.c)];
        if (el) el.getAnimations().forEach((a) => a.cancel());
      });
      // Clear the matched tiles, let the rest fall, and refill.
      path.forEach((p) => { state.board[p.r][p.c] = null; });
      const falls = refillBoard();
      // Turn order: shuffle FIRST if the refilled board has no moves
      // (free — no HP loss, no extra bite), then the monster attacks
      // once for this turn as normal.
      const shuffled = ensurePossibleMove();
      paintBoard(shuffled ? null : falls);
      state.settling = false;
      updateHud();
      if (state.monster.hp <= 0) {
        playDeath();
      } else {
        // The monster bites back once the fall is (mostly) done — a beat
        // later if the board just shuffled, so the player sees the new
        // board before the bite lands.
        const attackMs = reducedMotion ? 420 : shuffled ? 720 : 560;
        setTimeout(() => monsterAttack(turnId), attackMs);
      }
    }, settleMs);
  }

  function monsterAttack(turnId = null) {
    if (state.over || state.screen !== 'play' || !state.monster || state.monster.hp <= 0 || state.dying) return;
    const isFinal = !!state.monster.isTrueFinal;
    // The Hollow King's crushing blow: every 4th boss turn, 3x attack.
    // Block absorbs it normally — banking block before the blow lands
    // is the counter-play.
    const crushing = isFinal && isCrushingTurn(state.finalTurns + 1);
    const atk = crushing ? state.monster.attack * 3 : state.monster.attack;
    const dmg = biteDamage(atk, state.block, state.relics);
    const blocked = Math.min(state.block, atk);
    // Block carries over: a bite only eats what it absorbs, so any
    // leftover block stays for the next bite (and the next floor).
    state.block = absorbBlock(state.block, atk);
    if (dmg > 0) {
      state.hp -= dmg;
      floatText(crushing ? `-${dmg} CRUSHING BLOW!` : `-${dmg} bite!`, 'dmg');
      sfx.hurt();
      $('#hero-chip').classList.add('shake');
      setTimeout(() => $('#hero-chip').classList.remove('shake'), 350);
    } else if (blocked > 0) {
      floatText(crushing ? 'Crushing blow blocked!' : 'Blocked!', 'block');
      sfx.pop();
    } else {
      floatText(crushing ? 'Crushing blow missed!' : 'Missed!', 'block');
    }
    if (isFinal) {
      // The weakness rotates every 2 boss turns — announce the change.
      const oldWeak = weaknessForTurn(state.finalTurns);
      state.finalTurns += 1;
      const newWeak = weaknessForTurn(state.finalTurns);
      if (newWeak !== oldWeak) {
        banner(`The Hollow King is now weak to ${TILE_LABEL[newWeak].toUpperCase()}!`);
        setStatus(`The Hollow King is now weak to ${TILE_LABEL[newWeak]}!`);
      }
    }
    // Append the bite to the "Last turn" line — but only if no newer
    // match has resolved since this bite was scheduled, so a late bite
    // never labels the wrong turn.
    if (turnMatch && (turnId === null || turnId === state.turnId)) {
      turnLine = lastTurnText(turnMatch, { monsterName: state.monster.name, attack: atk, blocked, taken: dmg, crushing });
      renderLastTurn();
    }
    updateHud();
    if (state.hp <= 0) gameOver();
  }

  // The monster's little pixel soul (the ghost sprite) rises out of the
  // monster card and fades away. Motion only — skipped under reduced
  // motion, where the fade on the monster itself carries the moment.
  function spawnSoul() {
    if (reducedMotion) return;
    const card = $('#monster-card');
    const soul = document.createElement('span');
    soul.className = 'soul';
    soul.setAttribute('aria-hidden', 'true');
    soul.innerHTML = spriteSVG('monster-ghost');
    card.appendChild(soul);
    setTimeout(() => soul.remove(), 950);
  }

  // Death sequence: the killing blow lands, the monster screams, shakes,
  // flashes white, tips over and fades — and only then does the floor
  // clear. Regular deaths take ~700ms, bosses ~1100ms (bigger scream,
  // board shake, "BOSS SLAIN!"). While dying, drags are blocked
  // (startDrag guard) and the monster cannot bite back (monsterAttack
  // guard + no attack is scheduled in the kill branch), so the floor can
  // only ever increment once per kill, in floorCleared below.
  function playDeath() {
    if (state.dying) return;
    const boss = state.monster.isBoss;
    state.dying = true;
    const card = $('#monster-card');
    card.classList.add('dying');
    if (boss) card.classList.add('dying-boss');
    sfx.scream(boss);
    floatText(boss ? 'BOSS SLAIN!' : 'SLAIN!', 'slain');
    // The turn ends with the slaying, not a bite.
    if (turnMatch) {
      turnLine = lastTurnText(turnMatch, { slain: true, boss });
      renderLastTurn();
    }
    if (!reducedMotion) {
      // Quick white flash on the board, and a board shake for bosses.
      boardEl.animate(
        [{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }],
        { duration: 300, easing: 'ease-out' },
      );
      if (boss) {
        document.querySelector('.board-wrap').animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 250, iterations: 2, easing: 'steps(4)' },
        );
      }
      spawnSoul();
    }
    const deathMs = reducedMotion ? 350 : boss ? 1100 : 700;
    setTimeout(() => {
      card.classList.remove('dying', 'dying-boss');
      state.dying = false;
      floorCleared();
    }, deathMs);
  }

  function floorCleared() {
    state.kills += 1;
    state.score += 50 + state.floor * 10;
    const clearedFloor = state.floor;
    const heal = 3;
    state.hp = Math.min(state.maxHp, state.hp + heal);
    // Block is NOT reset here: leftover block carries to the next floor.
    sfx.clear();
    const wasBoss = state.monster.isBoss;
    const wasFakeFinal = !!state.monster.isFakeFinal;
    const wasTrueFinal = !!state.monster.isTrueFinal;
    if (wasBoss) awardAchievements({ type: 'boss', floor: clearedFloor });
    // The Hollow King is beaten: the crypt lights back up.
    if (wasTrueFinal) $('#crypt-game').classList.remove('final-boss');
    banner(`Floor ${state.floor} cleared! +${heal} HP`);
    setStatus(`Floor ${state.floor} cleared! The ${state.monster.name} wobbled away.`);
    state.floor += 1;
    if (state.floor > state.best) {
      state.best = state.floor;
      try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (e) { /* ignore */ }
    }
    // The shop opens between floors, so the boss loop must not follow
    // the player out of a boss floor — back to the main tune now. This
    // is a no-op on regular floors, where the main loop is already
    // playing, and the shop itself never touches the music. (Skipped
    // while paused; unpause resumes the selected track, and the next
    // monster's spawn fixes the track either way.)
    if (!state.paused) sfx.startMusic('main');
    newBoard();
    renderBoard();
    updateHud();
    // The next monster only spawns once the player leaves the shop, so
    // the shop is never a race against a live monster. Descending is
    // also when queued achievement celebrations fire — the player is
    // back on the board and no overlay is open.
    const descend = () => { spawnMonster(); updateHud(); renderBoard(); showNextAchievement(); };
    // A short beat first, so the player sees the "Floor cleared" banner.
    // Boss floors: relic pick first, then the shop. Other floors: shop.
    // The fake final boss gets its victory gag first; the true final
    // boss gets the real victory screen first.
    const continueFlow = () => {
      if (wasBoss) showRelicChoice(() => showShop(descend));
      else showShop(descend);
    };
    if (wasFakeFinal) setTimeout(() => showFakeVictory(continueFlow), 700);
    else if (wasTrueFinal) setTimeout(() => showTrueVictory(continueFlow, clearedFloor), 700);
    else setTimeout(continueFlow, 700);
  }

  // The fake final boss: a victory gag in two beats. "YOU WIN!" — then
  // the rumbling. Tapping through resumes the normal flow (relic pick
  // first, since the fake boss is a boss, then the shop, then floor 16).
  function showFakeVictory(onDone) {
    const modal = $('#fakewin-overlay');
    const title = $('#fakewin-title');
    const text = $('#fakewin-text');
    const btn = $('#fakewin-button');
    title.textContent = 'YOU WIN!';
    text.textContent = 'The crypt is saved! King Crumb has crumbled. Time to go home a hero!';
    btn.textContent = 'Hooray!';
    btn.onclick = () => {
      title.textContent = '...wait.';
      text.textContent = 'Do you hear that rumbling? Something is waking up below...';
      btn.textContent = 'Uh oh.';
      sfx.boss();
      btn.onclick = () => {
        modal.hidden = true;
        sfx.blip();
        if (onDone) onDone();
      };
    };
    modal.hidden = false;
    sfx.clear();
    setStatus('You win! The crypt is saved! ...wait. Do you hear that rumbling?');
  }

  // The TRUE final boss, beaten: the real victory screen. "Keep delving"
  // resumes the normal flow (relic pick, then shop, then floor 21 — the
  // endless game goes on, and the Hollow King does not repeat). "New
  // run" goes back to the setup screen, like the game-over flow.
  function showTrueVictory(onKeepDelving, clearedFloor) {
    // The Hollow King is beaten: record the win (hero x difficulty),
    // plus first-win / win-hard when they apply. The celebration
    // banners wait until the player is back on the board (descend).
    awardAchievements({ type: 'win', heroId: state.heroId, difficultyId: state.difficulty });
    const modal = $('#victory-overlay');
    $('#win-floor').textContent = clearedFloor;
    $('#win-kills').textContent = state.kills;
    $('#win-gold').textContent = state.gold;
    $('#win-score').textContent = state.score;
    $('#win-best').textContent = `Best floor: ${state.best} · Best gold: ${state.bestGold}`;
    modal.hidden = false;
    sfx.clear();
    setStatus(`You beat the crypt! You defeated the Hollow King on floor ${clearedFloor}.`);
    $('#keep-delving-button').onclick = () => {
      modal.hidden = true;
      sfx.blip();
      if (onKeepDelving) onKeepDelving();
    };
    $('#new-run-button').onclick = () => {
      modal.hidden = true;
      $('#play-screen').hidden = true;
      $('#setup-screen').hidden = false;
      state.screen = 'setup';
      $('#relic-count').textContent = '0/50';
      achQueue = [];
      updateLowHp(); // back on setup: the red edges go away
      renderHeroes(); renderDetail(); renderAchievementsButton();
    };
  }

  // The shop player's spendable state, read from / written back to state.
  function shopPlayer() {
    return { gold: state.gold, hp: state.hp, maxHp: state.maxHp, block: state.block, swordBuff: state.swordBuff };
  }
  function applyShopPlayer(next) {
    state.gold = next.gold; state.hp = next.hp; state.block = next.block; state.swordBuff = next.swordBuff;
  }

  // The Crypt Shop: fixed stock, fixed prices, open after every floor is
  // cleared. The overlay itself covers the board, so — like the relic
  // modal — no drag can start while it is open. Descend is always free
  // and always available, even with 0 gold, so the shop can never block
  // the game.
  function showShop(onDescend) {
    const modal = $('#shop-modal');
    const list = $('#shop-choices');
    $('#shop-gold').textContent = state.gold;
    $('#shop-descend').textContent = `⬇ Descend to floor ${state.floor}`;
    list.innerHTML = '';
    SHOP_ITEMS.forEach((item) => {
      const reason = shopDisabledReason(item.id, shopPlayer());
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-choice';
      b.disabled = reason !== null;
      b.innerHTML = `<span class="relic-emoji" aria-hidden="true">${spriteSVG(item.sprite)}</span><strong>${item.name}</strong><span>${item.desc}</span><span class="shop-price"><span class="shop-coin" aria-hidden="true">${spriteSVG('tile-coin')}</span> ${item.price} gold</span>${reason ? `<span class="shop-reason">${reason}</span>` : ''}`;
      b.addEventListener('click', () => {
        const before = shopPlayer();
        const next = shopBuy(item.id, before);
        if (!next) return;
        applyShopPlayer(next);
        sfx.coin();
        if (item.id === 'stew') { floatText(`+${next.hp - before.hp} HP`, 'heal'); sfx.heal(); }
        if (item.id === 'shield') floatText('+10 block', 'block');
        if (item.id === 'sword') floatText('Sharp Sword ready!', 'dmg');
        setStatus(`${item.name} bought for ${item.price} gold.`);
        updateHud();
        showShop(onDescend); // re-render: fresh gold, fresh disabled states
      });
      list.appendChild(b);
    });
    modal.hidden = false;
    $('#shop-descend').onclick = () => {
      modal.hidden = true;
      sfx.blip();
      onDescend();
    };
  }

  // What runs when the relic modal closes without a pick ("Not now") —
  // set by showRelicChoice so the boss-floor flow can continue to the shop.
  let relicDone = null;

  function showRelicChoice(onDone) {
    relicDone = onDone || null;
    const pool = [...RELICS].sort(() => Math.random() - 0.5).slice(0, 3);
    const modal = $('#relic-modal');
    const list = $('#relic-choices');
    list.innerHTML = '';
    pool.forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'relic-choice';
      b.innerHTML = `<span class="relic-emoji" aria-hidden="true">${spriteSVG(r.sprite)}</span><strong>${r.name}</strong><span>${r.desc}</span>`;
      b.addEventListener('click', () => {
        state.relics.push(r.id);
        awardAchievements({ type: 'relic', relicId: r.id });
        if (r.id === 'hearty-stew') { state.maxHp += 5; state.hp = Math.min(state.maxHp, state.hp + 5); }
        modal.hidden = true;
        sfx.relic();
        setStatus(`Relic found: ${r.name} — ${r.desc}`);
        updateHud();
        const done = relicDone; relicDone = null;
        if (done) done();
      });
      list.appendChild(b);
    });
    modal.hidden = false;
  }

  function gameOver() {
    state.over = true;
    achQueue = []; // any queued celebrations are dropped, not shown dead
    state.swordBuff = false; // a bought buff never survives into a new run
    $('#crypt-game').classList.remove('final-boss');
    sfx.stopMusic();
    sfx.over();
    const floorReached = state.floor;
    const newBest = floorReached > state.best;
    if (newBest) state.best = floorReached;
    const newBestGold = state.gold > state.bestGold;
    if (newBestGold) state.bestGold = state.gold;
    try {
      localStorage.setItem(BEST_KEY, String(state.best));
      localStorage.setItem(BEST_GOLD_KEY, String(state.bestGold));
    } catch (e) { /* ignore */ }
    $('#over-floor').textContent = floorReached;
    $('#over-kills').textContent = state.kills;
    $('#over-gold').textContent = state.gold;
    $('#over-score').textContent = state.score;
    $('#over-best').textContent = `Best floor: ${state.best} · Best gold: ${state.bestGold}${newBest ? ' — new best floor!' : ''}`;
    $('#gameover-overlay').hidden = false;
    setStatus(`Game over. You reached floor ${floorReached}.`);
    updateHud();
  }

  // ---- run flow ----
  function startRun() {
    const diff = DIFFICULTIES[state.difficulty];
    state.maxHp = diff.hp + (state.heroId === 'moss' ? 10 : 0);
    state.hp = state.maxHp; state.block = 0; state.gold = 0; state.score = 0;
    state.floor = 1; state.kills = 0; state.relics = []; state.swordBuff = false; state.over = false; state.paused = false; state.dying = false; state.finalTurns = 0;
    state.monsterDeck = shuffleDeck(MONSTER_POOL);
    state.bossDeck = shuffleDeck(BOSS_DECK);
    const hero = HEROES.find((h) => h.id === state.heroId);
    $('#hero-chip').innerHTML = `${spriteSVG(hero.sprite)} ${state.heroName} · ${hero.name}`;
    $('#setup-screen').hidden = true;
    $('#play-screen').hidden = false;
    $('#gameover-overlay').hidden = true;
    $('#crypt-game').classList.remove('final-boss');
    state.screen = 'play';
    turnMatch = null; turnLine = 'Last turn: —'; renderLastTurn();
    newBoard(); renderBoard(); spawnMonster(); updateHud();
    setStatus(`Floor 1: a ${state.monster.name} blocks the way. Drag through 3 or more matching tiles!`);
    sfx.clear();
    sfx.startMusic();
  }
  $('#descend-button').addEventListener('click', startRun);
  $('#achievements-button').addEventListener('click', showAchievements);
  $('#achievements-close').addEventListener('click', () => {
    $('#achievements-overlay').hidden = true;
    sfx.blip();
    renderAchievementsButton();
  });
  $('#back-button').addEventListener('click', () => { window.location.href = '../../../games.html'; });
  $('#play-again-button').addEventListener('click', () => {
    $('#gameover-overlay').hidden = true;
    $('#play-screen').hidden = true;
    $('#setup-screen').hidden = false;
    state.screen = 'setup';
    $('#relic-count').textContent = '0/50';
    achQueue = [];
    updateLowHp(); // back on setup: the red edges go away
    renderHeroes(); renderDetail(); renderAchievementsButton();
  });
  $('#quit-button').addEventListener('click', () => { window.location.href = '../../../games.html'; });

  // ---- pause / mute / fullscreen ----
  const pauseBtn = $('#pause-button');
  function setPaused(p) {
    state.paused = p;
    pauseBtn.textContent = p ? '▶' : '❚❚';
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Resume game' : 'Pause game');
    $('#paused-note').hidden = !p;
    boardEl.classList.toggle('paused', p);
    // NES games stop the tune when paused — resume it on unpause.
    if (p) sfx.stopMusic();
    else if (state.screen === 'play' && !state.over) sfx.startMusic();
  }
  pauseBtn.addEventListener('click', () => setPaused(!state.paused));
  const muteBtn = $('#mute-button');
  function renderMute() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Turn sounds on' : 'Mute sounds');
  }
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('foofireMuted.v1', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    sfx.setMuted(muted);
    renderMute();
    if (!muted) {
      sfx.blip();
      if (state.screen === 'play' && !state.paused && !state.over) sfx.startMusic();
    }
  });
  renderMute();
  const fsBtn = $('#fullscreen-button');
  fsBtn.addEventListener('click', () => {
    const wrap = $('#crypt-game');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play' && !state.over) setPaused(true);
  });
  $('#relic-close').addEventListener('click', () => {
    $('#relic-modal').hidden = true;
    const done = relicDone; relicDone = null;
    if (done) done();
  });
}
