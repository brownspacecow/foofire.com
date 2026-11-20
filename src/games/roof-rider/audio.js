/* ------------------------------------------------------------------ *
 * Roof Rider — synthesized engine, wind and rooftop sounds.
 * No audio files: everything is built with WebAudio on first input.
 * ------------------------------------------------------------------ */

export function createAudio() {
  let context = null;
  let master = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let windFilter = null;
  let noiseBuffer = null;
  let oscillators = [];
  let muted = false;
  let running = false;

  const ensure = () => {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      context = new AudioContextClass();
    } catch (error) {
      return null;
    }

    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);

    /* Engine: a saw, a sub square and a bright triangle. */
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 680;
    engineFilter.Q.value = 2.5;

    engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    const specs = [
      { type: 'sawtooth', ratio: 1, level: 0.7 },
      { type: 'square', ratio: 0.5, level: 0.45 },
      { type: 'triangle', ratio: 2.01, level: 0.2 },
    ];
    oscillators = specs.map((spec) => {
      const osc = context.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = 52 * spec.ratio;
      const gain = context.createGain();
      gain.gain.value = spec.level;
      osc.connect(gain);
      gain.connect(engineFilter);
      osc.start();
      return { osc, ratio: spec.ratio };
    });

    /* Wind: looping white noise through a bandpass. */
    const length = context.sampleRate * 2;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const wind = context.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0.0001;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();

    return context;
  };

  const ramp = (param, value, time = 0.08) => {
    if (!context) return;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, time);
  };

  const tone = ({ frequency = 220, endFrequency = frequency, duration = 0.15, type = 'sine', volume = 0.25, delay = 0 }) => {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  };

  const noiseBurst = ({ duration = 0.2, volume = 0.2, frequency = 500, type = 'lowpass', delay = 0 }) => {
    if (!context || !noiseBuffer || muted) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.35), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  };

  return {
    /** Must be called from a user gesture. */
    start() {
      const ctx = ensure();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      running = true;
    },

    /** Sound follows the engine and the wind. */
    update({ speed = 0, throttle = 0, air = false, scrub = false } = {}) {
      if (!context) return;
      if (!running) {
        ramp(engineGain.gain, 0.0001);
        ramp(windGain.gain, 0.0001);
        return;
      }

      const rev = Math.min(1, speed / 16);
      const base = 44 + rev * 92 + throttle * 26;
      oscillators.forEach(({ osc, ratio }) => {
        osc.frequency.setTargetAtTime(base * ratio, context.currentTime, 0.04);
      });
      engineFilter.frequency.setTargetAtTime(460 + rev * 900 + throttle * 260, context.currentTime, 0.05);

      const engineLevel = air && throttle > 0.5 ? 0.11 : 0.055 + throttle * 0.075 + rev * 0.03;
      ramp(engineGain.gain, muted ? 0.0001 : Math.min(0.16, engineLevel));
      ramp(windGain.gain, muted ? 0.0001 : Math.min(0.13, rev * rev * 0.12 + (scrub ? 0.05 : 0)));
      windFilter.frequency.setTargetAtTime(700 + speed * 70, context.currentTime, 0.1);
    },

    stop() {
      running = false;
      if (!context) return;
      ramp(engineGain.gain, 0.0001);
      ramp(windGain.gain, 0.0001);
    },

    land(strength = 1) {
      const amount = Math.min(1.4, 0.35 + strength * 0.1);
      tone({ frequency: 120, endFrequency: 42, duration: 0.22, type: 'sine', volume: 0.36 * amount });
      noiseBurst({ duration: 0.22, volume: 0.22 * amount, frequency: 700 });
    },

    pop() {
      tone({ frequency: 180, endFrequency: 330, duration: 0.12, type: 'triangle', volume: 0.22 });
      noiseBurst({ duration: 0.08, volume: 0.12, frequency: 1600 });
    },

    scrub() {
      noiseBurst({ duration: 0.4, volume: 0.1, frequency: 2200, type: 'bandpass' });
    },

    crash() {
      noiseBurst({ duration: 0.55, volume: 0.32, frequency: 420 });
      tone({ frequency: 90, endFrequency: 30, duration: 0.5, type: 'sawtooth', volume: 0.22 });
    },

    checkpoint() {
      tone({ frequency: 523, duration: 0.1, type: 'triangle', volume: 0.18 });
      tone({ frequency: 784, duration: 0.16, type: 'triangle', volume: 0.16, delay: 0.1 });
    },

    finish() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone({
          frequency,
          duration: 0.22,
          type: 'triangle',
          volume: 0.18,
          delay: index * 0.13,
        });
      });
    },

    setMuted(next) {
      muted = Boolean(next);
      if (!context) return;
      ramp(master.gain, muted ? 0 : 0.5, 0.05);
    },

    isMuted() {
      return muted;
    },

    get ready() {
      return Boolean(context);
    },
  };
}
