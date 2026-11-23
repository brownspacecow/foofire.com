import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRUMS,
  LESSON_COUNT,
  LESSONS,
  checkStepTap,
  drumById,
  drumByKey,
  lessonLength,
  lessonName,
  lessonPattern,
  lessonStars,
  lessonStepMs,
  lessonTempo,
  lessonTip,
  starString,
  stepIsDone,
  stepLabel,
} from './logic.js';

const makeRand = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('drum lookup works by id and by keyboard key', () => {
  assert.equal(drumById('kick').label, 'Kick');
  assert.equal(drumById('crash').key, 'g');
  assert.equal(drumById('ride').label, 'Ride');
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
  assert.notEqual(drumById('ride').color, drumById('crash').color);
});

test('there are eight hand-written lessons, each a real groove', () => {
  assert.equal(LESSON_COUNT, 8);
  assert.equal(LESSONS.length, 8);
  for (let level = 1; level <= LESSON_COUNT; level += 1) {
    const pattern = lessonPattern(level);
    assert.equal(pattern.length, lessonLength(level));
    assert.ok(lessonName(level).length > 0);
    assert.ok(lessonTip(level).length > 0);
    for (const step of pattern) {
      assert.ok(step.length >= 1, `level ${level} has an empty step`);
      for (const drum of step) {
        assert.ok(drumById(drum), `unknown drum ${drum}`);
        assert.notEqual(drum, 'ride', 'the ride is Free Play only');
      }
      assert.equal(new Set(step).size, step.length, 'no drum twice in one step');
    }
  }
});

test('the lessons build up from two drums to the whole kit', () => {
  // Lesson 1 is just kick and snare — the easiest real beat there is.
  assert.deepEqual(lessonPattern(1), [['kick'], ['snare'], ['kick'], ['snare']]);
  // Lesson 2 is the classic rock beat.
  assert.deepEqual(lessonPattern(2), [
    ['kick', 'hihat'],
    ['hihat'],
    ['snare', 'hihat'],
    ['hihat'],
  ]);
  // The bar doubles in length at lesson 4.
  assert.equal(lessonLength(3), 4);
  assert.equal(lessonLength(4), 8);
  // Crash arrives at 6, toms at 7.
  assert.ok(!lessonPattern(5).flat().includes('crash'));
  assert.ok(lessonPattern(6)[0].includes('crash'));
  assert.ok(!lessonPattern(6).flat().includes('tom'));
  assert.ok(lessonPattern(7).flat().includes('tom'));
  assert.deepEqual(lessonPattern(8).at(-1), ['crash']);
});

test('lesson patterns are copies, so playing one can never change the songbook', () => {
  const first = lessonPattern(2);
  first[0].push('crash');
  first.push(['kick']);
  assert.deepEqual(lessonPattern(2)[0], ['kick', 'hihat']);
  assert.equal(lessonPattern(2).length, 4);
});

test('Jack improvises new grooves after the hand-written lessons', () => {
  assert.equal(lessonName(9), 'Jam Session 9');
  assert.equal(lessonLength(9), 8);
  assert.ok(lessonTip(9).length > 0);
  const pattern = lessonPattern(9, makeRand([0.9, 0.9, 0.9, 0.9]));
  assert.equal(pattern.length, 8);
  // Hi-hat on every step: kick on 1 and 3, snare on 2 and 4.
  for (const step of pattern) assert.ok(step.includes('hihat'));
  assert.ok(pattern[0].includes('kick'));
  assert.ok(pattern[4].includes('kick'));
  assert.ok(pattern[2].includes('snare'));
  assert.ok(pattern[6].includes('snare'));
  // The ride is never generated into a lesson.
  assert.ok(!pattern.flat().includes('ride'));
});

test('tempo starts slow, climbs a little each lesson and stays playable', () => {
  assert.equal(lessonTempo(1), 64);
  assert.equal(lessonTempo(2), 67);
  assert.equal(lessonTempo(99), 104);
  // Four-step bars tick on the beat; eight-step bars tick on the eighth note.
  assert.equal(lessonStepMs(1), Math.round(60000 / 64));
  assert.equal(lessonStepMs(4), Math.round(60000 / 73 / 2));
  assert.ok(lessonStepMs(8) > 200);
});

test('copying a step accepts drums together, in any order', () => {
  const step = ['kick', 'hihat'];
  let hits = [];
  assert.equal(checkStepTap(step, hits, 'hihat'), 'correct');
  assert.deepEqual(hits, ['hihat']);
  assert.equal(checkStepTap(step, hits, 'kick'), 'complete');
  assert.deepEqual(hits, ['hihat', 'kick']);
});

test('a tap on the wrong drum is extra, never a fail', () => {
  const step = ['snare', 'hihat'];
  const hits = [];
  assert.equal(checkStepTap(step, hits, 'crash'), 'extra');
  assert.equal(checkStepTap(step, hits, 'kick'), 'extra');
  assert.deepEqual(hits, [], 'wrong taps are not recorded');
  // A double tap on a drum already hit is harmless too.
  assert.equal(checkStepTap(step, hits, 'snare'), 'correct');
  assert.equal(checkStepTap(step, hits, 'snare'), 'extra');
  assert.deepEqual(hits, ['snare']);
});

test('a step is done only when every drum in it has been hit', () => {
  assert.equal(stepIsDone(['kick', 'hihat'], ['hihat']), false);
  assert.equal(stepIsDone(['kick', 'hihat'], ['hihat', 'kick']), true);
  assert.equal(stepIsDone([], []), true);
});

test('stars reward a clean run and soften after slips', () => {
  assert.equal(lessonStars(0), 3);
  assert.equal(lessonStars(1), 2);
  assert.equal(lessonStars(2), 2);
  assert.equal(lessonStars(3), 1);
  assert.equal(starString(3), '★★★');
  assert.equal(starString(1), '★☆☆');
});

test('step labels read like a teacher would say them', () => {
  assert.equal(stepLabel(['kick', 'hihat']), 'Kick + Hi-Hat');
  assert.equal(stepLabel(['crash']), 'Crash');
});
