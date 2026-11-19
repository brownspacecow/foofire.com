/* ------------------------------------------------------------------ *
 * Roof Rider — bike simulation
 *
 * A two-wheel raycast-suspension model on a heightfield. The bike is a
 * rigid body; each wheel casts straight down, compresses a spring and
 * applies normal + drive/brake forces at the contact point.
 *
 * The two mechanics the game is built around live here:
 *   - Preload: holding load while grounded squats the suspension. Let go
 *     just before the lip and the stored spring energy pops you higher.
 *   - Scrub: holding load in the air (with the bike reasonably level)
 *     flattens the arc, adding gravity and a little forward drive so a
 *     fast rider can still touch down on the backside.
 * ------------------------------------------------------------------ */

export const PHYS = {
  gravity: 19.5,
  mass: 185,
  inertia: 48,
  wheelBase: 1.46,
  wheelRadius: 0.32,
  suspMax: 0.56,
  suspMin: 0.22,
  springK: 15000,
  springC: 1400,
  maxSpring: 62000,
  driveForce: 2200,
  drivePower: 30000,
  topSpeed: 17.5,
  brakeForce: 2600,
  grip: 1.12,
  rolling: 0.03,
  airDrag: 0.55,
  airTorque: 1250,
  groundTorque: 950,
  airDamping: 520,
  groundDamping: 1500,
  preloadForce: 3000,
  preloadPop: 3.4,
  crashAngle: 2.35,
  headY: 0.98,
};

const TRAVEL = PHYS.suspMax - PHYS.suspMin;
const ANCHOR_Y = -0.08;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Wrap an angle into -PI..PI so landing comparisons behave. */
export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const smoothTo = (value, target, rate, dt) =>
  value + (target - value) * Math.min(1, rate * dt);

export function createBike(terrain, x = terrain.startX) {
  const bike = {
    x,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    av: 0,
    grounded: true,
    airTime: 0,
    scrubTime: 0,
    scrubbing: false,
    rearComp: 0,
    frontComp: 0,
    rearCompPrev: 0,
    frontCompPrev: 0,
    rearGrounded: false,
    frontGrounded: false,
    preloadCharge: 0,
    preloadPeak: 0,
    preloadReleasedAt: -10,
    controls: { throttle: 0, brake: 0, lean: 0, load: 0 },
    crank: 0,
    wheelSpin: 0,
    time: 0,
    crashed: false,
    crashReason: '',
    landingCount: 0,
    events: [],
    lastImpact: 0,
    topSpeed: 0,
    distance: 0,
    startX: x,
  };
  resetBike(bike, terrain, x);
  return bike;
}

export function resetBike(bike, terrain, x) {
  const placeX = x ?? bike.startX;
  const slope = terrain.slopeAt(placeX);
  bike.x = placeX;
  bike.y = terrain.surfaceAt(placeX) + 0.86;
  bike.vx = 0;
  bike.vy = 0;
  bike.angle = Math.atan(slope);
  bike.av = 0;
  bike.grounded = true;
  bike.airTime = 0;
  bike.scrubTime = 0;
  bike.scrubbing = false;
  bike.rearComp = 0;
  bike.frontComp = 0;
  bike.rearCompPrev = 0;
  bike.frontCompPrev = 0;
  bike.rearGrounded = true;
  bike.frontGrounded = true;
  bike.preloadCharge = 0;
  bike.preloadPeak = 0;
  bike.preloadReleasedAt = -10;
  bike.controls = { throttle: 0, brake: 0, lean: 0, load: 0 };
  bike.crank = 0;
  bike.wheelSpin = 0;
  bike.crashed = false;
  bike.crashReason = '';
  bike.landingCount = 0;
  bike.lastImpact = 0;
  bike.topSpeed = 0;
  bike.distance = 0;
  bike.startX = placeX;
  bike.events.length = 0;
}

function contactWheel(bike, terrain, localX, isRear, dt, controls, acc) {
  const cos = Math.cos(bike.angle);
  const sin = Math.sin(bike.angle);
  const anchorX = bike.x + localX * cos - ANCHOR_Y * sin;
  const anchorY = bike.y + localX * sin + ANCHOR_Y * cos;
  const ground = terrain.surfaceAt(anchorX);
  const slope = terrain.slopeAt(anchorX);
  const reach = PHYS.suspMax + PHYS.wheelRadius;
  const dist = anchorY - ground;

  const prevComp = isRear ? bike.rearCompPrev : bike.frontCompPrev;

  if (dist > reach) {
    if (isRear) {
      bike.rearGrounded = false;
      bike.rearComp = 0;
    } else {
      bike.frontGrounded = false;
      bike.frontComp = 0;
    }
    return null;
  }

  const length = clamp(dist - PHYS.wheelRadius, PHYS.suspMin, PHYS.suspMax);
  const compression = PHYS.suspMax - length;
  const compressionVel = (compression - prevComp) / dt;

  const denom = Math.sqrt(1 + slope * slope);
  const nx = -slope / denom;
  const ny = 1 / denom;
  const tx = 1 / denom;
  const ty = slope / denom;

  let spring = PHYS.springK * compression + PHYS.springC * Math.max(0, compressionVel);
  /* Progressive bump stop near the end of the travel. */
  const bumpStart = TRAVEL * 0.86;
  if (compression > bumpStart) {
    spring += (compression - bumpStart) * PHYS.springK * 3.2;
  }
  spring = clamp(spring, 0, PHYS.maxSpring);

  if (spring < 1) {
    if (isRear) {
      bike.rearComp = compression;
      bike.rearGrounded = false;
    } else {
      bike.frontComp = compression;
      bike.frontGrounded = false;
    }
    return null;
  }

  if (isRear) {
    bike.rearGrounded = true;
    bike.rearComp = compression;
  } else {
    bike.frontGrounded = true;
    bike.frontComp = compression;
  }

  const px = anchorX;
  const py = ground;

  /* Spring force along the ground normal, at the contact patch. */
  let fx = nx * spring;
  let fy = ny * spring;

  /* Velocity along the surface. */
  const vt = bike.vx * tx + bike.vy * ty;

  /* Drive: rear wheel only, power-limited and traction-limited. */
  let drive = 0;
  if (isRear && controls.throttle > 0.01) {
    const speedParse = Math.abs(vt);
    const rpmLimit = clamp(1 - (speedParse / PHYS.topSpeed) ** 3, 0, 1);
    const wanted =
      controls.throttle *
      Math.min(PHYS.driveForce, PHYS.drivePower / Math.max(2.5, speedParse)) *
      rpmLimit;
    drive = clamp(wanted, 0, spring * PHYS.grip * 0.94);
    fx += tx * drive;
    fy += ty * drive;
  }

  /* Brakes, biased toward the front like a real handful. */
  let brake = 0;
  if (controls.brake > 0.01 && Math.abs(vt) > 0.05) {
    const bias = isRear ? 0.35 : 0.65;
    const wanted = controls.brake * PHYS.brakeForce * bias;
    brake = clamp(wanted, 0, spring * PHYS.grip);
    fx -= tx * brake * Math.sign(vt);
    fy -= ty * brake * Math.sign(vt);
  }

  /* Rolling resistance and a little static hold on slow. */
  let rolling = -vt * PHYS.rolling * (spring / 1000);
  if (Math.abs(vt) < 0.4 && controls.throttle < 0.05 && controls.brake < 0.05) {
    rolling = -vt * 1400;
  }
  rolling = clamp(rolling, -spring * PHYS.grip * 0.7, spring * PHYS.grip * 0.7);
  fx += tx * rolling;
  fy += ty * rolling;

  /* Accumulate on the chassis, with torque from the offset contact. */
  const rx = px - bike.x;
  const ry = py - bike.y;
  acc.fx += fx;
  acc.fy += fy;
  acc.torque += rx * fy - ry * fx;

  /* Engine reaction: drive at the rear wheel pitches the bike up. */
  if (isRear) acc.torque += drive * PHYS.wheelRadius * 0.42;

  if (isRear) {
    acc.wheelSpin += Math.abs(drive) / Math.max(1, spring);
    bike.lastDrive = drive;
  }
  return { comp: compression, spring, lateral: vt, drive, brake, tx, ty, slope, localX };
}

/**
 * Advance the bike by one physics substep.
 * Events are appended to bike.events and cleared by the caller each frame.
 */
export function stepBike(bike, terrain, input, dt) {
  if (bike.crashed) return;

  bike.time += dt;
  const controls = bike.controls;
  controls.throttle = smoothTo(controls.throttle, input.throttle ?? 0, 12, dt);
  controls.brake = smoothTo(controls.brake, input.brake ?? 0, 16, dt);
  controls.lean = smoothTo(controls.lean, clamp(input.lean ?? 0, -1, 1), 9, dt);
  controls.load = smoothTo(controls.load, input.load ? 1 : 0, 14, dt);

  const wasGrounded = bike.grounded;
  const preVy = bike.vy;
  const preVx = bike.vx;

  const acc = { fx: 0, fy: -PHYS.mass * PHYS.gravity, torque: 0, wheelSpin: 0 };
  const rear = contactWheel(bike, terrain, -PHYS.wheelBase / 2, true, dt, controls, acc);
  const front = contactWheel(bike, terrain, PHYS.wheelBase / 2, false, dt, controls, acc);

  bike.rearCompPrev = bike.rearComp;
  bike.frontCompPrev = bike.frontComp;

  const grounded = Boolean(rear || front);
  bike.grounded = grounded;

  /* ---------------------------------------------------------- airborne */
  if (!grounded) {
    bike.airTime += dt;
    const level = Math.abs(normalizeAngle(bike.angle)) < 0.85;
    const wantsScrub = controls.load > 0.35 && level && bike.airTime > 0.08;
    bike.scrubbing = wantsScrub;

    if (wantsScrub) {
      bike.scrubTime += dt;
      /* Flatten the arc: extra gravity plus a nudge of forward drive. */
      acc.fy -= PHYS.mass * PHYS.gravity * 0.62;
      acc.fx += 46;
      acc.torque -= 160 * controls.load;
    } else {
      bike.scrubTime = Math.max(0, bike.scrubTime - dt * 2);
    }

    /* A held throttle rotates the bike back a touch in the air. */
    acc.torque += controls.throttle * 210;
  } else {
    bike.scrubbing = false;
    bike.scrubTime = Math.max(0, bike.scrubTime - dt * 3);
  }

  /* -------------------------------------------- takeoff and landing */
  if (wasGrounded && !grounded) {
    const releaseAge = bike.time - bike.preloadReleasedAt;
    const charged = bike.preloadCharge;
    let popped = false;
    if (releaseAge >= 0 && releaseAge < 0.32 && charged > 0.16) {
      bike.vy += PHYS.preloadPop * (0.4 + charged);
      popped = true;
    }
    bike.events.push({
      type: 'takeoff',
      x: bike.x,
      y: bike.y,
      speed: Math.hypot(bike.vx, bike.vy),
      preload: popped ? charged : 0,
      popped,
    });
    bike.preloadCharge = 0;
    bike.preloadPeak = 0;
    bike.airTime = 0;
    bike.scrubTime = 0;
  }

  if (!wasGrounded && grounded && bike.airTime > 0.12) {
    landBike(bike, terrain);
    if (bike.crashed) return;
  }
  if (grounded) bike.airTime = 0;

  /* ----------------------------------------------------------- preload */
  const maxCompNow = Math.max(bike.rearComp, bike.frontComp);
  const preloading = grounded && controls.load > 0.35 && maxCompNow < TRAVEL * 0.9;
  if (preloading) {
    /* Weight the pegs, but never push the frame through the dirt. */
    const room = clamp(1 - maxCompNow / (TRAVEL * 0.9), 0, 1);
    acc.fy -= PHYS.preloadForce * controls.load * room;
    bike.preloadPeak = Math.max(bike.preloadPeak, maxCompNow);
    bike.preloadCharge = clamp(bike.preloadPeak / TRAVEL, 0, 1);
    acc.torque += controls.load * 70;
  } else if (grounded && controls.load < 0.2) {
    if (bike.preloadCharge > 0.08) bike.preloadReleasedAt = bike.time;
    /* Charge bleeds away if it is not used. */
    bike.preloadCharge = Math.max(0, bike.preloadCharge - dt * 0.35);
    bike.preloadPeak = Math.max(0, bike.preloadPeak - dt * 0.9);
  }

  /* ------------------------------------------------------ rider torque */
  acc.torque += controls.lean * (grounded ? PHYS.groundTorque : PHYS.airTorque);
  acc.torque -= bike.av * (grounded ? PHYS.groundDamping : PHYS.airDamping);

  /* --------------------------------------------------------- integrate */
  bike.vx += (acc.fx / PHYS.mass) * dt;
  bike.vy += (acc.fy / PHYS.mass) * dt;

  const speed = Math.hypot(bike.vx, bike.vy);
  const drag = PHYS.airDrag * speed;
  bike.vx -= bike.vx * drag * dt * 0.06;
  bike.vy -= bike.vy * drag * dt * 0.06;

  bike.x += bike.vx * dt;
  bike.y += bike.vy * dt;
  bike.av = clamp(bike.av + (acc.torque / PHYS.inertia) * dt, -13, 13);
  bike.angle = normalizeAngle(bike.angle + bike.av * dt);
  bike.crank += bike.vx * dt;
  bike.wheelSpin += (acc.wheelSpin + Math.abs(bike.vx) * 0.02) * dt;
  bike.distance = Math.max(bike.distance, bike.x - bike.startX);
  bike.topSpeed = Math.max(bike.topSpeed, speed);

  /* ------------------------------------------------------------ crashes */
  if (bike.crashed) return;

  if (!Number.isFinite(bike.x) || !Number.isFinite(bike.y)) {
    crash(bike, 'lost');
    return;
  }

  const headLocal = PHYS.headY;
  const headX = bike.x - Math.sin(bike.angle) * headLocal;
  const headY = bike.y + Math.cos(bike.angle) * headLocal;
  if (headY < terrain.surfaceAt(headX) + 0.14) crash(bike, 'head');
  else if (bike.y < terrain.surfaceAt(bike.x) + 0.1) crash(bike, 'body');
  else if (Math.abs(bike.angle) > PHYS.crashAngle) crash(bike, 'flip');
}

function landBike(bike, terrain) {
  const airTime = bike.airTime;
  const slope = terrain.slopeAt(bike.x);
  const groundAngle = Math.atan(slope);
  const alignment = normalizeAngle(bike.angle - groundAngle);
  const denom = Math.sqrt(1 + slope * slope);
  const nx = -slope / denom;
  const ny = 1 / denom;
  const normalSpeed = Math.max(0, -(bike.vy * ny + bike.vx * nx * 0.25));
  const scrubbed = bike.scrubTime > 0.16;
  const onBackside = slope < -0.045;
  const aligned = Math.abs(alignment) < 0.4;

  let quality = 'flat';
  if (Math.abs(alignment) > 0.72) quality = 'sloppy';
  else if (onBackside && aligned) quality = 'backside';
  else if (onBackside) quality = 'sketchy';

  const cased = slope > 0.1 && normalSpeed > 5;
  const fatal = normalSpeed > 17 || Math.abs(alignment) > 1.15 || (slope > 0.22 && normalSpeed > 10);

  if (fatal) {
    crash(bike, 'landing');
    return;
  }

  if (quality === 'sloppy' || cased) {
    bike.vx *= 0.78;
    bike.vy *= 0.85;
    if (cased) quality = 'cased';
  } else if (onBackside) {
    /* Touching down on the backside keeps the wheels rolling. */
    const carry = clamp(normalSpeed * 0.13, 0, 2.2);
    bike.vx += txOf(slope) * carry;
    bike.vy += tyOf(slope) * carry;
  }

  bike.landingCount += 1;
  bike.events.push({
    type: 'land',
    x: bike.x,
    y: bike.y,
    airTime,
    impact: normalSpeed,
    slope,
    alignment,
    quality,
    scrubbed,
    onBackside,
  });
  bike.airTime = 0;
  bike.scrubTime = 0;
}

function txOf(slope) {
  return 1 / Math.sqrt(1 + slope * slope);
}

function tyOf(slope) {
  return slope / Math.sqrt(1 + slope * slope);
}

function crash(bike, reason) {
  if (bike.crashed) return;
  bike.crashed = true;
  bike.crashReason = reason;
  bike.scrubbing = false;
  bike.events.push({
    type: 'crash',
    x: bike.x,
    y: bike.y,
    reason,
    speed: Math.hypot(bike.vx, bike.vy),
  });
  bike.vx *= 0.35;
  bike.vy = Math.min(bike.vy, 0);
  bike.av = 0;
}

/** True when the bike is close enough to the ground to bail out safely. */
export function bikeSpeed(bike) {
  return Math.hypot(bike.vx, bike.vy);
}

export function isBikeInFrame(bike, minX, maxX) {
  return bike.x >= minX && bike.x <= maxX;
}
