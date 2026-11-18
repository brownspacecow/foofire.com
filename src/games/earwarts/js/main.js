import { audioEngine } from './audio.js';
import { getState, loadGame, persist, setPanel, subscribe } from './store.js';
import { initScene } from './world/scene.js';
import { mountOnboarding } from './ui/onboarding.js';
import { mountHud } from './ui/hud.js';
import { mountPanels } from './ui/panels.js';
import { mountDialogue } from './ui/dialogue.js';
import { mountChallenge } from './ui/challenge.js';
import { mountToasts } from './ui/toasts.js';

const root = document.querySelector('#root');
if (root) {
  root.innerHTML = '<div class="earwarts-app" id="app"></div>';
  const app = root.firstElementChild;
  const backdrop = document.createElement('div');
  backdrop.className = 'castle-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const shell = document.createElement('div');
  shell.className = 'castle-shell';

  const labels = document.createElement('div');
  labels.id = 'world-labels';
  labels.setAttribute('aria-hidden', 'true');

  const hudRoot = document.createElement('div');
  const toastRoot = document.createElement('div');
  const panelsRoot = document.createElement('div');
  const dialogueRoot = document.createElement('div');
  const challengeRoot = document.createElement('div');
  const onboardingRoot = document.createElement('div');

  app.append(backdrop, shell, labels, hudRoot, toastRoot, panelsRoot, dialogueRoot, challengeRoot, onboardingRoot);

  mountHud(hudRoot);
  mountToasts(toastRoot);
  mountPanels(panelsRoot);
  mountDialogue(dialogueRoot);
  mountChallenge(challengeRoot);
  mountOnboarding(onboardingRoot);

  let sceneStarted = false;

  function showSceneError() {
    const error = document.createElement('div');
    error.className = 'scene-error';
    error.innerHTML =
      '<p>The castle lights are having trouble waking in this browser. WebGL is needed to explore the 3D halls. Try a current browser with hardware acceleration enabled, then reload.</p>';
    shell.append(error);
  }

  function startScene() {
    if (sceneStarted) return;
    sceneStarted = true;
    try {
      initScene({ container: shell, labelsLayer: labels });
    } catch (error) {
      console.error('Earwarts scene failed to start', error);
      showSceneError();
    }
  }

  function syncEntered(state) {
    const entered = Boolean(state.ready && state.save.playerName);
    backdrop.hidden = entered;
    if (!entered) {
      onboardingRoot.hidden = false;
      return;
    }
    onboardingRoot.hidden = true;
    onboardingRoot.replaceChildren();
    document.title = state.save.playerName
      ? `${state.save.playerName} · Earwarts Academy`
      : 'Earwarts Academy';
    startScene();
  }

  subscribe(syncEntered);

  const unlockAudio = () => {
    audioEngine.init().catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio);

  window.addEventListener('keydown', (event) => {
    const element = document.activeElement;
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const state = getState();
    if (event.code === 'Escape') {
      if (state.challenge) {
        import('./store.js').then((store) => store.closeChallenge());
        return;
      }
      if (state.dialogue) {
        import('./store.js').then((store) => store.closeDialogue());
        return;
      }
      if (state.panel !== 'none') setPanel('none');
      return;
    }
    if (state.challenge || state.dialogue || state.panel !== 'none') return;
    if (!state.save.playerName) return;
    switch (event.code) {
      case 'KeyB':
        setPanel('spellbook');
        break;
      case 'KeyM':
        setPanel('map');
        break;
      case 'KeyQ':
        setPanel('quests');
        break;
      case 'KeyI':
        setPanel('inventory');
        break;
      case 'Digit1':
        import('./store.js').then((store) => store.castSpell('lumina'));
        break;
      case 'Digit2':
        import('./store.js').then((store) => store.castSpell('floris'));
        break;
      case 'Digit3':
        import('./store.js').then((store) => store.castSpell('leviosa'));
        break;
      case 'Digit4':
        import('./store.js').then((store) => store.castSpell('echo'));
        break;
      default:
        break;
    }
  });

  const saveQuietly = () => {
    const state = getState();
    if (state.ready && state.save.playerName) persist();
  };
  window.setInterval(saveQuietly, 30_000);
  window.addEventListener('pagehide', saveQuietly);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveQuietly();
  });

  loadGame()
    .then(() => {
      syncEntered(getState());
    })
    .catch((error) => {
      console.error('Earwarts save load failed', error);
      onboardingRoot.innerHTML =
        '<div class="onboarding onboarding-loading"><div class="loading-sigil">✦</div><h1>Earwarts Academy</h1><p class="loading-copy">The castle could not open its save scroll. Reload to try again.</p></div>';
    });
}
