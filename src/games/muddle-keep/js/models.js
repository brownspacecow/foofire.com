/* ------------------------------------------------------------------ *
 * Models
 * Primitive-geometry creatures, imps and knights, plus the shared
 * geometry cache, materials and little health bars.
 * ------------------------------------------------------------------ */

import * as THREE from '../vendor/three.module.js';

export const GEO = {
  sphere: new THREE.SphereGeometry(1, 10, 8),
  torus: new THREE.TorusGeometry(0.4, 0.07, 6, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  plane: new THREE.PlaneGeometry(1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  circle: new THREE.CircleGeometry(1, 14),
};

const MATERIALS = new Map();

export function mat(color, options = {}) {
  const key = `${color}:${JSON.stringify(options)}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(key, new THREE.MeshLambertMaterial({ color, ...options }));
  }
  return MATERIALS.get(key);
}

export function basic(color, opacity = 1) {
  const key = `basic:${color}:${opacity}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(
      key,
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
    );
  }
  return MATERIALS.get(key);
}

function part(geometry, material, scale, position) {
  const mesh = new THREE.Mesh(geometry, material);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

export function makeBar(width = 0.64) {
  const group = new THREE.Group();
  const bg = part(GEO.plane, basic('#1a1420', 0.8), [width, width * 0.12, 1], [0, 0, 0]);
  const fill = part(
    GEO.plane,
    new THREE.MeshBasicMaterial({ color: '#7ddc6a' }),
    [width * 0.94, width * 0.085, 1],
    [0, 0, 0.002]
  );
  group.add(bg, fill);
  group.renderOrder = 6;
  return { group, fill, width };
}

export function makeShadow(size) {
  const shadow = part(GEO.circle, basic('#0b0710', 0.34), [size, size, 1], [0, 0, 0]);
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}

/* --------------------------------------------------------------- models */

const CREATURE_LEVELS = 8; // mirrors MAX_LEVEL in needs.js
const CREATURE_SCALE_MIN = 0.72;
const CREATURE_SCALE_MAX = 1.3;

/** Fresh creatures are small; veterans are visibly bigger and broader. */
export function creatureLevelScale(level = 1) {
  const clamped = Math.max(1, Math.min(CREATURE_LEVELS, Number(level) || 1));
  const progress = (clamped - 1) / (CREATURE_LEVELS - 1);
  return CREATURE_SCALE_MIN + (CREATURE_SCALE_MAX - CREATURE_SCALE_MIN) * progress;
}

/** Gear that appears as a creature trains up, so veterans look tougher. */
function addCreatureGear(group, size, level) {
  const tier = Math.max(1, Math.min(CREATURE_LEVELS, Math.round(Number(level) || 1)));
  const gear = new THREE.Group();
  gear.name = 'creature-gear';
  const leather = mat('#4a3d56');
  const metal = mat('#777184');
  const brightMetal = mat('#b4adbd');
  const gold = mat('#ffd166');

  if (tier >= 2) {
    gear.add(
      part(GEO.box, leather, [size * 1.35, size * 0.16, size * 0.16], [
        0,
        size * 1.42,
        size * 0.9,
      ]),
      part(GEO.box, brightMetal, [size * 0.18, size * 0.2, size * 0.18], [
        0,
        size * 1.42,
        size * 1.02,
      ])
    );
  }

  if (tier >= 3) {
    [-1, 1].forEach((side) => {
      const brow = part(GEO.box, mat('#33263f'), [size * 0.48, size * 0.11, size * 0.13], [
        side * size * 0.57,
        size * 2.14,
        size * 1.52,
      ]);
      brow.rotation.z = side * 0.22;
      gear.add(brow);
    });
  }

  if (tier >= 4) {
    const bigSpikes = tier >= 6;
    [-1, 1].forEach((side) => {
      gear.add(
        part(GEO.sphere, metal, [size * 0.54, size * 0.26, size * 0.58], [
          side * size * 1.02,
          size * 1.56,
          0,
        ])
      );
      const spike = part(
        GEO.cone,
        tier >= 8 ? gold : brightMetal,
        [
          size * (bigSpikes ? 0.16 : 0.12),
          size * (bigSpikes ? 0.5 : 0.36),
          size * (bigSpikes ? 0.16 : 0.12),
        ],
        [side * size * 1.12, size * (bigSpikes ? 1.95 : 1.82), 0]
      );
      spike.rotation.z = -side * 0.32;
      gear.add(spike);
    });
  }

  if (tier >= 6) {
    gear.add(
      part(GEO.box, metal, [size * 1.05, size * 0.52, size * 0.2], [
        0,
        size * 1.34,
        size * 0.92,
      ])
    );
  }

  if (tier >= 8) {
    const medallion = part(GEO.cylinder, gold, [size * 0.2, size * 0.055, size * 0.2], [
      0,
      size * 1.36,
      size * 1.07,
    ]);
    medallion.rotation.x = Math.PI / 2;
    gear.add(
      medallion,
      part(GEO.box, gold, [size * 1.25, size * 0.09, size * 0.12], [
        0,
        size * 1.02,
        size * 0.88,
      ])
    );
    [-1, 1].forEach((side) => {
      gear.add(
        part(GEO.sphere, gold, [size * 0.11, size * 0.11, size * 0.11], [
          side * size * 1.02,
          size * 1.73,
          size * 0.36,
        ])
      );
    });
  }

  if (gear.children.length) {
    group.add(gear);
    group.userData.gear = gear;
  }
  group.userData.gearLevel = tier;
}

export function buildCreature(def, level = 1) {
  const group = new THREE.Group();
  const size = Math.max(0.22, def.size ?? 0.3);
  const bodyMat = mat(def.color);
  const accent = mat(def.accent ?? def.color);
  const body =
    def.id === 'chonk'
      ? part(GEO.ico, bodyMat, [size * 1.9, size * 1.7, size * 1.8], [0, size * 1.5, 0])
      : part(GEO.sphere, bodyMat, [size * 1.9, size * 1.65, size * 1.8], [0, size * 1.5, 0]);
  group.add(body);
  group.add(
    part(GEO.sphere, accent, [size * 1.1, size * 0.85, size * 0.6], [0, size * 1.3, size * 0.85])
  );

  // Eyes always face +Z, the model's forward direction.
  const eyeMat = basic('#ffffff');
  const pupilMat = basic('#241a2e');
  const eyeScale = [size * 0.32, size * 0.36, size * 0.3];
  group.add(
    part(GEO.sphere, eyeMat, eyeScale, [-size * 0.58, size * 1.92, size * 1.2]),
    part(GEO.sphere, eyeMat, eyeScale, [size * 0.58, size * 1.92, size * 1.2]),
    part(GEO.sphere, pupilMat, [size * 0.14, size * 0.18, size * 0.12], [
      -size * 0.52,
      size * 1.92,
      size * 1.45,
    ]),
    part(GEO.sphere, pupilMat, [size * 0.14, size * 0.18, size * 0.12], [
      size * 0.64,
      size * 1.92,
      size * 1.45,
    ])
  );

  if (def.id === 'snootle') {
    const snout = part(GEO.cone, accent, [size * 0.34, size * 1.1, size * 0.34], [
      0,
      size * 1.5,
      size * 1.55,
    ]);
    snout.rotation.x = Math.PI / 2;
    group.add(snout);
  }
  if (def.id === 'spittles') {
    const snout = part(GEO.cylinder, accent, [size * 0.28, size * 0.5, size * 0.28], [
      0,
      size * 1.5,
      size * 1.6,
    ]);
    snout.rotation.x = Math.PI / 2;
    group.add(snout);
  }
  if (def.id === 'grumblet') {
    [-1, 1].forEach((side) => {
      const horn = part(GEO.cone, accent, [size * 0.16, size * 0.5, size * 0.16], [
        side * size * 0.6,
        size * 2.5,
        0,
      ]);
      horn.rotation.z = side * 0.4;
      group.add(horn);
      group.add(
        part(GEO.sphere, bodyMat, [size * 0.28, size * 0.2, size * 0.5], [
          side * size * 1.1,
          size * 1.2,
          size * 0.2,
        ])
      );
    });
  }
  if (def.id === 'chonk') {
    for (let i = 0; i < 3; i += 1) {
      group.add(
        part(GEO.cone, mat('#6b5a8c'), [size * 0.22, size * 0.42, size * 0.22], [
          (i - 1) * size * 0.6,
          size * 2.6,
          -size * 0.2,
        ])
      );
    }
  }
  if (def.id === 'wisp') {
    group.add(
      part(GEO.cone, basic('#ffd7ea', 0.9), [size * 0.4, size * 0.8, size * 0.4], [
        0,
        size * 2.6,
        0,
      ])
    );
  }
  if (def.id === 'flitter') {
    const wings = [];
    [-1, 1].forEach((side) => {
      const wing = part(GEO.box, mat(def.accent), [size * 1.5, size * 0.08, size * 0.7], [
        side * size * 1.2,
        size * 1.8,
        0,
      ]);
      wing.rotation.z = side * 0.3;
      wings.push(wing);
      group.add(wing);
    });
    group.userData.wings = wings;
  }

  if (def.id !== 'wisp') {
    group.add(
      part(GEO.sphere, accent, [size * 0.4, size * 0.22, size * 0.5], [
        -size * 0.55,
        size * 0.2,
        size * 0.3,
      ]),
      part(GEO.sphere, accent, [size * 0.4, size * 0.22, size * 0.5], [
        size * 0.55,
        size * 0.2,
        size * 0.3,
      ])
    );
  }

  addCreatureGear(group, size, level);
  const bounds = new THREE.Box3().setFromObject(group);
  group.userData.height = Math.max(0.55, bounds.max.y + 0.12);
  return group;
}

export function buildImp() {
  const group = new THREE.Group();
  group.add(part(GEO.cone, mat('#e0a86a'), [0.3, 0.62, 0.3], [0, 0.34, 0]));
  group.add(part(GEO.sphere, mat('#c98b4b'), [0.24, 0.2, 0.24], [0, 0.66, 0]));
  group.add(
    part(GEO.sphere, basic('#ffffff'), [0.09, 0.1, 0.09], [-0.1, 0.7, 0.17]),
    part(GEO.sphere, basic('#ffffff'), [0.09, 0.1, 0.09], [0.1, 0.7, 0.17]),
    part(GEO.sphere, basic('#241a2e'), [0.04, 0.05, 0.04], [-0.1, 0.7, 0.24]),
    part(GEO.sphere, basic('#241a2e'), [0.04, 0.05, 0.04], [0.1, 0.7, 0.24])
  );
  [-1, 1].forEach((side) => {
    const ear = part(GEO.cone, mat('#c98b4b'), [0.1, 0.32, 0.1], [side * 0.24, 0.82, 0]);
    ear.rotation.z = side * -0.5;
    group.add(ear);
  });
  const pick = part(GEO.box, mat('#9aa0b5'), [0.05, 0.42, 0.05], [0.28, 0.42, 0]);
  pick.rotation.z = -0.4;
  group.add(pick);
  return group;
}

export function buildHero(def) {
  const group = new THREE.Group();
  const bodyMat = mat(def.color);
  const accent = mat(def.accent ?? '#888888');
  const skin = mat('#f0c9a0');
  group.add(
    part(GEO.box, accent, [0.34, 0.34, 0.26], [0, 0.2, 0]),
    part(GEO.cylinder, bodyMat, [0.3, 0.52, 0.26], [0, 0.66, 0]),
    part(GEO.sphere, skin, [0.21, 0.22, 0.21], [0, 1.02, 0])
  );
  group.add(part(GEO.cone, accent, [0.26, 0.32, 0.26], [0, 1.2, 0]));
  if (def.id === 'boss') {
    group.add(part(GEO.cylinder, basic('#ffd166'), [0.28, 0.12, 0.28], [0, 1.38, 0]));
  }
  if (def.ranged) {
    const bow = part(GEO.torus, accent, [1, 1, 1], [0.32, 0.72, 0.12]);
    bow.rotation.y = Math.PI / 2;
    group.add(bow);
  } else {
    const sword = part(GEO.box, basic('#dfe7f2'), [0.06, 0.62, 0.06], [0.32, 0.82, 0.08]);
    sword.rotation.z = -0.2;
    group.add(sword);
    group.add(part(GEO.box, accent, [0.06, 0.4, 0.3], [-0.28, 0.66, 0.1]));
  }
  if (def.id === 'mage') {
    group.add(part(GEO.cone, accent, [0.36, 0.34, 0.36], [0, 1.42, 0]));
  }
  return group;
}
