import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Roost Rider — bikes, first-person cockpit and dust
 * ------------------------------------------------------------------ */

const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.12,
    ...options,
  });

function segment(from, to, radius, mat) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const length = direction.length();

  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 4, 8),
    mat
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  mesh.castShadow = false;
  return mesh;
}

function numberPlate(number, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f2e6';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 238, 238);
  ctx.fillStyle = '#17181d';
  ctx.font = '900 150px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ bike */

export function createRiderBike({ primary, secondary, helmet, number }) {
  const group = new THREE.Group();
  const lean = new THREE.Group();
  group.add(lean);

  const tyreMaterial = material(0x141517, { roughness: 0.95, metalness: 0 });
  const rimMaterial = material(0xb6bec7, { roughness: 0.32, metalness: 0.7 });
  const darkMaterial = material(0x24272c, { roughness: 0.6, metalness: 0.35 });
  const bodyMaterial = material(primary, { roughness: 0.42, metalness: 0.25 });
  const accentMaterial = material(secondary, { roughness: 0.45 });
  const helmetMaterial = material(helmet, { roughness: 0.3 });
  const jerseyMaterial = material(helmet, { roughness: 0.8 });
  const gloveMaterial = material(0x2a2c31, { roughness: 0.85 });
  const plateMaterial = new THREE.MeshBasicMaterial({ map: numberPlate(number, secondary) });

  const wheelGeometry = new THREE.TorusGeometry(0.46, 0.12, 8, 18);
  wheelGeometry.rotateY(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.07, 10);
  rimGeometry.rotateZ(Math.PI / 2);
  const spokeGeometry = new THREE.BoxGeometry(0.045, 0.76, 0.045);

  const makeWheel = () => {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(wheelGeometry, tyreMaterial));
    wheel.add(new THREE.Mesh(rimGeometry, rimMaterial));
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(spokeGeometry, rimMaterial);
      spoke.rotation.x = (i * Math.PI) / 4;
      wheel.add(spoke);
    }
    return wheel;
  };

  const frontWheel = makeWheel();
  frontWheel.position.set(0, 0.48, 0.92);
  lean.add(frontWheel);

  const rearWheel = makeWheel();
  rearWheel.position.set(0, 0.48, -0.92);
  lean.add(rearWheel);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1.15), darkMaterial);
  frame.position.set(0, 0.82, 0);
  frame.rotation.x = -0.08;
  lean.add(frame);

  const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), darkMaterial);
  swingarm.position.set(0, 0.58, -0.5);
  lean.add(swingarm);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.46), darkMaterial);
  engine.position.set(0, 0.72, 0.02);
  lean.add(engine);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 8), rimMaterial);
  exhaust.position.set(0.2, 0.86, -0.55);
  exhaust.rotation.x = Math.PI / 2 - 0.12;
  lean.add(exhaust);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.56), bodyMaterial);
  tank.position.set(0, 1.04, 0.18);
  tank.rotation.x = -0.08;
  lean.add(tank);

  const shroudLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.5), bodyMaterial);
  shroudLeft.position.set(0.22, 0.96, 0.22);
  shroudLeft.rotation.z = 0.14;
  lean.add(shroudLeft);

  const shroudRight = shroudLeft.clone();
  shroudRight.position.x = -0.22;
  shroudRight.rotation.z = -0.14;
  lean.add(shroudRight);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.62), darkMaterial);
  seat.position.set(0, 1.15, -0.44);
  lean.add(seat);

  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), bodyMaterial);
  rearFender.position.set(0, 1.16, -0.82);
  rearFender.rotation.x = 0.1;
  lean.add(rearFender);

  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.62), bodyMaterial);
  frontFender.position.set(0, 0.98, 0.84);
  frontFender.rotation.x = 0.12;
  lean.add(frontFender);

  for (const side of [-1, 1]) {
    const fork = segment(
      [side * 0.12, 1.0, 0.68],
      [side * 0.12, 0.52, 0.92],
      0.035,
      rimMaterial
    );
    lean.add(fork);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), darkMaterial);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(side * 0.32, 1.34, 0.55);
    lean.add(grip);
  }

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.66, 8), rimMaterial);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.34, 0.55);
  lean.add(handlebar);

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.32), plateMaterial);
  plate.position.set(0, 1.06, 0.92);
  plate.rotation.x = -0.08;
  lean.add(plate);

  const jersey = material(helmet, { roughness: 0.85 });
  const pants = material(0x2d3340, { roughness: 0.9 });

  lean.add(segment([0, 1.14, -0.3], [0, 1.58, 0.06], 0.21, jersey));

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), helmetMaterial);
  head.position.set(0, 1.82, 0.18);
  lean.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14), darkMaterial);
  visor.position.set(0, 1.83, 0.34);
  visor.rotation.x = 0.15;
  lean.add(visor);

  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), helmetMaterial);
  chin.position.set(0, 1.72, 0.3);
  lean.add(chin);

  for (const side of [-1, 1]) {
    const arm = segment(
      [side * 0.2, 1.52, 0.06],
      [side * 0.3, 1.35, 0.52],
      0.07,
      jersey
    );
    lean.add(arm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.16), gloveMaterial);
    glove.position.set(side * 0.32, 1.34, 0.55);
    lean.add(glove);

    const thigh = segment(
      [side * 0.17, 1.12, -0.26],
      [side * 0.25, 0.84, 0.14],
      0.1,
      pants
    );
    lean.add(thigh);

    const shin = segment(
      [side * 0.25, 0.84, 0.14],
      [side * 0.25, 0.62, 0.0],
      0.08,
      pants
    );
    lean.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.28), darkMaterial);
    boot.position.set(side * 0.25, 0.58, 0.02);
    lean.add(boot);
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.56), accentMaterial);
  stripe.position.set(0, 1.2, 0.18);
  lean.add(stripe);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  group.userData = {
    lean,
    frontWheel,
    rearWheel,
    wheels: [frontWheel, rearWheel],
  };

  return group;
}

/* --------------------------------------------------------------- cockpit */

export function createCockpit({ primary = '#e23c2f', secondary = '#ffd93d' } = {}) {
  const root = new THREE.Group();

  const barMaterial = material(0xbfc7cf, { roughness: 0.3, metalness: 0.75 });
  const darkMaterial = material(0x22252a, { roughness: 0.7 });
  const bodyMaterial = material(primary, { roughness: 0.4, metalness: 0.15 });
  const accentMaterial = material(secondary, { roughness: 0.4 });
  const gloveMaterial = material(0x3a4048, { roughness: 0.9 });
  const alloyMaterial = material(0x8d949c, { roughness: 0.35, metalness: 0.6 });

  /* handlebars and hands, a little over a metre from the rider's eye */
  const bars = new THREE.Group();
  bars.position.set(0, -0.44, -1.1);
  root.add(bars);

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.74, 8), barMaterial);
  bar.rotation.z = Math.PI / 2;
  bars.add(bar);

  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.13, 8), darkMaterial);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = side * 0.31;
    bars.add(grip);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), gloveMaterial);
    hand.scale.set(1, 0.8, 1.3);
    hand.position.set(side * 0.31, 0.008, 0.06);
    bars.add(hand);

    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.075), gloveMaterial);
    fingers.position.set(side * 0.305, -0.048, 0.11);
    fingers.rotation.z = side * 0.1;
    bars.add(fingers);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.06), accentMaterial);
    cuff.position.set(side * 0.315, 0.005, -0.045);
    bars.add(cuff);

    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.028), alloyMaterial);
    lever.position.set(side * 0.245, -0.005, 0.02);
    lever.rotation.z = side * 0.14;
    bars.add(lever);

    const sleeve = segment(
      [side * 0.38, -0.8, -0.5],
      [side * 0.31, -0.46, -1.0],
      0.065,
      bodyMaterial
    );
    root.add(sleeve);
  }

  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.13), alloyMaterial);
  clamp.position.set(0, -0.5, -1.08);
  root.add(clamp);

  for (const side of [-1, 1]) {
    const tube = segment(
      [side * 0.105, -0.52, -1.1],
      [side * 0.105, -1.06, -1.68],
      0.03,
      barMaterial
    );
    root.add(tube);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), bodyMaterial);
    guard.position.set(side * 0.18, -0.84, -1.42);
    guard.rotation.z = side * 0.16;
    root.add(guard);
  }

  /* front end: fender and wheel */
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.66), bodyMaterial);
  fender.position.set(0, -0.77, -1.58);
  fender.rotation.x = 0.16;
  root.add(fender);

  const fenderTip = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.035, 0.18), accentMaterial);
  fenderTip.position.set(0, -0.82, -1.89);
  fenderTip.rotation.x = 0.28;
  root.add(fenderTip);

  const frontWheel = new THREE.Group();
  frontWheel.position.set(0, -1.08, -1.78);
  const tyre = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.095, 8, 18),
    material(0x141517, { roughness: 0.95 })
  );
  tyre.geometry.rotateY(Math.PI / 2);
  frontWheel.add(tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), alloyMaterial);
  rim.rotation.z = Math.PI / 2;
  frontWheel.add(rim);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 14), material(0x7d838a));
  disc.rotation.z = Math.PI / 2;
  disc.position.x = 0.06;
  frontWheel.add(disc);
  root.add(frontWheel);

  const brakeLine = segment(
    [-0.27, -0.4, -1.06],
    [-0.2, -0.96, -1.6],
    0.012,
    darkMaterial
  );
  root.add(brakeLine);

  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.24), bodyMaterial);
  shroud.position.set(0, -0.72, -0.82);
  shroud.rotation.x = 0.14;
  root.add(shroud);

  root.userData = { bars, frontWheel, fender };

  return root;
}

/* ------------------------------------------------------------------ dust */

function createDustTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDust() {
  const max = 280;
  const positions = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  const velocities = new Float32Array(max * 3);
  const lives = new Float32Array(max);
  const maxLives = new Float32Array(max);
  const baseSizes = new Float32Array(max);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));

  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { dustMap: { value: createDustTexture() } },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(120.0, aSize * (250.0 / max(1.0, -mv.z)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D dustMap;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(dustMap, gl_PointCoord);
        if (tex.a < 0.01 || vAlpha < 0.01) discard;
        gl_FragColor = vec4(0.76, 0.64, 0.47, tex.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, dustMaterial);
  points.frustumCulled = false;

  let cursor = 0;

  return {
    points,
    spawn(x, y, z, vx, vy, vz, life, size) {
      const index = cursor;
      cursor = (cursor + 1) % max;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
      velocities[index * 3] = vx;
      velocities[index * 3 + 1] = vy;
      velocities[index * 3 + 2] = vz;
      lives[index] = life;
      maxLives[index] = life;
      baseSizes[index] = size;
      sizes[index] = size;
      alphas[index] = 0.32;
    },
    update(dt) {
      for (let i = 0; i < max; i += 1) {
        if (lives[i] <= 0) {
          alphas[i] = 0;
          continue;
        }

        lives[i] -= dt;
        if (lives[i] <= 0) {
          alphas[i] = 0;
          continue;
        }

        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

        velocities[i * 3] *= 1 - dt * 1.4;
        velocities[i * 3 + 1] += dt * 0.7;
        velocities[i * 3 + 2] *= 1 - dt * 1.4;

        sizes[i] = baseSizes[i] * (1 + (1 - lives[i] / maxLives[i]) * 1.5);
        alphas[i] = Math.min(1, lives[i] / maxLives[i]) * 0.3;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
    },
  };
}
