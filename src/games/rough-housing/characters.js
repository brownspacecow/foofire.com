import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Rough Housing — roster
 * Four playable wrestlers. Each one is a procedural three.js rig wrapped
 * around a Rapier capsule. The kids are light and nimble, the grown-ups
 * are heavy and slow, and everyone flails when they get wrecked.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

function makeCanvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawEye(ctx, x, y, rx, ry, iris) {
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x, y + ry * 0.1, ry * 0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#180d2a';
  ctx.beginPath();
  ctx.arc(x, y + ry * 0.1, ry * 0.28, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - rx * 0.28, y - ry * 0.18, ry * 0.16, 0, TAU);
  ctx.fill();
}

function drawLashes(ctx, x, y, rx, ry) {
  ctx.strokeStyle = '#3a2030';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * rx * 0.55, y - ry * 0.9);
    ctx.lineTo(x + i * rx * 0.7, y - ry * 1.25);
    ctx.stroke();
  }
}

function faceTexture(kind) {
  return makeCanvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2;
    const eyeY = s * 0.4;
    const dx = s * 0.17;
    const rx = s * 0.082;
    const ry = s * 0.098;

    if (kind === 'joel') {
      drawEye(ctx, cx - dx, eyeY, rx, ry, '#3b82f6');
      drawEye(ctx, cx + dx, eyeY, rx, ry, '#3b82f6');
      ctx.strokeStyle = '#2a1533';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - dx - rx, eyeY - ry - 16);
      ctx.lineTo(cx - dx + rx * 0.8, eyeY - ry - 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dx + rx, eyeY - ry - 16);
      ctx.lineTo(cx + dx - rx * 0.8, eyeY - ry - 24);
      ctx.stroke();
      ctx.fillStyle = 'rgba(178, 92, 60, 0.55)';
      [
        [-0.25, 0.56],
        [-0.17, 0.6],
        [-0.28, 0.63],
        [0.25, 0.56],
        [0.17, 0.6],
        [0.28, 0.63],
      ].forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.arc(cx + fx * s, fy * s, 4, 0, TAU);
        ctx.fill();
      });
      // Big open grin, front two teeth missing.
      ctx.fillStyle = '#4a1226';
      ctx.beginPath();
      ctx.ellipse(cx, s * 0.71, s * 0.185, s * 0.125, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(cx - s * 0.15, s * 0.615, s * 0.055, s * 0.06);
      ctx.fillRect(cx - s * 0.083, s * 0.615, s * 0.05, s * 0.06);
      ctx.fillRect(cx + s * 0.032, s * 0.615, s * 0.05, s * 0.06);
      ctx.fillRect(cx + s * 0.094, s * 0.615, s * 0.056, s * 0.06);
      ctx.fillStyle = '#ff728f';
      ctx.beginPath();
      ctx.ellipse(cx, s * 0.775, s * 0.095, s * 0.042, 0, 0, TAU);
      ctx.fill();
      return;
    }

    if (kind === 'jira') {
      drawEye(ctx, cx - dx, eyeY, rx * 1.05, ry, '#2563eb');
      drawEye(ctx, cx + dx, eyeY, rx * 1.05, ry, '#2563eb');
      drawLashes(ctx, cx - dx, eyeY, rx * 1.05, ry);
      drawLashes(ctx, cx + dx, eyeY, rx * 1.05, ry);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - dx - rx, eyeY - ry - 18);
      ctx.lineTo(cx - dx + rx * 0.9, eyeY - ry - 23);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dx + rx, eyeY - ry - 18);
      ctx.lineTo(cx + dx - rx * 0.9, eyeY - ry - 23);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 120, 150, 0.45)';
      [cx - s * 0.27, cx + s * 0.27].forEach((x) => {
        ctx.beginPath();
        ctx.ellipse(x, s * 0.57, s * 0.06, s * 0.035, 0, 0, TAU);
        ctx.fill();
      });
      // Smiley with two front teeth.
      ctx.fillStyle = '#5d1730';
      ctx.beginPath();
      ctx.ellipse(cx, s * 0.7, s * 0.14, s * 0.075, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(cx - s * 0.055, s * 0.645, s * 0.042, s * 0.045);
      ctx.fillRect(cx + s * 0.012, s * 0.645, s * 0.042, s * 0.045);
      ctx.strokeStyle = '#5d1730';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, s * 0.652);
      ctx.lineTo(cx, s * 0.688);
      ctx.stroke();
      return;
    }

    if (kind === 'daddy') {
      drawEye(ctx, cx - dx, eyeY, rx, ry * 0.85, '#7c5a2a');
      drawEye(ctx, cx + dx, eyeY, rx, ry * 0.85, '#7c5a2a');
      ctx.strokeStyle = '#3a2a1e';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - dx - rx * 1.2, eyeY - ry - 10);
      ctx.lineTo(cx - dx + rx * 0.9, eyeY - ry - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dx + rx * 1.2, eyeY - ry - 10);
      ctx.lineTo(cx + dx - rx * 0.9, eyeY - ry - 20);
      ctx.stroke();
      ctx.fillStyle = 'rgba(60, 40, 30, 0.35)';
      for (let i = 0; i < 16; i += 1) {
        ctx.beginPath();
        ctx.arc(cx - s * 0.22 + Math.random() * s * 0.44, s * 0.6 + Math.random() * s * 0.16, 2.5, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#4a1226';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(cx, s * 0.68, s * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      return;
    }

    // momma
    drawEye(ctx, cx - dx, eyeY, rx * 1.05, ry, '#2f7d4f');
    drawEye(ctx, cx + dx, eyeY, rx * 1.05, ry, '#2f7d4f');
    drawLashes(ctx, cx - dx, eyeY, rx * 1.05, ry);
    drawLashes(ctx, cx + dx, eyeY, rx * 1.05, ry);
    ctx.strokeStyle = '#5a2a1e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - dx - rx, eyeY - ry - 20);
    ctx.lineTo(cx - dx + rx, eyeY - ry - 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dx + rx, eyeY - ry - 20);
    ctx.lineTo(cx + dx - rx, eyeY - ry - 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 110, 140, 0.5)';
    [cx - s * 0.27, cx + s * 0.27].forEach((x) => {
      ctx.beginPath();
      ctx.ellipse(x, s * 0.58, s * 0.065, s * 0.04, 0, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = '#c2185b';
    ctx.beginPath();
    ctx.ellipse(cx, s * 0.72, s * 0.16, s * 0.085, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff6e6';
    ctx.fillRect(cx - s * 0.1, s * 0.675, s * 0.2, s * 0.035);
  });
}

export const ROSTER = [
  {
    id: 'joel',
    name: 'Joel',
    tag: 'The 7-year-old',
    face: 'joel',
    colors: {
      skin: '#f2c09a',
      outfit: '#ff2e63',
      trim: '#2ec4ff',
      hair: '#241a4d',
      shoe: '#3ddc84',
      shorts: '#2ec4ff',
    },
    body: {
      height: 4.7,
      radius: 0.56,
      mass: 28,
      speed: 7.6,
      jump: 14.6,
      dashSpeed: 17.5,
      dashStyle: 'tuck',
      accel: 16,
    },
    stats: { speed: 4, jump: 4, weight: 1 },
  },
  {
    id: 'jira',
    name: 'Jira',
    tag: 'The 9-year-old',
    face: 'jira',
    colors: {
      skin: '#f6cfae',
      outfit: '#a855f7',
      trim: '#ffd93d',
      hair: '#ffd86b',
      shoe: '#ff2e63',
      shorts: '#7c3aed',
    },
    body: {
      height: 4.6,
      radius: 0.54,
      mass: 30,
      speed: 7.8,
      jump: 15,
      dashSpeed: 18,
      dashStyle: 'cartwheel',
      accel: 17,
    },
    stats: { speed: 5, jump: 5, weight: 1 },
  },
  {
    id: 'daddy',
    name: 'Big Daddy',
    tag: 'The dad',
    face: 'daddy',
    colors: {
      skin: '#e8b18a',
      outfit: '#2ec4ff',
      trim: '#ffd93d',
      hair: '#3b2a1e',
      shoe: '#241a4d',
      shorts: '#1d4ed8',
    },
    body: {
      height: 6.6,
      radius: 0.85,
      mass: 75,
      speed: 5.9,
      jump: 12.2,
      dashSpeed: 13.5,
      dashStyle: 'charge',
      accel: 9,
    },
    stats: { speed: 2, jump: 2, weight: 5 },
  },
  {
    id: 'momma',
    name: 'Big Momma',
    tag: 'The mom',
    face: 'momma',
    colors: {
      skin: '#e7b28c',
      outfit: '#3ddc84',
      trim: '#ff2e63',
      hair: '#c084fc',
      shoe: '#ffd93d',
      shorts: '#15803d',
    },
    body: {
      height: 6.2,
      radius: 0.95,
      mass: 82,
      speed: 5.5,
      jump: 11.4,
      dashSpeed: 12.8,
      dashStyle: 'charge',
      accel: 8,
    },
    stats: { speed: 1, jump: 1, weight: 5 },
  },
];

export function buildRig(spec) {
  const group = new THREE.Group();
  const scale = spec.body.height / 4.7;
  const { colors } = spec;
  const material = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

  const skin = material(colors.skin);
  const outfit = material(colors.outfit);
  const trim = material(colors.trim);
  const hairMat = material(colors.hair, { roughness: 0.62 });
  const shorts = material(colors.shorts);
  const shoe = material(colors.shoe);
  const faceMat = new THREE.MeshBasicMaterial({
    map: faceTexture(spec.face),
    transparent: true,
    depthWrite: false,
  });

  const parts = {};

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.0, 6, 14), outfit);
  torso.position.y = 0.22;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), shorts);
  hips.position.y = -0.72;
  hips.scale.set(1.08, 0.68, 0.9);
  hips.castShadow = true;
  group.add(hips);

  if (spec.id === 'daddy' || spec.id === 'momma') {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.66, 18, 14), outfit);
    belly.position.y = -0.12;
    belly.scale.set(1.12, 0.86, 0.94);
    belly.castShadow = true;
    group.add(belly);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 16), trim);
    belt.position.y = -0.55;
    belt.castShadow = true;
    group.add(belt);
  } else {
    [-0.24, 0.24].forEach((x) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.62), trim);
      strap.position.set(x, 0.66, 0);
      strap.castShadow = true;
      group.add(strap);
    });
  }

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.62, 0.82, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.72, 4, 10), skin);
    upper.position.y = -0.42;
    upper.castShadow = true;
    pivot.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
    hand.position.y = -0.86;
    hand.castShadow = true;
    pivot.add(hand);
    group.add(pivot);
    return pivot;
  };

  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, -0.76, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.78, 4, 10), skin);
    thigh.position.y = -0.52;
    thigh.castShadow = true;
    pivot.add(thigh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.62), shoe);
    boot.position.set(0, -1.5, 0.09);
    boot.castShadow = true;
    pivot.add(boot);
    group.add(pivot);
    return pivot;
  };

  parts.armL = makeArm(-1);
  parts.armR = makeArm(1);
  parts.legL = makeLeg(-1);
  parts.legR = makeLeg(1);

  const head = new THREE.Group();
  head.position.y = 1.66;
  group.add(head);
  parts.head = head;

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.6, 22, 18), skin);
  skull.scale.set(1, 0.96, 0.92);
  skull.castShadow = true;
  head.add(skull);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.02), faceMat);
  face.position.set(0, 0.02, 0.55);
  head.add(face);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skin);
  nose.position.set(0, -0.02, 0.6);
  head.add(nose);

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), skin);
    ear.position.set(side * 0.58, -0.02, -0.02);
    head.add(ear);
  });

  if (spec.id === 'joel') {
    for (let i = 0; i < 7; i += 1) {
      const t = i / 6;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.5 + Math.sin(t * Math.PI) * 0.34, 6),
        hairMat
      );
      spike.position.set(0, 0.58, -0.48 + t * 0.96);
      spike.rotation.x = (t - 0.5) * 0.5;
      spike.castShadow = true;
      head.add(spike);
    }
  }

  if (spec.id === 'jira') {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), hairMat);
    fringe.position.set(0, 0.16, -0.08);
    fringe.scale.set(1.02, 0.72, 0.95);
    fringe.castShadow = true;
    head.add(fringe);

    const ponytail = new THREE.Group();
    ponytail.position.set(0, 0.26, -0.52);
    head.add(ponytail);
    parts.ponytail = ponytail;

    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), trim);
    ponytail.add(tie);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.72, 4, 8), hairMat);
    tail.position.set(0, -0.44, -0.16);
    tail.rotation.x = 0.45;
    tail.castShadow = true;
    ponytail.add(tail);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), hairMat);
    tip.position.set(0, -0.82, -0.34);
    ponytail.add(tip);
  }

  if (spec.id === 'daddy') {
    [-1, 1].forEach((side) => {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hairMat);
      tuft.position.set(side * 0.5, 0.12, -0.06);
      tuft.scale.set(0.8, 0.9, 1.1);
      tuft.castShadow = true;
      head.add(tuft);
    });
    const mustache = new THREE.Group();
    mustache.position.set(0, -0.13, 0.56);
    head.add(mustache);
    parts.mustache = mustache;
    [-1, 1].forEach((side) => {
      const half = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), hairMat);
      half.position.set(side * 0.11, 0, 0);
      half.rotation.z = side * -0.22;
      mustache.add(half);
    });
  }

  if (spec.id === 'momma') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.66, 18, 12), hairMat);
    crown.position.set(0, 0.2, -0.12);
    crown.scale.set(1.04, 0.86, 0.98);
    crown.castShadow = true;
    head.add(crown);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), hairMat);
    bun.position.set(0, 0.62, -0.24);
    bun.castShadow = true;
    head.add(bun);
    [-1, 1].forEach((side) => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 12), trim);
      hoop.position.set(side * 0.58, -0.16, 0);
      hoop.rotation.y = Math.PI / 2;
      head.add(hoop);
    });
  }

  group.scale.setScalar(scale);
  return { group, parts };
}
