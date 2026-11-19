// Signed charge bars Q_m, Q_ss, Q_sc (e/cm²) and their sum (= 0 when balanced).
import { createPlot, lin, rect, line, text, textWidth, niceStep } from './svg.js';
import { sci } from '../ui/format.js';

export function drawChargeBars(ctx, { res }) {
  const { w, h, st } = ctx;
  const rows = [
    { key: 'Q_{m}', v: res.QmCm, who: 'metal' },
    { key: 'Q_{ss}', v: res.QssCm, who: 'interface states' },
    { key: 'Q_{sc}', v: res.QscCm, who: 'depletion region' },
  ];
  const sum = res.QmCm + res.QssCm + res.QscCm;
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.v)), 1e9);
  const step = niceStep(maxAbs, 1);
  const lim = Math.ceil(maxAbs / step) * step;
  const labW = textWidth('Q_{ss}', st.label) + 14;
  const valW = textWidth('−3.5 × 10¹²', st.tick) + 12;
  const box = { l: labW, r: w - valW, t: 4, b: h - 4 };
  const x = lin(-lim, lim, box.l, box.r);
  const n = rows.length + 1;
  const rh = (box.b - box.t) / n;
  let s = '';
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--text-muted)', 'stroke-width': 1.5 });
  rows.forEach((r, i) => {
    const cy = box.t + rh * (i + 0.5);
    const bh = Math.min(rh * 0.62, 40);
    const color = r.v > 0 ? 'var(--c-pos)' : 'var(--c-neg)';
    if (Math.abs(r.v) > 0) s += rect(x(0), cy - bh / 2, x(r.v) - x(0), bh, { fill: color, rx: 3 });
    s += text(4, cy, r.key, { cls: 'strong' });
    s += text(w - 4, cy, `${r.v > 0 ? '+' : ''}${sci(r.v, 2)}`, { anchor: 'end', cls: `tick ${r.v > 0 ? 'pos-ink' : r.v < 0 ? 'neg-ink' : ''}` });
  });
  const cy = box.t + rh * (rows.length + 0.5);
  const balanced = Math.abs(sum) <= 1e-6 * maxAbs;
  s += line(box.l, cy - rh / 2 + 2, box.r, cy - rh / 2 + 2, { stroke: 'var(--border)', 'stroke-width': 1.5 });
  s += text(4, cy, 'Σ', { cls: 'strong' });
  s += text(x(0) + 8, cy, balanced ? 'sum = 0: neutral' : `sum = ${sci(sum, 2)} (unbalanced: model limit)`, { cls: balanced ? 'ink strong' : 'pos-ink strong' });
  return s;
}

export const createChargeBarsPlot = (host) => createPlot(host, drawChargeBars, { className: 'charge-bars', label: 'Signed charge bars' });
