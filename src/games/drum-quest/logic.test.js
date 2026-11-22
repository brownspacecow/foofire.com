import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRUMS,
  JACK_BEATS,
  checkCopyCatTap,
  copyCatBeatName,
  copyCatCycleMs,
  copyCatDrums,
  copyCatLength,
  copyCatLoopMs,
  copyCatStepMs,
  copyCatTempo,
  drumById,
  drumByKey,
  generatePattern,
  starsForAttempts,
  starString,
  stepIsDone,
} from './logic.js';

/* A fixed pseudo-random source so generated-groove tests are deterministic. */
const makeRand = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('drum lookup works by id and by keyboard key', () => {
  assert.equal(drumById('kick').label, 'Kick');
  assert.equal(drumById('crash').key, 'g');
  assert.equal(drumById('ride').label, 'Ride');
  assert.equal(drumById('ride').key, 'h');
  assert.equal(drumById('nope'), null);
  assert.equal(drumByKey('A').id, 'kick');
  assert.equal(drumByKey('s').id, 'snare');
  assert.equal(drumByKey('H').id, 'ride');
  assert.equal(drumByKey('z'), null);
});

test('every drum has a unique id, key and colour', () => {
  const ids = DRUMS.map((drum) => drum.id);
  const keys = DRUMS.map((drum) => drum.key);
  const colors = DRUMS.map((drum) => drum.color);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(colors).size, colors.length);
  // The ride is its own drum, not an alias of the crash.
  assert.notEqual(drumById('ride'), drumById('crash'));
  assert.notEqual(drumById('ride').key, drumById('crash').key);
  assert.notEqual(drumById('ride').color, drumById('crash').color);
});

test('the ride is Free Play only — never in any of Jack\u2019s beats or pools', () => {
  for (const level of [1, 2, 3, 5, 6, 9, 99]) {
    assert.ok(!copyCatDrums(level).includes('ride'));
  }
  for (const level of Object.keys(JACK_BEATS)) {
    assert.ok(!generatePattern(Number(level)).flat().includes('ride'));
  }
});

test('a bar is 4 quarter-note steps at levels 1-2, 8 eighth-note steps after', () => {
  assert.equal(copyCatLength(1), 4);
  assert.equal(copyCatLength(2), 4);
  assert.equal(copyCatLength(3), 8);
  assert.equal(copyCatLength(99), 8);
});

test('copy cat tempo starts at 60 BPM, climbs 3 a level, and caps at 120', () => {
  assert.equal(copyCatTempo(1), 60);
  assert.equal(copyCatTempo(2), 63);
  assert.equal(copyCatTempo(11), 90);
  assert.equal(copyCatTempo(99), 120);
  // Level 1 steps are quarter notes (1000ms); level 3 steps are eighth notes.
  assert.equal(copyCatStepMs(1), 1000);
  assert.equal(copyCatStepMs(3), Math.round(60000 / 66 / 2));
});

test('Jack starts with kick, snare and hi-hat; crash joins at 5, tom at 6', () => {
  assert.deepEqual(copyCatDrums(1), ['kick', 'snare', 'hihat']);
  assert.deepEqual(copyCatDrums(4), ['kick', 'snare', 'hihat']);
  assert.deepEqual(copyCatDrums(5), ['kick', 'snare', 'hihat', 'crash']);
  assert.deepEqual(copyCatDrums(6), ['kick', 'snare', 'hihat', 'tom', 'crash']);
});

test("Jack's first six beats are fixed, named, real grooves", () => {
  assert.equal(copyCatBeatName(1), 'Rock Beat');
  assert.equal(copyCatBeatName(2), 'Boom-Boom-Clap');
  assert.equal(copyCatBeatName(5), 'Crash Intro');
  assert.equal(copyCatBeatName(6), 'Tom Fill');
  // Level 1 is a real rock groove: kick + hi-hat, hi-hat, snare + hi-hat, hi-hat.
  assert.deepEqual(generatePattern(1), [
    ['kick', 'hihat'],
    ['hihat'],
    ['snare', 'hihat'],
    ['hihat'],
  ]);
  // Level 5 opens with a crash on beat 1.
  assert.deepEqual(generatePattern(5)[0], ['crash', 'kick', 'hihat']);
  // Level 6 has a tom in it.
  assert.ok(generatePattern(6).flat().includes('tom'));
  // Every fixed beat is one bar of steps of real drums.
  for (const level of Object.keys(JACK_BEATS)) {
    const pattern = generatePattern(Number(level));
    assert.equal(pattern.length, copyCatLength(Number(level)));
    for (const step of pattern) {
      assert.ok(step.length >= 1);
      for (const drum of step) assert.ok(copyCatDrums(Number(level)).includes(drum));
    }
  }
});

test('a Jack bar is the groove with no pause after it', () => {
  // Level 1: 4 quarter-note steps at 60 BPM = 4000ms, and that is the loop.
  assert.equal(copyCatLoopMs(1), 4000);
  assert.equal(copyCatLoopMs(3), 8 * copyCatStepMs(3));
});

test('a full Jack-plus-Joel cycle is exactly two 4/4 bars — no extra beat', () => {
  // Level 1: 4 quarter-note steps a bar at 60 BPM — Jack's bar (4s)
  // plus Joel's bar (4s) is 8 steps, 8000ms, and nothing else.
  assert.equal(copyCatCycleMs(1), 8000);
  assert.equal(copyCatCycleMs(1), 2 * copyCatLoopMs(1));
  // Level 3: 8 eighth-note steps a bar — 16 steps a cycle, two 4/4 bars.
  assert.equal(copyCatCycleMs(3), 16 * copyCatStepMs(3));
  assert.equal(copyCatCycleMs(3), 2 * copyCatLoopMs(3));
});

test('generated grooves keep the hi-hat on time and kick/snare on their beats', () => {
  const pattern = generatePattern(9, makeRand([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]));
  assert.equal(pattern.length, 8);
  // Hi-hat on every step, kick on beats 1 and 3, snare on 2 and 4.
  for (const step of pattern) assert.ok(step.includes('hihat'));
  assert.ok(pattern[0].includes('kick'));
  assert.ok(pattern[4].includes('kick'));
  assert.ok(pattern[2].includes('snare'));
  assert.ok(pattern[6].includes('snare'));
});

test('copy cat tap checking works step by step, drums together', () => {
  const pattern = [
    ['kick', 'hihat'],
    ['hihat'],
    ['snare', 'hihat'],
  ];
  // Fresh per-step hits for every check — the checker records the hit.
  const fresh = () => pattern.map(() => []);
  // Step 1 needs kick and hi-hat, in either order.
  let hits = fresh();
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'kick'), 'correct');
  assert.deepEqual(hits[0], ['kick']);
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'hihat'), 'step');
  assert.deepEqual(hits[0], ['kick', 'hihat']);
  hits = fresh();
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'hihat'), 'correct');
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'kick'), 'step');
  // A drum that is in no nearby step is wrong…
  assert.equal(checkCopyCatTap(pattern, 0, fresh(), 'snare'), 'wrong');
  // …but a repeat of a drum already hit is ignored, not failed.
  assert.equal(checkCopyCatTap(pattern, 0, [['kick'], [], []], 'kick'), 'ignored');
  // The last step of the bar completes the groove.
  hits = [[ 'kick', 'hihat'], ['hihat'], ['snare']];
  assert.equal(checkCopyCatTap(pattern, 2, hits, 'hihat'), 'complete');
  // No step past the end.
  assert.equal(checkCopyCatTap(pattern, 3, fresh(), 'kick'), 'wrong');
});

test('a tap counts for the step it meant, even across a step boundary', () => {
  // Level 1 Rock Beat: kick+hi-hat, hi-hat, snare+hi-hat, hi-hat.
  const pattern = generatePattern(1);
  const fresh = () => pattern.map(() => []);
  // Straddle: kick landed in step 0, the clock ticked, hi-hat lands in
  // step 1's window — it still counts for step 0, which it completes.
  let hits = [['kick'], [], [], []];
  assert.equal(checkCopyCatTap(pattern, 1, hits, 'hihat'), 'step');
  assert.deepEqual(hits[0], ['kick', 'hihat']);
  // Early: snare tapped in step 1's window, 100ms before step 2 —
  // it counts for step 2.
  hits = [['kick', 'hihat'], ['hihat'], [], []];
  assert.equal(checkCopyCatTap(pattern, 1, hits, 'snare'), 'correct');
  assert.deepEqual(hits[2], ['snare']);
  // Late: step 1's hi-hat missed, tapped during step 2's window —
  // it counts for step 1.
  hits = [['kick', 'hihat'], [], ['snare'], []];
  assert.equal(checkCopyCatTap(pattern, 2, hits, 'hihat'), 'step');
  assert.deepEqual(hits[1], ['hihat']);
  // Playing ahead: step 0 is done, so step 1's hi-hat tapped while
  // the clock is still on step 0 counts for step 1.
  hits = [['kick', 'hihat'], [], [], []];
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'hihat'), 'step');
  assert.deepEqual(hits[1], ['hihat']);
  // A late tap can finish the bar even when it is not the last step
  // on the clock: only step 1 is still open, and this hi-hat is it.
  hits = [['kick', 'hihat'], [], ['snare', 'hihat'], ['hihat']];
  assert.equal(checkCopyCatTap(pattern, 2, hits, 'hihat'), 'complete');
  assert.ok(stepIsDone(pattern[1], hits[1]));
});

test('extra taps are ignored, never failed', () => {
  const pattern = generatePattern(1);
  // Double-tap: kick twice in step 0 — the second one is ignored.
  let hits = [['kick'], [], [], []];
  assert.equal(checkCopyCatTap(pattern, 0, hits, 'kick'), 'ignored');
  assert.deepEqual(hits, [['kick'], [], [], []]);
  // A drum from a step that is already done is ignored too.
  hits = [['kick', 'hihat'], ['hihat'], [], []];
  assert.equal(checkCopyCatTap(pattern, 1, hits, 'kick'), 'ignored');
  // …even on the step right after it finished.
  assert.equal(checkCopyCatTap(pattern, 2, hits, 'kick'), 'ignored');
});

test('a genuinely wrong drum still fails the attempt', () => {
  const pattern = generatePattern(1);
  const fresh = () => pattern.map(() => []);
  // Crash, tom and ride are in no step at level 1 — and none of them
  // is in a step next to step 0 either.
  assert.equal(checkCopyCatTap(pattern, 0, fresh(), 'crash'), 'wrong');
  assert.equal(checkCopyCatTap(pattern, 0, fresh(), 'tom'), 'wrong');
  assert.equal(checkCopyCatTap(pattern, 0, fresh(), 'ride'), 'wrong');
  // Snare two steps away is wrong too: it belongs to no nearby step.
  assert.equal(checkCopyCatTap(pattern, 0, fresh(), 'snare'), 'wrong');
});

test('stars reward a first-try finish and soften after retries', () => {
  assert.equal(starsForAttempts(1), 3);
  assert.equal(starsForAttempts(2), 2);
  assert.equal(starsForAttempts(3), 1);
  assert.equal(starsForAttempts(9), 1);
  assert.equal(starString(3), '★★★');
  assert.equal(starString(1), '★☆☆');
});
