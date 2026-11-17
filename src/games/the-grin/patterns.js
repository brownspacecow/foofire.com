/**
 * Bullet patterns for THE GRIN.
 *
 * Every attack is a small state machine with an elapsed-time API:
 *   a.t      seconds since the pattern started
 *   a.dt     frame delta
 *   a.box    the current battle box
 *   a.soul   the player's position
 *   a.spawn  push a bullet
 *   a.fx     shake() / flash() / splat()
 *
 * Patterns are pure-ish: they only spawn bullets, the game updates them.
 */

const TAU = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

function aim(fromX, fromY, towardX, towardY, speed) {
  const dx = towardX - fromX;
  const dy = towardY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: fromX, y: fromY, vx: (dx / len) * speed, vy: (dy / len) * speed };
}

export const STAGE_ATTACKS = [
  ['tearRain', 'ringBloom', 'boneWaltz'],
  ['crossLaser', 'spiralFangs', 'homingTears', 'tearRain'],
  ['shardSweep', 'eyeBeam', 'boneWall', 'ringBloom'],
  ['chaos', 'eyeBeam', 'shardSweep', 'spiralFangs', 'boneWall'],
];

const NAMES = {
  tearRain: 'TEARS',
  ringBloom: 'BLOOM',
  boneWaltz: 'BONES',
  crossLaser: 'CROSSFIRE',
  spiralFangs: 'FANGS',
  homingTears: 'HUNGER',
  shardSweep: 'SHARDS',
  eyeBeam: 'THE EYE',
  boneWall: 'THE WALL',
  chaos: 'SMILE // SMILE',
};

function tearRain(difficulty, options) {
  let timer = 0.25;
  let aimedTimer = 0.9;
  const duration = options.weakened ? 5.4 : 7;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer <= 0) {
        timer = Math.max(0.16, 0.3 - difficulty * 0.028);
        const x = a.box.x + rand(24, a.box.w - 24);
        a.spawn({
          type: 'orb',
          x,
          y: a.box.y - 16,
          vx: rand(-24, 24),
          vy: 180 + difficulty * 40,
          r: 8,
          color: '#ff3f5f',
          glow: '255,64,96',
          dmg: 2,
        });
      }

      aimedTimer -= a.dt;
      if (aimedTimer <= 0) {
        aimedTimer = 1.55;
        const shot = aim(a.box.x + a.box.w / 2, a.box.y - 10, a.soul.x, a.soul.y, 210 + difficulty * 22);
        a.spawn({
          type: 'orb',
          x: shot.x,
          y: shot.y,
          vx: shot.vx,
          vy: shot.vy,
          r: 9,
          color: '#ff8fa0',
          glow: '255,150,170',
          dmg: 2,
          life: 5,
        });
        a.audio.spawn();
      }
    },
  };
}

function ringBloom(difficulty) {
  let timer = 0.7;
  let ring = 0;
  const duration = 7.5;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0) return;
      timer = 1.18;
      ring += 1;

      const count = Math.min(22, 11 + ring);
      const gapCenter = Math.random() * TAU;
      const gap = 0.95;
      const cx = a.box.x + a.box.w / 2;
      const cy = a.box.y + a.box.h / 2;
      const speed = 118 + difficulty * 14;

      for (let i = 0; i < count; i += 1) {
        const angle = gapCenter + gap / 2 + (i / (count - 1)) * (TAU - gap);
        a.spawn({
          type: 'orb',
          x: cx + Math.cos(angle) * 12,
          y: cy + Math.sin(angle) * 12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 7,
          color: '#ff5470',
          glow: '255,84,116',
          dmg: 2,
          life: 4,
        });
      }
      a.fx.shake(4);
    },
  };
}

function boneWaltz(difficulty) {
  let timer = 0.4;
  const duration = 8;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0) return;
      timer = 1.08;

      const gapX = a.box.x + 54 + Math.random() * (a.box.w - 108);
      const gapWidth = 96;

      for (let x = a.box.x + 14; x < a.box.x + a.box.w; x += 26) {
        if (Math.abs(x - gapX) < gapWidth / 2) continue;
        const height = 74 + Math.random() * 46;
        a.spawn({
          type: 'bone',
          x,
          y: a.box.y + a.box.h + height / 2 + 10,
          w: 16,
          h: height,
          vy: -(205 + difficulty * 20),
          dmg: 2,
          life: 4,
        });
      }

      if (difficulty > 2.2) {
        const y = a.box.y + rand(30, a.box.h - 30);
        a.spawn({
          type: 'bone',
          x: a.box.x + a.box.w + 20,
          y,
          w: 16,
          h: 108,
          vx: -(190 + difficulty * 16),
          dmg: 2,
          life: 4,
        });
      }
    },
  };
}

function crossLaser(difficulty) {
  let cycle = 0;
  let timer = 0.5;
  let orbTimer = 1.2;
  const duration = 7.8;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      orbTimer -= a.dt;

      if (timer <= 0 && cycle < 4) {
        timer = 1.5;
        cycle += 1;
        const sx = clamp(a.soul.x, a.box.x + 30, a.box.x + a.box.w - 30);
        const sy = clamp(a.soul.y, a.box.y + 26, a.box.y + a.box.h - 26);
        a.spawn({
          type: 'laser',
          x: a.box.x,
          y: sy,
          angle: 0,
          len: a.box.w,
          w: 24,
          warn: 0.95,
          fire: 0.5,
          color: '#ff2b4c',
          glow: '255,50,80',
          dmg: 3,
        });
        a.spawn({
          type: 'laser',
          x: sx,
          y: a.box.y,
          angle: Math.PI / 2,
          len: a.box.h,
          w: 24,
          warn: 0.95,
          fire: 0.5,
          color: '#ff2b4c',
          glow: '255,50,80',
          dmg: 3,
        });
        a.audio.laserWarn();
        a.fx.shake(6);
      }

      if (orbTimer <= 0 && difficulty > 1.8) {
        orbTimer = 0.7;
        const edge = Math.floor(Math.random() * 4);
        const speed = 150 + difficulty * 12;
        const y = rand(a.box.y + 20, a.box.y + a.box.h - 20);
        const x = rand(a.box.x + 20, a.box.x + a.box.w - 20);
        if (edge === 0) a.spawn({ type: 'orb', x, y: a.box.y - 12, vy: speed, r: 7, color: '#ff6280', glow: '255,98,128', dmg: 2 });
        if (edge === 1) a.spawn({ type: 'orb', x, y: a.box.y + a.box.h + 12, vy: -speed, r: 7, color: '#ff6280', glow: '255,98,128', dmg: 2 });
        if (edge === 2) a.spawn({ type: 'orb', x: a.box.x - 12, y, vx: speed, r: 7, color: '#ff6280', glow: '255,98,128', dmg: 2 });
        if (edge === 3) a.spawn({ type: 'orb', x: a.box.x + a.box.w + 12, y, vx: -speed, r: 7, color: '#ff6280', glow: '255,98,128', dmg: 2 });
      }
    },
  };
}

function spiralFangs(difficulty) {
  let timer = 0.4;
  let angle = Math.random() * TAU;
  const arms = 3;
  const duration = 8;

  return {
    duration,
    update(a) {
      angle += a.dt * (2.0 + difficulty * 0.22);
      timer -= a.dt;
      if (timer > 0) return;
      timer = 0.105;

      const cx = a.box.x + a.box.w / 2;
      const cy = a.box.y + a.box.h / 2;
      const speed = 128 + difficulty * 10;

      for (let i = 0; i < arms; i += 1) {
        const theta = angle + (i / arms) * TAU;
        a.spawn({
          type: 'orb',
          x: cx + Math.cos(theta) * 10,
          y: cy + Math.sin(theta) * 10,
          vx: Math.cos(theta) * speed,
          vy: Math.sin(theta) * speed,
          r: 7,
          color: '#ff4e6b',
          glow: '255,80,110',
          dmg: 2,
          life: 3.4,
        });
      }
    },
  };
}

function homingTears(difficulty) {
  let timer = 0.9;
  const duration = 8.5;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0) return;
      timer = 1.3;

      for (let i = 0; i < 3; i += 1) {
        const edge = Math.floor(Math.random() * 4);
        let x;
        let y;
        let vx = 0;
        let vy = 0;
        const speed = 145;

        if (edge === 0) {
          x = rand(a.box.x + 20, a.box.x + a.box.w - 20);
          y = a.box.y - 14;
          vy = speed;
        } else if (edge === 1) {
          x = rand(a.box.x + 20, a.box.x + a.box.w - 20);
          y = a.box.y + a.box.h + 14;
          vy = -speed;
        } else if (edge === 2) {
          x = a.box.x - 14;
          y = rand(a.box.y + 20, a.box.y + a.box.h - 20);
          vx = speed;
        } else {
          x = a.box.x + a.box.w + 14;
          y = rand(a.box.y + 20, a.box.y + a.box.h - 20);
          vx = -speed;
        }

        a.spawn({
          type: 'orb',
          x,
          y,
          vx: vx + rand(-20, 20),
          vy: vy + rand(-20, 20),
          r: 9,
          color: '#ff6a86',
          glow: '255,116,144',
          dmg: 2,
          life: 5.2,
          homing: 130 + difficulty * 26,
          maxSpeed: 205 + difficulty * 14,
        });
      }
      a.audio.spawn();
    },
  };
}

function shardSweep(difficulty) {
  let timer = 0;
  const duration = 8;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0) return;
      timer = Math.max(0.12, 0.26 - difficulty * 0.018);

      const fromLeft = Math.random() < 0.5;
      const speed = 225 + difficulty * 26;
      a.spawn({
        type: 'shard',
        x: fromLeft ? a.box.x - 18 : a.box.x + a.box.w + 18,
        y: rand(a.box.y + 18, a.box.y + a.box.h - 18),
        vx: fromLeft ? speed : -speed,
        vy: rand(-26, 26),
        r: 11,
        spin: rand(2, 6),
        color: '#ff3252',
        glow: '255,56,90',
        dmg: 2,
        life: 4,
      });
    },
  };
}

function eyeBeam(difficulty) {
  let cycle = 0;
  let timer = 0.6;
  const duration = 9.2;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0 || cycle >= 4) return;
      timer = 1.95;
      cycle += 1;

      const x = clamp(a.soul.x, a.box.x + 58, a.box.x + a.box.w - 58);
      a.spawn({
        type: 'laser',
        x,
        y: a.box.y,
        angle: Math.PI / 2,
        len: a.box.h,
        w: 84,
        warn: 1.15,
        fire: 0.7,
        color: '#ff1636',
        glow: '255,24,60',
        dmg: 3,
        beam: true,
      });
      a.audio.laserWarn();
      a.fx.shake(7);
    },
  };
}

function boneWall(difficulty) {
  let timer = 0.8;
  const duration = 8.6;

  return {
    duration,
    update(a) {
      timer -= a.dt;
      if (timer > 0) return;
      timer = 1.2;

      const fromRight = Math.random() < 0.5;
      const gapY = a.box.y + 42 + Math.random() * (a.box.h - 84);
      const gapHeight = 98;

      for (let y = a.box.y + 10; y < a.box.y + a.box.h; y += 34) {
        if (Math.abs(y - gapY) < gapHeight / 2) continue;
        a.spawn({
          type: 'bone',
          x: fromRight ? a.box.x + a.box.w + 18 : a.box.x - 18,
          y,
          w: 16,
          h: 30,
          vx: fromRight ? -(195 + difficulty * 24) : 195 + difficulty * 24,
          dmg: 2,
          life: 4,
        });
      }
    },
  };
}

function chaos(difficulty) {
  let spiralTimer = 0;
  let rainTimer = 0.4;
  let homingTimer = 1.6;
  let angle = 0;
  let laserIndex = 0;
  const laserTimes = [5.4, 9.4];
  const duration = 12;

  return {
    duration,
    update(a) {
      angle += a.dt * (2.7 + difficulty * 0.22);
      const cx = a.box.x + a.box.w / 2;
      const cy = a.box.y + a.box.h / 2;

      spiralTimer -= a.dt;
      if (spiralTimer <= 0) {
        spiralTimer = 0.15;
        for (let i = 0; i < 4; i += 1) {
          const theta = angle + (i / 4) * TAU;
          const speed = 135 + difficulty * 8;
          a.spawn({
            type: 'orb',
            x: cx + Math.cos(theta) * 10,
            y: cy + Math.sin(theta) * 10,
            vx: Math.cos(theta) * speed,
            vy: Math.sin(theta) * speed,
            r: 6.5,
            color: '#ff4a68',
            glow: '255,74,104',
            dmg: 2,
            life: 3.6,
          });
        }
      }

      rainTimer -= a.dt;
      if (rainTimer <= 0) {
        rainTimer = 0.34;
        a.spawn({
          type: 'orb',
          x: rand(a.box.x + 16, a.box.x + a.box.w - 16),
          y: a.box.y - 14,
          vy: 200 + difficulty * 26,
          r: 7,
          color: '#ff8a9c',
          glow: '255,138,156',
          dmg: 2,
        });
      }

      homingTimer -= a.dt;
      if (homingTimer <= 0) {
        homingTimer = 1.7;
        const side = Math.random() < 0.5 ? -1 : 1;
        a.spawn({
          type: 'orb',
          x: side < 0 ? a.box.x - 16 : a.box.x + a.box.w + 16,
          y: rand(a.box.y + 30, a.box.y + a.box.h - 30),
          vx: side < 0 ? 160 : -160,
          vy: rand(-40, 40),
          r: 8,
          color: '#ff5470',
          glow: '255,84,112',
          dmg: 2,
          life: 5,
          homing: 120,
          maxSpeed: 190,
        });
      }

      if (laserIndex < laserTimes.length && a.t >= laserTimes[laserIndex]) {
        laserIndex += 1;
        const sx = clamp(a.soul.x, a.box.x + 30, a.box.x + a.box.w - 30);
        const sy = clamp(a.soul.y, a.box.y + 30, a.box.y + a.box.h - 30);
        a.spawn({ type: 'laser', x: a.box.x, y: sy, angle: 0, len: a.box.w, w: 22, warn: 0.9, fire: 0.5, color: '#ff2b4c', glow: '255,50,80', dmg: 3 });
        a.spawn({ type: 'laser', x: sx, y: a.box.y, angle: Math.PI / 2, len: a.box.h, w: 22, warn: 0.9, fire: 0.5, color: '#ff2b4c', glow: '255,50,80', dmg: 3 });
        a.audio.laserWarn();
        a.fx.shake(9);
      }
    },
  };
}

const MAKERS = {
  tearRain,
  ringBloom,
  boneWaltz,
  crossLaser,
  spiralFangs,
  homingTears,
  shardSweep,
  eyeBeam,
  boneWall,
  chaos,
};

export function createAttack(key, options = {}) {
  const maker = MAKERS[key] || tearRain;
  const attack = maker(options.difficulty || 1, options);
  return {
    key,
    name: NAMES[key] || 'SMILE',
    duration: attack.duration,
    update: attack.update,
    init: attack.init,
  };
}
