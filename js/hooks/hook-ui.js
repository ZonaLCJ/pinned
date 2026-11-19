// Shared game UI: frame, countdown, options, best scores.
import { h } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { mathify } from '../ui/math.js';

export function hookFrame(root, { title, mode, single = false }) {
  const titleEl = h('span', { class: 'hook-title' }, title);
  const meta = h('span', { class: 'hook-meta' });
  const cd = h('span', { class: 'countdown', 'aria-live': 'off', hidden: true });
  const head = h('div', { class: 'hook-head' }, h('div', {}, titleEl), h('div', { class: 'hook-meta-wrap', style: { display: 'flex', gap: '12px', alignItems: 'center' } }, meta, cd));
  const q = h('div', { class: 'hook-q', 'aria-live': 'polite' });
  const sub = h('div', { class: 'hook-sub' });
  const options = h('div', { class: 'hook-options' });
  const feedback = h('div', { class: 'hook-feedback', hidden: true, 'aria-live': 'polite' });
  const footer = h('div', { class: 'hook-footer' });
  const main = h('div', { class: 'hook-main' }, q, sub, options, feedback, footer);
  const visual = h('div', { class: 'hook-visual' });
  const body = h('div', { class: `hook-body${single ? ' single' : ''}` }, main, visual);
  const el = h('div', { class: `hook hook-${mode}` }, head, body);
  root.append(el);
  return { el, titleEl, meta, cd, q, sub, options, feedback, footer, main, visual, body };
}

/** Countdown in `el`. Returns { stop(), remaining() }. */
export function countdown(el, seconds, { onEnd, onTick } = {}) {
  el.hidden = false;
  el.classList.remove('urgent', 'done');
  const t0 = performance.now();
  let iv = 0;
  const paint = () => {
    const rem = Math.max(0, seconds - (performance.now() - t0) / 1000);
    el.textContent = rem > 0 ? String(Math.ceil(rem)) : '0';
    el.classList.toggle('urgent', rem <= Math.min(3, seconds / 3) && rem > 0);
    onTick?.(rem);
    if (rem <= 0) {
      clearInterval(iv);
      iv = 0;
      el.classList.add('done');
      el.textContent = 'Time';
      onEnd?.();
    }
  };
  iv = setInterval(paint, 100);
  paint();
  return {
    stop() {
      if (iv) clearInterval(iv);
      iv = 0;
    },
    remaining: () => Math.max(0, seconds - (performance.now() - t0) / 1000),
  };
}

/** Option buttons. opts: [{ value, label, key }] */
export function setOptions(host, opts, onPick) {
  host.replaceChildren(
    ...opts.map((o, i) =>
      h('button', { type: 'button', class: 'btn', dataset: { value: String(o.value) }, onclick: () => onPick(o.value), html: `<span>${o.label}</span>`, 'aria-label': o.aria || null }),
    ),
  );
  return [...host.children];
}

export function markOptions(buttons, { correct, chosen }) {
  for (const b of buttons) {
    const v = b.dataset.value;
    b.classList.toggle('correct', v === String(correct));
    b.classList.toggle('wrong', chosen != null && v === String(chosen) && v !== String(correct));
    b.classList.toggle('chosen', chosen != null && v === String(chosen));
  }
}

export function clearMarks(buttons) {
  for (const b of buttons) b.classList.remove('correct', 'wrong', 'chosen');
}

export const getBest = (key) => load(`best.${key}`, null);
/** Save if better. better(a, b) -> true when a beats b. */
export function saveBest(key, value, better = (a, b) => a > b) {
  const prev = getBest(key);
  if (prev == null || better(value, prev)) {
    save(`best.${key}`, value);
    return true;
  }
  return false;
}

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * "Given & formulas" box under the question text.
 * Detailed mode: a <details> box, open by default (collapsible).
 * Outline mode: collapsed behind a "Given & formulas" button (and the G key); it opens as a
 * panel over the quiz's picture column (like the More drawer), so the slide never scrolls.
 * `inline` (Outline mode only): open in place under the question instead (short content).
 */
export function givenBox(F, { mode, inline = false }) {
  const present = mode === 'present';
  const body = h('div', { class: 'given-body' });
  let el;
  let btn = null;
  if (present) {
    btn = h('button', { type: 'button', class: 'btn given-btn', 'aria-expanded': 'false', onclick: () => toggle() }, 'Given & formulas', h('span', { class: 'kbd' }, ' G'));
    const close = h('button', { type: 'button', class: 'btn ghost given-close', 'aria-label': 'Close Given & formulas (G)', onclick: () => setOpen(false) }, '×');
    el = h('section', { class: `given given-pop${inline ? ' inline' : ''}`, hidden: true, role: 'region', 'aria-label': 'Given & formulas' }, h('div', { class: 'given-head' }, h('h4', {}, 'Given & formulas'), close), body);
    F.titleEl.after(btn);
    if (inline) F.sub.after(el);
    else F.body.append(el);
  } else {
    el = h('details', { class: 'given', open: true }, h('summary', {}, 'Given & formulas'), body);
    F.sub.after(el);
  }
  function setOpen(open) {
    if (!present) {
      el.open = open;
      return;
    }
    el.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }
  function toggle() {
    setOpen(present ? el.hidden : !el.open);
    return true;
  }
  return {
    el,
    button: btn,
    toggle,
    close() {
      const was = present ? !el.hidden : el.open;
      if (present && was) setOpen(false);
      return present && was;
    },
    get isOpen() {
      return present ? !el.hidden : el.open;
    },
    /** content: { given: [{ html }], formulas: [html], notes: [html], table?, relation? } */
    set(content) {
      body.innerHTML = renderGiven(content);
    },
    /** Hide the whole box (and its button) when there is no question, e.g. on the score screen. */
    show(on) {
      if (present) {
        btn.hidden = !on;
        if (!on) setOpen(false);
      } else el.hidden = !on;
    },
  };
}

export function renderGiven(c) {
  let s = '';
  if (c.relation) s += `<p class="given-rel"><strong>Useful relation:</strong> ${mathify(c.relation)}</p>`;
  if (c.given?.length) s += `<div class="given-sec"><h5>Given</h5><ul class="given-list">${c.given.map((g) => `<li>${mathify(g.html)}</li>`).join('')}</ul></div>`;
  if (c.table) {
    const head = `<tr>${c.table.head.map((x) => `<th>${mathify(x)}</th>`).join('')}</tr>`;
    const rows = c.table.rows.map((r) => `<tr>${r.map((x, i) => (i ? `<td>${mathify(x)}</td>` : `<th scope="row">${mathify(x)}</th>`)).join('')}</tr>`).join('');
    s += `<div class="given-sec given-table-wrap"><table class="given-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }
  if (c.formulas?.length) s += `<div class="given-sec"><h5>Formulas</h5><ul class="given-formulas">${c.formulas.map((f) => `<li>${mathify(f)}</li>`).join('')}</ul></div>`;
  if (c.notes?.length) s += c.notes.map((n) => `<p class="given-note">${mathify(n)}</p>`).join('');
  return s;
}
