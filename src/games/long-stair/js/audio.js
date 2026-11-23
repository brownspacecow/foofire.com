/*
 * A small, deliberately quiet soundscape: a low cellar drone, a bell for
 * mercy, and short noises for violence. The site-wide mute preference wins.
 */
import { readMuted, writeMuted } from '../../../utils/audio-prefs.js';

let ctx = null;
let master = null;
let drone = null;
let muted = readMuted('longStairMuted');
let noiseBuffer = null;

export function isMuted() {
  return muted;
}

export function toggleMuted() {
  muted = !muted;
  writeMuted(muted);
  try {
    window.localStorage.setItem('longStairMuted', muted ? '1' : '0');
  } catch (error) {
    /* ignore */
  }
  if (master) master.gain.value = muted ? 0 : 0.8;
  if (!muted && ctx && ctx.state === 'suspended') ctx.resume();
}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    noiseBuffer = makeNoiseBuffer();
    startDrone();
  } catch (error) {
    ctx = null;
  }
}

function makeNoiseBuffer() {
  const length = Math.floor(ctx.sampleRate * 1.2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function startDrone() {
  if (!ctx || drone) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.045;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  gain.connect(filter);
  filter.connect(master);

  const low = ctx.createOscillator();
  low.type = 'sine';
  low.frequency.value = 55;
  const lowGain = ctx.createGain();
  lowGain.gain.value = 0.6;
  low.connect(lowGain);
  lowGain.connect(gain);

  const high = ctx.createOscillator();
  high.type = 'sine';
  high.frequency.value = 82.5;
  const highGain = ctx.createGain();
  highGain.gain.value = 0.28;
  high.connect(highGain);
  highGain.connect(gain);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  low.start();
  high.start();
  lfo.start();
  drone = { low, high, lfo, gain };
}

function tone({ freq, to = freq, duration = 0.2, type = 'sine', volume = 0.08, delay = 0 }) {
  if (!ctx || muted) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function noise({ duration = 0.2, volume = 0.1, frequency = 800, delay = 0 }) {
  if (!ctx || muted || !noiseBuffer) return;
  const now = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(now);
  source.stop(now + duration + 0.03);
}

export function sound(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'click':
      tone({ freq: 620, to: 500, duration: 0.05, type: 'square', volume: 0.02 });
      break;
    case 'step':
      noise({ duration: 0.09, volume: 0.035, frequency: 420 });
      tone({ freq: 82, to: 62, duration: 0.12, volume: 0.025 });
      break;
    case 'hit':
      noise({ duration: 0.16, volume: 0.12, frequency: 700 });
      tone({ freq: 96, to: 48, duration: 0.2, volume: 0.06 });
      break;
    case 'guard':
      noise({ duration: 0.1, volume: 0.05, frequency: 1600 });
      tone({ freq: 180, to: 140, duration: 0.18, type: 'triangle', volume: 0.04 });
      break;
    case 'stress':
      tone({ freq: 330, to: 140, duration: 0.6, volume: 0.035 });
      break;
    case 'break':
      tone({ freq: 190, to: 55, duration: 0.9, type: 'sawtooth', volume: 0.05 });
      noise({ duration: 0.7, volume: 0.05, frequency: 300 });
      break;
    case 'death':
      tone({ freq: 58, to: 38, duration: 1.6, volume: 0.09 });
      noise({ duration: 1.2, volume: 0.05, frequency: 220 });
      break;
    case 'heal':
      tone({ freq: 523, duration: 0.25, volume: 0.04 });
      tone({ freq: 659, duration: 0.35, volume: 0.03, delay: 0.08 });
      break;
    case 'ward':
      tone({ freq: 880, to: 740, duration: 0.3, type: 'triangle', volume: 0.035 });
      break;
    case 'cast':
      tone({ freq: 392, to: 784, duration: 0.35, type: 'triangle', volume: 0.035 });
      break;
    case 'coin':
      tone({ freq: 1175, duration: 0.1, volume: 0.03 });
      tone({ freq: 1568, duration: 0.18, volume: 0.025, delay: 0.06 });
      break;
    case 'bell':
      tone({ freq: 660, duration: 1.4, volume: 0.045 });
      tone({ freq: 990, duration: 1.1, volume: 0.025, delay: 0.02 });
      break;
    case 'page':
      noise({ duration: 0.25, volume: 0.035, frequency: 2400 });
      break;
    case 'oil':
      tone({ freq: 140, to: 210, duration: 0.35, type: 'triangle', volume: 0.03 });
      break;
    case 'encounter':
      tone({ freq: 82, to: 55, duration: 0.9, volume: 0.07 });
      noise({ duration: 0.5, volume: 0.04, frequency: 500 });
      break;
    case 'boss':
      tone({ freq: 44, to: 41, duration: 2.4, volume: 0.11 });
      tone({ freq: 65.4, to: 61, duration: 2.4, volume: 0.05 });
      noise({ duration: 1.8, volume: 0.04, frequency: 200 });
      break;
    case 'descend':
      tone({ freq: 160, to: 62, duration: 1.1, volume: 0.05 });
      break;
    case 'victory':
      tone({ freq: 220, duration: 0.8, volume: 0.04 });
      tone({ freq: 277, duration: 0.9, volume: 0.03, delay: 0.05 });
      tone({ freq: 330, duration: 1.2, volume: 0.025, delay: 0.1 });
      break;
    case 'win':
      tone({ freq: 196, duration: 1.2, volume: 0.05 });
      tone({ freq: 247, duration: 1.2, volume: 0.04, delay: 0.08 });
      tone({ freq: 294, duration: 1.6, volume: 0.03, delay: 0.16 });
      break;
    default:
      break;
  }
}
