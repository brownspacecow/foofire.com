/* ------------------------------------------------------------------ *
 * Pause for timed games
 * Freezes a round when the tab goes away, and gives players a pause
 * button plus P / Escape while they are playing.
 * ------------------------------------------------------------------ */

const STYLE_ID = 'foofire-auto-pause-style';

const CSS = `
.foofire-pause {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(6, 3, 14, 0.66);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s ease, visibility 0.18s ease;
  pointer-events: none;
}

.foofire-pause.is-visible {
  opacity: 1;
  visibility: visible;
}

.foofire-pause-card {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  max-width: 22rem;
  padding: 1.1rem 1.4rem 1rem;
  text-align: center;
  background: rgba(36, 26, 77, 0.94);
  border: 3px solid #0a0518;
  box-shadow: 5px 5px 0 rgba(10, 5, 24, 0.85);
  color: #fff8e7;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  pointer-events: auto;
}

.foofire-pause-resume {
  min-height: 2.75rem;
  margin-top: 0.35rem;
  padding: 0.55rem 1.1rem;
  border: 3px solid #0a0518;
  background: #ffd93d;
  color: #0a0518;
  font-family: "Press Start 2P", "Courier New", ui-monospace, monospace;
  font-size: 0.55rem;
  line-height: 1.5;
  box-shadow: 3px 3px 0 #0a0518;
  cursor: pointer;
  touch-action: manipulation;
}

.foofire-pause-resume:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #0a0518;
}

.foofire-pause-badge {
  font-size: 1rem;
  letter-spacing: 0.18em;
  color: #ffd93d;
}

.foofire-pause-card strong {
  font-size: 0.95rem;
}

.foofire-pause-note {
  font-size: 0.82rem;
  color: #bcacf0;
}

.foofire-pause-btn[disabled] {
  opacity: 0.4;
  cursor: default;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/**
 * Watch page visibility and freeze a game while it is hidden, and let the
 * player pause on demand with a button or the P / Escape keys.
 *
 * @param {object} options
 * @param {HTMLElement} options.container  What the overlay covers.
 * @param {() => boolean} [options.shouldPause]  Only pause while a round is live.
 * @param {object} [options.audio]  Object with isMuted/setMuted, for ducking.
 * @param {HTMLElement} [options.muteButton]  Read to respect a mute clicked while paused.
 * @param {HTMLElement} [options.button]  Pause/resume button to drive.
 * @param {string[]} [options.keys]  KeyboardEvent.code values that toggle pause.
 * @param {string} [options.message]  Overlay headline.
 */
export function createAutoPause({
  container,
  shouldPause,
  audio,
  muteButton,
  button,
  keys = ['KeyP', 'Escape'],
  onPause,
  onResume,
  message = 'Paused',
} = {}) {
  let paused = false;
  let manual = false;
  let overlay = null;
  let titleEl = null;
  let noteEl = null;
  let ducked = false;
  let lastButtonKey = '';

  const ensureOverlay = () => {
    if (overlay || !container) return;
    ensureStyle();
    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    overlay = document.createElement('div');
    overlay.className = 'foofire-pause';
    overlay.setAttribute('aria-hidden', 'true');

    const card = document.createElement('div');
    card.className = 'foofire-pause-card';

    const badge = document.createElement('span');
    badge.className = 'foofire-pause-badge';
    badge.textContent = '❚❚';

    titleEl = document.createElement('strong');
    titleEl.textContent = message;

    noteEl = document.createElement('span');
    noteEl.className = 'foofire-pause-note';

    const resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'foofire-pause-resume';
    resume.textContent = 'Keep playing';
    resume.addEventListener('click', () => setPaused(false));

    card.append(badge, titleEl, noteEl, resume);
    overlay.append(card);
    container.append(overlay);
  };

  const updateCopy = () => {
    if (!titleEl) return;
    titleEl.textContent = message;
    noteEl.textContent = manual
      ? 'Tap the button, or press P or Escape, when you are ready to keep playing.'
      : 'Come back when you are ready — the game is waiting.';
  };

  /* A game can call this before its round state exists; treat that as not live. */
  const isLive = () => {
    if (!shouldPause) return true;
    try {
      return Boolean(shouldPause());
    } catch (error) {
      return false;
    }
  };

  const syncButton = () => {
    if (!button) return;
    const live = isLive();
    const key = `${live}|${paused}`;
    if (key === lastButtonKey) return;
    lastButtonKey = key;

    button.disabled = !live && !paused;
    button.textContent = paused ? '▶' : '❚❚';
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  };

  const duck = (on) => {
    if (!audio) return;
    if (on) {
      ducked = !audio.isMuted();
      if (ducked) audio.setMuted(true);
      return;
    }
    if (!ducked) return;
    const mutedByPlayer = muteButton?.getAttribute('aria-pressed') === 'true';
    audio.setMuted(mutedByPlayer);
    ducked = false;
  };

  const setPaused = (next, byPlayer = false) => {
    if (next === paused) return;
    if (next && !isLive()) return;

    paused = next;
    manual = next && byPlayer;
    ensureOverlay();
    updateCopy();
    if (overlay) {
      overlay.classList.toggle('is-visible', paused);
      overlay.setAttribute('aria-hidden', String(!paused));
    }
    duck(paused);
    syncButton();
    if (paused) onPause?.();
    else onResume?.();
  };

  const toggle = () => {
    if (paused) setPaused(false);
    else setPaused(true, true);
  };

  /* Auto-pause only owns the state while the player has not paused manually. */
  const onVisibility = () => {
    if (manual) return;
    setPaused(Boolean(document.hidden));
  };
  document.addEventListener('visibilitychange', onVisibility);

  if (button) {
    button.addEventListener('click', toggle);
    syncButton();
  }

  const onKeyDown = (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!keys.includes(event.code)) return;

    const target = event.target;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    event.preventDefault();
    toggle();
  };
  window.addEventListener('keydown', onKeyDown);

  return {
    get paused() {
      return paused;
    },
    /** Re-check after a round starts or ends while the tab is hidden. */
    refresh: onVisibility,
    /** Keep the pause button in step with the round state. */
    sync: syncButton,
    toggle,
  };
}
