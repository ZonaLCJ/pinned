// Band diagram with moving carriers and a live caption (S1–S4 simulations).
//
// Carriers: n-type electrons (filled dots) in the conduction band, p-type holes (hollow dots)
// in the valence band. Each moves horizontally at constant energy, turns back where its energy
// is below the band edge, and crosses into the metal if it is above the barrier top. Energies
// are drawn from a Boltzmann distribution with an exaggerated kT_display = 0.12 eV × T/300 K so
// crossings are visible; carriers also come from the metal at the rate that makes the two
// crossing rates equal (equilibrium). The real relative crossing rate exp(−V_bi/kT) comes
// from the engine and is shown in the readout.
import { h, prefersReducedMotion } from './dom.js';
import { createBandPlot } from '../plots/band.js';
import { crossingRate, thermalVoltage } from '../engine.js';
import { captionSentences, fullCaption } from '../captions.js';
import { circle } from '../plots/svg.js';
import { sci, num } from './format.js';

const KT_DISPLAY_300 = 0.12; // eV at 300 K (display only)
const CAPTION_MS = 300;

export function createLiveBand(host, ctx, { label } = {}) {
  const present = ctx.mode === 'present';
  const band = createBandPlot(host, label);
  const reduced = prefersReducedMotion();

  // ---- footer: pause button, real-rate readout, note, caption
  const pauseBtn = h('button', { type: 'button', class: 'btn pause-carriers', 'aria-pressed': 'false', onclick: () => setPaused(!paused) }, 'Pause carrier motion');
  const rate = h('span', { class: 'carrier-rate' });
  const note = h(
    'span',
    { class: 'carrier-note' },
    'carrier energies exaggerated so crossings are visible; the real crossing rate is in the readout.',
  );
  const EQUILIBRIUM = 'At equilibrium the same number cross each way.';
  const caption = h('p', { class: 'live-caption', 'aria-live': 'polite' });
  const foot = h('div', { class: `band-foot${present ? ' compact' : ''}` }, h('div', { class: 'carrier-row' }, pauseBtn, rate), note, present ? null : caption);
  host.append(foot);
  const moreEl = present ? h('div', { class: 'live-caption more-caption', 'aria-live': 'polite' }) : null;

  // ---- carriers
  let parts = [];
  let creditS = 0;
  let creditM = 0;
  let paused = reduced;
  let visible = false;
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let data = null; // { p, res, opts }
  const T_CROSS = present ? 12 : 8; // seconds to cross the drawn semiconductor
  const T_METAL = present ? 4 : 3;
  const R_SEMI = present ? 0.9 : 1.3; // carriers per second entering from the bulk
  const rnd = () => Math.random();
  const expo = (kT) => -kT * Math.log(1 - rnd());

  function physics() {
    const { p, res } = data;
    const kTd = KT_DISPLAY_300 * (p.T / 300);
    const Vbi = Math.max(res.Vbi, 0);
    const W = res.W;
    const xMax = W > 0 ? 1.4 * W : 100e-9;
    const b = (x) => (W > 0 && x < W ? Vbi * (1 - x / W) ** 2 : 0);
    return { kTd, Vbi, xMax, b, rM: R_SEMI * Math.exp(-Vbi / kTd) };
  }

  function step(dt) {
    const ph = physics();
    const v = ph.xMax / T_CROSS;
    creditS += R_SEMI * dt;
    creditM += ph.rM * dt;
    while (creditS >= 1) {
      creditS -= 1;
      parts.push({ side: 's', x: ph.xMax, dir: -1, eps: expo(ph.kTd) });
    }
    while (creditM >= 1) {
      creditM -= 1;
      parts.push({ side: 'm', f: 1, dir: -1, eps: ph.Vbi + expo(ph.kTd), fromMetal: true });
    }
    for (const c of parts) {
      if (c.side === 's') {
        const nx = c.x + c.dir * v * dt;
        if (c.dir < 0 && ph.b(Math.max(nx, 0)) > c.eps) c.dir = 1; // energy below the band edge: turn back
        else if (nx <= 0) {
          c.side = 'm'; // over the barrier top: into the metal
          c.f = 0;
          c.dir = 1;
        } else c.x = nx;
        if (c.side === 's' && c.x > ph.xMax) c.dead = true;
      } else {
        c.f += (c.dir * dt) / T_METAL;
        if (c.dir > 0 && c.f >= 1) c.dead = true;
        if (c.dir < 0 && c.f <= 0) {
          c.side = 's'; // metal carrier above the barrier: into the semiconductor
          c.x = 0;
          c.dir = 1;
        }
      }
    }
    parts = parts.filter((c) => !c.dead && c.eps < 3);
  }

  function overlay(gm) {
    const pType = gm.doping === 'p';
    const r = present ? 6 : 4.5;
    let s = '';
    for (const c of parts) {
      const E = pType ? gm.EvBulk - c.eps : gm.EcBulk + c.eps;
      const Y = gm.y(E);
      if (Y < gm.box.t || Y > gm.box.b) continue;
      let X;
      if (c.side === 's') {
        if (c.x > gm.prof.xMax) continue;
        X = gm.xs(c.x);
      } else X = gm.x0 - c.f * (gm.x0 - gm.box.l - 4);
      s += pType
        ? circle(X, Y, r, { fill: 'var(--surface)', stroke: 'var(--c-pos)', 'stroke-width': present ? 3 : 2.5 })
        : circle(X, Y, r, { fill: 'var(--c-neg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    }
    return s;
  }

  function draw() {
    if (!data) return;
    const carriers = !data.opts?.anim;
    band.update({ ...data, opts: { ...(data.opts || {}), overlay: carriers ? overlay : null } });
  }

  function loop(now) {
    raf = 0;
    if (!visible || paused) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (data && !data.opts?.anim) step(dt);
    if (now - lastDraw > 33) {
      lastDraw = now;
      draw();
    }
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf || paused || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function setPaused(v) {
    paused = v;
    pauseBtn.textContent = v ? 'Resume carrier motion' : 'Pause carrier motion';
    pauseBtn.setAttribute('aria-pressed', String(v));
    if (!v) start();
  }
  setPaused(paused);

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) visible = en.isIntersecting;
    if (visible) start();
  });
  io.observe(band.el);

  // ---- captions (at most every 300 ms)
  let capTimer = 0;
  let capLast = 0;
  function writeCaption() {
    capTimer = 0;
    capLast = performance.now();
    if (!data) return;
    const c = captionSentences(data.p, data.res);
    // the equilibrium remark belongs to the carrier animation, so it ends the full caption
    const full = `${fullCaption(c)} ${EQUILIBRIUM}`;
    if (present) {
      ctx.caption?.setLiveIdle?.(c.pinning); // Outline mode: sentence 2 only
      if (moreEl) moreEl.innerHTML = full;
    } else caption.innerHTML = full;
    const real = crossingRate(data.res, data.p.T);
    rate.innerHTML = `real relative crossing rate ∝ exp(−V<sub>bi</sub>/kT) = ${sci(real, 2, { dropOne: false, compact: true })}`;
    const factor = (KT_DISPLAY_300 * (data.p.T / 300)) / thermalVoltage(data.p.T);
    note.textContent = `carrier energies exaggerated (×${num(factor, 1)}) so crossings are visible; the real crossing rate is in the readout.`;
  }
  function scheduleCaption() {
    if (capTimer) return;
    const wait = Math.max(0, CAPTION_MS - (performance.now() - capLast));
    capTimer = setTimeout(writeCaption, wait);
  }

  let warmed = false;
  return {
    el: band.el,
    moreEl,
    update(d) {
      data = d;
      if (!warmed && !d.opts?.anim) {
        // start with carriers already in place (also what a paused / reduced-motion view shows)
        warmed = true;
        for (let i = 0; i < 160; i++) step(0.1);
      }
      draw();
      scheduleCaption();
      start();
    },
    destroy() {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
