/**
 * Grocery Grab — tiny Web Audio synth sounds only. No recordings,
 * no external audio. Mute is shared site-wide via audio-prefs.
 */
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';

let ctx = null;
let muted = readMuted('groceryGrabMuted');

function ac() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0) {
  if (muted) return;
  try {
    const c = ac();
    if (!c) return;
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch (error) {
    /* Sound is decoration: a failure never stops the game. */
  }
}

export const sound = {
  isMuted() {
    return muted;
  },
  setMuted(next) {
    muted = Boolean(next);
    writeMuted(muted);
  },
  /** Call from a user gesture so the AudioContext is allowed to start. */
  unlock() {
    try {
      ac();
    } catch (error) {
      /* ignore */
    }
  },
  /** Grabbed a regular grocery. */
  pickup() {
    tone(880, 0.09, 'sine', 0.18);
    tone(1318, 0.12, 'sine', 0.14, 0.07);
  },
  /** Grabbed an item on the shopping list. */
  list() {
    tone(660, 0.1, 'triangle', 0.18);
    tone(880, 0.1, 'triangle', 0.18, 0.08);
    tone(1174, 0.16, 'triangle', 0.18, 0.16);
  },
  /** Grabbed a golden bonus item. */
  bonus() {
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.14, 'triangle', 0.2, i * 0.09));
  },
  /** Bumped into another shopper. */
  bump() {
    tone(140, 0.12, 'sine', 0.22);
  },
  /** One second left on the clock, almost out of time. */
  tick() {
    tone(1200, 0.05, 'square', 0.07);
  },
  /** Checkout: the till rings. */
  chaChing() {
    tone(1318, 0.1, 'square', 0.12);
    tone(1760, 0.24, 'square', 0.12, 0.1);
  },
};
