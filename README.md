# Foofire Games

Foofire Games is a collection of browser games built with three.js for kids. Play free online games with no downloads and no accounts.

Tagline: **Games for kids.**

## Features

- Three.js games that run entirely in the browser
- Game portal with a library of 22 playable games, with search and category filters
- Dark, mobile-first responsive UI
- Local high scores saved in the browser (top five per game)
- Dedicated legal disclaimer page

## Project Structure

```text
src/
  main.js          # Portal: latest games + Games-page search/filter
  scores.js        # High-scores page
  data/games.js    # The 22 games: id, category, title, description, image, path
  utils/           # Shared scores, audio prefs, auto-pause, reduced-motion helpers
  vendor/
    three.module.js  # Shared Three.js r169, used by Earwarts + Keep.
                     # Other games still load three@0.168.0 from esm.sh;
                     # moving them to the shared copy is a planned follow-up.
  games/
    earwarts/       # Earwarts Academy: listening / ear-training adventure
    muddle-keep/    # Keep: cheerful dungeon-keeper lair tycoon
    survive-family-vacation/  # Seven-chapter supernatural road-trip mystery
    rough-housing/  # Rough Housing: local two-player couch-fort wrestling
    roost-rider/    # Roost Rider: first-person off-road motorcycle race
    roof-rider/     # Roof Rider: 2D rooftop motocross rhythm racer
    escape-earth/   # Escape Earth: Survive Grandma's House, four levels
    spot-your-friends/  # First-person hide-and-seek in a 3D house
    ball-pit/       # Ball Pit Bonanza: dig up treasure, sell it, upgrade
    bear/           # Bear the Puppy: feed, fetch, tuck in a Shih Tzu
    pizza-homestead/  # Pizza Homestead: Fun Room Rush
    claw-machine/   # Claw Crew: collect 100 original plushies
    christmas-trees-and-missals/  # Decorate the town tree, then launch it
    zombie-deer/    # Zombie Deer: Christmas Edition tower defence
    crypt-crawl/    # Crypt Crawl: match-drag-slay puzzle dungeon crawler
    aisle-rush/     # Aisle Rush '85: 80s supermarket game show
    spooky-santa/   # Spooky Santa: chimney stealth before sunrise
    spark-curfew/   # Spark Curfew: backyard fireworks before curfew
    the-grin/       # The Grin: four-stage bullet-hell boss fight
    phrase-pad/     # Phrase Pad: pocket touch synth, no wrong notes
    rhythm-break/   # Soft Reset: two-minute rhythm break
    drum-quest/     # Drum Quest: kid-sized drum kit, Copy Cat, Beat Builder
public/
  data/
    muddle-keep/   # rooms, creatures, spells, traps, heroes, levels (JSON)
    vacation/      # levels, dialogue, collectibles, achievements (JSON)
  screenshots/     # Portal card art (one image per game)
```

Game categories in `src/data/games.js` are `adventure`, `racing`, `music`,
`arcade` and `cozy`. They drive the filter chips on the Games page and the
small category tag on each game card.

## Local Preview

Serve the site over HTTP instead of opening files directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

### Earwarts Academy

Earwarts Academy is plain HTML, CSS and JavaScript with a vendored Three.js module.
There is no install or build step. Serve the repository root as above and open:

```text
http://localhost:8080/src/games/earwarts/
```

The GitHub Pages workflow uploads the source directly, so the game is available at
`/src/games/earwarts/index.html` alongside the other games.

### Survive Family Vacation

A seven-chapter mystery-comedy adventure: explore a 3D vacation, collect Vacation
Memories, investigate clues about the Vacation Collector, then survive a themed boss
encounter. Levels, dialogue, collectibles, achievements and cutscenes live in
`public/data/vacation/*.json`, so new vacations are a data change rather than engine
code. Progress, the scrapbook, achievements and settings are stored in localStorage.

### Crypt Crawl

A kid-friendly puzzle dungeon crawler: pick one of six original heroes, then drag
paths through a 6x6 board of matching tiles — swords hurt the monster, shields block
its bite, potions heal you, coins are treasure. Longer paths hit harder. Beat the
monster to descend; a boss waits every 5th floor and drops a relic to keep for the
run. Endless — the goal is your deepest floor, saved in localStorage.

Plain HTML, CSS and one ES module (`src/games/crypt-crawl/game.js`) — no build
step, no three.js, no external assets. Serve the repo root as above and open:

```text
http://localhost:8080/src/games/crypt-crawl/
```

### Aisle Rush '85

An original 1980s supermarket game show. Three teams play a six-question
grocery round; each correct answer adds ten seconds to that team's Big Sweep
clock. Then the winner in each team races the aisles for real groceries:
giant display items and hidden cash pay the most, five of any one product is
the limit, and a full 24-item cart has to be exchanged at your team's register.
The highest checkout total wins and plays the Bonus Sweep — three clues, sixty
seconds, and a $5,000 case of cash waiting back at the register.

Plain HTML, CSS, canvas and ES modules — no build step and no external assets
except the show fonts. Serve the repo root as above and open:

```text
http://localhost:8080/src/games/aisle-rush/
```

Controls: WASD or arrow keys, or drag anywhere on the canvas on touch. P or
Escape pauses. Best winnings are saved in localStorage.

Folder layout:

```text
src/games/aisle-rush/
  index.html
  styles.css
  game.js      # show flow: title, teams, quiz, checkout, bonus, final
  sweep.js     # canvas store, cart, pickups and bonus-clue chase
  content.js   # teams, shelves, quiz questions, bonus clues
  audio.js     # synthesized 80s show band and effects
```

### Keep

A cheerful monster-lair management game inspired by the classic dungeon-keeper
genre (original title, creatures and maps). You play a disembodied hand: mark
dirt to dig, paint rooms, then let imps, creatures and traps handle the tidying
knights who keep marching on your Dungeon Heart. It is one endless arena: waves
keep arriving, bosses turn up every fifth wave, and the goal is to set the
highest wave survived.

Plain HTML, CSS and ES modules with a vendored three.js — no build step. Serve
the repo root as above and open:

```text
http://localhost:8080/src/games/muddle-keep/
```

Folder layout:

```text
src/games/muddle-keep/
  index.html
  styles.css
  vendor/three.module.js
  js/
    main.js        # boot, fixed-timestep loop, run flow, saves
    content.js     # loads the JSON and parses ASCII maps
    tiles.js       # tile constants
    world.js       # grid, floors, rooms, walls, traps, serialisation
    path.js        # budgeted A* and visibility
    movement.js    # shared walk-the-path helpers
    tasks.js       # imp task queue, digging, hauling
    creatures.js   # creature stats, combat and manager
    needs.js       # eating, sleeping, training and wandering
    heroes.js      # invader waves and their AI
    spells.js      # Keeper spells
    economy.js     # gold, mana, food, research, wages
    game.js        # one endless run: actions, traps, loss, snapshots
    render.js      # three.js scene, instanced terrain, Heart and portal
    actors.js      # entity sync and pooled particle effects
    models.js      # procedural creature, imp and knight models
    camera.js      # angled top-down camera rig
    input.js       # mouse, touch and keyboard
    ui.js          # HUD, tool belt and live counters
    sheets.js      # room, trap and creature sheets
    tutorial.js    # endless tips that advance on player actions
    menus.js       # title, settings, pause, results
    save.js        # localStorage profile and best wave
    audio.js       # synthesised Web Audio sound and ambience
public/data/muddle-keep/
  rooms.json       # room types and research list
  creatures.json   # creature stats and requirements
  spells.json      # Keeper spells
  traps.json       # traps and doors
  heroes.json      # invader types
  levels.json      # endless arena and tutorial steps
```

Rooms, creatures, spells, traps and the arena are data changes rather than engine
code. The best wave, the current run snapshot and settings live in
`localStorage`; settings include volume, mute and a low-quality mode for slower
phones.

## Adding a New Game

1. Create a folder under `src/games/<game-name>/`.
2. Add an `index.html` that loads three.js (via the esm.sh import map) and your game script.
3. Add an entry to the `games` array in `src/data/games.js` with the game's `id`, `category` (`adventure`, `racing`, `music`, `arcade` or `cozy`), `title`, `description`, `image`, and `path`. The home page previews the latest seven entries, so append new games to the bottom of the array.
4. Add a card screenshot to `public/screenshots/`.
5. Link to the game from `games.html` (handled automatically by `src/main.js`).

## GitHub Pages Deployment

This repository includes `.github/workflows/deploy.yml` to deploy automatically with GitHub Actions.

### Setup steps

1. In GitHub repository settings, enable **Pages** and set **Build and deployment** source to **GitHub Actions**.
2. Ensure your DNS points `foofire.com` to GitHub Pages.
3. Keep the `CNAME` file in the repository root with:

```text
foofire.com
```

On pushes to `main`/`master` (and Copilot branches), the workflow deploys the static site.

## Legal

Foofire Games is a hobby project built for kids. It is not affiliated with any commercial entity, game studio, or organization.
