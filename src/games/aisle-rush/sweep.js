/**
 * Aisle Rush '85 — the supermarket sweep.
 * One canvas engine for both the Big Sweep and the Bonus Sweep:
 * top-down cart driving, shelf pickups, giant bonus items, hidden cash,
 * cart exchanges at your register, and a 60-second clue chase.
 */

import { AISLES, TEAMS, BONUS_TARGETS } from './content.js';

export const CART_CAP = 24;

const W = 1600;
const H = 1000;
const CART_RADIUS = 17;
const MAX_SPEED = 360;
const ACCEL = 1850;
const DRAG = 3.6;
const PICK_RADIUS = 47;
const REGISTER_X = [300, 800, 1300];
const PLAY = { left: 38, right: 1562, top: 100, bottom: 896 };

const SHELVES = [
  { x: 200, y: 250, w: 90, h: 510, aisle: 0 },
  { x: 520, y: 250, w: 90, h: 510, aisle: 1 },
  { x: 840, y: 250, w: 90, h: 510, aisle: 2 },
  { x: 1160, y: 250, w: 90, h: 510, aisle: 3 },
  { x: 360, y: 100, w: 880, h: 84, aisle: 4, deli: true },
];

const GIANT_SPOTS = [
  { art: 'pickles', name: 'GIANT PICKLE JAR', value: 250, x: 105, y: 445 },
  { art: 'turkey', name: 'GIANT TURKEY', value: 300, x: 1492, y: 380 },
  { art: 'suds', name: 'GIANT MEGA SUDS', value: 200, x: 680, y: 858 },
  { art: 'cereal', name: 'GIANT CEREAL BOX', value: 180, x: 1350, y: 215 },
  { art: 'cheese', name: 'GIANT CHEESE WHEEL', value: 250, x: 1050, y: 858 },
];

const MONEY_SPOTS = [
  { x: 1470, y: 855, value: 500 },
  { x: 95, y: 855, value: 250 },
  { x: 500, y: 215, value: 100 },
  { x: 1490, y: 215, value: 200 },
];

const FONT_DISPLAY = '"Bungee", "Arial Black", sans-serif';
const FONT_BODY = 'Inter, system-ui, sans-serif';
const FONT_PIXEL = '"Press Start 2P", monospace';

const FLOOR_A = '#fff2e2';
const FLOOR_B = '#ffdcea';
const INK = '#1b0829';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randRange = (rand, min, max) => min + rand() * (max - min);
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const money = (value) => `$${Math.round(value).toLocaleString('en-US')}`;

function shuffled(list, rand) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function roundedPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function textOn(hex) {
  const n = Number.parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return '#fff8e7';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 158 ? '#241033' : '#fff8e7';
}

export function createSweep(canvas, options) {
  const {
    mode = 'sweep',
    seconds = 90,
    teamIndex = 0,
    rivals = [],
    audio = { sfx() {} },
    onHud = () => {},
    onToast = () => {},
    onEnd = () => {},
    onBonusTarget = () => {},
    reducedMotion = false,
  } = options;

  const rand = Math.random;
  const team = TEAMS[teamIndex] || TEAMS[0];
  const registerX = REGISTER_X[teamIndex] || REGISTER_X[1];

  const state = {
    running: false,
    paused: false,
    over: false,
    clock: 0,
    elapsed: 0,
    timeLeft: seconds,
    seconds,
    cart: [],
    cartValue: 0,
    banked: 0,
    itemCount: 0,
    tally: new Map(),
    items: [],
    giants: [],
    money: [],
    targets: [],
    cash: null,
    bonusIndex: 0,
    player: {
      x: registerX,
      y: 858,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: CART_RADIUS,
    },
    keys: new Set(),
    joy: { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 },
    cam: { x: 0, y: 0, scale: 1, init: false },
    floaters: [],
    particles: [],
    rings: [],
    warned: new Set(),
    entered: new Set(),
    bankCooldown: 0,
    fullAt: 0,
    hudAt: 0,
    capAt: new Map(),
    shake: 0,
    finishFlash: 0,
    touchHint: 0,
  };

  let raf = 0;
  let lastFrame = 0;
  let resizeObserver = null;
  const abort = new AbortController();

  /* ---------------------------------------------------------------- *
   * Store building
   * ---------------------------------------------------------------- */

  function makeShelfItems(collectible) {
    const items = [];
    SHELVES.forEach((shelf, shelfIndex) => {
      const aisle = AISLES[shelf.aisle];
      if (shelf.deli) {
        for (let i = 0; i < 13; i += 1) {
          const product = pick(aisle.products, rand);
          items.push({
            id: `item-${shelfIndex}-${i}`,
            product,
            x: 390 + i * 68 + randRange(rand, -2, 2),
            y: 198,
            collected: false,
            collectible,
            phase: rand() * Math.PI * 2,
          });
        }
        return;
      }
      for (let side = 0; side < 2; side += 1) {
        for (let i = 0; i < 9; i += 1) {
          const product = pick(aisle.products, rand);
          items.push({
            id: `item-${shelfIndex}-${side}-${i}`,
            product,
            x: (side === 0 ? shelf.x - 16 : shelf.x + shelf.w + 16) + randRange(rand, -2, 2),
            y: 282 + i * 55,
            collected: false,
            collectible,
            phase: rand() * Math.PI * 2,
          });
        }
      }
    });
    return items;
  }

  function buildRun() {
    state.items = makeShelfItems(mode === 'sweep');
    state.giants = [];
    state.money = [];
    state.targets = [];
    state.cash = null;
    state.bonusIndex = 0;

    if (mode === 'sweep') {
      state.giants = shuffled(GIANT_SPOTS, rand)
        .slice(0, 4)
        .map((spot, index) => ({ ...spot, id: `giant-${index}`, collected: false }));
      state.money = shuffled(MONEY_SPOTS, rand)
        .slice(0, 3)
        .map((spot, index) => ({ ...spot, id: `money-${index}`, collected: false }));
    } else {
      state.targets = BONUS_TARGETS.map((target, index) => ({
        ...target,
        index,
        collected: false,
      }));
    }
  }

  /* ---------------------------------------------------------------- *
   * Geometry and input
   * ---------------------------------------------------------------- */

  function blocked(x, y, radius) {
    if (x - radius < PLAY.left || x + radius > PLAY.right) return true;
    if (y - radius < PLAY.top || y + radius > PLAY.bottom) return true;
    for (const shelf of SHELVES) {
      const nearX = clamp(x, shelf.x, shelf.x + shelf.w);
      const nearY = clamp(y, shelf.y, shelf.y + shelf.h);
      const dx = x - nearX;
      const dy = y - nearY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  function inRegisterZone() {
    return (
      Math.abs(state.player.x - registerX) < 116 &&
      state.player.y > 798 &&
      state.player.y < PLAY.bottom + 2
    );
  }

  const MOVE_KEYS = new Set([
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'w',
    'a',
    's',
    'd',
  ]);

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!MOVE_KEYS.has(key)) return;
    if (state.running && !state.paused && !state.over) {
      state.keys.add(key);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    state.keys.delete(event.key.toLowerCase());
  }

  function clearKeys() {
    state.keys.clear();
  }

  function onPointerDown(event) {
    if (!state.running || state.paused || state.over) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    state.joy.active = true;
    state.joy.id = event.pointerId;
    state.joy.cx = event.clientX - rect.left;
    state.joy.cy = event.clientY - rect.top;
    state.joy.dx = 0;
    state.joy.dy = 0;
    state.touchHint = 1;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      /* Safari can refuse capture; dragging still works. */
    }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!state.joy.active || state.joy.id !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dx = event.clientX - rect.left - state.joy.cx;
    const dy = event.clientY - rect.top - state.joy.cy;
    const length = Math.hypot(dx, dy);
    const max = 64;
    const scale = length > max ? max / length : 1;
    state.joy.dx = dx * scale;
    state.joy.dy = dy * scale;
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (state.joy.id !== event.pointerId) return;
    state.joy.active = false;
    state.joy.id = null;
    state.joy.dx = 0;
    state.joy.dy = 0;
  }

  window.addEventListener('keydown', onKeyDown, { signal: abort.signal });
  window.addEventListener('keyup', onKeyUp, { signal: abort.signal });
  window.addEventListener('blur', clearKeys, { signal: abort.signal });
  canvas.addEventListener('pointerdown', onPointerDown, { signal: abort.signal });
  canvas.addEventListener('pointermove', onPointerMove, { signal: abort.signal });
  canvas.addEventListener('pointerup', onPointerUp, { signal: abort.signal });
  canvas.addEventListener('pointercancel', onPointerUp, { signal: abort.signal });
  canvas.addEventListener('pointerleave', onPointerUp, { signal: abort.signal });

  /* ---------------------------------------------------------------- *
   * Effects
   * ---------------------------------------------------------------- */

  function floater(x, y, text, color = '#fff8e7', size = 22) {
    state.floaters.push({ x, y, text, color, size, life: 1, max: 1, vy: -42 });
    if (state.floaters.length > 26) state.floaters.shift();
  }

  function burst(x, y, color, count = 8, speed = 130) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand() * Math.PI * 2;
      const power = randRange(rand, speed * 0.35, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        color,
        size: randRange(rand, 2, 5),
        life: randRange(rand, 0.35, 0.8),
        max: 0.8,
      });
    }
  }

  function ring(x, y, color, max = 60) {
    state.rings.push({ x, y, radius: 8, max, color, life: 0.45, maxLife: 0.45 });
  }

  /* ---------------------------------------------------------------- *
   * Sweep actions
   * ---------------------------------------------------------------- */

  function updateHud(force = false) {
    if (!force) {
      state.hudAt += 1;
      if (state.hudAt < 5) return;
    }
    state.hudAt = 0;
    onHud({
      mode,
      timeLeft: state.timeLeft,
      seconds: state.seconds,
      cartValue: state.cartValue,
      banked: state.banked,
      cartCount: state.cart.length,
      cartCap: CART_CAP,
      full: state.cart.length >= CART_CAP,
      items: state.itemCount,
      bonusIndex: state.bonusIndex,
      bonusTotal: BONUS_TARGETS.length,
      running: state.running,
    });
  }

  function collectShelfItem(item) {
    if (state.cart.length >= CART_CAP) {
      toastFull();
      return;
    }
    const product = item.product;
    const count = state.tally.get(product.id)?.count || 0;
    if (count >= 5) {
      const last = state.capAt.get(product.id) || -10;
      if (state.elapsed - last > 1.4) {
        state.capAt.set(product.id, state.elapsed);
        floater(item.x, item.y - 18, 'FIVE MAX!', '#ffd93d', 15);
      }
      return;
    }

    item.collected = true;
    state.cart.push({ product });
    state.cartValue += product.price;
    state.itemCount += 1;
    const entry = state.tally.get(product.id) || {
      name: product.name,
      unit: product.price,
      count: 0,
      total: 0,
      color: product.color,
    };
    entry.count += 1;
    entry.total += product.price;
    state.tally.set(product.id, entry);

    burst(item.x, item.y, product.accent, 5, 95);
    floater(item.x, item.y - 16, `+${money(product.price)}`, '#fff8e7', 15);
    audio.sfx(product.price >= 12 ? 'premium' : 'pickup');

    if (state.cart.length >= CART_CAP) {
      floater(state.player.x, state.player.y - 34, 'CART FULL!', '#ff2e97', 19);
      onToast('CART FULL — RACE IT BACK TO YOUR REGISTER!', 'warn');
    }
  }

  function collectGiant(giant) {
    if (state.cart.length >= CART_CAP) {
      toastFull();
      return;
    }
    giant.collected = true;
    state.cart.push({ product: { name: giant.name, price: giant.value, color: '#ffd93d' } });
    state.cartValue += giant.value;
    state.itemCount += 1;
    state.shake = Math.min(1, state.shake + 0.5);
    burst(giant.x, giant.y, '#ffd93d', 22, 210);
    ring(giant.x, giant.y, '#ffd93d', 100);
    floater(giant.x, giant.y - 54, `+${money(giant.value)} GIANT!`, '#ffd93d', 24);
    audio.sfx('giant');
    onToast(`${giant.name} — ${money(giant.value)} IN THE CART!`, 'good');
    if (state.cart.length >= CART_CAP) toastFull();
  }

  function collectMoney(cash) {
    cash.collected = true;
    state.banked += cash.value;
    burst(cash.x, cash.y, '#7dffb0', 18, 180);
    ring(cash.x, cash.y, '#7dffb0', 90);
    floater(cash.x, cash.y - 28, `FOUND ${money(cash.value)}!`, '#7dffb0', 22);
    audio.sfx('money');
    onToast(`HIDDEN CASH! ${money(cash.value)} GOES STRAIGHT TO THE TILL.`, 'good');
  }

  function collectTarget(target) {
    target.collected = true;
    state.bonusIndex += 1;
    burst(target.x, target.y, '#ffd93d', 24, 220);
    ring(target.x, target.y, '#ffd93d', 120);
    floater(target.x, target.y - 50, `CLUE ${state.bonusIndex} FOUND!`, '#ffd93d', 23);
    audio.sfx('target');
    onBonusTarget(state.bonusIndex, state.bonusIndex >= BONUS_TARGETS.length, target);
    if (state.bonusIndex >= BONUS_TARGETS.length) {
      state.cash = {
        x: registerX,
        y: 858,
        value: 5000,
        collected: false,
      };
      onToast('THE CASH IS WAITING AT YOUR REGISTER — GO!', 'good');
    }
  }

  function toastFull() {
    if (state.clock - state.fullAt < 2.2) return;
    state.fullAt = state.clock;
    onToast('CART FULL — GET TO YOUR REGISTER TO BANK IT!', 'warn');
  }

  function bankCart() {
    if (!state.cart.length || state.bankCooldown > 0) return;
    const amount = state.cartValue;
    state.banked += amount;
    state.cart = [];
    state.cartValue = 0;
    state.bankCooldown = 1.15;
    state.shake = Math.min(1, state.shake + 0.18);
    ring(state.player.x, state.player.y, team.color, 85);
    floater(state.player.x, state.player.y - 34, `BANKED ${money(amount)}`, team.color, 23);
    audio.sfx('bank');
    onToast(`BANKED ${money(amount)} — FRESH CART, GO GO GO!`, 'good');
  }

  /* ---------------------------------------------------------------- *
   * Update
   * ---------------------------------------------------------------- */

  function update(dt) {
    state.clock += dt;
    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.bankCooldown = Math.max(0, state.bankCooldown - dt);
    state.shake = Math.max(0, state.shake - dt * 2.4);
    state.finishFlash = Math.max(0, state.finishFlash - dt);
    if (state.touchHint < 1) state.touchHint = Math.min(1, state.touchHint + dt * 0.35);

    const player = state.player;
    let ix = 0;
    let iy = 0;
    if (state.keys.has('arrowleft') || state.keys.has('a')) ix -= 1;
    if (state.keys.has('arrowright') || state.keys.has('d')) ix += 1;
    if (state.keys.has('arrowup') || state.keys.has('w')) iy -= 1;
    if (state.keys.has('arrowdown') || state.keys.has('s')) iy += 1;
    if (state.joy.active) {
      ix += state.joy.dx / 64;
      iy += state.joy.dy / 64;
    }
    const inputLength = Math.hypot(ix, iy);
    if (inputLength > 1) {
      ix /= inputLength;
      iy /= inputLength;
    }

    player.vx += ix * ACCEL * dt;
    player.vy += iy * ACCEL * dt;
    const damping = Math.exp(-DRAG * dt);
    player.vx *= damping;
    player.vy *= damping;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > MAX_SPEED) {
      player.vx = (player.vx / speed) * MAX_SPEED;
      player.vy = (player.vy / speed) * MAX_SPEED;
    }
    if (speed > 24) {
      const targetAngle = Math.atan2(player.vy, player.vx);
      let diff = targetAngle - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.angle += diff * Math.min(1, dt * 14);
    }

    const nextX = player.x + player.vx * dt;
    if (!blocked(nextX, player.y, player.radius)) player.x = nextX;
    else player.vx = 0;
    const nextY = player.y + player.vy * dt;
    if (!blocked(player.x, nextY, player.radius)) player.y = nextY;
    else player.vy = 0;

    if (state.joy.active) {
      state.touchHint = 1;
    }

    /* Pickups */
    if (mode === 'bonus') {
      if (!state.cash && state.bonusIndex < BONUS_TARGETS.length) {
        const target = state.targets[state.bonusIndex];
        if (target && !target.collected) {
          const dist = Math.hypot(player.x - target.x, player.y - target.y);
          if (dist < PICK_RADIUS + 16) collectTarget(target);
        }
      }
      if (state.cash && !state.cash.collected) {
        const dist = Math.hypot(player.x - state.cash.x, player.y - state.cash.y);
        if (dist < PICK_RADIUS + 12) {
          state.cash.collected = true;
          burst(state.cash.x, state.cash.y, '#7dffb0', 28, 240);
          audio.sfx('win');
          finish('cash');
          return;
        }
      }
    } else {
      for (const giant of state.giants) {
        if (giant.collected) continue;
        if (Math.hypot(player.x - giant.x, player.y - giant.y) < PICK_RADIUS + 14) {
          collectGiant(giant);
        }
      }
      for (const cash of state.money) {
        if (cash.collected) continue;
        if (Math.hypot(player.x - cash.x, player.y - cash.y) < PICK_RADIUS + 10) {
          collectMoney(cash);
        }
      }

      let nearest = null;
      let nearestDist = PICK_RADIUS;
      for (const item of state.items) {
        if (!item.collectible || item.collected) continue;
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < nearestDist) {
          nearest = item;
          nearestDist = dist;
        }
      }
      if (nearest) collectShelfItem(nearest);

      if (state.cart.length && inRegisterZone()) bankCart();
    }

    /* Timer warnings and rival entrances */
    for (const mark of [30, 10, 5, 4, 3, 2, 1]) {
      if (state.timeLeft <= mark && !state.warned.has(mark) && state.timeLeft > 0) {
        state.warned.add(mark);
        audio.sfx('tick');
        if (mark === 30) onToast('THIRTY SECONDS LEFT!', 'warn');
        else if (mark === 10) onToast('TEN SECONDS! DIG IN!', 'warn');
      }
    }
    if (state.timeLeft <= 0) {
      audio.sfx('timeup');
      finish('time');
      return;
    }

    for (const rival of rivals) {
      if (!rival || state.entered.has(rival.name)) continue;
      if (rival.time < state.seconds && state.timeLeft <= rival.time + 0.05) {
        state.entered.add(rival.name);
        onToast(`${rival.name} IS IN THE MARKET!`, 'rival');
      }
    }

    /* Effects */
    for (const f of state.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const r of state.rings) {
      r.life -= dt;
      r.radius += (r.max - r.radius) * Math.min(1, dt * 8);
    }
    state.rings = state.rings.filter((r) => r.life > 0);

    updateHud();
  }

  function finish(reason) {
    if (state.over) return;
    state.over = true;
    state.running = false;
    state.keys.clear();
    state.joy.active = false;
    updateHud(true);
    const stats = {
      mode,
      reason,
      secondsLeft: Math.max(0, state.timeLeft),
      banked: state.banked,
      cartValue: state.cartValue,
      total: state.banked + state.cartValue,
      cartCount: state.cart.length,
      itemCount: state.itemCount,
      receipt: [...state.tally.values()].sort((a, b) => b.total - a.total),
      giants: state.giants.filter((g) => g.collected).map(({ name, value }) => ({ name, value })),
      money: state.money.filter((m) => m.collected).map(({ value }) => ({ value })),
      bonusIndex: state.bonusIndex,
      bonusWon: reason === 'cash',
      timeUsed: Math.max(0, state.seconds - state.timeLeft),
    };
    onEnd(stats);
  }

  /* ---------------------------------------------------------------- *
   * Drawing helpers
   * ---------------------------------------------------------------- */

  function drawPackage(ctx, x, y, product, scale = 1) {
    const w = 24 * scale;
    const h = 26 * scale;
    const left = x - w / 2;
    const top = y - h / 2;
    const ink = textOn(product.color);

    ctx.save();
    ctx.fillStyle = 'rgba(20, 5, 31, 0.22)';
    roundedPath(ctx, left + 2, top + 3, w, h, 3);
    ctx.fill();

    if (product.art === 'can') {
      ctx.fillStyle = product.color;
      roundedPath(ctx, left, top + 2, w, h - 4, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, top + 3, w / 2 - 1, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (product.art === 'bottle') {
      ctx.fillStyle = product.color;
      roundedPath(ctx, left + 3, top + 6, w - 6, h - 7, 3);
      ctx.fill();
      ctx.fillRect(x - 2, top, 4, 7);
      ctx.fillStyle = product.accent;
      ctx.fillRect(x - 3, top, 6, 3);
    } else if (product.art === 'jar') {
      ctx.fillStyle = product.color;
      roundedPath(ctx, left + 1, top + 4, w - 2, h - 5, 4);
      ctx.fill();
      ctx.fillStyle = '#c9d4dd';
      roundedPath(ctx, left + 2, top, w - 4, 5, 2);
      ctx.fill();
    } else if (product.art === 'carton') {
      ctx.fillStyle = product.color;
      ctx.beginPath();
      ctx.moveTo(left + 2, top + 7);
      ctx.lineTo(x, top);
      ctx.lineTo(left + w - 2, top + 7);
      ctx.lineTo(left + w - 2, top + h);
      ctx.lineTo(left + 2, top + h);
      ctx.closePath();
      ctx.fill();
    } else if (product.art === 'bag') {
      ctx.fillStyle = product.color;
      ctx.beginPath();
      ctx.moveTo(left + 1, top + 3);
      ctx.lineTo(left + w - 1, top + 3);
      ctx.lineTo(left + w - 3, top + h);
      ctx.lineTo(left + 3, top + h);
      ctx.closePath();
      ctx.fill();
    } else if (product.art === 'meat') {
      ctx.fillStyle = '#f4eadc';
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = product.color;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, w / 2 - 5, h / 2 - 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (product.art === 'bread') {
      ctx.fillStyle = product.color;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2 - 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = product.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y - 3);
      ctx.stroke();
    } else if (product.art === 'cake') {
      ctx.fillStyle = product.color;
      roundedPath(ctx, left + 2, top + 8, w - 4, h - 10, 5);
      ctx.fill();
      ctx.fillStyle = product.accent;
      ctx.fillRect(x - 1, top + 2, 2, 7);
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(x, top + 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = product.color;
      roundedPath(ctx, left, top, w, h, 3);
      ctx.fill();
    }

    if (product.art !== 'meat' && product.art !== 'bread') {
      ctx.fillStyle = product.accent;
      ctx.fillRect(left + 1, top + h * 0.42, w - 2, h * 0.26);
    }

    ctx.fillStyle = product.art === 'meat' || product.art === 'bread' ? '#fff8e7' : ink;
    ctx.font = `800 ${Math.round(5.5 * scale)}px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(product.short.slice(0, 4), x, top + h * 0.55);

    if (product.price >= 12) {
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(left + w - 2, top + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2105';
      ctx.font = `900 ${Math.round(6 * scale)}px ${FONT_BODY}`;
      ctx.fillText('$', left + w - 2, top + 2.5);
    }
    ctx.restore();
  }

  function drawGiantArt(ctx, art, x, y, scale = 1, t = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (art === 'pickles') {
      ctx.fillStyle = '#7ac74f';
      roundedPath(ctx, -30, -34, 60, 68, 12);
      ctx.fill();
      ctx.fillStyle = '#cfe2d5';
      roundedPath(ctx, -33, -48, 66, 16, 5);
      ctx.fill();
      ctx.fillStyle = '#efffe9';
      roundedPath(ctx, -23, -8, 46, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#2f6b2f';
      ctx.font = `800 13px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('PICKLES', 0, 10);
      ctx.fillStyle = '#3f8f2f';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(-12 + i * 12, -26, 7, 9, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (art === 'turkey') {
      ctx.fillStyle = '#c9894b';
      ctx.beginPath();
      ctx.ellipse(0, 2, 38, 31, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e3ad74';
      ctx.beginPath();
      ctx.ellipse(0, -4, 28, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b06f34';
      ctx.beginPath();
      ctx.ellipse(-30, 16, 14, 10, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(30, 16, 14, 10, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e32626';
      ctx.beginPath();
      ctx.arc(0, 6, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (art === 'suds') {
      ctx.fillStyle = '#f4fcff';
      roundedPath(ctx, -32, -40, 64, 80, 6);
      ctx.fill();
      ctx.fillStyle = '#2fe4ff';
      ctx.fillRect(-32, -12, 64, 22);
      ctx.fillStyle = '#0b6a7d';
      ctx.font = `800 16px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('SUDS', 0, 5);
      ctx.fillStyle = '#ff2e97';
      ctx.beginPath();
      ctx.arc(18, -26, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b983ff';
      ctx.beginPath();
      ctx.arc(-14, -27, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (art === 'cereal') {
      ctx.fillStyle = '#ff8ac0';
      roundedPath(ctx, -30, -42, 60, 84, 4);
      ctx.fill();
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-24, -14, 48, 30);
      ctx.fillStyle = '#5a1a3a';
      ctx.font = `800 12px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('BOOM', 0, 6);
      ctx.fillStyle = '#8a4b2a';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(-18 + i * 12, -28, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (art === 'cheese') {
      ctx.fillStyle = '#ffd35c';
      ctx.beginPath();
      ctx.moveTo(-36, 26);
      ctx.lineTo(34, 26);
      ctx.lineTo(-8, -28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e0a300';
      ctx.beginPath();
      ctx.arc(-6, 12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, 18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-15, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStore(ctx, t) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 2 || height < 2) return;
    const p = state.player;
    const viewH = width < 640 ? 620 : 720;
    const scale = Math.max(height / viewH, width / W);
    const viewW = width / scale;
    const viewHeight = height / scale;
    const targetX = clamp(p.x - viewW / 2, 0, Math.max(0, W - viewW));
    const targetY = clamp(p.y - viewHeight / 2, 0, Math.max(0, H - viewHeight));
    if (!state.cam.init) {
      state.cam.x = targetX;
      state.cam.y = targetY;
      state.cam.scale = scale;
      state.cam.init = true;
    }
    const ease = reducedMotion ? 1 : 1 - Math.exp(-8 * 0.016);
    state.cam.x += (targetX - state.cam.x) * ease;
    state.cam.y += (targetY - state.cam.y) * ease;
    state.cam.scale = scale;

    const shakeX = reducedMotion || state.shake < 0.05 ? 0 : (rand() - 0.5) * 12 * state.shake;
    const shakeY = reducedMotion || state.shake < 0.05 ? 0 : (rand() - 0.5) * 12 * state.shake;

    ctx.save();
    ctx.translate(-state.cam.x * scale + shakeX, -state.cam.y * scale + shakeY);
    ctx.scale(scale, scale);

    /* floor */
    ctx.fillStyle = FLOOR_A;
    ctx.fillRect(0, 0, W, H);
    const tile = 80;
    ctx.fillStyle = FLOOR_B;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        if ((x / tile + y / tile) % 2 === 0) continue;
        ctx.fillRect(x, y, tile, tile);
      }
    }

    const glow = ctx.createRadialGradient(800, 470, 80, 800, 470, 720);
    glow.addColorStop(0, 'rgba(255,255,255,0.18)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    /* painted walkway stripes at the store edges */
    ctx.fillStyle = 'rgba(255,46,151,0.09)';
    ctx.fillRect(0, 760, W, 140);
    ctx.fillStyle = 'rgba(47,228,255,0.08)';
    ctx.fillRect(0, 184, W, 66);

    /* walls */
    ctx.fillStyle = '#2b0b45';
    ctx.fillRect(0, 0, W, 90);
    ctx.fillRect(0, 964, W, 36);
    ctx.fillRect(0, 0, 30, H);
    ctx.fillRect(1570, 0, 30, H);
    ctx.fillStyle = '#ff2e97';
    ctx.fillRect(0, 86, W, 4);
    ctx.fillStyle = '#2fe4ff';
    ctx.fillRect(0, 960, W, 4);
    ctx.fillRect(26, 90, 4, 874);
    ctx.fillRect(1570, 90, 4, 874);

    /* top marquee */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `34px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#2fe4ff';
    ctx.shadowColor = '#2fe4ff';
    ctx.shadowBlur = 18;
    ctx.fillText("AISLE RUSH '85", 800, 44);
    ctx.shadowBlur = 0;
    ctx.font = `13px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffd93d';
    ctx.fillText('★ THE SUPERMARKET GAME SHOW ★', 800, 74);
    ctx.restore();

    /* disco ball */
    const ballX = 120;
    const ballY = 42;
    ctx.fillStyle = '#dbe8ff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(47,228,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = -14; i <= 14; i += 7) {
      ctx.beginPath();
      ctx.moveTo(ballX - 18, ballY + i);
      ctx.lineTo(ballX + 18, ballY + i);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.arc(ballX - 6, ballY - 7, 4, 0, Math.PI * 2);
    ctx.fill();

    /* balloons */
    for (const [bx, by, color] of [
      [1490, 52, '#ff2e97'],
      [1524, 38, '#ffd93d'],
      [1512, 74, '#2fe4ff'],
      [76, 58, '#b983ff'],
    ]) {
      ctx.strokeStyle = 'rgba(43,11,69,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by + 14);
      ctx.lineTo(bx + 4, by + 40);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(bx, by, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* checkout label */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `20px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffd93d';
    ctx.fillText('CHECKOUT', 800, 986);
    ctx.font = `10px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ff8ac0';
    ctx.fillText('THANK YOU FOR SHOPPING', 800, 1002);
    ctx.restore();

    /* aisle numbers on the floor */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `800 16px ${FONT_DISPLAY}`;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = 'rgba(43,11,69,0.26)';
      ctx.fillText(`AISLE ${i + 1}`, SHELVES[i].x + 45, 245 - 5);
    }
    ctx.fillStyle = 'rgba(43,11,69,0.26)';
    ctx.fillText('DELI · BAKERY · MEAT', 800, 90 + 5);
    ctx.restore();

    drawRegisters(ctx, t);
    drawShelves(ctx, t);
    drawItems(ctx, t);
    if (mode === 'sweep') {
      drawGiants(ctx, t);
      drawMoney(ctx, t);
    } else {
      drawBonuses(ctx, t);
    }
    drawEffects(ctx);
    drawCart(ctx, t);
    ctx.restore();

    drawScreenOverlay(ctx, t, scale);
  }

  function drawShelves(ctx, t) {
    for (let index = 0; index < SHELVES.length; index += 1) {
      const shelf = SHELVES[index];
      const aisle = AISLES[shelf.aisle];
      ctx.save();
      ctx.fillStyle = 'rgba(43,11,69,0.2)';
      roundedPath(ctx, shelf.x + 7, shelf.y + 9, shelf.w, shelf.h, 8);
      ctx.fill();

      ctx.fillStyle = '#3a1650';
      roundedPath(ctx, shelf.x, shelf.y, shelf.w, shelf.h, 8);
      ctx.fill();

      ctx.strokeStyle = aisle.color;
      ctx.lineWidth = 3;
      roundedPath(ctx, shelf.x + 3, shelf.y + 3, shelf.w - 6, shelf.h - 6, 6);
      ctx.stroke();

      if (shelf.deli) {
        ctx.fillStyle = 'rgba(255,138,0,0.22)';
        roundedPath(ctx, shelf.x + 8, shelf.y + 8, shelf.w - 16, shelf.h - 16, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,248,231,0.65)';
        for (let x = shelf.x + 40; x < shelf.x + shelf.w - 20; x += 120) {
          ctx.fillRect(x, shelf.y + 12, 2, shelf.h - 24);
        }
        ctx.fillStyle = '#ffd7a1';
        ctx.font = `800 12px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.fillText('FRESH TODAY', shelf.x + shelf.w / 2, shelf.y + 30);
      } else {
        ctx.strokeStyle = 'rgba(255,248,231,0.12)';
        ctx.lineWidth = 1;
        for (let y = shelf.y + 44; y < shelf.y + shelf.h - 20; y += 55) {
          ctx.beginPath();
          ctx.moveTo(shelf.x + 12, y);
          ctx.lineTo(shelf.x + shelf.w - 12, y);
          ctx.stroke();
        }
        const cap = ctx.createLinearGradient(shelf.x, shelf.y, shelf.x, shelf.y + 34);
        cap.addColorStop(0, aisle.color);
        cap.addColorStop(1, 'rgba(43,11,69,0.1)');
        ctx.fillStyle = cap;
        roundedPath(ctx, shelf.x + 3, shelf.y + 3, shelf.w - 6, 28, 5);
        ctx.fill();

        const signY = shelf.y - 20;
        ctx.save();
        ctx.translate(shelf.x + shelf.w / 2, signY);
        ctx.fillStyle = 'rgba(43,11,69,0.28)';
        roundedPath(ctx, -84 + 4, -15 + 4, 168, 30, 6);
        ctx.fill();
        ctx.fillStyle = '#220a36';
        roundedPath(ctx, -84, -15, 168, 30, 6);
        ctx.fill();
        ctx.strokeStyle = aisle.color;
        ctx.lineWidth = 2;
        roundedPath(ctx, -84, -15, 168, 30, 6);
        ctx.stroke();
        ctx.fillStyle = aisle.color;
        ctx.font = `10px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(aisle.name, 0, 1);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawItems(ctx, t) {
    const p = state.player;
    for (const item of state.items) {
      if (item.collected) continue;
      const collectible = mode === 'sweep' && item.collectible;
      const near = collectible && Math.hypot(p.x - item.x, p.y - item.y) < 105;
      if (near) {
        const halo = ctx.createRadialGradient(item.x, item.y, 2, item.x, item.y, 24);
        halo.addColorStop(0, 'rgba(255,217,61,0.4)');
        halo.addColorStop(1, 'rgba(255,217,61,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = mode === 'bonus' ? 0.82 : 1;
      drawPackage(ctx, item.x, item.y, item.product, 1);
      ctx.restore();
    }
  }

  function drawGiants(ctx, t) {
    for (let i = 0; i < state.giants.length; i += 1) {
      const giant = state.giants[i];
      if (giant.collected) continue;
      const pulse = 1 + Math.sin(t * 2.4 + i) * 0.04;
      const aura = ctx.createRadialGradient(giant.x, giant.y, 6, giant.x, giant.y, 68);
      aura.addColorStop(0, 'rgba(255,217,61,0.4)');
      aura.addColorStop(1, 'rgba(255,217,61,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(giant.x, giant.y, 68, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(giant.x, giant.y);
      ctx.rotate(t * 0.35);
      ctx.strokeStyle = 'rgba(255,217,61,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 48 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      drawGiantArt(ctx, giant.art, giant.x, giant.y, 0.9, t);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3a2105';
      ctx.font = `800 11px ${FONT_DISPLAY}`;
      roundedPath(ctx, giant.x - 48, giant.y - 76, 96, 22, 5);
      ctx.fillStyle = '#ffd93d';
      ctx.fill();
      ctx.fillStyle = '#3a2105';
      ctx.fillText(`GIANT ${money(giant.value)}`, giant.x, giant.y - 60);
      ctx.font = `800 9px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#8a0f4f';
      ctx.fillText(giant.name, giant.x, giant.y + 62);
      ctx.restore();
    }
  }

  function drawMoney(ctx, t) {
    for (let i = 0; i < state.money.length; i += 1) {
      const bill = state.money[i];
      if (bill.collected) continue;
      const bob = Math.sin(t * 3 + i) * 5;
      const aura = ctx.createRadialGradient(bill.x, bill.y, 3, bill.x, bill.y, 40);
      aura.addColorStop(0, 'rgba(125,255,176,0.45)');
      aura.addColorStop(1, 'rgba(125,255,176,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(bill.x, bill.y, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(bill.x, bill.y + bob);
      ctx.rotate(-0.16);
      ctx.fillStyle = '#c9ffe0';
      roundedPath(ctx, -22, -12, 44, 24, 3);
      ctx.fill();
      ctx.strokeStyle = '#13835a';
      ctx.lineWidth = 2;
      roundedPath(ctx, -18, -8, 36, 16, 2);
      ctx.stroke();
      ctx.fillStyle = '#13835a';
      ctx.font = `800 12px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(money(bill.value), 0, 1);
      ctx.restore();
    }
  }

  function drawBonuses(ctx, t) {
    if (state.bonusIndex < BONUS_TARGETS.length) {
      const target = state.targets[state.bonusIndex];
      if (target) {
        const pulse = 1 + Math.sin(t * 4) * 0.08;
        const aura = ctx.createRadialGradient(target.x, target.y, 8, target.x, target.y, 105);
        aura.addColorStop(0, 'rgba(255,217,61,0.5)');
        aura.addColorStop(0.5, 'rgba(255,46,151,0.18)');
        aura.addColorStop(1, 'rgba(255,46,151,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(target.x, target.y, 105, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.rotate(t * 0.6);
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, 60 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        drawGiantArt(ctx, target.art, target.x, target.y, 1, t);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `800 12px ${FONT_DISPLAY}`;
        const label = `CLUE ${state.bonusIndex + 1} · ${target.name}`;
        ctx.fillStyle = 'rgba(27,8,41,0.88)';
        const width = Math.min(260, label.length * 7.4 + 20);
        roundedPath(ctx, target.x - width / 2, target.y - 86, width, 24, 5);
        ctx.fill();
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffd93d';
        ctx.fillText(label, target.x, target.y - 69);
        ctx.restore();
      }
    }

    if (state.cash && !state.cash.collected) {
      const bob = Math.sin(t * 5) * 7;
      const aura = ctx.createRadialGradient(state.cash.x, state.cash.y, 5, state.cash.x, state.cash.y, 85);
      aura.addColorStop(0, 'rgba(125,255,176,0.55)');
      aura.addColorStop(1, 'rgba(125,255,176,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(state.cash.x, state.cash.y, 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(state.cash.x, state.cash.y + bob);
      ctx.fillStyle = '#19503a';
      roundedPath(ctx, -30, -20, 60, 40, 5);
      ctx.fill();
      ctx.fillStyle = '#7dffb0';
      ctx.fillRect(-30, -4, 60, 8);
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#3a2105';
      ctx.font = `800 10px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
      ctx.fillStyle = '#c9ffe0';
      ctx.font = `800 13px ${FONT_DISPLAY}`;
      ctx.fillText('THE CASH!', 0, -38);
      ctx.restore();
    }
  }

  function drawRegisters(ctx, t) {
    for (let i = 0; i < 3; i += 1) {
      const x = REGISTER_X[i];
      const lane = TEAMS[i];
      const active = i === teamIndex;
      const zoneTop = 802;
      const zoneBottom = 897;

      ctx.save();
      ctx.fillStyle = active ? `${lane.color}2e` : 'rgba(43,11,69,0.08)';
      roundedPath(ctx, x - 116, zoneTop, 232, zoneBottom - zoneTop, 10);
      ctx.fill();
      ctx.strokeStyle = active ? lane.color : 'rgba(43,11,69,0.25)';
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.setLineDash(active ? [10, 7] : [5, 8]);
      roundedPath(ctx, x - 116, zoneTop, 232, zoneBottom - zoneTop, 10);
      ctx.stroke();
      ctx.setLineDash([]);

      if (active) {
        const pulse = 0.55 + Math.sin(t * 3) * 0.2;
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.22})`;
        ctx.beginPath();
        ctx.ellipse(x, 854, 72, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.font = `800 11px ${FONT_DISPLAY}`;
      ctx.fillStyle = active ? lane.color : 'rgba(43,11,69,0.45)';
      ctx.fillText(active ? 'YOUR REGISTER · BANK HERE' : lane.name, x, 792);

      /* counter */
      ctx.fillStyle = '#2b0b45';
      roundedPath(ctx, x - 132, 908, 264, 56, 6);
      ctx.fill();
      ctx.fillStyle = '#4a2170';
      roundedPath(ctx, x - 128, 912, 256, 30, 4);
      ctx.fill();
      ctx.fillStyle = '#1b0829';
      ctx.fillRect(x - 96, 918, 130, 17);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      for (let s = x - 90; s < x + 28; s += 12) {
        ctx.beginPath();
        ctx.moveTo(s, 918);
        ctx.lineTo(s, 935);
        ctx.stroke();
      }

      /* register machine */
      ctx.fillStyle = '#c9d4dd';
      roundedPath(ctx, x + 48, 914, 56, 32, 4);
      ctx.fill();
      ctx.fillStyle = '#1b4a3a';
      ctx.fillRect(x + 54, 918, 30, 13);
      ctx.fillStyle = '#7dffb0';
      ctx.font = `800 8px ${FONT_PIXEL}`;
      ctx.textAlign = 'left';
      ctx.fillText(active ? 'READY' : '…', x + 56, 927);
      ctx.fillStyle = '#ff2e97';
      ctx.fillRect(x + 88, 918, 10, 5);

      /* partner waiting at the till */
      const partner = TEAMS[i].players[1];
      ctx.fillStyle = '#ffd9b3';
      ctx.beginPath();
      ctx.arc(x - 34, 936, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lane.deep;
      roundedPath(ctx, x - 48, 934, 28, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#fff8e7';
      ctx.font = `800 7px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.fillText(partner, x - 34, 960);

      if (active) {
        ctx.fillStyle = lane.color;
        ctx.font = `800 9px ${FONT_DISPLAY}`;
        ctx.fillText(mode === 'bonus' ? 'GET THE CASH HERE' : 'CART EXCHANGE', x, 900);
      }
      ctx.restore();
    }
  }

  function drawCart(ctx, t) {
    const p = state.player;
    const speed = Math.hypot(p.vx, p.vy);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    if (speed > 180 && !reducedMotion) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-34 - i * 9, -8 + i * 8);
        ctx.lineTo(-52 - i * 9, -8 + i * 8);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(27,8,41,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = team.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 17, 0, 0, Math.PI * 2);
    ctx.stroke();

    /* wheels */
    ctx.fillStyle = '#1b0829';
    for (const [wx, wy] of [
      [-14, -13],
      [7, -13],
      [-14, 13],
      [7, 13],
    ]) {
      roundedPath(ctx, wx - 3, wy - 2, 7, 5, 2);
      ctx.fill();
    }

    /* basket */
    ctx.fillStyle = '#f4f0ff';
    roundedPath(ctx, -18, -12, 33, 24, 5);
    ctx.fill();
    ctx.strokeStyle = '#8f7bb5';
    ctx.lineWidth = 1.5;
    for (let i = -12; i <= 10; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, -11);
      ctx.lineTo(i, 11);
      ctx.stroke();
    }

    /* groceries piled in */
    const pile = Math.min(state.cart.length, 12);
    for (let i = 0; i < pile; i += 1) {
      const px = -14 + (i % 4) * 7 + Math.sin(i * 3.4) * 1.6;
      const py = -7 + Math.floor(i / 4) * 7;
      ctx.fillStyle = state.cart[i]?.product?.color || '#ffd93d';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(27,8,41,0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    /* handle */
    ctx.strokeStyle = '#c9d4dd';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-20, -11);
    ctx.lineTo(-26, -15);
    ctx.lineTo(-26, 15);
    ctx.lineTo(-20, 11);
    ctx.stroke();

    ctx.restore();

    if (state.cart.length >= CART_CAP) {
      const pulse = 1 + Math.sin(t * 7) * 0.12;
      ctx.save();
      ctx.translate(p.x, p.y - 40 * pulse);
      ctx.fillStyle = '#ff2e97';
      ctx.font = `800 13px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('CART FULL!', 0, 0);
      ctx.restore();
    } else if (inRegisterZone() && state.cart.length > 0) {
      ctx.save();
      ctx.fillStyle = '#ffd93d';
      ctx.font = `800 11px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('BANKING…', p.x, p.y - 38);
      ctx.restore();
    }
  }

  function drawEffects(ctx) {
    for (const r of state.rings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const particle of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const f of state.floaters) {
      const alpha = Math.min(1, f.life * 2.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${f.size}px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(27,8,41,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawScreenOverlay(ctx, t, scale) {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    /* soft vignette */
    const vignette = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, ch * 0.85);
    vignette.addColorStop(0, 'rgba(20,5,31,0)');
    vignette.addColorStop(1, 'rgba(20,5,31,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cw, ch);

    if (state.timeLeft < 15 && (state.running || state.over)) {
      const pulse = 0.16 + Math.sin(t * 6) * 0.08;
      const danger = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.28, cw / 2, ch / 2, ch * 0.8);
      danger.addColorStop(0, 'rgba(255,46,151,0)');
      danger.addColorStop(1, `rgba(255,46,151,${pulse})`);
      ctx.fillStyle = danger;
      ctx.fillRect(0, 0, cw, ch);
    }

    /* minimap */
    const mapW = cw < 560 ? 104 : 148;
    const mapH = mapW * 0.62;
    const mx = cw - mapW - 12;
    const my = 12;
    ctx.save();
    ctx.fillStyle = 'rgba(18,6,30,0.8)';
    roundedPath(ctx, mx, my, mapW, mapH, 6);
    ctx.fill();
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 2;
    roundedPath(ctx, mx, my, mapW, mapH, 6);
    ctx.stroke();

    const innerX = mx + 6;
    const innerY = my + 6;
    const innerW = mapW - 12;
    const innerH = mapH - 12;
    const mapPoint = (x, y) => [
      innerX + (x / W) * innerW,
      innerY + (y / H) * innerH,
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (const shelf of SHELVES) {
      ctx.fillRect(
        innerX + (shelf.x / W) * innerW,
        innerY + (shelf.y / H) * innerH,
        (shelf.w / W) * innerW,
        (shelf.h / H) * innerH
      );
    }
    if (mode === 'sweep') {
      for (const giant of state.giants) {
        if (giant.collected) continue;
        const [gx, gy] = mapPoint(giant.x, giant.y);
        ctx.fillStyle = '#ffd93d';
        ctx.fillRect(gx - 2, gy - 2, 4, 4);
      }
      for (const bill of state.money) {
        if (bill.collected) continue;
        const [bx, by] = mapPoint(bill.x, bill.y);
        ctx.fillStyle = '#7dffb0';
        ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      }
    } else {
      const target = state.targets[state.bonusIndex];
      if (target) {
        const [tx, ty] = mapPoint(target.x, target.y);
        ctx.fillStyle = '#ffd93d';
        ctx.beginPath();
        ctx.arc(tx, ty, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.cash) {
        const [cx, cy] = mapPoint(state.cash.x, state.cash.y);
        ctx.fillStyle = '#7dffb0';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const [rx, ry] = mapPoint(registerX, 855);
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    const [px, py] = mapPoint(state.player.x, state.player.y);
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b0829';
    ctx.beginPath();
    ctx.arc(px, py, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* first-run steering hint */
    const hintAlpha =
      state.running && !state.joy.active && state.elapsed < 5.2
        ? Math.max(0, 1 - state.elapsed / 5.2)
        : 0;
    if (hintAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = hintAlpha;
      ctx.fillStyle = 'rgba(18,6,30,0.72)';
      const text = cw < 560 ? 'DRAG TO STEER' : 'WASD / ARROWS TO DRIVE';
      ctx.font = `800 11px ${FONT_DISPLAY}`;
      const width = ctx.measureText(text).width + 28;
      roundedPath(ctx, cw / 2 - width / 2, ch - 48, width, 30, 6);
      ctx.fill();
      ctx.fillStyle = '#fff8e7';
      ctx.textAlign = 'center';
      ctx.fillText(text, cw / 2, ch - 28);
      ctx.restore();
    }

    /* joystick */
    if (state.joy.active) {
      ctx.save();
      ctx.fillStyle = 'rgba(18,6,30,0.4)';
      ctx.beginPath();
      ctx.arc(state.joy.cx, state.joy.cy, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = team.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.joy.cx, state.joy.cy, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = team.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(state.joy.cx + state.joy.dx, state.joy.cy + state.joy.dy, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- *
   * Loop and lifecycle
   * ---------------------------------------------------------------- */

  function resize() {
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth < 2 || cssHeight < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const since = lastFrame || now;
    const dt = Math.min(0.05, Math.max(0, (now - since) / 1000));
    lastFrame = now;
    if (state.running && !state.paused && !state.over) update(dt);
    else if (state.over) state.clock += dt * 0.25;
    resize();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 2 || height < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawStore(ctx, now / 1000);
  }

  buildRun();
  updateHud(true);
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  }
  resize();
  raf = window.requestAnimationFrame(frame);

  return {
    start() {
      state.running = true;
      state.paused = false;
      state.over = false;
      lastFrame = performance.now();
      burst(state.player.x, state.player.y, team.color, 18, 170);
      ring(state.player.x, state.player.y, team.color, 90);
      audio.sfx('go');
      updateHud(true);
    },
    pause() {
      if (!state.running || state.over) return;
      state.paused = true;
      clearKeys();
      state.joy.active = false;
    },
    resume() {
      if (!state.running || state.over) return;
      state.paused = false;
      lastFrame = performance.now();
    },
    isRunning() {
      return state.running && !state.over;
    },
    resize,
    destroy() {
      window.cancelAnimationFrame(raf);
      abort.abort();
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = null;
    },
    get state() {
      return state;
    },
  };
}
