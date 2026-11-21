/* ------------------------------------------------------------------ *
 * Pathfinding
 * A small budgeted A*. Everything that walks asks for one path at a
 * time, and callers throttle how often they ask, so the simulation
 * stays friendly to a mid-range phone.
 * ------------------------------------------------------------------ */

import { T } from './tiles.js';

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(node) {
    const items = this.items;
    items.push(node);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].f <= items[index].f) break;
      [items[parent], items[index]] = [items[index], items[parent]];
      index = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && items[left].f < items[smallest].f) smallest = left;
        if (right < items.length && items[right].f < items[smallest].f) smallest = right;
        if (smallest === index) break;
        [items[smallest], items[index]] = [items[index], items[smallest]];
        index = smallest;
      }
    }
    return top;
  }
}

/**
 * Find a path from (sx, sy) to (tx, ty).
 * `costAt(x, y)` returns Infinity for impassable cells and any number >= 1
 * for passable ones. Returns an array of steps excluding the start, or null.
 */
export function findPath(world, sx, sy, tx, ty, options = {}) {
  const { costAt, maxNodes = 1600, heuristicScale = 1 } = options;
  const start = world.idx(Math.round(sx), Math.round(sy));
  const goal = world.idx(Math.round(tx), Math.round(ty));
  if (!world.inBounds(Math.round(sx), Math.round(sy))) return null;
  if (!world.inBounds(Math.round(tx), Math.round(ty))) return null;

  const size = world.tiles.length;
  const gScore = new Float32Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const goalX = world.xOf(goal);
  const goalY = world.yOf(goal);

  gScore[start] = 0;
  const open = new MinHeap();
  open.push({ index: start, f: Math.abs(world.xOf(start) - goalX) + Math.abs(world.yOf(start) - goalY) });

  let expanded = 0;
  while (open.size) {
    const node = open.pop();
    const current = node.index;
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === goal) break;
    expanded += 1;
    if (expanded > maxNodes) return null;

    const cx = world.xOf(current);
    const cy = world.yOf(current);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!world.inBounds(nx, ny)) continue;
      const next = world.idx(nx, ny);
      if (closed[next]) continue;
      const step = costAt(nx, ny);
      if (!Number.isFinite(step)) continue;
      const tentative = gScore[current] + step;
      if (tentative >= gScore[next]) continue;
      cameFrom[next] = current;
      gScore[next] = tentative;
      const heuristic = (Math.abs(nx - goalX) + Math.abs(ny - goalY)) * heuristicScale;
      open.push({ index: next, f: tentative + heuristic });
    }
  }

  if (cameFrom[goal] === -1 && goal !== start) return null;
  const path = [];
  let current = goal;
  while (current !== start && current !== -1) {
    path.push({ x: world.xOf(current), y: world.yOf(current) });
    current = cameFrom[current];
    if (path.length > 4096) return null;
  }
  return path.reverse();
}

/** Cost table for creatures and imps: only floors are easy. */
export function floorCost(world) {
  return (x, y) => {
    const tile = world.tile(x, y);
    if (tile === T.DUG || tile === T.FLOOR) return 1;
    if (tile === T.DOOR) return 2;
    return Infinity;
  };
}

/**
 * Cost table for tidy knights. They would rather walk, but they are
 * perfectly happy to knock a hole in a wall, a door or a pile of dirt.
 */
export function invaderCost(world) {
  return (x, y) => {
    const tile = world.tile(x, y);
    if (tile === T.DUG || tile === T.FLOOR) return 1;
    if (tile === T.DOOR) return 14;
    if (tile === T.DIRT) return 10;
    if (tile === T.GOLD) return 13;
    if (tile === T.WALL) return 22;
    return Infinity;
  };
}

/** A coarse line check, good enough for cartoon arrows and sparks. */
export function hasLineOfSight(world, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 0.35));
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const tile = world.tile(Math.floor(ax + dx * t), Math.floor(ay + dy * t));
    // Only open floor lets sight through: dirt, gold, built walls and
    // doors all block it, so ranged attacks can't fire through walls.
    if (tile !== T.DUG && tile !== T.FLOOR) return false;
  }
  return true;
}

/** Cheap breadth-first flood used to reject unreachable designations. */
export function reachableTiles(world, sx, sy, maxNodes = 900) {
  const seen = new Set();
  const start = world.idx(Math.round(sx), Math.round(sy));
  if (!world.walkable(Math.round(sx), Math.round(sy))) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length && seen.size < maxNodes) {
    const current = queue.shift();
    const cx = world.xOf(current);
    const cy = world.yOf(current);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const next = world.idx(nx, ny);
      if (!world.inBounds(nx, ny) || seen.has(next)) continue;
      if (!world.walkable(nx, ny)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}
