import { games } from './data/games.js';
import { getScores } from './utils/scores.js';

const container = document.querySelector('#scoreboards');

const formatDate = (at) => {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
};

const renderBoard = (game) => {
  const scores = getScores(game.id);

  const section = document.createElement('section');
  section.className = 'scoreboard';

  const head = document.createElement('div');
  head.className = 'scoreboard-head';

  const title = document.createElement('h2');
  title.textContent = game.title;
  head.append(title);

  const play = document.createElement('a');
  play.className = 'scoreboard-play';
  play.href = game.path;
  play.textContent = scores.length ? 'Play again' : 'Play';
  head.append(play);

  section.append(head);

  if (!scores.length) {
    const empty = document.createElement('p');
    empty.className = 'scoreboard-empty';
    empty.textContent = 'No scores yet — play a round and your best will show up here.';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ol');
  list.className = 'score-list';

  scores.forEach((entry, index) => {
    const row = document.createElement('li');
    row.className = index === 0 ? 'score-row is-best' : 'score-row';

    const rank = document.createElement('span');
    rank.className = 'score-rank';
    rank.textContent = `#${index + 1}`;

    const value = document.createElement('span');
    value.className = 'score-value';
    value.textContent = entry.score.toLocaleString('en-US');

    const when = document.createElement('span');
    when.className = 'score-date';
    when.textContent = formatDate(entry.at);

    row.append(rank, value, when);
    list.append(row);
  });

  section.append(list);
  return section;
};

if (container) {
  container.replaceChildren(...games.map(renderBoard));
}
