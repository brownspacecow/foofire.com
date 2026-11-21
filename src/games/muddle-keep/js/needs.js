/* ------------------------------------------------------------------ *
 * Creature needs
 * What a creature does when nobody is invading: eat, sleep, train or
 * potter about. Split out of creatures.js to keep both files small.
 * ------------------------------------------------------------------ */

import { findPath, floorCost } from './path.js';
import { followPath, tileDistance } from './movement.js';

export const MAX_LEVEL = 8;
const TRAIN_GOLD_PER_SECOND = 4;

export function wantsTraining(manager, creature) {
  if (creature.trainTimer > 0) return false;
  creature.trainTimer = 4;
  const game = manager.game;
  const world = game.world;
  if (creature.level >= MAX_LEVEL) return false;
  if (!world.hasRoom('training')) return false;
  if (game.economy.gold < 12) return false;
  if (creature.hunger > 60 || creature.energy < 30 || creature.mood < 35) return false;
  return Math.random() < 0.45;
}

export function seekRoom(manager, creature, roomId, state, dt) {
  const world = manager.game.world;
  if (!world.hasRoom(roomId)) {
    if (creature.state === state) creature.state = 'idle';
    return;
  }
  if (creature.state !== state) {
    creature.state = state;
    creature.path = null;
    creature.repath = 0;
    creature.destination = null;
  }
  if (!creature.destination) {
    creature.destination = world.nearestRoomTile(roomId, creature.x, creature.y);
    if (!creature.destination) {
      creature.state = 'idle';
      return;
    }
  }
  const target = creature.destination;
  if (tileDistance(creature, target.x, target.y) < 0.9) {
    useRoom(manager, creature, state, dt);
    return;
  }
  const status = manager.walkTo(creature, target.x, target.y, dt, 1.4);
  if (status === 'nopath') {
    creature.state = 'idle';
    creature.destination = null;
    creature.path = null;
  }
}

export function useRoom(manager, creature, state, dt) {
  const game = manager.game;
  const world = game.world;
  creature.path = null;

  if (state === 'eat') {
    if (game.economy.food >= 1) {
      game.economy.food -= 1;
      creature.hunger = 0;
      creature.mood = Math.min(100, creature.mood + 6);
      game.emit('eat', { x: creature.x, y: creature.y });
      creature.state = 'idle';
      creature.destination = null;
    } else {
      creature.mood = Math.max(0, creature.mood - 0.4);
      creature.state = 'idle';
      creature.destination = null;
      if (game.time - (manager.lastHungryCry ?? 0) > 8) {
        manager.lastHungryCry = game.time;
        game.emit('hungry', { name: creature.def.name });
      }
    }
    return;
  }

  if (state === 'sleep') {
    creature.sleepTimer += dt;
    creature.energy = Math.min(100, creature.energy + 30 * dt);
    creature.hp = Math.min(creature.maxHp, creature.hp + 4 * dt);
    if (creature.energy > 99 || creature.sleepTimer > 7) {
      creature.sleepTimer = 0;
      creature.state = 'idle';
      creature.destination = null;
    }
    return;
  }

  if (state === 'train') {
    if (creature.level >= MAX_LEVEL || !world.hasRoom('training') || game.economy.gold < 1) {
      creature.state = 'idle';
      creature.destination = null;
      return;
    }
    const spend = Math.min(TRAIN_GOLD_PER_SECOND * dt, game.economy.gold);
    game.economy.gold -= spend;
    creature.xp += 7 * creature.workRate * dt;
    creature.mood = Math.min(100, creature.mood + 0.5 * dt);
    creature.workPulse += dt;
    if (creature.workPulse > 0.8) {
      creature.workPulse = 0;
      game.emit('train', { x: creature.x, y: creature.y });
    }
    if (creature.xp >= creature.xpNeeded) {
      creature.xp = 0;
      creature.level += 1;
      creature.maxHp += 18;
      creature.hp = Math.min(creature.maxHp, creature.hp + 18);
      creature.mood = Math.min(100, creature.mood + 7);
      game.emit('levelup', {
        x: creature.x,
        y: creature.y,
        name: creature.def.name,
        level: creature.level,
      });
    }
  }
}

export function wander(manager, creature, dt) {
  const game = manager.game;
  if (creature.state === 'wander' && creature.path) {
    if (followPath(creature, dt, creature.speed)) {
      creature.state = 'idle';
      creature.idleTime = 0;
    }
    return;
  }
  creature.idleTime += dt;
  if (creature.state !== 'wander') creature.state = 'idle';
  if (creature.idleTime > 2.5) {
    creature.idleTime = 0;
    const world = game.world;
    const spot = world.randomWalkableNear(creature.x, creature.y, 5);
    if (spot) {
      const path = findPath(
        world,
        Math.floor(creature.x),
        Math.floor(creature.y),
        spot.x,
        spot.y,
        { costAt: floorCost(world), maxNodes: 700 }
      );
      if (path) {
        creature.path = path;
        creature.pathIndex = 0;
        creature.state = 'wander';
        return;
      }
    }
  }
  if (creature.hp < creature.maxHp && creature.hunger < 50) {
    creature.hp = Math.min(creature.maxHp, creature.hp + 0.6 * dt);
  }
}
