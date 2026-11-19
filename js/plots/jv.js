// Section 3: log-scale J–V for three barriers — S = 1 (Schottky–Mott), S = 0 (Bardeen limit)
// and the current D_it. J = A* T² exp(−φB/kT) (exp(qV/kT) − 1), ideality n = 1.
// Series resistance and image-force lowering are ignored.
import { diodeCurrent, rangeArray } from '../engine.js';
import { createPlot, lin, logScale, path, line, rect, text, axes, tickWidth, textWidth } from './svg.js';

const V0 = 0;
const V1 = 0.6;
const J0 = 1e-16;
const J1 = 1e4;
export const JV_STYLES = {
  s1: { color: 'var(--text)', dash: '9 6' },
  cur: { color: 'var(--brand-ink)', dash: null },
  s0: { color: 'var(--c-e0)', dash: '1 6' },
};

/** data = { T, Astar, curves: [{ key: 's1'|'cur'|'s0', phiB, label }] } */
export function drawJV(ctx, { T, Astar, curves }) {
  const { w, h, st } = ctx;
  const yt = [1e-16, 1e-12, 1e-8, 1e-4, 1, 1e4];
  const tw = tickWidth(yt.map((v) => `10${Math.round(Math.log10(v))}`), st);
  const box = { l: tw + st.label + 22, r: w - 14, t: 14, b: h - (st.tick + st.label + 26) };
  const x = lin(V0, V1, box.l, box.r);
  const y = logScale(J0, J1, box.b, box.t);
  const ly = (lj) => box.b - ((lj - Math.log10(J0)) / (Math.log10(J1) - Math.log10(J0))) * (box.b - box.t);
  const Vs = rangeArray(V0, V1, 241);
  const cid = `${ctx.uid}-clip`;
  let s = `<clipPath id="${cid}"><rect x="${box.l}" y="${box.t - 2}" width="${box.r - box.l}" height="${box.b - box.t + 2}"/></clipPath>`;
  let curvesSvg = '';
  let arrows = '';
  const drawn = []; // screen points of every curve, to keep the legend off them
  for (const c of curves) {
    const sty = JV_STYLES[c.key];
    const sw = c.key === 'cur' ? st.line + 1 : st.line;
    const pts = [];
    let prev = null;
    for (const V of Vs) {
      const J = diodeCurrent(c.phiB, T, Astar, V);
      // below the range (or J = 0 at V = 0): draw under the axis and let the clip cut it
      const lj = J > 0 ? Math.log10(J) : Math.log10(J0) - 4;
      if (lj > Math.log10(J1)) {
        // leaves the plotted range: stop at the top edge and end the curve with an arrow
        const f = prev ? (Math.log10(J1) - prev.lj) / (lj - prev.lj) : 0;
        const xe = prev ? prev.x + (x(V) - prev.x) * f : x(V);
        pts.push([xe, box.t]);
        const a = 8 + st.line;
        // arrow head pointing along the curve (up and slightly right)
        const dx = prev ? x(V) - prev.x : 0;
        const dy = prev ? -(box.t - ly(prev.lj)) : 1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = -Math.abs(dy) / len;
        const px = -uy;
        const py = ux;
        arrows += `<path d="M${xe - ux * a + px * a * 0.6},${box.t - uy * a + py * a * 0.6}L${xe},${box.t}L${xe - ux * a - px * a * 0.6},${box.t - uy * a - py * a * 0.6}" fill="none" stroke="${sty.color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
        break;
      }
      const px = x(V);
      pts.push([px, Math.max(ly(lj), box.t)]);
      prev = { x: px, lj };
    }
    drawn.push(pts);
    if (!pts.some((q) => q[1] < box.b)) {
      // the whole curve lies below 10^-16 A/cm²: a short arrow pointing down at the bottom edge
      const xa = box.r - 24 - 22 * curves.indexOf(c);
      const a = 8 + st.line;
      arrows += `<path d="M${xa},${box.b - 4 - 2 * a}L${xa},${box.b - 4}M${xa - a * 0.6},${box.b - 4 - a}L${xa},${box.b - 4}L${xa + a * 0.6},${box.b - 4 - a}" fill="none" stroke="${sty.color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
      c.below = true;
    }
    curvesSvg += path(pts, { stroke: sty.color, 'stroke-width': sw, 'stroke-dasharray': sty.dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  }
  s += `<g clip-path="url(#${cid})">${curvesSvg}</g>${arrows}`;
  // legend in whichever corner the curves cross least
  const fs = st.tick;
  const labels = curves.map((c) => (c.below ? `${c.label} (below scale)` : c.label));
  const labW = Math.max(...labels.map((l) => textWidth(l, fs)));
  const sample = 34;
  const rowH = fs * 1.45;
  const lw = sample + 10 + labW + 16;
  const lh = rowH * curves.length + 10;
  const corners = [
    [box.r - lw - 6, box.b - lh - 6],
    [box.l + 12, box.t + 4],
    [box.l + 12, box.b - lh - 6],
    [box.r - lw - 6, box.t + 4],
  ];
  const hits = ([cx, cy]) => {
    let n = 0;
    for (const pts of drawn)
      for (let i = 1; i < pts.length; i++)
        for (let k = 0; k <= 8; k++) {
          const px = pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 8;
          const py = pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 8;
          if (px >= cx - 4 && px <= cx + lw + 4 && py >= cy - 4 && py <= cy + lh + 4) n++;
        }
    return n;
  };
  const [lx, ly0] = corners.map((c) => [c, hits(c)]).reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  s += rect(lx, ly0, lw, lh, { fill: 'var(--surface)', stroke: 'var(--border)', 'stroke-width': 1.5, rx: 6 });
  curves.forEach((c, i) => {
    const sty = JV_STYLES[c.key];
    const yy = ly0 + 5 + rowH * (i + 0.5);
    s += line(lx + 8, yy, lx + 8 + sample, yy, { stroke: sty.color, 'stroke-width': c.key === 'cur' ? st.line + 1 : st.line, 'stroke-dasharray': sty.dash, 'stroke-linecap': 'round' });
    s += text(lx + sample + 16, yy, labels[i], { cls: c.key === 'cur' ? 'tick ink' : 'tick' });
  });
  s += axes({
    x,
    y,
    st,
    box,
    xTicks: w > 420 ? [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] : [0, 0.2, 0.4, 0.6],
    xFmt: (v) => v.toFixed(1),
    yTicks: yt,
    yFmt: (v) => `10^{${Math.round(Math.log10(v))}}`,
    yTickW: tw,
    xTitle: 'forward bias V (V)',
    yTitle: 'J (A/cm²)',
  });
  return s;
}

export const createJVPlot = (host) => createPlot(host, drawJV, { className: 'jv', label: 'Log-scale current density versus forward bias for three barriers' });
