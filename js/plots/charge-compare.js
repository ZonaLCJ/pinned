// Section 1 key insight: |Q_ss| = D_it |E_F - E0| versus the whole depletion charge Q_sc,
// on a log scale. Q_sc uses the band bending that matches each E_F - E0:
// phiBn = E_g - phi0 - (E_F - E0).
import { depletionCharge, cPerM2ToEPerCm2, bulkFermi, barrierForOffset } from '../engine.js';
import { createPlot, lin, logScale, path, line, circle, text, axes, logTicks, fmtTick, tickWidth, textWidth } from './svg.js';
import { pow10, sci } from '../ui/format.js';

const X0 = -0.5;
const X1 = 0.5;
const Y0 = 1e10;
const Y1 = 1e15;

export function drawChargeCompare(ctx, { p, res, refs = [1e12, 1e13, 1e14], showCurrent = true }) {
  const { w, h, st } = ctx;
  const yTicks = logTicks([Y0, Y1]);
  const tw = tickWidth(yTicks.map((v) => `10${Math.log10(v)}`), st);
  const box = { l: tw + st.label + 22, r: w - 12, t: 10, b: h - (st.tick + st.label + 26) };
  const x = lin(X0, X1, box.l, box.r);
  const y = logScale(Y0, Y1, box.b, box.t);
  const N = 121;
  const xs = Array.from({ length: N }, (_, i) => X0 + ((X1 - X0) * i) / (N - 1));
  const clipY = (v) => (v >= Y0 ? Math.max(y(Math.min(v, Y1 * 1.2)), box.t - 2) : null);
  let s = '';

  // zero line
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--c-e0)', 'stroke-width': 2, 'stroke-dasharray': '8 3 2 3' });

  // reference D_it curves (thin, grey) with labels
  for (const D of refs) {
    const pts = xs.map((v) => {
      const yy = clipY(D * Math.abs(v));
      return yy == null ? null : [x(v), yy];
    });
    s += path(pts, { stroke: '#a7abc6', 'stroke-width': 2 });
    const yl = y(D * 0.5);
    s += text(x(0.5) - 4, yl - st.tick * 0.7, `10^{${Math.round(Math.log10(D))}}`, { anchor: 'end', cls: 'tick halo' });
  }

  // depletion charge for the matching band bending
  // depletion charge for the band bending that matches each E_F - E0 (n- or p-type)
  const phiBulk = bulkFermi(p).phiBulk;
  const qsc = xs.map((v) => cPerM2ToEPerCm2(depletionCharge(p, barrierForOffset(p, v), phiBulk)));
  s += path(
    xs.map((v, i) => (qsc[i] >= Y0 ? [x(v), y(qsc[i])] : null)),
    { stroke: 'var(--text)', 'stroke-width': st.line, 'stroke-dasharray': `${st.line * 4} ${st.line * 1.5}` },
  );
  const lblQ = w > 460 ? 'Q_{sc}: whole depletion region' : 'Q_{sc} (depletion)';
  s += text(box.l + 8, Math.min(box.b - st.label * 0.6, y(qsc[8]) + st.label * 0.95), lblQ, { cls: 'strong halo' });

  // current D_it curve: red (positive) left of E0, teal (negative) right of E0
  if (showCurrent && p.Dit > 0 && !res.ideal) {
    const left = xs.filter((v) => v <= 0).map((v) => [x(v), clipY(p.Dit * Math.abs(v))]);
    const right = xs.filter((v) => v >= 0).map((v) => [x(v), clipY(p.Dit * Math.abs(v))]);
    s += path(left.map((q) => (q[1] == null ? null : q)), { stroke: 'var(--c-pos)', 'stroke-width': st.line + 1.5 });
    s += path(right.map((q) => (q[1] == null ? null : q)), { stroke: 'var(--c-neg)', 'stroke-width': st.line + 1.5 });
    s += text(box.l + 6, box.t + st.label * 0.6, 'Q_{ss} > 0', { cls: 'pos-ink strong halo' });
    s += text(box.r - 4, box.t + st.label * 0.6, 'Q_{ss} < 0', { anchor: 'end', cls: 'neg-ink strong halo' });

    // current operating point
    const v = Math.max(X0, Math.min(X1, res.EFmE0));
    const q = Math.abs(res.QssCm);
    if (q >= Y0) s += circle(x(v), y(Math.min(q, Y1)), st.line + 4, { fill: res.EFmE0 < 0 ? 'var(--c-pos)' : 'var(--c-neg)', stroke: 'var(--surface)', 'stroke-width': 2 });
    if (Math.abs(res.QscCm) >= Y0) s += circle(x(v), y(Math.abs(res.QscCm)), st.line + 3, { fill: 'var(--text)', stroke: 'var(--surface)', 'stroke-width': 2 });
    s += line(x(v), box.b, x(v), box.t, { stroke: 'var(--brand-ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
  }

  s += axes({
    x,
    y,
    st,
    box,
    xTicks: w > 460 ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.4, 0, 0.4],
    yTicks,
    yFmt: (v) => fmtTick(v, yTicks),
    yTickW: tw,
    xTitle: 'E_{F} − E_{0} at the interface (eV)',
    yTitle: '|charge| (e/cm²)',
    xFmt: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1).replace('-', '−')),
  });
  return s;
}

export const createChargeComparePlot = (host) =>
  createPlot(host, drawChargeCompare, { className: 'charge-compare', label: 'Interface charge versus depletion charge, log scale' });
