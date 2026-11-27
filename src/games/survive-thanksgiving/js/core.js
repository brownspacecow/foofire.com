/*
 * Survive Thanksgiving 2026 — shared game shell.
 *
 * One 960x540 virtual canvas, scaled to the stage. Chapters read `input` and
 * draw with the small cartoon helpers here. Sound is synthesised, so the game
 * has no asset downloads.
 */

export const VIEW_W = 960;
export const VIEW_H = 540;
export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) =>
  (t = clamp(t, 0, 1)) < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

export const canvas = document.getElementById('game-canvas');
export const ctx = canvas.getContext('2d');
const stage = document.getElementById('game-stage');

let dpr = 1;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

export function fitCanvas() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);
  if (canvas.width !== nextWidth) canvas.width = nextWidth;
  if (canvas.height !== nextHeight) canvas.height = nextHeight;
  scale = Math.min(width / VIEW_W, height / VIEW_H);
  offsetX = (width - VIEW_W * scale) / 2;
  offsetY = (height - VIEW_H * scale) / 2;
}

export function beginFrame() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a1222';
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, VIEW_H);
  ctx.clip();
}

export function endFrame() {
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const keys = new Set();
const pressedKeys = new Set();

const pointerStart = { x: VIEW_W / 2, y: VIEW_H / 2 };

export const input = {
  x: VIEW_W / 2,
  y: VIEW_H / 2,
  down: false,
  pressed: false,
  released: false,
  isDown: (code) => keys.has(code),
  wasPressed: (code) => pressedKeys.has(code),
  actionPressed() {
    return this.pressed || this.wasPressed('Space');
  },
};

function toVirtual(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - offsetX) / (scale || 1),
    y: (clientY - rect.top - offsetY) / (scale || 1),
  };
}

let activePointer = null;

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  initAudio();
  const point = toVirtual(event.clientX, event.clientY);
  activePointer = event.pointerId;
  pointerStart.x = point.x;
  pointerStart.y = point.y;
  input.x = point.x;
  input.y = point.y;
  input.down = true;
  input.pressed = true;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    /* Some browsers do not support capture on a pointerdown. */
  }
});

canvas.addEventListener('pointermove', (event) => {
  const point = toVirtual(event.clientX, event.clientY);
  input.x = point.x;
  input.y = point.y;
  if (activePointer !== null && event.pointerId !== activePointer) return;
});

function releasePointer(event) {
  if (activePointer !== null && event.pointerId !== undefined && event.pointerId !== activePointer) {
    return;
  }
  activePointer = null;
  input.down = false;
  input.released = true;
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', () => {
  input.down = false;
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const playing = document.body.classList.contains('tg-playing');
  if (playing && ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();
  }
  if (!keys.has(event.code)) pressedKeys.add(event.code);
  keys.add(event.code);
  initAudio();
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  input.down = false;
});

export function resetInput() {
  keys.clear();
  pressedKeys.clear();
  input.pressed = false;
  input.released = false;
  input.down = false;
}

export function endInputFrame() {
  input.pressed = false;
  input.released = false;
  pressedKeys.clear();
}

/* ------------------------------------------------------------------ */
/* Synthesised sound                                                   */
/* ------------------------------------------------------------------ */

let audio = null;
let master = null;
let noiseBuffer = null;
let muted = false;

export function initAudio() {
  if (muted) return;
  if (!audio) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      audio = new AudioCtor();
    } catch (error) {
      return;
    }
    master = audio.createGain();
    master.gain.value = 0.24;
    master.connect(audio.destination);

    noiseBuffer = audio.createBuffer(1, audio.sampleRate * 0.8, audio.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function tone(freq, duration, { type = 'sine', volume = 0.28, slide = 0, delay = 0 } = {}) {
  if (!audio || muted) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, freq), start);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function noise(duration, { volume = 0.25, filter = 1200, delay = 0 } = {}) {
  if (!audio || muted || !noiseBuffer) return;
  const start = audio.currentTime + delay;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  const biquad = audio.createBiquadFilter();
  biquad.type = 'lowpass';
  biquad.frequency.value = filter;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(biquad);
  biquad.connect(gain);
  gain.connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export const sfx = {
  tap: () => tone(620, 0.07, { type: 'triangle', volume: 0.16 }),
  pop: () => tone(900, 0.09, { type: 'square', volume: 0.1, slide: -320 }),
  ding: () => {
    tone(880, 0.13, { type: 'sine', volume: 0.2 });
    tone(1320, 0.2, { type: 'sine', volume: 0.16, delay: 0.08 });
  },
  hit: () => {
    noise(0.16, { volume: 0.24, filter: 1100 });
    tone(150, 0.16, { type: 'sawtooth', volume: 0.12, slide: -70 });
  },
  splat: () => noise(0.28, { volume: 0.4, filter: 500 }),
  whoosh: () => noise(0.24, { volume: 0.16, filter: 2400 }),
  slide: () => noise(0.4, { volume: 0.16, filter: 3200 }),
  splash: () => {
    noise(0.45, { volume: 0.38, filter: 900 });
    tone(280, 0.3, { type: 'sine', volume: 0.18, slide: -120 });
  },
  honk: () => {
    tone(330, 0.16, { type: 'square', volume: 0.12 });
    tone(260, 0.2, { type: 'square', volume: 0.12, delay: 0.2 });
  },
  gust: () => noise(0.9, { volume: 0.18, filter: 600 }),
  success: () => {
    [523, 659, 784, 1047].forEach((freq, index) => {
      tone(freq, 0.28, { type: 'triangle', volume: 0.18, delay: index * 0.1 });
    });
  },
  fail: () => {
    tone(240, 0.3, { type: 'sawtooth', volume: 0.12, slide: -100 });
    tone(180, 0.4, { type: 'sawtooth', volume: 0.1, slide: -60, delay: 0.18 });
  },
  tick: () => tone(1040, 0.04, { type: 'square', volume: 0.06 }),
};

export function toggleMute() {
  muted = !muted;
  if (!muted) {
    initAudio();
    if (master) master.gain.value = 0.24;
  } else if (master) {
    master.gain.value = 0;
  }
  return muted;
}

export function isMuted() {
  return muted;
}

/* ------------------------------------------------------------------ */
/* Particles and snow                                                  */
/* ------------------------------------------------------------------ */

const particles = [];

export function burst(x, y, options = {}) {
  const {
    count = 10,
    colors = ['#ffffff'],
    speed = 180,
    life = 0.8,
    size = 5,
    gravity = 700,
    spread = Math.PI * 2,
    angle = 0,
    shape = 'circle',
    drag = 1,
  } = options;
  for (let i = 0; i < count; i += 1) {
    const direction = angle + rand(-spread / 2, spread / 2);
    const velocity = rand(speed * 0.35, speed);
    const maxLife = rand(life * 0.6, life);
    particles.push({
      x,
      y,
      vx: Math.cos(direction) * velocity,
      vy: Math.sin(direction) * velocity,
      life: maxLife,
      maxLife,
      size: rand(size * 0.5, size),
      color: pick(colors),
      gravity,
      shape,
      drag,
      spin: rand(-6, 6),
      rot: rand(0, Math.PI * 2),
    });
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.vy += p.gravity * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function drawParticles(context) {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = p.color;
    context.translate(p.x, p.y);
    context.rotate(p.rot);
    if (p.shape === 'square') {
      context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else if (p.shape === 'star') {
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? p.size : p.size * 0.4;
        const a = (i / 8) * Math.PI * 2;
        context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      context.closePath();
      context.fill();
    } else {
      context.beginPath();
      context.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

export const flakes = Array.from({ length: 110 }, () => ({
  x: rand(0, VIEW_W),
  y: rand(0, VIEW_H),
  r: rand(1, 3.4),
  vy: rand(22, 64),
  vx: rand(-16, 8),
  alpha: rand(0.3, 0.9),
  wobble: rand(0, Math.PI * 2),
}));

export function updateSnow(dt) {
  for (const flake of flakes) {
    flake.wobble += dt * 2;
    flake.x += (flake.vx + Math.sin(flake.wobble) * 12) * dt;
    flake.y += flake.vy * dt;
    if (flake.y > VIEW_H + 6) {
      flake.y = -6;
      flake.x = rand(0, VIEW_W);
    }
    if (flake.x < -8) flake.x = VIEW_W + 8;
    if (flake.x > VIEW_W + 8) flake.x = -8;
  }
}

export function drawSnow(context, alpha = 0.9, wind = 0) {
  context.save();
  for (const flake of flakes) {
    context.globalAlpha = flake.alpha * alpha;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(flake.x + wind, flake.y, flake.r, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

export function roundRectPath(context, x, y, w, h, r = 8) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function label(context, text, x, y, size = 20, options = {}) {
  const {
    color = '#ffffff',
    align = 'left',
    baseline = 'middle',
    weight = 800,
    stroke = '#241a3a',
    strokeWidth = 4,
    alpha = 1,
  } = options;
  context.save();
  context.globalAlpha *= alpha;
  context.font = `${weight} ${size}px ${FONT}`;
  context.textAlign = align;
  context.textBaseline = baseline;
  context.lineJoin = 'round';
  if (strokeWidth > 0) {
    context.lineWidth = strokeWidth;
    context.strokeStyle = stroke;
    context.strokeText(text, x, y);
  }
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

export function wrapLines(context, text, maxWidth, font) {
  context.save();
  if (font) context.font = font;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (context.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  context.restore();
  return lines;
}

export function bubble(context, x, y, text, options = {}) {
  const {
    size = 16,
    maxWidth = 230,
    fill = '#fffdf4',
    ink = '#2a2340',
    stroke = '#2a2340',
    tail = true,
    alpha = 1,
  } = options;
  const font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(context, text, maxWidth, font);
  context.save();
  context.globalAlpha *= alpha;
  context.font = font;
  const textWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const width = textWidth + 28;
  const lineHeight = size + 5;
  const height = lines.length * lineHeight + 18;
  const bx = clamp(x - width / 2, 10, VIEW_W - width - 10);
  const by = clamp(y - height - (tail ? 12 : 0), 10, VIEW_H - height - 10);

  context.beginPath();
  roundRectPath(context, bx, by, width, height, 12);
  if (tail) {
    const tailX = clamp(x, bx + 20, bx + width - 20);
    context.moveTo(tailX - 8, by + height - 1);
    context.lineTo(tailX, by + height + 12);
    context.lineTo(tailX + 8, by + height - 1);
  }
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = stroke;
  context.stroke();

  context.fillStyle = ink;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) => {
    context.fillText(line, bx + width / 2, by + 11 + lineHeight * (index + 0.5) - 1);
  });
  context.restore();
}

/* Cartoon people. Feet sit on (x, y); one local unit is one pixel at scale 1. */
export const PEOPLE = {
  jira: {
    coat: '#8b5cf6',
    coatDark: '#6d3fd1',
    pants: '#3b2f5c',
    skin: '#f3c9a3',
    hair: '#3b2a22',
    hairStyle: 'braid',
    hat: '#f0a63c',
    scarf: '#ffd166',
  },
  joel: {
    coat: '#ef4444',
    coatDark: '#c62f2f',
    pants: '#31405c',
    skin: '#f4cfa8',
    hair: '#4a2f1d',
    hairStyle: 'short',
    hat: '#2f9e6b',
    scarf: '#7dd3fc',
  },
  dad: {
    coat: '#f97316',
    coatDark: '#d45d0c',
    pants: '#3f3f46',
    skin: '#e8b98f',
    hair: '#5b3a24',
    hairStyle: 'short',
    hat: '#1f2937',
    scarf: '#ef4444',
    beard: true,
    grownUp: true,
  },
  mom: {
    coat: '#14b8a6',
    coatDark: '#0d9488',
    pants: '#293241',
    skin: '#f3c9a3',
    hair: '#2b1b16',
    hairStyle: 'long',
    hat: '#be185d',
    scarf: '#fda4af',
    grownUp: true,
  },
  grandma: {
    coat: '#16a34a',
    coatDark: '#12813c',
    pants: '#3f3f46',
    skin: '#f0c3a0',
    hair: '#e5e7eb',
    hairStyle: 'bun',
    scarf: '#fef3c7',
    glasses: true,
    grownUp: true,
  },
  auntpat: {
    coat: '#be123c',
    coatDark: '#9f1239',
    pants: '#3f3f46',
    skin: '#f0c3a0',
    hair: '#d97706',
    hairStyle: 'up',
    scarf: '#fde68a',
    apron: true,
    grownUp: true,
  },
  cj: {
    coat: '#2563eb',
    coatDark: '#1d4ed8',
    pants: '#334155',
    skin: '#f2c9a0',
    hair: '#2f221b',
    hairStyle: 'short',
    hat: '#facc15',
    scarf: '#22c55e',
  },
  cousin: {
    coat: '#7c3aed',
    coatDark: '#5b21b6',
    pants: '#334155',
    skin: '#eec39a',
    hair: '#4b2e1e',
    hairStyle: 'short',
    hat: '#0ea5e9',
    scarf: '#fb7185',
  },
};

function capsule(context, x1, y1, x2, y2, width, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.restore();
}

export function drawPerson(context, x, y, s = 1, options = {}) {
  const p = {
    ...PEOPLE.joel,
    face: 'happy',
    armPose: 'down',
    facing: 0,
    ...options,
  };
  const ink = '#26223d';
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.lineJoin = 'round';
  context.lineWidth = 2.6;
  context.strokeStyle = ink;

  /* long hair behind the shoulders */
  if (p.hairStyle === 'long') {
    context.fillStyle = p.hair;
    context.beginPath();
    roundRectPath(context, -17, -80, 34, 42, 12);
    context.fill();
    context.stroke();
  }

  /* legs and boots */
  context.fillStyle = p.pants;
  for (const lx of [-11, 11]) {
    context.beginPath();
    roundRectPath(context, lx - 6, -27, 12, 22, 5);
    context.fill();
    context.stroke();
  }
  context.fillStyle = '#2b2437';
  for (const lx of [-11, 11]) {
    context.beginPath();
    roundRectPath(context, lx - 8, -11, 17, 11, 4);
    context.fill();
    context.stroke();
  }

  /* body */
  context.fillStyle = p.coat;
  context.beginPath();
  roundRectPath(context, -20, -60, 40, 38, 9);
  context.fill();
  context.stroke();
  context.fillStyle = p.coatDark;
  context.beginPath();
  roundRectPath(context, -20, -52, 40, 30, 7);
  context.fill();

  if (p.apron) {
    context.fillStyle = '#fef3c7';
    context.beginPath();
    roundRectPath(context, -13, -51, 26, 26, 5);
    context.fill();
    context.stroke();
  }

  /* arms */
  const armStartY = -54;
  if (p.armPose === 'up') {
    capsule(context, -16, armStartY, -28, armStartY - 22, 8, p.coat);
    capsule(context, 16, armStartY, 28, armStartY - 22, 8, p.coat);
    context.fillStyle = p.scarf;
    context.beginPath();
    context.arc(-29, armStartY - 23, 5, 0, Math.PI * 2);
    context.arc(29, armStartY - 23, 5, 0, Math.PI * 2);
    context.fill();
  } else if (p.armPose === 'throw') {
    capsule(context, -16, armStartY, -24, armStartY + 22, 8, p.coat);
    capsule(context, 16, armStartY, 30, armStartY - 18, 8, p.coat);
    context.fillStyle = p.scarf;
    context.beginPath();
    context.arc(32, armStartY - 20, 5, 0, Math.PI * 2);
    context.fill();
  } else {
    capsule(context, -16, armStartY, -24, armStartY + 22, 8, p.coat);
    capsule(context, 16, armStartY, 24, armStartY + 22, 8, p.coat);
    context.fillStyle = p.scarf;
    context.beginPath();
    context.arc(-25, armStartY + 23, 5, 0, Math.PI * 2);
    context.arc(25, armStartY + 23, 5, 0, Math.PI * 2);
    context.fill();
  }

  /* scarf */
  context.fillStyle = p.scarf;
  context.beginPath();
  roundRectPath(context, -16, -64, 32, 10, 5);
  context.fill();
  context.stroke();
  context.beginPath();
  roundRectPath(context, 5, -57, 10, 18, 4);
  context.fill();
  context.stroke();

  /* head */
  context.fillStyle = p.skin;
  context.beginPath();
  context.arc(0, -78, 16, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(-15, -77, 3.4, 0, Math.PI * 2);
  context.arc(15, -77, 3.4, 0, Math.PI * 2);
  context.fill();

  /* hair */
  context.fillStyle = p.hair;
  context.beginPath();
  if (p.hairStyle === 'long') {
    context.arc(0, -81, 16, Math.PI, Math.PI * 2);
    context.lineTo(16, -72);
    context.lineTo(-16, -72);
  } else if (p.hairStyle === 'bun') {
    context.arc(0, -82, 16, Math.PI * 1.02, Math.PI * 1.98);
    context.lineTo(15, -74);
    context.lineTo(-15, -74);
    context.closePath();
    context.fill();
    context.beginPath();
    context.arc(0, -98, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (p.hairStyle === 'up') {
    context.arc(0, -82, 16, Math.PI * 1.05, Math.PI * 1.95);
    context.lineTo(15, -76);
    context.lineTo(-15, -76);
    context.closePath();
    context.fill();
    context.beginPath();
    context.arc(-2, -98, 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (p.hairStyle !== 'none') {
    context.arc(0, -82, 16, Math.PI * 1.02, Math.PI * 1.98);
    context.lineTo(16, -76);
    context.quadraticCurveTo(6, -80, 2, -74);
    context.lineTo(-16, -74);
  }
  context.closePath();
  context.fill();
  context.stroke();

  if (p.hairStyle === 'braid') {
    context.fillStyle = p.hair;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.arc(19, -70 + i * 9, 5.2 - i * 0.6, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  /* beanie */
  if (p.hat) {
    context.fillStyle = p.hat;
    context.beginPath();
    context.arc(0, -82, 17.5, Math.PI * 1.02, Math.PI * 1.98);
    context.lineTo(17.5, -86);
    context.lineTo(-17.5, -86);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#fff8e7';
    context.beginPath();
    roundRectPath(context, -18.5, -87, 37, 8, 4);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, -101, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  /* face */
  context.fillStyle = ink;
  const eyeY = -79;
  if (p.face === 'worried') {
    context.beginPath();
    context.arc(-6, eyeY, 2.2, 0, Math.PI * 2);
    context.arc(6, eyeY, 2.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-10, -86);
    context.lineTo(-4, -84);
    context.moveTo(10, -86);
    context.lineTo(4, -84);
    context.stroke();
    context.beginPath();
    context.arc(0, -70, 4.5, Math.PI * 0.15, Math.PI * 0.85, true);
    context.stroke();
  } else if (p.face === 'grin') {
    context.beginPath();
    context.arc(-6, eyeY, 2.4, 0, Math.PI * 2);
    context.arc(6, eyeY, 2.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fffdf4';
    context.beginPath();
    context.arc(0, -71, 6.5, 0, Math.PI);
    context.fill();
    context.stroke();
  } else if (p.face === 'shock') {
    context.beginPath();
    context.arc(-6, eyeY, 3, 0, Math.PI * 2);
    context.arc(6, eyeY, 3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -71, 4, 0, Math.PI * 2);
    context.fillStyle = '#3a2433';
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.arc(-6, eyeY, 2.3, 0, Math.PI * 2);
    context.arc(6, eyeY, 2.3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -72, 5.5, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  }

  if (p.glasses) {
    context.strokeStyle = '#2b2437';
    context.lineWidth = 1.8;
    context.beginPath();
    context.arc(-6, -79, 6, 0, Math.PI * 2);
    context.arc(6, -79, 6, 0, Math.PI * 2);
    context.moveTo(-1, -79);
    context.lineTo(1, -79);
    context.stroke();
  }

  if (p.beard) {
    context.fillStyle = '#6b4a2f';
    context.beginPath();
    context.arc(0, -70, 9, 0.1 * Math.PI, 0.9 * Math.PI);
    context.closePath();
    context.fill();
    context.stroke();
  }

  context.restore();
}

/* Simple snow-capped pine, base at (x, y). */
export function drawPine(context, x, y, height, options = {}) {
  const { dark = '#21523f', light = '#2f7357', snow = '#f4fbff' } = options;
  context.save();
  context.translate(x, y);
  context.fillStyle = '#4d3726';
  context.fillRect(-height * 0.035, -height * 0.16, height * 0.07, height * 0.17);
  for (let layer = 0; layer < 3; layer += 1) {
    const width = height * (0.55 - layer * 0.12);
    const top = -height * (0.12 + layer * 0.23);
    const bottom = top + height * 0.4;
    context.fillStyle = layer === 1 ? light : dark;
    context.beginPath();
    context.moveTo(0, top - height * 0.22);
    context.lineTo(width / 2, bottom);
    context.lineTo(-width / 2, bottom);
    context.closePath();
    context.fill();
    context.fillStyle = snow;
    context.beginPath();
    context.moveTo(0, top - height * 0.22);
    context.lineTo(width / 2, bottom);
    context.lineTo(width * 0.16, bottom - height * 0.025);
    context.quadraticCurveTo(0, bottom - height * 0.12, -width * 0.16, bottom - height * 0.025);
    context.lineTo(-width / 2, bottom);
    context.closePath();
    context.fill();
  }
  context.restore();
}

/* Grandma's house, base at (x, y). */
export function drawHouse(context, x, y, s = 1, options = {}) {
  const { t = 0, lights = true, wall = '#a35a3d', roof = '#f6fbff' } = options;
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  const ink = '#241a2c';

  /* chimney smoke */
  context.globalAlpha = 0.5;
  for (let i = 0; i < 3; i += 1) {
    const drift = Math.sin(t * 0.8 + i * 1.4) * 8;
    context.fillStyle = '#e8eef5';
    context.beginPath();
    context.arc(84 + drift, -228 - i * 22, 10 + i * 4, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  /* walls */
  context.fillStyle = wall;
  context.strokeStyle = ink;
  context.lineWidth = 4;
  context.beginPath();
  roundRectPath(context, -150, -120, 300, 120, 4);
  context.fill();
  context.stroke();

  /* roof */
  context.fillStyle = roof;
  context.beginPath();
  context.moveTo(-176, -118);
  context.lineTo(0, -222);
  context.lineTo(176, -118);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#d7e8f5';
  context.beginPath();
  context.moveTo(-176, -118);
  context.lineTo(0, -222);
  context.lineTo(176, -118);
  context.lineTo(150, -108);
  context.lineTo(0, -196);
  context.lineTo(-150, -108);
  context.closePath();
  context.fill();

  /* chimney */
  context.fillStyle = '#7a412d';
  context.beginPath();
  roundRectPath(context, 64, -208, 42, 80, 4);
  context.fill();
  context.stroke();
  context.fillStyle = roof;
  context.beginPath();
  roundRectPath(context, 58, -216, 54, 16, 6);
  context.fill();
  context.stroke();

  /* windows */
  for (const wx of [-94, 94]) {
    context.fillStyle = lights ? '#ffd166' : '#3b4a66';
    context.beginPath();
    roundRectPath(context, wx - 34, -92, 68, 58, 6);
    context.fill();
    context.stroke();
    context.strokeStyle = '#8a4b34';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(wx, -92);
    context.lineTo(wx, -34);
    context.moveTo(wx - 34, -63);
    context.lineTo(wx + 34, -63);
    context.stroke();
    context.strokeStyle = ink;
    context.lineWidth = 4;
    context.strokeRect(wx - 35, -93, 70, 60);
  }

  /* door */
  context.fillStyle = '#5f2f25';
  context.beginPath();
  roundRectPath(context, -35, -82, 70, 82, 5);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffd166';
  context.beginPath();
  context.arc(20, -40, 4, 0, Math.PI * 2);
  context.fill();

  /* wreath */
  context.strokeStyle = '#2f8f5b';
  context.lineWidth = 9;
  context.beginPath();
  context.arc(0, -52, 13, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#ff2e63';
  context.beginPath();
  context.arc(8, -63, 4, 0, Math.PI * 2);
  context.fill();

  /* porch light */
  context.fillStyle = '#ffe29a';
  context.beginPath();
  context.arc(48, -96, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/* A soft rounded cloud, handy for dialogue and effects. */
export function cloud(context, x, y, s, color = '#ffffff') {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.arc(x - 20 * s, y, 14 * s, 0, Math.PI * 2);
  context.arc(x, y - 7 * s, 18 * s, 0, Math.PI * 2);
  context.arc(x + 22 * s, y, 13 * s, 0, Math.PI * 2);
  context.rect(x - 20 * s, y, 44 * s, 12 * s);
  context.fill();
  context.restore();
}
