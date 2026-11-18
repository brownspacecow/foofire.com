import * as THREE from 'three';

// A snow-covered town square with a big launchable tree in the middle.
// The scene is deliberately low-poly: flat colour, warm windows, and snow.

const TIERS = [
  { base: 0, height: 2.1, radius: 2.9 },
  { base: 1.25, height: 1.9, radius: 2.45 },
  { base: 2.4, height: 1.8, radius: 2.05 },
  { base: 3.5, height: 1.7, radius: 1.65 },
  { base: 4.5, height: 1.6, radius: 1.25 },
  { base: 5.4, height: 1.4, radius: 0.8 },
];
const SLOT_RINGS = 5;
const SLOTS_PER_RING = 8;
export const TREE_TOP = 7.1;

const LANDMARKS = [
  { id: 'gingerbread-row', name: 'Gingerbread Row', angle: 0, radius: 16, style: 'gable', color: '#8c5a3c', roof: '#fff4ea', accent: '#ff8fc7' },
  { id: 'cocoa-factory', name: 'Cocoa Factory', angle: 30, radius: 17.5, style: 'factory', color: '#6b3f2a', roof: '#c98a5c', accent: '#ffd93d' },
  { id: 'clock-tower', name: 'Clock Tower', angle: 60, radius: 18, style: 'tower', color: '#4b5a8a', roof: '#2d3561', accent: '#ffd93d' },
  { id: 'snowman-park', name: 'Snowman Park', angle: 90, radius: 15.5, style: 'park', color: '#dfe9ff', roof: '#a5d8ff', accent: '#ff8a00' },
  { id: 'ice-rink', name: 'Ice Rink', angle: 120, radius: 16, style: 'rink', color: '#a5d8ff', roof: '#7dd3fc', accent: '#2ec4ff' },
  { id: 'post-office', name: 'Post Office', angle: 150, radius: 17, style: 'gable', color: '#2d6cdf', roof: '#e8f1ff', accent: '#ffd93d' },
  { id: 'library', name: 'Library', angle: 180, radius: 18.5, style: 'gable', color: '#7b2d3a', roof: '#fff4ea', accent: '#ffd93d' },
  { id: 'firehouse', name: 'Firehouse', angle: 210, radius: 16.5, style: 'flat', color: '#b4232f', roof: '#5b1620', accent: '#ffd93d' },
  { id: 'observatory', name: 'Observatory', angle: 240, radius: 18, style: 'dome', color: '#dfe9ff', roof: '#8fa8d8', accent: '#2ec4ff' },
  { id: 'bakery', name: 'Bakery', angle: 270, radius: 16, style: 'shop', color: '#f0d9b5', roof: '#d9a066', accent: '#ff5d8f' },
  { id: 'toy-workshop', name: 'Toy Workshop', angle: 300, radius: 17.5, style: 'gable', color: '#2f7d5b', roof: '#ffd93d', accent: '#ff2e63' },
  { id: 'train-station', name: 'Train Station', angle: 330, radius: 18, style: 'station', color: '#8b5a3c', roof: '#3f2a1d', accent: '#ffd93d' },
];

const MATERIALS = new Map();
function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...options })
    );
  }
  return MATERIALS.get(key);
}

const WINDOW_MAT = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
const WINDOW_OFF_MAT = new THREE.MeshStandardMaterial({ color: '#2b3358', roughness: 0.9 });
const BULB_GEO = new THREE.SphereGeometry(0.055, 8, 6);
const BULB_COLORS = ['#ffd93d', '#ff5d8f', '#2ec4ff', '#3ddc84', '#ff8a00'];

function box(parent, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cone(parent, material, x, y, z, radius, height, segments = 16, rotate = 0) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotate;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, material, x, y, z, top, bottom, height, segments = 14, rx = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.rotation.z = rz;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(parent, material, x, y, z, radius, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? 1 : 0.45;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

// ---------------------------------------------------------------- buildings
function addWindows(group, width, height, depth, rows, columns) {
  const warm = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = ((col + 0.5) / columns - 0.5) * width * 0.72;
      const y = 0.55 + (row / Math.max(1, rows)) * (height * 0.45);
      const w = new THREE.Mesh(new THREE.BoxGeometry(width * 0.13, height * 0.14, 0.04), WINDOW_MAT);
      w.position.set(x, y, depth / 2 + 0.02);
      group.add(w);
      warm.push(w);
    }
  }
  return warm;
}

function makeSnowman(scale = 1) {
  const g = new THREE.Group();
  const snow = mat('#f4faff', { roughness: 0.95 });
  sphere(g, snow, 0, 0.32, 0, 0.32);
  sphere(g, snow, 0, 0.72, 0, 0.24);
  sphere(g, snow, 0, 1.03, 0, 0.17);
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), mat('#ff8a00'));
  carrot.rotation.x = Math.PI / 2;
  carrot.position.set(0, 1.03, 0.2);
  g.add(carrot);
  const coal = mat('#241a2e');
  [-0.06, 0.06].forEach((x) => sphere(g, coal, x, 1.08, 0.15, 0.022));
  [0.02, -0.08].forEach((y) => sphere(g, coal, 0, 0.72 + y, 0.22, 0.024));
  cylinder(g, coal, 0, 1.22, 0, 0.16, 0.16, 0.03, 12);
  cylinder(g, coal, 0, 1.3, 0, 0.11, 0.11, 0.14, 12);
  const scarf = mat('#d62828');
  cylinder(g, scarf, 0, 0.9, 0, 0.19, 0.19, 0.06, 12);
  box(g, scarf, 0.13, 0.8, 0.1, 0.07, 0.16, 0.04, 0, 0, 0.25);
  g.scale.setScalar(scale);
  return g;
}

function makeBuilding(spec) {
  const group = new THREE.Group();
  const color = mat(spec.color);
  const roof = mat(spec.roof);
  const accent = mat(spec.accent);
  const trim = mat('#fff4ea');
  const width = spec.style === 'factory' ? 3.6 : 3.4;
  const depth = 2.8;
  let height = 2.7;

  if (spec.style === 'tower') height = 4.6;
  if (spec.style === 'factory') height = 3.4;
  if (spec.style === 'flat') height = 2.3;
  if (spec.style === 'station') height = 2.2;
  if (spec.style === 'dome') height = 2.6;

  if (spec.style === 'rink') {
    const ice = new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), mat('#bfe9ff', { roughness: 0.2, metalness: 0.1 }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.y = 0.06;
    group.add(ice);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.06, 6, 40), mat('#ffd93d'));
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 0.45;
    group.add(rail);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      cylinder(group, WOOD_MAT, Math.cos(angle) * 3.05, 0.24, Math.sin(angle) * 3.05, 0.05, 0.06, 0.42);
      const bulb = new THREE.Mesh(BULB_GEO, new THREE.MeshBasicMaterial({ color: BULB_COLORS[i % BULB_COLORS.length] }));
      bulb.position.set(Math.cos(angle) * 3.05, 0.5, Math.sin(angle) * 3.05);
      group.add(bulb);
    }
    group.add(makeSnowman(0.7));
    const bench = box(group, WOOD_MAT, 2.2, 0.35, 2.4, 0.9, 0.08, 0.35);
    bench.rotation.y = 0.4;
    return group;
  }

  if (spec.style === 'park') {
    for (let i = 0; i < 3; i += 1) {
      const snowman = makeSnowman(0.7 + i * 0.08);
      snowman.position.set(-1.6 + i * 1.6, 0, i === 1 ? 1.3 : 0.2);
      snowman.rotation.y = i * 0.7;
      group.add(snowman);
    }
    for (let i = 0; i < 4; i += 1) {
      const x = -3 + i * 2;
      const z = -2 + (i % 2) * 1.2;
      const tree = new THREE.Group();
      cone(tree, mat('#1f5c3a'), 0, 1.1, 0, 0.8, 1.9);
      cone(tree, mat('#2f7d4f'), 0, 1.8, 0, 0.6, 1.5);
      cylinder(tree, WOOD_MAT, 0, 0.25, 0, 0.12, 0.16, 0.5);
      tree.position.set(x, 0, z);
      group.add(tree);
    }
    const fence = box(group, WOOD_MAT, 0, 0.25, 3.4, 6, 0.08, 0.1);
    fence.rotation.y = 0;
    return group;
  }

  box(group, color, 0, height / 2, 0, width, height, depth);
  box(group, trim, 0, 0.12, 0, width + 0.3, 0.24, depth + 0.3);

  if (spec.style === 'gable' || spec.style === 'factory' || spec.style === 'station') {
    const roofHeight = spec.style === 'factory' ? 1.2 : 1.4;
    cone(group, roof, 0, height + roofHeight / 2 - 0.1, 0, Math.max(width, depth) * 0.78, roofHeight, 4, Math.PI / 4);
    cone(group, mat('#f4faff'), 0, height + roofHeight * 0.55, 0, Math.max(width, depth) * 0.4, roofHeight * 0.42, 4, Math.PI / 4);
  } else if (spec.style === 'tower') {
    cylinder(group, roof, 0, height + 0.45, 0, 1.55, 1.75, 0.9, 4);
    cone(group, roof, 0, height + 1.45, 0, 1.9, 1.9, 4, Math.PI / 4);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), mat('#fff4ea', { roughness: 0.5 }));
    face.position.set(0, height + 0.3, depth / 2 + 0.02);
    group.add(face);
    const handA = box(group, mat('#241a2e'), 0, height + 0.42, depth / 2 + 0.05, 0.05, 0.34, 0.02);
    handA.rotation.z = 0.5;
    const handB = box(group, mat('#241a2e'), 0.12, height + 0.28, depth / 2 + 0.05, 0.24, 0.05, 0.02);
    handB.rotation.z = -0.2;
  } else if (spec.style === 'flat') {
    box(group, roof, 0, height + 0.1, 0, width + 0.2, 0.2, depth + 0.2);
    box(group, mat('#fff4ea'), 0, height + 0.22, 0, width * 0.95, 0.06, depth * 0.9);
  } else if (spec.style === 'dome') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      roof
    );
    dome.position.y = height;
    group.add(dome);
    cylinder(group, mat('#cfd8e3'), 0.6, height + 1.1, 0, 0.24, 0.24, 1.7, 12, Math.PI / 2);
    box(group, mat('#241a2e'), 1.35, height + 1.25, 0, 0.5, 0.3, 0.3);
  } else if (spec.style === 'shop') {
    box(group, roof, 0, height + 0.35, 0, width + 0.4, 0.3, depth + 0.3);
    for (let i = 0; i < 6; i += 1) {
      const stripe = box(group, i % 2 ? accent : mat('#fff4ea'), -1.5 + i * 0.6, height - 0.05, depth / 2 + 0.35, 0.3, 0.5, 0.1);
      stripe.rotation.x = -0.25;
    }
  }

  // Door and windows on the face pointing at the square.
  box(group, mat('#3a2418'), 0, 0.55, depth / 2 + 0.03, 0.55, 0.9, 0.06);
  sphere(group, accent, 0.2, 0.55, depth / 2 + 0.07, 0.045);
  addWindows(group, width, height, depth, spec.style === 'tower' ? 3 : 2, 3);

  if (spec.style === 'factory') {
    cylinder(group, mat('#8c5a3c'), -1.1, height + 1.5, -0.6, 0.28, 0.36, 2.2, 12);
    cylinder(group, mat('#d9d9d9'), -1.1, height + 2.6, -0.6, 0.4, 0.3, 0.12);
  } else if (spec.style === 'station') {
    box(group, roof, 0, height + 0.5, 3.3, 7, 0.14, 2.4);
    [-2.4, 0, 2.4].forEach((x) => cylinder(group, WOOD_MAT, x, height + 0.2, 3.3, 0.08, 0.08, 0.9));
    box(group, mat('#6b4a2f'), 0, 0.06, 4.6, 8, 0.12, 0.12);
    box(group, mat('#6b4a2f'), 0, 0.06, 6.2, 8, 0.12, 0.12);
    for (let i = 0; i < 5; i += 1) {
      box(group, mat('#8b5a3c'), -3 + i * 1.5, 0.1, 5.4, 0.16, 0.1, 1.6);
    }
  } else if (spec.style === 'shop') {
    const sign = box(group, mat('#241a2e'), 0, height + 0.55, depth / 2 + 0.05, 1.7, 0.7, 0.08);
    sign.rotation.x = -0.05;
    const pretzel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 14), mat(spec.accent));
    pretzel.position.set(0, height + 0.55, depth / 2 + 0.12);
    group.add(pretzel);
  }

  // Snow on the roof corners and a couple of snow piles.
  sphere(group, mat('#f4faff'), -width / 2, height + 0.15, depth / 2, 0.28, 1.4, 0.5, 1);
  sphere(group, mat('#f4faff'), width / 2, height + 0.15, depth / 2, 0.24, 1.4, 0.5, 1);
  sphere(group, mat('#f4faff'), width / 2 + 0.7, 0.2, depth / 2 + 0.7, 0.4, 1.4, 0.55, 1);

  return group;
}

const WOOD_MAT = mat('#8b5a3c', { roughness: 0.9 });

// ------------------------------------------------------------------- town
export function createTown(container, options = {}) {
  const reducedMotion = Boolean(options.reducedMotion);
  const onTap = options.onTap || (() => {});
  const onHover = options.onHover || (() => {});

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080d24');
  scene.fog = new THREE.Fog('#0b1233', 34, 82);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  const cameraTarget = new THREE.Vector3(0, 3.1, 0);
  const orbit = { yaw: 0.38, pitch: 0.24, distance: 10.6, targetYaw: 0.38, targetPitch: 0.24, targetDistance: 10.6 };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // --------------------------------------------------------------- sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#05081a') },
        bottomColor: { value: new THREE.Color('#1d2a5c') },
      },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld = world.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h = clamp(normalize(vWorld).y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0); }',
    })
  );
  scene.add(sky);

  const starPositions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.46;
    const radius = 70 + Math.random() * 20;
    starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * radius;
    starPositions[i * 3 + 1] = Math.sin(phi) * radius + 4;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * radius;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#e8f1ff', size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.85 })
    )
  );

  const moon = sphere(scene, new THREE.MeshBasicMaterial({ color: '#fff4d6' }), -26, 30, -44, 3.4);
  moon.castShadow = false;
  const moonGlow = sphere(scene, new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.12 }), -26, 30, -44, 5.2);
  moonGlow.castShadow = false;

  // ------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight('#8fa8ff', '#1d2a4a', 1.15));
  const moonLight = new THREE.DirectionalLight('#dfe9ff', 1.6);
  moonLight.position.set(-12, 20, 14);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -26;
  moonLight.shadow.camera.right = 26;
  moonLight.shadow.camera.top = 26;
  moonLight.shadow.camera.bottom = -26;
  moonLight.shadow.camera.far = 70;
  moonLight.shadow.bias = -0.0006;
  scene.add(moonLight);
  const plazaLight = new THREE.PointLight('#ffb703', 26, 20, 2);
  plazaLight.position.set(0, 4.5, 2.5);
  scene.add(plazaLight);

  // -------------------------------------------------------------- ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), mat('#c8d8f2', { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7.4, 56), mat('#aebfe3', { roughness: 0.6, metalness: 0.08 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.012;
  plaza.receiveShadow = true;
  scene.add(plaza);

  const plazaRing = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.09, 6, 64), mat('#e8f1ff'));
  plazaRing.rotation.x = Math.PI / 2;
  plazaRing.position.y = 0.03;
  scene.add(plazaRing);

  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2;
    const radius = 4.5 + (i % 3) * 0.9;
    const pile = sphere(
      scene,
      mat('#f4faff', { roughness: 0.95 }),
      Math.cos(angle) * radius,
      0.1,
      Math.sin(angle) * radius,
      0.3 + (i % 5) * 0.08,
      1.5,
      0.55,
      1.2
    );
    pile.castShadow = false;
  }

  // ---------------------------------------------------------------- tree
  const treeGroup = new THREE.Group();
  scene.add(treeGroup);

  const trunk = cylinder(treeGroup, mat('#5a3a22', { roughness: 0.95 }), 0, 0.35, 0, 0.32, 0.4, 0.9, 10);
  trunk.castShadow = true;

  const needleMats = [mat('#1c5a38'), mat('#246b42'), mat('#2c7c4d')];
  TIERS.forEach((tier, index) => {
    const tierMesh = cone(
      treeGroup,
      needleMats[index % needleMats.length],
      0,
      tier.base + tier.height / 2,
      0,
      tier.radius,
      tier.height,
      18,
      index * 0.35
    );
    tierMesh.castShadow = true;
    tierMesh.receiveShadow = true;
    // A little snow settled on each layer.
    const snow = cone(
      treeGroup,
      mat('#f4faff', { roughness: 0.95 }),
      0,
      tier.base + tier.height * 0.82,
      0,
      tier.radius * 0.44,
      tier.height * 0.24,
      18,
      index * 0.35
    );
    snow.castShadow = false;
  });

  const topperMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd93d',
    emissive: '#ffb703',
    emissiveIntensity: 0.8,
    metalness: 0.55,
    roughness: 0.3,
  });
  const topper = new THREE.Mesh(starGeometry(), topperMaterial);
  topper.position.y = TREE_TOP;
  topper.scale.setScalar(0.42);
  treeGroup.add(topper);
  const topperLight = new THREE.PointLight('#ffd93d', 10, 9, 2);
  topperLight.position.set(0, TREE_TOP, 0);
  treeGroup.add(topperLight);

  const bulbGeometry = new THREE.SphereGeometry(0.045, 6, 5);
  const bulbs = [];
  const bulbMaterials = BULB_COLORS.map(
    (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  for (let i = 0; i < 110; i += 1) {
    const t = i / 110;
    const y = 0.25 + t * 6.2;
    const radius = treeRadiusAt(y) + 0.02;
    const angle = t * Math.PI * 12;
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterials[i % bulbMaterials.length]);
    bulb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    bulb.userData.phase = i * 0.7;
    treeGroup.add(bulb);
    bulbs.push(bulb);
  }

  // -------------------------------------------------------------- slots
  const ornamentLayer = new THREE.Group();
  treeGroup.add(ornamentLayer);

  const slots = [];
  const slotHits = [];
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: '#ffd93d',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const markerGeometry = new THREE.SphereGeometry(0.055, 10, 8);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

  for (let ring = 0; ring < SLOT_RINGS; ring += 1) {
    const tier = TIERS[ring];
    const y = tier.base + 0.42;
    const innerRadius = treeRadiusAt(y);
    const radius = innerRadius + 0.28;
    for (let index = 0; index < SLOTS_PER_RING; index += 1) {
      const angle = ((index + (ring % 2) * 0.5) / SLOTS_PER_RING) * Math.PI * 2;
      const position = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const slotIndex = slots.length;

      // A little twig so each ornament visibly hangs off the branch.
      const twig = box(
        treeGroup,
        mat('#5a3a22', { roughness: 0.95 }),
        Math.cos(angle) * (innerRadius + 0.14),
        y,
        Math.sin(angle) * (innerRadius + 0.14),
        0.3,
        0.025,
        0.025,
        0,
        -angle,
        0
      );
      twig.castShadow = false;

      const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
      marker.position.copy(position);
      marker.visible = false;
      marker.userData.phase = slotIndex * 0.6;
      treeGroup.add(marker);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), hitMaterial);
      hit.position.copy(position);
      hit.userData.slotIndex = slotIndex;
      treeGroup.add(hit);
      slotHits.push(hit);

      slots.push({
        index: slotIndex,
        ring,
        position,
        marker,
        hit,
        ornament: null,
        group: null,
      });
    }
  }

  // ---------------------------------------------------------- landmarks
  const landmarks = [];
  const landmarkHits = [];
  const landmarkMaterial = new THREE.MeshBasicMaterial({ visible: false });

  LANDMARKS.forEach((spec) => {
    const angle = (spec.angle / 180) * Math.PI;
    const x = Math.sin(angle) * spec.radius;
    const z = Math.cos(angle) * spec.radius;
    const root = makeBuilding(spec);
    root.position.set(x, 0, z);
    root.rotation.y = Math.atan2(-x, -z);
    scene.add(root);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5, 5.5), landmarkMaterial);
    hit.position.set(x, 2.2, z);
    hit.userData.landmarkId = spec.id;
    scene.add(hit);
    landmarkHits.push(hit);

    landmarks.push({
      ...spec,
      x,
      z,
      root,
      hit,
      destroyed: false,
      originalScale: root.scale.clone(),
    });
  });

  // Lamp posts around the square.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const radius = 8.1;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const post = cylinder(scene, mat('#2b3358'), x, 1.1, z, 0.075, 0.1, 2.2, 8);
    post.castShadow = false;
    const arm = box(scene, mat('#2b3358'), x, 2.2, z, 0.7, 0.08, 0.08);
    arm.rotation.y = -angle;
    const bulb = new THREE.Mesh(
      BULB_GEO,
      new THREE.MeshBasicMaterial({ color: '#ffe9a8' })
    );
    bulb.scale.setScalar(1.7);
    bulb.position.set(x - Math.cos(angle) * 0.32, 2.18, z - Math.sin(angle) * 0.32);
    scene.add(bulb);
    const light = new THREE.PointLight('#ffd98a', 5, 7, 2);
    light.position.copy(bulb.position);
    scene.add(light);
  }

  // Fir trees between the buildings.
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + 0.1;
    const radius = 11.5 + (i % 3) * 1.4;
    const tree = new THREE.Group();
    cone(tree, mat('#1c5a38'), 0, 1.2, 0, 0.85, 2.1);
    cone(tree, mat('#246b42'), 0, 1.9, 0, 0.65, 1.7);
    cone(tree, mat('#2c7c4d'), 0, 2.5, 0, 0.45, 1.4);
    sphere(tree, mat('#f4faff'), 0, 3.15, 0, 0.3, 1, 0.5, 1);
    cylinder(tree, WOOD_MAT, 0, 0.3, 0, 0.1, 0.14, 0.6);
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.rotation.y = angle;
    scene.add(tree);
  }

  // Snow banks at the plaza edge.
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + 0.15;
    const radius = 7.9;
    const bank = sphere(
      scene,
      mat('#eef6ff', { roughness: 0.95 }),
      Math.cos(angle) * radius,
      0.12,
      Math.sin(angle) * radius,
      0.55,
      1.8,
      0.35,
      1.2
    );
    bank.castShadow = false;
  }

  // --------------------------------------------------------------- snow
  const snowCount = reducedMotion ? 350 : 1000;
  const snowPositions = new Float32Array(snowCount * 3);
  const snowSpeeds = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i += 1) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 40;
    snowPositions[i * 3 + 1] = Math.random() * 16;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    snowSpeeds[i] = 0.6 + Math.random() * 1.1;
  }
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snow = new THREE.Points(
    snowGeometry,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.11,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  scene.add(snow);

  // ------------------------------------------------------------- camera
  function applyCamera() {
    const cosPitch = Math.cos(orbit.pitch);
    camera.position.set(
      Math.sin(orbit.yaw) * cosPitch * orbit.distance,
      cameraTarget.y + Math.sin(orbit.pitch) * orbit.distance,
      Math.cos(orbit.yaw) * cosPitch * orbit.distance
    );
    camera.lookAt(cameraTarget);
  }

  function resize() {
    const width = Math.max(320, container.clientWidth || 800);
    const height = Math.max(260, container.clientHeight || 520);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let interactive = true;
  let selectionActive = false;
  let cameraLocked = false;
  let pointerDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let idleTime = 0;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const targets = [];
    ornamentLayer.traverse((child) => {
      if (child.isMesh) targets.push(child);
    });
    targets.push(...slotHits);

    const hits = raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      let node = hit.object;
      while (node && node !== scene) {
        if (node.userData.slotIndex !== undefined) {
          return { type: 'slot', slotIndex: node.userData.slotIndex };
        }
        if (node.userData.catalogId) {
          return { type: 'ornament', group: node, slotIndex: node.userData.slotIndex };
        }
        node = node.parent;
      }
    }

    const landmarkHitsResult = raycaster.intersectObjects(landmarkHits, false);
    if (landmarkHitsResult.length) {
      return { type: 'landmark', id: landmarkHitsResult[0].object.userData.landmarkId };
    }
    return null;
  }

  function onPointerDown(event) {
    if (!interactive) return;
    pointerDown = true;
    dragged = false;
    lastX = event.clientX;
    lastY = event.clientY;
    downX = event.clientX;
    downY = event.clientY;
    idleTime = 0;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
  }

  function onPointerMove(event) {
    if (!interactive) return;
    if (pointerDown) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(event.clientX - downX) + Math.abs(event.clientY - downY) > 7) dragged = true;
      if (dragged) {
        orbit.targetYaw -= dx * 0.006;
        orbit.targetPitch = THREE.MathUtils.clamp(orbit.targetPitch + dy * 0.004, 0.06, 0.85);
      }
      lastX = event.clientX;
      lastY = event.clientY;
      idleTime = 0;
    } else {
      onHover(pickAt(event.clientX, event.clientY), event);
    }
  }

  function onPointerUp(event) {
    if (!interactive) return;
    const wasDrag = dragged;
    pointerDown = false;
    dragged = false;
    renderer.domElement.style.cursor = '';
    if (!wasDrag) onTap(pickAt(event.clientX, event.clientY), event);
  }

  function onPointerLeave() {
    pointerDown = false;
    dragged = false;
    renderer.domElement.style.cursor = '';
    onHover(null);
  }

  function onWheel(event) {
    if (!interactive) return;
    event.preventDefault();
    orbit.targetDistance = THREE.MathUtils.clamp(orbit.targetDistance + event.deltaY * 0.008, 6.4, 16);
    idleTime = 0;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerLeave);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  function setSelectionActive(active) {
    selectionActive = Boolean(active);
    slots.forEach((slot) => {
      slot.marker.visible = selectionActive && !slot.ornament;
    });
  }

  function highlightSlot(slotIndex) {
    slots.forEach((slot) => {
      slot.hovered = slot.index === slotIndex;
    });
  }

  function placeOrnament(slotIndex, group) {
    const slot = slots[slotIndex];
    if (!slot) return false;
    if (slot.ornament) return false;
    group.position.copy(slot.position);
    group.rotation.set(0, (slotIndex * 0.9) % Math.PI, (slotIndex % 3) * 0.04 - 0.04);
    group.userData.slotIndex = slotIndex;
    ornamentLayer.add(group);
    slot.ornament = group.userData.catalogId;
    slot.group = group;
    slot.marker.visible = false;
    return true;
  }

  function removeOrnament(slotIndex) {
    const slot = slots[slotIndex];
    if (!slot || !slot.group) return null;
    const group = slot.group;
    ornamentLayer.remove(group);
    slot.ornament = null;
    slot.group = null;
    slot.marker.visible = selectionActive;
    return group;
  }

  function clearOrnaments() {
    slots.forEach((slot) => {
      if (slot.group) {
        ornamentLayer.remove(slot.group);
        slot.ornament = null;
        slot.group = null;
      }
      slot.marker.visible = selectionActive;
    });
  }

  function resetTree() {
    treeGroup.position.set(0, 0, 0);
    treeGroup.rotation.set(0, 0, 0);
    treeGroup.scale.setScalar(1);
    treeGroup.visible = true;
    clearOrnaments();
    setSelectionActive(false);
  }

  function destroyLandmark(id) {
    const landmark = landmarks.find((entry) => entry.id === id);
    if (!landmark) return;
    landmark.destroyed = true;
    landmark.root.visible = false;
  }

  function restoreLandmarks() {
    landmarks.forEach((landmark) => {
      landmark.destroyed = false;
      landmark.root.visible = true;
      landmark.root.scale.copy(landmark.originalScale);
      landmark.root.rotation.set(0, landmark.root.rotation.y, 0);
    });
  }

  function landmarkById(id) {
    return landmarks.find((entry) => entry.id === id) || null;
  }

  function frameTree() {
    orbit.targetYaw = 0.38;
    orbit.targetPitch = 0.24;
    orbit.targetDistance = 10.6;
  }

  function setCameraLocked(locked) {
    cameraLocked = Boolean(locked);
  }

  function update(dt, elapsed) {
    idleTime += dt;
    if (!cameraLocked) {
      if (!reducedMotion && idleTime > 6 && !pointerDown) orbit.targetYaw += dt * 0.045;
      orbit.yaw += (orbit.targetYaw - orbit.yaw) * Math.min(1, dt * 6);
      orbit.pitch += (orbit.targetPitch - orbit.pitch) * Math.min(1, dt * 6);
      orbit.distance += (orbit.targetDistance - orbit.distance) * Math.min(1, dt * 4);
      applyCamera();
    }

    bulbs.forEach((bulb) => {
      const pulse = 0.85 + Math.sin(elapsed * 2.4 + bulb.userData.phase) * 0.35;
      bulb.scale.setScalar(pulse);
    });
    topper.rotation.y += dt * 0.6;
    topper.position.y = TREE_TOP + Math.sin(elapsed * 1.4) * 0.05;

    slots.forEach((slot) => {
      if (!slot.marker.visible) return;
      if (slot.hovered) {
        slot.marker.scale.setScalar(1.75);
        slot.marker.material.opacity = 1;
        return;
      }
      const pulse = 1 + Math.sin(elapsed * 4 + slot.marker.userData.phase) * 0.22;
      slot.marker.scale.setScalar(pulse);
      slot.marker.material.opacity = 0.55 + Math.sin(elapsed * 4 + slot.marker.userData.phase) * 0.25;
    });

    if (!reducedMotion) {
      const positions = snowGeometry.attributes.position.array;
      for (let i = 0; i < snowCount; i += 1) {
        positions[i * 3 + 1] -= snowSpeeds[i] * dt;
        positions[i * 3] += Math.sin(elapsed + i) * dt * 0.12;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 16;
          positions[i * 3] = (Math.random() - 0.5) * 40;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
      }
      snowGeometry.attributes.position.needsUpdate = true;
    }
  }

  function dispose() {
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerLeave);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    renderer.domElement.removeEventListener('wheel', onWheel);
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    treeGroup,
    ornamentLayer,
    slots,
    landmarks,
    snow,
    update,
    resize,
    dispose,
    pickAt,
    setSelectionActive,
    highlightSlot,
    placeOrnament,
    removeOrnament,
    clearOrnaments,
    resetTree,
    destroyLandmark,
    restoreLandmarks,
    landmarkById,
    frameTree,
    setCameraLocked,
    setInteractive(value) {
      interactive = Boolean(value);
      if (!interactive) {
        pointerDown = false;
        dragged = false;
      }
    },
  };
}

function treeRadiusAt(y) {
  for (let i = TIERS.length - 1; i >= 0; i -= 1) {
    const tier = TIERS[i];
    if (y >= tier.base) {
      return Math.max(0.24, tier.radius * (1 - (y - tier.base) / tier.height));
    }
  }
  return TIERS[0].radius;
}
