/* ------------------------------------------------------------------ *
 * Mini-games
 * Each vacation ends in a boss encounter with its own mechanic. They all
 * run on one 960x540 canvas and share a tiny host API, so the adventure
 * code only has to say "play the level's encounter" and wait.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

/* roundRect is in every current browser, but keep older tablets working. */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + width, y, x + width, y + height, r);
    this.arcTo(x + width, y + height, x, y + height, r);
    this.arcTo(x, y + height, x, y, r);
    this.arcTo(x, y, x + width, y, r);
    this.closePath();
    return this;
  };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function text(ctx, value, x, y, size, color, align = 'center', weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function panel(ctx, x, y, width, height, fill, stroke = 'rgba(255,255,255,0.22)') {
  roundRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function star(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function background(ctx, g, top, bottom) {
  const gradient = ctx.createLinearGradient(0, 0, 0, g.h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, g.w, g.h);
}

function moveWithInput(g, x, y, speed, dt) {
  const pointer = g.input.pointer;
  if (pointer.down && pointer.inside) {
    const dx = pointer.x - x;
    const dy = pointer.y - y;
    const length = Math.hypot(dx, dy);
    if (length > 6) {
      const step = Math.min(length, speed * dt);
      return { x: x + (dx / length) * step, y: y + (dy / length) * step };
    }
    return { x, y };
  }

  let dx = 0;
  let dy = 0;
  if (g.input.left) dx -= 1;
  if (g.input.right) dx += 1;
  if (g.input.up) dy -= 1;
  if (g.input.down) dy += 1;
  const length = Math.hypot(dx, dy);
  if (!length) return { x, y };
  return { x: x + (dx / length) * speed * dt, y: y + (dy / length) * speed * dt };
}

/* ------------------------------------------------------------------ *
 * 1. The Chicken-Nado
 * ------------------------------------------------------------------ */
function placeChicken(g, player) {
  const edge = Math.floor(Math.random() * 4);
  const inset = 70;
  let x;
  let y;
  if (edge === 0) {
    x = -50;
    y = 140 + Math.random() * (g.h - 220);
  } else if (edge === 1) {
    x = g.w + 50;
    y = 140 + Math.random() * (g.h - 220);
  } else if (edge === 2) {
    x = inset + Math.random() * (g.w - inset * 2);
    y = 90;
  } else {
    x = inset + Math.random() * (g.w - inset * 2);
    y = g.h + 50;
  }

  const targetX = player.x + (Math.random() - 0.5) * 300;
  const targetY = player.y + (Math.random() - 0.5) * 240;
  const angle = Math.atan2(targetY - y, targetX - x);
  const speed = 108 + Math.random() * 60;

  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, wobble: Math.random() * 6 };
}

const chickenNado = {
  name: 'The Chicken-Nado',
  hint: 'Catch the supply crates. Dodge the chickens. The tornado is not helping.',
  init(g) {
    const config = g.config;
    const crates = [];
    for (let i = 0; i < config.goal; i += 1) {
      crates.push({
        x: 90 + Math.random() * (g.w - 180),
        y: 150 + Math.random() * (g.h - 240),
        alive: true,
        spin: Math.random() * TAU,
      });
    }

    const start = { x: g.w / 2, y: g.h - 90 };
    const chickens = [];
    for (let i = 0; i < config.chickens; i += 1) {
      chickens.push(placeChicken(g, start));
    }

    return {
      x: start.x,
      y: start.y,
      lives: config.lives,
      collected: 0,
      goal: config.goal,
      crates,
      chickens,
      invuln: 2.8,
      shake: 0,
      swirl: 0,
      message: '',
      messageTimer: 0,
      time: 0,
    };
  },
  update(g, dt, s) {
    s.time += dt;
    s.swirl += dt * 1.4;
    s.invuln = Math.max(0, s.invuln - dt);
    s.shake = Math.max(0, s.shake - dt * 3);
    s.messageTimer = Math.max(0, s.messageTimer - dt);

    const position = moveWithInput(g, s.x, s.y, 330, dt);
    s.x = clamp(position.x, 54, g.w - 54);
    s.y = clamp(position.y, 128, g.h - 40);

    s.crates.forEach((crate) => {
      crate.spin += dt;
      if (!crate.alive) return;
      if (distance(s.x, s.y, crate.x, crate.y) < 40) {
        crate.alive = false;
        s.collected += 1;
        g.sfx('pickup');
        s.message = '+1 supply crate';
        s.messageTimer = 1;
        g.progress(`${s.collected} / ${s.goal} crates · ${s.lives} luck`);
        if (s.collected >= s.goal) g.win();
      }
    });

    s.chickens.forEach((chicken) => {
      chicken.wobble += dt * 9;
      const flutter = Math.sin(chicken.wobble) * 26;
      const speed = Math.hypot(chicken.vx, chicken.vy) || 1;
      chicken.x += (chicken.vx + (-chicken.vy / speed) * flutter) * dt;
      chicken.y += (chicken.vy + (chicken.vx / speed) * flutter) * dt;

      const outside =
        chicken.x < -110 || chicken.x > g.w + 110 || chicken.y < 20 || chicken.y > g.h + 110;
      if (outside) Object.assign(chicken, placeChicken(g, s));

      if (s.invuln <= 0 && distance(s.x, s.y, chicken.x, chicken.y) < 34) {
        s.lives -= 1;
        s.invuln = 2.2;
        s.shake = 1;
        s.message = 'A chicken got you!';
        s.messageTimer = 1.2;
        g.sfx('bonk');
        // Scatter the flock so one hit does not chain into three.
        s.chickens.forEach((other) => {
          if (distance(s.x, s.y, other.x, other.y) < 220) Object.assign(other, placeChicken(g, s));
        });
        g.progress(`${s.collected} / ${s.goal} crates · ${s.lives} luck`);
        if (s.lives <= 0) g.fail('The tornado wins this round.');
      }
    });
  },
  draw(g, ctx, s) {
    background(ctx, g, '#5c3b2e', '#20151d');

    ctx.save();
    if (s.shake > 0) ctx.translate(Math.sin(s.time * 60) * 8 * s.shake, Math.cos(s.time * 50) * 6 * s.shake);

    // Tornado swirl.
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.ellipse(g.w / 2, 150 + i * 62, 260 - i * 28, 62 - i * 6, s.swirl + i * 0.4, 0, TAU);
      ctx.strokeStyle = '#f5d9a8';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();

    // Buffet counter.
    panel(ctx, 24, 92, g.w - 48, 26, 'rgba(255, 240, 210, 0.16)');
    text(ctx, 'ALL YOU CAN SURVIVE BUFFET', g.w / 2, 106, 16, '#ffe9c4');

    s.crates.forEach((crate) => {
      if (!crate.alive) return;
      ctx.save();
      ctx.translate(crate.x, crate.y);
      ctx.rotate(Math.sin(crate.spin * 2) * 0.12);
      roundRect(ctx, -18, -18, 36, 36, 6);
      ctx.fillStyle = '#e0a45f';
      ctx.fill();
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();
      ctx.restore();
    });

    s.chickens.forEach((chicken) => {
      const angle = Math.atan2(chicken.vy, chicken.vx);
      ctx.save();
      ctx.translate(chicken.x, chicken.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = '#fff7ea';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 20, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(6, -16);
      ctx.lineTo(-6, -16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d8494c';
      ctx.beginPath();
      ctx.arc(0, -20, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    // The kid.
    const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#3cc9c0';
      roundRect(ctx, -20, -14, 40, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#f2c49b';
      ctx.beginPath();
      ctx.arc(0, -24, 16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a2231';
      ctx.beginPath();
      ctx.arc(0, -30, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#241a20';
      ctx.beginPath();
      ctx.arc(-6, -24, 2.4, 0, TAU);
      ctx.arc(6, -24, 2.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (s.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, s.messageTimer * 2);
      text(ctx, s.message, g.w / 2, 68, 24, '#ffd86b');
      ctx.globalAlpha = 1;
    }

    // Lives.
    for (let i = 0; i < 3; i += 1) {
      star(ctx, 46 + i * 34, 44, 12, i < s.lives ? '#ffd86b' : 'rgba(255,255,255,0.18)');
    }

    ctx.restore();
  },
};

/* ------------------------------------------------------------------ *
 * 2. Shuffleboard
 * ------------------------------------------------------------------ */
const shuffleboard = {
  name: 'Shuffleboard Showdown',
  hint: 'Aim with the arrows, hold to charge, release to slide. Six points wins.',
  init(g) {
    return {
      angle: 0,
      charging: false,
      power: 0,
      powerDirection: 1,
      phase: 'aim',
      puck: null,
      score: 0,
      roundsLeft: g.config.rounds,
      target: g.config.target,
      message: 'Slide when ready.',
      resultTimer: 0,
    };
  },
  update(g, dt, s) {
    const laneCenter = g.w / 2;
    if (s.phase === 'result') {
      s.resultTimer -= dt;
      if (s.resultTimer <= 0) {
        if (s.roundsLeft <= 0) {
          if (s.score >= s.target) g.win();
          else g.fail(`You needed ${s.target} points and slid ${s.score}.`);
          return;
        }
        s.phase = 'aim';
        s.angle = 0;
        s.power = 0;
        s.message = 'Slide when ready.';
      }
      return;
    }

    if (s.phase === 'slide') {
      const puck = s.puck;
      const friction = Math.pow(0.12, dt);
      puck.vx *= friction;
      puck.vy *= friction;
      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;

      if (Math.hypot(puck.vx, puck.vy) < 14) {
        const offset = distance(puck.x, puck.y, laneCenter, 128);
        const points = offset < 44 ? 3 : offset < 84 ? 2 : offset < 132 ? 1 : 0;
        s.score += points;
        s.roundsLeft -= 1;
        s.message = points ? `+${points} point${points > 1 ? 's' : ''}!` : 'Off the board. Brutal.';
        s.phase = 'result';
        s.resultTimer = 1.1;
        if (points) g.sfx('pickup');
        else g.sfx('fail');
        g.progress(`${s.score} / ${s.target} points · ${s.roundsLeft} pucks left`);
      }
      return;
    }

    // Aiming.
    if (g.input.left) s.angle = clamp(s.angle - dt * 0.7, -0.45, 0.45);
    if (g.input.right) s.angle = clamp(s.angle + dt * 0.7, -0.45, 0.45);

    const pointer = g.input.pointer;
    if (pointer.down && pointer.inside) {
      s.angle = clamp(((pointer.x - laneCenter) / (g.w / 2)) * 0.45, -0.45, 0.45);
    }

    const action = g.input.action;
    if (action && !s.charging) {
      s.charging = true;
      s.power = 0;
      s.powerDirection = 1;
    }
    if (s.charging) {
      s.power += s.powerDirection * dt * 1.5;
      if (s.power >= 1) {
        s.power = 1;
        s.powerDirection = -1;
      }
      if (s.power <= 0) {
        s.power = 0;
        s.powerDirection = 1;
      }
      if (!action) {
        s.charging = false;
        const speed = 260 + s.power * 640;
        s.puck = {
          x: laneCenter + Math.sin(s.angle) * 20,
          y: g.h - 76,
          vx: Math.sin(s.angle) * speed,
          vy: -Math.cos(s.angle) * speed,
        };
        s.phase = 'slide';
        s.message = '';
        g.sfx('click');
      }
    }
  },
  draw(g, ctx, s) {
    background(ctx, g, '#3b2a2a', '#1d1620');
    const laneCenter = g.w / 2;

    // Lane.
    ctx.save();
    roundRect(ctx, 140, 70, g.w - 280, g.h - 100, 22);
    ctx.fillStyle = '#c8a06a';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#8a5a3b';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(120, 78, 44, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      ctx.moveTo(160, 120 + i * 30);
      ctx.lineTo(g.w - 160, 120 + i * 30);
      ctx.stroke();
    }
    ctx.restore();

    // Targets.
    const rings = [
      { r: 132, color: 'rgba(255, 217, 61, 0.16)', label: '1' },
      { r: 84, color: 'rgba(255, 170, 61, 0.22)', label: '2' },
      { r: 44, color: 'rgba(255, 90, 90, 0.3)', label: '3' },
    ];
    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(laneCenter, 128, ring.r, 0, TAU);
      ctx.fillStyle = ring.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 245, 220, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    text(ctx, '3', laneCenter, 128, 28, '#fff3d2');
    text(ctx, '2', laneCenter, 128 + 64, 20, '#ffe1a8');
    text(ctx, '1', laneCenter, 128 + 108, 18, '#ffd2a8');

    // Aim guide.
    if (s.phase === 'aim') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 246, 224, 0.7)';
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(laneCenter, g.h - 76);
      const reach = 320;
      ctx.lineTo(laneCenter + Math.sin(s.angle) * reach, g.h - 76 - Math.cos(s.angle) * reach);
      ctx.stroke();
      ctx.restore();
    }

    // Power meter.
    panel(ctx, 40, g.h - 120, 70, 96, 'rgba(20, 14, 26, 0.7)');
    roundRect(ctx, 56, g.h - 104, 38, 64, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    const height = 64 * s.power;
    roundRect(ctx, 56, g.h - 40 - height, 38, height, 8);
    ctx.fillStyle = s.power > 0.8 ? '#ff5a5a' : '#ffd86b';
    ctx.fill();
    text(ctx, 'POWER', 75, g.h - 128, 12, '#ffe9c4');

    // Puck.
    const puck = s.puck && s.phase === 'slide' ? s.puck : { x: laneCenter + Math.sin(s.angle) * 20, y: g.h - 76 };
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, 22, 0, TAU);
    ctx.fillStyle = '#f4e5c9';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#8a5a3b';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, 10, 0, TAU);
    ctx.fillStyle = '#d8494c';
    ctx.fill();

    // Score card.
    panel(ctx, g.w - 220, 20, 190, 44, 'rgba(20, 14, 26, 0.6)');
    text(ctx, `${s.score} / ${s.target} pts · ${s.roundsLeft} pucks`, g.w - 125, 42, 18, '#ffe9c4');

    if (s.charging) text(ctx, 'Release!', g.w / 2, g.h - 40, 22, '#ffd86b');
    else if (s.message) text(ctx, s.message, g.w / 2, g.h - 40, 20, '#ffe9c4');
  },
};

/* ------------------------------------------------------------------ *
 * 3. Mine cart escape
 * ------------------------------------------------------------------ */
const minecart = {
  name: 'Mine Cart Escape',
  hint: 'Steer the cart. Grab ten crystals. Rocks are not crystals.',
  init(g) {
    return {
      x: g.w / 2,
      lives: g.config.lives,
      collected: 0,
      goal: g.config.goal,
      rocks: [],
      crystals: [],
      scroll: 0,
      spawnRock: 0.4,
      spawnCrystal: 0.9,
      invuln: 0,
      shake: 0,
      speed: 250,
      time: 0,
    };
  },
  update(g, dt, s) {
    s.time += dt;
    s.invuln = Math.max(0, s.invuln - dt);
    s.shake = Math.max(0, s.shake - dt * 3);
    s.speed = 250 + Math.min(180, s.time * 14);

    const pointerX = g.input.pointer;
    let moveX = 0;
    if (g.input.left) moveX -= 1;
    if (g.input.right) moveX += 1;
    if (pointerX.down && pointerX.inside) {
      const dx = pointerX.x - s.x;
      if (Math.abs(dx) > 8) moveX = Math.sign(dx) * Math.min(1, Math.abs(dx) / 60);
    }
    s.x = clamp(s.x + moveX * 430 * dt, 70, g.w - 70);

    s.spawnRock -= dt;
    if (s.spawnRock <= 0) {
      s.spawnRock = Math.max(0.26, 0.62 - s.time * 0.012);
      s.rocks.push({ x: 74 + Math.random() * (g.w - 148), y: -40, r: 22 + Math.random() * 16, spin: Math.random() * TAU });
    }

    s.spawnCrystal -= dt;
    if (s.spawnCrystal <= 0) {
      s.spawnCrystal = 0.65 + Math.random() * 0.5;
      s.crystals.push({ x: 90 + Math.random() * (g.w - 180), y: -30 });
    }

    s.rocks.forEach((rock) => {
      rock.y += s.speed * dt;
      rock.spin += dt * 2;
      if (s.invuln <= 0 && distance(s.x, 430, rock.x, rock.y) < rock.r + 22) {
        s.lives -= 1;
        s.invuln = 1.4;
        s.shake = 1;
        rock.y = g.h + 60;
        g.sfx('bonk');
        g.progress(`${s.collected} / ${s.goal} crystals · ${s.lives} luck`);
        if (s.lives <= 0) g.fail('The cart is now a pile of planks.');
      }
    });

    s.crystals.forEach((crystal) => {
      crystal.y += s.speed * dt;
      crystal.spin = (crystal.spin ?? 0) + dt * 3;
      if (distance(s.x, 430, crystal.x, crystal.y) < 44) {
        crystal.y = g.h + 60;
        s.collected += 1;
        g.sfx('pickup');
        g.progress(`${s.collected} / ${s.goal} crystals · ${s.lives} luck`);
        if (s.collected >= s.goal) g.win();
      }
    });

    s.rocks = s.rocks.filter((rock) => rock.y < g.h + 80);
    s.crystals = s.crystals.filter((crystal) => crystal.y < g.h + 80);
  },
  draw(g, ctx, s) {
    background(ctx, g, '#2a1d18', '#120d10');
    const offset = (s.scroll + s.time * s.speed) % 80;

    ctx.save();
    if (s.shake > 0) ctx.translate(Math.sin(s.time * 70) * 7 * s.shake, 0);

    // Rails.
    ctx.strokeStyle = '#6d5240';
    ctx.lineWidth = 26;
    [120, g.w - 120].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, g.h);
      ctx.stroke();
    });
    ctx.strokeStyle = '#c9a06b';
    ctx.lineWidth = 8;
    [120, g.w - 120].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, g.h);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(120, 90, 60, 0.4)';
    ctx.lineWidth = 5;
    for (let y = -80; y < g.h + 80; y += 80) {
      const pos = y + offset;
      ctx.beginPath();
      ctx.moveTo(90, pos);
      ctx.lineTo(g.w - 90, pos);
      ctx.stroke();
    }

    s.rocks.forEach((rock) => {
      ctx.save();
      ctx.translate(rock.x, rock.y);
      ctx.rotate(rock.spin);
      ctx.fillStyle = '#7d7f8f';
      ctx.beginPath();
      for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * TAU;
        ctx.lineTo(Math.cos(angle) * rock.r, Math.sin(angle) * rock.r * 0.9);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5c5f70';
      ctx.beginPath();
      ctx.arc(-rock.r * 0.25, -rock.r * 0.2, rock.r * 0.32, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    s.crystals.forEach((crystal) => {
      ctx.save();
      ctx.translate(crystal.x, crystal.y);
      ctx.rotate((crystal.spin ?? 0) * 0.2);
      ctx.fillStyle = '#84f7ff';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 20);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // Cart.
    const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;
    ctx.save();
    ctx.translate(s.x, 430);
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.fillStyle = '#8a5a3b';
    roundRect(ctx, -46, -26, 92, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#5e3b26';
    roundRect(ctx, -38, -18, 76, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffe9c4';
    ctx.beginPath();
    ctx.arc(0, -30, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a2231';
    ctx.beginPath();
    ctx.arc(0, -36, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#241a20';
    ctx.beginPath();
    ctx.arc(-6, -30, 2.4, 0, TAU);
    ctx.arc(6, -30, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#20202c';
    [-30, 30].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 24, 12, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    ctx.restore();

    for (let i = 0; i < 3; i += 1) {
      star(ctx, 46 + i * 34, 44, 12, i < s.lives ? '#ffd86b' : 'rgba(255,255,255,0.18)');
    }
    panel(ctx, g.w - 210, 20, 180, 44, 'rgba(20, 14, 26, 0.6)');
    text(ctx, `${s.collected} / ${s.goal} crystals`, g.w - 120, 42, 18, '#a9f7ff');
  },
};

/* ------------------------------------------------------------------ *
 * 4. The Storybook Clock
 * ------------------------------------------------------------------ */
const CHIMES = ['🌙', '☀️', '⭐'];

const clockwork = {
  name: 'The Storybook Clock',
  hint: 'Pick a hand with left and right, turn it with up and down. Match the card.',
  init(g) {
    const rounds = Array.isArray(g.config.rounds) ? g.config.rounds : [{ hour: 7, minute: 6, chime: '🌙' }];
    return {
      rounds,
      index: 0,
      selected: 0,
      hour: 3,
      minute: 2,
      chime: 1,
      solved: 0,
      celebrate: 0,
      message: '',
    };
  },
  update(g, dt, s) {
    if (s.celebrate > 0) {
      s.celebrate -= dt;
      if (s.celebrate <= 0) {
        s.index += 1;
        if (s.index >= s.rounds.length) {
          g.win();
          return;
        }
        s.hour = 1 + Math.floor(Math.random() * 12);
        s.minute = Math.floor(Math.random() * 12);
        s.chime = Math.floor(Math.random() * CHIMES.length);
        s.message = '';
      }
      return;
    }

    if (g.input.pressed.left) {
      s.selected = (s.selected + 2) % 3;
      g.sfx('click');
    }
    if (g.input.pressed.right) {
      s.selected = (s.selected + 1) % 3;
      g.sfx('click');
    }

    const direction = g.input.pressed.up ? 1 : g.input.pressed.down ? -1 : 0;
    if (direction) {
      if (s.selected === 0) s.hour = ((s.hour - 1 + direction + 12) % 12) + 1;
      if (s.selected === 1) s.minute = (s.minute + direction + 12) % 12;
      if (s.selected === 2) s.chime = (s.chime + direction + CHIMES.length) % CHIMES.length;
      g.sfx('click');
    }

    const target = s.rounds[s.index];
    const targetChime = CHIMES.indexOf(target.chime);
    if (s.hour === target.hour && s.minute === target.minute && s.chime === targetChime) {
      s.celebrate = 1.1;
      s.message = 'CLUNK. Something enormous turns over.';
      g.sfx('pickup');
      g.progress(`Chime ${s.index + 1} / ${s.rounds.length} restored`);
    }
  },
  draw(g, ctx, s) {
    background(ctx, g, '#2b1f4a', '#171028');
    const target = s.rounds[s.index] ?? s.rounds[0];
    const centerX = g.w / 2;
    const centerY = 250;
    const minutes = s.minute * 5;
    const hourAngle = ((s.hour % 12) + minutes / 60) / 12 * TAU - Math.PI / 2;
    const minuteAngle = (minutes / 60) * TAU - Math.PI / 2;

    // Clock body.
    ctx.beginPath();
    ctx.arc(centerX, centerY, 168, 0, TAU);
    ctx.fillStyle = '#f4e5c9';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#8a5a3b';
    ctx.stroke();

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * TAU - Math.PI / 2;
      text(
        ctx,
        String(i === 0 ? 12 : i),
        centerX + Math.cos(angle) * 132,
        centerY + Math.sin(angle) * 132,
        24,
        '#5e3b26'
      );
    }

    // Hands.
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(hourAngle);
    roundRect(ctx, -10, -84, 20, 96, 8);
    ctx.fillStyle = s.selected === 0 ? '#ff2e63' : '#3a2a44';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(minuteAngle);
    roundRect(ctx, -7, -132, 14, 144, 6);
    ctx.fillStyle = s.selected === 1 ? '#ff8a3d' : '#3a2a44';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 16, 0, TAU);
    ctx.fillStyle = '#ffd86b';
    ctx.fill();

    // Chime dial.
    panel(ctx, centerX - 56, centerY + 186, 112, 66, 'rgba(20, 14, 26, 0.6)', s.selected === 2 ? '#ffd86b' : undefined);
    text(ctx, CHIMES[s.chime], centerX, centerY + 218, 40, '#fff6e0');

    // Target card.
    panel(ctx, 40, 30, 300, 96, 'rgba(255, 246, 224, 0.1)');
    text(ctx, 'THE PARK NEEDS', 60, 54, 14, '#c9b6ff', 'left');
    const shownMinute = String(target.minute * 5).padStart(2, '0');
    text(ctx, `${target.hour}:${shownMinute} ${target.chime}`, 60, 92, 34, '#ffe9c4', 'left');

    // Selection chips.
    ['HOUR', 'MINUTE', 'CHIME'].forEach((label, index) => {
      const x = 200 + index * 190;
      panel(ctx, x, 470, 170, 54, index === s.selected ? 'rgba(255, 216, 107, 0.22)' : 'rgba(20, 14, 26, 0.5)', index === s.selected ? '#ffd86b' : undefined);
      text(ctx, label, x + 85, 497, 16, index === s.selected ? '#ffd86b' : '#cfc0e8');
    });

    if (s.celebrate > 0) {
      ctx.fillStyle = 'rgba(255, 236, 170, 0.14)';
      ctx.fillRect(0, 0, g.w, g.h);
      text(ctx, 'CLUNK!', g.w / 2, 120, 54, '#ffd86b');
      text(ctx, s.message, g.w / 2, 166, 20, '#fff6e0');
    }
  },
};

/* ------------------------------------------------------------------ *
 * 5. Mirror lab
 * ------------------------------------------------------------------ */
const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function reflect(direction, mirror) {
  const index = DIRS.findIndex((entry) => entry.x === direction.x && entry.y === direction.y);
  // 0 = '/', 1 = '\'
  if (mirror === 0) return DIRS[(index + 3) % 4];
  return DIRS[(index + 1) % 4];
}

function traceBeam(grid, mirrors, source, target) {
  let x = source.x;
  let y = source.y;
  let direction = DIRS[0];
  const path = [{ x, y }];
  let hit = false;
  let guard = 0;

  while (guard < 80) {
    guard += 1;
    x += direction.x;
    y += direction.y;
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) break;
    path.push({ x, y });
    if (target && x === target.x && y === target.y) {
      hit = true;
      break;
    }
    const found = mirrors.find((mirror) => mirror.x === x && mirror.y === y);
    if (found) direction = reflect(direction, found.dir);
  }

  return { path, hit };
}

const mirrorLab = {
  name: "The Inventor's Light Puzzle",
  hint: 'Tap a mirror to turn it. Bend the beam into the prism.',
  init(g) {
    const round = mirrorLabRound(g, 0);
    return {
      roundIndex: 0,
      totalRounds: g.config.rounds ?? 2,
      round,
      selection: { x: round.mirrors[0]?.x ?? 0, y: round.mirrors[0]?.y ?? 0 },
      solvedTimer: 0,
      flash: 0,
      message: '',
    };
  },
  update(g, dt, s) {
    const cellSize = 82;
    const offsetX = (g.w - s.round.grid.w * cellSize) / 2;
    const offsetY = 96;

    if (s.solvedTimer > 0) {
      s.solvedTimer -= dt;
      if (s.solvedTimer <= 0) {
        s.roundIndex += 1;
        if (s.roundIndex >= s.totalRounds) {
          g.win();
          return;
        }
        s.round = mirrorLabRound(g, s.roundIndex);
        s.selection = { x: s.round.mirrors[0]?.x ?? 0, y: s.round.mirrors[0]?.y ?? 0 };
        s.message = 'The light holds. Next contraption.';
        g.progress(`Contraption ${s.roundIndex + 1} / ${s.totalRounds}`);
      }
      return;
    }

    const pointer = g.input.pointer;
    if (pointer.justDown) {
      const cellX = Math.floor((pointer.x - offsetX) / cellSize);
      const cellY = Math.floor((pointer.y - offsetY) / cellSize);
      const mirror = s.round.mirrors.find((entry) => entry.x === cellX && entry.y === cellY);
      if (mirror) {
        mirror.dir = 1 - mirror.dir;
        s.selection = { x: cellX, y: cellY };
        s.flash = 0.2;
        g.sfx('click');
      }
    }

    if (g.input.pressed.left) s.selection.x = clamp(s.selection.x - 1, 0, s.round.grid.w - 1);
    if (g.input.pressed.right) s.selection.x = clamp(s.selection.x + 1, 0, s.round.grid.w - 1);
    if (g.input.pressed.up) s.selection.y = clamp(s.selection.y - 1, 0, s.round.grid.h - 1);
    if (g.input.pressed.down) s.selection.y = clamp(s.selection.y + 1, 0, s.round.grid.h - 1);

    if (g.input.actionPressed) {
      const mirror = s.round.mirrors.find((entry) => entry.x === s.selection.x && entry.y === s.selection.y);
      if (mirror) {
        mirror.dir = 1 - mirror.dir;
        s.flash = 0.2;
        g.sfx('click');
      }
    }

    s.flash = Math.max(0, s.flash - dt);

    const trail = traceBeam(s.round.grid, s.round.mirrors, s.round.source, s.round.target);
    s.beam = trail;
    if (trail.hit) {
      s.solvedTimer = 1.2;
      s.message = 'The prism lights up!';
      g.sfx('win');
    }
  },
  draw(g, ctx, s) {
    background(ctx, g, '#152238', '#0b1220');
    const cellSize = 82;
    const offsetX = (g.w - s.round.grid.w * cellSize) / 2;
    const offsetY = 96;

    // Grid.
    for (let y = 0; y < s.round.grid.h; y += 1) {
      for (let x = 0; x < s.round.grid.w; x += 1) {
        const px = offsetX + x * cellSize;
        const py = offsetY + y * cellSize;
        roundRect(ctx, px + 3, py + 3, cellSize - 6, cellSize - 6, 8);
        ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(124, 231, 255, 0.08)' : 'rgba(124, 231, 255, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(124, 231, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Beam.
    const beam = s.beam ?? traceBeam(s.round.grid, s.round.mirrors, s.round.source, s.round.target);
    ctx.save();
    ctx.strokeStyle = '#ffd86b';
    ctx.shadowColor = '#ffd86b';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 6;
    ctx.beginPath();
    beam.path.forEach((point, index) => {
      const px = offsetX + point.x * cellSize + cellSize / 2;
      const py = offsetY + point.y * cellSize + cellSize / 2;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    // Source.
    if (beam.path.length) {
      const start = beam.path[0];
      const px = offsetX + start.x * cellSize + cellSize / 2;
      const py = offsetY + start.y * cellSize + cellSize / 2;
      panel(ctx, offsetX - 66, py - 26, 62, 52, '#ffd86b');
      text(ctx, '☀', px - 34, py, 26, '#2a2038');
    }

    // Mirrors.
    s.round.mirrors.forEach((mirror) => {
      const px = offsetX + mirror.x * cellSize + cellSize / 2;
      const py = offsetY + mirror.y * cellSize + cellSize / 2;
      ctx.save();
      ctx.translate(px, py);
      roundRect(ctx, -30, -30, 60, 60, 10);
      ctx.fillStyle = 'rgba(196, 220, 255, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(196, 220, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#e8f4ff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      if (mirror.dir === 0) {
        ctx.moveTo(-18, 18);
        ctx.lineTo(18, -18);
      } else {
        ctx.moveTo(-18, -18);
        ctx.lineTo(18, 18);
      }
      ctx.stroke();
      ctx.restore();
    });

    // Target prism.
    const targetX = offsetX + s.round.target.x * cellSize + cellSize / 2;
    const targetY = offsetY + s.round.target.y * cellSize + cellSize / 2;
    ctx.save();
    ctx.translate(targetX, targetY);
    ctx.rotate(s.solvedTimer > 0 ? Math.sin(s.solvedTimer * 20) * 0.2 : 0);
    ctx.fillStyle = s.solvedTimer > 0 ? '#a9ffd8' : '#7ce7ff';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(24, 18);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Selection ring.
    const sx = offsetX + s.selection.x * cellSize + cellSize / 2;
    const sy = offsetY + s.selection.y * cellSize + cellSize / 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, TAU);
    ctx.strokeStyle = '#ffd86b';
    ctx.lineWidth = 3;
    ctx.stroke();

    panel(ctx, g.w - 250, 22, 220, 48, 'rgba(10, 20, 32, 0.7)');
    text(ctx, `Contraption ${s.roundIndex + 1} / ${s.totalRounds}`, g.w - 140, 46, 17, '#a9e9ff');

    if (s.solvedTimer > 0) {
      ctx.fillStyle = 'rgba(124, 231, 255, 0.12)';
      ctx.fillRect(0, 0, g.w, g.h);
      text(ctx, s.message, g.w / 2, 62, 24, '#a9ffd8');
    }
  },
};

/** Fresh puzzle round, shared by init and the next-round transition. */
function mirrorLabRound(g, roundIndex) {
  const grid = { w: 7, h: 5 };
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const mirrorCount = Math.min(6, (g.config.mirrors ?? 4) + roundIndex);
    const mirrors = [];
    while (mirrors.length < mirrorCount) {
      const cell = {
        x: 1 + Math.floor(Math.random() * (grid.w - 1)),
        y: Math.floor(Math.random() * grid.h),
        dir: Math.random() < 0.5 ? 0 : 1,
      };
      if (!mirrors.some((mirror) => mirror.x === cell.x && mirror.y === cell.y)) mirrors.push(cell);
    }
    const source = { x: -1, y: Math.floor(Math.random() * grid.h) };
    const trail = traceBeam(grid, mirrors, source, null);
    const end = trail.path[trail.path.length - 1];
    if (!end || end.x < 3 || end.x >= grid.w) continue;
    if (mirrors.some((mirror) => mirror.x === end.x && mirror.y === end.y)) continue;

    const target = { x: end.x, y: end.y };
    for (let scramble = 0; scramble < 30; scramble += 1) {
      mirrors.forEach((mirror) => {
        mirror.dir = Math.random() < 0.5 ? 0 : 1;
      });
      if (!traceBeam(grid, mirrors, source, target).hit) break;
    }
    return { grid, mirrors, source, target };
  }

  return {
    grid,
    mirrors: [
      { x: 2, y: 2, dir: 0 },
      { x: 4, y: 1, dir: 1 },
    ],
    source: { x: -1, y: 2 },
    target: { x: 6, y: 1 },
  };
}

/* ------------------------------------------------------------------ *
 * 6. Light mixing
 * ------------------------------------------------------------------ */
const PRISM_TARGETS = [
  { r: 5, g: 2, b: 0, name: 'Sunset' },
  { r: 0, g: 4, b: 4, name: 'Lagoon' },
  { r: 5, g: 5, b: 1, name: 'Lemonade' },
  { r: 3, g: 1, b: 5, name: 'Moonlight' },
  { r: 5, g: 1, b: 3, name: 'Rose' },
  { r: 1, g: 5, b: 2, name: 'Mint' },
];

const prism = {
  name: 'The Living Light Sculpture',
  hint: 'Three lights make every color. Match the sculpture’s color twice.',
  init(g) {
    const rounds = g.config.rounds ?? 2;
    let targetIndex = Math.floor(Math.random() * PRISM_TARGETS.length);
    return {
      rounds,
      roundIndex: 0,
      targetIndex,
      target: PRISM_TARGETS[targetIndex],
      current: { r: 2, g: 3, b: 1 },
      selected: 0,
      solved: false,
      celebrate: 0,
      message: '',
    };
  },
  update(g, dt, s) {
    if (s.celebrate > 0) {
      s.celebrate -= dt;
      if (s.celebrate <= 0) {
        s.roundIndex += 1;
        if (s.roundIndex >= s.rounds) {
          g.win();
          return;
        }
        s.targetIndex = (s.targetIndex + 1 + Math.floor(Math.random() * (PRISM_TARGETS.length - 1))) % PRISM_TARGETS.length;
        s.target = PRISM_TARGETS[s.targetIndex];
        s.solved = false;
        s.message = '';
        g.progress(`Color ${s.roundIndex + 1} / ${s.rounds}`);
      }
      return;
    }

    if (g.input.pressed.left) s.selected = (s.selected + 2) % 3;
    if (g.input.pressed.right) s.selected = (s.selected + 1) % 3;
    const channel = ['r', 'g', 'b'][s.selected];
    if (g.input.pressed.up) s.current[channel] = clamp(s.current[channel] + 1, 0, 5);
    if (g.input.pressed.down) s.current[channel] = clamp(s.current[channel] - 1, 0, 5);

    const pointer = g.input.pointer;
    if (pointer.down && pointer.inside) {
      const barWidth = 150;
      const startX = g.w / 2 - 260;
      ['r', 'g', 'b'].forEach((key, index) => {
        const x = startX + index * (barWidth + 60);
        if (pointer.x > x - 20 && pointer.x < x + barWidth + 20) {
          s.selected = index;
          const value = clamp(Math.round(((pointer.y - 200) / 190) * 5), 0, 5);
          s.current[key] = 5 - value;
        }
      });
    }

    const match =
      Math.abs(s.current.r - s.target.r) <= 1 &&
      Math.abs(s.current.g - s.target.g) <= 1 &&
      Math.abs(s.current.b - s.target.b) <= 1;

    if (match && !s.solved) {
      s.solved = true;
      s.celebrate = 1.3;
      s.message = 'The sculpture exhales a very small rainbow.';
      g.sfx('win');
    } else if (!match) {
      s.solved = false;
    }
  },
  draw(g, ctx, s) {
    background(ctx, g, '#101a3a', '#070b16');

    const glow = ctx.createRadialGradient(g.w / 2, 120, 20, g.w / 2, 120, 380);
    glow.addColorStop(0, 'rgba(124, 231, 255, 0.28)');
    glow.addColorStop(1, 'rgba(124, 231, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.w, g.h);

    const targetColor = `rgb(${s.target.r * 51}, ${s.target.g * 51}, ${s.target.b * 51})`;
    const currentColor = `rgb(${s.current.r * 51}, ${s.current.g * 51}, ${s.current.b * 51})`;

    // Target sculpture.
    ctx.beginPath();
    ctx.arc(g.w / 2, 130, 84, 0, TAU);
    ctx.fillStyle = targetColor;
    ctx.shadowColor = targetColor;
    ctx.shadowBlur = 60;
    ctx.fill();
    ctx.shadowBlur = 0;
    text(ctx, `“${s.target.name}”`, g.w / 2, 244, 24, '#dfe9ff');

    // Current mix.
    ctx.beginPath();
    ctx.arc(g.w / 2, 330, 52, 0, TAU);
    ctx.fillStyle = currentColor;
    ctx.fill();
    ctx.strokeStyle = s.solved ? '#a9ffd8' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();
    text(ctx, s.solved ? 'MATCH!' : 'your light', g.w / 2, 336, 14, '#0b1020');

    // Sliders.
    const barWidth = 150;
    const startX = g.w / 2 - 260;
    ['r', 'g', 'b'].forEach((key, index) => {
      const x = startX + index * (barWidth + 60);
      const active = index === s.selected;
      panel(ctx, x - 16, 180, barWidth + 32, 220, active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)');
      for (let value = 0; value < 6; value += 1) {
        const cellY = 392 - value * 34;
        roundRect(ctx, x, cellY - 26, barWidth, 26, 5);
        ctx.fillStyle =
          value <= s.current[key]
            ? key === 'r'
              ? '#ff6b6b'
              : key === 'g'
                ? '#5ee88a'
                : '#6ba8ff'
            : 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
      text(ctx, key.toUpperCase(), x + barWidth / 2, 420, 18, active ? '#ffd86b' : '#9fb4d8');
      text(ctx, String(s.current[key]), x + barWidth / 2, 168, 22, '#fff6e0');
    });

    text(ctx, '← → pick a light   ↑ ↓ turn it up', g.w / 2, 486, 18, '#9fb4d8');
    panel(ctx, g.w - 220, 22, 190, 46, 'rgba(10, 20, 40, 0.7)');
    text(ctx, `Color ${Math.min(s.roundIndex + 1, s.rounds)} / ${s.rounds}`, g.w - 125, 46, 17, '#a9e9ff');

    if (s.celebrate > 0) text(ctx, s.message, g.w / 2, 100, 20, '#a9ffd8');
  },
};

/* ------------------------------------------------------------------ *
 * 7. The Vacation Collector
 * ------------------------------------------------------------------ */
const FINALE_MEMORIES = ['🧳', '🎟️', '📷', '🪨'];

const finale = {
  name: 'The Vacation Collector',
  hint: 'Three stages: outrun the memories, focus the camera, then remember it all back.',
  init(g) {
    return {
      stage: 0,
      x: g.w / 2,
      y: g.h - 90,
      orbs: [],
      spawn: 0,
      lives: 3,
      survived: 0,
      surviveGoal: 15,
      focusMarker: 0,
      focusDirection: 1,
      focusZone: 0.34,
      focusHits: 0,
      focusMisses: 0,
      invuln: 1.6,
      sequence: [],
      input: [],
      showing: true,
      showIndex: -1,
      showTimer: 1,
      message: 'Outrun the memories!',
      messageTimer: 2,
      flash: 0,
      shake: 0,
    };
  },
  update(g, dt, s) {
    s.shake = Math.max(0, s.shake - dt * 3);
    s.flash = Math.max(0, s.flash - dt * 2);
    s.messageTimer = Math.max(0, s.messageTimer - dt);
    s.invuln = Math.max(0, s.invuln - dt);

    if (s.stage === 0) {
      const position = moveWithInput(g, s.x, s.y, 380, dt);
      s.x = clamp(position.x, 54, g.w - 54);
      s.y = clamp(position.y, 130, g.h - 44);
      s.survived += dt;

      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = 0.5;
        const edge = Math.floor(Math.random() * 4);
        const orb = {
          x: edge === 0 ? -30 : edge === 1 ? g.w + 30 : Math.random() * g.w,
          y: edge === 2 ? -30 : edge === 3 ? g.h + 30 : Math.random() * g.h,
          speed: 78 + Math.random() * 58,
          size: 12 + Math.random() * 10,
          age: 0,
          life: 3.6 + Math.random() * 1.2,
        };
        s.orbs.push(orb);
      }

      s.orbs.forEach((orb) => {
        if (orb.dead) return;
        orb.age = (orb.age ?? 0) + dt;
        // Orbs fade out so a long survival round does not become a wall of them.
        if (orb.age > (orb.life ?? 5)) {
          orb.dead = true;
          return;
        }
        const dx = s.x - orb.x;
        const dy = s.y - orb.y;
        const length = Math.hypot(dx, dy) || 1;
        orb.x += (dx / length) * orb.speed * dt;
        orb.y += (dy / length) * orb.speed * dt;
        if (s.invuln <= 0 && distance(s.x, s.y, orb.x, orb.y) < orb.size + 22) {
          orb.dead = true;
          s.lives -= 1;
          s.invuln = 2;
          s.shake = 1;
          s.flash = 0.5;
          g.sfx('bonk');
          if (s.lives <= 0) {
            g.fail('The memory orbs got you. The Collector adds another empty frame to its wall.');
            return;
          }
        }
      });
      s.orbs = s.orbs.filter((orb) => !orb.dead);
      g.progress(`Survive ${Math.max(0, Math.ceil(s.surviveGoal - s.survived))}s · ${s.lives} luck`);

      if (s.survived >= s.surviveGoal) {
        s.stage = 1;
        s.message = 'Now focus the camera!';
        s.messageTimer = 2;
        g.sfx('click');
      }
      return;
    }

    if (s.stage === 1) {
      s.focusMarker += s.focusDirection * dt * 0.85;
      if (s.focusMarker >= 1) {
        s.focusMarker = 1;
        s.focusDirection = -1;
      }
      if (s.focusMarker <= 0) {
        s.focusMarker = 0;
        s.focusDirection = 1;
      }

      if (g.input.actionPressed) {
        const inZone = Math.abs(s.focusMarker - 0.5) < s.focusZone / 2;
        if (inZone) {
          s.focusHits += 1;
          s.focusZone = Math.max(0.12, s.focusZone - 0.05);
          g.sfx('pickup');
          s.message = 'Click!';
          s.messageTimer = 0.6;
          if (s.focusHits >= 3) {
            s.stage = 2;
            s.message = 'Now remember it back.';
            s.messageTimer = 2;
            s.sequence = Array.from({ length: 5 }, () => Math.floor(Math.random() * FINALE_MEMORIES.length));
            s.input = [];
            s.showing = true;
            s.showIndex = -1;
            s.showTimer = 0.7;
            g.sfx('clue');
          }
        } else {
          s.focusMisses += 1;
          g.sfx('fail');
          s.message = 'Blurry. Try again.';
          s.messageTimer = 0.8;
          if (s.focusMisses >= 3) {
            g.fail('The camera never found the family in the frame.');
          }
        }
      }
      g.progress(`Focus ${s.focusHits} / 3 · ${3 - s.focusMisses} tries left`);
      return;
    }

    // Stage 3: repeat the sequence.
    if (s.showing) {
      s.showTimer -= dt;
      if (s.showTimer <= 0) {
        s.showIndex += 1;
        s.showTimer = 0.55;
        if (s.showIndex >= s.sequence.length) {
          s.showing = false;
          s.message = 'Now you!';
          s.messageTimer = 1;
        } else {
          g.sfx('click');
        }
      }
      return;
    }

    const push = (value) => {
      if (s.input.length >= s.sequence.length) return;
      if (value !== s.sequence[s.input.length]) {
        g.fail('The memory slipped. It was already fading.');
        return;
      }
      s.input.push(value);
      g.sfx('click');
      g.progress(`Remember ${s.input.length} / ${s.sequence.length}`);
      if (s.input.length >= s.sequence.length) g.win();
    };

    if (g.input.pointer.justDown && g.input.pointer.inside) {
      const pointerX = g.input.pointer.x;
      const pointerY = g.input.pointer.y;
      const startX = g.w / 2 - (FINALE_MEMORIES.length - 1) * 75;
      for (let index = 0; index < FINALE_MEMORIES.length; index += 1) {
        const x = startX + index * 150;
        if (pointerX > x - 58 && pointerX < x + 58 && pointerY > 300 && pointerY < 416) {
          push(index);
          break;
        }
      }
    }

    (g.input.choices ?? []).forEach((pressed, index) => {
      if (pressed) push(index);
    });

    g.progress(`Remember ${s.input.length} / ${s.sequence.length}`);
  },
  draw(g, ctx, s) {
    background(ctx, g, '#231a3c', '#0f0a18');
    const vibe = ctx.createRadialGradient(g.w / 2, g.h / 2, 60, g.w / 2, g.h / 2, 520);
    vibe.addColorStop(0, 'rgba(255, 46, 99, 0.16)');
    vibe.addColorStop(1, 'rgba(255, 46, 99, 0)');
    ctx.fillStyle = vibe;
    ctx.fillRect(0, 0, g.w, g.h);

    ctx.save();
    if (s.shake > 0) ctx.translate(Math.sin(s.survived * 70) * 8 * s.shake, Math.cos(s.survived * 60) * 8 * s.shake);

    if (s.stage === 0) {
      // Collector silhouette in the corners.
      ctx.fillStyle = 'rgba(10, 5, 16, 0.8)';
      [[-40, -40], [g.w - 130, -40], [-40, g.h - 130], [g.w - 130, g.h - 130]].forEach(([x, y]) => {
        roundRect(ctx, x, y, 170, 170, 26);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(255, 216, 107, 0.7)';
      [[0, 60], [g.w - 34, 60], [0, g.h - 60], [g.w - 34, g.h - 60]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x + 14, y, 6, 0, TAU);
        ctx.fill();
      });

      s.orbs.forEach((orb) => {
        ctx.save();
        ctx.translate(orb.x, orb.y);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ff8fb8';
        ctx.beginPath();
        ctx.arc(0, 0, orb.size, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#2a2038';
        text(ctx, '📷', 0, 1, orb.size, '#2a2038');
        ctx.restore();
      });

      // Kid with flashlight cone.
      ctx.save();
      ctx.translate(s.x, s.y);
      const cone = ctx.createLinearGradient(0, 0, 0, -200);
      cone.addColorStop(0, 'rgba(255, 236, 170, 0.22)');
      cone.addColorStop(1, 'rgba(255, 236, 170, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-90, -220);
      ctx.lineTo(90, -220);
      ctx.lineTo(10, -10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#3cc9c0';
      roundRect(ctx, -20, -14, 40, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#f2c49b';
      ctx.beginPath();
      ctx.arc(0, -24, 16, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Timer bar.
      panel(ctx, g.w / 2 - 180, 24, 360, 40, 'rgba(10, 5, 16, 0.6)');
      const ratio = clamp(s.survived / s.surviveGoal, 0, 1);
      roundRect(ctx, g.w / 2 - 166, 36, 332 * ratio, 16, 8);
      ctx.fillStyle = '#ff8fb8';
      ctx.fill();
      text(ctx, `${Math.ceil(s.surviveGoal - s.survived)}s`, g.w / 2, 78, 20, '#ffe9c4');
    }

    if (s.stage === 1) {
      panel(ctx, g.w / 2 - 300, 210, 600, 40, 'rgba(10, 5, 16, 0.6)');
      const zoneStart = g.w / 2 - 300 + 600 * (0.5 - s.focusZone / 2);
      roundRect(ctx, zoneStart, 210, 600 * s.focusZone, 40, 12);
      ctx.fillStyle = 'rgba(255, 216, 107, 0.4)';
      ctx.fill();
      const markerX = g.w / 2 - 300 + 600 * s.focusMarker;
      ctx.beginPath();
      ctx.arc(markerX, 230, 18, 0, TAU);
      ctx.fillStyle = '#fff6e0';
      ctx.fill();
      text(ctx, 'PRESS E / TAP', g.w / 2, 300, 24, '#ffd86b');
      for (let i = 0; i < 3; i += 1) {
        star(ctx, g.w / 2 - 50 + i * 50, 370, 18, i < s.focusHits ? '#ffd86b' : 'rgba(255,255,255,0.16)');
      }
      text(ctx, `${3 - s.focusMisses} tries left`, g.w / 2, 424, 18, '#cfc0e8');
    }

    if (s.stage === 2) {
      const startX = g.w / 2 - (FINALE_MEMORIES.length - 1) * 75;
      FINALE_MEMORIES.forEach((emoji, index) => {
        const x = startX + index * 150;
        const lit = s.input[index] !== undefined;
        panel(ctx, x - 58, 300, 116, 116, lit ? 'rgba(255, 216, 107, 0.28)' : 'rgba(255,255,255,0.06)');
        text(ctx, emoji, x, 358, 44, '#fff6e0');
        text(ctx, String(index + 1), x, 396, 15, '#cfc0e8');
      });

      text(ctx, s.showing ? 'WATCH' : 'REPEAT', g.w / 2, 210, 30, '#ffd86b');
      if (s.showing) {
        const index = s.sequence[Math.max(0, s.showIndex)];
        if (index !== undefined) text(ctx, FINALE_MEMORIES[index], g.w / 2, 260, 52, '#ffe9c4');
      } else {
        text(
          ctx,
          `${s.input.length} / ${s.sequence.length}`,
          g.w / 2,
          260,
          26,
          '#cfc0e8'
        );
        text(ctx, 'Tap the pictures in order, or press 1 – 4', g.w / 2, 460, 16, '#9fb4d8');
      }
    }

    if (s.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, s.messageTimer * 2);
      text(ctx, s.message, g.w / 2, g.h - 40, 22, '#ffe9c4');
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },
};

export const MINIGAMES = {
  chickenNado,
  shuffleboard,
  minecart,
  clockwork,
  mirrorLab,
  prism,
  finale,
};
