/* ------------------------------------------------------------------ *
 * Survive Family Vacation
 * A cozy supernatural road-trip mystery. Everything lives in the browser:
 * three.js for the world, a 2D canvas for boss encounters, and JSON for
 * the story. No servers, no accounts.
 * ------------------------------------------------------------------ */

import * as THREE from 'three';
import { loadContent, resolveLevelObjects } from './content-loader.js?v=2';
import {
  clearSave,
  collect,
  evaluateAchievements,
  freshSave,
  loadSave,
  luckOf,
  persistSave,
} from './save.js?v=2';
import { VacationAudio } from './audio.js?v=2';
import { Input } from './input.js?v=3';
import { buildWorld } from './world.js?v=2';
import { Siblings, updateCinematicCamera, updateTitleCamera } from './siblings.js?v=2';
import { MINIGAMES } from './minigames.js?v=6';
import { GameUI } from './ui.js?v=4';
import { readMuted, writeMuted } from '../../../utils/audio-prefs.js?v=2';

const app = document.querySelector('#sfv-app');
const stage = document.querySelector('#sfv-stage');
const canvasHost = document.querySelector('#sfv-canvas');
const mgCanvas = document.querySelector('#sfv-mg-canvas');
const loadingText = document.querySelector('#sfv-loading-text');
const loadingPanel = document.querySelector('#sfv-loading');
const errorPanel = document.querySelector('#sfv-error');
const errorText = document.querySelector('#sfv-error-text');

const state = {
  mode: 'boot',
  content: null,
  save: null,
  audio: null,
  input: null,
  ui: null,
  renderer: null,
  camera: null,
  world: null,
  siblings: null,
  level: null,
  objects: [],
  investigating: false,
  investigateOverride: false,
  time: 0,
  orbitDelta: 0,
  zoomDelta: 0,
  tapInteract: false,
  dialogueOnDone: null,
  mgDef: null,
  mgState: null,
  mgG: null,
  mgFinished: false,
  mgInitialProgress: '',
  finalLevel: false,
};

const mgPointer = { x: 480, y: 270, down: false, justDown: false, inside: true };
const mgContext = mgCanvas?.getContext('2d');

/* ------------------------------------------------------------------ utils */
const byNumber = (number) => state.content.levels.find((level) => level.number === number);

function persist() {
  persistSave(state.save);
}

function remainingMemories() {
  const memoryIds = state.objects.filter((object) => object.kind === 'memory').map((object) => object.id);
  return memoryIds.filter((id) => !state.save.memories.includes(id)).length;
}

function levelTally(level = state.level) {
  const objects = level && level === state.level ? state.objects : resolveLevelObjects(level, state.content);
  const count = (kind) => objects.filter((object) => object.kind === kind).length;
  const found = (kind, field) =>
    objects
      .filter((object) => object.kind === kind)
      .filter((object) => state.save[field].includes(object.id)).length;
  return {
    memories: found('memory', 'memories'),
    memoryTotal: count('memory'),
    clues: found('clue', 'clues'),
    clueTotal: count('clue'),
    secrets: found('secret', 'secrets'),
    secretTotal: count('secret'),
  };
}

function updateHud() {
  if (!state.ui) return;
  const tally = state.level ? levelTally() : { memories: 0, memoryTotal: 3, clues: 0, clueTotal: 3 };
  state.ui.updateHud({
    level: state.level,
    memories: tally.memories,
    memoryTotal: tally.memoryTotal,
    clues: tally.clues,
    clueTotal: tally.clueTotal,
    luck: luckOf(state.save),
    character: state.siblings?.active ?? 'jira',
    investigating: state.investigating,
    muted: state.save.settings.muted,
    fullscreen: Boolean(document.fullscreenElement),
  });
}

function refreshAchievements() {
  const newlyEarned = evaluateAchievements(state.save, state.content.achievements, state.content.totals);
  if (!newlyEarned.length) return;
  persist();
  state.audio.sfx('secret');
  newlyEarned.forEach((achievement) => {
    state.ui.toast({
      emoji: achievement.emoji,
      title: achievement.name,
      text: achievement.text,
      kind: 'achievement',
      duration: 5400,
    });
  });
  updateHud();
}

function bark(key) {
  return state.content.barks?.[key] ?? '';
}

/* --------------------------------------------------------------- world mgmt */
function disposeWorld(world) {
  if (!world) return;
  world.scene.traverse((child) => {
    if (child.userData?.dispose) child.userData.dispose();
    if (child.geometry) child.geometry.dispose();
  });
  world.scene.clear();
}

function buildLevelWorld(level) {
  disposeWorld(state.world);
  const objects = resolveLevelObjects(level, state.content);
  const world = buildWorld({
    level: { ...level, bounds: state.content.bounds },
    objects,
    luck: luckOf(state.save),
    reducedMotion: state.save.settings.reducedMotion,
  });

  // Anything already in the scrapbook stays collected.
  world.interactables.forEach((entry) => {
    if (entry.kind === 'memory' && state.save.memories.includes(entry.id)) {
      entry.collected = true;
      entry.group.visible = false;
    } else if (entry.kind === 'clue' && state.save.clues.includes(entry.id)) {
      entry.collected = true;
      entry.group.visible = false;
    } else if (entry.kind === 'secret' && state.save.secrets.includes(entry.id)) {
      entry.collected = true;
      entry.group.visible = false;
    }
  });

  state.world = world;
  state.objects = objects;
  state.level = level;
  state.siblings = new Siblings(world.scene);
  state.investigating = false;
  state.investigateOverride = false;
  state.ui.setVignette(false);
  world.setGateReady(remainingMemories() === 0);
  return world;
}

function buildTitleWorld() {
  const level = state.content.levels[0];
  if (!level) return;
  disposeWorld(state.world);
  state.world = buildWorld({
    level: { ...level, bounds: state.content.bounds },
    objects: [],
    luck: luckOf(state.save),
    reducedMotion: state.save.settings.reducedMotion,
  });
  state.siblings = null;
  state.level = null;
  state.objects = [];
  state.camera.position.set(0, 11, 16);
}

/* ------------------------------------------------------------------- level */
function startLevel(number) {
  const level = byNumber(number) ?? state.content.levels[0];
  if (!level) return;

  state.save.started = true;
  state.save.unlocked = Math.max(state.save.unlocked, level.number);
  state.save.stats.levelRuns += 1;
  persist();

  buildLevelWorld(level);
  state.ui.hideMinigame();
  state.ui.stopDialogue();
  state.ui.clearToasts();
  state.ui.hideScreens();
  state.ui.setLetterbox(true);
  state.ui.setPrompt(null);
  state.ui.setGoal(level.subtitle);
  state.mode = 'cinematic';
  state.investigateOverride = false;
  state.investigating = false;
  state.audio.setScene(level.palette?.night ? 'mystery' : 'cozy');
  updateHud();

  const intro = Array.isArray(level.intro) ? level.intro : [];
  const begin = () => beginExplore(level);

  if (!intro.length) {
    begin();
    return;
  }

  state.ui.toast({
    emoji: level.boss?.emoji ?? '🧳',
    title: `Stop ${level.number}: ${level.title}`,
    text: level.place,
    duration: 4200,
  });
  state.ui.startDialogue(intro, begin);
}

function beginExplore(level) {
  state.ui.setLetterbox(false);
  state.ui.stopDialogue();
  state.ui.setGoal(level.goal ?? level.subtitle ?? '');
  state.mode = 'explore';
  state.tapInteract = false;

  // Drop the camera behind the kids so the first frame of play reads.
  const position = state.siblings.position;
  state.camera.position.set(position.x, 9, position.z + 13);
  state.camera.lookAt(position.x, 1.2, position.z);
  updateHud();
}

function completeLevel() {
  const level = state.level;
  if (!level) return;

  const levelKey = String(level.number);
  if (!state.save.completed.includes(levelKey)) state.save.completed.push(levelKey);
  state.save.unlocked = Math.max(state.save.unlocked, Math.min(state.content.levels.length, level.number + 1));
  state.save.started = true;
  persist();

  state.audio.setScene(level.palette?.night ? 'mystery' : 'cozy');
  state.ui.setLetterbox(true);
  state.ui.hideMinigame();
  state.mode = 'cinematic';
  refreshAchievements();

  const outro = Array.isArray(level.outro) ? level.outro : [];
  const finish = () => {
    if (level.number === state.content.levels.length) {
      playEnding();
      return;
    }
    showLevelComplete(level);
  };

  if (outro.length) state.ui.startDialogue(outro, finish);
  else finish();
}

function showLevelComplete(level) {
  state.ui.setLetterbox(false);
  state.mode = 'complete';
  const tally = levelTally(level);
  state.ui.showComplete({
    level,
    stats: [
      { label: 'Memories', value: `${tally.memories} / ${tally.memoryTotal}` },
      { label: 'Clues', value: `${tally.clues} / ${tally.clueTotal}` },
      { label: 'Family Luck', value: String(luckOf(state.save)) },
    ],
  });
  state.ui.setTopbarVisible(false);
  state.audio.sfx('win');
}

function playEnding() {
  state.save.ending = true;
  persist();
  refreshAchievements();
  state.mode = 'cinematic';
  state.audio.setScene('mystery');
  state.ui.startCutscene(state.content.cutscenes.ending, () => {
    state.ui.setLetterbox(false);
    state.mode = 'complete';
    state.ui.showComplete({
      level: state.level,
      final: true,
      primaryLabel: 'Back to the menu',
      stats: [
        { label: 'Memories', value: `${state.save.memories.length} / ${state.content.totals.memories}` },
        { label: 'Clues', value: `${state.save.clues.length} / ${state.content.totals.clues}` },
        { label: 'Family Luck', value: String(luckOf(state.save)) },
      ],
    });
    state.audio.sfx('win');
  });
}

function quitToTitle() {
  state.ui.hideMinigame();
  state.ui.stopDialogue();
  state.ui.clearToasts();
  state.ui.setPrompt(null);
  state.ui.setLetterbox(false);
  state.ui.setVignette(false);
  state.mode = 'title';
  state.investigating = false;
  state.investigateOverride = false;
  buildTitleWorld();
  state.ui.showTitle();
  state.audio.setScene('title');
  updateHud();
}

/* ------------------------------------------------------------- interaction */
function nearestInteractable() {
  if (!state.world || !state.siblings) return null;
  const position = state.siblings.position;
  let best = null;
  let bestDistance = Infinity;

  state.world.interactables.forEach((entry) => {
    if (entry.collected) return;
    if (entry.hidden && !state.investigating) return;
    const distance = Math.hypot(position.x - entry.x, position.z - entry.z);
    if (distance <= entry.radius && distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  });

  return best;
}

function promptFor(entry) {
  switch (entry.kind) {
    case 'memory':
      return `Take ${entry.name}`;
    case 'clue':
      return `Examine ${entry.name}`;
    case 'secret':
      return luckOf(state.save) >= entry.luck ? `Claim ${entry.name}` : 'Something golden is hiding here';
    case 'sign':
      return 'Read the sign';
    case 'person':
      return `Talk to ${entry.name}`;
    case 'tunnel':
      return state.siblings?.active === 'joel' ? 'Crawl through the tunnel' : 'Crawl through (Joel would fit)';
    case 'gate': {
      const left = remainingMemories();
      if (left > 0) return `${left} more ${left === 1 ? 'memory' : 'memories'} before the gate opens`;
      return `Face ${state.level?.boss?.name ?? 'the boss'}`;
    }
    default:
      return 'Look closer';
  }
}

function collectItem(entry) {
  const field = entry.kind === 'memory' ? 'memories' : entry.kind === 'clue' ? 'clues' : 'secrets';
  collect(state.save, field, entry.id);
  entry.collected = true;
  entry.group.visible = false;
  persist();

  state.ui.setPrompt(null);
  state.audio.sfx(entry.kind === 'secret' ? 'secret' : entry.kind === 'clue' ? 'clue' : 'pickup');
  state.ui.toast({
    emoji: entry.emoji,
    title: entry.name,
    text: (entry.blurb || entry.text || '').slice(0, 160),
    duration: 4400,
  });

  updateHud();
  refreshAchievements();

  if (entry.kind === 'memory' && remainingMemories() === 0) {
    state.world.setGateReady(true);
    state.audio.sfx('clue');
    state.ui.toast({
      emoji: '🚪',
      title: 'The way is open',
      text: `${state.level.boss?.name ?? 'The boss'} is waiting at the gate.`,
      duration: 4600,
    });
  }
}

function interact(entry) {
  if (!entry) return;

  if (entry.kind === 'memory' || entry.kind === 'clue') {
    collectItem(entry);
    return;
  }

  if (entry.kind === 'secret') {
    const luck = luckOf(state.save);
    if (luck < entry.luck) {
      state.audio.sfx('click');
      state.ui.showLine({
        who: 'Jira',
        emoji: '🔎',
        text: `There is something golden here, but it does not trust us yet. Family Luck ${entry.luck} should do it. We are at ${luck}.`,
      });
      return;
    }
    collectItem(entry);
    return;
  }

  if (entry.kind === 'sign') {
    if (!state.save.signs.includes(entry.id)) {
      state.save.signs.push(entry.id);
      persist();
      refreshAchievements();
    }
    state.audio.sfx('click');
    state.ui.showLine({ who: 'A very official sign', emoji: '🪧', text: entry.text });
    return;
  }

  if (entry.kind === 'person') {
    const lines = entry.lines ?? [];
    if (!lines.length) return;
    entry.lineIndex = ((entry.lineIndex ?? -1) + 1) % lines.length;
    state.audio.sfx('click');
    state.ui.showLine({ who: entry.name, emoji: entry.emoji, text: lines[entry.lineIndex] });
    return;
  }

  if (entry.kind === 'tunnel') {
    if (state.siblings.active !== 'joel') {
      state.audio.sfx('click');
      state.ui.showLine({ who: 'Jira', emoji: '🧭', text: bark('tunnelJira') });
      return;
    }
    state.save.stats.crawls += 1;
    persist();
    state.siblings.teleport(entry.to.x, entry.to.z);
    state.audio.sfx('swap');
    state.ui.toast({
      emoji: '🕳️',
      title: 'Joel-sized',
      text: 'He pops out the other side, extremely pleased with himself.',
    });
    refreshAchievements();
    return;
  }

  if (entry.kind === 'gate') {
    if (remainingMemories() > 0) {
      state.audio.sfx('fail');
      state.ui.toast({
        emoji: '🚪',
        title: 'Not yet',
        text: bark('gateLocked').replace('{n}', String(remainingMemories())),
      });
      return;
    }
    startMinigame();
  }
}

function swapKid() {
  if (state.mode !== 'explore' || !state.siblings) return;
  if (!state.siblings.swap()) return;
  state.save.stats.swaps += 1;
  state.investigating = false;
  state.investigateOverride = false;
  persist();
  state.audio.sfx('swap');
  state.ui.setVignette(false);
  const active = state.siblings.active;
  const text =
    state.save.stats.swaps === 1
      ? bark('swapHint')
      : active === 'jira'
        ? bark('swapJira')
        : bark('swapJoel');
  state.ui.showLine({ who: active === 'jira' ? 'Jira' : 'Joel', emoji: active === 'jira' ? '🔎' : '⚡', text });
  updateHud();
}

function setInvestigating(on) {
  if (!state.siblings) return;
  if (state.siblings.active !== 'jira') {
    if (on) {
      state.ui.showLine({ who: 'Joel', emoji: '⚡', text: bark('joelCantInvestigate') });
      state.audio.sfx('click');
    }
    state.investigating = false;
    state.ui.setVignette(false);
    updateHud();
    return;
  }
  if (state.investigating === on) return;
  state.investigating = on;
  state.siblings.setInvestigating(on);
  state.ui.setVignette(on);
  if (on) {
    state.audio.sfx('investigate');
    state.save.stats.investigations += 1;
    persist();
    refreshAchievements();
  }
  updateHud();
}

/* -------------------------------------------------------------- mini-games */
function beginMinigame() {
  const level = state.level;
  const definition = MINIGAMES[level?.minigame?.type];
  if (!definition || !mgContext) {
    // A missing mechanic should never trap the player in a level.
    completedEncounter();
    return;
  }

  state.mgDef = definition;
  state.mgFinished = false;
  state.ui.hideMinigameResult();
  state.ui.showMinigame(level, definition);
  state.mode = 'minigame';
  state.ui.setPrompt(null);
  state.ui.setVignette(false);
  state.audio.setScene('boss');
  state.audio.sfx('boss');

  state.mgG = {
    config: level.minigame.config ?? {},
    w: 960,
    h: 540,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
      actionPressed: false,
      choices: [false, false, false, false],
      pressed: { up: false, down: false, left: false, right: false },
      pointer: { ...mgPointer },
    },
    win: () => finishMinigame(true),
    fail: (message) => finishMinigame(false, message),
    sfx: (name) => state.audio.sfx(name),
    progress: (text) => state.ui.setMinigameProgress(text),
    level,
  };

  state.mgState = definition.init(state.mgG);
  state.mgInitialProgress = '';
  definition.draw(state.mgG, mgContext, state.mgState);
}

function startMinigame() {
  state.ui.stopDialogue();
  beginMinigame();
}

function finishMinigame(won, message) {
  if (state.mgFinished) return;
  state.mgFinished = true;

  if (!won) {
    state.mode = 'mgResult';
    state.ui.showMinigameLoss(message, state.level?.boss?.name ?? 'The boss');
    state.audio.sfx('fail');
    return;
  }

  state.mode = 'cinematic';
  state.audio.sfx('win');
  completedEncounter();
}

function completedEncounter() {
  state.ui.hideMinigame();
  state.ui.setLetterbox(true);
  if (state.level?.boss?.win) {
    state.ui.toast({
      emoji: state.level.boss.emoji ?? '💥',
      title: 'Encounter cleared',
      text: state.level.boss.win,
      duration: 4800,
    });
  }
  completeLevel();
}

function retryMinigame() {
  if (!state.mgDef) return;
  state.mgFinished = false;
  state.ui.hideMinigameResult();
  state.ui.setMinigameProgress(state.mgInitialProgress ?? '');
  state.mgState = state.mgDef.init(state.mgG);
  state.mode = 'minigame';
  state.audio.setScene('boss');
}

function leaveMinigame() {
  state.ui.hideMinigame();
  state.mode = 'explore';
  state.audio.setScene(state.level?.palette?.night ? 'mystery' : 'cozy');
  state.ui.setGoal(state.level?.goal ?? '');
  updateHud();
}

/* ---------------------------------------------------------------- settings */
function applySettings(partial = {}) {
  const save = state.save;
  Object.assign(save.settings, partial);
  persist();

  state.audio.setVolumes(save.settings.music, save.settings.sfx);
  state.audio.setMuted(save.settings.muted);
  if (partial.muted !== undefined) writeMuted(save.settings.muted);
  state.ui.applyAccessibility(save.settings);
  updateHud();
}

function toggleMute() {
  applySettings({ muted: !state.save.settings.muted });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    app.requestFullscreen?.().catch(() => {
      state.ui.toast({ emoji: '⛶', title: 'Full screen is blocked here', text: 'The browser said no. Everything still works.' });
    });
  } else {
    document.exitFullscreen?.();
  }
}

/* ------------------------------------------------------------------ screens */
function togglePause() {
  if (state.mode === 'explore') {
    state.ui.showPause();
  } else if (state.mode === 'paused') {
    resumeGame();
  }
}

function resumeGame() {
  if (!state.level) {
    state.ui.showTitle();
    return;
  }
  state.ui.hideScreens();
  state.mode = 'explore';
  state.ui.setLetterbox(false);
  updateHud();
}

function handleScreenChanged(name) {
  if (state.input) state.input.captureTab = !name;
  if (name === 'pause') state.mode = 'paused';
  if (name === 'complete') state.mode = 'complete';
  if (name === 'title') state.mode = 'title';
  if (name === null && state.mode === 'paused') state.mode = 'explore';
}

function newGame() {
  if (state.save.started && !window.confirm('Start a new vacation? This clears the scrapbook on this device.')) {
    return;
  }
  const settings = { ...state.save.settings };
  state.save = { ...freshSave(), settings };
  state.ui.setSave(state.save);
  persist();
  updateHud();

  state.ui.hideScreens();
  state.ui.setTopbarVisible(false);
  state.ui.setLetterbox(true);
  state.mode = 'cinematic';
  state.audio.setScene('mystery');

  if (state.content.cutscenes?.intro) {
    state.ui.startCutscene(state.content.cutscenes.intro, () => {
      state.ui.setLetterbox(false);
      startLevel(1);
    });
  } else {
    startLevel(1);
  }
}

function continueGame() {
  startLevel(Math.min(state.save.unlocked, state.content.levels.length));
}

function resetProgress() {
  const settings = { ...state.save.settings };
  clearSave();
  state.save = { ...freshSave(), settings };
  state.ui.setSave(state.save);
  persist();
  quitToTitle();
  state.ui.toast({
    emoji: '🧹',
    title: 'Scrapbook cleared',
    text: 'New vacation, new pages. The settings stayed put.',
  });
}

const actions = {
  newGame,
  continueGame,
  startLevel,
  resume: resumeGame,
  restartLevel: () => state.level && startLevel(state.level.number),
  quitToTitle,
  nextLevel: () => {
    if (!state.level) {
      state.ui.showTitle();
      return;
    }
    if (state.level.number >= state.content.levels.length) quitToTitle();
    else startLevel(state.level.number + 1);
  },
  replayLevel: () => state.level && startLevel(state.level.number),
  retryMinigame,
  leaveMinigame,
  swap: swapKid,
  toggleInvestigate: () => {
    state.investigateOverride = !state.investigateOverride;
    const held = Boolean(state.input?.isDown('investigate'));
    setInvestigating(state.investigateOverride || held);
  },
  togglePause,
  toggleMute,
  toggleFullscreen,
  updateSettings: applySettings,
  resetProgress,
  screenChanged: handleScreenChanged,
};

/* --------------------------------------------------------------------- loop */
let lastTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  state.time += delta;

  const input = state.input;
  input.poll();

  if (state.mode === 'minigame' && state.mgDef && state.mgG) {
    updateMinigame(delta, input);
  } else {
    handleTextAdvance(input);

    if (state.mode === 'explore') {
      updateExplore(delta, input);
    } else if (state.mode === 'cinematic') {
      updateCinematic(delta);
    } else if (state.mode === 'title') {
      updateTitle(delta);
    } else {
      updateAmbient(delta);
      if (state.mode === 'paused' && input.take('pause')) resumeGame();
    }
  }

  input.endFrame();
  if (state.world && state.renderer && state.camera) {
    state.renderer.render(state.world.scene, state.camera);
  }
}

function handleTextAdvance(input) {
  if (state.ui.cutsceneActive) {
    if (input.take('next') || input.take('action')) state.ui.advanceCutscene();
    return;
  }
  if (state.ui.dialogueActive) {
    if (input.take('next') || input.take('action')) state.ui.advanceDialogue();
  }
}

function updateExplore(delta, input) {
  const siblings = state.siblings;
  const world = state.world;
  if (!siblings || !world) return;

  if (input.take('pause')) {
    togglePause();
    return;
  }
  if (input.take('swap')) swapKid();

  const shiftHeld = input.isDown('investigate');
  const wantsInvestigation = siblings.active === 'jira' && (shiftHeld || state.investigateOverride);
  if (wantsInvestigation !== state.investigating) setInvestigating(wantsInvestigation);
  if (siblings.active !== 'jira' && state.investigating) setInvestigating(false);

  const move = input.moveVector();
  if (state.joystick && state.joystick.active) {
    move.x = Math.min(1, Math.max(-1, move.x + state.joystick.x));
    move.y = Math.min(1, Math.max(-1, move.y + state.joystick.y));
    const length = Math.hypot(move.x, move.y);
    if (length > 1) {
      move.x /= length;
      move.y /= length;
    }
  }

  siblings.update(delta, move, {
    colliders: world.colliders,
    bounds: world.bounds,
    reducedMotion: state.save.settings.reducedMotion,
    camera: state.camera,
    orbitDelta: state.orbitDelta,
    zoomDelta: state.zoomDelta,
  });
  state.orbitDelta = 0;
  state.zoomDelta = 0;

  world.update(delta, {
    playerPos: siblings.position,
    investigating: state.investigating,
    camera: state.camera,
  });
  world.setGateReady(remainingMemories() === 0);

  const nearest = nearestInteractable();
  state.ui.setPrompt(nearest ? promptFor(nearest) : null);

  if (nearest && (input.take('action') || state.tapInteract)) {
    state.tapInteract = false;
    interact(nearest);
  }
  state.tapInteract = false;
}

function updateCinematic(delta) {
  const world = state.world;
  if (!world) return;
  if (state.siblings) {
    state.siblings.update(delta, { x: 0, y: 0 }, {
      colliders: world.colliders,
      bounds: world.bounds,
      reducedMotion: true,
      camera: null,
    });
  }
  world.update(delta, {
    playerPos: state.siblings?.position ?? { x: 0, z: 0 },
    investigating: false,
    camera: null,
  });
  updateCinematicCamera(state.camera, world.focus, state.time, 0.12);
}

function updateTitle(delta) {
  const world = state.world;
  if (!world) return;
  world.update(delta, { playerPos: { x: 0, z: 0 }, investigating: false, camera: null });
  updateTitleCamera(state.camera, world.focus, state.time);
}

function updateAmbient(delta) {
  const world = state.world;
  if (!world) return;
  world.update(delta, {
    playerPos: state.siblings?.position ?? { x: 0, z: 0 },
    investigating: state.investigating,
    camera: null,
  });
}

function updateMinigame(delta, input) {
  const definition = state.mgDef;
  const g = state.mgG;
  if (!definition || !g || !state.mgState) return;

  g.input.up = input.isDown('up');
  g.input.down = input.isDown('down');
  g.input.left = input.isDown('left');
  g.input.right = input.isDown('right');
  g.input.action = input.isDown('action') || mgPointer.down;
  g.input.actionPressed = input.take('action') || mgPointer.justDown;
  g.input.choices = [1, 2, 3, 4].map((number) => input.wasPressed(`choice${number}`));
  g.input.pressed = {
    up: input.wasPressed('up'),
    down: input.wasPressed('down'),
    left: input.wasPressed('left'),
    right: input.wasPressed('right'),
  };
  g.input.pointer = {
    x: mgPointer.x,
    y: mgPointer.y,
    down: mgPointer.down,
    justDown: mgPointer.justDown,
    inside: mgPointer.inside,
  };

  if (!state.mgFinished) definition.update(g, delta, state.mgState);

  if (state.mode === 'minigame') {
    definition.draw(g, mgContext, state.mgState);
  }
  mgPointer.justDown = false;
}

/* --------------------------------------------------------------- boot & DOM */
function resizeRenderer() {
  if (!state.renderer || !state.camera) return;
  const width = Math.max(320, stage.clientWidth);
  const height = Math.max(280, stage.clientHeight);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
}

function pointerToCanvas(event) {
  const rect = mgCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 960,
    y: ((event.clientY - rect.top) / rect.height) * 540,
  };
}

function bindStageInput() {
  let drag = null;
  const stick = document.createElement('div');
  stick.className = 'sfv-stick';
  stick.hidden = true;
  stick.innerHTML = '<span></span>';
  stage.append(stick);
  const knob = stick.querySelector('span');
  state.joystick = null;

  const stopStick = () => {
    if (!state.joystick) return;
    state.joystick = null;
    stick.hidden = true;
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, a, input, select, .sfv-screen, .sfv-mg')) return;
    if (state.mode !== 'explore') {
      if (state.mode === 'cinematic' && state.ui.dialogueActive) {
        state.ui.advanceDialogue();
        return;
      }
      return;
    }

    const rect = stage.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (event.pointerType === 'touch' && localX < rect.width * 0.46) {
      state.joystick = { active: true, id: event.pointerId, originX: localX, originY: localY, x: 0, y: 0 };
      stick.hidden = false;
      stick.style.left = `${localX}px`;
      stick.style.top = `${localY}px`;
      knob.style.setProperty('--sx', '0px');
      knob.style.setProperty('--sy', '0px');
      stage.setPointerCapture?.(event.pointerId);
      return;
    }

    drag = { id: event.pointerId, x: event.clientX, lastX: event.clientX, y: event.clientY, moved: 0 };
    stage.setPointerCapture?.(event.pointerId);
  });

  stage.addEventListener('pointermove', (event) => {
    if (state.joystick && event.pointerId === state.joystick.id) {
      const rect = stage.getBoundingClientRect();
      const dx = event.clientX - rect.left - state.joystick.originX;
      const dy = event.clientY - rect.top - state.joystick.originY;
      const length = Math.hypot(dx, dy);
      const limit = 42;
      const scale = length > limit ? limit / length : 1;
      state.joystick.x = (dx * scale) / limit;
      state.joystick.y = (dy * scale) / limit;
      knob.style.setProperty('--sx', `${dx * scale}px`);
      knob.style.setProperty('--sy', `${dy * scale}px`);
      return;
    }

    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.moved += Math.abs(dx) + Math.abs(event.clientY - drag.y);
    drag.y = event.clientY;
    state.orbitDelta += dx * 0.005;
  });

  const finishPointer = (event) => {
    if (state.joystick && event.pointerId === state.joystick.id) {
      stopStick();
      return;
    }
    if (!drag || event.pointerId !== drag.id) return;
    const wasTap = drag.moved < 10;
    drag = null;
    if (wasTap && state.mode === 'explore') state.tapInteract = true;
  };

  stage.addEventListener('pointerup', finishPointer);
  stage.addEventListener('pointercancel', finishPointer);

  stage.addEventListener(
    'wheel',
    (event) => {
      if (state.mode !== 'explore') return;
      event.preventDefault();
      state.zoomDelta += Math.sign(event.deltaY) * 0.9;
    },
    { passive: false }
  );

  mgCanvas.addEventListener('pointerdown', (event) => {
    if (state.mode !== 'minigame') return;
    const point = pointerToCanvas(event);
    mgPointer.x = point.x;
    mgPointer.y = point.y;
    mgPointer.down = true;
    mgPointer.justDown = true;
    mgPointer.inside = true;
    mgCanvas.setPointerCapture?.(event.pointerId);
  });

  window.addEventListener('pointerup', () => {
    mgPointer.down = false;
  });

  mgCanvas.addEventListener('pointermove', (event) => {
    const point = pointerToCanvas(event);
    mgPointer.x = point.x;
    mgPointer.y = point.y;
    mgPointer.inside = true;
  });

  mgCanvas.addEventListener('pointerleave', () => {
    mgPointer.inside = false;
  });
}

function bindGlobalEvents() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'explore') togglePause();
  });

  document.addEventListener('fullscreenchange', updateHud);

  window.addEventListener('resize', resizeRenderer);

  const unlockAudio = () => {
    state.audio.unlock();
    if (state.mode === 'title') state.audio.setScene('title');
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
}

async function init() {
  const input = new Input();
  state.input = input;

  const save = loadSave();
  save.settings.muted = save.settings.muted || readMuted('sfvMuted');
  state.save = save;

  const audio = new VacationAudio();
  audio.muted = save.settings.muted;
  audio.setVolumes(save.settings.music, save.settings.sfx);
  state.audio = audio;

  let content;
  try {
    if (loadingText) loadingText.textContent = 'Loading seven vacations…';
    content = await loadContent();
  } catch (error) {
    loadingPanel?.setAttribute('hidden', '');
    errorPanel?.removeAttribute('hidden');
    if (errorText) {
      errorText.textContent = `${error.message}. The game reads its story from public/data/vacation — serve the site over HTTP rather than opening the file directly.`;
    }
    return;
  }

  state.content = content;

  const ui = new GameUI({ content, save, actions });
  state.ui = ui;
  ui.applyAccessibility(save.settings);
  ui.setSave(save);

  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor('#0a0518', 1);
    canvasHost.append(renderer.domElement);
    state.renderer = renderer;

    state.camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 220);
    resizeRenderer();
  } catch (error) {
    ui.showError('This browser could not start WebGL, which the family vacation requires.');
    return;
  }

  bindStageInput();
  bindGlobalEvents();

  buildTitleWorld();
  ui.hideLoading();
  ui.showTitle();
  state.mode = 'title';
  audio.setScene('title');
  updateHud();

  requestAnimationFrame((now) => {
    lastTime = now;
    loop(now);
  });
}

init();
