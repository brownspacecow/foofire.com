/* ------------------------------------------------------------------ *
 * Escape Earth sound effects.
 * Everything is synthesised with WebAudio, so there are no downloads.
 * Every call is safe before the player has interacted: the audio context
 * is only created on the first unlock (a click or key press).
 * ------------------------------------------------------------------ */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  const ensure = () => {
    if (typeof window === 'undefined') return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!ctx) {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  const tone = ({ freq = 440, to = 0, dur = 0.14, type = 'square', gain = 0.18, delay = 0 }) => {
    const c = ensure();
    if (!c || muted) return;
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  };

  const noise = ({ dur = 0.25, gain = 0.2, from = 900, to = 200, delay = 0 }) => {
    const c = ensure();
    if (!c || muted || !noiseBuffer) return;
    const start = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), start + dur);
    const amp = c.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(amp).connect(master);
    src.start(start);
    src.stop(start + dur + 0.02);
  };

  return {
    unlock: () => {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    isMuted: () => muted,
    setMuted: (value) => {
      muted = Boolean(value);
      if (master) master.gain.value = muted ? 0 : 0.3;
    },
    blip: (freq = 520) => tone({ freq, dur: 0.07, type: 'square', gain: 0.09 }),
    coin: () => {
      tone({ freq: 880, dur: 0.08, type: 'square', gain: 0.12 });
      tone({ freq: 1320, dur: 0.12, type: 'square', gain: 0.1, delay: 0.07 });
    },
    crash: () => {
      noise({ dur: 0.4, gain: 0.28, from: 1400, to: 160 });
      tone({ freq: 180, to: 60, dur: 0.32, type: 'sawtooth', gain: 0.16 });
    },
    boing: () => tone({ freq: 220, to: 620, dur: 0.22, type: 'triangle', gain: 0.14 }),
    giggle: () => {
      tone({ freq: 720, to: 980, dur: 0.1, type: 'triangle', gain: 0.1 });
      tone({ freq: 820, to: 1120, dur: 0.1, type: 'triangle', gain: 0.1, delay: 0.12 });
      tone({ freq: 640, to: 900, dur: 0.14, type: 'triangle', gain: 0.1, delay: 0.24 });
    },
    yell: () => {
      noise({ dur: 0.5, gain: 0.22, from: 700, to: 240 });
      tone({ freq: 300, to: 150, dur: 0.5, type: 'sawtooth', gain: 0.13 });
    },
    tick: () => tone({ freq: 340, dur: 0.05, type: 'square', gain: 0.07 }),
    fart: () => {
      tone({ freq: 96, to: 44, dur: 0.5, type: 'sawtooth', gain: 0.22 });
      tone({ freq: 70, to: 52, dur: 0.36, type: 'square', gain: 0.12, delay: 0.16 });
      noise({ dur: 0.55, gain: 0.16, from: 520, to: 100 });
    },
    whoosh: () => noise({ dur: 0.3, gain: 0.14, from: 320, to: 1200 }),
    powerup: () => {
      [523, 659, 784, 1047].forEach((freq, i) =>
        tone({ freq, dur: 0.12, type: 'square', gain: 0.1, delay: i * 0.06 })
      );
    },
    win: () => {
      [523, 659, 784, 1047, 1319].forEach((freq, i) =>
        tone({ freq, dur: 0.18, type: 'square', gain: 0.12, delay: i * 0.1 })
      );
    },
    lose: () => {
      [392, 330, 262, 196].forEach((freq, i) =>
        tone({ freq, dur: 0.22, type: 'sawtooth', gain: 0.12, delay: i * 0.14 })
      );
    },
  };
}
