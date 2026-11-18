// 180 original ornaments for Christmas Trees and Missals, in 15 holiday sets.
// Rows: id, name, holiday, rarity, price, shape, color, accent, pattern, icon
const ROWS = [
  // ---------------------------------------------------------------- Christmas
  ['red-bauble', 'Red Bauble', 'christmas', 'common', 45, 'bauble', '#d62828', '#ffd93d', 'dots', '🔴'],
  ['pine-star', 'Pine Star', 'christmas', 'common', 50, 'star', '#ffd93d', '#2f7d32', 'stars', '⭐'],
  ['candy-cane', 'Candy Cane', 'christmas', 'common', 55, 'candyCane', '#d62828', '#fff8e7', 'stripes', '🍬'],
  ['frost-snowflake', 'Frost Snowflake', 'christmas', 'common', 60, 'snowflake', '#a5d8ff', '#e0f2ff', 'snow', '❄️'],
  ['holly-sprig', 'Holly Sprig', 'christmas', 'common', 65, 'holly', '#2f7d32', '#d62828', 'none', '🌿'],
  ['gingerbread-kid', 'Gingerbread Kid', 'christmas', 'common', 70, 'gingerbread', '#b5651d', '#fff8e7', 'dots', '🍪'],
  ['jingle-bell', 'Jingle Bell', 'christmas', 'rare', 160, 'bell', '#ffd93d', '#d62828', 'none', '🔔'],
  ['cosy-stocking', 'Cosy Stocking', 'christmas', 'rare', 195, 'stocking', '#d62828', '#fff8e7', 'stripes', '🧦'],
  ['merry-wreath', 'Merry Wreath', 'christmas', 'rare', 235, 'wreath', '#2f7d32', '#d62828', 'dots', '🎀'],
  ['snow-globe', 'Snow Globe', 'christmas', 'epic', 540, 'snowglobe', '#7dd3fc', '#fff8e7', 'snow', '🔮'],
  ['toy-train', 'Toy Train', 'christmas', 'epic', 620, 'train', '#2f7d32', '#ffd93d', 'stars', '🚂'],
  ['christmas-rocket', 'Christmas Rocket', 'christmas', 'legendary', 1950, 'rocket', '#d62828', '#ffd93d', 'glitter', '🚀'],

  // ---------------------------------------------------------------- Halloween
  ['tiny-pumpkin', 'Tiny Pumpkin', 'halloween', 'common', 45, 'pumpkin', '#ff8a00', '#2f7d32', 'none', '🎃'],
  ['candy-corn', 'Candy Corn', 'halloween', 'common', 48, 'candycorn', '#ff8a00', '#ffd93d', 'stripes', '🍬'],
  ['friendly-bat', 'Friendly Bat', 'halloween', 'common', 52, 'bat', '#7c3aed', '#ff8fc7', 'dots', '🦇'],
  ['boo-drop', 'Boo Drop', 'halloween', 'common', 58, 'ghost', '#e8f1ff', '#a5d8ff', 'none', '👻'],
  ['witch-hat', 'Witch Hat', 'halloween', 'common', 62, 'witchhat', '#5b21b6', '#a3e635', 'stars', '🧙'],
  ['spider-pal', 'Spider Pal', 'halloween', 'common', 68, 'spider', '#241a2e', '#a855f7', 'dots', '🕷️'],
  ['jack-o-lantern', 'Jack-o’-Lantern', 'halloween', 'rare', 165, 'pumpkin', '#ff8a00', '#241a2e', 'face', '🎃'],
  ['bubbling-cauldron', 'Bubbling Cauldron', 'halloween', 'rare', 195, 'cauldron', '#241a2e', '#3ddc84', 'dots', '🧪'],
  ['bone-bauble', 'Bone Bauble', 'halloween', 'rare', 235, 'bauble', '#efe6d5', '#7c3aed', 'swirl', '💀'],
  ['haunted-house', 'Haunted House', 'halloween', 'epic', 560, 'house', '#5b21b6', '#ff8a00', 'stars', '🏚️'],
  ['coffin-candy', 'Coffin Candy', 'halloween', 'epic', 610, 'coffin', '#6b4a2f', '#a855f7', 'dots', '⚰️'],
  ['great-pumpkin', 'Great Pumpkin', 'halloween', 'legendary', 2100, 'pumpkin', '#ff8a00', '#ffd93d', 'face', '🎃'],

  // ------------------------------------------------------------------- Easter
  ['dyed-egg', 'Dyed Egg', 'easter', 'common', 42, 'egg', '#ff8fc7', '#7dd3fc', 'dots', '🥚'],
  ['choc-bunny', 'Chocolate Bunny', 'easter', 'common', 50, 'bunny', '#7c4a2d', '#ff8fc7', 'none', '🐰'],
  ['baby-chick', 'Baby Chick', 'easter', 'common', 54, 'chick', '#ffd93d', '#ff8a00', 'none', '🐥'],
  ['spring-tulip', 'Spring Tulip', 'easter', 'common', 58, 'flower', '#ff5d8f', '#2f7d32', 'none', '🌷'],
  ['lucky-carrot', 'Lucky Carrot', 'easter', 'common', 64, 'carrot', '#ff8a00', '#3ddc84', 'stripes', '🥕'],
  ['jelly-bean', 'Jelly Bean', 'easter', 'common', 70, 'bean', '#ff6b6b', '#3ddc84', 'dots', '🫘'],
  ['easter-basket', 'Easter Basket', 'easter', 'rare', 170, 'basket', '#c9a27e', '#ff8fc7', 'dots', '🧺'],
  ['golden-egg', 'Golden Egg', 'easter', 'rare', 240, 'egg', '#ffd93d', '#fff8e7', 'stars', '🌟'],
  ['bunny-ears', 'Bunny Ears', 'easter', 'rare', 280, 'ears', '#fff8e7', '#ff8fc7', 'none', '🐰'],
  ['egg-tree', 'Egg Tree', 'easter', 'epic', 520, 'tree', '#b9f6ca', '#ff8fc7', 'dots', '🌳'],
  ['spring-lamb', 'Spring Lamb', 'easter', 'epic', 600, 'lamb', '#fff4ea', '#ff8fc7', 'dots', '🐑'],
  ['faberge-egg', 'Fabergé Egg', 'easter', 'legendary', 2300, 'egg', '#2ec4ff', '#ffd93d', 'glitter', '💎'],

  // -------------------------------------------------------------- Valentine's
  ['candy-heart', 'Candy Heart', 'valentines', 'common', 44, 'heart', '#ff2e63', '#fff8e7', 'dots', '💗'],
  ['cupid-arrow', 'Cupid Arrow', 'valentines', 'common', 50, 'arrow', '#ff8fc7', '#ffd93d', 'none', '🏹'],
  ['valentine-rose', 'Valentine Rose', 'valentines', 'common', 56, 'rose', '#d62828', '#2f7d32', 'none', '🌹'],
  ['love-letter', 'Love Letter', 'valentines', 'common', 62, 'envelope', '#fff4ea', '#d62828', 'none', '💌'],
  ['choc-drop', 'Chocolate Drop', 'valentines', 'common', 68, 'bean', '#7c4a2d', '#ff8fc7', 'none', '🍫'],
  ['cuddle-bear', 'Cuddle Bear', 'valentines', 'common', 72, 'bear', '#c98a5c', '#ff8fc7', 'dots', '🧸'],
  ['cupids-bow', 'Cupid’s Bow', 'valentines', 'rare', 170, 'bow', '#ffd93d', '#ff8fc7', 'stars', '🎀'],
  ['heart-locket', 'Heart Locket', 'valentines', 'rare', 210, 'heart', '#ffd93d', '#ff2e63', 'glitter', '💛'],
  ['rose-bouquet', 'Rose Bouquet', 'valentines', 'rare', 260, 'flower', '#d62828', '#ff8fc7', 'dots', '💐'],
  ['sweetheart-cake', 'Sweetheart Cake', 'valentines', 'epic', 540, 'cake', '#ffb3c7', '#fff8e7', 'dots', '🎂'],
  ['lovebirds', 'Lovebirds', 'valentines', 'epic', 620, 'birds', '#ff5d8f', '#ffd93d', 'none', '🐦'],
  ['true-love-star', 'True Love Star', 'valentines', 'legendary', 2150, 'star', '#ff5d8f', '#ffd93d', 'glitter', '💖'],

  // ------------------------------------------------------------- Thanksgiving
  ['pumpkin-pie', 'Pumpkin Pie', 'thanksgiving', 'common', 46, 'pie', '#ff8a00', '#c9a27e', 'stripes', '🥧'],
  ['acorn-drop', 'Acorn Drop', 'thanksgiving', 'common', 50, 'acorn', '#8b5a3c', '#3ddc84', 'none', '🌰'],
  ['turkey-feather', 'Turkey Feather', 'thanksgiving', 'common', 56, 'feather', '#c98a5c', '#ff8a00', 'stripes', '🪶'],
  ['corn-cob', 'Corn Cob', 'thanksgiving', 'common', 60, 'corn', '#ffd93d', '#3ddc84', 'dots', '🌽'],
  ['leaf-pile', 'Leaf Pile', 'thanksgiving', 'common', 66, 'leaf', '#ff6b35', '#d62828', 'none', '🍁'],
  ['apple-cider', 'Apple Cider', 'thanksgiving', 'common', 72, 'mug', '#b5651d', '#d62828', 'none', '🍎'],
  ['horn-plenty', 'Horn of Plenty', 'thanksgiving', 'rare', 175, 'basket', '#b5651d', '#ffd93d', 'dots', '🍇'],
  ['roast-turkey', 'Roast Turkey', 'thanksgiving', 'rare', 205, 'turkey', '#a9713c', '#ff8a00', 'none', '🦃'],
  ['scarecrow', 'Scarecrow', 'thanksgiving', 'rare', 250, 'scarecrow', '#c9a27e', '#7c4a2d', 'dots', '🌾'],
  ['harvest-moon', 'Harvest Moon', 'thanksgiving', 'epic', 530, 'moon', '#ffd93d', '#ff8a00', 'glitter', '🌙'],
  ['thankful-tree', 'Thankful Tree', 'thanksgiving', 'epic', 640, 'tree', '#ffd93d', '#b5651d', 'stars', '🍂'],
  ['golden-drumstick', 'Golden Drumstick', 'thanksgiving', 'legendary', 2000, 'drumstick', '#ffd93d', '#b5651d', 'glitter', '🍗'],

  // ----------------------------------------------------------------- Hanukkah
  ['blue-dreidel', 'Blue Dreidel', 'hanukkah', 'common', 44, 'dreidel', '#2d6cdf', '#fff8e7', 'stars', '🎲'],
  ['gelt-coin', 'Hanukkah Gelt', 'hanukkah', 'common', 50, 'coin', '#ffd93d', '#2d6cdf', 'none', '🪙'],
  ['temple-menorah', 'Temple Menorah', 'hanukkah', 'common', 56, 'menorah', '#ffd93d', '#2d6cdf', 'none', '🕎'],
  ['crispy-latke', 'Crispy Latke', 'hanukkah', 'common', 62, 'latke', '#ffd93d', '#b5651d', 'dots', '🥔'],
  ['star-of-david', 'Star of David', 'hanukkah', 'common', 68, 'davidstar', '#2d6cdf', '#fff8e7', 'none', '✡️'],
  ['sufganiyah', 'Sufganiyah', 'hanukkah', 'common', 74, 'donut', '#ff8fc7', '#2d6cdf', 'dots', '🍩'],
  ['festival-candle', 'Festival Candle', 'hanukkah', 'rare', 170, 'candle', '#2d6cdf', '#ffd93d', 'none', '🕯️'],
  ['eight-nights', 'Eight Nights', 'hanukkah', 'rare', 215, 'eight', '#2d6cdf', '#e8f1ff', 'stars', '8️⃣'],
  ['torah-scroll', 'Torah Scroll', 'hanukkah', 'rare', 260, 'scroll', '#fff4ea', '#2d6cdf', 'none', '📜'],
  ['silver-menorah', 'Silver Menorah', 'hanukkah', 'epic', 555, 'menorah', '#cfd8e3', '#2d6cdf', 'stars', '🕎'],
  ['miracle-oil', 'Miracle Oil', 'hanukkah', 'epic', 630, 'oil', '#ffd93d', '#2d6cdf', 'glitter', '🫒'],
  ['eternal-flame', 'Eternal Flame', 'hanukkah', 'legendary', 2080, 'flame', '#ffd93d', '#2d6cdf', 'glitter', '🔥'],

  // ------------------------------------------------------------------- Diwali
  ['diya-lamp', 'Diya Lamp', 'diwali', 'common', 45, 'diya', '#c1683f', '#ffd93d', 'none', '🪔'],
  ['marigold', 'Marigold', 'diwali', 'common', 50, 'flower', '#ff8a00', '#ffd93d', 'none', '🌼'],
  ['rangoli-dot', 'Rangoli Dot', 'diwali', 'common', 56, 'rangoli', '#ff5d8f', '#2ec4ff', 'dots', '🎨'],
  ['sparkler', 'Sparkler', 'diwali', 'common', 62, 'sparkler', '#ffd93d', '#ff5d8f', 'glitter', '✨'],
  ['mango-lassi', 'Mango Lassi', 'diwali', 'common', 68, 'mug', '#ffd93d', '#ff8fc7', 'none', '🥭'],
  ['lotus-light', 'Lotus Light', 'diwali', 'common', 74, 'lotus', '#ff8fc7', '#ffd93d', 'dots', '🪷'],
  ['lantern-string', 'Lantern String', 'diwali', 'rare', 175, 'lantern', '#ffd93d', '#d62828', 'stars', '🏮'],
  ['dhol-drum', 'Dhol Drum', 'diwali', 'rare', 215, 'drum', '#d62828', '#ffd93d', 'stripes', '🥁'],
  ['sweet-box', 'Sweet Box', 'diwali', 'rare', 260, 'gift', '#ffd93d', '#ff8fc7', 'dots', '🍬'],
  ['peacock-feather', 'Peacock Feather', 'diwali', 'epic', 545, 'peacock', '#2ec4ff', '#a855f7', 'stars', '🦚'],
  ['firework-crown', 'Firework Crown', 'diwali', 'epic', 640, 'firework', '#ffd93d', '#ff5d8f', 'glitter', '🎆'],
  ['festival-lights', 'Festival of Lights', 'diwali', 'legendary', 2200, 'sun', '#ffd93d', '#ff8a00', 'glitter', '🌟'],

  // ----------------------------------------------------------- Lunar New Year
  ['red-envelope', 'Red Envelope', 'lunar', 'common', 45, 'envelope', '#d62828', '#ffd93d', 'dots', '🧧'],
  ['lucky-lantern', 'Lucky Lantern', 'lunar', 'common', 50, 'lantern', '#d62828', '#ffd93d', 'none', '🏮'],
  ['mandarin-orange', 'Mandarin Orange', 'lunar', 'common', 56, 'orange', '#ff8a00', '#2f7d32', 'none', '🍊'],
  ['dragon-scale', 'Dragon Scale', 'lunar', 'common', 62, 'scale', '#d62828', '#ffd93d', 'stripes', '🐉'],
  ['lucky-coin', 'Lucky Coin', 'lunar', 'common', 68, 'coin', '#ffd93d', '#d62828', 'none', '🪙'],
  ['firecracker', 'Firecracker', 'lunar', 'common', 74, 'firecracker', '#d62828', '#ffd93d', 'stripes', '🧨'],
  ['lucky-dumpling', 'Lucky Dumpling', 'lunar', 'rare', 180, 'dumpling', '#fff4ea', '#d62828', 'none', '🥟'],
  ['dragon-dance', 'Dragon Dance', 'lunar', 'rare', 220, 'dragon', '#d62828', '#ffd93d', 'dots', '🐲'],
  ['blossom-branch', 'Blossom Branch', 'lunar', 'rare', 265, 'flower', '#ffb3c7', '#8b5a3c', 'dots', '🌸'],
  ['lion-dance', 'Lion Dance', 'lunar', 'epic', 550, 'lion', '#ff8a00', '#d62828', 'stars', '🦁'],
  ['golden-dragon', 'Golden Dragon', 'lunar', 'epic', 650, 'dragon', '#ffd93d', '#d62828', 'glitter', '🐉'],
  ['year-of-the-tree', 'Year of the Tree', 'lunar', 'legendary', 2250, 'tree', '#d62828', '#ffd93d', 'glitter', '🌳'],

  // ------------------------------------------------------------ Fourth of July
  ['firework-pop', 'Firework Pop', 'july4', 'common', 44, 'firework', '#d62828', '#2ec4ff', 'glitter', '🎆'],
  ['star-spangled-bauble', 'Star-Spangled Bauble', 'july4', 'common', 50, 'bauble', '#2d6cdf', '#d62828', 'stars', '🇺🇸'],
  ['picnic-hot-dog', 'Picnic Hot Dog', 'july4', 'common', 56, 'hotdog', '#c98a5c', '#d62828', 'stripes', '🌭'],
  ['rocket-pop', 'Rocket Pop', 'july4', 'common', 62, 'popsicle', '#d62828', '#fff8e7', 'stripes', '🚀'],
  ['uncle-sam-hat', 'Uncle Sam Hat', 'july4', 'common', 68, 'tophat', '#d62828', '#fff8e7', 'stripes', '🎩'],
  ['sparkler-stick', 'Sparkler Stick', 'july4', 'common', 74, 'sparkler', '#ffd93d', '#2d6cdf', 'glitter', '🎇'],
  ['picnic-basket', 'Picnic Basket', 'july4', 'rare', 175, 'basket', '#c9a27e', '#d62828', 'dots', '🧺'],
  ['liberty-bell', 'Liberty Bell', 'july4', 'rare', 215, 'bell', '#ffd93d', '#2d6cdf', 'stars', '🔔'],
  ['liberty-star', 'Liberty Star', 'july4', 'rare', 260, 'star', '#fff8e7', '#2ec4ff', 'stars', '⭐'],
  ['eagle-feather', 'Eagle Feather', 'july4', 'epic', 540, 'feather', '#fff8e7', '#2d6cdf', 'none', '🦅'],
  ['fireworks-finale', 'Fireworks Finale', 'july4', 'epic', 640, 'firework', '#ffd93d', '#d62828', 'glitter', '🎆'],
  ['freedom-star', 'Freedom Star', 'july4', 'legendary', 2150, 'star', '#ffd93d', '#2d6cdf', 'glitter', '🌟'],

  // ------------------------------------------------------------- St. Patrick's
  ['lucky-shamrock', 'Lucky Shamrock', 'stpatricks', 'common', 44, 'clover', '#2f9e44', '#b9f6ca', 'none', '🍀'],
  ['pot-of-gold', 'Pot of Gold', 'stpatricks', 'common', 50, 'pot', '#241a2e', '#ffd93d', 'none', '🪙'],
  ['tiny-rainbow', 'Tiny Rainbow', 'stpatricks', 'common', 56, 'rainbow', '#ff5d8f', '#ffd93d', 'stripes', '🌈'],
  ['lucky-horseshoe', 'Lucky Horseshoe', 'stpatricks', 'common', 62, 'horseshoe', '#ffd93d', '#2f9e44', 'none', '🧲'],
  ['leprechaun-hat', 'Leprechaun Hat', 'stpatricks', 'common', 68, 'tophat', '#2f9e44', '#ffd93d', 'stripes', '🎩'],
  ['clover-cookie', 'Clover Cookie', 'stpatricks', 'common', 74, 'cookie', '#b9f6ca', '#2f9e44', 'dots', '🍪'],
  ['lucky-fiddle', 'Lucky Fiddle', 'stpatricks', 'rare', 170, 'fiddle', '#8b5a3c', '#ffd93d', 'none', '🎻'],
  ['blarney-stone', 'Blarney Stone', 'stpatricks', 'rare', 205, 'stone', '#9aa5b1', '#2f9e44', 'dots', '🪨'],
  ['lucky-coin-charm', 'Lucky Coin Charm', 'stpatricks', 'rare', 255, 'coin', '#ffd93d', '#2f9e44', 'none', '🪙'],
  ['emerald-bauble', 'Emerald Bauble', 'stpatricks', 'epic', 540, 'bauble', '#2f9e44', '#b9f6ca', 'glitter', '💚'],
  ['rainbow-ends', 'End of the Rainbow', 'stpatricks', 'epic', 630, 'rainbow', '#ffd93d', '#2ec4ff', 'stars', '🌈'],
  ['golden-shamrock', 'Golden Shamrock', 'stpatricks', 'legendary', 2050, 'clover', '#ffd93d', '#2f9e44', 'glitter', '🍀'],

  // ------------------------------------------------------------ New Year's Eve
  ['party-hat', 'Party Hat', 'newyear', 'common', 44, 'partyhat', '#ffd93d', '#ff5d8f', 'stripes', '🥳'],
  ['confetti-ball', 'Confetti Ball', 'newyear', 'common', 50, 'bauble', '#ff5d8f', '#2ec4ff', 'dots', '🎊'],
  ['sparkling-cider', 'Sparkling Cider', 'newyear', 'common', 56, 'glass', '#ffd93d', '#fff8e7', 'dots', '🥂'],
  ['midnight-clock', 'Midnight Clock', 'newyear', 'common', 62, 'clock', '#ffd93d', '#241a2e', 'none', '🕛'],
  ['noise-maker', 'Noise Maker', 'newyear', 'common', 68, 'noisemaker', '#d62828', '#ffd93d', 'stripes', '🎉'],
  ['resolution-note', 'Resolution Note', 'newyear', 'common', 74, 'note', '#fff4ea', '#ffd93d', 'none', '📝'],
  ['balloon-drop', 'Balloon Drop', 'newyear', 'rare', 175, 'balloon', '#ff5d8f', '#2ec4ff', 'dots', '🎈'],
  ['disco-ball', 'Disco Ball', 'newyear', 'rare', 215, 'disco', '#cfd8e3', '#ff5d8f', 'glitter', '🪩'],
  ['countdown-clock', 'Countdown Clock', 'newyear', 'rare', 260, 'clock', '#cfd8e3', '#ffd93d', 'stars', '⏰'],
  ['midnight-fireworks', 'Midnight Fireworks', 'newyear', 'epic', 545, 'firework', '#ffd93d', '#a855f7', 'glitter', '🎆'],
  ['new-year-cake', 'New Year Cake', 'newyear', 'epic', 640, 'cake', '#ffd93d', '#fff8e7', 'stars', '🎂'],
  ['golden-hourglass', 'Golden Hourglass', 'newyear', 'legendary', 2200, 'hourglass', '#ffd93d', '#2ec4ff', 'glitter', '⏳'],

  // ---------------------------------------------------------------- Mardi Gras
  ['bead-necklace', 'Bead Necklace', 'mardigras', 'common', 45, 'beads', '#a855f7', '#ffd93d', 'none', '📿'],
  ['masquerade-mask', 'Masquerade Mask', 'mardigras', 'common', 52, 'mask', '#a855f7', '#3ddc84', 'stars', '🎭'],
  ['king-cake', 'King Cake', 'mardigras', 'common', 58, 'cake', '#ffd93d', '#a855f7', 'dots', '🎂'],
  ['jester-hat', 'Jester Hat', 'mardigras', 'common', 64, 'jester', '#a855f7', '#3ddc84', 'stripes', '🃏'],
  ['fleur-de-lis', 'Fleur-de-lis', 'mardigras', 'common', 70, 'fleur', '#ffd93d', '#a855f7', 'none', '⚜️'],
  ['parade-doubloon', 'Parade Doubloon', 'mardigras', 'common', 76, 'coin', '#ffd93d', '#a855f7', 'none', '🪙'],
  ['parade-float', 'Parade Float', 'mardigras', 'rare', 180, 'float', '#a855f7', '#ffd93d', 'stars', '🎠'],
  ['brass-sax', 'Brass Sax', 'mardigras', 'rare', 220, 'sax', '#ffd93d', '#a855f7', 'none', '🎷'],
  ['feather-mask', 'Feather Mask', 'mardigras', 'rare', 265, 'mask', '#3ddc84', '#a855f7', 'glitter', '🦚'],
  ['crown-of-rex', 'Crown of Rex', 'mardigras', 'epic', 550, 'crown', '#ffd93d', '#a855f7', 'glitter', '👑'],
  ['second-line-umbrella', 'Second Line Umbrella', 'mardigras', 'epic', 650, 'umbrella', '#a855f7', '#ffd93d', 'dots', '☂️'],
  ['golden-jester', 'Golden Jester', 'mardigras', 'legendary', 2250, 'jester', '#ffd93d', '#a855f7', 'glitter', '🤡'],

  // ------------------------------------------------------------- Day of the Dead
  ['sugar-skull', 'Sugar Skull', 'daydead', 'common', 46, 'skull', '#fff8e7', '#ff5d8f', 'dots', '💀'],
  ['marigold-crown', 'Marigold Crown', 'daydead', 'common', 52, 'flowercrown', '#ff8a00', '#ff5d8f', 'none', '🌼'],
  ['papel-picado', 'Papel Picado', 'daydead', 'common', 58, 'papel', '#ff5d8f', '#ff8a00', 'stripes', '🎊'],
  ['pan-de-muerto', 'Pan de Muerto', 'daydead', 'common', 64, 'bread', '#c9a27e', '#ff5d8f', 'dots', '🍞'],
  ['remembrance-candle', 'Remembrance Candle', 'daydead', 'common', 70, 'candle', '#a855f7', '#ff8a00', 'none', '🕯️'],
  ['tiny-ofrenda', 'Tiny Ofrenda', 'daydead', 'common', 76, 'altar', '#ff8a00', '#a855f7', 'dots', '🕯️'],
  ['catrina-hat', 'Catrina Hat', 'daydead', 'rare', 180, 'tophat', '#241a2e', '#ff5d8f', 'stars', '🎩'],
  ['soul-guitar', 'Soul Guitar', 'daydead', 'rare', 220, 'guitar', '#8b5a3c', '#ff8a00', 'none', '🎸'],
  ['skeleton-cat', 'Skeleton Cat', 'daydead', 'rare', 265, 'cat', '#241a2e', '#ff8a00', 'dots', '🐈'],
  ['flower-altar', 'Flower Altar', 'daydead', 'epic', 550, 'altar', '#ff8a00', '#ff5d8f', 'stars', '🌺'],
  ['golden-calavera', 'Golden Calavera', 'daydead', 'epic', 650, 'skull', '#ffd93d', '#241a2e', 'glitter', '💀'],
  ['tree-of-memories', 'Tree of Memories', 'daydead', 'legendary', 2300, 'tree', '#ff8a00', '#a855f7', 'glitter', '🌳'],

  // ------------------------------------------------------------ Summer Holiday
  ['beach-ball', 'Beach Ball', 'summer', 'common', 44, 'beachball', '#d62828', '#2ec4ff', 'stripes', '🏖️'],
  ['ice-cream-cone', 'Ice Cream Cone', 'summer', 'common', 50, 'icecream', '#ff8fc7', '#c9a27e', 'dots', '🍦'],
  ['seashell', 'Seashell', 'summer', 'common', 56, 'shell', '#ffb3c7', '#fff8e7', 'stripes', '🐚'],
  ['sun-hat', 'Sun Hat', 'summer', 'common', 62, 'sunhat', '#ffd93d', '#ff5d8f', 'none', '👒'],
  ['sandcastle', 'Sandcastle', 'summer', 'common', 68, 'sandcastle', '#d9b382', '#2ec4ff', 'dots', '🏰'],
  ['pool-float', 'Pool Float', 'summer', 'common', 74, 'floatring', '#ff5d8f', '#2ec4ff', 'stripes', '🍩'],
  ['palm-tree', 'Palm Tree', 'summer', 'rare', 175, 'palm', '#3ddc84', '#8b5a3c', 'none', '🌴'],
  ['surfboard', 'Surfboard', 'summer', 'rare', 215, 'surfboard', '#2ec4ff', '#ff8a00', 'stripes', '🏄'],
  ['snorkel-mask', 'Snorkel Mask', 'summer', 'rare', 260, 'snorkel', '#2ec4ff', '#ffd93d', 'dots', '🤿'],
  ['watermelon-slice', 'Watermelon Slice', 'summer', 'epic', 540, 'watermelon', '#3ddc84', '#ff5d8f', 'dots', '🍉'],
  ['sunset-globe', 'Sunset Globe', 'summer', 'epic', 640, 'snowglobe', '#ff8a00', '#ff5d8f', 'glitter', '🔮'],
  ['golden-sun', 'Golden Sun', 'summer', 'legendary', 2200, 'sun', '#ffd93d', '#ff8a00', 'glitter', '☀️'],

  // -------------------------------------------------------------- Winter Cozy
  ['cosy-mitten', 'Cosy Mitten', 'winter', 'common', 44, 'mitten', '#d62828', '#fff8e7', 'dots', '🧤'],
  ['knit-scarf', 'Knit Scarf', 'winter', 'common', 50, 'scarf', '#2ec4ff', '#fff8e7', 'stripes', '🧣'],
  ['hot-cocoa', 'Hot Cocoa', 'winter', 'common', 56, 'mug', '#8b5a3c', '#fff8e7', 'dots', '☕'],
  ['frost-crystal', 'Frost Crystal', 'winter', 'common', 62, 'snowflake', '#a5d8ff', '#fff8e7', 'snow', '❄️'],
  ['cosy-sock', 'Cosy Sock', 'winter', 'common', 68, 'stocking', '#a855f7', '#fff8e7', 'stripes', '🧦'],
  ['pinecone-drop', 'Pinecone Drop', 'winter', 'common', 74, 'pinecone', '#8b5a3c', '#3ddc84', 'none', '🌲'],
  ['cosy-sled', 'Cosy Sled', 'winter', 'rare', 180, 'sled', '#d62828', '#8b5a3c', 'none', '🛷'],
  ['snowman-friend', 'Snowman Friend', 'winter', 'rare', 220, 'snowman', '#fff8e7', '#2ec4ff', 'dots', '⛄'],
  ['icicle-drop', 'Icicle Drop', 'winter', 'rare', 265, 'icicle', '#a5d8ff', '#cfd8e3', 'glitter', '🧊'],
  ['snow-globe-blue', 'Snow Globe Blue', 'winter', 'epic', 545, 'snowglobe', '#7dd3fc', '#fff8e7', 'snow', '🔮'],
  ['northern-lights', 'Northern Lights', 'winter', 'epic', 640, 'aurora', '#3ddc84', '#a855f7', 'stars', '🌌'],
  ['frozen-star', 'Frozen Star', 'winter', 'legendary', 2250, 'star', '#a5d8ff', '#ffd93d', 'glitter', '🌟'],
];

export const HOLIDAYS = [
  { id: 'christmas', label: 'Christmas', icon: '🎄', color: '#3ddc84' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', color: '#ff8a00' },
  { id: 'easter', label: 'Easter', icon: '🐣', color: '#ff8fc7' },
  { id: 'valentines', label: 'Valentine’s', icon: '💝', color: '#ff2e63' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: '🦃', color: '#d98c3f' },
  { id: 'hanukkah', label: 'Hanukkah', icon: '🕎', color: '#2d6cdf' },
  { id: 'diwali', label: 'Diwali', icon: '🪔', color: '#ffd93d' },
  { id: 'lunar', label: 'Lunar New Year', icon: '🧧', color: '#ff4d4d' },
  { id: 'july4', label: 'Fourth of July', icon: '🎆', color: '#2ec4ff' },
  { id: 'stpatricks', label: 'St. Patrick’s', icon: '🍀', color: '#2f9e44' },
  { id: 'newyear', label: 'New Year’s Eve', icon: '🥂', color: '#c084fc' },
  { id: 'mardigras', label: 'Mardi Gras', icon: '🎭', color: '#a855f7' },
  { id: 'daydead', label: 'Day of the Dead', icon: '💀', color: '#ff5d8f' },
  { id: 'summer', label: 'Summer Holiday', icon: '🏖️', color: '#ffb703' },
  { id: 'winter', label: 'Winter Cozy', icon: '❄️', color: '#a5d8ff' },
];

export const HOLIDAY_BY_ID = new Map(HOLIDAYS.map((holiday) => [holiday.id, holiday]));

export const RARITIES = {
  common: { label: 'Common', color: '#bcacf0', weight: 1 },
  rare: { label: 'Rare', color: '#2ec4ff', weight: 2 },
  epic: { label: 'Epic', color: '#c084fc', weight: 3 },
  legendary: { label: 'Legendary', color: '#ffd93d', weight: 5 },
};

export const ORNAMENTS = ROWS.map(
  ([id, name, holiday, rarity, price, shape, color, accent, pattern, icon], index) => ({
    id,
    name,
    holiday,
    rarity,
    price,
    shape,
    color,
    accent,
    pattern,
    icon,
    number: index + 1,
  })
);

export const ORNAMENT_BY_ID = new Map(ORNAMENTS.map((ornament) => [ornament.id, ornament]));

export const TOTAL_ORNAMENTS = ORNAMENTS.length;
export const STARTER_ORNAMENT = 'red-bauble';
export const STARTING_COINS = 120;

/** Price of an ornament, floored to the nearest 5 coins. */
export function priceOf(ornament) {
  return Math.max(5, Math.round(ornament.price / 5) * 5);
}

/** Ornaments belonging to one holiday, cheapest first. */
export function ornamentsForHoliday(holidayId) {
  return ORNAMENTS.filter((ornament) => ornament.holiday === holidayId).sort(
    (a, b) => a.price - b.price || a.number - b.number
  );
}
