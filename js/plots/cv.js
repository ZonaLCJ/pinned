// Virtual C–V lab: simulated 1/C'^2 vs V_R with ±1 % noise, a draggable straight line
// (two handles) and its voltage-axis intercept (= −V_bi).
import { createPlot, lin, line, circle, rect, text, axes, tickWidth, niceStep } from './svg.js';
import { num } from '../ui/format.js';

const XR = [-1.5, 4.2];
const HX = [0.4, 3.6]; // handle positions (V_R)

/**
 * data = { points: [{ VR, y }], line: { slope, intercept } | null, yMax, scale (display divisor), unitLabel, onDrag(line) }
 */
export function drawCV(ctx, d) {
  const { w, h, st } = ctx;
  const tw = tickWidth(['10.0'], st);
  const box = { l: tw + st.label + 22, r: w - 14, t: 10, b: h - (st.tick + st.label + 26) };
  const x = lin(XR[0], XR[1], box.l, box.r);
  const y = lin(0, d.yMax, box.b, box.t);
  ctx.scales = { x, y, box };
  const sc = d.scale;
  const step = niceStep(d.yMax / sc, 5);
  const yTicks = [];
  for (let v = 0; v <= d.yMax / sc + 1e-9; v += step) yTicks.push(v * sc);
  let s = '';
  s += rect(box.l, box.t, x(0) - box.l, box.b - box.t, { fill: 'var(--brand-tint)', opacity: 0.6 });
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--text-muted)', 'stroke-width': 1.5 });
  if (w > 520) s += text(box.r - 6, box.b - st.label * 0.7, 'simulated data (±1 %)', { anchor: 'end', cls: 'muted strong' });
  if (d.line) {
    const L = d.line;
    const xi = -L.intercept / L.slope; // voltage-axis intercept
    const xa = Math.max(XR[0], Math.min(xi, 0));
    s += line(x(xa), y(L.slope * xa + L.intercept), x(XR[1]), y(L.slope * XR[1] + L.intercept), { stroke: 'var(--brand-ink)', 'stroke-width': st.line });
    if (xi > XR[0] && xi < XR[1]) {
      s += circle(x(xi), y(0), st.line + 5, { fill: 'var(--c-e0)', stroke: 'var(--surface)', 'stroke-width': 2 });
      s += text(box.l + 8, box.t + st.label * 0.8, `intercept: −V_{bi} = ${num(xi, 2)} V`, { cls: 'e0-ink strong halo' });
    }
    if (d.onDrag) {
      for (let k = 0; k < 2; k++) {
        const hx = HX[k];
        const hy = L.slope * hx + L.intercept;
        s += circle(x(hx), y(hy), 16, { fill: 'var(--surface)', stroke: 'var(--brand-ink)', 'stroke-width': 3, 'data-h': k, style: 'cursor:ns-resize' });
        s += circle(x(hx), y(hy), 5, { fill: 'var(--brand-ink)', 'data-h': k, style: 'cursor:ns-resize' });
      }
    }
  }
  for (const p of d.points) s += circle(x(p.VR), y(p.y), st.line + 2.5, { fill: 'var(--text)' });
  s += axes({
    x,
    y,
    st,
    box,
    xTicks: [-1, 0, 1, 2, 3, 4],
    yTicks,
    yFmt: (v) => (v / sc).toFixed(step < 1 ? 1 : 0),
    yTickW: tw,
    xTitle: 'reverse bias V_{R} (V)',
    yTitle: `1/C′² (${d.unitLabel})`,
  });
  return s;
}

export function createCVPlot(host) {
  let api = null;
  let drag = null;
  api = createPlot(host, drawCV, {
    className: 'cv',
    label: 'Simulated 1/C squared versus reverse bias',
    onEvents(svg, ctx) {
      svg.style.touchAction = 'none';
      svg.addEventListener('pointerdown', (e) => {
        const t = e.target.closest('[data-h]');
        if (!t || !api._data?.line) return;
        drag = Number(t.getAttribute('data-h'));
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      svg.addEventListener('pointermove', (e) => {
        if (drag == null || !ctx.scales) return;
        const r = svg.getBoundingClientRect();
        const py = e.clientY - r.top;
        const yv = Math.max(0, ctx.scales.y.inv(py));
        const L = api._data.line;
        const ys = HX.map((hx) => L.slope * hx + L.intercept);
        ys[drag] = yv;
        const slope = (ys[1] - ys[0]) / (HX[1] - HX[0]);
        const line2 = { slope, intercept: ys[0] - slope * HX[0] };
        api._data.onDrag?.(line2);
      });
      const end = () => (drag = null);
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
    },
  });
  const upd = api.update;
  api.update = (d) => {
    api._data = d;
    upd(d);
  };
  return api;
}
