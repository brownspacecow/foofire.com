/* ------------------------------------------------------------------ *
 * Ball Pit Bonanza — shop
 * Seven upgrade tracks you can level up, plus one-off prizes.
 * ------------------------------------------------------------------ */

export const UPGRADES = [
  {
    id: 'luck',
    name: 'Lucky Charm',
    emoji: '🍀',
    max: 5,
    costs: [25, 80, 200, 500, 1100],
    blurb: 'Better stuff hides in the balls when you are lucky.',
    effect: (level) =>
      level === 0
        ? 'Find chance 62% · normal rarity odds'
        : `Find chance ${Math.min(92, 62 + level * 5)}% · better rarity odds`,
  },
  {
    id: 'speed',
    name: 'Speed Sneakers',
    emoji: '👟',
    max: 5,
    costs: [30, 90, 220, 520, 1200],
    blurb: 'Wade through the balls much faster.',
    effect: (level) =>
      level === 0 ? 'Normal wading speed' : `Wading speed +${level * 14}%`,
  },
  {
    id: 'scoop',
    name: 'Bigger Scoop',
    emoji: '🥄',
    max: 4,
    costs: [40, 140, 380, 900],
    blurb: 'One dig flings a much wider patch of balls away.',
    effect: (level) => `${(1.45 + level * 0.32).toFixed(2)} m dig radius`,
  },
  {
    id: 'playground',
    name: 'Playground',
    emoji: '🎡',
    max: 4,
    costs: [60, 200, 600, 1500],
    blurb: 'Grow the pit, add more balls, and open up new playground props.',
    effect: (level) =>
      ['Little pit, first balls', 'Slide unlocked', 'Trampoline + lights', 'Disco ball', 'Golden fountain'][
        level
      ],
  },
  {
    id: 'value',
    name: 'Coin Polisher',
    emoji: '🪙',
    max: 5,
    costs: [60, 180, 450, 1000, 2200],
    blurb: 'Rub every find until it shines so it sells for more coins.',
    effect: (level) =>
      level === 0 ? 'Normal sale value' : `Sale value +${level * 10}%`,
  },
  {
    id: 'haste',
    name: 'Turbo Hands',
    emoji: '👐',
    max: 4,
    costs: [75, 240, 650, 1500],
    blurb: 'Dig again sooner with a pair of extremely turbocharged hands.',
    effect: (level) => `${(0.55 - level * 0.045).toFixed(2)}s dig cooldown`,
  },
  {
    id: 'case',
    name: 'Display Case',
    emoji: '🏆',
    max: 4,
    costs: [90, 280, 750, 1700],
    blurb: 'Add another glass shelf for showing off your favourite finds.',
    effect: (level) => `${2 + level} display spots`,
  },
];

export const PRIZES = [
  {
    id: 'duck-buddy',
    name: 'Rubber Duck Buddy',
    emoji: '🦆',
    cost: 75,
    blurb: 'A rubber duck that paddles along behind you.',
  },
  {
    id: 'pet-rock',
    name: 'Pet Rock',
    emoji: '🪨',
    cost: 120,
    blurb: 'A very loyal rock that hops along behind you.',
  },
  {
    id: 'bear-plush',
    name: 'Bear Plush',
    emoji: '🧸',
    cost: 150,
    blurb: 'Bear the Puppy, ball pit edition, rides on your back.',
  },
  {
    id: 'tiny-umbrella',
    name: 'Tiny Umbrella',
    emoji: '☂️',
    cost: 300,
    blurb: 'It floats above your head. It does not actually stop balls.',
  },
  {
    id: 'neon-crown',
    name: 'Neon Crown',
    emoji: '👑',
    cost: 400,
    blurb: 'A glowing crown for the champion of the pit.',
  },
  {
    id: 'lucky-cat',
    name: 'Lucky Cat',
    emoji: '🐈',
    cost: 450,
    blurb: 'A waving cat that makes digging a little luckier.',
  },
  {
    id: 'robot-buddy',
    name: 'Robot Buddy',
    emoji: '🤖',
    cost: 550,
    blurb: 'A beeping little robot that rolls along beside you.',
  },
  {
    id: 'mega-case',
    name: 'Mega Display Case',
    emoji: '🏛️',
    cost: 700,
    blurb: 'Three extra glass shelves for your collection.',
  },
  {
    id: 'confetti-cannon',
    name: 'Confetti Cannon',
    emoji: '🎉',
    cost: 800,
    blurb: 'Extra confetti bursts every time you find treasure.',
  },
  {
    id: 'golden-spatula',
    name: 'Golden Spatula',
    emoji: '🍳',
    cost: 1100,
    blurb: 'Every find sells for 15% more. It is a very fancy spatula.',
  },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
export const PRIZE_BY_ID = new Map(PRIZES.map((prize) => [prize.id, prize]));

/** Cost of the next level, or null when the track is maxed out. */
export function nextCost(upgrade, level) {
  return level >= upgrade.max ? null : upgrade.costs[level];
}
