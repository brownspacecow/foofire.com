import { audioEngine, earTraining } from './audio.js';
import {
  DIALOGUES,
  HOUSE_OF,
  ROOM_OF,
  SPELL_OF,
  TUTORIAL_LINES,
} from './content.js';
import {
  difficultyFor,
  levelFor,
  newlyUnlockedRooms,
  resonanceReward,
  unlockedRoomsFor,
} from './progression.js';
import { applyQuestCompletions } from './quests.js';
import { checkAchievements } from './achievements.js';
import { saveSystem } from './save.js';
import { createDefaultSave } from './save.js';
import { INTERACTIONS } from './layout.js';
import { resetPlayer, worldState } from './world/state.js';

export const state = {
  save: createDefaultSave(),
  ready: false,
  recovered: false,
  panel: 'none',
  dialogue: null,
  challenge: null,
  nearbyId: null,
  currentRoom: 'great-hall',
  toasts: [],
  spellCast: null,
};

const listeners = new Set();
let loaded = false;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(state);
}

function update(patch) {
  Object.assign(state, patch);
  emit();
}

export function getState() {
  return state;
}

function pushToasts(items) {
  if (items.length === 0) return;
  const entries = items.map((item, index) => ({
    ...item,
    id: `toast-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  }));
  update({ toasts: [...state.toasts, ...entries] });
  for (const entry of entries) {
    setTimeout(() => dismissToast(entry.id), 8000);
  }
}

function showDialogue(lines) {
  update({ dialogue: lines, panel: 'none' });
}

export async function loadGame() {
  if (loaded) return;
  loaded = true;
  const result = await saveSystem.load();
  audioEngine.applySettings(result.save.audio.volume, result.save.audio.muted);
  resetPlayer();
  update({
    save: result.save,
    ready: true,
    recovered: result.recovered,
    currentRoom: 'great-hall',
    panel: 'none',
    dialogue: null,
    challenge: null,
  });
  if (result.recovered) {
    pushToasts([
      {
        title: 'The castle mended your scroll',
        text: 'Your old save was damaged, so a fresh one was written. A backup was tucked away just in case.',
        icon: '✎',
        tone: 'violet',
      },
    ]);
  }
}

export async function startGame(name, house) {
  await audioEngine.init().catch(() => undefined);
  const current = state.save;
  const next = {
    ...current,
    playerName: name.trim().slice(0, 24) || 'Apprentice',
    house,
    tutorialStep: 1,
    unlockedRooms: ['great-hall', 'spellcasting-tower'],
    unlockedSpells: ['lumina', 'echo'],
    updatedAt: new Date().toISOString(),
  };
  resetPlayer();
  update({ save: next, currentRoom: 'great-hall' });
  saveSystem.save(next);
  showDialogue(TUTORIAL_LINES.map((line) => ({ ...line, face: '♛' })));
}

export function persist() {
  saveSystem.save(state.save);
}

export function setPanel(panel) {
  if (panel !== 'none') audioEngine.init().catch(() => undefined);
  update({ panel, dialogue: panel === 'none' ? state.dialogue : null });
}

export function closeDialogue() {
  update({ dialogue: null });
  if (state.save.tutorialStep === 1) {
    const next = { ...state.save, tutorialStep: 99, updatedAt: new Date().toISOString() };
    update({ save: next });
    saveSystem.save(next);
  }
}

export function setNearby(id) {
  if (state.nearbyId !== id) update({ nearbyId: id });
}

export function syncRoom(room) {
  if (state.currentRoom !== room) update({ currentRoom: room });
}

export function nearbyPointById(id) {
  return INTERACTIONS.find((point) => point.id === id);
}

export function interact() {
  if (state.challenge || state.dialogue || state.panel !== 'none') return;
  const point = INTERACTIONS.find((entry) => entry.id === state.nearbyId);
  if (!point) return;
  const save = state.save;

  if (point.kind === 'challenge' && point.skill) {
    if (point.requiresResonance && save.resonance < point.requiresResonance) {
      const room = ROOM_OF(point.room);
      showDialogue([
        {
          speaker: 'The castle whispers',
          text: `This crystal is still asleep. Gather ${point.requiresResonance} Magic Resonance and it will wake. You have ${save.resonance}.`,
          face: room?.icon ?? '✦',
        },
      ]);
      return;
    }
    openChallenge(point.skill, point.room);
    return;
  }

  if (point.kind === 'npc') {
    const lines = point.npcKey ? DIALOGUES[point.npcKey] : undefined;
    if (lines) showDialogue(lines.map((line) => ({ ...line })));
    return;
  }

  if (point.kind === 'quests') {
    update({ panel: 'quests' });
    return;
  }
  if (point.kind === 'map') {
    update({ panel: 'map' });
    return;
  }
  if (point.kind === 'banner') {
    const house = HOUSE_OF(save.house);
    showDialogue([
      {
        speaker: house ? `${house.name} House Banner` : 'A blank banner',
        text: house
          ? `${house.motto}. Your house is purely a costume — everyone here learns the same magic, and everyone's house cheers equally loudly.`
          : 'This banner is waiting for a house. Begin a new adventure to choose one.',
        face: house?.sigil ?? '✦',
      },
    ]);
    return;
  }
  if (point.kind === 'door' && point.targetRoom) {
    const room = ROOM_OF(point.targetRoom);
    if (!room) return;
    if (save.unlockedRooms.includes(room.id)) {
      showDialogue([
        {
          speaker: 'The castle',
          text: `The way to ${room.name} is open. Follow the corridor and see what is humming.`,
          face: room.icon,
        },
      ]);
    } else {
      showDialogue([
        {
          speaker: 'A sealed door',
          text: `${room.name} is still sealed. It will wake at ${room.threshold} Magic Resonance — you have ${save.resonance}. Every listening spell brings it closer.`,
          face: '⌘',
        },
      ]);
    }
  }
}

export function openChallenge(skill, room) {
  audioEngine.init().catch(() => undefined);
  const difficulty = difficultyFor(skill, state.save.challengeStats);
  const point = INTERACTIONS.find((entry) => entry.kind === 'challenge' && entry.skill === skill);
  update({
    challenge: {
      skill,
      room,
      title: point?.title ?? 'Listening Crystal',
      difficulty,
      round: 0,
      completed: false,
    },
    dialogue: null,
    panel: 'none',
  });
}

export function closeChallenge() {
  update({ challenge: null });
}

export function continueChallenge() {
  const session = state.challenge;
  if (!session) return;
  const nextDifficulty = difficultyFor(session.skill, state.save.challengeStats);
  update({
    challenge: {
      ...session,
      difficulty: nextDifficulty,
      round: session.round + 1,
      completed: false,
    },
  });
}

export function completeChallenge(won, retries) {
  const session = state.challenge;
  if (!session || !won || session.completed) {
    return { resonance: 0, quests: [], rooms: [], achievements: [], levelUp: null };
  }
  const before = state.save;
  const reward = resonanceReward(session.skill, session.difficulty, retries);

  let next = {
    ...before,
    challengeStats: {
      ...before.challengeStats,
      [session.skill]: before.challengeStats[session.skill] + 1,
    },
    resonance: before.resonance + reward,
    updatedAt: new Date().toISOString(),
  };
  next.level = levelFor(next.resonance);

  const quests = applyQuestCompletions(next);
  next = quests.save;

  const rooms = newlyUnlockedRooms(next.resonance, next.unlockedRooms);
  next = {
    ...next,
    unlockedRooms: unlockedRoomsFor(next.resonance, next.unlockedRooms),
    level: levelFor(next.resonance),
  };

  const achievements = checkAchievements(next);
  next = achievements.save;

  update({ save: next, challenge: { ...session, completed: true } });
  saveSystem.save(next);

  if (rooms.length > 0) audioEngine.playUnlock().catch(() => undefined);

  pushToasts([
    ...quests.completed.map((quest) => ({
      title: `Quest complete · ${quest.title}`,
      text: quest.reward.label,
      icon: '✧',
      tone: 'gold',
    })),
    ...rooms.map((room) => ({
      title: `A new wing opens · ${room.name}`,
      text: 'The seal has lifted from its door.',
      icon: room.icon,
      tone: 'green',
    })),
    ...achievements.earned.map((achievement) => ({
      title: `Achievement · ${achievement.title}`,
      text: achievement.description,
      icon: '★',
      tone: 'violet',
    })),
  ]);

  return {
    resonance: reward,
    quests: quests.completed.map((quest) => ({
      title: quest.title,
      reward: quest.reward.label,
    })),
    rooms: rooms.map((room) => ({ name: room.name, icon: room.icon })),
    achievements: achievements.earned.map((achievement) => ({
      title: achievement.title,
      description: achievement.description,
    })),
    levelUp: next.level > before.level ? next.level : null,
  };
}

export function castSpell(id) {
  const save = state.save;
  if (!save.unlockedSpells.includes(id)) {
    const spell = SPELL_OF(id);
    pushToasts([
      {
        title: `${spell?.name ?? 'That spell'} is still hidden`,
        text: 'Finish quests and listen closely. Spells arrive when they are ready.',
        icon: '✦',
        tone: 'violet',
      },
    ]);
    return;
  }
  if (state.challenge) return;
  update({
    spellCast: {
      id,
      at: Date.now(),
      x: worldState.player.x,
      z: worldState.player.z,
    },
  });
  audioEngine.playSpell(id).catch(() => undefined);
  if (id === 'echo') earTraining.replay().catch(() => undefined);
}

export function updateAudio(settings) {
  const next = {
    ...state.save,
    audio: { ...state.save.audio, ...settings },
  };
  update({ save: next });
  audioEngine.applySettings(next.audio.volume, next.audio.muted);
  saveSystem.save(next);
}

export function setCaptions(captions) {
  const next = { ...state.save, captions };
  update({ save: next });
  saveSystem.save(next);
}

export function equipAccessory(id) {
  if (id && !state.save.cosmetics.includes(id)) return;
  const next = { ...state.save, petAccessory: id };
  update({ save: next });
  saveSystem.save(next);
}

export function dismissToast(id) {
  update({ toasts: state.toasts.filter((toast) => toast.id !== id) });
}

export function exportSave() {
  saveSystem.exportFile(state.save);
}

export async function importSave(file) {
  const imported = await saveSystem.importFile(file);
  if (!imported) return false;
  audioEngine.applySettings(imported.save.audio.volume, imported.save.audio.muted);
  resetPlayer();
  update({
    save: imported.save,
    panel: 'none',
    challenge: null,
    dialogue: null,
    currentRoom: 'great-hall',
  });
  pushToasts([
    {
      title: 'Your scroll has returned',
      text: 'The imported adventure is ready to continue.',
      icon: '✧',
      tone: 'gold',
    },
  ]);
  return true;
}
