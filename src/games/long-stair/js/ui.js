/*
 * The Long Stair — interface, screens and the weekly housekeeping.
 */
import {
  BOSS,
  CACHE_FLAVOUR,
  DIFFICULTIES,
  DREADS,
  FLAWS,
  FLOORS,
  HEROES,
  INJURIES,
  ITEMS,
  LORES,
  SHRINE,
  TRAP_FLAVOUR,
  WITHDRAW_LINES,
  flawOf,
  injuryById,
  dreadById,
} from './content.js';
import {
  MAP_H,
  ALTAR,
  ENTITY_INFO,
  FLOOR,
  STAIRS,
  WALL,
  clearEntities,
  entityAt,
  isWalkable,
  reveal,
  roamEnemies,
} from './dungeon.js';
import { makeRng } from './rng.js';
import {
  MAX_ROSTER,
  OIL_CAP,
  START_OIL,
  ableToDelve,
  addInjury,
  advanceWeek,
  beginDelve,
  buyItem,
  candidateCost,
  candidatesFor,
  confess,
  derived,
  descendFloor,
  finishCampaign,
  fullName,
  gainXp,
  healHero,
  heroById,
  killHero,
  loadCampaign,
  nameOf,
  newCampaign,
  recruit,
  reduceStress,
  saveCampaign,
  stressHero,
  toggleParty,
  toggleRest,
  treatInjury,
  useLaudanum,
} from './state.js';
import {
  activeHero,
  heroAction,
  startCombat,
} from './combat.js';
import { isMuted, sound, toggleMuted, unlockAudio } from './audio.js';
import { getBest, submitScore } from '../../../utils/scores.js';

const GAME_ID = 'long-stair';
const HOUSE_NOTES = [
  'The house is quiet. That is not the same as empty.',
  'Someone has been oiling the cellar hinges. Nobody will say who.',
  'The stair has thirteen steps this morning. Yesterday it had twelve.',
  'There is salt on the doormat, four miles from the sea.',
  'The lamp is warm, though it has not been lit.',
  'Next door\'s dog will not come past the gate.',
  'The wallpaper downstairs is wet in the shape of a hand.',
  'A letter arrives with no postmark: "DO NOT SEND THE BOY."',
  'The house settles at night in a rhythm that is almost breathing.',
  'You have started counting the stairs without meaning to.',
];

let campaign = null;
let rng = makeRng(Date.now());
let screen = 'title';
let combat = null;
let selectedEnemy = null;
let delveLog = [];
let modalState = null;
let titleDifficulty = 'dread';
let fightEntities = [];
let runStart = null;
let foughtBoss = false;
let lastScreen = null;

let root;
let refs = {};

function $(id) {
  return document.getElementById(id);
}

export function initGame() {
  root = $('stair-game');
  if (!root) return;

  refs = {
    title: $('screen-title'),
    house: $('screen-house'),
    delve: $('screen-delve'),
    end: $('screen-end'),
    combat: $('combat-stage'),
    modal: $('modal'),
    modalBody: $('modal-body'),
    houseWeek: $('house-week'),
    houseFlavour: $('house-flavour'),
    houseStats: $('house-stats'),
    partySlots: $('party-slots'),
    heroList: $('hero-list'),
    candidateList: $('candidate-list'),
    shopList: $('shop-list'),
    descendCopy: $('descend-copy'),
    descendButton: $('descend-button'),
    quickDescend: $('quick-descend'),
    houseDockCopy: $('house-dock-copy'),
    memorial: $('memorial-panel'),
    floorName: $('floor-name'),
    floorDepth: $('floor-depth'),
    map: $('map'),
    mapHud: $('map-hud'),
    delveParty: $('delve-party'),
    delveLog: $('delve-log'),
    enemyRow: $('enemy-row'),
    combatRound: $('combat-round'),
    combatTitle: $('combat-title'),
    combatLog: $('combat-log'),
    activePanel: $('active-panel'),
    combatActions: $('combat-actions'),
    combatParty: $('combat-party'),
    muteButton: $('mute-button'),
    stairBarLabel: $('stair-bar-label'),
  };

  const map = refs.map;
  if (map) map.style.gridTemplateColumns = 'repeat(19, 1fr)';

  bindEvents();
  refreshMute();
  showTitle();

  const saved = loadCampaign();
  if (saved) {
    $('title-continue').hidden = false;
    $('title-continue-copy').textContent = saved.completed
      ? 'That cellar is already quiet.'
      : `Week ${saved.week}, deepest floor ${saved.maxDepth || 0}.`;
  }
  renderTitleBest();
}

/* ------------------------------------------------------------------ */
/* Title                                                               */
/* ------------------------------------------------------------------ */

function showTitle() {
  screen = 'title';
  combat = null;
  setScreens('title');
  hideCombat();
}

function renderTitleBest() {
  const best = getBest(GAME_ID);
  const el = $('title-best');
  if (el) {
    el.textContent = best
      ? `Best descent on this device: ${best.toLocaleString('en-US')}`
      : 'No descent recorded on this device yet.';
  }
  const saved = loadCampaign();
  if (saved) {
    const cont = $('title-continue');
    if (cont) cont.hidden = false;
    const copy = $('title-continue-copy');
    if (copy) {
      copy.textContent = saved.completed
        ? 'That cellar is already quiet.'
        : `Week ${saved.week}, deepest floor ${saved.maxDepth || 0}.`;
    }
  }
  updateDifficultyButtons();
}

function updateDifficultyButtons() {
  document.querySelectorAll('[data-action="difficulty"]').forEach((button) => {
    const active = button.dataset.id === titleDifficulty;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const copy = $('difficulty-copy');
  if (copy) copy.textContent = DIFFICULTIES[titleDifficulty].text;
}

function startNewCampaign() {
  campaign = newCampaign({ difficulty: titleDifficulty, seed: Date.now() });
  rng = makeRng(campaign.seed);
  delveLog = [];
  runStart = null;
  combat = null;
  foughtBoss = false;
  saveCampaign(campaign);
  sound('bell');
  renderHouse();
}

function continueCampaign() {
  const saved = loadCampaign();
  if (!saved) {
    showTitle();
    return;
  }
  campaign = saved;
  rng = makeRng(campaign.seed + campaign.week * 7919);
  delveLog = [];
  runStart = null;
  if (campaign.over || campaign.completed) {
    renderEnd();
    return;
  }
  if (campaign.dungeon) {
    delveLog = [`You are still down there. Week ${campaign.week}.`];
    renderDelve();
  } else {
    renderHouse();
  }
}

/* ------------------------------------------------------------------ */
/* House                                                               */
/* ------------------------------------------------------------------ */

function renderHouse() {
  if (!campaign) {
    showTitle();
    return;
  }
  if (campaign.over || campaign.completed) {
    renderEnd();
    return;
  }
  screen = 'house';
  combat = null;
  hideCombat();
  setScreens('house');

  refs.houseWeek.textContent = String(campaign.week);
  refs.houseFlavour.textContent = HOUSE_NOTES[(campaign.week - 1) % HOUSE_NOTES.length];

  const supplies = Object.entries(ITEMS)
    .map(([id, item]) => `${campaign.inventory[id] || 0} ${item.name.toLowerCase()}`)
    .join(' · ');
  refs.houseStats.innerHTML = `
    <span class="stat-chip"><b>${campaign.coin}</b> coin</span>
    <span class="stat-chip"><b>${campaign.maxDepth || 0}</b> deepest</span>
    <span class="stat-chip"><b>${campaign.roster.length}</b>/${MAX_ROSTER} household</span>
    <span class="stat-chip stat-quiet">${supplies}</span>
  `;

  refs.partySlots.innerHTML = renderPartySlots();
  refs.heroList.innerHTML = campaign.roster.map(heroCardHtml).join('');
  refs.candidateList.innerHTML = renderCandidates();
  refs.shopList.innerHTML = renderShop();
  refs.descendCopy.innerHTML = renderDescendCopy();
  refs.descendButton.disabled = campaign.party.length !== 4;
  if (refs.quickDescend) {
    refs.quickDescend.disabled = campaign.party.length !== 4;
    refs.quickDescend.textContent =
      campaign.party.length === 4 ? 'Take the lamp down' : 'Choose four';
  }
  if (refs.houseDockCopy) {
    refs.houseDockCopy.textContent = `${campaign.party.length}/4 chosen · ${campaign.oil} oil`;
  }
  refs.memorial.innerHTML = renderMemorial();
}

function renderPartySlots() {
  const slots = [];
  for (let i = 0; i < 4; i += 1) {
    const hero = heroById(campaign, campaign.party[i]);
    if (!hero) {
      slots.push('<div class="party-slot is-empty"><span>Empty</span><small>Muster a hero</small></div>');
      continue;
    }
    const stats = derived(hero);
    slots.push(`
      <div class="party-slot">
        <button class="slot-remove" data-action="party" data-id="${hero.id}" aria-label="Stand ${fullName(hero)} down" title="Stand down">×</button>
        <span class="sigil">${HEROES[hero.id].sigil}</span>
        <div class="slot-text">
          <b>${fullName(hero)}</b>
          <small>${Math.max(0, hero.hp)}/${stats.maxHp} HP · ${hero.stress} stress</small>
        </div>
      </div>
    `);
  }
  return slots.join('');
}

function heroCardHtml(hero) {
  const template = HEROES[hero.id];
  const stats = derived(hero);
  const flaw = FLAWS[template.flaw];
  const inParty = campaign.party.includes(hero.id);
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / stats.maxHp) * 100));
  const stressPercent = Math.min(100, hero.stress);
  const conditions = [
    ...hero.injuries.map(
      (id) =>
        `<span class="chip chip-wound" title="${injuryById(id)?.text || ''}">${injuryById(id)?.name || id}</span>`
    ),
    ...hero.dreads.map(
      (id) =>
        `<span class="chip chip-dread" title="${dreadById(id)?.text || ''}">${dreadById(id)?.name || id}</span>`
    ),
  ].join('');

  const canSurgery = hero.injuries.length > 0 && campaign.coin >= 25;
  const canConfess = campaign.coin >= 20 && hero.stress > 0;
  const canLaudanum = (campaign.inventory.laudanum || 0) > 0 && hero.stress > 0;
  const partyFull = campaign.party.length >= 4 && !inParty;

  return `
    <article class="hero-card ${inParty ? 'is-mustered' : ''} ${hero.resting ? 'is-resting' : ''}">
      <header class="hero-card-head">
        <span class="sigil">${template.sigil}</span>
        <div class="hero-card-name">
          <h4>${template.name}</h4>
          <p>${template.epithet} · Level ${hero.level}</p>
        </div>
        <span class="hero-state">${hero.resting ? 'Resting' : inParty ? 'Muster' : 'At home'}</span>
      </header>
      <div class="bars">
        <div class="bar-line">
          <span>HP</span>
          <div class="bar bar-hp"><i style="width:${hpPercent}%"></i></div>
          <b>${Math.max(0, hero.hp)}/${stats.maxHp}</b>
        </div>
        <div class="bar-line">
          <span>Stress</span>
          <div class="bar bar-stress ${hero.stress >= 85 ? 'is-critical' : hero.stress >= 60 ? 'is-high' : ''}"><i style="width:${stressPercent}%"></i></div>
          <b>${hero.stress}</b>
        </div>
      </div>
      <p class="stat-line">Might ${stats.might} · Guard ${stats.guard} · Nerve ${stats.nerve} · Wit ${stats.wit}</p>
      <p class="rule-line"><b>${template.ability.name}.</b> ${template.ability.text}</p>
      <p class="rule-line rule-flaw"><b>${flaw.name}.</b> ${flaw.text}</p>
      ${conditions ? `<div class="chips">${conditions}</div>` : '<p class="chips-empty">No wounds, no dreads.</p>'}
      <div class="hero-buttons">
        <button class="mini ${inParty ? 'mini-active' : ''}" data-action="party" data-id="${hero.id}" ${(!inParty && (partyFull || hero.resting)) ? 'disabled' : ''}>${inParty ? 'Stand down' : 'Muster'}</button>
        <button class="mini" data-action="rest" data-id="${hero.id}">${hero.resting ? 'Wake' : 'Rest week'}</button>
        <button class="mini" data-action="surgery" data-id="${hero.id}" ${canSurgery ? '' : 'disabled'} title="Remove one wound for 25 coin">Surgery · 25</button>
        <button class="mini" data-action="confess" data-id="${hero.id}" ${canConfess ? '' : 'disabled'} title="Lower stress by 35 for 20 coin">Confess · 20</button>
        <button class="mini" data-action="laudanum" data-id="${hero.id}" ${canLaudanum ? '' : 'disabled'} title="Use one laudanum for 30 stress">Laudanum · ${campaign.inventory.laudanum || 0}</button>
      </div>
    </article>
  `;
}

function renderCandidates() {
  if (campaign.roster.length >= MAX_ROSTER) {
    return '<p class="quiet">The house is full. Eight is already too many.</p>';
  }
  const candidates = candidatesFor(campaign);
  if (!candidates.length) {
    return '<p class="quiet">No one else will meet your eye this week.</p>';
  }
  return candidates
    .map((id) => {
      const template = HEROES[id];
      const flaw = FLAWS[template.flaw];
      const cost = candidateCost(campaign, id);
      const affordable = campaign.coin >= cost;
      return `
        <article class="candidate">
          <div class="candidate-head">
            <span class="sigil">${template.sigil}</span>
            <div><h4>${template.name}</h4><p>${template.epithet}</p></div>
          </div>
          <p class="candidate-flavour">${template.flavour}</p>
          <p class="rule-line rule-flaw"><b>${flaw.name}.</b> ${flaw.text}</p>
          <p class="candidate-stat">Might ${template.might} · Guard ${template.guard} · Nerve ${template.nerve}</p>
          <div class="candidate-foot">
            <span class="price">${cost === 0 ? 'No charge — they are desperate' : `${cost} coin`}</span>
            <button class="mini" data-action="recruit" data-id="${id}" ${affordable ? '' : 'disabled'}>Take them in</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderShop() {
  return Object.entries(ITEMS)
    .map(([id, item]) => {
      const count = campaign.inventory[id] || 0;
      return `
        <div class="shop-row">
          <span class="shop-glyph">${item.glyph}</span>
          <div class="shop-text">
            <b>${item.name} <span class="owned">×${count}</span></b>
            <small>${item.text}</small>
          </div>
          <button class="mini" data-action="buy" data-id="${id}" ${campaign.coin >= item.cost ? '' : 'disabled'}>${item.cost} coin</button>
        </div>
      `;
    })
    .join('');
}

function renderDescendCopy() {
  const count = campaign.party.length;
  if (count < 4) {
    return `<p class="descend-warning">${4 - count} more must be mustered. Four go down, or no one does.</p>
      <p>${campaign.oil} oil in the lamp at the start. Six floors to the bottom.</p>`;
  }
  const resting = campaign.roster.filter((hero) => hero.resting).length;
  return `
    <p>Four are chosen. ${campaign.oil} oil in the lamp, and six floors between you and the thing at the altar.</p>
    <p class="descend-warning">Withdraw at any time to bank the loot. A wipe leaves it all below.</p>
    ${resting ? `<p class="quiet">${resting} ${resting === 1 ? 'hero is' : 'heroes are'} resting this week.</p>` : ''}
  `;
}

function renderMemorial() {
  if (!campaign.memorial.length) {
    return `<h3>Those who went down</h3><p class="quiet">The house has not lost anyone yet.</p>`;
  }
  const rows = campaign.memorial
    .slice()
    .reverse()
    .map(
      (entry) => `
        <li><b>${entry.name}</b><span>${entry.epithet}</span><small>Week ${entry.week} — ${entry.cause}</small></li>
      `
    )
    .join('');
  return `<h3>Those who went down</h3><ul class="memorial-list">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* Delve                                                               */
/* ------------------------------------------------------------------ */

function renderDelve() {
  if (!campaign || !campaign.dungeon) {
    renderHouse();
    return;
  }
  screen = 'delve';
  hideCombat();
  setScreens('delve');

  const dungeon = campaign.dungeon;
  const floor = FLOORS[Math.min(FLOORS.length - 1, campaign.depth - 1)];
  refs.floorName.textContent = floor.name;
  refs.floorDepth.innerHTML = `Floor <b>${campaign.depth}</b> of ${FLOORS.length} <span class="floor-sub">${floor.sub}</span>`;

  const oilPercent = Math.min(100, (campaign.oil / OIL_CAP) * 100);
  refs.mapHud.innerHTML = `
    <span class="hud-oil ${campaign.oil <= 8 ? 'is-low' : ''}">Lamp <span class="bar bar-oil"><i style="width:${oilPercent}%"></i></span> <b>${campaign.oil}</b></span>
    <span class="hud-loot">Loot <b>${campaign.loot}</b> coin</span>
    <span class="hud-depth">${dungeon.entities.filter((entity) => entity.kind === 'enemy' || entity.kind === 'boss').length} things moving</span>
    <button class="hud-button" data-action="use-oil" ${(campaign.inventory.oil || 0) > 0 && campaign.oil < OIL_CAP ? '' : 'disabled'}>Oil flask ×${campaign.inventory.oil || 0}</button>
  `;

  const visible = reveal(dungeon);
  const cells = [];
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < dungeon.w; x += 1) {
      cells.push(tileHtml(dungeon, x, y, visible));
    }
  }
  refs.map.innerHTML = cells.join('');

  refs.delveParty.innerHTML = campaign.party
    .map((id) => heroById(campaign, id))
    .filter(Boolean)
    .map(delveHeroHtml)
    .join('');
  refs.delveLog.innerHTML = delveLog
    .slice(-16)
    .map((line) => `<p>${line}</p>`)
    .join('');
  refs.delveLog.scrollTop = refs.delveLog.scrollHeight;
}

function tileHtml(dungeon, x, y, visible) {
  const isLit = visible.has(`${x},${y}`);
  const isSeen = Boolean(dungeon.seen[y][x]);
  const tile = dungeon.tiles[y][x];
  const partyHere = dungeon.party.x === x && dungeon.party.y === y;
  const entity = entityAt(dungeon, x, y);
  const adjacent = Math.abs(dungeon.party.x - x) + Math.abs(dungeon.party.y - y) === 1;
  const canStep = adjacent && isWalkable(dungeon, x, y) && !combat;

  const classes = ['tile'];
  if (!isSeen) classes.push('tile-unknown');
  else if (tile === WALL) classes.push('tile-wall');
  else classes.push('tile-floor');
  if (isSeen && !isLit) classes.push('is-remembered');
  if (isLit) classes.push('is-lit');
  if (canStep) classes.push('can-step');
  if (partyHere) classes.push('has-party');

  let content = '';
  let label = 'unseen stone';

  if (partyHere) {
    content = '<span class="glyph glyph-party">◉</span>';
    label = 'the party';
  } else if (entity && (isLit || isSeen)) {
    const info = ENTITY_INFO[entity.kind] || ENTITY_INFO.enemy;
    const glyph = entity.kind === 'enemy' ? '?' : info.glyph;
    content = `<span class="glyph ${info.className}">${glyph}</span>`;
    label = info.label;
  } else if (tile === STAIRS && isSeen) {
    content = '<span class="glyph entity-stairs">▼</span>';
    label = 'the stair down';
  } else if (tile === ALTAR && isSeen) {
    content = '<span class="glyph entity-altar">†</span>';
    label = 'the altar';
  }

  const aria = canStep ? `Move to ${label}` : label;
  return `<button type="button" class="${classes.join(' ')}" data-action="move" data-x="${x}" data-y="${y}" aria-label="${aria}" ${canStep ? '' : 'disabled'} tabindex="${canStep ? '0' : '-1'}">${content}</button>`;
}

function delveHeroHtml(hero) {
  const template = HEROES[hero.id];
  const stats = derived(hero);
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / stats.maxHp) * 100));
  const stressPercent = Math.min(100, hero.stress);
  const conditionCount = hero.injuries.length + hero.dreads.length;
  return `
    <div class="delve-hero ${hero.hp <= 0 ? 'is-down' : ''} ${hero.stress >= 85 ? 'is-frayed' : ''}">
      <div class="delve-hero-head">
        <span class="sigil">${template.sigil}</span>
        <b>${nameOf(hero)}</b>
        <span class="level">Lv ${hero.level}</span>
      </div>
      <div class="bar-line">
        <span>HP</span>
        <div class="bar bar-hp"><i style="width:${hpPercent}%"></i></div>
        <b>${Math.max(0, hero.hp)}</b>
      </div>
      <div class="bar-line">
        <span>Stress</span>
        <div class="bar bar-stress ${hero.stress >= 85 ? 'is-critical' : hero.stress >= 60 ? 'is-high' : ''}"><i style="width:${stressPercent}%"></i></div>
        <b>${hero.stress}</b>
      </div>
      <p class="delve-hero-note">${conditionCount ? `${conditionCount} mark${conditionCount === 1 ? '' : 's'} carried` : 'Steady, for now'}</p>
    </div>
  `;
}

function tileAt(x, y) {
  return campaign?.dungeon ? campaign.dungeon.tiles[y]?.[x] : undefined;
}

function tryMove(dx, dy) {
  if (screen !== 'delve' || combat || modalState || !campaign?.dungeon) return;
  const dungeon = campaign.dungeon;
  const nx = dungeon.party.x + dx;
  const ny = dungeon.party.y + dy;

  if (!isWalkable(dungeon, nx, ny)) {
    pushLog('The wall is wet and does not give.');
    renderDelve();
    return;
  }
  if (campaign.oil <= 0) {
    forcedWithdraw();
    return;
  }

  dungeon.prev = { ...dungeon.party };
  dungeon.party = { x: nx, y: ny };

  let oilCost = 1;
  for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
    const knee = hero.injuries.includes('knee') && rng.chance(0.15);
    const pull = hero.dreads.includes('pull') && rng.chance(0.18);
    if (knee) oilCost += 1;
    if (pull) oilCost += 2;
    if (knee || pull) {
      pushLog(`${nameOf(hero)} wanders a step before following; the lamp burns for it.`);
    }
    if (hero.dreads.includes('dark') && campaign.oil < 15) {
      stressHero(campaign, hero, 2, rng);
      pushLog(`${nameOf(hero)} presses close to the light.`);
    }
  }
  campaign.oil = Math.max(0, campaign.oil - oilCost);
  sound('step');

  reveal(dungeon);

  const handled = resolveTile(nx, ny);
  if (handled) return;

  if (!modalState) {
    const reached = roamEnemies(dungeon, rng);
    if (reached) {
      pushLog('Something finds the lamp.');
      startFight([reached]);
      return;
    }
  }

  if (campaign.oil <= 0) pushLog('The lamp is out. One more step and they will have to climb.');
  saveCampaign(campaign);
  renderDelve();
}

function resolveTile(x, y) {
  const dungeon = campaign.dungeon;
  const entity = entityAt(dungeon, x, y);
  const tile = tileAt(x, y);

  if (entity) {
    if (entity.kind === 'enemy' || entity.kind === 'boss') {
      startFight([entity]);
      return true;
    }
    if (entity.kind === 'cache') {
      resolveCache(entity);
      return false;
    }
    if (entity.kind === 'shrine') {
      openShrine(entity);
      return true;
    }
    if (entity.kind === 'lore') {
      openLore(entity);
      return true;
    }
    if (entity.kind === 'trap') {
      resolveTrap(entity);
      return false;
    }
  }

  if (tile === STAIRS) {
    askDescend();
    return true;
  }
  return false;
}

function resolveCache(entity) {
  const dungeon = campaign.dungeon;
  const coins = rng.int(12, 26);
  campaign.loot += coins;
  clearEntities(dungeon, [entity.uid]);
  let extra = '';
  if (rng.chance(0.35)) {
    const pick = rng.pick(Object.keys(ITEMS));
    campaign.inventory[pick] = (campaign.inventory[pick] || 0) + 1;
    extra = ` Inside: one ${ITEMS[pick].name.toLowerCase()}.`;
  }
  pushLog(`${rng.pick(CACHE_FLAVOUR)} ${coins} coin.${extra}`);
  sound('coin');
  saveCampaign(campaign);
  renderDelve();
}

function resolveTrap(entity) {
  const dungeon = campaign.dungeon;
  clearEntities(dungeon, [entity.uid]);
  const heroes = campaign.party.map((id) => heroById(campaign, id)).filter((hero) => hero && hero.hp > 0);
  if (!heroes.length) {
    saveCampaign(campaign);
    renderDelve();
    return;
  }
  const hero = rng.pick(heroes);
  const stats = derived(hero);
  const dodge = 0.1 + stats.nerve * 0.05;
  if (rng.chance(dodge)) {
    pushLog(`${rng.pick(TRAP_FLAVOUR)} ${nameOf(hero)} is already moving. Nothing catches them.`);
    renderDelve();
    return;
  }
  const damage = rng.int(3, 5) + campaign.depth;
  hero.hp = Math.max(1, hero.hp - damage);
  const result = stressHero(campaign, hero, 5, rng);
  let wound = '';
  if (rng.chance(0.25)) {
    const injury = addInjury(hero, rng);
    if (injury) wound = ` ${nameOf(hero)} takes ${injury.name}.`;
  }
  pushLog(`${rng.pick(TRAP_FLAVOUR)} ${nameOf(hero)} loses ${damage} HP and gains ${result.gain} stress.${wound}`);
  if (result.broke && result.dread) {
    pushLog(`${nameOf(hero)} breaks. ${result.dread.name} takes hold.`);
  }
  if (result.lost) pushLog(`${nameOf(hero)} goes somewhere the lamp cannot follow.`);
  sound('hit');
  saveCampaign(campaign);
  renderDelve();
}

function openShrine(entity) {
  renderDelve();
  openModal({
    eyebrow: 'The cellar has a congregation',
    title: SHRINE.title,
    html: `<p class="modal-prose">${SHRINE.text}</p>`,
    dismissible: true,
    actions: SHRINE.options.map((option) => ({
      label: option.label,
      detail: option.text,
      onClick: () => {
        campaign.dungeon && clearEntities(campaign.dungeon, [entity.uid]);
        if (option.id === 'kneel') {
          for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
            reduceStress(hero, 12);
          }
          pushLog('They kneel in the black water. The humming eases.');
        } else if (option.id === 'take') {
          campaign.loot += 26;
          for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
            stressHero(campaign, hero, 6, rng);
          }
          pushLog('They take the offering. The bowl is empty and 26 coin heavier.');
        } else {
          const pick = rng.pick(Object.keys(ITEMS));
          campaign.inventory[pick] = (campaign.inventory[pick] || 0) + 1;
          for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
            stressHero(campaign, hero, 10, rng);
          }
          pushLog(`They overturn the bowl. Something rolls out: one ${ITEMS[pick].name.toLowerCase()}.`);
        }
        sound('bell');
        saveCampaign(campaign);
        renderDelve();
      },
    })).concat([
      {
        label: 'Leave it be',
        onClick: () => {
          saveCampaign(campaign);
          renderDelve();
        },
      },
    ]),
  });
}

function openLore(entity) {
  const lore = LORES.find((entry) => entry.id === entity.loreId) || LORES[0];
  campaign.dungeon && clearEntities(campaign.dungeon, [entity.uid]);

  if (lore.boon === 'stress') {
    for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
      reduceStress(hero, lore.amount);
    }
  } else if (lore.boon === 'coin') {
    campaign.loot += lore.amount;
  } else if (lore.boon === 'xp') {
    for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
      gainXp(hero, lore.amount);
    }
  } else if (lore.boon === 'oil') {
    campaign.oil = Math.min(OIL_CAP, campaign.oil + lore.amount);
  }

  pushLog(`${lore.title}. ${lore.boonText}`);
  sound('page');
  saveCampaign(campaign);
  renderDelve();
  openModal({
    eyebrow: 'Something left behind',
    title: lore.title,
    html: `<p class="modal-prose">${lore.text}</p><p class="modal-effect">${lore.boonText}</p>`,
    actions: [{ label: 'Pocket it and move on', onClick: () => renderDelve() }],
  });
}

function askDescend() {
  renderDelve();
  const nextDepth = campaign.depth + 1;
  const last = nextDepth >= FLOORS.length;
  openModal({
    eyebrow: 'The stair goes down',
    title: last ? 'The door that was not built for people' : `Floor ${nextDepth}: ${FLOORS[nextDepth - 1].name}`,
    html: `<p class="modal-prose">${
      last
        ? 'The stair ends at a small wet door. Beyond it, something is kneeling at an altar and has been expecting the lamp. There is no way back up from this room except through it.'
        : 'The stair drops away into the next room. The lamp gutters, then holds. Descending will cost 5 more oil.'
    }</p>
    <p class="modal-effect">Lamp: ${campaign.oil} oil · Loot: ${campaign.loot} coin</p>`,
    dismissible: true,
    actions: [
      {
        label: last ? 'Open the door' : 'Go down',
        onClick: () => {
          descendNow();
        },
      },
      {
        label: 'Not yet',
        onClick: () => {
          saveCampaign(campaign);
          renderDelve();
        },
      },
    ],
  });
}

function descendNow() {
  const notes = descendFloor(campaign, rng);
  const floor = FLOORS[Math.min(FLOORS.length - 1, campaign.depth - 1)];
  delveLog.push(`<b>Floor ${campaign.depth}: ${floor.name}.</b>`);
  delveLog.push(floor.intro);
  for (const note of notes) delveLog.push(note);
  if (campaign.oil > 0 && campaign.oil <= 8) delveLog.push('The lamp is nearly out.');
  sound('descend');
  saveCampaign(campaign);
  renderDelve();
}

function requestWithdraw() {
  if (screen !== 'delve' || !campaign?.dungeon) return;
  openModal({
    eyebrow: 'Back up the stair',
    title: 'Withdraw the party?',
    html: `<p class="modal-prose">They can leave now, bank ${campaign.loot} coin, and send someone else next week. The cellar keeps everything it has already taken.</p>`,
    dismissible: true,
    actions: [
      { label: 'Climb back up', onClick: () => completeExpedition({ forced: false }) },
      { label: 'Press on' },
    ],
  });
}

function forcedWithdraw() {
  if (!campaign?.dungeon) return;
  const kept = Math.floor(campaign.loot / 2);
  campaign.loot = kept;
  for (const hero of campaign.party.map((id) => heroById(campaign, id)).filter(Boolean)) {
    stressHero(campaign, hero, 8, rng);
  }
  sound('death');
  completeExpedition({ forced: true });
}

function completeExpedition({ forced = false } = {}) {
  if (!campaign) return;
  const summary = {
    depth: campaign.depth,
    banked: campaign.loot,
    kills: campaign.kills - (runStart?.kills || campaign.kills),
    conditions: [],
    losses: campaign.memorial.slice(runStart?.memorial || campaign.memorial.length),
    forced,
  };

  if (runStart?.conditions) {
    for (const hero of campaign.roster) {
      const before = runStart.conditions[hero.id];
      if (!before) continue;
      const newInjuries = hero.injuries.filter((id) => !before.injuries.includes(id));
      const newDreads = hero.dreads.filter((id) => !before.dreads.includes(id));
      if (newInjuries.length || newDreads.length) {
        summary.conditions.push({
          name: fullName(hero),
          injuries: newInjuries.map((id) => injuryById(id)?.name || id),
          dreads: newDreads.map((id) => dreadById(id)?.name || id),
        });
      }
    }
  }

  campaign.coin += summary.banked;
  campaign.dungeon = null;
  delveLog = [];
  combat = null;
  hideCombat();
  advanceWeek(campaign, rng);

  if (campaign.over) {
    finishCampaign(campaign, false, campaign.overReason || 'The house goes dark.');
    saveCampaign(campaign);
    renderEnd();
    return;
  }

  saveCampaign(campaign);
  renderHouse();
  showExpeditionSummary(summary);
}

function showExpeditionSummary(summary) {
  const conditions = summary.conditions.length
    ? `<ul class="summary-list">${summary.conditions
        .map(
          (entry) =>
            `<li><b>${entry.name}</b>: ${[...entry.injuries, ...entry.dreads].join(', ')}</li>`
        )
        .join('')}</ul>`
    : '<p class="modal-effect">No new marks. This time.</p>';
  const losses = summary.losses.length
    ? `<p class="modal-loss">Lost below: ${summary.losses.map((entry) => entry.name).join(', ')}.</p>`
    : '';
  openModal({
    eyebrow: 'The lamp comes back up',
    title: summary.forced ? 'The lamp went out' : 'Back at the house',
    html: `
      <p class="modal-prose">${
        summary.forced
          ? 'They climbed in the dark. Half the loot stayed below with whatever was counting it.'
          : 'They climb the thirteen steps into the cellar, wet to the knee and carrying what they could.'
      }</p>
      <div class="summary-grid">
        <span><small>Deepest floor</small><b>${summary.depth}</b></span>
        <span><small>Horrors</small><b>${summary.kills}</b></span>
        <span><small>Coin banked</small><b>${summary.banked}</b></span>
      </div>
      ${conditions}
      ${losses}
      <p class="modal-effect">Week ${campaign.week}. The house is still standing.</p>
    `,
    dismissible: false,
    actions: [{ label: 'Back to the house', onClick: () => renderHouse() }],
  });
}

/* ------------------------------------------------------------------ */
/* Combat                                                              */
/* ------------------------------------------------------------------ */

function startFight(primary) {
  if (!campaign?.dungeon) return;
  const dungeon = campaign.dungeon;
  let entities = Array.isArray(primary) ? primary.slice() : [primary];
  if (!entities.some((entity) => entity.kind === 'boss')) {
    const nearby = dungeon.entities
      .filter(
        (entity) =>
          entity.kind === 'enemy' &&
          !entities.some((chosen) => chosen.uid === entity.uid) &&
          Math.max(Math.abs(entity.x - dungeon.party.x), Math.abs(entity.y - dungeon.party.y)) <= 2 &&
          rng.chance(0.45)
      )
      .slice(0, 2);
    if (nearby.length) {
      entities = entities.concat(nearby);
      pushLog('Others come at the sound of the lamp.');
    }
  }
  fightEntities = entities;
  foughtBoss = entities.some((entity) => entity.kind === 'boss');
  combat = startCombat(campaign, entities, rng);
  selectedEnemy = combat.enemies.find((enemy) => enemy.hp > 0)?.uid || null;
  screen = 'delve';
  setScreens('delve');
  refs.delve.hidden = true;
  refs.combat.hidden = false;
  sound(foughtBoss ? 'boss' : 'encounter');
  renderCombat();
  window.scrollTo(0, 0);
}

function hideCombat() {
  if (refs.combat) refs.combat.hidden = true;
}

function renderCombat() {
  if (!combat) return;
  refs.combatRound.textContent = String(combat.round);
  refs.combatTitle.textContent = foughtBoss
    ? BOSS.name
    : combat.enemies.length === 1
      ? combat.enemies[0].name
      : 'The dark comes in numbers';

  if (!combat.enemies.some((enemy) => enemy.uid === selectedEnemy && enemy.hp > 0)) {
    selectedEnemy = combat.enemies.find((enemy) => enemy.hp > 0)?.uid || null;
  }

  refs.enemyRow.innerHTML = combat.enemies
    .map((enemy) => {
      const hpPercent = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
      const intent = enemy.intent?.label || 'It watches.';
      return `
        <button class="enemy-card ${enemy.uid === selectedEnemy ? 'is-targeted' : ''} ${enemy.boss ? 'is-boss' : ''} ${enemy.hp <= 0 ? 'is-dead' : ''}" data-action="target" data-uid="${enemy.uid}" ${enemy.hp <= 0 ? 'disabled' : ''}>
          <span class="enemy-glyph">${enemy.glyph}</span>
          <span class="enemy-name">${enemy.name}</span>
          <span class="bar bar-enemy"><i style="width:${hpPercent}%"></i></span>
          <span class="enemy-hp">${Math.max(0, enemy.hp)} / ${enemy.maxHp}</span>
          <span class="enemy-intent ${enemy.stun > 0 ? 'is-stunned' : ''}">${enemy.hp <= 0 ? 'It is coming apart.' : enemy.stun > 0 ? 'It is staggered and will lose a turn.' : intent}</span>
        </button>
      `;
    })
    .join('');

  refs.combatLog.innerHTML = combat.log
    .slice(-14)
    .map((entry) => `<p class="${entry.kind ? `log-${entry.kind}` : ''}">${entry.text}</p>`)
    .join('');
  refs.combatLog.scrollTop = refs.combatLog.scrollHeight;

  const hero = activeHero(campaign, combat);
  if (!hero) {
    refs.activePanel.innerHTML = '<p class="quiet">The horrors move.</p>';
    refs.combatActions.innerHTML = '';
  } else {
    const template = HEROES[hero.id];
    const stats = derived(hero, { allyDown: campaign.party.some((id) => heroById(campaign, id)?.hp <= 0) });
    const downed = campaign.party
      .map((id) => heroById(campaign, id))
      .find((ally) => ally && ally.hp <= 0);
    const cooldown = combat.cooldowns[hero.id] || 0;
    const healOnly = template.ability.kind === 'heal';
    const anyoneWounded = campaign.party.some((id) => {
      const ally = heroById(campaign, id);
      return ally && ally.hp > 0 && ally.hp < derived(ally).maxHp;
    });
    const abilityUsable = cooldown <= 0 && (!healOnly || anyoneWounded);
    const target = combat.enemies.find((enemy) => enemy.uid === selectedEnemy && enemy.hp > 0);
    const expected = target ? Math.max(1, stats.might - target.guard) : 0;
    const hpPercent = Math.max(0, (hero.hp / stats.maxHp) * 100);
    const stressPercent = Math.min(100, hero.stress);

    refs.activePanel.innerHTML = `
      <div class="active-head">
        <span class="sigil">${template.sigil}</span>
        <div>
          <b>${template.name}</b>
          <small>${template.epithet}</small>
        </div>
        <span class="turn-label">Their turn</span>
      </div>
      <div class="bar-line">
        <span>HP</span>
        <div class="bar bar-hp"><i style="width:${hpPercent}%"></i></div>
        <b>${Math.max(0, hero.hp)}/${stats.maxHp}</b>
      </div>
      <div class="bar-line">
        <span>Stress</span>
        <div class="bar bar-stress ${hero.stress >= 85 ? 'is-critical' : hero.stress >= 60 ? 'is-high' : ''}"><i style="width:${stressPercent}%"></i></div>
        <b>${hero.stress}</b>
      </div>
    `;

    refs.combatActions.innerHTML = `
      <button class="combat-button" data-action="combat" data-act="strike" ${target ? '' : 'disabled'}>
        <span>Strike</span><small>${target ? `${expected}–${expected + 2} damage` : 'no target'}</small>
      </button>
      <button class="combat-button" data-action="combat" data-act="guard">
        <span>Guard</span><small>Halve the next blows</small>
      </button>
      <button class="combat-button" data-action="combat" data-act="ability" ${abilityUsable ? '' : 'disabled'} title="${template.ability.text}">
        <span>${template.ability.name}</span><small>${cooldown > 0 ? `Ready in ${cooldown}` : healOnly && !anyoneWounded ? 'No wounds' : 'Ready'}</small>
      </button>
      <button class="combat-button" data-action="combat" data-act="item" ${(campaign.inventory.bandages || 0) > 0 ? '' : 'disabled'}>
        <span>Bandages</span><small>${campaign.inventory.bandages || 0} left · heal 10</small>
      </button>
      ${
        downed
          ? `<button class="combat-button combat-danger" data-action="combat" data-act="stabilise" data-ally="${downed.id}">
              <span>Stabilise</span><small>Save ${nameOf(downed)}</small>
            </button>`
          : ''
      }
      <button class="combat-button combat-quiet" data-action="combat" data-act="flee">
        <span>Break away</span><small>55% to get out</small>
      </button>
    `;
  }

  refs.combatParty.innerHTML = campaign.party
    .map((id) => heroById(campaign, id))
    .filter(Boolean)
    .map((partyHero) => {
      const stats = derived(partyHero);
      const hpPercent = Math.max(0, (partyHero.hp / stats.maxHp) * 100);
      const stressPercent = Math.min(100, partyHero.stress);
      return `
        <div class="combat-hero ${partyHero.hp <= 0 ? 'is-down' : ''} ${hero && partyHero.id === hero.id ? 'is-active' : ''}">
          <div class="combat-hero-head"><b>${nameOf(partyHero)}</b><span>${Math.max(0, partyHero.hp)}/${stats.maxHp}</span></div>
          <div class="bar bar-hp"><i style="width:${hpPercent}%"></i></div>
          <div class="bar bar-stress"><i style="width:${stressPercent}%"></i></div>
          <small>${partyHero.hp <= 0 ? 'DOWN — stabilise or lose them' : `${partyHero.stress} stress`}</small>
        </div>
      `;
    })
    .join('');
}

function doCombatAction(act, extra = {}) {
  if (!combat || combat.over) return;
  const hero = activeHero(campaign, combat);
  if (!hero) return;
  const before = combat.log.length;

  if (act === 'guard') {
    heroAction(campaign, combat, { type: 'guard' }, rng);
    sound('guard');
  } else if (act === 'ability') {
    const ability = HEROES[hero.id].ability;
    const targeted = ['damage', 'stun', 'weaken'].includes(ability.kind);
    heroAction(
      campaign,
      combat,
      { type: 'ability', targetUid: targeted ? selectedEnemy : null, allyId: extra.allyId },
      rng
    );
    sound(ability.kind === 'heal' || ability.kind === 'healAll' ? 'heal' : 'cast');
  } else if (act === 'item') {
    heroAction(campaign, combat, { type: 'item', itemId: 'bandages' }, rng);
    sound('heal');
  } else if (act === 'stabilise') {
    heroAction(campaign, combat, { type: 'stabilise', allyId: extra.allyId }, rng);
    sound('heal');
  } else if (act === 'flee') {
    heroAction(campaign, combat, { type: 'flee' }, rng);
  } else {
    heroAction(campaign, combat, { type: 'strike', targetUid: selectedEnemy }, rng);
  }

  playCombatSounds(before);

  if (combat.over) {
    renderCombat();
    showCombatResult();
  } else {
    if (!combat.enemies.some((enemy) => enemy.uid === selectedEnemy && enemy.hp > 0)) {
      selectedEnemy = combat.enemies.find((enemy) => enemy.hp > 0)?.uid || null;
    }
    renderCombat();
  }
}

function playCombatSounds(fromIndex) {
  if (!combat) return;
  const entries = combat.log.slice(fromIndex);
  if (entries.some((entry) => entry.kind === 'death')) sound('death');
  else if (entries.some((entry) => entry.kind === 'break')) sound('break');
  else if (entries.some((entry) => entry.kind === 'hit')) sound('hit');
  else if (entries.some((entry) => entry.kind === 'stress')) sound('stress');
  else if (entries.some((entry) => entry.kind === 'heal' || entry.kind === 'ward')) sound('ward');
  else if (entries.some((entry) => entry.kind === 'good')) sound('coin');
}

function showCombatResult() {
  if (!combat) return;
  const result = combat.result;
  if (result === 'victory') {
    sound(foughtBoss ? 'win' : 'victory');
    openModal({
      eyebrow: 'The room goes quiet',
      title: foughtBoss ? 'The Unnamed Below is still' : 'It is over, for now',
      html: `
        <p class="modal-prose">${
          foughtBoss
            ? 'The thing comes apart like a house falling under its own weight. The altar is only stone. Above, the stair is only twelve steps long. The house is exactly as tall as it should be.'
            : 'The lamp steadies. Whatever was in the room with them has stopped being in the room.'
        }</p>
        <div class="summary-grid">
          <span><small>Coin carried</small><b>+${combat.reward.coin}</b></span>
          <span><small>Experience</small><b>+${combat.reward.xp}</b></span>
          <span><small>Horrors</small><b>${combat.enemies.length}</b></span>
        </div>
        ${combat.deaths.length ? `<p class="modal-loss">They do not get up: ${combat.deaths.join(', ')}.</p>` : ''}
        <p class="modal-effect">${
          campaign.inventory.bandages > 0
            ? `${campaign.inventory.bandages} bandage${campaign.inventory.bandages === 1 ? '' : 's'} left in the bag.`
            : 'The bag is empty of bandages.'
        }</p>
      `,
      dismissible: false,
      actions: [{ label: 'Onward', onClick: finishVictoryUi }],
    });
  } else if (result === 'fled') {
    openModal({
      eyebrow: 'Out of the room',
      title: 'They get away',
      html: `<p class="modal-prose">They come back to the last lit room with their backs to the wall and their breath loud. The thing is still down there. It can wait.</p>`,
      dismissible: false,
      actions: [{ label: 'Catch their breath', onClick: finishFleeUi }],
    });
  } else {
    sound('death');
    openModal({
      eyebrow: 'The lamp goes out',
      title: 'No one comes up the stair',
      html: `<p class="modal-prose">The dark takes the light first, then the voices, then the names. In the house above, the cellar door is warm to the touch.</p>
      <p class="modal-loss">Lost below: ${combat.deaths.join(', ') || 'the whole party'}.</p>`,
      dismissible: false,
      actions: [{ label: 'Return to the house', onClick: finishDefeatUi }],
    });
  }
}

function finishVictoryUi() {
  if (!combat) return;
  const dungeon = campaign.dungeon;
  if (dungeon) clearEntities(dungeon, combat.entityUids);
  combat = null;
  hideCombat();
  if (foughtBoss) {
    finishCampaign(campaign, true, 'The cellar is quiet.');
    saveCampaign(campaign);
    renderEnd();
    return;
  }
  delveLog.push('The party presses on.');
  saveCampaign(campaign);
  renderDelve();
}

function finishFleeUi() {
  const dungeon = campaign.dungeon;
  if (dungeon) {
    if (entityAt(dungeon, dungeon.party.x, dungeon.party.y)) {
      dungeon.party = { ...dungeon.prev };
    }
    dungeon.calm = 4;
    delveLog.push('Their hands shake. The dark behind them keeps its distance, for now.');
    reveal(dungeon);
  }
  combat = null;
  hideCombat();
  saveCampaign(campaign);
  renderDelve();
}

function finishDefeatUi() {
  const deaths = combat ? combat.deaths.slice() : [];
  combat = null;
  hideCombat();
  campaign.dungeon = null;
  campaign.loot = 0;
  delveLog = [];
  advanceWeek(campaign, rng);
  if (campaign.over) {
    finishCampaign(campaign, false, campaign.overReason || 'The house goes dark.');
    saveCampaign(campaign);
    renderEnd();
    return;
  }
  saveCampaign(campaign);
  renderHouse();
  openModal({
    eyebrow: 'The house is quieter',
    title: 'Four went down',
    html: `<p class="modal-prose">The cellar door is shut in the morning. No one asks where the party went. ${deaths.length ? `${deaths.join(', ')} ${deaths.length === 1 ? 'is' : 'are'} added to the wall.` : ''}</p>
    <p class="modal-effect">There are still people in this house. Send four more, while they will still go.</p>`,
    dismissible: false,
    actions: [{ label: 'Back to the house', onClick: () => renderHouse() }],
  });
}

/* ------------------------------------------------------------------ */
/* End screen                                                          */
/* ------------------------------------------------------------------ */

function renderEnd() {
  if (!campaign) {
    showTitle();
    return;
  }
  screen = 'end';
  combat = null;
  hideCombat();
  setScreens('end');

  if (!campaign.scored) {
    submitScore(GAME_ID, campaign.score || 0);
    campaign.scored = true;
    saveCampaign(campaign);
  }

  const victory = Boolean(campaign.completed);
  const survivors = campaign.roster.map((hero) => fullName(hero));
  const best = getBest(GAME_ID);
  refs.end.innerHTML = `
    <div class="end-card ${victory ? 'is-victory' : 'is-defeat'}">
      <p class="eyebrow">14 Halloway Street</p>
      <h2 class="end-title">${victory ? 'The Cellar Is Quiet' : 'The House Goes Dark'}</h2>
      <p class="end-prose">${
        victory
          ? 'The jars are empty. The stair behind the cellar door is twelve steps long. The house above it is exactly as tall as it should be, and the lamp is only a lamp. For now.'
          : campaign.overReason || 'There are not four people left in this house who will go down. By morning, the cellar door is bricked over. Something behind it keeps time with your footsteps.'
      }</p>
      <div class="end-stats">
        <span><small>Weeks</small><b>${campaign.week}</b></span>
        <span><small>Deepest floor</small><b>${campaign.maxDepth || 0}</b></span>
        <span><small>Horrors slain</small><b>${campaign.kills}</b></span>
        <span><small>Survivors</small><b>${campaign.roster.length}</b></span>
      </div>
      <p class="end-score">Score <b>${(campaign.score || 0).toLocaleString('en-US')}</b> · Best on this device <b>${best.toLocaleString('en-US')}</b></p>
      ${survivors.length && victory ? `<p class="end-survivors">Still standing: ${survivors.join(', ')}.</p>` : ''}
      ${
        campaign.memorial.length
          ? `<details class="end-memorial"><summary>${campaign.memorial.length} left below</summary><ul>${campaign.memorial
              .map((entry) => `<li>${entry.name} — ${entry.cause}, week ${entry.week}</li>`)
              .join('')}</ul></details>`
          : ''
      }
      <div class="end-actions">
        <button class="big-button" data-action="new-campaign">Begin again</button>
        <a class="text-link" href="../../../games.html">Back to all games</a>
      </div>
      <p class="content-note">A new campaign starts at week one with a fresh household.</p>
    </div>
  `;
}

function requestNewCampaign() {
  if (campaign || loadCampaign()) {
    openModal({
      eyebrow: '14 Halloway Street',
      title: 'Begin again?',
      html: `<p class="modal-prose">This house, its household and everyone on the memorial wall will be forgotten. A new family moves in, with a new lamp and the same stair.</p>`,
      dismissible: true,
      actions: [
        {
          label: 'Begin a new campaign',
          onClick: () => {
            titleDifficulty = campaign?.difficulty || titleDifficulty;
            campaign = null;
            startNewCampaign();
          },
        },
        { label: 'Keep this house' },
      ],
    });
  } else {
    startNewCampaign();
  }
}

/* ------------------------------------------------------------------ */
/* Screens, modal, events                                              */
/* ------------------------------------------------------------------ */

function setScreens(active) {
  document.body.classList.toggle('is-in-game', active !== 'title');
  refs.title.hidden = active !== 'title';
  refs.house.hidden = active !== 'house';
  refs.delve.hidden = active !== 'delve';
  refs.end.hidden = active !== 'end';
  if (active !== 'delve') hideCombat();
  if (lastScreen !== null && lastScreen !== active) window.scrollTo(0, 0);
  lastScreen = active;
}

function openModal({ eyebrow = '', title, html = '', actions = [], dismissible = true }) {
  modalState = { actions, dismissible };
  refs.modalBody.innerHTML = `
    ${eyebrow ? `<p class="modal-eyebrow">${eyebrow}</p>` : ''}
    <h2 id="modal-title">${title}</h2>
    <div class="modal-content">${html}</div>
    <div class="modal-actions">
      ${actions
        .map(
          (action, index) =>
            `<button class="modal-button ${action.danger ? 'is-danger' : ''}" data-modal-index="${index}">${action.label}${
              action.detail ? `<small>${action.detail}</small>` : ''
            }</button>`
        )
        .join('')}
    </div>
  `;
  refs.modal.hidden = false;
  refs.modal.classList.add('is-open');
  const first = refs.modal.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}

function closeModal() {
  refs.modal.hidden = true;
  refs.modal.classList.remove('is-open');
  modalState = null;
}

function pushLog(text) {
  delveLog.push(text);
  if (delveLog.length > 60) delveLog.shift();
}

let toastTimer = null;
function toast(message) {
  const element = $('game-toast');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  element.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    element.classList.remove('is-visible');
    element.hidden = true;
  }, 2800);
}

function showHelp() {
  openModal({
    eyebrow: 'How to play',
    title: 'The house, the stair, the lamp',
    dismissible: true,
    html: `
      <p class="modal-prose">You are the overseer. You cannot go down the stair yourself — the house will not let you. What you can do is fill the lamp, choose who goes, and watch.</p>
      <h3 class="modal-head">Each week</h3>
      <ul class="modal-list">
        <li>Muster <b>four heroes</b> from your household. Everyone else stays, rests, or is treated.</li>
        <li><b>Rest</b> a hero for the week to lower stress by 50, heal fully, and close one wound. They cannot delve.</li>
        <li><b>Surgery</b> (25 coin) removes a wound. <b>Confession</b> (20 coin) lowers stress by 35. Laudanum comes from the cupboard.</li>
        <li>Coin buys supplies and new volunteers. Wounds and dreads are carried between weeks, not erased.</li>
      </ul>
      <h3 class="modal-head">Below the house</h3>
      <ul class="modal-list">
        <li>Click a lit neighbouring tile or use the arrow keys / WASD. Every step burns lamp oil.</li>
        <li>Find the stair down. Six floors wait, and something is kneeling on the last one.</li>
        <li>Withdraw at any time to bank the loot. If the lamp runs dry, half the loot stays below.</li>
        <li><b>?</b> on the map is a horror, <b>▼</b> is the stair, <b>¤</b> a strongbox, <b>†</b> a shrine, <b>§</b> a paper relic, <b>✶</b> a trap.</li>
      </ul>
      <h3 class="modal-head">Fighting</h3>
      <ul class="modal-list">
        <li>Heroes act first, one at a time. Each horror shows what it will do next — read it.</li>
        <li><b>Guard</b> halves the next round's blows. <b>Strike</b> is the reliable option. Abilities recharge over rounds.</li>
        <li>A hero at 0 HP is <b>dying</b>. Spend an action to <b>Stabilise</b> them before the last horror falls, or the cellar keeps them. They carry a new wound home.</li>
        <li>Fleeing is 55% likely. The dark does not chase immediately, but the thing is still there.</li>
      </ul>
      <h3 class="modal-head">Wounds and dread</h3>
      <ul class="modal-list">
        <li>Stress climbs from horror attacks, traps, shrines and watching allies fall. At <b>100 stress a hero breaks</b> and gains a dread.</li>
        <li>Dreads are permanent for that hero. <b>Three dreads</b> and they are lost to the house entirely.</li>
        <li>Wounds lower stats until treated or rested off. They make the next descent harder, not impossible.</li>
      </ul>
      <p class="modal-effect">Keys in combat: 1 strike · 2 guard · 3 ability · 4 bandages · 5 flee. The game autosaves between fights.</p>
      <p class="modal-effect">Gothic horror, eerie rather than gory. The house is hard; the roster is the game.</p>
    `,
    actions: [{ label: 'I understand' }],
  });
}

function refreshMute() {
  if (!refs.muteButton) return;
  const muted = isMuted();
  refs.muteButton.textContent = muted ? 'Sound off' : 'Sound on';
  refs.muteButton.setAttribute('aria-pressed', String(muted));
}

function bindEvents() {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    unlockAudio();
    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'difficulty') {
      titleDifficulty = id;
      updateDifficultyButtons();
      sound('click');
      return;
    }
    if (action === 'new-campaign') {
      requestNewCampaign();
      return;
    }
    if (action === 'continue') {
      continueCampaign();
      return;
    }
    if (action === 'mute') {
      toggleMuted();
      refreshMute();
      return;
    }
    if (action === 'help') {
      showHelp();
      return;
    }
    if (!campaign) return;

    if (action === 'party') {
      const error = toggleParty(campaign, id);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('click');
    } else if (action === 'rest') {
      toggleRest(campaign, id);
      saveCampaign(campaign);
      renderHouse();
      sound('click');
    } else if (action === 'surgery') {
      const error = treatInjury(campaign, id, 0);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('heal');
    } else if (action === 'confess') {
      const error = confess(campaign, id);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('bell');
    } else if (action === 'laudanum') {
      const error = useLaudanum(campaign, id);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('heal');
    } else if (action === 'recruit') {
      const error = recruit(campaign, id);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('bell');
    } else if (action === 'buy') {
      const error = buyItem(campaign, id);
      if (error) toast(error);
      saveCampaign(campaign);
      renderHouse();
      sound('coin');
    } else if (action === 'descend') {
      if (campaign.party.length !== 4) return;
      const result = beginDelve(campaign, rng);
      if (result.error) {
        toast(result.error);
        renderHouse();
        return;
      }
      runStart = snapshotRun();
      const floor = FLOORS[0];
      delveLog = [`<b>Week ${campaign.week}. ${floor.name}.</b>`, floor.intro, ...(result.notes || [])];
      saveCampaign(campaign);
      sound('descend');
      renderDelve();
    } else if (action === 'withdraw') {
      requestWithdraw();
    } else if (action === 'use-oil') {
      if ((campaign.inventory.oil || 0) <= 0 || campaign.oil >= OIL_CAP) return;
      campaign.inventory.oil -= 1;
      campaign.oil = Math.min(OIL_CAP, campaign.oil + 50);
      pushLog('They feed the lamp. The flame steadies and the dark takes a step back.');
      sound('oil');
      saveCampaign(campaign);
      renderDelve();
    } else if (action === 'move') {
      const x = Number(button.dataset.x);
      const y = Number(button.dataset.y);
      const dungeon = campaign.dungeon;
      if (!dungeon) return;
      tryMove(x - dungeon.party.x, y - dungeon.party.y);
    } else if (action === 'target') {
      if (!combat) return;
      selectedEnemy = button.dataset.uid;
      renderCombat();
    } else if (action === 'combat') {
      const act = button.dataset.act;
      doCombatAction(act, { allyId: button.dataset.ally });
    }
  });

  refs.modal.addEventListener('click', (event) => {
    if (event.target === refs.modal) {
      if (modalState?.dismissible) closeModal();
      return;
    }
    const button = event.target.closest('[data-modal-index]');
    if (!button) return;
    const index = Number(button.dataset.modalIndex);
    const action = modalState?.actions[index];
    if (!action) return;
    closeModal();
    if (action.onClick) action.onClick();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target && event.target.closest && event.target.closest('input, textarea, select')) return;

    if (modalState) {
      if (event.key === 'Escape' && modalState.dismissible) {
        event.preventDefault();
        closeModal();
      }
      return;
    }

    if (combat) {
      if (event.key === '1') doCombatAction('strike');
      else if (event.key === '2') doCombatAction('guard');
      else if (event.key === '3') doCombatAction('ability');
      else if (event.key === '4') doCombatAction('item');
      else if (event.key === '5') doCombatAction('flee');
      return;
    }

    if (screen !== 'delve') return;
    const keys = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      W: [0, -1],
      S: [0, 1],
      A: [-1, 0],
      D: [1, 0],
    };
    const move = keys[event.key];
    if (move) {
      event.preventDefault();
      tryMove(move[0], move[1]);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && campaign && !combat) saveCampaign(campaign);
  });
}

function snapshotRun() {
  const conditions = {};
  for (const hero of campaign.roster) {
    conditions[hero.id] = {
      injuries: hero.injuries.slice(),
      dreads: hero.dreads.slice(),
    };
  }
  return {
    kills: campaign.kills,
    memorial: campaign.memorial.length,
    conditions,
  };
}
