/**
 * THE GRIN — an Undertale-flavoured bullet-hell boss fight for phones.
 *
 * Four stages, one face. Drag to move the SOUL, survive the patterns, hit the
 * timing bar, and decide whether the thing wearing her smile gets to keep it.
 */

import { createAudio } from './audio.js';
import { BossRenderer, STAGE_MORPHS } from './boss.js';
import { createAttack, STAGE_ATTACKS } from './patterns.js';

const W = 540;
const H = 960;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const audio = createAudio();
const bossRenderer = new BossRenderer();

const canvas = document.getElementById('grin-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const LAYOUT = {
  bossX: W / 2,
  bossY: 230,
  bossR: 128,
  box: { x: 46, y: 420, w: 448, h: 264 },
  hp: { x: 46, y: 56, w: 448, h: 13 },
  buttons: { x: 46, y: 742, w: 448, h: 88, gap: 10 },
};

const STAGE_NAMES = ['THE SMILE YOU KNOW', 'CRACKED OPEN', 'THE THING BEHIND', 'UNHINGED'];
const STAGE_TITLES = ['she is still smiling', 'it hurts to be looked at', 'there is no girl under there', 'SMILE//SMILE//SMILE'];

const BUTTONS = [
  { key: 'fight', label: 'FIGHT' },
  { key: 'act', label: 'ACT' },
  { key: 'item', label: 'ITEM' },
  { key: 'mercy', label: 'MERCY' },
];

const ACTS = [
  { key: 'stare', label: 'STARE' },
  { key: 'remember', label: 'REMEMBER' },
  { key: 'plead', label: 'PLEAD' },
];

const view = { s: 1, ox: 0, oy: 0, dpr: 1 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.max(1, Math.round(rect.width * dpr));
  const targetH = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  view.dpr = dpr;
  view.s = Math.min(rect.width / W, rect.height / H);
  view.ox = (rect.width - W * view.s) / 2;
  view.oy = (rect.height - H * view.s) / 2;
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const player = { hp: 20, maxHp: 20, candy: 3, hits: 0 };
const boss = { hp: 100, maxHp: 100, stage: 0, morph: 0.06, morphTarget: 0.06, flinch: 0, hitFlash: 0 };

let state = 'title';
let stateT = 0;
let worldT = 0;
let lastFrame = performance.now();

let dialog = null;
let aim = null;
let attack = null;
let attackState = null;
let attackTime = 0;

let bullets = [];
let particles = [];
let splats = [];
let soul = { x: LAYOUT.box.x + LAYOUT.box.w / 2, y: LAYOUT.box.y + LAYOUT.box.h / 2, invuln: 0, alive: true };

let shake = 0;
let flash = { color: '#fff', alpha: 0 };
let glitch = 0;
let mercy = 0;
let weakened = false;
let focusNext = false;
let turn = 0;
let patternCursor = 0;
let menuFlavor = '';
let deadT = 0;
let endingT = 0;
let endingKind = 'win';
let runStarted = 0;
let hpDisplay = 100;
let soulTrail = [];
let pointer = { id: null, down: false, ax: 0, ay: 0, x: 0, y: 0, moved: false };
let joystick = { active: false, ax: 0, ay: 0, x: 0, y: 0 };
let bgMotes = [];

function setState(next) {
  state = next;
  stateT = 0;
}

function flashScreen(color, alpha) {
  flash.color = color;
  flash.alpha = Math.max(flash.alpha, alpha);
}

/* ------------------------------------------------------------------ *
 * Script
 * ------------------------------------------------------------------ */

const INTRO_LINES = [
  { who: 'narrator', text: 'The hallway lights have been off for eleven days. You still walk it every night.' },
  { who: 'narrator', text: 'Something at the end of it is smiling with her mouth.' },
  { who: 'boss', text: 'you came back.' },
  { who: 'boss', text: 'i kept the face you liked. i practiced it in the mirror until it fit.' },
  { who: 'boss', text: "let's play like we used to. you move. i reach." },
  { who: 'narrator', text: 'Drag anywhere to move your SOUL. Do not let it break.' },
];

const TRANS_LINES = {
  1: [
    { who: 'boss', text: "you're looking at me like i'm wrong." },
    { who: 'boss', text: "i'm not wrong. i'm just... under the skin now." },
    { who: 'boss', text: 'it hurts. it HURTS. do you like it? does it still look like a smile?' },
  ],
  2: [
    { who: 'boss', text: 'FINE.' },
    { who: 'boss', text: 'FINE! look at what was always underneath her face.' },
    { who: 'boss', text: 'a mouth. a hallway. a hundred little doors that all say her name.' },
    { who: 'narrator', text: 'The box goes cold. It is still your box. It is not sure about that anymore.' },
  ],
  3: [
    { who: 'boss', text: 'the room is my body now. the dark is my blood.' },
    { who: 'boss', text: 'i ate the light. it tasted like her.' },
    { who: 'boss', text: 'SMILE. SMILE. SMILE. SMILE. SMILE.' },
    { who: 'narrator', text: 'There is nothing left in there to spare. Probably. Keep moving.' },
  ],
};

const TAUNTS = [
  ["don't stop moving.", 'smile back.', "isn't this fun?", 'you used to laugh at this face.'],
  ["you're making me crack.", 'look what you did to my face.', 'i can hear her screaming behind my teeth.', 'hold still. i want to see it.'],
  ['every smile is a door.', 'i am the hallway.', "you can't win. you can only be interesting.", 'there are more of me than there is of you.'],
  ['NO MORE PLAYING.', 'LOOK AT ME. LOOK AT ME.', 'I WILL WEAR YOU NEXT.', 'THERE IS NO ROOM LEFT IN THIS HOUSE.'],
];

const PAIN = [
  ['that was rude.', 'you hit her. you hit HER.', 'ow. ow. i can still feel that.'],
  ['the crack got bigger.', 'keep doing that and i will stop being polite.', 'it is coming apart. i can hear it.'],
  ['you are hurting the walls.', 'the hallway is bleeding. that is your fault.', 'i felt that in every door.'],
  ['THAT TICKLES.', 'YOU ARE MAKING ME UGLY.', 'KEEP GOING. I DARE YOU.'],
];

const FLAVOR = [
  ['* The thing wearing her face waits for you to move.', '* It is smiling so hard its eyes are watering.', '* Somewhere behind it, a girl is breathing.'],
  ['* The smile is stuck to the wrong bones now.', '* It keeps setting its jaw back into place.', '* The eyes are the wrong size for the face.'],
  ['* The box is breathing with it.', '* Every shadow in the room is facing you.', '* Something in the wall says your name in her voice.'],
  ['* The room has stopped pretending to be a room.', '* It is not smiling anymore. It is showing you its teeth.', '* You are standing in its mouth.'],
];

const ENDING_WIN = {
  title: 'THE GRIN IS DEAD',
  sub: '// the hallway is quiet //',
  lines: [
    'The smile tears down the middle and keeps going, past the face, past the wall.',
    'There is no blood in it. Only moths, and a small cold hand, and a voice saying thank you.',
    'The lights in the hallway come on. One by one. They are all you.',
  ],
};

const ENDING_SPARE = {
  title: 'SHE IS STILL IN THERE',
  sub: '// you put your hands down //',
  lines: [
    'The thing inside the face has nowhere left to go, so it goes quiet.',
    'The cracks close like a sentence ending. The teeth go back behind her lips.',
    'She says your name. Once. It is her.',
  ],
};

/* ------------------------------------------------------------------ *
 * Dialogue
 * ------------------------------------------------------------------ */

function say(lines, onDone, options = {}) {
  dialog = {
    lines: lines.map((line) => (typeof line === 'string' ? { who: 'narrator', text: line } : line)),
    index: 0,
    chars: 0,
    onDone,
    speed: options.speed || 46,
    blipAt: 0,
  };
  setState('talk');
}

function advanceDialog() {
  if (!dialog) return;
  const line = dialog.lines[dialog.index];
  if (!line) return;

  if (dialog.chars < line.text.length) {
    dialog.chars = line.text.length;
    return;
  }

  dialog.index += 1;
  dialog.chars = 0;
  if (dialog.index >= dialog.lines.length) {
    const done = dialog.onDone;
    dialog = null;
    if (done) done();
    return;
  }
  audio.blip(dialog.lines[dialog.index].who === 'boss' ? 200 : 520, 0.025);
}

/* ------------------------------------------------------------------ *
 * Flow
 * ------------------------------------------------------------------ */

function begin() {
  audio.unlock();
  audio.setIntensity(1);
  audio.startMusic();
  resetRun();
  runStarted = performance.now();
  say(INTRO_LINES, startMenu);
}

function resetRun() {
  player.hp = player.maxHp;
  player.candy = 3;
  player.hits = 0;
  boss.hp = boss.maxHp;
  boss.stage = 0;
  boss.morph = STAGE_MORPHS[0];
  boss.morphTarget = STAGE_MORPHS[0];
  boss.flinch = 0;
  boss.hitFlash = 0;
  hpDisplay = boss.maxHp;
  mercy = 0;
  weakened = false;
  focusNext = false;
  turn = 0;
  patternCursor = 0;
  bullets = [];
  particles = [];
  splats = [];
  soul.x = LAYOUT.box.x + LAYOUT.box.w / 2;
  soul.y = LAYOUT.box.y + LAYOUT.box.h / 2;
  soul.invuln = 0;
  soul.alive = true;
  soulTrail = [];
  glitch = 0;
  shake = 0;
}

function startMenu() {
  setState('menu');
  bullets = [];
  splats = [];
  attack = null;
  aim = null;
  weakened = false;
  soul.alive = true;
  soul.invuln = 0;
  soul.x = LAYOUT.box.x + LAYOUT.box.w / 2;
  soul.y = LAYOUT.box.y + LAYOUT.box.h / 2;
  menuFlavor = pick(FLAVOR[boss.stage]);
}

function activate(key) {
  if (state !== 'menu') return;
  audio.menuSelect();
  if (key === 'fight') {
    aim = { pos: 0.5, dir: 1 };
    setState('aim');
  } else if (key === 'act') {
    setState('act');
  } else if (key === 'item') {
    useItem();
  } else if (key === 'mercy') {
    tryMercy();
  }
}

function resolveAim() {
  if (!aim) return;
  const accuracy = 1 - Math.abs(aim.pos - 0.5) * 2;
  const perfect = accuracy > 0.92;
  let damage = Math.round(3 + Math.pow(accuracy, 1.4) * 9);
  if (perfect) damage += 7;
  aim = null;
  focusNext = false;
  applyDamage(damage, perfect, accuracy);
}

function applyDamage(damage, perfect, accuracy) {
  boss.hp = Math.max(0, boss.hp - damage);
  boss.flinch = 0.55;
  boss.hitFlash = 1;
  shake = Math.max(shake, perfect ? 26 : 14);
  flashScreen(perfect ? '#fff2f4' : '#ff3b5c', perfect ? 0.55 : 0.24);
  audio.slash();
  if (perfect) {
    audio.crit();
    glitch = Math.max(glitch, 0.7);
  }

  particles.push({
    type: 'text',
    x: LAYOUT.bossX + rand(-30, 30),
    y: LAYOUT.bossY - 20,
    vy: -56,
    life: 1.1,
    maxLife: 1.1,
    text: perfect ? `PERFECT  ${damage}` : `${damage}`,
    color: perfect ? '#fff4b8' : '#ffd4dc',
    size: perfect ? 30 : 24,
  });

  for (let i = 0; i < (perfect ? 26 : 14); i += 1) {
    const angle = rand(0, TAU);
    const speed = rand(70, perfect ? 360 : 240);
    particles.push({
      type: 'spark',
      x: LAYOUT.bossX + rand(-20, 20),
      y: LAYOUT.bossY + rand(-10, 30),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(1.5, 4),
      life: rand(0.4, 0.9),
      maxLife: 0.9,
      color: pick(['#ff3355', '#ff7a8c', '#ffe6ea']),
    });
  }

  if (boss.hp <= 0) {
    startEnding('win');
    return;
  }

  const next = stageForHp();
  if (next > boss.stage) {
    stageBreak(next);
    return;
  }

  const line = accuracy > 0.55 ? pick(PAIN[boss.stage]) : pick(['you missed the point.', 'she used to flinch like that.', 'is that all?']);
  say([{ who: 'boss', text: line }], beginBossTurn);
}

function stageForHp() {
  const ratio = boss.hp / boss.maxHp;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 1;
  return 0;
}

function stageBreak(next) {
  boss.stage = next;
  boss.morphTarget = STAGE_MORPHS[next];
  boss.flinch = 0;
  bullets = [];
  splats = [];
  shake = 34;
  flashScreen('#ffffff', 0.85);
  glitch = 1.4;
  audio.bossScream();
  audio.setIntensity(next + 1);
  say(TRANS_LINES[next], startMenu);
}

function beginBossTurn() {
  if (boss.hp <= 0) return;
  turn += 1;
  say([{ who: 'boss', text: pick(TAUNTS[boss.stage]) }], startAttack);
}

function startAttack() {
  const list = STAGE_ATTACKS[boss.stage];
  const key = list[patternCursor % list.length];
  patternCursor += 1;

  const difficulty = 1 + boss.stage * 0.5 + turn * 0.035;
  attack = createAttack(key, { difficulty, weakened });
  weakened = false;
  attackTime = 0;
  attackState = { t: 0, api: null };

  bullets = [];
  splats = [];
  soul.alive = true;
  soul.x = LAYOUT.box.x + LAYOUT.box.w / 2;
  soul.y = LAYOUT.box.y + LAYOUT.box.h / 2;
  soul.invuln = 0.6;
  soulTrail = [];
  joystick.active = false;
  setState('attack');
  audio.uiOpen();
}

function endAttack() {
  if (state !== 'attack') return;
  bullets = [];
  splats = [];
  attack = null;
  attackState = null;
  startMenu();
}

function useItem() {
  if (player.candy <= 0) {
    audio.menuDeny();
    say([{ who: 'narrator', text: 'Your pockets have lint and a hair tie in them. Nothing else.' }], startMenu);
    return;
  }
  player.candy -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 8);
  audio.heal();
  say([{ who: 'narrator', text: 'You eat a hard candy from your coat. It tastes like her birthday. (+8 HP)' }], beginBossTurn);
}

function tryMercy() {
  if (mercy >= 3 && boss.hp <= 30) {
    startEnding('spare');
    return;
  }
  audio.menuDeny();
  const line =
    boss.stage >= 2
      ? 'You reach for MERCY. The smile opens wider, and something inside it laughs with her voice.'
      : 'You reach for MERCY. It is not finished being looked at.';
  say([{ who: 'narrator', text: line }], beginBossTurn);
}

function useAct(which) {
  audio.menuSelect();
  if (which === 'stare') {
    focusNext = true;
    say(
      [
        {
          who: 'narrator',
          text: 'You look at it for a long time. The eyes are the wrong size for the face. It flinches, and one of the lights above you dies.',
        },
        { who: 'narrator', text: 'You think you know where the next one will come from. FIGHT will be slower now.' },
      ],
      beginBossTurn
    );
    return;
  }

  if (which === 'remember') {
    mercy = Math.min(3, mercy + 1);
    audio.heartbeat();
    say(
      [
        {
          who: 'narrator',
          text: 'You say her name. The grin stutters — for half a second it is only a mouth, and then it is a grin again.',
        },
        {
          who: 'narrator',
          text: mercy >= 3 ? 'Something under the face has stopped pushing. MERCY might reach now, if you weaken it enough.' : 'It heard you. It is trying not to.',
        },
      ],
      beginBossTurn
    );
    return;
  }

  weakened = true;
  say(
    [
      {
        who: 'narrator',
        text: 'You ask it — her — to stop. Something in the throat says "i can\'t" before the mouth says "i won\'t".',
      },
      { who: 'narrator', text: 'The next attack comes slower. It is trying. That is worse.' },
    ],
    beginBossTurn
  );
}

function hurtPlayer(amount) {
  if (state !== 'attack' || soul.invuln > 0 || !soul.alive) return;
  player.hp = Math.max(0, player.hp - amount);
  player.hits += 1;
  soul.invuln = 1.15;
  shake = Math.max(shake, 18);
  flashScreen('#ff0022', 0.4);
  audio.hurt();
  const vx = soul.x;
  const vy = soul.y;
  splats.push({ x: vx, y: vy, r: rand(14, 30), life: 6, maxLife: 6, seed: Math.random() * 1000 });
  for (let i = 0; i < 18; i += 1) {
    const angle = rand(0, TAU);
    const speed = rand(40, 230);
    particles.push({
      type: 'blood',
      x: vx,
      y: vy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(2, 5.5),
      life: rand(0.5, 1.4),
      maxLife: 1.4,
      color: pick(['#ff1538', '#c40024', '#7a0016']),
    });
  }
  if (player.hp <= 0) die();
}

function die() {
  setState('dead');
  deadT = 0;
  soul.alive = false;
  bullets = [];
  audio.stopMusic();
  audio.shatter();
  shake = 36;
  flashScreen('#ff0022', 1);
  glitch = 1.2;
  for (let i = 0; i < 32; i += 1) {
    const angle = rand(0, TAU);
    const speed = rand(60, 340);
    particles.push({
      type: 'shard',
      x: soul.x,
      y: soul.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      r: rand(3, 8),
      rot: rand(0, TAU),
      spin: rand(-8, 8),
      life: rand(1.2, 2.6),
      maxLife: 2.6,
      color: pick(['#ff2040', '#ff5a76', '#ffd9e0']),
    });
  }
}

function retryStage() {
  player.hp = player.maxHp;
  boss.hp = [100, 75, 50, 25][boss.stage];
  hpDisplay = boss.hp;
  boss.morph = STAGE_MORPHS[boss.stage];
  boss.morphTarget = STAGE_MORPHS[boss.stage];
  mercy = 0;
  weakened = false;
  focusNext = false;
  bullets = [];
  particles = [];
  splats = [];
  soul.alive = true;
  audio.setIntensity(boss.stage + 1);
  audio.startMusic();
  say([{ who: 'narrator', text: 'You are still here. That is the whole trick.' }], startMenu);
}

function startEnding(kind) {
  endingKind = kind;
  endingT = 0;
  setState(kind === 'win' ? 'win' : 'spare');
  bullets = [];
  audio.stopMusic();
  glitch = 1.8;
  if (kind === 'win') {
    audio.shatter();
    audio.victory();
    shake = 40;
    flashScreen('#ffffff', 1);
    for (let i = 0; i < 70; i += 1) {
      const angle = rand(0, TAU);
      const speed = rand(30, 420);
      particles.push({
        type: 'shard',
        x: LAYOUT.bossX + rand(-40, 40),
        y: LAYOUT.bossY + rand(-40, 40),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rand(2, 10),
        rot: rand(0, TAU),
        spin: rand(-10, 10),
        life: rand(1, 3),
        maxLife: 3,
        color: pick(['#ff2244', '#ff8898', '#f6e9ee', '#2a0a14']),
      });
    }
  } else {
    audio.spareTone();
    flashScreen('#ffe0e8', 0.5);
  }
}

function backToTitle() {
  setState('title');
  bullets = [];
  particles = [];
  splats = [];
  dialog = null;
  audio.stopMusic();
  boss.hp = boss.maxHp;
  boss.stage = 0;
  boss.morph = STAGE_MORPHS[0];
  boss.morphTarget = STAGE_MORPHS[0];
}

/* ------------------------------------------------------------------ *
 * Simulation
 * ------------------------------------------------------------------ */

const keys = new Set();

function initMotes() {
  bgMotes = Array.from({ length: 36 }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    r: rand(0.8, 2.6),
    speed: rand(5, 26),
    drift: rand(-10, 10),
    alpha: rand(0.08, 0.4),
  }));
}
initMotes();

function makeAttackApi() {
  return {
    t: 0,
    dt: 0,
    box: LAYOUT.box,
    soul,
    difficulty: 1,
    spawn: spawnBullet,
    fx: {
      shake: (amount) => {
        shake = Math.max(shake, amount);
      },
      flash: (color, alpha) => flashScreen(color, alpha),
      splat: (x, y) => splats.push({ x, y, r: rand(12, 26), life: 5, maxLife: 5, seed: Math.random() * 1000 }),
    },
    audio,
  };
}

function spawnBullet(spec) {
  if (bullets.length > 320) return null;
  const bullet = {
    type: 'orb',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 8,
    rot: 0,
    spin: 0,
    color: '#ff4060',
    glow: '255,64,96',
    dmg: 2,
    life: 6,
    t: 0,
    ...spec,
  };
  if (bullet.type === 'laser') {
    bullet.life = (bullet.warn || 0.9) + (bullet.fire || 0.5) + 0.4;
  }
  bullets.push(bullet);
  return bullet;
}

function hitTest(bullet, box) {
  const soulRadius = 6;
  if (bullet.type === 'laser') {
    if (bullet.t < bullet.warn || bullet.t > bullet.warn + bullet.fire) return false;
    const cos = Math.cos(bullet.angle);
    const sin = Math.sin(bullet.angle);
    const dx = soul.x - bullet.x;
    const dy = soul.y - bullet.y;
    const along = dx * cos + dy * sin;
    const perp = -dx * sin + dy * cos;
    return along > -8 && along < bullet.len + 8 && Math.abs(perp) < bullet.w / 2 + soulRadius;
  }

  if (bullet.type === 'bone') {
    return (
      Math.abs(soul.x - bullet.x) < bullet.w / 2 + soulRadius &&
      Math.abs(soul.y - bullet.y) < bullet.h / 2 + soulRadius
    );
  }

  const radius = (bullet.r || 8) + soulRadius;
  return Math.hypot(soul.x - bullet.x, soul.y - bullet.y) < radius;
}

function updateBullets(dt) {
  const box = LAYOUT.box;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.t += dt;
    bullet.life -= dt;
    bullet.rot = (bullet.rot || 0) + (bullet.spin || 0) * dt;

    if (bullet.type === 'laser') {
      if (!bullet.fired && bullet.t >= bullet.warn) {
        bullet.fired = true;
        if (bullet.beam) audio.beamFire();
        else audio.laserFire();
        shake = Math.max(shake, bullet.beam ? 14 : 8);
        if (bullet.beam) flashScreen('#ff1636', 0.2);
      }
    } else {
      if (bullet.homing) {
        const dx = soul.x - bullet.x;
        const dy = soul.y - bullet.y;
        const length = Math.hypot(dx, dy) || 1;
        bullet.vx += (dx / length) * bullet.homing * dt;
        bullet.vy += (dy / length) * bullet.homing * dt;
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const maxSpeed = bullet.maxSpeed || 300;
        if (speed > maxSpeed) {
          bullet.vx = (bullet.vx / speed) * maxSpeed;
          bullet.vy = (bullet.vy / speed) * maxSpeed;
        }
      }
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    }

    const margin = 36;
    const outside =
      bullet.type !== 'laser' &&
      (bullet.x < box.x - margin ||
        bullet.x > box.x + box.w + margin ||
        bullet.y < box.y - margin ||
        bullet.y > box.y + box.h + margin);

    if (outside || bullet.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    if (state === 'attack' && soul.alive && hitTest(bullet, box)) {
      hurtPlayer(bullet.dmg || 2);
    }
  }
}

function updateSoulMovement(dt) {
  const box = LAYOUT.box;
  const pad = 12;
  let dx = 0;
  let dy = 0;

  if (joystick.active) {
    dx = joystick.x - joystick.ax;
    dy = joystick.y - joystick.ay;
  } else if (keys.size) {
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) dy += 1;
    if (dx || dy) {
      dx *= 60;
      dy *= 60;
    }
  }

  const length = Math.hypot(dx, dy);
  if (length > 7) {
    const magnitude = Math.min(1, (length - 7) / 52);
    const speed = 330 * magnitude;
    soul.x += (dx / length) * speed * dt;
    soul.y += (dy / length) * speed * dt;
  }

  soul.x = clamp(soul.x, box.x + pad, box.x + box.w - pad);
  soul.y = clamp(soul.y, box.y + pad, box.y + box.h - pad);

  soulTrail.push({ x: soul.x, y: soul.y });
  if (soulTrail.length > 7) soulTrail.shift();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.type === 'text') {
      p.y += p.vy * dt;
      p.vy *= 0.96;
    } else if (p.type === 'shard' || p.type === 'blood' || p.type === 'spark') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type !== 'spark') p.vy += 520 * dt;
      p.vx *= 0.995;
      if (p.spin) p.rot += p.spin * dt;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = splats.length - 1; i >= 0; i -= 1) {
    splats[i].life -= dt;
    if (splats[i].life <= 0) splats.splice(i, 1);
  }
}

function updateAttack(dt) {
  attackTime += dt;
  updateSoulMovement(dt);

  if (attack && attackTime > 0.85) {
    if (!attackState.api) {
      attackState.api = makeAttackApi();
      attackState.api.difficulty = 1 + boss.stage * 0.5 + turn * 0.035;
    }
    attackState.t += dt;
    attackState.api.t = attackState.t;
    attackState.api.dt = dt;
    attack.update(attackState.api);
  }

  updateBullets(dt);

  if (attack && attackTime > attack.duration + 0.85) endAttack();
}

function update(dt) {
  worldT += dt;
  stateT += dt;

  boss.morph += (boss.morphTarget - boss.morph) * Math.min(1, dt * (state === 'talk' ? 1.1 : 2.4));
  boss.flinch = Math.max(0, boss.flinch - dt * 2.4);
  boss.hitFlash = Math.max(0, boss.hitFlash - dt * 3.4);
  hpDisplay += (boss.hp - hpDisplay) * Math.min(1, dt * 5);

  shake *= Math.exp(-dt * 7.5);
  if (shake < 0.06) shake = 0;
  flash.alpha = Math.max(0, flash.alpha - dt * 2.6);
  glitch = Math.max(0, glitch - dt * 1.2);
  if (soul.invuln > 0) soul.invuln = Math.max(0, soul.invuln - dt);

  if (dialog) {
    const line = dialog.lines[dialog.index];
    if (line && dialog.chars < line.text.length) {
      dialog.chars = Math.min(line.text.length, dialog.chars + dt * dialog.speed);
      dialog.blipAt -= dt;
      if (dialog.blipAt <= 0) {
        dialog.blipAt = 0.06;
        if (line.who === 'boss') audio.bossBlip(rand(140, 205));
        else if (line.who === 'you') audio.blip(rand(600, 680), 0.02);
        else audio.blip(rand(470, 560), 0.016);
      }
    }
  }

  for (const mote of bgMotes) {
    mote.y -= mote.speed * dt;
    mote.x += mote.drift * dt;
    if (mote.y < -10) {
      mote.y = H + 10;
      mote.x = rand(0, W);
    }
    if (mote.x < -10) mote.x = W + 10;
    if (mote.x > W + 10) mote.x = -10;
  }

  if (state === 'aim' && aim) {
    const speed = focusNext ? 0.5 : 0.92;
    aim.pos += aim.dir * speed * dt;
    if (aim.pos >= 1) {
      aim.pos = 1;
      aim.dir = -1;
    } else if (aim.pos <= 0) {
      aim.pos = 0;
      aim.dir = 1;
    }
  }

  if (state === 'attack') updateAttack(dt);
  if (state === 'dead') deadT += dt;
  if (state === 'win' || state === 'spare') endingT += dt;

  updateParticles(dt);
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

const glowCache = new Map();

function glowSprite(rgb) {
  let sprite = glowCache.get(rgb);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const c = sprite.getContext('2d');
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${rgb},0.95)`);
  gradient.addColorStop(0.35, `rgba(${rgb},0.45)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  glowCache.set(rgb, sprite);
  return sprite;
}

function rr(c, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawWrapped(text, x, y, maxWidth, font, color, lineHeight, shadowColor) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 12;
  }
  const words = text.split(' ');
  let line = '';
  let cursor = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cursor);
  ctx.restore();
}

function buttonRects() {
  const { x, y, w, gap, h } = LAYOUT.buttons;
  const width = (w - gap * 3) / 4;
  return BUTTONS.map((button, index) => ({
    ...button,
    x: x + index * (width + gap),
    y,
    w: width,
    h,
  }));
}

function deadButtons() {
  return [
    { key: 'continue', label: 'CONTINUE', x: W / 2 - 152, y: 566, w: 304, h: 64 },
    { key: 'quit', label: 'GIVE UP', x: W / 2 - 152, y: 646, w: 304, h: 52 },
  ];
}

function endingButtons() {
  return [{ key: 'again', label: 'FACE IT AGAIN', x: W / 2 - 152, y: 806, w: 304, h: 62 }];
}

function inside(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

function drawBackground() {
  const stage = boss.stage;
  const gradient = ctx.createRadialGradient(W / 2, 250, 30, W / 2, 420, 820);
  if (stage === 0) {
    gradient.addColorStop(0, '#1b1220');
    gradient.addColorStop(0.5, '#0b0710');
    gradient.addColorStop(1, '#040207');
  } else if (stage === 1) {
    gradient.addColorStop(0, '#200810');
    gradient.addColorStop(0.5, '#0c040a');
    gradient.addColorStop(1, '#030104');
  } else if (stage === 2) {
    gradient.addColorStop(0, '#2b040c');
    gradient.addColorStop(0.55, '#100207');
    gradient.addColorStop(1, '#020002');
  } else {
    gradient.addColorStop(0, '#3a0008');
    gradient.addColorStop(0.5, '#140005');
    gradient.addColorStop(1, '#000000');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  for (const mote of bgMotes) {
    ctx.fillStyle = `rgba(255,${90 - stage * 12},${120 - stage * 10},${mote.alpha * (0.35 + stage * 0.22)})`;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (stage >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.07 + 0.03 * Math.sin(worldT * 1.7);
    ctx.fillStyle = '#ff0030';
    for (let i = 0; i < 5; i += 1) {
      const x = ((i * 137 + worldT * 9) % (W + 160)) - 80;
      ctx.fillRect(x, 0, 46, H);
    }
    ctx.restore();
  }
}

function drawBoss() {
  const titleDim = state === 'title';
  const gone = state === 'win' || state === 'spare';
  if (gone) return;

  bossRenderer.draw(ctx, {
    x: LAYOUT.bossX + (boss.stage >= 2 ? Math.sin(worldT * 13) * 1.6 : 0),
    y: LAYOUT.bossY - boss.flinch * 12,
    r: LAYOUT.bossR,
    morph: boss.morph,
    time: worldT,
    stage: boss.stage,
    flash: boss.hitFlash,
  });

  if (titleDim) {
    ctx.fillStyle = 'rgba(4,2,8,0.35)';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBoxFrame() {
  const box = LAYOUT.box;
  ctx.save();
  ctx.fillStyle = 'rgba(5,2,8,0.88)';
  rr(ctx, box.x, box.y, box.w, box.h, 4);
  ctx.fill();

  ctx.strokeStyle = boss.stage >= 2 ? '#ffdbe0' : '#f0e9f2';
  ctx.lineWidth = 4;
  rr(ctx, box.x, box.y, box.w, box.h, 4);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,60,90,${0.1 + boss.stage * 0.06})`;
  ctx.lineWidth = 1.4;
  rr(ctx, box.x + 6, box.y + 6, box.w - 12, box.h - 12, 2);
  ctx.stroke();
  ctx.restore();
}

function drawDialog() {
  if (!dialog) return;
  const line = dialog.lines[dialog.index];
  if (!line) return;
  const box = LAYOUT.box;
  const shown = `${line.text.slice(0, Math.floor(dialog.chars))}`;
  const isBoss = line.who === 'boss';
  const font = isBoss ? 'italic 21px Georgia, "Times New Roman", serif' : '18px "Courier New", monospace';
  const color = isBoss ? '#f8e9ee' : line.who === 'you' ? '#ffe9b0' : '#cfc3da';
  drawWrapped(`* ${shown}`, box.x + 24, box.y + 30, box.w - 48, font, color, isBoss ? 27 : 26, isBoss ? 'rgba(255,20,50,0.45)' : null);

  if (dialog.chars >= line.text.length) {
    const bob = Math.sin(worldT * 6) * 2;
    ctx.fillStyle = 'rgba(255,230,190,0.85)';
    ctx.beginPath();
    ctx.moveTo(box.x + box.w - 32, box.y + box.h - 26 + bob);
    ctx.lineTo(box.x + box.w - 20, box.y + box.h - 26 + bob);
    ctx.lineTo(box.x + box.w - 26, box.y + box.h - 17 + bob);
    ctx.closePath();
    ctx.fill();
  }

  if (dialog.lines.length > 1) {
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${dialog.index + 1}/${dialog.lines.length}`, box.x + box.w - 20, box.y + 10);
  }
}

function drawMenuBox() {
  const box = LAYOUT.box;
  drawWrapped(menuFlavor, box.x + 24, box.y + 34, box.w - 48, '18px "Courier New", monospace', '#d8ccdf', 28);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = `rgba(255,130,150,${0.35 + 0.12 * Math.sin(worldT * 2)})`;
  ctx.fillText(STAGE_TITLES[boss.stage], box.x + box.w / 2, box.y + box.h - 32);
}

function drawAim() {
  const box = LAYOUT.box;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 17px "Courier New", monospace';
  ctx.fillStyle = '#ffe6a6';
  ctx.fillText('TAP TO STRIKE', box.x + box.w / 2, box.y + 64);

  const barX = box.x + 54;
  const barW = box.w - 108;
  const barY = box.y + box.h / 2 + 6;
  const barH = 30;

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  rr(ctx, barX, barY - barH / 2, barW, barH, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(90,255,140,0.16)';
  ctx.fillRect(barX + barW * 0.44, barY - barH / 2 - 4, barW * 0.12, barH + 8);
  ctx.fillStyle = 'rgba(90,255,140,0.4)';
  ctx.fillRect(barX + barW * 0.495, barY - barH / 2 - 6, barW * 0.01, barH + 12);

  ctx.strokeStyle = 'rgba(240,230,245,0.6)';
  ctx.lineWidth = 2;
  rr(ctx, barX, barY - barH / 2, barW, barH, 4);
  ctx.stroke();

  const cursorX = barX + aim.pos * barW;
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cursorX - 3, barY - barH / 2 - 8, 6, barH + 16);
  ctx.restore();

  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,220,180,0.55)';
  ctx.fillText(focusNext ? 'you know where it will flinch' : 'stop it in the middle', box.x + box.w / 2, box.y + box.h / 2 + 64);
  ctx.restore();
}

function drawActMenu() {
  const box = LAYOUT.box;
  const rects = actRects();
  ctx.save();
  rects.forEach((rect, index) => {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    ctx.strokeStyle = index === 1 && mercy >= 1 ? 'rgba(255,220,120,0.6)' : 'rgba(255,160,90,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 20px "Courier New", monospace';
    ctx.fillStyle = '#ffc266';
    ctx.fillText(ACTS[index].label, rect.x + 20, rect.y + rect.h / 2 - 8);

    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(220,200,230,0.6)';
    const hint =
      index === 0
        ? 'slow the next strike'
        : index === 1
          ? `mercy ${mercy}/3  ·  say her name`
          : 'weaken the next attack';
    ctx.fillText(hint, rect.x + 20, rect.y + rect.h / 2 + 13);
  });
  ctx.restore();
}

function actRects() {
  const box = LAYOUT.box;
  return ACTS.map((act, index) => ({
    ...act,
    x: box.x + 34,
    y: box.y + 26 + index * 70,
    w: box.w - 68,
    h: 60,
  }));
}

function drawAttack() {
  const box = LAYOUT.box;
  if (attackTime < 0.85) {
    const alpha = attackTime < 0.55 ? 1 : 1 - (attackTime - 0.55) / 0.3;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 32px "Courier New", monospace';
    ctx.fillStyle = '#ffd9df';
    ctx.shadowColor = 'rgba(255,20,50,0.9)';
    ctx.shadowBlur = 18;
    ctx.fillText(attack ? attack.name : '', box.x + box.w / 2, box.y + box.h / 2);
    ctx.restore();
  } else {
    /* Bullets belong to the box: never let them crawl over the HUD. */
    ctx.save();
    rr(ctx, box.x + 2, box.y + 2, box.w - 4, box.h - 4, 2);
    ctx.clip();
    drawBullets();
    ctx.restore();
    drawSoul();
  }

  if (joystick.active) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    const dx = clamp(joystick.x - joystick.ax, -46, 46);
    const dy = clamp(joystick.y - joystick.ay, -46, 46);
    ctx.beginPath();
    ctx.arc(joystick.ax, joystick.ay, 46, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,120,0.28)';
    ctx.beginPath();
    ctx.arc(joystick.ax + dx, joystick.ay + dy, 17, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawOrb(bullet) {
  const sprite = glowSprite(bullet.glow || '255,64,96');
  ctx.globalAlpha = 0.85;
  ctx.drawImage(sprite, bullet.x - bullet.r * 2.8, bullet.y - bullet.r * 2.8, bullet.r * 5.6, bullet.r * 5.6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, bullet.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,245,248,0.92)';
  ctx.beginPath();
  ctx.arc(bullet.x - bullet.r * 0.18, bullet.y - bullet.r * 0.18, bullet.r * 0.42, 0, TAU);
  ctx.fill();
}

function drawBone(bullet) {
  const { x, y, w, h } = bullet;
  ctx.save();
  ctx.fillStyle = '#f8f2ff';
  ctx.strokeStyle = 'rgba(120,96,150,0.9)';
  ctx.lineWidth = 2;
  rr(ctx, x - w / 2, y - h / 2, w, h, w / 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - h / 2 + 1, w * 0.72, 0, TAU);
  ctx.arc(x, y + h / 2 - 1, w * 0.72, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawShard(bullet) {
  const sprite = glowSprite(bullet.glow || '255,56,90');
  ctx.globalAlpha = 0.7;
  ctx.drawImage(sprite, bullet.x - bullet.r * 2.4, bullet.y - bullet.r * 2.4, bullet.r * 4.8, bullet.r * 4.8);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.rot);
  ctx.fillStyle = '#ffd9e1';
  ctx.beginPath();
  ctx.moveTo(0, -bullet.r);
  ctx.lineTo(bullet.r * 0.82, bullet.r * 0.66);
  ctx.lineTo(-bullet.r * 0.9, bullet.r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,40,70,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawLaser(bullet) {
  const pxPerUnit = 1;
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.angle);

  if (bullet.t < bullet.warn) {
    ctx.globalAlpha = 0.28 + 0.22 * Math.sin(bullet.t * 34);
    ctx.fillStyle = bullet.color;
    ctx.fillRect(0, -bullet.w / 2, bullet.len, bullet.w);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(0, -bullet.w / 2);
    ctx.lineTo(bullet.len, -bullet.w / 2);
    ctx.moveTo(0, bullet.w / 2);
    ctx.lineTo(bullet.len, bullet.w / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const grow = Math.min(1, (bullet.t - bullet.warn) / 0.1);
    const width = bullet.w * grow;
    const glow = glowSprite(bullet.glow || '255,50,80');

    ctx.globalAlpha = 0.9;
    ctx.drawImage(glow, 0, -width * 0.9, bullet.len, width * 1.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = bullet.color;
    ctx.fillRect(0, -width / 2, bullet.len, width);
    ctx.fillStyle = '#fff6f8';
    ctx.fillRect(0, -width * 0.18, bullet.len, width * 0.36);

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i += 1) {
      const jitter = Math.sin(worldT * 41 + i * 2.7) * width * 0.28;
      ctx.fillRect(pxPerUnit * (i * 37 + (worldT * 260) % 37), jitter - 1.2, 22, 2.4);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBullets() {
  for (const bullet of bullets) {
    if (bullet.type === 'laser') drawLaser(bullet);
    else if (bullet.type === 'bone') drawBone(bullet);
    else if (bullet.type === 'shard') drawShard(bullet);
    else drawOrb(bullet);
  }
}

function heartPath(c, x, y, size) {
  c.beginPath();
  c.moveTo(x, y + size * 0.82);
  c.bezierCurveTo(x - size * 1.5, y - size * 0.16, x - size * 0.75, y - size * 1.28, x, y - size * 0.48);
  c.bezierCurveTo(x + size * 0.75, y - size * 1.28, x + size * 1.5, y - size * 0.16, x, y + size * 0.82);
  c.closePath();
}

function drawSoul() {
  if (!soul.alive) return;
  const blink = soul.invuln > 0 && Math.floor(worldT * 18) % 2 === 0;

  ctx.save();
  for (let i = 0; i < soulTrail.length; i += 1) {
    const point = soulTrail[i];
    const alpha = (i / soulTrail.length) * 0.16;
    ctx.fillStyle = `rgba(255,60,90,${alpha})`;
    heartPath(ctx, point.x, point.y, 10);
    ctx.fill();
  }

  const sprite = glowSprite('255,60,90');
  ctx.globalAlpha = 0.85;
  ctx.drawImage(sprite, soul.x - 32, soul.y - 32, 64, 64);
  ctx.globalAlpha = 1;

  ctx.fillStyle = blink ? 'rgba(255,90,120,0.35)' : '#ff2f52';
  heartPath(ctx, soul.x, soul.y, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,228,0.95)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function drawUi() {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  ctx.font = 'italic 700 23px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#f2e4ea';
  ctx.shadowColor = 'rgba(255,20,50,0.55)';
  ctx.shadowBlur = 14;
  ctx.fillText('THE GRIN', W / 2, 12);
  ctx.shadowBlur = 0;

  ctx.font = '10px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,166,184,0.7)';
  ctx.fillText(STAGE_NAMES[boss.stage], W / 2, 39);

  const hp = LAYOUT.hp;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  rr(ctx, hp.x, hp.y + 2, hp.w, hp.h, 3);
  ctx.fill();

  const ratio = clamp(hpDisplay / boss.maxHp, 0, 1);
  const hpGradient = ctx.createLinearGradient(hp.x, 0, hp.x + hp.w, 0);
  hpGradient.addColorStop(0, boss.stage >= 3 ? '#ff3355' : '#57e07a');
  hpGradient.addColorStop(1, boss.stage >= 3 ? '#ff9aac' : '#a6f7b6');
  ctx.fillStyle = hpGradient;
  rr(ctx, hp.x, hp.y + 2, Math.max(3, hp.w * ratio), hp.h, 3);
  ctx.fill();

  ctx.strokeStyle = 'rgba(235,225,245,0.45)';
  ctx.lineWidth = 1.4;
  rr(ctx, hp.x, hp.y + 2, hp.w, hp.h, 3);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(10,4,12,0.7)';
  ctx.lineWidth = 1;
  for (const mark of [0.25, 0.5, 0.75]) {
    const x = hp.x + hp.w * (1 - mark);
    ctx.beginPath();
    ctx.moveTo(x, hp.y + 3);
    ctx.lineTo(x, hp.y + hp.h + 1);
    ctx.stroke();
  }

  /* Player HP, bottom-left of the box. */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 16px "Courier New", monospace';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('HP', 58, 706);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, 90, 698, 116, 16, 3);
  ctx.fill();
  ctx.fillStyle = player.hp / player.maxHp <= 0.34 ? '#ff4d6b' : '#ffd93d';
  rr(ctx, 90, 698, Math.max(2, 116 * (player.hp / player.maxHp)), 16, 3);
  ctx.fill();
  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,235,190,0.8)';
  ctx.fillText(`${player.hp} / ${player.maxHp}`, 214, 707);

  ctx.textAlign = 'right';
  ctx.font = '700 14px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,200,150,0.8)';
  ctx.fillText(`CANDY x${player.candy}`, 486, 707);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,150,170,0.6)';
  ctx.fillText(`MERCY ${mercy}/3`, 486, 726);

  drawButtons(state === 'menu');
  ctx.restore();
}

function drawButtons(active) {
  const rects = buttonRects();
  const spareReady = mercy >= 3 && boss.hp <= 30;

  for (const button of rects) {
    const glow = button.key === 'mercy' && spareReady;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.32;
    ctx.fillStyle = 'rgba(8,3,11,0.92)';
    rr(ctx, button.x, button.y, button.w, button.h, 5);
    ctx.fill();

    ctx.lineWidth = glow ? 3 : 2.4;
    ctx.strokeStyle = glow ? `rgba(255,236,140,${0.55 + 0.45 * Math.sin(worldT * 6)})` : '#ff9a2e';
    if (glow) {
      ctx.shadowColor = 'rgba(255,220,90,0.9)';
      ctx.shadowBlur = 18;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 18px "Courier New", monospace';
    ctx.fillStyle = glow ? '#fff6bd' : '#ffb347';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    const alpha = clamp(p.life / (p.maxLife || 1), 0, 1);
    if (p.type === 'text') {
      ctx.globalAlpha = Math.min(1, alpha * 2.4);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${p.size}px "Courier New", monospace`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    } else if (p.type === 'shard') {
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.lineTo(p.r * 0.8, p.r * 0.7);
      ctx.lineTo(-p.r * 0.9, p.r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'blood') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.r * 0.5, p.y - p.r * 0.5, p.r, p.r * 2);
    }
  }
  ctx.restore();

  for (const splat of splats) {
    const alpha = clamp(splat.life / splat.maxLife, 0, 1) * 0.42;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6b0016';
    ctx.beginPath();
    ctx.arc(splat.x, splat.y, splat.r * 0.62, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const angle = splat.seed + i * 1.37;
      ctx.beginPath();
      ctx.arc(
        splat.x + Math.cos(angle) * splat.r * 0.62,
        splat.y + Math.sin(angle) * splat.r * 0.62,
        splat.r * rand(0.18, 0.3),
        0,
        TAU
      );
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function wrapLines(text, font, maxWidth) {
  ctx.save();
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

function drawReveal(text, x, y, maxWidth, reveal, font, color, lineHeight) {
  if (reveal <= 0) return;
  const lines = wrapLines(text, font, maxWidth);
  let remaining = Math.floor(reveal);
  let cursor = y;

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const line of lines) {
    if (remaining <= 0) break;
    ctx.fillText(line.slice(0, remaining), x, cursor);
    remaining -= line.length + 1;
    cursor += lineHeight;
  }
  ctx.restore();
}

function drawBigButton(rect, label, accent = '#ffb347') {
  ctx.save();
  ctx.fillStyle = 'rgba(8,3,11,0.92)';
  rr(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 18px "Courier New", monospace';
  ctx.fillStyle = accent;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

function drawTitle() {
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(4,2,8,0.9)');
  veil.addColorStop(0.42, 'rgba(4,2,8,0.35)');
  veil.addColorStop(1, 'rgba(4,2,8,0.94)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = 'italic 700 74px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#f8eaf0';
  ctx.shadowColor = 'rgba(255,20,50,0.9)';
  ctx.shadowBlur = 34;
  ctx.fillText('THE GRIN', W / 2, 528);
  ctx.shadowBlur = 0;

  ctx.font = '14px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,170,186,0.85)';
  ctx.fillText('a smile that learned your name', W / 2, 616);

  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = 'rgba(200,180,215,0.6)';
  ctx.fillText('FOUR STAGES  ·  ONE FACE  ·  TOUCH CONTROLS', W / 2, 654);

  const pulse = 0.5 + 0.5 * Math.sin(worldT * 2.7);
  ctx.font = '700 22px "Courier New", monospace';
  ctx.fillStyle = `rgba(255,222,150,${0.45 + 0.55 * pulse})`;
  ctx.fillText('TAP TO BEGIN', W / 2, 724);

  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = 'rgba(190,160,200,0.55)';
  ctx.fillText('headphones recommended  ·  flashing images  ·  drag to move', W / 2, 774);
  ctx.fillText('an original boss fight inspired by classic bullet hell', W / 2, 796);

  ctx.font = '10px "Courier New", monospace';
  ctx.fillStyle = 'rgba(150,120,160,0.5)';
  ctx.fillText('foofire.com', W / 2, 890);
  ctx.restore();
}

function drawDead() {
  const veil = Math.min(0.86, deadT * 1.1);
  ctx.fillStyle = `rgba(10,0,5,${veil})`;
  ctx.fillRect(0, 0, W, H);

  if (deadT < 0.4) return;
  const fade = clamp((deadT - 0.4) / 0.6, 0, 1);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'italic 700 42px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#ffd9e1';
  ctx.shadowColor = 'rgba(255,20,50,0.85)';
  ctx.shadowBlur = 26;
  ctx.fillText('YOUR SOUL SHATTERS.', W / 2, 340);
  ctx.shadowBlur = 0;

  ctx.font = '17px "Courier New", monospace';
  ctx.fillStyle = 'rgba(210,190,220,0.8)';
  ctx.fillText(`the ${STAGE_NAMES[boss.stage].toLowerCase()} keeps smiling.`, W / 2, 404);

  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,180,190,0.6)';
  ctx.fillText('STAY DETERMINED.', W / 2, 448);
  ctx.restore();

  if (deadT > 1.1) {
    ctx.save();
    ctx.globalAlpha = clamp((deadT - 1.1) / 0.5, 0, 1);
    for (const rect of deadButtons()) {
      drawBigButton(rect, rect.label, rect.key === 'continue' ? '#ffd166' : 'rgba(180,160,200,0.75)');
    }
    ctx.restore();
  }
}

function runTimeText() {
  const seconds = Math.max(0, Math.floor((performance.now() - runStarted) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function drawEnding() {
  const info = endingKind === 'win' ? ENDING_WIN : ENDING_SPARE;
  const t = endingT;
  const fade = clamp(t / 1.1, 0, 1);

  const veil = ctx.createLinearGradient(0, 0, 0, H);
  if (endingKind === 'win') {
    veil.addColorStop(0, 'rgba(6,0,3,0.94)');
    veil.addColorStop(0.6, 'rgba(22,0,8,0.96)');
    veil.addColorStop(1, 'rgba(4,0,2,0.98)');
  } else {
    veil.addColorStop(0, 'rgba(8,4,12,0.93)');
    veil.addColorStop(0.6, 'rgba(20,10,22,0.95)');
    veil.addColorStop(1, 'rgba(6,3,10,0.98)');
  }
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = 'italic 700 38px Georgia, "Times New Roman", serif';
  ctx.fillStyle = endingKind === 'win' ? '#ffe4ea' : '#e8e0f6';
  ctx.shadowColor = endingKind === 'win' ? 'rgba(255,20,50,0.9)' : 'rgba(160,120,255,0.6)';
  ctx.shadowBlur = 28;
  ctx.fillText(info.title, W / 2, 128);
  ctx.shadowBlur = 0;

  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = endingKind === 'win' ? 'rgba(255,150,170,0.8)' : 'rgba(190,175,230,0.8)';
  ctx.fillText(info.sub, W / 2, 186);

  const lineFont = '16px "Courier New", monospace';
  let cursor = 236;
  info.lines.forEach((line, index) => {
    const start = 0.5 + index * 1.15;
    const reveal = (t - start) * 44;
    if (reveal <= 0) return;
    ctx.textAlign = 'left';
    drawReveal(
      line,
      62,
      cursor,
      W - 124,
      reveal,
      lineFont,
      endingKind === 'win' ? 'rgba(240,222,230,0.9)' : 'rgba(226,220,246,0.9)',
      25
    );
    const rows = wrapLines(line, lineFont, W - 124).length;
    cursor += rows * 25 + 26;
  });

  if (t > 3.4) {
    ctx.globalAlpha = clamp((t - 3.4) / 0.8, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(205,190,218,0.75)';
    ctx.fillText(`time ${runTimeText()}   ·   hits taken ${player.hits}   ·   mercy ${mercy}/3`, W / 2, 606);

    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillStyle = endingKind === 'win' ? 'rgba(255,175,190,0.6)' : 'rgba(210,200,240,0.65)';
    ctx.fillText(endingKind === 'win' ? 'you won. the house is very quiet now.' : 'some things only need to be looked at kindly.', W / 2, 646);

    for (const rect of endingButtons()) {
      drawBigButton(rect, rect.label, endingKind === 'win' ? '#ffd166' : '#c9b8ff');
    }
  }
  ctx.restore();
}

function drawOverlays() {
  if (glitch > 0.03) {
    ctx.save();
    for (let i = 0; i < 10; i += 1) {
      if (Math.random() > glitch * 0.85) continue;
      const y = Math.random() * H;
      const h = 2 + Math.random() * 12;
      ctx.fillStyle = Math.random() < 0.55 ? 'rgba(255,18,58,0.16)' : 'rgba(120,220,255,0.08)';
      ctx.fillRect(0, y, W, h);
    }
    ctx.fillStyle = `rgba(255,0,40,${0.05 * glitch})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state === 'title') drawTitle();
  if (state === 'dead') drawDead();
  if (state === 'win' || state === 'spare') drawEnding();

  if (flash.alpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flash.alpha;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const vignette = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.18, W / 2, H * 0.5, H * 0.74);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------------ *
 * Frame
 * ------------------------------------------------------------------ */

function drawBoxContents() {
  if (state === 'talk') drawDialog();
  else if (state === 'menu') drawMenuBox();
  else if (state === 'aim') drawAim();
  else if (state === 'act') drawActMenu();
  else if (state === 'attack') drawAttack();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050208';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);

  drawBackground();

  ctx.save();
  if (shake > 0.1) ctx.translate(rand(-shake, shake), rand(-shake, shake));

  drawBoss();

  const showUi = state !== 'title' && state !== 'win' && state !== 'spare';
  if (showUi) {
    drawBoxFrame();
    drawBoxContents();
    drawUi();
  }

  drawParticles();
  ctx.restore();

  drawOverlays();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  update(dt);
  render();
  document.body.classList.toggle(
    'is-playing',
    state === 'talk' || state === 'menu' || state === 'aim' || state === 'act' || state === 'attack'
  );
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.ox) / view.s,
    y: (clientY - rect.top - view.oy) / view.s,
  };
}

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
  event.preventDefault();
  audio.unlock();

  const point = toLogical(event.clientX, event.clientY);
  pointer.id = event.pointerId;
  pointer.down = true;
  pointer.ax = point.x;
  pointer.ay = point.y;

  if (state === 'title') {
    begin();
    return;
  }

  if (state === 'dead') {
    if (deadT < 1.1) return;
    for (const rect of deadButtons()) {
      if (!inside(point, rect)) continue;
      if (rect.key === 'continue') retryStage();
      else backToTitle();
      return;
    }
    return;
  }

  if (state === 'win' || state === 'spare') {
    for (const rect of endingButtons()) {
      if (inside(point, rect)) {
        begin();
        return;
      }
    }
    return;
  }

  if (state === 'talk') {
    advanceDialog();
    return;
  }

  if (state === 'menu') {
    for (const rect of buttonRects()) {
      if (inside(point, rect)) {
        activate(rect.key);
        return;
      }
    }
    return;
  }

  if (state === 'aim') {
    resolveAim();
    return;
  }

  if (state === 'act') {
    for (const rect of actRects()) {
      if (inside(point, rect)) {
        useAct(rect.key);
        return;
      }
    }
    setState('menu');
    return;
  }

  if (state === 'attack') {
    joystick.active = true;
    joystick.ax = point.x;
    joystick.ay = point.y;
    joystick.x = point.x;
    joystick.y = point.y;
  }
}

function onPointerMove(event) {
  if (!pointer.down || event.pointerId !== pointer.id) return;
  const point = toLogical(event.clientX, event.clientY);
  pointer.x = point.x;
  pointer.y = point.y;
  if (state === 'attack' && joystick.active) {
    joystick.x = point.x;
    joystick.y = point.y;
  }
}

function onPointerUp(event) {
  if (event.pointerId !== pointer.id) return;
  pointer.down = false;
  pointer.id = null;
  joystick.active = false;
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
window.addEventListener('pointermove', onPointerMove, { passive: false });
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  keys.add(key === ' ' ? 'space' : key);

  if (key === 'm') {
    toggleMute();
    return;
  }

  if (key === ' ' || key === 'enter') {
    if (state === 'title') begin();
    else if (state === 'talk') advanceDialog();
    else if (state === 'aim') resolveAim();
    else if (state === 'menu') activate('fight');
    else if (state === 'dead' && deadT > 1.1) retryStage();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

const muteButton = document.getElementById('grin-mute');
const fullscreenButton = document.getElementById('grin-fullscreen');
const shell = document.getElementById('grin-shell');

function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  if (muteButton) {
    muteButton.textContent = next ? '🔇' : '🔊';
    muteButton.setAttribute('aria-pressed', String(next));
    muteButton.setAttribute('aria-label', next ? 'Unmute soundtrack' : 'Mute soundtrack');
  }
}

muteButton?.addEventListener('click', toggleMute);
fullscreenButton?.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    shell?.requestFullscreen?.();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (fullscreenButton) fullscreenButton.textContent = document.fullscreenElement ? '⤡' : '⛶';
  resize();
});

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resize).observe(canvas);
}

document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
});

resize();
lastFrame = performance.now();
requestAnimationFrame(frame);
