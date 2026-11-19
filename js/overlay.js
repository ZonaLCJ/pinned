// Full-screen modal overlay (QR, key map). Esc or the close button closes it.
import { h, icon } from './ui/dom.js';

let current = null;
export const overlayOpen = () => !!current;

export function closeOverlay() {
  if (!current) return false;
  const { el, prevFocus } = current;
  el.remove();
  current = null;
  prevFocus?.focus?.();
  return true;
}

export function openOverlay(content, { label = 'Dialog', cls = '' } = {}) {
  closeOverlay();
  const close = h('button', { type: 'button', class: 'btn ghost overlay-close', 'aria-label': 'Close (Esc)', onclick: closeOverlay }, icon('close'));
  const card = h('div', { class: 'overlay-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, close, content);
  const el = h('div', { class: `overlay ${cls}`, onclick: (e) => e.target === el && closeOverlay() }, card);
  document.body.append(el);
  current = { el, prevFocus: document.activeElement };
  close.focus();
  return el;
}
