/*
 * Survive Thanksgiving 2026 — flow, story and scoring.
 */

import { chapters, TitleScene } from './chapters.js';
import {
  fitCanvas,
  beginFrame,
  endFrame,
  updateSnow,
  updateParticles,
  drawParticles,
  input,
  endInputFrame,
  resetInput,
  initAudio,
  toggleMute,
  isMuted,
  ctx,
} from './core.js';
import { submitScore, getBest } from '../../../utils/scores.js';

const GAME_ID = 'survive-thanksgiving';

const overlay = document.getElementById('overlay');
const overlayEyebrow = document.getElementById('overlay-eyebrow');
const overlayTitle = document.getElementById('overlay-title');
const overlayCopy = document.getElementById('overlay-copy');
const overlayExtra = document.getElementById('overlay-extra');
const overlayTip = document.getElementById('overlay-tip');
const overlayButton = document.getElementById('overlay-button');
const chapterLabel = document.getElementById('chapter-label');
const chapterDots = document.getElementById('chapter-dots');
const scoreLabel = document.getElementById('score-label');
const muteButton = document.getElementById('mute-button');
const fullscreenButton = document.getElementById('fullscreen-button');
const shell = document.querySelector('.tg-shell');

const titleScene = new TitleScene();
const PHONE_LAYOUT = window.matchMedia(
  '(max-width: 760px), (max-height: 520px) and (max-width: 1000px)'
);

const state = {
  mode: 'title',
  index: -1,
  scene: null,
  results: [],
  total: 0,
  submitted: false,
};

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

const STORIES = [
  {
    eyebrow: "7:04 a.m. · Grandma's house",
    title: 'Four inches of snow',
    copy: [
      { speaker: 'Dad', text: 'The biscuits. I was supposed to get the biscuits.' },
      { speaker: 'Grandma', text: 'Roads are slicker than a buttered drumstick, honey.' },
      { speaker: 'Jira', text: 'Can we come?' },
      { speaker: 'Mom', text: 'Two pairs of socks and no complaining.' },
      { speaker: 'Joel', text: 'I have four pairs of socks.' },
    ],
    tip: 'Chapter 1 · The Biscuit Run',
    button: 'Dad heads out',
  },
  {
    eyebrow: "9:12 a.m. · Aunt Pat's house",
    title: 'The turkey situation',
    copy: [
      { speaker: 'Aunt Pat', text: 'Power went out at 3 a.m. My oven is a very expensive breadbox.' },
      { speaker: 'Mom', text: 'We have a camp stove and a lot of determination.' },
      { speaker: 'Aunt Pat', text: 'That turkey has been cold for six hours. SIX.' },
      { speaker: 'Jira', text: 'We can keep the fire going.' },
      { speaker: 'Joel', text: "I'll hold the flashlight." },
    ],
    tip: 'Chapter 2 · The Turkey Situation',
    button: 'Light the stove',
  },
  {
    eyebrow: '11:58 a.m. · The backyard',
    title: 'The cousins are ready',
    copy: [
      { speaker: 'CJ', text: 'You two are going down. I have been practicing on the mailbox.' },
      { speaker: 'Jira', text: 'That is not the flex you think it is.' },
      { speaker: 'Joel', text: 'There are... so many cousins.' },
      { speaker: 'Aunt Pat', text: 'Nobody hits anybody in the face! ...Okay, one in the face.' },
    ],
    tip: "Chapter 3 · The Cousins' Snowball War",
    button: 'Start the snowball fight',
  },
  {
    eyebrow: "12:35 p.m. · Aunt Pat's yard",
    title: 'The pickle bandit strikes',
    copy: [
      { speaker: 'CJ', text: "The snowball war was a warm-up. Grandma's pickles are the real prize." },
      { speaker: 'Aunt Pat', text: 'Those pickles are for dinner. Keep that jar away from him.' },
      { speaker: 'Jira', text: 'He has a little mask. He planned this.' },
      { speaker: 'Joel', text: 'I respect the commitment.' },
    ],
    tip: 'Chapter 4 · The Pickle Bandit',
    button: 'Guard the jar',
  },
  {
    eyebrow: '1:40 p.m. · The playground',
    title: 'Penguin rules',
    copy: [
      { speaker: 'Mom', text: 'Twenty minutes before the wet socks become a problem.' },
      { speaker: 'Dad', text: 'Belly first. That is the penguin way.' },
      { speaker: 'Jira', text: 'The slide is a giant ice cube and I have never been happier.' },
      { speaker: 'Joel', text: 'I am going to get SO wet.' },
    ],
    tip: 'Chapter 5 · Penguin Slides',
    button: 'Climb the slide',
  },
  {
    eyebrow: "4:58 p.m. · Back at Grandma's",
    title: 'Screen time, final boss',
    copy: [
      { speaker: 'Jira', text: 'Just a minute on the iPad.' },
      { speaker: 'Joel', text: 'And my Switch. For my hands.' },
      { speaker: 'Grandma', text: 'Your brains are going to turn into mashed potatoes.' },
      { speaker: 'Mom', text: 'Twenty-five minutes. Then we look at a wall.' },
    ],
    tip: 'Chapter 6 · Brain Rot Battle',
    button: 'One last level',
  },
];

const RESULTS = [
  {
    title: 'Biscuits secured!',
    text: 'Dad made it home with the good biscuits — the ones with extra butter. The car has a snow hat and one new noise that nobody will explain.',
  },
  {
    title: 'The turkey is saved!',
    text: "Aunt Pat's turkey came out golden, and only a little smoky. The power came back at 11:40, which everyone agreed was hilarious.",
  },
  {
    title: 'CJ has been defeated',
    text: "CJ demanded a rematch, then demanded hot chocolate. He also kept looking at Grandma's pickle jar.",
  },
  {
    title: 'The pickles are safe!',
    text: "CJ made a run for Grandma's pickles and got exactly zero. He says he was just checking the brine.",
  },
  {
    title: 'Maximum wetness',
    text: "Three slides, three splashes, and one Mom-and-Dad double slide the penguins rated 'extremely undignified.' The car seats are soaked.",
  },
  {
    title: 'No brain rot today',
    text: 'Mom unplugged the iPad and Dad hid the Switch in the biscuit bag. Everyone looked at an actual wall for ten whole minutes. It was terrible. Then it was fine.',
  },
];

const FINAL_COPY = [
  'Four inches of snow, one rescued turkey, a defeated cousin, one pickle heist, three penguin slides and one very long day.',
  'Grandma says come back next year — she is making pie.',
];

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

function renderCopy(blocks) {
  overlayCopy.replaceChildren(
    ...blocks.map((block) => {
      const paragraph = document.createElement('p');
      if (typeof block === 'string') {
        paragraph.textContent = block;
      } else if (block.speaker) {
        const speaker = document.createElement('strong');
        speaker.textContent = `${block.speaker}:`;
        paragraph.append(speaker, document.createTextNode(` ${block.text}`));
      } else {
        paragraph.textContent = block.plain || block.text || '';
      }
      return paragraph;
    })
  );
}

function renderExtra(rows) {
  if (!rows || !rows.length) {
    overlayExtra.hidden = true;
    overlayExtra.replaceChildren();
    return;
  }
  overlayExtra.hidden = false;
  overlayExtra.replaceChildren(
    ...rows.map((row) => {
      const line = document.createElement('div');
      line.className = 'tg-breakdown-row';
      const rowName = row[0];
      if (rowName === 'Total') line.classList.add('is-total');
      if (rowName === 'Best') line.classList.add('is-best');
      const name = document.createElement('span');
      name.textContent = rowName;
      const value = document.createElement('strong');
      value.textContent = typeof row[1] === 'number' ? row[1].toLocaleString('en-US') : row[1];
      line.append(name, value);
      return line;
    })
  );
}

let overlayAction = null;

function showOverlay(config) {
  overlay.hidden = false;
  overlay.classList.add('is-open');
  document.body.classList.remove('tg-playing');
  overlayEyebrow.textContent = config.eyebrow || '';
  overlayTitle.textContent = config.title || '';
  renderCopy(config.copy || []);
  renderExtra(config.extra);
  overlayTip.hidden = !config.tip;
  overlayTip.textContent = config.tip || '';
  overlayButton.textContent = config.button || 'Continue';
  overlayAction = config.onStart || null;
  requestAnimationFrame(() => overlayButton.focus({ preventScroll: true }));
}

function hideOverlay() {
  overlay.classList.remove('is-open');
  overlay.hidden = true;
  overlayAction = null;
}

overlayButton.addEventListener('click', () => {
  initAudio();
  if (typeof overlayAction === 'function') overlayAction();
});

/* ------------------------------------------------------------------ */
/* HUD and flow                                                        */
/* ------------------------------------------------------------------ */

function renderDots() {
  chapterDots.replaceChildren(
    ...chapters.map((chapter, index) => {
      const dot = document.createElement('span');
      dot.className = 'tg-dot';
      if (index < state.index) dot.classList.add('is-done');
      if (index === state.index) dot.classList.add('is-active');
      dot.title = `Chapter ${index + 1} · ${chapter.label}`;
      return dot;
    })
  );
}

function updateHud() {
  if (state.index >= 0) {
    const chapter = chapters[state.index];
    chapterLabel.textContent = PHONE_LAYOUT.matches
      ? `Ch. ${state.index + 1}/${chapters.length} · ${chapter.phoneLabel || chapter.label}`
      : `Chapter ${state.index + 1} of ${chapters.length} · ${chapter.label}`;
  } else {
    chapterLabel.textContent = 'The day begins';
  }
  scoreLabel.textContent = state.total.toLocaleString('en-US');
  renderDots();
}

function startChapter(index) {
  if (!chapters[index]) return;
  initAudio();
  state.index = index;
  state.mode = 'play';
  state.scene = chapters[index].make(finishChapter);
  hideOverlay();
  resetInput();
  updateHud();
  document.body.classList.add('tg-playing');
  ctx.canvas.focus({ preventScroll: true });
}

function showStory(index) {
  state.index = index;
  state.mode = 'story';
  state.scene = null;
  updateHud();
  const story = STORIES[index];
  showOverlay({
    eyebrow: story.eyebrow,
    title: story.title,
    copy: story.copy,
    tip: story.tip,
    button: story.button,
    onStart: () => startChapter(index),
  });
}

function finishChapter(result) {
  const index = state.index;
  state.results[index] = result;
  state.total = state.results.reduce((sum, entry) => sum + (entry?.score || 0), 0);
  updateHud();
  state.mode = 'result';
  document.body.classList.remove('tg-playing');

  const resultCopy = { ...RESULTS[index] };
  if (result.title) resultCopy.title = result.title;
  if (result.text) resultCopy.text = result.text;
  const blocks = [resultCopy.text];
  if (result.note) blocks.push(result.note);

  const lastChapter = index >= chapters.length - 1;
  showOverlay({
    eyebrow: `Chapter ${index + 1} complete`,
    title: resultCopy.title,
    copy: blocks,
    tip: `+${result.score.toLocaleString('en-US')} Thanksgiving points`,
    button: lastChapter ? 'See how the day went' : 'Next',
    onStart: () => {
      if (lastChapter) showFinal();
      else showStory(index + 1);
    },
  });
}

function showFinal() {
  state.mode = 'final';
  state.scene = null;
  document.body.classList.remove('tg-playing');

  let submission = null;
  if (!state.submitted) {
    submission = submitScore(GAME_ID, state.total);
    state.submitted = true;
  }
  const best = Math.max(state.total, submission?.best || 0, getBest(GAME_ID));

  const breakdown = chapters.map((chapter, index) => [
    `${index + 1}. ${chapter.label}`,
    state.results[index]?.score || 0,
  ]);
  breakdown.push(['Total', state.total]);
  breakdown.push(['Best', best]);

  const blocks = [...FINAL_COPY];
  if (submission?.isBest && state.total > 0) {
    blocks.push({ plain: 'New high score. Grandma is putting it on the fridge.' });
  }

  showOverlay({
    eyebrow: 'Thanksgiving survived',
    title: 'You survived Thanksgiving 2026',
    copy: blocks,
    extra: breakdown,
    tip:
      best > state.total
        ? `Your best so far is ${best.toLocaleString('en-US')} points.`
        : 'Every chapter, every cousin, every biscuit.',
    button: 'Play it again',
    onStart: () => {
      state.results = [];
      state.total = 0;
      state.index = -1;
      state.scene = null;
      state.submitted = false;
      updateHud();
      showTitle();
    },
  });
}

function showTitle() {
  state.mode = 'title';
  state.scene = null;
  updateHud();
  showOverlay({
    eyebrow: 'A Foofire Thanksgiving',
    title: 'Survive Thanksgiving 2026',
    copy: [
      'Four inches of snow. One turkey with no electricity. A cousin with a very good throwing arm and a suspicious interest in pickles.',
      'Help Jira and Joel get through Thanksgiving — one chapter at a time.',
    ],
    tip: 'Six chapters · Mouse, touch or keyboard · No fail states',
    button: 'Start the day',
    onStart: () => showStory(0),
  });
}

/* ------------------------------------------------------------------ */
/* Mute                                                                */
/* ------------------------------------------------------------------ */

function refreshMuteButton() {
  const muted = isMuted();
  muteButton.textContent = muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
}

muteButton.addEventListener('click', () => {
  initAudio();
  toggleMute();
  refreshMuteButton();
});

fullscreenButton.addEventListener('click', async () => {
  initAudio();
  try {
    if (!document.fullscreenElement) await shell.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    /* Full screen can be blocked by the browser; the game plays either way. */
  }
});

document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-pressed', String(active));
  fullscreenButton.setAttribute('aria-label', active ? 'Leave full screen' : 'Play in full screen');
  requestAnimationFrame(fitCanvas);
});

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
  last = now;

  titleScene.update(dt);
  updateSnow(dt);
  updateParticles(dt);
  if (state.mode === 'play' && state.scene) state.scene.update(dt);

  beginFrame();
  if (state.scene && (state.mode === 'play' || state.mode === 'result')) {
    state.scene.draw(ctx);
  } else {
    titleScene.draw(ctx);
  }
  drawParticles(ctx);
  endFrame();

  endInputFrame();
  requestAnimationFrame(frame);
}

function boot() {
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  PHONE_LAYOUT.addEventListener?.('change', updateHud);
  if (window.ResizeObserver) {
    new ResizeObserver(fitCanvas).observe(document.getElementById('game-stage'));
  }
  refreshMuteButton();
  updateHud();
  showTitle();
  requestAnimationFrame(frame);

  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__tg = {
      state,
      chapters,
      startChapter,
      showStory,
      showFinal,
      showTitle,
      finishChapter,
      input,
    };
  }
}

document.addEventListener('visibilitychange', () => {
  /* Coming back from another tab should not leave the car steering forever. */
  input.down = false;
  last = performance.now();
});

boot();
