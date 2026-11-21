/* ------------------------------------------------------------------ *
 * Tutorial
 * Level-specific tips that advance as the player actually does the
 * thing. Out-of-order actions are remembered so a step never blocks.
 * ------------------------------------------------------------------ */

export class Tutorial {
  constructor(ui) {
    this.ui = ui;
    this.steps = [];
    this.index = -1;
    this.age = 0;
    this.completed = new Set();
  }

  start(game) {
    this.steps = Array.isArray(game?.level.tutorial) ? game.level.tutorial : [];
    this.completed = new Set();
    this.index = -1;
    this.age = 0;
    if (!this.steps.length) {
      this.hide();
      return;
    }
    this.show(0);
  }

  triggerFor(event) {
    if (event.type === 'dig') return 'dug';
    if (event.type === 'wave') return 'wave';
    if (event.type === 'trap-built') return 'trap';
    if (event.type === 'research') return 'research';
    if (event.type === 'room') return `room:${event.id}`;
    return null;
  }

  show(index) {
    if (!this.steps.length) {
      this.hide();
      return;
    }
    let next = index;
    while (next < this.steps.length) {
      const trigger = this.steps[next].when;
      if (trigger === 'start') break;
      const done =
        this.completed.has(trigger) ||
        (trigger === 'room' && this.completed.has('room'));
      if (!done) break;
      next += 1;
    }
    const step = this.steps[next];
    if (!step) {
      this.hide();
      return;
    }
    this.index = next;
    this.age = 0;
    this.ui.el['tip-text'].textContent = step.text;
    this.ui.el.tip.hidden = false;
  }

  hide() {
    this.index = -1;
    this.ui.el.tip.hidden = true;
  }

  advance() {
    if (!this.steps.length) return;
    this.show(this.index + 1);
  }

  handle(event) {
    const key = this.triggerFor(event);
    if (key) {
      this.completed.add(key);
      if (key.startsWith('room:')) this.completed.add('room');
    }
    if (this.index < 0 || !key) return;
    const step = this.steps[this.index];
    if (!step) return;
    const matches =
      step.when === key ||
      (step.when === 'room' && key.startsWith('room:')) ||
      (step.when.startsWith('room:') && key === step.when);
    if (matches) this.advance();
  }

  update(dt) {
    if (this.index < 0) return;
    this.age += dt;
    // Only the welcome card times out. Action tips wait for the player (or stay
    // dismissed with the Got it button), so they cannot run away mid-read.
    const step = this.steps[this.index];
    if (step?.when === 'start' && this.age > 12) this.advance();
  }
}
