// Tiny synthesized arcade sounds for the ball pit. No audio files.
let context = null;
let muted = false;

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

function tone(freq, start, duration, type = 'sine', volume = 0.05, endFreq = null) {
  if (muted) return;
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
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const RARITY_REWARD = {
  junk: [392, 440],
  common: [494, 587],
  uncommon: [523, 659, 784],
  rare: [523, 659, 784, 988],
  ultra: [523, 659, 784, 1047, 1319, 1568, 2093],
};

export const sound = {
  isMuted() {
    return muted;
  },

  setMuted(value) {
    muted = Boolean(value);
  },

  unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  },

  click() {
    tone(440, 0, 0.05, 'square', 0.03);
  },

  dig() {
    tone(150, 0, 0.16, 'sawtooth', 0.03, 70);
    tone(240, 0.02, 0.1, 'triangle', 0.025, 110);
  },

  empty() {
    tone(180, 0, 0.12, 'triangle', 0.02, 120);
  },

  find(rarity = 'junk') {
    const notes = RARITY_REWARD[rarity] || RARITY_REWARD.junk;
    notes.forEach((note, index) => {
      tone(note, index * 0.07, 0.2, 'triangle', 0.045);
    });
  },

  event() {
    [392, 523, 659, 784].forEach((note, index) => {
      tone(note, index * 0.08, 0.18, 'triangle', 0.05);
    });
  },

  burp() {
    tone(110, 0, 0.28, 'sawtooth', 0.035, 55);
    tone(70, 0.18, 0.35, 'triangle', 0.03, 45);
  },

  ultra() {
    RARITY_REWARD.ultra.forEach((note, index) => {
      tone(note, index * 0.1, 0.35, 'square', 0.035);
      tone(note * 2, index * 0.1 + 0.04, 0.25, 'sine', 0.02);
    });
    tone(1568, 0.85, 0.6, 'sine', 0.04, 2093);
  },

  coin() {
    tone(880, 0, 0.07, 'square', 0.035);
    tone(1319, 0.06, 0.12, 'square', 0.03);
  },

  buy() {
    [523, 659, 784, 1047].forEach((note, index) => {
      tone(note, index * 0.06, 0.16, 'triangle', 0.045);
    });
  },

  error() {
    tone(220, 0, 0.12, 'square', 0.03, 160);
  },
};
