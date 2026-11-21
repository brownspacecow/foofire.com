/* ------------------------------------------------------------------ *
 * Menus
 * Title, settings, how to play, pause and results. One overlay, a
 * handful of screens, all plain DOM.
 * ------------------------------------------------------------------ */

export class Menus {
  constructor(root, options) {
    this.root = root;
    this.content = options.content;
    this.profile = options.profile;
    this.cb = options.callbacks;
    this.screen = 'none';
    this.resetArmed = 0;
    this.returnTo = 'title';
    this.pauseGame = null;
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
    const savedWave = Math.max(
      1,
      Number(this.profile.current?.heroState?.waveIndex) || 1
    );
    const bestWave = Math.max(0, Number(this.profile.bestWave) || 0);
    const bestLabel = bestWave > 0 ? `Best run: wave ${bestWave}` : 'No waves survived yet';
    this.show(
      `
      <div class="mk-title-screen">
        <p class="mk-eyebrow">A very tidy endless problem</p>
        <h1 class="mk-logo"><span>MUDDLE</span><span>KEEP</span></h1>
        <p class="mk-lede">
          Dig a cosy home under the hill. Fill it with grumpy little monsters.
          The knights never stop coming — survive as many waves as you can.
        </p>
        <div class="mk-menu-buttons">
          ${
            hasCurrent
              ? `<button class="mk-btn primary" data-action="continue">Continue
                  <small>Wave ${savedWave} · ${formatTime(this.profile.current.time ?? 0)}</small>
                </button>`
              : ''
          }
          <button class="mk-btn ${hasCurrent ? '' : 'primary'}" data-action="new-game">New run</button>
          <button class="mk-btn" data-action="settings">Settings</button>
          <button class="mk-btn" data-action="help">How to play</button>
        </div>
        <p class="mk-small">${bestLabel}</p>
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

  showSettings(from = 'title') {
    this.returnTo = from;
    const settings = this.profile.settings;
    this.show(
      `
      <div class="mk-screen-head">
        <div>
          <p class="mk-eyebrow">Make it comfortable</p>
          <h2>Settings</h2>
        </div>
        <button class="mk-btn small" data-action="back">Back</button>
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
      <div class="mk-setting check">
        <label for="mk-kid">Kid mode — slower waves, gentler knights</label>
        <input id="mk-kid" type="checkbox" data-setting="kidMode" ${settings.kidMode ? 'checked' : ''} />
      </div>
      <p class="mk-small">Kid mode applies to your next run, not the one in progress.</p>
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

  showHelp(from = 'title') {
    this.returnTo = from;
    this.show(
      `
      <div class="mk-screen-head">
        <div>
          <p class="mk-eyebrow">Keeper school</p>
          <h2>How to play</h2>
        </div>
        <button class="mk-btn small" data-action="back">Back</button>
      </div>
      <div class="mk-help">
        <p><strong>You are the hand.</strong> Your imps dig and haul. Mark work and they will do it.</p>
        <ol>
          <li><strong>Dig</strong> dirt to plan tunnels. New floor is yours straight away. Plans can reach into the dark — imps start as soon as a tunnel reaches them, and tapping a planned tile again un-plans it.</li>
          <li><strong>Gold seams never run out.</strong> Mark one with Dig and up to four imps will mine it, one from each open side.</li>
          <li><strong>Stop time</strong> with the ⏳ button or T to queue digs, rooms and traps while the dungeon holds still. Press Resume when you are ready.</li>
          <li><strong>Rooms</strong> go on floor. Treasury holds gold, Lair invites creatures, Hatchery feeds them, Training levels them up (veterans grow bigger and tougher), Library researches, Workshop unlocks traps.</li>
          <li><strong>Move the Hero Gate</strong> with the Hand tool: pick it up and tap any clear floor tile. Knights will enter through the new spot.</li>
          <li><strong>Creatures</strong> fight on their own. Pick them up with the Hand or Slap them to send them flying and speed up their work.</li>
          <li><strong>Spells</strong> cost mana: Zoomies, Soup of Health, Rally Yell and, later, Zap.</li>
          <li>Knights march on the <strong>Dungeon Heart</strong>. Lose the Heart and the run is over.</li>
          <li><strong>There is no final level.</strong> Waves keep coming, get bigger and bring a boss every fifth wave. Survive as long as you can to set your best wave.</li>
        </ol>
        <p class="mk-small">Controls: drag to paint · two fingers to pan and pinch · wheel or + / − buttons to zoom · right-drag or Shift-drag to pan · 1-7 tools · Q/W/E/R spells · T stop time · Space, P or Esc pause · arrows pan · H help · F fullscreen · X 2× speed.</p>
      </div>
      `,
      'help'
    );
  }

  showPause(game) {
    this.pauseGame = game;
    const best = Math.max(0, Number(this.profile.bestWave) || 0);
    this.show(
      `
      <div class="mk-pause">
        <p class="mk-eyebrow">Endless run · wave ${Math.max(1, game.heroes.waveIndex)}</p>
        <h2>Paused</h2>
        <p class="mk-lede">The imps have put their tiny tools down.</p>
        <p class="mk-small">Best wave: ${best || 'none yet'} · time ${formatTime(game.time)}</p>
        <div class="mk-menu-buttons">
          <button class="mk-btn primary" data-action="resume">Resume</button>
          <button class="mk-btn" data-action="restart">Restart run</button>
          <button class="mk-btn" data-action="settings">Settings</button>
          <button class="mk-btn" data-action="quit">Save &amp; quit to title</button>
        </div>
      </div>
      `,
      'pause'
    );
  }

  showResult({ game, bestWave, newBest, reached }) {
    const wave = Math.max(0, reached ?? game.heroes.waveIndex);
    this.show(
      `
      <div class="mk-result ${newBest ? 'won' : 'lost'}">
        <p class="mk-eyebrow">${newBest ? 'New best run' : 'Run over'}</p>
        <h2>${newBest ? 'A new best wave!' : 'The Heart got swept away'}</h2>
        <p class="mk-lede">${
          newBest
            ? `You survived to wave ${wave}. Can you reach wave ${wave + 1}?`
            : `You survived to wave ${wave}. Your best is wave ${bestWave}.`
        }</p>
        <div class="mk-result-stats">
          <span><b>${wave}</b> wave reached</span>
          <span><b>${bestWave}</b> best wave</span>
          <span><b>${formatTime(game.time)}</b> time</span>
          <span><b>${game.stats.heroes}</b> knights sent home</span>
        </div>
        <div class="mk-menu-buttons">
          <button class="mk-btn primary" data-action="retry">Try again</button>
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
    if (action === 'new-game') this.cb.startRun(null);
    else if (action === 'continue') this.cb.continueGame();
    else if (action === 'settings') this.showSettings(this.screen === 'pause' ? 'pause' : 'title');
    else if (action === 'help') this.showHelp(this.screen === 'pause' ? 'pause' : 'title');
    else if (action === 'back-title') this.showTitle();
    else if (action === 'back') {
      if (this.returnTo === 'pause' && this.pauseGame) this.showPause(this.pauseGame);
      else this.showTitle();
    }
    else if (action === 'resume') this.cb.resume();
    else if (action === 'restart') this.cb.restart();
    else if (action === 'quit') this.cb.quit();
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
    } else if (control.dataset.setting === 'kidMode') {
      settings.kidMode = control.checked;
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
