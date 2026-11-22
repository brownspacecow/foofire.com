/* -------------------------------------------------------------------------
 * Drum Quest — Free Play and Jack's Copy Cat, played on a 3D Three.js
 * drum kit (see scene.js). Tap a drum in 3D, or use keys A/S/D/F/G/H.
 *
 * Jack plays REAL beats: one bar of a groove, with drums landing
 * together the way a real beat does (kick + hi-hat, snare + hi-hat).
 * The flow never stops — one clock drives every bar, Jack's bar runs
 * into Joel's bar at the barline, a metronome click keeps the pulse
 * alive while Joel plays, a miss means Jack plays it again at the
 * end of the bar, and a win means the next level starts at the end
 * of the bar. No count-in, no pauses, no failing, no extra beat.
 * The click is a click on purpose: the old keep-time beat was a
 * hi-hat, the same sound as the groove's hi-hat, so it read as an
 * extra drum pulse between the turns — a click can never do that.
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
  stepIsDone,
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
 * One bar, on a loop, forever, on ONE clock. Jack plays the groove
 * (watch), then the very next bar is Joel's turn (play) — the pulse
 * never stops. A metronome click marks every beat of Joel's bar,
 * downbeat included, so the beat is always there even if he hasn't
 * tapped yet. The click is deliberately NOT a drum: a hi-hat tick
 * sounded like an extra drum pulse between the turns, and it doubled
 * Joel's own hi-hat tap on every step. Bars are exactly 4 beats
 * (4 quarter-note steps at levels 1–2, 8 eighth-note steps after),
 * and every handoff happens on a barline: a miss means Jack plays
 * it again at the end of the bar, and a win means the next level
 * starts at the end of the bar. Nothing ever adds or drops a beat,
 * and nothing sounds on top of Jack's downbeat but Jack's own drums.
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
  phase: 'idle', // idle | watch (Jack plays) | play (Joel plays) | waiting (bar finishing after a miss or a win)
  bar: 'jack', // which bar the single clock is in: Jack's, then Joel's, then Jack's…
  step: 0,
  hitsByStep: [], // one list of drums hit per step, kept for the whole bar
  attempts: 0, // misses on the current level
  pendingLevelUp: false, // Joel finished the bar — the next level starts at the barline
  pendingReplay: false, // "Jack, play it again" was tapped — Jack replays at the barline
  interval: 0,
};

function stopCopyTimers() {
  if (copyCat.interval) window.clearInterval(copyCat.interval);
  copyCat.interval = 0;
}

function stopCopyPlayback() {
  stopCopyTimers();
  copyCat.phase = 'idle';
  copyCat.pendingReplay = false;
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
    if (stepIsDone(copyCat.pattern[i], copyCat.hitsByStep[i])) dot.classList.add('is-done');
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
  copyCat.hitsByStep = copyCat.pattern.map(() => []);
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

/** Jack's bar starts now, on this beat: step 0 plays at once, then one
 *  clock (copyClockTick) drives every step after it. The clock never
 *  stops mid-lesson — bars are exactly N steps, and every handoff
 *  happens on a barline, so the pulse stays a steady 4/4. */
function startJackBar() {
  // Copy Cat needs the whole kit in frame — zoom back out if needed.
  if (stage.isZoomed && stage.isZoomed()) zoomButton.click();
  stopCopyTimers();
  copyCat.bar = 'jack';
  copyCat.phase = 'watch';
  copyCat.step = 0;
  copyCat.hitsByStep = copyCat.pattern.map(() => []);
  copyCat.pendingLevelUp = false;
  copyCat.pendingReplay = false;
  stage.setJackPlaying(true);
  setTurn('jack');
  setMessage(
    `Jack plays the ${copyCatBeatName(copyCat.level)}: ${stepNames(copyCat.pattern[0])} — listen close!`,
  );
  playJackStep(0);
  copyCat.interval = window.setInterval(copyClockTick, copyCatStepMs(copyCat.level));
}

/**
 * The one bar clock: one tick per step, forever, until the lesson stops.
 * A tick IS the start of a step — Jack's step-0 drums and Joel's
 * downbeat click land exactly on the beat, and nothing ever sounds on
 * top of Jack's downbeat. When the step count reaches the end of the
 * bar, the next bar starts on that very tick: Jack's bar, then Joel's,
 * then Jack's again. A miss or a win never stops the clock — the bar
 * simply runs out to the barline, and Jack (or the next level) starts
 * there, on the grid.
 */
function copyClockTick() {
  const barLength = copyCat.pattern.length;
  copyCat.step += 1;
  if (copyCat.step >= barLength) {
    // Barline: the next bar starts on this tick, never a step late.
    copyCat.step = 0;
    if (copyCat.pendingLevelUp) {
      copyCat.pendingLevelUp = false;
      copyCat.level += 1;
      // New level, new tempo: startCopyLevel re-arms the clock at the
      // new step length, right here on the barline.
      startCopyLevel();
      return;
    }
    copyCat.hitsByStep = copyCat.pattern.map(() => []);
    if (copyCat.pendingReplay) {
      // "Jack, play it again" was tapped mid-lesson: Jack replays his
      // bar at the barline, on the grid — never mid-bar, where a
      // restart would sound an extra step 0 off the beat.
      copyCat.pendingReplay = false;
      copyCat.bar = 'jack';
      copyCat.phase = 'watch';
      stage.setJackPlaying(true);
      setTurn('jack');
      setMessage(
        `Jack plays the ${copyCatBeatName(copyCat.level)} again: ${stepNames(copyCat.pattern[0])} — listen close!`,
      );
    } else if (copyCat.bar === 'jack') {
      // Jack's bar is done — Joel's turn starts on this beat.
      copyCat.bar = 'joel';
      copyCat.phase = 'play';
      stage.setJackPlaying(false);
      stage.clearGlow();
      setTurn('you');
      setMessage('Your turn! Play the beat back on your drums — same groove, same speed.');
    } else {
      // Joel's bar is done (or he missed) — Jack takes it back on this beat.
      copyCat.bar = 'jack';
      copyCat.phase = 'watch';
      stage.setJackPlaying(true);
      setTurn('jack');
      setMessage(
        `Jack plays the ${copyCatBeatName(copyCat.level)}: ${stepNames(copyCat.pattern[0])} — listen close!`,
      );
    }
  }
  // A new step starts — but the hits stay for the whole bar, so a tap
  // that lands just across a boundary still counts for the step it
  // meant (see checkCopyCatTap). Nothing is forgotten until the barline.
  if (copyCat.bar === 'jack') playJackStep(copyCat.step);
  else {
    // Metronome click on the beat — the pulse never stops, and the
    // downbeat gets an accented click just like every other beat
    // gets its click. A click, not a hi-hat: a hi-hat tick sounded
    // like an extra drum pulse between the turns, and it doubled
    // Joel's own hi-hat tap on every step of his bar.
    synth.click(copyCat.step === 0).catch(() => undefined);
  }
  renderCopyDots();
}

function handleCopyTap(drum) {
  if (copyCat.phase !== 'play') return;
  const result = checkCopyCatTap(copyCat.pattern, copyCat.step, copyCat.hitsByStep, drum);
  if (result === 'ignored') {
    // An extra tap on a drum he already hit — a double-tap, or a drum
    // from a step that is already done. He hears his drum; he just
    // doesn't lose the bar for it.
    renderCopyDots();
    return;
  }
  if (result === 'wrong') {
    copyCat.attempts += 1;
    // The clock keeps running: this bar finishes out to the barline,
    // then Jack plays it again — always on the beat, never off the grid.
    copyCat.phase = 'waiting';
    setTurn('jack');
    setMessage('Not quite — Jack will play it again at the end of this bar, listen close!');
    return;
  }
  if (result === 'correct') {
    renderCopyDots();
    return;
  }
  // 'step': a step is now complete. 'complete': every step of the bar
  // is complete, even if the last one finished was not the last step
  // on the clock — a late tap can finish an earlier step.
  renderCopyDots();
  if (result !== 'complete') return;

  // Complete! Jack cheers right away — but the next level's groove
  // starts at the barline, on the grid, never a beat early or late.
  const stars = starsForAttempts(copyCat.attempts + 1);
  copyStarsEl.textContent = starString(stars);
  copyStarsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  copyCat.phase = 'waiting';
  copyCat.pendingLevelUp = true;
  stage.setJackPlaying(false);
  stage.clearGlow();
  stage.jackCheer();
  synth.cheer().catch(() => undefined);
  const finishedLevel = copyCat.level;
  submitScore(GAME_ID, finishedLevel);
  updateBestLine();
  setTurn('jack');
  setMessage(
    stars === 3
      ? `Perfect! ${starString(stars)} Jack is so proud — level ${finishedLevel} nailed on the first try!`
      : `You did it! ${starString(stars)} Jack is cheering for you — level ${finishedLevel} done!`,
  );
}

/**
 * "Jack, play it!" / "Jack, play it again": never restart mid-bar —
 * that sounds an extra step 0 off the grid and shifts the whole
 * lesson. If the clock is already running, Jack replays at the next
 * barline; if the lesson is idle, he starts right away.
 */
function requestJackReplay() {
  if (copyCat.pendingLevelUp) return; // the next level is already coming
  if (copyCat.interval && copyCat.phase !== 'idle') {
    copyCat.pendingReplay = true;
    copyCat.phase = 'waiting';
    stage.setJackPlaying(false);
    stage.clearGlow();
    setTurn('jack');
    setMessage('Jack will play it again at the end of this bar — listen close!');
    return;
  }
  startJackBar();
}

copyPlayButton.addEventListener('click', requestJackReplay);
copyAgainButton.addEventListener('click', requestJackReplay);

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
