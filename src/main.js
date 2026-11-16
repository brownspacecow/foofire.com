const games = [
  {
    id: 'roller',
    title: 'Roller',
    description: 'Roll the red ball to the green goal using arrow keys or WASD.',
    path: './src/games/roller/index.html',
  },
  {
    id: 'zombie-deer',
    title: 'Zombie Deer: Christmas Edition',
    description: 'Defend a snow-covered house from waves of zombie reindeer. Throw snowballs, light up the tree, and call Bear the puppy for backup.',
    path: './src/games/zombie-deer/index.html',
  },
  {
    id: 'bear',
    title: 'Bear the Puppy',
    description: 'Take care of Bear, a cute black and white Shih Tzu puppy. Feed him, play fetch, and tuck him into bed!',
    path: './src/games/bear/index.html',
  },
];

const gamesGrid = document.querySelector('#games-grid');
const gameCards = document.querySelector('#game-cards');

const renderGameList = (container, list) => {
  if (!container) return;
  container.replaceChildren(
    ...list.map((game) => {
      const card = document.createElement('article');
      card.className = 'game-card';

      const title = document.createElement('h3');
      title.textContent = game.title;
      card.append(title);

      const desc = document.createElement('p');
      desc.textContent = game.description;
      card.append(desc);

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
