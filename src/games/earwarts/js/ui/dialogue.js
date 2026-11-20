import { closeDialogue, getState, subscribe } from '../store.js';
import { escapeHtml } from './dom.js';

export function mountDialogue(root) {
  let dialogueRef = null;
  let index = 0;

  function renderLine() {
    if (!dialogueRef || dialogueRef.length === 0) {
      root.replaceChildren();
      return;
    }
    const line = dialogueRef[Math.min(index, dialogueRef.length - 1)];
    const last = index >= dialogueRef.length - 1;
    root.innerHTML = `
      <div class="dialogue-backdrop">
        <section class="dialogue-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(line.speaker)} speaks">
          <div class="dialogue-ornament" aria-hidden="true">✦</div>
          <div class="dialogue-speaker">
            <span class="dialogue-face" aria-hidden="true">${line.face ?? '✦'}</span>
            <span>${escapeHtml(line.speaker)}</span>
          </div>
          <p class="dialogue-text">${escapeHtml(line.text)}</p>
          <div class="dialogue-actions">
            ${
              dialogueRef.length > 1
                ? `<span class="dialogue-dots" aria-hidden="true">${dialogueRef.map((_, dot) => `<span class="${dot === index ? 'active' : ''}"></span>`).join('')}</span>`
                : ''
            }
            <button class="primary-button" type="button" data-dialogue-next>${last ? 'Off we go' : 'Continue'}</button>
          </div>
        </section>
      </div>`;
    root.querySelector('[data-dialogue-next]')?.addEventListener('click', () => {
      if (last) closeDialogue();
      else {
        index += 1;
        renderLine();
      }
    });
  }

  function update(state) {
    if (!state.dialogue || state.dialogue.length === 0) {
      if (dialogueRef) root.replaceChildren();
      dialogueRef = null;
      index = 0;
      return;
    }
    if (state.dialogue === dialogueRef) return;
    dialogueRef = state.dialogue;
    index = 0;
    renderLine();
  }

  const unsubscribe = subscribe(update);
  update(getState());
  return unsubscribe;
}
