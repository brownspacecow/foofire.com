/* ------------------------------------------------------------------ *
 * Models
 * Everything is built from primitives with a chunky, hand-made look so
 * the game stays a single static bundle with no model downloads.
 * Builders return THREE.Group objects; landmarks also report the round
 * colliders the player has to walk around.
 * ------------------------------------------------------------------ */

import * as THREE from 'three';

const materials = new Map();

function material(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!materials.has(key)) {
    materials.set(
      key,
      new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        ...options,
      })
    );
  }
  return materials.get(key);
}

export function disposeModels() {
  materials.forEach((entry) => entry.dispose());
  materials.clear();
}

function mesh(geometry, color, options = {}) {
  const item = new THREE.Mesh(geometry, material(color, options));
  return item;
}

const box = (w, h, d, color, x = 0, y = 0, z = 0, options) => {
  const item = mesh(new THREE.BoxGeometry(w, h, d), color, options);
  item.position.set(x, y, z);
  return item;
};

const cyl = (rTop, rBottom, h, color, x = 0, y = 0, z = 0, segments = 8, options) => {
  const item = mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, options);
  item.position.set(x, y, z);
  return item;
};

const cone = (r, h, color, x = 0, y = 0, z = 0, segments = 7) => {
  const item = mesh(new THREE.ConeGeometry(r, h, segments), color);
  item.position.set(x, y, z);
  return item;
};

const ball = (r, color, x = 0, y = 0, z = 0, options) => {
  const item = mesh(new THREE.SphereGeometry(r, 10, 8), color, options);
  item.position.set(x, y, z);
  return item;
};

const COLORS = {
  wood: '#8a5a3b',
  woodDark: '#5e3b26',
  cream: '#f4e5c9',
  creamDark: '#dfc9a6',
  pine: '#2f6b46',
  pineDark: '#24543a',
  leaf: '#4f9a5e',
  stone: '#8b8b9c',
  stoneDark: '#6d6d80',
  metal: '#b9c2cf',
  red: '#d8494c',
  yellow: '#ffcf4d',
  glass: '#9fdcff',
  black: '#20202c',
  white: '#fff8ec',
  glow: '#ffd86b',
  purple: '#7b5bd6',
  pink: '#ff8fb8',
  teal: '#3cc9c0',
  orange: '#ff8a3d',
};

/* ------------------------------------------------------------------ text */
function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

/** A readable floating label baked onto a canvas texture. */
export function makeLabel(text, options = {}) {
  const {
    wide = 640,
    font = 700,
    fill = '#2a2038',
    background = null,
    align = 'center',
    border = null,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = wide;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  let size = options.size ?? 46;
  context.font = `${font} ${size}px "Trebuchet MS", system-ui, sans-serif`;
  let lines = wrapText(context, text, wide - 48);
  while (lines.length > 4 && size > 22) {
    size -= 4;
    context.font = `${font} ${size}px "Trebuchet MS", system-ui, sans-serif`;
    lines = wrapText(context, text, wide - 48);
  }

  const lineHeight = size * 1.18;
  const blockHeight = lineHeight * lines.length;
  const top = (canvas.height - blockHeight) / 2 + size * 0.82;

  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';

  if (background) {
    context.fillStyle = background;
    const pad = 18;
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(pad, top - size - pad * 0.4, wide - pad * 2, blockHeight + pad * 1.2, 22);
    } else {
      context.rect(pad, top - size - pad * 0.4, wide - pad * 2, blockHeight + pad * 1.2);
    }
    context.fill();
    if (border) {
      context.lineWidth = 6;
      context.strokeStyle = border;
      context.stroke();
    }
  }

  context.fillStyle = fill;
  context.strokeStyle = background ? 'transparent' : 'rgba(255, 248, 236, 0.9)';
  lines.forEach((line, index) => {
    const x = align === 'left' ? 28 : wide / 2;
    const y = top + index * lineHeight;
    if (!background) {
      context.lineWidth = 8;
      context.strokeText(line, x, y);
    }
    context.fillText(line, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  const height = 2.6;
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  sprite.userData.dispose = () => {
    texture.dispose();
    spriteMaterial.dispose();
  };
  return sprite;
}

/** An emoji drawn on a transparent sprite, used for souvenirs and badges. */
export function makeEmojiSprite(emoji, size = 1.1) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.font = '92px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(emoji, 64, 72);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(size, size, 1);
  sprite.userData.dispose = () => {
    texture.dispose();
    spriteMaterial.dispose();
  };
  return sprite;
}

/* ------------------------------------------------------------------ props */
function pine(rng) {
  const group = new THREE.Group();
  const height = 2.6 + rng() * 2.4;
  group.add(cyl(0.16, 0.22, height * 0.42, COLORS.woodDark, 0, height * 0.21, 0, 6));
  for (let i = 0; i < 3; i += 1) {
    const layer = cone(1.15 - i * 0.24, 1.5, i === 2 ? COLORS.pine : COLORS.pineDark, 0, height * (0.34 + i * 0.22), 0);
    group.add(layer);
  }
  group.userData.collider = 0.55;
  return group;
}

function oak(rng) {
  const group = new THREE.Group();
  const height = 2.2 + rng() * 1.6;
  group.add(cyl(0.2, 0.3, height, COLORS.wood, 0, height / 2, 0, 6));
  group.add(ball(1.15, COLORS.leaf, 0, height + 0.4, 0));
  group.add(ball(0.8, '#5fae6a', 0.7, height + 0.1, 0.2));
  group.add(ball(0.7, '#3f8a50', -0.7, height + 0.2, -0.2));
  group.userData.collider = 0.7;
  return group;
}

function rock(rng) {
  const group = new THREE.Group();
  const size = 0.5 + rng() * 0.8;
  const stone = mesh(new THREE.DodecahedronGeometry(size, 0), COLORS.stone);
  stone.scale.set(1, 0.7, 1.1);
  stone.position.y = size * 0.55;
  stone.rotation.set(rng(), rng(), rng());
  group.add(stone);
  if (rng() > 0.5) {
    const small = mesh(new THREE.DodecahedronGeometry(size * 0.45, 0), COLORS.stoneDark);
    small.position.set(size * 0.9, size * 0.25, size * 0.3);
    group.add(small);
  }
  group.userData.collider = size * 0.9;
  return group;
}

function fence() {
  const group = new THREE.Group();
  const width = 3.4;
  for (let i = 0; i <= 3; i += 1) {
    group.add(box(0.16, 1.1, 0.16, COLORS.woodDark, -width / 2 + (i * width) / 3, 0.55, 0));
  }
  group.add(box(width, 0.14, 0.1, COLORS.wood, 0, 0.8, 0));
  group.add(box(width, 0.14, 0.1, COLORS.wood, 0, 0.42, 0));
  group.userData.collider = 1.2;
  group.userData.slim = true;
  return group;
}

function crate(rng) {
  const group = new THREE.Group();
  const size = 0.8 + rng() * 0.3;
  const body = box(size, size, size, COLORS.wood, 0, size / 2, 0);
  group.add(body);
  group.add(box(size, 0.09, 0.09, COLORS.woodDark, 0, size * 0.75, size / 2 + 0.01));
  group.add(box(size, 0.09, 0.09, COLORS.woodDark, 0, size * 0.3, size / 2 + 0.01));
  group.add(box(0.09, size, 0.09, COLORS.woodDark, 0, size / 2, size / 2 + 0.01));
  group.rotation.y = rng() * Math.PI;
  group.userData.collider = size * 0.7;
  return group;
}

function barrel() {
  const group = new THREE.Group();
  group.add(cyl(0.42, 0.42, 1.05, '#a9693d', 0, 0.52, 0, 10));
  group.add(cyl(0.46, 0.46, 0.1, COLORS.metal, 0, 0.28, 0, 10));
  group.add(cyl(0.46, 0.46, 0.1, COLORS.metal, 0, 0.8, 0, 10));
  group.userData.collider = 0.55;
  return group;
}

function chicken() {
  const group = new THREE.Group();
  group.add(ball(0.34, '#fdf6e3', 0, 0.42, 0));
  group.add(ball(0.24, '#fffdf7', 0.18, 0.72, 0.02));
  group.add(cone(0.09, 0.18, COLORS.orange, 0.36, 0.7, 0, 5));
  group.add(box(0.07, 0.12, 0.16, COLORS.red, 0.2, 0.94, 0));
  group.add(box(0.05, 0.22, 0.05, COLORS.orange, -0.08, 0.12, 0.09));
  group.add(box(0.05, 0.22, 0.05, COLORS.orange, 0.08, 0.12, -0.09));
  group.userData.collider = 0.3;
  return group;
}

function crystal() {
  const group = new THREE.Group();
  const gem = mesh(new THREE.OctahedronGeometry(0.5, 0), '#84f7ff', { emissive: '#2fb9cc', emissiveIntensity: 0.7 });
  gem.position.y = 0.8;
  gem.scale.set(0.7, 1.5, 0.7);
  group.add(gem);
  group.add(cyl(0.28, 0.5, 0.35, COLORS.stoneDark, 0, 0.17, 0, 6));
  group.userData.collider = 0.4;
  group.userData.glow = true;
  return group;
}

function mound() {
  const group = new THREE.Group();
  const dirt = ball(0.85, '#b08a5a', 0, 0.2, 0);
  dirt.scale.set(1, 0.42, 1);
  group.add(dirt);
  group.add(cyl(0.22, 0.22, 0.06, COLORS.black, 0.05, 0.5, 0.1, 10));
  group.userData.collider = 0.75;
  return group;
}

function mushroom() {
  const group = new THREE.Group();
  group.add(cyl(0.16, 0.2, 0.8, COLORS.cream, 0, 0.4, 0, 7));
  group.add(ball(0.62, COLORS.red, 0, 0.9, 0));
  const top = group.children[1];
  top.scale.set(1, 0.6, 1);
  group.add(ball(0.1, COLORS.white, 0.3, 1.12, 0.12));
  group.add(ball(0.08, COLORS.white, -0.28, 1.08, 0.2));
  group.userData.collider = 0.35;
  return group;
}

function pumpkin() {
  const group = new THREE.Group();
  const body = ball(0.6, '#ff9330', 0, 0.48, 0);
  body.scale.set(1, 0.85, 1);
  group.add(body);
  group.add(cyl(0.08, 0.1, 0.34, '#4c7a37', 0, 1.02, 0, 5));
  const face = makeEmojiSprite('🎃', 1);
  face.position.set(0, 1.9, 0);
  face.scale.set(0.7, 0.7, 1);
  group.add(face);
  group.userData.collider = 0.6;
  return group;
}

function sheep() {
  const group = new THREE.Group();
  const wool = ball(0.85, '#fff7ea', 0, 0.95, 0);
  wool.scale.set(1.2, 0.9, 0.95);
  group.add(wool);
  [[-0.5, 1.3, 0.2], [0.5, 1.25, -0.1], [0, 1.55, 0.1]].forEach(([x, y, z]) => {
    group.add(ball(0.34, '#fffdf6', x, y, z));
  });
  group.add(ball(0.32, '#4b4b5a', 0.86, 1.02, 0));
  group.add(box(0.06, 0.34, 0.06, '#4b4b5a', -0.35, 0.17, 0.3));
  group.add(box(0.06, 0.34, 0.06, '#4b4b5a', 0.35, 0.17, 0.3));
  group.add(box(0.06, 0.34, 0.06, '#4b4b5a', -0.35, 0.17, -0.3));
  group.add(box(0.06, 0.34, 0.06, '#4b4b5a', 0.35, 0.17, -0.3));
  group.userData.collider = 0.95;
  return group;
}

function bookstack(rng) {
  const group = new THREE.Group();
  const palette = [COLORS.red, COLORS.teal, COLORS.yellow, COLORS.purple];
  for (let i = 0; i < 3; i += 1) {
    group.add(
      box(1.1 - i * 0.12, 0.22, 0.8, palette[i % palette.length], rng() * 0.1, 0.12 + i * 0.24, 0)
    );
  }
  group.rotation.y = rng() * Math.PI;
  group.userData.collider = 0.6;
  return group;
}

function bench() {
  const group = new THREE.Group();
  group.add(box(1.8, 0.14, 0.6, COLORS.wood, 0, 0.55, 0));
  group.add(box(1.8, 0.14, 0.14, COLORS.wood, 0, 0.95, -0.26));
  [-0.7, 0.7].forEach((x) => {
    group.add(box(0.14, 0.55, 0.55, COLORS.woodDark, x, 0.27, 0));
  });
  group.userData.collider = 0.85;
  return group;
}

function lamp() {
  const group = new THREE.Group();
  group.add(cyl(0.09, 0.13, 2.6, COLORS.black, 0, 1.3, 0, 6));
  group.add(ball(0.24, '#ffe9a8', 0, 2.68, 0, { emissive: '#ffd86b', emissiveIntensity: 1 }));
  group.add(cone(0.36, 0.3, COLORS.black, 0, 2.92, 0));
  group.userData.collider = 0.24;
  group.userData.glow = true;
  return group;
}

function planter() {
  const group = new THREE.Group();
  group.add(box(0.9, 0.5, 0.9, '#b5714a', 0, 0.25, 0));
  group.add(ball(0.4, COLORS.leaf, 0, 0.68, 0));
  group.add(ball(0.25, '#79c47a', 0.2, 0.9, 0.1));
  group.userData.collider = 0.5;
  return group;
}

function cart() {
  const group = new THREE.Group();
  group.add(box(1.1, 0.55, 1.5, '#7d7f8f', 0, 0.55, 0));
  group.add(box(1.2, 0.1, 0.1, '#5c5f70', 0, 0.85, 0.7));
  [-0.5, 0.5].forEach((x) => {
    [-0.5, 0.5].forEach((z) => {
      group.add(cyl(0.18, 0.18, 0.1, COLORS.black, x, 0.18, z, 8));
    });
  });
  group.userData.collider = 0.85;
  return group;
}

function banner() {
  const group = new THREE.Group();
  [-1, 1].forEach((side) => {
    group.add(cyl(0.07, 0.07, 2.6, COLORS.woodDark, side * 0.9, 1.3, 0, 6));
  });
  group.add(box(1.9, 1.1, 0.06, '#f7e6bd', 0, 1.85, 0));
  group.add(box(1.9, 0.16, 0.1, COLORS.red, 0, 2.36, 0.02));
  group.add(box(1.9, 0.16, 0.1, COLORS.red, 0, 1.32, 0.02));
  group.add(box(0.7, 0.7, 0.02, COLORS.teal, 0, 1.85, 0.05));
  group.userData.collider = 0.9;
  return group;
}

function mirror() {
  const group = new THREE.Group();
  const frame = mesh(new THREE.TorusGeometry(0.7, 0.11, 6, 14), '#d9cfae');
  frame.position.y = 1.35;
  group.add(frame);
  group.add(box(0.06, 0.9, 0.06, '#8a7b5c', 0, 0.45, 0));
  group.add(box(0.8, 0.3, 0.14, '#8a7b5c', 0, 0.06, 0));
  group.add(cyl(0.2, 0.22, 0.06, '#a8c8e8', 0, 1.35, 0.02, 12));
  group.children[group.children.length - 1].rotation.x = Math.PI / 2;
  group.userData.collider = 0.55;
  return group;
}

function telescope() {
  const group = new THREE.Group();
  group.add(cyl(0.06, 0.12, 1.5, COLORS.black, 0, 0.75, 0, 6));
  const tube = cyl(0.16, 0.2, 1.4, '#dcd6c4', 0, 1.7, 0, 8);
  tube.rotation.z = 0.6;
  group.add(tube);
  group.userData.collider = 0.4;
  return group;
}

function stump() {
  const group = new THREE.Group();
  group.add(cyl(0.5, 0.6, 0.6, COLORS.wood, 0, 0.3, 0, 9));
  group.add(cyl(0.44, 0.44, 0.08, '#c79a67', 0, 0.62, 0, 9));
  group.userData.collider = 0.55;
  return group;
}

function haybale() {
  const group = new THREE.Group();
  const bale = cyl(0.55, 0.55, 1.3, '#e0bd63', 0, 0.55, 0, 10);
  bale.rotation.z = Math.PI / 2;
  group.add(bale);
  group.userData.collider = 0.7;
  return group;
}

const PROP_BUILDERS = {
  pine,
  oak,
  rock,
  fence,
  crate,
  barrel,
  chicken,
  crystal,
  mound,
  mushroom,
  pumpkin,
  sheep,
  bookstack,
  bench,
  lamp,
  planter,
  cart,
  banner,
  mirror,
  telescope,
  stump,
  haybale,
};

export function buildProp(type, rng = Math.random) {
  const builder = PROP_BUILDERS[type] ?? rock;
  const group = builder(rng);
  group.rotation.y = rng() * Math.PI * 2;
  const scale = 0.85 + rng() * 0.4;
  group.scale.setScalar(scale);
  return group;
}

export function hasProp(type) {
  return Object.prototype.hasOwnProperty.call(PROP_BUILDERS, type);
}

/* -------------------------------------------------------------- landmarks */
const LANDMARK_BUILDERS = {
  gasstation() {
    const group = new THREE.Group();
    const colliders = [];

    // The store sits well behind the pumps so the forecourt stays open.
    group.add(box(9, 3.4, 5.4, '#e6d7b8', 0, 1.7, -9));
    group.add(box(9.4, 0.5, 5.8, COLORS.red, 0, 3.6, -9));
    group.add(box(7.8, 1.4, 0.2, COLORS.glass, 0, 2.3, -6.2, { emissive: '#ffe9a8', emissiveIntensity: 0.55 }));
    group.add(box(2.1, 2.2, 0.22, COLORS.woodDark, 2.2, 1.1, -6.2));

    // Canopy over the pumps, just behind the boss gate.
    [[-4.4, -6.8], [4.4, -6.8], [-4.4, -2.2], [4.4, -2.2]].forEach(([x, z]) => {
      group.add(cyl(0.19, 0.19, 3.2, COLORS.metal, x, 1.6, z, 6));
      colliders.push({ x, z, r: 0.4 });
    });
    group.add(box(10.6, 0.55, 6.4, COLORS.red, 0, 3.4, -4.5));
    group.add(box(10.9, 0.2, 6.7, COLORS.yellow, 0, 3.72, -4.5));

    // Pumps under the canopy, either side of the walkway.
    [-2.6, 2.6].forEach((x) => {
      group.add(box(0.7, 1.5, 0.6, '#dfe4ea', x, 0.75, -4.6));
      group.add(box(0.6, 0.4, 0.04, '#39465c', x, 1.15, -4.28));
      group.add(box(0.14, 0.5, 0.14, COLORS.black, x + 0.42, 0.95, -4.4));
      colliders.push({ x, z: -4.6, r: 0.6 });
    });

    // Buffet sign pylon.
    group.add(box(0.4, 5.4, 0.4, COLORS.woodDark, -7.4, 2.7, -2.4));
    const sign = makeLabel('BUFFET', { size: 88, fill: '#ff2e63', background: '#fff6e0', border: COLORS.woodDark });
    sign.scale.set(3.4, 1.6, 1);
    sign.position.set(-7.4, 5.7, -2.4);
    group.add(sign);
    colliders.push({ x: -7.4, z: -2.4, r: 0.5 });

    // Overturned chicken truck at the edge of the lot.
    group.add(box(4.2, 2.2, 2.2, '#f2f2ef', 13, 1.3, -10));
    group.add(box(2.2, 2, 2, '#e8ecef', 15.6, 1.1, -10.4));
    group.add(box(1.5, 1.5, 1.6, COLORS.wood, 14, 2.6, -10));
    [-1.2, 1.2].forEach((z) => {
      group.add(cyl(0.55, 0.55, 0.3, COLORS.black, 13.6, 0.55, -10 + z, 8));
    });
    colliders.push({ x: 14, z: -10, r: 2.6 });

    colliders.push({ x: 0, z: -9, r: 4 });
    group.userData.colliders = colliders;
    return group;
  },

  cabin() {
    const group = new THREE.Group();
    const colliders = [];
    const floor = (y, z, width) => {
      group.add(box(width, 1.9, 4.6, COLORS.wood, 0, y, z));
      group.add(box(width + 0.5, 0.2, 5.1, COLORS.woodDark, 0, y + 1, z));
      for (let i = 0; i < 3; i += 1) {
        group.add(
          box(1.2, 0.8, 0.16, '#ffe4a3', -width / 2 + 1.5 + i * 2.4, y + 0.25, z + 2.36, {
            emissive: '#ffd57a',
            emissiveIntensity: 0.8,
          })
        );
      }
    };

    floor(1, -3.6, 9);
    floor(3, -5.4, 8);
    floor(5, -7.2, 7);

    group.add(box(9.8, 0.3, 2, COLORS.woodDark, 0, 3.9, -4.4));
    group.add(box(8.6, 0.3, 1.6, COLORS.woodDark, 0, 5.9, -6.2));

    // roof
    const roof = mesh(new THREE.ConeGeometry(6.4, 2.4, 4), '#7d3b34');
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 7, -8.4);
    group.add(roof);
    group.add(box(0.9, 1.6, 0.9, COLORS.stoneDark, 2.2, 8, -9.4));
    group.add(box(0.9, 0.2, 0.9, '#cbb59c', 2.2, 8.85, -9.4));

    // porch
    group.add(box(11, 0.25, 3.4, COLORS.woodDark, 0, 1.05, -1));
    [[-5, 0.3], [5, 0.3], [-5, -2.4], [5, -2.4]].forEach(([x, z]) => {
      group.add(cyl(0.12, 0.12, 2, COLORS.wood, x, 2.05, z, 6));
    });
    group.add(box(11.2, 0.25, 3.6, COLORS.woodDark, 0, 3.1, -1));

    // swing bench on the porch
    group.add(box(2.4, 0.14, 0.7, COLORS.wood, -2.6, 1.75, -1.4));
    group.add(box(2.4, 0.5, 0.12, COLORS.wood, -2.6, 2.05, -1.72));

    // basement door in the hill
    group.add(box(2.4, 1.6, 0.3, COLORS.woodDark, 6.4, 0.8, -4.6));
    group.add(box(2.2, 0.22, 0.3, COLORS.metal, 6.4, 1.55, -4.5));

    // pool table on the porch (obviously)
    group.add(box(2.6, 0.2, 1.4, '#2f7d4f', 4, 1.2, -1.2));
    group.add(box(2.8, 0.16, 1.6, COLORS.woodDark, 4, 1.08, -1.2));

    // shuffleboard table
    group.add(box(4.6, 0.18, 1.1, '#c8a06a', -3, 1.22, -1.2));
    [-2.2, 2.2].forEach((x) => {
      group.add(box(0.2, 0.9, 1.1, COLORS.woodDark, x - 0.7, 0.72, -1.2));
    });

    colliders.push({ x: 0, z: -4.2, r: 4.4 });
    colliders.push({ x: -0.7, z: 0.6, r: 2.1 });
    colliders.push({ x: 6.4, z: -4.6, r: 1.4 });
    group.userData.colliders = colliders;
    return group;
  },

  prairie() {
    const group = new THREE.Group();
    const colliders = [];

    // the big town mound
    const town = ball(6, '#b08a5a', 0, 0.4, -6);
    town.scale.set(1.4, 0.5, 1);
    group.add(town);
    group.add(cyl(1.5, 1.7, 0.5, '#c9a06b', 0, 1.7, -6, 12));
    group.add(box(2.6, 1.5, 2.2, '#a97c4e', 0, 2.5, -6));
    group.add(box(3, 0.2, 2.6, COLORS.woodDark, 0, 3.3, -6));
    group.add(box(0.8, 1.1, 0.15, COLORS.black, 0, 2.35, -4.9));
    group.add(box(0.9, 0.6, 0.15, '#ffe4a3', -0.8, 2.7, -4.9, { emissive: '#ffd57a', emissiveIntensity: 0.7 }));
    group.add(box(0.9, 0.6, 0.15, '#ffe4a3', 0.8, 2.7, -4.9, { emissive: '#ffd57a', emissiveIntensity: 0.7 }));

    // tiny flag and mayor's balcony
    group.add(cyl(0.04, 0.04, 1.6, COLORS.metal, 0, 4.2, -6, 5));
    const flag = box(0.6, 0.35, 0.03, COLORS.red, 0.32, 4.85, -6);
    group.add(flag);

    // tunnel mouths in the mound
    [[-3.4, -3.4], [3.6, -3.8], [-1.2, -1.6], [1.8, -1.4]].forEach(([x, z]) => {
      const mouth = cyl(0.55, 0.55, 0.2, COLORS.black, x, 0.55, z, 12);
      mouth.rotation.x = Math.PI / 2;
      group.add(mouth);
    });

    // ferret fortress on the ridge
    const fort = new THREE.Group();
    fort.position.set(9.5, 0, -9);
    fort.add(cyl(1.8, 2.6, 3.4, '#6a5a7a', 0, 1.7, 0, 8));
    fort.add(box(1.4, 1.8, 1.4, '#8a7899', 0, 4, 0));
    fort.add(cone(1.1, 1.6, '#4b3f5e', 0, 5.2, 0, 4));
    [-0.55, 0.55].forEach((x) => {
      fort.add(box(0.3, 0.4, 0.1, '#ffcf4d', x, 4.4, 0.72, { emissive: '#ffb03a', emissiveIntensity: 0.7 }));
    });
    group.add(fort);

    // wind cave arch
    const arch = new THREE.Group();
    arch.position.set(-8, 0, -7);
    [-1.6, 1.6].forEach((x) => {
      arch.add(box(0.8, 3, 0.8, COLORS.stone, x, 1.5, 0));
    });
    arch.add(box(4, 0.7, 0.9, COLORS.stoneDark, 0, 3.2, 0));
    const archSign = makeLabel('WIND CAVE', { size: 78, fill: '#fff3d2', background: '#4b3f5e' });
    archSign.scale.set(3, 1.2, 1);
    archSign.position.set(0, 4.2, 0);
    arch.add(archSign);
    group.add(arch);

    colliders.push({ x: 0, z: -6, r: 5.4 });
    colliders.push({ x: 9.5, z: -9, r: 2.8 });
    colliders.push({ x: -8, z: -7, r: 2.4 });
    group.userData.colliders = colliders;
    return group;
  },

  storybook() {
    const group = new THREE.Group();
    const colliders = [];

    // giant clock tower
    const tower = new THREE.Group();
    tower.position.set(0, 0, -9);
    tower.add(box(4.6, 7, 4.6, '#e0cfa8', 0, 3.5, 0));
    tower.add(box(5.2, 0.5, 5.2, COLORS.woodDark, 0, 7.2, 0));
    const roof = mesh(new THREE.ConeGeometry(4.2, 3.2, 4), COLORS.purple);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 9, 0);
    tower.add(roof);

    const face = mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.3, 24), '#fff7e2');
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 5.4, 2.36);
    tower.add(face);
    tower.add(box(0.18, 1.2, 0.12, COLORS.black, 0.45, 5.8, 2.55));
    tower.add(box(0.9, 0.18, 0.12, COLORS.black, 0.2, 5.1, 2.55));
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const tick = box(0.12, 0.3, 0.08, COLORS.woodDark, Math.sin(angle) * 1.55, 5.4 + Math.cos(angle) * 1.55, 2.52);
      tower.add(tick);
    }
    tower.add(box(1.6, 1.2, 0.3, '#ffe4a3', 0, 1.5, 2.35, { emissive: '#ffd57a', emissiveIntensity: 0.8 }));
    group.add(tower);

    // giant shoe house
    const shoe = new THREE.Group();
    shoe.position.set(-9.5, 0, -5);
    shoe.add(box(5, 2.6, 3, '#d8494c', 0, 1.3, 0));
    shoe.add(box(2.4, 2, 2.4, '#c33f42', 2.6, 2, 0));
    shoe.add(box(1.2, 1.6, 1.4, COLORS.cream, -1.8, 0.8, 1.5, { emissive: '#ffe9b0', emissiveIntensity: 0.5 }));
    shoe.add(box(5.2, 0.3, 3.2, '#8e2b2e', 0, 2.7, 0));
    group.add(shoe);

    // open book arch
    const book = new THREE.Group();
    book.position.set(8.5, 0, -6);
    book.add(box(3.6, 0.4, 2.4, COLORS.cream, -1.6, 1.2, 0));
    book.add(box(3.6, 0.4, 2.4, COLORS.cream, 1.6, 1.2, 0));
    book.children[0].rotation.z = 0.24;
    book.children[1].rotation.z = -0.24;
    book.add(box(3.8, 0.3, 2.6, COLORS.woodDark, -1.7, 0.95, 0));
    book.add(box(3.8, 0.3, 2.6, COLORS.woodDark, 1.7, 0.95, 0));
    group.add(book);

    // oversized mushrooms
    colliders.push({ x: 0, z: -9, r: 3.8 });
    colliders.push({ x: -9.5, z: -5, r: 3.2 });
    colliders.push({ x: 8.5, z: -6, r: 2.6 });

    group.userData.colliders = colliders;
    return group;
  },

  station() {
    const group = new THREE.Group();
    const colliders = [];

    // Union Station facade
    group.add(box(14, 4, 5, '#d8c8a8', 0, 2, -7));
    group.add(box(14.6, 0.6, 5.4, COLORS.woodDark, 0, 4.1, -7));
    for (let i = -3; i <= 3; i += 1) {
      group.add(cyl(0.32, 0.36, 3.4, '#e8ddc4', i * 1.8, 1.7, -4.4, 8));
    }
    group.add(box(15, 0.4, 1.6, '#c2af8b', 0, 3.6, -4.2));

    const tower = new THREE.Group();
    tower.position.set(0, 0, -8.6);
    tower.add(box(3, 8.5, 3, '#e3d4b4', 0, 4.25, 0));
    tower.add(box(3.4, 0.4, 3.4, COLORS.woodDark, 0, 8.6, 0));
    tower.add(ball(1.4, '#5f9e8f', 0, 9.6, 0));
    tower.add(cyl(0.08, 0.1, 1.4, COLORS.metal, 0, 10.8, 0, 5));
    tower.add(box(1.8, 0.8, 0.2, '#ffe4a3', 0, 6.4, 1.52, { emissive: '#ffd57a', emissiveIntensity: 0.9 }));
    group.add(tower);

    // Science City dome
    const dome = new THREE.Group();
    dome.position.set(-10, 0, -3);
    const shell = mesh(new THREE.SphereGeometry(3.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#8fb7d9');
    dome.add(shell);
    dome.add(cyl(3.5, 3.6, 0.5, '#5d7f9d', 0, 0.25, 0, 16));
    dome.add(box(1.6, 2, 0.3, '#3d5670', 0, 1, 3.3));
    group.add(dome);

    // the Rabbit Hole: a hole with ears
    const hole = new THREE.Group();
    hole.position.set(9.5, 0, -2);
    hole.add(cyl(2, 2, 0.4, '#5a4a6e', 0, 0.2, 0, 18));
    hole.add(cyl(1.7, 1.7, 0.36, '#1c1428', 0, 0.28, 0, 18));
    [-0.9, 0.9].forEach((x) => {
      const ear = mesh(new THREE.CapsuleGeometry(0.4, 1.6, 3, 8), '#f0c8d8');
      ear.position.set(x, 2.6, 0);
      ear.rotation.z = x > 0 ? -0.2 : 0.2;
      hole.add(ear);
    });
    const holeSign = makeLabel('THE RABBIT HOLE', { size: 64, fill: '#ffb3e0', background: '#2a1b3d' });
    holeSign.scale.set(3.2, 1.3, 1);
    holeSign.position.set(0, 4.2, 0);
    hole.add(holeSign);
    group.add(hole);

    // glowing beam conduit
    group.add(box(0.3, 0.3, 8, '#7ce7ff', -4.4, 2.4, 0, { emissive: '#45cfe8', emissiveIntensity: 1 }));

    colliders.push({ x: 0, z: -7, r: 5.6 });
    colliders.push({ x: -10, z: -3, r: 3.6 });
    colliders.push({ x: 9.5, z: -2, r: 2.4 });
    group.userData.colliders = colliders;
    return group;
  },

  luminarium() {
    const group = new THREE.Group();
    const colliders = [];

    const dome = mesh(
      new THREE.SphereGeometry(5.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      '#3ad6c0',
      { emissive: '#1a8f9c', emissiveIntensity: 0.7, transparent: true, opacity: 0.92 }
    );
    dome.position.set(0, 0.2, -8);
    group.add(dome);
    group.add(cyl(5.5, 5.7, 0.6, '#1f3a5c', 0, 0.3, -8, 22));
    group.add(box(2.4, 2.6, 0.4, '#122a44', 0, 1.4, -2.4));

    // light beams
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: '#8bfff0',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i += 1) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 9, 8, 1, true), beamMaterial);
      beam.position.set(-6 + i * 4, 5.4, -6);
      beam.rotation.z = (i - 1.5) * 0.16;
      group.add(beam);
    }

    // arches
    [[-7, 2], [7, 2]].forEach(([x, z]) => {
      const arch = new THREE.Group();
      arch.position.set(x, 0, z);
      arch.add(box(0.4, 3.4, 0.4, '#2f4d76', -1.2, 1.7, 0));
      arch.add(box(0.4, 3.4, 0.4, '#2f4d76', 1.2, 1.7, 0));
      arch.add(box(3, 0.4, 0.4, '#2f4d76', 0, 3.5, 0));
      arch.add(box(2.2, 2.6, 0.12, '#a9f7ff', 0, 1.8, 0, { emissive: '#66ffd4', emissiveIntensity: 0.6 }));
      group.add(arch);
    });

    // fog room box
    group.add(box(3.2, 2.8, 3.2, '#9fd8e8', 8.5, 1.4, 6, { transparent: true, opacity: 0.35 }));
    group.add(box(3.4, 0.3, 3.4, '#2f4d76', 8.5, 2.9, 6));

    colliders.push({ x: 0, z: -8, r: 5.6 });
    colliders.push({ x: -7, z: 2, r: 1.4 });
    colliders.push({ x: 7, z: 2, r: 1.4 });
    colliders.push({ x: 8.5, z: 6, r: 2 });
    group.userData.colliders = colliders;
    return group;
  },

  pavilion() {
    const group = new THREE.Group();
    const colliders = [];

    // museum block with columns
    group.add(box(16, 6, 6, '#cfc4b4', 0, 3, -8));
    group.add(box(17, 0.8, 7, '#a99a86', 0, 6.4, -8));
    for (let i = -3.5; i <= 3.5; i += 1) {
      group.add(cyl(0.38, 0.42, 4.6, '#f2ead9', i * 2, 2.3, -4.6, 10));
    }
    group.add(box(17, 0.7, 1.8, '#b7a894', 0, 5.1, -4.4));
    group.add(box(3.2, 2.6, 0.4, '#3d2c50', 0, 1.4, -4.8));
    group.add(box(3.6, 0.3, 0.6, COLORS.yellow, 0, 2.85, -4.7, { emissive: '#ffd86b', emissiveIntensity: 0.7 }));

    // marquee sign
    const sign = makeLabel('THE VACATION COLLECTOR', { size: 58, fill: '#ff2e63', background: '#fff3d8' });
    sign.scale.set(7, 2.2, 1);
    sign.position.set(0, 7.9, -6);
    group.add(sign);

    // stage / steps
    group.add(box(12, 0.3, 2.6, '#b7a894', 0, 0.15, -2.6));
    group.add(box(10, 0.3, 1.6, '#a99a86', 0, 0.45, -3.4));

    // stairs at the sides
    [-5, 5].forEach((x) => {
      group.add(box(3, 0.3, 1.2, '#a99a86', x, 0.15, -1.4));
    });

    // giant banner flags
    [[-8.6, -1], [8.6, -1]].forEach(([x, z]) => {
      group.add(cyl(0.08, 0.08, 5.2, COLORS.metal, x, 2.6, z, 6));
      group.add(box(1.6, 2.2, 0.06, '#ff2e63', x + 0.8, 4, z));
      group.add(box(1, 1, 0.04, '#ffd86b', x + 0.8, 4, z + 0.04));
    });

    // an awake exhibit or two
    const dino = new THREE.Group();
    dino.position.set(-11, 0, 2);
    dino.add(box(1.4, 1.4, 2.6, '#6ea86e', 0, 1.4, 0));
    dino.add(box(0.9, 1.2, 0.9, '#6ea86e', 0, 2.2, 1.1));
    dino.add(ball(0.5, '#6ea86e', 0, 2.7, 1.35));
    dino.add(cone(0.22, 0.5, '#e8e0c0', 0, 3.35, 1.4));
    dino.add(box(0.3, 1.4, 0.3, '#5c945c', -0.5, 0.7, 0.9));
    dino.add(box(0.3, 1.4, 0.3, '#5c945c', 0.5, 0.7, 0.9));
    dino.add(box(0.3, 1, 0.3, '#5c945c', -0.5, 0.5, -0.9));
    dino.add(box(0.3, 1, 0.3, '#5c945c', 0.5, 0.5, -0.9));
    const dinoBadge = makeEmojiSprite('🦖', 0.9);
    dinoBadge.position.set(0, 4.1, 0);
    dino.add(dinoBadge);
    group.add(dino);

    const caseGroup = new THREE.Group();
    caseGroup.position.set(11, 0, 1);
    caseGroup.add(box(2, 2.6, 2, '#8fd8e8', 0, 1.3, 0, { transparent: true, opacity: 0.35 }));
    caseGroup.add(box(2.2, 0.3, 2.2, '#3d2c50', 0, 2.8, 0));
    const relic = makeEmojiSprite('🗃️', 1.4);
    relic.position.set(0, 1.5, 0);
    caseGroup.add(relic);
    group.add(caseGroup);

    colliders.push({ x: 0, z: -8, r: 7 });
    colliders.push({ x: -11, z: 2, r: 2 });
    colliders.push({ x: 11, z: 1, r: 1.6 });
    group.userData.colliders = colliders;
    return group;
  },
};

export function buildLandmark(type) {
  const builder = LANDMARK_BUILDERS[type] ?? LANDMARK_BUILDERS.gasstation;
  return builder();
}

/* --------------------------------------------------------------- objects */
function ring(color, radius = 0.9) {
  const geometry = new THREE.TorusGeometry(radius, 0.05, 6, 24);
  const item = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  item.rotation.x = -Math.PI / 2;
  item.position.y = 0.06;
  return item;
}

export function makeCollectible({ emoji, kind }) {
  const group = new THREE.Group();
  const tint = kind === 'secret' ? '#ffd86b' : kind === 'clue' ? '#7ce7ff' : '#ffb3d9';
  group.add(ring(tint, kind === 'secret' ? 0.7 : 0.85));

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.28, 3.4, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.12, depthWrite: false })
  );
  beam.position.y = 1.7;
  group.add(beam);

  const frame = box(0.92, 1.06, 0.1, kind === 'secret' ? '#ffe9a8' : '#fff6e0', 0, 1.45, 0);
  group.add(frame);
  group.add(box(0.74, 0.86, 0.06, kind === 'secret' ? '#ffcf4d' : '#f0dcc0', 0, 1.45, 0.05));

  const icon = makeEmojiSprite(emoji, 0.98);
  icon.position.set(0, 1.47, 0.14);
  group.add(icon);

  group.userData.bob = true;
  group.userData.spin = kind !== 'secret' ? 0.9 : 1.4;
  group.userData.baseY = 0;
  return group;
}

export function makeGate(labelText) {
  const group = new THREE.Group();

  [-1.9, 1.9].forEach((x) => {
    group.add(cyl(0.24, 0.3, 4.2, COLORS.woodDark, x, 2.1, 0, 8));
  });
  group.add(box(4.4, 0.6, 0.6, COLORS.woodDark, 0, 4.2, 0));
  group.add(box(3.6, 3.4, 0.12, '#3a2350', 0, 2, 0, { transparent: true, opacity: 0.72 }));
  group.add(ring('#ff2e63', 1.4));

  const icon = makeEmojiSprite('🗃️', 1.1);
  icon.position.set(0, 3.1, 0.2);
  group.add(icon);

  if (labelText) {
    const label = makeLabel(labelText, { size: 54, fill: '#fff6e0', background: 'rgba(58, 35, 80, 0.92)' });
    label.scale.set(4.2, 1.5, 1);
    label.position.set(0, 4.9, 0);
    group.add(label);
  }

  group.userData.gate = true;
  return group;
}

export function makeSign(text) {
  const group = new THREE.Group();
  group.add(cyl(0.1, 0.12, 1.9, COLORS.woodDark, 0, 0.95, 0, 6));
  group.add(box(2.1, 0.14, 0.5, COLORS.woodDark, 0, 1.95, 0));
  const label = makeLabel(text, { size: 38, fill: '#fff8ec', background: 'rgba(66, 44, 30, 0.92)' });
  label.scale.set(2.8, 1.12, 1);
  label.position.set(0, 2.9, 0);
  group.add(label);
  group.userData.collider = 0.3;
  group.userData.sign = true;
  return group;
}

export function makeTunnel() {
  const group = new THREE.Group();
  const hole = cyl(0.85, 0.95, 0.3, '#1a1020', 0, 0.16, 0, 16);
  group.add(hole);
  const lip = mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 18), '#6b4b32');
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.3;
  group.add(lip);
  const icon = makeEmojiSprite('🕳️', 0.7);
  icon.position.set(0, 1.1, 0);
  group.add(icon);
  group.userData.collider = 0.5;
  return group;
}

export function makePerson(emoji, palette) {
  const group = new THREE.Group();
  const colors = {
    shirt: palette?.shirt ?? '#7b5bd6',
    pants: palette?.pants ?? '#2c3a63',
    hair: palette?.hair ?? '#3b2a22',
    skin: palette?.skin ?? '#f0c49b',
  };

  const legs = [];
  [-0.17, 0.17].forEach((x) => {
    const leg = box(0.24, 0.78, 0.26, colors.pants, x, 0.39, 0);
    leg.userData.baseX = x;
    group.add(leg);
    legs.push(leg);
  });

  group.add(box(0.86, 0.86, 0.5, colors.shirt, 0, 1.24, 0));
  const head = ball(0.4, colors.skin, 0, 1.85, 0);
  group.add(head);
  const hair = ball(0.44, colors.hair, 0, 1.96, -0.03);
  hair.scale.set(1.04, 0.72, 1.04);
  group.add(hair);

  [-1, 1].forEach((side) => {
    const eye = ball(0.055, '#241a20', side * 0.15, 1.87, 0.36);
    group.add(eye);
  });

  const arms = [];
  [-0.56, 0.56].forEach((x) => {
    const arm = box(0.2, 0.78, 0.2, colors.shirt, x, 1.24, 0);
    arm.userData.baseX = x;
    group.add(arm);
    arms.push(arm);
  });

  const badge = makeEmojiSprite(emoji, 0.72);
  badge.position.set(0, 2.85, 0);
  group.add(badge);

  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.head = head;
  group.userData.baseY = 0;
  return group;
}

export function makeKid(variant) {
  const isJira = variant === 'jira';
  const palette = isJira
    ? { shirt: '#3cc9c0', pants: '#2c3a63', hair: '#2a2231', skin: '#f2c49b', accent: '#ffd86b' }
    : { shirt: '#ff8a3d', pants: '#3a5f8a', hair: '#4a2f1f', skin: '#eab98e', accent: '#3ddc84' };

  const group = new THREE.Group();
  const scale = isJira ? 1.08 : 0.9;
  group.scale.setScalar(scale);

  const legs = [];
  [-0.17, 0.17].forEach((x) => {
    const leg = box(0.24, 0.72, 0.26, palette.pants, x, 0.36, 0);
    group.add(leg);
    legs.push(leg);
  });

  const body = box(0.82, 0.84, 0.48, palette.shirt, 0, 1.18, 0);
  group.add(body);

  if (isJira) {
    // satchel and notebook
    group.add(box(0.5, 0.42, 0.18, '#7b5bd6', 0.44, 1.12, -0.28));
    group.add(box(0.42, 0.06, 0.16, '#5b3aa6', 0.44, 1.32, -0.28));
  } else {
    // hoodie pocket + cap
    group.add(box(0.46, 0.24, 0.1, '#e8752f', 0, 1.02, 0.26));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), material('#3ddc84'));
    cap.position.set(0, 1.94, 0);
    group.add(cap);
    group.add(box(0.44, 0.06, 0.28, '#2fae68', 0, 1.94, 0.34));
  }

  const head = ball(0.38, palette.skin, 0, 1.78, 0);
  group.add(head);

  const hair = ball(0.41, palette.hair, 0, 1.88, -0.03);
  hair.scale.set(1.03, 0.72, 1.03);
  group.add(hair);

  [-1, 1].forEach((side) => {
    group.add(ball(0.06, '#241a20', side * 0.14, 1.8, 0.34));
  });

  // a big cartoon smile
  const smile = box(0.16, 0.05, 0.04, '#9c4a45', 0, 1.66, 0.35);
  group.add(smile);

  const arms = [];
  [-0.53, 0.53].forEach((x) => {
    const arm = box(0.18, 0.72, 0.18, palette.shirt, x, 1.18, 0);
    group.add(arm);
    arms.push(arm);
  });

  const badge = makeEmojiSprite(isJira ? '🔎' : '⚡', 0.6);
  badge.position.set(0, 2.75, 0);
  badge.visible = false;
  group.add(badge);

  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.head = head;
  group.userData.badge = badge;
  group.userData.baseY = 0;
  group.userData.kid = variant;
  return group;
}

/** Swing the legs and arms of a simple character. */
export function animateCharacter(character, time, speed, investigating = false) {
  const { legs, arms, head } = character.userData ?? {};
  const stride = Math.min(1, speed / 5);
  const swing = Math.sin(time * (8 + speed * 0.9)) * 0.6 * stride;

  if (legs) {
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
  }
  if (arms) {
    arms[0].rotation.x = -swing * 0.8;
    arms[1].rotation.x = swing * 0.8;
    arms[0].rotation.z = investigating ? 0.7 : 0;
    arms[1].rotation.z = investigating ? -0.5 : 0;
  }
  if (head) {
    head.position.y = 1.78 + Math.sin(time * 3.2) * 0.02;
  }
  character.position.y = Math.abs(Math.sin(time * 9)) * 0.045 * stride;
}
