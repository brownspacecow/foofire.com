import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Bear the Puppy
 * A cosy three.js pet-care game. Bear is a black and white Shih Tzu.
 * ------------------------------------------------------------------ */

// ------------------------------------------------------------------ DOM
const container = document.querySelector('#game-container');
const statusEl = document.querySelector('#status');
const speechEl = document.querySelector('#speech');
const bannerEl = document.querySelector('#banner');
const bannerLabel = bannerEl.querySelector('span');
const moodEmojiEl = document.querySelector('#mood-emoji');
const moodLabelEl = document.querySelector('#mood-label');
const scoreEl = document.querySelector('#care-score');

const needEls = {};
document.querySelectorAll('.need').forEach((el) => {
  needEls[el.dataset.need] = { root: el, fill: el.querySelector('.need-fill') };
});

const buttons = {
  feed: document.querySelector('#feed-button'),
  water: document.querySelector('#water-button'),
  fetch: document.querySelector('#fetch-button'),
  pet: document.querySelector('#pet-button'),
  sleep: document.querySelector('#sleep-button'),
  reset: document.querySelector('#reset-button'),
};

// --------------------------------------------------------------- world
const SPOTS = {
  home: { x: 0, z: 0.7 },
  foodBowl: { x: 1.45, z: -1.15 },
  foodStand: { x: 1.45, z: -0.42 },
  waterBowl: { x: 2.1, z: -0.45 },
  waterStand: { x: 2.1, z: 0.28 },
  bed: { x: -1.9, z: -0.9 },
  bedStand: { x: -1.9, z: -0.08 },
  ballHome: { x: -0.5, z: 1.3 },
};

const CAM_OFFSET = new THREE.Vector3(2.5, 3.1, 6.7);
const CAM_TARGET = new THREE.Vector3(0.2, 1.05, 0);
const ROOM = { back: -4.6, left: -5.4 };

// --------------------------------------------------------------- state
const needs = { fullness: 70, hydration: 70, happiness: 70, energy: 70 };

const state = {
  time: 0,
  score: 0,
  mode: 'idle', // idle | walk | eat | drink | sleep
  modeTimer: 0,
  walk: null,
  walkAfter: null,
  targetYaw: 0,
  idleAt: 2.5,
  sleeping: false,
  petting: 0,
  blinkAt: 2,
  blinkUntil: 0,
  messageUntil: 0,
  nextSpeechAt: 0,
  hudAt: 0,
  hovered: null,
  ballCarried: false,
  ballFlight: null,
  fetchStage: null,
  fetchAt: 0,
  celebrationAt: -100,
  pointerDown: null,
  camScale: 1,
};

let scene;
let camera;
let renderer;
let bear;
let ball;
let foodBowl;
let waterBowl;
let bed;
let waterSurface;
let hoverRing;
let kibbleGroup;
let heartTexture;
let sparkleTexture;
let mouthAnchor;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickables = [];
const effects = [];
const parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
let walkPhase = 0;
let walkBlend = 0;
const tmpVec = new THREE.Vector3();
const clock = new THREE.Clock();

// ------------------------------------------------------------- helpers
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);

function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function say(text, seconds = 3.2) {
  speechEl.textContent = text;
  statusEl.textContent = text;
  state.messageUntil = state.time + seconds;
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function faceThePlayer() {
  if (!bear || !camera) return;
  state.targetYaw = Math.atan2(
    camera.position.x - bear.position.x,
    camera.position.z - bear.position.z
  );
}

function meshBox(width, height, depth, material, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// -------------------------------------------------------------- textures
function createWoodTexture() {
  const texture = makeCanvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#c9a273';
    ctx.fillRect(0, 0, s, s);
    const rows = 4;
    const rowHeight = s / rows;
    const shades = ['#cda77a', '#c39b6b', '#d1ab7f', '#c69f70'];
    for (let row = 0; row < rows; row += 1) {
      ctx.fillStyle = shades[row % shades.length];
      ctx.fillRect(0, row * rowHeight, s, rowHeight);
      ctx.strokeStyle = 'rgba(105,72,44,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, row * rowHeight + 1);
      ctx.lineTo(s, row * rowHeight + 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(118,82,50,0.16)';
      ctx.lineWidth = 1;
      for (let grain = 0; grain < 7; grain += 1) {
        const gy = row * rowHeight + rand(10, rowHeight - 10);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(s * 0.3, gy + rand(-5, 5), s * 0.7, gy + rand(-5, 5), s, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(105,72,44,0.3)';
      ctx.beginPath();
      ctx.moveTo(rand(60, s - 60), row * rowHeight);
      ctx.lineTo(rand(60, s - 60), (row + 1) * rowHeight);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createSkyTexture() {
  return makeCanvasTexture(512, (ctx, s) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, s);
    gradient.addColorStop(0, '#8ec8f0');
    gradient.addColorStop(1, '#e9f6ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const cloud = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 0.9, y + r * 0.15, r * 0.75, 0, Math.PI * 2);
      ctx.arc(x - r * 0.9, y + r * 0.2, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    };
    cloud(s * 0.3, s * 0.3, s * 0.09);
    cloud(s * 0.72, s * 0.52, s * 0.07);
  });
}

function createPawTexture() {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#fdf4e5';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#b47a56';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.62, s * 0.17, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    const toes = [
      [0.3, 0.4, 0.075],
      [0.5, 0.32, 0.08],
      [0.7, 0.4, 0.075],
      [0.22, 0.56, 0.065],
      [0.78, 0.56, 0.065],
    ];
    toes.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(s * x, s * y, s * r, s * r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function createHeartTexture() {
  return makeCanvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#ff5d86';
    ctx.beginPath();
    const cx = s * 0.5;
    const top = s * 0.28;
    const bottom = s * 0.86;
    ctx.moveTo(cx, bottom);
    ctx.bezierCurveTo(s * 0.06, s * 0.6, s * 0.12, top, s * 0.33, top);
    ctx.bezierCurveTo(s * 0.44, top, cx, s * 0.4, cx, s * 0.4);
    ctx.bezierCurveTo(cx, s * 0.4, s * 0.56, top, s * 0.67, top);
    ctx.bezierCurveTo(s * 0.88, top, s * 0.94, s * 0.6, cx, bottom);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(s * 0.38, s * 0.4, s * 0.055, s * 0.04, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createSparkleTexture() {
  return makeCanvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    const cx = s / 2;
    const cy = s / 2;
    const outer = s * 0.46;
    const inner = s * 0.1;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? outer : inner;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
}

// ---------------------------------------------------------------- setup
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8ead7);
  scene.fog = new THREE.Fog(0xf8ead7, 16, 30);

  camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 60);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    'aria-label',
    'A cosy 3D room with Bear, a black and white Shih Tzu puppy.'
  );

  heartTexture = createHeartTexture();
  sparkleTexture = createSparkleTexture();

  addLights();
  buildRoom();
  buildProps();
  buildBear();

  hoverRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  hoverRing.rotation.x = -Math.PI / 2;
  hoverRing.position.y = 0.035;
  hoverRing.visible = false;
  scene.add(hoverRing);

  bindEvents();
  resetGame();
  resize();
  animate();
}

function addLights() {
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x8a6d50, 0.85);
  scene.add(hemi);

  const warm = new THREE.DirectionalLight(0xfff1d8, 2);
  warm.position.set(4.5, 8, 5.5);
  warm.castShadow = true;
  const shadowSize = window.innerWidth < 720 ? 1024 : 2048;
  warm.shadow.mapSize.set(shadowSize, shadowSize);
  warm.shadow.camera.near = 1;
  warm.shadow.camera.far = 26;
  warm.shadow.camera.left = -7;
  warm.shadow.camera.right = 7;
  warm.shadow.camera.top = 7;
  warm.shadow.camera.bottom = -7;
  warm.shadow.bias = -0.0004;
  warm.shadow.normalBias = 0.02;
  scene.add(warm);

  const cool = new THREE.DirectionalLight(0xd7e8ff, 0.55);
  cool.position.set(-6, 5, 4);
  scene.add(cool);

  const windowGlow = new THREE.PointLight(0xfff3d0, 6, 9, 2);
  windowGlow.position.set(-1, 3.4, -3.9);
  scene.add(windowGlow);
}

// ----------------------------------------------------------------- room
function buildRoom() {
  const wood = createWoodTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e6cf, roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), wallMaterial);
  backWall.position.set(0, 3.5, ROOM.back);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), wallMaterial);
  leftWall.position.set(ROOM.left, 3.5, -0.5);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xfffaf1, roughness: 0.7 });
  scene.add(meshBox(16, 0.34, 0.12, trimMaterial, 0, 0.17, ROOM.back + 0.06));
  scene.add(meshBox(0.12, 0.34, 16, trimMaterial, ROOM.left + 0.06, 0.17, -0.5));

  // rug
  const rugOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.55, 0.035, 64),
    new THREE.MeshStandardMaterial({ color: 0xc3d7ca, roughness: 1 })
  );
  rugOuter.position.set(0, 0.018, 0.3);
  rugOuter.receiveShadow = true;
  scene.add(rugOuter);

  const rugMiddle = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.045, 64),
    new THREE.MeshStandardMaterial({ color: 0xd8e6dc, roughness: 1 })
  );
  rugMiddle.position.set(0, 0.026, 0.3);
  rugMiddle.receiveShadow = true;
  scene.add(rugMiddle);

  const rugInner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.62, 0.055, 64),
    new THREE.MeshStandardMaterial({ color: 0xb6cdbf, roughness: 1 })
  );
  rugInner.position.set(0, 0.033, 0.3);
  rugInner.receiveShadow = true;
  scene.add(rugInner);

  buildWindow();
  buildWallArt();
}

function buildWindow() {
  const group = new THREE.Group();
  group.position.set(-1.05, 3.35, ROOM.back + 0.02);
  scene.add(group);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.65 });
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2),
    new THREE.MeshBasicMaterial({ map: createSkyTexture() })
  );
  sky.position.z = 0.03;
  group.add(sky);

  group.add(meshBox(2.78, 2.28, 0.1, frameMaterial, 0, 0, -0.02));
  group.add(meshBox(0.08, 2, 0.06, frameMaterial, 0, 0, 0.06));
  group.add(meshBox(2.5, 0.08, 0.06, frameMaterial, 0, 0, 0.06));
  group.add(meshBox(2.95, 0.12, 0.26, frameMaterial, 0, -1.18, 0.08));

  const curtainMaterial = new THREE.MeshStandardMaterial({ color: 0xe9c9ae, roughness: 1 });
  const leftCurtain = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 2.2, 8, 16), curtainMaterial);
  leftCurtain.position.set(-1.62, 0.05, 0.12);
  leftCurtain.scale.z = 0.45;
  leftCurtain.castShadow = true;
  group.add(leftCurtain);
  const rightCurtain = leftCurtain.clone();
  rightCurtain.position.x = 1.62;
  group.add(rightCurtain);
}

function buildWallArt() {
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: createPawTexture() })
  );
  art.position.set(2.2, 3.15, ROOM.back + 0.055);
  scene.add(art);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5f3e, roughness: 0.7 });
  const frame = meshBox(1.04, 1.04, 0.06, frameMaterial, 2.2, 3.15, ROOM.back + 0.01);
  scene.add(frame);

  const smallArt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: createPawTexture() })
  );
  smallArt.position.set(ROOM.left + 0.055, 3.4, -2.7);
  smallArt.rotation.y = Math.PI / 2;
  scene.add(smallArt);
  const smallFrame = meshBox(0.82, 0.82, 0.06, frameMaterial, ROOM.left + 0.01, 3.4, -2.7, Math.PI / 2);
  scene.add(smallFrame);
}

function buildProps() {
  buildBed();
  buildBowls();
  buildBall();
  buildPlant();
  buildBone();
}

function buildBed() {
  const group = new THREE.Group();
  group.position.set(SPOTS.bed.x, 0, SPOTS.bed.z);
  group.rotation.y = 0.4;
  scene.add(group);

  const cushion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0xf3e3c8, roughness: 1 })
  );
  cushion.position.y = 0.12;
  cushion.receiveShadow = true;
  group.add(cushion);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.22, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0x6f93bd, roughness: 1 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.25;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xdba8a2, roughness: 1 })
  );
  blanket.position.set(0.18, 0.26, 0.05);
  blanket.rotation.y = -0.25;
  blanket.castShadow = true;
  group.add(blanket);

  group.userData.action = 'sleep';
  group.userData.hoverRadius = 1;
  clickables.push(group);
  bed = group;
}

function makeBowl(color, position) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const bowlMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.24, 28), bowlMaterial);
  bowl.position.y = 0.12;
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.04, 10, 28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.24;
  group.add(rim);

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.04, 28),
    new THREE.MeshStandardMaterial({ color: 0x3d3430, roughness: 0.8 })
  );
  inner.position.y = 0.225;
  group.add(inner);

  scene.add(group);
  return group;
}

function buildBowls() {
  foodBowl = makeBowl(0xc64f43, SPOTS.foodBowl);
  foodBowl.userData.action = 'feed';
  foodBowl.userData.hoverRadius = 0.7;
  clickables.push(foodBowl);

  kibbleGroup = new THREE.Group();
  const kibbleMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.9 });
  const kibbleGeo = new THREE.SphereGeometry(0.055, 8, 6);
  for (let i = 0; i < 18; i += 1) {
    const piece = new THREE.Mesh(kibbleGeo, kibbleMaterial);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.2;
    piece.position.set(Math.cos(angle) * radius, 0.26 + Math.random() * 0.06, Math.sin(angle) * radius);
    piece.scale.set(1, 0.7, 1.2);
    kibbleGroup.add(piece);
  }
  foodBowl.add(kibbleGroup);

  waterBowl = makeBowl(0x4c93c9, SPOTS.waterBowl);
  waterBowl.userData.action = 'water';
  waterBowl.userData.hoverRadius = 0.7;
  clickables.push(waterBowl);

  waterSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.27, 28),
    new THREE.MeshStandardMaterial({
      color: 0x8fd5f5,
      transparent: true,
      opacity: 0.85,
      roughness: 0.15,
      metalness: 0.1,
    })
  );
  waterSurface.rotation.x = -Math.PI / 2;
  waterSurface.position.y = 0.245;
  waterBowl.add(waterSurface);
}

function buildBall() {
  ball = new THREE.Group();
  ball.position.set(SPOTS.ballHome.x, 0.24, SPOTS.ballHome.z);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xd9e05e, roughness: 0.6 })
  );
  body.castShadow = true;
  ball.add(body);

  const seam = new THREE.Mesh(
    new THREE.TorusGeometry(0.215, 0.017, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xfffdf2, roughness: 0.6 })
  );
  seam.rotation.x = Math.PI / 2.4;
  ball.add(seam);

  ball.userData.action = 'fetch';
  ball.userData.hoverRadius = 0.7;
  clickables.push(ball);
  scene.add(ball);
}

function buildPlant() {
  const group = new THREE.Group();
  group.position.set(-3.9, 0, -3.2);
  scene.add(group);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.28, 0.55, 20),
    new THREE.MeshStandardMaterial({ color: 0xb56747, roughness: 0.9 })
  );
  pot.position.y = 0.28;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0x5b4028, roughness: 1 })
  );
  soil.position.y = 0.55;
  group.add(soil);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x5f9a5b, roughness: 0.85 });
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), leafMaterial);
    leaf.scale.set(0.55, 1.5, 0.4);
    leaf.position.set(Math.cos(angle) * 0.26, 0.95 + rand(-0.12, 0.22), Math.sin(angle) * 0.26);
    leaf.rotation.set(rand(-0.4, 0.4), angle, rand(-0.5, 0.5));
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function buildBone() {
  const group = new THREE.Group();
  group.position.set(-3.1, 0.12, 0.5);
  group.rotation.y = 0.7;
  const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e5cf, roughness: 0.8 });
  const middle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), boneMaterial);
  middle.rotation.z = Math.PI / 2;
  group.add(middle);
  [-0.22, 0.22].forEach((x) => {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), boneMaterial);
    knob.position.set(x, 0.03, 0);
    group.add(knob);
    const knob2 = knob.clone();
    knob2.position.y = -0.03;
    group.add(knob2);
  });
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(group);
}

// ----------------------------------------------------------------- bear
function buildBear() {
  bear = new THREE.Group();
  bear.position.set(SPOTS.home.x, 0, SPOTS.home.z);
  bear.rotation.y = 0.25;
  bear.userData.action = 'pet';
  bear.userData.hoverRadius = 1.15;
  scene.add(bear);
  clickables.push(bear);

  const furWhite = new THREE.MeshStandardMaterial({ color: 0xf9f4ea, roughness: 0.96 });
  const furBlack = new THREE.MeshStandardMaterial({ color: 0x2b2723, roughness: 0.96 });
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.35 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.1 });
  const tongueMaterial = new THREE.MeshStandardMaterial({ color: 0xea7b8c, roughness: 0.65 });
  const collarMaterial = new THREE.MeshStandardMaterial({ color: 0xc23630, roughness: 0.5 });
  const tagMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5c34f,
    metalness: 0.65,
    roughness: 0.3,
  });
  const fluffGeo = new THREE.SphereGeometry(1, 12, 10);

  const fluff = (parent, x, y, z, radius, material = furWhite, sx = 1, sy = 1, sz = 1) => {
    const tuft = new THREE.Mesh(fluffGeo, material);
    tuft.position.set(x, y, z);
    tuft.scale.set(radius * sx, radius * sy, radius * sz);
    tuft.castShadow = true;
    parent.add(tuft);
    return tuft;
  };

  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.78, 0);
  bear.add(bodyPivot);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), furWhite);
  torso.scale.set(1.05, 0.9, 1.32);
  torso.position.set(0, 0.02, -0.02);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  fluff(bodyPivot, 0, 0.02, 0.48, 0.32, furWhite, 1.1, 0.95, 0.75);
  fluff(bodyPivot, 0.2, -0.16, 0.44, 0.17);
  fluff(bodyPivot, -0.2, -0.16, 0.44, 0.17);
  [
    [0.43, 0.02, 0.32, 0.19],
    [-0.43, 0.02, 0.32, 0.19],
    [0.46, -0.02, -0.12, 0.17],
    [-0.46, -0.02, -0.12, 0.17],
    [0.35, 0.06, -0.58, 0.18],
    [-0.35, 0.06, -0.58, 0.18],
    [0, 0.22, -0.6, 0.18],
  ].forEach(([x, y, z, radius]) => fluff(bodyPivot, x, y, z, radius));

  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), furBlack);
  saddle.scale.set(1, 0.74, 1.14);
  saddle.position.set(0, 0.24, -0.12);
  saddle.castShadow = true;
  bodyPivot.add(saddle);
  [
    [0.2, 0.5, 0.24, 0.13],
    [-0.2, 0.5, 0.24, 0.13],
    [0.26, 0.52, -0.08, 0.14],
    [-0.26, 0.52, -0.08, 0.14],
    [0.14, 0.54, -0.42, 0.13],
    [-0.14, 0.54, -0.42, 0.13],
  ].forEach(([x, y, z, radius]) => fluff(bodyPivot, x, y, z, radius, furBlack));

  // collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.275, 0.13, 24, 1, true),
    collarMaterial
  );
  collar.position.set(0, 0.32, 0.48);
  collar.rotation.x = 0.48;
  collar.castShadow = true;
  bodyPivot.add(collar);
  const tag = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), tagMaterial);
  tag.scale.set(1, 1.25, 0.6);
  tag.position.set(0, 0.19, 0.7);
  bodyPivot.add(tag);

  // tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.16, -0.64);
  bodyPivot.add(tailPivot);
  fluff(tailPivot, 0, 0.08, -0.1, 0.14, furBlack);
  fluff(tailPivot, 0.02, 0.24, -0.08, 0.13, furBlack);
  fluff(tailPivot, 0.01, 0.38, 0.0, 0.115, furBlack);
  fluff(tailPivot, 0, 0.44, 0.12, 0.095, furBlack);

  // head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.52, 0.5);
  bodyPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 22), furWhite);
  head.scale.set(1.02, 1, 0.98);
  head.position.y = 0.02;
  head.castShadow = true;
  head.receiveShadow = true;
  headPivot.add(head);

  fluff(headPivot, 0.31, -0.12, 0.06, 0.2, furWhite, 1, 0.9, 0.8);
  fluff(headPivot, -0.31, -0.12, 0.06, 0.2, furWhite, 1, 0.9, 0.8);

  // black eye patches
  [0.155, -0.155].forEach((x) => {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), furBlack);
    patch.position.set(x, 0.07, 0.32);
    patch.scale.set(1.1, 1.02, 0.55);
    patch.castShadow = true;
    headPivot.add(patch);
  });

  const eyes = [];
  [1, -1].forEach((side) => {
    const eye = new THREE.Group();
    eye.position.set(0.155 * side, 0.075, 0.4);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), eyeMaterial);
    eye.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), pupilMaterial);
    pupil.position.set(0, 0, 0.058);
    eye.add(pupil);
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(0.022 * side, 0.026, 0.1);
    eye.add(glint);
    headPivot.add(eye);
    eyes.push(eye);
  });

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), furWhite);
  muzzle.scale.set(1.22, 0.85, 0.9);
  muzzle.position.set(0, -0.15, 0.31);
  muzzle.castShadow = true;
  headPivot.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.086, 16, 12), noseMaterial);
  nose.scale.set(1.25, 0.85, 0.8);
  nose.position.set(0, -0.055, 0.54);
  headPivot.add(nose);

  const tonguePivot = new THREE.Group();
  tonguePivot.position.set(0, -0.26, 0.46);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), tongueMaterial);
  tongue.scale.set(1, 0.45, 1.25);
  tongue.position.set(0, -0.01, 0.045);
  tonguePivot.add(tongue);
  tonguePivot.scale.setScalar(0.01);
  headPivot.add(tonguePivot);

  // ears
  const ears = [];
  const earGeo = new THREE.CapsuleGeometry(0.13, 0.32, 6, 12);
  [1, -1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.36 * side, 0.16, -0.02);
    pivot.rotation.z = 0.28 * side;
    const ear = new THREE.Mesh(earGeo, furBlack);
    ear.position.y = -0.2;
    ear.castShadow = true;
    pivot.add(ear);
    fluff(pivot, 0, -0.4, 0.02, 0.14, furBlack);
    headPivot.add(pivot);
    ears.push(pivot);
  });

  // top knot
  fluff(headPivot, 0, 0.41, 0.02, 0.18, furWhite);
  fluff(headPivot, 0.11, 0.45, 0.08, 0.12, furWhite);
  fluff(headPivot, -0.1, 0.43, -0.02, 0.11, furBlack);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.026, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x4a8bd6, roughness: 0.5 })
  );
  band.position.set(0, 0.35, 0.02);
  band.rotation.x = Math.PI / 2;
  headPivot.add(band);

  // legs
  const legs = [];
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.24, 6, 12);
  const pawGeo = new THREE.SphereGeometry(0.145, 14, 10);
  [
    [0.3, 0.36],
    [-0.3, 0.36],
    [0.32, -0.42],
    [-0.32, -0.42],
  ].forEach(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.22, z);
    const leg = new THREE.Mesh(legGeo, furWhite);
    leg.position.y = -0.18;
    leg.castShadow = true;
    pivot.add(leg);
    const paw = new THREE.Mesh(pawGeo, furWhite);
    paw.position.set(0, -0.4, 0.03);
    paw.castShadow = true;
    pivot.add(paw);
    bodyPivot.add(pivot);
    legs.push(pivot);
  });

  // invisible points used for effects / carrying the ball
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 0.3, 0.1);
  headPivot.add(headAnchor);

  mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, -0.22, 0.56);
  headPivot.add(mouthAnchor);

  bear.userData.parts = {
    bodyPivot,
    headPivot,
    ears,
    eyes,
    legs,
    tailPivot,
    tonguePivot,
    headAnchor,
  };

  bear.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
}

// -------------------------------------------------------------- effects
function spawnBurst(kind, position, count = 5) {
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: kind === 'heart' ? heartTexture : sparkleTexture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position
      .copy(position)
      .add(new THREE.Vector3(rand(-0.35, 0.35), rand(-0.1, 0.35), rand(-0.35, 0.35)));
    const size = rand(0.16, 0.3);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    const life = rand(0.9, 1.5);
    effects.push({
      sprite,
      life,
      maxLife: life,
      velocity: new THREE.Vector3(rand(-0.35, 0.35), rand(0.75, 1.4), rand(-0.25, 0.25)),
    });
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    if (effect.life <= 0) {
      scene.remove(effect.sprite);
      effect.sprite.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    effect.sprite.position.addScaledVector(effect.velocity, dt);
    effect.velocity.y += 0.25 * dt;
    const progress = effect.life / effect.maxLife;
    effect.sprite.material.opacity = Math.min(1, progress * 1.6);
    const scale = effect.sprite.scale.x + dt * 0.08;
    effect.sprite.scale.set(scale, scale, 1);
  }
}

function headWorldPosition() {
  if (!bear) return new THREE.Vector3();
  bear.userData.parts.headAnchor.getWorldPosition(tmpVec);
  return tmpVec.clone();
}

// ------------------------------------------------------------- actions
function wakeUp(silent = true) {
  if (!state.sleeping) return;
  state.sleeping = false;
  state.mode = 'idle';
  state.idleAt = state.time + 2;
  if (!silent) say('I am awake! 🐾', 2);
}

function cancelFetch() {
  if (!state.fetchStage) return;
  state.fetchStage = null;
  if (state.ballCarried) {
    state.ballCarried = false;
    placeBallInFront();
  }
}

function placeBallInFront() {
  if (!ball || !bear) return;
  const forward = new THREE.Vector3(Math.sin(bear.rotation.y), 0, Math.cos(bear.rotation.y));
  ball.position.copy(bear.position).addScaledVector(forward, 0.65);
  ball.position.y = 0.24;
}

function startWalk(x, z, after = null) {
  state.mode = 'walk';
  state.walk = { x, z };
  state.walkAfter = after;
  state.idleAt = state.time + 4;
}

function beginFeed() {
  if (needs.fullness > 92) {
    say('I am too full for kibble! 🐾', 2.6);
    return;
  }
  wakeUp();
  cancelFetch();
  startWalk(SPOTS.foodStand.x, SPOTS.foodStand.z, startEating);
  say('Here comes breakfast! 🍖', 1.8);
  state.targetYaw = Math.PI;
}

function startEating() {
  state.mode = 'eat';
  state.modeTimer = 0;
  state.targetYaw = Math.atan2(SPOTS.foodBowl.x - bear.position.x, SPOTS.foodBowl.z - bear.position.z);
  say('Nom nom nom… 🍖', 2.4);
}

function finishEating() {
  needs.fullness = clamp(needs.fullness + 42);
  needs.happiness = clamp(needs.happiness + 5);
  state.score += 5;
  spawnBurst('sparkle', new THREE.Vector3(SPOTS.foodBowl.x, 0.45, SPOTS.foodBowl.z), 7);
  say('That was delicious! 🍖', 3);
  state.mode = 'idle';
  state.modeTimer = 0;
  state.idleAt = state.time + 3;
  faceThePlayer();
}

function beginDrink() {
  if (needs.hydration > 92) {
    say('I have had plenty of water! 💧', 2.6);
    return;
  }
  wakeUp();
  cancelFetch();
  startWalk(SPOTS.waterStand.x, SPOTS.waterStand.z, startDrinking);
  say('Fresh water time! 💧', 1.8);
  state.targetYaw = Math.PI;
}

function startDrinking() {
  state.mode = 'drink';
  state.modeTimer = 0;
  state.targetYaw = Math.atan2(SPOTS.waterBowl.x - bear.position.x, SPOTS.waterBowl.z - bear.position.z);
  say('Slurp slurp… 💧', 2.4);
}

function finishDrinking() {
  needs.hydration = clamp(needs.hydration + 46);
  needs.happiness = clamp(needs.happiness + 3);
  state.score += 4;
  spawnBurst('sparkle', new THREE.Vector3(SPOTS.waterBowl.x, 0.45, SPOTS.waterBowl.z), 7);
  say('So refreshing! 💧', 3);
  state.mode = 'idle';
  state.modeTimer = 0;
  state.idleAt = state.time + 3;
  faceThePlayer();
}

function beginPet() {
  wakeUp();
  needs.happiness = clamp(needs.happiness + (state.petting > 0 ? 4 : 11));
  needs.energy = clamp(needs.energy + 1);
  state.score += state.petting > 0 ? 1 : 3;
  state.petting = 1.9;
  spawnBurst('heart', headWorldPosition(), 6);
  const lines = [
    'Aww, that is the spot! 💕',
    'I love you! 🐾',
    'More scratches, please!',
    'You are the best! 💗',
  ];
  say(lines[Math.floor(Math.random() * lines.length)], 2.4);
}

function beginSleep() {
  if (state.sleeping) {
    say('Zzz… 💤', 2);
    return;
  }
  if (needs.energy > 95) {
    say('I am not sleepy yet! 🐾', 2.6);
    return;
  }
  cancelFetch();
  startWalk(SPOTS.bedStand.x, SPOTS.bedStand.z, startSleeping);
  state.targetYaw = Math.atan2(SPOTS.bed.x - SPOTS.bedStand.x, SPOTS.bed.z - SPOTS.bedStand.z);
  say('Bedtime, Bear! 🛏️', 1.8);
}

function startSleeping() {
  state.mode = 'sleep';
  state.sleeping = true;
  state.modeTimer = 0;
  say('Zzz… 💤', 5);
}

function beginFetch() {
  if (!ball || state.fetchStage) return;
  if (state.ballFlight) return;
  if (needs.energy < 15) {
    say('I am too sleepy to fetch… 😴', 2.6);
    return;
  }
  wakeUp();
  needs.happiness = clamp(needs.happiness + 2);
  state.fetchStage = 'wait';
  state.fetchAt = state.time + 0.9;
  state.targetYaw = Math.atan2(ball.position.x - bear.position.x, ball.position.z - bear.position.z);
  state.ballFlight = {
    from: ball.position.clone(),
    to: new THREE.Vector3(rand(-2.2, 2.5), 0.24, rand(-2.2, 2.1)),
    t: 0,
    duration: 0.8,
  };
  spawnBurst('sparkle', ball.position.clone().setY(0.5), 4);
  say('Fetch, Bear, fetch! 🎾', 2);
}

function pickUpBall() {
  if (state.fetchStage !== 'run') return;
  state.ballCarried = true;
  needs.happiness = clamp(needs.happiness + 5);
  spawnBurst('heart', headWorldPosition(), 3);
  say('Got it! Bring it back! 🎾', 2);
  state.fetchStage = 'return';
  startWalk(SPOTS.home.x, SPOTS.home.z, finishFetch);
}

function finishFetch() {
  if (state.fetchStage !== 'return') return;
  state.fetchStage = null;
  state.ballCarried = false;
  placeBallInFront();
  needs.happiness = clamp(needs.happiness + 16);
  needs.energy = clamp(needs.energy - 8);
  state.score += 8;
  spawnBurst('heart', headWorldPosition(), 8);
  say('Good boy, Bear! 🎾', 3);
  state.mode = 'idle';
  state.idleAt = state.time + 3;
  faceThePlayer();
}

function resetGame() {
  state.score = 0;
  state.time = 0;
  needs.fullness = 70;
  needs.hydration = 70;
  needs.happiness = 70;
  needs.energy = 70;
  state.mode = 'idle';
  state.modeTimer = 0;
  state.walk = null;
  state.walkAfter = null;
  state.sleeping = false;
  state.petting = 0;
  state.fetchStage = null;
  state.ballCarried = false;
  state.ballFlight = null;
  state.celebrationAt = -100;
  state.idleAt = 3;
  state.targetYaw = 0.42;

  if (bear) {
    bear.position.set(SPOTS.home.x, 0, SPOTS.home.z);
    bear.rotation.set(0, 0.42, 0);
  }
  if (ball) {
    ball.position.set(SPOTS.ballHome.x, 0.24, SPOTS.ballHome.z);
  }
  bannerEl.classList.remove('show');
  updateHud();
  say('Bear is ready to play! 🐾', 3.5);
}

// --------------------------------------------------------------- update
function updateNeeds(dt) {
  if (state.sleeping) {
    needs.energy = clamp(needs.energy + 6 * dt);
    needs.happiness = clamp(needs.happiness + 0.35 * dt);
    needs.fullness = clamp(needs.fullness - 0.04 * dt);
    needs.hydration = clamp(needs.hydration - 0.05 * dt);
    if (needs.energy >= 100) {
      state.sleeping = false;
      state.mode = 'idle';
      state.idleAt = state.time + 2;
      state.score += 6;
      needs.happiness = clamp(needs.happiness + 4);
      spawnBurst('sparkle', headWorldPosition(), 5);
      say('I feel so rested! 💤', 3);
      faceThePlayer();
    }
    return;
  }

  needs.fullness = clamp(needs.fullness - 0.22 * dt);
  needs.hydration = clamp(needs.hydration - 0.26 * dt);
  needs.energy = clamp(needs.energy - 0.1 * dt);

  let drain = 0.12;
  if (needs.fullness < 25) drain += 0.18;
  if (needs.hydration < 25) drain += 0.18;
  if (needs.energy < 20) drain += 0.1;
  needs.happiness = clamp(needs.happiness - drain * dt);
}

function updateFetchSchedule() {
  if (state.fetchStage === 'wait' && state.time >= state.fetchAt && !state.ballFlight) {
    state.fetchStage = 'run';
    const targetX = ball.position.x;
    const targetZ = ball.position.z + 0.28;
    startWalk(targetX, targetZ, pickUpBall);
  }
}

function updateBearMovement(dt) {
  if (!bear) return;

  if (state.mode === 'walk' && state.walk) {
    const dx = state.walk.x - bear.position.x;
    const dz = state.walk.z - bear.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.06) {
      state.walk = null;
      state.mode = 'idle';
      state.idleAt = state.time + rand(3.5, 6.5);
      const after = state.walkAfter;
      state.walkAfter = null;
      if (after) after();
      else faceThePlayer();
    } else {
      const step = Math.min(distance, 1.55 * dt);
      bear.position.x += (dx / distance) * step;
      bear.position.z += (dz / distance) * step;
      state.targetYaw = Math.atan2(dx, dz);
      walkPhase += dt * 8.5;
    }
  }

  if (state.mode === 'idle' && !state.sleeping && state.time > state.idleAt) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(0.35, 1.65);
    startWalk(Math.cos(angle) * radius, 0.3 + Math.sin(angle) * radius, null);
  }

  const yawDelta = shortestAngle(bear.rotation.y, state.targetYaw);
  bear.rotation.y += yawDelta * (1 - Math.exp(-9 * dt));
}

function updateActionModes(dt) {
  if (state.mode === 'eat' || state.mode === 'drink') {
    state.modeTimer += dt;
    if (state.modeTimer >= 2.4) {
      if (state.mode === 'eat') finishEating();
      else finishDrinking();
    }
  }
}

function updateBearPose(dt) {
  if (!bear) return;
  const parts = bear.userData.parts;
  const walking = state.mode === 'walk';
  const eating = state.mode === 'eat';
  const drinking = state.mode === 'drink';
  const sleeping = state.sleeping;

  walkBlend += ((walking ? 1 : 0) - walkBlend) * (1 - Math.exp(-12 * dt));

  let bodyY = 0.78;
  let bodyPitch = 0;
  let bodyRoll = 0;
  let headPitch = 0.02;
  let headYaw = 0;
  let headRoll = 0;
  let tailSpeed = 3.2;
  let tailAmp = 0.16;

  if (sleeping) {
    bodyY = 0.4;
    bodyPitch = -0.14;
    headPitch = 0.44;
    headYaw = 0.12;
    tailSpeed = 1.2;
    tailAmp = 0.04;
  } else if (eating || drinking) {
    bodyY = 0.77;
    bodyPitch = 0.06;
    headPitch = 0.6 + Math.sin(state.time * 15) * 0.08;
    tailSpeed = 5;
    tailAmp = 0.24;
  } else if (walking) {
    bodyY = 0.78 + Math.abs(Math.sin(walkPhase)) * 0.03;
    headPitch = 0.05;
    tailSpeed = 8;
    tailAmp = 0.3;
  } else {
    bodyY = 0.78 + Math.sin(state.time * 2.1) * 0.012;
    headPitch = 0.02 + Math.sin(state.time * 0.8) * 0.04;
    headYaw = Math.sin(state.time * 0.45) * 0.12;
    headRoll = Math.sin(state.time * 0.62) * 0.07;
    tailSpeed = needs.happiness > 60 ? 4.6 : 2.8;
    tailAmp = needs.happiness > 60 ? 0.26 : 0.13;
  }

  if (state.petting > 0) {
    const wag = Math.sin(state.time * 24);
    bodyRoll += wag * 0.03;
    bodyY += Math.max(0, Math.sin(state.time * 12)) * 0.06;
    headRoll += wag * 0.05;
    tailSpeed = 12;
    tailAmp = 0.34;
  }

  const damp = 1 - Math.exp(-12 * dt);
  parts.bodyPivot.position.y += (bodyY - parts.bodyPivot.position.y) * damp;
  parts.bodyPivot.rotation.x += (bodyPitch - parts.bodyPivot.rotation.x) * damp;
  parts.bodyPivot.rotation.z += (bodyRoll - parts.bodyPivot.rotation.z) * damp;
  parts.headPivot.rotation.x += (headPitch - parts.headPivot.rotation.x) * damp;
  parts.headPivot.rotation.y += (headYaw - parts.headPivot.rotation.y) * damp;
  parts.headPivot.rotation.z += (headRoll - parts.headPivot.rotation.z) * damp;

  parts.legs.forEach((leg, index) => {
    const phase = index === 0 || index === 3 ? 0 : Math.PI;
    const target = (sleeping ? 1.05 : 0) + Math.sin(walkPhase + phase) * 0.55 * walkBlend;
    leg.rotation.x += (target - leg.rotation.x) * damp;
  });

  parts.ears.forEach((ear, index) => {
    const side = index === 0 ? 1 : -1;
    const sway = Math.sin(state.time * 1.8 + index * 1.7) * 0.05;
    const droop = sleeping ? 0.22 : 0;
    ear.rotation.z += (0.28 * side + droop * side - ear.rotation.z) * damp;
    ear.rotation.x += (sway - 0.05 - ear.rotation.x) * damp;
  });

  parts.tailPivot.rotation.z = Math.sin(state.time * tailSpeed) * tailAmp;
  parts.tailPivot.rotation.x = -0.05 + Math.cos(state.time * tailSpeed * 0.8) * tailAmp * 0.25;

  if (state.time > state.blinkAt) {
    state.blinkUntil = state.time + 0.13;
    state.blinkAt = state.time + rand(2.2, 5.4);
  }
  const blink = state.time < state.blinkUntil || sleeping;
  const eyeTarget = blink ? 0.1 : 1;
  parts.eyes.forEach((eye) => {
    eye.scale.y += (eyeTarget - eye.scale.y) * (1 - Math.exp(-30 * dt));
  });

  const tongueOut = !sleeping && (state.petting > 0 || needs.happiness > 55 || walking);
  const tongueTarget = tongueOut ? 1 : 0.01;
  parts.tonguePivot.scale.setScalar(
    parts.tonguePivot.scale.x + (tongueTarget - parts.tonguePivot.scale.x) * damp
  );

  if (state.petting > 0) {
    state.petting = Math.max(0, state.petting - dt);
  }
}

function updateBall(dt) {
  if (!ball) return;

  if (state.ballFlight) {
    const flight = state.ballFlight;
    flight.t += dt / flight.duration;
    if (flight.t >= 1) {
      ball.position.copy(flight.to);
      state.ballFlight = null;
    } else {
      ball.position.lerpVectors(flight.from, flight.to, flight.t);
      ball.position.y += Math.sin(flight.t * Math.PI) * 1.3;
      ball.rotation.x += dt * 10;
      ball.rotation.z += dt * 6;
    }
  }

  if (state.ballCarried && mouthAnchor) {
    mouthAnchor.getWorldPosition(tmpVec);
    ball.position.copy(tmpVec);
    ball.position.y -= 0.08;
    ball.rotation.set(0, 0, 0);
  }
}

function updateWorld(dt) {
  if (waterSurface) {
    const scale = 1 + Math.sin(state.time * 3) * 0.02;
    waterSurface.scale.set(scale, scale, 1);
  }
  if (kibbleGroup) {
    kibbleGroup.visible = needs.fullness < 95 || state.mode === 'eat';
  }

  if (hoverRing && state.hovered) {
    if (state.hovered === bear) {
      hoverRing.position.set(bear.position.x, 0.04, bear.position.z);
    } else {
      state.hovered.getWorldPosition(tmpVec);
      hoverRing.position.set(tmpVec.x, 0.04, tmpVec.z);
    }
    hoverRing.scale.setScalar(state.hovered.userData.hoverRadius || 0.8);
    hoverRing.rotation.z += dt * 0.6;
  }
}

function updateSpeech() {
  if (state.time < state.messageUntil) return;
  if (state.time < state.nextSpeechAt) return;

  const order = Object.entries(needs).sort((a, b) => a[1] - b[1]);
  const [key, value] = order[0];
  let line = '';

  if (value < 30) {
    if (key === 'fullness') line = 'My tummy is rumbling… 🍖';
    else if (key === 'hydration') line = 'I am so thirsty… 💧';
    else if (key === 'happiness') line = 'I need some love… 🥺';
    else line = 'I can barely keep my eyes open… 😴';
  } else if (value < 55) {
    if (key === 'fullness') line = 'Could I have a snack? 🍖';
    else if (key === 'hydration') line = 'Some fresh water, please! 💧';
    else if (key === 'happiness') line = 'Can we play fetch? 🎾';
    else line = 'My paws are feeling tired… 🛏️';
  } else {
    const happy = [
      'I love living here! 🐾',
      'Woof woof! You are the best!',
      'My tail will not stop wagging!',
      'Can we cuddle? 💕',
    ];
    line = happy[Math.floor(state.time / 8) % happy.length];
  }

  speechEl.textContent = line;
  state.nextSpeechAt = state.time + 6;
}

function updateHud() {
  for (const [key, value] of Object.entries(needs)) {
    const element = needEls[key];
    if (!element) continue;
    const rounded = Math.round(value);
    element.fill.style.width = `${rounded}%`;
    element.root.setAttribute('aria-valuenow', String(rounded));
    element.root.classList.toggle('low', value < 25);
  }

  scoreEl.textContent = String(state.score);

  const average = (needs.fullness + needs.hydration + needs.happiness + needs.energy) / 4;
  let emoji = '🐶';
  let label = 'Happy';
  if (average >= 85) {
    emoji = '🥰';
    label = 'Ecstatic';
  } else if (average >= 65) {
    emoji = '😊';
    label = 'Happy';
  } else if (average >= 45) {
    emoji = '🐶';
    label = 'Okay';
  } else if (average >= 25) {
    emoji = '🥺';
    label = 'Needs love';
  } else {
    emoji = '😢';
    label = 'Sad';
  }
  if (moodEmojiEl.textContent !== emoji) moodEmojiEl.textContent = emoji;
  if (moodLabelEl.textContent !== label) moodLabelEl.textContent = label;
}

function maybeCelebrate() {
  if (state.time - state.celebrationAt < 30) return;
  if (!Object.values(needs).every((value) => value >= 88)) return;
  state.celebrationAt = state.time;
  state.score += 15;
  bannerLabel.textContent = '🌈 Bear is the happiest puppy!';
  bannerEl.classList.add('show');
  window.setTimeout(() => bannerEl.classList.remove('show'), 3200);
  spawnBurst('heart', headWorldPosition(), 14);
  say('You are the best puppy parent! 💕', 4);
}

function updateCamera(dt) {
  if (!camera) return;
  parallax.x += (parallax.targetX - parallax.x) * Math.min(1, dt * 3);
  parallax.y += (parallax.targetY - parallax.y) * Math.min(1, dt * 3);
  const offset = CAM_OFFSET.clone().sub(CAM_TARGET).multiplyScalar(state.camScale);
  camera.position
    .copy(CAM_TARGET)
    .add(offset)
    .add(new THREE.Vector3(parallax.x * 0.35, -parallax.y * 0.22, 0));
  camera.lookAt(CAM_TARGET);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;

  updateNeeds(dt);
  updateFetchSchedule();
  updateBearMovement(dt);
  updateActionModes(dt);
  updateBearPose(dt);
  updateBall(dt);
  updateWorld(dt);
  updateEffects(dt);
  updateSpeech();
  updateHud();
  maybeCelebrate();
  updateCamera(dt);

  renderer.render(scene, camera);
}

// --------------------------------------------------------------- events
function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function interactionAt(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, true);
  if (!hits.length) return null;
  let node = hits[0].object;
  while (node && !node.userData.action) node = node.parent;
  return node || null;
}

function handleTap(event) {
  const target = interactionAt(event);
  if (!target) return;
  const action = target.userData.action;
  if (action === 'feed') beginFeed();
  else if (action === 'water') beginDrink();
  else if (action === 'fetch') beginFetch();
  else if (action === 'pet') beginPet();
  else if (action === 'sleep') beginSleep();
}

function handlePointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  parallax.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  parallax.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

  const target = interactionAt(event);
  state.hovered = target;
  renderer.domElement.style.cursor = target ? 'pointer' : 'default';
  if (hoverRing) hoverRing.visible = Boolean(target);
}

function bindEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (event) => {
    state.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
  });

  canvas.addEventListener('pointerup', (event) => {
    const down = state.pointerDown;
    state.pointerDown = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved < 10 && performance.now() - down.time < 700) handleTap(event);
  });

  canvas.addEventListener('pointermove', handlePointerMove);

  canvas.addEventListener('pointerleave', () => {
    state.hovered = null;
    renderer.domElement.style.cursor = 'default';
    if (hoverRing) hoverRing.visible = false;
    parallax.targetX = 0;
    parallax.targetY = 0;
  });

  buttons.feed.addEventListener('click', beginFeed);
  buttons.water.addEventListener('click', beginDrink);
  buttons.fetch.addEventListener('click', beginFetch);
  buttons.pet.addEventListener('click', beginPet);
  buttons.sleep.addEventListener('click', beginSleep);
  buttons.reset.addEventListener('click', resetGame);

  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(resize);
    observer.observe(container);
  }
}

function resize() {
  if (!renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = 45;
  camera.updateProjectionMatrix();
  state.camScale = clamp(1.05 / camera.aspect, 1, 1.4);
}

// ----------------------------------------------------------------- boot
init();
