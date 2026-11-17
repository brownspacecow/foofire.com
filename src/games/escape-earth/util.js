/* ------------------------------------------------------------------ *
 * Small drawing and maths helpers shared by the three levels.
 * ------------------------------------------------------------------ */

export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function roundRect(ctx, x, y, w, h, r = 0) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function ellipse(ctx, x, y, rx, ry, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, TAU);
}

/**
 * Chunky text for the canvas. `pixel` swaps to the arcade font from the
 * portal stylesheet; the page loads it, so it is ready by the time the
 * first frame draws.
 */
export function drawText(ctx, str, x, y, options = {}) {
  const {
    size = 16,
    weight = 700,
    color = '#fff8e7',
    align = 'center',
    baseline = 'middle',
    pixel = false,
    alpha = 1,
    shadow = null,
  } = options;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${
    pixel ? '"Press Start 2P", "Courier New", monospace' : 'Inter, system-ui, sans-serif'
  }`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) {
    ctx.fillStyle = shadow;
    const offset = Math.max(1, size * 0.08);
    ctx.fillText(str, x + offset, y + offset);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
