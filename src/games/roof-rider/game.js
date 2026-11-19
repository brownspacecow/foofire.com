import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';
import { createAudio } from './audio.js';
import {
  DEFAULT_TRACK_ID,
  buildTerrain,
  checkpointBefore,
  respawnPoint,
  trackSummaries,
} from './terrain.js';
import { PHYS, bikeSpeed, createBike, resetBike, stepBike } from './physics.js';
import { appendGhostSample, createGhost, ghostPose, loadGhosts, saveGhost } from './ghost.js';

/* ------------------------------------------------------------------ *
 * Roof Rider
 * A 2D rooftop motocross rhythm racer built around three things:
 * preload the suspension, scrub the jump flat, land on the backside.
 * ------------------------------------------------------------------ */

const GAME_ID = 'roof-rider';
const BEST_TIMES_KEY = 'roofRiderBestTimes.v1';
const PHYSICS_STEP = 1 / 240;
const MAX_STEPS = 18;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${minutes}:${String(rest).padStart(2, '0')}.${tenths}`;
};

/* ------------------------------------------------------------------ DOM */

const container = document.querySelector('#game-container');
const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const coarsePointer = window.matchMedia('(pointer: coarse)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  score: document.querySelector('#score-value'),
  flow: document.querySelector('#flow-chip'),
  section: document.querySelector('#section-name'),
  sectionKicker: document.querySelector('#section-kicker'),
  sectionStep: document.querySelector('#section-step'),
  time: document.querySelector('#time-value'),
  speed: document.querySelector('#speed-value'),
  loadGauge: document.querySelector('#load-gauge'),
  loadLabel: document.querySelector('#load-label'),
  loadFill: document.querySelector('#load-fill'),
  progress: document.querySelector('#progress-fill'),
  progressMarker: document.querySelector('#progress-marker'),
  toast: document.querySelector('#toast'),
  countdown: document.querySelector('#countdown'),
  startOverlay: document.querySelector('#start-overlay'),
  resultOverlay: document.querySelector('#result-overlay'),
  startBest: document.querySelector('#start-best'),
  startBestTime: document.querySelector('#start-best-time'),
  startGhost: document.querySelector('#start-ghost'),
  trackOptions: document.querySelector('#track-options'),
  startButton: document.querySelector('#start-button'),
  restartButton: document.querySelector('#restart-button'),
  pauseButton: document.querySelector('#pause-button'),
  muteButton: document.querySelector('#mute-button'),
  fullscreenButton: document.querySelector('#fullscreen-button'),
  againButton: document.querySelector('#again-button'),
  nextButton: document.querySelector('#next-button'),
  resultKicker: document.querySelector('#result-kicker'),
  resultTime: document.querySelector('#result-time'),
  resultTrack: document.querySelector('#result-track'),
  resultScore: document.querySelector('#result-score'),
  resultStyle: document.querySelector('#result-style'),
  resultBestTime: document.querySelector('#result-best-time'),
  resultFlow: document.querySelector('#result-flow'),
  resultClean: document.querySelector('#result-clean'),
  resultScrubs: document.querySelector('#result-scrubs'),
  resultBest: document.querySelector('#result-best'),
  resultGhost: document.querySelector('#result-ghost'),
  resultBadge: document.querySelector('#result-badge'),
  fallback: document.querySelector('#fallback'),
};

const audio = createAudio();
const tracks = trackSummaries();

const state = {
  phase: 'menu',
  trackId: DEFAULT_TRACK_ID,
  terrain: null,
  bike: null,
  sectionRanges: [],
  time: 0,
  style: 0,
  finalScore: 0,
  combo: 0,
  bestCombo: 0,
  clean: 0,
  scrubs: 0,
  pops: 0,
  crashes: 0,
  countdown: 0,
  countdownLabel: '',
  goFlash: 0,
  crashTimer: 0,
  physicsAcc: 0,
  toastUntil: 0,
  dustAcc: 0,
  particles: [],
  floaters: [],
  camera: { x: 0, y: 0 },
  shake: 0,
  stepFlash: 0,
  bestTimes: {},
  bestScore: 0,
  ghosts: {},
  ghost: null,
  record: null,
  keys: new Set(),
  touch: { gas: false, brake: false, left: false, right: false, load: false },
  lastHud: {},
  trackIndex: 0,
  finished: false,
  muted: false,
  hintShown: false,
  crashAt: 0,
  lastEventAt: 0,
  stuckTime: 0,
};

let view = { width: 1, height: 1, dpr: 1, scale: 32, viewW: 30 };
let backdrop = null;
let lastFrame = performance.now();
let autoPause = null;

/* ------------------------------------------------------------------ setup */

function readBestTimes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BEST_TIMES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeBestTimes(times) {
  try {
    window.localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(times));
  } catch (error) {
    /* Storage can be blocked; the game still runs. */
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function selectTrack(trackId, { reset = true } = {}) {
  const found = tracks.findIndex((track) => track.id === trackId);
  state.trackId = trackId;
  state.trackIndex = found >= 0 ? found : 0;
  state.terrain = buildTerrain(state.trackId);
  state.sectionRanges = state.terrain.sections.map((section) => {
    const features = state.terrain.features.filter((feature) => feature.section === section.name);
    return {
      ...section,
      features,
      end: features.length
        ? Math.max(...features.map((feature) => feature.landingX + 12))
        : section.x + 20,
    };
  });
  backdrop = makeBackdrop(state.terrain.id);
  if (reset) {
    state.bike = createBike(state.terrain);
    state.bike.x = state.terrain.startX;
    state.bike.y = state.terrain.surfaceAt(state.terrain.startX) + 0.9;
    state.bike.angle = state.terrain.angleAt(state.terrain.startX);
    state.camera.x = state.bike.x + 7;
    state.camera.y = state.bike.y + 2.4;
  }
  updateTrackOptions();
  updateStartSummary();
}

function updateStartSummary() {
  state.bestScore = getBest(GAME_ID);
  if (els.startBest) els.startBest.textContent = state.bestScore.toLocaleString('en-US');
  const best = state.bestTimes[state.trackId];
  if (els.startBestTime) els.startBestTime.textContent = best ? formatTime(best) : '—';
  if (els.startGhost) {
    els.startGhost.textContent = state.ghosts[state.trackId] ? ' · Ghost ready' : '';
  }
}

function updateTrackOptions() {
  if (!els.trackOptions) return;
  const buttons = [...els.trackOptions.querySelectorAll('[data-track]')];
  buttons.forEach((button) => {
    const selected = button.dataset.track === state.trackId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    const best = state.bestTimes[button.dataset.track];
    const bestEl = button.querySelector('.track-best');
    if (bestEl) bestEl.textContent = best ? `Best ${formatTime(best)}` : 'No run yet';
  });
}

function renderTrackPicker() {
  if (!els.trackOptions) return;
  els.trackOptions.replaceChildren(
    ...tracks.map((track) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-option';
      button.dataset.track = track.id;
      button.setAttribute('aria-pressed', 'false');

      const badge = document.createElement('span');
      badge.className = `track-diff diff-${track.difficulty.toLowerCase()}`;
      badge.textContent = track.difficulty;

      const name = document.createElement('strong');
      name.textContent = track.name;

      const desc = document.createElement('span');
      desc.className = 'track-desc';
      desc.textContent = track.tagline;

      const best = document.createElement('span');
      best.className = 'track-best';
      best.textContent = 'No run yet';

      button.append(badge, name, desc, best);
      button.addEventListener('click', () => {
        if (state.phase !== 'menu') return;
        selectTrack(track.id);
        updateTrackOptions();
      });
      return button;
    })
  );
  updateTrackOptions();
}

function makeBackdrop(seedText) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const clouds = Array.from({ length: 5 }, () => ({
    x: random() * 900,
    y: 0.1 + random() * 0.25,
    w: 90 + random() * 190,
    h: 12 + random() * 26,
    alpha: 0.08 + random() * 0.14,
  }));

  const mesa = (count, minH, maxH) =>
    Array.from({ length: count }, (_, index) => {
      const width = 130 + random() * 250;
      return {
        x: (index / count) * 900 + random() * 80,
        width,
        height: minH + random() * (maxH - minH),
        lip: 0.55 + random() * 0.3,
      };
    });

  return { clouds, far: mesa(6, 40, 110), near: mesa(5, 60, 150) };
}

/* ------------------------------------------------------------------ input */

const input = { throttle: 0, brake: 0, lean: 0, load: false };

function readInput() {
  const keys = state.keys;
  const throttle = keys.has('KeyW') || keys.has('ArrowUp') || state.touch.gas ? 1 : 0;
  const brake = keys.has('KeyS') || keys.has('ArrowDown') || state.touch.brake ? 1 : 0;
  const forward = keys.has('KeyD') || keys.has('ArrowRight') || state.touch.right ? 1 : 0;
  const back = keys.has('KeyA') || keys.has('ArrowLeft') || state.touch.left ? 1 : 0;
  const load = keys.has('Space') || state.touch.load;
  input.throttle = throttle;
  input.brake = brake;
  input.lean = forward - back;
  input.load = Boolean(load);
  return input;
}

const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

function bindInput() {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    if (event.code === 'KeyR' && (state.phase === 'riding' || state.phase === 'crashed')) {
      event.preventDefault();
      respawnFromCrash(true);
      return;
    }

    if (!GAME_KEYS.has(event.code)) return;
    if (state.phase === 'menu' || state.phase === 'finished') return;
    event.preventDefault();
    state.keys.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    state.keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    state.keys.clear();
    state.touch = { gas: false, brake: false, left: false, right: false, load: false };
  });

  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    const set = (on) => {
      state.touch[control] = on;
      button.classList.toggle('is-pressed', on);
    };
    const onDown = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      set(true);
      if (state.phase === 'menu' || state.phase === 'finished') return;
    };
    button.addEventListener('pointerdown', onDown);
    button.addEventListener('pointerup', () => set(false));
    button.addEventListener('pointercancel', () => set(false));
    button.addEventListener('lostpointercapture', () => set(false));
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });
}

/* ------------------------------------------------------------------ flow */

function startRun() {
  if (!state.terrain) return;
  audio.start();
  closeOverlays();
  resetRunState();
  resetBike(state.bike, state.terrain, state.terrain.startX);
  state.bike.y = state.terrain.surfaceAt(state.terrain.startX) + 0.95;
  state.bike.angle = state.terrain.angleAt(state.terrain.startX);
  state.camera.x = state.bike.x + 5;
  state.camera.y = state.bike.y + 2.2;
  state.ghost = createGhost(state.ghosts[state.trackId]);
  state.record = { samples: [], lastT: 0 };
  appendGhostSample(state.record.samples, state.bike, 0);
  state.phase = 'countdown';
  state.countdown = 2.1;
  state.countdownLabel = '';
  state.goFlash = 0;
  autoPause?.sync();
  showCountdown('3');
  state.countdownLabel = '3';
  els.startOverlay?.classList.remove('is-open');
  els.resultOverlay?.classList.remove('is-open');
  if (state.ghost) {
    toast(`Ghost of your ${formatTime(state.ghost.time)} is on the gate`, 'neutral', 1.9);
  }
  container?.focus({ preventScroll: true });
}

function resetRunState() {
  state.time = 0;
  state.style = 0;
  state.finalScore = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.clean = 0;
  state.scrubs = 0;
  state.pops = 0;
  state.crashes = 0;
  state.physicsAcc = 0;
  state.particles = [];
  state.floaters = [];
  state.shake = 0;
  state.dustAcc = 0;
  state.crashTimer = 0;
  state.stuckTime = 0;
  state.finished = false;
  state.hintShown = false;
  state.lastHud = {};
  state.keys.clear();
  if (els.toast) els.toast.classList.remove('is-visible');
}

function closeOverlays() {
  els.startOverlay?.classList.remove('is-open');
  els.resultOverlay?.classList.remove('is-open');
}

function showStartMenu() {
  state.phase = 'menu';
  closeOverlays();
  els.startOverlay?.classList.add('is-open');
  state.keys.clear();
  audio.stop();
  autoPause?.sync();
  updateStartSummary();
}

function respawnFromCrash(manual = false) {
  if (!state.bike || !state.terrain) return;
  const checkpoint = checkpointBefore(state.terrain, state.bike.x);
  const point = respawnPoint(state.terrain, checkpoint);
  resetBike(state.bike, state.terrain, point.x);
  state.bike.y = point.y;
  state.bike.angle = point.angle;
  state.physicsAcc = 0;
  state.crashTimer = 0;
  state.phase = 'riding';
  state.combo = 0;
  state.camera.x = state.bike.x + 5;
  state.camera.y = state.bike.y + 2.2;
  if (manual) {
    toast('Back on the bike', 'neutral', 1.2);
  } else {
    toast('Back on the bike — find your flow', 'neutral', 1.4);
  }
  audio.checkpoint();
  autoPause?.sync();
}

function recordGhostFrame(force = false) {
  if (!state.record || !state.bike) return;
  if (force ? state.time <= state.record.lastT : state.time - state.record.lastT < 1 / 30) return;
  state.record.lastT = state.time;
  appendGhostSample(state.record.samples, state.bike, state.time);
}

function finishRun() {
  if (state.phase === 'finished') return;
  recordGhostFrame(true);
  const terrain = state.terrain;
  const time = state.time;
  const timeBonus = Math.max(0, Math.round((terrain.par - time) * 40));
  const finalScore = state.style + 1000 + timeBonus;
  state.finalScore = finalScore;
  state.finished = true;
  state.phase = 'finished';
  audio.stop();
  audio.finish();

  const saved = submitScore(GAME_ID, finalScore);
  state.bestScore = saved.best;

  const previousBestTime = state.bestTimes[terrain.id] ?? 0;
  const newTimeBest = !previousBestTime || time < previousBestTime;
  if (newTimeBest) {
    state.bestTimes[terrain.id] = time;
    writeBestTimes(state.bestTimes);
  }

  /* The ghost is the fastest completed run, not the highest-scoring one. */
  const ghostEntry = newTimeBest
    ? saveGhost(getStorage(), terrain.id, time, state.record?.samples ?? [])
    : null;
  if (ghostEntry) state.ghosts[terrain.id] = ghostEntry;

  if (els.resultKicker) {
    els.resultKicker.textContent = newTimeBest ? 'New track record' : 'Chequered flag';
  }
  if (els.resultTrack) els.resultTrack.textContent = terrain.name;
  if (els.resultTime) els.resultTime.textContent = formatTime(time);
  if (els.resultBestTime) {
    els.resultBestTime.textContent = formatTime(state.bestTimes[terrain.id]);
  }
  if (els.resultScore) els.resultScore.textContent = finalScore.toLocaleString('en-US');
  if (els.resultStyle) els.resultStyle.textContent = state.style.toLocaleString('en-US');
  if (els.resultFlow) els.resultFlow.textContent = `×${Math.max(1, state.bestCombo)}`;
  if (els.resultClean) els.resultClean.textContent = String(state.clean);
  if (els.resultScrubs) els.resultScrubs.textContent = String(state.scrubs);
  if (els.resultBest) {
    els.resultBest.textContent = saved.isBest
      ? `New best score — ${saved.best.toLocaleString('en-US')} points`
      : `Best score ${saved.best.toLocaleString('en-US')} points`;
  }
  if (els.resultGhost) {
    els.resultGhost.hidden = !ghostEntry;
    if (ghostEntry) {
      els.resultGhost.textContent = `Ghost saved — your ${formatTime(time)} best run will ride with you.`;
    }
  }
  if (els.resultBestTime) {
    els.resultBestTime.textContent = formatTime(state.bestTimes[terrain.id]);
  }
  if (els.resultBadge) {
    els.resultBadge.textContent = saved.isBest ? 'PERSONAL BEST' : newTimeBest ? 'TRACK RECORD' : 'CLEAN RUN';
    els.resultBadge.classList.toggle('is-best', saved.isBest);
  }

  els.resultOverlay?.classList.add('is-open');
  updateStartSummary();
  autoPause?.sync();
}

function nextTrack() {
  const next = tracks[(state.trackIndex + 1) % tracks.length];
  selectTrack(next.id);
  startRun();
}

/* ------------------------------------------------------------------ toast */

function toast(message, tone = 'neutral', duration = 1.6) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.dataset.tone = tone;
  els.toast.classList.add('is-visible');
  state.toastUntil = performance.now() / 1000 + duration;
}

function showCountdown(text) {
  if (!els.countdown) return;
  els.countdown.textContent = text;
  els.countdown.classList.add('is-visible');
  els.countdown.classList.remove('pop');
  void els.countdown.offsetWidth;
  els.countdown.classList.add('pop');
}

/* ------------------------------------------------------------------ loop */

function update(delta) {
  const dt = Math.min(0.05, delta);
  updateParticles(dt);
  updateFloaters(dt);
  state.shake = Math.max(0, state.shake - dt * 2.4);
  state.stepFlash = Math.max(0, state.stepFlash - dt * 2);
  state.goFlash = Math.max(0, state.goFlash - dt);

  if (state.phase === 'menu') {
    updateCamera(dt, true);
    updateHud();
    return;
  }

  if (state.phase === 'countdown') {
    state.countdown -= dt;
    const remaining = state.countdown;
    let label = '3';
    if (remaining <= 0.7) label = '1';
    else if (remaining <= 1.4) label = '2';
    if (label !== state.countdownLabel) {
      state.countdownLabel = label;
      showCountdown(label);
    }
    if (state.countdown <= 0) {
      state.phase = 'riding';
      state.goFlash = 0.65;
      state.countdownLabel = 'GO!';
      showCountdown('GO!');
      state.toastUntil = 0;
      audio.start();
    }
    updateCamera(dt);
    updateHud();
    return;
  }

  if (state.phase === 'crashed') {
    state.time += dt;
    state.crashTimer -= dt;
    updateCamera(dt);
    updateHud();
    if (state.crashTimer <= 0) respawnFromCrash(false);
    return;
  }

  if (state.phase === 'riding') {
    state.time += dt;
    state.physicsAcc = Math.min(state.physicsAcc + dt, PHYSICS_STEP * MAX_STEPS);
    state.bike.events.length = 0;

    let steps = 0;
    while (state.physicsAcc >= PHYSICS_STEP && steps < MAX_STEPS) {
      stepBike(state.bike, state.terrain, readInput(), PHYSICS_STEP);
      state.physicsAcc -= PHYSICS_STEP;
      steps += 1;
      if (state.bike.crashed) break;
    }

    handleBikeEvents();

    if (state.phase === 'riding') {
      recordGhostFrame();
      updateDust(dt);
      updateCamera(dt);
      updateHud();
      updateAudio();
      checkStuck(dt);
      if (state.goFlash > 0.28 && els.countdown) els.countdown.classList.add('is-visible');
      if (state.goFlash <= 0.24 && els.countdown) els.countdown.classList.remove('is-visible');
      if (state.bike.x >= state.terrain.finishX) finishRun();
    }
    if (state.goFlash <= 0.24 && els.countdown && state.phase === 'crashed') {
      els.countdown.classList.remove('is-visible');
    }
    return;
  }

  if (state.phase === 'finished') {
    updateCamera(dt);
    updateHud();
  }
}

function handleBikeEvents() {
  for (const event of state.bike.events) {
    if (state.phase !== 'riding') break;

    if (event.type === 'takeoff' && event.popped) {
      state.style += 35;
      state.pops += 1;
      addFloater(event.x, event.y + 1.5, '+35 POP', '#ffd93d', 1);
      state.shake = Math.max(state.shake, 0.16);
      audio.pop();
    }

    if (event.type === 'land') {
      handleLanding(event);
    }

    if (event.type === 'crash') {
      state.phase = 'crashed';
      state.crashTimer = 1.15;
      state.crashAt = state.bike.x;
      state.combo = 0;
      state.crashes += 1;
      state.shake = 1;
      burstDust(event.x, event.y, 26, 1.4);
      audio.crash();
      toast('CRASH! Back to the last checkpoint', 'bad', 1.7);
      if (els.countdown) els.countdown.classList.remove('is-visible');
      autoPause?.sync();
      break;
    }
  }
}

function handleLanding(event) {
  const x = event.x;
  const y = event.y;
  const impact = event.impact;

  if (event.quality === 'backside') {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const points = 90 + Math.min(6, state.combo) * 35 + (event.scrubbed ? 80 : 0);
    state.style += points;
    state.clean += 1;
    if (event.scrubbed) state.scrubs += 1;
    const label = event.scrubbed ? 'SCRUB +' : 'BACKSIDE +';
    addFloater(x, y + 1.7, `${label}${points}`, event.scrubbed ? '#2ec4ff' : '#3ddc84', 1.2);
    if (state.combo >= 3) {
      setTimeout(() => {
        if (state.phase === 'riding') addFloater(x, y + 2.5, `FLOW ×${state.combo}`, '#ffd93d', 0.9);
      }, 180);
    }
    toast(event.scrubbed ? 'Scrubbed landing — smooth' : 'On the backside', 'good', 1.15);
  } else if (event.quality === 'sketchy') {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const points = 45 + Math.min(4, state.combo) * 15;
    state.style += points;
    addFloater(x, y + 1.6, `SKETCHY +${points}`, '#ff8a00', 1);
  } else if (event.quality === 'cased' || event.quality === 'sloppy') {
    state.combo = 0;
    addFloater(x, y + 1.5, event.quality === 'cased' ? 'CASED' : 'SLOPPY', '#ff2e63', 1);
    toast(event.quality === 'cased' ? 'Cased it — carry more speed' : 'Keep the bike straight', 'bad', 1.2);
  } else if (event.airTime > 0.4) {
    state.combo = 0;
    addFloater(x, y + 1.4, 'FLAT', '#bcacf0', 0.9);
  }

  state.shake = Math.max(state.shake, Math.min(0.5, impact / 24));
  burstDust(x, y, Math.round(8 + impact * 1.6), 1);
  audio.land(impact);

  if (!state.hintShown && state.terrain.features.length) {
    state.hintShown = true;
    setTimeout(() => {
      if (state.phase === 'riding') {
        toast('Preload → pop → scrub → backside', 'neutral', 2);
      }
    }, 900);
  }
}

function checkStuck(dt) {
  const bike = state.bike;
  const speed = Math.hypot(bike.vx, bike.vy);
  if (input.throttle > 0.5 && bike.grounded && speed < 1.1) {
    state.stuckTime += dt;
    if (state.stuckTime > 2.6) {
      state.stuckTime = 0;
      toast('Back to the last checkpoint', 'neutral', 1.4);
      respawnFromCrash(true);
    }
  } else {
    state.stuckTime = Math.max(0, state.stuckTime - dt * 2);
  }
}

function updateAudio() {
  const bike = state.bike;
  audio.update({
    speed: bikeSpeed(bike),
    throttle: input.throttle,
    air: !bike.grounded,
    scrub: bike.scrubbing,
  });
}

/* ------------------------------------------------------------------ camera */

function updateCamera(dt, snap = false) {
  const bike = state.bike;
  if (!bike || !state.terrain) return;
  const speed = Math.max(0, bike.vx);
  const lookAhead = 1.6 + clamp(speed * 0.32, 0, 7);
  const targetX = bike.x + view.viewW * 0.14 + lookAhead;
  const groundAhead = state.terrain.surfaceAt(bike.x + 5);
  const targetY = Math.max(bike.y + 1.8, groundAhead + 2.9);

  if (snap || !Number.isFinite(state.camera.x)) {
    state.camera.x = targetX;
    state.camera.y = targetY;
  } else {
    state.camera.x = damp(state.camera.x, targetX, 4.5, dt);
    state.camera.y = damp(state.camera.y, targetY, 3.2, dt);
  }
}

/* ------------------------------------------------------------------ effects */

function addFloater(x, y, text, color, scale = 1) {
  state.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2, scale });
  if (state.floaters.length > 14) state.floaters.shift();
}

function spawnParticle(x, y, vx, vy, options = {}) {
  if (state.particles.length > 220) return;
  state.particles.push({
    x,
    y,
    vx,
    vy,
    life: options.life ?? 0.7,
    maxLife: options.life ?? 0.7,
    size: options.size ?? 0.18,
    color: options.color ?? state.terrain.theme.roofLine,
    gravity: options.gravity ?? 2,
    drag: options.drag ?? 1.4,
  });
}

function burstDust(x, y, count, power = 1) {
  const theme = state.terrain.theme;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 4) * power;
    spawnParticle(
      x + (Math.random() - 0.5) * 0.8,
      y + Math.random() * 0.5,
      Math.cos(angle) * speed - 1,
      Math.abs(Math.sin(angle)) * speed * 0.6 + 0.5,
      {
        life: 0.4 + Math.random() * 0.6,
        size: 0.09 + Math.random() * 0.2,
        color: Math.random() > 0.5 ? theme.roofLine : theme.roof,
        gravity: 2.6,
      }
    );
  }
}

function updateDust(dt) {
  const bike = state.bike;
  if (!bike || !state.terrain) return;
  const speed = Math.hypot(bike.vx, bike.vy);
  const theme = state.terrain.theme;

  if (bike.grounded && input.throttle > 0.2 && speed > 2) {
    state.dustAcc += dt * (10 + speed * 3.8) * input.throttle;
    while (state.dustAcc > 1) {
      state.dustAcc -= 1;
      const rearX = bike.x - 0.72;
      spawnParticle(
        rearX,
        state.terrain.surfaceAt(rearX) + 0.15,
        -1.4 - Math.random() * 2.2,
        0.7 + Math.random() * 1.8,
        {
          life: 0.35 + Math.random() * 0.45,
          size: 0.07 + Math.random() * 0.16,
          color: Math.random() > 0.4 ? theme.roofLine : theme.roof,
          gravity: 2.2,
        }
      );
    }
  } else {
    state.dustAcc = Math.min(state.dustAcc, 2);
  }

  if (bike.scrubbing && Math.random() < 0.5) {
    spawnParticle(
      bike.x + (Math.random() - 0.5) * 1.2,
      bike.y + Math.random() * 0.7,
      -3 - Math.random() * 2,
      0.2 + Math.random() * 0.8,
      { life: 0.3, size: 0.06 + Math.random() * 0.08, color: theme.skyLow, gravity: 0.2, drag: 0.5 }
    );
  }
}

function updateParticles(dt) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy -= p.gravity * dt;
    p.vx *= 1 - p.drag * dt;
    p.vy *= 1 - p.drag * 0.4 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function updateFloaters(dt) {
  const list = state.floaters;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const f = list[i];
    f.life -= dt;
    f.y += dt * 1.15;
    if (f.life <= 0) list.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ HUD */

function setText(element, text) {
  if (!element) return;
  if (element.textContent !== text) element.textContent = text;
}

function updateHud() {
  const bike = state.bike;
  if (!bike) return;
  const time = formatTime(state.time);
  const speed = Math.round(Math.hypot(bike.vx, bike.vy) * 3.6);

  setText(els.time, time);
  setText(els.speed, String(speed));
  setText(els.score, state.style.toLocaleString('en-US'));
  setText(els.flow, `FLOW ×${Math.max(1, state.combo)}`);
  if (els.flow) {
    els.flow.classList.toggle('is-hot', state.combo >= 3);
    els.flow.classList.toggle('is-idle', state.combo < 1);
  }

  const active = activeSection();
  if (active) {
    setText(els.sectionKicker, 'SECTION');
    setText(els.section, active.name);
    let label = '';
    if (active.features.length) {
      const done = active.features.filter((f) => f.landingX < bike.x).length;
      const step = clamp(done + 1, 1, active.features.length);
      label = `${step} / ${active.features.length}`;
    }
    setText(els.sectionStep, label);
  } else {
    setText(els.sectionKicker, 'TRACK');
    setText(els.section, state.terrain?.name ?? 'ROOF RIDER');
    setText(els.sectionStep, '');
  }

  const progress = clamp(bike.x / Math.max(1, state.terrain.finishX), 0, 1);
  if (els.progress) els.progress.style.transform = `scaleX(${progress.toFixed(4)})`;
  if (els.progressMarker) els.progressMarker.style.left = `${(progress * 100).toFixed(2)}%`;

  if (els.loadGauge) {
    const airborne = !bike.grounded;
    if (airborne) {
      const amount = clamp(bike.scrubTime / 0.55, 0, 1);
      els.loadGauge.classList.add('is-air');
      els.loadGauge.classList.toggle('is-scrubbing', bike.scrubbing);
      els.loadGauge.classList.remove('is-hot');
      setText(els.loadLabel, bike.scrubbing ? 'SCRUB!' : 'SCRUB');
      if (els.loadFill) els.loadFill.style.transform = `scaleX(${(bike.airTime > 0.1 ? Math.max(0.08, amount) : 0).toFixed(3)})`;
    } else {
      els.loadGauge.classList.remove('is-air', 'is-scrubbing');
      els.loadGauge.classList.toggle('is-hot', bike.preloadCharge > 0.55);
      setText(els.loadLabel, bike.preloadCharge > 0.55 ? 'RELEASE!' : 'PRELOAD');
      if (els.loadFill) els.loadFill.style.transform = `scaleX(${clamp(bike.preloadCharge, 0, 1).toFixed(3)})`;
    }
  }

  if (state.toastUntil && performance.now() / 1000 > state.toastUntil) {
    els.toast?.classList.remove('is-visible');
    state.toastUntil = 0;
  }
}

function activeSection() {
  const bike = state.bike;
  if (!bike) return null;
  let found = null;
  for (const range of state.sectionRanges) {
    if (bike.x >= range.x - 14 && bike.x <= range.end) found = range;
  }
  return found;
}

/* ------------------------------------------------------------------ rendering */

function resize() {
  if (!canvas) return;
  const rect = container.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const viewHeight = clamp(height / 34, 14.5, 19.5);
  view = {
    width,
    height,
    dpr,
    scale: height / viewHeight,
    viewW: width / (height / viewHeight),
  };
}

function worldToScreen(x, y) {
  return {
    x: (x - state.camera.x) * view.scale + view.width / 2,
    y: view.height / 2 - (y - state.camera.y) * view.scale,
  };
}

function render() {
  if (!context || !state.terrain) return;
  const { width: w, height: h, dpr, scale } = view;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, w, h);

  const shake = reducedMotion ? 0 : state.shake;
  const shakeX = shake ? (Math.random() - 0.5) * shake * 14 : 0;
  const shakeY = shake ? (Math.random() - 0.5) * shake * 10 : 0;

  context.save();
  context.translate(shakeX, shakeY);
  drawSky(w, h);
  drawBackdrop(w, h);
  drawTerrain(w, h, scale);
  drawLandingGuides();
  drawStartGate();
  drawGates();
  drawFinishGate();
  drawParticles(scale);
  drawGhost(scale);
  drawBike(scale);
  drawFloaters();
  drawScrubBurst();
  context.restore();
}

function drawSky(w, h) {
  const theme = state.terrain.theme;
  const gradient = context.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(0.55, theme.skyMid);
  gradient.addColorStop(1, theme.skyLow);
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);

  const celestialX = w * 0.74;
  const celestialY = h * 0.22;
  const radius = Math.max(22, h * 0.045);

  if (theme.night) {
    context.save();
    for (let i = 0; i < 85; i += 1) {
      const x = (((i * 97.13 + 17) % 101) / 101) * w;
      const y = (((i * 57.71 + 11) % 53) / 53) * h * 0.52;
      const twinkle = reducedMotion
        ? 0.55
        : 0.28 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0012 + i * 1.7));
      context.globalAlpha = twinkle;
      context.fillStyle = '#fff4d9';
      context.fillRect(x, y, 1.5, 1.5);
    }
    context.restore();
  }

  const glow = context.createRadialGradient(celestialX, celestialY, 4, celestialX, celestialY, h * 0.32);
  if (theme.night) {
    glow.addColorStop(0, 'rgba(220, 232, 255, 0.5)');
    glow.addColorStop(0.25, 'rgba(160, 185, 255, 0.18)');
    glow.addColorStop(1, 'rgba(120, 140, 255, 0)');
  } else {
    glow.addColorStop(0, 'rgba(255, 246, 214, 0.95)');
    glow.addColorStop(0.22, 'rgba(255, 226, 150, 0.4)');
    glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  }
  context.fillStyle = glow;
  context.fillRect(0, 0, w, h);

  context.fillStyle = theme.sun;
  context.beginPath();
  context.arc(celestialX, celestialY, radius, 0, Math.PI * 2);
  context.fill();

  if (theme.night) {
    context.save();
    context.globalAlpha = 0.14;
    context.fillStyle = '#7d8eb7';
    context.beginPath();
    context.arc(celestialX - radius * 0.32, celestialY - radius * 0.24, radius * 0.18, 0, Math.PI * 2);
    context.arc(celestialX + radius * 0.26, celestialY + radius * 0.3, radius * 0.13, 0, Math.PI * 2);
    context.arc(celestialX + radius * 0.12, celestialY - radius * 0.42, radius * 0.09, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawBackdrop(w, h) {
  if (!backdrop) return;
  const theme = state.terrain.theme;
  const horizon = h * 0.63;
  const cloudTint = theme.night ? '185, 198, 255' : '255, 248, 231';
  const cloudAlpha = theme.night ? 0.35 : 0.75;

  backdrop.clouds.forEach((cloud) => {
    const x = ((cloud.x - state.camera.x * 0.06 - performance.now() * 0.002) % 900 + 900) % 900;
    context.fillStyle = `rgba(${cloudTint}, ${cloud.alpha * cloudAlpha})`;
    context.beginPath();
    context.ellipse((x / 900) * w, h * cloud.y, cloud.w * 0.72, cloud.h * 0.7, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(
      (x / 900) * w + cloud.w * 0.28,
      h * cloud.y - cloud.h * 0.35,
      cloud.w * 0.38,
      cloud.h * 0.55,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  });

  drawNeighborhood(backdrop.far, theme.far, 0.12, horizon - h * 0.08, w, h, 0.62, theme, false);
  drawNeighborhood(backdrop.near, theme.near, 0.28, horizon, w, h, 1, theme, true);

  const haze = context.createLinearGradient(0, horizon - h * 0.16, 0, h * 0.8);
  haze.addColorStop(0, 'rgba(255, 220, 190, 0)');
  haze.addColorStop(1, theme.haze);
  context.globalAlpha = 0.18;
  context.fillStyle = haze;
  context.fillRect(0, horizon - h * 0.16, w, h * 0.4);
  context.globalAlpha = 1;
}

function drawNeighborhood(shapes, color, factor, baseY, w, h, alpha, theme, detail) {
  context.save();
  context.globalAlpha = alpha;
  const tile = 900;
  const offset = ((state.camera.x * factor * 18) % tile + tile) % tile;
  for (let repeat = -1; repeat <= 2; repeat += 1) {
    for (const shape of shapes) {
      const x = ((shape.x - offset + repeat * tile) / tile) * w * 1.25;
      const width = (shape.width / tile) * w * 1.2;
      const height = shape.height * (h / 700);
      const bodyHeight = height * 0.62;
      const roofHeight = height * 0.38;
      const wallTop = baseY - bodyHeight;
      const peak = wallTop - roofHeight;
      if (x + width < -20 || x > w + 20) continue;

      context.fillStyle = color;
      context.fillRect(x, wallTop, width, bodyHeight + 2);

      context.beginPath();
      context.moveTo(x - width * 0.035, wallTop + 2);
      context.lineTo(x + width * 0.2, peak);
      context.lineTo(x + width * 0.8, peak);
      context.lineTo(x + width * 1.035, wallTop + 2);
      context.closePath();
      context.fill();

      if (!detail) continue;

      /* Chimney and cap on the nearer roofs. */
      if (shape.lip > 0.62) {
        const chimneyX = x + width * (0.58 + shape.lip * 0.22);
        const chimneyWidth = Math.max(3, width * 0.055);
        context.fillRect(chimneyX, peak - roofHeight * 0.38, chimneyWidth, roofHeight * 0.54);
        context.fillRect(
          chimneyX - chimneyWidth * 0.25,
          peak - roofHeight * 0.42,
          chimneyWidth * 1.5,
          Math.max(2, chimneyWidth * 0.28)
        );
      }

      /* Lit and dark windows across the nearest houses. */
      for (let c = 0; c < 3; c += 1) {
        const wx = x + width * (0.18 + c * 0.28);
        const wy = wallTop + bodyHeight * 0.26;
        const ww = Math.max(2.5, width * 0.075);
        const wh = Math.max(3, bodyHeight * 0.15);
        context.fillStyle = 'rgba(10, 5, 24, 0.4)';
        context.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        context.fillStyle = Math.round(wx + c * 3) % 4 === 0 ? theme.windowLit : theme.window;
        context.fillRect(wx, wy, ww, wh);
      }
    }
  }
  context.restore();
}

function visiblePointRange() {
  const points = state.terrain.points;
  const x0 = state.camera.x - view.viewW / 2 - 3;
  const x1 = state.camera.x + view.viewW / 2 + 3;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x <= x0) lo = mid;
    else hi = mid;
  }
  const start = Math.max(0, lo - 2);
  let end = start;
  while (end < points.length && points[end].x <= x1) end += 1;
  return { start, end: Math.min(points.length - 1, end + 1), x0, x1 };
}

function terrainPath(start, end) {
  context.beginPath();
  let first = true;
  for (let i = start; i <= end; i += 1) {
    const point = state.terrain.points[i];
    const screen = worldToScreen(point.x, point.y);
    if (first) {
      context.moveTo(screen.x, screen.y);
      first = false;
    } else {
      context.lineTo(screen.x, screen.y);
    }
  }
}

function drawTerrain(w, h, scale) {
  const theme = state.terrain.theme;
  const { start, end } = visiblePointRange();
  if (end <= start) return;

  const groundBottom = h + 60;

  /* The street canyon below the roofline. */
  terrainPath(start, end);
  const last = worldToScreen(state.terrain.points[end].x, state.terrain.points[end].y);
  context.lineTo(last.x, groundBottom);
  const first = worldToScreen(state.terrain.points[start].x, state.terrain.points[start].y);
  context.lineTo(first.x, groundBottom);
  context.closePath();
  const deep = context.createLinearGradient(0, h * 0.42, 0, h);
  deep.addColorStop(0, theme.wallDark);
  deep.addColorStop(0.55, '#1a1224');
  deep.addColorStop(1, '#0c0813');
  context.fillStyle = deep;
  context.fill();

  drawHouseWalls(start, end, scale, h, groundBottom);
  drawRoofDeck(start, end, scale);
  drawRoofDetails(start, end, scale);
}

function drawHouseWalls(start, end, scale, h, groundBottom) {
  const theme = state.terrain.theme;
  const leftEdge = state.terrain.points[start].x - 4;
  const rightEdge = state.terrain.points[end].x + 4;
  const panel = 12.5;
  const gap = 1.7;
  const stride = panel + gap;
  const firstPanel = Math.floor(leftEdge / stride) * stride;

  for (let px = firstPanel; px < rightEdge; px += stride) {
    const panelLeft = px;
    const panelRight = px + panel;
    if (panelRight < leftEdge || panelLeft > rightEdge) continue;
    const index = Math.round(px / stride);
    const hash = Math.abs(Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
    const pLeft = worldToScreen(panelLeft, state.terrain.surfaceAt(panelLeft));
    const pRight = worldToScreen(panelRight, state.terrain.surfaceAt(panelRight));
    if (pRight.x < -40 || pLeft.x > view.width + 40) continue;

    /* Clip the facade to the silhouette under this section of roof. */
    context.beginPath();
    const steps = Math.max(4, Math.ceil(panel / 1.1));
    for (let i = 0; i <= steps; i += 1) {
      const wx = panelLeft + (panel * i) / steps;
      const s = worldToScreen(wx, state.terrain.surfaceAt(wx));
      if (i === 0) context.moveTo(s.x, s.y);
      else context.lineTo(s.x, s.y);
    }
    const bottomRight = worldToScreen(panelRight, 0);
    const bottomLeft = worldToScreen(panelLeft, 0);
    context.lineTo(bottomRight.x, groundBottom);
    context.lineTo(bottomLeft.x, groundBottom);
    context.closePath();

    context.save();
    context.clip();

    const topScreen = Math.min(pLeft.y, pRight.y);
    const wall = context.createLinearGradient(0, topScreen, 0, h);
    wall.addColorStop(0, theme.wall);
    wall.addColorStop(0.28, theme.wall);
    wall.addColorStop(0.62, hash > 0.5 ? theme.wallDark : theme.wall);
    wall.addColorStop(1, '#120d18');
    context.fillStyle = wall;
    context.fillRect(pLeft.x - 2, topScreen - 4, pRight.x - pLeft.x + 4, h - topScreen + 8);

    /* Clapboard siding. */
    context.strokeStyle = 'rgba(255, 248, 231, 0.07)';
    context.lineWidth = 1;
    const sidingTop = Math.max(pLeft.y, pRight.y) + 0.55 * scale;
    for (let y = sidingTop; y < h; y += 0.4 * scale) {
      context.beginPath();
      context.moveTo(pLeft.x, y);
      context.lineTo(pRight.x, y);
      context.stroke();
    }

    /* A downspout at the right corner. */
    context.fillStyle = 'rgba(12, 7, 18, 0.55)';
    context.fillRect(pRight.x - 0.12 * scale, pRight.y, 0.16 * scale, h - pRight.y);
    context.fillStyle = 'rgba(255, 248, 231, 0.1)';
    context.fillRect(pRight.x - 0.04 * scale, pRight.y, 0.04 * scale, h - pRight.y);

    /* Windows, sills and a little lit glass. */
    const windows = [
      { f: 0.2, drop: 1.45, width: 0.72, height: 1.0, lit: hash > 0.42 },
      { f: 0.52, drop: 1.55, width: 0.84, height: 1.08, lit: hash < 0.32 },
      { f: 0.82, drop: 1.45, width: 0.7, height: 1.0, lit: hash > 0.68 },
    ];
    for (const win of windows) {
      const wx = panelLeft + panel * win.f;
      const s = worldToScreen(wx, state.terrain.surfaceAt(wx) - win.drop);
      const ww = win.width * scale;
      const wh = win.height * scale;
      context.fillStyle = 'rgba(10, 5, 24, 0.72)';
      context.fillRect(s.x - ww / 2 - 2, s.y - wh / 2 - 2, ww + 4, wh + 4);
      context.fillStyle = win.lit ? theme.windowLit : theme.window;
      context.fillRect(s.x - ww / 2, s.y - wh / 2, ww, wh);
      context.strokeStyle = 'rgba(10, 5, 24, 0.65)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(s.x, s.y - wh / 2);
      context.lineTo(s.x, s.y + wh / 2);
      context.moveTo(s.x - ww / 2, s.y);
      context.lineTo(s.x + ww / 2, s.y);
      context.stroke();
      context.fillStyle = theme.trim;
      context.fillRect(s.x - ww / 2 - 2, s.y + wh / 2, ww + 4, Math.max(1.5, 0.05 * scale));

      /* A striped awning over some of the middle windows. */
      if (win.f === 0.52 && hash > 0.38) {
        const awning = ww * 1.35;
        const top = s.y - wh / 2 - 3;
        context.fillStyle = theme.trim;
        context.beginPath();
        context.moveTo(s.x - awning / 2, top);
        context.lineTo(s.x + awning / 2, top);
        context.lineTo(s.x + awning / 2 - 2, top - 0.14 * scale);
        context.lineTo(s.x - awning / 2 + 2, top - 0.14 * scale);
        context.closePath();
        context.fill();
        context.strokeStyle = 'rgba(10, 5, 24, 0.28)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(s.x - awning / 4, top);
        context.lineTo(s.x - awning / 4, top - 0.13 * scale);
        context.moveTo(s.x + awning / 4, top);
        context.lineTo(s.x + awning / 4, top - 0.13 * scale);
        context.stroke();
      }
    }

    /* A gable vent on every third house. */
    if (index % 3 === 0) {
      const ex = panelLeft + panel * 0.5;
      const s = worldToScreen(ex, state.terrain.surfaceAt(ex) - 0.78);
      context.fillStyle = 'rgba(10, 5, 24, 0.45)';
      context.beginPath();
      context.moveTo(s.x - 0.18 * scale, s.y);
      context.lineTo(s.x + 0.18 * scale, s.y);
      context.lineTo(s.x, s.y - 0.26 * scale);
      context.closePath();
      context.fill();
    }

    context.restore();
  }
}

function drawRoofDeck(start, end, scale) {
  const theme = state.terrain.theme;
  const points = state.terrain.points;

  /* Fascia and eave shadow. */
  terrainPath(start, end);
  for (let i = end; i >= start; i -= 1) {
    const point = points[i];
    const screen = worldToScreen(point.x, point.y);
    context.lineTo(screen.x, screen.y + 0.72 * scale);
  }
  context.closePath();
  context.fillStyle = theme.roofDark;
  context.fill();

  /* Tiled roof deck. */
  terrainPath(start, end);
  for (let i = end; i >= start; i -= 1) {
    const point = points[i];
    const screen = worldToScreen(point.x, point.y);
    context.lineTo(screen.x, screen.y + 0.56 * scale);
  }
  context.closePath();
  context.fillStyle = theme.roof;
  context.fill();

  /* Ridge cap along the top. */
  terrainPath(start, end);
  for (let i = end; i >= start; i -= 1) {
    const point = points[i];
    const screen = worldToScreen(point.x, point.y);
    context.lineTo(screen.x, screen.y + 0.12 * scale);
  }
  context.closePath();
  context.fillStyle = theme.roofLine;
  context.fill();

  /* Staggered shingle courses. */
  context.save();
  context.strokeStyle = 'rgba(10, 5, 18, 0.24)';
  context.lineWidth = 1;
  for (let row = 0; row < 3; row += 1) {
    const drop = (0.2 + row * 0.14) * scale;
    context.beginPath();
    for (let i = start; i < end; i += 2) {
      const a = worldToScreen(points[i].x, points[i].y);
      const b = worldToScreen(points[i + 1].x, points[i + 1].y);
      const offset = ((i + row) % 4) * 0.14 * scale;
      context.moveTo(a.x + offset, a.y + drop);
      context.lineTo(b.x + offset, b.y + drop);
    }
    context.stroke();
  }
  context.restore();

  /* The dark line under the eaves. */
  context.beginPath();
  for (let i = start; i <= end; i += 1) {
    const point = points[i];
    const screen = worldToScreen(point.x, point.y);
    const y = screen.y + 0.56 * scale;
    if (i === start) context.moveTo(screen.x, y);
    else context.lineTo(screen.x, y);
  }
  context.strokeStyle = 'rgba(10, 5, 18, 0.5)';
  context.lineWidth = 2;
  context.stroke();
}

function drawRoofDetails(start, end, scale) {
  const theme = state.terrain.theme;
  const points = state.terrain.points;
  const x0 = points[start].x;
  const x1 = points[end].x;

  /* Every local peak is a ridge: jumps, gables and rollers all get a cap. */
  let ridgeIndex = 0;
  for (let i = start + 4; i < end - 4; i += 3) {
    const point = points[i];
    if (point.y <= points[i - 4].y + 0.14 || point.y <= points[i + 4].y + 0.14) continue;
    drawRoofRidge(point.x, point.y, scale);
    ridgeIndex += 1;
    if (ridgeIndex % 3 === 0) {
      const chimneyX = point.x - 0.5;
      drawChimney(chimneyX, state.terrain.surfaceAt(chimneyX), scale);
    }
    if (ridgeIndex % 5 === 0) drawAntenna(point.x, point.y, scale);
  }

  /* Flat skylights on the quiet roof sections. */
  let skylights = 0;
  for (let x = Math.ceil(x0 / 11) * 11; x < x1 && skylights < 3; x += 11) {
    const inFeature = state.terrain.features.some(
      (feature) => x > feature.lipX - 1.5 && x < feature.landingX + 1.5
    );
    if (inFeature) continue;
    drawSkylight(x, state.terrain.surfaceAt(x), state.terrain.angleAt(x), scale);
    skylights += 1;
  }

  /* A couple of roof vents. */
  let vents = 0;
  for (let x = Math.ceil(x0 / 17) * 17 + 5; x < x1 && vents < 2; x += 17) {
    const inFeature = state.terrain.features.some(
      (feature) => x > feature.lipX - 1 && x < feature.landingX + 1
    );
    if (inFeature) continue;
    drawRoofVent(x, state.terrain.surfaceAt(x), scale);
    vents += 1;
  }
}

function drawRoofRidge(x, y, scale) {
  const theme = state.terrain.theme;
  const screen = worldToScreen(x, y);
  const width = 1.2 * scale;
  context.save();
  context.strokeStyle = theme.roofLine;
  context.lineWidth = Math.max(3, 0.13 * scale);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(screen.x - width / 2, screen.y + 0.08 * scale);
  context.quadraticCurveTo(screen.x, screen.y - 0.1 * scale, screen.x + width / 2, screen.y + 0.08 * scale);
  context.stroke();

  context.strokeStyle = 'rgba(10, 5, 18, 0.25)';
  context.lineWidth = 1;
  for (let i = -2; i <= 2; i += 1) {
    const tx = screen.x + (i / 2) * (width / 2);
    context.beginPath();
    context.moveTo(tx, screen.y + 0.02 * scale);
    context.lineTo(tx, screen.y + 0.11 * scale);
    context.stroke();
  }
  context.restore();
}

function drawChimney(x, y, scale) {
  const theme = state.terrain.theme;
  const screen = worldToScreen(x, y);
  const width = 0.34 * scale;
  const height = 0.88 * scale;
  context.fillStyle = theme.roofDark;
  context.fillRect(screen.x - width / 2, screen.y - height, width, height + 0.06 * scale);
  context.fillStyle = 'rgba(255, 248, 231, 0.12)';
  context.fillRect(screen.x - width / 2, screen.y - height, width * 0.24, height);
  context.strokeStyle = 'rgba(255, 248, 231, 0.12)';
  context.lineWidth = 1;
  for (let yLine = screen.y - height + 0.18 * scale; yLine < screen.y - 0.04 * scale; yLine += 0.18 * scale) {
    context.beginPath();
    context.moveTo(screen.x - width / 2, yLine);
    context.lineTo(screen.x + width / 2, yLine);
    context.stroke();
  }
  context.fillStyle = theme.trim;
  context.fillRect(screen.x - width / 2 - 3, screen.y - height - 0.06 * scale, width + 6, Math.max(2, 0.1 * scale));
}

function drawAntenna(x, y, scale) {
  const screen = worldToScreen(x, y);
  const height = 1.05 * scale;
  context.save();
  context.strokeStyle = 'rgba(12, 7, 18, 0.8)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(screen.x, screen.y);
  context.lineTo(screen.x, screen.y - height);
  context.moveTo(screen.x - 0.16 * scale, screen.y - height * 0.72);
  context.lineTo(screen.x + 0.16 * scale, screen.y - height * 0.72);
  context.moveTo(screen.x - 0.24 * scale, screen.y - height * 0.88);
  context.lineTo(screen.x + 0.24 * scale, screen.y - height * 0.88);
  context.moveTo(screen.x, screen.y - height * 0.72);
  context.lineTo(screen.x - 0.08 * scale, screen.y - height * 0.42);
  context.stroke();
  context.restore();
}

function drawSkylight(x, y, angle, scale) {
  const theme = state.terrain.theme;
  const screen = worldToScreen(x, y);
  context.save();
  context.translate(screen.x, screen.y + 0.04 * scale);
  context.rotate(-angle);
  const width = 0.8 * scale;
  const height = 0.2 * scale;
  context.fillStyle = 'rgba(10, 5, 18, 0.55)';
  context.fillRect(-width / 2 - 2, 0, width + 4, height + 3);
  context.globalAlpha = 0.55;
  context.fillStyle = theme.windowLit;
  context.fillRect(-width / 2, 1, width, height);
  context.globalAlpha = 1;
  context.strokeStyle = theme.trim;
  context.lineWidth = Math.max(1, 0.03 * scale);
  context.strokeRect(-width / 2, 1, width, height);
  context.restore();
}

function drawRoofVent(x, y, scale) {
  const theme = state.terrain.theme;
  const screen = worldToScreen(x, y);
  const width = 0.22 * scale;
  const height = 0.3 * scale;
  context.fillStyle = 'rgba(10, 5, 18, 0.45)';
  context.fillRect(screen.x - width / 2, screen.y - height, width, height);
  context.fillStyle = theme.trim;
  context.fillRect(screen.x - width / 2 - 1, screen.y - height - 2, width + 2, 3);
  context.strokeStyle = 'rgba(10, 5, 18, 0.4)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(screen.x, screen.y - height);
  context.lineTo(screen.x, screen.y);
  context.stroke();
}

function drawStartGate() {
  const x = state.terrain.startX - 5;
  const screen = worldToScreen(x, state.terrain.surfaceAt(x));
  if (screen.x < -180 || screen.x > view.width + 180) return;
  const poleHeight = 3.4 * view.scale;
  const left = screen.x - 1.9 * view.scale;
  const right = screen.x + 1.9 * view.scale;

  context.strokeStyle = '#2b1b2e';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(left, screen.y);
  context.lineTo(left, screen.y - poleHeight);
  context.moveTo(right, screen.y);
  context.lineTo(right, screen.y - poleHeight);
  context.stroke();

  context.fillStyle = '#ffd93d';
  context.fillRect(left, screen.y - poleHeight, right - left, 0.5 * view.scale);
  context.fillStyle = '#160d1e';
  context.font = `700 ${Math.round(clamp(view.scale * 0.26, 8, 13))}px Inter, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('ROOF RIDER', screen.x, screen.y - poleHeight + 0.25 * view.scale);
}

function drawLandingGuides() {
  const bike = state.bike;
  if (!bike) return;
  const features = state.terrain.features;
  for (const feature of features) {
    const distance = feature.landingX - bike.x;
    if (distance < -6 || distance > 55) continue;
    const isRhythm = Boolean(feature.section);
    if (!isRhythm && distance > 30) continue;

    context.beginPath();
    for (let step = 0; step <= 12; step += 1) {
      const x = feature.landingX + (step / 12) * 4.2;
      const y = state.terrain.surfaceAt(x) + 0.16;
      const screen = worldToScreen(x, y);
      if (step === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    }
    context.setLineDash([6, 6]);
    context.lineWidth = isRhythm ? 3 : 2;
    context.strokeStyle = feature.sequence ? 'rgba(61, 220, 132, 0.7)' : 'rgba(61, 220, 132, 0.35)';
    context.stroke();
    context.setLineDash([]);

    if (isRhythm) {
      const marker = worldToScreen(feature.landingX + 2.1, state.terrain.surfaceAt(feature.landingX + 2.1) + 0.85);
      context.fillStyle = 'rgba(61, 220, 132, 0.85)';
      context.beginPath();
      context.moveTo(marker.x - 5, marker.y - 5);
      context.lineTo(marker.x + 5, marker.y - 5);
      context.lineTo(marker.x, marker.y + 3);
      context.closePath();
      context.fill();
    }
  }
}

function drawGates() {
  for (const section of state.terrain.sections) {
    const screen = worldToScreen(section.x, state.terrain.surfaceAt(section.x));
    if (screen.x < -120 || screen.x > view.width + 120) continue;
    const poleHeight = 3.4 * view.scale;
    const left = screen.x - 1.15 * view.scale;
    const right = screen.x + 1.15 * view.scale;

    context.strokeStyle = '#2b1b2e';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(left, screen.y);
    context.lineTo(left, screen.y - poleHeight);
    context.moveTo(right, screen.y);
    context.lineTo(right, screen.y - poleHeight);
    context.stroke();

    context.fillStyle = '#ffd93d';
    context.fillRect(left - 2, screen.y - poleHeight, right - left + 4, 0.58 * view.scale);
    context.strokeStyle = '#2b1b2e';
    context.lineWidth = 2;
    context.strokeRect(left - 2, screen.y - poleHeight, right - left + 4, 0.58 * view.scale);

    context.fillStyle = '#160d1e';
    context.font = `700 ${Math.round(clamp(view.scale * 0.29, 9, 14))}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(section.name, screen.x, screen.y - poleHeight + 0.29 * view.scale);

    context.fillStyle = '#ff2e63';
    context.beginPath();
    context.moveTo(right, screen.y - poleHeight + 0.64 * view.scale);
    context.lineTo(right + 0.7 * view.scale, screen.y - poleHeight + 0.9 * view.scale);
    context.lineTo(right, screen.y - poleHeight + 1.16 * view.scale);
    context.closePath();
    context.fill();
  }

  /* Numbered takeoff flags inside rhythm sections. */
  for (const feature of state.terrain.features) {
    if (!feature.sequence) continue;
    const screen = worldToScreen(feature.lipX, feature.lipY);
    if (screen.x < -40 || screen.x > view.width + 40) continue;
    const pole = 1.6 * view.scale;
    context.strokeStyle = 'rgba(22, 13, 30, 0.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(screen.x, screen.y);
    context.lineTo(screen.x, screen.y - pole);
    context.stroke();

    context.fillStyle = 'rgba(22, 13, 30, 0.78)';
    context.beginPath();
    context.arc(screen.x, screen.y - pole - 8, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd93d';
    context.font = '700 11px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(feature.sequence), screen.x, screen.y - pole - 7);
  }
}

function drawFinishGate() {
  const terrain = state.terrain;
  const x = terrain.finishX;
  const screen = worldToScreen(x, terrain.surfaceAt(x));
  if (screen.x < -160 || screen.x > view.width + 160) return;
  const poleHeight = 3.7 * view.scale;
  const left = screen.x - 2.1 * view.scale;
  const right = screen.x + 2.1 * view.scale;

  context.strokeStyle = '#241428';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(left, screen.y);
  context.lineTo(left, screen.y - poleHeight);
  context.moveTo(right, screen.y);
  context.lineTo(right, screen.y - poleHeight);
  context.stroke();

  context.fillStyle = '#fff8e7';
  context.fillRect(left, screen.y - poleHeight, right - left, 0.62 * view.scale);
  const square = 0.31 * view.scale;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if ((row + col) % 2 === 0) {
        context.fillStyle = '#160d1e';
        context.fillRect(left + col * square, screen.y - poleHeight + row * square, square, square);
      }
    }
  }

  context.fillStyle = '#160d1e';
  context.font = `700 ${Math.round(clamp(view.scale * 0.34, 10, 16))}px Inter, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('FINISH', screen.x, screen.y - 0.85 * view.scale);
}

function drawParticles(scale) {
  const theme = state.terrain.theme;
  for (const p of state.particles) {
    const screen = worldToScreen(p.x, p.y);
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    if (screen.x < -20 || screen.x > view.width + 20) continue;
    context.globalAlpha = alpha * 0.4;
    context.fillStyle = p.color || theme.roofLine;
    context.beginPath();
    context.arc(screen.x, screen.y, Math.max(0.7, p.size * scale), 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawFloaters() {
  for (const floater of state.floaters) {
    const screen = worldToScreen(floater.x, floater.y);
    const alpha = clamp(floater.life / floater.maxLife, 0, 1);
    if (screen.x < -80 || screen.x > view.width + 80) continue;
    context.globalAlpha = Math.min(1, alpha * 2);
    context.fillStyle = floater.color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `900 italic ${Math.round(16 * floater.scale)}px Inter, system-ui, sans-serif`;
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(10, 5, 24, 0.8)';
    context.strokeText(floater.text, screen.x, screen.y);
    context.fillText(floater.text, screen.x, screen.y);
  }
  context.globalAlpha = 1;
}

function drawScrubBurst() {
  const bike = state.bike;
  if (!bike || !bike.scrubbing || reducedMotion) return;
  const screen = worldToScreen(bike.x, bike.y);
  context.strokeStyle = 'rgba(46, 196, 255, 0.4)';
  context.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const offset = (performance.now() * 0.08 + i * 22) % 70;
    context.beginPath();
    context.moveTo(screen.x - offset - 20, screen.y - 12 + i * 12);
    context.lineTo(screen.x - offset - 6, screen.y - 16 + i * 12);
    context.stroke();
  }
}

/* ------------------------------------------------------------------ bike art */

function drawGhost(scale) {
  if (!state.ghost || state.phase === 'menu' || state.phase === 'finished') return;
  const pose = ghostPose(state.ghost, state.time);
  if (!pose) return;
  const screen = worldToScreen(pose.x, pose.y);
  if (screen.x < -100 || screen.x > view.width + 100) return;

  /* A soft blue pool under the faded bike says "this one is not yours". */
  context.save();
  context.globalAlpha = 0.12;
  context.fillStyle = '#2ec4ff';
  context.beginPath();
  context.ellipse(screen.x, screen.y, 1.15 * scale, 0.9 * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawBikeSprite(
    {
      x: pose.x,
      y: pose.y,
      angle: pose.angle,
      rearComp: pose.rearComp,
      frontComp: pose.frontComp,
      crank: pose.crank,
      scrubbing: pose.scrubbing,
    },
    scale,
    { opacity: 0.42, load: false, ghost: true }
  );

  const label = worldToScreen(pose.x, pose.y + 1.42);
  const text = 'BEST';
  context.save();
  context.font = `700 ${Math.round(clamp(scale * 0.24, 8, 12))}px Inter, system-ui, sans-serif`;
  const width = context.measureText(text).width + 12;
  const height = 15;
  context.fillStyle = 'rgba(10, 5, 24, 0.78)';
  context.fillRect(label.x - width / 2, label.y - height / 2, width, height);
  context.strokeStyle = 'rgba(46, 196, 255, 0.7)';
  context.lineWidth = 1;
  context.strokeRect(label.x - width / 2, label.y - height / 2, width, height);
  context.fillStyle = '#8fe3ff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, label.x, label.y + 0.5);
  context.restore();
}

const WHEEL_RADIUS = PHYS.wheelRadius;

function drawBike(scale) {
  if (!state.bike) return;
  drawBikeSprite(state.bike, scale, {
    opacity: 1,
    load: state.bike.grounded && input.load,
  });
}

function drawBikeSprite(bike, scale, { opacity = 1, load = false, ghost = false } = {}) {
  if (!bike) return;
  const screen = worldToScreen(bike.x, bike.y);

  /* Shadow. */
  const ground = worldToScreen(bike.x, state.terrain.surfaceAt(bike.x));
  const height = Math.max(0, bike.y - state.terrain.surfaceAt(bike.x));
  const shadowScale = clamp(1 - height / 9, 0.3, 1);
  context.globalAlpha = (ghost ? 0.08 : 0.2) * opacity;
  context.fillStyle = '#1a0d12';
  context.beginPath();
  context.ellipse(ground.x, ground.y, 1.05 * scale * shadowScale, 0.2 * scale * shadowScale, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const rearLen = PHYS.suspMax - (bike.rearComp || 0);
  const frontLen = PHYS.suspMax - (bike.frontComp || 0);
  const rearY = -0.08 - rearLen;
  const frontY = -0.08 - frontLen;
  const spin = -(bike.crank || 0) / WHEEL_RADIUS;

  context.save();
  context.translate(screen.x, screen.y);
  context.rotate(-bike.angle);
  context.scale(scale, -scale);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.globalAlpha = opacity;

  const accent = '#ff2e63';
  const accentDark = '#b5183f';
  const frame = '#241a2e';
  const steel = '#a9b4c1';
  const cream = '#fff8e7';
  const yellow = '#ffd93d';
  const ink = '#120a1c';

  /* Rear wheel. */
  drawWheel(-0.73, rearY, spin, frame, steel, ink, cream);
  /* Front wheel. */
  drawWheel(0.73, frontY, spin, frame, steel, ink, cream);

  /* Swingarm and fork. */
  context.strokeStyle = steel;
  context.lineWidth = 0.055;
  context.beginPath();
  context.moveTo(-0.18, -0.2);
  context.lineTo(-0.73, rearY);
  context.stroke();

  context.strokeStyle = '#d9d2c4';
  context.lineWidth = 0.07;
  context.beginPath();
  context.moveTo(0.48, 0.08);
  context.lineTo(0.73, frontY);
  context.stroke();

  /* Rear fender. */
  context.strokeStyle = accentDark;
  context.lineWidth = 0.075;
  context.beginPath();
  context.moveTo(-0.62, 0.18);
  context.quadraticCurveTo(-0.9, 0.22, -0.98, 0.02);
  context.stroke();

  /* Engine. */
  context.fillStyle = '#1c1822';
  context.beginPath();
  context.moveTo(-0.25, -0.24);
  context.lineTo(0.16, -0.28);
  context.lineTo(0.24, 0.02);
  context.lineTo(-0.16, 0.1);
  context.closePath();
  context.fill();

  /* Frame. */
  context.fillStyle = accent;
  context.beginPath();
  context.moveTo(-0.42, 0.1);
  context.lineTo(0.08, 0.34);
  context.lineTo(0.46, 0.26);
  context.lineTo(0.4, 0.02);
  context.lineTo(-0.02, -0.08);
  context.lineTo(-0.38, -0.04);
  context.closePath();
  context.fill();

  /* Tank and seat. */
  context.fillStyle = accent;
  context.beginPath();
  context.moveTo(-0.04, 0.36);
  context.quadraticCurveTo(0.28, 0.5, 0.44, 0.35);
  context.lineTo(0.42, 0.2);
  context.lineTo(-0.02, 0.26);
  context.closePath();
  context.fill();

  context.fillStyle = '#17121f';
  context.beginPath();
  context.moveTo(-0.66, 0.35);
  context.quadraticCurveTo(-0.24, 0.44, 0.0, 0.34);
  context.lineTo(-0.18, 0.22);
  context.lineTo(-0.62, 0.26);
  context.closePath();
  context.fill();

  /* Number plate on the front. */
  context.fillStyle = cream;
  context.beginPath();
  context.moveTo(0.44, 0.38);
  context.lineTo(0.64, 0.42);
  context.lineTo(0.66, 0.2);
  context.lineTo(0.46, 0.18);
  context.closePath();
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = 0.02;
  context.stroke();

  /* Front fender. */
  context.strokeStyle = accent;
  context.lineWidth = 0.085;
  context.beginPath();
  context.moveTo(0.5, 0.16);
  context.quadraticCurveTo(0.82, 0.24, 0.98, 0.08);
  context.stroke();

  /* Handlebar. */
  context.strokeStyle = steel;
  context.lineWidth = 0.04;
  context.beginPath();
  context.moveTo(0.36, 0.47);
  context.lineTo(0.55, 0.55);
  context.lineTo(0.54, 0.62);
  context.stroke();

  /* Exhaust. */
  context.strokeStyle = '#8a7a6c';
  context.lineWidth = 0.055;
  context.beginPath();
  context.moveTo(0.02, -0.16);
  context.quadraticCurveTo(-0.4, -0.1, -0.72, 0.12);
  context.stroke();

  drawRider(bike, cream, accent, yellow, ink, load);

  context.restore();
}

function drawWheel(x, y, spin, frame, steel, ink, cream) {
  context.save();
  context.translate(x, y);
  context.rotate(-spin);

  context.fillStyle = ink;
  context.beginPath();
  context.arc(0, 0, WHEEL_RADIUS, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#3a3342';
  context.lineWidth = 0.055;
  context.beginPath();
  context.arc(0, 0, WHEEL_RADIUS - 0.03, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = steel;
  context.lineWidth = 0.02;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(angle) * (WHEEL_RADIUS - 0.06), Math.sin(angle) * (WHEEL_RADIUS - 0.06));
    context.stroke();
  }

  context.fillStyle = cream;
  context.beginPath();
  context.arc(0, 0, 0.055, 0, Math.PI * 2);
  context.fill();

  /* Knobby tire ticks. */
  context.strokeStyle = '#0c0912';
  context.lineWidth = 0.045;
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    context.beginPath();
    context.moveTo(Math.cos(angle) * (WHEEL_RADIUS - 0.04), Math.sin(angle) * (WHEEL_RADIUS - 0.04));
    context.lineTo(Math.cos(angle) * (WHEEL_RADIUS + 0.015), Math.sin(angle) * (WHEEL_RADIUS + 0.015));
    context.stroke();
  }

  context.restore();
}

function drawRider(bike, cream, accent, yellow, ink, load = false) {
  const crouch = load ? 0.07 : 0;
  const scrub = bike.scrubbing ? 1 : 0;
  const hipX = -0.12 + scrub * 0.06;
  const hipY = 0.48 - crouch - scrub * 0.06;
  const shoulderX = 0.06 + scrub * 0.12;
  const shoulderY = 0.82 - crouch - scrub * 0.16;
  const headX = 0.13 + scrub * 0.16;
  const headY = shoulderY + 0.19 - scrub * 0.05;

  /* Legs. */
  context.strokeStyle = '#1d1a2c';
  context.lineWidth = 0.16;
  context.beginPath();
  context.moveTo(hipX - 0.02, hipY);
  context.lineTo(-0.12, 0.16);
  context.lineTo(-0.16, -0.02);
  context.stroke();

  context.strokeStyle = '#3d3355';
  context.lineWidth = 0.13;
  context.beginPath();
  context.moveTo(hipX + 0.06, hipY + 0.01);
  context.lineTo(0.12, 0.2);
  context.lineTo(0.1, 0.03);
  context.stroke();

  /* Boots. */
  context.strokeStyle = ink;
  context.lineWidth = 0.11;
  context.beginPath();
  context.moveTo(-0.2, -0.02);
  context.lineTo(-0.1, -0.02);
  context.moveTo(0.06, 0.02);
  context.lineTo(0.18, 0.02);
  context.stroke();

  /* Jersey. */
  context.fillStyle = accent;
  context.beginPath();
  context.moveTo(hipX - 0.12, hipY + 0.05);
  context.lineTo(shoulderX - 0.12, shoulderY + 0.02);
  context.quadraticCurveTo(shoulderX + 0.02, shoulderY + 0.12, shoulderX + 0.12, shoulderY - 0.02);
  context.lineTo(hipX + 0.12, hipY - 0.02);
  context.closePath();
  context.fill();

  context.strokeStyle = cream;
  context.lineWidth = 0.035;
  context.beginPath();
  context.moveTo(hipX - 0.1, hipY + 0.02);
  context.lineTo(shoulderX + 0.04, shoulderY + 0.02);
  context.stroke();

  /* Arms. */
  context.strokeStyle = accent;
  context.lineWidth = 0.11;
  context.beginPath();
  context.moveTo(shoulderX - 0.03, shoulderY);
  context.lineTo(0.3, 0.55);
  context.lineTo(0.46, 0.58);
  context.stroke();

  context.strokeStyle = '#c41b4d';
  context.lineWidth = 0.095;
  context.beginPath();
  context.moveTo(shoulderX + 0.06, shoulderY - 0.02);
  context.lineTo(0.42, 0.48);
  context.stroke();

  /* Helmet. */
  context.fillStyle = yellow;
  context.beginPath();
  context.arc(headX, headY, 0.155, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = 0.025;
  context.stroke();

  /* Visor and goggles. */
  context.fillStyle = ink;
  context.beginPath();
  context.moveTo(headX + 0.06, headY + 0.01);
  context.lineTo(headX + 0.22, headY + 0.04);
  context.lineTo(headX + 0.05, headY + 0.11);
  context.closePath();
  context.fill();

  context.fillStyle = '#2ec4ff';
  context.beginPath();
  context.ellipse(headX + 0.09, headY + 0.04, 0.065, 0.035, -0.1, 0, Math.PI * 2);
  context.fill();

  /* Number bib. */
  context.fillStyle = cream;
  context.beginPath();
  context.rect(hipX - 0.04, hipY + 0.12, 0.16, 0.12);
  context.fill();
}

/* ------------------------------------------------------------------ misc UI */

function bindUi() {
  els.startButton?.addEventListener('click', startRun);
  els.againButton?.addEventListener('click', startRun);
  els.nextButton?.addEventListener('click', nextTrack);
  els.restartButton?.addEventListener('click', () => {
    if (state.phase === 'menu') return;
    startRun();
  });

  els.muteButton?.addEventListener('click', () => {
    const next = !audio.isMuted();
    audio.setMuted(next);
    writeMuted(next);
    state.muted = next;
    els.muteButton.textContent = next ? '🔇' : '🔊';
    els.muteButton.setAttribute('aria-pressed', String(next));
    els.muteButton.setAttribute('aria-label', next ? 'Turn sound on' : 'Mute sound');
  });

  els.fullscreenButton?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await container.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (error) {
      /* Fullscreen may be blocked; the game still plays. */
    }
  });

  document.addEventListener('fullscreenchange', () => {
    els.fullscreenButton?.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
    setTimeout(resize, 60);
  });

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
  }

  document.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => audio.stop());
  });
}

function setupPause() {
  autoPause = createAutoPause({
    container,
    shouldPause: () => state.phase === 'riding' || state.phase === 'countdown' || state.phase === 'crashed',
    audio,
    muteButton: els.muteButton,
    button: els.pauseButton,
    keys: ['KeyP', 'Escape'],
    onPause: () => {
      audio.stop();
      state.keys.clear();
    },
    onResume: () => {
      if (state.phase !== 'menu' && state.phase !== 'finished') audio.start();
    },
    message: 'Paused',
  });
}

function frame(now) {
  try {
    const delta = Math.min(0.08, (now - lastFrame) / 1000);
    lastFrame = now;
    if (autoPause?.paused) {
      render();
    } else {
      update(delta);
      render();
    }
  } catch (error) {
    /* Keep the next frame scheduled so a bad frame cannot freeze the game. */
    console.error('Roof Rider frame error', error);
  }
  requestAnimationFrame(frame);
}

function init() {
  if (!canvas || !context) {
    if (els.fallback) els.fallback.hidden = false;
    return;
  }

  state.bestTimes = readBestTimes();
  state.ghosts = loadGhosts(getStorage(), tracks.map((track) => track.id));
  state.bestScore = getBest(GAME_ID);
  state.muted = readMuted('roofRiderMuted');
  audio.setMuted(state.muted);
  if (els.muteButton) {
    els.muteButton.textContent = state.muted ? '🔇' : '🔊';
    els.muteButton.setAttribute('aria-pressed', String(state.muted));
  }

  renderTrackPicker();
  selectTrack(DEFAULT_TRACK_ID);
  resize();
  bindInput();
  bindUi();
  setupPause();

  state.phase = 'menu';
  els.startOverlay?.classList.add('is-open');
  updateStartSummary();
  updateHud();
  requestAnimationFrame((now) => {
    lastFrame = now;
    frame(now);
  });
}

init();
