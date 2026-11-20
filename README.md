# Foofire Games

Foofire Games is a collection of browser games built with three.js for kids. Play free online games with no downloads and no accounts.

Tagline: **Games for kids.**

## Features

- Three.js games that run entirely in the browser
- Game portal with a library of playable games
- Dark, mobile-first responsive UI
- Dedicated legal disclaimer page

## Project Structure

```text
src/
  main.js          # Game portal navigation logic
  games/
    earwarts/       # Earwarts Academy: direct Three.js listening adventure
      index.html
      styles.css
      styles-ui.css
      styles-challenge.css
      vendor/       # vendored three.module.js (MIT)
      js/
        audio.js    # Web Audio synthesis and ear-training playback
        challenges.js # Pitch, interval, rhythm, melody and chord challenges
        world/      # 3D castle, rooms, NPCs, player and spells
        ui/         # Spellbook, map, quests, satchel, challenges
    muddle-keep/   # Muddle Keep: cheerful Dungeon Keeper-inspired lair tycoon
      index.html
      styles.css
      vendor/       # vendored three.module.js (MIT)
      js/           # world, imps, creatures, invaders, spells, render, UI, save
    rough-housing/  # Rough Housing: local two-player couch-fort wrestling
      index.html
      game.js
      arena.js
      characters.js
      fighters.js
    roost-rider/    # Roost Rider first-person off-road motorcycle race
      index.html
      game.js
      track.js
      riders.js
      audio.js
    roof-rider/     # Roof Rider 2D rooftop motocross rhythm racer
      index.html
      styles.css
      game.js
      terrain.js
      physics.js
      audio.js
      ghost.js
    escape-earth/   # Escape Earth: Survive Grandma's House four-level game
      index.html
      game.js
      level-drive.js
      level-dolls.js
      level-remote.js
      level-papa.js
    survive-family-vacation/  # Seven-chapter supernatural road-trip mystery
      index.html
      styles.css
      js/           # engine, world, mini-games, UI and local saves
    bear/          # Bear the Puppy three.js game
      index.html
      game.js
    pizza-homestead/  # Pizza Homestead: Fun Room Rush three.js game
      index.html
      game.js
    ball-pit/       # Ball Pit Bonanza three.js game
      index.html
      game.js
    christmas-trees-and-missals/  # Christmas Trees and Missals three.js game
      index.html
      game.js
      ornaments.js
      ornament-models.js
      town.js
      cutscene.js
      sound.js
  components/
  pages/
  data/
  utils/
public/
  data/
```

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

### Muddle Keep

A cheerful monster-lair management game inspired by the classic dungeon-keeper
genre (original title, creatures and maps). You play a disembodied hand: mark
dirt to dig, paint rooms, then let imps, creatures and traps handle the tidying
knights who keep marching on your Dungeon Heart.

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
    main.js        # boot, fixed-timestep loop, level flow, saves
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
    game.js        # one level: actions, traps, win/lose, snapshots
    render.js      # three.js scene, instanced terrain, Heart and portal
    actors.js      # entity sync and pooled particle effects
    models.js      # procedural creature, imp and knight models
    camera.js      # angled top-down camera rig
    input.js       # mouse, touch and keyboard
    ui.js          # HUD, tool belt and live counters
    sheets.js      # room, trap and creature sheets
    tutorial.js    # level tips that advance on player actions
    menus.js       # title, levels, settings, pause, results
    save.js        # localStorage profile
    audio.js       # synthesised Web Audio sound and ambience
public/data/muddle-keep/
  rooms.json       # room types and research list
  creatures.json   # creature stats and requirements
  spells.json      # Keeper spells
  traps.json       # traps and doors
  heroes.json      # invader types
  levels.json      # five ASCII maps, waves and tutorial steps
```

Rooms, creatures, spells, traps and all five levels are data changes rather than
engine code. Progress, the current level snapshot and settings live in
`localStorage`; settings include volume, mute and a low-quality mode for slower
phones.

## Adding a New Game

1. Create a folder under `src/games/<game-name>/`.
2. Add an `index.html` that loads three.js (via the esm.sh import map) and your game script.
3. Add an entry to the `games` array in `src/data/games.js` with the game's `id`, `title`, `description`, `image`, and `path`.
4. Link to the game from `games.html` (handled automatically by `src/main.js`).

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
