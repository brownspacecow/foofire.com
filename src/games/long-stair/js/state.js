/*
 * Campaign state: the house, the roster, the wounds and the dread.
 * Kept as plain serialisable data so the whole campaign can live in
 * localStorage between visits.
 */
import {
  CANDIDATE_POOL,
  DREADS,
  FLAWS,
  HEROES,
  INJURIES,
  ITEMS,
  STARTING_HEROES,
} from './content.js';
import { generateFloor } from './dungeon.js';

export const SAVE_KEY = 'foofire.long-stair.save.v1';
export const VERSION = 1;
export const MAX_ROSTER = 8;
export const START_OIL = 150;
export const OIL_CAP = 200;
export const XP_STEPS = [12, 30, 55, 85, 120, 160];
export const INJURY_LIMIT = 3;

const CARE = {
  surgery: 25,
  confession: 20,
};

export function makeHero(templateId) {
  const template = HEROES[templateId];
  if (!template) return null;
  return {
    id: template.id,
    level: 1,
    xp: 0,
    hp: template.hp,
    stress: 0,
    injuries: [],
    dreads: [],
    resting: false,
  };
}

export function newCampaign({ difficulty = 'dread', seed = Date.now() } = {}) {
  const roster = STARTING_HEROES.map(makeHero).filter(Boolean);
  return {
    version: VERSION,
    seed: Number(seed) || Date.now(),
    difficulty,
    week: 1,
    coin: 110,
    inventory: { bandages: 2, laudanum: 1, oil: 1 },
    roster,
    party: roster.slice(0, 4).map((hero) => hero.id),
    dungeon: null,
    depth: 0,
    maxDepth: 0,
    oil: START_OIL,
    loot: 0,
    kills: 0,
    memorial: [],
    journal: [],
    completed: false,
    over: false,
    overReason: '',
    score: 0,
    scored: false,
    startedAt: Date.now(),
  };
}

export function heroById(campaign, id) {
  return campaign.roster.find((hero) => hero.id === id) || null;
}

export function partyHeroes(campaign) {
  return campaign.party
    .map((id) => heroById(campaign, id))
    .filter((hero) => hero && hero.hp > 0);
}

export function templateOf(hero) {
  return HEROES[hero.id] || null;
}

export function derived(hero, context = {}) {
  if (!hero) return { maxHp: 1, might: 1, guard: 0, wit: 0, nerve: 0, crit: 0.05, stressMult: 1 };
  const template = HEROES[hero.id];
  let maxHp = template.hp + (hero.level - 1) * 3;
  let might = template.might + (hero.level >= 3 ? 1 : 0) + (hero.level >= 5 ? 1 : 0);
  let guard = template.guard;
  let wit = template.wit;
  let nerve = template.nerve;
  let stressMult = 1;

  const flaw = FLAWS[template.flaw];
  if (flaw) {
    if (flaw.mods) {
      maxHp += flaw.mods.maxHp || 0;
      might += flaw.mods.might || 0;
      guard += flaw.mods.guard || 0;
      wit += flaw.mods.wit || 0;
    }
    if (flaw.guardMod) guard += flaw.guardMod;
    if (flaw.stressMult) stressMult += flaw.stressMult;
    if (flaw.lowHpMight && hero.hp <= maxHp / 2) might -= flaw.lowHpMight;
  }

  for (const id of hero.injuries) {
    const injury = INJURIES.find((entry) => entry.id === id);
    if (!injury || !injury.mods) continue;
    maxHp += injury.mods.maxHp || 0;
    might += injury.mods.might || 0;
    guard += injury.mods.guard || 0;
    wit += injury.mods.wit || 0;
  }

  for (const id of hero.dreads) {
    const dread = DREADS.find((entry) => entry.id === id);
    if (!dread) continue;
    if (dread.mods) {
      maxHp += dread.mods.maxHp || 0;
      might += dread.mods.might || 0;
      guard += dread.mods.guard || 0;
      wit += dread.mods.wit || 0;
    }
    if (dread.stressMult) stressMult += dread.stressMult;
  }

  if (context.allyDown && flaw && flaw.griefMight) might += flaw.griefMight;

  return {
    maxHp: Math.max(5, maxHp),
    might: Math.max(1, might),
    guard: Math.max(0, guard),
    wit: Math.max(0, wit),
    nerve: Math.max(0, nerve),
    crit: Math.min(0.5, 0.05 + Math.max(0, wit) * 0.02),
    stressMult,
  };
}

export function syncHero(hero) {
  const max = derived(hero).maxHp;
  if (hero.hp > max) hero.hp = max;
  if (hero.hp < 0) hero.hp = 0;
  if (hero.stress < 0) hero.stress = 0;
}

export function reduceStress(hero, amount) {
  if (!hero) return 0;
  const before = hero.stress;
  hero.stress = Math.max(0, hero.stress - amount);
  return before - hero.stress;
}

export function stressHero(campaign, hero, amount, rng) {
  if (!hero || hero.hp <= 0) {
    return { gain: 0, broke: false, dread: null, lost: false };
  }
  const stats = derived(hero);
  const gain = Math.max(1, Math.round(amount * stats.stressMult));
  hero.stress += gain;
  const result = { gain, broke: false, dread: null, lost: false };

  if (hero.stress >= 100) {
    hero.stress = 35;
    const available = DREADS.filter((dread) => !hero.dreads.includes(dread.id));
    if (available.length) {
      const dread = rng.pick(available);
      hero.dreads.push(dread.id);
      result.broke = true;
      result.dread = dread;
      if (hero.dreads.length >= 3) {
        result.lost = true;
        killHero(campaign, hero, 'lost to the dark');
      }
    }
  }
  return result;
}

export function healHero(hero, amount) {
  if (!hero || hero.hp <= 0) return 0;
  const max = derived(hero).maxHp;
  const before = hero.hp;
  hero.hp = Math.min(max, hero.hp + amount);
  return hero.hp - before;
}

export function addInjury(hero, rng, forcedId) {
  if (!hero) return null;
  const available = INJURIES.filter((injury) => !hero.injuries.includes(injury.id));
  const injury = forcedId
    ? INJURIES.find((entry) => entry.id === forcedId)
    : available.length
      ? rng.pick(available)
      : rng.pick(INJURIES);
  if (!injury) return null;
  hero.injuries.push(injury.id);
  syncHero(hero);
  return injury;
}

export function killHero(campaign, hero, cause) {
  if (!hero) return;
  campaign.roster = campaign.roster.filter((entry) => entry.id !== hero.id);
  campaign.party = campaign.party.filter((id) => id !== hero.id);
  const template = HEROES[hero.id];
  campaign.memorial.push({
    id: hero.id,
    name: template ? template.name : hero.id,
    epithet: template ? template.epithet : '',
    week: campaign.week,
    cause,
  });
}

export function gainXp(hero, amount) {
  if (!hero) return 0;
  const messages = [];
  hero.xp += amount;
  let levels = 0;
  while (hero.level < 7 && hero.xp >= XP_STEPS[hero.level - 1]) {
    hero.level += 1;
    levels += 1;
    hero.hp = Math.min(derived(hero).maxHp, hero.hp + 4);
    reduceStress(hero, 8);
    messages.push(`${nameOf(hero)} reaches level ${hero.level}.`);
  }
  hero.lastLevelMessages = messages;
  return levels;
}

export function nameOf(hero) {
  if (!hero) return 'Someone';
  const template = HEROES[hero.id];
  if (!template) return hero.id;
  return template.name.split(' ').slice(-1)[0];
}

export function fullName(hero) {
  const template = HEROES[hero.id];
  return template ? template.name : 'Unknown';
}

export function ableToDelve(hero) {
  return Boolean(hero) && hero.hp > 0 && !hero.resting;
}

export function restingCount(campaign) {
  return campaign.roster.filter((hero) => hero.resting).length;
}

export function candidatesFor(campaign) {
  if (campaign.roster.length >= MAX_ROSTER) return [];
  const available = CANDIDATE_POOL.filter(
    (id) => !campaign.roster.some((hero) => hero.id === id)
  );
  return available.slice(0, 2);
}

export function candidateCost(campaign, id) {
  if (campaign.roster.length < 4) return 0;
  return HEROES[id].cost || 60;
}

export function toggleParty(campaign, id) {
  const hero = heroById(campaign, id);
  if (!hero || !ableToDelve(hero)) return 'They cannot go down tonight.';
  if (campaign.party.includes(id)) {
    campaign.party = campaign.party.filter((entry) => entry !== id);
    return null;
  }
  if (campaign.party.length >= 4) return 'A party is four. Send someone back.';
  campaign.party.push(id);
  return null;
}

export function toggleRest(campaign, id) {
  const hero = heroById(campaign, id);
  if (!hero) return;
  hero.resting = !hero.resting;
  if (hero.resting) campaign.party = campaign.party.filter((entry) => entry !== id);
}

export function treatInjury(campaign, id, index) {
  const hero = heroById(campaign, id);
  if (!hero) return 'No such hero.';
  if (index < 0 || index >= hero.injuries.length) return 'There is no such wound.';
  if (campaign.coin < CARE.surgery) return 'The surgeon wants 25 coin.';
  campaign.coin -= CARE.surgery;
  hero.injuries.splice(index, 1);
  syncHero(hero);
  return null;
}

export function confess(campaign, id) {
  const hero = heroById(campaign, id);
  if (!hero) return 'No such hero.';
  if (campaign.coin < CARE.confession) return 'The priest wants 20 coin.';
  campaign.coin -= CARE.confession;
  reduceStress(hero, 35);
  return null;
}

export function useLaudanum(campaign, id) {
  const hero = heroById(campaign, id);
  if (!hero) return 'No such hero.';
  if ((campaign.inventory.laudanum || 0) <= 0) return 'The bottle is empty.';
  campaign.inventory.laudanum = Math.max(0, campaign.inventory.laudanum - 1);
  reduceStress(hero, 30);
  return null;
}

export function buyItem(campaign, itemId) {
  const item = ITEMS[itemId];
  if (!item) return 'No such supply.';
  if (campaign.coin < item.cost) return 'Not enough coin.';
  campaign.coin -= item.cost;
  campaign.inventory[itemId] = (campaign.inventory[itemId] || 0) + 1;
  return null;
}

export function recruit(campaign, id) {
  if (campaign.roster.length >= MAX_ROSTER) return 'The house is full.';
  if (!CANDIDATE_POOL.includes(id)) return 'They are not at the door.';
  if (campaign.roster.some((hero) => hero.id === id)) return 'They are already here.';
  const cost = candidateCost(campaign, id);
  if (campaign.coin < cost) return 'Not enough coin.';
  campaign.coin -= cost;
  const hero = makeHero(id);
  if (!hero) return 'They changed their mind.';
  campaign.roster.push(hero);
  return null;
}

export function beginDelve(campaign, rng) {
  if (campaign.party.length !== 4) return { error: 'Four must go down.' };
  const party = partyHeroes(campaign);
  if (party.length !== 4) return { error: 'Some of them cannot walk.' };

  campaign.depth = 1;
  campaign.maxDepth = Math.max(campaign.maxDepth, 1);
  campaign.oil = START_OIL;
  campaign.loot = 0;
  campaign.dungeon = generateFloor(1, rng);
  campaign.party = party.map((hero) => hero.id);
  campaign.journal = [];

  const notes = [];
  for (const hero of party) {
    for (const id of hero.dreads) {
      const dread = DREADS.find((entry) => entry.id === id);
      if (dread && dread.expeditionStress) {
        stressHero(campaign, hero, dread.expeditionStress, rng);
        notes.push(`${nameOf(hero)} starts the descent wound tight (+${dread.expeditionStress} stress).`);
      }
    }
  }
  return { error: null, notes };
}

export function descendFloor(campaign, rng) {
  if (!campaign.dungeon) return [];
  campaign.depth += 1;
  campaign.maxDepth = Math.max(campaign.maxDepth, campaign.depth);
  campaign.oil = Math.max(0, campaign.oil - 5);
  campaign.dungeon = generateFloor(campaign.depth, rng);

  const notes = [];
  for (const hero of partyHeroes(campaign)) {
    const flaw = FLAWS[HEROES[hero.id].flaw];
    const extra = flaw && flaw.floorStress ? flaw.floorStress : 0;
    const result = stressHero(campaign, hero, 5 + extra, rng);
    if (result.broke && result.dread) {
      notes.push(`${nameOf(hero)} breaks on the stair. ${result.dread.name} takes hold.`);
    }
    if (result.lost) {
      notes.push(`${nameOf(hero)} does not come off the last step.`);
    } else if (extra) {
      notes.push(`${nameOf(hero)} lingers on the last step (+${5 + extra} stress).`);
    }
    const levels = gainXp(hero, 8);
    if (levels) notes.push(`${nameOf(hero)} reaches level ${hero.level} on the stair.`);
  }
  return notes;
}

export function syncParty(campaign) {
  campaign.party = campaign.party.filter((id) => {
    const hero = heroById(campaign, id);
    return hero && hero.hp > 0 && !hero.resting;
  });
}

export function advanceWeek(campaign, rng) {
  const delved = new Set(campaign.party);
  const notes = [];

  for (const hero of campaign.roster) {
    const max = derived(hero).maxHp;
    if (hero.resting) {
      hero.hp = max;
      reduceStress(hero, 50);
      if (hero.injuries.length) {
        hero.injuries.shift();
        notes.push(`${nameOf(hero)} rests, and one wound closes.`);
      }
      hero.resting = false;
    } else if (delved.has(hero.id)) {
      hero.hp = Math.min(max, hero.hp + Math.ceil(max * 0.25));
      reduceStress(hero, 6);
    } else {
      hero.hp = Math.min(max, hero.hp + Math.ceil(max * 0.2));
      reduceStress(hero, 14);
    }

    for (const id of hero.injuries) {
      const injury = INJURIES.find((entry) => entry.id === id);
      if (injury && injury.weekDamage) {
        hero.hp = Math.max(1, hero.hp - injury.weekDamage);
      }
    }
    syncHero(hero);
  }

  campaign.week += 1;
  campaign.dungeon = null;
  campaign.depth = 0;
  campaign.loot = 0;
  campaign.oil = START_OIL;
  syncParty(campaign);

  if (campaign.roster.length < 4) {
    campaign.over = true;
    campaign.overReason = 'There are not four people left in this house who will go down.';
  }

  return notes;
}

export function computeScore(campaign, victory) {
  return Math.round(
    campaign.maxDepth * 300 +
      campaign.kills * 12 +
      (victory ? 1500 : 0) +
      Math.max(0, 60 - campaign.week) * 4
  );
}

export function finishCampaign(campaign, victory, reason) {
  campaign.over = true;
  campaign.completed = victory;
  campaign.overReason = reason;
  campaign.score = computeScore(campaign, victory);
  campaign.survivors = campaign.party
    .map((id) => heroById(campaign, id))
    .filter((hero) => hero && hero.hp > 0)
    .map((hero) => fullName(hero));
  campaign.dungeon = null;
  campaign.party = [];
}

export function saveCampaign(campaign) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(campaign));
  } catch (error) {
    /* A full or blocked store should never stop the game. */
  }
}

export function loadCampaign() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION) return null;
    if (!Array.isArray(parsed.roster) || !Array.isArray(parsed.party)) return null;
    parsed.inventory = parsed.inventory || { bandages: 0, laudanum: 0, oil: 0 };
    parsed.memorial = parsed.memorial || [];
    parsed.journal = parsed.journal || [];
    parsed.maxDepth = parsed.maxDepth || parsed.depth || 0;
    for (const hero of parsed.roster) {
      hero.injuries = hero.injuries || [];
      hero.dreads = hero.dreads || [];
      hero.stress = Number(hero.stress) || 0;
      hero.hp = Number(hero.hp) || 0;
      hero.level = Number(hero.level) || 1;
      hero.xp = Number(hero.xp) || 0;
      hero.resting = Boolean(hero.resting);
      syncHero(hero);
    }
    if (parsed.dungeon) {
      parsed.dungeon.entities = parsed.dungeon.entities || [];
      parsed.dungeon.seen = parsed.dungeon.seen || [];
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

export function clearCampaign() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    /* ignore */
  }
}

export const COSTS = CARE;
