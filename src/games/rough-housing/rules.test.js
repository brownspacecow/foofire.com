import test from 'node:test';
import assert from 'node:assert/strict';
import { canRestartFromPhase, restartLockMessage } from './rules.js';

test('restart is locked while a fall is pending', () => {
  assert.equal(canRestartFromPhase('falling'), false);
  assert.match(restartLockMessage('falling'), /fall/i);
});

test('restart is locked after the round is scored', () => {
  assert.equal(canRestartFromPhase('roundover'), false);
  assert.match(restartLockMessage('roundover'), /round/i);
});

test('restart remains available during live play', () => {
  assert.equal(canRestartFromPhase('countdown'), true);
  assert.equal(canRestartFromPhase('fight'), true);
  assert.equal(restartLockMessage('fight'), '');
});

test('inactive phases cannot restart', () => {
  for (const phase of [null, undefined, 'intro', 'select', 'build', 'paused', 'matchover']) {
    assert.equal(canRestartFromPhase(phase), false);
  }
});
