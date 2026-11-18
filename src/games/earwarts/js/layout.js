/** Castle floor plan, collision boxes, barriers and interaction points. */

export const ROOM_ZONES = {
  'great-hall': { id: 'great-hall', x: 0, z: 0, halfW: 13, halfD: 10 },
  'spellcasting-tower': { id: 'spellcasting-tower', x: 0, z: -42, halfW: 9, halfD: 9 },
  'creature-gardens': { id: 'creature-gardens', x: 42, z: 0, halfW: 11, halfD: 10 },
  'potion-dungeon': { id: 'potion-dungeon', x: -42, z: 0, halfW: 11, halfD: 10 },
  'rhythm-forest': { id: 'rhythm-forest', x: 0, z: 42, halfW: 11, halfD: 10 },
  'piano-parlour': { id: 'piano-parlour', x: 0, z: 84, halfW: 11, halfD: 10 },
};

export const CORRIDORS = [
  { id: 'corridor-north', x: 0, z: -21.5, halfW: 3, halfD: 11.5 },
  { id: 'corridor-south', x: 0, z: 21, halfW: 3, halfD: 11 },
  { id: 'corridor-east', x: 22, z: 0, halfW: 9, halfD: 3 },
  { id: 'corridor-west', x: -22, z: 0, halfW: 9, halfD: 3 },
  { id: 'corridor-parlour', x: 0, z: 63, halfW: 3, halfD: 11 },
];

export const SPAWN = { x: 0, z: 7.5 };
export const FLOOR_ZONES = [...Object.values(ROOM_ZONES), ...CORRIDORS];

const wall = (x, z, w, d) => ({ x, z, w, d });

export const WALLS = [
  wall(-8, -10, 10, 1),
  wall(8, -10, 10, 1),
  wall(-8, 10, 10, 1),
  wall(8, 10, 10, 1),
  wall(-13, -6.5, 1, 7),
  wall(-13, 6.5, 1, 7),
  wall(13, -6.5, 1, 7),
  wall(13, 6.5, 1, 7),

  wall(-6, -33, 6, 1),
  wall(6, -33, 6, 1),
  wall(0, -51, 18, 1),
  wall(-9, -42, 1, 18),
  wall(9, -42, 1, 18),

  wall(31, -6.5, 1, 7),
  wall(31, 6.5, 1, 7),
  wall(53, 0, 1, 20),
  wall(42, -10, 22, 1),
  wall(42, 10, 22, 1),

  wall(-31, -6.5, 1, 7),
  wall(-31, 6.5, 1, 7),
  wall(-53, 0, 1, 20),
  wall(-42, -10, 22, 1),
  wall(-42, 10, 22, 1),

  wall(-7, 32, 8, 1),
  wall(7, 32, 8, 1),
  wall(-7, 52, 8, 1),
  wall(7, 52, 8, 1),
  wall(-11, 42, 1, 20),
  wall(11, 42, 1, 20),

  wall(-3, 63, 1, 22),
  wall(3, 63, 1, 22),
  wall(-8, 74, 10, 1),
  wall(8, 74, 10, 1),
  wall(-11, 84, 1, 20),
  wall(11, 84, 1, 20),
  wall(0, 94, 22, 1),

  wall(-3, -21.5, 1, 23),
  wall(3, -21.5, 1, 23),
  wall(-3, 21, 1, 22),
  wall(3, 21, 1, 22),
  wall(22, -3, 18, 1),
  wall(22, 3, 18, 1),
  wall(-22, -3, 18, 1),
  wall(-22, 3, 18, 1),
];

export const BARRIERS = [
  { room: 'creature-gardens', x: 30.5, z: 0, rotationY: Math.PI / 2 },
  { room: 'potion-dungeon', x: -30.5, z: 0, rotationY: Math.PI / 2 },
  { room: 'rhythm-forest', x: 0, z: 31.5, rotationY: 0 },
  { room: 'piano-parlour', x: 0, z: 52, rotationY: 0 },
];

export const INTERACTIONS = [
  {
    id: 'headmistress',
    room: 'great-hall',
    x: 0,
    z: -5.5,
    kind: 'npc',
    label: 'Speak with Headmistress Morrow',
    radius: 3.2,
    npcKey: 'headmistress',
  },
  {
    id: 'quest-board',
    room: 'great-hall',
    x: -7.5,
    z: -6.5,
    kind: 'quests',
    label: 'Read the quest scrolls',
    radius: 3,
  },
  {
    id: 'map-table',
    room: 'great-hall',
    x: -7.5,
    z: 5.5,
    kind: 'map',
    label: 'Study the castle map',
    radius: 3,
  },
  {
    id: 'house-banner',
    room: 'great-hall',
    x: 7.5,
    z: -6.5,
    kind: 'banner',
    label: 'Look at your house banner',
    radius: 3,
  },
  {
    id: 'pitch-crystal',
    room: 'spellcasting-tower',
    x: 0,
    z: -43,
    kind: 'challenge',
    label: 'Touch the Pitch Crystal',
    radius: 3.2,
    skill: 'pitch',
    title: 'Pitch Crystal',
  },
  {
    id: 'melody-crystal',
    room: 'spellcasting-tower',
    x: 6,
    z: -46.5,
    kind: 'challenge',
    label: 'Wake the Melody Crystal',
    radius: 3,
    skill: 'melody',
    requiresResonance: 55,
    title: 'Melody Crystal',
  },
  {
    id: 'archmage',
    room: 'spellcasting-tower',
    x: -6,
    z: -43,
    kind: 'npc',
    label: 'Talk to Archmage Tilly',
    radius: 3,
    npcKey: 'archmage',
  },
  {
    id: 'interval-pedestal',
    room: 'creature-gardens',
    x: 42,
    z: 0,
    kind: 'challenge',
    label: 'Listen to the Creature Choir',
    radius: 3.2,
    skill: 'interval',
    title: 'Creature Choir',
  },
  {
    id: 'keeper',
    room: 'creature-gardens',
    x: 46,
    z: -4,
    kind: 'npc',
    label: 'Talk to Keeper Fern',
    radius: 3,
    npcKey: 'keeper',
  },
  {
    id: 'harmony-cauldron',
    room: 'potion-dungeon',
    x: -42,
    z: 0,
    kind: 'challenge',
    label: 'Stir the Harmony Cauldron',
    radius: 3.2,
    skill: 'harmony',
    title: 'Harmony Cauldron',
  },
  {
    id: 'potionmaster',
    room: 'potion-dungeon',
    x: -46,
    z: -4,
    kind: 'npc',
    label: 'Talk to Master Bramble',
    radius: 3,
    npcKey: 'potionmaster',
  },
  {
    id: 'rhythm-drum',
    room: 'rhythm-forest',
    x: 0,
    z: 42,
    kind: 'challenge',
    label: 'Echo the Forest Drum',
    radius: 3.2,
    skill: 'rhythm',
    title: 'Forest Drum',
  },
  {
    id: 'spirit',
    room: 'rhythm-forest',
    x: -3,
    z: 46,
    kind: 'npc',
    label: 'Speak with the Mosslight Spirit',
    radius: 3,
    npcKey: 'spirit',
  },
  {
    id: 'piano-keys',
    room: 'piano-parlour',
    x: 0,
    z: 84,
    kind: 'challenge',
    label: 'Sit at the Singing Piano',
    radius: 3.2,
    skill: 'perfect',
    title: 'The Singing Piano',
  },
  {
    id: 'maestro',
    room: 'piano-parlour',
    x: 5,
    z: 80.5,
    kind: 'npc',
    label: 'Talk to Maestro Cadence',
    radius: 3,
    npcKey: 'maestro',
  },
  ...BARRIERS.map((barrier) => ({
    id: `door-${barrier.room}`,
    room: 'great-hall',
    x: barrier.x,
    z: barrier.z,
    kind: 'door',
    label: 'Peek through the sealed door',
    radius: 3.4,
    targetRoom: barrier.room,
  })),
];

export function roomAt(x, z) {
  for (const [id, zone] of Object.entries(ROOM_ZONES)) {
    if (Math.abs(x - zone.x) <= zone.halfW + 1 && Math.abs(z - zone.z) <= zone.halfD + 1) {
      return id;
    }
  }
  return null;
}

export function isInsideAnyZone(x, z) {
  return FLOOR_ZONES.some(
    (zone) => Math.abs(x - zone.x) <= zone.halfW + 0.4 && Math.abs(z - zone.z) <= zone.halfD + 0.4
  );
}

export function nearbyInteraction(x, z, limit = 99) {
  let closest = null;
  let closestDistance = limit;
  for (const point of INTERACTIONS) {
    const distance = Math.hypot(x - point.x, z - point.z);
    if (distance <= point.radius && distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  }
  return closest;
}

export const ROOM_CENTERS = {
  'great-hall': { x: 0, z: 0 },
  'spellcasting-tower': { x: 0, z: -42 },
  'creature-gardens': { x: 42, z: 0 },
  'potion-dungeon': { x: -42, z: 0 },
  'rhythm-forest': { x: 0, z: 42 },
  'piano-parlour': { x: 0, z: 84 },
};
