/* -------------------------------------------------------------------------
 * Drum Quest — the 3D stage (Three.js).
 *
 * One lit little stage: warm wood, a teal rug, a curtain of string lights,
 * and a real-looking kit seen from above and behind the drummer's seat.
 * Every drum is a drum — shells, rims, heads, stands, cymbals — and each
 * one carries its own colour, matching the big pads under the stage.
 *
 * The stage is a view, never a control surface you have to aim at: taps
 * here work (generous invisible hit balls), but the pads below are the
 * real controls. That means the whole game still works if WebGL fails,
 * which is why game.js loads this module dynamically and can live without
 * it.
 *
 * Dynamic effects are all one-shot and short: the head squashes, the rim
 * flashes, the cymbal wobbles, Jack's teal stick taps the drum he means.
 * A finished lesson gets a confetti pop.
 * ---------------------------------------------------------------------- */

import * as THREE from 'three';
import { DRUMS } from './logic.js';

const COLORS = Object.fromEntries(DRUMS.map((drum) => [drum.id, drum.color]));

export function createStage(container, options = {}) {
  const reducedMotion = Boolean(options.reducedMotion);
  const onHit = typeof options.onHit === 'function' ? options.onHit : () => {};

  /* ------------------------------------------------------------ renderer */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0518);
  scene.fog = new THREE.Fog(0x0a0518, 13, 26);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  const TARGET = new THREE.Vector3(-0.1, 1.02, 0.35);
  const VIEW_DIR = new THREE.Vector3(0, 0.78, 0.63).normalize();
  const FIT_RADIUS = 2.12;
  const cameraBase = new THREE.Vector3();

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'manipulation';
  renderer.domElement.style.userSelect = 'none';
  container.appendChild(renderer.domElement);

  const materials = new Map();
  function material(color, opts = {}) {
    const key = `${color}|${JSON.stringify(opts)}`;
    if (!materials.has(key)) {
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...opts }),
      );
    }
    return materials.get(key);
  }

  const chrome = material(0xdfe4ec, { metalness: 0.85, roughness: 0.2 });
  const brass = material(0xd9ad58, { metalness: 0.45, roughness: 0.32 });
  const darkMetal = material(0x2a2735, { metalness: 0.7, roughness: 0.42 });
  const wood = material(0xcf9d68, { roughness: 0.62 });
  const cream = material(0xfff7e6, { roughness: 0.5 });
  const black = material(0x17111f, { roughness: 0.6 });

  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* -------------------------------------------------------------- textures */
  function makeCanvas(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  function woodFloorTexture() {
    const { canvas, ctx } = makeCanvas(512);
    ctx.fillStyle = '#3a2438';
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row += 1) {
      const y = row * 64;
      const shade = ['#4a2b3d', '#43263a', '#523244', '#3f2337'][row % 4];
      ctx.fillStyle = shade;
      ctx.fillRect(0, y + 2, 512, 60);
      ctx.strokeStyle = 'rgba(255, 220, 190, 0.05)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, y + 10 + i * 11);
        ctx.bezierCurveTo(150, y + 6 + i * 11, 330, y + 18 + i * 11, 512, y + 9 + i * 11);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(10, 5, 18, 0.5)';
      ctx.fillRect(row % 2 ? 0 : 256, y, 3, 64);
      ctx.fillRect(row % 2 ? 340 : 90, y, 3, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function backdropTexture() {
    const { canvas, ctx } = makeCanvas(512);
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#150c2c');
    gradient.addColorStop(0.55, '#2c1338');
    gradient.addColorStop(1, '#44203c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    // A warm glow behind the kit, like a stage wash.
    const glow = ctx.createRadialGradient(256, 330, 20, 256, 330, 300);
    glow.addColorStop(0, 'rgba(255, 190, 120, 0.42)');
    glow.addColorStop(0.45, 'rgba(240, 120, 130, 0.16)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
    // Curtain folds.
    for (let i = 0; i < 14; i += 1) {
      const x = i * 38;
      ctx.fillStyle = i % 2 ? 'rgba(10, 4, 20, 0.18)' : 'rgba(255, 200, 190, 0.045)';
      ctx.fillRect(x, 0, 20, 512);
    }
    // String lights.
    for (let i = 0; i < 15; i += 1) {
      const x = 24 + i * 33;
      const y = 90 + Math.sin(i * 0.7) * 26;
      ctx.fillStyle = 'rgba(255, 226, 150, 0.16)';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe38f';
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function kickHeadTexture() {
    const { canvas, ctx } = makeCanvas(512);
    ctx.fillStyle = '#fff6e2';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = COLORS.kick;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(256, 256, 224, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2a1b20';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2a1b20';
    ctx.font = 'bold 74px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DRUM', 256, 218);
    ctx.fillText('QUEST', 256, 292);
    ctx.fillStyle = COLORS.kick;
    ctx.font = 'bold 62px "Courier New", ui-monospace, monospace';
    ctx.fillText('★', 256, 372);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /* ---------------------------------------------------------------- lights */
  scene.add(new THREE.HemisphereLight(0xffd9b8, 0x1a0f33, 1.05));

  const key = new THREE.SpotLight(0xfff2d6, 150, 34, 0.72, 0.55, 1.3);
  key.position.set(1.4, 9.5, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 26;
  key.shadow.bias = -0.0006;
  key.target.position.set(0, 0.6, 0);
  scene.add(key, key.target);

  const pinkRim = new THREE.PointLight(0xff3d7f, 18, 20, 2);
  pinkRim.position.set(-4.2, 3.6, -2.2);
  scene.add(pinkRim);

  const blueRim = new THREE.PointLight(0x3ac4ff, 18, 20, 2);
  blueRim.position.set(4.2, 3.2, 1.8);
  scene.add(blueRim);

  const warmFront = new THREE.PointLight(0xffc089, 30, 16, 2);
  warmFront.position.set(0, 1.9, 4.6);
  scene.add(warmFront);

  // A soft camera-side fill: metals and the kick's vertical head need the
  // light that a purely top-down key never gives them.
  const frontFill = new THREE.DirectionalLight(0xffe8d2, 0.85);
  frontFill.position.set(0.4, 3.2, 6.5);
  scene.add(frontFill);

  /* ----------------------------------------------------------- the room */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 13),
    new THREE.MeshBasicMaterial({ map: backdropTexture() }),
  );
  backdrop.position.set(0, 5.2, -6.4);
  scene.add(backdrop);

  // Curtain edges either side of the stage.
  for (const side of [-1, 1]) {
    const curtain = mesh(
      new THREE.BoxGeometry(1.5, 10, 0.5),
      material(0x4a1830, { roughness: 0.95 }),
      side * 6.4,
      4.8,
      -4.2,
    );
    curtain.castShadow = false;
  }

  // Round stage: dark wood riser, teal rug, gold rim.
  const riser = mesh(
    new THREE.CylinderGeometry(3.35, 3.5, 0.16, 72),
    material(0x2c1824, { roughness: 0.85 }),
    0,
    0.08,
    0.3,
  );
  riser.castShadow = false;
  const rug = mesh(
    new THREE.CylinderGeometry(3.05, 3.05, 0.03, 72),
    material(0x14484b, { roughness: 0.95 }),
    0,
    0.17,
    0.3,
  );
  rug.castShadow = false;
  const rugInner = mesh(
    new THREE.TorusGeometry(2.55, 0.018, 6, 96),
    material(0xf4c95d, { metalness: 0.5, roughness: 0.4 }),
    0,
    0.19,
    0.3,
  );
  rugInner.rotation.x = Math.PI / 2;
  rugInner.castShadow = false;
  const rugRim = mesh(
    new THREE.TorusGeometry(3.05, 0.035, 8, 96),
    material(0xf4c95d, { metalness: 0.7, roughness: 0.32 }),
    0,
    0.19,
    0.3,
  );
  rugRim.rotation.x = Math.PI / 2;
  rugRim.castShadow = false;

  /* --------------------------------------------------------- drum registry
   * One entry per *logical* drum (all three toms answer to 'tom'), holding
   * everything the animation loop needs to move: heads to squash, materials
   * to glow, rings on the floor, cymbals to wobble.
   */
  const drums = {};
  const hitMeshes = [];

  function registerDrum(id, { centers, heads = [], glowMats = [], wobbles = [], rings = [], discs = [] }) {
    drums[id] = {
      id,
      centers,
      heads,
      glowMats,
      wobbles: wobbles.map((group) => ({ group, base: group.rotation.clone() })),
      rings,
      discs,
      hitAt: -10,
      hintOn: false,
    };
  }

  // Invisible spheres give every drum a generous thumb-sized target.
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  hitMaterial.colorWrite = false;
  function addHitSphere(id, x, y, z, radius) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), hitMaterial);
    sphere.position.set(x, y, z);
    sphere.userData.drumId = id;
    scene.add(sphere);
    hitMeshes.push(sphere);
  }

  function headMaterial(id) {
    return new THREE.MeshStandardMaterial({
      color: 0xfff7e6,
      roughness: 0.48,
      metalness: 0.02,
      emissive: new THREE.Color(COLORS[id]),
      emissiveIntensity: 0,
    });
  }

  // A ring that floats on the drum head and flashes when it is played.
  function makeRing(id, { x, y, z, radius, flat = true }) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.82, radius * 1.04, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS[id],
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.position.set(x, y, z);
    if (flat) ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    return ring;
  }

  // A faint coloured disc on the rug under every drum — a map from pad to kit.
  function makeFloorDisc(id, { x, z, radius }) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({
        color: COLORS[id],
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    disc.position.set(x, 0.2, z);
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    return disc;
  }

  /* ---------------------------------------------------------------- stands */
  function stand(x, z, topY, { legs = 0.55, radius = 0.03 } = {}) {
    const pole = mesh(new THREE.CylinderGeometry(radius, radius, topY, 12), chrome, x, topY / 2, z);
    pole.castShadow = false;
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + 0.45;
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.12, z);
      legGroup.rotation.y = angle;
      scene.add(legGroup);
      const leg = mesh(new THREE.CylinderGeometry(0.022, 0.022, legs, 8), chrome, 0, 0, 0.16, legGroup);
      leg.rotation.x = -0.4;
      leg.castShadow = false;
    }
  }

  /* ------------------------------------------------------------- the drums */

  // --- Kick: centre, big, front head painted "DRUM QUEST".
  const kickGroup = new THREE.Group();
  kickGroup.position.set(0, 0.8, 0.5);
  scene.add(kickGroup);
  const kickMat = material(COLORS.kick, { roughness: 0.3, metalness: 0.35 });
  const kickBody = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.56, 56), kickMat, 0, 0, 0, kickGroup);
  kickBody.rotation.x = Math.PI / 2;
  const kickHeadMat = new THREE.MeshStandardMaterial({
    map: kickHeadTexture(),
    roughness: 0.5,
    emissive: new THREE.Color(COLORS.kick),
    emissiveIntensity: 0,
  });
  const kickFront = mesh(new THREE.CircleGeometry(0.585, 56), kickHeadMat, 0, 0, 0.285, kickGroup);
  const kickBack = mesh(new THREE.CircleGeometry(0.585, 48), cream, 0, 0, -0.285, kickGroup);
  kickBack.rotation.y = Math.PI;
  for (const z of [-0.28, 0.28]) {
    const hoop = mesh(new THREE.TorusGeometry(0.62, 0.035, 10, 56), chrome, 0, 0, z, kickGroup);
    hoop.castShadow = false;
  }
  // Spurs either side, and a pedal at the front.
  for (const side of [-1, 1]) {
    const spur = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 8), chrome, side * 0.55, -0.42, 0.18, kickGroup);
    spur.rotation.z = side * 0.55;
    spur.castShadow = false;
  }
  const pedal = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.42), darkMetal, 0.28, 0.04, 1.14);
  pedal.rotation.x = -0.18;
  const pedalFoot = mesh(new THREE.BoxGeometry(0.19, 0.03, 0.16), black, 0.28, 0.09, 1.3);
  pedalFoot.rotation.x = -0.3;

  registerDrum('kick', {
    centers: [new THREE.Vector3(0, 0.95, 0.55)],
    heads: [kickFront],
    glowMats: [kickHeadMat],
    rings: [makeRing('kick', { x: 0, y: 0.8, z: 0.79, radius: 0.62, flat: false })],
    discs: [makeFloorDisc('kick', { x: 0, z: 0.62, radius: 0.85 })],
  });
  addHitSphere('kick', 0, 0.95, 0.55, 0.72);

  // --- Snare: left of centre, close to the drummer.
  function shellDrum(id, { x, z, headY, radius, depth, tilt = 0 }) {
    const group = new THREE.Group();
    group.position.set(x, headY, z);
    group.rotation.z = tilt;
    scene.add(group);
    const shell = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 40),
      material(COLORS[id], { roughness: 0.32, metalness: 0.3 }),
      0,
      -depth / 2,
      0,
      group,
    );
    shell.castShadow = true;
    const headMat = headMaterial(id);
    const head = mesh(new THREE.CircleGeometry(radius * 0.97, 48), headMat, 0, 0.01, 0, group);
    head.rotation.x = -Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(radius, 0.026, 8, 48), chrome, 0, 0.02, 0, group);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = false;
    // A thin hoop in the drum's own colour, so the kit and the pads match.
    const colourHoop = mesh(
      new THREE.TorusGeometry(radius * 0.9, 0.012, 6, 48),
      material(COLORS[id], { roughness: 0.4, metalness: 0.2 }),
      0,
      0.022,
      0,
      group,
    );
    colourHoop.rotation.x = Math.PI / 2;
    colourHoop.castShadow = false;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const lug = mesh(new THREE.BoxGeometry(0.03, 0.06, 0.02), chrome, Math.cos(a) * radius, -depth * 0.45, Math.sin(a) * radius, group);
      lug.castShadow = false;
    }
    return { head, headMat };
  }

  const snare = shellDrum('snare', { x: -0.98, z: 1.0, headY: 0.98, radius: 0.37, depth: 0.24, tilt: -0.05 });
  stand(-0.98, 1.0, 0.76);
  registerDrum('snare', {
    centers: [new THREE.Vector3(-0.98, 1.0, 1.0)],
    heads: [snare.head],
    glowMats: [snare.headMat],
    rings: [makeRing('snare', { x: -0.98, y: 1.0, z: 1.0, radius: 0.37 })],
    discs: [makeFloorDisc('snare', { x: -0.98, z: 1.0, radius: 0.55 })],
  });
  addHitSphere('snare', -0.98, 1.02, 1.0, 0.5);

  // --- Hi-hat: far left, two brass plates and a clutch.
  const hihat = new THREE.Group();
  hihat.position.set(-2.1, 1.05, 0.6);
  scene.add(hihat);
  for (const y of [0, 0.055]) {
    const plate = mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.022, 48), brass, 0, y, 0, hihat);
    plate.castShadow = false;
    const rim = mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 48), material(COLORS.hihat, { roughness: 0.4 }), 0, y + 0.005, 0, hihat);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = false;
  }
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), chrome, 0, 0.14, 0, hihat);
  // Teal clutch band, matching the hi-hat pad.
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), material(COLORS.hihat, { roughness: 0.45 }), 0, 0.2, 0, hihat);
  stand(-2.1, 0.6, 1.0);
  registerDrum('hihat', {
    centers: [new THREE.Vector3(-2.1, 1.12, 0.6)],
    heads: [],
    glowMats: [],
    wobbles: [hihat],
    rings: [makeRing('hihat', { x: -2.1, y: 1.12, z: 0.6, radius: 0.42 })],
    discs: [makeFloorDisc('hihat', { x: -2.1, z: 0.6, radius: 0.55 })],
  });
  addHitSphere('hihat', -2.1, 1.1, 0.6, 0.62);

  // --- Rack toms: above the kick, one each side of centre.
  const rackToms = [
    shellDrum('tom', { x: -0.45, z: -0.05, headY: 1.52, radius: 0.31, depth: 0.34, tilt: 0.05 }),
    shellDrum('tom', { x: 0.45, z: -0.05, headY: 1.52, radius: 0.31, depth: 0.34, tilt: -0.05 }),
  ];
  // Floor tom: right, big and low.
  const floorTom = shellDrum('tom', { x: 1.5, z: 0.55, headY: 0.82, radius: 0.4, depth: 0.55 });
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8),
      chrome,
      1.5 + Math.cos(a) * 0.36,
      0.38,
      0.55 + Math.sin(a) * 0.36,
    );
    leg.rotation.z = Math.cos(a) * 0.16;
    leg.rotation.x = -Math.sin(a) * 0.16;
    leg.castShadow = false;
  }
  // One mount holding the two rack toms over the kick.
  stand(0, -0.1, 1.55, { legs: 0.7 });
  const tomPost = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 8), chrome, 0.45, 1.35, 0.1);
  tomPost.rotation.z = Math.PI / 2 - 0.2;
  const tomCenter = new THREE.Vector3(-0.45, 1.55, -0.05);
  const tomHeadMats = [rackToms[0].headMat, rackToms[1].headMat, floorTom.headMat];
  registerDrum('tom', {
    centers: [
      tomCenter,
      new THREE.Vector3(0.45, 1.55, -0.05),
      new THREE.Vector3(1.5, 0.84, 0.55),
    ],
    heads: [rackToms[0].head, rackToms[1].head, floorTom.head],
    glowMats: tomHeadMats,
    rings: [
      makeRing('tom', { x: -0.45, y: 1.55, z: -0.05, radius: 0.31 }),
      makeRing('tom', { x: 0.45, y: 1.55, z: -0.05, radius: 0.31 }),
      makeRing('tom', { x: 1.5, y: 0.84, z: 0.55, radius: 0.4 }),
    ],
    discs: [
      makeFloorDisc('tom', { x: -0.45, z: -0.05, radius: 0.45 }),
      makeFloorDisc('tom', { x: 0.45, z: -0.05, radius: 0.45 }),
      makeFloorDisc('tom', { x: 1.5, z: 0.55, radius: 0.55 }),
    ],
  });
  addHitSphere('tom', -0.45, 1.55, -0.05, 0.48);
  addHitSphere('tom', 0.45, 1.55, -0.05, 0.48);
  addHitSphere('tom', 1.5, 0.86, 0.55, 0.56);

  // --- Crash and ride: far side, up high, each its own drum.
  function cymbal(id, { x, z, y, radius, tilt }) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(-0.14, 0, tilt);
    scene.add(group);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xc79a43,
      metalness: 0.55,
      roughness: 0.36,
      emissive: new THREE.Color(COLORS[id]),
      emissiveIntensity: 0.02,
    });
    const plate = mesh(new THREE.CylinderGeometry(radius, radius * 0.98, 0.024, 56), plateMat, 0, 0, 0, group);
    plate.castShadow = false;
    mesh(new THREE.SphereGeometry(0.055, 12, 8), plateMat, 0, 0.03, 0, group).castShadow = false;
    // Lathed grooves, so a cymbal reads as metal instead of a yellow disc.
    for (const ratio of [0.4, 0.62, 0.82]) {
      const groove = mesh(
        new THREE.TorusGeometry(radius * ratio, 0.007, 4, 56),
        material(0x9c742c, { metalness: 0.5, roughness: 0.38 }),
        0,
        0.014,
        0,
        group,
      );
      groove.rotation.x = Math.PI / 2;
      groove.castShadow = false;
    }
    // A painted rim in the drum's own colour: crash is pink, ride is orange.
    const rim = mesh(new THREE.TorusGeometry(radius + 0.004, 0.016, 6, 56), material(COLORS[id], { roughness: 0.4 }), 0, 0.01, 0, group);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = false;
    stand(x, z, y - 0.1);
    return { group, plateMat };
  }

  const crash = cymbal('crash', { x: -1.58, z: -0.7, y: 1.88, radius: 0.55, tilt: -0.16 });
  registerDrum('crash', {
    centers: [new THREE.Vector3(-1.58, 1.95, -0.7)],
    heads: [],
    glowMats: [crash.plateMat],
    wobbles: [crash.group],
    rings: [makeRing('crash', { x: -1.58, y: 1.91, z: -0.7, radius: 0.55 })],
    discs: [makeFloorDisc('crash', { x: -1.58, z: -0.7, radius: 0.62 })],
  });
  addHitSphere('crash', -1.58, 1.92, -0.7, 0.7);

  const ride = cymbal('ride', { x: 1.72, z: -0.62, y: 1.78, radius: 0.6, tilt: 0.15 });
  registerDrum('ride', {
    centers: [new THREE.Vector3(1.72, 1.85, -0.62)],
    heads: [],
    glowMats: [ride.plateMat],
    wobbles: [ride.group],
    rings: [makeRing('ride', { x: 1.72, y: 1.81, z: -0.62, radius: 0.6 })],
    discs: [makeFloorDisc('ride', { x: 1.72, z: -0.62, radius: 0.66 })],
  });
  addHitSphere('ride', 1.72, 1.82, -0.62, 0.74);

  /* ------------------------------------------------------- Jack's stick */
  // A teal-banded stick that taps the drum Jack means. It is intentionally
  // unlike anything the player holds, and it only appears on his turn.
  const jackStick = new THREE.Group();
  const jackStickGeo = new THREE.CylinderGeometry(0.028, 0.018, 1.15, 8);
  jackStickGeo.translate(0, 0.575, 0);
  const jackStickMesh = new THREE.Mesh(jackStickGeo, wood);
  jackStickMesh.castShadow = true;
  jackStick.add(jackStickMesh);
  const jackGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 10), material(COLORS.hihat, { roughness: 0.45 }));
  jackGrip.position.y = 0.22;
  jackStick.add(jackGrip);
  const jackTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), material(0xf4c95d, { roughness: 0.4 }));
  jackStick.add(jackTip);
  jackStick.visible = false;
  scene.add(jackStick);
  let jackStrikeAt = -10;

  function jackHit(drumId) {
    const drum = drums[drumId];
    if (!drum || !drum.centers.length) return;
    const center = drum.centers[Math.floor(Math.random() * drum.centers.length)];
    jackStick.position.set(center.x + 0.62, center.y + 0.95, center.z + 0.25);
    jackStrikeAt = elapsed;
    jackStick.visible = true;
  }

  /* --------------------------------------------------------- player hits */
  const clock = new THREE.Clock();
  let elapsed = 0;

  function hit(drumId) {
    const drum = drums[drumId];
    if (!drum) return;
    drum.hitAt = elapsed;
  }

  /** A lesson target glows steadily on the drum until the step is done. */
  function setHints(ids = []) {
    const next = new Set(ids);
    for (const drum of Object.values(drums)) drum.hintOn = next.has(drum.id);
  }

  function clearHints() {
    setHints([]);
  }

  let celebrateQueued = false;
  function celebrate() {
    celebrateQueued = true;
  }

  /* ------------------------------------------------------------- confetti */
  const confetti = [];
  const confettiGroup = new THREE.Group();
  scene.add(confettiGroup);
  const confettiColors = Object.values(COLORS);

  function popConfetti() {
    if (reducedMotion) return;
    for (let i = 0; i < 34; i += 1) {
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.02, 0.11),
        new THREE.MeshStandardMaterial({
          color: confettiColors[i % confettiColors.length],
          roughness: 0.6,
        }),
      );
      piece.position.set((Math.random() - 0.5) * 2.4, 2.2 + Math.random() * 0.8, (Math.random() - 0.5) * 2.2);
      piece.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      piece.castShadow = false;
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        2.4 + Math.random() * 2.6,
        (Math.random() - 0.5) * 2.4,
      );
      confettiGroup.add(piece);
      confetti.push({ piece, velocity, born: elapsed });
    }
  }

  /* ------------------------------------------------------------- pointer */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickDrum(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    for (const hitResult of hits) {
      const id = hitResult.object.userData.drumId;
      if (id && drums[id]) return id;
    }
    return null;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const id = pickDrum(event);
    if (id) onHit(id);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      renderer.domElement.style.cursor = pickDrum(event) ? 'pointer' : 'default';
    }
  });

  /* -------------------------------------------------------------- resize */
  function resize() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const half = Math.min(vFov, hFov) / 2;
    const distance = THREE.MathUtils.clamp(FIT_RADIUS / Math.sin(half), 6.2, 18);
    cameraBase.copy(TARGET).addScaledVector(VIEW_DIR, distance);
    camera.position.copy(cameraBase);
    camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
  }
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(resize).observe(container);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  /* -------------------------------------------------------------- animate */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const now = elapsed;

    // A breath of camera sway, so the stage feels alive. Off for reduced motion.
    if (!reducedMotion) {
      camera.position.copy(cameraBase);
      camera.position.x += Math.sin(now * 0.34) * 0.035;
      camera.position.y += Math.sin(now * 0.52) * 0.02;
      camera.lookAt(TARGET);
    }

    // Per-drum reactions.
    for (const drum of Object.values(drums)) {
      const hitAge = now - drum.hitAt;
      const squash = hitAge >= 0 && hitAge < 0.2 ? 1 + 0.13 * (1 - hitAge / 0.2) : 1;
      for (const head of drum.heads) head.scale.setScalar(squash);

      const flash = hitAge >= 0 && hitAge < 0.32 ? 1 - hitAge / 0.32 : 0;
      const hint = drum.hintOn ? 0.34 + 0.22 * Math.sin(now * 5.5) : 0;
      const lit = Math.max(flash, hint);
      for (const mat of drum.glowMats) mat.emissiveIntensity = 0.05 + lit * 1.05;
      for (const ring of drum.rings) {
        const ringLit = Math.max(flash, drum.hintOn ? 0.55 + 0.3 * Math.sin(now * 5.5) : 0);
        ring.visible = ringLit > 0.02;
        ring.material.opacity = Math.max(0, ringLit);
      }
      for (const wobble of drum.wobbles) {
        const amount = hitAge >= 0 && hitAge < 1.1 ? Math.sin(now * 22) * 0.14 * Math.exp(-4 * hitAge) : 0;
        wobble.group.rotation.z = wobble.base.z + amount;
        wobble.group.rotation.x = wobble.base.x + amount * 0.5;
      }
      const discGlow = drum.hintOn
        ? 0.28 + 0.12 * Math.sin(now * 5.5)
        : hitAge >= 0 && hitAge < 0.4
          ? 0.36
          : 0.14;
      for (const disc of drum.discs) disc.material.opacity = discGlow;
    }

    // Jack's stick: a quick tap on the drum he means, then it lifts away.
    const stickAge = now - jackStrikeAt;
    if (stickAge >= 0 && stickAge < 0.42) {
      const swing = Math.sin(Math.min(1, stickAge / 0.26) * Math.PI);
      jackStick.rotation.z = 0.95 - swing * 0.55;
      jackStick.rotation.x = 0.12 + swing * 0.1;
      jackStick.visible = true;
    } else {
      jackStick.visible = false;
    }

    // Confetti.
    for (let i = confetti.length - 1; i >= 0; i -= 1) {
      const piece = confetti[i];
      piece.velocity.y -= 5.2 * dt;
      piece.piece.position.addScaledVector(piece.velocity, dt);
      piece.piece.rotation.x += dt * 5;
      piece.piece.rotation.z += dt * 7;
      if (piece.piece.position.y < -0.6 || now - piece.born > 2.6) {
        confettiGroup.remove(piece.piece);
        piece.piece.geometry.dispose();
        piece.piece.material.dispose();
        confetti.splice(i, 1);
      }
    }

    if (celebrateQueued) {
      celebrateQueued = false;
      popConfetti();
    }

    renderer.render(scene, camera);
  }
  animate();

  return { hit, setHints, clearHints, resize, jackHit, celebrate };
}
