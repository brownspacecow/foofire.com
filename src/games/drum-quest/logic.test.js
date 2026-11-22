import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_STEPS,
  BEAT_PRESETS,
  builderStepMs,
  checkCopyCatTap,
  clampTempo,
  copyCatDrums,
  copyCatLength,
  copyCatStepMs,
  copyCatTempo,
  drumById,
  drumByKey,
  emptyGrid,
  generatePattern,
  gridToEvents,
  isGridEmpty,
  isValidGrid,
  loadPreset,
  starsForAttempts,
  starString,
  toggleCell,
} from './logic.js';

/* A fixed pseudo-random source so pattern tests are deterministic. */
const makeRand = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('drum lookup works by id and by keyboard key', () => {
  assert.equal(drumById('kick').label, 'Kick');
  assert.equal(drumById('crash').key, 'g');
  assert.equal(drumById('nope'), null);
  assert.equal(drumByKey('A').id, 'kick');
  assert.equal(drumByKey('s').id, 'snare');
  assert.equal(drumByKey('z'), null);
});

test('copy cat length grows one hit every two levels, capped at 8', () => {
  assert.equal(copyCatLength(1), 2);
  assert.equal(copyCatLength(2), 2);
  assert.equal(copyCatLength(3), 3);
  assert.equal(copyCatLength(5), 4);
  assert.equal(copyCatLength(13), 8);
  assert.equal(copyCatLength(99), 8);
});

test('copy cat tempo starts at 70 BPM and caps at 120', () => {
  assert.equal(copyCatTempo(1), 70);
  assert.equal(copyCatTempo(2), 75);
  assert.equal(copyCatTempo(11), 120);
  assert.equal(copyCatTempo(99), 120);
  assert.equal(copyCatStepMs(1), Math.round(60000 / 70));
});

test('tom only joins the pattern pool from level 5', () => {
  assert.deepEqual(copyCatDrums(1), ['kick', 'snare', 'hihat']);
  assert.deepEqual(copyCatDrums(4), ['kick', 'snare', 'hihat']);
  assert.deepEqual(copyCatDrums(5), ['kick', 'snare', 'hihat', 'tom']);
});

test('generated patterns have the right length and never repeat a drum', () => {
  const pattern = generatePattern(5, makeRand([0, 0.3, 0.6, 0.9, 0.1, 0.4, 0.7, 0.2]));
  assert.equal(pattern.length, copyCatLength(5));
  for (let i = 1; i < pattern.length; i += 1) {
    assert.notEqual(pattern[i], pattern[i - 1]);
  }
  for (const drum of pattern) assert.ok(copyCatDrums(5).includes(drum));
});

test('copy cat tap checking reports correct, complete and wrong', () => {
  const pattern = ['kick', 'snare', 'kick'];
  assert.equal(checkCopyCatTap(pattern, [], 'kick'), 'correct');
  assert.equal(checkCopyCatTap(pattern, ['kick'], 'snare'), 'correct');
  assert.equal(checkCopyCatTap(pattern, ['kick', 'snare'], 'kick'), 'complete');
  assert.equal(checkCopyCatTap(pattern, [], 'snare'), 'wrong');
  assert.equal(checkCopyCatTap(pattern, ['kick', 'snare', 'kick'], 'kick'), 'wrong');
});

test('stars reward a first-try finish and soften after retries', () => {
  assert.equal(starsForAttempts(1), 3);
  assert.equal(starsForAttempts(2), 2);
  assert.equal(starsForAttempts(3), 1);
  assert.equal(starsForAttempts(9), 1);
  assert.equal(starString(3), '★★★');
  assert.equal(starString(1), '★☆☆');
});

test('rock preset is kick on 1 and 3, snare on 2 and 4, hi-hat every step', () => {
  const grid = loadPreset('rock');
  assert.deepEqual(grid.kick, [true, false, false, false, true, false, false, false]);
  assert.deepEqual(grid.snare, [false, false, true, false, false, false, true, false]);
  assert.deepEqual(grid.hihat, Array(BUILDER_STEPS).fill(true));
  // Loading a preset twice gives independent grids.
  const again = loadPreset('rock');
  again.kick[0] = false;
  assert.equal(loadPreset('rock').kick[0], true);
  assert.equal(BEAT_PRESETS.rock.grid.kick[0], true);
});

test('boom-boom-clap and jungle stomp presets are real, distinct beats', () => {
  const boom = loadPreset('boom-boom-clap');
  assert.deepEqual(boom.kick, [true, true, false, false, true, false, false, false]);
  assert.equal(isGridEmpty(boom), false);

  const jungle = loadPreset('jungle-stomp');
  assert.deepEqual(jungle.hihat, [false, true, false, true, false, true, false, true]);
  assert.notDeepEqual(jungle, boom);
  assert.equal(loadPreset('no-such-preset').kick.every(Boolean), false);
});

test('toggling a cell flips it and leaves the rest alone', () => {
  const grid = emptyGrid();
  const toggled = toggleCell(grid, 'snare', 2);
  assert.equal(toggled.snare[2], true);
  assert.equal(toggled.snare[3], false);
  assert.equal(grid.snare[2], false); // the original grid is untouched
  assert.equal(toggleCell(toggled, 'snare', 2).snare[2], false);
  // Bad rows and steps are ignored, not crashes.
  assert.deepEqual(toggleCell(grid, 'crash', 0), grid);
  assert.deepEqual(toggleCell(grid, 'kick', 8), grid);
  assert.deepEqual(toggleCell(grid, 'kick', -1), grid);
});

test('grid events come out in step order with the right drums', () => {
  const events = gridToEvents(loadPreset('rock'));
  assert.equal(events.length, 2 + 2 + 8);
  assert.deepEqual(events[0], { step: 0, drum: 'kick' });
  assert.deepEqual(events[1], { step: 0, drum: 'hihat' });
  assert.ok(events.every((event, i) => i === 0 || event.step >= events[i - 1].step));
  assert.equal(isGridEmpty(emptyGrid()), true);
  assert.equal(isGridEmpty(loadPreset('rock')), false);
});

test('builder step time is an eighth note and tempo clamps to 60–120', () => {
  assert.equal(builderStepMs(120), 250);
  assert.equal(builderStepMs(60), 500);
  assert.equal(clampTempo(30), 60);
  assert.equal(clampTempo(200), 120);
  assert.equal(clampTempo(90), 90);
});

test('saved grids validate by shape only', () => {
  assert.equal(isValidGrid(loadPreset('rock')), true);
  assert.equal(isValidGrid(emptyGrid()), true);
  assert.equal(isValidGrid(null), false);
  assert.equal(isValidGrid({ kick: [true] }), false);
  assert.equal(isValidGrid({ kick: Array(8).fill(true), snare: Array(8).fill(false), hihat: Array(8).fill('yes') }), false);
});
