// Toy model: contact resistivity vs interlayer thickness t (log y), with the
// "barrier only" curve (no tunnelling penalty) to show where the U comes from.
import { contactResistivity, optimumThickness, rangeArray } from '../engine.js';
import { createPlot, lin, logScale, path, line, circle, text, axes, logTicks, fmtTick, tickWidth } from './svg.js';
import { num, sci } from '../ui/format.js';

const memo = new Map();
function curves(p, lambda, kappa) {
  const key = [p.semi, p.phiM, p.Dit, p.phi0, p.delta, p.Nd, p.T, lambda, kappa].join('|');
  if (memo.has(key)) return memo.get(key);
  const ts = rangeArray(0, 3, 61);
  const full = [];
  const bare = [];
  for (const t of ts) {
    const c = contactResistivity(p, { t, lambda, kappa });
    full.push(c.rhoC);
    bare.push(c.prefactor * c.barrierFactor);
  }
  const opt = optimumThickness(p, { lambda, kappa });
  const out = { ts, full, bare, opt };
  if (memo.size > 300) memo.clear();
  memo.set(key, out);
  return out;
}

export function drawRhoC(ctx, { p, t, lambda, kappa, target }) {
  const { w, h, st } = ctx;
  const c = curves(p, lambda, kappa);
  const all = [...c.full, ...c.bare, target || c.full[0]];
  let e0 = Math.floor(Math.log10(Math.min(...all)) - 0.2);
  let e1 = Math.ceil(Math.log10(Math.max(...c.full)) + 0.2);
  if (e1 - e0 < 3) e1 = e0 + 3;
  const Y0 = 10 ** e0;
  const Y1 = 10 ** e1;
  let yt = logTicks([Y0, Y1]);
  if (yt.length > 7) yt = yt.filter((_, i) => i % 2 === (yt.length % 2 ? 0 : 1));
  const tw = tickWidth(yt.map((v) => `10${Math.round(Math.log10(v))}`), st);
  const box = { l: tw + st.label + 22, r: w - 14, t: 10, b: h - (st.tick + st.label + 26) };
  const x = lin(0, 3, box.l, box.r);
  const y = logScale(Y0, Y1, box.b, box.t);
  let s = '';
  if (target) {
    s += line(box.l, y(target), box.r, y(target), { stroke: 'var(--brand-ink)', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
  }
  s += path(c.ts.map((tt, i) => [x(tt), y(c.bare[i])]), { stroke: '#a7abc6', 'stroke-width': 2.5, 'stroke-dasharray': '7 5' });
  s += path(c.ts.map((tt, i) => [x(tt), y(c.full[i])]), { stroke: 'var(--brand-ink)', 'stroke-width': st.line + 0.5 });
  // optimum
  const o = c.opt;
  s += line(x(o.t), y(o.rhoC), x(o.t), box.b, { stroke: 'var(--c-e0)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
  s += circle(x(o.t), y(o.rhoC), st.line + 4, { fill: 'var(--surface)', stroke: 'var(--c-e0)', 'stroke-width': 3 });
  s += text(x(o.t), y(o.rhoC) + st.label * 1.15, `optimum t = ${num(o.t, 2)} nm`, { anchor: o.t > 2 ? 'end' : 'start', cls: 'e0-ink strong halo' });
  // current t
  const cur = contactResistivity(p, { t, lambda, kappa });
  s += circle(x(t), y(cur.rhoC), st.line + 5, { fill: 'var(--brand-ink)', stroke: 'var(--surface)', 'stroke-width': 2.5 });
  s += axes({
    x,
    y,
    st,
    box,
    xTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
    xFmt: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
    yTicks: yt,
    yFmt: (v) => `10^{${Math.round(Math.log10(v))}}`,
    yTickW: tw,
    xTitle: 'interlayer thickness t (nm)',
    yTitle: 'ρ_{c} (Ω·cm²)',
  });
  return s;
}

export const createRhoCPlot = (host) => createPlot(host, drawRhoC, { className: 'rhoc', label: 'Contact resistivity versus interlayer thickness' });
export { curves as rhoCurves };
