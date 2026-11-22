/* -------------------------------------------------------------------------
 * Drum Quest — Free Play and Jack's Copy Cat, played on a 3D Three.js
 * drum kit (see scene.js). Tap a drum in 3D, or use keys A/S/D/F/G/H.
 *
 * Jack plays REAL beats: one bar of a groove, with drums landing
 * together the way a real beat does (kick + hi-hat, snare + hi-hat).
 * The flow never stops — Jack's bar runs straight into Joel's bar on
 * the next beat, a quiet hi-hat tick keeps the pulse alive while Joel
 * plays, and a miss means Jack takes the beat straight back on the
 * next beat. No count-in, no pauses, no failing.
 * ---------------------------------------------------------------------- */

import {
  checkCopyCatTap,
  copyCatBeatName,
  copyCatLength,
  copyCatStepMs,
  copyCatTempo,
  drumById,
  drumByKey,
  generatePattern,
  starsForAttempts,
  starString,
} from './logic.js';
import { DrumSynth } from './sound.js';
import { createStage } from './scene.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

const GAME_ID = 'drum-quest';
const METRONOME_BPM = 80;

const $ = (id) => document.getElementById(id);
const synth = new DrumSynth();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const messageEl = $('message');

const setMessage = (text) => {
  messageEl.textContent = text;
};

/* ---------------------------------------------------------------- 3D kit */

let mode = 'free';

async function hitDrum(drum) {
  stage.hit(drum);
  try {
    await synth.play(drum);
  } catch (error) {
    /* Audio needs a first tap on some browsers; the visual still shows. */
  }
}

/** A tap on a 3D drum (or a keyboard key): sound + Copy Cat handling. */
function userHit(drum) {
  hitDrum(drum);
  if (mode === 'copy') handleCopyTap(drum);
}

const stage = createStage($('stage'), {
  reducedMotion: prefersReducedMotion,
  onHit: userHit,
});

/* ------------------------------------------------------------------ modes */

function showMode(next) {
  stopMetronome();
  stopCopyPlayback();
  stage.clearGlow();
  mode = next;
  for (const button of document.querySelectorAll('.dq-mode')) {
    const active = button.dataset.mode === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const panel of ['free', 'copy']) {
    $(`panel-${panel}`).hidden = panel !== next;
  }
  if (next === 'free') setMessage('Tap a drum on the kit to make some noise!');
  if (next === 'copy') {
    // Jack starts his beat straight away — no pause, no count-in.
    if (copyCat.phase === 'idle') startJackBar();
  }
}

for (const button of document.querySelectorAll('.dq-mode')) {
  button.addEventListener('click', () => showMode(button.dataset.mode));
}

/* --------------------------------------------------------------- metronome */

let metronomeTimer = 0;
let metronomeBeat = 0;
const beatCountEl = $('beat-count');
const metronomeButton = $('metronome-button');

function stopMetronome() {
  if (metronomeTimer) window.clearInterval(metronomeTimer);
  metronomeTimer = 0;
  metronomeBeat = 0;
  beatCountEl.textContent = '–';
  metronomeButton.textContent = '▶ Count 1-2-3-4';
  metronomeButton.setAttribute('aria-pressed', 'false');
}

metronomeButton.addEventListener('click', async () => {
  if (metronomeTimer) {
    stopMetronome();
    return;
  }
  await synth.ensure().catch(() => undefined);
  metronomeButton.textContent = '■ Stop the count';
  metronomeButton.setAttribute('aria-pressed', 'true');
  const stepMs = Math.round(60000 / METRONOME_BPM);
  const tick = () => {
    metronomeBeat = (metronomeBeat % 4) + 1;
    beatCountEl.textContent = String(metronomeBeat);
    synth.click(metronomeBeat === 1).catch(() => undefined);
  };
  tick();
  metronomeTimer = window.setInterval(tick, stepMs);
});

/* ------------------------------------------------------- Copy Cat — Jack's lesson
 *
 * One bar, on a loop, forever. Jack plays the groove (watch), then the
 * very next beat is Joel's turn (play) — the pulse never stops. A quiet
 * hi-hat tick marks every beat of Joel's bar so the beat is always
 * there even if he hasn't tapped yet. If Joel misses, Jack takes the
 * beat straight back on the next beat. If Joel plays the whole bar,
 * Jack cheers and the next level's groove starts one beat later.
 */

const copyLevelEl = $('copy-level');
const copyStarsEl = $('copy-stars');
const copyInfoEl = $('copy-info');
const copyDotsEl = $('copy-dots');
const copyTurnEl = $('copy-turn');
const copyPlayButton = $('copy-play-button');
const copyAgainButton = $('copy-again-button');

const copyCat = {
  level: 1,
  pattern: [],
  phase: 'idle', // idle | watch (Jack plays) | play (Joel plays)
  step: 0,
  stepHits: [],
  doneSteps: 0,
  attempts: 0, // misses on the current level
  interval: 0,
  timeout: 0,
};

function stopCopyTimers() {
  if (copyCat.interval) window.clearInterval(copyCat.interval);
  if (copyCat.timeout) window.clearTimeout(copyCat.timeout);
  copyCat.interval = 0;
  copyCat.timeout = 0;
}

function stopCopyPlayback() {
  stopCopyTimers();
  copyCat.phase = 'idle';
  stage.setJackPlaying(false);
  stage.clearGlow();
  setTurn('idle');
}

/** Whose turn it is — colour only, the pill never moves or resizes. */
function setTurn(who) {
  copyTurnEl.classList.toggle('is-jack', who === 'jack');
  copyTurnEl.classList.toggle('is-you', who === 'you');
  copyTurnEl.textContent =
    who === 'jack'
      ? "🎓 Jack's turn — listen to the beat!"
      : who === 'you'
        ? "🥁 Your turn, Joel — play it back!"
        : '🎓 Jack is ready — pick a level and listen!';
}

function renderCopyDots() {
  copyDotsEl.innerHTML = '';
  for (let i = 0; i < copyCat.pattern.length; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'dq-dot';
    if (i < copyCat.doneSteps) dot.classList.add('is-done');
    if (i === copyCat.step && copyCat.phase !== 'idle') dot.classList.add('is-now');
    dot.setAttribute('aria-hidden', 'true');
    copyDotsEl.appendChild(dot);
  }
}

const stepNames = (step) => step.map((id) => (drumById(id) || { label: id }).label).join(' + ');

/** Set up a level's groove and panel — no playback yet. */
function setupCopyLevel() {
  copyCat.pattern = generatePattern(copyCat.level);
  copyCat.phase = 'idle';
  copyCat.step = 0;
  copyCat.stepHits = [];
  copyCat.doneSteps = 0;
  copyCat.attempts = 0;
  copyLevelEl.textContent = String(copyCat.level);
  copyStarsEl.textContent = '☆☆☆';
  copyStarsEl.setAttribute('aria-label', '0 of 3 stars');
  const joins =
    copyCat.level >= 6
      ? 'tom and crash join in! · '
      : copyCat.level >= 5
        ? 'crash joins in! · '
        : copyCat.level >= 3
          ? 'eight hi-hat steps! · '
          : '';
  const pace = copyCatTempo(copyCat.level) <= 70 ? 'nice and slow' : 'a little quicker';
  copyInfoEl.textContent =
    `Level ${copyCat.level} · ${copyCatBeatName(copyCat.level)} · ${copyCatLength(copyCat.level)} steps · ${joins}` +
    `${pace} (${copyCatTempo(copyCat.level)} BPM)`;
  renderCopyDots();
  copyPlayButton.disabled = false;
  copyAgainButton.disabled = false;
  setTurn('idle');
}

function startCopyLevel() {
  setupCopyLevel();
  startJackBar();
}

/** Jack plays one step of the groove: his sticks, your drums light up. */
function playJackStep(index) {
  stage.clearGlow();
  for (const drum of copyCat.pattern[index]) {
    stage.setGlow(drum, true);
    stage.jackHit(drum);
    synth.play(drum).catch(() => undefined);
  }
  renderCopyDots();
}

/** Jack's bar: the groove plays, step by step, then Joel's bar starts on the next beat. */
function startJackBar() {
  // Copy Cat needs the whole kit in frame — zoom back out if needed.
  if (stage.isZoomed && stage.isZoomed()) zoomButton.click();
  stopCopyTimers();
  copyCat.phase = 'watch';
  copyCat.step = 0;
  copyCat.stepHits = [];
  copyCat.doneSteps = 0;
  stage.setJackPlaying(true);
  setTurn('jack');
  setMessage(
    `Jack plays the ${copyCatBeatName(copyCat.level)}: ${stepNames(copyCat.pattern[0])} — listen close!`,
  );
  playJackStep(0);
  const stepMs = copyCatStepMs(copyCat.level);
  copyCat.interval = window.setInterval(() => {
    copyCat.step += 1;
    if (copyCat.step >= copyCat.pattern.length) {
      startJoelBar();
      return;
    }
    playJackStep(copyCat.step);
  }, stepMs);
}

/** Joel's bar: same groove, same speed. A quiet tick keeps the pulse alive. */
function startJoelBar() {
  stopCopyTimers();
  copyCat.phase = 'play';
  copyCat.step = 0;
  copyCat.stepHits = [];
  copyCat.doneSteps = 0;
  stage.setJackPlaying(false);
  stage.clearGlow();
  setTurn('you');
  setMessage('Your turn! Play the beat back on your drums — same groove, same speed.');
  renderCopyDots();
  const stepMs = copyCatStepMs(copyCat.level);
  copyCat.interval = window.setInterval(() => {
    // Quiet hi-hat tick on every beat — the pulse never stops.
    synth.play('hihat', null, 0.2).catch(() => undefined);
    copyCat.step += 1;
    copyCat.stepHits = [];
    if (copyCat.step >= copyCat.pattern.length) {
      // Bar over without a full play-through: Jack takes it straight back.
      startJackBar();
      return;
    }
    renderCopyDots();
  }, stepMs);
}

function handleCopyTap(drum) {
  if (copyCat.phase !== 'play') return;
  const result = checkCopyCatTap(copyCat.pattern, copyCat.step, copyCat.stepHits, drum);
  if (result === 'wrong') {
    copyCat.attempts += 1;
    setMessage('Not quite — Jack takes it straight back on the next beat, listen close!');
    // No long wait: Jack is back in on the very next beat.
    stopCopyTimers();
    copyCat.phase = 'idle';
    copyCat.stepHits = [];
    copyCat.doneSteps = 0;
    stage.setJackPlaying(false);
    stage.clearGlow();
    setTurn('jack');
    copyCat.timeout = window.setTimeout(startJackBar, copyCatStepMs(copyCat.level));
    return;
  }
  copyCat.stepHits.push(drum);
  if (result === 'correct') {
    renderCopyDots();
    return;
  }
  // 'step': this step is done — the beat clock moves on. 'complete': the bar is done.
  copyCat.doneSteps += 1;
  renderCopyDots();
  if (result !== 'complete') return;

  // Complete! Jack cheers, and the next level's groove starts one beat later.
  const stars = starsForAttempts(copyCat.attempts + 1);
  copyStarsEl.textContent = starString(stars);
  copyStarsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  stopCopyTimers();
  copyCat.phase = 'idle';
  stage.setJackPlaying(false);
  stage.clearGlow();
  stage.jackCheer();
  synth.cheer().catch(() => undefined);
  const finishedLevel = copyCat.level;
  submitScore(GAME_ID, finishedLevel);
  updateBestLine();
  setMessage(
    stars === 3
      ? `Perfect! ${starString(stars)} Jack is so proud — level ${finishedLevel} nailed on the first try!`
      : `You did it! ${starString(stars)} Jack is cheering for you — level ${finishedLevel} done!`,
  );
  copyCat.timeout = window.setTimeout(() => {
    copyCat.level = finishedLevel + 1;
    startCopyLevel();
  }, copyCatStepMs(copyCat.level));
}

copyPlayButton.addEventListener('click', startJackBar);
copyAgainButton.addEventListener('click', startJackBar);

/* ------------------------------------------------------------ keys + mute */

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const drum = drumByKey(event.key);
  if (!drum) return;
  event.preventDefault();
  userHit(drum.id);
});

const muteButton = $('mute-button');

function applyMute(muted) {
  synth.setMuted(muted);
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

/* ------------------------------------------------------------ zoom toggle */

const zoomButton = $('zoom-button');

zoomButton.addEventListener('click', () => {
  const zoomed = zoomButton.getAttribute('aria-pressed') !== 'true';
  stage.setZoomed(zoomed);
  zoomButton.textContent = zoomed ? '🔎' : '🔍';
  zoomButton.setAttribute('aria-pressed', String(zoomed));
  zoomButton.setAttribute(
    'aria-label',
    zoomed ? 'Zoom out to the full kit' : 'Zoom in on the kit',
  );
});

muteButton.addEventListener('click', () => {
  const muted = muteButton.getAttribute('aria-pressed') !== 'true';
  writeMuted(muted);
  applyMute(muted);
});

/* --------------------------------------------------------- fullscreen toggle */

const fullscreenButton = $('fullscreen-button');
const gameEl = document.querySelector('.drum-quest');

function applyFullscreenState() {
  const on = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = on ? '✕' : '⛶';
  fullscreenButton.setAttribute('aria-pressed', String(on));
  fullscreenButton.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
  // The stage sizes itself to its box — re-measure now that it filled the screen.
  window.setTimeout(() => stage.resize(), 60);
}

if (!document.fullscreenEnabled) {
  fullscreenButton.hidden = true;
} else {
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameEl.requestFullscreen();
    } catch (error) {
      /* Fullscreen is a nice-to-have; the game still works without it. */
    }
  });
  document.addEventListener('fullscreenchange', applyFullscreenState);
}

/* ------------------------------------------------------------------- init */

function updateBestLine() {
  const best = getBest(GAME_ID);
  $('best-line').textContent =
    best > 0 ? `Best level with Jack yet: ${best} ⭐` : 'Your best level with Jack will show up here.';
}

applyMute(readMuted());
applyFullscreenState();
setupCopyLevel();
updateBestLine();
showMode('free');
