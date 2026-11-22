/* -------------------------------------------------------------------------
 * Drum Quest — the 3D stage (Three.js).
 * House pattern, same as ball-pit / bear / claw-machine: importmap
 * "three": "https://esm.sh/three@0.168.0", MeshStandardMaterial,
 * ACES tone mapping, one shadow-casting key light, raycast taps.
 *
 * A stage with a real-looking kit (kick, snare, hi-hat, two rack toms,
 * floor tom, crash + ride cymbals) and Joel behind it, red mohawk and all.
 * Tap a drum in 3D to hit it; the head squashes, the cymbal wobbles,
 * the rim flashes and Joel's stick strikes. No flat pads anywhere.
 * Thumb-first: the camera is close and low, every drum has an invisible
 * hit sphere ~1.6x its size, and the game is designed for two thumbs
 * in phone portrait — no precise tapping, no hover, no double-tap zoom.
 * ---------------------------------------------------------------------- */

import * as THREE from 'three';

export const DRUM_COLORS = {
  kick: '#ff6b5e',
  snare: '#f4c95d',
  hihat: '#7fd8c6',
  tom: '#b6a3ff',
  crash: '#f08fa4',
};

const DRUM_LABELS = {
  kick: 'KICK · A',
  snare: 'SNARE · S',
  hihat: 'HI-HAT · D',
  tom: 'TOM · F',
  crash: 'CRASH · G',
};

/* Left stick hits the snare side, right stick the tom/crash side. */
const STRIKE_ARM = {
  kick: 'foot',
  snare: 'left',
  hihat: 'left',
  tom: 'right',
  crash: 'right',
};

export function createStage(container, options = {}) {
  const reducedMotion = Boolean(options.reducedMotion);
  const onHit = typeof options.onHit === 'function' ? options.onHit : () => {};

  /* ------------------------------------------------------------ renderer */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0418);
  scene.fog = new THREE.Fog(0x0a0418, 14, 30);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  // Thumb-first framing: close, low, and a little top-down, so the kit
  // fills the frame and the drums are big enough for two thumbs in
  // portrait. Joel is still visible behind the kit, but the drums are
  // the stars. Phones get a wider lens instead of a pulled-back camera.
  const CAM_BASE = new THREE.Vector3(0, 2.3, 4.2);
  const LOOK_BASE = new THREE.Vector3(0, 0.9, 0.3);
  const CAM_ZOOM = new THREE.Vector3(0, 2.1, 3.7);
  const LOOK_ZOOM = new THREE.Vector3(0, 0.9, 0.35);
  let zoomed = false;
  const camTarget = CAM_BASE.clone();
  const lookTarget = LOOK_BASE.clone();
  const tmpPos = new THREE.Vector3();
  let fovTarget = 46;
  camera.position.copy(CAM_BASE);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'manipulation';
  renderer.domElement.style.userSelect = 'none';
  container.appendChild(renderer.domElement);

  const MATS = new Map();
  function mat(color, opts = {}) {
    const key = `${color}|${JSON.stringify(opts)}`;
    if (!MATS.has(key)) {
      MATS.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts }),
      );
    }
    return MATS.get(key);
  }

  const chrome = mat(0xd8dce2, { metalness: 1, roughness: 0.18 });
  const brass = mat(0xd4af37, { metalness: 0.9, roughness: 0.28 });
  const shellRed = mat(0xd92038, { roughness: 0.22, metalness: 0.35 });
  const darkMetal = mat(0x2a2a33, { metalness: 0.8, roughness: 0.4 });
  const skin = mat(0xf2c29b, { roughness: 0.6 });
  const shirt = mat(0x2ec4b6, { roughness: 0.75 });
  const pants = mat(0x2b3a67, { roughness: 0.8 });
  const wood = mat(0xc89b6a, { roughness: 0.6 });
  const whiteHead = mat(0xf5f0e6, { roughness: 0.55 });

  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* --------------------------------------------------------------- lights */
  scene.add(new THREE.HemisphereLight(0xcbb8ff, 0x21103f, 0.9));

  const key = new THREE.SpotLight(0xfff1d6, 140, 30, 0.62, 0.55, 1.4);
  key.position.set(0, 7.5, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 25;
  key.shadow.bias = -0.0005;
  key.target.position.set(0, 0.8, 0);
  scene.add(key);
  scene.add(key.target);

  const pinkGlow = new THREE.PointLight(0xff2e63, 26, 18, 2);
  pinkGlow.position.set(-4.5, 4.4, 2.5);
  scene.add(pinkGlow);

  const blueGlow = new THREE.PointLight(0x2ec4ff, 22, 18, 2);
  blueGlow.position.set(4.5, 4.2, -2);
  scene.add(blueGlow);

  /* -------------------------------------------------------- stage + room */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x17102a, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Round stage platform with a gold rim.
  const platform = mesh(
    new THREE.CylinderGeometry(3.1, 3.25, 0.12, 64),
    mat(0x2a1530, { roughness: 0.9 }),
    0,
    0.06,
    0.1,
  );
  platform.castShadow = false;
  const rim = mesh(
    new THREE.TorusGeometry(3.1, 0.035, 12, 80),
    mat(0xf4c95d, { metalness: 0.8, roughness: 0.3 }),
    0,
    0.12,
    0.1,
  );
  rim.rotation.x = Math.PI / 2;

  // Backdrop wall and side curtains.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshStandardMaterial({ color: 0x120a24, roughness: 1 }),
  );
  backdrop.position.set(0, 6, -5);
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  for (const side of [-1, 1]) {
    const curtain = mesh(
      new THREE.BoxGeometry(1.4, 9, 0.5),
      mat(0x5c1a24, { roughness: 0.95 }),
      side * 5.2,
      4.5,
      -4.2,
    );
    curtain.castShadow = false;
  }

  // Translucent light cones from the spot fixtures.
  function lightCone(color, x, z, tiltZ) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 7, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    cone.position.set(x, 3.6, z);
    cone.rotation.z = tiltZ;
    cone.rotation.x = 0.12;
    scene.add(cone);
    return cone;
  }
  lightCone(0xff2e63, -3.4, 1.2, 0.42);
  lightCone(0x2ec4ff, 3.4, 1.2, -0.42);

  // Spot fixtures up in the rigging.
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), darkMetal, side * 3.4, 7.1, 1.2);
    const lens = mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff1d6,
        emissive: side < 0 ? 0xff2e63 : 0x2ec4ff,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
      side * 3.4,
      6.9,
      1.2,
    );
    lens.castShadow = false;
  }

  // Little gold fairy lights across the backdrop.
  const fairyGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const fairyMat = new THREE.MeshBasicMaterial({ color: 0xf4c95d });
  for (let i = 0; i < 26; i += 1) {
    const x = -5.4 + i * 0.45;
    const y = 4.6 + Math.sin(i * 0.9) * 0.35;
    const light = new THREE.Mesh(fairyGeo, fairyMat);
    light.position.set(x, y, -4.9);
    scene.add(light);
  }

  /* ------------------------------------------------------------ drum kit */
  // Registry: every playable drum gets a group, squashable head meshes,
  // a wobble group (cymbals), a glow ring, and the meshes raycasting hits.
  const drums = {};
  const hitMeshes = [];

  // Invisible thumb-sized hit targets: a tap that lands *near* a drum
  // should hit it. Each sphere is ~1.6x the drum, raycast like the drum
  // itself, and renders nothing (opacity 0 + no colour write).
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  hitMat.colorWrite = false;
  function addHitTarget(id, x, y, z, radius) {
    const target = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), hitMat);
    target.position.set(x, y, z);
    target.castShadow = false;
    target.receiveShadow = false;
    target.userData.drumId = id;
    scene.add(target);
    hitMeshes.push(target);
    return target;
  }

  function registerDrum(id, group, { heads = [], wobble = null } = {}) {
    // Heads share one glow material — except a head with a painted texture
    // (the kick front), which keeps its map and gets a cloned glow material.
    const glowMats = [];
    for (const head of heads) {
      if (head.material && head.material.map) {
        head.material = head.material.clone();
        head.material.emissive = new THREE.Color(DRUM_COLORS[id]);
        head.material.emissiveIntensity = 0;
        glowMats.push(head.material);
      }
    }
    const plainHeads = heads.filter((head) => !head.material.map);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0e6,
      roughness: 0.55,
      emissive: new THREE.Color(DRUM_COLORS[id]),
      emissiveIntensity: 0,
    });
    for (const head of plainHeads) head.material = headMat;
    glowMats.push(headMat);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.12, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf4c95d,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.visible = false;
    group.add(ring);
    drums[id] = {
      id,
      group,
      heads,
      glowMats,
      wobble,
      wobbleBase: wobble ? wobble.rotation.clone() : null,
      ring,
      hitAt: -10,
      glowing: false,
    };
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.drumId = id;
        hitMeshes.push(child);
      }
    });
    return drums[id];
  }

  function pole(x, z, height, parent = scene) {
    return mesh(new THREE.CylinderGeometry(0.03, 0.03, height, 12), chrome, x, height / 2, z, parent);
  }

  function tripod(x, z, y = 0) {
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      const leg = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), chrome, 0, 0, 0);
      leg.position.set(x + Math.cos(angle) * 0.16, y + 0.16, z + Math.sin(angle) * 0.16);
      leg.rotation.z = Math.cos(angle) * 0.5;
      leg.rotation.x = -Math.sin(angle) * 0.5;
    }
  }

  // Kick drum front-head art: white head, red ring, "DRUM QUEST" + star.
  function kickHeadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d92038';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d92038';
    ctx.font = 'bold 34px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DRUM', 128, 96);
    ctx.fillText('QUEST', 128, 134);
    ctx.font = 'bold 44px "Courier New", ui-monospace, monospace';
    ctx.fillText('★', 128, 184);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // --- Kick: big, front and centre, facing the camera. ---
  const kick = new THREE.Group();
  kick.position.set(0, 0.55, 0.85);
  scene.add(kick);
  const kickShell = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 48), shellRed, 0, 0, 0, kick);
  kickShell.rotation.x = Math.PI / 2;
  const kickFront = mesh(
    new THREE.CircleGeometry(0.52, 48),
    new THREE.MeshStandardMaterial({ map: kickHeadTexture(), roughness: 0.55 }),
    0,
    0,
    0.26,
    kick,
  );
  mesh(new THREE.CircleGeometry(0.52, 48), whiteHead, 0, 0, -0.26, kick).rotation.y = Math.PI;
  for (const side of [-1, 1]) {
    const rimT = mesh(new THREE.TorusGeometry(0.55, 0.03, 12, 48), chrome, 0, 0, side * 0.25, kick);
    rimT.castShadow = false;
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), chrome, side * 0.5, -0.35, 0.1, kick);
    leg.rotation.z = side * 0.5;
  }
  registerDrum('kick', kick, { heads: [kickFront] });
  drums.kick.ring.position.set(0, 0, 0.32);
  drums.kick.ring.scale.setScalar(0.55);
  addHitTarget('kick', 0, 0.55, 0.85, 0.88);

  // --- Snare: left front, tilted toward Joel. Enlarged so a thumb lands it. ---
  const snare = new THREE.Group();
  snare.position.set(-0.88, 0.8, 0.5);
  snare.rotation.set(-0.14, 0, 0.1);
  scene.add(snare);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 40), shellRed, 0, 0, 0, snare);
  const snareHead = mesh(new THREE.CircleGeometry(0.34, 40), whiteHead, 0, 0.11, 0, snare);
  snareHead.rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.36, 0.025, 12, 40), chrome, 0, 0.11, 0, snare).rotation.x = Math.PI / 2;
  pole(-0.88, 0.5, 0.8);
  tripod(-0.88, 0.5);
  registerDrum('snare', snare, { heads: [snareHead] });
  drums.snare.ring.position.set(0, 0.16, 0);
  drums.snare.ring.rotation.x = -Math.PI / 2;
  drums.snare.ring.scale.setScalar(0.4);
  addHitTarget('snare', -0.88, 0.8, 0.5, 0.58);

  // --- Hi-hat: far left, two brass cymbals on a stand. Enlarged ~25%. ---
  const hihat = new THREE.Group();
  hihat.position.set(-1.42, 0.98, 0.3);
  scene.add(hihat);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 40), brass, 0, 0, 0, hihat);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 40), brass, 0, 0.05, 0, hihat);
  pole(-1.42, 0.3, 0.98);
  tripod(-1.42, 0.3);
  registerDrum('hihat', hihat, { wobble: hihat });
  drums.hihat.ring.position.set(0, 0.12, 0);
  drums.hihat.ring.rotation.x = -Math.PI / 2;
  drums.hihat.ring.scale.setScalar(0.4);
  addHitTarget('hihat', -1.42, 0.98, 0.3, 0.62);

  // --- Rack toms: two angled toms over the kick. Enlarged ~25%. ---
  function rackTom(x, tiltZ) {
    const tom = new THREE.Group();
    tom.position.set(x, 1.16, 0.05);
    tom.rotation.set(0.38, 0, tiltZ);
    scene.add(tom);
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 32), shellRed, 0, 0, 0, tom);
    const head = mesh(new THREE.CircleGeometry(0.28, 32), whiteHead, 0, 0.18, 0, tom);
    head.rotation.x = -Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.3, 0.02, 10, 32), chrome, 0, 0.18, 0, tom).rotation.x = Math.PI / 2;
    return tom;
  }
  const tomL = rackTom(-0.42, 0.16);
  const tomR = rackTom(0.42, -0.16);
  const tomHeads = [];
  tomL.traverse((c) => {
    if (c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry') tomHeads.push(c);
  });
  tomR.traverse((c) => {
    if (c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry') tomHeads.push(c);
  });
  // Floor tom, right side. Enlarged ~25% too.
  const floorTom = new THREE.Group();
  floorTom.position.set(1.02, 0.5, 0.1);
  scene.add(floorTom);
  mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 40), shellRed, 0, 0, 0, floorTom);
  const floorHead = mesh(new THREE.CircleGeometry(0.32, 40), whiteHead, 0, 0.26, 0, floorTom);
  floorHead.rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.34, 0.025, 12, 40), chrome, 0, 0.26, 0, floorTom).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2;
    mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8),
      chrome,
      Math.cos(angle) * 0.32,
      -0.3,
      Math.sin(angle) * 0.32,
      floorTom,
    );
  }
  tomHeads.push(floorHead);
  // One shared 'tom' entry covering all three tom drums.
  const tomGroup = new THREE.Group();
  tomGroup.add(tomL);
  tomGroup.add(tomR);
  tomGroup.add(floorTom);
  scene.add(tomGroup);
  registerDrum('tom', tomGroup, { heads: tomHeads });
  drums.tom.ring.position.set(0, 1.4, 0.1);
  drums.tom.ring.rotation.x = -Math.PI / 2;
  drums.tom.ring.scale.setScalar(0.55);
  addHitTarget('tom', -0.42, 1.16, 0.05, 0.48);
  addHitTarget('tom', 0.42, 1.16, 0.05, 0.48);
  addHitTarget('tom', 1.02, 0.5, 0.1, 0.54);

  // --- Cymbals: crash left, ride right (ride plays crash too). Brought
  // lower and closer so they sit in thumb reach, not far up in a corner. ---
  function cymbal(x, y, z, radius, tiltZ, drumId) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.set(-0.12, 0, tiltZ);
    scene.add(group);
    mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 0.02, 48), brass, 0, 0, 0, group);
    mesh(new THREE.SphereGeometry(0.05, 12, 8), brass, 0, 0.03, 0, group);
    pole(x, z, y);
    tripod(x, z);
    return group;
  }
  const crashGroup = cymbal(-1.22, 1.72, 0.0, 0.48, 0.22, 'crash');
  const rideGroup = cymbal(1.28, 1.62, 0.0, 0.54, -0.2, 'crash');
  // Ride shares the crash entry: tapping it plays the crash.
  const crashRingGroup = new THREE.Group();
  crashRingGroup.add(crashGroup);
  crashRingGroup.add(rideGroup);
  scene.add(crashRingGroup);
  registerDrum('crash', crashRingGroup, { wobble: crashGroup });
  drums.crash.ring.position.set(-1.22, 1.8, 0.0);
  drums.crash.ring.rotation.x = -Math.PI / 2;
  drums.crash.ring.scale.setScalar(0.52);
  // Cymbals get the biggest hit zones of all — they were the tiny
  // far-away targets before.
  addHitTarget('crash', -1.22, 1.72, 0.0, 0.78);
  addHitTarget('crash', 1.28, 1.62, 0.0, 0.86);
  // Ride wobbles with the crash.
  drums.crash.rideGroup = rideGroup;
  drums.crash.rideBase = rideGroup.rotation.clone();

  /* ------------------------------------------------------------- Joel */
  const joel = new THREE.Group();
  joel.position.set(0, 0, -0.62);
  scene.add(joel);

  // Stool.
  mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), darkMetal, 0, 0.56, 0, joel);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 12), chrome, 0, 0.28, 0, joel);

  // Body: teal shirt, seated.
  const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.32, 6, 16), shirt, 0, 1.06, 0, joel);
  torso.rotation.x = 0.08;
  mesh(new THREE.CapsuleGeometry(0.2, 0.2, 6, 12), pants, -0.16, 0.68, 0.18, joel).rotation.x = 1.2;
  mesh(new THREE.CapsuleGeometry(0.2, 0.2, 6, 12), pants, 0.16, 0.68, 0.18, joel).rotation.x = 1.2;

  // Head + red mohawk + grin missing his front teeth.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0.02);
  joel.add(headGroup);
  mesh(new THREE.SphereGeometry(0.27, 32, 24), skin, 0, 0, 0, headGroup);
  for (let i = -2; i <= 2; i += 1) {
    const spike = mesh(
      new THREE.ConeGeometry(0.07, 0.22 - Math.abs(i) * 0.03, 8),
      mat(0xe63946, { roughness: 0.5 }),
      0,
      0.3,
      i * 0.1,
      headGroup,
    );
    spike.rotation.x = -i * 0.28;
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(0x1a1022, { roughness: 0.3 }), side * 0.1, 0.03, 0.24, headGroup).castShadow = false;
    mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(0xf08fa4, { roughness: 0.6 }), side * 0.18, -0.08, 0.2, headGroup).castShadow = false;
  }
  // Grin: dark smile with two teeth and a gap where the front teeth are gone.
  const mouth = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), mat(0x7a3b2e, { roughness: 0.6 }), 0, -0.12, 0.25, headGroup);
  mouth.castShadow = false;
  for (const side of [-1, 1]) {
    const tooth = mesh(new THREE.BoxGeometry(0.05, 0.045, 0.01), mat(0xffffff, { roughness: 0.4 }), side * 0.07, -0.1, 0.26, headGroup);
    tooth.castShadow = false;
  }

  // Arms + sticks, pivoted at the shoulders so they can swing.
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 1.32, 0.08);
    joel.add(shoulder);
    const arm = mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.42, 12), shirt, 0, -0.18, 0.08, shoulder);
    arm.rotation.x = 0.5;
    const hand = mesh(new THREE.SphereGeometry(0.06, 12, 8), skin, 0, -0.38, 0.2, shoulder);
    hand.castShadow = false;
    const stick = mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.58, 8), wood, 0, -0.5, 0.32, shoulder);
    stick.rotation.x = 1.1;
    return { group: shoulder, restX: -0.25, strikeAt: -10, peak: 0 };
  }
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  leftArm.group.rotation.x = -0.25;
  rightArm.group.rotation.x = -0.25;

  // Right foot on the kick pedal.
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.72, 0.1);
  joel.add(rightLeg);
  mesh(new THREE.CapsuleGeometry(0.09, 0.3, 6, 10), pants, 0, -0.2, 0.28, rightLeg).rotation.x = 1.1;
  const foot = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), mat(0xffffff, { roughness: 0.6 }), 0, -0.42, 0.48, rightLeg);
  foot.castShadow = false;
  mesh(new THREE.BoxGeometry(0.16, 0.03, 0.3), darkMetal, 0.2, 0.14, 0.72, scene).rotation.x = 0.25;

  /* ------------------------------------------------------- drum labels */
  function makeLabel(text, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 4, 24, 0.72)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(6, 8, 244, 64, 18);
    else ctx.rect(6, 8, 244, 64);
    ctx.fill();
    ctx.strokeStyle = '#f4c95d';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#f9eddf';
    ctx.font = 'bold 34px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 42);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(0.72, 0.23, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    return sprite;
  }
  // Labels sit in the gaps above/beside their drums, never on a head,
  // and they are sprites — never raycast targets, so they can't block a tap.
  makeLabel(DRUM_LABELS.kick, 0, 1.38, 1.08);
  makeLabel(DRUM_LABELS.snare, -0.95, 1.26, 0.68);
  makeLabel(DRUM_LABELS.hihat, -1.5, 1.44, 0.42);
  makeLabel(DRUM_LABELS.tom, 0, 2.02, 0.1);
  makeLabel(DRUM_LABELS.crash, -1.22, 2.2, -0.05);
  makeLabel('RIDE', 1.28, 2.1, -0.05);

  /* -------------------------------------------------- hits, glow, sticks */
  const clock = new THREE.Clock();
  let elapsed = 0;
  let headNodAt = -10;

  function strike(drumId) {
    const arm = STRIKE_ARM[drumId];
    const now = elapsed;
    if (arm === 'left') leftArm.strikeAt = now;
    else if (arm === 'right') rightArm.strikeAt = now;
    else if (arm === 'foot') rightLeg.userData.pressAt = now;
    headNodAt = now;
  }

  function hit(drumId) {
    const drum = drums[drumId];
    if (!drum) return;
    drum.hitAt = elapsed;
    strike(drumId);
  }

  function setGlow(drumId, on) {
    const drum = drums[drumId];
    if (!drum) return;
    drum.glowing = on;
    drum.ring.visible = on;
  }

  function clearGlow() {
    for (const drum of Object.values(drums)) {
      drum.glowing = false;
      drum.ring.visible = false;
    }
  }

  /* ------------------------------------------------------------ raycast */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickDrum(event) {
    const rect = renderer.domElement.getBoundingClientRect();
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

  /* ------------------------------------------------------------ resize */
  function resize() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    // Phone portrait: widen the lens a little instead of pulling the
    // camera back — the kit stays close and thumb-sized, and the outer
    // drums (hi-hat, ride) stay inside the frame.
    const baseFov = aspect < 1.0 ? 56 : aspect < 1.2 ? 50 : 46;
    // Zoom moves the camera, not the lens: keep the wide lens so the
    // zoomed close-up still shows the whole width of the kit.
    fovTarget = baseFov;
    camTarget.copy(zoomed ? CAM_ZOOM : CAM_BASE);
    lookTarget.copy(zoomed ? LOOK_ZOOM : LOOK_BASE);
    camera.fov = fovTarget;
    camera.updateProjectionMatrix();
  }

  function setZoomed(next) {
    zoomed = Boolean(next);
    resize();
  }
  window.addEventListener('resize', resize);
  resize();

  /* --------------------------------------------------------- animate */
  function armSwing(arm, now) {
    const age = now - arm.strikeAt;
    if (age < 0 || age > 0.3) {
      arm.group.rotation.x += (arm.restX - arm.group.rotation.x) * 0.2;
      return;
    }
    // Quick down-strike, then back up: sin curve over 0.3s.
    arm.group.rotation.x = arm.restX - 0.85 * Math.sin((age / 0.3) * Math.PI);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const now = elapsed;

    // Camera: eases toward its target (normal or zoomed) with a very
    // subtle idle sway. The sway is an offset, not a drift.
    tmpPos.copy(camTarget);
    if (!reducedMotion) {
      tmpPos.x += Math.sin(now * 0.3) * 0.07;
      tmpPos.y += Math.sin(now * 0.5) * 0.03;
    }
    camera.position.lerp(tmpPos, reducedMotion ? 1 : 0.08);
    camera.fov += (fovTarget - camera.fov) * (reducedMotion ? 1 : 0.08);
    camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);

    // Joel bobs gently; a quick nod on every hit.
    const nodAge = now - headNodAt;
    const nod = nodAge >= 0 && nodAge < 0.25 ? Math.sin((nodAge / 0.25) * Math.PI) * 0.12 : 0;
    headGroup.rotation.x = nod;
    headGroup.position.y = 1.56 + (reducedMotion ? 0 : Math.sin(now * 1.4) * 0.02);
    joel.position.y = reducedMotion ? 0 : Math.sin(now * 2.8) * 0.008;

    armSwing(leftArm, now);
    armSwing(rightArm, now);
    const pressAge = now - (rightLeg.userData.pressAt || -10);
    rightLeg.rotation.x =
      pressAge >= 0 && pressAge < 0.25 ? -0.22 * Math.sin((pressAge / 0.25) * Math.PI) : 0;

    // Per-drum hit animation: head squash + rim flash, cymbal wobble.
    for (const drum of Object.values(drums)) {
      const age = now - drum.hitAt;
      const squash = age >= 0 && age < 0.22 ? 1 + 0.1 * (1 - age / 0.22) : 1;
      for (const head of drum.heads) head.scale.set(squash, squash, 1);
      const flash = age >= 0 && age < 0.35 ? 0.85 * (1 - age / 0.35) : 0;
      const glow = drum.glowing ? 0.45 + 0.25 * Math.sin(now * 6) : 0;
      for (const glowMat of drum.glowMats) glowMat.emissiveIntensity = Math.max(flash, glow);
      if (drum.glowing) drum.ring.material.opacity = 0.45 + 0.3 * Math.sin(now * 6);
      else if (flash > 0) {
        drum.ring.visible = true;
        drum.ring.material.opacity = flash;
      } else {
        drum.ring.visible = false;
      }
      if (drum.wobble && drum.wobbleBase) {
        const wobble = age >= 0 && age < 1.2 ? Math.sin(now * 20) * 0.1 * Math.exp(-3.5 * age) : 0;
        drum.wobble.rotation.z = drum.wobbleBase.z + wobble;
        drum.wobble.rotation.x = drum.wobbleBase.x + wobble * 0.5;
      }
      if (drum.rideGroup && drum.rideBase) {
        const wobble = age >= 0 && age < 1.2 ? Math.sin(now * 20 + 1) * 0.08 * Math.exp(-3.5 * age) : 0;
        drum.rideGroup.rotation.z = drum.rideBase.z + wobble;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  return { hit, setGlow, clearGlow, resize, setZoomed, isZoomed: () => zoomed };
}
