/**
 * Aisle Rush '85 — the show controller.
 * Title → team pick → six-question time bank → Big Sweep → checkout →
 * Bonus Sweep → final score. The canvas sweep lives in sweep.js.
 */

import {
  TEAMS,
  ROUND_NAMES,
  ROUND_INTROS,
  HOST_LINES,
  BONUS_TARGETS,
  buildQuiz,
  choicesFor,
  formatMoney,
  formatClock,
} from './content.js';
import { createSweep } from './sweep.js';
import { createShowAudio } from './audio.js';
import { createAutoPause } from '../../utils/auto-pause.js';
import { readMuted, writeMuted } from '../../utils/audio-prefs.js';
import { getBest, submitScore } from '../../utils/scores.js';
import { prefersReducedMotion } from '../../utils/motion.js';

const GAME_ID = 'aisle-rush';
const LEGACY_MUTE_KEY = 'aisle-rush-muted';
const QUESTION_SECONDS = 10;
const BASE_TIME = 90;

const $ = (id) => document.getElementById(id);

const showEl = $('aisle-show');

if (showEl) {
  const showStage = $('show-stage');
  const showFrame = $('show-frame');
  const showMute = $('show-mute');
  const showFullscreen = $('show-fullscreen');
  const showRestart = $('show-restart');
  const roundChip = $('show-round-chip');

  const titleBest = $('title-best');
  const startShow = $('start-show');
  const howtoOpen = $('howto-open');
  const howtoModal = $('howto-modal');
  const howtoClose = $('howto-close');
  const howtoStart = $('howto-start');

  const teamGrid = $('team-grid');
  const teamNote = $('team-note');
  const teamConfirm = $('team-confirm');

  const roundLabel = $('round-label');
  const quizRoundName = $('quiz-round-name');
  const quizProgress = $('quiz-progress');
  const podiums = $('podiums');
  const hostLine = $('host-line');
  const questionTag = $('question-tag');
  const questionText = $('question-text');
  const answerList = $('answer-list');
  const clockFill = $('clock-fill');
  const clockSeconds = $('clock-seconds');
  const buzzFeed = $('buzz-feed');

  const sweepIntroTeams = $('sweep-intro-teams');
  const sweepIntroNote = $('sweep-intro-note');
  const sweepIntroHost = $('sweep-intro-host');
  const startSweep = $('start-sweep');

  const sweepModeTitle = $('sweep-mode-title');
  const sweepTeamName = $('sweep-team-name');
  const sweepHud = $('sweep-hud');
  const bonusHud = $('bonus-hud');
  const hudTime = $('hud-time');
  const hudBanked = $('hud-banked');
  const hudCart = $('hud-cart');
  const hudSpace = $('hud-space');
  const capFill = $('cap-fill');
  const hudBonusTime = $('hud-bonus-time');
  const hudBonusProgress = $('hud-bonus-progress');
  const pauseBtn = $('pause-button');
  const bonusClueBar = $('bonus-clue-bar');
  const bonusClueNumber = $('bonus-clue-number');
  const bonusClueText = $('bonus-clue-text');
  const sweepTicker = $('sweep-ticker');
  const sweepCountdown = $('sweep-countdown');
  const sweepBanner = $('sweep-banner');
  const canvasWrap = $('canvas-wrap');
  const canvas = $('sweep-canvas');

  const checkoutHost = $('checkout-host');
  const receiptLines = $('receipt-lines');
  const receiptTotal = $('receipt-total');
  const checkoutTeams = $('checkout-teams');
  const checkoutResult = $('checkout-result');
  const checkoutNext = $('checkout-next');

  const bonusIntroHost = $('bonus-intro-host');
  const bonusPreviewClue = $('bonus-preview-clue');
  const startBonus = $('start-bonus');

  const finalKicker = $('final-kicker');
  const finalHeadline = $('final-headline');
  const finalSub = $('final-sub');
  const finalSweep = $('final-sweep');
  const finalBonus = $('final-bonus');
  const finalTotal = $('final-total');
  const finalBest = $('final-best');
  const finalNewBest = $('final-newbest');
  const finalCatch = $('final-catch');
  const playAgain = $('play-again');
  const finalConfetti = $('final-confetti');

  const audio = createShowAudio({ muted: readMuted(LEGACY_MUTE_KEY) });

  const state = {
    screen: 'title',
    teamIndex: 0,
    teams: [],
    quiz: [],
    questionIndex: 0,
    question: null,
    choices: [],
    resolved: true,
    playerLocked: false,
    questionToken: 0,
    questionStart: 0,
    timerRaf: 0,
    cpuTimer: 0,
    tickerTimer: 0,
    sweep: null,
    sweepStats: null,
    playerWon: false,
    bonusWon: false,
    bonusCash: 0,
    winnerIndex: -1,
    total: 0,
    submitted: false,
    autoPause: null,
  };

  const timers = new Set();

  const later = (fn, ms) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const cancelTimer = (id) => {
    if (!id) return;
    window.clearTimeout(id);
    timers.delete(id);
  };

  const clearLater = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };

  const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];
  const currentTeam = () => TEAMS[state.teamIndex];
  const currentEntry = () => state.teams[state.teamIndex];

  /* ---------------------------------------------------------------- *
   * Chrome, sound, fullscreen
   * ---------------------------------------------------------------- */

  function syncMute() {
    const muted = audio.isMuted();
    showMute.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    showMute.setAttribute('aria-pressed', String(muted));
    showMute.setAttribute(
      'aria-label',
      muted ? 'Sound is off. Turn sound on.' : 'Sound is on. Turn sound off.'
    );
  }

  syncMute();

  showMute.addEventListener('click', () => {
    const next = !audio.isMuted();
    if (!next) audio.unlock();
    audio.setMuted(next);
    writeMuted(next);
    syncMute();
    if (!next) audio.sfx('click');
  });

  if (typeof showEl.requestFullscreen !== 'function') {
    showFullscreen.hidden = true;
  }

  showFullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await showEl.requestFullscreen();
    } catch (error) {
      /* Some browsers refuse fullscreen; the show still plays. */
    }
  });

  document.addEventListener('fullscreenchange', () => {
    showFullscreen.textContent = document.fullscreenElement ? 'EXIT FULL SCREEN' : 'FULL SCREEN';
    state.sweep?.resize();
  });

  function setChip(text) {
    roundChip.textContent = text;
  }

  function showScreen(name) {
    state.screen = name;
    document.querySelectorAll('.screen').forEach((section) => {
      const active = section.dataset.screen === name;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    showRestart.hidden = name === 'title';
    if (name === 'sweep') {
      window.requestAnimationFrame(() => state.sweep?.resize());
    }
  }

  function scrollToShow() {
    window.setTimeout(() => {
      try {
        showStage.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      } catch (error) {
        /* Older browsers keep the page where it is. */
      }
    }, 40);
  }

  /* ---------------------------------------------------------------- *
   * How to play
   * ---------------------------------------------------------------- */

  let lastFocused = null;

  function openHowto() {
    lastFocused = document.activeElement;
    howtoModal.hidden = false;
    showFrame.inert = true;
    howtoClose.focus();
    audio.sfx('click');
  }

  function closeHowto() {
    if (howtoModal.hidden) return;
    howtoModal.hidden = true;
    showFrame.inert = false;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  howtoOpen.addEventListener('click', openHowto);
  howtoClose.addEventListener('click', closeHowto);
  howtoModal.addEventListener('click', (event) => {
    if (event.target === howtoModal) closeHowto();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !howtoModal.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeHowto();
    }
  });
  howtoStart.addEventListener('click', () => {
    closeHowto();
    beginShow();
  });

  /* ---------------------------------------------------------------- *
   * Title and teams
   * ---------------------------------------------------------------- */

  function updateTitleBest() {
    const best = getBest(GAME_ID);
    titleBest.hidden = best <= 0;
    titleBest.textContent = best > 0 ? `BEST WINNINGS ON THIS DEVICE: ${formatMoney(best)}` : '';
  }

  updateTitleBest();

  function renderTeams() {
    const cards = TEAMS.map((team, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'team-card';
      card.dataset.team = String(index);
      card.style.setProperty('--team', team.color);
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(index === state.teamIndex));

      const top = document.createElement('span');
      top.className = 'team-card-top';
      const tag = document.createElement('span');
      tag.className = 'team-tag';
      tag.textContent = `TEAM ${index + 1}`;
      const dot = document.createElement('span');
      dot.className = 'team-dot';
      dot.setAttribute('aria-hidden', 'true');
      top.append(tag, dot);

      const name = document.createElement('span');
      name.className = 'team-name';
      name.textContent = team.name;

      const players = document.createElement('span');
      players.className = 'team-players';
      players.textContent = team.players.join(' & ');

      const pick = document.createElement('span');
      pick.className = 'team-pick';
      pick.setAttribute('aria-hidden', 'true');
      pick.textContent = 'SELECTED ★';

      card.append(top, name, players, pick);
      card.addEventListener('click', () => selectTeam(index));
      return card;
    });
    teamGrid.replaceChildren(...cards);
    updateTeamNote();
  }

  function selectTeam(index) {
    state.teamIndex = index;
    [...teamGrid.children].forEach((card, cardIndex) => {
      card.setAttribute('aria-checked', String(cardIndex === index));
    });
    updateTeamNote();
    audio.sfx('click');
  }

  function updateTeamNote() {
    const team = TEAMS[state.teamIndex];
    teamNote.textContent = `You run the aisles for ${team.name}. ${team.players[1]} waits at the register.`;
  }

  function beginShow() {
    audio.unlock();
    audio.sfx('whoosh');
    audio.music('quiz');
    renderTeams();
    setChip('THE TEAMS');
    showScreen('team');
    scrollToShow();
  }

  startShow.addEventListener('click', beginShow);

  teamConfirm.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startQuiz();
  });

  /* ---------------------------------------------------------------- *
   * Question round
   * ---------------------------------------------------------------- */

  function startQuiz() {
    if (state.screen !== 'team') return;
    clearLater();
    state.teams = TEAMS.map((team, index) => ({
      team,
      index,
      timeBank: BASE_TIME,
      correct: 0,
      sweepTotal: 0,
      node: null,
      bankNode: null,
    }));
    state.quiz = buildQuiz();
    state.questionIndex = 0;
    state.resolved = true;
    state.playerWon = false;
    state.bonusWon = false;
    state.bonusCash = 0;
    state.sweepStats = null;
    state.winnerIndex = -1;
    state.submitted = false;
    state.total = 0;

    renderPodiums();
    setChip('QUESTION ROUND');
    showScreen('quiz');
    audio.music('quiz');
    scrollToShow();
    later(startQuestion, 260);
  }

  function renderPodiums() {
    const playerIndex = state.teamIndex;
    const nodes = state.teams.map((entry) => {
      const isPlayer = entry.index === playerIndex;
      const node = document.createElement('div');
      node.className = isPlayer ? 'podium is-you' : 'podium';
      node.style.setProperty('--team', entry.team.color);

      const light = document.createElement('span');
      light.className = 'podium-light';
      light.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('div');
      copy.className = 'podium-copy';
      const strong = document.createElement('strong');
      strong.textContent = isPlayer
        ? `YOU & ${entry.team.players[1]}`
        : entry.team.players.join(' & ');
      const sub = document.createElement('span');
      sub.textContent = entry.team.name;
      copy.append(strong, sub);

      const bank = document.createElement('span');
      bank.className = 'podium-bank';
      bank.textContent = formatClock(entry.timeBank);

      node.append(light, copy, bank);
      entry.node = node;
      entry.bankNode = bank;
      return node;
    });
    podiums.replaceChildren(...nodes);
  }

  function updatePodiums() {
    state.teams.forEach((entry) => {
      if (entry.bankNode) entry.bankNode.textContent = formatClock(entry.timeBank);
    });
  }

  function pulsePodium(teamIndex, buzzing = false) {
    const entry = state.teams[teamIndex];
    if (!entry?.node) return;
    entry.node.classList.toggle('is-buzzing', buzzing);
    if (buzzing) {
      later(() => entry.node?.classList.remove('is-buzzing'), 900);
    }
  }

  function markTime(entry) {
    updatePodiums();
    if (!entry.node) return;
    entry.node.classList.add('is-gain');
    later(() => entry.node?.classList.remove('is-gain'), 950);
  }

  function startQuestion() {
    window.cancelAnimationFrame(state.timerRaf);
    cancelTimer(state.cpuTimer);

    const question = state.quiz[state.questionIndex];
    if (!question) {
      finishQuiz();
      return;
    }

    state.question = question;
    state.choices = choicesFor(question);
    state.resolved = false;
    state.playerLocked = false;
    state.questionToken += 1;
    const token = state.questionToken;

    const roundName = ROUND_NAMES[question.round];
    roundLabel.textContent = `ROUND ${question.round + 1}`;
    quizRoundName.textContent = roundName;
    quizProgress.textContent = `QUESTION ${state.questionIndex + 1} OF ${state.quiz.length}`;
    questionTag.textContent = roundName;
    questionText.textContent = question.prompt;

    const previous = state.quiz[state.questionIndex - 1];
    const isRoundStart = !previous || previous.round !== question.round;
    hostLine.textContent = isRoundStart
      ? ROUND_INTROS[question.round]
      : 'Ten seconds on the clock. Somebody buzz in!';
    buzzFeed.textContent = '';
    answerList.replaceChildren();

    clockFill.style.transform = 'scaleX(1)';
    clockSeconds.textContent = String(QUESTION_SECONDS);
    clockSeconds.classList.remove('is-low');

    state.choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-btn';
      const letter = document.createElement('span');
      letter.className = 'answer-letter';
      letter.textContent = ['A', 'B', 'C'][index];
      const label = document.createElement('span');
      label.textContent = choice;
      button.append(letter, label);
      button.addEventListener('click', () => playerAnswer(index));
      answerList.append(button);
    });

    updatePodiums();
    questionText.focus({ preventScroll: true });
    startQuestionTimer();
    scheduleRivalBuzz(token);
  }

  function startQuestionTimer() {
    window.cancelAnimationFrame(state.timerRaf);
    state.questionStart = performance.now();
    const started = state.questionStart;

    const tick = (now) => {
      if (state.screen !== 'quiz' || state.resolved) return;
      const left = Math.max(0, QUESTION_SECONDS - (now - started) / 1000);
      clockFill.style.transform = `scaleX(${left / QUESTION_SECONDS})`;
      clockSeconds.textContent = String(Math.ceil(left));
      clockSeconds.classList.toggle('is-low', left <= 3.2);
      if (left <= 0) {
        timeOutQuestion();
        return;
      }
      state.timerRaf = window.requestAnimationFrame(tick);
    };
    state.timerRaf = window.requestAnimationFrame(tick);
  }

  function scheduleRivalBuzz(token) {
    cancelTimer(state.cpuTimer);
    if (Math.random() < 0.16) return;
    const rivals = state.teams.filter((entry) => entry.index !== state.teamIndex);
    if (!rivals.length) return;
    const rival = rivals[Math.floor(Math.random() * rivals.length)];
    const correct = Math.random() < 0.68;
    const delay = 3200 + Math.random() * 3900;
    state.cpuTimer = later(() => {
      if (token !== state.questionToken || state.resolved || state.screen !== 'quiz') return;
      rivalBuzz(rival.index, correct);
    }, delay);
  }

  function markAnswer(index, className, disable = false) {
    const button = answerList.children[index];
    if (!button) return;
    button.classList.add(className);
    if (disable) button.disabled = true;
  }

  function disableAnswers() {
    [...answerList.children].forEach((button) => {
      button.disabled = true;
    });
  }

  function rivalBuzz(teamIndex, correct) {
    if (state.resolved || state.screen !== 'quiz') return;
    const entry = state.teams[teamIndex];
    if (!entry) return;
    const question = state.question;
    const choice = correct
      ? question.answer
      : state.choices.find((option) => option !== question.answer);
    const choiceIndex = state.choices.indexOf(choice);
    const name = entry.team.players[1];

    pulsePodium(teamIndex, true);
    markAnswer(choiceIndex, correct ? 'correct' : 'wrong', true);

    if (correct) {
      state.resolved = true;
      window.cancelAnimationFrame(state.timerRaf);
      cancelTimer(state.cpuTimer);
      disableAnswers();
      entry.timeBank += 10;
      entry.correct += 1;
      hostLine.textContent = `${randomFrom(HOST_LINES.correct)} ${entry.team.name} takes it!`;
      buzzFeed.textContent = `${name}: “${choice}” ✓ — TEN SECONDS TO ${entry.team.name}!`;
      audio.sfx('ding');
      markTime(entry);
      later(() => {
        if (state.screen === 'quiz') nextQuestion();
      }, 1900);
      return;
    }

    hostLine.textContent = `Ooh! ${name} buzzed in with “${choice}” — that's wrong. Steal it!`;
    buzzFeed.textContent = `${name}: “${choice}” ✗ — STEAL IT!`;
    audio.sfx('buzz');
    later(() => pulsePodium(teamIndex, false), 700);
  }

  function playerAnswer(index) {
    if (state.resolved || state.playerLocked || state.screen !== 'quiz') return;
    state.playerLocked = true;
    state.resolved = true;
    window.cancelAnimationFrame(state.timerRaf);
    cancelTimer(state.cpuTimer);

    const question = state.question;
    const entry = currentEntry();
    const choice = state.choices[index];
    const correct = choice === question.answer;
    const correctIndex = state.choices.indexOf(question.answer);

    disableAnswers();
    markAnswer(index, correct ? 'correct' : 'wrong');
    if (!correct) markAnswer(correctIndex, 'correct');

    if (correct) {
      entry.timeBank += 10;
      entry.correct += 1;
      hostLine.textContent = randomFrom(HOST_LINES.correct);
      buzzFeed.textContent = `YOU: “${choice}” ✓ — TEN MORE SECONDS!`;
      audio.sfx('ding');
      markTime(entry);
    } else {
      hostLine.textContent = `${randomFrom(HOST_LINES.wrong)} The answer was “${question.answer}”.`;
      buzzFeed.textContent = `YOU: “${choice}” ✗ — ${question.answer} was the one.`;
      audio.sfx('buzz');
    }

    later(() => {
      if (state.screen === 'quiz') nextQuestion();
    }, 1900);
  }

  function timeOutQuestion() {
    if (state.resolved || state.screen !== 'quiz') return;
    state.resolved = true;
    window.cancelAnimationFrame(state.timerRaf);
    cancelTimer(state.cpuTimer);
    const question = state.question;
    disableAnswers();
    markAnswer(state.choices.indexOf(question.answer), 'correct');
    hostLine.textContent = `${randomFrom(HOST_LINES.timeout)} It was “${question.answer}”.`;
    buzzFeed.textContent = `TIME'S UP — ${question.answer}.`;
    audio.sfx('buzz');
    later(() => {
      if (state.screen === 'quiz') nextQuestion();
    }, 2000);
  }

  function nextQuestion() {
    if (state.screen !== 'quiz') return;
    state.questionIndex += 1;
    if (state.questionIndex >= state.quiz.length) {
      finishQuiz();
      return;
    }
    startQuestion();
  }

  document.addEventListener('keydown', (event) => {
    if (state.screen !== 'quiz' || state.resolved) return;
    if (howtoModal.hidden === false) return;
    const index = ['1', '2', '3'].indexOf(event.key);
    if (index >= 0) {
      event.preventDefault();
      playerAnswer(index);
    }
  });

  function computeRivalTotals() {
    state.teams.forEach((entry) => {
      if (entry.index === state.teamIndex) return;
      const rate = 4.1 + Math.random() * 2.3;
      const luck = Math.random() * 260;
      entry.sweepTotal = Math.max(260, Math.round((entry.timeBank * rate + luck) / 5) * 5);
    });
  }

  function finishQuiz() {
    window.cancelAnimationFrame(state.timerRaf);
    cancelTimer(state.cpuTimer);
    state.resolved = true;
    computeRivalTotals();
    renderSweepIntro();
    setChip('THE BIG SWEEP');
    showScreen('sweep-intro');
    audio.music('quiz');
  }

  /* ---------------------------------------------------------------- *
   * Big Sweep intro
   * ---------------------------------------------------------------- */

  function renderSweepIntro() {
    const sorted = [...state.teams].sort((a, b) => b.timeBank - a.timeBank);
    sweepIntroTeams.replaceChildren(
      ...sorted.map((entry, index) => {
        const isYou = entry.index === state.teamIndex;
        const row = document.createElement('div');
        row.className = isYou ? 'seed is-you' : 'seed';
        row.style.setProperty('--team', entry.team.color);

        const rank = document.createElement('span');
        rank.className = 'seed-rank';
        rank.textContent = `SEED ${index + 1}`;

        const name = document.createElement('span');
        name.className = 'seed-name';
        name.textContent = entry.team.name;

        const note = document.createElement('span');
        note.className = 'seed-note';
        note.textContent = isYou ? `YOU & ${entry.team.players[1]}` : entry.team.players.join(' & ');

        const time = document.createElement('span');
        time.className = 'seed-time';
        time.textContent = formatClock(entry.timeBank);

        row.append(rank, name, note, time);
        return row;
      })
    );

    const player = currentEntry();
    const leader = sorted[0];
    sweepIntroNote.textContent =
      leader.index === state.teamIndex
        ? `You earned the top time bank — first into the market with ${formatClock(player.timeBank)}!`
        : `${leader.team.name} go first. You enter with ${formatClock(player.timeBank)} on your clock.`;
    sweepIntroHost.textContent = HOST_LINES.sweep;
  }

  startSweep.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startBigSweep();
  });

  /* ---------------------------------------------------------------- *
   * Big Sweep engine
   * ---------------------------------------------------------------- */

  function destroySweep() {
    if (!state.sweep) return;
    try {
      state.sweep.destroy();
    } catch (error) {
      /* already gone */
    }
    state.sweep = null;
    state.autoPause?.sync();
  }

  function hudUpdate(hud) {
    hudTime.textContent = formatClock(hud.timeLeft);
    hudTime.classList.toggle('is-low', hud.timeLeft <= 15 && hud.timeLeft > 0);
    hudBanked.textContent = formatMoney(hud.banked);
    hudCart.textContent = formatMoney(hud.cartValue);
    hudSpace.textContent = `${Math.max(0, hud.cartCap - hud.cartCount)} LEFT`;
    capFill.style.width = `${Math.min(100, (hud.cartCount / hud.cartCap) * 100)}%`;
    capFill.style.background = hud.full ? 'var(--pink)' : '';
    hudBonusTime.textContent = formatClock(hud.timeLeft);
    hudBonusProgress.textContent = `${hud.bonusIndex} / ${hud.bonusTotal}`;
  }

  function showTicker(message, tone = '') {
    sweepTicker.textContent = message;
    sweepTicker.dataset.tone = tone;
    sweepTicker.classList.add('is-visible');
    cancelTimer(state.tickerTimer);
    state.tickerTimer = later(() => sweepTicker.classList.remove('is-visible'), 2800);
  }

  function hideTicker() {
    cancelTimer(state.tickerTimer);
    sweepTicker.classList.remove('is-visible');
  }

  function showBanner(title, subtitle = '') {
    sweepBanner.replaceChildren();
    sweepBanner.append(document.createTextNode(title));
    if (subtitle) {
      const small = document.createElement('small');
      small.textContent = subtitle;
      sweepBanner.append(small);
    }
    sweepBanner.hidden = false;
  }

  function hideBanner() {
    sweepBanner.hidden = true;
    sweepBanner.replaceChildren();
  }

  function startBigSweep() {
    if (state.screen !== 'sweep-intro') return;
    const player = currentEntry();
    destroySweep();
    setChip('THE BIG SWEEP');
    sweepModeTitle.textContent = 'THE BIG SWEEP';
    sweepTeamName.textContent = `YOU & ${currentTeam().players[1]}`;
    sweepTeamName.style.color = currentTeam().color;
    sweepHud.hidden = false;
    bonusHud.hidden = true;
    bonusClueBar.hidden = true;
    hideBanner();
    hideTicker();
    showScreen('sweep');
    scrollToShow();

    const rivals = state.teams
      .filter((entry) => entry.index !== state.teamIndex)
      .map((entry) => ({
        name: entry.team.name.replace('THE ', ''),
        time: entry.timeBank,
      }));

    state.sweep = createSweep(canvas, {
      mode: 'sweep',
      seconds: player.timeBank,
      teamIndex: state.teamIndex,
      rivals,
      audio,
      onHud: hudUpdate,
      onToast: showTicker,
      onEnd: endBigSweep,
      reducedMotion: prefersReducedMotion(),
    });

    audio.music('sweep');
    window.requestAnimationFrame(() => state.sweep?.resize());
    runCountdown(() => {
      state.sweep?.start();
      state.autoPause?.sync();
    });
  }

  function runCountdown(onGo) {
    sweepCountdown.hidden = false;
    let value = 3;
    const step = () => {
      if (state.screen !== 'sweep') {
        sweepCountdown.hidden = true;
        return;
      }
      if (value > 0) {
        sweepCountdown.textContent = String(value);
        audio.sfx('beep');
        value -= 1;
        later(step, 650);
        return;
      }
      sweepCountdown.textContent = 'GO!';
      onGo();
      later(() => {
        sweepCountdown.hidden = true;
      }, 450);
    };
    step();
  }

  function endBigSweep(stats) {
    state.sweepStats = stats;
    state.autoPause?.sync();
    hideTicker();
    showBanner('TIME!', 'SCANNING THE CART…');
    audio.sfx('timeup');
    later(() => {
      hideBanner();
      showCheckout();
    }, 1500);
  }

  /* ---------------------------------------------------------------- *
   * Checkout
   * ---------------------------------------------------------------- */

  function countUp(node, target, duration = 650) {
    const started = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = formatMoney(target * eased);
      if (progress < 1) window.requestAnimationFrame(step);
      else node.textContent = formatMoney(target);
    };
    window.requestAnimationFrame(step);
  }

  function showCheckout() {
    const stats = state.sweepStats;
    if (!stats) return;
    const player = currentEntry();
    player.sweepTotal = stats.total;

    audio.music(null);
    destroySweep();
    hideBanner();
    setChip('THE CHECKOUT');
    showScreen('checkout');
    scrollToShow();

    /* Receipt */
    const lines = stats.receipt.map((item) => ({
      label: `${item.count} × ${item.name}`,
      value: item.total,
      special: false,
    }));
    const giantTotal = stats.giants.reduce((sum, giant) => sum + giant.value, 0);
    if (giantTotal > 0) {
      lines.push({ label: 'GIANT BONUS ITEMS', value: giantTotal, special: true });
    }
    const cashTotal = stats.money.reduce((sum, bill) => sum + bill.value, 0);
    if (cashTotal > 0) {
      lines.push({ label: 'HIDDEN CASH FOUND', value: cashTotal, special: true });
    }
    if (!lines.length) {
      lines.push({ label: 'One very empty cart', value: 0, special: false });
    }

    receiptLines.replaceChildren(
      ...lines.map((line) => {
        const item = document.createElement('li');
        if (line.special) item.className = 'receipt-special';
        const label = document.createElement('span');
        label.textContent = line.label;
        const value = document.createElement('b');
        value.textContent = formatMoney(line.value);
        item.append(label, value);
        return item;
      })
    );
    receiptTotal.replaceChildren();
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'TOTAL';
    const totalValue = document.createElement('span');
    totalValue.textContent = formatMoney(stats.total);
    receiptTotal.append(totalLabel, totalValue);

    /* Totals reveal, player last */
    const order = state.teams
      .filter((entry) => entry.index !== state.teamIndex)
      .concat(player);
    const cards = new Map();

    checkoutTeams.replaceChildren(
      ...order.map((entry) => {
        const card = document.createElement('div');
        card.className = 'total-card';
        card.style.setProperty('--team', entry.team.color);
        card.dataset.team = String(entry.index);

        const copy = document.createElement('div');
        const teamName = document.createElement('span');
        teamName.className = 'total-team';
        teamName.textContent = entry.team.name;
        const role = document.createElement('span');
        role.className = 'total-role';
        role.textContent =
          entry.index === state.teamIndex
            ? `YOU & ${entry.team.players[1]}`
            : entry.team.players.join(' & ');
        copy.append(teamName, role);

        const value = document.createElement('span');
        value.className = 'total-value';
        value.textContent = '???';

        card.append(copy, value);
        cards.set(entry.index, { card, value });
        return card;
      })
    );

    checkoutResult.hidden = true;
    checkoutResult.replaceChildren();
    checkoutNext.hidden = true;
    checkoutNext.disabled = false;
    checkoutHost.textContent = HOST_LINES.checkout;

    let delay = 500;
    order.forEach((entry) => {
      later(() => {
        const node = cards.get(entry.index);
        if (!node) return;
        node.card.classList.add('reveal');
        const total = entry.index === state.teamIndex ? stats.total : entry.sweepTotal;
        countUp(node.value, total, 700);
        audio.sfx('tick');
      }, delay);
      delay += 850;
    });

    later(() => revealCheckoutWinner(stats, player), delay + 350);
  }

  function revealCheckoutWinner(stats, player) {
    let winner = state.teams[0];
    let winnerTotal = -1;
    state.teams.forEach((entry) => {
      const total = entry.index === state.teamIndex ? stats.total : entry.sweepTotal;
      if (total > winnerTotal) {
        winner = entry;
        winnerTotal = total;
      }
    });
    if (stats.total >= winnerTotal) {
      winner = player;
      winnerTotal = stats.total;
    }

    state.winnerIndex = winner.index;
    state.playerWon = winner.index === state.teamIndex;

    const card = checkoutTeams.querySelector(`[data-team="${winner.index}"]`);
    card?.classList.add('is-winner');

    checkoutResult.hidden = false;
    checkoutResult.replaceChildren();
    checkoutResult.classList.toggle('is-lose', !state.playerWon);

    if (state.playerWon) {
      checkoutResult.append(document.createTextNode('YOU WON THE BIG SWEEP!'));
      const small = document.createElement('small');
      small.textContent = `A ${formatMoney(stats.total)} checkout beats the field. The $5,000 Bonus Sweep is next.`;
      checkoutResult.append(small);
      checkoutNext.textContent = 'PLAY THE BONUS SWEEP';
      checkoutHost.textContent = `You're going to the Bonus Sweep! Three clues, sixty seconds, five thousand dollars.`;
      audio.sfx('cheer');
    } else {
      checkoutResult.append(document.createTextNode(`${winner.team.name} TAKE IT!`));
      const small = document.createElement('small');
      small.textContent = `They finish on ${formatMoney(winnerTotal)}. You scored ${formatMoney(stats.total)} — no bonus round this time.`;
      checkoutResult.append(small);
      checkoutNext.textContent = 'SEE THE FINAL SCORE';
      checkoutHost.textContent = `So close! ${winner.team.name} take the Big Sweep. Your cart total goes on the board.`;
      audio.sfx('lose');
    }

    checkoutNext.hidden = false;
    checkoutNext.focus({ preventScroll: true });
    setChip(state.playerWon ? 'BONUS SWEEP NEXT' : "THAT'S THE SHOW");
  }

  checkoutNext.addEventListener('click', () => {
    if (checkoutNext.disabled) return;
    checkoutNext.disabled = true;
    audio.sfx('click');
    if (state.playerWon) {
      showBonusIntro();
    } else {
      finishShow();
    }
  });

  /* ---------------------------------------------------------------- *
   * Bonus Sweep
   * ---------------------------------------------------------------- */

  function showBonusIntro() {
    bonusPreviewClue.textContent = `CLUE 1 — ${BONUS_TARGETS[0].clue}`;
    bonusIntroHost.textContent = HOST_LINES.bonus;
    setChip('BONUS SWEEP');
    showScreen('bonus-intro');
    audio.music('bonus');
    audio.sfx('whoosh');
    scrollToShow();
  }

  startBonus.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startBonusSweep();
  });

  function setBonusClue(index) {
    const target = BONUS_TARGETS[index];
    if (!target) return;
    bonusClueNumber.textContent = `CLUE ${index + 1} OF ${BONUS_TARGETS.length}`;
    bonusClueText.textContent = target.clue;
  }

  function startBonusSweep() {
    if (state.screen !== 'bonus-intro') return;
    destroySweep();
    sweepModeTitle.textContent = 'THE BONUS SWEEP';
    sweepTeamName.textContent = `YOU & ${currentTeam().players[1]}`;
    sweepTeamName.style.color = currentTeam().color;
    sweepHud.hidden = true;
    bonusHud.hidden = false;
    bonusClueBar.hidden = false;
    setBonusClue(0);
    hudBonusTime.textContent = '1:00';
    hudBonusProgress.textContent = `0 / ${BONUS_TARGETS.length}`;
    hideBanner();
    hideTicker();
    showScreen('sweep');
    scrollToShow();

    state.sweep = createSweep(canvas, {
      mode: 'bonus',
      seconds: 60,
      teamIndex: state.teamIndex,
      rivals: [],
      audio,
      onHud: hudUpdate,
      onToast: showTicker,
      onEnd: endBonusSweep,
      onBonusTarget: (found, allFound) => {
        if (!allFound) {
          setBonusClue(found);
          showTicker(`CLUE ${found} FOUND! NEXT CLUE: ${BONUS_TARGETS[found].name}`, 'good');
        } else {
          bonusClueNumber.textContent = 'FINAL DASH';
          bonusClueText.textContent = 'THE CASH IS AT YOUR REGISTER — GO GO GO!';
          showTicker('ALL THREE CLUES FOUND! GET THE CASH!', 'good');
        }
      },
      reducedMotion: prefersReducedMotion(),
    });

    audio.music('bonus');
    window.requestAnimationFrame(() => state.sweep?.resize());
    runCountdown(() => {
      state.sweep?.start();
      state.autoPause?.sync();
    });
  }

  function endBonusSweep(stats) {
    state.bonusWon = Boolean(stats.bonusWon);
    state.bonusCash = state.bonusWon ? 5000 : 0;
    state.autoPause?.sync();
    hideTicker();
    audio.music(null);

    if (state.bonusWon) {
      showBanner('$5,000!', 'YOU GRABBED THE CASH!');
      audio.sfx('win');
      later(finishShow, 1900);
    } else {
      showBanner('TIME!', 'THE CASH SLIPS AWAY…');
      audio.sfx('lose');
      later(finishShow, 1800);
    }
  }

  /* ---------------------------------------------------------------- *
   * Final
   * ---------------------------------------------------------------- */

  function renderConfetti(count) {
    finalConfetti.replaceChildren();
    if (!count || prefersReducedMotion()) return;
    const colors = ['#ff2e97', '#ffd93d', '#2fe4ff', '#7dffb0', '#b983ff'];
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('span');
      piece.style.setProperty('--x', `${Math.random() * 100}%`);
      piece.style.setProperty('--c', colors[i % colors.length]);
      piece.style.setProperty('--d', `${2.1 + Math.random() * 1.8}s`);
      piece.style.setProperty('--delay', `${-Math.random() * 3}s`);
      piece.style.setProperty('--r', `${Math.floor(Math.random() * 360)}deg`);
      finalConfetti.append(piece);
    }
  }

  function finishShow() {
    destroySweep();
    const sweepTotal = state.sweepStats?.total || 0;
    const bonusCash = state.bonusWon ? 5000 : 0;
    const total = sweepTotal + bonusCash;
    state.total = total;

    hideBanner();
    hideTicker();
    audio.music(null);
    setChip("THAT'S THE SHOW");
    showScreen('final');
    scrollToShow();

    finalHeadline.classList.remove('is-jackpot');

    if (state.bonusWon) {
      finalKicker.textContent = 'BONUS SWEEP CHAMPION';
      finalHeadline.textContent = 'YOU CLEANED HOUSE!';
      finalHeadline.classList.add('is-jackpot');
      finalSub.textContent = HOST_LINES.bonusWin;
      audio.sfx('win');
    } else if (state.playerWon) {
      finalKicker.textContent = 'BIG SWEEP WINNER';
      finalHeadline.textContent = 'YOU WON THE BIG SWEEP!';
      finalSub.textContent = `You banked ${formatMoney(sweepTotal)} in groceries, but the bonus cash got away. The cart is still yours.`;
      audio.sfx('cheer');
    } else {
      const winner = state.teams[state.winnerIndex];
      finalKicker.textContent = "THAT'S THE SHOW";
      finalHeadline.textContent = 'SO CLOSE!';
      finalSub.textContent = winner
        ? `${winner.team.name} take the Big Sweep. ${HOST_LINES.lose}`
        : HOST_LINES.lose;
      audio.sfx('lose');
    }

    finalSweep.textContent = formatMoney(sweepTotal);
    finalBonus.textContent = formatMoney(bonusCash);
    finalTotal.textContent = formatMoney(total);
    finalCatch.textContent = HOST_LINES.catchphrase;
    finalNewBest.hidden = true;

    let best = getBest(GAME_ID);
    if (!state.submitted) {
      const result = submitScore(GAME_ID, total);
      state.submitted = true;
      best = result.best;
      if (result.isBest && total > 0) {
        finalNewBest.hidden = false;
        audio.sfx('cheer');
      }
    }
    finalBest.textContent = formatMoney(best);

    renderConfetti(state.playerWon ? 30 : 0);
    later(() => {
      if (state.screen === 'final') finalHeadline.focus({ preventScroll: true });
    }, 60);
  }

  /* ---------------------------------------------------------------- *
   * Restart and teardown
   * ---------------------------------------------------------------- */

  function resetShow() {
    clearLater();
    window.cancelAnimationFrame(state.timerRaf);
    cancelTimer(state.cpuTimer);
    cancelTimer(state.tickerTimer);
    if (state.autoPause?.paused) {
      try {
        state.autoPause.toggle();
      } catch (error) {
        /* the run is over; just let the overlay go */
      }
    }
    destroySweep();
    state.questionToken += 1;
    state.resolved = true;
    state.playerLocked = false;
    state.quiz = [];
    state.questionIndex = 0;
    state.teams = [];
    state.sweepStats = null;
    state.playerWon = false;
    state.bonusWon = false;
    state.bonusCash = 0;
    state.winnerIndex = -1;
    state.total = 0;
    state.submitted = false;
    finalConfetti.replaceChildren();
    finalNewBest.hidden = true;
    checkoutNext.hidden = true;
    checkoutResult.hidden = true;
    hideBanner();
    hideTicker();
    sweepCountdown.hidden = true;
    audio.music(null);
    audio.sfx('whoosh');
    setChip('PRE-SHOW');
    updateTitleBest();
    showScreen('title');
    window.setTimeout(() => {
      try {
        showEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } catch (error) {
        /* no scroll */
      }
    }, 40);
  }

  playAgain.addEventListener('click', () => {
    audio.sfx('click');
    resetShow();
  });

  showRestart.addEventListener('click', () => {
    if (window.confirm('Restart the show? Your current run will be lost.')) {
      resetShow();
    }
  });

  /* ---------------------------------------------------------------- *
   * Shared pause
   * ---------------------------------------------------------------- */

  state.autoPause = createAutoPause({
    container: canvasWrap,
    shouldPause: () => Boolean(state.sweep && state.sweep.isRunning()),
    audio,
    muteButton: showMute,
    button: pauseBtn,
    message: 'The show is paused',
    onPause: () => state.sweep?.pause(),
    onResume: () => state.sweep?.resume(),
  });
}
