import { SPAWN } from '../layout.js';

export const worldState = {
  player: { x: SPAWN.x, z: SPAWN.z },
  facing: Math.PI,
  room: 'great-hall',
};

export const moveInput = {
  x: 0,
  z: 0,
  run: false,
};

export function resetPlayer() {
  worldState.player.x = SPAWN.x;
  worldState.player.z = SPAWN.z;
  worldState.facing = Math.PI;
  worldState.room = 'great-hall';
  moveInput.x = 0;
  moveInput.z = 0;
}
