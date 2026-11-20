/* -------------------------------------------------------------------------
 * Phrase Pad — the audio engine.
 * Everything is generated live with Web Audio: no samples, no files.
 * Each voice is a couple of oscillators through a filter, an amp envelope
 * and a shared feedback delay. The Y axis feeds the filter cutoff (and the
 * FM index on the bell), so sliding up always opens the sound.
 * ---------------------------------------------------------------------- */

import { PRESETS } from './presets.js';

const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class PadSynth {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.75;
    this.muted = false;
    this.tempo = 120;
  }

  async start() {
    if (!this.ctx) this.build();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  build() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) throw new Error('This browser does not support Web Audio.');

    const ctx = new AudioCtor();
    this.ctx = ctx;

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.9;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.gainFor(this.volume);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;

    this.dry.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(ctx.destination);

    // One shared echo. Presets choose how much of themselves to send here.
    this.delayIn = ctx.createGain();
    this.delay = ctx.createDelay(2.5);
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.55;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.33;

    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;

    this.delayIn.connect(this.delay);
    this.delay.connect(damp);
    damp.connect(this.feedback);
    this.feedback.connect(this.delay);
    damp.connect(this.delayWet);
    this.delayWet.connect(this.master);

    this.setTempo(this.tempo);
    this.ready = true;
  }

  gainFor(value) {
    return 0.85 * Math.pow(clamp(value, 0, 1), 1.6);
  }

  setTempo(bpm) {
    this.tempo = clamp(Number(bpm) || 120, 40, 240);
    if (!this.ctx) return;
    const dottedEighth = (60 / this.tempo) * 0.75;
    this.delay.delayTime.setTargetAtTime(
      clamp(dottedEighth, 0.08, 2.2),
      this.ctx.currentTime,
      0.05
    );
  }

  setVolume(value) {
    this.volume = clamp(Number(value) || 0, 0, 1);
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.gainFor(this.volume),
      this.ctx.currentTime,
      0.02
    );
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(
      this.muted ? 0 : this.gainFor(this.volume),
      this.ctx.currentTime,
      0.015
    );
  }

  play({ midi, tone = 0.5, when, duration = 0.2, preset }) {
    if (!this.ready || !preset) return;
    const ctx = this.ctx;
    const start = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.002);
    const length = Math.max(0.04, duration);
    const frequency = mtof(midi);
    const toneValue = clamp(tone, 0, 1);

    const amp = ctx.createGain();
    amp.gain.value = 0.0001;
    const send = ctx.createGain();
    send.gain.value = preset.delay;
    const filter = ctx.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.Q.value = preset.filter.q;

    amp.connect(this.dry);
    amp.connect(send);
    send.connect(this.delayIn);
    filter.connect(amp);

    // Y axis to cutoff, with a quick filter movement for character.
    const cutoff = clamp(
      preset.filter.min * Math.pow(preset.filter.max / preset.filter.min, toneValue),
      40,
      16000
    );
    filter.frequency.setValueAtTime(
      clamp(cutoff * preset.filter.envStart, 40, 16000),
      start
    );
    filter.frequency.linearRampToValueAtTime(
      cutoff,
      start + preset.filter.envTime + 0.005
    );

    // Amp envelope. cancelAndHold lets short gate steps cut a long release
    // cleanly without a click.
    const { attack, decay, sustain, release, level } = preset.amp;
    const peak = clamp(level, 0.0001, 0.5);
    const held = Math.max(0.0002, peak * sustain);
    const holdAt = Math.max(start + length, start + attack + 0.02);

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(peak, start + attack);
    amp.gain.linearRampToValueAtTime(held, start + attack + decay);
    if (typeof amp.gain.cancelAndHoldAtTime === 'function') {
      amp.gain.cancelAndHoldAtTime(holdAt);
    } else {
      amp.gain.cancelScheduledValues(holdAt);
      amp.gain.setValueAtTime(held, holdAt);
    }
    const stopAt = holdAt + release;
    amp.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    const sources = [];
    const extraNodes = [];
    const add = (type, freq, gainValue, detune = 0, destination = filter) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.detune.setValueAtTime(detune, start);
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(destination);
      sources.push(osc);
      extraNodes.push(gain);
      return osc;
    };

    if (preset.engine === 'bell') {
      // Simple two-operator FM: a bright metallic strike that settles.
      const carrier = add('sine', frequency, 0.9);
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = frequency * 3.01;
      const modGain = ctx.createGain();
      const depth = frequency * (0.7 + toneValue * 3.6);
      modGain.gain.setValueAtTime(depth, start);
      modGain.gain.exponentialRampToValueAtTime(
        Math.max(1, frequency * 0.04),
        start + 0.5
      );
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      sources.push(modulator);
      extraNodes.push(modGain);
      add('sine', frequency * 2.005, 0.16);
    } else if (preset.engine === 'bass') {
      add('square', frequency, 0.55);
      add('sine', frequency / 2, 0.8);
    } else if (preset.engine === 'pad') {
      add('sawtooth', frequency, 0.32, -9);
      add('sawtooth', frequency, 0.32, 0);
      add('sawtooth', frequency, 0.32, 9);
    } else if (preset.engine === 'pluck') {
      add('triangle', frequency, 0.7);
      add('sawtooth', frequency * 2, 0.12, 4);
    } else if (preset.engine === 'chip') {
      add('square', frequency, 0.5);
      add('square', frequency * 2, 0.12, -5);
    } else if (preset.oscs) {
      for (const osc of preset.oscs) {
        add(osc.type, frequency, osc.gain, osc.detune);
      }
    }

    for (const osc of sources) {
      osc.start(start);
      osc.stop(stopAt + 0.03);
    }

    const last = sources[sources.length - 1];
    if (last) {
      last.onended = () => {
        for (const node of [amp, send, filter, ...sources, ...extraNodes]) {
          try {
            node.disconnect();
          } catch (error) {
            /* already disconnected */
          }
        }
      };
    }
  }
}

export { PRESETS };
