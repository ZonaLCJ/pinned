// I–V thumbnail: J = J_s (exp(qV/kT) − 1), V from −0.3 to +0.3 V, fixed linear scale.
import { diodeCurrent, rangeArray } from '../engine.js';
import { createPlot, lin, path, line, text, axes, tickWidth } from './svg.js';

export const IV_JMAX = 10; // A/cm², fixed display scale

export function drawIV(ctx, { phiBn, T, Astar }) {
  const { w, h, st } = ctx;
  const tw = tickWidth(['−10'], st);
  const box = { l: tw + st.label + 24, r: w - 10, t: 8, b: h - (st.tick + st.label + 22) };
  const x = lin(-0.3, 0.3, box.l, box.r);
  const y = lin(-IV_JMAX, IV_JMAX, box.b, box.t);
  const Vs = rangeArray(-0.3, 0.3, 241);
  const pts = Vs.map((V) => {
    const J = diodeCurrent(phiBn, T, Astar, V);
    return [x(V), y(Math.max(-IV_JMAX * 1.08, Math.min(IV_JMAX * 1.08, J)))];
  });
  let s = `<clipPath id="${ctx.uid}-c"><rect x="${box.l}" y="${box.t}" width="${box.r - box.l}" height="${box.b - box.t}"/></clipPath>`;
  s += line(box.l, y(0), box.r, y(0), { stroke: 'var(--border)', 'stroke-width': 1.5 });
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--border)', 'stroke-width': 1.5 });
  s += `<g clip-path="url(#${ctx.uid}-c)">${path(pts, { stroke: 'var(--brand-ink)', 'stroke-width': st.line + 0.5 })}</g>`;
  s += axes({
    x,
    y,
    st,
    box,
    grid: false,
    xTicks: [-0.3, 0, 0.3],
    yTicks: [-IV_JMAX, 0, IV_JMAX],
    yFmt: (v) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v)}`),
    yTickW: tw,
    xTitle: 'V (V)',
    yTitle: 'J (A/cm²)',
  });
  return s;
}

export const createIVPlot = (host) => createPlot(host, drawIV, { className: 'iv', label: 'Thermionic I–V thumbnail on a fixed linear scale' });
