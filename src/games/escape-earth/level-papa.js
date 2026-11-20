import { TAU, clamp, lerp, rand, drawText, ellipse, roundRect } from './util.js';

/* ------------------------------------------------------------------ *
 * Level 4 — Wrestle Papa
 * The rug is the ring, the couch is out of bounds, and Papa has been
 * waiting his whole life for this. Mash left and right to shove him
 * back; brace when he winds up.
 * ------------------------------------------------------------------ */

const WINS_NEEDED = 2;

const TAUNTS = [
  'Papa says this is for your posture.',
  'Papa is not even out of breath.',
  '"I wrestled a bear once," says Papa, who did not.',
  'Papa has taken his glasses off. This is serious.',
  'Papa is doing the thing with his neck.',
];

const GOOD_BRACE = [
  'Papa overbalanced! Shove him!',
  'Papa is wobbling! Push!',
  'He missed! Get him!',
];

const BAD_SHOVE = ['OOF!', 'The rug took the hit.', 'You saw stars. Papa saw victory.'];

export function createPapaLevel({ sound, say = () => {}, onWin, onLose }) {
  let S;

  const reset = () => {
    S = {
      pos: 0,
      youFalls: 0,
      papaFalls: 0,
      time: 0,
      ended: false,
      brace: false,
      lastSide: null,
      prevLeft: false,
      prevRight: false,
      prevPointer: false,
      papa: { state: 'push', timer: 2.6, lean: 0 },
      fingerCooldown: rand(7, 11),
      prevAction: false,
      pressCooldown: 0,
      puffs: [],
      flash: 0,
      shake: 0,
      tauntTimer: 3.2,
    };
  };

  reset();

  const difficulty = () => 1 + S.papaFalls * 0.16 + S.youFalls * 0.08;

  const puff = (x, y, count = 4) => {
    for (let i = 0; i < count; i += 1) {
      S.puffs.push({
        x,
        y,
        vx: rand(-40, 40),
        vy: rand(-70, -20),
        life: rand(0.3, 0.7),
        size: rand(3, 8),
      });
    }
    if (S.puffs.length > 90) S.puffs.splice(0, S.puffs.length - 90);
  };

  const push = (side, x, y) => {
    if (S.pressCooldown > 0) return;
    S.pressCooldown = 0.12;
    const switching = S.lastSide !== null && S.lastSide !== side;
    const amount = switching ? 0.05 : 0.015;
    S.lastSide = side;
    S.pos = clamp(S.pos + amount, -1, 1);
    sound.blip(switching ? 780 : 520);
    puff(x, y, switching ? 4 : 2);
  };

  const awardFall = (toPlayer) => {
    if (toPlayer) {
      S.youFalls += 1;
      S.pos = 0;
      sound.powerup();
      S.papa.state = 'push';
      S.papa.timer = 2.4;
      if (S.youFalls >= WINS_NEEDED && !S.ended) {
        S.ended = true;
        sound.win();
        onWin({
          title: 'You wrestled Papa',
          text: 'Papa is flat on the rug, laughing too hard to get up. "Best two out of three," he says, and then immediately falls asleep. The front door is yours.',
          stats: [
            ['Falls', `${S.youFalls} – ${S.papaFalls}`],
            ['Match time', `${Math.floor(S.time)} s`],
          ],
          points: 600 + (WINS_NEEDED * 2 - S.papaFalls) * 200 + Math.max(0, 120 - Math.floor(S.time)) * 3,
        });
      } else {
        say('Papa is down! One more fall and the door is yours.', 2.2);
      }
      return;
    }

    S.papaFalls += 1;
    S.pos = 0;
    S.papa.state = 'push';
    S.papa.timer = 2.2;
    S.flash = 0.45;
    S.shake = 0.5;
    sound.yell();
    if (S.papaFalls >= WINS_NEEDED && !S.ended) {
      S.ended = true;
      sound.lose();
      onLose({
        title: 'Papa wins',
        text: 'You land in the laundry basket. Papa helps you out, pats your head, and puts the remote on top of the fridge. Grandma is thrilled.',
        stats: [
          ['Falls', `${S.youFalls} – ${S.papaFalls}`],
          ['Match time', `${Math.floor(S.time)} s`],
        ],
        points: S.youFalls * 150,
      });
    } else {
      say('Papa got a fall. You are in the laundry basket.', 2.2);
    }
  };

  const update = (dt, input, view) => {
    if (S.ended) return;
    S.time += dt;
    S.flash = Math.max(0, S.flash - dt);
    S.shake = Math.max(0, S.shake - dt);
    S.pressCooldown = Math.max(0, S.pressCooldown - dt);
    S.tauntTimer -= dt;

    if (S.tauntTimer <= 0) {
      S.tauntTimer = rand(6, 10);
      say(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], 2);
    }

    for (const particle of S.puffs) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 160 * dt;
    }
    S.puffs = S.puffs.filter((particle) => particle.life > 0);

    const keys = input.keys;
    const pointer = input.pointer;
    const brace = Boolean(keys && (keys.has('Space') || keys.has('ArrowDown') || keys.has('KeyS')));
    S.brace = brace;

    /* one fresh press is all it takes to pull the finger. Naturally, you will. */
    const action = brace || Boolean(keys && keys.has('KeyE')) || pointer.down;
    const actionEdge = action && !S.prevAction;
    S.prevAction = action;
    S.fingerCooldown = Math.max(0, S.fingerCooldown - dt);

    const leftDown = Boolean(keys && (keys.has('ArrowLeft') || keys.has('KeyA')));
    const rightDown = Boolean(keys && (keys.has('ArrowRight') || keys.has('KeyD')));
    const pointerLeft = pointer.down && pointer.x < view.w * 0.5;
    const pointerRight = pointer.down && pointer.x >= view.w * 0.5;

    const leftEdge = (leftDown && !S.prevLeft) || (pointerLeft && !S.prevPointer);
    const rightEdge = (rightDown && !S.prevRight) || (pointerRight && !S.prevPointer);

    S.prevLeft = leftDown || pointerLeft;
    S.prevRight = rightDown || pointerRight;
    S.prevPointer = pointer.down;

    if (!brace) {
      const floorY = view.h * 0.86;
      if (leftEdge) push('left', view.w * 0.4, floorY - 60);
      if (rightEdge) push('right', view.w * 0.5, floorY - 60);
    }

    const diff = difficulty();
    S.papa.timer -= dt;

    if (S.papa.state === 'push') {
      S.pos = clamp(S.pos - dt * 0.16 * diff * (brace ? 0.25 : 1), -1, 1);
      if (S.papa.timer <= 0) {
        S.papa.state = 'windup';
        S.papa.timer = 0.9 / diff;
        sound.tick();
      } else if (S.fingerCooldown <= 0) {
        S.papa.state = 'finger';
        S.papa.timer = 1.7;
        sound.boing();
        say('Papa is offering a finger. He says it is a family tradition.', 2);
      }
    } else if (S.papa.state === 'finger') {
      if (actionEdge) {
        S.papa.state = 'fart';
        S.papa.timer = 1.3;
        S.pos = clamp(S.pos - 0.38, -1, 1);
        S.shake = 0.7;
        S.flash = 0.35;
        S.fingerCooldown = rand(12, 18);
        sound.fart();
        say('PFFFT. You were warned. Sort of.', 2);
      } else if (S.papa.timer <= 0) {
        S.papa.state = 'letdown';
        S.papa.timer = 0.9;
        S.pos = clamp(S.pos + 0.08, -1, 1);
        S.fingerCooldown = rand(12, 18);
        say('Papa is disappointed. His grip loosens a little.', 1.8);
      }
    } else if (S.papa.state === 'fart') {
      if (S.papa.timer <= 0) {
        S.papa.state = 'push';
        S.papa.timer = rand(1.8, 2.6) / diff;
      }
    } else if (S.papa.state === 'letdown') {
      if (S.papa.timer <= 0) {
        S.papa.state = 'push';
        S.papa.timer = rand(2, 3) / diff;
      }
    } else if (S.papa.state === 'windup') {
      if (S.papa.timer <= 0) {
        if (brace) {
          S.papa.state = 'stumble';
          S.papa.timer = 0.95;
          S.pos = clamp(S.pos + 0.18, -1, 1);
          sound.boing();
          say(GOOD_BRACE[Math.floor(Math.random() * GOOD_BRACE.length)], 1.6);
        } else {
          S.pos = clamp(S.pos - 0.34 * diff, -1, 1);
          S.papa.state = 'push';
          S.papa.timer = rand(2.2, 3.2) / diff;
          S.flash = 0.4;
          S.shake = 0.45;
          sound.yell();
          say(BAD_SHOVE[Math.floor(Math.random() * BAD_SHOVE.length)], 1.4);
        }
      }
    } else if (S.papa.timer <= 0) {
      S.papa.state = 'push';
      S.papa.timer = rand(2.1, 3.1) / diff;
    }

    const leanTarget =
      S.papa.state === 'windup'
        ? -0.32
        : S.papa.state === 'stumble'
          ? 0.26
          : S.papa.state === 'fart'
            ? -0.2
            : S.papa.state === 'finger'
              ? 0.14
              : 0.05 - S.pos * 0.05;
    S.papa.lean = lerp(S.papa.lean, leanTarget, Math.min(1, dt * 8));

    if (S.pos >= 1) awardFall(true);
    if (S.pos <= -1) awardFall(false);
  };

  const hud = () => ({
    stats: [
      ['Falls', `You ${S.youFalls} – ${S.papaFalls} Papa`],
      ['Push', `${Math.round(clamp((S.pos + 1) / 2, 0, 1) * 100)}%`],
      [
        'Papa',
        S.papa.state === 'windup'
          ? 'Winding up!'
          : S.papa.state === 'stumble'
            ? 'Wobbling!'
            : S.papa.state === 'finger'
              ? 'Offering a finger!'
              : S.papa.state === 'fart'
                ? 'PFFFT!'
                : S.papa.state === 'letdown'
                  ? 'Disappointed'
                  : 'Pushing',
      ],
    ],
  });

  const drawPapa = (ctx, x, floorY, s, time) => {
    const lean = S.papa.lean;
    ctx.save();
    ctx.translate(x, floorY);
    ctx.rotate(lean * 0.16);

    /* shadow */
    ctx.fillStyle = 'rgba(5, 2, 12, 0.35)';
    ellipse(ctx, 0, 4 * s, 64 * s, 15 * s);
    ctx.fill();

    /* legs and shorts */
    ctx.fillStyle = '#f2c9a0';
    roundRect(ctx, -30 * s, -62 * s, 24 * s, 62 * s, 8 * s);
    ctx.fill();
    roundRect(ctx, 8 * s, -62 * s, 24 * s, 62 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = '#2b3a70';
    roundRect(ctx, -38 * s, -86 * s, 78 * s, 40 * s, 10 * s);
    ctx.fill();

    /* belly and tank top */
    ctx.fillStyle = '#f2c9a0';
    ellipse(ctx, 0, -112 * s, 56 * s, 48 * s);
    ctx.fill();
    ctx.fillStyle = '#f7f1e4';
    roundRect(ctx, -50 * s, -150 * s, 100 * s, 66 * s, 18 * s);
    ctx.fill();
    ctx.fillStyle = '#e8e2f5';
    ellipse(ctx, 0, -98 * s, 34 * s, 26 * s);
    ctx.fill();

    /* arms reaching forward at the kid (one of them may be offering a finger) */
    const offering = S.papa.state === 'finger';
    const armY = S.papa.state === 'windup' ? -152 * s : offering ? -132 * s : -118 * s;
    const handX = S.papa.state === 'windup' ? -66 * s : offering ? -118 * s : -92 * s;
    ctx.strokeStyle = '#f2c9a0';
    ctx.lineWidth = 20 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-44 * s, -138 * s);
    ctx.lineTo(handX * 0.6, armY);
    ctx.lineTo(handX, armY + 10 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(44 * s, -138 * s);
    ctx.lineTo(handX * 0.4, armY + 22 * s);
    ctx.lineTo(handX + 6 * s, armY + 26 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    if (offering) {
      ctx.fillStyle = '#f2c9a0';
      ellipse(ctx, handX, armY + 10 * s, 13 * s, 11 * s);
      ctx.fill();
      ctx.strokeStyle = '#f2c9a0';
      ctx.lineWidth = 7 * s;
      ctx.lineCap = 'round';
      const wag = Math.sin(time * 8) * 6 * s;
      ctx.beginPath();
      ctx.moveTo(handX - 4 * s, armY + 10 * s);
      ctx.lineTo(handX - 26 * s, armY + 4 * s + wag);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    /* head */
    const headY = -182 * s;
    ctx.fillStyle = '#f2c9a0';
    ellipse(ctx, 0, headY, 32 * s, 31 * s);
    ctx.fill();

    /* hair on the sides only */
    ctx.fillStyle = '#8a8a96';
    ellipse(ctx, -30 * s, headY + 2 * s, 7 * s, 13 * s);
    ctx.fill();
    ellipse(ctx, 30 * s, headY + 2 * s, 7 * s, 13 * s);
    ctx.fill();

    /* eyebrows and eyes */
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    const strain = S.papa.state === 'windup' ? 1.4 : 1;
    ctx.moveTo(-22 * s, headY - 12 * s);
    ctx.lineTo(-6 * s, headY - 8 * s * strain);
    ctx.moveTo(22 * s, headY - 12 * s);
    ctx.lineTo(6 * s, headY - 8 * s * strain);
    ctx.stroke();

    ctx.fillStyle = '#1a0a12';
    ellipse(ctx, -13 * s, headY - 3 * s, 3.4 * s, 4 * s);
    ctx.fill();
    ellipse(ctx, 13 * s, headY - 3 * s, 3.4 * s, 4 * s);
    ctx.fill();

    /* moustache */
    ctx.fillStyle = '#8a8a96';
    ctx.beginPath();
    ctx.moveTo(-19 * s, headY + 12 * s);
    ctx.quadraticCurveTo(0, headY + 22 * s, 19 * s, headY + 12 * s);
    ctx.quadraticCurveTo(0, headY + 16 * s, -19 * s, headY + 12 * s);
    ctx.closePath();
    ctx.fill();

    /* gritted mouth */
    ctx.fillStyle = '#b3143a';
    roundRect(ctx, -10 * s, headY + 17 * s, 20 * s, 6 * s, 3 * s);
    ctx.fill();

    /* stars when wobbling */
    if (S.papa.state === 'stumble') {
      for (let i = 0; i < 4; i += 1) {
        const a = time * 6 + i * 1.5;
        drawText(ctx, '⭐', Math.cos(a) * 42 * s, headY - 34 * s + Math.sin(a) * 12 * s, {
          size: 16 * s,
        });
      }
    }

    ctx.restore();
  };

  const drawKid = (ctx, x, floorY, s, time) => {
    const crouch = S.brace ? 10 * s : 0;
    ctx.save();
    ctx.translate(x, floorY + crouch);

    ctx.fillStyle = 'rgba(5, 2, 12, 0.35)';
    ellipse(ctx, 0, 4 * s, 38 * s, 11 * s);
    ctx.fill();

    /* legs */
    ctx.fillStyle = '#f2c9a0';
    roundRect(ctx, -18 * s, -40 * s, 15 * s, 40 * s, 6 * s);
    ctx.fill();
    roundRect(ctx, 4 * s, -40 * s, 15 * s, 40 * s, 6 * s);
    ctx.fill();

    /* singlet */
    ctx.fillStyle = '#2ec4ff';
    roundRect(ctx, -22 * s, -84 * s, 44 * s, 48 * s, 12 * s);
    ctx.fill();
    ctx.fillStyle = '#fff8e7';
    roundRect(ctx, -8 * s, -78 * s, 16 * s, 20 * s, 4 * s);
    ctx.fill();

    /* arms braced forward */
    ctx.strokeStyle = '#f2c9a0';
    ctx.lineWidth = 11 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16 * s, -70 * s);
    ctx.lineTo(40 * s, -58 * s - (S.brace ? 6 * s : 0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12 * s, -62 * s);
    ctx.lineTo(36 * s, -46 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';

    /* head and headband */
    ctx.fillStyle = '#f2c9a0';
    ellipse(ctx, 0, -102 * s, 21 * s, 20 * s);
    ctx.fill();
    ctx.fillStyle = '#5b3a2a';
    ellipse(ctx, -2 * s, -118 * s, 20 * s, 9 * s);
    ctx.fill();
    ctx.fillStyle = '#ff2e63';
    roundRect(ctx, -21 * s, -112 * s, 42 * s, 9 * s, 3 * s);
    ctx.fill();

    /* determined face */
    ctx.fillStyle = '#1a0a12';
    ellipse(ctx, 6 * s, -104 * s, 3 * s, 3.6 * s);
    ctx.fill();
    ellipse(ctx, 15 * s, -104 * s, 3 * s, 3.6 * s);
    ctx.fill();
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(3 * s, -112 * s);
    ctx.lineTo(10 * s, -110 * s);
    ctx.moveTo(18 * s, -112 * s);
    ctx.lineTo(12 * s, -110 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10 * s, -95 * s, 5 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();

    /* effort sweat */
    if (S.pos > 0.25) {
      drawText(ctx, '💧', 26 * s, -120 * s + Math.sin(time * 8) * 3, { size: 13 * s });
    }

    ctx.restore();
  };

  const draw = (ctx, view, time) => {
    const { w, h } = view;
    const s = clamp(Math.min(w, h) / 560, 0.55, 1.35);
    const floorY = h * 0.86;
    const shakeX = S.shake > 0 ? Math.sin(time * 70) * S.shake * 7 : 0;

    ctx.save();
    ctx.translate(shakeX, 0);

    /* wallpaper and wainscot */
    const wall = ctx.createLinearGradient(0, 0, 0, floorY);
    wall.addColorStop(0, '#2a1838');
    wall.addColorStop(1, '#4a2d52');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, floorY);

    ctx.strokeStyle = 'rgba(255, 217, 61, 0.1)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += Math.max(26, 38 * s)) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }

    ctx.fillStyle = '#4a2f3c';
    ctx.fillRect(0, floorY - h * 0.1, w, h * 0.1);

    /* floor */
    ctx.fillStyle = '#2a1c33';
    ctx.fillRect(0, floorY, w, h - floorY);

    /* the ring: Grandma's rug */
    ctx.fillStyle = '#7c2f4a';
    ellipse(ctx, w * 0.5, floorY + h * 0.03, w * 0.42, h * 0.09);
    ctx.fill();
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ellipse(ctx, w * 0.5, floorY + h * 0.03, w * 0.36, h * 0.07);
    ctx.stroke();
    ctx.setLineDash([]);

    /* out of bounds: laundry basket left, couch right */
    ctx.fillStyle = '#3ddc84';
    roundRect(ctx, w * 0.02, floorY - 52 * s, 78 * s, 52 * s, 8 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 5, 24, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(w * 0.02 + (78 * s * i) / 4, floorY - 52 * s);
      ctx.lineTo(w * 0.02 + (78 * s * i) / 4, floorY);
      ctx.stroke();
    }
    drawText(ctx, '🧺', w * 0.02 + 39 * s, floorY - 26 * s, { size: 26 * s });

    const couchX = w * 0.9;
    ctx.fillStyle = '#3f6d8c';
    roundRect(ctx, couchX, floorY - 96 * s, w * 0.16, 96 * s, 12 * s);
    ctx.fill();
    ctx.fillStyle = '#2f556f';
    roundRect(ctx, couchX + 10 * s, floorY - 82 * s, w * 0.16 - 20 * s, 30 * s, 8 * s);
    ctx.fill();
    drawText(ctx, '🛋️', couchX + (w * 0.16) / 2, floorY - 60 * s, { size: 30 * s });

    /* lamp */
    ctx.fillStyle = '#ffd93d';
    ctx.globalAlpha = 0.16 + Math.sin(time * 3) * 0.03;
    ellipse(ctx, w * 0.3, h * 0.2, 90 * s, 70 * s);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a3b6a';
    roundRect(ctx, w * 0.285, h * 0.1, w * 0.03, h * 0.12, 4 * s);
    ctx.fill();

    /* characters */
    const playerX = w * 0.38 + S.pos * w * 0.16;
    const papaX = w * 0.62 + S.pos * w * 0.26;
    drawPapa(ctx, papaX, floorY, s, time);
    drawKid(ctx, playerX, floorY, s, time);

    /* dust */
    for (const particle of S.puffs) {
      ctx.globalAlpha = clamp(particle.life * 1.6, 0, 0.7);
      ctx.fillStyle = '#e8e2f5';
      ellipse(ctx, particle.x, particle.y, particle.size * s * 0.5, particle.size * s * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* strain lines between them when you are winning */
    if (S.pos > 0.2) {
      ctx.strokeStyle = `rgba(255, 217, 61, ${clamp(S.pos, 0, 0.8)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const ly = floorY - (60 + i * 26) * s;
        ctx.beginPath();
        ctx.moveTo(playerX + 46 * s, ly);
        ctx.lineTo(playerX + 46 * s + 10 * s, ly - 5 * s);
        ctx.stroke();
      }
    }

    /* the finger offer */
    if (S.papa.state === 'finger') {
      const bubbleW = Math.min(w * 0.5, 250 * s);
      const bubbleY = floorY - 300 * s;
      ctx.fillStyle = '#fff8e7';
      roundRect(ctx, papaX - bubbleW / 2, bubbleY, bubbleW, 46 * s, 10 * s);
      ctx.fill();
      ctx.strokeStyle = '#0a0518';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(papaX - 6 * s, bubbleY + 44 * s);
      ctx.lineTo(papaX - 22 * s, bubbleY + 66 * s);
      ctx.lineTo(papaX + 16 * s, bubbleY + 44 * s);
      ctx.closePath();
      ctx.fillStyle = '#fff8e7';
      ctx.fill();
      ctx.stroke();
      drawText(ctx, 'PULL MY FINGER', papaX, bubbleY + 23 * s, {
        size: Math.min(11 * s, bubbleW / 13),
        pixel: true,
        color: '#b3143a',
      });
      drawText(ctx, 'SPACE / tap = pull it', w / 2, h * 0.19, {
        size: clamp(w * 0.018, 8, 13),
        pixel: true,
        color: '#9acd32',
        shadow: '#0a0518',
      });
    }

    /* the fart itself */
    if (S.papa.state === 'fart') {
      const progress = clamp(1 - S.papa.timer / 1.3, 0, 1);
      const cloudX = (playerX + papaX) / 2;
      const cloudY = floorY - 100 * s;
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * TAU + progress;
        const reach = (20 + progress * 70) * s;
        ctx.globalAlpha = 0.45 * (1 - progress * 0.55);
        ctx.fillStyle = i % 2 === 0 ? '#9acd32' : '#6fae3a';
        ellipse(
          ctx,
          cloudX + Math.cos(angle) * reach * 0.75 + (i - 4) * 6 * s,
          cloudY + Math.sin(angle) * reach * 0.45,
          (16 + progress * 24) * s,
          (13 + progress * 18) * s
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawText(ctx, 'PFFFT!', cloudX, cloudY - 74 * s, {
        size: clamp(w * 0.03, 12, 24),
        pixel: true,
        color: '#9acd32',
        shadow: '#0a0518',
      });
      drawText(ctx, 'Papa is laughing too hard to push', w / 2, h * 0.19, {
        size: clamp(w * 0.016, 7, 11),
        pixel: true,
        color: '#e8e2f5',
        shadow: '#0a0518',
      });
    }

    if (S.papa.state === 'letdown') {
      drawText(ctx, '...anyone?', papaX, floorY - 300 * s, {
        size: clamp(w * 0.018, 8, 13),
        pixel: true,
        color: '#bcacf0',
        shadow: '#0a0518',
      });
    }

    /* papa's warning */
    if (S.papa.state === 'windup') {
      drawText(ctx, 'HNNNNGH!', papaX, floorY - 236 * s, {
        size: clamp(w * 0.024, 10, 18),
        pixel: true,
        color: '#ff2e63',
        shadow: '#0a0518',
      });
    }
    if (S.papa.state === 'stumble') {
      drawText(ctx, 'Woah—', papaX, floorY - 236 * s, {
        size: clamp(w * 0.022, 9, 16),
        pixel: true,
        color: '#ffd93d',
        shadow: '#0a0518',
      });
    }

    ctx.restore();

    /* the push bar */
    const barW = Math.min(w * 0.64, 460);
    const barX = (w - barW) / 2;
    const barY = h * 0.075;
    ctx.fillStyle = 'rgba(10, 5, 24, 0.8)';
    roundRect(ctx, barX, barY, barW, 18, 9);
    ctx.fill();
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 3;
    roundRect(ctx, barX, barY, barW, 18, 9);
    ctx.stroke();

    const midX = barX + barW / 2;
    const markerX = midX + (S.pos * barW) / 2;
    ctx.fillStyle = S.pos >= 0 ? '#3ddc84' : '#ff2e63';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(Math.min(midX, markerX), barY + 3, Math.abs(markerX - midX), 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff8e7';
    roundRect(ctx, markerX - 3, barY - 4, 6, 26, 3);
    ctx.fill();

    drawText(ctx, '🧺', barX - 16, barY + 9, { size: 16 });
    drawText(ctx, '🛋️', barX + barW + 16, barY + 9, { size: 16 });
    drawText(ctx, 'PUSH!', w / 2, barY - 14, {
      size: clamp(w * 0.016, 7, 11),
      pixel: true,
      color: S.brace ? '#8fd7ff' : '#ffd93d',
      shadow: '#0a0518',
    });

    /* falls and hint */
    drawText(ctx, `Falls: you ${S.youFalls} — papa ${S.papaFalls}`, w / 2, h * 0.15, {
      size: clamp(w * 0.018, 8, 13),
      pixel: true,
      color: '#fff8e7',
      shadow: '#0a0518',
    });

    if (S.brace) {
      drawText(ctx, 'BRACING', w * 0.5, floorY - 150 * s, {
        size: clamp(w * 0.017, 8, 12),
        pixel: true,
        color: '#8fd7ff',
        shadow: '#0a0518',
      });
    }

    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255, 46, 99, ${S.flash * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  return { hud, update, draw, reset };
}
