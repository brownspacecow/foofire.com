/* ------------------------------------------------------------------ *
 * Siblings
 * Jira and Joel both walk the level. One is controlled at a time and
 * the other follows, which keeps the "family vacation" feeling and lets
 * the swap ability read on screen.
 * ------------------------------------------------------------------ */

import * as THREE from 'three';
import { animateCharacter, makeKid } from './models.js?v=2';

const KID_SPEED = { jira: 5.4, joel: 6.2 };

export class Siblings {
  constructor(scene) {
    this.jira = makeKid('jira');
    this.joel = makeKid('joel');
    this.active = 'jira';
    this.investigating = false;
    this.elapsed = 0;

    this.jira.position.set(-1.3, 0, 1.8);
    this.joel.position.set(1.2, 0, 2.1);
    this.jira.userData.badge.visible = true;
    scene.add(this.jira);
    scene.add(this.joel);

    this.cameraYaw = 0;
    this.cameraDistance = 12.5;
    this.cameraHeight = 8.4;
    this.dragCooldown = 0;

    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.shadows = new THREE.Group();
    [this.jira, this.joel].forEach((kid) => {
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      shadow.userData.kid = kid;
      this.shadows.add(shadow);
    });
    scene.add(this.shadows);

    this.heading = 0;
  }

  get activeKid() {
    return this.active === 'jira' ? this.jira : this.joel;
  }

  get follower() {
    return this.active === 'jira' ? this.joel : this.jira;
  }

  get position() {
    return this.activeKid.position;
  }

  swap() {
    if (this.switching) return false;
    this.switching = 0.35;
    this.active = this.active === 'jira' ? 'joel' : 'jira';
    this.activeKid.userData.badge.visible = true;
    this.follower.userData.badge.visible = false;
    this.investigating = false;
    return true;
  }

  setInvestigating(on) {
    this.investigating = Boolean(on) && this.active === 'jira';
    return this.investigating;
  }

  teleport(x, z) {
    this.activeKid.position.set(x, 0, z);
    this.follower.position.set(x + 1.2, 0, z + 1.2);
  }

  collide(x, z, colliders, bounds) {
    let px = x;
    let pz = z;
    const margin = 0.9;

    px = Math.min(bounds.maxX - margin, Math.max(bounds.minX + margin, px));
    pz = Math.min(bounds.maxZ - margin, Math.max(bounds.minZ + margin, pz));

    colliders.forEach((collider) => {
      const minimum = collider.r + 0.45;
      const dx = px - collider.x;
      const dz = pz - collider.z;
      const length = Math.hypot(dx, dz);
      if (length < minimum && length > 0.0001) {
        px = collider.x + (dx / length) * minimum;
        pz = collider.z + (dz / length) * minimum;
      } else if (length <= 0.0001) {
        px = collider.x + minimum;
      }
    });

    return { x: px, z: pz };
  }

  update(dt, move, { colliders, bounds, reducedMotion, camera, orbitDelta = 0, zoomDelta = 0 }) {
    this.elapsed += dt;
    if (this.switching) this.switching = Math.max(0, this.switching - dt);

    const kid = this.activeKid;
    const speed = KID_SPEED[this.active] * (this.investigating ? 0.52 : 1);

    if (orbitDelta) {
      this.cameraYaw += orbitDelta;
      this.dragCooldown = 1.4;
    }
    this.dragCooldown = Math.max(0, this.dragCooldown - dt);
    if (zoomDelta) {
      this.cameraDistance = Math.min(18, Math.max(8, this.cameraDistance + zoomDelta));
    }

    // Movement is camera relative: W walks away from the camera.
    const forwardX = -Math.sin(this.cameraYaw);
    const forwardZ = -Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);

    const vx = forwardX * -move.y + rightX * move.x;
    const vz = forwardZ * -move.y + rightZ * move.x;
    const length = Math.hypot(vx, vz);
    const moving = length > 0.05;

    let nextX = kid.position.x;
    let nextZ = kid.position.z;

    if (moving) {
      const step = Math.min(1, length) * speed * dt;
      nextX += (vx / (length || 1)) * step;
      nextZ += (vz / (length || 1)) * step;
      this.heading = Math.atan2(vx, vz);

      // Turn the camera gently behind a forward walk, unless the player is dragging.
      // Backing up must not flip the camera, or camera-relative S would spiral.
      if (this.dragCooldown <= 0 && move.y < -0.2) {
        const desired = Math.atan2(-vx, -vz);
        let difference = desired - this.cameraYaw;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        this.cameraYaw += difference * Math.min(1, dt * 0.9);
      }
    }

    const resolved = this.collide(nextX, nextZ, colliders, bounds);
    kid.position.set(resolved.x, 0, resolved.z);

    // Face the direction of travel.
    const targetRotation = moving ? this.heading : kid.rotation.y;
    let rotationDifference = targetRotation - kid.rotation.y;
    while (rotationDifference > Math.PI) rotationDifference -= Math.PI * 2;
    while (rotationDifference < -Math.PI) rotationDifference += Math.PI * 2;
    kid.rotation.y += rotationDifference * Math.min(1, dt * 12);

    animateCharacter(kid, this.elapsed, moving ? speed * Math.min(1, length) : 0.4, this.investigating);

    // The other sibling trails behind, staying out of the camera's way.
    const followDistance = 2.4;
    const followX = resolved.x + Math.sin(this.heading + 2.4) * followDistance;
    const followZ = resolved.z + Math.cos(this.heading + 2.4) * followDistance;
    const companion = this.follower;
    const toX = followX - companion.position.x;
    const toZ = followZ - companion.position.z;
    const gap = Math.hypot(toX, toZ);

    if (gap > 0.7) {
      const pace = Math.min(speed * 1.15, gap * 3.4);
      const stepX = (toX / gap) * pace * dt;
      const stepZ = (toZ / gap) * pace * dt;
      const companionTarget = this.collide(companion.position.x + stepX, companion.position.z + stepZ, colliders, bounds);
      companion.position.set(companionTarget.x, 0, companionTarget.z);
      companion.rotation.y = Math.atan2(toX, toZ);
      animateCharacter(companion, this.elapsed, gap > 4 ? pace : 0.6);
    } else {
      animateCharacter(companion, this.elapsed, 0.3);
    }

    // Contact shadows.
    this.shadows.children.forEach((shadow) => {
      shadow.position.set(shadow.userData.kid.position.x, 0.02, shadow.userData.kid.position.z);
    });

    if (camera) {
      /* Tall, narrow screens need to pull back or the kids fill the frame. */
      const aspect = camera.aspect || 1.6;
      const framing = aspect < 1 ? 1.45 : aspect < 1.35 ? 1.2 : 1;
      const distance = this.cameraDistance * framing;
      const targetX = kid.position.x + Math.sin(this.cameraYaw) * distance;
      const targetZ = kid.position.z + Math.cos(this.cameraYaw) * distance;
      const targetY = this.cameraHeight * (aspect < 1 ? 1.16 : 1) + (this.investigating ? 1.6 : 0);

      const lerp = reducedMotion ? 1 : Math.min(1, dt * 4.2);
      camera.position.x += (targetX - camera.position.x) * lerp;
      camera.position.z += (targetZ - camera.position.z) * lerp;
      camera.position.y += (targetY - camera.position.y) * lerp;
      camera.lookAt(kid.position.x, 1.3, kid.position.z);
    }

    return { moving, speed: moving ? speed : 0 };
  }
}

/** Cinematic camera that slowly circles a point of interest. */
export function updateCinematicCamera(camera, focus, time, speed = 0.16) {
  const radius = 17;
  const angle = time * speed;
  camera.position.set(focus.x + Math.sin(angle) * radius, 9.5, focus.z + Math.cos(angle) * radius + 6);
  camera.lookAt(focus.x, focus.y, focus.z);
}

export function updateTitleCamera(camera, focus, time) {
  const radius = 20;
  const angle = time * 0.075;
  camera.position.set(focus.x + Math.sin(angle) * radius, 10.5, focus.z + Math.cos(angle) * radius + 8);
  camera.lookAt(focus.x, 3, focus.z);
}
