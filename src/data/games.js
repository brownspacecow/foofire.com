/**
 * The games shown on the portal and on the high scores page.
 * `id` is the key used for the per-device high score store.
 */
export const games = [
  {
    id: 'rough-housing',
    title: 'Rough Housing',
    description:
      'Build a couch-fort wrestling arena out of ten foam pieces, then bump, jump and cartwheel your friend into the lava. Local two-player physics chaos.',
    image: './public/screenshots/rough-housing.webp',
    path: './src/games/rough-housing/index.html',
  },
  {
    id: 'roost-rider',
    title: 'Roost Rider',
    description:
      'A first-person off-road motorcycle race: three laps, three rivals, big jumps and nitro on a dusty dirt circuit. Preload the lips, land your spins, and keep it pinned.',
    image: './public/screenshots/roost-rider.webp',
    path: './src/games/roost-rider/index.html',
  },
  {
    id: 'rhythm-break',
    title: 'Soft Reset',
    description:
      'A two-minute rhythm break with two original early-2000s hip-hop grooves and a reggae one-drop. Four pads, no failing, and nothing that needs you for a hundred seconds. For whoever has been holding everything together since 6 a.m.',
    image: './public/screenshots/rhythm-break.webp',
    path: './src/games/rhythm-break/index.html',
  },
  {
    id: 'escape-earth',
    title: "Escape Earth: Survive Grandma's House",
    description:
      'Three levels of bad decisions: survive the drive to Grandma\'s, escape Raggedy Ann and Andy in the dark, and hold the remote against your head without getting caught.',
    image: './public/screenshots/escape-earth.webp',
    path: './src/games/escape-earth/index.html',
  },
  {
    id: 'ball-pit',
    title: 'Ball Pit Bonanza',
    description:
      'Wade through a giant ball pit, shove the balls around, and dig up buried treasure — old watches, soggy pizza, and maybe something brand new. Sell your haul for upgrades and prizes.',
    image: './public/screenshots/ball-pit.webp',
    path: './src/games/ball-pit/index.html',
  },
  {
    id: 'spooky-santa',
    title: 'Spooky Santa',
    description:
      'Sneak down the chimney, dodge flashlight beams, the dog and the sweeping tree lights, and leave every present without being detected before sunrise.',
    image: './public/screenshots/spooky-santa.webp',
    path: './src/games/spooky-santa/index.html',
  },
  {
    id: 'pizza-homestead',
    title: 'Pizza Homestead: Fun Room Rush',
    description:
      'Raid a very sincere pizza buffet, eat slices at the booths for arcade money, and whack Hank the mascot in the Fun Room before Mom says it is time to go.',
    image: './public/screenshots/pizza-homestead.webp',
    path: './src/games/pizza-homestead/index.html',
  },
  {
    id: 'claw-machine',
    title: 'Claw Crew',
    description:
      'Steer the claw and fill your saved Plushie Dex with 100 original characters — including a wild digital circus and some cute-spooky friends.',
    image: './public/screenshots/claw-machine.webp',
    path: './src/games/claw-machine/index.html',
    /** Claw Crew tracks a collection, so its board shows progress, not a best. */
    progress: { total: 100, unit: 'plushies' },
  },
  {
    id: 'zombie-deer',
    title: 'Zombie Deer: Christmas Edition',
    description:
      'Defend a snow-covered house from waves of zombie reindeer. Throw snowballs, light up the tree, and call Bear the puppy for backup.',
    image: './public/screenshots/zombie-deer.webp',
    path: './src/games/zombie-deer/index.html',
  },
  {
    id: 'the-grin',
    title: 'The Grin',
    description:
      'A four-stage bullet-hell boss fight with touch controls. Something at the end of the hallway is wearing a smile you recognise, and it is coming apart. Dodge, strike, and decide whether to spare what is left.',
    image: './public/screenshots/the-grin.webp',
    path: './src/games/the-grin/index.html',
  },
  {
    id: 'spark-curfew',
    title: 'Spark Curfew',
    description:
      'Run a backyard fireworks show before curfew. Little fireworks bring the daylight, the big shells only go up at night, and Big Bertha ends the whole street in a white flash. The faster you light her, the bigger your time bonus.',
    image: './public/screenshots/spark-curfew.webp',
    path: './src/games/spark-curfew/index.html',
  },
  {
    id: 'bear',
    title: 'Bear the Puppy',
    description:
      'Take care of Bear, a cute black and white Shih Tzu puppy. Feed him, play fetch, and tuck him into bed!',
    image: './public/screenshots/bear.webp',
    path: './src/games/bear/index.html',
  },
];
