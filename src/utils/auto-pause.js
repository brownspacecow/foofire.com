/* ------------------------------------------------------------------ *
 * Auto-pause for timed games
 * When the tab goes away, a race or a wave should not carry on without
 * the player. The game freezes, a small overlay explains why, and the
 * soundtrack is ducked (unless the player had already muted the game).
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
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/**
 * Watch page visibility and freeze a game while it is hidden.
 *
 * @param {object} options
 * @param {HTMLElement} options.container  What the overlay covers.
 * @param {() => boolean} [options.shouldPause]  Pause only while a round is live.
 * @param {object} [options.audio]  Object with isMuted/setMuted, for ducking.
 * @param {HTMLElement} [options.muteButton]  Read to respect a mute clicked while paused.
 * @param {string} [options.message]  Overlay headline.
 */
export function createAutoPause({
  container,
  shouldPause,
  audio,
  muteButton,
  onPause,
  onResume,
  message = 'Paused',
} = {}) {
  let paused = false;
  let overlay = null;
  let ducked = false;

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

    const title = document.createElement('strong');
    title.textContent = message;

    const note = document.createElement('span');
    note.className = 'foofire-pause-note';
    note.textContent = 'Come back when you are ready — the game is waiting.';

    card.append(badge, title, note);
    overlay.append(card);
    container.append(overlay);
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

  const setPaused = (next) => {
    if (next === paused) return;
    if (next && shouldPause && !shouldPause()) return;

    paused = next;
    ensureOverlay();
    if (overlay) {
      overlay.classList.toggle('is-visible', paused);
      overlay.setAttribute('aria-hidden', String(!paused));
    }
    duck(paused);
    if (paused) onPause?.();
    else onResume?.();
  };

  const onVisibility = () => setPaused(Boolean(document.hidden));
  document.addEventListener('visibilitychange', onVisibility);

  return {
    get paused() {
      return paused;
    },
    /** Re-check after a round starts or ends while the tab is hidden. */
    refresh: onVisibility,
  };
}
