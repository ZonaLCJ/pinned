// Barrier height vs metal work function. The engine curve always comes from the
// numeric solver (sweep over phi_m). Used by S1 (game), S3 (main) and S4 (2D tab).
import { sweepPhiM, rangeArray, pivotWorkFunction, schottkyMott, pinnedBarrier } from '../engine.js';
import { createPlot, lin, path, line, circle, rect, text, axes, tickWidth, textWidth } from './svg.js';
import { num } from '../ui/format.js';

const memo = new Map();
function engineCurve(p, xs) {
  const key = [p.semi, p.doping, p.chi, p.Eg, p.phi0, p.Dit, p.delta, p.epsRi, p.Nd, p.T].join('|') + `|${xs[0]}|${xs.length}`;
  if (memo.has(key)) return memo.get(key);
  const ys = sweepPhiM(p, xs);
  if (memo.size > 400) memo.clear();
  memo.set(key, ys);
  return ys;
}

/**
 * data = {
 *   p, xRange=[3.5,6], yRange=[0,1.4] (widened for wide gaps),
 *   curve=true, ideal=true, pinned (true: always; default: when D_it > 0), pivot (same), target=null,
 *   curves: [{ p, label, color, dash, cls, width }] (several engine curves, labelled at the right),
 *   dots: [{ phiM, phiB, label, color, ring }], overlay: [{ phiM, phiB, label }], overlayLabel,
 *   lines: [{ fn, label, color, dash, width }], ghost: [{ p, label }], xMarker
 * }
 */
export function drawPhiBPhiM(ctx, d) {
  const { w, h, st } = ctx;
  const [X0, X1] = d.xRange || [3.5, 6];
  // default range 0–1.4 eV, widened when E_g does not fit (GaAs, GaN)
  const [Y0, Y1] = d.yRange || [0, d.p ? Math.max(1.4, Math.ceil((d.p.Eg + 0.1) * 5) / 5) : 1.4];
  const yStep = Y1 - Y0 > 2 ? 0.5 : 0.2;
  const tw = tickWidth(['1.2'], st);
  // several labelled curves: keep a right margin for their labels
  const labW = d.curves?.length ? Math.max(...d.curves.map((c) => textWidth(c.label, st.label))) + 12 : 0;
  const box = { l: tw + st.label + 22, r: w - 14 - labW, t: 10, b: h - (st.tick + st.label + 26) };
  const x = lin(X0, X1, box.l, box.r);
  const y = lin(Y0, Y1, box.b, box.t);
  const p = d.p;
  const xs = rangeArray(X0, X1, 61);
  const clip = (v) => (v < Y0 - 0.02 || v > Y1 + 0.02 ? null : y(v));
  const cid = `${ctx.uid}-clip`;
  let s = `<clipPath id="${cid}"><rect x="${box.l}" y="${box.t}" width="${box.r - box.l}" height="${box.b - box.t}"/></clipPath>`;

  if (d.target != null) {
    s += rect(box.l, y(d.target), box.r - box.l, box.b - y(d.target), { fill: 'var(--brand-tint)' });
    s += line(box.l, y(d.target), box.r, y(d.target), { stroke: 'var(--brand-ink)', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
    s += text(box.l + 8, y(d.target) + st.label * 0.8, `target: φ_{Bn} ≤ ${num(d.target, 2)} eV`, { cls: 'ink strong' });
  }
  // S = 1 (Schottky–Mott) line, clipped to 0…E_g with flat ends
  const smAt = (v) => Math.min(p.Eg, Math.max(0, schottkyMott({ ...p, phiM: v })));
  if (p && d.ideal !== false) {
    const pts = rangeArray(X0, X1, 121).map((v) => [x(v), clip(smAt(v))]);
    s += `<g clip-path="url(#${cid})">${path(pts, { stroke: 'var(--text-muted)', 'stroke-width': 2, 'stroke-dasharray': '7 5' })}</g>`;
    const pType = p.doping === 'p';
    // label on the sloped part, near the top of the plot
    const lx = pType ? Math.max(X0 + 0.3, p.Eg + p.chi - (Y1 - 0.15)) : Math.min(X1 - 0.05, p.chi + Math.min(Y1, p.Eg) - 0.12);
    s += text(x(lx) + (pType ? 8 : -8), y(smAt(lx)), 'S = 1 (ideal)', { anchor: pType ? 'start' : 'end', cls: 'muted halo' });
  }
  // S = 0 (Bardeen limit) line: E_g − phi0 (n-type) or phi0 (p-type).
  // Section 3 always shows it (pinned: true); elsewhere only when there are interface states.
  const showPinned = p && (d.pinned === true || (d.pinned !== false && p.Dit > 0));
  if (showPinned) {
    const pb = pinnedBarrier(p);
    s += line(box.l, y(pb), box.r, y(pb), { stroke: 'var(--c-e0)', 'stroke-width': 2.5, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' });
    const name = p.doping === 'p' ? 'φ_{0}' : 'E_{g} − φ_{0}';
    const lbl = w > 520 ? `Bardeen limit (S = 0): ${name} = ${num(pb, 2)} eV` : `Bardeen limit (S = 0)`;
    s += text(box.r - 6, y(pb) + st.label * 0.85, lbl, { anchor: 'end', cls: 'e0-ink halo' });
  }
  for (const gh of d.ghost || []) {
    const ys = engineCurve(gh.p, xs);
    s += path(xs.map((v, i) => [x(v), clip(ys[i])]), { stroke: '#b5b9d6', 'stroke-width': 2 });
  }
  for (const ln of d.lines || []) {
    const pts = xs.map((v) => [x(v), clip(ln.fn(v))]);
    s += `<g clip-path="url(#${cid})">${path(pts, { stroke: ln.color, 'stroke-width': ln.width || st.line, 'stroke-dasharray': ln.dash || null })}</g>`;
    if (ln.label) {
      const lv = ln.labelAt ?? X1 - 0.1;
      const ly = clip(ln.fn(lv));
      if (ly != null) s += text(x(lv), ly - st.label * 0.8, ln.label, { anchor: 'end', cls: `${ln.cls || ''} strong halo` });
    }
  }
  if (d.legend?.length) {
    let ly = box.t + st.label * 0.8;
    for (const lg of d.legend) {
      s += line(box.l + 10, ly, box.l + 46, ly, { stroke: lg.color, 'stroke-width': lg.width || st.line, 'stroke-dasharray': lg.dash || null });
      s += text(box.l + 54, ly, lg.label, { cls: `${lg.cls || ''} strong halo` });
      ly += st.label * 1.35;
    }
  }
  // several engine curves (four-semiconductor view), with labels at the right end
  if (d.curves?.length) {
    const ends = [];
    for (const cv of d.curves) {
      const ys = engineCurve(cv.p, xs);
      s += `<g clip-path="url(#${cid})">${path(xs.map((v, i) => [x(v), clip(ys[i])]), { stroke: cv.color, 'stroke-width': cv.width || st.line, 'stroke-dasharray': cv.dash || null, 'stroke-linecap': 'round' })}</g>`;
      ends.push({ y: y(Math.min(Y1, Math.max(Y0, ys[ys.length - 1]))), label: cv.label, cls: cv.cls || 'strong' });
    }
    // labels just right of the plot box, at each curve's end, pushed apart where they collide
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + st.label * 1.1);
    const over = ends.length ? ends[ends.length - 1].y - (box.b - st.label * 0.5) : 0;
    if (over > 0) for (const e of ends) e.y -= over;
    for (const e of ends) s += text(box.r + 8, e.y, e.label, { cls: `${e.cls} halo` });
  }
  if (p && d.curve !== false) {
    const ys = engineCurve(p, xs);
    s += path(xs.map((v, i) => [x(v), clip(ys[i])]), { stroke: 'var(--brand-ink)', 'stroke-width': st.line + 0.5, 'stroke-linejoin': 'round' });
  }
  if (p && (d.pivot === true || (d.pivot !== false && p.Dit > 0))) {
    // the pivot is where the S = 1 and S = 0 lines cross
    const pv = pivotWorkFunction(p);
    if (pv > X0 && pv < X1) {
      const pb = pinnedBarrier(p);
      s += line(x(pv), box.b, x(pv), y(pb), { stroke: 'var(--c-e0)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
      s += circle(x(pv), y(pb), st.line + 4, { fill: 'var(--surface)', stroke: 'var(--c-e0)', 'stroke-width': 3 });
      const pl = w > 520 ? `pivot φ_{m}* = ${num(pv, 2)} eV` : `pivot ${num(pv, 2)}`;
      s += text(x(pv) - 10, y(pb) - st.label * 0.95, pl, { anchor: 'end', cls: 'e0-ink strong halo' });
    }
  }
  if (d.xMarker != null) {
    s += line(x(d.xMarker), box.t, x(d.xMarker), box.b, { stroke: 'var(--brand-ink)', 'stroke-width': 2, 'stroke-dasharray': '3 4' });
  }
  for (const o of d.overlay || []) {
    const cx = x(o.phiM);
    const cy = y(o.phiB);
    s += `<path d="M${cx - 7},${cy - 7}L${cx + 7},${cy + 7}M${cx - 7},${cy + 7}L${cx + 7},${cy - 7}" stroke="var(--text)" stroke-width="3"/>`;
    if (o.label && w > 520) s += text(cx, cy + (o.below ? 1 : -1) * st.tick * 1.15, o.label, { anchor: 'middle', cls: 'tick halo' });
  }
  for (const dt of d.dots || []) {
    if (dt.phiB == null || !Number.isFinite(dt.phiB)) continue;
    const cx = x(dt.phiM);
    const cy = Math.min(box.b, Math.max(box.t, y(dt.phiB)));
    s += circle(cx, cy, dt.r || st.line + 4.5, { fill: dt.color || 'var(--brand-ink)', stroke: dt.ring || 'var(--surface)', 'stroke-width': 2.5 });
    if (dt.label) s += text(cx + (dt.left ? -10 : 10), cy - st.label * 0.75, dt.label, { anchor: dt.left ? 'end' : 'start', cls: 'strong halo' });
  }
  s += axes({
    x,
    y,
    st,
    box,
    xTicks: rangeArray(Math.ceil(X0 * 2) / 2, Math.floor(X1 * 2) / 2, Math.round((Math.floor(X1 * 2) - Math.ceil(X0 * 2)) + 1)),
    yTicks: rangeArray(Y0, Y0 + Math.floor((Y1 - Y0) / yStep + 1e-9) * yStep, Math.floor((Y1 - Y0) / yStep + 1e-9) + 1).filter((_, i) => i % (w < 420 ? 2 : 1) === 0),
    yTickW: tw,
    xTitle: d.xTitle || 'metal work function φ_{m} (eV)',
    yTitle: d.yTitle || (p?.doping === 'p' ? 'barrier φ_{Bp} (eV)' : 'barrier φ_{Bn} (eV)'),
  });
  return s;
}

export const createPhiBPhiMPlot = (host, label = 'Barrier height versus metal work function') =>
  createPlot(host, drawPhiBPhiM, { className: 'phib-phim', label });
