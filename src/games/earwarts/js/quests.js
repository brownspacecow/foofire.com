import { QUESTS } from './content.js';
import { levelFor } from './progression.js';

export function questProgress(save, quest) {
  const current = Math.min(quest.objective.count, save.challengeStats[quest.objective.skill] ?? 0);
  return {
    quest,
    current,
    target: quest.objective.count,
    done: current >= quest.objective.count,
    claimed: save.completedQuests.includes(quest.id),
  };
}

export function allQuestProgress(save) {
  return QUESTS.map((quest) => questProgress(save, quest));
}

export function nextQuestHint(save) {
  const open = allQuestProgress(save).find((entry) => !entry.done && !entry.claimed);
  if (!open) return 'Every quest scroll is glowing with a job well done.';
  return `${open.quest.title} — ${open.current}/${open.target}`;
}

/** Applies rewards for any quest whose objective is now met. */
export function applyQuestCompletions(save) {
  const completed = [];
  const next = {
    ...save,
    unlockedSpells: [...save.unlockedSpells],
    cosmetics: [...save.cosmetics],
    completedQuests: [...save.completedQuests],
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const quest of QUESTS) {
      if (next.completedQuests.includes(quest.id)) continue;
      const progress = questProgress(next, quest);
      if (!progress.done) continue;

      next.completedQuests.push(quest.id);
      completed.push(quest);
      const reward = quest.reward;
      if (reward.spell && !next.unlockedSpells.includes(reward.spell)) {
        next.unlockedSpells.push(reward.spell);
      }
      if (reward.cosmetic && !next.cosmetics.includes(reward.cosmetic)) {
        next.cosmetics.push(reward.cosmetic);
      }
      if (reward.cosmetic === 'star-scarf' && !next.petAccessory) {
        next.petAccessory = 'star-scarf';
      }
      if (reward.cosmetic === 'moon-crown' && !next.petAccessory) {
        next.petAccessory = 'moon-crown';
      }
      if (reward.resonance) {
        next.resonance += reward.resonance;
        next.level = levelFor(next.resonance);
      }
      changed = true;
    }
  }

  return { save: next, completed };
}
