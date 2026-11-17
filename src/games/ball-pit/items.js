/* ------------------------------------------------------------------ *
 * Ball Pit Bonanza — buried treasure
 * Every find belongs to a rarity tier. Luck upgrades raise the weight
 * of the good tiers (and lower junk), so better stuff keeps showing up.
 * ------------------------------------------------------------------ */

export const RARITIES = {
  junk: {
    id: 'junk',
    label: 'Junk',
    weight: 55,
    luckBoost: -0.1,
    color: '#9ca3af',
  },
  common: {
    id: 'common',
    label: 'Common',
    weight: 30,
    luckBoost: 0.04,
    color: '#7dd3fc',
  },
  uncommon: {
    id: 'uncommon',
    label: 'Uncommon',
    weight: 12,
    luckBoost: 0.14,
    color: '#3ddc84',
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    weight: 2.7,
    luckBoost: 0.35,
    color: '#c084fc',
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra Rare',
    weight: 0.3,
    luckBoost: 0.7,
    color: '#ffd93d',
  },
};

// id, name, emoji, rarity, low value, high value, flavour text
const ROWS = [
  ['soggy-slice', 'Soggy Pizza Slice', '🍕', 'junk', 1, 3, 'Somebody lost their lunch down here years ago.'],
  ['lost-sock', 'Lonely Sock', '🧦', 'junk', 1, 2, 'Where did the other one go?'],
  ['gum-wrapper', 'Gum Wrapper', '🍬', 'junk', 1, 1, 'Not even a little bit valuable.'],
  ['plastic-spoon', 'Plastic Spoon', '🥄', 'junk', 1, 2, 'A spoon. Just a spoon.'],
  ['tin-can', 'Dented Tin Can', '🥫', 'junk', 1, 3, 'It has a tiny dent shaped like a smile.'],
  ['broken-shades', 'Broken Shades', '🕶️', 'junk', 2, 4, 'One lens is missing, but they look cool.'],
  ['sticker-sheet', 'Sticker Sheet', '✨', 'junk', 2, 4, 'Half the stickers are already stuck to balls.'],

  ['old-watch', 'Old Watch', '⌚', 'common', 8, 16, 'Still ticking! Somebody has been missing this.'],
  ['rubber-duck', 'Rubber Duck', '🦆', 'common', 6, 12, 'It squeaks when you squeeze it.'],
  ['arcade-token', 'Arcade Token', '🪙', 'common', 5, 9, 'Good for one game at the Fun Room.'],
  ['bouncy-ball', 'Bouncy Ball', '🔴', 'common', 6, 10, 'Yes, it is a ball inside the ball pit.'],
  ['walkie-talkie', 'Walkie-Talkie', '📻', 'common', 10, 18, 'You can hear somebody laughing on channel 4.'],
  ['lunch-box', 'Retro Lunch Box', '🍱', 'common', 8, 14, 'Still has a juice box inside.'],
  ['flashlight', 'Handy Flashlight', '🔦', 'common', 7, 13, 'Perfect for digging under the balls.'],

  ['retro-handheld', 'Retro Handheld', '🎮', 'uncommon', 30, 55, 'Still has a high score saved on it.'],
  ['skateboard', 'Mini Skateboard', '🛹', 'uncommon', 35, 60, 'The wheels still spin.'],
  ['drone', 'Tiny Drone', '🛸', 'uncommon', 40, 70, 'It chirps and tries to take off.'],
  ['toy-robot', 'Toy Robot', '🤖', 'uncommon', 25, 45, 'It beeps politely when you pick it up.'],
  ['silver-bracelet', 'Silver Bracelet', '💫', 'uncommon', 30, 50, 'A little tarnished, still shiny.'],
  ['boombox', 'Pocket Boombox', '📻', 'uncommon', 32, 58, 'It only plays one song. It is a good song.'],
  ['camera', 'Instant Camera', '📷', 'uncommon', 38, 66, 'One photo left on the film.'],

  ['gold-ring', 'Gold Ring', '💍', 'rare', 180, 300, 'Somebody is going to be very happy about this.'],
  ['smart-tablet', 'Smart Tablet', '📱', 'rare', 160, 280, 'The battery is somehow still at 84%.'],
  ['diamond-earring', 'Diamond Earring', '💎', 'rare', 220, 380, 'It sparkles even under the balls.'],
  ['vintage-watch', 'Vintage Watch', '⌚', 'rare', 200, 350, 'A proper collector piece.'],
  ['gold-chain', 'Gold Chain', '📿', 'rare', 190, 320, 'Heavy. Shiny. Definitely real.'],
  ['designer-sneaker', 'Designer Sneaker', '👟', 'rare', 170, 290, 'Only one shoe, but what a shoe.'],

  ['iphone-17', 'Brand-New iPhone 17', '📱', 'ultra', 2500, 6000, 'Still in the box. Nobody knows how it got in here.'],
  ['golden-pizza', 'Golden Pizza Trophy', '🍕', 'ultra', 2500, 4000, 'The legendary slice of the ball pit.'],
];

export const ITEMS = ROWS.map(([id, name, emoji, rarity, min, max, blurb]) => ({
  id,
  name,
  emoji,
  rarity,
  min,
  max,
  blurb,
  label: RARITIES[rarity].label,
  color: RARITIES[rarity].color,
}));

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export const itemById = (id) => ITEM_BY_ID.get(id) || null;

/** Rarity weights after luck, normalised into a 0..1 cumulative table. */
export function rarityTable(luckLevel = 0) {
  const entries = Object.values(RARITIES).map((rarity) => ({
    rarity,
    weight: Math.max(0.02, rarity.weight * (1 + rarity.luckBoost * luckLevel)),
  }));
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map((entry) => ({ ...entry, chance: entry.weight / total }));
}

/** Pick a rarity tier for a find. */
export function rollRarity(luckLevel = 0, random = Math.random) {
  let roll = random();
  const table = rarityTable(luckLevel);
  for (const entry of table) {
    roll -= entry.chance;
    if (roll <= 0) return entry.rarity.id;
  }
  return table[table.length - 1].rarity.id;
}

/** A whole coin value inside the item's range. */
export function rollValue(item, random = Math.random) {
  if (!item) return 0;
  const span = item.max - item.min + 1;
  return item.min + Math.floor(random() * span);
}

/** Roll a full find: an item plus the value of this particular one. */
export function rollFind(luckLevel = 0, random = Math.random) {
  const rarity = rollRarity(luckLevel, random);
  const pool = ITEMS.filter((item) => item.rarity === rarity);
  if (!pool.length) return null;
  const item = pool[Math.floor(random() * pool.length)];
  return { item, value: rollValue(item, random) };
}
