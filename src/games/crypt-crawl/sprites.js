// Crypt Crawl pixel art — redrawn as authentic 8-bit NES sprites.
// Original hand-drawn art for Foofire Games. No external images, no
// copied art. Every sprite is a 16x16 grid of characters drawn from ONE
// NES palette, and each sprite uses at most 3 fill colours + a black
// outline ('k') + transparency ('.'). Shading is done with dithering
// (checkerboard pixels of two palette colours), never smooth shading.
// Rows are padded/truncated to 16 by the renderer, so a short row is
// just transparent on its right edge, never a crash.

export const SPRITE_SIZE = 16;

// Authentic NES palette used by every sprite in this file (and by the
// game CSS in index.html). 'k' is the outline colour, counted separately.
export const NES_PALETTE = {
  k: '#000000', // black — outline
  W: '#FCFCFC', // white
  G: '#BCBCBC', // light grey
  g: '#7C7C7C', // dark grey
  s: '#A4E4FC', // sky
  B: '#0078F8', // blue
  b: '#3CBCFC', // light blue
  d: '#0000FC', // dark blue
  p: '#F8B8F8', // pink
  M: '#D800CC', // magenta
  R: '#E40058', // red
  r: '#F83800', // orange-red
  O: '#E45C10', // orange
  o: '#FCA044', // light orange
  Y: '#F8B800', // yellow
  l: '#B8F818', // lime
  N: '#00B800', // green
  T: '#00A800', // teal
  C: '#00FCFC', // cyan
};

const PALETTE = NES_PALETTE;

function rows(list) {
  return list.map((r) => r.padEnd(16, '.').slice(0, 16));
}

// ---- tiles: sword (W/G/Y), shield (B/b/Y), potion (N/l/W), coin (Y/o/W) ----
const SPRITES = {
  'tile-sword': rows([
    '..............',
    '............WW',
    '...........WGW',
    '..........WGW.',
    '.........WGW..',
    '........WGW...',
    '.......WGW....',
    '......WGW.....',
    '.....WGW......',
    '....WGW.......',
    '...WGW........',
    '..YY..........',
    '.YYYYY........',
    '...kk.........',
    '...kk.........',
    '..............',
  ]),
  'tile-shield': rows([
    '..............',
    '...kkkkkkkk...',
    '..kBBBBBBBBk..',
    '..kBbbBBbbBk..',
    '..kBbbBBbbBk..',
    '..kBBbYYbBBk..',
    '..kBBYYYYBBk..',
    '..kBBbYYbBBk..',
    '...kBBBBBBk...',
    '....kBBBBk....',
    '.....kBBk.....',
    '......kk......',
    '..............',
    '..............',
    '..............',
    '..............',
  ]),
  'tile-potion': rows([
    '......kk......',
    '......kNk.....',
    '......kNk.....',
    '.....kNNNk....',
    '....kNNNNNk...',
    '...kNNllNNNk..',
    '...kNlWNNNk...',
    '..kNNlNlNNNk..',
    '..kNNlNNlNNk..',
    '..kNNNlNNNk...',
    '...kNNNNNk....',
    '....kNNNk.....',
    '.....kkkk.....',
    '..............',
    '..............',
    '..............',
  ]),
  'tile-coin': rows([
    '..............',
    '.....kkkk.....',
    '...kkYYYYkk...',
    '..kYYYYYYYYk..',
    '..kYYWWYYoYk..',
    '..kYWWYYoYk...',
    '..kYWWYYoYk...',
    '..kYYWWYYoYk..',
    '..kYYYYYYYYk..',
    '...kkYYYYkk...',
    '.....kkkk.....',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ]),
};

// ---- heroes: 16x16 portraits, head + shoulders (same heroes, NES restyle) ----
Object.assign(SPRITES, {
  // Pip the Penguin — black body (k), white face + belly (W), orange beak (o).
  'hero-penguin': rows([
    '.....kkkkkk.....',
    '....kkkkkkkk....',
    '...kkkkkkkkkk...',
    '..kkkkkkkkkkkk..',
    '..kkWWWWWWWWkk..',
    '..kkWkWWWWkWkk..',
    '..kkWWWWWWWWkk..',
    '...kkWWooWWkk...',
    '.....kkookk.....',
    '....kkkkkkkk....',
    '...kkkkkkkkkk...',
    '..kkkkWWWWkkkk..',
    '..kkkWWWWWWkkk..',
    '..kkkWWWWWWkkk..',
    '..kkkkkkkkkkkk..',
    '................',
  ]),
  // Bramble the Knight — silver helm (G, dithered with W), cream face (W), gold crest (Y).
  'hero-bramble': rows([
    '.....YYYYY......',
    '....kYYYYYk.....',
    '....kGGGGGk.....',
    '...kGGGGGGGk....',
    '..kGWGWGWGk....',
    '..kGGGGGGGk....',
    '..kGkkkkkkGk...',
    '..kGWWWWWWGk...',
    '..kGWkWWkWGk...',
    '..kGWWWWWWGk...',
    '...kGGGGGGk.....',
    '..kGGkYYkGGk....',
    '..kGGGGGGGk.....',
    '..kkkkkkkkk.....',
    '................',
    '................',
  ]),
  // Moss the Gardener — leaf hat (N/l), cream face (W), green beard (N).
  'hero-moss': rows([
    '...kkkkkkkkk....',
    '..kNNNNNNNNNk...',
    '.kNNlNNlNNlNNk..',
    '.kNNNNNNNNNNNk..',
    '..kkkkkkkkkkk...',
    '..kWWWWWWWWk....',
    '..kWkWWWWkWk....',
    '..kWWWWWWWWk....',
    '..kWWlWWlWWk....',
    '...kWWWWWWk.....',
    '...kNNNNNNk.....',
    '...kNNNNNNk.....',
    '..kkkkkkkkkk....',
    '.kNNkkkkkkNNk...',
    '.kNNNk..kNNNk...',
    '................',
  ]),
  // Wren the Scout — rust hood (O, dithered with o), cream face (W).
  'hero-wren': rows([
    '.....kkkkkk.....',
    '....kOOOOOOk....',
    '...kOOOOOOOOk...',
    '..kOOkkkkkkOOk..',
    '..kOWWWWWWWOOk..',
    '..kOWkWWkWOk....',
    '..kOWWWWWWWOOk..',
    '..kOWWoWWWOOk...',
    '...kOWWWWWOOk...',
    '...kOkkkkkOk....',
    '....kOOOOOk.....',
    '..kOOOOOOOOOOk..',
    '..kOk......kOk..',
    '................',
    '................',
    '................',
  ]),
  // Biscuit the Cook — white chef hat + face (W), red scarf (R), gold apron (Y).
  'hero-biscuit': rows([
    '....kkkkkkkk....',
    '...kWWWWWWWWk...',
    '..kWWWWWWWWWWk..',
    '..kWkWWWWWWkWk..',
    '..kWWWWWWWWWWk..',
    '...kkkkkkkkk....',
    '..kWWWWWWWWk....',
    '..kWkWWWWkWk....',
    '..kWWWWWWWWk....',
    '..kWWRRRRWWk....',
    '...kWRRRRWk.....',
    '...kWWWWWWk.....',
    '..kkkkkkkkkk....',
    '..kYYYYYYYYk....',
    '................',
    '................',
  ]),
  // Nettle the Wizard — purple hat + robe (M), pink dither (p), cream face (W).
  'hero-nettle': rows([
    '.......k........',
    '......kMk.......',
    '......kMk.......',
    '.....kMMMk......',
    '.....kMpMk......',
    '....kMMMMMk.....',
    '...kMMMMMMMk....',
    '..kMMMMMMMMMk...',
    '..kkkkkkkkkkk...',
    '..kWWWWWWWWk....',
    '..kWkWWWWkWk....',
    '..kWWWWWWWWk....',
    '..kWWpWWpWWk....',
    '...kWWWWWWk.....',
    '..kkMMMMMMkk....',
    '................',
  ]),
});

// ---- monsters (same monsters, NES restyle) ----
Object.assign(SPRITES, {
  // Squeaky Slime — green (N), lime dither (l), white eyes (W).
  'monster-slime': rows([
    '................',
    '................',
    '....kkkkkk......',
    '...kNNNNNNk.....',
    '..kNlNNNNlNk....',
    '..kNNNNNNNNk....',
    '..kNkWWkWWNk....',
    '..kNkWkWkWNk....',
    '..kNNNNNNNNk....',
    '..kNkkkkkNk....',
    '...kNNNNNNk.....',
    '..kNNkNNkNNk....',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Wobbly Bat — magenta wings (M), pink dither (p), white eyes (W).
  'monster-bat': rows([
    '.kk........kk...',
    '.kMkk....kkMk...',
    '.kMMMkkkkMMMk...',
    '..kMMMMMMMMkk...',
    '...kMpMpMpMk....',
    '..kkMMMMMMkk....',
    '..kMkkkkkkMk....',
    '..kMkWWkWMk....',
    '..kMkWkWMk.....',
    '...kMkkkkMk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Ticklish Spider — dark-blue body (d), grey dither (g), red eyes (R).
  'monster-spider': rows([
    '..k..k..k..k....',
    '...k..kk..k.....',
    '....kkkkkk......',
    '...kddddddk.....',
    '..kddgddgddk....',
    '..kddRRRRddk....',
    '..kddddddddk....',
    '...kkkkkkkk.....',
    '..k..k..k..k....',
    '.k....kk....k...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Rattly Skeleton — white bone (W), grey shade (G), black eye holes (k).
  'monster-skeleton': rows([
    '.....kkkk.......',
    '...kkWWWWkk.....',
    '..kWWWWWWWWk....',
    '..kWkkWWkkWk....',
    '..kWWWWWWWWk....',
    '..kWkWWWWkWk....',
    '...kWkWWkWk.....',
    '....kkkkkk......',
    '....kWGGWk......',
    '...kWkWWkWk.....',
    '...kWkWWkWk.....',
    '....kWWWWk......',
    '....kkkkkk......',
    '................',
    '................',
    '................',
  ]),
  // Grumpy Mushroom — red cap (R), white spots/face (W), green stem (N).
  'monster-mushroom': rows([
    '....kkkkkk......',
    '..kkRRRRRRkk....',
    '.kRRWWRRWWRRk...',
    '.kRWWRRRRWWRk...',
    '.kRRRRRRRRRRk...',
    '..kkRRRRRRkk....',
    '....kkkkkk......',
    '....kNNNNk......',
    '...kNNNNNNk.....',
    '...kNkNNkNk.....',
    '...kNNNNNNk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Sneezy Ghost — white (W), sky dither (s), black eyes (k).
  'monster-ghost': rows([
    '.....kkkk.......',
    '...kkWWWWkk.....',
    '..kWWWWWWWWk....',
    '..kWkWWWWkWk....',
    '..kWWWWWWWWk....',
    '..kWWsWWsWWk....',
    '..kWWWWWWWWk....',
    '..kWWWWWWWWk....',
    '..kWWkWWkWWk....',
    '..kWkWWkWWkWk...',
    '.kk..kk..kk..k..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Bouncy Blob — cyan (C), sky dither (s), white eyes (W).
  'monster-blob': rows([
    '................',
    '................',
    '....kkkkkk......',
    '...kCCCCCCk.....',
    '..kCCsCCsCCk....',
    '..kCCCCCCCCk....',
    '..kCkWWkWCk.....',
    '..kCkWkWkCk.....',
    '..kCCCCCCCCk....',
    '..kCCkkkkCCk....',
    '...kCCCCCCk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Sleepy Snake — green (N), lime dither (l), red tongue (R), black eyes (k).
  'monster-snake': rows([
    '................',
    '.....kkkk.......',
    '....kNNNNk......',
    '...kNkkkkNk.....',
    '...kNkNNkNk.....',
    '....kNNNNk......',
    '....kRkR........',
    '...kkkkkkkk.....',
    '..kNNNNNNNNk....',
    '.kNNlNNNlNNk....',
    '.kNNNNNNNNNk....',
    '..kkkkkkkkkk....',
    '................',
    '................',
    '................',
    '................',
  ]),
});

// ---- bosses: same bosses, with a crown / boss treatment (NES restyle) ----
Object.assign(SPRITES, {
  // King Crumb the Cake Golem — cake (o/O), gold crown (Y).
  'boss-crumb': rows([
    '....kYYYYk......',
    '...kYkYYkYk.....',
    '..kkooooooOkk...',
    '..koOOOOOOOok...',
    '..koOkkkkOOk....',
    '..koOkkkkOOk....',
    '..koOOOOOOOok...',
    '..koOkkkkOOk....',
    '..koOOOOOOOok...',
    '...koooooOOk....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Queen Wobble the Jelly Giant — pink jelly (p), magenta dither (M), gold crown (Y).
  'boss-wobble': rows([
    '....kYYYYk......',
    '...kYkYYkYk.....',
    '..kkppppppkk....',
    '..kpMpMpMppk....',
    '..kppkkppkk....',
    '..kppkppkppk....',
    '..kppppppppk....',
    '..kppkkkkppk....',
    '..kppppppppk....',
    '...kppppppk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Sir Snores-a-Lot — rust bear (O), light-orange muzzle (o), gold crown (Y).
  'boss-snores': rows([
    '....kYYYYk......',
    '...kYkYYkYk.....',
    '..kkOOOOOOkk....',
    '..kOOOOOOOOOk...',
    '..kOkOOOOOOk....',
    '..kOOOkkkOOOk...',
    '..kOOOOOOOOOk...',
    '..kOkOOOOOOk....',
    '..kOooooooOk....',
    '..kOooooooooOk..',
    '..kOoooooooOk...',
    '...kOOOOOOOk....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
  ]),
  // The Great Grumbly Pumpkin — orange (O), light-orange shade (o), gold stem (Y).
  'boss-pumpkin': rows([
    '......kk........',
    '......kYk.......',
    '....kkkkkk......',
    '...kOOOOOOOk....',
    '..kOOOOOOOOOk...',
    '..kOkkoOOkOOk...',
    '..kOOOOOOOOOk...',
    '..kOkkkkkkOOk...',
    '..kOOkoOOOkOk...',
    '...kOOOOOOOk....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  // ---- relic extras (others reuse the tile sprites) ----
  // Hearty Stew — orange pot (O), orange-red soup (r), white steam (W).
  'relic-stew': rows([
    '.....kWWk.......',
    '....kWWWWk......',
    '....kkkkkk......',
    '...kOOOOOOk.....',
    '..kOOOOOOOOOk...',
    '..krrrrrrrrrk...',
    '..krWWWWWWrk....',
    '...krrrrrrk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Soft Boots — orange boots (O), gold buckle (Y), dark-grey sole (g).
  'relic-boots': rows([
    '................',
    '......kk........',
    '.....kOOk.......',
    '.....kOOk.......',
    '.....kOOk.......',
    '....kOOOOk......',
    '...kOOOOOOk.....',
    '..kOOOOOOOOk....',
    '..kYYYYYYYYk....',
    '..kggggggggk....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
});

/** SVG rects for a sprite (shared by the in-game renderer and cover art). */
export function spriteRects(name) {
  const grid = SPRITES[name];
  if (!grid) return '';
  let out = '';
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || !PALETTE[ch]) continue;
      out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>`;
    }
  }
  return out;
}

/** Inline SVG string for a sprite. Crisp pixels, scales to its container. */
export function spriteSVG(name) {
  return `<svg class="pixel-sprite" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${spriteRects(name)}</svg>`;
}

/** All sprite ids, for tests. */
export function spriteNames() {
  return Object.keys(SPRITES);
}

/** Fill colours (excluding the 'k' outline and '.') used by a sprite, for tests. */
export function spriteColors(name) {
  const grid = SPRITES[name];
  if (!grid) return [];
  const found = new Set();
  for (const row of grid) {
    for (const ch of row) {
      if (ch !== '.' && ch !== 'k') found.add(ch);
    }
  }
  return [...found];
}
