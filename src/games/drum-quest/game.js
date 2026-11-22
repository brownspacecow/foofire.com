/* -------------------------------------------------------------------------
 * Drum Quest — Free Play, Jack's Copy Cat and Beat Builder, played on a
 * 3D Three.js drum kit (see scene.js). Tap a drum in 3D, or use keys
 * A/S/D/F/G. No failing anywhere: in Jack's lesson a wrong tap just
 * means Jack plays the beat again, and Free Play and Beat Builder never
 * score at all.
 * ---------------------------------------------------------------------- */

import {
  BEAT_PRESETS,
  BUILDER_ROWS,
  BUILDER_STEPS,
  builderStepMs,
  checkCopyCatTap,
  clampTempo,
  copyCatLength,
  copyCatStepMs,
  copyCatTempo,
  drumById,
  drumByKey,
  emptyGrid,
  generatePattern,
  gridToEvents,
  isGridEmpty,
  isValidGrid,
  loadPreset,
  starsForAttempts,
  starString,
  toggleCell,
} from './logic.js';
import { DrumSynth } from './sound.js';
import { createStage } from './scene.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

const GAME_ID = 'drum-quest';
const SAVED_BEAT_KEY = 'drum-quest.savedBeat.v1';
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
  stopBuilderLoop();
  stopCopyPlayback();
  stage.clearGlow();
  mode = next;
  for (const button of document.querySelectorAll('.dq-mode')) {
    const active = button.dataset.mode === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const panel of ['free', 'copy', 'builder']) {
    $(`panel-${panel}`).hidden = panel !== next;
  }
  if (next === 'free') setMessage('Tap a drum on the kit to make some noise!');
  if (next === 'copy') {
    setMessage('Jack is ready! Listen to his beat, then play it back.');
    // Jack starts the beat on his own once you come to his lesson.
    if (copyCat.phase === 'idle') {
      copyCat.timers.push(window.setTimeout(playCopyPattern, 500));
    }
  }
  if (next === 'builder') setMessage('Tap the squares to build a beat, then press play!');
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
 * Jack plays a very simple beat on his demo pad, then Joel plays it
 * back. The beat is ongoing: Jack plays, Joel tries, and if Joel gets
 * it wrong Jack just plays it again — as many times as it takes, with
 * no fail and no penalty beyond the stars. Only a full correct
 * play-through finishes the level, Jack cheers, and the next level
 * starts with a new simple beat.
 */

const copyLevelEl = $('copy-level');
const copyStarsEl = $('copy-stars');
const copyInfoEl = $('copy-info');
const copyDotsEl = $('copy-dots');
const copyPlayButton = $('copy-play-button');
const copyAgainButton = $('copy-again-button');

const copyCat = {
  level: 1,
  pattern: [],
  phase: 'idle', // idle | watch (Jack plays) | play (Joel tries)
  taps: [],
  attempts: 0, // misses on the current level
  timers: [],
};

function stopCopyPlayback() {
  for (const timer of copyCat.timers) window.clearTimeout(timer);
  copyCat.timers = [];
  copyCat.phase = 'idle';
  stage.setJackPlaying(false);
  stage.clearGlow();
}

function renderCopyDots(activeIndex = -1) {
  copyDotsEl.innerHTML = '';
  for (let i = 0; i < copyCat.pattern.length; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'dq-dot';
    if (i < copyCat.taps.length) dot.classList.add('is-done');
    if (i === activeIndex) dot.classList.add('is-now');
    dot.setAttribute('aria-hidden', 'true');
    copyDotsEl.appendChild(dot);
  }
}

const patternNames = (pattern) =>
  pattern.map((id) => (drumById(id) || { label: id }).label).join(' … ');

function startCopyLevel() {
  copyCat.pattern = generatePattern(copyCat.level);
  copyCat.phase = 'idle';
  copyCat.taps = [];
  copyCat.attempts = 0;
  copyLevelEl.textContent = String(copyCat.level);
  copyStarsEl.textContent = '☆☆☆';
  copyStarsEl.setAttribute('aria-label', '0 of 3 stars');
  const joins =
    copyCat.level >= 6
      ? 'the tom joins in! · '
      : copyCat.level >= 3
        ? 'the hi-hat joins in! · '
        : '';
  const pace = copyCatTempo(copyCat.level) <= 70 ? 'nice and slow' : 'a little quicker';
  copyInfoEl.textContent =
    `Level ${copyCat.level} · Jack plays ${copyCatLength(copyCat.level)} hits · ${joins}` +
    `${pace} (${copyCatTempo(copyCat.level)} BPM)`;
  renderCopyDots();
  copyPlayButton.disabled = false;
  copyAgainButton.disabled = true;
  setMessage('Jack is ready! Press “Jack, play it!” and listen close!');
}

/**
 * One Jack pass: Jack plays the pattern on his demo pad — his sticks,
 * not yours — your matching drum lights up, then it is your turn.
 */
function playCopyPattern() {
  // Copy Cat needs the whole kit in frame — zoom back out if needed.
  if (stage.isZoomed && stage.isZoomed()) zoomButton.click();
  stopCopyPlayback();
  copyCat.phase = 'watch';
  copyCat.taps = [];
  copyPlayButton.disabled = true;
  copyAgainButton.disabled = true;
  renderCopyDots();
  stage.setJackPlaying(true);
  setMessage(`Jack plays: ${patternNames(copyCat.pattern)} — listen close!`);
  const stepMs = copyCatStepMs(copyCat.level);
  // A count-in click on beat 1, so the beat never feels like it stops.
  copyCat.timers.push(
    window.setTimeout(() => {
      synth.click(true).catch(() => undefined);
    }, 100),
  );
  copyCat.pattern.forEach((drum, index) => {
    copyCat.timers.push(
      window.setTimeout(() => {
        stage.clearGlow();
        stage.setGlow(drum, true);
        stage.jackHit(drum);
        synth.play(drum).catch(() => undefined);
        renderCopyDots(index);
      }, 500 + index * stepMs),
    );
  });
  copyCat.timers.push(
    window.setTimeout(() => {
      copyCat.phase = 'play';
      stage.clearGlow();
      stage.setJackPlaying(false);
      renderCopyDots();
      copyPlayButton.disabled = false;
      copyAgainButton.disabled = false;
      setMessage('Your turn! Play it back on your drums — Jack will play it again if you miss.');
    }, 500 + copyCat.pattern.length * stepMs + 250),
  );
}

function handleCopyTap(drum) {
  if (copyCat.phase !== 'play') return;
  const result = checkCopyCatTap(copyCat.pattern, copyCat.taps, drum);
  if (result === 'wrong') {
    copyCat.attempts += 1;
    copyCat.taps = [];
    renderCopyDots();
    setMessage('Not quite — Jack will play it again, listen close!');
    // The beat keeps going: Jack plays it again, and Joel gets
    // another shot, as many times as it takes.
    copyCat.phase = 'idle';
    copyCat.timers.push(window.setTimeout(playCopyPattern, 1400));
    return;
  }
  copyCat.taps.push(drum);
  renderCopyDots();
  if (result === 'correct') return;

  // Complete! Jack cheers, and the next level starts with a new beat.
  const stars = starsForAttempts(copyCat.attempts + 1);
  copyStarsEl.textContent = starString(stars);
  copyStarsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  copyCat.phase = 'idle';
  copyPlayButton.disabled = true;
  copyAgainButton.disabled = true;
  stage.setJackPlaying(false);
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
  copyCat.timers.push(
    window.setTimeout(() => {
      copyCat.level = finishedLevel + 1;
      startCopyLevel();
      setMessage(`Level ${copyCat.level}! Jack has a new beat for you — listen close!`);
      playCopyPattern();
    }, 2400),
  );
}

copyPlayButton.addEventListener('click', playCopyPattern);
copyAgainButton.addEventListener('click', playCopyPattern);

/* ------------------------------------------------------------- Beat Builder */

const builderGridEl = $('builder-grid');
const builderPlayButton = $('builder-play-button');
const builderClearButton = $('builder-clear-button');
const builderSavedEl = $('builder-saved');
const tempoSlider = $('tempo-slider');
const tempoValueEl = $('tempo-value');
const presetBlurbEl = $('preset-blurb');

const builder = {
  grid: emptyGrid(),
  bpm: 90,
  playing: false,
  step: 0,
  timer: 0,
};

function saveBuilderBeat() {
  try {
    window.localStorage.setItem(SAVED_BEAT_KEY, JSON.stringify(builder.grid));
    builderSavedEl.textContent = 'Saved on this device ✓';
  } catch (error) {
    builderSavedEl.textContent = '';
  }
}

function loadSavedBeat() {
  try {
    const raw = window.localStorage.getItem(SAVED_BEAT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!isValidGrid(parsed)) return false;
    builder.grid = parsed;
    return true;
  } catch (error) {
    return false;
  }
}

const ROW_LABELS = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-Hat' };

function renderBuilderGrid() {
  builderGridEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'dq-grid-row dq-grid-head';
  header.appendChild(document.createElement('span'));
  for (let step = 0; step < BUILDER_STEPS; step += 1) {
    const number = document.createElement('span');
    number.className = 'dq-grid-number';
    number.textContent = String(step + 1);
    if (step % 2 === 0) number.classList.add('is-beat');
    header.appendChild(number);
  }
  builderGridEl.appendChild(header);

  for (const row of BUILDER_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'dq-grid-row';
    const label = document.createElement('span');
    label.className = 'dq-grid-label';
    label.textContent = ROW_LABELS[row];
    rowEl.appendChild(label);
    for (let step = 0; step < BUILDER_STEPS; step += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dq-cell';
      cell.dataset.row = row;
      cell.dataset.step = String(step);
      cell.setAttribute('aria-pressed', String(builder.grid[row][step]));
      cell.setAttribute(
        'aria-label',
        `${ROW_LABELS[row]}, step ${step + 1}${builder.grid[row][step] ? ', on' : ', off'}`,
      );
      if (builder.grid[row][step]) cell.classList.add('is-on');
      cell.addEventListener('click', () => {
        builder.grid = toggleCell(builder.grid, row, step);
        saveBuilderBeat();
        renderBuilderGrid();
      });
      rowEl.appendChild(cell);
    }
    builderGridEl.appendChild(rowEl);
  }
}

function highlightBuilderStep(step) {
  for (const cell of builderGridEl.querySelectorAll('.dq-cell')) {
    cell.classList.toggle('is-now', Number(cell.dataset.step) === step);
  }
}

function builderTick() {
  const step = builder.step;
  highlightBuilderStep(step);
  for (const event of gridToEvents(builder.grid)) {
    if (event.step === step) hitDrum(event.drum);
  }
  builder.step = (builder.step + 1) % BUILDER_STEPS;
}

function stopBuilderLoop() {
  if (builder.timer) window.clearInterval(builder.timer);
  builder.timer = 0;
  builder.playing = false;
  builderPlayButton.textContent = '▶ Play my beat';
  highlightBuilderStep(-1);
}

function startBuilderLoop() {
  if (isGridEmpty(builder.grid)) {
    setMessage('Add some hits first — tap a few squares, then press play!');
    return;
  }
  stopBuilderLoop();
  builder.playing = true;
  builder.step = 0;
  builderPlayButton.textContent = '■ Stop';
  setMessage('Rocking your beat! Tap the squares to change it while it plays.');
  builderTick();
  builder.timer = window.setInterval(builderTick, builderStepMs(builder.bpm));
}

builderPlayButton.addEventListener('click', () => {
  if (builder.playing) stopBuilderLoop();
  else startBuilderLoop();
});

builderClearButton.addEventListener('click', () => {
  stopBuilderLoop();
  builder.grid = emptyGrid();
  saveBuilderBeat();
  renderBuilderGrid();
  presetBlurbEl.textContent = 'A blank bar. Build a beat from scratch!';
  setMessage('All clear. What beat will you build?');
});

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => {
    const preset = BEAT_PRESETS[button.dataset.preset];
    if (!preset) return;
    builder.grid = loadPreset(preset.id);
    saveBuilderBeat();
    renderBuilderGrid();
    presetBlurbEl.textContent = `${preset.name}: ${preset.blurb}`;
    setMessage(`${preset.name} loaded! Press play and hear it go.`);
  });
}

tempoSlider.addEventListener('input', () => {
  builder.bpm = clampTempo(Number(tempoSlider.value));
  tempoValueEl.textContent = `${builder.bpm} BPM`;
  if (builder.playing) {
    window.clearInterval(builder.timer);
    builder.timer = window.setInterval(builderTick, builderStepMs(builder.bpm));
  }
});

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

/* ------------------------------------------------------------------- init */

function updateBestLine() {
  const best = getBest(GAME_ID);
  $('best-line').textContent =
    best > 0 ? `Best level with Jack yet: ${best} ⭐` : 'Your best level with Jack will show up here.';
}

applyMute(readMuted());
if (loadSavedBeat()) builderSavedEl.textContent = 'Your saved beat is back! ✓';
renderBuilderGrid();
startCopyLevel();
updateBestLine();
showMode('free');
