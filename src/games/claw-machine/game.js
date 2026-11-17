import * as THREE from 'three';
import { PLUSHIES, FAMILY_ICONS, buildPlushie } from './plushies.js';
import { sound } from './sound.js';

// ------------------------------------------------------------------ DOM
const container = document.querySelector('#game-container');
const prizeCountEl = document.querySelector('#prize-count');
const playsCountEl = document.querySelector('#plays-count');
const streakCountEl = document.querySelector('#streak-count');
const messageEl = document.querySelector('#message');
const dropButton = document.querySelector('#drop-button');
const resetButton = document.querySelector('#reset-button');
const muteButton = document.querySelector('#mute-button');
const winBanner = document.querySelector('#win-banner');
const winKicker = document.querySelector('#win-kicker');
const winName = document.querySelector('#win-name');
const winMeta = document.querySelector('#win-meta');
const mathDialog = document.querySelector('#math-dialog');
const mathQuestionEl = document.querySelector('#math-question');
const mathAnswersEl = document.querySelector('#math-answers');
const mathFeedbackEl = document.querySelector('#math-feedback');
const mathHintEl = document.querySelector('#math-hint');
const mathHintButton = document.querySelector('#math-hint-button');
const mathNewButton = document.querySelector('#math-new-button');
const mathLaterButton = document.querySelector('#math-later-button');
const dexCountEl = document.querySelector('#dex-count');
const dexNeededEl = document.querySelector('#dex-needed');
const dexProgressEl = document.querySelector('#dex-progress');
const dexProgressFill = document.querySelector('#dex-progress-fill');
const dexPercentEl = document.querySelector('#dex-percent');
const dexRecordEl = document.querySelector('#dex-record');
const dexGrid = document.querySelector('#dex-grid');
const dexEmptyEl = document.querySelector('#dex-empty');
const dexSaveNote = document.querySelector('#dex-save-note');
const dexFilterButtons = [...document.querySelectorAll('[data-filter]')];
const resetProgressButton = document.querySelector('#reset-progress-button');
const moveButtons = [...document.querySelectorAll('[data-move]')];

// --------------------------------------------------------------- limits
const CAB = { halfW: 2.25, halfD: 1.65, glassTop: 2.98, bridgeY: 2.76 };
const PIT = { minX: -1.75, maxX: 1.45, minZ: -1.0, maxZ: 0.9 };
const CHUTE = { x: 1.86, z: 1.18 };
const CLAW_REST = 2.0;
const CLAW_DROP = 1.1;
const CLAW_MIN_X = -1.78;
const CLAW_MAX_X = 1.86;
const CLAW_MIN_Z = -1.12;
const CLAW_MAX_Z = 1.18;
const PIT_CAPACITY = 28;
const START_TRIES = 10;
const MATH_REWARD = 3;
const SAVE_KEY = 'foofire.clawCrew.save.v1';
const FAMILY_LABELS = {
  avatar: 'Avatar',
  pet: 'Pet Pal',
  obby: 'Obby Hero',
  horror: 'Spooky',
  circus: 'Circus',
  goofy: 'Goofy',
};
const BASE_ICONS = {
  blocky: '🧱',
  doll: '🧸',
  bear: '🐻',
  bunny: '🐰',
  cat: '🐱',
  dog: '🐶',
  frog: '🐸',
  blob: '🫧',
  penguin: '🐧',
  dragon: '🐲',
  spider: '🕷️',
  ghost: '👻',
  robot: '🤖',
  star: '⭐',
  pony: '🐴',
};

// --------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080312);
scene.fog = new THREE.Fog(0x080312, 17, 38);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const cameraBase = new THREE.Vector3();
const cameraTarget = new THREE.Vector3(0, 1.65, 0.04);
const parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-hidden', 'true');
container.appendChild(renderer.domElement);

const cabinet = new THREE.Group();
scene.add(cabinet);

const clock = new THREE.Clock();
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

function addMesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function box(parent, w, h, d, material, x, y, z) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

const frameMat = mat(0x1c1238, { metalness: 0.5, roughness: 0.32 });
const darkMat = mat(0x0c0719, { roughness: 0.8 });
const neonPink = mat(0xff2e63, { emissive: 0xff2e63, emissiveIntensity: 0.9, roughness: 0.35 });
const neonCyan = mat(0x2ec4ff, { emissive: 0x2ec4ff, emissiveIntensity: 0.8, roughness: 0.35 });
const neonGold = mat(0xffd93d, { emissive: 0xffd93d, emissiveIntensity: 0.8, roughness: 0.35 });
const chrome = mat(0xcbd5e1, { metalness: 0.8, roughness: 0.25 });
const steel = mat(0x64748b, { metalness: 0.65, roughness: 0.35 });

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeMarqueeTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#4c1d95');
    bg.addColorStop(0.55, '#a21caf');
    bg.addColorStop(1, '#ff2e63');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 14;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd93d';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 104px "Press Start 2P", monospace';
    ctx.fillText('CLAW CREW', w / 2, h * 0.44);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd93d';
    ctx.font = 'bold 38px monospace';
    ctx.fillText('100 PLUSHIES INSIDE', w / 2, h * 0.78);
  });
}

function makeBackTexture() {
  return canvasTexture(1024, 640, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2b1458');
    bg.addColorStop(1, '#140a2c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 3;
      ctx.fillStyle = `rgba(255, 217, 61, ${0.12 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(46, 196, 255, 0.18)';
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 82) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd93d';
    ctx.textAlign = 'center';
    ctx.font = 'bold 84px "Press Start 2P", monospace';
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 24;
    ctx.fillText('WIN A', w / 2, h * 0.36);
    ctx.fillText('PLUSHIE!', w / 2, h * 0.51);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('★ 100 TO COLLECT ★', w / 2, h * 0.66);
  });
}

function makeFloorTexture() {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const size = 32;
    ctx.fillStyle = '#2a1450';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3b1c6b';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * size, y * size, size, size);
      }
    }
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * size, 0);
      ctx.lineTo(i * size, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * size);
      ctx.lineTo(w, i * size);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function makeBackdropTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#130728');
    bg.addColorStop(0.6, '#251048');
    bg.addColorStop(1, '#080312');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const glows = [
      [w * 0.18, h * 0.4, 240, 'rgba(255, 46, 99, 0.2)'],
      [w * 0.82, h * 0.3, 280, 'rgba(46, 196, 255, 0.18)'],
      [w * 0.5, h * 0.8, 320, 'rgba(168, 85, 247, 0.16)'],
    ];
    glows.forEach(([x, y, r, color]) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    });
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function buildBackdrop() {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 12),
    new THREE.MeshBasicMaterial({ map: makeBackdropTexture() })
  );
  wall.position.set(0, 4.4, -6.5);
  scene.add(wall);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({ color: 0x0e0720, roughness: 0.92, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.56;
  floor.receiveShadow = true;
  scene.add(floor);

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.045, 6, 80),
    neonCyan
  );
  glowRing.position.set(0, 4.7, -4.8);
  scene.add(glowRing);

  const glowRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.03, 6, 80),
    neonPink
  );
  glowRing2.position.set(0, 4.7, -4.8);
  scene.add(glowRing2);
}

function buildCabinet() {
  // Plinth and base trim.
  box(cabinet, 4.95, 0.55, 3.55, frameMat, 0, -0.28, 0);
  box(cabinet, 5.02, 0.06, 3.62, neonPink, 0, -0.01, 0);
  box(cabinet, 4.55, 0.04, 3.16, darkMat, 0, 0.012, 0);

  // Pit floor.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(4.36, 3.06),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.78, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.025, 0);
  floor.receiveShadow = true;
  cabinet.add(floor);

  // Interior back panel and sign.
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(4.32, 2.98),
    new THREE.MeshStandardMaterial({ map: makeBackTexture(), roughness: 0.72 })
  );
  back.position.set(0, 1.5, -1.56);
  back.receiveShadow = true;
  cabinet.add(back);

  // Glass walls.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.11,
    roughness: 0.06,
    metalness: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.38, 2.94), glassMat);
  frontGlass.position.set(0, 1.5, 1.57);
  frontGlass.renderOrder = 3;
  cabinet.add(frontGlass);

  const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.94), glassMat);
  leftGlass.position.set(-2.19, 1.5, 0);
  leftGlass.rotation.y = Math.PI / 2;
  leftGlass.renderOrder = 3;
  cabinet.add(leftGlass);

  const rightGlass = leftGlass.clone();
  rightGlass.position.x = 2.19;
  cabinet.add(rightGlass);

  const topGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.38, 3.1), glassMat);
  topGlass.position.set(0, 2.98, 0);
  topGlass.rotation.x = -Math.PI / 2;
  topGlass.renderOrder = 3;
  cabinet.add(topGlass);

  // Frame posts and rails.
  const corners = [
    [-2.21, -1.59],
    [2.21, -1.59],
    [-2.21, 1.59],
    [2.21, 1.59],
  ];
  corners.forEach(([x, z]) => {
    box(cabinet, 0.12, 3.0, 0.12, frameMat, x, 1.5, z);
  });
  box(cabinet, 4.55, 0.11, 0.12, frameMat, 0, 2.99, 1.59);
  box(cabinet, 4.55, 0.11, 0.12, frameMat, 0, 0.06, 1.59);
  box(cabinet, 4.55, 0.11, 0.12, frameMat, 0, 2.99, -1.59);
  box(cabinet, 0.12, 0.11, 3.2, frameMat, -2.21, 2.99, 0);
  box(cabinet, 0.12, 0.11, 3.2, frameMat, 2.21, 2.99, 0);

  // Neon accents on the front corners.
  box(cabinet, 0.035, 2.7, 0.035, neonCyan, -2.16, 1.5, 1.6);
  box(cabinet, 0.035, 2.7, 0.035, neonPink, 2.16, 1.5, 1.6);
  box(cabinet, 3.9, 0.03, 0.03, neonGold, 0, 2.86, 1.605);

  // Prize chute.
  box(cabinet, 0.76, 0.05, 0.76, darkMat, CHUTE.x, 0.055, CHUTE.z);
  box(cabinet, 0.8, 0.08, 0.06, neonGold, CHUTE.x, 0.06, CHUTE.z - 0.4);
  box(cabinet, 0.8, 0.08, 0.06, neonGold, CHUTE.x, 0.06, CHUTE.z + 0.4);
  box(cabinet, 0.06, 0.08, 0.76, neonGold, CHUTE.x - 0.4, 0.06, CHUTE.z);
  box(cabinet, 0.06, 0.08, 0.76, neonGold, CHUTE.x + 0.4, 0.06, CHUTE.z);

  // Front control panel details.
  box(cabinet, 0.5, 0.16, 0.04, darkMat, 1.05, 0.23, 1.795);
  box(cabinet, 0.2, 0.05, 0.02, neonCyan, 1.05, 0.23, 1.818);
  box(cabinet, 0.72, 0.38, 0.04, frameMat, 1.78, 0.23, 1.79);
  box(cabinet, 0.58, 0.26, 0.02, darkMat, 1.78, 0.23, 1.81);
  box(cabinet, 0.16, 0.03, 0.02, chrome, 1.78, 0.27, 1.825);
  const prizeLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.54, 0.1),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#120a2a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffd93d';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PRIZE', w / 2, h / 2);
      }),
      transparent: true,
    })
  );
  prizeLabel.position.set(1.78, 0.12, 1.825);
  cabinet.add(prizeLabel);

  // Marquee roof and sign.
  box(cabinet, 4.98, 0.24, 3.4, frameMat, 0, 3.13, 0);
  box(cabinet, 4.55, 0.8, 0.36, frameMat, 0, 3.63, 1.38);
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(4.35, 0.66),
    new THREE.MeshBasicMaterial({ map: makeMarqueeTexture() })
  );
  marquee.position.set(0, 3.63, 1.565);
  cabinet.add(marquee);

  for (let i = 0; i < 12; i += 1) {
    const x = -1.95 + i * 0.355;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), neonGold);
    bulb.position.set(x, 3.95, 1.54);
    cabinet.add(bulb);
    const bulbLow = bulb.clone();
    bulbLow.position.y = 3.31;
    cabinet.add(bulbLow);
  }

  // Side decals.
  const sideDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.85),
    new THREE.MeshBasicMaterial({ map: makeMarqueeTexture() })
  );
  sideDecal.position.set(2.5, 1.7, 0);
  sideDecal.rotation.y = -Math.PI / 2;
  cabinet.add(sideDecal);
}

function buildClaw() {
  // Fixed rails.
  box(cabinet, 0.08, 0.09, 3.05, steel, -2.02, 2.72, 0);
  box(cabinet, 0.08, 0.09, 3.05, steel, 2.02, 2.72, 0);
  box(cabinet, 0.36, 0.22, 0.36, frameMat, -2.02, 2.72, -1.45);
  box(cabinet, 0.36, 0.22, 0.36, frameMat, 2.02, 2.72, -1.45);
  box(cabinet, 0.36, 0.22, 0.36, frameMat, -2.02, 2.72, 1.45);
  box(cabinet, 0.36, 0.22, 0.36, frameMat, 2.02, 2.72, 1.45);

  const bridge = new THREE.Group();
  bridge.position.y = CAB.bridgeY;
  cabinet.add(bridge);

  const beam = box(bridge, 4.3, 0.1, 0.13, frameMat, 0, 0, 0);
  beam.castShadow = true;
  box(bridge, 0.22, 0.18, 0.7, frameMat, -1.98, 0.02, 0);
  box(bridge, 0.22, 0.18, 0.7, frameMat, 1.98, 0.02, 0);

  const trolley = new THREE.Group();
  bridge.add(trolley);
  box(trolley, 0.3, 0.18, 0.36, frameMat, 0, -0.02, 0);
  box(trolley, 0.34, 0.05, 0.4, neonCyan, 0, -0.12, 0);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1, 6),
    steel
  );
  cable.position.y = -0.4;
  trolley.add(cable);

  const clawHead = new THREE.Group();
  trolley.add(clawHead);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 14), chrome);
  hub.castShadow = true;
  clawHead.add(hub);
  const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.12, 10), frameMat);
  hubTop.position.y = 0.13;
  clawHead.add(hubTop);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 18), neonPink);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.06;
  clawHead.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 16), neonCyan);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.14;
  clawHead.add(ring2);

  const prongs = [];
  for (let i = 0; i < 3; i += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 3) * Math.PI * 2;
    clawHead.add(arm);

    const pivot = new THREE.Group();
    arm.add(pivot);

    const prong = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.36, 4, 6), chrome);
    prong.position.y = -0.29;
    prong.castShadow = true;
    pivot.add(prong);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), neonPink);
    tip.position.y = -0.5;
    pivot.add(tip);

    prongs.push(pivot);
  }

  return { bridge, trolley, cable, clawHead, prongs };
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0xffe8ff, 0x1a0b33, 1.25));

  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(5, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const warm = new THREE.PointLight(0xff9ec4, 8, 6, 2);
  warm.position.set(0, 2.55, 0.6);
  scene.add(warm);

  const cool = new THREE.PointLight(0x6ee7ff, 6, 5.5, 2);
  cool.position.set(-1.6, 1.1, 0.4);
  scene.add(cool);

  const front = new THREE.PointLight(0xffd93d, 4, 5, 2);
  front.position.set(1.4, 1.4, 1.2);
  scene.add(front);
}

buildBackdrop();
buildCabinet();
buildLights();
const claw = buildClaw();

const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.28, 0.37, 36),
  new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.position.y = 0.07;
targetRing.renderOrder = 4;
cabinet.add(targetRing);

function resize() {
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Frame the whole cabinet closely, from a high three-quarter angle that
  // keeps the claw and the pit readable without cropping the marquee.
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const frameHeight = 5.2;
  const frameWidth = 5.3;
  const distForHeight = frameHeight / 2 / Math.tan(vFov / 2);
  const distForWidth = frameWidth / 2 / (Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(distForHeight, distForWidth) + 0.1;
  cameraBase.set(dist * 0.16, 1.65 + dist * 0.32, dist * 0.95);
  camera.position.copy(cameraBase);
  camera.lookAt(cameraTarget);
}

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- state
const state = {
  time: 0,
  phase: 'idle',
  phaseTime: 0,
  busy: false,
  complete: false,
  gantryX: 0,
  gantryZ: 0,
  targetX: 0,
  targetZ: 0,
  hubY: CLAW_REST,
  targetHubY: CLAW_REST,
  clawOpen: 0.65,
  clawOpenTarget: 0.65,
  candidate: null,
  carried: null,
  grip: 0,
  plays: START_TRIES,
  collected: new Set(),
  streak: 0,
  bestStreak: 0,
  wins: 0,
  turnWon: false,
  remaining: [],
  toys: [],
  confetti: [],
  respawnTimer: 0,
};

const held = { left: false, right: false, up: false, down: false };
const keys = new Set();
const dexCardEls = new Map();
const dexNumbers = new Map(PLUSHIES.map((entry, index) => [entry.id, index + 1]));
const clawWorld = new THREE.Vector3();
let bannerTimeout = 0;
let storageAvailable = true;
let dexFilter = 'all';
let resetArmed = false;
let resetArmTimer = 0;
let mathBag = [];
let currentMathQuestion = null;
let mathSolved = false;
let mathPromptTimer = 0;
let mathCloseTimer = 0;

const GRID_X = [-1.72, -1.18, -0.64, -0.1, 0.44, 0.98, 1.44];
const GRID_Z = [-1.02, -0.47, 0.08, 0.63];
const TOPPER_INDEXES = new Set([4, 10, 16, 22, 26]);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand = (min, max) => min + Math.random() * (max - min);

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function numericChoices(answer, offsets = []) {
  const values = [answer];
  const pool = offsets.length ? [...offsets] : [-1, 1, -2, 2, -10, 10];
  for (const offset of shuffle(pool)) {
    if (values.length >= 4) break;
    const candidate = answer + offset;
    if (candidate > 0 && !values.includes(candidate)) values.push(candidate);
  }
  let extra = 1;
  while (values.length < 4) {
    const candidate = answer + extra * 17;
    if (!values.includes(candidate)) values.push(candidate);
    extra += 1;
  }
  return shuffle(values).map((value) => ({ label: String(value), correct: value === answer }));
}

function choiceQuestion(question, answer, wrong, hint) {
  const labels = [...new Set([String(answer), ...wrong.map(String)])];
  return {
    question,
    hint,
    choices: shuffle(labels.map((label) => ({ label, correct: label === String(answer) }))),
  };
}

function numberQuestion(question, answer, hint, offsets) {
  return { question, hint, choices: numericChoices(answer, offsets) };
}

// A mix of grade-5 skills: operations, fractions, decimals, geometry, and time.
const MATH_MAKERS = [
  () => {
    const rows = randInt(3, 8);
    const each = randInt(4, 12);
    return numberQuestion(
      `A plushie shelf has ${rows} rows with ${each} plushies in each row. How many plushies are on the shelf?`,
      rows * each,
      `Multiply ${rows} × ${each}.`,
      [-each, each, 1, -1, 10, -10]
    );
  },
  () => {
    const friends = randInt(4, 9);
    const each = randInt(3, 9);
    return numberQuestion(
      `You share ${friends * each} stickers equally among ${friends} friends. How many stickers does each friend get?`,
      each,
      `Divide ${friends * each} ÷ ${friends}.`,
      [-1, 1, 2, -2, friends, -friends]
    );
  },
  () => {
    const a = randInt(12, 25);
    const b = randInt(3, 9);
    return numberQuestion(
      `What is ${a} × ${b}?`,
      a * b,
      `Break ${a} into tens and ones, then multiply each part.`,
      [-b, b, -a, a, 10, -10]
    );
  },
  () => {
    const a = randInt(125, 685);
    const b = randInt(115, 295);
    return numberQuestion(
      `What is ${a} + ${b}?`,
      a + b,
      'Line up the hundreds, tens, and ones, then add.',
      [-10, 10, -100, 100, -1, 1]
    );
  },
  () => {
    const a = randInt(320, 950);
    const b = randInt(125, 300);
    return numberQuestion(
      `What is ${a} - ${b}?`,
      a - b,
      'Line up the hundreds, tens, and ones, then subtract.',
      [-10, 10, -100, 100, -1, 1]
    );
  },
  () => {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const c = randInt(2, 7);
    const answer = a + b * c;
    return numberQuestion(
      `What is ${a} + ${b} × ${c}?`,
      answer,
      `Do ${b} × ${c} first, then add ${a}.`,
      [(a + b) * c - answer, 1, -1, b, -b]
    );
  },
  () => {
    const denominator = [6, 8, 10, 12][randInt(0, 3)];
    const first = randInt(1, Math.max(1, Math.floor(denominator / 2) - 1));
    const second = randInt(1, denominator - first - 1);
    const sum = first + second;
    return choiceQuestion(
      `What is ${first}/${denominator} + ${second}/${denominator}?`,
      `${sum}/${denominator}`,
      [
        `${sum}/${denominator * 2}`,
        `${Math.min(denominator, sum + 1)}/${denominator}`,
        `${Math.max(1, sum - 1)}/${denominator}`,
      ],
      `Add the top numbers. The bottom number stays ${denominator}.`
    );
  },
  () => {
    const [numerator, denominator] = [
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [1, 4],
    ][randInt(0, 4)];
    const multiplier = randInt(2, 4);
    return choiceQuestion(
      `Which fraction is equal to ${numerator}/${denominator}?`,
      `${numerator * multiplier}/${denominator * multiplier}`,
      [
        `${numerator + 1}/${denominator}`,
        `${numerator}/${denominator + 1}`,
        `${numerator + 1}/${denominator + 1}`,
      ],
      'Multiply the top and bottom by the same number.'
    );
  },
  () => {
    const first = randInt(1, 6) + 0.25;
    const second = randInt(1, 4) + 0.5;
    const total = first + second;
    const money = (value) => `$${value.toFixed(2)}`;
    return choiceQuestion(
      `A plushie costs ${money(first)} and a sticker costs ${money(second)}. What is the total cost?`,
      money(total),
      [money(total + 0.25), money(total - 0.25), money(total + 1)],
      'Line up the decimal points, then add.'
    );
  },
  () => {
    const length = randInt(4, 9);
    const width = randInt(3, 8);
    const area = length * width;
    return {
      question: `A rectangular poster is ${length} cm wide and ${width} cm tall. What is its area?`,
      hint: `Area = length × width. Multiply ${length} × ${width}.`,
      choices: numericChoices(area, [-length, -width, -1, 1, length, width]).map((choice) => ({
        ...choice,
        label: `${choice.label} cm²`,
      })),
    };
  },
  () => {
    const value = randInt(12, 98) * 10 + randInt(1, 9);
    const rounded = Math.round(value / 10) * 10;
    return choiceQuestion(
      `Round ${value} to the nearest ten.`,
      rounded,
      [rounded - 10, rounded + 10, value],
      'Look at the ones digit. If it is 5 or more, round up.'
    );
  },
  () => {
    const number =
      randInt(1, 8) * 1000 + randInt(1, 8) * 100 + randInt(0, 9) * 10 + randInt(0, 9);
    const hundreds = Math.floor(number / 100) % 10;
    return choiceQuestion(
      `In ${number.toLocaleString('en-US')}, what is the value of the digit in the hundreds place?`,
      hundreds * 100,
      [hundreds, hundreds * 10, hundreds * 1000],
      'Each hundred is worth 100.'
    );
  },
  () => {
    const startHour = randInt(2, 6);
    const startMinute = [10, 15, 20, 25, 30, 35, 40, 45, 50][randInt(0, 8)];
    const totalMinutes = startHour * 60 + startMinute + 90;
    const time = (minutes) =>
      `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    return choiceQuestion(
      `A movie starts at ${startHour}:${String(startMinute).padStart(2, '0')} and lasts 1 hour 30 minutes. What time does it end?`,
      time(totalMinutes),
      [time(totalMinutes - 30), time(totalMinutes + 15), time(totalMinutes - 15)],
      'Add 1 hour, then add 30 minutes.'
    );
  },
  () => {
    const [total, factor, wrong] = [
      [24, 8, [5, 7, 9]],
      [36, 9, [5, 7, 8]],
      [18, 6, [4, 5, 8]],
      [48, 8, [5, 7, 9]],
      [54, 9, [5, 7, 8]],
    ][randInt(0, 4)];
    return choiceQuestion(
      `Which number is a factor of ${total}?`,
      factor,
      wrong,
      `A factor divides ${total} with no remainder.`
    );
  },
  () => {
    const denominator = [2, 3, 4, 5][randInt(0, 3)];
    const groupSize = randInt(2, 9);
    return numberQuestion(
      `What is 1/${denominator} of ${denominator * groupSize}?`,
      groupSize,
      `Divide ${denominator * groupSize} into ${denominator} equal groups.`,
      [-1, 1, 2, -2, denominator, -denominator]
    );
  },
  () => {
    const base = randInt(4, 18);
    const mean = base + 10;
    return numberQuestion(
      `Mia scored ${base}, ${base + 10}, and ${base + 20} points. What is the mean (average) score?`,
      mean,
      'Add the three scores, then divide by 3.',
      [-5, 5, -10, 10, 2, -2]
    );
  },
];

function say(text) {
  messageEl.textContent = text;
}

function getClawWorld() {
  claw.clawHead.getWorldPosition(clawWorld);
  return clawWorld;
}

// ---------------------------------------------------------------- toys
function createToy(entry, x, z, y = 0) {
  const group = buildPlushie(entry);
  group.position.set(x, y, z);
  group.rotation.y = rand(-0.85, 0.85);
  cabinet.add(group);

  const toy = {
    group,
    entry,
    x,
    z,
    y,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: group.userData.radius,
    height: group.userData.height,
    carried: false,
    dropping: false,
    holdX: 0,
    holdZ: 0,
  };
  state.toys.push(toy);
  return toy;
}

function getSupport(toy) {
  let support = 0;
  for (const other of state.toys) {
    if (other === toy || other.carried || other.dropping) continue;
    const reach = (toy.radius + other.radius) * 0.78;
    if (Math.hypot(toy.x - other.x, toy.z - other.z) > reach) continue;
    const top = other.y + other.height * 0.7;
    if (top <= toy.y + 0.2 && top > support) support = top;
  }
  return support;
}

function updateToys(dt) {
  for (let i = state.toys.length - 1; i >= 0; i -= 1) {
    const toy = state.toys[i];
    if (toy.dropping) {
      toy.y -= 2.2 * dt;
      toy.group.position.y = toy.y;
      toy.group.rotation.y += 2.8 * dt;
      toy.group.scale.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
      if (toy.y < -0.45) {
        cabinet.remove(toy.group);
        state.toys.splice(i, 1);
      }
      continue;
    }
    if (toy.carried) continue;

    // Slipped toys keep their sideways momentum and settle back into the pile.
    toy.x += toy.vx * dt;
    toy.z += toy.vz * dt;
    const drag = Math.exp(-2.6 * dt);
    toy.vx *= drag;
    toy.vz *= drag;

    const minX = PIT.minX + toy.radius * 0.65;
    const maxX = PIT.maxX - toy.radius * 0.65;
    const minZ = PIT.minZ + toy.radius * 0.65;
    const maxZ = PIT.maxZ - toy.radius * 0.65;
    if (toy.x < minX) {
      toy.x = minX;
      toy.vx = Math.abs(toy.vx) * 0.2;
    } else if (toy.x > maxX) {
      toy.x = maxX;
      toy.vx = -Math.abs(toy.vx) * 0.2;
    }
    if (toy.z < minZ) {
      toy.z = minZ;
      toy.vz = Math.abs(toy.vz) * 0.2;
    } else if (toy.z > maxZ) {
      toy.z = maxZ;
      toy.vz = -Math.abs(toy.vz) * 0.2;
    }

    const support = getSupport(toy);
    if (toy.y > support + 0.002) {
      toy.vy -= 13 * dt;
      toy.y += toy.vy * dt;
      if (toy.y <= support) {
        toy.y = support;
        if (toy.vy < -0.6) toy.vy *= -0.12;
        else toy.vy = 0;
      }
    } else if (toy.y < support - 0.03) {
      toy.y = support;
      toy.vy = 0;
    }

    const tiltBlend = 1 - Math.exp(-7 * dt);
    toy.group.rotation.z +=
      (clamp(-toy.vx * 0.18, -0.4, 0.4) - toy.group.rotation.z) * tiltBlend;
    toy.group.rotation.x +=
      (clamp(toy.vz * 0.18, -0.35, 0.35) - toy.group.rotation.x) * tiltBlend;
    toy.group.position.set(toy.x, toy.y, toy.z);
  }
}

function updateCarriedToy(dt) {
  const toy = state.carried;
  if (!toy) return;

  const hub = getClawWorld();
  const targetX = hub.x + toy.holdX;
  const targetZ = hub.z + toy.holdZ;
  const targetY = hub.y - toy.height * 0.56 - 0.16;

  // The toy hangs from the closed prongs on a damped spring. Its inertia
  // makes it lag, swing, and tilt as the claw moves sideways or lifts.
  const stiffness = 42;
  const damping = 7;
  toy.vx += ((targetX - toy.x) * stiffness - toy.vx * damping) * dt;
  toy.vz += ((targetZ - toy.z) * stiffness - toy.vz * damping) * dt;
  toy.vy += ((targetY - toy.y) * stiffness * 1.6 - toy.vy * (damping + 3.8)) * dt;
  toy.x += toy.vx * dt;
  toy.z += toy.vz * dt;
  toy.y += toy.vy * dt;

  const lag = Math.hypot(toy.x - targetX, toy.z - targetZ);
  const gripLimit = 0.065 + state.grip * 0.34;

  const tiltBlend = 1 - Math.exp(-9 * dt);
  toy.group.rotation.z +=
    (clamp(-toy.vx * 0.16, -0.32, 0.32) - toy.group.rotation.z) * tiltBlend;
  toy.group.rotation.x +=
    (clamp(toy.vz * 0.16, -0.3, 0.3) - toy.group.rotation.x) * tiltBlend;
  toy.group.position.set(toy.x, toy.y, toy.z);

  if (lag > gripLimit) slipToy();
}

function grabReach(toy) {
  return Math.max(0.3, toy.radius + 0.24);
}

function gripForToy(toy, distance) {
  const alignment = clamp(1 - distance / grabReach(toy), 0, 1);
  const sizeFactor = clamp(1.04 - Math.max(0, toy.height - 0.95) * 0.16, 0.72, 1);
  return clamp(0.08 + alignment * 0.92, 0.05, 1) * sizeFactor;
}

function findGrabCandidate() {
  const hub = getClawWorld();
  let best = null;
  let bestDistance = Infinity;
  for (const toy of state.toys) {
    if (toy.carried || toy.dropping) continue;
    const distance = Math.hypot(toy.x - hub.x, toy.z - hub.z);
    if (distance < grabReach(toy) && distance < bestDistance) {
      best = toy;
      bestDistance = distance;
    }
  }
  return best;
}

function spawnInitialToys() {
  for (const toy of state.toys) cabinet.remove(toy.group);
  state.toys = [];

  const uncaught = shuffle(PLUSHIES.filter((entry) => !state.collected.has(entry.id)));
  const pool = uncaught.length ? uncaught : shuffle(PLUSHIES);
  const inPit = pool.slice(0, PIT_CAPACITY);
  state.remaining = uncaught.length ? uncaught.slice(PIT_CAPACITY) : [];
  state.complete = state.collected.size >= PLUSHIES.length;

  let index = 0;
  for (let row = 0; row < GRID_Z.length; row += 1) {
    for (let col = 0; col < GRID_X.length; col += 1) {
      const entry = inPit[index];
      if (!entry) break;
      let x = GRID_X[col] + rand(-0.035, 0.035);
      let z = GRID_Z[row] + rand(-0.035, 0.035);
      let y = 0;
      if (TOPPER_INDEXES.has(index) && state.toys.length) {
        const host = state.toys[state.toys.length - 1];
        x = host.x + rand(-0.055, 0.055);
        z = host.z + rand(-0.045, 0.045);
        y = host.y + host.height * 0.7;
      }
      createToy(entry, x, z, y);
      index += 1;
    }
  }
}

function spawnReplacement() {
  if (state.remaining.length === 0 || state.complete) return;
  let x = rand(PIT.minX + 0.15, PIT.maxX - 0.1);
  let z = rand(PIT.minZ + 0.15, PIT.maxZ - 0.1);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const tx = rand(PIT.minX + 0.15, PIT.maxX - 0.1);
    const tz = rand(PIT.minZ + 0.15, PIT.maxZ - 0.1);
    const crowded = state.toys.some(
      (toy) => !toy.dropping && Math.hypot(toy.x - tx, toy.z - tz) < (toy.radius + 0.22)
    );
    if (!crowded) {
      x = tx;
      z = tz;
      break;
    }
  }
  createToy(state.remaining.pop(), x, z, 1.9);
}

// ------------------------------------------------------------- progress
function updateSaveNote() {
  dexSaveNote.textContent = storageAvailable
    ? 'Progress saves automatically in this browser.'
    : 'Progress cannot be saved in this browser.';
}

function loadProgress() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    storageAvailable = false;
    return;
  }
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    const validIds = new Set(PLUSHIES.map((entry) => entry.id));
    if (Array.isArray(data.caught)) {
      data.caught.forEach((id) => {
        if (validIds.has(id)) state.collected.add(id);
      });
    }
    if (Number.isFinite(data.tries)) state.plays = clamp(Math.floor(data.tries), 0, 999);
    if (Number.isFinite(data.streak)) state.streak = clamp(Math.floor(data.streak), 0, 999);
    if (Number.isFinite(data.bestStreak)) state.bestStreak = clamp(Math.floor(data.bestStreak), 0, 999);
    if (Number.isFinite(data.wins)) state.wins = clamp(Math.floor(data.wins), 0, 99999);
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.wins = Math.max(state.wins, state.collected.size);
    sound.setEnabled(data.muted !== true);
  } catch {
    // A bad save should never stop the machine from opening.
  }
}

function saveProgress() {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        caught: [...state.collected],
        tries: state.plays,
        streak: state.streak,
        bestStreak: state.bestStreak,
        wins: state.wins,
        muted: !sound.isEnabled(),
      })
    );
  } catch {
    storageAvailable = false;
    updateSaveNote();
  }
}

function updateMuteButton() {
  const enabled = sound.isEnabled();
  muteButton.textContent = enabled ? '🔊' : '🔇';
  muteButton.setAttribute('aria-pressed', String(!enabled));
  muteButton.setAttribute(
    'aria-label',
    enabled ? 'Mute music and sounds' : 'Turn music and sounds on'
  );
}

// ------------------------------------------------------------------ dex
function buildDex() {
  dexGrid.replaceChildren();
  dexCardEls.clear();

  PLUSHIES.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = `dex-card needed rarity-${entry.rarity}`;
    card.setAttribute('role', 'listitem');
    card.dataset.family = entry.family;

    const number = document.createElement('span');
    number.className = 'dex-number';
    number.textContent = `#${String(index + 1).padStart(3, '0')}`;

    const rarity = document.createElement('span');
    rarity.className = 'dex-rarity';
    rarity.textContent = entry.rarity;

    const art = document.createElement('span');
    art.className = 'dex-art';
    art.setAttribute('aria-hidden', 'true');
    art.textContent = BASE_ICONS[entry.base] || FAMILY_ICONS[entry.family] || '?';

    const name = document.createElement('h3');
    name.className = 'dex-name';
    name.textContent = '???';

    const meta = document.createElement('p');
    meta.className = 'dex-meta';
    meta.textContent = FAMILY_LABELS[entry.family] || entry.family;

    const status = document.createElement('span');
    status.className = 'dex-status';
    status.textContent = 'STILL NEEDED';

    card.setAttribute('aria-label', `Number ${index + 1}, unknown plushie`);
    card.append(number, rarity, art, name, meta, status);
    dexGrid.append(card);
    dexCardEls.set(entry.id, card);

    if (state.collected.has(entry.id)) markCaught(entry, card, false);
  });

  applyDexFilter(dexFilter);
  updateDexProgress();
}

function markCaught(entry, card, animate = true) {
  card.classList.remove('needed');
  card.classList.add('caught');
  card.querySelector('.dex-art').textContent =
    BASE_ICONS[entry.base] || FAMILY_ICONS[entry.family] || '★';
  card.querySelector('.dex-name').textContent = entry.name;
  card.querySelector('.dex-meta').textContent =
    `${FAMILY_LABELS[entry.family]} · ${entry.rarity.charAt(0).toUpperCase()}${entry.rarity.slice(1)}`;
  card.querySelector('.dex-status').textContent = 'CAUGHT!';
  card.setAttribute(
    'aria-label',
    `Number ${dexNumbers.get(entry.id)}, ${entry.name}, caught, ${entry.rarity}`
  );

  if (animate) {
    card.classList.remove('just-caught');
    void card.offsetWidth;
    card.classList.add('just-caught');
    window.setTimeout(() => card.classList.remove('just-caught'), 3600);
  }
}

function revealDexCard(entry) {
  const card = dexCardEls.get(entry.id);
  if (!card) return;
  markCaught(entry, card, true);
  applyDexFilter(dexFilter);
}

function applyDexFilter(filter) {
  dexFilter = filter;
  dexFilterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  });

  let visible = 0;
  PLUSHIES.forEach((entry) => {
    const card = dexCardEls.get(entry.id);
    if (!card) return;
    const caught = card.classList.contains('caught');
    const show =
      filter === 'all' ||
      filter === entry.family ||
      (filter === 'caught' && caught) ||
      (filter === 'needed' && !caught);
    card.hidden = !show;
    if (show) visible += 1;
  });

  dexEmptyEl.hidden = visible > 0;
  if (visible === 0) {
    dexEmptyEl.textContent =
      filter === 'needed'
        ? 'You caught every plushie! Amazing!'
        : filter === 'caught'
          ? 'No plushies caught yet. Drop the claw!'
          : 'No plushies here yet.';
  }
}

function updateDexProgress() {
  const caught = state.collected.size;
  const percent = Math.round((caught / PLUSHIES.length) * 100);
  dexCountEl.textContent = `${caught} caught`;
  dexNeededEl.textContent = `${PLUSHIES.length - caught} to find`;
  dexPercentEl.textContent = `${percent}%`;
  dexProgressFill.style.width = `${percent}%`;
  dexProgressEl.setAttribute('aria-valuenow', String(caught));
  dexRecordEl.textContent =
    `🔥 Best streak: ${state.bestStreak} · 🏆 ${state.wins} ${state.wins === 1 ? 'catch' : 'catches'}`;
}

function updateHud() {
  prizeCountEl.textContent = `${state.collected.size} / ${PLUSHIES.length}`;
  playsCountEl.textContent = String(state.plays);
  streakCountEl.textContent = state.streak > 0 ? `${state.streak} 🔥` : '0';
  updateDexProgress();

  moveButtons.forEach((button) => {
    button.disabled = state.busy || state.complete;
  });
  resetButton.disabled = state.busy;

  if (state.busy) {
    dropButton.disabled = true;
    dropButton.textContent = 'CLAW BUSY';
    dropButton.classList.add('busy');
    dropButton.classList.remove('rescue');
  } else if (state.complete) {
    dropButton.disabled = true;
    dropButton.classList.remove('busy');
    dropButton.classList.remove('rescue');
    dropButton.textContent = 'DEX COMPLETE!';
  } else {
    dropButton.disabled = false;
    dropButton.classList.remove('busy');
    dropButton.classList.toggle('rescue', state.plays <= 0);
    dropButton.textContent = state.plays <= 0 ? 'MATH RESCUE' : 'DROP CLAW';
  }
}

// --------------------------------------------------------- math rescue
function newMathQuestion() {
  window.clearTimeout(mathCloseTimer);
  mathSolved = false;
  if (mathBag.length === 0) mathBag = shuffle(MATH_MAKERS);
  currentMathQuestion = mathBag.pop()();

  mathQuestionEl.textContent = currentMathQuestion.question;
  mathFeedbackEl.textContent = '';
  mathFeedbackEl.className = 'math-feedback';
  mathHintEl.textContent = currentMathQuestion.hint;
  mathHintEl.hidden = true;
  mathHintButton.disabled = false;
  mathNewButton.disabled = false;
  mathAnswersEl.replaceChildren();

  for (const choice of currentMathQuestion.choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'math-answer';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      sound.unlock();
      answerMath(button, choice);
    });
    mathAnswersEl.append(button);
  }
}

function answerMath(button, choice) {
  if (mathSolved) return;

  if (choice.correct) {
    mathSolved = true;
    mathAnswersEl.querySelectorAll('button').forEach((answerButton) => {
      answerButton.disabled = true;
    });
    button.classList.add('correct');
    mathFeedbackEl.textContent = `✅ Correct! +${MATH_REWARD} tries — claw powered up!`;
    mathFeedbackEl.classList.add('success');
    mathHintEl.hidden = true;
    mathHintButton.disabled = true;
    mathNewButton.disabled = true;

    state.plays = Math.min(999, state.plays + MATH_REWARD);
    updateHud();
    saveProgress();
    sound.win(false);
    say(`Math power! +${MATH_REWARD} tries. Back to the claw!`);

    mathCloseTimer = window.setTimeout(() => {
      if (mathDialog.open) mathDialog.close();
      dropButton.focus({ preventScroll: true });
    }, 1100);
    return;
  }

  button.disabled = true;
  button.classList.add('wrong');
  mathFeedbackEl.textContent = 'Not quite — try another answer. You got this!';
  mathFeedbackEl.classList.remove('success');
  mathHintEl.hidden = false;
  sound.miss();
}

function openMathRescue() {
  if (state.complete || state.plays > 0) return;
  window.clearTimeout(mathPromptTimer);
  if (!mathDialog.open) {
    newMathQuestion();
    mathDialog.showModal();
  }
  window.setTimeout(() => {
    if (mathDialog.open) {
      mathAnswersEl.querySelector('button')?.focus({ preventScroll: true });
    }
  }, 0);
}

function queueMathRescue(delay = 750) {
  window.clearTimeout(mathPromptTimer);
  if (state.complete || state.plays > 0) return;
  mathPromptTimer = window.setTimeout(() => {
    if (!state.busy && !state.complete && state.plays <= 0 && !document.hidden) {
      openMathRescue();
    }
  }, delay);
}

function closeMathRescue() {
  window.clearTimeout(mathPromptTimer);
  window.clearTimeout(mathCloseTimer);
  if (mathDialog.open) mathDialog.close();
}

function showBanner(entry) {
  winKicker.textContent = state.streak >= 2 ? `🔥 ${state.streak} IN A ROW!` : 'NEW PLUSHIE!';
  winName.textContent = entry.name;
  winMeta.textContent =
    `#${String(dexNumbers.get(entry.id)).padStart(3, '0')} · ` +
    `${FAMILY_LABELS[entry.family]} · +2 tries`;
  winBanner.classList.toggle('legendary', entry.rarity === 'legendary');
  winBanner.classList.add('show');
  window.clearTimeout(bannerTimeout);
  bannerTimeout = window.setTimeout(() => winBanner.classList.remove('show'), 3000);
}

function awardPrize(entry) {
  if (state.collected.has(entry.id)) return;
  state.collected.add(entry.id);
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.wins += 1;
  state.turnWon = true;
  state.plays += 2;
  if (state.collected.size >= PLUSHIES.length) state.complete = true;

  revealDexCard(entry);
  showBanner(entry);
  updateHud();
  saveProgress();

  if (state.complete) {
    sound.complete();
    say('DEX COMPLETE! You caught all 100! Open the Plushie Dex and tap Start Over to hunt again.');
  } else {
    sound.win(entry.rarity === 'legendary');
    if (state.streak >= 3) {
      say(`🔥 ${state.streak} in a row! NEW: ${entry.name}. +2 tries!`);
    } else {
      say(`NEW! You caught ${entry.name}! +2 tries.`);
    }
  }
}

// ------------------------------------------------------------ confetti
const CONFETTI_GEO = new THREE.BoxGeometry(0.06, 0.06, 0.014);
const CONFETTI_COLORS = ['#ff2e63', '#ffd93d', '#2ec4ff', '#3ddc84', '#a855f7', '#ff8a00'];
const CONFETTI_MATS = new Map();

function spawnConfetti(x, y, z, count = 26) {
  for (let i = 0; i < count; i += 1) {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    if (!CONFETTI_MATS.has(color)) {
      CONFETTI_MATS.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    const piece = new THREE.Mesh(CONFETTI_GEO, CONFETTI_MATS.get(color));
    piece.position.set(x + rand(-0.2, 0.2), y + rand(-0.12, 0.2), z + rand(-0.2, 0.2));
    piece.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    scene.add(piece);
    state.confetti.push({
      mesh: piece,
      vx: rand(-1.4, 1.4),
      vy: rand(1.6, 3.6),
      vz: rand(-1.4, 1.4),
      sx: rand(-5, 5),
      sy: rand(-5, 5),
      life: rand(1.1, 2.1),
    });
  }
}

function updateConfetti(dt) {
  for (let i = state.confetti.length - 1; i >= 0; i -= 1) {
    const bit = state.confetti[i];
    bit.life -= dt;
    if (bit.life <= 0) {
      scene.remove(bit.mesh);
      state.confetti.splice(i, 1);
      continue;
    }
    bit.vy -= 6.5 * dt;
    bit.mesh.position.x += bit.vx * dt;
    bit.mesh.position.y += bit.vy * dt;
    bit.mesh.position.z += bit.vz * dt;
    bit.mesh.rotation.x += bit.sx * dt;
    bit.mesh.rotation.y += bit.sy * dt;
  }
}

// --------------------------------------------------------------- reset
function resetMachine({ resetTries = false, announce = true } = {}) {
  state.phase = 'idle';
  state.phaseTime = 0;
  state.busy = false;
  state.gantryX = 0;
  state.gantryZ = 0;
  state.targetX = 0;
  state.targetZ = 0;
  state.hubY = CLAW_REST;
  state.targetHubY = CLAW_REST;
  state.clawOpen = 0.65;
  state.clawOpenTarget = 0.65;
  state.candidate = null;
  state.carried = null;
  state.grip = 0;
  state.turnWon = false;
  state.respawnTimer = 0;
  if (resetTries) state.plays = START_TRIES;

  for (const bit of state.confetti) scene.remove(bit.mesh);
  state.confetti = [];
  winBanner.classList.remove('show');

  spawnInitialToys();
  updateHud();
  saveProgress();
  if (resetTries) closeMathRescue();

  if (announce) {
    if (state.complete) {
      say('Your dex is complete! Open the Plushie Dex and tap Start Over to hunt again.');
    } else if (resetTries) {
      say('Machine refilled! Your Plushie Dex is safe.');
    } else {
      say('Move the claw over a plushie, then drop!');
    }
  }
}

function resetGame() {
  sound.refill();
  resetMachine({ resetTries: true });
}

function resetProgressPrompt() {
  resetArmed = false;
  resetProgressButton.textContent = 'Start Over';
  resetProgressButton.classList.remove('confirm');
  window.clearTimeout(resetArmTimer);
}

function startOver() {
  resetProgressPrompt();
  dexFilter = 'all';
  state.collected.clear();
  state.plays = START_TRIES;
  state.streak = 0;
  state.bestStreak = 0;
  state.wins = 0;
  state.complete = false;
  state.turnWon = false;
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    storageAvailable = false;
  }

  buildDex();
  resetMachine({ resetTries: true, announce: false });
  saveProgress();
  sound.grab();
  say('Fresh start! 100 plushies are waiting to be caught.');
}

function handleResetProgress() {
  if (!resetArmed) {
    resetArmed = true;
    resetProgressButton.textContent = 'Tap again to erase';
    resetProgressButton.classList.add('confirm');
    window.clearTimeout(resetArmTimer);
    resetArmTimer = window.setTimeout(resetProgressPrompt, 5000);
    sound.click();
    return;
  }
  startOver();
}

// -------------------------------------------------------------- controls
function inputVector() {
  let x = 0;
  let z = 0;
  if (held.left || keys.has('left')) x -= 1;
  if (held.right || keys.has('right')) x += 1;
  if (held.up || keys.has('up')) z -= 1;
  if (held.down || keys.has('down')) z += 1;
  if (x !== 0 && z !== 0) {
    x *= 0.707;
    z *= 0.707;
  }
  return { x, z };
}

function clearInputs() {
  held.left = false;
  held.right = false;
  held.up = false;
  held.down = false;
  keys.clear();
}

function setupInput() {
  for (const button of moveButtons) {
    const direction = button.dataset.move;
    const press = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      sound.unlock();
      sound.move();
      held[direction] = true;
    };
    const release = () => {
      held[direction] = false;
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  dropButton.addEventListener('click', () => {
    sound.unlock();
    requestDrop();
  });
  resetButton.addEventListener('click', () => {
    sound.unlock();
    resetGame();
  });
  muteButton.addEventListener('click', () => {
    sound.unlock();
    sound.setEnabled(!sound.isEnabled());
    if (sound.isEnabled()) sound.click();
    updateMuteButton();
    saveProgress();
  });

  /*
   * Full screen keeps the page from scrolling under small thumbs.
   * Hidden where the browser has no element full screen (for example an iframe).
   */
  const fullscreenButton = document.querySelector('#fullscreen-button');
  const gameShell = document.querySelector('.claw-game');
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
        sound.unlock();
        sound.click();
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
        resize();
      });
    }
  }
  resetProgressButton.addEventListener('click', () => {
    sound.unlock();
    handleResetProgress();
  });
  mathNewButton.addEventListener('click', () => {
    sound.unlock();
    sound.click();
    newMathQuestion();
    mathAnswersEl.querySelector('button')?.focus({ preventScroll: true });
  });
  mathHintButton.addEventListener('click', () => {
    sound.unlock();
    sound.click();
    mathHintEl.hidden = false;
  });
  mathLaterButton.addEventListener('click', () => {
    sound.unlock();
    sound.click();
    closeMathRescue();
  });
  mathDialog.addEventListener('close', () => {
    window.clearTimeout(mathCloseTimer);
    if (!state.complete && state.plays <= 0) {
      say('Out of tries — tap MATH RESCUE to solve a math mission.');
      dropButton.focus({ preventScroll: true });
    }
  });
  dexFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      sound.unlock();
      sound.click();
      applyDexFilter(button.dataset.filter);
    });
  });

  container.addEventListener('pointerdown', () => {
    sound.unlock();
    container.focus({ preventScroll: true });
  });

  container.addEventListener('pointermove', (event) => {
    const rect = container.getBoundingClientRect();
    parallax.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    parallax.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });
  container.addEventListener('pointerleave', () => {
    parallax.targetX = 0;
    parallax.targetY = 0;
  });

  const keyMap = {
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
  };

  container.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const direction = keyMap[key];
    if (direction) {
      event.preventDefault();
      sound.unlock();
      if (!event.repeat) sound.move();
      keys.add(direction);
    }
    if (key === ' ' || key === 'enter') {
      event.preventDefault();
      requestDrop();
    }
  });

  container.addEventListener('keyup', (event) => {
    const direction = keyMap[event.key.toLowerCase()];
    if (direction) {
      event.preventDefault();
      keys.delete(direction);
    }
  });

  window.addEventListener('blur', clearInputs);
  window.addEventListener('pagehide', saveProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveProgress();
      sound.pause();
    } else {
      sound.resume();
    }
  });
  renderer.domElement.addEventListener('pointerdown', () => container.focus({ preventScroll: true }));
}

// ------------------------------------------------------------- claw cycle
function requestDrop() {
  if (state.busy) return;
  sound.unlock();
  if (state.complete) {
    say('Dex complete! Open the Plushie Dex and tap Start Over to hunt again.');
    return;
  }
  if (state.plays <= 0) {
    say('Out of tries! Solve a math rescue mission to earn more.');
    openMathRescue();
    return;
  }
  if (state.toys.length === 0) {
    say('The machine is restocking — one moment!');
    return;
  }

  state.plays -= 1;
  state.busy = true;
  state.phase = 'descend';
  state.phaseTime = 0;
  state.candidate = null;
  state.carried = null;
  state.grip = 0;
  state.turnWon = false;
  state.targetHubY = CLAW_DROP;
  state.clawOpenTarget = 0.8;
  updateHud();
  saveProgress();
  sound.drop();
  say('Claw descending…');
}

function attachCandidate() {
  const toy = state.candidate;
  if (!toy) return;
  const hub = getClawWorld();
  const dx = toy.x - hub.x;
  const dz = toy.z - hub.z;
  const distance = Math.hypot(dx, dz);
  const grip = gripForToy(toy, distance);

  toy.carried = true;
  toy.vx = 0;
  toy.vz = 0;
  toy.vy = 0;
  toy.holdX = clamp(dx * 0.5, -0.2, 0.2);
  toy.holdZ = clamp(dz * 0.5, -0.2, 0.2);
  state.carried = toy;
  state.grip = grip;
  state.candidate = null;

  sound.grab();
  const quality =
    grip > 0.72 ? 'Nice grip! Hold on tight…' : grip > 0.44 ? 'It feels wobbly…' : 'Barely holding on!';
  say(`Got ${toy.entry.name}! ${quality}`);
}

function slipToy() {
  const toy = state.carried;
  if (!toy) return;

  toy.carried = false;
  toy.x = clamp(toy.x, PIT.minX + toy.radius * 0.65, PIT.maxX - toy.radius * 0.65);
  toy.z = clamp(toy.z, PIT.minZ + toy.radius * 0.65, PIT.maxZ - toy.radius * 0.65);
  toy.y = Math.max(0.06, toy.y);
  toy.vx = clamp(toy.vx, -1.4, 1.4);
  toy.vz = clamp(toy.vz, -1.4, 1.4);
  toy.vy = Math.min(0.12, toy.vy);
  toy.group.position.set(toy.x, toy.y, toy.z);

  state.carried = null;
  state.grip = 0;
  state.candidate = null;
  sound.slip();
  say('Whoops — it slipped! Aim closer to the middle for a stronger grip.');
}

function releasePrize() {
  const toy = state.carried;
  if (!toy) return;
  toy.carried = false;
  toy.dropping = true;
  toy.x = CHUTE.x;
  toy.z = CHUTE.z;
  toy.y = Math.max(1.05, toy.group.position.y);
  toy.group.position.set(toy.x, toy.y, toy.z);
  toy.group.rotation.z = 0;
  state.carried = null;
  awardPrize(toy.entry);
  spawnConfetti(CHUTE.x, 1.35, CHUTE.z, toy.entry.rarity === 'legendary' ? 46 : 28);
  spawnConfetti(0, 1.2, 0.4, 12);
  state.respawnTimer = 1.25;
}

function distanceToChute() {
  return Math.hypot(state.gantryX - CHUTE.x, state.gantryZ - CHUTE.z);
}

function updatePhase(dt) {
  state.phaseTime += dt;

  if (state.phase === 'descend') {
    state.clawOpenTarget = 0.8;
    if (state.hubY < CLAW_DROP + 0.035) {
      state.phase = 'close';
      state.phaseTime = 0;
      state.clawOpenTarget = 0.04;
      state.candidate = findGrabCandidate();
      if (!state.candidate) {
        sound.miss();
        say('Nothing in the claw… try lining it up!');
      }
    }
    return;
  }

  if (state.phase === 'close') {
    if (state.phaseTime > 0.42) {
      if (state.candidate) attachCandidate();
      state.targetHubY = CLAW_REST;
      state.phase = 'lift';
      state.phaseTime = 0;
    }
    return;
  }

  if (state.phase === 'lift') {
    state.clawOpenTarget = 0.03;
    if (state.hubY > CLAW_REST - 0.06) {
      state.phaseTime = 0;
      if (state.carried) {
        state.phase = 'toChute';
        state.targetX = CHUTE.x;
        state.targetZ = CHUTE.z;
        say('Prize secured! Taking it to the chute…');
      } else {
        state.phase = 'return';
        state.targetX = 0;
        state.targetZ = 0;
      }
    }
    return;
  }

  if (state.phase === 'toChute') {
    state.clawOpenTarget = 0.03;
    if (distanceToChute() < 0.055) {
      state.phase = 'release';
      state.phaseTime = 0;
      state.clawOpenTarget = 1;
      if (state.carried) say('Open the claw…');
    }
    return;
  }

  if (state.phase === 'release') {
    state.clawOpenTarget = 1;
    if (state.phaseTime > 0.3 && state.carried) releasePrize();
    if (state.phaseTime > 0.72) {
      state.phase = 'return';
      state.phaseTime = 0;
      state.targetX = 0;
      state.targetZ = 0;
    }
    return;
  }

  if (state.phase === 'return') {
    state.clawOpenTarget = 0.65;
    if (Math.hypot(state.gantryX, state.gantryZ) < 0.07 && state.hubY > CLAW_REST - 0.08) {
      state.phase = 'idle';
      state.phaseTime = 0;
      state.busy = false;
      state.candidate = null;
      if (!state.turnWon) state.streak = 0;
      updateHud();
      saveProgress();
      if (state.plays <= 0) queueMathRescue();
    }
  }
}

// ------------------------------------------------------------- animation
function updateClawRig(dt) {
  if (!state.busy) {
    const input = inputVector();
    if (input.x || input.z) {
      state.targetX = clamp(state.targetX + input.x * 1.35 * dt, CLAW_MIN_X, CLAW_MAX_X);
      state.targetZ = clamp(state.targetZ + input.z * 1.2 * dt, CLAW_MIN_Z, CLAW_MAX_Z);
    }
  }

  const following = !state.busy || state.phase === 'toChute' || state.phase === 'return';
  if (following) {
    const follow = 1 - Math.exp(-7 * dt);
    let stepX = (state.targetX - state.gantryX) * follow;
    let stepZ = (state.targetZ - state.gantryZ) * follow;
    const maxStep = 1.35 * dt;
    const stepLength = Math.hypot(stepX, stepZ);
    if (stepLength > maxStep) {
      const scale = maxStep / stepLength;
      stepX *= scale;
      stepZ *= scale;
    }
    state.gantryX += stepX;
    state.gantryZ += stepZ;
  }

  claw.bridge.position.z = state.gantryZ;
  claw.trolley.position.x = state.gantryX;

  const dropping = state.phase === 'descend' || state.phase === 'lift';
  const rate = dropping ? 4.4 : 9;
  let stepY = (state.targetHubY - state.hubY) * (1 - Math.exp(-rate * dt));
  const maxStepY = (dropping ? 1.35 : 4.5) * dt;
  if (Math.abs(stepY) > maxStepY) stepY = Math.sign(stepY) * maxStepY;
  state.hubY += stepY;
  if (Math.abs(state.targetHubY - state.hubY) < 0.002) state.hubY = state.targetHubY;

  state.clawOpen += (state.clawOpenTarget - state.clawOpen) * (1 - Math.exp(-10 * dt));
  claw.prongs.forEach((pivot) => {
    pivot.rotation.x = 0.05 + state.clawOpen * 0.62;
  });

  const length = Math.max(0.2, CAB.bridgeY - state.hubY);
  claw.cable.scale.y = length;
  claw.cable.position.y = -length / 2;
  claw.clawHead.position.y = -length;
}

function updateCamera(dt) {
  parallax.x += (parallax.targetX - parallax.x) * (1 - Math.exp(-4 * dt));
  parallax.y += (parallax.targetY - parallax.y) * (1 - Math.exp(-4 * dt));
  camera.position.copy(cameraBase);
  camera.position.x += parallax.x * 0.36;
  camera.position.y += parallax.y * 0.12;
  camera.lookAt(cameraTarget);
}

function grabReadiness() {
  let best = 0;
  for (const toy of state.toys) {
    if (toy.carried || toy.dropping) continue;
    const distance = Math.hypot(toy.x - state.gantryX, toy.z - state.gantryZ);
    if (distance < grabReach(toy)) best = Math.max(best, gripForToy(toy, distance));
  }
  return best;
}

function updateTargetRing() {
  targetRing.position.x = state.gantryX;
  targetRing.position.z = state.gantryZ;
  targetRing.visible = state.phase === 'idle' && !state.complete;
  if (!targetRing.visible) return;

  const readiness = grabReadiness();
  targetRing.material.color.setRGB(
    1 - readiness * 0.76,
    0.84 + readiness * 0.02,
    0.24 + readiness * 0.28
  );
  targetRing.material.opacity = 0.4 + readiness * 0.55;
  const pulse = 1 + Math.sin(state.time * 5.5) * (0.03 + readiness * 0.06);
  targetRing.scale.setScalar(pulse);
}

function updateRespawn(dt) {
  if (state.respawnTimer <= 0) return;
  state.respawnTimer -= dt;
  if (state.respawnTimer <= 0) spawnReplacement();
}

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  state.time += dt;
  updateCamera(dt);
  updateClawRig(dt);
  updatePhase(dt);
  updateCarriedToy(dt);
  updateToys(dt);
  updateTargetRing();
  updateConfetti(dt);
  updateRespawn(dt);
  renderer.render(scene, camera);
}

loadProgress();
setupInput();
buildDex();
resetMachine({ announce: false });
updateMuteButton();
updateSaveNote();

if (state.complete) {
  say('Your Plushie Dex is complete! Tap Start Over inside the dex to hunt again.');
} else if (state.collected.size > 0) {
  say(
    `Welcome back! ${state.collected.size} caught — ` +
      `${PLUSHIES.length - state.collected.size} plushies still to find.`
  );
}

if (state.plays <= 0 && !state.complete) queueMathRescue(900);

renderer.setAnimationLoop(animate);

// Stop drawing when the player scrolls to the dex or another page section.
const visibilityObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      clock.getDelta();
      renderer.setAnimationLoop(animate);
    } else {
      renderer.setAnimationLoop(null);
    }
  },
  { threshold: 0.03 }
);
visibilityObserver.observe(container);
