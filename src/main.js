import { games } from './data/games.js';
import { getBest } from './utils/scores.js';

const gamesGrid = document.querySelector('#games-grid');
const gameCards = document.querySelector('#game-cards');
const libraryCount = document.querySelector('#library-count');
const searchInput = document.querySelector('#game-search');
const filterButtons = document.querySelectorAll('[data-category-filter]');
const filterCount = document.querySelector('#filter-count');
const noResults = document.querySelector('#no-results');

const CATEGORY_LABELS = {
  adventure: 'Adventure',
  racing: 'Racing',
  music: 'Music',
  arcade: 'Arcade',
  cozy: 'Cozy',
};

/* The games array is append-ordered, so its tail is the newest work. */
const LATEST_GAMES_COUNT = 7;

const categoryLabel = (game) => CATEGORY_LABELS[game.category] || 'Game';

const renderGameList = (container, list) => {
  if (!container) return;
  container.replaceChildren(
    ...list.map((game) => {
      const card = document.createElement('article');
      card.className = 'game-card';

      if (game.image) {
        const shot = document.createElement('img');
        shot.className = 'game-card-shot';
        shot.src = game.image;
        shot.alt = `Screenshot of ${game.title}`;
        shot.loading = 'lazy';
        shot.decoding = 'async';
        card.append(shot);
      }

      const tag = document.createElement('p');
      tag.className = 'game-card-category';
      tag.textContent = categoryLabel(game);
      card.append(tag);

      const title = document.createElement('h3');
      title.textContent = game.title;
      card.append(title);

      const desc = document.createElement('p');
      desc.textContent = game.description;
      card.append(desc);

      const best = getBest(game.id);
      if (best > 0) {
        const bestEl = document.createElement('p');
        bestEl.className = 'game-card-best';
        bestEl.textContent = `🏆 Best ${best.toLocaleString('en-US')}`;
        card.append(bestEl);
      }

      const link = document.createElement('a');
      link.href = game.path;
      link.textContent = best > 0 ? 'Play again' : 'Play';
      link.className = 'primary-button';
      card.append(link);

      return card;
    })
  );
};

/** Games page only: live search + category filter, shareable via ?q=&category=. */
const initLibraryFilter = () => {
  if (!gameCards || !searchInput) return;

  const params = new URLSearchParams(window.location.search);
  let query = (params.get('q') || '').trim();
  let category = params.get('category') || 'all';
  if (!Object.hasOwn(CATEGORY_LABELS, category)) category = 'all';

  searchInput.value = query;

  const applyFilter = () => {
    const needle = query.toLowerCase();
    const filtered = games.filter((game) => {
      const matchesCategory = category === 'all' || game.category === category;
      const haystack = `${game.title} ${game.description} ${categoryLabel(game)}`.toLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });

    renderGameList(gameCards, filtered);

    filterButtons.forEach((button) => {
      const active = button.dataset.categoryFilter === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    if (filterCount) {
      filterCount.textContent =
        filtered.length === games.length
          ? `${games.length} games, all free and in your browser.`
          : `Showing ${filtered.length} of ${games.length} games.`;
    }
    if (noResults) noResults.hidden = filtered.length > 0;

    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (category !== 'all') next.set('category', category);
    const suffix = next.toString();
    window.history.replaceState(
      null,
      '',
      suffix ? `${window.location.pathname}?${suffix}` : window.location.pathname
    );
  };

  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim();
    applyFilter();
  });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      category = button.dataset.categoryFilter;
      applyFilter();
    });
  });

  applyFilter();
};

const init = () => {
  renderGameList(gamesGrid, games.slice(-LATEST_GAMES_COUNT).reverse());

  // The Games page re-renders through the filter; the home page keeps it simple.
  if (gameCards && searchInput) {
    initLibraryFilter();
  } else {
    renderGameList(gameCards, games);
  }

  if (libraryCount) {
    libraryCount.textContent = `${games.length} games, all free and in your browser.`;
  }
};

init();
