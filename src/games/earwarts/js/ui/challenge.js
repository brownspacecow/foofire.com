import { audioEngine, earTraining } from '../audio.js';
import {
  createChallenge,
  PerfectPitchChallenge,
  PIANO_KEYS,
  RhythmChallenge,
} from '../challenges.js';
import { SKILL_LABELS } from '../content.js';
import {
  closeChallenge,
  completeChallenge,
  continueChallenge,
  getState,
  subscribe,
} from '../store.js';

const SOUND_CAPTIONS = {
  pitch: 'Two chimes play, one after the other.',
  interval: 'Two notes play. The second one is a leap away from the first.',
  rhythm: 'Four count-in clicks, then the forest drum taps a pattern.',
  perfect: 'One piano note rings out. Find the key that matches it.',
  melody: 'Five notes play in a row, drawing a shape.',
  harmony: 'A chord sounds. It blooms a second time, more softly.',
};

function pipsMarkup(difficulty) {
  return `<span class="difficulty-pips" aria-label="Spell level ${difficulty}">${[1, 2, 3, 4]
    .map((pip) => `<span class="${pip <= difficulty ? 'on' : ''}" aria-hidden="true"></span>`)
    .join('')}</span>`;
}

function choiceMarkup(choice) {
  return `<button type="button" class="challenge-choice" data-choice="${choice.id}" disabled>
    ${choice.icon ? `<span class="choice-icon" aria-hidden="true">${choice.icon}</span>` : ''}
    <span class="choice-copy"><strong>${choice.label}</strong>${choice.hint ? `<span>${choice.hint}</span>` : ''}</span>
  </button>`;
}

function rhythmMarkup(challenge) {
  return `<div class="rhythm-stage" id="rhythm-stage">
    <p class="rhythm-info">${challenge.totalBeats} beats · ${challenge.hits.length} taps in the pattern</p>
    <button type="button" class="echo-start primary-button" id="echo-start" disabled>I'm ready to echo</button>
    <p class="echo-status" id="echo-count" role="status" hidden>Listen for four clicks…</p>
    <button type="button" class="drum-pad" id="drum-pad" aria-label="Forest drum. Tap to echo the rhythm." hidden><span aria-hidden="true">◉</span>TAP</button>
    <span class="echo-clock" id="echo-clock" style="animation-duration:${challenge.totalBeats * challenge.beatMs + 850}ms" aria-hidden="true" hidden></span>
    <p class="echo-status" id="echo-status" role="status" hidden></p>
    <button type="button" class="echo-reset" id="echo-reset" hidden>Listen again first</button>
    <p class="rhythm-wait" id="rhythm-wait" hidden>Listen first, then echo it back.</p>
    <div class="challenge-feedback soft" id="rhythm-feedback" role="status" aria-live="polite" hidden></div>
  </div>`;
}

function pianoMarkup(challenge) {
  const keys = PIANO_KEYS.map((key) => {
    const classes = `piano-key ${key.black ? 'black' : 'white'}${key.letter === 'C' ? ' c-key' : ''}`;
    return `<button type="button" class="${classes}" data-piano-key="${key.midi}" style="left:${key.left}%;width:${key.width}%" aria-label="${key.spoken}${key.black ? ', black key' : ''}" disabled>${
      key.black ? '' : `<span class="piano-label">${key.name}</span>`
    }</button>`;
  }).join('');
  return `<div class="piano-stage">
    <p class="piano-range">${challenge.rangeLabel}</p>
    <div class="piano" role="group" aria-label="Piano keyboard, C4 to B5">${keys}</div>
    <p class="piano-hint">Tap the key that matches the note.</p>
  </div>`;
}

function createView(session, root) {
  const challenge = createChallenge(session.skill, session.difficulty, earTraining);
  const skill = SKILL_LABELS[session.skill];
  const rhythm = challenge instanceof RhythmChallenge ? challenge : null;
  const piano = challenge instanceof PerfectPitchChallenge ? challenge : null;
  const captions = getState().save.captions;
  let mounted = true;
  let heard = false;
  let playing = false;
  let result = null;
  let outcome = null;
  let retries = 0;
  let slow = false;
  let finishing = false;
  let echoPhase = 'idle';
  let taps = [];
  let recordStart = 0;
  let echoTimer = null;
  const timers = new Set();

  const answersMarkup = rhythm
    ? rhythmMarkup(rhythm)
    : `${
        piano
          ? pianoMarkup(piano)
          : `<div class="choice-grid" role="group" aria-label="Answers">${challenge.choices.map(choiceMarkup).join('')}</div>`
      }
       <p class="listen-first" id="listen-first" role="status">Listen once, then the ${
         piano ? 'piano keys' : 'answers'
       } will wake up.</p>
       <div class="challenge-feedback soft" id="answer-feedback" role="status" aria-live="polite" hidden></div>`;

  root.innerHTML = `
    <div class="challenge-backdrop">
      <section class="challenge-card" role="dialog" aria-modal="true" aria-label="${session.title} listening challenge">
        <button type="button" class="challenge-close" aria-label="Close this listening challenge">×</button>
        <header class="challenge-head">
          <span class="challenge-skill" style="--skill-color:${skill.colour}"><span aria-hidden="true">${skill.icon}</span> ${skill.name} spell</span>
          <div><h2>${session.title}</h2><p>${skill.line}</p></div>
          ${pipsMarkup(session.difficulty)}
        </header>
        <div class="challenge-circle" aria-hidden="true"><span></span><span></span><span></span><em>✦</em></div>
        <div class="challenge-body">
          <div class="challenge-question">
            <p class="challenge-prompt">${challenge.prompt}</p>
            <h3>${challenge.question}</h3>
          </div>
          <div class="listen-row">
            <button type="button" class="listen-button" id="listen-button"><span aria-hidden="true">♪</span><span id="listen-label">Listen</span></button>
            ${
              rhythm
                ? `<button type="button" class="slow-toggle" id="slow-toggle" aria-pressed="false">Slow drums off</button>`
                : ''
            }
          </div>
          ${captions ? `<p class="sound-caption" aria-live="polite"><span aria-hidden="true">☾</span> ${SOUND_CAPTIONS[session.skill]}</p>` : ''}
          ${answersMarkup}
        </div>
        <footer class="challenge-foot">
          <span>No failing here. Listen again as often as you need.</span>
          <span class="challenge-shortcut">Esc to step away</span>
        </footer>
      </section>
    </div>`;

  const card = root.querySelector('.challenge-card');
  const body = root.querySelector('.challenge-body');
  const listenButton = root.querySelector('#listen-button');
  const listenLabel = root.querySelector('#listen-label');
  const slowButton = root.querySelector('#slow-toggle');
  const answerFeedback = root.querySelector('#answer-feedback');
  const listenFirst = root.querySelector('#listen-first');
  const stage = root.querySelector('#rhythm-stage');
  const echoStart = root.querySelector('#echo-start');
  const echoCount = root.querySelector('#echo-count');
  const drumPad = root.querySelector('#drum-pad');
  const echoClock = root.querySelector('#echo-clock');
  const echoStatus = root.querySelector('#echo-status');
  const echoReset = root.querySelector('#echo-reset');
  const rhythmWait = root.querySelector('#rhythm-wait');
  const rhythmFeedback = root.querySelector('#rhythm-feedback');

  root.querySelector('.challenge-close')?.addEventListener('click', () => closeChallenge());

  function setTimer(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (mounted) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function updateListenUi() {
    if (!listenButton || !listenLabel) return;
    listenButton.disabled = playing;
    listenButton.firstElementChild.textContent = playing ? '◌' : '♪';
    listenLabel.textContent = playing ? 'Listening…' : heard ? 'Hear it again' : 'Listen';
    if (slowButton) {
      slowButton.disabled = playing;
      slowButton.classList.toggle('on', slow);
      slowButton.setAttribute('aria-pressed', String(slow));
      slowButton.textContent = `Slow drums ${slow ? 'on' : 'off'}`;
    }
    root.querySelectorAll('[data-choice], [data-piano-key]').forEach((button) => {
      button.disabled = !heard || playing;
    });
    if (listenFirst) listenFirst.hidden = heard;
    updateEchoUi();
  }

  function showFeedback(message, good) {
    const box = rhythm ? rhythmFeedback : answerFeedback;
    if (!box) return;
    box.textContent = message;
    box.className = `challenge-feedback ${good ? 'good' : 'soft'}`;
    box.hidden = false;
  }

  function hideFeedback() {
    if (answerFeedback) answerFeedback.hidden = true;
    if (rhythmFeedback) rhythmFeedback.hidden = true;
  }

  function updateEchoUi() {
    if (!rhythm || !echoStart) return;
    echoStart.disabled = !heard || playing;
    if (echoPhase === 'idle') {
      echoStart.hidden = false;
      echoStart.textContent = taps.length > 0 ? 'Try the echo again' : "I'm ready to echo";
      echoCount.hidden = true;
      drumPad.hidden = true;
      echoClock.hidden = true;
      echoStatus.hidden = true;
      echoReset.hidden = true;
      rhythmWait.hidden = taps.length > 0 || heard;
      stage.classList.remove('tapping');
    } else if (echoPhase === 'count') {
      echoStart.hidden = true;
      echoCount.hidden = false;
      drumPad.hidden = true;
      echoClock.hidden = true;
      echoStatus.hidden = true;
      echoReset.hidden = true;
      rhythmWait.hidden = true;
      stage.classList.remove('tapping');
    } else {
      echoStart.hidden = true;
      echoCount.hidden = true;
      drumPad.hidden = false;
      echoStatus.hidden = false;
      echoReset.hidden = false;
      rhythmWait.hidden = true;
      stage.classList.add('tapping');
      echoClock.hidden = taps.length === 0;
      if (taps.length === 0) {
        echoStatus.textContent = 'Tap the drum to begin your echo.';
      } else {
        echoStatus.textContent = `Tap the drum — ${taps.length} tap${taps.length === 1 ? '' : 's'} heard`;
      }
    }
  }

  async function play() {
    if (playing || !mounted) return;
    playing = true;
    result = null;
    hideFeedback();
    updateListenUi();
    try {
      if (rhythm) {
        await earTraining.playRhythm(rhythm.hits, rhythm.totalBeats, rhythm.tempo, slow);
      } else {
        await challenge.present();
      }
    } catch {
      /* The choices still work silently. */
    } finally {
      if (mounted) {
        heard = true;
        playing = false;
        updateListenUi();
      }
    }
  }

  function showSuccess(evaluation) {
    const reward = outcome;
    if (!reward) return;
    const notes = [
      reward.levelUp ? `<p><span aria-hidden="true">★</span> You are now Apprentice ${reward.levelUp}.</p>` : '',
      ...(reward.quests ?? []).map(
        (quest) => `<p><span aria-hidden="true">❧</span> Quest complete: ${quest.title} — ${quest.reward}</p>`
      ),
      ...(reward.rooms ?? []).map(
        (room) => `<p><span aria-hidden="true">${room.icon}</span> A new wing wakes: ${room.name}</p>`
      ),
      ...(reward.achievements ?? []).map(
        (achievement) => `<p><span aria-hidden="true">★</span> ${achievement.title}: ${achievement.description}</p>`
      ),
    ];
    body.innerHTML = `
      <div class="challenge-success">
        <span class="success-sigil" aria-hidden="true">✦</span>
        <p class="success-kicker">The magic holds</p>
        <h3>${evaluation.message ?? 'The castle heard you.'}</h3>
        <p class="resonance-gain">+${reward.resonance} Magic Resonance${retries > 0 ? '<span class="retry-note"> (a little quieter for the retry)</span>' : ''}</p>
        <div class="success-notes">${notes.filter(Boolean).join('')}</div>
        <div class="success-actions">
          <button type="button" class="primary-button" data-continue>Listen to another</button>
          <button type="button" class="ghost-button" data-back>Back to the castle</button>
        </div>
      </div>`;
    body.querySelector('[data-continue]')?.addEventListener('click', () => continueChallenge());
    body.querySelector('[data-back]')?.addEventListener('click', () => closeChallenge());
    card.scrollTo({ top: 0, behavior: 'smooth' });
    audioEngine.playSuccess().catch(() => undefined);
  }

  function finish(evaluation) {
    if (finishing || outcome) return;
    finishing = true;
    const reward = completeChallenge(true, retries);
    outcome = reward;
    showSuccess(evaluation);
  }

  function answer(choiceId) {
    if (!heard || playing || outcome) return;
    const evaluation = challenge.evaluate(choiceId);
    result = evaluation;
    showFeedback(evaluation.message, evaluation.correct);
    if (evaluation.correct) finish(evaluation);
    else {
      retries += 1;
      audioEngine.playSoftMiss().catch(() => undefined);
    }
  }

  root.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => answer(button.dataset.choice));
  });

  if (piano) {
    root.querySelectorAll('[data-piano-key]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!heard || playing || outcome) return;
        hideFeedback();
        const midi = Number(button.dataset.pianoKey);
        earTraining.playPianoNote(midi, 0.9).catch(() => undefined);
        const evaluation = challenge.evaluate(midi);
        showFeedback(evaluation.message, evaluation.correct);
        if (evaluation.correct) finish(evaluation);
        else retries += 1;
      });
    });
  }

  listenButton?.addEventListener('click', () => void play());
  slowButton?.addEventListener('click', () => {
    if (playing) return;
    slow = !slow;
    updateListenUi();
  });

  if (rhythm) {
    function clearEchoTimer() {
      if (echoTimer !== null) {
        window.clearTimeout(echoTimer);
        echoTimer = null;
      }
    }

    function setPhase(phase) {
      echoPhase = phase;
      updateEchoUi();
    }

    async function startEcho() {
      if (echoPhase !== 'idle' || !heard || playing) return;
      hideFeedback();
      result = null;
      taps = [];
      setPhase('count');
      try {
        await earTraining.playCountIn(rhythm.tempo, slow);
      } catch {
        /* Tap along silently if the audio context is still asleep. */
      }
      if (!mounted || echoPhase !== 'count') return;
      recordStart = 0;
      setPhase('record');
    }

    function finishEcho() {
      clearEchoTimer();
      const evaluation = rhythm.evaluate({ taps: [...taps] });
      result = evaluation;
      setPhase('idle');
      if (evaluation.correct) {
        finish(evaluation);
      } else {
        retries += 1;
        showFeedback(evaluation.message, false);
        audioEngine.playSoftMiss().catch(() => undefined);
      }
    }

    function tapDrum() {
      if (echoPhase !== 'record') return;
      if (taps.length > rhythm.hits.length + 4) return;
      if (taps.length === 0) {
        recordStart = performance.now();
        const duration = rhythm.totalBeats * rhythm.beatMs + 850;
        echoTimer = window.setTimeout(() => {
          echoTimer = null;
          if (mounted) finishEcho();
        }, duration);
        echoClock.hidden = false;
      }
      taps.push(performance.now() - recordStart);
      audioEngine.tick().catch(() => undefined);
      updateEchoUi();
    }

    function resetEcho() {
      clearEchoTimer();
      taps = [];
      result = null;
      hideFeedback();
      setPhase('idle');
    }

    echoStart?.addEventListener('click', () => void startEcho());
    stage?.addEventListener('click', () => {
      if (echoPhase === 'record') tapDrum();
    });
    echoReset?.addEventListener('click', (event) => {
      event.stopPropagation();
      resetEcho();
    });
  }

  updateListenUi();
  const autoTimer = setTimer(() => void play(), 480);

  return {
    destroy() {
      mounted = false;
      if (echoTimer !== null) window.clearTimeout(echoTimer);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      root.replaceChildren();
      void result;
      void autoTimer;
    },
  };
}

export function mountChallenge(root) {
  let view = null;
  let key = '';

  function update(state) {
    const session = state.challenge;
    if (!session) {
      if (view) view.destroy();
      view = null;
      key = '';
      if (root.childElementCount > 0) root.replaceChildren();
      return;
    }
    const nextKey = `${session.skill}-${session.round}`;
    if (!view || key !== nextKey) {
      if (view) view.destroy();
      key = nextKey;
      view = createView(session, root);
    }
  }

  const unsubscribe = subscribe(update);
  update(getState());
  return unsubscribe;
}
