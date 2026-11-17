import * as THREE from 'three';
import * as RAPIER_NS from '@dimforge/rapier3d-compat';

const RAPIER = RAPIER_NS.default ?? RAPIER_NS;

/* ------------------------------------------------------------------ *
 * Rough Housing — the arena
 * Ten pieces' worth of foam: 10 bases, 10 hinged cushions (two panels
 * posed into a fold), 20 triangle pillows. Whole thing floats over lava.
 * Every piece is a Rapier rigid body so the fort can come down.
 * ------------------------------------------------------------------ */

export const LAVA_Y = -1.4;
export const ZONE = { halfX: 14, halfZ: 11 };

export const PIECE_DEFS = {
  base: { label: 'Base', total: 10, mass: 9, size: [6.6, 0.875, 3.3] },
  cushion: { label: 'Cushion', total: 10, mass: 6, panel: [3.3, 0.55, 3.3], defaultFold: Math.PI / 3 },
  triangle: { label: 'Triangle', total: 20, mass: 2.4, size: [2.6, 1.4, 2.4] },
};

const TAU = Math.PI * 2;

const WEAVE = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2800; i += 1) {
    const v = 205 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.5)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  for (let y = 0; y < 128; y += 5) {
    ctx.fillStyle = 'rgba(40, 20, 70, 0.06)';
    ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 5) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(x, 0, 1, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
})();

const MATERIALS = {
  base: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, map: WEAVE, roughness: 0.95 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0xff2e9a, map: WEAVE, roughness: 0.95 }),
  triangle: new THREE.MeshStandardMaterial({ color: 0x2ec4ff, map: WEAVE, roughness: 0.95 }),
};

export function makePieceVisual(type, fold = 0, overrideMaterial = null) {
  const group = new THREE.Group();
  const material = overrideMaterial || MATERIALS[type];
  const castShadow = !overrideMaterial;

  if (type === 'base') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.875, 3.3), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  if (type === 'cushion') {
    const panelGeometry = new THREE.BoxGeometry(3.3, 0.55, 3.3);
    const panelA = new THREE.Mesh(panelGeometry, material);
    panelA.position.set(-1.65, 0, 0);
    const panelB = new THREE.Mesh(panelGeometry, material);
    panelB.position.set(1.65 * Math.cos(fold), 1.65 * Math.sin(fold), 0);
    panelB.rotation.z = fold;
    [panelA, panelB].forEach((panel) => {
      panel.castShadow = castShadow;
      panel.receiveShadow = true;
      group.add(panel);
    });
    return group;
  }

  const shape = new THREE.Shape();
  shape.moveTo(-1.3, -0.7);
  shape.lineTo(1.3, -0.7);
  shape.lineTo(-1.3, 0.7);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false });
  geometry.translate(0, 0, -1.2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

function lavaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#ff8a00');
  gradient.addColorStop(0.5, '#e11d48');
  gradient.addColorStop(1, '#ff4500');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 320; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 6 + Math.random() * 34;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    const hot = Math.random() > 0.5;
    glow.addColorStop(0, hot ? 'rgba(255, 240, 160, 0.85)' : 'rgba(90, 8, 20, 0.6)');
    glow.addColorStop(1, 'rgba(255, 120, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const QUAT = new THREE.Quaternion();
const EULER = new THREE.Euler();

/* Spawn markers: a ring, a soft beam and a P1/P2 tag sitting on the piece
 * each wrestler will start on. Only shown while the fort is being built. */
function spawnLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 96);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 58px "Press Start 2P", "Courier New", monospace';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(20, 10, 36, 0.92)';
  ctx.strokeText(text, 64, 50);
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  );
  sprite.scale.set(1.6, 1.2, 1);
  return sprite;
}

function makeSpawnMarker(index) {
  const color = index === 0 ? 0xff2e63 : 0x2ec4ff;
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.09, 8, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  );
  beam.position.y = 1.14;
  group.add(beam);
  const label = spawnLabel(index === 0 ? 'P1' : 'P2', index === 0 ? '#ff2e63' : '#2ec4ff');
  label.position.y = 2.6;
  group.add(label);
  group.visible = false;
  return { group, ring, beam, label };
}

export class Arena {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pieces = [];
    this.root = new THREE.Group();
    scene.add(this.root);

    this.lavaTexture = lavaTexture();
    const lava = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshBasicMaterial({ map: this.lavaTexture, color: 0xffa060 })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = LAVA_Y;
    scene.add(lava);
    this.lava = lava;

    /*
     * An invisible shelf under the build zone. It only collides with foam
     * pieces (collision group 2), never with wrestlers (group 1), so the fort
     * can sit in mid-air over the lava while a knocked-off wrestler drops
     * straight past it and into the soup.
     */
    const shelfBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.15, 0)
    );
    this.shelfCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(ZONE.halfX, 0.15, ZONE.halfZ)
        .setFriction(0.95)
        .setCollisionGroups((4 << 16) | 2),
      shelfBody
    );

    this.grid = new THREE.GridHelper(ZONE.halfX * 2, ZONE.halfX * 2, 0xc4b5fd, 0x7c3aed);
    this.grid.scale.z = ZONE.halfZ / ZONE.halfX;
    this.grid.position.y = 0.02;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.3;
    this.grid.material.depthWrite = false;
    scene.add(this.grid);

    const borderPoints = [
      new THREE.Vector3(-ZONE.halfX, 0.04, -ZONE.halfZ),
      new THREE.Vector3(ZONE.halfX, 0.04, -ZONE.halfZ),
      new THREE.Vector3(ZONE.halfX, 0.04, ZONE.halfZ),
      new THREE.Vector3(-ZONE.halfX, 0.04, ZONE.halfZ),
    ];
    this.border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(borderPoints),
      new THREE.LineBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.55 })
    );
    scene.add(this.border);

    this.markerRoot = new THREE.Group();
    this.markerRoot.visible = false;
    scene.add(this.markerRoot);
    this.spawnMarkers = [makeSpawnMarker(0), makeSpawnMarker(1)];
    this.spawnMarkers.forEach((marker) => this.markerRoot.add(marker.group));
  }

  setGridVisible(visible) {
    this.grid.visible = visible;
    this.border.visible = visible;
  }

  counts() {
    const counts = { base: 0, cushion: 0, triangle: 0 };
    for (const piece of this.pieces) counts[piece.type] += 1;
    return counts;
  }

  place(type, pose) {
    const def = PIECE_DEFS[type];
    QUAT.setFromEuler(EULER.set(pose.pitch || 0, pose.yaw || 0, pose.roll || 0, 'YXZ'));

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pose.x, pose.y, pose.z)
      .setRotation({ x: QUAT.x, y: QUAT.y, z: QUAT.z, w: QUAT.w })
      .setLinearDamping(0.08)
      .setAngularDamping(0.45)
      .setCcdEnabled(true);
    const body = this.world.createRigidBody(bodyDesc);

    const colliders = [];
    const common = (desc, mass) =>
      this.world.createCollider(
        desc
          .setMass(mass)
          .setFriction(0.92)
          .setRestitution(0.02)
          .setCollisionGroups((2 << 16) | 7),
        body
      );

    if (type === 'base') {
      const [w, h, d] = def.size;
      colliders.push(common(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), def.mass));
    } else if (type === 'cushion') {
      const [w, h, d] = def.panel;
      const hx = w / 2;
      const hy = h / 2;
      const hz = d / 2;
      const fold = pose.fold || 0;
      colliders.push(
        common(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(-hx, 0, 0),
          def.mass / 2
        )
      );
      const hinge = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fold);
      colliders.push(
        common(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz)
            .setTranslation(hx * Math.cos(fold), hx * Math.sin(fold), 0)
            .setRotation({ x: hinge.x, y: hinge.y, z: hinge.z, w: hinge.w }),
          def.mass / 2
        )
      );
    } else {
      const verts = new Float32Array([
        -1.3, -0.7, -1.2, 1.3, -0.7, -1.2, -1.3, 0.7, -1.2,
        -1.3, -0.7, 1.2, 1.3, -0.7, 1.2, -1.3, 0.7, 1.2,
      ]);
      const hull = RAPIER.ColliderDesc.convexHull(verts);
      colliders.push(common(hull || RAPIER.ColliderDesc.cuboid(1.3, 0.7, 1.2), def.mass));
    }

    const visual = makePieceVisual(type, pose.fold || 0);
    visual.position.set(pose.x, pose.y, pose.z);
    visual.quaternion.copy(QUAT);
    this.root.add(visual);

    const piece = {
      type,
      body,
      colliders,
      visual,
      box: new THREE.Box3(),
      pose: { ...pose },
    };
    visual.userData.piece = piece;
    this.pieces.push(piece);
    this.syncPiece(piece);
    return piece;
  }

  syncPiece(piece) {
    const t = piece.body.translation();
    const r = piece.body.rotation();
    piece.visual.position.set(t.x, t.y, t.z);
    piece.visual.quaternion.set(r.x, r.y, r.z, r.w);
    piece.visual.updateMatrixWorld(true);
    piece.box.setFromObject(piece.visual);
  }

  sync() {
    for (const piece of this.pieces) this.syncPiece(piece);
  }

  remove(piece) {
    const index = this.pieces.indexOf(piece);
    if (index >= 0) this.pieces.splice(index, 1);
    this.root.remove(piece.visual);
    this.world.removeRigidBody(piece.body);
  }

  clear() {
    for (const piece of [...this.pieces]) this.remove(piece);
  }

  supportY(box) {
    let top = 0;
    for (const piece of this.pieces) {
      const b = piece.box;
      if (b.max.x <= box.min.x + 0.05 || b.min.x >= box.max.x - 0.05) continue;
      if (b.max.z <= box.min.z + 0.05 || b.min.z >= box.max.z - 0.05) continue;
      if (b.max.y > top) top = b.max.y;
    }
    return top;
  }

  overlaps(box) {
    const test = box.clone().expandByScalar(-0.04);
    return this.pieces.some((piece) => piece.box.intersectsBox(test));
  }

  pruneFallen() {
    let removed = 0;
    for (const piece of [...this.pieces]) {
      const t = piece.body.translation();
      if (t.y < LAVA_Y - 1.2 || Math.abs(t.x) > 80 || Math.abs(t.z) > 80) {
        this.remove(piece);
        removed += 1;
      }
    }
    return removed;
  }

  spawnCandidates() {
    const raw = this.pieces.map((piece) => {
      const box = piece.box;
      return {
        x: (box.min.x + box.max.x) / 2,
        z: (box.min.z + box.max.z) / 2,
        top: box.max.y,
        bottom: box.min.y,
        width: box.max.x - box.min.x,
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z,
      };
    });
    // A piece with another one resting on it is not a usable surface.
    const usable = raw.filter(
      (spot) =>
        !raw.some((other) => {
          if (other === spot) return false;
          if (other.top <= spot.top + 0.15) return false;
          if (other.bottom > spot.top + 0.35) return false;
          const overlapX =
            Math.min(spot.maxX, other.maxX) - Math.max(spot.minX, other.minX);
          const overlapZ =
            Math.min(spot.maxZ, other.maxZ) - Math.max(spot.minZ, other.minZ);
          return overlapX > 0.3 && overlapZ > 0.3;
        })
    );
    return usable.length ? usable : raw;
  }

  spawnPair(first, second) {
    const point = (spot, other, index) => {
      const offset = Math.min(1.5, Math.max(0.75, spot.width * 0.23));
      let dir = Math.sign(spot.x - other.x);
      if (!dir) dir = index === 0 ? -1 : 1;
      // Stay on the piece even when it is narrower than the normal offset.
      const room = Math.max(0, (spot.maxX - spot.minX) / 2 - 0.55);
      const shift = Math.min(offset, room);
      return {
        x: spot.x + dir * shift,
        z: spot.z,
        top: spot.top,
        width: spot.width,
      };
    };
    return [point(first, second, 0), point(second, first, 1)];
  }

  pickSpawnSpots(spots) {
    if (!spots.length) return null;
    let first = null;
    let second = null;
    let best = Infinity;
    for (let i = 0; i < spots.length; i += 1) {
      for (let j = i + 1; j < spots.length; j += 1) {
        const a = spots[i];
        const b = spots[j];
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        if (distance < 2.6) continue;
        const heightGap = Math.abs(a.top - b.top);
        if (heightGap > 2.5) continue;
        // Matching heights first, then as much clear space as possible, so
        // neither wrestler starts on the tall side of the fort.
        const score = heightGap * 8 - Math.min(distance, 14);
        if (score < best) {
          best = score;
          first = a;
          second = b;
        }
      }
    }
    if (!first) {
      const sorted = [...spots].sort((a, b) => b.top - a.top);
      first = sorted[0];
      second = sorted[1] || sorted[0];
    }
    return this.spawnPair(first, second);
  }

  updateSpawnMarkers(visible) {
    const show = Boolean(visible) && this.pieces.length > 0;
    this.markerRoot.visible = show;
    if (!show) return;
    const spots = this.pickSpawnSpots(this.spawnCandidates());
    if (!spots) {
      this.markerRoot.visible = false;
      return;
    }
    spots.forEach((spot, index) => {
      const marker = this.spawnMarkers[index];
      if (!marker) return;
      marker.group.visible = true;
      marker.group.position.set(spot.x, spot.top + 0.06, spot.z);
      const ringScale = Math.min(1.3, Math.max(0.7, spot.width * 0.2));
      marker.ring.scale.setScalar(ringScale);
      marker.beam.position.y = 1.14 + ringScale * 0.2;
      marker.label.position.y = 2.6;
    });
  }

  spawnPoints() {
    this.sync();
    return this.pickSpawnSpots(this.spawnCandidates());
  }
}
