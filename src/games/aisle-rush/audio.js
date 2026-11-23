/**
 * Aisle Rush '85 — tiny synthesized show band.
 * Everything is made with the Web Audio API: no files, no downloads.
 */

const BASS = {
  a2: 110,
  c3: 130.81,
  d3: 146.83,
  e3: 164.81,
  f3: 174.61,
  g3: 196,
  a3: 220,
  c4: 261.63,
  d4: 293.66,
  e4: 329.63,
  g4: 392,
  a4: 440,
  b4: 493.88,
  c5: 523.25,
  d5: 587.33,
  e5: 659.25,
  g5: 783.99,
  a5: 880,
  c6: 1046.5,
};

const PATTERNS = {
  quiz: {
    step: 0.24,
    bass: [BASS.a2, 0, BASS.a2, 0, BASS.f3, 0, BASS.f3, 0, BASS.c3, 0, BASS.c3, 0, BASS.g3, 0, BASS.g3, 0],
    lead: [0, 0, BASS.a4, 0, 0, 0, BASS.g4, 0, 0, 0, BASS.c5, 0, 0, 0, BASS.g4, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
  sweep: {
    step: 0.155,
    bass: [
      BASS.a2, BASS.a2, BASS.c3, BASS.a2, BASS.e3, BASS.a2, BASS.g3, BASS.a2,
      BASS.a2, BASS.a2, BASS.c3, BASS.a2, BASS.d3, BASS.a2, BASS.e3, BASS.g3,
    ],
    lead: [
      BASS.a4, 0, BASS.c5, 0, BASS.e5, 0, BASS.c5, 0,
      BASS.g4, 0, BASS.a4, 0, BASS.c5, 0, BASS.d5, 0,
    ],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
  bonus: {
    step: 0.135,
    bass: [
      BASS.a2, BASS.a3, BASS.a2, BASS.c3, BASS.a2, BASS.e3, BASS.a2, BASS.g3,
      BASS.a2, BASS.a3, BASS.a2, BASS.c3, BASS.d3, BASS.e3, BASS.g3, BASS.a3,
    ],
    lead: [
      BASS.a5, 0, BASS.e5, 0, BASS.c5, 0, BASS.e5, 0,
      BASS.g5, 0, BASS.e5, 0, BASS.a5, 0, BASS.c6, 0,
    ],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0],
  },
};

export function createShowAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let isMuted = Boolean(muted);
  let patternName = null;
  let scheduler = null;
  let stepIndex = 0;
  let nextStepAt = 0;

  const supported = () =>
    typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

  function ensure() {
    if (!supported()) return null;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = isMuted ? 0 : 0.42;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function unlock() {
    ensure();
  }

  function tone({ freq, type = 'square', dur = 0.1, gain = 0.12, at = 0, slide = 0, attack = 0.005 }) {
    if (!ctx || isMuted) return;
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), start + dur);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function noise({ dur = 0.12, gain = 0.08, at = 0, highpass = 1200, lowpass = 12000 }) {
    if (!ctx || isMuted) return;
    const start = ctx.currentTime + at;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (highpass + lowpass) / 2;
    filter.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter).connect(env).connect(master);
    source.start(start);
    source.stop(start + dur);
  }

  function kick(at = 0, gain = 0.18) {
    tone({ freq: 140, type: 'sine', dur: 0.16, gain, at, slide: -90 });
  }

  function startScheduler() {
    if (!ctx || scheduler) return;
    nextStepAt = ctx.currentTime + 0.08;
    stepIndex = 0;
    const tick = () => {
      if (!ctx || isMuted || !patternName) return;
      const pattern = PATTERNS[patternName];
      while (nextStepAt < ctx.currentTime + 0.3) {
        const at = nextStepAt - ctx.currentTime;
        const i = stepIndex % pattern.bass.length;
        if (pattern.bass[i]) tone({ freq: pattern.bass[i], type: 'triangle', dur: pattern.step * 0.9, gain: 0.055, at });
        if (pattern.lead[i]) tone({ freq: pattern.lead[i], type: 'square', dur: pattern.step * 0.55, gain: 0.018, at });
        if (pattern.kick[i]) kick(at, 0.06);
        if (pattern.hat[i]) noise({ dur: 0.035, gain: 0.018, at, highpass: 5000, lowpass: 11000 });
        nextStepAt += pattern.step;
        stepIndex += 1;
      }
    };
    tick();
    scheduler = window.setInterval(tick, 80);
  }

  function stopScheduler() {
    if (scheduler) window.clearInterval(scheduler);
    scheduler = null;
  }

  function setPattern(name) {
    patternName = name || null;
    stopScheduler();
    if (patternName && ctx && !isMuted) startScheduler();
  }

  function sfx(name) {
    if (isMuted || !ensure()) return;
    switch (name) {
      case 'click':
        tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.05, slide: 120 });
        break;
      case 'ding':
        tone({ freq: 880, type: 'sine', dur: 0.16, gain: 0.13 });
        tone({ freq: 1320, type: 'sine', dur: 0.22, gain: 0.08, at: 0.045 });
        break;
      case 'buzz':
        tone({ freq: 150, type: 'sawtooth', dur: 0.24, gain: 0.1, slide: -40 });
        tone({ freq: 112, type: 'square', dur: 0.2, gain: 0.05 });
        break;
      case 'tick':
        tone({ freq: 1200, type: 'square', dur: 0.03, gain: 0.045 });
        break;
      case 'beep':
        tone({ freq: 760, type: 'square', dur: 0.09, gain: 0.07 });
        break;
      case 'go':
        tone({ freq: 523, type: 'square', dur: 0.1, gain: 0.1 });
        tone({ freq: 1046, type: 'square', dur: 0.22, gain: 0.11, at: 0.09 });
        noise({ dur: 0.3, gain: 0.06, at: 0.05, highpass: 800, lowpass: 4000 });
        break;
      case 'pickup':
        tone({ freq: 620, type: 'square', dur: 0.04, gain: 0.035, slide: 240 });
        break;
      case 'premium':
        tone({ freq: 784, type: 'square', dur: 0.07, gain: 0.05 });
        tone({ freq: 1046, type: 'square', dur: 0.09, gain: 0.045, at: 0.05 });
        break;
      case 'giant':
        [523, 659, 784, 1046].forEach((freq, i) => {
          tone({ freq, type: 'square', dur: 0.1, gain: 0.07, at: i * 0.055 });
        });
        noise({ dur: 0.25, gain: 0.05, at: 0.16, highpass: 2000, lowpass: 8000 });
        break;
      case 'money':
        noise({ dur: 0.08, gain: 0.07, highpass: 3000, lowpass: 9000 });
        [1046, 1318, 1568].forEach((freq, i) => {
          tone({ freq, type: 'triangle', dur: 0.12, gain: 0.06, at: i * 0.05 });
        });
        break;
      case 'bank':
        [0, 0.08, 0.16].forEach((at) => {
          tone({ freq: 1800, type: 'square', dur: 0.04, gain: 0.04, at });
        });
        tone({ freq: 523, type: 'triangle', dur: 0.18, gain: 0.08, at: 0.23 });
        tone({ freq: 784, type: 'triangle', dur: 0.26, gain: 0.09, at: 0.27 });
        noise({ dur: 0.16, gain: 0.05, at: 0.23, highpass: 1200, lowpass: 6000 });
        break;
      case 'target':
        [784, 988, 1318].forEach((freq, i) => {
          tone({ freq, type: 'sine', dur: 0.2, gain: 0.09, at: i * 0.09 });
        });
        break;
      case 'timeup':
        tone({ freq: 196, type: 'sawtooth', dur: 0.5, gain: 0.12, slide: -60 });
        tone({ freq: 98, type: 'square', dur: 0.5, gain: 0.08 });
        break;
      case 'whoosh':
        noise({ dur: 0.4, gain: 0.07, highpass: 400, lowpass: 5200 });
        break;
      case 'cheer':
        noise({ dur: 1.1, gain: 0.1, highpass: 500, lowpass: 3500 });
        tone({ freq: 523, type: 'triangle', dur: 0.3, gain: 0.07, at: 0.1 });
        tone({ freq: 659, type: 'triangle', dur: 0.35, gain: 0.07, at: 0.22 });
        tone({ freq: 784, type: 'triangle', dur: 0.5, gain: 0.08, at: 0.34 });
        break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((freq, i) => {
          tone({ freq, type: 'square', dur: i === 4 ? 0.5 : 0.14, gain: 0.08, at: i * 0.11 });
        });
        noise({ dur: 0.9, gain: 0.07, at: 0.5, highpass: 600, lowpass: 4000 });
        break;
      case 'lose':
        [392, 330, 262].forEach((freq, i) => {
          tone({ freq, type: 'triangle', dur: 0.32, gain: 0.08, at: i * 0.17 });
        });
        break;
      default:
        break;
    }
  }

  return {
    unlock,
    sfx,
    music: setPattern,
    isMuted: () => isMuted,
    setMuted(next) {
      isMuted = Boolean(next);
      if (master && ctx) {
        master.gain.setTargetAtTime(isMuted ? 0 : 0.42, ctx.currentTime, 0.03);
      }
      if (isMuted) {
        stopScheduler();
      } else {
        ensure();
        if (patternName) startScheduler();
      }
    },
    stop() {
      patternName = null;
      stopScheduler();
    },
  };
}
