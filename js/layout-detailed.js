// Detailed mode: one scrolling article, everything expanded, every sim with a local store.
import { h, icon, esc } from './ui/dom.js';
import { mathify, tex } from './ui/math.js';
import { createStore } from './state.js';
import { createDemoPlayer, createCaptionBar, activePlayer } from './demo-player.js';
import { showKeymap } from './presenter.js';
import { showSymbols } from './symbols.js';
import { showQR } from './qr.js';
import { closeOverlay, overlayOpen } from './overlay.js';
import { modeToggle, brand, iconButton, typingTarget } from './layout-common.js';
import { TITLE, COURSE, AUTHORS } from './config.js';
import { EXTRAS } from './content-extras.js';

export function buildDetailed(root, { sections, intro, further = [], facts, onMode }) {
  const X = EXTRAS(facts);
  const tocItems = [
    ...(intro ? [{ id: 'intro', label: 'Why it matters', short: 'Intro' }] : []),
    ...sections.map((s) => ({ id: s.id, label: `${s.num}. ${s.short}`, short: String(s.num) })),
    ...further.map((s) => ({ id: s.id, label: `Going further: ${s.short}`, short: 'MOS' })),
    { id: 'misconceptions', label: 'Misconceptions', short: 'Myths' },
    { id: 'limits', label: 'Model limits', short: 'Limits' },
    { id: 'refs', label: 'References', short: 'Refs' },
  ];
  const topNav = h(
    'nav',
    { class: 'top-nav', 'aria-label': 'Sections' },
    tocItems.map((t) => h('a', { href: `#${t.id}`, 'aria-label': t.label }, t.short)),
  );
  const header = h(
    'header',
    { class: 'topbar' },
    brand('#top'),
    topNav,
    h(
      'div',
      { class: 'tb-right' },
      iconButton('qr', 'QR code (Q)', () => showQR()),
      iconButton('symbols', 'Symbols (S)', () => showSymbols('detailed')),
      iconButton('keys', 'Keyboard shortcuts (?)', () => showKeymap('detailed'), { cls: 'hide-phone' }),
      modeToggle('detailed', onMode),
    ),
  );
  const toc = h(
    'aside',
    { class: 'toc', 'aria-label': 'Contents' },
    h('p', { class: 'toc-title' }, 'Contents'),
    h('ol', {}, tocItems.map((t) => h('li', {}, h('a', { href: `#${t.id}`, dataset: { id: t.id } }, t.label)))),
  );

  const article = h('main', { class: 'article', id: 'main' });
  const hero = h(
    'section',
    { class: 'hero', id: 'top' },
    h('p', { class: 'eyebrow' }),
    h('h1', {}, TITLE),
    h('div', { class: 'lede prose', html: mathify(X.lede) }),
  );
  article.append(hero);

  const units = [];

  /**
   * One interactive card: own store, player, caption, demo row, sim, optional "Try this".
   * def = { id, start(), create(root, ctx) -> sim, title, note, tryThis }
   */
  function simCard(def, sec) {
    const store = createStore(def.start());
    const caption = createCaptionBar(h('div'), '');
    caption.el.dataset.collapse = '1';
    caption.el.hidden = true;
    const btns = {};
    let player;
    const refresh = () => {
      for (const b of Object.values(btns)) {
        const on = player && player.playing && player.script === b._script;
        b.classList.toggle('playing', !!on);
        b.setAttribute('aria-pressed', String(!!on));
      }
    };
    player = createDemoPlayer({ store, caption, onChange: refresh });
    const simRoot = h('div', { class: `sim sim-${def.id}` });
    const ctx = { mode: 'detailed', store, player, caption, facts, section: sec };
    const sim = def.create(simRoot, ctx);

    const demoRow = h('div', { class: 'sim-demos' });
    for (const d of sim.demos) {
      const b = h(
        'button',
        { type: 'button', class: 'btn primary demo-btn', 'aria-pressed': 'false', onclick: () => player.play(d.script) },
        h('span', { class: 'demo-label' }, d.label),
        d.title ? h('span', { class: 'demo-title', html: d.title }) : null,
      );
      b._script = d.script;
      btns[d.id] = b;
      demoRow.append(b);
    }
    const replay = iconButton('replay', 'Replay last demo (R)', () => player.replay(), { text: 'Replay' });
    const pause = iconButton('pause', 'Pause / resume (Space)', () => player.toggle(), { text: 'Pause' });
    demoRow.append(h('span', { class: 'demo-ctl' }, pause, replay));

    const card = h(
      'div',
      { class: `card sim-card ${def.cls || ''}` },
      h('div', { class: 'card-head' }, h('h3', {}, def.title || 'Simulation'), def.note ? h('span', { class: 'sub', html: mathify(def.note) }) : null),
      demoRow,
      caption.el,
      simRoot,
      def.tryThis?.length ? h('div', { class: 'try-this' }, h('h4', {}, 'Try this'), h('ul', {}, def.tryThis.map((t) => h('li', { html: mathify(t) })))) : null,
    );

    // render only when near the viewport; animation loops run only while visible
    let visible = false;
    let dirty = true;
    store.subscribe((st) => {
      if (visible) sim.update(st);
      else dirty = true;
    });
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          visible = en.isIntersecting;
          if (visible) {
            if (dirty) {
              dirty = false;
              sim.update(store.get());
            }
            sim.onShow?.(store.get());
          } else {
            if (player.playing) player.stop();
            sim.onHide?.();
          }
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(simRoot);
    const unit = { card, sim, player, store, io };
    units.push(unit);
    return unit;
  }

  // ---- intro: "Why this matters for every transistor"
  if (intro) {
    const C = intro.content(facts);
    const u = simCard({ id: intro.id, start: intro.start, create: intro.sim, title: C.simTitle, note: C.simNote, tryThis: C.tryThis, cls: 'chip-card' }, intro);
    article.append(
      h(
        'section',
        { class: 'dsec intro', id: 'intro', 'aria-labelledby': 'intro-h' },
        h('h2', { id: 'intro-h' }, intro.detailedTitle),
        h('p', { class: 'takeaway', html: mathify(C.takeaway) }),
        u.card,
      ),
    );
  }

  for (const sec of sections) buildSection(sec);

  function buildSection(sec) {
    const C = sec.content(facts);
    const u = simCard({ id: sec.id, start: sec.start, create: sec.sim, title: C.simTitle, note: C.simNote, tryThis: C.tryThis }, sec);
    const extraCards = (sec.extras || []).map((ex) => simCard({ id: ex.id, start: ex.start, create: ex.create, title: ex.title, note: ex.note, cls: 'chip-card' }, sec).card);
    const gameCards = (sec.hooks || []).map((hd) => {
      const host = h('div', { class: 'hook-host' });
      const card = h('div', { class: 'card game-card' }, host);
      const hk = hd.create(host, { mode: 'detailed', facts, section: sec });
      hk.start();
      return card;
    });
    const head = sec.further
      ? h('header', { class: 'dsec-head' }, h('h2', { id: `${sec.id}-h` }, h('span', { class: 'eyebrow-inline' }, 'Going further: '), sec.title))
      : h('header', { class: 'dsec-head' }, h('span', { class: 'sec-num', 'aria-hidden': 'true' }, String(sec.num)), h('h2', { id: `${sec.id}-h` }, sec.title));
    const el = h(
      'section',
      { class: `dsec${sec.further ? ' further' : ''}`, id: sec.id, 'aria-labelledby': `${sec.id}-h` },
      head,
      C.takeaway ? h('p', { class: 'takeaway', html: mathify(C.takeaway) }) : null,
      C.keyEq ? h('div', { class: 'keyeq', html: tex(C.keyEq, true) }) : null,
      C.concept ? h('div', { class: 'prose concept', html: mathify(C.concept) }) : null,
      C.derivation ? h('div', { class: 'card derivation prose', html: mathify(C.derivation) }) : null,
      u.card,
      extraCards,
      C.deepDive ? h('div', { class: 'card deep-dive prose', html: mathify(C.deepDive) }) : null,
      C.assumptions?.length
        ? h('div', { class: 'assumptions prose' }, h('h4', {}, 'Assumptions'), h('ul', {}, C.assumptions.map((a) => h('li', { html: mathify(a) }))))
        : null,
      gameCards,
      C.misconceptions?.length
        ? h(
            'aside',
            { class: 'misconceptions prose' },
            h('h4', {}, 'Common misconception'),
            h('ul', {}, C.misconceptions.map((m) => h('li', { html: mathify(m) }))),
          )
        : null,
    );
    article.append(el);
  }

  for (const sec of further || []) buildSection(sec);

  // extras
  article.append(
    h('section', { class: 'dsec extra', id: 'misconceptions' }, h('h2', {}, 'Common misconceptions'), h('div', { class: 'prose', html: mathify(X.misconceptions) })),
    h('section', { class: 'dsec extra', id: 'limits' }, h('h2', {}, 'Model limits'), h('div', { class: 'prose', html: mathify(X.limits) })),
    h('section', { class: 'dsec extra', id: 'refs' }, h('h2', {}, 'References'), h('div', { class: 'prose', html: mathify(X.refs) })),
  );

  const footer = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'footer-inner prose' },
      h('p', { html: `<strong>${esc(TITLE)}</strong> · ${esc(COURSE)}` }),
      h('p', { html: `Authors: ${AUTHORS ? esc(AUTHORS) : '<span class="todo">TODO: authors</span>'}` }),
      h('p', { class: 'small', html: mathify(X.footerNote) }),
    ),
  );

  root.append(h('div', { class: 'app app-detailed' }, header, h('div', { class: 'doc' }, toc, article), footer));

  // TOC highlighting
  const tocLinks = [...toc.querySelectorAll('a')];
  const secIo = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          for (const a of tocLinks) a.classList.toggle('active', a.dataset.id === en.target.id);
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  article.querySelectorAll('section[id]').forEach((s) => secIo.observe(s));

  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === 'Escape') return closeOverlay();
    if (overlayOpen() || typingTarget(e)) return false;
    const onButton = e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A');
    // Space only steers a demo that is running/paused; otherwise it scrolls the page as usual.
    if (e.key === ' ' && !onButton && activePlayer()?.playing) {
      activePlayer().toggle();
      return true;
    }
    if ((e.key === 'r' || e.key === 'R') && activePlayer()?.script) {
      activePlayer().replay();
      return true;
    }
    return false;
  }

  if (location.hash) {
    const t = document.getElementById(location.hash.slice(1));
    if (t) requestAnimationFrame(() => t.scrollIntoView());
  }

  return {
    handleKey,
    destroy() {
      for (const u of units) {
        u.player.stop();
        u.sim.onHide?.();
        u.io.disconnect();
      }
      secIo.disconnect();
    },
  };
}
