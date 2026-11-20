import { HOUSE_OF, ROOM_OF, SKILL_LABELS, SPELLS } from '../content.js';
import { levelProgress } from '../progression.js';
import { getState, interact, nearbyPointById, setPanel, subscribe } from '../store.js';
import { moveInput } from '../world/state.js';
import { escapeHtml } from './dom.js';

const SPELL_ORDER = ['lumina', 'floris', 'leviosa', 'echo'];

function hudMarkup() {
  return `
    <div class="hud" id="game-hud" aria-live="off">
      <div class="hud-top">
        <div class="hud-house">
          <span class="house-crest" id="hud-crest" aria-hidden="true"><span></span></span>
          <div class="hud-house-copy">
            <strong id="hud-name"></strong>
            <span id="hud-house-line"></span>
          </div>
        </div>
        <div class="hud-center">
          <span class="hud-room-kicker">Now exploring</span>
          <h1 class="hud-room-name"><span id="hud-room-icon" aria-hidden="true"></span> <span id="hud-room-name"></span></h1>
          <div class="resonance">
            <span class="resonance-label">Magic Resonance <strong id="hud-resonance"></strong></span>
            <span class="resonance-track"><span class="resonance-fill" id="hud-resonance-fill"></span></span>
            <span class="resonance-points" id="hud-points"></span>
          </div>
        </div>
        <nav class="hud-actions" aria-label="Castle menus">
          <button type="button" data-panel="spellbook" aria-label="Open spellbook (B)"><span aria-hidden="true">✧</span><span>Spells</span></button>
          <button type="button" data-panel="map" aria-label="Open castle map (M)"><span aria-hidden="true">⌘</span><span>Map</span></button>
          <button type="button" data-panel="quests" aria-label="Open quest scrolls (Q)"><span aria-hidden="true">❧</span><span>Quests</span></button>
          <button type="button" data-panel="inventory" aria-label="Open satchel (I)"><span aria-hidden="true">◈</span><span>Satchel</span></button>
          <button type="button" data-panel="settings" aria-label="Open settings"><span aria-hidden="true">⚙</span><span>Settings</span></button>
        </nav>
      </div>

      <div class="hud-factor" aria-hidden="true"></div>

      <div class="hud-controls" id="hud-controls">
        <div class="hud-left">
          <div class="joystick" id="joystick" role="group" aria-label="Movement joystick. Drag to walk.">
            <span class="joystick-knob" id="joystick-knob" aria-hidden="true">✦</span>
            <span class="sr-only">Drag the star to move. Release to stop.</span>
          </div>
        </div>
        <div class="hud-bottom-center">
          <button type="button" class="interact-prompt" id="interact-prompt" hidden>
            <span class="interact-key" aria-hidden="true">E</span>
            <span class="interact-spark" aria-hidden="true">✦</span>
            <span id="interact-label"></span>
          </button>
          <p class="wander-hint" id="wander-hint">Follow a corridor, find something glowing, press <kbd>E</kbd>.</p>
        </div>
        <div class="hud-right">
          <div class="spell-quickbar" id="spell-quickbar" role="group" aria-label="Spells"></div>
        </div>
      </div>

      <div class="hud-skills" id="hud-skills" aria-label="Listening skills growing"></div>
    </div>`;
}

export function mountHud(root) {
  root.innerHTML = hudMarkup();
  const hud = root.querySelector('#game-hud');
  const crest = root.querySelector('#hud-crest');
  const nameEl = root.querySelector('#hud-name');
  const houseLine = root.querySelector('#hud-house-line');
  const roomIcon = root.querySelector('#hud-room-icon');
  const roomName = root.querySelector('#hud-room-name');
  const resonance = root.querySelector('#hud-resonance');
  const resonanceFill = root.querySelector('#hud-resonance-fill');
  const points = root.querySelector('#hud-points');
  const controls = root.querySelector('#hud-controls');
  const skills = root.querySelector('#hud-skills');
  const quickbar = root.querySelector('#spell-quickbar');
  const prompt = root.querySelector('#interact-prompt');
  const interactLabel = root.querySelector('#interact-label');
  const wanderHint = root.querySelector('#wander-hint');
  const joystick = root.querySelector('#joystick');
  const knob = root.querySelector('#joystick-knob');

  let quickbarSignature = '';
  let skillsSignature = '';

  root.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => setPanel(button.dataset.panel));
  });

  quickbar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-spell]');
    if (button) {
      const current = getState();
      if (current.challenge || current.dialogue || current.panel !== 'none') return;
      import('../store.js').then((store) => store.castSpell(button.dataset.spell));
    }
  });

  let activePointer = null;
  let knobX = 0;
  let knobY = 0;
  const release = () => {
    activePointer = null;
    knobX = 0;
    knobY = 0;
    knob.style.transform = 'translate(0px, 0px)';
    moveInput.x = 0;
    moveInput.z = 0;
  };
  const updateJoystick = (clientX, clientY) => {
    const rect = joystick.getBoundingClientRect();
    const limit = rect.width * 0.32;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > limit) {
      dx = (dx / distance) * limit;
      dy = (dy / distance) * limit;
    }
    knobX = dx;
    knobY = dy;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveInput.x = dx / limit;
    moveInput.z = dy / limit;
  };
  joystick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    activePointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event.clientX, event.clientY);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (activePointer !== event.pointerId) return;
    updateJoystick(event.clientX, event.clientY);
  });
  joystick.addEventListener('pointerup', release);
  joystick.addEventListener('pointercancel', release);
  joystick.addEventListener('lostpointercapture', release);

  prompt.addEventListener('click', () => interact());

  function renderQuickbar(save) {
    const signature = save.unlockedSpells.join(',');
    if (signature === quickbarSignature) return;
    quickbarSignature = signature;
    quickbar.innerHTML = SPELL_ORDER.map((id, index) => {
      const spell = SPELLS.find((entry) => entry.id === id);
      if (!spell) return '';
      const unlocked = save.unlockedSpells.includes(id);
      return `<button type="button" class="quickbar-spell${unlocked ? '' : ' locked'}" data-spell="${id}" title="${escapeHtml(`${spell.name} — ${unlocked ? spell.effect : 'not learned yet'}`)}" aria-label="${escapeHtml(`${spell.name}${unlocked ? `: ${spell.effect}` : ' (not learned)'}`)}">
        <span class="quickbar-icon" aria-hidden="true">${unlocked ? spell.icon : '?'}</span>
        <span class="quickbar-name">${spell.name}</span>
        <span class="quickbar-key" aria-hidden="true">${index + 1}</span>
      </button>`;
    }).join('');
  }

  function renderSkills(save) {
    const signature = Object.values(save.challengeStats).join(',');
    if (signature === skillsSignature) return;
    skillsSignature = signature;
    skills.innerHTML = Object.entries(save.challengeStats)
      .filter(([, value]) => value > 0)
      .slice(0, 6)
      .map(([key, value]) => {
        const skill = SKILL_LABELS[key];
        if (!skill) return '';
        return `<span class="hud-skill"><span aria-hidden="true" style="color:${skill.colour}">${skill.icon}</span>${skill.name} <strong>${value}</strong></span>`;
      })
      .join('');
  }

  function update(state) {
    if (!state.ready || !state.save.playerName) {
      hud.hidden = true;
      return;
    }
    hud.hidden = false;
    const save = state.save;
    const house = HOUSE_OF(save.house);
    const room = ROOM_OF(state.currentRoom);
    const level = levelProgress(save.resonance);
    const point = state.nearbyId ? nearbyPointById(state.nearbyId) : null;
    const overlays = Boolean(state.dialogue || state.challenge || state.panel !== 'none');

    hud.classList.toggle('is-paused', overlays);
    nameEl.textContent = save.playerName;
    houseLine.textContent = `${house ? `${house.name} House` : 'Unsorted'} · Apprentice ${save.level}`;
    crest.style.setProperty('--crest-color', house?.color ?? '#f2ce7b');
    crest.style.setProperty('--crest-glow', house?.glow ?? '#ffe3a3');
    crest.firstElementChild.textContent = house?.sigil ?? '✦';
    roomIcon.textContent = room?.icon ?? '⌘';
    roomName.textContent = room?.name ?? 'The Castle';
    resonance.textContent = String(save.resonance);
    points.textContent = `${save.resonance} house points`;
    resonanceFill.style.width = `${Math.min(100, (level.current / level.needed) * 100)}%`;

    controls.hidden = overlays;
    skills.hidden = overlays;
    if (point) {
      let label = point.label;
      if (point.kind === 'door' && point.targetRoom) {
        const target = ROOM_OF(point.targetRoom);
        label =
          target && save.unlockedRooms.includes(target.id)
            ? `Step into ${target.name}`
            : `Try the seal on ${target?.shortName ?? 'the door'}`;
      }
      interactLabel.textContent = label;
      prompt.hidden = false;
      wanderHint.hidden = true;
    } else {
      prompt.hidden = true;
      wanderHint.hidden = false;
    }

    renderQuickbar(save);
    renderSkills(save);
  }

  const unsubscribe = subscribe(update);
  update(getState());
  return () => {
    unsubscribe();
    release();
  };
}
