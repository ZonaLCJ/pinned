// Animation 2 plots: MOS band diagram (gate | oxide | p-Si) and psi_s vs V_G.
import { mosProfile, mosLadder, mosPhiF, mosPsi, rangeArray } from '../engine.js';
import { createPlot, lin, line, rect, path, circle, text, vArrow, axes, ticks, fmtTick, tickWidth, textWidth } from './svg.js';
import { drawLadder } from './ladder.js';
import { num } from '../ui/format.js';

const XMAX = 150e-9; // depth shown in the semiconductor

/** data = { m, psi, VG, Eg } — energies relative to the semiconductor E_F = 0. */
export function drawMosBand(ctx, { m, psi, VG, Eg }) {
  const { w, h, st } = ctx;
  const phiF = mosPhiF(m);
  const yMin = -1.35;
  const yMax = 1.45;
  const yt = ticks(-1, 1, 4);
  const tw = tickWidth(yt.map((v) => fmtTick(v, yt)), st);
  const rightW = textWidth('E_{c}', st.label) + 14;
  const box = { l: tw + st.label + 22, r: w - rightW, t: 6, b: h - (st.tick + st.label + 26) };
  const y = lin(yMin, yMax, box.b, box.t);
  const Wp = box.r - box.l;
  const gateW = Wp * 0.19;
  const oxW = Wp * 0.1;
  const xg = box.l + gateW;
  const x0 = xg + oxW;
  const xs = lin(0, XMAX, x0, box.r);
  const prof = mosProfile(m, psi, XMAX, 90);
  const Ei = prof.ps.map((p) => phiF - p);
  const Ec = Ei.map((e) => e + Eg / 2);
  const Ev = Ei.map((e) => e - Eg / 2);
  const P = (arr) => prof.xs.map((x, i) => [xs(x), y(arr[i])]);
  let s = '';
  // depletion / accumulation region
  if (prof.W > 0) s += rect(x0, box.t, Math.min(xs(prof.W), box.r) - x0, box.b - box.t, { fill: 'var(--brand-tint)' });
  s += `<path d="M${P(Ev).map((q) => q.join(',')).join('L')}L${box.r},${box.b}L${x0},${box.b}Z" fill="var(--c-valence-fill)"/>`;
  // gate metal filled up to its Fermi level, E_F,gate = −qV_G
  const EFg = -VG;
  const off = EFg < yMin || EFg > yMax;
  const yg = y(Math.max(yMin, Math.min(yMax, EFg)));
  s += rect(box.l, yg, gateW, box.b - yg, { fill: 'var(--c-metal)' });
  s += line(box.l, yg, xg, yg, { stroke: 'var(--c-ef)', 'stroke-width': st.line, 'stroke-dasharray': `${st.line * 3} ${st.line * 2}` });
  if (gateW > textWidth('gate', st.label) + 10) s += text(box.l + 6, box.t + st.label * 0.7, 'gate', { cls: 'strong' });
  const gateLabel = gateW > textWidth('E_{F,gate}', st.label) * 0.92 + 6;
  if (!gateLabel) {
    /* too narrow for the label: the dashed line alone marks the gate Fermi level */
  } else if (off && EFg < yMin) {
    // gate Fermi level below the plotted range: label plus a downward arrow
    s += text(box.l + 4, yg - st.label * 2.2, 'E_{F,gate}', { cls: 'ink halo' });
    s += `<path d="M${box.l + 14},${yg - st.label * 1.5}V${yg - 4}M${box.l + 8},${yg - 10}L${box.l + 14},${yg - 3}L${box.l + 20},${yg - 10}" stroke="var(--brand-ink)" stroke-width="2.5" fill="none"/>`;
  } else s += text(box.l + 4, yg - st.label * 0.6, 'E_{F,gate}', { cls: 'ink halo' });
  // oxide
  s += rect(xg, box.t, oxW, box.b - box.t, { fill: '#fbf6e9', stroke: 'var(--text-muted)', 'stroke-width': 1.5 });
  if (oxW > textWidth('SiO₂', st.label) + 4) s += text(xg + oxW / 2, box.t + st.label * 0.7, 'SiO₂', { anchor: 'middle', cls: 'muted strong' });
  // interface-state ladder at the oxide–Si interface (neutral level E0 at midgap)
  const ladderW = Math.max(18, Math.min(30, Wp * 0.04));
  if (m.Dit > 0) s += drawLadder({ x: x0, w: ladderW, y, st }, mosLadder(m, psi, Eg), { labelX: x0 - 6, lineFrom: x0 - 6, e0Label: true });
  // bands
  s += path(P(Ec), { stroke: 'var(--c-band)', 'stroke-width': st.line });
  s += path(P(Ev), { stroke: 'var(--c-band)', 'stroke-width': st.line });
  s += path(P(Ei), { stroke: 'var(--text-muted)', 'stroke-width': 2, 'stroke-dasharray': '2 5' });
  s += line(x0, y(Ec[0]), x0, y(Ev[0]), { stroke: 'var(--c-band)', 'stroke-width': 1.5 });
  s += line(x0, y(0), box.r, y(0), { stroke: 'var(--c-ef)', 'stroke-width': st.line, 'stroke-dasharray': `${st.line * 3} ${st.line * 2}` });
  // band bending psi_s, measured on E_i
  const ax = x0 + ladderW + 12;
  s += line(ax - 4, y(phiF), box.r, y(phiF), { stroke: 'var(--text-muted)', 'stroke-width': 1, 'stroke-dasharray': '1 4' });
  if (Math.abs(y(Ei[0]) - y(phiF)) > 8) s += vArrow(ax, y(phiF), y(Ei[0]), { sw: 2.5, stroke: 'var(--brand-ink)' });
  const midE = (phiF + Ei[0]) / 2;
  const shift = Math.abs(psi) < 0.08 ? -st.label : Math.abs(midE) < 0.12 ? (midE >= 0 ? -st.label * 0.8 : st.label * 0.8) : 0;
  s += text(ax + 8, y(midE) + shift, `ψ_{s} = ${num(psi, 2)} V`, { cls: 'ink strong halo' });
  // inversion electrons at the surface
  if (psi >= 2 * phiF) {
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 5);
      s += circle(x0 + ladderW + 8 + (i % 5) * 13 + row * 6, y(Ec[0] + 0.05 + row * 0.08), 5, { fill: 'var(--c-neg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    }
    s += text(x0 + ladderW + 8, y(Ec[0] + 0.24), 'inversion electrons', { cls: 'neg-ink strong halo' });
  }
  const last = prof.xs.length - 1;
  s += text(box.r + 7, y(Ec[last]), 'E_{c}', { cls: 'strong' });
  s += text(box.r + 7, y(Ei[last]) - 4, 'E_{i}', { cls: 'muted' });
  const close = Math.abs(Ev[last]) < 0.25;
  s += text(box.r + 7, y(0) - (close ? st.label * 0.45 : 0), 'E_{F}', { cls: 'ink strong' });
  s += text(box.r + 7, y(Ev[last]) + (close ? st.label * 0.45 : 0), 'E_{v}', { cls: 'strong' });
  s += axes({
    x: lin(0, XMAX * 1e9, x0, box.r),
    y,
    st,
    box,
    grid: false,
    xTicks: [0, 50, 100, 150],
    yTicks: yt,
    yTickW: tw,
    xTitle: 'depth into p-Si (nm)',
    yTitle: 'E − E_{F} (eV)',
  });
  return s;
}

const memo = new Map();
function psiCurve(m) {
  const key = `${m.Dit}|${m.NA}|${m.tox}`;
  if (!memo.has(key)) {
    const xs = rangeArray(m.VGRange[0], m.VGRange[1], 101);
    memo.set(key, { xs, ys: xs.map((v) => mosPsi(m, v)) });
  }
  return memo.get(key);
}

export const PSI_STYLES = [
  { color: 'var(--brand-ink)', dash: null },
  { color: 'var(--text)', dash: '9 6' },
  { color: 'var(--text-muted)', dash: '2 6' },
];

/** data = { models: [{ m, label }], sel (index), VG, psi } */
export function drawPsiVG(ctx, { models, sel, VG, psi }) {
  const { w, h, st } = ctx;
  const m0 = models[0].m;
  const phiF = mosPhiF(m0);
  const [X0, X1] = m0.VGRange;
  const Y0 = -0.3;
  const Y1 = 1.05;
  const yt = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const tw = tickWidth(['0.8'], st);
  const box = { l: tw + st.label + 22, r: w - 12, t: 8, b: h - (st.tick + st.label + 26) };
  const x = lin(X0, X1, box.l, box.r);
  const y = lin(Y0, Y1, box.b, box.t);
  let s = '';
  s += line(box.l, y(2 * phiF), box.r, y(2 * phiF), { stroke: 'var(--text)', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' });
  s += text(box.l + 6, y(2 * phiF) - st.label * 0.7, `inversion: ψ_{s} = 2φ_{F} = ${num(2 * phiF, 2)} V`, { cls: 'strong halo' });
  models.forEach((md, i) => {
    const c = psiCurve(md.m);
    const stl = PSI_STYLES[i % PSI_STYLES.length];
    s += path(
      c.xs.map((v, k) => [x(v), y(Math.max(Y0, Math.min(Y1, c.ys[k])))]),
      { stroke: stl.color, 'stroke-width': i === sel ? st.line + 1.5 : st.line, 'stroke-dasharray': stl.dash },
    );
  });
  s += line(x(VG), box.t, x(VG), box.b, { stroke: 'var(--brand-ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
  s += circle(x(VG), y(Math.max(Y0, Math.min(Y1, psi))), st.line + 5, { fill: 'var(--brand-ink)', stroke: 'var(--surface)', 'stroke-width': 2.5 });
  s += axes({ x, y, st, box, xTicks: [-2, -1, 0, 1, 2, 3], yTicks: yt, yTickW: tw, xTitle: 'gate voltage V_{G} (V)', yTitle: 'ψ_{s} (V)' });
  return s;
}

export const createMosBandPlot = (host) => createPlot(host, drawMosBand, { className: 'mos-band', label: 'MOS band diagram: gate, oxide and p-type silicon' });
export const createPsiVGPlot = (host) => createPlot(host, drawPsiVG, { className: 'psi-vg', label: 'Surface potential versus gate voltage for three interface-state densities' });
