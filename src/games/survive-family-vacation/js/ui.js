/* ------------------------------------------------------------------ *
 * Interface
 * Owns every piece of DOM around the 3D stage: the HUD, the title menu,
 * chapter select, scrapbook, settings, pause, dialogue, cutscenes and
 * boss-encounter chrome.
 * ------------------------------------------------------------------ */

import { LUCK_TIERS, luckOf, luckProgress, tierOf } from './save.js?v=2';

const $ = (selector) => document.querySelector(selector);

const SCREEN_IDS = {
  title: '#screen-title',
  chapters: '#screen-chapters',
  scrapbook: '#screen-scrapbook',
  settings: '#screen-settings',
  credits: '#screen-credits',
  pause: '#screen-pause',
  complete: '#screen-complete',
};

export class GameUI {
  constructor({ content, save, actions }) {
    this.content = content;
    this.save = save;
    this.actions = actions;
    this.currentScreen = 'title';
    this.previousScreen = 'title';
    this.dialogue = null;
    this.cutscene = null;
    this.typeTimer = null;
    this.toasts = [];

    this.el = {
      app: $('#sfv-app'),
      topbar: $('.sfv-topbar'),
      stage: $('#sfv-stage'),
      goal: $('#sfv-goal'),
      prompt: $('#sfv-prompt'),
      promptKey: $('#sfv-prompt-key'),
      promptText: $('#sfv-prompt-text'),
      subtitle: $('#sfv-subtitle'),
      speaker: $('#sfv-speaker'),
      line: $('#sfv-line'),
      nextLine: $('#sfv-next'),
      toasts: $('#sfv-toasts'),
      letterbox: $('#sfv-letterbox'),
      vignette: $('#sfv-vignette'),
      hud: {
        stop: $('#hud-stop'),
        chapter: $('#hud-chapter'),
        mem: $('#hud-mem'),
        memMax: $('#hud-mem-max'),
        clue: $('#hud-clue'),
        clueMax: $('#hud-clue-max'),
        luckValue: $('#hud-luck-value'),
        luckFill: $('#hud-luck-fill'),
        luckBar: $('#hud-luck-bar'),
        luckTier: $('#hud-luck-tier'),
        swap: $('#hud-swap'),
        charEmoji: $('#hud-char-emoji'),
        charName: $('#hud-char-name'),
        investigate: $('#hud-investigate'),
        pause: $('#hud-pause'),
        mute: $('#hud-mute'),
        fullscreen: $('#hud-fullscreen'),
      },
      mg: $('#sfv-mg'),
      mgEmoji: $('#sfv-mg-emoji'),
      mgBoss: $('#sfv-mg-boss'),
      mgTitle: $('#sfv-mg-title'),
      mgHint: $('#sfv-mg-hint'),
      mgCanvas: $('#sfv-mg-canvas'),
      mgProgress: $('#sfv-mg-progress'),
      mgResult: $('#sfv-mg-result'),
      mgResultKicker: $('#sfv-mg-result-kicker'),
      mgResultTitle: $('#sfv-mg-result-title'),
      mgResultText: $('#sfv-mg-result-text'),
      mgRetry: $('#sfv-mg-retry'),
      mgLeave: $('#sfv-mg-leave'),
      mgQuit: $('#sfv-mg-quit'),
      continueButton: $('#btn-continue'),
      continueNote: $('#btn-continue-note'),
      chapterGrid: $('#chapter-grid'),
      chaptersNote: $('#chapters-note'),
      sbSummary: $('#sb-summary'),
      sbMemories: $('#sb-memories'),
      sbClues: $('#sb-clues'),
      sbLore: $('#sb-lore'),
      sbAchievements: $('#sb-achievements'),
      credits: $('#credits-list'),
      cutscene: $('#sfv-cutscene'),
      cutKicker: $('#cut-kicker'),
      cutTitle: $('#cut-title'),
      cutEmoji: $('#cut-emoji'),
      cutSpeaker: $('#cut-speaker'),
      cutText: $('#cut-text'),
      cutNext: $('#cut-next'),
      cutSkip: $('#cut-skip'),
      loading: $('#sfv-loading'),
      loadingText: $('#sfv-loading-text'),
      error: $('#sfv-error'),
      errorText: $('#sfv-error-text'),
      lcKicker: $('#lc-kicker'),
      lcTitle: $('#lc-title'),
      lcBody: $('#lc-body'),
      lcStats: $('#lc-stats'),
      lcNext: $('#lc-next'),
      lcReplay: $('#lc-replay'),
      lcMenu: $('#lc-menu'),
      settings: {
        music: $('#set-music'),
        musicOut: $('#set-music-out'),
        sfx: $('#set-sfx'),
        sfxOut: $('#set-sfx-out'),
        muted: $('#set-muted'),
        reduced: $('#set-reduced'),
        shake: $('#set-shake'),
        contrast: $('#set-contrast'),
        large: $('#set-large'),
      },
    };

    this.screens = {};
    Object.entries(SCREEN_IDS).forEach(([name, selector]) => {
      this.screens[name] = $(selector);
    });

    this.bind();
  }

  bind() {
    const on = (selector, handler) => {
      const element = $(selector);
      if (element) element.addEventListener('click', handler);
    };

    on('#btn-new', () => this.actions.newGame?.());
    on('#btn-continue', () => this.actions.continueGame?.());
    on('#btn-chapters', () => this.openScreen('chapters'));
    on('#btn-scrapbook', () => this.openScreen('scrapbook'));
    on('#btn-settings', () => this.openScreen('settings'));
    on('#btn-credits', () => this.openScreen('credits'));

    on('#btn-chapters-back', () => this.goBack());
    on('#btn-scrapbook-back', () => this.goBack());
    on('#btn-settings-back', () => this.goBack());
    on('#btn-credits-back', () => this.goBack());

    on('#btn-resume', () => this.actions.resume?.());
    on('#btn-restart', () => this.actions.restartLevel?.());
    on('#btn-pause-chapters', () => this.openScreen('chapters', { fromPause: true }));
    on('#btn-pause-settings', () => this.openScreen('settings', { fromPause: true }));
    on('#btn-pause-menu', () => this.actions.quitToTitle?.());

    on('#lc-next', () => this.actions.nextLevel?.());
    on('#lc-replay', () => this.actions.replayLevel?.());
    on('#lc-menu', () => this.actions.quitToTitle?.());

    on('#cut-next', () => this.advanceCutscene());
    on('#cut-skip', () => this.endCutscene());

    on('#sfv-next', () => this.advanceDialogue());

    on('#sfv-mg-retry', () => this.actions.retryMinigame?.());
    on('#sfv-mg-leave', () => this.actions.leaveMinigame?.());
    on('#sfv-mg-quit', () => this.actions.leaveMinigame?.());

    on('#btn-error-reload', () => window.location.reload());
    on('#btn-reset-save', () => {
      const confirmed = window.confirm(
        'Reset all progress on this device? Memories, clues, achievements and settings will be cleared.'
      );
      if (confirmed) this.actions.resetProgress?.();
    });

    on('#hud-swap', () => this.actions.swap?.());
    on('#hud-investigate', () => this.actions.toggleInvestigate?.());
    on('#hud-pause', () => this.actions.togglePause?.());
    on('#hud-mute', () => this.actions.toggleMute?.());
    on('#hud-fullscreen', () => this.actions.toggleFullscreen?.());

    const settings = this.el.settings;
    const number = (input) => Number(input.value) / 100;
    settings.music?.addEventListener('input', () => {
      settings.musicOut.textContent = `${settings.music.value}%`;
      this.actions.updateSettings?.({ music: number(settings.music) });
    });
    settings.sfx?.addEventListener('input', () => {
      settings.sfxOut.textContent = `${settings.sfx.value}%`;
      this.actions.updateSettings?.({ sfx: number(settings.sfx) });
    });
    const checkbox = (input, key) =>
      input?.addEventListener('change', () => this.actions.updateSettings?.({ [key]: input.checked }));
    checkbox(settings.muted, 'muted');
    checkbox(settings.reduced, 'reducedMotion');
    checkbox(settings.shake, 'screenShake');
    checkbox(settings.contrast, 'highContrast');
    checkbox(settings.large, 'largeText');
  }

  setSave(save) {
    this.save = save;
  }

  /* --------------------------------------------------------------- screens */
  openScreen(name, { fromPause = false } = {}) {
    if (name === 'chapters') this.renderChapters();
    if (name === 'scrapbook') this.renderScrapbook();
    if (name === 'settings') this.syncSettings();
    if (name === 'credits') this.renderCredits();

    const target = this.screens[name];
    if (!target) return;

    Object.values(this.screens).forEach((screen) => {
      if (screen) screen.hidden = true;
    });
    target.hidden = false;
    this.previousScreen = fromPause ? 'pause' : 'title';
    this.currentScreen = name;
    this.setTopbarVisible(false);
    this.el.toasts.replaceChildren();
    this.actions.screenChanged?.(name);
  }

  goBack() {
    if (this.previousScreen === 'pause') this.openScreen('pause');
    else this.showTitle();
  }

  showTitle() {
    this.setTopbarVisible(false);
    this.closeAllScreens();
    this.screens.title.hidden = false;
    this.currentScreen = 'title';
    this.refreshContinue();
    this.actions.screenChanged?.('title');
  }

  showPause() {
    this.closeAllScreens();
    this.screens.pause.hidden = false;
    this.currentScreen = 'pause';
    this.setTopbarVisible(false);
    this.actions.screenChanged?.('pause');
  }

  closeAllScreens() {
    Object.values(this.screens).forEach((screen) => {
      if (screen) screen.hidden = true;
    });
    this.currentScreen = null;
  }

  hideScreens() {
    this.closeAllScreens();
    this.setTopbarVisible(true);
    this.actions.screenChanged?.(null);
  }

  setTopbarVisible(visible) {
    if (this.el.topbar) this.el.topbar.hidden = !visible;
  }

  get screenActive() {
    return Boolean(this.currentScreen);
  }

  refreshContinue() {
    const save = this.save;
    const level = this.content.levelById.get(
      this.content.levels.find((entry) => entry.number === Math.min(save.unlocked, 7))?.id
    );
    if (this.el.continueButton) {
      this.el.continueButton.hidden = !save.started;
      if (this.el.continueNote && level) {
        this.el.continueNote.textContent = `Stop ${level.number}: ${level.title}`;
      }
    }
  }

  /* ------------------------------------------------------------------- HUD */
  updateHud({ level, memories = 0, clues = 0, memoryTotal = 3, clueTotal = 3, luck, character = 'jira', investigating = false, muted = false, fullscreen = false }) {
    const hud = this.el.hud;
    if (level) {
      hud.stop.textContent = `Stop ${level.number} of ${this.content.levels.length}`;
      hud.chapter.textContent = level.title;
    }
    hud.mem.textContent = String(memories);
    hud.memMax.textContent = `/${memoryTotal}`;
    hud.clue.textContent = String(clues);
    hud.clueMax.textContent = `/${clueTotal}`;

    const value = luck ?? luckOf(this.save);
    const progress = luckProgress(value);
    hud.luckValue.textContent = String(value);
    hud.luckFill.style.width = `${Math.round(progress.ratio * 100)}%`;
    hud.luckBar.setAttribute('aria-valuenow', String(value));
    hud.luckBar.setAttribute(
      'aria-valuemax',
      String(progress.next ? progress.next.at : Math.max(value, 1))
    );
    hud.luckTier.textContent = progress.next
      ? `${progress.current.name} · ${progress.next.at - value} to next`
      : progress.current.name;

    hud.charEmoji.textContent = character === 'jira' ? '🔎' : '⚡';
    hud.charName.textContent = character === 'jira' ? 'Jira' : 'Joel';
    hud.investigate.setAttribute('aria-pressed', String(investigating));
    hud.investigate.disabled = character !== 'jira';
    hud.mute.setAttribute('aria-pressed', String(muted));
    hud.mute.textContent = muted ? '🔇' : '🔊';
    hud.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    hud.fullscreen.setAttribute('aria-pressed', String(fullscreen));
  }

  setGoal(text) {
    this.el.goal.textContent = text ?? '';
    this.el.goal.hidden = !text;
  }

  setPrompt(text, key = 'E') {
    if (!text) {
      this.el.prompt.hidden = true;
      return;
    }
    this.el.promptText.textContent = text;
    this.el.promptKey.textContent = key;
    this.el.prompt.hidden = false;
  }

  setVignette(on) {
    this.el.vignette.classList.toggle('on', Boolean(on));
  }

  setLetterbox(on) {
    this.el.letterbox.hidden = !on;
  }

  /* --------------------------------------------------------------- toasts */
  toast({ emoji = '✨', title, text = '', kind = 'info', duration = 3600 }) {
    const item = document.createElement('div');
    item.className = `sfv-toast ${kind}`;

    const icon = document.createElement('span');
    icon.className = 'sfv-toast-emoji';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = emoji;

    const body = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    body.append(heading);

    if (text) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      body.append(paragraph);
    }

    item.append(icon, body);
    this.el.toasts.append(item);
    this.toasts.push(item);

    while (this.toasts.length > 3) {
      const oldest = this.toasts.shift();
      oldest?.remove();
    }

    window.setTimeout(() => {
      item.classList.add('is-out');
      window.setTimeout(() => {
        item.remove();
        this.toasts = this.toasts.filter((entry) => entry !== item);
      }, 300);
    }, duration);
  }

  clearToasts() {
    this.el.toasts.replaceChildren();
    this.toasts = [];
  }

  /* ------------------------------------------------------------- dialogue */
  startDialogue(lines, onDone) {
    if (!Array.isArray(lines) || !lines.length) {
      onDone?.();
      return;
    }
    this.dialogue = { lines, index: 0, onDone };
    this.el.subtitle.hidden = false;
    this.renderDialogueLine();
  }

  renderDialogueLine() {
    const dialogue = this.dialogue;
    if (!dialogue) return;
    const line = dialogue.lines[dialogue.index];
    const speaker = [line.emoji, line.who].filter(Boolean).join(' ');
    this.el.speaker.textContent = speaker || 'Family';
    this.el.line.textContent = line.text ?? '';
    this.el.nextLine.textContent =
      dialogue.index === dialogue.lines.length - 1 ? 'Finish ▸' : 'Next ▸';
    this.el.nextLine.hidden = false;
  }

  advanceDialogue() {
    const dialogue = this.dialogue;
    if (!dialogue) return false;
    dialogue.index += 1;
    if (dialogue.index >= dialogue.lines.length) {
      const done = dialogue.onDone;
      this.el.subtitle.hidden = true;
      this.dialogue = null;
      done?.();
      return true;
    }
    this.renderDialogueLine();
    return true;
  }

  showLine({ who, emoji, text }) {
    this.stopDialogue();
    this.el.subtitle.hidden = false;
    this.el.speaker.textContent = [emoji, who].filter(Boolean).join(' ') || 'Family';
    this.el.line.textContent = text;
    this.el.nextLine.hidden = true;
    window.clearTimeout(this.lineTimer);
    this.lineTimer = window.setTimeout(() => {
      if (!this.dialogue) this.el.subtitle.hidden = true;
    }, 4200);
  }

  hideLine() {
    if (!this.dialogue) this.el.subtitle.hidden = true;
  }

  stopDialogue() {
    this.dialogue = null;
    this.el.subtitle.hidden = true;
  }

  get dialogueActive() {
    return Boolean(this.dialogue);
  }

  /* ------------------------------------------------------------- cutscenes */
  startCutscene(scene, onDone) {
    this.cutscene = { scene, index: 0, onDone, typing: false };
    this.el.cutscene.hidden = false;
    this.el.cutKicker.textContent = scene.kicker ?? '';
    this.el.cutTitle.textContent = scene.title ?? '';
    this.showCutsceneLine();
  }

  showCutsceneLine() {
    const cutscene = this.cutscene;
    if (!cutscene) return;
    const line = cutscene.scene.lines?.[cutscene.index];
    if (!line) {
      this.endCutscene();
      return;
    }

    this.el.cutEmoji.textContent = line.emoji ?? '✨';
    this.el.cutSpeaker.textContent = line.who ?? '';
    this.el.cutNext.textContent =
      cutscene.index === cutscene.scene.lines.length - 1 ? 'Finish ▸' : 'Next ▸';

    window.clearInterval(this.typeTimer);
    const fullText = line.text ?? '';
    if (this.save.settings?.reducedMotion) {
      this.el.cutText.textContent = fullText;
      cutscene.typing = false;
      return;
    }

    this.el.cutText.textContent = '';
    cutscene.typing = true;
    let position = 0;
    this.typeTimer = window.setInterval(() => {
      position += 2;
      this.el.cutText.textContent = fullText.slice(0, position);
      if (position >= fullText.length) {
        window.clearInterval(this.typeTimer);
        cutscene.typing = false;
      }
    }, 18);
  }

  advanceCutscene() {
    if (!this.cutscene) return false;
    if (this.cutscene.typing) {
      window.clearInterval(this.typeTimer);
      const line = this.cutscene.scene.lines[this.cutscene.index];
      this.el.cutText.textContent = line?.text ?? '';
      this.cutscene.typing = false;
      return true;
    }
    this.cutscene.index += 1;
    if (this.cutscene.index >= (this.cutscene.scene.lines?.length ?? 0)) {
      this.endCutscene();
      return true;
    }
    this.showCutsceneLine();
    return true;
  }

  endCutscene() {
    if (!this.cutscene) return;
    const done = this.cutscene.onDone;
    this.cutscene = null;
    window.clearInterval(this.typeTimer);
    this.el.cutscene.hidden = true;
    done?.();
  }

  get cutsceneActive() {
    return Boolean(this.cutscene);
  }

  /* ------------------------------------------------------------ mini-games */
  showMinigame(level, definition) {
    const boss = level.boss ?? {};
    this.el.mg.hidden = false;
    this.el.mgEmoji.textContent = boss.emoji ?? '🗃️';
    this.el.mgBoss.textContent = `Stop ${level.number} · boss encounter`;
    this.el.mgTitle.textContent = boss.name ?? definition.name;
    this.el.mgHint.textContent = definition.hint;
    this.el.mgProgress.textContent = '';
    this.el.mgResult.hidden = true;
    this.el.mgQuit.hidden = false;
    this.el.mgCanvas.focus?.();
  }

  setMinigameProgress(text) {
    this.el.mgProgress.textContent = text ?? '';
  }

  showMinigameLoss(message, bossName) {
    this.el.mgResultKicker.textContent = 'Round over';
    this.el.mgResultTitle.textContent = `${bossName} wins this one`;
    this.el.mgResultText.textContent = message ?? 'The vacation gets another go.';
    this.el.mgResult.hidden = false;
    this.el.mgQuit.hidden = true;
  }

  hideMinigameResult() {
    this.el.mgResult.hidden = true;
    this.el.mgQuit.hidden = false;
  }

  hideMinigame() {
    this.el.mg.hidden = true;
    this.el.mgResult.hidden = true;
    this.el.mgProgress.textContent = '';
  }

  /* ------------------------------------------------------------ level clear */
  showComplete({ level, final = false, stats = [], primaryLabel, replayLabel = 'Explore again' }) {
    this.closeAllScreens();
    this.setTopbarVisible(false);
    this.screens.complete.hidden = false;
    this.currentScreen = 'complete';

    this.el.lcKicker.textContent = final ? 'The scrapbook closes' : 'Vacation survived';
    this.el.lcTitle.textContent = final ? 'The Weirdest Vacation Ever' : level.title;
    this.el.lcBody.textContent = final
      ? 'Seven vacations, one very small shadow, and a photo with everybody in it. The family luck meter may never recover.'
      : level.boss?.win ??
        'The family survives, mostly intact, and the scrapbook gains a page.';

    this.el.lcStats.replaceChildren(
      ...stats.map((stat) => {
        const cell = document.createElement('div');
        cell.className = 'sfv-victory-stat';
        const label = document.createElement('span');
        label.textContent = stat.label;
        const value = document.createElement('strong');
        value.textContent = stat.value;
        cell.append(label, value);
        return cell;
      })
    );

    this.el.lcNext.textContent =
      primaryLabel ?? (final ? 'Back to the menu' : 'Next vacation');
    this.el.lcReplay.textContent = replayLabel;
    this.el.lcReplay.hidden = final;
    /* The final card already has a "Back to the menu" primary button. */
    this.el.lcMenu.hidden = final;

    this.actions.screenChanged?.('complete');
  }

  /* --------------------------------------------------------------- chapters */
  renderChapters() {
    const grid = this.el.chapterGrid;
    if (!grid) return;
    const save = this.save;

    grid.replaceChildren(
      ...this.content.levels.map((level) => {
        const card = document.createElement('article');
        const locked = level.number > save.unlocked;
        const done = save.completed.includes(String(level.number));
        card.className = `sfv-chapter-card${locked ? ' is-locked' : ''}${done ? ' is-done' : ''}`;

        const number = document.createElement('span');
        number.className = 'sfv-chapter-number';
        number.textContent = `Stop ${level.number} · ${level.place}`;

        const title = document.createElement('strong');
        title.textContent = locked ? '???' : level.title;

        const description = document.createElement('p');
        description.textContent = locked
          ? 'Survive the previous vacation to unlock this page of the scrapbook.'
          : level.subtitle;

        const meta = document.createElement('p');
        meta.className = 'sfv-chapter-meta';
        const found = this.content.memories.filter(
          (memory) => memory.level === level.id && save.memories.includes(memory.id)
        ).length;
        meta.textContent = locked
          ? 'Page still blank'
          : `${found} / 3 memories · ${level.boss?.emoji ?? ''} ${level.boss?.name ?? ''}`;

        card.append(number, title, description, meta);

        if (!locked) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'sfv-btn sfv-btn-small';
          button.textContent = done ? 'Replay' : 'Play';
          button.addEventListener('click', () => this.actions.startLevel?.(level.number));
          card.append(button);
        }

        return card;
      })
    );

    if (this.el.chaptersNote) {
      this.el.chaptersNote.textContent = `${save.completed.length} of ${this.content.levels.length} vacations survived · ${save.memories.length} of ${this.content.totals.memories} memories in the scrapbook.`;
    }
  }

  /* -------------------------------------------------------------- scrapbook */
  renderScrapbook() {
    const save = this.save;
    const luck = luckOf(save);
    const tier = tierOf(luck);
    const nextTier = LUCK_TIERS.find((entry) => entry.at > luck);
    this.el.sbSummary.textContent = `Family Luck ${luck} — ${tier.name}. ${tier.note}${
      nextTier ? ` Next tier at ${nextTier.at}.` : ''
    } ${save.secrets.length}/${this.content.totals.secrets} golden secrets found.`;

    this.el.sbMemories.replaceChildren(
      ...this.content.memories.map((memory) => {
        const found = save.memories.includes(memory.id);
        const tile = document.createElement('div');
        tile.className = `sfv-memory ${found ? 'is-found' : 'is-locked'}`;
        tile.title = found ? `${memory.name} — ${memory.blurb}` : 'Not found yet';
        const emoji = document.createElement('span');
        emoji.className = 'sfv-memory-emoji';
        emoji.setAttribute('aria-hidden', 'true');
        emoji.textContent = found ? memory.emoji : '❔';
        const name = document.createElement('strong');
        name.textContent = found ? memory.name : 'Undiscovered';
        tile.append(emoji, name);
        return tile;
      })
    );

    this.el.sbClues.replaceChildren(
      ...this.content.clues.map((clue) => {
        const found = save.clues.includes(clue.id);
        const item = document.createElement('li');
        item.className = `sfv-clue ${found ? 'is-found' : 'is-locked'}`;
        const title = document.createElement('strong');
        title.textContent = found ? `${clue.emoji} ${clue.name}` : 'A clue you have not found yet';
        const body = document.createElement('p');
        body.textContent = found ? clue.text : 'Somewhere in one of the vacations. Jira would look closer.';
        const place = document.createElement('small');
        place.textContent = this.content.levelById.get(clue.level)?.place ?? '';
        item.append(title, body, place);
        return item;
      })
    );

    this.el.sbLore.replaceChildren(
      ...this.content.lore.map((entry) => {
        const unlocked = luck >= entry.luck;
        const item = document.createElement('li');
        item.className = `sfv-lore${unlocked ? '' : ' is-locked'}`;
        const title = document.createElement('strong');
        title.textContent = unlocked ? entry.title : '???';
        const body = document.createElement('p');
        body.textContent = unlocked
          ? entry.text
          : `Reach Family Luck ${entry.luck} to remember this.`;
        item.append(title, body);
        return item;
      })
    );

    this.el.sbAchievements.replaceChildren(
      ...this.content.achievements.map((achievement) => {
        const unlocked = save.achievements.includes(achievement.id);
        const item = document.createElement('div');
        item.className = `sfv-achievement ${unlocked ? 'is-unlocked' : 'is-locked'}`;
        const emoji = document.createElement('span');
        emoji.setAttribute('aria-hidden', 'true');
        emoji.textContent = achievement.emoji;
        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = unlocked ? achievement.name : 'Locked';
        const text = document.createElement('p');
        text.textContent = achievement.text;
        body.append(title, text);
        item.append(emoji, body);
        return item;
      })
    );
  }

  renderCredits() {
    const lines = this.content.cutscenes?.credits?.lines ?? [];
    this.el.credits.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement('li');
        const emoji = document.createElement('span');
        emoji.setAttribute('aria-hidden', 'true');
        emoji.textContent = line.emoji ?? '✨';
        const body = document.createElement('div');
        const who = document.createElement('strong');
        who.textContent = line.who;
        const text = document.createTextNode(` — ${line.text}`);
        body.append(who, text);
        item.append(emoji, body);
        return item;
      })
    );
  }

  /* --------------------------------------------------------------- settings */
  syncSettings() {
    const settings = this.save.settings;
    const el = this.el.settings;
    el.music.value = String(Math.round(settings.music * 100));
    el.musicOut.textContent = `${el.music.value}%`;
    el.sfx.value = String(Math.round(settings.sfx * 100));
    el.sfxOut.textContent = `${el.sfx.value}%`;
    el.muted.checked = settings.muted;
    el.reduced.checked = settings.reducedMotion;
    el.shake.checked = settings.screenShake;
    el.contrast.checked = settings.highContrast;
    el.large.checked = settings.largeText;
  }

  applyAccessibility(settings) {
    this.el.app.classList.toggle('reduced-motion', settings.reducedMotion);
    this.el.app.classList.toggle('high-contrast', settings.highContrast);
    this.el.app.classList.toggle('large-text', settings.largeText);
  }

  /* ---------------------------------------------------------------- loading */
  setLoading(text) {
    this.el.loading.hidden = false;
    if (text) this.el.loadingText.textContent = text;
  }

  hideLoading() {
    this.el.loading.hidden = true;
  }

  showError(message) {
    this.el.loading.hidden = true;
    this.el.error.hidden = false;
    if (message) this.el.errorText.textContent = message;
  }
}
