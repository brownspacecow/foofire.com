import * as THREE from 'three';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';
import { prefersReducedMotion } from '../../utils/motion.js';

/* ------------------------------------------------------------------ *
 * Pizza Homestead: Fun Room Rush
 * A three.js game about a very sincere pizza buffet, its legendary
 * Fun Room arcade, and one animatronic slice named Hank.
 * ------------------------------------------------------------------ */

// ------------------------------------------------------------- helpers
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const TAU = Math.PI * 2;

const PLATE_MAX = 6;
const ROUND_SECONDS = 75;
const CASH_PER_SLICE = 2;
const CABINET_COST = 2;
const EAT_SECONDS = 1.4;
const BOUNDS = { minX: -8.5, maxX: 8.5, minZ: -6.1, maxZ: 5.8 };
const PAN_Z = -1.55;
const SODA_POS = new THREE.Vector3(0.55, 0, -2.2);

// ------------------------------------------------------------------ DOM
const container = document.querySelector('#game-container');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const moneyEl = document.querySelector('#money');
const timerEl = document.querySelector('#timer');
const timerWrap = document.querySelector('#timer-wrap');
const pipsEl = document.querySelector('#plate-pips');
const hintEl = document.querySelector('#hint');
const bannerEl = document.querySelector('#banner');
const bannerLabel = bannerEl.querySelector('span');
const vignette = document.querySelector('#vignette');
const overlay = document.querySelector('#overlay');
const overlayKicker = document.querySelector('.overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlaySub = document.querySelector('#overlay-sub');
const overlayText = document.querySelector('#overlay-text');
const overlayRules = document.querySelector('#overlay-rules');
const overlayControls = document.querySelector('#overlay-controls');
const overlayStats = document.querySelector('#overlay-stats');
const startButton = document.querySelector('#start-button');
const statusEl = document.querySelector('#status');
const muteButton = document.querySelector('#mute-button');
const gameTip = document.querySelector('#game-tip');

const pips = [];
for (let i = 0; i < PLATE_MAX; i += 1) {
  const pip = document.createElement('span');
  pip.className = 'pip';
  pipsEl.append(pip);
  pips.push(pip);
}

// ---------------------------------------------------------------- sound
const audio = (() => {
  let ctx = null;
  let muted = false;

  const ensure = () => {
    if (muted) return null;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const tone = (freq, duration, options = {}) => {
    const ac = ensure();
    if (!ac) return;
    const {
      type = 'square',
      gain = 0.045,
      delay = 0,
      slide = null,
      attack = 0.006,
    } = options;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(45, slide), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  };

  return {
    unlock: () => {
      ensure();
    },
    isMuted: () => muted,
    setMuted: (value) => {
      muted = value;
    },
    pickup: () => {
      tone(620, 0.07, { type: 'triangle', gain: 0.05 });
      tone(880, 0.09, { type: 'triangle', gain: 0.04, delay: 0.05 });
    },
    deliver: (count) => {
      const notes = Math.min(count, 6);
      for (let i = 0; i < notes; i += 1) {
        tone(520 + i * 95, 0.1, { type: 'square', gain: 0.03, delay: i * 0.055 });
      }
    },
    cash: () => {
      tone(1046, 0.06, { gain: 0.03 });
      tone(1318, 0.11, { gain: 0.03, delay: 0.06 });
    },
    eat: () => {
      tone(190, 0.05, { type: 'square', gain: 0.022 });
      tone(150, 0.06, { type: 'square', gain: 0.018, delay: 0.045 });
    },
    whack: (combo) => {
      tone(170, 0.11, { type: 'sawtooth', gain: 0.07, slide: 80 });
      tone(480 + Math.min(combo, 6) * 80, 0.16, { type: 'triangle', gain: 0.055, delay: 0.03 });
    },
    miss: () => {
      tone(200, 0.2, { type: 'sawtooth', gain: 0.045, slide: 90 });
    },
    buzz: () => {
      tone(150, 0.2, { type: 'square', gain: 0.045 });
      tone(108, 0.28, { type: 'square', gain: 0.035, delay: 0.07 });
    },
    tick: () => {
      tone(900, 0.05, { type: 'square', gain: 0.025 });
    },
    end: () => {
      [523, 659, 784, 1046].forEach((freq, index) => {
        tone(freq, 0.28, { type: 'triangle', gain: 0.045, delay: index * 0.13 });
      });
    },
    ui: () => {
      tone(340, 0.06, { gain: 0.025 });
    },
  };
})();

if (readMuted('pizzaHomesteadMuted')) audio.setMuted(true);

const refreshMuteButton = () => {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound effects' : 'Mute sound effects');
};
refreshMuteButton();

muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  writeMuted(audio.isMuted());
  refreshMuteButton();
  if (!audio.isMuted()) audio.ui();
});

/*
 * Full screen keeps the page from scrolling under small thumbs.
 * Hidden where the browser has no element full screen (for example an iframe).
 */
const fullscreenButton = document.querySelector('#fullscreen-button');
const gameShell = document.querySelector('.ph-game');
const canFullscreen = Boolean(
  fullscreenButton && gameShell && document.fullscreenEnabled && gameShell.requestFullscreen
);

const refreshFullscreenButton = () => {
  if (!fullscreenButton) return;
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? '⤡' : '⛶';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
};

if (fullscreenButton) {
  if (!canFullscreen) {
    fullscreenButton.hidden = true;
  } else {
    refreshFullscreenButton();

    fullscreenButton.addEventListener('click', async () => {
      audio.unlock();
      audio.ui();
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await gameShell.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch (error) {
        /* Full screen can be refused, for example inside an embedded frame. */
      }
      refreshFullscreenButton();
    });

    document.addEventListener('fullscreenchange', () => {
      refreshFullscreenButton();
      sizeScene();
    });
  }
}

// ----------------------------------------------------------------- state
const state = {
  phase: 'menu', // menu | play | over
  time: 0,
  round: ROUND_SECONDS,
  score: 0,
  money: 0,
  moneyEarned: 0,
  plate: 0,
  eaten: 0,
  whacks: 0,
  combo: 0,
  bestCombo: 0,
  best: getBest('pizza-homestead'),
  lastTick: 99,
  hintAt: -1,
  lastHint: '',
  plateFullAt: -10,
  eating: null,
  shake: 0,
  bannerUntil: 0,
  hudPlate: -1,
  hudMoney: -1,
  hudScore: -1,
  hudTimer: '',
};

// --------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x170d15);

const CAM_TARGET = new THREE.Vector3(0, 0.9, -0.8);
const CAM_OFFSET = new THREE.Vector3(0, 18.5, 20);
const camTarget = CAM_TARGET.clone();
let followCamera = false;
const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 120);
camera.position.copy(CAM_TARGET).add(CAM_OFFSET);
camera.lookAt(CAM_TARGET);
scene.add(camera);

function sizeScene() {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 480;
  const aspect = width / height;

  /*
   * Wide screens see the whole Homestead. Narrow screens get a closer,
   * player-following view so the diorama still fills a phone screen.
   */
  if (aspect >= 1.4) {
    followCamera = false;
    const viewHeight = Math.max(15.4, 18.8 / aspect);
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
  } else {
    followCamera = true;
    const viewHeight = 13.8;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.left = -viewHeight * 0.5 * aspect;
    camera.right = viewHeight * 0.5 * aspect;
  }

  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
}

// ---------------------------------------------------------------- lights
scene.add(new THREE.HemisphereLight(0xfff0da, 0x4b2234, 1.25));

const sun = new THREE.DirectionalLight(0xfff1d2, 1.75);
sun.position.set(-7, 17, 12);
sun.target.position.set(0, 0, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -13;
sun.shadow.camera.right = 13;
sun.shadow.camera.top = 13;
sun.shadow.camera.bottom = -13;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

const arcadeGlowPink = new THREE.PointLight(0xff4fa8, 26, 11, 2);
arcadeGlowPink.position.set(3.2, 3.1, -3.6);
scene.add(arcadeGlowPink);

const arcadeGlowCyan = new THREE.PointLight(0x55e6ff, 22, 11, 2);
arcadeGlowCyan.position.set(7.4, 3.1, -3.2);
scene.add(arcadeGlowCyan);

const stageGlow = new THREE.PointLight(0xffc45e, 16, 9, 2);
stageGlow.position.set(4.4, 3.2, 2.4);
scene.add(stageGlow);

// -------------------------------------------------------------- textures
function makeTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeatX !== 1 || repeatY !== 1) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
  }
  return texture;
}

const floorTexture = makeTexture(
  256,
  256,
  (ctx, size) => {
    const half = size / 2;
    ctx.fillStyle = '#f1e1c4';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#9c3b45';
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    ctx.strokeStyle = 'rgba(58, 26, 24, 0.24)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, half, half);
    ctx.strokeRect(half, 0, half, half);
    ctx.strokeRect(0, half, half, half);
    ctx.strokeRect(half, half, half, half);
    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,25,20,0.1)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  },
  9,
  7
);

const woodTexture = makeTexture(
  128,
  128,
  (ctx, size) => {
    ctx.fillStyle = '#74422f';
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = x % 32 ? 'rgba(255, 214, 160, 0.06)' : 'rgba(30, 14, 8, 0.14)';
      ctx.fillRect(x, 0, 14, size);
      ctx.fillStyle = 'rgba(40, 20, 12, 0.32)';
      ctx.fillRect(x + 14, 0, 2, size);
    }
    for (let i = 0; i < 40; i += 1) {
      ctx.strokeStyle = `rgba(44, 22, 12, ${rand(0.05, 0.16)})`;
      ctx.beginPath();
      const x = rand(0, size);
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + rand(-4, 4), size * 0.3, x + rand(-4, 4), size * 0.7, x, size);
      ctx.stroke();
    }
  },
  2,
  2
);

const plasterTexture = makeTexture(
  128,
  128,
  (ctx, size) => {
    ctx.fillStyle = '#f2e3c8';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 420; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(120, 84, 52, 0.08)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  },
  5,
  2
);

const carpetTexture = makeTexture(
  256,
  256,
  (ctx, size) => {
    ctx.fillStyle = '#2a1440';
    ctx.fillRect(0, 0, size, size);
    const colors = ['#ff4fa8', '#55e6ff', '#ffd93d', '#7dff9b', '#b57bff'];
    for (let i = 0; i < 70; i += 1) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = rand(0.35, 0.9);
      if (Math.random() > 0.6) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = rand(2, 5);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(Math.random() * size, Math.random() * size, rand(2, 6), rand(2, 6));
      }
    }
    ctx.globalAlpha = 1;
  },
  4,
  7
);

const checkTexture = makeTexture(128, 128, (ctx, size) => {
  ctx.fillStyle = '#f6ead4';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#c43c3c';
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      if ((x + y) % 2 === 0) ctx.fillRect((x * size) / 4, (y * size) / 4, size / 4, size / 4);
    }
  }
}, 2, 2);

const marbleTexture = makeTexture(128, 128, (ctx, size) => {
  ctx.fillStyle = '#e8dcc4';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i += 1) {
    ctx.strokeStyle = `rgba(120, 96, 74, ${rand(0.08, 0.22)})`;
    ctx.lineWidth = rand(0.5, 2);
    ctx.beginPath();
    ctx.moveTo(rand(0, size), 0);
    ctx.bezierCurveTo(rand(0, size), size * 0.4, rand(0, size), size * 0.7, rand(0, size), size);
    ctx.stroke();
  }
});

// ------------------------------------------------------------- materials
const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.92 }),
  wall: new THREE.MeshStandardMaterial({ map: plasterTexture, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.8 }),
  carpet: new THREE.MeshStandardMaterial({ map: carpetTexture, roughness: 1 }),
  marble: new THREE.MeshStandardMaterial({ map: marbleTexture, roughness: 0.45 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd7dde2, metalness: 0.85, roughness: 0.28 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.75, roughness: 0.32 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x3c4149, metalness: 0.55, roughness: 0.5 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf7ead0, roughness: 0.85 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x4c231d, roughness: 0.75 }),
  redVinyl: new THREE.MeshStandardMaterial({ color: 0x9c2a33, roughness: 0.5 }),
  boothWood: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xcfa47c, roughness: 0.8 }),
  cheese: new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.62, emissive: 0x3d2500, emissiveIntensity: 0.25 }),
  crust: new THREE.MeshStandardMaterial({ color: 0xb56a2e, roughness: 0.85 }),
  pepperoni: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 }),
  cheeseBlob: new THREE.MeshStandardMaterial({ color: 0xffe1a1, roughness: 0.7 }),
  ranch: new THREE.MeshStandardMaterial({ color: 0xd8a25b, roughness: 0.85 }),
  dessert: new THREE.MeshStandardMaterial({ color: 0xff8fb0, roughness: 0.7 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xdff3ff,
    transparent: true,
    opacity: 0.16,
    roughness: 0.05,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  glassDark: new THREE.MeshStandardMaterial({
    color: 0x9fd8ea,
    transparent: true,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  neonPink: new THREE.MeshBasicMaterial({ color: 0xff4fa8, toneMapped: false }),
  neonCyan: new THREE.MeshBasicMaterial({ color: 0x55e6ff, toneMapped: false }),
  neonYellow: new THREE.MeshBasicMaterial({ color: 0xffd93d, toneMapped: false }),
  glowRing: new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
};

const colliders = [];

function addCollider(minX, maxX, minZ, maxZ) {
  colliders.push({ minX, maxX, minZ, maxZ });
}

function addBox(width, height, depth, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPlane(width, height, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// ------------------------------------------------------------ sign makers
function signTexture(width, height, draw) {
  return makeTexture(width, height, draw);
}

function signPlane(width, height, texture, x, y, z, rotationY = 0, parent = scene) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
  });
  const mesh = addPlane(width, height, material, x, y, z, parent);
  mesh.rotation.y = rotationY;
  return mesh;
}

const mainSignTexture = signTexture(1024, 256, (ctx, w, h) => {
  ctx.fillStyle = '#8c1b2e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.moveTo(128, 169);
  ctx.lineTo(70, 88);
  ctx.quadraticCurveTo(126, 51, 182, 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6c453';
  ctx.beginPath();
  ctx.moveTo(128, 158);
  ctx.lineTo(82, 92);
  ctx.quadraticCurveTo(126, 63, 170, 92);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  [
    [118, 106],
    [139, 120],
    [112, 133],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = '#fff3cf';
  ctx.font = '900 68px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PIZZA HOMESTEAD', 214, 116);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '700 24px Arial, sans-serif';
  ctx.fillText('ALL YOU CAN EAT  •  EST. 1987  •  PLEASE USE TONGS', 218, 186);
});

const neonSignTexture = signTexture(1024, 320, (ctx, w, h) => {
  ctx.fillStyle = '#160b22';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 79, 168, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 146px "Arial Black", Arial, sans-serif';
  ctx.shadowColor = '#ff2e9a';
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#ffb0e2';
  ctx.fillText('FUN ROOM', w / 2, 138);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7ef0ff';
  ctx.strokeText('FUN ROOM', w / 2, 138);
  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillStyle = '#7ef0ff';
  ctx.fillText('ARCADE  •  PRIZES  •  QUESTIONABLE CARPET', w / 2, 246);
});

const buffetBannerTexture = signTexture(768, 160, (ctx, w, h) => {
  ctx.fillStyle = '#a8182f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '900 58px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ALL YOU CAN EAT', w / 2, 62);
  ctx.fillStyle = '#fff3cf';
  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillText('$7.99  •  SALAD IS A GARNISH', w / 2, 116);
});

const prizeSignTexture = signTexture(768, 256, (ctx, w, h) => {
  ctx.fillStyle = '#2a1440';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffd93d';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#ffd93d';
  ctx.font = '900 92px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRIZES!', w / 2, 80);
  ctx.fillStyle = '#fff3cf';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.fillText('40,000 TICKETS =', w / 2, 152);
  ctx.fillText('ONE PLASTIC SPIDER', w / 2, 192);
});

const stageSignTexture = signTexture(768, 256, (ctx, w, h) => {
  ctx.fillStyle = '#8c1b2e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '900 50px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HANK & THE TOPPINGS', w / 2, 94);
  ctx.fillStyle = '#fff3cf';
  ctx.font = '700 24px Arial, sans-serif';
  ctx.fillText('LIVE EVERY 15 MINUTES (IT IS A TAPE)', w / 2, 164);
});

const sodaSignTexture = signTexture(512, 256, (ctx, w, h) => {
  ctx.fillStyle = '#e9fbff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#0d6b7a';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#0d6b7a';
  ctx.font = '900 88px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SODA', w / 2, 88);
  ctx.font = '700 32px Arial, sans-serif';
  ctx.fillText('ICE COLD · $1.99', w / 2, 156);
  ctx.font = '700 24px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText('the ice machine is broken', w / 2, 205);
});

const nanSignTexture = signTexture(384, 256, (ctx, w, h) => {
  ctx.fillStyle = '#fffdf4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9b48a';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.font = '700 36px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText('NOW HIRING', w / 2, 92);
  ctx.font = '700 26px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText('(ask literally anyone)', w / 2, 144);
  ctx.fillText('free pizza*', w / 2, 190);
  ctx.font = '700 18px "Comic Sans MS", cursive';
  ctx.fillText('*not free', w / 2, 222);
});

const cakeSignTexture = signTexture(384, 192, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#6b2c1f';
  ctx.font = '700 34px "Comic Sans MS", "Segoe Print", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HAPPY BIRTHDAY,', w / 2, 62);
  ctx.fillText('KYLE (AGAIN)', w / 2, 112);
  ctx.font = '700 24px "Comic Sans MS", cursive';
  ctx.fillText('please do not touch the cake', w / 2, 158);
});

function panLabelTexture(text) {
  return signTexture(384, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f7ead0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8c1b2e';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#8c1b2e';
    ctx.font = '900 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

const arcadeArrowTexture = signTexture(512, 160, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 217, 61, 0.95)';
  ctx.font = '900 66px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARCADE', w / 2 - 30, h / 2);
  ctx.beginPath();
  ctx.moveTo(w - 112, 42);
  ctx.lineTo(w - 40, 80);
  ctx.lineTo(w - 112, 118);
  ctx.closePath();
  ctx.fill();
});

// -------------------------------------------------------------- room build
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(18.6, 14.6), M.floor);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Fun Room carpet sits a hair above the tile.
const carpet = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 12.6), M.carpet);
carpet.rotation.x = -Math.PI / 2;
carpet.position.set(5.3, 0.015, -0.2);
carpet.receiveShadow = true;
scene.add(carpet);

// Back wall + sides
addBox(18.6, 5.6, 0.3, M.wall, 0, 2.8, -7.25);
addBox(18.6, 1.3, 0.38, M.wood, 0, 0.65, -7.16);
addBox(18.6, 0.14, 0.44, M.trim, 0, 1.32, -7.13);
addBox(0.3, 5.6, 14.6, M.wall, -9.25, 2.8, 0);
addBox(0.38, 1.3, 14.6, M.wood, -9.16, 0.65, 0);
addBox(0.44, 0.14, 14.6, M.trim, -9.13, 1.32, 0);
addBox(0.3, 5.6, 14.6, M.wall, 9.25, 2.8, 0);
addBox(0.38, 1.3, 14.6, M.wood, 9.16, 0.65, 0);
addBox(0.44, 0.14, 14.6, M.trim, 9.13, 1.32, 0);

// A dark wall behind everything so the top of the frame reads as interior.
const backdrop = addBox(30, 16, 0.3, new THREE.MeshBasicMaterial({ color: 0x120a10 }), 0, 6, -8.4);
backdrop.receiveShadow = false;

// Party pennants across the room.
const pennantColors = [0xff4fa8, 0xffd93d, 0x55e6ff, 0x7dff9b, 0xb57bff];
for (let i = 0; i < 17; i += 1) {
  const t = i / 16;
  const x = -8.4 + t * 16.8;
  const dip = Math.sin(t * Math.PI) * 0.5;
  const pennant = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.42, 3),
    new THREE.MeshStandardMaterial({
      color: pennantColors[i % pennantColors.length],
      roughness: 0.8,
      side: THREE.DoubleSide,
    })
  );
  pennant.position.set(x, 3.72 - dip, -3.1);
  pennant.rotation.z = Math.PI;
  pennant.scale.z = 0.2;
  scene.add(pennant);
}

// Main signs
signPlane(8.2, 2.05, mainSignTexture, -4.4, 3.55, -7.04);
signPlane(5.2, 1.62, neonSignTexture, 5.8, 3.55, -7.04);
signPlane(2.3, 1.53, nanSignTexture, 1.4, 2.75, -7.02).rotation.z = 0.03;

// ---------------------------------------------------------------- buffet
const buffet = new THREE.Group();
buffet.position.set(-4.4, 0, -1.9);
scene.add(buffet);
addBox(7.8, 0.95, 2.2, M.wood, 0, 0.48, 0, buffet);
addBox(7.95, 0.1, 2.35, M.marble, 0, 1.0, 0, buffet);
addBox(7.8, 0.22, 2.2, M.chrome, 0, 0.16, 0, buffet);
addBox(7.8, 0.14, 0.08, M.brass, 0, 0.84, 1.14, buffet);
addCollider(-8.3, -0.5, -3.05, -0.75);

const buffetBanner = signPlane(4.2, 0.88, buffetBannerTexture, 0, 0.52, 1.12, 0, buffet);
buffetBanner.castShadow = false;

// Sneeze guard posts and glass.
[
  [-3.92, 1.08],
  [3.92, 1.08],
  [-3.92, -1.06],
  [3.92, -1.06],
].forEach(([x, z]) => {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), M.brass);
  post.position.set(x, 1.55, z);
  post.castShadow = true;
  buffet.add(post);
});
const guardFront = addPlane(7.8, 0.9, M.glass, 0, 1.58, 1.08, buffet);
guardFront.renderOrder = 3;
const guardTop = addPlane(7.8, 2.1, M.glass, 0, 2.05, -0.02, buffet);
guardTop.rotation.x = -Math.PI / 2;
guardTop.renderOrder = 3;

// Pizza pans
const panDefs = [
  { x: -2.7, kind: 'pepperoni', label: 'PEPPERONI' },
  { x: -1.3, kind: 'cheese', label: 'CHEESE' },
  { x: 0.1, kind: 'ranch', label: 'TATER TOT RANCH' },
  { x: 1.5, kind: 'dessert', label: 'DESSERT PIZZA' },
];

const pans = [];
const panGeometry = new THREE.CylinderGeometry(0.64, 0.6, 0.07, 24);
const panRimGeometry = new THREE.TorusGeometry(0.62, 0.035, 8, 24);
const ringGeometry = new THREE.RingGeometry(0.34, 0.48, 28);

panDefs.forEach((def) => {
  const group = new THREE.Group();
  group.position.set(def.x, 0, 0);
  buffet.add(group);

  const tray = new THREE.Mesh(panGeometry, M.darkMetal);
  tray.position.set(0, 1.11, PAN_Z + 1.9);
  tray.castShadow = true;
  tray.receiveShadow = true;
  group.add(tray);

  const rim = new THREE.Mesh(panRimGeometry, M.chrome);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, 1.15, PAN_Z + 1.9);
  group.add(rim);

  const liner = addPlane(1.0, 1.0, new THREE.MeshStandardMaterial({ map: checkTexture, roughness: 0.9 }), 0, 1.16, PAN_Z + 1.9, group);
  liner.rotation.x = -Math.PI / 2;
  liner.receiveShadow = true;

  const label = signPlane(1.05, 0.26, panLabelTexture(def.label), 0, 0.98, 1.18, 0, group);
  label.castShadow = false;

  pans.push({
    x: def.x - 4.4,
    z: PAN_Z,
    kind: def.kind,
    slice: null,
    timer: rand(0, 0.6),
    group,
  });
});

// Not allowed to forget the salad.
const saladBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.22, 18), M.cream);
saladBowl.position.set(3.35, 1.2, PAN_Z + 1.9);
buffet.add(saladBowl);
for (let i = 0; i < 10; i += 1) {
  const leaf = addBox(
    rand(0.1, 0.2),
    rand(0.06, 0.12),
    rand(0.1, 0.2),
    new THREE.MeshStandardMaterial({ color: i % 3 ? 0x6fae52 : 0x4e8c3a, roughness: 0.9 }),
    3.35 + rand(-0.18, 0.18),
    1.29,
    PAN_Z + 1.9 + rand(-0.18, 0.18),
    buffet
  );
  leaf.rotation.y = rand(0, TAU);
}
signPlane(1.5, 0.3, panLabelTexture('SALAD (FOR SHOW)'), 3.35, 0.98, 1.18, 0, buffet);

// Wet floor sign, genuinely just sauce.
const wetSign = new THREE.Group();
wetSign.position.set(-8.2, 0, 0.85);
wetSign.rotation.y = 0.35;
scene.add(wetSign);
const wetMat = new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.7 });
const wetA = addBox(0.5, 0.8, 0.04, wetMat, 0, 0.42, -0.14, wetSign);
wetA.rotation.x = 0.16;
const wetB = addBox(0.5, 0.8, 0.04, wetMat, 0, 0.42, 0.14, wetSign);
wetB.rotation.x = -0.16;
signPlane(0.36, 0.18, panLabelTexture('CAUTION: SAUCE'), 0, 0.5, 0.17, 0, wetSign);

// --------------------------------------------------------- soda machine
const sodaMachine = new THREE.Group();
sodaMachine.position.set(SODA_POS.x, 0, SODA_POS.z);
scene.add(sodaMachine);
addBox(1.15, 2.0, 0.85, new THREE.MeshStandardMaterial({ color: 0xb31b34, roughness: 0.55 }), 0, 1.0, 0, sodaMachine);
addBox(1.25, 0.16, 0.95, M.darkMetal, 0, 2.06, 0, sodaMachine);
addBox(1.0, 0.62, 0.06, new THREE.MeshStandardMaterial({ color: 0x231018, roughness: 0.4 }), 0, 1.44, 0.44, sodaMachine);
signPlane(0.9, 0.46, sodaSignTexture, 0, 1.44, 0.475, 0, sodaMachine);
addBox(0.52, 0.18, 0.1, M.darkMetal, 0, 0.92, 0.47, sodaMachine);
addBox(0.36, 0.5, 0.06, new THREE.MeshStandardMaterial({ color: 0x2a1820, roughness: 0.5 }), 0, 0.62, 0.44, sodaMachine);
const sodaGlow = addBox(
  0.88,
  0.08,
  0.08,
  new THREE.MeshBasicMaterial({ color: 0x55e6ff, toneMapped: false }),
  0,
  1.83,
  0.45,
  sodaMachine
);
sodaGlow.castShadow = false;
signPlane(1.35, 0.4, panLabelTexture('ICE COLD SODA'), 0, 2.32, 0.1, 0, sodaMachine);
addCollider(-0.08, 1.18, -2.65, -1.72);

// ------------------------------------------------------------- Fun Room
const arcadeArrow = addPlane(
  2.2,
  0.68,
  new THREE.MeshBasicMaterial({ map: arcadeArrowTexture, transparent: true, toneMapped: false, depthWrite: false }),
  1.95,
  0.022,
  0.4
);
arcadeArrow.rotation.x = -Math.PI / 2;
arcadeArrow.rotation.z = -0.2;

const cabinetDefs = [
  { x: 2.9, name: 'PIZZA POP', color: 0xff4fa8 },
  { x: 4.2, name: 'SLICE FIGHTER', color: 0x55e6ff },
  { x: 5.5, name: 'DOUGH BOY', color: 0xffd93d },
  { x: 6.8, name: 'CHEESE ROLLER', color: 0x7dff9b },
  { x: 8.1, name: "HANK'S REVENGE", color: 0xb57bff },
];

const cabinets = [];
const cabinetTargets = [];

function cabinetScreenTexture(name, color) {
  const css = `#${color.toString(16).padStart(6, '0')}`;
  return signTexture(256, 160, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#241236');
    gradient.addColorStop(1, '#0d0714');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = css;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = css;
    ctx.globalAlpha = 0.22;
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f6c453';
    ctx.beginPath();
    ctx.moveTo(w / 2, 40);
    ctx.lineTo(w / 2 - 56, 116);
    ctx.quadraticCurveTo(w / 2, 150, w / 2 + 56, 116);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    [
      [w / 2 - 18, 86],
      [w / 2 + 18, 100],
      [w / 2 - 2, 114],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = '#fff3cf';
    ctx.font = '700 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INSERT $2', w / 2, h - 12);
    ctx.font = '900 20px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = css;
    ctx.fillText(name, w / 2, 22);
  });
}

function cabinetMarqueeTexture(name, color) {
  const css = `#${color.toString(16).padStart(6, '0')}`;
  return signTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillStyle = '#120818';
    ctx.font = '900 42px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, 54);
    ctx.font = '700 22px Arial, sans-serif';
    ctx.fillText('$2 PLAY', w / 2, 100);
  });
}

function buildCabinet(def, index) {
  const group = new THREE.Group();
  group.position.set(def.x, 0, -5.85);
  scene.add(group);

  const color = new THREE.Color(def.color);
  addBox(1.12, 1.62, 0.82, new THREE.MeshStandardMaterial({ color: 0x241826, roughness: 0.6 }), 0, 0.81, 0, group);
  const sideMat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.5,
    emissive: color,
    emissiveIntensity: 0.35,
  });
  addBox(0.06, 1.5, 0.86, sideMat, -0.59, 0.82, 0, group);
  addBox(0.06, 1.5, 0.86, sideMat, 0.59, 0.82, 0, group);

  addBox(1.04, 0.2, 0.22, new THREE.MeshStandardMaterial({ color: 0x1a1120, roughness: 0.5 }), 0, 1.69, 0.35, group);
  signPlane(0.95, 0.28, cabinetMarqueeTexture(def.name, def.color), 0, 1.7, 0.47, 0, group);

  const screenMat = new THREE.MeshBasicMaterial({
    map: cabinetScreenTexture(def.name, def.color),
    toneMapped: false,
  });
  const screen = addPlane(0.8, 0.5, screenMat, 0, 1.34, 0.43, group);
  screen.userData.blank = false;

  addBox(0.98, 0.12, 0.4, new THREE.MeshStandardMaterial({ color: 0x1a1120, roughness: 0.5 }), 0, 1.05, 0.46, group);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), M.chrome);
  stick.position.set(-0.2, 1.2, 0.52);
  group.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.pepperoni);
  ball.position.set(-0.2, 1.3, 0.52);
  group.add(ball);
  [
    [0.12, 0xff4fa8],
    [0.3, 0xffd93d],
  ].forEach(([x, c]) => {
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 })
    );
    button.position.set(x, 1.13, 0.56);
    group.add(button);
  });

  const coinSlot = addBox(0.16, 0.06, 0.02, M.neonYellow, 0, 0.78, 0.42, group);
  coinSlot.castShadow = false;

  // A soft pool of light on the carpet in front of each cabinet.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 20),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.12, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(def.x, 0.025, -4.85);
  scene.add(pool);

  const cab = {
    group,
    x: def.x,
    z: -5.85,
    name: def.name,
    color: def.color,
    screen,
    sideMat,
    index,
  };
  group.userData.cabinet = cab;
  group.traverse((child) => {
    if (child.isMesh) child.userData.cabinet = cab;
  });
  cabinetTargets.push(group);
  cabinets.push(cab);
  addCollider(def.x - 0.6, def.x + 0.6, -6.3, -5.3);
  return cab;
}

cabinetDefs.forEach(buildCabinet);

// Prize counter on the right wall.
const prizeCounter = new THREE.Group();
prizeCounter.position.set(8.5, 0, -1.3);
scene.add(prizeCounter);
addBox(0.9, 1.0, 2.7, M.wood, 0, 0.5, 0, prizeCounter);
addBox(1.0, 0.08, 2.8, M.marble, 0, 1.04, 0, prizeCounter);
addBox(0.7, 0.5, 2.4, M.glassDark, 0, 1.33, 0, prizeCounter);
signPlane(1.9, 0.66, prizeSignTexture, 9.02, 2.35, -1.3, -Math.PI / 2);
addBox(0.9, 0.06, 2.5, M.brass, 8.55, 1.7, -1.0);
addCollider(7.95, 9.0, -2.7, 0.1);

// Prize shelf plushies.
const plushColors = [0xff8a3d, 0x7dff9b, 0x55e6ff, 0xff4fa8, 0xffd93d];
plushColors.forEach((color, i) => {
  const plush = new THREE.Group();
  plush.position.set(8.55, 1.85, 0 - i * 0.5);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  body.scale.y = 0.9;
  body.castShadow = true;
  plush.add(body);
  [-0.11, 0.11].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    ear.position.set(x, 0.14, 0);
    plush.add(ear);
  });
  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0x120a10 }));
    eye.position.set(x, 0.03, 0.15);
    plush.add(eye);
  });
  scene.add(plush);
});

// Claw machine. It has never worked.
const claw = new THREE.Group();
claw.position.set(8.4, 0, 3.7);
scene.add(claw);
addBox(1.25, 0.9, 1.0, new THREE.MeshStandardMaterial({ color: 0x3b1e6e, roughness: 0.55 }), 0, 0.45, 0, claw);
addBox(1.35, 0.12, 1.1, M.darkMetal, 0, 0.96, 0, claw);
addBox(1.2, 1.1, 0.06, M.glass, 0, 1.55, 0.5, claw);
addBox(0.06, 1.1, 0.9, M.glass, -0.58, 1.55, 0, claw);
addBox(0.06, 1.1, 0.9, M.glass, 0.58, 1.55, 0, claw);
addBox(1.34, 0.16, 1.08, new THREE.MeshStandardMaterial({ color: 0xff4fa8, roughness: 0.5 }), 0, 2.16, 0, claw);
signPlane(1.1, 0.34, panLabelTexture('CLAW OF DOOM'), 0, 1.9, 0.52, 0, claw);
const clawArm = addBox(0.05, 0.5, 0.05, M.chrome, 0, 1.65, 0, claw);
clawArm.castShadow = true;
const clawHead = new THREE.Group();
clawHead.position.set(0, 1.4, 0);
claw.add(clawHead);
for (let i = 0; i < 3; i += 1) {
  const finger = addBox(0.04, 0.2, 0.04, M.chrome, Math.cos((i / 3) * TAU) * 0.07, 0, Math.sin((i / 3) * TAU) * 0.07, clawHead);
  finger.rotation.z = 0.4;
  finger.rotation.x = 0.3;
}
const clawPlush = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf6c453, roughness: 0.8 }));
clawPlush.position.set(0.1, 1.12, 0.05);
claw.add(clawPlush);
addCollider(7.75, 9.0, 3.15, 4.25);

// Stage and the animatronic band.
const STAGE = { x: 4.4, z: 3.35 };
const stage = new THREE.Group();
stage.position.set(STAGE.x, 0, STAGE.z);
scene.add(stage);
addBox(3.7, 0.24, 2.1, new THREE.MeshStandardMaterial({ color: 0x5c2b6e, roughness: 0.7 }), 0, 0.12, 0, stage);
addBox(3.8, 0.08, 2.2, M.brass, 0, 0.26, 0, stage);
addCollider(2.45, 6.35, 2.25, 4.5);

const stageBackdrop = addPlane(
  3.5,
  1.15,
  new THREE.MeshBasicMaterial({ map: stageSignTexture, toneMapped: false }),
  0,
  2.05,
  -0.98,
  stage
);

// Small speakers on the stage.
[-1.7, 1.7].forEach((x) => {
  addBox(0.34, 0.62, 0.3, M.darkMetal, x, 0.65, 0.1, stage);
  addBox(0.24, 0.24, 0.05, M.chrome, x, 0.78, 0.27, stage);
  addBox(0.24, 0.24, 0.05, M.chrome, x, 0.5, 0.27, stage);
});

// --------------------------------------------------------------- pizza art
const sliceShellGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12, 1, false, -0.62, 1.24);
const sliceCrustGeo = new THREE.CylinderGeometry(0.435, 0.435, 0.085, 12, 1, true, -0.62, 1.24);
const toppingGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.024, 8);
const toppingGeoBig = new THREE.CylinderGeometry(0.075, 0.08, 0.03, 8);

const toppingConfig = {
  pepperoni: { material: M.pepperoni, geo: toppingGeoBig, spots: [[-0.22, 0.16], [0.06, 0.26], [0.26, 0.15], [-0.04, 0.1]] },
  cheese: { material: M.cheeseBlob, geo: toppingGeo, spots: [[-0.18, 0.2], [0.12, 0.15], [0.02, 0.3], [0.24, 0.3], [-0.3, 0.31]] },
  ranch: { material: M.ranch, geo: toppingGeoBig, spots: [[-0.2, 0.16], [0.08, 0.24], [0.28, 0.14], [-0.02, 0.33]] },
  dessert: { material: M.dessert, geo: toppingGeo, spots: [[-0.16, 0.22], [0.14, 0.18], [0.02, 0.32], [0.26, 0.28]] },
};

function makePizzaSlice(kind = 'pepperoni', scale = 1) {
  const group = new THREE.Group();
  const cheese = new THREE.Mesh(sliceShellGeo, M.cheese);
  cheese.castShadow = true;
  group.add(cheese);

  const crust = new THREE.Mesh(sliceCrustGeo, M.crust);
  crust.material.side = THREE.DoubleSide;
  crust.castShadow = true;
  group.add(crust);

  const config = toppingConfig[kind] || toppingConfig.pepperoni;
  config.spots.forEach(([angle, radius]) => {
    const topping = new THREE.Mesh(config.geo, config.material);
    topping.position.set(Math.cos(angle) * radius, 0.045, Math.sin(angle) * radius);
    group.add(topping);
  });

  group.scale.setScalar(scale);
  return group;
}

// ------------------------------------------------------------ slice mascot
function makeSliceMascot() {
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  shape.moveTo(0, 1.0);
  shape.lineTo(-0.62, -0.02);
  shape.quadraticCurveTo(0, -0.6, 0.62, -0.02);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 2,
    curveSegments: 10,
  });
  bodyGeo.translate(0, 0, -0.08);
  const body = new THREE.Mesh(bodyGeo, M.cheese);
  body.castShadow = true;
  group.add(body);

  const crust = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.075, 8, 24, Math.PI), M.crust);
  crust.position.set(0, -0.02, 0);
  crust.rotation.z = Math.PI;
  group.add(crust);

  // Eyes
  [-0.2, 0.2].forEach((x) => {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    white.position.set(x, 0.3, 0.12);
    white.scale.z = 0.55;
    group.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), new THREE.MeshBasicMaterial({ color: 0x160c12 }));
    pupil.position.set(x, 0.3, 0.2);
    group.add(pupil);
  });

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.028, 6, 16, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x5b2417 })
  );
  smile.position.set(0, 0.12, 0.135);
  smile.rotation.z = Math.PI;
  group.add(smile);

  // Pepperoni cheek spots.
  [-0.34, 0.34].forEach((x) => {
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), M.pepperoni);
    spot.rotation.x = Math.PI / 2;
    spot.position.set(x, 0.17, 0.13);
    group.add(spot);
  });

  // Straw hat.
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.045, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0d28a, roughness: 0.85 })
  );
  brim.position.set(0, 1.0, 0);
  group.add(brim);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.26, 0.26, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8c473, roughness: 0.85 })
  );
  crown.position.set(0, 1.14, 0);
  group.add(crown);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.265, 0.265, 0.06, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.8, side: THREE.DoubleSide })
  );
  band.position.set(0, 1.04, 0);
  group.add(band);

  // Arms and gloves.
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), M.crust);
    arm.position.set(side * 0.58, 0.2, 0);
    arm.rotation.z = side * 0.95;
    arm.castShadow = true;
    group.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), M.cream);
    glove.position.set(side * 0.79, 0.02, 0);
    group.add(glove);
  });

  return group;
}

const stageHank = makeSliceMascot();
stageHank.scale.setScalar(1.25);
stageHank.position.set(0, 0.3, 0.05);
stageHank.userData.cheer = 0;
stageHank.userData.baseY = 0.3;
stage.add(stageHank);

function makeBandmate(color, kind) {
  const group = new THREE.Group();
  if (kind === 'mushroom') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 14), M.cream);
    stem.position.y = 0.35;
    stem.castShadow = true;
    group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    cap.position.y = 0.55;
    cap.scale.y = 0.75;
    cap.castShadow = true;
    group.add(cap);
    for (let i = 0; i < 4; i += 1) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), M.cream);
      dot.position.set(Math.cos((i / 4) * TAU) * 0.23, 0.68, Math.sin((i / 4) * TAU) * 0.23);
      group.add(dot);
    }
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 18), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);
    [-0.14, 0.14].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x160c12 }));
      eye.position.set(x, 0.52, 0.18);
      group.add(eye);
    });
  }
  [-0.32, 0.32].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x160c12 }));
    eye.position.set(x, kind === 'mushroom' ? 0.5 : 0.22, 0.2);
    if (kind === 'mushroom') group.add(eye);
  });
  return group;
}

const mushroomMike = makeBandmate(0xa8302b, 'mushroom');
mushroomMike.position.set(-1.05, 0.24, 0.35);
mushroomMike.scale.setScalar(0.9);
stage.add(mushroomMike);

const pepperoniPete = makeBandmate(0xc0392b, 'pepperoni');
pepperoniPete.position.set(1.05, 0.24, 0.35);
pepperoniPete.rotation.y = -0.2;
stage.add(pepperoniPete);

// The pop-up Hank used by arcade cabinets.
const hankPop = makeSliceMascot();
hankPop.scale.setScalar(0.001);
hankPop.visible = false;
scene.add(hankPop);

// ------------------------------------------------------------------ booths
const booths = [];

function buildBooth(x, z, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);

  const booth = { x, z, group, glow: null };
  group.userData.booth = booth;

  addBox(2.2, 0.12, 1.1, M.boothWood, 0, 0.74, 0, group);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 10), M.chrome);
  pole.position.y = 0.38;
  group.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.07, 14), M.darkMetal);
  base.position.y = 0.05;
  group.add(base);

  [-1.45, 1.45].forEach((bx) => {
    addBox(0.7, 0.14, 1.35, M.redVinyl, bx, 0.44, 0, group);
    addBox(0.72, 0.6, 1.35, M.redVinyl, bx + (bx > 0 ? 0.22 : -0.22), 0.75, 0, group);
    addBox(0.16, 0.46, 1.35, M.boothWood, bx + (bx > 0 ? 0.42 : -0.42), 0.27, 0, group);
  });

  // Table setting.
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16), M.plate);
  plate.position.set(-0.35, 0.82, 0);
  group.add(plate);
  const ketchup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0xc0261f, roughness: 0.5 }));
  ketchup.position.set(0.5, 0.9, -0.2);
  group.add(ketchup);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 10), M.cream);
  cap.position.set(0.5, 1.02, -0.2);
  group.add(cap);
  const napkins = addBox(0.24, 0.06, 0.16, M.cream, 0.35, 0.83, 0.28, group);
  napkins.rotation.y = 0.2;

  const boothSign = signPlane(0.8, 0.22, panLabelTexture('SIT & EAT'), 0.55, 0.88, 0.15, 0, group);
  boothSign.rotation.x = -0.18;

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1.0, 30),
    new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.02, -1.12);
  group.add(glow);
  booth.glow = glow;

  addCollider(x - 1.4, x + 1.4, z - 1.0, z + 1.0);
  booths.push(booth);
  return booth;
}
buildBooth(-6.7, 4.3);
buildBooth(-2.4, 4.3);
const boothTargets = booths.map((booth) => booth.group);

// A birthday corner that is definitely not being celebrated enough.
const birthdayTable = new THREE.Group();
birthdayTable.position.set(-0.2, 0, 5.0);
scene.add(birthdayTable);
addBox(1.4, 0.1, 1.2, M.boothWood, 0, 0.74, 0, birthdayTable);
const birthdaySign = addPlane(
  1.3,
  0.65,
  new THREE.MeshBasicMaterial({ map: cakeSignTexture, transparent: true, toneMapped: false }),
  0,
  1.45,
  -0.25,
  birthdayTable
);
birthdaySign.rotation.x = -0.3;
addCollider(-0.95, 0.55, 4.35, 5.65);

// Soft-serve machine, back left.
const softServe = new THREE.Group();
softServe.position.set(-8.2, 0, -5.7);
scene.add(softServe);
addBox(1.3, 1.9, 1.1, new THREE.MeshStandardMaterial({ color: 0xcf3b3b, roughness: 0.55 }), 0, 0.95, 0, softServe);
addBox(1.1, 0.7, 0.1, M.darkMetal, 0, 1.35, 0.52, softServe);
const swirl = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 12), M.cream);
swirl.position.set(0, 0.92, 0.52);
softServe.add(swirl);
signPlane(1.05, 0.28, panLabelTexture('ICE CREAM (BROKEN)'), 0, 2.02, 0.3, 0, softServe);
addCollider(-8.9, -7.5, -6.3, -5.1);

// Trash can.
const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 14), new THREE.MeshStandardMaterial({ color: 0x2f5d43, roughness: 0.7 }));
trash.position.set(-8.7, 0.4, 1.6);
trash.castShadow = true;
scene.add(trash);
const trashLid = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 14), M.darkMetal);
trashLid.position.set(-8.7, 0.83, 1.6);
scene.add(trashLid);

// -------------------------------------------------------------------- kid
function buildKid() {
  const group = new THREE.Group();
  scene.add(group);

  const skin = new THREE.MeshStandardMaterial({ color: 0xd89a6c, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe86a2c, roughness: 0.8 });
  const shorts = new THREE.MeshStandardMaterial({ color: 0x2f4f9e, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2ec4ff, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });

  const body = addBox(0.5, 0.55, 0.32, shirt, 0, 0.78, 0, group);
  body.castShadow = true;
  const shortsMesh = addBox(0.52, 0.28, 0.34, shorts, 0, 0.46, 0, group);
  shortsMesh.castShadow = true;

  const legL = addBox(0.18, 0.42, 0.2, skin, -0.14, 0.24, 0, group);
  const legR = addBox(0.18, 0.42, 0.2, skin, 0.14, 0.24, 0, group);
  addBox(0.2, 0.12, 0.3, shoeMat, 0, -0.22, 0.04, legL);
  addBox(0.2, 0.12, 0.3, shoeMat, 0, -0.22, 0.04, legR);

  const armL = addBox(0.14, 0.44, 0.16, shirt, -0.32, 0.8, 0, group);
  armL.rotation.z = 0.24;
  const armR = addBox(0.14, 0.44, 0.16, shirt, 0.32, 0.8, 0, group);
  armR.rotation.z = -0.24;

  const head = new THREE.Group();
  head.position.set(0, 1.24, 0);
  group.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), skin);
  face.castShadow = true;
  head.add(face);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 }));
  hair.position.y = 0.04;
  hair.scale.y = 0.78;
  head.add(hair);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, TAU, 0, Math.PI / 2), capMat);
  cap.position.y = 0.11;
  cap.scale.y = 0.85;
  head.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16, 1, false, 0, Math.PI), capMat);
  brim.rotation.x = -0.18;
  brim.position.set(0, 0.13, 0.22);
  head.add(brim);

  [-0.1, 0.1].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1b1013 }));
    eye.position.set(x, 0.02, 0.275);
    head.add(eye);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7a3520 }));
  smile.position.set(0, -0.07, 0.275);
  smile.rotation.z = Math.PI;
  head.add(smile);

  const plateGroup = new THREE.Group();
  plateGroup.position.set(0, 0.92, 0.4);
  group.add(plateGroup);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 18), M.plate);
  plate.castShadow = true;
  plateGroup.add(plate);
  const stack = new THREE.Group();
  stack.position.y = 0.03;
  plateGroup.add(stack);

  return { group, legL, legR, armL, armR, head, plateGroup, stack, body: body };
}

const kidRig = buildKid();
const kid = kidRig.group;
kid.position.set(-4.6, 0, 1.9);

// ---------------------------------------------------------------- manager
function buildManager() {
  const group = new THREE.Group();
  scene.add(group);
  const polo = new THREE.MeshStandardMaterial({ color: 0x7b2f8f, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x26314f, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xdfa87e, roughness: 0.7 });

  const body = addBox(0.58, 0.66, 0.36, polo, 0, 0.92, 0, group);
  body.castShadow = true;
  addBox(0.56, 0.5, 0.34, pants, 0, 0.36, 0, group);
  const legL = addBox(0.18, 0.34, 0.2, pants, -0.14, 0.17, 0, group);
  const legR = addBox(0.18, 0.34, 0.2, pants, 0.14, 0.17, 0, group);
  addBox(0.2, 0.1, 0.28, new THREE.MeshStandardMaterial({ color: 0x241a20, roughness: 0.8 }), 0, -0.15, 0.03, legL);
  addBox(0.2, 0.1, 0.28, new THREE.MeshStandardMaterial({ color: 0x241a20, roughness: 0.8 }), 0, -0.15, 0.03, legR);

  const armL = addBox(0.14, 0.5, 0.16, polo, -0.36, 0.94, 0, group);
  armL.rotation.z = 0.2;
  const armR = addBox(0.14, 0.44, 0.16, polo, 0.36, 0.94, 0, group);
  armR.rotation.z = -0.35;

  const head = new THREE.Group();
  head.position.set(0, 1.38, 0);
  group.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skin);
  face.castShadow = true;
  head.add(face);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
  bun.position.set(0, 0.2, -0.19);
  head.add(bun);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
  hair.scale.y = 0.6;
  head.add(hair);
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1c7a4a, roughness: 0.6 })
  );
  visor.rotation.x = -0.1;
  visor.position.set(0, 0.16, 0.05);
  head.add(visor);
  const visorBrim = addBox(0.4, 0.03, 0.22, new THREE.MeshStandardMaterial({ color: 0x15613a, roughness: 0.6 }), 0, 0.14, 0.28, head);
  visorBrim.rotation.x = -0.16;
  [-0.09, 0.09].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), new THREE.MeshBasicMaterial({ color: 0x1b1013 }));
    eye.position.set(x, -0.01, 0.255);
    head.add(eye);
  });
  addBox(0.12, 0.04, 0.02, new THREE.MeshBasicMaterial({ color: 0x8c1b2e }), 0, -0.1, 0.265, head);

  // Clipboard of doom.
  const clipboard = addBox(0.3, 0.04, 0.42, new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 }), 0.42, 0.7, 0.24, group);
  clipboard.rotation.x = 0.4;
  addBox(0.24, 0.01, 0.32, M.cream, 0.42, 0.72, 0.24, group).rotation.x = 0.4;

  return { group, legL, legR, armL, armR, head };
}

const managerRig = buildManager();
const manager = {
  rig: managerRig,
  x: -7.4,
  z: 0.4,
  dir: 1,
  pause: 0,
  cool: -10,
  phase: 0,
};
managerRig.group.position.set(manager.x, 0, manager.z);

const alertTexture = signTexture(128, 128, (ctx, size) => {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.43, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8c1b2e';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = '#8c1b2e';
  ctx.font = '900 84px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2 + 4);
});
const alertSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: alertTexture, transparent: true, depthTest: false, toneMapped: false })
);
alertSprite.scale.set(0.7, 0.7, 1);
alertSprite.position.set(0, 2.35, 0);
alertSprite.visible = false;
alertSprite.renderOrder = 15;
managerRig.group.add(alertSprite);

// ------------------------------------------------------------------ player
const player = {
  x: -4.6,
  z: 1.9,
  targetX: -4.6,
  targetZ: 1.9,
  hasTarget: false,
  facing: 0,
  speed: 5.4,
  phase: 0,
  moving: false,
  radius: 0.36,
};

const plateSlices = [];

// --------------------------------------------------------------- effects
const effects = [];
const texts = [];
const confettiGeo = new THREE.BoxGeometry(0.07, 0.07, 0.02);
const confettiMaterials = [0xffd93d, 0xff4fa8, 0x55e6ff, 0x7dff9b, 0xfff3cf].map(
  (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
);

function spawnConfetti(x, y, z, count = 16, spread = 1.4) {
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(confettiGeo, confettiMaterials[i % confettiMaterials.length]);
    mesh.position.set(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2));
    mesh.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    scene.add(mesh);
    effects.push({
      mesh,
      vx: rand(-spread, spread),
      vy: rand(2.2, 5),
      vz: rand(-spread, spread),
      life: rand(0.7, 1.35),
      maxLife: 1.35,
      spin: rand(-8, 8),
    });
  }
}

function spawnText(text, x, y, z, color = '#ffd93d', size = 0.8) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '900 62px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(20, 6, 14, 0.9)';
  ctx.strokeText(text, 128, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * 2, size, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 25;
  scene.add(sprite);
  texts.push({ sprite, material, texture, life: 1.1, maxLife: 1.1, baseY: y });
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    effect.vy -= 9.5 * dt;
    effect.mesh.position.x += effect.vx * dt;
    effect.mesh.position.y += effect.vy * dt;
    effect.mesh.position.z += effect.vz * dt;
    effect.mesh.rotation.x += effect.spin * dt;
    effect.mesh.rotation.y += effect.spin * dt;
    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      effects.splice(i, 1);
    }
  }

  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const item = texts[i];
    item.life -= dt;
    const progress = 1 - Math.max(0, item.life) / item.maxLife;
    item.sprite.position.y = item.baseY + progress * 0.9;
    item.material.opacity = Math.min(1, Math.max(0, item.life) / 0.35);
    if (item.life <= 0) {
      scene.remove(item.sprite);
      item.material.dispose();
      item.texture.dispose();
      texts.splice(i, 1);
    }
  }
}

function clearEffects() {
  effects.forEach((effect) => scene.remove(effect.mesh));
  effects.length = 0;
  texts.forEach((item) => {
    scene.remove(item.sprite);
    item.material.dispose();
    item.texture.dispose();
  });
  texts.length = 0;
}

// ------------------------------------------------------------------ slices
function spawnSlice(pan) {
  const slice = makePizzaSlice(pan.kind, 1);
  slice.position.set(pan.x, 1.19, pan.z);
  slice.rotation.y = rand(0, TAU);
  const ring = new THREE.Mesh(ringGeometry, M.glowRing);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.05;
  slice.add(ring);
  scene.add(slice);
  pan.slice = {
    mesh: slice,
    ring,
    phase: rand(0, TAU),
    baseY: 1.19,
  };
}

function removeSlice(pan) {
  if (!pan.slice) return;
  scene.remove(pan.slice.mesh);
  pan.slice = null;
  pan.timer = rand(1.1, 2.4);
}

function resetSlices() {
  pans.forEach((pan) => {
    if (pan.slice) {
      scene.remove(pan.slice.mesh);
      pan.slice = null;
    }
    pan.timer = rand(0, 0.45);
  });
}

function addPlateSlice() {
  const slice = makePizzaSlice(pick(['pepperoni', 'cheese', 'ranch', 'dessert']), 0.56);
  const index = plateSlices.length;
  slice.position.set(rand(-0.03, 0.03), 0.04 + index * 0.075, rand(-0.03, 0.03));
  slice.rotation.y = rand(0, TAU);
  slice.rotation.z = rand(-0.08, 0.08);
  kidRig.stack.add(slice);
  plateSlices.push(slice);
}

function removePlateSlice() {
  const slice = plateSlices.pop();
  if (slice) kidRig.stack.remove(slice);
}

function clearPlate() {
  while (plateSlices.length) removePlateSlice();
}

// ------------------------------------------------------------------ banner
function showBanner(text, seconds = 2.4) {
  bannerLabel.textContent = text;
  bannerEl.classList.add('show');
  state.bannerUntil = state.time + seconds;
  statusEl.textContent = text;
}

function updateBanner() {
  if (state.bannerUntil > 0 && state.time > state.bannerUntil) {
    bannerEl.classList.remove('show');
    state.bannerUntil = 0;
  }
}

// ------------------------------------------------------------------- HUD
const formatNumber = (value) => Math.round(value).toLocaleString('en-US');
const formatMoney = (value) => `$${formatNumber(value)}`;
const formatTime = (seconds) => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

function updateHud() {
  if (state.score !== state.hudScore) {
    scoreEl.textContent = formatNumber(state.score);
    state.hudScore = state.score;
  }
  if (state.money !== state.hudMoney) {
    moneyEl.textContent = formatMoney(state.money);
    state.hudMoney = state.money;
  }
  if (state.plate !== state.hudPlate) {
    pips.forEach((pip, index) => pip.classList.toggle('full', index < state.plate));
    state.hudPlate = state.plate;
  }
  const timeLabel = formatTime(state.round);
  if (timeLabel !== state.hudTimer) {
    timerEl.textContent = timeLabel;
    state.hudTimer = timeLabel;
  }
  timerWrap.classList.toggle('low', state.phase === 'play' && state.round <= 10);
  bestEl.textContent = formatNumber(Math.max(state.best, state.score));
}

// ------------------------------------------------------------- collisions
function resolveCollisions(x, z) {
  let px = clamp(x, BOUNDS.minX, BOUNDS.maxX);
  let pz = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
  for (let pass = 0; pass < 2; pass += 1) {
    for (const box of colliders) {
      const nearX = clamp(px, box.minX, box.maxX);
      const nearZ = clamp(pz, box.minZ, box.maxZ);
      const dx = px - nearX;
      const dz = pz - nearZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= player.radius * player.radius) continue;
      if (distanceSq > 0.000001) {
        const distance = Math.sqrt(distanceSq);
        px = nearX + (dx / distance) * player.radius;
        pz = nearZ + (dz / distance) * player.radius;
      } else {
        const left = px - box.minX;
        const right = box.maxX - px;
        const back = pz - box.minZ;
        const front = box.maxZ - pz;
        const smallest = Math.min(left, right, back, front);
        if (smallest === left) px = box.minX - player.radius;
        else if (smallest === right) px = box.maxX + player.radius;
        else if (smallest === back) pz = box.minZ - player.radius;
        else pz = box.maxZ + player.radius;
      }
    }
  }
  return [clamp(px, BOUNDS.minX, BOUNDS.maxX), clamp(pz, BOUNDS.minZ, BOUNDS.maxZ)];
}

function distanceTo(x, z) {
  return Math.hypot(player.x - x, player.z - z);
}

// -------------------------------------------------------------- interaction
function collectSlice(pan) {
  if (!pan.slice) return;
  state.plate += 1;
  state.score += 10;
  addPlateSlice();
  audio.pickup();
  spawnText('+10', pan.x, 1.9, pan.z, '#ffd93d', 0.65);
  spawnConfetti(pan.x, 1.5, pan.z, 7, 0.8);
  removeSlice(pan);
  updateHud();
  if (state.plate === PLATE_MAX) {
    showBanner('PLATE FULL! FIND A BOOTH AND EAT →', 2.6);
  }
}

function nearestBooth(maxDistance = 2.7) {
  let best = null;
  let bestDistance = maxDistance;
  booths.forEach((booth) => {
    const distance = distanceTo(booth.x, booth.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = booth;
    }
  });
  return best;
}

function boothFromObject(object) {
  let node = object;
  while (node && !node.userData.booth) node = node.parent;
  return node ? node.userData.booth : null;
}

function pickSeat(booth) {
  const left = booth.x - 1.45;
  const right = booth.x + 1.45;
  const leftScore = Math.abs(left - player.x) + Math.abs(left + 4.55) * 0.01;
  const rightScore = Math.abs(right - player.x) + Math.abs(right + 4.55) * 0.01;
  return leftScore <= rightScore ? left : right;
}

function beginEating(booth) {
  if (state.phase !== 'play' || state.eating || whack) return false;
  if (!booth) return false;
  if (state.plate <= 0) {
    showBanner('GRAB A SLICE FIRST — THEN SIT DOWN.', 1.9);
    return false;
  }
  if (distanceTo(booth.x, booth.z) > 3.1) {
    moveTowards(booth.x, booth.z - 1.35);
    showBanner('SIT DOWN AT THE BOOTH TO EAT.', 1.7);
    return false;
  }
  const seatX = pickSeat(booth);
  state.eating = {
    booth,
    seatX,
    seatZ: booth.z,
    returnX: player.x,
    returnZ: player.z,
    startFacing: kid.rotation.y,
    facing: Math.atan2(booth.x - seatX, 0),
    phase: 'sit',
    phaseTime: 0,
    timer: EAT_SECONDS,
    total: state.plate,
    bites: 0,
    earned: 0,
  };
  player.hasTarget = false;
  keys.clear();
  state.hintAt = -1;
  showBanner('SIT DOWN. NAPKIN ON LAP.', 1.5);
  statusEl.textContent = 'Sitting down to eat. Every slice earns arcade money.';
  return true;
}

function eatSlice(eat) {
  if (state.plate <= 0) return;
  state.plate -= 1;
  state.eaten += 1;
  state.money += CASH_PER_SLICE;
  state.moneyEarned += CASH_PER_SLICE;
  state.score += 25;
  eat.earned += CASH_PER_SLICE;
  removePlateSlice();
  audio.eat();
  spawnText(`+$${CASH_PER_SLICE}`, player.x, 1.8, player.z, '#7dff9b', 0.6);
  updateHud();
}

function resetEatingPose() {
  kidRig.head.rotation.x = 0;
  kidRig.head.rotation.y = 0;
  kidRig.legL.rotation.x = 0;
  kidRig.legR.rotation.x = 0;
  kidRig.armL.rotation.x = 0;
  kidRig.armR.rotation.x = 0;
  kidRig.plateGroup.position.set(0, 0.92, 0.4);
  kid.position.y = 0;
}

function updateEating(dt) {
  const eat = state.eating;
  if (!eat) return;

  if (eat.phase === 'sit') {
    eat.phaseTime += dt;
    const t = Math.min(1, eat.phaseTime / 0.24);
    const ease = t * t * (3 - 2 * t);
    player.x = eat.returnX + (eat.seatX - eat.returnX) * ease;
    player.z = eat.returnZ + (eat.seatZ - eat.returnZ) * ease;
    kid.position.x = player.x;
    kid.position.z = player.z;
    const turn = Math.atan2(Math.sin(eat.facing - eat.startFacing), Math.cos(eat.facing - eat.startFacing));
    kid.rotation.y = eat.startFacing + turn * ease;
    kid.position.y = -0.02 * ease;
    kidRig.legL.rotation.x = -0.95 * ease;
    kidRig.legR.rotation.x = -0.95 * ease;
    kidRig.armL.rotation.x = -0.45 * ease;
    kidRig.armR.rotation.x = -0.45 * ease;
    kidRig.plateGroup.position.y = 0.92 + 0.16 * ease;
    kidRig.plateGroup.position.z = 0.4 + 0.08 * ease;
    if (t >= 1) {
      eat.phase = 'eat';
      eat.phaseTime = 0;
    }
    return;
  }

  if (eat.phase === 'eat') {
    eat.timer -= dt;
    const elapsed = EAT_SECONDS - Math.max(0, eat.timer);
    const targetBites = Math.min(eat.total, Math.floor((elapsed / EAT_SECONDS) * eat.total) + 1);
    while (eat.bites < targetBites) {
      eat.bites += 1;
      eatSlice(eat);
    }
    kid.position.y = -0.02 + Math.sin(state.time * 22) * 0.015;
    kidRig.head.rotation.x = Math.sin(state.time * 24) * 0.09;
    kidRig.armL.rotation.x = -0.7 + Math.sin(state.time * 12) * 0.12;
    kidRig.armR.rotation.x = -0.7 - Math.sin(state.time * 12) * 0.12;
    kidRig.plateGroup.position.y = 1.08 + Math.sin(state.time * 18) * 0.03;
    if (eat.timer <= 0) {
      while (eat.bites < eat.total) {
        eat.bites += 1;
        eatSlice(eat);
      }
      eat.phase = 'stand';
      eat.phaseTime = 0;
      eat.standX = player.x;
      eat.standZ = player.z;
      kidRig.head.rotation.x = 0;
      audio.cash();
      spawnConfetti(player.x, 1.5, player.z, 20, 1.2);
      showBanner(`MMM! +$${eat.earned} FOR THE FUN ROOM.`, 2.4);
      statusEl.textContent = `Finished ${eat.total} slice${eat.total === 1 ? '' : 's'} for $${eat.earned}.`;
    }
    return;
  }

  if (eat.phase === 'stand') {
    eat.phaseTime += dt;
    const t = Math.min(1, eat.phaseTime / 0.26);
    const ease = t * t * (3 - 2 * t);
    player.x = eat.standX + (eat.returnX - eat.standX) * ease;
    player.z = eat.standZ + (eat.returnZ - eat.standZ) * ease;
    kid.position.x = player.x;
    kid.position.z = player.z;
    kid.position.y = -0.02 * (1 - ease);
    kidRig.legL.rotation.x = -0.95 * (1 - ease);
    kidRig.legR.rotation.x = -0.95 * (1 - ease);
    kidRig.armL.rotation.x = -0.7 * (1 - ease);
    kidRig.armR.rotation.x = -0.7 * (1 - ease);
    kidRig.plateGroup.position.y = 0.92 + 0.16 * (1 - ease);
    kidRig.plateGroup.position.z = 0.4 + 0.08 * (1 - ease);
    if (t >= 1) {
      player.facing = eat.facing;
      state.eating = null;
      resetEatingPose();
      updateHud();
      state.hintAt = -1;
    }
  }
}

let whack = null;
let whackCooldown = 0;

function nearestCabinet(maxDistance = 3.4) {
  let best = null;
  let bestDistance = maxDistance;
  cabinets.forEach((cab) => {
    const distance = distanceTo(cab.x, cab.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cab;
    }
  });
  return best;
}

function startWhack(cabinet) {
  if (state.phase !== 'play' || state.eating || whack || whackCooldown > 0) return;
  if (!cabinet) return;
  if (state.money < CABINET_COST) {
    showBanner('NO MONEY! EAT AT A BOOTH FIRST.', 2.2);
    return;
  }
  state.money -= CABINET_COST;
  updateHud();
  audio.cash();
  hankPop.visible = true;
  hankPop.position.set(cabinet.x, 2.02, cabinet.z + 0.15);
  hankPop.scale.setScalar(0.001);
  hankPop.rotation.set(0, 0, 0);
  whack = {
    cabinet,
    life: 0,
    resolved: false,
    resolvedAt: 0,
  };
  cabinet.sideMat.emissiveIntensity = 1.1;
  statusEl.textContent = 'Hank popped out of the cabinet. Tap to whack him!';
}

function whackHank() {
  if (!whack || whack.resolved) return;
  whack.resolved = true;
  whack.resolvedAt = whack.life;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.whacks += 1;
  const points = 120 + (state.combo - 1) * 40;
  state.score += points;
  spawnText(`+${points}`, hankPop.position.x, hankPop.position.y + 0.9, hankPop.position.z, '#fff3a8', 0.85);
  if (state.combo > 1) {
    spawnText(`COMBO x${state.combo}`, hankPop.position.x, hankPop.position.y + 1.55, hankPop.position.z, '#7ef0ff', 0.65);
  }
  spawnConfetti(hankPop.position.x, hankPop.position.y, hankPop.position.z, 28, 1.9);
  audio.whack(state.combo);
  stageHank.userData.cheer = 1;
  updateHud();
  statusEl.textContent = `Whacked Hank for ${points} points. Combo ${state.combo}.`;
}

function missHank() {
  if (!whack || whack.resolved) return;
  whack.resolved = true;
  whack.resolvedAt = whack.life;
  state.combo = 0;
  audio.miss();
  spawnText('BOO!', hankPop.position.x, hankPop.position.y + 0.9, hankPop.position.z, '#ff8b8b', 0.7);
  showBanner('TOO SLOW! HANK DUCKED BACK IN.', 1.8);
}

function endWhack() {
  if (whack) {
    whack.cabinet.sideMat.emissiveIntensity = 0.35;
    whack = null;
  }
  hankPop.visible = false;
  whackCooldown = 0.35;
}

function managerTag() {
  manager.cool = state.time + 3.4;
  if (state.plate > 0) {
    state.plate -= 1;
    removePlateSlice();
  }
  state.combo = 0;
  state.shake = 1;
  audio.buzz();
  showBanner("BRENDA: 'NO RUNNING AT THE HOMESTEAD!'", 2.8);
  spawnText('OOF!', player.x, 2.2, player.z, '#ff8b8b', 0.75);
  const dx = player.x - manager.x;
  const dz = player.z - manager.z;
  const length = Math.hypot(dx, dz) || 1;
  player.x = clamp(player.x + (dx / length) * 0.8, BOUNDS.minX, BOUNDS.maxX);
  player.z = clamp(player.z + (dz / length) * 0.8, BOUNDS.minZ, BOUNDS.maxZ);
  updateHud();
}

// ------------------------------------------------------------------ input
const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let dragging = false;

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function cabinetFromObject(object) {
  let node = object;
  while (node && !node.userData.cabinet) node = node.parent;
  return node ? node.userData.cabinet : null;
}

function moveTowards(x, z) {
  player.targetX = clamp(x, BOUNDS.minX, BOUNDS.maxX);
  player.targetZ = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
  player.hasTarget = true;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (state.phase !== 'play' || state.eating) return;
  setPointerFromEvent(event);
  dragging = true;

  if (whack && !whack.resolved) {
    whackHank();
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const cabinetHits = raycaster.intersectObjects(cabinetTargets, true);
  if (cabinetHits.length) {
    const cabinet = cabinetFromObject(cabinetHits[0].object);
    if (cabinet) {
      if (distanceTo(cabinet.x, cabinet.z) <= 3.6) {
        startWhack(cabinet);
      } else {
        moveTowards(cabinet.x, cabinet.z + 1.9);
        showBanner('THE FUN ROOM IS THIS WAY!', 1.6);
      }
      return;
    }
  }

  const boothHits = raycaster.intersectObjects(boothTargets, true);
  if (boothHits.length) {
    const booth = boothFromObject(boothHits[0].object);
    if (booth) {
      if (state.plate > 0) {
        if (distanceTo(booth.x, booth.z) <= 3.1) beginEating(booth);
        else {
          moveTowards(booth.x, booth.z - 1.35);
          showBanner('SIT DOWN AT THE BOOTH TO EAT.', 1.7);
        }
      } else {
        showBanner('GRAB A SLICE FIRST — THEN SIT DOWN.', 1.9);
      }
      return;
    }
  }

  const floorHits = raycaster.intersectObject(floorMesh, false);
  if (floorHits.length) {
    moveTowards(floorHits[0].point.x, floorHits[0].point.z);
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging || state.phase !== 'play' || state.eating || (whack && !whack.resolved)) return;
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const floorHits = raycaster.intersectObject(floorMesh, false);
  if (floorHits.length) {
    moveTowards(floorHits[0].point.x, floorHits[0].point.z);
  }
});

const stopDrag = () => {
  dragging = false;
};
renderer.domElement.addEventListener('pointerup', stopDrag);
renderer.domElement.addEventListener('pointercancel', stopDrag);
renderer.domElement.addEventListener('pointerleave', stopDrag);

window.addEventListener('keydown', (event) => {
  if (state.phase === 'play' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  if (keys.has(event.code)) return;
  keys.add(event.code);
  if (state.phase !== 'play') return;
  audio.unlock();
  if (event.code === 'Space' || event.code === 'KeyE') {
    if (state.eating) return;
    if (whack && !whack.resolved) whackHank();
    else if (!beginEating(nearestBooth())) startWhack(nearestCabinet(3.6));
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});
window.addEventListener('blur', () => keys.clear());

// ------------------------------------------------------------------ rounds
function resetRound() {
  state.score = 0;
  state.money = 0;
  state.moneyEarned = 0;
  state.plate = 0;
  state.eaten = 0;
  state.whacks = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.round = ROUND_SECONDS;
  state.lastTick = 99;
  state.plateFullAt = -10;
  state.eating = null;
  state.shake = 0;
  state.hudScore = -1;
  state.hudMoney = -1;
  state.hudPlate = -1;
  state.hudTimer = '';

  player.x = -4.6;
  player.z = 1.9;
  player.targetX = player.x;
  player.targetZ = player.z;
  player.hasTarget = false;
  player.facing = 0;
  player.phase = 0;
  kid.position.set(player.x, 0, player.z);
  kid.rotation.y = 0;
  resetEatingPose();

  manager.x = -7.4;
  manager.z = 0.4;
  manager.dir = 1;
  manager.pause = 0;
  manager.cool = -10;
  managerRig.group.position.set(manager.x, 0, manager.z);
  alertSprite.visible = false;

  clearPlate();
  resetSlices();
  clearEffects();
  endWhack();
  whackCooldown = 0;

  bannerEl.classList.remove('show');
  state.bannerUntil = 0;
  vignette.style.opacity = '0';
  updateHud();
}

/*
 * Phones have short screens: keep the HUD and the whole game frame in view
 * when a round starts or ends, so the timer and Hank's pop-up never sit
 * above the visible page.
 */
function focusGame() {
  if (!window.matchMedia || !window.matchMedia('(max-width: 720px)').matches) return;
  const hud = document.querySelector('.ph-hud');
  if (!hud) return;
  const top = hud.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: Math.max(0, top - 64), behavior: 'auto' });
}

function startGame() {
  resetRound();
  state.phase = 'play';
  overlay.classList.add('hidden');
  container.classList.add('playing');
  startButton.blur();
  focusGame();
  hintEl.textContent = 'Grab a hot slice from the buffet!';
  state.hintAt = -1;
  audio.unlock();
  audio.ui();
  showBanner('THE BUFFET IS OPEN. GO GET ’EM.', 2.2);
  statusEl.textContent = 'Round started. Grab slices, eat at a booth for money, and play the arcade.';
}

function rankFor(score) {
  if (score >= 5000) return { emoji: '👑', title: "Hank's Best Friend" };
  if (score >= 3000) return { emoji: '🏆', title: 'Homestead Champion' };
  if (score >= 1500) return { emoji: '🕹️', title: 'Fun Room Legend' };
  if (score >= 600) return { emoji: '🍕', title: 'Buffet Regular' };
  return { emoji: '🧃', title: 'Plate Filler' };
}

function addStatCell(label, value) {
  const cell = document.createElement('div');
  cell.className = 'stat-cell';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('strong');
  valueEl.textContent = value;
  cell.append(labelEl, valueEl);
  overlayStats.append(cell);
}

function endRound() {
  if (state.phase === 'over') return;
  state.phase = 'over';
  state.round = 0;
  state.combo = 0;
  endWhack();
  container.classList.remove('playing');
  dragging = false;

  if (state.eating) {
    const eat = state.eating;
    while (eat.bites < eat.total) {
      eat.bites += 1;
      eatSlice(eat);
    }
    player.x = eat.returnX;
    player.z = eat.returnZ;
    kid.position.x = player.x;
    kid.position.z = player.z;
    state.eating = null;
    resetEatingPose();
  }

  const result = submitScore('pizza-homestead', state.score);
  state.best = result.best;
  const isNewBest = result.isBest;
  const rank = rankFor(state.score);

  overlayKicker.textContent = isNewBest ? 'A new personal best' : 'The receipts are printing';
  overlayTitle.textContent = "TIME'S UP!";
  overlaySub.textContent = `${rank.emoji} ${rank.title}`;
  overlayText.textContent = pick([
    'The soft-serve machine is broken, the claw machine ate your ticket, and Mom says it is time to go. Same time next week?',
    'Brenda has locked the salad bar. Hank is waving goodbye. The carpet will remember you.',
    'You were this close to a plastic spider. There is always next Sunday.',
  ]);
  overlayRules.hidden = true;
  overlayControls.hidden = true;
  overlayStats.replaceChildren();
  addStatCell('Score', formatNumber(state.score));
  addStatCell('Slices eaten', String(state.eaten));
  addStatCell('Hank whacks', String(state.whacks));
  addStatCell('Best combo', String(state.bestCombo));
  addStatCell('Money earned', formatMoney(state.moneyEarned));
  addStatCell('High score', formatNumber(state.best));
  overlayStats.classList.add('show');
  startButton.textContent = 'One more round';
  overlay.classList.remove('hidden');
  overlay.scrollTop = 0;
  focusGame();

  audio.end();
  spawnConfetti(STAGE.x, 2.2, STAGE.z + 0.4, 40, 2.4);
  stageHank.userData.cheer = 1.4;
  spawnText('THANKS FOR VISITING!', STAGE.x, 3.1, STAGE.z, '#ffd93d', 0.9);
  updateHud();
  updateBanner();
  statusEl.textContent = `Time is up. Score ${state.score}. Rank: ${rank.title}.`;
}

startButton.addEventListener('click', () => {
  startGame();
});

// ------------------------------------------------------------------- hint
function updateHint() {
  if (state.phase !== 'play') {
    hintEl.textContent = '';
    return;
  }
  if (state.time < state.hintAt) return;
  state.hintAt = state.time + 0.25;

  let hint = '';
  if (whack && !whack.resolved) {
    hint = 'WHACK HANK! TAP NOW!';
  } else if (state.eating) {
    hint = 'CHOW DOWN! EVERY SLICE IS $2.';
  } else if (state.plate > 0) {
    if (nearestBooth()) hint = 'Press Space or tap the table to sit & eat.';
    else if (state.plate >= PLATE_MAX) hint = 'Plate full! Find a booth and sit down.';
    else hint = 'Take your plate to a booth and eat.';
  } else if (state.money >= CABINET_COST && nearestCabinet(3.6)) {
    hint = 'Tap a cabinet to play — then whack Hank!';
  } else if (state.money >= CABINET_COST) {
    hint = 'Spend your money in the Fun Room!';
  } else if (state.money > 0) {
    hint = `You need $${CABINET_COST} for a cabinet — eat another slice!`;
  } else if (nearestBooth(3.0)) {
    hint = 'Sit here with a plate and eat for money.';
  } else {
    hint = 'Grab a hot slice from the buffet!';
  }

  if (hint !== state.lastHint) {
    hintEl.textContent = hint;
    state.lastHint = hint;
  }
}

// ------------------------------------------------------------------ update
function updatePlayer(dt) {
  if (state.eating) {
    player.moving = false;
    return;
  }
  let moveX = 0;
  let moveZ = 0;

  if (state.phase === 'play') {
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;
  }

  let moving = false;

  if (state.phase === 'play' && (moveX || moveZ)) {
    player.hasTarget = false;
    const length = Math.hypot(moveX, moveZ) || 1;
    const step = player.speed * dt;
    const nextX = player.x + (moveX / length) * step;
    const nextZ = player.z + (moveZ / length) * step;
    const [resolvedX, resolvedZ] = resolveCollisions(nextX, nextZ);
    moving = Math.abs(resolvedX - player.x) > 0.0001 || Math.abs(resolvedZ - player.z) > 0.0001;
    player.x = resolvedX;
    player.z = resolvedZ;
    if (moving) {
      player.facing = Math.atan2(moveX, moveZ);
    }
  } else if (state.phase === 'play' && player.hasTarget) {
    const dx = player.targetX - player.x;
    const dz = player.targetZ - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.08) {
      player.hasTarget = false;
    } else {
      const step = Math.min(player.speed * dt, distance);
      const nextX = player.x + (dx / distance) * step;
      const nextZ = player.z + (dz / distance) * step;
      const [resolvedX, resolvedZ] = resolveCollisions(nextX, nextZ);
      moving = Math.abs(resolvedX - player.x) > 0.0001 || Math.abs(resolvedZ - player.z) > 0.0001;
      player.x = resolvedX;
      player.z = resolvedZ;
      if (moving) player.facing = Math.atan2(dx, dz);
      if (!moving) {
        player.hasTarget = false;
      }
    }
  }

  player.moving = moving;
  let delta = player.facing - kid.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  kid.rotation.y += delta * Math.min(1, dt * 12);

  if (moving) {
    player.phase += dt * 11;
    const swing = Math.sin(player.phase) * 0.7;
    kidRig.legL.rotation.x = swing;
    kidRig.legR.rotation.x = -swing;
    kidRig.armL.rotation.x = -swing * 0.35;
    kidRig.armR.rotation.x = swing * 0.35;
    kid.position.y = Math.abs(Math.sin(player.phase)) * 0.06;
    kidRig.plateGroup.position.y = 0.92 + Math.abs(Math.sin(player.phase + 0.6)) * 0.03;
  } else {
    player.phase = 0;
    kidRig.legL.rotation.x += (0 - kidRig.legL.rotation.x) * Math.min(1, dt * 8);
    kidRig.legR.rotation.x += (0 - kidRig.legR.rotation.x) * Math.min(1, dt * 8);
    kidRig.armL.rotation.x += (0 - kidRig.armL.rotation.x) * Math.min(1, dt * 8);
    kidRig.armR.rotation.x += (0 - kidRig.armR.rotation.x) * Math.min(1, dt * 8);
    kid.position.y += (0 - kid.position.y) * Math.min(1, dt * 8);
    kidRig.plateGroup.position.y += (0.92 - kidRig.plateGroup.position.y) * Math.min(1, dt * 6);
    kidRig.head.rotation.y = Math.sin(state.time * 0.7) * 0.12;
  }

  kid.position.x = player.x;
  kid.position.z = player.z;
  kidRig.stack.rotation.y = Math.sin(state.time * 1.4) * 0.06;
}

function updateManager(dt) {
  const active = state.phase === 'play' || state.phase === 'menu';
  if (active) {
    if (manager.pause > 0) {
      manager.pause -= dt;
    } else {
      manager.x += manager.dir * 1.05 * dt;
      if (manager.x > -1.0) {
        manager.x = -1.0;
        manager.dir = -1;
        manager.pause = 0.7;
      } else if (manager.x < -7.6) {
        manager.x = -7.6;
        manager.dir = 1;
        manager.pause = 0.7;
      }
    }
  }

  managerRig.group.position.set(manager.x, 0, manager.z);
  managerRig.group.rotation.y = manager.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

  manager.phase += dt * 6;
  const swing = manager.pause > 0 ? 0 : Math.sin(manager.phase) * 0.5;
  managerRig.legL.rotation.x = swing;
  managerRig.legR.rotation.x = -swing;
  managerRig.group.position.y = Math.abs(Math.sin(manager.phase)) * 0.025;
  managerRig.armL.rotation.x = -swing * 0.4;
  managerRig.head.rotation.y = Math.sin(state.time * 0.9) * 0.2;

  const distance = distanceTo(manager.x, manager.z);
  alertSprite.visible = state.phase === 'play' && distance < 2.6;
  alertSprite.position.y = 2.35 + Math.sin(state.time * 7) * 0.06;

  if (
    state.phase === 'play' &&
    !state.eating &&
    state.time > manager.cool &&
    distance < 0.95
  ) {
    managerTag();
  }
}

function updateCollectibles(dt) {
  pans.forEach((pan) => {
    if (!pan.slice) {
      pan.timer -= dt;
      if (pan.timer <= 0) spawnSlice(pan);
      return;
    }

    const slice = pan.slice;
    slice.mesh.rotation.y += dt * 0.55;
    slice.mesh.position.y = slice.baseY + Math.sin(state.time * 2.6 + slice.phase) * 0.03;
    const pulse = 1 + Math.sin(state.time * 3.2 + slice.phase) * 0.06;
    slice.ring.scale.set(pulse, pulse, pulse);
    slice.ring.material.opacity = 0.55 + Math.sin(state.time * 3.2 + slice.phase) * 0.15;

    if (state.phase === 'play' && distanceTo(pan.x, pan.z) < 1.35) {
      if (state.plate >= PLATE_MAX) {
        if (state.time > state.plateFullAt + 4) {
          state.plateFullAt = state.time;
          showBanner('PLATE FULL! FIND A BOOTH AND EAT →', 2);
        }
      } else {
        collectSlice(pan);
      }
    }
  });
}

function updateWhack(dt) {
  whackCooldown = Math.max(0, whackCooldown - dt);
  if (!whack) {
    if (hankPop.visible) hankPop.visible = false;
    return;
  }

  whack.life += dt;
  if (!whack.resolved && whack.life > 1.3) missHank();

  const rise = Math.min(1, whack.life / 0.14);
  const duck = whack.resolved ? Math.max(0, 1 - (whack.life - whack.resolvedAt) / 0.16) : 1;
  const scale = Math.max(0.001, 0.86 * rise * duck);
  hankPop.scale.setScalar(scale);
  hankPop.position.y = 2.02 + rise * duck * 0.62;
  hankPop.rotation.z = Math.sin(whack.life * 26) * 0.06 * (1 - rise);

  if (whack.resolved && whack.life - whack.resolvedAt > 0.22) endWhack();
}

function updateStage(dt) {
  stageHank.userData.cheer = Math.max(0, stageHank.userData.cheer - dt * 1.5);
  const cheer = stageHank.userData.cheer;
  const hop = cheer > 0 ? Math.abs(Math.sin((1.5 - cheer) * 14)) * 0.3 : 0;
  stageHank.position.y = stageHank.userData.baseY + Math.sin(state.time * 1.7) * 0.04 + hop;
  stageHank.rotation.y = Math.sin(state.time * 0.8) * 0.16 + cheer * 0.8;
  stageHank.scale.set(1.25, 1.25 + Math.sin(state.time * 1.7) * 0.015, 1.25);

  mushroomMike.position.y = 0.24 + Math.sin(state.time * 2.1 + 0.8) * 0.04;
  mushroomMike.rotation.z = Math.sin(state.time * 1.3) * 0.05;
  pepperoniPete.position.y = 0.24 + Math.sin(state.time * 2.1 + 2.2) * 0.04;
  pepperoniPete.rotation.z = Math.sin(state.time * 1.5 + 1) * 0.06;

  clawHead.position.y = 1.4 + Math.sin(state.time * 0.9) * 0.05;
  clawPlush.rotation.y += dt * 0.4;

  sodaGlow.material.color.setHex(0x55e6ff);
  sodaMachine.rotation.y = Math.sin(state.time * 1.1) * 0.01;
  booths.forEach((booth) => {
    booth.glow.material.opacity = state.plate > 0 ? 0.3 + Math.sin(state.time * 4) * 0.1 : 0.1;
  });
  const arrowPulse = 0.75 + Math.sin(state.time * 2.5) * 0.25;
  arcadeArrow.material.opacity = arrowPulse;
  arcadeArrow.material.transparent = true;
}

function updateWorld(dt) {
  // Fans and flickering arcade marquees.
  cabinets.forEach((cab, index) => {
    cab.sideMat.emissiveIntensity = 0.3 + Math.sin(state.time * 2.2 + index * 0.8) * 0.08;
    if (whack && whack.cabinet === cab) cab.sideMat.emissiveIntensity = 0.9 + Math.sin(state.time * 18) * 0.2;
  });

  arcadeGlowPink.intensity = 24 + Math.sin(state.time * 2.4) * 5;
  arcadeGlowCyan.intensity = 20 + Math.sin(state.time * 2.9 + 1.2) * 4;

  state.shake = Math.max(0, state.shake - dt * 2.2);

  if (followCamera) {
    const halfWidth = (camera.right - camera.left) / 2;
    const targetX = clamp(player.x, -9.1 + halfWidth + 0.25, 9.1 - halfWidth - 0.25);
    camTarget.x += (targetX - camTarget.x) * Math.min(1, dt * 6);
  } else {
    camTarget.x += (0 - camTarget.x) * Math.min(1, dt * 6);
  }

  const shake = prefersReducedMotion() ? 0 : state.shake * 0.28;
  camera.position.set(
    camTarget.x + rand(-shake, shake),
    camTarget.y + CAM_OFFSET.y + rand(-shake, shake),
    camTarget.z + CAM_OFFSET.z
  );
  camera.lookAt(camTarget);
  vignette.style.opacity = state.shake > 0.02 ? String(state.shake * 0.45) : '0';
}

function updateRound(dt) {
  if (state.phase !== 'play') return;
  state.round -= dt;
  const seconds = Math.max(0, Math.ceil(state.round));
  if (seconds <= 10 && seconds !== state.lastTick && seconds > 0) {
    state.lastTick = seconds;
    audio.tick();
  }
  if (state.round <= 0) {
    state.round = 0;
    endRound();
  }


}

function updateBannerTimer() {
  updateBanner();
}

// -------------------------------------------------------------------- boot
const clock = new THREE.Clock();

/* The buffet clock stops when the tab goes away. */
const autoPause = createAutoPause({
  container,
  audio,
  muteButton,
  shouldPause: () => state.phase === 'play',
  message: 'Buffet paused',
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (autoPause.paused) return;
  state.time += dt;
  updateRound(dt);
  updatePlayer(dt);
  updateEating(dt);
  updateManager(dt);
  updateCollectibles(dt);
  updateWhack(dt);
  updateWorld(dt);
  updateStage(dt);
  updateEffects(dt);
  updateBannerTimer();
  updateHint();
  updateHud();
  renderer.render(scene, camera);
}

sizeScene();
resetRound();
state.phase = 'menu';
updateHud();
overlay.classList.remove('hidden');
container.classList.remove('playing');

const resizeObserver = new ResizeObserver(() => {
  sizeScene();
});
resizeObserver.observe(container);
window.addEventListener('resize', sizeScene);

if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  gameTip.textContent =
    'Drag anywhere on the floor to walk. Tap a booth to sit and eat for money, then tap a cabinet to play. Tap again to whack Hank.';
}

requestAnimationFrame(animate);
