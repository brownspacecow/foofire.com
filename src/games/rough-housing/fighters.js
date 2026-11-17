import * as THREE from 'three';
import * as RAPIER_NS from '@dimforge/rapier3d-compat';
import { buildRig } from './characters.js';
import { LAVA_Y } from './arena.js';

const RAPIER = RAPIER_NS.default ?? RAPIER_NS;
const TAU = Math.PI * 2;

export const DASH = { windup: 0.1, active: 0.45, recover: 0.26, cooldown: 1.15 };

// Jump feel: accept a jump pressed a little before landing, and still allow a
// jump for a moment after stepping off an edge.
const JUMP_BUFFER = 0.14;
const COYOTE_TIME = 0.12;

/* ------------------------------------------------------------------ *
 * Rough Housing — fighters
 * A dynamic Rapier capsule with locked rotation drives the body, and a
 * separate visual root does the flailing, cartwheeling and tumbling.
 * ------------------------------------------------------------------ */

export class Fighter {
  constructor({ spec, world, scene, controls, index }) {
    this.spec = spec;
    this.world = world;
    this.controls = controls;
    this.index = index;

    this.visual = buildRig(spec);
    this.root = new THREE.Group();
    this.spin = new THREE.Group();
    this.root.add(this.spin);
    this.spin.add(this.visual.group);
    scene.add(this.root);

    const { height, radius, mass } = spec.body;
    this.halfHeight = Math.max(0.1, (height - 2 * radius) / 2);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, -80, 0)
      .setLinearDamping(0.02)
      .setAngularDamping(0.6)
      .setCcdEnabled(true);
    this.body = world.createRigidBody(bodyDesc);
    if (typeof this.body.setEnabledRotations === 'function') {
      this.body.setEnabledRotations(false, false, false, true);
    }
    const colliderDesc = RAPIER.ColliderDesc.capsule(this.halfHeight, radius)
      .setMass(mass)
      .setFriction(0.62)
      .setRestitution(0.04)
      .setCollisionGroups((1 << 16) | 3);
    this.collider = world.createCollider(colliderDesc, this.body);

    this.yaw = 0;
    this.grounded = false;
    this.prevGrounded = false;
    this.prevVy = 0;
    this.prevJump = false;
    this.prevDash = false;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.out = false;
    this.outAt = 0;
    this.flopTimer = 0;
    this.spinAngle = 0;
    this.spinSpeed = 0;
    this.spinAxis = new THREE.Vector3(1, 0, 0);
    this.lean = 0;
    this.elapsed = 0;
    this.dash = {
      state: 'ready',
      timer: 0,
      cd: 0,
      dir: new THREE.Vector3(0, 0, 1),
    };
    this.syncMesh();
  }

  respawn(spot) {
    const y = spot.top + this.spec.body.height / 2 + 0.3;
    this.body.setTranslation({ x: spot.x, y, z: spot.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.out = false;
    this.outAt = 0;
    this.flopTimer = 0;
    this.spinAngle = 0;
    this.spinSpeed = 0;
    this.lean = 0;
    this.prevJump = false;
    this.prevDash = false;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.dash.state = 'ready';
    this.dash.cd = 0;
    this.dash.timer = 0;
    this.yaw = 0;
    this.root.visible = true;
    this.syncMesh();
  }

  hide() {
    this.root.visible = false;
    this.body.setTranslation({ x: 0, y: -80, z: 0 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.out = false;
    this.flopTimer = 0;
  }

  dispose() {
    this.world.removeRigidBody(this.body);
    this.root.parent?.remove(this.root);
  }

  flop(duration, dirX = 0, dirZ = 0) {
    if (this.out) return;
    this.flopTimer = Math.max(this.flopTimer, duration);
    this.dash.state = 'ready';
    this.dash.cd = Math.max(this.dash.cd, 0.5);
    this.lean = 0;
    if (dirX !== 0 || dirZ !== 0) {
      // Tumble around an axis perpendicular to the knock, so the body rolls
      // away from the hit instead of spinning a random way.
      this.spinAxis.set(-dirZ, 0, dirX).normalize();
      this.spinSpeed = 15 + Math.random() * 6;
    } else {
      const axis = Math.random() > 0.5 ? 1 : 0;
      if (axis === 1) this.spinAxis.set(1, 0, 0);
      else this.spinAxis.set(0, 0, 1);
      if (Math.random() > 0.5) this.spinAxis.multiplyScalar(-1);
      this.spinSpeed = 11 + Math.random() * 7;
    }
  }

  startDashSpin() {
    const style = this.spec.body.dashStyle;
    if (style === 'cartwheel') {
      this.spinAxis.set(0, 0, 1);
      this.spinSpeed = 17;
      this.lean = 0;
    } else if (style === 'tuck') {
      this.spinAxis.set(1, 0, 0);
      this.spinSpeed = 15;
      this.lean = 0;
    } else {
      this.spinAxis.set(1, 0, 0);
      this.spinSpeed = 0;
      this.lean = 0.45;
    }
    this.spinAngle = 0;
  }

  settleSpin(dt, rate) {
    const target = Math.round(this.spinAngle / TAU) * TAU;
    this.spinAngle += (target - this.spinAngle) * Math.min(1, dt * rate);
    if (Math.abs(this.spinAngle) < 0.01) this.spinAngle = 0;
  }

  update(dt, keys, elapsed) {
    this.elapsed = elapsed;
    const body = this.body;
    const t = body.translation();
    const v = body.linvel();

    if (this.out) {
      this.syncMesh();
      return;
    }

    // Vertical speed is tracked separately so the movement branches below do
    // not overwrite a jump with the velocity sampled before it was applied.
    let velY = v.y;

    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    let hit = null;
    try {
      hit = this.world.castRay(
        ray,
        this.halfHeight + this.spec.body.radius + 0.22,
        true,
        undefined,
        undefined,
        undefined,
        body
      );
    } catch (error) {
      hit = null;
    }
    this.grounded = Boolean(hit);

    if (!this.prevGrounded && this.grounded && this.prevVy < -18) {
      this.flop(0.55);
    }
    this.prevGrounded = this.grounded;
    this.prevVy = v.y;

    const c = this.controls;
    const down = (code) => keys.has(code);
    const ix = (down(c.right) ? 1 : 0) - (down(c.left) ? 1 : 0);
    const iz = (down(c.down) ? 1 : 0) - (down(c.up) ? 1 : 0);
    const hasInput = ix !== 0 || iz !== 0;
    const length = Math.hypot(ix, iz) || 1;
    const dirX = ix / length;
    const dirZ = iz / length;

    this.flopTimer = Math.max(0, this.flopTimer - dt);
    this.dash.cd = Math.max(0, this.dash.cd - dt);

    // Coyote time keeps the last grounded moment alive briefly, so a jump
    // pressed just as the feet leave a platform still counts.
    this.coyote = this.grounded ? COYOTE_TIME : Math.max(0, this.coyote - dt);

    const jumpDown = down(c.jump);
    if (jumpDown && !this.prevJump) this.jumpBuffer = JUMP_BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.prevJump = jumpDown;

    if (
      this.jumpBuffer > 0 &&
      this.coyote > 0 &&
      this.flopTimer <= 0 &&
      this.dash.state !== 'active'
    ) {
      velY = this.spec.body.jump;
      body.setLinvel({ x: v.x, y: velY, z: v.z }, true);
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpKick = 1;
    }

    const dashDown = down(c.dash);
    if (
      dashDown &&
      !this.prevDash &&
      this.grounded &&
      this.flopTimer <= 0 &&
      this.dash.state === 'ready' &&
      this.dash.cd <= 0
    ) {
      const dx = hasInput ? dirX : Math.sin(this.yaw);
      const dz = hasInput ? dirZ : Math.cos(this.yaw);
      this.dash.dir.set(dx, 0, dz).normalize();
      this.dash.state = 'windup';
      this.dash.timer = DASH.windup;
      this.yaw = Math.atan2(this.dash.dir.x, this.dash.dir.z);
    }
    this.prevDash = dashDown;
    this.jumpKick = Math.max(0, (this.jumpKick || 0) - dt * 4);

    if (this.dash.state !== 'ready') {
      this.dash.timer -= dt;
      if (this.dash.timer <= 0) {
        if (this.dash.state === 'windup') {
          this.dash.state = 'active';
          this.dash.timer = DASH.active;
          this.startDashSpin();
        } else if (this.dash.state === 'active') {
          this.dash.state = 'recover';
          this.dash.timer = DASH.recover;
        } else {
          this.dash.state = 'ready';
          this.dash.cd = DASH.cooldown;
        }
      }
    }

    if (this.flopTimer > 0) {
      const drag = Math.exp(-dt * 1.2);
      body.setLinvel({ x: v.x * drag, y: velY, z: v.z * drag }, true);
    } else if (this.dash.state === 'windup') {
      const drag = Math.exp(-dt * 7);
      body.setLinvel({ x: v.x * drag, y: velY, z: v.z * drag }, true);
    } else if (this.dash.state === 'active') {
      body.setLinvel(
        {
          x: this.dash.dir.x * this.spec.body.dashSpeed,
          y: velY,
          z: this.dash.dir.z * this.spec.body.dashSpeed,
        },
        true
      );
    } else if (this.dash.state === 'recover') {
      const drag = Math.exp(-dt * 4);
      body.setLinvel({ x: v.x * drag, y: velY, z: v.z * drag }, true);
    } else {
      const control = this.grounded ? 1 : 0.5;
      const targetX = hasInput ? dirX * this.spec.body.speed : 0;
      const targetZ = hasInput ? dirZ * this.spec.body.speed : 0;
      const k = 1 - Math.exp(-dt * this.spec.body.accel * control);
      body.setLinvel(
        {
          x: v.x + (targetX - v.x) * k,
          y: velY,
          z: v.z + (targetZ - v.z) * k,
        },
        true
      );
    }

    const speed = Math.hypot(v.x, v.z);
    if (speed > 1.2) {
      const targetYaw = Math.atan2(v.x, v.z);
      const diff = ((targetYaw - this.yaw + Math.PI * 3) % TAU) - Math.PI;
      this.yaw += diff * Math.min(1, dt * 12);
    }

    if (this.flopTimer > 0) {
      this.spinAngle += this.spinSpeed * dt;
      this.spinSpeed *= Math.max(0, 1 - dt * 1.1);
      this.lean = 0;
    } else if (this.dash.state === 'active' && this.spinSpeed > 0) {
      this.spinAngle += this.spinSpeed * dt;
    } else if (this.dash.state === 'recover' || this.dash.state === 'ready') {
      this.settleSpin(dt, this.dash.state === 'recover' ? 8 : 12);
      this.lean += (0 - this.lean) * Math.min(1, dt * 8);
    }

    if (t.y < LAVA_Y + 0.9) {
      this.out = true;
      this.outAt = elapsed;
    }

    this.syncMesh();
    this.animate(dt, speed);
  }

  syncMesh() {
    const t = this.body.translation();
    this.root.position.set(t.x, t.y, t.z);
    this.root.rotation.set(0, this.yaw, 0);
    this.spin.rotation.set(
      this.spinAngle * this.spinAxis.x + this.lean,
      0,
      this.spinAngle * this.spinAxis.z
    );
  }

  animate(dt, speed) {
    const p = this.visual.parts;
    const t = this.elapsed;
    const flail = this.flopTimer > 0;
    const dashing = this.dash.state !== 'ready';
    const air = !this.grounded && !dashing;
    const walk = Math.min(1, speed / 6.5);

    if (flail) {
      const f = t * 24;
      p.armL.rotation.x = -0.5 + Math.sin(f) * 1.95;
      p.armR.rotation.x = -0.5 + Math.sin(f + 2.2) * 1.95;
      p.armL.rotation.z = 1.2 + Math.sin(f * 1.4) * 0.5;
      p.armR.rotation.z = -1.2 + Math.cos(f * 1.2) * 0.5;
      p.legL.rotation.x = Math.sin(f * 1.3 + 1) * 1.35;
      p.legR.rotation.x = Math.cos(f * 1.5) * 1.35;
      p.head.rotation.z = Math.sin(f * 0.9) * 0.3;
      p.head.rotation.x = Math.cos(f * 0.7) * 0.2;
    } else if (dashing) {
      p.armL.rotation.x = 0;
      p.armR.rotation.x = 0;
      p.armL.rotation.z = 1.35;
      p.armR.rotation.z = -1.35;
      p.legL.rotation.x = 0.25;
      p.legR.rotation.x = -0.25;
      p.head.rotation.set(0, 0, 0);
    } else if (air) {
      p.armL.rotation.x = -1.5;
      p.armR.rotation.x = -1.5;
      p.armL.rotation.z = 0.6;
      p.armR.rotation.z = -0.6;
      p.legL.rotation.x = -0.5;
      p.legR.rotation.x = 0.4;
      p.head.rotation.set(-0.1, 0, 0);
    } else {
      const swing = Math.sin(t * 11) * 0.85 * walk;
      p.armL.rotation.x = swing;
      p.armR.rotation.x = -swing;
      p.armL.rotation.z = 0.12;
      p.armR.rotation.z = -0.12;
      p.legL.rotation.x = -swing;
      p.legR.rotation.x = swing;
      p.head.rotation.set(0, Math.sin(t * 2.4) * 0.08, Math.sin(t * 1.7) * 0.05);
    }

    if (p.ponytail) {
      p.ponytail.rotation.x = -0.25 + Math.sin(t * 7) * 0.12 + speed * 0.035;
      p.ponytail.rotation.z = Math.sin(t * 5.5) * 0.18;
    }
    if (p.mustache) {
      p.mustache.rotation.z = Math.sin(t * 8) * 0.08;
    }
  }
}
