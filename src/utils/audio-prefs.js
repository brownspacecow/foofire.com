/* ------------------------------------------------------------------ *
 * Sound preference shared by every game
 * Muting one game should keep the whole site quiet, so the choice is
 * stored once and each game falls back to its own older key.
 * ------------------------------------------------------------------ */

const KEY = 'foofireMuted.v1';

/**
 * True when sound was turned off in any game on this device.
 * `legacyKey` is the per-game key older versions of a game saved.
 */
export function readMuted(legacyKey) {
  try {
    const shared = window.localStorage.getItem(KEY);
    if (shared === '1') return true;
    if (shared === '0') return false;

    if (legacyKey) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy === '1') {
        window.localStorage.setItem(KEY, '1');
        return true;
      }
    }
  } catch (error) {
    /* Storage can be blocked; sound just defaults to on. */
  }
  return false;
}

/** Remember the mute choice for every game on this device. */
export function writeMuted(muted) {
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0');
  } catch (error) {
    /* ignore */
  }
}
