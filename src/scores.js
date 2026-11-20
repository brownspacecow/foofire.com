import { games } from './data/games.js';
import { getLatest, getScores } from './utils/scores.js';

const container = document.querySelector('#scoreboards');

/** Empty-state hints for games that track a collection. */
const COLLECTION_HINTS = {
  plushies: 'Nothing caught yet — play to start filling your Plushie Dex.',
  ornaments: 'Nothing collected yet — play to start filling your ornament album.',
};

const formatDate = (at) => {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
};

/** Collection games show a progress bar instead of a top-five list. */
const renderProgress = (game, collected) => {
  const { total, unit } = game.progress;
  const percent = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

  const wrap = document.createElement('div');
  wrap.className = 'score-progress';

  const head = document.createElement('div');
  head.className = 'score-progress-head';

  const count = document.createElement('span');
  count.className = 'score-progress-count';
  count.textContent = `${collected.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} ${unit} collected`;
  head.append(count);

  wrap.append(head);

  const track = document.createElement('div');
  track.className = 'score-progress-track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', `${unit.charAt(0).toUpperCase()}${unit.slice(1)} collected`);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(total));
  track.setAttribute('aria-valuenow', String(collected));

  const fill = document.createElement('span');
  fill.className = 'score-progress-fill';
  fill.style.width = `${percent}%`;
  track.append(fill);

  wrap.append(track);

  if (collected === 0) {
    const hint = document.createElement('p');
    hint.className = 'scoreboard-empty';
    hint.textContent =
      COLLECTION_HINTS[unit] ||
      `Nothing collected yet — play to start filling your ${unit} collection.`;
    wrap.append(hint);
  }

  return wrap;
};

const renderBoard = (game) => {
  const scores = getScores(game.id);
  const collected = game.progress ? getLatest(game.id) : 0;
  const hasProgress = game.progress ? collected > 0 : scores.length > 0;

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
  play.textContent = hasProgress ? 'Play again' : 'Play';
  head.append(play);

  section.append(head);

  if (game.progress) {
    section.append(renderProgress(game, collected));
    return section;
  }

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

const hasScores = (game) =>
  game.progress ? getLatest(game.id) > 0 : getScores(game.id).length > 0;

/** Games nobody has played yet get one compact card instead of a stack of empty boards. */
const renderUnplayed = (list) => {
  const section = document.createElement('section');
  section.className = 'scoreboard scoreboard-quiet';

  const head = document.createElement('div');
  head.className = 'scoreboard-head';

  const title = document.createElement('h2');
  title.textContent = 'No scores yet';
  head.append(title);
  section.append(head);

  const note = document.createElement('p');
  note.className = 'scoreboard-empty';
  note.textContent =
    'These games are waiting for a first run. Play one and its best lands at the top of this page.';
  section.append(note);

  const chips = document.createElement('ul');
  chips.className = 'score-empty-games';
  chips.append(
    ...list.map((game) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = game.path;
      link.textContent = game.title;
      item.append(link);
      return item;
    })
  );
  section.append(chips);

  return section;
};

if (container) {
  const played = games.filter(hasScores);
  const unplayed = games.filter((game) => !hasScores(game));
  const sections = played.map(renderBoard);
  if (unplayed.length) sections.push(renderUnplayed(unplayed));
  container.replaceChildren(...sections);
}
