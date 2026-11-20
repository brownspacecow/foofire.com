import { ROOMS } from './content.js';

export const RESONANCE_PER_LEVEL = 100;

export function levelFor(resonance) {
  return 1 + Math.floor(resonance / RESONANCE_PER_LEVEL);
}

export function levelProgress(resonance) {
  return { current: resonance % RESONANCE_PER_LEVEL, needed: RESONANCE_PER_LEVEL };
}

export function difficultyFor(skill, stats) {
  return Math.min(4, 1 + Math.floor((stats[skill] ?? 0) / 3));
}

export function unlockedRoomsFor(resonance, current) {
  const next = new Set(current);
  for (const room of ROOMS) {
    if (room.threshold <= resonance) next.add(room.id);
  }
  return ROOMS.map((room) => room.id).filter((id) => next.has(id));
}

export function newlyUnlockedRooms(resonance, current) {
  return ROOMS.filter(
    (room) => room.threshold > 0 && room.threshold <= resonance && !current.includes(room.id)
  );
}

export function nextLockedRoom(save) {
  return ROOMS.find((room) => room.threshold > save.resonance);
}

export function resonanceReward(skill, difficulty, retries) {
  const base = 10 + difficulty * 2;
  const composure = Math.max(1, 3 - retries);
  const skillBonus = skill === 'melody' ? 1 : 0;
  return base + composure + skillBonus;
}
