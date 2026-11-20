/* ------------------------------------------------------------------ *
 * Bear the Puppy sound effects
 * Tiny generated WebAudio sounds, so there are no audio files to load.
 * The context is created on the first user gesture (browser policy).
 * ------------------------------------------------------------------ */

const VOLUME = 0.32;

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

function makeNoise(context) {
  const length = Math.floor(context.sampleRate * 0.6);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    /* Slightly smoothed white noise: softer than pure static. */
    const white = Math.random() * 2 - 1;
    last = last * 0.35 + white * 0.65;
    data[i] = last;
  }
  return buffer;
}

function ensureContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (error) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function blip({
  type = 'sine',
  freq = 440,
  to = freq,
  dur = 0.16,
  gain = 0.3,
  when = 0,
  attack = 0.012,
}) {
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), start);
  if (to !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  }
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise({
  dur = 0.12,
  gain = 0.3,
  filter = 'bandpass',
  freq = 1200,
  to = freq,
  q = 0.9,
  when = 0,
  attack = 0.006,
}) {
  const start = ctx.currentTime + when;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const shape = ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(Math.max(60, freq), start);
  if (to !== freq) shape.frequency.exponentialRampToValueAtTime(Math.max(60, to), start + dur);
  shape.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  source.connect(shape).connect(env).connect(master);
  source.start(start);
  source.stop(start + dur + 0.05);
}

const SOUNDS = {
  /* A short, friendly double bark. */
  woof() {
    blip({ type: 'sawtooth', freq: 330, to: 170, dur: 0.11, gain: 0.22 });
    noise({ dur: 0.09, gain: 0.16, filter: 'lowpass', freq: 900, to: 380 });
    blip({ type: 'sawtooth', freq: 300, to: 150, dur: 0.13, gain: 0.2, when: 0.16 });
    noise({ dur: 0.1, gain: 0.14, filter: 'lowpass', freq: 820, to: 340, when: 0.16 });
  },

  /* Kibble crunching. */
  crunch() {
    for (let i = 0; i < 2; i += 1) {
      noise({
        dur: 0.07,
        gain: 0.22,
        filter: 'bandpass',
        freq: 2200,
        to: 1200,
        q: 1.4,
        when: i * 0.085,
      });
    }
  },

  /* Water lapping. */
  slurp() {
    noise({ dur: 0.16, gain: 0.14, filter: 'lowpass', freq: 500, to: 1500, q: 2.4 });
    blip({ type: 'sine', freq: 520, to: 900, dur: 0.1, gain: 0.08 });
  },

  /* The tennis ball squeaking. */
  squeak() {
    blip({ type: 'triangle', freq: 980, to: 1560, dur: 0.1, gain: 0.16 });
    blip({ type: 'triangle', freq: 1320, to: 780, dur: 0.09, gain: 0.1, when: 0.08 });
  },

  /* Tail-wagging happy noise. */
  happy() {
    [660, 830, 990].forEach((freq, index) => {
      blip({ type: 'triangle', freq, dur: 0.18, gain: 0.13, when: index * 0.075 });
    });
    noise({ dur: 0.2, gain: 0.08, filter: 'highpass', freq: 1600 });
  },

  /* A big sleepy yawn. */
  yawn() {
    blip({ type: 'sine', freq: 340, to: 170, dur: 0.7, gain: 0.16, attack: 0.18 });
    noise({ dur: 0.6, gain: 0.05, filter: 'lowpass', freq: 700, to: 300 });
  },

  /* Celebration jingle. */
  chime() {
    [523, 659, 784, 1046].forEach((freq, index) => {
      blip({ type: 'sine', freq, dur: 0.5, gain: 0.14, when: index * 0.09 });
    });
  },
};

export function unlock() {
  return Boolean(ensureContext());
}

export function play(name) {
  if (muted) return;
  if (!ensureContext()) return;
  const sound = SOUNDS[name];
  if (!sound) return;
  sound();
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master && ctx) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(muted ? 0 : VOLUME, now, 0.02);
  }
}

export function isMuted() {
  return muted;
}

export default { unlock, play, setMuted, isMuted };
