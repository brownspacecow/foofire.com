import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Spot Your Friends — the house and front yard.
 * Everything is built from primitives. Walls and furniture also add
 * circle-vs-box colliders that the first-person player bumps into.
 * ------------------------------------------------------------------ */

export function createWorld(scene) {
  const root = new THREE.Group();
  const colliders = [];
  const materials = new Map();

  const materialFor = (color, metal = false) => {
    const key = `${color}:${metal ? 'metal' : 'matte'}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: metal ? 0.35 : 0.85,
        metalness: metal ? 0.55 : 0,
      });
      materials.set(key, material);
    }
    return material;
  };

  const box = (x, y, z, w, h, d, color, options = {}) => {
    const {
      rotY = 0,
      collide = false,
      metal = false,
      cast = true,
      receive = true,
      opacity = 1,
    } = options;
    const material =
      opacity < 1
        ? new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity,
            roughness: 0.25,
            metalness: 0,
          })
        : materialFor(color, metal);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
    if (collide) {
      const cos = Math.abs(Math.cos(rotY));
      const sin = Math.abs(Math.sin(rotY));
      colliders.push({ x, z, hw: (w * cos + d * sin) / 2, hd: (w * sin + d * cos) / 2 });
    }
    return mesh;
  };

  const cyl = (x, y, z, rTop, rBottom, h, color, options = {}) => {
    const { segments = 16, rotX = 0, rotZ = 0, collide = false, metal = false, cast = true } = options;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, h, segments),
      materialFor(color, metal)
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotX, 0, rotZ);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (collide) {
      const radius = Math.max(rTop, rBottom);
      colliders.push({ x, z, hw: radius, hd: radius });
    }
    return mesh;
  };

  const glowBox = (x, y, z, w, h, d, color, emissive, intensity = 1.1) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.4,
      })
    );
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };

  const wallX = (x, z1, z2, color = 0xf1e6d6) =>
    box(x, 1.5, (z1 + z2) / 2, 0.28, 3, Math.abs(z2 - z1), color, { collide: true });

  const wallZ = (z, x1, x2, color = 0xf1e6d6) =>
    box((x1 + x2) / 2, 1.5, z, Math.abs(x2 - x1), 3, 0.28, color, { collide: true });

  const doorFrameX = (x, z) =>
    box(x, 1.05, z, 0.4, 2.1, 0.12, 0x7a5230, { cast: false });
  const doorFrameZ = (z, x) =>
    box(x, 1.05, z, 0.12, 2.1, 0.4, 0x7a5230, { cast: false });

  /* ---------------------------------------------------------- ground */
  box(0, -0.17, 5, 42, 0.3, 38, 0x83c85c, { cast: false }); // grass
  box(0, 0.01, 9.55, 4.2, 0.05, 1.3, 0xc9b99c, { cast: false }); // porch slab
  box(0, 0.055, 8.35, 1.5, 0.04, 0.55, 0x6b4a2f, { cast: false }); // doormat

  /* room floors */
  box(-6, 0.0, 5, 9.72, 0.06, 7.72, 0xb98a5b, { cast: false }); // living
  box(6, 0.0, 5, 9.72, 0.06, 7.72, 0xe4ded2, { cast: false }); // kitchen
  box(0, 0.0, 0, 1.72, 0.06, 17.72, 0xa97a4f, { cast: false }); // hallway
  box(-6, 0.0, -3.86, 9.72, 0.06, 10.0, 0xd8c3a5, { cast: false }); // bedroom
  box(6, 0.0, -1.36, 9.72, 0.06, 5.0, 0xd9e4e0, { cast: false }); // bathroom
  box(6, 0.0, -6.5, 9.72, 0.06, 4.72, 0x7fa9c9, { cast: false }); // playroom

  /* one ceiling slab across the whole house */
  box(0, 3.02, 0, 21.72, 0.12, 17.72, 0xf7efe2, { cast: false });

  /* --------------------------------------------------- exterior shell */
  wallX(-11, -9, 9);
  wallX(11, -9, 9);
  wallZ(-9, -11, 11);
  wallZ(9, -11, -1);
  wallZ(9, 1, 11);
  box(0, 2.56, 9, 2, 0.88, 0.28, 0xf1e6d6); // front door lintel

  /* roof cap trim */
  box(0, 3.08, 9, 22.2, 0.16, 0.42, 0xd9c2a4, { cast: false });
  box(0, 3.08, -9, 22.2, 0.16, 0.42, 0xd9c2a4, { cast: false });
  box(-11, 3.08, 0, 0.42, 0.16, 18.2, 0xd9c2a4, { cast: false });
  box(11, 3.08, 0, 0.42, 0.16, 18.2, 0xd9c2a4, { cast: false });

  /* flat roof eaves: gives the house an edge against the sky */
  box(0, 3.18, 9.4, 22.8, 0.2, 1.2, 0x7a5230, { cast: false });
  box(0, 3.18, -9.4, 22.8, 0.2, 1.2, 0x7a5230, { cast: false });
  box(-11.4, 3.18, 0, 1.2, 0.2, 18.8, 0x7a5230, { cast: false });
  box(11.4, 3.18, 0, 1.2, 0.2, 18.8, 0x7a5230, { cast: false });
  box(0, 0.18, 9.16, 22.2, 0.36, 0.1, 0xb9ada0, { cast: false });

  /* front door frame + awning + lights */
  doorFrameZ(9, -1.04);
  doorFrameZ(9, 1.04);
  box(0, 2.86, 9.6, 3.4, 0.12, 1.15, 0xff8a00);
  box(0, 2.95, 9.6, 3.5, 0.05, 1.25, 0xffd93d, { cast: false });
  glowBox(-1.4, 2.1, 9.25, 0.16, 0.22, 0.16, 0xfff3c4, 0xffd93d, 1.4);
  glowBox(1.4, 2.1, 9.25, 0.16, 0.22, 0.16, 0xfff3c4, 0xffd93d, 1.4);
  box(1.9, 2.0, 9.16, 0.34, 0.28, 0.05, 0x5b3a24, { cast: false });

  /* fake windows on the facade */
  [-6, 6].forEach((x) => {
    box(x, 1.75, 9.16, 2.05, 1.5, 0.1, 0xfff8ea, { cast: false });
    glowBox(x, 1.75, 9.22, 1.75, 1.2, 0.03, 0xbfe9ff, 0x6fb8d8, 0.5);
    box(x, 1.75, 9.25, 0.07, 1.2, 0.03, 0xfff8ea, { cast: false });
    box(x, 1.75, 9.25, 1.75, 0.07, 0.03, 0xfff8ea, { cast: false });
    box(x, 2.56, 9.2, 2.1, 0.12, 0.16, 0xd9c2a4, { cast: false });
  });

  /* --------------------------------------------------- interior walls */
  /* wall between living/bedroom and the hallway */
  wallX(-1, -9, -6.6);
  wallX(-1, -4.6, 3.0);
  wallX(-1, 5.0, 9);
  box(-1, 2.56, -5.6, 0.34, 0.88, 2.0, 0xf1e6d6);
  box(-1, 2.56, 4.0, 0.34, 0.88, 2.0, 0xf1e6d6);
  [ -6.6, -4.6, 3.0, 5.0 ].forEach((z) => doorFrameX(-1, z));

  /* wall between hallway and kitchen/bathroom/playroom */
  wallX(1, -9, -7.2);
  wallX(1, -5.2, -3.4);
  wallX(1, -1.4, 3.0);
  wallX(1, 5.0, 9);
  box(1, 2.56, -6.2, 0.34, 0.88, 2.0, 0xf1e6d6);
  box(1, 2.56, -2.4, 0.34, 0.88, 2.0, 0xf1e6d6);
  box(1, 2.56, 4.0, 0.34, 0.88, 2.0, 0xf1e6d6);
  [ -7.2, -5.2, -3.4, -1.4, 3.0, 5.0 ].forEach((z) => doorFrameX(1, z));

  /* room divider walls */
  wallZ(1, -11, -1);
  wallZ(1, 1, 11);
  wallZ(-4, 1, 11);

  /* ------------------------------------------------ living room bits */
  box(-6.4, 0.045, 5.2, 4.6, 0.02, 3.4, 0x9a4f6b, { cast: false }); // rug

  // Couch against the west wall, facing the TV across the room.
  box(-9.9, 0.2, 5.3, 1.2, 0.4, 3.0, 0x3f6b5f, { collide: true });
  box(-10.4, 0.74, 5.3, 0.28, 0.92, 3.0, 0x3f6b5f);
  box(-9.9, 0.68, 3.84, 1.2, 0.6, 0.24, 0x3f6b5f);
  box(-9.9, 0.68, 6.76, 1.2, 0.6, 0.24, 0x3f6b5f);
  [4.32, 5.3, 6.28].forEach((z) => {
    box(-9.86, 0.48, z, 0.92, 0.18, 0.82, 0x5b8a78);
    box(-10.16, 0.8, z, 0.22, 0.5, 0.82, 0x5b8a78);
  });
  [-10.35, -9.4].forEach((x) => {
    [3.95, 6.65].forEach((z) => box(x, 0.06, z, 0.12, 0.12, 0.12, 0x2b1d12));
  });

  // Coffee table and a bowl of nothing in particular.
  box(-7.3, 0.42, 5.2, 1.9, 0.08, 1.0, 0x8a5a33);
  [[-8.1, 4.78], [-8.1, 5.62], [-6.5, 4.78], [-6.5, 5.62]].forEach(([x, z]) => {
    box(x, 0.21, z, 0.08, 0.42, 0.08, 0x6b4526);
  });
  cyl(-7.3, 0.49, 5.2, 0.2, 0.16, 0.08, 0xffd93d);

  // TV on the east wall.
  box(-1.55, 0.3, 6.9, 0.45, 0.5, 2.0, 0x3a2a1a, { collide: true });
  box(-1.55, 0.56, 6.9, 0.5, 0.06, 2.1, 0x5b3a24);
  box(-1.4, 1.15, 6.9, 0.1, 1.0, 1.8, 0x16121c);
  glowBox(-1.33, 1.15, 6.9, 0.02, 0.82, 1.55, 0x1b3b4a, 0x2ec4ff, 0.5);

  // Fireplace on the north wall.
  box(-7.8, 0.2, 1.5, 2.3, 0.4, 0.65, 0xc9bfb2, { collide: true });
  box(-7.8, 0.95, 1.45, 2.1, 1.1, 0.4, 0xdcd3c6);
  glowBox(-7.8, 0.7, 1.68, 1.1, 0.55, 0.05, 0xff8a00, 0xff5b00, 1.2);
  box(-7.8, 1.55, 1.48, 2.35, 0.14, 0.55, 0x8a6544);
  box(-7.8, 2.45, 1.35, 2.1, 1.7, 0.32, 0xdcd3c6);
  cyl(-8.6, 1.75, 1.5, 0.08, 0.06, 0.22, 0xa855f7);
  box(-7.0, 1.72, 1.5, 0.35, 0.22, 0.22, 0x2ec4ff);

  // Bookshelf against the front wall.
  box(-2.8, 1.0, 8.65, 1.8, 2.0, 0.36, 0x6b4a2f, { collide: true });
  box(-2.8, 0.3, 8.45, 1.6, 0.04, 0.3, 0x4d3320);
  const bookColors = [0xff2e63, 0x2ec4ff, 0xffd93d, 0x3ddc84, 0xa855f7, 0xff8a00];
  let bookIndex = 0;
  [0.42, 0.86, 1.3, 1.74].forEach((shelfY) => {
    box(-2.8, shelfY, 8.5, 1.6, 0.045, 0.3, 0x8a6544);
    for (let i = 0; i < 4; i += 1) {
      const x = -3.45 + i * 0.3 + (bookIndex % 2) * 0.05;
      const h = 0.24 + ((bookIndex * 7) % 5) * 0.025;
      box(x, shelfY + h / 2 + 0.02, 8.48, 0.09, h, 0.22, bookColors[bookIndex % bookColors.length]);
      bookIndex += 1;
    }
  });

  // Curtains hiding the window that isn't there.
  cyl(-6.8, 2.36, 8.7, 0.03, 0.03, 2.3, 0x6b4a2f, { rotZ: Math.PI / 2 });
  box(-7.45, 1.24, 8.66, 0.52, 2.2, 0.12, 0x8a3f6b);
  box(-6.15, 1.24, 8.66, 0.52, 2.2, 0.12, 0x8a3f6b);

  // Potted plant in the corner next to the couch.
  cyl(-10.4, 0.16, 7.7, 0.24, 0.19, 0.32, 0xb5623a);
  cyl(-10.4, 0.36, 7.7, 0.03, 0.03, 0.5, 0x3d6b2f);
  [[-10.4, 0.68, 7.7, 0.3], [-10.62, 0.55, 7.55, 0.2], [-10.18, 0.58, 7.9, 0.18]].forEach(
    ([x, y, z, r]) => {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        materialFor(0x3d7a3a)
      );
      leaf.position.set(x, y, z);
      leaf.scale.y = 0.8;
      leaf.castShadow = true;
      root.add(leaf);
    }
  );

  /* ------------------------------------------------------ kitchen bits */
  box(4.1, 0.44, 1.55, 4.6, 0.88, 0.62, 0x46695c, { collide: true });
  box(4.1, 0.91, 1.55, 4.7, 0.07, 0.68, 0xe8ded0);
  box(5.4, 0.925, 1.55, 0.8, 0.03, 0.46, 0x9aa7ad, { metal: true });
  cyl(5.4, 1.0, 1.32, 0.03, 0.03, 0.3, 0xb8c2c7, { metal: true });
  box(5.4, 1.14, 1.43, 0.05, 0.05, 0.24, 0xb8c2c7, { metal: true });
  box(2.7, 0.94, 1.55, 0.95, 0.02, 0.55, 0x1d1d22);
  [[2.45, 1.4], [2.95, 1.4], [2.45, 1.7], [2.95, 1.7]].forEach(([x, z]) => {
    cyl(x, 0.955, z, 0.1, 0.1, 0.02, 0x4d4d55, { metal: true });
  });
  box(4.1, 2.16, 1.34, 3.4, 0.8, 0.34, 0xefe4d2);
  [-0.85, 0, 0.85].forEach((offset) => {
    box(4.1 + offset, 2.16, 1.52, 0.04, 0.7, 0.03, 0xb9a58a);
    box(4.1 + offset, 1.8, 1.54, 0.1, 0.03, 0.03, 0x8a6544);
  });

  box(9.85, 0.98, 1.7, 1.05, 1.95, 0.78, 0xe8edf0, { collide: true });
  box(9.85, 1.15, 1.7, 1.06, 0.03, 0.8, 0xc3ccd2, { cast: false });
  box(9.36, 1.0, 2.1, 0.05, 0.5, 0.05, 0xaab5bb, { metal: true });
  box(9.36, 0.6, 2.1, 0.05, 0.3, 0.05, 0xaab5bb, { metal: true });

  box(7.0, 0.43, 4.3, 2.2, 0.86, 1.0, 0x48695c, { collide: true });
  box(7.0, 0.9, 4.3, 2.4, 0.08, 1.2, 0xe8ded0);
  cyl(7.25, 1.0, 4.3, 0.24, 0.17, 0.12, 0xffd93d);
  [[7.12, 1.02, 4.18, 0xff2e63], [7.34, 1.02, 4.34, 0x3ddc84], [7.22, 1.02, 4.46, 0xff8a00]].forEach(
    ([x, y, z, color]) => {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), materialFor(color));
      fruit.position.set(x, y, z);
      fruit.castShadow = true;
      root.add(fruit);
    }
  );

  [6.1, 7.9].forEach((x) => {
    cyl(x, 0.62, 5.15, 0.25, 0.23, 0.08, 0xd8a55a, { collide: true });
    [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(([dx, dz]) => {
      cyl(x + dx, 0.3, 5.15 + dz, 0.025, 0.025, 0.6, 0x8a6544);
    });
  });

  // Dining table and three chairs.
  cyl(4.0, 0.75, 7.0, 1.0, 1.0, 0.08, 0x9a6a3a, { collide: true });
  cyl(4.0, 0.38, 7.0, 0.12, 0.12, 0.7, 0x6b4526);
  cyl(4.0, 0.03, 7.0, 0.5, 0.55, 0.06, 0x6b4526);
  [[3.9, 5.85, 0], [2.85, 7.15, 0.9], [5.15, 7.15, -0.9]].forEach(([x, z, rot]) => {
    box(x, 0.46, z, 0.46, 0.08, 0.46, 0xff8a00, { rotY: rot });
    box(x, 0.72, z + (rot === 0 ? -0.2 : 0), 0.46, 0.5, 0.07, 0xff8a00, { rotY: rot });
    box(x, 0.23, z, 0.06, 0.46, 0.06, 0x6b4526);
  });

  /* ------------------------------------------------------ bedroom bits */
  box(-9.3, 0.2, -7.2, 2.05, 0.34, 3.05, 0x6b4a2f, { collide: true });
  box(-9.3, 0.52, -7.2, 1.95, 0.34, 2.9, 0xf3ead8);
  box(-9.3, 0.7, -6.55, 1.98, 0.14, 1.7, 0x5b7fae);
  box(-9.3, 0.85, -8.7, 2.15, 1.1, 0.18, 0x6b4a2f);
  box(-9.8, 0.77, -8.1, 0.7, 0.18, 0.4, 0xfff8ea, { rotY: 0.06 });
  box(-8.8, 0.77, -8.1, 0.7, 0.18, 0.4, 0xfff8ea, { rotY: -0.06 });

  box(-10.4, 0.28, -4.7, 0.55, 0.55, 0.55, 0x6b4a2f, { collide: true });
  cyl(-10.4, 0.63, -4.7, 0.05, 0.08, 0.16, 0x8a6544);
  cyl(-10.4, 0.76, -4.7, 0.16, 0.12, 0.18, 0xffd93d);

  box(-5.2, 0.46, -8.5, 1.8, 0.9, 0.6, 0x8a5a33, { collide: true });
  [-8.72, -8.2].forEach((z, index) => {
    box(-6.0, 0.52 + index * 0.3, -8.18, 0.7, 0.03, 0.04, 0x5b3a24, { cast: false });
    box(-4.4, 0.52 + index * 0.3, -8.18, 0.7, 0.03, 0.04, 0x5b3a24, { cast: false });
  });
  box(-5.2, 1.62, -8.8, 1.3, 1.1, 0.06, 0x6b4a2f);
  glowBox(-5.2, 1.62, -8.755, 1.1, 0.9, 0.02, 0xcfe8ef, 0x8fc6d8, 0.3);
  box(-5.2, 0.95, -8.18, 0.5, 0.03, 0.06, 0xfff8ea);

  // Open wardrobe: back, sides and top only, so Kai has somewhere to stand.
  box(-2.5, 1.05, -8.8, 1.6, 2.1, 0.08, 0x6b4a2f);
  box(-3.26, 1.05, -8.5, 0.08, 2.1, 0.7, 0x7a5230);
  box(-1.74, 1.05, -8.5, 0.08, 2.1, 0.7, 0x7a5230);
  box(-2.5, 2.06, -8.5, 1.6, 0.08, 0.7, 0x7a5230);
  box(-2.5, 0.06, -8.5, 1.6, 0.08, 0.7, 0x7a5230);
  colliders.push({ x: -2.5, z: -8.5, hw: 0.8, hd: 0.35 });
  box(-3.7, 1.05, -8.08, 0.06, 2.0, 0.8, 0x7a5230, { rotY: 1.15 });
  box(-1.3, 1.05, -8.08, 0.06, 2.0, 0.8, 0x7a5230, { rotY: -1.15 });
  [-2.9, -2.5, -2.1].forEach((x, index) => {
    box(x, 1.5, -8.62, 0.28, 0.5, 0.05, [0x2ec4ff, 0xff8a00, 0x3ddc84][index]);
  });

  box(-6.0, 0.045, -5.0, 4.2, 0.02, 3.2, 0x9a6f8c, { cast: false });
  box(-0.84, 1.8, -3.2, 0.04, 0.8, 0.6, 0x0a0518);
  box(-0.82, 1.8, -3.2, 0.02, 0.62, 0.44, 0x2ec4ff);

  /* ----------------------------------------------------- bathroom bits */
  box(3.2, 0.3, -3.3, 2.1, 0.6, 1.05, 0xf2f6f7, { collide: true });
  box(3.2, 0.61, -3.3, 2.2, 0.05, 1.12, 0xe6eef0);
  box(3.2, 0.55, -3.3, 1.8, 0.04, 0.76, 0x7fd4ff, { opacity: 0.6, cast: false });
  [[2.35, -2.85], [4.05, -2.85], [2.35, -3.75], [4.05, -3.75]].forEach(([x, z]) => {
    cyl(x, 0.06, z, 0.07, 0.09, 0.12, 0xd9c2a4);
  });

  box(10.55, 0.4, -2.3, 0.45, 0.8, 1.1, 0x47695c, { collide: true });
  box(10.5, 0.83, -2.3, 0.58, 0.06, 1.18, 0xeae3d5);
  box(10.48, 0.86, -2.3, 0.34, 0.06, 0.42, 0xffffff);
  cyl(10.6, 1.02, -2.3, 0.025, 0.025, 0.3, 0xb8c2c7, { metal: true });
  box(10.82, 1.62, -2.3, 0.04, 1.0, 0.9, 0x6b4a2f);
  glowBox(10.8, 1.62, -2.3, 0.02, 0.86, 0.76, 0xcfe8ef, 0x8fc6d8, 0.3);

  box(7.4, 0.55, -3.45, 0.55, 0.65, 0.24, 0xf2f6f7);
  box(7.4, 0.2, -3.15, 0.38, 0.4, 0.5, 0xe6eef0, { collide: true });
  cyl(7.4, 0.4, -3.12, 0.25, 0.2, 0.18, 0xf2f6f7);
  cyl(7.4, 0.5, -3.12, 0.22, 0.22, 0.04, 0xd9e4e0);
  box(3.2, 0.045, -2.35, 1.4, 0.02, 0.7, 0x88c0d8, { cast: false });
  cyl(10.7, 1.45, -1.6, 0.02, 0.02, 0.8, 0xb8c2c7, { rotZ: Math.PI / 2, metal: true });

  /* ----------------------------------------------------- playroom bits */
  box(2.6, 0.1, -8.4, 1.4, 0.2, 0.65, 0x8a5a33);
  box(2.6, 0.36, -8.06, 1.4, 0.52, 0.06, 0xff8a00);
  box(2.6, 0.36, -8.74, 1.4, 0.52, 0.06, 0xff8a00);
  box(1.92, 0.36, -8.4, 0.06, 0.52, 0.62, 0xff8a00);
  box(3.28, 0.36, -8.4, 0.06, 0.52, 0.62, 0xff8a00);
  box(2.6, 0.78, -8.72, 1.4, 0.06, 0.65, 0xffd93d, { rotY: 0.12 });
  colliders.push({ x: 2.6, z: -8.4, hw: 0.7, hd: 0.36 });

  box(10.45, 0.95, -6.3, 0.45, 1.9, 2.0, 0xb98a5b, { collide: true });
  [0.35, 0.85, 1.35, 1.75].forEach((y) => box(10.35, y, -6.3, 0.32, 0.05, 1.9, 0x8a6544));
  [0x2ec4ff, 0xff2e63, 0xffd93d, 0x3ddc84].forEach((color, index) => {
    box(10.3, 0.52 + index * 0.02, -7.0 + index * 0.5, 0.28, 0.28, 0.32, color);
  });

  const bean = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 14, 10),
    materialFor(0xa855f7)
  );
  bean.position.set(7.3, 0.32, -7.2);
  bean.scale.set(1.2, 0.42, 1.2);
  bean.castShadow = true;
  root.add(bean);
  colliders.push({ x: 7.3, z: -7.2, hw: 0.9, hd: 0.9 });

  box(6.0, 0.045, -6.4, 4.2, 0.02, 3.2, 0xffd93d, { cast: false });
  const blockColors = [0xff2e63, 0x2ec4ff, 0x3ddc84, 0xff8a00, 0xa855f7];
  [
    [4.6, -7.6], [5.1, -6.0], [6.6, -5.4], [7.9, -6.9], [4.8, -5.2], [8.2, -5.6], [9.0, -7.8], [6.2, -7.9],
  ].forEach(([x, z], index) => {
    box(x, 0.14, z, 0.24, 0.24, 0.24, blockColors[index % blockColors.length], { rotY: index * 0.4 });
  });

  /* ------------------------------------------------------ hallway bits */
  box(0, 0.045, 0, 1.15, 0.02, 15.6, 0x7b4d6b, { cast: false });
  box(0.72, 0.82, 1.4, 0.42, 0.06, 1.2, 0x6b4a2f);
  [[0.55, 0.87], [0.55, 1.93], [0.89, 0.87], [0.89, 1.93]].forEach(([x, z]) => {
    box(x, 0.4, z, 0.06, 0.8, 0.06, 0x5b3a24);
  });
  colliders.push({ x: 0.72, z: 1.4, hw: 0.24, hd: 0.62 });
  cyl(0.72, 0.83, 1.4, 0.12, 0.12, 0.02, 0x8a6544);
  box(0.72, 0.94, 1.4, 0.22, 0.18, 0.3, 0x2ec4ff);

  cyl(0.78, 0.95, 3.1, 0.03, 0.03, 1.9, 0x6b4a2f, { collide: true });
  box(0.78, 1.9, 3.1, 0.6, 0.05, 0.05, 0x8a6544);
  box(0.6, 1.5, 3.1, 0.22, 0.7, 0.12, 0xff8a00);
  box(0.96, 1.45, 3.1, 0.2, 0.6, 0.12, 0x2ec4ff);

  [[6.7, 0x2ec4ff], [-2.0, 0xff8a00]].forEach(([z, color]) => {
    box(-0.83, 1.8, z, 0.04, 0.8, 0.62, 0x0a0518);
    box(-0.81, 1.8, z, 0.02, 0.62, 0.46, color);
  });

  /* -------------------------------------------------------- front yard */
  for (let i = 0; i < 6; i += 1) {
    box(0, 0.015, 10.1 + i * 1.25, 1.9 - (i % 2) * 0.18, 0.03, 1.05, i % 2 ? 0xbfae90 : 0xcfc1a5, {
      cast: false,
    });
  }

  const fenceRun = (x1, z1, x2, z2) => {
    const horizontal = z1 === z2;
    const length = Math.hypot(x2 - x1, z2 - z1);
    const count = Math.max(2, Math.round(length / 2.2));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      cyl(x, 0.58, z, 0.07, 0.08, 1.16, 0x8a6544);
      cyl(x, 1.18, z, 0.1, 0.1, 0.06, 0xd9c2a4);
    }
    if (horizontal) {
      box((x1 + x2) / 2, 0.44, z1, length, 0.09, 0.06, 0xd9c2a4);
      box((x1 + x2) / 2, 0.94, z1, length, 0.08, 0.06, 0xd9c2a4);
      colliders.push({ x: (x1 + x2) / 2, z: z1, hw: length / 2, hd: 0.12 });
    } else {
      box(x1, 0.44, (z1 + z2) / 2, 0.06, 0.09, length, 0xd9c2a4);
      box(x1, 0.94, (z1 + z2) / 2, 0.06, 0.08, length, 0xd9c2a4);
      colliders.push({ x: x1, z: (z1 + z2) / 2, hw: 0.12, hd: length / 2 });
    }
  };

  fenceRun(-13, 9, -13, 18);
  fenceRun(13, 9, 13, 18);
  fenceRun(-13, 18, -1.2, 18);
  fenceRun(1.2, 18, 13, 18);

  // Hedges close the gap between the house corners and the side fences.
  box(-12, 0.48, 9.4, 2.0, 0.96, 0.7, 0x3d7a3a, { collide: true });
  box(12, 0.48, 9.4, 2.0, 0.96, 0.7, 0x3d7a3a, { collide: true });

  // Closed gate at the front so nobody wanders off the map.
  [-0.62, 0.62].forEach((x) => {
    box(x, 0.58, 18, 1.18, 1.1, 0.08, 0x8a6544);
    box(x, 0.88, 18.06, 1.0, 0.09, 0.04, 0xd9c2a4, { cast: false });
    box(x, 0.5, 18.06, 1.0, 0.09, 0.04, 0xd9c2a4, { cast: false });
  });
  colliders.push({ x: 0, z: 18, hw: 1.3, hd: 0.12 });

  // Big climbing tree, with a branch for Pia.
  cyl(-6.5, 1.35, 13.2, 0.26, 0.36, 2.7, 0x7a5230, { collide: true });
  box(-6.5, 1.82, 13.95, 0.16, 0.14, 1.7, 0x7a5230);
  [
    [-6.5, 3.55, 13.2, 1.35],
    [-7.55, 3.2, 13.8, 0.95],
    [-5.45, 3.3, 14.0, 0.9],
    [-6.6, 3.2, 14.35, 0.8],
    [-6.2, 4.25, 13.4, 0.85],
  ].forEach(([x, y, z, r]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), materialFor(0x4f9a3c));
    leaf.position.set(x, y, z);
    leaf.scale.y = 0.85;
    leaf.castShadow = true;
    root.add(leaf);
  });

  // A pair of smaller trees to fill out the yard.
  [
    [9.2, 14.2, 0.22, 2.4],
    [-10.4, 15.8, 0.24, 2.6],
  ].forEach(([x, z, trunk, height]) => {
    cyl(x, height / 2, z, trunk, trunk + 0.06, height, 0x7a5230, { collide: true });
    [
      [x, height + 0.55, z, 1.0],
      [x - 0.8, height + 0.25, z + 0.35, 0.75],
      [x + 0.7, height + 0.3, z - 0.2, 0.7],
    ].forEach(([lx, ly, lz, r]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), materialFor(0x4f9a3c));
      leaf.position.set(lx, ly, lz);
      leaf.scale.y = 0.85;
      leaf.castShadow = true;
      root.add(leaf);
    });
  });

  // Mailbox by the path.
  box(2.8, 0.55, 16.2, 0.12, 1.1, 0.12, 0x8a6544);
  box(2.8, 1.18, 16.2, 0.46, 0.3, 0.66, 0xff2e63);
  box(2.8, 1.2, 16.53, 0.07, 0.07, 0.06, 0xffd93d);
  box(2.62, 1.36, 16.2, 0.03, 0.26, 0.2, 0xffd93d);
  colliders.push({ x: 2.8, z: 16.2, hw: 0.24, hd: 0.34 });

  // Hedge tangle where June is hiding.
  [
    [10.25, 15.4, 0.72],
    [11.5, 15.55, 0.68],
    [10.35, 17.25, 0.65],
    [11.85, 16.9, 0.62],
    [9.9, 16.55, 0.6],
  ].forEach(([x, z, r]) => {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), materialFor(0x3d7a3a));
    bush.position.set(x, r * 0.62, z);
    bush.scale.y = 0.85;
    bush.castShadow = true;
    root.add(bush);
  });

  // Flowers along the porch and the fence.
  const flowerSpots = [
    [-8.4, 9.85, 0xff2e63],
    [-7.6, 9.9, 0xffd93d],
    [-3.9, 9.8, 0xa855f7],
    [3.9, 9.8, 0xff8a00],
    [8.5, 9.85, 0x2ec4ff],
    [11.7, 12.0, 0xff2e63],
    [-11.7, 14.0, 0xffd93d],
    [-4.5, 16.85, 0xa855f7],
    [5.2, 16.7, 0xff2e63],
    [9.8, 17.1, 0x2ec4ff],
  ];
  flowerSpots.forEach(([x, z, color]) => {
    cyl(x, 0.18, z, 0.015, 0.02, 0.36, 0x3d8a3a);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), materialFor(color));
    head.position.set(x, 0.39, z);
    head.castShadow = true;
    root.add(head);
  });

  // Garden gnome keeping an eye on everything.
  const gnomeBody = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 10), materialFor(0x2ec4ff));
  gnomeBody.position.set(-9.6, 0.21, 15.4);
  gnomeBody.castShadow = true;
  root.add(gnomeBody);
  const gnomeHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), materialFor(0xf1c27d));
  gnomeHead.position.set(-9.6, 0.47, 15.4);
  gnomeHead.castShadow = true;
  root.add(gnomeHead);
  const gnomeHat = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 10), materialFor(0xff2e63));
  gnomeHat.position.set(-9.6, 0.65, 15.4);
  gnomeHat.castShadow = true;
  root.add(gnomeHat);

  scene.add(root);
  return { root, colliders };
}
