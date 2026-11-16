import * as THREE from 'three';

const container = document.querySelector('#game-container');
const statusEl = document.querySelector('#status');
const resetButton = document.querySelector('#reset-button');

let scene, camera, renderer, ball, goal, ground;
let velocity = new THREE.Vector3();
const keys = {};

const init = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  scene.fog = new THREE.Fog(0x111111, 10, 50);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
  scene.add(grid);

  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xcc0000 })
  );
  ball.position.set(0, 0.6, 0);
  scene.add(ball);

  goal = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0x00cc00 })
  );
  goal.position.set(10, 0.1, -10);
  scene.add(goal);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  resetButton.addEventListener('click', reset);
  window.addEventListener('resize', onResize);

  reset();
  animate();
};

const reset = () => {
  ball.position.set(0, 0.6, 0);
  velocity.set(0, 0, 0);
  statusEl.textContent = 'Use arrow keys or WASD to move. Reach the green goal!';
  statusEl.style.color = '';
};

const onResize = () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
};

const moveBall = (delta) => {
  const speed = 6;
  const dir = new THREE.Vector3();
  if (keys['ArrowLeft'] || keys['KeyA']) dir.x -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) dir.x += 1;
  if (keys['ArrowUp'] || keys['KeyW']) dir.z -= 1;
  if (keys['ArrowDown'] || keys['KeyS']) dir.z += 1;
  if (dir.length() > 0) dir.normalize();

  velocity.x = dir.x * speed;
  velocity.z = dir.z * speed;

  ball.position.x += velocity.x * delta;
  ball.position.z += velocity.z * delta;

  ball.position.x = Math.max(-19, Math.min(19, ball.position.x));
  ball.position.z = Math.max(-19, Math.min(19, ball.position.z));

  ball.position.y = 0.6;
};

const checkGoal = () => {
  const dist = ball.position.distanceTo(goal.position);
  if (dist < 1.5) {
    statusEl.textContent = 'You reached the goal! Well done.';
    statusEl.style.color = '#00cc00';
    velocity.set(0, 0, 0);
    return true;
  }
  return false;
};

const animate = () => {
  requestAnimationFrame(animate);

  const delta = 0.016;
  moveBall(delta);
  checkGoal();

  ball.rotation.x += 0.05;
  ball.rotation.z += 0.05;

  renderer.render(scene, camera);
};

init();
