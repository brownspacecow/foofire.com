const RESTARTABLE_PHASES = new Set(['countdown', 'fight']);

// Once a fall is pending or a round has been scored, restarting would wipe a
// point that is about to be awarded or keep one that is already banked.
export function canRestartFromPhase(phase) {
  return RESTARTABLE_PHASES.has(phase);
}

export function restartLockMessage(phase) {
  if (phase === 'falling') return 'A fall is already in progress. Resume to finish the round.';
  if (phase === 'roundover') return 'This round is already decided. Resume to continue.';
  return '';
}
