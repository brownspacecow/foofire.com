import * as THREE from 'three';

// The launch is a short, skippable cartoon: countdown, liftoff, a quick flight
// across town, a confetti explosion, and the tree standing in the crater.

const DURATIONS = {
  countdown: 2.8,
  liftoff: 2.5,
  travel: 2.6,
  impact: 2.4,
  settle: 2.4,
};
const REDUCED_FACTOR = 0.55;

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function easeIn(t) {
  return t * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function makeBurstSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = 'bold 120px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#0a0518';
  ctx.strokeText(text, 512, 266);
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 266);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.6, 2.3, 1);
  sprite.userData.life = 2.6;
  return sprite;
}

export function createCutscene({ town, landmark, reducedMotion = false, onEvent = () => {}, onComplete = () => {} }) {
  const scene = town.scene;
  const camera = town.camera;
  const tree = town.treeGroup;
  const ornamentLayer = town.ornamentLayer;

  const factor = reducedMotion ? REDUCED_FACTOR : 1;
  const durations = Object.fromEntries(
    Object.entries(DURATIONS).map(([phase, value]) => [phase, value * factor])
  );
  const phases = Object.keys(durations);

  const target = new THREE.Vector3(landmark.x, 0, landmark.z);
  const targetCenter = new THREE.Vector3(landmark.x, 2.2, landmark.z);
  const startCamera = camera.position.clone();
  const startLook = new THREE.Vector3(0, 3.1, 0);

  let phaseIndex = 0;
  let phaseTime = 0;
  let elapsed = 0;
  let done = false;
  let skipped = false;
  let exploded = false;
  let buildingHidden = false;
  let treeHidden = false;
  let lastCountdown = 4;

  const effects = new THREE.Group();
  scene.add(effects);

  // -------------------------------------------------------------- effects
  const flame = new THREE.Group();
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a00', transparent: true, opacity: 0.9 });
  const flameCore = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 1 });
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.4, 12), flameMaterial);
  outerFlame.rotation.x = Math.PI;
  outerFlame.position.y = -1.6;
  flame.add(outerFlame);
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.1, 10), flameCore);
  innerFlame.rotation.x = Math.PI;
  innerFlame.position.y = -1.1;
  flame.add(innerFlame);
  flame.visible = false;
  effects.add(flame);

  const flashMaterial = new THREE.MeshBasicMaterial({
    color: '#fff3b0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), flashMaterial);
  flash.visible = false;
  effects.add(flash);

  const crater = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 32),
    new THREE.MeshStandardMaterial({ color: '#3a2a24', roughness: 0.95 })
  );
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(target.x, 0.03, target.z);
  crater.visible = false;
  effects.add(crater);

  const debrisMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const debris = [];
  const burstColors = [landmark.color, landmark.roof, landmark.accent, '#fff4ea', '#ffd93d'];

  function spawnDebris() {
    const count = reducedMotion ? 10 : 24;
    for (let i = 0; i < count; i += 1) {
      const size = 0.18 + Math.random() * 0.45;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), debrisMaterial.clone());
      mesh.material.color.set(burstColors[i % burstColors.length]);
      mesh.position.set(
        target.x + (Math.random() - 0.5) * 3,
        1 + Math.random() * 3,
        target.z + (Math.random() - 0.5) * 3
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      effects.add(mesh);
      debris.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          3 + Math.random() * 7,
          (Math.random() - 0.5) * 7
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        ),
        life: 0,
      });
    }
  }

  const particleCount = reducedMotion ? 60 : 170;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = [];
  const particleColors = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: reducedMotion ? 0.18 : 0.26,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.visible = false;
  effects.add(particles);

  function spawnParticles() {
    const ornamentColors = ornamentLayer.children
      .map((child) => child.userData.entry?.color)
      .filter(Boolean);
    const palette = [...burstColors, ...ornamentColors, '#ff5d8f', '#2ec4ff', '#3ddc84', '#ffffff'];
    const color = new THREE.Color();
    for (let i = 0; i < particleCount; i += 1) {
      particlePositions[i * 3] = target.x + (Math.random() - 0.5) * 2;
      particlePositions[i * 3 + 1] = 2 + Math.random() * 2;
      particlePositions[i * 3 + 2] = target.z + (Math.random() - 0.5) * 2;
      const theta = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particleVelocities[i] = new THREE.Vector3(
        Math.cos(theta) * speed,
        3 + Math.random() * 8,
        Math.sin(theta) * speed
      );
      color.set(palette[i % palette.length]);
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particles.visible = true;
  }

  let burstSprite = null;
  function showBurstSprite() {
    burstSprite = makeBurstSprite('KABOOM!', '#ffd93d');
    if (!burstSprite) return;
    burstSprite.position.set(target.x, 4.1, target.z);
    effects.add(burstSprite);
  }

  function triggerExplosion() {
    if (exploded) return;
    exploded = true;
    town.destroyLandmark(landmark.id);
    buildingHidden = true;
    spawnDebris();
    spawnParticles();
    showBurstSprite();
    flash.visible = true;
    flash.position.set(target.x, 2.4, target.z);
    flash.scale.setScalar(0.2);
    flashMaterial.opacity = 0.9;
    crater.visible = true;
    onEvent({ type: 'impact' });
  }

  // ------------------------------------------------------------ animation
  function setCountdownHud() {
    const remaining = Math.max(0, durations.countdown - phaseTime);
    const value = Math.ceil(remaining / (durations.countdown / 3));
    if (value !== lastCountdown) {
      lastCountdown = value;
      onEvent({ type: 'countdown', value: Math.min(3, Math.max(1, value)) });
    }
  }

  function updateCountdown(dt) {
    setCountdownHud();
    const p = Math.min(1, phaseTime / durations.countdown);
    const shake = reducedMotion ? 0 : 0.06 * p;
    tree.position.x = Math.sin(elapsed * 42) * shake;
    tree.position.z = Math.cos(elapsed * 37) * shake;
    tree.rotation.z = Math.sin(elapsed * 11) * 0.012 * p;

    const from = startCamera;
    const to = new THREE.Vector3(7.6, 3.2, 10.2);
    camera.position.lerpVectors(from, to, easeInOut(p));
    camera.lookAt(0, 3.1 + p * 0.7, 0);
  }

  function updateLiftoff(dt) {
    const p = Math.min(1, phaseTime / durations.liftoff);
    tree.position.x = 0;
    tree.position.z = 0;
    tree.position.y = easeIn(p) * 24;
    tree.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 8) * 0.03;
    flame.visible = true;
    flame.position.set(0, tree.position.y - 0.4, 0);
    const flamePulse = 0.82 + Math.sin(elapsed * 30) * 0.18;
    flame.scale.set(flamePulse, 0.75 + p * 0.7, flamePulse);
    camera.position.set(10.5, 8 + tree.position.y * 0.32, 11.5);
    camera.lookAt(0, tree.position.y + 2.2, 0);
    if (p > 0.35) ornamentLayer.visible = true;
    if (!reducedMotion && Math.random() < dt * 40) {
      spawnSparkle();
    }
  }

  function updateTravel(dt) {
    const p = Math.min(1, phaseTime / durations.travel);
    const start = new THREE.Vector3(0, 24, 0);
    const end = new THREE.Vector3(target.x, 27, target.z);
    tree.position.lerpVectors(start, end, easeInOut(p));
    flame.position.set(tree.position.x, tree.position.y - 0.4, tree.position.z);
    flame.scale.set(1, 1.1, 1);
    camera.position.set(
      THREE.MathUtils.lerp(10.5, target.x * 0.55 + 8, p),
      THREE.MathUtils.lerp(8, 13, p),
      THREE.MathUtils.lerp(11.5, target.z * 0.55 + 8, p)
    );
    camera.lookAt(tree.position.x, tree.position.y + 1.5, tree.position.z);
    if (!reducedMotion && Math.random() < dt * 25) spawnSparkle();
  }

  function updateImpact(dt) {
    const p = Math.min(1, phaseTime / durations.impact);
    if (p < 0.2) {
      tree.position.y = THREE.MathUtils.lerp(27, 5, easeIn(p / 0.2));
      tree.position.x = target.x;
      tree.position.z = target.z;
      flame.position.set(target.x, tree.position.y - 0.4, target.z);
    }
    if (p > 0.16 && !treeHidden) {
      treeHidden = true;
      tree.visible = false;
      flame.visible = false;
    }
    if (p > 0.3) triggerExplosion();

    const shakeAmount = reducedMotion ? 0 : Math.max(0, 1 - p) * 0.32;
    camera.position.set(
      target.x + 8.5 + Math.sin(elapsed * 31) * shakeAmount,
      5.6 + Math.cos(elapsed * 27) * shakeAmount,
      target.z + 8.5 + Math.sin(elapsed * 23) * shakeAmount
    );
    camera.lookAt(target.x, 2.4, target.z);

    if (exploded) updateExplosionEffects(dt);
  }

  function updateSettle(dt) {
    const p = Math.min(1, phaseTime / durations.settle);
    if (p > 0.08 && !tree.visible) {
      tree.visible = true;
      tree.position.set(target.x, 0, target.z);
      tree.rotation.set(0, 0, 0);
      tree.scale.setScalar(0.72);
      ornamentLayer.visible = true;
    }
    const angle = elapsed * (reducedMotion ? 0.05 : 0.18) + 0.8;
    const radius = 10.5;
    camera.position.set(
      target.x + Math.sin(angle) * radius,
      5.5 + easeOut(p) * 1.5,
      target.z + Math.cos(angle) * radius
    );
    camera.lookAt(target.x, 2.6, target.z);
    updateExplosionEffects(dt);
  }

  function updateExplosionEffects(dt) {
    if (!exploded) return;
    debris.forEach((piece) => {
      piece.life += dt;
      piece.velocity.y -= 16 * dt;
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.mesh.rotation.x += piece.spin.x * dt;
      piece.mesh.rotation.y += piece.spin.y * dt;
      piece.mesh.rotation.z += piece.spin.z * dt;
      if (piece.mesh.position.y < 0.12) {
        piece.mesh.position.y = 0.12;
        piece.velocity.y *= -0.25;
        piece.velocity.x *= 0.7;
        piece.velocity.z *= 0.7;
      }
      if (piece.life > 2.4) piece.mesh.scale.multiplyScalar(0.94);
    });

    const positions = particleGeometry.attributes.position.array;
    for (let i = 0; i < particleCount; i += 1) {
      const velocity = particleVelocities[i];
      if (!velocity) continue;
      velocity.y -= 13 * dt;
      positions[i * 3] += velocity.x * dt;
      positions[i * 3 + 1] += velocity.y * dt;
      positions[i * 3 + 2] += velocity.z * dt;
      if (positions[i * 3 + 1] < 0.1) {
        positions[i * 3 + 1] = 0.1;
        velocity.set(0, 0, 0);
      }
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleMaterial.opacity = Math.max(0, 1 - Math.max(0, phaseTime - 1.1) * 0.9);

    if (flash.visible) {
      flash.scale.multiplyScalar(1 + dt * 7);
      flashMaterial.opacity = Math.max(0, flashMaterial.opacity - dt * 2.2);
      if (flashMaterial.opacity <= 0.01) flash.visible = false;
    }

    if (burstSprite) {
      burstSprite.userData.life -= dt;
      burstSprite.position.y += dt * 0.35;
      burstSprite.material.opacity = Math.max(0, burstSprite.userData.life / 1.6);
      if (burstSprite.userData.life <= 0) {
        effects.remove(burstSprite);
        burstSprite.material.map?.dispose();
        burstSprite.material.dispose();
        burstSprite = null;
      }
    }
  }

  function spawnSparkle() {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 5),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? '#ffd93d' : '#ff8a00' })
    );
    spark.position.set(
      tree.position.x + (Math.random() - 0.5) * 2.4,
      tree.position.y - 0.8 - Math.random() * 1.6,
      tree.position.z + (Math.random() - 0.5) * 2.4
    );
    spark.userData.life = 0.6 + Math.random() * 0.6;
    spark.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      -2 - Math.random() * 2,
      (Math.random() - 0.5) * 1.2
    );
    effects.add(spark);
    sparks.push(spark);
  }
  const sparks = [];

  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.userData.life -= dt;
      spark.position.addScaledVector(spark.userData.velocity, dt);
      spark.scale.multiplyScalar(0.97);
      if (spark.userData.life <= 0) {
        effects.remove(spark);
        spark.geometry.dispose();
        spark.material.dispose();
        sparks.splice(i, 1);
      }
    }
  }

  const handlers = {
    countdown: updateCountdown,
    liftoff: updateLiftoff,
    travel: updateTravel,
    impact: updateImpact,
    settle: updateSettle,
  };

  function finish() {
    if (done) return;
    done = true;
    // Keep the cutscene camera on the landing site while the results paper is
    // open. The game releases it when the paper is closed.
    town.setInteractive(true);
    onComplete({ skipped });
  }

  function update(dt) {
    if (done) return;
    elapsed += dt;
    phaseTime += dt;
    let guard = 0;
    while (phaseTime >= durations[phases[phaseIndex]] && guard < phases.length) {
      phaseTime -= durations[phases[phaseIndex]];
      phaseIndex += 1;
      guard += 1;
      if (phaseIndex >= phases.length) {
        finish();
        return;
      }
      onEvent({ type: 'phase', phase: phases[phaseIndex] });
      if (phases[phaseIndex] === 'liftoff') onEvent({ type: 'liftoff' });
    }
    handlers[phases[phaseIndex]](dt);
    updateSparks(dt);
  }

  function skip() {
    if (done) return;
    skipped = true;
    triggerExplosion();
    finish();
  }

  function cleanup() {
    scene.remove(effects);
    effects.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
      if (node.isSprite) {
        node.material.map?.dispose();
        node.material.dispose();
      }
    });
    debris.length = 0;
    sparks.length = 0;
  }

  town.setInteractive(false);
  town.setCameraLocked(true);
  onEvent({ type: 'phase', phase: 'countdown' });

  return {
    update,
    skip,
    cleanup,
    get done() {
      return done;
    },
    get phase() {
      return phases[phaseIndex];
    },
  };
}
