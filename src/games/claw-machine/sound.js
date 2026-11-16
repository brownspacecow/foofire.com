// Tiny synthesized arcade sounds plus a procedural 8-bit haunted soundtrack.
// No audio files or dependencies.
let context = null;
let enabled = true;
let unlocked = false;
let musicGain = null;
let musicTimer = 0;
let musicPlaying = false;
let musicStep = 0;
let nextMusicTime = 0;

const MUSIC_STEP_TIME = 60 / 100 / 4;
const MUSIC_STEPS = 64;
const MUSIC_BASS = [
  45, 40, 41, 40, 45, 43, 41, 40,
  45, 40, 41, 43, 45, 43, 41, 40,
];
const MUSIC_ARP = [
  57, 60, 64, 69, 53, 57, 60, 65, 50, 53, 57, 62, 52, 55, 59, 64,
  57, 60, 64, 69, 53, 57, 60, 65, 50, 53, 57, 62, 52, 56, 59, 64,
];
const MUSIC_LEAD = {
  0: 69,
  4: 72,
  6: 76,
  8: 74,
  12: 71,
  16: 69,
  20: 72,
  22: 77,
  24: 76,
  28: 72,
  32: 74,
  36: 77,
  38: 81,
  40: 79,
  44: 74,
  48: 71,
  52: 74,
  54: 79,
  56: 78,
  60: 74,
};

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

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function tone(freq, start, duration, type = 'sine', volume = 0.06, endFreq = null) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ------------------------------------------------------------ spooky music
function ensureMusicBus() {
  if (musicGain || !context) return;

  musicGain = context.createGain();
  musicGain.gain.value = 0.0001;
  musicGain.connect(context.destination);

  // A short tape-like echo makes the chips sound like they are in a haunted hall.
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.32;
  const feedback = context.createGain();
  feedback.gain.value = 0.18;
  const echoFilter = context.createBiquadFilter();
  echoFilter.type = 'lowpass';
  echoFilter.frequency.value = 1800;
  const wet = context.createGain();
  wet.gain.value = 0.13;

  musicGain.connect(delay);
  delay.connect(echoFilter);
  echoFilter.connect(feedback);
  feedback.connect(delay);
  echoFilter.connect(wet);
  wet.connect(context.destination);
}

function musicTone(midi, time, duration, type = 'square', volume = 0.02, endMidi = null) {
  if (!enabled || !musicGain || !context) return;
  if (time < context.currentTime - 0.05) return;

  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(midi), time);
  if (endMidi !== null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, midiToFreq(endMidi)),
      time + duration
    );
  }
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.03);
}

function playMusicStep(step, time) {
  if (step % 4 === 0) {
    musicTone(
      MUSIC_BASS[step >> 2],
      time,
      MUSIC_STEP_TIME * 3.4,
      'triangle',
      0.034
    );
  }

  if (step % 2 === 0) {
    musicTone(
      MUSIC_ARP[step >> 1],
      time,
      MUSIC_STEP_TIME * 1.45,
      'square',
      0.014
    );
  }

  const lead = MUSIC_LEAD[step];
  if (lead) {
    musicTone(lead, time, MUSIC_STEP_TIME * 3.2, 'square', 0.024);
  }

  if (step % 16 === 0) {
    // A low, long drone anchors each haunted phrase.
    musicTone(33, time, MUSIC_STEP_TIME * 31, 'triangle', 0.008);
    musicTone(40, time, MUSIC_STEP_TIME * 14, 'sine', 0.011);
    musicTone(43, time, 0.22, 'sine', 0.032, 31);
  }

  if (step % 16 === 8) {
    musicTone(38, time, 0.18, 'sine', 0.026, 30);
  }

  if (step === 32) {
    // A distant ghost wail in the second half of the loop.
    musicTone(84, time, MUSIC_STEP_TIME * 10, 'sine', 0.007, 72);
  }
}

function scheduleMusic() {
  if (!enabled || !musicPlaying || !context) return;
  const now = context.currentTime;
  if (nextMusicTime < now - 0.1) nextMusicTime = now + 0.08;
  const horizon = now + 0.35;

  while (nextMusicTime < horizon) {
    playMusicStep(musicStep, nextMusicTime);
    musicStep = (musicStep + 1) % MUSIC_STEPS;
    nextMusicTime += MUSIC_STEP_TIME;
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
  nextMusicTime = now + 0.1;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(0.0001, now);
  musicGain.gain.exponentialRampToValueAtTime(1, now + 0.8);
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
    musicGain.gain.setTargetAtTime(0.0001, now, 0.08);
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
    if (!enabled) {
      stopMusic();
    } else if (unlocked) {
      startMusic();
    }
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
    tone(440, 0, 0.06, 'square', 0.04);
  },

  move() {
    tone(190, 0, 0.04, 'square', 0.025, 150);
  },

  drop() {
    tone(330, 0, 0.18, 'triangle', 0.05, 160);
  },

  grab() {
    tone(520, 0, 0.09, 'square', 0.05);
    tone(780, 0.08, 0.12, 'square', 0.04);
  },

  miss() {
    tone(220, 0, 0.2, 'sawtooth', 0.035, 120);
  },

  slip() {
    tone(620, 0, 0.16, 'triangle', 0.045, 260);
    tone(260, 0.13, 0.2, 'triangle', 0.035, 120);
  },

  refill() {
    tone(196, 0, 0.14, 'square', 0.04, 392);
    tone(392, 0.12, 0.16, 'square', 0.035, 784);
    tone(784, 0.26, 0.2, 'triangle', 0.03, 1046.5);
  },

  win(legendary = false) {
    const notes = legendary
      ? [523, 659, 784, 1047, 1319, 1568]
      : [523, 659, 784, 1047];
    notes.forEach((note, index) => {
      tone(note, index * 0.09, 0.22, 'triangle', 0.055);
    });
    if (legendary) {
      tone(2093, 0.56, 0.35, 'sine', 0.04);
    }
  },

  complete() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((note, index) => {
      tone(note, index * 0.12, 0.3, 'square', 0.04);
    });
  },
};
