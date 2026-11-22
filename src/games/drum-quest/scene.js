/* -------------------------------------------------------------------------
 * Drum Quest — the 3D stage (Three.js).
 * House pattern, same as ball-pit / bear / claw-machine: importmap
 * "three": "https://esm.sh/three@0.168.0", MeshStandardMaterial,
 * ACES tone mapping, one shadow-casting key light, raycast taps.
 *
 * A stage with a real-looking kit (kick, snare, hi-hat, two rack toms,
 * floor tom, crash + ride cymbals) seen from directly ABOVE, like
 * other online drum sets: the kit is a floor plan on the screen, kick
 * at the bottom, cymbals across the top, Jack at the top edge. Two
 * drumsticks come in from the bottom edge — your hands — and swing
 * down onto the drum you tap. Across the kit sits Jack, your drum
 * teacher, with his own demo pad — he plays a simple beat, you play
 * it back. Tap a drum in 3D to hit it; the head squashes, the cymbal
 * wobbles, the rim flashes and your stick strikes. No flat pads anywhere.
 * Thumb-first: the camera is high above the kit, every drum has an
 * invisible hit sphere ~1.6x its size, and the game is designed for
 * two thumbs in phone portrait — no precise tapping, no hover, no
 * double-tap zoom.
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

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  // TOP-DOWN framing: the camera hangs directly above the kit and looks
  // straight down, like other online drum sets — the kit is a floor plan
  // on the screen, kick at the bottom, cymbals across the top, Jack at
  // the top edge. The camera's up vector is +z so the far side of the
  // stage (+z, Jack's side) is the top of the screen and the stool side
  // (-z) is the bottom. Phones get a wider lens so the whole kit stays
  // in frame in portrait, without pulling the camera back.
  camera.up.set(0, 0, 1);
  const CAM_BASE = new THREE.Vector3(0, 6.3, 0.7);
  const LOOK_BASE = new THREE.Vector3(0, 0, 0.45);
  const CAM_ZOOM = new THREE.Vector3(0, 4.7, 0.6);
  const LOOK_ZOOM = new THREE.Vector3(0, 0, 0.45);
  let zoomed = false;
  const camTarget = CAM_BASE.clone();
  const lookTarget = LOOK_BASE.clone();
  const tmpPos = new THREE.Vector3();
  let fovTarget = 55;
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
  blueGlow.position.set(4.5, 4.2, 2.5);
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

  // Backdrop wall and side curtains on the far side of the stage (+z,
  // Jack's side) — mostly out of frame from above, but they give the
  // room its edges if the view ever widens.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshStandardMaterial({ color: 0x120a24, roughness: 1 }),
  );
  backdrop.position.set(0, 6, 6);
  backdrop.rotation.y = Math.PI;
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  for (const side of [-1, 1]) {
    const curtain = mesh(
      new THREE.BoxGeometry(1.4, 9, 0.5),
      mat(0x5c1a24, { roughness: 0.95 }),
      side * 5.2,
      4.5,
      5.2,
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

  // Little gold fairy lights across the backdrop, ahead of the drummer.
  const fairyGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const fairyMat = new THREE.MeshBasicMaterial({ color: 0xf4c95d });
  for (let i = 0; i < 26; i += 1) {
    const x = -5.4 + i * 0.45;
    const y = 4.6 + Math.sin(i * 0.9) * 0.35;
    const light = new THREE.Mesh(fairyGeo, fairyMat);
    light.position.set(x, y, 5.9);
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

  // --- Kick: big, bottom-centre, closest to the player. Top-down the
  // shell stands upright so the painted "DRUM QUEST" head faces UP
  // toward the camera and reads as a circle. The texture is flipped
  // in-plane (rotation.z = PI) so the words read upright from above,
  // with the top of the letters toward the top of the screen.
  const kick = new THREE.Group();
  kick.position.set(0, 0.55, -0.75);
  scene.add(kick);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 48), shellRed, 0, 0, 0, kick);
  const kickFront = mesh(
    new THREE.CircleGeometry(0.52, 48),
    new THREE.MeshStandardMaterial({ map: kickHeadTexture(), roughness: 0.55 }),
    0,
    0.26,
    0,
    kick,
  );
  kickFront.rotation.set(-Math.PI / 2, 0, Math.PI);
  mesh(new THREE.CircleGeometry(0.52, 48), whiteHead, 0, -0.26, 0, kick).rotation.x =
    Math.PI / 2;
  for (const side of [-1, 1]) {
    const rimT = mesh(new THREE.TorusGeometry(0.55, 0.03, 12, 48), chrome, 0, side * 0.25, 0, kick);
    rimT.rotation.x = Math.PI / 2;
    rimT.castShadow = false;
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), chrome, side * 0.5, -0.35, 0.1, kick);
    leg.rotation.z = side * 0.5;
  }
  registerDrum('kick', kick, { heads: [kickFront] });
  drums.kick.ring.position.set(0, 0.32, 0);
  drums.kick.ring.rotation.x = -Math.PI / 2;
  drums.kick.ring.scale.setScalar(0.55);
  addHitTarget('kick', 0, 0.55, -0.75, 0.88);

  // --- Snare: left-centre from above (world +x is screen left, the
  // drummer's left), tilted slightly toward the player. Enlarged so a
  // thumb lands it. ---
  const snare = new THREE.Group();
  snare.position.set(0.8, 0.8, -0.35);
  snare.rotation.set(-0.14, 0, -0.1);
  scene.add(snare);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 40), shellRed, 0, 0, 0, snare);
  const snareHead = mesh(new THREE.CircleGeometry(0.34, 40), whiteHead, 0, 0.11, 0, snare);
  snareHead.rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.36, 0.025, 12, 40), chrome, 0, 0.11, 0, snare).rotation.x = Math.PI / 2;
  pole(0.8, -0.35, 0.8);
  tripod(0.8, -0.35);
  registerDrum('snare', snare, { heads: [snareHead] });
  drums.snare.ring.position.set(0, 0.16, 0);
  drums.snare.ring.rotation.x = -Math.PI / 2;
  drums.snare.ring.scale.setScalar(0.4);
  addHitTarget('snare', 0.8, 0.8, -0.35, 0.58);

  // --- Hi-hat: far left, two brass cymbals on a stand, head up.
  const hihat = new THREE.Group();
  hihat.position.set(1.45, 0.95, -0.05);
  scene.add(hihat);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 40), brass, 0, 0, 0, hihat);
  mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 40), brass, 0, 0.05, 0, hihat);
  pole(1.45, -0.05, 0.95);
  tripod(1.45, -0.05);
  registerDrum('hihat', hihat, { wobble: hihat });
  drums.hihat.ring.position.set(0, 0.12, 0);
  drums.hihat.ring.rotation.x = -Math.PI / 2;
  drums.hihat.ring.scale.setScalar(0.4);
  addHitTarget('hihat', 1.45, 0.95, -0.05, 0.62);

  // --- Rack toms: two toms in a row across the top-centre, heads
  // facing straight up so they read as circles from above. Enlarged.
  function rackTom(x, tiltZ) {
    const tom = new THREE.Group();
    tom.position.set(x, 1.2, 0.6);
    tom.rotation.set(0, 0, tiltZ);
    scene.add(tom);
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 32), shellRed, 0, 0, 0, tom);
    const head = mesh(new THREE.CircleGeometry(0.28, 32), whiteHead, 0, 0.18, 0, tom);
    head.rotation.x = -Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.3, 0.02, 10, 32), chrome, 0, 0.18, 0, tom).rotation.x = Math.PI / 2;
    return tom;
  }
  const tomL = rackTom(-0.45, 0.16);
  const tomR = rackTom(0.45, -0.16);
  const tomHeads = [];
  tomL.traverse((c) => {
    if (c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry') tomHeads.push(c);
  });
  tomR.traverse((c) => {
    if (c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry') tomHeads.push(c);
  });
  // Floor tom, right-centre from above (world -x is screen right),
  // head up.
  const floorTom = new THREE.Group();
  floorTom.position.set(-0.9, 0.5, -0.3);
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
  drums.tom.ring.position.set(0, 1.45, 0.6);
  drums.tom.ring.rotation.x = -Math.PI / 2;
  drums.tom.ring.scale.setScalar(0.55);
  // Tom hit spheres are a touch bigger than before so the smallest
  // drums still clear 80px on a phone in top-down view.
  addHitTarget('tom', -0.45, 1.2, 0.6, 0.55);
  addHitTarget('tom', 0.45, 1.2, 0.6, 0.55);
  addHitTarget('tom', -0.9, 0.5, -0.3, 0.58);

  // --- Cymbals: crash top-left, ride top-right, flat brass circles
  // lying in the horizontal plane.
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
  const crashGroup = cymbal(1.25, 1.85, 0.85, 0.48, -0.22, 'crash');
  const rideGroup = cymbal(-1.25, 1.85, 0.85, 0.54, 0.2, 'crash');
  // Ride shares the crash entry: tapping it plays the crash.
  const crashRingGroup = new THREE.Group();
  crashRingGroup.add(crashGroup);
  crashRingGroup.add(rideGroup);
  scene.add(crashRingGroup);
  registerDrum('crash', crashRingGroup, { wobble: crashGroup });
  drums.crash.ring.position.set(1.25, 1.93, 0.85);
  drums.crash.ring.rotation.x = -Math.PI / 2;
  drums.crash.ring.scale.setScalar(0.52);
  // Cymbals get the biggest hit zones of all — they were the tiny
  // far-away targets before.
  addHitTarget('crash', 1.25, 1.85, 0.85, 0.78);
  addHitTarget('crash', -1.25, 1.85, 0.85, 0.86);
  // Ride wobbles with the crash.
  drums.crash.rideGroup = rideGroup;
  drums.crash.rideBase = rideGroup.rotation.clone();

  /* --------------------------------------- top-down drummer */
  // You sit at the bottom edge of the screen, behind the kick — so
  // your body, head and stool are not built at all, or they would block
  // the view. Only the kick pedal below the kick and the sticks coming
  // in from the bottom edge are visible.
  const kickPedal = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.3), darkMetal, 0.2, 0.14, -1.2, scene);
  kickPedal.rotation.x = 0.25;

  /* ------------------------------------------------- top-down sticks */
  // Your hands, at the bottom edge of the frame: two sticks angled in
  // from the bottom-left and bottom-right, tips hovering over the kit.
  // They swing down onto whichever drum is hit — left stick for the
  // snare/hi-hat side, right stick for the tom/crash side. The pivot
  // rotates around x so a strike drives the tip straight down onto the
  // head. They are never raycast targets, so they can't block a tap.
  function makeTopStick(side) {
    const pivot = new THREE.Group();
    // World +x is screen left, so the left stick (side -1) sits at +x.
    // Pivots sit at the bottom edge of the frame, close to the middle,
    // or the sticks fall outside the portrait frame.
    pivot.position.set(side * -0.55, 1.55, -1.85);
    scene.add(pivot);
    const hand = mesh(new THREE.SphereGeometry(0.07, 12, 8), skin, 0, 0, 0, pivot);
    hand.castShadow = false;
    const stick = mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.8, 8), wood, 0, -0.08, 0.4, pivot);
    stick.rotation.x = Math.PI / 2 - 0.35;
    return { group: pivot, restX: 0, strikeAt: -10 };
  }
  const stickLeft = makeTopStick(-1);
  const stickRight = makeTopStick(1);

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
  // Labels sit in the gaps beside their drums, never on a head, at a
  // low height so they don't drift far from their drum in top-down.
  // They are sprites — never raycast targets, so they can't block a tap.
  makeLabel(DRUM_LABELS.kick, 0, 1.05, -1.5);
  makeLabel(DRUM_LABELS.snare, 0.85, 1.05, -0.8);
  makeLabel(DRUM_LABELS.hihat, 1.55, 1.05, -0.55);
  makeLabel(DRUM_LABELS.tom, 0, 1.05, 1.15);
  makeLabel(DRUM_LABELS.crash, 1.25, 1.05, 1.5);
  makeLabel('RIDE', -1.25, 1.05, 1.5);

  /* --------------------------------------------------- Jack, the teacher */
  // Jack sits at the top edge of the frame, beyond the kit, so he is
  // visible in top-down view: a friendly instructor with his own little
  // demo pad. When he plays a beat, HIS sticks strike HIS pad (and your
  // matching drum lights up) — it is always obvious it is Jack playing,
  // not your sticks. He is built from the same simple primitives as the
  // kit, facing back toward the player (-z), so his face is toward the
  // bottom of the screen.
  const jack = new THREE.Group();
  jack.position.set(0, 0, 2.5);
  scene.add(jack);
  // Stool.
  mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 24), darkMetal, 0, 0.56, 0, jack);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.56, 12), chrome, 0, 0.28, 0, jack);
  // Body: warm orange shirt, so he reads as a different person from you.
  const jackShirt = mat(0xff8c42, { roughness: 0.75 });
  mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.6, 24), jackShirt, 0, 1.05, 0, jack);
  // Head, hair, cap, and a face on the -z side (toward the camera).
  const jackHead = new THREE.Group();
  jackHead.position.set(0, 1.56, 0);
  jack.add(jackHead);
  mesh(new THREE.SphereGeometry(0.24, 32, 24), skin, 0, 0, 0, jackHead);
  // Brown hair on top, and a teal cap with a brim pointing at you.
  const jackHair = mesh(new THREE.SphereGeometry(0.245, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(0x5b3a29, { roughness: 0.85 }), 0, 0.02, 0, jackHead);
  jackHair.scale.set(1, 0.9, 1);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 24), mat(0x2ec4b6, { roughness: 0.7 }), 0, 0.2, 0, jackHead);
  const jackBrim = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.18), mat(0x2ec4b6, { roughness: 0.7 }), 0, 0.17, -0.26, jackHead);
  jackBrim.castShadow = false;
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.032, 12, 8), mat(0x1a1022, { roughness: 0.3 }), side * 0.09, 0.03, -0.21, jackHead).castShadow = false;
    mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(0xf08fa4, { roughness: 0.6 }), side * 0.16, -0.07, -0.19, jackHead).castShadow = false;
  }
  // Smile: a thin dark arc facing the camera.
  const jackSmile = mesh(new THREE.TorusGeometry(0.07, 0.013, 8, 24, Math.PI), mat(0x1a1022, { roughness: 0.5 }), 0, -0.08, -0.21, jackHead);
  jackSmile.rotation.x = Math.PI;
  jackSmile.rotation.y = Math.PI;
  jackSmile.castShadow = false;
  makeLabel('JACK', 0, 1.2, 2.85);
  // Jack's demo pad: a small blue drum on a stand in front of him,
  // in the gap between the cymbals and Jack himself so you can see it.
  const jackPad = new THREE.Group();
  jackPad.position.set(0, 0.95, 2.0);
  scene.add(jackPad);
  mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 32), mat(0x2b6cb0, { roughness: 0.3, metalness: 0.3 }), 0, 0, 0, jackPad);
  const jackPadHead = mesh(new THREE.CircleGeometry(0.26, 32), whiteHead, 0, 0.08, 0, jackPad);
  jackPadHead.rotation.x = -Math.PI / 2;
  pole(0, 2.0, 0.9);
  tripod(0, 2.0);
  // Jack's arms: shoulder pivots, hands and sticks reaching forward
  // and down toward his pad (which sits at -z from him).
  function makeJackArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.32, -0.05);
    jack.add(pivot);
    mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.42, 12), jackShirt, 0, -0.18, -0.08, pivot);
    mesh(new THREE.SphereGeometry(0.06, 12, 8), skin, 0, -0.38, -0.2, pivot);
    const stick = mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.55, 8), wood, 0, -0.48, -0.32, pivot);
    stick.rotation.x = 1.5;
    stick.rotation.z = side * -0.1;
    return { group: pivot, restX: 0, strikeAt: -10 };
  }
  const jackLeft = makeJackArm(-1);
  const jackRight = makeJackArm(1);
  let jackPlaying = false;
  let jackCheerAt = -10;

  /** Jack plays one hit on his demo pad — his stick, not yours. */
  function jackHit(drumId) {
    const arm = STRIKE_ARM[drumId];
    if (arm === 'left') jackLeft.strikeAt = elapsed;
    else jackRight.strikeAt = elapsed;
    jackPadHead.scale.set(1.12, 1.12, 1);
  }

  function setJackPlaying(on) {
    jackPlaying = Boolean(on);
  }

  /** Jack celebrates: both sticks up and a little hop. */
  function jackCheer() {
    jackCheerAt = elapsed;
  }

  /* -------------------------------------------------- hits, glow, sticks */
  const clock = new THREE.Clock();
  let elapsed = 0;
  let pedalPressAt = -10;
  let kickDipAt = -10;

  function strike(drumId) {
    const arm = STRIKE_ARM[drumId];
    const now = elapsed;
    if (arm === 'left') stickLeft.strikeAt = now;
    else if (arm === 'right') stickRight.strikeAt = now;
    else if (arm === 'foot') {
      pedalPressAt = now;
      kickDipAt = now;
    }
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
    // Top-down on a phone: a wide lens so the whole kit (hi-hat to
    // ride, kick to Jack) stays in frame in portrait, without pulling
    // the camera back.
    const baseFov = aspect < 1.0 ? 55 : aspect < 1.2 ? 52 : 50;
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
  // Top-down sticks: a quick down-strike, then back up, sin curve
  // over 0.3s. The pivot rotates +x to drive the tip down toward the kit.
  function stickSwing(stick, now) {
    const age = now - stick.strikeAt;
    if (age < 0 || age > 0.3) {
      stick.group.rotation.x += (stick.restX - stick.group.rotation.x) * 0.2;
      return;
    }
    stick.group.rotation.x = stick.restX + 0.45 * Math.sin((age / 0.3) * Math.PI);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const now = elapsed;

    // Camera: eases toward its target (normal or zoomed) with a very
    // subtle idle sway. The sway is an offset, not a drift. A kick hit
    // dips the view a touch, like the stool thumping.
    tmpPos.copy(camTarget);
    if (!reducedMotion) {
      tmpPos.x += Math.sin(now * 0.3) * 0.07;
      tmpPos.y += Math.sin(now * 0.5) * 0.03;
    }
    const dipAge = now - kickDipAt;
    if (dipAge >= 0 && dipAge < 0.25) {
      tmpPos.y -= 0.05 * Math.sin((dipAge / 0.25) * Math.PI);
    }
    camera.position.lerp(tmpPos, reducedMotion ? 1 : 0.08);
    camera.fov += (fovTarget - camera.fov) * (reducedMotion ? 1 : 0.08);
    camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);

    // Your sticks swing on every hit; the kick pedal presses on a kick.
    stickSwing(stickLeft, now);
    stickSwing(stickRight, now);

    // Jack: while he is teaching, his head bobs to the beat; on a
    // strike his stick swings down onto his demo pad, and the pad head
    // squash eases back. On a cheer he hops with both sticks up.
    const cheerAge = now - jackCheerAt;
    if (cheerAge >= 0 && cheerAge < 0.9) {
      jack.position.y = 0.16 * Math.sin((cheerAge / 0.9) * Math.PI);
      jackLeft.group.rotation.x = -0.9;
      jackRight.group.rotation.x = -0.9;
    } else {
      jack.position.y = 0;
      jackHead.position.y = 1.56 + (jackPlaying && !reducedMotion ? Math.sin(now * 4) * 0.02 : 0);
      jackHead.rotation.x = jackPlaying && !reducedMotion ? 0.06 * Math.sin(now * 4) : 0;
      stickSwing(jackLeft, now);
      stickSwing(jackRight, now);
    }
    const padScale = jackPadHead.scale.x;
    if (padScale > 1) jackPadHead.scale.set(Math.max(1, padScale - dt * 2.5), Math.max(1, padScale - dt * 2.5), 1);
    const pressAge = now - pedalPressAt;
    kickPedal.rotation.x =
      0.25 + (pressAge >= 0 && pressAge < 0.25 ? 0.18 * Math.sin((pressAge / 0.25) * Math.PI) : 0);

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

  return { hit, setGlow, clearGlow, resize, setZoomed, isZoomed: () => zoomed, jackHit, setJackPlaying, jackCheer };
}
