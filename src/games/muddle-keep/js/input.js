/* ------------------------------------------------------------------ *
 * Input
 * Mouse, touch and keyboard all describe the same handful of actions.
 * One finger paints or taps, two fingers pan and pinch, wheel zooms.
 * The camera can also be nudged with the arrow keys.
 * ------------------------------------------------------------------ */

const PAINT_TOOLS = new Set(['dig', 'room', 'trap', 'wall', 'sell']);
const TAP_TOOLS = new Set(['hand', 'slap', 'spell']);

export function setupInput({ getGame, renderer, rig, ui, getMenus, onPause, onZoom, onFullscreen, onSpeed }) {
  const canvas = renderer.domElement;
  const pointers = new Map();
  let mode = 'idle';
  let start = null;
  let moved = false;
  let lastPinch = null;
  let lastMid = null;
  let digMode = 'add';

  const apply = (clientX, clientY, game, options) => {
    const tile = renderer.tileAt(clientX, clientY);
    if (!tile) return;
    const result = game.applyTool(tile.x, tile.y, options);
    // game.error() already toasted this via the 'error' event; don't toast twice.
    if (result?.message && !result.emitted) ui.toast(result.message, 'warn');
  };

  const beginPaint = (clientX, clientY, game) => {
    const tile = renderer.tileAt(clientX, clientY);
    if (!tile) return;
    const existing = game.tasks.tasks.get(game.world.idx(tile.x, tile.y));
    const planned = existing?.kind === 'dig' || existing?.kind === 'mine';
    digMode = game.tool?.type === 'dig' && planned ? 'remove' : 'add';
    apply(clientX, clientY, game, { digMode });
    start = { x: clientX, y: clientY, tile };
    mode = 'paint';
    moved = false;
  };

  canvas.addEventListener('pointerdown', (event) => {
    renderer.domElement.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    digMode = 'add';
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      mode = 'gesture';
      return;
    }
    if (pointers.size > 2) return;

    const menus = getMenus();
    if (menus?.open) return;
    const game = getGame();
    if (!game) return;

    if (event.button === 1 || event.button === 2 || event.shiftKey) {
      mode = 'pan';
      start = { x: event.clientX, y: event.clientY };
      moved = false;
      return;
    }

    start = { x: event.clientX, y: event.clientY };
    moved = false;
    const tool = game.tool?.type;
    if (game.handCreature || game.handGate) {
      mode = 'carry';
      return;
    }
    if (PAINT_TOOLS.has(tool)) beginPaint(event.clientX, event.clientY, game);
    else if (TAP_TOOLS.has(tool)) mode = 'tap';
    else mode = 'pan';
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const game = getGame();

    if (mode === 'gesture' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastPinch && distance > 0) rig.zoom(lastPinch / distance);
      if (lastMid) rig.pan(mid.x - lastMid.x, mid.y - lastMid.y);
      lastPinch = distance;
      lastMid = mid;
      return;
    }

    if (!start) {
      if (event.pointerType === 'mouse' && game) {
        const tile = renderer.tileAt(event.clientX, event.clientY);
        renderer.setCursor(tile, true, Boolean(tile));
      }
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 7) moved = true;

    if (mode === 'paint' && moved && game) {
      apply(event.clientX, event.clientY, game, { digMode });
      return;
    }
    if (mode === 'carry' && game) {
      const tile = renderer.tileAt(event.clientX, event.clientY);
      if (tile) game.updateCarriedCreature(tile.x, tile.y);
      return;
    }
    if (mode === 'pan' && moved) {
      rig.pan(dx, dy);
      start = { x: event.clientX, y: event.clientY };
      return;
    }
    if (mode === 'tap' && moved) {
      mode = 'pan';
      rig.pan(dx, dy);
      start = { x: event.clientX, y: event.clientY };
    }
  });

  const finish = (event) => {
    const wasMode = mode;
    const downStart = start;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      lastPinch = null;
      lastMid = null;
    }
    if (pointers.size === 0) {
      mode = 'idle';
      digMode = 'add';
      start = null;
      if (wasMode === 'tap' && !moved && downStart) {
        const game = getGame();
        if (game) apply(event.clientX, event.clientY, game);
      }
      if (wasMode === 'carry') {
        const game = getGame();
        if (game) apply(event.clientX, event.clientY, game);
      }
    }
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  canvas.addEventListener('pointerleave', () => {
    renderer.setCursor(null, true, false);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const menus = getMenus();
      if (menus?.open) return;
      rig.zoom(event.deltaY > 0 ? 1.08 : 0.92);
      onZoom?.();
    },
    { passive: false }
  );

  const isTyping = () => {
    const element = document.activeElement;
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    );
  };

  const panKeys = new Set();
  window.addEventListener('keydown', (event) => {
    if (isTyping()) return;
    const menus = getMenus();
    const game = getGame();
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.code === 'Escape' || event.code === 'KeyP' || event.code === 'Space') {
      event.preventDefault();
      onPause?.();
      return;
    }
    if (event.code === 'KeyF') {
      event.preventDefault();
      onFullscreen?.();
      return;
    }
    if (menus?.open) return;
    if (!game) return;

    if (event.code === 'KeyH') {
      ui.toggleHelp();
      return;
    }
    if (event.code === 'KeyT') {
      if (!event.repeat) ui.toggleTimeStop();
      return;
    }
    if (event.code === 'KeyX') {
      if (!event.repeat) onSpeed?.();
      return;
    }
    if (event.code === 'Equal' || event.code === 'NumpadAdd') {
      rig.zoom(0.9);
      return;
    }
    if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
      rig.zoom(1.1);
      return;
    }
    if (event.code.startsWith('Arrow')) {
      panKeys.add(event.code);
      event.preventDefault();
      return;
    }

    const toolIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'].indexOf(
      event.code
    );
    if (toolIndex >= 0) {
      ui.pickToolIndex(toolIndex);
      return;
    }
    const spellIndex = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'].indexOf(event.code);
    if (spellIndex >= 0) {
      ui.pickSpellIndex(spellIndex);
    }
  });

  window.addEventListener('keyup', (event) => {
    panKeys.delete(event.code);
  });

  // Keep arrow-key panning smooth without a separate animation loop.
  window.setInterval(() => {
    if (!panKeys.size) return;
    if (getMenus()?.open) return;
    const speed = 26;
    let dx = 0;
    let dy = 0;
    if (panKeys.has('ArrowLeft')) dx += speed;
    if (panKeys.has('ArrowRight')) dx -= speed;
    if (panKeys.has('ArrowUp')) dy += speed;
    if (panKeys.has('ArrowDown')) dy -= speed;
    if (dx || dy) rig.pan(dx, dy);
  }, 40);
}
