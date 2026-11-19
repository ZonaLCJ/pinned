// Band diagram: metal | interfacial layer δ (enlarged) | semiconductor, energies vs E_F = 0.
// The vacuum level is drawn on a broken axis: its step across δ (ΔV_ox) and its shape in
// the semiconductor are true to scale, but it is shifted down by χ (marked with breaks).
import { bandProfile, ladderStates } from '../engine.js';
import { metalAt } from '../state.js';
import { createPlot, lin, line, rect, path, text, vArrow, axes, ticks, fmtTick, tickWidth, textWidth, circle } from './svg.js';
import { drawLadder } from './ladder.js';
import { num, signed, length } from '../ui/format.js';

const VAC_GAP = 0.45; // eV-equivalent gap between the bands and the (shifted) vacuum level

function breakTicks(x, y, s = 7) {
  return (
    rect(x - s - 2, y - 4, 2 * s + 4, 8, { fill: 'var(--surface)' }) +
    `<path d="M${x - s},${y + 1}L${x + s},${y - 5}M${x - s},${y + 6}L${x + s},${y}" stroke="var(--text-muted)" stroke-width="2" fill="none"/>`
  );
}

/**
 * data = { p, res, opts }
 * opts: { vac, ladder, ladderNeutral, phiB, hideBarrier, dVox, W, arrows, anim,
 *         bare (no axes), xMax (fixed depth, m), overlay(geometry) -> extra markup }
 * anim (contact animation): { sep: 0..1, bend: 0..1 }
 */
export function drawBand(ctx, { p, res, opts = {} }) {
  const { w, h, st } = ctx;
  const o = { vac: true, ladder: true, phiB: true, W: true, arrows: true, ...opts };
  const anim = o.anim;
  const Eg = p.Eg;

  // ---- energy range (fixed per semiconductor so demos don't rescale)
  const yMin = -Eg - 0.12;
  const bandTop = Math.max(Eg, 1.25) + 0.1;
  const yMax = o.vac ? Math.max(Eg, 2.0) + VAC_GAP + 0.18 : bandTop;
  // fewer energy ticks when the diagram is short (Outline-mode side panels)
  const yTickVals = ticks(-Eg, o.vac ? Eg : bandTop - 0.05, h < 240 ? 3 : 5).filter((v) => v >= yMin && v <= bandTop);
  const yLabels = yTickVals.map((v) => fmtTick(v, yTickVals));
  const tw = tickWidth(yLabels, st);
  const rightLabelW = textWidth(o.vac ? 'E_{vac}' : 'E_{c}', st.label) + 14;
  const box = o.bare ? { l: 6, r: w - rightLabelW, t: 6, b: h - 6 } : { l: tw + st.label + 22, r: w - rightLabelW, t: 6, b: h - (st.tick + st.label + 26) };
  const y = lin(yMin, yMax, box.b, box.t);
  const Wp = box.r - box.l;

  // ---- x layout
  const metalW = Wp * (o.vac ? 0.2 : 0.16);
  const layerW = res.ideal ? 0 : Math.max(Wp * 0.06, st.label * 1.25);
  const gapW = anim ? anim.sep * Wp * 0.16 : 0;
  const xm = box.l + metalW; // metal surface
  const x0 = xm + layerW + gapW; // semiconductor surface (x = 0)
  const prof = bandProfile(p, res, 90, o.xMax);
  const xs = lin(0, prof.xMax, x0, box.r);

  // ---- semiconductor profile (optionally mid-contact)
  let Ec = prof.Ec;
  let EFs = 0;
  let Wd = res.W;
  if (anim) {
    const b = anim.bend;
    const Vbi = Math.max(res.Vbi, 0);
    const bulk = res.phiN + (1 - b) * Vbi;
    Wd = res.W * Math.sqrt(b);
    Ec = prof.xs.map((x) => (Wd > 0 && x < Wd ? bulk + b * Vbi * (1 - x / Wd) ** 2 : bulk));
    EFs = (1 - b) * Vbi;
  }
  const Ev = Ec.map((e) => e - Eg);
  const ptsC = prof.xs.map((x, i) => [xs(x), y(Ec[i])]);
  const ptsV = prof.xs.map((x, i) => [xs(x), y(Ev[i])]);
  const EcBulk = Ec[Ec.length - 1];

  let s = '';
  // depletion shading
  if (Wd > 0) s += rect(x0, box.t, Math.min(xs(Wd), box.r) - x0, box.b - box.t, { fill: 'var(--brand-tint)' });
  // valence fill
  s += `<path d="${'M' + ptsV.map((q) => q.join(',')).join('L')}L${box.r},${box.b}L${x0},${box.b}Z" fill="var(--c-valence-fill)"/>`;
  // metal
  s += rect(box.l, y(0), metalW, box.b - y(0), { fill: 'var(--c-metal)' });
  const metal = metalAt(p.phiM);
  const mlab = metal ? metal.id : 'metal';
  if (metalW > textWidth(mlab, st.label) + 14) s += text(box.l + 8, box.b - st.label * 0.8, mlab, { cls: 'strong' });
  // interfacial layer
  if (layerW > 0) {
    s += rect(xm, box.t, layerW, box.b - box.t, { fill: '#f4f5fb', stroke: 'var(--border)', 'stroke-width': 1.5 });
    if (box.b - box.t > textWidth('δ (enlarged)', st.label) + 30) s += text(xm + layerW / 2, box.b - 8, 'δ (enlarged)', { anchor: 'start', cls: 'muted', rotate: -90 });
    else s += text(xm + layerW / 2, box.t + st.label * 0.7, 'δ', { anchor: 'middle', cls: 'muted strong' });
  }

  // interface-state ladder
  const ladderW = Math.max(18, Math.min(34, Wp * 0.045));
  if (o.ladder && !res.ideal && p.Dit > 0 && !anim) {
    const lad = ladderStates(p, res);
    s += drawLadder({ x: x0, w: ladderW, y, st }, lad, { neutral: o.ladderNeutral, labelX: xm - 6, lineFrom: xm });
  }

  // bands
  s += path(ptsC, { stroke: 'var(--c-band)', 'stroke-width': st.line, 'stroke-linejoin': 'round' });
  s += path(ptsV, { stroke: 'var(--c-band)', 'stroke-width': st.line, 'stroke-linejoin': 'round' });
  s += line(x0, y(Ec[0]), x0, y(Ev[0]), { stroke: 'var(--c-band)', 'stroke-width': 1.5 });

  // Fermi level(s)
  const efStyle = { stroke: 'var(--c-ef)', 'stroke-width': st.line, 'stroke-dasharray': `${st.line * 3} ${st.line * 2}` };
  if (anim && EFs > 0.002) {
    s += line(box.l, y(0), xm, y(0), efStyle);
    s += line(x0, y(EFs), box.r, y(EFs), efStyle);
  } else {
    s += line(box.l, y(0), box.r, y(0), efStyle);
  }

  if (o.overlay) s += o.overlay({ x0, xm, box, y, xs, prof, Ec, Ev, EcBulk, EvBulk: EcBulk - Eg, metalW, doping: res.doping || 'n', res });

  // vacuum level (shifted by chi on a broken axis)
  if (o.vac) {
    const vac = (eSemi) => y(eSemi + VAC_GAP);
    const vm = y(p.phiM - p.chi + VAC_GAP); // metal vacuum level (visual)
    const vacStyle = { stroke: 'var(--c-vac)', 'stroke-width': st.line, 'stroke-dasharray': `1 ${st.line * 2}`, 'stroke-linecap': 'round' };
    let vpts = [[box.l, vm], [xm, vm]];
    if (anim) vpts.push([x0, vac(Ec[0])]);
    else vpts.push([x0, vac(Ec[0])]);
    vpts = vpts.concat(prof.xs.map((x, i) => [xs(x), vac(Ec[i])]));
    s += path(vpts, vacStyle);
    if (o.arrows) {
      // phi_m arrow in the metal, chi arrow in the bulk, both broken
      const ax = box.l + Math.max(14, metalW * 0.24);
      s += vArrow(ax, y(0), vm, { sw: 2 });
      s += breakTicks(ax, (y(0) + vm) / 2);
      s += text(ax + 8, vm + st.label * 0.95, 'φ_{m}', { cls: 'strong halo' });
      const xw = Wd > 0 ? Math.min(xs(Wd), box.r - 40) : box.r - 60;
      const cx = (xw + box.r) / 2 - 6;
      s += vArrow(cx, y(EcBulk), vac(EcBulk), { sw: 2 });
      s += breakTicks(cx, (y(EcBulk) + vac(EcBulk)) / 2);
      s += text(cx + 8, (y(EcBulk) + vac(EcBulk)) / 2, 'χ', { cls: 'strong halo' });
    }
    if (o.dVox && layerW > 0) {
      const ys = vac(Ec[0]);
      const ax = xm + layerW / 2;
      if (Math.abs(vm - ys) > 6) s += vArrow(ax, vm, ys, { stroke: 'var(--brand-ink)', sw: 2.5 });
      const ly = Math.min(vm, ys) - st.label * 0.85;
      s += text(box.l + 6, Math.max(box.t + st.label * 0.6, ly), `ΔV_{ox} = ${signed(res.dVox, 2)} V`, { cls: 'ink strong halo' });
    }
    s += text(box.r + 7, vac(EcBulk), 'E_{vac}', { cls: 'muted' });
  }

  // annotations
  if (o.phiB && !anim) {
    // n-type: phi_Bn = E_c(0) - E_F; p-type: phi_Bp = E_F - E_v(0)
    const pType = res.doping === 'p';
    const edge = pType ? Ev[0] : Ec[0];
    const name = pType ? 'φ_{Bp}' : 'φ_{Bn}';
    const ax = x0 + ladderW + 10;
    s += vArrow(ax, y(0), y(edge), { sw: 2.5 });
    const val = o.hideBarrier ? '?' : `${num(res.phiB ?? res.phiBn, 2)} eV`;
    const my = (y(0) + y(edge)) / 2;
    if (Wp > 560) s += text(ax + 8, my, `${name} = ${val}`, { cls: 'strong halo' });
    else {
      s += text(ax + 8, my - st.label * 0.55, `${name} =`, { cls: 'strong halo' });
      s += text(ax + 8, my + st.label * 0.6, val, { cls: 'strong halo' });
    }
  }
  if (anim && o.phiB && anim.bend > 0.98) {
    const ax = x0 + 10;
    s += vArrow(ax, y(0), y(Ec[0]), { sw: 2.5 });
    s += text(ax + 8, (y(0) + y(Ec[0])) / 2, `φ_{B0} = φ_{m} − χ = ${num(res.phiBn, 2)} eV`, { cls: 'strong halo' });
  }
  if (o.W && !o.vac && Wd > 0 && xs(Wd) < box.r - 10) {
    const yb = box.t + 6;
    const xl = x0 + ladderW + 2;
    const xr = xs(Wd);
    s += line(xl, yb, xr, yb, { stroke: 'var(--brand-ink)', 'stroke-width': 1.5 });
    s += line(xr, yb - 5, xr, yb + 6, { stroke: 'var(--brand-ink)', 'stroke-width': 1.5 });
    const lbl = `W = ${length(Wd)}`;
    const lw = textWidth(lbl, st.label);
    const cxl = Math.min(box.r - lw / 2 - 4, Math.max(xl + lw / 2 + 4, (xl + xr) / 2 + lw * 0.25));
    s += text(cxl, yb + st.label * 0.85, lbl, { anchor: 'middle', cls: 'ink halo-tint' });
  }

  // electrons flowing into the metal during the contact animation
  if (anim && anim.bend > 0 && anim.bend < 1) {
    for (let i = 0; i < 7; i++) {
      const start = (0.12 + i * 0.11) * Math.max(res.W, prof.xMax * 0.5);
      const u = Math.min(1, Math.max(0, (anim.bend - i * 0.06) / 0.5));
      const xa = xs(start);
      const xb = box.l + metalW * (0.2 + 0.08 * i);
      const ex = xa + (xb - xa) * u;
      const ey = u < 0.98 ? y(Ec[Math.min(Ec.length - 1, Math.round((start / prof.xMax) * (Ec.length - 1)))] + 0.08) * (1 - u) + y(-0.06) * u : y(-0.06);
      s += circle(ex, ey, Math.max(4, st.line + 1.5), { fill: 'var(--c-neg)', opacity: 1 - 0.6 * u });
    }
  }

  // right-edge labels
  s += text(box.r + 7, y(EcBulk), 'E_{c}', { cls: 'strong' });
  s += text(box.r + 7, y(EcBulk - Eg), 'E_{v}', { cls: 'strong' });
  const efY = anim ? EFs : 0;
  const nearC = Math.abs(EcBulk - efY) < 0.18;
  const nearV = Math.abs(EcBulk - Eg - efY) < 0.18;
  s += text(box.r + 7, y(efY) + (nearC ? st.label * 0.7 : nearV ? -st.label * 0.7 : 0), 'E_{F}', { cls: 'ink strong' });

  // axes: energy ticks only over the band region; x ticks only in the semiconductor
  if (o.bare) return s;
  const xUnitUm = prof.xMax >= 1e-6;
  const xsc = xUnitUm ? 1e6 : 1e9;
  const xTickVals = ticks(0, prof.xMax * xsc, Math.max(2, Math.floor((box.r - x0) / (st.tick * 4.5))));
  s += axes({
    x: lin(0, prof.xMax * xsc, x0, box.r),
    y,
    st,
    box,
    xTicks: xTickVals,
    yTicks: yTickVals,
    yTickW: tw,
    grid: false,
    xTitle: `x (${xUnitUm ? 'µm' : 'nm'}) into the semiconductor`,
    yTitle: 'E − E_{F} (eV)',
  });
  return s;
}

export function createBandPlot(host, label = 'Band diagram of the metal–semiconductor contact') {
  return createPlot(host, drawBand, { className: 'band-plot', label });
}
