/**
 * THE GRIN — a face that keeps its smile while it comes apart.
 *
 * The boss is drawn procedurally: a pale, huge-eyed girl's face at morph 0,
 * then cracks, extra eyes, fangs, horns and a triangular rift as morph climbs
 * to 1. The static portrait is cached to an offscreen canvas and only redrawn
 * when the morph value actually moves, so phones can keep 60fps.
 */

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const smooth = (edge0, edge1, value) => ease((value - edge0) / (edge1 - edge0 || 1e-6));
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STAGE_MORPHS = [0.06, 0.36, 0.68, 0.96];

export function metrics(morph) {
  const m = clamp01(morph);

  const skin = mixC(mixC([244, 205, 184], [156, 140, 152], smooth(0.08, 0.58, m)), [16, 9, 18], smooth(0.62, 0.96, m));
  const hair = mixC([126, 84, 52], [16, 8, 14], smooth(0.05, 0.62, m));
  const lip = mixC([198, 62, 74], [74, 4, 14], smooth(0.2, 0.9, m));

  return {
    m,
    skin,
    skinShade: mixC(skin, [8, 4, 10], 0.45),
    hair,
    lip,
    teeth: mixC([247, 242, 230], [226, 213, 208], smooth(0.3, 0.9, m)),
    iris: mixC([96, 68, 44], [255, 34, 52], smooth(0.2, 0.82, m)),
    sclera: mixC([250, 246, 241], [255, 208, 210], smooth(0.45, 0.95, m)),
    headW: lerp(80, 88, smooth(0, 0.9, m)),
    headH: lerp(94, 106, smooth(0, 1, m)),
    eyeX: lerp(34, 38, smooth(0, 0.8, m)),
    eyeY: lerp(-16, -10, smooth(0, 0.8, m)),
    eyeRX: lerp(21.5, 24, smooth(0, 0.8, m)),
    eyeRY: lerp(25, 27, smooth(0, 0.8, m)),
    pupilW: lerp(10.5, 3.5, smooth(0.1, 0.85, m)),
    pupilH: lerp(12, 19, smooth(0.1, 0.85, m)),
    mouthY: lerp(44, 50, smooth(0, 1, m)),
    mouthW: lerp(32, 76, smooth(0.1, 1, m)),
    mouthH: lerp(34, 60, smooth(0.05, 1, m)),
    fang: smooth(0.5, 0.95, m),
    glow: smooth(0.35, 0.9, m),
  };
}

/* Branching cracks, seeded so they never wander between frames. */
const CRACKS = (() => {
  const random = mulberry32(0x6772696e);
  const origins = [
    [-34, -14], [34, -14], [0, 58], [-22, 78], [26, 80],
    [-62, -2], [62, 4], [-8, -70],
  ];
  const cracks = [];
  for (let i = 0; i < 18; i += 1) {
    const [ox, oy] = origins[Math.floor(random() * origins.length)];
    let x = ox + (random() - 0.5) * 8;
    let y = oy + (random() - 0.5) * 8;
    let angle = Math.atan2(oy, ox || 0.1) + (random() - 0.5) * 0.9;
    const points = [[x, y]];
    const segments = 3 + Math.floor(random() * 4);
    for (let s = 0; s < segments; s += 1) {
      angle += (random() - 0.5) * 0.9;
      const length = 7 + random() * 15;
      x += Math.cos(angle) * length;
      y += Math.sin(angle) * length;
      points.push([x, y]);
    }
    cracks.push({ points, width: 1.8 + random() * 2.8, alpha: 0.45 + random() * 0.55 });
  }
  return cracks;
})();

const EXTRA_EYES = [
  { x: -44, y: -56, s: 0.42, at: 0.34 },
  { x: 46, y: -48, s: 0.36, at: 0.4 },
  { x: 1, y: -70, s: 0.5, at: 0.5 },
  { x: -60, y: 16, s: 0.3, at: 0.58 },
  { x: 62, y: 10, s: 0.34, at: 0.64 },
  { x: -18, y: 86, s: 0.26, at: 0.72 },
  { x: 28, y: 90, s: 0.3, at: 0.8 },
  { x: 8, y: -30, s: 0.22, at: 0.88 },
];

export function drawEye(c, x, y, rx, ry, M, opts = {}) {
  const scale = opts.scale || 1;
  const glow = opts.glow ?? M.glow;
  const iris = opts.iris || M.iris;

  c.save();
  c.translate(x, y);
  if (opts.tilt) c.rotate(opts.tilt);

  if (glow > 0.02) {
    const halo = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx * 3.1);
    halo.addColorStop(0, `rgba(255,40,60,${0.38 * glow})`);
    halo.addColorStop(1, 'rgba(255,30,50,0)');
    c.fillStyle = halo;
    c.fillRect(-rx * 3.2, -ry * 3.2, rx * 6.4, ry * 6.4);
  }

  /* Sclera. */
  const scleraGrad = c.createRadialGradient(-rx * 0.3, -ry * 0.4, 2, 0, 0, ry * 1.2);
  scleraGrad.addColorStop(0, css(mixC(M.sclera, [255, 255, 255], 0.35)));
  scleraGrad.addColorStop(1, css(mixC(M.sclera, [176, 156, 168], 0.55)));
  c.fillStyle = scleraGrad;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.fill();

  c.strokeStyle = 'rgba(48,22,34,0.8)';
  c.lineWidth = 1.7;
  c.stroke();

  /* Iris. */
  c.fillStyle = css(mixC(iris, [255, 210, 190], 0.2));
  c.beginPath();
  c.ellipse(0, 0, rx * 0.58, ry * 0.6, 0, 0, TAU);
  c.fill();

  const irisGrad = c.createRadialGradient(0, 0, 1, 0, 0, rx * 0.6);
  irisGrad.addColorStop(0, css(mixC(iris, [0, 0, 0], 0.42)));
  irisGrad.addColorStop(0.72, css(iris));
  irisGrad.addColorStop(1, css(mixC(iris, [255, 90, 90], 0.45)));
  c.fillStyle = irisGrad;
  c.beginPath();
  c.ellipse(0, 0, rx * 0.58, ry * 0.6, 0, 0, TAU);
  c.fill();

  if (M.glow > 0.5) {
    c.strokeStyle = `rgba(255,70,90,${0.8 * M.glow})`;
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(0, 0, rx * 0.58, ry * 0.6, 0, 0, TAU);
    c.stroke();
  }

  /* Pupil — rounds out into a vertical slit as the thing underneath wakes up. */
  const pupilScale = scale * (rx / (M.eyeRX || 1));
  c.fillStyle = '#100208';
  c.beginPath();
  c.ellipse(0, 0, M.pupilW * pupilScale, M.pupilH * pupilScale, 0, 0, TAU);
  c.fill();

  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.beginPath();
  c.ellipse(-rx * 0.22, -ry * 0.28, rx * 0.16, ry * 0.16, -0.4, 0, TAU);
  c.fill();

  /* Upper lid and lashes. */
  c.strokeStyle = 'rgba(40,16,26,0.85)';
  c.lineWidth = 2.2;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
  c.stroke();

  if (M.m > 0.3) {
    c.strokeStyle = `rgba(30,10,18,${0.7 * smooth(0.3, 0.9, M.m)})`;
    c.lineWidth = 1.4;
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI * (1.1 + i * 0.2);
      const bx = Math.cos(a) * rx;
      const by = Math.sin(a) * ry;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx * 1.18, by * 1.16);
      c.stroke();
    }
  }

  c.restore();
}

function hairHalf(c, s, M) {
  const { headW: w, headH: h } = M;
  c.moveTo(0, -h * 1.32);
  c.bezierCurveTo(s * w * 0.92, -h * 1.44, s * w * 1.58, -h * 0.76, s * w * 1.52, 0.08 * h);
  c.bezierCurveTo(s * w * 1.5, 0.84 * h, s * w * 1.26, 1.38 * h, s * w * 0.9, 1.66 * h);
  c.bezierCurveTo(s * w * 0.68, 1.82 * h, s * w * 0.55, 1.5 * h, s * w * 0.72, 1.24 * h);
  c.bezierCurveTo(s * w * 1.04, 0.86 * h, s * w * 1.1, 0.24 * h, s * w * 0.9, -0.3 * h);
  c.bezierCurveTo(s * w * 0.72, -0.86 * h, s * w * 0.42, -1.18 * h, 0, -h * 1.32);
  c.closePath();
}

function mouthPath(c, M) {
  const hw = M.mouthW;
  const top = M.mouthY - M.mouthH * 0.5;
  const bot = M.mouthY + M.mouthH * 0.5;
  const lift = M.m * 15;
  c.beginPath();
  const liftLeft = lift * 1.12;
  const liftRight = lift * 0.82;
  c.moveTo(-hw, top + 4 - liftLeft * 0.3);
  c.bezierCurveTo(-hw * 0.56, top - 16 - liftLeft, hw * 0.56, top - 16 - liftRight, hw, top + 4 - liftRight * 0.3);
  c.bezierCurveTo(hw * 0.98, bot - 8, hw * 0.55, bot + 10, 0, bot + 8);
  c.bezierCurveTo(-hw * 0.55, bot + 10, -hw * 0.98, bot - 8, -hw, top + 4 - liftLeft * 0.3);
  c.closePath();
  return { top, bot, lift, hw };
}

function headPath(c, M) {
  const w = M.headW;
  const h = M.headH;
  c.beginPath();
  c.moveTo(0, -h);
  c.bezierCurveTo(w * 0.92, -h * 0.96, w * 1.02, -h * 0.2, w * 0.96, h * 0.26);
  c.bezierCurveTo(w * 0.9, h * 0.78, w * 0.46, h * 1.0, 0, h * 0.96);
  c.bezierCurveTo(-w * 0.46, h * 1.0, -w * 0.9, h * 0.78, -w * 0.96, h * 0.26);
  c.bezierCurveTo(-w * 1.02, -h * 0.2, -w * 0.92, -h * 0.96, 0, -h);
  c.closePath();
}

function drawTeeth(c, M, hw, top, bot, lift) {
  const count = Math.round(lerp(5, 11, smooth(0.15, 0.9, M.m)));
  const sharp = smooth(0.35, 0.95, M.m);
  const upperH = M.mouthH * lerp(0.26, 0.46, sharp);
  const lowerH = M.mouthH * lerp(0.2, 0.38, sharp);
  const span = hw * 1.74;
  const toothW = span / count;

  const topArc = (t) => {
    const y0 = top - lift;
    const y1 = top - 16 - lift;
    return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y0;
  };
  const botArc = (t) => {
    const y0 = bot + 2;
    const y1 = bot + 11;
    return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y0;
  };

  c.fillStyle = css(M.teeth);
  c.strokeStyle = `rgba(60,20,30,${0.25 + 0.35 * sharp})`;
  c.lineWidth = 0.9;

  for (let i = 0; i < count; i += 1) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const x0 = -span / 2 + t0 * span;
    const x1 = -span / 2 + t1 * span;
    const inset = 1.1;
    const jitter = (i % 2 === 0 ? 1 : 0.82) * (1 - M.m * 0.2);
    const y = topArc((t0 + t1) / 2);
    const h = upperH * jitter;
    const tipInset = toothW * 0.16 * (1 - sharp * 0.7);
    c.beginPath();
    c.moveTo(x0 + inset, y - 2);
    c.lineTo(x1 - inset, y - 2);
    c.lineTo(x1 - inset + tipInset, y + h * 0.55);
    c.lineTo(x0 + inset + tipInset, y + h);
    c.lineTo(x0 + inset - tipInset * 0.4, y + h * 0.45);
    c.closePath();
    c.fill();
    c.stroke();
  }

  for (let i = 0; i < count; i += 1) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const x0 = -span / 2 + t0 * span;
    const x1 = -span / 2 + t1 * span;
    const inset = 1.1;
    const y = botArc((t0 + t1) / 2);
    const h = lowerH * (i % 2 === 0 ? 0.86 : 1) * (1 - M.m * 0.15);
    const tipInset = toothW * 0.14 * (1 - sharp * 0.7);
    c.beginPath();
    c.moveTo(x0 + inset, y + 2);
    c.lineTo(x1 - inset, y + 2);
    c.lineTo(x1 - inset + tipInset, y - h * 0.5);
    c.lineTo(x0 + inset + tipInset, y - h);
    c.lineTo(x0 + inset - tipInset * 0.4, y - h * 0.4);
    c.closePath();
    c.fill();
    c.stroke();
  }
}

export function drawFace(c, m) {
  const M = metrics(m);
  const { headW: w, headH: h } = M;

  /* Neck and shoulders, disappearing into the dark. */
  const neck = c.createLinearGradient(0, 60, 0, 170);
  neck.addColorStop(0, css(mixC(M.skin, [8, 3, 10], 0.62)));
  neck.addColorStop(1, 'rgba(6,2,8,0.95)');
  c.fillStyle = neck;
  c.beginPath();
  c.moveTo(-34, 58);
  c.bezierCurveTo(-30, 96, -44, 118, -86, 140);
  c.quadraticCurveTo(0, 176, 86, 140);
  c.bezierCurveTo(44, 118, 30, 96, 34, 58);
  c.closePath();
  c.fill();

  /* Hair mass behind the head. */
  const hairGrad = c.createLinearGradient(0, -h * 1.5, 0, h * 1.7);
  hairGrad.addColorStop(0, css(mixC(M.hair, [235, 196, 150], lerp(0.22, 0.04, M.m))));
  hairGrad.addColorStop(0.35, css(M.hair));
  hairGrad.addColorStop(1, css(mixC(M.hair, [0, 0, 0], 0.55)));
  c.fillStyle = hairGrad;
  c.beginPath();
  hairHalf(c, 1, M);
  hairHalf(c, -1, M);
  c.fill();

  /* Head. */
  const skinGrad = c.createRadialGradient(-w * 0.34, -h * 0.5, 4, 0, 0, h * 1.35);
  skinGrad.addColorStop(0, css(mixC(M.skin, [255, 248, 240], 0.28)));
  skinGrad.addColorStop(0.55, css(M.skin));
  skinGrad.addColorStop(1, css(mixC(M.skin, [30, 8, 18], 0.55)));
  c.fillStyle = skinGrad;
  headPath(c, M);
  c.fill();

  c.strokeStyle = `rgba(46,20,30,${0.35 - M.m * 0.15})`;
  c.lineWidth = 2;
  headPath(c, M);
  c.stroke();

  /* Shadow pooling under the jaw. */
  const jawShadow = c.createLinearGradient(0, h * 0.4, 0, h * 1.25);
  jawShadow.addColorStop(0, 'rgba(10,2,8,0)');
  jawShadow.addColorStop(1, `rgba(6,1,6,${0.5 + 0.3 * M.m})`);
  c.fillStyle = jawShadow;
  headPath(c, M);
  c.fill();

  /* Fractures under the skin. Drawn before the features so they never cross them. */
  const crackAlpha = smooth(0.08, 0.42, M.m);
  if (crackAlpha > 0.01) {
    c.save();
    headPath(c, M);
    c.clip();
    c.lineCap = 'round';
    c.lineJoin = 'round';

    c.strokeStyle = `rgba(12,0,6,${0.85 * crackAlpha})`;
    for (const crack of CRACKS) {
      c.lineWidth = crack.width + 2.4;
      c.beginPath();
      c.moveTo(crack.points[0][0], crack.points[0][1]);
      for (let i = 1; i < crack.points.length; i += 1) {
        c.lineTo(crack.points[i][0], crack.points[i][1]);
      }
      c.stroke();
    }

    c.shadowColor = 'rgba(255,36,64,0.95)';
    c.shadowBlur = 11;
    for (const crack of CRACKS) {
      c.strokeStyle = `rgba(255,58,84,${crackAlpha * crack.alpha})`;
      c.lineWidth = crack.width;
      c.beginPath();
      c.moveTo(crack.points[0][0], crack.points[0][1]);
      for (let i = 1; i < crack.points.length; i += 1) {
        c.lineTo(crack.points[i][0], crack.points[i][1]);
      }
      c.stroke();
    }
    c.restore();
  }

  /* Ears, which mostly stop being there. */
  if (M.m < 0.72) {
    c.save();
    c.globalAlpha = 1 - smooth(0.5, 0.72, M.m);
    c.fillStyle = css(mixC(M.skin, [220, 150, 140], 0.25));
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * w * 0.96, 4, 10, 17, s * 0.12, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  /* Locks falling in front of the shoulders, so the hair is not a helmet. */
  for (const s of [-1, 1]) {
    const lockGrad = c.createLinearGradient(s * 70, -h * 0.5, s * 90, h * 1.4);
    lockGrad.addColorStop(0, css(mixC(M.hair, [232, 190, 146], 0.24)));
    lockGrad.addColorStop(0.45, css(M.hair));
    lockGrad.addColorStop(1, css(mixC(M.hair, [0, 0, 0], 0.55)));
    c.fillStyle = lockGrad;
    c.beginPath();
    c.moveTo(s * w * 0.8, -h * 0.5);
    c.bezierCurveTo(s * w * 1.14, -h * 0.1, s * w * 1.04, h * 0.95, s * w * 0.76, h * 1.42);
    c.bezierCurveTo(s * w * 0.98, h * 0.9, s * w * 0.88, h * 0.12, s * w * 0.62, -h * 0.28);
    c.closePath();
    c.fill();
  }

  /* Fringe. */
  c.fillStyle = css(mixC(M.hair, [255, 220, 180], lerp(0.12, 0.02, M.m)));
  c.beginPath();
  c.moveTo(-w * 1.0, -h * 0.42);
  c.bezierCurveTo(-w * 0.96, -h * 1.14, -w * 0.34, -h * 1.24, w * 0.04, -h * 1.06);
  c.bezierCurveTo(w * 0.5, -h * 0.94, w * 0.92, -h * 0.7, w * 1.0, -h * 0.36);
  c.bezierCurveTo(w * 0.82, -h * 0.72, w * 0.46, -h * 0.92, w * 0.1, -h * 0.92);
  c.bezierCurveTo(-w * 0.3, -h * 0.92, -w * 0.72, -h * 0.78, -w * 1.0, -h * 0.42);
  c.closePath();
  c.fill();

  c.strokeStyle = css(mixC(M.hair, [255, 226, 190], 0.4), 0.4);
  c.lineWidth = 1.1;
  for (let i = 0; i < 7; i += 1) {
    const t = i / 6;
    c.beginPath();
    c.moveTo(-w * 0.9 + t * w * 1.8, -h * 1.02 + Math.sin(t * 3) * 6);
    c.quadraticCurveTo(-w * 0.2 + t * w * 1.2, -h * 0.9, -w * 0.4 + t * w * 1.5, -h * 0.52);
    c.stroke();
  }

  /* Brows. */
  const browLift = lerp(1, 0.35, smooth(0.2, 0.7, M.m));
  c.strokeStyle = css(mixC(M.hair, [20, 8, 12], 0.4), 0.85);
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const bx = s * M.eyeX;
    const by = M.eyeY - M.eyeRY - 9 * browLift;
    c.beginPath();
    c.moveTo(bx - s * M.eyeRX * 0.92, by + (1 - browLift) * 5);
    c.quadraticCurveTo(bx, by - 6 * browLift, bx + s * M.eyeRX * 0.92, by + 2);
    c.stroke();
  }

  /* Eyes. */
  for (const s of [-1, 1]) {
    drawEye(c, s * M.eyeX, M.eyeY, M.eyeRX, M.eyeRY, M, { tilt: s * 0.05 });
  }

  /* Nose, fading as the face stops being a face. */
  c.save();
  c.globalAlpha = 1 - smooth(0.58, 0.9, M.m) * 0.85;
  c.strokeStyle = `rgba(96,44,48,0.4)`;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-1.5, 2);
  c.quadraticCurveTo(-6, 20, -2, 25);
  c.moveTo(1.5, 2);
  c.quadraticCurveTo(6, 20, 2, 25);
  c.stroke();
  c.beginPath();
  c.ellipse(-6.5, 25, 4.4, 2.6, 0.3, 0, TAU);
  c.ellipse(6.5, 25, 4.4, 2.6, -0.3, 0, TAU);
  c.fillStyle = 'rgba(84,32,40,0.35)';
  c.fill();
  c.restore();

  /* Eye sockets sink in as the thing underneath pushes forward. */
  if (M.m > 0.2) {
    const socket = smooth(0.2, 0.82, M.m);
    for (const s of [-1, 1]) {
      const g = c.createRadialGradient(s * M.eyeX, M.eyeY, 2, s * M.eyeX, M.eyeY, M.eyeRX * 1.9);
      g.addColorStop(0, `rgba(8,0,6,${0.6 * socket})`);
      g.addColorStop(0.6, `rgba(12,0,8,${0.28 * socket})`);
      g.addColorStop(1, 'rgba(10,0,6,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(s * M.eyeX, M.eyeY, M.eyeRX * 1.9, 0, TAU);
      c.fill();
    }
  }

  /* Cheek flush, only while there is still a girl there. */
  if (M.m < 0.45) {
    c.save();
    c.globalAlpha = (1 - smooth(0, 0.45, M.m)) * 0.2;
    c.fillStyle = 'rgba(226,118,124,0.7)';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * 50, 22, 17, 8, s * 0.2, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  /* Mouth. */
  const { top, bot, lift, hw } = mouthPath(c, M);
  const mouthGrad = c.createRadialGradient(0, M.mouthY + 4, 4, 0, M.mouthY, M.mouthH * 1.5);
  mouthGrad.addColorStop(0, css(mixC([118, 10, 26], [255, 60, 70], M.glow * 0.7)));
  mouthGrad.addColorStop(0.6, '#2a0209');
  mouthGrad.addColorStop(1, '#070003');
  c.fillStyle = mouthGrad;
  mouthPath(c, M);
  c.fill();

  /* Tongue. */
  const tongueY = bot - M.mouthH * 0.13;
  const tongueGrad = c.createRadialGradient(0, tongueY - 4, 2, 0, tongueY, M.mouthW * 0.9);
  tongueGrad.addColorStop(0, '#e06070');
  tongueGrad.addColorStop(0.7, '#93132a');
  tongueGrad.addColorStop(1, '#3d0210');
  c.fillStyle = tongueGrad;
  c.beginPath();
  c.ellipse(0, tongueY, M.mouthW * 0.7, M.mouthH * 0.34, 0, 0, TAU);
  c.fill();

  drawTeeth(c, M, hw, top, bot, lift);

  /* Lips thicken and split into a grin. */
  c.strokeStyle = css(M.lip, 0.85);
  c.lineWidth = lerp(4.5, 2.4, smooth(0.2, 0.9, M.m));
  mouthPath(c, M);
  c.stroke();

  /* The extra eyes. */
  for (const eye of EXTRA_EYES) {
    if (M.m <= eye.at) continue;
    const scale = smooth(eye.at, eye.at + 0.14, M.m);
    const rx = M.eyeRX * eye.s * scale;
    const ry = M.eyeRY * eye.s * scale;
    if (rx < 1) continue;
    c.save();
    c.globalAlpha = scale;
    drawEye(c, eye.x, eye.y, rx, ry, M, { scale: 0.8, tilt: eye.x > 0 ? 0.15 : -0.15 });
    c.restore();
  }

  /* Horns. */
  if (M.m > 0.42) {
    const t = smooth(0.42, 0.86, M.m);
    c.save();
    c.globalAlpha = t;
    for (const s of [-1, 1]) {
      const grad = c.createLinearGradient(s * 40, -h, s * 100, -h * 1.7);
      grad.addColorStop(0, '#150810');
      grad.addColorStop(0.7, '#2c0a16');
      grad.addColorStop(1, '#ff2e4a');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(s * 40, -h * 0.92);
      c.bezierCurveTo(s * 74, -h * 1.16, s * 90, -h * 1.42, s * 76, -h * 1.68);
      c.bezierCurveTo(s * 104, -h * 1.44, s * 106, -h * 1.06, s * 62, -h * 0.76);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,54,76,0.6)';
      c.lineWidth = 1.8;
      c.shadowColor = 'rgba(255,30,60,0.85)';
      c.shadowBlur = 14;
      c.stroke();
      c.shadowBlur = 0;
    }
    c.restore();
  }

  /* Tendrils of hair that have their own opinion. */
  if (M.m > 0.58) {
    const t = smooth(0.58, 0.95, M.m);
    c.save();
    c.globalAlpha = t;
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        const sway = Math.sin(i * 2.3 + M.m * 6) * 12;
        c.strokeStyle = css(mixC(M.hair, [120, 8, 24], i / 4), 0.8);
        c.lineWidth = 6 - i;
        c.beginPath();
        c.moveTo(s * (w * 1.15), -h * 0.9 + i * 26);
        c.bezierCurveTo(
          s * (w * 1.5 + 18), -h * 0.7 + i * 30 + sway,
          s * (w * 1.55 - 10), h * 0.3 + i * 24 - sway,
          s * (w * 1.25), h * 1.2 + i * 12
        );
        c.stroke();
      }
    }
    c.restore();
  }

  /* The seam the thing underneath looks through. */
  if (M.m > 0.68) {
    const t = smooth(0.68, 0.95, M.m);
    c.save();
    c.globalAlpha = t;
    c.shadowColor = 'rgba(255,30,60,0.95)';
    c.shadowBlur = 16;
    c.strokeStyle = 'rgba(255,60,80,0.9)';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(0, -h * 0.9);
    c.lineTo(-4, -h * 0.5);
    c.lineTo(3, -h * 0.16);
    c.lineTo(-3, h * 0.2);
    c.lineTo(4, h * 0.58);
    c.lineTo(0, h * 0.95);
    c.stroke();
    c.restore();
  }
}

export class BossRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 420;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d');
    this.cachedMorph = -1;
    this.centerX = 210;
    this.centerY = 228;

    const random = mulberry32(0x53484152);
    this.shards = Array.from({ length: 14 }, () => ({
      angle: random() * TAU,
      radius: 1.45 + random() * 0.8,
      size: 6 + random() * 16,
      spin: (random() - 0.5) * 2.4,
      speed: 0.12 + random() * 0.3,
      tilt: random() * TAU,
    }));
  }

  ensureFace(morph) {
    if (Math.abs(morph - this.cachedMorph) < 0.004) return;
    this.cachedMorph = morph;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.save();
    c.translate(this.centerX, this.centerY);
    drawFace(c, morph);
    c.restore();
  }

  draw(ctx, { x, y, r, morph, time, flash = 0 }) {
    const m = clamp01(morph);
    const M = metrics(m);
    const s = r / 100;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    const mood = 0.35 + 0.65 * m;

    ctx.save();

    /* Aura: cold and thin when she is still a girl, arterial later. */
    const auraR = r * (2.1 + 0.1 * pulse);
    const aura = ctx.createRadialGradient(x, y, r * 0.3, x, y, auraR);
    aura.addColorStop(0, `rgba(150,6,34,${(0.26 + 0.1 * pulse) * mood})`);
    aura.addColorStop(0.45, `rgba(74,2,22,${0.16 * mood})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(x - auraR, y - auraR, auraR * 2, auraR * 2);

    /* The geometry the face is only a door in. */
    const rift = smooth(0.5, 0.86, m);
    if (rift > 0.01) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.07);
      ctx.globalAlpha = rift;

      const rad = r * 1.7;
      const tri = (rotation, scale) => {
        ctx.beginPath();
        for (let i = 0; i < 3; i += 1) {
          const a = rotation + (i / 3) * TAU;
          const px = Math.cos(a) * rad * scale;
          const py = Math.sin(a) * rad * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      tri(-Math.PI / 2, 1);
      ctx.fillStyle = 'rgba(10,0,8,0.6)';
      ctx.fill();
      ctx.shadowColor = 'rgba(255,36,64,0.95)';
      ctx.shadowBlur = 26;
      ctx.strokeStyle = `rgba(255, 52, 80, ${0.5 + 0.25 * Math.sin(time * 3)})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      tri(Math.PI / 2, 0.92);
      ctx.strokeStyle = 'rgba(255,96,116,0.5)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      tri(-Math.PI / 2, 0.34);
      ctx.strokeStyle = 'rgba(255,120,140,0.25)';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.restore();
    }

    /* Floating shards. */
    if (m > 0.3) {
      ctx.save();
      ctx.globalAlpha = smooth(0.3, 0.75, m);
      for (const shard of this.shards) {
        const angle = shard.angle + time * shard.speed;
        const sx = x + Math.cos(angle) * r * shard.radius;
        const sy = y + Math.sin(angle) * r * shard.radius * 0.9;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(shard.tilt + time * shard.spin);
        ctx.fillStyle = 'rgba(20,4,12,0.9)';
        ctx.strokeStyle = 'rgba(255,58,84,0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -shard.size * 0.5);
        ctx.lineTo(shard.size * 0.36, shard.size * 0.42);
        ctx.lineTo(-shard.size * 0.44, shard.size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    /* The face itself (cached). */
    this.ensureFace(m);
    const bob = Math.sin(time * 1.15) * r * 0.018;
    const sway = Math.sin(time * 0.63) * r * 0.022;
    ctx.save();
    ctx.translate(x + sway, y + bob);
    ctx.rotate(Math.sin(time * 0.55) * 0.016 * (1 + m));
    ctx.drawImage(
      this.canvas,
      -this.centerX * s,
      -this.centerY * s,
      this.canvas.width * s,
      this.canvas.height * s
    );
    ctx.restore();

    /* Live glow in the eyes and throat. */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eyeGlow = (M.glow * 0.5 + 0.08) * (0.65 + 0.35 * pulse);
    for (const dir of [-1, 1]) {
      const ex = x + sway + dir * M.eyeX * s;
      const ey = y + bob + M.eyeY * s;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.42);
      g.addColorStop(0, `rgba(255,60,80,${0.3 * eyeGlow})`);
      g.addColorStop(1, 'rgba(255,0,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - r * 0.42, ey - r * 0.42, r * 0.84, r * 0.84);
    }

    const mouthY = y + bob + M.mouthY * s;
    const mg = ctx.createRadialGradient(x + sway, mouthY, 2, x + sway, mouthY, r * 0.55);
    mg.addColorStop(0, `rgba(255,40,60,${0.26 * (0.3 + m) * (0.7 + 0.3 * pulse)})`);
    mg.addColorStop(1, 'rgba(180,0,30,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(x + sway - r * 0.55, mouthY - r * 0.55, r * 1.1, r * 1.1);
    ctx.restore();

    /* At the end, the geometry is printed over the face itself. */
    const sigil = smooth(0.7, 0.94, m);
    if (sigil > 0.01) {
      ctx.save();
      ctx.translate(x + sway, y + bob);
      ctx.rotate(0.32 + time * 0.1);
      ctx.globalAlpha = sigil * 0.32;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255, 44, 72, 0.7)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255,30,60,0.9)';
      ctx.shadowBlur = 18;

      const rad = r * 1.3;
      for (let pass = 0; pass < 2; pass += 1) {
        ctx.beginPath();
        for (let i = 0; i < 3; i += 1) {
          const a = (pass * Math.PI) / 3 - Math.PI / 2 + (i / 3) * TAU;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }

    /* Damage flash. */
    if (flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
      fg.addColorStop(0, `rgba(255,220,230,${0.55 * flash})`);
      fg.addColorStop(0.4, `rgba(255,40,70,${0.35 * flash})`);
      fg.addColorStop(1, 'rgba(255,0,40,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
      ctx.restore();
    }

    ctx.restore();
  }
}
