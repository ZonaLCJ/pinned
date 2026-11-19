// Presenter helpers: key map.
import { h } from './ui/dom.js';
import { openOverlay } from './overlay.js';
import { isPhone } from './modes.js';

export const KEYMAP_PRESENT = [
  ['← / →', 'previous / next section'],
  ['A / B', 'play Demo A / Demo B (A plays the intro animation)'],
  ['C', 'contact animation (Section 1), back to the chip (Section 4)'],
  ['H', 'open the quiz'],
  ['G', 'quiz: Given & formulas (open / close)'],
  ['Space', 'pause / resume the demo'],
  ['R', 'replay the last demo'],
  ['Enter', 'quiz: reveal / next round'],
  ['1–4', 'quiz: pick an option'],
  ['D', 'More drawer (details)'],
  ['Esc', 'close drawer, quiz or overlay'],
  ['F', 'fullscreen'],
  ['Q', 'QR code to the detailed site'],
  ['S', 'symbols and what they mean'],
  ['M', 'switch to Detailed mode'],
  ['?', 'this key map'],
];
export const KEYMAP_DETAILED = [
  ['Q', 'QR code'],
  ['S', 'symbols and what they mean'],
  ['M', 'switch to Outline mode'],
  ['Space / R', 'pause / replay the last demo (when no control is focused)'],
  ['Esc', 'close overlay'],
  ['?', 'this key map'],
];

export function showKeymap(mode) {
  // phones cannot switch modes, so their key map has no M row
  const keys = (mode === 'present' ? KEYMAP_PRESENT : KEYMAP_DETAILED).filter(([k]) => !(k === 'M' && isPhone()));
  const rows = keys.map(([k, v]) =>
    h('tr', {}, h('td', {}, ...k.split(' / ').flatMap((kk, i) => (i ? [' / ', h('kbd', {}, kk)] : [h('kbd', {}, kk)]))), h('td', {}, v)),
  );
  return openOverlay(h('div', {}, h('h2', {}, 'Keyboard shortcuts'), h('table', { class: 'keymap' }, h('tbody', {}, rows))), {
    label: 'Keyboard shortcuts',
  });
}
