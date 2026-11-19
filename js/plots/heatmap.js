// Generic heatmap: grid rendered once to a small canvas (as an <image>), contours by
// marching squares, markers on top. Grids are precomputed by the caller and cached.
import { createPlot, lin, logScale, line, circle, rect, text, axes, tickWidth, textWidth, BRAND_RAMP, logTicks, fmtTick } from './svg.js';

const imgCache = new WeakMap();

function gridImage(grid, vmin, vmax, colorFn) {
  const key = `${vmin}|${vmax}`;
  const c = imgCache.get(grid);
  if (c && c.key === key) return c.url;
  const cv = document.createElement('canvas');
  cv.width = grid.nx;
  cv.height = grid.ny;
  const g2 = cv.getContext('2d');
  const img = g2.createImageData(grid.nx, grid.ny);
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      const v = grid.values[j * grid.nx + i];
      const [r, g, b] = (colorFn || BRAND_RAMP)((v - vmin) / (vmax - vmin));
      const o = ((grid.ny - 1 - j) * grid.nx + i) * 4; // row 0 = bottom
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  g2.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  imgCache.set(grid, { key, url });
  return url;
}

/** Marching squares: segments [[x1,y1,x2,y2], ...] in grid index space. */
export function contourSegments(grid, level) {
  const { nx, ny, values } = grid;
  const segs = [];
  const v = (i, j) => values[j * nx + i];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const pB = [i + lerp(a, b), j]; // bottom edge
      const pR = [i + 1, j + lerp(b, c)];
      const pT = [i + lerp(d, c), j + 1];
      const pL = [i, j + lerp(a, d)];
      const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (idx) {
        case 1: case 14: add(pL, pB); break;
        case 2: case 13: add(pB, pR); break;
        case 3: case 12: add(pL, pR); break;
        case 4: case 11: add(pR, pT); break;
        case 5: add(pL, pT); add(pB, pR); break;
        case 6: case 9: add(pB, pT); break;
        case 7: case 8: add(pL, pT); break;
        case 10: add(pL, pB); add(pR, pT); break;
        default: break;
      }
    }
  }
  return segs;
}

/**
 * data = { grid, xLog, yLog, vmin, vmax, levels, labelLevels, fmtLevel, highlight,
 *          markers: [{ x, y, label, kind }], vlines: [{ x, label }], xTitle, yTitle, legendTitle, legendFmt }
 */
export function drawHeatmap(ctx, d) {
  const { w, h, st } = ctx;
  const g = d.grid;
  const yTickVals = d.yLog ? logTicks([g.ys[0], g.ys[g.ny - 1]]) : null;
  const tw = tickWidth(d.yLog ? yTickVals.map((v) => `10${Math.round(Math.log10(v))}`) : ['0.0'], st);
  const legendW = 16 + textWidth('−10', st.tick) + 14;
  const box = { l: tw + st.label + 22, r: w - legendW - 10, t: 16, b: h - (st.tick + st.label + 26) };
  const x = (d.xLog ? logScale : lin)(g.xs[0], g.xs[g.nx - 1], box.l, box.r);
  const y = (d.yLog ? logScale : lin)(g.ys[0], g.ys[g.ny - 1], box.b, box.t);
  const url = gridImage(g, d.vmin, d.vmax, d.colorFn);
  // pixel position of a fractional grid index
  const gx = (fi) => box.l + (fi / (g.nx - 1)) * (box.r - box.l);
  const gy = (fj) => box.b - (fj / (g.ny - 1)) * (box.b - box.t);
  let s = `<image href="${url}" x="${box.l}" y="${box.t}" width="${box.r - box.l}" height="${box.b - box.t}" preserveAspectRatio="none" style="image-rendering:auto"/>`;
  for (const lv of d.levels || []) {
    const segs = contourSegments(g, lv);
    if (!segs.length) continue;
    const dd = segs.map((q) => `M${gx(q[0]).toFixed(1)},${gy(q[1]).toFixed(1)}L${gx(q[2]).toFixed(1)},${gy(q[3]).toFixed(1)}`).join('');
    const hi = d.highlight != null && Math.abs(lv - d.highlight) < 1e-9;
    const u = (lv - d.vmin) / (d.vmax - d.vmin);
    const stroke = hi ? 'var(--text)' : u > 0.55 ? 'rgba(255,255,255,0.85)' : 'rgba(29,32,64,0.55)';
    s += `<path d="${dd}" fill="none" stroke="${stroke}" stroke-width="${hi ? 3.5 : 1.5}" ${hi ? 'stroke-dasharray="8 4"' : ''}/>`;
    if ((d.labelLevels || []).some((l) => Math.abs(l - lv) < 1e-9)) {
      // label at the segment nearest the requested label row
      const target = (d.labelRow ?? 0.12) * (g.ny - 1);
      let best = segs[0];
      for (const q of segs) if (Math.abs(q[1] - target) < Math.abs(best[1] - target)) best = q;
      const lx = gx((best[0] + best[2]) / 2);
      const ly = gy((best[1] + best[3]) / 2);
      if (lx > box.l + 14 && lx < box.r - 14) s += text(lx, ly, d.fmtLevel ? d.fmtLevel(lv) : String(lv), { anchor: 'middle', cls: 'tick strong halo', fill: 'var(--text)' });
    }
  }
  for (const vl of d.vlines || []) {
    s += line(x(vl.x), box.t, x(vl.x), box.b, { stroke: 'var(--c-e0)', 'stroke-width': 3, 'stroke-dasharray': '10 4 3 4' });
    if (vl.label) {
      // put the label on whichever side of the line has room
      const right = x(vl.x) + 6 + textWidth(vl.label, st.label) <= box.r;
      s += text(x(vl.x) + (right ? 6 : -6), box.t + st.label * 0.7, vl.label, { anchor: right ? 'start' : 'end', cls: 'e0-ink strong halo' });
    }
  }
  for (const m of d.markers || []) {
    const cx = x(m.x);
    const cy = y(m.y);
    if (m.kind === 'ring') {
      s += circle(cx, cy, 13, { fill: 'none', stroke: 'var(--surface)', 'stroke-width': 6 });
      s += circle(cx, cy, 13, { fill: 'none', stroke: 'var(--text)', 'stroke-width': 3 });
    } else {
      s += circle(cx, cy, st.line + 4.5, { fill: 'var(--brand-ink)', stroke: 'var(--surface)', 'stroke-width': 2.5 });
    }
    if (m.label) {
      const right = cx + 18 + textWidth(m.label, st.label) < box.r;
      s += text(cx + (right ? 18 : -18), cy - (m.dy ?? 0), m.label, { anchor: right ? 'start' : 'end', cls: 'strong halo' });
    }
  }
  // legend
  const lx = box.r + 12;
  const lh = box.b - box.t;
  const N = 24;
  for (let k = 0; k < N; k++) {
    const [r, gg, b] = (d.colorFn || BRAND_RAMP)(1 - (k + 0.5) / N);
    s += rect(lx, box.t + (lh * k) / N, 14, lh / N + 0.6, { fill: `rgb(${r},${gg},${b})` });
  }
  s += rect(lx, box.t, 14, lh, { fill: 'none', stroke: 'var(--border)' });
  const lt = d.legendTicks || [d.vmin, (d.vmin + d.vmax) / 2, d.vmax];
  for (const v of lt) {
    const py = box.b - ((v - d.vmin) / (d.vmax - d.vmin)) * lh;
    s += text(lx + 18, py, d.legendFmt ? d.legendFmt(v) : v.toFixed(1), { cls: 'tick' });
  }
  s += axes({
    x,
    y,
    st,
    box,
    grid: false,
    xTicks: d.xTicks,
    yTicks: yTickVals || d.yTicks,
    yFmt: d.yLog ? (v) => fmtTick(v, yTickVals) : undefined,
    yTickW: tw,
    xTitle: d.xTitle,
    yTitle: d.yTitle,
  });
  return s;
}

export const createHeatmapPlot = (host, label) => createPlot(host, drawHeatmap, { className: 'heatmap', label });
