import { PIECE_DEFS } from './pieces.js';

/*
 * Random fort layouts for Rough Housing.
 *
 * Every fort is built from the same foam inventory: big bases, hinged
 * cushions, bent corner bases and triangle wedges. A layout is just a list of
 * piece poses, stacked at exact resting heights with a hair of clearance so
 * Rapier settles the fort without exploding it. Eight archetypes keep the
 * Random fort button from producing the same low heap every time; each one
 * randomises its tower count, height, caps, spacing and ramps.
 *
 * The module has no DOM or three.js imports so `npm test` can generate and
 * check hundreds of forts without a browser.
 */

const GAP = 0.006;

const BASE = PIECE_DEFS.base.size;
const CUSHION = PIECE_DEFS.cushion.panel;
const BENT = PIECE_DEFS.bent.panel;
const TRIANGLE = PIECE_DEFS.triangle.size;

const DIMS = {
  base: { h: BASE[1], hx: BASE[0] / 2, hz: BASE[2] / 2 },
  bent: { h: BENT[1], hx: BENT[0] * 0.75, hz: BENT[2] * 0.75 },
  cushion: { h: CUSHION[1], hx: CUSHION[0], hz: CUSHION[2] / 2 },
  triangle: { h: TRIANGLE[1], hx: TRIANGLE[0] / 2, hz: TRIANGLE[2] / 2 },
};

const ZONE = { halfX: 14, halfZ: 11 };

function makeRng(random) {
  return {
    range(min, max) {
      return min + random() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + random() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(random() * list.length)];
    },
    chance(probability) {
      return random() < probability;
    },
    shuffle(list) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

function piece(type, x, y, z, { yaw = 0, fold = 0 } = {}) {
  return { type, pose: { x, y, z, yaw, pitch: 0, roll: 0, fold } };
}

/* Place a piece on a surface and return the surface it leaves behind. */
function stackPiece(pieces, type, x, z, surface, { yaw = 0, fold = 0 } = {}) {
  const dims = DIMS[type];
  pieces.push(piece(type, x, surface + dims.h / 2 + GAP, z, { yaw, fold }));
  return surface + dims.h;
}

function towerAt(pieces, rng, x, z, levels, options = {}) {
  const { drift = 0.1, yaw = 0, spin = 0, rotate = false } = options;
  let surface = 0;
  for (let level = 0; level < levels; level += 1) {
    const offsetX = level === 0 ? 0 : rng.range(-drift, drift);
    const offsetZ = level === 0 ? 0 : rng.range(-drift, drift);
    const twist = rotate && level % 2 === 1 ? Math.PI / 2 : 0;
    const lean = level === 0 ? 0 : rng.range(-0.035, 0.035);
    surface = stackPiece(
      pieces,
      'base',
      x + offsetX,
      z + offsetZ,
      surface,
      { yaw: yaw + spin * level + twist + lean }
    );
  }
  return surface;
}

function extents(type, yaw = 0) {
  const dims = DIMS[type];
  const cos = Math.abs(Math.cos(yaw));
  const sin = Math.abs(Math.sin(yaw));
  return {
    x: dims.hx * cos + dims.hz * sin,
    z: dims.hx * sin + dims.hz * cos,
  };
}

/*
 * Lean a triangle ramp against one face of a tower. `along` slides it down the
 * wall so long forts can carry two ramps on the same side.
 */
function rampAt(pieces, x, z, halfX, halfZ, side, along = 0) {
  const tri = DIMS.triangle;
  let cx = x;
  let cz = z;
  let yaw = 0;
  if (side === 'east') {
    cx = x + halfX + tri.hx + 0.08;
    cz = z + along;
    yaw = 0;
  } else if (side === 'west') {
    cx = x - halfX - tri.hx - 0.08;
    cz = z + along;
    yaw = Math.PI;
  } else if (side === 'north') {
    cz = z + halfZ + tri.hx + 0.08;
    cx = x + along;
    yaw = -Math.PI / 2;
  } else {
    cz = z - halfZ - tri.hx - 0.08;
    cx = x + along;
    yaw = Math.PI / 2;
  }
  const bounds = extents('triangle', yaw);
  if (
    Math.abs(cx) + bounds.x > ZONE.halfX - 0.05 ||
    Math.abs(cz) + bounds.z > ZONE.halfZ - 0.05
  ) {
    return;
  }
  pieces.push(piece('triangle', cx, tri.h / 2 + GAP, cz, { yaw }));
}

/* A tall gate with a bridge deck between two L-shaped balconies. */
function gatehouse(rng, pieces) {
  const levels = rng.chance(0.65) ? 4 : 3;
  const half = rng.range(4.65, 5.0);
  const leftTop = towerAt(pieces, rng, -half, 0, levels, { drift: 0.05 });
  const rightTop = towerAt(pieces, rng, half, 0, levels, { drift: 0.05 });
  const leftBalcony = stackPiece(pieces, 'bent', -half, 0, leftTop, {
    yaw: rng.range(-0.03, 0.03),
  });
  const rightBalcony = stackPiece(pieces, 'bent', half, 0, rightTop, {
    yaw: rng.range(-0.03, 0.03),
  });
  const bridge = stackPiece(
    pieces,
    'base',
    0,
    0,
    Math.min(leftBalcony, rightBalcony),
    { yaw: rng.range(-0.02, 0.02) }
  );
  if (rng.chance(0.75)) {
    stackPiece(pieces, 'cushion', 0, 0, bridge, { fold: 0 });
  }
  rampAt(pieces, -half, 0, 3.3, 1.65, 'west');
  rampAt(pieces, half, 0, 3.3, 1.65, 'east');
  if (rng.chance(0.7)) {
    rampAt(pieces, -half, 0, 3.3, 1.65, rng.pick(['north', 'south']));
  }
  if (rng.chance(0.7)) {
    rampAt(pieces, half, 0, 3.3, 1.65, rng.pick(['north', 'south']));
  }
  return 'Gatehouse';
}

/* Three pillars linked by two high decks: one long base, one bent span. */
function skyway(rng, pieces) {
  const spacing = rng.range(6.75, 7.0);
  const levels = rng.chance(0.8) ? 3 : 2;
  const tops = [-spacing, 0, spacing].map((x) =>
    towerAt(pieces, rng, x, 0, levels, { drift: 0.05 })
  );
  const leftDeck = stackPiece(
    pieces,
    'base',
    -spacing / 2,
    0,
    Math.min(tops[0], tops[1]),
    { yaw: rng.range(-0.02, 0.02) }
  );
  const rightDeck = stackPiece(
    pieces,
    levels === 3 ? 'bent' : 'base',
    spacing / 2,
    0,
    Math.min(tops[1], tops[2]),
    { yaw: levels === 3 ? 0 : rng.range(-0.02, 0.02) }
  );
  if (rng.chance(0.8)) stackPiece(pieces, 'cushion', -spacing / 2, 0, leftDeck, { fold: 0 });
  if (rng.chance(0.8)) stackPiece(pieces, 'cushion', spacing / 2, 0, rightDeck, { fold: 0 });
  rampAt(pieces, -spacing, 0, 3.3, 1.65, 'west');
  rampAt(pieces, spacing, 0, 3.3, 1.65, 'east');
  rampAt(pieces, 0, 0, 3.3, 1.65, rng.pick(['north', 'south']));
  if (rng.chance(0.6)) {
    rampAt(
      pieces,
      rng.pick([-spacing, spacing]),
      0,
      3.3,
      1.65,
      rng.pick(['north', 'south'])
    );
  }
  return 'Skyway';
}

/* Stepped tower with alternating crossed tiers, plus a smaller keep. */
function pagoda(rng, pieces) {
  const levels = rng.int(4, 5);
  const x = rng.range(-5.2, -3.6);
  const z = rng.range(-1.2, 1.2);
  const top = towerAt(pieces, rng, x, z, levels, {
    rotate: true,
    drift: 0.05,
  });
  // Match the cap to the top tier's cross: an even level count ends on a
  // 90-degree tier, so an unrotated 6.6-wide cushion would overhang it.
  const capYaw = levels % 2 === 0 ? Math.PI / 2 : 0;
  stackPiece(pieces, rng.chance(0.75) ? 'cushion' : 'bent', x, z, top, {
    yaw: capYaw + rng.range(-0.03, 0.03),
    fold: 0,
  });

  const sideX = x + rng.range(9.6, 10.2);
  const sideZ = z + rng.range(3.4, 5.2);
  const sideLevels = rng.int(2, 3);
  const sideTop = towerAt(pieces, rng, sideX, sideZ, sideLevels, { drift: 0.06 });
  stackPiece(pieces, rng.chance(0.6) ? 'bent' : 'cushion', sideX, sideZ, sideTop, {
    yaw: rng.range(-0.04, 0.04),
    fold: 0,
  });

  // Only the east/west faces are clear: the 90-degree tiers overhang the
  // north/south faces and would crush a ramp placed there.
  rampAt(pieces, x, z, 3.3, 1.65, 'west');
  rampAt(pieces, x, z, 3.3, 1.65, 'east');
  const firstSide = rng.pick(['east', 'north', 'south']);
  rampAt(pieces, sideX, sideZ, 3.3, 1.65, firstSide);
  if (rng.chance(0.65)) {
    const secondSide = rng.pick(
      ['east', 'north', 'south', 'west'].filter((side) => side !== firstSide)
    );
    rampAt(pieces, sideX, sideZ, 3.3, 1.65, secondSide);
  }
  return 'Pagoda';
}

/* Long two-storey hall: capstone roof, end balconies, ramps all around. */
function longhouse(rng, pieces) {
  const span = rng.range(3.4, 3.8);
  let surface = 0;
  const leftLower = stackPiece(pieces, 'base', -span, 0, surface, {});
  const rightLower = stackPiece(pieces, 'base', span, 0, surface, {});
  surface = Math.min(leftLower, rightLower);
  const leftUpper = stackPiece(pieces, 'base', -span, 0, surface, {});
  const rightUpper = stackPiece(pieces, 'base', span, 0, surface, {});
  surface = Math.min(leftUpper, rightUpper);
  const cap = stackPiece(pieces, 'base', 0, 0, surface, {});
  const crown = stackPiece(pieces, 'base', 0, 0, cap, {});
  stackPiece(pieces, 'cushion', 0, 0, crown, { fold: 0 });

  stackPiece(pieces, 'bent', -span - 2.55, 0, Math.min(leftUpper, rightUpper), {
    yaw: rng.range(-0.03, 0.03),
  });
  stackPiece(pieces, 'bent', span + 2.55, 0, Math.min(leftUpper, rightUpper), {
    yaw: rng.range(-0.03, 0.03),
  });

  rampAt(pieces, -span, 0, 3.3, 1.65, 'south', -1.5);
  rampAt(pieces, span, 0, 3.3, 1.65, 'south', 1.5);
  rampAt(pieces, -span, 0, 3.3, 1.65, 'north', 1.5);
  rampAt(pieces, span, 0, 3.3, 1.65, 'north', -1.5);
  if (rng.chance(0.55)) {
    rampAt(pieces, -span, 0, 3.3, 1.65, 'west');
  }
  if (rng.chance(0.55)) {
    rampAt(pieces, span, 0, 3.3, 1.65, 'east');
  }
  return 'Longhouse';
}

/* Three keeps of different heights with bent rooftops. */
function twinKeeps(rng, pieces) {
  const spots = [
    { x: rng.range(-7.6, -6.4), z: rng.range(-4.6, -2.6) },
    { x: rng.range(-0.6, 1.0), z: rng.range(3.2, 5.2) },
    { x: rng.range(6.4, 7.6), z: rng.range(-4.4, -2.4) },
  ];
  const levels = rng.shuffle([3, 3, 4]);
  const caps = rng.shuffle(['cushion', 'bent', 'bent']);
  spots.forEach((spot, index) => {
    const top = towerAt(pieces, rng, spot.x, spot.z, levels[index], {
      drift: 0.07,
    });
    stackPiece(pieces, caps[index], spot.x, spot.z, top, {
      yaw: rng.range(-0.04, 0.04),
      fold: 0,
    });
  });
  rampAt(pieces, spots[0].x, spots[0].z, 3.3, 1.65, 'west');
  rampAt(pieces, spots[1].x, spots[1].z, 3.3, 1.65, 'north');
  rampAt(pieces, spots[2].x, spots[2].z, 3.3, 1.65, 'east');
  if (rng.chance(0.7)) {
    rampAt(pieces, spots[0].x, spots[0].z, 3.3, 1.65, 'south');
  }
  if (rng.chance(0.7)) {
    rampAt(pieces, spots[2].x, spots[2].z, 3.3, 1.65, 'south');
  }
  return 'Twin Keeps';
}

/* A cantilevered lookout tower beside a smaller bent-roofed keep. */
function lookout(rng, pieces) {
  const x = rng.range(-4.4, -2.6);
  const z = rng.range(-1.2, 1.2);
  const levels = rng.int(4, 5);
  let surface = 0;
  let topX = x;
  let topZ = z;
  for (let level = 0; level < levels; level += 1) {
    const last = level === levels - 1;
    const offsetX = level === 0 ? 0 : rng.range(-0.1, 0.1);
    const offsetZ =
      (level === 0 ? 0 : rng.range(-0.1, 0.1)) +
      (last ? rng.range(0.7, 1.2) : 0);
    topX = x + offsetX;
    topZ = z + offsetZ;
    surface = stackPiece(pieces, 'base', topX, topZ, surface, {
      yaw: level === 0 ? 0 : rng.range(-0.04, 0.04),
    });
  }
  stackPiece(pieces, 'cushion', topX, topZ, surface, { fold: 0 });

  const sideX = x + rng.range(8.8, 9.6);
  const sideZ = z + rng.range(3.2, 4.8);
  const sideTop = towerAt(pieces, rng, sideX, sideZ, 2, { drift: 0.05 });
  stackPiece(pieces, 'bent', sideX, sideZ, sideTop, {
    yaw: rng.range(-0.04, 0.04),
  });

  rampAt(pieces, x, z, 3.3, 1.65, 'west');
  rampAt(pieces, x, z, 3.3, 1.65, 'east');
  rampAt(pieces, sideX, sideZ, 3.3, 1.65, 'east');
  if (rng.chance(0.6)) {
    rampAt(pieces, sideX, sideZ, 3.3, 1.65, rng.pick(['north', 'south']));
  }
  return 'Lookout';
}

/* Tall central keep with two low gun platforms. */
function citadel(rng, pieces) {
  const x = rng.range(-5.2, -3.8);
  const z = rng.range(-1.2, 0.8);
  const levels = rng.chance(0.6) ? 5 : 4;
  const top = towerAt(pieces, rng, x, z, levels, { drift: 0.06 });
  stackPiece(pieces, rng.chance(0.75) ? 'cushion' : 'bent', x, z, top, {
    yaw: rng.range(-0.04, 0.04),
    fold: 0,
  });

  const sideX = x + rng.range(8.6, 9.4);
  const sideNorthZ = z + rng.range(2.6, 4.2);
  const sideSouthZ = z - rng.range(4.4, 5.6);
  for (const sideZ of [sideNorthZ, sideSouthZ]) {
    const sideTop = towerAt(pieces, rng, sideX, sideZ, 2, { drift: 0.05 });
    stackPiece(pieces, 'bent', sideX, sideZ, sideTop, {
      yaw: rng.range(-0.04, 0.04),
    });
  }

  rampAt(pieces, x, z, 3.3, 1.65, 'west');
  rampAt(pieces, x, z, 3.3, 1.65, 'east');
  rampAt(pieces, sideX, sideNorthZ, 3.3, 1.65, 'north');
  rampAt(pieces, sideX, sideSouthZ, 3.3, 1.65, 'east');
  if (rng.chance(0.6)) {
    rampAt(pieces, sideX, sideNorthZ, 3.3, 1.65, 'east');
  }
  return 'Citadel';
}

/* Four corner towers with bent battlements and a courtyard between them. */
function fourCorners(rng, pieces) {
  const x = rng.range(4.9, 5.5);
  const z = rng.range(4.9, 5.5);
  const spots = [
    { x: -x, z: -z },
    { x, z: -z },
    { x, z },
    { x: -x, z },
  ];
  const levels = rng.shuffle([2, 2, 3, 3]);
  spots.forEach((spot, index) => {
    const jitterX = rng.range(-0.2, 0.2);
    const jitterZ = rng.range(-0.2, 0.2);
    const top = towerAt(pieces, rng, spot.x + jitterX, spot.z + jitterZ, levels[index], {
      drift: 0.06,
    });
    stackPiece(pieces, 'bent', spot.x + jitterX, spot.z + jitterZ, top, {
      yaw: rng.range(-0.05, 0.05),
    });
  });
  rampAt(pieces, -x, -z, 3.3, 1.65, 'west');
  rampAt(pieces, x, -z, 3.3, 1.65, 'east');
  rampAt(pieces, x, z, 3.3, 1.65, 'north');
  rampAt(pieces, -x, z, 3.3, 1.65, 'south');
  if (rng.chance(0.6)) {
    rampAt(pieces, -x, z, 3.3, 1.65, 'north');
  }
  return 'Four Corners';
}

export const FORT_ARCHETYPES = [
  { id: 'gatehouse', name: 'Gatehouse', build: gatehouse },
  { id: 'skyway', name: 'Skyway', build: skyway },
  { id: 'pagoda', name: 'Pagoda', build: pagoda },
  { id: 'longhouse', name: 'Longhouse', build: longhouse },
  { id: 'twin-keeps', name: 'Twin Keeps', build: twinKeeps },
  { id: 'lookout', name: 'Lookout', build: lookout },
  { id: 'citadel', name: 'Citadel', build: citadel },
  { id: 'four-corners', name: 'Four Corners', build: fourCorners },
];

export function buildFort(id, random = Math.random) {
  const archetype = FORT_ARCHETYPES.find((entry) => entry.id === id);
  if (!archetype) throw new Error(`Unknown fort layout: ${id}`);
  const pieces = [];
  archetype.build(makeRng(random), pieces);
  return { id: archetype.id, name: archetype.name, pieces };
}

export function buildRandomFort(random = Math.random) {
  const archetype = FORT_ARCHETYPES[Math.floor(random() * FORT_ARCHETYPES.length)];
  return buildFort(archetype.id, random);
}
