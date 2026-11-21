/* ------------------------------------------------------------------ *
 * Movement
 * Grid entities share one tiny "walk the path" helper so imps,
 * creatures and knights all drift about the same way.
 * ------------------------------------------------------------------ */

const ARRIVE = 0.08;

/** Move an entity along its path. Returns true once the path is done. */
export function followPath(entity, dt, speed) {
  if (!entity.path || entity.pathIndex >= entity.path.length) return true;
  let budget = speed * dt;
  while (budget > 0) {
    const step = entity.path[entity.pathIndex];
    if (!step) {
      entity.pathIndex = entity.path.length;
      return true;
    }
    const targetX = step.x + 0.5;
    const targetY = step.y + 0.5;
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= ARRIVE) {
      entity.x = targetX;
      entity.y = targetY;
      entity.pathIndex += 1;
      if (entity.pathIndex >= entity.path.length) return true;
      continue;
    }
    const travel = Math.min(distance, budget);
    entity.x += (dx / distance) * travel;
    entity.y += (dy / distance) * travel;
    entity.facing = Math.atan2(dx, dy);
    budget -= travel;
    if (travel < distance) return false;
  }
  return entity.pathIndex >= entity.path.length;
}

/** Walk straight at a point, used for short chases and knock-backs. */
export function moveToward(entity, targetX, targetY, dt, speed) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.02) return true;
  const travel = Math.min(distance, speed * dt);
  entity.x += (dx / distance) * travel;
  entity.y += (dy / distance) * travel;
  entity.facing = Math.atan2(dx, dy);
  return distance - travel < 0.02;
}

/** Physics-lite knock-back, kept on the tiles when possible. */
export function knockBack(world, entity, fromX, fromY, strength, steps = 5) {
  if (!(strength > 0)) return 0;
  let dx = entity.x - fromX;
  let dy = entity.y - fromY;
  let length = Math.hypot(dx, dy);
  if (length < 0.001) {
    // Slapped dead-centre: shove backwards so the hit still has direction.
    const angle = entity.facing ?? 0;
    dx = -Math.sin(angle);
    dy = -Math.cos(angle);
    length = 1;
  }
  const dirX = dx / length;
  const dirY = dy / length;
  const step = strength / Math.max(1, steps);
  const startX = entity.x;
  const startY = entity.y;
  for (let index = 0; index < steps; index += 1) {
    const nx = entity.x + dirX * step;
    const ny = entity.y + dirY * step;
    if (!world.walkable(Math.floor(nx), Math.floor(ny))) break;
    entity.x = nx;
    entity.y = ny;
  }
  return Math.hypot(entity.x - startX, entity.y - startY);
}

export function tileDistance(entity, x, y) {
  return Math.hypot(entity.x - (x + 0.5), entity.y - (y + 0.5));
}
