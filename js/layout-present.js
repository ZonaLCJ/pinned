// Presentation mode: one section per screen, left 35% text, right 65% live simulation.
import { h, icon, $$ } from './ui/dom.js';
import { mathify, tex } from './ui/math.js';
import { createStore } from './state.js';
import { createDemoPlayer, createCaptionBar, activePlayer } from './demo-player.js';
import { showKeymap } from './presenter.js';
import { showSymbols } from './symbols.js';
import { showQR } from './qr.js';
import { closeOverlay, overlayOpen } from './overlay.js';
import { modeToggle, brand, iconButton, typingTarget } from './layout-common.js';

export function buildPresentation(root, { sections, facts, onMode }) {
  const store = createStore(sections[0].start());
  let current = -1;
  const slides = [];

  // ---- header
  const prev = iconButton('prev', 'Previous section (←)', () => go(current - 1), { cls: 'nav-arrow' });
  const next = iconButton('next', 'Next section (→)', () => go(current + 1), { cls: 'nav-arrow' });
  const dots = h(
    'ol',
    { class: 'dots' },
    sections.map((s, i) =>
      h('li', {}, h('button', { type: 'button', class: 'dot', 'aria-label': s.intro ? `Intro: ${s.short}` : `Section ${s.num}: ${s.short}`, onclick: () => go(i) }, String(s.num))),
    ),
  );
  const header = h(
    'header',
    { class: 'topbar' },
    brand(),
    h('nav', { class: 'deck-nav', 'aria-label': 'Sections' }, prev, dots, next),
    h(
      'div',
      { class: 'tb-right' },
      iconButton('qr', 'QR code (Q)', () => showQR()),
      iconButton('symbols', 'Symbols (S)', () => showSymbols('present')),
      iconButton('full', 'Fullscreen (F)', toggleFullscreen),
      iconButton('keys', 'Keyboard shortcuts (?)', () => showKeymap('present')),
      modeToggle('present', onMode),
    ),
  );
  const deck = h('main', { class: 'deck', id: 'main' });
  root.append(h('div', { class: 'app app-present' }, header, deck));

  // ---- slides
  for (const sec of sections) slides.push(buildSlide(sec));

  function buildSlide(sec) {
    const C = sec.content(facts);
    const caption = createCaptionBar(h('div'), C.idle || 'Demo A and Demo B animate the sliders for you.');
    const btns = {};
    let player;
    const refresh = () => {
      for (const [id, b] of Object.entries(btns)) {
        const on = player && player.playing && player.script === b._script;
        b.classList.toggle('playing', !!on);
        b.setAttribute('aria-pressed', String(!!on));
      }
    };
    player = createDemoPlayer({ store, caption, onChange: refresh });

    const simRoot = h('div', { class: `sim sim-${sec.id}` });
    const ctx = { mode: 'present', store, player, caption, facts, section: sec };
    const sim = sec.sim(simRoot, ctx);

    // left column
    const drawer = h(
      'div',
      { class: 'more-drawer', hidden: true, role: 'region', 'aria-label': 'More details' },
      h('div', { class: 'drawer-head' }, h('h3', {}, 'More'), iconButton('close', 'Close (Esc)', () => setDrawer(false))),
      h('div', { class: 'drawer-body prose', html: mathify(C.more || '') }),
    );
    if (sim.moreEl) {
      // live caption of the band diagram, kept current by the simulation
      drawer.querySelector('.drawer-body').prepend(h('h4', {}, 'What the band diagram shows now'), sim.moreEl);
    }
    const moreBtn = h('button', { type: 'button', class: 'btn more-toggle', 'aria-expanded': 'false', onclick: () => setDrawer(drawer.hidden) }, 'More ', h('span', { 'aria-hidden': 'true' }, '▾'), h('span', { class: 'kbd' }, ' D'));
    function setDrawer(open) {
      drawer.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(open));
      if (open) drawer.querySelector('.drawer-body').scrollTop = 0;
    }

    const actions = h('div', { class: 'slide-actions' });
    for (const d of sim.demos) {
      const b = h('button', { type: 'button', class: 'btn primary demo-btn', 'aria-pressed': 'false', onclick: () => playDemo(d.id) }, d.label, h('span', { class: 'kbd' }, d.key || ''));
      b._script = d.script;
      btns[d.id] = b;
      actions.append(b);
    }
    // extra views over the simulation column (e.g. Section 4 "Back to the chip")
    const extras = (sec.extras || []).map((ex) => buildExtra(ex));
    for (const ex of extras) actions.append(ex.button);
    const hookBtn = h('button', { type: 'button', class: 'btn hook-btn', onclick: () => openHook(), 'aria-label': 'Quiz (H)' }, 'Quiz', h('span', { class: 'kbd' }, 'H'));
    if (sec.hooks.length) actions.append(hookBtn);
    if (C.more) actions.append(moreBtn);

    const left = h(
      'div',
      { class: `slide-left${sec.intro ? ' intro-left' : ''}` },
      h(
        'div',
        { class: 'slide-head' },
        sec.intro ? null : h('span', { class: 'sec-num', 'aria-hidden': 'true' }, String(sec.num)),
        h('h2', {}, h('span', { class: 'sr-only' }, sec.intro ? 'Intro: ' : `Section ${sec.num}: `), sec.title),
      ),
      h('p', { class: 'takeaway', html: mathify(C.takeaway) }),
      C.keyEq ? h('div', { class: 'keyeq', html: tex(C.keyEq, true) }) : null,
      sim.leftEl || null,
      actions,
      drawer,
    );

    function buildExtra(ex) {
      const host = h('div', { class: `sim extra-sim sim-${ex.id}` });
      const close = iconButton('close', `Close ${ex.label.toLowerCase()} (Esc)`, () => closeExtra(), { cls: 'extra-close' });
      const overlay = h('div', { class: 'extra-overlay', hidden: true, role: 'region', 'aria-label': ex.label }, close, host);
      const button = h('button', { type: 'button', class: 'btn extra-btn', 'aria-label': `${ex.label} (${ex.key})`, onclick: () => (overlay.hidden ? openExtra() : closeExtra()) }, ex.label, h('span', { class: 'kbd' }, ex.key));
      let inst = null;
      let xstore = null;
      let xplayer = null;
      function openExtra() {
        player.stop();
        closeHook();
        setDrawer(false);
        if (!inst) {
          xstore = createStore(ex.start());
          const xcap = createCaptionBar(h('div'), ex.idle || '');
          xplayer = createDemoPlayer({ store: xstore, caption: xcap });
          inst = ex.create(host, { mode: 'present', store: xstore, player: xplayer, caption: xcap, facts, section: sec });
          xstore.subscribe((s) => inst.update(s));
        }
        xstore.replace(ex.start(), { source: 'init' });
        overlay.hidden = false;
        button.setAttribute('aria-pressed', 'true');
        inst.onShow?.();
        xplayer.play(inst.demos[0].script);
      }
      function closeExtra() {
        if (overlay.hidden) return;
        xplayer?.stop();
        inst?.onHide?.();
        overlay.hidden = true;
        button.setAttribute('aria-pressed', 'false');
      }
      return { ex, overlay, button, open: openExtra, close: closeExtra, get isOpen() { return !overlay.hidden; } };
    }

    // hook overlay
    const hookHost = h('div', { class: 'hook-host' });
    const hookClose = iconButton('close', 'Close quiz (Esc)', () => closeHook(), { cls: 'hook-close' });
    const hookSwitch = h('div', { class: 'hook-switch' });
    const hookOverlay = h('div', { class: 'hook-overlay', hidden: true, role: 'dialog', 'aria-label': 'Quiz' }, hookClose, hookSwitch, hookHost);
    let hook = null;
    function openHook(idx = 0) {
      closeHookInner();
      player.stop();
      const def = sec.hooks[idx];
      hookSwitch.innerHTML = '';
      if (sec.hooks.length > 1) {
        sec.hooks.forEach((hd, i) =>
          hookSwitch.append(h('button', { type: 'button', class: 'btn', 'aria-pressed': String(i === idx), onclick: () => openHook(i) }, hd.label)),
        );
      }
      hookOverlay.classList.toggle('has-switch', sec.hooks.length > 1);
      hookOverlay.hidden = false;
      hookHost.innerHTML = '';
      hook = def.create(hookHost, { mode: 'present', facts, section: sec });
      hook.start();
    }
    function closeHookInner() {
      if (hook) hook.stop();
      hook = null;
    }
    function closeHook() {
      closeHookInner();
      hookOverlay.hidden = true;
      hookBtn.focus();
    }

    const right = h('div', { class: 'slide-right' }, simRoot, extras.map((x) => x.overlay));
    const el = h('section', { class: 'slide', id: `slide-${sec.id}`, hidden: true, 'aria-roledescription': 'slide' }, left, right, hookOverlay);
    deck.append(el);

    function playDemo(id) {
      const d = sim.demos.find((x) => x.id === id);
      if (!d) return;
      for (const x of extras) x.close();
      closeHook();
      setDrawer(false);
      player.play(d.script);
    }

    return {
      sec,
      el,
      sim,
      player,
      playDemo,
      openHook,
      closeHook,
      setDrawer,
      extras,
      get drawerOpen() {
        return !drawer.hidden;
      },
      get hookOpen() {
        return !hookOverlay.hidden;
      },
      hookKey: (k) => hook?.onKey?.(k),
      hookGiven: () => hook?.toggleGiven?.(),
      hookCloseGiven: () => !!hook?.closeGiven?.(),
    };
  }

  store.subscribe((s) => {
    if (current >= 0) slides[current].sim.update(s);
  });

  function go(i) {
    if (i < 0 || i >= slides.length || i === current) return;
    if (current >= 0) {
      const old = slides[current];
      old.player.stop();
      old.closeHook();
      old.setDrawer(false);
      for (const x of old.extras) x.close();
      old.sim.onHide?.();
      old.el.hidden = true;
    }
    current = i;
    const sl = slides[i];
    sl.el.hidden = false;
    sl.player.stop();
    $$('.dot', dots).forEach((d, k) => d.setAttribute('aria-current', k === i ? 'step' : 'false'));
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    store.replace(sl.sec.start(), { source: 'init' }); // each section loads its start state on entry
    sl.sim.onShow?.(store.get());
    try {
      history.replaceState(null, '', `#${sl.sec.id}`);
    } catch {
      /* ignore */
    }
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } catch {
      /* ignore */
    }
  }

  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const sl = slides[current];
    const k = e.key;
    if (k === 'Escape') {
      if (overlayOpen()) return closeOverlay();
      const openX = sl.extras.find((x) => x.isOpen);
      if (openX) return openX.close(), true;
      if (sl.hookOpen && sl.hookCloseGiven()) return true;
      if (sl.hookOpen) return sl.closeHook(), true;
      if (sl.drawerOpen) return sl.setDrawer(false), true;
      return false;
    }
    if (overlayOpen()) return false;
    if (typingTarget(e)) return false;
    // keys handled by an open hook first
    if (sl.hookOpen && (k === 'Enter' || /^[1-9]$/.test(k) || k === 'ArrowLeft' || k === 'ArrowRight')) {
      if (sl.hookKey(k)) return true;
      if (k === 'Enter') return true;
    }
    // range inputs keep their arrow keys
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && e.target?.type === 'range') return false;
    switch (k) {
      case 'ArrowRight':
      case 'PageDown':
        go(current + 1);
        return true;
      case 'ArrowLeft':
      case 'PageUp':
        go(current - 1);
        return true;
      case 'f':
      case 'F':
        toggleFullscreen();
        return true;
      case 'd':
      case 'D':
        sl.setDrawer(!sl.drawerOpen);
        return true;
      case ' ': {
        const p = activePlayer();
        if (p && p.script) p.toggle();
        return true;
      }
      case 'r':
      case 'R': {
        const p = activePlayer();
        if (p && p.script) p.replay();
        return true;
      }
      case 'a':
      case 'A':
        sl.playDemo('A');
        return true;
      case 'b':
      case 'B':
        sl.playDemo('B');
        return true;
      case 'c':
      case 'C': {
        const x = sl.extras.find((e) => e.ex.key === 'C');
        if (x) x.isOpen ? x.close() : x.open();
        else sl.playDemo('C');
        return true;
      }
      case 'g':
      case 'G':
        if (sl.hookOpen) sl.hookGiven();
        return true;
      case 'h':
      case 'H':
        if (!sl.hookOpen && sl.sec.hooks.length) sl.openHook();
        return true;
      default:
        return false;
    }
  }

  const fromHash = sections.findIndex((s) => `#${s.id}` === location.hash);
  go(fromHash >= 0 ? fromHash : 0);

  return {
    handleKey,
    destroy() {
      for (const s of slides) {
        s.player.stop();
        for (const x of s.extras) x.close();
        s.sim.onHide?.();
      }
    },
  };
}
