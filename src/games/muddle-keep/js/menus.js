/* ------------------------------------------------------------------ *
 * Menus
 * Title, level select, settings, how to play, pause and results. One
 * overlay, a handful of screens, all plain DOM.
 * ------------------------------------------------------------------ */

const LEVEL_TIPS = [
  'Dig and claim a few tiles, then paint a Treasury so your gold has a home.',
  'A Lair attracts more creatures. A Hatchery keeps them from grumbling.',
  'Lava is a wall. Build a Library and research something fizzy.',
  'Build a Workshop, then line a corridor with traps and doors.',
  'Train your creatures. The Baron is large and extremely polite about it.',
];

export class Menus {
  constructor(root, options) {
    this.root = root;
    this.content = options.content;
    this.profile = options.profile;
    this.cb = options.callbacks;
    this.screen = 'none';
    this.resetArmed = 0;
    this.root.innerHTML = '<div class="mk-menu-backdrop"></div><div class="mk-menu-card" role="dialog" aria-modal="true"></div>';
    this.card = this.root.querySelector('.mk-menu-card');
    this.card.addEventListener('click', (event) => this.onClick(event));
    this.card.addEventListener('input', (event) => this.onInput(event));
  }

  get open() {
    return this.screen !== 'none';
  }

  show(html, screen) {
    this.screen = screen;
    this.root.hidden = false;
    this.card.innerHTML = html;
    this.card.scrollTop = 0;
  }

  hide() {
    this.screen = 'none';
    this.root.hidden = true;
    this.card.innerHTML = '';
  }

  refresh(profile) {
    this.profile = profile ?? this.profile;
  }

  /* ------------------------------------------------------------- screens */

  showTitle() {
    const hasCurrent = Boolean(this.profile.current);
    const currentLevel = hasCurrent
      ? this.content.levelById.get(this.profile.current.levelId)
      : null;
    this.show(
      `
      <div class="mk-title-screen">
        <p class="mk-eyebrow">A very tidy dungeon problem</p>
        <h1 class="mk-logo"><span>MUDDLE</span><span>KEEP</span></h1>
        <p class="mk-lede">
          Dig a cosy home under the hill. Fill it with grumpy little monsters.
          Politely discourage the knights who keep trying to sweep it clean.
        </p>
        <div class="mk-menu-buttons">
          ${
            hasCurrent
              ? `<button class="mk-btn primary" data-action="continue">Continue
                  <small>Level ${currentLevel?.number ?? 1}: ${currentLevel?.name ?? ''}</small>
                </button>`
              : ''
          }
          <button class="mk-btn ${hasCurrent ? '' : 'primary'}" data-action="new-game">New game</button>
          <button class="mk-btn" data-action="levels">Levels</button>
          <button class="mk-btn" data-action="settings">Settings</button>
          <button class="mk-btn" data-action="help">How to play</button>
        </div>
        <p class="mk-small">
          Free, no accounts. Mouse, touch or keyboard. All music and sound is made in your browser.
        </p>
      </div>
      <div class="mk-menu-flourish" aria-hidden="true">
        <span class="mk-flourish-heart">💎</span>
        <span class="mk-flourish-imp">⛏️</span>
        <span class="mk-flourish-knight">🛡️</span>
      </div>
      `,
      'title'
    );
  }

  showLevels() {
    const cards = this.content.levels
      .map((level) => {
        const locked = level.number > this.profile.unlocked;
        const best = this.profile.best[level.id];
        return `
          <button class="mk-level-card ${locked ? 'locked' : ''}" data-action="start-level" data-level="${
            level.id
          }" ${locked ? 'disabled' : ''}>
            <span class="mk-level-number">${locked ? '🔒' : level.number}</span>
            <span class="mk-level-body">
              <strong>${level.name}</strong>
              <span>${level.subtitle ?? ''}</span>
              <em>${best ? `Best ${formatTime(best)}` : LEVEL_TIPS[level.number - 1] ?? ''}</em>
            </span>
          </button>
        `;
      })
      .join('');
    this.show(
      `
      <div class="mk-screen-head">
        <div>
          <p class="mk-eyebrow">Five little holes in the ground</p>
          <h2>Levels</h2>
        </div>
        <button class="mk-btn small" data-action="back-title">Back</button>
      </div>
      <div class="mk-level-grid">${cards}</div>
      `,
      'levels'
    );
  }

  showSettings() {
    const settings = this.profile.settings;
    this.show(
      `
      <div class="mk-screen-head">
        <div>
          <p class="mk-eyebrow">Make it comfortable</p>
          <h2>Settings</h2>
        </div>
        <button class="mk-btn small" data-action="back-title">Back</button>
      </div>
      <div class="mk-setting">
        <label for="mk-volume">Volume</label>
        <input id="mk-volume" type="range" min="0" max="100" step="1" value="${Math.round(
          settings.volume * 100
        )}" data-setting="volume" />
        <output>${Math.round(settings.volume * 100)}%</output>
      </div>
      <div class="mk-setting check">
        <label for="mk-muted">Mute everything</label>
        <input id="mk-muted" type="checkbox" data-setting="muted" ${settings.muted ? 'checked' : ''} />
      </div>
      <div class="mk-setting">
        <label for="mk-quality">Visual quality</label>
        <select id="mk-quality" data-setting="quality">
          <option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option>
          <option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low (faster on phones)</option>
        </select>
      </div>
      <div class="mk-settings-foot">
        <button class="mk-btn danger" data-action="reset">Reset all progress</button>
        <span class="mk-small">Progress and settings stay on this device.</span>
      </div>
      `,
      'settings'
    );
  }

  showHelp() {
    this.show(
      `
      <div class="mk-screen-head">
        <div>
          <p class="mk-eyebrow">Keeper school</p>
          <h2>How to play</h2>
        </div>
        <button class="mk-btn small" data-action="back-title">Back</button>
      </div>
      <div class="mk-help">
        <p><strong>You are the hand.</strong> Your imps dig, claim and haul. Mark work and they will do it.</p>
        <ol>
          <li><strong>Dig</strong> dirt and gold seams to open up space. Gold pays for everything.</li>
          <li><strong>Claim</strong> dug floor so it becomes part of your dungeon.</li>
          <li><strong>Rooms</strong> go on claimed floor. Treasury holds gold, Lair invites creatures, Hatchery feeds them, Training levels them up, Library researches, Workshop unlocks traps.</li>
          <li><strong>Creatures</strong> fight on their own. Pick them up with the Hand or Slap them for a burst of energy.</li>
          <li><strong>Spells</strong> cost mana: Zoomies, Soup of Health, Rally Yell and, later, Zap.</li>
          <li>Knights march on the <strong>Dungeon Heart</strong>. Lose the Heart and the level is over.</li>
        </ol>
        <p class="mk-small">Controls: drag to paint · two fingers to pan and pinch · wheel to zoom · right-drag or Shift-drag to pan · 1-8 tools · Q/W/E/R spells · P or Esc pause · arrows pan · H help.</p>
      </div>
      `,
      'help'
    );
  }

  showPause(game) {
    this.show(
      `
      <div class="mk-pause">
        <p class="mk-eyebrow">Level ${game.level.number}</p>
        <h2>Paused</h2>
        <p class="mk-lede">The imps have put their tiny tools down.</p>
        <div class="mk-menu-buttons">
          <button class="mk-btn primary" data-action="resume">Resume</button>
          <button class="mk-btn" data-action="restart">Restart level</button>
          <button class="mk-btn" data-action="levels">Level select</button>
          <button class="mk-btn" data-action="settings">Settings</button>
          <button class="mk-btn" data-action="quit">Save &amp; quit to title</button>
        </div>
      </div>
      `,
      'pause'
    );
  }

  showResult({ won, game, nextLevel }) {
    const waves = game.level.waves?.length ?? 0;
    this.profile = this.profile;
    this.show(
      `
      <div class="mk-result ${won ? 'won' : 'lost'}">
        <p class="mk-eyebrow">${won ? 'Dungeon saved' : 'Dungeon swept'}</p>
        <h2>${won ? 'Tidy knights, untidied.' : 'The Heart got swept away'}</h2>
        <p class="mk-lede">${
          won
            ? game.level.outro ?? 'The dungeon is cosy again.'
            : 'The nice knights found the Heart. Your monsters will be very grumpy about this.'
        }</p>
        <div class="mk-result-stats">
          <span><b>${formatTime(game.time)}</b> time</span>
          <span><b>${game.stats.heroes}</b> knights sent home</span>
          <span><b>${Math.floor(game.economy.gold)}</b> gold</span>
          <span><b>${waves}</b> waves</span>
        </div>
        <div class="mk-menu-buttons">
          ${
            won && nextLevel
              ? `<button class="mk-btn primary" data-action="next" data-level="${nextLevel.id}">Next level</button>`
              : ''
          }
          <button class="mk-btn ${won ? '' : 'primary'}" data-action="retry">Try again</button>
          <button class="mk-btn" data-action="quit">Back to title</button>
        </div>
      </div>
      `,
      'result'
    );
  }

  /* ------------------------------------------------------------- events */

  onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'new-game') this.cb.startLevel(this.content.levels[0].id, null);
    else if (action === 'continue') this.cb.continueGame();
    else if (action === 'start-level') this.cb.startLevel(button.dataset.level, null);
    else if (action === 'levels') this.showLevels();
    else if (action === 'settings') this.showSettings();
    else if (action === 'help') this.showHelp();
    else if (action === 'back-title') this.showTitle();
    else if (action === 'resume') this.cb.resume();
    else if (action === 'restart') this.cb.restart();
    else if (action === 'quit') this.cb.quit();
    else if (action === 'next') this.cb.startLevel(button.dataset.level, null);
    else if (action === 'retry') this.cb.retry();
    else if (action === 'reset') {
      if (this.resetArmed && Date.now() - this.resetArmed < 4000) {
        this.resetArmed = 0;
        this.cb.resetProgress();
        button.textContent = 'Progress erased';
        button.disabled = true;
      } else {
        this.resetArmed = Date.now();
        button.textContent = 'Tap again to erase everything';
        window.setTimeout(() => {
          if (!this.resetArmed) return;
          button.textContent = 'Reset all progress';
        }, 4000);
      }
    }
  }

  onInput(event) {
    const control = event.target.closest('[data-setting]');
    if (!control) return;
    const settings = { ...this.profile.settings };
    if (control.dataset.setting === 'volume') {
      settings.volume = Number(control.value) / 100;
      const output = control.parentElement.querySelector('output');
      if (output) output.textContent = `${control.value}%`;
    } else if (control.dataset.setting === 'muted') {
      settings.muted = control.checked;
    } else if (control.dataset.setting === 'quality') {
      settings.quality = control.value;
    }
    this.cb.settings(settings);
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
