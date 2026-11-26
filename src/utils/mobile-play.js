/*
 * Mobile play shell
 *
 * On phones game pages lose the marketing chrome: the header shrinks and the
 * intro paragraph and footer step out of the way. Pages with a single
 * #game-container also become one full-height screen, sized so the game is
 * playable without scrolling. Controls that live below the playfield (Bear's
 * care buttons, Claw's d-pad, the Christmas launch bar and tray) keep their
 * space.
 */
(function () {
  const MOBILE = window.matchMedia('(max-width: 760px)');
  const container =
    document.querySelector('[data-mobile-play-fit]') || document.querySelector('#game-container');

  let frame = 0;

  /* A game's own :fullscreen rules own the height while fullscreen is active,
   * whether it goes fullscreen on the playfield itself or on a wrapper. */
  const fullscreenOwnsLayout = () =>
    Boolean(document.fullscreenElement && document.fullscreenElement.contains(container));

  const heightOf = (el) => Math.round(el.getBoundingClientRect().height);
  const CONTROLS = 'button, input, select, textarea, summary, [role="button"]';

  const isReserved = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.position === 'absolute' || style.position === 'fixed') return false;
    if (el.classList.contains('mobile-play-extra')) return false;
    return heightOf(el) > 0;
  };

  /*
   * Anything after the playfield is either a control the player needs
   * (Bear's care buttons, Claw's d-pad, the Christmas tray) or prose. Prose
   * is dropped on phones instead of stealing height from the game.
   */
  function markExtras() {
    for (let el = container.nextElementSibling; el; el = el.nextElementSibling) {
      const keep = isReserved(el) && Boolean(el.querySelector(CONTROLS));
      el.classList.toggle('mobile-play-extra', !keep && !el.classList.contains('sr-only'));
    }
  }

  function fit() {
    if (!container) return;
    if (fullscreenOwnsLayout()) return;

    window.scrollTo(0, 0);

    const viewport = Math.round(
      window.visualViewport ? window.visualViewport.height : window.innerHeight,
    );

    let reserved = 0;
    for (let el = container.nextElementSibling; el; el = el.nextElementSibling) {
      if (!isReserved(el)) continue;
      const style = getComputedStyle(el);
      reserved +=
        heightOf(el) +
        (parseFloat(style.marginTop) || 0) +
        (parseFloat(style.marginBottom) || 0);
    }

    const top = container.getBoundingClientRect().top;
    let height = Math.max(180, Math.min(viewport, Math.round(viewport - top - reserved - 6)));

    const setHeight = (value) => {
      const next = Math.max(160, Math.min(viewport, Math.round(value))) + 'px';
      if (container.style.height === next) return false;
      container.style.height = next;
      return true;
    };

    let changed = setHeight(height);
    container.style.minHeight = '0px';

    /* Trim any overflow from section padding or sub-pixel rounding. */
    for (let pass = 0; pass < 3; pass += 1) {
      const overflow = document.documentElement.scrollHeight - viewport;
      if (overflow <= 0) break;
      height -= overflow;
      changed = setHeight(height) || changed;
    }

    /* Three.js scenes size their renderer from the container, so let every
     * game's existing resize handler re-read the new playfield height. */
    if (changed) window.dispatchEvent(new Event('resize'));
  }

  function apply() {
    frame = 0;
    const on = MOBILE.matches;
    const fitPage = on && Boolean(container);

    document.body.classList.toggle('mobile-play', on);
    document.body.classList.toggle('mobile-play-fit', fitPage);

    if (!container) return;

    if (!fitPage) {
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
      container.parentElement
        ?.querySelectorAll('.mobile-play-extra')
        .forEach((el) => el.classList.remove('mobile-play-extra'));
      return;
    }

    markExtras();
    fit();
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  }

  MOBILE.addEventListener?.('change', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', () => {
    if (fullscreenOwnsLayout()) {
      container.style.removeProperty('height');
      container.style.removeProperty('min-height');
      return;
    }
    schedule();
  });

  if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(() => {});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  window.addEventListener('load', schedule);
})();
