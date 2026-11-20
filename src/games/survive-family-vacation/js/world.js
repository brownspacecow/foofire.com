/* ------------------------------------------------------------------ *
 * World
 * Turns a level's data into a 3D place: ground, landmark, scattered
 * props, collectibles, signs, people, the boss gate and ambient life.
 * ------------------------------------------------------------------ */

import * as THREE from 'three';
import {
  buildLandmark,
  buildProp,
  makeCollectible,
  makeGate,
  makeLabel,
  makePerson,
  makeSign,
  makeTunnel,
  animateCharacter,
} from './models.js?v=2';

export const LANDMARK_OFFSET = -4;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function buildGround(scene, level, bounds) {
  const palette = level.palette ?? {};
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshLambertMaterial({ color: palette.ground ?? '#7f9440', flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // A slightly darker path leading in from the bottom of the map.
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 30),
    new THREE.MeshLambertMaterial({ color: palette.groundAlt ?? '#76883f' })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 8);
  scene.add(path);

  const rng = seededRandom(7);
  const patchMaterial = new THREE.MeshLambertMaterial({
    color: palette.groundAlt ?? '#76883f',
    transparent: true,
    opacity: 0.55,
  });
  for (let i = 0; i < 26; i += 1) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.6 + rng() * 3.2, 9), patchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      bounds.minX + rng() * (bounds.maxX - bounds.minX),
      0.015,
      bounds.minZ + rng() * (bounds.maxZ - bounds.minZ)
    );
    scene.add(patch);
  }

  // Soft hills on the horizon so the world does not end in fog.
  const hillMaterial = new THREE.MeshLambertMaterial({ color: palette.fog ?? '#cfe6ef', flatShading: true });
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(9 + rng() * 6, 8 + rng() * 9, 6), hillMaterial);
    hill.position.set(Math.sin(angle) * 44, 2.4, Math.cos(angle) * 44);
    hill.rotation.y = rng() * Math.PI;
    scene.add(hill);
  }
}

function buildSky(scene, level, reducedMotion) {
  const palette = level.palette ?? {};
  scene.background = new THREE.Color(palette.sky ?? '#8fc7ff');
  scene.fog = new THREE.FogExp2(palette.fog ?? '#cfe6ef', palette.fogDensity ?? 0.016);

  const sky = new THREE.Group();
  scene.add(sky);

  if (palette.night) {
    const count = 380;
    const positions = new Float32Array(count * 3);
    const rng = seededRandom(21);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 26 + rng() * 34;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 14 + rng() * 26;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: '#fff4d8', size: 0.55, transparent: true, opacity: 0.9, sizeAttenuation: true })
    );
    sky.add(stars);
    sky.userData.stars = stars;

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#fff2cf' })
    );
    moon.position.set(-26, 24, -34);
    sky.add(moon);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0.16 })
    );
    halo.position.copy(moon.position);
    sky.add(halo);
  } else {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 14, 10),
      new THREE.MeshBasicMaterial({ color: palette.sun ?? '#ffe9b0' })
    );
    sun.position.set(20, 27, -38);
    sky.add(sun);

    const rng = seededRandom(33);
    const clouds = new THREE.Group();
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: '#fff6e6', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 7; i += 1) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.8 + rng() * 1.8, 8, 6), cloudMaterial);
        puff.position.set(p * 2.2 - puffs, rng() * 0.8, rng() * 1.6);
        cloud.add(puff);
      }
      cloud.position.set(-34 + rng() * 68, 20 + rng() * 8, -34 + rng() * 30);
      clouds.add(cloud);
    }
    sky.add(clouds);
    sky.userData.clouds = clouds;
  }

  if (!reducedMotion) {
    const rng = seededRandom(45);
    const count = palette.night ? 42 : 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -20 + rng() * 40;
      positions[i * 3 + 1] = 0.6 + rng() * 3.4;
      positions[i * 3 + 2] = -18 + rng() * 36;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparks = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: palette.night ? '#ffe9a8' : '#fff8ec',
        size: 0.22,
        transparent: true,
        opacity: 0.8,
      })
    );
    sky.add(sparks);
    sky.userData.sparks = sparks;
  }

  return sky;
}

export function buildWorld({ level, objects, luck, reducedMotion = false }) {
  const scene = new THREE.Scene();
  const bounds = level.bounds ?? { minX: -21, maxX: 21, minZ: -19, maxZ: 19 };
  const palette = level.palette ?? {};
  const colliders = [];
  const interactables = [];
  const crowd = [];

  buildGround(scene, level, bounds);
  const sky = buildSky(scene, level, reducedMotion);

  const hemi = new THREE.HemisphereLight(palette.night ? '#8fa8ff' : '#fff3d0', palette.ground ?? '#5c6b3a', palette.night ? 0.75 : 1.05);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffffff', palette.night ? 0.32 : 0.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(palette.sun ?? '#ffe9b0', palette.night ? 0.85 : 1.25);
  sun.position.set(16, 24, 12);
  scene.add(sun);

  // Landmark
  const landmark = buildLandmark(level.landmark);
  landmark.position.set(0, 0, LANDMARK_OFFSET);
  scene.add(landmark);
  (landmark.userData.colliders ?? []).forEach((collider) => {
    colliders.push({ x: collider.x, z: collider.z + LANDMARK_OFFSET, r: collider.r });
  });

  // Scattered everyday props.
  const rng = seededRandom(level.decor?.seed ?? 7);
  const decorTypes = level.decor?.types ?? ['pine', 'rock'];
  const count = level.decor?.count ?? 24;
  const blocked = [
    ...colliders,
    ...objects.map((object) => ({ x: object.x, z: object.z, r: 2 })),
    { x: 0, z: 0, r: 3.4 },
    { x: level.gate?.x ?? 0, z: level.gate?.z ?? -4, r: 4 },
  ];

  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 14) {
    attempts += 1;
    const x = bounds.minX + 2 + rng() * (bounds.maxX - bounds.minX - 4);
    const z = bounds.minZ + 2 + rng() * (bounds.maxZ - bounds.minZ - 4);
    const type = decorTypes[Math.floor(rng() * decorTypes.length)];
    const probe = buildProp(type, rng);
    const radius = probe.userData.collider ?? 0.6;
    const clash = blocked.some((entry) => distance(x, z, entry.x, entry.z) < radius + entry.r + 0.9);
    if (clash || Math.abs(x) < 4.5) {
      probe.traverse((child) => child.geometry?.dispose());
      continue;
    }

    probe.position.set(x, 0, z);
    scene.add(probe);
    placed += 1;

    if (probe.userData.collider) {
      colliders.push({ x, z, r: probe.userData.collider * 0.8 });
      blocked.push({ x, z, r: probe.userData.collider });
    }
  }

  // Boss gate, in front of the landmark.
  const gatePoint = level.gate ?? { x: 0, z: -4, radius: 3.1 };
  const gate = makeGate(level.boss?.name ?? 'The Way On');
  gate.position.set(gatePoint.x, 0, gatePoint.z);
  scene.add(gate);
  interactables.push({
    kind: 'gate',
    id: 'gate',
    group: gate,
    x: gatePoint.x,
    z: gatePoint.z,
    radius: gatePoint.radius ?? 3.1,
    label: 'Face the boss',
  });

  const addMarker = (group, text) => {
    const label = makeLabel(text, {
      size: 38,
      fill: '#fff8ec',
      background: 'rgba(42, 32, 56, 0.86)',
    });
    label.scale.set(2.4, 0.96, 1);
    label.position.set(0, 2.75, 0);
    group.add(label);
    return label;
  };

  objects.forEach((object) => {
    let group = null;
    let radius = 2.4;
    let label = null;

    if (object.kind === 'memory' || object.kind === 'clue' || object.kind === 'secret') {
      group = makeCollectible({ emoji: object.emoji, kind: object.kind });
      label = addMarker(group, object.name);
      radius = object.kind === 'secret' ? 2.2 : 2.5;
    } else if (object.kind === 'sign') {
      group = makeSign(object.text);
      radius = 2.2;
    } else if (object.kind === 'person') {
      group = makePerson(object.emoji, null);
      crowd.push(group);
      radius = 2.6;
    } else if (object.kind === 'tunnel') {
      group = makeTunnel();
      radius = 2;
    }

    if (!group) return;

    group.position.set(object.x, 0, object.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);

    const hidden = Boolean(object.hidden);
    if (hidden) group.visible = false;

    interactables.push({
      ...object,
      group,
      radius,
      hidden,
      label,
      collected: false,
      levelId: level.id,
    });

    if (group.userData.collider) {
      colliders.push({ x: object.x, z: object.z, r: group.userData.collider });
    }
  });

  const focus = { x: 0, y: 3.4, z: -9 };

  const setGateReady = (ready) => {
    gate.traverse((child) => {
      if (child.material && child.material.color && child.geometry?.type === 'TorusGeometry') {
        child.material.color.set(ready ? '#7dffb0' : '#ff2e63');
      }
    });
  };

  let ambientTime = 0;

  const update = (dt, ctx) => {
    ambientTime += dt;
    const { playerPos, investigating, camera } = ctx;

    // Collectible bob and spin.
    interactables.forEach((entry) => {
      if (!entry.group?.userData?.bob) return;
      const bob = Math.sin(ambientTime * 2 + entry.x) * 0.12;
      entry.group.position.y = bob + 0.05;
      entry.group.rotation.y += dt * (entry.group.userData.spin ?? 0.9);

      if (entry.hidden) entry.group.visible = Boolean(investigating) && !entry.collected;

      if (entry.group.visible && entry.label) {
        const near = distance(playerPos.x, playerPos.z, entry.x, entry.z) < 8;
        entry.label.material.opacity = near
          ? Math.min(1, entry.label.material.opacity + dt * 4)
          : Math.max(0, entry.label.material.opacity - dt * 4);
        entry.label.visible = entry.label.material.opacity > 0.02;
      }
    });

    // Idle people.
    crowd.forEach((person, index) => {
      animateCharacter(person, ambientTime + index * 1.7, 0.25);
      person.rotation.y = Math.sin(ambientTime * 0.5 + index) * 0.5;
    });

    // Gate breathing.
    gate.children.forEach((child) => {
      if (child.isSprite) {
        child.material.opacity = 0.82 + Math.sin(ambientTime * 2.2) * 0.16;
      }
    });

    // Sky life.
    if (sky.userData.clouds) {
      sky.userData.clouds.children.forEach((cloud, index) => {
        cloud.position.x += dt * (0.16 + index * 0.03);
        if (cloud.position.x > 40) cloud.position.x = -40;
      });
    }
    if (sky.userData.sparks) {
      const attribute = sky.userData.sparks.geometry.getAttribute('position');
      for (let i = 0; i < attribute.count; i += 1) {
        attribute.setY(i, 0.6 + ((Math.sin(ambientTime * 0.8 + i) + 1) / 2) * 3.4);
      }
      attribute.needsUpdate = true;
    }
    if (sky.userData.stars) {
      sky.userData.stars.rotation.y += dt * 0.004;
    }

    if (camera) {
      // Keep the shadow-free world readable by nudging a rim light toward the player.
      sun.position.set(playerPos.x + 16, 24, playerPos.z + 12);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      sun.target.updateMatrixWorld();
    }
  };

  return {
    scene,
    sky,
    colliders,
    interactables,
    gate,
    focus,
    bounds,
    setGateReady,
    update,
    landmark,
  };
}
