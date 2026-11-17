import { games } from './data/games.js';
import { getBest } from './utils/scores.js';

const gamesGrid = document.querySelector('#games-grid');
const gameCards = document.querySelector('#game-cards');

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
      link.textContent = 'Play';
      link.className = 'primary-button';
      card.append(link);

      return card;
    })
  );
};

const init = () => {
  renderGameList(gamesGrid, games);
  renderGameList(gameCards, games);
};

init();
