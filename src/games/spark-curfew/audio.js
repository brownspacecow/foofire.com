/**
 * Procedural sound kit for Spark Curfew.
 *
 * Everything is synthesised with the Web Audio API, so the game loads no audio
 * files. The palette is cartoon fireworks: hissing fuses, whistling shells,
 * deep booms, crackling sparks, a crowd that goes "woo", plus crickets at night
 * and birds once the little fireworks bring the sun up.
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let daylight = false;
  let ambienceTimer = null;
  let lastCheer = 0;

  const ensure = () => {
    if (muted) return null;
    if (!ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      ctx = new AudioCtor();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 20;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(compressor);
      compressor.connect(ctx.destination);

      noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  /* ------------------------------------------------------------------ *
   * Primitives
   * ------------------------------------------------------------------ */

  function tone({
    type = 'sine',
    from = 440,
    to = from,
    dur = 0.2,
    vol = 0.2,
    delay = 0,
    gliss = 'exp',
    vibrato = 0,
    vibratoRate = 0,
    attack = 0.008,
    filter = null,
  }) {
    const c = ensure();
    if (!c) return;

    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), start);
    if (to !== from) {
      const target = Math.max(20, to);
      if (gliss === 'linear') osc.frequency.linearRampToValueAtTime(target, start + dur);
      else osc.frequency.exponentialRampToValueAtTime(target, start + dur);
    }

    if (vibrato && vibratoRate) {
      const lfo = c.createOscillator();
      const lfoDepth = c.createGain();
      lfo.frequency.value = vibratoRate;
      lfoDepth.gain.value = vibrato;
      lfo.connect(lfoDepth);
      lfoDepth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + dur + 0.05);
    }

    let tail = osc;
    if (filter) {
      const node = c.createBiquadFilter();
      node.type = filter.type || 'lowpass';
      node.frequency.setValueAtTime(filter.freq || 1200, start);
      if (filter.to) {
        node.frequency.exponentialRampToValueAtTime(Math.max(80, filter.to), start + dur);
      }
      node.Q.value = filter.q || 1;
      tail.connect(node);
      tail = node;
    }

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    tail.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.2, delay = 0, filter = null, am = 0, amRate = 0 }) {
    const c = ensure();
    if (!c) return;

    const start = c.currentTime + delay;
    const source = c.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    let tail = source;
    if (filter) {
      const node = c.createBiquadFilter();
      node.type = filter.type || 'bandpass';
      node.frequency.setValueAtTime(filter.freq || 1000, start);
      if (filter.to) {
        node.frequency.exponentialRampToValueAtTime(Math.max(80, filter.to), start + dur);
      }
      node.Q.value = filter.q || 1;
      tail.connect(node);
      tail = node;
    }

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    if (am && amRate) {
      const lfo = c.createOscillator();
      const lfoDepth = c.createGain();
      lfo.frequency.value = amRate;
      lfoDepth.gain.value = am;
      lfo.connect(lfoDepth);
      lfoDepth.connect(gain.gain);
      lfo.start(start);
      lfo.stop(start + dur);
    }

    tail.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + dur + 0.03);
  }

  function cricket() {
    const base = 3800 + Math.random() * 900;
    [0, 0.07, 0.14].forEach((delay) => {
      tone({ type: 'sine', from: base, to: base * 1.01, dur: 0.05, vol: 0.018, delay });
    });
  }

  function bird() {
    const base = 1700 + Math.random() * 900;
    tone({ type: 'sine', from: base, to: base * 1.7, dur: 0.09, vol: 0.026 });
    tone({ type: 'sine', from: base * 1.25, to: base * 2.4, dur: 0.11, vol: 0.02, delay: 0.09 });
  }

  function ambienceTick() {
    if (!ctx || muted) return;
    if (daylight) {
      if (Math.random() < 0.3) bird();
    } else {
      if (Math.random() < 0.45) cricket();
      if (Math.random() < 0.07) {
        noise({ dur: 1.2, vol: 0.012, filter: { type: 'lowpass', freq: 420 } });
      }
    }
  }

  function sparkle(power = 1) {
    const notes = 4 + Math.round(power * 3);
    for (let i = 0; i < notes; i += 1) {
      const freq = 1200 + Math.random() * 2200;
      tone({
        type: 'triangle',
        from: freq,
        to: freq * 0.7,
        dur: 0.09,
        vol: 0.025 + power * 0.008,
        delay: Math.random() * 0.4,
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Public kit
   * ------------------------------------------------------------------ */

  return {
    unlock() {
      ensure();
    },

    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },

    isMuted() {
      return muted;
    },

    startAmbience() {
      if (ambienceTimer) return;
      ambienceTimer = window.setInterval(ambienceTick, 640);
    },

    stopAmbience() {
      if (ambienceTimer) window.clearInterval(ambienceTimer);
      ambienceTimer = null;
    },

    setDaylight(value) {
      daylight = value;
    },

    uiClick() {
      if (!ensure()) return;
      tone({ type: 'square', from: 720, to: 1120, dur: 0.07, vol: 0.06 });
    },

    buy() {
      if (!ensure()) return;
      tone({ type: 'square', from: 660, to: 880, dur: 0.06, vol: 0.055 });
      tone({ type: 'square', from: 990, to: 1320, dur: 0.1, vol: 0.045, delay: 0.06 });
    },

    fuse() {
      if (!ensure()) return;
      noise({
        dur: 0.7,
        vol: 0.05,
        filter: { type: 'highpass', freq: 2400 },
        am: 0.025,
        amRate: 42,
      });
      sparkle(0.4);
    },

    launch() {
      if (!ensure()) return;
      tone({
        type: 'sine',
        from: 320,
        to: 1600,
        dur: 0.75,
        vol: 0.05,
        vibrato: 26,
        vibratoRate: 13,
        attack: 0.02,
      });
      noise({ dur: 0.6, vol: 0.03, filter: { type: 'bandpass', freq: 900, to: 2600, q: 1.2 } });
    },

    burst(power = 1) {
      if (!ensure()) return;
      const p = Math.max(0.7, Math.min(3, power));

      noise({
        dur: 0.45 + p * 0.2,
        vol: 0.07 + p * 0.035,
        filter: { type: 'lowpass', freq: 1900, to: 110, q: 1.2 },
      });
      tone({ type: 'sine', from: 140 + p * 18, to: 40, dur: 0.5 + p * 0.16, vol: 0.14 + p * 0.05 });

      const pops = Math.round(5 + p * 7);
      for (let i = 0; i < pops; i += 1) {
        noise({
          dur: 0.05,
          vol: 0.017 + Math.random() * 0.012,
          delay: 0.1 + Math.random() * 0.65,
          filter: { type: 'highpass', freq: 2400 + Math.random() * 3200 },
        });
      }
      sparkle(p * 0.7);
    },

    sparkle,

    daybreak() {
      if (!ensure()) return;
      [523, 659, 784, 1046].forEach((freq, index) => {
        tone({ type: 'triangle', from: freq, dur: 0.6, vol: 0.045, delay: index * 0.07 });
      });
      noise({ dur: 0.9, vol: 0.018, filter: { type: 'highpass', freq: 1800 } });
      for (let i = 0; i < 3; i += 1) bird();
    },

    nightfall() {
      if (!ensure()) return;
      [392, 349, 262].forEach((freq, index) => {
        tone({ type: 'triangle', from: freq, dur: 0.7, vol: 0.04, delay: index * 0.14 });
      });
      cricket();
    },

    cheer(intensity = 1) {
      const c = ensure();
      if (!c) return;
      const now = c.currentTime;
      if (now - lastCheer < 0.32) return;
      lastCheer = now;

      noise({
        dur: 0.35 + intensity * 0.25,
        vol: 0.035 + intensity * 0.02,
        filter: { type: 'bandpass', freq: 950, q: 0.8 },
        am: 0.02,
        amRate: 8,
      });
      for (let i = 0; i < 2; i += 1) {
        const base = 300 + Math.random() * 200;
        tone({
          type: 'sawtooth',
          from: base,
          to: base * 1.8,
          dur: 0.3,
          vol: 0.018,
          delay: Math.random() * 0.12,
          filter: { type: 'bandpass', freq: 1000, q: 2 },
        });
      }
    },

    cash() {
      if (!ensure()) return;
      tone({ type: 'square', from: 988, dur: 0.06, vol: 0.05 });
      tone({ type: 'square', from: 1318, dur: 0.16, vol: 0.05, delay: 0.06 });
    },

    curfew() {
      if (!ensure()) return;
      [0, 0.45, 0.9].forEach((delay, index) => {
        const freq = 220 - index * 18;
        tone({ type: 'triangle', from: freq, to: freq * 0.92, dur: 0.55, vol: 0.075, delay });
        tone({ type: 'sine', from: freq * 2, dur: 0.35, vol: 0.025, delay });
      });
    },
  };
}
