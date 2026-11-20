/* ------------------------------------------------------------------ *
 * Muddle Keep
 * Boot, the fixed-timestep loop, level flow, saving and event fan-out
 * to audio, effects and the HUD.
 * ------------------------------------------------------------------ */

import { loadContent } from './content.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { CameraRig } from './camera.js';
import { ActorLayer } from './actors.js';
import { GameUI } from './ui.js';
import { Menus } from './menus.js';
import { clearProfile, freshProfile, loadProfile, saveProfile } from './save.js';
import { audio } from './audio.js';
import { setupInput } from './input.js';

const STEP = 1 / 60;

const SOUND_ALIAS = {
  designate: 'click',
  undesignate: 'click',
  sell: 'click',
  hungry: 'error',
  'creature-left': 'creature-died',
  'hero-dug': 'dig',
  'wall-broken': 'wall',
  'trap-built': 'trap',
  wages: 'wages',
};

function soundFor(event) {
  if (event.type === 'tool' || event.type === 'attack' || event.type === 'imp-work') return null;
  return SOUND_ALIAS[event.type] ?? event.type;
}

async function boot() {
  const loading = document.querySelector('#mk-loading');
  const errorBox = document.querySelector('#mk-error');
  const stage = document.querySelector('#mk-stage');
  const hudRoot = document.querySelector('#mk-hud');
  const menuRoot = document.querySelector('#mk-menu');

  const content = await loadContent();
  let profile = loadProfile();

  const renderer = new Renderer(stage);
  renderer.setQuality(profile.settings.quality);
  audio.applySettings(profile.settings);
  const actors = new ActorLayer(renderer);
  const rig = new CameraRig(renderer.camera, { w: 30, h: 20, cx: 15, cz: 10 });

  let game = null;
  let previewGame = null;
  let paused = false;
  let resultTimer = null;

  const menus = new Menus(menuRoot, {
    content,
    profile,
    callbacks: {
      startLevel: (levelId, snapshot) => startLevel(levelId, snapshot),
      continueGame: () => {
        if (profile.current) startLevel(profile.current.levelId, profile.current);
      },
      resume: () => resumeGame(),
      restart: () => game && startLevel(game.level.id, null),
      retry: () => game && startLevel(game.level.id, null),
      quit: () => quitToTitle(),
      settings: (settings) => applySettings(settings),
      resetProgress: () => resetProgress(),
    },
  });

  const ui = new GameUI(hudRoot, {
    content,
    onPause: () => togglePause(),
    onHelp: () => menus.showHelp(),
    onFocus: (creature) => rig.focus(creature.x, creature.y),
  });
  ui.setVisible(false);

  /* --------------------------------------------------------------- flow */

  function startLevel(levelId, snapshot) {
    if (resultTimer) {
      window.clearTimeout(resultTimer);
      resultTimer = null;
    }
    const level = content.levelById.get(levelId) ?? content.levels[0];
    let nextGame = new Game(content, level, profile);
    if (snapshot) {
      const restored = nextGame.restore(snapshot);
      if (!restored) nextGame = new Game(content, level, profile);
    }
    game = nextGame;
    previewGame = null;
    renderer.buildLevel(game);
    rig.bounds = renderer.bounds;
    rig.frame(renderer.camera.aspect);
    rig.focus(game.world.heart.x + 0.5, game.world.heart.y + 0.5);
    actors.clear();
    actors.sync(game, renderer.camera, 0);
    ui.setGame(game);
    ui.setVisible(true);
    menus.hide();
    paused = false;
    audio.unlock();
    audio.setAmbient(true);
    document.title = `${level.name} · Muddle Keep`;
    profile.current = null;
    saveProfile(profile);
    if (game.status !== 'playing') finishLevel(game.status === 'won');
  }

  function buildPreview() {
    previewGame = new Game(content, content.levels[0]);
    renderer.buildLevel(previewGame);
    rig.bounds = renderer.bounds;
    rig.frame(renderer.camera.aspect);
    rig.focus(previewGame.world.heart.x + 0.5, previewGame.world.heart.y + 0.5);
    actors.clear();
    actors.sync(previewGame, renderer.camera, 0);
    renderer.update(0.016, previewGame);
    ui.setVisible(false);
  }

  function saveCurrent() {
    if (!game || game.status !== 'playing') return;
    profile.current = game.snapshot();
    saveProfile(profile);
  }

  function togglePause() {
    if (!game) return;
    if (menus.open) {
      if (menus.screen === 'pause') resumeGame();
      return;
    }
    if (game.status !== 'playing') return;
    paused = true;
    saveCurrent();
    menus.refresh(profile);
    menus.showPause(game);
    ui.closeSheet();
    audio.setAmbient(false);
  }

  function resumeGame() {
    if (!game) return;
    paused = false;
    menus.hide();
    audio.setAmbient(true);
  }

  function quitToTitle() {
    if (resultTimer) {
      window.clearTimeout(resultTimer);
      resultTimer = null;
    }
    if (game && game.status === 'playing') saveCurrent();
    game = null;
    paused = false;
    audio.setAmbient(false);
    menus.refresh(profile);
    menus.showTitle();
    buildPreview();
    document.title = 'Muddle Keep | Foofire Games';
  }

  function finishLevel(won) {
    if (!game) return;
    const level = game.level;
    const nextLevel =
      content.levels.find((entry) => entry.number === level.number + 1) ?? null;
    if (won) {
      profile.unlocked = Math.max(
        profile.unlocked,
        Math.min(content.levels.length, level.number + 1)
      );
      profile.stats.wins = (profile.stats.wins ?? 0) + 1;
      profile.stats.heroes = (profile.stats.heroes ?? 0) + game.stats.heroes;
      const best = profile.best[level.id];
      if (!best || game.time < best) profile.best[level.id] = Math.round(game.time);
      profile.current = null;
    } else {
      profile.current = null;
    }
    saveProfile(profile);
    paused = true;
    ui.setVisible(false);
    audio.setAmbient(false);
    audio.play(won ? 'win' : 'lose');
    menus.refresh(profile);
    menus.showResult({ won, game, nextLevel: won ? nextLevel : null });
  }

  function scheduleResult(won) {
    if (resultTimer) return;
    resultTimer = window.setTimeout(() => {
      resultTimer = null;
      finishLevel(won);
    }, 1200);
  }

  function applySettings(settings) {
    profile.settings = { ...profile.settings, ...settings };
    audio.applySettings(profile.settings);
    renderer.setQuality(profile.settings.quality);
    saveProfile(profile);
  }

  function resetProgress() {
    clearProfile();
    const fresh = freshProfile();
    profile = menus.profile = fresh;
    menus.refresh(profile);
    applySettings(fresh.settings);
    game = null;
    paused = false;
    menus.showTitle();
    buildPreview();
  }

  /* -------------------------------------------------------------- events */

  function handleEvents() {
    if (!game) return;
    const events = game.drainEvents();
    for (const event of events) {
      actors.handle(event);
      const sound = soundFor(event);
      if (sound) audio.play(sound, event);
      ui.handleEvent(event);
      if (event.type === 'error') ui.toast(event.text, 'warn');
      if (event.type === 'room-needs') ui.toast(event.text);
      if (event.type === 'room-ready') {
        ui.toast(`${event.icon ?? ''} ${event.name} ready!`.trim(), 'good');
      }
      if (event.type === 'research') ui.toast(`Researched: ${event.name}`, 'good');
      if (event.type === 'wages' && !event.ok) ui.toast('Payday missed! Mood is dropping.', 'warn');
      if (event.type === 'creature-left') ui.toast(`${event.name} stomped off home.`, 'warn');
      if (event.type === 'hero-died' && event.boss) {
        ui.toast('Baron Bumblefrost has left the dungeon.', 'good');
      }
      if (event.type === 'win') scheduleResult(true);
      if (event.type === 'lose') scheduleResult(false);
    }
  }

  /* ---------------------------------------------------------------- loop */

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;

    if (game && !menus.open && !paused && game.status === 'playing') {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 4) {
        game.update(STEP);
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === 4) accumulator = 0;
    } else {
      accumulator = 0;
    }

    handleEvents();

    if (game) {
      renderer.update(dt, game);
      actors.sync(game, renderer.camera, dt);
      ui.update(dt, game);
    } else if (previewGame) {
      renderer.update(dt, previewGame);
      actors.sync(previewGame, renderer.camera, dt);
    }
    rig.update(dt);
    renderer.render();
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- boot */

  setupInput({
    getGame: () => game,
    renderer,
    rig,
    ui,
    getMenus: () => menus,
    onPause: () => togglePause(),
  });

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('pagehide', () => {
    saveCurrent();
    audio.setAmbient(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveCurrent();
      if (game && game.status === 'playing' && !menus.open) togglePause();
    }
  });
  window.setInterval(() => {
    if (game && !menus.open && !paused) saveCurrent();
  }, 10_000);
  window.addEventListener('resize', () => {
    if (renderer.bounds) rig.frame(renderer.camera.aspect);
  });

  buildPreview();
  menus.showTitle();
  loading.hidden = true;
  window.requestAnimationFrame(frame);

  // Keep the title screen looking alive even while the simulation is idle.
  window.setInterval(() => {
    if (!game && previewGame) previewGame.time += 1 / 30;
  }, 33);

  if (errorBox) errorBox.hidden = true;
}

boot().catch((error) => {
  console.error('Muddle Keep failed to start', error);
  const loading = document.querySelector('#mk-loading');
  const errorBox = document.querySelector('#mk-error');
  if (loading) loading.hidden = true;
  if (errorBox) errorBox.hidden = false;
});
