/**
 * Aisle Rush '85 — show content.
 * Teams, grocery shelves, quiz questions and Bonus Sweep clues.
 * Everything here is original: made-up brands, no real product slogans.
 */

export const TEAMS = [
  {
    id: 'nelsons',
    name: 'THE NEON NELSONS',
    players: ['BOB', 'DEB'],
    color: '#ff2e97',
    deep: '#8a0f4f',
    light: '#ffc2de',
  },
  {
    id: 'queens',
    name: 'THE COUPON QUEENS',
    players: ['TINA', 'GINA'],
    color: '#2fe4ff',
    deep: '#0b6a7d',
    light: '#c4f8ff',
  },
  {
    id: 'aces',
    name: 'THE AISLE ACES',
    players: ['CHAD', 'KIM'],
    color: '#ffd93d',
    deep: '#8a6400',
    light: '#fff0ae',
  },
];

export const AISLES = [
  {
    id: 'dairy',
    name: 'DAIRY + FROZEN',
    short: 'AISLE 1',
    color: '#2fe4ff',
    products: [
      { id: 'milk', name: 'MEGA MOO MILK', short: 'MOO', price: 5, color: '#fff6df', accent: '#1cb5d6', art: 'carton' },
      { id: 'eggs', name: 'SUNNY EGGS', short: 'EGG', price: 6, color: '#fff1c4', accent: '#ffb300', art: 'carton' },
      { id: 'cheese', name: 'BIG WHEEL CHEESE', short: 'CHZ', price: 9, color: '#ffd35c', accent: '#e08a00', art: 'cheese' },
      { id: 'yogurt', name: 'YO-YO YOGURT', short: 'YOG', price: 4, color: '#ffe1f0', accent: '#ff2e97', art: 'cup' },
      { id: 'icecream', name: 'POLAR POP ICE CREAM', short: 'ICE', price: 7, color: '#b9fff0', accent: '#ff2e97', art: 'tub' },
      { id: 'peas', name: 'FROSTY PEAS', short: 'PEA', price: 4, color: '#8ef58a', accent: '#13831c', art: 'bag' },
      { id: 'pops', name: 'ROCKET POPS', short: 'POP', price: 5, color: '#7bd7ff', accent: '#ff2e97', art: 'box' },
      { id: 'butter', name: 'CHURN BUTTER', short: 'BUT', price: 6, color: '#ffe27a', accent: '#b87900', art: 'tub' },
    ],
  },
  {
    id: 'snacks',
    name: 'CEREAL + SNACKS',
    short: 'AISLE 2',
    color: '#ff2e97',
    products: [
      { id: 'chocoboom', name: 'CHOCO BOOM', short: 'BOOM', price: 6, color: '#8a4b2a', accent: '#ffd93d', art: 'box' },
      { id: 'oatclouds', name: 'OAT CLOUDS', short: 'OAT', price: 5, color: '#d9efff', accent: '#2f7dd1', art: 'box' },
      { id: 'crunchcrows', name: 'CRUNCH CROWS', short: 'CROW', price: 6, color: '#9a5cff', accent: '#ff8a00', art: 'box' },
      { id: 'chips', name: 'ZAPPY CHIPS', short: 'ZIP', price: 5, color: '#ffe03d', accent: '#e32626', art: 'bag' },
      { id: 'pretzels', name: 'TWIST PRETZELS', short: 'TWST', price: 4, color: '#d59a5a', accent: '#7a3f12', art: 'bag' },
      { id: 'cookies', name: 'COOKIE CREW', short: 'COOK', price: 5, color: '#ffb2d2', accent: '#6b3a1f', art: 'box' },
      { id: 'crackers', name: 'SNAP CRACKERS', short: 'SNAP', price: 4, color: '#fff2cc', accent: '#3d9a3d', art: 'box' },
      { id: 'gum', name: 'BUBBLE GUM', short: 'GUM', price: 3, color: '#ff8ac0', accent: '#ffffff', art: 'box' },
    ],
  },
  {
    id: 'pantry',
    name: 'SODA + PANTRY',
    short: 'AISLE 3',
    color: '#ffd93d',
    products: [
      { id: 'cola', name: 'FIZZ WHIZ COLA', short: 'FIZZ', price: 5, color: '#e32626', accent: '#ffffff', art: 'can' },
      { id: 'juice', name: 'CLOUD JUICE', short: 'CLOUD', price: 4, color: '#ffb14e', accent: '#2f7dd1', art: 'carton' },
      { id: 'soup', name: 'TOMATO TORNADO SOUP', short: 'SOUP', price: 4, color: '#d72b2b', accent: '#ffe6b0', art: 'can' },
      { id: 'beans', name: 'BEAN MACHINE', short: 'BEAN', price: 3, color: '#5aa43a', accent: '#fff0a0', art: 'can' },
      { id: 'pickles', name: "GRANDMA'S PICKLES", short: 'PICK', price: 6, color: '#7ac74f', accent: '#ffd93d', art: 'jar' },
      { id: 'mustard', name: 'MUSTARD MAMBA', short: 'MUST', price: 4, color: '#ffe03d', accent: '#d72b2b', art: 'bottle' },
      { id: 'pasta', name: 'PASTA PARTY', short: 'PASTA', price: 4, color: '#4f9de8', accent: '#ffd93d', art: 'box' },
      { id: 'coffee', name: "JOE'S MIDNIGHT COFFEE", short: 'JOE', price: 14, color: '#5a321c', accent: '#ffd93d', art: 'can' },
      { id: 'oil', name: 'GOLDEN OIL', short: 'OIL', price: 13, color: '#e8d26b', accent: '#3d9a3d', art: 'bottle' },
    ],
  },
  {
    id: 'home',
    name: 'CLEANING + HOME',
    short: 'AISLE 4',
    color: '#b983ff',
    products: [
      { id: 'suds', name: 'MEGA SUDS', short: 'SUDS', price: 18, color: '#e8fbff', accent: '#2fe4ff', art: 'box' },
      { id: 'dish', name: 'DISH DIVA', short: 'DISH', price: 7, color: '#ffa8d6', accent: '#8a0f4f', art: 'bottle' },
      { id: 'towels', name: 'PAPER TOWERS', short: 'TOWEL', price: 8, color: '#ffffff', accent: '#4f9de8', art: 'roll' },
      { id: 'shampoo', name: 'SHAMPOO SHINE', short: 'SHAM', price: 9, color: '#c2a0ff', accent: '#5a1a8a', art: 'bottle' },
      { id: 'mint', name: 'MINT BLAST', short: 'MINT', price: 6, color: '#9af5d2', accent: '#13835a', art: 'box' },
      { id: 'diapers', name: 'DRY BABY DIAPERS', short: 'DIAP', price: 16, color: '#c9e6ff', accent: '#2f7dd1', art: 'bag' },
      { id: 'bags', name: 'TIDY BAGS', short: 'BAG', price: 8, color: '#9af58a', accent: '#13831c', art: 'box' },
      { id: 'spray', name: 'SPARKLE SPRAY', short: 'SPARK', price: 6, color: '#8afff2', accent: '#ff2e97', art: 'bottle' },
    ],
  },
  {
    id: 'deli',
    name: 'DELI + BAKERY + MEAT',
    short: 'DELI',
    color: '#ff8a00',
    products: [
      { id: 'turkey', name: 'HOLIDAY TURKEY', short: 'TURK', price: 24, color: '#d9a05b', accent: '#8a4b1f', art: 'turkeyBox' },
      { id: 'steak', name: 'THICK CUT STEAK', short: 'STEAK', price: 22, color: '#e85a5a', accent: '#fff0e0', art: 'meat' },
      { id: 'bread', name: 'FRESH BREAD', short: 'BREAD', price: 4, color: '#e8c48a', accent: '#8a4b1f', art: 'bread' },
      { id: 'cake', name: 'BIRTHDAY CAKE', short: 'CAKE', price: 12, color: '#ffc2e0', accent: '#ff2e97', art: 'cake' },
      { id: 'chicken', name: 'CHICKEN DRUMSTICKS', short: 'CHICK', price: 9, color: '#f2b06b', accent: '#b03a00', art: 'meat' },
      { id: 'ham', name: 'DELI HAM', short: 'HAM', price: 11, color: '#ffb2c2', accent: '#8a0f4f', art: 'meat' },
      { id: 'bagel', name: 'BAGEL BUNCH', short: 'BAGEL', price: 5, color: '#e8c48a', accent: '#5a321c', art: 'bread' },
      { id: 'pie', name: 'APPLE PIE', short: 'PIE', price: 10, color: '#f5d06b', accent: '#b03a00', art: 'cake' },
    ],
  },
];

export const ROUND_NAMES = ['NAME THAT PRODUCT', 'JINGLE JAM', 'ROUND ROBIN'];

export const ROUND_INTROS = [
  'Round one! I describe a grocery, you name it. Every correct answer is ten more seconds in the Big Sweep.',
  'Round two! The jingles are made up, the groceries are not. Ten seconds a pop!',
  'Round three! Round robin — anything on the shelves is fair game. Ten seconds each!',
];

export const QUESTIONS = [
  /* ---- Round 1: name that product ---- */
  {
    round: 0,
    prompt: "I'm cold, creamy, and I live in a tub by the freezer door. What am I?",
    answer: 'Ice cream',
    wrong: ['Whipped butter', 'Frozen peas'],
    note: 'Ice cream! The freezer’s crown jewel.',
  },
  {
    round: 0,
    prompt: "I'm green, crunchy, and I come in a big glass jar. A giant jar of me is a Big Sweep classic.",
    answer: 'Pickles',
    wrong: ['Peas', 'Cactus'],
    note: 'Pickles! Big, green and briny.',
  },
  {
    round: 0,
    prompt: "I'm white, I sit in the dairy case, and I make your cereal go soggy.",
    answer: 'Milk',
    wrong: ['Yogurt', 'Whipped cream'],
    note: 'Milk! Aisle one, right next to the eggs.',
  },
  {
    round: 0,
    prompt: "I'm big enough to feed the whole family on Sunday. Grab me and you've hit the jackpot.",
    answer: 'A whole turkey',
    wrong: ['A chicken nugget', 'A rubber duck'],
    note: 'A whole turkey! Expensive, and worth every second.',
  },
  {
    round: 0,
    prompt: "I'm orange, I'm crunchy, and rabbits will follow you home for me.",
    answer: 'Carrots',
    wrong: ['Cheetos', 'Oranges'],
    note: 'Carrots! Crunchy, orange, rabbit-approved.',
  },
  {
    round: 0,
    prompt: "I'm in a can, I'm red, and I go on top of spaghetti.",
    answer: 'Tomato sauce',
    wrong: ['Grape juice', 'Mustard'],
    note: 'Tomato sauce! Straight down the pasta aisle.',
  },
  {
    round: 0,
    prompt: "I'm yellow and I come in a jar. Great on a hot dog, terrible on ice cream.",
    answer: 'Mustard',
    wrong: ['Honey', 'Lemonade'],
    note: 'Mustard! Yellow, tangy and brave.',
  },
  {
    round: 0,
    prompt: "I'm a loaf with a golden crust. Find me in the bakery.",
    answer: 'Bread',
    wrong: ['Cake', 'Pretzel'],
    note: 'Bread! The bakery always smells like a win.',
  },

  /* ---- Round 2: made-up jingles ---- */
  {
    round: 1,
    prompt: '“Fizz up your Friday! It’s a flavour fiesta!” Grab a can of ___!',
    answer: 'Fizz Whiz',
    wrong: ['Mega Moo', 'Snooze Button'],
    note: 'Fizz Whiz! Friday is officially fizzy.',
  },
  {
    round: 1,
    prompt: '“Moo-ve over, ordinary milk. This one’s thick and creamy!” Which carton?',
    answer: 'Mega Moo',
    wrong: ['Cloud Juice', 'Sir Sizzle'],
    note: 'Mega Moo! The cow on the carton is wearing sunglasses.',
  },
  {
    round: 1,
    prompt: '“Snap! Crackle! Ker-POW! A crunch in every bite!” Which cereal?',
    answer: 'Choco Boom',
    wrong: ['Oat Clouds', 'Bran Breeze'],
    note: 'Choco Boom! Ker-POW is right there on the box.',
  },
  {
    round: 1,
    prompt: '“Squeaky clean, lemon sheen!” Which giant box belongs in the cart?',
    answer: 'Mega Suds',
    wrong: ['Sugar Smack', 'Fizz Whiz'],
    note: 'Mega Suds! The most expensive box in the store.',
  },
  {
    round: 1,
    prompt: '“The toaster’s best friend!” Which breakfast?',
    answer: 'Pop-Up Pals',
    wrong: ['Soup in a Cup', 'Mega Moo'],
    note: 'Pop-Up Pals! Watch your fingers.',
  },
  {
    round: 1,
    prompt: '“Bubbles that go the distance!” Which bottle?',
    answer: 'Sparkle Spray',
    wrong: ['Cloud Juice', 'Golden Oil'],
    note: 'Sparkle Spray! Squeaky windows, every time.',
  },
  {
    round: 1,
    prompt: '“Crunchy, munchy, lunchbox ready!” Which snack bag?',
    answer: 'Zappy Chips',
    wrong: ['Frosty Peas', 'Mega Suds'],
    note: 'Zappy Chips! The loudest bag in the aisle.',
  },
  {
    round: 1,
    prompt: '“Your socks will thank you!” Which box?',
    answer: 'Mega Suds',
    wrong: ['Cookie Crew', 'Oat Clouds'],
    note: 'Mega Suds! Your socks are writing a thank-you card.',
  },

  /* ---- Round 3: round robin ---- */
  {
    round: 2,
    prompt: 'Which aisle stocks laundry detergent?',
    answer: 'Cleaning + Home',
    wrong: ['Dairy + Frozen', 'Deli + Bakery'],
    note: 'Cleaning and Home — aisle four!',
  },
  {
    round: 2,
    prompt: 'Which of these is usually the most expensive?',
    answer: 'A whole turkey',
    wrong: ['A loaf of bread', 'A can of soda'],
    note: 'A whole turkey! Poultry pays in the Big Sweep.',
  },
  {
    round: 2,
    prompt: 'Which belongs in the freezer aisle?',
    answer: 'Frozen peas',
    wrong: ['Cereal', 'Bananas'],
    note: 'Frozen peas! Bring a scarf.',
  },
  {
    round: 2,
    prompt: 'Which of these is a dairy product?',
    answer: 'Cheese',
    wrong: ['Pretzels', 'Applesauce'],
    note: 'Cheese! Big Wheel, specifically.',
  },
  {
    round: 2,
    prompt: 'Which would you find in the bakery?',
    answer: 'A birthday cake',
    wrong: ['A lightbulb', 'Shampoo'],
    note: 'A birthday cake! Somebody’s turning five.',
  },
  {
    round: 2,
    prompt: 'The five-item rule: how many of one product can you grab?',
    answer: 'Five',
    wrong: ['Two', 'A hundred'],
    note: 'Five! The rule that keeps the carts honest.',
  },
  {
    round: 2,
    prompt: 'Which goes in the fridge, not the pantry?',
    answer: 'Milk',
    wrong: ['Crackers', 'Canned beans'],
    note: 'Milk! Cold, white and always in the way.',
  },
  {
    round: 2,
    prompt: 'Which is usually the priciest per pound?',
    answer: 'Midnight coffee',
    wrong: ['Flour', 'Bananas'],
    note: 'Coffee! The bean that pays the bills.',
  },
  {
    round: 2,
    prompt: 'Which one is NOT in the dairy case?',
    answer: 'Potato chips',
    wrong: ['Milk', 'Cheese'],
    note: 'Potato chips! That’s aisle two.',
  },
  {
    round: 2,
    prompt: 'What do you call the machine that goes BEEP at the checkout?',
    answer: 'A scanner',
    wrong: ['A toaster', 'A blender'],
    note: 'A scanner! You’ll hear plenty of those today.',
  },
];

export const BONUS_TARGETS = [
  {
    id: 'bonus-pickles',
    art: 'pickles',
    name: 'GIANT JAR OF PICKLES',
    clue: "I'm big, green and briny. Find the giant jar of pickles!",
    x: 105,
    y: 445,
  },
  {
    id: 'bonus-turkey',
    art: 'turkey',
    name: 'FROZEN TURKEY',
    clue: "I gobble and I'm frozen. Find the frozen turkey!",
    x: 1490,
    y: 510,
  },
  {
    id: 'bonus-suds',
    art: 'suds',
    name: 'GIANT MEGA SUDS',
    clue: "I'm the giant box that keeps your socks squeaky clean. Find Mega Suds!",
    x: 680,
    y: 858,
  },
];

export const HOST_LINES = {
  title:
    'Welcome to Aisle Rush ’85, the supermarket game show where the groceries are free and the clock is not!',
  team: 'Three teams, one supermarket. Pick your partner, and let’s go shopping!',
  quiz: 'Answer fast! Every correct answer puts ten more seconds on somebody’s Big Sweep clock.',
  correct: ['Ten more seconds!', 'Beautiful!', 'That’s the one!', 'Ka-ching!', 'Sharp as a shopping list.'],
  wrong: ['Ooh, not quite.', 'Oh no! The buzzer.', 'That one goes back on the shelf.'],
  timeout: ['Too slow!', 'And the clock wins that round.', 'Time’s up before the checkout!'],
  sweep: 'Time banks are locked! When I say go, grab everything you can. The giant items are worth a fortune!',
  timeup: 'That’s the buzzer! Let’s see what’s in that cart.',
  checkout: 'Let’s scan it and see who’s taking home the Big Sweep.',
  bonus: 'Three clues, sixty seconds, five thousand dollars. First clue is coming — GO!',
  bonusWin: 'You did it! Five thousand dollars! Next time that register goes beep, think of Aisle Rush ’85!',
  bonusLose: 'So close! That cash slips away — but your Big Sweep is still yours.',
  lose: 'What a show! Grab a parting gift on your way out — and come back for the next one.',
  catchphrase: 'When you hear that scanner beep… think of Aisle Rush ’85!',
};

/** Two questions from each round, shuffled. */
export function buildQuiz(rand = Math.random) {
  const picked = [];
  for (let round = 0; round < 3; round += 1) {
    const pool = QUESTIONS.filter((question) => question.round === round);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    picked.push(...pool.slice(0, 2));
  }
  return picked;
}

export function choicesFor(question, rand = Math.random) {
  const options = [question.answer, ...question.wrong];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function formatMoney(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
