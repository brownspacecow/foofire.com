import { PadSynth, PRESETS } from './synth.js';
import { KEY_NAMES, SCALES, buildPadNotes, padIndex, midiName } from './scales.js';

/* ---------------------------------------------------------------- elements */

const el = {
  canvas: document.querySelector('#pad'),
  note: document.querySelector('#note-readout'),
  tone: document.querySelector('#tone-readout'),
  presetReadout: document.querySelector('#preset-readout'),
  audioLed: document.querySelector('#audio-led'),
  mute: document.querySelector('#mute-button'),
  hint: document.querySelector('#pad-hint'),
  live: document.querySelector('#pad-live'),
  presets: document.querySelector('#preset-buttons'),
  key: document.querySelector('#key-select'),
  scale: document.querySelector('#scale-select'),
  rates: document.querySelector('#rate-buttons'),
  tempo: document.querySelector('#tempo-range'),
  tempoValue: document.querySelector('#tempo-value'),
  gate: document.querySelector('#gate-range'),
  gateValue: document.querySelector('#gate-value'),
  volume: document.querySelector('#volume-range'),
  volumeValue: document.querySelector('#volume-value'),
  loopStatus: document.querySelector('#loop-status'),
  loopPosition: document.querySelector('#loop-position'),
  loopProgress: document.querySelector('#loop-progress'),
  loopTrack: document.querySelector('.pp-loop-track'),
  record: document.querySelector('#record-button'),
  recordLabel: document.querySelector('#record-label'),
  play: document.querySelector('#play-button'),
  clear: document.querySelector('#clear-button'),
  bars: document.querySelector('#bars-select'),
  loopHint: document.querySelector('#loop-hint'),
};

const synth = new PadSynth();
const ctx2d = el.canvas.getContext('2d');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------- state */

const state = {
  presetIndex: 0,
  keyIndex: 0,
  scaleIndex: 0,
  rateDivider: 2,
  tempo: 120,
  gate: 0.55,
  volume: 0.75,
  bars: 4,
  muted: false,
  active: false,
  pointer: { x: 0.5, y: 0.35 },
  notes: [],
  trail: [],
  hits: [],
  lastPreview: 0,
  lastReadout: '',
  lastAnnounce: 0,
  lastProgress: -1,
  lastPosition: '',
};

const view = { w: 0, h: 0, dpr: 1, pad: { x: 0, y: 0, w: 0, h: 0 } };

const transport = {
  ready: false,
  startTime: 0,
  nextStepTime: 0,
  step: 0,
  timer: 0,
};

const loop = {
  steps: state.bars * 16,
  layers: [],
  activeLayer: null,
  anchor: 0,
  playing: false,
  recording: false,
  recordLeft: 0,
};

/* ----------------------------------------------------------------- helpers */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mod = (value, length) => ((value % length) + length) % length;
const TAU = Math.PI * 2;

function rgba(hex, alpha) {
  const value = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

const currentPreset = () => PRESETS[state.presetIndex];
const currentTone = () => 1 - state.pointer.y;

function syncPadNotes() {
  state.notes = buildPadNotes(SCALES[state.scaleIndex], state.keyIndex, currentPreset().octave);
  el.presetReadout.textContent = currentPreset().name;
  updateReadout(true);
}

function currentIndex() {
  return padIndex(state.pointer.x, state.notes.length);
}

function currentNote() {
  if (!state.notes.length) return { midi: 60, name: 'C4' };
  return state.notes[currentIndex()];
}

function updateReadout(force = false) {
  const note = currentNote();
  const text = `${note.name}|${Math.round(currentTone() * 100)}`;
  if (!force && text === state.lastReadout) return;
  state.lastReadout = text;
  el.note.textContent = note.name;
  el.tone.textContent = `${Math.round(currentTone() * 100)}%`;
}

function announce() {
  const now = performance.now();
  if (now - state.lastAnnounce < 300) return;
  state.lastAnnounce = now;
  el.live.textContent = `${currentNote().name}, tone ${Math.round(currentTone() * 100)} percent`;
}

/* ------------------------------------------------------------------- audio */

function setAudioLed(stateName) {
  el.audioLed.dataset.state = stateName;
  el.audioLed.textContent = stateName === 'live' ? 'Live' : stateName === 'error' ? 'Error' : 'Off';
}

let audioStarting = null;

async function ensureAudio() {
  if (transport.ready) {
    if (synth.ctx && synth.ctx.state === 'suspended') {
      try {
        await synth.ctx.resume();
      } catch (error) {
        /* the browser will try again on the next touch */
      }
    }
    return true;
  }
  if (audioStarting) return audioStarting;

  audioStarting = (async () => {
    try {
      await synth.start();
      synth.setTempo(state.tempo);
      synth.setVolume(state.volume);
      synth.setMuted(state.muted);
      transport.ready = true;
      transport.startTime = synth.ctx.currentTime + 0.06;
      transport.nextStepTime = transport.startTime;
      transport.step = 0;
      transport.timer = window.setInterval(schedule, 25);
      setAudioLed('live');
      el.hint.classList.add('is-gone');
      return true;
    } catch (error) {
      setAudioLed('error');
      el.live.textContent = 'Audio could not start in this browser.';
      console.error(error);
      return false;
    } finally {
      audioStarting = null;
    }
  })();

  return audioStarting;
}

const stepSeconds = () => 60 / state.tempo / 4;

function schedule() {
  if (!transport.ready) return;
  const now = synth.ctx.currentTime;
  if (transport.nextStepTime < now - 0.25) {
    // A background tab or a long pause: pick the clock back up rather than
    // firing every missed step at once.
    transport.nextStepTime = now + 0.02;
  }
  const horizon = now + 0.16;
  let guard = 0;
  while (transport.nextStepTime < horizon && guard < 64) {
    onStep(transport.step, transport.nextStepTime);
    transport.step += 1;
    transport.nextStepTime += stepSeconds();
    guard += 1;
  }
}

function pushHit(at, label, x, y, strength = 1) {
  state.hits.push({ at, label, x, y, strength });
  if (state.hits.length > 40) state.hits.shift();
}

function previewNote(force = true) {
  if (!transport.ready || loop.recording) return;
  const now = performance.now();
  if (!force && now - state.lastPreview < 90) return;
  state.lastPreview = now;
  const note = currentNote();
  const at = synth.ctx.currentTime + 0.005;
  synth.play({
    midi: note.midi,
    tone: currentTone(),
    when: at,
    duration: 0.16,
    preset: currentPreset(),
  });
  pushHit(at, note.name, state.pointer.x, state.pointer.y, 0.6);
  updateReadout();
}

/* ------------------------------------------------------------- step engine */

function onStep(step, when) {
  const preset = currentPreset();
  const rate = state.rateDivider;
  const duration = Math.max(0.05, stepSeconds() * rate * state.gate);
  const gateStep = step % rate === 0;

  let recordedHere = false;
  let finishedHere = false;

  if (gateStep && state.active) {
    const note = currentNote();
    synth.play({
      midi: note.midi,
      tone: currentTone(),
      when,
      duration,
      preset,
    });
    pushHit(when, note.name, state.pointer.x, state.pointer.y);
    if (loop.recording && loop.activeLayer) {
      recordEvent(step, note);
      recordedHere = true;
    }
  }

  if (loop.recording) {
    loop.recordLeft -= 1;
    if (loop.recordLeft <= 0) {
      finishRecording();
      finishedHere = true;
    }
  }

  if (loop.playing && loop.layers.length && !finishedHere) {
    const position = mod(step - loop.anchor, loop.steps);
    const layers = loop.recording ? loop.layers.slice(0, -1) : loop.layers;
    for (const layer of layers) {
      if (recordedHere && layer === loop.activeLayer) continue;
      for (const event of layer) {
        if (event.step !== position) continue;
        synth.play({
          midi: event.midi,
          tone: event.tone,
          when,
          duration: Math.max(0.05, stepSeconds() * rate * state.gate),
          preset,
        });
        pushHit(when, midiName(event.midi), event.x, event.y, 0.5);
      }
    }
  }
}

function recordEvent(step, note) {
  if (!loop.activeLayer) return;
  const position = mod(step - loop.anchor, loop.steps);
  const event = {
    step: position,
    midi: note.midi,
    tone: currentTone(),
    x: state.pointer.x,
    y: state.pointer.y,
  };
  const existing = loop.activeLayer.findIndex((item) => item.step === position);
  if (existing >= 0) loop.activeLayer.splice(existing, 1, event);
  else loop.activeLayer.push(event);
}

function finishRecording() {
  if (!loop.recording) return;
  loop.recording = false;
  loop.activeLayer = null;
  loop.recordLeft = 0;
  loop.playing = loop.layers.some((layer) => layer.length > 0);
  updateLoopUI();
}

async function handleRecord() {
  if (loop.recording) {
    if (loop.layers.length > 1) finishRecording();
    return;
  }

  const ok = await ensureAudio();
  if (!ok) return;

  const hasContent = loop.layers.some((layer) => layer.length > 0);
  if (!hasContent) {
    loop.layers = [[]];
    loop.anchor = transport.step;
    loop.playing = false;
  } else {
    if (!loop.playing) loop.anchor = transport.step;
    const layer = [];
    loop.layers.push(layer);
    loop.playing = true;
  }

  loop.activeLayer = loop.layers[loop.layers.length - 1];
  loop.recording = true;
  loop.recordLeft = loop.steps;
  updateLoopUI();
}

function resetLoop() {
  loop.layers = [];
  loop.activeLayer = null;
  loop.playing = false;
  loop.recording = false;
  loop.recordLeft = 0;
  loop.anchor = transport.step;
  updateLoopUI();
}

async function handlePlay() {
  const hasContent = loop.layers.some((layer) => layer.length > 0);
  if (!hasContent) return;
  const ok = await ensureAudio();
  if (!ok) return;

  if (loop.playing) {
    loop.playing = false;
    loop.recording = false;
    loop.activeLayer = null;
  } else {
    loop.anchor = transport.step;
    loop.playing = true;
  }
  updateLoopUI();
}

/* -------------------------------------------------------------- loop view */

function setLoopStatus(text, kind) {
  el.loopStatus.textContent = text;
  el.loopStatus.dataset.state = kind;
}

function updateLoopUI() {
  const hasContent = loop.layers.some((layer) => layer.length > 0);
  const firstPass = loop.recording && loop.layers.length === 1;

  el.record.disabled = firstPass;
  el.play.disabled = loop.recording || !hasContent;
  el.clear.disabled = !hasContent && !loop.recording;
  el.bars.disabled = loop.recording;

  el.record.classList.toggle('is-recording', loop.recording);
  el.record.setAttribute('aria-pressed', String(loop.recording));
  el.record.setAttribute(
    'aria-label',
    loop.recording ? 'Stop recording the loop' : hasContent ? 'Overdub a new loop layer' : 'Record a loop'
  );
  el.recordLabel.textContent = loop.recording
    ? firstPass
      ? 'REC…'
      : 'STOP DUB'
    : hasContent
      ? 'OVERDUB'
      : 'REC';

  el.play.setAttribute('aria-pressed', String(loop.playing && !loop.recording));
  el.play.textContent = loop.playing ? '❚❚ STOP' : '▶ PLAY';

  if (loop.recording) setLoopStatus(firstPass ? 'Recording' : 'Overdub', 'recording');
  else if (loop.playing) setLoopStatus('Playing', 'playing');
  else if (hasContent) setLoopStatus('Stopped', 'stopped');
  else setLoopStatus('Empty', 'empty');

  if (loop.recording && firstPass) {
    el.loopHint.textContent =
      'Recording the first loop — it closes automatically at the end of the pattern.';
  } else if (loop.recording) {
    el.loopHint.textContent =
      'Overdubbing a new layer. Press STOP DUB when you are happy with it.';
  } else if (loop.playing) {
    el.loopHint.textContent =
      'Add another layer, or change the sound — the whole loop plays back with it.';
  } else if (hasContent) {
    el.loopHint.textContent = 'Press PLAY to bring the loop back.';
  } else {
    el.loopHint.textContent =
      'Hit REC and slide a phrase. It loops automatically, then you can stack layers.';
  }
}

function visualStepFloat() {
  if (!transport.ready || !synth.ctx) return 0;
  const ahead = Math.max(0, transport.nextStepTime - synth.ctx.currentTime);
  return transport.step - ahead / stepSeconds();
}

function loopPlayhead() {
  return mod(visualStepFloat() - loop.anchor, loop.steps);
}

function updateLoopMeter() {
  const hasContent = loop.layers.some((layer) => layer.length > 0);
  let progress = 0;
  let label = `${state.bars} bars`;

  if (loop.recording) {
    progress = clamp((loop.steps - loop.recordLeft) / loop.steps, 0, 1);
    const bar = Math.min(state.bars, Math.floor(progress * state.bars) + 1);
    label = `REC · bar ${bar}/${state.bars}`;
  } else if (loop.playing) {
    progress = loopPlayhead() / loop.steps;
    const bar = Math.min(state.bars, Math.floor(progress * state.bars) + 1);
    label = `Bar ${bar} / ${state.bars}`;
  } else if (hasContent) {
    label = `${state.bars} bars · ${loop.layers.length} layer${loop.layers.length === 1 ? '' : 's'}`;
  }

  if (Math.abs(progress - state.lastProgress) > 0.0015) {
    state.lastProgress = progress;
    el.loopProgress.style.transform = `scaleX(${progress})`;
    el.loopTrack.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }
  if (label !== state.lastPosition) {
    state.lastPosition = label;
    el.loopPosition.textContent = label;
  }
}

/* ------------------------------------------------------------------ canvas */

function resize() {
  const rect = el.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  view.w = rect.width;
  view.h = rect.height;
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  el.canvas.width = Math.round(view.w * view.dpr);
  el.canvas.height = Math.round(view.h * view.dpr);
  ctx2d.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  const gutter = view.w < 430 ? 34 : 46;
  view.pad = {
    x: gutter,
    y: 26,
    w: view.w - gutter - 16,
    h: view.h - 26 - 34,
  };
}

function draw() {
  const { w, h, pad } = view;
  if (!w || !h) return;

  const preset = currentPreset();
  const accent = preset.color;
  const active = state.active;
  const count = state.notes.length || 1;
  const activeIndex = currentIndex();
  const now = synth.ctx ? synth.ctx.currentTime : 0;

  ctx2d.clearRect(0, 0, w, h);
  const backdrop = ctx2d.createLinearGradient(0, 0, 0, h);
  backdrop.addColorStop(0, '#0d0620');
  backdrop.addColorStop(1, '#04020a');
  ctx2d.fillStyle = backdrop;
  ctx2d.fillRect(0, 0, w, h);

  const padFill = ctx2d.createLinearGradient(0, pad.y, 0, pad.y + pad.h);
  padFill.addColorStop(0, rgba(accent, 0.14));
  padFill.addColorStop(0.6, '#120a2a');
  padFill.addColorStop(1, '#07030f');
  ctx2d.fillStyle = padFill;
  ctx2d.fillRect(pad.x, pad.y, pad.w, pad.h);

  ctx2d.save();
  ctx2d.beginPath();
  ctx2d.rect(pad.x, pad.y, pad.w, pad.h);
  ctx2d.clip();

  const band = pad.w / Math.max(1, count - 1);
  if (count > 1) {
    const bandX = pad.x + (activeIndex / (count - 1)) * pad.w;
    ctx2d.fillStyle = rgba(accent, active ? 0.1 : 0.04);
    ctx2d.fillRect(bandX - band / 2, pad.y, band, pad.h);
  }

  ctx2d.strokeStyle = 'rgba(255, 248, 231, 0.07)';
  ctx2d.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    const x = pad.x + (i / Math.max(1, count - 1)) * pad.w;
    ctx2d.beginPath();
    ctx2d.moveTo(x + 0.5, pad.y);
    ctx2d.lineTo(x + 0.5, pad.y + pad.h);
    ctx2d.stroke();
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.y + (i / 4) * pad.h;
    ctx2d.beginPath();
    ctx2d.moveTo(pad.x, y + 0.5);
    ctx2d.lineTo(pad.x + pad.w, y + 0.5);
    ctx2d.stroke();
  }

  // Soft light under the finger.
  const cursorX = pad.x + state.pointer.x * pad.w;
  const cursorY = pad.y + state.pointer.y * pad.h;
  if (active) {
    const glow = ctx2d.createRadialGradient(
      cursorX,
      cursorY,
      0,
      cursorX,
      cursorY,
      Math.max(pad.w, pad.h) * 0.42
    );
    glow.addColorStop(0, rgba(accent, 0.22));
    glow.addColorStop(1, rgba(accent, 0));
    ctx2d.fillStyle = glow;
    ctx2d.fillRect(pad.x, pad.y, pad.w, pad.h);
  }

  // The recorded phrase, drawn where it was played.
  if (loop.layers.length) {
    const highlight = loop.playing ? Math.round(loopPlayhead()) % loop.steps : -1;
    for (const layer of loop.layers) {
      for (const event of layer) {
        const x = pad.x + clamp(event.x, 0, 1) * pad.w;
        const y = pad.y + clamp(event.y, 0, 1) * pad.h;
        const on = loop.playing && !loop.recording && event.step === highlight;
        ctx2d.beginPath();
        ctx2d.arc(x, y, on ? 4.5 : 2.4, 0, TAU);
        ctx2d.fillStyle = on ? accent : rgba(accent, 0.32);
        if (on) {
          ctx2d.shadowColor = accent;
          ctx2d.shadowBlur = 12;
        }
        ctx2d.fill();
        ctx2d.shadowBlur = 0;
      }
    }
  }

  if (state.trail.length > 1) {
    ctx2d.lineWidth = 3;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
    for (let i = 1; i < state.trail.length; i += 1) {
      const a = state.trail[i - 1];
      const b = state.trail[i];
      const life = Math.max(0, Math.min(a.life, b.life));
      ctx2d.strokeStyle = rgba(accent, 0.4 * life);
      ctx2d.beginPath();
      ctx2d.moveTo(pad.x + a.x * pad.w, pad.y + a.y * pad.h);
      ctx2d.lineTo(pad.x + b.x * pad.w, pad.y + b.y * pad.h);
      ctx2d.stroke();
    }
  }

  for (const hit of state.hits) {
    const age = now - hit.at;
    if (age < 0 || age > 0.8) continue;
    const life = 1 - age / 0.8;
    ctx2d.strokeStyle = rgba(accent, life * 0.7 * hit.strength);
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.arc(
      pad.x + clamp(hit.x, 0, 1) * pad.w,
      pad.y + clamp(hit.y, 0, 1) * pad.h,
      8 + age * 70,
      0,
      TAU
    );
    ctx2d.stroke();
  }

  // Crosshair and cursor ring.
  ctx2d.save();
  ctx2d.setLineDash([4, 6]);
  ctx2d.strokeStyle = rgba(accent, active ? 0.42 : 0.16);
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(cursorX, pad.y);
  ctx2d.lineTo(cursorX, pad.y + pad.h);
  ctx2d.moveTo(pad.x, cursorY);
  ctx2d.lineTo(pad.x + pad.w, cursorY);
  ctx2d.stroke();
  ctx2d.restore();

  ctx2d.beginPath();
  ctx2d.arc(cursorX, cursorY, active ? 18 : 12, 0, TAU);
  ctx2d.strokeStyle = active ? accent : rgba(accent, 0.4);
  ctx2d.lineWidth = active ? 3 : 2;
  ctx2d.stroke();
  ctx2d.beginPath();
  ctx2d.arc(cursorX, cursorY, 3.5, 0, TAU);
  ctx2d.fillStyle = active ? accent : rgba(accent, 0.55);
  ctx2d.fill();

  if (active) {
    const label = currentNote().name;
    ctx2d.font = '700 11px Inter, system-ui, sans-serif';
    ctx2d.textAlign = 'left';
    ctx2d.textBaseline = 'middle';
    const labelX = cursorX + 24 + 30 > pad.x + pad.w ? cursorX - 54 : cursorX + 24;
    ctx2d.fillStyle = accent;
    ctx2d.fillText(label, labelX, cursorY);
  }

  ctx2d.restore();

  // Frame, corner ticks, and axis labels.
  ctx2d.strokeStyle = 'rgba(255, 248, 231, 0.18)';
  ctx2d.lineWidth = 2;
  ctx2d.strokeRect(pad.x + 0.5, pad.y + 0.5, pad.w - 1, pad.h - 1);

  ctx2d.strokeStyle = rgba(accent, 0.7);
  ctx2d.lineWidth = 2;
  const tick = 12;
  const corners = [
    [pad.x, pad.y, 1, 1],
    [pad.x + pad.w, pad.y, -1, 1],
    [pad.x, pad.y + pad.h, 1, -1],
    [pad.x + pad.w, pad.y + pad.h, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx2d.beginPath();
    ctx2d.moveTo(x + dx * tick, y);
    ctx2d.lineTo(x, y);
    ctx2d.lineTo(x, y + dy * tick);
    ctx2d.stroke();
  }

  const spacing = pad.w / Math.max(1, count - 1);
  const stride = spacing < 26 ? 2 : 1;
  ctx2d.font = '700 10px Inter, system-ui, sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'top';
  for (let i = 0; i < count; i += stride) {
    const x = clamp(
      pad.x + (i / Math.max(1, count - 1)) * pad.w,
      pad.x + 14,
      pad.x + pad.w - 14
    );
    const isCurrent = i === activeIndex;
    ctx2d.fillStyle = isCurrent && active ? accent : 'rgba(188, 172, 240, 0.62)';
    ctx2d.fillText(state.notes[i].name, x, pad.y + pad.h + 9);
  }

  const labelSize = view.w < 430 ? 7 : 8;
  ctx2d.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  ctx2d.textBaseline = 'middle';
  ctx2d.fillStyle = 'rgba(188, 172, 240, 0.55)';
  ctx2d.textAlign = 'left';
  ctx2d.fillText('BRIGHT', 4, pad.y + 6);
  ctx2d.fillText('DARK', 4, pad.y + pad.h - 6);
  ctx2d.save();
  ctx2d.translate(view.w < 430 ? 22 : 30, pad.y + pad.h / 2);
  ctx2d.rotate(-Math.PI / 2);
  ctx2d.textAlign = 'center';
  ctx2d.fillText('TONE', 0, 0);
  ctx2d.restore();
}

/* ---------------------------------------------------------------- animation */

let lastFrame = performance.now();

function frame(nowMs) {
  const dt = Math.min(0.05, Math.max(0, (nowMs - lastFrame) / 1000));
  lastFrame = nowMs;

  if (state.active && !motionQuery.matches) {
    const last = state.trail[state.trail.length - 1];
    if (!last || Math.hypot(state.pointer.x - last.x, state.pointer.y - last.y) > 0.003) {
      state.trail.push({ x: state.pointer.x, y: state.pointer.y, life: 1 });
      if (state.trail.length > 30) state.trail.shift();
    }
  }
  for (const point of state.trail) point.life -= dt * 1.8;
  state.trail = state.trail.filter((point) => point.life > 0);

  if (synth.ctx) {
    state.hits = state.hits.filter((hit) => synth.ctx.currentTime - hit.at < 0.9);
  }

  draw();
  updateLoopMeter();
  window.requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------- input */

function updatePointer(x, y) {
  const previous = currentIndex();
  state.pointer.x = clamp(x, 0, 1);
  state.pointer.y = clamp(y, 0, 1);
  updateReadout();
  const index = currentIndex();
  if (index !== previous) {
    if (state.active) previewNote(false);
    announce();
  }
}

function setPointerFromEvent(event) {
  const rect = el.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  if (!view.pad.w) resize();
  const x = ((event.clientX - rect.left) / rect.width) * view.w;
  const y = ((event.clientY - rect.top) / rect.height) * view.h;
  updatePointer((x - view.pad.x) / view.pad.w, (y - view.pad.y) / view.pad.h);
}

function releasePad() {
  state.active = false;
}

el.canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  el.canvas.focus({ preventScroll: true });
  state.active = true;
  setPointerFromEvent(event);
  try {
    el.canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    /* not all browsers support capture on every pointer */
  }
  ensureAudio().then((ok) => {
    if (ok) previewNote(true);
  });
});

el.canvas.addEventListener('pointermove', (event) => {
  setPointerFromEvent(event);
  if (state.active) event.preventDefault();
});

el.canvas.addEventListener('pointerup', releasePad);
el.canvas.addEventListener('pointercancel', releasePad);
el.canvas.addEventListener('lostpointercapture', releasePad);
el.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

el.canvas.addEventListener('keydown', (event) => {
  const move = event.shiftKey ? 0.12 : 0.04;
  let handled = true;

  switch (event.key) {
    case 'ArrowLeft':
      updatePointer(state.pointer.x - move, state.pointer.y);
      break;
    case 'ArrowRight':
      updatePointer(state.pointer.x + move, state.pointer.y);
      break;
    case 'ArrowUp':
      updatePointer(state.pointer.x, state.pointer.y - move);
      break;
    case 'ArrowDown':
      updatePointer(state.pointer.x, state.pointer.y + move);
      break;
    case ' ':
    case 'Enter':
      if (!event.repeat) {
        state.active = true;
        ensureAudio().then((ok) => {
          if (ok) previewNote(true);
        });
      }
      break;
    default:
      handled = false;
  }

  if (handled) event.preventDefault();
});

el.canvas.addEventListener('keyup', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    state.active = false;
  }
});

el.canvas.addEventListener('blur', releasePad);
window.addEventListener('blur', releasePad);

/* --------------------------------------------------------------- controls */

function renderPresets() {
  for (let index = 0; index < PRESETS.length; index += 1) {
    const preset = PRESETS[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pp-preset';
    button.dataset.index = String(index);
    button.setAttribute('aria-pressed', String(index === state.presetIndex));

    const number = document.createElement('span');
    number.className = 'pp-preset-no';
    number.textContent = String(index + 1).padStart(2, '0');

    const name = document.createElement('span');
    name.textContent = preset.name;

    const tag = document.createElement('small');
    tag.className = 'pp-preset-tag';
    tag.textContent = preset.tag;

    button.append(number, name, tag);
    button.addEventListener('click', () => choosePreset(index));
    el.presets.append(button);
  }
}

function choosePreset(index) {
  if (index < 0 || index >= PRESETS.length) return;
  state.presetIndex = index;
  for (const button of el.presets.querySelectorAll('.pp-preset')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
  }
  syncPadNotes();
  if (transport.ready && !loop.recording) previewNote(true);
}

function setRate(divider) {
  state.rateDivider = [1, 2, 4].includes(divider) ? divider : 2;
  for (const button of el.rates.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === state.rateDivider));
  }
}

function updateMuteButton() {
  el.mute.textContent = state.muted ? '🔇' : '🔊';
  el.mute.setAttribute('aria-pressed', String(state.muted));
  el.mute.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
}

KEY_NAMES.forEach((name, index) => {
  el.key.add(new Option(name, String(index)));
});
SCALES.forEach((scale, index) => {
  el.scale.add(new Option(scale.name, String(index)));
});
el.key.value = String(state.keyIndex);
el.scale.value = String(state.scaleIndex);

el.key.addEventListener('change', () => {
  state.keyIndex = clamp(Number(el.key.value) || 0, 0, 11);
  syncPadNotes();
  announce();
});

el.scale.addEventListener('change', () => {
  state.scaleIndex = clamp(Number(el.scale.value) || 0, 0, SCALES.length - 1);
  syncPadNotes();
  announce();
});

for (const button of el.rates.querySelectorAll('button')) {
  button.addEventListener('click', () => setRate(Number(button.dataset.rate)));
}

el.tempo.addEventListener('input', () => {
  state.tempo = clamp(Number(el.tempo.value) || 120, 60, 180);
  el.tempoValue.textContent = String(state.tempo);
  synth.setTempo(state.tempo);
});

el.gate.addEventListener('input', () => {
  state.gate = clamp((Number(el.gate.value) || 55) / 100, 0.1, 0.95);
  el.gateValue.textContent = `${Math.round(state.gate * 100)}%`;
});

el.volume.addEventListener('input', () => {
  state.volume = clamp((Number(el.volume.value) || 0) / 100, 0, 1);
  el.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  synth.setVolume(state.volume);
});

el.mute.addEventListener('click', () => {
  state.muted = !state.muted;
  synth.setMuted(state.muted);
  updateMuteButton();
});

el.record.addEventListener('click', handleRecord);
el.play.addEventListener('click', handlePlay);
el.clear.addEventListener('click', resetLoop);

el.bars.addEventListener('change', () => {
  state.bars = [2, 4, 8].includes(Number(el.bars.value)) ? Number(el.bars.value) : 4;
  loop.steps = state.bars * 16;
  resetLoop();
  state.lastProgress = -1;
  state.lastPosition = '';
  updateLoopMeter();
});

/* --------------------------------------------------------------------- boot */

el.tempoValue.textContent = String(state.tempo);
el.gateValue.textContent = `${Math.round(state.gate * 100)}%`;
el.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
setAudioLed('off');
renderPresets();
setRate(state.rateDivider);
syncPadNotes();
updateMuteButton();
updateLoopUI();
resize();

if ('ResizeObserver' in window) {
  new ResizeObserver(resize).observe(el.canvas);
} else {
  window.addEventListener('resize', resize);
}

window.requestAnimationFrame(frame);
