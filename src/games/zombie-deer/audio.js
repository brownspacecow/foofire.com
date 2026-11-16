/**
 * Tiny procedural cartoon sound kit for Zombie Deer: Christmas Edition.
 * Every sound is synthesised with the Web Audio API, so nothing has to load.
 * The palette is deliberately silly: kazoos, slide whistles, sad trombones,
 * rubber-toy squeaks, spring boings, clown horns and a deflating balloon.
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let lastKill = 0;
  let lastScared = 0;

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
    glide = 'exp',
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
      if (glide === 'linear') osc.frequency.linearRampToValueAtTime(target, start + dur);
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

  function noise({
    dur = 0.2,
    vol = 0.2,
    delay = 0,
    filter = null,
    am = 0,
    amRate = 0,
  }) {
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

  /* Rubber-toy spring noise. */
  function boing(base = 220, delay = 0) {
    tone({ type: 'sine', from: base * 1.7, to: base * 0.75, dur: 0.5, vol: 0.18, delay });
    tone({
      type: 'triangle',
      from: base * 1.7,
      to: base * 0.75,
      dur: 0.42,
      vol: 0.07,
      delay,
      vibrato: base * 0.45,
      vibratoRate: 17,
    });
  }

  /* Kalimba-ish score chime. */
  function coin(delay = 0) {
    tone({ type: 'square', from: 988, to: 988, dur: 0.07, vol: 0.07, delay });
    tone({ type: 'square', from: 1319, to: 1319, dur: 0.18, vol: 0.07, delay: delay + 0.07 });
  }

  /* Kazoo voice, used for the silly fanfares. */
  function kazooNote(freq, delay, dur, vol = 0.12) {
    tone({
      type: 'sawtooth',
      from: freq,
      to: freq,
      dur,
      vol,
      delay,
      vibrato: 10,
      vibratoRate: 26,
      filter: { type: 'bandpass', freq: 1300, q: 2.5 },
    });
    tone({
      type: 'square',
      from: freq * 0.5,
      to: freq * 0.5,
      dur,
      vol: vol * 0.35,
      delay,
      filter: { type: 'lowpass', freq: 900 },
    });
  }

  function sadTrombone(delay = 0) {
    const notes = [392, 370, 349, 330];
    notes.forEach((freq, index) => {
      const last = index === notes.length - 1;
      tone({
        type: 'sawtooth',
        from: freq,
        to: last ? freq * 0.72 : freq * 0.96,
        dur: last ? 0.85 : 0.28,
        vol: 0.13,
        delay: delay + index * 0.22,
        filter: { type: 'lowpass', freq: 1100, to: 420, q: 6 },
      });
    });
  }

  function slideWhistle(from, to, dur, delay = 0, vol = 0.12) {
    tone({
      type: 'sine',
      from,
      to,
      dur,
      vol,
      delay,
      vibrato: 18,
      vibratoRate: 11,
      attack: 0.02,
    });
  }

  function rubberSqueak(delay = 0, pitch = 900) {
    tone({
      type: 'sine',
      from: pitch,
      to: pitch * 1.9,
      dur: 0.13,
      vol: 0.13,
      delay,
      vibrato: 90,
      vibratoRate: 34,
    });
    tone({
      type: 'triangle',
      from: pitch * 2,
      to: pitch * 1.1,
      dur: 0.1,
      vol: 0.06,
      delay: delay + 0.02,
    });
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

    /* Round-start jingle bells, played on a kazoo with sleigh bells. */
    start() {
      if (!ensure()) return;
      const melody = [
        [659, 0.16],
        [659, 0.16],
        [659, 0.26],
        [659, 0.16],
        [659, 0.16],
        [659, 0.26],
        [659, 0.16],
        [784, 0.16],
        [523, 0.18],
        [587, 0.18],
        [659, 0.45],
      ];
      let at = 0;
      for (const [freq, dur] of melody) {
        kazooNote(freq, at, dur * 0.92, 0.1);
        at += dur;
      }
      for (let i = 0; i < 7; i += 1) {
        noise({ dur: 0.06, vol: 0.05, delay: i * 0.18, filter: { type: 'highpass', freq: 5200 } });
      }
      boing(240, at + 0.02);
      coin(at + 0.1);
    },

    /* Clown-horn fanfare that gets a little more frantic each wave. */
    waveStart(wave = 1) {
      if (!ensure()) return;
      const base = 1 + Math.min(0.45, (wave - 1) * 0.05);
      [0, 0.17, 0.34].forEach((delay, index) => {
        const freq = 196 * base * Math.pow(1.13, index);
        tone({
          type: 'square',
          from: freq,
          to: freq * 0.96,
          dur: 0.22,
          vol: 0.11,
          delay,
          filter: { type: 'lowpass', freq: 1200, q: 2 },
        });
      });
      slideWhistle(420, 1700, 0.6, 0.16, 0.09);
      noise({ dur: 0.25, vol: 0.05, delay: 0.5, filter: { type: 'highpass', freq: 4000 } });
    },

    /* Snowball: a cartoon "thwip" with a squeaky launch. */
    shoot() {
      if (!ensure()) return;
      noise({ dur: 0.13, vol: 0.16, filter: { type: 'bandpass', freq: 2400, to: 500, q: 1.4 } });
      tone({ type: 'sine', from: 700, to: 220, dur: 0.1, vol: 0.1 });
      rubberSqueak(0.005, 500);
    },

    hit(headshot = false) {
      if (!ensure()) return;
      const pitch = headshot ? 1500 : 950;
      tone({
        type: 'square',
        from: pitch,
        to: pitch * 0.45,
        dur: 0.12,
        vol: 0.12,
        vibrato: 70,
        vibratoRate: 30,
        filter: { type: 'lowpass', freq: 3000 },
      });
      tone({ type: 'sine', from: 220, to: 70, dur: 0.16, vol: 0.16, delay: 0.01 });
      noise({ dur: 0.08, vol: 0.08, filter: { type: 'bandpass', freq: 900, q: 1.2 } });
      if (headshot) coin(0.02);
    },

    kill(headshot = false) {
      if (!ensure()) return;
      const now = ctx.currentTime;
      if (now - lastKill > 0.18) {
        lastKill = now;
        sadTrombone(0);
      }
      slideWhistle(1500, 220, 0.5, 0.04, 0.1);
      boing(180, 0.1);
      rubberSqueak(0.24, 620);
      if (headshot) coin(0.12);
    },

    houseHit() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 170, to: 50, dur: 0.32, vol: 0.26 });
      noise({ dur: 0.2, vol: 0.13, filter: { type: 'lowpass', freq: 900, to: 180 } });
      tone({
        type: 'sawtooth',
        from: 320,
        to: 200,
        dur: 0.24,
        vol: 0.07,
        delay: 0.03,
        filter: { type: 'lowpass', freq: 800, to: 350, q: 4 },
      });
    },

    scared() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      if (now - lastScared < 0.14) return;
      lastScared = now;
      boing(340, 0);
      tone({
        type: 'triangle',
        from: 1200,
        to: 2500,
        dur: 0.2,
        vol: 0.07,
        delay: 0.02,
        vibrato: 90,
        vibratoRate: 28,
      });
    },

    /* Doorbell, then a flurry of excited yips. */
    callPuppy() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 880, to: 880, dur: 0.5, vol: 0.16 });
      tone({ type: 'sine', from: 1320, to: 1320, dur: 0.2, vol: 0.05, delay: 0.01 });
      tone({ type: 'sine', from: 660, to: 660, dur: 0.6, vol: 0.15, delay: 0.3 });
      [0.55, 0.66, 0.77, 0.86].forEach((delay, index) => {
        tone({
          type: 'square',
          from: 900 + index * 140,
          to: 1500 + index * 120,
          dur: 0.08,
          vol: 0.06,
          delay,
          filter: { type: 'lowpass', freq: 3000 },
        });
      });
    },

    /* Two huge cartoon woofs and a reindeer squeal. */
    bark() {
      if (!ensure()) return;
      [0, 0.2].forEach((delay) => {
        noise({ dur: 0.16, vol: 0.2, delay, filter: { type: 'bandpass', freq: 760, to: 240, q: 1.2 } });
        tone({
          type: 'sawtooth',
          from: 240,
          to: 100,
          dur: 0.17,
          vol: 0.16,
          delay,
          filter: { type: 'lowpass', freq: 1300, to: 500 },
        });
        tone({ type: 'square', from: 620, to: 1100, dur: 0.1, vol: 0.05, delay: delay + 0.03 });
      });
      tone({
        type: 'sine',
        from: 1500,
        to: 520,
        dur: 0.32,
        vol: 0.07,
        delay: 0.42,
        vibrato: 120,
        vibratoRate: 22,
      });
    },

    /* Wave cleared: "wheee", kazoo ta-da, coins. */
    waveClear() {
      if (!ensure()) return;
      slideWhistle(600, 1900, 0.45, 0, 0.1);
      [523, 659, 784, 1046].forEach((freq, index) => {
        kazooNote(freq, 0.42 + index * 0.12, 0.18, 0.11);
      });
      coin(0.62);
      coin(1.0);
      boing(280, 1.05);
    },

    gameOver() {
      if (!ensure()) return;
      sadTrombone(0.05);
      tone({
        type: 'sine',
        from: 620,
        to: 110,
        dur: 0.95,
        vol: 0.07,
        delay: 0.35,
        vibrato: 45,
        vibratoRate: 13,
      });
      noise({
        dur: 0.95,
        vol: 0.1,
        delay: 0.35,
        filter: { type: 'bandpass', freq: 900, to: 120, q: 1.5 },
        am: 0.07,
        amRate: 24,
      });
    },

    /* A jolly, echoey "ho ho ho" with sleigh bells and a final boing. */
    hoHoHo() {
      if (!ensure()) return;
      [0, 0.26, 0.5].forEach((delay, index) => {
        const freq = 190 - index * 16;
        tone({
          type: 'sawtooth',
          from: freq,
          to: freq * 0.88,
          dur: 0.22,
          vol: 0.12,
          delay,
          vibrato: 12,
          vibratoRate: 8,
          filter: { type: 'bandpass', freq: 620, q: 2.4 },
        });
        noise({ dur: 0.08, vol: 0.04, delay, filter: { type: 'bandpass', freq: 950, q: 1.2 } });
      });
      for (let i = 0; i < 6; i += 1) {
        noise({ dur: 0.05, vol: 0.035, delay: 0.75 + i * 0.09, filter: { type: 'highpass', freq: 5200 } });
      }
      boing(210, 1.35);
    },

    /* A present whistling away. */
    presentThrow() {
      if (!ensure()) return;
      noise({ dur: 0.16, vol: 0.07, filter: { type: 'bandpass', freq: 700, to: 2200, q: 1.4 } });
      tone({ type: 'square', from: 480, to: 900, dur: 0.08, vol: 0.05 });
    },

    santaLand() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 120, to: 55, dur: 0.22, vol: 0.15 });
      noise({ dur: 0.16, vol: 0.07, filter: { type: 'lowpass', freq: 700 } });
      boing(280, 0.02);
    },

    /* Snowy crunch, pitched up a little with every hit on the snowman. */
    snowHit(step = 1) {
      if (!ensure()) return;
      const base = 280 + step * 70;
      noise({ dur: 0.1, vol: 0.09, filter: { type: 'bandpass', freq: base, q: 2.2 } });
      tone({ type: 'triangle', from: base, to: base * 0.68, dur: 0.12, vol: 0.1 });
      rubberSqueak(0.02, 360 + step * 45);
    },

    /* Five hits later: the snowman goes off like a firework. */
    snowmanBoom() {
      if (!ensure()) return;
      noise({ dur: 0.7, vol: 0.2, filter: { type: 'lowpass', freq: 1600, to: 140 } });
      tone({ type: 'sine', from: 190, to: 38, dur: 0.6, vol: 0.3 });
      slideWhistle(2000, 200, 0.7, 0.05, 0.14);
      boing(150, 0.12);
      kazooNote(392, 0.5, 0.18);
      kazooNote(523, 0.68, 0.22);
      kazooNote(659, 0.86, 0.3);
    },

    snowmanRebuild() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 240, to: 720, dur: 0.3, vol: 0.12 });
      noise({ dur: 0.2, vol: 0.05, filter: { type: 'highpass', freq: 2600 } });
      rubberSqueak(0.12, 540);
    },

    /* A shooting-star twinkle when the moon gets hit. */
    moonShot() {
      if (!ensure()) return;
      [660, 880, 1100, 1320, 1760].forEach((freq, index) => {
        tone({ type: 'sine', from: freq, to: freq * 1.01, dur: 0.22, vol: 0.09, delay: index * 0.055 });
      });
      noise({ dur: 0.45, vol: 0.05, filter: { type: 'highpass', freq: 3200 } });
      boing(360, 0.3);
    },

    /* Two-stroke snowmobile engine: braap braap. */
    snowmobile() {
      if (!ensure()) return;
      [0, 0.34].forEach((delay) => {
        tone({
          type: 'sawtooth',
          from: 64,
          to: 132,
          dur: 0.3,
          vol: 0.13,
          delay,
          filter: { type: 'lowpass', freq: 700, to: 1600, q: 3 },
        });
        tone({
          type: 'square',
          from: 42,
          to: 84,
          dur: 0.3,
          vol: 0.08,
          delay,
          filter: { type: 'lowpass', freq: 420 },
        });
        noise({ dur: 0.3, vol: 0.07, delay, filter: { type: 'bandpass', freq: 460, q: 1.1 }, am: 24, amRate: 42 });
      });
    },

    /* "Yee-haw!" without a singer. */
    yeehaw() {
      if (!ensure()) return;
      tone({
        type: 'sawtooth',
        from: 520,
        to: 980,
        dur: 0.22,
        vol: 0.1,
        vibrato: 34,
        vibratoRate: 22,
        filter: { type: 'bandpass', freq: 1200, q: 2 },
      });
      tone({
        type: 'sawtooth',
        from: 980,
        to: 420,
        dur: 0.42,
        vol: 0.1,
        delay: 0.24,
        vibrato: 44,
        vibratoRate: 17,
        filter: { type: 'bandpass', freq: 1050, q: 2 },
      });
    },

    uiClick() {
      if (!ensure()) return;
      tone({ type: 'square', from: 720, to: 1180, dur: 0.07, vol: 0.07 });
      noise({ dur: 0.05, vol: 0.05, filter: { type: 'highpass', freq: 2000 } });
    },
  };
}
