import * as THREE from 'three';

const container = document.querySelector('#game-container');
const statusEl = document.querySelector('#status');
const feedButton = document.querySelector('#feed-button');
const playButton = document.querySelector('#play-button');
const petButton = document.querySelector('#pet-button');
const resetButton = document.querySelector('#reset-button');

let scene, camera, renderer, bear, ground;
let happiness = 50;
let hunger = 50;
let energy = 50;
let lastTime = 0;
let isPlaying = false;
let playStartTime = 0;
let tailAngle = 0;
let earAngle = 0;

const init = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 10, 60);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 6, 12);
  camera.lookAt(0, 1, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x7cfc00 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(60, 30, 0x5cb85c, 0x3cb371);
  scene.add(grid);

  bear = createBear();
  scene.add(bear);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  feedButton.addEventListener('click', () => care('feed'));
  playButton.addEventListener('click', () => care('play'));
  petButton.addEventListener('click', () => care('pet'));
  resetButton.addEventListener('click', reset);
  window.addEventListener('resize', onResize);

  reset();
  animate(0);
};

const createBear = () => {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffc0cb });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.2, 8, 16), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.y = 1.1;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), bodyMat);
  head.position.set(0, 1.6, 0.75);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.45), pinkMat);
  snout.position.set(0, 1.45, 1.15);
  group.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), blackMat);
  nose.position.set(0, 1.4, 1.4);
  group.add(nose);

  const leftEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 4, 8), blackMat);
  leftEar.rotation.z = -Math.PI / 4;
  leftEar.position.set(-0.45, 1.85, 0.85);
  group.add(leftEar);

  const rightEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 4, 8), blackMat);
  rightEar.rotation.z = Math.PI / 4;
  rightEar.position.set(0.45, 1.85, 0.85);
  group.add(rightEar);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), blackMat);
  leftEye.position.set(-0.2, 1.65, 1.05);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), blackMat);
  rightEye.position.set(0.2, 1.65, 1.05);
  group.add(rightEye);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 8), blackMat);
  leftLeg.rotation.x = Math.PI / 2;
  leftLeg.position.set(-0.35, 0.6, 0.5);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 8), blackMat);
  rightLeg.rotation.x = Math.PI / 2;
  rightLeg.position.set(0.35, 0.6, 0.5);
  group.add(rightLeg);

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), blackMat);
  tail.rotation.x = Math.PI / 4;
  tail.position.set(0, 1.0, -0.75);
  group.add(tail);

  group.userData = { tail, leftEar, rightEar, head, body };

  return group;
};

const clamp = (v, min, max) => Math.max(min, Math.max(max, v));

const updateStats = () => {
  happiness = clamp(happiness, 0, 100);
  hunger = clamp(hunger, 0, 100);
  energy = clamp(energy, 0, 100);

  let message = `Bear is happy: ${happiness}% | Hunger: ${hunger}% | Energy: ${energy}%`;
  if (happiness >= 80 && hunger < 40 && energy > 40) {
    message += ' — Bear is a very happy puppy!';
  } else if (happiness < 30 || hunger > 80 || energy < 20) {
    message += ' — Bear needs some love.';
  }
  statusEl.textContent = message;
};

const care = (action) => {
  if (action === 'feed') {
    hunger = Math.max(0, hunger - 30);
    happiness = Math.min(100, happiness + 10);
    energy = Math.min(100, energy + 5);
    statusEl.textContent = 'You fed Bear some tasty kibble!';
  } else if (action === 'play') {
    if (energy > 20) {
      isPlaying = true;
      playStartTime = performance.now();
      happiness = Math.min(100, happiness + 20);
      hunger = Math.min(100, hunger + 10);
      energy = Math.max(0, energy - 20);
      statusEl.textContent = 'Bear is playing fetch!';
    } else {
      statusEl.textContent = 'Bear is too tired to play. Let him rest.';
    }
  } else if (action === 'pet') {
    happiness = Math.min(100, happiness + 15);
    energy = Math.min(100, energy + 5);
    statusEl.textContent = 'You petted Bear. He loves it!';
  }
  updateStats();
};

const reset = () => {
  happiness = 50;
  hunger = 50;
  energy = 50;
  isPlaying = false;
  bear.position.set(0, 0, 0);
  bear.rotation.set(0, 0, 0);
  updateStats();
  statusEl.textContent = 'Bear is ready for some love! Click Feed, Play, or Pet.';
};

const onResize = () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
};

const animate = (time) => {
  requestAnimationFrame(animate);

  const delta = (time - lastTime) / 1000;
  lastTime = time;

  if (bear) {
    tailAngle += delta * 6;
    const { tail, leftEar, rightEar, head, body } = bear.userData;

    tail.rotation.z = Math.PI / 4 + Math.sin(tailAngle) * 0.4;

    const earSway = Math.sin(time * 0.003) * 0.15;
    leftEar.rotation.z = -Math.PI / 4 + earSway;
    rightEar.rotation.z = Math.PI / 4 - earSway;

    if (isPlaying) {
      const playElapsed = (time - playStartTime) / 1000;
      bear.position.z = Math.sin(playElapsed * 4) * 0.3;
      bear.rotation.x = Math.sin(playElapsed * 6) * 0.1;
      if (playElapsed > 3) {
        isPlaying = false;
        bear.position.set(0, 0, 0);
        bear.rotation.set(0, 0, 0);
      }
    } else {
      const idleSway = Math.sin(time * 0.002) * 0.05;
      bear.position.y = 0.1 + idleSway;
    }

    if (hunger > 80) {
      head.position.y = 1.6 - Math.sin(time * 0.005) * 0.1;
    }
  }

  renderer.render(scene, camera);
};

init();
