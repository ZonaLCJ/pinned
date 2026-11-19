// MIGS panel: |psi|^2 of a metal state at a gap energy. Propagating in the metal,
// evanescent in the semiconductor: |psi|^2 ∝ exp(-2x / 0.5 nm) (course tunnelling slide).
import { createPlot, lin, path, line, rect, text, axes, tickWidth, textWidth } from './svg.js';

// Measured text width in the page font (falls back to the estimate without a canvas).
let measureCtx = null;
function measure(str, size) {
  const plain = String(str).replace(/[_^]\{([^}]*)\}/g, '$1').replace(/[_^](.)/g, '$1');
  try {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    const fam = getComputedStyle(document.body).fontFamily || 'sans-serif';
    measureCtx.font = `600 ${size}px ${fam}`;
    return measureCtx.measureText(plain).width;
  } catch {
    return textWidth(str, size) * 1.1;
  }
}

/**
 * Place region labels in up to two rows above the curve without overlaps.
 * Each label: { text | alts: [long, short], x, anchor: 'start'|'end', cls }. A start-anchored
 * label uses the first alternative that ends inside the plot. Returns markup.
 */
function labelRows(labels, box, st) {
  const rows = [[], []];
  const pad = 14;
  const rowStep = 1.45;
  let s = '';
  for (const lb of labels) {
    const alts = lb.alts || [lb.text];
    let txt = alts[alts.length - 1];
    if (lb.anchor !== 'end') txt = alts.find((t) => lb.x + measure(t, st.label) <= box.r - 4) || txt;
    const wdt = measure(txt, st.label);
    const x0 = lb.anchor === 'end' ? lb.x - wdt : lb.x;
    const span = [x0 - pad / 2, x0 + wdt + pad / 2];
    let r = rows.findIndex((row) => row.every(([a, b]) => span[1] <= a || span[0] >= b));
    if (r < 0) r = rows.length - 1;
    rows[r].push(span);
    s += text(lb.x, box.t + st.label * (0.7 + rowStep * r), txt, { anchor: lb.anchor, cls: `${lb.cls} halo` });
  }
  return s;
}

export function drawMigs(ctx, { decayNm }) {
  const { w, h, st } = ctx;
  const X0 = -1.0;
  const X1 = 2.0;
  const tw = tickWidth(['1.0'], st);
  const box = { l: tw + st.label + 22, r: w - 12, t: 10, b: h - (st.tick + st.label + 26) };
  const x = lin(X0, X1, box.l, box.r);
  const y = lin(0, 1.35, box.b, box.t); // headroom above |psi|^2 = 1 for two rows of labels
  const L = decayNm;
  const xEdge = (L / 2) * Math.log(100); // where |psi|^2 has fallen to 1 %
  let s = '';
  s += rect(box.l, box.t, x(0) - box.l, box.b - box.t, { fill: 'var(--c-metal)', opacity: 0.55 });
  s += rect(x(0), box.t, x(xEdge) - x(0), box.b - box.t, { fill: 'var(--brand-tint)' });
  s += labelRows(
    [
      { text: 'metal', x: box.l + 8, anchor: 'start', cls: 'strong' },
      { alts: ['gap states live here', 'gap states'], x: x(0) + 6, anchor: 'start', cls: 'ink strong' },
      { text: 'semiconductor', x: box.r - 4, anchor: 'end', cls: 'strong' },
    ],
    box,
    st,
  );

  const N = 240;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const xv = X0 + ((X1 - X0) * i) / N;
    const v = xv < 0 ? 0.6 + 0.4 * Math.cos((2 * Math.PI * xv) / 0.3) : Math.exp((-2 * xv) / L);
    pts.push([x(xv), y(v)]);
  }
  s += `<path d="M${pts.map((p) => p.join(',')).join('L')}L${box.r},${box.b}L${box.l},${box.b}Z" fill="var(--brand)" opacity="0.22"/>`;
  s += path(pts, { stroke: 'var(--brand-ink)', 'stroke-width': st.line });
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--text)', 'stroke-width': 2 });
  // 1/e^2 marker at x = L
  s += line(x(L), y(Math.exp(-2)), x(L), box.b, { stroke: 'var(--text-muted)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
  // decay-law labels: right of the 1/e^2 marker, pulled left if they would leave the plot
  const f1 = `|ψ|^{2} ∝ e^{−2x/${L} nm}`;
  const f2 = `(ψ ∝ e^{−x/${L} nm})`;
  const fw = Math.max(measure(f1, st.label), measure(f2, st.label));
  const fits = x(L) + 8 + fw <= box.r - 4;
  const fx = fits ? x(L) + 8 : box.r - 4;
  const fa = fits ? 'start' : 'end';
  s += text(fx, y(0.5), f1, { anchor: fa, cls: 'strong halo' });
  s += text(fx, y(0.5) + st.label * 1.75, f2, { anchor: fa, cls: 'muted halo' });
  s += axes({
    x,
    y,
    st,
    box,
    xTicks: [-1, 0, 1, 2],
    yTicks: [0, 0.5, 1],
    yTickW: tw,
    grid: false,
    xTitle: 'x (nm) from the interface',
    yTitle: '|ψ|² (norm.)',
  });
  return s;
}

export const createMigsPlot = (host) => createPlot(host, drawMigs, { className: 'migs', label: 'Metal-induced gap state wavefunction decaying into the semiconductor' });
