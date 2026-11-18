import { createDriveLevel } from './level-drive.js';
import { createDollsLevel } from './level-dolls.js';
import { createRemoteLevel } from './level-remote.js';
import { createAudio } from './sound.js';
import { submitScore, getBest } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';

/* ------------------------------------------------------------------ *
 * Escape Earth: Survive Grandma's House
 * Three levels, one destination, zero responsible adults.
 * ------------------------------------------------------------------ */

const GAME_ID = 'escape-earth';
const MUTE_KEY = 'escapeEarthMuted';

const LEVELS = [
  {
    name: 'The Drive',
    create: createDriveLevel,
    intro: {
      kicker: 'Level 1 of 3',
      title: 'Survive the drive',
      text: "You are eleven minutes into a two hour drive to Grandma's house, and the car is going much faster than the car should. Farm animals are involved now.",
      rules: [
        'Steer with ← → or A / D — or drag on the road.',
        'Dodge traffic, tractors, cows and one very brave goose.',
        'Three hearts. Donuts give you one back.',
        'Survive 950 metres of highway chaos.',
      ],
      button: 'Floor it',
    },
    hint: 'Steer with ← → or A / D, or drag across the road. Donuts repair the car with sugar.',
  },
  {
    name: 'Lights out',
    create: createDollsLevel,
    intro: {
      kicker: 'Level 2 of 3',
      title: 'The dark is full of dolls',
      text: "The power went out. Grandma said she would be back in a minute. Something in the dark giggled. Raggedy Ann and Andy are awake, and they are not sitting on the shelf any more.",
      rules: [
        'Move with WASD / arrows, or tap where you want to go.',
        'Your torch shows what is really in the room. Point it around.',
        'Find all 3 fuses to make the front door glow.',
        'They are faster after every fuse. Sorry.',
      ],
      button: 'Into the dark',
    },
    hint: 'Move with WASD / arrows or tap the floor. Three fuses wake the door. The dolls do not stop.',
  },
  {
    name: 'Remote to head',
    create: createRemoteLevel,
    intro: {
      kicker: 'Level 3 of 3',
      title: 'Grandma says the remote is radioactive',
      text: 'Grandma is watching her shows. You are holding the remote against your head, because that is what you do. She says the remote gives off radiation. If she turns around and sees you, you are in big trouble.',
      rules: [
        'Hold SPACE (or press and hold the game) to raise the remote to your head.',
        'Let go the second she starts to turn around.',
        'Three strikes and the remote goes on top of the fridge.',
        'Three rounds. Each one she checks faster.',
      ],
      button: "I'm ready",
    },
    hint: 'Hold SPACE or press and hold to raise the remote. Let go the moment she turns.',
  },
];

const container = document.querySelector('#game-container');
const hudStatsEl = document.querySelector('#hud-stats');
const levelLabel = document.querySelector('#level-label');
const hintEl = document.querySelector('#hint');
const overlayEl = document.querySelector('#overlay');
const overlayCard = overlayEl.querySelector('.overlay-card');
const overlayKicker = document.querySelector('#overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const overlayRules = document.querySelector('#overlay-rules');
const overlayStats = document.querySelector('#overlay-stats');
const startButton = document.querySelector('#start-button');
const statusEl = document.querySelector('#status');
const bannerEl = document.querySelector('#banner');
const bannerText = bannerEl.querySelector('span');
const muteButton = document.querySelector('#mute-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const gameShell = document.querySelector('.ee-game');
const bestEl = document.querySelector('#best-label');

const audio = createAudio();

/* ------------------------------------------------------------------ *
 * Sound preference
 * ------------------------------------------------------------------ */

if (readMuted(MUTE_KEY)) audio.setMuted(true);

const refreshMuteButton = () => {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute(
    'aria-label',
    muted ? 'Unmute sound effects' : 'Mute sound effects'
  );
};
refreshMuteButton();

muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  writeMuted(audio.isMuted());
  refreshMuteButton();
  if (!audio.isMuted()) audio.blip(660);
});

/* ------------------------------------------------------------------ *
 * Full screen
 * ------------------------------------------------------------------ */

const canFullscreen = Boolean(
  fullscreenButton && gameShell && document.fullscreenEnabled && gameShell.requestFullscreen
);

const refreshFullscreenButton = () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? '⤡' : '⛶';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
};

if (!canFullscreen) {
  fullscreenButton.hidden = true;
} else {
  refreshFullscreenButton();
  fullscreenButton.addEventListener('click', async () => {
    audio.unlock();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameShell.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      /* Full screen can be refused inside an iframe. */
    }
    refreshFullscreenButton();
    resize();
  });
  document.addEventListener('fullscreenchange', () => {
    refreshFullscreenButton();
    resize();
  });
}

/* ------------------------------------------------------------------ *
 * Canvas and view
 * ------------------------------------------------------------------ */

const canvas = document.createElement('canvas');
container.prepend(canvas);
const ctx = canvas.getContext('2d');
const view = { w: 800, h: 500 };

const resize = () => {
  const rect = container.getBoundingClientRect();
  view.w = Math.max(300, Math.round(rect.width));
  view.h = Math.max(260, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

resize();
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(resize).observe(container);
} else {
  window.addEventListener('resize', resize);
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

const keys = new Set();
const pointer = { x: 0, y: 0, down: false };

const input = {
  keys,
  pointer,
  horizontal() {
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    return (right ? 1 : 0) - (left ? 1 : 0);
  },
  vertical() {
    const up = keys.has('ArrowUp') || keys.has('KeyW');
    const down = keys.has('ArrowDown') || keys.has('KeyS');
    return (down ? 1 : 0) - (up ? 1 : 0);
  },
  holdDown() {
    return keys.has('Space') || keys.has('KeyE') || pointer.down;
  },
};

const setPointer = (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * view.w;
  pointer.y = ((event.clientY - rect.top) / rect.height) * view.h;
};

canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  setPointer(event);
  pointer.down = true;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    /* capture is a nicety, not a requirement */
  }
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer.down) setPointer(event);
});
const releasePointer = () => {
  pointer.down = false;
};
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);

const STEER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') {
    muteButton.click();
    return;
  }
  if (state === 'playing' && STEER_KEYS.has(event.code)) event.preventDefault();
  keys.add(event.code);
  audio.unlock();
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});
window.addEventListener('blur', () => {
  keys.clear();
  pointer.down = false;
});

/* ------------------------------------------------------------------ *
 * Banner and HUD
 * ------------------------------------------------------------------ */

let bannerTimer = 0;

const say = (text, seconds = 2) => {
  bannerText.textContent = text;
  bannerEl.classList.add('show');
  bannerTimer = seconds;
  if (statusEl) statusEl.textContent = text;
};

let lastHudKey = '';

const renderHud = (data) => {
  const key = JSON.stringify(data);
  if (key === lastHudKey) return;
  lastHudKey = key;
  hudStatsEl.replaceChildren(
    ...data.stats.map(([label, value]) => {
      const stat = document.createElement('div');
      stat.className = 'hud-stat';
      const labelEl = document.createElement('span');
      labelEl.className = 'hud-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('strong');
      valueEl.textContent = value;
      stat.append(labelEl, valueEl);
      return stat;
    })
  );
};

/* ------------------------------------------------------------------ *
 * Overlays and level flow
 * ------------------------------------------------------------------ */

let state = 'intro';
let level = null;
let levelIndex = 0;
let totalScore = 0;
let pendingStart = null;

const showOverlay = ({ kicker, title, text, rules = [], stats = [], button, onStart }) => {
  overlayKicker.textContent = kicker ?? '';
  overlayTitle.textContent = title ?? '';
  overlayText.textContent = text ?? '';
  overlayRules.replaceChildren(
    ...rules.map((rule) => {
      const li = document.createElement('li');
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '★';
      const copy = document.createElement('span');
      copy.textContent = rule;
      li.append(mark, copy);
      return li;
    })
  );
  overlayRules.hidden = rules.length === 0;
  overlayStats.replaceChildren(
    ...stats.map(([label, value]) => {
      const cell = document.createElement('div');
      cell.className = 'stat-cell';
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const valueEl = document.createElement('strong');
      valueEl.textContent = value;
      cell.append(labelEl, valueEl);
      return cell;
    })
  );
  overlayStats.classList.toggle('show', stats.length > 0);
  startButton.textContent = button ?? 'Start';
  startButton.hidden = false;
  startButton.disabled = false;
  pendingStart = onStart ?? null;
  overlayEl.classList.remove('hidden');
  overlayCard.scrollTop = 0;
};

const hideOverlay = () => {
  overlayEl.classList.add('hidden');
  pointer.down = false;
  keys.clear();
};

startButton.addEventListener('click', () => {
  audio.unlock();
  const action = pendingStart;
  pendingStart = null;
  if (action) action();
});

const levelPlan = (index) => ({
  name: LEVELS[index].name,
  hint: LEVELS[index].hint,
});

const beginLevel = (index) => {
  levelIndex = index;
  const def = LEVELS[index];
  level = def.create({
    sound: audio,
    say,
    onWin: (result) => {
      if (state !== 'playing') return;
      totalScore += result.points ?? 0;
      afterWin(result);
    },
    onLose: (result) => {
      if (state !== 'playing') return;
      afterLose(result);
    },
  });
  level.reset();
  state = 'playing';
  levelLabel.textContent = `${index + 1} / ${LEVELS.length}`;
  hintEl.textContent = levelPlan(index).hint;
  lastHudKey = '';
  hideOverlay();
  statusEl.textContent = `Level ${index + 1}: ${def.name}.`;
};

const afterWin = (result) => {
  state = 'between';
  pointer.down = false;
  keys.clear();

  if (levelIndex === LEVELS.length - 1) {
    finishGame();
    return;
  }

  const next = LEVELS[levelIndex + 1];
  showOverlay({
    kicker: `Level ${levelIndex + 1} cleared · +${result.points ?? 0}`,
    title: result.title ?? 'You survived',
    text: result.text ?? '',
    rules: next.intro.rules,
    stats: result.stats ?? [],
    button: `Next: ${next.intro.title}`,
    onStart: () => beginLevel(levelIndex + 1),
  });
  say('Level clear!', 2);
  statusEl.textContent = `${result.title ?? 'Level cleared'}. Next up: ${next.name}.`;
};

const afterLose = (result) => {
  state = 'lost';
  pointer.down = false;
  keys.clear();
  showOverlay({
    kicker: 'Try again',
    title: result.title ?? 'That did not go well',
    text: result.text ?? '',
    stats: result.stats ?? [],
    button: 'Try this level again',
    onStart: () => {
      beginLevel(levelIndex);
    },
  });
  statusEl.textContent = `${result.title ?? 'You lost'}. Press the button to retry.`;
};

const finishGame = () => {
  state = 'done';
  let saved = { best: totalScore, isBest: false };
  try {
    saved = submitScore(GAME_ID, totalScore);
  } catch (error) {
    /* The game still ends fine if storage is blocked. */
  }
  let best = saved.best ?? totalScore;
  try {
    best = Math.max(best, getBest(GAME_ID));
  } catch (error) {
    /* ignore */
  }
  bestEl.textContent = best > 0 ? best.toLocaleString('en-US') : '0';

  showOverlay({
    kicker: saved.isBest ? 'New personal best!' : 'Grandma is asleep',
    title: 'You escaped Grandma’s house',
    text: 'Three levels. One car. Two dolls. One very radioactive remote. You are standing in the driveway, slightly on fire, completely free.',
    stats: [
      ['Total score', totalScore.toLocaleString('en-US')],
      ['Best score', best.toLocaleString('en-US')],
    ],
    button: 'Play again',
    onStart: () => {
      totalScore = 0;
      showIntro();
    },
  });
  audio.win();
  statusEl.textContent = `You escaped Grandma's house with ${totalScore} points.`;
};

const showIntro = () => {
  state = 'intro';
  level = null;
  levelLabel.textContent = `1 / ${LEVELS.length}`;
  hudStatsEl.replaceChildren();
  hintEl.textContent = LEVELS[0].hint;
  showOverlay({
    kicker: 'A game in three terrible decisions',
    title: 'Escape Earth: Survive Grandma’s House',
    text: 'Level one: drive to Grandma’s house without destroying the car. Level two: the power is out and the dolls are awake. Level three: hold the remote against your head and do not get caught, because Grandma is certain it is radioactive.',
    rules: LEVELS.map((entry, index) => `Level ${index + 1}: ${entry.intro.title}`),
    button: 'Buckle up',
    onStart: () => beginLevel(0),
  });
};

/* ------------------------------------------------------------------ *
 * Main loop
 * ------------------------------------------------------------------ */

let lastTime = performance.now();
let clock = 0;

const frame = (now) => {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  autoPause.sync();
  if (autoPause.paused) {
    requestAnimationFrame(frame);
    return;
  }

  clock += dt;

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerEl.classList.remove('show');
  }

  if (level && state === 'playing') {
    level.update(dt, input, view);
    renderHud(level.hud());
  }

  ctx.clearRect(0, 0, view.w, view.h);
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(0, 0, view.w, view.h);
  if (level) level.draw(ctx, view, clock);

  requestAnimationFrame(frame);
};

try {
  bestEl.textContent = Math.max(0, getBest(GAME_ID)).toLocaleString('en-US');
} catch (error) {
  bestEl.textContent = '0';
}

/* A level freezes when the tab goes away. */
const autoPause = createAutoPause({
  container,
  audio,
  muteButton,
  button: document.querySelector('#pause-button'),
  shouldPause: () => state === 'playing',
  message: 'Level paused',
});

showIntro();
requestAnimationFrame(frame);
