/* -------------------------------------------------------------------------
 * Drum Quest — Free Play, Copy Cat and Beat Builder in one game.
 * No failing anywhere: a wrong tap in Copy Cat just replays the pattern,
 * and Free Play and Beat Builder never score at all.
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
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

const GAME_ID = 'drum-quest';
const SAVED_BEAT_KEY = 'drum-quest.savedBeat.v1';
const METRONOME_BPM = 80;

const $ = (id) => document.getElementById(id);
const synth = new DrumSynth();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const messageEl = $('message');
const pads = [...document.querySelectorAll('.dq-pad')];
const padByDrum = Object.fromEntries(pads.map((pad) => [pad.dataset.drum, pad]));

const setMessage = (text) => {
  messageEl.textContent = text;
};

/* ------------------------------------------------------------------ pads */

function flashPad(drum) {
  const pad = padByDrum[drum];
  if (!pad) return;
  pad.classList.remove('is-hit');
  // Force a reflow so a fast repeat still replays the flash.
  void pad.offsetWidth;
  pad.classList.add('is-hit');
  window.setTimeout(() => pad.classList.remove('is-hit'), prefersReducedMotion ? 60 : 180);
}

async function hitDrum(drum) {
  flashPad(drum);
  try {
    await synth.play(drum);
  } catch (error) {
    /* Audio needs a first tap on some browsers; the flash still shows. */
  }
}

/* ------------------------------------------------------------------ modes */

let mode = 'free';

function showMode(next) {
  stopMetronome();
  stopBuilderLoop();
  stopCopyPlayback();
  mode = next;
  for (const button of document.querySelectorAll('.dq-mode')) {
    const active = button.dataset.mode === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const panel of ['free', 'copy', 'builder']) {
    $(`panel-${panel}`).hidden = panel !== next;
  }
  if (next === 'free') setMessage('Tap a drum to make some noise!');
  if (next === 'copy') setMessage('Press “Play the pattern”, then copy it back!');
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

/* ---------------------------------------------------------------- Copy Cat */

const copyLevelEl = $('copy-level');
const copyStarsEl = $('copy-stars');
const copyInfoEl = $('copy-info');
const copyDotsEl = $('copy-dots');
const copyPlayButton = $('copy-play-button');
const copyAgainButton = $('copy-again-button');

const copyCat = {
  level: 1,
  pattern: [],
  phase: 'idle', // idle | watch | play
  taps: [],
  attempts: 0, // misses on the current level
  timers: [],
};

function stopCopyPlayback() {
  for (const timer of copyCat.timers) window.clearTimeout(timer);
  copyCat.timers = [];
  if (copyCat.phase === 'watch') copyCat.phase = 'idle';
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

function startCopyLevel() {
  copyCat.pattern = generatePattern(copyCat.level);
  copyCat.phase = 'idle';
  copyCat.taps = [];
  copyCat.attempts = 0;
  copyLevelEl.textContent = String(copyCat.level);
  copyStarsEl.textContent = '☆☆☆';
  copyStarsEl.setAttribute('aria-label', '0 of 3 stars');
  copyInfoEl.textContent =
    `Level ${copyCat.level} · ${copyCatLength(copyCat.level)} hits · ` +
    `${copyCat.level >= 5 ? 'tom joins in! · ' : ''}` +
    `nice and ${copyCatTempo(copyCat.level) <= 80 ? 'slow' : 'brisk'} (${copyCatTempo(copyCat.level)} BPM)`;
  renderCopyDots();
  copyPlayButton.disabled = false;
  copyAgainButton.disabled = true;
  setMessage('Press “Play the pattern” and listen close!');
}

function playCopyPattern() {
  if (copyCat.phase === 'watch') return;
  stopCopyPlayback();
  copyCat.phase = 'watch';
  copyCat.taps = [];
  copyPlayButton.disabled = true;
  copyAgainButton.disabled = true;
  renderCopyDots();
  setMessage('Listen… watch the drums light up…');
  const stepMs = copyCatStepMs(copyCat.level);
  copyCat.pattern.forEach((drum, index) => {
    copyCat.timers.push(
      window.setTimeout(() => {
        hitDrum(drum);
        renderCopyDots(index);
      }, 500 + index * stepMs),
    );
  });
  copyCat.timers.push(
    window.setTimeout(() => {
      copyCat.phase = 'play';
      renderCopyDots();
      copyPlayButton.disabled = false;
      copyAgainButton.disabled = false;
      setMessage('Your turn! Tap the same drums in the same order.');
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
    setMessage('Oops, not quite! Listen again — you\'ve got this.');
    // Idle (not 'watch') so the scheduled replay is not blocked by the guard
    // in playCopyPattern.
    copyCat.phase = 'idle';
    copyCat.timers.push(window.setTimeout(playCopyPattern, 1100));
    return;
  }
  copyCat.taps.push(drum);
  renderCopyDots();
  if (result === 'correct') return;

  // Complete!
  const stars = starsForAttempts(copyCat.attempts + 1);
  copyStarsEl.textContent = starString(stars);
  copyStarsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  copyCat.phase = 'idle';
  copyPlayButton.disabled = true;
  copyAgainButton.disabled = true;
  synth.cheer().catch(() => undefined);
  const finishedLevel = copyCat.level;
  submitScore(GAME_ID, finishedLevel);
  updateBestLine();
  setMessage(
    stars === 3
      ? `Perfect! ${starString(stars)} Level ${finishedLevel} nailed on the first try!`
      : `You did it! ${starString(stars)} Level ${finishedLevel} done!`,
  );
  copyCat.timers.push(
    window.setTimeout(() => {
      copyCat.level = finishedLevel + 1;
      startCopyLevel();
      setMessage(`Level ${copyCat.level}! A little longer, a little faster. You can do it!`);
    }, 2200),
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
  const tick = () => {
    const step = builder.step;
    highlightBuilderStep(step);
    for (const event of gridToEvents(builder.grid)) {
      if (event.step === step) hitDrum(event.drum);
    }
    builder.step = (builder.step + 1) % BUILDER_STEPS;
  };
  tick();
  builder.timer = window.setInterval(tick, builderStepMs(builder.bpm));
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
    builder.timer = window.setInterval(() => {
      const step = builder.step;
      highlightBuilderStep(step);
      for (const event of gridToEvents(builder.grid)) {
        if (event.step === step) hitDrum(event.drum);
      }
      builder.step = (builder.step + 1) % BUILDER_STEPS;
    }, builderStepMs(builder.bpm));
  }
});

/* ------------------------------------------------------------ pads + keys */

pads.forEach((pad) => {
  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const drum = pad.dataset.drum;
    hitDrum(drum);
    if (mode === 'copy') handleCopyTap(drum);
  });
  // Keyboard activation (Space/Enter on a focused pad) fires a click with
  // detail 0; pointer clicks have detail >= 1 and were already handled.
  pad.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const drum = pad.dataset.drum;
    hitDrum(drum);
    if (mode === 'copy') handleCopyTap(drum);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const drum = drumByKey(event.key);
  if (!drum) return;
  event.preventDefault();
  hitDrum(drum.id);
  if (mode === 'copy') handleCopyTap(drum.id);
});

/* ------------------------------------------------------------------ mute */

const muteButton = $('mute-button');

function applyMute(muted) {
  synth.setMuted(muted);
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

muteButton.addEventListener('click', () => {
  const muted = muteButton.getAttribute('aria-pressed') !== 'true';
  writeMuted(muted);
  applyMute(muted);
});

/* ------------------------------------------------------------------- init */

function updateBestLine() {
  const best = getBest(GAME_ID);
  $('best-line').textContent =
    best > 0 ? `Best Copy Cat level yet: ${best} ⭐` : 'Your best Copy Cat level will show up here.';
}

applyMute(readMuted());
if (loadSavedBeat()) builderSavedEl.textContent = 'Your saved beat is back! ✓';
renderBuilderGrid();
startCopyLevel();
updateBestLine();
showMode('free');
