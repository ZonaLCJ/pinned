// Section 4 hook "Build the lowest-resistance contact": 30 s, target ρ_c < 1e-6 Ω·cm².
// Reuses the simulator controls on a local store. Leaderboard: session (presentation)
// or localStorage (detailed).
import { h } from '../ui/dom.js';
import { makeParams, contactResistivity, analyticBarrier } from '../engine.js';
import { createStore, stateFor, metalAt } from '../state.js';
import { boundControls, semiControl, metalControl } from '../ui/controls.js';
import { createPlot, logScale, line, rect, circle, text } from '../plots/svg.js';
import { num, sci, rhoStr, ndStr } from '../ui/format.js';
import { load, save } from '../ui/storage.js';
import { hookFrame, countdown, givenBox } from './hook-ui.js';
import { buildContactGiven } from './given.js';
import { metalById, PRESET_FOR_SEMI } from '../../data/materials.js';

export const TARGET = 1e-6;
const sessionBoard = [];

function drawMeter(ctx, { rho }) {
  const { w, h, st } = ctx;
  const box = { l: 10, r: w - 10, t: st.label * 1.6, b: h - st.tick - 14 };
  const x = logScale(1e-8, 1e2, box.l, box.r);
  const cy = (box.t + box.b) / 2;
  let s = rect(box.l, cy - 10, x(TARGET) - box.l, 20, { fill: '#d8f2ee', rx: 4 });
  s += rect(x(TARGET), cy - 10, box.r - x(TARGET), 20, { fill: 'var(--brand-tint)', rx: 4 });
  for (let e = -8; e <= 2; e += 2) {
    s += line(x(10 ** e), cy + 12, x(10 ** e), cy + 18, { stroke: 'var(--text-muted)', 'stroke-width': 1.5 });
    s += text(x(10 ** e), cy + 22 + st.tick * 0.5, `10^{${e}}`, { anchor: 'middle', cls: 'tick' });
  }
  s += line(x(TARGET), cy - 18, x(TARGET), cy + 14, { stroke: 'var(--brand-ink)', 'stroke-width': 3 });
  s += text(x(TARGET), cy - 22, 'target', { anchor: 'middle', cls: 'ink strong' });
  const rx = x(Math.min(1e2, Math.max(1e-8, rho)));
  s += circle(rx, cy, 13, { fill: rho < TARGET ? 'var(--brand-ink)' : '#a7abc6', stroke: 'var(--surface)', 'stroke-width': 3 });
  return s;
}

/** Parameters of the quiz's own contact for a semiconductor (its preset interface, t = 0). */
export const contactParams = (semi, extra = {}) => makeParams(stateFor(PRESET_FOR_SEMI[semi], semi, { phiM: 5.1, Nd: 1e16, t: 0, ...extra }));
/** Box content: constants per semiconductor, the E0' table and the solver-vs-formula example (Al/Si, 1e19). */
export function contactGiven() {
  const pAl = contactParams('Si', { phiM: metalById('Al').phiM, Nd: 1e19 });
  const example = { label: 'Al/Si', Nd: pAl.Nd, full: contactResistivity(pAl, { t: 0 }).phiBn, formula: analyticBarrier(pAl) };
  return buildContactGiven((semi) => contactParams(semi), TARGET, example);
}

export function createBuildContact(root, ctx) {
  const present = ctx.mode === 'present';
  const F = hookFrame(root, { title: 'Build the lowest-resistance contact', mode: ctx.mode });
  const G = givenBox(F, { mode: ctx.mode });
  G.set(contactGiven());
  const store = createStore(stateFor('si', 'Si', { phiM: 5.1, Nd: 1e16, t: 0 }));
  const sc = semiControl(store, { materials: ['Si', 'GaAs'], nLabels: true });
  const mc = metalControl(store);
  const bc = boundControls(store, ['t', 'Nd']);
  const big = h('div', { class: 'bc-rho mono' });
  const small = h('div', { class: 'hook-sub' });
  const meterHost = h('div', { class: 'bc-meter' });
  const meter = createPlot(meterHost, drawMeter, { label: 'Contact resistivity versus target' });
  const board = h('ol', { class: 'leaderboard' });
  const boardWrap = h('div', { class: 'bc-board' }, h('div', { class: 'hook-sub' }, present ? 'Session best' : 'Your best (this device)'), board);
  F.q.innerHTML = `Target: ρ<sub>c</sub> &lt; ${sci(TARGET, 1)} Ω·cm²`;
  F.sub.innerHTML = 'Pick a semiconductor, a metal, the interlayer t and the doping N<sub>d</sub>. Toy model, qualitative.';
  F.options.replaceWith(h('div', { class: 'bc-controls' }, h('div', { class: 'ctl-row' }, sc.el), mc.el, h('div', { class: 'sliders one' }, bc.els)));
  F.visual.append(big, small, meterHost, boardWrap);
  Object.assign(meterHost.style, { height: present ? '120px' : '96px', display: 'flex' });
  meterHost.firstChild.style.height = '100%';

  let timer = null;
  let lockedIn = false;

  const getBoard = () => (present ? sessionBoard : load('board.contact', []));
  const setBoard = (b) => {
    b.sort((a, c) => a.rho - c.rho);
    b.splice(5);
    if (present) {
      sessionBoard.splice(0, sessionBoard.length, ...b);
    } else save('board.contact', b);
  };
  function renderBoard() {
    const b = getBoard();
    board.replaceChildren(
      ...(b.length
        ? b.map((e) => h('li', { class: e.rho < TARGET ? 'hit' : '' }, `${rhoStr(e.rho)} · ${e.semi}/${e.metal || '—'} · t ${num(e.t, 2)} nm · ${ndStr(e.Nd, 1)}`))
        : [h('li', {}, 'no entries yet')]),
    );
  }

  function compute(s) {
    const p = makeParams(s);
    return contactResistivity(p, { t: s.t, lambda: s.lambda, kappa: s.kappa });
  }
  function update(s) {
    sc.sync(s);
    mc.sync(s);
    bc.sync(s);
    const c = compute(s);
    big.innerHTML = `ρ<sub>c</sub> = ${rhoStr(c.rhoC)}`;
    big.classList.toggle('hit', c.rhoC < TARGET);
    small.innerHTML = `φ<sub>Bn</sub> = ${num(c.phiBn, 2)} eV · ${c.rhoC < TARGET ? 'target reached' : 'not yet'}`;
    meter.update({ rho: c.rhoC });
  }
  store.subscribe((s) => update(s));

  function lockIn() {
    if (lockedIn) return;
    lockedIn = true;
    timer?.stop();
    const s = store.get();
    const c = compute(s);
    const m = metalAt(s.phiM);
    const b = getBoard().slice();
    b.push({ rho: c.rhoC, semi: s.semi, metal: m ? m.id : `${num(s.phiM, 2)} eV`, t: s.t, Nd: s.Nd });
    setBoard(b);
    renderBoard();
    F.feedback.hidden = false;
    F.feedback.className = `hook-feedback ${c.rhoC < TARGET ? 'good' : 'bad'}`;
    F.feedback.innerHTML =
      c.rhoC < TARGET
        ? `<strong>Target reached:</strong> ${rhoStr(c.rhoC)}. Heavy doping thins the barrier; the interlayer lowers it until tunnelling through it costs more than it saves.`
        : `<strong>${rhoStr(c.rhoC)}.</strong> Hint: you need both high doping and an interlayer of about ${num(ctx.facts.opt19.t, 1)} nm.`;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: start }, 'New attempt'));
  }

  function start() {
    lockedIn = false;
    store.replace(stateFor('si', 'Si', { phiM: 5.1, Nd: 1e16, t: 0 }));
    F.feedback.hidden = true;
    F.footer.replaceChildren(h('button', { type: 'button', class: 'btn primary', onclick: lockIn }, 'Lock in'), ...(present ? [h('span', { class: 'hook-sub' }, 'Enter: lock in')] : []));
    renderBoard();
    timer?.stop();
    timer = countdown(F.cd, 30, { onEnd: lockIn });
  }

  return {
    start,
    stop: () => timer?.stop(),
    toggleGiven: () => G.toggle(),
    closeGiven: () => G.close(),
    onKey(k) {
      if (k === 'Enter') {
        if (!lockedIn) lockIn();
        else start();
        return true;
      }
      return false;
    },
  };
}
