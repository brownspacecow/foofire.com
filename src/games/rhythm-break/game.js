import { TRACKS, buildSong, MusicEngine } from './music.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

/* ------------------------------------------------------------------ setup */

const GAME_ID = 'rhythm-break';
const PREF_KEY = 'softReset.v1';
const LANE_KEYS = ['d', 'f', 'j', 'k'];
const LANE_COLORS = ['#f4c95d', '#f08fa4', '#7fd8c6', '#b6a3ff'];
const APPROACH_BEATS = 4;
// Slightly generous windows: touchscreens add latency and this game is not a test.
const HIT_WINDOW = { perfect: 0.06, great: 0.115, good: 0.185 };
const MISS_WINDOW = 0.215;

const JUDGMENTS = {
  perfect: { text: 'Perfect', color: '#f8e0a4' },
  great: { text: 'Nice', color: '#9fe6d6' },
  good: { text: 'Okay', color: '#cbb8ff' },
  miss: { text: 'Let it go', color: '#a98fa8' },
};

const RATINGS = [
  { min: 96, title: 'Pure Gold', note: 'That was almost every note. The kitchen is yours.' },
  { min: 88, title: 'Sunday Groove', note: 'Locked in and loose. That is exactly the point.' },
  { min: 74, title: 'Soft Landing', note: 'You found the pocket. It counts.' },
  { min: 0, title: 'Slow Pour', note: 'Low effort, still a break. That is a win.' },
];

/* Little noticings that surface mid-song. Nothing asks for a response. */
const WHISPERS = {
  'golden-hour': [
    { at: 12, text: 'Shoulders down.' },
    { at: 34, text: 'Unclench your jaw.' },
    { at: 58, text: 'You are not behind on anything right now.' },
    { at: 82, text: 'This part is just for you.' },
  ],
  'sunday-drop': [
    { at: 14, text: 'Nothing but this part of the afternoon.' },
    { at: 42, text: 'Let your shoulders drop on the offbeat.' },
    { at: 72, text: 'You do not have to earn the rest.' },
    { at: 96, text: 'One more breath. Then back to it, or not.' },
  ],
  'slow-pour': [
    { at: 12, text: 'Slow is allowed.' },
    { at: 36, text: 'Drop your shoulders again.' },
    { at: 62, text: 'You are doing more than enough.' },
    { at: 86, text: 'The list will still be there. It can wait.' },
  ],
};

const $ = (selector) => document.querySelector(selector);

const els = {
  picker: $('#picker'),
  stage: $('#stage'),
  trackList: $('#track-list'),
  bestLine: $('#best-line'),
  difficultyHint: $('#difficulty-hint'),
  difficultyButtons: Array.from(document.querySelectorAll('[data-difficulty]')),
  trackName: $('#track-name'),
  trackVibe: $('#track-vibe'),
  score: $('#score'),
  combo: $('#combo'),
  grooveMeter: $('#groove-meter'),
  grooveFill: $('#groove-fill'),
  grooveValue: $('#groove-value'),
  progressFill: $('#progress-fill'),
  canvas: $('#board'),
  canvasWrap: $('#canvas-wrap'),
  countdown: $('#countdown'),
  pauseOverlay: $('#pause-overlay'),
  resultOverlay: $('#result-overlay'),
  muteButton: $('#mute-button'),
  pauseButton: $('#pause-button'),
  tracksButton: $('#tracks-button'),
  resumeButton: $('#resume-button'),
  restartButton: $('#restart-button'),
  quitButton: $('#quit-button'),
  againButton: $('#again-button'),
  anotherButton: $('#another-button'),
  pads: $('#pads'),
  whisper: $('#whisper'),
  resultTrack: $('#result-track'),
  resultScore: $('#result-score'),
  resultRating: $('#result-rating'),
  resultAccuracy: $('#result-accuracy'),
  resultCombo: $('#result-combo'),
  resultPerfect: $('#result-perfect'),
  resultMiss: $('#result-miss'),
  resultNote: $('#result-note'),
};

const music = new MusicEngine();
const canvas = els.canvas;
const g = canvas.getContext('2d');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const view = {
  w: 0,
  h: 0,
  dpr: 1,
  lanePad: 16,
  laneW: 100,
  hitY: 400,
  pxPerBeat: 80,
  noteH: 24,
};

const state = {
  screen: 'picker',
  difficulty: 'gentle',
  track: null,
  song: null,
  notes: [],
  score: 0,
  combo: 0,
  maxCombo: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  groove: 0,
  laneFlash: [0, 0, 0, 0],
  particles: [],
  judgments: [],
  dust: [],
  whispers: [],
  whisperToken: 0,
  muted: false,
  lastScore: -1,
  lastCombo: -1,
  raf: 0,
  lastFrame: 0,
  countdownText: null,
};

/* ---------------------------------------------------------------- helpers */

function setCountdown(text) {
  if (state.countdownText === text) return;
  state.countdownText = text;
  els.countdown.textContent = text;
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((part) => part + part)
          .join('')
      : value;
  const number = parseInt(full, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function loadPrefs() {
  if (readMuted('softResetPrefs')) {
    state.muted = true;
    music.setMuted(true);
    updateMuteButton();
  }

  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs && prefs.difficulty === 'groove') setDifficulty('groove');
    if (prefs && prefs.muted) {
      state.muted = true;
      music.setMuted(true);
      updateMuteButton();
    }
  } catch (error) {
    /* preferences are optional */
  }
}

function savePrefs() {
  writeMuted(state.muted);
  try {
    window.localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ difficulty: state.difficulty, muted: state.muted })
    );
  } catch (error) {
    /* storage can be blocked */
  }
}

function setDifficulty(value) {
  state.difficulty = value === 'groove' ? 'groove' : 'gentle';
  for (const button of els.difficultyButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.difficulty === state.difficulty));
  }
  els.difficultyHint.textContent =
    state.difficulty === 'gentle'
      ? 'Gentle stays right on the beat. Groove adds the little off-beat flourishes.'
      : 'Groove keeps the syncopation. Same no-fail rules — just a little more bounce.';
  savePrefs();
}

function updateMuteButton() {
  els.muteButton.textContent = state.muted ? '🔇' : '🔊';
  els.muteButton.setAttribute('aria-pressed', String(state.muted));
  els.muteButton.setAttribute('aria-label', state.muted ? 'Unmute music' : 'Mute music');
}

function updateBestLine() {
  const best = getBest(GAME_ID);
  els.bestLine.textContent =
    best > 0
      ? `Your best on Soft Reset: ${best.toLocaleString('en-US')} points.`
      : 'Nothing on the board yet — the first run sets the bar.';
}

/* ------------------------------------------------------------- track cards */

function renderTracks() {
  els.trackList.replaceChildren(
    ...TRACKS.map((track, index) => {
      const card = document.createElement('article');
      card.className = 'sr-track';
      card.style.setProperty('--tint', track.palette.glow);
      card.style.setProperty('--tint-2', track.palette.haze);

      const art = document.createElement('div');
      art.className = 'sr-track-art';
      art.setAttribute('aria-hidden', 'true');
      const disc = document.createElement('span');
      disc.className = 'sr-track-disc';
      const number = document.createElement('span');
      number.className = 'sr-track-no';
      number.textContent = String(index + 1).padStart(2, '0');
      art.append(disc, number);

      const body = document.createElement('div');
      body.className = 'sr-track-body';
      const title = document.createElement('h3');
      title.textContent = track.title;
      const meta = document.createElement('p');
      meta.className = 'sr-track-meta';
      meta.textContent = `${track.bpm} BPM · ${track.lengthLabel} · ${track.vibe}`;
      const blurb = document.createElement('p');
      blurb.className = 'sr-track-blurb';
      blurb.textContent = track.blurb;
      body.append(title, meta, blurb);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sr-button primary';
      button.textContent = 'Begin';
      button.setAttribute('aria-label', `Begin ${track.title}, ${track.lengthLabel}`);
      button.addEventListener('click', () => startTrack(track.id));

      card.append(art, body, button);
      return card;
    })
  );
}

/* -------------------------------------------------------------- game flow */

function showStage(show) {
  els.stage.hidden = !show;
  els.picker.hidden = show;
  // On phones this swaps the page chrome for a full-screen play surface.
  document.body.classList.toggle('sr-playing', show);
}

async function startTrack(trackId) {
  const track = TRACKS.find((entry) => entry.id === trackId);
  if (!track) return;

  stopLoop();
  state.screen = 'loading';
  state.track = track;
  const song = buildSong(track, state.difficulty);
  state.song = song;
  state.notes = song.notes.map((note) => ({ ...note, status: 'pending' }));
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  state.groove = 0;
  state.laneFlash = [0, 0, 0, 0];
  state.particles = [];
  state.judgments = [];
  state.lastScore = -1;
  state.lastCombo = -1;
  state.countdownText = null;
  state.whispers = (WHISPERS[track.id] || []).map((whisper) => ({ ...whisper, shown: false }));
  state.whisperToken += 1;
  els.whisper.textContent = '';
  els.whisper.classList.remove('is-visible');

  els.trackName.textContent = track.title;
  els.trackVibe.textContent = `${track.vibe} · ${track.bpm} BPM`;
  els.score.textContent = '0';
  els.combo.textContent = '—';
  els.grooveFill.style.width = '0%';
  els.grooveValue.textContent = '0%';
  els.grooveMeter.setAttribute('aria-valuenow', '0');
  els.progressFill.style.width = '0%';
  els.pauseOverlay.hidden = true;
  els.resultOverlay.hidden = true;
  els.countdown.textContent = 'breathe in…';
  showStage(true);
  window.scrollTo({ top: 0, behavior: 'auto' });
  resize();
  draw(0, 0);

  try {
    await music.startSong(song);
  } catch (error) {
    showStage(false);
    state.screen = 'picker';
    els.bestLine.textContent = 'Sound could not start in this browser. Try a different browser or check your mute settings.';
    console.error(error);
    return;
  }

  state.screen = 'playing';
  startLoop();
}

function pauseSong() {
  if (state.screen !== 'playing') return;
  state.screen = 'paused';
  stopLoop();
  setCountdown('');
  music.pause();
  els.pauseOverlay.hidden = false;
  els.pauseButton.setAttribute('aria-label', 'Resume');
}

async function resumeSong() {
  if (state.screen !== 'paused') return;
  els.pauseOverlay.hidden = true;
  await music.resume();
  state.screen = 'playing';
  els.pauseButton.setAttribute('aria-label', 'Pause');
  startLoop();
}

function restartSong() {
  if (!state.track) return;
  els.pauseOverlay.hidden = true;
  els.resultOverlay.hidden = true;
  startTrack(state.track.id);
}

function returnToPicker() {
  stopLoop();
  state.screen = 'picker';
  music.stopSong();
  state.song = null;
  state.notes = [];
  state.track = null;
  els.pauseOverlay.hidden = true;
  els.resultOverlay.hidden = true;
  showStage(false);
  updateBestLine();
  state.whisperToken += 1;
  els.whisper.textContent = '';
  els.whisper.classList.remove('is-visible');
}

function finishSong() {
  if (state.screen !== 'playing') return;
  state.screen = 'results';
  stopLoop();
  music.stopSong();
  setCountdown('');
  els.countdown.textContent = '';

  const counts = state.counts;
  const total = state.notes.length;
  const weighted = counts.perfect + counts.great * 0.8 + counts.good * 0.5;
  const accuracy = total ? Math.round((weighted / total) * 100) : 0;
  const rating = RATINGS.find((entry) => accuracy >= entry.min) || RATINGS[RATINGS.length - 1];
  const result = submitScore(GAME_ID, state.score);

  els.resultTrack.textContent = state.track ? state.track.title : '';
  els.resultScore.textContent = state.score.toLocaleString('en-US');
  els.resultRating.textContent = rating.title;
  els.resultAccuracy.textContent = `${accuracy}%`;
  els.resultCombo.textContent = `${state.maxCombo}`;
  els.resultPerfect.textContent = `${counts.perfect}`;
  els.resultMiss.textContent = `${counts.miss}`;
  els.resultNote.textContent = result.isBest
    ? `${rating.note} New best on this device.`
    : rating.note;
  els.resultOverlay.hidden = false;
  updateBestLine();
}

/* ------------------------------------------------------------------ input */

function pressLane(lane) {
  if (state.screen !== 'playing' || !state.song) return;
  state.laneFlash[lane] = 1;

  const time = music.getSongTime();
  if (time < 0) return;

  let nearest = null;
  let nearestDelta = Infinity;
  const secPerBeat = state.song.secPerBeat;

  for (const note of state.notes) {
    if (note.status !== 'pending' || note.lane !== lane) continue;
    const delta = Math.abs(note.beat * secPerBeat - time);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = note;
    }
  }

  if (!nearest || nearestDelta > HIT_WINDOW.good) {
    music.emptyTap();
    return;
  }

  const kind =
    nearestDelta <= HIT_WINDOW.perfect
      ? 'perfect'
      : nearestDelta <= HIT_WINDOW.great
        ? 'great'
        : 'good';

  nearest.status = kind;
  state.counts[kind] += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  const multiplier = 1 + Math.min(3, Math.floor(state.combo / 10) * 0.5);
  const base = kind === 'perfect' ? 320 : kind === 'great' ? 220 : 120;
  state.score += Math.round(base * multiplier);

  music.tap(lane, kind === 'perfect');
  addJudgment(kind);
  addBurst(lane, kind);
}

function addJudgment(kind) {
  const info = JUDGMENTS[kind];
  state.judgments.push({
    text: info.text,
    color: info.color,
    at: performance.now(),
  });
  if (state.judgments.length > 6) state.judgments.shift();
}

function addBurst(lane, kind) {
  const x = view.lanePad + view.laneW * (lane + 0.5);
  const y = view.hitY;
  const strength = kind === 'perfect' ? 14 : kind === 'great' ? 10 : 6;
  for (let i = 0; i < strength; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 130;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.5 + Math.random() * 0.4,
      max: 0.9,
      size: 2 + Math.random() * 3,
      color: LANE_COLORS[lane],
    });
  }
}

/* ------------------------------------------------------------------ frame */

function startLoop() {
  stopLoop();
  state.lastFrame = performance.now();
  state.raf = window.requestAnimationFrame(frame);
}

function stopLoop() {
  if (state.raf) {
    window.cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
}

function frame(now) {
  state.raf = 0;
  if (state.screen !== 'playing') return;

  const delta = Math.min(0.05, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  const time = music.getSongTime();
  update(delta, time);
  draw(time, delta);

  if (state.screen === 'playing') {
    state.raf = window.requestAnimationFrame(frame);
  }
}

function update(delta, time) {
  if (!state.song) return;
  const secPerBeat = state.song.secPerBeat;

  for (const note of state.notes) {
    if (note.status !== 'pending') continue;
    if (time - note.beat * secPerBeat > MISS_WINDOW) {
      note.status = 'miss';
      state.counts.miss += 1;
      state.combo = 0;
      addJudgment('miss');
      music.miss();
    }
  }

  const resolved =
    state.counts.perfect + state.counts.great + state.counts.good + state.counts.miss;
  const nextGroove = resolved
    ? Math.round(
        ((state.counts.perfect + state.counts.great * 0.8 + state.counts.good * 0.45) / resolved) *
          100
      )
    : 0;
  if (nextGroove !== state.groove) {
    state.groove = nextGroove;
    els.grooveFill.style.width = `${state.groove}%`;
    els.grooveValue.textContent = `${state.groove}%`;
    els.grooveMeter.setAttribute('aria-valuenow', String(state.groove));
  }

  if (time < 0) {
    const beatsLeft = -time / secPerBeat;
    setCountdown(beatsLeft > 4 ? 'breathe in…' : String(Math.max(1, Math.ceil(beatsLeft))));
  } else if (time < 0.9) {
    setCountdown('breathe out');
  } else {
    setCountdown('');
  }

  for (const whisper of state.whispers) {
    if (!whisper.shown && time >= whisper.at) {
      whisper.shown = true;
      showWhisper(whisper.text);
    }
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 220 * delta;
    particle.life -= delta;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  const now = performance.now();
  state.judgments = state.judgments.filter((judgment) => now - judgment.at < 950);

  for (let lane = 0; lane < 4; lane += 1) {
    state.laneFlash[lane] = Math.max(0, state.laneFlash[lane] - delta * 4.5);
  }

  if (state.score !== state.lastScore) {
    els.score.textContent = state.score.toLocaleString('en-US');
    state.lastScore = state.score;
  }
  if (state.combo !== state.lastCombo) {
    els.combo.textContent = state.combo > 0 ? `${state.combo}×` : '—';
    state.lastCombo = state.combo;
  }

  const progress = Math.max(0, Math.min(1, time / state.song.durationSeconds));
  els.progressFill.style.width = `${(progress * 100).toFixed(1)}%`;

  if (time > state.song.durationSeconds + 2.2) finishSong();
}

function showWhisper(text) {
  els.whisper.textContent = text;
  els.whisper.classList.add('is-visible');
  state.whisperToken += 1;
  const token = state.whisperToken;
  window.setTimeout(() => {
    if (state.whisperToken === token) els.whisper.classList.remove('is-visible');
  }, 4800);
}

/* -------------------------------------------------------------- rendering */

function resize() {
  const rect = els.canvasWrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  view.w = rect.width;
  view.h = rect.height;
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  view.lanePad = Math.max(14, view.w * 0.08);
  view.laneW = (view.w - view.lanePad * 2) / 4;
  view.hitY = view.h * 0.76;
  view.pxPerBeat = (view.hitY - view.h * 0.06) / APPROACH_BEATS;
  view.noteH = Math.max(15, Math.min(30, view.laneW * 0.26));

  state.dust = Array.from({ length: motionQuery.matches ? 0 : 26 }, () => ({
    x: Math.random() * view.w,
    y: Math.random() * view.h,
    size: 0.8 + Math.random() * 2,
    speed: 6 + Math.random() * 18,
    alpha: 0.08 + Math.random() * 0.22,
  }));
}

function draw(time, delta) {
  if (!state.song) return;
  const palette = state.track.palette;
  const { w, h } = view;

  const background = g.createLinearGradient(0, 0, 0, h);
  background.addColorStop(0, palette.sky[0]);
  background.addColorStop(1, palette.sky[1]);
  g.fillStyle = background;
  g.fillRect(0, 0, w, h);

  const beat = time * (state.song.bpm / 60);
  const phase = beat - Math.floor(beat);
  const pulse = phase < 0 ? 1 + phase : 1 - phase;

  const glowX = w / 2;
  const glowY = h * 0.34;
  const sunRadius = Math.min(w, h) * 0.55;
  const sun = g.createRadialGradient(glowX, glowY, 0, glowX, glowY, sunRadius);
  sun.addColorStop(0, hexToRgba(palette.glow, 0.24 + pulse * 0.07));
  sun.addColorStop(0.45, hexToRgba(palette.haze, 0.1));
  sun.addColorStop(1, hexToRgba(palette.haze, 0));
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);

  // Slow drifting dust, like the room has a window open.
  for (const mote of state.dust) {
    if (delta > 0) {
      mote.y -= mote.speed * delta;
      if (mote.y < -4) {
        mote.y = h + 4;
        mote.x = Math.random() * w;
      }
    }
    g.fillStyle = `rgba(255, 242, 222, ${mote.alpha})`;
    g.beginPath();
    g.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
    g.fill();
  }

  const pad = view.lanePad;
  const laneW = view.laneW;
  const hitY = view.hitY;

  for (let lane = 0; lane < 4; lane += 1) {
    const x = pad + laneW * lane;
    const flash = state.laneFlash[lane];

    const laneGradient = g.createLinearGradient(0, 0, 0, h);
    laneGradient.addColorStop(0, 'rgba(255, 255, 255, 0.015)');
    laneGradient.addColorStop(0.7, hexToRgba(LANE_COLORS[lane], 0.035));
    laneGradient.addColorStop(1, hexToRgba(LANE_COLORS[lane], 0.09 + flash * 0.16));
    g.fillStyle = laneGradient;
    roundRect(g, x + 3, 0, laneW - 6, h, 12);
    g.fill();

    g.strokeStyle = `rgba(255, 245, 230, ${0.05 + flash * 0.16})`;
    g.lineWidth = 1;
    roundRect(g, x + 3, 0, laneW - 6, h, 12);
    g.stroke();

    if (flash > 0.01) {
      const splash = g.createLinearGradient(0, hitY - 140, 0, hitY + 40);
      splash.addColorStop(0, hexToRgba(LANE_COLORS[lane], 0));
      splash.addColorStop(1, hexToRgba(LANE_COLORS[lane], 0.28 * flash));
      g.fillStyle = splash;
      roundRect(g, x + 3, hitY - 140, laneW - 6, 180, 12);
      g.fill();
    }
  }

  // The hit line and its four landing pads.
  g.save();
  g.shadowColor = hexToRgba(palette.glow, 0.8);
  g.shadowBlur = 10 + pulse * 8;
  g.strokeStyle = 'rgba(252, 238, 216, 0.66)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(pad, hitY);
  g.lineTo(w - pad, hitY);
  g.stroke();
  g.restore();

  for (let lane = 0; lane < 4; lane += 1) {
    const x = pad + laneW * (lane + 0.5);
    const flash = state.laneFlash[lane];
    g.save();
    g.strokeStyle = hexToRgba(LANE_COLORS[lane], 0.5 + flash * 0.45);
    g.lineWidth = 2;
    g.shadowColor = hexToRgba(LANE_COLORS[lane], 0.8);
    g.shadowBlur = 6 + flash * 16;
    g.beginPath();
    g.arc(x, hitY, Math.min(laneW * 0.2, 18) + flash * 6, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    g.fillStyle = 'rgba(249, 237, 223, 0.3)';
    g.font = '600 12px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(LANE_KEYS[lane].toUpperCase(), x, h - 18);
  }

  // Notes.
  for (const note of state.notes) {
    if (note.status !== 'pending') continue;
    const deltaBeats = note.beat - beat;
    if (deltaBeats > APPROACH_BEATS || deltaBeats < -0.35) continue;

    const x = pad + laneW * (note.lane + 0.5);
    const y = hitY - deltaBeats * view.pxPerBeat;
    const width = laneW * 0.64;
    const height = view.noteH;
    const closeness = 1 - Math.min(1, Math.abs(deltaBeats) / APPROACH_BEATS);

    g.save();
    g.shadowColor = hexToRgba(LANE_COLORS[note.lane], 0.85);
    g.shadowBlur = 8 + closeness * 16;
    g.fillStyle = LANE_COLORS[note.lane];
    roundRect(g, x - width / 2, y - height / 2, width, height, height / 2);
    g.fill();
    g.restore();

    g.fillStyle = 'rgba(255, 255, 255, 0.38)';
    roundRect(g, x - width / 2 + 5, y - height / 2 + 4, width - 10, Math.max(3, height * 0.2), 3);
    g.fill();
  }

  // Hit sparks.
  for (const particle of state.particles) {
    const alpha = Math.max(0, Math.min(1, particle.life / particle.max));
    g.fillStyle = hexToRgba(particle.color, alpha);
    g.beginPath();
    g.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    g.fill();
  }

  // Judgement words.
  const now = performance.now();
  for (const judgment of state.judgments) {
    const age = (now - judgment.at) / 1000;
    const alpha = Math.max(0, 1 - age / 0.95);
    const y = hitY - 56 - age * 26;
    g.globalAlpha = alpha;
    g.fillStyle = judgment.color;
    g.font = `600 ${Math.min(26, Math.max(18, w * 0.035))}px Fraunces, Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(judgment.text, w / 2, y);
    g.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------- wire it up */

for (const button of els.difficultyButtons) {
  button.addEventListener('click', () => setDifficulty(button.dataset.difficulty));
}

els.muteButton.addEventListener('click', () => {
  state.muted = !state.muted;
  music.setMuted(state.muted);
  updateMuteButton();
  savePrefs();
});

els.pauseButton.addEventListener('click', () => {
  if (state.screen === 'playing') pauseSong();
  else if (state.screen === 'paused') resumeSong();
});

els.tracksButton.addEventListener('click', returnToPicker);
els.resumeButton.addEventListener('click', resumeSong);
els.restartButton.addEventListener('click', restartSong);
els.quitButton.addEventListener('click', returnToPicker);
els.againButton.addEventListener('click', restartSong);
els.anotherButton.addEventListener('click', returnToPicker);

for (const pad of els.pads.querySelectorAll('.sr-pad')) {
  const lane = Number(pad.dataset.lane);
  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pad.classList.add('is-down');
    pressLane(lane);
  });
  const release = () => pad.classList.remove('is-down');
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  pad.addEventListener('pointerleave', release);
  pad.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pressLane(lane);
    }
  });
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();

  if (state.screen === 'playing') {
    const lane = LANE_KEYS.indexOf(key);
    if (lane >= 0) {
      event.preventDefault();
      pressLane(lane);
      return;
    }
    if (event.key === 'Escape' || key === 'p') {
      event.preventDefault();
      pauseSong();
      return;
    }
    if (key === 'm') {
      state.muted = !state.muted;
      music.setMuted(state.muted);
      updateMuteButton();
      savePrefs();
    }
  } else if (state.screen === 'paused' && (event.key === 'Escape' || key === 'p')) {
    event.preventDefault();
    resumeSong();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'playing') pauseSong();
});

const observer = new ResizeObserver(() => {
  if (!state.song) return;
  resize();
  if (state.screen === 'playing' || state.screen === 'paused') draw(music.getSongTime(), 0);
});
observer.observe(els.canvasWrap);

/* ------------------------------------------------------------------- boot */

renderTracks();
loadPrefs();
updateMuteButton();
updateBestLine();
