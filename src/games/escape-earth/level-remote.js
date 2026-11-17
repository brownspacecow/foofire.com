import { TAU, clamp, lerp, rand, drawText, ellipse, roundRect } from './util.js';

/* ------------------------------------------------------------------ *
 * Level 3 — Remote to the head (a WarioWare-style microgame)
 * Grandma says the remote gives off radiation. Grandma is watching.
 * Hold the remote against your head while she is not looking; drop it
 * the instant she turns around.
 * ------------------------------------------------------------------ */

const ROUNDS = [
  { target: 3.0, idle: 2.3, telegraph: 0.62, watch: 0.95, label: 'Warm-up' },
  { target: 3.6, idle: 1.75, telegraph: 0.5, watch: 1.0, label: 'She is suspicious' },
  { target: 4.2, idle: 1.3, telegraph: 0.42, watch: 1.1, label: 'Full nan vision' },
];

const CATCH_LINES = [
  'THAT REMOTE IS RADIATION!',
  'YOU ARE COOKING YOUR BRAIN!',
  'IN MY DAY WE WATCHED THE WEATHER!',
  'PUT THAT DOWN OR I AM CALLING YOUR MOTHER!',
];

const PROMPTS = ['HOLD THE REMOTE TO YOUR HEAD!', 'GET THOSE RADISHES!', 'HOLD IT!', 'RADIATION TIME!'];

export function createRemoteLevel({ sound, say = () => {}, onWin, onLose }) {
  let S;

  const reset = () => {
    S = {
      round: 0,
      strikes: 0,
      rads: 0,
      points: 0,
      holding: false,
      raise: 0,
      holdTime: 0,
      phase: 'countdown',
      countdown: 3.4,
      clearTimer: 0,
      lockout: 0,
      ended: false,
      caughtThisWatch: false,
      grandma: { state: 'idle', timer: ROUNDS[0].idle, look: 0 },
      flash: 0,
      speech: '',
      speechTimer: 0,
      time: 0,
      sparkle: 0,
      prompt: PROMPTS[0],
    };
  };

  reset();

  const roundConf = () => ROUNDS[Math.min(S.round, ROUNDS.length - 1)];

  const startRound = () => {
    const conf = roundConf();
    S.phase = 'countdown';
    S.countdown = 3.4;
    S.holdTime = 0;
    S.holding = false;
    S.caughtThisWatch = false;
    S.prompt = PROMPTS[S.round % PROMPTS.length];
    S.grandma = { state: 'idle', timer: conf.idle * 0.8, look: 0 };
    sound.blip(660);
  };

  const caught = () => {
    S.strikes += 1;
    S.caughtThisWatch = true;
    S.holding = false;
    S.lockout = 0.9;
    S.flash = 0.55;
    S.speech = CATCH_LINES[(S.strikes - 1) % CATCH_LINES.length];
    S.speechTimer = 1.6;
    sound.yell();
    say(`Caught! Strikes: ${S.strikes} / 3`, 1.6);
    if (S.strikes >= 3 && !S.ended) {
      S.ended = true;
      sound.lose();
      onLose({
        title: 'Grandma confiscated the remote',
        text: 'She has hidden it in a biscuit tin on top of the fridge. You have been sent to sit in the car with a glass of squash.',
        stats: [
          ['Rads collected', `${Math.floor(S.rads * 10)}`],
          ['Rounds reached', `${S.round + 1} / 3`],
        ],
        points: S.points,
      });
    }
  };

  const clearRound = () => {
    S.phase = 'clear';
    S.clearTimer = 1.6;
    S.holding = false;
    sound.win();
    const bonus = 200 + S.round * 100;
    S.points += bonus;
    say(S.round >= ROUNDS.length - 1 ? 'That was the last round!' : 'Round clear! She suspects nothing.', 1.8);
  };

  const update = (dt, input, view) => {
    if (S.ended) return;
    S.time += dt;
    S.flash = Math.max(0, S.flash - dt);
    S.lockout = Math.max(0, S.lockout - dt);
    if (S.speechTimer > 0) S.speechTimer -= dt;

    const conf = roundConf();
    const wantsHold = !S.ended && input.holdDown();

    if (S.phase === 'countdown') {
      S.countdown -= dt;
      if (S.countdown <= 0) {
        S.phase = 'play';
      }
      return;
    }

    if (S.phase === 'clear') {
      S.clearTimer -= dt;
      S.raise = lerp(S.raise, 0, Math.min(1, dt * 8));
      if (S.clearTimer <= 0) {
        S.round += 1;
        if (S.round >= ROUNDS.length) {
          if (!S.ended) {
            S.ended = true;
            sound.win();
            onWin({
              title: 'Grandma went to bed',
              text: 'You survived three rounds of illegal television radiation. The remote is warm. Your hair is standing up slightly.',
              stats: [
                ['Rads collected', `${Math.floor(S.rads * 10)}`],
                ['Times caught', `${S.strikes} / 3`],
              ],
              points: S.points + Math.round(S.rads * 60) + 300,
            });
          }
        } else {
          startRound();
        }
      }
      return;
    }

    /* grandma's head */
    if (S.grandma.state === 'idle') {
      S.grandma.timer -= dt;
      if (S.grandma.timer <= 0) {
        S.grandma.state = 'turning';
        S.grandma.timer = conf.telegraph;
        S.caughtThisWatch = false;
        sound.tick();
      }
    } else if (S.grandma.state === 'turning') {
      S.grandma.timer -= dt;
      if (S.grandma.timer <= 0) {
        S.grandma.state = 'watching';
        S.grandma.timer = conf.watch;
      }
    } else {
      S.grandma.timer -= dt;
      if (S.grandma.timer <= 0) {
        S.grandma.state = 'idle';
        S.grandma.timer = rand(conf.idle * 0.8, conf.idle * 1.25);
        S.caughtThisWatch = false;
      }
    }

    const lookTarget = S.grandma.state === 'idle' ? 0 : 1;
    S.grandma.look = lerp(S.grandma.look, lookTarget, Math.min(1, dt * (S.grandma.state === 'turning' ? 7 : 9)));

    /* the crime itself */
    const canHold = S.lockout <= 0 && S.grandma.state === 'idle';
    S.holding = wantsHold && canHold;

    if (S.holding) {
      S.holdTime += dt;
      S.rads += dt * (1 + S.round * 0.4);
      S.sparkle += dt * 18;
      if (Math.random() < dt * 5) sound.blip(rand(700, 1100));
    }

    S.raise = lerp(S.raise, S.holding ? 1 : 0, Math.min(1, dt * 12));

    /* she catches movement in the corner of her eye during the flinch */
    if (wantsHold && S.lockout <= 0 && (S.grandma.state === 'turning' || S.grandma.state === 'watching') && !S.caughtThisWatch) {
      caught();
    }

    if (S.holdTime >= conf.target && S.phase === 'play') clearRound();
  };

  const hud = () => {
    const conf = roundConf();
    return {
      stats: [
        ['Round', `${Math.min(S.round + 1, ROUNDS.length)} / 3`],
        ['Rads', `${Math.floor(S.rads * 10)}`],
        ['Strikes', S.strikes > 0 ? '❌'.repeat(S.strikes) : '—'],
        ['Goal', `${Math.min(conf.target, Math.round(S.holdTime * 10) / 10)} / ${conf.target}s`],
      ],
    };
  };

  const drawGrandma = (ctx, x, y, scale, time) => {
    const look = S.grandma.look;
    const watching = S.grandma.state === 'watching' || S.grandma.state === 'turning';

    /* armchair */
    ctx.fillStyle = '#5a3b6b';
    roundRect(ctx, x - 62 * scale, y - 10 * scale, 124 * scale, 82 * scale, 14 * scale);
    ctx.fill();
    ctx.fillStyle = '#6d4a80';
    roundRect(ctx, x - 52 * scale, y + 8 * scale, 104 * scale, 62 * scale, 10 * scale);
    ctx.fill();
    ctx.fillStyle = '#4a2f5c';
    roundRect(ctx, x - 68 * scale, y - 14 * scale, 26 * scale, 86 * scale, 10 * scale);
    ctx.fill();
    roundRect(ctx, x + 42 * scale, y - 14 * scale, 26 * scale, 86 * scale, 10 * scale);
    ctx.fill();

    /* body */
    ctx.fillStyle = '#b98ac7';
    roundRect(ctx, x - 34 * scale, y + 6 * scale, 68 * scale, 52 * scale, 16 * scale);
    ctx.fill();

    /* knitting on her lap */
    ctx.fillStyle = '#ffd93d';
    roundRect(ctx, x - 18 * scale, y + 36 * scale, 40 * scale, 16 * scale, 5 * scale);
    ctx.fill();

    /* head, shifted by how much she is looking at you */
    const headX = x + 10 * scale + look * 18 * scale;
    ctx.fillStyle = '#f2c9a0';
    ellipse(ctx, headX, y - 16 * scale, 26 * scale, 25 * scale);
    ctx.fill();

    /* hair bun */
    ctx.fillStyle = '#e8e2f5';
    ellipse(ctx, headX - 20 * scale, y - 28 * scale, 18 * scale, 15 * scale);
    ctx.fill();
    ellipse(ctx, headX - 2 * scale, y - 38 * scale, 20 * scale, 12 * scale);
    ctx.fill();

    /* glasses */
    ctx.strokeStyle = '#2b1c3f';
    ctx.lineWidth = 2.4 * scale;
    ctx.beginPath();
    ctx.arc(headX - 8 * scale, y - 18 * scale, 7 * scale, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headX + 9 * scale, y - 18 * scale, 7 * scale, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - 1 * scale, y - 18 * scale);
    ctx.lineTo(headX + 2 * scale, y - 18 * scale);
    ctx.stroke();

    /* eyes: closed and content, or open and furious */
    ctx.fillStyle = '#1a0a12';
    if (watching) {
      ellipse(ctx, headX - 8 * scale, y - 18 * scale, 2.6 * scale, 3.2 * scale);
      ctx.fill();
      ellipse(ctx, headX + 9 * scale, y - 18 * scale, 2.6 * scale, 3.2 * scale);
      ctx.fill();
      ctx.strokeStyle = '#2b1c3f';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(headX - 14 * scale, y - 27 * scale);
      ctx.lineTo(headX - 3 * scale, y - 24 * scale);
      ctx.moveTo(headX + 15 * scale, y - 27 * scale);
      ctx.lineTo(headX + 4 * scale, y - 24 * scale);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#1a0a12';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(headX - 13 * scale, y - 18 * scale);
      ctx.quadraticCurveTo(headX - 8 * scale, y - 15 * scale, headX - 3 * scale, y - 18 * scale);
      ctx.moveTo(headX + 4 * scale, y - 18 * scale);
      ctx.quadraticCurveTo(headX + 9 * scale, y - 15 * scale, headX + 14 * scale, y - 18 * scale);
      ctx.stroke();
    }

    /* mouth */
    ctx.strokeStyle = '#8a3b52';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    if (watching) {
      ctx.moveTo(headX - 5 * scale, y - 4 * scale);
      ctx.lineTo(headX + 6 * scale, y - 4 * scale);
    } else {
      ctx.arc(headX + 1 * scale, y - 6 * scale, 5 * scale, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    /* remote pointed at the TV */
    ctx.fillStyle = '#2b2246';
    roundRect(ctx, headX - 54 * scale, y + 20 * scale, 26 * scale, 11 * scale, 4 * scale);
    ctx.fill();
    ctx.fillStyle = '#ff2e63';
    ellipse(ctx, headX - 52 * scale, y + 25 * scale, 3 * scale, 3 * scale);
    ctx.fill();

    /* alert */
    if (watching) {
      drawText(ctx, '!', headX + 30 * scale, y - 44 * scale, {
        size: 26 * scale,
        pixel: true,
        color: '#ff2e63',
        shadow: '#0a0518',
      });
    }
  };

  const drawPlayer = (ctx, x, y, scale, time) => {
    const raise = S.raise;

    /* beanbag */
    ctx.fillStyle = '#3ddc84';
    ellipse(ctx, x, y + 46 * scale, 62 * scale, 30 * scale);
    ctx.fill();

    /* body */
    ctx.fillStyle = '#2ec4ff';
    roundRect(ctx, x - 26 * scale, y - 2 * scale, 52 * scale, 56 * scale, 14 * scale);
    ctx.fill();

    /* head */
    ctx.fillStyle = '#f2c9a0';
    ellipse(ctx, x, y - 20 * scale, 24 * scale, 23 * scale);
    ctx.fill();

    /* hair standing up when radioactive */
    ctx.fillStyle = '#5b3a2a';
    const spike = S.holding ? 1 + Math.sin(time * 22) * 0.12 : 1;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 9 * scale, y - 38 * scale);
      ctx.lineTo(x + i * 11 * scale, y - (46 + Math.abs(i) * -2) * scale * spike);
      ctx.lineTo(x + i * 9 * scale + 4 * scale, y - 38 * scale);
      ctx.closePath();
      ctx.fill();
    }

    /* eyes wide open, because this is a crime */
    ctx.fillStyle = '#1a0a12';
    ellipse(ctx, x - 8 * scale, y - 22 * scale, 2.6 * scale, 3.4 * scale);
    ctx.fill();
    ellipse(ctx, x + 8 * scale, y - 22 * scale, 2.6 * scale, 3.4 * scale);
    ctx.fill();

    /* arm + remote, rising to the head */
    const handX = x + 20 * scale;
    const handY = lerp(y + 34 * scale, y - 22 * scale, raise);
    ctx.strokeStyle = '#f2c9a0';
    ctx.lineWidth = 9 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 22 * scale, y + 18 * scale);
    ctx.lineTo(handX + 2 * scale, handY);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.save();
    ctx.translate(handX + 2 * scale, handY);
    ctx.rotate(lerp(0, -1.2, raise));
    ctx.fillStyle = '#2b2246';
    roundRect(ctx, -8 * scale, -6 * scale, 30 * scale, 13 * scale, 4 * scale);
    ctx.fill();
    ctx.fillStyle = '#ff2e63';
    ellipse(ctx, -4 * scale, 0, 3 * scale, 3 * scale);
    ctx.fill();
    ctx.fillStyle = '#ffd93d';
    for (let i = 0; i < 3; i += 1) {
      ellipse(ctx, (4 + i * 6) * scale, -1.5 * scale, 1.6 * scale, 1.6 * scale);
      ctx.fill();
    }
    ctx.restore();

    /* radiation sparkles */
    if (S.holding && raise > 0.5) {
      for (let i = 0; i < 6; i += 1) {
        const a = S.sparkle + i * 1.1;
        const dist = (22 + Math.sin(a * 1.7) * 9) * scale;
        const sx = x + Math.cos(a) * dist;
        const sy = y - 24 * scale + Math.sin(a) * dist * 0.7;
        drawText(ctx, '☢', sx, sy, { size: 13 * scale, color: '#3ddc84', alpha: 0.8 });
      }
    }

    /* sweat when she is staring */
    if (S.grandma.state !== 'idle' && raise > 0.12) {
      drawText(ctx, '💧', x + 26 * scale, y - 34 * scale - Math.sin(time * 8) * 4, {
        size: 16 * scale,
        color: '#8fd7ff',
      });
    }
  };

  const draw = (ctx, view, time) => {
    const { w, h } = view;
    const scale = clamp(Math.min(w, h) / 520, 0.55, 1.5);
    const floorY = h * 0.86;

    /* wallpaper */
    const wall = ctx.createLinearGradient(0, 0, 0, floorY);
    wall.addColorStop(0, '#2a1838');
    wall.addColorStop(1, '#452a4f');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, floorY);

    ctx.strokeStyle = 'rgba(255, 217, 61, 0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += Math.max(22, 34 * scale)) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }

    /* floor */
    ctx.fillStyle = '#2a1c33';
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = 'rgba(255, 248, 231, 0.08)';
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, floorY + ((h - floorY) * i) / 4);
      ctx.lineTo(w, floorY + ((h - floorY) * i) / 4);
      ctx.stroke();
    }

    /* window with the moon */
    ctx.fillStyle = '#0f1b3a';
    roundRect(ctx, w * 0.52, h * 0.14, w * 0.16, h * 0.22, 6 * scale);
    ctx.fill();
    ctx.fillStyle = '#e8e2f5';
    ellipse(ctx, w * 0.62, h * 0.2, 14 * scale, 14 * scale);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 248, 231, 0.1)';
    ctx.fillRect(w * 0.52, h * 0.14, w * 0.16, h * 0.22);

    /* framed photo of the family cat */
    ctx.fillStyle = '#5a3b2a';
    roundRect(ctx, w * 0.24, h * 0.12, w * 0.08, h * 0.12, 3 * scale);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.fillRect(w * 0.25, h * 0.13, w * 0.06, h * 0.1);
    drawText(ctx, '🐈', w * 0.28, h * 0.18, { size: 18 * scale });

    /* TV and its static */
    const tvX = w * 0.1;
    const tvY = h * 0.5;
    ctx.fillStyle = '#1a1226';
    roundRect(ctx, tvX, tvY, w * 0.17, h * 0.22, 8 * scale);
    ctx.fill();
    const tv = ctx.createLinearGradient(tvX, tvY, tvX + w * 0.17, tvY + h * 0.22);
    tv.addColorStop(0, '#7ef0ff');
    tv.addColorStop(0.5, '#c9b6ff');
    tv.addColorStop(1, '#7ef0ff');
    ctx.fillStyle = tv;
    ctx.globalAlpha = 0.7 + Math.sin(time * 18) * 0.12;
    ctx.fillRect(tvX + w * 0.012, tvY + h * 0.018, w * 0.146, h * 0.16);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(10, 5, 24, 0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const yy = tvY + h * 0.02 + (h * 0.15 * i) / 6 + Math.sin(time * 6 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(tvX + w * 0.012, yy);
      ctx.lineTo(tvX + w * 0.158, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2a4f';
    ctx.fillRect(tvX + w * 0.02, tvY + h * 0.215, w * 0.13, h * 0.03);

    /* characters */
    drawGrandma(ctx, w * 0.4, h * 0.63, scale, time);
    drawPlayer(ctx, w * 0.76, h * 0.68, scale, time);

    /* grandma's yell */
    if (S.speechTimer > 0) {
      const bubbleW = Math.min(w * 0.62, 330 * scale);
      const bx = w * 0.42;
      const by = h * 0.24;
      ctx.fillStyle = '#fff8e7';
      roundRect(ctx, bx - bubbleW / 2, by - 30 * scale, bubbleW, 54 * scale, 10 * scale);
      ctx.fill();
      ctx.strokeStyle = '#0a0518';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 10 * scale, by + 24 * scale);
      ctx.lineTo(bx - 32 * scale, by + 48 * scale);
      ctx.lineTo(bx + 6 * scale, by + 24 * scale);
      ctx.closePath();
      ctx.fillStyle = '#fff8e7';
      ctx.fill();
      ctx.stroke();
      drawText(ctx, S.speech, bx, by - 3 * scale, {
        size: Math.min(11 * scale, bubbleW / 15),
        pixel: true,
        color: '#b3143a',
      });
    }

    /* prompt and progress */
    const conf = roundConf();
    if (S.phase === 'play') {
      drawText(ctx, S.prompt, w / 2, h * 0.07, {
        size: clamp(w * 0.021, 9, 17),
        pixel: true,
        color: '#ffd93d',
        shadow: '#0a0518',
      });

      const barW = Math.min(w * 0.6, 420);
      const barX = (w - barW) / 2;
      const barY = h * 0.12;
      ctx.fillStyle = 'rgba(10, 5, 24, 0.7)';
      roundRect(ctx, barX, barY, barW, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#3ddc84';
      const ratio = clamp(S.holdTime / conf.target, 0, 1);
      roundRect(ctx, barX + 2, barY + 2, Math.max(0, (barW - 4) * ratio), 10, 5);
      ctx.fill();

      /* grandma's stare meter */
      const eyeX = w * 0.5;
      drawText(ctx, S.grandma.state === 'idle' ? '👵 watching TV' : '👀 SHE IS LOOKING', eyeX, h * 0.19, {
        size: clamp(w * 0.018, 8, 13),
        pixel: true,
        color: S.grandma.state === 'idle' ? '#bcacf0' : '#ff2e63',
      });
    }

    if (S.phase === 'countdown') {
      const n = Math.ceil(S.countdown - 0.4);
      const label = n > 0 ? String(n) : 'GO!';
      drawText(ctx, label, w / 2, h * 0.32, {
        size: clamp(w * 0.09, 34, 92),
        pixel: true,
        color: '#ffd93d',
        shadow: '#0a0518',
      });
      drawText(ctx, S.prompt, w / 2, h * 0.47, {
        size: clamp(w * 0.022, 9, 16),
        pixel: true,
        color: '#fff8e7',
        shadow: '#0a0518',
      });
      drawText(ctx, `Round ${S.round + 1}: ${conf.label}`, w / 2, h * 0.53, {
        size: clamp(w * 0.017, 8, 12),
        color: '#bcacf0',
      });
    }

    if (S.phase === 'clear') {
      drawText(ctx, 'ROUND CLEAR!', w / 2, h * 0.3, {
        size: clamp(w * 0.05, 20, 48),
        pixel: true,
        color: '#3ddc84',
        shadow: '#0a0518',
      });
    }

    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255, 46, 99, ${S.flash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  return { hud, update, draw, reset };
}
