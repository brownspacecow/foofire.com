import * as THREE from 'three';
import { createAudio } from './audio.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

const container = document.querySelector('#game-container');
const healthFill = document.querySelector('#health-fill');
const healthLabel = document.querySelector('#health-label');
const waveLabel = document.querySelector('#wave-label');
const scoreLabel = document.querySelector('#score-label');
const bestLabel = document.querySelector('#best-label');
const killsLabel = document.querySelector('#kills-label');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const startButton = document.querySelector('#start-button');
const banner = document.querySelector('#banner');
const bannerText = banner.querySelector('span');
const vignette = document.querySelector('#vignette');
const crosshair = document.querySelector('#crosshair');
const statusEl = document.querySelector('#status');
const muteButton = document.querySelector('#mute-button');

/* ------------------------------------------------------------------ *
 * Sound
 * ------------------------------------------------------------------ */

const audio = createAudio();

if (readMuted('zombieDeerMuted')) audio.setMuted(true);

const refreshMuteButton = () => {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound effects' : 'Mute sound effects');
};

refreshMuteButton();

/*
 * Full screen keeps the page from scrolling under small thumbs.
 * Hidden where the browser has no element full screen (e.g. iPhone Safari).
 */
const fullscreenButton = document.querySelector('#fullscreen-button');
const gameShell = document.querySelector('.deer-game');
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
        /* Full screen can be refused (for example inside an embedded frame). */
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

muteButton.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  writeMuted(audio.isMuted());
  refreshMuteButton();
  if (!audio.isMuted()) audio.uiClick();
});

/* Timed waves freeze when the tab goes away. */
const autoPause = createAutoPause({
  container,
  audio,
  muteButton,
  shouldPause: () => state.phase === 'wave' || state.phase === 'break',
  message: 'Snowball fight paused',
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function makeTexture(draw, repeatX, repeatY) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* Horizontal lap siding, one tile = eight boards. */
function drawSiding(ctx) {
  ctx.fillStyle = '#4d6070';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.045})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = 'rgba(12, 20, 28, 0.34)';
    ctx.fillRect(0, y + 13, 128, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(0, y + 12, 128, 1);
  }
}

/* Soft, trodden snow. */
function drawSnow(ctx) {
  ctx.fillStyle = '#eef4fa';
  ctx.fillRect(0, 0, 128, 128);
  const colors = ['#dfe9f4', '#e6eff8', '#d6e2ef', '#f7faff', '#cfdcea'];
  for (let i = 0; i < 240; i += 1) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 128, Math.random() * 128, Math.random() * 14 + 2, Math.random() * 9 + 1, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 600; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#c3d3e4';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/* Weathered roof shingles. */
function drawShingles(ctx) {
  ctx.fillStyle = '#6f6a60';
  ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row += 1) {
    const y = row * 16;
    ctx.fillStyle = row % 2 ? '#675f56' : '#756f63';
    ctx.fillRect(0, y, 128, 16);
    ctx.fillStyle = 'rgba(20, 18, 16, 0.35)';
    ctx.fillRect(0, y + 14, 128, 2);
    for (let col = 0; col < 8; col += 1) {
      const x = col * 16 + (row % 2 ? 8 : 0);
      ctx.fillStyle = 'rgba(20, 18, 16, 0.22)';
      ctx.fillRect(x, y, 1, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x + 1, y + 1, 14, 1);
    }
  }
}

/* Winter dusk gradient used as the scene background. */
function makeSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#02040d');
  gradient.addColorStop(0.3, '#060d20');
  gradient.addColorStop(0.58, '#0d1a37');
  gradient.addColorStop(0.84, '#1a2c50');
  gradient.addColorStop(1, '#2b4069');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ *
 * Renderer, scene, camera
 * ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSky();
scene.fog = new THREE.Fog(0x131f38, 52, 168);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
const CAM_BASE = new THREE.Vector3(0, 7.8, 26);
const CAM_TARGET = new THREE.Vector3(0, 3.2, -9);
camera.position.copy(CAM_BASE);
camera.lookAt(CAM_TARGET);
scene.add(camera);

const BASE_FOV = 58;
const MAX_FOV = 80;
/* Half the yard that must stay on screen: the yard tree and its star sit at
   x≈9.8, the snowman at x≈-10.5. */
const MIN_HALF_WIDTH = 14;
const YARD_DEPTH = 29.5; // camera z 26 → tree and snowman plane
let cameraBack = 0;

/* Narrow screens (phones, tall windows, full screen) crop the sides of the
   yard first, so widen the lens until the tree and snowman fit, then step the
   camera back if even the widest lens is not enough. */
const sizeScene = () => {
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 400;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  const neededTan = MIN_HALF_WIDTH / (YARD_DEPTH * camera.aspect);
  camera.fov = clamp((2 * Math.atan(neededTan) * 180) / Math.PI, BASE_FOV, MAX_FOV);
  camera.updateProjectionMatrix();

  const fitDistance = MIN_HALF_WIDTH / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
  cameraBack = Math.max(0, fitDistance - YARD_DEPTH);
};

/* ------------------------------------------------------------------ *
 * Lights
 * ------------------------------------------------------------------ */

scene.add(new THREE.HemisphereLight(0x9cc0ff, 0x27304a, 1.0));

/* The moon is the key light, so the whole yard reads cold, blue and frosty. */
const moonlight = new THREE.DirectionalLight(0xd2e4ff, 1.55);
moonlight.position.set(-30, 26, -18);
moonlight.castShadow = true;
moonlight.shadow.mapSize.set(2048, 2048);
moonlight.shadow.camera.left = -42;
moonlight.shadow.camera.right = 42;
moonlight.shadow.camera.top = 40;
moonlight.shadow.camera.bottom = -22;
moonlight.shadow.camera.near = 1;
moonlight.shadow.camera.far = 110;
moonlight.shadow.bias = -0.0006;
moonlight.shadow.normalBias = 0.02;
scene.add(moonlight);

/* A soft fill so the reindeer stay readable against the moonlit snow. */
const fillLight = new THREE.DirectionalLight(0x8fb2e6, 0.55);
fillLight.position.set(16, 14, 30);
scene.add(fillLight);

/* Warm lantern glow spilling off the porch. */
const porchGlow = new THREE.PointLight(0xffb45e, 2.6, 30, 2);
porchGlow.position.set(0, 3.4, -9.5);
scene.add(porchGlow);

/* ------------------------------------------------------------------ *
 * Christmas night sky: moon, stars and aurora
 * ------------------------------------------------------------------ */

function makeMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  base.addColorStop(0, '#fffdf4');
  base.addColorStop(0.72, '#f6f0d8');
  base.addColorStop(1, '#dae4ef');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();

  const craters = [
    [100, 108, 19],
    [150, 94, 12],
    [126, 160, 15],
    [88, 154, 9],
    [172, 142, 8],
    [118, 72, 7],
  ];
  for (const [x, y, radius] of craters) {
    const crater = ctx.createRadialGradient(x, y, 0, x, y, radius);
    crater.addColorStop(0, 'rgba(206,204,184,0.3)');
    crater.addColorStop(0.7, 'rgba(220,219,200,0.14)');
    crater.addColorStop(1, 'rgba(240,238,222,0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMoonGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,250,226,0.9)');
  glow.addColorStop(0.3, 'rgba(208,228,255,0.34)');
  glow.addColorStop(0.66, 'rgba(150,190,255,0.12)');
  glow.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeAuroraTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const bands = ['rgba(122,255,206,', 'rgba(96,196,255,', 'rgba(184,140,255,'];
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i += 1) {
    const rgb = bands[Math.floor(Math.random() * bands.length)];
    /* Soft, narrow, tall blobs read as a curtain instead of hard stripes. */
    ctx.save();
    ctx.translate(rand(0, 256), rand(60, 240));
    ctx.scale(rand(0.14, 0.4), rand(0.9, 1.8));
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rand(70, 120));
    glow.addColorStop(0, `${rgb}${(0.2 + Math.random() * 0.3).toFixed(2)})`);
    glow.addColorStop(0.55, `${rgb}0.1)`);
    glow.addColorStop(1, `${rgb}0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(canvas);
}

const moon = new THREE.Group();
const moonDisc = new THREE.Mesh(
  new THREE.CircleGeometry(6.4, 48),
  new THREE.MeshBasicMaterial({ map: makeMoonTexture(), fog: false, toneMapped: false })
);
moonDisc.userData.isMoon = true;
moon.add(moonDisc);

const moonGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(34, 34),
  new THREE.MeshBasicMaterial({
    map: makeMoonGlowTexture(),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
);
moonGlow.position.z = -0.4;
moon.add(moonGlow);
moon.position.set(-21, 31, -82);
scene.add(moon);

const moonHitbox = moonDisc;
let moonPulse = 0;

const STAR_COUNT = 760;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i += 1) {
  starPositions[i * 3] = rand(-180, 180);
  starPositions[i * 3 + 1] = rand(14, 165);
  starPositions[i * 3 + 2] = rand(-200, -30);
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0xe8f0ff,
    size: 1.7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
  })
);
stars.frustumCulled = false;
scene.add(stars);

const auroraLayers = [];
for (let i = 0; i < 2; i += 1) {
  const texture = makeAuroraTexture();
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 82),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  );
  mesh.position.set(0, 33 + i * 7, -70 - i * 9);
  scene.add(mesh);
  auroraLayers.push(mesh);
}

function updateNightSky(dt, time) {
  stars.material.opacity = 0.68 + Math.sin(time * 1.6) * 0.16;

  for (const layer of auroraLayers) {
    layer.material.map.offset.x += dt * 0.012;
    layer.material.opacity = 0.2 + Math.sin(time * 0.32 + layer.position.z) * 0.07;
  }

  if (moonPulse > 0) {
    moonPulse = Math.max(0, moonPulse - dt * 1.4);
    moon.scale.setScalar(1 + moonPulse * 0.1);
    moonGlow.material.opacity = 0.85 + moonPulse * 0.6;
  }
}

/* ------------------------------------------------------------------ *
 * Ground and tall grass
 * ------------------------------------------------------------------ */

const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f8fd, roughness: 0.9 });
const snowGroundTexture = makeTexture(drawSnow, 16, 16);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(260, 260),
  new THREE.MeshStandardMaterial({ map: snowGroundTexture, color: 0xdbe7f8, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, -30);
ground.receiveShadow = true;
scene.add(ground);

const bladeGeometry = new THREE.BufferGeometry();
bladeGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0.0, 1, 0], 3)
);
bladeGeometry.computeVertexNormals();

const bladeMaterial = new THREE.MeshStandardMaterial({
  roughness: 1,
  side: THREE.DoubleSide,
});

const BLADE_COUNT = 1500;
const blades = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, BLADE_COUNT);
blades.instanceMatrix.setUsage(THREE.StaticDrawUsage);
const dummy = new THREE.Object3D();
const grassColors = ['#c9bea0', '#b3a688', '#dcd8c8', '#c3ccd2', '#d8cbaf'];
for (let i = 0; i < BLADE_COUNT; i += 1) {
  /* Grow the blades in tufts so the field reads as dry, tall grass. */
  let x;
  let z;
  if (i % 4 === 0) {
    x = rand(-46, 46);
    z = rand(-2, 16);
  } else {
    const tuftX = rand(-46, 46);
    const tuftZ = rand(-2, 16);
    x = tuftX + rand(-1.5, 1.5);
    z = tuftZ + rand(-1.2, 1.2);
  }
  dummy.position.set(x, 0, z);
  dummy.rotation.set(rand(-0.22, 0.22), rand(0, Math.PI), rand(-0.22, 0.22));
  dummy.scale.set(rand(1.0, 2.2), rand(0.75, 1.7), 1);
  dummy.updateMatrix();
  blades.setMatrixAt(i, dummy.matrix);
  blades.setColorAt(i, new THREE.Color(grassColors[Math.floor(Math.random() * grassColors.length)]));
}
blades.frustumCulled = false;
scene.add(blades);

/* ------------------------------------------------------------------ *
 * Trees around the yard
 * ------------------------------------------------------------------ */

const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1, flatShading: true });
const pineMaterial = new THREE.MeshStandardMaterial({ color: 0x27433a, roughness: 1, flatShading: true });
const pineSnowMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f8fe, roughness: 0.9, flatShading: true });
const trunkGeometry = new THREE.CylinderGeometry(0.24, 0.46, 3.6, 6);
const coneGeometry = new THREE.ConeGeometry(1, 1, 7);
const driftGeometry = new THREE.IcosahedronGeometry(1, 0);

/* Snow-dusted pines. */
function addTree(x, z, scale) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  tree.add(trunk);

  for (let i = 0; i < 4; i += 1) {
    const radius = 2.25 - i * 0.45;
    const height = 2.5;
    const y = 3.2 + i * 1.35;

    const layer = new THREE.Mesh(coneGeometry, pineMaterial);
    layer.scale.set(radius, height, radius);
    layer.position.y = y;
    layer.castShadow = true;
    tree.add(layer);

    const cap = new THREE.Mesh(coneGeometry, pineSnowMaterial);
    cap.scale.set(radius * 1.06, height * 0.42, radius * 1.06);
    cap.position.y = y + height * 0.2;
    tree.add(cap);
  }

  const baseDrift = new THREE.Mesh(driftGeometry, snowMaterial);
  baseDrift.scale.set(1.9, 0.35, 1.9);
  baseDrift.position.y = 0.1;
  tree.add(baseDrift);

  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  scene.add(tree);
}

for (let i = 0; i < 18; i += 1) {
  addTree(rand(-44, 44), rand(-46, -26), rand(1.1, 1.9));
}
for (let i = 0; i < 6; i += 1) {
  addTree(rand(-48, -26), rand(-22, 14), rand(1.0, 1.7));
  addTree(rand(28, 48), rand(-22, 14), rand(1.0, 1.7));
}
addTree(27, 4, 1.35);
addTree(-34, 8, 1.5);

/* Snowy hills fading into the night behind the pines. */
const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 1 });
for (const [x, z, sx, sy, sz] of [
  [-46, -66, 46, 15, 26],
  [16, -74, 58, 18, 30],
  [74, -60, 38, 12, 24],
]) {
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hillMaterial);
  hill.position.set(x, -2, z);
  hill.scale.set(sx, sy, sz);
  scene.add(hill);
}

/* Snow drifts scattered over the lawn. */
const driftCount = 80;
const drifts = new THREE.InstancedMesh(driftGeometry, snowMaterial, driftCount);
for (let i = 0; i < driftCount; i += 1) {
  dummy.position.set(rand(-42, 42), rand(-0.12, 0.05), rand(-26, 20));
  dummy.rotation.set(0, rand(0, Math.PI), 0);
  dummy.scale.set(rand(0.8, 2.6), rand(0.16, 0.42), rand(0.8, 2.2));
  dummy.updateMatrix();
  drifts.setMatrixAt(i, dummy.matrix);
}
drifts.receiveShadow = true;
scene.add(drifts);

/* ------------------------------------------------------------------ *
 * Falling snow
 * ------------------------------------------------------------------ */

const SNOWFLAKE_COUNT = 1500;
const snowfallGeometry = new THREE.BufferGeometry();
const snowflakePositions = new Float32Array(SNOWFLAKE_COUNT * 3);
for (let i = 0; i < SNOWFLAKE_COUNT; i += 1) {
  snowflakePositions[i * 3] = rand(-55, 55);
  snowflakePositions[i * 3 + 1] = rand(0, 30);
  snowflakePositions[i * 3 + 2] = rand(-60, 30);
}
snowfallGeometry.setAttribute('position', new THREE.BufferAttribute(snowflakePositions, 3));

const snowflakeTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
})();

const snowfall = new THREE.Points(
  snowfallGeometry,
  new THREE.PointsMaterial({
    size: 0.45,
    map: snowflakeTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
snowfall.frustumCulled = false;
scene.add(snowfall);

function updateSnowfall(dt) {
  const positions = snowfallGeometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] -= dt * (1.5 + ((i % 7) * 0.12));
    positions[i] += Math.sin(positions[i + 1] * 0.7 + i) * dt * 0.5;
    if (positions[i + 1] < 0.1) {
      positions[i + 1] = rand(24, 32);
      positions[i] = rand(-55, 55);
      positions[i + 2] = rand(-60, 30);
    }
  }
  snowfallGeometry.attributes.position.needsUpdate = true;
}

/* ------------------------------------------------------------------ *
 * The house
 * ------------------------------------------------------------------ */

const house = new THREE.Group();
house.position.set(0, 0, -16);
scene.add(house);

const sidingWallTexture = makeTexture(drawSiding, 3, 1.85);
const sidingGableTexture = makeTexture(drawSiding, 0.3, 0.3);
const shingleTexture = makeTexture(drawShingles, 8, 4);

const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xe9ece6, roughness: 0.75 });
const sidingWallMaterial = new THREE.MeshStandardMaterial({ map: sidingWallTexture, roughness: 0.9 });
const sidingGableMaterial = new THREE.MeshStandardMaterial({ map: sidingGableTexture, roughness: 0.9 });
const roofMaterial = new THREE.MeshStandardMaterial({ map: shingleTexture, roughness: 0.95 });
const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a2a1c,
  emissive: 0xffb35f,
  emissiveIntensity: 1.15,
  roughness: 0.3,
});
const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0xb6b4aa, roughness: 0.95 });
const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });
const darkOpeningMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2125, roughness: 1 });
const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xdde1da, roughness: 0.7 });
const chimneyMaterial = new THREE.MeshStandardMaterial({ color: 0x7d7368, roughness: 1 });

function addBox(parent, width, height, depth, x, y, z, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const HOUSE_WIDTH = 15;
const HOUSE_HEIGHT = 6.2;
const HOUSE_DEPTH = 9;
const FRONT = HOUSE_DEPTH / 2;

/* Body, plinth and corner boards. */
addBox(house, HOUSE_WIDTH, HOUSE_HEIGHT, HOUSE_DEPTH, 0, HOUSE_HEIGHT / 2, 0, sidingWallMaterial);
addBox(house, HOUSE_WIDTH + 0.3, 0.45, HOUSE_DEPTH + 0.3, 0, 0.22, 0, concreteMaterial);
for (const x of [-HOUSE_WIDTH / 2, HOUSE_WIDTH / 2]) {
  for (const z of [-FRONT, FRONT]) {
    addBox(house, 0.3, HOUSE_HEIGHT + 0.05, 0.3, x, HOUSE_HEIGHT / 2, z, trimMaterial);
  }
}
addBox(house, 0.28, 0.4, HOUSE_DEPTH + 0.5, HOUSE_WIDTH / 2 + 0.05, HOUSE_HEIGHT - 0.05, 0, trimMaterial);
addBox(house, 0.28, 0.4, HOUSE_DEPTH + 0.5, -HOUSE_WIDTH / 2 - 0.05, HOUSE_HEIGHT - 0.05, 0, trimMaterial);

/* A front-facing gable roof: triangular attic wall plus two sloped planes. */
function addGable({ cx, width, depth, zCenter, rise, eaveY, overhang }) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();

  const gableWall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }),
    sidingGableMaterial
  );
  gableWall.position.set(cx, eaveY, zCenter - depth / 2);
  gableWall.castShadow = true;
  gableWall.receiveShadow = true;
  house.add(gableWall);

  const half = width / 2 + overhang;
  const slopeLength = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);
  const roofDepth = depth + 1;

  for (const side of [-1, 1]) {
    const plane = addBox(
      house,
      slopeLength,
      0.22,
      roofDepth,
      cx + (side * half) / 2,
      eaveY + rise / 2,
      zCenter,
      roofMaterial
    );
    plane.rotation.z = -side * angle;

    const rake = addBox(
      house,
      slopeLength + 0.05,
      0.2,
      0.22,
      cx + (side * half) / 2,
      eaveY + rise / 2,
      zCenter + depth / 2 + 0.36,
      trimMaterial
    );
    rake.rotation.z = -side * angle;

    /* Snow settling on the roof. */
    const snowCap = addBox(
      house,
      slopeLength * 0.99,
      0.16,
      roofDepth * 0.99,
      cx + (side * half) / 2 + side * Math.sin(angle) * 0.17,
      eaveY + rise / 2 + Math.cos(angle) * 0.17,
      zCenter,
      snowMaterial
    );
    snowCap.rotation.z = -side * angle;
  }

  addBox(house, 0.38, 0.26, roofDepth + 0.05, cx, eaveY + rise + 0.02, zCenter, roofMaterial);
}

addGable({ cx: 3.3, width: 9.6, depth: 9, zCenter: 0, rise: 4, eaveY: 6.15, overhang: 0.5 });
addGable({ cx: -4.4, width: 6.6, depth: 9, zCenter: 0, rise: 2.6, eaveY: 6.15, overhang: 0.45 });

/* Chimney. */
addBox(house, 0.82, 4.6, 1.0, -6.3, 7.6, 1.4, chimneyMaterial);
addBox(house, 1.0, 0.22, 1.18, -6.3, 9.95, 1.4, concreteMaterial);

/* Covered porch across the front. */
addBox(house, HOUSE_WIDTH + 0.8, 0.3, 3.4, 0, 0.15, FRONT + 1.7, concreteMaterial);
addBox(house, 4.4, 0.16, 0.6, 0, 0.08, FRONT + 3.7, concreteMaterial);
addBox(house, HOUSE_WIDTH + 0.8, 0.28, 3.5, 0, 3.56, FRONT + 1.75, trimMaterial);
addBox(house, HOUSE_WIDTH + 0.9, 0.24, 0.26, 0, 3.44, FRONT + 3.5, trimMaterial);
addBox(house, HOUSE_WIDTH + 0.6, 0.14, 3.3, 0, 3.77, FRONT + 1.75, snowMaterial);

const porchColumnX = [-7.15, -2.4, 2.0, 6.9];
for (const x of porchColumnX) {
  addBox(house, 0.26, 3.2, 0.26, x, 1.75, FRONT + 3.25, trimMaterial);
  addBox(house, 0.4, 0.16, 0.4, x, 0.42, FRONT + 3.25, trimMaterial);
  addBox(house, 0.38, 0.16, 0.38, x, 3.26, FRONT + 3.25, trimMaterial);
}

/* Front door. */
addBox(house, 1.72, 2.8, 0.14, 0.3, 1.55, FRONT + 0.06, trimMaterial);
addBox(house, 1.4, 2.55, 0.1, 0.3, 1.5, FRONT + 0.14, doorMaterial);
addBox(house, 0.9, 1.05, 0.06, 0.3, 1.95, FRONT + 0.21, glassMaterial);
addBox(house, 0.1, 0.1, 0.14, 0.85, 1.35, FRONT + 0.24, trimMaterial);

/* Generous invisible hitbox over the door: shooting it calls Bear. */
const doorHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(2.7, 3.2, 0.7),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
doorHitbox.position.set(0.3, 1.6, FRONT + 0.35);
doorHitbox.userData.isDoor = true;
house.add(doorHitbox);

/* Generous invisible hitbox over the chimney: shooting it summons Santa. */
const chimneyHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 5.6, 2.2),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
chimneyHitbox.position.set(-6.3, 8.3, 1.4);
chimneyHitbox.userData.isChimney = true;
house.add(chimneyHitbox);

/* Windows: white frame, dark glass, mullions and a sill. */
function addWindow(x, y, width, height, z = FRONT + 0.05) {
  addBox(house, width + 0.28, height + 0.28, 0.16, x, y, z, trimMaterial);
  addBox(house, width, height, 0.08, x, y, z + 0.08, glassMaterial);
  addBox(house, 0.07, height, 0.1, x, y, z + 0.12, trimMaterial);
  addBox(house, width, 0.07, 0.1, x, y, z + 0.12, trimMaterial);
  addBox(house, width + 0.52, 0.14, 0.3, x, y - height / 2 - 0.16, z + 0.02, trimMaterial);
}

addWindow(-4.5, 1.95, 3.2, 1.9);
addWindow(4.4, 1.95, 3.0, 1.9);
addWindow(5.2, 4.9, 1.05, 1.75);

/* Generous invisible hitbox over the upstairs window: shooting it wakes the witch. */
const witchWindowHitbox = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 2.8, 0.6),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
witchWindowHitbox.position.set(5.2, 4.9, FRONT + 0.15);
witchWindowHitbox.userData.isWitchWindow = true;
house.add(witchWindowHitbox);

/* Second-floor balcony on the left gable. */
const balconyZ = FRONT + 1.35;
addBox(house, 5.6, 2.55, 0.16, -4.4, 4.9, FRONT + 0.04, darkOpeningMaterial);
addBox(house, 5.9, 0.24, 1.5, -4.4, 3.72, FRONT + 0.75, trimMaterial);
addBox(house, 5.5, 0.72, 0.12, -4.4, 4.28, balconyZ, woodMaterial);
addBox(house, 5.7, 0.12, 0.24, -4.4, 4.7, balconyZ, woodMaterial);
addBox(house, 5.7, 0.1, 0.2, -4.4, 3.94, balconyZ, woodMaterial);
for (const x of [-7.15, -5.4, -3.4, -1.65]) {
  addBox(house, 0.22, 2.45, 0.22, x, 4.95, balconyZ, trimMaterial);
}

/* A little greenery at the base of the house, dusted with snow. */
const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x2c4a38, roughness: 1, flatShading: true });
for (const [x, z, scale] of [
  [-6.6, FRONT + 2.9, 0.9],
  [6.4, FRONT + 2.9, 1.0],
  [2.6, FRONT + 3.6, 0.7],
]) {
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), bushMaterial);
  bush.position.set(x, scale * 0.75, z);
  bush.scale.set(scale, scale * 0.85, scale);
  bush.castShadow = true;
  house.add(bush);

  const bushSnow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), snowMaterial);
  bushSnow.position.set(x, scale * 1.12, z);
  bushSnow.scale.set(scale * 0.9, scale * 0.28, scale * 0.9);
  house.add(bushSnow);
}

/* ------------------------------------------------------------------ *
 * Christmas decorations
 * ------------------------------------------------------------------ */

const garlandMaterial = new THREE.MeshStandardMaterial({ color: 0x1f4a32, roughness: 0.9 });
const bowMaterial = new THREE.MeshStandardMaterial({ color: 0xb5161b, roughness: 0.6 });
const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd479,
  emissive: 0xffb020,
  emissiveIntensity: 1.3,
  roughness: 0.4,
});
const bulbMaterials = [
  new THREE.MeshBasicMaterial({ color: 0xffe6b0 }),
  new THREE.MeshBasicMaterial({ color: 0xff5a48 }),
  new THREE.MeshBasicMaterial({ color: 0x9be07a }),
  new THREE.MeshBasicMaterial({ color: 0x8ecbff }),
];
const bulbGeometry = new THREE.SphereGeometry(0.075, 8, 8);

/* Wreath on the front door. */
const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 8, 18), garlandMaterial);
wreath.position.set(0.3, 2.0, FRONT + 0.3);
wreath.castShadow = true;
house.add(wreath);
for (let i = 0; i < 8; i += 1) {
  const angle = (i / 8) * Math.PI * 2;
  const berry = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), bowMaterial);
  berry.position.set(0.3 + Math.cos(angle) * 0.42, 2.0 + Math.sin(angle) * 0.42, FRONT + 0.4);
  house.add(berry);
}
addBox(house, 0.26, 0.16, 0.1, 0.3, 2.52, FRONT + 0.36, bowMaterial);
addBox(house, 0.12, 0.26, 0.08, 0.16, 2.4, FRONT + 0.36, bowMaterial);
addBox(house, 0.12, 0.26, 0.08, 0.44, 2.4, FRONT + 0.36, bowMaterial);

/* Strings of lights along the porch and the balcony. */
for (let i = 0; i <= 30; i += 1) {
  const t = i / 30;
  const bulb = new THREE.Mesh(bulbGeometry, bulbMaterials[i % bulbMaterials.length]);
  bulb.position.set(-7.7 + t * 15.4, 3.64 - Math.sin(t * Math.PI * 6) * 0.12, FRONT + 3.64);
  house.add(bulb);
}
for (let i = 0; i <= 14; i += 1) {
  const x = -7.1 + (i / 14) * 5.35;
  const bulb = new THREE.Mesh(bulbGeometry, bulbMaterials[(i + 1) % bulbMaterials.length]);
  bulb.position.set(x, 4.9 + Math.sin(i * 0.8) * 0.05, balconyZ + 0.14);
  house.add(bulb);
}

/* Icicles under the porch gutter. */
const icicleGeometry = new THREE.ConeGeometry(0.075, 1, 5);
const icicleMaterial = new THREE.MeshStandardMaterial({
  color: 0xdff1ff,
  roughness: 0.15,
  metalness: 0.2,
  transparent: true,
  opacity: 0.92,
});
for (let i = 0; i < 20; i += 1) {
  const length = rand(0.25, 0.75);
  const icicle = new THREE.Mesh(icicleGeometry, icicleMaterial);
  icicle.scale.set(rand(0.7, 1.2), length, rand(0.7, 1.2));
  icicle.rotation.x = Math.PI;
  icicle.position.set(-7.5 + i * 0.8, 3.32 - length / 2, FRONT + 3.62);
  house.add(icicle);
}

/* Snow on the balcony rail and chimney cap. */
addBox(house, 5.6, 0.1, 1.45, -4.4, 3.86, FRONT + 0.8, snowMaterial);
addBox(house, 1.08, 0.12, 1.26, -6.3, 10.08, 1.4, snowMaterial);

/* A warm porch lamp, so the deer are lit up as they arrive. */
const porchLight = new THREE.PointLight(0xffc27a, 95, 22, 2);
porchLight.position.set(0.3, 3.1, FRONT + 2.4);
house.add(porchLight);

/* A decorated Christmas tree on the lawn. */
const yardTree = new THREE.Group();
for (let i = 0; i < 4; i += 1) {
  const layer = new THREE.Mesh(coneGeometry, pineMaterial);
  layer.scale.set(1.5 - i * 0.3, 1.8, 1.5 - i * 0.3);
  layer.position.y = 1.6 + i * 1.1;
  layer.castShadow = true;
  yardTree.add(layer);
}
const treeStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), goldMaterial);
 treeStar.position.y = 6.15;
yardTree.add(treeStar);
for (let i = 0; i < 24; i += 1) {
  const t = i / 24;
  const y = 1.1 + t * 4.6;
  const radius = 1.32 * (1 - t * 0.85) + 0.16;
  const angle = t * Math.PI * 9;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), bulbMaterials[i % bulbMaterials.length]);
  bulb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  yardTree.add(bulb);
}
const treeDrift = new THREE.Mesh(driftGeometry, snowMaterial);
treeDrift.scale.set(1.9, 0.4, 1.9);
treeDrift.position.y = 0.08;
yardTree.add(treeDrift);
yardTree.position.set(9.8, 0, -3.5);
scene.add(yardTree);

/* Generous invisible hitbox over the tree star: three hits wakes Dad. */
const treeStarHitbox = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 10, 8),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
treeStarHitbox.position.set(0, 6.15, 0);
treeStarHitbox.userData.isTreeStar = true;
yardTree.add(treeStarHitbox);

/* A snowman keeping watch on the left lawn. */
const snowman = new THREE.Group();
const coalMaterial = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.8 });
const carrotMaterial = new THREE.MeshStandardMaterial({ color: 0xe8772c, roughness: 0.8 });
const snowmanBase = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), snowMaterial);
snowmanBase.scale.set(0.95, 0.9, 0.95);
snowmanBase.position.y = 0.85;
snowmanBase.castShadow = true;
snowman.add(snowmanBase);
const snowmanMid = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), snowMaterial);
snowmanMid.scale.setScalar(0.66);
snowmanMid.position.y = 2.0;
snowmanMid.castShadow = true;
snowman.add(snowmanMid);
const snowmanHead = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), snowMaterial);
snowmanHead.position.y = 2.85;
snowmanHead.castShadow = true;
snowman.add(snowmanHead);
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), coalMaterial);
  eye.position.set(side * 0.16, 2.95, 0.4);
  snowman.add(eye);
}
for (let i = 0; i < 3; i += 1) {
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), coalMaterial);
  button.position.set(0, 1.72 + i * 0.22, 0.6 - i * 0.03);
  snowman.add(button);
}
const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8), carrotMaterial);
carrot.rotation.x = Math.PI / 2;
carrot.position.set(0, 2.85, 0.62);
snowman.add(carrot);
const snowmanHat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.5, 12), coalMaterial);
snowmanHat.position.y = 3.4;
snowman.add(snowmanHat);
const snowmanBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 12), coalMaterial);
snowmanBrim.position.y = 3.16;
snowman.add(snowmanBrim);
const snowmanScarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 8, 14), bowMaterial);
snowmanScarf.rotation.x = Math.PI / 2;
snowmanScarf.position.y = 2.42;
snowman.add(snowmanScarf);
snowman.position.set(-10.5, 0, -3);
snowman.rotation.y = 0.35;
scene.add(snowman);

/* ------------------------------------------------------------------ *
 * Snowman easter egg: five snowballs and the whole herd goes with it
 * ------------------------------------------------------------------ */

const SNOWMAN_HITS = 5;
const snowmanHitMeshes = [];
snowman.traverse((node) => {
  if (!node.isMesh) return;
  node.userData.isSnowman = true;
  snowmanHitMeshes.push(node);
});

const snowmanEgg = {
  hits: 0,
  state: 'idle',
  timer: 0,
  wobble: 0,
  queue: [],
};

const puffGeometry = new THREE.SphereGeometry(0.24, 8, 6);
const puffs = [];

function spawnSnowPuff(position, count = 8, spread = 4) {
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(puffGeometry, material);
    mesh.position.copy(position);
    mesh.scale.setScalar(rand(0.6, 1.7));
    scene.add(mesh);
    puffs.push({
      mesh,
      velocity: new THREE.Vector3(rand(-spread, spread), rand(1.5, spread + 3), rand(-spread, spread)),
      life: rand(0.45, 0.85),
      maxLife: 0.9,
    });
  }
}

function updatePuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i -= 1) {
    const puff = puffs[i];
    puff.life -= dt;
    puff.velocity.y -= dt * 7;
    puff.mesh.position.addScaledVector(puff.velocity, dt);
    puff.mesh.scale.multiplyScalar(1 + dt * 1.4);
    puff.mesh.material.opacity = Math.max(0, puff.life / puff.maxLife) * 0.9;
    if (puff.life <= 0) {
      scene.remove(puff.mesh);
      puff.mesh.material.dispose();
      puffs.splice(i, 1);
    }
  }
}

function hitSnowman(point) {
  if (snowmanEgg.state !== 'idle') return;
  snowmanEgg.hits += 1;
  snowmanEgg.wobble = 1;
  audio.snowHit(snowmanEgg.hits);
  spawnImpact(point, false);
  spawnSnowPuff(point, 5, 2.5);

  if (snowmanEgg.hits >= SNOWMAN_HITS) {
    explodeSnowman();
  } else {
    showBanner(`Snowman ${snowmanEgg.hits}/${SNOWMAN_HITS}`);
  }
}

function explodeSnowman() {
  snowmanEgg.state = 'boom';
  snowmanEgg.hits = 0;
  snowmanEgg.timer = 0.15;
  snowmanEgg.wobble = 0;
  snowman.visible = false;
  snowman.rotation.set(0, 0.35, 0);

  const blast = new THREE.Vector3(-10.5, 2.1, -3);
  spawnSnowPuff(blast, 30, 6);
  spawnConfetti(blast);
  spawnImpact(blast, true);
  spawnShockwave(new THREE.Vector3(-10.5, 0.1, -3));
  audio.snowmanBoom();
  showBanner('SNOW-BOOM!');
  statusEl.textContent = 'The snowman exploded and took the whole herd with it!';

  snowmanEgg.queue = deerList.filter(
    (deer) => deer.alive && deer.state !== 'dead' && deer.state !== 'tame'
  );
}

function updateSnowmanEgg(dt, time) {
  updatePuffs(dt);

  if (snowmanEgg.wobble > 0) {
    snowmanEgg.wobble = Math.max(0, snowmanEgg.wobble - dt * 2.2);
    snowman.rotation.z = Math.sin(time * 40) * 0.11 * snowmanEgg.wobble;
    snowman.rotation.x = Math.cos(time * 33) * 0.06 * snowmanEgg.wobble;
    if (snowmanEgg.wobble === 0) snowman.rotation.set(0, 0.35, 0);
  }

  if (snowmanEgg.state === 'boom') {
    if (snowmanEgg.queue.length) {
      snowmanEgg.timer -= dt;
      if (snowmanEgg.timer <= 0) {
        const deer = snowmanEgg.queue.shift();
        snowmanEgg.timer = 0.11;
        if (deer.alive) {
          killDeer(deer, true);
          const at = deer.group.position.clone().setY(1.4);
          spawnConfetti(at);
          spawnSnowPuff(at, 4, 2);
        }
      }
    } else {
      snowmanEgg.timer += dt;
      if (snowmanEgg.timer > 5) {
        snowmanEgg.state = 'idle';
        snowmanEgg.timer = 0;
        snowmanEgg.hits = 0;
        snowman.visible = true;
        snowman.scale.setScalar(0.05);
        snowman.rotation.set(0, 0.35, 0);
        spawnSnowPuff(new THREE.Vector3(-10.5, 1.2, -3), 12, 3);
        audio.snowmanRebuild();
      }
    }
  } else if (snowman.scale.x < 1) {
    snowman.scale.setScalar(Math.min(1, snowman.scale.x + dt * 2.6));
  }
}

/* ------------------------------------------------------------------ *
 * Where snowballs come from (the player throws by hand, no view model)
 * ------------------------------------------------------------------ */

const muzzle = new THREE.Object3D();
muzzle.position.set(0.62, -0.43, -1.9);
camera.add(muzzle);

/* ------------------------------------------------------------------ *
 * Zombie deer
 * ------------------------------------------------------------------ */

const deerGeometry = {
  body: new THREE.BoxGeometry(0.82, 0.86, 1.6),
  rump: new THREE.BoxGeometry(0.72, 0.78, 0.5),
  chest: new THREE.BoxGeometry(0.76, 0.8, 0.5),
  neck: new THREE.BoxGeometry(0.4, 0.85, 0.4),
  head: new THREE.BoxGeometry(0.38, 0.38, 0.62),
  muzzle: new THREE.BoxGeometry(0.24, 0.22, 0.34),
  ear: new THREE.ConeGeometry(0.11, 0.3, 4),
  leg: new THREE.BoxGeometry(0.17, 1, 0.17),
  tail: new THREE.BoxGeometry(0.16, 0.24, 0.1),
  antler: new THREE.CylinderGeometry(0.028, 0.038, 0.62, 4),
  tine: new THREE.CylinderGeometry(0.022, 0.028, 0.34, 4),
  eye: new THREE.SphereGeometry(0.055, 8, 8),
  patch: new THREE.BoxGeometry(0.22, 0.22, 0.06),
};

const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d2b6, roughness: 0.85, flatShading: true });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xc9ff54 });

const eyeGlowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(230,255,170,1)');
  gradient.addColorStop(0.35, 'rgba(160,255,80,0.55)');
  gradient.addColorStop(1, 'rgba(120,255,60,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();
const eyeGlowMaterial = new THREE.SpriteMaterial({
  map: eyeGlowTexture,
  color: 0xb8ff5a,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
});
const noseGlowMaterial = new THREE.SpriteMaterial({
  map: eyeGlowTexture,
  color: 0xff4030,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
});
const noseMaterial = new THREE.MeshStandardMaterial({
  color: 0xff4a3a,
  emissive: 0xff1f14,
  emissiveIntensity: 1.8,
  roughness: 0.4,
});
const santaRedMaterial = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.8 });
const santaWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f8f2, roughness: 0.9 });
const rotMaterial = new THREE.MeshStandardMaterial({ color: 0x47512f, roughness: 1, flatShading: true });
const socketMaterial = new THREE.MeshStandardMaterial({ color: 0x080907, roughness: 1 });
const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e8c8, roughness: 0.55 });
const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x3d1519, roughness: 1 });

const deerList = [];
const hitMeshes = [];

function createDeer({ hp, speed }) {
  const group = new THREE.Group();
  const furMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.14, 0.26, rand(0.14, 0.21)),
    roughness: 0.98,
    flatShading: true,
    emissive: 0x000000,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.15;
  bodyGroup.rotation.x = 0.08;
  bodyGroup.rotation.z = rand(-0.06, 0.06);
  group.add(bodyGroup);

  const body = new THREE.Mesh(deerGeometry.body, furMaterial);
  body.castShadow = true;
  bodyGroup.add(body);

  const rump = new THREE.Mesh(deerGeometry.rump, furMaterial);
  rump.position.set(0, 0.05, -0.86);
  rump.castShadow = true;
  bodyGroup.add(rump);

  const chest = new THREE.Mesh(deerGeometry.chest, furMaterial);
  chest.position.set(0, 0.02, 0.82);
  chest.castShadow = true;
  bodyGroup.add(chest);

  const neck = new THREE.Mesh(deerGeometry.neck, furMaterial);
  neck.position.set(0, 0.42, 0.94);
  neck.rotation.x = 0.42;
  neck.castShadow = true;
  bodyGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.9, 1.1);
  headGroup.rotation.z = rand(-0.16, 0.16);
  headGroup.rotation.x = rand(-0.05, 0.1);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(deerGeometry.head, furMaterial);
  head.position.set(0, 0.02, 0.16);
  head.castShadow = true;
  headGroup.add(head);

  /* Bone showing through the scalp. */
  const skullBone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.34), boneMaterial);
  skullBone.position.set(0.02, 0.2, 0.2);
  headGroup.add(skullBone);

  const muzzleMesh = new THREE.Mesh(deerGeometry.muzzle, furMaterial);
  muzzleMesh.position.set(0, -0.02, 0.55);
  muzzleMesh.castShadow = true;
  headGroup.add(muzzleMesh);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), noseMaterial);
  nose.position.set(0, 0, 0.74);
  headGroup.add(nose);

  /* Rudolph's nose, gone bad. */
  const noseGlow = new THREE.Sprite(noseGlowMaterial);
  noseGlow.position.set(0, 0, 0.85);
  noseGlow.scale.setScalar(0.52);
  headGroup.add(noseGlow);

  /* Slobbering open mouth. */
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), mouthMaterial);
  mouth.position.set(0, -0.15, 0.53);
  headGroup.add(mouth);

  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.16, 0.3);
  headGroup.add(jawGroup);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.1, 0.4), furMaterial);
  jaw.position.set(0, -0.05, 0.2);
  jaw.castShadow = true;
  jawGroup.add(jaw);

  for (let i = 0; i < 3; i += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), toothMaterial);
    tooth.position.set((i - 1) * 0.075, 0.02, 0.33);
    jawGroup.add(tooth);
  }

  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.055), toothMaterial);
    fang.position.set(side * 0.09, -0.14, 0.66);
    headGroup.add(fang);

    /* Sunken sockets with glowing zombie eyes. */
    const socket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.1), socketMaterial);
    socket.position.set(side * 0.15, 0.06, 0.39);
    headGroup.add(socket);

    const eye = new THREE.Mesh(deerGeometry.eye, eyeMaterial);
    eye.position.set(side * 0.17, 0.08, 0.44);
    eye.scale.setScalar(1.2);
    headGroup.add(eye);

    const glow = new THREE.Sprite(eyeGlowMaterial);
    glow.position.set(side * 0.17, 0.08, 0.48);
    glow.scale.setScalar(0.44);
    headGroup.add(glow);

    /* Angry brow ridge. */
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.08, 0.1), furMaterial);
    brow.position.set(side * 0.13, 0.19, 0.41);
    brow.rotation.z = side * 0.34;
    headGroup.add(brow);

    /* One ear is torn and droops. */
    const ear = new THREE.Mesh(deerGeometry.ear, furMaterial);
    ear.position.set(side * 0.22, 0.24, 0.06);
    ear.rotation.z = side * 0.55;
    ear.rotation.x = side > 0 ? 0.6 : -0.2;
    ear.scale.set(1, side > 0 ? 0.7 : 1, 1);
    headGroup.add(ear);

    /* Crooked antlers, one side broken short. */
    const beam = new THREE.Mesh(deerGeometry.antler, boneMaterial);
    beam.position.set(side * 0.16, 0.4, 0.04);
    beam.rotation.z = side * -0.42;
    beam.rotation.x = -0.35 + rand(-0.18, 0.18);
    beam.castShadow = true;
    headGroup.add(beam);

    const tine = new THREE.Mesh(deerGeometry.tine, boneMaterial);
    tine.position.set(side * 0.3, 0.6, 0.02);
    tine.rotation.z = side * -0.95;
    tine.rotation.x = -0.4;
    headGroup.add(tine);

    const tine2 = new THREE.Mesh(deerGeometry.tine, boneMaterial);
    tine2.position.set(side * 0.36, 0.76, -0.06);
    tine2.rotation.z = side * -1.35;
    tine2.rotation.x = -0.5;
    tine2.scale.set(0.8, side > 0 ? 0.45 : 0.8, 0.8);
    headGroup.add(tine2);
  }

  /* A crooked Santa hat, because even zombie reindeer dress up. */
  const hat = new THREE.Group();
  hat.position.set(0, 0.18, 0.04);
  hat.rotation.z = rand(0.08, 0.28);
  hat.rotation.x = -0.1;
  headGroup.add(hat);

  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.48, 8), santaRedMaterial);
  hatCone.position.set(0.02, 0.23, 0);
  hatCone.rotation.z = 0.2;
  hatCone.castShadow = true;
  hat.add(hatCone);

  const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 14), santaWhiteMaterial);
  hatBrim.rotation.x = Math.PI / 2;
  hat.add(hatBrim);

  const hatPompom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), santaWhiteMaterial);
  hatPompom.position.set(-0.09, 0.47, 0);
  hat.add(hatPompom);

  const tail = new THREE.Mesh(deerGeometry.tail, furMaterial);
  tail.position.set(0, 0.24, -1.02);
  tail.rotation.x = -0.5;
  bodyGroup.add(tail);

  /* Ribs poking through the hide and a knobbly spine. */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.1), boneMaterial);
      rib.position.set(side * 0.4, 0.02, 0.34 - i * 0.3);
      rib.rotation.z = side * -0.14;
      rib.rotation.x = -0.12;
      bodyGroup.add(rib);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const spineBone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), boneMaterial);
    spineBone.position.set(0, 0.46, 0.52 - i * 0.34);
    bodyGroup.add(spineBone);
  }

  /* A rotten wound on the flank. */
  const wound = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.36), mouthMaterial);
  wound.position.set(-0.41, -0.02, 0.12);
  bodyGroup.add(wound);

  /* Rotten patches on the flank. */
  for (const [x, y, z, rz] of [
    [-0.42, 0.14, 0.24, 0.3],
    [0.42, -0.12, -0.2, -0.5],
    [-0.4, -0.22, -0.5, 1.1],
  ]) {
    const patch = new THREE.Mesh(deerGeometry.patch, rotMaterial);
    patch.position.set(x, y, z);
    patch.rotation.set(0, Math.PI / 2, rz);
    bodyGroup.add(patch);
  }

  const legs = [];
  for (const [x, z] of [
    [-0.27, 0.56],
    [0.27, 0.56],
    [-0.27, -0.56],
    [0.27, -0.56],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.05, z);
    const leg = new THREE.Mesh(deerGeometry.leg, furMaterial);
    leg.position.y = -0.52;
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }

  const deer = {
    group,
    bodyGroup,
    headGroup,
    jawGroup,
    legs,
    furMaterial,
    hp,
    maxHp: hp,
    speed,
    state: 'walk',
    alive: true,
    hitMeshes: [],
    phase: Math.random() * 10,
    wobble: Math.random() * 10,
    biteTimer: 0.8,
    deathTimer: 0,
    flash: 0,
    target: new THREE.Vector3(rand(-5.5, 5.5), 0, -7 + rand(-0.6, 0.8)),
  };

  const bodyParts = [body, rump, chest, neck, ...legs.map((pivot) => pivot.children[0])];
  for (const mesh of bodyParts) {
    mesh.userData.deer = deer;
    mesh.userData.part = 'body';
    deer.hitMeshes.push(mesh);
    hitMeshes.push(mesh);
  }
  headGroup.traverse((node) => {
    if (!node.isMesh) return;
    node.userData.deer = deer;
    node.userData.part = 'head';
    deer.hitMeshes.push(node);
    hitMeshes.push(node);
  });

  group.scale.setScalar(rand(1.05, 1.2));

  /* Spawn deep in the tall grass, then lurch toward the porch. */
  const x = (Math.random() > 0.5 ? 1 : -1) * rand(6, 22);
  group.position.set(x, 0, rand(4, 12));
  const dir = new THREE.Vector3().subVectors(deer.target, group.position);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  scene.add(group);
  deerList.push(deer);
  return deer;
}

function removeDeerHitMeshes(deer) {
  deer.group.traverse((node) => {
    if (!node.isMesh) return;
    const index = hitMeshes.indexOf(node);
    if (index >= 0) hitMeshes.splice(index, 1);
  });
  deer.hitMeshes.length = 0;
}

function killDeer(deer, headshot) {
  if (!deer.alive) return;
  deer.alive = false;
  deer.state = 'dead';
  deer.deathTimer = 0;
  deer.deathRoll = Math.random() > 0.5 ? 1 : -1;
  removeDeerHitMeshes(deer);
  state.active -= 1;
  state.kills += 1;
  state.score += headshot ? 45 : 20;
  updateHud();
  audio.kill(headshot);
  spawnImpact(deer.group.position.clone().setY(1.6), headshot);
}

function damageDeer(deer, amount) {
  if (!deer.alive) return;
  deer.hp -= amount;
  deer.flash = 1;
  audio.hit(amount >= 3);
  if (deer.hp <= 0) {
    killDeer(deer, amount >= 3);
  }
}

/* Scared deer that make it off the lawn are gone for good. */
function escapeDeer(deer) {
  if (!deer.alive) return;
  deer.alive = false;
  removeDeerHitMeshes(deer);
  state.active -= 1;
  state.score += 10;
  updateHud();
  audio.scared();
  scene.remove(deer.group);
  deer.furMaterial.dispose();
}

/* ------------------------------------------------------------------ *
 * Bear the puppy
 * ------------------------------------------------------------------ */

const puppyWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xfaf5ea, roughness: 0.95 });
const puppyBlackMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.95 });
const puppyPinkMaterial = new THREE.MeshStandardMaterial({ color: 0xe87f92, roughness: 0.7 });
const puppyEyeMaterial = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.2 });
const puppyCollarMaterial = new THREE.MeshStandardMaterial({ color: 0xc23630, roughness: 0.5 });
const fluffGeometry = new THREE.SphereGeometry(1, 12, 10);

/* A miniature black and white Shih Tzu built from fluff spheres. */
function buildPuppy() {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.62;
  group.add(bodyPivot);

  const fluff = (parent, x, y, z, radius, material, sx = 1, sy = 1, sz = 1) => {
    const tuft = new THREE.Mesh(fluffGeometry, material);
    tuft.position.set(x, y, z);
    tuft.scale.set(radius * sx, radius * sy, radius * sz);
    tuft.castShadow = true;
    parent.add(tuft);
    return tuft;
  };

  const torso = new THREE.Mesh(fluffGeometry, puppyWhiteMaterial);
  torso.scale.set(0.37, 0.34, 0.46);
  torso.castShadow = true;
  bodyPivot.add(torso);

  fluff(bodyPivot, 0, 0.17, -0.08, 0.3, puppyBlackMaterial, 1, 0.62, 1.1);
  fluff(bodyPivot, 0.25, 0.08, -0.26, 0.14, puppyBlackMaterial);
  fluff(bodyPivot, -0.25, 0.08, -0.26, 0.14, puppyBlackMaterial);
  fluff(bodyPivot, 0.22, 0.2, -0.34, 0.12, puppyBlackMaterial);
  fluff(bodyPivot, -0.22, 0.2, -0.34, 0.12, puppyBlackMaterial);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.34, 0.33);
  bodyPivot.add(headPivot);

  fluff(headPivot, 0, 0, 0, 0.3, puppyWhiteMaterial);
  fluff(headPivot, -0.3, -0.08, 0.02, 0.16, puppyWhiteMaterial);
  fluff(headPivot, 0.3, -0.08, 0.02, 0.16, puppyWhiteMaterial);

  for (const side of [-1, 1]) {
    fluff(headPivot, side * 0.12, 0.05, 0.23, 0.125, puppyBlackMaterial, 1.15, 1, 0.55);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), puppyEyeMaterial);
    eye.position.set(side * 0.12, 0.04, 0.3);
    headPivot.add(eye);

    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 4, 8), puppyBlackMaterial);
    ear.position.set(side * 0.28, -0.02, 0);
    ear.rotation.z = side * 0.3;
    ear.castShadow = true;
    headPivot.add(ear);
  }

  fluff(headPivot, 0, -0.1, 0.26, 0.17, puppyWhiteMaterial, 1.2, 0.85, 1);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), puppyBlackMaterial);
  nose.position.set(0, -0.08, 0.42);
  headPivot.add(nose);

  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), puppyPinkMaterial);
  tongue.position.set(0, -0.18, 0.38);
  headPivot.add(tongue);

  fluff(headPivot, 0, 0.27, 0, 0.12, puppyWhiteMaterial);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), santaRedMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.14, 0.2);
  bodyPivot.add(collar);

  const scarfEnd = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.05), santaRedMaterial);
  scarfEnd.position.set(0.17, -0.02, 0.34);
  scarfEnd.rotation.z = 0.25;
  bodyPivot.add(scarfEnd);

  const scarfFringe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.06), santaWhiteMaterial);
  scarfFringe.position.set(0.2, -0.16, 0.35);
  bodyPivot.add(scarfFringe);

  /* Bear gets a Santa hat too. */
  const puppyHat = new THREE.Group();
  puppyHat.position.set(0, 0.24, 0.02);
  puppyHat.rotation.z = -0.16;
  headPivot.add(puppyHat);

  const puppyHatCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 8), santaRedMaterial);
  puppyHatCone.position.y = 0.17;
  puppyHatCone.castShadow = true;
  puppyHat.add(puppyHatCone);

  const puppyHatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.045, 8, 14), santaWhiteMaterial);
  puppyHatBrim.rotation.x = Math.PI / 2;
  puppyHat.add(puppyHatBrim);

  const puppyPompom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), santaWhiteMaterial);
  puppyPompom.position.set(0.06, 0.36, 0);
  puppyHat.add(puppyPompom);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.16, -0.42);
  bodyPivot.add(tailPivot);
  fluff(tailPivot, 0, 0.05, -0.05, 0.1, puppyWhiteMaterial);
  fluff(tailPivot, 0, 0.17, -0.1, 0.09, puppyBlackMaterial);
  fluff(tailPivot, 0, 0.28, -0.14, 0.08, puppyWhiteMaterial);

  const legs = [];
  const legGeometry = new THREE.CapsuleGeometry(0.075, 0.16, 4, 8);
  for (const [x, z] of [
    [-0.17, 0.24],
    [0.17, 0.24],
    [-0.17, -0.24],
    [0.17, -0.24],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const leg = new THREE.Mesh(legGeometry, puppyWhiteMaterial);
    leg.position.y = -0.18;
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }

  group.userData.headPivot = headPivot;
  group.userData.tailPivot = tailPivot;
  group.userData.legs = legs;
  return group;
}

const PUPPY_HOME = new THREE.Vector3(0.3, 0.3, -11.15);
const PUPPY_SPOT = new THREE.Vector3(1.0, 0, -3.5);

const puppy = {
  group: buildPuppy(),
  state: 'hidden',
  timer: 0,
  step: 0,
};
puppy.group.scale.setScalar(1.15);
puppy.group.visible = false;
scene.add(puppy.group);

const puppyLabel = document.querySelector('#puppy-label');
let puppyChipText = '';

function updatePuppyChip() {
  if (!puppyLabel) return;
  const text =
    puppy.state !== 'hidden'
      ? 'On it!'
      : state.doorCooldown > 0
        ? `${Math.ceil(state.doorCooldown)}s`
        : 'Ready';
  const wasReady = puppyChipText === 'Ready';
  if (text === puppyChipText) return;
  puppyChipText = text;
  puppyLabel.textContent = text;
  puppyLabel.parentElement.classList.toggle('is-ready', text === 'Ready');
  if (text === 'Ready' && !wasReady && state.wave > 0) audio.ready();
}

function spawnShockwave(position) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.5, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf4ffe0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position).setY(0.08);
  scene.add(ring);
  effects.push({ mesh: ring, life: 0.7, maxLife: 0.7, grow: 14 });
}

/* Every deer near the bark bolts for the treeline. */
function scareDeer(origin, radius) {
  let scared = 0;
  for (const deer of deerList) {
    if (!deer.alive || deer.state === 'dead' || deer.state === 'flee' || deer.state === 'tame') continue;
    if (deer.group.position.distanceTo(origin) > radius) continue;
    const side = deer.group.position.x >= 0 ? 1 : -1;
    deer.state = 'flee';
    deer.fleeSpeed = Math.max(4, deer.speed * 1.9);
    deer.fleeTarget = new THREE.Vector3(side * 36, 0, deer.group.position.z + rand(-2, 6));
    deer.biteTimer = 1;
    scared += 1;
  }
  return scared;
}

function bark() {
  const scared = scareDeer(puppy.group.position, 26);
  spawnShockwave(puppy.group.position);
  audio.bark();
  showBanner('WOOF!');
  statusEl.textContent = scared
    ? `Bear barked and ${scared} zombie reindeer bolted for the trees.`
    : 'Bear barked at an empty yard. Good boy anyway.';
}

function callPuppy() {
  if (puppy.state !== 'hidden') {
    showBanner('Bear is already out there!');
    return;
  }
  if (state.doorCooldown > 0) {
    showBanner(`Bear is resting (${Math.ceil(state.doorCooldown)}s)`);
    return;
  }
  state.doorCooldown = 14;
  puppy.state = 'run-out';
  puppy.timer = 0;
  puppy.step = 0;
  puppy.group.visible = true;
  puppy.group.position.copy(PUPPY_HOME);
  puppy.group.rotation.set(0, 0, 0);
  showBanner('Bear is on the case!');
  statusEl.textContent = 'Bear the puppy charges out of the house.';
  audio.callPuppy();
  spawnShockwave(PUPPY_HOME);
  updatePuppyChip();
}

function hidePuppy() {
  puppy.state = 'hidden';
  puppy.group.visible = false;
  puppy.group.position.y = 0;
  updatePuppyChip();
}

function updatePuppy(dt, time) {
  if (state.doorCooldown > 0) state.doorCooldown = Math.max(0, state.doorCooldown - dt);
  updatePuppyChip();
  if (puppy.state === 'hidden') return;

  puppy.timer += dt;
  const position = puppy.group.position;
  const legs = puppy.group.userData.legs;
  const headPivot = puppy.group.userData.headPivot;
  const tailPivot = puppy.group.userData.tailPivot;

  const moveTo = (target) => {
    const direction = new THREE.Vector3().subVectors(target, position);
    direction.y = 0;
    const distance = direction.length();
    if (distance < 0.45) return true;
    direction.normalize();
    position.addScaledVector(direction, Math.min(10 * dt, distance));
    const desired = Math.atan2(direction.x, direction.z);
    let delta = desired - puppy.group.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    puppy.group.rotation.y += delta * Math.min(1, dt * 10);
    return false;
  };

  if (puppy.state === 'run-out' || puppy.state === 'run-home') {
    const arrived = moveTo(puppy.state === 'run-out' ? PUPPY_SPOT : PUPPY_HOME);
    const groundY = position.z < -8.05 ? 0.3 : 0;
    position.y += (groundY - position.y) * Math.min(1, dt * 8);

    puppy.step += dt * 20;
    const swing = Math.sin(puppy.step) * 0.75;
    legs[0].rotation.x = swing;
    legs[3].rotation.x = swing;
    legs[1].rotation.x = -swing;
    legs[2].rotation.x = -swing;

    if (arrived) {
      if (puppy.state === 'run-out') {
        puppy.state = 'bark';
        puppy.timer = 0;
        legs.forEach((leg) => {
          leg.rotation.x = 0;
        });
        bark();
      } else {
        hidePuppy();
        return;
      }
    }
  } else if (puppy.state === 'bark') {
    position.y = Math.abs(Math.sin(time * 9)) * 0.16;
    legs.forEach((leg, index) => {
      leg.rotation.x = Math.sin(time * 14 + index) * 0.3;
    });
    headPivot.rotation.x = -0.15 + Math.sin(time * 12) * 0.12;
    if (puppy.timer > 2.4) {
      puppy.state = 'run-home';
      puppy.timer = 0;
      audio.bearLeave();
    }
  }

  tailPivot.rotation.y = Math.sin(time * 16) * 0.7;
  if (puppy.state !== 'bark') headPivot.rotation.x = Math.sin(time * 6) * 0.08;
}

/* ------------------------------------------------------------------ *
 * Santa's chimney surprise
 * ------------------------------------------------------------------ */

const santaSuitMaterial = new THREE.MeshStandardMaterial({ color: 0xc21818, roughness: 0.75 });
const santaFurMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.95 });
const santaBlackMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1a1a, roughness: 0.8 });
const santaSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xf0c9a8, roughness: 0.8 });
const santaGoldMaterial = new THREE.MeshStandardMaterial({ color: 0xffd45e, roughness: 0.4, metalness: 0.5 });
const santaSackMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.95 });
const presentMaterial = new THREE.MeshStandardMaterial({ color: 0xd12b2b, roughness: 0.6 });
const presentRibbonMaterial = new THREE.MeshStandardMaterial({ color: 0xffd45e, roughness: 0.4, metalness: 0.4 });
const presentBoxGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const presentRibbonGeometryA = new THREE.BoxGeometry(0.33, 0.33, 0.07);
const presentRibbonGeometryB = new THREE.BoxGeometry(0.07, 0.33, 0.33);

function buildSanta() {
  const group = new THREE.Group();

  for (const side of [-1, 1]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.36), santaBlackMaterial);
    boot.position.set(side * 0.16, 0.09, 0.05);
    group.add(boot);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.23), santaSuitMaterial);
    leg.position.set(side * 0.16, 0.42, 0);
    group.add(leg);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.2), santaSuitMaterial);
    arm.position.set(side * 0.43, 1.12, 0.04);
    arm.rotation.z = side * 0.32;
    group.add(arm);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.23), santaFurMaterial);
    cuff.position.set(side * 0.52, 0.87, 0.07);
    group.add(cuff);

    const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), santaBlackMaterial);
    mitten.position.set(side * 0.56, 0.77, 0.1);
    group.add(mitten);

    const mustache = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), santaFurMaterial);
    mustache.position.set(side * 0.08, 1.7, 0.25);
    mustache.scale.set(1.2, 0.7, 0.8);
    group.add(mustache);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), santaBlackMaterial);
    eye.position.set(side * 0.09, 1.79, 0.23);
    group.add(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.05), santaFurMaterial);
    brow.position.set(side * 0.09, 1.85, 0.23);
    group.add(brow);
  }

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), santaSuitMaterial);
  belly.scale.set(1, 1.15, 0.85);
  belly.position.y = 1.02;
  group.add(belly);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.62), santaBlackMaterial);
  belt.position.y = 0.82;
  group.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), santaGoldMaterial);
  buckle.position.set(0, 0.82, 0.34);
  group.add(buckle);

  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 16), santaFurMaterial);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.62;
  group.add(hem);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), santaSkinMaterial);
  head.position.y = 1.72;
  group.add(head);

  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), santaFurMaterial);
  beard.scale.set(1.05, 1.3, 0.8);
  beard.position.set(0, 1.58, 0.14);
  group.add(beard);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe07a6a, roughness: 0.8 }));
  nose.position.set(0, 1.77, 0.26);
  group.add(nose);

  const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 16), santaFurMaterial);
  hatBrim.rotation.x = Math.PI / 2;
  hatBrim.position.y = 1.95;
  group.add(hatBrim);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 10), santaSuitMaterial);
  hat.position.set(0.03, 2.18, -0.02);
  hat.rotation.z = -0.2;
  group.add(hat);

  const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), santaFurMaterial);
  pompom.position.set(0.15, 2.42, -0.02);
  group.add(pompom);

  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), santaSackMaterial);
  sack.scale.set(0.9, 1.05, 0.8);
  sack.position.set(-0.34, 1.05, -0.32);
  group.add(sack);

  const hand = new THREE.Object3D();
  hand.position.set(0.56, 0.9, 0.2);
  group.add(hand);
  group.userData.hand = hand;

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });

  return group;
}

const SANTA_CHIMNEY = new THREE.Vector3(-6.3, 9.2, -14.6);
const SANTA_SPOT = new THREE.Vector3(0.6, 0, -1.6);

const santa = {
  group: buildSanta(),
  state: 'hidden',
  timer: 0,
  throwTimer: 0,
  presents: [],
  hopFrom: new THREE.Vector3(),
  hopTo: new THREE.Vector3(),
};
santa.group.scale.setScalar(1.15);
santa.group.visible = false;
scene.add(santa.group);

const santaLabel = document.querySelector('#santa-label');
let santaChipText = '';

function updateSantaChip() {
  if (!santaLabel) return;
  const text =
    santa.state !== 'hidden'
      ? 'Ho ho!'
      : state.santaCooldown > 0
        ? `${Math.ceil(state.santaCooldown)}s`
        : 'Ready';
  const wasReady = santaChipText === 'Ready';
  if (text === santaChipText) return;
  santaChipText = text;
  santaLabel.textContent = text;
  santaLabel.parentElement.classList.toggle('is-ready', text === 'Ready');
  if (text === 'Ready' && !wasReady && state.wave > 0) audio.ready();
}

/* Confetti for exploding presents. */
const confettiGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.02);
const confettiColors = [0xff3b3b, 0x3ddc84, 0xffd45e, 0x6ec6ff, 0xffffff];
const confettiPieces = [];

function spawnConfetti(position) {
  for (let i = 0; i < 14; i += 1) {
    const mesh = new THREE.Mesh(
      confettiGeometry,
      new THREE.MeshBasicMaterial({
        color: confettiColors[i % confettiColors.length],
        transparent: true,
      })
    );
    mesh.position.copy(position);
    scene.add(mesh);
    confettiPieces.push({
      mesh,
      velocity: new THREE.Vector3(rand(-3.5, 3.5), rand(2.5, 6.5), rand(-3.5, 3.5)),
      life: 0.9,
      maxLife: 0.9,
      spin: rand(-9, 9),
    });
  }
}

function updateConfetti(dt) {
  for (let i = confettiPieces.length - 1; i >= 0; i -= 1) {
    const piece = confettiPieces[i];
    piece.life -= dt;
    piece.velocity.y -= dt * 9;
    piece.mesh.position.addScaledVector(piece.velocity, dt);
    piece.mesh.rotation.x += piece.spin * dt;
    piece.mesh.rotation.z += piece.spin * dt * 0.7;
    piece.mesh.material.opacity = Math.max(0, piece.life / piece.maxLife);
    if (piece.life <= 0) {
      scene.remove(piece.mesh);
      piece.mesh.material.dispose();
      confettiPieces.splice(i, 1);
    }
  }
}

function nearestDeer() {
  let best = null;
  let bestDistance = 30;
  for (const deer of deerList) {
    if (!deer.alive || deer.state === 'dead' || deer.state === 'flee' || deer.state === 'tame') continue;
    const distance = deer.group.position.distanceTo(santa.group.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = deer;
    }
  }
  return best;
}

function throwPresent(deer) {
  const start = new THREE.Vector3();
  santa.group.userData.hand.getWorldPosition(start);

  const present = new THREE.Group();
  present.add(new THREE.Mesh(presentBoxGeometry, presentMaterial));
  present.add(new THREE.Mesh(presentRibbonGeometryA, presentRibbonMaterial));
  present.add(new THREE.Mesh(presentRibbonGeometryB, presentRibbonMaterial));
  present.position.copy(start);
  present.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });
  scene.add(present);

  santa.presents.push({
    mesh: present,
    deer,
    t: 0,
    duration: 0.7,
    start,
    last: deer.group.position.clone().setY(1.2),
  });
  audio.presentThrow();
}

function updatePresents(dt) {
  for (let i = santa.presents.length - 1; i >= 0; i -= 1) {
    const present = santa.presents[i];
    present.t += dt;
    const progress = Math.min(1, present.t / present.duration);

    if (present.deer && present.deer.alive) {
      present.last.copy(present.deer.group.position).setY(1.2);
    }

    present.mesh.position.lerpVectors(present.start, present.last, progress);
    present.mesh.position.y += Math.sin(progress * Math.PI) * 2.4;
    present.mesh.rotation.x += dt * 9;
    present.mesh.rotation.y += dt * 7;

    if (progress >= 1) {
      audio.presentPop();
      spawnConfetti(present.mesh.position);
      spawnImpact(present.mesh.position, true);
      if (present.deer && present.deer.alive) {
        killDeer(present.deer, false);
      }
      scene.remove(present.mesh);
      santa.presents.splice(i, 1);
    }
  }
}

function callSanta() {
  if (santa.state !== 'hidden') {
    showBanner('Santa is already on it!');
    return;
  }
  if (state.santaCooldown > 0) {
    showBanner(`Santa is checking his list (${Math.ceil(state.santaCooldown)}s)`);
    return;
  }

  state.santaCooldown = 26;
  santa.state = 'rise';
  santa.timer = 0;
  santa.throwTimer = 0.5;
  santa.group.visible = true;
  santa.group.position.set(-6.3, 7.1, -14.6);
  santa.group.rotation.set(0, 0.15, 0);
  showBanner('HO HO HO!');
  statusEl.textContent = 'Santa pops out of the chimney to help defend the house.';
  audio.hoHoHo();
  spawnShockwave(new THREE.Vector3(-6.3, 9.1, -14.6));
  updateSantaChip();
}

function updateSanta(dt, time) {
  if (state.santaCooldown > 0) state.santaCooldown = Math.max(0, state.santaCooldown - dt);
  updateSantaChip();
  updatePresents(dt);
  updateConfetti(dt);

  if (santa.state === 'hidden') return;
  santa.timer += dt;
  const group = santa.group;

  if (santa.state === 'rise') {
    group.position.y = Math.min(SANTA_CHIMNEY.y, group.position.y + dt * 5.5);
    group.rotation.y += dt * 0.8;
    if (group.position.y >= SANTA_CHIMNEY.y - 0.01) {
      santa.state = 'hop';
      santa.timer = 0;
      santa.hopFrom.copy(group.position);
      santa.hopTo.copy(SANTA_SPOT);
      audio.hoHoHo();
    }
  } else if (santa.state === 'hop') {
    const progress = Math.min(1, santa.timer / 1.15);
    group.position.lerpVectors(santa.hopFrom, santa.hopTo, progress);
    group.position.y += Math.sin(progress * Math.PI) * 2.6;
    group.rotation.y += dt * 2.4;
    if (progress >= 1) {
      group.position.copy(SANTA_SPOT);
      group.rotation.set(0, 0.2, 0);
      santa.state = 'throw';
      santa.timer = 0;
      santa.throwTimer = 0.4;
      spawnShockwave(SANTA_SPOT);
      audio.santaLand();
    }
  } else if (santa.state === 'throw') {
    group.position.y = Math.abs(Math.sin(time * 3)) * 0.06;
    const target = nearestDeer();
    if (target) {
      const dx = target.group.position.x - group.position.x;
      const dz = target.group.position.z - group.position.z;
      group.rotation.y = Math.atan2(dx, dz);
      santa.throwTimer -= dt;
      if (santa.throwTimer <= 0) {
        santa.throwTimer = 0.95;
        throwPresent(target);
      }
    } else {
      group.rotation.y += dt * 0.8;
    }
    if (santa.timer > 9) {
      santa.state = 'leave';
      santa.timer = 0;
      group.rotation.z = 0;
      showBanner('Ho ho ho!');
      audio.hoHoHo();
    }
  } else if (santa.state === 'leave') {
    group.position.y += dt * 7;
    group.rotation.y += dt * 3;
    group.rotation.z = Math.sin(time * 5) * 0.12;
    if (santa.timer > 2.2) {
      santa.state = 'hidden';
      group.visible = false;
      group.rotation.z = 0;
      updateSantaChip();
    }
  }
}

/* ------------------------------------------------------------------ *
 * The motorcycle kids from the moon
 * ------------------------------------------------------------------ */

const bikeRedMaterial = new THREE.MeshStandardMaterial({ color: 0xd8322e, roughness: 0.5 });
const bikeDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.9 });
const bikeTyreMaterial = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.95 });
const bikeChromeMaterial = new THREE.MeshStandardMaterial({ color: 0xc2ccd8, roughness: 0.3, metalness: 0.75 });
const bikeGlassMaterial = new THREE.MeshStandardMaterial({
  color: 0x9fd0ff,
  transparent: true,
  opacity: 0.5,
  roughness: 0.15,
  metalness: 0.2,
});
const kidSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xf2cdae, roughness: 0.8 });
const kidBoySuitMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7fd6, roughness: 0.8 });
const kidGirlSuitMaterial = new THREE.MeshStandardMaterial({ color: 0x9a4fd0, roughness: 0.8 });
const kidBoyHatMaterial = new THREE.MeshStandardMaterial({ color: 0xd12b2b, roughness: 0.8 });
const kidGirlHatMaterial = new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.8 });
const kidBoyScarfMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.8 });
const kidGirlScarfMaterial = new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 0.8 });
const mitMaterial = new THREE.MeshStandardMaterial({ color: 0x30343d, roughness: 0.9 });

/* A little red motorcycle with a kid leaning over the handlebars. */
function buildMotorcycle({ bike, suit, hat, scarf }) {
  const group = new THREE.Group();

  /* Two fat wheels. */
  for (const z of [-0.78, 0.78]) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 10, 16), bikeTyreMaterial);
    tyre.rotation.y = Math.PI / 2;
    tyre.position.set(0, 0.48, z);
    group.add(tyre);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 10), bikeChromeMaterial);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.48, z);
    group.add(hub);
  }

  /* Frame, tank and saddle. */
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.34), bikeChromeMaterial);
  spine.position.set(0, 0.72, -0.02);
  group.add(spine);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.62), bike);
  tank.position.set(0, 0.88, 0.12);
  group.add(tank);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.6), bikeDarkMaterial);
  seat.position.set(0, 0.9, -0.5);
  group.add(seat);

  /* Forks, bars and a tiny fly screen. */
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.66, 0.09), bikeChromeMaterial);
  fork.position.set(0, 0.78, 0.7);
  fork.rotation.x = 0.22;
  group.add(fork);

  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), bikeChromeMaterial);
  bars.position.set(0, 1.06, 0.54);
  group.add(bars);

  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.05), bikeGlassMaterial);
  shield.position.set(0, 1.14, 0.62);
  shield.rotation.x = -0.3;
  group.add(shield);

  /* Red mudguards and a chrome exhaust. */
  const frontGuard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.56), bike);
  frontGuard.position.set(0, 0.9, 0.8);
  frontGuard.rotation.x = -0.14;
  group.add(frontGuard);

  const rearGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.5), bike);
  rearGuard.position.set(0, 0.92, -0.72);
  group.add(rearGuard);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.8, 8), bikeChromeMaterial);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.24, 0.44, -0.5);
  group.add(exhaust);

  const rider = new THREE.Group();
  rider.position.set(0, 0.96, -0.42);
  rider.rotation.x = 0.34;
  group.add(rider);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.34), suit);
  torso.position.set(0, 0.3, 0);
  rider.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), kidSkinMaterial);
  head.position.set(0, 0.74, 0.04);
  rider.add(head);

  const beanie = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hat
  );
  beanie.position.set(0, 0.76, 0.04);
  rider.add(beanie);

  const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), hat);
  bobble.position.set(0, 0.97, 0.02);
  rider.add(bobble);

  const neckScarf = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.07, 8, 14), scarf);
  neckScarf.position.set(0, 0.56, 0.02);
  neckScarf.rotation.x = Math.PI / 2;
  rider.add(neckScarf);

  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.08), scarf);
  scarfTail.position.set(0.14, 0.36, -0.22);
  scarfTail.rotation.x = -0.5;
  rider.add(scarfTail);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.14), suit);
    arm.position.set(side * 0.27, 0.34, 0.22);
    arm.rotation.x = -1.05;
    arm.rotation.z = side * 0.25;
    rider.add(arm);

    const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mitMaterial);
    mitten.position.set(side * 0.3, 0.18, 0.52);
    rider.add(mitten);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), suit);
    leg.position.set(side * 0.17, -0.28, 0.1);
    leg.rotation.x = -0.55;
    rider.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.3), mitMaterial);
    boot.position.set(side * 0.17, -0.48, 0.22);
    rider.add(boot);
  }

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8, toneMapped: false })
  );
  lamp.position.set(0, 0.98, 0.9);
  group.add(lamp);

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 3.6, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0b8,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.95, 3.1);
  group.add(beam);

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });

  return group;
}

const bikeRiders = [
  {
    group: buildMotorcycle({
      bike: bikeRedMaterial,
      suit: kidBoySuitMaterial,
      hat: kidBoyHatMaterial,
      scarf: kidBoyScarfMaterial,
    }),
    startX: -15,
    endX: 15,
    lane: 6.2,
    facing: 1,
  },
  {
    group: buildMotorcycle({
      bike: bikeRedMaterial,
      suit: kidGirlSuitMaterial,
      hat: kidGirlHatMaterial,
      scarf: kidGirlScarfMaterial,
    }),
    startX: 15,
    endX: -15,
    lane: 0.6,
    facing: -1,
  },
];

for (const rider of bikeRiders) {
  rider.group.scale.setScalar(1.5);
  rider.group.visible = false;
  scene.add(rider.group);
}

const bikeRun = {
  state: 'hidden',
  timer: 0,
  scareTimer: 0,
  midShout: false,
  duration: 6.5,
};

const bikeLabel = document.querySelector('#bike-label');
let bikeChipText = '';

function updateBikeChip() {
  if (!bikeLabel) return;
  const text =
    bikeRun.state === 'riding'
      ? 'Riding!'
      : state.bikeCooldown > 0
        ? `${Math.ceil(state.bikeCooldown)}s`
        : 'Ready';
  const wasReady = bikeChipText === 'Ready';
  if (text === bikeChipText) return;
  bikeChipText = text;
  bikeLabel.textContent = text;
  bikeLabel.parentElement.classList.toggle('is-ready', text === 'Ready');
  if (text === 'Ready' && !wasReady && state.wave > 0) audio.ready();
}

/* Snow kicked up behind the tracks. */
const sprayGeometry = new THREE.SphereGeometry(0.16, 6, 6);
const sprayMaterial = new THREE.MeshBasicMaterial({ color: 0xeef7ff, transparent: true, opacity: 0.8 });
const sprayPieces = [];

function spawnSpray(position, direction) {
  const mesh = new THREE.Mesh(sprayGeometry, sprayMaterial);
  mesh.position.copy(position);
  mesh.scale.setScalar(rand(0.7, 1.7));
  scene.add(mesh);
  sprayPieces.push({
    mesh,
    velocity: new THREE.Vector3(-direction * rand(1.5, 4), rand(1.2, 3.4), rand(-1.2, 1.2)),
    life: 0.55,
  });
}

function updateSpray(dt) {
  for (let i = sprayPieces.length - 1; i >= 0; i -= 1) {
    const piece = sprayPieces[i];
    piece.life -= dt;
    piece.velocity.y -= dt * 11;
    piece.mesh.position.addScaledVector(piece.velocity, dt);
    piece.mesh.scale.multiplyScalar(0.965);
    if (piece.life <= 0) {
      scene.remove(piece.mesh);
      sprayPieces.splice(i, 1);
    }
  }
}

function callMotorcycles() {
  if (bikeRun.state === 'riding') {
    showBanner('The bikes are already out!');
    return;
  }
  if (state.bikeCooldown > 0) {
    showBanner(`The bikes are warming up (${Math.ceil(state.bikeCooldown)}s)`);
    return;
  }

  state.bikeCooldown = 24;
  bikeRun.state = 'riding';
  bikeRun.timer = 0;
  bikeRun.scareTimer = 0;
  bikeRun.midShout = false;
  moonPulse = 1;

  for (const rider of bikeRiders) {
    rider.group.visible = true;
    rider.group.position.set(rider.startX, 0, rider.lane);
  }

  showBanner('YEE-HAW!');
  statusEl.textContent = 'A boy and a girl on little red motorcycles roar in to chase the reindeer away.';
  audio.moonShot();
  audio.motorcycle();
  audio.yeehaw();
  updateBikeChip();
}

function updateMotorcycles(dt, time) {
  if (state.bikeCooldown > 0) state.bikeCooldown = Math.max(0, state.bikeCooldown - dt);
  updateBikeChip();
  updateSpray(dt);

  if (bikeRun.state !== 'riding') return;

  bikeRun.timer += dt;
  const progress = Math.min(1, bikeRun.timer / bikeRun.duration);

  for (const rider of bikeRiders) {
    const x = rider.startX + (rider.endX - rider.startX) * progress;
    rider.group.position.set(x, 0, rider.lane + Math.sin(time * 2.4 + rider.lane) * 0.08);
    rider.group.rotation.y =
      (rider.facing > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(time * 3 + rider.lane) * 0.05;
    rider.group.rotation.z = Math.sin(time * 8 + rider.lane) * 0.05;

    if (Math.random() < 0.8) {
      spawnSpray(new THREE.Vector3(x - rider.facing * 1.5, 0.32, rider.lane), rider.facing);
    }
  }

  /* Anything near a passing bike bolts for the trees. */
  bikeRun.scareTimer -= dt;
  if (bikeRun.scareTimer <= 0) {
    bikeRun.scareTimer = 0.18;
    for (const rider of bikeRiders) scareDeer(rider.group.position, 15);
  }

  if (!bikeRun.midShout && progress > 0.45) {
    bikeRun.midShout = true;
    showBanner('Bye-bye, reindeer!');
    audio.yeehaw();
  }

  if (progress >= 1) {
    for (const rider of bikeRiders) rider.group.visible = false;
    bikeRun.state = 'hidden';
    statusEl.textContent = 'The little red motorcycles cleared the yard and roared off into the night.';
    updateBikeChip();
  }
}

/* ------------------------------------------------------------------ *
 * The witch in the upstairs window
 * ------------------------------------------------------------------ */

const WITCH_WINDOW = new THREE.Vector3(5.2, 4.9, house.position.z + FRONT + 0.35);
const TAME_SECONDS = 10;

const witchPurpleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3fb5, roughness: 0.75 });
const witchHatMaterial = new THREE.MeshStandardMaterial({ color: 0x452782, roughness: 0.8 });
const witchSkinMaterial = new THREE.MeshStandardMaterial({ color: 0x8ed08a, roughness: 0.85 });
const witchHairMaterial = new THREE.MeshStandardMaterial({ color: 0x2f2350, roughness: 0.9 });
const witchEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff7d0 });
const spellMaterial = new THREE.MeshBasicMaterial({ color: 0xff8ff0, toneMapped: false });

/* Just her head and shoulders, leaning out of the window. */
function buildWitch() {
  const group = new THREE.Group();

  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.0, 12), witchPurpleMaterial);
  dress.position.y = 0.5;
  group.add(dress);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 14), witchHatMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.98;
  group.add(collar);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), witchSkinMaterial);
  head.position.y = 1.24;
  group.add(head);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), witchSkinMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.2, 0.3);
  group.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), witchEyeMaterial);
    eye.position.set(side * 0.1, 1.3, 0.22);
    group.add(eye);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), witchHairMaterial);
    hair.position.set(side * 0.22, 1.12, -0.06);
    hair.rotation.z = side * 0.18;
    group.add(hair);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), witchPurpleMaterial);
    arm.position.set(side * 0.32, 0.86, 0.16);
    arm.rotation.x = -0.9;
    arm.rotation.z = side * 0.35;
    group.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), witchSkinMaterial);
    hand.position.set(side * 0.34, 0.7, 0.4);
    group.add(hand);
  }

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), witchHatMaterial);
  brim.position.y = 1.4;
  group.add(brim);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 12), witchHatMaterial);
  cone.position.set(0.03, 1.83, -0.03);
  cone.rotation.z = -0.14;
  group.add(cone);

  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), witchHairMaterial);
  wand.position.set(0.4, 0.78, 0.62);
  wand.rotation.x = 1.2;
  wand.rotation.z = 0.2;
  group.add(wand);

  const tip = new THREE.Object3D();
  tip.position.set(0.46, 0.9, 0.95);
  group.add(tip);
  group.userData.wandTip = tip;

  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), spellMaterial);
  spark.position.copy(tip.position);
  group.add(spark);
  group.userData.wandSpark = spark;

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });

  return group;
}

const witch = {
  group: buildWitch(),
  state: 'hidden',
  timer: 0,
  castTimer: 0,
  bolts: [],
};
witch.group.position.set(WITCH_WINDOW.x, WITCH_WINDOW.y - 0.92, WITCH_WINDOW.z);
witch.group.visible = false;
scene.add(witch.group);

const witchLabel = document.querySelector('#witch-label');
let witchChipText = '';

function updateWitchChip() {
  if (!witchLabel) return;
  const text =
    witch.state !== 'hidden'
      ? 'Hexing!'
      : state.witchCooldown > 0
        ? `${Math.ceil(state.witchCooldown)}s`
        : 'Ready';
  const wasReady = witchChipText === 'Ready';
  if (text === witchChipText) return;
  witchChipText = text;
  witchLabel.textContent = text;
  witchLabel.parentElement.classList.toggle('is-ready', text === 'Ready');
  if (text === 'Ready' && !wasReady && state.wave > 0) audio.ready();
}

/* A tame fox, ready to stand in for a hexed reindeer. */
const foxOrangeMaterial = new THREE.MeshStandardMaterial({ color: 0xe2762a, roughness: 0.85, flatShading: true });
const foxCreamMaterial = new THREE.MeshStandardMaterial({ color: 0xfdf6ec, roughness: 0.9 });
const foxDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.9 });

function buildFox() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), foxOrangeMaterial);
  body.scale.set(0.55, 0.5, 0.9);
  body.position.y = 0.62;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), foxCreamMaterial);
  chest.scale.set(0.5, 0.45, 0.5);
  chest.position.set(0, 0.6, 0.5);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), foxOrangeMaterial);
  head.position.set(0, 0.92, 0.72);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), foxCreamMaterial);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.86, 1.02);
  group.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), foxDarkMaterial);
  nose.position.set(0, 0.86, 1.18);
  group.add(nose);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 4), foxOrangeMaterial);
    ear.position.set(side * 0.16, 1.18, 0.7);
    ear.rotation.z = side * 0.16;
    group.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), foxDarkMaterial);
    eye.position.set(side * 0.11, 0.98, 0.97);
    group.add(eye);

    const frontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), foxDarkMaterial);
    frontLeg.position.set(side * 0.22, 0.2, 0.5);
    group.add(frontLeg);

    const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), foxDarkMaterial);
    backLeg.position.set(side * 0.22, 0.2, -0.42);
    group.add(backLeg);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 8), foxOrangeMaterial);
  tail.rotation.x = -1.9;
  tail.position.set(0, 0.85, -0.9);
  group.add(tail);

  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), foxCreamMaterial);
  tailTip.position.set(0, 1.22, -1.18);
  group.add(tailTip);

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });

  return group;
}

/* Shooting a fox sends the reindeer it was hiding in straight to the graveyard. */
function popFox(deer) {
  if (!deer.alive || deer.state !== 'tame') return;
  const at = deer.group.position.clone().setY(0.8);
  spawnConfetti(at);
  revertDeer(deer);
  killDeer(deer, false);
}

function tameDeer(deer) {
  if (!deer.alive || deer.state === 'dead' || deer.state === 'tame') return;

  deer.state = 'tame';
  deer.tameTimer = TAME_SECONDS;
  deer.tamePhase = 0;
  deer.tameTarget = null;
  deer.savedHitMeshes = deer.hitMeshes.slice();
  removeDeerHitMeshes(deer);

  deer.group.traverse((node) => {
    if (node.isMesh) node.visible = false;
  });

  const fox = buildFox();
  fox.rotation.y = Math.random() * Math.PI * 2;
  deer.group.add(fox);
  deer.fox = fox;

  /* A generous hitbox so the fox can be shot out of the yard too. */
  const foxHitbox = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 10, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  foxHitbox.position.set(0, 0.8, 0.2);
  foxHitbox.userData.foxDeer = deer;
  deer.group.add(foxHitbox);
  deer.foxHitbox = foxHitbox;
  deer.hitMeshes.push(foxHitbox);
  hitMeshes.push(foxHitbox);

  const at = deer.group.position.clone().setY(1.1);
  spawnImpact(at, true);
  spawnConfetti(at);
  audio.foxPop();
}

function revertDeer(deer) {
  if (deer.fox) {
    deer.group.remove(deer.fox);
    deer.fox = null;
  }

  if (deer.foxHitbox) {
    deer.group.remove(deer.foxHitbox);
    const foxIndex = hitMeshes.indexOf(deer.foxHitbox);
    if (foxIndex >= 0) hitMeshes.splice(foxIndex, 1);
    deer.foxHitbox.geometry.dispose();
    deer.foxHitbox.material.dispose();
    deer.foxHitbox = null;
  }

  deer.group.traverse((node) => {
    if (node.isMesh) node.visible = true;
  });

  deer.state = 'walk';
  deer.tameTimer = 0;
  deer.biteTimer = 1;

  for (const mesh of deer.savedHitMeshes || []) {
    if (mesh.userData.deer !== deer) continue;
    deer.hitMeshes.push(mesh);
    if (!hitMeshes.includes(mesh)) hitMeshes.push(mesh);
  }
  deer.savedHitMeshes = null;

  const at = deer.group.position.clone().setY(1.1);
  spawnImpact(at, false);
  audio.foxRevert();
}

function nearestWitchDeer() {
  let best = null;
  let bestDistance = 28;
  for (const deer of deerList) {
    if (!deer.alive || deer.state === 'dead' || deer.state === 'flee' || deer.state === 'tame') continue;
    const distance = deer.group.position.distanceTo(WITCH_WINDOW);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = deer;
    }
  }
  return best;
}

function fireWitchBolt(deer) {
  const start = new THREE.Vector3();
  witch.group.userData.wandTip.getWorldPosition(start);

  const orb = new THREE.Group();
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffb6f4, toneMapped: false });
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), coreMaterial));
  orb.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xff8ff0,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  orb.position.copy(start);
  scene.add(orb);

  witch.bolts.push({
    mesh: orb,
    deer,
    t: 0,
    duration: 0.55,
    start: start.clone(),
    last: deer.group.position.clone().setY(1.1),
  });

  audio.witchCast();
}

function updateWitchBolts(dt) {
  for (let i = witch.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = witch.bolts[i];
    bolt.t += dt;

    if (bolt.deer && bolt.deer.alive && bolt.deer.state !== 'dead') {
      bolt.last.copy(bolt.deer.group.position).setY(1.05 * bolt.deer.group.scale.x);
    }

    const progress = Math.min(1, bolt.t / bolt.duration);
    bolt.mesh.position.lerpVectors(bolt.start, bolt.last, progress);
    bolt.mesh.position.y += Math.sin(progress * Math.PI) * 1.2;
    bolt.mesh.scale.setScalar(0.85 + Math.sin(bolt.t * 22) * 0.2);

    if (progress >= 1) {
      scene.remove(bolt.mesh);
      bolt.mesh.traverse((node) => {
        if (node.isMesh) node.material.dispose();
      });
      witch.bolts.splice(i, 1);

      if (bolt.deer && bolt.deer.alive && bolt.deer.state !== 'dead') {
        spawnImpact(bolt.last, true);
        tameDeer(bolt.deer);
      }
    }
  }
}

function callWitch() {
  if (witch.state !== 'hidden') {
    showBanner('The witch is already hexing!');
    return;
  }
  if (state.witchCooldown > 0) {
    showBanner(`The witch is brewing (${Math.ceil(state.witchCooldown)}s)`);
    return;
  }

  state.witchCooldown = 28;
  witch.state = 'cast';
  witch.timer = 0;
  witch.castTimer = 0.5;
  witch.group.visible = true;
  witch.group.scale.setScalar(0.35);
  witch.group.rotation.z = 0;
  showBanner('The witch is in!');
  statusEl.textContent = 'A witch leans out of the upstairs window and turns reindeer into foxes.';
  audio.witchCackle();
  spawnConfetti(WITCH_WINDOW.clone());
  updateWitchChip();
}

function updateWitch(dt, time) {
  if (state.witchCooldown > 0) state.witchCooldown = Math.max(0, state.witchCooldown - dt);
  updateWitchChip();
  updateWitchBolts(dt);

  if (witch.state === 'hidden') return;

  witch.timer += dt;
  const spark = witch.group.userData.wandSpark;
  spark.rotation.y += dt * 5;
  spark.scale.setScalar(0.85 + Math.sin(time * 10) * 0.25);

  if (witch.state === 'cast') {
    witch.group.scale.setScalar(Math.min(1, witch.group.scale.x + dt * 3.4));
    witch.group.rotation.z = Math.sin(time * 2.4) * 0.05;

    witch.castTimer -= dt;
    if (witch.castTimer <= 0) {
      const target = nearestWitchDeer();
      if (target) {
        witch.castTimer = 0.8;
        fireWitchBolt(target);
      } else {
        witch.castTimer = 0.35;
      }
    }

    if (witch.timer > 9.5) {
      witch.state = 'leave';
      witch.timer = 0;
      showBanner('Hehehehe!');
      audio.witchCackle();
    }
  } else if (witch.state === 'leave') {
    witch.group.scale.setScalar(Math.max(0.05, witch.group.scale.x - dt * 2.6));
    if (witch.group.scale.x <= 0.06) {
      witch.state = 'hidden';
      witch.group.visible = false;
      witch.group.scale.setScalar(1);
      witch.group.rotation.z = 0;
      updateWitchChip();
    }
  }
}

/* ------------------------------------------------------------------ *
 * Dad, and his very inaccurate disc golf
 * ------------------------------------------------------------------ */

const STAR_HITS = 3;
const HOUSE_FRONT_Z = house.position.z + FRONT;
const DAD_SPOT = new THREE.Vector3(7.3, 0, -1.9);
const DAD_HIDE = new THREE.Vector3(10.6, 0, -4.9);
const WINDOW_SPOTS = [
  { x: -4.5, y: 1.95, w: 3.2, h: 1.9 },
  { x: 4.4, y: 1.95, w: 3.0, h: 1.9 },
  { x: 5.2, y: 4.9, w: 1.05, h: 1.75 },
];

const starEgg = { hits: 0, wobble: 0 };

/* A round, cheerful dad in a Christmas sweater. */
const dadShirtMaterial = new THREE.MeshStandardMaterial({ color: 0xb8352f, roughness: 0.9 });
const dadShirtLightMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
const dadShortsMaterial = new THREE.MeshStandardMaterial({ color: 0x3f5060, roughness: 0.95 });
const dadSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b48d, roughness: 0.85 });
const dadSockMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.9 });
const dadShoeMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
const dadHairMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 });
const dadSunGlassMaterial = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.3, metalness: 0.4 });
const dadCapMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a8a, roughness: 0.85 });

function buildDad() {
  const group = new THREE.Group();

  /* Short legs, socks and sandals. */
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.5, 10), dadSkinMaterial);
    leg.position.set(side * 0.26, 0.42, 0);
    group.add(leg);

    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 10), dadSockMaterial);
    sock.position.set(side * 0.26, 0.18, 0);
    group.add(sock);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.44), dadShoeMaterial);
    shoe.position.set(side * 0.26, 0.06, 0.06);
    group.add(shoe);
  }

  const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.5), dadShortsMaterial);
  shorts.position.y = 0.72;
  group.add(shorts);

  /* The belly is the main character. */
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), dadShirtMaterial);
  belly.scale.set(1.02, 1.0, 0.9);
  belly.position.set(0, 1.16, 0.04);
  group.add(belly);

  const sweaterStripe = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 18), dadShirtLightMaterial);
  sweaterStripe.rotation.x = Math.PI / 2;
  sweaterStripe.position.set(0, 1.02, 0.04);
  group.add(sweaterStripe);

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), dadShirtMaterial);
  shoulders.scale.set(1.05, 0.72, 0.85);
  shoulders.position.set(0, 1.62, 0);
  group.add(shoulders);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), dadSkinMaterial);
  head.position.set(0, 2.06, 0.02);
  group.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dadSkinMaterial);
  nose.position.set(0, 2.02, 0.32);
  group.add(nose);

  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.08), dadHairMaterial);
  mustache.position.set(0, 1.92, 0.3);
  group.add(mustache);

  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.05), dadSunGlassMaterial);
  glasses.position.set(0, 2.1, 0.3);
  group.add(glasses);

  /* Backwards cap. */
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    dadCapMaterial
  );
  cap.position.set(0, 2.16, 0);
  group.add(cap);

  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.3), dadCapMaterial);
  brim.position.set(0, 2.14, -0.32);
  group.add(brim);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), dadSkinMaterial);
    ear.position.set(side * 0.31, 2.04, 0);
    group.add(ear);
  }

  /* Arms on pivots so he can wind up and throw. */
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.44, 1.66, 0);
    group.add(pivot);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 8), dadShirtMaterial);
    arm.position.y = -0.26;
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), dadSkinMaterial);
    hand.position.y = -0.58;
    pivot.add(hand);

    arms.push(pivot);
  }
  group.userData.arms = arms;

  const hand = new THREE.Object3D();
  hand.position.set(0.44, 1.06, 0.3);
  group.add(hand);
  group.userData.hand = hand;

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });

  return group;
}

const dad = {
  group: buildDad(),
  state: 'hidden',
  timer: 0,
  throwTimer: 0,
  armTimer: 0,
  throws: 0,
};
dad.group.position.copy(DAD_HIDE);
dad.group.visible = false;
scene.add(dad.group);

const dadDiscs = [];
const discGeometry = new THREE.CylinderGeometry(0.24, 0.22, 0.045, 16);
const discColors = [0xff5fa2, 0x59c3ff, 0xffd45e, 0x8ce88a];

function randomDadTarget() {
  const options = deerList.filter((deer) => deer.alive && deer.state !== 'dead' && deer.state !== 'tame');
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function throwDisc() {
  const target = randomDadTarget();
  let aim;

  if (target && Math.random() < 0.62) {
    /* Aimed at a reindeer, with a big helping of dad error. */
    aim = target.group.position.clone();
    aim.x += rand(-3.6, 3.6);
    aim.z += rand(-2.6, 2.6);
    aim.y = 0.1;
  } else {
    /* Wild throw that sails straight at the house. */
    aim = new THREE.Vector3(rand(-6.4, 6.4), rand(1.2, 5.2), HOUSE_FRONT_Z - 1.2);
  }

  const hand = new THREE.Vector3();
  dad.group.userData.hand.getWorldPosition(hand);

  const disc = new THREE.Mesh(
    discGeometry,
    new THREE.MeshStandardMaterial({ color: discColors[dad.throws % discColors.length], roughness: 0.5 })
  );
  disc.castShadow = true;
  disc.position.copy(hand);
  disc.rotation.x = Math.PI / 2;
  scene.add(disc);

  dadDiscs.push({
    mesh: disc,
    start: hand.clone(),
    aim,
    t: 0,
    duration: 0.8,
    spin: rand(-16, 16),
  });

  dad.throws += 1;
  dad.armTimer = 0.34;
  audio.dadThrow();
}

const crackTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(205, 232, 255, 0.4)';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 11; i += 1) {
    const angle = (i / 11) * Math.PI * 2 + rand(-0.2, 0.2);
    ctx.beginPath();
    ctx.moveTo(64, 64);
    let x = 64;
    let y = 64;
    const steps = 3;
    for (let s = 0; s < steps; s += 1) {
      x += Math.cos(angle + rand(-0.35, 0.35)) * rand(14, 24);
      y += Math.sin(angle + rand(-0.35, 0.35)) * rand(14, 24);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();

const brokenWindows = new Set();
const brokenWindowMeshes = [];

function breakWindow(index) {
  const window = WINDOW_SPOTS[index];
  const at = new THREE.Vector3(window.x, window.y, HOUSE_FRONT_Z + 0.28);
  spawnSnowPuff(at, 9, 3);
  spawnConfetti(at);

  if (brokenWindows.has(index)) return;
  brokenWindows.add(index);

  const crack = new THREE.Mesh(
    new THREE.PlaneGeometry(window.w * 0.95, window.h * 0.95),
    new THREE.MeshBasicMaterial({ map: crackTexture, transparent: true, opacity: 0.9, depthWrite: false })
  );
  crack.position.copy(at);
  crack.rotation.z = rand(-0.25, 0.25);
  scene.add(crack);
  brokenWindowMeshes.push(crack);
}

function discHouseHit(position) {
  let windowIndex = -1;
  WINDOW_SPOTS.forEach((window, index) => {
    if (
      Math.abs(position.x - window.x) < window.w / 2 + 0.7 &&
      Math.abs(position.y - window.y) < window.h / 2 + 0.7
    ) {
      windowIndex = index;
    }
  });

  if (windowIndex >= 0) {
    breakWindow(windowIndex);
    audio.windowSmash();
    showBanner('SMASH!');
    damageHouse(4);
  } else {
    audio.discHouse();
    spawnSnowPuff(position.clone(), 5, 2);
    showBanner(Math.random() < 0.4 ? 'DAD!' : 'Ouch');
    damageHouse(5);
  }
}

function updateDiscs(dt) {
  for (let i = dadDiscs.length - 1; i >= 0; i -= 1) {
    const disc = dadDiscs[i];
    disc.t += dt;
    const progress = Math.min(1, disc.t / disc.duration);

    disc.mesh.position.lerpVectors(disc.start, disc.aim, progress);
    disc.mesh.position.y += Math.sin(progress * Math.PI) * 1.5;
    disc.mesh.rotation.z += disc.spin * dt;
    disc.mesh.rotation.y += disc.spin * 0.3 * dt;

    let finished = false;

    if (
      disc.mesh.position.z <= HOUSE_FRONT_Z + 0.15 &&
      Math.abs(disc.mesh.position.x) <= 7.8 &&
      disc.mesh.position.y > 0.2 &&
      disc.mesh.position.y < 9.8
    ) {
      discHouseHit(disc.mesh.position.clone());
      finished = true;
    }

    if (!finished) {
      for (const deer of deerList) {
        if (!deer.alive || deer.state === 'dead' || deer.state === 'tame') continue;
        const chest = deer.group.position.clone().setY(1.05 * deer.group.scale.x);
        if (disc.mesh.position.distanceTo(chest) < 1.3) {
          damageDeer(deer, 2);
          spawnImpact(disc.mesh.position, false);
          audio.discHitDeer();
          finished = true;
          break;
        }
      }
    }

    if (!finished && disc.mesh.position.y <= 0.14) {
      spawnSnowPuff(disc.mesh.position.clone().setY(0.2), 4, 1.6);
      audio.discMiss();
      finished = true;
    }

    if (finished || progress >= 1) {
      scene.remove(disc.mesh);
      disc.mesh.material.dispose();
      dadDiscs.splice(i, 1);
    }
  }
}

function hitTreeStar(point) {
  if (dad.state !== 'hidden') return;

  starEgg.hits += 1;
  starEgg.wobble = 1;
  spawnImpact(point, false);
  spawnSnowPuff(point, 4, 1.6);

  if (starEgg.hits >= STAR_HITS) {
    callDad();
  } else {
    audio.starDing(starEgg.hits);
    showBanner(`Star ${starEgg.hits}/${STAR_HITS}`);
  }
}

function callDad() {
  starEgg.hits = 0;
  dad.state = 'in';
  dad.timer = 0;
  dad.throwTimer = 1.4;
  dad.armTimer = 0;
  dad.throws = 0;
  dad.group.visible = true;
  dad.group.position.copy(DAD_HIDE);
  dad.group.rotation.set(0, 0, 0);
  showBanner('HI DAD!');
  statusEl.textContent = 'Dad came out from behind the tree with a bag of discs. Accuracy: questionable.';
  audio.dadHi();
  spawnConfetti(new THREE.Vector3(9.8, 6.2, -3.5));
}

function updateDad(dt, time) {
  updateDiscs(dt);

  if (starEgg.wobble > 0) {
    starEgg.wobble = Math.max(0, starEgg.wobble - dt * 2.4);
    treeStar.scale.setScalar(1 + starEgg.wobble * 0.6);
  }

  if (dad.state === 'hidden') return;

  dad.timer += dt;
  const group = dad.group;
  const arms = group.userData.arms;

  if (dad.state === 'in') {
    const progress = Math.min(1, dad.timer / 0.9);
    group.position.lerpVectors(DAD_HIDE, DAD_SPOT, progress);
    group.position.y = Math.abs(Math.sin(progress * Math.PI * 3)) * 0.08;
    group.rotation.y = Math.PI * (1 - progress) * 0.6;
    if (progress >= 1) {
      dad.state = 'throw';
      dad.timer = 0;
      group.position.copy(DAD_SPOT);
      group.rotation.y = 0;
    }
  } else if (dad.state === 'throw') {
    group.position.y = Math.abs(Math.sin(time * 4)) * 0.05;
    group.rotation.z = Math.sin(time * 2.2) * 0.03;

    dad.armTimer = Math.max(0, dad.armTimer - dt);
    const windUp = dad.armTimer > 0 ? 1 - dad.armTimer / 0.34 : 0;
    arms[1].rotation.x = -0.3 - Math.sin(windUp * Math.PI) * 2.0;
    arms[0].rotation.x = -0.3 + Math.sin(time * 2) * 0.15;

    dad.throwTimer -= dt;
    if (dad.throwTimer <= 0) {
      dad.throwTimer = rand(0.85, 1.3);
      throwDisc();
    }

    if (dad.timer > 11) {
      dad.state = 'out';
      dad.timer = 0;
      showBanner('Bye, Dad!');
      audio.dadBye();
      statusEl.textContent = 'Dad wandered back behind the tree, looking for his discs.';
    }
  } else if (dad.state === 'out') {
    const progress = Math.min(1, dad.timer / 1.2);
    group.position.lerpVectors(DAD_SPOT, DAD_HIDE, progress);
    group.position.y = Math.abs(Math.sin(progress * Math.PI * 3)) * 0.06;
    group.rotation.y = -Math.PI * progress * 0.6;
    if (progress >= 1) {
      dad.state = 'hidden';
      group.visible = false;
      group.rotation.set(0, 0, 0);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Waves and game state
 * ------------------------------------------------------------------ */

const state = {
  phase: 'menu',
  wave: 0,
  score: 0,
  best: getBest('zombie-deer'),
  kills: 0,
  health: 100,
  active: 0,
  toSpawn: 0,
  spawnTimer: 0,
  spawnInterval: 1.4,
  breakTimer: 0,
  cooldown: 0,
  deerHp: 2,
  deerSpeed: 1.9,
  shake: 0,

  doorCooldown: 0,
  santaCooldown: 0,
  bikeCooldown: 0,
  witchCooldown: 0,
};

function updateHud() {
  const health = clamp(state.health, 0, 100);
  healthFill.style.width = `${health}%`;
  healthFill.style.background =
    health > 55
      ? 'linear-gradient(90deg, #4fae52, #a5e87a)'
      : health > 25
        ? 'linear-gradient(90deg, #d8a93c, #f2d87a)'
        : 'linear-gradient(90deg, #b32a2a, #ef6b6b)';
  healthLabel.textContent = `${Math.round(health)}%`;
  waveLabel.textContent = state.wave;
  scoreLabel.textContent = state.score;
  if (bestLabel) bestLabel.textContent = Math.max(state.best, state.score);
  killsLabel.textContent = state.kills;
}

let bannerTimer = 0;
function showBanner(text) {
  bannerText.textContent = text;
  banner.classList.add('show');
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => banner.classList.remove('show'), 1700);
}

function clearDeer() {
  for (const deer of deerList) {
    scene.remove(deer.group);
  }
  deerList.length = 0;
  hitMeshes.length = 0;
  state.active = 0;
}

function startGame() {
  clearDeer();
  state.phase = 'break';
  state.wave = 0;
  state.score = 0;
  state.kills = 0;
  state.health = 100;
  state.breakTimer = 1.8;
  state.toSpawn = 0;
  state.cooldown = 0;
  state.doorCooldown = 0;
  state.santaCooldown = 0;
  state.bikeCooldown = 0;
  bikeRun.state = 'hidden';
  bikeRun.timer = 0;
  bikeRun.midShout = false;
  for (const rider of bikeRiders) rider.group.visible = false;
  for (const piece of sprayPieces) scene.remove(piece.mesh);
  sprayPieces.length = 0;
  snowmanEgg.hits = 0;
  snowmanEgg.state = 'idle';
  snowmanEgg.timer = 0;
  snowmanEgg.wobble = 0;
  snowmanEgg.queue.length = 0;
  snowman.visible = true;
  snowman.scale.setScalar(1);
  snowman.rotation.set(0, 0.35, 0);
  state.witchCooldown = 0;
  witch.state = 'hidden';
  witch.group.visible = false;
  witch.group.scale.setScalar(1);
  witch.group.rotation.z = 0;
  for (const bolt of witch.bolts) scene.remove(bolt.mesh);
  witch.bolts.length = 0;
  updateWitchChip();
  starEgg.hits = 0;
  starEgg.wobble = 0;
  treeStar.scale.setScalar(1);
  dad.state = 'hidden';
  dad.timer = 0;
  dad.throwTimer = 0;
  dad.armTimer = 0;
  dad.throws = 0;
  dad.group.visible = false;
  dad.group.position.copy(DAD_HIDE);
  dad.group.rotation.set(0, 0, 0);
  for (const disc of dadDiscs) {
    scene.remove(disc.mesh);
    disc.mesh.material.dispose();
  }
  dadDiscs.length = 0;
  for (const crack of brokenWindowMeshes) scene.remove(crack);
  brokenWindowMeshes.length = 0;
  brokenWindows.clear();
  puppy.state = 'hidden';
  puppy.group.visible = false;
  santa.state = 'hidden';
  santa.group.visible = false;
  for (const present of santa.presents) {
    scene.remove(present.mesh);
  }
  santa.presents.length = 0;
  updatePuppyChip();
  updateSantaChip();
  updateBikeChip();
  overlay.classList.add('hidden');
  container.classList.add('playing');
  startButton.blur();
  updateHud();
  showBanner('Here come the reindeer');
  statusEl.textContent = 'The zombie reindeer are stamping through the snow. Defend the house.';
  audio.start();
  audio.startMusic();
}

function startWave() {
  state.wave += 1;
  state.phase = 'wave';
  const wave = state.wave;
  state.toSpawn = Math.min(3 + wave * 2, 24);
  state.spawnTimer = 0.4;
  state.spawnInterval = Math.max(0.5, 1.5 - wave * 0.09);
  state.deerHp = 2 + Math.floor((wave - 1) / 2);
  state.deerSpeed = Math.min(4.3, 1.8 + wave * 0.16);
  showBanner(`Wave ${wave}`);
  updateHud();
  audio.waveStart(wave);
  statusEl.textContent = `Wave ${wave}. ${state.toSpawn} zombie reindeer are coming.`;
}

function endWave() {
  state.phase = 'break';
  state.breakTimer = 4;
  const bonus = 50 * state.wave;
  state.score += bonus;
  updateHud();
  audio.waveClear();
  showBanner(`Wave ${state.wave} cleared  +${bonus}`);
  statusEl.textContent = `Wave ${state.wave} cleared. The house is still merry and bright.`;
}

function damageHouse(amount) {
  if (state.phase === 'over') return;
  state.health = clamp(state.health - amount, 0, 100);
  state.shake = 1;
  vignette.style.opacity = '0.85';
  audio.houseHit();
  updateHud();
  if (state.health <= 0) gameOver();
}

function gameOver() {
  state.phase = 'over';
  const result = submitScore('zombie-deer', state.score);
  state.best = result.best;
  updateHud();
  overlayTitle.textContent = 'The reindeer got in';
  const bestLine = result.isBest
    ? ' That is a new personal best! 🏆'
    : state.best > 0
      ? ` Your best is ${state.best}.`
      : '';
  overlayText.textContent = `You held them off for ${state.wave} wave${state.wave === 1 ? '' : 's'} and scored ${state.score} points.${bestLine} The presents survived, at least.`;
  startButton.textContent = 'Try again';
  overlay.classList.remove('hidden');
  container.classList.remove('playing');

  /* Swallow the taps that were already heading for the screen. */
  restartLockUntil = performance.now() + 1000;
  startButton.disabled = true;
  window.setTimeout(() => {
    startButton.disabled = false;
  }, 1000);
  audio.stopMusic();
  audio.gameOver();
  showBanner('The house fell');
  statusEl.textContent = 'The house fell. Press Try again to play again.';
}

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */

const effects = [];

function spawnImpact(position, big) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(big ? 0.5 : 0.34, 10, 10),
    new THREE.MeshBasicMaterial({
      color: big ? 0xffffff : 0xdcf0ff,
      transparent: true,
      opacity: 0.9,
    })
  );
  mesh.position.copy(position);
  scene.add(mesh);
  effects.push({ mesh, life: 0.28, maxLife: 0.28, grow: big ? 5 : 3.4 });
}

function spawnTracer(from, to) {
  const positions = new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]);
  const material = new THREE.LineBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 1,
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)), material);
  line.frustumCulled = false;
  scene.add(line);
  effects.push({ mesh: line, life: 0.09, maxLife: 0.09, fadeOnly: true });
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    const progress = 1 - Math.max(0, effect.life) / effect.maxLife;
    if (effect.fadeOnly) {
      effect.mesh.material.opacity = Math.max(0, 1 - progress);
    } else {
      effect.mesh.scale.setScalar(1 + progress * effect.grow);
      effect.mesh.material.opacity = Math.max(0, 0.9 * (1 - progress));
    }
    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
      effects.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

const pointer = new THREE.Vector2(0, 0);
const pointerPx = { x: 0, y: 0 };
const aim = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const muzzleWorld = new THREE.Vector3();
let lastPointerType = 'mouse';

function updatePointer(event) {
  const rect = container.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  pointer.set(x * 2 - 1, -(y * 2 - 1));
  pointerPx.x = x * rect.width;
  pointerPx.y = y * rect.height;

  lastPointerType = event.pointerType || 'mouse';
  if (lastPointerType === 'mouse') {
    /* Only the mouse sways the camera; touch aim stays rock steady. */
    aim.x = pointer.x;
    aim.y = pointer.y;
  } else {
    aim.x = 0;
    aim.y = 0;
  }

  crosshair.style.left = `${x * 100}%`;
  crosshair.style.top = `${y * 100}%`;
}

container.addEventListener('pointermove', updatePointer);

container.addEventListener('pointerdown', (event) => {
  updatePointer(event);
  fire();
});

container.addEventListener('pointerleave', (event) => {
  if ((event.pointerType || 'mouse') !== 'mouse') return;
  pointer.set(0, 0);
  aim.x = 0;
  aim.y = 0;
  crosshair.style.left = '50%';
  crosshair.style.top = '50%';
});

/*
 * Phones have small screens and fat thumbs, so taps get a generous magnet:
 * the nearest reindeer (or the door / chimney) wins if the tap lands close.
 */
function assistTarget() {
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const project = (vector) => {
    const point = vector.clone().project(camera);
    return {
      x: (point.x * 0.5 + 0.5) * rect.width,
      y: (-point.y * 0.5 + 0.5) * rect.height,
    };
  };

  let best = null;
  let bestDistance = 95;
  for (const deer of deerList) {
    if (!deer.alive || deer.state === 'dead' || deer.state === 'flee') continue;
    const isFox = deer.state === 'tame';
    const chest = deer.group.position.clone();
    chest.y += (isFox ? 0.85 : 1.35) * deer.group.scale.x;
    const screen = project(chest);
    const distance = Math.hypot(screen.x - pointerPx.x, screen.y - pointerPx.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = isFox ? { fox: deer, world: chest } : { deer, world: chest };
    }
  }
  if (best) return best;

  /* Door and chimney sit close together on a phone screen: nearest one wins. */
  const spots = [
    { door: true, world: new THREE.Vector3(0.3, 1.6, -11.15), radius: 76 },
    { chimney: true, world: new THREE.Vector3(-6.3, 8.6, -14.6), radius: 92 },
    { moon: true, world: moon.position, radius: 120 },
    { snowman: true, world: new THREE.Vector3(-10.5, 2, -3), radius: 88 },
    { witch: true, world: WITCH_WINDOW.clone(), radius: 84 },
    { star: true, world: new THREE.Vector3(9.8, 6.15, -3.5), radius: 92 },
  ];

  let closest = null;
  let closestScore = 1;
  for (const spot of spots) {
    const screen = project(spot.world);
    const score = Math.hypot(screen.x - pointerPx.x, screen.y - pointerPx.y) / spot.radius;
    if (score < closestScore) {
      closestScore = score;
      closest = spot;
    }
  }

  return closest;
}

startButton.addEventListener('click', () => {
  audio.unlock();
  audio.uiClick();
});

/*
 * A tap aimed at the yard can land on the restart button the instant the
 * game-over card appears under the player's thumb. Ignore restarts for a
 * moment, and only ever restart from the menu or the game-over screen.
 */
let restartLockUntil = 0;

startButton.addEventListener('click', () => {
  if (performance.now() < restartLockUntil) return;
  if (state.phase !== 'menu' && state.phase !== 'over') return;
  startGame();
});

container.addEventListener('pointerdown', () => audio.unlock(), { once: true });

function flashHitMarker() {
  crosshair.classList.add('hit');
  window.setTimeout(() => crosshair.classList.remove('hit'), 130);
}

function fire() {
  if (state.phase !== 'wave' && state.phase !== 'break') return;
  if (state.cooldown > 0) return;
  state.cooldown = 0.16;
  audio.shoot();

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(
    [
      ...hitMeshes,
      doorHitbox,
      chimneyHitbox,
      moonHitbox,
      witchWindowHitbox,
      treeStarHitbox,
      ...snowmanHitMeshes,
    ],
    false
  );

  muzzle.getWorldPosition(muzzleWorld);

  let endPoint;
  let struck = false;
  if (hits.length > 0) {
    struck = true;
    const hit = hits[0];
    const deer = hit.object.userData.deer;
    const headshot = hit.object.userData.part === 'head';
    endPoint = hit.point.clone();
    if (hit.object.userData.isChimney) {
      callSanta();
      flashHitMarker();
    } else if (hit.object.userData.isDoor) {
      callPuppy();
      flashHitMarker();
    } else if (hit.object.userData.isMoon) {
      callMotorcycles();
      flashHitMarker();
    } else if (hit.object.userData.isWitchWindow) {
      callWitch();
      flashHitMarker();
    } else if (hit.object.userData.isTreeStar) {
      hitTreeStar(hit.point);
      flashHitMarker();
    } else if (hit.object.userData.isSnowman) {
      hitSnowman(hit.point);
      flashHitMarker();
    } else if (hit.object.userData.foxDeer) {
      popFox(hit.object.userData.foxDeer);
      flashHitMarker();
    } else if (deer && deer.alive) {
      damageDeer(deer, headshot ? 3 : 1);
      flashHitMarker();
    }
    spawnImpact(hit.point, headshot);
  } else if (lastPointerType !== 'mouse') {
    const assist = assistTarget();
    if (assist) {
      struck = true;
      endPoint = assist.world.clone();
      if (assist.fox) {
        popFox(assist.fox);
        flashHitMarker();
        spawnImpact(endPoint, false);
      } else if (assist.deer) {
        damageDeer(assist.deer, 2);
        flashHitMarker();
        spawnImpact(endPoint, false);
      } else if (assist.door) {
        callPuppy();
        flashHitMarker();
        spawnImpact(endPoint, false);
      } else if (assist.chimney) {
        callSanta();
        flashHitMarker();
        spawnImpact(endPoint, true);
      } else if (assist.moon) {
        callMotorcycles();
        flashHitMarker();
        spawnImpact(endPoint, true);
      } else if (assist.snowman) {
        hitSnowman(endPoint);
        flashHitMarker();
      } else if (assist.witch) {
        callWitch();
        flashHitMarker();
        spawnImpact(endPoint, true);
      } else if (assist.star) {
        hitTreeStar(endPoint);
        flashHitMarker();
        spawnImpact(endPoint, true);
      }
    } else {
      endPoint = raycaster.ray.origin
        .clone()
        .add(raycaster.ray.direction.clone().multiplyScalar(70));
    }
  } else {
    endPoint = raycaster.ray.origin
      .clone()
      .add(raycaster.ray.direction.clone().multiplyScalar(70));
  }

  if (!struck) audio.miss();

  spawnTracer(muzzleWorld, endPoint);
}

/* ------------------------------------------------------------------ *
 * Update loops
 * ------------------------------------------------------------------ */

function updateCamera(time) {
  const shake = state.shake * 0.12;
  camera.position.x = CAM_BASE.x + aim.x * 1.6 + Math.sin(time * 42) * shake;
  camera.position.y = CAM_BASE.y + aim.y * 0.7 + Math.cos(time * 37) * shake;
  camera.position.z = CAM_BASE.z + cameraBack;
  camera.lookAt(CAM_TARGET.x + aim.x * 0.8, CAM_TARGET.y + aim.y * 0.4, CAM_TARGET.z);
}

function updateDeer(dt, time) {
  for (let i = deerList.length - 1; i >= 0; i -= 1) {
    const deer = deerList[i];
    const group = deer.group;

    if (deer.flash > 0) {
      deer.flash = Math.max(0, deer.flash - dt * 6);
      deer.furMaterial.emissive.setRGB(deer.flash * 0.6, deer.flash * 0.05, deer.flash * 0.05);
    }

    if (deer.state === 'tame') {
      deer.tameTimer -= dt;
      deer.tamePhase += dt;

      if (!deer.tameTarget || deer.tamePhase > 2.4) {
        deer.tamePhase = 0;
        deer.tameTarget = new THREE.Vector3(
          clamp(group.position.x + rand(-5, 5), -20, 20),
          0,
          clamp(group.position.z + rand(-4, 4), -6, 14)
        );
      }

      const toWander = new THREE.Vector3().subVectors(deer.tameTarget, group.position);
      toWander.y = 0;
      if (toWander.length() > 0.5) {
        toWander.normalize();
        group.position.addScaledVector(toWander, 1.3 * dt);
        const desired = Math.atan2(toWander.x, toWander.z);
        let delta = desired - group.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        group.rotation.y += delta * Math.min(1, dt * 6);
      }

      if (deer.fox) deer.fox.position.y = Math.abs(Math.sin(time * 5.5)) * 0.1;
      if (deer.tameTimer <= 0) revertDeer(deer);
      continue;
    }

    if (deer.state === 'dead') {
      deer.deathTimer += dt;
      const t = deer.deathTimer;
      group.rotation.z = deer.deathRoll * Math.min(Math.PI / 2, t * 5);
      if (t > 0.5) group.position.y = -Math.max(0, t - 0.5) * 0.9;
      if (t > 1.8) {
        scene.remove(group);
        deer.furMaterial.dispose();
        deerList.splice(i, 1);
      }
      continue;
    }

    if (deer.state === 'flee') {
      const toEscape = new THREE.Vector3().subVectors(deer.fleeTarget, group.position);
      toEscape.y = 0;
      if (toEscape.length() < 2 || Math.abs(group.position.x) > 28) {
        escapeDeer(deer);
        deerList.splice(i, 1);
        continue;
      }

      toEscape.normalize();
      group.position.addScaledVector(toEscape, deer.fleeSpeed * dt);
      const desired = Math.atan2(toEscape.x, toEscape.z);
      let delta = desired - group.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      group.rotation.y += delta * Math.min(1, dt * 7);

      deer.phase += dt * 17;
      const fleeSwing = Math.sin(deer.phase) * 0.75;
      deer.legs[0].rotation.x = fleeSwing;
      deer.legs[3].rotation.x = fleeSwing;
      deer.legs[1].rotation.x = -fleeSwing;
      deer.legs[2].rotation.x = -fleeSwing;
      deer.bodyGroup.position.y = 1.15 + Math.abs(Math.sin(deer.phase)) * 0.1;
      deer.bodyGroup.rotation.x = -0.02;
      deer.headGroup.rotation.x = -0.4;
      deer.jawGroup.rotation.x = 0.6;
      continue;
    }

    if (deer.state === 'walk') {
      const toTarget = new THREE.Vector3().subVectors(deer.target, group.position);
      toTarget.y = 0;
      const distance = toTarget.length();

      if (distance < 0.7) {
        deer.state = 'attack';
      } else {
        toTarget.normalize();
        const lurch = 0.72 + 0.28 * Math.abs(Math.sin(time * 2.6 + deer.wobble));
        const speed = deer.speed * lurch;
        group.position.addScaledVector(toTarget, speed * dt);
        const desired = Math.atan2(toTarget.x, toTarget.z);
        let delta = desired - group.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        group.rotation.y += delta * Math.min(1, dt * 6);
      }
    }

    deer.phase += dt * (deer.state === 'attack' ? 8 : deer.speed * 3.6 + 2);
    const swing = Math.sin(deer.phase) * (deer.state === 'attack' ? 0.2 : 0.55);
    deer.legs[0].rotation.x = swing;
    deer.legs[3].rotation.x = swing;
    deer.legs[1].rotation.x = -swing;
    deer.legs[2].rotation.x = -swing;

    deer.bodyGroup.position.y = 1.15 + Math.abs(Math.sin(deer.phase)) * 0.07;
    deer.bodyGroup.rotation.x = 0.08;

    if (deer.state === 'attack') {
      deer.headGroup.rotation.x = -0.15 + Math.sin(deer.phase * 1.6) * 0.55;
      deer.jawGroup.rotation.x = 0.35 + Math.sin(deer.phase * 1.8) * 0.45;
      deer.biteTimer -= dt;
      if (deer.biteTimer <= 0) {
        deer.biteTimer = 1;
        damageHouse(9);
        spawnImpact(
          house.localToWorld(new THREE.Vector3(rand(-2, 2), rand(1, 3), FRONT + 3.4)),
          false
        );
      }
    } else {
      deer.headGroup.rotation.x = -0.12 + Math.sin(time * 2 + deer.wobble) * 0.16;
      deer.jawGroup.rotation.x = 0.22 + Math.sin(time * 3 + deer.wobble) * 0.12;
    }
  }
}

function updateFeedback(dt) {
  state.shake = Math.max(0, state.shake - dt * 2.5);
  vignette.style.opacity = state.shake > 0.01 ? `${state.shake * 0.85}` : '0';
}

function updateGame(dt) {
  if (state.phase === 'over' || state.phase === 'menu') return;
  if (state.cooldown > 0) state.cooldown -= dt;

  if (state.phase === 'break') {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) startWave();
    return;
  }

  if (state.phase === 'wave') {
    if (state.toSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        createDeer({ hp: state.deerHp, speed: state.deerSpeed });
        state.active += 1;
        state.toSpawn -= 1;
        state.spawnTimer = state.spawnInterval * rand(0.75, 1.3);
      }
    } else if (state.active === 0) {
      endWave();
    }
  }
}

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const time = now / 1000;

  if (autoPause.paused) {
    renderer.render(scene, camera);
    return;
  }

  updateCamera(time);
  updateFeedback(dt);
  if (state.phase === 'wave' || state.phase === 'break') updateGame(dt);
  updatePuppy(dt, time);
  updateSanta(dt, time);
  updateMotorcycles(dt, time);
  updateWitch(dt, time);
  updateDad(dt, time);
  updateSnowmanEgg(dt, time);
  updateNightSky(dt, time);
  updateDeer(dt, time);
  updateSnowfall(dt);
  updateEffects(dt);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

/* Touch devices get a hint that matches how they actually play. */
const gameTip = document.querySelector('#game-tip');
if (gameTip && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  gameTip.textContent =
    'Tap a reindeer to throw a snowball. Tap the front door for Bear, the chimney for Santa, or the moon for the little red motorcycles. Hit the tree star three times and Dad comes out with his disc golf bag.';
}

window.addEventListener('resize', sizeScene);
sizeScene();
updateHud();
updateCamera(0);
requestAnimationFrame(animate);
