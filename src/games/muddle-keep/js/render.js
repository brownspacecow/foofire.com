/* ------------------------------------------------------------------ *
 * Renderer
 * The three.js scene: instanced terrain, room tinting, task markers,
 * the Dungeon Heart, portal, hero gate and the tile cursor. Terrain is
 * rebuilt only when the grid changes, never per frame.
 * ------------------------------------------------------------------ */

import * as THREE from '../../../vendor/three.module.js';
import { T } from './tiles.js';

const HEIGHTS = {
  [T.BEDROCK]: 1.5,
  [T.DIRT]: 0.62,
  [T.GOLD]: 0.68,
  [T.DUG]: 0.12,
  [T.FLOOR]: 0.16,
  [T.WATER]: 0.22,
  [T.LAVA]: 0.22,
  [T.WALL]: 1.3,
  [T.DOOR]: 1.1,
};

const COLORS = {
  [T.BEDROCK]: '#241c30',
  [T.DIRT]: '#6e4a2c',
  [T.GOLD]: '#ffd23e',
  [T.DUG]: '#57504f',
  [T.FLOOR]: '#9a9184',
  [T.WATER]: '#2f8fd8',
  [T.LAVA]: '#ff6a2a',
  [T.WALL]: '#7d7789',
  [T.DOOR]: '#8a5a34',
};

const TASK_COLORS = {
  dig: '#f2c14e',
  mine: '#ffe08a',
  wall: '#c9c3d6',
};

function stoneTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9c4bb';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i += 1) {
    const shade = 140 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 14}, 0.7)`;
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = Math.random() * 3.2 + 0.6;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Darker pebbles and a few cracks so dirt reads as dirt, not flat brown.
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = 'rgba(52, 38, 26, 0.55)';
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 1.8 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(52, 38, 26, 0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function jitterColor(hex, x, y, amount = 0.15) {
  const color = new THREE.Color(hex);
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const noise = (hash - Math.floor(hash)) * amount * 2 - amount;
  color.offsetHSL(0, 0, noise);
  return color;
}

export class Renderer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadows = false;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#120d1c');
    this.scene.fog = new THREE.Fog('#120d1c', 34, 90);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
    this.camera.position.set(14, 20, 26);

    this.hemi = new THREE.HemisphereLight('#d6c8ff', '#3a2830', 1.85);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#ffe4bb', 1.9);
    this.key.position.set(12, 24, 10);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight('#7f8bff', 0.5);
    this.rim.position.set(-14, 12, -12);
    this.scene.add(this.rim);

    this.texture = stoneTexture();
    this.levelGroup = null;
    this.terrain = null;
    this.tint = null;
    this.goldNuggets = null;
    this.markers = null;
    this.instanceTiles = [];
    this.lastVersion = -1;
    this.lastTaskKey = '';
    this.rebuildTimer = 0;
    this.features = {};
    this.quality = 'high';

    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.52, 4),
      new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    );
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.position.y = 0.32;
    this.cursor.renderOrder = 4;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get domElement() {
    return this.renderer.domElement;
  }

  setQuality(quality) {
    this.quality = quality === 'low' ? 'low' : 'high';
    this.renderer.setPixelRatio(
      this.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.key.intensity = this.quality === 'low' ? 1.3 : 1.9;
    if (this.scene.fog) {
      this.scene.fog.near = this.quality === 'low' ? 28 : 34;
      this.scene.fog.far = this.quality === 'low' ? 72 : 90;
    }
    // Real-time shadows on High only: the Low path stays shadow-free for
    // phones. Toggling needs a material refresh, so flag the terrain.
    this.shadows = this.quality === 'high';
    this.renderer.shadowMap.enabled = this.shadows;
    this.key.castShadow = this.shadows;
    if (this.shadows) {
      this.key.shadow.mapSize.set(1024, 1024);
      const c = this.key.shadow.camera;
      c.left = -24; c.right = 24; c.top = 24; c.bottom = -24;
      c.near = 1; c.far = 70;
      this.key.shadow.bias = -0.002;
    }
    if (this.terrain) {
      this.terrain.receiveShadow = this.shadows;
      this.terrain.material.needsUpdate = true;
    }
    this.resize();
  }

  /** World tile coords -> pixels inside the stage element, for HUD floaters. */
  worldToScreen(x, z) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3(x, 0.6, z).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * rect.width,
      y: ((1 - v.y) / 2) * rect.height,
      behind: v.z > 1,
    };
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------- level */

  buildLevel(game) {
    this.clearLevel();
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.bounds = { w: game.world.w, h: game.world.h, cx: game.world.w / 2, cz: game.world.h / 2 };
    this.rebuildTerrain(game);
    this.rebuildMarkers(game);
    this.buildFeatures(game);
    this.lastVersion = game.world.version;
  }

  clearLevel() {
    if (!this.levelGroup) return;
    this.scene.remove(this.levelGroup);
    this.levelGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material.map && material.map !== this.texture) material.map.dispose();
          material.dispose();
        });
      }
    });
    this.levelGroup = null;
    this.terrain = null;
    this.tint = null;
    this.goldNuggets = null;
    this.markers = null;
    this.features = {};
    this.instanceTiles = [];
  }

  rebuildTerrain(game) {
    const world = game.world;
    if (this.terrain) {
      this.levelGroup.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }
    if (this.tint) {
      this.levelGroup.remove(this.tint);
      this.tint.geometry.dispose();
      this.tint.material.dispose();
    }
    if (this.goldNuggets) {
      this.levelGroup.remove(this.goldNuggets);
      this.goldNuggets.geometry.dispose();
      this.goldNuggets.material.dispose();
      this.goldNuggets = null;
    }

    const count = world.tiles.length;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      vertexColors: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    this.instanceTiles = [];

    for (let index = 0; index < count; index += 1) {
      const x = world.xOf(index);
      const y = world.yOf(index);
      const tile = world.tiles[index];
      const height = HEIGHTS[tile] ?? 0.2;
      if (tile === T.BEDROCK) {
        scale.set(1, height, 1);
        position.set(x + 0.5, height / 2, y + 0.5);
      } else {
        scale.set(1, height, 1);
        position.set(x + 0.5, height / 2, y + 0.5);
      }
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(
        index,
        tile === T.GOLD
          ? jitterColor(COLORS[tile], x, y, 0.05)
          : jitterColor(COLORS[tile] ?? '#555', x, y)
      );
      this.instanceTiles.push({ x, y });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = this.shadows;
    mesh.userData.tileMesh = true;
    this.levelGroup.add(mesh);
    this.terrain = mesh;

    // Bright gold nuggets on every seam so gold reads at a glance, even zoomed out.
    const goldTiles = [];
    for (let index = 0; index < count; index += 1) {
      if (world.tiles[index] === T.GOLD) goldTiles.push(index);
    }
    if (goldTiles.length) {
      const nuggetGeometry = new THREE.BoxGeometry(0.22, 0.12, 0.22);
      const nuggetMaterial = new THREE.MeshLambertMaterial({
        color: '#ffe066',
        emissive: '#8a6300',
      });
      const nuggets = new THREE.InstancedMesh(
        nuggetGeometry,
        nuggetMaterial,
        goldTiles.length * 3
      );
      const nuggetMatrix = new THREE.Matrix4();
      const nuggetPos = new THREE.Vector3();
      const nuggetScale = new THREE.Vector3(1, 1, 1);
      const nuggetQuat = new THREE.Quaternion();
      const nuggetEuler = new THREE.Euler();
      goldTiles.forEach((index, slot) => {
        const gx = world.xOf(index);
        const gy = world.yOf(index);
        const hash = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
        const spin = (hash - Math.floor(hash)) * 0.9;
        const spots = [
          [-0.22, -0.18],
          [0.2, 0.05],
          [-0.02, 0.24],
        ];
        spots.forEach(([dx, dz], j) => {
          nuggetEuler.set(0, spin + j * 0.7, 0);
          nuggetQuat.setFromEuler(nuggetEuler);
          nuggetPos.set(gx + 0.5 + dx, HEIGHTS[T.GOLD] + 0.06, gy + 0.5 + dz);
          nuggetMatrix.compose(nuggetPos, nuggetQuat, nuggetScale);
          nuggets.setMatrixAt(slot * 3 + j, nuggetMatrix);
        });
      });
      nuggets.instanceMatrix.needsUpdate = true;
      nuggets.receiveShadow = this.shadows;
      this.levelGroup.add(nuggets);
      this.goldNuggets = nuggets;
    }

    this.buildRoomProps(game);

    // Warm tint over rooms and a cooler wash over floor.
    const floorTiles = [];
    for (let index = 0; index < count; index += 1) {
      const tile = world.tiles[index];
      if (tile === T.FLOOR || tile === T.DUG) floorTiles.push(index);
    }
    if (floorTiles.length) {
      const tintGeometry = new THREE.PlaneGeometry(0.92, 0.92);
      tintGeometry.rotateX(-Math.PI / 2);
      const tintMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const tint = new THREE.InstancedMesh(tintGeometry, tintMaterial, floorTiles.length);
      const tintMatrix = new THREE.Matrix4();
      const tintPos = new THREE.Vector3();
      const tintScale = new THREE.Vector3(1, 1, 1);
      const color = new THREE.Color();
      floorTiles.forEach((index, slot) => {
        const x = world.xOf(index);
        const y = world.yOf(index);
        tintPos.set(x + 0.5, 0.19, y + 0.5);
        tintMatrix.compose(tintPos, quaternion, tintScale);
        tint.setMatrixAt(slot, tintMatrix);
        const roomId = world.rooms[index];
        if (roomId) {
          color.set(game.content.roomById.get(roomId)?.color ?? '#ffffff');
          color.offsetHSL(0, 0, 0.04);
        } else {
          color.set('#d9cdb4');
        }
        tint.setColorAt(slot, color);
      });
      tint.instanceMatrix.needsUpdate = true;
      if (tint.instanceColor) tint.instanceColor.needsUpdate = true;
      tint.renderOrder = 1;
      this.levelGroup.add(tint);
      this.tint = tint;
    }
  }

  /** One readable prop per room cluster: gold piles, beds, mushrooms... */
  buildRoomProps(game) {
    if (this.props) {
      this.levelGroup.remove(this.props);
      this.props.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.props = null;
    }
    const world = game.world;
    const seen = new Set();
    const group = new THREE.Group();
    const lambert = (color) => new THREE.MeshLambertMaterial({ color });
    const box = (mat, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      return m;
    };
    for (let index = 0; index < world.rooms.length; index += 1) {
      const roomId = world.rooms[index];
      if (!roomId || seen.has(index)) continue;
      // Flood-fill this cluster so split rooms get one prop each.
      const tiles = [];
      const stack = [index];
      seen.add(index);
      while (stack.length) {
        const cur = stack.pop();
        tiles.push(cur);
        const cx = world.xOf(cur);
        const cy = world.yOf(cur);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
          const ni = world.idx(nx, ny);
          if (!seen.has(ni) && world.rooms[ni] === roomId) {
            seen.add(ni);
            stack.push(ni);
          }
        }
      }
      let sx = 0;
      let sz = 0;
      for (const ti of tiles) {
        sx += world.xOf(ti) + 0.5;
        sz += world.yOf(ti) + 0.5;
      }
      const cx = sx / tiles.length;
      const cz = sz / tiles.length;
      const y = 0.2;
      if (roomId === 'treasury') {
        const gold = new THREE.MeshLambertMaterial({ color: '#ffcf3f', emissive: '#7a5200' });
        const scale = 1 + Math.min(1.5, tiles.length / 8);
        group.add(box(gold, 0.5 * scale, 0.22, 0.4 * scale, cx, y + 0.11, cz));
        group.add(box(gold, 0.3 * scale, 0.16, 0.26 * scale, cx + 0.18, y + 0.28, cz + 0.08));
        const coin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), gold);
        coin.position.set(cx - 0.22, y + 0.09, cz - 0.12);
        coin.scale.y = 0.6;
        group.add(coin);
      } else if (roomId === 'lair') {
        const sheet = lambert('#f2ead8');
        const wood = lambert('#7a5a3a');
        group.add(box(wood, 0.9, 0.12, 0.5, cx, y + 0.06, cz));
        group.add(box(sheet, 0.84, 0.1, 0.44, cx, y + 0.16, cz));
        group.add(box(sheet, 0.2, 0.12, 0.4, cx - 0.32, y + 0.2, cz));
      } else if (roomId === 'hatchery') {
        const stem = lambert('#f2ead8');
        const cap = lambert('#c94f6d');
        for (const [ox, oz] of [[-0.2, -0.1], [0.18, 0.08], [0, -0.22]]) {
          const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), stem);
          s.position.set(cx + ox, y + 0.1, cz + oz);
          const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 10), cap);
          c.position.set(cx + ox, y + 0.26, cz + oz);
          group.add(s, c);
        }
      } else if (roomId === 'training') {
        const straw = lambert('#d9b36a');
        const post = lambert('#7a5a3a');
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), post);
        pole.position.set(cx, y + 0.35, cz);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 8), straw);
        body.position.set(cx, y + 0.55, cz);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), straw);
        head.position.set(cx, y + 0.85, cz);
        group.add(pole, body, head);
      } else if (roomId === 'library') {
        const colors = ['#4a7fc9', '#c94f4f', '#4a9e5f'];
        colors.forEach((color, i) => {
          group.add(box(lambert(color), 0.34, 0.09, 0.26, cx - 0.12 + i * 0.12, y + 0.05 + i * 0.09, cz));
        });
      } else if (roomId === 'workshop') {
        const iron = lambert('#5a5468');
        group.add(box(iron, 0.5, 0.14, 0.3, cx, y + 0.07, cz));
        group.add(box(iron, 0.34, 0.16, 0.22, cx, y + 0.22, cz));
      }
    }
    if (group.children.length) {
      this.levelGroup.add(group);
      this.props = group;
    }
  }

  rebuildMarkers(game) {
    if (this.markers) {
      this.levelGroup.remove(this.markers);
      this.markers.geometry.dispose();
      this.markers.material.dispose();
      this.markers = null;
    }
    const tasks = [...game.tasks.tasks.values()];
    if (!tasks.length) return;
    const geometry = new THREE.OctahedronGeometry(0.16);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    const mesh = new THREE.InstancedMesh(geometry, material, tasks.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    tasks.forEach((task, index) => {
      position.set(task.x + 0.5, 0.6, task.y + 0.5);
      scale.setScalar(task.blocked ? 0.78 : 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      color.set(task.blocked ? '#b6a273' : TASK_COLORS[task.kind] ?? '#ffffff');
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = 3;
    this.levelGroup.add(mesh);
    this.markers = mesh;
  }

  buildFeatures(game) {
    const world = game.world;
    const heart = new THREE.Group();
    heart.position.set(world.heart.x + 0.5, 0.12, world.heart.y + 0.5);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 0.24, 10),
      new THREE.MeshLambertMaterial({ color: '#4a3d56' })
    );
    pedestal.position.y = 0.12;
    heart.add(pedestal);
    const heartMat = new THREE.MeshStandardMaterial({
      color: '#ff5a7a',
      emissive: '#ff2f5a',
      emissiveIntensity: 1.1,
      roughness: 0.3,
      metalness: 0.1,
    });
    const crystal = new THREE.Group();
    const lobeL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), heartMat);
    lobeL.position.set(-0.2, 0.95, 0);
    lobeL.scale.set(1, 0.9, 0.7);
    const lobeR = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), heartMat);
    lobeR.position.set(0.2, 0.95, 0);
    lobeR.scale.set(1, 0.9, 0.7);
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.55, 4), heartMat);
    point.position.set(0, 0.62, 0);
    point.rotation.x = Math.PI;
    point.rotation.y = Math.PI / 4;
    point.scale.set(1, 1, 0.62);
    crystal.add(lobeL, lobeR, point);
    crystal.position.y = 0.12;
    heart.add(crystal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.05, 8, 22),
      new THREE.MeshStandardMaterial({
        color: '#ffd166',
        emissive: '#c98b1e',
        emissiveIntensity: 0.6,
      })
    );
    ring.position.y = 0.82;
    ring.rotation.x = Math.PI / 2;
    heart.add(ring);
    if (this.quality === 'high') {
      const light = new THREE.PointLight('#ff6b8b', 2.4, 7.5);
      light.position.y = 1.4;
      heart.add(light);
      this.features.heartLight = light;
    }
    this.levelGroup.add(heart);
    this.features.heart = heart;
    this.features.crystal = crystal;
    this.features.heartMat = heartMat;
    this.features.heartRing = ring;
    this.lastHeartHp = world.heart.hp;
    this.heartFlash = 0;

    const portal = new THREE.Group();
    portal.position.set(world.portal.x + 0.5, 0.16, world.portal.y + 0.5);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.14, 14),
      new THREE.MeshLambertMaterial({ color: '#3b2b53' })
    );
    disc.position.y = 0.07;
    portal.add(disc);
    const swirl = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.1, 8, 24),
      new THREE.MeshStandardMaterial({
        color: '#d46ae0',
        emissive: '#8c2fbf',
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.9,
      })
    );
    swirl.position.y = 0.82;
    portal.add(swirl);
    this.features.portalSwirl = swirl;
    this.levelGroup.add(portal);
    this.features.portal = portal;

    const gate = new THREE.Group();
    gate.position.set(world.gate.x + 0.5, 0, world.gate.y + 0.5);
    const stone = new THREE.MeshLambertMaterial({ color: '#8c8aa0' });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.4), stone);
    left.position.set(-0.42, 0.75, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.4), stone);
    right.position.set(0.42, 0.75, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.42), stone);
    top.position.set(0, 1.6, 0);
    gate.add(left, right, top);
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: '#ffd166' })
    );
    flag.position.set(0, 1.88, 0);
    gate.add(flag);
    if (this.quality === 'high') {
      const torch = new THREE.PointLight('#ffb35c', 1.6, 7);
      torch.position.set(0, 2.1, 0);
      gate.add(torch);
      this.features.gateLight = torch;
    }
    this.levelGroup.add(gate);
    this.features.gate = gate;
  }

  /* ------------------------------------------------------------ picking */

  tileAt(clientX, clientY) {
    if (!this.terrain) return null;
    const rect = this.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster = this.raycaster ?? new THREE.Raycaster();
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.terrain, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (hit.instanceId == null) return null;
    return this.instanceTiles[hit.instanceId] ?? null;
  }

  setCursor(tile, valid = true, visible = true) {
    if (!this.cursor) return;
    this.cursor.visible = Boolean(tile && visible);
    if (!tile) return;
    this.cursor.position.set(tile.x + 0.5, 0.34, tile.y + 0.5);
    this.cursor.material.color.set(valid ? '#ffd166' : '#ff5a6e');
  }

  /* ------------------------------------------------------------- update */

  update(dt, game) {
    if (!game || !this.levelGroup) return;
    const world = game.world;
    if (world.version !== this.lastVersion) {
      this.rebuildTimer += dt;
      if (this.rebuildTimer > 0.18) {
        this.rebuildTimer = 0;
        this.rebuildTerrain(game);
        this.lastVersion = world.version;
      }
    } else {
      this.rebuildTimer = 0;
    }

    const taskKey = `${world.version}:${game.tasks.revision}:${game.tasks.size}`;
    if (taskKey !== this.lastTaskKey) {
      this.lastTaskKey = taskKey;
      this.rebuildMarkers(game);
    }

    const time = game.time;
    if (this.features.crystal) {
      const ratio = world.heart.hp / world.heart.maxHp;
      if (this.lastHeartHp != null && world.heart.hp < this.lastHeartHp) {
        this.heartFlash = 0.6;
      }
      this.lastHeartHp = world.heart.hp;
      if (this.heartFlash > 0) this.heartFlash = Math.max(0, this.heartFlash - dt);
      const pulse = 1 + Math.sin(time * 3) * 0.08 + this.heartFlash * 0.35;
      this.features.crystal.scale.setScalar(pulse * (ratio < 0.35 ? 0.9 : 1));
      this.features.crystal.rotation.y += dt * 0.9;
      this.features.heartRing.rotation.z += dt * 1.4;
      if (this.features.heartMat) {
        this.features.heartMat.emissiveIntensity = this.heartFlash > 0 ? 2.8 : 1.1;
      }
      if (this.features.heartLight) {
        this.features.heartLight.intensity = ratio < 0.35 ? 1 + Math.sin(time * 12) * 0.8 : 2.4;
      }
    }
    if (this.features.portalSwirl) {
      this.features.portalSwirl.rotation.z += dt * 1.8;
      this.features.portalSwirl.rotation.x = Math.PI / 2 + Math.sin(time * 1.3) * 0.18;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
