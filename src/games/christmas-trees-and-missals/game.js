import {
  ORNAMENTS,
  ORNAMENT_BY_ID,
  HOLIDAYS,
  HOLIDAY_BY_ID,
  RARITIES,
  TOTAL_ORNAMENTS,
  STARTER_ORNAMENT,
  STARTING_COINS,
  priceOf,
} from './ornaments.js';
import { buildOrnament } from './ornament-models.js';
import { createTown } from './town.js';
import { createCutscene } from './cutscene.js';
import { sound } from './sound.js';
import { submitScore } from '../../utils/scores.js';

// ------------------------------------------------------------------ DOM
const container = document.querySelector('#game-container');
const coinCount = document.querySelector('#coin-count');
const ornamentCount = document.querySelector('#ornament-count');
const hungCount = document.querySelector('#hung-count');
const launchCount = document.querySelector('#launch-count');
const messageEl = document.querySelector('#message');
const shopButton = document.querySelector('#shop-button');
const muteButton = document.querySelector('#mute-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const launchButton = document.querySelector('#launch-button');
const launchSummary = document.querySelector('#launch-summary');
const trayList = document.querySelector('#tray-list');
const trayCount = document.querySelector('#tray-count');
const trayEmpty = document.querySelector('#tray-empty');
const removeAllButton = document.querySelector('#remove-all-button');
const albumCount = document.querySelector('#album-count');
const albumProgressFill = document.querySelector('#album-progress-fill');
const albumFilters = document.querySelector('#album-filters');
const albumGrid = document.querySelector('#album-grid');
const albumEmpty = document.querySelector('#album-empty');
const shopRail = document.querySelector('#shop-panel');
const shopTabs = [...document.querySelectorAll('.rail-tab')];
const shopPanels = {
  shop: document.querySelector('#panel-shop'),
  album: document.querySelector('#panel-album'),
  help: document.querySelector('#panel-help'),
};
const shopCoins = document.querySelector('#shop-coins');
const shopClose = document.querySelector('#shop-close');
const shopFilters = document.querySelector('#shop-filters');
const shopGrid = document.querySelector('#shop-grid');
const shopEmpty = document.querySelector('#shop-empty');
const shopNote = document.querySelector('.shop-note');
const launchOverlay = document.querySelector('#launch-overlay');
const countdownValue = document.querySelector('#countdown-value');
const countdownSub = document.querySelector('#countdown-sub');
const skipButton = document.querySelector('#skip-button');
const resultsDialog = document.querySelector('#results-dialog');
const paperDate = document.querySelector('#paper-date');
const paperHeadline = document.querySelector('#paper-headline');
const paperDeck = document.querySelector('#paper-deck');
const paperCopy = document.querySelector('#paper-copy');
const payoutLines = document.querySelector('#payout-lines');
const payoutTotal = document.querySelector('#payout-total');
const paperNote = document.querySelector('#paper-note');
const resultsClose = document.querySelector('#results-close');

// --------------------------------------------------------------- limits
const GAME_ID = 'christmas-trees-and-missals';
const SAVE_KEY = 'foofire.christmasTrees.save.v1';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHOP_NOTE_DEFAULT =
  'Buy once, own forever. Better ornaments make a more valuable tree — and bigger launch payouts.';
const SHOP_TABS = ['shop', 'album', 'help'];

const state = {
  coins: STARTING_COINS,
  owned: new Set([STARTER_ORNAMENT]),
  hung: new Map(),
  launches: 0,
  bestPayout: 0,
  selected: STARTER_ORNAMENT,
  armed: false,
  armTimer: 0,
  busy: false,
  cutscene: null,
  finishedCutscene: null,
  pending: null,
  storageAvailable: true,
  filters: { album: 'all', shop: 'all' },
};

let town = null;
let elapsed = 0;
let lastFrame = performance.now();
let shopNoteTimer = 0;

const filterButtons = { album: new Map(), shop: new Map() };
const ornamentModels = new Map();

// ------------------------------------------------------------------ town
try {
  town = createTown(container, {
    reducedMotion: REDUCED_MOTION,
    onTap: handleTap,
    onHover: handleHover,
  });
} catch (error) {
  container.replaceChildren();
  const fallback = document.createElement('p');
  fallback.className = 'xm-fallback';
  fallback.textContent =
    'This game needs WebGL, which this browser has switched off. Try another browser to decorate the tree.';
  container.append(fallback);
}

if (!town) {
  setMessage('WebGL is unavailable, so the town cannot load.');
  [shopButton, muteButton, fullscreenButton, launchButton, removeAllButton].forEach((button) => {
    if (button) button.disabled = true;
  });
} else {
  init();
}

function init() {
  loadProgress();
  buildAllFilters();

  restoreHungOrnaments();
  normaliseSelection();
  renderTray();
  renderAlbum();
  renderShop();
  selectShopTab('shop');
  updateHud();
  updateMuteButton();
  updateFullscreenButton();
  setMessage(
    state.owned.size > 1
      ? 'Welcome back! Your tree is waiting for another launch.'
      : 'Welcome! Buy an ornament, then tap a glowing branch spot to hang it.'
  );

  town.update(0, 0);
  town.renderer.render(town.scene, town.camera);
  requestAnimationFrame(frame);
}

/** Ornament meshes are reused between launches, so a long decorating session
 *  does not rebuild forty little snow globes every time the tree takes off. */
function modelFor(entry) {
  if (!ornamentModels.has(entry.id)) {
    ornamentModels.set(entry.id, buildOrnament(entry));
  }
  return ornamentModels.get(entry.id);
}

// --------------------------------------------------------------- progress
function loadProgress() {
  sound.setEnabled(true);
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    state.storageAvailable = false;
    return;
  }
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    const validIds = new Set(ORNAMENTS.map((entry) => entry.id));

    if (Number.isFinite(data.coins)) {
      state.coins = Math.max(0, Math.min(9_999_999, Math.floor(data.coins)));
    }
    if (Array.isArray(data.owned)) {
      data.owned.forEach((id) => {
        if (validIds.has(id)) state.owned.add(id);
      });
    }
    if (!state.owned.has(STARTER_ORNAMENT)) state.owned.add(STARTER_ORNAMENT);

    const maxSlot = town.slots.length - 1;
    const usedIds = new Set();
    if (data.hung && typeof data.hung === 'object') {
      Object.entries(data.hung).forEach(([slotKey, id]) => {
        const slotIndex = Number(slotKey);
        if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > maxSlot) return;
        if (!validIds.has(id) || !state.owned.has(id) || usedIds.has(id)) return;
        if (state.hung.has(slotIndex)) return;
        state.hung.set(slotIndex, id);
        usedIds.add(id);
      });
    }

    if (Number.isFinite(data.launches)) {
      state.launches = Math.max(0, Math.min(999_999, Math.floor(data.launches)));
    }
    if (Number.isFinite(data.bestPayout)) {
      state.bestPayout = Math.max(0, Math.floor(data.bestPayout));
    }
    sound.setEnabled(data.muted !== true);
    state.storageAvailable = true;
  } catch {
    // A broken save should never stop the town from loading.
  }
}

function saveProgress() {
  if (!state.storageAvailable) return;
  const hung = {};
  state.hung.forEach((id, slotIndex) => {
    hung[slotIndex] = id;
  });
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        coins: state.coins,
        owned: [...state.owned],
        hung,
        launches: state.launches,
        bestPayout: state.bestPayout,
        muted: !sound.isEnabled(),
      })
    );
  } catch {
    state.storageAvailable = false;
  }
}

function restoreHungOrnaments() {
  state.hung.forEach((id, slotIndex) => {
    const entry = ORNAMENT_BY_ID.get(id);
    if (!entry) {
      state.hung.delete(slotIndex);
      return;
    }
    const group = modelFor(entry);
    if (!town.placeOrnament(slotIndex, group)) {
      state.hung.delete(slotIndex);
    }
  });
}

function recordCollection() {
  submitScore(GAME_ID, state.owned.size);
}

// ------------------------------------------------------------------- UI
function setMessage(text) {
  messageEl.textContent = text;
}

function formatCoins(value) {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

function hungEntries() {
  return [...state.hung.values()]
    .map((id) => ORNAMENT_BY_ID.get(id))
    .filter(Boolean);
}

function readyEntries() {
  const hungIds = new Set(state.hung.values());
  return ORNAMENTS.filter((entry) => state.owned.has(entry.id) && !hungIds.has(entry.id));
}

function normaliseSelection() {
  const hungIds = new Set(state.hung.values());
  const valid =
    state.selected &&
    state.owned.has(state.selected) &&
    !hungIds.has(state.selected);
  if (!valid) {
    const next = readyEntries()[0];
    state.selected = next ? next.id : null;
  }
  town.setSelectionActive(Boolean(state.selected) && !state.busy);
}

function updateHud() {
  const ready = readyEntries();
  const hung = state.hung.size;
  const maxHung = town.slots.length;

  coinCount.textContent = formatCoins(state.coins);
  ornamentCount.textContent = `${state.owned.size} / ${TOTAL_ORNAMENTS}`;
  hungCount.textContent = `${hung} / ${maxHung}`;
  launchCount.textContent = state.launches.toLocaleString('en-US');
  shopCoins.textContent = `${formatCoins(state.coins)} coins`;

  albumCount.textContent = `${state.owned.size} / ${TOTAL_ORNAMENTS}`;
  albumProgressFill.style.width = `${Math.round((state.owned.size / TOTAL_ORNAMENTS) * 100)}%`;

  trayCount.textContent =
    ready.length === 0
      ? hung > 0
        ? 'Everything is on the tree'
        : 'No ornaments yet'
      : `${ready.length} ready to hang`;
  trayEmpty.hidden = ready.length > 0;
  trayEmpty.textContent =
    hung > 0 && state.owned.size > 0
      ? 'Every ornament you own is already on the tree!'
      : 'Nothing here yet. Buy your first ornament in the shop.';

  removeAllButton.disabled = state.busy || hung === 0;
  shopButton.disabled = state.busy;
  launchButton.disabled = state.busy || hung === 0;
  launchButton.classList.toggle('armed', state.armed && !state.busy);
  launchButton.textContent = state.armed && !state.busy ? 'CLICK AGAIN TO LAUNCH!' : '🚀 LAUNCH THE TREE';

  updateLaunchSummary();
}

function updateLaunchSummary() {
  if (state.hung.size === 0) {
    launchSummary.textContent =
      state.owned.size === 0
        ? 'Nothing is hanging on the tree yet. Buy an ornament and tap a branch spot.'
        : 'Pick an ornament from your tray and tap a glowing branch spot.';
    return;
  }
  const preview = calculatePayout(110);
  launchSummary.innerHTML =
    `<strong>${state.hung.size}</strong> of ${town.slots.length} spots filled · ` +
    `tree worth <strong>${formatCoins(preview.treeValue)}</strong> · ` +
    `estimated haul <strong>${formatCoins(preview.total)}</strong> coins. ` +
    'Every ornament comes back.';
}

function buildAllFilters() {
  buildFilterRow(albumFilters, 'album', () => renderAlbum());
  buildFilterRow(shopFilters, 'shop', () => renderShop());
}

function buildFilterRow(containerEl, kind, rerender) {
  const allButton = makeFilterButton('all', '✨', 'All');
  containerEl.append(allButton);
  filterButtons[kind].set('all', allButton);

  HOLIDAYS.forEach((holiday) => {
    const button = makeFilterButton(holiday.id, holiday.icon, holiday.label);
    containerEl.append(button);
    filterButtons[kind].set(holiday.id, button);
  });

  containerEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    state.filters[kind] = button.dataset.filter;
    updateFilterPressed(kind);
    rerender();
    sound.click();
  });
  updateFilterPressed(kind);
}

function makeFilterButton(filter, icon, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-button';
  button.dataset.filter = filter;
  button.textContent = `${icon} ${label}`;
  button.setAttribute('aria-pressed', 'false');
  return button;
}

function updateFilterPressed(kind) {
  filterButtons[kind].forEach((button, filter) => {
    button.setAttribute('aria-pressed', String(state.filters[kind] === filter));
  });
}

function renderTray() {
  const ready = readyEntries();
  trayList.replaceChildren(
    ...ready.map((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tray-item rarity-${entry.rarity}`;
      button.dataset.id = entry.id;
      button.setAttribute('aria-pressed', String(state.selected === entry.id));
      if (state.selected === entry.id) button.classList.add('is-selected');
      button.title = `Hang ${entry.name} on the tree`;

      const icon = document.createElement('span');
      icon.className = 'tray-icon';
      icon.textContent = entry.icon;

      const name = document.createElement('span');
      name.className = 'tray-name';
      name.textContent = entry.name;

      const rarity = document.createElement('span');
      rarity.className = 'tray-rarity';
      rarity.textContent = RARITIES[entry.rarity].label;

      button.append(icon, name, rarity);
      button.addEventListener('click', () => selectOrnament(entry.id));
      return button;
    })
  );

  if (state.selected) {
    const selectedEl = trayList.querySelector(`[data-id="${state.selected}"]`);
    if (selectedEl && trayList.scrollWidth > trayList.clientWidth) {
      trayList.scrollLeft = Math.max(
        0,
        selectedEl.offsetLeft - trayList.clientWidth / 2 + selectedEl.clientWidth / 2
      );
    }
  }
}

function selectOrnament(id) {
  if (state.busy) return;
  disarmLaunch();
  state.selected = state.selected === id ? null : id;
  town.setSelectionActive(Boolean(state.selected));
  sound.select();
  renderTray();
  if (state.selected) {
    const entry = ORNAMENT_BY_ID.get(state.selected);
    setMessage(`Tap a glowing branch spot to hang ${entry.name}.`);
  } else {
    setMessage('Ornament put down. Pick another one whenever you like.');
  }
}

function renderAlbum() {
  const filter = state.filters.album;
  const list = filter === 'all' ? ORNAMENTS : ORNAMENTS.filter((entry) => entry.holiday === filter);
  albumGrid.replaceChildren(...list.map(renderAlbumCard));
  albumEmpty.hidden = list.length > 0;
  updateFilterPressed('album');
}

function renderAlbumCard(entry) {
  const card = document.createElement('article');
  card.className = `ornament-card album rarity-${entry.rarity}`;
  card.setAttribute('role', 'listitem');
  const owned = state.owned.has(entry.id);
  if (owned) card.classList.add('owned');

  const head = document.createElement('div');
  head.className = 'ornament-card-head';

  const icon = document.createElement('span');
  icon.className = 'ornament-icon';
  icon.textContent = entry.icon;

  const name = document.createElement('h3');
  name.className = 'ornament-name';
  name.textContent = entry.name;

  head.append(icon, name);

  const meta = document.createElement('p');
  meta.className = 'ornament-meta';
  const holiday = HOLIDAY_BY_ID.get(entry.holiday);
  const rarity = document.createElement('span');
  rarity.className = 'ornament-rarity';
  rarity.textContent = RARITIES[entry.rarity].label;
  meta.append(`${holiday.label} · `, rarity);

  const status = document.createElement('p');
  status.className = 'ornament-meta';
  status.textContent = owned ? `#${entry.number} in your album` : `Not collected yet · ${formatCoins(priceOf(entry))} coins`;

  card.append(head, meta, status);
  return card;
}

function renderShop() {
  if (!shopGrid) return;
  const filter = state.filters.shop;
  const list = filter === 'all' ? ORNAMENTS : ORNAMENTS.filter((entry) => entry.holiday === filter);
  shopGrid.replaceChildren(...list.map(renderShopCard));
  shopEmpty.hidden = list.length > 0;
  updateFilterPressed('shop');
}

function renderShopCard(entry) {
  const card = document.createElement('article');
  card.className = `ornament-card rarity-${entry.rarity}`;
  card.setAttribute('role', 'listitem');
  const owned = state.owned.has(entry.id);
  if (owned) card.classList.add('owned');

  const head = document.createElement('div');
  head.className = 'ornament-card-head';

  const icon = document.createElement('span');
  icon.className = 'ornament-icon';
  icon.textContent = entry.icon;

  const name = document.createElement('h3');
  name.className = 'ornament-name';
  name.textContent = entry.name;

  head.append(icon, name);

  const meta = document.createElement('p');
  meta.className = 'ornament-meta';
  const holiday = HOLIDAY_BY_ID.get(entry.holiday);
  meta.textContent = `${holiday.label} · ${RARITIES[entry.rarity].label}`;

  const actions = document.createElement('div');
  actions.className = 'ornament-card-actions';

  if (owned) {
    const tag = document.createElement('span');
    tag.className = 'owned-tag';
    tag.textContent = '✓ Owned';
    actions.append(tag);
  } else {
    const price = document.createElement('span');
    price.className = 'ornament-meta';
    price.textContent = `${formatCoins(priceOf(entry))} coins`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'buy-button';
    button.dataset.buy = entry.id;
    button.textContent = 'BUY';
    button.setAttribute('aria-label', `Buy ${entry.name} for ${formatCoins(priceOf(entry))} coins`);
    button.addEventListener('click', () => buyOrnament(entry.id));

    actions.append(price, button);
  }

  card.append(head, meta, actions);
  return card;
}

function buyOrnament(id) {
  const entry = ORNAMENT_BY_ID.get(id);
  if (!entry || state.busy) return;
  if (state.owned.has(id)) {
    setShopNote('You already own that one — pick it from your tray to hang it.');
    return;
  }
  const price = priceOf(entry);
  if (state.coins < price) {
    const short = price - state.coins;
    setShopNote(
      `You need ${formatCoins(short)} more coin${short === 1 ? '' : 's'} for ${entry.name}. Launch the tree to earn more!`
    );
    sound.denied();
    return;
  }

  state.coins -= price;
  state.owned.add(id);
  state.selected = id;
  sound.buy();
  saveProgress();
  recordCollection();
  renderShop();
  renderAlbum();
  renderTray();
  updateHud();
  town.setSelectionActive(true);
  setShopNote(`${entry.name} is yours! It is selected and ready to hang.`);
  setMessage(`${entry.name} added to your collection. Tap a branch to hang it.`);
  if (window.matchMedia('(max-width: 1040px)').matches) {
    closeShopRail();
    shopButton?.focus({ preventScroll: true });
  }
}

function selectShopTab(tab) {
  const target = SHOP_TABS.includes(tab) ? tab : 'shop';
  SHOP_TABS.forEach((key) => {
    const button = document.querySelector(`#tab-${key}`);
    const panel = shopPanels[key];
    if (button) button.setAttribute('aria-selected', String(key === target));
    if (panel) panel.hidden = key !== target;
  });
}

function openShopRail(tab = 'shop') {
  selectShopTab(tab);
  shopRail?.classList.add('is-open');
  shopButton?.setAttribute('aria-expanded', 'true');
  window.requestAnimationFrame(() => {
    document.querySelector(`#tab-${tab}`)?.focus({ preventScroll: true });
  });
}

function closeShopRail() {
  shopRail?.classList.remove('is-open');
  shopButton?.setAttribute('aria-expanded', 'false');
  if (document.activeElement && shopRail?.contains(document.activeElement)) {
    shopButton?.focus({ preventScroll: true });
  }
}

function setShopNote(text) {
  shopNote.textContent = text;
  shopNote.classList.add('shop-note-flash');
  window.clearTimeout(shopNoteTimer);
  shopNoteTimer = window.setTimeout(() => {
    shopNote.textContent = SHOP_NOTE_DEFAULT;
    shopNote.classList.remove('shop-note-flash');
  }, 4200);
}

// ---------------------------------------------------------------- picking
function handleTap(pick) {
  if (!town || state.busy || !pick) return;
  disarmLaunch();

  if (pick.type === 'ornament') {
    takeDown(pick.slotIndex);
    return;
  }

  if (pick.type === 'slot') {
    const slot = town.slots[pick.slotIndex];
    if (!slot) return;
    if (slot.ornament) {
      takeDown(pick.slotIndex);
      return;
    }
    if (!state.selected) {
      setMessage(
        state.hung.size === town.slots.length
          ? 'The tree is full! Take something down or launch it.'
          : 'Pick an ornament from your tray first.'
      );
      sound.denied();
      return;
    }

    const entry = ORNAMENT_BY_ID.get(state.selected);
    if (!entry) return;
    const group = modelFor(entry);
    if (!town.placeOrnament(pick.slotIndex, group)) return;

    state.hung.set(pick.slotIndex, entry.id);
    const next = readyEntries()[0];
    state.selected = next ? next.id : null;
    town.setSelectionActive(Boolean(state.selected));
    sound.hang();
    saveProgress();
    renderTray();
    updateHud();

    if (next) {
      setMessage(`${entry.name} is on the tree! Next up: tap a spot for ${next.name}.`);
    } else {
      setMessage(
        state.hung.size === town.slots.length
          ? 'The whole tree is full. Time to launch!'
          : 'All your ornaments are hanging. Launch the tree when you are ready!'
      );
    }
    return;
  }
}

function handleHover(pick) {
  if (!town) return;
  if (pick && pick.type === 'slot') {
    town.highlightSlot(pick.slotIndex);
    town.renderer.domElement.style.cursor =
      pick.slotIndex >= 0 && (state.selected || town.slots[pick.slotIndex]?.ornament) ? 'pointer' : 'grab';
  } else if (pick && (pick.type === 'ornament' || pick.type === 'landmark')) {
    town.highlightSlot(-1);
    town.renderer.domElement.style.cursor = 'pointer';
  } else {
    town.highlightSlot(-1);
    town.renderer.domElement.style.cursor = '';
  }
}

function takeDown(slotIndex) {
  const group = town.removeOrnament(slotIndex);
  if (!group) return;
  const entry = group.userData.entry;
  state.hung.delete(slotIndex);
  state.selected = entry?.id || state.selected;
  town.setSelectionActive(Boolean(state.selected));
  sound.unhang();
  saveProgress();
  renderTray();
  updateHud();
  setMessage(`${entry?.name || 'That ornament'} is back in your tray.`);
}

function takeAllDown() {
  if (state.busy) return;
  disarmLaunch();
  const slots = [...state.hung.keys()];
  slots.forEach((slotIndex) => town.removeOrnament(slotIndex));
  state.hung.clear();
  normaliseSelection();
  sound.unhang();
  saveProgress();
  renderTray();
  updateHud();
  setMessage('All ornaments are back in your tray. Pick one to start again.');
}

// ---------------------------------------------------------------- launching
function calculatePayout(landmarkBonus) {
  const items = hungEntries();
  const count = items.length;
  const treeValue = items.reduce((sum, entry) => sum + priceOf(entry), 0);
  const holidays = new Set(items.map((entry) => entry.holiday)).size;
  const base = 40 + count * 10;
  const valueShare = Math.round(treeValue * 0.4);
  const variety = holidays * 30;
  const total = base + valueShare + variety + Math.round(landmarkBonus);
  return { items, count, treeValue, holidays, base, valueShare, variety, landmarkBonus, total };
}

function armLaunch() {
  if (state.busy || state.hung.size === 0) return;
  state.armed = true;
  updateHud();
  sound.countdown();
  setMessage('Ready? Click again to launch the tree at a random part of town!');
  window.clearTimeout(state.armTimer);
  state.armTimer = window.setTimeout(() => {
    state.armed = false;
    updateHud();
    setMessage('Launch cancelled. The tree is staying put — for now.');
  }, 4800);
}

function disarmLaunch() {
  if (!state.armed) return;
  state.armed = false;
  window.clearTimeout(state.armTimer);
  updateHud();
}

function startLaunch() {
  if (!town || state.busy || state.hung.size === 0) return;
  state.busy = true;
  closeShopRail();
  state.armed = false;
  window.clearTimeout(state.armTimer);
  town.setSelectionActive(false);
  town.setInteractive(false);

  const candidates = town.landmarks.filter((landmark) => !landmark.destroyed);
  const landmark =
    candidates[Math.floor(Math.random() * candidates.length)] || town.landmarks[0];
  const payout = calculatePayout(80 + Math.random() * 60 + state.hung.size * 4);
  state.pending = { payout, landmark };

  countdownValue.textContent = '3';
  countdownSub.textContent = 'Hold on to your baubles…';
  launchOverlay.classList.add('show');
  launchOverlay.classList.remove('flying');
  launchOverlay.setAttribute('aria-hidden', 'false');
  updateHud();

  state.cutscene = createCutscene({
    town,
    landmark,
    reducedMotion: REDUCED_MOTION,
    onEvent: handleCutsceneEvent,
    onComplete: finishCutscene,
  });
}

function handleCutsceneEvent(event) {
  if (event.type === 'countdown') {
    countdownValue.textContent = String(event.value);
    sound.countdown();
  } else if (event.type === 'liftoff') {
    countdownValue.textContent = 'LIFTOFF!';
    countdownSub.textContent = 'The tree is airborne. Please stand clear of the baubles.';
    sound.launch();
    window.setTimeout(() => launchOverlay.classList.add('flying'), REDUCED_MOTION ? 350 : 800);
  } else if (event.type === 'impact') {
    sound.boom();
  }
}

function finishCutscene() {
  if (!state.pending) return;
  state.finishedCutscene = state.cutscene;
  state.cutscene = null;
  launchOverlay.classList.remove('show', 'flying');
  launchOverlay.setAttribute('aria-hidden', 'true');
  showResults(state.pending.payout, state.pending.landmark);
  sound.fanfare();
}

function showResults(payout, landmark) {
  const headlines = [
    `${landmark.name} flattened by flying tree`,
    `Rocket tree lands on ${landmark.name}`,
    `Town tree visits ${landmark.name}, uninvited`,
    `${landmark.name} reduced to confetti`,
  ];
  const decks = [
    'All ornaments recovered. No one hurt. Baker offers free cookies.',
    'Tree reported “very sorry” before returning to the square.',
    'Officials praise emergency services, suggest gentler decorations.',
    'Crowd cheered. Landmark rebuilds overnight. Ornaments warm but fine.',
  ];
  const copies = [
    'The town tree left its square this afternoon and landed with considerable enthusiasm on a local landmark. Officials described the damage as “mostly crumbs.” All ornaments were returned to their owner, who immediately began hanging them again.',
    'Witnesses say the tree wiggled twice before departing. It travelled in a neat arc, paused politely above the roof, and then sat down rather hard. The ornaments were found in a tidy pile, slightly warm but otherwise perfect.',
    'Nobody was inside the building at the time, because everybody was outside watching the tree fly. The mayor has asked residents not to attach rockets to any more municipal landscaping without filling in the proper form.',
  ];

  paperDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  paperHeadline.textContent = headlines[Math.floor(Math.random() * headlines.length)];
  paperDeck.textContent = decks[Math.floor(Math.random() * decks.length)];
  paperCopy.textContent = copies[Math.floor(Math.random() * copies.length)];

  const rows = [
    ['Base launch fee', payout.base],
    [`Tree value · ${payout.count} ornament${payout.count === 1 ? '' : 's'}`, payout.valueShare],
    [`Holiday variety · ${payout.holidays} holiday${payout.holidays === 1 ? '' : 's'}`, payout.variety],
    [`Landing bonus · ${landmark.name}`, Math.round(payout.landmarkBonus)],
  ];
  payoutLines.replaceChildren(
    ...rows.map(([label, value]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;
      const td = document.createElement('td');
      td.textContent = `+${formatCoins(value)}`;
      tr.append(th, td);
      return tr;
    })
  );
  payoutTotal.textContent = `${formatCoins(payout.total)} coins`;
  paperNote.textContent = `${payout.count} ornament${payout.count === 1 ? '' : 's'} recovered • ${landmark.name} rebuilds overnight • 0 people inside`;

  if (!resultsDialog.open) resultsDialog.showModal();
}

function onResultsClosed() {
  if (!state.pending || !town) return;
  const { payout, landmark } = state.pending;
  state.pending = null;

  state.coins += payout.total;
  state.launches += 1;
  state.bestPayout = Math.max(state.bestPayout, payout.total);
  state.hung.clear();
  town.resetTree();
  town.restoreLandmarks();
  town.setCameraLocked(false);
  town.frameTree();
  town.setInteractive(true);

  if (state.finishedCutscene) {
    state.finishedCutscene.cleanup();
    state.finishedCutscene = null;
  }

  state.busy = false;
  normaliseSelection();
  renderTray();
  renderAlbum();
  renderShop();
  updateHud();
  saveProgress();
  recordCollection();

  setMessage(
    `The town rebuilt ${landmark.name}. You earned ${formatCoins(payout.total)} coins — spend them on fancier ornaments!`
  );
}

// -------------------------------------------------------------- controls
if (town) {
  window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  window.addEventListener('keydown', () => sound.unlock(), { once: true });

  shopButton.addEventListener('click', () => {
    if (state.busy) return;
    if (shopRail?.classList.contains('is-open')) {
      closeShopRail();
      return;
    }
    sound.click();
    renderShop();
    setShopNote(SHOP_NOTE_DEFAULT);
    openShopRail('shop');
  });

  shopTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.id.replace('tab-', '');
      selectShopTab(target);
      if (target === 'shop') renderShop();
      if (target === 'album') renderAlbum();
      sound.click();
    });
  });

  shopClose.addEventListener('click', () => {
    sound.click();
    closeShopRail();
  });

  muteButton.addEventListener('click', () => {
    sound.setEnabled(!sound.isEnabled());
    if (sound.isEnabled()) sound.click();
    updateMuteButton();
    saveProgress();
  });

  fullscreenButton.addEventListener('click', () => {
    const game = document.querySelector('#xm-game');
    if (!document.fullscreenElement) {
      game?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenButton);

  launchButton.addEventListener('click', () => {
    if (state.busy) return;
    if (state.hung.size === 0) {
      setMessage('Hang at least one ornament on the tree first!');
      sound.denied();
      return;
    }
    if (!state.armed) armLaunch();
    else startLaunch();
  });

  removeAllButton.addEventListener('click', takeAllDown);

  skipButton.addEventListener('click', () => {
    state.cutscene?.skip();
  });

  resultsClose.addEventListener('click', () => {
    resultsDialog.close();
  });

  resultsDialog.addEventListener('close', onResultsClosed);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.pause();
    else sound.resume();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (shopRail?.classList.contains('is-open')) {
      closeShopRail();
      return;
    }
    if (state.armed) disarmLaunch();
    else if (state.selected && !state.busy) {
      state.selected = null;
      town.setSelectionActive(false);
      renderTray();
      setMessage('Ornament put down. Pick another one whenever you like.');
    }
  });

  window.addEventListener('beforeunload', saveProgress);
}

function updateMuteButton() {
  const enabled = sound.isEnabled();
  muteButton.textContent = enabled ? '🔊' : '🔇';
  muteButton.setAttribute('aria-pressed', String(!enabled));
  muteButton.setAttribute(
    'aria-label',
    enabled ? 'Mute music and sounds' : 'Turn music and sounds on'
  );
}

function updateFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? '⤢' : '⛶';
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute(
    'aria-label',
    active ? 'Leave full screen' : 'Play in full screen'
  );
}

// --------------------------------------------------------------- game loop
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  elapsed += dt;

  if (town) {
    town.update(dt, elapsed);
    if (state.cutscene) state.cutscene.update(dt);
    town.renderer.render(town.scene, town.camera);
  }
  requestAnimationFrame(frame);
}

// Exposed for the automated smoke test and for curious players.
window.christmasTrees = {
  get state() {
    return state;
  },
  get town() {
    return town;
  },
  calculatePayout,
};
