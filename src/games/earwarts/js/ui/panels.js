import { audioEngine } from '../audio.js';
import {
  ACHIEVEMENTS,
  COSMETICS,
  PETS,
  QUESTS,
  ROOMS,
  ROOM_OF,
  SKILL_LABELS,
  SPELLS,
} from '../content.js';
import { nextLockedRoom } from '../progression.js';
import { allQuestProgress } from '../quests.js';
import {
  castSpell,
  equipAccessory,
  exportSave,
  getState,
  importSave,
  setCaptions,
  setPanel,
  subscribe,
  updateAudio,
} from '../store.js';
import { escapeHtml } from './dom.js';

const POSITIONS = {
  'spellcasting-tower': { left: '50%', top: '16%' },
  'potion-dungeon': { left: '17%', top: '50%' },
  'great-hall': { left: '50%', top: '50%' },
  'creature-gardens': { left: '83%', top: '50%' },
  'rhythm-forest': { left: '50%', top: '84%' },
};

function shell(kicker, title, className, body) {
  return `
    <section class="magic-panel ${className}" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <header class="magic-panel-head">
        <div>
          <p class="panel-kicker">${kicker}</p>
          <h2 id="panel-title">${title}</h2>
        </div>
        <button type="button" class="panel-close" data-close aria-label="Close ${title.toLowerCase()}">×</button>
      </header>
      ${body}
    </section>`;
}

function spellbookMarkup(save) {
  const cards = SPELLS.map((spell, index) => {
    const unlocked = save.unlockedSpells.includes(spell.id);
    const source = QUESTS.find((quest) => quest.reward.spell === spell.id);
    return `
      <article class="spell-card${unlocked ? '' : ' locked'}">
        <span class="spell-icon" aria-hidden="true">${unlocked ? spell.icon : '·'}</span>
        <div class="spell-copy">
          <div class="spell-title-row">
            <h3>${spell.name}</h3>
            <span class="spell-key">${index + 1}</span>
          </div>
          <p>${spell.description}</p>
          <p class="spell-effect">${spell.effect}</p>
          ${
            unlocked
              ? `<button type="button" class="small-button" data-cast="${spell.id}">Cast ${spell.name}</button>`
              : `<p class="spell-locked-note">${source ? `Hidden in quest: ${source.title}` : 'Still hidden in the castle.'}</p>`
          }
        </div>
      </article>`;
  }).join('');
  return shell(
    'Your grimoire',
    'Spellbook',
    'spell-panel',
    `<p class="panel-lede">Spells answer to listening, not to wands. Learn one and it appears here, ready for a quiet evening of practice.</p>
     <div class="spell-grid">${cards}</div>
     <div class="panel-note"><span aria-hidden="true">☾</span> Number keys <kbd>1</kbd>–<kbd>4</kbd> cast spells while you explore. Echo repeats the last magical sound if you want to hear it again.</div>`
  );
}

function mapMarkup(save, currentRoom) {
  const nodes = ROOMS.map((room) => {
    const unlocked = save.unlockedRooms.includes(room.id);
    const here = currentRoom === room.id;
    const position = POSITIONS[room.id];
    return `
      <div role="listitem" class="map-node${unlocked ? '' : ' sealed'}${here ? ' here' : ''}" style="left:${position.left};top:${position.top};--room-accent:${room.accent}">
        <span class="map-node-icon" aria-hidden="true">${unlocked ? room.icon : '⌘'}</span>
        <strong>${room.shortName}</strong>
        <span class="map-node-status">${here ? 'You are here' : unlocked ? 'Open' : `${room.threshold} resonance`}</span>
        ${here ? '<span class="map-you" aria-hidden="true">✦</span>' : ''}
      </div>`;
  }).join('');
  return shell(
    'The castle knows every footstep',
    'Magical Map',
    'map-panel',
    `<p class="panel-lede">Four wings and a hall, joined by torchlit corridors. Walk to a doorway and press <kbd>E</kbd> if the seal is being stubborn.</p>
     <div class="map-canvas" role="list" aria-label="Castle rooms">
       <svg class="map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
         <line x1="50" y1="30" x2="50" y2="42"></line>
         <line x1="28" y1="50" x2="42" y2="50"></line>
         <line x1="58" y1="50" x2="72" y2="50"></line>
         <line x1="50" y1="58" x2="50" y2="70"></line>
       </svg>
       ${nodes}
     </div>
     <div class="map-legend">
       <span><span aria-hidden="true" class="legend-dot open"></span> Open wing</span>
       <span><span aria-hidden="true" class="legend-dot sealed"></span> Sealed by resonance</span>
       <span><span aria-hidden="true" class="legend-dot here"></span> You are here</span>
     </div>
     <div class="panel-note"><span aria-hidden="true">✦</span> Magic Resonance: <strong>${save.resonance}</strong>. Every listening spell adds to it and nudges the next seal open.</div>`
  );
}

function questCard(entry) {
  const room = ROOM_OF(entry.quest.room);
  const skill = SKILL_LABELS[entry.quest.objective.skill];
  const percent = Math.min(100, (entry.current / entry.target) * 100);
  return `
    <article class="quest-scroll${entry.claimed ? ' claimed' : ''}">
      <div class="quest-scroll-head">
        <span class="quest-icon" aria-hidden="true" style="color:${room?.accent ?? '#c9a55a'}">${room?.icon ?? '✦'}</span>
        <div>
          <h3>${entry.quest.title}</h3>
          <p class="quest-giver">${entry.quest.giver} · ${room?.name ?? 'The Castle'}</p>
        </div>
        ${entry.claimed ? '<span class="quest-stamp">Complete</span>' : ''}
      </div>
      <p class="quest-summary">${entry.quest.summary}</p>
      <div class="quest-objective">
        <span><span aria-hidden="true" style="color:${skill.colour}">${skill.icon}</span> ${skill.name} spells answered</span>
        <strong>${entry.current} / ${entry.target}</strong>
        <span class="quest-track" role="progressbar" aria-valuemin="0" aria-valuemax="${entry.target}" aria-valuenow="${entry.current}"><span style="width:${percent}%"></span></span>
      </div>
      <p class="quest-reward"><span aria-hidden="true">✧</span> Reward: ${entry.quest.reward.label}</p>
    </article>`;
}

function questsMarkup(save) {
  const progress = allQuestProgress(save);
  const locked = nextLockedRoom(save);
  return shell(
    'From the Quest Board',
    'Quest Scrolls',
    'quest-panel',
    `<p class="panel-lede">Nothing here is homework. These are excuses to wander, listen, and collect a little magic.</p>
     <div class="quest-list">${progress.map(questCard).join('')}</div>
     ${locked ? `<p class="quest-next"><span aria-hidden="true">${locked.icon}</span> ${locked.name} is still sealed. It wakes at <strong>${locked.threshold} Magic Resonance</strong>. You have ${save.resonance}.</p>` : ''}
     <p class="panel-foot">${QUESTS.length} scrolls pinned to the board. Quests complete on their own when their listening is done.</p>`
  );
}

function inventoryMarkup(save) {
  const pet = PETS[0];
  const accessory = COSMETICS.find((item) => item.id === save.petAccessory);
  const cosmetics = COSMETICS.map((item) => {
    const owned = save.cosmetics.includes(item.id);
    const worn = save.petAccessory === item.id;
    return `
      <article class="cosmetic-card${owned ? '' : ' locked'}">
        <span class="cosmetic-icon" aria-hidden="true">${owned ? item.icon : '·'}</span>
        <div>
          <h4>${item.name}</h4>
          <p>${item.description}</p>
          ${
            owned
              ? `<button type="button" class="small-button${worn ? ' worn' : ''}" data-accessory="${worn ? '' : item.id}">${worn ? 'Take off' : 'Wear on Pip'}</button>`
              : '<p class="locked-line">Not found yet</p>'
          }
        </div>
      </article>`;
  }).join('');
  const badges = ACHIEVEMENTS.map((achievement) => {
    const earned = save.achievements.includes(achievement.id);
    return `<div class="badge${earned ? ' earned' : ''}"><span class="badge-icon" aria-hidden="true">${earned ? '★' : '☆'}</span><strong>${achievement.title}</strong><span>${achievement.description}</span></div>`;
  }).join('');
  return shell(
    'Pockets, feathers, and small treasures',
    'The Satchel',
    'inventory-panel',
    `<article class="pet-card">
       <div class="pet-portrait" aria-hidden="true"><span class="pet-owl">🦉</span><span class="pet-aura"></span></div>
       <div class="pet-copy">
         <p class="panel-kicker">Companion</p>
         <h3>${pet.name} <span>· ${pet.species}</span></h3>
         <p>${pet.description}</p>
         <p class="pet-note">${accessory ? `Pip is wearing the ${accessory.name}.` : 'Pip is wearing nothing at all and considers this an excellent look.'}</p>
       </div>
     </article>
     <h3 class="section-title">Cosmetics</h3>
     <div class="cosmetic-grid">${cosmetics}</div>
     <h3 class="section-title">Achievements</h3>
     <div class="badge-grid">${badges}</div>`
  );
}

function settingsMarkup(save) {
  return shell(
    'Make the castle comfortable',
    'Settings',
    'settings-panel',
    `<div class="settings-block">
       <h3>Sound</h3>
       <label class="range-row" for="volume-range">
         <span>Volume</span>
         <input id="volume-range" type="range" min="0" max="100" step="1" value="${Math.round(save.audio.volume * 100)}" />
         <output id="volume-output">${Math.round(save.audio.volume * 100)}%</output>
       </label>
       <div class="toggle-row">
         <button type="button" class="toggle${save.audio.muted ? ' on' : ''}" data-mute aria-pressed="${save.audio.muted}"><span class="toggle-track" aria-hidden="true"><span></span></span>Mute all sound</button>
         <button type="button" class="toggle${save.captions ? ' on' : ''}" data-captions aria-pressed="${save.captions}"><span class="toggle-track" aria-hidden="true"><span></span></span>Sound captions</button>
       </div>
       <p class="settings-hint">Sound starts after your first tap. Captions describe what is playing without giving the answer away.</p>
     </div>
     <div class="settings-block">
       <h3>Controls</h3>
       <ul class="controls-list">
         <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows — walk</li>
         <li><kbd>Shift</kbd> — hurry</li>
         <li><kbd>E</kbd> — talk, read, or touch a glowing thing</li>
         <li><kbd>B</kbd> spellbook · <kbd>M</kbd> map · <kbd>Q</kbd> quests · <kbd>I</kbd> satchel</li>
         <li><kbd>1</kbd>–<kbd>4</kbd> — cast a spell · <kbd>Esc</kbd> — close a panel</li>
         <li>On a touch screen, drag the star pad and tap the sparkling prompt.</li>
       </ul>
     </div>
     <div class="settings-block">
       <h3>Your adventure scroll</h3>
       <p class="settings-hint">The castle saves in this browser with IndexedDB, about every 30 seconds and after every spell. Export a copy before clearing browser data or moving to another device.</p>
       <div class="save-actions">
         <button type="button" class="small-button" data-export>Export save to JSON</button>
         <button type="button" class="small-button" data-import>Import save from JSON</button>
         <input type="file" accept="application/json,.json" class="sr-only" id="save-file" />
       </div>
       <p class="settings-hint" id="import-message" role="status" hidden></p>
       <p class="settings-hint small">Apprentice since ${new Date(save.createdAt).toLocaleDateString()} · ${save.streakDays} day${save.streakDays === 1 ? '' : 's'} of visiting · ${save.achievements.length} achievements</p>
     </div>
     <div class="panel-note"><span aria-hidden="true">♡</span> Made for listening, wandering, and taking your time.</div>`
  );
}

export function mountPanels(root) {
  let signature = '';
  let lastPanel = 'none';

  function close() {
    setPanel('none');
  }

  function wireSettings() {
    const slider = root.querySelector('#volume-range');
    const output = root.querySelector('#volume-output');
    if (slider) {
      slider.addEventListener('input', () => {
        const volume = Number(slider.value) / 100;
        output.textContent = `${slider.value}%`;
        audioEngine.applySettings(volume, getState().save.audio.muted);
      });
      slider.addEventListener('change', () => {
        updateAudio({ volume: Number(slider.value) / 100 });
      });
    }
    root.querySelector('[data-mute]')?.addEventListener('click', () => {
      updateAudio({ muted: !getState().save.audio.muted });
    });
    root.querySelector('[data-captions]')?.addEventListener('click', () => {
      setCaptions(!getState().save.captions);
    });
    root.querySelector('[data-export]')?.addEventListener('click', () => exportSave());
    const input = root.querySelector('#save-file');
    root.querySelector('[data-import]')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const success = await importSave(file);
      const message = root.querySelector('#import-message');
      if (message) {
        message.textContent = success
          ? 'Your scroll was read. Welcome back.'
          : 'That scroll could not be read. The castle kept your current adventure safe.';
        message.hidden = false;
      }
      input.value = '';
    });
  }

  function render(state) {
    const panel = state.panel;
    const save = state.save;
    const nextSignature = `${panel}|${save.unlockedSpells.join(',')}|${save.cosmetics.join(',')}|${save.petAccessory}|${save.audio.volume}|${save.audio.muted}|${save.captions}|${save.resonance}|${save.completedQuests.join(',')}|${save.achievements.join(',')}|${Object.values(save.challengeStats).join(',')}|${state.currentRoom}`;
    if (panel === 'none') {
      if (lastPanel !== 'none') root.replaceChildren();
      signature = '';
      lastPanel = 'none';
      return;
    }
    if (nextSignature === signature) return;
    signature = nextSignature;
    lastPanel = panel;

    let content = '';
    if (panel === 'spellbook') content = spellbookMarkup(save);
    else if (panel === 'map') content = mapMarkup(save, state.currentRoom);
    else if (panel === 'quests') content = questsMarkup(save);
    else if (panel === 'inventory') content = inventoryMarkup(save);
    else if (panel === 'settings') content = settingsMarkup(save);
    if (!content) {
      root.replaceChildren();
      return;
    }
    root.innerHTML = `<div class="modal-backdrop" role="presentation">${content}</div>`;
    const backdrop = root.firstElementChild;
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) close();
    });
    root.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    root.querySelectorAll('[data-cast]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.cast;
        close();
        castSpell(id);
      });
    });
    root.querySelectorAll('[data-accessory]').forEach((button) => {
      button.addEventListener('click', () => equipAccessory(button.dataset.accessory || null));
    });
    if (panel === 'settings') wireSettings();
  }

  const unsubscribe = subscribe(render);
  render(getState());
  return unsubscribe;
}
