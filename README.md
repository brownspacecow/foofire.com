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
    escape-earth/   # Escape Earth: Survive Grandma's House three-level game
      index.html
      game.js
      level-drive.js
      level-dolls.js
      level-remote.js
    bear/          # Bear the Puppy three.js game
      index.html
      game.js
    pizza-homestead/  # Pizza Homestead: Fun Room Rush three.js game
      index.html
      game.js
    ball-pit/       # Ball Pit Bonanza three.js game
      index.html
      game.js
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

## Adding a New Game

1. Create a folder under `src/games/<game-name>/`.
2. Add an `index.html` that loads three.js (via the esm.sh import map) and your game script.
3. Add an entry to the `games` array in `src/main.js` with the game's `id`, `title`, `description`, and `path`.
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
