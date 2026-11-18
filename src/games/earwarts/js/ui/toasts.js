import { dismissToast, getState, subscribe } from '../store.js';
import { escapeHtml } from './dom.js';

export function mountToasts(root) {
  let signature = '';

  function render(state) {
    const visible = !state.dialogue && !state.challenge && state.toasts.length > 0;
    const nextSignature = visible
      ? state.toasts.map((toast) => toast.id).join('|')
      : 'none';
    if (nextSignature === signature) return;
    signature = nextSignature;
    if (!visible) {
      root.replaceChildren();
      return;
    }
    root.innerHTML = `<div class="toast-stack" aria-live="polite" aria-atomic="false">${state.toasts
      .map(
        (toast) => `<div class="magic-toast tone-${toast.tone ?? 'gold'}" role="status">
          <span class="toast-icon" aria-hidden="true">${toast.icon ?? '✦'}</span>
          <span class="toast-copy"><strong>${escapeHtml(toast.title)}</strong>${toast.text ? `<span>${escapeHtml(toast.text)}</span>` : ''}</span>
          <button type="button" data-toast="${toast.id}" aria-label="Dismiss message">×</button>
        </div>`
      )
      .join('')}</div>`;
    root.querySelectorAll('[data-toast]').forEach((button) => {
      button.addEventListener('click', () => dismissToast(button.dataset.toast));
    });
  }

  const unsubscribe = subscribe(render);
  render(getState());
  return unsubscribe;
}
