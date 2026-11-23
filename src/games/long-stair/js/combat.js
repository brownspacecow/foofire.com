/*
 * Turn-based combat against the things under the house.
 * Heroes act first, one at a time, then every horror carries out the
 * intent it was telegraphing. Stress breaks are resolved as they happen;
 * downed heroes only survive if someone steadies them before the fight ends.
 */
import { BOSS, DIFFICULTIES, ENEMIES, FLAWS, HEROES } from './content.js';
import {
  addInjury,
  derived,
  gainXp,
  healHero,
  heroById,
  killHero,
  nameOf,
  reduceStress,
  stressHero,
} from './state.js';

const log = (combat, text, kind = '') => {
  combat.log.push({ text, kind });
  if (combat.log.length > 220) combat.log.shift();
};

export function enemyTemplate(archetype) {
  return archetype === 'unnamed' ? BOSS : ENEMIES[archetype] || ENEMIES.shade;
}

function makeEnemy(archetype, depth, rng, campaign, uid) {
  const template = enemyTemplate(archetype);
  const difficulty = DIFFICULTIES[campaign.difficulty] || DIFFICULTIES.dread;
  const boss = archetype === 'unnamed';
  const hp = Math.max(6, Math.round((template.hp + (boss ? 0 : depth * 2)) * difficulty.enemyHp));
  const might = Math.max(1, Math.round((template.might + (boss ? 0 : Math.floor(depth / 2))) * difficulty.enemyMight));
  const stress = Math.max(1, Math.round((template.stress + Math.floor(depth / 3)) * difficulty.enemyStress));
  return {
    uid: uid || `enemy-${archetype}-${rng.int(1000, 9999)}`,
    archetype,
    name: template.name,
    glyph: template.glyph,
    flavour: template.flavour,
    hp,
    maxHp: hp,
    might,
    guard: template.guard,
    stress,
    xp: template.xp,
    coin: template.coin,
    trait: template.trait || null,
    boss,
    turn: 0,
    stun: 0,
    weaken: 0,
    guarding: false,
    summoned: false,
    enraged: false,
    intent: null,
  };
}

function livingHeroes(campaign) {
  return campaign.party
    .map((id) => heroById(campaign, id))
    .filter((hero) => hero && hero.hp > 0);
}

function anyAllyDown(campaign) {
  return campaign.party.some((id) => {
    const hero = heroById(campaign, id);
    return hero && hero.hp <= 0;
  });
}

function aliveEnemies(combat) {
  return combat.enemies.filter((enemy) => enemy.hp > 0);
}

function lowerStress(campaign, combat, hero, amount, reason) {
  if (!hero || hero.hp <= 0) return;
  const lost = reduceStress(hero, amount);
  if (lost > 0) log(combat, `${nameOf(hero)} breathes out ${lost} stress. ${reason || ''}`.trim(), 'heal');
}

function applyStress(campaign, combat, hero, amount, rng, reason = '') {
  if (!hero || hero.hp <= 0) return 0;
  const result = stressHero(campaign, hero, amount, rng);
  log(
    combat,
    `${nameOf(hero)} gains ${result.gain} stress.${reason ? ` ${reason}` : ''}`,
    'stress'
  );
  if (result.broke && result.dread) {
    log(combat, `${nameOf(hero)} breaks. ${result.dread.name} takes hold.`, 'break');
  }
  if (result.lost) {
    log(
      combat,
      `${nameOf(hero)} goes somewhere the lamp cannot follow. They are gone.`,
      'death'
    );
  }
  return result.gain;
}

function startStressFor(campaign, combat, hero, rng) {
  const template = HEROES[hero.id];
  const flaw = FLAWS[template.flaw];
  let stress = 3;
  const reasons = ['the dark'];
  if (flaw && flaw.combatStartStress) {
    stress += flaw.combatStartStress;
    reasons.push(flaw.name);
  }
  if (flaw && flaw.veilStress) {
    stress += flaw.veilStress * aliveEnemies(combat).length;
    reasons.push(flaw.name);
  }
  for (const id of hero.dreads) {
    if (id === 'sleepless') {
      stress += 6;
      reasons.push('Sleepless Nights');
    }
  }
  if (stress > 0) {
    applyStress(campaign, combat, hero, stress, rng, reasons.length ? `(${reasons.join(', ')})` : '');
  }
}

function rollIntent(enemy, campaign, combat, rng) {
  const targets = livingHeroes(campaign);
  const target = targets.length ? rng.pick(targets) : null;
  const targetName = target ? nameOf(target) : 'someone';
  const roll = rng.next();

  if (enemy.boss) {
    const phase = enemy.turn % 3;
    enemy.turn += 1;
    if (enemy.enraged && rng.chance(0.5)) {
      return { type: 'crush', targetId: null, label: 'It opens its mouth and the dark pours out.' };
    }
    if (phase === 2) {
      return { type: 'crush', targetId: null, label: 'It opens its mouth and the dark pours out.' };
    }
    if (phase === 1) {
      return { type: 'horror', targetId: null, label: 'It hums a chord that has no name.' };
    }
    return { type: 'strike', targetId: target ? target.id : null, label: `It reaches for ${targetName}.` };
  }

  if (enemy.trait === 'incant' && roll < 0.5) {
    return { type: 'horror', targetId: null, label: 'It begins to hum.' };
  }
  if (enemy.trait === 'charge') {
    if (enemy.turn % 2 === 0) {
      enemy.turn += 1;
      return { type: 'charge', targetId: target ? target.id : null, label: `It lowers its antlers at ${targetName}.` };
    }
    enemy.turn += 1;
    return { type: 'strike', targetId: target ? target.id : null, label: `It stamps and turns toward ${targetName}.` };
  }
  if (enemy.trait === 'swift') {
    return { type: 'swift', targetId: target ? target.id : null, label: `It twitches toward ${targetName}.` };
  }
  if (roll < 0.18) {
    return { type: 'horror', targetId: null, label: 'It makes a sound behind your eyes.' };
  }
  return { type: 'strike', targetId: target ? target.id : null, label: `It reaches for ${targetName}.` };
}

export function startCombat(campaign, entities, rng) {
  const combat = {
    enemies: entities.map((entity) =>
      makeEnemy(entity.archetype, campaign.depth, rng, campaign, entity.uid ? `combat-${entity.uid}` : null)
    ),
    order: campaign.party.slice(),
    acted: {},
    cooldowns: {},
    round: 1,
    ward: 0,
    log: [],
    over: false,
    result: null,
    entityUids: entities.map((entity) => entity.uid).filter(Boolean),
    reward: { coin: 0, xp: 0 },
    deaths: [],
    encounters: entities.map((entity) => entity.omen).filter(Boolean),
  };

  for (const enemy of combat.enemies) {
    enemy.intent = rollIntent(enemy, campaign, combat, rng);
  }

  for (const id of combat.order) {
    const hero = heroById(campaign, id);
    if (!hero) continue;
    combat.cooldowns[id] = 0;
    hero.guarding = false;
  }

  const first = entities[0];
  if (first && first.kind === 'boss') {
    log(combat, 'The thing at the altar rises. The lamp shrinks to a pinprick.', 'boss');
  } else {
    log(combat, rng.pick(combat.encounters.length ? combat.encounters : ['Something unfolds out of the dark.']), 'system');
    if (combat.enemies[0]) log(combat, combat.enemies[0].flavour, 'flavour');
  }

  for (const id of combat.order) {
    const hero = heroById(campaign, id);
    if (hero && hero.hp > 0) startStressFor(campaign, combat, hero, rng);
  }

  return combat;
}

export function activeHero(campaign, combat) {
  if (!combat || combat.over) return null;
  for (const id of combat.order) {
    if (combat.acted[id]) continue;
    const hero = heroById(campaign, id);
    if (hero && hero.hp > 0) return hero;
  }
  return null;
}

export function abilityReady(campaign, combat, hero) {
  return Boolean(hero) && (combat.cooldowns[hero.id] || 0) <= 0;
}

function context(campaign) {
  return { allyDown: anyAllyDown(campaign) };
}

function damageEnemy(campaign, combat, enemy, amount, rng, options = {}) {
  if (!enemy || enemy.hp <= 0) return 0;
  const stat = derived(options.hero, context(campaign));
  let damage = Math.max(1, Math.round(amount));
  if (!options.ignoreGuard) damage = Math.max(1, damage - enemy.guard);
  if (options.crit) damage = Math.round(damage * 1.8);
  enemy.hp = Math.max(0, enemy.hp - damage);
  log(
    combat,
    `${options.label || nameOf(options.hero)} hits ${enemy.name} for ${damage}${options.crit ? ' (a clean strike)' : ''}.`,
    'hit'
  );
  if (options.crit) log(combat, `${stat.wit > 6 ? 'A scholar\'s eye' : 'Luck'} finds the seam in it.`, 'good');

  if (enemy.hp <= 0) {
    log(combat, `${enemy.name} comes apart.`, 'good');
    if (enemy.trait === 'burster') {
      log(combat, 'It was full of something. The room goes wet and loud.', 'bad');
      for (const hero of livingHeroes(campaign)) {
        const hurt = Math.max(1, 4 - derived(hero).guard);
        hero.hp = Math.max(0, hero.hp - hurt);
        applyStress(campaign, combat, hero, 5, rng);
        if (hero.hp <= 0) downHero(campaign, combat, hero, rng);
      }
    }
  } else if (enemy.boss && !enemy.summoned && enemy.hp <= enemy.maxHp * 0.6) {
    enemy.summoned = true;
    log(combat, 'It calls, and the choir answers. Two shapes come out of the wall.', 'boss');
    for (let i = 0; i < 2; i += 1) {
      const add = makeEnemy('cultist', campaign.depth, rng, campaign, `summon-${i}-${rng.int(100, 999)}`);
      add.intent = rollIntent(add, campaign, combat, rng);
      combat.enemies.push(add);
    }
  }
  if (enemy.boss && !enemy.enraged && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.3) {
    enemy.enraged = true;
    log(combat, 'The altar splits. It stops pretending to be patient.', 'boss');
  }

  return damage;
}

function downHero(campaign, combat, hero, rng) {
  if (!hero || hero.hp > 0) return;
  hero.guarding = false;
  log(combat, `${nameOf(hero)} goes down. They are dying.`, 'death');
  const others = livingHeroes(campaign).filter((other) => other.id !== hero.id);
  for (const other of others) {
    const flaw = FLAWS[HEROES[other.id].flaw];
    let extra = 4;
    if (flaw && flaw.allyDownStress) extra += flaw.allyDownStress;
    applyStress(campaign, combat, other, extra, rng);
  }
  if (hero.id === 'tallow') {
    for (const other of others) applyStress(campaign, combat, other, 6, rng, '(the boy is down)');
  }
}

function hitHero(campaign, combat, enemy, hero, base, stress, rng, label) {
  if (!hero || hero.hp <= 0) return;
  if (combat.ward > 0) {
    combat.ward -= 1;
    log(combat, `${label} The ward holds. Nothing reaches ${nameOf(hero)}.`, 'ward');
    return;
  }
  const flaw = FLAWS[HEROES[hero.id].flaw];
  const stats = derived(hero, context(campaign));
  let damage = Math.max(1, base - enemy.weaken - stats.guard);
  if (flaw && flaw.damageTaken) damage += flaw.damageTaken;
  if (hero.guarding) {
    damage = Math.max(0, Math.ceil(damage / 2));
    log(combat, `${nameOf(hero)} braces behind their guard.`, 'ward');
  }
  hero.hp = Math.max(0, hero.hp - damage);
  log(combat, `${label} ${nameOf(hero)} takes ${damage} damage.`, 'hit');

  const nerveCut = Math.max(1, Math.round(stress * (1 - stats.nerve * 0.06)));
  if (hero.hp > 0) {
    applyStress(campaign, combat, hero, hero.guarding ? Math.ceil(nerveCut / 2) : nerveCut, rng);
  }
  if (hero.hp <= 0) downHero(campaign, combat, hero, rng);
}

function finishVictory(campaign, combat, rng) {
  if (combat.over) return;
  combat.over = true;
  combat.result = 'victory';

  const difficulty = DIFFICULTIES[campaign.difficulty] || DIFFICULTIES.dread;
  let coin = 0;
  let xp = 0;
  for (const enemy of combat.enemies) {
    const [low, high] = enemy.coin || [1, 3];
    coin += Math.round(rng.int(low, high) * difficulty.coin);
    xp += enemy.xp || 3;
  }

  combat.reward = { coin, xp };
  campaign.loot += coin;
  campaign.kills += combat.enemies.length;

  for (const id of combat.order) {
    const hero = heroById(campaign, id);
    if (!hero) continue;
    if (hero.hp <= 0) {
      combat.deaths.push(HEROES[hero.id].name);
      log(combat, `${nameOf(hero)} does not get up. The cellar keeps them.`, 'death');
      killHero(campaign, hero, 'died in the cellar');
      continue;
    }
    const levels = gainXp(hero, xp);
    if (levels) {
      log(combat, `${nameOf(hero)} reaches level ${hero.level}. Something in them hardens.`, 'good');
    }
    for (const id of hero.dreads) {
      if (id === 'weeping') applyStress(campaign, combat, hero, 6, rng, '(The Weeping)');
    }
    healHero(hero, 3);
    reduceStress(hero, 1);
  }

  log(combat, `The room goes quiet. ${coin} coin and ${xp} experience are yours to carry.`, 'good');
  log(combat, rng.pick([
    'The lamp steadies. The heroes do not.',
    'The humming resumes, a little disappointed.',
    'Something in the walls takes a long, slow step away.',
  ]), 'flavour');
}

function finishDefeat(campaign, combat) {
  if (combat.over) return;
  combat.over = true;
  combat.result = 'defeat';

  for (const id of combat.order) {
    const hero = heroById(campaign, id);
    if (!hero) continue;
    combat.deaths.push(HEROES[hero.id].name);
    killHero(campaign, hero, 'lost in the cellar');
  }
  log(combat, 'The lamp goes out. The cellar keeps what it has taken.', 'death');
  log(combat, 'No one comes back up the stair.', 'death');
}

function startRound(campaign, combat, rng) {
  combat.round += 1;
  combat.acted = {};
  for (const id of combat.order) {
    const hero = heroById(campaign, id);
    if (hero) hero.guarding = false;
    if (combat.cooldowns[id] > 0) combat.cooldowns[id] -= 1;
  }
  for (const enemy of combat.enemies) {
    if (enemy.hp > 0) enemy.intent = rollIntent(enemy, campaign, combat, rng);
  }
}

function enemyPhase(campaign, combat, rng) {
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.stun > 0) {
      enemy.stun -= 1;
      log(combat, `${enemy.name} is still reeling and loses its turn.`, 'ward');
      continue;
    }

    const intent = enemy.intent || { type: 'strike', targetId: null, label: 'It moves.' };
    const heroes = livingHeroes(campaign);
    if (!heroes.length) break;

    if (intent.type === 'horror') {
      log(combat, intent.label, 'bad');
      for (const hero of heroes) {
        const stats = derived(hero, context(campaign));
        const amount = Math.max(1, Math.round(enemy.stress * (1 - stats.nerve * 0.06)));
        applyStress(campaign, combat, hero, amount, rng);
      }
    } else if (intent.type === 'crush') {
      log(combat, intent.label, 'bad');
      for (const hero of heroes) {
        hitHero(campaign, combat, enemy, hero, Math.max(3, enemy.might - 1), enemy.stress, rng, 'The sound rolls over');
      }
    } else if (intent.type === 'charge') {
      const hero = heroById(campaign, intent.targetId) || rng.pick(heroes);
      log(combat, intent.label, 'bad');
      if (hero && hero.hp > 0) {
        hitHero(campaign, combat, enemy, hero, enemy.might + 4, enemy.stress + 2, rng, 'The charge catches');
      }
    } else if (intent.type === 'swift') {
      const hero = heroById(campaign, intent.targetId) || rng.pick(heroes);
      log(combat, intent.label, 'bad');
      if (hero && hero.hp > 0) {
        hitHero(campaign, combat, enemy, hero, Math.max(1, enemy.might - 1), Math.ceil(enemy.stress / 2), rng, 'It rakes');
        if (hero.hp > 0) {
          hitHero(campaign, combat, enemy, hero, Math.max(1, enemy.might - 1), Math.ceil(enemy.stress / 2), rng, 'It rakes again');
        }
      }
    } else {
      const hero = heroById(campaign, intent.targetId) || rng.pick(heroes);
      log(combat, intent.label, 'bad');
      if (hero && hero.hp > 0) {
        hitHero(campaign, combat, enemy, hero, enemy.might, enemy.stress, rng, 'It strikes');
      }
    }

    if (aliveEnemies(combat).length && !livingHeroes(campaign).length) break;
  }

  for (const enemy of combat.enemies) {
    if (enemy.hp > 0 && enemy.trait === 'regen') {
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 3);
      if (enemy.hp > before) log(combat, `${enemy.name} knits itself back together.`, 'bad');
    }
  }

  if (!livingHeroes(campaign).length) {
    finishDefeat(campaign, combat);
    return;
  }
  if (!aliveEnemies(combat).length) {
    finishVictory(campaign, combat, rng);
    return;
  }
  startRound(campaign, combat, rng);
}

function afterHeroAction(campaign, combat, rng) {
  if (!livingHeroes(campaign).length) {
    finishDefeat(campaign, combat);
    return;
  }
  if (!aliveEnemies(combat).length) {
    finishVictory(campaign, combat, rng);
    return;
  }
  if (!activeHero(campaign, combat)) {
    enemyPhase(campaign, combat, rng);
  }
}

function pickEnemy(combat, targetUid) {
  return combat.enemies.find((enemy) => enemy.hp > 0 && enemy.uid === targetUid) || aliveEnemies(combat)[0] || null;
}

function lowestHero(campaign) {
  const heroes = livingHeroes(campaign);
  if (!heroes.length) return null;
  return heroes.reduce((worst, hero) => {
    const ratio = hero.hp / derived(hero).maxHp;
    const worstRatio = worst.hp / derived(worst).maxHp;
    return ratio < worstRatio ? hero : worst;
  }, heroes[0]);
}

export function heroAction(campaign, combat, action, rng) {
  const hero = activeHero(campaign, combat);
  if (!hero || combat.over) return combat;

  if (action.type === 'strike') {
    const enemy = pickEnemy(combat, action.targetUid);
    if (!enemy) {
      afterHeroAction(campaign, combat, rng);
      return combat;
    }
    const stats = derived(hero, context(campaign));
    const crit = rng.chance(stats.crit);
    const raw = stats.might + rng.int(0, 2);
    damageEnemy(campaign, combat, enemy, raw, rng, { hero, crit });
    applyStress(campaign, combat, hero, 1, rng);
  } else if (action.type === 'guard') {
    hero.guarding = true;
    log(combat, `${nameOf(hero)} sets their feet and raises what they have.`, 'ward');
    reduceStress(hero, 2);
  } else if (action.type === 'ability') {
    const ability = HEROES[hero.id].ability;
    if ((combat.cooldowns[hero.id] || 0) > 0) {
      return combat;
    }
    if (
      ability.kind === 'heal' &&
      !livingHeroes(campaign).some((ally) => ally.hp < derived(ally).maxHp)
    ) {
      log(combat, 'There is no open wound to close.', 'system');
      return combat;
    }
    combat.cooldowns[hero.id] = ability.cooldown;
    log(combat, `${nameOf(hero)} uses ${ability.name}.`, 'good');

    if (ability.kind === 'heal') {
      const target =
        (action.targetUid && heroById(campaign, action.targetUid)) || lowestHero(campaign);
      if (!target) {
        log(combat, 'There is no one left to mend.', 'system');
      } else {
        const healed = healHero(target, ability.power);
        log(combat, `${nameOf(target)} recovers ${healed} HP.`, 'heal');
      }
      if (ability.selfStress) {
        applyStress(campaign, combat, hero, ability.selfStress, rng, `(${ability.name})`);
      }
    } else if (ability.kind === 'healAll') {
      for (const ally of livingHeroes(campaign)) {
        const healed = healHero(ally, ability.power);
        if (healed) log(combat, `${nameOf(ally)} recovers ${healed} HP.`, 'heal');
        reduceStress(ally, ability.relief || 0);
      }
      log(combat, 'The hymn settles over the party.', 'heal');
    } else if (ability.kind === 'damage') {
      const enemy = pickEnemy(combat, action.targetUid);
      if (enemy) damageEnemy(campaign, combat, enemy, ability.power, rng, { hero, ignoreGuard: true });
    } else if (ability.kind === 'damageAll') {
      for (const enemy of aliveEnemies(combat)) {
        damageEnemy(campaign, combat, enemy, ability.power, rng, { hero });
      }
      if (ability.relief) {
        for (const ally of livingHeroes(campaign)) reduceStress(ally, ability.relief);
        log(combat, 'The sound clears a little of the pressure behind the eyes.', 'heal');
      }
    } else if (ability.kind === 'stun') {
      const enemy = pickEnemy(combat, action.targetUid);
      if (enemy) {
        if (ability.power) damageEnemy(campaign, combat, enemy, ability.power, rng, { hero });
        enemy.stun += ability.stun || 1;
        log(combat, `${enemy.name} is staggered and will lose a turn.`, 'ward');
      }
    } else if (ability.kind === 'weaken') {
      const enemy = pickEnemy(combat, action.targetUid);
      if (enemy) {
        damageEnemy(campaign, combat, enemy, ability.power, rng, { hero, ignoreGuard: true });
        enemy.weaken += ability.weaken || 2;
        log(combat, `The sign sinks into ${enemy.name}. Its blows will land softer.`, 'ward');
      }
    } else if (ability.kind === 'ward') {
      combat.ward += ability.power || 1;
      log(combat, `The party is warded against the next ${combat.ward} blows.`, 'ward');
      if (ability.relief) {
        for (const ally of livingHeroes(campaign)) reduceStress(ally, ability.relief);
      }
    } else if (ability.kind === 'frenzy') {
      for (let i = 0; i < (ability.hits || 3); i += 1) {
        const enemies = aliveEnemies(combat);
        if (!enemies.length) break;
        const enemy = rng.pick(enemies);
        damageEnemy(campaign, combat, enemy, ability.power, rng, { hero, label: `${nameOf(hero)} lashes out` });
      }
      applyStress(campaign, combat, hero, 3, rng, '(Frenzy)');
    }
  } else if (action.type === 'stabilise') {
    const downed =
      (action.allyId && heroById(campaign, action.allyId)) ||
      campaign.party
        .map((id) => heroById(campaign, id))
        .find((ally) => ally && ally.hp <= 0);
    if (!downed || downed.hp > 0) {
      log(combat, 'There is no one down to save.', 'system');
    } else {
      downed.hp = Math.max(1, Math.ceil(derived(downed).maxHp * 0.25));
      const injury = addInjury(downed, rng);
      log(combat, `${nameOf(hero)} drags ${nameOf(downed)} back from the edge.`, 'heal');
      if (injury) log(combat, `${nameOf(downed)} will carry ${injury.name}.`, 'bad');
      applyStress(campaign, combat, downed, 6, rng);
      applyStress(campaign, combat, hero, 3, rng);
      combat.acted[downed.id] = true;
    }
  } else if (action.type === 'item') {
    if (action.itemId === 'bandages') {
      if ((campaign.inventory.bandages || 0) <= 0) return combat;
      campaign.inventory.bandages -= 1;
      const target = lowestHero(campaign);
      const healed = healHero(target, 10);
      log(combat, `${nameOf(hero)} binds ${nameOf(target)}'s wounds. ${healed} HP restored.`, 'heal');
    } else {
      return combat;
    }
  } else if (action.type === 'flee') {
    if (rng.chance(0.55)) {
      log(combat, 'They run. The lamp holds long enough.', 'system');
      combat.over = true;
      combat.result = 'fled';
      for (const ally of livingHeroes(campaign)) applyStress(campaign, combat, ally, 5, rng);
      return combat;
    }
    log(combat, 'They turn to run, and the dark is already behind them.', 'bad');
    applyStress(campaign, combat, hero, 5, rng);
  }

  combat.acted[hero.id] = true;
  afterHeroAction(campaign, combat, rng);
  return combat;
}

export function useItemInCombat(campaign, combat, itemId, rng) {
  return heroAction(campaign, combat, { type: 'item', itemId }, rng);
}

export function enemyIntentSummary(combat) {
  return aliveEnemies(combat).map((enemy) => ({
    uid: enemy.uid,
    name: enemy.name,
    intent: enemy.intent,
    stunned: enemy.stun > 0,
  }));
}
