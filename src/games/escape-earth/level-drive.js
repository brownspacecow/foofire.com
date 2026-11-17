import { clamp, lerp, rand, pick, roundRect, drawText, ellipse } from './util.js';

/* ------------------------------------------------------------------ *
 * Level 1 — Survive the drive
 * A white-knuckle run down a country road with a borrowed car, a
 * suspicious number of farm animals, and Grandma waiting at the end.
 * ------------------------------------------------------------------ */

const GOAL_METERS = 950;

const HAZARDS = [
  { emoji: '🚗', w: 0.25 },
  { emoji: '🚚', w: 0.33 },
  { emoji: '🚜', w: 0.31 },
  { emoji: '🪿', w: 0.13 },
  { emoji: '🐄', w: 0.23 },
  { emoji: '🗑️', w: 0.16 },
  { emoji: '🚧', w: 0.17 },
];

const CHEERS = [
  'Mom says this is the last time you drive.',
  'Grandma is standing in the driveway. Probably.',
  'That speed limit sign just gave up.',
  'You passed a cow. The cow looked impressed.',
  'Someone in the back seat is screaming. It is you.',
];

const HIT_LINES = [
  'Bonk!',
  'That was a mailbox!',
  'The hubcap has left the car.',
  'Ouch. That one had a family.',
  'The radio switched itself to polka.',
];

const DONUT_LINE = 'Donut acquired. Vehicle repaired by sugar.';

export function createDriveLevel({ sound, say = () => {}, onWin, onLose }) {
  let S;

  const reset = () => {
    S = {
      meters: 0,
      hearts: 3,
      points: 0,
      donuts: 0,
      playerX: 0,
      tilt: 0,
      mph: 58,
      obstacles: [],
      pickups: [],
      spawnTimer: 0.7,
      pickupTimer: 2.8,
      invuln: 0,
      flash: 0,
      shake: 0,
      time: 0,
      ended: false,
    };
  };

  reset();

  const speak = (text, seconds = 2) => say(text, seconds);

  const crash = (obstacle) => {
    obstacle.hit = true;
    S.hearts -= 1;
    S.invuln = 1.4;
    S.flash = 0.5;
    S.shake = 0.45;
    sound.crash();
    speak(pick(HIT_LINES), 1.4);
    if (S.hearts <= 0 && !S.ended) {
      S.ended = true;
      sound.lose();
      onLose({
        title: 'The car has resigned',
        text: "You ran out of car. The car is now mostly a suggestion. Grandma's driveway is still a long way off.",
        stats: [
          ['Distance', `${Math.floor(S.meters)} m`],
          ['Donuts', String(S.donuts)],
        ],
        points: S.points,
      });
    }
  };

  const update = (dt, input, view) => {
    if (S.ended) return;
    S.time += dt;

    const speed = 1 + (S.meters / GOAL_METERS) * 0.95;
    S.mph = Math.round(52 * speed);

    let steer = input.horizontal();
    if (!steer && input.pointer.down) {
      const target = clamp((input.pointer.x - view.w / 2) / (view.w * 0.38), -1, 1);
      steer = clamp((target - S.playerX) * 6, -1, 1);
    }
    S.playerX = clamp(S.playerX + steer * dt * 1.45, -0.92, 0.92);
    S.tilt = lerp(S.tilt, steer, Math.min(1, dt * 8));

    S.meters += dt * 33 * speed;
    S.invuln = Math.max(0, S.invuln - dt);
    S.flash = Math.max(0, S.flash - dt);
    S.shake = Math.max(0, S.shake - dt);

    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0) {
      const interval = lerp(1.15, 0.62, clamp(S.meters / GOAL_METERS, 0, 1));
      S.spawnTimer = rand(interval * 0.85, interval * 1.25);
      const hazard = pick(HAZARDS);
      S.obstacles.push({
        z: 0,
        x: rand(-0.76, 0.76),
        w: hazard.w,
        emoji: hazard.emoji,
        hit: false,
      });
      if (Math.random() < 0.18) {
        const twin = pick(HAZARDS);
        S.obstacles.push({
          z: 0.02,
          x: rand(-0.8, 0.8),
          w: twin.w,
          emoji: twin.emoji,
          hit: false,
        });
      }
      if (Math.random() < 0.3) speak(pick(CHEERS), 1.8);
    }

    S.pickupTimer -= dt;
    if (S.pickupTimer <= 0) {
      S.pickupTimer = rand(3.4, 5.2);
      S.pickups.push({ z: 0.05, x: rand(-0.7, 0.7), got: false });
    }

    for (const obstacle of S.obstacles) {
      obstacle.z += dt * (0.13 + 0.42 * obstacle.z) * (0.85 + speed * 0.25);
      if (obstacle.z > 0.9 && !obstacle.hit && S.invuln <= 0) {
        if (Math.abs(obstacle.x - S.playerX) < obstacle.w * 0.5 + 0.11) crash(obstacle);
      }
    }
    S.obstacles = S.obstacles.filter((obstacle) => obstacle.z < 1.12 && !obstacle.hit);

    for (const pickup of S.pickups) {
      pickup.z += dt * (0.14 + 0.44 * pickup.z) * (0.85 + speed * 0.25);
      if (!pickup.got && pickup.z > 0.86 && Math.abs(pickup.x - S.playerX) < 0.16) {
        pickup.got = true;
        S.donuts += 1;
        S.points += 100;
        S.hearts = Math.min(3, S.hearts + 1);
        sound.coin();
        speak(DONUT_LINE, 1.6);
      }
    }
    S.pickups = S.pickups.filter((pickup) => pickup.z < 1.12 && !pickup.got);

    if (S.meters >= GOAL_METERS && !S.ended) {
      S.ended = true;
      const points = S.points + 500 + S.hearts * 150;
      sound.win();
      onWin({
        title: 'You survived the drive',
        text: 'The car is on fire. Grandma does not mention it. "You made good time," she says, and hands you a sandwich.',
        stats: [
          ['Distance', '950 m of pure chaos'],
          ['Hearts left', `${S.hearts} / 3`],
          ['Donuts', String(S.donuts)],
        ],
        points,
      });
    }
  };

  const hud = () => ({
    stats: [
      ['Road', `${Math.min(100, Math.floor((S.meters / GOAL_METERS) * 100))}%`],
      ['Hearts', S.hearts > 0 ? '❤️'.repeat(S.hearts) : '💀'],
      ['Speed', `${S.mph} mph`],
      ['Donuts', String(S.donuts)],
    ],
  });

  const draw = (ctx, { w, h }, time) => {
    const cx = w / 2;
    const horizon = h * 0.36;
    const bottom = h * 0.98;
    const shakeX = S.shake > 0 ? Math.sin(time * 60) * S.shake * 8 : 0;
    const shakeY = S.shake > 0 ? Math.cos(time * 53) * S.shake * 5 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const project = (z) => {
      const e = z * z;
      return { y: lerp(horizon, bottom, e), half: lerp(w * 0.02, w * 0.6, e) };
    };

    const quad = (xa, xb, z0, z1, color) => {
      const a = project(z0);
      const b = project(z1);
      ctx.beginPath();
      ctx.moveTo(cx + xa * a.half, a.y);
      ctx.lineTo(cx + xb * a.half, a.y);
      ctx.lineTo(cx + xb * b.half, b.y);
      ctx.lineTo(cx + xa * b.half, b.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    /* dusk sky */
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1d0f3a');
    sky.addColorStop(0.55, '#6d2a83');
    sky.addColorStop(1, '#ff9d4d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 2);

    ctx.fillStyle = '#ffe27a';
    ellipse(ctx, w * 0.74, horizon - h * 0.11, h * 0.07, h * 0.07);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 122, 0.18)';
    ellipse(ctx, w * 0.74, horizon - h * 0.11, h * 0.13, h * 0.13);
    ctx.fill();

    /* hills */
    ctx.fillStyle = '#3a1650';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.quadraticCurveTo(w * 0.18, horizon - h * 0.09, w * 0.38, horizon);
    ctx.quadraticCurveTo(w * 0.58, horizon - h * 0.12, w * 0.8, horizon);
    ctx.quadraticCurveTo(w * 0.9, horizon - h * 0.05, w, horizon);
    ctx.lineTo(w, horizon + 2);
    ctx.lineTo(0, horizon + 2);
    ctx.closePath();
    ctx.fill();

    /* grass */
    const grass = ctx.createLinearGradient(0, horizon, 0, h);
    grass.addColorStop(0, '#1b3a2a');
    grass.addColorStop(1, '#0d1c14');
    ctx.fillStyle = grass;
    ctx.fillRect(0, horizon, w, h - horizon);

    /* asphalt */
    ctx.fillStyle = '#2a2440';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.02, horizon);
    ctx.lineTo(cx + w * 0.02, horizon);
    ctx.lineTo(cx + w * 0.6, bottom + 4);
    ctx.lineTo(cx - w * 0.6, bottom + 4);
    ctx.closePath();
    ctx.fill();

    /* edge lines */
    quad(0.95, 0.99, 0, 1, 'rgba(255, 217, 61, 0.85)');
    quad(-0.99, -0.95, 0, 1, 'rgba(255, 217, 61, 0.85)');

    /* centre dashes, scrolled toward the viewer */
    const scroll = (S.meters * 0.02) % 1;
    for (let i = 0; i < 14; i += 1) {
      const z0 = (i / 14 + scroll) % 1;
      const z1 = Math.min(0.995, z0 + 0.05);
      if (z1 <= z0) continue;
      quad(-0.5, -0.45, z0, z1, 'rgba(255, 248, 231, 0.7)');
      quad(0.45, 0.5, z0, z1, 'rgba(255, 248, 231, 0.7)');
    }

    /* roadside poles and trees */
    for (let i = 0; i < 10; i += 1) {
      const z = (i / 10 + (S.meters * 0.06) % 1) % 1;
      if (z < 0.02) continue;
      const p = project(z);
      const height = lerp(3, h * 0.34, z * z);
      const side = i % 2 === 0 ? -1 : 1;
      const x = cx + side * 1.16 * p.half;
      ctx.fillStyle = '#160f22';
      ctx.fillRect(x - Math.max(1, height * 0.03), p.y - height, Math.max(1.5, height * 0.06), height);
      ctx.fillStyle = '#241a3a';
      ellipse(ctx, x, p.y - height, height * 0.18, height * 0.22);
      ctx.fill();
    }

    /* pickups */
    for (const pickup of S.pickups) {
      if (pickup.z < 0.03) continue;
      const p = project(pickup.z);
      const size = lerp(8, Math.min(w, h) * 0.11, pickup.z * pickup.z);
      const x = cx + pickup.x * p.half;
      const bob = Math.sin(time * 6 + pickup.z * 9) * size * 0.08;
      ctx.fillStyle = 'rgba(255, 217, 61, 0.28)';
      ellipse(ctx, x, p.y - size * 0.45, size * 0.6, size * 0.6);
      ctx.fill();
      drawText(ctx, '🍩', x, p.y - size * 0.45 + bob, { size });
    }

    /* hazards, far to near */
    const sorted = [...S.obstacles].sort((a, b) => a.z - b.z);
    for (const obstacle of sorted) {
      if (obstacle.z < 0.03) continue;
      const p = project(obstacle.z);
      const size = lerp(8, Math.min(w, h) * 0.2, obstacle.z * obstacle.z) * (obstacle.w / 0.25);
      const x = cx + obstacle.x * p.half;
      ctx.fillStyle = 'rgba(5, 2, 12, 0.4)';
      ellipse(ctx, x, p.y, size * 0.42, size * 0.14);
      ctx.fill();
      drawText(ctx, obstacle.emoji, x, p.y - size * 0.42, { size });
    }

    /* the car */
    const carZ = 0.93;
    const p = project(carZ);
    const carW = clamp(w * 0.17, 60, 132);
    const carH = carW * 0.66;
    const carX = cx + S.playerX * p.half * 0.92;
    const carY = p.y - carH * 0.5;

    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(S.tilt * 0.09);

    ctx.fillStyle = 'rgba(5, 2, 12, 0.5)';
    ellipse(ctx, 0, carH * 0.52, carW * 0.56, carH * 0.16);
    ctx.fill();

    const body = ctx.createLinearGradient(0, -carH / 2, 0, carH / 2);
    body.addColorStop(0, '#ff5c7a');
    body.addColorStop(1, '#b3143a');
    ctx.fillStyle = body;
    roundRect(ctx, -carW / 2, -carH / 2, carW, carH, carW * 0.12);
    ctx.fill();
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = Math.max(2, carW * 0.035);
    ctx.stroke();

    ctx.fillStyle = '#2b2246';
    roundRect(ctx, -carW * 0.3, -carH * 0.34, carW * 0.6, carH * 0.3, carW * 0.06);
    ctx.fill();
    ctx.fillStyle = '#8fd7ff';
    roundRect(ctx, -carW * 0.26, -carH * 0.3, carW * 0.52, carH * 0.2, carW * 0.04);
    ctx.fill();

    ctx.fillStyle = '#120a1e';
    roundRect(ctx, -carW * 0.54, -carH * 0.28, carW * 0.1, carH * 0.34, carW * 0.03);
    ctx.fill();
    roundRect(ctx, carW * 0.44, -carH * 0.28, carW * 0.1, carH * 0.34, carW * 0.03);
    ctx.fill();
    roundRect(ctx, -carW * 0.54, carH * 0.1, carW * 0.1, carH * 0.3, carW * 0.03);
    ctx.fill();
    roundRect(ctx, carW * 0.44, carH * 0.1, carW * 0.1, carH * 0.3, carW * 0.03);
    ctx.fill();

    ctx.fillStyle = '#ffe27a';
    ellipse(ctx, -carW * 0.3, carH * 0.44, carW * 0.08, carH * 0.06);
    ctx.fill();
    ellipse(ctx, carW * 0.3, carH * 0.44, carW * 0.08, carH * 0.06);
    ctx.fill();

    if (S.invuln > 0) {
      ctx.globalAlpha = 0.28 + Math.sin(time * 30) * 0.12;
      ctx.fillStyle = '#8fd7ff';
      roundRect(ctx, -carW / 2, -carH / 2, carW, carH, carW * 0.12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* speed streaks */
    ctx.strokeStyle = 'rgba(255, 248, 231, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      const z = ((i / 7 + (S.meters * 0.35) % 1) % 1) * 0.7 + 0.15;
      const q = project(z);
      const side = i % 2 === 0 ? -1 : 1;
      const sx = cx + side * (0.7 + 0.2 * Math.sin(i)) * q.half;
      ctx.beginPath();
      ctx.moveTo(sx, q.y - h * 0.02);
      ctx.lineTo(sx, q.y - h * 0.07);
      ctx.stroke();
    }

    ctx.restore();

    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255, 46, 99, ${S.flash * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }

    drawText(ctx, 'GRANDMA OR BUST', cx, h * 0.07, {
      size: clamp(w * 0.022, 10, 18),
      pixel: true,
      color: '#ffd93d',
      alpha: 0.9,
      shadow: '#0a0518',
    });
  };

  return { hud, update, draw, reset };
}
