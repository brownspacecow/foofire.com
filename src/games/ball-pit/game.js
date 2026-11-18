import * as THREE from 'three';
import { ITEM_BY_ID, rollFind } from './items.js';
import { UPGRADES, PRIZES, UPGRADE_BY_ID, PRIZE_BY_ID, nextCost } from './upgrades.js';
import { sound } from './sound.js';
import { getBest, submitScore } from '../../utils/scores.js';

/* ------------------------------------------------------------------ DOM */
const container = document.querySelector('#game-container');
const gameShell = document.querySelector('#pit-game');
const coinCountEl = document.querySelector('#coin-count');
const findCountEl = document.querySelector('#find-count');
const packCountEl = document.querySelector('#pack-count');
const bestCountEl = document.querySelector('#best-count');
const messageEl = document.querySelector('#message');
const eventPill = document.querySelector('#event-pill');
const muteButton = document.querySelector('#mute-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const backpackButton = document.querySelector('#backpack-button');
const shopButton = document.querySelector('#shop-button');
const displayButton = document.querySelector('#display-button');
const winBanner = document.querySelector('#win-banner');
const winKicker = document.querySelector('#win-kicker');
const winName = document.querySelector('#win-name');
const winMeta = document.querySelector('#win-meta');
const packList = document.querySelector('#pack-list');
const packEmpty = document.querySelector('#pack-empty');
const sellJunkButton = document.querySelector('#sell-junk-button');
const sellAllButton = document.querySelector('#sell-all-button');
const saveNote = document.querySelector('#save-note');
const shopList = document.querySelector('#shop-list');
const prizeList = document.querySelector('#prize-list');
const shopCoins = document.querySelector('#shop-coins');
const pitModal = document.querySelector('#pit-modal');
const modalClose = document.querySelector('#modal-close');
const modalTitle = document.querySelector('#modal-title');
const tabButtons = [...document.querySelectorAll('[data-tab]')];
const panes = [...document.querySelectorAll('[data-pane]')];
const caseSlots = document.querySelector('#case-slots');
const casePicker = document.querySelector('#case-picker');
const caseEmpty = document.querySelector('#case-empty');
const modalToast = document.querySelector('#modal-toast');

/* -------------------------------------------------------------- constants */
const SAVE_KEY = 'foofire.ballPit.save.v1';
const BALL_RADIUS = 0.34;
const BASE_HALF_X = 4.8;
const BASE_HALF_Z = 3.8;
const WALL_HEIGHT = 1.05;
const WALL_THICKNESS = 0.42;
const PLAYER_RADIUS = 0.42;
const BASE_SPEED = 2.6;
const SPEED_PER_LEVEL = 0.36;
const BASE_FIND_CHANCE = 0.62;
const DIG_COOLDOWN = 0.55;
const MAX_COINS = 9999999;

const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pit = { halfX: BASE_HALF_X, halfZ: BASE_HALF_Z };

const state = {
  coins: 0,
  finds: 0,
  bestFind: getBest('ball-pit'),
  iphones: 0,
  backpack: {},
  upgrades: { luck: 0, speed: 0, scoop: 0, playground: 0, value: 0, haste: 0, case: 0 },
  prizes: new Set(),
  display: [],
  muted: false,
  storage: true,
};

/* ------------------------------------------------------------------ utils */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function lerpAngle(from, to, t) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

const coinsText = (value) => value.toLocaleString('en-US');

const saleBonus = () =>
  1 + state.upgrades.value * 0.1 + (state.prizes.has('golden-spatula') ? 0.15 : 0);
const displaySlots = () =>
  2 + state.upgrades.case + (state.prizes.has('mega-case') ? 3 : 0);
const polishedValue = (value) => Math.round(value * saleBonus());
const digCooldown = () => Math.max(0.3, DIG_COOLDOWN - state.upgrades.haste * 0.045);

function digRadius() {
  const bigDig = activeEvent?.def.id === 'bigdig';
  return (1.45 + 0.32 * state.upgrades.scoop) * (bigDig ? 1.7 : 1);
}

/* ---------------------------------------------------------------- renderer */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0418);
scene.fog = new THREE.Fog(0x0a0418, 26, 48);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
camera.position.set(0, 7.5, 7.1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-hidden', 'true');
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
let elapsed = 0;
let nowSec = performance.now() / 1000;

const MATS = new Map();
function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATS.has(key)) {
    MATS.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...options })
    );
  }
  return MATS.get(key);
}

function box(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* ----------------------------------------------------------------- lights */
const hemi = new THREE.HemisphereLight(0xcbb8ff, 0x21103f, 1.05);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.55);
sun.position.set(6, 12, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 32;
sun.shadow.bias = -0.0005;
scene.add(sun);

const pinkGlow = new THREE.PointLight(0xff2e63, 26, 18, 2);
pinkGlow.position.set(-4.5, 4.4, 2.5);
scene.add(pinkGlow);

const blueGlow = new THREE.PointLight(0x2ec4ff, 22, 18, 2);
blueGlow.position.set(4.5, 4.2, -2);
scene.add(blueGlow);

/* ------------------------------------------------------------------ floor */
const roomFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70),
  new THREE.MeshStandardMaterial({ color: 0x140b2e, roughness: 0.95 })
);
roomFloor.rotation.x = -Math.PI / 2;
roomFloor.receiveShadow = true;
scene.add(roomFloor);

/* ------------------------------------------------------------- textures */
function makePitTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241a4d';
  ctx.fillRect(0, 0, 256, 256);

  const dots = ['#ff2e63', '#ffd93d', '#2ec4ff', '#3ddc84', '#a855f7'];
  for (let i = 0; i < 44; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.12;
    ctx.fillStyle = dots[i % dots.length];
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 5 + Math.random() * 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#fff8e7';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const pitTexture = makePitTexture();

function makeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 144);
  ctx.font = 'bold 74px "Courier New", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2e63';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#fff8e7';
  ctx.fillText('BALL PIT', 256, 68);
  ctx.shadowColor = '#2ec4ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffd93d';
  ctx.font = 'bold 30px "Courier New", ui-monospace, monospace';
  ctx.fillText('★ BONANZA ★', 256, 116);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const emojiTextures = new Map();
function emojiTexture(emoji) {
  if (emojiTextures.has(emoji)) return emojiTextures.get(emoji);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font =
    '96px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  emojiTextures.set(emoji, texture);
  return texture;
}

/* -------------------------------------------------------------------- pit */
const pitGroup = new THREE.Group();
scene.add(pitGroup);

function clearGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.isSprite && object.material) object.material.dispose();
  });
  group.clear();
}

function applyPitSize() {
  pit.halfX = BASE_HALF_X + state.upgrades.playground * 0.35;
  pit.halfZ = BASE_HALF_Z + state.upgrades.playground * 0.3;
}

const PANEL_COLORS = [0xff2e63, 0xffd93d, 0x2ec4ff, 0x3ddc84, 0xa855f7];

function buildPit() {
  clearGroup(pitGroup);

  pitTexture.repeat.set(Math.max(1, pit.halfX / 2), Math.max(1, pit.halfZ / 2));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(pit.halfX * 2, pit.halfZ * 2),
    new THREE.MeshStandardMaterial({ map: pitTexture, roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.012;
  floor.receiveShadow = true;
  pitGroup.add(floor);

  const base = box(
    pitGroup,
    pit.halfX * 2 + 1.2,
    0.6,
    pit.halfZ * 2 + 1.2,
    mat(0x1a1040, { roughness: 0.85 }),
    0,
    -0.31,
    0
  );
  base.receiveShadow = true;

  const wallMat = mat(0x2b1a5c, { roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    roughness: 0.5,
    emissive: 0xffd93d,
    emissiveIntensity: 0.22,
  });

  function wall(length, x, z, rotationY) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const baseWall = box(group, length, WALL_HEIGHT, WALL_THICKNESS, wallMat, 0, WALL_HEIGHT / 2, 0);
    baseWall.castShadow = true;
    baseWall.receiveShadow = true;

    const panelCount = Math.max(2, Math.round(length / 1.05));
    const panelWidth = length / panelCount;
    for (let i = 0; i < panelCount; i++) {
      const panel = box(
        group,
        panelWidth * 0.86,
        WALL_HEIGHT * 0.78,
        WALL_THICKNESS + 0.08,
        mat(PANEL_COLORS[i % PANEL_COLORS.length], { roughness: 0.72 }),
        -length / 2 + panelWidth * (i + 0.5),
        WALL_HEIGHT * 0.5,
        0
      );
      panel.castShadow = true;
    }

    const rail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, Math.max(0.2, length - 0.34), 4, 10),
      railMat
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.y = WALL_HEIGHT + 0.1;
    rail.castShadow = true;
    group.add(rail);

    pitGroup.add(group);
  }

  wall(pit.halfX * 2 + WALL_THICKNESS * 2, 0, -(pit.halfZ + WALL_THICKNESS / 2), 0);
  wall(pit.halfX * 2 + WALL_THICKNESS * 2, 0, pit.halfZ + WALL_THICKNESS / 2, 0);
  wall(pit.halfZ * 2 + WALL_THICKNESS * 2, -(pit.halfX + WALL_THICKNESS / 2), 0, Math.PI / 2);
  wall(pit.halfZ * 2 + WALL_THICKNESS * 2, pit.halfX + WALL_THICKNESS / 2, 0, Math.PI / 2);

  const signFrame = box(
    pitGroup,
    4.1,
    1.3,
    0.18,
    mat(0x120a2a, { roughness: 0.6, metalness: 0.3 }),
    0,
    2.5,
    -(pit.halfZ + 1.05)
  );
  signFrame.castShadow = true;

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 1.04),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(), transparent: true })
  );
  sign.position.set(0, 2.5, -(pit.halfZ + 0.95));
  pitGroup.add(sign);

  [-1.6, 1.6].forEach((x) => {
    box(pitGroup, 0.1, 1.55, 0.1, wallMat, x, 1.72, -(pit.halfZ + 1.05));
  });
}

/* ------------------------------------------------------------------ props */
const propsGroup = new THREE.Group();
scene.add(propsGroup);
let discoBall = null;

function buildSlide() {
  const x = pit.halfX + 1.5;
  const z = -1.6;
  const ramp = box(propsGroup, 3.2, 0.14, 1.3, mat(0xffd93d, { roughness: 0.4, metalness: 0.3 }), x, 1.0, z);
  ramp.rotation.z = 0.34;
  ramp.castShadow = true;

  [-0.58, 0.58].forEach((offset) => {
    const rail = box(
      propsGroup,
      3.2,
      0.28,
      0.12,
      mat(0x2ec4ff, { roughness: 0.4, metalness: 0.3 }),
      x,
      1.18,
      z + offset
    );
    rail.rotation.z = 0.34;
    rail.castShadow = true;
  });

  for (let i = 0; i < 3; i++) {
    const height = 0.34 + i * 0.36;
    const step = box(
      propsGroup,
      0.7,
      height,
      1.3,
      mat(0xa855f7, { roughness: 0.75 }),
      x + 1.75,
      height / 2,
      z
    );
    step.castShadow = true;
  }
}

function buildTrampoline() {
  const x = -pit.halfX - 1.6;
  const z = -1.5;
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.14, 24),
    mat(0x2ec4ff, { roughness: 0.5 })
  );
  pad.position.set(x, 0.6, z);
  pad.castShadow = true;
  propsGroup.add(pad);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.09, 8, 28),
    mat(0xff2e63, { roughness: 0.4 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.64, z);
  propsGroup.add(ring);

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    box(
      propsGroup,
      0.09,
      0.6,
      0.09,
      mat(0xd1d5db, { metalness: 0.6, roughness: 0.35 }),
      x + Math.cos(angle) * 0.55,
      0.3,
      z + Math.sin(angle) * 0.55
    );
  }
}

function buildLights() {
  const bulbGeometry = new THREE.SphereGeometry(0.075, 8, 6);
  const bulbColors = [0xffd93d, 0x2ec4ff, 0xff2e63, 0x3ddc84];

  for (let strand = 0; strand < 3; strand++) {
    const z = -pit.halfZ + 1.1 + strand * 1.7;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const bulb = new THREE.Mesh(
        bulbGeometry,
        new THREE.MeshBasicMaterial({ color: bulbColors[i % bulbColors.length] })
      );
      bulb.position.set(
        -pit.halfX + t * pit.halfX * 2,
        WALL_HEIGHT + 1.5 - Math.sin(t * Math.PI) * 0.55,
        z
      );
      propsGroup.add(bulb);
    }
  }

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 18, 12),
    mat(0xdfe7ff, { metalness: 0.95, roughness: 0.15 })
  );
  ball.position.set(0, 3.6, 0);
  propsGroup.add(ball);
  discoBall = ball;

  const glow = new THREE.PointLight(0xff8fc7, 30, 16, 2);
  glow.position.set(0, 3.3, 0);
  propsGroup.add(glow);
}

function buildFountain() {
  const x = pit.halfX - 1.15;
  const z = -(pit.halfZ - 1.15);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.9, 0.42, 20),
    mat(0x2b1a5c, { roughness: 0.7, metalness: 0.25 })
  );
  basin.position.set(x, 0.21, z);
  basin.castShadow = true;
  propsGroup.add(basin);

  const gold = mat(0xffd93d, { metalness: 0.85, roughness: 0.22, emissive: 0xffd93d, emissiveIntensity: 0.3 });
  const statue = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), gold);
  statue.position.set(x, 0.95, z);
  statue.castShadow = true;
  propsGroup.add(statue);

  const post = box(propsGroup, 0.16, 0.5, 0.16, gold, x, 0.55, z);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), gold);
    small.position.set(x + Math.cos(angle) * 0.62, 0.2, z + Math.sin(angle) * 0.62);
    propsGroup.add(small);
  }
}

function buildProps() {
  clearGroup(propsGroup);
  discoBall = null;
  const level = state.upgrades.playground;
  if (level >= 1) buildSlide();
  if (level >= 2) buildTrampoline();
  if (level >= 3) buildLights();
  if (level >= 4) buildFountain();
}

/* ------------------------------------------------------------------ balls */
const BALL_COLORS = [0xff2e63, 0xffd93d, 0x2ec4ff, 0x3ddc84, 0xa855f7, 0xff8a00, 0xff8fc7, 0x6ee7ff, 0xb7f36b, 0xf9a8d4];
const ballMaterials = BALL_COLORS.map(
  (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.06,
      emissive: color,
      emissiveIntensity: 0.06,
    })
);
const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 14, 10);
const balls = [];
const BASE_BALL_COUNT = isMobile ? 120 : 190;
const BALLS_PER_LEVEL = isMobile ? 20 : 35;

function spawnBallAt(x, y, z, temporary = false) {
  const mesh = new THREE.Mesh(ballGeometry, ballMaterials[Math.floor(Math.random() * ballMaterials.length)]);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  const ball = { mesh, vel: new THREE.Vector3(0, 0, 0), temporary };
  balls.push(ball);
  return ball;
}

function removeBall(ball) {
  const index = balls.indexOf(ball);
  if (index >= 0) balls.splice(index, 1);
  scene.remove(ball.mesh);
}

function spawnBall() {
  const ball = spawnBallAt(
    (Math.random() * 2 - 1) * (pit.halfX - BALL_RADIUS - 0.3),
    BALL_RADIUS + Math.random() * 1.6,
    (Math.random() * 2 - 1) * (pit.halfZ - BALL_RADIUS - 0.3)
  );
  ball.vel.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
}

function ensureBallCount() {
  const target = BASE_BALL_COUNT + state.upgrades.playground * BALLS_PER_LEVEL;
  while (balls.length < target) spawnBall();
}

/* ----------------------------------------------------------------- player */
const player = new THREE.Group();
scene.add(player);

const playerState = {
  target: new THREE.Vector3(),
  hasTarget: false,
  velocity: new THREE.Vector3(),
};
const playerMotion = new THREE.Vector3();

let duck = null;
let bear = null;
let crown = null;
let petRock = null;
let robotBuddy = null;
let umbrella = null;

function buildDuck() {
  const group = new THREE.Group();
  const yellow = mat(0xffd93d, { roughness: 0.65 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), yellow);
  body.scale.set(1.15, 0.9, 1.35);
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), yellow);
  head.position.set(0, 0.18, 0.13);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 8), mat(0xff8a00, { roughness: 0.6 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.16, 0.24);
  group.add(beak);

  [-0.045, 0.045].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 6), mat(0x120a2a, { roughness: 0.4 }));
    eye.position.set(x, 0.21, 0.2);
    group.add(eye);
  });

  return group;
}

function buildPetRock() {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.17, 0),
    mat(0x8b8fa3, { roughness: 0.95 })
  );
  rock.scale.set(1.15, 0.8, 1);
  rock.castShadow = true;
  group.add(rock);

  [-0.055, 0.055].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), mat(0x120a2a));
    eye.position.set(x, 0.04, 0.155);
    group.add(eye);
  });

  return group;
}

function buildRobotBuddy() {
  const group = new THREE.Group();
  const body = box(
    group,
    0.3,
    0.3,
    0.24,
    mat(0x7dd3fc, { metalness: 0.4, roughness: 0.35 }),
    0,
    0.32,
    0
  );
  body.castShadow = true;

  const head = box(
    group,
    0.24,
    0.2,
    0.2,
    mat(0xa855f7, { metalness: 0.4, roughness: 0.35 }),
    0,
    0.58,
    0
  );
  head.castShadow = true;

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd93d });
  [-0.06, 0.06].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eye.position.set(x, 0.59, 0.11);
    group.add(eye);
  });

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6),
    mat(0xd1d5db, { metalness: 0.7, roughness: 0.3 })
  );
  antenna.position.y = 0.75;
  group.add(antenna);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2e63 })
  );
  bulb.position.y = 0.84;
  group.add(bulb);

  [-0.1, 0.1].forEach((x) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10),
      mat(0x1b1238, { roughness: 0.9 })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.09, 0);
    group.add(wheel);
  });

  return group;
}

function buildUmbrella() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6),
    mat(0xf3d2a2, { roughness: 0.6 })
  );
  pole.position.y = 0.31;
  group.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.2, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xff2e63,
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
  );
  canopy.position.y = 0.64;
  group.add(canopy);

  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 6),
    mat(0xffd93d, { metalness: 0.5, roughness: 0.3 })
  );
  knob.position.y = 0.76;
  group.add(knob);

  return group;
}

function buildPlayer() {
  const skin = mat(0xffcda8, { roughness: 0.75 });
  const shirt = mat(0x2ec4ff, { roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.42, 6, 12), shirt);
  body.position.y = 0.78;
  body.castShadow = true;
  player.add(body);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.24, 12), mat(0x3ddc84, { roughness: 0.85 }));
  hips.position.y = 0.46;
  hips.castShadow = true;
  player.add(hips);

  [-0.15, 0.15].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8), skin);
    leg.position.set(x, 0.32, 0);
    player.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.3), mat(0x1b1238, { roughness: 0.9 }));
    shoe.position.set(x, 0.2, 0.04);
    shoe.castShadow = true;
    player.add(shoe);
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin);
  head.position.y = 1.28;
  head.castShadow = true;
  player.add(head);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0xff2e63, { roughness: 0.8 })
  );
  cap.position.y = 1.29;
  player.add(cap);

  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.22), mat(0xff2e63, { roughness: 0.8 }));
  brim.position.set(0, 1.31, 0.21);
  player.add(brim);

  [-0.085, 0.085].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mat(0x120a2a, { roughness: 0.4 }));
    eye.position.set(x, 1.3, 0.215);
    player.add(eye);
  });

  crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, 0.15, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffd93d,
      emissive: 0xffd93d,
      emissiveIntensity: 0.6,
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide,
    })
  );
  crown.position.y = 1.54;
  crown.visible = false;
  player.add(crown);

  bear = new THREE.Group();
  const bearBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0x6b4a2f, { roughness: 0.95 }));
  bear.add(bearBody);
  const bearHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat(0x7d5837, { roughness: 0.95 }));
  bearHead.position.y = 0.15;
  bear.add(bearHead);
  [-0.09, 0.09].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(0x6b4a2f, { roughness: 0.95 }));
    ear.position.set(x, 0.23, 0);
    bear.add(ear);
  });
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat(0xf3d2a2, { roughness: 0.9 }));
  snout.position.set(0, 0.14, 0.1);
  bear.add(snout);
  bear.position.set(0, 1.02, -0.34);
  bear.visible = false;
  player.add(bear);

  duck = buildDuck();
  duck.visible = false;
  scene.add(duck);

  petRock = buildPetRock();
  petRock.visible = false;
  petRock.position.set(0, 0.18, -1);
  scene.add(petRock);

  robotBuddy = buildRobotBuddy();
  robotBuddy.visible = false;
  robotBuddy.position.set(1, 0, 0);
  scene.add(robotBuddy);

  umbrella = buildUmbrella();
  umbrella.visible = false;
  umbrella.position.set(0, 1.68, 0);
  player.add(umbrella);
}

function applyPrizeVisuals() {
  if (crown) crown.visible = state.prizes.has('neon-crown');
  if (bear) bear.visible = state.prizes.has('bear-plush');
  if (duck) duck.visible = state.prizes.has('duck-buddy');
  if (petRock) petRock.visible = state.prizes.has('pet-rock');
  if (robotBuddy) robotBuddy.visible = state.prizes.has('robot-buddy');
  if (umbrella) umbrella.visible = state.prizes.has('tiny-umbrella');
}

/* ---------------------------------------------------------------- effects */
const effects = [];
const CONFETTI_COLORS = [0xff2e63, 0xffd93d, 0x2ec4ff, 0x3ddc84, 0xa855f7, 0xff8a00];
const confettiGeometry = new THREE.BoxGeometry(0.09, 0.14, 0.02);

function spawnFindSprite(item) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: emojiTexture(item.emoji),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  sprite.position.set(player.position.x, 1.75, player.position.z);
  sprite.scale.set(0.9, 0.9, 1);
  scene.add(sprite);
  effects.push({ type: 'pop', object: sprite, life: 0, duration: 1.25, baseScale: 0.9 });
}

function spawnDigRing(radius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfff3c4,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(player.position.x, 0.07, player.position.z);
  scene.add(ring);
  effects.push({ type: 'ring', object: ring, life: 0, duration: 0.45, radius });
}

function burstConfetti(x, z, count = 18) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      confettiGeometry,
      new THREE.MeshBasicMaterial({
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        transparent: true,
      })
    );
    mesh.position.set(x + (Math.random() - 0.5) * 0.7, 1.5 + Math.random() * 0.7, z + (Math.random() - 0.5) * 0.7);
    scene.add(mesh);
    effects.push({
      type: 'confetti',
      object: mesh,
      life: 0,
      duration: 1.3 + Math.random() * 0.5,
      vel: new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 4),
      spin: 4 + Math.random() * 8,
    });
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.life += dt;
    const t = Math.min(1, fx.life / fx.duration);

    if (fx.type === 'pop') {
      fx.object.position.y += dt * 1.1;
      const scale = fx.baseScale * (0.7 + t * 0.95);
      fx.object.scale.set(scale, scale, 1);
      fx.object.material.opacity = 1 - t * t;
    } else if (fx.type === 'ring') {
      const scale = 0.6 + t * fx.radius;
      fx.object.scale.set(scale, scale, 1);
      fx.object.material.opacity = (1 - t) * 0.75;
    } else if (fx.type === 'confetti') {
      fx.vel.y -= 9 * dt;
      fx.object.position.addScaledVector(fx.vel, dt);
      fx.object.position.y = Math.max(0.06, fx.object.position.y);
      fx.object.rotation.x += fx.spin * dt;
      fx.object.rotation.z += fx.spin * 0.7 * dt;
      fx.object.material.opacity = 1 - t;
    }

    if (t >= 1) {
      scene.remove(fx.object);
      if (fx.type === 'confetti' || fx.type === 'ring') {
        if (fx.object.geometry && fx.type === 'ring') fx.object.geometry.dispose();
        fx.object.material.dispose();
      } else if (fx.type === 'pop') {
        fx.object.material.dispose();
      }
      effects.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ input */
const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let dragging = false;

function setTargetFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(floorPlane, hitPoint)) return;

  const maxX = pit.halfX - WALL_THICKNESS * 0.5 - PLAYER_RADIUS;
  const maxZ = pit.halfZ - WALL_THICKNESS * 0.5 - PLAYER_RADIUS;
  playerState.target.set(clamp(hitPoint.x, -maxX, maxX), 0, clamp(hitPoint.z, -maxZ, maxZ));
  playerState.hasTarget = true;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  sound.unlock();
  if (isModalOpen()) return;

  dragging = true;
  setTargetFromEvent(event);

  if (
    playerState.hasTarget &&
    Math.hypot(
      playerState.target.x - player.position.x,
      playerState.target.z - player.position.z
    ) <= digRadius()
  ) {
    playerState.hasTarget = false;
    dig();
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  setTargetFromEvent(event);
});

const stopDrag = () => {
  dragging = false;
};
renderer.domElement.addEventListener('pointerup', stopDrag);
renderer.domElement.addEventListener('pointercancel', stopDrag);
renderer.domElement.addEventListener('pointerleave', stopDrag);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && isModalOpen()) {
    closeModal();
    return;
  }
  if (isModalOpen()) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    return;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'Space' || event.code === 'KeyF') {
    sound.unlock();
    dig();
    return;
  }
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});
window.addEventListener('blur', () => keys.clear());

container.addEventListener('pointerdown', () => {
  try {
    container.focus({ preventScroll: true });
  } catch {
    container.focus();
  }
});

/* --------------------------------------------------------------- movement */
function updatePlayer(dt) {
  if (isModalOpen()) {
    playerMotion.set(0, 0, 0);
    return;
  }

  const speed = BASE_SPEED + SPEED_PER_LEVEL * state.upgrades.speed;
  let dx = 0;
  let dz = 0;

  if (keys.has('ArrowUp') || keys.has('KeyW')) dz -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) dz += 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;

  let moving = false;

  if (dx || dz) {
    playerState.hasTarget = false;
    const length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;
    moving = true;
  } else if (playerState.hasTarget) {
    const toX = playerState.target.x - player.position.x;
    const toZ = playerState.target.z - player.position.z;
    const distance = Math.hypot(toX, toZ);
    if (distance < 0.15) {
      playerState.hasTarget = false;
    } else {
      dx = toX / distance;
      dz = toZ / distance;
      moving = true;
    }
  }

  if (moving) {
    player.position.x += dx * speed * dt;
    player.position.z += dz * speed * dt;
    player.rotation.y = lerpAngle(player.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
  }

  playerMotion.set(moving ? dx * speed : 0, 0, moving ? dz * speed : 0);

  const maxX = pit.halfX - WALL_THICKNESS * 0.5 - PLAYER_RADIUS;
  const maxZ = pit.halfZ - WALL_THICKNESS * 0.5 - PLAYER_RADIUS;
  player.position.x = clamp(player.position.x, -maxX, maxX);
  player.position.z = clamp(player.position.z, -maxZ, maxZ);
  player.position.y = reducedMotion ? 0.02 : Math.sin(elapsed * 8) * (moving ? 0.05 : 0.02) + 0.02;

  if (duck && duck.visible) {
    const behindX = Math.sin(player.rotation.y) * -0.95;
    const behindZ = Math.cos(player.rotation.y) * -0.95;
    const k = Math.min(1, dt * 4);
    duck.position.x += (player.position.x + behindX - duck.position.x) * k;
    duck.position.z += (player.position.z + behindZ - duck.position.z) * k;
    duck.position.y = 1.05 + (reducedMotion ? 0 : Math.sin(elapsed * 4) * 0.06);
    duck.rotation.y = lerpAngle(duck.rotation.y, player.rotation.y, k);
  }

  if (petRock && petRock.visible) {
    const behindX = Math.sin(player.rotation.y) * -1.35;
    const behindZ = Math.cos(player.rotation.y) * -1.35;
    const k = Math.min(1, dt * 3.5);
    petRock.position.x += (player.position.x + behindX - petRock.position.x) * k;
    petRock.position.z += (player.position.z + behindZ - petRock.position.z) * k;
    petRock.position.y = 0.05 + (reducedMotion ? 0 : Math.abs(Math.sin(elapsed * 5)) * 0.1);
  }

  if (robotBuddy && robotBuddy.visible) {
    const sideX = Math.cos(player.rotation.y) * 0.95;
    const sideZ = -Math.sin(player.rotation.y) * 0.95;
    const k = Math.min(1, dt * 3.5);
    robotBuddy.position.x += (player.position.x + sideX - robotBuddy.position.x) * k;
    robotBuddy.position.z += (player.position.z + sideZ - robotBuddy.position.z) * k;
    robotBuddy.rotation.y = lerpAngle(robotBuddy.rotation.y, player.rotation.y, k);
  }

  if (umbrella && umbrella.visible) {
    umbrella.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 2.4) * 0.08;
  }
}

/* ---------------------------------------------------------------- physics */
const GRAVITY = 17;

function pushBalls() {
  const reach = PLAYER_RADIUS + BALL_RADIUS;
  const reachSq = reach * reach;

  for (const ball of balls) {
    const p = ball.mesh.position;
    if (p.y > 1.9) continue;
    const dx = p.x - player.position.x;
    const dz = p.z - player.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > reachSq || distanceSq < 0.000001) continue;

    const distance = Math.sqrt(distanceSq);
    const nx = dx / distance;
    const nz = dz / distance;
    const overlap = reach - distance;

    p.x += nx * overlap;
    p.z += nz * overlap;
    ball.vel.x += nx * 1.9 + playerMotion.x * 0.45;
    ball.vel.z += nz * 1.9 + playerMotion.z * 0.45;
  }
}

function resolveBallCollisions() {
  const cell = BALL_RADIUS * 2.1;
  const grid = new Map();

  for (let i = 0; i < balls.length; i++) {
    const p = balls[i].mesh.position;
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const minDist = BALL_RADIUS * 2;
  const minDistSq = minDist * minDist;

  for (const [key, bucket] of grid) {
    const [cx, cy, cz] = key.split(',').map(Number);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          const other = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
          if (!other) continue;

          for (const a of bucket) {
            for (const b of other) {
              if (a >= b) continue;
              const ballA = balls[a];
              const ballB = balls[b];
              const pa = ballA.mesh.position;
              const pb = ballB.mesh.position;

              const dx = pb.x - pa.x;
              const dy = pb.y - pa.y;
              const dz = pb.z - pa.z;
              const distanceSq = dx * dx + dy * dy + dz * dz;
              if (distanceSq >= minDistSq || distanceSq < 0.0000001) continue;

              const distance = Math.sqrt(distanceSq);
              const overlap = (minDist - distance) * 0.5;
              const nx = dx / distance;
              const ny = dy / distance;
              const nz = dz / distance;

              pa.x -= nx * overlap;
              pa.y -= ny * overlap;
              pa.z -= nz * overlap;
              pb.x += nx * overlap;
              pb.y += ny * overlap;
              pb.z += nz * overlap;

              if (pa.y < BALL_RADIUS) pa.y = BALL_RADIUS;
              if (pb.y < BALL_RADIUS) pb.y = BALL_RADIUS;

              const relative =
                (ballB.vel.x - ballA.vel.x) * nx +
                (ballB.vel.y - ballA.vel.y) * ny +
                (ballB.vel.z - ballA.vel.z) * nz;
              if (relative < 0) {
                const impulse = -relative * 0.55;
                ballA.vel.x -= nx * impulse;
                ballA.vel.y -= ny * impulse;
                ballA.vel.z -= nz * impulse;
                ballB.vel.x += nx * impulse;
                ballB.vel.y += ny * impulse;
                ballB.vel.z += nz * impulse;
              }
            }
          }
        }
      }
    }
  }
}

function stepBalls(dt) {
  const maxX = pit.halfX - BALL_RADIUS;
  const maxZ = pit.halfZ - BALL_RADIUS;
  const drag = Math.max(0, 1 - 1.1 * dt);

  for (const ball of balls) {
    const p = ball.mesh.position;
    const v = ball.vel;

    v.y -= GRAVITY * dt;
    p.addScaledVector(v, dt);

    if (p.y < BALL_RADIUS) {
      p.y = BALL_RADIUS;
      if (v.y < 0) v.y *= -0.3;
      v.x *= 0.88;
      v.z *= 0.88;
      if (Math.abs(v.y) < 0.5) v.y = 0;
    }

    if (p.x < -maxX) {
      p.x = -maxX;
      if (v.x < 0) v.x = -v.x * 0.35;
    } else if (p.x > maxX) {
      p.x = maxX;
      if (v.x > 0) v.x = -v.x * 0.35;
    }

    if (p.z < -maxZ) {
      p.z = -maxZ;
      if (v.z < 0) v.z = -v.z * 0.35;
    } else if (p.z > maxZ) {
      p.z = maxZ;
      if (v.z > 0) v.z = -v.z * 0.35;
    }

    v.x *= drag;
    v.z *= drag;

    ball.mesh.rotation.x += v.z * dt * 2.2;
    ball.mesh.rotation.z -= v.x * dt * 2.2;
  }

  pushBalls();
  resolveBallCollisions();
}

/* ------------------------------------------------------------------- dig */
let lastDigAt = -10;
let bannerTimeout = 0;
const digHistory = [];
let explorerStreak = 0;
let lastDigPoint = null;

function say(text) {
  messageEl.textContent = text;
}

let toastTimeout = 0;

function notifyModal(text, kind = 'sell') {
  if (!isModalOpen()) return;

  modalToast.textContent = text;
  modalToast.classList.toggle('unlock', kind === 'unlock');
  modalToast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    modalToast.hidden = true;
  }, 2800);
}

function showBanner(kicker, name, meta, rarity) {
  winKicker.textContent = kicker;
  winName.textContent = name;
  winMeta.textContent = meta;
  winBanner.classList.remove('rare', 'ultra', 'event', 'sell', 'unlock');
  if (rarity === 'rare') winBanner.classList.add('rare');
  if (rarity === 'ultra') winBanner.classList.add('ultra');
  if (rarity === 'event') winBanner.classList.add('event');
  if (rarity === 'sell') winBanner.classList.add('sell');
  if (rarity === 'unlock') winBanner.classList.add('unlock');
  winBanner.classList.add('show');
  winBanner.setAttribute('aria-hidden', 'false');

  window.clearTimeout(bannerTimeout);
  bannerTimeout = window.setTimeout(
    () => {
      winBanner.classList.remove('show');
      winBanner.setAttribute('aria-hidden', 'true');
    },
    rarity === 'ultra'
      ? 4200
      : rarity === 'event'
        ? 3600
        : rarity === 'unlock'
          ? 3200
          : 2400
  );
}

function grantFind(item, value) {
  const entry = state.backpack[item.id] || { count: 0, total: 0 };
  entry.count += 1;
  entry.total += value;
  state.backpack[item.id] = entry;

  state.finds += 1;
  if (item.id === 'iphone-17') state.iphones += 1;

  if (value > state.bestFind) {
    state.bestFind = value;
    const result = submitScore('ball-pit', value);
    if (result && Number.isFinite(result.best)) {
      state.bestFind = Math.max(state.bestFind, result.best);
    }
  }
}

function revealFind({ item, value }) {
  grantFind(item, value);
  spawnFindSprite(item);

  const ultra = item.rarity === 'ultra';
  const rare = item.rarity === 'rare';

  if (ultra) {
    sound.ultra();
    burstConfetti(player.position.x, player.position.z, 32);
  } else {
    sound.find(item.rarity);
    if (state.prizes.has('confetti-cannon')) {
      burstConfetti(player.position.x, player.position.z, 18);
    }
  }

  showBanner(
    ultra ? 'ULTRA RARE!' : rare ? 'RARE FIND!' : 'FOUND!',
    item.name,
    `worth ${coinsText(value)} coins`,
    item.rarity
  );

  say(
    ultra
      ? `NO WAY — the ${item.name}! Worth ${coinsText(value)} coins.`
      : `${item.name} goes in your backpack — ${coinsText(value)} coins once you sell it.`
  );

  saveProgress();
  renderHud();
  renderPack();
}

function dig() {
  const bigDig = activeEvent?.def.id === 'bigdig';
  const cooldown = bigDig ? Math.min(0.3, digCooldown()) : digCooldown();
  if (nowSec - lastDigAt < cooldown) return;
  lastDigAt = nowSec;

  sound.unlock();
  sound.dig();

  const px = player.position.x;
  const pz = player.position.z;
  const radius = digRadius();

  for (const ball of balls) {
    const dx = ball.mesh.position.x - px;
    const dz = ball.mesh.position.z - pz;
    const distance = Math.hypot(dx, dz);
    if (distance > radius) continue;

    const falloff = 1 - distance / radius;
    const nx = distance > 0.001 ? dx / distance : Math.random() - 0.5;
    const nz = distance > 0.001 ? dz / distance : Math.random() - 0.5;
    ball.vel.x += nx * falloff * 5.2;
    ball.vel.z += nz * falloff * 5.2;
    ball.vel.y += 1.4 + falloff * 2.2;
  }

  spawnDigRing(radius);

  if (goldenBall) {
    const goldenDistance = Math.hypot(goldenBall.position.x - px, goldenBall.position.z - pz);
    if (goldenDistance <= Math.max(radius, 2.1)) {
      claimGoldenBall();
      return;
    }
  }

  const nearbyDigs = digHistory.filter(
    (digPoint) => nowSec - digPoint.at < 18 && Math.hypot(digPoint.x - px, digPoint.z - pz) < 1.35
  ).length;
  digHistory.push({ x: px, z: pz, at: nowSec });
  if (digHistory.length > 60) digHistory.shift();

  const freshness = Math.max(0.28, 1 - nearbyDigs * 0.18);

  let explorerBonus = 0;
  const movedOn = lastDigPoint === null || Math.hypot(px - lastDigPoint.x, pz - lastDigPoint.z) > 2.2;
  const stayedPut =
    lastDigPoint !== null && Math.hypot(px - lastDigPoint.x, pz - lastDigPoint.z) < 1.2;

  if (stayedPut) {
    explorerStreak = 1;
  } else if (movedOn) {
    explorerStreak += 1;
  }
  lastDigPoint = { x: px, z: pz };

  if (movedOn && explorerStreak % 5 === 0) {
    explorerBonus = 10;
    state.coins = Math.min(MAX_COINS, state.coins + explorerBonus);
    sound.coin();
    saveProgress();
    renderHud();
    renderShop();
  }

  let chance = BASE_FIND_CHANCE + state.upgrades.luck * 0.05;
  if (state.prizes.has('lucky-cat')) chance += 0.04;
  if (activeEvent?.def.id === 'bouncy') chance += 0.18;
  chance += Math.min(0.12, explorerStreak * 0.015);
  chance = clamp(chance * freshness, 0.06, 0.95);

  const valueMultiplier = activeEvent?.def.id === 'golden' ? 2 : 1;

  if (Math.random() < chance) {
    const find = rollFind(state.upgrades.luck);
    if (find) {
      revealFind({ item: find.item, value: Math.round(find.value * valueMultiplier) });
      return;
    }
  }

  sound.empty();

  if (explorerBonus > 0) {
    showBanner(
      'EXPLORER BONUS!',
      `${explorerStreak} fresh spots`,
      `+${explorerBonus} coins`,
      'event'
    );
    say(`${explorerStreak} fresh spots in a row — explorer bonus! +${explorerBonus} coins.`);
    return;
  }

  if (freshness < 0.6) {
    say('These balls are all fluffed up — wade somewhere new for better luck!');
    return;
  }

  say('Just balls this time — keep digging!');
}

/* ----------------------------------------------------------------- events */
const EVENTS = [
  {
    id: 'bouncy',
    name: 'BOUNCY BONANZA',
    emoji: '🏀',
    weight: 3,
    duration: 14,
    announce: 'The whole pit is bouncing! Digging is luckier while it lasts.',
  },
  {
    id: 'golden',
    name: 'GOLDEN HOUR',
    emoji: '✨',
    weight: 3,
    duration: 25,
    announce: 'Everything you dig up is worth double for a little while!',
  },
  {
    id: 'avalanche',
    name: 'BALLALANCHE',
    emoji: '🌊',
    weight: 3,
    duration: 0,
    announce: 'A wall of balls just fell into the pit. Run!',
    start: startAvalanche,
  },
  {
    id: 'sock',
    name: 'SOCK RAIN',
    emoji: '🧦',
    weight: 2,
    duration: 0,
    announce: 'Somebody’s laundry just landed in the ball pit.',
    start: startSockRain,
  },
  {
    id: 'burp',
    name: 'PIT BURP',
    emoji: '🫧',
    weight: 2,
    duration: 0,
    announce: 'The ball pit burped. Everybody out.',
    start: startBurp,
  },
  {
    id: 'ducks',
    name: 'DUCK PARADE',
    emoji: '🦆',
    weight: 2,
    duration: 16,
    announce: 'Make way — the ducks are doing laps.',
    start: startDuckParade,
    stop: stopDuckParade,
  },
  {
    id: 'disco',
    name: 'DISCO TIME',
    emoji: '🪩',
    weight: 2,
    duration: 18,
    announce: 'Somebody turned the ball pit into a disco.',
    start: startDisco,
    stop: stopDisco,
  },
  {
    id: 'bigdig',
    name: 'SUPER SCOOP',
    emoji: '🥄',
    weight: 2,
    duration: 12,
    announce: 'Your hands are giant and the scoop is huge!',
  },
  {
    id: 'goldenball',
    name: 'GOLDEN BALL',
    emoji: '🌟',
    weight: 2,
    duration: 22,
    announce: 'A golden ball is hiding in the pit. Dig near it for treasure!',
    start: spawnGoldenBall,
    stop: removeGoldenBall,
  },
];

let activeEvent = null;
let nextEventAt = performance.now() / 1000 + 16;
const recentEventIds = [];
let eventPillSecond = -1;
let bouncyPulse = 0;
let duckParade = [];
let goldenBall = null;
let goldenBallSpin = 0;
let discoParty = false;

function pickEvent() {
  const pool = EVENTS.filter((event) => !recentEventIds.includes(event.id));
  const total = pool.reduce((sum, event) => sum + event.weight, 0);
  let roll = Math.random() * total;
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return pool[0] || null;
}

function updateEventPill() {
  if (!activeEvent) {
    eventPill.hidden = true;
    return;
  }

  const seconds = Math.ceil(activeEvent.remaining);
  if (seconds === eventPillSecond) return;
  eventPillSecond = seconds;
  eventPill.hidden = false;
  eventPill.textContent = `${activeEvent.def.emoji} ${activeEvent.def.name} · ${seconds}s`;
}

function maybeStartEvent() {
  if (activeEvent || nowSec < nextEventAt) return;

  const def = pickEvent();
  if (!def) return;

  recentEventIds.push(def.id);
  while (recentEventIds.length > 4) recentEventIds.shift();

  showBanner('PIT EVENT!', `${def.emoji} ${def.name}`, def.announce, 'event');
  say(def.announce);
  sound.event();

  if (def.duration > 0) {
    activeEvent = { def, remaining: def.duration };
    eventPillSecond = -1;
    updateEventPill();
    if (def.start) def.start();
  } else if (def.start) {
    def.start();
  }

  nextEventAt = nowSec + (def.duration || 0) + 24 + Math.random() * 16;
}

function finishEvent() {
  if (!activeEvent) return;

  const def = activeEvent.def;
  activeEvent = null;
  eventPill.hidden = true;
  if (def.stop) def.stop();

  say(
    def.id === 'goldenball'
      ? 'The golden ball rolled away. Maybe next time!'
      : 'The pit settles down. Back to digging!'
  );
}

function updateEvent(dt) {
  if (activeEvent) {
    activeEvent.remaining -= dt;

    if (activeEvent.remaining <= 0) {
      finishEvent();
    } else {
      const id = activeEvent.def.id;
      updateEventPill();

      if (id === 'bouncy') {
        bouncyPulse -= dt;
        if (bouncyPulse <= 0) {
          bouncyPulse = 0.5;
          for (const ball of balls) {
            ball.vel.y += 1.4 + Math.random() * 1.2;
            ball.vel.x += (Math.random() - 0.5) * 1.4;
            ball.vel.z += (Math.random() - 0.5) * 1.4;
          }
        }
      }

      if (id === 'disco') {
        const hue = (elapsed * 0.18) % 1;
        pinkGlow.color.setHSL(hue, 1, 0.62);
        blueGlow.color.setHSL((hue + 0.5) % 1, 1, 0.62);
      }
    }
  }

  for (const paradeDuck of duckParade) {
    paradeDuck.position.x += dt * 1.15;
    paradeDuck.position.y = 1.05 + Math.sin(elapsed * 3 + paradeDuck.position.z) * 0.08;
    if (paradeDuck.position.x > pit.halfX + 2) paradeDuck.position.x = -pit.halfX - 2;
  }

  if (goldenBall) {
    goldenBallSpin += dt;
    goldenBall.rotation.y += dt * 1.6;
    goldenBall.position.y = 1.25 + Math.sin(goldenBallSpin * 2.2) * 0.15;
  }
}

function startAvalanche() {
  const side = Math.floor(Math.random() * 4);

  for (let i = 0; i < 18; i++) {
    const jitter = Math.random() * 1.3 - 0.65;
    let x;
    let z;

    if (side === 0) {
      x = (Math.random() * 2 - 1) * (pit.halfX - 1);
      z = -pit.halfZ + 0.7 + Math.random() * 0.8;
    } else if (side === 1) {
      x = (Math.random() * 2 - 1) * (pit.halfX - 1);
      z = pit.halfZ - 0.7 - Math.random() * 0.8;
    } else if (side === 2) {
      x = -pit.halfX + 0.7 + Math.random() * 0.8;
      z = (Math.random() * 2 - 1) * (pit.halfZ - 1);
    } else {
      x = pit.halfX - 0.7 - Math.random() * 0.8;
      z = (Math.random() * 2 - 1) * (pit.halfZ - 1);
    }

    const ball = spawnBallAt(x + jitter, 2.4 + Math.random() * 1.8, z + jitter, true);
    ball.vel.set((Math.random() - 0.5) * 2.4, -1 - Math.random(), (Math.random() - 0.5) * 2.4);
    window.setTimeout(() => removeBall(ball), 24000);
  }
}

function startSockRain() {
  const gains = [];

  for (let i = 0; i < 3; i++) {
    const find = rollFind(state.upgrades.luck);
    if (!find) continue;
    grantFind(find.item, find.value);
    gains.push(find);
  }

  if (!gains.length) return;

  sound.find('common');
  const summary = gains
    .map(({ item, value }) => `${item.emoji} ${item.name} (${coinsText(value)} coins)`)
    .join(' · ');
  say(`Sock rain! You caught: ${summary}`);

  saveProgress();
  renderHud();
  renderPack();
}

function startBurp() {
  for (const ball of balls) {
    ball.vel.y += 2.2 + Math.random() * 2.6;
    ball.vel.x += (Math.random() - 0.5) * 2.6;
    ball.vel.z += (Math.random() - 0.5) * 2.6;
  }
  sound.burp();
}

function startDuckParade() {
  stopDuckParade();

  for (let i = 0; i < 6; i++) {
    const paradeDuck = buildDuck();
    paradeDuck.position.set(
      -pit.halfX - 1.2 - i * 0.9,
      1.05,
      (Math.random() * 2 - 1) * (pit.halfZ - 1.2)
    );
    paradeDuck.rotation.y = Math.PI / 2;
    scene.add(paradeDuck);
    duckParade.push(paradeDuck);
  }
}

function stopDuckParade() {
  duckParade.forEach((paradeDuck) => {
    scene.remove(paradeDuck);
    paradeDuck.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
  });
  duckParade = [];
}

function startDisco() {
  discoParty = true;
  pinkGlow.color.setHex(0xff00e5);
  blueGlow.color.setHex(0x00ffd5);
}

function stopDisco() {
  discoParty = false;
  pinkGlow.color.setHex(0xff2e63);
  blueGlow.color.setHex(0x2ec4ff);
}

function spawnGoldenBall() {
  removeGoldenBall();

  goldenBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 18, 14),
    new THREE.MeshStandardMaterial({
      color: 0xffd93d,
      emissive: 0xffd93d,
      emissiveIntensity: 0.85,
      metalness: 0.8,
      roughness: 0.2,
    })
  );
  goldenBall.position.set(
    (Math.random() * 2 - 1) * (pit.halfX - 1.3),
    1.25,
    (Math.random() * 2 - 1) * (pit.halfZ - 1.3)
  );
  goldenBall.add(new THREE.PointLight(0xffd93d, 16, 6, 2));
  scene.add(goldenBall);
  goldenBallSpin = 0;
}

function removeGoldenBall() {
  if (!goldenBall) return;
  scene.remove(goldenBall);
  goldenBall.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
  goldenBall = null;
  goldenBallSpin = 0;
}

function claimGoldenBall() {
  removeGoldenBall();

  if (activeEvent && activeEvent.def.id === 'goldenball') {
    activeEvent = null;
    eventPill.hidden = true;
  }

  const find = rollFind(state.upgrades.luck + 3);
  if (!find) return;

  const value = Math.round(find.value * 2.5);
  grantFind(find.item, value);
  spawnFindSprite(find.item);
  sound.ultra();
  burstConfetti(player.position.x, player.position.z, 30);
  showBanner('GOLDEN BALL!', find.item.name, `worth ${coinsText(value)} coins`, 'ultra');
  say(`The golden ball cracked open — ${find.item.name}! ${coinsText(value)} coins.`);

  saveProgress();
  renderHud();
  renderPack();
}

/* ------------------------------------------------------------------- HUD */
function backpackTotal() {
  return Object.values(state.backpack).reduce((total, entry) => total + (entry?.count || 0), 0);
}

function renderHud() {
  coinCountEl.textContent = coinsText(state.coins);
  findCountEl.textContent = coinsText(state.finds);
  packCountEl.textContent = coinsText(backpackTotal());
  bestCountEl.textContent = coinsText(state.bestFind);
  shopCoins.textContent = `${coinsText(state.coins)} coins`;
}

function updateMuteButton() {
  const muted = sound.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Turn sounds on' : 'Mute sounds');
}

function updateSaveNote() {
  saveNote.textContent = state.storage
    ? 'Progress saves automatically in this browser.'
    : 'Progress cannot be saved in this browser.';
}

/* ----------------------------------------------------------------- panels */
function sellStack(itemId) {
  const entry = state.backpack[itemId];
  const item = ITEM_BY_ID.get(itemId);
  if (!entry || !item || entry.count <= 0) return;

  const payout = polishedValue(entry.total);
  state.coins = Math.min(MAX_COINS, state.coins + payout);
  delete state.backpack[itemId];
  state.display = state.display.filter((id) => id !== itemId);

  sound.coin();
  showBanner('SOLD!', `+${coinsText(payout)} coins`, `${entry.count} × ${item.name}`, 'sell');
  notifyModal(`SOLD! +${coinsText(payout)} coins — ${entry.count} × ${item.name}`);
  say(`Sold ${entry.count} × ${item.name} for ${coinsText(payout)} coins.`);

  saveProgress();
  renderHud();
  renderPack();
  renderShop();
  renderCase();
}

function sellEverything(junkOnly) {
  const ids = Object.keys(state.backpack).filter((id) => {
    const item = ITEM_BY_ID.get(id);
    return item && state.backpack[id].count > 0 && (!junkOnly || item.rarity === 'junk');
  });
  if (!ids.length) return;

  let coins = 0;
  let count = 0;
  ids.forEach((id) => {
    coins += polishedValue(state.backpack[id].total);
    count += state.backpack[id].count;
    delete state.backpack[id];
  });
  state.display = state.display.filter((id) => !ids.includes(id));

  state.coins = Math.min(MAX_COINS, state.coins + coins);
  sound.coin();
  showBanner(
    'SOLD!',
    `+${coinsText(coins)} coins`,
    `${count} item${count === 1 ? '' : 's'} sold`,
    'sell'
  );
  notifyModal(
    `SOLD! +${coinsText(coins)} coins for ${count} item${count === 1 ? '' : 's'}`
  );
  say(`Sold ${count} item${count === 1 ? '' : 's'} for ${coinsText(coins)} coins.`);

  saveProgress();
  renderHud();
  renderPack();
  renderShop();
  renderCase();
}

function packCard(item, entry) {
  const card = document.createElement('article');
  card.className = 'pack-card';
  card.setAttribute('role', 'listitem');

  const emoji = document.createElement('span');
  emoji.className = 'pack-emoji';
  emoji.textContent = item.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const info = document.createElement('div');
  info.className = 'pack-info';

  const name = document.createElement('p');
  name.className = 'pack-name';
  name.textContent = item.name;

  const meta = document.createElement('p');
  meta.className = 'pack-meta';
  meta.append(`${entry.count} × ${item.label} · `);
  const value = document.createElement('strong');
  value.textContent = `${coinsText(polishedValue(entry.total))} coins`;
  meta.append(value);

  info.append(name, meta);

  const button = document.createElement('button');
  button.className = 'pack-sell';
  button.type = 'button';
  button.textContent = 'Sell';
  button.setAttribute(
    'aria-label',
    `Sell ${entry.count} ${item.name} for ${polishedValue(entry.total)} coins`
  );
  button.addEventListener('click', () => sellStack(item.id));

  card.append(emoji, info, button);
  return card;
}

function renderPack() {
  const ids = Object.keys(state.backpack).filter(
    (id) => state.backpack[id]?.count > 0 && ITEM_BY_ID.has(id)
  );

  ids.sort((a, b) => {
    const entryA = state.backpack[a];
    const entryB = state.backpack[b];
    return entryB.total / entryB.count - entryA.total / entryA.count;
  });

  packList.replaceChildren(...ids.map((id) => packCard(ITEM_BY_ID.get(id), state.backpack[id])));
  packEmpty.hidden = ids.length > 0;

  sellJunkButton.disabled = !ids.some((id) => ITEM_BY_ID.get(id).rarity === 'junk');
  sellAllButton.disabled = ids.length === 0;
}

function caseSlot(item) {
  const slot = document.createElement('div');
  slot.className = 'case-slot';

  if (!item) {
    slot.classList.add('empty');
    slot.textContent = 'Empty spot';
    return slot;
  }

  const emoji = document.createElement('span');
  emoji.className = 'case-emoji';
  emoji.textContent = item.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const name = document.createElement('p');
  name.className = 'case-name';
  name.textContent = item.name;

  const rarity = document.createElement('p');
  rarity.className = 'case-rarity';
  rarity.textContent = item.label;

  const remove = document.createElement('button');
  remove.className = 'case-remove';
  remove.type = 'button';
  remove.textContent = 'Take out';
  remove.setAttribute('aria-label', `Take ${item.name} out of the display case`);
  remove.addEventListener('click', () => toggleDisplay(item.id));

  slot.append(emoji, name, rarity, remove);
  return slot;
}

function casePickerCard(item) {
  const entry = state.backpack[item.id];
  const shown = state.display.includes(item.id);

  const row = document.createElement('div');
  row.className = 'case-pick';

  const emoji = document.createElement('span');
  emoji.className = 'pack-emoji';
  emoji.textContent = item.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const info = document.createElement('div');
  info.className = 'case-pick-info';

  const name = document.createElement('p');
  name.className = 'case-pick-name';
  name.textContent = item.name;

  const meta = document.createElement('p');
  meta.className = 'case-pick-meta';
  meta.textContent = `${entry.count} × ${item.label}`;

  info.append(name, meta);

  const button = document.createElement('button');
  button.className = 'case-toggle';
  button.type = 'button';
  button.textContent = shown ? 'Remove' : 'Show';
  button.disabled = !shown && state.display.length >= displaySlots();
  button.setAttribute('aria-label', `${shown ? 'Remove' : 'Show'} ${item.name}`);
  button.addEventListener('click', () => toggleDisplay(item.id));

  row.append(emoji, info, button);
  return row;
}

function renderCase() {
  const ownedIds = Object.keys(state.backpack).filter(
    (id) => ITEM_BY_ID.has(id) && (state.backpack[id]?.count || 0) > 0
  );
  state.display = state.display.filter((id) => ownedIds.includes(id)).slice(0, displaySlots());

  const shown = state.display.map((id) => ITEM_BY_ID.get(id));
  const slots = [];
  for (let i = 0; i < displaySlots(); i++) {
    slots.push(caseSlot(shown[i] || null));
  }
  caseSlots.replaceChildren(...slots);

  ownedIds.sort((a, b) => {
    const entryA = state.backpack[a];
    const entryB = state.backpack[b];
    return entryB.total / entryB.count - entryA.total / entryA.count;
  });

  casePicker.replaceChildren(...ownedIds.map((id) => casePickerCard(ITEM_BY_ID.get(id))));
  caseEmpty.hidden = ownedIds.length > 0;
}

function toggleDisplay(itemId) {
  if (state.display.includes(itemId)) {
    state.display = state.display.filter((id) => id !== itemId);
    sound.click();
  } else if (state.display.length >= displaySlots()) {
    sound.error();
    say('The display case is full — take something out first.');
    return;
  } else {
    state.display.push(itemId);
    sound.click();
  }

  saveProgress();
  renderCase();
}

function upgradeCard(upgrade) {
  const level = state.upgrades[upgrade.id] || 0;
  const cost = nextCost(upgrade, level);

  const card = document.createElement('article');
  card.className = `shop-card${cost === null ? ' maxed' : ''}`;

  const head = document.createElement('div');
  head.className = 'shop-head';

  const emoji = document.createElement('span');
  emoji.className = 'shop-emoji';
  emoji.textContent = upgrade.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const name = document.createElement('h3');
  name.className = 'shop-name';
  name.textContent = upgrade.name;

  const pips = document.createElement('span');
  pips.className = 'shop-pips';
  pips.setAttribute('aria-label', `Level ${level} of ${upgrade.max}`);
  for (let i = 0; i < upgrade.max; i++) {
    const pip = document.createElement('span');
    pip.className = `pip${i < level ? ' on' : ''}`;
    pips.append(pip);
  }

  head.append(emoji, name, pips);

  const blurb = document.createElement('p');
  blurb.className = 'shop-blurb';
  blurb.textContent = upgrade.blurb;

  const effect = document.createElement('p');
  effect.className = 'shop-effect';
  effect.textContent = upgrade.effect(level);

  const button = document.createElement('button');
  button.className = `shop-buy${cost === null ? ' maxed' : ''}`;
  button.type = 'button';

  if (cost === null) {
    button.textContent = 'MAXED OUT';
    button.disabled = true;
  } else {
    button.textContent = `Buy · ${coinsText(cost)} coins`;
    if (state.coins < cost) {
      button.disabled = true;
      button.title = `Need ${coinsText(cost - state.coins)} more coins`;
    } else {
      button.addEventListener('click', () => buyUpgrade(upgrade.id));
    }
  }

  card.append(head, blurb, effect, button);
  return card;
}

function prizeCard(prize) {
  const owned = state.prizes.has(prize.id);
  const card = document.createElement('article');
  card.className = `shop-card${owned ? ' owned' : ''}`;

  const head = document.createElement('div');
  head.className = 'shop-head';

  const emoji = document.createElement('span');
  emoji.className = 'shop-emoji';
  emoji.textContent = prize.emoji;
  emoji.setAttribute('aria-hidden', 'true');

  const name = document.createElement('h3');
  name.className = 'shop-name';
  name.textContent = prize.name;

  head.append(emoji, name);

  const blurb = document.createElement('p');
  blurb.className = 'shop-blurb';
  blurb.textContent = prize.blurb;

  const button = document.createElement('button');
  button.className = `shop-buy${owned ? ' owned' : ''}`;
  button.type = 'button';

  if (owned) {
    button.textContent = 'OWNED';
    button.disabled = true;
  } else {
    button.textContent = `Buy · ${coinsText(prize.cost)} coins`;
    if (state.coins < prize.cost) {
      button.disabled = true;
      button.title = `Need ${coinsText(prize.cost - state.coins)} more coins`;
    } else {
      button.addEventListener('click', () => buyPrize(prize.id));
    }
  }

  card.append(head, blurb, button);
  return card;
}

function renderShop() {
  shopList.replaceChildren(...UPGRADES.map(upgradeCard));
  prizeList.replaceChildren(...PRIZES.map(prizeCard));
  shopCoins.textContent = `${coinsText(state.coins)} coins`;
}

function buyUpgrade(id) {
  const upgrade = UPGRADE_BY_ID.get(id);
  if (!upgrade) return;

  const level = state.upgrades[id] || 0;
  const cost = nextCost(upgrade, level);
  if (cost === null) return;

  if (state.coins < cost) {
    sound.error();
    say(`Need ${coinsText(cost - state.coins)} more coins for ${upgrade.name}.`);
    return;
  }

  state.coins -= cost;
  state.upgrades[id] = level + 1;

  if (id === 'playground') {
    applyPitSize();
    buildPit();
    buildProps();
    ensureBallCount();
  }

  sound.buy();
  showBanner(
    'UPGRADED!',
    `${upgrade.emoji} ${upgrade.name}`,
    upgrade.effect(level + 1),
    'unlock'
  );
  notifyModal(
    `UNLOCKED! ${upgrade.name} is now level ${level + 1} — ${upgrade.effect(level + 1)}`,
    'unlock'
  );
  say(`${upgrade.name} is now level ${level + 1}!`);

  saveProgress();
  renderHud();
  renderShop();
  renderCase();
}

function buyPrize(id) {
  const prize = PRIZE_BY_ID.get(id);
  if (!prize || state.prizes.has(id)) return;

  if (state.coins < prize.cost) {
    sound.error();
    say(`Need ${coinsText(prize.cost - state.coins)} more coins for the ${prize.name}.`);
    return;
  }

  state.coins -= prize.cost;
  state.prizes.add(id);
  applyPrizeVisuals();

  sound.buy();
  burstConfetti(player.position.x, player.position.z, 24);
  showBanner('UNLOCKED!', `${prize.emoji} ${prize.name}`, 'added to your ball pit', 'unlock');
  notifyModal(`UNLOCKED! ${prize.emoji} ${prize.name} added to your ball pit`, 'unlock');
  say(`You bought the ${prize.name}!`);

  saveProgress();
  renderHud();
  renderShop();
  renderCase();
}

/* ------------------------------------------------------------------- save */
function loadProgress() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    state.storage = false;
  }
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    if (Number.isFinite(data.coins)) state.coins = clamp(Math.floor(data.coins), 0, MAX_COINS);
    if (Number.isFinite(data.finds)) state.finds = clamp(Math.floor(data.finds), 0, 999999);
    if (Number.isFinite(data.bestFind)) {
      state.bestFind = Math.max(state.bestFind, clamp(Math.floor(data.bestFind), 0, MAX_COINS));
    }
    if (Number.isFinite(data.iphones)) {
      state.iphones = clamp(Math.floor(data.iphones), 0, 999);
    }

    if (data.backpack && typeof data.backpack === 'object') {
      Object.entries(data.backpack).forEach(([id, entry]) => {
        const item = ITEM_BY_ID.get(id);
        if (!item || !entry) return;
        const count = Math.floor(Number(entry.count));
        const total = Math.floor(Number(entry.total));
        if (!Number.isFinite(count) || count <= 0) return;
        state.backpack[id] = {
          count: clamp(count, 1, 9999),
          total: clamp(Number.isFinite(total) ? total : count * item.min, 0, MAX_COINS),
        };
      });
    }

    if (data.upgrades && typeof data.upgrades === 'object') {
      UPGRADES.forEach((upgrade) => {
        const level = Math.floor(Number(data.upgrades[upgrade.id]));
        if (Number.isFinite(level)) {
          state.upgrades[upgrade.id] = clamp(level, 0, upgrade.max);
        }
      });
    }

    if (Array.isArray(data.prizes)) {
      data.prizes.forEach((id) => {
        if (PRIZE_BY_ID.has(id)) state.prizes.add(id);
      });
    }

    if (Array.isArray(data.display)) {
      state.display = data.display
        .filter((id) => ITEM_BY_ID.has(id))
        .slice(0, displaySlots());
    }

    state.muted = data.muted === true;
  } catch {
    // A broken save should never stop the ball pit from opening.
  }
}

function saveProgress() {
  if (!state.storage) return;
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        coins: state.coins,
        finds: state.finds,
        bestFind: state.bestFind,
        iphones: state.iphones,
        backpack: state.backpack,
        upgrades: state.upgrades,
        prizes: [...state.prizes],
        display: state.display,
        muted: sound.isMuted(),
      })
    );
  } catch {
    state.storage = false;
    updateSaveNote();
  }
}

/* ----------------------------------------------------------------- camera */
function updateCamera(dt) {
  const zoomOut = (pit.halfZ - BASE_HALF_Z) * 0.8;
  const k = dt >= 1 ? 0.99 : 1 - Math.exp(-5 * dt);
  camera.position.x += (player.position.x * 0.55 - camera.position.x) * k;
  camera.position.y += (7.5 - camera.position.y) * k;
  camera.position.z += (player.position.z * 0.35 + 6.9 + zoomOut - camera.position.z) * k;
  camera.lookAt(player.position.x * 0.5, 1.0, player.position.z * 0.3);
}

/* ----------------------------------------------------------------- layout */
function resize() {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 520;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/* -------------------------------------------------------------- interface */
const PANEL_TITLES = {
  pack: '🎒 Backpack',
  shop: '🛍️ Ball Pit Shop',
  display: '🏆 Display Case',
};

function isModalOpen() {
  return !pitModal.hidden;
}

function setTab(tab) {
  tabButtons.forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  });
  panes.forEach((pane) => {
    pane.hidden = pane.dataset.pane !== tab;
  });
  modalTitle.textContent = PANEL_TITLES[tab] || PANEL_TITLES.pack;

  if (tab === 'pack') renderPack();
  if (tab === 'shop') renderShop();
  if (tab === 'display') renderCase();
}

function openModal(tab = 'pack') {
  sound.unlock();
  sound.click();
  keys.clear();
  playerState.hasTarget = false;
  pitModal.hidden = false;
  modalToast.hidden = true;
  setTab(tab);
  modalClose.focus({ preventScroll: true });
}

function closeModal() {
  pitModal.hidden = true;
  keys.clear();
  try {
    container.focus({ preventScroll: true });
  } catch {
    container.focus();
  }
}

backpackButton.addEventListener('click', () => openModal('pack'));
shopButton.addEventListener('click', () => openModal('shop'));
displayButton.addEventListener('click', () => openModal('display'));

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    sound.click();
    setTab(button.dataset.tab);
  });
});

modalClose.addEventListener('click', closeModal);
pitModal.addEventListener('pointerdown', (event) => {
  if (event.target === pitModal) closeModal();
});

sellJunkButton.addEventListener('click', () => sellEverything(true));
sellAllButton.addEventListener('click', () => sellEverything(false));

muteButton.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.isMuted());
  state.muted = sound.isMuted();
  if (!state.muted) sound.click();
  updateMuteButton();
  saveProgress();
});

fullscreenButton.addEventListener('click', () => {
  sound.click();
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    return;
  }
  if (gameShell.requestFullscreen) {
    gameShell.requestFullscreen().catch(() => {});
  }
});

document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
  resize();
});

/* ------------------------------------------------------------------ start */
loadProgress();
/* Surface a best find saved before the shared scoreboard existed. */
if (state.bestFind > getBest('ball-pit')) submitScore('ball-pit', state.bestFind);
sound.setMuted(state.muted);
applyPitSize();
buildPit();
buildProps();
ensureBallCount();
buildPlayer();
applyPrizeVisuals();
updateMuteButton();
updateSaveNote();
renderHud();
renderPack();
renderShop();
resize();
updateCamera(1);

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  nowSec = performance.now() / 1000;

  updatePlayer(dt);

  const steps = 2;
  for (let i = 0; i < steps; i++) stepBalls(dt / steps);

  updateEvent(dt);
  maybeStartEvent();
  updateEffects(dt);
  updateCamera(dt);

  if (discoBall) {
    discoBall.rotation.y += dt * (discoParty ? 3.2 : 0.6);
  }

  renderer.render(scene, camera);
}

animate();
