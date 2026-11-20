/* ------------------------------------------------------------------ *
 * Camera rig
 * An angled top-down camera with mouse drag, wheel, keyboard and
 * two-finger pan/pinch. Movement is smoothed so taps do not jolt.
 * ------------------------------------------------------------------ */

import * as THREE from '../vendor/three.module.js';

export class CameraRig {
  constructor(camera, bounds) {
    this.camera = camera;
    this.bounds = bounds;
    this.target = new THREE.Vector3(bounds.cx, 0, bounds.cz);
    this.desired = this.target.clone();
    this.distance = 24;
    this.desiredDistance = 24;
    this.yaw = 0;
    this.pitch = 1.02;
    this.minDistance = 9;
    this.maxDistance = 56;
  }

  pan(dx, dy) {
    const scale = this.desiredDistance * 0.0019;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.desired.addScaledVector(right, -dx * scale);
    this.desired.addScaledVector(forward, -dy * scale);
    this.clamp();
  }

  zoom(factor) {
    this.desiredDistance = THREE.MathUtils.clamp(
      this.desiredDistance * factor,
      this.minDistance,
      this.maxDistance
    );
  }

  focus(x, z) {
    this.desired.set(x, 0, z);
    this.clamp();
  }

  /** Fit the whole map comfortably, especially in portrait. */
  frame(aspect) {
    const span = Math.max(this.bounds.w, this.bounds.h);
    const base = aspect < 1 ? 36 : 24;
    this.desiredDistance = Math.max(base, span * (aspect < 1 ? 1.15 : 0.95));
    this.desiredDistance = Math.min(this.maxDistance, this.desiredDistance);
    this.distance = this.desiredDistance;
  }

  clamp() {
    const margin = 1.5;
    this.desired.x = THREE.MathUtils.clamp(
      this.desired.x,
      margin,
      Math.max(margin, this.bounds.w - margin)
    );
    this.desired.z = THREE.MathUtils.clamp(
      this.desired.z,
      margin,
      Math.max(margin, this.bounds.h - margin)
    );
  }

  update(dt) {
    const smooth = 1 - Math.exp(-9 * dt);
    this.target.lerp(this.desired, smooth);
    this.distance += (this.desiredDistance - this.distance) * smooth;
    const horizontal = Math.cos(this.pitch) * this.distance;
    const height = Math.sin(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      height,
      this.target.z + Math.cos(this.yaw) * horizontal
    );
    this.camera.lookAt(this.target);
  }
}
