/* ------------------------------------------------------------------ *
 * HUD and tools
 * Gold, mana, food, creatures, imps, the Heart bar, the wave clock, the
 * research bar and the tool belt. Sheets and the tutorial live in
 * sheets.js and tutorial.js.
 * ------------------------------------------------------------------ */

import { closeSheet, openCreatureSheet, openRoomSheet, openSheet, openTrapSheet } from './sheets.js';
import { Tutorial } from './tutorial.js';

const TOOLS = [
  { id: 'dig', label: 'Dig', icon: '⛏️', hint: 'Drag to plan a tunnel. Gold seams never run out. Tap planned tiles again to un-plan.' },
  { id: 'room', label: 'Rooms', icon: '🏠', hint: 'Pick a room, then paint floor.' },
  { id: 'wall', label: 'Wall', icon: '🧱', hint: 'Drag on floor to raise a wall (4 gold).' },
  { id: 'trap', label: 'Traps', icon: '🪤', hint: 'Pick a trap, then tap a floor tile.' },
  { id: 'sell', label: 'Sell', icon: '🧹', hint: 'Tap a room, wall, trap or marked tile to undo it.' },
  { id: 'hand', label: 'Hand', icon: '🖐️', hint: 'Tap a creature to pick it up; tap floor to drop it.' },
  { id: 'slap', label: 'Slap', icon: '👋', hint: 'Tap near creatures to shove them back and speed up their work.' },
];

const SPELL_KEYS = ['Q', 'W', 'E', 'R'];

export class GameUI {
  constructor(root, options) {
    this.root = root;
    this.content = options.content;
    this.options = options;
    this.game = null;
    this.activeTool = 'dig';
    this.selection = { room: null, trap: null };
    this.last = 0;
    this.tutorial = new Tutorial(this);
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="mk-hud">
        <header class="mk-top">
          <div class="mk-title">
            <span class="mk-kicker" data-el="kicker">Endless run</span>
            <strong data-el="level">Survive the longest wave</strong>
          </div>
          <div class="mk-resources">
            <span class="mk-chip gold" title="Gold"><span aria-hidden="true">💰</span><b data-el="gold">0</b></span>
            <span class="mk-chip mana" title="Mana"><span aria-hidden="true">🔮</span><b data-el="mana">0</b></span>
            <span class="mk-chip food" title="Food"><span aria-hidden="true">🍄</span><b data-el="food">0</b></span>
            <span class="mk-chip beasts" title="Creatures"><span aria-hidden="true">👾</span><b data-el="creatures">0</b><i>/</i><span data-el="cap">0</span></span>
            <span class="mk-chip imps" title="Imps"><span aria-hidden="true">⛏️</span><b data-el="imps">0</b></span>
          </div>
          <div class="mk-top-actions">
            <button type="button" data-act="creatures" aria-label="Creature list">👾<span>Creatures</span></button>
            <button type="button" data-act="time" data-el="time" aria-label="Stop time" aria-pressed="false"><i data-el="time-icon" aria-hidden="true">⏳</i><span data-el="time-label">Time</span></button>
            <button type="button" data-act="zoom-out" aria-label="Zoom out">−</button>
            <button type="button" data-act="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-act="zoom-reset" aria-label="Reset camera">⟲</button>
            <button type="button" data-act="help" aria-label="How to play">?</button>
            <button type="button" data-act="pause" aria-label="Pause">❚❚</button>
          </div>
        </header>

        <div class="mk-heart">
          <span class="mk-heart-label">Heart</span>
          <div class="mk-heart-track" role="progressbar" aria-label="Dungeon Heart" aria-valuemin="0" aria-valuemax="100" data-el="heart-track">
            <i data-el="heart-fill"></i>
          </div>
          <b data-el="heart-text">0</b>
        </div>

        <div class="mk-wave" data-el="wave" aria-live="polite"></div>

        <div class="mk-time-banner" data-el="time-banner" role="status" aria-live="polite" hidden>
          <span aria-hidden="true">⏳</span> Time stopped — plan and build freely.
        </div>

        <div class="mk-research" data-el="research" hidden>
          <span data-el="research-label">Research</span>
          <div class="mk-research-track"><i data-el="research-fill"></i></div>
        </div>

        <div class="mk-toasts" data-el="toasts" aria-live="polite"></div>

        <div class="mk-tip" data-el="tip" hidden>
          <p data-el="tip-text"></p>
          <button type="button" data-act="tip-next">Got it</button>
          <button type="button" data-act="tip-dismiss" aria-label="Hide all tips">✕</button>
        </div>

        <div class="mk-bottom">
          <div class="mk-toolbelt">
            <div class="mk-tools" data-el="tools"></div>
            <div class="mk-spells" data-el="spells"></div>
          </div>
          <p class="mk-tool-hint" data-el="hint"></p>
          <p class="mk-keys">Space pause · 1–7 tools · Q/W/E/R spells · wheel or + / − to zoom</p>
        </div>
      </div>
      <div class="mk-sheet" data-el="sheet" hidden>
        <div class="mk-sheet-card" role="dialog" aria-modal="false">
          <header>
            <h2 data-el="sheet-title">Rooms</h2>
            <button type="button" data-act="sheet-close" aria-label="Close">✕</button>
          </header>
          <p class="mk-sheet-note" data-el="sheet-note"></p>
          <div class="mk-sheet-grid" data-el="sheet-grid"></div>
        </div>
      </div>
    `;

    const el = {};
    this.root.querySelectorAll('[data-el]').forEach((node) => {
      el[node.dataset.el] = node;
    });
    this.el = el;

    this.root.querySelectorAll('[data-act]').forEach((button) => {
      button.addEventListener('click', () => this.action(button.dataset.act));
    });

    this.toolButtons = new Map();
    for (const tool of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mk-tool';
      button.dataset.tool = tool.id;
      button.innerHTML = `<span class="mk-tool-icon" aria-hidden="true">${tool.icon}</span><span class="mk-tool-label">${tool.label}</span>`;
      button.addEventListener('click', () => this.pickTool(tool.id));
      el.tools.append(button);
      this.toolButtons.set(tool.id, button);
    }

    this.spellButtons = new Map();
    this.content.spells.forEach((spell, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mk-spell';
      button.dataset.spell = spell.id;
      button.innerHTML = `
        <span class="mk-spell-icon" aria-hidden="true">${spell.icon}</span>
        <span class="mk-spell-name">${spell.name}</span>
        <span class="mk-spell-cost">${spell.cost}</span>
        <span class="mk-spell-key">${SPELL_KEYS[index] ?? ''}</span>
        <span class="mk-spell-cd" data-cd></span>
      `;
      button.addEventListener('click', () => this.pickSpell(spell.id));
      el.spells.append(button);
      this.spellButtons.set(spell.id, button);
    });
  }

  action(action) {
    if (action === 'pause') this.options.onPause();
    else if (action === 'help') this.options.onHelp();
    else if (action === 'creatures') this.openCreatureSheet();
    else if (action === 'time') this.toggleTimeStop();
    else if (action === 'tip-next') this.tutorial.advance();
    else if (action === 'tip-dismiss') this.tutorial.dismissAll();
    else if (action === 'zoom-out') this.options.onZoom?.(1.18);
    else if (action === 'zoom-in') this.options.onZoom?.(0.85);
    else if (action === 'zoom-reset') this.options.onResetCamera?.();
    else if (action === 'sheet-close') this.closeSheet();
  }

  setVisible(visible) {
    this.root.querySelector('.mk-hud').hidden = !visible;
    if (!visible) this.closeSheet();
  }

  setGame(game) {
    this.game = game;
    this.updateTimeState();
    this.activeTool = 'dig';
    this.selection = { room: null, trap: null };
    this.closeSheet();
    this.el.kicker.textContent = 'Endless run';
    const bestWave = Math.max(0, Number(game.profile?.bestWave) || 0);
    this.el.level.textContent = bestWave
      ? `Best wave ${bestWave}`
      : 'Survive the longest wave';
    this.updateToolLabels();
    this.setActiveTool('dig');
    this.updateHint();
    this.tutorial.start(game);
  }

  /* --------------------------------------------------------------- tools */

  updateToolLabels() {
    const roomButton = this.toolButtons.get('room');
    const roomDef = this.selection.room
      ? this.content.roomById.get(this.selection.room)
      : null;
    roomButton.querySelector('.mk-tool-icon').textContent = roomDef?.icon ?? '🏠';
    roomButton.querySelector('.mk-tool-label').textContent = roomDef?.name ?? 'Rooms';

    const trapButton = this.toolButtons.get('trap');
    const trapDef = this.selection.trap
      ? this.content.trapById.get(this.selection.trap)
      : null;
    trapButton.querySelector('.mk-tool-icon').textContent = trapDef?.icon ?? '🪤';
    trapButton.querySelector('.mk-tool-label').textContent = trapDef?.name ?? 'Traps';
  }

  toggleTimeStop() {
    if (!this.game) return;
    this.game.setTimeStopped(!this.game.timeStopped);
    this.updateTimeState();
  }

  updateTimeState() {
    const stopped = Boolean(this.game?.timeStopped);
    if (!this.el.time) return;
    this.el.time.classList.toggle('active', stopped);
    this.el.time.setAttribute('aria-pressed', stopped ? 'true' : 'false');
    this.el.time.setAttribute('aria-label', stopped ? 'Resume time' : 'Stop time');
    this.el['time-icon'].textContent = stopped ? '▶' : '⏳';
    this.el['time-label'].textContent = stopped ? 'Resume' : 'Time';
    this.el['time-banner'].hidden = !stopped;
  }

  setActiveTool(toolId) {
    this.activeTool = toolId;
    for (const [id, button] of this.toolButtons) {
      const active = id === toolId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    for (const [, button] of this.spellButtons) button.classList.remove('active');
    this.updateHint();
  }

  pickTool(id) {
    if (!this.game) return;
    if (id === 'room') {
      this.openRoomSheet();
      return;
    }
    if (id === 'trap') {
      this.openTrapSheet();
      return;
    }
    this.selection.room = null;
    this.selection.trap = null;
    this.updateToolLabels();
    this.setActiveTool(id);
    this.game.setTool({ type: id });
  }

  pickToolIndex(index) {
    const tool = TOOLS[index];
    if (tool) this.pickTool(tool.id);
  }

  pickSpell(id) {
    if (!this.game) return;
    const def = this.content.spellById.get(id);
    if (!def) return;
    if (!this.game.economy.spells.has(id)) {
      this.toast('That spell has not been researched.', 'warn');
      return;
    }
    this.setActiveTool('spell');
    this.game.setTool({ type: 'spell', id });
    this.el.hint.textContent = `Tap the dungeon to cast ${def.name} (${def.cost} mana).`;
    this.toast(`Now tap the dungeon to cast ${def.name}!`, 'info');
  }

  pickSpellIndex(index) {
    const spell = this.content.spells[index];
    if (spell) this.pickSpell(spell.id);
  }

  toggleHelp() {
    this.options.onHelp?.();
  }

  updateHint() {
    const tool = TOOLS.find((entry) => entry.id === this.activeTool);
    let hint = tool?.hint ?? '';
    if (this.activeTool === 'room' && this.selection.room) {
      hint = 'Paint floor to build the room.';
    }
    if (this.activeTool === 'trap' && this.selection.trap) {
      hint = 'Tap floor to place it.';
    }
    if (this.game?.handCreature) {
      hint = `Carrying ${this.game.handCreature.def.name}. Tap floor to drop.`;
    }
    if (this.game?.tasks.size) {
      const size = this.game.tasks.size;
      const blocked = this.game.tasks.blockedCount;
      hint += `  ·  ${size} job${size === 1 ? '' : 's'} queued`;
      if (blocked > 0) {
        hint += `  ·  ${blocked} need${blocked === 1 ? 's' : ''} a tunnel — imps dig one tile at a time from open floor`;
      }
    }
    if (
      this.game?.creatures &&
      this.game.creatures.count < this.game.creatures.cap() &&
      this.game.world.portalExists()
    ) {
      hint += `  ·  Next creature in ${Math.max(1, Math.ceil(this.game.creatures.spawnTimer))}s`;
    }
    this.el.hint.textContent = hint;
  }

  /* -------------------------------------------------------- sheets/tips */

  openSheet(title, note, items) {
    openSheet(this, title, note, items);
  }

  closeSheet() {
    closeSheet(this);
  }

  openRoomSheet() {
    openRoomSheet(this);
  }

  openTrapSheet() {
    openTrapSheet(this);
  }

  openCreatureSheet() {
    openCreatureSheet(this);
  }

  startTutorial() {
    this.tutorial.start(this.game);
  }

  handleEvent(event) {
    this.tutorial.handle(event);
  }

  advanceTip() {
    this.tutorial.advance();
  }

  /** Flash the Heart bar when the Heart is hit. */
  heartAlarm() {
    const track = this.el['heart-track'];
    if (!track) return;
    track.classList.remove('alarm');
    void track.offsetWidth;
    track.classList.add('alarm');
    window.setTimeout(() => track.classList.remove('alarm'), 700);
  }

  /** Brief pulse on the gold chip, e.g. at payday. */
  pulseGold() {
    const chip = this.el.gold.closest('.mk-chip');
    if (!chip) return;
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
    window.setTimeout(() => chip.classList.remove('pulse'), 600);
  }

  toast(text, kind = 'info') {
    const node = document.createElement('div');
    node.className = `mk-toast ${kind}`;
    node.textContent = text;
    this.el.toasts.append(node);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstElementChild.remove();
    window.setTimeout(() => {
      node.classList.add('out');
      window.setTimeout(() => node.remove(), 400);
    }, 2800);
  }

  /* ------------------------------------------------------------- update */

  update(dt, game) {
    if (!game) return;
    this.game = game;
    this.updateTimeState();
    this.tutorial.update(dt);

    this.last += dt;
    if (this.last < 0.12) return;
    this.last = 0;

    const economy = game.economy;
    this.el.gold.textContent = Math.floor(economy.gold).toLocaleString('en-US');
    const goldChip = this.el.gold.closest('.mk-chip');
    if (goldChip) {
      goldChip.title = `Gold · wages ${game.creatures.wageTotal()}/min`;
    }
    this.el.mana.textContent = Math.floor(economy.mana);
    this.el.food.textContent = Math.floor(economy.food);
    this.el.creatures.textContent = game.creatures.count;
    this.el.cap.textContent = game.creatures.cap();
    this.el.imps.textContent = game.imps.count;

    const heartRatio = Math.max(0, game.world.heart.hp / game.world.heart.maxHp);
    this.el['heart-fill'].style.width = `${heartRatio * 100}%`;
    this.el['heart-fill'].classList.toggle('low', heartRatio < 0.35);
    this.el['heart-text'].textContent = Math.ceil(game.world.heart.hp);
    this.el['heart-track'].setAttribute('aria-valuenow', Math.round(heartRatio * 100));

    this.updateWave(game);

    const target = economy.researchTarget;
    const library = game.world.hasRoom('library');
    if (library && target) {
      this.el.research.hidden = false;
      this.el['research-label'].textContent = `Researching ${target.name}`;
      this.el['research-fill'].style.width = `${Math.min(
        100,
        (economy.research / target.cost) * 100
      )}%`;
    } else {
      this.el.research.hidden = true;
    }

    for (const [id, button] of this.spellButtons) {
      const def = this.content.spellById.get(id);
      const unlocked = economy.spells.has(id);
      const cd = game.spells.cooldownLeft(id);
      button.classList.toggle('locked', !unlocked);
      button.classList.toggle('unaffordable', unlocked && economy.mana < def.cost);
      button.disabled = !unlocked || cd > 0;
      const cdNode = button.querySelector('[data-cd]');
      cdNode.textContent = cd > 0 ? `${Math.ceil(cd)}` : unlocked ? '' : '🔒';
      if (!unlocked) {
        const research = def.research
          ? this.content.researchById.get(def.research)
          : null;
        button.title = research
          ? `Locked — research ${research.name} in a Library`
          : `Locked — research ${def.name} in a Library`;
      } else {
        button.title = `${def.name} — ${def.cost} mana. ${def.desc ?? ''}`;
      }
    }

    this.updateHint();
  }

  updateWave(game) {
    const alive = game.heroes.list.length;
    if (game.status !== 'playing') {
      this.el.wave.textContent = 'The Heart has fallen';
      this.el.wave.classList.add('danger');
      return;
    }
    const next = game.heroes.nextWaveIn();
    if (alive > 0) {
      this.el.wave.textContent = `Wave ${Math.max(
        1,
        game.heroes.waveIndex
      )} · ${alive} intruder${alive === 1 ? '' : 's'} in the dungeon${
        next != null ? ` · next in ${Math.ceil(next)}s` : ''
      }`;
      this.el.wave.classList.add('danger');
      return;
    }
    this.el.wave.classList.remove('danger');
    if (next != null) {
      this.el.wave.textContent = `Wave ${game.heroes.waveIndex + 1} in ${Math.ceil(next)}s`;
    } else {
      this.el.wave.textContent = 'The next wave is coming!';
    }
  }
}
