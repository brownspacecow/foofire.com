import { HOUSES } from '../content.js';
import { getState, startGame, subscribe } from '../store.js';

const CASTLE = `
<svg class="onboarding-castle" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="castleStone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a1f4c" />
      <stop offset="100%" stop-color="#120c26" />
    </linearGradient>
    <radialGradient id="windowGlow">
      <stop offset="0%" stop-color="#ffe6a0" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#ffbf5e" stop-opacity="0" />
    </radialGradient>
  </defs>
  <path d="M0 420 L0 340 L70 340 L70 260 L130 260 L130 320 L230 320 L230 190 L250 190 L250 120 L270 190 L290 190 L290 320 L360 320 L360 250 L420 250 L420 350 L520 350 L520 150 L560 150 L560 60 L600 10 L640 60 L640 150 L690 150 L690 330 L760 330 L760 240 L820 240 L820 320 L900 320 L900 210 L940 210 L940 320 L1020 320 L1020 260 L1090 260 L1090 340 L1200 340 L1200 420 Z" fill="url(#castleStone)" stroke="#46366f" stroke-width="3" />
  <g>
    <circle cx="292" cy="246" r="57" fill="url(#windowGlow)" />
    <circle cx="575" cy="182" r="66" fill="url(#windowGlow)" />
    <circle cx="575" cy="244" r="66" fill="url(#windowGlow)" />
    <circle cx="742" cy="268" r="53" fill="url(#windowGlow)" />
    <circle cx="924" cy="256" r="48" fill="url(#windowGlow)" />
    <circle cx="184" cy="260" r="44" fill="url(#windowGlow)" />
  </g>
  <path d="M292 220 Q318 220 318 246 L318 272 L266 272 L266 246 Q266 220 292 220 Z" fill="#ffd98a" opacity="0.9" />
  <path d="M575 152 Q605 152 605 182 L605 214 L545 214 L545 182 Q545 152 575 152 Z" fill="#ffd98a" opacity="0.9" />
  <path d="M575 214 Q605 214 605 244 L605 276 L545 276 L545 244 Q545 214 575 214 Z" fill="#ffd98a" opacity="0.8" />
  <path d="M742 244 Q766 244 766 268 L766 296 L718 296 L718 268 Q718 244 742 244 Z" fill="#ffd98a" opacity="0.85" />
  <path d="M924 234 Q946 234 946 256 L946 282 L902 282 L902 256 Q902 234 924 234 Z" fill="#ffd98a" opacity="0.85" />
  <path d="M184 240 Q204 240 204 260 L204 282 L164 282 L164 260 Q164 240 184 240 Z" fill="#ffd98a" opacity="0.8" />
  <path d="M500 420 L500 360 L560 360 L560 420 Z" fill="#241837" stroke="#6d58a3" stroke-width="3" />
  <path d="M560 420 L560 360 Q530 300 500 360 L500 420 Z" fill="#2a1c40" opacity="0.4" />
</svg>`;

function loadingMarkup() {
  return `
    <div class="onboarding onboarding-loading">
      <div class="loading-sigil" aria-hidden="true"><span>✦</span></div>
      <h1>Earwarts Academy</h1>
      <p class="loading-copy">Lighting the candles…</p>
      <p class="sr-only" role="status">Loading the castle</p>
    </div>`;
}

function housesMarkup(selected) {
  return HOUSES.map((house) => {
    const isSelected = selected === house.id;
    return `
      <button type="button" role="radio" aria-checked="${isSelected}" class="house-card${isSelected ? ' selected' : ''}" data-house="${house.id}" style="--house-color:${house.color};--house-glow:${house.glow}">
        <span class="house-sigil" aria-hidden="true">${house.sigil}</span>
        <span class="house-name">${house.name}</span>
        <span class="house-motto">${house.motto}</span>
        ${isSelected ? '<span class="house-check" aria-hidden="true">✓</span>' : ''}
      </button>`;
  }).join('');
}

function formMarkup(selected) {
  return `
    <div class="onboarding">
      <div class="onboarding-stars" aria-hidden="true"></div>
      ${CASTLE}
      <div class="onboarding-scroll">
        <header class="onboarding-header">
          <p class="onboarding-kicker">A listening adventure</p>
          <h1>Earwarts<span>Academy</span></h1>
          <p class="onboarding-lede">A castle that only opens for people who know how to listen. Wander moonlit halls, learn spells by ear, and wake the wings one note at a time.</p>
        </header>
        <div class="onboarding-step">
          <label class="magic-label" for="apprentice-name">What shall we call you?</label>
          <input id="apprentice-name" class="magic-input" maxlength="24" autocomplete="off" placeholder="Apprentice" />
        </div>
        <fieldset class="onboarding-step house-step">
          <legend class="magic-label">Choose your house</legend>
          <div class="house-grid" role="radiogroup" aria-label="Choose a house">${housesMarkup(selected)}</div>
          <p class="house-note">Houses are a costume, not a competition. Every house learns the same magic.</p>
        </fieldset>
        <p class="onboarding-hint" role="alert" hidden></p>
        <button class="primary-button onboarding-begin" type="button">Enter the castle</button>
        <p class="onboarding-foot">Sound begins when you press this button. Your adventure saves quietly in this browser — no account, no downloads.</p>
      </div>
    </div>`;
}

export function mountOnboarding(root) {
  let loadingRendered = false;
  let formRendered = false;
  let entered = false;
  let selectedHouse = null;
  let name = '';
  let busy = false;

  function render(state) {
    if (state.save.playerName) {
      entered = true;
      root.replaceChildren();
      return;
    }
    entered = false;
    if (!state.ready) {
      if (!loadingRendered) {
        root.innerHTML = loadingMarkup();
        loadingRendered = true;
      }
      return;
    }
    if (formRendered) return;
    formRendered = true;
    root.innerHTML = formMarkup(selectedHouse);
    const input = root.querySelector('#apprentice-name');
    const begin = root.querySelector('.onboarding-begin');
    const hint = root.querySelector('.onboarding-hint');
    if (!input || !begin || !hint) return;

    input.addEventListener('input', () => {
      name = input.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submit();
      }
    });
    root.querySelectorAll('[data-house]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedHouse = button.dataset.house;
        root.querySelectorAll('[data-house]').forEach((other) => {
          const active = other === button;
          other.classList.toggle('selected', active);
          other.setAttribute('aria-checked', String(active));
          const check = other.querySelector('.house-check');
          if (active && !check) {
            const badge = document.createElement('span');
            badge.className = 'house-check';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = '✓';
            other.append(badge);
          } else if (!active && check) {
            check.remove();
          }
        });
        hint.hidden = true;
      });
    });
    begin.addEventListener('click', () => void submit());

    async function submit() {
      if (busy) return;
      if (!selectedHouse) {
        hint.textContent = 'Choose a house first — any one will do. They are all friendly.';
        hint.hidden = false;
        return;
      }
      busy = true;
      begin.disabled = true;
      begin.textContent = 'Opening the gates…';
      try {
        await startGame(name, selectedHouse);
        root.replaceChildren();
      } catch {
        hint.textContent = 'The gates stuck for a moment. Try once more.';
        hint.hidden = false;
      } finally {
        busy = false;
        if (!getState().save.playerName) {
          begin.disabled = false;
          begin.textContent = 'Enter the castle';
        }
      }
    }
  }

  const unsubscribe = subscribe((state) => {
    if (entered || state.save.playerName) return;
    render(state);
  });
  render(getState());
  void unsubscribe;
}
