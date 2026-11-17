/**
 * The Grin — procedural gothic boss score.
 *
 * Everything is synthesised with the Web Audio API, so the fight ships no
 * audio files. The loop is in D harmonic minor over a cathedral-organ arpeggio,
 * a wordless choir, tolling bells and a war-drum pulse. `setIntensity(0..4)`
 * strips layers away or piles them on as the boss breaks apart.
 */

const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

const BARS = 8;
const STEPS_PER_BAR = 16;

const PROGRESSION = [
  { root: 38, chord: [50, 53, 57], pad: [62, 65, 69], bell: 62 },
  { root: 38, chord: [50, 53, 57], pad: [62, 65, 69], bell: 65 },
  { root: 34, chord: [46, 50, 53], pad: [58, 62, 65], bell: 62 },
  { root: 33, chord: [45, 49, 52], pad: [57, 61, 64], bell: 69 },
  { root: 31, chord: [43, 46, 50], pad: [55, 58, 62], bell: 62 },
  { root: 34, chord: [46, 50, 53], pad: [58, 62, 65], bell: 65 },
  { root: 33, chord: [45, 49, 52], pad: [57, 61, 64], bell: 57 },
  { root: 33, chord: [45, 49, 52], pad: [57, 61, 64], bell: 55 },
];

const LEAD = [
  [74, null, 77, 74, 72, null, 70, 69],
  [74, null, 77, 81, 79, null, 77, 74],
  [77, null, 74, 72, 70, null, 69, 70],
  [73, null, 76, 80, 76, null, 73, 69],
  [74, null, 77, 79, 81, null, 79, 77],
  [77, null, 74, 72, 70, null, 69, 70],
  [73, null, 76, 80, 81, null, 79, 76],
  [75, null, 79, 75, 74, null, 70, 69],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let reverb = null;
  let reverbSend = null;
  let noiseBuffer = null;

  let muted = false;
  let playing = false;
  let intensity = 1;
  let bpm = 138;
  let stepIndex = 0;
  let nextStepTime = 0;
  let pumpTimer = null;
  let heartbeatAt = 0;

  function makeImpulse(seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.62;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.92;
    musicBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);

    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(2.9, 2.5);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.6;
    reverbSend.connect(reverb);
    reverb.connect(musicBus);

    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;

    return ctx;
  }

  /* ------------------------------------------------------------------ *
   * Primitives
   * ------------------------------------------------------------------ */

  function tone({
    type = 'sine',
    freq = 440,
    freqTo = null,
    at = 0,
    dur = 0.3,
    vol = 0.05,
    attack = 0.006,
    detune = 0,
    filter = null,
    vibrato = 0,
    vibRate = 5,
    send = 0,
    dest = null,
    bus = null,
  }) {
    const c = ensure();
    if (!c) return;

    const start = c.currentTime + at;
    const length = Math.max(0.04, dur);

    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (freqTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), start + length);
    }
    if (detune) osc.detune.value = detune;

    let tail = osc;
    if (filter) {
      const node = c.createBiquadFilter();
      node.type = filter.type || 'lowpass';
      node.frequency.setValueAtTime(Math.max(80, filter.freq || 1600), start);
      if (filter.to) {
        node.frequency.exponentialRampToValueAtTime(Math.max(60, filter.to), start + length);
      }
      node.Q.value = filter.q || 1;
      tail.connect(node);
      tail = node;
    }

    if (vibrato) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = vibRate;
      depth.gain.value = vibrato;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + length + 0.1);
    }

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    tail.connect(gain);
    gain.connect(bus || dest || musicBus);

    if (send) {
      const sendGain = c.createGain();
      sendGain.gain.value = send;
      gain.connect(sendGain);
      sendGain.connect(reverbSend);
    }

    osc.start(start);
    osc.stop(start + length + 0.06);
  }

  function noise({
    at = 0,
    dur = 0.2,
    vol = 0.06,
    filter = null,
    attack = 0.004,
    bus = null,
  }) {
    const c = ensure();
    if (!c) return;

    const start = c.currentTime + at;
    const source = c.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    let tail = source;
    if (filter) {
      const node = c.createBiquadFilter();
      node.type = filter.type || 'bandpass';
      node.frequency.setValueAtTime(Math.max(80, filter.freq || 1200), start);
      if (filter.to) {
        node.frequency.exponentialRampToValueAtTime(Math.max(60, filter.to), start + dur);
      }
      node.Q.value = filter.q || 1;
      tail.connect(node);
      tail = node;
    }

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    tail.connect(gain);
    gain.connect(bus || sfxBus);

    source.start(start);
    source.stop(start + dur + 0.05);
  }

  /* ------------------------------------------------------------------ *
   * Instruments
   * ------------------------------------------------------------------ */

  function organ(note, at, dur, vol = 0.02) {
    tone({ type: 'sawtooth', freq: midiToFreq(note), at, dur, vol, detune: -7, filter: { freq: 2300, q: 0.8 } });
    tone({ type: 'sawtooth', freq: midiToFreq(note), at, dur, vol, detune: 7, filter: { freq: 2300, q: 0.8 } });
    tone({ type: 'sine', freq: midiToFreq(note + 12), at, dur: dur * 0.8, vol: vol * 0.35 });
  }

  function choir(note, at, dur, vol = 0.015) {
    tone({
      type: 'triangle',
      freq: midiToFreq(note),
      at,
      dur,
      vol,
      attack: 0.42,
      send: 0.55,
      vibrato: 2.1,
      vibRate: 4.4,
      filter: { freq: 1500, q: 0.8 },
    });
    tone({
      type: 'sawtooth',
      freq: midiToFreq(note),
      at,
      dur: dur * 0.9,
      vol: vol * 0.32,
      attack: 0.6,
      send: 0.7,
      filter: { freq: 900, q: 1.2 },
    });
  }

  function warBass(note, at, dur, vol = 0.05) {
    tone({
      type: 'sawtooth',
      freq: midiToFreq(note),
      at,
      dur,
      vol,
      filter: { freq: 540, q: 2.4, to: 160 },
    });
    tone({ type: 'sine', freq: midiToFreq(note - 12), at, dur, vol: vol * 0.9 });
  }

  function towerBell(note, at, vol = 0.045) {
    const c = ensure();
    if (!c) return;
    const start = c.currentTime + at;
    const freq = midiToFreq(note);

    const carrier = c.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq;

    const modulator = c.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = freq * 2.02;

    const modGain = c.createGain();
    modGain.gain.setValueAtTime(freq * 3.4, start);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.04, start + 2.2);
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.4);
    carrier.connect(gain);
    gain.connect(musicBus);

    const send = c.createGain();
    send.gain.value = 0.9;
    gain.connect(send);
    send.connect(reverbSend);

    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + 3.5);
    modulator.stop(start + 3.5);
  }

  function kick(at, vol = 0.2) {
    tone({ type: 'sine', freq: 150, freqTo: 42, at, dur: 0.19, vol, attack: 0.004 });
    noise({ at, dur: 0.045, vol: vol * 0.25, filter: { type: 'lowpass', freq: 900 } });
  }

  function snare(at, vol = 0.07) {
    noise({ at, dur: 0.14, vol, filter: { type: 'bandpass', freq: 1900, q: 1.3 } });
    tone({ type: 'triangle', freq: 210, freqTo: 140, at, dur: 0.1, vol: vol * 0.7 });
  }

  function hat(at, vol = 0.025, dur = 0.05) {
    noise({ at, dur, vol, filter: { type: 'highpass', freq: 7200 } });
  }

  function crash(at, vol = 0.06) {
    noise({ at, dur: 0.9, vol, filter: { type: 'highpass', freq: 3600 } });
    noise({ at, dur: 0.6, vol: vol * 0.5, filter: { type: 'bandpass', freq: 5200, q: 0.6 } });
  }

  function tom(at, vol = 0.07, pitch = 120) {
    tone({ type: 'sine', freq: pitch, freqTo: pitch * 0.55, at, dur: 0.22, vol });
  }

  /* ------------------------------------------------------------------ *
   * Score
   * ------------------------------------------------------------------ */

  function scheduleStep(step, at) {
    const barIndex = Math.floor(step / STEPS_PER_BAR) % BARS;
    const s = step % STEPS_PER_BAR;
    const bar = PROGRESSION[barIndex];
    const stepDur = 60 / bpm / 4;
    const level = intensity;

    if (s === 0) {
      for (const note of bar.pad) choir(note, at, (60 / bpm) * 3.9, 0.013 + level * 0.0016);
      if (level >= 3) choir(bar.pad[0] + 7, at, (60 / bpm) * 3.6, 0.008);
      if (barIndex % 2 === 0) towerBell(bar.bell, at, 0.04);

      if (level >= 3 && barIndex % 4 === 0) crash(at, 0.05);
      if (level >= 2 && barIndex % 4 === 2) crash(at, 0.03);
    }

    const arpNotes = [
      bar.chord[0],
      bar.chord[1],
      bar.chord[2],
      bar.chord[0] + 12,
      bar.chord[2] + 12,
      bar.chord[1] + 12,
      bar.chord[2] + 12,
      bar.chord[0] + 24,
    ];

    if (level >= 2 || s % 2 === 0) {
      const note = arpNotes[s % arpNotes.length];
      const accent = s % 4 === 0 ? 1.35 : 1;
      organ(note, at, stepDur * (level >= 2 ? 0.92 : 1.4), 0.014 * accent);
    }

    const bassSteps = level >= 3 ? [0, 2, 4, 6, 8, 10, 12, 14] : level >= 1 ? [0, 4, 6, 8, 12, 14] : [0, 8];
    if (bassSteps.includes(s)) {
      const note = s === 6 || s === 14 ? bar.root + 12 : s === 10 ? bar.root + 7 : bar.root;
      warBass(note, at, stepDur * 1.6, 0.045);
    }

    if (level >= 1) {
      if (s === 0 || s === 8) kick(at, 0.19);
      if (s === 4 || s === 12) snare(at, 0.065);
      if (s % 4 === 0) hat(at, 0.02);
    }
    if (level >= 2) {
      if (s === 6 || s === 11) kick(at, 0.14);
      if (s % 2 === 0) hat(at, 0.016, 0.04);
      if (s === 15) snare(at, 0.03);
    }
    if (level >= 3) {
      if (s === 3 || s === 14) kick(at, 0.12);
      if (s % 2 === 1) hat(at, 0.011, 0.03);
      if (s === 10) tom(at, 0.06, 110);
      if (s === 15) tom(at, 0.05, 150);
    }
    if (level >= 4) {
      if (s % 2 === 0) kick(at, 0.1);
      if (s === 7) snare(at, 0.045);
      const leadNote = LEAD[barIndex][s / 2];
      if (s % 2 === 0 && leadNote) {
        tone({
          type: 'sawtooth',
          freq: midiToFreq(leadNote),
          at,
          dur: stepDur * 1.5,
          vol: 0.03,
          detune: 4,
          vibrato: 6,
          vibRate: 5.6,
          filter: { freq: 3200, q: 3 },
          send: 0.25,
        });
        tone({
          type: 'square',
          freq: midiToFreq(leadNote - 12),
          at,
          dur: stepDur * 1.2,
          vol: 0.012,
          filter: { freq: 1400, q: 2 },
        });
      }
      if (s === 0 && barIndex === 7) {
        tone({ type: 'sawtooth', freq: midiToFreq(51), at, dur: (60 / bpm) * 2, vol: 0.02, filter: { freq: 800, q: 4 } });
      }
    }

    /* Heartbeat under the choir. */
    const now = ctx ? ctx.currentTime : 0;
    if (level >= 2 && at + now > heartbeatAt && level >= 3 && s === 0) {
      heartbeatAt = ctx.currentTime + 0.6;
      tone({ type: 'sine', freq: 84, freqTo: 48, at, dur: 0.3, vol: 0.07, bus: musicBus });
      tone({ type: 'sine', freq: 70, freqTo: 42, at: at + 0.31, dur: 0.28, vol: 0.05, bus: musicBus });
    }
  }

  function pump() {
    const c = ensure();
    if (!c || !playing) return;
    if (nextStepTime < c.currentTime - 0.25) nextStepTime = c.currentTime + 0.06;

    while (nextStepTime < c.currentTime + 0.18) {
      scheduleStep(stepIndex, nextStepTime - c.currentTime);
      stepIndex += 1;
      nextStepTime += 60 / bpm / 4;
    }
  }

  /* ------------------------------------------------------------------ *
   * Public kit
   * ------------------------------------------------------------------ */

  const kit = {
    unlock() {
      ensure();
    },

    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.62;
      if (!muted && playing && ctx) {
        nextStepTime = ctx.currentTime + 0.08;
        pump();
      }
    },

    isMuted() {
      return muted;
    },

    setIntensity(level) {
      intensity = Math.max(0, Math.min(4, level));
      bpm = 132 + intensity * 4;
      if (intensity >= 4) bpm = 150;
    },

    startMusic() {
      if (playing) return;
      const c = ensure();
      if (!c) return;
      playing = true;
      stepIndex = 0;
      nextStepTime = c.currentTime + 0.12;
      heartbeatAt = 0;
      pump();
      pumpTimer = window.setInterval(pump, 32);
    },

    stopMusic() {
      playing = false;
      if (pumpTimer) window.clearInterval(pumpTimer);
      pumpTimer = null;
    },

    /* --- story / UI voices ------------------------------------------- */

    blip(pitch = 520, vol = 0.035) {
      tone({ type: 'square', freq: pitch, freqTo: pitch * 0.92, at: 0, dur: 0.045, vol, bus: sfxBus });
    },

    bossBlip(pitch = 190) {
      tone({ type: 'sawtooth', freq: pitch, freqTo: pitch * 0.86, at: 0, dur: 0.06, vol: 0.03, filter: { freq: 1200, q: 1 }, bus: sfxBus });
    },

    menuTick() {
      tone({ type: 'square', freq: 660, at: 0, dur: 0.04, vol: 0.025, bus: sfxBus });
    },

    menuSelect() {
      tone({ type: 'square', freq: 440, freqTo: 880, at: 0, dur: 0.09, vol: 0.035, bus: sfxBus });
    },

    menuDeny() {
      tone({ type: 'sawtooth', freq: 200, freqTo: 120, at: 0, dur: 0.18, vol: 0.04, filter: { freq: 900, q: 2 }, bus: sfxBus });
    },

    slash() {
      noise({ at: 0, dur: 0.22, vol: 0.09, filter: { type: 'bandpass', freq: 900, to: 4200, q: 0.9 } });
      tone({ type: 'sawtooth', freq: 900, freqTo: 180, at: 0, dur: 0.18, vol: 0.045, filter: { freq: 2600, q: 2 }, bus: sfxBus });
    },

    crit() {
      noise({ at: 0, dur: 0.4, vol: 0.1, filter: { type: 'highpass', freq: 1200 } });
      [880, 1320, 1760].forEach((freq, index) => {
        tone({ type: 'square', freq, at: index * 0.04, dur: 0.16, vol: 0.035, bus: sfxBus });
      });
      tone({ type: 'sawtooth', freq: 120, freqTo: 40, at: 0, dur: 0.4, vol: 0.09, bus: sfxBus });
    },

    hurt() {
      tone({ type: 'square', freq: 420, freqTo: 90, at: 0, dur: 0.25, vol: 0.07, bus: sfxBus });
      noise({ at: 0, dur: 0.2, vol: 0.08, filter: { type: 'lowpass', freq: 1800, to: 300 } });
    },

    heal() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        tone({ type: 'triangle', freq, at: index * 0.05, dur: 0.22, vol: 0.04, bus: sfxBus });
      });
    },

    laserWarn() {
      tone({
        type: 'sawtooth',
        freq: 180,
        freqTo: 900,
        at: 0,
        dur: 0.9,
        vol: 0.035,
        vibrato: 18,
        vibRate: 16,
        filter: { freq: 2400, q: 3 },
        bus: sfxBus,
      });
    },

    laserFire() {
      noise({ at: 0, dur: 0.45, vol: 0.1, filter: { type: 'bandpass', freq: 3000, to: 400, q: 0.8 } });
      tone({ type: 'sawtooth', freq: 240, freqTo: 60, at: 0, dur: 0.4, vol: 0.08, filter: { freq: 1400, q: 2 }, bus: sfxBus });
    },

    beamFire() {
      noise({ at: 0, dur: 0.7, vol: 0.12, filter: { type: 'lowpass', freq: 5200, to: 200 } });
      tone({ type: 'sawtooth', freq: 90, freqTo: 40, at: 0, dur: 0.7, vol: 0.1, filter: { freq: 700, q: 2 }, bus: sfxBus });
      tone({ type: 'sine', freq: 55, at: 0, dur: 0.8, vol: 0.1, bus: sfxBus });
    },

    spawn() {
      tone({ type: 'triangle', freq: 780, freqTo: 300, at: 0, dur: 0.09, vol: 0.018, bus: sfxBus });
    },

    shatter() {
      noise({ at: 0, dur: 1.1, vol: 0.12, filter: { type: 'highpass', freq: 900, to: 300 } });
      [1046, 880, 660, 440, 220].forEach((freq, index) => {
        tone({ type: 'square', freq, freqTo: freq * 0.5, at: index * 0.09, dur: 0.3, vol: 0.04, bus: sfxBus });
      });
      tone({ type: 'sine', freq: 60, freqTo: 30, at: 0.2, dur: 1.4, vol: 0.12, bus: sfxBus });
    },

    bossScream() {
      tone({
        type: 'sawtooth',
        freq: 320,
        freqTo: 90,
        at: 0,
        dur: 1.3,
        vol: 0.06,
        vibrato: 40,
        vibRate: 24,
        filter: { freq: 2200, q: 4 },
        bus: sfxBus,
        send: 0.6,
      });
      tone({
        type: 'sawtooth',
        freq: 480,
        freqTo: 120,
        at: 0.08,
        dur: 1.2,
        vol: 0.04,
        vibrato: 55,
        vibRate: 31,
        filter: { freq: 3000, q: 3 },
        bus: sfxBus,
      });
      noise({ at: 0, dur: 1.4, vol: 0.06, filter: { type: 'bandpass', freq: 1800, to: 240, q: 0.7 } });
    },

    heartbeat() {
      tone({ type: 'sine', freq: 90, freqTo: 44, at: 0, dur: 0.26, vol: 0.09, bus: sfxBus });
      tone({ type: 'sine', freq: 74, freqTo: 40, at: 0.3, dur: 0.24, vol: 0.06, bus: sfxBus });
    },

    victory() {
      const melody = [62, 65, 69, 74, 77, 81];
      melody.forEach((note, index) => {
        tone({
          type: 'triangle',
          freq: midiToFreq(note),
          at: index * 0.16,
          dur: 0.9,
          vol: 0.035,
          attack: 0.02,
          send: 0.8,
          bus: sfxBus,
          dest: null,
        });
      });
      towerBell(50, 0, 0.05);
    },

    spareTone() {
      [57, 62, 65, 69].forEach((note, index) => {
        tone({
          type: 'triangle',
          freq: midiToFreq(note),
          at: index * 0.12,
          dur: 2.2,
          vol: 0.03,
          attack: 0.6,
          send: 0.9,
          bus: sfxBus,
        });
      });
      towerBell(69, 0.1, 0.035);
    },

    uiOpen() {
      tone({ type: 'triangle', freq: 320, freqTo: 620, at: 0, dur: 0.12, vol: 0.03, bus: sfxBus });
    },
  };

  return kit;
}
