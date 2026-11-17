import * as THREE from 'three';
import * as RAPIER_NS from '@dimforge/rapier3d-compat';
import { ROSTER, buildRig } from './characters.js';
import { Arena, LAVA_Y, ZONE, PIECE_DEFS, makePieceVisual } from './arena.js';
import { Fighter, DASH } from './fighters.js';

const RAPIER = RAPIER_NS.default ?? RAPIER_NS;
const TAU = Math.PI * 2;
const FIXED = 1 / 60;
const EMPTY_KEYS = new Set();
const TARGET_SCORE = 3;
const BASE_MASS = 30;
const BUILD_HINT =
  'Click a piece to pick it up · wheel lifts it · Q/E turn · W/S tilt · A/D roll · [ ] fold · click the grid to place · Z undo';
const FIGHT_HINT =
  'P1: WASD move · Space jump · Shift cartwheel/tumble — P2: arrows move · RShift jump · / cartwheel';

await RAPIER.init();

// Bulk absorbs part of a hit: at the 30-unit base mass a shove is 1.0, while
// Big Daddy (75) and Big Momma (82) take roughly 60-63% of the knockback.
function knockbackResistance(fighter) {
  const mass = fighter.spec.body.mass || BASE_MASS;
  return Math.max(0.55, Math.min(1.15, Math.sqrt(BASE_MASS / mass)));
}

/* ------------------------------------------------------------------ DOM */
const container = document.querySelector('#game-container');
const ui = {
  p1Name: document.querySelector('#p1-name'),
  p2Name: document.querySelector('#p2-name'),
  p1Score: document.querySelector('#p1-score'),
  p2Score: document.querySelector('#p2-score'),
  phaseLabel: document.querySelector('#phase-label'),
  roundLabel: document.querySelector('#round-label'),
  tray: document.querySelector('#tray'),
  trayBase: document.querySelector('#tray-base'),
  trayCushion: document.querySelector('#tray-cushion'),
  trayTriangle: document.querySelector('#tray-triangle'),
  countBase: document.querySelector('#count-base'),
  countCushion: document.querySelector('#count-cushion'),
  countTriangle: document.querySelector('#count-triangle'),
  trayUndo: document.querySelector('#tray-undo'),
  trayClear: document.querySelector('#tray-clear'),
  startMatch: document.querySelector('#start-match'),
  pose: document.querySelector('#pose-readout'),
  banner: document.querySelector('#banner'),
  bannerLabel: document.querySelector('#banner span'),
  hint: document.querySelector('#hint'),
  overlay: document.querySelector('#overlay'),
  panels: [document.querySelector('#panel-intro'), document.querySelector('#panel-select'), document.querySelector('#panel-match')],
  introStart: document.querySelector('#intro-start'),
  selectStart: document.querySelector('#select-start'),
  choiceP1: document.querySelector('#choice-p1'),
  choiceP2: document.querySelector('#choice-p2'),
  readyP1: document.querySelector('#ready-p1'),
  readyP2: document.querySelector('#ready-p2'),
  matchTitle: document.querySelector('#match-title'),
  matchSub: document.querySelector('#match-sub'),
  btnAgain: document.querySelector('#btn-again'),
  btnChange: document.querySelector('#btn-change'),
  status: document.querySelector('#status'),
  mute: document.querySelector('#mute-button'),
  fullscreen: document.querySelector('#fullscreen-button'),
  gameShell: document.querySelector('.rh-game'),
};

/* -------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.prepend(renderer.domElement);

const gameScene = new THREE.Scene();
gameScene.background = new THREE.Color(0x140a24);
gameScene.fog = new THREE.Fog(0x140a24, 55, 130);

const selectScene = new THREE.Scene();
selectScene.background = new THREE.Color(0x120a2a);

const gameCamera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
const selectCamera = new THREE.PerspectiveCamera(44, 1, 0.1, 220);
const GAME_CAM = new THREE.Vector3(0, 19.5, 22.5);
const cameraBase = GAME_CAM.clone();

const world = new RAPIER.World({ x: 0, y: -32, z: 0 });
world.timestep = FIXED;
try {
  world.integrationParameters.numSolverIterations = 10;
} catch (error) {
  /* older builds use the default solver count */
}

/* ---------------------------------------------------------------- lights */
gameScene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1245, 1.05));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
sun.position.set(-14, 26, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24;
sun.shadow.camera.bottom = -24;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0008;
gameScene.add(sun);
gameScene.add(sun.target);

const lavaGlow = new THREE.PointLight(0xff6a00, 55, 80, 2);
lavaGlow.position.set(0, LAVA_Y - 1.8, 0);
gameScene.add(lavaGlow);

selectScene.add(new THREE.HemisphereLight(0xffe8ff, 0x1a0b2e, 1.15));
const selectSun = new THREE.DirectionalLight(0xfff0d0, 2.3);
selectSun.position.set(8, 22, 20);
selectScene.add(selectSun);

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 34),
  new THREE.MeshBasicMaterial({ color: 0x3b1240 })
);
backdrop.position.set(0, 12, -20);
selectScene.add(backdrop);

const selectFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 70),
  new THREE.MeshStandardMaterial({ color: 0x1c0f33, roughness: 0.9 })
);
selectFloor.rotation.x = -Math.PI / 2;
selectFloor.receiveShadow = true;
selectScene.add(selectFloor);

/* ------------------------------------------------------------------ arena */
const arena = new Arena(gameScene, world);
arena.setGridVisible(false);

/* ---------------------------------------------------------------- roster */
const PODIUM_X = [-9.6, -3.2, 3.2, 9.6];
const selectRoot = new THREE.Group();
selectScene.add(selectRoot);

const selectRigs = ROSTER.map((spec, index) => {
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.4, 1.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b1550, roughness: 0.55, metalness: 0.15 })
  );
  podium.position.set(PODIUM_X[index], 0.8, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  selectRoot.add(podium);

  const built = {
    spec,
    baseY: 1.6 + spec.body.height / 2,
  };
  const character = buildRig(spec);
  character.group.position.set(PODIUM_X[index], built.baseY, 0);
  built.character = character;
  selectRoot.add(character.group);

  const ringP1 = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.11, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xff2e63, transparent: true, opacity: 0.5 })
  );
  ringP1.rotation.x = -Math.PI / 2;
  ringP1.position.set(PODIUM_X[index], 1.63, 0);
  ringP1.visible = false;
  selectRoot.add(ringP1);
  built.ringP1 = ringP1;

  const ringP2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.18, 0.09, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x2ec4ff, transparent: true, opacity: 0.5 })
  );
  ringP2.rotation.x = -Math.PI / 2;
  ringP2.position.set(PODIUM_X[index], 1.63, 0);
  ringP2.visible = false;
  selectRoot.add(ringP2);
  built.ringP2 = ringP2;

  const glow = new THREE.PointLight(0xff7ad9, 18, 14, 2);
  glow.position.set(PODIUM_X[index], 7, 4);
  selectRoot.add(glow);

  const label = labelSprite(spec);
  label.position.set(PODIUM_X[index], 1.6 + spec.body.height + 1.55, 0);
  selectRoot.add(label);
  built.label = label;

  character.group.userData.index = index;
  character.group.traverse((child) => {
    child.userData.index = index;
  });
  return built;
});

function labelSprite(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 208;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 208);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8e7';
  ctx.font = '700 38px "Press Start 2P", "Courier New", monospace';
  ctx.fillText(spec.name, 256, 78);
  ctx.font = '600 26px Inter, Arial, sans-serif';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(spec.tag, 256, 120);
  const bars = [
    ['SPD', spec.stats.speed, '#2ec4ff'],
    ['JMP', spec.stats.jump, '#3ddc84'],
    ['WGT', spec.stats.weight, '#ffd93d'],
  ];
  bars.forEach(([label, value, color], i) => {
    const x = 58 + i * 150;
    ctx.fillStyle = '#3b2568';
    ctx.fillRect(x, 146, 120, 10);
    ctx.fillStyle = color;
    ctx.fillRect(x, 146, 120 * (value / 5), 10);
    ctx.font = '600 18px Inter, Arial, sans-serif';
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText(label, x + 60, 180);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(6.2, 2.5, 1);
  return sprite;
}

/* ------------------------------------------------------------------ state */
const state = {
  phase: 'intro',
  scores: [0, 0],
  round: 1,
  builder: 0,
  picks: [0, 1],
  ready: [false, false],
  time: 0,
  countdown: 0,
  lastCount: 4,
  roundEndAt: 0,
  fallTimer: 0,
  impactCooldown: 0,
  shake: 0,
  fightersDirty: true,
  held: null,
  ghost: null,
  ghostValid: false,
  undo: [],
};

const fighters = [];
const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerWorld = new THREE.Vector3();
const tempBox = new THREE.Box3();
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x4ade80,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  roughness: 0.6,
});

/* ------------------------------------------------------------------ audio */
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
    const { type = 'square', gain = 0.04, delay = 0, slide = null } = options;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
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
    ui: () => tone(420, 0.06, { gain: 0.024 }),
    pick: () => tone(540, 0.07, { type: 'triangle', gain: 0.035 }),
    place: () => {
      tone(170, 0.09, { gain: 0.05 });
      tone(95, 0.12, { gain: 0.04, delay: 0.03 });
    },
    jump: () => tone(320, 0.1, { type: 'triangle', gain: 0.028, slide: 640 }),
    hit: () => {
      tone(185, 0.1, { type: 'sawtooth', gain: 0.06, slide: 70 });
      tone(430, 0.08, { type: 'square', gain: 0.03, delay: 0.02 });
    },
    splash: () => {
      tone(140, 0.32, { type: 'sawtooth', gain: 0.05, slide: 50 });
      tone(92, 0.36, { gain: 0.04, delay: 0.05 });
    },
    point: () => {
      [523, 659, 784].forEach((freq, i) =>
        tone(freq, 0.18, { type: 'triangle', gain: 0.04, delay: i * 0.09 })
      );
    },
    win: () => {
      [523, 659, 784, 1046].forEach((freq, i) =>
        tone(freq, 0.26, { type: 'triangle', gain: 0.045, delay: i * 0.12 })
      );
    },
  };
})();

try {
  if (window.localStorage.getItem('roughHousingMuted') === '1') audio.setMuted(true);
} catch (error) {
  /* storage can be blocked */
}

function refreshMute() {
  const muted = audio.isMuted();
  ui.mute.textContent = muted ? '🔇' : '🔊';
  ui.mute.setAttribute('aria-pressed', String(muted));
  ui.mute.setAttribute('aria-label', muted ? 'Unmute sound effects' : 'Mute sound effects');
}
refreshMute();

ui.mute.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  refreshMute();
  try {
    window.localStorage.setItem('roughHousingMuted', audio.isMuted() ? '1' : '0');
  } catch (error) {
    /* ignore */
  }
  audio.ui();
});

/* -------------------------------------------------------------- fullscreen */
const canFullscreen = Boolean(
  ui.fullscreen && ui.gameShell && document.fullscreenEnabled && ui.gameShell.requestFullscreen
);
const refreshFullscreen = () => {
  const active = Boolean(document.fullscreenElement);
  ui.fullscreen.textContent = active ? '⤡' : '⛶';
  ui.fullscreen.setAttribute('aria-pressed', String(active));
  ui.fullscreen.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
};

if (!canFullscreen) {
  ui.fullscreen.hidden = true;
} else {
  refreshFullscreen();
  ui.fullscreen.addEventListener('click', async () => {
    audio.unlock();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ui.gameShell.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      /* full screen can be refused */
    }
    refreshFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    refreshFullscreen();
    sizeScene();
  });
}

/* ------------------------------------------------------------------- UI */
function banner(text, hold = 1.4) {
  ui.bannerLabel.textContent = text;
  ui.banner.classList.add('show');
  state.bannerUntil = state.time + hold;
}

function status(text) {
  ui.status.textContent = text;
}

function showPanel(id) {
  ui.overlay.hidden = false;
  for (const panel of ui.panels) panel.hidden = panel.id !== id;
  ui.overlay.classList.toggle('select', id === 'panel-select');
}

function hideOverlay() {
  ui.overlay.hidden = true;
}

function updateHud() {
  ui.p1Name.textContent = ROSTER[state.picks[0]].name;
  ui.p2Name.textContent = ROSTER[state.picks[1]].name;
  ui.p1Score.textContent = state.scores[0];
  ui.p2Score.textContent = state.scores[1];
  ui.roundLabel.textContent = `Round ${state.round}`;
}

function updateTray() {
  const counts = arena.counts();
  const types = ['base', 'cushion', 'triangle'];
  types.forEach((type) => {
    const left = PIECE_DEFS[type].total - counts[type];
    const countEl = ui[`count${type[0].toUpperCase()}${type.slice(1)}`];
    const button = ui[`tray${type[0].toUpperCase()}${type.slice(1)}`];
    if (countEl) countEl.textContent = String(left);
    if (button) button.disabled = left <= 0 || state.phase !== 'build';
  });
  ui.startMatch.disabled = state.phase !== 'build';
}

function updateSelectUI() {
  ui.choiceP1.textContent = ROSTER[state.picks[0]].name;
  ui.choiceP2.textContent = ROSTER[state.picks[1]].name;
  ui.readyP1.textContent = state.ready[0] ? 'READY' : 'choosing…';
  ui.readyP2.textContent = state.ready[1] ? 'READY' : 'choosing…';
  ui.readyP1.classList.toggle('ready', state.ready[0]);
  ui.readyP2.classList.toggle('ready', state.ready[1]);
  ui.selectStart.disabled = !(state.ready[0] && state.ready[1]);
  updateHud();
  updateSelectRings();
}

function updateSelectRings() {
  selectRigs.forEach((entry, index) => {
    entry.ringP1.visible = state.picks[0] === index;
    entry.ringP2.visible = state.picks[1] === index;
    entry.ringP1.material.opacity = state.ready[0] ? 1 : 0.45;
    entry.ringP2.material.opacity = state.ready[1] ? 1 : 0.45;
  });
}

/* --------------------------------------------------------------- gameplay */
function ensureFighters(force) {
  if (!force && fighters.length === 2) return;
  for (const fighter of fighters) fighter.dispose();
  fighters.length = 0;
  const controls = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space', dash: 'ShiftLeft' },
    {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp',
      down: 'ArrowDown',
      jump: 'ShiftRight',
      dash: 'Slash',
    },
  ];
  for (let i = 0; i < 2; i += 1) {
    fighters.push(
      new Fighter({
        spec: ROSTER[state.picks[i]],
        world,
        scene: gameScene,
        controls: controls[i],
        index: i,
      })
    );
  }
  updateHud();
}

function enterIntro() {
  state.phase = 'intro';
  showPanel('panel-intro');
  ui.tray.hidden = true;
  ui.pose.hidden = true;
  cancelHeld();
  updateHud();
  status('Rough Housing. Choose wrestlers to start.');
}

function enterSelect() {
  state.phase = 'select';
  state.ready = [false, false];
  showPanel('panel-select');
  ui.tray.hidden = true;
  ui.pose.hidden = true;
  cancelHeld();
  updateSelectUI();
  status('Choose wrestlers. Player 1 uses A and D then Space. Player 2 uses arrows then right shift.');
  audio.ui();
}

function beginMatch() {
  state.scores = [0, 0];
  state.round = 1;
  state.builder = 0;
  arena.clear();
  state.undo = [];
  ensureFighters(true);
  state.fightersDirty = false;
  enterBuild();
}

function enterBuild() {
  state.phase = 'build';
  hideOverlay();
  ui.tray.hidden = false;
  ui.pose.hidden = true;
  ui.phaseLabel.textContent = `Player ${state.builder + 1} builds`;
  ui.roundLabel.textContent = `Round ${state.round}`;
  ui.hint.textContent = BUILD_HINT;
  arena.setGridVisible(true);
  for (const fighter of fighters) fighter.hide();
  cancelHeld();
  updateTray();
  updateHud();
  banner(`PLAYER ${state.builder + 1} BUILDS`, 1.6);
  status(`Round ${state.round}. Player ${state.builder + 1} is building the arena.`);
}

function launchCountdown(spots) {
  ensureFighters(false);
  fighters.forEach((fighter, index) => fighter.respawn(spots[index]));
  state.phase = 'countdown';
  state.countdown = 3.5;
  state.lastCount = 4;
  state.impactCooldown = 0;
  state.fallTimer = 0;
  state.shake = 0;
  hideOverlay();
  ui.tray.hidden = true;
  ui.pose.hidden = true;
  ui.phaseLabel.textContent = 'Get ready';
  ui.roundLabel.textContent = `Round ${state.round}`;
  ui.hint.textContent = FIGHT_HINT;
  arena.setGridVisible(false);
  arena.updateSpawnMarkers(false);
  cancelHeld();
  updateHud();
  banner('GET READY', 0.6);
  status('Get ready to wrestle.');
  audio.ui();
}

function startCountdown() {
  if (state.phase !== 'build') return;
  if (arena.pieces.length < 2) {
    banner('Build something first!', 1.6);
    return;
  }
  const spots = arena.spawnPoints();
  if (!spots) {
    banner('Build something first!', 1.6);
    return;
  }
  launchCountdown(spots);
}

function endRound(winner) {
  if (state.phase === 'roundover') return;
  state.phase = 'roundover';
  state.roundEndAt = 2.4;
  if (winner >= 0) {
    state.scores[winner] += 1;
    banner(`${ROSTER[state.picks[winner]].name.toUpperCase()} SCORES!`, 2.1);
    audio.point();
    status(`Point for ${ROSTER[state.picks[winner]].name}.`);
  } else {
    banner('DOUBLE SPLASH!', 2.1);
    audio.splash();
    status('Both wrestlers fell. No point.');
  }
  updateHud();
}

function advanceRound() {
  if (Math.max(state.scores[0], state.scores[1]) >= TARGET_SCORE) {
    showMatchOver();
    return;
  }
  state.builder = 1 - state.builder;
  state.round += 1;
  enterBuild();
}

function showMatchOver() {
  state.phase = 'matchover';
  ui.phaseLabel.textContent = 'Match over';
  const winner = state.scores[0] >= state.scores[1] ? 0 : 1;
  ui.matchTitle.textContent = `${ROSTER[state.picks[winner]].name} wins!`;
  ui.matchSub.textContent = `${state.scores[0]} – ${state.scores[1]} after ${state.round} round${state.round === 1 ? '' : 's'}`;
  showPanel('panel-match');
  ui.tray.hidden = true;
  audio.win();
  status(`${ROSTER[state.picks[winner]].name} wins the match.`);
}

function playAgain() {
  // Run it back on the fort that is already standing. Only rebuild when the
  // fight wrecked enough of it that there is nowhere to spawn.
  arena.sync();
  const spots = arena.pieces.length >= 2 ? arena.spawnPoints() : null;
  state.scores = [0, 0];
  state.round = 1;
  state.builder = 0;
  state.undo = [];
  if (!spots) {
    arena.clear();
    enterBuild();
    banner('Fresh fort', 1.2);
    return;
  }
  launchCountdown(spots);
  banner('RUN IT BACK', 0.9);
  status('Rematch on the same fort. Get ready.');
}

function changeWrestlers() {
  arena.clear();
  state.undo = [];
  state.scores = [0, 0];
  state.round = 1;
  state.builder = 0;
  enterSelect();
}

function handleFalls(dt) {
  if (state.phase === 'fight') {
    if (fighters.some((fighter) => fighter.out)) {
      state.phase = 'falling';
      state.fallTimer = 0.6;
      audio.splash();
    }
    return;
  }
  if (state.phase !== 'falling') return;
  state.fallTimer -= dt;
  if (state.fallTimer > 0) return;
  const out = fighters.filter((fighter) => fighter.out);
  if (out.length === 0) {
    state.phase = 'fight';
    return;
  }
  if (out.length === 2) endRound(-1);
  else endRound(out[0] === fighters[0] ? 1 : 0);
}

function handleImpacts(dt) {
  state.impactCooldown = Math.max(0, state.impactCooldown - dt);
  const [a, b] = fighters;
  if (a && b && !a.out && !b.out) {
    const pa = a.body.translation();
    const pb = b.body.translation();
    const va = a.body.linvel();
    const vb = b.body.linvel();
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const dist = Math.hypot(dx, dz);
    const reach = a.spec.body.radius + b.spec.body.radius + 0.35;
    const relative = Math.hypot(va.x - vb.x, va.z - vb.z);
    const dashA = a.dash.state === 'active';
    const dashB = b.dash.state === 'active';
    if (
      dist < reach &&
      Math.abs(pb.y - pa.y) < 2.2 &&
      (relative > 4 || dashA || dashB) &&
      state.impactCooldown <= 0
    ) {
      state.impactCooldown = 0.5;
      const nx = dist > 0.001 ? dx / dist : 0;
      const nz = dist > 0.001 ? dz / dist : 1;
      const momA = a.spec.body.mass * Math.hypot(va.x, va.z);
      const momB = b.spec.body.mass * Math.hypot(vb.x, vb.z);

      // Work out who is delivering the hit. A live cartwheel/body-check always
      // wins; otherwise the heavier, faster wrestler does.
      let hitA = 0;
      let hitB = 0;
      if (dashA && !dashB) hitB = 1;
      else if (dashB && !dashA) hitA = 1;
      else if (momA > momB * 1.12) hitB = 1;
      else if (momB > momA * 1.12) hitA = 1;
      else {
        hitA = 0.6;
        hitB = 0.6;
      }

      const launched = dashA || dashB;
      const power = launched ? 10.5 : 6.2;
      const shove = (target, sx, sz, weight) => {
        const tv = target.body.linvel();
        const tank = knockbackResistance(target);
        target.body.setLinvel(
          {
            x: tv.x + sx * power * weight * tank,
            y: Math.max(tv.y, 0) + (launched ? 4.4 : 2.4) * weight * tank,
            z: tv.z + sz * power * weight * tank,
          },
          true
        );
        target.flop(launched ? 1.05 : 0.7, sx, sz);
      };

      if (hitB > 0) shove(b, nx, nz, hitB);
      if (hitA > 0) shove(a, -nx, -nz, hitA);

      // Contact ends the dash instead of letting the attacker plough through.
      if (dashA && hitB > 0) {
        a.dash.state = 'recover';
        a.dash.timer = DASH.recover;
      }
      if (dashB && hitA > 0) {
        b.dash.state = 'recover';
        b.dash.timer = DASH.recover;
      }

      // The striker keeps a little recoil so the exchange reads as a hit.
      if (hitB > 0) {
        const av = a.body.linvel();
        a.body.setLinvel({ x: av.x * 0.55, y: av.y, z: av.z * 0.55 }, true);
      }
      if (hitA > 0) {
        const bv = b.body.linvel();
        b.body.setLinvel({ x: bv.x * 0.55, y: bv.y, z: bv.z * 0.55 }, true);
      }

      audio.hit();
      state.shake = Math.min(0.9, state.shake + 0.2 + relative * 0.015);
    }
  }

  for (const piece of arena.pieces) {
    const lv = piece.body.linvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);
    if (speed < 7) continue;
    const pp = piece.body.translation();
    for (const fighter of fighters) {
      if (fighter.out || fighter.flopTimer > 0) continue;
      const fp = fighter.body.translation();
      const dx = pp.x - fp.x;
      const dz = pp.z - fp.z;
      if (
        Math.hypot(dx, dz) < 2.9 &&
        Math.abs(pp.y - fp.y) < fighter.spec.body.height * 0.65
      ) {
        const fv = fighter.body.linvel();
        const tank = knockbackResistance(fighter);
        fighter.body.setLinvel(
          {
            x: fv.x + lv.x * 0.55 * tank,
            y: fv.y + 2.4 * tank,
            z: fv.z + lv.z * 0.55 * tank,
          },
          true
        );
        fighter.flop(0.85, lv.x || 0, lv.z || 0);
        audio.hit();
        state.shake = Math.min(0.9, state.shake + 0.2);
      }
    }
  }
}

/* ------------------------------------------------------------------ build */
function pointerToArena() {
  raycaster.setFromCamera(pointer, gameCamera);
  const hit = raycaster.ray.intersectPlane(groundPlane, pointerWorld);
  return hit ? pointerWorld : null;
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function rebuildGhost() {
  if (state.ghost) {
    gameScene.remove(state.ghost);
    state.ghost = null;
  }
  if (!state.held) return;
  const ghost = makePieceVisual(state.held.type, state.held.fold, ghostMat);
  ghost.rotation.order = 'YXZ';
  ghost.traverse((child) => {
    if (child.isMesh) child.renderOrder = 2;
  });
  gameScene.add(ghost);
  state.ghost = ghost;
}

function beginHolding(type) {
  if (state.phase !== 'build') return;
  const counts = arena.counts();
  const left = PIECE_DEFS[type].total - counts[type];
  if (left <= 0) {
    banner(`No ${PIECE_DEFS[type].label.toLowerCase()} pieces left`, 1.2);
    return;
  }
  state.held = {
    type,
    fold: PIECE_DEFS[type].defaultFold || 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    lift: 0.15,
    x: 0,
    z: 0,
    pose: null,
  };
  state.ghostValid = false;
  rebuildGhost();
  ui.pose.hidden = false;
  audio.pick();
}

function cancelHeld() {
  state.held = null;
  state.ghostValid = false;
  if (state.ghost) {
    gameScene.remove(state.ghost);
    state.ghost = null;
  }
  if (ui.pose) ui.pose.hidden = true;
}

function updateGhost() {
  const held = state.held;
  const ghost = state.ghost;
  if (!held || !ghost) return;

  const hit = pointerToArena();
  if (hit) {
    held.x = Math.max(-ZONE.halfX + 1, Math.min(ZONE.halfX - 1, hit.x));
    held.z = Math.max(-ZONE.halfZ + 1, Math.min(ZONE.halfZ - 1, hit.z));
  }

  ghost.rotation.order = 'YXZ';
  ghost.rotation.set(held.pitch, held.yaw, held.roll);
  ghost.position.set(held.x, 0, held.z);
  ghost.updateMatrixWorld(true);
  const box = tempBox.setFromObject(ghost);
  const support = arena.supportY(box);
  ghost.position.y = support + held.lift - box.min.y;
  ghost.updateMatrixWorld(true);
  box.setFromObject(ghost);

  const inside =
    box.min.x >= -ZONE.halfX - 0.02 &&
    box.max.x <= ZONE.halfX + 0.02 &&
    box.min.z >= -ZONE.halfZ - 0.02 &&
    box.max.z <= ZONE.halfZ + 0.02;
  state.ghostValid = inside && !arena.overlaps(box);
  ghostMat.color.set(state.ghostValid ? 0x4ade80 : 0xff4d5e);

  held.pose = {
    x: ghost.position.x,
    y: ghost.position.y,
    z: ghost.position.z,
    yaw: held.yaw,
    pitch: held.pitch,
    roll: held.roll,
    fold: held.fold,
  };

  const degrees = (radians) => Math.round((radians * 180) / Math.PI);
  ui.pose.textContent = `FOLD ${degrees(held.fold)}° · YAW ${((degrees(held.yaw) % 360) + 360) % 360}° · TILT ${degrees(held.pitch)}° · LIFT ${held.lift.toFixed(1)}`;
}

function placeHeld() {
  if (!state.held) return;
  if (!state.held.pose) updateGhost();
  if (!state.held || !state.held.pose) return;
  if (!state.ghostValid) {
    banner('Not there — it would overlap', 1.1);
    return;
  }
  const piece = arena.place(state.held.type, state.held.pose);
  state.undo.push(piece);
  audio.place();
  state.shake = Math.min(0.5, state.shake + 0.08);
  updateTray();
  const left = PIECE_DEFS[state.held.type].total - arena.counts()[state.held.type];
  if (left <= 0) cancelHeld();
}

function undoLast() {
  const piece = state.undo.pop();
  if (piece && arena.pieces.includes(piece)) {
    arena.remove(piece);
    audio.ui();
    updateTray();
  }
}

function clearArena() {
  arena.clear();
  state.undo = [];
  cancelHeld();
  updateTray();
  banner('Arena cleared', 1);
}

function pickUpAt() {
  raycaster.setFromCamera(pointer, gameCamera);
  const hits = raycaster.intersectObjects(arena.root.children, true);
  if (!hits.length) return;
  let object = hits[0].object;
  while (object && !object.userData.piece) object = object.parent;
  const piece = object?.userData.piece;
  if (!piece || !arena.pieces.includes(piece)) return;
  const translation = piece.body.translation();
  const rotation = piece.body.rotation();
  const euler = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    'YXZ'
  );
  state.held = {
    type: piece.type,
    fold: piece.pose.fold || 0,
    yaw: euler.y,
    pitch: euler.x,
    roll: euler.z,
    lift: 0.4,
    x: translation.x,
    z: translation.z,
    pose: null,
  };
  arena.remove(piece);
  state.undo = state.undo.filter((entry) => entry !== piece);
  rebuildGhost();
  ui.pose.hidden = false;
  updateTray();
  audio.pick();
}

/* --------------------------------------------------------------- selection */
function movePick(player, delta) {
  if (state.ready[player]) return;
  state.picks[player] = (state.picks[player] + delta + ROSTER.length) % ROSTER.length;
  state.fightersDirty = true;
  updateSelectUI();
  audio.ui();
}

function toggleReady(player) {
  state.ready[player] = !state.ready[player];
  updateSelectUI();
  audio.ui();
}

function pickSelectAt() {
  raycaster.setFromCamera(pointer, selectCamera);
  const hits = raycaster.intersectObjects(selectRoot.children, true);
  if (!hits.length) return;
  let object = hits[0].object;
  let index = -1;
  while (object) {
    if (typeof object.userData.index === 'number') {
      index = object.userData.index;
      break;
    }
    object = object.parent;
  }
  if (index < 0) return;
  const target = state.ready[0] ? 1 : 0;
  state.picks[target] = index;
  state.ready[target] = false;
  state.fightersDirty = true;
  updateSelectUI();
  audio.ui();
}

/* ----------------------------------------------------------------- events */
function handleKey(code) {
  if (state.phase === 'intro') {
    if (code === 'Enter' || code === 'Space') enterSelect();
    return;
  }
  if (state.phase === 'select') {
    if (code === 'KeyA') movePick(0, -1);
    else if (code === 'KeyD') movePick(0, 1);
    else if (code === 'Space') toggleReady(0);
    else if (code === 'ArrowLeft') movePick(1, -1);
    else if (code === 'ArrowRight') movePick(1, 1);
    else if (code === 'ShiftRight' || code === 'Numpad0') toggleReady(1);
    else if (code === 'Enter' && state.ready[0] && state.ready[1]) beginMatch();
    return;
  }
  if (state.phase === 'matchover') {
    if (code === 'Enter') playAgain();
    return;
  }
  if (state.phase !== 'build') return;

  if (code === 'Digit1') beginHolding('base');
  else if (code === 'Digit2') beginHolding('cushion');
  else if (code === 'Digit3') beginHolding('triangle');
  else if (code === 'KeyZ') undoLast();
  else if (code === 'Enter') startCountdown();
  else if (code === 'Escape' || code === 'Backspace') cancelHeld();

  if (!state.held) return;
  const step = Math.PI / 12;
  if (code === 'KeyQ') state.held.yaw += step;
  else if (code === 'KeyE') state.held.yaw -= step;
  else if (code === 'KeyW') state.held.pitch -= step;
  else if (code === 'KeyS') state.held.pitch += step;
  else if (code === 'KeyA') state.held.roll -= step;
  else if (code === 'KeyD') state.held.roll += step;
  else if (code === 'BracketLeft') {
    state.held.fold = Math.max(0, state.held.fold - step);
    rebuildGhost();
  } else if (code === 'BracketRight') {
    state.held.fold = Math.min(Math.PI * 0.85, state.held.fold + step);
    rebuildGhost();
  } else if (code === 'KeyX') {
    state.held.fold = PIECE_DEFS[state.held.type].defaultFold || 0;
    state.held.yaw = 0;
    state.held.pitch = 0;
    state.held.roll = 0;
    state.held.lift = 0.15;
    rebuildGhost();
  }
}

const PREVENT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Slash',
  'ShiftRight',
  'Backspace',
]);

window.addEventListener('keydown', (event) => {
  if (PREVENT.has(event.code)) event.preventDefault();
  audio.unlock();
  keys.add(event.code);
  if (event.repeat) return;
  handleKey(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

renderer.domElement.addEventListener('pointermove', (event) => {
  updatePointer(event);
  if (state.phase === 'build' && state.held) updateGhost();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  audio.unlock();
  updatePointer(event);
  if (state.phase === 'intro') {
    enterSelect();
    return;
  }
  if (state.phase === 'select') {
    pickSelectAt();
    return;
  }
  if (state.phase !== 'build' || event.button !== 0) return;
  if (state.held) placeHeld();
  else pickUpAt();
});

renderer.domElement.addEventListener(
  'wheel',
  (event) => {
    if (state.phase !== 'build' || !state.held) return;
    event.preventDefault();
    const next = state.held.lift + (event.deltaY > 0 ? -0.3 : 0.3);
    state.held.lift = Math.max(0.05, Math.min(9, next));
  },
  { passive: false }
);

ui.trayBase.addEventListener('click', () => beginHolding('base'));
ui.trayCushion.addEventListener('click', () => beginHolding('cushion'));
ui.trayTriangle.addEventListener('click', () => beginHolding('triangle'));
ui.trayUndo.addEventListener('click', undoLast);
ui.trayClear.addEventListener('click', clearArena);
ui.startMatch.addEventListener('click', startCountdown);
ui.introStart.addEventListener('click', () => {
  audio.unlock();
  enterSelect();
});
ui.selectStart.addEventListener('click', () => {
  if (state.ready[0] && state.ready[1]) beginMatch();
});
ui.btnAgain.addEventListener('click', () => {
  audio.unlock();
  playAgain();
});
ui.btnChange.addEventListener('click', () => {
  audio.unlock();
  changeWrestlers();
});

/* -------------------------------------------------------------- animation */
function animateSelect(dt) {
  const t = state.time;
  selectRigs.forEach((entry, index) => {
    entry.character.group.position.y = entry.baseY + Math.sin(t * 1.7 + index) * 0.09;
    entry.character.group.rotation.y = Math.sin(t * 0.5 + index * 0.8) * 0.45;
    entry.ringP1.scale.setScalar(1 + Math.sin(t * 4 + index) * 0.03);
    entry.ringP2.scale.setScalar(1 + Math.sin(t * 4.2 + index) * 0.03);
  });
}

let lastTime = performance.now();
let accumulator = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.045, (now - lastTime) / 1000);
  lastTime = now;
  state.time += dt;

  if (state.bannerUntil && state.time > state.bannerUntil) {
    ui.banner.classList.remove('show');
    state.bannerUntil = 0;
  }

  if (state.phase === 'intro' || state.phase === 'select') {
    animateSelect(dt);
    renderer.render(selectScene, selectCamera);
    return;
  }

  accumulator = Math.min(accumulator + dt, 0.2);
  let steps = 0;
  while (accumulator >= FIXED && steps < 3) {
    world.step();
    accumulator -= FIXED;
    steps += 1;
  }

  arena.sync();
  arena.updateSpawnMarkers(state.phase === 'build');
  arena.lavaTexture.offset.x = (arena.lavaTexture.offset.x + dt * 0.01) % 1;
  arena.lavaTexture.offset.y = (arena.lavaTexture.offset.y + dt * 0.005) % 1;

  if (state.phase === 'build') {
    updateGhost();
    const pruned = arena.pruneFallen();
    if (pruned) {
      audio.splash();
      updateTray();
    }
  } else if (state.phase === 'countdown') {
    state.countdown -= dt;
    const count = Math.ceil(state.countdown);
    if (count !== state.lastCount && count > 0) {
      state.lastCount = count;
      banner(String(count), 0.6);
    }
    for (const fighter of fighters) fighter.update(dt, EMPTY_KEYS, state.time);
    if (state.countdown <= 0) {
      state.phase = 'fight';
      ui.phaseLabel.textContent = 'Wrestle!';
      banner('WRESTLE!', 0.8);
      audio.point();
      status('Wrestle!');
    }
  } else if (state.phase === 'fight' || state.phase === 'falling') {
    for (const fighter of fighters) fighter.update(dt, keys, state.time);
    handleImpacts(dt);
    const pruned = arena.pruneFallen();
    if (pruned) audio.splash();
    handleFalls(dt);
  } else if (state.phase === 'roundover') {
    for (const fighter of fighters) fighter.update(dt, EMPTY_KEYS, state.time);
    state.roundEndAt -= dt;
    if (state.roundEndAt <= 0) advanceRound();
  }

  state.shake = Math.max(0, state.shake - dt * 2.2);
  gameCamera.position.copy(cameraBase);
  if (state.shake > 0.02) {
    gameCamera.position.x += (Math.random() - 0.5) * state.shake;
    gameCamera.position.y += (Math.random() - 0.5) * state.shake;
    gameCamera.position.z += (Math.random() - 0.5) * state.shake * 0.5;
  }
  gameCamera.lookAt(0, 1.2, 0);

  renderer.render(gameScene, gameCamera);
}

/* --------------------------------------------------------------- geometry */
function sizeScene() {
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 520;
  const aspect = width / height;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  gameCamera.aspect = aspect;
  gameCamera.updateProjectionMatrix();
  const fit = Math.max(1, 1.45 / Math.min(2.4, aspect));
  cameraBase.copy(GAME_CAM).multiplyScalar(fit);
  gameCamera.position.copy(cameraBase);
  gameCamera.lookAt(0, 1.2, 0);

  selectCamera.aspect = aspect;
  const selectFit = Math.max(1, 1.4 / Math.min(2.2, aspect));
  selectCamera.position.set(0, 9 * selectFit, 27 * selectFit);
  selectCamera.lookAt(0, 4.6, 0);
  selectCamera.updateProjectionMatrix();
}

window.addEventListener('resize', sizeScene);
sizeScene();

/* ------------------------------------------------------------------- boot */
enterIntro();
requestAnimationFrame(tick);
