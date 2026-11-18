import * as THREE from 'three';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createWorld } from './house.js';
import { FRIENDS, createFriend } from './friends.js';

/* ------------------------------------------------------------------ *
 * Spot Your Friends — first-person hide-and-seek scavenger hunt.
 * Ten friends hide around a house and front yard; tag them all.
 * ------------------------------------------------------------------ */

const GAME_ID = 'spot-your-friends';
const TOTAL = FRIENDS.length;
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 3.5;
const SPRINT_SPEED = 5.4;
const REACH = 2.2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ------------------------------------------------------------------ DOM */

const container = document.querySelector('#game-container');
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('has-touch');

const els = {
  foundValue: document.querySelector('#found-value'),
  timeValue: document.querySelector('#time-value'),
  friendTotal: document.querySelector('#friend-total'),
  friendList: document.querySelector('#friend-list'),
  toast: document.querySelector('#toast'),
  lookHint: document.querySelector('#look-hint'),
  interact: document.querySelector('#interact'),
  interactName: document.querySelector('#interact-name'),
  tagButton: document.querySelector('#tag-button'),
  joystick: document.querySelector('#joystick'),
  joystickKnob: document.querySelector('#joystick-knob'),
  startOverlay: document.querySelector('#start-overlay'),
  finishOverlay: document.querySelector('#finish-overlay'),
  startButton: document.querySelector('#start-button'),
  againButton: document.querySelector('#again-button'),
  startBest: document.querySelector('#start-best'),
  hintButton: document.querySelector('#hint-button'),
  restartButton: document.querySelector('#restart-button'),
  muteButton: document.querySelector('#mute-button'),
  fullscreenButton: document.querySelector('#fullscreen-button'),
  resultKicker: document.querySelector('#result-kicker'),
  resultTime: document.querySelector('#result-time'),
  resultHints: document.querySelector('#result-hints'),
  resultScore: document.querySelector('#result-score'),
  resultBest: document.querySelector('#result-best'),
  resultBestNote: document.querySelector('#result-best-note'),
  fallback: document.querySelector('#fallback'),
  status: document.querySelector('#status'),
};

const rows = new Map();
FRIENDS.forEach((friend) => {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'friend-row';

  const dot = document.createElement('span');
  dot.className = 'friend-dot';
  dot.style.background = `#${friend.look.shirt.toString(16).padStart(6, '0')}`;

  const name = document.createElement('span');
  name.className = 'friend-name';
  name.textContent = friend.name;

  const state = document.createElement('span');
  state.className = 'friend-state';
  state.textContent = 'Hiding';

  row.append(dot, name, state);
  row.addEventListener('click', () => doHint(friend));
  els.friendList.append(row);
  rows.set(friend.id, { root: row, state });
});
els.friendTotal.textContent = `0/${TOTAL}`;
els.startBest.textContent = getBest(GAME_ID).toLocaleString('en-US');

/* ---------------------------------------------------------------- sound */

const audio = (() => {
  let ctx = null;
  let muted = readMuted('spotYourFriendsMuted');

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
    const { type = 'triangle', gain = 0.05, delay = 0, slide = null, attack = 0.006 } = options;
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  };

  return {
    unlock: () => ensure(),
    isMuted: () => muted,
    setMuted: (value) => {
      muted = value;
    },
    tag: () => {
      tone(660, 0.09);
      tone(990, 0.14, { delay: 0.07 });
    },
    hint: () => {
      tone(520, 0.12, { type: 'sine' });
      tone(392, 0.16, { type: 'sine', delay: 0.1, slide: 320 });
    },
    deny: () => tone(170, 0.1, { type: 'square', gain: 0.03 }),
    win: () => {
      [523, 659, 784, 1046].forEach((freq, index) =>
        tone(freq, 0.24, { delay: index * 0.11, gain: 0.05 })
      );
    },
  };
})();

/* ---------------------------------------------------------------- state */

let scene = null;
let camera = null;
let renderer = null;
let world = null;
let hintBeacon = null;
let sparkTexture = null;
let friends = [];
let promptId = null;
let toastTimer = 0;
let clock = 0;
let lastFrame = 0;
let lookIgnoreUntil = 0;

const bursts = [];
const keys = new Set();
const touchMove = { x: 0, y: 0 };
const joystick = { pointerId: null, active: false };
const player = { x: 0, z: 15.4, yaw: 0, pitch: -0.1, walkPhase: 0, walking: false };

const state = {
  playing: false,
  finished: false,
  elapsed: 0,
  hintPenalty: 0,
  hints: 0,
  found: 0,
  finishAt: Number.POSITIVE_INFINITY,
  hintReadyAt: 0,
  beamUntil: 0,
  lastHud: -1,
};

const CHEERS = ['Tagged {name}!', 'Found {name}!', 'Gotcha, {name}!', 'Nice spot — {name}!'];

const canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  renderer = null;
}

/* --------------------------------------------------------------- setup */

function init() {
  container.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ed8f4);
  scene.fog = new THREE.Fog(0x9ed8f4, 36, 70);

  camera = new THREE.PerspectiveCamera(72, 1, 0.05, 95);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x7a6850, 1.1));

  const sun = new THREE.DirectionalLight(0xfff0cf, 1.7);
  sun.position.set(-16, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 0, 4);
  scene.add(sun);
  scene.add(sun.target);

  /* warm ceiling lamps so the enclosed rooms still feel cosy */
  [
    [0, 2.45, 4.5],
    [0, 2.45, -4],
    [-7, 2.45, 5],
    [7, 2.45, 5],
    [7, 2.45, -6.5],
  ].forEach(([x, y, z]) => {
    const lamp = new THREE.PointLight(0xffe2b0, 3.5, 8, 2);
    lamp.position.set(x, y, z);
    scene.add(lamp);
  });

  world = createWorld(scene);
  sparkTexture = makeSparkTexture();
  spawnFriends();
  createBeacon();

  applyCamera(0);
  bindEvents();
  resize();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(container);
  }
  updateHud(true);
  updatePrompt(true);
  startLoop();
}

function makeSparkTexture() {
  const size = 64;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 245, 190, 0.85)');
  gradient.addColorStop(1, 'rgba(255, 230, 120, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSparkles(group) {
  const sprites = [];
  for (let i = 0; i < 3; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: sparkTexture,
      color: 0xfff2b0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(0.18);
    sprite.visible = false;
    group.add(sprite);
    sprites.push(sprite);
  }
  return sprites;
}

function spawnFriends() {
  friends = FRIENDS.map((definition) => {
    const group = createFriend(definition.look);
    group.position.set(definition.x, definition.y, definition.z);
    group.rotation.y = definition.rotY;
    const baseScale = definition.scale ?? 1;
    group.scale.setScalar(baseScale);
    scene.add(group);
    return {
      ...definition,
      group,
      baseScale,
      baseY: definition.y,
      sparkles: makeSparkles(group),
      found: false,
      anim: -1,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

function createBeacon() {
  hintBeacon = new THREE.Group();
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 7, 20, 1, true), beamMaterial);
  beam.position.y = 3.5;
  hintBeacon.add(beam);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd93d,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 30), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  hintBeacon.add(ring);

  hintBeacon.userData.beamMaterial = beamMaterial;
  hintBeacon.userData.ringMaterial = ringMaterial;
  hintBeacon.visible = false;
  scene.add(hintBeacon);
}

/* ---------------------------------------------------------- HUD helpers */

function toast(message, seconds = 3) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), seconds * 1000);
}

function updateHud(force = false) {
  if (!force && state.elapsed - state.lastHud < 0.12) return;
  state.lastHud = state.elapsed;
  els.timeValue.textContent = formatTime(state.elapsed + state.hintPenalty);
  els.foundValue.textContent = `${state.found}/${TOTAL}`;
  els.friendTotal.textContent = `${state.found}/${TOTAL}`;
}

function getTarget() {
  let best = null;
  let bestDistance = Infinity;
  friends.forEach((friend) => {
    if (friend.found) return;
    const dx = friend.group.position.x - player.x;
    const dz = friend.group.position.z - player.z;
    const dy = friend.group.position.y + friend.baseScale * 0.45 - EYE_HEIGHT;
    const distance = Math.hypot(dx, dz, dy);
    if (distance < REACH && distance < bestDistance) {
      bestDistance = distance;
      best = friend;
    }
  });
  return best;
}

function nearestUnfound() {
  let best = null;
  let bestDistance = Infinity;
  friends.forEach((friend) => {
    if (friend.found) return;
    const distance = Math.hypot(
      friend.group.position.x - player.x,
      friend.group.position.z - player.z
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = friend;
    }
  });
  return best;
}

function updatePrompt(force = false) {
  if (!state.playing) {
    if (promptId !== null || force) {
      promptId = null;
      els.interact.classList.remove('is-visible');
      els.tagButton.disabled = true;
    }
    return;
  }
  const target = getTarget();
  const id = target ? target.id : null;
  if (!force && id === promptId) return;
  promptId = id;
  if (target) {
    els.interact.classList.add('is-visible');
    els.interactName.textContent = `Tag ${target.name}`;
    els.tagButton.disabled = false;
  } else {
    els.interact.classList.remove('is-visible');
    els.tagButton.disabled = true;
  }
}

function updateLookHint() {
  const locked = document.pointerLockElement === canvas;
  els.lookHint.classList.toggle('is-visible', state.playing && !isTouch && !locked);
  els.lookHint.textContent = canvas.requestPointerLock ? 'Click to look around' : 'Drag to look around';
}

/* ------------------------------------------------------- game lifecycle */

function resetHunt() {
  state.playing = false;
  state.finished = false;
  state.elapsed = 0;
  state.hintPenalty = 0;
  state.hints = 0;
  state.found = 0;
  state.finishAt = Number.POSITIVE_INFINITY;
  state.hintReadyAt = 0;
  state.beamUntil = 0;
  state.lastHud = -1;

  player.x = 0;
  player.z = 15.4;
  player.yaw = 0;
  player.pitch = -0.1;
  player.walkPhase = 0;
  player.walking = false;
  keys.clear();
  touchMove.x = 0;
  touchMove.y = 0;
  els.joystickKnob.style.transform = 'translate(0, 0)';

  if (hintBeacon) hintBeacon.visible = false;
  window.clearTimeout(toastTimer);
  els.toast.classList.remove('is-visible');

  bursts.splice(0).forEach((burst) => {
    scene.remove(burst.mesh);
    burst.mesh.geometry.dispose();
    burst.mesh.material.dispose();
  });

  friends.forEach((friend) => {
    friend.found = false;
    friend.anim = -1;
    friend.group.visible = true;
    friend.group.position.set(friend.x, friend.baseY, friend.z);
    friend.group.rotation.set(0, friend.rotY, 0);
    friend.group.scale.setScalar(friend.baseScale);
    friend.sparkles.forEach((sprite) => {
      sprite.visible = false;
      sprite.material.opacity = 0;
    });
    const row = rows.get(friend.id);
    row.root.classList.remove('found');
    row.root.disabled = false;
    row.state.textContent = 'Hiding';
  });

  promptId = null;
  updateHud(true);
  updatePrompt(true);
  updateLookHint();
}

function requestLookLock() {
  if (!canvas.requestPointerLock) return;
  try {
    const result = canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {
    /* Pointer lock can be blocked in embedded previews; drag-look still works. */
  }
}

function beginHunt() {
  audio.unlock();
  resetHunt();
  state.playing = true;
  els.startOverlay.classList.remove('is-open');
  els.finishOverlay.classList.remove('is-open');
  container.focus({ preventScroll: true });
  updateLookHint();
  updatePrompt(true);
  if (!isTouch) requestLookLock();
}

function restartHunt() {
  resetHunt();
  state.playing = true;
  els.startOverlay.classList.remove('is-open');
  els.finishOverlay.classList.remove('is-open');
  container.focus({ preventScroll: true });
  toast('Fresh hunt — everyone is hiding again.', 2.2);
  updatePrompt(true);
  if (!isTouch) requestLookLock();
}

function finishHunt() {
  if (!state.playing) return;
  state.playing = false;
  state.finished = true;

  const total = state.elapsed + state.hintPenalty;
  const score = Math.max(100, Math.round(6000 - total * 20 - state.hints * 100));
  const result = submitScore(GAME_ID, score);

  els.resultKicker.textContent = result.isBest ? 'New personal best!' : 'Hunt complete';
  els.resultTime.textContent = formatTime(total);
  els.resultHints.textContent = String(state.hints);
  els.resultScore.textContent = score.toLocaleString('en-US');
  els.resultBest.textContent = result.best.toLocaleString('en-US');
  els.resultBestNote.textContent = result.isBest
    ? 'You beat your best score — try an even faster hunt.'
    : `Best score ${result.best.toLocaleString('en-US')}. Fewer clues and a faster walk score higher.`;
  els.startBest.textContent = result.best.toLocaleString('en-US');

  els.finishOverlay.classList.add('is-open');
  if (document.pointerLockElement) document.exitPointerLock();
  updatePrompt(true);
  updateLookHint();
  audio.win();
  els.status.textContent = `All ${TOTAL} friends found in ${formatTime(total)} with ${state.hints} clues. Score ${score}.`;
}

function doHint(friend = null) {
  if (!state.playing || state.finished) return;
  if (state.elapsed < state.hintReadyAt) return;
  const target = friend && !friend.found ? friend : nearestUnfound();
  if (!target) {
    toast('Every friend is already found!');
    return;
  }

  state.hintReadyAt = state.elapsed + 1.5;
  state.hints += 1;
  state.hintPenalty += 10;
  state.beamUntil = state.elapsed + 7;

  hintBeacon.visible = true;
  hintBeacon.position.set(target.group.position.x, target.baseY, target.group.position.z);
  toast(`${target.hint} (+10s)`, 5);
  audio.hint();
  updateHud(true);
}

function tagFriend(friend) {
  if (!state.playing || friend.found) return;
  friend.found = true;
  friend.anim = 0;
  state.found += 1;

  spawnBurst(friend.group.position.x, friend.baseY, friend.group.position.z);
  audio.tag();

  const row = rows.get(friend.id);
  row.root.classList.add('found');
  row.root.disabled = true;
  row.state.textContent = 'Found';

  els.foundValue.textContent = `${state.found}/${TOTAL}`;
  els.friendTotal.textContent = `${state.found}/${TOTAL}`;
  els.status.textContent = `${friend.name} found. ${state.found} of ${TOTAL} friends tagged.`;

  if (state.found === TOTAL) {
    state.finishAt = state.elapsed + 1.0;
    toast(`That is all ${TOTAL}! Every friend found.`, 2.5);
  } else {
    toast(`${pick(CHEERS).replace('{name}', friend.name)} ${state.found}/${TOTAL}`, 2.4);
  }

  updatePrompt(true);
  updateHud(true);
}

function interact() {
  if (!state.playing || state.finished) return;
  const target = getTarget();
  if (!target) {
    audio.deny();
    toast('No friend in reach — walk closer.', 1.4);
    return;
  }
  tagFriend(target);
}

function spawnBurst(x, y, z) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.42, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd93d,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, y + 0.06, z);
  scene.add(ring);
  bursts.push({ mesh: ring, t: 0 });
}

/* ---------------------------------------------------------------- input */

function bindEvents() {
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (!state.playing) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'KeyE') interact();
    if (event.code === 'KeyH') doHint();
    if (event.code === 'KeyR') restartHunt();
  });

  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas || !state.playing) return;
    if (performance.now() < lookIgnoreUntil) return;
    /* A real mouse never jumps this far in one event; pointer-lock
       recentering does. Ignore those spikes so the view stays put. */
    if (Math.abs(event.movementX) > 120 || Math.abs(event.movementY) > 120) return;
    player.yaw -= event.movementX * 0.0022;
    player.pitch = clamp(player.pitch - event.movementY * 0.0022, -1.15, 1.15);
  });

  document.addEventListener('pointerlockchange', () => {
    updateLookHint();
    if (document.pointerLockElement === canvas) {
      /* Ignore the jump some browsers emit as the pointer locks. */
      lookIgnoreUntil = performance.now() + 300;
    } else {
      keys.clear();
    }
    canvas.classList.remove('is-looking');
  });

  /* Drag-look works for touch and anywhere pointer lock is blocked. */
  let lookPointer = null;
  let lastLookX = 0;
  let lastLookY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.playing) return;
    if (event.pointerType === 'mouse' && document.pointerLockElement === canvas) return;
    lookPointer = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      /* Some embedded browsers do not support pointer capture. */
    }
    canvas.classList.add('is-looking');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookPointer) return;
    const dx = event.clientX - lastLookX;
    const dy = event.clientY - lastLookY;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    const sensitivity = event.pointerType === 'touch' ? 0.0042 : 0.0035;
    player.yaw -= dx * sensitivity;
    player.pitch = clamp(player.pitch - dy * sensitivity, -1.15, 1.15);
  });

  const stopLooking = (event) => {
    if (event.pointerId !== lookPointer) return;
    lookPointer = null;
    canvas.classList.remove('is-looking');
  };
  canvas.addEventListener('pointerup', stopLooking);
  canvas.addEventListener('pointercancel', stopLooking);

  canvas.addEventListener('click', () => {
    if (state.playing && !isTouch && document.pointerLockElement !== canvas) requestLookLock();
  });

  els.startButton.addEventListener('click', beginHunt);
  els.againButton.addEventListener('click', beginHunt);
  els.hintButton.addEventListener('click', () => doHint());
  els.restartButton.addEventListener('click', () => {
    if (state.playing) restartHunt();
    else beginHunt();
  });
  els.tagButton.addEventListener('click', interact);
  const refreshMuteButton = () => {
    const muted = audio.isMuted();
    els.muteButton.textContent = muted ? '🔇' : '🔊';
    els.muteButton.setAttribute('aria-pressed', String(muted));
    els.muteButton.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
  };

  els.muteButton.addEventListener('click', () => {
    audio.setMuted(!audio.isMuted());
    writeMuted(audio.isMuted());
    refreshMuteButton();
  });

  refreshMuteButton();

  /* Virtual joystick. */
  const knobRadius = 42;
  const setJoystick = (event) => {
    const rect = els.joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > knobRadius) {
      dx = (dx / distance) * knobRadius;
      dy = (dy / distance) * knobRadius;
    }
    touchMove.x = dx / knobRadius;
    touchMove.y = dy / knobRadius;
    els.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  els.joystick.addEventListener('pointerdown', (event) => {
    joystick.pointerId = event.pointerId;
    joystick.active = true;
    try {
      els.joystick.setPointerCapture(event.pointerId);
    } catch (error) {
      /* ignore */
    }
    setJoystick(event);
    event.preventDefault();
  });

  els.joystick.addEventListener('pointermove', (event) => {
    if (!joystick.active || event.pointerId !== joystick.pointerId) return;
    setJoystick(event);
  });

  const releaseJoystick = (event) => {
    if (event.pointerId !== joystick.pointerId) return;
    joystick.active = false;
    joystick.pointerId = null;
    touchMove.x = 0;
    touchMove.y = 0;
    els.joystickKnob.style.transform = 'translate(0, 0)';
  };
  els.joystick.addEventListener('pointerup', releaseJoystick);
  els.joystick.addEventListener('pointercancel', releaseJoystick);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) keys.clear();
  });

  /* Fullscreen */
  if (!document.fullscreenEnabled || !container.requestFullscreen) {
    els.fullscreenButton.hidden = true;
  } else {
    els.fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await container.requestFullscreen();
      } catch (error) {
        els.fullscreenButton.hidden = true;
      }
    });
  }

  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    els.fullscreenButton.textContent = active ? '⤡' : '⛶';
    els.fullscreenButton.setAttribute('aria-pressed', String(active));
    els.fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
    window.setTimeout(resize, 60);
  });
}

function resize() {
  if (!renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------ main loop */

function startLoop() {
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  clock += dt;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function update(dt) {
  if (state.playing) {
    state.elapsed += dt;
    movePlayer(dt);
    updatePrompt();
    if (state.beamUntil && state.elapsed > state.beamUntil) {
      state.beamUntil = 0;
      hintBeacon.visible = false;
    }
    if (state.elapsed >= state.finishAt) finishHunt();
    updateHud();
  }
  updateFriends(dt);
  updateSparkles();
  updateBursts(dt);
  updateBeacon();
  applyCamera();
}

function movePlayer(dt) {
  let forward = 0;
  let strafe = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
  forward += -touchMove.y;
  strafe += touchMove.x;

  const length = Math.hypot(forward, strafe);
  if (length < 0.06) {
    player.walking = false;
    player.walkPhase = 0;
    return;
  }

  const magnitude = Math.min(1, length);
  const normForward = forward / length;
  const normStrafe = strafe / length;
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);

  player.x += (-sin * normForward + cos * normStrafe) * speed * magnitude * dt;
  player.z += (-cos * normForward - sin * normStrafe) * speed * magnitude * dt;

  resolveCollisions();
  player.x = clamp(player.x, -13.1, 13.1);
  player.z = clamp(player.z, -8.6, 17.7);
  player.walking = true;
  player.walkPhase += dt * speed * 2.2;
}

function resolveCollisions() {
  if (!world) return;
  for (let pass = 0; pass < 2; pass += 1) {
    world.colliders.forEach((collider) => {
      const minX = collider.x - collider.hw - PLAYER_RADIUS;
      const maxX = collider.x + collider.hw + PLAYER_RADIUS;
      const minZ = collider.z - collider.hd - PLAYER_RADIUS;
      const maxZ = collider.z + collider.hd + PLAYER_RADIUS;
      if (player.x > minX && player.x < maxX && player.z > minZ && player.z < maxZ) {
        const left = player.x - minX;
        const right = maxX - player.x;
        const back = player.z - minZ;
        const front = maxZ - player.z;
        const smallest = Math.min(left, right, back, front);
        if (smallest === left) player.x = minX;
        else if (smallest === right) player.x = maxX;
        else if (smallest === back) player.z = minZ;
        else player.z = maxZ;
      }
    });
  }
}

function applyCamera() {
  if (!camera) return;
  const bob = state.playing && player.walking ? Math.sin(player.walkPhase) * 0.02 : 0;
  camera.position.set(player.x, EYE_HEIGHT + bob, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function updateFriends(dt) {
  friends.forEach((friend) => {
    if (friend.found) {
      if (friend.anim < 0) return;
      friend.anim += dt;
      const t = friend.anim;
      const hop = Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.4;
      friend.group.position.y = friend.baseY + hop;
      if (t > 0.5) {
        const shrink = clamp(1 - (t - 0.5) / 0.4, 0, 1);
        friend.group.scale.setScalar(friend.baseScale * shrink);
      }
      if (t > 0.95) {
        friend.group.visible = false;
        friend.anim = -1;
      }
      return;
    }
    friend.group.rotation.y = friend.rotY + Math.sin(clock * 1.1 + friend.phase) * 0.05;
    const breathe = 1 + Math.sin(clock * 2 + friend.phase) * 0.008;
    friend.group.scale.set(friend.baseScale, friend.baseScale * breathe, friend.baseScale);
  });
}

function updateSparkles() {
  friends.forEach((friend) => {
    const distance = Math.hypot(
      friend.group.position.x - player.x,
      friend.group.position.z - player.z
    );
    const near = state.playing && !friend.found && friend.group.visible && distance < 8;
    friend.sparkles.forEach((sprite, index) => {
      sprite.visible = near;
      if (!near) return;
      const t = clock * 1.4 + friend.phase + index * 2.1;
      sprite.position.set(
        Math.cos(t) * 0.24,
        0.92 + Math.sin(t * 1.3) * 0.08,
        Math.sin(t) * 0.24
      );
      sprite.material.opacity =
        (0.3 + 0.32 * Math.sin(t * 2.2)) * Math.min(1, (8 - distance) / 3);
    });
  });
}

function updateBursts(dt) {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    burst.t += dt;
    burst.mesh.scale.setScalar(1 + burst.t * 5);
    burst.mesh.material.opacity = Math.max(0, 0.9 - burst.t * 1.8);
    if (burst.t > 0.55) {
      scene.remove(burst.mesh);
      burst.mesh.geometry.dispose();
      burst.mesh.material.dispose();
      bursts.splice(index, 1);
    }
  }
}

function updateBeacon() {
  if (!hintBeacon || !hintBeacon.visible) return;
  hintBeacon.userData.beamMaterial.opacity = 0.16 + Math.sin(clock * 4) * 0.06;
  hintBeacon.rotation.y = clock * 1.1;
  hintBeacon.children[1].scale.setScalar(1 + Math.sin(clock * 3) * 0.12);
}

/* ------------------------------------------------------------------ boot */

if (!renderer) {
  els.fallback.hidden = false;
  els.startOverlay.classList.remove('is-open');
  els.status.textContent = 'This game needs WebGL.';
} else {
  init();
}
