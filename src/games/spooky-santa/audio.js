/**
 * Procedural 8-bit sound kit for Spooky Santa.
 *
 * Everything here is synthesised with the Web Audio API, so the game ships
 * no audio files. The soundtrack is an original minor-key carol built from
 * square-wave leads, a marching triangle bass, sleigh-bell noise ticks and a
 * low "someone is in the attic" pad. Tension raises the tempo with a heartbeat
 * thump and a tritone drone while the family gets suspicious.
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let tension = 0;

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
    type = 'square',
    from = 440,
    to = from,
    dur = 0.2,
    vol = 0.12,
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

  function noise({ dur = 0.2, vol = 0.12, delay = 0, filter = null, attack = 0.01 }) {
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
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    tail.connect(gain);
    gain.connect(master);

    source.start(start);
    source.stop(start + dur + 0.03);
  }

  /* ------------------------------------------------------------------ *
   * Creepy 8-bit Christmas loop
   * ------------------------------------------------------------------ */

  const MUSIC_BPM = 84;
  const MUSIC_STEP = 60 / MUSIC_BPM / 4;
  const MUSIC_LOOP = 64;
  const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

  /* [step, midi] */
  const MUSIC_BASS = [
    [0, 38], [4, 38], [8, 41], [12, 45],
    [16, 34], [20, 34], [24, 41], [28, 45],
    [32, 43], [36, 43], [40, 46], [44, 45],
    [48, 38], [52, 38], [56, 41], [60, 45],
  ];
  /* [step, midi, length in 16ths] */
  const MUSIC_MELODY = [
    [0, 74, 2], [2, 77, 1], [4, 76, 2], [7, 75, 1], [8, 74, 2], [11, 72, 1], [12, 70, 2],
    [16, 69, 2], [18, 72, 1], [20, 74, 2], [23, 77, 1], [24, 76, 2], [26, 74, 1], [28, 72, 2],
    [32, 77, 2], [34, 76, 1], [36, 74, 2], [39, 72, 1], [40, 70, 2], [43, 69, 1], [44, 70, 2], [46, 72, 1],
    [48, 81, 2], [50, 79, 1], [52, 77, 2], [55, 76, 1], [56, 74, 2], [59, 72, 1], [60, 69, 3],
  ];
  const MUSIC_PAD = [[0, 62], [16, 58], [32, 60], [48, 57]];
  const MUSIC_BELLS = [[0, 86], [8, 86], [16, 82], [24, 82], [32, 84], [40, 84], [48, 81], [56, 81]];

  let musicTimer = null;
  let musicPlaying = false;
  let musicNext = 0;
  let musicIndex = 0;
  let tensionBeat = 0;

  function playMusicStep(index, delay) {
    const step = index % MUSIC_LOOP;

    for (const [at, note] of MUSIC_BASS) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({
        type: 'square',
        from: freq,
        to: freq * 0.994,
        dur: MUSIC_STEP * 2.7,
        vol: 0.032,
        delay,
        filter: { type: 'lowpass', freq: 780, q: 1.1 },
      });
      tone({
        type: 'triangle',
        from: freq * 2,
        to: freq * 2,
        dur: MUSIC_STEP * 1.1,
        vol: 0.013,
        delay,
      });
    }

    for (const [at, note, steps = 1] of MUSIC_MELODY) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      const dur = MUSIC_STEP * steps * 0.94;
      tone({
        type: 'square',
        from: freq,
        to: freq * 0.99,
        dur,
        vol: 0.034,
        delay,
        vibrato: steps > 1 ? 5 : 0,
        vibratoRate: 5.2,
        filter: { type: 'lowpass', freq: 2300, q: 0.7 },
      });
      tone({ type: 'triangle', from: freq * 0.5, to: freq * 0.5, dur: dur * 0.8, vol: 0.014, delay });
    }

    for (const [at, note] of MUSIC_PAD) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({
        type: 'triangle',
        from: freq,
        to: freq,
        dur: MUSIC_STEP * 3.4,
        vol: 0.017,
        delay,
        filter: { type: 'bandpass', freq: 700, q: 1.2 },
      });
    }

    for (const [at, note] of MUSIC_BELLS) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({ type: 'sine', from: freq, to: freq * 0.97, dur: 0.55, vol: 0.024, delay });
      noise({ dur: 0.08, vol: 0.008, delay, filter: { type: 'highpass', freq: 5400 } });
    }

    /* Sleigh-bell shuffle. */
    if (step % 4 === 0) {
      noise({ dur: 0.045, vol: 0.01, delay, filter: { type: 'highpass', freq: 6200 } });
    }
    if (step % 8 === 6) {
      noise({ dur: 0.03, vol: 0.006, delay, filter: { type: 'bandpass', freq: 3400, q: 2 } });
    }

    /* The house gets suspicious: heartbeat plus a tritone drone. */
    if (tension > 0.35 && step % 8 === 0) {
      tone({
        type: 'sine',
        from: 88,
        to: 52,
        dur: MUSIC_STEP * 2.2,
        vol: 0.05 + tension * 0.05,
        delay,
      });
    }
    if (tension > 0.7 && step % 8 === 3) {
      tone({
        type: 'sine',
        from: 78,
        to: 48,
        dur: MUSIC_STEP * 1.6,
        vol: 0.045 + tension * 0.04,
        delay,
      });
      tone({
        type: 'sawtooth',
        from: midiToFreq(63 + tensionBeat),
        to: midiToFreq(63 + tensionBeat),
        dur: MUSIC_STEP * 4,
        vol: 0.009,
        delay,
        filter: { type: 'lowpass', freq: 900, q: 3 },
      });
    }
    if (step === MUSIC_LOOP - 1) tensionBeat = tensionBeat === 0 ? 6 : 0;
  }

  function pumpMusic() {
    const c = ensure();
    if (!c || !musicPlaying) return;

    /* After a tab pause, skip ahead instead of dumping a pile of notes. */
    if (musicNext < c.currentTime - 0.2) musicNext = c.currentTime + 0.05;

    while (musicNext < c.currentTime + 0.3) {
      playMusicStep(musicIndex, musicNext - c.currentTime);
      musicNext += MUSIC_STEP;
      musicIndex += 1;
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
      if (!muted && musicPlaying && ctx) {
        musicNext = ctx.currentTime + 0.1;
        pumpMusic();
      }
    },

    isMuted() {
      return muted;
    },

    setTension(value) {
      tension = Math.max(0, Math.min(1, value));
    },

    startMusic() {
      if (musicPlaying) return;
      const c = ensure();
      musicPlaying = true;
      musicIndex = 0;
      musicNext = c ? c.currentTime + 0.12 : 0;
      if (c) pumpMusic();
      musicTimer = window.setInterval(pumpMusic, 100);
    },

    stopMusic() {
      musicPlaying = false;
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
      tension = 0;
    },

    /* A muffled creak as Santa squeezes out of the flue. */
    arrive() {
      if (!ensure()) return;
      noise({ dur: 0.6, vol: 0.06, filter: { type: 'bandpass', freq: 700, to: 240, q: 1.4 } });
      tone({ type: 'triangle', from: 120, to: 70, dur: 0.5, vol: 0.06 });
    },

    uiClick() {
      tone({ type: 'square', from: 320, to: 240, dur: 0.06, vol: 0.045 });
    },

    step(soft = false) {
      if (!ensure()) return;
      noise({
        dur: soft ? 0.055 : 0.075,
        vol: soft ? 0.018 : 0.032,
        filter: { type: 'lowpass', freq: soft ? 620 : 900, to: 320 },
      });
      if (!soft) tone({ type: 'sine', from: 120, to: 84, dur: 0.07, vol: 0.02 });
    },

    creak() {
      if (!ensure()) return;
      tone({
        type: 'sawtooth',
        from: 190,
        to: 120,
        dur: 0.38,
        vol: 0.03,
        vibrato: 12,
        vibratoRate: 22,
        filter: { type: 'bandpass', freq: 820, q: 3 },
      });
      noise({ dur: 0.3, vol: 0.012, filter: { type: 'bandpass', freq: 1400, q: 2 } });
    },

    squeak() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 820, to: 1500, dur: 0.1, vol: 0.07 });
      tone({ type: 'sine', from: 1500, to: 700, dur: 0.14, vol: 0.06, delay: 0.09 });
    },

    jingle() {
      if (!ensure()) return;
      [1046, 1318, 1568].forEach((freq, index) => {
        tone({ type: 'triangle', from: freq, to: freq, dur: 0.14, vol: 0.03, delay: index * 0.05 });
      });
      noise({ dur: 0.08, vol: 0.01, delay: 0.02, filter: { type: 'highpass', freq: 6200 } });
    },

    placePresent(index = 0) {
      if (!ensure()) return;
      tone({ type: 'sine', from: 120, to: 78, dur: 0.16, vol: 0.09 });
      noise({ dur: 0.1, vol: 0.02, filter: { type: 'lowpass', freq: 800 } });
      const base = 784 + Math.min(index, 4) * 60;
      [base, base * 1.25, base * 1.5].forEach((freq, i) => {
        tone({ type: 'triangle', from: freq, to: freq, dur: 0.16, vol: 0.032, delay: 0.08 + i * 0.06 });
      });
    },

    chime(index = 0) {
      const freq = 660 + Math.min(index, 4) * 90;
      tone({ type: 'square', from: freq, to: freq, dur: 0.1, vol: 0.03 });
      tone({ type: 'square', from: freq * 1.5, to: freq * 1.5, dur: 0.16, vol: 0.024, delay: 0.08 });
    },

    bark() {
      if (!ensure()) return;
      tone({ type: 'square', from: 300, to: 150, dur: 0.1, vol: 0.075, filter: { type: 'lowpass', freq: 1400 } });
      noise({ dur: 0.09, vol: 0.03, filter: { type: 'bandpass', freq: 900, q: 1.6 } });
      tone({ type: 'square', from: 340, to: 170, dur: 0.1, vol: 0.06, delay: 0.14, filter: { type: 'lowpass', freq: 1500 } });
    },

    growl() {
      if (!ensure()) return;
      tone({
        type: 'sawtooth',
        from: 96,
        to: 72,
        dur: 0.5,
        vol: 0.05,
        vibrato: 16,
        vibratoRate: 19,
        filter: { type: 'lowpass', freq: 500, q: 2 },
      });
    },

    scream() {
      if (!ensure()) return;
      tone({ type: 'sawtooth', from: 620, to: 1180, dur: 0.12, vol: 0.06, vibrato: 26, vibratoRate: 30 });
      tone({
        type: 'sawtooth',
        from: 1180,
        to: 520,
        dur: 0.36,
        vol: 0.055,
        delay: 0.1,
        vibrato: 30,
        vibratoRate: 26,
      });
    },

    wake() {
      tone({ type: 'triangle', from: 380, to: 520, dur: 0.22, vol: 0.035 });
      tone({ type: 'triangle', from: 440, to: 300, dur: 0.3, vol: 0.028, delay: 0.2 });
    },

    alarm() {
      if (!ensure()) return;
      for (let i = 0; i < 3; i += 1) {
        tone({ type: 'square', from: 700, to: 700, dur: 0.09, vol: 0.05, delay: i * 0.18 });
        tone({ type: 'square', from: 990, to: 990, dur: 0.09, vol: 0.04, delay: i * 0.18 + 0.09 });
      }
    },

    hide() {
      if (!ensure()) return;
      noise({ dur: 0.26, vol: 0.035, filter: { type: 'lowpass', freq: 2000, to: 260 } });
      tone({ type: 'sine', from: 260, to: 150, dur: 0.2, vol: 0.03 });
    },

    unhide() {
      noise({ dur: 0.18, vol: 0.022, filter: { type: 'lowpass', freq: 300, to: 1400 } });
    },

    munch() {
      if (!ensure()) return;
      for (let i = 0; i < 3; i += 1) {
        noise({
          dur: 0.09,
          vol: 0.045,
          delay: i * 0.12,
          filter: { type: 'lowpass', freq: 1500, to: 700 },
        });
      }
      tone({ type: 'triangle', from: 180, to: 260, dur: 0.18, vol: 0.03, delay: 0.4 });
    },

    dash() {
      if (!ensure()) return;
      noise({ dur: 0.3, vol: 0.03, filter: { type: 'bandpass', freq: 500, to: 2600, q: 1.2 } });
      [523, 659, 784].forEach((freq, index) => {
        tone({ type: 'square', from: freq, to: freq, dur: 0.08, vol: 0.03, delay: index * 0.06 });
      });
    },

    escape() {
      if (!ensure()) return;
      noise({ dur: 0.7, vol: 0.04, filter: { type: 'bandpass', freq: 300, to: 2800, q: 1.1 } });
      [523, 659, 784, 1046].forEach((freq, index) => {
        tone({ type: 'triangle', from: freq, to: freq, dur: 0.22, vol: 0.045, delay: index * 0.11 });
      });
    },

    caught() {
      if (!ensure()) return;
      [440, 392, 330, 262].forEach((freq, index) => {
        tone({
          type: 'sawtooth',
          from: freq,
          to: freq * 0.92,
          dur: 0.3,
          vol: 0.06,
          delay: index * 0.2,
          filter: { type: 'lowpass', freq: 1400, to: 500, q: 2 },
        });
      });
      noise({ dur: 0.5, vol: 0.04, delay: 0.1, filter: { type: 'lowpass', freq: 900, to: 200 } });
    },

    win() {
      if (!ensure()) return;
      const melody = [
        [659, 0.14],
        [659, 0.14],
        [784, 0.24],
        [659, 0.16],
        [880, 0.16],
        [784, 0.4],
      ];
      let at = 0;
      melody.forEach(([freq, dur]) => {
        tone({ type: 'square', from: freq, to: freq, dur, vol: 0.045, delay: at });
        tone({ type: 'triangle', from: freq * 0.5, to: freq * 0.5, dur: dur * 0.9, vol: 0.02, delay: at });
        at += dur;
      });
      [1046, 1318, 1568].forEach((freq, index) => {
        tone({ type: 'sine', from: freq, to: freq, dur: 0.5, vol: 0.03, delay: at + index * 0.12 });
        noise({ dur: 0.1, vol: 0.008, delay: at + index * 0.12, filter: { type: 'highpass', freq: 6000 } });
      });
    },
  };
}
