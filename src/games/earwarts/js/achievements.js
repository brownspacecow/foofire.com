import { ACHIEVEMENTS } from './content.js';

export function checkAchievements(save) {
  const owned = new Set(save.achievements);
  const earned = [];
  for (const achievement of ACHIEVEMENTS) {
    if (owned.has(achievement.id)) continue;
    if (!achievement.check(save)) continue;
    owned.add(achievement.id);
    earned.push({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
    });
  }
  if (earned.length === 0) return { save, earned };
  return {
    save: {
      ...save,
      achievements: ACHIEVEMENTS.map((entry) => entry.id).filter((id) => owned.has(id)),
    },
    earned,
  };
}

export function earnedAchievements(save) {
  return ACHIEVEMENTS.filter((achievement) => save.achievements.includes(achievement.id)).map(
    (achievement) => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
    })
  );
}
