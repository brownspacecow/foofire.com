import * as THREE from 'three';

// Every ornament is built from a handful of cached low-poly primitives, so the
// whole 180-piece catalogue costs only a few shared geometries and materials.

const UNIT_SPHERE = new THREE.SphereGeometry(1, 14, 10);
const GEO = new Map();
const MATS = new Map();

function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!MATS.has(key)) {
    MATS.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.12,
        ...options,
      })
    );
  }
  return MATS.get(key);
}

const INK = mat('#241a2e', { roughness: 0.5 });
const CREAM = mat('#fff8e7', { roughness: 0.6 });
const GOLD = mat('#ffd93d', { roughness: 0.35, metalness: 0.55 });
const SNOW = mat('#f4faff', { roughness: 0.7 });
const WOOD = mat('#8b5a3c', { roughness: 0.8 });
const GREEN = mat('#2f7d32', { roughness: 0.7 });
const GLASS = mat('#cfeeff', {
  roughness: 0.08,
  metalness: 0.1,
  transparent: true,
  opacity: 0.4,
});
const FLAME = mat('#ffb703', {
  roughness: 0.3,
  emissive: '#ff8a00',
  emissiveIntensity: 1.1,
});
const GLOW = mat('#fff3b0', {
  roughness: 0.3,
  emissive: '#ffd93d',
  emissiveIntensity: 0.9,
});

function cachedGeo(key, make) {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
}

function boxGeo(w, h, d) {
  return cachedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function cylGeo(top, bottom, height, segments = 12) {
  return cachedGeo(
    `cyl:${top}:${bottom}:${height}:${segments}`,
    () => new THREE.CylinderGeometry(top, bottom, height, segments)
  );
}
function coneGeo(radius, height, segments = 12) {
  return cachedGeo(`cone:${radius}:${height}:${segments}`, () => new THREE.ConeGeometry(radius, height, segments));
}
function torusGeo(radius, tube, arc = Math.PI * 2) {
  return cachedGeo(`torus:${radius}:${tube}:${arc}`, () => new THREE.TorusGeometry(radius, tube, 6, 20, arc));
}
function capsuleGeo(radius, length) {
  return cachedGeo(`capsule:${radius}:${length}`, () => new THREE.CapsuleGeometry(radius, length, 4, 8));
}
function dodecaGeo(radius) {
  return cachedGeo(`dodeca:${radius}`, () => new THREE.DodecahedronGeometry(radius, 0));
}
function icosaGeo(radius) {
  return cachedGeo(`icosa:${radius}`, () => new THREE.IcosahedronGeometry(radius, 0));
}

function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function sphere(parent, material, x, y, z, radius, sx = 1, sy = 1, sz = 1) {
  const m = mesh(parent, UNIT_SPHERE, material, x, y, z);
  m.scale.set(radius * sx, radius * sy, radius * sz);
  return m;
}

function box(parent, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const m = mesh(parent, boxGeo(w, h, d), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cylinder(parent, material, x, y, z, top, bottom, height, rx = 0, ry = 0, rz = 0, segments = 12) {
  const m = mesh(parent, cylGeo(top, bottom, height, segments), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cone(parent, material, x, y, z, radius, height, rx = 0, ry = 0, rz = 0, segments = 12) {
  const m = mesh(parent, coneGeo(radius, height, segments), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function torus(parent, material, x, y, z, radius, tube, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) {
  const m = mesh(parent, torusGeo(radius, tube, arc), material, x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function capsule(parent, material, x, y, z, radius, length, rz = 0, ry = 0) {
  const m = mesh(parent, capsuleGeo(radius, length), material, x, y, z);
  m.rotation.set(0, ry, rz);
  return m;
}

// ----------------------------------------------------------- flat shapes
function starGeo() {
  return cachedGeo('star-shape', () => {
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
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.center();
    return geo;
  });
}

function heartGeo() {
  return cachedGeo('heart-shape', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    shape.bezierCurveTo(-1.45, 0.15, -0.75, 1.15, 0, 0.45);
    shape.bezierCurveTo(0.75, 1.15, 1.45, 0.15, 0, -1);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.center();
    return geo;
  });
}

function leafGeo() {
  return cachedGeo('leaf-shape', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    shape.quadraticCurveTo(1, -0.25, 0, 1);
    shape.quadraticCurveTo(-1, -0.25, 0, -1);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.center();
    return geo;
  });
}

function crescentGeo() {
  return cachedGeo('crescent-shape', () => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1, Math.PI * 0.28, Math.PI * 1.72, false);
    const hole = new THREE.Path();
    hole.absarc(0.42, 0.06, 0.82, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.center();
    return geo;
  });
}

function ovalGeo() {
  return cachedGeo('oval-shape', () => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, 0.55, 1, 0, Math.PI * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.center();
    return geo;
  });
}

function coffinGeo() {
  return cachedGeo('coffin-shape', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.55, 1);
    shape.lineTo(0.55, 1);
    shape.lineTo(0.72, 0.1);
    shape.lineTo(0.45, -1);
    shape.lineTo(-0.45, -1);
    shape.lineTo(-0.72, 0.1);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 2,
    });
    geo.center();
    return geo;
  });
}

// -------------------------------------------------------------- builders
function bauble(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0, 0, 0.15);
  sphere(g, CREAM, -0.05, 0.06, 0.12, 0.026, 1, 1, 0.6);
  cylinder(g, a, 0, 0.158, 0, 0.043, 0.05, 0.045);
  torus(g, GOLD, 0, 0.195, 0, 0.03, 0.009);
  g.userData.patternRadius = 0.152;
  return g;
}

function star(entry, c, a) {
  const g = new THREE.Group();
  const main = mesh(g, starGeo(), c);
  main.scale.setScalar(0.17);
  const centre = mesh(g, starGeo(), a);
  centre.scale.setScalar(0.065);
  centre.position.z = 0.04;
  return g;
}

function davidStar(entry, c, a) {
  const g = new THREE.Group();
  const one = mesh(g, starGeo(), c);
  one.scale.setScalar(0.16);
  one.rotation.z = Math.PI;
  const two = mesh(g, starGeo(), a);
  two.scale.setScalar(0.1);
  two.position.z = 0.045;
  const point = mesh(g, starGeo(), c);
  point.scale.setScalar(0.16);
  point.position.z = -0.02;
  point.rotation.z = Math.PI;
  return g;
}

function candyCane(entry, c, a) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.17, 0),
    new THREE.Vector3(0, -0.05, 0),
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(0.01, 0.15, 0),
    new THREE.Vector3(0.06, 0.185, 0),
    new THREE.Vector3(0.11, 0.15, 0),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.026, 8, false), c);
  g.add(tube);
  [-0.14, -0.09, -0.04, 0.01, 0.06, 0.1].forEach((y, index) => {
    cylinder(g, a, Math.sin(index) * 0.002, y, 0, 0.028, 0.028, 0.016);
  });
  g.userData.noPattern = true;
  return g;
}

function snowflake(entry, c, a) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI;
    const arm = box(g, c, 0, 0, 0, 0.3, 0.016, 0.016);
    arm.rotation.z = angle;
    [-0.09, 0.09].forEach((offset) => {
      const branch = box(g, a, 0, 0, 0, 0.075, 0.012, 0.012);
      branch.position.set(Math.cos(angle + Math.PI / 2) * offset, Math.sin(angle + Math.PI / 2) * offset, 0);
      branch.rotation.z = angle + Math.PI / 3;
    });
  }
  sphere(g, a, 0, 0, 0, 0.028);
  g.userData.noPattern = true;
  return g;
}

function holly(entry, c, a) {
  const g = new THREE.Group();
  const leaf = (x, y, rz) => {
    const m = sphere(g, c, x, y, 0, 0.075, 1.45, 0.62, 0.22);
    m.rotation.z = rz;
  };
  leaf(-0.07, -0.02, 0.5);
  leaf(0.07, -0.02, -0.5);
  leaf(0, 0.07, 0);
  [-0.06, 0, 0.06].forEach((x, index) => {
    sphere(g, a, x, -0.055 + (index === 1 ? -0.02 : 0), 0.045, 0.028);
  });
  g.userData.noPattern = true;
  return g;
}

function gingerbread(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.04, 0, 0.08, 1, 1.05, 0.35);
  sphere(g, c, 0, 0.145, 0, 0.062, 1, 1, 0.4);
  capsule(g, c, -0.075, 0.06, 0, 0.022, 0.06, 0.9);
  capsule(g, c, 0.075, 0.06, 0, 0.022, 0.06, -0.9);
  capsule(g, c, -0.035, -0.06, 0, 0.022, 0.07, 0.2);
  capsule(g, c, 0.035, -0.06, 0, 0.022, 0.07, -0.2);
  [-0.025, 0.025].forEach((x) => sphere(g, INK, x, 0.15, 0.024, 0.009, 1, 1.2, 0.6));
  box(g, a, 0, 0.115, 0.026, 0.06, 0.012, 0.012);
  box(g, a, 0, 0.075, 0.026, 0.035, 0.012, 0.012);
  box(g, a, 0, 0.04, 0.026, 0.06, 0.01, 0.012);
  g.userData.noPattern = true;
  return g;
}

function bell(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.01, 0, 0.085, 0.14, 0.21);
  torus(g, a, 0, -0.115, 0, 0.14, 0.017, Math.PI / 2);
  sphere(g, INK, 0, -0.13, 0, 0.035);
  torus(g, c, 0, 0.11, 0, 0.035, 0.014);
  sphere(g, a, 0, 0.045, 0.1, 0.025, 1, 1, 0.5);
  g.userData.patternRadius = 0.12;
  return g;
}

function stocking(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, 0.04, 0, 0.13, 0.18, 0.07);
  const foot = capsule(g, c, 0.025, -0.1, 0, 0.052, 0.13, Math.PI / 2);
  foot.rotation.y = 0;
  sphere(g, c, 0.095, -0.13, 0, 0.055, 1, 1, 0.9);
  box(g, a, 0, 0.135, 0, 0.145, 0.05, 0.08);
  torus(g, GOLD, 0, 0.18, 0, 0.025, 0.008);
  g.userData.patternRadius = 0.09;
  g.userData.patternY = -0.05;
  return g;
}

function wreath(entry, c, a) {
  const g = new THREE.Group();
  torus(g, c, 0, 0, 0, 0.125, 0.045);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    sphere(g, a, Math.cos(angle) * 0.125, Math.sin(angle) * 0.125, 0.04, 0.02);
  }
  sphere(g, a, -0.035, -0.13, 0.05, 0.04, 1.5, 0.65, 0.4);
  sphere(g, a, 0.035, -0.13, 0.05, 0.04, 1.5, 0.65, 0.4);
  g.userData.noPattern = true;
  return g;
}

function snowGlobe(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, WOOD, 0, -0.13, 0, 0.115, 0.13, 0.06);
  torus(g, GOLD, 0, -0.1, 0, 0.115, 0.012, Math.PI / 2);
  sphere(g, GLASS, 0, 0.03, 0, 0.132);
  sphere(g, SNOW, 0, -0.03, 0, 0.085, 1, 0.75, 1);
  sphere(g, SNOW, 0, 0.045, 0, 0.055);
  sphere(g, SNOW, 0, 0.09, 0, 0.04);
  cone(g, INK, 0, 0.115, 0, 0.035, 0.025);
  sphere(g, a, 0, 0.02, 0.1, 0.012);
  sphere(g, SNOW, 0.06, 0.09, 0.04, 0.01);
  sphere(g, SNOW, -0.07, 0.05, 0.02, 0.008);
  g.userData.noPattern = true;
  return g;
}

function train(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0.01, 0, 0, 0.21, 0.1, 0.11);
  box(g, c, -0.065, 0.075, 0, 0.085, 0.09, 0.105);
  box(g, a, -0.065, 0.09, 0.054, 0.055, 0.04, 0.008);
  cylinder(g, a, 0.07, 0.095, 0, 0.026, 0.036, 0.075);
  cylinder(g, GOLD, 0.07, 0.14, 0, 0.038, 0.038, 0.014);
  [-0.055, 0.025, 0.085].forEach((x) => {
    cylinder(g, INK, x, -0.075, 0.04, 0.034, 0.034, 0.026, Math.PI / 2);
    cylinder(g, INK, x, -0.075, -0.04, 0.034, 0.034, 0.026, Math.PI / 2);
  });
  cone(g, a, -0.115, -0.025, 0, 0.045, 0.08, 0, 0, Math.PI / 2);
  g.userData.noPattern = true;
  return g;
}

function rocket(entry, c, a) {
  const g = new THREE.Group();
  const isFirecracker = entry.shape === 'firecracker';
  cylinder(g, c, 0, 0, 0, 0.06, 0.075, 0.2);
  cone(g, c, 0, 0.15, 0, 0.06, 0.1);
  if (!isFirecracker) {
    sphere(g, CREAM, 0, 0.04, 0.06, 0.03, 1, 1, 0.4);
    torus(g, a, 0, 0.04, 0.062, 0.031, 0.008);
  }
  [0, 1, 2].forEach((index) => {
    const fin = box(g, a, Math.cos(index * 2.1) * 0.07, -0.075, Math.sin(index * 2.1) * 0.07, 0.035, 0.09, 0.02);
    fin.rotation.y = index * 2.1;
  });
  if (isFirecracker) {
    box(g, a, 0, 0.02, 0.075, 0.05, 0.08, 0.006);
    torus(g, GOLD, 0, 0.18, 0, 0.025, 0.006);
    g.userData.noPattern = true;
  } else {
    cone(g, FLAME, 0, -0.15, 0, 0.045, 0.12, Math.PI);
    g.userData.patternRadius = 0.07;
  }
  return g;
}

function pumpkin(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, -0.01, 0, 0.15, 1.12, 0.82, 1.05);
  [-0.085, 0, 0.085].forEach((x) => {
    const ridge = torus(g, c, x, -0.01, 0, 0.11, 0.012, 0, Math.PI / 2, 0, Math.PI);
    ridge.scale.set(0.8, 1, 1);
  });
  cylinder(g, GREEN, 0, 0.115, 0, 0.018, 0.026, 0.06);
  box(g, GREEN, 0.04, 0.125, 0, 0.07, 0.012, 0.035, 0, 0, 0.35);
  g.userData.patternRadius = 0.15;
  g.userData.patternY = -0.01;
  return g;
}

function candyCorn(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.09, 0, 0.105, 0.1, 0.09);
  cylinder(g, a, 0, 0, 0, 0.075, 0.105, 0.09);
  cone(g, CREAM, 0, 0.095, 0, 0.075, 0.12);
  g.userData.noPattern = true;
  return g;
}

function bat(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.01, 0, 0.075, 1, 1.1, 0.9);
  sphere(g, c, 0, 0.085, 0, 0.058);
  const wing = (side) => {
    const m = sphere(g, c, side * 0.12, 0.035, -0.01, 0.1, 1.5, 0.9, 0.18);
    m.rotation.z = side * -0.45;
    return m;
  };
  wing(-1);
  wing(1);
  cone(g, c, -0.04, 0.14, 0, 0.02, 0.05, 0, 0, 0.2);
  cone(g, c, 0.04, 0.14, 0, 0.02, 0.05, 0, 0, -0.2);
  sphere(g, a, -0.022, 0.09, 0.05, 0.011);
  sphere(g, a, 0.022, 0.09, 0.05, 0.011);
  g.userData.noPattern = true;
  return g;
}

function ghost(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.03, 0, 0.13, 1, 1.1, 0.9);
  [-0.075, 0, 0.075].forEach((x, index) => {
    sphere(g, c, x, -0.095 - (index % 2) * 0.02, 0, 0.05, 1, 0.9, 0.9);
  });
  sphere(g, c, -0.12, 0.02, 0, 0.04, 0.8, 1.2, 0.7);
  sphere(g, c, 0.12, 0.02, 0, 0.04, 0.8, 1.2, 0.7);
  sphere(g, INK, -0.04, 0.06, 0.105, 0.017, 1, 1.4, 0.6);
  sphere(g, INK, 0.04, 0.06, 0.105, 0.017, 1, 1.4, 0.6);
  sphere(g, a, 0, 0.01, 0.112, 0.022, 1.4, 0.7, 0.4);
  g.userData.noPattern = true;
  return g;
}

function hat(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  if (shape === 'witchhat') {
    cylinder(g, c, 0, -0.09, 0, 0.16, 0.17, 0.018);
    cone(g, c, 0, 0.05, 0, 0.115, 0.26);
    torus(g, a, 0, -0.03, 0, 0.105, 0.014, Math.PI / 2);
    box(g, GOLD, 0, -0.03, 0.105, 0.05, 0.05, 0.012);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'partyhat' || shape === 'noisemaker') {
    cone(g, c, 0, 0.02, 0, 0.1, 0.25);
    cylinder(g, a, 0, 0.02, 0, 0.104, 0.1, 0.03);
    cylinder(g, a, 0, 0.1, 0, 0.064, 0.068, 0.022);
    sphere(g, a, 0, 0.16, 0, 0.035);
    if (shape === 'noisemaker') {
      cylinder(g, WOOD, 0, -0.11, 0, 0.015, 0.015, 0.1, 0, 0, 0.4);
      cone(g, a, 0.03, -0.18, 0, 0.03, 0.06, 0, 0, Math.PI);
      g.userData.noPattern = true;
      return g;
    }
    g.userData.patternRadius = 0.09;
    return g;
  }

  if (shape === 'jester') {
    const spike = (x, rz, colorMat) => {
      cone(g, colorMat, x, 0.08, 0, 0.055, 0.2, 0, 0, rz);
      sphere(g, GOLD, x + Math.sin(rz) * 0.11, 0.17 + Math.cos(rz) * 0.03, 0, 0.024);
    };
    cylinder(g, c, 0, -0.05, 0, 0.1, 0.105, 0.06);
    spike(-0.07, 0.55, a);
    spike(0.07, -0.55, c);
    spike(0, 0, c);
    torus(g, GOLD, 0, -0.07, 0, 0.1, 0.012, Math.PI / 2);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'crown') {
    cylinder(g, c, 0, -0.04, 0, 0.115, 0.105, 0.1);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      const x = Math.cos(angle) * 0.1;
      const z = Math.sin(angle) * 0.1;
      cone(g, c, x, 0.06, z, 0.033, 0.1);
      sphere(g, a, x, 0.11, z, 0.018);
    }
    torus(g, a, 0, -0.07, 0, 0.11, 0.013, Math.PI / 2);
    sphere(g, a, 0, -0.02, 0.105, 0.022);
    g.userData.noPattern = true;
    return g;
  }

  // Top hat.
  cylinder(g, c, 0, -0.09, 0, 0.155, 0.16, 0.02);
  cylinder(g, c, 0, 0.02, 0, 0.095, 0.1, 0.18);
  cylinder(g, a, 0, -0.06, 0, 0.102, 0.102, 0.04);
  if (entry.shape === 'tophat' && entry.pattern === 'stars') {
    sphere(g, GOLD, 0, 0.02, 0.1, 0.02);
  }
  g.userData.noPattern = true;
  return g;
}

function spider(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, -0.01, 0, 0.09, 1, 1.05, 0.9);
  sphere(g, c, 0, 0.07, 0.01, 0.055);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i += 1) {
      const angle = (i - 1.5) * 0.42;
      const leg = capsule(g, c, side * 0.11, 0.01 + i * 0.012, 0, 0.012, 0.13, side * (1.1 + angle));
      leg.position.y -= 0.04;
    }
  }
  sphere(g, a, -0.022, 0.085, 0.045, 0.012);
  sphere(g, a, 0.022, 0.085, 0.045, 0.012);
  sphere(g, a, -0.038, 0.06, 0.04, 0.008);
  sphere(g, a, 0.038, 0.06, 0.04, 0.008);
  g.userData.noPattern = true;
  return g;
}

function cauldron(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.03, 0, 0.145, 0.1, 0.16);
  torus(g, c, 0, 0.045, 0, 0.145, 0.018, Math.PI / 2);
  torus(g, c, -0.11, 0.02, 0, 0.055, 0.014, 0, 0, 1.2, Math.PI);
  torus(g, c, 0.11, 0.02, 0, 0.055, 0.014, 0, 0, -1.2, Math.PI);
  sphere(g, a, -0.05, 0.06, 0.02, 0.03);
  sphere(g, a, 0.04, 0.07, -0.02, 0.022);
  sphere(g, a, 0, 0.09, 0.04, 0.018);
  g.userData.noPattern = true;
  return g;
}

function house(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, -0.035, 0, 0.17, 0.14, 0.13);
  cone(g, a, 0, 0.07, 0, 0.16, 0.11, 0, Math.PI / 4, 0, 4);
  box(g, INK, 0, -0.065, 0.066, 0.045, 0.08, 0.01);
  box(g, GLOW, -0.045, -0.015, 0.066, 0.03, 0.03, 0.008);
  box(g, GLOW, 0.045, -0.015, 0.066, 0.03, 0.03, 0.008);
  box(g, SNOW, 0, 0.115, 0, 0.1, 0.018, 0.05);
  g.userData.noPattern = true;
  return g;
}

function egg(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0, 0, 0.13, 0.9, 1.28, 0.9);
  torus(g, a, 0, 0.02, 0, 0.115, 0.008, 0, 0, Math.PI / 4);
  g.userData.patternRadius = 0.13;
  return g;
}

function animal(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  if (shape === 'bunny') {
    sphere(g, c, 0, -0.02, 0, 0.1, 1, 1.05, 0.95);
    sphere(g, c, 0, 0.08, 0.01, 0.075);
    capsule(g, c, -0.032, 0.19, 0, 0.022, 0.1, -0.12);
    capsule(g, c, 0.032, 0.19, 0, 0.022, 0.1, 0.12);
    capsule(g, a, -0.032, 0.19, 0.018, 0.011, 0.075, -0.12);
    capsule(g, a, 0.032, 0.19, 0.018, 0.011, 0.075, 0.12);
    sphere(g, CREAM, 0, -0.09, 0.05, 0.035);
    return finishAnimal(g, 0.08, 0.077, 0.03, a);
  }

  if (shape === 'chick') {
    sphere(g, c, 0, -0.03, 0, 0.1, 1, 1, 0.95);
    sphere(g, c, 0, 0.075, 0.01, 0.07);
    cone(g, a, 0, 0.065, 0.078, 0.022, 0.045, Math.PI / 2);
    sphere(g, c, -0.085, -0.02, 0.01, 0.045, 0.55, 0.9, 0.7);
    sphere(g, c, 0.085, -0.02, 0.01, 0.045, 0.55, 0.9, 0.7);
    cone(g, c, 0, 0.15, 0, 0.018, 0.045, 0, 0, 0.3);
    return finishAnimal(g, 0.075, 0.07, 0.028, a);
  }

  if (shape === 'birds') {
    const pair = new THREE.Group();
    pair.position.y = 0.015;
    g.add(pair);
    [-0.06, 0.06].forEach((x) => {
      sphere(pair, c, x, 0, 0, 0.06, 1, 1, 0.95);
      sphere(pair, c, x, 0.055, 0.01, 0.042);
      cone(pair, a, x, 0.045, 0.05, 0.015, 0.03, Math.PI / 2);
      sphere(pair, c, x - 0.05, 0, 0, 0.028, 0.5, 0.8, 0.6);
      sphere(pair, c, x + 0.05, 0, 0, 0.028, 0.5, 0.8, 0.6);
    });
    sphere(g, a, 0, 0.13, 0, 0.03, 1.3, 0.8, 0.3);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'lamb') {
    [[0, 0, 0.09], [-0.06, 0.04, 0.06], [0.06, 0.04, 0.06], [-0.05, -0.06, 0.06], [0.05, -0.06, 0.06], [0, 0.09, 0.06]].forEach(
      ([x, y, r]) => sphere(g, c, x, y, 0, r)
    );
    sphere(g, a, 0, 0.13, 0.04, 0.055);
    sphere(g, a, -0.05, 0.14, 0.04, 0.022, 1.4, 0.8, 0.6);
    sphere(g, a, 0.05, 0.14, 0.04, 0.022, 1.4, 0.8, 0.6);
    sphere(g, INK, -0.018, 0.14, 0.09, 0.008);
    sphere(g, INK, 0.018, 0.14, 0.09, 0.008);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'turkey') {
    for (let i = 0; i < 5; i += 1) {
      const angle = (i - 2) * 0.4;
      const feather = sphere(g, a, Math.sin(angle) * 0.1, 0.05 + Math.cos(angle) * 0.08, -0.03, 0.075, 0.6, 1.25, 0.2);
      feather.rotation.z = -angle;
    }
    sphere(g, c, 0, -0.04, 0, 0.1, 1, 1.1, 0.95);
    sphere(g, c, 0, 0.08, 0.03, 0.055);
    cone(g, GOLD, 0, 0.075, 0.085, 0.018, 0.035, Math.PI / 2);
    sphere(g, a, 0, 0.045, 0.078, 0.018, 0.7, 1.2, 0.6);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'lion') {
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const petal = sphere(g, a, Math.cos(angle) * 0.11, Math.sin(angle) * 0.11 + 0.02, -0.01, 0.055, 1, 1, 0.6);
      petal.rotation.z = angle;
    }
    sphere(g, c, 0, 0.02, 0.015, 0.085);
    sphere(g, CREAM, 0, -0.01, 0.075, 0.035, 1.2, 0.8, 0.6);
    sphere(g, INK, -0.025, 0.045, 0.075, 0.009);
    sphere(g, INK, 0.025, 0.045, 0.075, 0.009);
    sphere(g, INK, 0, 0.015, 0.105, 0.012, 1.2, 0.7, 0.5);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'cat') {
    sphere(g, c, 0, -0.03, 0, 0.085, 1, 1.1, 0.9);
    sphere(g, c, 0, 0.07, 0.01, 0.065);
    cone(g, c, -0.04, 0.135, 0, 0.028, 0.06, 0, 0, 0.2);
    cone(g, c, 0.04, 0.135, 0, 0.028, 0.06, 0, 0, -0.2);
    capsule(g, c, 0.1, -0.01, -0.02, 0.018, 0.14, 1.2);
    sphere(g, a, -0.022, 0.075, 0.05, 0.011);
    sphere(g, a, 0.022, 0.075, 0.05, 0.011);
    sphere(g, a, 0, 0.05, 0.06, 0.008);
    return finishAnimal(g, 0.065, 0.075, 0.0, a);
  }

  // Bear.
  sphere(g, c, 0, -0.03, 0, 0.095, 1, 1.05, 0.9);
  sphere(g, c, 0, 0.07, 0.01, 0.07);
  sphere(g, c, -0.05, 0.125, 0, 0.026);
  sphere(g, c, 0.05, 0.125, 0, 0.026);
  sphere(g, a, -0.05, 0.125, 0.008, 0.014, 1, 1, 0.6);
  sphere(g, a, 0.05, 0.125, 0.008, 0.014, 1, 1, 0.6);
  sphere(g, CREAM, 0, 0.055, 0.055, 0.035, 1.15, 0.8, 0.6);
  sphere(g, INK, 0, 0.065, 0.085, 0.01, 1.3, 0.8, 0.6);
  return finishAnimal(g, 0.067, 0.07, 0.03, a);
}

function finishAnimal(g, eyeY, eyeZ, eyeGap, a) {
  sphere(g, INK, -eyeGap, eyeY, eyeZ, 0.01);
  sphere(g, INK, eyeGap, eyeY, eyeZ, 0.01);
  sphere(g, a, 0, eyeY - 0.028, eyeZ + 0.002, 0.008, 1.4, 0.7, 0.5);
  g.userData.noPattern = true;
  return g;
}

function flower(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;
  const petals = shape === 'lotus' ? 5 : 6;
  const petalY = shape === 'lotus' ? 0.09 : 0.05;
  cylinder(g, GREEN, 0, -0.1, 0, 0.011, 0.014, 0.18);
  const leaf = sphere(g, GREEN, -0.05, -0.07, 0, 0.04, 1.4, 0.6, 0.2);
  leaf.rotation.z = 0.4;
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2;
    const petal = sphere(
      g,
      c,
      Math.cos(angle) * 0.06,
      petalY + Math.sin(angle) * (shape === 'lotus' ? 0.035 : 0.06),
      shape === 'lotus' ? 0.02 : 0,
      0.05,
      1,
      shape === 'rose' ? 0.8 : 1.4,
      shape === 'rose' ? 1 : 0.5
    );
    petal.rotation.z = angle + Math.PI / 2;
    if (shape === 'lotus') petal.rotation.x = -0.5;
  }
  if (shape === 'rose') {
    sphere(g, c, 0, 0.055, 0.015, 0.045);
    sphere(g, a, 0, 0.055, 0.035, 0.025);
  } else {
    sphere(g, a, 0, petalY, 0.03, 0.035);
  }
  g.userData.noPattern = true;
  return g;
}

function carrot(entry, c, a) {
  const g = new THREE.Group();
  cone(g, c, 0, -0.02, 0, 0.065, 0.24, Math.PI);
  [-0.035, 0, 0.035].forEach((x, index) => {
    cone(g, a, x, 0.14, 0, 0.022, 0.1, 0, 0, (index - 1) * 0.35);
  });
  [-0.02, 0.03].forEach((x) => box(g, a, x, -0.02, 0.055, 0.02, 0.012, 0.01));
  g.userData.noPattern = true;
  return g;
}

function basket(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.04, 0, 0.125, 0.085, 0.14, 0, 0, 0, 14);
  torus(g, c, 0, 0.03, 0, 0.125, 0.014, Math.PI / 2);
  torus(g, WOOD, 0, 0.02, 0, 0.115, 0.012, Math.PI / 2, 0, 0, Math.PI);
  if (entry.shape === 'basket' && entry.holiday === 'thanksgiving') {
    sphere(g, a, -0.03, 0.06, 0.03, 0.04);
    sphere(g, a, 0.04, 0.055, 0.01, 0.035);
    sphere(g, c, 0, 0.09, 0, 0.03);
  } else {
    sphere(g, a, -0.04, 0.05, 0.02, 0.035);
    sphere(g, a, 0.035, 0.06, -0.01, 0.03);
    sphere(g, CREAM, 0.01, 0.085, 0.02, 0.025);
  }
  g.userData.noPattern = true;
  return g;
}

function tree(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, WOOD, 0, -0.13, 0, 0.02, 0.026, 0.06);
  cone(g, c, 0, -0.065, 0, 0.115, 0.14);
  cone(g, c, 0, 0.035, 0, 0.09, 0.12);
  cone(g, c, 0, 0.12, 0, 0.06, 0.1);
  mesh(g, starGeo(), a).scale.setScalar(0.035);
  g.children[g.children.length - 1].position.y = 0.19;
  g.userData.noPattern = true;
  return g;
}

function heart(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, heartGeo(), c);
  m.scale.setScalar(0.13);
  const shine = sphere(g, CREAM, -0.045, 0.03, 0.075, 0.022, 1.2, 1, 0.4);
  shine.rotation.z = 0.5;
  torus(g, a, 0, 0.15, 0, 0.022, 0.007);
  return g;
}

function arrow(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, WOOD, 0, 0, 0, 0.012, 0.012, 0.26, 0, 0, Math.PI / 2);
  cone(g, a, 0.16, 0, 0, 0.035, 0.07, 0, 0, -Math.PI / 2);
  box(g, a, -0.11, 0.02, 0, 0.055, 0.012, 0.02, 0, 0, 0.5);
  box(g, a, -0.11, -0.02, 0, 0.055, 0.012, 0.02, 0, 0, -0.5);
  box(g, c, -0.11, 0, 0, 0.055, 0.012, 0.02, 0, 0, 0.5);
  g.userData.noPattern = true;
  return g;
}

function envelope(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'scroll') {
    cylinder(g, c, 0, 0.02, 0, 0.055, 0.055, 0.17, 0, 0, Math.PI / 2, 12);
    cylinder(g, WOOD, -0.1, 0.02, 0, 0.014, 0.014, 0.19, 0, 0, Math.PI / 2);
    cylinder(g, WOOD, 0.1, 0.02, 0, 0.014, 0.014, 0.19, 0, 0, Math.PI / 2);
    box(g, a, 0, 0.02, 0.057, 0.03, 0.06, 0.006);
    g.userData.noPattern = true;
    return g;
  }
  if (entry.shape === 'papel') {
    box(g, WOOD, 0, 0.12, 0, 0.28, 0.012, 0.012);
    for (let i = 0; i < 5; i += 1) {
      const x = -0.1 + i * 0.05;
      box(g, i % 2 ? a : c, x, 0.02 + (i % 2) * 0.01, 0, 0.042, 0.14, 0.008);
      box(g, SNOW, x, 0.09, 0.002, 0.008, 0.02, 0.006);
    }
    g.userData.noPattern = true;
    return g;
  }
  box(g, c, 0, 0, 0, 0.19, 0.13, 0.02);
  const flap = cone(g, a, 0, 0.03, 0.012, 0.085, 0.09, Math.PI / 2, 0, 0, 4);
  flap.scale.z = 0.35;
  const seal = mesh(g, heartGeo(), GOLD);
  seal.scale.setScalar(0.03);
  seal.position.set(0, 0.02, 0.02);
  g.userData.noPattern = true;
  return g;
}

function cake(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  if (shape === 'pie') {
    cylinder(g, c, 0, -0.02, 0, 0.13, 0.11, 0.06);
    torus(g, a, 0, 0.01, 0, 0.12, 0.018, Math.PI / 2);
    [-0.06, 0, 0.06].forEach((x, index) => {
      const strip = box(g, a, x, 0.02, 0, 0.018, 0.012, 0.17);
      strip.rotation.y = 0.6;
      strip.rotation.z = index === 1 ? 0.2 : 0;
    });
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'donut') {
    torus(g, c, 0, 0, 0, 0.105, 0.05);
    torus(g, a, 0, 0.015, 0, 0.1, 0.032, Math.PI / 2);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      box(g, CREAM, Math.cos(angle) * 0.1, 0.048, Math.sin(angle) * 0.1, 0.018, 0.008, 0.006, 0, angle, 0);
    }
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'latke') {
    cylinder(g, c, 0, -0.01, 0, 0.12, 0.115, 0.055);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      sphere(g, a, Math.cos(angle) * 0.07, 0.025, Math.sin(angle) * 0.07, 0.018);
    }
    sphere(g, CREAM, 0, 0.04, 0, 0.035, 1.2, 0.7, 0.9);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'bread') {
    sphere(g, c, 0, -0.01, 0, 0.12, 1.15, 0.8, 1);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      sphere(g, a, Math.cos(angle) * 0.07, 0.05, Math.sin(angle) * 0.06, 0.022, 1.4, 0.5, 0.7);
    }
    sphere(g, CREAM, 0, 0.07, 0, 0.025);
    g.userData.noPattern = true;
    return g;
  }

  cylinder(g, c, 0, -0.055, 0, 0.115, 0.115, 0.08);
  cylinder(g, a, 0, 0.02, 0, 0.092, 0.092, 0.06);
  torus(g, CREAM, 0, 0.055, 0, 0.09, 0.016, Math.PI / 2);
  cylinder(g, c, 0, 0.09, 0, 0.022, 0.022, 0.08);
  cone(g, FLAME, 0, 0.15, 0, 0.016, 0.045);
  sphere(g, a, -0.05, 0.02, 0.075, 0.016);
  sphere(g, a, 0.05, 0.02, 0.075, 0.016);
  g.userData.noPattern = true;
  return g;
}

function acorn(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  if (shape === 'pinecone') {
    cone(g, WOOD, 0, 0.12, 0, 0.035, 0.1);
    for (let i = 0; i < 4; i += 1) {
      const y = -0.08 + i * 0.055;
      const radius = 0.1 - i * 0.018;
      for (let j = 0; j < 6; j += 1) {
        const angle = (j / 6) * Math.PI * 2 + i * 0.4;
        const scale = sphere(g, c, Math.cos(angle) * radius, y, Math.sin(angle) * radius, 0.035, 1, 0.7, 0.8);
        scale.rotation.z = 0.6;
      }
    }
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'stone') {
    mesh(g, dodecaGeo(0.14), c);
    sphere(g, a, -0.03, 0.04, 0.11, 0.015);
    sphere(g, a, 0.045, -0.02, 0.12, 0.012);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'dumpling') {
    sphere(g, c, 0, -0.01, 0, 0.13, 1.15, 0.72, 1);
    for (let i = 0; i < 5; i += 1) {
      const x = -0.08 + i * 0.04;
      box(g, a, x, 0.055, 0.03, 0.022, 0.03, 0.02, 0, 0, 0.25);
    }
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'orange') {
    sphere(g, c, 0, 0, 0, 0.13, 1, 0.95, 1);
    cylinder(g, WOOD, 0, 0.12, 0, 0.012, 0.016, 0.03);
    const leaf = mesh(g, leafGeo(), a);
    leaf.scale.setScalar(0.05);
    leaf.position.set(0.03, 0.14, 0);
    leaf.rotation.z = -0.6;
    g.userData.patternRadius = 0.13;
    return g;
  }

  sphere(g, c, 0, -0.02, 0, 0.115, 1.1, 0.95, 1.05);
  cylinder(g, WOOD, 0, 0.075, 0, 0.09, 0.115, 0.05);
  cylinder(g, WOOD, 0, 0.105, 0, 0.012, 0.016, 0.05);
  g.userData.noPattern = true;
  return g;
}

function mug(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  if (shape === 'glass') {
    cylinder(g, a, 0, -0.12, 0, 0.08, 0.09, 0.015);
    cylinder(g, CREAM, 0, -0.055, 0, 0.012, 0.012, 0.12);
    cylinder(g, GLASS, 0, 0.045, 0, 0.078, 0.045, 0.12);
    sphere(g, c, 0, 0.065, 0, 0.05, 1, 0.55, 1);
    sphere(g, CREAM, 0, 0.11, 0, 0.012);
    sphere(g, CREAM, 0.03, 0.12, 0, 0.009);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'oil') {
    sphere(g, c, 0, -0.03, 0, 0.11, 1, 1.1, 1);
    cylinder(g, c, 0, 0.08, 0, 0.035, 0.06, 0.07);
    cylinder(g, a, 0, 0.125, 0, 0.04, 0.04, 0.025);
    torus(g, c, 0.09, 0.01, 0, 0.045, 0.014, 0, 0, -0.4, Math.PI);
    g.userData.noPattern = true;
    return g;
  }

  if (shape === 'diya') {
    const bowl = sphere(g, c, 0, -0.04, 0, 0.12, 1.15, 0.55, 1.15);
    bowl.scale.y *= 0.7;
    torus(g, a, 0, 0.01, 0, 0.11, 0.012, Math.PI / 2);
    cone(g, FLAME, 0, 0.09, 0, 0.028, 0.09);
    sphere(g, GLOW, 0, 0.07, 0, 0.018, 1, 1.3, 1);
    g.userData.noPattern = true;
    return g;
  }

  cylinder(g, c, 0, -0.02, 0, 0.1, 0.09, 0.18);
  torus(g, a, 0, 0.06, 0, 0.1, 0.014, Math.PI / 2);
  torus(g, c, 0.1, 0.01, 0, 0.05, 0.016, 0, 0, 0, Math.PI * 1.3);
  sphere(g, a, 0, 0.075, 0, 0.06, 1, 0.4, 1);
  for (let i = 0; i < 3; i += 1) {
    sphere(g, CREAM, -0.03 + i * 0.02, 0.15 + i * 0.03, 0, 0.012, 1, 1.6, 1);
  }
  g.userData.noPattern = true;
  return g;
}

function moon(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, crescentGeo(), c);
  m.scale.setScalar(0.17);
  sphere(g, a, 0.08, 0.07, 0.03, 0.018);
  sphere(g, a, 0.1, -0.02, 0.03, 0.013);
  g.userData.noPattern = true;
  return g;
}

function dreidel(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, 0.01, 0, 0.13, 0.13, 0.13);
  cone(g, c, 0, -0.1, 0, 0.065, 0.1, Math.PI);
  cylinder(g, a, 0, 0.1, 0, 0.018, 0.018, 0.06);
  sphere(g, a, 0, 0.14, 0, 0.025);
  ['#ffd93d', '#fff8e7'].forEach((color, index) => {
    box(g, mat(color), -0.04 + index * 0.08, 0.015, 0.066, 0.025, 0.025, 0.008, 0, 0, Math.PI / 4);
  });
  g.userData.noPattern = true;
  return g;
}

function coin(entry, c, a) {
  const g = new THREE.Group();
  const shape = entry.shape;

  cylinder(g, c, 0, 0, 0, 0.13, 0.13, 0.03, Math.PI / 2);
  torus(g, a, 0, 0, 0.01, 0.11, 0.01);
  mesh(g, starGeo(), a).scale.setScalar(0.05);
  g.children[g.children.length - 1].position.z = 0.02;

  if (shape === 'clock') {
    sphere(g, INK, 0, 0, 0.02, 0.11, 1, 1, 0.1);
    box(g, CREAM, 0, 0.03, 0.032, 0.012, 0.06, 0.008);
    box(g, CREAM, 0.025, 0, 0.032, 0.05, 0.01, 0.008, 0, 0, Math.PI / 4);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      sphere(g, CREAM, Math.cos(angle) * 0.09, Math.sin(angle) * 0.09, 0.03, 0.008);
    }
  }
  g.userData.noPattern = true;
  return g;
}

function menorah(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.11, 0, 0.1, 0.11, 0.025);
  cylinder(g, c, 0, -0.03, 0, 0.014, 0.02, 0.14);
  const count = entry.shape === 'eight' ? 8 : 7;
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * 0.036;
    const arch = torus(g, c, x / 2, -0.02, 0, 0.05, 0.008, 0, 0, 0, Math.PI);
    arch.scale.x = 0.5;
    arch.visible = false;
    box(g, c, x, 0.015, 0, 0.008, 0.06, 0.008);
    cylinder(g, a, x, 0.065, 0, 0.009, 0.009, 0.05);
    cone(g, FLAME, x, 0.1, 0, 0.009, 0.025);
  }
  g.userData.noPattern = true;
  return g;
}

function candle(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'icicle') {
    cone(g, c, 0, -0.02, 0, 0.055, 0.26, Math.PI);
    cone(g, a, -0.04, 0.08, 0, 0.018, 0.09, Math.PI, 0, 0.2);
    cone(g, a, 0.04, 0.05, 0, 0.015, 0.07, Math.PI, 0, -0.2);
    sphere(g, GLOW, 0.02, 0.06, 0.02, 0.015);
    g.userData.noPattern = true;
    return g;
  }
  if (entry.shape === 'flame') {
    cone(g, c, 0, -0.02, 0, 0.075, 0.18);
    cone(g, a, 0, 0.05, 0, 0.045, 0.12);
    sphere(g, GLOW, 0, 0.09, 0, 0.02);
    g.userData.patternRadius = 0.07;
    return g;
  }
  cylinder(g, c, 0, -0.02, 0, 0.048, 0.05, 0.22);
  cylinder(g, a, 0, -0.115, 0, 0.055, 0.055, 0.02);
  cylinder(g, INK, 0, 0.1, 0, 0.004, 0.004, 0.03);
  cone(g, FLAME, 0, 0.14, 0, 0.02, 0.055);
  sphere(g, GLOW, 0, 0.13, 0, 0.012, 1, 1.4, 1);
  [-0.03, 0.02].forEach((x, index) => {
    cylinder(g, c, x, 0.04 + index * 0.03, 0.04, 0.009, 0.009, 0.03);
  });
  g.userData.noPattern = true;
  return g;
}

function lantern(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, 0, 0, 0.085, 0.085, 0.16);
  torus(g, a, 0, 0.065, 0, 0.086, 0.011, Math.PI / 2);
  torus(g, a, 0, -0.065, 0, 0.086, 0.011, Math.PI / 2);
  cylinder(g, a, 0, 0.1, 0, 0.055, 0.075, 0.03);
  cylinder(g, a, 0, -0.095, 0, 0.05, 0.05, 0.02);
  cylinder(g, a, 0, -0.14, 0, 0.008, 0.012, 0.06);
  sphere(g, GLOW, 0, -0.005, 0.03, 0.045, 1, 1, 0.3);
  sphere(g, a, 0, 0.13, 0, 0.018);
  g.userData.noPattern = true;
  return g;
}

function gift(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, -0.01, 0, 0.17, 0.15, 0.17);
  box(g, a, 0, -0.01, 0.086, 0.035, 0.16, 0.006);
  box(g, a, 0, -0.01, -0.086, 0.035, 0.16, 0.006);
  box(g, a, 0.086, -0.01, 0, 0.006, 0.16, 0.035);
  sphere(g, a, -0.04, 0.085, 0, 0.04, 1.3, 0.8, 0.7);
  sphere(g, a, 0.04, 0.085, 0, 0.04, 1.3, 0.8, 0.7);
  sphere(g, GOLD, 0, 0.085, 0, 0.018);
  g.userData.noPattern = true;
  return g;
}

function firework(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'sparkler') {
    cylinder(g, WOOD, 0, -0.11, 0, 0.01, 0.01, 0.18);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const ray = box(g, i % 2 ? c : a, Math.cos(angle) * 0.055, 0.07 + Math.sin(angle) * 0.055, 0, 0.08, 0.008, 0.008);
      ray.rotation.z = angle;
    }
    sphere(g, GLOW, 0, 0.07, 0, 0.022);
    g.userData.noPattern = true;
    return g;
  }
  cylinder(g, c, 0, -0.04, 0, 0.055, 0.065, 0.18);
  cylinder(g, a, 0, 0.04, 0, 0.058, 0.058, 0.03);
  cone(g, c, 0, 0.09, 0, 0.055, 0.07);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const ray = box(g, a, Math.cos(angle) * 0.09, 0.16 + Math.sin(angle) * 0.09, 0, 0.09, 0.01, 0.01);
    ray.rotation.z = angle;
    sphere(g, i % 2 ? GLOW : a, Math.cos(angle) * 0.14, 0.16 + Math.sin(angle) * 0.14, 0, 0.012);
  }
  torus(g, GOLD, 0, -0.14, 0, 0.03, 0.007, 0, 0, 0.6);
  g.userData.noPattern = true;
  return g;
}

function sun(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0, 0, 0.1);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    cone(g, a, Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 0, 0.03, 0.08, 0, 0, angle - Math.PI / 2);
  }
  sphere(g, GLOW, -0.03, 0.03, 0.09, 0.02, 1, 1, 0.4);
  g.userData.noPattern = true;
  return g;
}

function feather(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, leafGeo(), c);
  m.scale.set(0.09, 0.24, 0.05);
  m.rotation.z = 0.15;
  cylinder(g, a, -0.015, -0.15, 0, 0.008, 0.012, 0.2, 0, 0, -0.12);
  if (entry.shape === 'peacock') {
    sphere(g, a, 0.005, 0.04, 0.03, 0.05, 1, 1, 0.25);
    sphere(g, GOLD, 0.005, 0.04, 0.045, 0.028, 1, 1, 0.25);
    sphere(g, INK, 0.005, 0.04, 0.057, 0.014, 1, 1, 0.2);
  } else {
    [-0.06, 0, 0.06].forEach((y) => {
      box(g, a, 0.035, y + 0.02, 0.03, 0.06, 0.008, 0.006, 0, 0, 0.4);
    });
  }
  g.userData.noPattern = true;
  return g;
}

function corn(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.01, 0, 0.065, 0.05, 0.22, 0, 0, 0, 10);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    box(g, a, Math.cos(angle) * 0.045, -0.12, Math.sin(angle) * 0.045, 0.03, 0.16, 0.012, 0.3, angle, 0);
  }
  for (let i = 0; i < 4; i += 1) {
    sphere(g, a, 0, -0.03 + i * 0.055, 0.05, 0.012, 1.4, 1, 0.6);
  }
  g.userData.noPattern = true;
  return g;
}

function leaf(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, leafGeo(), c);
  m.scale.set(0.16, 0.17, 0.04);
  m.rotation.z = -0.2;
  box(g, a, 0, -0.02, 0.03, 0.012, 0.22, 0.006, 0, 0, 0.1);
  box(g, a, 0, -0.16, 0, 0.012, 0.09, 0.012);
  g.userData.noPattern = true;
  return g;
}

function rainbow(entry, c, a) {
  const g = new THREE.Group();
  const colors = ['#ff5d8f', '#ff8a00', '#ffd93d', '#3ddc84', '#2ec4ff', '#a855f7'];
  if (entry.shape === 'aurora') {
    for (let i = 0; i < 3; i += 1) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.17, -0.02 + i * 0.02, i * 0.01),
        new THREE.Vector3(-0.08, 0.09 + i * 0.02, 0.02),
        new THREE.Vector3(0.02, 0.03, 0),
        new THREE.Vector3(0.12, 0.12 + i * 0.02, 0.02),
        new THREE.Vector3(0.18, 0.02, 0),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 5, false), mat(colors[i * 2]));
      g.add(tube);
    }
    g.userData.noPattern = true;
    return g;
  }
  if (entry.shape === 'horseshoe') {
    torus(g, c, 0, 0.02, 0, 0.12, 0.03, 0, 0, Math.PI * 0.15, Math.PI * 1.25);
    [0.7, 1.4, 2.1].forEach((angle) => {
      sphere(g, a, Math.cos(angle + 2.2) * 0.12, Math.sin(angle + 2.2) * 0.12 + 0.02, 0.02, 0.012);
    });
    g.userData.noPattern = true;
    return g;
  }
  colors.forEach((color, index) => {
    torus(g, mat(color), 0, -0.03, index * 0.004, 0.15 - index * 0.022, 0.014, 0, 0, 0, Math.PI);
  });
  sphere(g, CREAM, -0.15, -0.03, 0, 0.03);
  sphere(g, CREAM, 0.15, -0.03, 0, 0.03);
  g.userData.noPattern = true;
  return g;
}

function guitar(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'sax') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.02, -0.16, 0),
      new THREE.Vector3(-0.04, -0.06, 0),
      new THREE.Vector3(0.01, 0.02, 0),
      new THREE.Vector3(0.06, 0.07, 0),
      new THREE.Vector3(0.09, 0.12, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 8, false), c);
    g.add(tube);
    cone(g, c, 0.09, 0.16, 0, 0.055, 0.08, 0.7);
    box(g, INK, 0.03, 0.03, 0.03, 0.03, 0.01, 0.01);
    box(g, INK, -0.01, -0.06, 0.03, 0.03, 0.01, 0.01);
    g.userData.noPattern = true;
    return g;
  }
  sphere(g, c, 0, -0.06, 0, 0.1, 1.1, 1, 0.55);
  sphere(g, c, 0, 0.045, 0, 0.075, 1.1, 0.9, 0.55);
  sphere(g, INK, 0, 0, 0.055, 0.03, 1, 1, 0.3);
  box(g, WOOD, 0, 0.16, 0, 0.028, 0.14, 0.022);
  box(g, a, 0, 0.23, 0, 0.05, 0.04, 0.026);
  [-0.012, 0, 0.012].forEach((x) => box(g, CREAM, x, 0.12, 0.016, 0.003, 0.18, 0.003));
  g.userData.noPattern = true;
  return g;
}

function beachball(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'disco') {
    mesh(g, icosaGeo(0.13), c);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      sphere(g, a, Math.cos(angle) * 0.09, Math.sin(angle) * 0.06, 0.09, 0.016, 1, 1, 0.4);
    }
    torus(g, GOLD, 0, 0.15, 0, 0.025, 0.007);
    g.userData.noPattern = true;
    return g;
  }
  sphere(g, c, 0, 0, 0, 0.14);
  [0.4, 1.0, 1.6].forEach((angle) => {
    torus(g, a, 0, 0, 0, 0.14, 0.014, 0, angle, 0);
  });
  sphere(g, CREAM, 0, 0.14, 0, 0.04, 1, 0.5, 1);
  g.userData.noPattern = true;
  return g;
}

function icecream(entry, c, a) {
  const g = new THREE.Group();
  if (entry.shape === 'popsicle') {
    box(g, c, 0, 0.03, 0, 0.13, 0.2, 0.06);
    sphere(g, c, 0, 0.13, 0, 0.065, 1, 0.8, 0.9);
    box(g, a, 0, -0.02, 0.032, 0.13, 0.03, 0.004);
    cylinder(g, WOOD, 0, -0.13, 0, 0.015, 0.015, 0.12);
    g.userData.noPattern = true;
    return g;
  }
  cone(g, a, 0, -0.1, 0, 0.07, 0.19, Math.PI);
  torus(g, a, 0, -0.02, 0, 0.065, 0.012, Math.PI / 2);
  sphere(g, c, 0, 0.06, 0, 0.07);
  sphere(g, CREAM, 0.01, 0.13, 0, 0.055);
  sphere(g, '#ff2e63', 0, 0.185, 0, 0.018);
  g.userData.noPattern = true;
  return g;
}

function shell(entry, c, a) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const angle = (i - 2) * 0.34;
    const ridge = sphere(g, i % 2 ? c : a, Math.sin(angle) * 0.07, 0.02 + Math.cos(angle) * 0.04, 0, 0.085, 0.24, 1.5, 0.18);
    ridge.rotation.z = -angle;
  }
  sphere(g, a, 0, -0.09, 0, 0.045, 1.3, 0.8, 0.9);
  g.userData.noPattern = true;
  return g;
}

function palm(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, a, 0, -0.02, 0, 0.026, 0.036, 0.3, 0, 0, 0);
  cylinder(g, a, 0.015, 0.1, 0, 0.022, 0.026, 0.12, 0, 0, -0.2);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const frond = sphere(g, c, 0.04 + Math.cos(angle) * 0.09, 0.16 + Math.sin(angle) * 0.06, 0, 0.09, 2, 0.35, 0.3);
    frond.rotation.z = angle;
  }
  sphere(g, c, 0.03, 0.12, 0.04, 0.025);
  g.userData.noPattern = true;
  return g;
}

function mitten(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.01, 0, 0.09, 1, 1.35, 0.5);
  sphere(g, c, -0.075, 0.02, 0, 0.045, 1, 1.2, 0.55);
  cylinder(g, a, 0, -0.115, 0, 0.085, 0.09, 0.05);
  torus(g, CREAM, 0, -0.09, 0, 0.082, 0.012, Math.PI / 2);
  sphere(g, a, 0.02, 0.03, 0.04, 0.018);
  g.userData.patternRadius = 0.085;
  return g;
}

function scarf(entry, c, a) {
  const g = new THREE.Group();
  torus(g, c, 0, 0.04, 0, 0.1, 0.04, Math.PI / 2);
  box(g, c, 0.09, -0.07, 0, 0.055, 0.17, 0.045);
  box(g, c, 0.125, -0.11, 0, 0.035, 0.12, 0.04, 0, 0, 0.15);
  [0.02, -0.05, -0.12].forEach((y) => box(g, a, 0.09, y, 0, 0.058, 0.02, 0.047));
  for (let i = 0; i < 3; i += 1) {
    box(g, a, 0.115 + i * 0.012, -0.18, 0, 0.012, 0.04, 0.035);
  }
  g.userData.noPattern = true;
  return g;
}

function sled(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, 0.02, 0, 0.23, 0.03, 0.09);
  [-0.075, 0, 0.075].forEach((x) => box(g, a, x, 0.045, 0, 0.03, 0.02, 0.095));
  [-0.08, 0.08].forEach((x) => {
    box(g, WOOD, x, -0.05, 0.045, 0.012, 0.12, 0.012);
    torus(g, WOOD, x, -0.1, 0.03, 0.035, 0.008, 0, Math.PI / 2, 0, Math.PI * 0.6);
  });
  box(g, a, 0.09, 0.12, 0, 0.012, 0.1, 0.012, 0, 0, -0.3);
  g.userData.noPattern = true;
  return g;
}

function snowman(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, -0.1, 0, 0.095);
  sphere(g, c, 0, 0.01, 0, 0.07);
  sphere(g, c, 0, 0.09, 0, 0.05);
  cone(g, '#ff8a00', 0, 0.085, 0.055, 0.016, 0.05, Math.PI / 2);
  sphere(g, INK, -0.018, 0.105, 0.042, 0.007);
  sphere(g, INK, 0.018, 0.105, 0.042, 0.007);
  [-0.04, -0.09].forEach((y) => sphere(g, INK, 0, y, 0.055, 0.008));
  cylinder(g, INK, 0, 0.15, 0, 0.045, 0.045, 0.04);
  cylinder(g, INK, 0, 0.175, 0, 0.055, 0.055, 0.008);
  torus(g, a, 0, 0.135, 0, 0.045, 0.008, Math.PI / 2);
  box(g, a, 0.045, -0.01, 0.05, 0.08, 0.01, 0.01, 0, 0, 0.4);
  g.userData.noPattern = true;
  return g;
}

function mask(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.01, 0, 0.11, 1.3, 0.85, 0.35);
  sphere(g, INK, -0.045, 0.025, 0.05, 0.022, 1.3, 0.8, 0.4);
  sphere(g, INK, 0.045, 0.025, 0.05, 0.022, 1.3, 0.8, 0.4);
  cone(g, a, 0, 0.06, 0.045, 0.018, 0.045, Math.PI / 2);
  cylinder(g, WOOD, 0.13, -0.01, 0, 0.008, 0.008, 0.14, 0, 0, 0.9);
  for (let i = 0; i < 3; i += 1) {
    const feather = cone(g, i % 2 ? a : c, -0.08 + i * 0.08, 0.14, -0.02, 0.018, 0.13, 0, 0, (i - 1) * 0.35);
    feather.position.y += i * 0.01;
  }
  g.userData.noPattern = true;
  return g;
}

function beads(entry, c, a) {
  const g = new THREE.Group();
  [0.03, -0.03, -0.09].forEach((y, ringIndex) => {
    torus(g, ringIndex % 2 ? a : c, 0, y, 0, 0.11, 0.014, Math.PI / 2);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      sphere(g, i % 2 ? c : a, Math.cos(angle) * 0.11, y, Math.sin(angle) * 0.11, 0.017);
    }
  });
  g.userData.noPattern = true;
  return g;
}

function drum(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, 0, 0, 0.12, 0.12, 0.13);
  torus(g, a, 0, 0.065, 0, 0.12, 0.012, Math.PI / 2);
  torus(g, a, 0, -0.065, 0, 0.12, 0.012, Math.PI / 2);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    box(g, CREAM, Math.cos(angle) * 0.06, 0, Math.sin(angle) * 0.12, 0.008, 0.13, 0.008, 0, 0, Math.cos(angle) * 0.4);
  }
  cylinder(g, WOOD, -0.1, 0.12, 0, 0.012, 0.012, 0.16, 0, 0, 0.7);
  cylinder(g, WOOD, 0.1, 0.12, 0, 0.012, 0.012, 0.16, 0, 0, -0.7);
  g.userData.noPattern = true;
  return g;
}

function skull(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.03, 0, 0.1, 1, 1.05, 0.95);
  box(g, c, 0, -0.06, 0.005, 0.1, 0.06, 0.09);
  sphere(g, INK, -0.04, 0.04, 0.075, 0.027, 1.2, 1, 0.4);
  sphere(g, INK, 0.04, 0.04, 0.075, 0.027, 1.2, 1, 0.4);
  cone(g, INK, 0, -0.01, 0.09, 0.014, 0.03, Math.PI / 2);
  for (let i = 0; i < 3; i += 1) {
    box(g, CREAM, -0.025 + i * 0.025, -0.075, 0.05, 0.016, 0.025, 0.01);
  }
  sphere(g, a, 0, 0.1, 0.055, 0.018, 1.6, 0.5, 0.4);
  g.userData.patternRadius = 0.1;
  return g;
}

function watermelon(entry, c, a) {
  const g = new THREE.Group();
  const slice = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.12, 16, 1, false, 0, Math.PI * 0.75),
    c
  );
  slice.rotation.x = Math.PI / 2;
  slice.rotation.z = -Math.PI * 0.375;
  g.add(slice);
  const rind = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.018, 6, 18, Math.PI * 0.75),
    a
  );
  rind.position.z = 0.06;
  rind.rotation.z = -Math.PI * 0.375;
  g.add(rind);
  for (let i = 0; i < 4; i += 1) {
    const angle = -0.9 + i * 0.55;
    sphere(g, INK, Math.cos(angle) * 0.075, Math.sin(angle) * 0.075, 0.065, 0.008, 1, 1.6, 0.4);
  }
  g.userData.noPattern = true;
  return g;
}

function surfboard(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, ovalGeo(), c);
  m.scale.set(0.08, 0.2, 0.35);
  box(g, a, 0, 0.005, 0.018, 0.02, 0.3, 0.006);
  box(g, a, 0, 0.005, -0.018, 0.02, 0.3, 0.006);
  g.userData.noPattern = true;
  return g;
}

function umbrella(entry, c, a) {
  const g = new THREE.Group();
  cone(g, c, 0, 0.06, 0, 0.16, 0.12);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    sphere(g, a, Math.cos(angle) * 0.13, 0.01, Math.sin(angle) * 0.13, 0.018);
  }
  cylinder(g, WOOD, 0, -0.04, 0, 0.01, 0.01, 0.22);
  torus(g, WOOD, 0.035, -0.15, 0, 0.035, 0.008, 0, 0, 0, Math.PI);
  g.userData.noPattern = true;
  return g;
}

function hotdog(entry, c, a) {
  const g = new THREE.Group();
  capsule(g, c, 0, -0.02, 0, 0.06, 0.2, Math.PI / 2);
  capsule(g, a, 0, 0.02, 0.01, 0.035, 0.23, Math.PI / 2);
  const mustard = box(g, GOLD, 0, 0.045, 0.035, 0.16, 0.01, 0.01);
  mustard.rotation.z = 0.05;
  box(g, c, -0.11, -0.02, 0, 0.05, 0.07, 0.11, 0, 0, 0.1);
  g.userData.noPattern = true;
  return g;
}

function coffin(entry, c, a) {
  const g = new THREE.Group();
  const m = mesh(g, coffinGeo(), c);
  m.scale.set(0.09, 0.17, 0.3);
  box(g, a, 0, 0.05, 0.04, 0.02, 0.1, 0.006);
  box(g, a, 0, 0.05, 0.04, 0.06, 0.02, 0.006);
  g.userData.patternRadius = 0.09;
  return g;
}

function altar(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, -0.06, 0, 0.2, 0.08, 0.11);
  box(g, c, 0, 0.01, 0, 0.15, 0.06, 0.09);
  box(g, a, 0, 0.06, 0, 0.11, 0.04, 0.07);
  [-0.04, 0.04].forEach((x) => {
    cylinder(g, CREAM, x, 0.11, 0, 0.012, 0.012, 0.05);
    cone(g, FLAME, x, 0.15, 0, 0.01, 0.025);
  });
  sphere(g, a, 0, 0.09, 0.035, 0.02);
  g.userData.noPattern = true;
  return g;
}

function clover(entry, c, a) {
  const g = new THREE.Group();
  [0, 1, 2].forEach((i) => {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const leaf = mesh(g, heartGeo(), i === 1 ? a : c);
    leaf.scale.setScalar(0.055);
    leaf.position.set(Math.cos(angle) * 0.055, Math.sin(angle) * 0.055, 0);
    leaf.rotation.z = angle + Math.PI / 2;
  });
  cylinder(g, GREEN, 0, -0.1, 0, 0.008, 0.012, 0.12, 0, 0, 0.25);
  g.userData.noPattern = true;
  return g;
}

function sandcastle(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, -0.07, 0, 0.22, 0.06, 0.16);
  [-0.07, 0.07].forEach((x) => {
    cylinder(g, c, x, 0.01, 0.02, 0.045, 0.055, 0.12);
    cone(g, a, x, 0.1, 0.02, 0.05, 0.08);
  });
  box(g, c, 0, 0.02, -0.04, 0.08, 0.11, 0.06);
  box(g, a, -0.02, 0.075, -0.04, 0.06, 0.025, 0.062);
  box(g, WOOD, 0, 0.17, 0.02, 0.008, 0.08, 0.008);
  box(g, a, 0.025, 0.19, 0.02, 0.045, 0.025, 0.004);
  g.userData.noPattern = true;
  return g;
}

function sunhat(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.06, 0, 0.17, 0.17, 0.016, 0, 0, 0, 18);
  sphere(g, c, 0, -0.02, 0, 0.09, 1, 0.75, 1);
  cylinder(g, a, 0, -0.045, 0, 0.095, 0.095, 0.03);
  sphere(g, a, 0.09, -0.055, 0.03, 0.025, 1.5, 0.5, 0.8);
  g.userData.noPattern = true;
  return g;
}

function snorkel(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0, 0, 0.1, 1.35, 0.85, 0.5);
  sphere(g, GLASS, -0.045, 0.01, 0.035, 0.035, 1.2, 0.8, 0.4);
  sphere(g, GLASS, 0.045, 0.01, 0.035, 0.035, 1.2, 0.8, 0.4);
  torus(g, GLASS, -0.045, 0.01, 0.05, 0.032, 0.008);
  torus(g, GLASS, 0.045, 0.01, 0.05, 0.032, 0.008);
  cylinder(g, a, 0.1, 0.02, 0, 0.014, 0.014, 0.18, 0, 0, -0.15);
  torus(g, a, 0.075, 0.12, 0, 0.03, 0.014, 0, 0, 0, Math.PI);
  g.userData.noPattern = true;
  return g;
}

function floatring(entry, c, a) {
  const g = new THREE.Group();
  torus(g, c, 0, 0, 0, 0.12, 0.05);
  [0, 1, 2, 3].forEach((i) => {
    const angle = (i / 4) * Math.PI * 2;
    torus(g, a, Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0, 0.052, 0.052, 0, 0, 0);
  });
  g.userData.noPattern = true;
  return g;
}

function float(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, -0.02, 0, 0.24, 0.08, 0.12);
  box(g, a, 0, 0.045, 0, 0.18, 0.05, 0.1);
  [-0.08, 0.08].forEach((x) => {
    [-0.06, 0.06].forEach((z) => {
      cylinder(g, INK, x, -0.08, z, 0.035, 0.035, 0.025, Math.PI / 2);
    });
  });
  [-0.07, 0, 0.07].forEach((x, i) => {
    cylinder(g, CREAM, x, 0.12, 0, 0.01, 0.01, 0.09);
    sphere(g, i % 2 ? a : c, x, 0.18, 0, 0.02);
  });
  mesh(g, starGeo(), GOLD).scale.setScalar(0.03);
  g.children[g.children.length - 1].position.set(0, 0.09, 0.061);
  g.userData.noPattern = true;
  return g;
}

function hourglass(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, -0.13, 0, 0.09, 0.09, 0.025);
  cylinder(g, c, 0, 0.13, 0, 0.09, 0.09, 0.025);
  cone(g, GLASS, 0, -0.06, 0, 0.075, 0.11);
  cone(g, GLASS, 0, 0.06, 0, 0.075, 0.11, Math.PI);
  sphere(g, a, 0, -0.1, 0, 0.05, 1.3, 0.35, 1.3);
  [-0.085, 0.085].forEach((x) => cylinder(g, c, x, 0, 0, 0.008, 0.008, 0.26));
  g.userData.noPattern = true;
  return g;
}

function balloon(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.03, 0, 0.11, 0.9, 1.15, 0.9);
  cone(g, c, 0, -0.1, 0, 0.022, 0.05, Math.PI);
  cylinder(g, CREAM, 0, -0.17, 0, 0.004, 0.004, 0.13);
  sphere(g, CREAM, -0.035, 0.09, 0.075, 0.02, 1, 1, 0.45);
  g.userData.patternRadius = 0.12;
  return g;
}

function bean(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0, 0, 0.11, 1.55, 0.82, 0.78);
  sphere(g, CREAM, -0.055, 0.03, 0.06, 0.018, 1.3, 0.65, 0.4);
  sphere(g, a, 0.06, -0.02, 0.04, 0.014, 1.4, 0.7, 0.4);
  g.userData.patternRadius = 0.1;
  return g;
}

function bow(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, -0.07, 0.03, 0, 0.06, 1.3, 0.95, 0.35);
  sphere(g, c, 0.07, 0.03, 0, 0.06, 1.3, 0.95, 0.35);
  sphere(g, a, 0, 0.03, 0.012, 0.028, 1, 1, 0.7);
  box(g, c, -0.035, -0.07, 0, 0.035, 0.11, 0.012, 0, 0, 0.35);
  box(g, c, 0.035, -0.07, 0, 0.035, 0.11, 0.012, 0, 0, -0.35);
  g.userData.noPattern = true;
  return g;
}

function cookie(entry, c, a) {
  const g = new THREE.Group();
  cylinder(g, c, 0, 0, 0, 0.12, 0.12, 0.05, 0, 0, 0, 16);
  const face = g.children[g.children.length - 1];
  face.rotation.x = Math.PI / 2;
  [[-0.05, 0.03], [0.04, 0.05], [0.02, -0.045], [0.07, -0.01]].forEach(([x, y]) => {
    sphere(g, INK, x, y, 0.03, 0.014, 1, 1, 0.5);
  });
  g.userData.noPattern = true;
  return g;
}

function dragon(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.02, 0, 0.11, 1.1, 1, 0.9);
  sphere(g, c, 0, -0.01, 0.08, 0.07, 1.2, 0.8, 1);
  [-0.04, 0.04].forEach((x) => {
    cone(g, a, x, 0.15, -0.01, 0.022, 0.09, 0, 0, x > 0 ? -0.3 : 0.3);
    sphere(g, INK, x * 1.2, 0.05, 0.065, 0.012);
  });
  box(g, a, -0.11, -0.03, 0.05, 0.09, 0.012, 0.012, 0, 0, 0.3);
  box(g, a, 0.11, -0.03, 0.05, 0.09, 0.012, 0.012, 0, 0, -0.3);
  sphere(g, a, 0, 0.11, -0.04, 0.035, 1.6, 0.8, 0.6);
  sphere(g, GLOW, 0, -0.01, 0.145, 0.02, 1.4, 0.7, 0.4);
  g.userData.noPattern = true;
  return g;
}

function drumstick(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.02, 0, 0.1, 1.1, 0.95, 1);
  cylinder(g, CREAM, 0, -0.1, 0.01, 0.022, 0.026, 0.14);
  sphere(g, CREAM, -0.025, -0.18, 0.01, 0.03);
  sphere(g, CREAM, 0.025, -0.18, 0.01, 0.03);
  g.userData.noPattern = true;
  return g;
}

function bunnyEars(entry, c, a) {
  const g = new THREE.Group();
  capsule(g, c, -0.055, 0.06, 0, 0.032, 0.14, -0.14);
  capsule(g, c, 0.055, 0.06, 0, 0.032, 0.14, 0.14);
  capsule(g, a, -0.055, 0.07, 0.02, 0.016, 0.1, -0.14);
  capsule(g, a, 0.055, 0.07, 0.02, 0.016, 0.1, 0.14);
  torus(g, a, 0, -0.09, 0, 0.075, 0.016, Math.PI / 2, 0, 0, Math.PI);
  g.userData.noPattern = true;
  return g;
}

function fleurDeLis(entry, c, a) {
  const g = new THREE.Group();
  sphere(g, c, 0, 0.09, 0, 0.035, 1, 1.8, 0.5);
  sphere(g, c, -0.07, 0.03, 0, 0.045, 1.3, 1, 0.4);
  sphere(g, c, 0.07, 0.03, 0, 0.045, 1.3, 1, 0.4);
  box(g, a, 0, -0.06, 0, 0.16, 0.03, 0.03);
  cone(g, c, 0, -0.11, 0, 0.025, 0.08, Math.PI);
  g.userData.noPattern = true;
  return g;
}

function flowerCrown(entry, c, a) {
  const g = new THREE.Group();
  torus(g, GREEN, 0, -0.02, 0, 0.11, 0.022);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const x = Math.cos(angle) * 0.11;
    const y = Math.sin(angle) * 0.11 - 0.02;
    for (let j = 0; j < 5; j += 1) {
      const petalAngle = (j / 5) * Math.PI * 2;
      sphere(g, i % 2 ? c : a, x + Math.cos(petalAngle) * 0.022, y + Math.sin(petalAngle) * 0.022, 0.012, 0.018);
    }
    sphere(g, GOLD, x, y, 0.025, 0.013);
  }
  g.userData.noPattern = true;
  return g;
}

function note(entry, c, a) {
  const g = new THREE.Group();
  box(g, c, 0, 0, 0, 0.14, 0.18, 0.014);
  [-0.045, 0, 0.045].forEach((y) => box(g, a, 0, y, 0.01, 0.09, 0.008, 0.004));
  const fold = cone(g, c, 0.07, 0.09, 0, 0.045, 0.045, 0, 0, 0, 3);
  fold.rotation.x = Math.PI / 2;
  box(g, a, -0.02, -0.06, 0.012, 0.035, 0.02, 0.006);
  g.userData.noPattern = true;
  return g;
}

function rangoli(entry, c, a) {
  const g = new THREE.Group();
  const disc = cylinder(g, c, 0, 0, 0, 0.13, 0.13, 0.022, 0, 0, 0, 16);
  disc.rotation.x = Math.PI / 2;
  [0.05, 0.085, 0.115].forEach((radius, index) => {
    torus(g, index % 2 ? a : CREAM, 0, 0, 0.013, radius, 0.007);
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    sphere(g, i % 2 ? a : c, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1, 0.018, 0.012);
  }
  sphere(g, GOLD, 0, 0, 0.02, 0.022);
  g.userData.noPattern = true;
  return g;
}

function scarecrow(entry, c, a) {
  const g = new THREE.Group();
  box(g, WOOD, 0, -0.02, 0, 0.026, 0.3, 0.026);
  box(g, WOOD, 0, 0.06, 0, 0.22, 0.024, 0.024);
  sphere(g, c, 0, 0.12, 0, 0.075);
  cone(g, a, 0, 0.21, 0, 0.075, 0.08);
  cylinder(g, a, 0, 0.165, 0, 0.08, 0.085, 0.018);
  sphere(g, INK, -0.025, 0.13, 0.06, 0.009);
  sphere(g, INK, 0.025, 0.13, 0.06, 0.009);
  box(g, a, 0, 0.1, 0.06, 0.05, 0.012, 0.01, 0, 0, 0.3);
  box(g, c, -0.07, 0.05, 0.015, 0.05, 0.08, 0.03);
  box(g, a, 0.07, 0.05, 0.015, 0.05, 0.08, 0.03);
  for (let i = 0; i < 3; i += 1) {
    box(g, a, -0.09 + i * 0.09, -0.13, 0, 0.012, 0.06, 0.012, 0, 0, (i - 1) * 0.25);
  }
  g.userData.noPattern = true;
  return g;
}

const BUILDERS = {
  balloon,
  bean,
  bow,
  cookie,
  dragon,
  drumstick,
  ears: bunnyEars,
  firecracker: rocket,
  fleur: fleurDeLis,
  flowercrown: flowerCrown,
  note,
  rangoli,
  scarecrow,
  bauble,
  star,
  davidstar: davidStar,
  candyCane,
  snowflake,
  holly,
  gingerbread,
  bell,
  stocking,
  wreath,
  snowglobe: snowGlobe,
  train,
  rocket,
  pumpkin,
  candycorn: candyCorn,
  bat,
  ghost,
  witchhat: hat,
  tophat: hat,
  partyhat: hat,
  jester: hat,
  crown: hat,
  noisemaker: hat,
  spider,
  cauldron,
  pot: cauldron,
  house,
  egg,
  bunny: animal,
  chick: animal,
  birds: animal,
  lamb: animal,
  turkey: animal,
  lion: animal,
  cat: animal,
  bear: animal,
  flower,
  rose: flower,
  lotus: flower,
  blossom: flower,
  carrot,
  basket,
  tree,
  heart,
  arrow,
  envelope,
  scroll: envelope,
  papel: envelope,
  cake,
  pie: cake,
  donut: cake,
  latke: cake,
  bread: cake,
  acorn,
  pinecone: acorn,
  stone: acorn,
  dumpling: acorn,
  orange: acorn,
  mug,
  glass: mug,
  oil: mug,
  diya: mug,
  moon,
  dreidel,
  coin,
  clock: coin,
  scale: coin,
  menorah,
  eight: menorah,
  candle,
  icicle: candle,
  flame: candle,
  lantern,
  gift,
  firework,
  sparkler: firework,
  sun,
  feather,
  peacock: feather,
  leaf,
  corn,
  rainbow,
  aurora: rainbow,
  horseshoe: rainbow,
  guitar,
  fiddle: guitar,
  sax: guitar,
  beachball,
  disco: beachball,
  icecream,
  popsicle: icecream,
  shell,
  palm,
  mitten,
  scarf,
  sled,
  snowman,
  mask,
  beads,
  drum,
  skull,
  watermelon,
  surfboard,
  umbrella,
  hotdog,
  coffin,
  altar,
  clover,
  sandcastle,
  sunhat,
  snorkel,
  floatring,
  float,
  hourglass,
};

// ------------------------------------------------------------- decoration
function addPattern(group, entry) {
  if (group.userData.noPattern) return;
  const radius = group.userData.patternRadius || 0.12;
  const y = group.userData.patternY || 0;
  const c = mat(entry.accent);
  const pattern = entry.pattern;

  if (pattern === 'dots') {
    for (let i = 0; i < 7; i += 1) {
      const angle = i * 1.9;
      const px = Math.cos(angle) * radius * 0.72;
      const py = Math.sin(angle * 1.3) * radius * 0.6;
      const pz = Math.sqrt(Math.max(0.01, radius * radius - px * px - py * py)) * 0.92;
      sphere(group, c, px, y + py, pz, 0.015);
    }
  } else if (pattern === 'stripes') {
    [-0.38, 0.28].forEach((offset) => {
      torus(group, c, 0, y + radius * offset, 0, radius * 0.95, 0.009, Math.PI / 2);
    });
  } else if (pattern === 'stars') {
    for (let i = 0; i < 4; i += 1) {
      const angle = i * 1.7 + 0.4;
      const px = Math.cos(angle) * radius * 0.62;
      const py = Math.sin(angle * 1.4) * radius * 0.55;
      const m = mesh(group, starGeo(), i % 2 ? GOLD : c);
      m.scale.setScalar(0.022);
      m.position.set(px, y + py, radius * 0.85);
    }
  } else if (pattern === 'snow') {
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 1.5 + 0.7;
      sphere(group, SNOW, Math.cos(angle) * radius * 0.62, y + Math.sin(angle) * radius * 0.55, radius * 0.78, 0.014);
    }
    sphere(group, SNOW, 0, y + radius * 0.86, 0, radius * 0.24, 1, 0.4, 1);
  } else if (pattern === 'swirl') {
    for (let i = 0; i < 3; i += 1) {
      const m = torus(group, c, 0, y + 0.02 - i * 0.045, radius * 0.9, radius * 0.55, 0.007, 0, 0, i * 0.6, Math.PI * 1.2);
      m.scale.y = 0.7;
    }
  } else if (pattern === 'glitter') {
    for (let i = 0; i < 8; i += 1) {
      const angle = i * 2.4;
      const px = Math.cos(angle) * radius * 0.9;
      const py = Math.sin(angle * 1.7) * radius * 0.8;
      const sparkle = mesh(group, icosaGeo(0.012), i % 2 ? GOLD : c);
      sparkle.position.set(px, y + py, radius * 0.5);
      sparkle.rotation.set(angle, angle * 2, 0);
    }
  } else if (pattern === 'face') {
    [-0.055, 0.055].forEach((x) => {
      const eye = box(group, INK, x, y + 0.055, radius * 0.92, 0.036, 0.03, 0.012, 0, 0, Math.PI / 4);
      eye.scale.y = 0.7;
    });
    for (let i = 0; i < 4; i += 1) {
      box(group, INK, -0.055 + i * 0.037, y - 0.035 + (i % 2) * 0.014, radius * 0.92, 0.032, 0.014, 0.012, 0, 0, i % 2 ? 0.3 : -0.3);
    }
  }
}

const RARITY_SCALE = {
  common: 1.22,
  rare: 1.34,
  epic: 1.46,
  legendary: 1.6,
};

export function buildOrnament(entry) {
  const color = mat(entry.color);
  const accent = mat(entry.accent);
  const builder = BUILDERS[entry.shape] || bauble;
  const model = builder(entry, color, accent);
  addPattern(model, entry);

  const root = new THREE.Group();
  root.add(model);
  model.position.y = -0.16;

  // Gold cap and loop, so every shape can hang from a branch.
  cylinder(root, GOLD, 0, -0.035, 0, 0.026, 0.032, 0.028);
  torus(root, GOLD, 0, -0.008, 0, 0.026, 0.008);
  cylinder(root, CREAM, 0, 0.002, 0, 0.004, 0.004, 0.03);

  if (entry.rarity === 'legendary') {
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      const sparkle = mesh(root, starGeo(), GOLD);
      sparkle.scale.setScalar(0.016);
      sparkle.position.set(Math.cos(angle) * 0.2, -0.24 + Math.sin(angle) * 0.16, 0.02);
    }
  }

  root.scale.setScalar(RARITY_SCALE[entry.rarity] || 1);
  root.userData = {
    catalogId: entry.id,
    entry,
    rarity: entry.rarity,
    holiday: entry.holiday,
  };
  return root;
}
