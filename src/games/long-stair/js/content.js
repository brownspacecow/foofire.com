/*
 * The Long Stair — content.
 * Everything the game talks about lives here: the people you send down,
 * the things that come back up, and the wounds and dreads they carry.
 */

export const TITLE = 'The Long Stair';

export const DIFFICULTIES = {
  dread: {
    id: 'dread',
    name: 'Dread',
    text: 'The descent as it was meant to be. Lean, unforgiving, six floors of it.',
    enemyHp: 1,
    enemyMight: 1,
    enemyStress: 1,
    coin: 1,
  },
  lamplight: {
    id: 'lamplight',
    name: 'Lamplight',
    text: 'A kinder house. Frailer horrors and a fuller purse, but the dark still remembers you.',
    enemyHp: 0.8,
    enemyMight: 0.8,
    enemyStress: 0.85,
    coin: 1.3,
  },
};

export const FLOORS = [
  {
    name: 'The Root Cellar',
    sub: 'Brick, damp, and older than the house.',
    intro:
      'The stair gives out after twelve steps and keeps going. The lamp finds a cellar that was not on the deeds: low vaults, bad mortar, jars sealed from the inside.',
  },
  {
    name: 'The Flooded Stair',
    sub: 'The water is warm. It should not be warm.',
    intro:
      'Ankle-deep water, warm as a bath, running uphill from somewhere. Your lantern light lies flat on it and does not come back.',
  },
  {
    name: 'The Ossuary Landing',
    sub: 'Someone has been sorting the bones.',
    intro:
      'Bones are stacked in tidy rows along the walls. Every one is the same length. None of them are human, and none of them are not.',
  },
  {
    name: 'The Salt Gallery',
    sub: 'Four miles from the sea.',
    intro:
      'White crystals fur every surface and the air tastes of a tide that has never reached Halloway Street. Something out here breathes in time with the party.',
  },
  {
    name: 'The Choir Vault',
    sub: 'The humming is behind your eyes.',
    intro:
      'The humming has stopped coming from the walls. It comes from the space between one heartbeat and the next, and the heroes have started humming back without noticing.',
  },
  {
    name: 'The Unnamed Chancel',
    sub: 'The stair ends at a door not built for people.',
    intro:
      'The last door is small and wet and opens before anyone touches it. Beyond it is a wide, low room with an altar, and something kneeling at the altar that has been expecting the lamp.',
  },
];

export const HEROES = {
  vance: {
    id: 'vance',
    name: 'Dr. Ilse Vance',
    epithet: 'The Disgraced Surgeon',
    sigil: '✚',
    flavour: 'Struck off for what she did to keep a patient breathing. The bag stays by the door.',
    hp: 21,
    might: 5,
    guard: 2,
    wit: 5,
    nerve: 3,
    ability: {
      id: 'cauterise',
      name: 'Cauterise',
      text: 'Heal the most wounded hero 10 HP. Vance takes 5 stress.',
      cooldown: 3,
      kind: 'heal',
      power: 10,
      selfStress: 5,
    },
    flaw: 'habit',
  },
  rook: {
    id: 'rook',
    name: 'Abel Rook',
    epithet: 'The Drunk Constable',
    sigil: '☘',
    flavour: 'He has seen the inside of every cell in Halloway. None of them prepared him for this.',
    hp: 25,
    might: 7,
    guard: 4,
    wit: 2,
    nerve: 2,
    ability: {
      id: 'sweep',
      name: 'Truncheon Sweep',
      text: 'Deal 6 damage to every horror in the room.',
      cooldown: 3,
      kind: 'damageAll',
      power: 6,
    },
    flaw: 'bottle',
  },
  wren: {
    id: 'wren',
    name: 'Elias Wren',
    epithet: 'The Gravedigger',
    sigil: '⚒',
    flavour: 'Knows the weight of a full coffin and the sound of an empty one.',
    hp: 27,
    might: 8,
    guard: 3,
    wit: 1,
    nerve: 3,
    ability: {
      id: 'shovel',
      name: 'Shovel Arc',
      text: 'Deal 12 damage and stagger one horror, costing it its next action.',
      cooldown: 4,
      kind: 'stun',
      power: 12,
    },
    flaw: 'morbid',
  },
  quill: {
    id: 'quill',
    name: 'Mara Quill',
    epithet: 'The Spirit Medium',
    sigil: '☽',
    flavour: 'She has been talking to the dead since she was nine. Lately, they answer.',
    hp: 18,
    might: 4,
    guard: 1,
    wit: 7,
    nerve: 3,
    ability: {
      id: 'sight',
      name: 'Second Sight',
      text: 'Ward the party: the next two horror attacks miss. Lower everyone\'s stress by 4.',
      cooldown: 4,
      kind: 'ward',
      power: 2,
      relief: 4,
    },
    flaw: 'veil',
  },
  tallow: {
    id: 'tallow',
    name: 'Tom Tallow',
    epithet: "The Lamplighter's Boy",
    sigil: '✦',
    flavour: 'Fast, quiet, and far too willing to be useful.',
    hp: 16,
    might: 5,
    guard: 2,
    wit: 4,
    nerve: 5,
    ability: {
      id: 'flare',
      name: 'Flare',
      text: 'Deal 5 damage and stagger one horror, costing it its next action.',
      cooldown: 3,
      kind: 'stun',
      power: 5,
    },
    flaw: 'tooYoung',
  },
  crain: {
    id: 'crain',
    name: 'Vesta Crain',
    epithet: 'The Widow',
    sigil: '♰',
    flavour:
      'Her husband went down to fix the boiler in March. She has been waiting by the cellar door ever since.',
    hp: 23,
    might: 7,
    guard: 3,
    wit: 3,
    nerve: 3,
    ability: {
      id: 'keening',
      name: 'Keening',
      text: 'Deal 5 damage to every horror and lower everyone\'s stress by 5.',
      cooldown: 3,
      kind: 'damageAll',
      power: 5,
      relief: 5,
    },
    flaw: 'grief',
  },

  /* Volunteers who turn up at the door once word gets around. */
  agnes: {
    id: 'agnes',
    name: 'Sister Agnes Morrow',
    epithet: 'The Unshriven Nun',
    sigil: '✟',
    flavour:
      'She left the order when the hymns started coming back in a voice that was not hers.',
    hp: 20,
    might: 5,
    guard: 2,
    wit: 5,
    nerve: 4,
    ability: {
      id: 'litany',
      name: 'Litany',
      text: 'Heal every hero 3 HP and lower everyone\'s stress by 8.',
      cooldown: 3,
      kind: 'healAll',
      power: 3,
      relief: 8,
    },
    flaw: 'penitent',
    cost: 55,
  },
  otho: {
    id: 'otho',
    name: 'Professor Otho Hale',
    epithet: 'The Antiquarian',
    sigil: '⌘',
    flavour:
      'He bought the house papers at auction. He knows what the cellar is for. He will not say.',
    hp: 21,
    might: 4,
    guard: 2,
    wit: 8,
    nerve: 2,
    ability: {
      id: 'sign',
      name: 'Elder Sign',
      text: 'Deal 9 damage that ignores guard and weaken one horror (its blows land softer).',
      cooldown: 3,
      kind: 'weaken',
      power: 9,
      weaken: 3,
    },
    flaw: 'hubris',
    cost: 65,
  },
  silas: {
    id: 'silas',
    name: 'Silas Pike',
    epithet: 'The Returned Soldier',
    sigil: '⚔',
    flavour: 'Came back from the war with a limp and a talent for bayonets.',
    hp: 25,
    might: 8,
    guard: 4,
    wit: 2,
    nerve: 1,
    ability: {
      id: 'bayonet',
      name: 'Bayonet',
      text: 'Deal 14 damage to one horror.',
      cooldown: 3,
      kind: 'damage',
      power: 14,
    },
    flaw: 'shellshock',
    cost: 70,
  },
  nessa: {
    id: 'nessa',
    name: 'Nessa Crowe',
    epithet: 'The Poacher',
    sigil: '⛓',
    flavour: 'If it can be trapped, she has trapped it. If it cannot, she has tried.',
    hp: 19,
    might: 6,
    guard: 2,
    wit: 5,
    nerve: 3,
    ability: {
      id: 'snare',
      name: 'Snare',
      text: 'Stagger one horror for two turns. No damage, but no teeth either.',
      cooldown: 4,
      kind: 'stun',
      power: 0,
      stun: 2,
    },
    flaw: 'coward',
    cost: 60,
  },
  anselm: {
    id: 'anselm',
    name: 'Brother Anselm',
    epithet: 'The Choirboy',
    sigil: '♪',
    flavour: 'His voice calms the others. It also calms something downstairs.',
    hp: 18,
    might: 3,
    guard: 2,
    wit: 6,
    nerve: 4,
    ability: {
      id: 'hymn',
      name: 'Hymn',
      text: 'Heal every hero 5 HP and lower everyone\'s stress by 4.',
      cooldown: 3,
      kind: 'healAll',
      power: 5,
      relief: 4,
    },
    flaw: 'choir',
    cost: 60,
  },
  ivy: {
    id: 'ivy',
    name: 'Ivy Marsh',
    epithet: 'The Asylum Escapee',
    sigil: '❋',
    flavour: 'She was not mad when they took her in. She is less certain now.',
    hp: 17,
    might: 5,
    guard: 1,
    wit: 6,
    nerve: 5,
    ability: {
      id: 'frenzy',
      name: 'Frenzy',
      text: 'Strike three times for 4 damage each, split randomly among the horrors.',
      cooldown: 3,
      kind: 'frenzy',
      power: 4,
      hits: 3,
    },
    flaw: 'fractured',
    cost: 65,
  },
};

export const STARTING_HEROES = ['vance', 'rook', 'wren', 'quill', 'tallow', 'crain'];
export const CANDIDATE_POOL = ['agnes', 'otho', 'silas', 'nessa', 'anselm', 'ivy'];

export const FLAWS = {
  habit: {
    name: 'Morphine Habit',
    text: 'Gains 6 stress whenever an ally falls.',
    allyDownStress: 6,
  },
  bottle: {
    name: 'The Bottle',
    text: 'Begins every fight with 8 stress.',
    combatStartStress: 8,
  },
  morbid: {
    name: 'Morbid Fascination',
    text: 'Gains 3 stress on every floor descended.',
    floorStress: 3,
  },
  veil: {
    name: 'The Veil Thins',
    text: 'Begins every fight with 3 stress per horror present.',
    veilStress: 3,
  },
  tooYoung: {
    name: 'Too Young for This',
    text: 'If he falls, every other hero gains 6 stress.',
    young: true,
  },
  grief: {
    name: 'Grief-Mad',
    text: 'Gains 5 stress when an ally falls. Gains 2 Might while an ally is down.',
    allyDownStress: 5,
    griefMight: 2,
  },
  penitent: {
    name: 'Penitent',
    text: 'Takes 2 extra damage from every horror attack.',
    damageTaken: 2,
  },
  hubris: {
    name: 'Hubris',
    text: 'Guard is 2 lower.',
    guardMod: -2,
  },
  shellshock: {
    name: 'Shell-Shock',
    text: 'Begins every fight with 7 stress.',
    combatStartStress: 7,
  },
  coward: {
    name: "Coward's Eye",
    text: 'Loses 2 Might while below half health.',
    lowHpMight: 2,
  },
  choir: {
    name: 'Choir-Touched',
    text: 'Begins every fight with 6 stress.',
    combatStartStress: 6,
  },
  fractured: {
    name: 'Fractured',
    text: 'Begins every fight with 10 stress.',
    combatStartStress: 10,
  },
};

export const DREADS = [
  {
    id: 'shakes',
    name: 'The Shakes',
    text: 'Might is 2 lower.',
    mods: { might: -2 },
  },
  {
    id: 'sleepless',
    name: 'Sleepless Nights',
    text: 'Every fight begins with 6 stress.',
    combatStartStress: 6,
  },
  {
    id: 'dark',
    name: 'Fear of the Dark',
    text: 'Gains 2 stress per step while the lamp is low.',
    lowOilStress: 2,
  },
  {
    id: 'pull',
    name: 'The Pull',
    text: 'Some steps cost 2 extra lamp oil.',
    moveOilChance: 0.18,
  },
  {
    id: 'guilt',
    name: 'Whispering Guilt',
    text: 'All stress gains are 25% higher.',
    stressMult: 0.25,
  },
  {
    id: 'counting',
    name: 'Compulsion to Count',
    text: 'Guard is 2 lower.',
    mods: { guard: -2 },
  },
  {
    id: 'weeping',
    name: 'The Weeping',
    text: 'Gains 6 stress after every fight.',
    combatEndStress: 6,
  },
  {
    id: 'hollow',
    name: 'Hollowed',
    text: 'Begins every expedition with 15 stress.',
    expeditionStress: 15,
  },
];

export const INJURIES = [
  {
    id: 'ribs',
    name: 'Cracked Ribs',
    text: 'Max HP is 4 lower.',
    mods: { maxHp: -4 },
  },
  {
    id: 'cut',
    name: 'Deep Cut',
    text: 'Might is 1 lower.',
    mods: { might: -1 },
  },
  {
    id: 'skull',
    name: 'Bruised Skull',
    text: 'Wit is 2 lower.',
    mods: { wit: -2 },
  },
  {
    id: 'shoulder',
    name: 'Torn Shoulder',
    text: 'Guard is 1 lower.',
    mods: { guard: -1 },
  },
  {
    id: 'knee',
    name: 'Bad Knee',
    text: 'Some steps cost 1 extra lamp oil.',
    moveOilChance: 0.15,
  },
  {
    id: 'blood',
    name: 'Bad Blood',
    text: 'Loses 2 HP at the start of each week.',
    weekDamage: 2,
  },
];

export const ITEMS = {
  bandages: {
    id: 'bandages',
    name: 'Bandages',
    glyph: '✚',
    text: 'Heal the most wounded hero 10 HP.',
    cost: 20,
  },
  laudanum: {
    id: 'laudanum',
    name: 'Laudanum',
    glyph: '⌁',
    text: 'Lower one hero\'s stress by 30. Taken at the house.',
    cost: 26,
  },
  oil: {
    id: 'oil',
    name: 'Lamp Oil',
    glyph: '◍',
    text: 'Add 45 oil to the lamp during a descent.',
    cost: 16,
  },
};

export const ENEMIES = {
  shade: {
    name: 'Crawling Shade',
    glyph: '◒',
    hp: 12,
    might: 3,
    guard: 0,
    stress: 4,
    xp: 5,
    coin: [3, 6],
    flavour: 'It moves like a stain looking for a wall.',
  },
  husk: {
    name: 'Salt Husk',
    glyph: '▤',
    hp: 19,
    might: 4,
    guard: 2,
    stress: 3,
    xp: 6,
    coin: [5, 8],
    flavour: 'A person, dried and pressed flat, still walking.',
  },
  child: {
    name: 'Drowned Child',
    glyph: '◌',
    hp: 11,
    might: 2,
    guard: 0,
    stress: 6,
    xp: 5,
    coin: [2, 5],
    flavour: 'It asks for its mother in your voice.',
  },
  cultist: {
    name: 'Choir Cultist',
    glyph: '♆',
    hp: 15,
    might: 4,
    guard: 1,
    stress: 7,
    xp: 7,
    coin: [6, 10],
    trait: 'incant',
    flavour: 'Robes wet to the knee. It has been wading toward something for years.',
  },
  wretch: {
    name: 'Gill Wretch',
    glyph: '♒',
    hp: 15,
    might: 4,
    guard: 1,
    stress: 4,
    xp: 7,
    coin: [5, 9],
    trait: 'swift',
    flavour: 'Too many joints, arranged in the wrong order.',
  },
  stag: {
    name: 'Bone-Antler Stag',
    glyph: '♞',
    hp: 23,
    might: 6,
    guard: 2,
    stress: 5,
    xp: 9,
    coin: [8, 13],
    trait: 'charge',
    flavour: 'Its antlers are the ribs of something much larger.',
  },
  revenant: {
    name: 'Bloated Revenant',
    glyph: '◍',
    hp: 21,
    might: 5,
    guard: 1,
    stress: 6,
    xp: 9,
    coin: [7, 12],
    trait: 'burster',
    flavour: 'It is full of a tide that wants out.',
  },
  choir: {
    name: 'Hollow Choir',
    glyph: '♬',
    hp: 27,
    might: 6,
    guard: 2,
    stress: 7,
    xp: 11,
    coin: [10, 15],
    trait: 'regen',
    flavour: 'Six mouths, one hymn, no faces.',
  },
};

export const BOSS = {
  id: 'unnamed',
  name: 'The Unnamed Below',
  glyph: 'Ω',
  hp: 120,
  might: 10,
  guard: 3,
  stress: 9,
  xp: 60,
  coin: [80, 120],
  trait: 'boss',
  flavour: 'It has your house\'s dimensions. It is wearing them badly.',
};

export const ENEMY_POOLS = [
  ['shade', 'husk', 'child'],
  ['shade', 'child', 'cultist', 'husk'],
  ['cultist', 'wretch', 'child', 'stag'],
  ['wretch', 'stag', 'cultist', 'revenant'],
  ['stag', 'revenant', 'choir', 'wretch'],
  ['choir', 'revenant', 'stag'],
];

export const OMENS = [
  'Something unfolds out of the dark.',
  'The lamp finds it first. It does not seem to mind.',
  'It has been waiting with the patience of furniture.',
  'You hear your own name, badly pronounced.',
  'The air goes tight, like a held breath.',
  'It turns toward the light with terrible familiarity.',
];

export const LORES = [
  {
    id: 'ledger',
    title: 'The Waterlogged Ledger',
    text: 'Every page lists your family name. The entries continue for another ninety years. Most of them are written in your hand.',
    boon: 'stress',
    amount: 8,
    boonText: 'A terrible certainty steadies them. Everyone loses 8 stress.',
  },
  {
    id: 'drawing',
    title: "A Child's Drawing",
    text: 'Four figures and a lantern, drawn in something brown. There is a fifth figure behind them with too many arms, holding all four by the hand.',
    boon: 'coin',
    amount: 16,
    boonText: 'Folded inside the paper is a coin purse with 16 coin.',
  },
  {
    id: 'mason',
    title: "The Mason's Note",
    text: 'The builder left a line scratched into a brick: IT DOES NOT WANT OUT. IT WANTS DOWN. The chisel is still warm.',
    boon: 'xp',
    amount: 7,
    boonText: 'The party understands the house a little better. Everyone gains 7 XP.',
  },
  {
    id: 'ring',
    title: 'A Wedding Ring',
    text: 'The inside of the band is engraved with your initials. You have never seen it before. It fits the gravedigger perfectly.',
    boon: 'coin',
    amount: 20,
    boonText: 'The ring sells in Halloway for 20 coin. Nobody asks where it came from.',
  },
  {
    id: 'bible',
    title: 'The Salt Bible',
    text: 'Every page after Genesis is blank. The margins are full of small fingerprints, all pointing down.',
    boon: 'stress',
    amount: 6,
    boonText: 'Reading the pointing marks quiets the hum. Everyone loses 6 stress.',
  },
  {
    id: 'bell',
    title: 'A Bell With No Clapper',
    text: 'It rings when the lamp passes. The note is below hearing, but the heroes all flinch at the same moment.',
    boon: 'oil',
    amount: 15,
    boonText: 'The bell sweats a clear oil. The lamp takes 15 oil.',
  },
  {
    id: 'map',
    title: "The Surveyor's Map",
    text: 'The cellar is drawn eleven times, each one deeper than the last. In the final drawing, the house at 14 Halloway Street is a small shape on the roof of something enormous.',
    boon: 'xp',
    amount: 6,
    boonText: 'The map shows a way around the worst of it. Everyone gains 6 XP.',
  },
  {
    id: 'letter',
    title: 'The Unfinished Letter',
    text: '"...and if you are reading this, do not answer when it uses my" — the rest is water. It is your handwriting.',
    boon: 'stress',
    amount: 4,
    boonText: 'Someone folds it away. Everyone loses 4 stress.',
  },
  {
    id: 'photo',
    title: 'A Photograph',
    text: 'The house at Halloway Street, photographed before it was built. Six figures stand on the empty lot. One is holding a lamp.',
    boon: 'coin',
    amount: 18,
    boonText: 'A collector on the surface pays 18 coin for it, no questions.',
  },
];

export const SHRINE = {
  title: 'A Shrine of the Drowned Choir',
  text: 'A bowl of black water sits on a salt-caked plinth. The humming stops when the lamp comes close, the way a room goes quiet when an adult enters.',
  options: [
    {
      id: 'kneel',
      label: 'Kneel in the wet',
      text: 'Everyone loses 12 stress.',
    },
    {
      id: 'take',
      label: 'Take the offering',
      text: 'Gain 20 coin; everyone gains 6 stress.',
    },
    {
      id: 'break',
      label: 'Overturn the bowl',
      text: 'Gain a random supply; everyone gains 10 stress.',
    },
  ],
};

export const CACHE_FLAVOUR = [
  'A tin of sovereigns, wrapped in oilcloth.',
  'A leather satchel that was not there a moment ago.',
  'A purse of drowned coins, still wet.',
  'A strongbox with no lock, only teeth marks.',
  'A hatbox full of buttons and one gold tooth.',
];

export const TRAP_FLAVOUR = [
  'A snare of wet rope snaps tight around an ankle.',
  'A salt-crusted plate gives under a boot.',
  'A bell-wire strung low in the dark sings once.',
  'The floor tilts and something metal is drawn across a shin.',
];

export const FIGHT_AFTERMATH = [
  'The lamp steadies. The heroes do not.',
  'The humming resumes, a little disappointed.',
  'Something in the walls takes a long, slow step away.',
  'The dark closes over what is left of it.',
];

export const WITHDRAW_LINES = [
  'You pull them back up the stair while the lamp still has a voice.',
  'The cellar lets them go. It does not seem worried.',
  'They climb toward the thin daylight under the cellar door.',
];

export function heroTemplate(id) {
  return HEROES[id] || null;
}

export function flawOf(hero) {
  return FLAWS[hero.flaw] || null;
}

export function dreadById(id) {
  return DREADS.find((dread) => dread.id === id) || null;
}

export function injuryById(id) {
  return INJURIES.find((injury) => injury.id === id) || null;
}
