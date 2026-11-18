/**
 * Content for Earwarts Academy: houses, rooms, spells, quests and the words
 * the castle's residents say. Plain data, no build step.
 */

export const HOUSES = [
  {
    id: 'phoenix',
    name: 'Phoenix',
    motto: 'Rise, and rise again',
    color: '#f2a65a',
    glow: '#ffd79a',
    sigil: '✦',
    blurb: 'Brave hearts, warm hearths, and a song for every sunrise.',
  },
  {
    id: 'dragon',
    name: 'Dragon',
    motto: 'Keep the fire kind',
    color: '#78c79a',
    glow: '#b7f0c9',
    sigil: '◆',
    blurb: 'Steady courage and a hoard of good ideas.',
  },
  {
    id: 'owl',
    name: 'Owl',
    motto: 'Listen twice, wonder often',
    color: '#b6a3f5',
    glow: '#ded2ff',
    sigil: '◉',
    blurb: 'Night thinkers, quiet listeners, excellent note-keepers.',
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    motto: 'Make the ordinary strange',
    color: '#8fd3f4',
    glow: '#d5f1ff',
    sigil: '✧',
    blurb: 'Dreamers who find secret doors in ordinary walls.',
  },
];

export const SPELLS = [
  {
    id: 'lumina',
    name: 'Lumina',
    description: 'A small sun blooms above your wand.',
    effect: 'Lights the room around you.',
    unlocked: true,
    icon: '☀',
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'The castle repeats the last sound it heard.',
    effect: 'Replays the last magical phrase.',
    unlocked: true,
    icon: '◎',
  },
  {
    id: 'floris',
    name: 'Floris',
    description: 'Moonflowers wake wherever you stand.',
    effect: 'Grows a ring of glowing flowers.',
    unlocked: false,
    icon: '❀',
  },
  {
    id: 'leviosa',
    name: 'Leviosa',
    description: 'A feather of wind lifts what is nearby.',
    effect: 'Floats a nearby crate in the air.',
    unlocked: false,
    icon: '↑',
  },
];

export const PETS = [
  {
    id: 'baby-owl',
    name: 'Pip',
    species: 'Baby Owl',
    description: 'A pocket-sized owl who hums along to every spell.',
    icon: '🦉',
  },
];

export const COSMETICS = [
  {
    id: 'star-scarf',
    name: 'Starry Scarf',
    description: "Pip's neckwear, woven from a little piece of night sky.",
    icon: '★',
  },
  {
    id: 'moon-crown',
    name: 'Moonpetal Crown',
    description: 'A tiny crown of silver petals. Worn by owls of excellent taste.',
    icon: '☾',
  },
];

export const ROOMS = [
  {
    id: 'great-hall',
    name: 'The Great Hall',
    shortName: 'Great Hall',
    icon: '♛',
    accent: '#f2ce7b',
    threshold: 0,
    skill: null,
    studentLine: 'House banners, hot cocoa, and the Quest Board.',
    description:
      'The heart of the castle. Headmistress Morrow keeps the fires lit and the quest scrolls handy.',
  },
  {
    id: 'spellcasting-tower',
    name: 'The Spellcasting Tower',
    shortName: 'Tower',
    icon: '✦',
    accent: '#a99bff',
    threshold: 0,
    skill: 'pitch',
    studentLine: 'Crystals that hum higher and lower.',
    description:
      'A spiral room full of listening crystals. A spell will not answer a wand until it recognises the voice.',
  },
  {
    id: 'creature-gardens',
    name: 'The Creature Gardens',
    shortName: 'Gardens',
    icon: '❀',
    accent: '#8fe0a8',
    threshold: 30,
    skill: 'interval',
    studentLine: 'Moonmoths, pond dragons, and leaps of sound.',
    description:
      'Every creature here speaks in a jump between two notes. Learn their leaps and they will follow you home.',
  },
  {
    id: 'potion-dungeon',
    name: 'The Potion Dungeon',
    shortName: 'Dungeon',
    icon: '⚗',
    accent: '#7fd6c9',
    threshold: 75,
    skill: 'harmony',
    studentLine: 'Bubbling cauldrons and chords with moods.',
    description:
      'Down the mossy stairs, the cauldrons answer to harmony. A happy potion and a gloomy potion sound very different.',
  },
  {
    id: 'rhythm-forest',
    name: 'The Rhythm Forest',
    shortName: 'Forest',
    icon: '♣',
    accent: '#b9d87d',
    threshold: 130,
    skill: 'rhythm',
    studentLine: 'The trees keep time; the fireflies keep secrets.',
    description:
      'Deep in the castle grounds, the forest drums a heartbeat. Echo it back and the trees will open the last gate.',
  },
];

export const QUESTS = [
  {
    id: 'lost-scroll',
    title: 'The Lost Spell Scroll',
    giver: 'Headmistress Morrow',
    room: 'great-hall',
    summary:
      'A spell scroll blew into the tower and got stuck between the listening crystals. Three successful pitch spells should coax it loose.',
    objective: { skill: 'pitch', count: 3 },
    reward: { spell: 'floris', resonance: 15, label: 'Learned the spell Floris' },
  },
  {
    id: 'owl-feather',
    title: "Pip's Lucky Feather",
    giver: 'Keeper Fern',
    room: 'creature-gardens',
    summary:
      'Pip lost a lucky feather near the moonmoths. Win three interval challenges and the creatures will help look for it.',
    objective: { skill: 'interval', count: 3 },
    reward: { cosmetic: 'star-scarf', resonance: 15, label: 'Found the Starry Scarf' },
  },
  {
    id: 'courage-potion',
    title: 'A Splash of Courage',
    giver: 'Master Bramble',
    room: 'potion-dungeon',
    summary:
      'The cauldron needs one more flavour: courage. Win three harmony challenges and the potion will finally turn gold.',
    objective: { skill: 'harmony', count: 3 },
    reward: { spell: 'leviosa', resonance: 15, label: 'Learned the spell Leviosa' },
  },
  {
    id: 'forest-harmony',
    title: 'Forest Harmony',
    giver: 'The Mosslight Spirit',
    room: 'rhythm-forest',
    summary:
      'The forest has forgotten its own heartbeat. Echo its drum patterns four times to teach it the rhythm again.',
    objective: { skill: 'rhythm', count: 4 },
    reward: { cosmetic: 'moon-crown', resonance: 25, label: 'The forest crowned Pip' },
  },
];

export const TUTORIAL_LINES = [
  {
    speaker: 'Headmistress Morrow',
    text: 'Ah, there you are. Welcome to Earwarts Academy — a castle that only opens for people who know how to listen.',
  },
  {
    speaker: 'Headmistress Morrow',
    text: 'Move with W A S D, or the arrow keys. On a touch screen, use the little star pad in the corner. Hold Shift to hurry.',
  },
  {
    speaker: 'Headmistress Morrow',
    text: 'Walk up to something glowy and press E — or tap the sparkling button — to talk, read, or touch a crystal.',
  },
  {
    speaker: 'Headmistress Morrow',
    text: 'Your magic grows by listening. The crystals in the north tower are humming. Start there, and the castle will open itself to you.',
  },
];

export const DIALOGUES = {
  headmistress: [
    {
      speaker: 'Headmistress Morrow',
      text: 'Quests live on the board beside me. They are not homework — they are little excuses to wander somewhere new.',
      face: '♛',
    },
    {
      speaker: 'Headmistress Morrow',
      text: 'Magic Resonance collects when a spell answers you. When enough gathers, the sealed wings of the castle wake up. Watch the golden meter at the top of your vision.',
      face: '♛',
    },
    {
      speaker: 'Headmistress Morrow',
      text: 'And when you need a rest, the map table on the other side of the hall knows every wing.',
      face: '♛',
    },
  ],
  archmage: [
    {
      speaker: 'Archmage Tilly',
      text: 'The tower listens for pitch — whether a note climbs, falls, or stays exactly where it was. Nothing to name, nothing to spell. Just your ears.',
      face: '✦',
    },
    {
      speaker: 'Archmage Tilly',
      text: 'Touch a crystal, listen, and answer. If it wobbles, listen again. The castle has all night.',
      face: '✦',
    },
  ],
  keeper: [
    {
      speaker: 'Keeper Fern',
      text: 'The creatures speak in leaps: a tiny hop, a brave stride, a whole octave in one bound. Listen to the distance between the two notes.',
      face: '❀',
    },
    {
      speaker: 'Keeper Fern',
      text: 'They are shy, not strict. Answer badly and they simply hide behind a fern until you try again.',
      face: '❀',
    },
  ],
  potionmaster: [
    {
      speaker: 'Master Bramble',
      text: 'Chords have moods, apprentice. A major chord opens a window. A minor chord opens a door to somewhere better left softly shut.',
      face: '⚗',
    },
    {
      speaker: 'Master Bramble',
      text: 'Seventh chords are more complicated — a little sweet, a little curious. You will hear the difference before you can explain it.',
      face: '⚗',
    },
  ],
  spirit: [
    {
      speaker: 'The Mosslight Spirit',
      text: 'Boom. Bo-boom. The forest is a drum that forgot its song. Listen for the empty spaces as much as the taps.',
      face: '♣',
    },
    {
      speaker: 'The Mosslight Spirit',
      text: 'You may echo slowly. The trees are patient, and every pattern can be heard again as many times as you need.',
      face: '♣',
    },
  ],
};

export const HOUSE_OF = (id) => HOUSES.find((house) => house.id === id);
export const SPELL_OF = (id) => SPELLS.find((spell) => spell.id === id);
export const ROOM_OF = (id) => ROOMS.find((room) => room.id === id);

export const SKILL_LABELS = {
  pitch: {
    name: 'Pitch',
    icon: '↑',
    colour: '#a99bff',
    line: 'Higher, lower, same, or leaping.',
  },
  interval: {
    name: 'Intervals',
    icon: '↗',
    colour: '#8fe0a8',
    line: 'The distance between two notes.',
  },
  rhythm: {
    name: 'Rhythm',
    icon: '∿',
    colour: '#b9d87d',
    line: 'Echo the forest drum.',
  },
  melody: {
    name: 'Melody',
    icon: '♫',
    colour: '#f2ce7b',
    line: 'Hear the shape of a tune.',
  },
  harmony: {
    name: 'Harmony',
    icon: '◉',
    colour: '#7fd6c9',
    line: 'The mood inside a chord.',
  },
};

export const ACHIEVEMENTS = [
  {
    id: 'first-spell',
    title: 'First Spark',
    description: 'Win your very first listening challenge.',
    check: (save) =>
      Object.values(save.challengeStats).reduce((sum, value) => sum + value, 0) >= 1,
  },
  {
    id: 'tower-friend',
    title: 'Crystal Friend',
    description: 'Win three pitch challenges in the tower.',
    check: (save) => save.challengeStats.pitch >= 3,
  },
  {
    id: 'garden-whisperer',
    title: 'Garden Whisperer',
    description: 'Win three interval challenges in the gardens.',
    check: (save) => save.challengeStats.interval >= 3,
  },
  {
    id: 'owl-bond',
    title: 'Owl Bond',
    description: 'Earn 40 Magic Resonance with Pip at your side.',
    check: (save) => save.unlockedPets.length > 0 && save.resonance >= 40,
  },
  {
    id: 'castle-explorer',
    title: 'Every Wing',
    description: 'Unlock every room in the castle.',
    check: (save) => save.unlockedRooms.length >= ROOMS.length,
  },
  {
    id: 'harmonist',
    title: 'Forest Drummer',
    description: 'Echo five forest rhythms.',
    check: (save) => save.challengeStats.rhythm >= 5,
  },
];
