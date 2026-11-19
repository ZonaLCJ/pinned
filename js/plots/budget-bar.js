// Potential budget: phi_m − chi = phi_Bn + ΔV_ox, drawn as a signed waterfall
// (the ΔV_ox bar starts where the φ_Bn bar ends, so the two stack to φ_m − χ).
import { createPlot, lin, rect, line, text, textWidth } from './svg.js';
import { num, signed } from '../ui/format.js';

export function drawBudget(ctx, { p, res, range = [-1, 2] }) {
  const { w, h, st } = ctx;
  const total = p.phiM - p.chi;
  // phi_m - chi = (E_c(0) - E_F) + dV_ox: E_c(0) - E_F is phi_Bn (n-type) or E_g - phi_Bp (p-type)
  const b = res.Ec0 ?? res.phiBn;
  const bLabel = res.doping === 'p' ? 'E_{g} − φ_{Bp}' : 'φ_{Bn}';
  const d = res.dVox;
  const share = total > 0.05 && d >= 0 && b >= 0;
  const rows = [
    { lbl: 'φ_{m} − χ', from: 0, to: total, val: `${num(total, 2)} eV`, fill: 'var(--brand-tint)', stroke: 'var(--brand-ink)', cls: 'strong' },
    { lbl: bLabel, from: 0, to: b, val: `${num(b, 2)}${share ? ` · ${Math.round((b / total) * 100)}%` : ''}`, fill: 'var(--text)', cls: 'strong' },
    { lbl: 'ΔV_{ox}', from: b, to: b + d, val: `${signed(d, 2)}${share ? ` · ${Math.round((d / total) * 100)}%` : ''}`, fill: d >= 0 ? 'var(--brand)' : null, stroke: 'var(--brand-ink)', cls: 'ink strong' },
  ];
  const labW = Math.max(textWidth('ΔV_{ox}', st.label), textWidth(bLabel, st.label)) + 14;
  const valW = textWidth('+0.32 · 29%', st.tick) + 10;
  const box = { l: labW, r: w - valW, t: 2, b: h - st.tick - 12 };
  const x = lin(range[0], range[1], box.l, box.r);
  const rh = (box.b - box.t) / rows.length;
  const bh = Math.max(10, Math.min(rh * 0.62, 30));
  const cl = (v) => Math.max(range[0], Math.min(range[1], v));
  const hatch = `${ctx.uid}-hatch`;
  let s = `<defs><pattern id="${hatch}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--brand-ink)" stroke-width="3"/></pattern></defs>`;
  for (let v = Math.ceil(range[0] * 2) / 2; v <= range[1] + 1e-9; v += 0.5) {
    s += line(x(v), box.t, x(v), box.b, { class: 'gridline' });
    if (Number.isInteger(v)) s += text(x(v), box.b + 6 + st.tick * 0.55, v === 0 ? '0' : `${v > 0 ? '' : '−'}${Math.abs(v)}`, { anchor: 'middle', cls: 'tick' });
  }
  s += line(x(0), box.t, x(0), box.b, { stroke: 'var(--text-muted)', 'stroke-width': 1.5 });
  rows.forEach((r, i) => {
    const cy = box.t + rh * (i + 0.5);
    s += text(4, cy, r.lbl, { cls: r.cls });
    s += rect(x(cl(r.from)), cy - bh / 2, x(cl(r.to)) - x(cl(r.from)), bh, { fill: r.fill || `url(#${hatch})`, stroke: r.stroke || null, 'stroke-width': r.stroke ? 2 : null, rx: 3 });
    s += text(w - 2, cy, r.val, { anchor: 'end', cls: `tick ${i === 2 ? 'ink' : ''}` });
  });
  // connector: the ΔV_ox bar continues from the end of the φ_Bn bar
  const y1 = box.t + rh * 1.5 + bh / 2;
  const y2 = box.t + rh * 2.5 - bh / 2;
  s += line(x(cl(b)), y1, x(cl(b)), y2, { stroke: 'var(--brand-ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
  return s;
}

export const createBudgetPlot = (host) => createPlot(host, drawBudget, { className: 'budget', label: 'Potential budget: barrier plus interface dipole' });
