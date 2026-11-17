import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Roost Rider — track, terrain and scenery
 * A closed off-road circuit built from one Catmull-Rom loop. The same
 * height function drives both the mesh and the bike physics, so ramps
 * and landings always line up.
 * ------------------------------------------------------------------ */

export const TRACK_HALF = 9;
export const TRACK_WIDTH = TRACK_HALF * 2;

const BLEND = 17;
const TERRAIN_SIZE = 560;
const TERRAIN_SEGMENTS = 168;
const SAMPLE_COUNT = 1400;

const CONTROL_POINTS = [
  [-10, -165],
  [80, -155],
  [145, -100],
  [150, -20],
  [120, 45],
  [145, 110],
  [95, 155],
  [25, 150],
  [-20, 110],
  [-60, 145],
  [-125, 135],
  [-160, 70],
  [-135, 0],
  [-160, -70],
  [-115, -130],
  [-45, -160],
];

const curve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'catmullrom',
  0.4
);

export const TRACK_LENGTH = curve.getLength();
export const START_ARC = TRACK_LENGTH - 30;

const SAMPLES = [];
for (let i = 0; i < SAMPLE_COUNT; i += 1) {
  const u = i / SAMPLE_COUNT;
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u);
  SAMPLES.push({ x: point.x, z: point.z, tx: tangent.x, tz: tangent.z, u });
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const smooth = (value) => {
  const k = clamp(value, 0, 1);
  return k * k * k * (k * (k * 6 - 15) + 10);
};

const hash = (x, z) => {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const wrapArc = (delta) => {
  if (delta > TRACK_LENGTH / 2) return delta - TRACK_LENGTH;
  if (delta < -TRACK_LENGTH / 2) return delta + TRACK_LENGTH;
  return delta;
};

/* ------------------------------------------------------------- profile */

const JUMPS = [
  { at: 0.075, up: 17, crest: 3, down: 10, height: 2.5 },
  { at: 0.245, up: 14, crest: 2, down: 8, height: 1.9 },
  { at: 0.405, up: 20, crest: 4, down: 12, height: 3.2 },
  { at: 0.585, up: 12, crest: 2, down: 7, height: 1.6 },
  { at: 0.785, up: 16, crest: 3, down: 10, height: 2.3 },
];

const WHOOPS = [
  { at: 0.33, len: 46, amp: 0.6, count: 6 },
  { at: 0.685, len: 42, amp: 0.5, count: 5 },
];

function featureHeight(arc) {
  let height = 0;

  for (const jump of JUMPS) {
    const start = jump.at * TRACK_LENGTH;
    const local = wrapArc(arc - start);
    const total = jump.up + jump.crest + jump.down;
    if (local < 0 || local > total) continue;

    if (local < jump.up) {
      height += jump.height * Math.pow(local / jump.up, 1.35);
    } else if (local < jump.up + jump.crest) {
      height += jump.height;
    } else {
      const k = (local - jump.up - jump.crest) / jump.down;
      height += jump.height * (1 - smooth(k));
    }
  }

  for (const whoops of WHOOPS) {
    const local = wrapArc(arc - whoops.at * TRACK_LENGTH);
    if (local < 0 || local > whoops.len) continue;
    const wave = Math.sin((local / whoops.len) * Math.PI * whoops.count);
    height += whoops.amp * wave * wave;
  }

  return height;
}

function trackElevation(u) {
  return (
    4.4 * Math.sin(u * Math.PI * 4 + 0.5) +
    2.3 * Math.sin(u * Math.PI * 6 - 1.1) +
    1.1 * Math.sin(u * Math.PI * 10 + 2.2)
  );
}

function baseHills(x, z) {
  return (
    3.1 * Math.sin(x * 0.019 + 1.3) * Math.cos(z * 0.016 - 0.7) +
    1.6 * Math.sin((x + z) * 0.028 + 2.1) +
    1.2 * Math.cos(x * 0.045 - z * 0.033) +
    0.6 * Math.sin(x * 0.09 + z * 0.07)
  );
}

/* --------------------------------------------------------------- lookup */

export function nearestSample(x, z) {
  let best = 0;
  let bestDistance = Infinity;

  for (let i = 0; i < SAMPLE_COUNT; i += 12) {
    const sample = SAMPLES[i];
    const dx = x - sample.x;
    const dz = z - sample.z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }

  let bestIndex = best;
  for (let offset = -17; offset <= 17; offset += 1) {
    const index = (best + offset + SAMPLE_COUNT) % SAMPLE_COUNT;
    const sample = SAMPLES[index];
    const dx = x - sample.x;
    const dz = z - sample.z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  const sample = SAMPLES[bestIndex];
  const dx = x - sample.x;
  const dz = z - sample.z;
  const along = dx * sample.tx + dz * sample.tz;

  let arc = (bestIndex / SAMPLE_COUNT) * TRACK_LENGTH + along;
  arc = ((arc % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;

  return {
    dist: Math.sqrt(bestDistance),
    arc,
    u: arc / TRACK_LENGTH,
    side: dx * sample.tz - dz * sample.tx,
    tx: sample.tx,
    tz: sample.tz,
  };
}

export function groundAt(x, z) {
  const near = nearestSample(x, z);
  const base = baseHills(x, z);
  const track = trackElevation(near.u) + featureHeight(near.arc);
  const weight = 1 - smooth((near.dist - TRACK_HALF) / BLEND);

  return {
    height: base + (track - base) * weight,
    trackHeight: track,
    dist: near.dist,
    arc: near.arc,
    u: near.u,
    side: near.side,
    tx: near.tx,
    tz: near.tz,
    onTrack: near.dist < TRACK_HALF + 1.2,
  };
}

export function terrainHeight(x, z) {
  return groundAt(x, z).height;
}

export function sampleAtArc(arc) {
  const wrapped = ((arc % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  const u = wrapped / TRACK_LENGTH;
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u);
  return { x: point.x, z: point.z, tx: tangent.x, tz: tangent.z, u, arc: wrapped };
}

export function getTrackOutline(step = 10) {
  const points = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < SAMPLE_COUNT; i += step) {
    const sample = SAMPLES[i];
    points.push({ x: sample.x, z: sample.z });
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minZ = Math.min(minZ, sample.z);
    maxZ = Math.max(maxZ, sample.z);
  }

  return { points, bounds: { minX, maxX, minZ, maxZ } };
}

/* ------------------------------------------------------------- textures */

const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createBannerTexture() {
  return canvasTexture(1024, 256, (ctx, width, height) => {
    ctx.fillStyle = '#151a2c';
    ctx.fillRect(0, 0, width, height);

    const square = 32;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < width / square; col += 1) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#fff8e7' : '#151a2c';
        ctx.fillRect(col * square, row * square, square, square);
        ctx.fillRect(col * square, height - (row + 1) * square, square, square);
      }
    }

    ctx.fillStyle = '#ffd93d';
    ctx.font = '900 104px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROOST RIDER', width / 2, height / 2 - 18);

    ctx.fillStyle = '#fff8e7';
    ctx.font = '700 26px Arial, sans-serif';
    ctx.fillText('FOOFIRE MX  •  BACKWOODS GRAND PRIX', width / 2, height / 2 + 62);
  });
}

function createCheckerTexture() {
  return canvasTexture(256, 128, (ctx, width, height) => {
    const square = 16;
    for (let row = 0; row < height / square; row += 1) {
      for (let col = 0; col < width / square; col += 1) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#f7f2e6' : '#17181d';
        ctx.fillRect(col * square, row * square, square, square);
      }
    }
  });
}

function createSunTexture() {
  return canvasTexture(256, 256, (ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(255, 252, 232, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 238, 184, 0.95)');
    gradient.addColorStop(0.5, 'rgba(255, 214, 140, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 205, 120, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

function createCloudTexture() {
  return canvasTexture(256, 128, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const puffs = [
      [0.28, 0.62, 0.18],
      [0.46, 0.48, 0.24],
      [0.66, 0.58, 0.2],
      [0.8, 0.66, 0.13],
      [0.16, 0.72, 0.11],
    ];
    puffs.forEach(([x, y, radius]) => {
      ctx.beginPath();
      ctx.arc(x * width, y * height, radius * width, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

/* --------------------------------------------------------------- terrain */

function buildTerrain() {
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
    TERRAIN_SEGMENTS
  );
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  const dirt = srgb('#c19a65');
  const dirtDark = srgb('#9a7548');
  const grass = srgb('#7a9448');
  const grassDry = srgb('#a8a35f');
  const scrub = srgb('#5f7638');
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const ground = groundAt(x, z);
    position.setY(i, ground.height);

    const noise = hash(x * 0.7, z * 0.7);
    const patch = hash(Math.floor(x / 22), Math.floor(z / 22));

    color.copy(grass).lerp(grassDry, patch * 0.55);
    color.lerp(scrub, noise * 0.28);

    const fringe = 1 - smooth((ground.dist - TRACK_HALF) / 6);
    if (fringe > 0.001) {
      const trackColor = dirt.clone().lerp(dirtDark, noise * 0.55);
      color.lerp(trackColor, fringe);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  mesh.receiveShadow = false;
  mesh.name = 'terrain';
  return mesh;
}

function buildTrackRibbon() {
  const rows = 900;
  const cols = 6;
  const positions = [];
  const colors = [];
  const indices = [];

  const dirtLight = srgb('#d3a774');
  const dirtMid = srgb('#b98d5b');
  const dirtDark = srgb('#8f6a40');
  const berm = srgb('#e0ba85');
  const color = new THREE.Color();

  for (let row = 0; row <= rows; row += 1) {
    const arc = (row / rows) * TRACK_LENGTH;
    const sample = sampleAtArc(arc);
    const rightX = sample.tz;
    const rightZ = -sample.tx;
    const base = trackElevation(sample.u) + featureHeight(arc) + 0.06;

    for (let col = 0; col <= cols; col += 1) {
      const k = col / cols;
      const lateral = (k - 0.5) * TRACK_WIDTH;
      const x = sample.x + rightX * lateral;
      const z = sample.z + rightZ * lateral;

      positions.push(x, base, z);

      const noise = hash(arc * 0.11, k * 9.7);
      color.copy(dirtMid).lerp(dirtLight, noise * 0.85);

      const rut =
        Math.exp(-((Math.abs(lateral) - 3.2) ** 2) / 1.1) +
        Math.exp(-((Math.abs(lateral) - 6.6) ** 2) / 1.1);
      color.lerp(dirtDark, rut * 0.2);

      if (Math.abs(lateral) > TRACK_HALF - 2.4) color.lerp(berm, 0.42);
      if (Math.abs(lateral) > TRACK_HALF - 1.1) color.lerp(dirtDark, 0.45);

      colors.push(color.r, color.g, color.b);
    }
  }

  const stride = cols + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
}

/* -------------------------------------------------------------- scenery */

function addEdgePosts(group) {
  const placements = [];
  const spacing = 24;

  for (let arc = 0; arc < TRACK_LENGTH; arc += spacing) {
    const sample = sampleAtArc(arc);
    for (const side of [-1, 1]) {
      const lateral = side * (TRACK_HALF + 1.7);
      const x = sample.x + sample.tz * lateral;
      const z = sample.z - sample.tx * lateral;
      placements.push({ x, z, y: terrainHeight(x, z), side });
    }
  }

  const geometry = new THREE.BoxGeometry(0.26, 1.5, 0.26);
  geometry.translate(0, 0.75, 0);

  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    placements.length
  );
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const orange = srgb('#ff7a1a');
  const white = srgb('#fff3d6');

  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, placement.y, placement.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, index % 2 === 0 ? orange : white);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function addTrees(group) {
  const placements = [];
  let attempts = 0;

  while (placements.length < 330 && attempts < 6000) {
    attempts += 1;
    const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.86;
    const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.86;
    if (Math.hypot(x, z) > 232) continue;

    const ground = groundAt(x, z);
    if (ground.dist < TRACK_HALF + 15) continue;

    placements.push({
      x,
      z,
      y: ground.height,
      rotation: Math.random() * Math.PI * 2,
      scale: 0.7 + Math.random() * 0.85,
      shade: Math.random(),
    });
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.28, 0.44, 3.6, 6);
  trunkGeometry.translate(0, 1.8, 0);
  const coneBottom = new THREE.ConeGeometry(2.4, 5.6, 7);
  coneBottom.translate(0, 5.2, 0);
  const coneTop = new THREE.ConeGeometry(1.75, 4.2, 7);
  coneTop.translate(0, 8.1, 0);

  const trunkMesh = new THREE.InstancedMesh(
    trunkGeometry,
    new THREE.MeshLambertMaterial({ color: 0x5a4028 }),
    placements.length
  );
  const bottomMesh = new THREE.InstancedMesh(
    coneBottom,
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    placements.length
  );
  const topMesh = new THREE.InstancedMesh(
    coneTop,
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    placements.length
  );

  [trunkMesh, bottomMesh, topMesh].forEach((mesh) => {
    mesh.frustumCulled = false;
  });

  const dummy = new THREE.Object3D();
  const dark = srgb('#41682f');
  const light = srgb('#7d9e4c');
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    dummy.position.set(placement.x, placement.y, placement.z);
    dummy.rotation.set(0, placement.rotation, 0);
    dummy.scale.setScalar(placement.scale);
    dummy.updateMatrix();

    trunkMesh.setMatrixAt(index, dummy.matrix);
    bottomMesh.setMatrixAt(index, dummy.matrix);
    topMesh.setMatrixAt(index, dummy.matrix);

    color.copy(dark).lerp(light, placement.shade);
    bottomMesh.setColorAt(index, color);
    color.multiplyScalar(0.9);
    topMesh.setColorAt(index, color);
  });

  [trunkMesh, bottomMesh, topMesh].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  });
}

function addBushesAndRocks(group) {
  const bushes = [];
  const rocks = [];

  for (let i = 0; i < 190; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 40 + Math.random() * 200;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ground = groundAt(x, z);
    if (ground.dist < TRACK_HALF + 4) continue;
    bushes.push({
      x,
      z,
      y: ground.height,
      scale: 0.6 + Math.random() * 1.1,
      rotation: Math.random() * Math.PI * 2,
      shade: Math.random(),
    });
  }

  for (let i = 0; i < 110; i += 1) {
    const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
    const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.9;
    if (Math.hypot(x, z) > 250) continue;
    const ground = groundAt(x, z);
    if (ground.dist < TRACK_HALF + 7) continue;
    rocks.push({
      x,
      z,
      y: ground.height,
      scale: 0.5 + Math.random() * 2.2,
      rotation: Math.random() * Math.PI * 2,
      shade: Math.random(),
    });
  }

  const bushGeometry = new THREE.SphereGeometry(1, 6, 5);
  const bushMesh = new THREE.InstancedMesh(
    bushGeometry,
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    bushes.length
  );
  bushMesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const bushDark = srgb('#4b7033');
  const bushLight = srgb('#86a652');
  const color = new THREE.Color();

  bushes.forEach((bush, index) => {
    dummy.position.set(bush.x, bush.y + bush.scale * 0.35, bush.z);
    dummy.rotation.set(0, bush.rotation, 0);
    dummy.scale.set(bush.scale * 1.3, bush.scale * 0.7, bush.scale * 1.3);
    dummy.updateMatrix();
    bushMesh.setMatrixAt(index, dummy.matrix);
    color.copy(bushDark).lerp(bushLight, bush.shade);
    bushMesh.setColorAt(index, color);
  });
  bushMesh.instanceMatrix.needsUpdate = true;
  if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
  group.add(bushMesh);

  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockMesh = new THREE.InstancedMesh(
    rockGeometry,
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    rocks.length
  );
  rockMesh.frustumCulled = false;

  const rockDark = srgb('#88816f');
  const rockLight = srgb('#b7ad95');

  rocks.forEach((rock, index) => {
    dummy.position.set(rock.x, rock.y + rock.scale * 0.25, rock.z);
    dummy.rotation.set(Math.random(), rock.rotation, Math.random());
    dummy.scale.set(rock.scale, rock.scale * 0.65, rock.scale * 0.9);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(index, dummy.matrix);
    color.copy(rockDark).lerp(rockLight, rock.shade);
    rockMesh.setColorAt(index, color);
  });
  rockMesh.instanceMatrix.needsUpdate = true;
  if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
  group.add(rockMesh);
}

function addStartGate(group, startLights) {
  const sample = sampleAtArc(0);
  const yaw = Math.atan2(sample.tx, sample.tz);
  const ground = groundAt(sample.x, sample.z);

  const gate = new THREE.Group();
  gate.name = 'startGate';
  gate.position.set(sample.x, ground.trackHeight, sample.z);
  gate.rotation.y = yaw;
  group.add(gate);

  const postMaterial = new THREE.MeshLambertMaterial({ color: 0x3a4150 });
  const postGeometry = new THREE.CylinderGeometry(0.26, 0.32, 6.8, 10);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(side * (TRACK_HALF + 1.2), 3.4, 0);
    gate.add(post);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.36, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x1b1f27 })
    );
    foot.position.set(side * (TRACK_HALF + 1.2), 0.18, 0);
    gate.add(foot);
  }

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_HALF * 2 + 2.4, 2.1),
    new THREE.MeshBasicMaterial({ map: createBannerTexture() })
  );
  banner.position.set(0, 6.15, -0.22);
  banner.rotation.y = Math.PI;
  gate.add(banner);

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(TRACK_HALF * 2 + 3, 0.34, 0.5),
    postMaterial
  );
  bar.position.set(0, 7.15, 0);
  gate.add(bar);

  for (const x of [-1.9, 0, 1.9]) {
    const material = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), material);
    light.position.set(x, 5.05, -0.5);
    gate.add(light);
    startLights.push(material);
  }

  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_WIDTH, 2.4),
    new THREE.MeshBasicMaterial({ map: createCheckerTexture() })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.09;
  gate.add(line);
}

function addMountains(scene) {
  const geometry = new THREE.ConeGeometry(1, 1, 7);
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, 22);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const near = srgb('#8ba7b6');
  const far = srgb('#b8ccd8');

  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.12;
    const radius = 330 + Math.random() * 130;
    const width = 90 + Math.random() * 90;
    const height = 65 + Math.random() * 85;
    dummy.position.set(Math.cos(angle) * radius, height / 2 - 8, Math.sin(angle) * radius);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.copy(near).lerp(far, Math.random()));
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

function addSky(scene) {
  const sky = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#2f8fd8').convertSRGBToLinear() },
        bottomColor: { value: new THREE.Color('#dceefb').convertSRGBToLinear() },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float mixAmount = pow(max(h, 0.0), 0.5);
          gl_FragColor = vec4(mix(bottomColor, topColor, mixAmount), 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  dome.renderOrder = -10;
  sky.add(dome);

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createSunTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
    })
  );
  sun.position.set(300, 330, -430);
  sun.scale.set(120, 120, 1);
  sky.add(sun);

  const cloudTexture = createCloudTexture();
  for (let i = 0; i < 12; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 360 + Math.random() * 200;
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.3,
        depthWrite: false,
        fog: false,
      })
    );
    cloud.position.set(
      Math.cos(angle) * radius,
      95 + Math.random() * 120,
      Math.sin(angle) * radius
    );
    const scale = 90 + Math.random() * 110;
    cloud.scale.set(scale, scale * 0.5, 1);
    sky.add(cloud);
  }

  scene.add(sky);
  return sky;
}

/* --------------------------------------------------------------- world */

export function createWorld(scene) {
  scene.background = new THREE.Color('#bfe3f4');
  scene.fog = new THREE.Fog(0xd8eaf3, 170, 540);

  const hemisphere = new THREE.HemisphereLight(0xeaf6ff, 0x7b8452, 1.55);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff3d8, 2.1);
  sun.position.set(120, 190, 70);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.5);
  fill.position.set(-120, 70, -90);
  scene.add(fill);

  const world = new THREE.Group();
  scene.add(world);

  world.add(buildTerrain());
  world.add(buildTrackRibbon());
  addEdgePosts(world);
  addTrees(world);
  addBushesAndRocks(world);

  const startLights = [];
  addStartGate(world, startLights);

  addMountains(scene);

  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshLambertMaterial({ color: 0x6d8043 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -2.4;
  scene.add(outer);

  const sky = addSky(scene);

  return { sky, startLights };
}
