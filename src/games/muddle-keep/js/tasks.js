/* ------------------------------------------------------------------ *
 * Imps and the task queue
 * The player marks tiles; imps pick the nearest sensible job, walk to
 * it, and do it. They dig, claim, wall, and haul gold to the treasury.
 * Pathing is budgeted: a few attempts per idle imp, never per frame.
 * ------------------------------------------------------------------ */

import { findPath, floorCost } from './path.js';
import { followPath, tileDistance } from './movement.js';
import { T } from './tiles.js';

const WORK_TIME = { dig: 1.7, gold: 2.6, claim: 0.8, wall: 2.2 };
const IMP_SPEED = 2.5;
const MAX_FAILURES = 3;

export class TaskQueue {
  constructor(world) {
    this.world = world;
    this.tasks = new Map();
  }

  get size() {
    return this.tasks.size;
  }

  valid(task) {
    const tile = this.world.tile(task.x, task.y);
    if (task.kind === 'dig') return tile === T.DIRT || tile === T.GOLD;
    if (task.kind === 'claim') return tile === T.DUG;
    if (task.kind === 'wall') return tile === T.FLOOR;
    return false;
  }

  add(kind, x, y) {
    const index = this.world.idx(x, y);
    if (this.tasks.has(index)) return false;
    const task = { index, x, y, kind, claimedBy: null, failures: 0, unreachable: false };
    if (!this.valid(task)) return false;
    this.tasks.set(index, task);
    this.world.designations.set(index, kind);
    return true;
  }

  remove(x, y) {
    const index = this.world.idx(x, y);
    const task = this.tasks.get(index);
    if (!task) return null;
    this.tasks.delete(index);
    this.world.designations.delete(index);
    if (task.claimedBy) task.claimedBy.task = null;
    return task;
  }

  clear() {
    for (const task of this.tasks.values()) {
      if (task.claimedBy) task.claimedBy.task = null;
    }
    this.tasks.clear();
    this.world.designations.clear();
  }

  /** Drop tasks whose tile changed under them (dug by a knight, etc). */
  prune() {
    for (const task of this.tasks.values()) {
      if (!this.valid(task)) {
        this.tasks.delete(task.index);
        this.world.designations.delete(task.index);
        if (task.claimedBy) task.claimedBy.task = null;
      }
    }
  }

  sortedByDistance(x, y) {
    return [...this.tasks.values()]
      .filter((task) => !task.claimedBy && task.failures < MAX_FAILURES)
      .sort(
        (a, b) =>
          Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y))
      );
  }
}

class Imp {
  constructor(x, y, index) {
    this.id = index;
    this.x = x + 0.5;
    this.y = y + 0.5;
    this.path = null;
    this.pathIndex = 0;
    this.state = 'idle';
    this.task = null;
    this.timer = 0;
    this.carry = 0;
    this.boost = 0;
    this.idleTime = 0;
    this.stuck = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.anim = Math.random() * Math.PI * 2;
    this.workPulse = 0;
  }

  get speed() {
    return IMP_SPEED * (this.boost > 0 ? 1.8 : 1);
  }
}

export class ImpManager {
  constructor(game) {
    this.game = game;
    this.imps = [];
  }

  addImp(x, y) {
    const spawn = this.game.world.nearestWalkable(x, y, 6) ?? { x, y };
    this.imps.push(new Imp(spawn.x, spawn.y, this.imps.length + 1));
  }

  get count() {
    return this.imps.length;
  }

  pathFor(imp, x, y) {
    return findPath(this.game.world, Math.floor(imp.x), Math.floor(imp.y), x, y, {
      costAt: floorCost(this.game.world),
      maxNodes: 900,
    });
  }

  /** Pick the nearest reachable job. Called only while an imp is idle. */
  assignTask(imp) {
    const world = this.game.world;
    const tasks = this.game.tasks.sortedByDistance(imp.x, imp.y).slice(0, 6);
    for (const task of tasks) {
      task.unreachable = false;
      if (task.kind === 'dig') {
        const approaches = world
          .neighbours(task.x, task.y)
          .filter((cell) => world.walkable(cell.x, cell.y))
          .sort(
            (a, b) =>
              Math.abs(a.x - imp.x) +
              Math.abs(a.y - imp.y) -
              (Math.abs(b.x - imp.x) + Math.abs(b.y - imp.y))
          );
        for (const approach of approaches) {
          const path = this.pathFor(imp, approach.x, approach.y);
          if (path) {
            imp.task = task;
            task.claimedBy = imp;
            imp.path = path;
            imp.pathIndex = 0;
            imp.state = 'to-task';
            imp.stuck = 0;
            return true;
          }
        }
      } else {
        const path = this.pathFor(imp, task.x, task.y);
        if (path) {
          imp.task = task;
          task.claimedBy = imp;
          imp.path = path;
          imp.pathIndex = 0;
          imp.state = 'to-task';
          imp.stuck = 0;
          return true;
        }
      }
      task.failures += 1;
      task.unreachable = task.failures >= MAX_FAILURES;
    }
    return false;
  }

  update(dt) {
    const world = this.game.world;
    for (const imp of this.imps) {
      if (imp.boost > 0) imp.boost = Math.max(0, imp.boost - dt);
      imp.anim += dt * 8;

      if (imp.state === 'wander') {
        if (followPath(imp, dt, imp.speed)) {
          imp.state = 'idle';
          imp.idleTime = 0;
        }
        continue;
      }

      if (imp.state === 'idle' || imp.state === 'wander-idle') {
        imp.idleTime += dt;
        if (this.assignTask(imp)) continue;
        if (imp.idleTime > 2.5) {
          const spot = world.randomWalkableNear(imp.x, imp.y, 5);
          if (spot) {
            const path = this.pathFor(imp, spot.x, spot.y);
            if (path) {
              imp.path = path;
              imp.pathIndex = 0;
              imp.state = 'wander';
            }
          }
          imp.idleTime = 0;
        }
        continue;
      }

      if (imp.state === 'to-task') {
        imp.stuck += dt;
        if (imp.stuck > 14 || !imp.task) {
          this.release(imp);
          continue;
        }
        if (followPath(imp, dt, imp.speed)) {
          const task = imp.task;
          if (!task) {
            imp.state = 'idle';
            continue;
          }
          const distance = Math.abs(imp.x - (task.x + 0.5)) + Math.abs(imp.y - (task.y + 0.5));
          if (task.kind === 'dig' && distance > 1.6) {
            this.release(imp);
            continue;
          }
          imp.state = 'work';
          const tile = this.game.world.tile(task.x, task.y);
          const base = task.kind === 'dig' ? (tile === T.GOLD ? WORK_TIME.gold : WORK_TIME.dig) : WORK_TIME[task.kind];
          imp.timer = base;
          imp.workPulse = 0;
        }
        continue;
      }

      if (imp.state === 'work') {
        imp.timer -= dt;
        imp.workPulse -= dt;
        imp.anim += dt * 6;
        if (imp.workPulse <= 0) {
          imp.workPulse = 0.32;
          this.game.emit('imp-work', { x: imp.x, y: imp.y });
        }
        if (imp.timer <= 0) this.finishTask(imp);
        continue;
      }

      if (imp.state === 'haul') {
        if (followPath(imp, dt, imp.speed)) {
          if (imp.carry > 0) {
            const kept = this.game.economy.addGold(imp.carry, world);
            if (kept < imp.carry) this.game.emit('error', { text: 'Treasury full! Build more Treasury tiles.' });
            this.game.emit('deposit', { x: imp.x, y: imp.y, amount: kept });
          }
          imp.carry = 0;
          imp.task = null;
          imp.state = 'idle';
          imp.idleTime = 0;
        }
      }
    }

    this.dropUnreachable();
  }

  /**
   * A tile nobody can walk next to never gets dug, so leaving it queued makes
   * the job counter stick. Clear it and tell the player why it vanished.
   */
  dropUnreachable() {
    let dropped = 0;
    for (const task of this.game.tasks.tasks.values()) {
      if (task.failures < MAX_FAILURES) continue;
      this.game.tasks.tasks.delete(task.index);
      this.game.world.designations.delete(task.index);
      if (task.claimedBy) task.claimedBy.task = null;
      dropped += 1;
    }
    if (dropped > 0) {
      this.game.emit('error', {
        text: 'No tunnel reaches that spot. Dig outwards from your dungeon instead.',
      });
    }
  }

  release(imp) {
    if (imp.task) {
      imp.task.claimedBy = null;
      imp.task.failures += 1;
      if (imp.task.failures >= MAX_FAILURES) imp.task.unreachable = true;
    }
    imp.task = null;
    imp.path = null;
    imp.state = 'idle';
    imp.idleTime = 0;
    imp.stuck = 0;
  }

  finishTask(imp) {
    const task = imp.task;
    imp.task = null;
    imp.state = 'idle';
    imp.idleTime = 0;
    if (!task) return;
    this.game.tasks.tasks.delete(task.index);
    this.game.world.designations.delete(task.index);

    if (task.kind === 'dig') {
      const result = this.game.world.dig(task.index);
      if (result.ok) {
        this.game.emit('dig', { x: task.x, y: task.y, gold: result.gold });
        if (result.gold > 0) {
          const treasury = this.game.world.nearestRoomTile('treasury', task.x, task.y);
          if (treasury && this.game.world.hasRoom('treasury')) {
            imp.carry = result.gold;
            const path = this.pathFor(imp, treasury.x, treasury.y);
            if (path) {
              imp.path = path;
              imp.pathIndex = 0;
              imp.state = 'haul';
              imp.task = task;
              task.claimedBy = imp;
              return;
            }
            const kept = this.game.economy.addGold(imp.carry, this.game.world);
            imp.carry = 0;
            this.game.emit('deposit', { x: task.x, y: task.y, amount: kept });
          } else {
            const kept = this.game.economy.addGold(result.gold, this.game.world);
            this.game.emit('gold', { x: task.x, y: task.y, amount: kept });
          }
        }
      }
      return;
    }

    if (task.kind === 'claim') {
      if (this.game.world.claim(task.index)) {
        this.game.emit('claim', { x: task.x, y: task.y });
      }
      return;
    }

    if (task.kind === 'wall') {
      if (this.game.world.placeWall(task.index)) {
        this.game.emit('wall', { x: task.x, y: task.y });
      }
    }
  }

  slap(x, y) {
    let slapped = false;
    for (const imp of this.imps) {
      if (tileDistance(imp, x, y) < 2.2) {
        imp.boost = 10;
        imp.state = imp.state === 'idle' ? 'idle' : imp.state;
        slapped = true;
      }
    }
    return slapped;
  }

  serialize() {
    return this.imps.map((imp) => ({ x: imp.x, y: imp.y }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    this.imps = list.map((entry, index) => new Imp(entry.x - 0.5, entry.y - 0.5, index + 1));
  }
}
