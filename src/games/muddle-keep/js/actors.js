/* ------------------------------------------------------------------ *
 * Actors and effects
 * Keeps one model per simulation entity in sync with the sim, and runs
 * a small pooled particle system for thumps, sparkles and lightning.
 * ------------------------------------------------------------------ */

import * as THREE from '../../../vendor/three.module.js';
import {
  buildCreature,
  buildHero,
  buildImp,
  creatureLevelScale,
  makeBar,
  makeShadow,
} from './models.js';

class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.rings = [];
    this.lines = [];
  }

  burst(x, z, color = '#ffd166', count = 8, spread = 1.1, life = 0.7) {
    if (this.bursts.length > 22) this.removeBurst(this.bursts.shift());
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
      velocities.push({
        x: (Math.random() - 0.5) * spread,
        y: 1.2 + Math.random() * 1.6,
        z: (Math.random() - 0.5) * spread,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.24,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.position.set(x, 0.45, z);
    this.scene.add(points);
    this.bursts.push({ points, velocities, life, maxLife: life });
  }

  ring(x, z, color = '#ffe6a8', radius = 1.8, life = 0.55) {
    const geometry = new THREE.RingGeometry(0.82, 1, 24);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.24, z);
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.rings.push({ mesh, life, maxLife: life, radius });
  }

  line(x1, z1, x2, z2, color = '#ffe08a', life = 0.16, jagged = false) {
    const points = [];
    const segments = jagged ? 7 : 1;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const jitter = jagged && i > 0 && i < segments ? (Math.random() - 0.5) * 0.7 : 0;
      points.push(
        new THREE.Vector3(
          x1 + (x2 - x1) * t + jitter,
          0.55 + (jagged ? Math.random() * 0.5 : 0),
          z1 + (z2 - z1) * t + jitter
        )
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.lines.push({ line, life, maxLife: life });
  }

  removeBurst(burst) {
    this.scene.remove(burst.points);
    burst.points.geometry.dispose();
    burst.points.material.dispose();
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const burst = this.bursts[i];
      const positions = burst.points.geometry.attributes.position.array;
      for (let p = 0; p < burst.velocities.length; p += 1) {
        const velocity = burst.velocities[p];
        velocity.y -= 6 * dt;
        positions[p * 3] += velocity.x * dt;
        positions[p * 3 + 1] += velocity.y * dt;
        positions[p * 3 + 2] += velocity.z * dt;
      }
      burst.points.geometry.attributes.position.needsUpdate = true;
      burst.life -= dt;
      burst.points.material.opacity = Math.max(0, burst.life / burst.maxLife);
      if (burst.life <= 0) {
        this.removeBurst(burst);
        this.bursts.splice(i, 1);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      ring.life -= dt;
      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar(0.4 + progress * ring.radius);
      ring.mesh.material.opacity = Math.max(0, 0.9 * (1 - progress));
      if (ring.life <= 0) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.lines.length - 1; i >= 0; i -= 1) {
      const line = this.lines[i];
      line.life -= dt;
      line.line.material.opacity = Math.max(0, line.life / line.maxLife);
      if (line.life <= 0) {
        this.scene.remove(line.line);
        line.line.geometry.dispose();
        line.line.material.dispose();
        this.lines.splice(i, 1);
      }
    }
  }
}

export class ActorLayer {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.effects = new Effects(this.scene);
    this.actors = [];
    this.byEntity = new Map();
  }

  clear() {
    for (const actor of this.actors) this.removeActor(actor);
    this.actors = [];
    this.byEntity.clear();
  }

  removeActor(actor) {
    this.scene.remove(actor.group);
    this.scene.remove(actor.bar.group);
    this.scene.remove(actor.shadow);
    if (actor.ring) this.scene.remove(actor.ring);
  }

  addActor(entity, kind, def) {
    const level = kind === 'creature' ? Math.max(1, Number(entity.level) || 1) : 1;
    const group =
      kind === 'creature'
        ? buildCreature(def, level)
        : kind === 'imp'
          ? buildImp()
          : buildHero(def);
    const baseScale = def?.boss ? 1.55 : 1;
    const levelScale = kind === 'creature' ? creatureLevelScale(level) : 1;
    group.scale.setScalar(baseScale * levelScale);
    group.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    this.scene.add(group);
    const bar = makeBar(kind === 'hero' ? 0.72 : 0.56);
    bar.group.visible = false;
    this.scene.add(bar.group);
    const shadowBase =
      kind === 'imp' ? 0.22 : def?.boss ? 0.66 : (def?.size ?? 0.3) * 1.2;
    const shadow = makeShadow(shadowBase);
    // Intruders get a red ring so they can never be mistaken for your lot.
    let ring = null;
    if (kind === 'hero') {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.54, 24),
        new THREE.MeshBasicMaterial({
          color: '#ff3b5c',
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      this.scene.add(ring);
    }
    if (kind === 'creature') {
      const shadowScale = shadowBase * levelScale;
      shadow.scale.set(shadowScale, shadowScale, 1);
    }
    shadow.position.y = 0.035;
    this.scene.add(shadow);
    const actor = {
      entity,
      kind,
      def,
      level,
      baseScale,
      shadowBase,
      group,
      bar,
      shadow,
      ring,
      baseY: def?.id === 'wisp' ? 0.3 : 0,
      height: kind === 'hero' ? 1.9 : kind === 'creature' ? group.userData.height ?? 1.15 : 1.15,
    };
    this.actors.push(actor);
    this.byEntity.set(entity, actor);
    return actor;
  }

  /** Creature gear changes with level, so rebuild its model on level-up. */
  relevelActor(actor, entity) {
    const level = Math.max(1, Number(entity.level) || 1);
    const group = buildCreature(actor.def, level);
    group.position.copy(actor.group.position);
    group.rotation.copy(actor.group.rotation);
    group.scale.copy(actor.group.scale);
    group.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    this.scene.remove(actor.group);
    this.scene.add(group);
    actor.group = group;
    actor.level = level;
    actor.height = group.userData.height ?? 1.15;
  }

  sync(game, camera, dt) {
    const aliveCreatures = new Set(game.creatures.list);
    const aliveHeroes = new Set(game.heroes.list);
    const aliveImps = new Set(game.imps.imps);

    for (const actor of this.actors) {
      const entity = actor.entity;
      const alive =
        actor.kind === 'creature'
          ? aliveCreatures.has(entity)
          : actor.kind === 'hero'
            ? aliveHeroes.has(entity)
            : aliveImps.has(entity);
      if (!alive) {
        this.removeActor(actor);
        this.byEntity.delete(entity);
        actor.removed = true;
        continue;
      }

      const entityLevel =
        actor.kind === 'creature' ? Math.max(1, Number(entity.level) || 1) : 1;
      if (actor.kind === 'creature' && actor.level !== entityLevel) {
        this.relevelActor(actor, entity);
      }
      const levelScale = actor.kind === 'creature' ? creatureLevelScale(entityLevel) : 1;
      const visualScale = actor.baseScale * levelScale;

      const bob = Math.sin(entity.anim ?? 0) * 0.08;
      let y = actor.baseY + bob;
      if (entity.carried) y = 1.4 + bob * 0.6;
      if (actor.kind === 'hero' && entity.stun > 0) y = 0.1;
      if (actor.kind === 'creature' && (entity.slapHop ?? 0) > 0) {
        const hop = 1 - Math.min(1, entity.slapHop);
        y += Math.sin(hop * Math.PI) * 0.2;
      }

      actor.group.position.set(entity.x, y, entity.y);
      actor.group.rotation.y = entity.facing ?? 0;

      if (actor.group.userData.wings) {
        actor.group.userData.wings.forEach((wing, index) => {
          wing.rotation.z = Math.sin((entity.anim ?? 0) * 2 + index) * 0.55;
        });
      }

      actor.shadow.position.set(entity.x, 0.035, entity.y);
      if (actor.ring) actor.ring.position.set(entity.x, 0.05, entity.y);
      if (actor.kind === 'creature') {
        const shadowScale = actor.shadowBase * levelScale;
        actor.shadow.scale.set(shadowScale, shadowScale, 1);
      }
      const hurt = (entity.hurtFlash ?? 0) > 0;
      actor.group.scale.setScalar(visualScale * (hurt ? 1.18 : 1));

      const ratio = Math.max(0, Math.min(1, entity.hp / (entity.maxHp || entity.hp || 1)));
      const showBar =
        actor.kind === 'hero' ? true : ratio < 0.999 || Boolean(entity.target);
      actor.bar.group.visible = showBar;
      if (showBar) {
        actor.bar.group.position.set(entity.x, y + actor.height * visualScale, entity.y);
        actor.bar.group.quaternion.copy(camera.quaternion);
        actor.bar.fill.scale.x = actor.bar.width * 0.94 * ratio;
        actor.bar.fill.position.x = -(actor.bar.width * 0.94 * (1 - ratio)) / 2;
        const color = ratio > 0.55 ? '#7ddc6a' : ratio > 0.28 ? '#ffd166' : '#ff5a6e';
        actor.bar.fill.material.color.set(color);
      }
    }
    this.actors = this.actors.filter((actor) => !actor.removed);

    for (const creature of aliveCreatures) {
      if (!this.byEntity.has(creature)) this.addActor(creature, 'creature', creature.def);
    }
    for (const hero of aliveHeroes) {
      if (!this.byEntity.has(hero)) this.addActor(hero, 'hero', hero.def);
    }
    for (const imp of aliveImps) {
      if (!this.byEntity.has(imp)) this.addActor(imp, 'imp', null);
    }

    this.effects.update(dt);
  }

  /** Turn a simulation event into a visual flourish. */
  handle(event) {
    const at = (x, y) => [x + 0.5, y + 0.5];
    switch (event.type) {
      case 'imp-work':
        this.effects.burst(event.x, event.y, '#d8b48a', 3, 0.35, 0.4);
        break;
      case 'dig': {
        const [x, z] = at(event.x, event.y);
        this.effects.burst(x, z, event.gold ? '#ffd166' : '#a97a52', event.gold ? 18 : 10, 1.2, 0.9);
        break;
      }
      case 'deposit':
      case 'gold': {
        const [x, z] = at(event.x ?? 0, event.y ?? 0);
        this.effects.burst(x, z, '#ffe08a', 14, 0.8, 0.8);
        break;
      }
      case 'room': {
        const [x, z] = at(event.x, event.y);
        this.effects.ring(x, z, '#ffe6a8', 1.4, 0.45);
        break;
      }
      case 'spawn':
        this.effects.ring(event.x, event.y, '#d46ae0', 2, 0.8);
        break;
      case 'attack':
        this.effects.line(
          event.fromX,
          event.fromY,
          event.toX,
          event.toY,
          event.friendly ? '#ffd166' : '#ff8fa3',
          0.22
        );
        break;
      case 'lightning':
        this.effects.line(event.x1, event.y1, event.x2, event.y2, '#9fe8ff', 0.3, true);
        break;
      case 'zap': {
        const [x, z] = at(event.x, event.y);
        this.effects.ring(x, z, '#9fe8ff', (event.radius ?? 2) * 1.2, 0.5);
        this.effects.burst(x, z, '#c9f2ff', 16, 1.8, 0.6);
        break;
      }
      case 'heal':
        this.effects.burst(event.x, event.y, '#9ef7c9', 8, 0.7, 0.7);
        break;
      case 'haste':
        this.effects.burst(event.x, event.y, '#ffe08a', 5, 0.6, 0.4);
        break;
      case 'rally':
        this.effects.ring(event.x + 0.5, event.y + 0.5, '#ffb35c', 3.4, 0.6);
        break;
      case 'slap': {
        const [x, z] = at(event.x, event.y);
        this.effects.ring(x, z, '#ffc9dd', 2.2, 0.5);
        break;
      }
      case 'slap-hit':
        this.effects.ring(event.x, event.y, '#ffc9dd', 1.2, 0.4);
        this.effects.burst(event.x, event.y, '#ffe6a8', 10, 0.8, 0.5);
        break;
      case 'trap': {
        const [x, z] = at(event.x, event.y);
        this.effects.burst(x, z, '#ffd166', 10, 1.1);
        break;
      }
      case 'creature-died':
        this.effects.burst(event.x, event.y, '#b58cff', 20, 1.6, 1);
        break;
      case 'hero-died':
        this.effects.burst(event.x, event.y, '#ffe08a', 26, 1.8, 1.1);
        if (event.boss) this.effects.ring(event.x, event.y, '#ffd166', 4, 1);
        break;
      case 'levelup':
        this.effects.ring(event.x, event.y, '#ffd166', 1.6, 0.7);
        this.effects.burst(event.x, event.y, '#ffe6a8', 10, 1, 0.7);
        break;
      case 'train':
        // Training had no visual at all — a training monster looked
        // exactly like a wandering one. A little gold sparkle every
        // beat, so working out reads as working out.
        this.effects.burst(event.x, event.y, '#ffd166', 5, 0.6, 0.5);
        break;
      case 'stomp':
        this.effects.ring(event.x, event.y, '#ff8fa3', 3, 0.5);
        this.effects.burst(event.x, event.y, '#c9b8a8', 12, 2, 0.6);
        break;
      case 'heart-hit':
        this.effects.burst(event.x + 0.5, event.y + 0.5, '#ff5a6e', 20, 1.4, 0.9);
        break;
      case 'wall-hit':
      case 'dirt-hit': {
        const [x, z] = at(event.x, event.y);
        this.effects.burst(x, z, '#b8a89a', 3, 0.5, 0.35);
        break;
      }
      case 'wall-broken': {
        const [x, z] = at(event.x, event.y);
        this.effects.burst(x, z, '#c9c3d6', 12, 1.3, 0.7);
        break;
      }
      case 'eat':
        this.effects.burst(event.x, event.y, '#8fd08a', 4, 0.5, 0.4);
        break;
      case 'pickup':
        this.effects.ring(event.x, event.y, '#ffe6a8', 1, 0.3);
        break;
      case 'sell': {
        const [x, z] = at(event.x, event.y);
        this.effects.burst(x, z, '#c9c3d6', 6, 0.8, 0.5);
        break;
      }
      default:
        break;
    }
  }
}
