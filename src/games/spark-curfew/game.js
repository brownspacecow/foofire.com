import * as THREE from 'three';
import { createAudio } from './audio.js';
import { createCrowd } from './crowd.js';
import { CHEAPEST_PRICE, FIREWORKS, FIREWORK_BY_ID } from './fireworks.js';
import { getBest, submitScore } from '../../utils/scores.js';

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

const container = document.querySelector('#game-container');
const gameShell = document.querySelector('.sc-game');
const cashEl = document.querySelector('#cash');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const crowdEl = document.querySelector('#crowd');
const crowdBonusEl = document.querySelector('#crowd-bonus');
const timeEl = document.querySelector('#time');
const timeBonusEl = document.querySelector('#time-bonus');
const skyIconEl = document.querySelector('#sky-icon');
const skyLabelEl = document.querySelector('#sky-label');
const skySubEl = document.querySelector('#sky-sub');
const muteButton = document.querySelector('#mute-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const placingHint = document.querySelector('#placing-hint');
const banner = document.querySelector('#banner');
const bannerText = banner.querySelector('span');
const floatersEl = document.querySelector('#floaters');
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
const standList = document.querySelector('#stand-list');
const standHint = document.querySelector('#stand-hint');
const whiteout = document.querySelector('#whiteout');
const comboBadge = document.querySelector('#combo-badge');
const comboLabel = document.querySelector('#combo-label');
const comboCount = document.querySelector('#combo-count');
const comboBar = document.querySelector('#combo-bar');
const damageFlash = document.querySelector('#damage-flash');

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const GAME_ID = 'spark-curfew';
const MUTE_KEY = 'sparkCurfewMuted';
const SHOW_SECONDS = 240;
const TIME_BONUS_PER_SECOND = 30;
const DAY_SECONDS = 12;
const START_CASH = 80;
const CROWD_MAX = 60;
const CROWD_STEP = 0.01;
const CROWD_BONUS_MAX = 1.6;
const FUSE_SECONDS = 0.75;
const PLACE = { minX: -6.4, maxX: 6.4, minZ: -5.4, maxZ: 2.4 };

// Big Bertha only comes out once the whole street has turned up.
const FINALE_CROWD = CROWD_MAX;

// Chaining: light one, the fuses around it catch, and every burst inside the
// window keeps the chain alive. Too many in one chain and the rack can misfire.
const CHAIN_WINDOW = 2.1;
const CHAIN_RADIUS = 4.2;
const CHAIN_STAGGER = 0.28;
const CHAIN_LINKS_MAX = 5;
const CHAIN_SAFE = 4;
const CHAIN_RISK_STEP = 0.13;
const CHAIN_RISK_MAX = 0.6;
const CHAIN_MULT_STEP = 0.3;
const CHAIN_MULT_MAX = 2.8;
const MISFIRE_SHARE = 0.1;
const MISFIRE_CAP = 150;
const MISFIRE_CROWD = 5;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrowScreen = window.matchMedia('(max-width: 760px)').matches;

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

const audio = createAudio();

try {
  if (window.localStorage.getItem(MUTE_KEY) === '1') audio.setMuted(true);
} catch (error) {
  /* Storage can be blocked; sound just defaults to on. */
}

function refreshMuteButton() {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound effects' : 'Mute sound effects');
}

refreshMuteButton();

muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  refreshMuteButton();
  try {
    window.localStorage.setItem(MUTE_KEY, audio.isMuted() ? '1' : '0');
  } catch (error) {
    /* ignore */
  }
  if (!audio.isMuted()) audio.uiClick();
});

/* ------------------------------------------------------------------ *
 * Full screen
 * ------------------------------------------------------------------ */

const canFullscreen = Boolean(
  fullscreenButton && gameShell && document.fullscreenEnabled && gameShell.requestFullscreen
);

function refreshFullscreenButton() {
  if (!fullscreenButton) return;
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? '⤡' : '⛶';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
}

if (fullscreenButton) {
  if (!canFullscreen) {
    fullscreenButton.hidden = true;
  } else {
    refreshFullscreenButton();

    fullscreenButton.addEventListener('click', async () => {
      audio.unlock();
      audio.uiClick();
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await gameShell.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch (error) {
        /* Full screen can be refused (for example inside an embedded frame). */
      }
      refreshFullscreenButton();
    });

    document.addEventListener('fullscreenchange', () => {
      refreshFullscreenButton();
      window.requestAnimationFrame(sizeScene);
    });
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatMoney = (value) => `$${Math.round(value).toLocaleString('en-US')}`;
const formatClock = (seconds) => {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
};
const setText = (element, text) => {
  if (element && element.textContent !== text) element.textContent = text;
};

const crowdBonus = () => Math.min(CROWD_BONUS_MAX, 1 + state.crowd * CROWD_STEP);
const comboMultiplier = () =>
  Math.min(CHAIN_MULT_MAX, 1 + Math.max(0, state.combo - 1) * CHAIN_MULT_STEP);
const chainRisk = (combo) => Math.min(CHAIN_RISK_MAX, (combo - CHAIN_SAFE) * CHAIN_RISK_STEP);

function refreshComboBadge() {
  if (!comboBadge) return;

  if (state.combo <= 0) {
    comboBadge.classList.remove('show', 'risk');
    return;
  }

  const risky = state.combo > CHAIN_SAFE;
  comboBadge.classList.add('show');
  comboBadge.classList.toggle('risk', risky);
  setText(comboLabel, risky ? 'danger' : 'chain');
  setText(comboCount, `×${state.combo}`);
  comboBar.style.transform = `scaleX(${Math.max(0, state.comboTimer / CHAIN_WINDOW)})`;
}

function chainHit() {
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
  state.comboTimer = CHAIN_WINDOW;
  state.bestChain = Math.max(state.bestChain, state.combo);
  refreshComboBadge();
  if (state.combo >= 3) audio.chain(state.combo);
  return state.combo;
}

function updateCombo(dt) {
  if (state.combo <= 0) return;

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  comboBar.style.transform = `scaleX(${state.comboTimer / CHAIN_WINDOW})`;

  if (state.comboTimer <= 0) {
    state.combo = 0;
    comboBadge.classList.remove('show', 'risk');
  }
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  phase: 'intro',
  cash: START_CASH,
  score: 0,
  best: getBest(GAME_ID),
  crowd: 0,
  peakCrowd: 0,
  lit: 0,
  combo: 0,
  comboTimer: 0,
  bestChain: 0,
  mishaps: 0,
  damageTaken: 0,
  biggest: null,
  timeLeft: SHOW_SECONDS,
  sky: 'night',
  skyLight: 0,
  dayTimer: 0,
  selected: null,
  owned: {},
  finale: false,
  finaleTime: 0,
  finaleBonus: 0,
};

/* ------------------------------------------------------------------ *
 * Renderer and scene
 * ------------------------------------------------------------------ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060818);
scene.fog = new THREE.Fog(0x060818, 40, 100);

const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 150);
const CAMERA_BASE = new THREE.Vector3(0, 8, 14);
const CAMERA_TARGET = new THREE.Vector3(0, 5.2, -5);
camera.position.copy(CAMERA_BASE);
camera.lookAt(CAMERA_TARGET);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-hidden', 'true');
container.appendChild(renderer.domElement);

const clock = new THREE.Clock();
let elapsed = 0;
let brokeCheck = 0;
let shakeTime = 0;
let shakeDuration = 0;
let shakeStrength = 0;

function shakeCamera(strength, duration = 0.5) {
  shakeTime = duration;
  shakeDuration = duration;
  shakeStrength = strength;
}

function sizeScene() {
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = camera.aspect < 1 ? 68 : 56;
  camera.updateProjectionMatrix();
}

sizeScene();
new ResizeObserver(sizeScene).observe(container);
window.addEventListener('resize', sizeScene);

/* ------------------------------------------------------------------ *
 * Textures and tiny material / mesh helpers
 * ------------------------------------------------------------------ */

function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sparkTexture = makeCanvasTexture(64, 64, (ctx, width, height) => {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    width / 2
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
});

const grassTexture = makeCanvasTexture(256, 256, (ctx, size) => {
  ctx.fillStyle = '#2a4d34';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1100; i += 1) {
    const shade = 60 + Math.random() * 70;
    ctx.fillStyle = `rgba(${Math.round(shade * 0.5)}, ${shade}, ${Math.round(shade * 0.6)}, ${
      0.08 + Math.random() * 0.18
    })`;
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 2 + Math.random() * 5);
  }
});
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(10, 10);

const MATS = new Map();
function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATS.has(key)) {
    MATS.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.03, ...options })
    );
  }
  return MATS.get(key);
}

function box(parent, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ *
 * The yard
 * ------------------------------------------------------------------ */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* House ------------------------------------------------------------------ */
const house = new THREE.Group();
house.position.set(0, 0, -11.5);
scene.add(house);

const wallMat = mat(0x4c3c76, { roughness: 0.92 });
const houseBody = box(house, 17, 6, 6, wallMat, 0, 3, 0);
houseBody.castShadow = true;
houseBody.receiveShadow = true;

const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 3.6, 4), mat(0x322657, { roughness: 0.85 }));
roof.rotation.y = Math.PI / 4;
roof.scale.z = 0.62;
roof.position.set(0, 7.8, 0);
roof.castShadow = true;
house.add(roof);

box(house, 1.1, 2.4, 1.1, mat(0x2a2038), -5, 8.4, -1).castShadow = true;

const windowMat = mat(0xffd98a, {
  emissive: 0xffb347,
  emissiveIntensity: 1,
  roughness: 0.35,
});
for (const x of [-6.8, -4.3, 4.3, 6.8]) {
  box(house, 2, 2, 0.18, mat(0x1a1230), x, 4, 3.0);
  box(house, 1.6, 1.6, 0.08, windowMat, x, 4, 3.12);
}

box(house, 1.9, 2.7, 0.18, mat(0x241a3d), 0, 1.35, 3.02);
box(house, 1.4, 2.3, 0.08, mat(0x5b3a2a), 0, 1.25, 3.12);
box(
  house,
  0.28,
  0.34,
  0.2,
  mat(0xffd98a, { emissive: 0xffb347, emissiveIntensity: 1.8, roughness: 0.3 }),
  0,
  3.7,
  3.2
);
box(house, 3.2, 0.28, 1.2, mat(0x4b3a5c), 0, 0.14, 3.7);

const bushMat = mat(0x2f6445, { roughness: 0.95 });
for (const x of [-7.4, -3.4, 3.4, 7.4]) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 7, 5), bushMat);
  bush.position.set(x, 0.6, 3.9);
  bush.scale.set(1.4, 0.9, 0.9);
  house.add(bush);
}

/* Fence ------------------------------------------------------------------ */
const fenceMat = mat(0x7d5a40, { roughness: 0.9 });
const picketGeo = new THREE.BoxGeometry(0.16, 1.12, 0.07);
const picketCount = 74;
const pickets = new THREE.InstancedMesh(picketGeo, fenceMat, picketCount);
const dummy = new THREE.Object3D();
for (let i = 0; i < picketCount; i += 1) {
  const x = -12 + (i * 24) / (picketCount - 1);
  if (Math.abs(x) < 1.3) dummy.position.set(0, -12, 0);
  else dummy.position.set(x, 0.56, -6.2);
  dummy.updateMatrix();
  pickets.setMatrixAt(i, dummy.matrix);
}
pickets.castShadow = true;
pickets.receiveShadow = true;
scene.add(pickets);

box(scene, 24, 0.1, 0.08, fenceMat, 0, 0.34, -6.16);
box(scene, 24, 0.1, 0.08, fenceMat, 0, 0.84, -6.16);
for (let x = -12; x <= 12; x += 3) {
  box(scene, 0.22, 1.36, 0.22, fenceMat, x, 0.68, -6.16).castShadow = true;
}

/* String lights ---------------------------------------------------------- */
const bulbMat = mat(0xffd9a0, {
  emissive: 0xffb347,
  emissiveIntensity: 1.6,
  roughness: 0.4,
});
const bulbGeo = new THREE.SphereGeometry(0.075, 6, 5);
for (let i = -6; i <= 6; i += 1) {
  const x = i * 1.55;
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(x, 3.2 + 0.011 * x * x, -4.6);
  scene.add(bulb);
}
const wirePoints = [];
for (let i = -21; i <= 21; i += 1) {
  const x = i * 0.5;
  wirePoints.push(new THREE.Vector3(x, 3.2 + 0.011 * x * x, -4.6));
}
scene.add(
  new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(wirePoints),
    new THREE.LineBasicMaterial({ color: 0x161020 })
  )
);
for (const x of [-10.5, 10.5]) {
  box(scene, 0.16, 4.4, 0.16, fenceMat, x, 2.2, -4.6).castShadow = true;
  box(scene, 0.3, 0.12, 0.3, mat(0x2a2038), x, 4.42, -4.6);
}

/* Trees ------------------------------------------------------------------ */
function makeTree(x, z, scale) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 3.4, 7), mat(0x4a3527));
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  tree.add(trunk);

  const foliageMat = mat(0x2a6e4a, { roughness: 0.95 });
  [
    [0, 3.6, 1.7],
    [-0.9, 3.2, 1.25],
    [0.9, 3.3, 1.2],
    [0, 4.6, 1.15],
  ].forEach(([fx, fy, radius]) => {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), foliageMat);
    blob.position.set(fx, fy, 0);
    blob.castShadow = true;
    tree.add(blob);
  });

  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  scene.add(tree);
}

makeTree(-10.8, -8.2, 1.15);
makeTree(11, -8.0, 1.0);

/* Firework stand prop ---------------------------------------------------- */
const stand = new THREE.Group();
stand.position.set(7.6, 0, -1.8);
stand.rotation.y = -0.15;
scene.add(stand);

const standWood = mat(0x8a5a33, { roughness: 0.85 });
box(stand, 3.2, 0.16, 1.5, standWood, 0, 1.05, 0);
[
  [-1.35, -0.55],
  [1.35, -0.55],
  [-1.35, 0.55],
  [1.35, 0.55],
].forEach(([x, z]) => box(stand, 0.14, 1.05, 0.14, mat(0x5a3520), x, 0.52, z));

const crateMat = mat(0x9a6a3a, { roughness: 0.9 });
for (let i = -1; i <= 1; i += 1) {
  box(stand, 0.8, 0.5, 0.6, crateMat, i * 0.95, 1.38, 0);
  for (let j = 0; j < 3; j += 1) {
    const palette = FIREWORKS[(i + 1) * 2 + j].palette;
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6),
      mat(palette[0], { emissive: palette[0], emissiveIntensity: 0.25, roughness: 0.6 })
    );
    tube.position.set(i * 0.95 - 0.2 + j * 0.2, 1.62, 0);
    stand.add(tube);
  }
}

const signTexture = makeCanvasTexture(512, 160, (ctx, width, height) => {
  ctx.fillStyle = '#1a0f2e';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#ffd93d';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = '#ffd93d';
  ctx.font = 'bold 62px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FIREWORKS', width / 2, height / 2 - 6);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillText('OPEN TILL CURFEW', width / 2, height / 2 + 48);
});
const sign = new THREE.Mesh(
  new THREE.PlaneGeometry(2.8, 0.88),
  new THREE.MeshBasicMaterial({ map: signTexture })
);
sign.position.set(0, 2.3, -0.1);
stand.add(sign);

/* Sky -------------------------------------------------------------------- */
const starPositions = [];
for (let i = 0; i < 320; i += 1) {
  starPositions.push(
    (Math.random() - 0.5) * 130,
    8 + Math.random() * 44,
    -25 - Math.random() * 60
  );
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    map: sparkTexture,
    color: 0xffffff,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(stars);

const moonGroup = new THREE.Group();
moonGroup.position.set(-16, 24, -46);
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(2.4, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xf4f0d8, transparent: true, fog: false })
);
moonGroup.add(moon);
const moonGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xbfd4ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  })
);
moonGlow.scale.set(16, 16, 1);
moonGroup.add(moonGlow);
scene.add(moonGroup);

const sunGroup = new THREE.Group();
sunGroup.position.set(16, 26, -48);
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(3, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, fog: false })
);
sunGroup.add(sun);
const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xffd15c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  })
);
sunGlow.scale.set(22, 22, 1);
sunGroup.add(sunGlow);
scene.add(sunGroup);

/* Lights ----------------------------------------------------------------- */
const hemi = new THREE.HemisphereLight(0x4a5bb5, 0x0a0a12, 0.55);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0x9fb4ff, 0.3);
keyLight.position.set(12, 22, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -22;
keyLight.shadow.camera.right = 22;
keyLight.shadow.camera.top = 22;
keyLight.shadow.camera.bottom = -18;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 70;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const porchLight = new THREE.PointLight(0xffb066, 12, 18, 2);
porchLight.position.set(0, 4.3, -8.0);
scene.add(porchLight);

const stringLight = new THREE.PointLight(0xffb066, 9, 20, 2);
stringLight.position.set(0, 3.6, -4.4);
scene.add(stringLight);

const yardLight = new THREE.PointLight(0x9db4ff, 32, 36, 2);
yardLight.position.set(0, 7.5, -1.5);
scene.add(yardLight);

/* Crowd ------------------------------------------------------------------ */
const crowd = createCrowd(scene, { max: CROWD_MAX });

/* ------------------------------------------------------------------ *
 * Sky
 * ------------------------------------------------------------------ */

const SKY_NIGHT = new THREE.Color(0x0a1028);
const SKY_DAY = new THREE.Color(0x5fb8ff);
const SKY_WARM = new THREE.Color(0xff8a5a);
const LIGHT_NIGHT = new THREE.Color(0x9fb4ff);
const LIGHT_DAY = new THREE.Color(0xfff3d6);
const HEMI_NIGHT = new THREE.Color(0x5d70c9);
const HEMI_DAY = new THREE.Color(0xbfe6ff);
const skyColor = new THREE.Color();

function updateSky(dt) {
  if (state.sky === 'day') {
    state.dayTimer = Math.max(0, state.dayTimer - dt);
    state.skyLight += (1 - state.skyLight) * Math.min(1, dt * 2.6);

    if (state.dayTimer <= 0) {
      state.sky = 'sunset';
      audio.nightfall();
      showBanner('The sun is going down. Big shells are back soon.');
      updateStand();
    }
  } else if (state.sky === 'sunset') {
    state.skyLight += (0 - state.skyLight) * Math.min(1, dt * 1.7);

    if (state.skyLight < 0.16) {
      state.sky = 'night';
      state.skyLight = 0;
      audio.setDaylight(false);
      showBanner('Night again. Light the big ones!');
      updateStand();
    }
  } else {
    state.skyLight += (0 - state.skyLight) * Math.min(1, dt * 2);
  }
}

function paintSky() {
  const light = state.skyLight;
  const warm = Math.sin(light * Math.PI) * 0.6;

  skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, light).lerp(SKY_WARM, warm);
  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);

  hemi.intensity = 1.0 + light * 1.1;
  hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, light);

  keyLight.intensity = 0.75 + light * 1.5;
  keyLight.color.copy(LIGHT_NIGHT).lerp(LIGHT_DAY, light);

  stars.material.opacity = Math.max(0, 1 - light * 1.15);
  moon.material.opacity = Math.max(0, 1 - light * 1.4);
  moonGlow.material.opacity = Math.max(0, 0.5 * (1 - light * 1.4));
  sun.material.opacity = light;
  sunGlow.material.opacity = light * 0.55;

  porchLight.intensity = 26 * (1 - light * 0.7);
  stringLight.intensity = 18 * (1 - light * 0.7);
  yardLight.intensity = 32 * (1 - light) * (1 - light);
}

/* ------------------------------------------------------------------ *
 * Firework effects
 * ------------------------------------------------------------------ */

const bursts = [];
const pendingBursts = [];
const shots = [];
const placed = [];
const placedHits = [];
const flashes = [];
const glows = [];
const obliterated = [];

for (let i = 0; i < 3; i += 1) {
  const light = new THREE.PointLight(0xffffff, 0, 26, 2);
  light.visible = false;
  scene.add(light);
  flashes.push({ light, life: 0, maxLife: 0.55, base: 0 });
}

function spawnBurst(definition, position, palette, kind) {
  const count = Math.max(12, Math.round(definition.count * (reducedMotion ? 0.6 : 1)));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = position.x + (Math.random() - 0.5) * 0.12;
    positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.12;
    positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.12;

    const theta = Math.random() * Math.PI * 2;
    const cosPhi = Math.random() * 2 - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const speed = definition.speed * (0.45 + Math.random() * 0.55);

    velocities[i * 3] = Math.cos(theta) * sinPhi * speed;
    velocities[i * 3 + 1] =
      cosPhi * speed + (definition.yBias || 0) * (0.6 + Math.random() * 0.6);
    velocities[i * 3 + 2] = Math.sin(theta) * sinPhi * speed * 0.75;

    color.set(palette[i % palette.length]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: sparkTexture,
    size: definition.size,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: kind === 'day' ? THREE.NormalBlending : THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  bursts.push({
    points,
    velocities,
    count,
    age: 0,
    life: definition.life,
    gravity: definition.gravity,
    drag: definition.drag,
  });

  if (bursts.length > 28) {
    const oldest = bursts.shift();
    scene.remove(oldest.points);
    oldest.points.geometry.dispose();
    oldest.points.material.dispose();
  }
}

function spawnGlow(position, color, size, kind, life = 0.6) {
  const material = new THREE.SpriteMaterial({
    map: sparkTexture,
    color,
    transparent: true,
    opacity: kind === 'day' ? 0.45 : 0.85,
    depthWrite: false,
    blending: kind === 'day' ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.setScalar(size);
  scene.add(sprite);
  glows.push({ sprite, age: 0, life, base: size, peak: material.opacity });
}

function flash(position, color, strength) {
  const entry = flashes.reduce((oldest, item) => (item.life < oldest.life ? item : oldest), flashes[0]);
  entry.light.position.copy(position);
  entry.light.color.setHex(color);
  entry.base = 60 * strength;
  entry.light.intensity = entry.base;
  entry.light.visible = true;
  entry.maxLife = 0.55;
  entry.life = 0.55;
}

function obliterateWorld() {
  const keep = new Set();
  bursts.forEach((burst) => keep.add(burst.points));
  shots.forEach((shot) => keep.add(shot.group));
  glows.forEach((glow) => keep.add(glow.sprite));
  flashes.forEach((entry) => keep.add(entry.light));

  scene.children.forEach((child) => {
    if (keep.has(child)) return;
    obliterated.push({ child, visible: child.visible });
    child.visible = false;
  });
}

function explode(firework, position, fromShot = false) {
  const burstPosition = position.clone();
  if (!fromShot) burstPosition.y = firework.height;
  const isFinale = Boolean(firework.finale);

  const combo = isFinale ? 0 : chainHit();

  spawnBurst(firework.particles, burstPosition, firework.palette, firework.kind);
  spawnGlow(
    burstPosition,
    isFinale ? 0xffffff : firework.palette[0],
    isFinale ? 14 : firework.kind === 'night' ? 3 + Math.min(6, firework.price / 140) : 2.3,
    firework.kind,
    isFinale ? 1.8 : firework.kind === 'night' ? 0.8 : 0.6
  );

  if (isFinale) {
    spawnGlow(burstPosition, 0xffffff, 24, 'night', 2.1);
  }

  if (firework.ring) {
    const ring = firework.ring;
    pendingBursts.push({
      time: ring.delay,
      run: () => {
        spawnBurst(
          {
            count: ring.count,
            speed: ring.speed,
            life: firework.particles.life * 0.9,
            gravity: firework.particles.gravity,
            size: ring.size,
            drag: firework.particles.drag,
            yBias: 0,
          },
          burstPosition,
          ring.palette,
          firework.kind
        );
      },
    });
  }

  flash(
    burstPosition,
    isFinale ? 0xffffff : firework.palette[0],
    isFinale ? 3.4 : firework.kind === 'night' ? 0.9 + Math.min(1.1, firework.price / 800) : 0.5
  );
  shakeCamera(isFinale ? 1.05 : Math.min(0.34, firework.price / 1600), isFinale ? 1.5 : 0.45);
  audio.burst(0.7 + Math.min(2.3, firework.price / 340));

  if (isFinale) {
    audio.doomsday();
    state.lit += 1;
    state.biggest = firework;
    updateHud();
    updateStand();
    statusEl.textContent = 'Big Bertha is up. The yard is about to disappear.';
    pendingBursts.push({ time: 0.55, run: obliterateWorld });
    pendingBursts.push({ time: 1.05, run: () => whiteout.classList.add('on') });
    pendingBursts.push({ time: 3.0, run: () => endShow('bertha') });
    return;
  }

  if (isFinale || state.phase !== 'play') return;

  award(firework, burstPosition);
  if (combo >= 3) spawnEcho(firework, burstPosition, combo);
  if (combo > CHAIN_SAFE && Math.random() < chainRisk(combo)) {
    triggerMisfire(burstPosition);
  }
}

function spawnEcho(firework, position, combo) {
  const echoes = combo >= 6 ? 2 : 1;

  for (let i = 0; i < echoes; i += 1) {
    const echoPosition = position.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 5.4,
        (Math.random() - 0.5) * 2.4,
        (Math.random() - 0.5) * 2
      )
    );
    const scale = 0.34 + Math.min(0.3, combo * 0.03);

    spawnBurst(
      {
        count: Math.round(firework.particles.count * scale),
        speed: firework.particles.speed * 0.62,
        life: firework.particles.life * 0.72,
        gravity: firework.particles.gravity,
        size: firework.particles.size * 0.8,
        drag: firework.particles.drag,
        yBias: firework.particles.yBias || 0,
      },
      echoPosition,
      firework.palette,
      firework.kind
    );
    spawnGlow(
      echoPosition,
      firework.palette[i % firework.palette.length],
      2.4,
      firework.kind,
      0.5
    );
  }

  audio.sparkle(0.7 + combo * 0.12);
}

function triggerMisfire(position) {
  const penalty = Math.min(MISFIRE_CAP, Math.max(8, Math.round(state.cash * MISFIRE_SHARE)));
  state.cash = Math.max(0, state.cash - penalty);
  state.crowd = crowd.remove(MISFIRE_CROWD);
  state.mishaps += 1;
  state.damageTaken += penalty;
  state.combo = 0;
  state.comboTimer = 0;
  refreshComboBadge();

  const low = position.clone();
  low.y = Math.max(1.4, position.y - 2.4);
  spawnBurst(
    { count: 90, speed: 5.5, life: 1.4, gravity: 6, size: 0.5, drag: 0.88, yBias: 0.4 },
    low,
    [0xff5a3c, 0x3a2a2a, 0xffb347],
    'night'
  );
  spawnGlow(low, 0xff3b30, 4.5, 'night', 0.8);
  flash(low, 0xff5a3c, 1.2);
  shakeCamera(0.78, 0.7);
  audio.damage();

  if (damageFlash) {
    damageFlash.classList.remove('on');
    void damageFlash.offsetWidth;
    damageFlash.classList.add('on');
  }

  showBanner(`MISFIRE! −${formatMoney(penalty)} damage.`, 2600);
  addFloater(`−${formatMoney(penalty)} DAMAGE`, position, 'damage');
  statusEl.textContent = `Too many at once — the rack tipped. Damage ${formatMoney(
    penalty
  )}, crowd ${state.crowd}.`;
  updateHud();
  updateStand();
}

function launchShot(firework, position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(firework.finale ? 0.3 : 0.15, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8 })
  );
  group.add(head);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sparkTexture,
      color: firework.palette[0],
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const haloSize = firework.finale ? 4.6 : 2.2;
  halo.scale.set(haloSize, haloSize, 1);
  group.add(halo);

  const trailCount = firework.finale ? 56 : 22;
  const trailPositions = new Float32Array(trailCount * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trail = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      map: sparkTexture,
      color: 0xffd93d,
      size: firework.finale ? 0.3 : 0.16,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  group.add(trail);

  scene.add(group);
  shots.push({
    group,
    trail,
    trailPositions,
    trailCount,
    firework,
    speed: Math.max(4, firework.height / (firework.flightSeconds || 0.8)),
    targetY: firework.height,
  });

  audio.launch();
  showBanner(firework.finale ? 'Big Bertha is away. Look up.' : 'Away it goes!');
}

/* ------------------------------------------------------------------ *
 * Placed fireworks
 * ------------------------------------------------------------------ */

function buildPlacedFirework(firework) {
  const group = new THREE.Group();
  const tubeHeight = firework.kind === 'night' ? 0.8 : 0.45;

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, tubeHeight, 8),
    mat(0xe8e2d2, { roughness: 0.7 })
  );
  tube.position.y = tubeHeight / 2;
  tube.castShadow = true;
  group.add(tube);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.12, 8),
    mat(firework.palette[0], {
      emissive: firework.palette[0],
      emissiveIntensity: 0.45,
      roughness: 0.6,
    })
  );
  band.position.y = tubeHeight - 0.08;
  group.add(band);

  if (firework.kind === 'night') {
    const stick = box(
      group,
      0.04,
      1,
      0.04,
      mat(0x8a6a45, { roughness: 0.9 }),
      0.16,
      0.5,
      0
    );
    stick.castShadow = true;
  }

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.44, 24), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 1 })
  );
  spark.position.y = tubeHeight + 0.08;
  spark.visible = false;
  group.add(spark);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.y = 0.45;
  hit.userData.placedRef = group;
  group.add(hit);

  group.userData = {
    firework,
    state: 'ready',
    fuse: 0,
    age: 0,
    ring,
    spark,
    hit,
  };

  placedHits.push(hit);
  return group;
}

function placeFirework(fireworkId, x, z) {
  const firework = FIREWORK_BY_ID[fireworkId];
  if (!firework) return;

  const owned = state.owned[fireworkId] || 0;
  if (owned < 1) return;

  state.owned[fireworkId] = owned - 1;
  if (state.owned[fireworkId] <= 0) delete state.owned[fireworkId];

  const item = buildPlacedFirework(firework);
  item.position.set(clamp(x, PLACE.minX, PLACE.maxX), 0, clamp(z, PLACE.minZ, PLACE.maxZ));
  scene.add(item);
  placed.push(item);

  state.selected = null;
  cancelPlacement();
  updateStand();
  audio.uiClick();
  showBanner('Tap the firework to light it.');
  statusEl.textContent = `${firework.name} placed. Tap it to light the fuse.`;
}

function chainLinks(source) {
  return placed
    .filter(
      (other) =>
        other !== source &&
        other.userData.state === 'ready' &&
        !other.userData.firework.finale
    )
    .map((other) => ({ other, distance: other.position.distanceTo(source.position) }))
    .filter((entry) => entry.distance <= CHAIN_RADIUS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, CHAIN_LINKS_MAX)
    .map((entry) => entry.other);
}

function lightPlaced(item, chained = false) {
  if (!item || !placed.includes(item) || state.finale) return;
  if (item.userData.state !== 'ready' && item.userData.state !== 'queued') return;

  const firework = item.userData.firework;
  item.userData.state = 'fuse';
  item.userData.fuse = FUSE_SECONDS;
  item.userData.ring.material.color.setHex(0xff7b3d);
  audio.fuse();

  if (firework.finale) {
    state.finale = true;
    state.finaleTime = state.timeLeft;
    state.finaleBonus = Math.ceil(state.finaleTime) * TIME_BONUS_PER_SECOND;
    cancelPlacement();
    updateStand();
    showBanner(`BIG BERTHA! Time bonus +${formatMoney(state.finaleBonus)}.`, 4400);
    statusEl.textContent = `Big Bertha is lit. Time bonus ${formatMoney(state.finaleBonus)}.`;
    audio.finaleWarning();
    return;
  }

  if (chained) {
    statusEl.textContent = 'Chain fuse caught!';
    return;
  }

  const links = chainLinks(item);
  if (!links.length) {
    showBanner('Fuse lit!');
    statusEl.textContent = 'Fuse lit.';
    return;
  }

  links.forEach((link, index) => {
    link.userData.state = 'queued';
    link.userData.ring.material.color.setHex(0xffa23c);
    pendingBursts.push({
      time: 0.34 + index * CHAIN_STAGGER,
      run: () => lightPlaced(link, true),
    });
  });

  audio.chain(links.length + 1);
  showBanner(`CHAIN! ${links.length + 1} fuses lit.`, 1800);
  statusEl.textContent = `Chain fuse! ${links.length + 1} fireworks going up.`;
}

function removePlaced(index) {
  const item = placed[index];
  if (!item) return;

  placed.splice(index, 1);
  const hitIndex = placedHits.indexOf(item.userData.hit);
  if (hitIndex >= 0) placedHits.splice(hitIndex, 1);

  scene.remove(item);
  item.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
  });
}

function clearPlaced() {
  for (let i = placed.length - 1; i >= 0; i -= 1) removePlaced(i);
}

/* ------------------------------------------------------------------ *
 * Effects updates
 * ------------------------------------------------------------------ */

function updatePlaced(dt) {
  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const item = placed[i];
    const data = item.userData;
    data.age += dt;

    data.ring.material.opacity = 0.28 + (Math.sin(data.age * 5) + 1) * 0.16;
    data.ring.scale.setScalar(1 + Math.sin(data.age * 3.2) * 0.07);

    if (data.state === 'queued') {
      data.spark.visible = true;
      data.spark.scale.setScalar(0.6 + Math.random() * 0.5);
      data.spark.material.opacity = 0.4 + Math.random() * 0.4;
      continue;
    }

    if (data.state !== 'fuse') continue;

    data.fuse -= dt;
    data.spark.visible = true;
    data.spark.scale.setScalar(0.7 + Math.random() * 0.7);
    data.spark.material.opacity = 0.55 + Math.random() * 0.45;

    if (data.fuse > 0) continue;

    const firework = data.firework;
    const position = item.position.clone();
    removePlaced(i);

    if (firework.kind === 'night') {
      launchShot(firework, position);
    } else {
      pendingBursts.push({ time: 0.2, run: () => explode(firework, position) });
      audio.sparkle(0.6);
    }
  }
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i];
    shot.group.position.y += shot.speed * dt;

    const positions = shot.trailPositions;
    for (let j = 0; j < shot.trailCount; j += 1) {
      positions[j * 3] = (Math.random() - 0.5) * 0.12;
      positions[j * 3 + 1] = -0.1 - j * 0.09 - Math.random() * 0.05;
      positions[j * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    shot.trail.geometry.attributes.position.needsUpdate = true;

    if (shot.group.position.y >= shot.targetY) {
      const position = shot.group.position.clone();
      scene.remove(shot.group);
      shot.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
      });
      shots.splice(i, 1);
      explode(shot.firework, position, true);
    }
  }
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const burst = bursts[i];
    burst.age += dt;
    const progress = burst.age / burst.life;

    if (progress >= 1) {
      scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      bursts.splice(i, 1);
      continue;
    }

    const positions = burst.points.geometry.attributes.position.array;
    const drag = Math.pow(burst.drag, dt * 60);

    for (let j = 0; j < burst.count; j += 1) {
      const index = j * 3;
      positions[index] += burst.velocities[index] * dt;
      positions[index + 1] += burst.velocities[index + 1] * dt;
      positions[index + 2] += burst.velocities[index + 2] * dt;

      burst.velocities[index] *= drag;
      burst.velocities[index + 1] = burst.velocities[index + 1] * drag - burst.gravity * dt;
      burst.velocities[index + 2] *= drag;
    }

    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.material.opacity = Math.pow(1 - progress, 1.3);
  }
}

function updatePending(dt) {
  for (let i = pendingBursts.length - 1; i >= 0; i -= 1) {
    const entry = pendingBursts[i];
    entry.time -= dt;
    if (entry.time <= 0) {
      pendingBursts.splice(i, 1);
      entry.run();
    }
  }
}

function updateGlows(dt) {
  for (let i = glows.length - 1; i >= 0; i -= 1) {
    const glow = glows[i];
    glow.age += dt;
    const progress = glow.age / glow.life;

    if (progress >= 1) {
      scene.remove(glow.sprite);
      glow.sprite.material.dispose();
      glows.splice(i, 1);
      continue;
    }

    glow.sprite.scale.setScalar(glow.base * (1 + progress * 2.2));
    glow.sprite.material.opacity = glow.peak * Math.pow(1 - progress, 2);
  }
}

function updateFlashes(dt) {
  for (const entry of flashes) {
    if (entry.life <= 0) continue;
    entry.life = Math.max(0, entry.life - dt);
    const ratio = entry.life / entry.maxLife;
    entry.light.intensity = entry.base * ratio * ratio;
    if (entry.life <= 0) {
      entry.light.visible = false;
      entry.light.intensity = 0;
    }
  }
}

function clearEffects() {
  clearPlaced();

  shots.splice(0).forEach((shot) => {
    scene.remove(shot.group);
    shot.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
  });

  bursts.splice(0).forEach((burst) => {
    scene.remove(burst.points);
    burst.points.geometry.dispose();
    burst.points.material.dispose();
  });

  pendingBursts.length = 0;

  glows.splice(0).forEach((glow) => {
    scene.remove(glow.sprite);
    glow.sprite.material.dispose();
  });

  flashes.forEach((entry) => {
    entry.life = 0;
    entry.light.visible = false;
    entry.light.intensity = 0;
  });

  floatersEl.replaceChildren();

  state.combo = 0;
  state.comboTimer = 0;
  refreshComboBadge();
}

/* ------------------------------------------------------------------ *
 * Payouts and the show
 * ------------------------------------------------------------------ */

function startDay() {
  if (state.sky === 'day') return;

  state.sky = 'day';
  state.dayTimer = DAY_SECONDS;
  audio.daybreak();
  audio.setDaylight(true);
  crowd.cheer(0.6);
  showBanner('DAYLIGHT! The little ones brought the sun up.');
  statusEl.textContent = 'Daylight. Big fireworks wait for night.';

  if (state.selected && FIREWORK_BY_ID[state.selected].kind === 'night') cancelPlacement();
  updateStand();
}

function award(firework, position) {
  const bonus = crowdBonus();
  const chain = state.combo;
  const chainBonus = comboMultiplier();
  const payout = Math.round(firework.payout * bonus * chainBonus);

  state.cash += payout;
  state.score += payout;
  state.lit += 1;

  if (!state.biggest || firework.price > state.biggest.price) state.biggest = firework;

  state.crowd = crowd.add(firework.crowd + Math.min(2, chain - 1));
  state.peakCrowd = Math.max(state.peakCrowd, state.crowd);

  crowd.cheer(firework.kind === 'day' ? 0.7 : 1.2 + Math.min(1.4, chain * 0.25));
  audio.cash();
  audio.cheer(firework.kind === 'day' ? 0.4 : 1);

  addFloater(`+${formatMoney(payout)}`, position, firework.kind);
  if (chain >= 2) addFloater(`chain ×${chain}`, position, 'chain');

  if (firework.kind === 'day') startDay();

  updateHud();
  updateStand();
  statusEl.textContent =
    chain >= 2
      ? `Chain ×${chain}! ${firework.name} paid ${formatMoney(payout)}. Crowd ${state.crowd}.`
      : `${firework.name} paid ${formatMoney(payout)}. Crowd ${state.crowd}.`;
}

function addFloater(text, position, kind) {
  const el = document.createElement('span');
  el.className = `floater ${kind}`;
  el.textContent = text;

  const projected = position.clone().project(camera);
  el.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
  el.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;

  floatersEl.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  window.setTimeout(() => el.remove(), 2400);
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

function startShow() {
  if (state.phase === 'play') return;

  state.phase = 'play';
  state.cash = START_CASH;
  state.score = 0;
  state.crowd = 0;
  state.peakCrowd = 0;
  state.lit = 0;
  state.biggest = null;
  state.timeLeft = SHOW_SECONDS;
  state.sky = 'night';
  state.skyLight = 0;
  state.dayTimer = 0;
  state.owned = {};
  state.selected = null;
  state.finale = false;
  state.finaleTime = 0;
  state.finaleBonus = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.bestChain = 0;
  state.mishaps = 0;
  state.damageTaken = 0;

  clearEffects();
  obliterated.splice(0).forEach(({ child, visible }) => {
    child.visible = visible;
  });
  whiteout.classList.remove('on');
  shakeTime = 0;
  crowd.reset();
  audio.setDaylight(false);
  cancelPlacement();

  overlay.classList.add('hidden');
  overlay.classList.remove('intro');
  overlay.classList.remove('endgame');
  overlay.setAttribute('aria-hidden', 'true');
  overlayStats.classList.remove('show');

  updateHud();
  updateStand();
  updateHudClock();

  audio.unlock();
  audio.startAmbience();
  startButton.blur();
  clock.getDelta();

  statusEl.textContent = `Show started. You have ${formatMoney(START_CASH)} and ${Math.round(
    SHOW_SECONDS / 60
  )} minutes to work up to Big Bertha.`;
}

function endShow(reason) {
  if (state.phase !== 'play') return;
  state.phase = 'over';

  clearPlaced();
  cancelPlacement();

  const isFinale = reason === 'bertha';
  const earned = state.score;
  const timeBonus = isFinale ? Math.max(0, Math.ceil(state.finaleTime) * TIME_BONUS_PER_SECOND) : 0;
  const finalScore = earned + timeBonus;
  const result = submitScore(GAME_ID, finalScore);
  state.best = result.best;
  if (isFinale) state.score = finalScore;

  overlayKicker.textContent = result.isBest
    ? 'A new personal best'
    : isFinale
      ? 'No street left to complain'
      : 'The street goes quiet';
  overlayTitle.textContent = isFinale ? 'BIG BERTHA!' : reason === 'curfew' ? 'CURFEW!' : 'ALL OUT!';
  overlaySub.textContent = isFinale
    ? 'There goes the neighbourhood.'
    : reason === 'curfew'
      ? 'The neighbours are pretending to be asleep.'
      : 'The crate is empty and the stand is closed.';
  overlayText.textContent = isFinale
    ? 'The sky turns white. The house, the fence, the trees and the crowd are gone. All that is left is a crater, a ringing in your ears, and your time bonus.'
    : reason === 'curfew'
      ? 'The porch lights are off, the last shell has fallen, and somebody is definitely peeking through the blinds. Same time next week?'
      : 'You spent the last of the fireworks money. The yard is quiet, the grass is covered in paper, and the crowd wants an encore you cannot afford.';

  overlay.classList.remove('intro');
  overlay.classList.toggle('endgame', isFinale);
  if (isFinale) whiteout.classList.add('on');
  overlayRules.hidden = true;
  overlayControls.hidden = true;
  overlayStats.replaceChildren();

  if (isFinale) {
    addStatCell('Earned', formatMoney(earned));
    addStatCell('Time bonus', `+${formatMoney(timeBonus)}`);
    addStatCell('Final score', formatMoney(finalScore));
    addStatCell('Fireworks lit', String(state.lit));
    addStatCell('Best chain', state.bestChain > 1 ? `×${state.bestChain}` : '—');
    addStatCell('Mishaps', state.mishaps > 0 ? `−${formatMoney(state.damageTaken)}` : '—');
    addStatCell('Peak crowd', String(state.peakCrowd));
    addStatCell('Best show', formatMoney(state.best));
  } else {
    addStatCell('Earned', formatMoney(earned));
    addStatCell('Fireworks lit', String(state.lit));
    addStatCell('Biggest firework', state.biggest ? state.biggest.name : '—');
    addStatCell('Best chain', state.bestChain > 1 ? `×${state.bestChain}` : '—');
    addStatCell('Mishaps', state.mishaps > 0 ? `−${formatMoney(state.damageTaken)}` : '—');
    addStatCell('Peak crowd', String(state.peakCrowd));
    addStatCell('Best show', formatMoney(state.best));
    addStatCell('Cash left', formatMoney(state.cash));
  }

  overlayStats.classList.add('show');

  startButton.textContent = 'One more show';
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.scrollTop = 0;

  audio.stopAmbience();
  if (!isFinale) audio.curfew();

  updateHud();
  updateHudClock();
  updateStand();

  statusEl.textContent = isFinale
    ? `Big Bertha! Earned ${formatMoney(earned)}, time bonus ${formatMoney(
        timeBonus
      )}, final score ${formatMoney(finalScore)}, best ${formatMoney(state.best)}.`
    : `Show over. You earned ${formatMoney(earned)}. Best ${formatMoney(state.best)}.`;

  window.setTimeout(() => startButton.focus({ preventScroll: true }), 80);
}

function checkBroke(dt) {
  brokeCheck -= dt;
  if (brokeCheck > 0) return;
  brokeCheck = 0.6;

  const stock = Object.values(state.owned).reduce((sum, count) => sum + count, 0);
  if (stock > 0) return;
  if (state.cash >= CHEAPEST_PRICE) return;
  if (placed.length > 0 || shots.length > 0 || pendingBursts.length > 0) return;

  endShow('empty');
}

/* ------------------------------------------------------------------ *
 * Shop and placement
 * ------------------------------------------------------------------ */

const standRefs = new Map();

function buildStand() {
  const cards = FIREWORKS.map((firework) => {
    const card = document.createElement('article');
    card.className = 'stand-card';
    card.dataset.kind = firework.kind;
    card.dataset.firework = firework.id;

    const top = document.createElement('div');
    top.className = 'stand-top';

    const icon = document.createElement('span');
    icon.className = 'stand-icon';
    icon.textContent = firework.icon;
    icon.setAttribute('aria-hidden', 'true');

    const nameWrap = document.createElement('div');
    nameWrap.className = 'stand-name-wrap';
    const name = document.createElement('span');
    name.className = 'stand-name';
    name.textContent = firework.name;
    const tag = document.createElement('span');
    tag.className = firework.finale ? 'stand-tag finale' : `stand-tag ${firework.kind}`;
    tag.textContent = firework.finale ? 'Finale' : firework.kind === 'day' ? 'Day' : 'Night';
    nameWrap.append(name, tag);

    if (firework.finale) card.classList.add('is-finale');

    const owned = document.createElement('span');
    owned.className = 'stand-owned';
    owned.hidden = true;

    top.append(icon, nameWrap, owned);

    const blurb = document.createElement('p');
    blurb.className = 'stand-blurb';
    blurb.textContent = firework.blurb;

    const figures = document.createElement('div');
    figures.className = 'stand-figures';
    const payout = document.createElement('span');
    payout.textContent = firework.finale ? 'Ends the show' : `Pays ${formatMoney(firework.payout)}`;
    const crowdGain = document.createElement('span');
    crowdGain.textContent = firework.finale
      ? `Bonus ${formatMoney(TIME_BONUS_PER_SECOND)}/sec`
      : `Crowd +${firework.crowd}`;
    const gate = document.createElement('span');
    gate.className = 'stand-gate';
    gate.hidden = !firework.finale;
    if (firework.finale) gate.textContent = `Street ${state.crowd}/${FINALE_CROWD}`;
    figures.append(payout, crowdGain, gate);

    const actions = document.createElement('div');
    actions.className = 'stand-actions';

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'buy-button';
    buy.dataset.action = 'buy';
    buy.dataset.firework = firework.id;
    buy.textContent = `Buy ${formatMoney(firework.price)}`;
    buy.addEventListener('click', () => buyFirework(firework));

    const light = document.createElement('button');
    light.type = 'button';
    light.className = 'light-button';
    light.dataset.action = 'light';
    light.dataset.firework = firework.id;
    light.textContent = 'Light';
    light.addEventListener('click', () => chooseFirework(firework));

    actions.append(buy, light);
    card.append(top, blurb, figures, actions);

    standRefs.set(firework.id, { card, buy, light, owned, gate });
    return card;
  });

  standList.replaceChildren(...cards);
}

function updateStandHint() {
  let text = 'Buy fireworks, then hit Light and tap the yard.';

  if (state.phase === 'intro') text = 'Start the show to open the stand.';
  else if (state.phase === 'over') text = 'The stand is closed until the next show.';
  else if (state.finale) text = 'Big Bertha is up. This is the last firework.';
  else if (state.sky !== 'night') text = 'Daytime: little ones only. Big fireworks wait for night.';
  else if (state.selected) text = 'Tap the yard to set it down, then tap it to light it.';
  else if (state.crowd < FINALE_CROWD)
    text = `Chain them up to pack the street (${state.crowd}/${FINALE_CROWD}). Big Bertha needs the whole street out.`;
  else text = 'Street packed! Big Bertha is ready when you are.';

  setText(standHint, text);
}

function updateStand() {
  updateStandHint();

  for (const firework of FIREWORKS) {
    const ref = standRefs.get(firework.id);
    if (!ref) continue;

    const owned = state.owned[firework.id] || 0;
    const streetLocked = Boolean(firework.finale) && state.crowd < FINALE_CROWD;
    const canBuy =
      state.phase === 'play' && !state.finale && state.cash >= firework.price && !streetLocked;
    const nightLocked = firework.kind === 'night' && state.sky !== 'night';
    const selected = state.selected === firework.id;

    ref.buy.disabled = !canBuy;
    ref.buy.textContent = streetLocked
      ? `Street ${state.crowd}/${FINALE_CROWD}`
      : state.cash >= firework.price
        ? `Buy ${formatMoney(firework.price)}`
        : `Need ${formatMoney(firework.price)}`;

    ref.light.disabled = state.phase !== 'play' || state.finale || owned < 1 || nightLocked;
    ref.light.textContent = state.finale
      ? 'Finale'
      : owned < 1
        ? 'Light'
        : nightLocked
          ? 'Night only'
          : selected
            ? 'Placing…'
            : `Light ×${owned}`;

    ref.card.classList.toggle('is-selected', selected);
    ref.card.classList.toggle('is-locked', nightLocked || streetLocked);
    ref.owned.hidden = owned < 1;
    ref.owned.textContent = owned > 0 ? `×${owned}` : '';

    if (ref.gate) {
      ref.gate.classList.toggle('ready', !streetLocked);
      ref.gate.textContent = streetLocked
        ? `Street ${state.crowd}/${FINALE_CROWD}`
        : 'Street packed!';
    }
  }
}

function buyFirework(firework) {
  if (state.phase !== 'play' || state.finale) return;

  if (firework.finale && state.crowd < FINALE_CROWD) {
    showBanner(`Big Bertha needs the whole street out — crowd ${state.crowd}/${FINALE_CROWD}.`);
    return;
  }

  if (state.cash < firework.price) {
    showBanner(`You need ${formatMoney(firework.price - state.cash)} more for that one.`);
    return;
  }

  state.cash -= firework.price;
  state.owned[firework.id] = (state.owned[firework.id] || 0) + 1;

  audio.unlock();
  audio.buy();
  updateHud();
  updateStand();

  statusEl.textContent = `${firework.name} bought for ${formatMoney(firework.price)}. You own ${
    state.owned[firework.id]
  }.`;
}

function chooseFirework(firework) {
  if (state.phase !== 'play' || state.finale) return;
  if ((state.owned[firework.id] || 0) < 1) return;

  if (firework.kind === 'night' && state.sky !== 'night') {
    showBanner('The big ones only go up after dark. Wait for night.');
    audio.uiClick();
    return;
  }

  if (state.selected === firework.id) {
    cancelPlacement();
    return;
  }

  state.selected = firework.id;
  placingHint.hidden = false;
  placingHint.textContent = `Placing ${firework.name} — tap the yard`;
  container.classList.add('placing');
  ghost.visible = false;

  if (firework.kind === 'day' && state.sky === 'night') {
    showBanner('Little ones bring the daylight. Big shells wait for dark.', 2600);
  }

  updateStand();
  audio.uiClick();

  if (isNarrowScreen) {
    container.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }
}

function cancelPlacement() {
  state.selected = null;
  placingHint.hidden = true;
  container.classList.remove('placing');
  ghost.visible = false;
  updateStand();
}

/* ------------------------------------------------------------------ *
 * Picking and pointing
 * ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

const groundHit = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 22),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
groundHit.rotation.x = -Math.PI / 2;
groundHit.position.set(0, 0.01, -0.8);
scene.add(groundHit);

const ghost = new THREE.Group();
const ghostRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.62, 28),
  new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
ghostRing.rotation.x = -Math.PI / 2;
ghost.add(ghostRing);
const ghostTube = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8),
  new THREE.MeshBasicMaterial({
    color: 0xfff3cf,
    transparent: true,
    opacity: 0.45,
  })
);
ghostTube.position.y = 0.35;
ghost.add(ghostTube);
ghost.visible = false;
ghost.position.y = 0.02;
scene.add(ghost);

function setPointer(event) {
  const rect = container.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function updateGhostPosition() {
  if (!state.selected) {
    ghost.visible = false;
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(groundHit, false)[0];

  if (!hit) {
    ghost.visible = false;
    return;
  }

  ghost.visible = true;
  ghost.position.set(
    clamp(hit.point.x, PLACE.minX, PLACE.maxX),
    0.02,
    clamp(hit.point.z, PLACE.minZ, PLACE.maxZ)
  );
}

function handleTap() {
  if (state.phase !== 'play' || state.finale) return;

  raycaster.setFromCamera(pointer, camera);

  const placedHit = raycaster.intersectObjects(placedHits, false)[0];
  if (placedHit) {
    lightPlaced(placedHit.object.userData.placedRef);
    return;
  }

  if (!state.selected) return;

  const groundPlaneHit = raycaster.intersectObject(groundHit, false)[0];
  if (!groundPlaneHit) return;

  placeFirework(state.selected, groundPlaneHit.point.x, groundPlaneHit.point.z);
}

renderer.domElement.addEventListener('pointermove', (event) => {
  setPointer(event);
  updateGhostPosition();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  setPointer(event);
  handleTap();
});

window.addEventListener('keydown', (event) => {
  if (state.phase !== 'play' || state.finale) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLElement) {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  }

  if (event.key === 'Escape') {
    cancelPlacement();
    return;
  }

  if (event.code === 'Space' && event.target === document.body) {
    const newest = [...placed].reverse().find((item) => item.userData.state === 'ready');
    if (newest) {
      lightPlaced(newest);
      event.preventDefault();
    }
    return;
  }

  const index = Number(event.key) - 1;
  if (Number.isInteger(index) && index >= 0 && index < FIREWORKS.length) {
    const firework = FIREWORKS[index];
    if ((state.owned[firework.id] || 0) > 0) {
      chooseFirework(firework);
      event.preventDefault();
    }
  }
});

/* ------------------------------------------------------------------ *
 * HUD
 * ------------------------------------------------------------------ */

function updateHud() {
  setText(cashEl, formatMoney(state.cash));
  setText(scoreEl, formatMoney(state.score));
  setText(bestEl, formatMoney(state.best));
  setText(crowdEl, String(state.crowd));
  setText(crowdBonusEl, `×${crowdBonus().toFixed(2)}`);
}

let lastClockText = '';
let lastSkyKey = '';

function skyInfo() {
  if (state.sky === 'day') {
    return {
      icon: '☀️',
      label: 'Daylight',
      sub: `night in ${Math.max(1, Math.ceil(state.dayTimer))}s`,
    };
  }
  if (state.sky === 'sunset') return { icon: '🌇', label: 'Sunset', sub: 'big ones soon' };
  return { icon: '🌙', label: 'Night', sub: 'big ones ready' };
}

function updateHudClock() {
  const text = formatClock(state.timeLeft);
  if (text !== lastClockText) {
    lastClockText = text;
    timeEl.textContent = text;
  }

  const bonus = state.finale
    ? state.finaleBonus
    : state.phase === 'play'
      ? Math.ceil(state.timeLeft) * TIME_BONUS_PER_SECOND
      : 0;
  setText(timeBonusEl, `+${formatMoney(bonus)}`);
  timeEl.classList.toggle('low', state.phase === 'play' && !state.finale && state.timeLeft <= 12);

  const key = `${state.sky}|${state.sky === 'day' ? Math.ceil(state.dayTimer) : ''}`;
  if (key !== lastSkyKey) {
    lastSkyKey = key;
    const info = skyInfo();
    skyIconEl.textContent = info.icon;
    skyLabelEl.textContent = info.label;
    skySubEl.textContent = info.sub;
  }
}

/* ------------------------------------------------------------------ *
 * Banner
 * ------------------------------------------------------------------ */

let bannerTimer = null;

function showBanner(text, duration = 2200) {
  bannerText.textContent = text;
  banner.classList.add('show');
  if (bannerTimer) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => banner.classList.remove('show'), duration);
}

/* ------------------------------------------------------------------ *
 * Start button
 * ------------------------------------------------------------------ */

startButton.addEventListener('click', () => {
  startShow();
});

/* ------------------------------------------------------------------ *
 * Render loop
 * ------------------------------------------------------------------ */

function updateCamera(dt) {
  const targetX = CAMERA_BASE.x + (reducedMotion ? 0 : pointer.x * 0.7);
  const targetY = CAMERA_BASE.y + (reducedMotion ? 0 : pointer.y * 0.35);
  const ease = Math.min(1, dt * 2.2);

  camera.position.x += (targetX - camera.position.x) * ease;
  camera.position.y += (targetY - camera.position.y) * ease;

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - dt);
    const fade = shakeDuration > 0 ? shakeTime / shakeDuration : 0;
    const amount = shakeStrength * fade;
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount;
  }

  camera.lookAt(CAMERA_TARGET);
}

function tick() {
  window.requestAnimationFrame(tick);

  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  updateSky(dt);
  paintSky();
  updateCamera(dt);

  updatePending(dt);
  updatePlaced(dt);
  updateShots(dt);
  updateBursts(dt);
  updateGlows(dt);
  updateFlashes(dt);
  crowd.update(dt, elapsed, 1 - state.skyLight);

  ghostRing.rotation.z += dt * 1.2;

  if (state.phase === 'play' && !state.finale) {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) endShow('curfew');
    else checkBroke(dt);
  }

  updateCombo(dt);
  updateHudClock();
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

buildStand();
updateHud();
updateStand();
paintSky();
tick();
