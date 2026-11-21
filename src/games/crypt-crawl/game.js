// Crypt Crawl — a kid-friendly puzzle dungeon crawler.
// Original game for Foofire Games. No external assets, no build step.
// Pure game-logic helpers are exported so they can be unit-checked in node;
// the DOM game only boots when `document` exists.

import { spriteSVG } from './sprites.js';
import { createChiptune } from './chiptune.js';

export const GRID = 6;
export const BEST_KEY = 'foofire-crypt-crawl-best';
export const BEST_GOLD_KEY = 'foofire-crypt-crawl-best-gold';

export const TILE_TYPES = ['sword', 'shield', 'potion', 'coin'];
export const TILE_SPRITE = { sword: 'tile-sword', shield: 'tile-shield', potion: 'tile-potion', coin: 'tile-coin' };
export const TILE_LABEL = { sword: 'Sword', shield: 'Shield', potion: 'Potion', coin: 'Coin' };

export const HEROES = [
  { id: 'pip', name: 'Pip the Wanderer', sprite: 'hero-pip', kind: 'Human • Wanderer', perk: 'Potions heal +1 extra', desc: 'A cheerful traveller who has walked every road and never met a dungeon they could not nap in.' },
  { id: 'bramble', name: 'Bramble the Knight', sprite: 'hero-bramble', kind: 'Knight • Shield-bearer', perk: 'Shields block +1 extra', desc: 'A very polite knight. Says "excuse me" before blocking a bite.' },
  { id: 'moss', name: 'Moss the Gardener', sprite: 'hero-moss', kind: 'Gardener • Tough as roots', perk: 'Starts with +10 max HP', desc: 'Grows courage like carrots. Slightly muddy, extremely hard to knock over.' },
  { id: 'wren', name: 'Wren the Scout', sprite: 'hero-wren', kind: 'Scout • Quick feet', perk: 'Swords deal +1 on paths of 5+', desc: 'Small, speedy and impossible to catch. Long sword-paths are her favourite trick.' },
  { id: 'biscuit', name: 'Biscuit the Cook', sprite: 'hero-biscuit', kind: 'Cook • Snack-powered', perk: 'Coins heal 1 HP per 4 matched', desc: 'Believes every problem is a snack problem. Carries a frying pan and a plan.' },
  { id: 'nettle', name: 'Nettle the Wizard', sprite: 'hero-nettle', kind: 'Wizard • First-spell fan', perk: 'First match each floor deals +3', desc: 'A young wizard whose first spell of the day always goes a bit BANG.' },
];

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', note: 'Gentle monsters', hp: 30, attackMod: -1 },
  normal: { id: 'normal', name: 'Normal', note: 'The crypt as it was meant to be', hp: 25, attackMod: 0 },
  hard: { id: 'hard', name: 'Hard', note: 'Spiky monsters', hp: 20, attackMod: 1 },
};

export const RELICS = [
  { id: 'sharp-sword', name: 'Sharp Sword', sprite: 'tile-sword', desc: '+1 sword damage' },
  { id: 'sturdy-shield', name: 'Sturdy Shield', sprite: 'tile-shield', desc: '+1 block from shields' },
  { id: 'lucky-coin', name: 'Lucky Coin', sprite: 'tile-coin', desc: '+1 gold per coin tile' },
  { id: 'hearty-stew', name: 'Hearty Stew', sprite: 'relic-stew', desc: '+5 max HP and heal 5' },
  { id: 'soft-boots', name: 'Soft Boots', sprite: 'relic-boots', desc: 'Monster bites hurt 1 less' },
  { id: 'sweet-potion', name: 'Sweet Potion', sprite: 'tile-potion', desc: '+1 healing from potions' },
];

const MONSTER_POOL = [
  { name: 'Squeaky Slime', sprite: 'monster-slime' },
  { name: 'Wobbly Bat', sprite: 'monster-bat' },
  { name: 'Ticklish Spider', sprite: 'monster-spider' },
  { name: 'Rattly Skeleton', sprite: 'monster-skeleton' },
  { name: 'Grumpy Mushroom', sprite: 'monster-mushroom' },
  { name: 'Sneezy Ghost', sprite: 'monster-ghost' },
  { name: 'Bouncy Blob', sprite: 'monster-blob' },
  { name: 'Sleepy Snake', sprite: 'monster-snake' },
];
const BOSS_POOL = [
  { name: 'King Crumb the Cake Golem', sprite: 'boss-crumb' },
  { name: 'Queen Wobble the Jelly Giant', sprite: 'boss-wobble' },
  { name: 'Sir Snores-a-Lot', sprite: 'boss-snores' },
  { name: 'The Great Grumbly Pumpkin', sprite: 'boss-pumpkin' },
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

/**
 * Does this board have a possible move? A move is a drag path of 3+ tiles
 * of the same type connected orthogonally (this is a drag-match game, not
 * a swap-match game), so: does any orthogonally-connected component of one
 * tile type have size >= 3? Null/empty cells are not tiles.
 */
export function hasPossibleMove(board) {
  if (!board || !board.length || !board[0] || !board[0].length) return false;
  const rows = board.length;
  const cols = board[0].length;
  const seen = board.map((row) => row.map(() => false));
  const stack = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = board[r][c];
      if (!type || seen[r][c]) continue;
      // Flood-fill this component; stop as soon as it reaches 3.
      let size = 0;
      stack.push([r, c]);
      seen[r][c] = true;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        size++;
        if (size >= 3) return true;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (seen[nr][nc] || board[nr][nc] !== type) continue;
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
  }
  return false;
}

/**
 * Gravity + refill for a board with null holes (pure, unit-checked).
 * Kept tiles fall straight down, keeping their order; brand-new tiles
 * drop in from above the board. Returns { board, falls } where falls is
 * a same-size grid of how many rows each tile fell (0 = stayed put).
 * New tiles in a column all fall the same distance — the number of new
 * tiles in that column — so they slide down in lockstep like a column.
 */
export function refillBoardData(board, rng = Math.random) {
  const rows = board.length;
  const cols = board[0].length;
  const next = board.map((row) => row.slice());
  const falls = board.map((row) => row.map(() => 0));
  for (let c = 0; c < cols; c++) {
    const kept = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r][c] !== null && board[r][c] !== undefined) kept.push({ type: board[r][c], from: r });
    }
    const nNew = rows - kept.length;
    for (let r = rows - 1, i = 0; r >= 0; r--, i++) {
      if (i < kept.length) {
        next[r][c] = kept[i].type;
        falls[r][c] = r - kept[i].from;
      } else {
        next[r][c] = randomTile(rng);
        falls[r][c] = nNew;
      }
    }
  }
  return { board: next, falls };
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

  // ---- NES chiptune engine: square / triangle / noise only ----
  // All sound (SFX + the looping dungeon tune) comes from chiptune.js.
  // No audio files, no sine/sawtooth. The mute button silences it all.
  let muted = false;
  try { muted = localStorage.getItem('foofireMuted.v1') === '1'; } catch (e) { /* ignore */ }
  const sfx = createChiptune();
  sfx.setMuted(muted);

  // ---- state ----
  const state = {
    screen: 'setup', heroId: 'pip', difficulty: 'normal', heroName: randomName(),
    hp: 25, maxHp: 25, block: 0, gold: 0, score: 0, floor: 1, kills: 0,
    monster: null, board: [], relics: [], firstMatchThisFloor: true,
    dragging: false, path: [], pathType: null, paused: false, over: false,
    settling: false, dying: false, best: 0, bestGold: 0,
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
      b.innerHTML = `<span class="hero-emoji" aria-hidden="true">${spriteSVG(h.sprite)}</span><span class="hero-name">${h.name}</span>`;
      b.addEventListener('click', () => { state.heroId = h.id; sfx.blip(); renderHeroes(); renderDetail(); });
      heroGrid.appendChild(b);
    });
  }
  function renderDetail() {
    const h = HEROES.find((x) => x.id === state.heroId);
    detailEl.innerHTML = `
      <span class="hero-emoji big" aria-hidden="true">${spriteSVG(h.sprite)}</span>
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
    b.addEventListener('click', () => { state.difficulty = b.dataset.difficulty; sfx.blip(); renderDifficulty(); });
  });
  const nameInput = $('#hero-name');
  nameInput.value = state.heroName;
  nameInput.addEventListener('input', () => { state.heroName = nameInput.value.trim() || randomName(); });
  $('#relic-count').textContent = '0/50';
  renderHeroes(); renderDetail(); renderDifficulty();

  // ---- board ----
  // Tile buttons are built ONCE per board and reused. The old code called
  // renderBoard() — which did boardEl.innerHTML = '' and rebuilt all 36
  // tile buttons — on every pointerdown AND every pointermove. Rebuilding
  // the DOM under the player's finger destroys the touch target mid-drag,
  // so mobile browsers fire pointercancel and the drag dies. That is the
  // bug Jordan hit. During a drag we now only toggle the `in-path` class
  // on the existing tiles; the DOM is rebuilt only when a new board is
  // dealt or tiles refill (never while dragging).
  const boardEl = $('#board');
  let tileEls = []; // 36 buttons, row-major order, built once per board
  let paintedTypes = []; // last type painted per tile, to avoid rework

  function tileIndex(r, c) { return r * GRID + c; }

  function buildBoard() {
    boardEl.innerHTML = '';
    tileEls = [];
    paintedTypes = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'tile tile-' + state.board[r][c];
        t.dataset.row = r; t.dataset.col = c;
        t.setAttribute('aria-label', `${TILE_LABEL[state.board[r][c]]} tile, row ${r + 1} column ${c + 1}`);
        t.innerHTML = spriteSVG(TILE_SPRITE[state.board[r][c]]);
        boardEl.appendChild(t);
        tileEls.push(t);
        paintedTypes.push(state.board[r][c]);
      }
    }
  }

  // Repaint changed tiles and mark the drag path. Never rebuilds the DOM.
  // `falls` is an optional same-size grid of how many rows each tile fell
  // (from refillBoardData / newBoard) — those tiles animate down into
  // place with the Web Animations API. Tiles are never rebuilt mid-drag
  // or mid-fall; only their classes, sprites and transforms change.
  function paintBoard(falls) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const i = tileIndex(r, c);
        const type = state.board[r][c];
        const t = tileEls[i];
        if (!t) continue;
        if (paintedTypes[i] !== type) {
          paintedTypes[i] = type;
          t.className = 'tile tile-' + type;
          t.innerHTML = spriteSVG(TILE_SPRITE[type]);
          t.setAttribute('aria-label', `${TILE_LABEL[type]} tile, row ${r + 1} column ${c + 1}`);
        }
        t.classList.toggle('in-path', state.path.some((p) => p.r === r && p.c === c));
      }
    }
    if (falls) animateFalls(falls);
  }

  // Tiles that fell slide down from where they were (or from above the
  // board for brand-new tiles). One tile-height step = tile height + the
  // grid gap, measured live so it is exact at any screen size. Staggered
  // a touch per column so the fall ripples across the board. Total is
  // ~230–430ms, so the turn still feels snappy. Skipped entirely when
  // the player prefers reduced motion.
  function animateFalls(falls) {
    if (reducedMotion || !tileEls.length) return;
    const first = tileEls[0];
    const gap = parseFloat(getComputedStyle(boardEl).gap) || 0;
    const step = first.offsetHeight + gap;
    if (!step) return;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const d = falls[r] && falls[r][c];
        if (!d) continue;
        const el = tileEls[tileIndex(r, c)];
        if (!el) continue;
        el.animate(
          [
            { transform: `translateY(${-d * step}px)` },
            { transform: 'translateY(0)' },
          ],
          {
            duration: 200 + d * 30,
            delay: c * 12,
            easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
            fill: 'backwards',
          },
        );
      }
    }
  }

  // A fresh board must always have a move — re-deal (silently) if it
  // somehow does not. Fresh tiles drop in from above the board.
  function newBoard() {
    let attempts = 0;
    do {
      state.board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => randomTile()));
      attempts++;
    } while (!hasPossibleMove(state.board) && attempts < 100);
    buildBoard();
    paintBoard(state.board.map((row, r) => row.map(() => r + 1)));
  }

  // Old name, kept for the floor-clear / start-run call sites.
  function renderBoard() { paintBoard(); }

  // Which tile is under a pointer? Hit-test first (exact, gap-aware),
  // grid maths second (so a finger drifting between tiles still tracks).
  function tileAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const tile = el && el.closest ? el.closest('.tile') : null;
    if (tile && boardEl.contains(tile)) {
      return { r: Number(tile.dataset.row), c: Number(tile.dataset.col) };
    }
    const rect = boardEl.getBoundingClientRect();
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;
    return {
      r: Math.min(GRID - 1, Math.floor((clientY - rect.top) / (rect.height / GRID))),
      c: Math.min(GRID - 1, Math.floor((clientX - rect.left) / (rect.width / GRID))),
    };
  }
  function adjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }
  function startDrag(pos) {
    if (state.paused || state.over || state.screen !== 'play' || state.settling || state.dying) return;
    state.dragging = true; state.pathType = state.board[pos.r][pos.c];
    state.path = [pos]; paintBoard();
  }
  function extendDrag(pos) {
    if (!state.dragging) return;
    if (state.board[pos.r][pos.c] !== state.pathType) return;
    if (state.path.some((p) => p.r === pos.r && p.c === pos.c)) return;
    const last = state.path[state.path.length - 1];
    if (!adjacent(last, pos)) return;
    state.path.push(pos);
    sfx.tick(state.path.length);
    paintBoard();
  }
  function cancelDrag() {
    if (!state.dragging) return;
    state.dragging = false; state.path = []; state.pathType = null; paintBoard();
  }
  function endDrag() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.path.length >= 3) resolveMatch();
    state.path = []; state.pathType = null; paintBoard();
  }
  boardEl.addEventListener('pointerdown', (e) => {
    const pos = tileAt(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* capture unavailable */ }
    startDrag(pos);
  });
  // Track on the window, not just the board: with pointer capture the
  // events retarget to the board, but a finger can drift off the board
  // and capture can be lost on some mobile browsers — window listeners
  // keep the drag alive either way.
  window.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    if (e.cancelable) e.preventDefault();
    const pos = tileAt(e.clientX, e.clientY);
    if (pos) extendDrag(pos);
  }, { passive: false });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', cancelDrag);
  boardEl.addEventListener('lostpointercapture', () => {
    // Capture lost mid-drag (interruption, or the old DOM-rebuild bug).
    // End the drag cleanly instead of leaving a stuck path.
    if (state.dragging) cancelDrag();
  });
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
  boardEl.addEventListener('dragstart', (e) => e.preventDefault());

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
          return `<span class="relic-chip" title="${r.name}: ${r.desc}">${spriteSVG(r.sprite)}<span>${r.name}</span></span>`;
        }).join('')
      : '<span class="relics-empty">No relics yet — beat a boss on floor 5!</span>';
    const m = state.monster;
    if (m) {
      $('#monster-emoji').innerHTML = spriteSVG(m.sprite);
      $('#monster-name').textContent = m.name + (m.isBoss ? ' — BOSS' : '');
      $('#monster-hp').textContent = `${Math.max(0, m.hp)} / ${m.maxHp}`;
      $('#monster-fill').style.width = `${Math.max(0, (m.hp / m.maxHp) * 100)}%`;
      $('#monster-card').classList.toggle('boss', m.isBoss);
    }
  }
  function floatText(text, kind) {
    // 'slain' is the one float that must still show under reduced motion
    // (it sits still instead of floating up); every other float is motion.
    if (reducedMotion && kind !== 'slain') return;
    const el = document.createElement('span');
    el.className = 'float-text ' + kind;
    el.textContent = text;
    const area = $('#float-layer');
    el.style.left = kind === 'slain' ? '50%' : `${20 + Math.random() * 60}%`;
    area.appendChild(el);
    if (reducedMotion) el.style.animation = 'none';
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
    if (state.monster.isBoss) sfx.boss();
    updateHud();
  }

  // Gravity + refill, with per-cell fall distances for the drop
  // animation. Pure logic lives in refillBoardData (unit-checked in node).
  function refillBoard() {
    const result = refillBoardData(state.board);
    state.board = result.board;
    return result.falls;
  }

  // No moves left? Shuffle the whole board for free. No HP loss, no extra
  // monster bite for the shuffle itself — the player just sees the banner
  // and the tiles wobble into their new places. Guarantees the new board
  // has at least one possible move. Returns true when a shuffle happened.
  function ensurePossibleMove() {
    if (hasPossibleMove(state.board)) return false;
    let attempts = 0;
    do {
      state.board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => randomTile()));
      attempts++;
    } while (!hasPossibleMove(state.board) && attempts < 100);
    banner('No moves! Shuffling the crypt…');
    setStatus('No moves left — the crypt shuffled itself, for free! Drag through 3 or more matching tiles.');
    sfx.shuffle();
    if (!reducedMotion) {
      boardEl.classList.add('shuffling');
      setTimeout(() => boardEl.classList.remove('shuffling'), 500);
    }
    return true;
  }

  function resolveMatch() {
    const type = state.pathType;
    const len = state.path.length;
    // endDrag clears state.path right after this call, so capture it.
    const path = state.path.slice();
    const fx = matchEffect(type, len, state.heroId, state.relics, state.firstMatchThisFloor);
    state.firstMatchThisFloor = false;
    state.score += fx.score;
    // The matched tiles pop, then the rest of the board drops in after a
    // short beat. New drags are blocked while the board is settling so a
    // player cannot grab tiles that are about to fall away.
    state.settling = true;
    if (!reducedMotion) {
      path.forEach((p) => {
        const el = tileEls[tileIndex(p.r, p.c)];
        if (el) el.animate(
          [
            { transform: 'scale(1.08)', opacity: 1 },
            { transform: 'scale(0.2)', opacity: 0 },
          ],
          { duration: 130, easing: 'ease-in', fill: 'forwards' },
        );
      });
    }
    sfx.pop();
    if (type === 'sword' && fx.damage > 0) {
      state.monster.hp -= fx.damage;
      floatText(`-${fx.damage}`, 'dmg');
      $('#monster-card').classList.add('shake');
      setTimeout(() => $('#monster-card').classList.remove('shake'), 350);
      sfx.hit();
    }
    if (type === 'shield' && fx.block > 0) {
      state.block += fx.block;
      floatText(`+${fx.block} block`, 'block');
      sfx.heal();
    }
    if (type === 'potion' && fx.heal > 0) {
      const healed = Math.min(fx.heal, state.maxHp - state.hp);
      state.hp += healed;
      floatText(`+${healed} HP`, 'heal');
      sfx.heal();
    }
    if (type === 'coin' && fx.gold > 0) {
      state.gold += fx.gold;
      floatText(`+${fx.gold} gold`, 'gold');
      if (fx.heal > 0) { state.hp = Math.min(state.maxHp, state.hp + fx.heal); floatText(`+${fx.heal} HP snack!`, 'heal'); }
      sfx.coin();
    }
    updateHud();
    const settleMs = reducedMotion ? 0 : 140;
    setTimeout(() => {
      // Cancel the pop animations first — they hold opacity 0 with fill
      // forwards, and the tile must be visible again before it falls.
      path.forEach((p) => {
        const el = tileEls[tileIndex(p.r, p.c)];
        if (el) el.getAnimations().forEach((a) => a.cancel());
      });
      // Clear the matched tiles, let the rest fall, and refill.
      path.forEach((p) => { state.board[p.r][p.c] = null; });
      const falls = refillBoard();
      // Turn order: shuffle FIRST if the refilled board has no moves
      // (free — no HP loss, no extra bite), then the monster attacks
      // once for this turn as normal.
      const shuffled = ensurePossibleMove();
      paintBoard(shuffled ? null : falls);
      state.settling = false;
      updateHud();
      if (state.monster.hp <= 0) {
        playDeath();
      } else {
        // The monster bites back once the fall is (mostly) done — a beat
        // later if the board just shuffled, so the player sees the new
        // board before the bite lands.
        const attackMs = reducedMotion ? 420 : shuffled ? 720 : 560;
        setTimeout(monsterAttack, attackMs);
      }
    }, settleMs);
  }

  function monsterAttack() {
    if (state.over || state.screen !== 'play' || !state.monster || state.monster.hp <= 0 || state.dying) return;
    const dmg = biteDamage(state.monster.attack, state.block, state.relics);
    const blocked = Math.min(state.block, state.monster.attack);
    state.block = 0;
    if (dmg > 0) {
      state.hp -= dmg;
      floatText(`-${dmg} bite!`, 'dmg');
      sfx.hurt();
      $('#hero-chip').classList.add('shake');
      setTimeout(() => $('#hero-chip').classList.remove('shake'), 350);
    } else if (blocked > 0) {
      floatText('Blocked!', 'block');
      sfx.pop();
    } else {
      floatText('Missed!', 'block');
    }
    updateHud();
    if (state.hp <= 0) gameOver();
  }

  // The monster's little pixel soul (the ghost sprite) rises out of the
  // monster card and fades away. Motion only — skipped under reduced
  // motion, where the fade on the monster itself carries the moment.
  function spawnSoul() {
    if (reducedMotion) return;
    const card = $('#monster-card');
    const soul = document.createElement('span');
    soul.className = 'soul';
    soul.setAttribute('aria-hidden', 'true');
    soul.innerHTML = spriteSVG('monster-ghost');
    card.appendChild(soul);
    setTimeout(() => soul.remove(), 950);
  }

  // Death sequence: the killing blow lands, the monster screams, shakes,
  // flashes white, tips over and fades — and only then does the floor
  // clear. Regular deaths take ~700ms, bosses ~1100ms (bigger scream,
  // board shake, "BOSS SLAIN!"). While dying, drags are blocked
  // (startDrag guard) and the monster cannot bite back (monsterAttack
  // guard + no attack is scheduled in the kill branch), so the floor can
  // only ever increment once per kill, in floorCleared below.
  function playDeath() {
    if (state.dying) return;
    const boss = state.monster.isBoss;
    state.dying = true;
    const card = $('#monster-card');
    card.classList.add('dying');
    if (boss) card.classList.add('dying-boss');
    sfx.scream(boss);
    floatText(boss ? 'BOSS SLAIN!' : 'SLAIN!', 'slain');
    if (!reducedMotion) {
      // Quick white flash on the board, and a board shake for bosses.
      boardEl.animate(
        [{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }],
        { duration: 300, easing: 'ease-out' },
      );
      if (boss) {
        document.querySelector('.board-wrap').animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 250, iterations: 2, easing: 'steps(4)' },
        );
      }
      spawnSoul();
    }
    const deathMs = reducedMotion ? 350 : boss ? 1100 : 700;
    setTimeout(() => {
      card.classList.remove('dying', 'dying-boss');
      state.dying = false;
      floorCleared();
    }, deathMs);
  }

  function floorCleared() {
    state.kills += 1;
    state.score += 50 + state.floor * 10;
    const heal = 3;
    state.hp = Math.min(state.maxHp, state.hp + heal);
    state.block = 0;
    sfx.clear();
    const wasBoss = state.monster.isBoss;
    banner(`Floor ${state.floor} cleared! +${heal} HP`);
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
      b.innerHTML = `<span class="relic-emoji" aria-hidden="true">${spriteSVG(r.sprite)}</span><strong>${r.name}</strong><span>${r.desc}</span>`;
      b.addEventListener('click', () => {
        state.relics.push(r.id);
        if (r.id === 'hearty-stew') { state.maxHp += 5; state.hp = Math.min(state.maxHp, state.hp + 5); }
        modal.hidden = true;
        sfx.relic();
        setStatus(`Relic found: ${r.name} — ${r.desc}`);
        updateHud();
      });
      list.appendChild(b);
    });
    modal.hidden = false;
  }

  function gameOver() {
    state.over = true;
    sfx.stopMusic();
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
    $('#over-best').textContent = `Best floor: ${state.best} · Best gold: ${state.bestGold}${newBest ? ' — new best floor!' : ''}`;
    $('#gameover-overlay').hidden = false;
    setStatus(`Game over. You reached floor ${floorReached}.`);
    updateHud();
  }

  // ---- run flow ----
  function startRun() {
    const diff = DIFFICULTIES[state.difficulty];
    state.maxHp = diff.hp + (state.heroId === 'moss' ? 10 : 0);
    state.hp = state.maxHp; state.block = 0; state.gold = 0; state.score = 0;
    state.floor = 1; state.kills = 0; state.relics = []; state.over = false; state.paused = false; state.dying = false;
    const hero = HEROES.find((h) => h.id === state.heroId);
    $('#hero-chip').innerHTML = `${spriteSVG(hero.sprite)} ${state.heroName} · ${hero.name}`;
    $('#setup-screen').hidden = true;
    $('#play-screen').hidden = false;
    $('#gameover-overlay').hidden = true;
    state.screen = 'play';
    newBoard(); renderBoard(); spawnMonster(); updateHud();
    setStatus(`Floor 1: a ${state.monster.name} blocks the way. Drag through 3 or more matching tiles!`);
    sfx.clear();
    sfx.startMusic();
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
    // NES games stop the tune when paused — resume it on unpause.
    if (p) sfx.stopMusic();
    else if (state.screen === 'play' && !state.over) sfx.startMusic();
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
    sfx.setMuted(muted);
    renderMute();
    if (!muted) {
      sfx.blip();
      if (state.screen === 'play' && !state.paused && !state.over) sfx.startMusic();
    }
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
