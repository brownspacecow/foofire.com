import * as THREE from 'three';

// Shared geometry and materials keep 28 simultaneous plushies light.
const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 12);
const GEO = new Map();
const MATERIALS = new Map();

function cachedGeo(key, make) {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
}

function boxGeo(w, h, d) {
  return cachedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function capsuleGeo(r, l) {
  return cachedGeo(`cap:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 8));
}
function cylinderGeo(r1, r2, h, seg = 12) {
  return cachedGeo(`cyl:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
}
function coneGeo(r, h, seg = 10) {
  return cachedGeo(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}
function torusGeo(r, tube, arc = Math.PI * 2) {
  return cachedGeo(`torus:${r}:${tube}:${arc}`, () => new THREE.TorusGeometry(r, tube, 6, 18, arc));
}
function halfSphereGeo(r) {
  return cachedGeo(`half:${r}`, () => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
}

export function plushieMaterial(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...options })
    );
  }
  return MATERIALS.get(key);
}

const INK = plushieMaterial('#241a2e', { roughness: 0.5 });
const CREAM = plushieMaterial('#fff8ea', { roughness: 0.55 });
const GOLD = plushieMaterial('#ffd93d', { metalness: 0.35, roughness: 0.4 });
const PINK = plushieMaterial('#ff7fa8', { roughness: 0.7 });
const WOOD = plushieMaterial('#8b5a3c', { roughness: 0.8 });

function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function box(parent, material, x, y, z, w, h, d) {
  return mesh(parent, boxGeo(w, h, d), material, x, y, z);
}

function sphere(parent, material, x, y, z, r, sx = 1, sy = 1, sz = 1) {
  const m = mesh(parent, UNIT_SPHERE, material, x, y, z);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}

function capsule(parent, material, x, y, z, r, length, rz = 0, ry = 0) {
  const m = mesh(parent, capsuleGeo(r, length), material, x, y, z);
  m.rotation.set(0, ry, rz);
  return m;
}

function cylinder(parent, material, x, y, z, r1, r2, h, rx = 0, ry = 0, rz = 0) {
  const m = mesh(parent, cylinderGeo(r1, r2, h), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cone(parent, material, x, y, z, r, h, rx = 0, ry = 0, rz = 0) {
  const m = mesh(parent, coneGeo(r, h), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function torus(parent, material, x, y, z, r, tube, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) {
  const m = mesh(parent, torusGeo(r, tube, arc), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function base(group, faceY, faceZ, eyeGap, hatY, headR, bodyY, bodyR, bodyFront) {
  return { group, faceY, faceZ, eyeGap, hatY, headR, bodyY, bodyR, bodyFront };
}

function blockyBase(fur, accent) {
  const g = new THREE.Group();
  box(g, fur, 0, 0.34, 0, 0.54, 0.5, 0.34);
  box(g, fur, 0, 0.79, 0, 0.44, 0.38, 0.38);
  box(g, fur, -0.35, 0.37, 0, 0.13, 0.34, 0.16);
  box(g, fur, 0.35, 0.37, 0, 0.13, 0.34, 0.16);
  box(g, accent, -0.14, 0.13, 0, 0.15, 0.26, 0.18);
  box(g, accent, 0.14, 0.13, 0, 0.15, 0.26, 0.18);
  box(g, accent, -0.35, 0.21, 0, 0.145, 0.06, 0.17);
  box(g, accent, 0.35, 0.21, 0, 0.145, 0.06, 0.17);
  return base(g, 0.79, 0.195, 0.09, 0.98, 0.23, 0.34, 0.3, 0.18);
}

function dollBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.4, 0, 0.28, 1, 1.2, 0.85);
  sphere(g, fur, 0, 0.78, 0, 0.23);
  capsule(g, fur, -0.3, 0.4, 0, 0.06, 0.22, -0.3);
  capsule(g, fur, 0.3, 0.4, 0, 0.06, 0.22, 0.3);
  capsule(g, fur, -0.1, 0.13, 0, 0.065, 0.18);
  capsule(g, fur, 0.1, 0.13, 0, 0.065, 0.18);
  sphere(g, accent, 0, 0.98, 0, 0.09, 1.4, 0.5, 1.2);
  return base(g, 0.78, 0.22, 0.08, 0.98, 0.23, 0.4, 0.26, 0.22);
}

function bearBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.4, 0, 0.33, 1.05, 1.05, 0.88);
  sphere(g, fur, 0, 0.77, 0, 0.24);
  sphere(g, fur, -0.17, 0.94, 0, 0.09);
  sphere(g, fur, 0.17, 0.94, 0, 0.09);
  sphere(g, accent, -0.17, 0.94, 0.03, 0.045, 1, 1, 0.5);
  sphere(g, accent, 0.17, 0.94, 0.03, 0.045, 1, 1, 0.5);
  sphere(g, accent, 0, 0.7, 0.22, 0.1, 1.15, 0.72, 0.62);
  sphere(g, INK, 0, 0.73, 0.275, 0.032, 1.3, 0.85, 0.7);
  capsule(g, fur, -0.34, 0.42, 0, 0.09, 0.2, -0.25);
  capsule(g, fur, 0.34, 0.42, 0, 0.09, 0.2, 0.25);
  sphere(g, fur, -0.14, 0.14, 0.03, 0.13);
  sphere(g, fur, 0.14, 0.14, 0.03, 0.13);
  sphere(g, accent, -0.14, 0.12, 0.14, 0.055, 1, 0.7, 0.55);
  sphere(g, accent, 0.14, 0.12, 0.14, 0.055, 1, 0.7, 0.55);
  return base(g, 0.78, 0.235, 0.09, 0.98, 0.24, 0.4, 0.32, 0.26);
}

function bunnyBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.38, 0, 0.3, 1, 1.1, 0.9);
  sphere(g, fur, 0, 0.73, 0, 0.23);
  capsule(g, fur, -0.1, 1.02, -0.01, 0.06, 0.32, -0.1);
  capsule(g, fur, 0.1, 1.02, -0.01, 0.06, 0.32, 0.1);
  capsule(g, accent, -0.1, 1.03, 0.045, 0.032, 0.27, -0.1);
  capsule(g, accent, 0.1, 1.03, 0.045, 0.032, 0.27, 0.1);
  capsule(g, fur, -0.3, 0.4, 0, 0.08, 0.17, -0.3);
  capsule(g, fur, 0.3, 0.4, 0, 0.08, 0.17, 0.3);
  sphere(g, fur, -0.14, 0.14, 0.04, 0.14, 1, 0.8, 1.15);
  sphere(g, fur, 0.14, 0.14, 0.04, 0.14, 1, 0.8, 1.15);
  sphere(g, accent, 0, 0.66, 0.21, 0.055, 1.2, 0.8, 0.8);
  return base(g, 0.74, 0.225, 0.085, 0.94, 0.23, 0.38, 0.28, 0.24);
}

function catBase(fur, accent) {
  const g = bearBase(fur, accent);
  cone(g.group, fur, -0.15, 0.98, 0, 0.1, 0.18, 0, 0, -0.12);
  cone(g.group, fur, 0.15, 0.98, 0, 0.1, 0.18, 0, 0, 0.12);
  cone(g.group, accent, -0.15, 0.98, 0.035, 0.05, 0.1, 0, 0, -0.12);
  cone(g.group, accent, 0.15, 0.98, 0.035, 0.05, 0.1, 0, 0, 0.12);
  capsule(g.group, fur, 0, 0.4, -0.3, 0.05, 0.32, 1.1);
  box(g.group, accent, -0.11, 0.68, 0.27, 0.14, 0.012, 0.02);
  box(g.group, accent, 0.11, 0.68, 0.27, 0.14, 0.012, 0.02);
  g.hatY = 1.0;
  return g;
}

function dogBase(fur, accent) {
  const g = bearBase(fur, accent);
  capsule(g.group, fur, -0.22, 0.79, 0, 0.065, 0.2, 0.5);
  capsule(g.group, fur, 0.22, 0.79, 0, 0.065, 0.2, -0.5);
  sphere(g.group, accent, 0, 0.68, 0.25, 0.09, 1, 0.7, 0.9);
  capsule(g.group, fur, 0, 0.4, -0.32, 0.05, 0.26, 1.0);
  g.hatY = 0.98;
  return g;
}

function frogBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.3, 0, 0.3, 1.15, 0.9, 1);
  sphere(g, fur, 0, 0.63, 0.02, 0.29, 1.15, 0.78, 0.95);
  sphere(g, fur, -0.14, 0.78, 0.1, 0.11);
  sphere(g, fur, 0.14, 0.78, 0.1, 0.11);
  capsule(g, fur, -0.31, 0.35, 0, 0.07, 0.16, -0.4);
  capsule(g, fur, 0.31, 0.35, 0, 0.07, 0.16, 0.4);
  sphere(g, fur, -0.2, 0.08, 0.12, 0.14, 1, 0.55, 1.4);
  sphere(g, fur, 0.2, 0.08, 0.12, 0.14, 1, 0.55, 1.4);
  sphere(g, accent, 0, 0.62, 0.18, 0.1, 1.5, 0.55, 0.55);
  return base(g, 0.64, 0.275, 0.125, 0.83, 0.29, 0.3, 0.31, 0.3);
}

function blobBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.36, 0, 0.36, 1.12, 0.96, 1);
  sphere(g, fur, -0.18, 0.12, 0.04, 0.13, 1, 0.55, 1.3);
  sphere(g, fur, 0.18, 0.12, 0.04, 0.13, 1, 0.55, 1.3);
  sphere(g, fur, -0.37, 0.34, 0, 0.09, 0.8, 0.55, 0.8);
  sphere(g, fur, 0.37, 0.34, 0, 0.09, 0.8, 0.55, 0.8);
  sphere(g, accent, 0, 0.3, 0.3, 0.12, 1.5, 0.9, 0.25);
  return base(g, 0.46, 0.33, 0.1, 0.76, 0.31, 0.36, 0.34, 0.32);
}

function penguinBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.4, 0, 0.33, 1, 1.25, 0.9);
  sphere(g, accent, 0, 0.38, 0.24, 0.23, 1, 1.3, 0.35);
  capsule(g, fur, -0.32, 0.42, 0, 0.075, 0.18, -0.4);
  capsule(g, fur, 0.32, 0.42, 0, 0.075, 0.18, 0.4);
  sphere(g, fur, -0.13, 0.08, 0.12, 0.12, 1, 0.5, 1.35);
  sphere(g, fur, 0.13, 0.08, 0.12, 0.12, 1, 0.5, 1.35);
  return base(g, 0.54, 0.29, 0.08, 0.82, 0.27, 0.4, 0.3, 0.28);
}

function dragonBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.36, 0, 0.31, 1.1, 1, 0.9);
  sphere(g, fur, 0, 0.7, 0.01, 0.24);
  sphere(g, fur, 0, 0.63, 0.2, 0.14, 1.2, 0.72, 0.9);
  cone(g, accent, -0.1, 0.9, 0, 0.05, 0.17, 0, 0, -0.28);
  cone(g, accent, 0.1, 0.9, 0, 0.05, 0.17, 0, 0, 0.28);
  cone(g, accent, -0.28, 0.45, -0.12, 0.16, 0.33, 0.25, 0.6, 1.2);
  cone(g, accent, 0.28, 0.45, -0.12, 0.16, 0.33, 0.25, -0.6, -1.2);
  capsule(g, fur, 0, 0.35, -0.3, 0.055, 0.28, 1.15);
  sphere(g, fur, -0.15, 0.13, 0.03, 0.13);
  sphere(g, fur, 0.15, 0.13, 0.03, 0.13);
  capsule(g, fur, -0.3, 0.37, 0, 0.07, 0.16, -0.3);
  capsule(g, fur, 0.3, 0.37, 0, 0.07, 0.16, 0.3);
  return base(g, 0.7, 0.24, 0.085, 0.94, 0.24, 0.36, 0.29, 0.26);
}

function spiderBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.37, 0, 0.29, 1.15, 0.9, 1);
  sphere(g, fur, 0, 0.55, 0.1, 0.2, 1.05, 0.85, 0.9);
  for (let i = 0; i < 8; i += 1) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const z = -0.2 + k * 0.13;
    capsule(g, fur, side * 0.24, 0.28, z, 0.022, 0.24, side * 1.05, side * (0.15 - k * 0.1));
    sphere(g, accent, side * 0.43, 0.12, z + 0.02, 0.045, 1, 0.6, 1.2);
  }
  sphere(g, accent, -0.08, 0.58, 0.23, 0.06, 1, 1, 0.5);
  sphere(g, accent, 0.08, 0.58, 0.23, 0.06, 1, 1, 0.5);
  return base(g, 0.58, 0.26, 0.075, 0.76, 0.2, 0.37, 0.3, 0.28);
}

function ghostBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.44, 0, 0.32, 1.05, 1.2, 0.9);
  for (let i = 0; i < 5; i += 1) {
    const x = -0.22 + i * 0.11;
    sphere(g, fur, x, 0.12, 0.02, 0.1, 1, 1.2, 0.9);
  }
  sphere(g, fur, -0.31, 0.44, 0, 0.07, 0.8, 0.5, 0.8);
  sphere(g, fur, 0.31, 0.44, 0, 0.07, 0.8, 0.5, 0.8);
  sphere(g, accent, 0, 0.34, 0.29, 0.1, 1.4, 0.9, 0.2);
  return base(g, 0.5, 0.295, 0.09, 0.84, 0.28, 0.44, 0.31, 0.29);
}

function robotBase(fur, accent) {
  const g = new THREE.Group();
  box(g, fur, 0, 0.34, 0, 0.42, 0.44, 0.28);
  box(g, fur, 0, 0.7, 0, 0.36, 0.3, 0.3);
  box(g, accent, 0, 0.36, 0.15, 0.2, 0.16, 0.03);
  box(g, fur, -0.28, 0.34, 0, 0.1, 0.3, 0.1);
  box(g, fur, 0.28, 0.34, 0, 0.1, 0.3, 0.1);
  box(g, accent, -0.28, 0.16, 0, 0.11, 0.06, 0.11);
  box(g, accent, 0.28, 0.16, 0, 0.11, 0.06, 0.11);
  box(g, fur, -0.12, 0.1, 0, 0.12, 0.2, 0.14);
  box(g, fur, 0.12, 0.1, 0, 0.12, 0.2, 0.14);
  cylinder(g, accent, 0, 0.92, 0, 0.012, 0.012, 0.14);
  sphere(g, accent, 0, 1.0, 0, 0.045);
  cylinder(g, accent, -0.19, 0.7, 0, 0.045, 0.045, 0.06, 0, 0, Math.PI / 2);
  cylinder(g, accent, 0.19, 0.7, 0, 0.045, 0.045, 0.06, 0, 0, Math.PI / 2);
  return base(g, 0.7, 0.155, 0.08, 0.88, 0.2, 0.34, 0.22, 0.15);
}

let starGeoCache = null;
function starGeometry() {
  if (!starGeoCache) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 0.4 : 0.175;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    starGeoCache = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 2,
      curveSegments: 3,
    });
    starGeoCache.center();
  }
  return starGeoCache;
}

function starBase(fur, accent) {
  const g = new THREE.Group();
  mesh(g, starGeometry(), fur, 0, 0.51, 0.02);
  sphere(g, fur, -0.16, 0.18, 0, 0.1, 1, 0.55, 1.2);
  sphere(g, fur, 0.16, 0.18, 0, 0.1, 1, 0.55, 1.2);
  sphere(g, accent, 0, 0.48, 0.14, 0.09, 1.2, 0.7, 0.3);
  return base(g, 0.55, 0.14, 0.07, 0.93, 0.22, 0.5, 0.3, 0.14);
}

function ponyBase(fur, accent) {
  const g = new THREE.Group();
  sphere(g, fur, 0, 0.4, 0, 0.3, 1.5, 0.85, 1);
  cylinder(g, accent, -0.19, 0.16, -0.14, 0.045, 0.04, 0.28);
  cylinder(g, accent, 0.19, 0.16, -0.14, 0.045, 0.04, 0.28);
  cylinder(g, accent, -0.19, 0.16, 0.14, 0.045, 0.04, 0.28);
  cylinder(g, accent, 0.19, 0.16, 0.14, 0.045, 0.04, 0.28);
  cylinder(g, fur, 0, 0.64, 0.12, 0.13, 0.17, 0.32, 0.35);
  sphere(g, fur, 0, 0.77, 0.23, 0.21, 1, 1, 1.15);
  sphere(g, fur, 0, 0.7, 0.4, 0.09, 1.1, 0.75, 1);
  cone(g, fur, -0.12, 0.93, 0.18, 0.055, 0.16, 0, 0, -0.18);
  cone(g, fur, 0.12, 0.93, 0.18, 0.055, 0.16, 0, 0, 0.18);
  cone(g, accent, 0, 0.86, 0.0, 0.08, 0.28, -0.5);
  cone(g, accent, 0, 0.78, -0.12, 0.07, 0.24, -0.7);
  capsule(g, accent, 0, 0.4, -0.34, 0.055, 0.3, 1.2);
  return base(g, 0.77, 0.45, 0.085, 0.98, 0.21, 0.4, 0.33, 0.28);
}

const BASES = {
  blocky: blockyBase,
  doll: dollBase,
  bear: bearBase,
  bunny: bunnyBase,
  cat: catBase,
  dog: dogBase,
  frog: frogBase,
  blob: blobBase,
  penguin: penguinBase,
  dragon: dragonBase,
  spider: spiderBase,
  ghost: ghostBase,
  robot: robotBase,
  star: starBase,
  pony: ponyBase,
};

const CHECKERS = new Map();
function checkerMaterial(color) {
  if (!CHECKERS.has(color)) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff6df';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = color;
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    CHECKERS.set(color, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }));
  }
  return CHECKERS.get(color);
}

function addPattern(model, entry, accent) {
  const g = model.group;
  const pattern = entry.pattern;
  const chestZ = model.bodyFront + 0.012;

  if (pattern === 'belly') {
    sphere(g, accent, 0, model.bodyY, chestZ, model.bodyR * 0.62, 1, 0.95, 0.14);
  } else if (pattern === 'checker') {
    const patch = sphere(g, checkerMaterial(entry.accent), 0, model.bodyY, chestZ, model.bodyR * 0.64, 1, 0.95, 0.16);
    patch.castShadow = false;
  } else if (pattern === 'spots') {
    const spots = [
      [-0.16, 0.12, 0.07],
      [0.14, 0.02, 0.08],
      [-0.07, -0.1, 0.06],
      [0.2, 0.18, 0.055],
    ];
    spots.forEach(([dx, dy, r]) => {
      sphere(g, accent, dx * model.bodyR * 2, model.bodyY + dy, model.bodyFront - 0.01, r, 1, 1, 0.35);
    });
  } else if (pattern === 'stripes') {
    [0.12, -0.12].forEach((dy) => {
      torus(g, accent, 0, model.bodyY + dy, 0, model.bodyR * 0.78, 0.026, Math.PI / 2);
    });
  } else if (pattern === 'patch') {
    const patch = sphere(g, accent, -model.eyeGap * 0.95, model.faceY + 0.03, model.faceZ + 0.006, 0.085, 1, 0.9, 0.22);
    patch.rotation.z = -0.25;
  } else if (pattern === 'star') {
    const star = mesh(g, starGeometry(), accent, 0, model.bodyY + 0.02, chestZ);
    star.scale.setScalar(Math.min(0.44, model.bodyR * 1.15));
    star.rotation.z = 0.12;
  }
}

function addEye(parent, x, y, z, size, style, accent) {
  if (style === 'closed') {
    box(parent, INK, x, y, z, size * 2, 0.018, 0.018);
    return;
  }
  if (style === 'button') {
    sphere(parent, INK, x, y, z, size * 0.72, 1, 1, 0.45);
    box(parent, CREAM, x, y, z + size * 0.34, size * 0.9, 0.012, 0.012);
    box(parent, CREAM, x, y, z + size * 0.34, 0.012, size * 0.9, 0.012);
    return;
  }
  if (style === 'glowing') {
    const glow = plushieMaterial(accent, { emissive: accent, emissiveIntensity: 0.9, roughness: 0.3 });
    sphere(parent, glow, x, y, z, size * 0.9, 1, 1, 0.6);
    sphere(parent, CREAM, x + size * 0.18, y + size * 0.2, z + size * 0.34, size * 0.2);
    return;
  }
  const sleepy = style === 'sleepy';
  sphere(parent, CREAM, x, y, z, size, 1, sleepy ? 0.74 : 1, 0.55);
  sphere(parent, INK, x, y - (sleepy ? size * 0.22 : 0), z + size * 0.35, size * 0.5, 1, 1, 0.5);
  sphere(parent, CREAM, x + size * 0.19, y + size * 0.18, z + size * 0.5, size * 0.14);
}

function addMouth(model, entry) {
  const g = model.group;
  const z = model.faceZ + 0.014;
  const y = model.faceY - 0.125;
  const mouth = entry.mouth;

  if (mouth === 'none') return;
  if (mouth === 'beak') {
    cone(g, plushieMaterial('#f59e0b', { roughness: 0.6 }), 0, y - 0.01, z + 0.04, 0.055, 0.13, Math.PI / 2);
    return;
  }
  if (mouth === 'smile' || mouth === 'tongue') {
    torus(g, INK, 0, y, z, 0.055, 0.012, 0, 0, Math.PI, Math.PI);
    if (mouth === 'tongue') sphere(g, PINK, 0, y - 0.035, z + 0.01, 0.035, 1.2, 0.7, 0.35);
    return;
  }
  if (mouth === 'frown') {
    torus(g, INK, 0, y - 0.015, z, 0.05, 0.012, 0, 0, 0, Math.PI);
    return;
  }
  if (mouth === 'grin') {
    sphere(g, INK, 0, y, z, 0.075, 1, 0.5, 0.25);
    box(g, CREAM, 0, y + 0.008, z + 0.024, 0.085, 0.018, 0.012);
    return;
  }
  if (mouth === 'open') {
    sphere(g, INK, 0, y - 0.005, z, 0.055, 1, 0.9, 0.3);
    sphere(g, PINK, 0, y - 0.03, z + 0.01, 0.035, 1, 0.5, 0.3);
    return;
  }
  if (mouth === 'stitch') {
    box(g, INK, 0, y, z, 0.1, 0.014, 0.014);
    [-0.035, 0, 0.035].forEach((dx) => {
      box(g, INK, dx, y, z + 0.004, 0.012, 0.042, 0.01);
    });
    return;
  }
  if (mouth === 'fang') {
    sphere(g, INK, 0, y, z, 0.06, 1.1, 0.5, 0.25);
    cone(g, CREAM, -0.03, y - 0.025, z + 0.015, 0.018, 0.06, Math.PI);
    cone(g, CREAM, 0.03, y - 0.025, z + 0.015, 0.018, 0.06, Math.PI);
    return;
  }
  if (mouth === 'wavy') {
    [-0.04, 0, 0.04].forEach((dx, i) => {
      box(g, INK, dx, y + (i % 2 ? 0.012 : -0.006), z, 0.05, 0.012, 0.012);
    });
  }
}

function addFace(model, entry) {
  const g = model.group;
  const gap = model.eyeGap;
  const y = model.faceY;
  const z = model.faceZ + 0.01;
  const style = entry.eyes;
  const large = style === 'big' || style === 'sparkle';
  const baseSize = large ? 0.062 : 0.048;

  if (style === 'single') {
    addEye(g, 0, y, z, 0.1, 'big', entry.accent);
  } else if (style === 'many') {
    addEye(g, -gap, y, z, 0.045, 'big', entry.accent);
    addEye(g, gap, y, z, 0.045, 'big', entry.accent);
    [
      [-gap * 1.6, y + 0.075, 0.026],
      [gap * 1.6, y + 0.075, 0.026],
      [-gap * 1.45, y - 0.06, 0.024],
      [gap * 1.45, y - 0.06, 0.024],
    ].forEach(([x, ey, size]) => addEye(g, x, ey, z, size, 'big', entry.accent));
  } else if (style === 'mismatched') {
    addEye(g, -gap, y, z, baseSize * 1.3, 'big', entry.accent);
    addEye(g, gap, y, z, baseSize * 0.82, 'dot', entry.accent);
  } else {
    addEye(g, -gap, y, z, baseSize, style, entry.accent);
    addEye(g, gap, y, z, baseSize, style, entry.accent);
  }

  if (style === 'angry') {
    [-1, 1].forEach((side) => {
      const brow = box(g, INK, side * gap, y + 0.075, z, gap * 1.25, 0.022, 0.02);
      brow.rotation.z = side * 0.4;
    });
  }

  addMouth(model, entry);
}

function addHat(model, entry) {
  const hat = entry.hat;
  if (!hat || hat === 'none') return;
  const g = model.group;
  const s = Math.min(0.25, model.headR * 1.05);
  const y = model.hatY;
  const accent = plushieMaterial(entry.accent);

  if (hat === 'cap') {
    mesh(g, halfSphereGeo(s * 0.95), accent, 0, y, 0);
    box(g, accent, 0, y + 0.015, s * 0.62, s * 1.9, 0.035, s * 0.8);
  } else if (hat === 'beanie') {
    mesh(g, halfSphereGeo(s), accent, 0, y - 0.01, 0);
    cylinder(g, accent, 0, y + 0.005, 0, s * 1.01, s * 1.01, s * 0.16);
    sphere(g, CREAM, 0, y + s * 0.88, 0, s * 0.22);
  } else if (hat === 'topHat') {
    cylinder(g, accent, 0, y + s * 0.52, 0, s * 0.7, s * 0.78, s * 1.1);
    cylinder(g, accent, 0, y + 0.02, 0, s * 1.3, s * 1.3, 0.035);
    cylinder(g, GOLD, 0, y + s * 0.22, 0, s * 0.79, s * 0.79, 0.035);
  } else if (hat === 'jester') {
    mesh(g, halfSphereGeo(s * 0.9), accent, 0, y, 0);
    [-1, 0, 1].forEach((dir) => {
      const spike = cone(g, accent, dir * s * 0.55, y + s * 0.55, 0, s * 0.28, s * 0.85, 0, 0, dir * 0.55);
      spike.position.x += dir * s * 0.18;
      sphere(g, GOLD, dir * s * 0.82, y + s * 0.92, 0, s * 0.11);
    });
  } else if (hat === 'crown') {
    cylinder(g, GOLD, 0, y + 0.055, 0, s * 0.9, s * 0.9, 0.12, 0, 0, 0);
    [-1, 0, 1].forEach((dir) => {
      cone(g, GOLD, dir * s * 0.55, y + s * 0.2, 0, s * 0.16, s * 0.4);
      sphere(g, PINK, dir * s * 0.55, y + s * 0.38, 0, s * 0.06);
    });
  } else if (hat === 'bow') {
    sphere(g, accent, -s * 0.42, y + 0.03, 0.02, s * 0.35, 1.3, 0.7, 0.32);
    sphere(g, accent, s * 0.42, y + 0.03, 0.02, s * 0.35, 1.3, 0.7, 0.32);
    sphere(g, GOLD, 0, y + 0.03, 0.03, s * 0.14);
  } else if (hat === 'headphones') {
    torus(g, accent, 0, y - s * 0.38, 0, s * 1.02, 0.028, 0, 0, 0, Math.PI);
    cylinder(g, accent, -s * 1.02, y - s * 0.4, 0, s * 0.28, s * 0.28, s * 0.16, 0, 0, Math.PI / 2);
    cylinder(g, accent, s * 1.02, y - s * 0.4, 0, s * 0.28, s * 0.28, s * 0.16, 0, 0, Math.PI / 2);
    sphere(g, CREAM, -s * 1.1, y - s * 0.4, 0, s * 0.12);
    sphere(g, CREAM, s * 1.1, y - s * 0.4, 0, s * 0.12);
  } else if (hat === 'chef') {
    cylinder(g, CREAM, 0, y + s * 0.22, 0, s * 0.75, s * 0.85, s * 0.42);
    sphere(g, CREAM, -s * 0.4, y + s * 0.55, 0, s * 0.38);
    sphere(g, CREAM, s * 0.4, y + s * 0.55, 0, s * 0.38);
    sphere(g, CREAM, 0, y + s * 0.7, 0, s * 0.42);
  } else if (hat === 'horns') {
    cone(g, accent, -s * 0.5, y + s * 0.14, 0, s * 0.18, s * 0.5, 0, 0, -0.35);
    cone(g, accent, s * 0.5, y + s * 0.14, 0, s * 0.18, s * 0.5, 0, 0, 0.35);
  } else if (hat === 'antenna') {
    cylinder(g, GOLD, 0, y + s * 0.42, 0, 0.012, 0.012, s * 0.75);
    sphere(g, accent, 0, y + s * 0.86, 0, s * 0.16);
  } else if (hat === 'halo') {
    torus(g, GOLD, 0, y + s * 0.72, 0, s * 0.72, 0.025, Math.PI / 2);
  } else if (hat === 'wizard') {
    cone(g, accent, 0, y + s * 0.7, 0, s * 0.8, s * 1.35);
    cylinder(g, accent, 0, y + 0.01, 0, s * 1.25, s * 1.25, 0.035);
    cylinder(g, GOLD, 0, y + 0.1, 0, s * 0.82, s * 0.82, 0.03);
  } else if (hat === 'usher') {
    cylinder(g, accent, 0, y + s * 0.12, 0, s * 0.62, s * 0.66, s * 0.28);
    cylinder(g, GOLD, 0, y + s * 0.03, 0, s * 0.66, s * 0.66, 0.035);
  } else if (hat === 'flower') {
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      sphere(g, accent, Math.cos(angle) * s * 0.34, y + s * 0.15 + Math.sin(angle) * s * 0.34, 0.02, s * 0.2, 1, 1, 0.4);
    }
    sphere(g, GOLD, 0, y + s * 0.15, 0.05, s * 0.17);
  } else if (hat === 'propeller') {
    mesh(g, halfSphereGeo(s * 0.85), accent, 0, y, 0);
    cylinder(g, GOLD, 0, y + s * 0.3, 0, 0.012, 0.012, s * 0.4);
    const blade = box(g, accent, 0, y + s * 0.6, 0, s * 1.2, 0.03, s * 0.22);
    blade.rotation.y = 0.5;
    const blade2 = box(g, accent, 0, y + s * 0.6, 0, s * 0.22, 0.03, s * 1.2);
    blade2.rotation.y = 0.5;
  } else if (hat === 'bandana') {
    torus(g, accent, 0, y - s * 0.72, 0, s * 1.02, 0.035, Math.PI / 2);
    const knot = box(g, accent, s * 0.55, y - s * 0.8, -s * 0.8, s * 0.22, s * 0.16, s * 0.22);
    knot.rotation.z = 0.4;
    box(g, accent, s * 0.72, y - s * 0.98, -s * 0.8, s * 0.12, s * 0.28, 0.04);
  }
}

export function buildPlushie(entry) {
  const fur = plushieMaterial(entry.fur);
  const accent = plushieMaterial(entry.accent);
  const builder = BASES[entry.base] || bearBase;
  const model = builder(fur, accent);

  addPattern(model, entry, accent);
  addFace(model, entry);
  addHat(model, entry);

  let shadowCasters = 0;
  model.group.traverse((child) => {
    if (child.isMesh) {
      // Keep the silhouette shadow but skip tiny eye/accessory casters.
      child.castShadow = shadowCasters < 4;
      child.receiveShadow = true;
      if (shadowCasters < 4) shadowCasters += 1;
    }
  });

  const bounds = new THREE.Box3().setFromObject(model.group);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  model.group.position.y -= bounds.min.y;

  const scale = Math.min(1, 1.28 / Math.max(0.1, size.y), 0.84 / Math.max(0.1, size.x), 0.84 / Math.max(0.1, size.z));
  const root = new THREE.Group();
  root.name = entry.id;
  root.add(model.group);
  root.scale.setScalar(scale);
  root.userData = {
    catalogId: entry.id,
    entry,
    family: entry.family,
    rarity: entry.rarity,
    height: size.y * scale,
    radius: Math.max(size.x, size.z) * scale * 0.38,
  };
  return root;
}

export { PLUSHIES, FAMILY_ICONS } from './catalog.js';
