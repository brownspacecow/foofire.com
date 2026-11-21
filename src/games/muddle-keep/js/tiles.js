/* ------------------------------------------------------------------ *
 * Tile types
 * Tiny shared constants so every module agrees on what a map cell is.
 * ------------------------------------------------------------------ */

export const T = {
  BEDROCK: 0,
  DIRT: 1,
  GOLD: 2,
  DUG: 3,
  FLOOR: 4,
  WATER: 5,
  LAVA: 6,
  WALL: 7,
  DOOR: 8,
};

export const CHAR_TILES = {
  '#': T.BEDROCK,
  '.': T.DIRT,
  g: T.GOLD,
  _: T.FLOOR,
  H: T.FLOOR,
  P: T.FLOOR,
  E: T.FLOOR,
  w: T.WATER,
  l: T.LAVA,
  ' ': T.BEDROCK,
};

/** Tiles a creature or imp can stand on. Doors open for the dungeon's lot. */
export function walkableTile(tile) {
  return tile === T.DUG || tile === T.FLOOR || tile === T.DOOR;
}

/** Things an imp can dig. */
export function diggableTile(tile) {
  return tile === T.DIRT || tile === T.GOLD;
}

/** Things a knight has to knock down on the way in. */
export function destructibleTile(tile) {
  return (
    tile === T.DIRT ||
    tile === T.GOLD ||
    tile === T.WALL ||
    tile === T.DOOR
  );
}

export const TILE_NAMES = {
  [T.BEDROCK]: 'Bedrock',
  [T.DIRT]: 'Dirt',
  [T.GOLD]: 'Gold seam',
  [T.DUG]: 'Dug floor',
  [T.FLOOR]: 'Floor',
  [T.WATER]: 'Water',
  [T.LAVA]: 'Lava',
  [T.WALL]: 'Wall',
  [T.DOOR]: 'Door',
};
