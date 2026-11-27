/*
 * Survive Thanksgiving 2026 — the six chapters.
 *
 * Each chapter is a self-contained little arcade scene with update(dt) and
 * draw(ctx), and calls its onDone callback with a score and a note when the
 * chapter is finished. Everything is drawn procedurally on one canvas.
 */

import {
  VIEW_W,
  VIEW_H,
  FONT,
  clamp,
  lerp,
  rand,
  pick,
  easeOut,
  distance,
  input,
  sfx,
  burst,
  bubble,
  label,
  roundRectPath,
  drawPerson,
  PEOPLE,
  drawPine,
  drawHouse,
  drawSnow,
} from './core.js';

const CX = VIEW_W / 2;
const INK = '#241a2e';

/* ------------------------------------------------------------------ */
/* Small shared drawing bits                                           */
/* ------------------------------------------------------------------ */

function sky(context, top, bottom) {
  const gradient = context.createLinearGradient(0, 0, 0, VIEW_H);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEW_W, VIEW_H);
}

function snowGround(context, y, color = '#f4fbff', shade = '#d7e8f4') {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, y + 18);
  context.quadraticCurveTo(VIEW_W * 0.22, y - 12, VIEW_W * 0.48, y + 4);
  context.quadraticCurveTo(VIEW_W * 0.74, y + 18, VIEW_W, y - 6);
  context.lineTo(VIEW_W, VIEW_H);
  context.lineTo(0, VIEW_H);
  context.closePath();
  context.fill();
  context.fillStyle = shade;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.ellipse(VIEW_W * 0.2, y + 40, 210, 24, 0, 0, Math.PI * 2);
  context.ellipse(VIEW_W * 0.78, y + 56, 250, 28, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function topPanel(context, x, y, w, h) {
  context.save();
  context.fillStyle = 'rgba(16, 22, 42, 0.62)';
  context.beginPath();
  roundRectPath(context, x, y, w, h, 12);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function progressBar(context, x, y, w, h, value, color, back = 'rgba(255,255,255,0.18)') {
  context.save();
  context.fillStyle = back;
  context.beginPath();
  roundRectPath(context, x, y, w, h, h / 2);
  context.fill();
  if (value > 0) {
    context.fillStyle = color;
    context.beginPath();
    roundRectPath(context, x, y, Math.max(h, w * clamp(value, 0, 1)), h, h / 2);
    context.fill();
  }
  context.restore();
}

function flame(context, x, y, size, t, warm = true) {
  const wobble = Math.sin(t * 9 + x * 0.1) * size * 0.08;
  context.save();
  context.translate(x, y);
  context.fillStyle = warm ? '#ff8a00' : '#5aa9e6';
  context.beginPath();
  context.moveTo(-size * 0.5, 0);
  context.quadraticCurveTo(-size * 0.6, -size * 0.65, wobble, -size);
  context.quadraticCurveTo(size * 0.6, -size * 0.65, size * 0.5, 0);
  context.closePath();
  context.fill();
  context.fillStyle = '#ffd93d';
  context.beginPath();
  context.moveTo(-size * 0.24, 0);
  context.quadraticCurveTo(-size * 0.3, -size * 0.4, wobble * 0.5, -size * 0.62);
  context.quadraticCurveTo(size * 0.3, -size * 0.4, size * 0.24, 0);
  context.closePath();
  context.fill();
  context.restore();
}

function star(context, x, y, radius, points = 4) {
  context.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.38;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    context.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  context.closePath();
}

/* A rear-view cartoon car, also used on the menu. */
function drawDadCar(context, x, y, s = 1, options = {}) {
  const {
    tilt = 0,
    biscuits = false,
    snow = true,
    body = '#c0392b',
    bodyDark = '#922b21',
    brake = false,
    t = 0,
  } = options;
  context.save();
  context.translate(x, y);
  context.rotate(tilt);
  context.scale(s, s);
  context.lineJoin = 'round';

  /* wheels */
  context.fillStyle = '#24242c';
  context.beginPath();
  context.arc(-54, -10, 13, 0, Math.PI * 2);
  context.arc(54, -10, 13, 0, Math.PI * 2);
  context.fill();

  /* snow spray behind the tires */
  context.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 3; i += 1) {
    const puff = (t * 2 + i * 0.8) % 1;
    context.beginPath();
    context.arc(-52 + i * 52, -2 + puff * 14, 6 + puff * 9, 0, Math.PI * 2);
    context.fill();
  }

  /* body */
  context.fillStyle = body;
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.beginPath();
  roundRectPath(context, -64, -58, 128, 50, 13);
  context.fill();
  context.stroke();
  context.fillStyle = bodyDark;
  context.beginPath();
  roundRectPath(context, -64, -34, 128, 26, 12);
  context.fill();

  /* roof and rear window */
  context.fillStyle = body;
  context.beginPath();
  roundRectPath(context, -48, -88, 96, 36, 12);
  context.fill();
  context.stroke();
  context.fillStyle = '#23364f';
  context.beginPath();
  roundRectPath(context, -37, -83, 74, 24, 7);
  context.fill();
  context.strokeStyle = '#101827';
  context.lineWidth = 2;
  context.stroke();

  /* the biscuit bag on the back seat */
  if (biscuits) {
    context.fillStyle = '#c98a4b';
    context.beginPath();
    roundRectPath(context, -13, -79, 26, 19, 3);
    context.fill();
    context.stroke();
    context.fillStyle = '#f4e2bd';
    context.fillRect(-13, -74, 26, 6);
    context.fillStyle = '#6b4423';
    context.font = `700 5px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('BISCUITS', 0, -66);
  }

  /* snow cap */
  if (snow) {
    context.fillStyle = '#f7fcff';
    context.beginPath();
    roundRectPath(context, -50, -95, 100, 12, 6);
    context.fill();
    context.strokeStyle = '#bcd7e8';
    context.lineWidth = 2;
    context.stroke();
  }

  /* lights and bumper */
  context.fillStyle = brake ? '#ff6b6b' : '#e63946';
  context.beginPath();
  roundRectPath(context, -60, -44, 17, 11, 4);
  context.fill();
  context.beginPath();
  roundRectPath(context, 43, -44, 17, 11, 4);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.beginPath();
  roundRectPath(context, -55, -42, 7, 4, 2);
  context.fill();
  context.fillStyle = '#3a4050';
  context.beginPath();
  roundRectPath(context, -66, -21, 132, 13, 5);
  context.fill();
  context.strokeStyle = INK;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#f2f2e8';
  context.beginPath();
  roundRectPath(context, -18, -19, 36, 9, 2);
  context.fill();
  context.fillStyle = '#3b3b48';
  context.font = `700 6px ${FONT}`;
  context.textAlign = 'center';
  context.fillText('SNO 4IN', 0, -12);

  context.restore();
}

/* ------------------------------------------------------------------ */
/* Menu scene                                                          */
/* ------------------------------------------------------------------ */

export class TitleScene {
  constructor() {
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  draw(context) {
    const t = this.t;
    sky(context, '#8fc7ea', '#e8f4fb');

    /* low sun */
    const sun = context.createRadialGradient(760, 130, 10, 760, 130, 110);
    sun.addColorStop(0, 'rgba(255, 244, 205, 0.9)');
    sun.addColorStop(1, 'rgba(255, 244, 205, 0)');
    context.fillStyle = sun;
    context.fillRect(620, 0, 300, 280);

    /* far hills */
    context.fillStyle = '#dcecf6';
    context.beginPath();
    context.moveTo(0, 360);
    context.quadraticCurveTo(180, 290, 360, 345);
    context.quadraticCurveTo(560, 400, 780, 320);
    context.quadraticCurveTo(900, 285, 960, 340);
    context.lineTo(960, 540);
    context.lineTo(0, 540);
    context.closePath();
    context.fill();

    drawPine(context, 80, 430, 170);
    drawPine(context, 140, 445, 120);
    drawPine(context, 880, 430, 190);
    drawPine(context, 820, 450, 125);

    snowGround(context, 452);
    drawHouse(context, 260, 465, 0.82, { t });

    /* a snowy car in the driveway */
    context.save();
    context.translate(760, 500);
    context.fillStyle = 'rgba(36, 26, 46, 0.16)';
    context.beginPath();
    context.ellipse(0, 4, 80, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    drawDadCar(context, 760, 492, 0.9, { t, biscuits: true });

    /* the family, knee-deep in snow */
    drawPerson(context, 380, 500, 0.95, { ...PEOPLE.grandma, face: 'happy' });
    drawPerson(context, 470, 505, 1.0, { ...PEOPLE.mom, face: 'happy' });
    drawPerson(context, 565, 505, 1.03, { ...PEOPLE.dad, face: 'grin' });
    drawPerson(context, 635, 508, 0.78, { ...PEOPLE.jira, face: 'happy' });
    drawPerson(context, 700, 512, 0.74, { ...PEOPLE.joel, face: 'grin' });

    /* a very important sign */
    context.save();
    context.translate(120, 520);
    context.rotate(-0.06);
    context.fillStyle = '#7a4b2a';
    context.fillRect(-2, -58, 5, 58);
    context.fillStyle = '#f8e7c2';
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.beginPath();
    roundRectPath(context, -46, -88, 96, 38, 5);
    context.fill();
    context.stroke();
    label(context, '4 INCHES', 2, -74, 14, { color: INK, align: 'center', strokeWidth: 0 });
    label(context, 'OF SNOW', 2, -59, 12, { color: '#8a3f2c', align: 'center', strokeWidth: 0 });
    context.restore();

    drawSnow(context, 0.95);
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 1 — The Biscuit Run                                         */
/* ------------------------------------------------------------------ */

const ROAD_HORIZON = 250;
const ROAD_BOTTOM = 565;
const CAR_Y = 500;

function roadHalfWidth(y) {
  const t = clamp((y - ROAD_HORIZON) / (ROAD_BOTTOM - ROAD_HORIZON), 0, 1);
  return 54 + t * 408;
}

function roadY(t) {
  return ROAD_HORIZON + Math.pow(clamp(t, 0, 1), 1.55) * (ROAD_BOTTOM - ROAD_HORIZON);
}

export class BiscuitRun {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.time = 0;
    this.progress = 0;
    this.leg = 'out';
    this.phase = 'drive';
    this.stopTimer = 0;
    this.wonTimer = 0;
    this.playerX = 0;
    this.prevX = 0;
    this.nerves = 3;
    this.hits = 0;
    this.obstacles = [];
    this.spawnTimer = 1.5;
    this.speedPenalty = 0;
    this.iceTimer = 0;
    this.shake = 0;
    this.banner = '';
    this.bannerTimer = 0;
    this.sayLine = { text: 'Four inches overnight. Easy does it.', timer: 4.2 };
    this.hintTimer = 9;
    this.hasBiscuits = false;
    this.finishedNote = '';
  }

  say(text, timer = 2.8) {
    this.sayLine = { text, timer };
  }

  spawnObstacle() {
    const roll = Math.random();
    let type = 'snow';
    if (roll > 0.78) type = 'car';
    else if (roll > 0.42) type = 'ice';
    this.obstacles.push({
      type,
      x: rand(-0.82, 0.82),
      t: 0,
      hit: false,
      wobble: rand(0, Math.PI * 2),
    });
  }

  bump(obstacle) {
    obstacle.hit = true;
    this.shake = Math.max(this.shake, 0.3);
    if (obstacle.type === 'snow') {
      this.speedPenalty = 0.85;
      this.say('Snowbank! Everyone okay?', 2.2);
      sfx.slide();
      burst(CX + this.playerX * 260, 470, {
        count: 18,
        colors: ['#ffffff', '#dceefb'],
        speed: 220,
        size: 8,
        gravity: 380,
      });
    } else if (obstacle.type === 'ice') {
      this.iceTimer = 1.6;
      this.say("Black ice! Don't steer!", 2.2);
      sfx.whoosh();
      burst(CX + this.playerX * 260, 490, {
        count: 12,
        colors: ['#c8ecff', '#ffffff'],
        speed: 140,
        size: 5,
        gravity: 300,
      });
    } else {
      this.nerves -= 1;
      this.hits += 1;
      this.speedPenalty = 1.2;
      this.say('Whoa! Sorry, buddy.', 2.5);
      sfx.honk();
      burst(CX + this.playerX * 260, 460, {
        count: 16,
        colors: ['#ffd166', '#ff6b6b', '#ffffff'],
        speed: 260,
        size: 7,
        gravity: 500,
      });
      if (this.nerves <= 0) {
        this.nerves = 3;
        this.say("Deep breath. We're okay. Probably.", 3);
      }
    }
  }

  update(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.speedPenalty = Math.max(0, this.speedPenalty - dt);
    this.iceTimer = Math.max(0, this.iceTimer - dt);
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    if (this.sayLine.timer > 0) this.sayLine.timer -= dt;

    if (this.phase === 'won') {
      this.wonTimer -= dt;
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        const clean = this.hits === 0;
        const score =
          300 +
          this.nerves * 80 +
          Math.max(0, Math.round((48 - this.time) * 8)) +
          (clean ? 150 : 0);
        this.onDone({
          score,
          note: clean
            ? 'Not one bump. Dad is insufferably proud.'
            : `${this.hits} bump${this.hits === 1 ? '' : 's'} and one new car noise.`,
          stats: [
            ['Nerve', `${this.nerves}/3`],
            ['Bumps', this.hits],
          ],
        });
      }
      return;
    }

    if (this.phase === 'stop') {
      this.stopTimer -= dt;
      if (this.stopTimer <= 0) {
        this.phase = 'drive';
        this.leg = 'back';
        this.progress = 0;
        this.hasBiscuits = true;
        this.banner = 'HOME BEFORE THE ROADS FREEZE';
        this.bannerTimer = 2.6;
        this.say('Biscuits secured. Back we go.', 3);
        this.obstacles = [];
        this.spawnTimer = 1.4;
      }
      return;
    }

    this.time += dt;

    /* steering */
    let dir = 0;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) dir -= 1;
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) dir += 1;

    const lane = roadHalfWidth(CAR_Y) * 0.84;
    let target = this.playerX;
    if (input.down) {
      target = clamp((input.x - CX) / lane, -1, 1);
    } else if (dir !== 0) {
      target = clamp(this.playerX + dir * 0.95, -1, 1);
    }
    if (this.iceTimer > 0) {
      target += Math.sin(this.t * 8) * 0.08;
    }
    this.prevX = this.playerX;
    const responsiveness = this.iceTimer > 0 ? 1.5 : 5.2;
    this.playerX = clamp(
      lerp(this.playerX, target, 1 - Math.exp(-responsiveness * dt)),
      -1,
      1
    );

    /* obstacles */
    if (this.phase === 'drive') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        this.spawnTimer = rand(0.95, 1.55);
      }
    }
    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i];
      obstacle.t += dt * 0.66;
      if (
        !obstacle.hit &&
        obstacle.t > 0.7 &&
        obstacle.t < 0.92 &&
        Math.abs(obstacle.x - this.playerX) < 0.23
      ) {
        this.bump(obstacle);
      }
      if (obstacle.t > 1.12) this.obstacles.splice(i, 1);
    }

    /* driving to the market and back */
    const speed = this.speedPenalty > 0 ? 0.36 : 1;
    this.progress = Math.min(1, this.progress + dt * 0.085 * speed);

    if (this.leg === 'out' && this.progress >= 1) {
      this.phase = 'stop';
      this.stopTimer = 2.6;
      this.progress = 1;
      this.leg = 'out';
      this.banner = 'BISCUITS SECURED!';
      this.bannerTimer = 2.6;
      this.say('The good ones. Extra butter.', 2.6);
      sfx.ding();
    } else if (this.leg === 'back' && this.progress >= 1) {
      this.phase = 'won';
      this.wonTimer = 1.8;
      this.banner = 'HOME!';
      this.bannerTimer = 1.8;
      sfx.success();
      burst(CX, 420, {
        count: 40,
        colors: ['#ffd166', '#ff6b6b', '#3ddc84', '#ffffff'],
        speed: 340,
        size: 7,
        gravity: 500,
      });
    }
  }

  drawScene(context) {
    sky(context, '#a7d5f1', '#eef9ff');

    const sun = context.createRadialGradient(790, 95, 8, 790, 95, 90);
    sun.addColorStop(0, 'rgba(255,250,220,0.95)');
    sun.addColorStop(1, 'rgba(255,250,220,0)');
    context.fillStyle = sun;
    context.fillRect(660, 0, 260, 240);

    /* far hills */
    context.fillStyle = '#d6ebf7';
    context.beginPath();
    context.moveTo(0, 300);
    context.quadraticCurveTo(140, 240, 300, 296);
    context.quadraticCurveTo(470, 350, 650, 276);
    context.quadraticCurveTo(800, 216, 960, 292);
    context.lineTo(960, 540);
    context.lineTo(0, 540);
    context.closePath();
    context.fill();

    /* distant pines on both shoulders */
    const sway = Math.sin(this.t * 0.8) * 2;
    drawPine(context, 60 + sway, 350, 170);
    drawPine(context, 130 - sway, 370, 120);
    drawPine(context, 870 + sway, 345, 190);
    drawPine(context, 790 - sway, 365, 120);
    drawPine(context, 935 + sway, 390, 100);

    /* snow banks */
    snowGround(context, 372);

    /* road */
    context.fillStyle = '#3f4858';
    context.beginPath();
    context.moveTo(CX - roadHalfWidth(ROAD_HORIZON), ROAD_HORIZON);
    context.lineTo(CX + roadHalfWidth(ROAD_HORIZON), ROAD_HORIZON);
    context.lineTo(CX + roadHalfWidth(ROAD_BOTTOM), ROAD_BOTTOM);
    context.lineTo(CX - roadHalfWidth(ROAD_BOTTOM), ROAD_BOTTOM);
    context.closePath();
    context.fill();

    const roadShade = context.createLinearGradient(0, ROAD_HORIZON, 0, ROAD_BOTTOM);
    roadShade.addColorStop(0, 'rgba(255,255,255,0.13)');
    roadShade.addColorStop(0.4, 'rgba(0,0,0,0)');
    roadShade.addColorStop(1, 'rgba(0,0,0,0.18)');
    context.fillStyle = roadShade;
    context.fill();

    /* shoulders */
    context.strokeStyle = '#e8f4fb';
    context.lineWidth = 7;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(CX + side * roadHalfWidth(ROAD_HORIZON), ROAD_HORIZON);
      context.lineTo(CX + side * roadHalfWidth(ROAD_BOTTOM), ROAD_BOTTOM);
      context.stroke();
    }

    /* lane dashes drifting toward the car */
    context.save();
    const dashOffset = (this.t * (this.speedPenalty > 0 ? 0.18 : 0.5)) % 1;
    for (let i = 0; i < 11; i += 1) {
      const t0 = (i / 11 + dashOffset) % 1;
      const t1 = Math.min(1, t0 + 0.045);
      const y0 = roadY(t0);
      const y1 = roadY(t1);
      const w0 = 3 + t0 * 10;
      const w1 = 3 + t1 * 10;
      context.fillStyle = 'rgba(255,255,255,0.62)';
      context.beginPath();
      context.moveTo(CX - w0, y0);
      context.lineTo(CX + w0, y0);
      context.lineTo(CX + w1, y1);
      context.lineTo(CX - w1, y1);
      context.closePath();
      context.fill();
    }
    context.restore();

    /* tyre tracks */
    context.strokeStyle = 'rgba(18, 24, 38, 0.16)';
    context.lineWidth = 12;
    for (const side of [-0.26, 0.26]) {
      context.beginPath();
      context.moveTo(CX + side * roadHalfWidth(ROAD_HORIZON) * 0.6, ROAD_HORIZON);
      context.lineTo(CX + side * roadHalfWidth(ROAD_BOTTOM), ROAD_BOTTOM);
      context.stroke();
    }

    /* the market appears ahead */
    if (this.leg === 'out' && this.progress > 0.82) {
      const fade = clamp((this.progress - 0.82) / 0.12, 0, 1);
      context.save();
      context.globalAlpha = fade;
      context.fillStyle = '#f4e2bd';
      context.strokeStyle = INK;
      context.lineWidth = 3;
      context.beginPath();
      roundRectPath(context, 666, 244, 150, 58, 6);
      context.fill();
      context.stroke();
      context.fillStyle = '#c0392b';
      context.fillRect(672, 250, 138, 17);
      label(context, "MERLE'S MARKET", 741, 259, 11, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 0,
      });
      label(context, 'BISCUITS · 24 HR', 741, 282, 12, {
        color: '#5b3a24',
        align: 'center',
        strokeWidth: 0,
      });
      context.restore();
    }

    /* Grandma's house on the way back */
    if (this.leg === 'back' && this.progress > 0.75) {
      const fade = clamp((this.progress - 0.75) / 0.2, 0, 1);
      context.save();
      context.globalAlpha = fade * 0.95;
      drawHouse(context, CX, 330, 0.4, { t: this.t });
      context.restore();
    }

    /* obstacles and car in depth order */
    const drawObstacle = (obstacle) => {
      const y = roadY(obstacle.t);
      const scale = 0.25 + obstacle.t * 0.95;
      const x = CX + obstacle.x * roadHalfWidth(y) * 0.84;
      if (obstacle.type === 'snow') {
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#b9d5e8';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-44, 0);
        context.quadraticCurveTo(-34, -34, -6, -38);
        context.quadraticCurveTo(18, -42, 30, -20);
        context.quadraticCurveTo(44, -2, 44, 0);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = 'rgba(160, 200, 225, 0.35)';
        context.beginPath();
        context.ellipse(10, -6, 22, 8, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      } else if (obstacle.type === 'ice') {
        context.save();
        context.translate(x, y);
        context.scale(scale, scale * 0.7);
        context.fillStyle = 'rgba(168, 231, 255, 0.85)';
        context.beginPath();
        context.ellipse(0, 0, 48, 22, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255,255,255,0.9)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-26, 0);
        context.lineTo(-8, -7);
        context.lineTo(8, 5);
        context.lineTo(26, -2);
        context.stroke();
        context.restore();
      } else {
        drawDadCar(context, x, y, scale * 0.62, {
          body: '#55708f',
          bodyDark: '#3d556c',
          t: this.t,
          brake: true,
        });
      }
    };

    const sorted = [...this.obstacles].sort((a, b) => a.t - b.t);
    for (const obstacle of sorted) {
      if (roadY(obstacle.t) < CAR_Y - 30) drawObstacle(obstacle);
    }

    const tilt = clamp((this.playerX - this.prevX) * 3.2, -0.13, 0.13);
    if (this.shake > 0) {
      context.save();
      context.translate(rand(-6, 6) * this.shake * 2, rand(-4, 4) * this.shake * 2);
      drawDadCar(context, CX + this.playerX * roadHalfWidth(CAR_Y) * 0.84, CAR_Y, 0.94, {
        tilt,
        biscuits: this.hasBiscuits,
        body: '#c0392b',
        bodyDark: '#922b21',
        t: this.t,
        brake: this.speedPenalty > 0,
      });
      context.restore();
    } else {
      drawDadCar(context, CX + this.playerX * roadHalfWidth(CAR_Y) * 0.84, CAR_Y, 0.94, {
        tilt,
        biscuits: this.hasBiscuits,
        body: '#c0392b',
        bodyDark: '#922b21',
        t: this.t,
        brake: this.speedPenalty > 0,
      });
    }

    for (const obstacle of sorted) {
      if (roadY(obstacle.t) >= CAR_Y - 30) drawObstacle(obstacle);
    }

    drawSnow(context, 1, Math.sin(this.t * 0.7) * 18);
  }

  drawHud(context) {
    topPanel(context, 24, 16, 912, 66);

    label(context, "DAD'S NERVE", 46, 34, 11, { color: '#ffd166' });
    for (let i = 0; i < 3; i += 1) {
      context.save();
      context.globalAlpha = i < this.nerves ? 1 : 0.24;
      context.fillStyle = i < this.nerves ? '#ff6b6b' : '#8892a6';
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(52 + i * 26, 56, 9, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
    }

    /* trip progress */
    const trackX = 316;
    const trackW = 336;
    const y = 54;
    const onWayBack = this.leg === 'back';
    const trip = onWayBack ? 1 - this.progress * 0.5 : this.progress * 0.5;
    label(context, "GRANDMA'S", trackX, 30, 10, { color: '#bcd7e8', strokeWidth: 0 });
    label(context, 'MARKET', trackX + trackW, 30, 10, {
      color: '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });
    progressBar(context, trackX, y - 6, trackW, 12, trip, '#ffd166');
    context.fillStyle = '#ff8a00';
    context.strokeStyle = INK;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(trackX + trip * trackW, y, 9, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    label(context, onWayBack ? 'RETURN TRIP' : 'TO THE BISCUITS', CX, 30, 12, {
      color: '#fff8e7',
      align: 'center',
      strokeWidth: 0,
    });

    label(context, this.hasBiscuits ? 'BISCUITS' : 'BISCUIT RUN', 916, 44, 12, {
      color: '#ffd166',
      align: 'right',
      strokeWidth: 0,
    });
    label(
      context,
      this.speedPenalty > 0 ? 'SLOW' : this.iceTimer > 0 ? 'SLIDING' : `${Math.round(this.progress * 100)}%`,
      916,
      66,
      12,
      { color: '#bcd7e8', align: 'right', strokeWidth: 0 }
    );

    if (this.sayLine.timer > 0) {
      bubble(context, CX, 196, this.sayLine.text, {
        size: 17,
        maxWidth: 320,
        alpha: clamp(this.sayLine.timer * 2, 0, 1),
      });
    }

    if (this.bannerTimer > 0) {
      label(context, this.banner, CX, 250, 30, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 7,
        alpha: clamp(this.bannerTimer * 2, 0, 1),
      });
    }

    if (this.hintTimer > 0) {
      context.save();
      context.globalAlpha = clamp(this.hintTimer / 2, 0, 1) * 0.9;
      context.fillStyle = 'rgba(16,22,42,0.6)';
      context.beginPath();
      roundRectPath(context, 330, 494, 300, 32, 16);
      context.fill();
      label(context, 'HOLD OR USE ← → TO STEER', CX, 510, 12, {
        color: '#eaf6ff',
        align: 'center',
        strokeWidth: 0,
      });
      context.restore();
    }
  }

  draw(context) {
    this.drawScene(context);
    this.drawHud(context);
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 2 — The Turkey Situation                                    */
/* ------------------------------------------------------------------ */

function drawTurkey(context, x, y, s, doneness, t) {
  const color =
    doneness > 0.82 ? '#8a4418' : doneness > 0.45 ? '#b96b2e' : '#e7b8a6';
  const colorLight =
    doneness > 0.82 ? '#a55b24' : doneness > 0.45 ? '#d98a44' : '#f4d2c3';
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.strokeStyle = '#4a2a1c';
  context.lineWidth = 3;
  context.lineJoin = 'round';

  /* drumsticks */
  context.strokeStyle = '#e9c7a8';
  context.lineWidth = 10;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-14, -4);
  context.lineTo(-34, -16);
  context.moveTo(14, -4);
  context.lineTo(34, -16);
  context.stroke();
  context.fillStyle = color;
  context.strokeStyle = '#4a2a1c';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(-36, -18, 8, 0, Math.PI * 2);
  context.arc(36, -18, 8, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  /* body */
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(0, -20, 30, 24, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = colorLight;
  context.beginPath();
  context.ellipse(-7, -27, 10, 8, -0.4, 0, Math.PI * 2);
  context.fill();

  /* little wings */
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(-27, -16, 8, 14, -0.5, 0, Math.PI * 2);
  context.ellipse(27, -16, 8, 14, 0.5, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  /* steam */
  context.save();
  context.globalAlpha = 0.5;
  context.strokeStyle = '#fffaf0';
  context.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    const drift = Math.sin(t * 2 + i) * 6;
    context.beginPath();
    context.moveTo(-12 + i * 12, -48);
    context.quadraticCurveTo(-18 + i * 12 + drift, -62, -10 + i * 12, -76);
    context.stroke();
  }
  context.restore();
  context.restore();
}

export class TurkeyCook {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.elapsed = 0;
    this.temp = 62;
    this.grace = 2;
    this.cook = 0;
    this.perfect = 0;
    this.burns = 0;
    this.burnTimer = 0;
    this.gustTimer = 5.4;
    this.gust = 0;
    this.won = false;
    this.wonTimer = 0;
    this.forced = false;
    this.pop = 0;
    this.line = { text: 'Tap to stoke! Keep the needle in the green.', timer: 4.5 };
    this.lineCooldown = 0;
    this.hintTimer = 8;
  }

  say(text, timer = 2.8) {
    if (this.lineCooldown > 0) return;
    this.line = { text, timer };
    this.lineCooldown = 1.8;
  }

  update(dt) {
    if (this.won) {
      this.t += dt;
      this.wonTimer -= dt;
      this.pop = Math.min(1, this.pop + dt * 4);
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        const score = this.forced
          ? Math.max(220, 200 + Math.round(this.cook * 2) - this.burns * 25)
          : Math.max(
              260,
              500 + Math.round(this.perfect * 15) - this.burns * 40 + (this.burns === 0 ? 100 : 0)
            );
        this.onDone({
          score,
          title: this.forced ? 'The turkey is... cooked?' : undefined,
          text: this.forced
            ? "The camp stove gave out, but Aunt Pat's turkey is technically done. She is calling it 'rustic' and serving extra gravy."
            : undefined,
          note: this.forced
            ? 'Nobody is going to ask how long it was in there.'
            : `${Math.round(this.perfect)} seconds in the perfect zone. ${this.burns === 0 ? 'Nothing burned!' : `${this.burns} little burnt bits.`}`,
          stats: [
            ['Perfect', `${Math.round(this.perfect)}s`],
            ['Burnt', this.burns],
          ],
        });
      }
      return;
    }

    this.t += dt;
    this.elapsed += dt;
    this.grace = Math.max(0, this.grace - dt);
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.lineCooldown = Math.max(0, this.lineCooldown - dt);
    if (this.line.timer > 0) this.line.timer -= dt;
    this.pop = Math.max(0, this.pop - dt * 3);

    if (input.actionPressed()) {
      this.temp += 15;
      this.pop = 1;
      sfx.whoosh();
      burst(744 + rand(-40, 40), 404, {
        count: 6,
        colors: ['#ffd166', '#ff8a00', '#ff6b6b'],
        speed: 120,
        size: 5,
        gravity: -60,
        life: 0.5,
      });
    }

    if (this.gust > 0) {
      this.gust -= dt;
    } else {
      this.gustTimer -= dt;
      if (this.gustTimer <= 0) {
        this.gust = 2.2;
        this.gustTimer = rand(6.5, 9);
        this.say('The wind is eating my fire!', 2.4);
        sfx.gust();
      }
    }

    if (this.grace <= 0) {
      this.temp -= (this.gust > 0 ? 25 : 7.5) * dt;
    }
    this.temp = clamp(this.temp, 0, 118);

    const inZone = this.temp >= 52 && this.temp <= 78;
    if (inZone) {
      this.cook = Math.min(100, this.cook + 9.2 * dt);
      this.perfect += dt;
    }

    if (this.temp > 88) {
      this.burnTimer += dt;
      if (this.burnTimer > 0.7) {
        this.burnTimer = 0;
        this.burns += 1;
        sfx.tap();
        burst(744, 380, {
          count: 10,
          colors: ['#6b7280', '#9ca3af'],
          speed: 60,
          size: 7,
          gravity: -80,
          life: 1.1,
        });
        this.say("It's burning! Stop poking it!", 2);
      }
    } else {
      this.burnTimer = Math.max(0, this.burnTimer - dt * 0.7);
    }

    if (this.temp < 32) this.say('That turkey is still cold!', 2.2);
    else if (inZone) this.say('PERFECT. Nobody breathe.', 1.4);
    else if (this.temp > 84) this.say('Too hot! Too hot!', 1.6);

    if (this.cook >= 100) {
      this.won = true;
      this.wonTimer = 2.6;
      this.pop = 0;
      sfx.success();
      burst(CX, 300, {
        count: 46,
        colors: ['#ffd166', '#ff8a00', '#fff8e7', '#3ddc84'],
        speed: 320,
        size: 8,
        gravity: 400,
      });
    } else if (this.elapsed > 55) {
      this.won = true;
      this.forced = true;
      this.wonTimer = 2.2;
      this.cook = Math.max(this.cook, 100);
      sfx.success();
    }
  }

  draw(context) {
    /* dark kitchen */
    const wall = context.createLinearGradient(0, 0, 0, VIEW_H);
    wall.addColorStop(0, '#2a1d2a');
    wall.addColorStop(0.6, '#3a2730');
    wall.addColorStop(1, '#241a20');
    context.fillStyle = wall;
    context.fillRect(0, 0, VIEW_W, VIEW_H);

    /* floor */
    context.fillStyle = '#35242a';
    context.fillRect(0, 452, VIEW_W, VIEW_H - 452);
    context.strokeStyle = 'rgba(0,0,0,0.25)';
    context.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      context.beginPath();
      context.moveTo(i * 140 - 100, 452);
      context.lineTo(i * 140 - 40, VIEW_H);
      context.stroke();
    }

    /* window with snow outside */
    context.fillStyle = '#122339';
    context.strokeStyle = '#6b4a34';
    context.lineWidth = 9;
    context.beginPath();
    roundRectPath(context, 70, 146, 206, 176, 6);
    context.fill();
    context.stroke();
    context.save();
    context.beginPath();
    roundRectPath(context, 78, 154, 190, 160, 2);
    context.clip();
    const night = context.createLinearGradient(0, 154, 0, 314);
    night.addColorStop(0, '#2c4a6b');
    night.addColorStop(1, '#7699bb');
    context.fillStyle = night;
    context.fillRect(78, 154, 190, 160);
    context.fillStyle = '#f4fbff';
    context.beginPath();
    context.moveTo(78, 284);
    context.quadraticCurveTo(160, 258, 268, 290);
    context.lineTo(268, 314);
    context.lineTo(78, 314);
    context.closePath();
    context.fill();
    drawPine(context, 220, 300, 120, { dark: '#24404d', light: '#31566a' });
    if (this.gust > 0) {
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.lineWidth = 2;
      for (let i = 0; i < 14; i += 1) {
        const gx = 78 + ((i * 91 + this.t * 300) % 190);
        const gy = 154 + ((i * 47 + this.t * 90) % 150);
        context.beginPath();
        context.moveTo(gx, gy);
        context.lineTo(gx - 14, gy + 8);
        context.stroke();
      }
    }
    context.restore();
    context.strokeStyle = '#6b4a34';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(173, 154);
    context.lineTo(173, 314);
    context.moveTo(78, 234);
    context.lineTo(268, 234);
    context.stroke();

    /* framed turkey portrait */
    context.fillStyle = '#5a3a28';
    context.strokeStyle = '#8a5a3a';
    context.lineWidth = 6;
    context.beginPath();
    roundRectPath(context, 330, 118, 120, 94, 3);
    context.fill();
    context.stroke();
    context.fillStyle = '#f4e2bd';
    context.fillRect(338, 126, 104, 78);
    drawTurkey(context, 390, 194, 0.55, 0.55, this.t);

    /* counter on the left */
    context.fillStyle = '#5e3c2c';
    context.strokeStyle = '#2a1a18';
    context.lineWidth = 4;
    context.beginPath();
    roundRectPath(context, 34, 388, 300, 26, 5);
    context.fill();
    context.stroke();
    context.fillStyle = '#4a2f24';
    context.fillRect(52, 414, 264, 62);
    context.fillStyle = '#f2d7a0';
    context.beginPath();
    context.ellipse(112, 384, 42, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#b97a3d';
    context.lineWidth = 3;
    context.stroke();

    /* candles */
    for (const candle of [{ x: 228, h: 34 }, { x: 264, h: 24 }]) {
      context.fillStyle = '#f4e2bd';
      context.beginPath();
      roundRectPath(context, candle.x, 384 - candle.h, 12, candle.h, 2);
      context.fill();
      flame(context, candle.x + 6, 382 - candle.h, 15, this.t + candle.x);
      const glow = context.createRadialGradient(
        candle.x + 6,
        380 - candle.h,
        2,
        candle.x + 6,
        380 - candle.h,
        80
      );
      glow.addColorStop(0, 'rgba(255, 196, 92, 0.25)');
      glow.addColorStop(1, 'rgba(255, 196, 92, 0)');
      context.fillStyle = glow;
      context.fillRect(candle.x - 80, 300 - candle.h, 170, 170);
    }

    /* stove */
    const stoveX = 758;
    context.fillStyle = '#343946';
    context.strokeStyle = '#1c1f28';
    context.lineWidth = 4;
    context.beginPath();
    roundRectPath(context, stoveX - 120, 276, 240, 212, 12);
    context.fill();
    context.stroke();
    context.fillStyle = '#454c5c';
    context.beginPath();
    roundRectPath(context, stoveX - 124, 262, 248, 26, 8);
    context.fill();
    context.stroke();
    context.fillStyle = '#232833';
    context.beginPath();
    roundRectPath(context, stoveX - 96, 260, 66, 6, 3);
    context.fill();
    /* chimney */
    context.fillStyle = '#2c313c';
    context.fillRect(stoveX + 42, 96, 48, 172);
    context.strokeStyle = '#1c1f28';
    context.strokeRect(stoveX + 42, 96, 48, 172);

    /* oven window */
    context.fillStyle = '#151923';
    context.beginPath();
    roundRectPath(context, stoveX - 92, 330, 184, 116, 12);
    context.fill();
    context.strokeStyle = '#5a6273';
    context.lineWidth = 6;
    context.stroke();

    context.save();
    context.beginPath();
    roundRectPath(context, stoveX - 84, 338, 168, 100, 8);
    context.clip();
    context.fillStyle = '#2a140c';
    context.fillRect(stoveX - 84, 338, 168, 100);
    const fireGlow = context.createRadialGradient(
      stoveX,
      410,
      4,
      stoveX,
      410,
      130
    );
    fireGlow.addColorStop(0, 'rgba(255,160,60,0.5)');
    fireGlow.addColorStop(1, 'rgba(255,160,60,0)');
    context.fillStyle = fireGlow;
    context.fillRect(stoveX - 84, 338, 168, 100);

    /* turkey on a tray inside */
    context.fillStyle = '#4a4a55';
    context.beginPath();
    context.ellipse(stoveX, 418, 48, 10, 0, 0, Math.PI * 2);
    context.fill();
    drawTurkey(context, stoveX, 420, 0.95, this.cook / 100, this.t);

    /* fire under the turkey */
    const fireSize = clamp(this.temp / 118, 0.12, 1) * 26;
    for (let i = 0; i < 3; i += 1) {
      flame(context, stoveX - 44 + i * 44, 436, fireSize * (0.8 + i * 0.12), this.t + i);
    }
    context.restore();

    /* glow around the stove */
    const stoveGlow = context.createRadialGradient(stoveX, 380, 20, stoveX, 380, 290);
    stoveGlow.addColorStop(0, 'rgba(255, 150, 60, 0.2)');
    stoveGlow.addColorStop(1, 'rgba(255, 150, 60, 0)');
    context.fillStyle = stoveGlow;
    context.fillRect(stoveX - 300, 90, 600, 450);

    /* characters */
    drawPerson(context, 420, 474, 1.0, {
      ...PEOPLE.auntpat,
      face: this.temp > 80 ? 'shock' : this.temp < 40 ? 'worried' : 'happy',
      armPose: 'up',
    });
    drawPerson(context, 548, 474, 0.98, { ...PEOPLE.mom, face: 'worried' });
    drawPerson(context, 226, 500, 0.72, { ...PEOPLE.jira, face: 'worried' });
    drawPerson(context, 292, 504, 0.68, { ...PEOPLE.joel, face: 'shock' });

    /* Aunt Pat's line */
    if (this.line.timer > 0) {
      bubble(context, 420, 374, this.line.text, {
        size: 16,
        maxWidth: 250,
        alpha: clamp(this.line.timer * 1.6, 0, 1),
      });
    }

    /* snow gust warning */
    if (this.gust > 0) {
      label(context, 'SNOW GUST!', CX, 138, 22, {
        color: '#bfeaff',
        align: 'center',
        strokeWidth: 6,
        alpha: clamp(this.gust, 0, 1),
      });
    }

    /* HUD */
    topPanel(context, 24, 16, 912, 96);

    label(context, 'TURKEY', 46, 44, 11, { color: '#ffd166' });
    progressBar(context, 122, 37, 260, 16, this.cook / 100, '#e8a45c');
    label(context, `${Math.round(this.cook)}%`, 396, 45, 11, {
      color: '#ffe3b3',
      strokeWidth: 0,
    });

    const gaugeX = 440;
    const gaugeW = 300;
    const gaugeY = 66;
    label(context, 'OVEN', 46, 76, 11, { color: '#ffd166' });
    context.fillStyle = 'rgba(255,255,255,0.16)';
    context.beginPath();
    roundRectPath(context, gaugeX, gaugeY, gaugeW, 18, 9);
    context.fill();
    context.fillStyle = 'rgba(61,220,132,0.55)';
    context.beginPath();
    roundRectPath(
      context,
      gaugeX + (52 / 118) * gaugeW,
      gaugeY,
      ((78 - 52) / 118) * gaugeW,
      18,
      4
    );
    context.fill();
    context.fillStyle = 'rgba(255,90,90,0.45)';
    context.beginPath();
    roundRectPath(context, gaugeX + (88 / 118) * gaugeW, gaugeY, (30 / 118) * gaugeW, 18, 4);
    context.fill();
    const gaugeMarker = gaugeX + clamp(this.temp / 118, 0, 1) * gaugeW;
    context.fillStyle = '#fff8e7';
    context.strokeStyle = INK;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(gaugeMarker, gaugeY + 9, 10, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    label(context, `${Math.round(this.temp)}°`, 908, 76, 16, {
      color: this.temp > 88 ? '#ff8a8a' : this.temp >= 52 ? '#a7f3c8' : '#cfe6f5',
      align: 'right',
      strokeWidth: 3,
    });
    label(
      context,
      this.temp > 88 ? 'BURNING' : this.temp >= 52 && this.temp <= 78 ? 'PERFECT' : 'TOO COLD',
      758,
      44,
      13,
      {
        color: this.temp > 88 ? '#ff8a8a' : this.temp >= 52 ? '#a7f3c8' : '#cfe6f5',
        align: 'right',
      }
    );

    /* stoke button */
    const pulse = 1 + Math.sin(this.t * 5) * 0.02 + this.pop * 0.1;
    context.save();
    context.translate(232, 508);
    context.scale(pulse, pulse);
    context.fillStyle = '#ffcf5c';
    context.strokeStyle = INK;
    context.lineWidth = 4;
    context.beginPath();
    roundRectPath(context, -150, -22, 300, 44, 22);
    context.fill();
    context.stroke();
    label(context, 'STOKE THE FIRE', 0, 1, 17, {
      color: INK,
      align: 'center',
      strokeWidth: 0,
    });
    context.restore();

    label(context, `PERFECT ${Math.round(this.perfect)}s`, 916, 44, 11, {
      color: '#a7f3c8',
      align: 'right',
      strokeWidth: 0,
    });
    label(context, `BURNT ${this.burns}`, 916, 62, 11, {
      color: this.burns ? '#ff9b9b' : '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });

    drawSnow(context, 0.25);

    if (this.won) {
      context.fillStyle = 'rgba(12, 8, 16, 0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      const pop = easeOut(this.pop);
      context.save();
      context.translate(CX, 292);
      context.scale(pop, pop);
      context.fillStyle = '#f4e2bd';
      context.strokeStyle = INK;
      context.lineWidth = 4;
      context.beginPath();
      context.ellipse(0, 56, 190, 30, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      drawTurkey(context, 0, 48, 2.6, 0.9, this.t);
      context.restore();
      label(context, 'THE TURKEY IS SAVED!', CX, 152, 34, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 8,
      });
      label(context, "Aunt Pat is crying. It's fine. Happy crying.", CX, 194, 16, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 3,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 3 — The Cousins' Snowball War                               */
/* ------------------------------------------------------------------ */

function drawSnowFort(context, x, y, w, h, t, flag = true) {
  context.save();
  context.fillStyle = '#f7fcff';
  context.strokeStyle = '#b7d4e6';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(x, y + h);
  context.lineTo(x, y + 16);
  context.quadraticCurveTo(x + 8, y, x + 26, y + 2);
  context.lineTo(x + w - 26, y + 2);
  context.quadraticCurveTo(x + w - 8, y, x + w, y + 16);
  context.lineTo(x + w, y + h);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = 'rgba(160, 200, 224, 0.55)';
  context.lineWidth = 2;
  for (let row = 1; row < 4; row += 1) {
    const yy = y + row * (h / 4);
    context.beginPath();
    context.moveTo(x + 4, yy);
    context.lineTo(x + w - 4, yy);
    context.stroke();
  }
  for (let i = 0; i < 5; i += 1) {
    const xx = x + 20 + i * (w - 40) * 0.25;
    const yy = y + ((i % 3) + 1) * (h / 3.4);
    context.beginPath();
    context.moveTo(xx, yy - h / 4);
    context.lineTo(xx, yy);
    context.stroke();
  }

  /* snow lumps on top */
  context.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i += 1) {
    context.beginPath();
    context.arc(x + 26 + i * (w - 52) * 0.33, y + 4, 14, 0, Math.PI * 2);
    context.fill();
  }

  if (flag) {
    context.strokeStyle = '#6b4a34';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x + w - 30, y + 4);
    context.lineTo(x + w - 30, y - 48);
    context.stroke();
    const wave = Math.sin(t * 4) * 4;
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.moveTo(x + w - 28, y - 46);
    context.quadraticCurveTo(x + w + 2 + wave, y - 42, x + w + 14, y - 34);
    context.lineTo(x + w - 28, y - 24);
    context.closePath();
    context.fill();
  }
  context.restore();
}

export class SnowballFight {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.phase = 'fight';
    this.wonTimer = 0;
    this.faces = 5;
    this.maxFaces = 5;
    this.hits = 0;
    this.blocks = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.wipes = 0;
    this.balls = [];
    this.returns = [];
    this.popups = [];
    this.splat = 0;
    this.shake = 0;
    this.faceOut = 0;
    this.startGrace = 1.8;
    this.popTimer = 1.2;
    this.hintTimer = 8;
    this.taunt = { text: 'You two? I have been training on a mailbox.', timer: 4 };
    this.cj = {
      x: 736,
      y: 474,
      hp: 200,
      maxHp: 200,
      flash: 0,
      windup: 0,
      megaTimer: 1.8,
      throwTimer: 0.6,
      hitCooldown: 0,
      phase: 1,
    };
    this.cousins = [
      { x: 178, y: 466, name: 'Maya', coat: '#7c3aed', hat: '#0ea5e9', visible: false, timer: 0, cooldown: 0.8, throwAt: 0, appear: 0 },
      { x: 360, y: 458, name: 'Theo', coat: '#db2777', hat: '#f59e0b', visible: false, timer: 0, cooldown: 2.1, throwAt: 0, appear: 0 },
      { x: 560, y: 466, name: 'Ruby', coat: '#0d9488', hat: '#8b5cf6', visible: false, timer: 0, cooldown: 3.3, throwAt: 0, appear: 0 },
      { x: 850, y: 458, name: 'Sam', coat: '#ca8a04', hat: '#ef4444', visible: false, timer: 0, cooldown: 4.4, throwAt: 0, appear: 0 },
    ];
  }

  say(text, timer = 2.8) {
    this.taunt = { text, timer };
  }

  popup(x, y, text, color = '#ffd166') {
    this.popups.push({ x, y, text, color, t: 0.9 });
  }

  spawnBall(fromX, fromY, big = false) {
    if (this.balls.length > 4 && !big) return;
    const tx = clamp(CX + rand(-70, 70), 400, 560);
    const ty = rand(468, 494);
    this.balls.push({
      sx: fromX,
      sy: fromY,
      x: fromX,
      y: fromY,
      tx,
      ty,
      t: 0,
      dur: big ? 1.5 : rand(1.15, 1.35),
      r: big ? 38 : rand(14, 18),
      big,
      megaHits: big ? 2 : 0,
      arc: rand(90, 140),
    });
    sfx.whoosh();
  }

  hitCousin(cousin) {
    cousin.visible = false;
    cousin.cooldown = rand(2.6, 4.4);
    cousin.timer = 0;
    this.hits += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = 30 + this.combo * 5;
    this.popup(cousin.x, cousin.y - 130, `+${points}`);
    sfx.hit();
    burst(cousin.x, cousin.y - 120, {
      count: 16,
      colors: ['#ffffff', '#dff2ff'],
      speed: 220,
      size: 9,
      gravity: 500,
    });
  }

  hitCj(headshot) {
    if (this.phase !== 'fight' || this.cj.hitCooldown > 0) return;
    const damage = headshot ? 20 : 12;
    this.cj.hp = Math.max(0, this.cj.hp - damage);
    this.cj.flash = 0.25;
    this.cj.hitCooldown = 0.4;
    this.hits += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = (headshot ? 30 : 20) + this.combo * 5;
    this.popup(this.cj.x, 320, `${headshot ? 'BONK! ' : ''}+${points}`, headshot ? '#ffd166' : '#fff8e7');
    sfx.hit();
    burst(this.cj.x, headshot ? 378 : 420, {
      count: 18,
      colors: ['#ffffff', '#ffe3b3', '#dff2ff'],
      speed: 260,
      size: 9,
      gravity: 500,
    });
    if (this.cj.hp > 60 && this.cj.phase === 1) {
      this.cj.phase = 2;
      this.say('Okay. Now I am actually trying.', 2.6);
    } else if (this.cj.hp > 0 && this.cj.hp <= 60 && this.cj.phase === 2) {
      this.cj.phase = 3;
      this.say('NOBODY hits CJ in the face!', 2.6);
    }
    if (this.cj.hp <= 0 && this.phase === 'fight') {
      this.phase = 'won';
      this.wonTimer = 2.6;
      this.balls = [];
      this.say('I am telling Aunt Pat!', 2.4);
      sfx.success();
      burst(this.cj.x, 380, {
        count: 60,
        colors: ['#ffffff', '#ffd166', '#7dd3fc', '#ff8a8a'],
        speed: 380,
        size: 9,
        gravity: 500,
      });
    }
  }

  blockBall(ball, keyboard = false) {
    if (ball.big) {
      ball.megaHits -= 1;
      ball.r = Math.max(18, ball.r - 16);
      sfx.hit();
      burst(ball.x, ball.y, {
        count: 14,
        colors: ['#ffffff', '#c8ecff'],
        speed: 200,
        size: 8,
        gravity: 400,
      });
      if (ball.megaHits > 0) {
        this.popup(ball.x, ball.y - 26, 'AGAIN!', '#ffd166');
        return;
      }
      const points = 60 + this.combo * 6;
      this.blocks += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.popup(ball.x, ball.y - 26, `BLOCKED +${points}`, '#a7f3c8');
      this.balls = this.balls.filter((b) => b !== ball);
      burst(ball.x, ball.y, {
        count: 22,
        colors: ['#ffffff', '#bfeaff', '#ffd166'],
        speed: 280,
        size: 9,
        gravity: 500,
      });
      return;
    }
    const points = 12 + this.combo * 3;
    this.blocks += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.balls = this.balls.filter((b) => b !== ball);
    this.popup(ball.x, ball.y - 22, keyboard ? 'BLOCKED!' : `+${points}`, '#a7f3c8');
    sfx.pop();
    burst(ball.x, ball.y, {
      count: 14,
      colors: ['#ffffff', '#dff2ff'],
      speed: 220,
      size: 8,
      gravity: 500,
    });
  }

  hurtPlayer(big) {
    this.faces -= big ? 2 : 1;
    this.combo = 0;
    this.splat = 0.9;
    this.shake = 0.5;
    sfx.splat();
    if (this.faces <= 0) {
      this.faces = 0;
      this.wipes += 1;
      this.faceOut = 1.8;
      this.balls = [];
      this.say('SHAKE IT OFF!', 2);
    }
  }

  nearestBall() {
    let nearest = null;
    let best = Infinity;
    for (const ball of this.balls) {
      if (ball.t < best) {
        best = ball.t;
        nearest = ball;
      }
    }
    return nearest;
  }

  handleInput() {
    if (this.faceOut > 0) return;
    if (input.wasPressed('Space')) {
      const ball = this.nearestBall();
      if (ball) this.blockBall(ball, true);
      return;
    }
    if (input.wasPressed('KeyF')) {
      this.hitCj(false);
      return;
    }
    if (!input.pressed) return;

    let tappedBall = null;
    let tappedDistance = Infinity;
    for (const ball of this.balls) {
      const d = distance(input.x, input.y, ball.x, ball.y);
      if (d < ball.r + 20 && d < tappedDistance) {
        tappedBall = ball;
        tappedDistance = d;
      }
    }
    if (tappedBall) {
      this.blockBall(tappedBall);
      return;
    }

    const cj = this.cj;
    const headD = distance(input.x, input.y, cj.x, 368);
    if (headD < 38) {
      this.hitCj(true);
      return;
    }
    if (distance(input.x, input.y, cj.x, 430) < 66) {
      this.hitCj(false);
      return;
    }

    for (const cousin of this.cousins) {
      if (!cousin.visible) continue;
      if (distance(input.x, input.y, cousin.x, cousin.y - 56) < 48) {
        this.hitCousin(cousin);
        return;
      }
    }

    /* a hopeful throw into the snow */
    this.returns.push({ x: 480, y: 500, tx: input.x, ty: input.y, t: 0 });
    sfx.whoosh();
  }

  update(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.splat = Math.max(0, this.splat - dt);
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.cj.flash = Math.max(0, this.cj.flash - dt);
    this.cj.hitCooldown = Math.max(0, this.cj.hitCooldown - dt);
    this.startGrace = Math.max(0, this.startGrace - dt);
    if (this.taunt.timer > 0) this.taunt.timer -= dt;
    if (this.faceOut > 0) {
      this.faceOut -= dt;
      if (this.faceOut <= 0) {
        this.faces = this.maxFaces;
        this.say('Okay. Rematch.', 2);
      }
    }

    for (let i = this.returns.length - 1; i >= 0; i -= 1) {
      const shot = this.returns[i];
      shot.t += dt * 4.5;
      if (shot.t >= 1) {
        burst(shot.tx, shot.ty, {
          count: 6,
          colors: ['#ffffff', '#dff2ff'],
          speed: 120,
          size: 6,
          gravity: 300,
          life: 0.45,
        });
        this.returns.splice(i, 1);
      }
    }

    if (this.phase === 'won') {
      this.wonTimer -= dt;
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        const score =
          500 +
          this.hits * 20 +
          this.blocks * 12 +
          (this.wipes === 0 ? 200 : 0) +
          Math.min(150, this.bestCombo * 10);
        this.onDone({
          score,
          note:
            this.wipes === 0
              ? 'Not a single snowball in the face. CJ is taking it badly.'
              : `${this.wipes} face wipeout${this.wipes === 1 ? '' : 's'} and one very cold nose.`,
          stats: [
            ['Hits', this.hits],
            ['Blocks', this.blocks],
            ['Best combo', this.bestCombo],
          ],
        });
      }
      return;
    }

    if (this.faceOut <= 0) this.handleInput();

    for (const shot of this.returns) {
      shot.x = lerp(480, shot.tx, shot.t);
      shot.y = lerp(500, shot.ty, shot.t) - Math.sin(Math.PI * shot.t) * 120;
    }

    /* cousins pop up and down */
    for (const cousin of this.cousins) {
      cousin.cooldown = Math.max(0, cousin.cooldown - dt);
      if (cousin.visible) {
        cousin.timer -= dt;
        cousin.appear = Math.min(1, cousin.appear + dt * 6);
        if (cousin.throwAt > 0) {
          cousin.throwAt -= dt;
          if (cousin.throwAt <= 0) {
            this.spawnBall(cousin.x, cousin.y - 108);
          }
        }
        if (cousin.timer <= 0) {
          cousin.visible = false;
          cousin.cooldown = rand(2.2, 3.8);
          cousin.appear = 0;
        }
      } else {
        cousin.appear = Math.max(0, cousin.appear - dt * 5);
      }
    }

    if (this.faceOut <= 0 && this.startGrace <= 0) {
      this.popTimer -= dt;
      if (this.popTimer <= 0) {
        const maxUp = this.cj.hp > 80 ? 1 : this.cj.hp > 40 ? 2 : 3;
        const up = this.cousins.filter((c) => c.visible).length;
        const ready = this.cousins.filter((c) => !c.visible && c.cooldown <= 0);
        if (up < maxUp && ready.length) {
          const cousin = pick(ready);
          cousin.visible = true;
          cousin.timer = rand(1.4, 1.9);
          cousin.throwAt = rand(0.5, 0.9);
          cousin.appear = 0;
        }
        this.popTimer = rand(0.7, 1.3);
      }
    }

    /* CJ's attacks */
    if (this.faceOut <= 0 && this.startGrace <= 0) {
      if (this.cj.windup > 0) {
        this.cj.windup -= dt;
        if (this.cj.windup <= 0) {
          this.spawnBall(this.cj.x, 382, true);
          this.say('CATCH!', 1.6);
        }
      } else {
        this.cj.throwTimer -= dt;
        if (this.cj.throwTimer <= 0) {
          this.cj.throwTimer = this.cj.hp > 80 ? 2.2 : this.cj.hp > 40 ? 1.9 : 1.6;
          this.spawnBall(this.cj.x, 390);
        }
        this.cj.megaTimer -= dt;
        if (this.cj.megaTimer <= 0) {
          this.cj.megaTimer = this.cj.hp > 60 ? 2.4 : 2;
          this.cj.windup = 1.2;
          this.say('One more for the road!', 1.8);
          sfx.gust();
        }
      }
    }

    /* flying snowballs */
    for (let i = this.balls.length - 1; i >= 0; i -= 1) {
      const ball = this.balls[i];
      ball.t += dt / ball.dur;
      ball.x = lerp(ball.sx, ball.tx, ball.t);
      ball.y = lerp(ball.sy, ball.ty, ball.t) - Math.sin(Math.PI * ball.t) * ball.arc;
      if (ball.t >= 1) {
        this.hurtPlayer(ball.big);
        if (ball.big) {
          burst(ball.tx, ball.ty, {
            count: 26,
            colors: ['#ffffff', '#bfeaff'],
            speed: 300,
            size: 10,
            gravity: 600,
          });
        }
        this.balls.splice(i, 1);
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i];
      popup.t -= dt;
      popup.y -= dt * 40;
      if (popup.t <= 0) this.popups.splice(i, 1);
    }
  }

  drawScene(context) {
    sky(context, '#9ac8e6', '#eaf6ff');
    const sun = context.createRadialGradient(180, 100, 8, 180, 100, 90);
    sun.addColorStop(0, 'rgba(255, 248, 210, 0.9)');
    sun.addColorStop(1, 'rgba(255, 248, 210, 0)');
    context.fillStyle = sun;
    context.fillRect(50, 0, 280, 230);

    /* hills and trees */
    context.fillStyle = '#d9ecf7';
    context.beginPath();
    context.moveTo(0, 340);
    context.quadraticCurveTo(200, 270, 420, 330);
    context.quadraticCurveTo(620, 384, 800, 300);
    context.quadraticCurveTo(900, 260, 960, 320);
    context.lineTo(960, 540);
    context.lineTo(0, 540);
    context.closePath();
    context.fill();
    drawPine(context, 62, 400, 160);
    drawPine(context, 125, 420, 110);
    drawPine(context, 925, 400, 170);

    /* Aunt Pat's house */
    drawHouse(context, 880, 420, 0.46, { t: this.t });

    snowGround(context, 420);

    /* back snow wall and cousins */
    drawSnowFort(context, 80, 434, 820, 106, this.t, false);

    for (const cousin of this.cousins) {
      if (cousin.appear <= 0) continue;
      const rise = (1 - easeOut(cousin.appear)) * 26;
      drawPerson(context, cousin.x, cousin.y + rise, 0.8, {
        ...PEOPLE.cousin,
        coat: cousin.coat,
        coatDark: cousin.coat,
        hat: cousin.hat,
        face: 'grin',
        armPose: cousin.throwAt > 0 ? 'throw' : 'up',
      });
    }

    /* CJ behind his personal fort */
    drawPerson(context, this.cj.x, this.cj.y, 1.25, {
      ...PEOPLE.cj,
      face: this.cj.hp > 0 ? (this.cj.windup > 0 ? 'grin' : 'happy') : 'shock',
      armPose: this.cj.windup > 0 ? 'throw' : 'up',
    });
    drawSnowFort(context, 660, 424, 168, 94, this.t);
    if (this.cj.windup > 0) {
      const pulse = 1 + Math.sin(this.t * 14) * 0.15;
      context.save();
      context.translate(this.cj.x + 26, 354);
      context.scale(pulse, pulse);
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#ef4444';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, 30, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      label(context, '!', 0, 1, 30, { color: '#ef4444', align: 'center', strokeWidth: 0 });
      context.restore();
    }

    /* flying snowballs */
    for (const ball of this.balls) {
      /* target ring */
      if (ball.t > 0.3) {
        context.save();
        context.globalAlpha = 0.5;
        context.strokeStyle = ball.big ? '#ef4444' : '#7dd3fc';
        context.lineWidth = 3;
        context.setLineDash([6, 6]);
        context.beginPath();
        context.arc(ball.tx, ball.ty, 24 + Math.sin(this.t * 8) * 3, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.restore();
      }
      context.fillStyle = 'rgba(40, 70, 100, 0.16)';
      context.beginPath();
      context.ellipse(ball.x + 6, ball.y + 10, ball.r, ball.r * 0.7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ball.big ? '#f6fbff' : '#ffffff';
      context.strokeStyle = ball.big ? '#ef4444' : '#9ac4df';
      context.lineWidth = ball.big ? 4 : 3;
      context.beginPath();
      context.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (ball.big) {
        context.strokeStyle = 'rgba(120, 160, 190, 0.7)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(ball.x - ball.r * 0.4, ball.y - 4);
        context.lineTo(ball.x - 2, ball.y + 5);
        context.lineTo(ball.x + 8, ball.y - 7);
        context.stroke();
      }
      context.fillStyle = 'rgba(190, 225, 244, 0.65)';
      context.beginPath();
      context.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.28, ball.r * 0.3, 0, Math.PI * 2);
      context.fill();
    }

    /* player kids peek over the front fort */
    for (const kid of [
      { x: 420, person: PEOPLE.jira, arm: 'throw' },
      { x: 540, person: PEOPLE.joel, arm: 'up' },
    ]) {
      drawPerson(context, kid.x, 540, 1.0, {
        ...kid.person,
        face: this.splat > 0.3 ? 'shock' : 'grin',
        armPose: kid.arm,
      });
    }
    drawSnowFort(context, 316, 500, 328, 58, this.t);

    /* player throws */
    for (const shot of this.returns) {
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#9ac4df';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(shot.x, shot.y, 11, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    drawSnow(context, 0.9);

    /* splat overlay */
    if (this.splat > 0) {
      context.save();
      context.globalAlpha = clamp(this.splat, 0, 0.9);
      context.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i += 1) {
        const x = i % 2 === 0 ? rand(0, 240) : rand(720, 960);
        const y = rand(120, 520);
        context.beginPath();
        context.arc(x, y, rand(18, 46), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      label(context, 'SPLAT!', CX, 296, 52, {
        color: '#ffffff',
        align: 'center',
        strokeWidth: 9,
        stroke: '#3b6f91',
        alpha: clamp(this.splat * 1.6, 0, 1),
      });
    }

    if (this.taunt.timer > 0) {
      bubble(context, this.cj.x, 334, this.taunt.text, {
        size: 15,
        maxWidth: 230,
        alpha: clamp(this.taunt.timer * 1.6, 0, 1),
      });
    }

    /* HUD */
    topPanel(context, 24, 16, 912, 84);

    label(context, 'CJ · COUSIN BOSS', 46, 38, 12, { color: '#ffd166' });
    const hpRatio = clamp(this.cj.hp / this.cj.maxHp, 0, 1);
    progressBar(
      context,
      46,
      50,
      390,
      18,
      hpRatio,
      this.cj.flash > 0 ? '#ffffff' : '#ef4444',
      'rgba(255,255,255,0.16)'
    );
    label(context, `${this.cj.hp} / ${this.cj.maxHp}`, 244, 59, 11, {
      color: '#fff8e7',
      align: 'center',
      strokeWidth: 0,
    });

    label(context, 'FACES', 46, 84, 10, { color: '#bcd7e8' });
    for (let i = 0; i < this.maxFaces; i += 1) {
      const filled = i < this.faces;
      context.save();
      context.globalAlpha = filled ? 1 : 0.25;
      context.fillStyle = filled ? '#ffffff' : '#8fa3b8';
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(108 + i * 24, 84, 8, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = INK;
      context.beginPath();
      context.arc(105 + i * 24, 82, 1.4, 0, Math.PI * 2);
      context.arc(111 + i * 24, 82, 1.4, 0, Math.PI * 2);
      context.fill();
      if (!filled) {
        context.strokeStyle = '#8fa3b8';
        context.beginPath();
        context.moveTo(102 + i * 24, 78);
        context.lineTo(114 + i * 24, 90);
        context.stroke();
      }
      context.restore();
    }

    label(context, `HITS ${this.hits}`, 640, 38, 12, { color: '#eaf6ff' });
    label(context, `BLOCKS ${this.blocks}`, 640, 58, 12, { color: '#eaf6ff' });
    if (this.combo > 1) {
      label(context, `COMBO x${this.combo}`, 916, 38, 14, {
        color: '#ffd166',
        align: 'right',
      });
    }
    label(context, 'TAP CJ OR A COUSIN', 916, 62, 10, {
      color: '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });

    for (const popup of this.popups) {
      label(context, popup.text, popup.x, popup.y, 18, {
        color: popup.color,
        align: 'center',
        strokeWidth: 5,
        alpha: clamp(popup.t * 1.8, 0, 1),
      });
    }

    if (this.hintTimer > 0) {
      context.save();
      context.globalAlpha = clamp(this.hintTimer / 2, 0, 1) * 0.9;
      context.fillStyle = 'rgba(16,22,42,0.6)';
      context.beginPath();
      roundRectPath(context, 260, 500, 440, 32, 16);
      context.fill();
      label(context, 'TAP SNOWBALLS TO BLOCK · TAP CJ OR A COUSIN TO THROW', CX, 516, 11, {
        color: '#eaf6ff',
        align: 'center',
        strokeWidth: 0,
      });
      context.restore();
    }

    if (this.phase === 'won') {
      label(context, 'CJ IS DEFEATED!', CX, 190, 36, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 8,
      });
      label(context, 'Somebody get this kid a hot chocolate.', CX, 232, 16, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 3,
      });
    }
  }

  draw(context) {
    if (this.shake > 0) {
      context.save();
      context.translate(rand(-7, 7) * this.shake, rand(-5, 5) * this.shake);
    }
    this.drawScene(context);
    if (this.shake > 0) context.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 5 — Penguin Slides                                          */
/* ------------------------------------------------------------------ */

const slidePoints = [
  { x: 300, y: 176 },
  { x: 500, y: 172 },
  { x: 660, y: 300 },
  { x: 596, y: 430 },
];

function bezier(points, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * points[0].x + b * points[1].x + c * points[2].x + d * points[3].x,
    y: a * points[0].y + b * points[1].y + c * points[2].y + d * points[3].y,
  };
}

function bezierAngle(points, t) {
  const p1 = bezier(points, Math.max(0, t - 0.01));
  const p2 = bezier(points, Math.min(1, t + 0.01));
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function drawSlideCurve(context, color) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const path = () => {
    context.beginPath();
    for (let i = 0; i <= 46; i += 1) {
      const point = bezier(slidePoints, i / 46);
      if (i === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
  };
  path();
  context.strokeStyle = '#315c7d';
  context.lineWidth = 52;
  context.stroke();
  path();
  context.strokeStyle = color;
  context.lineWidth = 44;
  context.stroke();
  path();
  context.strokeStyle = 'rgba(255,255,255,0.38)';
  context.lineWidth = 10;
  context.stroke();
  context.restore();

  /* supports */
  context.save();
  context.strokeStyle = '#4b6072';
  context.lineWidth = 8;
  for (const t of [0.28, 0.55, 0.82]) {
    const point = bezier(slidePoints, t);
    context.beginPath();
    context.moveTo(point.x, point.y + 10);
    context.lineTo(point.x + 12, 500);
    context.stroke();
  }
  context.restore();
}

function drawPenguin(context, x, y, s, cheer, card) {
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.strokeStyle = INK;
  context.lineWidth = 2.5;
  context.fillStyle = '#22242f';
  context.beginPath();
  context.ellipse(0, -32, 24, 34, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#f8fcff';
  context.beginPath();
  context.ellipse(0, -26, 15, 24, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#22242f';
  context.beginPath();
  context.arc(0, -66, 17, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#f8fcff';
  context.beginPath();
  context.ellipse(-6, -67, 5, 6, 0.2, 0, Math.PI * 2);
  context.ellipse(6, -67, 5, 6, -0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = INK;
  context.beginPath();
  context.arc(-6, -68, 2, 0, Math.PI * 2);
  context.arc(6, -68, 2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f59e0b';
  context.beginPath();
  context.moveTo(-2, -60);
  context.lineTo(7, -56);
  context.lineTo(-2, -52);
  context.closePath();
  context.fill();
  context.fillStyle = '#f59e0b';
  context.beginPath();
  context.ellipse(-9, -2, 8, 4, 0, 0, Math.PI * 2);
  context.ellipse(9, -2, 8, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#22242f';
  context.lineWidth = 9;
  context.lineCap = 'round';
  context.beginPath();
  if (cheer) {
    context.moveTo(-20, -38);
    context.lineTo(-32, -58);
  } else {
    context.moveTo(-20, -38);
    context.lineTo(-27, -22);
  }
  context.moveTo(20, -38);
  context.lineTo(27, -22);
  context.stroke();
  if (card) {
    context.save();
    context.fillStyle = '#fffdf4';
    context.strokeStyle = INK;
    context.lineWidth = 2;
    context.beginPath();
    roundRectPath(context, -34, -112, 68, 38, 5);
    context.fill();
    context.stroke();
    label(context, card, 0, -92, 20, {
      color: '#2a2340',
      align: 'center',
      strokeWidth: 0,
    });
    context.restore();
  }
  context.restore();
}

function drawSlider(context, x, y, angle, s, person, wobble, offset = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  if (offset) context.translate(0, offset);
  context.scale(s, s * (1 + wobble * 0.12));
  context.strokeStyle = INK;
  context.lineWidth = 2.6;
  context.lineJoin = 'round';

  /* boots and legs behind */
  context.fillStyle = person.pants;
  context.beginPath();
  roundRectPath(context, -48, -8, 24, 12, 6);
  context.fill();
  context.stroke();
  context.fillStyle = '#2b2437';
  context.beginPath();
  roundRectPath(context, -54, -10, 14, 16, 5);
  context.fill();
  context.stroke();

  /* body */
  context.fillStyle = person.coat;
  context.beginPath();
  roundRectPath(context, -30, -18, 52, 34, 15);
  context.fill();
  context.stroke();
  context.fillStyle = person.coatDark;
  context.beginPath();
  roundRectPath(context, -16, -16, 36, 20, 9);
  context.fill();
  context.globalAlpha = 0.55;
  context.fill();

  /* arms out like penguin flippers */
  context.globalAlpha = 1;
  context.strokeStyle = person.coat;
  context.lineWidth = 9;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-10, -10);
  context.lineTo(-30, 4);
  context.moveTo(8, -10);
  context.lineTo(26, 4);
  context.stroke();
  context.fillStyle = person.scarf;
  context.beginPath();
  context.arc(-31, 4, 5, 0, Math.PI * 2);
  context.arc(27, 4, 5, 0, Math.PI * 2);
  context.fill();

  /* head at the front */
  context.fillStyle = person.skin;
  context.strokeStyle = INK;
  context.lineWidth = 2.6;
  context.beginPath();
  context.arc(25, -10, 15, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = person.hat;
  context.beginPath();
  context.arc(25, -14, 15.5, Math.PI * 1.05, Math.PI * 1.95);
  context.lineTo(40, -20);
  context.lineTo(10, -20);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#fff8e7';
  context.beginPath();
  roundRectPath(context, 8, -22, 34, 6, 3);
  context.fill();
  context.fillStyle = INK;
  context.beginPath();
  context.arc(30, -12, 2, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(38, -6, 4, 0.1 * Math.PI, 0.8 * Math.PI);
  context.stroke();
  context.restore();
}

export class PenguinSlides {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.rounds = [
      {
        name: 'Jira',
        color: '#4aa3df',
        people: [{ ...PEOPLE.jira, scale: 0.82 }],
      },
      {
        name: 'Joel',
        color: '#e4572e',
        people: [{ ...PEOPLE.joel, scale: 0.8 }],
      },
      {
        name: 'Mom & Dad',
        color: '#3bb273',
        people: [
          { ...PEOPLE.mom, scale: 0.78 },
          { ...PEOPLE.dad, scale: 0.82 },
        ],
      },
    ];
    this.round = 0;
    this.phase = 'ready';
    this.meter = 0;
    this.meterTime = 0;
    this.power = 0;
    this.style = 0;
    this.slideT = 0;
    this.splashTimer = 0;
    this.roundPoints = 0;
    this.totalPoints = 0;
    this.wet = 0;
    this.wonTimer = 0;
    this.autoTimer = 0;
    this.wobble = 0;
    this.wobbleTime = 0;
    this.popups = [];
    this.penguinCheer = 0;
    this.lastRating = '';
    this.hintTimer = 7;
  }

  launch() {
    if (this.phase !== 'ready') return;
    const green = clamp(1 - Math.abs(this.meter - 0.52) * 2.4, 0.15, 1);
    this.power = green;
    this.style = 0;
    this.slideT = 0;
    this.phase = 'slide';
    this.roundPoints = Math.round(70 + this.power * 110);
    if (this.power > 0.85) {
      this.popup(300, 150, 'PERFECT PENGUIN!', '#ffd166');
      sfx.ding();
    } else {
      sfx.whoosh();
    }
    burst(300, 170, {
      count: 12,
      colors: ['#ffffff', '#bfeaff'],
      speed: 160,
      size: 6,
      gravity: 300,
    });
    this.autoTimer = 0;
  }

  finishSplash() {
    const stylePoints = this.style * 25;
    this.roundPoints += stylePoints + (this.power > 0.85 ? 60 : 0);
    this.totalPoints += this.roundPoints;
    this.wet = Math.min(100, this.wet + 18 + this.style * 4 + Math.round(this.power * 12));
    this.phase = 'splash';
    this.splashTimer = 1.8;
    this.penguinCheer = 1;
    this.lastRating =
      this.power > 0.85 ? (this.style > 2 ? 'PERFECT 10' : 'A solid 9.5') : this.power > 0.55 ? 'A brave 8' : 'A wet 6';
    sfx.splash();
    burst(596, 438, {
      count: 42,
      colors: ['#ffffff', '#bfeaff', '#7dd3fc'],
      speed: 300,
      size: 9,
      gravity: 650,
      life: 1.2,
    });
    this.popup(596, 380, `+${this.roundPoints} SPLASH`, '#a7f3c8');
  }

  popup(x, y, text, color = '#ffd166') {
    this.popups.push({ x, y, text, color, t: 1.1 });
  }

  update(dt) {
    this.t += dt;
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.penguinCheer = Math.max(0, this.penguinCheer - dt);
    this.wobbleTime = Math.max(0, this.wobbleTime - dt);
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      this.popups[i].t -= dt;
      this.popups[i].y -= dt * 35;
      if (this.popups[i].t <= 0) this.popups.splice(i, 1);
    }

    if (this.phase === 'won') {
      this.wonTimer -= dt;
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        const score = 300 + this.totalPoints + (this.wet >= 100 ? 150 : 0);
        this.onDone({
          score,
          note:
            this.wet >= 100
              ? 'Wetness 100%: trousers defeated, socks a lost cause, fun maximum.'
              : `Wetness ${this.wet}%. The penguin judges gave your form a very polite 9.5.`,
          stats: [
            ['Splash points', this.totalPoints],
            ['Wetness', `${this.wet}%`],
          ],
        });
      }
      return;
    }

    if (this.phase === 'ready') {
      this.meterTime += dt;
      this.meter = 0.5 + 0.5 * Math.sin(this.meterTime * 3.4);
      this.autoTimer += dt;
      if (input.actionPressed()) this.launch();
      else if (this.autoTimer > 7) this.launch();
      return;
    }

    if (this.phase === 'slide') {
      this.slideT += dt / (1.85 - this.power * 0.55);
      this.wobble = this.wobbleTime > 0 ? Math.sin(this.t * 26) : 0;
      if (this.slideT >= 1) {
        this.slideT = 1;
        this.finishSplash();
        return;
      }
      if (input.actionPressed()) {
        if (this.style < 4) {
          this.style += 1;
          this.wobbleTime = 0.45;
          this.popup(bezier(slidePoints, this.slideT).x, bezier(slidePoints, this.slideT).y - 46, 'STYLE!', '#ffd166');
          sfx.pop();
          burst(bezier(slidePoints, this.slideT).x, bezier(slidePoints, this.slideT).y, {
            count: 8,
            colors: ['#ffffff', '#ffd166'],
            speed: 140,
            size: 6,
            gravity: 200,
            life: 0.5,
          });
        } else {
          sfx.tap();
        }
      }
      return;
    }

    if (this.phase === 'splash') {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        if (this.round < this.rounds.length - 1) {
          this.round += 1;
          this.phase = 'ready';
          this.meterTime = 0;
          this.autoTimer = 0;
          this.slideT = 0;
          this.style = 0;
          this.wobble = 0;
        } else {
          this.phase = 'won';
          this.wonTimer = 2.4;
          sfx.success();
        }
      }
    }
  }

  drawScene(context) {
    sky(context, '#b9d8ef', '#f6e6d3');
    const sun = context.createRadialGradient(790, 190, 10, 790, 190, 130);
    sun.addColorStop(0, 'rgba(255, 235, 190, 0.8)');
    sun.addColorStop(1, 'rgba(255, 235, 190, 0)');
    context.fillStyle = sun;
    context.fillRect(640, 0, 320, 330);

    context.fillStyle = '#e1eff8';
    context.beginPath();
    context.moveTo(0, 330);
    context.quadraticCurveTo(200, 260, 430, 322);
    context.quadraticCurveTo(680, 386, 960, 300);
    context.lineTo(960, 540);
    context.lineTo(0, 540);
    context.closePath();
    context.fill();
    drawPine(context, 48, 430, 170);
    drawPine(context, 110, 448, 115);
    drawPine(context, 920, 440, 150);

    snowGround(context, 470);

    /* fence */
    context.strokeStyle = '#8a6a4f';
    context.lineWidth = 7;
    for (let i = 0; i < 8; i += 1) {
      const x = 60 + i * 118;
      context.beginPath();
      context.moveTo(x, 478);
      context.lineTo(x, 404);
      context.stroke();
    }
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(48, 428);
    context.lineTo(924, 428);
    context.stroke();

    /* playground bits */
    context.strokeStyle = '#4b6072';
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(90, 472);
    context.lineTo(90, 330);
    context.moveTo(90, 336);
    context.lineTo(190, 336);
    context.moveTo(186, 336);
    context.lineTo(186, 472);
    context.stroke();
    context.strokeStyle = '#7b8ea0';
    context.lineWidth = 3;
    for (const x of [110, 134, 158]) {
      context.beginPath();
      context.moveTo(x, 338);
      context.lineTo(x, 420 + (x % 20));
      context.stroke();
    }

    /* tower, platform and ladder */
    context.fillStyle = '#8a5a3a';
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.beginPath();
    roundRectPath(context, 246, 152, 112, 18, 4);
    context.fill();
    context.stroke();
    context.strokeStyle = '#6b4a34';
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(258, 170);
    context.lineTo(258, 500);
    context.moveTo(344, 170);
    context.lineTo(344, 500);
    context.stroke();
    context.strokeStyle = '#9b7b5e';
    context.lineWidth = 5;
    for (let i = 0; i < 9; i += 1) {
      const y = 196 + i * 32;
      context.beginPath();
      context.moveTo(258, y);
      context.lineTo(344, y);
      context.stroke();
    }
    /* roof */
    context.fillStyle = '#4aa3df';
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(238, 152);
    context.lineTo(302, 108);
    context.lineTo(366, 152);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(238, 152);
    context.lineTo(302, 108);
    context.lineTo(366, 152);
    context.lineTo(348, 158);
    context.lineTo(302, 128);
    context.lineTo(256, 158);
    context.closePath();
    context.fill();
    context.strokeStyle = '#6b4a34';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(302, 108);
    context.lineTo(302, 78);
    context.stroke();
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.moveTo(302, 78);
    context.lineTo(330, 86);
    context.lineTo(302, 96);
    context.closePath();
    context.fill();

    drawSlideCurve(context, this.rounds[this.round].color);

    /* puddle at the bottom */
    context.fillStyle = '#9bd8f2';
    context.strokeStyle = '#5aa9c9';
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(596, 470, 92, 22, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.beginPath();
    context.ellipse(570, 464, 30, 6, -0.1, 0, Math.PI * 2);
    context.fill();

    /* the penguin judges */
    drawPenguin(context, 808, 502, 1.0, this.penguinCheer > 0.2, null);
    drawPenguin(context, 878, 510, 0.85, false, this.phase === 'splash' ? this.lastRating.replace(/[^0-9.]/g, '') || '9' : '');
    if (this.phase === 'splash') {
      bubble(context, 850, 392, this.lastRating, { size: 14, maxWidth: 190 });
    }

    const round = this.rounds[this.round];

    if (this.phase === 'ready') {
      for (let i = 0; i < round.people.length; i += 1) {
        const person = round.people[i];
        drawPerson(context, 300 + i * 26, 176, 0.85, {
          ...person,
          face: 'happy',
          armPose: 'up',
        });
      }
      label(context, 'TAP TO PUSH OFF!', CX, 470, 18, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 5,
        alpha: clamp(0.8 + Math.sin(this.t * 5) * 0.2, 0, 1),
      });
    } else if (this.phase === 'slide' || (this.phase === 'splash' && this.slideT < 1)) {
      const point = bezier(slidePoints, this.slideT);
      const angle = bezierAngle(slidePoints, this.slideT);
      const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
      for (let i = 0; i < round.people.length; i += 1) {
        const offset = round.people.length > 1 ? (i === 0 ? -15 : 15) : 0;
        drawSlider(
          context,
          point.x + normal.x * offset,
          point.y + normal.y * offset,
          angle,
          0.95,
          round.people[i],
          this.wobble,
          0
        );
      }
      /* speed lines */
      context.strokeStyle = 'rgba(255,255,255,0.65)';
      context.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        const t = Math.max(0, this.slideT - 0.04 - i * 0.03);
        const p = bezier(slidePoints, t);
        context.beginPath();
        context.moveTo(p.x - 20, p.y - 22 - i * 6);
        context.lineTo(p.x - 48, p.y - 26 - i * 8);
        context.stroke();
      }
      if (this.style < 4) {
        label(context, `TAP FOR STYLE · ${this.style}/4`, CX, 500, 14, {
          color: '#fff8e7',
          align: 'center',
          strokeWidth: 4,
        });
      } else {
        label(context, 'MAXIMUM STYLE!', CX, 500, 15, {
          color: '#ffd166',
          align: 'center',
          strokeWidth: 4,
        });
      }
    } else if (this.phase === 'splash') {
      for (let i = 0; i < round.people.length; i += 1) {
        const person = round.people[i];
        drawPerson(context, 596 + (i === 0 ? -24 : 24), 500, 0.88, {
          ...person,
          face: 'grin',
          armPose: 'up',
        });
      }
      /* splash arc */
      context.strokeStyle = 'rgba(255,255,255,0.9)';
      context.lineWidth = 7;
      context.beginPath();
      context.arc(596, 470, 116, Math.PI * 1.08, Math.PI * 1.92);
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        context.arc(480 + i * 58, 430 - (i % 2) * 30, 8, 0, Math.PI * 2);
        context.fill();
      }
    }

    drawSnow(context, 0.9);

    /* HUD */
    topPanel(context, 24, 16, 912, 74);
    label(context, `ROUND ${this.round + 1} OF ${this.rounds.length}`, 46, 38, 11, {
      color: '#bcd7e8',
    });
    label(context, round.name, 46, 64, 18, { color: '#fff8e7' });
    for (let i = 0; i < this.rounds.length; i += 1) {
      context.fillStyle = i <= this.round ? '#ffd166' : 'rgba(255,255,255,0.25)';
      context.beginPath();
      context.arc(280 + i * 22, 64, 7, 0, Math.PI * 2);
      context.fill();
    }
    label(context, 'SPLASH POINTS', 916, 38, 11, {
      color: '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });
    label(context, `${this.totalPoints}`, 916, 64, 22, {
      color: '#ffd166',
      align: 'right',
    });

    /* wet meter */
    context.fillStyle = 'rgba(16, 22, 42, 0.62)';
    context.beginPath();
    roundRectPath(context, 838, 96, 94, 38, 8);
    context.fill();
    label(context, 'WET', 846, 106, 10, { color: '#bfeaff', strokeWidth: 0 });
    label(context, `${this.wet}%`, 924, 106, 10, {
      color: '#bfeaff',
      align: 'right',
      strokeWidth: 0,
    });
    progressBar(context, 846, 114, 78, 12, this.wet / 100, '#7dd3fc');

    for (const popup of this.popups) {
      label(context, popup.text, popup.x, popup.y, 18, {
        color: popup.color,
        align: 'center',
        strokeWidth: 5,
        alpha: clamp(popup.t * 1.8, 0, 1),
      });
    }

    /* launch meter */
    if (this.phase === 'ready') {
      context.save();
      context.fillStyle = 'rgba(16,22,42,0.72)';
      context.beginPath();
      roundRectPath(context, 244, 492, 472, 40, 12);
      context.fill();
      const meterX = 262;
      const meterW = 436;
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.beginPath();
      roundRectPath(context, meterX, 512, meterW, 12, 6);
      context.fill();
      context.fillStyle = 'rgba(61,220,132,0.7)';
      context.beginPath();
      roundRectPath(context, meterX + meterW * 0.42, 512, meterW * 0.2, 12, 6);
      context.fill();
      context.fillStyle = '#ffd166';
      context.strokeStyle = INK;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(meterX + this.meter * meterW, 518, 9, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      label(context, 'PUSH OFF', 480, 504, 11, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 0,
      });
      context.restore();
    }

    if (this.phase === 'won') {
      context.fillStyle = 'rgba(12, 18, 32, 0.45)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      label(context, 'MAXIMUM WETNESS!', CX, 230, 38, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 8,
      });
      label(context, 'Four penguins. Three slides. Zero dry socks.', CX, 274, 16, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 3,
      });
    }
  }

  draw(context) {
    this.drawScene(context);
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 6 — Brain Rot Battle                                        */
/* ------------------------------------------------------------------ */

function drawSittingKid(context, x, y, s, person, device, lookAway, t) {
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.lineJoin = 'round';
  context.strokeStyle = INK;
  context.lineWidth = 2.6;

  /* body */
  context.fillStyle = person.coat;
  context.beginPath();
  roundRectPath(context, -25, -60, 50, 58, 14);
  context.fill();
  context.stroke();
  context.fillStyle = person.coatDark;
  context.beginPath();
  roundRectPath(context, -25, -36, 50, 34, 12);
  context.fill();

  /* head */
  context.fillStyle = person.skin;
  context.beginPath();
  context.arc(0, -82, 18, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = person.hair;
  context.beginPath();
  context.arc(0, -86, 18, Math.PI * 1.02, Math.PI * 1.98);
  context.lineTo(18, -80);
  context.lineTo(-18, -80);
  context.closePath();
  context.fill();
  context.stroke();
  if (person.hairStyle === 'braid') {
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.arc(21, -74 + i * 9, 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }
  context.fillStyle = person.hat;
  context.beginPath();
  context.arc(0, -88, 19, Math.PI * 1.05, Math.PI * 1.95);
  context.lineTo(19, -92);
  context.lineTo(-19, -92);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#fff8e7';
  context.beginPath();
  roundRectPath(context, -20, -93, 40, 8, 4);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(0, -106, 5, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  /* face */
  context.fillStyle = INK;
  if (lookAway > 0) {
    context.lineWidth = 2.4;
    context.strokeStyle = INK;
    context.beginPath();
    context.arc(-7, -84, 4, 0.2, Math.PI - 0.2);
    context.arc(7, -84, 4, 0.2, Math.PI - 0.2);
    context.stroke();
    context.beginPath();
    context.arc(0, -74, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(-7, -84, 2.6, 0, Math.PI * 2);
    context.arc(7, -84, 2.6, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -76, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  }

  /* device */
  context.save();
  context.translate(0, -28);
  context.rotate(lookAway > 0 ? 0.22 : -0.08);
  context.fillStyle = '#1f2430';
  context.beginPath();
  roundRectPath(context, -34, -22, 68, 44, 6);
  context.fill();
  context.stroke();
  context.fillStyle = device === 'switch' ? '#e63946' : '#7dd3fc';
  context.beginPath();
  roundRectPath(context, -28, -16, 56, 32, 3);
  context.fill();
  if (device === 'switch') {
    context.fillStyle = '#1f2430';
    context.beginPath();
    roundRectPath(context, -34, -22, 12, 44, 5);
    context.fill();
    context.fillRect(22, -22, 12, 44);
    context.fillStyle = '#22c55e';
    context.beginPath();
    context.arc(-28, 0, 2.4, 0, Math.PI * 2);
    context.arc(28, 0, 2.4, 0, Math.PI * 2);
    context.fill();
  } else {
    context.strokeStyle = 'rgba(255,255,255,0.75)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-20, -10);
    context.lineTo(-6, 2);
    context.lineTo(12, -8);
    context.stroke();
  }
  context.restore();

  /* glowing hands */
  context.fillStyle = person.skin;
  context.beginPath();
  context.arc(-30, -26, 6, 0, Math.PI * 2);
  context.arc(30, -26, 6, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.restore();
}

function drawEye(context, x, y, r, beat, t) {
  context.save();
  context.translate(x, y);
  const glow = context.createRadialGradient(0, 0, 4, 0, 0, r * 1.6);
  glow.addColorStop(0, 'rgba(255, 217, 61, 0.45)');
  glow.addColorStop(1, 'rgba(255, 217, 61, 0)');
  context.fillStyle = glow;
  context.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 3.2);

  context.fillStyle = 'rgba(20, 16, 38, 0.85)';
  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, r, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  /* closing ring */
  context.strokeStyle = beat > 0.8 ? '#ffd166' : 'rgba(255, 217, 61, 0.55)';
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(0, 0, r * (1 - beat * 0.5), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - beat * 0.15));
  context.stroke();

  /* eye */
  context.fillStyle = '#fff8e7';
  context.beginPath();
  context.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#2a2340';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = '#7c3aed';
  context.beginPath();
  context.arc(0, 0, 13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#1a1226';
  context.beginPath();
  context.arc(0, 0, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(-4, -5, 3, 0, Math.PI * 2);
  context.fill();

  if (beat > 0.86) {
    context.strokeStyle = '#ffd166';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, r + 9 + Math.sin(t * 20) * 3, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

export class BrainRot {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.duration = 25;
    this.timeLeft = 25;
    this.rot = 12;
    this.beat = 0;
    this.beatDur = 0.7;
    this.phase = 'play';
    this.perfects = 0;
    this.goods = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.brainrotHits = 0;
    this.rotSum = 0;
    this.rotTime = 0;
    this.brainrotTimer = 0;
    this.wonTimer = 0;
    this.lookAway = 0;
    this.glitch = 0;
    this.shake = 0;
    this.ripples = [];
    this.popups = [];
    this.spores = [];
    this.words = [];
    this.forced = false;
    this.hintTimer = 7;
    this.spawnTimer = 1;
  }

  perfectTap() {
    this.perfects += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.rot = Math.max(0, this.rot - 20);
    const points = 30 + this.combo * 5;
    this.lookAway = 0.65;
    this.popup(CX, 330, `LOOK AWAY! +${points}`, '#ffd166');
    sfx.ding();
    burst(480, 285, {
      count: 18,
      colors: ['#ffd166', '#ffffff', '#a7f3c8'],
      speed: 260,
      size: 7,
      gravity: 300,
      life: 0.8,
    });
    this.ripples.push({ x: 480, y: 285, t: 0.5, color: '#ffd166' });
  }

  goodTap() {
    this.goods += 1;
    this.rot = Math.max(0, this.rot - 8);
    this.lookAway = 0.4;
    this.combo = Math.max(0, this.combo - 1);
    this.popup(CX + rand(-40, 40), 340, 'okay...', '#bfeaff');
    sfx.tap();
    this.ripples.push({ x: 480, y: 285, t: 0.35, color: '#bfeaff' });
  }

  weakTap() {
    this.rot = Math.max(0, this.rot - 1.5);
    this.combo = 0;
    this.popup(CX + rand(-60, 60), 350, 'too soon…', '#a9b7c9');
    sfx.tick();
  }

  popup(x, y, text, color) {
    this.popups.push({ x, y, text, color, t: 1 });
  }

  startBrainrot() {
    this.phase = 'brainrot';
    this.brainrotTimer = 2.4;
    this.brainrotHits += 1;
    this.rot = 100;
    this.glitch = 2.4;
    this.shake = 0.7;
    this.combo = 0;
    this.lookAway = 0;
    this.words = Array.from({ length: 6 }, () => ({
      text: pick(['SKIBIDI', 'RIZZ', 'OHIO', 'SIGMA', 'BRAIN ROT', 'LEVEL 100']),
      x: rand(80, 880),
      y: rand(140, 430),
      rot: rand(-0.3, 0.3),
      size: rand(24, 48),
      color: pick(['#ff8a00', '#7dd3fc', '#a7f3c8', '#ff6b6b', '#ffd166']),
      phase: rand(0, 6),
    }));
    sfx.fail();
  }

  endChapter(forced = false) {
    if (this.phase === 'won') return;
    this.phase = 'won';
    this.wonTimer = 2.4;
    this.forced = forced;
    this.words = [];
    sfx.success();
  }

  update(dt) {
    this.t += dt;
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.lookAway = Math.max(0, this.lookAway - dt);
    this.glitch = Math.max(0, this.glitch - dt);
    this.shake = Math.max(0, this.shake - dt);
    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      this.ripples[i].t -= dt;
      if (this.ripples[i].t <= 0) this.ripples.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      this.popups[i].t -= dt;
      this.popups[i].y -= dt * 28;
      if (this.popups[i].t <= 0) this.popups.splice(i, 1);
    }

    /* ambient rot spores */
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.phase === 'play') {
      this.spawnTimer = rand(0.35, 0.8);
      this.spores.push({
        x: rand(320, 640),
        y: 430,
        vy: rand(14, 32),
        r: rand(4, 11),
        phase: rand(0, 6),
        color: pick(['#a855f7', '#7c3aed', '#22c55e', '#f472b6']),
      });
    }
    for (let i = this.spores.length - 1; i >= 0; i -= 1) {
      const spore = this.spores[i];
      spore.y -= spore.vy * dt;
      spore.x += Math.sin(this.t * 2 + spore.phase) * 10 * dt;
      if (spore.y < 120) this.spores.splice(i, 1);
    }

    if (this.phase === 'won') {
      this.wonTimer -= dt;
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        const avgRot = this.rotTime > 0 ? this.rotSum / this.rotTime : 0;
        const score = Math.max(
          220,
          400 + this.perfects * 30 - this.brainrotHits * 100 + Math.round((100 - avgRot) * 3)
        );
        this.onDone({
          score,
          title: this.forced ? 'Mom took the devices away' : undefined,
          text: this.forced
            ? 'The iPads won this round. Mom unplugged everything, hid the router in the freezer, and sent everyone outside to look at a tree. Grandma applauded.'
            : undefined,
          note: this.forced
            ? 'The score still counts. Grandma says mashed potatoes are a state of mind.'
            : `${this.perfects} perfect look-aways and ${this.brainrotHits} brain-rot moment${this.brainrotHits === 1 ? '' : 's'}.`,
          stats: [
            ['Perfect', this.perfects],
            ['Best combo', this.bestCombo],
            ['Brain rot', this.brainrotHits],
          ],
        });
      }
      return;
    }

    if (this.phase === 'brainrot') {
      this.brainrotTimer -= dt;
      if (this.brainrotTimer <= 0) {
        if (this.brainrotHits >= 3) {
          this.endChapter(true);
        } else {
          this.phase = 'play';
          this.rot = 55;
          this.lookAway = 0;
          this.spores = [];
        }
      }
      return;
    }

    this.timeLeft -= dt;
    this.rot = Math.min(100, this.rot + 11 * dt);
    this.rotSum += this.rot * dt;
    this.rotTime += dt;
    this.beat += dt / this.beatDur;
    if (this.beat >= 1) this.beat -= 1;

    if (input.actionPressed()) {
      if (this.beat > 0.8) this.perfectTap();
      else if (this.beat > 0.45) this.goodTap();
      else this.weakTap();
      this.ripples.push({ x: input.down ? input.x : 480, y: input.down ? input.y : 285, t: 0.3, color: '#ffffff' });
    }

    if (this.rot >= 100) this.startBrainrot();
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endChapter(false);
    }
  }

  drawScene(context) {
    const wall = context.createLinearGradient(0, 0, 0, VIEW_H);
    wall.addColorStop(0, '#4a2e45');
    wall.addColorStop(0.6, '#5a3748');
    wall.addColorStop(1, '#37232f');
    context.fillStyle = wall;
    context.fillRect(0, 0, VIEW_W, VIEW_H);

    /* window into the snowy evening */
    context.fillStyle = '#2a1b2a';
    context.strokeStyle = '#8a5a3a';
    context.lineWidth = 9;
    context.beginPath();
    roundRectPath(context, 72, 112, 196, 170, 5);
    context.fill();
    context.stroke();
    context.save();
    context.beginPath();
    roundRectPath(context, 80, 120, 180, 154, 2);
    context.clip();
    const night = context.createLinearGradient(0, 120, 0, 274);
    night.addColorStop(0, '#223a5c');
    night.addColorStop(1, '#6b8fb2');
    context.fillStyle = night;
    context.fillRect(80, 120, 180, 154);
    context.fillStyle = '#f4fbff';
    context.beginPath();
    context.moveTo(80, 252);
    context.quadraticCurveTo(170, 230, 260, 256);
    context.lineTo(260, 274);
    context.lineTo(80, 274);
    context.closePath();
    context.fill();
    drawPine(context, 226, 264, 104, { dark: '#23404c', light: '#305467' });
    context.restore();
    context.strokeStyle = '#8a5a3a';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(170, 120);
    context.lineTo(170, 274);
    context.moveTo(80, 197);
    context.lineTo(260, 197);
    context.stroke();

    /* floor and rug */
    context.fillStyle = '#3b2830';
    context.fillRect(0, 440, VIEW_W, 100);
    context.fillStyle = '#7a3a3f';
    context.beginPath();
    context.ellipse(480, 500, 320, 42, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#9c5a56';
    context.lineWidth = 5;
    context.stroke();

    /* pictures */
    context.fillStyle = '#6b4a34';
    context.strokeStyle = '#8a5a3a';
    context.lineWidth = 5;
    context.beginPath();
    roundRectPath(context, 704, 126, 106, 82, 3);
    context.fill();
    context.stroke();
    context.fillStyle = '#f4e2bd';
    context.fillRect(712, 134, 90, 66);
    drawTurkey(context, 757, 190, 0.42, 0.7, this.t);
    label(context, 'GRANDMA', 757, 222, 8, {
      color: '#7a3a3f',
      align: 'center',
      strokeWidth: 0,
    });

    /* lamp */
    context.fillStyle = '#d9b36c';
    context.beginPath();
    context.moveTo(890, 180);
    context.lineTo(940, 180);
    context.lineTo(950, 230);
    context.lineTo(880, 230);
    context.closePath();
    context.fill();
    context.strokeStyle = '#5a3a2a';
    context.lineWidth = 5;
    context.stroke();
    context.fillRect(910, 230, 8, 210);
    const lampGlow = context.createRadialGradient(915, 220, 10, 915, 220, 190);
    lampGlow.addColorStop(0, 'rgba(255, 214, 130, 0.28)');
    lampGlow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    context.fillStyle = lampGlow;
    context.fillRect(700, 30, 260, 420);

    /* Grandma in her chair */
    context.save();
    context.fillStyle = '#5b3a2a';
    context.beginPath();
    roundRectPath(context, 130, 390, 150, 30, 10);
    context.fill();
    context.fillRect(140, 418, 14, 76);
    context.fillRect(256, 418, 14, 76);
    context.beginPath();
    roundRectPath(context, 122, 300, 20, 116, 8);
    context.fill();
    context.restore();
    drawPerson(context, 210, 470, 0.98, {
      ...PEOPLE.grandma,
      face: 'happy',
      armPose: 'down',
    });

    /* Mom with cocoa */
    drawPerson(context, 812, 480, 1.0, { ...PEOPLE.mom, face: 'happy' });
    context.fillStyle = '#f4e2bd';
    context.beginPath();
    roundRectPath(context, 834, 428, 18, 18, 4);
    context.fill();
    context.strokeStyle = '#8a5a3a';
    context.lineWidth = 2;
    context.stroke();

    /* couch */
    context.fillStyle = '#2f7f78';
    context.strokeStyle = '#1d4f4a';
    context.lineWidth = 4;
    context.beginPath();
    roundRectPath(context, 286, 344, 400, 118, 22);
    context.fill();
    context.stroke();
    context.fillStyle = '#37948b';
    context.beginPath();
    roundRectPath(context, 286, 400, 400, 62, 20);
    context.fill();
    context.stroke();

    /* kids on the couch */
    const jiraLook = this.brainrotHits > 0 && this.phase === 'brainrot' ? 0 : this.lookAway;
    const joelLook = this.brainrotHits > 0 && this.phase === 'brainrot' ? 0 : this.lookAway;
    drawSittingKid(context, 396, 452, 0.95, PEOPLE.jira, 'ipad', jiraLook, this.t);
    drawSittingKid(context, 574, 452, 0.95, PEOPLE.joel, 'switch', joelLook, this.t);

    /* couch front */
    context.fillStyle = '#2b746e';
    context.strokeStyle = '#1d4f4a';
    context.lineWidth = 4;
    context.beginPath();
    roundRectPath(context, 280, 458, 412, 58, 18);
    context.fill();
    context.stroke();
    context.fillStyle = '#3b8c84';
    context.beginPath();
    roundRectPath(context, 330, 452, 100, 26, 10);
    context.fill();
    context.beginPath();
    roundRectPath(context, 548, 452, 100, 26, 10);
    context.fill();

    /* screen glow on the kids */
    for (const [x, color] of [
      [396, 'rgba(125, 211, 252, 0.16)'],
      [574, 'rgba(239, 68, 68, 0.13)'],
    ]) {
      const glow = context.createRadialGradient(x, 410, 4, x, 410, 120);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.fillRect(x - 130, 300, 260, 230);
    }

    /* rot spores */
    for (const spore of this.spores) {
      context.save();
      context.globalAlpha = 0.75;
      context.fillStyle = spore.color;
      context.beginPath();
      context.arc(spore.x, spore.y, spore.r, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#1a1226';
      context.beginPath();
      context.arc(spore.x - spore.r * 0.3, spore.y - spore.r * 0.2, Math.max(1, spore.r * 0.16), 0, Math.PI * 2);
      context.arc(spore.x + spore.r * 0.3, spore.y - spore.r * 0.2, Math.max(1, spore.r * 0.16), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    /* the eye */
    drawEye(context, 480, 285, 62, this.beat, this.t);
    label(context, 'TAP TO LOOK AWAY', 480, 218, 12, {
      color: this.beat > 0.8 ? '#ffd166' : '#e8dfff',
      align: 'center',
      strokeWidth: 3,
    });

    for (const ripple of this.ripples) {
      context.save();
      context.globalAlpha = clamp(ripple.t * 1.8, 0, 0.8);
      context.strokeStyle = ripple.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ripple.x, ripple.y, 20 + (1 - ripple.t) * 70, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    /* HUD */
    topPanel(context, 24, 16, 912, 90);
    label(context, 'BRAIN ROT', 46, 38, 12, { color: '#ffb3e6' });
    progressBar(context, 150, 30, 340, 18, this.rot / 100, '#a855f7', 'rgba(255,255,255,0.14)');
    label(context, `${Math.round(this.rot)}%`, 500, 39, 11, {
      color: '#e8dfff',
      strokeWidth: 0,
    });
    label(context, `PERFECT ${this.perfects}`, 916, 38, 11, {
      color: '#ffd166',
      align: 'right',
      strokeWidth: 0,
    });
    if (this.combo > 1) {
      label(context, `COMBO x${this.combo}`, 916, 58, 15, {
        color: '#a7f3c8',
        align: 'right',
      });
    }
    label(context, 'TIME LEFT', 46, 78, 10, { color: '#bcd7e8' });
    progressBar(context, 150, 72, 340, 12, this.timeLeft / this.duration, '#3ddc84');
    label(context, `${this.timeLeft.toFixed(1)}s`, 500, 78, 11, {
      color: '#e8dfff',
      strokeWidth: 0,
    });
    label(context, 'IPADS · SWITCHES', 916, 84, 10, {
      color: '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });

    for (const popup of this.popups) {
      label(context, popup.text, popup.x, popup.y, 18, {
        color: popup.color,
        align: 'center',
        strokeWidth: 5,
        alpha: clamp(popup.t * 1.6, 0, 1),
      });
    }

    if (this.hintTimer > 0) {
      context.save();
      context.globalAlpha = clamp(this.hintTimer / 2, 0, 1) * 0.9;
      context.fillStyle = 'rgba(16,22,42,0.6)';
      context.beginPath();
      roundRectPath(context, 300, 502, 360, 30, 15);
      context.fill();
      label(context, 'TAP WHEN THE RING CLOSES', CX, 517, 11, {
        color: '#eaf6ff',
        align: 'center',
        strokeWidth: 0,
      });
      context.restore();
    }

    if (this.phase === 'brainrot') {
      context.fillStyle = 'rgba(120, 30, 160, 0.35)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      for (const word of this.words) {
        context.save();
        context.translate(word.x, word.y + Math.sin(this.t * 3 + word.phase) * 6);
        context.rotate(word.rot);
        label(context, word.text, 0, 0, word.size, {
          color: word.color,
          align: 'center',
          strokeWidth: 6,
          stroke: '#2a0b3a',
        });
        context.restore();
      }
      label(context, 'BRAIN ROT!', CX, 120, 40, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 9,
      });
    }

    if (this.phase === 'won') {
      context.fillStyle = 'rgba(12, 18, 32, 0.45)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      label(context, this.forced ? 'MOM UNPLUGGED IT' : 'BRAIN CELLS: INTACT', CX, 236, 34, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 8,
      });
      label(
        context,
        this.forced ? 'The router is in the freezer now.' : 'Everyone looked at a wall. It was fine.',
        CX,
        278,
        16,
        { color: '#fff8e7', align: 'center', strokeWidth: 3 }
      );
    }
  }

  draw(context) {
    if (this.shake > 0) {
      context.save();
      context.translate(rand(-8, 8) * this.shake, rand(-5, 5) * this.shake);
    }
    this.drawScene(context);
    if (this.shake > 0) context.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 4 — The Pickle Bandit                                       */
/* ------------------------------------------------------------------ */

const PICKLE_COUNT = 8;
const JAR_BOUNDS = { minX: 205, maxX: 755, minY: 382, maxY: 438 };

function drawPickle(context, x, y, s = 1, angle = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(s, s);
  context.lineJoin = 'round';
  context.fillStyle = '#6aa83f';
  context.strokeStyle = '#31582b';
  context.lineWidth = 2;
  context.beginPath();
  roundRectPath(context, -8, -20, 16, 38, 7);
  context.fill();
  context.stroke();
  context.fillStyle = '#8bc95b';
  for (let i = 0; i < 3; i += 1) {
    context.beginPath();
    context.arc(i % 2 === 0 ? -3 : 3, -12 + i * 9, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = '#b9e07b';
  context.beginPath();
  context.arc(0, -21, 4, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawPickleJar(context, jar, pickles, t, hint) {
  const wobble = Math.sin(t * 24) * 0.018 + jar.wobble * Math.sin(t * 38) * 0.045;
  context.save();
  context.translate(jar.x, jar.y);
  context.rotate(wobble);

  /* shadow on the tablecloth */
  context.fillStyle = 'rgba(30, 20, 30, 0.2)';
  context.beginPath();
  context.ellipse(0, 4, 54, 13, 0, 0, Math.PI * 2);
  context.fill();

  /* glass jar */
  const jarBody = () => {
    context.beginPath();
    roundRectPath(context, -48, -106, 96, 108, 23);
  };
  context.fillStyle = 'rgba(205, 236, 219, 0.34)';
  jarBody();
  context.fill();
  context.strokeStyle = '#527a58';
  context.lineWidth = 4;
  context.stroke();

  context.save();
  jarBody();
  context.clip();
  context.fillStyle = 'rgba(188, 224, 150, 0.35)';
  context.fillRect(-48, -84, 96, 86);

  const pickleSpots = [
    [-30, -84, -0.18],
    [-10, -88, 0.08],
    [10, -86, -0.12],
    [30, -82, 0.22],
    [-27, -64, 0.12],
    [-8, -68, -0.15],
    [13, -65, 0.15],
    [31, -59, -0.2],
  ];
  for (let i = 0; i < Math.min(pickles, pickleSpots.length); i += 1) {
    drawPickle(context, pickleSpots[i][0], pickleSpots[i][1], 0.9, pickleSpots[i][2]);
  }

  /* brine line and a few bubbles */
  context.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-38, -94);
  context.quadraticCurveTo(-22, -88, -4, -94);
  context.stroke();
  context.fillStyle = 'rgba(232, 247, 221, 0.6)';
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    context.arc(-32 + i * 16, -78 + (i % 3) * 24, 2 + (i % 2), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  /* glass shine */
  context.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-33, -93);
  context.quadraticCurveTo(-45, -52, -31, -15);
  context.stroke();

  /* lid */
  context.fillStyle = '#d94b4b';
  context.strokeStyle = '#5b2b2b';
  context.lineWidth = 3;
  context.beginPath();
  roundRectPath(context, -53, -124, 106, 22, 8);
  context.fill();
  context.stroke();
  context.fillStyle = '#f5b44d';
  context.beginPath();
  roundRectPath(context, -56, -105, 112, 9, 4);
  context.fill();
  context.stroke();

  /* label */
  context.fillStyle = '#fff3d1';
  context.strokeStyle = '#b08a58';
  context.lineWidth = 2;
  context.beginPath();
  roundRectPath(context, -41, -53, 82, 43, 5);
  context.fill();
  context.stroke();
  label(context, "GRANDMA'S", 0, -42, 9, {
    color: '#7a2f2f',
    align: 'center',
    strokeWidth: 0,
  });
  label(context, 'PICKLES', 0, -28, 11, {
    color: '#7a2f2f',
    align: 'center',
    strokeWidth: 0,
  });
  drawPickle(context, 0, -16, 0.35, 0.1);
  context.restore();

  if (hint) {
    context.save();
    context.setLineDash([9, 8]);
    context.strokeStyle = 'rgba(255, 248, 231, 0.9)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(jar.x, jar.y - 55, 76, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}

function drawBanditMask(context, x, y, s) {
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.fillStyle = '#211a2c';
  context.strokeStyle = '#211a2c';
  context.beginPath();
  roundRectPath(context, -19, -85, 38, 12, 4);
  context.fill();
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(17, -82);
  context.lineTo(27, -89);
  context.moveTo(27, -89);
  context.lineTo(25, -78);
  context.stroke();
  context.fillStyle = '#fff8e7';
  context.beginPath();
  context.ellipse(-6, -79, 4.2, 2.5, 0, 0, Math.PI * 2);
  context.ellipse(6, -79, 4.2, 2.5, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#211a2c';
  context.beginPath();
  context.arc(-6, -79, 1.5, 0, Math.PI * 2);
  context.arc(6, -79, 1.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPickleSack(context, x, y, s = 1) {
  context.save();
  context.translate(x, y);
  context.scale(s, s);
  context.fillStyle = '#c99a5d';
  context.strokeStyle = '#6f4a2b';
  context.lineWidth = 3;
  context.beginPath();
  roundRectPath(context, -18, -22, 36, 42, 10);
  context.fill();
  context.stroke();
  context.fillStyle = '#b0804c';
  context.beginPath();
  context.moveTo(-18, -9);
  context.quadraticCurveTo(0, -1, 18, -9);
  context.lineTo(18, 2);
  context.quadraticCurveTo(0, 10, -18, 2);
  context.closePath();
  context.fill();
  label(context, 'PICKLES', 0, -4, 7, {
    color: '#4b2e1a',
    align: 'center',
    strokeWidth: 0,
  });
  drawPickle(context, 0, -25, 0.5, 0.4);
  context.restore();
}

export class PickleBandit {
  constructor(onDone) {
    this.onDone = onDone;
    this.done = false;
    this.t = 0;
    this.phase = 'start';
    this.startTimer = 1.5;
    this.elapsed = 0;
    this.duration = 30;
    this.remaining = this.duration;
    this.pickles = PICKLE_COUNT;
    this.totalPickles = PICKLE_COUNT;
    this.stolen = 0;
    this.dodges = 0;
    this.dodgePoints = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.jar = { x: CX, y: 410, targetX: CX, targetY: 410, wobble: 0 };
    this.cj = {
      x: CX,
      y: 338,
      startX: CX,
      targetX: CX,
      targetY: 356,
      phase: 'wait',
      timer: 1.2,
      windup: 0,
      windupDur: 0.82,
      lungeT: 0,
    };
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.hasDragged = false;
    this.hintTimer = 9;
    this.popups = [];
    this.taunt = { text: 'Those pickles are practically begging to be liberated.', timer: 3.6 };
    this.wonTimer = 0;
    this.finishedEmpty = false;
    this.shake = 0;
    this.warned = false;
    this.lastSecond = this.duration;
  }

  say(text, timer = 2.4) {
    this.taunt = { text, timer };
  }

  popup(x, y, text, color = '#ffd166') {
    this.popups.push({ x, y, text, color, t: 0.9 });
  }

  startWindup() {
    const cj = this.cj;
    cj.targetX = this.jar.x;
    cj.targetY = this.jar.y - 55;
    cj.startX = cj.x;
    cj.windupDur = clamp(0.88 - this.elapsed * 0.006, 0.66, 0.88);
    cj.windup = cj.windupDur;
    cj.phase = 'windup';
    this.say(pick(['MINE.', 'Pickle delivery!', 'That jar is mine.']), 1.1);
    sfx.whoosh();
  }

  steal(x, y) {
    this.pickles = Math.max(0, this.pickles - 1);
    this.stolen += 1;
    this.combo = 0;
    this.jar.wobble = 1;
    this.shake = 0.35;
    this.cj.phase = 'retreat';
    this.cj.timer = 1.05;
    this.popup(x, y - 38, 'YOINK!', '#ff8a8a');
    this.say(pick(['YOINK!', 'Mine now.', 'Thank you for the pickles.']), 1.8);
    sfx.pop();
    sfx.slide();
    burst(x, y, {
      count: 16,
      colors: ['#6aa83f', '#8bc95b', '#ffd166'],
      speed: 190,
      size: 7,
      gravity: 440,
      shape: 'square',
    });
  }

  dodge(x, y) {
    this.dodges += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = 20 + this.combo * 5;
    this.dodgePoints += points;
    this.cj.phase = 'retreat';
    this.cj.timer = 0.95;
    this.popup(x, y - 38, `DODGED +${points}`, '#a7f3c8');
    this.say(pick(['Lucky.', 'You moved the jar. No fair.', 'I was not ready.']), 1.4);
    sfx.ding();
    burst(x, y, {
      count: 14,
      colors: ['#ffffff', '#dff2ff', '#ffd166'],
      speed: 210,
      size: 8,
      gravity: 400,
    });
  }

  finish(empty) {
    if (this.phase === 'won') return;
    this.phase = 'won';
    this.finishedEmpty = empty;
    this.wonTimer = 1.9;
    this.cj.phase = 'celebrate';
    this.cj.x = CX;
    this.dragging = false;
    if (empty) {
      this.say('Every last pickle. A masterpiece.', 2);
      sfx.pop();
    } else {
      this.say('Fine. Keep your pickles.', 2);
      sfx.success();
    }
    burst(CX, 250, {
      count: 40,
      colors: ['#6aa83f', '#8bc95b', '#ffd166', '#ffffff'],
      speed: 330,
      size: 8,
      gravity: 460,
    });
  }

  buildResult() {
    const clean = this.stolen === 0;
    const score = 240 + this.pickles * 80 + this.dodgePoints + (clean ? 220 : 0);
    const title = clean
      ? 'The pickles are safe!'
      : this.pickles > 0
        ? 'The pickle bandit got some'
        : 'CJ cleaned out the jar';
    const text = clean
      ? "CJ made a run for Grandma's pickles and got exactly zero. He says he was just checking the brine."
      : this.pickles > 0
        ? `CJ made off with ${this.stolen} pickle${this.stolen === 1 ? '' : 's'}. Aunt Pat has a backup jar and a very serious new lock.`
        : 'CJ got every last pickle. Aunt Pat is bringing out a backup jar and a very serious new lock.';
    return {
      score,
      title,
      text,
      note: `${this.pickles}/${this.totalPickles} pickles saved · ${this.dodges} dodge${this.dodges === 1 ? '' : 's'}${clean ? ' · clean jar!' : ''}`,
      stats: [
        ['Pickles saved', `${this.pickles}/${this.totalPickles}`],
        ['Dodges', this.dodges],
      ],
    };
  }

  updateJar(dt) {
    const jar = this.jar;
    let kx = 0;
    let ky = 0;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) kx -= 1;
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) kx += 1;
    if (input.isDown('ArrowUp') || input.isDown('KeyW')) ky -= 1;
    if (input.isDown('ArrowDown') || input.isDown('KeyS')) ky += 1;
    if (kx !== 0 || ky !== 0) {
      jar.targetX = clamp(jar.targetX + kx * 440 * dt, JAR_BOUNDS.minX, JAR_BOUNDS.maxX);
      jar.targetY = clamp(jar.targetY + ky * 300 * dt, JAR_BOUNDS.minY, JAR_BOUNDS.maxY);
    }

    if (input.pressed) {
      this.dragging = true;
      this.hasDragged = true;
      this.dragOffsetX = jar.x - input.x;
      this.dragOffsetY = jar.y - input.y;
    }
    if (this.dragging && input.down) {
      jar.targetX = clamp(input.x + this.dragOffsetX, JAR_BOUNDS.minX, JAR_BOUNDS.maxX);
      jar.targetY = clamp(input.y + this.dragOffsetY, JAR_BOUNDS.minY, JAR_BOUNDS.maxY);
    }
    if (!input.down) this.dragging = false;

    const follow = 1 - Math.exp(-13 * dt);
    jar.x = lerp(jar.x, jar.targetX, follow);
    jar.y = lerp(jar.y, jar.targetY, follow);
  }

  updateCj(dt) {
    const cj = this.cj;

    if (cj.phase === 'wait' || cj.phase === 'stalk') {
      const spot = clamp(this.jar.x + (this.jar.x < CX ? 82 : -82), 180, 780);
      cj.x = lerp(cj.x, spot, 1 - Math.exp(-2.4 * dt));
      cj.timer -= dt;
      if (cj.phase === 'wait' && cj.timer <= 0) {
        cj.phase = 'stalk';
        cj.timer = 1.1;
      } else if (cj.phase === 'stalk' && cj.timer <= 0) {
        this.startWindup();
      }
      return;
    }

    if (cj.phase === 'windup') {
      cj.windup -= dt;
      if (cj.windup <= 0) {
        cj.phase = 'lunge';
        cj.lungeT = 0;
        sfx.whoosh();
      }
      return;
    }

    if (cj.phase === 'lunge') {
      cj.lungeT = Math.min(1, cj.lungeT + dt / 0.32);
      const eased = easeOut(cj.lungeT);
      cj.x = lerp(cj.startX, cj.targetX, eased);
      if (cj.lungeT >= 1) {
        const jarCenterX = this.jar.x;
        const jarCenterY = this.jar.y - 55;
        if (distance(jarCenterX, jarCenterY, cj.targetX, cj.targetY) < 84) {
          this.steal(cj.targetX, cj.targetY);
        } else {
          this.dodge(cj.targetX, cj.targetY);
        }
      }
      return;
    }

    if (cj.phase === 'retreat') {
      cj.timer -= dt;
      cj.x = lerp(cj.x, CX, 1 - Math.exp(-3.2 * dt));
      if (cj.timer <= 0) {
        cj.phase = 'stalk';
        cj.timer = rand(0.95, 1.45);
      }
    }
  }

  update(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.jar.wobble = Math.max(0, this.jar.wobble - dt * 2.5);
    if (this.taunt.timer > 0) this.taunt.timer -= dt;
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      this.popups[i].t -= dt;
      if (this.popups[i].t <= 0) this.popups.splice(i, 1);
    }

    if (this.phase === 'won') {
      this.wonTimer -= dt;
      this.jar.x = lerp(this.jar.x, this.jar.targetX, 1 - Math.exp(-6 * dt));
      this.jar.y = lerp(this.jar.y, this.jar.targetY, 1 - Math.exp(-6 * dt));
      if (this.wonTimer <= 0 && !this.done) {
        this.done = true;
        this.onDone(this.buildResult());
      }
      return;
    }

    if (this.phase === 'start') {
      this.startTimer -= dt;
      if (this.startTimer <= 0) {
        this.phase = 'play';
        this.cj.phase = 'stalk';
        this.cj.timer = 1.05;
      }
      return;
    }

    this.elapsed += dt;
    this.remaining = Math.max(0, this.duration - this.elapsed);
    this.hintTimer = Math.max(0, this.hintTimer - dt);

    if (!this.warned && this.remaining <= 10) {
      this.warned = true;
      this.say('Ten seconds. The pickles are MINE.', 2.2);
    }
    if (this.remaining <= 5) {
      const second = Math.ceil(this.remaining);
      if (second !== this.lastSecond) {
        this.lastSecond = second;
        sfx.tick();
      }
    }

    this.updateJar(dt);
    this.updateCj(dt);

    if (this.pickles <= 0) {
      this.finish(true);
      return;
    }
    if (this.remaining <= 0) {
      this.finish(false);
    }
  }

  drawCj(context) {
    const cj = this.cj;
    const celebrating = cj.phase === 'celebrate';
    const face = celebrating ? 'grin' : cj.phase === 'windup' || cj.phase === 'lunge' ? 'grin' : 'happy';
    const armPose = celebrating || cj.phase === 'windup' ? 'up' : 'down';
    drawPerson(context, cj.x, cj.y, 1.18, {
      ...PEOPLE.cj,
      face,
      armPose,
    });
    drawBanditMask(context, cj.x, cj.y, 1.18);
    if (this.stolen > 0) {
      drawPickleSack(context, cj.x + 48, cj.y - 55, 0.8);
    }
    if (this.taunt.timer > 0 && this.phase !== 'start') {
      bubble(context, cj.x, cj.y - 126, this.taunt.text, {
        size: 14,
        maxWidth: 240,
        alpha: clamp(this.taunt.timer * 1.5, 0, 1),
      });
    }
  }

  drawTable(context) {
    context.save();
    context.fillStyle = 'rgba(20, 30, 20, 0.15)';
    context.beginPath();
    context.ellipse(CX, 508, 380, 28, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#f4e2bd';
    context.strokeStyle = '#6b4423';
    context.lineWidth = 5;
    context.beginPath();
    roundRectPath(context, 76, 342, 808, 132, 20);
    context.fill();

    context.save();
    context.beginPath();
    roundRectPath(context, 76, 342, 808, 132, 20);
    context.clip();
    context.fillStyle = 'rgba(203, 73, 73, 0.22)';
    for (let x = 96; x < 884; x += 80) context.fillRect(x, 342, 26, 132);
    for (let y = 356; y < 474; y += 54) context.fillRect(76, y, 808, 18);
    context.restore();
    context.beginPath();
    roundRectPath(context, 76, 342, 808, 132, 20);
    context.stroke();

    context.fillStyle = '#c48750';
    context.beginPath();
    roundRectPath(context, 96, 464, 768, 34, 9);
    context.fill();
    context.stroke();

    context.fillStyle = '#7a4b2a';
    context.fillRect(148, 498, 28, 42);
    context.fillRect(784, 498, 28, 42);
    context.strokeRect(148, 498, 28, 42);
    context.strokeRect(784, 498, 28, 42);

    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.fillRect(92, 350, 776, 8);
    context.restore();
  }

  drawTarget(context) {
    const cj = this.cj;
    context.save();
    context.fillStyle = 'rgba(238, 74, 74, 0.14)';
    context.beginPath();
    context.arc(cj.targetX, cj.targetY, 84, 0, Math.PI * 2);
    context.fill();
    context.setLineDash([12, 8]);
    context.lineDashOffset = -this.t * 70;
    context.strokeStyle = '#ff6b6b';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(cj.targetX, cj.targetY, 84, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    if (cj.phase === 'windup') {
      const progress = 1 - clamp(cj.windup / cj.windupDur, 0, 1);
      context.strokeStyle = '#ffd166';
      context.lineWidth = 7;
      context.beginPath();
      context.arc(cj.targetX, cj.targetY, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      context.stroke();
    }
    label(context, '!', cj.targetX, cj.targetY - 108, 26, {
      color: '#ff8a8a',
      align: 'center',
      strokeWidth: 6,
    });
    context.restore();
  }

  drawArm(context) {
    const cj = this.cj;
    const eased = easeOut(cj.lungeT);
    const handX = lerp(cj.startX, cj.targetX, eased);
    const handY = lerp(cj.y - 55, cj.targetY, eased);
    context.save();
    context.strokeStyle = '#1d4ed8';
    context.lineWidth = 13;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(cj.x + (handX > cj.x ? 20 : -20), cj.y - 58);
    context.lineTo(handX, handY);
    context.stroke();
    context.fillStyle = '#f2c9a0';
    context.strokeStyle = '#26223d';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(handX, handY, 10, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  drawScene(context) {
    sky(context, '#9dcbea', '#eef9ff');

    const sun = context.createRadialGradient(790, 105, 8, 790, 105, 100);
    sun.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
    sun.addColorStop(1, 'rgba(255, 250, 220, 0)');
    context.fillStyle = sun;
    context.fillRect(650, 0, 280, 260);

    context.fillStyle = '#dcecf6';
    context.beginPath();
    context.moveTo(0, 330);
    context.quadraticCurveTo(180, 270, 350, 324);
    context.quadraticCurveTo(560, 384, 760, 300);
    context.quadraticCurveTo(890, 260, 960, 318);
    context.lineTo(960, 540);
    context.lineTo(0, 540);
    context.closePath();
    context.fill();

    drawPine(context, 70, 360, 165);
    drawPine(context, 138, 380, 115);
    drawPine(context, 902, 350, 180);
    drawPine(context, 838, 372, 118);
    drawHouse(context, 168, 350, 0.54, { t: this.t });
    snowGround(context, 370);

    this.drawCj(context);
    drawPerson(context, 100, 346, 0.95, {
      ...PEOPLE.auntpat,
      face: this.phase === 'won' ? 'happy' : 'worried',
      armPose: 'up',
    });

    this.drawTable(context);

    if (this.cj.phase === 'windup' || (this.cj.phase === 'lunge' && this.cj.lungeT < 1)) {
      this.drawTarget(context);
    }

    drawPickleJar(context, this.jar, this.pickles, this.t, !this.hasDragged);

    if (this.cj.phase === 'lunge') this.drawArm(context);

    drawPerson(context, 130, 530, 0.78, {
      ...PEOPLE.jira,
      face: this.phase === 'won' ? 'happy' : 'worried',
      armPose: 'up',
    });
    drawPerson(context, 900, 534, 0.78, {
      ...PEOPLE.joel,
      face: this.phase === 'won' ? 'grin' : 'shock',
      armPose: 'up',
    });

    for (const popup of this.popups) {
      const alpha = clamp(popup.t / 0.9, 0, 1);
      label(context, popup.text, popup.x, popup.y - (1 - alpha) * 24, 18, {
        color: popup.color,
        align: 'center',
        strokeWidth: 6,
        alpha,
      });
    }

    if (this.cj.phase === 'windup') {
      label(context, 'CJ IS GOING FOR IT!', CX, 126, 20, {
        color: '#ffd166',
        align: 'center',
        strokeWidth: 6,
      });
    }

    if (this.phase === 'start') {
      label(context, 'GET READY...', CX, 166, 26, {
        color: '#fff8e7',
        align: 'center',
        strokeWidth: 7,
      });
    }

    if (this.hintTimer > 0 && !this.hasDragged) {
      context.fillStyle = 'rgba(16, 22, 42, 0.66)';
      context.beginPath();
      roundRectPath(context, 276, 500, 408, 30, 15);
      context.fill();
      label(context, 'DRAG THE JAR AWAY FROM CJ', CX, 516, 12, {
        color: '#eaf6ff',
        align: 'center',
        strokeWidth: 0,
      });
    }

    drawSnow(context, 1, Math.sin(this.t * 0.7) * 16);
  }

  drawHud(context) {
    topPanel(context, 24, 16, 912, 82);

    label(context, "GRANDMA'S PICKLES", 46, 36, 11, { color: '#ffd166' });
    for (let i = 0; i < this.totalPickles; i += 1) {
      context.save();
      context.globalAlpha = i < this.pickles ? 1 : 0.22;
      drawPickle(context, 50 + i * 19, 62, 0.3, -0.2);
      context.restore();
    }
    label(context, `${this.pickles}`, 46 + this.totalPickles * 19 + 2, 62, 16, {
      color: '#fff8e7',
      strokeWidth: 3,
    });

    label(context, 'TIME LEFT', CX, 34, 10, {
      color: '#bcd7e8',
      align: 'center',
      strokeWidth: 0,
    });
    const seconds = Math.ceil(this.remaining);
    label(
      context,
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      CX,
      62,
      26,
      {
        color: seconds <= 5 && this.phase === 'play' ? '#ff8a8a' : '#fff8e7',
        align: 'center',
        strokeWidth: 4,
      }
    );

    label(context, 'DODGES', 916, 34, 10, {
      color: '#bcd7e8',
      align: 'right',
      strokeWidth: 0,
    });
    label(context, `${this.dodges}`, 916, 60, 24, {
      color: '#ffd166',
      align: 'right',
      strokeWidth: 4,
    });
    if (this.combo > 1) {
      label(context, `STREAK x${this.combo}`, 916, 80, 10, {
        color: '#a7f3c8',
        align: 'right',
        strokeWidth: 0,
      });
    }
  }

  draw(context) {
    if (this.shake > 0) {
      context.save();
      context.translate(rand(-6, 6) * this.shake * 2, rand(-4, 4) * this.shake * 2);
      this.drawScene(context);
      context.restore();
    } else {
      this.drawScene(context);
    }
    this.drawHud(context);
  }
}

/* ------------------------------------------------------------------ */
/* Chapter registry                                                    */
/* ------------------------------------------------------------------ */

export const chapters = [
  {
    id: 'biscuit-run',
    label: 'The Biscuit Run',
    phoneLabel: 'Biscuits',
    make: (done) => new BiscuitRun(done),
  },
  {
    id: 'turkey-situation',
    label: 'The Turkey Situation',
    phoneLabel: 'Turkey',
    make: (done) => new TurkeyCook(done),
  },
  {
    id: 'snowball-war',
    label: "The Cousins' Snowball War",
    phoneLabel: 'Snowballs',
    make: (done) => new SnowballFight(done),
  },
  {
    id: 'pickle-bandit',
    label: 'The Pickle Bandit',
    phoneLabel: 'Pickle Heist',
    make: (done) => new PickleBandit(done),
  },
  {
    id: 'penguin-slides',
    label: 'Penguin Slides',
    phoneLabel: 'Penguins',
    make: (done) => new PenguinSlides(done),
  },
  {
    id: 'brain-rot',
    label: 'Brain Rot Battle',
    phoneLabel: 'Brain Rot',
    make: (done) => new BrainRot(done),
  },
];
