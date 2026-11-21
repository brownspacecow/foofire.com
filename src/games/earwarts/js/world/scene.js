import * as THREE from '../../../../vendor/three.module.js';
import { getState, interact, setNearby, syncRoom, subscribe } from '../store.js';
import { HOUSE_OF, ROOMS } from '../content.js';
import {
  BARRIERS,
  CORRIDORS,
  FLOOR_ZONES,
  INTERACTIONS,
  ROOM_ZONES,
  SPAWN,
  WALLS,
  isInsideAnyZone,
  nearbyInteraction,
  roomAt,
} from '../layout.js';
import { moveInput, worldState } from './state.js';

// South walls stay low so the high follow camera can see over them from outside.
const LOW_WALLS = new Set([
  '-8,10',
  '8,10',
  '-6,-33',
  '6,-33',
  '42,10',
  '-42,10',
  '-7,52',
  '7,52',
  '0,94',
  '22,3',
  '-22,3',
]);

const PALETTE = {
  'great-hall': { floor: '#2a2340', wall: '#372e4e', accent: '#f2ce7b' },
  'spellcasting-tower': { floor: '#211c3e', wall: '#2d2854', accent: '#a99bff' },
  'creature-gardens': { floor: '#1b3125', wall: '#284031', accent: '#8fe0a8' },
  'potion-dungeon': { floor: '#1e1929', wall: '#2c2337', accent: '#7fd6c9' },
  'rhythm-forest': { floor: '#15271e', wall: '#20362a', accent: '#b9d87d' },
  'piano-parlour': { floor: '#271b2c', wall: '#37283e', accent: '#f0a9c6' },
};

const PLAYER_RADIUS = 0.48;
const WALK_SPEED = 4.6;
const RUN_SPEED = 7.3;

const mat = (color, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...options });
const basic = (color, options = {}) => new THREE.MeshBasicMaterial({ color, ...options });

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  return object;
}

function box(size, material, position, rotation) {
  return mesh(new THREE.BoxGeometry(...size), material, position, rotation);
}

function cylinder(radiusTop, radiusBottom, height, material, position, segments = 12) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position);
}

function cone(radius, height, material, position, segments = 10) {
  return mesh(new THREE.ConeGeometry(radius, height, segments), material, position);
}

function sphere(radius, material, position, segments = 16) {
  return mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 2)), material, position);
}

function torus(radius, tube, material, position, rotation, segments = 32) {
  return mesh(new THREE.TorusGeometry(radius, tube, 6, segments), material, position, rotation);
}

function capsule(radius, length, material, position, rotation = [0, 0, 0], segments = 8) {
  return mesh(
    new THREE.CapsuleGeometry(radius, length, 4, segments),
    material,
    position,
    rotation
  );
}

function ellipsoid(radiusX, radiusY, radiusZ, material, position, rotation = [0, 0, 0], segments = 14) {
  const object = mesh(
    new THREE.SphereGeometry(1, segments, Math.max(8, segments - 4)),
    material,
    position,
    rotation
  );
  object.scale.set(radiusX, radiusY, radiusZ);
  return object;
}

function shadeColor(color, factor) {
  return new THREE.Color(color).multiplyScalar(factor);
}

let fabricTexture = null;
function getFabricTexture() {
  if (fabricTexture) return fabricTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2eef8';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(48,36,66,0.05)';
    ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 2) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(48,36,66,0.035)';
    ctx.fillRect(x, 0, 1, 128);
  }
  for (let fold = 0; fold < 11; fold += 1) {
    const x = 6 + fold * 12 + Math.random() * 4;
    const gradient = ctx.createLinearGradient(x - 4, 0, x + 5, 0);
    gradient.addColorStop(0, 'rgba(35,25,50,0)');
    gradient.addColorStop(0.45, `rgba(35,25,50,${0.13 + Math.random() * 0.08})`);
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.24)');
    gradient.addColorStop(1, 'rgba(35,25,50,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 5, 0, 12, 128);
  }
  for (let speck = 0; speck < 160; speck += 1) {
    ctx.fillStyle = `rgba(35,25,50,${0.03 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1 + Math.random() * 2);
  }
  fabricTexture = new THREE.CanvasTexture(canvas);
  fabricTexture.wrapS = THREE.RepeatWrapping;
  fabricTexture.wrapT = THREE.RepeatWrapping;
  fabricTexture.repeat.set(2, 2);
  fabricTexture.colorSpace = THREE.SRGBColorSpace;
  fabricTexture.anisotropy = 2;
  return fabricTexture;
}

function mergedGeometry(geometries) {
  const first = geometries[0];
  if (!first) return null;
  const attributeNames = Object.keys(first.attributes);
  let vertexCount = 0;
  let indexCount = 0;
  for (const geometry of geometries) {
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index ? geometry.index.count : geometry.attributes.position.count;
  }
  const result = new THREE.BufferGeometry();
  for (const name of attributeNames) {
    const template = first.attributes[name];
    const array = new Float32Array(vertexCount * template.itemSize);
    let offset = 0;
    for (const geometry of geometries) {
      const attribute = geometry.attributes[name];
      array.set(attribute.array, offset);
      offset += attribute.count * template.itemSize;
    }
    result.setAttribute(name, new THREE.BufferAttribute(array, template.itemSize, template.normalized));
  }
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let indexOffset = 0;
  let vertexOffset = 0;
  for (const geometry of geometries) {
    if (geometry.index) {
      for (let index = 0; index < geometry.index.count; index += 1) {
        indices[indexOffset] = geometry.index.getX(index) + vertexOffset;
        indexOffset += 1;
      }
    } else {
      const count = geometry.attributes.position.count;
      for (let index = 0; index < count; index += 1) {
        indices[indexOffset] = vertexOffset + index;
        indexOffset += 1;
      }
    }
    vertexOffset += geometry.attributes.position.count;
  }
  result.setIndex(new THREE.BufferAttribute(indices, 1));
  result.computeBoundingSphere();
  return result;
}

// Bake a character's static parts down to one mesh per material. Characters keep
// their silhouette detail while staying cheap to draw on phones.
function mergeStaticGroup(group) {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const origins = [];
  const skips = (object) => {
    let current = object;
    while (current && current !== group) {
      if (current.userData.noMerge) return true;
      current = current.parent;
    }
    return false;
  };
  group.traverse((child) => {
    if (!child.isMesh || skips(child)) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld);
    const geometry = child.geometry.clone().applyMatrix4(matrix);
    if (!buckets.has(child.material)) buckets.set(child.material, []);
    buckets.get(child.material).push(geometry);
    origins.push(child);
  });
  for (const child of origins) {
    child.parent?.remove(child);
    child.geometry.dispose();
  }
  for (const [material, geometries] of buckets) {
    const merged = mergedGeometry(geometries);
    if (!merged) continue;
    group.add(new THREE.Mesh(merged, material));
    for (const geometry of geometries) geometry.dispose();
  }
}

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

let stoneTexture = null;
function getStoneTexture() {
  if (stoneTexture) return stoneTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ece8f3';
  ctx.fillRect(0, 0, 256, 256);
  const tile = 64;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const shade = 236 + ((row * 17 + col * 29) % 16);
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade + 2})`;
      ctx.fillRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
      for (let speck = 0; speck < 6; speck += 1) {
        const x = col * tile + 7 + Math.random() * (tile - 14);
        const y = row * tile + 7 + Math.random() * (tile - 14);
        ctx.fillStyle = `rgba(48, 39, 66, ${0.04 + Math.random() * 0.08})`;
        ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    }
  }
  ctx.strokeStyle = 'rgba(54, 43, 74, 0.4)';
  ctx.lineWidth = 2;
  for (let line = 0; line <= 4; line += 1) {
    ctx.beginPath();
    ctx.moveTo(line * tile, 0);
    ctx.lineTo(line * tile, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, line * tile);
    ctx.lineTo(256, line * tile);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(48, 38, 66, 0.13)';
  ctx.lineWidth = 1;
  for (let crack = 0; crack < 9; crack += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 28, y + Math.random() * 24);
    ctx.stroke();
  }
  stoneTexture = new THREE.CanvasTexture(canvas);
  stoneTexture.wrapS = THREE.RepeatWrapping;
  stoneTexture.wrapT = THREE.RepeatWrapping;
  stoneTexture.colorSpace = THREE.SRGBColorSpace;
  stoneTexture.anisotropy = 4;
  return stoneTexture;
}

function glowPoints(positions, color, size, opacity, colors = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.flat(), 3));
  if (colors) {
    const values = [];
    for (const entry of colors) values.push(...new THREE.Color(entry).toArray());
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(values, 3));
  }
  const material = new THREE.PointsMaterial({
    color: colors ? '#ffffff' : color,
    map: getGlowTexture(),
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    vertexColors: Boolean(colors),
  });
  return new THREE.Points(geometry, material);
}

function addCobweb(scene, position, rotationY = 0, scale = 1) {
  const points = [];
  const spokes = 9;
  const radius = 1.35;
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = (spoke / spokes) * Math.PI * 2;
    points.push(0, 0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  for (let ring = 0.28; ring < 1; ring += 0.24) {
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const a = (spoke / spokes) * Math.PI * 2;
      const b = ((spoke + 1) / spokes) * Math.PI * 2;
      points.push(
        Math.cos(a) * radius * ring,
        Math.sin(a) * radius * ring,
        0,
        Math.cos(b) * radius * ring,
        Math.sin(b) * radius * ring,
        0
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const web = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: '#b9b1c9',
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    })
  );
  web.position.set(...position);
  web.rotation.y = rotationY;
  web.scale.setScalar(scale);
  scene.add(web);
}

function addDust(scene) {
  const positions = [];
  for (let index = 0; index < 480; index += 1) {
    positions.push([
      (Math.random() - 0.5) * 90,
      0.6 + Math.random() * 7.4,
      -55 + Math.random() * 160,
    ]);
  }
  const dust = glowPoints(positions, '#b7a8d8', 0.13, 0.32);
  dust.frustumCulled = false;
  scene.add(dust);
  return dust;
}

function addStars(scene) {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 70 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.abs(Math.cos(phi)) * radius * 0.9 + 5;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#ded7ee',
      map: getGlowTexture(),
      size: 0.42,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  scene.add(stars);

  const moon = sphere(6.4, basic('#cbd6c8', { toneMapped: false }), [34, 52, -82], 24);
  scene.add(moon);
  const halo = sphere(
    11,
    basic('#8ba58f', { transparent: true, opacity: 0.06, toneMapped: false }),
    [34, 52, -82],
    24
  );
  scene.add(halo);
  const outerHalo = sphere(
    17,
    basic('#6f8f7a', { transparent: true, opacity: 0.022, toneMapped: false }),
    [34, 52, -82],
    24
  );
  scene.add(outerHalo);
  return stars;
}

function buildArchitecture(scene) {
  const group = new THREE.Group();
  const corridorMaterial = mat('#211d36', { roughness: 0.92 });
  corridorMaterial.map = getStoneTexture().clone();
  corridorMaterial.map.repeat.set(3, 3);
  corridorMaterial.map.needsUpdate = true;
  const wallMaterial = mat('#332b4c', { roughness: 0.94 });
  const capMaterial = mat('#4c416e', { roughness: 0.7 });
  const railMaterial = basic('#d8b66b', { transparent: true, opacity: 0.65 });

  for (const zone of FLOOR_ZONES) {
    const material = zone.id.startsWith('corridor')
      ? corridorMaterial
      : new THREE.MeshStandardMaterial({
          color: PALETTE[zone.id]?.floor ?? '#2a2340',
          roughness: 0.92,
          metalness: 0.02,
        });
    if (!zone.id.startsWith('corridor')) {
      material.map = getStoneTexture().clone();
      material.map.repeat.set(
        Math.max(2, Math.round(zone.halfW / 2)),
        Math.max(2, Math.round(zone.halfD / 2))
      );
      material.map.needsUpdate = true;
    }
    group.add(box([zone.halfW * 2, 0.36, zone.halfD * 2], material, [zone.x, -0.18, zone.z]));
    if (!zone.id.startsWith('corridor')) {
      const border = box(
        [zone.halfW * 2 + 0.06, 0.02, zone.halfD * 2 + 0.06],
        basic(PALETTE[zone.id]?.accent ?? '#f2ce7b', { transparent: true, opacity: 0.12 }),
        [zone.x, 0.005, zone.z]
      );
      group.add(border);
    }
  }

  for (const corridor of CORRIDORS) {
    const runner = box(
      [corridor.halfW * 1.3, 0.01, corridor.halfD * 1.86],
      basic('#7b5a9a', { transparent: true, opacity: 0.12 }),
      [corridor.x, 0.02, corridor.z]
    );
    group.add(runner);
  }

  WALLS.forEach((wall, index) => {
    const low = LOW_WALLS.has(`${wall.x},${wall.z}`);
    group.add(
      box(
        [wall.w, low ? 1.04 : 3.6, wall.d],
        wallMaterial,
        [wall.x, low ? 0.52 : 1.8, wall.z]
      )
    );
    group.add(
      box(
        [wall.w + 0.22, low ? 0.14 : 0.16, wall.d + 0.22],
        capMaterial,
        [wall.x, low ? 1.08 : 3.66, wall.z]
      )
    );
    if (low) {
      group.add(
        box([wall.w, 0.06, wall.d + 0.08], railMaterial, [wall.x, 1.18, wall.z])
      );
    }
    if (index % 2 === 0) {
      const sconce = sphere(
        0.08,
        basic('#ffd78a', { toneMapped: false }),
        [wall.x, low ? 1.45 : 2.9, wall.z]
      );
      group.add(sconce);
    }
  });

  const door = (x, z, rotationY, accent, openTop = false) => {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotationY;
    for (const offset of [-3.2, 3.2]) {
      doorGroup.add(box([0.45, 3.8, 0.7], wallMaterial, [offset, 1.9, 0]));
      doorGroup.add(
        box([0.2, 0.2, 0.1], basic(accent, { toneMapped: false }), [offset, 2.2, 0.4])
      );
    }
    if (!openTop) {
      doorGroup.add(box([7, 0.45, 0.7], wallMaterial, [0, 3.8, 0]));
      doorGroup.add(
        box([4.2, 0.1, 0.08], basic(accent, { toneMapped: false }), [0, 3.55, 0.38])
      );
    }
    group.add(doorGroup);
  };

  door(0, -10, 0, PALETTE['spellcasting-tower'].accent);
  door(0, 10, 0, PALETTE['rhythm-forest'].accent, true);
  door(0, 74, 0, PALETTE['piano-parlour'].accent);
  door(13, 0, Math.PI / 2, PALETTE['creature-gardens'].accent);
  door(-13, 0, Math.PI / 2, PALETTE['potion-dungeon'].accent);

  scene.add(group);
  return group;
}

function buildGreatHall(scene, house) {
  const group = new THREE.Group();
  const houseDef = HOUSE_OF(house) ?? HOUSE_OF('phoenix');
  const gold = basic('#f2ce7b', { transparent: true, opacity: 0.75 });

  group.add(
    mesh(
      new THREE.PlaneGeometry(4.2, 18),
      mat('#342049', { roughness: 0.98 }),
      [0, 0.025, 0],
      [-Math.PI / 2, 0, 0]
    )
  );
  for (const x of [-2.2, 2.2]) {
    group.add(
      mesh(
        new THREE.PlaneGeometry(0.12, 18),
        basic('#c9a55a', { transparent: true, opacity: 0.55 }),
        [x, 0.03, 0],
        [-Math.PI / 2, 0, 0]
      )
    );
  }

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    group.add(
      cylinder(
        0.5,
        0.65,
        0.12,
        mat('#574a76'),
        [Math.cos(angle) * 9, 0.02, Math.sin(angle) * 6],
        16
      )
    );
  }

  const columnPositions = [
    [-7.4, 3.4],
    [7.4, 3.4],
    [-7.4, -3.6],
    [7.4, -3.6],
  ];
  for (const [x, z] of columnPositions) {
    const column = new THREE.Group();
    column.position.set(x, 0, z);
    column.add(cylinder(0.72, 0.86, 0.64, mat('#554873'), [0, 0.32, 0], 10));
    column.add(cylinder(0.42, 0.54, 4.5, mat('#493c66'), [0, 2.9, 0], 10));
    column.add(cylinder(0.72, 0.5, 0.5, mat('#5d4f7d'), [0, 5.1, 0], 10));
    column.add(sphere(0.12, basic('#f2ce7b', { toneMapped: false }), [0, 5.4, 0], 8));
    group.add(column);
  }

  const bannerMaterials = [];
  function banner(position, rotationY = 0) {
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(...position);
    bannerGroup.rotation.y = rotationY;
    const cloth = mat('#261838', { roughness: 0.9 });
    bannerGroup.add(box([1.8, 3.6, 0.06], cloth, [0, 3, 0]));
    bannerGroup.add(
      cylinder(0.06, 0.06, 2.2, mat('#c9a55a', { metalness: 0.45, roughness: 0.35 }), [0, 4.86, 0], 6)
    );
    const lineA = basic(houseDef.color);
    const lineB = basic(houseDef.color);
    const sigil = basic(houseDef.glow, { toneMapped: false });
    bannerMaterials.push(lineA, lineB, sigil);
    bannerGroup.add(box([1.86, 0.08, 0.03], lineA, [0, 4.66, 0.03]));
    bannerGroup.add(box([1.86, 0.1, 0.03], lineB, [0, 1.23, 0.03]));
    const diamond = box([0.62, 0.62, 0.03], sigil, [0, 3.05, 0.05]);
    diamond.rotation.z = Math.PI / 4;
    bannerGroup.add(diamond);
    bannerGroup.add(torus(0.55, 0.025, basic(houseDef.color), [0, 3.05, 0.06], [0, 0, 0], 18));
    return bannerGroup;
  }

  group.add(banner([-6.4, 0, -9.4]));
  group.add(banner([6.4, 0, -9.4]));
  group.add(banner([7.5, 0, -7]));
  group.add(banner([-10.8, 0, -7], Math.PI / 2));
  group.add(banner([10.8, 0, -7], -Math.PI / 2));

  group.add(torus(4.2, 0.055, gold, [0, 0.04, 0], [-Math.PI / 2, 0, 0], 72));
  group.add(
    mesh(
      new THREE.RingGeometry(3.1, 3.18, 64),
      basic('#f2ce7b', { transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      [0, 0.035, 0],
      [-Math.PI / 2, 0, 0]
    )
  );

  const board = new THREE.Group();
  board.position.set(-7.5, 0, -6.5);
  board.add(box([2.6, 2.1, 0.25], mat('#6a4a36', { roughness: 0.9 }), [0, 1.6, 0]));
  for (const offset of [-0.7, 0, 0.7]) {
    board.add(
      mesh(
        new THREE.PlaneGeometry(0.5, 0.8),
        mat('#f5e6c8', { roughness: 0.95 }),
        [offset, 1.7, 0.15],
        [0, 0, offset * 0.08]
      )
    );
  }
  board.add(box([1.4, 0.32, 0.18], basic('#f2ce7b', { toneMapped: false }), [0, 2.85, 0.02]));
  group.add(board);

  const table = new THREE.Group();
  table.position.set(-7.5, 0, 5.5);
  table.add(cylinder(1.3, 1.5, 0.25, mat('#5a4433'), [0, 0.75, 0], 20));
  table.add(cylinder(0.35, 0.5, 0.7, mat('#453326'), [0, 0.34, 0], 12));
  table.add(
    mesh(
      new THREE.CircleGeometry(1.05, 32),
      mat('#e8d9b5', { roughness: 1 }),
      [0, 0.9, 0],
      [-Math.PI / 2, 0, 0.3]
    )
  );
  table.add(
    mesh(
      new THREE.RingGeometry(0.55, 0.62, 32),
      basic('#b08be8', { transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      [0, 0.92, 0],
      [-Math.PI / 2, 0, 0.3]
    )
  );
  group.add(table);

  addCobweb(scene, [-11.8, 2.2, -9.55], 0, 0.9);
  addCobweb(scene, [11.8, 2.2, -9.55], 0, 0.9);

  const candles = [];
  for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) {
    const candle = new THREE.Group();
    candle.position.set(x, 3, z);
    candle.add(cylinder(0.1, 0.13, 0.45, mat('#f1e6d0'), [0, 0, 0], 8));
    const flame = sphere(0.07, basic('#ffd27d', { toneMapped: false }), [0, 0.3, 0], 8);
    candle.add(flame);
    group.add(candle);
    candles.push({ group: candle, flame });
  }
  group.add(
    glowPoints(
      candles.map(({ group: candle }) => [
        candle.position.x,
        candle.position.y + 0.35,
        candle.position.z,
      ]),
      '#ffb35e',
      2.2,
      0.38
    )
  );

  scene.add(group);
  return { group, bannerMaterials, candles };
}

function buildFocusPedestal(scene, point, accent, shape, delay = 0) {
  const group = new THREE.Group();
  group.position.set(point.x, 0, point.z);
  group.add(cylinder(1.1, 1.35, 0.56, mat('#4a3d63'), [0, 0.28, 0], 8));
  group.add(
    cylinder(
      1.35,
      1.35,
      0.06,
      basic(accent, { transparent: true, opacity: 0.5 }),
      [0, 0.57, 0],
      8
    )
  );

  const floating = new THREE.Group();
  const baseY = shape === 'crystal' ? 1.5 : shape === 'piano' ? 1.35 : 1.05;
  floating.position.y = baseY;
  if (shape === 'crystal') {
    floating.add(
      mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        mat(accent, {
          emissive: accent,
          emissiveIntensity: 0.8,
          roughness: 0.15,
          metalness: 0.2,
        })
      )
    );
    floating.add(torus(0.95, 0.02, basic(accent, { transparent: true, opacity: 0.4 }), [0, 0, 0], [Math.PI / 2, 0, 0], 36));
  } else if (shape === 'cauldron') {
    floating.add(
      mesh(
        new THREE.SphereGeometry(0.72, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mat('#2c2638', { roughness: 0.7 })
      )
    );
    floating.add(
      mesh(
        new THREE.CircleGeometry(0.64, 24),
        basic(accent, { toneMapped: false }),
        [0, 0.12, 0],
        [-Math.PI / 2, 0, 0]
      )
    );
  } else if (shape === 'piano') {
    const lacquer = mat('#24152f', { roughness: 0.32, metalness: 0.28 });
    const ivory = mat('#f7edd6', { roughness: 0.5 });
    const piano = new THREE.Group();
    piano.add(box([1.32, 0.24, 0.96], lacquer, [0, 0, -0.08]));
    piano.add(box([1.26, 0.05, 0.86], lacquer, [0, 0.17, -0.18], [0.16, 0, 0]));
    piano.add(box([1.38, 0.06, 0.26], ivory, [0, 0.14, 0.4]));
    for (const keyX of [-0.42, -0.24, 0.02, 0.2, 0.44]) {
      piano.add(box([0.09, 0.06, 0.14], lacquer, [keyX, 0.19, 0.37]));
    }
    for (const [legX, legZ] of [
      [-0.55, -0.42],
      [0.55, -0.42],
      [0, 0.34],
    ]) {
      piano.add(cylinder(0.035, 0.045, 0.55, lacquer, [legX, -0.36, legZ], 6));
    }
    piano.add(
      torus(0.9, 0.02, basic(accent, { transparent: true, opacity: 0.45 }), [0, -0.12, 0], [Math.PI / 2, 0, 0], 36)
    );
    floating.add(piano);
  } else {
    floating.add(cylinder(0.75, 0.7, 0.72, mat('#5b4030', { roughness: 0.9 }), [0, 0, 0], 16));
    floating.add(
      mesh(
        new THREE.CircleGeometry(0.7, 20),
        basic(accent, { toneMapped: false }),
        [0, 0.38, 0],
        [-Math.PI / 2, 0, 0]
      )
    );
  }
  group.add(floating);

  const halo = torus(
    shape === 'crystal' ? 1.1 : 1.4,
    0.025,
    basic(accent, { transparent: true, opacity: 0.3 }),
    [0, 0.62, 0],
    [-Math.PI / 2, 0, 0],
    40
  );
  group.add(halo);
  scene.add(group);
  return { group, floating, halo, baseY, speed: 1.1, delay };
}

function buildTower(scene) {
  const group = new THREE.Group();
  for (const [index, x] of [-6.5, -3.5, 0, 3.5, 6.5].entries()) {
    const shelf = new THREE.Group();
    shelf.position.set(x, 0, -48.4);
    shelf.add(box([2.4, 4.4, 1], mat('#3b3158', { roughness: 0.9 }), [0, 2.2, 0]));
    for (const y of [0.8, 1.7, 2.6, 3.5]) {
      shelf.add(box([2.1, 0.12, 0.1], mat('#6a5a8f'), [0, y, 0.55]));
    }
    for (let bookIndex = 0; bookIndex < 3; bookIndex += 1) {
      shelf.add(
        box(
          [0.18, 0.5, 0.26],
          mat(['#d8a65c', '#8fa4e8', '#c77abf', '#7fc4ab'][(index + bookIndex) % 4], {
            roughness: 0.75,
          }),
          [0.5 + bookIndex * 0.6 - 0.7, 1.9 + (bookIndex % 3) * 0.72, 0.55],
          [0, 0, (bookIndex - 1) * 0.12]
        )
      );
    }
    group.add(shelf);
  }
  group.add(
    mesh(
      new THREE.RingGeometry(3.4, 3.5, 48),
      basic('#a99bff', { transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      [0, 0.03, -42],
      [-Math.PI / 2, 0, 0]
    )
  );
  for (const x of [-2.8, 2.8]) {
    group.add(
      torus(
        0.8,
        0.05,
        basic('#c6b8ff', { transparent: true, opacity: 0.55 }),
        [x, 3.6, -44],
        [0, 0, Math.PI / 2],
        32
      )
    );
  }
  scene.add(group);
}

function buildGardens(scene) {
  const group = new THREE.Group();
  group.add(
    mesh(
      new THREE.CircleGeometry(3.3, 32),
      mat('#3f8fa6', { roughness: 0.25, metalness: 0.15 }),
      [47, 0.03, 5.5],
      [-Math.PI / 2, 0, 0]
    )
  );
  group.add(
    mesh(
      new THREE.RingGeometry(3.3, 3.5, 32),
      basic('#8fe0a8', { transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      [47, 0.04, 5.5],
      [-Math.PI / 2, 0, 0]
    )
  );

  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2;
    const radius = 3.2 + (index % 4) * 1.4;
    const flower = new THREE.Group();
    flower.position.set(
      42 + Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius * 0.75
    );
    flower.add(cylinder(0.03, 0.03, 0.5, mat('#3f7c54'), [0, 0.25, 0], 5));
    flower.add(
      sphere(
        0.11,
        basic(['#ffd9e8', '#ffe6a8', '#cdbaff'][index % 3], { toneMapped: false }),
        [0, 0.55, 0],
        6
      )
    );
    group.add(flower);
  }

  const creatures = [];
  const spots = [
    [37, -6],
    [47, -5],
    [36, 5],
    [49, -2],
  ];
  spots.forEach(([x, z], index) => {
    const creature = makeGardenCreature(index, x, z);
    group.add(creature);
    creatures.push(creature);
  });

  group.add(sphere(0.65, mat('#3e6c4d', { roughness: 0.9 }), [38, 0.5, 4], 7));
  group.add(sphere(0.45, mat('#4d7c5a', { roughness: 0.9 }), [38, 1.1, 4], 7));
  scene.add(group);
  return creatures;
}

function buildDungeon(scene) {
  const group = new THREE.Group();
  for (const z of [-4.2, 4.2]) {
    const barrel = new THREE.Group();
    barrel.position.set(-48, 0, z);
    barrel.add(cylinder(0.55, 0.7, 1.5, mat('#58402f', { roughness: 0.95 }), [0, 0.75, 0], 12));
    barrel.add(torus(0.56, 0.06, basic('#8d7350'), [0, 1.52, 0], [Math.PI / 2, 0, 0], 20));
    group.add(barrel);
  }
  for (const z of [-7, 7]) {
    group.add(sphere(0.16, basic('#7fd6c9', { toneMapped: false }), [-45.5, 3, z + 0.2], 8));
    group.add(cylinder(0.02, 0.02, 0.55, basic('#5e5468'), [-45.5, 2.8, z + 0.2], 4));
  }
  group.add(
    mesh(
      new THREE.RingGeometry(2.6, 2.7, 40),
      basic('#7fd6c9', { transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      [-42, 0.03, 0],
      [-Math.PI / 2, 0, 0]
    )
  );
  group.add(
    mesh(
      new THREE.CircleGeometry(2.2, 24),
      mat('#294b46', { roughness: 0.6 }),
      [-49, 0.04, 0],
      [-Math.PI / 2, 0, 0]
    )
  );
  scene.add(group);
}

function buildForest(scene) {
  const group = new THREE.Group();
  const trees = [
    [6, 38],
    [-6, 38],
    [8.5, 44],
    [-8.5, 44],
    [5.5, 49],
    [-5.5, 49],
  ];
  for (const [x, z] of trees) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.add(cylinder(0.28, 0.46, 3.6, mat('#4b3a2c', { roughness: 0.95 }), [0, 1.8, 0], 7));
    tree.add(cone(1.7, 2.6, mat('#2d5c42', { roughness: 0.9 }), [0, 4.1, 0], 8));
    tree.add(cone(1.2, 2.1, mat('#376d4b', { roughness: 0.9 }), [0, 5.25, 0], 8));
    tree.add(sphere(0.08, basic('#d7ff9a', { toneMapped: false }), [0.4, 4.6, 0.4], 6));
    group.add(tree);
  }
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    const radius = 3 + (index % 3) * 1.8;
    const mushroom = new THREE.Group();
    mushroom.position.set(
      Math.cos(angle) * radius,
      0,
      42 + Math.sin(angle) * radius * 0.7
    );
    mushroom.add(cylinder(0.04, 0.06, 0.4, mat('#c9b08a'), [0, 0.2, 0], 5));
    mushroom.add(
      mesh(
        new THREE.SphereGeometry(0.12, 6, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        mat('#d7b36a', { emissive: '#8a6b2d', emissiveIntensity: 0.4 }),
        [0, 0.45, 0]
      )
    );
    group.add(mushroom);
  }
  group.add(
    mesh(
      new THREE.RingGeometry(2.4, 2.52, 40),
      basic('#b9d87d', { transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      [0, 0.03, 42],
      [-Math.PI / 2, 0, 0]
    )
  );

  const fireflyPositions = [];
  for (let index = 0; index < 55; index += 1) {
    fireflyPositions.push(
      (Math.random() - 0.5) * 20,
      0.8 + Math.random() * 5,
      33 + Math.random() * 17
    );
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(fireflyPositions, 3)
  );
  const fireflies = new THREE.Points(
    fireflyGeometry,
    new THREE.PointsMaterial({
      color: '#eaffb0',
      map: getGlowTexture(),
      size: 0.24,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(fireflies);
  scene.add(group);
  return fireflies;
}

function buildParlour(scene) {
  const group = new THREE.Group();
  const accent = PALETTE['piano-parlour'].accent;
  group.add(
    mesh(
      new THREE.CircleGeometry(4.4, 44),
      mat('#4a3250', { roughness: 0.96 }),
      [0, 0.03, 84],
      [-Math.PI / 2, 0, 0]
    )
  );
  group.add(
    mesh(
      new THREE.RingGeometry(4.4, 4.52, 48),
      basic(accent, { transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      [0, 0.04, 84],
      [-Math.PI / 2, 0, 0]
    )
  );
  for (const [x, z] of [
    [-7.5, 90],
    [7.5, 90],
  ]) {
    const stand = new THREE.Group();
    stand.position.set(x, 0, z);
    stand.add(cylinder(0.5, 0.62, 0.08, mat('#5a4058'), [0, 0.04, 0], 16));
    stand.add(cylinder(0.07, 0.11, 2.5, mat('#5a4058'), [0, 1.25, 0], 8));
    for (const offset of [-0.32, 0, 0.32]) {
      stand.add(cylinder(0.03, 0.03, 0.3, mat('#e8d9b5'), [offset, 2.58, 0], 6));
      stand.add(sphere(0.06, basic('#ffd9a1', { toneMapped: false }), [offset, 2.77, 0], 8));
    }
    group.add(stand);
  }
  for (let index = 0; index < 20; index += 1) {
    const angle = (index / 20) * Math.PI * 2;
    const radius = 2.4 + (index % 4) * 1.2;
    group.add(
      sphere(
        0.035 + (index % 3) * 0.015,
        basic(accent, { toneMapped: false, transparent: true, opacity: 0.7 }),
        [
          Math.cos(angle) * radius,
          1.2 + (index % 6) * 0.55,
          84 + Math.sin(angle) * radius * 0.75,
        ],
        6
      )
    );
  }
  scene.add(group);
}

function buildSeals(scene) {
  const seals = new Map();
  for (const barrier of BARRIERS) {
    const accent = PALETTE[barrier.room].accent;
    const group = new THREE.Group();
    group.position.set(barrier.x, 0, barrier.z);
    group.rotation.y = barrier.rotationY;
    group.add(
      mesh(
        new THREE.PlaneGeometry(5.6, 3.2),
        basic(accent, { transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
        [0, 1.7, 0]
      )
    );
    group.add(
      mesh(
        new THREE.PlaneGeometry(5.2, 2.9),
        basic(accent, { transparent: true, opacity: 0.09, side: THREE.DoubleSide }),
        [0, 1.7, 0.02]
      )
    );
    const rings = new THREE.Group();
    rings.position.set(0, 1.75, 0.05);
    for (const [index, radius] of [0.5, 0.9, 1.3].entries()) {
      const ring = torus(
        radius,
        0.035,
        basic(accent, { transparent: true, opacity: 0.85 }),
        [0, 0, 0],
        [0, 0, index * 0.5],
        48
      );
      rings.add(ring);
    }
    rings.add(torus(0.34, 0.05, basic(accent), [0, 0, 0], [0, 0, 0], 32));
    group.add(rings);
    scene.add(group);
    seals.set(barrier.room, { group, rings });
  }
  return seals;
}

function buildLabelLayer(layer) {
  const labels = [];
  const anchor = (inner, x, z, height, radius) => {
    const wrap = document.createElement('div');
    wrap.className = 'world-label-anchor';
    wrap.append(inner);
    layer.append(wrap);
    labels.push({ el: wrap, x, z, y: height, radius });
    return wrap;
  };

  return { labels, anchor };
}

function addRoomSigns(scene, labelLayer) {
  for (const room of ROOMS) {
    if (room.id === 'great-hall') continue;
    const zone = ROOM_ZONES[room.id];
    const inner = document.createElement('div');
    inner.className = 'world-label room-sign';
    inner.style.borderColor = room.accent;
    const icon = document.createElement('span');
    icon.className = 'room-sign-icon';
    icon.textContent = room.icon;
    const name = document.createElement('span');
    name.textContent = room.shortName;
    inner.append(icon, name);
    labelLayer.anchor(
      inner,
      zone.x,
      zone.z + (['rhythm-forest', 'piano-parlour'].includes(room.id) ? -4 : 4),
      4.6,
      14
    );
  }
}

function addChallengeLabels(scene, labelLayer) {
  for (const point of INTERACTIONS) {
    if (point.kind !== 'challenge') continue;
    const palette = PALETTE[point.room];
    if (!palette) continue;
    const inner = document.createElement('div');
    inner.className = 'world-label';
    inner.style.borderColor = palette.accent;
    const icon = document.createElement('span');
    icon.textContent = '✦';
    icon.style.color = palette.accent;
    const name = document.createElement('span');
    name.textContent = point.title ?? point.label;
    inner.append(icon, name);
    labelLayer.anchor(inner, point.x, point.z, point.skill === 'rhythm' ? 2.35 : 2.9, 11);
  }
}

function addNpcLabels(scene, labelLayer) {
  const points = INTERACTIONS.filter((point) => point.kind === 'npc');
  for (const point of points) {
    const inner = document.createElement('div');
    inner.className = 'npc-tag';
    const sigil = document.createElement('span');
    sigil.className = 'npc-tag-sigil';
    sigil.textContent =
      point.npcKey === 'headmistress'
        ? '♛'
        : point.npcKey === 'spirit'
          ? '♣'
          : point.npcKey === 'maestro'
            ? '♬'
            : '✦';
    const name = document.createElement('span');
    name.textContent =
      point.npcKey === 'headmistress'
        ? 'Headmistress Morrow'
        : point.npcKey === 'archmage'
          ? 'Archmage Tilly'
          : point.npcKey === 'keeper'
            ? 'Keeper Fern'
            : point.npcKey === 'potionmaster'
              ? 'Master Bramble'
              : point.npcKey === 'maestro'
                ? 'Maestro Cadence'
                : 'The Mosslight Spirit';
    inner.append(sigil, name);
    labelLayer.anchor(inner, point.x, point.z, point.npcKey === 'spirit' ? 2.6 : 3.1, 9);
  }
}

/* ------------------------------------------------------------- characters */

function makeWizard() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const fabric = getFabricTexture();
  const robe = new THREE.MeshStandardMaterial({
    color: '#b6a3f5',
    map: fabric,
    roughness: 0.82,
    metalness: 0.02,
    flatShading: true,
  });
  const robeDark = new THREE.MeshStandardMaterial({
    color: '#4f3d6e',
    map: fabric,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });
  const capeMaterial = new THREE.MeshStandardMaterial({
    color: '#332442',
    map: fabric,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const trim = mat('#f2ce7b', { roughness: 0.38, metalness: 0.42 });
  const glow = basic('#ded2ff', { toneMapped: false });
  const skin = mat('#f0c6a1', { roughness: 0.72 });
  const skinShade = mat('#d8a47f', { roughness: 0.76 });
  const hair = mat('#2a1c36', { roughness: 0.88 });
  const leather = mat('#3b2733', { roughness: 0.92 });
  const dark = mat('#1a1228', { roughness: 0.9 });
  const eyeWhite = mat('#f7eedb', { roughness: 0.35 });
  const eyeDark = basic('#171022');
  const glint = basic('#fff8e8', { toneMapped: false });
  const crystal = new THREE.MeshStandardMaterial({
    color: '#ffe8b0',
    emissive: '#ffb75c',
    emissiveIntensity: 1.25,
    roughness: 0.18,
    metalness: 0.25,
  });

  group.add(
    mesh(
      new THREE.CircleGeometry(0.62, 24),
      basic('#05030c', { transparent: true, opacity: 0.34 }),
      [0, 0.02, 0],
      [-Math.PI / 2, 0, 0]
    )
  );

  // Boots and layered robe.
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.12, 0.09, 0.2, leather, [side * 0.17, 0.11, 0.13], [0, 0, 0], 10));
    body.add(cylinder(0.1, 0.12, 0.18, leather, [side * 0.17, 0.2, -0.02], 8));
  }
  body.add(cone(0.62, 0.98, robeDark, [0, 0.55, 0], 16));
  body.add(cone(0.56, 1.02, robe, [0, 0.6, 0], 16));
  body.add(torus(0.55, 0.028, trim, [0, 0.15, 0], [Math.PI / 2, 0, 0], 28));
  body.add(torus(0.43, 0.018, trim, [0, 0.93, 0], [Math.PI / 2, 0, 0], 24));
  for (let rune = 0; rune < 5; rune += 1) {
    const angle = (rune / 5) * Math.PI * 2 + 0.3;
    body.add(
      mesh(new THREE.OctahedronGeometry(0.025, 0), glow, [
        Math.cos(angle) * 0.54,
        0.28,
        Math.sin(angle) * 0.54,
      ])
    );
  }
  body.add(cylinder(0.36, 0.31, 0.52, robe, [0, 1.2, 0], 16));
  body.add(torus(0.35, 0.055, trim, [0, 1.01, 0], [Math.PI / 2, 0, 0], 28));
  body.add(sphere(0.055, trim, [0, 1.02, 0.37], 10));
  body.add(box([0.07, 0.32, 0.03], trim, [0, 0.84, 0.38], [0.12, 0, 0]));
  body.add(sphere(0.05, glow, [0, 1.28, 0.33], 8));
  body.add(box([0.07, 0.07, 0.04], trim, [0, 1.28, 0.36], [0, 0, Math.PI / 4]));

  const mantle = mesh(
    new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    robeDark
  );
  mantle.position.set(0, 1.34, 0);
  mantle.scale.set(1.12, 0.62, 1.06);
  body.add(mantle);
  body.add(torus(0.46, 0.028, trim, [0, 1.3, 0], [Math.PI / 2, 0, 0], 28));
  const cape = mesh(
    new THREE.CylinderGeometry(0.4, 0.67, 1.02, 18, 1, true, Math.PI / 2, Math.PI),
    capeMaterial,
    [0, 0.92, -0.02]
  );
  body.add(cape);
  body.add(
    mesh(
      new THREE.CylinderGeometry(0.66, 0.67, 0.035, 18, 1, true, Math.PI / 2, Math.PI),
      trim,
      [0, 0.4, -0.02]
    )
  );
  body.add(mesh(new THREE.OctahedronGeometry(0.1, 0), glow, [0, 1.16, -0.53]));
  body.add(torus(0.14, 0.012, trim, [0, 1.16, -0.53], [0, 0, 0], 20));
  for (const x of [-0.24, 0, 0.24]) {
    body.add(mesh(new THREE.OctahedronGeometry(0.024, 0), trim, [x, 0.44, -0.68]));
  }
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.19, 0.12, 0.18, robe, [side * 0.42, 1.4, 0], [0, 0, 0], 12));
    body.add(torus(0.16, 0.018, trim, [side * 0.42, 1.38, 0], [Math.PI / 2, 0, 0], 16));
  }
  body.add(box([0.16, 0.3, 0.05], robeDark, [-0.16, 1.59, -0.03], [0, 0.15, 0.3]));
  body.add(box([0.16, 0.3, 0.05], robeDark, [0.16, 1.59, -0.03], [0, -0.15, -0.3]));

  function addArm(side, holdingStaff) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 1.38, 0);
    pivot.rotation.z = side * 0.18;
    pivot.rotation.x = holdingStaff ? 0.12 : 0.04;
    pivot.add(capsule(0.09, 0.33, robe, [0, -0.17, 0], [0, 0, 0], 10));
    const fore = new THREE.Group();
    fore.position.set(0, -0.36, 0);
    fore.rotation.x = holdingStaff ? -0.7 : 0.12;
    fore.rotation.z = side * 0.12;
    fore.add(capsule(0.075, 0.28, robe, [0, -0.13, 0], [0, 0, 0], 10));
    fore.add(cylinder(0.09, 0.1, 0.07, trim, [0, -0.29, 0], 10));
    fore.add(sphere(0.075, skin, [0, -0.36, 0.015], 12));
    if (holdingStaff) {
      fore.add(capsule(0.015, 0.05, skin, [-0.035, -0.37, 0.07], [Math.PI / 2, 0, 0], 6));
      fore.add(capsule(0.015, 0.05, skin, [0.035, -0.37, 0.07], [Math.PI / 2, 0, 0], 6));
    }
    pivot.add(fore);
    body.add(pivot);
  }
  addArm(-1, false);
  addArm(1, true);

  const headY = 1.68;
  body.add(ellipsoid(0.275, 0.29, 0.26, skin, [0, headY, 0.01], [0, 0, 0], 20));
  body.add(ellipsoid(0.21, 0.14, 0.2, skin, [0, headY - 0.12, 0.04], [0, 0, 0], 16));
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.045, 0.075, 0.035, skin, [side * 0.26, headY - 0.01, 0.02], [0, 0, 0], 10));
    body.add(ellipsoid(0.062, 0.075, 0.035, eyeWhite, [side * 0.095, headY + 0.035, 0.245], [0, 0, 0], 12));
    body.add(sphere(0.027, eyeDark, [side * 0.095, headY + 0.03, 0.278], 8));
    body.add(sphere(0.009, glint, [side * 0.085, headY + 0.05, 0.3], 6));
    body.add(box([0.11, 0.018, 0.022], hair, [side * 0.095, headY + 0.13, 0.255], [0, 0, side * 0.12]));
    body.add(box([0.04, 0.16, 0.05], hair, [side * 0.25, headY - 0.12, 0.02]));
  }
  const nose = cone(0.035, 0.095, skinShade, [0, headY - 0.02, 0.29], 6);
  nose.rotation.x = Math.PI / 2;
  body.add(nose);
  body.add(
    mesh(
      new THREE.TorusGeometry(0.06, 0.012, 4, 12, Math.PI),
      dark,
      [0, headY - 0.11, 0.265],
      [0, 0, Math.PI]
    )
  );
  body.add(
    mesh(
      new THREE.SphereGeometry(0.285, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hair,
      [0, headY + 0.015, -0.01]
    )
  );
  for (const [x, y, z, sx, sy, sz] of [
    [-0.21, headY - 0.03, -0.16, 0.08, 0.16, 0.08],
    [0.21, headY - 0.03, -0.16, 0.08, 0.16, 0.08],
    [-0.11, headY + 0.08, -0.22, 0.1, 0.11, 0.08],
    [0.11, headY + 0.08, -0.22, 0.1, 0.11, 0.08],
    [-0.17, headY + 0.15, 0.225, 0.06, 0.08, 0.035],
    [0.17, headY + 0.15, 0.225, 0.06, 0.08, 0.035],
    [0, headY + 0.17, 0.24, 0.055, 0.07, 0.03],
  ]) {
    body.add(ellipsoid(sx, sy, sz, hair, [x, y, z], [0, 0, 0], 10));
  }

  const hat = new THREE.Group();
  hat.position.set(0, 1.96, 0);
  hat.rotation.z = -0.06;
  hat.add(cylinder(0.48, 0.56, 0.045, robeDark, [0, 0, 0], 18));
  hat.add(torus(0.5, 0.02, trim, [0, -0.012, 0], [Math.PI / 2, 0, 0], 28));
  hat.add(cone(0.37, 0.55, robe, [0, 0.3, 0], 16));
  hat.add(torus(0.36, 0.035, trim, [0, 0.06, 0], [Math.PI / 2, 0, 0], 24));
  hat.add(mesh(new THREE.OctahedronGeometry(0.065, 0), glow, [0, 0.06, 0.37]));
  const tip = cone(0.22, 0.38, robe, [0.075, 0.58, 0], 12);
  tip.rotation.z = -0.45;
  hat.add(tip);
  hat.add(sphere(0.075, trim, [0.16, 0.75, 0], 10));
  for (const [x, y, z] of [
    [0.12, 0.34, 0.3],
    [-0.16, 0.22, 0.26],
    [0.03, 0.46, 0.25],
  ]) {
    hat.add(mesh(new THREE.OctahedronGeometry(0.028, 0), trim, [x, y, z]));
  }
  body.add(hat);

  // Gnarled staff with a wrapped grip and caged crystal.
  const wood = mat('#4b3323', { roughness: 0.95 });
  const staff = new THREE.Group();
  staff.position.set(0.55, 0, 0.2);
  staff.rotation.z = -0.05;
  staff.add(cylinder(0.032, 0.05, 1.75, wood, [0, 0.875, 0], 8));
  staff.add(cylinder(0.045, 0.035, 0.16, wood, [0.035, 0.5, 0.01], 7));
  staff.add(sphere(0.055, wood, [0.04, 0.95, 0.01], 8));
  for (const y of [0.72, 0.8, 0.88]) {
    staff.add(torus(0.045, 0.012, leather, [0, y, 0], [Math.PI / 2, 0, 0], 12));
  }
  for (const side of [-1, 1]) {
    staff.add(cylinder(0.018, 0.028, 0.3, wood, [side * 0.065, 1.95, 0], 6));
  }
  staff.add(mesh(new THREE.OctahedronGeometry(0.13, 0), crystal, [0, 2.03, 0]));
  staff.add(torus(0.19, 0.012, trim, [0, 2.03, 0], [0, 0, 0], 18));
  staff.add(torus(0.19, 0.012, trim, [0, 2.03, 0], [Math.PI / 2, 0, 0], 18));
  const staffGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: '#ffd9a0',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  staffGlow.position.set(0, 2.03, 0);
  staffGlow.scale.set(0.95, 0.95, 1);
  staff.add(staffGlow);
  body.add(staff);

  mergeStaticGroup(body);

  const owl = new THREE.Group();
  owl.position.set(-0.88, 1.62, 0.28);
  owl.rotation.y = Math.PI;
  const owlBody = new THREE.Group();
  const owlFeather = mat('#b8a6d9', { roughness: 0.72 });
  const owlLight = mat('#d8c9f2', { roughness: 0.66 });
  const owlDark = mat('#6f5a94', { roughness: 0.8 });
  const owlBeak = mat('#e0a24e', { roughness: 0.58 });
  const owlEyeWhite = mat('#f8f0dc', { roughness: 0.4 });
  const owlEyeDark = basic('#1c1530');
  owlBody.add(ellipsoid(0.24, 0.28, 0.22, owlFeather, [0, 0, 0], [0, 0, 0], 16));
  owlBody.add(ellipsoid(0.18, 0.2, 0.16, owlLight, [0, -0.02, 0.08], [0, 0, 0], 14));
  owlBody.add(ellipsoid(0.18, 0.17, 0.16, owlFeather, [0, 0.22, 0.02], [0, 0, 0], 14));
  for (const side of [-1, 1]) {
    owlBody.add(ellipsoid(0.11, 0.13, 0.03, owlLight, [side * 0.085, 0.23, 0.16], [0, 0, 0], 12));
    owlBody.add(ellipsoid(0.055, 0.07, 0.015, owlEyeWhite, [side * 0.085, 0.24, 0.18], [0, 0, 0], 10));
    owlBody.add(sphere(0.03, owlEyeDark, [side * 0.085, 0.24, 0.195], 8));
    owlBody.add(sphere(0.009, glint, [side * 0.075, 0.255, 0.207], 6));
    owlBody.add(cone(0.06, 0.18, owlFeather, [side * 0.1, 0.38, 0], [0, 0, side * -0.35], 6));
  }
  owlBody.add(cone(0.04, 0.09, owlBeak, [0, 0.18, 0.22], [Math.PI / 2, 0, 0], 6));
  owlBody.add(ellipsoid(0.15, 0.12, 0.03, owlLight, [0, 0.12, -0.19], [0.2, 0, 0], 10));
  owlBody.add(ellipsoid(0.12, 0.09, 0.025, owlFeather, [0, 0, -0.21], [0.1, 0, 0], 10));
  for (const [x, tilt] of [
    [-0.08, -0.25],
    [0, 0],
    [0.08, 0.25],
  ]) {
    owlBody.add(ellipsoid(0.07, 0.17, 0.018, owlDark, [x, -0.19, -0.2], [0.55, 0, tilt], 8));
  }
  for (const side of [-1, 1]) {
    for (let toe = -1; toe <= 1; toe += 1) {
      owlBody.add(
        cylinder(
          0.012,
          0.012,
          0.1,
          owlBeak,
          [side * 0.07 + toe * 0.018, -0.27, 0.06],
          4
        )
      );
    }
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.21, 0.02, 0);
    wing.userData.noMerge = true;
    wing.add(
      ellipsoid(0.12, 0.22, 0.03, owlFeather, [side * 0.04, -0.02, -0.035], [0.1, 0, side * 0.35], 9)
    );
    for (let feather = 0; feather < 3; feather += 1) {
      wing.add(
        ellipsoid(
          0.085 - feather * 0.01,
          0.18,
          0.025,
          owlDark,
          [side * (0.04 + feather * 0.025), -0.05 - feather * 0.035, -0.05 - feather * 0.025],
          [0.12, 0, side * (0.62 + feather * 0.2)],
          8
        )
      );
    }
    mergeStaticGroup(wing);
    owlBody.add(wing);
    wings.push({ wing, side });
  }
  mergeStaticGroup(owlBody);

  const scarf = new THREE.Group();
  scarf.add(
    torus(
      0.2,
      0.04,
      mat('#f2ce7b', { emissive: '#8a6b20', emissiveIntensity: 0.35 }),
      [0, -0.08, 0.02],
      [Math.PI / 2, 0, 0],
      18
    )
  );
  scarf.add(box([0.12, 0.28, 0.03], trim, [-0.1, -0.2, 0.02], [0, 0, 0.2]));
  scarf.add(box([0.1, 0.2, 0.03], trim, [0.08, -0.16, 0.02], [0, 0, -0.15]));
  scarf.add(mesh(new THREE.OctahedronGeometry(0.04, 0), glow, [0, -0.08, 0.22]));
  scarf.visible = false;
  owlBody.add(scarf);

  const crown = new THREE.Group();
  crown.add(torus(0.13, 0.025, trim, [0, 0.36, 0.03], [Math.PI / 2, 0, 0], 16));
  for (let point = 0; point < 5; point += 1) {
    const angle = (point / 5) * Math.PI * 2;
    crown.add(
      cone(
        0.025,
        0.11,
        trim,
        [Math.cos(angle) * 0.13, 0.43, 0.03 + Math.sin(angle) * 0.13],
        5
      )
    );
  }
  crown.visible = false;
  owlBody.add(crown);
  owl.add(owlBody);
  group.add(owl);

  return {
    group,
    body,
    owl,
    owlBody,
    wings,
    scarf,
    crown,
    staffCrystal: crystal,
    materials: { robe, robeDark, cape: capeMaterial, trim, glow, skin },
  };
}

function makeNpc({
  name,
  x,
  z,
  robe,
  trim,
  skin = '#f1c9a5',
  rotation = 0,
  height = 1,
  staff = false,
  antlers = false,
  variant = 'archmage',
  hair = '#2b1d33',
}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.scale.setScalar(height);
  group.add(
    mesh(
      new THREE.CircleGeometry(0.55, 20),
      basic('#080512', { transparent: true, opacity: 0.3 }),
      [0, 0.015, 0],
      [-Math.PI / 2, 0, 0]
    )
  );

  const body = new THREE.Group();
  group.add(body);
  const fabric = getFabricTexture();
  const robeMat = new THREE.MeshStandardMaterial({
    color: robe,
    map: fabric,
    roughness: 0.82,
    metalness: 0.02,
    flatShading: true,
    emissive: shadeColor(robe, 0.24),
    emissiveIntensity: 0.14,
  });
  const robeDark = new THREE.MeshStandardMaterial({
    color: shadeColor(robe, 0.52),
    map: fabric,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: true,
    emissive: shadeColor(robe, 0.14),
    emissiveIntensity: 0.08,
  });
  const trimMat = mat(trim, {
    roughness: 0.4,
    metalness: 0.38,
    emissive: trim,
    emissiveIntensity: 0.12,
  });
  const glowMat = basic(trim, { toneMapped: false });
  const skinMat = mat(skin, { roughness: 0.72, emissive: skin, emissiveIntensity: 0.1 });
  const skinShade = mat(shadeColor(skin, 0.78), { roughness: 0.76 });
  const hairMat = mat(hair, { roughness: 0.88, emissive: hair, emissiveIntensity: 0.04 });
  const leather = mat('#3b2733', { roughness: 0.92 });
  const dark = mat('#171022', { roughness: 0.9 });
  const eyeWhite = mat('#f7eedb', { roughness: 0.35 });
  const eyeDark = basic('#171022');
  const glint = basic('#fff8e8', { toneMapped: false });
  const glass = basic('#bfe8ff', {
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const leaf = mat('#3e7a4c', {
    roughness: 0.8,
    emissive: '#17351f',
    emissiveIntensity: 0.12,
  });
  const leafLight = mat('#7fbf8a', {
    roughness: 0.7,
    emissive: '#315c3a',
    emissiveIntensity: 0.1,
  });

  // Boots, layered skirt, and tailored torso.
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.11, 0.08, 0.18, leather, [side * 0.16, 0.1, 0.12], [0, 0, 0], 9));
    body.add(cylinder(0.09, 0.11, 0.16, leather, [side * 0.16, 0.18, -0.02], 8));
  }
  body.add(cone(0.58, 0.95, robeDark, [0, 0.54, 0], 16));
  body.add(cone(0.53, 1, robeMat, [0, 0.59, 0], 16));
  body.add(torus(0.52, 0.027, trimMat, [0, 0.15, 0], [Math.PI / 2, 0, 0], 26));
  body.add(cylinder(0.34, 0.3, 0.52, robeMat, [0, 1.18, 0], 16));
  body.add(torus(0.34, 0.05, trimMat, [0, 0.99, 0], [Math.PI / 2, 0, 0], 26));
  body.add(sphere(0.05, glowMat, [0, 1.02, 0.35], 8));
  body.add(box([0.06, 0.28, 0.03], trimMat, [0, 0.83, 0.36], [0.12, 0, 0]));
  body.add(ellipsoid(0.1, 0.08, 0.06, leather, [0.28, 0.88, 0.27], [0, 0, 0], 8));

  const mantle = mesh(
    new THREE.SphereGeometry(0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    robeDark
  );
  mantle.position.set(0, 1.32, 0);
  mantle.scale.set(1.1, 0.6, 1.04);
  body.add(mantle);
  body.add(torus(0.45, 0.026, trimMat, [0, 1.28, 0], [Math.PI / 2, 0, 0], 26));
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.17, 0.11, 0.17, robeMat, [side * 0.4, 1.38, 0], [0, 0, 0], 11));
    body.add(torus(0.145, 0.016, trimMat, [side * 0.4, 1.36, 0], [Math.PI / 2, 0, 0], 16));
  }
  body.add(box([0.15, 0.28, 0.05], robeDark, [-0.15, 1.58, -0.03], [0, 0.15, 0.3]));
  body.add(box([0.15, 0.28, 0.05], robeDark, [0.15, 1.58, -0.03], [0, -0.15, -0.3]));

  function addArms(holding) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.4, 1.36, 0);
      pivot.rotation.z = side * 0.17;
      pivot.rotation.x = holding && side === 1 ? 0.1 : 0.04;
      pivot.add(capsule(0.085, 0.32, robeMat, [0, -0.16, 0], [0, 0, 0], 9));
      const fore = new THREE.Group();
      fore.position.set(0, -0.35, 0);
      fore.rotation.x = holding && side === 1 ? -0.65 : 0.1;
      fore.rotation.z = side * 0.1;
      fore.add(capsule(0.07, 0.26, robeMat, [0, -0.12, 0], [0, 0, 0], 9));
      fore.add(cylinder(0.085, 0.095, 0.06, trimMat, [0, -0.27, 0], 9));
      fore.add(sphere(0.07, variant === 'potionmaster' ? leather : skinMat, [0, -0.33, 0.015], 10));
      pivot.add(fore);
      body.add(pivot);
    }
  }
  addArms(staff || variant === 'maestro');

  const headY = 1.66;
  body.add(ellipsoid(0.26, 0.28, 0.25, skinMat, [0, headY, 0.01], [0, 0, 0], 20));
  body.add(ellipsoid(0.2, 0.13, 0.19, skinMat, [0, headY - 0.12, 0.04], [0, 0, 0], 16));
  for (const side of [-1, 1]) {
    body.add(ellipsoid(0.043, 0.07, 0.033, skinMat, [side * 0.25, headY - 0.01, 0.02], [0, 0, 0], 9));
    body.add(ellipsoid(0.06, 0.072, 0.033, eyeWhite, [side * 0.09, headY + 0.035, 0.235], [0, 0, 0], 11));
    body.add(sphere(0.025, eyeDark, [side * 0.09, headY + 0.03, 0.267], 8));
    body.add(sphere(0.008, glint, [side * 0.08, headY + 0.05, 0.287], 6));
    body.add(box([0.1, 0.016, 0.02], hairMat, [side * 0.09, headY + 0.125, 0.245], [0, 0, side * 0.12]));
  }
  const nose = cone(0.034, 0.09, skinShade, [0, headY - 0.02, 0.285], 6);
  nose.rotation.x = Math.PI / 2;
  body.add(nose);
  body.add(
    mesh(
      new THREE.TorusGeometry(0.055, 0.012, 4, 10, Math.PI),
      dark,
      [0, headY - 0.1, 0.265],
      [0, 0, Math.PI]
    )
  );
  body.add(
    mesh(
      new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat,
      [0, headY + 0.015, -0.01]
    )
  );

  // Hair silhouettes and variant features.
  for (const [x, y, z, sx, sy, sz] of [
    [-0.2, headY - 0.02, -0.16, 0.075, 0.15, 0.075],
    [0.2, headY - 0.02, -0.16, 0.075, 0.15, 0.075],
    [-0.1, headY + 0.08, -0.21, 0.09, 0.11, 0.075],
    [0.1, headY + 0.08, -0.21, 0.09, 0.11, 0.075],
    [-0.16, headY + 0.14, 0.22, 0.055, 0.075, 0.03],
    [0.16, headY + 0.14, 0.22, 0.055, 0.075, 0.03],
    [0, headY + 0.16, 0.235, 0.05, 0.065, 0.028],
  ]) {
    body.add(ellipsoid(sx, sy, sz, hairMat, [x, y, z], [0, 0, 0], 9));
  }
  for (const side of [-1, 1]) {
    body.add(box([0.035, 0.15, 0.045], hairMat, [side * 0.24, headY - 0.11, 0.02]));
  }

  if (variant === 'headmistress') {
    body.add(ellipsoid(0.14, 0.15, 0.13, hairMat, [0, headY - 0.05, -0.27], [0, 0, 0], 12));
    body.add(torus(0.1, 0.018, trimMat, [0, headY - 0.05, -0.27], [Math.PI / 2, 0, 0], 16));
    for (const side of [-1, 1]) {
      body.add(torus(0.072, 0.009, trimMat, [side * 0.09, headY + 0.035, 0.26], [0, 0, 0], 16));
    }
    body.add(box([0.06, 0.012, 0.012], trimMat, [0, headY + 0.035, 0.26]));
    for (const side of [-1, 1]) {
      body.add(box([0.018, 0.012, 0.14], trimMat, [side * 0.16, headY + 0.035, 0.19]));
    }
  }

  if (variant === 'archmage') {
    body.add(ellipsoid(0.2, 0.22, 0.13, hairMat, [0, headY - 0.24, 0.12], [0, 0, 0], 14));
    body.add(ellipsoid(0.14, 0.25, 0.1, hairMat, [0, headY - 0.44, 0.1], [0, 0, 0], 12));
    body.add(ellipsoid(0.08, 0.18, 0.07, hairMat, [0, headY - 0.64, 0.08], [0, 0, 0], 10));
    for (const side of [-1, 1]) {
      body.add(ellipsoid(0.07, 0.03, 0.035, hairMat, [side * 0.07, headY - 0.1, 0.255], [0, 0, side * 0.2], 8));
      body.add(box([0.13, 0.03, 0.03], hairMat, [side * 0.095, headY + 0.13, 0.25], [0, 0, side * 0.16]));
    }
  }

  if (variant === 'keeper') {
    for (const [x, y, z] of [
      [-0.13, headY - 0.06, 0.235],
      [-0.08, headY - 0.12, 0.245],
      [0.13, headY - 0.06, 0.235],
      [0.08, headY - 0.12, 0.245],
      [0, headY - 0.015, 0.27],
    ]) {
      body.add(sphere(0.012, skinShade, [x, y, z], 6));
    }
    for (let flower = 0; flower < 5; flower += 1) {
      const angle = (flower / 5) * Math.PI * 2;
      body.add(
        ellipsoid(
          0.035,
          0.012,
          0.07,
          mat('#f2b8d9', { roughness: 0.6 }),
          [0.22 + Math.cos(angle) * 0.05, 1.76, 0.13 + Math.sin(angle) * 0.05],
          [0, 0, angle],
          7
        )
      );
    }
    body.add(sphere(0.025, glowMat, [0.22, 1.76, 0.13], 8));
  }

  if (variant === 'potionmaster') {
    for (const side of [-1, 1]) {
      body.add(torus(0.085, 0.016, trimMat, [side * 0.09, headY + 0.035, 0.265], [0, 0, 0], 16));
      body.add(mesh(new THREE.CircleGeometry(0.068, 12), glass, [side * 0.09, headY + 0.035, 0.272]));
    }
    body.add(box([0.16, 0.035, 0.04], leather, [0, headY + 0.035, 0.25]));
    body.add(box([0.035, 0.3, 0.035], leather, [0, headY + 0.18, 0.02]));
    body.add(box([0.5, 0.8, 0.03], leather, [0, 0.8, 0.35], [0.03, 0, 0]));
    body.add(box([0.56, 0.045, 0.04], trimMat, [0, 1.18, 0.36]));
    body.add(box([0.055, 0.42, 0.035], leather, [0.14, 1.38, 0.3], [0, 0, 0.5]));
    for (const [side, colour] of [
      [-1, '#8fe0a8'],
      [1, '#a99bff'],
    ]) {
      body.add(
        cylinder(0.035, 0.035, 0.12, basic(colour, { transparent: true, opacity: 0.8 }), [side * 0.2, 0.9, 0.4], 8)
      );
      body.add(cylinder(0.025, 0.025, 0.05, leather, [side * 0.2, 0.98, 0.4], 6));
    }
  }

  if (variant === 'maestro') {
    for (const side of [-1, 1]) {
      body.add(ellipsoid(0.055, 0.022, 0.03, hairMat, [side * 0.045, headY - 0.075, 0.255], [0, 0, side * 0.18], 7));
    }
    body.add(box([0.18, 0.1, 0.04], mat('#f2e3cc', { roughness: 0.8 }), [0, 1.47, 0.255], [0, 0, 0.05]));
    const cravat = cone(0.09, 0.2, mat('#f2e3cc', { roughness: 0.8 }), [0, 1.38, 0.27], 8);
    cravat.rotation.x = Math.PI;
    body.add(cravat);
    body.add(box([0.24, 0.7, 0.03], robeDark, [-0.16, 0.65, -0.35], [0.15, 0, 0.06]));
    body.add(box([0.24, 0.7, 0.03], robeDark, [0.16, 0.65, -0.35], [0.15, 0, -0.06]));
    const baton = new THREE.Group();
    baton.position.set(0.52, 0.92, 0.3);
    baton.rotation.z = -0.4;
    baton.add(cylinder(0.012, 0.018, 0.5, mat('#e8d9b5', { roughness: 0.65 }), [0, 0.25, 0], 5));
    baton.add(sphere(0.035, glowMat, [0, 0.5, 0], 8));
    body.add(baton);
  }

  if (!['keeper', 'maestro'].includes(variant)) {
    const brim = variant === 'potionmaster' ? 0.55 : variant === 'headmistress' ? 0.5 : 0.52;
    const crownHeight = variant === 'potionmaster' ? 0.3 : variant === 'headmistress' ? 0.48 : 0.6;
    const hat = new THREE.Group();
    hat.position.set(0, 1.92, variant === 'potionmaster' ? -0.03 : 0);
    hat.rotation.z = variant === 'potionmaster' ? -0.18 : variant === 'archmage' ? -0.08 : -0.04;
    hat.add(cylinder(brim * 0.86, brim, 0.045, robeDark, [0, 0, 0], 18));
    hat.add(torus(brim * 0.9, 0.018, trimMat, [0, -0.012, 0], [Math.PI / 2, 0, 0], 26));
    hat.add(cone(brim * 0.62, crownHeight, robeMat, [0, crownHeight / 2, 0], 16));
    hat.add(torus(brim * 0.6, 0.03, trimMat, [0, 0.055, 0], [Math.PI / 2, 0, 0], 24));
    hat.add(mesh(new THREE.OctahedronGeometry(0.055, 0), glowMat, [0, 0.055, brim * 0.6]));
    if (variant === 'archmage') {
      const tip = cone(brim * 0.36, crownHeight * 0.55, robeMat, [brim * 0.12, crownHeight * 0.85, 0], 12);
      tip.rotation.z = -0.55;
      hat.add(tip);
      hat.add(sphere(0.065, trimMat, [brim * 0.32, crownHeight * 1.12, 0], 8));
      for (const [x, y, z] of [
        [0.13, 0.32, 0.31],
        [-0.15, 0.2, 0.26],
      ]) {
        hat.add(mesh(new THREE.OctahedronGeometry(0.026, 0), trimMat, [x, y, z]));
      }
    }
    if (variant === 'headmistress') {
      hat.add(torus(0.08, 0.012, trimMat, [0, 0.05, brim * 0.6], [0, 0, 0], 16));
    }
    body.add(hat);
  }

  if (variant === 'maestro') {
    const cap = new THREE.Group();
    cap.position.set(0, 1.9, 0);
    cap.rotation.z = -0.03;
    cap.add(cylinder(0.3, 0.34, 0.08, robeDark, [0, 0, 0], 16));
    cap.add(cylinder(0.28, 0.3, 0.18, robeMat, [0, 0.12, 0], 16));
    cap.add(ellipsoid(0.28, 0.06, 0.28, robeDark, [0, 0.22, 0], [0, 0, 0], 16));
    cap.add(box([0.04, 0.22, 0.02], trimMat, [0.26, 0.2, 0.1], [0, 0, -0.5]));
    body.add(cap);
  }

  if (antlers) {
    for (const side of [-1, 1]) {
      const antler = new THREE.Group();
      antler.position.set(side * 0.17, 1.86, 0);
      antler.rotation.z = side * 0.2;
      const antlerWood = mat('#a47f55', {
        roughness: 0.9,
        emissive: '#3a2a1b',
        emissiveIntensity: 0.08,
      });
      antler.add(cylinder(0.022, 0.035, 0.5, antlerWood, [0, 0.25, 0], 5));
      antler.add(cylinder(0.017, 0.027, 0.32, antlerWood, [side * 0.1, 0.45, 0], 5));
      antler.add(cylinder(0.014, 0.022, 0.22, antlerWood, [0, 0.55, 0.08], [0.4, 0, 0], 5));
      antler.add(cylinder(0.012, 0.018, 0.2, antlerWood, [side * -0.1, 0.6, 0], [0, 0, side * -0.7], 5));
      antler.add(ellipsoid(0.05, 0.025, 0.08, leafLight, [side * 0.15, 0.58, 0.02], [0, 0, 0], 7));
      antler.add(ellipsoid(0.04, 0.02, 0.07, leafLight, [side * -0.12, 0.7, 0.02], [0, 0, 0], 6));
      antler.add(sphere(0.03, glowMat, [0, 0.63, 0.1], 6));
      body.add(antler);
    }
    for (let leafIndex = 0; leafIndex < 7; leafIndex += 1) {
      const angle = (leafIndex / 7) * Math.PI * 2;
      body.add(
        ellipsoid(
          0.1,
          0.025,
          0.2,
          leafIndex % 2 ? leaf : leafLight,
          [Math.cos(angle) * 0.4, 1.34 + (leafIndex % 2) * 0.04, Math.sin(angle) * 0.4],
          [0, -angle, 0],
          8
        )
      );
    }
  }

  if (staff) {
    const wood = mat('#4b3323', { roughness: 0.95 });
    const staffGroup = new THREE.Group();
    staffGroup.position.set(0.55, 0, 0.2);
    staffGroup.rotation.z = -0.06;
    staffGroup.add(cylinder(0.03, 0.045, 1.9, wood, [0, 0.95, 0], 8));
    staffGroup.add(sphere(0.05, wood, [0.035, 1.05, 0.01], 8));
    for (const y of [0.78, 0.86, 0.94]) {
      staffGroup.add(torus(0.04, 0.011, leather, [0, y, 0], [Math.PI / 2, 0, 0], 10));
    }
    staffGroup.add(mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat, [0, 2, 0]));
    staffGroup.add(torus(0.17, 0.011, trimMat, [0, 2, 0], [0, 0, 0], 16));
    const staffGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: trim,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    staffGlow.position.set(0, 2, 0);
    staffGlow.scale.set(0.9, 0.9, 1);
    staffGroup.add(staffGlow);
    body.add(staffGroup);
  }

  mergeStaticGroup(body);
  return { group, body, name, x, z, baseY: 0 };
}

function addNpcs(scene) {
  const npcs = [
    makeNpc({
      name: 'Headmistress Morrow',
      x: 0,
      z: -5.5,
      robe: '#7c5ba6',
      trim: '#f2ce7b',
      staff: true,
      height: 1.06,
      variant: 'headmistress',
      hair: '#cfc5d8',
    }),
    makeNpc({
      name: 'Archmage Tilly',
      x: -6,
      z: -43,
      robe: '#5b6fbf',
      trim: '#c9bfff',
      skin: '#e6bd93',
      staff: true,
      rotation: 0.4,
      variant: 'archmage',
      hair: '#ddd5e8',
    }),
    makeNpc({
      name: 'Keeper Fern',
      x: 46,
      z: -4,
      robe: '#4d8a62',
      trim: '#d8e79a',
      skin: '#c9906a',
      antlers: true,
      rotation: -0.6,
      height: 0.98,
      variant: 'keeper',
      hair: '#6b3f2b',
    }),
    makeNpc({
      name: 'Master Bramble',
      x: -46,
      z: -4,
      robe: '#3f7f7b',
      trim: '#9ff0e2',
      skin: '#d7a680',
      height: 0.94,
      rotation: 0.7,
      variant: 'potionmaster',
      hair: '#5a3b2a',
    }),
    makeNpc({
      name: 'Maestro Cadence',
      x: 5,
      z: 80.5,
      robe: '#7a4a63',
      trim: '#f5c1d5',
      skin: '#e6b58f',
      rotation: -0.9,
      variant: 'maestro',
      hair: '#2a1824',
    }),
  ];
  for (const npc of npcs) scene.add(npc.group);

  const spiritPoint = INTERACTIONS.find((point) => point.npcKey === 'spirit');
  const spiritX = spiritPoint?.x ?? -3;
  const spiritZ = spiritPoint?.z ?? 46;
  const spirit = new THREE.Group();
  spirit.position.set(spiritX, 0, spiritZ);
  spirit.add(
    mesh(
      new THREE.CircleGeometry(0.85, 24),
      basic('#7fd6a2', { transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
      [0, 0.02, 0],
      [-Math.PI / 2, 0, 0]
    )
  );
  const floating = new THREE.Group();
  floating.position.y = 1.25;
  const wisp = mat('#9fe8b5', {
    emissive: '#4ecc86',
    emissiveIntensity: 0.5,
    roughness: 0.4,
    transparent: true,
    opacity: 0.82,
  });
  const wispCore = mat('#d8ffb7', {
    emissive: '#8aff9f',
    emissiveIntensity: 1.1,
    roughness: 0.35,
  });
  const wispTail = mat('#7fd6a2', {
    emissive: '#4ecc86',
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.68,
  });
  const spiritLeaf = mat('#3e7a4c', { roughness: 0.8 });
  const spiritLeafLight = mat('#7fbf8a', { roughness: 0.7 });
  floating.add(ellipsoid(0.46, 0.55, 0.38, wisp, [0, 0, 0], [0, 0, 0], 16));
  floating.add(ellipsoid(0.24, 0.32, 0.2, wispCore, [0, 0.05, 0.08], [0, 0, 0], 14));
  for (const [x, z, tilt] of [
    [-0.2, -0.05, 0.35],
    [0.2, -0.02, -0.35],
    [0, -0.16, 0],
  ]) {
    const tendril = cone(0.12, 0.55, wispTail, [x, -0.46, z], [Math.PI, 0, tilt], 7);
    floating.add(tendril);
  }
  for (const side of [-1, 1]) {
    floating.add(ellipsoid(0.16, 0.06, 0.08, wispTail, [side * 0.38, -0.06, 0.02], [0, 0, side * 0.35], 8));
    floating.add(ellipsoid(0.07, 0.09, 0.035, basic('#18291f'), [side * 0.15, 0.13, 0.34], [0, 0, 0], 9));
    floating.add(sphere(0.028, basic('#eaffcf', { toneMapped: false }), [side * 0.15, 0.15, 0.37], 7));
    floating.add(ellipsoid(0.055, 0.02, 0.025, wispTail, [side * 0.18, 0.32, 0.28], [0, 0, side * 0.25], 7));
  }
  floating.add(
    mesh(
      new THREE.TorusGeometry(0.1, 0.014, 4, 12, Math.PI),
      basic('#315f42'),
      [0, 0.02, 0.34],
      [0, 0, Math.PI]
    )
  );
  for (let leafIndex = 0; leafIndex < 5; leafIndex += 1) {
    const angle = (leafIndex / 5) * Math.PI * 2;
    floating.add(
      ellipsoid(
        0.08,
        0.025,
        0.14,
        leafIndex % 2 ? spiritLeaf : spiritLeafLight,
        [Math.cos(angle) * 0.24, 0.5, Math.sin(angle) * 0.2],
        [0, -angle, 0],
        7
      )
    );
  }
  mergeStaticGroup(floating);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: '#8aff9f',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  halo.scale.set(3.4, 3.4, 1);
  halo.position.set(0, 0.1, -0.12);
  floating.add(halo);
  spirit.add(floating);

  const motes = new THREE.Group();
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    motes.add(
      sphere(
        0.055,
        basic(index % 2 ? '#dcffa8' : '#8aff9f', { toneMapped: false }),
        [Math.cos(angle) * 0.9, 0.9 + index * 0.09, Math.sin(angle) * 0.9],
        6
      )
    );
  }
  spirit.add(motes);
  scene.add(spirit);
  npcs.push({
    group: spirit,
    body: floating,
    motes,
    name: 'Mosslight Spirit',
    x: spiritX,
    z: spiritZ,
    spirit: true,
  });
  return npcs;
}

function makeGardenCreature(index, x, z) {
  const palettes = [
    ['#9be3b8', '#d4f5d9', '#4f8f6b'],
    ['#a7c8ff', '#dbe7ff', '#5876a8'],
    ['#f2b8d9', '#ffe0ee', '#a46183'],
    ['#ffe09b', '#fff0c8', '#a47a3f'],
  ];
  const [baseColor, bellyColor, accentColor] = palettes[index % palettes.length];
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const base = mat(baseColor, {
    roughness: 0.62,
    emissive: baseColor,
    emissiveIntensity: 0.06,
  });
  const belly = mat(bellyColor, {
    roughness: 0.6,
    emissive: bellyColor,
    emissiveIntensity: 0.05,
  });
  const accent = mat(accentColor, {
    roughness: 0.68,
    emissive: accentColor,
    emissiveIntensity: 0.05,
  });
  const eyeWhite = mat('#fff8e8', { roughness: 0.35 });
  const eyeDark = basic('#1c1530');
  const glint = basic('#fffdf4', { toneMapped: false });
  const green = mat('#5d8f57', { roughness: 0.8 });
  group.add(ellipsoid(0.34, 0.3, 0.46, base, [0, 0.35, 0], [0, 0, 0], 16));
  group.add(ellipsoid(0.23, 0.2, 0.25, base, [0, 0.6, 0.25], [0, 0, 0], 14));
  group.add(ellipsoid(0.14, 0.11, 0.16, belly, [0, 0.52, 0.42], [0, 0, 0], 12));
  group.add(ellipsoid(0.1, 0.07, 0.12, belly, [0, 0.55, 0.48], [0, 0, 0], 10));
  group.add(sphere(0.035, accent, [0, 0.57, 0.58], 8));
  for (const side of [-1, 1]) {
    group.add(ellipsoid(0.06, 0.07, 0.03, eyeWhite, [side * 0.1, 0.66, 0.42], [0, 0, 0], 10));
    group.add(sphere(0.03, eyeDark, [side * 0.1, 0.66, 0.455], 8));
    group.add(sphere(0.009, glint, [side * 0.09, 0.675, 0.472], 6));
    group.add(cone(0.09, 0.26, base, [side * 0.16, 0.82, 0.12], [0, 0, side * 0.25], 6));
    group.add(cone(0.045, 0.17, belly, [side * 0.16, 0.84, 0.12], [0, 0, side * 0.25], 6));
    group.add(ellipsoid(0.08, 0.06, 0.12, belly, [side * 0.16, 0.09, 0.2], [0, 0, 0], 9));
    group.add(box([0.1, 0.025, 0.08], accent, [side * 0.16, 0.04, 0.24]));
  }
  for (let tail = 0; tail < 3; tail += 1) {
    group.add(
      ellipsoid(
        0.12 - tail * 0.022,
        0.13,
        0.14,
        base,
        [0.02 + tail * 0.035, 0.43 - tail * 0.05, -0.42 - tail * 0.1],
        [0.2, -0.25, 0],
        10
      )
    );
  }
  for (let spot = 0; spot < 3; spot += 1) {
    group.add(
      ellipsoid(0.055, 0.02, 0.045, accent, [-0.15 + spot * 0.14, 0.58 - spot * 0.07, 0.12], [0, 0, 0], 7)
    );
  }
  group.add(cylinder(0.012, 0.018, 0.17, green, [0.12, 0.91, 0.1], 5));
  group.add(ellipsoid(0.06, 0.018, 0.1, green, [0.18, 0.98, 0.1], [0, 0.3, 0.3], 7));
  mergeStaticGroup(group);
  return group;
}

/* ------------------------------------------------------------ spell casts */

function buildSpellEffect(cast) {
  const group = new THREE.Group();
  group.position.set(cast.x, 0, cast.z);
  let ttl = 10;
  let update = () => undefined;

  if (cast.id === 'lumina') {
    const orb = new THREE.Group();
    orb.position.y = 2.4;
    orb.add(sphere(0.22, basic('#fff3c9', { toneMapped: false }), [0, 0, 0], 16));
    orb.add(torus(0.42, 0.025, basic('#ffe3a3', { transparent: true, opacity: 0.8 }), [0, 0, 0], [-Math.PI / 2, 0, 0], 32));
    const light = new THREE.PointLight('#ffe4ad', 9, 12);
    orb.add(light);
    group.add(orb);
    update = (time) => {
      orb.position.y = 2.4 + Math.sin(time * 1.4) * 0.2;
      orb.rotation.y = time * 0.6;
    };
    ttl = 14;
  } else if (cast.id === 'floris') {
    const flowers = [];
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const radius = 0.9 + (index % 3) * 0.45;
      const flower = new THREE.Group();
      flower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      flower.add(cylinder(0.022, 0.03, 0.5, mat('#6fbf86'), [0, 0.25, 0], 5));
      flower.add(sphere(0.1, basic(['#ffd0e4', '#dcc4ff', '#fff0b8'][index % 3], { toneMapped: false }), [0, 0.55, 0], 8));
      group.add(flower);
      flowers.push(flower);
    }
    update = (time) => {
      flowers.forEach((flower, index) => {
        flower.rotation.z = Math.sin(time * 1.9 + index) * 0.12;
      });
    };
    ttl = 14;
  } else if (cast.id === 'leviosa') {
    const crateGroup = new THREE.Group();
    crateGroup.position.y = 1.9;
    crateGroup.add(box([0.85, 0.85, 0.85], mat('#8a6743', { roughness: 0.9 }), [0, 0, 0]));
    for (const offset of [0.1, -0.1]) {
      crateGroup.add(box([0.9, 0.08, 0.03], mat('#65482c'), [0, offset, 0.43]));
    }
    group.add(crateGroup);
    const rings = new THREE.Group();
    rings.position.y = 0.35;
    for (const [index, radius] of [0.8, 1.2].entries()) {
      rings.add(torus(radius, 0.025, basic('#c7b7ff', { transparent: true, opacity: 0.7 }), [0, 0, 0], [-Math.PI / 2, 0, index * 0.4], 36));
    }
    group.add(rings);
    update = (time) => {
      crateGroup.position.y = 1.9 + Math.sin(time * 1.5) * 0.22;
      crateGroup.rotation.y = time * 0.5;
      rings.rotation.y = -time * 0.6;
    };
    ttl = 9;
  } else {
    const echoRings = [];
    const rings = new THREE.Group();
    rings.position.y = 1.2;
    for (let index = 0; index < 4; index += 1) {
      const ring = torus(0.5, 0.04, basic('#b8a6ff', { transparent: true, opacity: 0.7 }), [0, 0, 0], [-Math.PI / 2 + 0.3, 0, 0], 40);
      rings.add(ring);
      echoRings.push(ring);
    }
    group.add(rings);
    update = (time, elapsed) => {
      rings.rotation.y += elapsed * 0.4;
      echoRings.forEach((ring, index) => {
        const local = (time - index * 0.28) % 2.4;
        ring.visible = local >= 0;
        if (ring.visible) {
          ring.scale.setScalar(1 + local * 2.6);
          ring.material.opacity = Math.max(0, 0.8 - local * 0.45);
        }
      });
    };
    ttl = 4;
  }

  return { group, update, ttl, age: 0 };
}

/* ------------------------------------------------------------------ scene */

export function initScene({ container, labelsLayer }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030b');
  scene.fog = new THREE.Fog('#05030b', 24, 95);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 160);
  camera.position.set(0, 8.8, 19);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  scene.add(new THREE.AmbientLight('#8b7ec0', 0.72));
  const hemi = new THREE.HemisphereLight('#7185c8', '#10091c', 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#b7c8ff', 1.1);
  sun.position.set(-22, 30, -18);
  scene.add(sun);
  const hallLight = new THREE.PointLight('#ffb15c', 24, 28, 2);
  hallLight.position.set(0, 4.8, 0);
  scene.add(hallLight);

  const stars = addStars(scene);
  buildArchitecture(scene);
  const hall = buildGreatHall(scene, getState().save.house || 'phoenix');
  buildTower(scene);
  const creatures = buildGardens(scene);
  buildDungeon(scene);
  const fireflies = buildForest(scene);
  buildParlour(scene);
  const seals = buildSeals(scene);
  const labels = buildLabelLayer(labelsLayer);
  addRoomSigns(scene, labels);
  addChallengeLabels(scene, labels);
  addNpcLabels(scene, labels);

  const focusPoints = [];
  const focusGlowPositions = [];
  const focusGlowColors = [];
  const focusFor = (skill, accent, shape, delay) => {
    const point = INTERACTIONS.find((entry) => entry.skill === skill);
    if (!point) return;
    focusPoints.push(buildFocusPedestal(scene, point, accent, shape, delay));
    focusGlowPositions.push([point.x, 1.45, point.z]);
    focusGlowColors.push(accent);
  };
  focusFor('pitch', '#a99bff', 'crystal', 0);
  focusFor('melody', '#f2ce7b', 'crystal', 1.4);
  focusFor('interval', '#8fe0a8', 'crystal', 0.6);
  focusFor('harmony', '#7fd6c9', 'cauldron', 0.9);
  focusFor('rhythm', '#b9d87d', 'drum', 1.1);
  focusFor('perfect', '#f0a9c6', 'piano', 1.5);
  scene.add(glowPoints(focusGlowPositions, '#ffffff', 2.3, 0.2, focusGlowColors));
  const dust = addDust(scene);

  const npcs = addNpcs(scene);

  const wizard = makeWizard();
  const playerGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  playerGroup.add(bodyGroup);
  bodyGroup.add(wizard.group);
  scene.add(playerGroup);
  playerGroup.position.set(SPAWN.x, 0, SPAWN.z);
  playerGroup.rotation.y = Math.PI;
  const playerLight = new THREE.PointLight('#ffd39a', 2.6, 7, 2);
  playerLight.position.set(0.6, 1.9, 0.14);
  playerGroup.add(playerLight);

  let houseId = getState().save.house || 'phoenix';
  let accessory = getState().save.petAccessory;
  function applyHouse(nextHouse) {
    houseId = nextHouse || 'phoenix';
    const house = HOUSE_OF(houseId) ?? HOUSE_OF('phoenix');
    wizard.materials.robe.color.set(house.color);
    wizard.materials.robeDark.color.copy(shadeColor(house.color, 0.52));
    wizard.materials.cape.color.copy(shadeColor(house.color, 0.36));
    wizard.materials.trim.color.set('#f2ce7b');
    wizard.materials.glow.color.set(house.glow);
    wizard.staffCrystal.color.set(house.glow);
    wizard.staffCrystal.emissive.set(house.glow);
    for (const material of hall.bannerMaterials) {
      if (material.userData?.sigil) material.color.set(house.glow);
      else material.color.set(house.color);
    }
    hall.bannerMaterials.forEach((material, index) => {
      material.color.set(index % 3 === 2 ? house.glow : house.color);
    });
  }
  function applyAccessory(nextAccessory) {
    accessory = nextAccessory;
    wizard.scarf.visible = accessory === 'star-scarf';
    wizard.crown.visible = accessory === 'moon-crown';
  }
  applyHouse(houseId);
  applyAccessory(accessory);

  const effects = [];
  let lastSpellAt = null;
  const unsubscribe = subscribe((next) => {
    if (next.save.house !== houseId) applyHouse(next.save.house);
    if (next.save.petAccessory !== accessory) applyAccessory(next.save.petAccessory);
    for (const barrier of BARRIERS) {
      const seal = seals.get(barrier.room);
      if (seal) seal.group.visible = !next.save.unlockedRooms.includes(barrier.room);
    }
    if (next.spellCast && next.spellCast.at !== lastSpellAt) {
      lastSpellAt = next.spellCast.at;
      const effect = buildSpellEffect(next.spellCast);
      scene.add(effect.group);
      effects.push(effect);
    }
  });

  for (const barrier of BARRIERS) {
    const seal = seals.get(barrier.room);
    if (seal) seal.group.visible = !getState().save.unlockedRooms.includes(barrier.room);
  }

  const keys = new Set();
  const isTyping = () => {
    const element = document.activeElement;
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    );
  };
  const onDown = (event) => {
    if (isTyping()) return;
    keys.add(event.code);
    if (event.code === 'KeyE') {
      const current = getState();
      if (!current.challenge && !current.dialogue && current.panel === 'none') {
        interact();
      }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  };
  const onUp = (event) => keys.delete(event.code);
  const onBlur = () => {
    keys.clear();
    moveInput.x = 0;
    moveInput.z = 0;
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  function blocked(x, z, unlockedRooms) {
    if (!isInsideAnyZone(x, z)) return true;
    for (const wall of WALLS) {
      if (
        Math.abs(x - wall.x) < wall.w / 2 + PLAYER_RADIUS &&
        Math.abs(z - wall.z) < wall.d / 2 + PLAYER_RADIUS
      ) {
        return true;
      }
    }
    for (const barrier of BARRIERS) {
      if (unlockedRooms.includes(barrier.room)) continue;
      const box =
        barrier.rotationY === 0
          ? { halfW: 3.1, halfD: 0.4 }
          : { halfW: 0.4, halfD: 3.1 };
      if (
        Math.abs(x - barrier.x) < box.halfW + PLAYER_RADIUS &&
        Math.abs(z - barrier.z) < box.halfD + PLAYER_RADIUS
      ) {
        return true;
      }
    }
    return false;
  }

  let walkTime = 0;
  let lastRoom = worldState.room;
  const cameraTarget = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const clock = new THREE.Clock();
  let firstFrame = true;

  function updateLabels() {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    for (const label of labels.labels) {
      const distance = Math.hypot(worldState.player.x - label.x, worldState.player.z - label.z);
      if (distance > label.radius) {
        label.el.classList.remove('visible');
        continue;
      }
      projected.set(label.x, label.y, label.z);
      projected.project(camera);
      if (projected.z > 1 || projected.z < -1) {
        label.el.classList.remove('visible');
        continue;
      }
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      if (x < -150 || x > width + 150 || y < -80 || y > height + 80) {
        label.el.classList.remove('visible');
        continue;
      }
      label.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      label.el.classList.add('visible');
    }
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  resize();

  function frame() {
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    const current = getState();
    const paused = Boolean(current.challenge || current.dialogue || current.panel !== 'none');

    let inputX = 0;
    let inputZ = 0;
    if (!paused) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
      inputX += moveInput.x;
      inputZ += moveInput.z;
    }
    const magnitude = Math.hypot(inputX, inputZ);
    if (magnitude > 1) {
      inputX /= magnitude;
      inputZ /= magnitude;
    }
    const running = !paused && (keys.has('ShiftLeft') || keys.has('ShiftRight') || moveInput.run);
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const stepX = inputX * speed * delta;
    const stepZ = inputZ * speed * delta;
    if (Math.abs(stepX) > 0.00001 && !blocked(worldState.player.x + stepX, worldState.player.z, current.save.unlockedRooms)) {
      worldState.player.x += stepX;
    }
    if (Math.abs(stepZ) > 0.00001 && !blocked(worldState.player.x, worldState.player.z + stepZ, current.save.unlockedRooms)) {
      worldState.player.z += stepZ;
    }

    const moving = magnitude > 0.08;
    if (moving) {
      const targetFacing = Math.atan2(inputX, inputZ);
      let difference = targetFacing - worldState.facing;
      while (difference > Math.PI) difference -= Math.PI * 2;
      while (difference < -Math.PI) difference += Math.PI * 2;
      worldState.facing += difference * Math.min(1, delta * 12);
      walkTime += delta * (running ? 13 : 9);
    }

    playerGroup.position.set(worldState.player.x, 0, worldState.player.z);
    playerGroup.rotation.y = worldState.facing;
    bodyGroup.position.y = moving ? Math.abs(Math.sin(walkTime)) * 0.07 : 0;
    bodyGroup.rotation.z = moving ? Math.sin(walkTime * 0.5) * 0.035 : 0;

    wizard.owl.position.x = -0.88 + Math.sin(elapsed * 0.7) * 0.04;
    wizard.owl.position.z = 0.28 + Math.cos(elapsed * 0.7) * 0.04;
    wizard.owl.position.y = 1.62 + Math.sin(elapsed * 2.2) * 0.07;
    wizard.owlBody.rotation.z = Math.sin(elapsed * 1.6) * 0.06;
    wizard.staffCrystal.emissiveIntensity = 1.15 + Math.sin(elapsed * 2.8) * 0.2;
    for (const { wing, side } of wizard.wings) {
      wing.rotation.z = side * (0.45 + Math.sin(elapsed * 5) * 0.18);
    }

    const room = roomAt(worldState.player.x, worldState.player.z);
    if (room && lastRoom !== room) {
      lastRoom = room;
      worldState.room = room;
      syncRoom(room);
    }

    if (!paused) {
      const point = nearbyInteraction(worldState.player.x, worldState.player.z);
      setNearby(point?.id ?? null);
    } else if (current.nearbyId) {
      setNearby(null);
    }

    desiredCamera.set(worldState.player.x, 7.8, worldState.player.z + 10.6);
    if (firstFrame) {
      camera.position.copy(desiredCamera);
      firstFrame = false;
    } else {
      camera.position.lerp(desiredCamera, 1 - Math.exp(-4.5 * delta));
    }
    cameraTarget.set(worldState.player.x, 1.2, worldState.player.z - 1.6);
    camera.lookAt(cameraTarget);

    for (const floater of focusPoints) {
      floater.floating.position.y =
        floater.baseY + Math.sin(elapsed * floater.speed + floater.delay) * 0.12;
      floater.floating.rotation.y = elapsed * 0.35 + floater.delay;
      floater.halo.rotation.z = elapsed * 0.2;
    }
    hallLight.intensity = 24 + Math.sin(elapsed * 7.5) * 1.8 + Math.sin(elapsed * 18.1) * 0.7;
    for (const [index, candle] of hall.candles.entries()) {
      candle.group.position.y = 3 + Math.sin(elapsed * 0.8 + index * 0.7) * 0.16;
      candle.group.rotation.y = elapsed * 0.15 + index * 0.7;
      candle.flame.scale.setScalar(
        1 + Math.sin(elapsed * 12.7 + index * 2.4) * 0.16 + Math.sin(elapsed * 5.3 + index) * 0.07
      );
    }
    for (const [index, creature] of creatures.entries()) {
      creature.position.y = Math.abs(Math.sin(elapsed * 1.4 + index)) * 0.22;
      creature.rotation.y += delta * 0.2 * (index % 2 === 0 ? 1 : -1);
    }
    for (const [index, npc] of npcs.entries()) {
      if (npc.spirit) {
        npc.body.position.y = 1.25 + Math.sin(elapsed * 0.9) * 0.16;
        npc.body.rotation.y = Math.PI + elapsed * 0.3;
        if (npc.motes) npc.motes.rotation.y = -elapsed * 0.45;
      } else if (npc.body) {
        npc.body.position.y = Math.sin(elapsed * 0.9 + index) * 0.025;
        npc.body.rotation.y = Math.sin(elapsed * 0.35 + npc.z) * 0.05;
      }
    }
    for (const [roomId, seal] of seals) {
      seal.rings.rotation.z = Math.sin(elapsed * 0.5) * 0.03;
      const unlocked = getState().save.unlockedRooms.includes(roomId);
      seal.group.visible = !unlocked;
    }
    for (const effect of [...effects]) {
      effect.age += delta;
      effect.update(effect.age, delta);
      if (effect.age > effect.ttl) {
        scene.remove(effect.group);
        effect.group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose?.();
        });
        effects.splice(effects.indexOf(effect), 1);
      }
    }

    stars.rotation.y = elapsed * 0.003;
    fireflies.rotation.y = Math.sin(elapsed * 0.05) * 0.1;
    dust.rotation.y = elapsed * 0.008;
    dust.position.y = Math.sin(elapsed * 0.25) * 0.12;
    updateLabels();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    scene,
    camera,
    renderer,
    dispose() {
      unsubscribe();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
