// Crypt Crawl — a kid-friendly puzzle dungeon crawler.
// Original game for Foofire Games. No external assets, no build step.
// Pure game-logic helpers are exported so they can be unit-checked in node;
// the DOM game only boots when `document` exists.

export const GRID = 6;
export const BEST_KEY = 'foofire-crypt-crawl-best';
export const BEST_GOLD_KEY = 'foofire-crypt-crawl-best-gold';

export const TILE_TYPES = ['sword', 'shield', 'potion', 'coin'];
export const TILE_EMOJI = { sword: '⚔️', shield: '🛡️', potion: '🧪', coin: '🪙' };
export const TILE_LABEL = { sword: 'Sword', shield: 'Shield', potion: 'Potion', coin: 'Coin' };

export const HEROES = [
  { id: 'pip', name: 'Pip the Wanderer', emoji: '🧑‍🌾', kind: 'Human • Wanderer', perk: 'Potions heal +1 extra', desc: 'A cheerful traveller who has walked every road and never met a dungeon they could not nap in.' },
  { id: 'bramble', name: 'Bramble the Knight', emoji: '🛡️', kind: 'Knight • Shield-bearer', perk: 'Shields block +1 extra', desc: 'A very polite knight. Says "excuse me" before blocking a bite.' },
  { id: 'moss', name: 'Moss the Gardener', emoji: '🌿', kind: 'Gardener • Tough as roots', perk: 'Starts with +10 max HP', desc: 'Grows courage like carrots. Slightly muddy, extremely hard to knock over.' },
  { id: 'wren', name: 'Wren the Scout', emoji: '🏹', kind: 'Scout • Quick feet', perk: 'Swords deal +1 on paths of 5+', desc: 'Small, speedy and impossible to catch. Long sword-paths are her favourite trick.' },
  { id: 'biscuit', name: 'Biscuit the Cook', emoji: '🍳', kind: 'Cook • Snack-powered', perk: 'Coins heal 1 HP per 4 matched', desc: 'Believes every problem is a snack problem. Carries a frying pan and a plan.' },
  { id: 'nettle', name: 'Nettle the Wizard', emoji: '🧙', kind: 'Wizard • First-spell fan', perk: 'First match each floor deals +3', desc: 'A young wizard whose first spell of the day always goes a bit BANG.' },
];

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', note: 'Gentle monsters', hp: 30, attackMod: -1 },
  normal: { id: 'normal', name: 'Normal', note: 'The crypt as it was meant to be', hp: 25, attackMod: 0 },
  hard: { id: 'hard', name: 'Hard', note: 'Spiky monsters', hp: 20, attackMod: 1 },
};

export const RELICS = [
  { id: 'sharp-sword', name: 'Sharp Sword', emoji: '🗡️', desc: '+1 sword damage' },
  { id: 'sturdy-shield', name: 'Sturdy Shield', emoji: '🛡️', desc: '+1 block from shields' },
  { id: 'lucky-coin', name: 'Lucky Coin', emoji: '🍀', desc: '+1 gold per coin tile' },
  { id: 'hearty-stew', name: 'Hearty Stew', emoji: '🍲', desc: '+5 max HP and heal 5' },
  { id: 'soft-boots', name: 'Soft Boots', emoji: '🥾', desc: 'Monster bites hurt 1 less' },
  { id: 'sweet-potion', name: 'Sweet Potion', emoji: '🧃', desc: '+1 healing from potions' },
];

const MONSTER_POOL = [
  { name: 'Squeaky Slime', emoji: '🟢' },
  { name: 'Wobbly Bat', emoji: '🦇' },
  { name: 'Ticklish Spider', emoji: '🕷️' },
  { name: 'Rattly Skeleton', emoji: '💀' },
  { name: 'Grumpy Mushroom', emoji: '🍄' },
  { name: 'Sneezy Ghost', emoji: '👻' },
  { name: 'Bouncy Blob', emoji: '🫧' },
  { name: 'Sleepy Snake', emoji: '🐍' },
];
const BOSS_POOL = [
  { name: 'King Crumb the Cake Golem', emoji: '🍰' },
  { name: 'Queen Wobble the Jelly Giant', emoji: '🍮' },
  { name: 'Sir Snores-a-Lot', emoji: '🐻' },
  { name: 'The Great Grumbly Pumpkin', emoji: '🎃' },
];

export function isBossFloor(floor) {
  return floor % 5 === 0;
}

/** Monster for a floor. HP/attack scale with floor; difficulty shifts attack. */
export function monsterForFloor(floor, difficultyId = 'normal') {
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
  const boss = isBossFloor(floor);
  const pick = boss
    ? BOSS_POOL[Math.floor(floor / 5 - 1) % BOSS_POOL.length]
    : MONSTER_POOL[(floor - 1) % MONSTER_POOL.length];
  const hp = boss ? 16 + floor * 6 : 10 + floor * 5;
  const attack = Math.max(1, (boss ? 3 : 1) + Math.ceil(floor / 2) + diff.attackMod + (boss ? 1 : 0));
  return { ...pick, hp, maxHp: hp, attack, isBoss: boss };
}

/** Count how many of a relic the run holds. */
export function relicCount(relics, id) {
  return relics.filter((r) => r === id).length;
}

/**
 * Effect of matching `len` tiles of `type`.
 * `heroId` applies the hero perk; `relics` is an array of relic ids;
 * `firstMatchThisFloor` applies Nettle's perk once per floor.
 * Returns { damage, block, heal, gold, score }.
 */
export function matchEffect(type, len, heroId, relics = [], firstMatchThisFloor = false) {
  const bonus = Math.max(0, len - 3);
  const out = { damage: 0, block: 0, heal: 0, gold: 0, score: len * 10 };
  if (type === 'sword') {
    out.damage = 3 + bonus + relicCount(relics, 'sharp-sword');
    if (heroId === 'wren' && len >= 5) out.damage += 1;
    if (heroId === 'nettle' && firstMatchThisFloor) out.damage += 3;
    out.score += out.damage * 5;
  } else if (type === 'shield') {
    out.block = 3 + bonus + relicCount(relics, 'sturdy-shield');
    if (heroId === 'bramble') out.block += 1;
    out.score += out.block * 5;
  } else if (type === 'potion') {
    out.heal = 3 + bonus + relicCount(relics, 'sweet-potion');
    if (heroId === 'pip') out.heal += 1;
    out.score += out.heal * 5;
  } else if (type === 'coin') {
    out.gold = len + relicCount(relics, 'lucky-coin');
    if (heroId === 'biscuit') out.heal = Math.floor(len / 4);
    out.score += out.gold * 10;
  }
  return out;
}

/** Damage the hero actually takes from a monster bite after block + boots. */
export function biteDamage(attack, block, relics = []) {
  return Math.max(0, attack - block - relicCount(relics, 'soft-boots'));
}

export function randomTile(rng = Math.random) {
  const r = rng();
  if (r < 0.3) return 'sword';
  if (r < 0.55) return 'shield';
  if (r < 0.8) return 'potion';
  return 'coin';
}

export function randomName() {
  const names = ['Pip', 'Moss', 'Wren', 'Biscuit', 'Nettle', 'Bramble', 'Tilly', 'Finn', 'Poppy', 'Rowan', 'Juniper', 'Sage'];
  return names[Math.floor(Math.random() * names.length)];
}

/* ------------------------------------------------------------------ *
 * DOM game — only boots in a browser.
 * ------------------------------------------------------------------ */
if (typeof document !== 'undefined') {
  const $ = (sel) => document.querySelector(sel);

  // ---- tiny WebAudio bleeps (no audio files) ----
  let audioCtx = null;
  let muted = false;
  try { muted = localStorage.getItem('foofireMuted.v1') === '1'; } catch (e) { /* ignore */ }
  function beep(freq, dur = 0.08, type = 'square', vol = 0.06) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    pop: () => { beep(520, 0.07); setTimeout(() => beep(780, 0.07), 40); },
    hit: () => beep(180, 0.12, 'sawtooth', 0.08),
    hurt: () => beep(110, 0.18, 'sawtooth', 0.09),
    heal: () => { beep(660, 0.08, 'sine'); setTimeout(() => beep(880, 0.1, 'sine'), 60); },
    coin: () => { beep(990, 0.06, 'sine'); setTimeout(() => beep(1320, 0.08, 'sine'), 50); },
    clear: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.07), i * 90)),
    over: () => [400, 300, 200, 140].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'sawtooth', 0.07), i * 130)),
  };

  // ---- state ----
  const state = {
    screen: 'setup', heroId: 'pip', difficulty: 'normal', heroName: randomName(),
    hp: 25, maxHp: 25, block: 0, gold: 0, score: 0, floor: 1, kills: 0,
    monster: null, board: [], relics: [], firstMatchThisFloor: true,
    dragging: false, path: [], pathType: null, paused: false, over: false,
    best: 0, bestGold: 0,
  };
  try {
    state.best = Number(localStorage.getItem(BEST_KEY) || 0);
    state.bestGold = Number(localStorage.getItem(BEST_GOLD_KEY) || 0);
  } catch (e) { /* ignore */ }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- setup screen ----
  const heroGrid = $('#hero-grid');
  const detailEl = $('#hero-detail');
  function renderHeroes() {
    heroGrid.innerHTML = '';
    HEROES.forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-card' + (state.heroId === h.id ? ' selected' : '');
      b.setAttribute('aria-pressed', String(state.heroId === h.id));
      b.innerHTML = `<span class="hero-emoji" aria-hidden="true">${h.emoji}</span><span class="hero-name">${h.name}</span>`;
      b.addEventListener('click', () => { state.heroId = h.id; beep(600, 0.05); renderHeroes(); renderDetail(); });
      heroGrid.appendChild(b);
    });
  }
  function renderDetail() {
    const h = HEROES.find((x) => x.id === state.heroId);
    detailEl.innerHTML = `
      <span class="hero-emoji big" aria-hidden="true">${h.emoji}</span>
      <span class="detail-text"><strong>${h.name}</strong><span class="detail-kind">${h.kind}</span>
      <span class="detail-perk">Perk: ${h.perk}</span><span class="detail-desc">${h.desc}</span>
      <span class="detail-flavour">No flaw either — just a brave kid with a torch and a snack.</span></span>`;
  }
  function renderDifficulty() {
    document.querySelectorAll('[data-difficulty]').forEach((b) => {
      const on = b.dataset.difficulty === state.difficulty;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  document.querySelectorAll('[data-difficulty]').forEach((b) => {
    b.addEventListener('click', () => { state.difficulty = b.dataset.difficulty; beep(600, 0.05); renderDifficulty(); });
  });
  const nameInput = $('#hero-name');
  nameInput.value = state.heroName;
  nameInput.addEventListener('input', () => { state.heroName = nameInput.value.trim() || randomName(); });
  $('#relic-count').textContent = '0/50';
  renderHeroes(); renderDetail(); renderDifficulty();

  // ---- board ----
  const boardEl = $('#board');
  function newBoard() {
    state.board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => randomTile()));
  }
  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'tile tile-' + state.board[r][c];
        t.dataset.row = r; t.dataset.col = c;
        t.setAttribute('aria-label', `${TILE_LABEL[state.board[r][c]]} tile, row ${r + 1} column ${c + 1}`);
        t.innerHTML = `<span aria-hidden="true">${TILE_EMOJI[state.board[r][c]]}</span>`;
        if (state.path.some((p) => p.r === r && p.c === c)) t.classList.add('in-path');
        boardEl.appendChild(t);
      }
    }
  }
  function tileAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const tile = el && el.closest ? el.closest('.tile') : null;
    if (!tile || !boardEl.contains(tile)) return null;
    return { r: Number(tile.dataset.row), c: Number(tile.dataset.col) };
  }
  function adjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }
  function startDrag(pos) {
    if (state.paused || state.over || state.screen !== 'play') return;
    state.dragging = true; state.pathType = state.board[pos.r][pos.c];
    state.path = [pos]; renderBoard();
  }
  function extendDrag(pos) {
    if (!state.dragging) return;
    if (state.board[pos.r][pos.c] !== state.pathType) return;
    if (state.path.some((p) => p.r === pos.r && p.c === pos.c)) return;
    const last = state.path[state.path.length - 1];
    if (!adjacent(last, pos)) return;
    state.path.push(pos);
    beep(440 + state.path.length * 60, 0.04, 'sine', 0.04);
    renderBoard();
  }
  function endDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.path.length >= 3) resolveMatch();
    state.path = []; state.pathType = null; renderBoard();
  }
  boardEl.addEventListener('pointerdown', (e) => {
    const pos = tileAt(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    boardEl.setPointerCapture(e.pointerId);
    startDrag(pos);
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const pos = tileAt(e.clientX, e.clientY);
    if (pos) extendDrag(pos);
  });
  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', () => { state.dragging = false; state.path = []; renderBoard(); });

  // ---- HUD / monster ----
  function updateHud() {
    $('#hud-floor').textContent = state.floor;
    $('#hud-hp').textContent = `${Math.max(0, state.hp)} / ${state.maxHp}`;
    $('#hp-fill').style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
    $('#hud-block').textContent = state.block;
    $('#hud-gold').textContent = state.gold;
    $('#hud-score').textContent = state.score;
    $('#hud-best').textContent = `Best floor ${state.best}`;
    $('#relics-row').innerHTML = state.relics.length
      ? state.relics.map((id) => {
          const r = RELICS.find((x) => x.id === id);
          return `<span class="relic-chip" title="${r.name}: ${r.desc}">${r.emoji} ${r.name}</span>`;
        }).join('')
      : '<span class="relics-empty">No relics yet — beat a boss on floor 5!</span>';
    const m = state.monster;
    if (m) {
      $('#monster-emoji').textContent = m.emoji;
      $('#monster-name').textContent = m.name + (m.isBoss ? ' 👑 BOSS' : '');
      $('#monster-hp').textContent = `${Math.max(0, m.hp)} / ${m.maxHp}`;
      $('#monster-fill').style.width = `${Math.max(0, (m.hp / m.maxHp) * 100)}%`;
      $('#monster-card').classList.toggle('boss', m.isBoss);
    }
  }
  function floatText(text, kind) {
    if (reducedMotion) return;
    const el = document.createElement('span');
    el.className = 'float-text ' + kind;
    el.textContent = text;
    const area = $('#float-layer');
    el.style.left = `${20 + Math.random() * 60}%`;
    area.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function banner(text) {
    const b = $('#banner');
    b.querySelector('span').textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 1600);
  }
  function setStatus(text) { $('#status').textContent = text; }

  function spawnMonster() {
    state.monster = monsterForFloor(state.floor, state.difficulty);
    state.firstMatchThisFloor = true;
    updateHud();
  }

  function refillBoard() {
    for (let c = 0; c < GRID; c++) {
      const kept = [];
      for (let r = GRID - 1; r >= 0; r--) {
        if (state.board[r][c] !== null) kept.push(state.board[r][c]);
      }
      for (let r = GRID - 1, i = 0; r >= 0; r--, i++) {
        state.board[r][c] = i < kept.length ? kept[i] : randomTile();
      }
    }
  }

  function resolveMatch() {
    const type = state.pathType;
    const len = state.path.length;
    const fx = matchEffect(type, len, state.heroId, state.relics, state.firstMatchThisFloor);
    state.firstMatchThisFloor = false;
    state.score += fx.score;
    // Clear the matched tiles, then let the rest fall.
    state.path.forEach((p) => { state.board[p.r][p.c] = null; });
    sfx.pop();
    if (type === 'sword' && fx.damage > 0) {
      state.monster.hp -= fx.damage;
      floatText(`-${fx.damage} ⚔️`, 'dmg');
      $('#monster-card').classList.add('shake');
      setTimeout(() => $('#monster-card').classList.remove('shake'), 350);
      sfx.hit();
    }
    if (type === 'shield' && fx.block > 0) {
      state.block += fx.block;
      floatText(`+${fx.block} 🛡️ block`, 'block');
      sfx.heal();
    }
    if (type === 'potion' && fx.heal > 0) {
      const healed = Math.min(fx.heal, state.maxHp - state.hp);
      state.hp += healed;
      floatText(`+${healed} ❤️`, 'heal');
      sfx.heal();
    }
    if (type === 'coin' && fx.gold > 0) {
      state.gold += fx.gold;
      floatText(`+${fx.gold} 🪙`, 'gold');
      if (fx.heal > 0) { state.hp = Math.min(state.maxHp, state.hp + fx.heal); floatText(`+${fx.heal} ❤️ snack!`, 'heal'); }
      sfx.coin();
    }
    refillBoard();
    updateHud();
    if (state.monster.hp <= 0) {
      floorCleared();
    } else {
      // Monster bites back after a short beat so the player sees the result.
      setTimeout(monsterAttack, 420);
    }
  }

  function monsterAttack() {
    if (state.over || state.screen !== 'play' || !state.monster || state.monster.hp <= 0) return;
    const dmg = biteDamage(state.monster.attack, state.block, state.relics);
    const blocked = Math.min(state.block, state.monster.attack);
    state.block = 0;
    if (dmg > 0) {
      state.hp -= dmg;
      floatText(`-${dmg} 😬 bite!`, 'dmg');
      sfx.hurt();
      $('#hero-chip').classList.add('shake');
      setTimeout(() => $('#hero-chip').classList.remove('shake'), 350);
    } else if (blocked > 0) {
      floatText('Blocked! 🛡️', 'block');
      sfx.pop();
    } else {
      floatText('Missed! 💨', 'block');
    }
    updateHud();
    if (state.hp <= 0) gameOver();
  }

  function floorCleared() {
    state.kills += 1;
    state.score += 50 + state.floor * 10;
    const heal = 3;
    state.hp = Math.min(state.maxHp, state.hp + heal);
    state.block = 0;
    sfx.clear();
    const wasBoss = state.monster.isBoss;
    banner(`Floor ${state.floor} cleared! +${heal} ❤️`);
    setStatus(`Floor ${state.floor} cleared! The ${state.monster.name} wobbled away.`);
    state.floor += 1;
    if (state.floor > state.best) {
      state.best = state.floor;
      try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (e) { /* ignore */ }
    }
    newBoard();
    spawnMonster();
    updateHud();
    renderBoard();
    if (wasBoss) setTimeout(showRelicChoice, 700);
  }

  function showRelicChoice() {
    const pool = [...RELICS].sort(() => Math.random() - 0.5).slice(0, 3);
    const modal = $('#relic-modal');
    const list = $('#relic-choices');
    list.innerHTML = '';
    pool.forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'relic-choice';
      b.innerHTML = `<span class="relic-emoji" aria-hidden="true">${r.emoji}</span><strong>${r.name}</strong><span>${r.desc}</span>`;
      b.addEventListener('click', () => {
        state.relics.push(r.id);
        if (r.id === 'hearty-stew') { state.maxHp += 5; state.hp = Math.min(state.maxHp, state.hp + 5); }
        modal.hidden = true;
        sfx.clear();
        setStatus(`Relic found: ${r.name} — ${r.desc}`);
        updateHud();
      });
      list.appendChild(b);
    });
    modal.hidden = false;
  }

  function gameOver() {
    state.over = true;
    sfx.over();
    const floorReached = state.floor;
    const newBest = floorReached > state.best;
    if (newBest) state.best = floorReached;
    const newBestGold = state.gold > state.bestGold;
    if (newBestGold) state.bestGold = state.gold;
    try {
      localStorage.setItem(BEST_KEY, String(state.best));
      localStorage.setItem(BEST_GOLD_KEY, String(state.bestGold));
    } catch (e) { /* ignore */ }
    $('#over-floor').textContent = floorReached;
    $('#over-kills').textContent = state.kills;
    $('#over-gold').textContent = state.gold;
    $('#over-score').textContent = state.score;
    $('#over-best').textContent = `Best floor: ${state.best} · Best gold: ${state.bestGold}${newBest ? ' — new best floor! 🎉' : ''}`;
    $('#gameover-overlay').hidden = false;
    setStatus(`Game over. You reached floor ${floorReached}.`);
    updateHud();
  }

  // ---- run flow ----
  function startRun() {
    const diff = DIFFICULTIES[state.difficulty];
    state.maxHp = diff.hp + (state.heroId === 'moss' ? 10 : 0);
    state.hp = state.maxHp; state.block = 0; state.gold = 0; state.score = 0;
    state.floor = 1; state.kills = 0; state.relics = []; state.over = false; state.paused = false;
    const hero = HEROES.find((h) => h.id === state.heroId);
    $('#hero-chip').innerHTML = `<span aria-hidden="true">${hero.emoji}</span> ${state.heroName} · ${hero.name}`;
    $('#setup-screen').hidden = true;
    $('#play-screen').hidden = false;
    $('#gameover-overlay').hidden = true;
    state.screen = 'play';
    newBoard(); renderBoard(); spawnMonster(); updateHud();
    setStatus(`Floor 1: a ${state.monster.name} blocks the way. Drag through 3 or more matching tiles!`);
    sfx.clear();
  }
  $('#descend-button').addEventListener('click', startRun);
  $('#back-button').addEventListener('click', () => { window.location.href = '../../../games.html'; });
  $('#play-again-button').addEventListener('click', () => {
    $('#gameover-overlay').hidden = true;
    $('#play-screen').hidden = true;
    $('#setup-screen').hidden = false;
    state.screen = 'setup';
    $('#relic-count').textContent = '0/50';
    renderHeroes(); renderDetail();
  });
  $('#quit-button').addEventListener('click', () => { window.location.href = '../../../games.html'; });

  // ---- pause / mute / fullscreen ----
  const pauseBtn = $('#pause-button');
  function setPaused(p) {
    state.paused = p;
    pauseBtn.textContent = p ? '▶' : '❚❚';
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Resume game' : 'Pause game');
    $('#paused-note').hidden = !p;
    boardEl.classList.toggle('paused', p);
  }
  pauseBtn.addEventListener('click', () => setPaused(!state.paused));
  const muteBtn = $('#mute-button');
  function renderMute() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Turn sounds on' : 'Mute sounds');
  }
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('foofireMuted.v1', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    renderMute();
    if (!muted) beep(600, 0.06);
  });
  renderMute();
  const fsBtn = $('#fullscreen-button');
  fsBtn.addEventListener('click', () => {
    const wrap = $('#crypt-game');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play' && !state.over) setPaused(true);
  });
  $('#relic-close').addEventListener('click', () => { $('#relic-modal').hidden = true; });
}
