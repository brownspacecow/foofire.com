/**
 * Grocery Grab — a timed supermarket dash.
 * Push a cart around a top-down store, grab groceries, finish the
 * shopping list, hunt the golden bonus items, and check out before
 * the clock runs out. No failing: every run ends at the checkout
 * with a grand total, saved as a local best.
 *
 * Plain canvas 2D, no build step, no external assets.
 */
import {
  ITEMS,
  BONUS_ITEMS,
  LIST_BONUS_CENTS,
  LIST_COMPLETE_BONUS_CENTS,
  TIME_BONUS_PER_SECOND_CENTS,
  makeShoppingList,
  formatMoney,
  shuffle,
} from './items.js';
import { sound } from './sound.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { createAutoPause } from '../../utils/auto-pause.js';

const GAME_ID = 'grocery-grab';
const W = 480;
const H = 640;
const BASE_SPEED = 175;
const PLAYER_R = 16;
const GRAB_R = 32;
const FULLNESS_MAX_SLOW = 0.25;
const RESPAWN_MIN_S = 3;
const RESPAWN_VAR_S = 2;

const reducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ store */

/* Three shelf rows; each row is three shelf blocks with two cross-aisle
   gaps, so the store is four horizontal aisles plus two vertical gaps. */
const SHELF_ROWS = [
  { y: 92, h: 56 },
  { y: 228, h: 56 },
  { y: 364, h: 56 },
];
const SHELF_BLOCKS = [
  { x: 16, w: 140 },
  { x: 172, w: 136 },
  { x: 324, w: 140 },
];
const SHELVES = SHELF_ROWS.flatMap((row) =>
  SHELF_BLOCKS.map((block) => ({ x: block.x, y: row.y, w: block.w, h: row.h }))
);
const SHELF_COLORS = ['#2ec4ff', '#ff8a00', '#a855f7'];

/* Corridor centre lines, top to bottom: Aisle 1–4. */
const AISLES = [
  { n: 1, y: 52 },
  { n: 2, y: 188 },
  { n: 3, y: 324 },
  { n: 4, y: 460 },
];

/* Where groceries sit. Spots in a corridor keep that aisle number;
   cross-aisle spots sit in the gaps between shelf blocks. */
const SPOTS = [
  { x: 60, y: 52, aisle: 1 },
  { x: 240, y: 52, aisle: 1 },
  { x: 420, y: 52, aisle: 1 },
  { x: 110, y: 188, aisle: 2 },
  { x: 290, y: 188, aisle: 2 },
  { x: 430, y: 188, aisle: 2 },
  { x: 60, y: 324, aisle: 3 },
  { x: 200, y: 324, aisle: 3 },
  { x: 380, y: 324, aisle: 3 },
  { x: 140, y: 460, aisle: 4 },
  { x: 330, y: 460, aisle: 4 },
  { x: 450, y: 460, aisle: 4 },
  { x: 164, y: 120, aisle: 1 },
  { x: 316, y: 120, aisle: 1 },
  { x: 164, y: 256, aisle: 2 },
  { x: 316, y: 392, aisle: 3 },
];

const CHECKOUT = { x: 150, y: 556, w: 180, h: 72 };
const SHOPPER_EMOJIS = ['🧑', '👩', '👨', '👵'];
const SHOPPER_COLORS = ['#ff2e63', '#2ec4ff', '#3ddc84', '#ff8a00'];

/* ------------------------------------------------------------------ dom */

const $ = (id) => document.getElementById(id);
const section = $('grocery-game');
const canvas = $('store-canvas');
const ctx = canvas.getContext('2d');
const startScreen = $('start-screen');
const playScreen = $('play-screen');
const hudTime = $('hud-time');
const hudTotal = $('hud-total');
const hudItems = $('hud-items');
const hudList = $('hud-list');
const bonusHint = $('bonus-hint');
const listChips = $('list-chips');
const toast = $('toast');
const checkoutButton = $('checkout-button');
const pauseButton = $('pause-button');
const fullscreenButton = $('fullscreen-button');
const muteButton = $('mute-button');
const resultsOverlay = $('results-overlay');
const pausedNote = $('paused-note');
const bestLine = $('best-line');

let modeSeconds = 60;
let state = 'menu'; // 'menu' | 'playing' | 'done'
let paused = false;

/* Run state — rebuilt by startRun(). */
let list = [];
let spots = [];
let shoppers = [];
let spills = [];
let floaters = [];
let player = null;
let timeLeft = 60;
let cartTotal = 0;
let listBonusTotal = 0;
let cartCount = 0;
let lastTickSecond = -1;
let toastTimer = 0;

const keys = new Set();
const joystick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

/* ------------------------------------------------------------------ helpers */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function money(cents) {
  return formatMoney(cents);
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function addFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 1 });
}

/* ------------------------------------------------------------------ setup */

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randomSpillSpot() {
  const aisle = AISLES[Math.floor(Math.random() * AISLES.length)];
  return {
    x: 50 + Math.random() * (W - 100),
    y: aisle.y + (Math.random() * 24 - 12),
    r: 26,
  };
}

function startRun() {
  list = makeShoppingList();
  const listIds = new Set(list.map((item) => item.id));

  /* Place every list item first (so the list is always completable),
     then the 3 golden bonus items, then fill the rest with groceries. */
  const shuffledSpots = shuffle(SPOTS.map((spot) => ({ ...spot, item: null, respawnAt: 0 })));
  const onFloor = new Set();
  const place = (spot, item) => {
    spot.item = item;
    onFloor.add(item.id);
  };
  list.forEach((item, i) => place(shuffledSpots[i], item));
  BONUS_ITEMS.forEach((item, i) => place(shuffledSpots[list.length + i], item));
  shuffledSpots.slice(list.length + BONUS_ITEMS.length).forEach((spot) => {
    const pool = ITEMS.filter((item) => !onFloor.has(item.id) && !listIds.has(item.id));
    const pick = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : ITEMS[Math.floor(Math.random() * ITEMS.length)];
    place(spot, pick);
  });
  spots = shuffledSpots;

  shoppers = [0, 1, 2].map((i) => {
    const aisle = AISLES[i + 1] || AISLES[1];
    return {
      x: 80 + i * 150,
      y: aisle.y,
      dx: i % 2 === 0 ? 1 : -1,
      dy: 0,
      speed: 42 + Math.random() * 22,
      emoji: SHOPPER_EMOJIS[i % SHOPPER_EMOJIS.length],
      color: SHOPPER_COLORS[i % SHOPPER_COLORS.length],
      retargetIn: 2 + Math.random() * 2,
      bumpCooldown: 0,
    };
  });

  spills = [randomSpillSpot(), randomSpillSpot()];
  floaters = [];
  player = { x: W / 2, y: 520, slowUntil: 0, wobble: 0 };
  timeLeft = modeSeconds;
  cartTotal = 0;
  listBonusTotal = 0;
  cartCount = 0;
  lastTickSecond = -1;
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;

  renderListChips();
  updateBonusHint();
  updateHud();
  state = 'playing';
  startScreen.hidden = true;
  playScreen.hidden = false;
  resultsOverlay.hidden = true;
  autoPause.refresh();
  autoPause.sync();
  sound.unlock();
}

function renderListChips() {
  listChips.innerHTML = '';
  list.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = `list-chip${item.found ? ' done' : ''}`;
    chip.textContent = `${item.found ? '✓ ' : ''}${item.emoji} ${item.name}`;
    listChips.append(chip);
  });
  hudList.textContent = `${list.filter((item) => item.found).length} / ${list.length}`;
}

function updateBonusHint() {
  const remaining = spots.filter((spot) => spot.item && spot.item.bonus);
  if (!remaining.length) {
    bonusHint.textContent = '🎉 All bonus items found!';
    return;
  }
  const spot = remaining[0];
  bonusHint.textContent = `⭐ Bonus hiding in Aisle ${spot.aisle}!`;
}

function updateHud() {
  const seconds = Math.max(0, Math.ceil(timeLeft));
  hudTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  hudTime.classList.toggle('low', timeLeft <= 10);
  hudTotal.textContent = money(cartTotal + listBonusTotal);
  hudItems.textContent = String(cartCount);
}

/* ------------------------------------------------------------------ input */

const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

window.addEventListener('keydown', (event) => {
  if (MOVE_KEYS.includes(event.code)) {
    if (state === 'playing') event.preventDefault();
    keys.add(event.code);
  }
  if (event.code === 'KeyM' && !event.repeat) {
    toggleMute();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (state !== 'playing') return;
  event.preventDefault();
  const p = canvasPoint(event);
  joystick.active = true;
  joystick.id = event.pointerId;
  joystick.ox = p.x;
  joystick.oy = p.y;
  joystick.dx = 0;
  joystick.dy = 0;
  canvas.setPointerCapture(event.pointerId);
  sound.unlock();
});

canvas.addEventListener('pointermove', (event) => {
  if (!joystick.active || event.pointerId !== joystick.id) return;
  const p = canvasPoint(event);
  const dx = p.x - joystick.ox;
  const dy = p.y - joystick.oy;
  const len = Math.hypot(dx, dy);
  const max = 52;
  const scale = len > max ? max / len : 1;
  joystick.dx = (dx * scale) / max;
  joystick.dy = (dy * scale) / max;
});

function endJoystick(event) {
  if (event.pointerId !== joystick.id) return;
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
}

canvas.addEventListener('pointerup', endJoystick);
canvas.addEventListener('pointercancel', endJoystick);

function inputVector() {
  let x = 0;
  let y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  if (joystick.active) {
    x += joystick.dx;
    y += joystick.dy;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/* ------------------------------------------------------------------ update */

function circleHitsShelf(x, y, r) {
  for (const shelf of SHELVES) {
    const cx = clamp(x, shelf.x, shelf.x + shelf.w);
    const cy = clamp(y, shelf.y, shelf.y + shelf.h);
    if (dist(x, y, cx, cy) < r) return shelf;
  }
  return null;
}

function resolveShelfCollision(entity, r) {
  const shelf = circleHitsShelf(entity.x, entity.y, r);
  if (!shelf) return false;
  const cx = clamp(entity.x, shelf.x, shelf.x + shelf.w);
  const cy = clamp(entity.y, shelf.y, shelf.y + shelf.h);
  let nx = entity.x - cx;
  let ny = entity.y - cy;
  let len = Math.hypot(nx, ny);
  if (len === 0) {
    /* Centre inside the shelf: push out along the smallest overlap. */
    const left = entity.x - shelf.x;
    const right = shelf.x + shelf.w - entity.x;
    const top = entity.y - shelf.y;
    const bottom = shelf.y + shelf.h - entity.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) entity.x = shelf.x - r;
    else if (min === right) entity.x = shelf.x + shelf.w + r;
    else if (min === top) entity.y = shelf.y - r;
    else entity.y = shelf.y + shelf.h + r;
    return true;
  }
  nx /= len;
  ny /= len;
  entity.x = cx + nx * r;
  entity.y = cy + ny * r;
  return true;
}

function onSpill(x, y) {
  return spills.some((spill) => dist(x, y, spill.x, spill.y) < spill.r + 6);
}

function update(dt, now) {
  /* Clock. */
  timeLeft -= dt;
  const whole = Math.ceil(timeLeft);
  if (timeLeft <= 10 && whole !== lastTickSecond && timeLeft > 0) {
    lastTickSecond = whole;
    sound.tick();
  }
  if (timeLeft <= 0) {
    timeLeft = 0;
    endRun(false);
    return;
  }

  /* Player movement. */
  const input = inputVector();
  const inSpill = onSpill(player.x, player.y);
  let speed = BASE_SPEED;
  if (inSpill) speed *= 0.55;
  if (now < player.slowUntil) speed *= 0.45;
  speed *= 1 - Math.min(FULLNESS_MAX_SLOW, cartCount * 0.012);
  player.x = clamp(player.x + input.x * speed * dt, 16 + PLAYER_R, W - 16 - PLAYER_R);
  player.y = clamp(player.y + input.y * speed * dt, 12 + PLAYER_R, H - 12 - PLAYER_R);
  resolveShelfCollision(player, PLAYER_R);
  if (player.wobble > 0) player.wobble = Math.max(0, player.wobble - dt * 3);

  /* Shoppers wander the aisles. */
  for (const shopper of shoppers) {
    shopper.retargetIn -= dt;
    if (shopper.bumpCooldown > 0) shopper.bumpCooldown -= dt;
    const prevX = shopper.x;
    const prevY = shopper.y;
    shopper.x += shopper.dx * shopper.speed * dt;
    shopper.y += shopper.dy * shopper.speed * dt;
    const hit =
      shopper.x < 28 || shopper.x > W - 28 || shopper.y < 24 || shopper.y > H - 24
        ? true
        : resolveShelfCollision(shopper, 15);
    if (hit || shopper.retargetIn <= 0) {
      shopper.x = prevX;
      shopper.y = prevY;
      pickShopperDirection(shopper);
      shopper.retargetIn = 2 + Math.random() * 3;
    }
    /* Bumping a shopper slows the cart and wobbles it. */
    if (shopper.bumpCooldown <= 0 && dist(player.x, player.y, shopper.x, shopper.y) < 36) {
      player.slowUntil = now + 1.2;
      player.wobble = 1;
      shopper.bumpCooldown = 2;
      sound.bump();
      pickShopperDirection(shopper);
      addFloater(player.x, player.y - 26, 'BUMP!', '#ff2e63');
    }
  }

  /* Grabbing groceries. */
  for (const spot of spots) {
    if (!spot.item) {
      if (spot.respawnAt && now >= spot.respawnAt) {
        spot.item = randomRespawnItem();
        spot.respawnAt = 0;
      }
      continue;
    }
    if (dist(player.x, player.y, spot.x, spot.y) < GRAB_R) {
      collect(spot, now);
    }
  }

  /* Floaters rise and fade. */
  floaters = floaters.filter((f) => {
    f.y -= 28 * dt;
    f.life -= dt * 0.9;
    return f.life > 0;
  });

  updateHud();
}

function pickShopperDirection(shopper) {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  const pick = dirs[Math.floor(Math.random() * dirs.length)];
  shopper.dx = pick.dx;
  shopper.dy = pick.dy;
}

function randomRespawnItem() {
  const onFloor = new Set(spots.filter((s) => s.item).map((s) => s.item.id));
  const missingList = list.filter((item) => !item.found && !onFloor.has(item.id));
  /* A missing list item is more likely to come back, so the list stays
     completable even late in a run. */
  if (missingList.length && Math.random() < 0.35) {
    return missingList[Math.floor(Math.random() * missingList.length)];
  }
  const pool = ITEMS.filter((item) => !onFloor.has(item.id));
  return pool.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function collect(spot, now) {
  const item = spot.item;
  spot.item = null;
  spot.respawnAt = now + RESPAWN_MIN_S + Math.random() * RESPAWN_VAR_S;
  cartCount += 1;
  cartTotal += item.price;
  let label = `+${money(item.price)}`;

  if (item.bonus) {
    sound.bonus();
    showToast(`⭐ ${item.name} — ${money(item.price)}!`);
    addFloater(spot.x, spot.y - 24, `⭐ +${money(item.price)}`, '#ffd93d');
    updateBonusHint();
  } else {
    const listEntry = list.find((entry) => entry.id === item.id && !entry.found);
    if (listEntry) {
      listEntry.found = true;
      listBonusTotal += LIST_BONUS_CENTS;
      label = `+${money(item.price + LIST_BONUS_CENTS)} ✓`;
      sound.list();
      addFloater(spot.x, spot.y - 24, label, '#3ddc84');
      renderListChips();
      if (list.every((entry) => entry.found)) {
        showToast('🎉 Shopping list complete!');
      }
    } else {
      sound.pickup();
      addFloater(spot.x, spot.y - 24, label, '#fff8e7');
    }
  }
  updateHud();
}

/* ------------------------------------------------------------------ checkout */

function endRun(early) {
  if (state !== 'playing') return;
  state = 'done';
  const listComplete = list.every((entry) => entry.found);
  const completeBonus = listComplete ? LIST_COMPLETE_BONUS_CENTS : 0;
  const timeBonus = early ? Math.floor(timeLeft) * TIME_BONUS_PER_SECOND_CENTS : 0;
  const groceries = cartTotal + listBonusTotal;
  const grand = groceries + completeBonus + timeBonus;

  const result = submitScore(GAME_ID, grand);
  sound.chaChing();

  $('res-groceries').textContent = money(groceries);
  $('res-complete').textContent = money(completeBonus);
  $('res-time').textContent = money(timeBonus);
  $('res-total').textContent = money(grand);
  $('res-best').textContent = result.isBest
    ? '🎉 New best total!'
    : `Best total: ${money(result.best)}`;
  $('res-note').textContent = listComplete
    ? `You found all ${list.length} list items${early ? ' and checked out early' : ''}.`
    : `You found ${list.filter((entry) => entry.found).length} of ${list.length} list items.`;
  resultsOverlay.hidden = false;
  autoPause.refresh();
  autoPause.sync();
  updateBestLine();
}

function updateBestLine() {
  const best = getBest(GAME_ID);
  bestLine.textContent =
    best > 0 ? `Best total so far: ${money(best)}` : 'No best total yet — go grab some groceries!';
}

/* ------------------------------------------------------------------ render */

function drawStore(now) {
  /* Floor: pale tiles. */
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120, 100, 60, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  /* Aisle labels. */
  ctx.fillStyle = '#8a7a52';
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  AISLES.forEach((aisle) => {
    ctx.fillText(`AISLE ${aisle.n}`, 8, aisle.y - 18);
  });

  /* Wet-floor spills. */
  for (const spill of spills) {
    ctx.fillStyle = 'rgba(46, 196, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(spill.x, spill.y, spill.r, spill.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2ec4ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💧', spill.x, spill.y);
  }

  /* Shelves with little product dots. */
  SHELVES.forEach((shelf, i) => {
    ctx.fillStyle = SHELF_COLORS[i % SHELF_COLORS.length];
    ctx.fillRect(shelf.x, shelf.y, shelf.w, shelf.h);
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 3;
    ctx.strokeRect(shelf.x, shelf.y, shelf.w, shelf.h);
    ctx.fillStyle = 'rgba(255, 248, 231, 0.85)';
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        ctx.fillRect(shelf.x + 10 + c * 18, shelf.y + 10 + r * 24, 10, 12);
      }
    }
  });

  /* Checkout zone. */
  const inCheckout =
    state === 'playing' &&
    player.x > CHECKOUT.x &&
    player.x < CHECKOUT.x + CHECKOUT.w &&
    player.y > CHECKOUT.y &&
    player.y < CHECKOUT.y + CHECKOUT.h;
  ctx.fillStyle = inCheckout ? '#3ddc84' : '#2fb96c';
  ctx.fillRect(CHECKOUT.x, CHECKOUT.y, CHECKOUT.w, CHECKOUT.h);
  ctx.strokeStyle = '#0a0518';
  ctx.lineWidth = 3;
  ctx.strokeRect(CHECKOUT.x, CHECKOUT.y, CHECKOUT.w, CHECKOUT.h);
  ctx.fillStyle = '#0a0518';
  ctx.font = 'bold 15px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHECKOUT', CHECKOUT.x + CHECKOUT.w / 2, CHECKOUT.y + CHECKOUT.h / 2 - 6);
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillText('tap Check Out to finish', CHECKOUT.x + CHECKOUT.w / 2, CHECKOUT.y + CHECKOUT.h / 2 + 16);

  /* Groceries on the floor. */
  const t = now / 1000;
  for (const spot of spots) {
    if (!spot.item) continue;
    const item = spot.item;
    if (item.bonus) {
      /* Golden glow: a static gold ring under reduced motion, a
         gentle pulse otherwise. */
      const pulse = reducedMotion ? 0 : Math.sin(t * 4 + spot.x) * 2;
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 24 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff8a00';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (!reducedMotion) {
        ctx.fillStyle = '#fff8e7';
        ctx.font = '12px sans-serif';
        ctx.fillText('✦', spot.x - 18, spot.y - 16);
        ctx.fillText('✦', spot.x + 16, spot.y + 20);
      }
    } else {
      ctx.fillStyle = '#fff8e7';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0518';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, spot.x, spot.y - 2);
    ctx.fillStyle = item.bonus ? '#0a0518' : '#241a4d';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.fillText(money(item.price), spot.x, spot.y + 16);
  }

  /* Shoppers. */
  for (const shopper of shoppers) {
    ctx.fillStyle = shopper.color;
    ctx.beginPath();
    ctx.arc(shopper.x, shopper.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shopper.emoji, shopper.x, shopper.y);
  }

  /* Player cart. */
  if (state !== 'menu' && player) {
    const wobble = reducedMotion ? 0 : Math.sin(t * 14) * 0.12 * player.wobble;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(wobble);
    /* Basket. */
    ctx.fillStyle = '#ff2e63';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(14, -8);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* Handle + wheels. */
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(-19, -14);
    ctx.stroke();
    ctx.fillStyle = '#0a0518';
    ctx.beginPath();
    ctx.arc(-8, 13, 3, 0, Math.PI * 2);
    ctx.arc(8, 13, 3, 0, Math.PI * 2);
    ctx.fill();
    /* The shopper. */
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(0, -18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2ec4ff';
    ctx.beginPath();
    ctx.arc(0, -20, 8, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    /* Fullness: little groceries peeking out of the cart. */
    if (cartCount > 0) {
      const peek = Math.min(3, Math.ceil(cartCount / 4));
      ctx.font = '12px sans-serif';
      for (let i = 0; i < peek; i += 1) {
        ctx.fillText(['🍎', '🥛', '🍞'][i], player.x - 10 + i * 10, player.y - 8);
      }
    }
  }

  /* Floaters. */
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  /* Touch joystick. */
  if (joystick.active) {
    ctx.strokeStyle = 'rgba(10, 5, 24, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joystick.ox, joystick.oy, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 46, 99, 0.75)';
    ctx.beginPath();
    ctx.arc(joystick.ox + joystick.dx * 52, joystick.oy + joystick.dy * 52, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ loop */

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (state === 'playing' && !paused) {
    /* update() works in seconds (slow timers, respawn timers); the
       renderer takes raw milliseconds for its sparkle animation. */
    update(dt, ts / 1000);
  }
  drawStore(ts);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ chrome */

function toggleMute() {
  sound.setMuted(!sound.isMuted());
  syncMuteButton();
}

function syncMuteButton() {
  const muted = sound.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
}

muteButton.addEventListener('click', toggleMute);

fullscreenButton.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    section.requestFullscreen?.().catch(() => {});
  }
});

document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-pressed', String(active));
});

checkoutButton.addEventListener('click', () => {
  if (state === 'playing') endRun(true);
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('selected'));
    button.classList.add('selected');
    modeSeconds = Number(button.dataset.mode);
  });
});

$('start-button').addEventListener('click', () => {
  startRun();
});

$('play-again-button').addEventListener('click', () => {
  startRun();
});

$('quit-button').addEventListener('click', () => {
  window.location.href = '../../../games.html';
});

let helpPaused = false;

$('help-button').addEventListener('click', () => {
  $('help-overlay').hidden = false;
  if (state === 'playing' && !autoPause.paused) {
    autoPause.toggle();
    helpPaused = true;
  }
});

$('help-close').addEventListener('click', () => {
  $('help-overlay').hidden = true;
  if (helpPaused && autoPause.paused) autoPause.toggle();
  helpPaused = false;
});

$('howto-button').addEventListener('click', () => {
  $('help-overlay').hidden = false;
});

/* Pause: shared auto-pause owns the overlay + P / Escape + tab-hide. */
const autoPause = createAutoPause({
  container: section,
  shouldPause: () => state === 'playing' && resultsOverlay.hidden,
  button: pauseButton,
  audio: sound,
  muteButton,
  message: 'Paused — the groceries can wait.',
  onPause: () => {
    paused = true;
    pausedNote.hidden = false;
  },
  onResume: () => {
    paused = false;
    pausedNote.hidden = true;
    lastTs = performance.now();
  },
});

/* ------------------------------------------------------------------ boot */

sizeCanvas();
window.addEventListener('resize', sizeCanvas);
syncMuteButton();
updateBestLine();
drawStore(0);
requestAnimationFrame(frame);
