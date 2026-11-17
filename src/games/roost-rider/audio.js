/* ------------------------------------------------------------------ *
 * Roost Rider — synthesized engine and race sounds
 * Everything is generated with WebAudio; no audio files are needed.
 * ------------------------------------------------------------------ */

export function createAudio() {
  let context = null;
  let master = null;
  let engine = null;
  let noiseBuffer = null;
  let muted = false;

  function ensure() {
    if (context) return context;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      context = new AudioContextClass();
    } catch (error) {
      return null;
    }

    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 4;

    const engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    filter.connect(engineGain);
    engineGain.connect(master);

    const oscA = context.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 55;

    const oscB = context.createOscillator();
    oscB.type = 'square';
    oscB.frequency.value = 27;

    const oscC = context.createOscillator();
    oscC.type = 'triangle';
    oscC.frequency.value = 110;

    const gainB = context.createGain();
    gainB.gain.value = 0.55;
    const gainC = context.createGain();
    gainC.gain.value = 0.3;

    oscA.connect(filter);
    oscB.connect(gainB);
    gainB.connect(filter);
    oscC.connect(gainC);
    gainC.connect(filter);

    oscA.start();
    oscB.start();
    oscC.start();

    const windSource = context.createBufferSource();
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 720;
    windFilter.Q.value = 0.7;

    const windGain = context.createGain();
    windGain.gain.value = 0.0001;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSource.start();

    engine = { filter, engineGain, oscA, oscB, oscC, windGain };
    return context;
  }

  function tone(frequency, duration, options = {}) {
    if (!context || muted) return;
    const { type = 'sine', gain = 0.16, slide = null, delay = 0 } = options;
    const start = context.currentTime + delay;

    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, slide), start + duration);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function noise(duration, options = {}) {
    if (!context || muted) return;
    const { frequency = 500, q = 1, gain = 0.16, sweep = null, delay = 0 } = options;
    const start = context.currentTime + delay;

    const source = context.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = q;
    if (sweep) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), start + duration);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    update({ speed = 0, throttle = 0, boosting = false, active = true }) {
      if (!context || !engine) return;

      const now = context.currentTime;
      const current = Math.abs(speed);
      const gearSpan = 12;
      const gear = Math.min(6, Math.floor(current / gearSpan));
      const within = current - gear * gearSpan;
      const frequency =
        40 + gear * 8 + (within / gearSpan) * 28 + throttle * 12 + (boosting ? 10 : 0);

      engine.oscA.frequency.setTargetAtTime(frequency, now, 0.06);
      engine.oscB.frequency.setTargetAtTime(frequency * 0.5, now, 0.08);
      engine.oscC.frequency.setTargetAtTime(frequency * 2.01, now, 0.05);

      engine.filter.frequency.setTargetAtTime(
        320 + frequency * 6 + throttle * 240,
        now,
        0.1
      );

      const engineLevel = active
        ? 0.035 + throttle * 0.045 + Math.min(0.035, current * 0.0007)
        : 0.0001;
      engine.engineGain.gain.setTargetAtTime(engineLevel, now, 0.12);
      engine.windGain.gain.setTargetAtTime(
        active ? Math.min(0.18, current * 0.0026) : 0.0001,
        now,
        0.2
      );
    },
    countdown() {
      tone(520, 0.16, { type: 'square', gain: 0.1 });
    },
    go() {
      tone(760, 0.12, { type: 'square', gain: 0.12 });
      tone(1140, 0.3, { type: 'square', gain: 0.1, delay: 0.1 });
    },
    thud(strength = 0.5) {
      tone(86, 0.26, { gain: 0.16 * strength, slide: 42 });
      noise(0.2, { frequency: 420, q: 0.8, gain: 0.13 * strength });
    },
    whoosh() {
      noise(0.55, { frequency: 320, q: 0.9, gain: 0.09, sweep: 1800 });
    },
    chime() {
      tone(660, 0.12, { type: 'triangle', gain: 0.11 });
      tone(880, 0.12, { type: 'triangle', gain: 0.1, delay: 0.09 });
      tone(1320, 0.2, { type: 'triangle', gain: 0.09, delay: 0.18 });
    },
    finish() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone(frequency, 0.28, {
          type: 'triangle',
          gain: 0.12,
          delay: index * 0.14,
        });
      });
    },
  };
}
