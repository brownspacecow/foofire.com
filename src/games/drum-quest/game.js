/* -------------------------------------------------------------------------
 * Drum Quest — Free Play and Learn with Jack.
 *
 * Free Play: bash the kit. Every drum sounds instantly, from a tap on the
 * 3D drum or on one of the six big pads under the stage. A count-in with a
 * tempo control is there if you want it.
 *
 * Learn with Jack: no clock, no failing, no clock watching. Jack counts in,
 * plays a real groove one step at a time, and then waits — the kit and the
 * matching pads glow, and the player copies the steps at their own pace.
 * Wrong drum? It still makes its sound, gives a friendly nudge, and nothing
 * is lost. Finish the groove and Jack cheers; three stars for a clean run.
 *
 * The pads are the primary controls on purpose: the 3D stage is loaded
 * dynamically, so if WebGL or the Three.js module can't load, the whole
 * game still works.
 * ---------------------------------------------------------------------- */

import {
  DRUMS,
  LESSON_COUNT,
  checkStepTap,
  drumById,
  drumByKey,
  lessonName,
  lessonPattern,
  lessonStars,
  lessonStepMs,
  lessonTempo,
  lessonTip,
  starString,
  stepIsDone,
  stepLabel,
} from './logic.js';
import { DrumSynth } from './sound.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

const GAME_ID = 'drum-quest';
const PROGRESS_KEY = 'dq-progress.v1';
const FREE_START_BPM = 80;
const FREE_MIN_BPM = 50;
const FREE_MAX_BPM = 150;
const FREE_BPM_STEP = 5;
const FREE_MESSAGE = 'Tap a drum — on the kit or the big pads. Every tap makes a sound.';

const $ = (id) => document.getElementById(id);
const synth = new DrumSynth();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  stage: $('stage'),
  banner: $('stage-banner'),
  pads: $('pads'),
  celebrate: $('celebrate'),
  celebrateStars: $('celebrate-stars'),
  celebrateTitle: $('celebrate-title'),
  celebrateText: $('celebrate-text'),
  nextLesson: $('next-lesson'),
  againLesson: $('again-lesson'),
  message: $('message'),
  best: $('best-line'),
  deckFree: $('deck-free'),
  deckLearn: $('deck-learn'),
  level: $('lesson-level'),
  name: $('lesson-name'),
  stars: $('lesson-stars'),
  replay: $('lesson-replay'),
  rail: $('lesson-rail'),
  target: $('lesson-target'),
  levels: $('lesson-levels'),
  metronome: $('metronome-button'),
  beatLights: $('beat-lights'),
  tempoValue: $('tempo-value'),
  tempoDown: $('tempo-down'),
  tempoUp: $('tempo-up'),
  mute: $('mute-button'),
  fullscreen: $('fullscreen-button'),
  console: $('dq-console'),
};

let stage = null;
let mode = null;

/* ---------------------------------------------------------------- progress */

const clampLevel = (level) => Math.min(99, Math.max(1, Math.floor(Number(level)) || 1));

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '{}');
    const stars = {};
    if (parsed && typeof parsed.stars === 'object' && parsed.stars) {
      for (const [key, value] of Object.entries(parsed.stars)) {
        const level = clampLevel(key);
        const count = Math.min(3, Math.max(1, Math.floor(Number(value)) || 0));
        if (count) stars[level] = count;
      }
    }
    return { level: clampLevel(parsed && parsed.level), stars };
  } catch (error) {
    return { level: 1, stars: {} };
  }
}

const progress = loadProgress();

function saveProgress() {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    /* Storage can be blocked; the game still plays, it just forgets stars. */
  }
}

const bestStars = (level) => Number(progress.stars[clampLevel(level)]) || 0;

/* --------------------------------------------------------------------- pads */

const pads = new Map();
const padTimers = new Map();

function buildPads() {
  for (const drum of DRUMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dq-pad';
    button.dataset.drum = drum.id;
    button.style.setProperty('--pad', drum.color);
    button.setAttribute('aria-label', `${drum.label} — keyboard ${drum.key.toUpperCase()}`);

    const key = document.createElement('span');
    key.className = 'dq-pad-key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = drum.key.toUpperCase();

    const name = document.createElement('span');
    name.className = 'dq-pad-name';
    name.textContent = drum.label;

    button.append(key, name);
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      hit(drum.id);
    });
    // Keyboard activation (Enter / Space on a focused pad) arrives as a
    // click with detail 0. Pointer clicks are already handled above.
    button.addEventListener('click', (event) => {
      if (event.detail === 0) hit(drum.id);
    });

    pads.set(drum.id, button);
    els.pads.appendChild(button);
  }
}

function flashPad(id) {
  const button = pads.get(id);
  if (!button) return;
  button.classList.add('is-hit');
  window.clearTimeout(padTimers.get(id));
  padTimers.set(
    id,
    window.setTimeout(() => button.classList.remove('is-hit'), 110),
  );
}

function shakePad(id) {
  const button = pads.get(id);
  if (!button) return;
  button.classList.remove('is-wrong');
  // Restart the animation even on a rapid repeat tap.
  void button.offsetWidth;
  button.classList.add('is-wrong');
  window.clearTimeout(padTimers.get(`wrong-${id}`));
  padTimers.set(
    `wrong-${id}`,
    window.setTimeout(() => button.classList.remove('is-wrong'), 260),
  );
}

function setPadHints(ids = []) {
  for (const [id, button] of pads) button.classList.toggle('is-hint', ids.includes(id));
}

/* --------------------------------------------------------------------- hits */

function hit(drumId) {
  synth.play(drumId).catch(() => undefined);
  stage?.hit(drumId);
  flashPad(drumId);
  if (mode === 'learn') handleLessonTap(drumId);
}

/* --------------------------------------------------------------- metronome */

let bpm = FREE_START_BPM;
const metro = { on: false, timer: 0, beat: 0 };

function renderBeatLights() {
  const lights = Array.from(els.beatLights.children);
  lights.forEach((light, index) => {
    light.classList.toggle('is-on', metro.on && index === metro.beat - 1);
    light.classList.toggle('is-accent', index === 0);
  });
  els.beatLights.setAttribute(
    'aria-label',
    metro.on ? `Count is on, beat ${metro.beat} of 4` : 'Count is off',
  );
}

function metronomeTick() {
  metro.beat = (metro.beat % 4) + 1;
  renderBeatLights();
  synth.click(metro.beat === 1).catch(() => undefined);
}

function scheduleMetronome() {
  if (metro.timer) window.clearInterval(metro.timer);
  metro.timer = window.setInterval(metronomeTick, Math.round(60000 / bpm));
}

function stopMetronome() {
  if (metro.timer) window.clearInterval(metro.timer);
  metro.timer = 0;
  metro.on = false;
  metro.beat = 0;
  els.metronome.textContent = 'Start the count';
  els.metronome.setAttribute('aria-pressed', 'false');
  renderBeatLights();
}

els.metronome.addEventListener('click', () => {
  if (metro.on) {
    stopMetronome();
    return;
  }
  metro.on = true;
  metro.beat = 0;
  els.metronome.textContent = 'Stop the count';
  els.metronome.setAttribute('aria-pressed', 'true');
  metronomeTick();
  scheduleMetronome();
});

function setBpm(next) {
  bpm = Math.min(FREE_MAX_BPM, Math.max(FREE_MIN_BPM, Math.round(next)));
  els.tempoValue.textContent = String(bpm);
  if (metro.on) {
    metro.beat = 0;
    scheduleMetronome();
  }
}

els.tempoDown.addEventListener('click', () => setBpm(bpm - FREE_BPM_STEP));
els.tempoUp.addEventListener('click', () => setBpm(bpm + FREE_BPM_STEP));

/* ------------------------------------------------------------------ banner */

function showBanner(text, tone = 'jack') {
  els.banner.textContent = text;
  els.banner.classList.toggle('is-you', tone === 'you');
  els.banner.hidden = false;
}

function hideBanner() {
  els.banner.hidden = true;
}

function setMessage(text) {
  els.message.textContent = text;
}

/* ------------------------------------------------------------------ lesson */

const session = {
  level: clampLevel(progress.level),
  pattern: [],
  index: 0,
  hits: [],
  mistakes: 0,
  phase: 'idle', // idle | demo | play | done
  token: 0,
};

const waiters = new Map();

function wait(ms, token) {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      waiters.delete(id);
      resolve(token === session.token);
    }, ms);
    waiters.set(id, resolve);
  });
}

function cancelWaits() {
  for (const [id, resolve] of waiters) {
    window.clearTimeout(id);
    resolve(false);
  }
  waiters.clear();
}

function hideCelebration() {
  els.celebrate.hidden = true;
}

function stopSession() {
  cancelWaits();
  session.token += 1;
  session.phase = 'idle';
  stage?.clearHints();
  setPadHints([]);
  hideCelebration();
  hideBanner();
}

function renderLessonHeader() {
  els.level.textContent = String(session.level);
  els.name.textContent = lessonName(session.level);
  const stars = bestStars(session.level);
  els.stars.textContent = starString(stars);
  els.stars.setAttribute(
    'aria-label',
    stars ? `${stars} of 3 stars on this level` : 'No stars on this level yet',
  );
}

function renderRail() {
  els.rail.replaceChildren();
  session.pattern.forEach((step, index) => {
    const chip = document.createElement('div');
    chip.className = 'dq-step-chip';
    if (stepIsDone(step, session.hits[index])) chip.classList.add('is-done');
    if (index === session.index && session.phase !== 'idle' && session.phase !== 'done') {
      chip.classList.add('is-now');
    }
    for (const drumId of step) {
      const dot = document.createElement('span');
      dot.className = 'dq-dot';
      dot.style.setProperty('--c', (drumById(drumId) || {}).color || '#fff8e7');
      chip.appendChild(dot);
    }
    els.rail.appendChild(chip);
  });
}

function renderTarget() {
  els.target.replaceChildren();
  if (session.phase === 'play') {
    els.target.append('Now play: ');
    const step = session.pattern[session.index] || [];
    step.forEach((drumId, index) => {
      const drum = drumById(drumId);
      if (!drum) return;
      const chip = document.createElement('span');
      chip.className = 'dq-drum-chip';
      chip.style.setProperty('--c', drum.color);
      chip.textContent = drum.label;
      els.target.appendChild(chip);
      if (index < step.length - 1) els.target.append(' + ');
    });
    return;
  }
  if (session.phase === 'demo') {
    els.target.textContent = lessonTip(session.level);
    return;
  }
  if (session.phase === 'done') {
    els.target.textContent = 'Lesson complete — lovely drumming!';
    return;
  }
  els.target.textContent = 'Press “Play it again” to hear the beat.';
}

function renderLevels() {
  els.levels.replaceChildren();
  const count = Math.max(LESSON_COUNT, session.level);
  for (let level = 1; level <= count; level += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dq-level';
    button.textContent = String(level);
    button.title = lessonName(level);
    button.setAttribute('aria-label', `Lesson ${level}: ${lessonName(level)}`);
    if (level === session.level) button.classList.add('is-active');
    if (bestStars(level)) button.classList.add('is-done');
    button.addEventListener('click', () => beginLesson(level));
    els.levels.appendChild(button);
  }
}

function beginLesson(level) {
  stopSession();
  session.level = clampLevel(level);
  session.pattern = lessonPattern(session.level);
  session.index = 0;
  session.hits = session.pattern.map(() => []);
  session.mistakes = 0;
  session.phase = 'demo';
  renderLessonHeader();
  renderLevels();
  renderRail();
  renderTarget();
  void runDemo();
}

async function runDemo() {
  const token = session.token;
  showBanner('Listen first');

  const beatMs = Math.round(60000 / lessonTempo(session.level));
  const stepMs = lessonStepMs(session.level);

  for (let count = 1; count <= 4; count += 1) {
    if (token !== session.token) return;
    showBanner(`Count in: ${count}`);
    synth.click(count === 1).catch(() => undefined);
    const alive = await wait(beatMs, token);
    if (!alive) return;
  }

  showBanner('Jack is playing — listen');
  setMessage('Listen to the beat and watch the drums light up.');
  for (let index = 0; index < session.pattern.length; index += 1) {
    if (token !== session.token) return;
    session.index = index;
    renderRail();
    stage?.setHints(session.pattern[index]);
    for (const drumId of session.pattern[index]) {
      synth.play(drumId).catch(() => undefined);
      stage?.jackHit(drumId);
    }
    const alive = await wait(stepMs, token);
    if (!alive) return;
  }
  stage?.clearHints();
  if (token !== session.token) return;
  beginTurn();
}

function beginTurn() {
  session.phase = 'play';
  session.index = 0;
  const step = session.pattern[0];
  setPadHints(step);
  stage?.setHints(step);
  renderRail();
  renderTarget();
  showBanner(`Your turn: ${stepLabel(step)}`, 'you');
  setMessage(`Your turn! Play ${stepLabel(step)} — in any order you like.`);
}

function handleLessonTap(drumId) {
  if (session.phase !== 'play') return;
  const step = session.pattern[session.index];
  const hits = session.hits[session.index];
  const result = checkStepTap(step, hits, drumId);

  if (result === 'extra') {
    session.mistakes += 1;
    shakePad(drumId);
    const drum = drumById(drumId);
    setMessage(
      `${drum ? drum.label : 'That one'} sounds good! This step is ${stepLabel(step)} — play the glowing pads.`,
    );
    return;
  }

  const remaining = step.filter((id) => !hits.includes(id));
  setPadHints(remaining);
  stage?.setHints(remaining);
  synth.blip(session.index).catch(() => undefined);
  renderRail();

  if (result === 'correct') {
    setMessage(`Nice! Still needed: ${stepLabel(remaining)}.`);
    return;
  }

  if (session.index >= session.pattern.length - 1) {
    finishLesson();
    return;
  }

  session.index += 1;
  const next = session.pattern[session.index];
  setPadHints(next);
  stage?.setHints(next);
  renderRail();
  renderTarget();
  showBanner(`Your turn: ${stepLabel(next)}`, 'you');
  setMessage(`Yes! Next: ${stepLabel(next)}.`);
}

function finishLesson() {
  session.phase = 'done';
  stage?.clearHints();
  setPadHints([]);
  hideBanner();

  const level = session.level;
  const stars = lessonStars(session.mistakes);
  if (stars > bestStars(level)) progress.stars[level] = stars;
  progress.level = Math.max(progress.level, level + 1);
  saveProgress();
  submitScore(GAME_ID, level);
  updateBestLine();

  renderLessonHeader();
  renderLevels();
  renderTarget();
  renderRail();

  els.celebrateStars.textContent = starString(stars);
  els.celebrateTitle.textContent = stars === 3 ? 'Perfect!' : 'You did it!';
  els.celebrateText.textContent =
    stars === 3
      ? `Level ${level}, ${lessonName(level)} — clean all the way through. Jack is doing a little dance.`
      : `Level ${level}, ${lessonName(level)} — finished! ${session.mistakes} off-target ${
          session.mistakes === 1 ? 'tap' : 'taps'
        } is no problem at all.`;
  els.nextLesson.textContent = `Next: ${lessonName(level + 1)} →`;
  els.celebrate.hidden = false;

  setMessage(
    stars === 3
      ? 'Perfect drumming! Jack has never heard that beat played so cleanly.'
      : 'You did it! Every step of the beat, all the way through.',
  );
  synth.cheer().catch(() => undefined);
  stage?.celebrate();
}

els.nextLesson.addEventListener('click', () => beginLesson(session.level + 1));
els.againLesson.addEventListener('click', () => beginLesson(session.level));
els.replay.addEventListener('click', () => {
  if (mode === 'learn') beginLesson(session.level);
});

/* -------------------------------------------------------------------- modes */

function setMode(next) {
  if (mode === next) return;
  mode = next;
  for (const tab of document.querySelectorAll('.dq-tab')) {
    const active = tab.dataset.mode === next;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  }
  els.deckFree.hidden = next !== 'free';
  els.deckLearn.hidden = next !== 'learn';
  els.levels.hidden = next !== 'learn';

  if (next === 'free') {
    stopSession();
    stopMetronome();
    setMessage(FREE_MESSAGE);
    return;
  }
  stopMetronome();
  beginLesson(session.level);
}

for (const tab of document.querySelectorAll('.dq-tab')) {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
}

/* ------------------------------------------------------------------ best line */

function updateBestLine() {
  const best = getBest(GAME_ID);
  els.best.textContent =
    best > 0 ? `Best lesson so far: ${best} ⭐` : 'Your best lesson will show up here.';
}

/* ------------------------------------------------------------------ keyboard */

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  const drum = drumByKey(event.key);
  if (!drum) return;
  event.preventDefault();
  hit(drum.id);
});

/* -------------------------------------------------------------------- mute */

function applyMute(muted) {
  synth.setMuted(muted);
  els.mute.setAttribute('aria-pressed', String(muted));
  els.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

els.mute.addEventListener('click', () => {
  const muted = els.mute.getAttribute('aria-pressed') !== 'true';
  writeMuted(muted);
  applyMute(muted);
});

/* -------------------------------------------------------------- fullscreen */

function applyFullscreenState() {
  const on = Boolean(document.fullscreenElement);
  els.fullscreen.setAttribute('aria-pressed', String(on));
  els.fullscreen.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
  // The stage re-measures once it has its new size.
  window.setTimeout(() => stage?.resize(), 80);
}

if (!document.fullscreenEnabled) {
  els.fullscreen.hidden = true;
} else {
  els.fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await els.console.requestFullscreen();
    } catch (error) {
      /* Fullscreen is a nice-to-have; the game is the same without it. */
    }
  });
  document.addEventListener('fullscreenchange', applyFullscreenState);
}

/* -------------------------------------------------------------- the 3D stage
 * Loaded late and on its own: the game is fully playable on the pads if
 * this fails, so a missing WebGL context never takes the drums away.
 */

async function initStage() {
  try {
    const { createStage } = await import('./scene.js');
    stage = createStage(els.stage, { reducedMotion, onHit: hit });
  } catch (error) {
    console.warn('Drum Quest: the 3D stage could not start — pads only.', error);
    els.stage.classList.add('is-fallback');
    const fallback = document.createElement('div');
    fallback.className = 'dq-stage-fallback';
    const text = document.createElement('p');
    text.innerHTML = '<strong>The 3D kit could not load.</strong><br />Every drum still works on the pads below.';
    fallback.appendChild(text);
    els.stage.appendChild(fallback);
  }
}

/* --------------------------------------------------------------------- init */

buildPads();
renderLessonHeader();
renderLevels();
renderRail();
renderTarget();
updateBestLine();
applyMute(readMuted());
setMode('free');
initStage();
