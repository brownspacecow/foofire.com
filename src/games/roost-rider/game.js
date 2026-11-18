import * as THREE from 'three';
import { getBest, submitScore } from '../../utils/scores.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { createAutoPause } from '../../utils/auto-pause.js';
import { createAudio } from './audio.js';
import {
  TRACK_HALF,
  TRACK_LENGTH,
  START_ARC,
  createWorld,
  getTrackOutline,
  groundAt,
  sampleAtArc,
  terrainHeight,
} from './track.js';
import { createCockpit, createDust, createRiderBike } from './riders.js';

/* ------------------------------------------------------------------ *
 * Roost Rider — first-person off-road motorcycle racing
 * Three laps against three rivals on a jump-filled dirt circuit.
 * ------------------------------------------------------------------ */

const GAME_ID = 'roost-rider';
const LAPS = 3;
const GRAVITY = 26;
const BASE_MAX = 54;
const BOOST_MAX = 72;
const ACCEL = 25;
const BOOST_ACCEL = 27;
const BRAKE_POWER = 38;
const DRAG = 0.0028;
const BOOST_DRAIN = 24;
const BOOST_REGEN = 6.5;
const PLAYER_LANE = -1.6;

const AI_SETUPS = [
  {
    name: 'Dusty',
    primary: 0x2ec4ff,
    secondary: 0xffd93d,
    helmet: 0xfff3d6,
    number: 12,
    lane: 3.2,
    baseSpeed: 30.5,
    phase: 0,
  },
  {
    name: 'Moss',
    primary: 0x3ddc84,
    secondary: 0x17251a,
    helmet: 0x2b2f33,
    number: 21,
    lane: -5.1,
    baseSpeed: 32,
    phase: 2.1,
  },
  {
    name: 'Ember',
    primary: 0xff8a00,
    secondary: 0x251a10,
    helmet: 0xffd93d,
    number: 33,
    lane: 5.2,
    baseSpeed: 33.5,
    phase: 4.2,
  },
];

/* ------------------------------------------------------------------ DOM */

const container = document.querySelector('#game-container');
const coarsePointer = window.matchMedia('(pointer: coarse)');

const els = {
  speed: document.querySelector('#speed-value'),
  speedFill: document.querySelector('#speed-fill'),
  nitroFill: document.querySelector('#nitro-fill'),
  position: document.querySelector('#position-value'),
  lap: document.querySelector('#lap-value'),
  raceTime: document.querySelector('#race-time'),
  lapTime: document.querySelector('#lap-time'),
  countdown: document.querySelector('#countdown'),
  toast: document.querySelector('#toast'),
  wrongWay: document.querySelector('#wrong-way'),
  startOverlay: document.querySelector('#start-overlay'),
  finishOverlay: document.querySelector('#finish-overlay'),
  startButton: document.querySelector('#start-button'),
  againButton: document.querySelector('#again-button'),
  restartButton: document.querySelector('#restart-button'),
  muteButton: document.querySelector('#mute-button'),
  fullscreenButton: document.querySelector('#fullscreen-button'),
  startBest: document.querySelector('#start-best'),
  resultKicker: document.querySelector('#result-kicker'),
  resultPlace: document.querySelector('#result-place'),
  resultTitle: document.querySelector('#result-title'),
  resultTime: document.querySelector('#result-time'),
  resultLap: document.querySelector('#result-lap'),
  resultPoints: document.querySelector('#result-points'),
  resultScore: document.querySelector('#result-score'),
  resultBest: document.querySelector('#result-best'),
  fallback: document.querySelector('#fallback'),
  minimap: document.querySelector('#minimap'),
};

const minimapContext = els.minimap ? els.minimap.getContext('2d') : null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- state */

let scene;
let camera;
let renderer;
let world;
let cockpit;
let dust;

const audio = createAudio();
const aiRiders = [];
const keys = new Set();
const touch = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  preload: false,
};

const input = { throttle: 0, brake: 0, steer: 0, boost: false, preload: false };

const player = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  speed: 0,
  vy: 0,
  grounded: true,
  steer: 0,
  lean: 0,
  drift: 0,
  boost: 100,
  preload: 0,
  suspension: 0,
  suspensionVel: 0,
  wheelie: 0,
  wheelSpin: 0,
  airTime: 0,
  spinAccum: 0,
  lastYaw: 0,
  dustAcc: 0,
  arc: START_ARC,
  prevArc: START_ARC,
  onTrack: true,
  wrongWay: 0,
  bumpCooldown: 0,
  distance: 0,
  lapsDone: 0,
  lapStart: 0,
  bestLap: Infinity,
  midway: false,
  armed: false,
  finished: false,
};

const state = {
  phase: 'idle',
  now: 0,
  raceTime: 0,
  lap: 1,
  finalPlace: 0,
  points: 0,
  score: 0,
  best: 0,
  newBest: false,
  countdown: 0,
  lastCount: 0,
  goHideAt: 0,
  resultsAt: 0,
  resultsShown: false,
  toastUntil: 0,
  finishTime: 0,
  outline: null,
  mmScale: 1,
  mmOffsetX: 0,
  mmOffsetY: 0,
  minimapAt: 0,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${minutes}:${String(rest).padStart(2, '0')}.${tenths}`;
};

/* ----------------------------------------------------------------- init */

function init() {
  state.best = getBest(GAME_ID);
  els.startBest.textContent = state.best.toLocaleString('en-US');

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.4 : 1.8));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.setAttribute(
    'aria-label',
    'First-person view of a dirt bike race course'
  );
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.08, 1200);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  world = createWorld(scene);

  cockpit = createCockpit({ primary: '#e23c2f', secondary: '#ffd93d' });
  camera.add(cockpit);

  dust = createDust();
  scene.add(dust.points);

  AI_SETUPS.forEach((setup) => {
    const bike = createRiderBike(setup);
    scene.add(bike);
    aiRiders.push({
      ...setup,
      bike,
      dist: 0,
      speed: 0,
      lean: 0,
      finished: false,
      x: 0,
      z: 0,
      colorCss: `#${setup.primary.toString(16).padStart(6, '0')}`,
    });
  });

  setupOutline();
  bindEvents();
  prepareRace();
  resize();

  animate();
}

function setupOutline() {
  const outline = getTrackOutline(12);
  state.outline = outline;

  const size = els.minimap.width;
  const padding = 12;
  const spanX = outline.bounds.maxX - outline.bounds.minX;
  const spanZ = outline.bounds.maxZ - outline.bounds.minZ;
  const scale = (size - padding * 2) / Math.max(spanX, spanZ);

  state.mmScale = scale;
  state.mmOffsetX = (size - spanX * scale) / 2 - outline.bounds.minX * scale;
  state.mmOffsetY = (size - spanZ * scale) / 2 - outline.bounds.minZ * scale;
}

/* -------------------------------------------------------------- helpers */

function placePlayer(arc, lane) {
  const sample = sampleAtArc(arc);
  player.x = sample.x + sample.tz * lane;
  player.z = sample.z - sample.tx * lane;
  player.y = terrainHeight(player.x, player.z);
  player.yaw = Math.atan2(sample.tx, sample.tz);
  player.arc = sample.arc;
  player.prevArc = sample.arc;
  player.lastYaw = player.yaw;
}

function setCountdown(text) {
  if (!text) {
    els.countdown.textContent = '';
    els.countdown.classList.remove('show', 'pop');
    return;
  }

  els.countdown.textContent = text;
  els.countdown.classList.remove('pop');
  void els.countdown.offsetWidth;
  els.countdown.classList.add('show', 'pop');
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('is-visible');
  state.toastUntil = state.now + 1.7;
}

function prepareRace() {
  const p = player;

  state.phase = 'idle';
  state.raceTime = 0;
  state.lap = 1;
  state.finalPlace = 0;
  state.points = 0;
  state.score = 0;
  state.newBest = false;
  state.resultsShown = false;
  state.resultsAt = 0;
  state.countdown = 0;
  state.lastCount = 0;
  state.goHideAt = 0;
  state.toastUntil = 0;
  state.minimapAt = 0;

  p.speed = 0;
  p.vy = 0;
  p.grounded = true;
  p.steer = 0;
  p.lean = 0;
  p.drift = 0;
  p.boost = 100;
  p.preload = 0;
  p.suspension = 0;
  p.suspensionVel = 0;
  p.wheelie = 0;
  p.wheelSpin = 0;
  p.airTime = 0;
  p.spinAccum = 0;
  p.dustAcc = 0;
  p.wrongWay = 0;
  p.bumpCooldown = 0;
  p.distance = 0;
  p.lapsDone = 0;
  p.lapStart = 0;
  p.bestLap = Infinity;
  p.midway = false;
  p.armed = false;
  p.finished = false;
  p.onTrack = true;
  placePlayer(START_ARC, PLAYER_LANE);

  aiRiders.forEach((rider) => {
    rider.dist = 0;
    rider.speed = 0;
    rider.lean = 0;
    rider.finished = false;
  });
  updateAIWorld(0.016);

  world.startLights.forEach((lightMaterial) => lightMaterial.color.set('#ff3b30'));

  els.startOverlay.classList.add('is-open');
  els.finishOverlay.classList.remove('is-open');
  els.toast.classList.remove('is-visible');
  setCountdown('');

  updateCamera(0.016);
  updateCockpit(0.016);
  updateHud(0.016);
  drawMinimap();
}

function startRace() {
  audio.unlock();
  prepareRace();

  els.startOverlay.classList.remove('is-open');

  if (coarsePointer.matches && !document.fullscreenElement) {
    container.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  state.phase = 'countdown';
  state.countdown = 3;
  state.lastCount = 3;
  state.raceTime = 0;
  setCountdown('3');
  audio.countdown();
}

function updateCountdown(dt) {
  state.countdown -= dt;

  const count = Math.ceil(state.countdown);
  if (count > 0 && count !== state.lastCount) {
    state.lastCount = count;
    setCountdown(String(count));
    audio.countdown();
  }

  if (state.countdown <= 0) {
    state.phase = 'racing';
    state.raceTime = 0;
    state.lapStart = 0;
    player.lapStart = 0;
    player.lastYaw = player.yaw;
    player.prevArc = player.arc;
    player.armed = false;
    player.midway = false;
    setCountdown('GO!');
    audio.go();
    world.startLights.forEach((lightMaterial) => lightMaterial.color.set('#3ddc84'));

    if (input.throttle > 0) {
      player.speed = 9;
      showToast('Holeshot!');
    }

    state.goHideAt = state.now + 0.9;
  }
}

/* --------------------------------------------------------------- physics */

function updateInput() {
  const throttle = keys.has('up') || touch.up;
  const brake = keys.has('down') || touch.down;
  const left = keys.has('left') || touch.left;
  const right = keys.has('right') || touch.right;

  input.throttle = throttle ? 1 : 0;
  input.brake = brake ? 1 : 0;
  input.boost = keys.has('boost') || touch.boost;
  input.preload = keys.has('preload') || touch.preload;

  /* Positive yaw turns left on screen: left adds, right subtracts. */
  input.steer = (left ? 1 : 0) - (right ? 1 : 0);
}

function updatePlayer(dt) {
  const p = player;
  const racing = state.phase === 'racing';
  const throttle = racing ? input.throttle : 0;
  const brake = state.phase === 'finished' ? 0.85 : racing ? input.brake : 0;
  const boosting = racing && input.boost && p.boost > 0.5 && throttle > 0;

  const ground = groundAt(p.x, p.z);
  const onTrack = ground.dist < TRACK_HALF + 1.4;
  p.onTrack = onTrack;

  if (racing && input.preload && p.grounded) {
    p.preload = Math.min(1, p.preload + dt * 2.6);
  } else if (p.preload > 0) {
    if (racing && p.grounded && !input.preload && p.preload > 0.15) {
      p.vy = 3.5 + p.preload * 8;
      p.grounded = false;
      p.y += 0.02;
      p.suspensionVel -= 1.5;
      p.preload = 0;
      audio.thud(0.25);
    } else {
      p.preload = Math.max(0, p.preload - dt * 3);
    }
  }

  const steerInput = racing ? input.steer : 0;
  const speedRatio = Math.min(1, Math.abs(p.speed) / BASE_MAX);
  const turnRate = (2.2 - 1.1 * speedRatio) * (onTrack ? 1 : 0.84);
  const reverseSign = p.speed < -0.4 ? -1 : 1;

  if (p.grounded) {
    const authority = Math.min(1, Math.abs(p.speed) / 4.5);
    p.yaw += steerInput * turnRate * authority * reverseSign * dt;
  } else {
    p.yaw += steerInput * 3.6 * dt;
    /* Big jumps fly for over two seconds, far longer than any straight on
     * this circuit. With hands off the bars, drift the nose back toward the
     * trail so huge air still lands on the racing line instead of the weeds. */
    if (Math.abs(steerInput) < 0.05) {
      const trackYaw = Math.atan2(ground.tx, ground.tz);
      const error = Math.atan2(Math.sin(trackYaw - p.yaw), Math.cos(trackYaw - p.yaw));
      if (Math.abs(error) < 1.6) p.yaw += error * (1 - Math.exp(-4.5 * dt));
    }
  }

  p.steer += (steerInput - p.steer) * (1 - Math.exp(-9 * dt));

  const cornering = Math.min(1, Math.abs(p.speed) / 34);
  p.drift += -steerInput * 1.05 * cornering * (onTrack ? 1.2 : 1.1) * dt;
  p.drift *= Math.exp(-5 * dt);
  p.drift = clamp(p.drift, -0.5, 0.5);

  const forwardX = Math.sin(p.yaw);
  const forwardZ = Math.cos(p.yaw);
  const ahead = terrainHeight(p.x + forwardX * 6, p.z + forwardZ * 6);
  const behind = terrainHeight(p.x - forwardX * 6, p.z - forwardZ * 6);
  const slope = (ahead - behind) / 12;

  const maxSpeed = (boosting ? BOOST_MAX : BASE_MAX) * (onTrack ? 1 : 0.72);

  if (p.grounded) {
    if (throttle > 0) {
      const headroom = clamp(1 - Math.max(0, p.speed) / maxSpeed, 0, 1);
      p.speed +=
        (ACCEL * throttle + (boosting ? BOOST_ACCEL : 0)) *
        (0.32 + 0.68 * headroom) *
        (onTrack ? 1 : 0.62) *
        dt;
    }

    if (brake > 0) {
      if (p.speed > 0.4) p.speed -= BRAKE_POWER * brake * dt;
      else p.speed = Math.max(-9, p.speed - 15 * brake * dt);
    }

    if (throttle === 0 && brake === 0) {
      p.speed -= Math.sign(p.speed) * 2.4 * dt;
    }

    p.speed += -GRAVITY * slope * 0.9 * dt;
    p.speed -= p.speed * Math.abs(p.speed) * DRAG * (onTrack ? 1 : 1.4) * dt;

    if (p.speed > maxSpeed) p.speed -= (p.speed - maxSpeed) * 2.2 * dt;
    p.speed = clamp(p.speed, -9, BOOST_MAX + 8);
  } else {
    p.speed -= p.speed * 0.04 * dt;
  }

  if (boosting) {
    p.boost = Math.max(0, p.boost - BOOST_DRAIN * dt);
  } else if (racing) {
    p.boost = Math.min(100, p.boost + BOOST_REGEN * dt);
  }

  const moveYaw = p.yaw + p.drift * 0.6;
  const nextX = p.x + Math.sin(moveYaw) * p.speed * dt;
  const nextZ = p.z + Math.cos(moveYaw) * p.speed * dt;
  const nextGroundHeight = terrainHeight(nextX, nextZ);

  if (p.grounded) {
    const predicted = p.y + p.vy * dt;
    if (p.vy > 1.4 && predicted > nextGroundHeight + 0.05) {
      p.grounded = false;
      p.y = predicted;
    } else {
      p.y = nextGroundHeight;
      p.vy = clamp((nextGroundHeight - ground.height) / Math.max(dt, 0.0001), 0, 40);
    }
  } else {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= nextGroundHeight) {
      p.y = nextGroundHeight;
      p.grounded = true;
      landPlayer(-p.vy);
      p.vy = 0;
    }
  }

  p.x = nextX;
  p.z = nextZ;

  p.wheelSpin += (p.speed / 0.3) * dt;

  p.suspensionVel += (-p.suspension * 90 - p.suspensionVel * 11) * dt;
  p.suspension += p.suspensionVel * dt;
  p.suspension = clamp(p.suspension, -0.35, 1.5);

  const wheelieTarget =
    throttle * (1 - Math.min(1, Math.abs(p.speed) / 22)) * 0.35 + p.preload * 0.16;
  p.wheelie += (wheelieTarget - p.wheelie) * (1 - Math.exp(-6 * dt));

  const leanTarget = p.grounded
    ? -p.steer * Math.min(1, Math.abs(p.speed) / 28) * 0.5
    : 0;
  p.lean += (leanTarget - p.lean) * (1 - Math.exp(-8 * dt));

  if (!p.grounded) {
    p.airTime += dt;
    p.spinAccum += Math.atan2(Math.sin(p.yaw - p.lastYaw), Math.cos(p.yaw - p.lastYaw));
  }
  p.lastYaw = p.yaw;

  const after = groundAt(p.x, p.z);
  p.arc = after.arc;
  p.onTrack = after.dist < TRACK_HALF + 1.4;

  const alignment = Math.sin(p.yaw) * after.tx + Math.cos(p.yaw) * after.tz;

  if (racing) {
    p.distance += p.speed * alignment * dt;

    if (alignment < -0.2 && p.speed > 6) p.wrongWay += dt;
    else p.wrongWay = Math.max(0, p.wrongWay - dt * 2);

    if (p.prevArc > TRACK_LENGTH * 0.72 && p.arc < TRACK_LENGTH * 0.28) {
      if (!p.armed) {
        p.armed = true;
        p.lapStart = state.raceTime;
      } else if (p.midway) {
        const lapTime = state.raceTime - p.lapStart;
        p.lapStart = state.raceTime;
        p.bestLap = Math.min(p.bestLap, lapTime);
        p.lapsDone += 1;
        state.lap = Math.min(p.lapsDone + 1, LAPS);
        p.midway = false;

        if (p.lapsDone >= LAPS) {
          finishRace();
        } else {
          showToast(
            lapTime < 30
              ? `Lap ${p.lapsDone} — flying! ${formatTime(lapTime)}`
              : `Lap ${p.lapsDone} done`
          );
        }
      }
    }

    if (p.arc > TRACK_LENGTH * 0.4 && p.arc < TRACK_LENGTH * 0.6) p.midway = true;
    p.prevArc = p.arc;

    if (
      after.dist > 80 ||
      Math.abs(p.x) > 275 ||
      Math.abs(p.z) > 275 ||
      p.y < -30
    ) {
      respawnPlayer();
    }

    if (p.grounded && Math.abs(p.speed) > 9) {
      p.dustAcc += dt * Math.abs(p.speed) * (p.onTrack ? 0.7 : 1.1);
      while (p.dustAcc > 1) {
        p.dustAcc -= 1;
        const backX = p.x - Math.sin(p.yaw) * 0.9;
        const backZ = p.z - Math.cos(p.yaw) * 0.9;
        dust.spawn(
          backX + (Math.random() - 0.5) * 0.7,
          p.y + 0.18,
          backZ + (Math.random() - 0.5) * 0.7,
          -Math.sin(p.yaw) * (2 + Math.random() * 2) + (Math.random() - 0.5) * 2,
          1 + Math.random() * 1.8,
          -Math.cos(p.yaw) * (2 + Math.random() * 2) + (Math.random() - 0.5) * 2,
          0.75 + Math.random() * 0.55,
          0.5 + Math.random() * 0.5
        );
      }
    } else {
      p.dustAcc = 0;
    }

    for (const rider of aiRiders) {
      if (!rider.bike) continue;
      const dx = p.x - rider.x;
      const dz = p.z - rider.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && distance < 2.2) {
        const push = (2.2 - distance) * 0.5;
        p.x += (dx / distance) * push;
        p.z += (dz / distance) * push;
        p.speed *= 0.98;
        rider.speed *= 0.99;
        if (p.bumpCooldown <= 0) {
          p.bumpCooldown = 0.5;
          p.suspension = Math.max(p.suspension, 0.45);
          p.suspensionVel = -0.8;
          audio.thud(0.3);
        }
      }
    }
    p.bumpCooldown = Math.max(0, p.bumpCooldown - dt);
  }
}

function landPlayer(impact) {
  const p = player;
  const hard = clamp((impact - 6) / 18, 0, 1);

  p.speed *= 1 - hard * 0.15;
  p.suspension = Math.min(1.5, 0.25 + hard * 1.1);
  p.suspensionVel = -hard * 2;

  const airTime = p.airTime;
  const spins = Math.floor(Math.abs(p.spinAccum) / (Math.PI * 2));

  if (airTime > 0.45 && state.phase === 'racing') {
    const airPoints = Math.round(airTime * 90 + spins * 220);
    state.points += airPoints;
    p.boost = Math.min(100, p.boost + 6 + airTime * 12 + spins * 10);

    if (spins > 0) {
      showToast(`${spins * 360}° spin! +${airPoints}`);
    } else if (airTime > 0.9) {
      showToast(`Big air ${airTime.toFixed(1)}s  +${airPoints}`);
    }

    for (let i = 0; i < 10; i += 1) {
      dust.spawn(
        p.x - Math.sin(p.yaw) * 1.2 + (Math.random() - 0.5) * 1.4,
        p.y + 0.15,
        p.z - Math.cos(p.yaw) * 1.2 + (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 3,
        1.2 + Math.random() * 2,
        (Math.random() - 0.5) * 3,
        0.7 + Math.random() * 0.55,
        0.55 + Math.random() * 0.55
      );
    }

    audio.chime();
  }

  if (impact > 10) audio.thud(Math.min(1, impact / 24));

  p.airTime = 0;
  p.spinAccum = 0;
}

function respawnPlayer() {
  const p = player;
  const ground = groundAt(p.x, p.z);
  const sample = sampleAtArc(ground.arc);
  const lane = clamp(ground.side, -TRACK_HALF * 0.6, TRACK_HALF * 0.6);

  p.x = sample.x + sample.tz * lane;
  p.z = sample.z - sample.tx * lane;
  p.y = terrainHeight(p.x, p.z);
  p.yaw = Math.atan2(sample.tx, sample.tz);
  p.speed = 0;
  p.vy = 0;
  p.grounded = true;
  p.drift = 0;
  p.airTime = 0;
  p.spinAccum = 0;
  p.preload = 0;
  p.wrongWay = 0;
  p.arc = sample.arc;
  p.prevArc = sample.arc;
  p.lastYaw = p.yaw;

  showToast('Back on the trail');
}

/* ------------------------------------------------------------------- AI */

function updateAI(dt) {
  const racing = state.phase === 'racing' || state.phase === 'finished';
  if (!racing) return;

  for (const rider of aiRiders) {
    if (rider.dist < LAPS * TRACK_LENGTH) {
      let target = rider.baseSpeed;
      const gap = player.distance - rider.dist;
      if (gap > 55) target *= 1.04;
      else if (gap < -35) target *= 0.86;

      rider.speed += (target - rider.speed) * (1 - Math.exp(-0.7 * dt));
      rider.dist += rider.speed * dt;
    } else {
      rider.speed *= Math.exp(-1.2 * dt);
      rider.dist += rider.speed * dt;
      rider.finished = true;
    }
  }
}

function updateAIWorld(dt) {
  for (const rider of aiRiders) {
    const arc = START_ARC + rider.dist;
    const sample = sampleAtArc(arc);
    const sway = Math.sin(state.now * 0.55 + rider.phase) * 0.9;
    const lane = clamp(rider.lane + sway, -TRACK_HALF + 1.5, TRACK_HALF - 1.5);
    const x = sample.x + sample.tz * lane;
    const z = sample.z - sample.tx * lane;
    const y = terrainHeight(x, z);

    const aheadSample = sampleAtArc(arc + 10);
    const cross = sample.tx * aheadSample.tz - sample.tz * aheadSample.tx;
    const targetLean = clamp(cross * 2.6, -0.55, 0.55);
    rider.lean += (targetLean - rider.lean) * (1 - Math.exp(-4 * dt));

    const aheadY = terrainHeight(x + sample.tx * 2.5, z + sample.tz * 2.5);
    const pitch = Math.atan2(aheadY - y, 2.5);

    rider.x = x;
    rider.z = z;

    const bike = rider.bike;
    bike.position.set(x, y, z);
    bike.rotation.y = Math.atan2(sample.tx, sample.tz);
    bike.userData.lean.rotation.z = -rider.lean;
    bike.userData.lean.rotation.x = -pitch;
    bike.userData.wheels[0].rotation.x = rider.dist / 0.46;
    bike.userData.wheels[1].rotation.x = rider.dist / 0.46;
  }
}

function currentPlace() {
  let place = 1;
  for (const rider of aiRiders) {
    if (rider.dist > player.distance) place += 1;
  }
  return place;
}

/* ---------------------------------------------------------------- camera */

function updateCamera(dt) {
  const p = player;
  const ground = groundAt(p.x, p.z);
  const aheadY = terrainHeight(
    p.x + Math.sin(p.yaw) * 8,
    p.z + Math.cos(p.yaw) * 8
  );
  const slope = clamp((aheadY - ground.height) / 8, -0.7, 0.7);
  const speedRatio = clamp(Math.abs(p.speed) / BASE_MAX, 0, 1.35);
  const boosting =
    state.phase === 'racing' && input.boost && p.boost > 0.5 && input.throttle > 0;

  const targetFov = 69 + speedRatio * 10 + (boosting ? 5 : 0) + (p.grounded ? 0 : 2.5);
  camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4.5 * dt));
  camera.updateProjectionMatrix();

  const shakeScale = reducedMotion ? 0 : 1;
  const shake =
    (p.grounded ? speedRatio * 0.0055 + (p.onTrack ? 0 : 0.0045) : 0.0016) * shakeScale;
  const shakeYaw =
    Math.sin(state.now * 34.7) * shake + Math.sin(state.now * 57.3) * shake * 0.6;
  const shakePitch = Math.cos(state.now * 41.9) * shake;

  const eye = 1.36 - p.suspension * 0.06;
  camera.position.set(
    p.x + Math.sin(p.yaw) * 0.05 + shakeYaw * 0.4,
    p.y + eye,
    p.z + Math.cos(p.yaw) * 0.05
  );

  const airPitch = p.grounded ? 0 : clamp(p.vy * 0.012, -0.22, 0.28);
  const pitch = -0.05 + Math.atan(slope) * 0.6 + airPitch + p.wheelie * 0.16 + shakePitch;
  const roll = p.lean * 0.22 + shakeYaw * 0.5;
  /* Cameras look down their local -Z axis, so add a half turn to face
   * the direction the bike is actually travelling. */
  const yaw = p.yaw + Math.PI + p.drift * 0.18;

  camera.rotation.set(pitch, yaw, roll);

  if (world && world.sky) {
    world.sky.position.copy(camera.position);
  }
}

function updateCockpit(dt) {
  if (!cockpit) return;
  const p = player;
  const { bars, frontWheel } = cockpit.userData;

  bars.rotation.y = p.steer * 0.32;
  bars.rotation.z = -p.steer * 0.05;
  cockpit.position.y = -p.suspension * 0.07;
  cockpit.position.x = p.lean * 0.05;
  cockpit.rotation.z = p.lean * 0.06;
  cockpit.rotation.x = p.wheelie * 0.06;
  frontWheel.rotation.x = -p.wheelSpin;
}

/* ----------------------------------------------------------------- HUD */

function drawMinimap() {
  if (!minimapContext || !state.outline) return;

  const ctx = minimapContext;
  const size = els.minimap.width;
  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  state.outline.points.forEach((point, index) => {
    const x = state.mmOffsetX + point.x * state.mmScale;
    const y = state.mmOffsetY + point.z * state.mmScale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(10, 5, 24, 0.72)';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 243, 214, 0.78)';
  ctx.stroke();

  for (const rider of aiRiders) {
    const x = state.mmOffsetX + rider.x * state.mmScale;
    const y = state.mmOffsetY + rider.z * state.mmScale;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = rider.colorCss;
    ctx.fill();
  }

  const px = state.mmOffsetX + player.x * state.mmScale;
  const py = state.mmOffsetY + player.z * state.mmScale;
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8e7';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0a0518';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(player.yaw) * 9, py + Math.cos(player.yaw) * 9);
  ctx.strokeStyle = '#ff2e63';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function updateHud(dt) {
  const p = player;
  const speedKph = Math.round(Math.abs(p.speed) * 3.6);
  els.speed.textContent = String(speedKph);
  els.speedFill.style.transform = `scaleX(${clamp(speedKph / (BOOST_MAX * 3.6), 0, 1)})`;
  els.nitroFill.style.transform = `scaleX(${clamp(p.boost / 100, 0, 1)})`;

  const racing = state.phase === 'racing';
  const finished = state.phase === 'finished';
  const place = finished ? state.finalPlace : racing ? currentPlace() : 0;

  els.position.textContent = place ? `P${place}/${aiRiders.length + 1}` : `—/${aiRiders.length + 1}`;
  els.lap.textContent = `${Math.min(state.lap, LAPS)}/${LAPS}`;
  els.raceTime.textContent = formatTime(finished ? state.finishTime : state.raceTime);
  els.lapTime.textContent = formatTime(p.armed ? state.raceTime - p.lapStart : 0);

  els.wrongWay.classList.toggle('show', racing && p.wrongWay > 1.2);
  els.speedFill.style.opacity = p.speed < -0.5 ? '0.45' : '1';

  if (state.toastUntil && state.now > state.toastUntil) {
    els.toast.classList.remove('is-visible');
    state.toastUntil = 0;
  }

  if (state.goHideAt && state.now > state.goHideAt) {
    setCountdown('');
    state.goHideAt = 0;
  }

  if (state.now - state.minimapAt > 0.08) {
    state.minimapAt = state.now;
    drawMinimap();
  }
}

function finishRace() {
  if (state.phase === 'finished') return;

  const p = player;
  const place = currentPlace();
  state.finalPlace = place;
  state.phase = 'finished';
  state.finishTime = state.raceTime;
  state.lap = LAPS;
  p.finished = true;
  p.lapStart = state.raceTime;

  const placementBonus = [4200, 2800, 1900, 1200][place - 1] || 900;
  const timeBonus = Math.max(0, Math.round((160 - state.raceTime) * 22));
  const score = Math.max(0, placementBonus + timeBonus + state.points);
  const saved = submitScore(GAME_ID, score);

  state.score = score;
  state.best = saved.best;
  state.newBest = saved.isBest;
  state.resultsAt = state.now + 1.15;
  state.resultsShown = false;

  audio.finish();
  showToast(place === 1 ? 'Chequered flag — P1!' : `Chequered flag — P${place}`);
}

function showResults() {
  state.resultsShown = true;
  const place = state.finalPlace || currentPlace();

  els.resultPlace.textContent = `P${place}`;
  els.resultTitle.textContent =
    place === 1
      ? 'Winner!'
      : place === 2
        ? 'Second place'
        : place === 3
          ? 'Third place'
          : 'Fourth place';
  els.resultKicker.textContent = place === 1 ? 'Trophy secured' : 'Chequered flag';
  els.resultTime.textContent = formatTime(state.finishTime);
  els.resultLap.textContent = Number.isFinite(player.bestLap)
    ? formatTime(player.bestLap)
    : '—';
  els.resultPoints.textContent = state.points.toLocaleString('en-US');
  els.resultScore.textContent = state.score.toLocaleString('en-US');
  els.resultBest.textContent = state.newBest
    ? '🏆 New best score!'
    : `Best score ${state.best.toLocaleString('en-US')}`;

  els.startBest.textContent = state.best.toLocaleString('en-US');
  els.finishOverlay.classList.add('is-open');
}

/* --------------------------------------------------------------- events */

function bindEvents() {
  window.addEventListener('resize', resize);

  document.addEventListener('fullscreenchange', () => {
    els.fullscreenButton.setAttribute(
      'aria-pressed',
      String(Boolean(document.fullscreenElement))
    );
    requestAnimationFrame(resize);
  });

  const controls = new Map([
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
    ['ShiftLeft', 'boost'],
    ['ShiftRight', 'boost'],
    ['Space', 'preload'],
  ]);

  window.addEventListener('keydown', (event) => {
    const control = controls.get(event.code);
    if (control) {
      event.preventDefault();
      keys.add(control);
      audio.unlock();
      return;
    }

    if (event.code === 'KeyR' && !event.repeat && state.phase === 'racing') {
      event.preventDefault();
      respawnPlayer();
      return;
    }

    if (
      event.code === 'Enter' &&
      (state.phase === 'idle' || state.phase === 'finished') &&
      event.target === document.body
    ) {
      startRace();
    }
  });

  window.addEventListener('keyup', (event) => {
    const control = controls.get(event.code);
    if (control) keys.delete(control);
  });

  window.addEventListener('blur', () => keys.clear());

  els.startButton.addEventListener('click', startRace);
  els.againButton.addEventListener('click', startRace);
  els.restartButton.addEventListener('click', () => {
    startRace();
  });

  els.muteButton.addEventListener('click', toggleMute);
  els.fullscreenButton.addEventListener('click', toggleFullscreen);

  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;

    const press = (event) => {
      event.preventDefault();
      try {
        button.setPointerCapture(event.pointerId);
      } catch (error) {
        /* Pointer capture is optional; the press still registers. */
      }
      touch[control] = true;
      button.classList.add('is-pressed');
      audio.unlock();
    };
    const release = (event) => {
      if (event && button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }
      touch[control] = false;
      button.classList.remove('is-pressed');
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  container.addEventListener('pointerdown', () => {
    audio.unlock();
  });
}

let muted = readMuted();

function refreshMuteButton() {
  els.muteButton.textContent = muted ? '🔇' : '🔊';
  els.muteButton.setAttribute('aria-pressed', String(muted));
  els.muteButton.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  writeMuted(muted);
  refreshMuteButton();
  if (!muted) audio.unlock();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  } catch (error) {
    /* Fullscreen can be blocked by the browser; the game still works. */
  }
  requestAnimationFrame(resize);
}

function resize() {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.4 : 1.8));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/* ----------------------------------------------------------------- loop */

const clock = new THREE.Clock();

const autoPause = createAutoPause({
  container,
  audio,
  muteButton: els.muteButton,
  shouldPause: () => state.phase === 'racing' || state.phase === 'countdown',
  onPause: () => audio.update({ speed: 0, throttle: 0, boosting: false, active: false }),
  message: 'Race paused',
});

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  if (autoPause.paused) return;
  state.now += dt;

  updateInput();

  if (state.phase === 'racing') state.raceTime += dt;
  if (state.phase === 'countdown') updateCountdown(dt);
  if (state.phase === 'racing' || state.phase === 'finished') updatePlayer(dt);

  updateAI(dt);
  updateAIWorld(dt);
  updateCamera(dt);
  updateCockpit(dt);
  updateHud(dt);
  dust.update(dt);

  audio.update({
    speed: player.speed,
    throttle: state.phase === 'racing' ? input.throttle : 0,
    boosting: state.phase === 'racing' && input.boost && player.boost > 0.5,
    active: state.phase !== 'idle',
  });

  if (state.phase === 'finished' && !state.resultsShown && state.now >= state.resultsAt) {
    showResults();
  }

  renderer.render(scene, camera);
}

/* ---------------------------------------------------------------- boot */

audio.setMuted(muted);
refreshMuteButton();

try {
  init();
} catch (error) {
  console.error(error);
  if (els.fallback) els.fallback.hidden = false;
}
