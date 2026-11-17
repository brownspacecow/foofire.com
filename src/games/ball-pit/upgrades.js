/* ------------------------------------------------------------------ *
 * Ball Pit Bonanza — shop
 * Four upgrade tracks you can level up, plus one-off prizes.
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
    id: 'bear-plush',
    name: 'Bear Plush',
    emoji: '🧸',
    cost: 150,
    blurb: 'Bear the Puppy, ball pit edition, rides on your back.',
  },
  {
    id: 'neon-crown',
    name: 'Neon Crown',
    emoji: '👑',
    cost: 400,
    blurb: 'A glowing crown for the champion of the pit.',
  },
  {
    id: 'confetti-cannon',
    name: 'Confetti Cannon',
    emoji: '🎉',
    cost: 800,
    blurb: 'Extra confetti bursts every time you find treasure.',
  },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
export const PRIZE_BY_ID = new Map(PRIZES.map((prize) => [prize.id, prize]));

/** Cost of the next level, or null when the track is maxed out. */
export function nextCost(upgrade, level) {
  return level >= upgrade.max ? null : upgrade.costs[level];
}
