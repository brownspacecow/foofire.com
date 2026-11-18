// Synthesised Christmas bells, a gentle sleigh-bell loop, and cartoon launch
// effects. No audio files, no dependencies.

let context = null;
let enabled = true;
let unlocked = false;
let musicGain = null;
let musicPlaying = false;
let musicTimer = 0;
let musicStep = 0;
let nextMusicTime = 0;

const STEP = 60 / 96 / 4;
const STEPS = 64;

// A music-box loop in C: C – Am – F – G, with a falling bell melody.
const BASS = [48, 48, 45, 45, 41, 41, 43, 43];
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const MELODY = {
  0: 76, 3: 79, 6: 84, 8: 83, 12: 79, 16: 81, 20: 84, 24: 79,
  28: 76, 32: 76, 35: 79, 38: 84, 40: 81, 44: 77, 48: 79, 52: 83,
  56: 84, 60: 79,
};

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function ensureContext() {
  if (context) return context;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

function tone(frequency, start, duration, type = 'sine', volume = 0.05, endFrequency = null) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), t0 + duration);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function noiseBurst(duration = 0.4, volume = 0.12, start = 0) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, ctx.currentTime + start);
  filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + start + duration);
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + start);
  source.stop(ctx.currentTime + start + duration);
}

function ensureMusicBus() {
  if (musicGain || !context) return;
  musicGain = context.createGain();
  musicGain.gain.value = 0.0001;
  musicGain.connect(context.destination);

  const delay = context.createDelay(1);
  delay.delayTime.value = 0.26;
  const feedback = context.createGain();
  feedback.gain.value = 0.16;
  const wet = context.createGain();
  wet.gain.value = 0.16;
  musicGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(context.destination);
}

function musicTone(midi, time, duration, type = 'triangle', volume = 0.02) {
  if (!enabled || !musicGain || !context) return;
  if (time < context.currentTime - 0.05) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToFrequency(midi), time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.03);
}

function playStep(step, time) {
  const bar = Math.floor(step / 16) % 4;
  if (step % 8 === 0) {
    musicTone(BASS[step >> 3], time, STEP * 6, 'triangle', 0.036);
  }
  if (step % 4 === 0) {
    const chord = CHORDS[bar];
    chord.forEach((note, index) => {
      musicTone(note + (index === 2 ? 12 : 0), time + index * 0.012, STEP * 3.4, 'sine', 0.012);
    });
  }
  if (step % 2 === 0) {
    const note = 72 + ((step * 5) % 12);
    musicTone(note, time, STEP * 1.2, 'triangle', 0.006);
  }
  const lead = MELODY[step];
  if (lead) musicTone(lead, time, STEP * 3.6, 'triangle', 0.026);
  if (step % 32 === 16) {
    // Sleigh bells.
    [96, 100, 103].forEach((midi, index) => {
      musicTone(midi, time + index * 0.06, 0.22, 'sine', 0.008);
    });
  }
}

function scheduleMusic() {
  if (!enabled || !musicPlaying || !context) return;
  const now = context.currentTime;
  if (nextMusicTime < now - 0.1) nextMusicTime = now + 0.06;
  const horizon = now + 0.35;
  while (nextMusicTime < horizon) {
    playStep(musicStep, nextMusicTime);
    musicStep = (musicStep + 1) % STEPS;
    nextMusicTime += STEP;
  }
}

function startMusic() {
  if (!enabled || !unlocked || musicPlaying) return;
  const ctx = ensureContext();
  if (!ctx) return;
  ensureMusicBus();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  musicPlaying = true;
  musicStep = 0;
  const now = ctx.currentTime;
  nextMusicTime = now + 0.12;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(0.0001, now);
  musicGain.gain.exponentialRampToValueAtTime(1, now + 1.2);
  scheduleMusic();
  musicTimer = window.setInterval(scheduleMusic, 90);
}

function stopMusic() {
  musicPlaying = false;
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = 0;
  }
  if (musicGain && context) {
    const now = context.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setTargetAtTime(0.0001, now, 0.1);
  }
}

export const sound = {
  isEnabled() {
    return enabled;
  },

  setEnabled(value) {
    const next = Boolean(value);
    if (next === enabled) return;
    enabled = next;
    if (!enabled) stopMusic();
    else if (unlocked) startMusic();
  },

  unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (enabled) startMusic();
  },

  pause() {
    stopMusic();
    if (context) context.suspend().catch(() => {});
  },

  resume() {
    if (!context || !unlocked) return;
    context
      .resume()
      .then(() => {
        if (enabled) startMusic();
      })
      .catch(() => {});
  },

  click() {
    tone(660, 0, 0.06, 'square', 0.035);
  },

  select() {
    tone(784, 0, 0.08, 'triangle', 0.04);
    tone(1047, 0.06, 0.09, 'triangle', 0.03);
  },

  buy() {
    [784, 988, 1319].forEach((note, index) => tone(note, index * 0.07, 0.16, 'triangle', 0.045));
  },

  denied() {
    tone(220, 0, 0.14, 'sawtooth', 0.03, 160);
    tone(180, 0.1, 0.16, 'sawtooth', 0.025, 120);
  },

  hang() {
    tone(1047, 0, 0.08, 'sine', 0.04);
    tone(1568, 0.05, 0.13, 'sine', 0.03);
  },

  unhang() {
    tone(784, 0, 0.08, 'sine', 0.03);
    tone(523, 0.05, 0.12, 'sine', 0.025);
  },

  countdown() {
    tone(523, 0, 0.12, 'square', 0.045);
  },

  go() {
    tone(1047, 0, 0.3, 'square', 0.05);
    tone(1319, 0.06, 0.35, 'triangle', 0.04);
  },

  launch() {
    noiseBurst(1.5, 0.1);
    tone(110, 0, 1.4, 'sawtooth', 0.05, 440);
    tone(220, 0.15, 1.2, 'triangle', 0.04, 880);
  },

  boom() {
    noiseBurst(1.4, 0.22);
    tone(90, 0, 1.2, 'sine', 0.14, 35);
    tone(150, 0.04, 0.8, 'sawtooth', 0.07, 45);
  },

  whoosh() {
    noiseBurst(0.7, 0.05);
  },

  fanfare() {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((note, index) => {
      tone(note, index * 0.12, 0.32, 'triangle', 0.05);
    });
  },
};
