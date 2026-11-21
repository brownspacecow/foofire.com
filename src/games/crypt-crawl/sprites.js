// Crypt Crawl pixel art — original hand-drawn sprites for Foofire Games.
// Every sprite is a 16x16 grid of characters; one shared palette keeps the
// dark-crypt + gold look consistent. No external images, no copied art.
// Rows are padded/truncated to 16 by the renderer, so a short row is just
// transparent on its right edge, never a crash.

export const SPRITE_SIZE = 16;

const PALETTE = {
  k: '#191024', // outline / near-black
  w: '#fff8e7', // white / cream
  s: '#dde4ee', // silver light
  S: '#9aa3b5', // silver dark
  g: '#ffd93d', // gold
  G: '#c98b1e', // gold dark
  y: '#fff0b8', // pale yellow
  B: '#3f7fc1', // blue
  b: '#8fc3ee', // light blue
  r: '#ef4444', // red
  R: '#9f1d1d', // dark red
  o: '#ff8a00', // orange
  O: '#b85c00', // dark orange
  n: '#3ddc84', // bright green
  N: '#2a9e5f', // mid green
  d: '#1d6b3f', // dark green
  l: '#a5e87a', // lime light
  L: '#4fae52', // lime
  p: '#ff9fb2', // pink
  P: '#d64570', // pink dark
  u: '#a855f7', // purple
  U: '#6b21a8', // purple dark
  t: '#8a5a2b', // brown
  T: '#54371c', // dark brown
  e: '#f2c9a0', // skin
  E: '#c98d5f', // skin shade
  c: '#7dd3fc', // cyan light
  C: '#1d7fb8', // cyan dark
};

function rows(list) {
  return list.map((r) => r.padEnd(16, '.').slice(0, 16));
}

// ---- tiles: sword, shield, potion, coin ----
const SPRITES = {
  'tile-sword': rows([
    '..............',
    '............ss',
    '...........sSs',
    '..........sSs.',
    '.........sSs..',
    '........sSs...',
    '.......sSs....',
    '......sSs.....',
    '.....sSs......',
    '....sSs.......',
    '...sSs........',
    '..ggs.........',
    '.ggggg........',
    '..TgT.........',
    '...TT.........',
    '..............',
  ]),
  'tile-shield': rows([
    '..............',
    '...kkkkkkkk...',
    '..kBBBBBBBBk..',
    '..kBbbBBbbBk..',
    '..kBbbBBbbBk..',
    '..kBBbggbBBk..',
    '..kBBggggBBk..',
    '..kBBbggbBBk..',
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
    '......kGk.....',
    '......kGk.....',
    '.....kNNNk....',
    '....kNNNNNk...',
    '...kNNllNNNk..',
    '...kNlnlNNNk..',
    '..kNNnnnnNNNk.',
    '..kNnnnnnnNk..',
    '..kNnnNnnnNk..',
    '...kNnnnnNk...',
    '....kNNNNk....',
    '.....kkkk.....',
    '..............',
    '..............',
    '..............',
  ]),
  'tile-coin': rows([
    '..............',
    '.....kkkk.....',
    '...kkggggk....',
    '..kgggggggk...',
    '..kggwwwggk...',
    '..kgwwGwwgk...',
    '..kgwwwwwgk...',
    '..kgwwGwwgk...',
    '..kgggggggk...',
    '...kkggggk....',
    '.....kkkk.....',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ]),
};

// ---- heroes: 16x16 portraits, head + shoulders ----
Object.assign(SPRITES, {
  'hero-pip': rows([
    '.....kkkkkk.....',
    '....kNNNNNNk....',
    '...kNNNNNNNNk...',
    '..kNNkkkkkkNNk..',
    '..kNkeeeeeekNk..',
    '..kNkekkkkekNk..',
    '..kNkeeeeeekNk..',
    '..kNkeeEEeekNk..',
    '...kNeeeeeekNk..',
    '...kNekkkkekNk..',
    '....kNNNNNNk....',
    '...kNNNkkNNNk...',
    '..kNNNNNNNNNNk..',
    '..kNNNk..kNNNk..',
    '..kkkk....kkkk..',
    '................',
  ]),
  'hero-bramble': rows([
    '.....ggggg......',
    '....kggggkg.....',
    '....ksssssk.....',
    '...ksssssssk....',
    '..ksssssssssk...',
    '..kssSSSSSSsk...',
    '..kskkkkkkksk...',
    '..kseeeeeeesk..',
    '..ksekkkkesk...',
    '..kseeeeeeesk..',
    '...ksssssssk....',
    '..ksskgggkssk...',
    '..ksssssssssk...',
    '..kkkkkkkkkkk...',
    '................',
    '................',
  ]),
  'hero-moss': rows([
    '...kkkkkkkkk....',
    '..kNNNNNNNNNk...',
    '.kNNdNNNNdNNNk..',
    '.kNNNNNNNNNNNk..',
    '..kkkkkkkkkkk...',
    '..keeeeeeeeek...',
    '..kekkkkkkek....',
    '..keeeeeeeeek...',
    '..keekEEkeek....',
    '...keekkkek.....',
    '...kddddddk.....',
    '...kddddddk.....',
    '..kkkkkkkkkk....',
    '.kNNkkkkkkNNk...',
    '.kNNNk..kNNNk...',
    '................',
  ]),
  'hero-wren': rows([
    '.....kkkkkk.....',
    '....kttttttk....',
    '...kttttttttk...',
    '..kttkkkkkkttk..',
    '..kteeeeeeeetk..',
    '..ktekkkkketk...',
    '..kteeeeeeeetk..',
    '..kteekkeketk...',
    '...keekkkek.....',
    '...keeeeeek.....',
    '....kkkkkk......',
    '..kttttttttttk..',
    '..ktk......ktk..',
    '................',
    '................',
    '................',
  ]),
  'hero-biscuit': rows([
    '....kkkkkkkk....',
    '...kwwwwwwwwk...',
    '..kwwwwwwwwwwk..',
    '..kwkwwwwkwk....',
    '..kwwwwwwwwwwk..',
    '...kkkkkkkkk....',
    '..keeeeeeeeek...',
    '..kekkkkkkek....',
    '..keeeeeeeeek...',
    '..keekEEkeek....',
    '...kkkkkkkk.....',
    '...keeeeeek.....',
    '..kkkkkkkkkk....',
    '..kwwwwwwwwk....',
    '................',
    '................',
  ]),
  'hero-nettle': rows([
    '.......k........',
    '......kUk.......',
    '......kUk.......',
    '.....kUUUk......',
    '.....kUgUk......',
    '....kUUUUUk.....',
    '...kUUUUUUUk....',
    '..kUUUUUUUUUk...',
    '..kkkkkkkkkkk...',
    '..keeeeeeeeek...',
    '..kekkkkkkek....',
    '..keeeeeeeeek...',
    '..keekkkkek.....',
    '...keeeeeek.....',
    '..kkUUUUUUkk....',
    '................',
  ]),
});

// ---- monsters ----
Object.assign(SPRITES, {
  'monster-slime': rows([
    '................',
    '................',
    '....kkkkkk......',
    '...kLLLLLLk.....',
    '..kLlLLLLlLk....',
    '..kLLLLLLLLk....',
    '..kLkwwkwwLk....',
    '..kLkwkwkwLk....',
    '..kLLLLLLLLk....',
    '..kLkKKKKkLk....',
    '...kLLLLLLk.....',
    '..kLLkLLkLLk....',
    '................',
    '................',
    '................',
    '................',
  ]),
  'monster-bat': rows([
    '.kk........kk...',
    '.kUkk....kkUk...',
    '.kUUUkkkkUUUk...',
    '..kUUUUUUUUkk...',
    '...kUUUUUUUk....',
    '..kkUUUUUUkk....',
    '..kUkkkkkkUk....',
    '..kUkwkkwkUk....',
    '..kUkwwwwkUk....',
    '...kUkkkkUk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  'monster-spider': rows([
    '..k..k..k..k....',
    '...k..kk..k.....',
    '....kkkkkk......',
    '...kKKKKKKk.....',
    '..kKKkKKkKKk....',
    '..kKKrrrrKKk....',
    '..kKKKKKKKKk....',
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
  'monster-skeleton': rows([
    '.....kkkk.......',
    '...kkwwwwkk.....',
    '..kwwwwwwwwk....',
    '..kwkkwwkkwk....',
    '..kwwwwwwwwk....',
    '..kwkwwwwkwk....',
    '...kwkwwkwk.....',
    '....kkkkkk......',
    '....kwwwwk......',
    '...kwkwwkwk.....',
    '...kwkwwkwk.....',
    '....kwwwwk......',
    '....kkkkkk......',
    '................',
    '................',
    '................',
  ]),
  'monster-mushroom': rows([
    '....kkkkkk......',
    '..kkrrrrrrkk....',
    '.krrwwwwrrrrk...',
    '.krwwrrrrwwrk...',
    '.krrrrrrrrrrk...',
    '..kkrrrrrrkk....',
    '....kkkkkk......',
    '....kwwwwk......',
    '...kwwwwwwk.....',
    '...kwkwwkwk.....',
    '...kwwwwwwk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  'monster-ghost': rows([
    '.....kkkk.......',
    '...kkwwwwkk.....',
    '..kwwwwwwwwk....',
    '..kwkwwwwkwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwwkwwkwwk....',
    '..kwkwwkwwkwk...',
    '.kk..kk..kk..k..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  'monster-blob': rows([
    '................',
    '................',
    '....kkkkkk......',
    '...kcccccck.....',
    '..kccCccCcck....',
    '..kcccccccck....',
    '..kckwkkwkck....',
    '..kckwkwkck.....',
    '..kcccccccck....',
    '..kcckKKkcck....',
    '...kcccccck.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  'monster-snake': rows([
    '................',
    '.....kkkk.......',
    '....kNNNNk......',
    '...kNkwwkNk.....',
    '...kNkwkwNk.....',
    '....kNNNNk......',
    '....krkr........',
    '...kkkkkkkk.....',
    '..kNNNNNNNNk....',
    '.kNNkNNNNkNNk...',
    '.kNNNNNNNNNNk...',
    '..kkkkkkkkkk....',
    '................',
    '................',
    '................',
    '................',
  ]),
});

// ---- bosses: same style, with a crown / boss treatment ----
Object.assign(SPRITES, {
  'boss-crumb': rows([
    '....kggggk......',
    '...kgkgkgk......',
    '..kkTTTTTTkk....',
    '..kTwwwwwwTk....',
    '..kTTTTTTTTk....',
    '..kTkkkkkkTk....',
    '..kTkwkkwkTk....',
    '..kTTTTTTTTk....',
    '..kTTTTTTTTk....',
    '...kTTTTTTk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  'boss-wobble': rows([
    '....kggggk......',
    '...kgkgkgk......',
    '..kkppppppkk....',
    '..kppppppppk....',
    '..kppwwppwwk....',
    '..kppwkwkwpk....',
    '..kppppppppk....',
    '..kppkKKKppk....',
    '..kppppppppk....',
    '...kppppppk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  'boss-snores': rows([
    '.....kkkkk......',
    '....kBBBBBk.....',
    '...kBBBBBBk.....',
    '..kttttttttk....',
    '..ktkttttktk....',
    '..kttttttttk....',
    '..ktkkttkktk....',
    '..ktkwwwwktk....',
    '..kttwwwwttk....',
    '..kttkwwkttk....',
    '...kttttttk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
  ]),
  'boss-pumpkin': rows([
    '......kk........',
    '......kNk.......',
    '....kkkkkk......',
    '...kooooOook....',
    '..koooooooOok...',
    '..kokkookkok....',
    '..koooooooOok...',
    '..kokkkkkkok....',
    '..kookoookok....',
    '...kooooOook....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // ---- relic extras (others reuse the tile sprites) ----
  'relic-stew': rows([
    '................',
    '................',
    '....kkkkkk......',
    '...knnnnnnk.....',
    '..knnnnnnnnk....',
    '..kttttttttk....',
    '..ktwwwwwwtk....',
    '...kttttttk.....',
    '....kkkkkk......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  'relic-boots': rows([
    '................',
    '......kk........',
    '.....kttk.......',
    '.....kttk.......',
    '.....kttk.......',
    '....kttttk......',
    '...kttttttk.....',
    '..kttttttttk....',
    '..kkkkkkkkkk....',
    '................',
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
