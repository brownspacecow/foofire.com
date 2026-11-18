import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Spot Your Friends — the ten friends, where they hide, and a tiny
 * primitive-built character model. No external models or textures.
 * ------------------------------------------------------------------ */

export const FRIENDS = [
  {
    id: 'milo',
    name: 'Milo',
    hint: 'Milo is tucked behind the couch in the living room.',
    x: -10.15,
    y: 0.02,
    z: 7.05,
    rotY: 1.5,
    look: { skin: 0xf0c08c, shirt: 0x2ec4ff, pants: 0x25305e, hair: 0x2a1a12, accent: 0xff2e63, accessory: 'cap' },
  },
  {
    id: 'zoe',
    name: 'Zoe',
    hint: 'Zoe is raiding the kitchen island — look on the far side.',
    x: 8.75,
    y: 0.02,
    z: 4.6,
    rotY: -1.6,
    look: { skin: 0x8d5524, shirt: 0xffd93d, pants: 0x2f3d7a, hair: 0x1b1210, accent: 0xff2e63, accessory: 'pigtails' },
  },
  {
    id: 'kai',
    name: 'Kai',
    hint: 'Kai left the wardrobe doors hanging open in the bedroom.',
    x: -2.5,
    y: 0.02,
    z: -8.3,
    rotY: 0,
    look: { skin: 0xe0ac69, shirt: 0x3ddc84, pants: 0x2f3d7a, hair: 0x22160f, accent: 0x2ec4ff, accessory: 'headphones' },
  },
  {
    id: 'nia',
    name: 'Nia',
    hint: 'Nia is soaking in the bathtub. Shoes on and everything.',
    x: 3.2,
    y: 0.24,
    z: -3.3,
    rotY: 0.5,
    look: { skin: 0x6b4226, shirt: 0xa855f7, pants: 0x2f3d7a, hair: 0x201510, accent: 0x2ec4ff, accessory: 'bow' },
  },
  {
    id: 'rex',
    name: 'Rex',
    hint: 'Rex is buried in the toy chest in the playroom.',
    x: 2.6,
    y: 0.2,
    z: -8.4,
    rotY: 0,
    scale: 0.72,
    look: { skin: 0xd9a066, shirt: 0xff8a00, pants: 0x3a2a1a, hair: 0x3a2415, accent: 0xffd93d, accessory: 'none' },
  },
  {
    id: 'pia',
    name: 'Pia',
    hint: 'Pia climbed the big tree in the front yard.',
    x: -6.5,
    y: 1.88,
    z: 13.8,
    rotY: 0.4,
    scale: 0.8,
    look: { skin: 0xf1c27d, shirt: 0xff2e63, pants: 0x25305e, hair: 0x4a2c17, accent: 0xffd93d, accessory: 'beanie' },
  },
  {
    id: 'theo',
    name: 'Theo',
    hint: 'Theo is pretending to be part of the hallway table.',
    x: 0.7,
    y: 0.02,
    z: 1.4,
    rotY: 0,
    scale: 0.62,
    look: { skin: 0xc68642, shirt: 0x2ec4ff, pants: 0x1d2450, hair: 0x120d0a, accent: 0xff2e63, accessory: 'glasses' },
  },
  {
    id: 'bea',
    name: 'Bea',
    hint: 'Bea is bouncing on the big bed in the bedroom.',
    x: -9.3,
    y: 0.77,
    z: -6.4,
    rotY: 0.1,
    scale: 0.78,
    look: { skin: 0xf3d1a5, shirt: 0x3ddc84, pants: 0x2a2a3a, hair: 0x8a5a2b, accent: 0xa855f7, accessory: 'pigtails' },
  },
  {
    id: 'sam',
    name: 'Sam',
    hint: 'Sam is hiding behind the curtains in the living room.',
    x: -6.8,
    y: 0.02,
    z: 8.55,
    rotY: 3.0,
    look: { skin: 0x9c6b3f, shirt: 0xff8a00, pants: 0x25305e, hair: 0x241a12, accent: 0x2ec4ff, accessory: 'cap' },
  },
  {
    id: 'june',
    name: 'June',
    hint: 'June is crouched in the hedge by the east fence.',
    x: 10.9,
    y: 0.02,
    z: 16.4,
    rotY: -2.2,
    look: { skin: 0xf2c48c, shirt: 0xa855f7, pants: 0x2f3d7a, hair: 0x2a1a12, accent: 0xffd93d, accessory: 'glasses' },
  },
];

/* Shared geometries so ten friends stay cheap to draw. */
const GEO = {
  leg: new THREE.BoxGeometry(0.09, 0.23, 0.11),
  shoe: new THREE.BoxGeometry(0.11, 0.07, 0.18),
  body: new THREE.CylinderGeometry(0.115, 0.145, 0.34, 10),
  arm: new THREE.CylinderGeometry(0.033, 0.038, 0.26, 7),
  hand: new THREE.SphereGeometry(0.035, 8, 6),
  head: new THREE.SphereGeometry(0.15, 16, 12),
  hairCap: new THREE.SphereGeometry(0.157, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairBack: new THREE.SphereGeometry(0.105, 10, 8),
  eye: new THREE.SphereGeometry(0.019, 8, 6),
  ear: new THREE.SphereGeometry(0.034, 6, 6),
  mouth: new THREE.TorusGeometry(0.038, 0.007, 4, 10, Math.PI),
  cap: new THREE.CylinderGeometry(0.152, 0.152, 0.07, 12),
  brim: new THREE.BoxGeometry(0.2, 0.03, 0.13),
  beanie: new THREE.CylinderGeometry(0.14, 0.15, 0.11, 12),
  pompom: new THREE.SphereGeometry(0.045, 8, 6),
  pigtail: new THREE.SphereGeometry(0.062, 10, 8),
  glasses: new THREE.TorusGeometry(0.044, 0.009, 4, 12),
  bridge: new THREE.BoxGeometry(0.035, 0.012, 0.012),
  headband: new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI),
  earcup: new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10),
  bow: new THREE.SphereGeometry(0.05, 8, 6),
};

export function createFriend(look) {
  const { skin, shirt, pants, hair, accent, accessory } = look;
  const group = new THREE.Group();

  const mk = (color, roughness = 0.78) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const skinMat = mk(skin);
  const shirtMat = mk(shirt);
  const pantsMat = mk(pants);
  const hairMat = mk(hair, 0.9);
  const accentMat = mk(accent);
  const darkMat = mk(0x1a1016, 0.45);
  const shoeMat = mk(0x2a2a35);

  const part = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  [-1, 1].forEach((side) => {
    part(GEO.leg, pantsMat, side * 0.075, 0.115, 0);
    part(GEO.shoe, shoeMat, side * 0.075, 0.035, 0.02);
    part(GEO.arm, shirtMat, side * 0.16, 0.47, 0, 0, 0, side * 0.16);
    part(GEO.hand, skinMat, side * 0.185, 0.335, 0);
    part(GEO.ear, skinMat, side * 0.147, 0.7, 0.005);
  });

  part(GEO.body, shirtMat, 0, 0.39, 0);
  part(GEO.head, skinMat, 0, 0.7, 0);
  part(GEO.hairCap, hairMat, 0, 0.7, 0);
  part(GEO.hairBack, hairMat, 0, 0.655, -0.095);

  [-1, 1].forEach((side) => {
    part(GEO.eye, darkMat, side * 0.054, 0.715, 0.134);
  });
  /* Half a torus rotated upside down reads as a smile. */
  part(GEO.mouth, darkMat, 0, 0.648, 0.143, 0, 0, Math.PI);

  if (accessory === 'cap') {
    part(GEO.cap, accentMat, 0, 0.85, 0);
    part(GEO.brim, accentMat, 0, 0.825, 0.1);
  } else if (accessory === 'beanie') {
    part(GEO.beanie, accentMat, 0, 0.845, 0);
    part(GEO.pompom, mk(0xfff8ea), 0, 0.915, 0);
  } else if (accessory === 'pigtails') {
    [-1, 1].forEach((side) => {
      part(GEO.pigtail, hairMat, side * 0.155, 0.665, -0.03);
      part(GEO.pigtail, accentMat, side * 0.155, 0.665, 0.015).scale.setScalar(0.34);
    });
  } else if (accessory === 'glasses') {
    [-1, 1].forEach((side) => {
      part(GEO.glasses, darkMat, side * 0.057, 0.715, 0.142);
    });
    part(GEO.bridge, darkMat, 0, 0.718, 0.143);
  } else if (accessory === 'headphones') {
    part(GEO.headband, darkMat, 0, 0.7, 0);
    [-1, 1].forEach((side) => {
      part(GEO.earcup, accentMat, side * 0.158, 0.69, 0, 0, 0, Math.PI / 2);
    });
  } else if (accessory === 'bow') {
    part(GEO.bow, accentMat, -0.045, 0.86, 0).scale.set(1.2, 0.7, 0.6);
    part(GEO.bow, accentMat, 0.045, 0.86, 0).scale.set(1.2, 0.7, 0.6);
    part(GEO.bow, mk(0xfff8ea), 0, 0.86, 0.01).scale.setScalar(0.5);
  }

  return group;
}
