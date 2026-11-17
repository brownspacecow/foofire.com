import { TAU, clamp, lerp, rand, pick, roundRect, drawText, ellipse } from './util.js';

/* ------------------------------------------------------------------ *
 * Level 2 — Lights out
 * The power is off at Grandma's. Two dolls are awake. One torch.
 * ------------------------------------------------------------------ */

const START = { x: 0.5, y: 0.86 };
const DOOR = { x: 0.5, y: 0.09 };

const FUSE_SPOTS = [
  { x: 0.16, y: 0.34, where: 'on top of the TV' },
  { x: 0.5, y: 0.52, where: 'under the coffee table' },
  { x: 0.84, y: 0.24, where: 'in the fruit bowl' },
];

const DOLL_HOME = [
  { x: 0.08, y: 0.18, name: 'Raggedy Ann', dress: '#d84a5a', hair: '#e0521f' },
  { x: 0.92, y: 0.18, name: 'Raggedy Andy', dress: '#4a6fd8', hair: '#e0521f' },
];

const CAUGHT_LINES = [
  'Ann got you. She wants to play FOREVER.',
  'Andy caught you. He has been waiting since 1974.',
  'The dolls found you. Their heads are not attached properly.',
];

const FUSE_LINES = [
  'Fuse one! Something upstairs started walking.',
  'Fuse two! The dolls are faster now. Sorry.',
  'Fuse three! The front door is glowing. RUN.',
];

const PALETTE = {
  lit: {
    wall: '#3a2b4c',
    floor: '#a9713f',
    planks: '#875329',
    rug: '#7c2f4a',
    rugRing: '#b8476a',
    sofa: '#3f6d8c',
    sofaDark: '#2f556f',
    table: '#8a5a30',
    tableTop: '#b9873f',
    tv: '#20263a',
    stand: '#5a3f2a',
    counter: '#6b4a33',
    shelf: '#5a3c2a',
    door: '#7a4a2a',
    dollBody: '#f0dfc6',
    ink: '#1a1020',
  },
  dark: {
    wall: '#150f1c',
    floor: '#1c1424',
    planks: '#150e1b',
    rug: '#1d1126',
    rugRing: '#2b1938',
    sofa: '#141d27',
    sofaDark: '#101720',
    table: '#191220',
    tableTop: '#1f1727',
    tv: '#0d1119',
    stand: '#130d18',
    counter: '#170f16',
    shelf: '#140d17',
    door: '#1c1220',
    dollBody: '#4a4058',
    ink: '#07040c',
  },
};

export function createDollsLevel({ sound, say = () => {}, onWin, onLose }) {
  let S;

  const reset = () => {
    S = {
      player: { x: START.x, y: START.y, angle: -Math.PI / 2, moving: false },
      dolls: [],
      hearts: 3,
      fuses: 0,
      taken: [false, false, false],
      time: 0,
      invuln: 0,
      flash: 0,
      shake: 0,
      ended: false,
      step: 0,
    };
    S.dolls = DOLL_HOME.map((home) => ({
      x: home.x,
      y: home.y,
      name: home.name,
      dress: home.dress,
      hair: home.hair,
      phase: rand(0, TAU),
    }));
  };

  reset();

  const roomOf = (view) => ({
    x: view.w * 0.035,
    y: view.h * 0.055,
    w: view.w * 0.93,
    h: view.h * 0.89,
  });

  const toPx = (room, x, y) => ({ x: room.x + x * room.w, y: room.y + y * room.h });

  const hit = () => {
    if (S.invuln > 0 || S.ended) return;
    S.hearts -= 1;
    S.invuln = 1.9;
    S.flash = 0.5;
    S.shake = 0.5;
    S.player.x = START.x;
    S.player.y = START.y;
    sound.yell();
    say(pick(CAUGHT_LINES), 2);
    S.dolls.forEach((doll) => {
      doll.x = lerp(doll.x, START.x < 0.5 ? 0.08 : 0.92, 0.8);
      doll.y = lerp(doll.y, 0.18, 0.8);
    });
    if (S.hearts <= 0) {
      S.ended = true;
      sound.lose();
      onLose({
        title: 'The dolls have adopted you',
        text: 'You are now part of the toy shelf. Grandma will dust you on Sundays. What a lovely, terrible ending.',
        stats: [
          ['Fuses found', `${S.fuses} / 3`],
          ['Survived', `${Math.floor(S.time)} s`],
        ],
        points: S.fuses * 100,
      });
    }
  };

  const update = (dt, input, view) => {
    if (S.ended) return;
    S.time += dt;
    S.invuln = Math.max(0, S.invuln - dt);
    S.flash = Math.max(0, S.flash - dt);
    S.shake = Math.max(0, S.shake - dt);

    const room = roomOf(view);
    const minDim = Math.min(room.w, room.h);

    /* movement: keys first, then the pointer as a "walk to here" tap */
    let mx = input.horizontal();
    let my = input.vertical();

    if (!mx && !my && input.pointer.down) {
      const tx = clamp((input.pointer.x - room.x) / room.w, 0.05, 0.95);
      const ty = clamp((input.pointer.y - room.y) / room.h, 0.1, 0.94);
      const dx = tx - S.player.x;
      const dy = (ty - S.player.y) * (room.h / room.w);
      const len = Math.hypot(dx, dy);
      if (len > 0.02) {
        mx = dx / len;
        my = dy / len;
      }
    }

    const moveLen = Math.hypot(mx, my);
    if (moveLen > 0) {
      mx /= moveLen;
      my /= moveLen;
      const pxSpeed = minDim * 0.55;
      S.player.x += (mx * pxSpeed * dt) / room.w;
      S.player.y += (my * pxSpeed * dt) / room.h;
      S.player.angle = Math.atan2(my, mx);
      S.player.moving = true;
      S.step += dt * 12;
    } else {
      S.player.moving = false;
    }

    S.player.x = clamp(S.player.x, 0.07, 0.93);
    S.player.y = clamp(S.player.y, 0.13, 0.93);

    /* dolls: relentless, slightly faster with every fuse */
    const dollSpeed = minDim * (0.33 + S.fuses * 0.045);
    for (const doll of S.dolls) {
      doll.phase += dt * 3;
      const dx = S.player.x - doll.x;
      const dy = (S.player.y - doll.y) * (room.h / room.w);
      const len = Math.hypot(dx, dy) || 1;
      const sway = Math.sin(doll.phase) * 0.18;
      const vx = (dx / len + sway * (dy / len)) * dollSpeed;
      const vy = (dy / len - sway * (dx / len)) * dollSpeed;
      doll.x += (vx * dt) / room.w;
      doll.y += (vy * dt) / room.h;
      doll.x = clamp(doll.x, 0.06, 0.94);
      doll.y = clamp(doll.y, 0.11, 0.94);
    }

    /* doll contact */
    for (const doll of S.dolls) {
      const dx = (S.player.x - doll.x) * room.w;
      const dy = (S.player.y - doll.y) * room.h;
      if (Math.hypot(dx, dy) < minDim * 0.085) hit();
    }

    /* fuses */
    FUSE_SPOTS.forEach((spot, index) => {
      if (S.taken[index]) return;
      const dx = (S.player.x - spot.x) * room.w;
      const dy = (S.player.y - spot.y) * room.h;
      if (Math.hypot(dx, dy) < minDim * 0.075) {
        S.taken[index] = true;
        S.fuses += 1;
        sound.powerup();
        say(FUSE_LINES[index], 2.2);
        if (S.fuses === 3) sound.giggle();
      }
    });

    /* escape */
    if (S.fuses === 3) {
      const dx = (S.player.x - DOOR.x) * room.w;
      const dy = (S.player.y - DOOR.y) * room.h;
      if (Math.hypot(dx, dy) < minDim * 0.085) {
        S.ended = true;
        sound.win();
        onWin({
          title: 'You escaped the dark',
          text: 'You burst out the front door into the yard. Behind you, two small voices say "come baaaack". You do not.',
          stats: [
            ['Fuses', '3 / 3'],
            ['Survived', `${Math.floor(S.time)} s`],
            ['Hearts left', `${S.hearts} / 3`],
          ],
          points: 500 + S.hearts * 200 + Math.max(0, 180 - Math.floor(S.time)) * 2,
        });
      }
    }
  };

  const hud = () => ({
    stats: [
      ['Fuses', `${S.fuses} / 3`],
      ['Torch', S.fuses === 3 ? 'Door is glowing!' : 'Point it around'],
      ['Hearts', S.hearts > 0 ? '❤️'.repeat(S.hearts) : '💀'],
    ],
  });

  const drawDoll = (ctx, room, doll, palette, radius, glow) => {
    const p = toPx(room, doll.x, doll.y);
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ellipse(ctx, 0, radius * 0.9, radius * 0.85, radius * 0.32);
    ctx.fill();

    /* dress */
    ctx.fillStyle = doll.dress;
    ctx.globalAlpha = glow ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, -radius * 0.1);
    ctx.lineTo(radius * 0.4, -radius * 0.1);
    ctx.lineTo(radius * 0.62, radius * 0.8);
    ctx.lineTo(-radius * 0.62, radius * 0.8);
    ctx.closePath();
    ctx.fill();

    /* striped legs */
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-radius * 0.3, radius * 0.7, radius * 0.2, radius * 0.32);
    ctx.fillRect(radius * 0.1, radius * 0.7, radius * 0.2, radius * 0.32);
    ctx.fillStyle = doll.dress;
    ctx.fillRect(-radius * 0.3, radius * 0.78, radius * 0.2, radius * 0.09);
    ctx.fillRect(radius * 0.1, radius * 0.86, radius * 0.2, radius * 0.09);

    /* head */
    ctx.fillStyle = palette.dollBody;
    ellipse(ctx, 0, -radius * 0.42, radius * 0.42, radius * 0.4);
    ctx.fill();

    /* yarn hair */
    ctx.strokeStyle = glow ? doll.hair : '#3a2418';
    ctx.lineWidth = Math.max(1, radius * 0.09);
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * radius * 0.15, -radius * 0.7);
      ctx.lineTo(i * radius * 0.2, -radius * 0.95);
      ctx.stroke();
    }

    /* eyes: bright buttons so they glitter in the dark */
    ctx.fillStyle = '#fff8e7';
    ellipse(ctx, -radius * 0.15, -radius * 0.4, radius * 0.07, radius * 0.07);
    ctx.fill();
    ellipse(ctx, radius * 0.15, -radius * 0.4, radius * 0.07, radius * 0.07);
    ctx.fill();
    ctx.fillStyle = '#1a0a12';
    ellipse(ctx, -radius * 0.15, -radius * 0.4, radius * 0.03, radius * 0.03);
    ctx.fill();
    ellipse(ctx, radius * 0.15, -radius * 0.4, radius * 0.03, radius * 0.03);
    ctx.fill();

    ctx.restore();
  };

  const drawScene = (ctx, view, bright) => {
    const room = roomOf(view);
    const p = bright ? PALETTE.lit : PALETTE.dark;
    const minDim = Math.min(room.w, room.h);

    ctx.fillStyle = p.wall;
    ctx.fillRect(0, 0, view.w, view.h);

    ctx.fillStyle = p.floor;
    ctx.fillRect(room.x, room.y, room.w, room.h);

    ctx.strokeStyle = p.planks;
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 9; i += 1) {
      const y = room.y + (room.h * i) / 9;
      ctx.beginPath();
      ctx.moveTo(room.x, y);
      ctx.lineTo(room.x + room.w, y);
      ctx.stroke();
    }

    /* rug */
    ctx.fillStyle = p.rug;
    ellipse(ctx, room.x + room.w * 0.5, room.y + room.h * 0.55, room.w * 0.26, room.h * 0.18);
    ctx.fill();
    ctx.strokeStyle = p.rugRing;
    ctx.lineWidth = 3;
    ellipse(ctx, room.x + room.w * 0.5, room.y + room.h * 0.55, room.w * 0.2, room.h * 0.13);
    ctx.stroke();

    /* sofa, hard against the left wall */
    ctx.fillStyle = p.sofa;
    roundRect(ctx, room.x + room.w * 0.04, room.y + room.h * 0.28, room.w * 0.17, room.h * 0.32, minDim * 0.02);
    ctx.fill();
    ctx.fillStyle = p.sofaDark;
    roundRect(ctx, room.x + room.w * 0.065, room.y + room.h * 0.3, room.w * 0.06, room.h * 0.1, minDim * 0.015);
    ctx.fill();
    roundRect(ctx, room.x + room.w * 0.135, room.y + room.h * 0.3, room.w * 0.06, room.h * 0.1, minDim * 0.015);
    ctx.fill();

    /* TV on its stand */
    ctx.fillStyle = p.stand;
    roundRect(ctx, room.x + room.w * 0.11, room.y + room.h * 0.14, room.w * 0.19, room.h * 0.14, minDim * 0.012);
    ctx.fill();
    ctx.fillStyle = p.tv;
    roundRect(ctx, room.x + room.w * 0.13, room.y + room.h * 0.11, room.w * 0.14, room.h * 0.1, minDim * 0.01);
    ctx.fill();
    if (!bright) {
      ctx.fillStyle = 'rgba(46, 196, 255, 0.12)';
      ctx.fillRect(room.x + room.w * 0.14, room.y + room.h * 0.12, room.w * 0.12, room.h * 0.075);
    }

    /* coffee table */
    ctx.fillStyle = p.table;
    roundRect(ctx, room.x + room.w * 0.4, room.y + room.h * 0.46, room.w * 0.22, room.h * 0.12, minDim * 0.015);
    ctx.fill();
    ctx.fillStyle = p.tableTop;
    roundRect(ctx, room.x + room.w * 0.39, room.y + room.h * 0.43, room.w * 0.24, room.h * 0.06, minDim * 0.015);
    ctx.fill();

    /* kitchen counter, top right */
    ctx.fillStyle = p.counter;
    roundRect(ctx, room.x + room.w * 0.72, room.y + room.h * 0.08, room.w * 0.24, room.h * 0.12, minDim * 0.012);
    ctx.fill();

    /* bookshelf, right wall */
    ctx.fillStyle = p.shelf;
    roundRect(ctx, room.x + room.w * 0.88, room.y + room.h * 0.42, room.w * 0.09, room.h * 0.24, minDim * 0.01);
    ctx.fill();

    /* front door */
    const glowDoor = S.fuses === 3;
    ctx.fillStyle = glowDoor ? '#ffd93d' : p.door;
    if (glowDoor) {
      ctx.shadowColor = '#ffd93d';
      ctx.shadowBlur = bright ? 22 : 14;
    }
    roundRect(ctx, room.x + room.w * 0.44, room.y - room.h * 0.005, room.w * 0.12, room.h * 0.07, minDim * 0.01);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.ink;
    ellipse(ctx, room.x + room.w * 0.53, room.y + room.h * 0.03, minDim * 0.008, minDim * 0.008);
    ctx.fill();

    /* dolls */
    for (const doll of S.dolls) {
      drawDoll(ctx, room, doll, p, minDim * 0.055, bright);
    }

    return room;
  };

  const draw = (ctx, view, time) => {
    const shakeX = S.shake > 0 ? Math.sin(time * 70) * S.shake * 6 : 0;
    const shakeY = S.shake > 0 ? Math.cos(time * 61) * S.shake * 4 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const room = drawScene(ctx, view, false);
    const minDim = Math.min(room.w, room.h);
    const player = toPx(room, S.player.x, S.player.y);
    const angle = S.player.angle;
    const coneLength = minDim * 0.62;
    const spread = 0.52;

    /* the torch beam: redraw the room brightly inside the cone */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, coneLength, angle - spread, angle + spread);
    ctx.closePath();
    ctx.arc(player.x, player.y, minDim * 0.16, 0, TAU);
    ctx.clip();
    drawScene(ctx, view, true);
    ctx.restore();

    /* warm haze over the beam */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createRadialGradient(
      player.x,
      player.y,
      minDim * 0.02,
      player.x,
      player.y,
      coneLength
    );
    beam.addColorStop(0, 'rgba(255, 236, 170, 0.28)');
    beam.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, coneLength, angle - spread, angle + spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    /* fuses glow a little even in the dark, so they are findable */
    FUSE_SPOTS.forEach((spot, index) => {
      if (S.taken[index]) return;
      const p = toPx(room, spot.x, spot.y);
      const pulse = 0.55 + Math.sin(time * 4 + index) * 0.25;
      ctx.fillStyle = `rgba(255, 217, 61, ${pulse * 0.4})`;
      ellipse(ctx, p.x, p.y, minDim * 0.055, minDim * 0.055);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 217, 61, ${pulse})`;
      ctx.lineWidth = 2;
      roundRect(ctx, p.x - minDim * 0.016, p.y - minDim * 0.012, minDim * 0.032, minDim * 0.024, 2);
      ctx.stroke();
    });

    /* player, always visible */
    const bob = S.player.moving ? Math.sin(S.step) * minDim * 0.006 : 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ellipse(ctx, player.x, player.y + minDim * 0.035, minDim * 0.036, minDim * 0.014);
    ctx.fill();
    ctx.fillStyle = S.invuln > 0 && Math.sin(time * 30) > 0 ? '#8fd7ff' : '#ffd93d';
    ellipse(ctx, player.x, player.y + bob, minDim * 0.034, minDim * 0.036);
    ctx.fill();
    ctx.strokeStyle = '#0a0518';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0a0518';
    ellipse(ctx, player.x, player.y + bob - minDim * 0.008, minDim * 0.008, minDim * 0.008);
    ctx.fill();

    /* little torch glow at the player's feet */
    ctx.strokeStyle = 'rgba(255, 248, 231, 0.25)';
    ctx.lineWidth = 1.5;
    ellipse(ctx, player.x, player.y + bob, minDim * 0.05, minDim * 0.05);
    ctx.stroke();

    ctx.restore();

    if (S.flash > 0) {
      ctx.fillStyle = `rgba(200, 20, 60, ${S.flash * 0.5})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }

    drawText(ctx, S.fuses === 3 ? 'GET TO THE DOOR!' : 'FIND THE FUSES', view.w / 2, view.h * 0.035, {
      size: clamp(view.w * 0.02, 9, 16),
      pixel: true,
      color: S.fuses === 3 ? '#ffd93d' : '#bcacf0',
      shadow: '#0a0518',
    });
  };

  return { hud, update, draw, reset };
}
