import test from 'node:test';
import assert from 'node:assert/strict';
import { FORT_ARCHETYPES, buildFort, buildRandomFort } from './forts.js';
import { PIECE_DEFS } from './pieces.js';

const DIMS = {
  base: { hx: 3.3, hz: 1.65, h: 0.875 },
  bent: { hx: 2.475, hz: 2.475, h: 0.875 },
  cushion: { hx: 3.3, hz: 1.65, h: 0.55 },
  triangle: { hx: 1.3, hz: 1.2, h: 1.4 },
};

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function extents(entry) {
  const dims = DIMS[entry.type];
  const cos = Math.abs(Math.cos(entry.pose.yaw || 0));
  const sin = Math.abs(Math.sin(entry.pose.yaw || 0));
  return {
    x: dims.hx * cos + dims.hz * sin,
    z: dims.hx * sin + dims.hz * cos,
  };
}

function box(entry) {
  const dims = DIMS[entry.type];
  const size = extents(entry);
  return {
    minX: entry.pose.x - size.x,
    maxX: entry.pose.x + size.x,
    minZ: entry.pose.z - size.z,
    maxZ: entry.pose.z + size.z,
    minY: entry.pose.y - dims.h / 2,
    maxY: entry.pose.y + dims.h / 2,
    flat:
      entry.type === 'base' ||
      entry.type === 'bent' ||
      (entry.type === 'cushion' && (entry.pose.fold || 0) < 0.25),
  };
}

function exposedDecks(pieces) {
  const boxes = pieces.map(box);
  const exposed = boxes.filter(
    (spot) =>
      !boxes.some(
        (other) =>
          other !== spot &&
          other.maxY > spot.maxY + 0.15 &&
          other.minY <= spot.maxY + 0.35 &&
          Math.min(spot.maxX, other.maxX) - Math.max(spot.minX, other.minX) > 0.3 &&
          Math.min(spot.maxZ, other.maxZ) - Math.max(spot.minZ, other.minZ) > 0.3
      )
  );
  return exposed.filter((spot) => spot.flat);
}

test('every random fort layout builds towers inside the arena and inventory', () => {
  for (const archetype of FORT_ARCHETYPES) {
    for (let seed = 0; seed < 24; seed += 1) {
      const fort = buildFort(archetype.id, mulberry32(seed * 101 + 7));
      assert.equal(fort.id, archetype.id);
      assert.equal(fort.name, archetype.name);
      assert.ok(fort.pieces.length >= 8 && fort.pieces.length <= 32, fort.name);

      const counts = { base: 0, cushion: 0, bent: 0, triangle: 0 };
      let highest = 0;
      fort.pieces.forEach((entry) => {
        assert.ok(entry.type in PIECE_DEFS, `${fort.name}: ${entry.type}`);
        counts[entry.type] += 1;
        const pose = entry.pose;
        for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'fold']) {
          assert.ok(Number.isFinite(pose[key]), `${fort.name} pose.${key}`);
        }
        assert.ok(pose.y > 0 && pose.y < 8, `${fort.name} y=${pose.y}`);
        const size = extents(entry);
        assert.ok(
          Math.abs(pose.x) + size.x <= 14.001,
          `${fort.name} x=${pose.x}`
        );
        assert.ok(
          Math.abs(pose.z) + size.z <= 11.001,
          `${fort.name} z=${pose.z}`
        );
        highest = Math.max(highest, pose.y + DIMS[entry.type].h / 2);
      });

      for (const type of Object.keys(PIECE_DEFS)) {
        assert.ok(
          counts[type] <= PIECE_DEFS[type].total,
          `${fort.name} used ${counts[type]} ${type}`
        );
      }
      assert.ok(highest >= 3, `${fort.name} highest=${highest}`);
      assert.ok(exposedDecks(fort.pieces).length >= 1, `${fort.name} has no spawn deck`);
    }
  }
});

test('blocked spawn deck heights still leave a flat place to start', () => {
  // The arena drops wrestlers on the highest flat deck it can find, so every
  // fort only needs one exposed deck even when a bridge covers a balcony.
  for (const archetype of FORT_ARCHETYPES) {
    const fort = buildFort(archetype.id, mulberry32(42));
    const decks = exposedDecks(fort.pieces);
    const highestDeck = Math.max(...decks.map((deck) => deck.maxY));
    assert.ok(highestDeck >= 2.4, `${fort.name} decks at ${highestDeck}`);
  }
});

test('random forts cycle through every archetype', () => {
  const seen = new Set();
  for (let seed = 0; seed < 160; seed += 1) {
    seen.add(buildRandomFort(mulberry32(seed + 1)).id);
  }
  assert.equal(seen.size, FORT_ARCHETYPES.length);
  for (const archetype of FORT_ARCHETYPES) assert.ok(seen.has(archetype.id));
});

test('fort layouts are deterministic for a seed', () => {
  const first = buildFort('twin-keeps', mulberry32(99));
  const second = buildFort('twin-keeps', mulberry32(99));
  assert.deepEqual(first, second);
});
