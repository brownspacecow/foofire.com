/* ------------------------------------------------------------------ *
 * Input
 * Keyboard, touch buttons and gamepads all describe the same small set
 * of actions, so the game never cares what the player is holding.
 * ------------------------------------------------------------------ */

const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyE: 'action',
  Space: 'action',
  Enter: 'next',
  Tab: 'swap',
  KeyQ: 'swap',
  ShiftLeft: 'investigate',
  ShiftRight: 'investigate',
  KeyF: 'investigate',
  Escape: 'pause',
  KeyP: 'pause',
  Digit1: 'choice1',
  Digit2: 'choice2',
  Digit3: 'choice3',
  Digit4: 'choice4',
  Numpad1: 'choice1',
  Numpad2: 'choice2',
  Numpad3: 'choice3',
  Numpad4: 'choice4',
};

const GAMEPAD_BUTTONS = {
  0: 'action',
  1: 'pause',
  2: 'swap',
  3: 'investigate',
  4: 'swap',
  5: 'swap',
  6: 'investigate',
  9: 'pause',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.gamepadDown = new Set();
    this.gamepadPressed = new Set();
    this.gamepadMove = { x: 0, y: 0 };
    this.gamepadConnected = false;
    this.enabled = true;
    /* Menus let Tab move focus; gameplay captures it for the kid swap. */
    this.captureTab = true;
    this.lastDevice = 'keyboard';

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.reset());
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

    const action = KEY_MAP[event.code];
    if (!action) return;

    this.lastDevice = 'keyboard';
    if (
      (event.code === 'Tab' && this.captureTab) ||
      event.code === 'Space' ||
      event.code.startsWith('Arrow')
    ) {
      event.preventDefault();
    }

    if (!this.down.has(action)) this.pressed.add(action);
    this.down.add(action);
  }

  onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    this.down.delete(action);
    this.released.add(action);
  }

  reset() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.gamepadDown.clear();
    this.gamepadPressed.clear();
  }

  /* Called once per frame before the scene updates. */
  poll() {
    if (!this.enabled) return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((entry) => entry && entry.connected);
    if (!pad) {
      if (this.gamepadConnected) this.gamepadConnected = false;
      this.gamepadMove.x = 0;
      this.gamepadMove.y = 0;
      return;
    }

    this.gamepadConnected = true;
    const deadzone = 0.24;
    const axisX = Math.abs(pad.axes[0] ?? 0) > deadzone ? pad.axes[0] : 0;
    const axisY = Math.abs(pad.axes[1] ?? 0) > deadzone ? pad.axes[1] : 0;
    this.gamepadMove.x = axisX;
    this.gamepadMove.y = axisY;

    if (axisX || axisY) this.lastDevice = 'gamepad';

    const held = new Set();
    pad.buttons.forEach((button, index) => {
      const action = GAMEPAD_BUTTONS[index];
      if (!action) return;
      if (button.pressed || button.value > 0.5) held.add(action);
    });

    held.forEach((action) => {
      if (!this.gamepadDown.has(action)) this.gamepadPressed.add(action);
    });
    this.gamepadDown = held;
  }

  isDown(action) {
    return this.down.has(action) || this.gamepadDown.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action) || this.gamepadPressed.has(action);
  }

  /** Consume a press so a single tap does not trigger twice. */
  take(action) {
    const has = this.wasPressed(action);
    this.pressed.delete(action);
    this.gamepadPressed.delete(action);
    return has;
  }

  endFrame() {
    this.pressed.clear();
    this.gamepadPressed.clear();
    this.released.clear();
  }

  /** Movement vector in screen space, already clamped to length one. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;

    x += this.gamepadMove.x;
    y += this.gamepadMove.y;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }
}
