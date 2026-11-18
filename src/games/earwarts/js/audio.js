/**
 * The castle's instrument, built on the Web Audio API. Every sound is
 * synthesised live; there are no audio files and no library to download.
 */

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
    this.volume = 0.7;
    this.muted = false;
    this.lastPlayback = null;
  }

  async init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.42;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'running') {
      this.started = true;
      return;
    }
    try {
      // Some browsers keep resume() pending until a fresh user gesture. Do not
      // let that freeze a listening challenge; a later tap can resume it.
      await Promise.race([
        this.ctx.resume().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);
    } catch {
      /* The UI still works without audio. */
    }
    this.started = this.ctx.state === 'running';
  }

  applySettings(volume, muted) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume * 0.42,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  scheduleTone(midi, at, duration, velocity = 0.5, type = 'triangle') {
    if (!this.ctx || !this.master) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiToHz(midi), at);
    const peak = Math.max(0.0001, velocity * 0.24);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(peak * 0.42, at + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.05);
  }

  scheduleDrum(at, pitch = 92, velocity = 0.8) {
    if (!this.ctx || !this.master) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(pitch, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(34, pitch * 0.35), at + 0.18);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.5, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + 0.32);
  }

  scheduleClick(at, high = false) {
    if (!this.ctx || !this.master) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(high ? 1650 : 1080, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + 0.05);
  }

  async playNotes(midis, options = {}) {
    await this.init().catch(() => undefined);
    if (!this.ctx) return;
    const { gap = 0.55, duration = 0.75, velocity = 0.5, lead = 0.12 } = options;
    const start = this.ctx.currentTime + lead;
    midis.forEach((midi, index) => {
      this.scheduleTone(midi, start + index * gap, duration, velocity);
    });
    this.lastPlayback = () => this.playNotes(midis, options);
    await sleep((lead + Math.max(0, midis.length - 1) * gap + duration) * 1000 + 90);
  }

  async playChord(midis, duration = 2.1) {
    await this.init().catch(() => undefined);
    if (!this.ctx) return;
    const start = this.ctx.currentTime + 0.12;
    midis.forEach((midi) => this.scheduleTone(midi, start, duration, 0.44));
    midis.forEach((midi) => this.scheduleTone(midi, start + 1.15, duration * 0.8, 0.32));
    this.lastPlayback = () => this.playChord(midis, duration);
    await sleep((duration + 1.35) * 1000);
  }

  async playCountIn(beats, tempo) {
    await this.init().catch(() => undefined);
    if (!this.ctx) return 0;
    const beatSeconds = 60 / tempo;
    const start = this.ctx.currentTime + 0.14;
    for (let index = 0; index < beats; index += 1) {
      this.scheduleClick(start + index * beatSeconds, index === 0);
    }
    await sleep(beats * beatSeconds * 1000 + 30);
    return beats * beatSeconds * 1000;
  }

  async playRhythmCounted(hits, totalBeats, tempo, countIn = 4) {
    await this.init().catch(() => undefined);
    if (!this.ctx) return 0;
    const beatSeconds = 60 / tempo;
    const start = this.ctx.currentTime + 0.16;
    for (let index = 0; index < countIn; index += 1) {
      this.scheduleClick(start + index * beatSeconds, index === 0);
    }
    const patternStart = start + countIn * beatSeconds;
    hits.forEach((hit) => {
      this.scheduleDrum(patternStart + hit * beatSeconds, 88);
      this.scheduleTone(
        hit % 1 === 0 ? 76 : 79,
        patternStart + hit * beatSeconds,
        0.09,
        0.18,
        'sine'
      );
    });
    this.lastPlayback = () =>
      this.playRhythmCounted(hits, totalBeats, tempo, countIn).then(() => undefined);
    await sleep((countIn * beatSeconds + totalBeats * beatSeconds) * 1000 + 260);
    return countIn * beatSeconds * 1000;
  }

  async tick() {
    await this.init().catch(() => undefined);
    if (!this.ctx) return;
    this.scheduleTone(84, this.ctx.currentTime + 0.01, 0.08, 0.18, 'sine');
  }

  async replayLast() {
    if (!this.lastPlayback) return false;
    await this.lastPlayback();
    return true;
  }

  async playSuccess() {
    await this.playNotes([72, 76, 79, 84], { gap: 0.11, duration: 0.6, velocity: 0.4 });
  }

  async playSoftMiss() {
    await this.playNotes([69, 67], { gap: 0.22, duration: 0.5, velocity: 0.3 });
  }

  async playSpell(id) {
    await this.init().catch(() => undefined);
    if (!this.ctx) return;
    const motif =
      id === 'lumina'
        ? [76, 79, 84]
        : id === 'floris'
          ? [72, 76, 79, 83]
          : id === 'leviosa'
            ? [72, 79, 84]
            : [76, 72, 76];
    const start = this.ctx.currentTime + 0.06;
    motif.forEach((midi, index) => {
      this.scheduleTone(midi, start + index * 0.09, 0.22, 0.34, 'sine');
    });
    if (id === 'leviosa') this.scheduleDrum(start + 0.02, 62, 0.55);
  }

  async playUnlock() {
    await this.playNotes([67, 71, 74, 79, 83], {
      gap: 0.13,
      duration: 1.1,
      velocity: 0.4,
    });
  }
}

export const audioEngine = new AudioEngine();

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export class EarTrainingEngine {
  constructor(audio) {
    this.audio = audio;
  }

  scaleMidi(degree, base = 60) {
    const octave = Math.floor(degree / MAJOR_SCALE.length);
    const index = ((degree % MAJOR_SCALE.length) + MAJOR_SCALE.length) % MAJOR_SCALE.length;
    return base + octave * 12 + MAJOR_SCALE[index];
  }

  async playPitchPair(first, second, gap = 0.85) {
    await this.audio.playNotes([first, second], { gap, duration: 0.95, velocity: 0.5 });
  }

  async playInterval(root, semitones) {
    await this.audio.playNotes([root, root + semitones], {
      gap: 0.9,
      duration: 0.9,
      velocity: 0.52,
    });
  }

  async playChord(root, semitones, duration = 2.1) {
    await this.audio.playChord(semitones.map((step) => root + step), duration);
  }

  async playMelody(midis, gap = 0.42) {
    await this.audio.playNotes(midis, { gap, duration: 0.55, velocity: 0.48 });
  }

  async playRhythm(hits, totalBeats, tempo, slow) {
    await this.audio.playRhythmCounted(hits, totalBeats, slow ? tempo * 0.68 : tempo, 4);
  }

  async playCountIn(tempo, slow) {
    return this.audio.playCountIn(4, slow ? tempo * 0.68 : tempo);
  }

  async replay() {
    return this.audio.replayLast();
  }

  async playSuccess() {
    return this.audio.playSuccess();
  }

  async playSoftMiss() {
    return this.audio.playSoftMiss();
  }

  async playSpell(id) {
    return this.audio.playSpell(id);
  }
}

export const earTraining = new EarTrainingEngine(audioEngine);
