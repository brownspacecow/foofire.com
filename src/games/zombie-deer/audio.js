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
   * Creepy 8-bit Christmas loop
   * A minor-key carol over a marching square-wave bass, with sleigh-bell
   * ticks, the kind of thing that plays while you sneak through World 8.
   * ------------------------------------------------------------------ */

  const MUSIC_BPM = 92;
  const MUSIC_STEP = 60 / MUSIC_BPM / 4;
  const MUSIC_LOOP = 64;

  const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

  /* [step, midi note] */
  const MUSIC_BASS = [
    [0, 38], [3, 38], [6, 41], [10, 45],
    [16, 46], [19, 46], [22, 43], [26, 45],
    [32, 41], [35, 41], [38, 40], [42, 45],
    [48, 46], [51, 46], [54, 48], [58, 45],
  ];
  /* [step, midi note, length in 16ths] */
  const MUSIC_MELODY = [
    [0, 74, 2], [2, 77, 1], [4, 76, 2], [7, 74, 1], [10, 69, 2], [13, 70, 1], [14, 69, 2],
    [16, 67, 2], [19, 65, 1], [21, 64, 2], [24, 62, 2], [28, 61, 2],
    [32, 65, 2], [34, 67, 1], [36, 69, 2], [39, 70, 1], [40, 69, 2], [43, 67, 1], [45, 65, 2], [47, 64, 1],
    [48, 75, 2], [50, 74, 1], [52, 72, 2], [55, 70, 1], [56, 69, 2], [60, 74, 3],
  ];
  const MUSIC_BELLS = [[0, 86], [16, 82], [32, 84], [48, 81]];
  const MUSIC_HARMONY = [[8, 62], [24, 58], [40, 60], [56, 57]];

  let musicTimer = null;
  let musicPlaying = false;
  let musicNext = 0;
  let musicIndex = 0;

  function playMusicStep(index, delay) {
    const step = index % MUSIC_LOOP;

    for (const [at, note] of MUSIC_BASS) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({
        type: 'square',
        from: freq,
        to: freq * 0.995,
        dur: MUSIC_STEP * 2.6,
        vol: 0.032,
        delay,
        filter: { type: 'lowpass', freq: 820, q: 1.1 },
      });
      tone({ type: 'triangle', from: freq * 2, to: freq * 2, dur: MUSIC_STEP * 1.1, vol: 0.014, delay });
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
        vol: 0.036,
        delay,
        vibrato: steps > 1 ? 5 : 0,
        vibratoRate: 5.5,
        filter: { type: 'lowpass', freq: 2400, q: 0.7 },
      });
      tone({ type: 'triangle', from: freq * 0.5, to: freq * 0.5, dur: dur * 0.8, vol: 0.016, delay });
    }

    for (const [at, note] of MUSIC_HARMONY) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({
        type: 'triangle',
        from: freq,
        to: freq,
        dur: MUSIC_STEP * 3.2,
        vol: 0.015,
        delay,
        filter: { type: 'bandpass', freq: 760, q: 1.3 },
      });
    }

    for (const [at, note] of MUSIC_BELLS) {
      if (at !== step) continue;
      const freq = midiToFreq(note);
      tone({ type: 'sine', from: freq, to: freq * 0.97, dur: 0.6, vol: 0.026, delay });
      noise({ dur: 0.09, vol: 0.009, delay, filter: { type: 'highpass', freq: 5400 } });
    }

    /* Sleigh-bell shuffle: an eighth-note tick with a softer ghost note. */
    if (step % 4 === 0) {
      noise({ dur: 0.045, vol: 0.011, delay, filter: { type: 'highpass', freq: 6400 } });
    }
    if (step % 8 === 6) {
      noise({ dur: 0.03, vol: 0.007, delay, filter: { type: 'bandpass', freq: 3600, q: 2 } });
    }
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
    },

    isMuted() {
      return muted;
    },

    /* Start the creepy carol loop. Keeps ticking while muted so unmuting
       brings the carol back instead of silence for the rest of the round. */
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

    /* A snowball that sails off into the snow. */
    miss() {
      if (!ensure()) return;
      noise({ dur: 0.12, vol: 0.05, filter: { type: 'lowpass', freq: 1400, to: 420 } });
      tone({ type: 'sine', from: 340, to: 180, dur: 0.1, vol: 0.045 });
    },

    /* A helper's cooldown just finished. */
    ready() {
      if (!ensure()) return;
      tone({ type: 'square', from: 1046, to: 1046, dur: 0.07, vol: 0.05 });
      tone({ type: 'square', from: 1568, to: 1568, dur: 0.1, vol: 0.045, delay: 0.07 });
      noise({ dur: 0.04, vol: 0.015, delay: 0.07, filter: { type: 'highpass', freq: 6000 } });
    },

    /* Santa's present going off: a party-popper pop with a glittery tail. */
    presentPop() {
      if (!ensure()) return;
      noise({ dur: 0.16, vol: 0.13, filter: { type: 'highpass', freq: 1800 } });
      tone({ type: 'square', from: 320, to: 900, dur: 0.12, vol: 0.09 });
      tone({ type: 'sine', from: 1200, to: 620, dur: 0.18, vol: 0.06, delay: 0.06 });
      for (let i = 0; i < 5; i += 1) {
        tone({
          type: 'triangle',
          from: 1500 + i * 260,
          to: 1100 + i * 200,
          dur: 0.09,
          vol: 0.028,
          delay: 0.08 + i * 0.05,
        });
      }
      boing(300, 0.13);
    },

    /* Dad shuffling back behind the tree. */
    dadBye() {
      if (!ensure()) return;
      slideWhistle(720, 240, 0.55, 0, 0.07);
      tone({ type: 'triangle', from: 300, to: 200, dur: 0.3, vol: 0.06, delay: 0.5, vibrato: 18, vibratoRate: 8 });
      for (let i = 0; i < 3; i += 1) {
        noise({ dur: 0.07, vol: 0.03, delay: 0.6 + i * 0.16, filter: { type: 'bandpass', freq: 900, q: 1.4 } });
      }
    },

    /* Bear trotting home, paws in the snow. */
    bearLeave() {
      if (!ensure()) return;
      for (let i = 0; i < 4; i += 1) {
        noise({ dur: 0.06, vol: 0.03, delay: i * 0.11, filter: { type: 'bandpass', freq: 1200, q: 1.6 } });
      }
      tone({ type: 'sine', from: 700, to: 380, dur: 0.3, vol: 0.05, delay: 0.05, vibrato: 30, vibratoRate: 12 });
    },

    /* A bright ding each time the tree star is shot. */
    starDing(step = 1) {
      if (!ensure()) return;
      const base = 880 * (1 + step * 0.22);
      tone({ type: 'sine', from: base, to: base * 1.5, dur: 0.24, vol: 0.11 });
      tone({ type: 'triangle', from: base * 2, dur: 0.18, vol: 0.05, delay: 0.06 });
      coin(0.1);
    },

    /* Dad's goofy "hi there!". */
    dadHi() {
      if (!ensure()) return;
      tone({ type: 'sawtooth', from: 170, to: 240, dur: 0.18, vol: 0.09, filter: { type: 'bandpass', freq: 700, q: 2.2 } });
      tone({ type: 'sawtooth', from: 230, to: 300, dur: 0.18, vol: 0.08, delay: 0.17, filter: { type: 'bandpass', freq: 820, q: 2.2 } });
      noise({ dur: 0.35, vol: 0.04, filter: { type: 'lowpass', freq: 900 } });
    },

    /* A grunt and a whoosh as a disc leaves Dad's hand. */
    dadThrow() {
      if (!ensure()) return;
      tone({ type: 'sawtooth', from: 155, to: 105, dur: 0.15, vol: 0.08, filter: { type: 'lowpass', freq: 600 } });
      noise({ dur: 0.3, vol: 0.05, delay: 0.07, filter: { type: 'bandpass', freq: 1800, to: 700, q: 1.1 } });
    },

    /* A disc thunking into the siding. */
    discHouse() {
      if (!ensure()) return;
      tone({ type: 'square', from: 260, to: 90, dur: 0.16, vol: 0.1, filter: { type: 'lowpass', freq: 900 } });
      noise({ dur: 0.14, vol: 0.07, filter: { type: 'lowpass', freq: 700 } });
      tone({ type: 'sine', from: 150, to: 70, dur: 0.22, vol: 0.07, delay: 0.02 });
    },

    /* A disc bonking a reindeer. */
    discHitDeer() {
      if (!ensure()) return;
      tone({ type: 'triangle', from: 420, to: 180, dur: 0.18, vol: 0.12 });
      noise({ dur: 0.12, vol: 0.05, filter: { type: 'bandpass', freq: 1200, q: 1.4 } });
      tone({ type: 'sine', from: 900, to: 520, dur: 0.12, vol: 0.05, delay: 0.04 });
    },

    /* The tiny womp of a disc landing nowhere near a deer. */
    discMiss() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 220, to: 150, dur: 0.18, vol: 0.05 });
      noise({ dur: 0.16, vol: 0.04, filter: { type: 'lowpass', freq: 900 } });
    },

    /* Tinkle of broken window glass. */
    windowSmash() {
      if (!ensure()) return;
      noise({ dur: 0.3, vol: 0.12, filter: { type: 'highpass', freq: 2600 } });
      for (let i = 0; i < 5; i += 1) {
        tone({ type: 'sine', from: 2600 + i * 420, to: 1800 + i * 300, dur: 0.16, vol: 0.045, delay: 0.03 + i * 0.045 });
      }
      tone({ type: 'square', from: 180, to: 80, dur: 0.2, vol: 0.06 });
    },

    /* A magic zap from the witch's wand. */
    witchCast() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 520, to: 1800, dur: 0.28, vol: 0.1, vibrato: 60, vibratoRate: 30 });
      tone({ type: 'triangle', from: 1600, to: 900, dur: 0.2, vol: 0.06, delay: 0.02 });
      noise({ dur: 0.18, vol: 0.05, filter: { type: 'highpass', freq: 3800 } });
      coin(0.12);
    },

    /* "Heh heh heh" in cartoon witch. */
    witchCackle() {
      if (!ensure()) return;
      [330, 300, 268, 240].forEach((freq, index) => {
        tone({
          type: 'sawtooth',
          from: freq,
          to: freq * 0.82,
          dur: 0.16,
          vol: 0.09,
          delay: index * 0.17,
          vibrato: 40,
          vibratoRate: 24,
          filter: { type: 'bandpass', freq: 950, q: 2.6 },
        });
      });
      noise({ dur: 0.5, vol: 0.035, filter: { type: 'bandpass', freq: 1400, q: 1.6 } });
    },

    /* Pop! A reindeer becomes a fox. */
    foxPop() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 320, to: 880, dur: 0.16, vol: 0.13 });
      tone({ type: 'square', from: 880, to: 1320, dur: 0.1, vol: 0.07, delay: 0.1 });
      noise({ dur: 0.2, vol: 0.05, filter: { type: 'highpass', freq: 3200 } });
    },

    /* Poof, back to zombie reindeer. */
    foxRevert() {
      if (!ensure()) return;
      tone({ type: 'sine', from: 640, to: 200, dur: 0.22, vol: 0.12 });
      noise({ dur: 0.24, vol: 0.06, filter: { type: 'lowpass', freq: 1200, to: 300 } });
      boing(190, 0.06);
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

    /* Little red motorbike revving: brap-brap-brap. */
    motorcycle() {
      if (!ensure()) return;
      [0, 0.26, 0.52].forEach((delay) => {
        tone({
          type: 'sawtooth',
          from: 96,
          to: 210,
          dur: 0.24,
          vol: 0.12,
          delay,
          filter: { type: 'lowpass', freq: 900, to: 2200, q: 4 },
        });
        tone({
          type: 'square',
          from: 58,
          to: 124,
          dur: 0.24,
          vol: 0.08,
          delay,
          filter: { type: 'lowpass', freq: 520 },
        });
        noise({ dur: 0.24, vol: 0.07, delay, filter: { type: 'bandpass', freq: 620, q: 1.2 }, am: 28, amRate: 52 });
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
