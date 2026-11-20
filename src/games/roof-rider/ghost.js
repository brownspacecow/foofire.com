/* ------------------------------------------------------------------ *
 * Roof Rider — ghost runs
 *
 * A ghost is the player's fastest completed run on a track, stored as a
 * flat strip of samples. Each sample is:
 *   time, x, y, angle, rearComp, frontComp, crank, scrubbing
 *
 * Samples are recorded at roughly 30 Hz. The replay interpolates between
 * them, so storage stays small while the ghost still moves smoothly.
 * ------------------------------------------------------------------ */

export const GHOST_STRIDE = 8;
export const GHOSTS_KEY = 'roofRiderGhosts.v1';

/* Five minutes at 30 Hz. Every track is well under two minutes. */
const MAX_SAMPLES = 30 * 300;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, step) => Number((Math.round(value / step) * step).toFixed(3));

function validEntry(entry) {
  if (!entry || entry.v !== 1 || !Array.isArray(entry.s)) return false;
  if (entry.s.length < GHOST_STRIDE * 2) return false;
  if (entry.s.length % GHOST_STRIDE !== 0) return false;
  if (!entry.s.every((value) => Number.isFinite(value))) return false;
  const duration = entry.s[entry.s.length - GHOST_STRIDE];
  return Number.isFinite(entry.t) && Number.isFinite(duration) && duration > 0;
}

export function loadGhosts(storage, trackIds) {
  try {
    const raw = JSON.parse(storage?.getItem(GHOSTS_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const ids = Array.isArray(trackIds) ? trackIds : Object.keys(raw);
    const ghosts = {};
    for (const id of ids) {
      if (validEntry(raw[id])) ghosts[id] = raw[id];
    }
    return ghosts;
  } catch (error) {
    /* Storage can be blocked or hold something else entirely. */
    return {};
  }
}

export function saveGhost(storage, trackId, time, samples) {
  if (!storage || !trackId || !Array.isArray(samples)) return null;
  if (samples.length < GHOST_STRIDE * 2 || samples.length % GHOST_STRIDE !== 0) return null;
  try {
    const raw = JSON.parse(storage.getItem(GHOSTS_KEY) || '{}');
    const all = raw && typeof raw === 'object' ? raw : {};
    const entry = { v: 1, t: round(time, 0.001), s: samples.slice() };
    all[trackId] = entry;
    storage.setItem(GHOSTS_KEY, JSON.stringify(all));
    return entry;
  } catch (error) {
    /* A full or blocked store must not break the results screen. */
    return null;
  }
}

export function appendGhostSample(samples, bike, time) {
  if (!Array.isArray(samples) || !bike) return false;
  if (samples.length / GHOST_STRIDE >= MAX_SAMPLES) return false;
  samples.push(
    round(time, 0.001),
    round(bike.x, 0.01),
    round(bike.y, 0.01),
    round(bike.angle, 0.001),
    round(bike.rearComp || 0, 0.001),
    round(bike.frontComp || 0, 0.001),
    round(bike.crank || 0, 0.01),
    bike.scrubbing ? 1 : 0
  );
  return true;
}

export function createGhost(entry) {
  if (!validEntry(entry)) return null;
  const count = Math.floor(entry.s.length / GHOST_STRIDE);
  const duration = entry.s[(count - 1) * GHOST_STRIDE];
  return {
    samples: entry.s,
    count,
    duration,
    time: Number.isFinite(entry.t) ? entry.t : duration,
    cursor: 0,
  };
}

/**
 * Interpolated pose at a run time. Returns null once the ghost has finished
 * or while the recording has a long gap (a crash/respawn in the best run),
 * so the ghost never slides backwards to a checkpoint.
 */
export function ghostPose(ghost, time) {
  if (!ghost || !Number.isFinite(time) || time > ghost.duration) return null;
  const samples = ghost.samples;
  const maxIndex = ghost.count - 1;
  let index = clamp(Math.floor(ghost.cursor), 0, maxIndex);
  if (samples[index * GHOST_STRIDE] > time) index = 0;
  while (index < maxIndex && samples[(index + 1) * GHOST_STRIDE] <= time) index += 1;
  ghost.cursor = index;

  const a = index * GHOST_STRIDE;
  const b = Math.min(index + 1, maxIndex) * GHOST_STRIDE;
  const t0 = samples[a];
  const t1 = samples[b];
  const span = t1 - t0;
  if (span > 0.35 && time < t1) return null;

  const f = span > 0 ? clamp((time - t0) / span, 0, 1) : 0;
  return {
    x: samples[a + 1] + (samples[b + 1] - samples[a + 1]) * f,
    y: samples[a + 2] + (samples[b + 2] - samples[a + 2]) * f,
    angle: samples[a + 3] + (samples[b + 3] - samples[a + 3]) * f,
    rearComp: samples[a + 4] + (samples[b + 4] - samples[a + 4]) * f,
    frontComp: samples[a + 5] + (samples[b + 5] - samples[a + 5]) * f,
    crank: samples[a + 6] + (samples[b + 6] - samples[a + 6]) * f,
    scrubbing: Boolean(f < 0.5 ? samples[a + 7] : samples[b + 7]),
  };
}
