import * as THREE from 'three';
import { createAudio } from './audio.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';

/* ------------------------------------------------------------------ *
 * Spooky Santa
 * A stealth game about one very quiet delivery run through a house
 * that is almost, but not quite, asleep.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const turnToward = (current, target, maxStep) =>
  current + clamp(angDiff(target, current), -maxStep, maxStep);

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

const container = document.querySelector('#game-container');
const presentCountEl = document.querySelector('#present-count');
const pipsEl = document.querySelector('#present-pips');
const detectFill = document.querySelector('#detect-fill');
const detectWrap = document.querySelector('#detect-wrap');
const timerEl = document.querySelector('#timer');
const timerWrap = document.querySelector('#timer-wrap');
const listenerHint = document.querySelector('#hint');
const bannerEl = document.querySelector('#banner');
const bannerLabel = bannerEl.querySelector('span');
const vignetteEl = document.querySelector('#vignette');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlaySub = document.querySelector('#overlay-sub');
const overlayText = document.querySelector('#overlay-text');
const overlayRules = document.querySelector('#overlay-rules');
const overlayControls = document.querySelector('#overlay-controls');
const overlayStats = document.querySelector('#overlay-stats');
const startButton = document.querySelector('#start-button');
const statusEl = document.querySelector('#status');
const muteButton = document.querySelector('#mute-button');
const touchControls = document.querySelector('#touch-controls');
const sneakButton = document.querySelector('#sneak-button');
const actionButton = document.querySelector('#action-button');

const pips = [];
for (let i = 0; i < 5; i += 1) {
  const pip = document.createElement('span');
  pip.className = 'pip';
  pipsEl.append(pip);
  pips.push(pip);
}

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

const audio = createAudio();
const MUTE_KEY = 'spookySantaMuted';

if (readMuted(MUTE_KEY)) audio.setMuted(true);

const refreshMuteButton = () => {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute soundtrack and sound effects' : 'Mute soundtrack and sound effects');
};
refreshMuteButton();

muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  writeMuted(audio.isMuted());
  refreshMuteButton();
  if (!audio.isMuted()) audio.uiClick();
});

/* The delivery freezes when the tab goes away. */
const autoPause = createAutoPause({
  container,
  audio,
  muteButton,
  button: document.querySelector('#pause-button'),
  shouldPause: () => container.classList.contains('playing'),
  message: 'Delivery paused',
});

/*
 * Full screen keeps the page from scrolling under small thumbs.
 * Hidden where the browser has no element full screen (for example an iframe).
 */
const fullscreenButton = document.querySelector('#fullscreen-button');
const gameShell = document.querySelector('.ss-game');
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
      audio.uiClick();
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
      updateCamera(0);
    });
  }
}

/* ------------------------------------------------------------------ *
 * Rules of the night
 * ------------------------------------------------------------------ */

const ROUND_SECONDS = 165;
const TOTAL_PRESENTS = 5;
const PLAYER_RADIUS = 0.36;
const WALK_SPEED = 3.25;
const SNEAK_SPEED = 1.5;
const DASH_SPEED = 6.3;
const SPAWN = { x: -8.6, z: -5.35 };
const HEARTH = { x: -8.6, z: -5.35, r: 1.35 };
const TREE_LIGHT = { x: -5.4, z: -3.3 };

/* ------------------------------------------------------------------ *
 * Floor plan
 * ------------------------------------------------------------------ */

const WALLS = [
  /* exterior shell */
  { x: 0, z: -7.17, w: 20.4, d: 0.34, tall: true },
  { x: 0, z: 7.17, w: 20.4, d: 0.34, tall: true },
  { x: -10.17, z: 0, w: 0.34, d: 14.4, tall: true },
  { x: 10.17, z: 0, w: 0.34, d: 14.4, tall: true },
  /* living room | kitchen */
  { x: 1.5, z: -5.8, w: 0.3, d: 2.4 },
  { x: 1.5, z: -0.8, w: 0.3, d: 3.6 },
  /* hallway north wall, with doorways to living room and kitchen */
  { x: -8.4, z: 1, w: 3.2, d: 0.3 },
  { x: -1.65, z: 1, w: 6.3, d: 0.3 },
  { x: 3.35, z: 1, w: 3.7, d: 0.3 },
  { x: 8.6, z: 1, w: 2.8, d: 0.3 },
  /* hallway south wall, with doorways to bedroom and den */
  { x: -8.5, z: 3, w: 3, d: 0.3 },
  { x: -1.5, z: 3, w: 7, d: 0.3 },
  { x: 7, z: 3, w: 6, d: 0.3 },
  /* bedroom | den */
  { x: 0, z: 5, w: 0.3, d: 4 },
];

const PRESENT_SPOTS = [
  { x: -5.4, z: -2.85, label: 'under the tree' },
  { x: -7.4, z: -4.4, label: 'beside the tree' },
  { x: 5.6, z: -1.75, label: 'on the kitchen table' },
  { x: -5.9, z: 4.55, label: 'by the bed' },
  { x: 8.5, z: 5.6, label: 'by the armchair' },
];

const HIDE_SPOTS = [
  { x: -1.0, z: 2.15, label: 'coat closet' },
  { x: -1.1, z: -1.7, label: 'back of the couch' },
  { x: 9.0, z: -2.4, label: 'pantry' },
];

/** Walk-in closets. Standing inside one hides Santa from every pair of eyes. */
const SAFE_CLOSETS = [
  { x: -2.6, z: -6.3, w: 1.8, d: 1.2, open: 'south', label: 'living room closet' },
  { x: 3.1, z: -5.2, w: 1.8, d: 1.2, open: 'south', label: 'kitchen closet' },
  { x: -4.1, z: 3.75, w: 1.8, d: 1.2, open: 'south', label: 'bedroom closet' },
];

const COOKIE = { x: 2.4, z: -5.35, r: 1.15 };

const CREAK_ZONES = [
  { minX: -8.2, maxX: -3.6, minZ: 1.35, maxZ: 2.7 },
  { minX: -6.2, maxX: -3.8, minZ: -1.4, maxZ: 0.3 },
  { minX: 2.2, maxX: 4.3, minZ: -1.8, maxZ: -0.6 },
  { minX: -5.6, maxX: -3.0, minZ: 4.7, maxZ: 5.8 },
];

const TOY_SPOTS = [
  { x: 0.6, z: 0.4, color: 0xff5d8f },
  { x: 3.6, z: 2.45, color: 0x62e0ff },
  { x: -4.6, z: 6.2, color: 0xffd93d },
];

const DAD_ROUTE = [
  { x: 4.6, z: 4.8 },
  { x: 3.0, z: 2.0 },
  { x: 6.4, z: 1.4 },
  { x: 6.4, z: -1.4 },
  { x: 2.6, z: -4.9 },
  { x: 2.8, z: -1.6 },
  { x: 6.4, z: 0.4 },
  { x: 3.0, z: 2.2 },
];

const DOG_ROUTE = [
  { x: -1.6, z: 2.0 },
  { x: -6.0, z: 1.85 },
  { x: -5.9, z: 0.5 },
  { x: -4.6, z: -1.2 },
  { x: -2.6, z: -2.4 },
  { x: 0.6, z: -5.2 },
  { x: -2.6, z: -2.4 },
  { x: -4.6, z: -1.2 },
  { x: -5.9, z: 0.5 },
  { x: -6.0, z: 1.85 },
];

/* ------------------------------------------------------------------ *
 * Renderer / scene / camera
 * ------------------------------------------------------------------ */

/*
 * No MSAA and no dynamic shadow pass: this runs in software GL in some
 * browsers, where a 2048 shadow map dropped the frame rate into single
 * digits. The night look comes from the point lights and glowing props.
 */
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
container.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0614);

const camFocus = new THREE.Vector3(0, 0, -0.4);
const CAM_OFFSET = new THREE.Vector3(0, 21, 19);
const camera = new THREE.OrthographicCamera(-11, 11, 8, -8, 0.1, 120);
camera.position.copy(camFocus).add(CAM_OFFSET);
camera.lookAt(camFocus);

let followCamera = false;

function sizeScene() {
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 520;
  const aspect = width / height;

  if (aspect >= 1.45) {
    followCamera = false;
    const viewHeight = Math.max(16.2, 21.8 / aspect);
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
  } else {
    followCamera = true;
    const viewHeight = 13.4;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
  }

  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height, false);
}

/* ------------------------------------------------------------------ *
 * Lighting
 * ------------------------------------------------------------------ */

scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a1026, 1.0));

const moon = new THREE.DirectionalLight(0xc6d8ff, 1.05);
moon.position.set(-8, 17, 11);
moon.target.position.set(0, 0, -1);
scene.add(moon);
scene.add(moon.target);

const fireLight = new THREE.PointLight(0xff8a3d, 16, 10, 2);
fireLight.position.set(-8.6, 1.1, -5.7);
scene.add(fireLight);

const kitchenLight = new THREE.PointLight(0xfff0c0, 5, 7.5, 2);
kitchenLight.position.set(5.6, 2.3, -3.6);
scene.add(kitchenLight);

const treeGlow = new THREE.PointLight(0x6dffc0, 7, 7, 2);
treeGlow.position.set(-5.4, 1.7, -4.4);
scene.add(treeGlow);



/* ------------------------------------------------------------------ *
 * Textures and materials
 * ------------------------------------------------------------------ */

function makeTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
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

const woodFloor = makeTexture(
  256,
  256,
  (ctx, size) => {
    ctx.fillStyle = '#3a2a26';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#42302a' : '#33231f';
      ctx.fillRect(0, y, size, 30);
      ctx.fillStyle = 'rgba(12, 6, 8, 0.55)';
      ctx.fillRect(0, y + 30, size, 2);
      for (let i = 0; i < 7; i += 1) {
        ctx.strokeStyle = `rgba(20, 10, 10, ${rand(0.06, 0.2)})`;
        ctx.beginPath();
        const yy = y + rand(3, 27);
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(size * 0.3, yy + rand(-3, 3), size * 0.6, yy + rand(-3, 3), size, yy);
        ctx.stroke();
      }
    }
  },
  4,
  3
);

const tileFloor = makeTexture(
  128,
  128,
  (ctx, size) => {
    const half = size / 2;
    ctx.fillStyle = '#2b2436';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#3b3348';
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    ctx.strokeStyle = 'rgba(10, 6, 12, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, half, half);
    ctx.strokeRect(half, 0, half, half);
    ctx.strokeRect(0, half, half, half);
    ctx.strokeRect(half, half, half, half);
  },
  6,
  5
);

const wallPaper = makeTexture(
  128,
  128,
  (ctx, size) => {
    ctx.fillStyle = '#2a2136';
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = 'rgba(122, 90, 170, 0.16)';
      ctx.fillRect(x, 0, 7, size);
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = 'rgba(200, 180, 255, 0.22)';
      ctx.fillRect(rand(0, size), rand(0, size), 1.6, 1.6);
    }
  },
  6,
  3
);

const rugTexture = makeTexture(
  128,
  128,
  (ctx, size) => {
    ctx.fillStyle = '#4a1c33';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#c98b4a';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.strokeStyle = 'rgba(255, 220, 255, 0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(20 + i * 24, 20);
      ctx.lineTo(32 + i * 24, 40);
      ctx.lineTo(20 + i * 24, 60);
      ctx.lineTo(32 + i * 24, 80);
      ctx.stroke();
    }
  },
  2,
  2
);

const M = {
  floor: new THREE.MeshStandardMaterial({ map: woodFloor, roughness: 0.92 }),
  tile: new THREE.MeshStandardMaterial({ map: tileFloor, roughness: 0.7 }),
  wall: new THREE.MeshStandardMaterial({ map: wallPaper, roughness: 0.95 }),
  wallCap: new THREE.MeshStandardMaterial({ color: 0x4a3a63, roughness: 0.85 }),
  rug: new THREE.MeshStandardMaterial({ map: rugTexture, roughness: 1 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x35284a, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x4d4256, roughness: 0.95 }),
  hearth: new THREE.MeshStandardMaterial({ color: 0x312739, roughness: 0.9 }),
  soot: new THREE.MeshBasicMaterial({ color: 0x07050b }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b452f, roughness: 0.85 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x412a1d, roughness: 0.85 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x3f5d6d, roughness: 0.95 }),
  fabricWarm: new THREE.MeshStandardMaterial({ color: 0x6b3d52, roughness: 0.95 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0x557a86, roughness: 1 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.8 }),
  counter: new THREE.MeshStandardMaterial({ color: 0x8b8fa0, roughness: 0.5, metalness: 0.15 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 0.8, roughness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf3ede0, roughness: 0.85 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8243a, roughness: 0.75 }),
  green: new THREE.MeshStandardMaterial({ color: 0x2f7a4a, roughness: 0.9 }),
  greenDark: new THREE.MeshStandardMaterial({ color: 0x1f5334, roughness: 0.9 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.95 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xbfe6ff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    metalness: 0.2,
  }),
  screen: new THREE.MeshBasicMaterial({ color: 0x2b6f8a, toneMapped: false }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff9a3d, toneMapped: false }),
  star: new THREE.MeshBasicMaterial({ color: 0xfff0a8, toneMapped: false }),
};

/* ------------------------------------------------------------------ *
 * Collision + line of sight data
 * ------------------------------------------------------------------ */

const solids = [];

function addSolid(cx, cz, w, d) {
  const rect = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
  solids.push(rect);
  return rect;
}

function collidesAt(x, z, radius = PLAYER_RADIUS) {
  for (const s of solids) {
    if (
      x > s.minX - radius &&
      x < s.maxX + radius &&
      z > s.minZ - radius &&
      z < s.maxZ + radius
    ) {
      return true;
    }
  }
  return false;
}

function segmentHitsRect(x1, z1, x2, z2, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const p = [-dx, dx, -dz, dz];
  const q = [x1 - r.minX, r.maxX - x1, z1 - r.minZ, r.maxZ - z1];
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

function blocked(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 1;
  const sx = x1 + (dx / len) * 0.34;
  const sz = z1 + (dz / len) * 0.34;
  for (const s of solids) {
    if (segmentHitsRect(sx, sz, x2, z2, s)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Mesh helpers
 * ------------------------------------------------------------------ */

function box(w, h, d, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, material, x, y, z, parent = scene, segments = 12) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(radius, material, x, y, z, parent = scene, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments - 2), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function floorPatch(width, depth, material, x, z, y = 0.008) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ *
 * House shell
 * ------------------------------------------------------------------ */

const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), M.floor);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

floorPatch(8.5, 8, M.tile, 5.75, -3, 0.005);
floorPatch(10, 4, M.carpet, -5, 5, 0.006);
floorPatch(5.6, 3.4, M.rug, -2.9, -1.7, 0.012);
floorPatch(9.6, 1.5, M.rug, -1.0, 2.0, 0.012);
floorPatch(5.4, 2.4, M.rug, 5.2, 5.2, 0.012);

const wallGroup = new THREE.Group();
scene.add(wallGroup);

WALLS.forEach((w) => {
  const height = w.tall ? 1.8 : 1.3;
  box(w.w, height, w.d, M.wall, w.x, height / 2, w.z, wallGroup);
  box(w.w + 0.08, 0.09, w.d + 0.08, M.wallCap, w.x, height + 0.02, w.z, wallGroup);
  addSolid(w.x, w.z, w.w, w.d);
});

/* Wall sconces so the rooms read apart from the moon. */
[
  [-9.2, 2.6, -3.0],
  [4.2, 2.6, 2.9],
  [8.4, 2.6, 5.2],
].forEach(([x, y, z]) => {
  cylinder(0.09, 0.11, 0.16, M.metal, x, y, z);
  sphere(0.14, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), x, y + 0.14, z);
});

/* Windows on the north wall, moonlight outside. */
[-2.6, 3.6].forEach((x) => {
  box(1.5, 1.05, 0.12, M.glass, x, 1.05, -6.99);
  box(1.6, 0.09, 0.16, M.wallCap, x, 1.6, -6.99);
  box(1.6, 0.09, 0.16, M.wallCap, x, 0.5, -6.99);
});

/* ------------------------------------------------------------------ *
 * Fireplace + chimney landing
 * ------------------------------------------------------------------ */

const fireplace = new THREE.Group();
fireplace.position.set(-8.6, 0, -6.5);
scene.add(fireplace);

box(2.2, 1.5, 0.9, M.stone, 0, 0.75, 0, fireplace);
box(1.25, 0.9, 0.35, M.soot, 0, 0.5, 0.42, fireplace);
box(2.5, 0.16, 1.1, M.stone, 0, 1.56, 0.06, fireplace);
box(2.7, 0.12, 1.0, M.hearth, 0, 0.05, 0.98, fireplace);
addSolid(-8.6, -6.55, 2.2, 0.9);

/* Stockings hanging for the morning. */
[-0.62, 0, 0.62].forEach((x) => {
  const stocking = box(0.22, 0.32, 0.1, M.red, x, 1.2, 0.4, fireplace);
  stocking.rotation.z = 0.06;
  box(0.24, 0.1, 0.11, M.white, x, 1.37, 0.4, fireplace);
});

/* Logs and a small fire. */
const flames = [];
[-0.28, 0.28].forEach((x) => {
  const log = cylinder(0.09, 0.09, 0.62, M.darkWood, x, 0.18, 0.4, fireplace, 8);
  log.rotation.z = Math.PI / 2;
});
for (let i = 0; i < 3; i += 1) {
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16 - i * 0.03, 0.42 - i * 0.1, 7),
    new THREE.MeshBasicMaterial({ color: [0xff9a3d, 0xffd166, 0xff5d3d][i], toneMapped: false })
  );
  flame.position.set(-0.16 + i * 0.16, 0.3 + i * 0.05, 0.42);
  fireplace.add(flame);
  flames.push(flame);
}

/* A warm square of floor showing where the chimney drops you. */
const hearthRing = new THREE.Mesh(
  new THREE.RingGeometry(0.62, 0.86, 26),
  new THREE.MeshBasicMaterial({
    color: 0xffb066,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
);
hearthRing.rotation.x = -Math.PI / 2;
hearthRing.position.set(HEARTH.x, 0.03, -5.9);
scene.add(hearthRing);

/* ------------------------------------------------------------------ *
 * Christmas tree
 * ------------------------------------------------------------------ */

const tree = new THREE.Group();
tree.position.set(-5.4, 0, -4.6);
scene.add(tree);

cylinder(0.16, 0.2, 0.9, M.darkWood, 0, 0.45, 0, tree);
[
  { r: 1.5, h: 1.5, y: 1.2 },
  { r: 1.2, h: 1.35, y: 1.95 },
  { r: 0.88, h: 1.15, y: 2.6 },
].forEach((tier) => {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(tier.r, tier.h, 14),
    tier.y > 2 ? M.greenDark : M.green
  );
  cone.position.y = tier.y;
  cone.castShadow = true;
  cone.receiveShadow = true;
  tree.add(cone);
});

const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), M.star);
starMesh.position.y = 3.28;
tree.add(starMesh);

const skirt = new THREE.Mesh(
  new THREE.CircleGeometry(1.15, 22),
  new THREE.MeshStandardMaterial({ color: 0x7d1c37, roughness: 1 })
);
skirt.rotation.x = -Math.PI / 2;
skirt.position.y = 0.018;
tree.add(skirt);
addSolid(-5.4, -4.6, 1.9, 1.9);

const ornamentMats = [0xff4d6d, 0x62e0ff, 0xffd93d, 0xb07bff, 0x6dffc0].map(
  (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.4 })
);

const bulbMats = [];
for (let i = 0; i < 22; i += 1) {
  const angle = (i / 22) * TAU + rand(-0.2, 0.2);
  const height = rand(0.9, 2.9);
  const radius = lerp(1.35, 0.45, (height - 0.9) / 2.0);
  const mat =
    i % 3 === 0
      ? new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false })
      : ornamentMats[i % ornamentMats.length];
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat);
  bulb.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  tree.add(bulb);
  if (i % 3 === 0) bulbMats.push(mat);
}

/* A couple of wrapped presents already under the tree. */
[
  { x: -0.7, z: 0.55, size: 0.44, color: 0xff4d6d },
  { x: 0.45, z: 0.7, size: 0.36, color: 0x62e0ff },
].forEach((gift) => {
  const present = new THREE.Mesh(
    new THREE.BoxGeometry(gift.size, gift.size * 0.8, gift.size),
    new THREE.MeshStandardMaterial({ color: gift.color, roughness: 0.7 })
  );
  present.position.set(gift.x, gift.size * 0.4, gift.z);
  present.castShadow = true;
  tree.add(present);
  box(gift.size * 1.02, gift.size * 0.82, gift.size * 0.14, M.paper, gift.x, gift.size * 0.4, gift.z, tree);
});

/* ------------------------------------------------------------------ *
 * Living room furniture
 * ------------------------------------------------------------------ */

/** Couch against the divider wall, facing into the room. */
const couch = new THREE.Group();
couch.position.set(0.45, 0, -1.7);
scene.add(couch);
box(1.5, 0.42, 2.7, M.fabric, 0, 0.28, 0, couch);
box(1.7, 0.16, 1.3, M.cushion, 0.05, 0.54, -0.65, couch);
box(1.7, 0.16, 1.3, M.cushion, 0.05, 0.54, 0.65, couch);
box(0.34, 1.0, 2.8, M.fabric, 0.62, 0.6, 0, couch);
box(1.6, 0.5, 0.24, M.fabric, 0.05, 0.62, -1.4, couch);
box(1.6, 0.5, 0.24, M.fabric, 0.05, 0.62, 1.4, couch);
addSolid(0.45, -1.7, 1.7, 2.9);

/** Coffee table with a mug that someone will absolutely knock over. */
const coffee = new THREE.Group();
coffee.position.set(-2.9, 0, -1.7);
scene.add(coffee);
box(2.0, 0.1, 1.3, M.wood, 0, 0.52, 0, coffee);
[
  [-0.85, -0.5],
  [0.85, -0.5],
  [-0.85, 0.5],
  [0.85, 0.5],
].forEach(([x, z]) => box(0.1, 0.5, 0.1, M.darkWood, x, 0.25, z, coffee));
cylinder(0.1, 0.09, 0.16, M.white, 0.5, 0.62, 0.1, coffee, 10);
cylinder(0.16, 0.16, 0.02, M.paper, -0.45, 0.58, -0.1, coffee, 12);
addSolid(-2.9, -1.7, 2.0, 1.3);

/* A rug-side armchair nobody sits in. */
const lounge = new THREE.Group();
lounge.position.set(-8.9, 0, -0.2);
lounge.rotation.y = 0.6;
scene.add(lounge);
box(1.2, 0.4, 1.2, M.fabricWarm, 0, 0.26, 0, lounge);
box(1.24, 0.9, 0.24, M.fabricWarm, 0, 0.62, -0.5, lounge);
box(0.2, 0.5, 1.2, M.fabricWarm, -0.52, 0.54, 0, lounge);
box(0.2, 0.5, 1.2, M.fabricWarm, 0.52, 0.54, 0, lounge);
addSolid(-8.9, -0.2, 1.4, 1.4);

/* Bookshelf, for the spooky silhouette. */
const shelf = new THREE.Group();
shelf.position.set(-9.6, 0, 2.0);
scene.add(shelf);
box(0.5, 2.1, 2.6, M.darkWood, 0, 1.05, 0, shelf);
[0.4, 0.95, 1.5].forEach((y, row) => {
  box(0.42, 0.06, 2.4, M.wood, 0.03, y, 0, shelf);
  for (let i = 0; i < 7; i += 1) {
    const bookMat = new THREE.MeshStandardMaterial({
      color: [0x8c2f39, 0x2f5d8c, 0x3f7a4a, 0x6a4a8c][(i + row) % 4],
      roughness: 0.9,
    });
    box(0.26, rand(0.22, 0.34), 0.14, bookMat, 0.02, y + 0.19, -0.95 + i * 0.29, shelf);
  }
});
addSolid(-9.6, 2.0, 0.55, 2.6);

/* ------------------------------------------------------------------ *
 * Kitchen
 * ------------------------------------------------------------------ */

const counters = new THREE.Group();
counters.position.set(5.7, 0, -6.45);
scene.add(counters);
box(7.8, 0.95, 1.1, M.cabinet, 0, 0.48, 0, counters);
box(7.95, 0.1, 1.22, M.counter, 0, 1.0, 0, counters);
box(1.1, 0.06, 0.7, M.metal, 1.4, 1.04, 0, counters);
cylinder(0.06, 0.06, 0.34, M.metal, 1.4, 1.2, -0.16, counters, 8);
addSolid(5.7, -6.45, 7.8, 1.1);

/* Cookie plate: the single most important object in the house. */
const cookiePlate = new THREE.Group();
cookiePlate.position.set(2.4, 1.06, -6.3);
scene.add(cookiePlate);
cylinder(0.34, 0.34, 0.04, M.white, 0, 0, 0, cookiePlate, 16);
const cookieGroup = new THREE.Group();
cookieGroup.position.set(0, 0.03, 0);
cookiePlate.add(cookieGroup);
for (let i = 0; i < 4; i += 1) {
  const cookie = cylinder(0.11, 0.11, 0.05, new THREE.MeshStandardMaterial({ color: 0xc99a56, roughness: 0.9 }), Math.cos(i * 1.6) * 0.13, 0.03, Math.sin(i * 1.6) * 0.13, cookieGroup, 10);
  cookie.rotation.z = rand(-0.1, 0.1);
}
cylinder(0.09, 0.08, 0.24, M.glass, 0.55, 0.12, 0, cookiePlate, 10);

const fridge = new THREE.Group();
fridge.position.set(9.2, 0, -4.6);
scene.add(fridge);
box(1.4, 2.0, 1.6, new THREE.MeshStandardMaterial({ color: 0x9aa7b5, roughness: 0.5, metalness: 0.35 }), 0, 1.0, 0, fridge);
box(0.06, 0.7, 0.06, M.metal, -0.55, 1.4, 0.82, fridge);
box(0.5, 0.3, 0.04, M.paper, 0.2, 1.6, 0.82, fridge);
addSolid(9.2, -4.6, 1.4, 1.6);

const island = new THREE.Group();
island.position.set(5.6, 0, -3.4);
scene.add(island);
box(2.6, 0.95, 1.7, M.cabinet, 0, 0.48, 0, island);
box(2.75, 0.1, 1.85, M.counter, 0, 1.0, 0, island);
cylinder(0.16, 0.18, 0.3, M.metal, -0.5, 1.18, 0, island, 10);
box(0.4, 0.24, 0.3, M.paper, 0.6, 1.15, 0.2, island);
addSolid(5.6, -3.4, 2.6, 1.7);

/* ------------------------------------------------------------------ *
 * Hallway
 * ------------------------------------------------------------------ */

const closet = new THREE.Group();
closet.position.set(-1.0, 0, 1.45);
scene.add(closet);
box(1.3, 2.15, 0.55, M.darkWood, 0, 1.07, 0, closet);
box(0.05, 1.9, 0.05, M.wood, -0.34, 1.05, 0.29, closet);
box(0.05, 1.9, 0.05, M.wood, 0.34, 1.05, 0.29, closet);
sphere(0.05, M.metal, 0, 1.05, 0.32, closet, 8);
addSolid(-1.0, 1.45, 1.3, 0.55);

/* Front door on the east wall. */
const frontDoor = new THREE.Group();
frontDoor.position.set(9.98, 0, 2.0);
scene.add(frontDoor);
box(0.16, 2.15, 1.5, M.darkWood, 0, 1.07, 0, frontDoor);
sphere(0.07, M.metal, -0.12, 1.0, 0.55, frontDoor, 8);
box(0.2, 0.3, 0.9, M.glass, -0.12, 1.6, 0, frontDoor);

/* Console table with a spooky little lamp. */
const consoleTable = new THREE.Group();
consoleTable.position.set(6.4, 0, 2.4);
scene.add(consoleTable);
box(1.4, 0.09, 0.55, M.wood, 0, 0.82, 0, consoleTable);
[
  [-0.6, -0.2],
  [0.6, -0.2],
  [-0.6, 0.2],
  [0.6, 0.2],
].forEach(([x, z]) => box(0.08, 0.8, 0.08, M.darkWood, x, 0.4, z, consoleTable));
cylinder(0.16, 0.2, 0.1, M.metal, 0, 0.91, 0, consoleTable, 12);
cylinder(0.04, 0.04, 0.4, M.metal, 0, 1.15, 0, consoleTable, 8);
box(0.34, 0.34, 0.34, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), 0, 1.45, 0, consoleTable);
addSolid(6.4, 2.4, 1.4, 0.55);

/* ------------------------------------------------------------------ *
 * Bedroom
 * ------------------------------------------------------------------ */

const bed = new THREE.Group();
bed.position.set(-8.4, 0, 5.4);
scene.add(bed);
box(3.2, 0.42, 2.6, M.darkWood, 0, 0.24, 0, bed);
box(3.0, 0.28, 2.4, M.white, 0, 0.55, 0, bed);
box(3.1, 0.18, 1.5, new THREE.MeshStandardMaterial({ color: 0x4a5f9e, roughness: 0.95 }), 0, 0.7, 0.5, bed);
box(3.0, 0.16, 0.6, M.white, 0, 0.68, -0.92, bed);
box(3.3, 0.9, 0.16, M.darkWood, 0, 0.5, -1.32, bed);
addSolid(-8.4, 5.4, 3.2, 2.6);

/* Kid, asleep until the floorboards rat you out. */
const kidRig = new THREE.Group();
kidRig.position.set(-8.3, 0.72, 4.7);
scene.add(kidRig);
const kidHead = sphere(0.23, new THREE.MeshStandardMaterial({ color: 0xf0c9a8, roughness: 0.85 }), 0, 0, 0, kidRig);
const kidHair = sphere(0.24, new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.95 }), 0, 0.05, -0.06, kidRig);
kidHair.scale.set(1, 0.7, 0.9);
const kidEyes = [];
[-0.075, 0.075].forEach((x) => {
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x1a1020 })
  );
  eye.position.set(x, 0.02, 0.2);
  eye.visible = false;
  kidRig.add(eye);
  kidEyes.push(eye);
});

const toyChest = new THREE.Group();
toyChest.position.set(-2.2, 0, 6.1);
scene.add(toyChest);
box(1.5, 0.7, 1.0, M.wood, 0, 0.35, 0, toyChest);
box(1.54, 0.14, 1.04, M.darkWood, 0, 0.74, 0, toyChest);
box(0.3, 0.22, 0.16, M.metal, 0, 0.5, 0.52, toyChest);
addSolid(-2.2, 6.1, 1.5, 1.0);

/* Night light by the door. */
const nightLightMesh = new THREE.Group();
nightLightMesh.position.set(-2.6, 0, 6.7);
scene.add(nightLightMesh);
box(0.34, 0.2, 0.14, M.white, 0, 0.2, 0, nightLightMesh);
sphere(
  0.12,
  new THREE.MeshBasicMaterial({ color: 0x9fc4ff, toneMapped: false }),
  0,
  0.32,
  0.04,
  nightLightMesh
);

/* ------------------------------------------------------------------ *
 * Den
 * ------------------------------------------------------------------ */

const armchair = new THREE.Group();
armchair.position.set(6.8, 0, 5.6);
armchair.rotation.y = -0.45;
scene.add(armchair);
box(1.4, 0.42, 1.4, M.fabricWarm, 0, 0.28, 0, armchair);
box(1.44, 1.0, 0.26, M.fabricWarm, 0, 0.66, -0.6, armchair);
box(0.28, 0.56, 1.4, M.fabricWarm, -0.62, 0.58, 0, armchair);
box(0.28, 0.56, 1.4, M.fabricWarm, 0.62, 0.58, 0, armchair);
addSolid(6.8, 5.6, 1.6, 1.6);

const tv = new THREE.Group();
tv.position.set(3.0, 0, 6.85);
scene.add(tv);
box(2.4, 1.35, 0.5, M.darkWood, 0, 0.72, 0, tv);
box(2.1, 1.05, 0.06, M.screen, 0, 0.78, 0.28, tv);
addSolid(3.0, 6.85, 2.4, 0.5);

/* Side table by the armchair, with the present spot beside it. */
const sideTable = new THREE.Group();
sideTable.position.set(9.2, 0, 4.4);
scene.add(sideTable);
box(0.9, 0.09, 0.9, M.wood, 0, 0.68, 0, sideTable);
[
  [-0.36, -0.36],
  [0.36, -0.36],
  [-0.36, 0.36],
  [0.36, 0.36],
].forEach(([x, z]) => box(0.07, 0.66, 0.07, M.darkWood, x, 0.33, z, sideTable));
cylinder(0.09, 0.08, 0.18, M.white, 0, 0.81, 0, sideTable, 10);
addSolid(9.2, 4.4, 0.9, 0.9);

/* ------------------------------------------------------------------ *
 * Present spots
 * ------------------------------------------------------------------ */

const PRESENT_COLORS = [0xff4d6d, 0x62e0ff, 0xffd93d, 0x8affc1, 0xc78bff];

function makePresent(size = 0.5, color = 0xff4d6d) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.8, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  body.position.y = size * 0.4;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfff3cf, roughness: 0.55 });
  const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.82, size * 1.02), ribbonMat);
  ribbonA.position.y = size * 0.4;
  group.add(ribbonA);
  const ribbonB = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.82, size * 0.16), ribbonMat);
  ribbonB.position.y = size * 0.4;
  group.add(ribbonB);
  return group;
}

const spotRingGeo = new THREE.RingGeometry(0.46, 0.62, 28);

const presentSpots = PRESENT_SPOTS.map((def, index) => {
  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);
  scene.add(group);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const ring = new THREE.Mesh(spotRingGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);

  const gift = makePresent(0.5, PRESENT_COLORS[index % PRESENT_COLORS.length]);
  gift.visible = false;
  group.add(gift);

  return { ...def, group, ring, ringMat, gift, delivered: false, phase: index * 0.7 };
});

/* Hide spots get a subtle marker so kids can find them. */
const hideMarkers = HIDE_SPOTS.map((spot) => {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 18, 1, 0, Math.PI),
    new THREE.MeshBasicMaterial({
      color: 0x7ef0ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.rotation.z = Math.PI;
  marker.position.set(spot.x, 0.03, spot.z);
  scene.add(marker);
  return { spot, marker };
});

/* ------------------------------------------------------------------ *
 * Safe-space closets
 * Standing inside one of these hides Santa completely: the sight test
 * returns zero and the detection meter empties quickly.
 * ------------------------------------------------------------------ */

const closetBody = new THREE.MeshStandardMaterial({ color: 0x443052, roughness: 0.92 });
const closetTrim = new THREE.MeshStandardMaterial({ color: 0x2a1e36, roughness: 0.85 });

function buildSafeCloset(def) {
  const { x, z, w, d, open } = def;
  const thickness = 0.14;
  const height = 1.7;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  /* Back panel sits opposite the open side. */
  const backZ = open === 'north' ? d / 2 - thickness / 2 : -d / 2 + thickness / 2;
  box(w, height, thickness, closetBody, 0, height / 2, backZ, group);
  addSolid(x, z + backZ, w, thickness);

  /* Side panels with a lighter cap so they read as furniture. */
  [-1, 1].forEach((side) => {
    const sx = side * (w / 2 - thickness / 2);
    box(thickness, height, d, closetBody, sx, height / 2, 0, group);
    addSolid(x + sx, z, thickness, d);
    box(thickness + 0.04, 0.07, d + 0.04, closetTrim, sx, height + 0.02, 0, group);
  });

  /* Hanging rail and two coats, high enough for Santa to walk under. */
  const rail = cylinder(0.03, 0.03, w - thickness * 2, M.metal, 0, height - 0.16, backZ * 0.4, group, 8);
  rail.rotation.z = Math.PI / 2;
  [-0.34, 0.3].forEach((offset, index) => {
    const coat = box(0.34, 0.5, 0.16, index ? M.fabricWarm : M.fabric, offset, height - 0.5, backZ * 0.45, group);
    coat.rotation.z = index ? -0.04 : 0.05;
  });

  /* Glowing floor patch marking the safe space. */
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w - thickness * 2.6, d - thickness * 2.6),
    new THREE.MeshBasicMaterial({
      color: 0x4fd6a0,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.028;
  group.add(glow);

  return {
    ...def,
    group,
    glow,
    inner: {
      minX: x - w / 2 + thickness + 0.02,
      maxX: x + w / 2 - thickness - 0.02,
      minZ: z - d / 2 + thickness + 0.02,
      maxZ: z + d / 2 - thickness - 0.02,
    },
  };
}

const safeClosets = SAFE_CLOSETS.map(buildSafeCloset);

function safeClosetAt(x, z) {
  for (const closet of safeClosets) {
    const { inner } = closet;
    if (x > inner.minX && x < inner.maxX && z > inner.minZ && z < inner.maxZ) return closet;
  }
  return null;
}

/* Squeaky toys. */
const toys = TOY_SPOTS.map((spot) => {
  const group = new THREE.Group();
  group.position.set(spot.x, 0, spot.z);
  scene.add(group);
  const body = sphere(
    0.13,
    new THREE.MeshStandardMaterial({ color: spot.color, roughness: 0.6 }),
    0,
    0.13,
    0,
    group,
    10
  );
  body.scale.set(1, 0.9, 1.2);
  sphere(0.045, new THREE.MeshBasicMaterial({ color: 0x1a1020 }), -0.05, 0.18, 0.1, group, 8);
  sphere(0.045, new THREE.MeshBasicMaterial({ color: 0x1a1020 }), 0.05, 0.18, 0.1, group, 8);
  return { ...spot, group, body, cool: 0 };
});

/* ------------------------------------------------------------------ *
 * Santa
 * ------------------------------------------------------------------ */

function buildSanta() {
  const group = new THREE.Group();
  scene.add(group);

  const skin = new THREE.MeshStandardMaterial({ color: 0xf3c9a4, roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1220, roughness: 0.7 });
  const sackMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 });

  const body = cylinder(0.3, 0.38, 0.6, M.red, 0, 0.42, 0, group, 14);
  const belt = cylinder(0.345, 0.355, 0.1, black, 0, 0.42, 0, group, 14);
  cylinder(0.39, 0.39, 0.08, white, 0, 0.15, 0, group, 14);

  const head = sphere(0.22, skin, 0, 0.87, 0.02, group, 16);
  const beard = sphere(0.2, white, 0, 0.78, 0.1, group, 14);
  beard.scale.set(1.0, 0.85, 0.72);
  const mustache = box(0.22, 0.05, 0.06, white, 0, 0.83, 0.2, group);
  mustache.rotation.z = 0.02;

  [-0.075, 0.075].forEach((x) => {
    sphere(0.026, black, x, 0.91, 0.19, group, 8);
  });

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.44, 14), M.red);
  hat.position.set(0, 1.14, 0);
  hat.rotation.z = 0.12;
  hat.castShadow = true;
  group.add(hat);
  cylinder(0.245, 0.245, 0.075, white, 0, 0.98, 0, group, 14);
  sphere(0.07, white, 0.09, 1.35, 0.01, group, 10);

  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), M.red);
    arm.position.set(0.33 * side, 0.55, 0.02);
    arm.rotation.z = side * 0.24;
    arm.castShadow = true;
    group.add(arm);
  });

  const sack = sphere(0.26, sackMat, 0, 0.5, -0.3, group, 12);
  sack.scale.set(1, 1.15, 0.85);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 10), white);
  tie.position.set(0, 0.72, -0.26);
  tie.rotation.x = Math.PI / 2;
  group.add(tie);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, body, hat, sack, shadow };
}

const santa = buildSanta();

/* ------------------------------------------------------------------ *
 * Grown-ups, kid and dog
 * ------------------------------------------------------------------ */

const CONE_Y = 0.045;

/** Distance from (x, z) along `angle` until a wall or solid stops it. */
function rayHitDistance(x, z, angle, maxDist) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  let best = maxDist;

  for (const s of solids) {
    let t0 = 0;
    let t1 = maxDist;
    let hit = true;
    const p = [-dx, dx, -dz, dz];
    const q = [x - s.minX, s.maxX - x, z - s.minZ, s.maxZ - z];

    for (let i = 0; i < 4; i += 1) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) {
          hit = false;
          break;
        }
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) {
            hit = false;
            break;
          }
          if (t > t0) t0 = t;
        } else {
          if (t < t0) {
            hit = false;
            break;
          }
          if (t < t1) t1 = t;
        }
      }
    }

    if (hit && t0 > 0.02 && t0 < best) best = t0;
  }

  return best;
}

/**
 * Flashlight, stare and tree-light wedges are rebuilt from rays every frame so
 * walls actually stop them, matching what the detection code believes.
 */
function makeCone(radius, halfAngle, color, opacity, segments = 26) {
  const positions = new Float32Array((segments + 2) * 3);
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positionAttribute);
  const index = [];
  for (let i = 0; i < segments; i += 1) index.push(0, i + 1, i + 2);
  geometry.setIndex(index);

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const origin = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacity * 1.6,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
  );
  origin.rotation.x = -Math.PI / 2;
  scene.add(origin);

  return {
    mesh,
    origin,
    material,
    base: color,
    opacity,
    radius,
    half: halfAngle,
    segments,
    positionAttribute,
  };
}

/** Redraw a wedge from (x, z) facing `dir`, clipped at the first wall. */
function placeCone(cone, x, z, dir) {
  const array = cone.positionAttribute.array;
  array[0] = x;
  array[1] = CONE_Y;
  array[2] = z;

  for (let i = 0; i <= cone.segments; i += 1) {
    const angle = dir - cone.half + (i / cone.segments) * cone.half * 2;
    const reach = rayHitDistance(x, z, angle, cone.radius);
    const at = (i + 1) * 3;
    array[at] = x + Math.cos(angle) * reach;
    array[at + 1] = CONE_Y;
    array[at + 2] = z + Math.sin(angle) * reach;
  }

  cone.positionAttribute.needsUpdate = true;
  cone.origin.position.set(x, CONE_Y, z);
}

function makeAlertMarker() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20, 6, 12, 0.7)';
  ctx.beginPath();
  ctx.arc(32, 34, 22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 32, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, toneMapped: false })
  );
  sprite.scale.set(0.74, 0.74, 0.74);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

function buildDad() {
  const group = new THREE.Group();
  scene.add(group);
  const robe = new THREE.MeshStandardMaterial({ color: 0x3d5470, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe7b48f, roughness: 0.85 });

  cylinder(0.32, 0.42, 0.95, robe, 0, 0.58, 0, group, 12);
  sphere(0.23, skin, 0, 1.2, 0.02, group, 14);
  sphere(0.19, new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 1 }), 0, 1.28, -0.05, group, 12);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), robe);
    arm.position.set(0.3 * side, 0.72, 0.05);
    arm.rotation.z = side * 0.3;
    group.add(arm);
    box(0.2, 0.1, 0.3, new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 1 }), 0.16 * side, 0.06, 0.1, group);
  });

  /* Flashlight in his right hand, pointed the way he is looking. */
  const torch = cylinder(0.07, 0.09, 0.32, M.metal, 0.34, 0.72, 0.3, group, 10);
  torch.rotation.x = Math.PI / 2;
  sphere(
    0.085,
    new THREE.MeshBasicMaterial({ color: 0xfff4c0, toneMapped: false }),
    0.34,
    0.72,
    0.47,
    group
  );

  const eyebrow = box(0.2, 0.03, 0.03, new THREE.MeshStandardMaterial({ color: 0x2a1a12 }), 0, 1.25, 0.2, group);
  eyebrow.rotation.z = 0.05;

  return { group, cone: makeCone(5.6, 0.38, 0xfff0b0, 0.13), marker: makeAlertMarker() };
}

function buildDog() {
  const group = new THREE.Group();
  scene.add(group);
  const fur = new THREE.MeshStandardMaterial({ color: 0xb07d4f, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6d452b, roughness: 0.95 });

  const body = sphere(0.24, fur, 0, 0.28, 0, group, 12);
  body.scale.set(1, 0.9, 1.35);
  const head = sphere(0.17, fur, 0, 0.42, 0.28, group, 12);
  const snout = box(0.14, 0.11, 0.16, dark, 0, 0.38, 0.42, group);
  snout.rotation.x = 0.1;
  sphere(0.035, new THREE.MeshBasicMaterial({ color: 0x100a10 }), 0, 0.42, 0.51, group, 8);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), dark);
    ear.position.set(0.1 * side, 0.56, 0.26);
    ear.rotation.z = side * 0.3;
    group.add(ear);
    sphere(0.03, new THREE.MeshBasicMaterial({ color: 0x100a10 }), 0.075 * side, 0.46, 0.4, group, 8);
    box(0.07, 0.18, 0.07, dark, 0.13 * side, 0.09, 0.14, group);
    box(0.07, 0.18, 0.07, dark, 0.13 * side, 0.09, -0.16, group);
  });
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 6), fur);
  tail.position.set(0, 0.42, -0.36);
  tail.rotation.x = -0.8;
  group.add(tail);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12), M.red);
  collar.position.set(0, 0.38, 0.16);
  collar.rotation.x = 1.2;
  group.add(collar);

  const sniff = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 2.24, 30),
    new THREE.MeshBasicMaterial({
      color: 0xff6a6a,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    })
  );
  sniff.rotation.x = -Math.PI / 2;
  sniff.position.y = 0.03;
  scene.add(sniff);

  return { group, tail, sniff };
}

const dadRig = buildDad();
const dogRig = buildDog();
const kidCone = makeCone(4.4, 0.55, 0xa9e8ff, 0.12);
const treeCone = makeCone(7.6, 0.19, 0xc8ffd0, 0.13);
const kidMarker = makeAlertMarker();
const treeMarker = null;

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

const state = {
  phase: 'menu', // menu | play | win | lose
  elapsed: 0,
  timeLeft: ROUND_SECONDS,
  delivered: 0,
  detection: 0,
  peak: 0,
  noise: 0,
  lastSeenAt: -9,
  sneak: false,
  hiding: null,
  safeCloset: null,
  placing: null,
  focus: null,
  dash: 0,
  bannerT: 0,
  seen: { dad: false, kid: false, lights: false },
  playerMoving: false,
};

const player = {
  x: SPAWN.x,
  z: SPAWN.z,
  dir: Math.PI / 2,
  bob: 0,
  stepT: 0,
  creakT: 0,
};

const dad = {
  x: DAD_ROUTE[0].x,
  z: DAD_ROUTE[0].z,
  dir: Math.PI / 2,
  idx: 1,
  speed: 1.9,
  state: 'patrol',
  inv: { x: 0, z: 0 },
  invT: 0,
  chaseT: 0,
  wait: 0.6,
  walk: 0,
};

const kid = {
  x: -8.3,
  z: 4.7,
  dir: Math.PI / 2,
  awake: false,
  awakeT: 0,
  headY: 0,
};

const dog = {
  x: DOG_ROUTE[0].x,
  z: DOG_ROUTE[0].z,
  dir: Math.PI / 2,
  idx: 1,
  barkCd: 0,
  walk: 0,
  wag: 0,
};

const treeLight = { dir: Math.PI / 2 };

const cookie = { eaten: false };

let bestScore = getBest('spooky-santa');

/* ------------------------------------------------------------------ *
 * UI helpers
 * ------------------------------------------------------------------ */

function banner(text, ms = 2000) {
  bannerLabel.textContent = text;
  bannerEl.classList.add('show');
  state.bannerT = ms / 1000;
}

function announce(text) {
  statusEl.textContent = text;
}

function setKidPose(awake) {
  kidHead.position.y = awake ? 0.16 : 0;
  kidHair.position.y = awake ? 0.21 : 0.05;
  kidEyes.forEach((eye) => {
    eye.visible = awake;
  });
}

function updateHud(force = false) {
  presentCountEl.textContent = `${state.delivered} / ${TOTAL_PRESENTS}`;
  detectFill.style.width = `${state.detection.toFixed(1)}%`;
  detectWrap.classList.toggle('warn', state.detection > 60);

  const seconds = Math.max(0, Math.ceil(state.timeLeft));
  timerEl.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  timerWrap.classList.toggle('low', seconds <= 30);

  pips.forEach((pip, index) => {
    pip.classList.toggle('full', index < state.delivered);
  });

  vignetteEl.style.opacity = String(clamp((state.detection - 35) / 70, 0, 0.8));

  const hint = hintFor();
  if (force || hint !== listenerHint.textContent) listenerHint.textContent = hint;
}

function hintFor() {
  if (state.hiding) return 'Hidden. Press action to slip back out.';
  if (state.safeCloset) return `Safe inside the ${state.safeCloset.label}. Walk out to rejoin the sneaking.`;
  if (state.placing) return 'Leaving the present... stay still.';
  const focus = state.focus;
  if (focus) {
    if (focus.type === 'present') return `Press action to leave the present ${focus.spot.label}.`;
    if (focus.type === 'hide') return `Press action to hide in the ${focus.spot.label}.`;
    if (focus.type === 'cookie') return 'Press action to eat the cookies. Sugar rush!';
    if (focus.type === 'escape') return 'Press action to climb the chimney. Freedom!';
  }
  if (state.delivered >= TOTAL_PRESENTS) return 'All five delivered. Get back to the fireplace!';
  if (state.sneak) return 'Sneaking. Slow and quiet.';
  return 'Sneak quietly. The house is asleep... mostly.';
}

function showOverlay({ title, sub, text, stats, button }) {
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlayText.textContent = text;
  overlayRules.hidden = Boolean(stats);
  overlayControls.hidden = Boolean(stats);
  overlayStats.innerHTML = '';
  if (stats) {
    stats.forEach(([label, value]) => {
      const cell = document.createElement('div');
      cell.className = 'stat-cell';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      cell.append(span, strong);
      overlayStats.append(cell);
    });
    overlayStats.classList.add('show');
  } else {
    overlayStats.classList.remove('show');
  }
  startButton.textContent = button;
  overlay.classList.remove('hidden');
  container.classList.remove('playing');
}

/* ------------------------------------------------------------------ *
 * Round flow
 * ------------------------------------------------------------------ */

function resetRound() {
  state.elapsed = 0;
  state.timeLeft = ROUND_SECONDS;
  state.delivered = 0;
  state.detection = 0;
  state.peak = 0;
  state.noise = 0;
  state.lastSeenAt = -9;
  state.sneak = false;
  state.hiding = null;
  state.safeCloset = null;
  state.placing = null;
  state.focus = null;
  state.dash = 0;
  state.seen = { dad: false, kid: false, lights: false };
  state.playerMoving = false;

  player.x = SPAWN.x;
  player.z = SPAWN.z;
  player.dir = Math.PI / 2;
  player.bob = 0;
  player.stepT = 0;
  player.creakT = 0;

  santa.group.visible = true;
  santa.group.position.set(player.x, 0, player.z);
  santa.group.rotation.y = Math.PI / 2 - player.dir;

  dad.x = DAD_ROUTE[0].x;
  dad.z = DAD_ROUTE[0].z;
  dad.dir = Math.PI / 2;
  dad.idx = 1;
  dad.state = 'patrol';
  dad.invT = 0;
  dad.chaseT = 0;
  dad.wait = 0.6;

  kid.awake = false;
  kid.awakeT = 0;
  kid.dir = Math.PI / 2;
  kidCone.mesh.visible = false;
  setKidPose(false);
  kidMarker.visible = false;

  dog.x = DOG_ROUTE[0].x;
  dog.z = DOG_ROUTE[0].z;
  dog.idx = 1;
  dog.barkCd = 0;

  cookie.eaten = false;
  cookieGroup.visible = true;

  presentSpots.forEach((spot) => {
    spot.delivered = false;
    spot.gift.visible = false;
    spot.ringMat.color.setHex(0xffd93d);
  });

  toys.forEach((toy) => {
    toy.cool = 0;
  });

  sneakingOff();
  updateHud(true);
}

function sneakingOff() {
  state.sneak = false;
  sneakButton.classList.remove('active');
  sneakButton.setAttribute('aria-pressed', 'false');
}

function startRound() {
  resetRound();
  state.phase = 'play';
  overlay.classList.add('hidden');
  container.classList.add('playing');
  audio.unlock();
  audio.arrive();
  audio.startMusic();
  banner('DELIVER 5 PRESENTS', 2200);
  announce('The night begins. Deliver all five presents, then return to the fireplace.');
  updateHud(true);
}

function endRound(won, reason) {
  state.phase = won ? 'win' : 'lose';
  state.hiding = null;
  state.safeCloset = null;
  state.placing = null;
  state.dash = 0;
  santa.group.visible = true;
  container.classList.remove('playing');
  audio.stopMusic();

  const timeLeft = Math.max(0, state.timeLeft);
  const score = won
    ? Math.round(state.delivered * 150 + timeLeft * 3 + (100 - state.peak) * 2)
    : Math.round(state.delivered * 60 + (100 - state.peak));

  let stars = 0;
  if (won) {
    stars = 1;
    if (state.peak < 65) stars = 2;
    if (state.peak < 30 && timeLeft > 55) stars = 3;
  }

  bestScore = submitScore('spooky-santa', score).best;

  if (won) {
    audio.win();
    banner('NICE LIST', 2600);
    announce(`Escaped. All presents delivered with ${Math.round(state.peak)} percent peak detection.`);
    showOverlay({
      title: 'Nice List',
      sub: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
      text:
        stars === 3
          ? 'Silent, swift and suspiciously good at this. Nobody even rolled over.'
          : stars === 2
            ? 'All presents delivered and only a few floorboards complained. Well sneaked.'
            : 'Every present is under the tree. Several people are now awake, but hey: it is Christmas.',
      stats: [
        ['Presents', `${state.delivered} / ${TOTAL_PRESENTS}`],
        ['Time left', `${Math.round(timeLeft)}s`],
        ['Peak detection', `${Math.round(state.peak)}%`],
        ['Best score', String(bestScore)],
      ],
      button: 'One more house',
    });
  } else {
    audio.caught();
    announce(reason);
    showOverlay({
      title: reason === 'sunrise' ? 'Sunrise!' : 'Spot!',
      sub: reason === 'sunrise' ? 'The paper round starts in ten minutes' : 'Somebody turned the big light on',
      text:
        reason === 'sunrise'
          ? 'The sky went grey while you were still in the kitchen. Santa has to be back at the sleigh.'
          : 'A flashlight found you, the dog lost its mind, and the whole house is awake. Try being quieter.',
      stats: [
        ['Presents', `${state.delivered} / ${TOTAL_PRESENTS}`],
        ['Time left', `${Math.round(state.timeLeft)}s`],
        ['Peak detection', `${Math.round(state.peak)}%`],
        ['Best score', String(bestScore)],
      ],
      button: 'Back up the chimney',
    });
  }

  updateHud(true);
}

startButton.addEventListener('click', () => {
  audio.unlock();
  audio.uiClick();
  startRound();
});

/* ------------------------------------------------------------------ *
 * Noise, alerts and consequences
 * ------------------------------------------------------------------ */

function wakeKid() {
  if (state.phase !== 'play') return;
  if (!kid.awake) {
    kid.awake = true;
    setKidPose(true);
    audio.wake();
    audio.scream();
    banner('THE KID IS AWAKE', 2000);
    announce('The kid woke up and is looking around the bedroom.');
  }
  kid.awakeT = Math.max(kid.awakeT, 9);
  alertDad(kid.x, kid.z);
}

function alertDad(x, z) {
  if (state.phase !== 'play') return;
  if (dad.state === 'chase') return;
  const wasPatrol = dad.state === 'patrol';
  dad.state = 'investigate';
  dad.inv = { x, z };
  dad.invT = Math.max(dad.invT, 7);
  if (wasPatrol) banner('DAD IS COMING', 1700);
}

function thinkBark() {
  if (dog.barkCd > 0) return;
  dog.barkCd = 6.5;
  audio.bark();
  audio.growl();
  state.noise = clamp(state.noise + 0.4, 0, 1);
  banner('WOOF!', 1400);
  alertDad(dog.x, dog.z);
  if (dist(dog.x, dog.z, kid.x, kid.z) < 7) wakeKid();
}

function noisePing(x, z, amount) {
  if (state.phase !== 'play') return;
  state.noise = clamp(state.noise + amount, 0, 1);

  if (dist(x, z, kid.x, kid.z) < 1.6 + amount * 6) wakeKid();
  if (dist(x, z, dad.x, dad.z) < 1.9 + amount * 6) alertDad(x, z);
  if (amount > 0.12 && dist(x, z, dog.x, dog.z) < 1.7 + amount * 5.5) thinkBark();
}

/* ------------------------------------------------------------------ *
 * Detection
 * ------------------------------------------------------------------ */

function visibility(o) {
  if (state.phase !== 'play' || state.hiding || state.safeCloset) return 0;
  const dx = player.x - o.x;
  const dz = player.z - o.z;
  const d = Math.hypot(dx, dz);
  if (d > o.range) return 0;
  /* Walls block light at every range, including the close "noticed you" field. */
  if (d > 0.001 && blocked(o.x, o.z, player.x, player.z)) return 0;
  const inCone = d < 1.05 || Math.abs(angDiff(Math.atan2(dz, dx), o.dir)) <= o.half;
  if (!inCone) return 0;
  return clamp(d < 1.05 ? 1 : 1 - (d / o.range) * 0.55, 0.25, 1);
}

function observers() {
  const list = [
    {
      id: 'dad',
      x: dad.x,
      z: dad.z,
      dir: dad.dir,
      half: 0.4,
      range: 5.6,
      rate: 60,
      cone: dadRig.cone,
      marker: dadRig.marker,
    },
    {
      id: 'lights',
      x: TREE_LIGHT.x,
      z: TREE_LIGHT.z,
      dir: treeLight.dir,
      half: 0.19,
      range: 7.6,
      rate: 18,
      cone: treeCone,
      marker: treeMarker,
    },
  ];
  if (kid.awake) {
    list.push({
      id: 'kid',
      x: kid.x,
      z: kid.z,
      dir: kid.dir,
      half: 0.55,
      range: 4.4,
      rate: 52,
      cone: kidCone,
      marker: kidMarker,
    });
  }
  return list;
}

function onSeen(id) {
  audio.alarm();
  if (id === 'dad') {
    dad.state = 'chase';
    dad.chaseT = 4;
    dad.invT = 0;
    banner("DAD SEES YOU", 1600);
    if (dist(dad.x, dad.z, kid.x, kid.z) < 9) wakeKid();
  } else if (id === 'kid') {
    audio.scream();
    banner('THE KID SEES YOU', 1600);
    alertDad(player.x, player.z);
  } else {
    banner('THE TREE LIGHTS FOUND YOU', 1600);
  }
}

function updateDetection(dt) {
  let anySeen = 0;
  const sneaky = state.sneak ? 0.62 : 1;

  for (const o of observers()) {
    const see = visibility(o);
    if (o.cone) {
      o.cone.material.color.setHex(see > 0 ? 0xff4d4d : o.cone.base);
      o.cone.material.opacity = see > 0 ? 0.26 : o.cone.opacity;
    }
    if (o.marker) o.marker.visible = see > 0;
    if (see > 0) {
      anySeen = Math.max(anySeen, see);
      state.detection += o.rate * see * sneaky * dt;
      if (!state.seen[o.id]) {
        state.seen[o.id] = true;
        onSeen(o.id);
      }
    } else {
      state.seen[o.id] = false;
    }
  }

  if (anySeen > 0) {
    state.lastSeenAt = state.elapsed;
  } else if (state.safeCloset || state.elapsed - state.lastSeenAt > 0.55) {
    state.detection -= (state.safeCloset ? 38 : 22) * dt;
  }

  state.detection = clamp(state.detection, 0, 100);
  state.peak = Math.max(state.peak, state.detection);
  audio.setTension(state.detection / 100);

  if (state.detection >= 100) endRound(false, 'spotted');
}

/* ------------------------------------------------------------------ *
 * Santa movement
 * ------------------------------------------------------------------ */

const keys = new Set();
let dragVec = { x: 0, z: 0 };
let dragPointer = null;
let dragStart = null;
let dragMoved = false;

function moveWithCollision(dx, dz) {
  const nx = player.x + dx;
  if (!collidesAt(nx, player.z)) player.x = clamp(nx, -9.4, 9.4);

  const nz = player.z + dz;
  if (!collidesAt(player.x, nz)) player.z = clamp(nz, -6.4, 6.4);
}

function cancelPlacing() {
  state.placing = null;
}

function updatePlayer(dt) {
  if (state.dash > 0) state.dash = Math.max(0, state.dash - dt);

  let mx = 0;
  let mz = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) mx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) mx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) mz -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) mz += 1;
  mx += dragVec.x;
  mz += dragVec.z;

  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const moving = len > 0.06;
  state.playerMoving = moving;

  if (state.hiding) {
    if (moving) {
      /* Shuffling inside a hiding spot gives you away: step out. */
      state.hiding = null;
      santa.group.visible = true;
      audio.unhide();
    }
    state.safeCloset = null;
    return;
  }

  if (moving && state.placing) cancelPlacing();

  if (state.placing) {
    state.placing.t += dt;
    if (state.placing.t >= state.placing.dur) {
      deliverPresent(state.placing.spot);
      state.placing = null;
    }
  }

  let speed = state.sneak ? SNEAK_SPEED : WALK_SPEED;
  if (state.dash > 0) speed = DASH_SPEED;
  speed *= 1 + (state.delivered / TOTAL_PRESENTS) * 0.08;
  if (state.placing) speed = 0;

  if (moving && speed > 0) {
    moveWithCollision(mx * speed * dt, mz * speed * dt);
    player.dir = turnToward(player.dir, Math.atan2(mz, mx), dt * 12);
    player.bob += dt * (speed + 1.2) * 2.6;
  } else {
    player.bob += dt * 1.4;
  }

  santa.group.position.set(player.x, moving ? Math.abs(Math.sin(player.bob)) * 0.05 : 0, player.z);
  santa.group.rotation.y = Math.PI / 2 - player.dir;
  santa.group.rotation.z = moving ? Math.sin(player.bob) * 0.03 : 0;

  /* Footsteps and the noise they make. */
  if (moving) {
    player.stepT -= dt;
    if (player.stepT <= 0) {
      const soft = state.sneak && state.dash <= 0;
      audio.step(soft);
      player.stepT = soft ? 0.68 : state.dash > 0 ? 0.24 : 0.42;
      noisePing(player.x, player.z, soft ? 0.05 : state.dash > 0 ? 0.32 : 0.15);
    }

    /* Creaky boards punish running through the hallway. */
    if (!state.sneak && state.dash <= 0) {
      const inCreak = CREAK_ZONES.some(
        (zone) =>
          player.x > zone.minX && player.x < zone.maxX && player.z > zone.minZ && player.z < zone.maxZ
      );
      if (inCreak) {
        player.creakT -= dt;
        if (player.creakT <= 0) {
          player.creakT = 1.0;
          audio.creak();
          noisePing(player.x, player.z, 0.45);
        }
      }
    }

    /* Squeaky toys. */
    if (!state.sneak) {
      toys.forEach((toy) => {
        if (toy.cool > 0) return;
        if (dist(player.x, player.z, toy.x, toy.z) < 0.62) {
          toy.cool = 2.2;
          audio.squeak();
          noisePing(player.x, player.z, 0.6);
          banner('SQUEAK!', 1200);
        }
      });
    }
  }

  /* Placement jingle and dash sparkle. */
  if (state.placing) {
    const before = Math.floor(state.placing.t / 0.5);
    const after = Math.floor((state.placing.t + dt) / 0.5);
    if (after > before) audio.jingle();
  }

  /* Safe-space closets: walk in and the house cannot see you at all. */
  const wasSafe = Boolean(state.safeCloset);
  state.safeCloset = safeClosetAt(player.x, player.z);
  if (state.safeCloset && !wasSafe) {
    audio.hide();
    banner('SAFE SPACE', 1400);
    announce(`You are tucked inside the ${state.safeCloset.label}. Nobody can see you in here.`);
  }
}

function updateToys(dt) {
  toys.forEach((toy) => {
    if (toy.cool > 0) toy.cool = Math.max(0, toy.cool - dt);
    const wobble = toy.cool > 0 ? Math.sin(toy.cool * 22) * 0.2 : 0;
    toy.group.rotation.z = wobble;
  });
}

/* ------------------------------------------------------------------ *
 * Agents
 * ------------------------------------------------------------------ */

function updateDad(dt) {
  let target;
  let speed = dad.speed;

  if (dad.state === 'chase') {
    target = { x: player.x, z: player.z };
    speed = 3.0;
    dad.chaseT -= dt;
    if (dad.chaseT <= 0) {
      dad.state = 'investigate';
      dad.inv = { x: player.x, z: player.z };
      dad.invT = 5;
    }
  } else if (dad.state === 'investigate') {
    target = dad.inv;
    speed = 2.4;
    dad.invT -= dt;
    if (dad.invT <= 0) {
      dad.state = 'patrol';
      dad.wait = 0.4;
    }
  } else {
    target = DAD_ROUTE[dad.idx];
    speed = 1.95;
  }

  const dx = target.x - dad.x;
  const dz = target.z - dad.z;
  const len = Math.hypot(dx, dz);
  const arrive = dad.state === 'patrol' ? 0.3 : 0.7;

  if (len > arrive) {
    const step = Math.min(speed * dt, len);
    dad.x += (dx / len) * step;
    dad.z += (dz / len) * step;
    dad.dir = turnToward(dad.dir, Math.atan2(dz, dx), dt * 5);
    dad.walk += dt * 7;
  } else if (dad.state === 'patrol') {
    dad.wait -= dt;
    if (dad.wait <= 0) {
      dad.idx = (dad.idx + 1) % DAD_ROUTE.length;
      dad.wait = 0.7;
    }
  } else {
    dad.dir += dt * 1.7;
  }

  dadRig.group.position.set(dad.x, Math.abs(Math.sin(dad.walk)) * 0.03, dad.z);
  dadRig.group.rotation.y = Math.PI / 2 - dad.dir;

  placeCone(dadRig.cone, dad.x, dad.z, dad.dir);
  dadRig.marker.position.set(dad.x, 2.0, dad.z);
}

function updateKid(dt) {
  if (kid.awake) {
    kid.awakeT -= dt;
    if (kid.awakeT <= 0) {
      kid.awake = false;
      setKidPose(false);
      kidCone.mesh.visible = false;
      kidMarker.visible = false;
      announce('The kid went back to sleep.');
    } else {
      const d = dist(player.x, player.z, kid.x, kid.z);
      const target = d < 7 ? Math.atan2(player.z - kid.z, player.x - kid.x) : Math.PI / 2;
      kid.dir = turnToward(kid.dir, target, dt * 3.5);
    }
  }

  kidRig.position.y = 0.72 + (kid.awake ? 0.04 + Math.sin(state.elapsed * 3) * 0.015 : 0);
  placeCone(kidCone, kid.x, kid.z, kid.dir);
  kidMarker.position.set(kid.x, 1.75, kid.z);
}

function updateDog(dt) {
  if (dog.barkCd > 0) dog.barkCd = Math.max(0, dog.barkCd - dt);

  const target = DOG_ROUTE[dog.idx];
  const dx = target.x - dog.x;
  const dz = target.z - dog.z;
  const len = Math.hypot(dx, dz);
  const curious = dist(player.x, player.z, dog.x, dog.z) < 3.2 && !state.hiding && !state.safeCloset;
  const speed = curious ? 2.5 : 1.55;

  if (len > 0.3) {
    const step = Math.min(speed * dt, len);
    dog.x += (dx / len) * step;
    dog.z += (dz / len) * step;
    dog.dir = turnToward(dog.dir, Math.atan2(dz, dx), dt * 6);
    dog.walk += dt * 9;
  } else {
    dog.idx = (dog.idx + 1) % DOG_ROUTE.length;
  }

  if (curious && dist(player.x, player.z, dog.x, dog.z) < 2.2) {
    dog.dir = turnToward(dog.dir, Math.atan2(player.z - dog.z, player.x - dog.x), dt * 5);
    if (dog.barkCd <= 0 && (state.playerMoving || state.noise > 0.15)) thinkBark();
  }

  dogRig.group.position.set(dog.x, Math.abs(Math.sin(dog.walk)) * 0.02, dog.z);
  dogRig.group.rotation.y = Math.PI / 2 - dog.dir;
  dogRig.tail.rotation.z = Math.sin(dog.walk * 1.6) * 0.5;
  dogRig.sniff.position.set(dog.x, 0.03, dog.z);
  dogRig.sniff.material.opacity = 0.08 + Math.sin(state.elapsed * 2.4) * 0.04;
}

function updateTreeLights(dt) {
  const sweep = Math.sin(state.elapsed * 0.42);
  treeLight.dir = Math.PI / 2 + sweep * 1.05;
  placeCone(treeCone, TREE_LIGHT.x, TREE_LIGHT.z, treeLight.dir);
  treeCone.material.opacity = 0.13 + (sweep * 0.5 + 0.5) * 0.06;
}

/* ------------------------------------------------------------------ *
 * Interaction
 * ------------------------------------------------------------------ */

function updateFocus() {
  if (state.hiding) {
    state.focus = { type: 'unhide' };
    return;
  }
  let best = null;
  let bestD = Infinity;

  HIDE_SPOTS.forEach((spot) => {
    const d = dist(player.x, player.z, spot.x, spot.z);
    if (d < 1.15 && d < bestD) {
      best = { type: 'hide', spot };
      bestD = d;
    }
  });

  if (!cookie.eaten) {
    const d = dist(player.x, player.z, COOKIE.x, COOKIE.z);
    if (d < COOKIE.r && d < bestD) {
      best = { type: 'cookie' };
      bestD = d;
    }
  }

  presentSpots.forEach((spot) => {
    if (spot.delivered) return;
    const d = dist(player.x, player.z, spot.x, spot.z);
    if (d < 1.15 && d < bestD) {
      best = { type: 'present', spot };
      bestD = d;
    }
  });

  if (state.delivered >= TOTAL_PRESENTS) {
    const d = dist(player.x, player.z, HEARTH.x, HEARTH.z);
    if (d < HEARTH.r && d < bestD + 0.25) {
      best = { type: 'escape' };
    }
  }

  state.focus = best;
}

function doAction() {
  if (state.phase !== 'play') return;

  if (state.hiding) {
    state.hiding = null;
    santa.group.visible = true;
    audio.unhide();
    announce('You slipped back into the room.');
    return;
  }

  if (state.placing) return;

  const focus = state.focus;
  if (!focus) {
    audio.uiClick();
    return;
  }

  if (focus.type === 'hide') {
    state.hiding = focus.spot;
    santa.group.visible = false;
    audio.hide();
    announce(`Hiding in the ${focus.spot.label}.`);
    return;
  }

  if (focus.type === 'cookie') {
    cookie.eaten = true;
    cookieGroup.visible = false;
    state.dash = 2.6;
    audio.munch();
    audio.dash();
    banner('SUGAR RUSH!', 1500);
    announce('Cookie eaten. Sugar-rush dash ready for a couple of seconds.');
    noisePing(player.x, player.z, 0.18);
    return;
  }

  if (focus.type === 'present') {
    state.placing = { spot: focus.spot, t: 0, dur: 1.5 };
    audio.jingle();
    return;
  }

  if (focus.type === 'escape') {
    audio.escape();
    endRound(true, 'escaped');
  }
}

function deliverPresent(spot) {
  if (spot.delivered) return;
  spot.delivered = true;
  state.delivered += 1;
  spot.gift.visible = true;
  spot.gift.position.set(rand(-0.08, 0.08), 0, rand(-0.08, 0.08));
  spot.gift.rotation.y = rand(0, TAU);
  spot.ringMat.color.setHex(0x65d46e);
  audio.placePresent(state.delivered - 1);
  audio.chime(state.delivered - 1);
  noisePing(player.x, player.z, 0.08);

  if (state.delivered >= TOTAL_PRESENTS) {
    banner('ALL PRESENTS DELIVERED', 2400);
    announce('All five presents are delivered. Get back to the fireplace.');
  } else {
    banner(`PRESENT ${state.delivered} OF ${TOTAL_PRESENTS}`, 1600);
    announce(`Present delivered ${spot.label}. ${TOTAL_PRESENTS - state.delivered} to go.`);
  }
  updateHud(true);
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

window.addEventListener('keydown', (event) => {
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) &&
    state.phase === 'play'
  ) {
    event.preventDefault();
  }
  keys.add(event.code);

  if (event.code === 'KeyM') {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    refreshMuteButton();
    try {
      window.localStorage.setItem(MUTE_KEY, audio.isMuted() ? '1' : '0');
    } catch (error) {
      /* ignore */
    }
    return;
  }

  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    state.sneak = true;
    sneakButton.classList.add('active');
  }

  if (event.code === 'Space' || event.code === 'KeyE') {
    if (state.phase === 'play') doAction();
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    state.sneak = false;
    sneakButton.classList.remove('active');
  }
});

window.addEventListener('blur', () => {
  keys.clear();
  dragVec = { x: 0, z: 0 };
  state.sneak = false;
  sneakButton.classList.remove('active');
});

const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (event) => {
  if (state.phase !== 'play') return;
  audio.unlock();
  dragPointer = event.pointerId;
  dragStart = { x: event.clientX, y: event.clientY };
  dragMoved = false;
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (dragPointer !== event.pointerId || !dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  const len = Math.hypot(dx, dy);
  if (len > 10) dragMoved = true;
  const dead = len < 14 ? 0 : 1;
  const scale = 42;
  dragVec = {
    x: dead ? clamp(dx / scale, -1, 1) : 0,
    z: dead ? clamp((dy / scale) * 1.15, -1, 1) : 0,
  };
});

const endDrag = (event) => {
  if (dragPointer !== event.pointerId) return;
  if (!dragMoved && state.phase === 'play') doAction();
  dragPointer = null;
  dragStart = null;
  dragVec = { x: 0, z: 0 };
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

const toggleSneak = () => {
  if (state.phase !== 'play') return;
  audio.unlock();
  state.sneak = !state.sneak;
  sneakButton.classList.toggle('active', state.sneak);
  sneakButton.setAttribute('aria-pressed', String(state.sneak));
  audio.uiClick();
};

sneakButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  toggleSneak();
});

actionButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  audio.unlock();
  doAction();
});

if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
  touchControls.hidden = false;
}

/* ------------------------------------------------------------------ *
 * Ambient animation
 * ------------------------------------------------------------------ */

function animateAmbient(dt) {
  const flicker = 0.82 + Math.sin(state.elapsed * 11) * 0.08 + Math.sin(state.elapsed * 23) * 0.05;
  fireLight.intensity = 15 * flicker;
  flames.forEach((flame, index) => {
    const wobble = Math.sin(state.elapsed * (6 + index * 1.7) + index) * 0.14;
    flame.scale.set(1 + wobble * 0.4, 1 + wobble, 1 + wobble * 0.4);
    flame.position.y = 0.3 + index * 0.05 + wobble * 0.05;
  });

  starMesh.rotation.y += dt * 0.8;
  starMesh.scale.setScalar(1 + Math.sin(state.elapsed * 2.2) * 0.06);

  treeGlow.intensity = 6 + Math.sin(state.elapsed * 2.6) * 1.8;
  bulbMats.forEach((mat, index) => {
    const on = Math.sin(state.elapsed * 2.4 + index * 1.7) > -0.2;
    mat.color.setHex(on ? 0xffe9a8 : 0x5a4a3a);
  });

  presentSpots.forEach((spot) => {
    if (spot.delivered) return;
    const pulse = 0.5 + Math.sin(state.elapsed * 3 + spot.phase) * 0.22;
    spot.ringMat.opacity = pulse;
    spot.ring.scale.setScalar(1 + Math.sin(state.elapsed * 3 + spot.phase) * 0.07);
  });

  hideMarkers.forEach(({ marker }) => {
    marker.material.opacity = 0.18 + Math.sin(state.elapsed * 2) * 0.08;
  });

  safeClosets.forEach((closet) => {
    const occupied = state.safeCloset === closet;
    closet.glow.material.opacity = occupied
      ? 0.32 + Math.sin(state.elapsed * 5) * 0.08
      : 0.13 + Math.sin(state.elapsed * 2.4) * 0.04;
    closet.glow.material.color.setHex(occupied ? 0x8affc1 : 0x4fd6a0);
  });

  hearthRing.material.opacity = state.delivered >= TOTAL_PRESENTS ? 0.5 + Math.sin(state.elapsed * 5) * 0.25 : 0.28;
  if (state.delivered >= TOTAL_PRESENTS) hearthRing.material.color.setHex(0x8affc1);
  else hearthRing.material.color.setHex(0xffb066);

  if (state.bannerT > 0) {
    state.bannerT -= dt;
    if (state.bannerT <= 0) bannerEl.classList.remove('show');
  }
}

/* ------------------------------------------------------------------ *
 * Camera follow
 * ------------------------------------------------------------------ */

function updateCamera(dt) {
  const targetX = followCamera ? player.x : 0;
  /* Bias the follow view into the house so the frame is not half night sky. */
  const targetZ = followCamera ? clamp(player.z + 2.6, -3.4, 3.2) : -0.4;
  const ease = 1 - Math.exp(-6 * dt);
  camFocus.x = lerp(camFocus.x, targetX, ease);
  camFocus.z = lerp(camFocus.z, targetZ, ease);
  camera.position.set(camFocus.x, CAM_OFFSET.y, camFocus.z + CAM_OFFSET.z);
  camera.lookAt(camFocus.x, 0.4, camFocus.z);
}

/* ------------------------------------------------------------------ *
 * Loop
 * ------------------------------------------------------------------ */

function update(dt) {
  if (state.phase === 'play') {
    state.elapsed += dt;
    state.timeLeft -= dt;
    state.noise = Math.max(0, state.noise - dt * 0.55);

    updatePlayer(dt);
    updateToys(dt);
    updateDad(dt);
    updateKid(dt);
    updateDog(dt);
    updateTreeLights(dt);
    updateDetection(dt);
    updateFocus();
    updateHud();

    if (state.phase === 'play' && state.timeLeft <= 0) endRound(false, 'sunrise');
  } else if (state.phase === 'menu') {
    state.elapsed += dt;
    updateDad(dt * 0.35);
    updateDog(dt * 0.35);
    updateTreeLights(dt * 0.6);
    updateKid(dt);
  }

  animateAmbient(dt);
  updateCamera(dt);
}

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  autoPause.sync();
  if (autoPause.paused) {
    requestAnimationFrame(frame);
    return;
  }

  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

sizeScene();
window.addEventListener('resize', sizeScene);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(sizeScene).observe(container);
}

/* Menu poses so the house looks alive before the first delivery. */
santa.group.position.set(player.x, 0, player.z);
santa.group.rotation.y = Math.PI / 2 - player.dir;
placeCone(dadRig.cone, dad.x, dad.z, dad.dir);
placeCone(kidCone, kid.x, kid.z, kid.dir);
kidCone.mesh.visible = false;
cookieGroup.visible = true;
updateHud(true);

if (bestScore > 0) {
  announce(`Best score so far: ${bestScore}. Spooky Santa is ready.`);
}

requestAnimationFrame(frame);
