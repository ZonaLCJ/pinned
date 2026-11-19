// Pieces shared by both layouts.
import { h, icon } from './ui/dom.js';
import { TITLE, SHORT_TITLE } from './config.js';
import { isPhone } from './modes.js';

export function modeToggle(mode, onMode) {
  const mk = (m, label) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn',
        'aria-pressed': String(mode === m),
        onclick: () => mode !== m && onMode(m),
        title: m === 'present' ? 'Outline mode (slides)' : 'Detailed mode (article)',
      },
      label,
    );
  // phones only ever show Detailed mode, so they get no toggle
  return h('div', { class: 'seg mode-toggle', role: 'group', 'aria-label': 'Display mode', hidden: isPhone() }, mk('present', 'Outline'), mk('detailed', 'Detailed'));
}

export function brand(href) {
  const [main, ...rest] = TITLE.split(' ');
  const sub = TITLE.startsWith(SHORT_TITLE) ? TITLE.slice(SHORT_TITLE.length).trim() : rest.join(' ');
  return h(
    href ? 'a' : 'div',
    { class: 'tb-brand', href: href || null },
    h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
    h('span', { class: 'site-title' }, TITLE.startsWith(SHORT_TITLE) ? SHORT_TITLE : main),
    h('span', { class: 'site-sub' }, sub),
  );
}

export function iconButton(name, label, onclick, extra = {}) {
  return h('button', { type: 'button', class: `btn ghost icon-btn ${extra.cls || ''}`, 'aria-label': label, title: label, onclick }, icon(name), extra.text ? h('span', { class: 'ib-text' }, extra.text) : null);
}

/** Is the keyboard event aimed at a form control that needs the key itself? */
export function typingTarget(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t.type || '').toLowerCase();
    // range sliders only need the arrow keys (handled by the layouts); letters stay shortcuts
    return !['checkbox', 'radio', 'button', 'range', 'submit', 'reset'].includes(type);
  }
  return false;
}
