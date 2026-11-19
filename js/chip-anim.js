// Animation 1: "From chip to band diagram".
// Stages: 1 chip → transistor, 2 current flows, 3 zoom into one contact (band diagram),
// 4 pick a metal (Ideal / Real Si / Real GaAs), 5 apply the fixes (toy contact model).
// Variant 'fixes' shows stage 5 only (Section 4, "Back to the chip").
//
// Honesty rules: electron flow rate ∝ log10(contact current), current ∝ 1/ρ_c from the
// engine, clamped to a visible range and labelled illustrative; the numeric ratio is shown
// next to it; no absolute transistor currents and no transistor Ω·µm values.
import { h, prefersReducedMotion } from './ui/dom.js';
import * as E from './engine.js';
import { stateFor } from './state.js';
import { METALS, metalById, CHIP } from '../data/materials.js';
import { createPlot, rect, line, circle, text, path } from './plots/svg.js';
import { drawBand } from './plots/band.js';
import { num, sci } from './ui/format.js';

export const STAGES = [
  { n: 1, short: 'Chip', title: 'Chip to transistor' },
  { n: 2, short: 'Current', title: 'Current flows' },
  { n: 3, short: 'Contact', title: 'Zoom into one contact' },
  { n: 4, short: 'Metal', title: 'Pick a metal' },
  { n: 5, short: 'Fixes', title: 'Apply the fixes' },
];

const AL = metalById(CHIP.metal).phiM;
const XMAX = 400e-9; // fixed band-diagram depth in stages 3–4 (the whole 1e16 depletion region)
const XMAX5 = 30e-9; // stage 5 window: the 1e16 barrier fills it, the 1e19 barrier is a thin spike
const LOG_MIN = -7; // flow meter: log10 of contact current (1/ρ_c in Ω⁻¹cm⁻²), clamped
const LOG_MAX = 7;
const R_MIN = 0.4; // electrons per second at the bottom of the meter
const R_MAX = 12;
const TR_RATE = 4; // stage 2 (illustrative, no number shown)
const SPLIT = 0.72; // band particles: fraction of the path spent in the semiconductor

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const smooth = (a, b, u) => {
  const t = clamp((u - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ratioStr = (x) => `×${sci(x, 2, { dropOne: false, compact: true })}`;

export const chipStart = (stage = 1) => ({ stage, u: 0, mode: 'si', phiM: AL, Nd: CHIP.NdStart, t: 0 });

/** Physics for a chip state. Every number comes from the engine. */
export function chipPhysics(c) {
  const mode = c.stage === 4 ? c.mode : 'si';
  const semi = mode === 'gaas' ? 'GaAs' : 'Si';
  const preset = mode === 'ideal' ? 'ideal' : mode === 'gaas' ? 'gaas' : 'si';
  const phiM = c.stage === 4 ? c.phiM : AL;
  const Nd = c.stage === 5 ? c.Nd : CHIP.NdStart;
  const t = c.stage === 5 ? c.t : 0;
  const p = E.makeParams(stateFor(preset, semi, { phiM, Nd }));
  const cr = E.contactResistivity(p, { t });
  const rhoIdeal = E.contactResistivity(E.makeParams(stateFor('ideal', semi, { phiM, Nd })), { t: 0 }).rhoC;
  const rhoStart = E.contactResistivity(E.makeParams(stateFor('si', 'Si', { phiM: AL, Nd: CHIP.NdStart })), { t: 0 }).rhoC;
  const frac = clamp((Math.log10(1 / cr.rhoC) - LOG_MIN) / (LOG_MAX - LOG_MIN), 0, 1);
  // Illustrative tunnelling share: grows once E00 approaches kT (thermionic-field regime).
  const tunnel = clamp((cr.E00 / E.thermalVoltage(p.T) - 0.5) / 0.7, 0, 1);
  return {
    mode,
    semi,
    phiM,
    Nd,
    t,
    pe: { ...p, Dit: cr.DitEff },
    res: cr.res,
    phiBn: cr.phiBn,
    rhoC: cr.rhoC,
    vsIdeal: rhoIdeal / cr.rhoC, // contact current relative to the ideal contact (same metal)
    vsStart: rhoStart / cr.rhoC, // contact current relative to pinned Si/Al at the start dose
    frac,
    rate: R_MIN + (R_MAX - R_MIN) * frac,
    tunnel,
  };
}

/** Summary numbers for captions and tests. */
export function chipFacts() {
  const si = METALS.map((m) => ({ id: m.id, b: E.barrier(E.makeParams(stateFor('si', 'Si', { phiM: m.phiM, Nd: CHIP.NdStart }))) }));
  const ga = METALS.map((m) => E.barrier(E.makeParams(stateFor('gaas', 'GaAs', { phiM: m.phiM, Nd: CHIP.NdStart }))));
  const lowest = si.reduce((a, b) => (b.b < a.b ? b : a));
  return {
    lowest,
    floor: Math.floor(lowest.b * 100) / 100,
    gaMin: Math.min(...ga),
    gaMax: Math.max(...ga),
    ideal: chipPhysics({ ...chipStart(4), mode: 'ideal' }),
    real: chipPhysics({ ...chipStart(4), mode: 'si' }),
    start5: chipPhysics(chipStart(5)),
    heavy: chipPhysics({ ...chipStart(5), Nd: CHIP.NdHeavy }),
    inter: chipPhysics({ ...chipStart(5), Nd: CHIP.NdHeavy, t: CHIP.tInterlayer }),
  };
}

// ------------------------------------------------------------------ geometry
function trGeom(w, H) {
  const L = w * 0.04;
  const R = w * 0.96;
  const T = H * 0.12;
  const B = H * 0.97;
  const Wt = R - L;
  const Ht = B - T;
  const ys = T + 0.42 * Ht; // silicon surface
  const X = (f) => L + f * Wt;
  const src = { x0: X(0.04), x1: X(0.33), y0: ys, y1: ys + 0.3 * Ht };
  const drn = { x0: X(0.67), x1: X(0.96), y0: ys, y1: ys + 0.3 * Ht };
  const sc = { x0: X(0.08), x1: X(0.26), y0: T + 0.05 * Ht, y1: ys };
  const dc = { x0: X(0.74), x1: X(0.92), y0: T + 0.05 * Ht, y1: ys };
  const ox = { x0: X(0.35), x1: X(0.65), y0: ys - Math.max(10, 0.04 * Ht), y1: ys };
  const gate = { x0: X(0.37), x1: X(0.63), y0: T + 0.1 * Ht, y1: ox.y0 };
  const scx = (sc.x0 + sc.x1) / 2;
  const dcx = (dc.x0 + dc.x1) / 2;
  const pts = [
    [scx, sc.y0 + 12],
    [scx, ys],
    [scx, ys + 0.16 * Ht],
    [X(0.35), ys + 7],
    [X(0.65), ys + 7],
    [dcx, ys + 0.16 * Ht],
    [dcx, ys],
    [dcx, dc.y0 + 12],
  ];
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = seg[seg.length - 1];
  return { L, R, T, B, Wt, Ht, ys, src, drn, sc, dc, ox, gate, scx, dcx, pts, seg, total, sIf1: seg[1] / total, sIf2: seg[6] / total };
}

function pointAt(g, s) {
  const d = s * g.total;
  let i = 1;
  while (i < g.seg.length - 1 && g.seg[i] < d) i++;
  const f = (d - g.seg[i - 1]) / (g.seg[i] - g.seg[i - 1] || 1);
  const a = g.pts[i - 1];
  const b = g.pts[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// Electrons slow down at the two metal contacts: with a constant flux they bunch up there.
const trSpeed = (g, s) => 0.24 * (1 - 0.85 * Math.exp(-(((s - g.sIf1) / 0.04) ** 2)) - 0.85 * Math.exp(-(((s - g.sIf2) / 0.04) ** 2)));

// ------------------------------------------------------------------ drawing
function drawChipDie(w, H, u, st) {
  const D = Math.min(w * 0.62, H * 0.82);
  const x0 = (w - D) / 2;
  const y0 = (H - D) / 2 + H * 0.04;
  const n = 6;
  const gap = D * 0.025;
  const cell = (D - gap * (n + 1)) / n;
  const target = { r: 2, c: 3 };
  const tx = x0 + gap + target.c * (cell + gap) + cell / 2;
  const ty = y0 + gap + target.r * (cell + gap) + cell / 2;
  const zu = ease(clamp(u / 0.85, 0, 1));
  const k = 1 + 11 * zu * zu;
  const qx = tx + (w / 2 - tx) * zu;
  const qy = ty + (H / 2 - ty) * zu;
  const fills = ['#c7cbe6', '#dadDF5', '#eef0ff', '#919cff', '#e3e6f7'];
  let cells = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const f = fills[(r * 7 + c * 3 + ((r * c) % 4)) % fills.length];
      const hit = r === target.r && c === target.c;
      cells += rect(x0 + gap + c * (cell + gap), y0 + gap + r * (cell + gap), cell, cell, { fill: hit ? 'var(--surface)' : f, stroke: hit ? 'var(--brand-ink)' : 'none', 'stroke-width': hit ? 3 : 0, rx: 3 });
    }
  const dieOp = 1 - smooth(0.55, 0.9, u);
  let s = `<g opacity="${dieOp.toFixed(3)}" transform="translate(${qx} ${qy}) scale(${k}) translate(${-tx} ${-ty})">`;
  s += rect(x0, y0, D, D, { fill: '#e8eaf8', stroke: 'var(--text)', 'stroke-width': 3, rx: 8 });
  s += cells + '</g>';
  const lblOp = 1 - smooth(0.05, 0.3, u);
  s += `<g opacity="${lblOp.toFixed(3)}">${text(x0, y0 - st.label * 0.8, 'chip die', { cls: 'strong' })}${text(tx + cell * 0.8, ty, 'one transistor', { cls: 'ink strong halo' })}</g>`;
  return s;
}

function drawTransistor(w, H, st, parts, { flow = true } = {}) {
  const g = trGeom(w, H);
  const R = (b, a) => rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, a);
  let s = '';
  s += rect(g.L, g.ys, g.R - g.L, g.B - g.ys, { fill: 'var(--c-valence-fill)', stroke: 'var(--border)', 'stroke-width': 2 });
  s += R(g.src, { fill: 'var(--brand-tint)', stroke: 'var(--brand)', 'stroke-width': 3, rx: 4 });
  s += R(g.drn, { fill: 'var(--brand-tint)', stroke: 'var(--brand)', 'stroke-width': 3, rx: 4 });
  s += rect(g.src.x1, g.ys, g.drn.x0 - g.src.x1, 10, { fill: 'var(--brand)', opacity: flow ? 0.45 : 0.2 });
  s += R(g.ox, { fill: '#fbf6e9', stroke: 'var(--text-muted)', 'stroke-width': 2 });
  s += R(g.gate, { fill: 'var(--c-metal)', stroke: 'var(--text)', 'stroke-width': 3, rx: 3 });
  s += R(g.sc, { fill: 'var(--c-metal)', stroke: 'var(--text)', 'stroke-width': 3, rx: 3 });
  s += R(g.dc, { fill: 'var(--c-metal)', stroke: 'var(--text)', 'stroke-width': 3, rx: 3 });
  // the two metal–semiconductor interfaces
  s += line(g.sc.x0, g.ys, g.sc.x1, g.ys, { stroke: 'var(--brand-ink)', 'stroke-width': 5 });
  s += line(g.dc.x0, g.ys, g.dc.x1, g.ys, { stroke: 'var(--brand-ink)', 'stroke-width': 5 });
  // labels
  const lab = (x, y, t, cls = 'strong', anchor = 'middle') => text(x, y, t, { anchor, cls: `${cls} halo` });
  s += lab((g.sc.x0 + g.sc.x1) / 2, (g.sc.y0 + g.sc.y1) / 2, 'metal');
  s += lab((g.dc.x0 + g.dc.x1) / 2, (g.dc.y0 + g.dc.y1) / 2, 'metal');
  s += lab((g.gate.x0 + g.gate.x1) / 2, (g.gate.y0 + g.gate.y1) / 2, 'gate');
  s += lab(g.ox.x1 + 8, g.ox.y0 - st.label * 0.55, 'oxide', 'muted strong', 'start');
  s += lab((g.src.x0 + g.src.x1) / 2, g.src.y1 - st.label * 0.7, 'source');
  s += lab((g.drn.x0 + g.drn.x1) / 2, g.drn.y1 - st.label * 0.7, 'drain');
  s += lab(w / 2, g.ys + 10 + st.label * 0.85, 'channel', 'ink strong');
  s += lab(w / 2, g.B - st.label * 0.7, 'p-Si substrate', 'muted');
  s += lab((g.dc.x0 + g.dc.x1) / 2, g.sc.y0 - st.label * 0.7, 'metal contact', 'ink strong');
  s += lab((g.sc.x0 + g.sc.x1) / 2, g.sc.y0 - st.label * 0.7, 'metal contact', 'ink strong');
  for (const p of parts || []) {
    const [x, y] = pointAt(g, p.s);
    s += circle(x, y, 6, { fill: 'var(--c-neg)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
  }
  return { s, g };
}

function bandParticles(gm, parts) {
  const n = gm.prof.xs.length - 1;
  const ecAt = (x) => gm.Ec[clamp(Math.round((x / gm.prof.xMax) * n), 0, n)];
  let s = '';
  for (const p of parts) {
    let X;
    let Y;
    let op = 1;
    if (p.s < SPLIT) {
      const x = gm.prof.xMax * (1 - p.s / SPLIT);
      const En = p.tun ? gm.EcBulk + p.eps : Math.max(ecAt(x), gm.EcBulk) + p.eps;
      X = gm.xs(x);
      Y = gm.y(En);
    } else {
      const f = (p.s - SPLIT) / (1 - SPLIT);
      const E0 = p.tun ? gm.EcBulk + p.eps : gm.Ec[0] + p.eps;
      const En = E0 + (-0.08 - E0) * Math.min(1, f * 1.6);
      X = gm.x0 + (gm.box.l + 8 - gm.x0) * f;
      Y = gm.y(En);
      op = f > 0.7 ? (1 - f) / 0.3 : 1;
    }
    s += circle(X, Y, 6, { fill: 'var(--c-neg)', stroke: 'var(--surface)', 'stroke-width': 1.5, opacity: op.toFixed(2) });
  }
  return s;
}

function drawMeter(w, y0, st, c, ph) {
  let s = '';
  const ly = y0 + st.label * 0.75;
  s += text(4, ly, 'electron flow (log scale, illustrative)', { cls: 'muted strong' });
  let r;
  if (c.stage === 5) r = `current ${ratioStr(ph.vsStart)} vs start`;
  else if (ph.mode === 'ideal') r = 'ideal contact (reference)';
  else r = `current ${ratioStr(ph.vsIdeal)} vs ideal`;
  const by = y0 + st.label * 1.55;
  const bw = w - 8;
  s += rect(4, by, bw, 20, { fill: 'var(--brand-tint)', stroke: 'var(--border)', 'stroke-width': 1.5, rx: 10 });
  s += rect(4, by, Math.max(20, bw * ph.frac), 20, { fill: 'var(--brand)', stroke: 'var(--brand-ink)', 'stroke-width': 2, rx: 10 });
  s += text(w - 4, ly, r, { anchor: 'end', cls: 'ink strong' });
  return s;
}

function drawScene(ctx, d) {
  const { w, h, st } = ctx;
  const { c, ph } = d;
  const meter = c.stage >= 4;
  const titleH = st.label * 1.5;
  const mH = meter ? st.label * 1.6 + 30 : 0;
  const H0 = titleH;
  const H = h - titleH - mH;
  const stg = STAGES[c.stage - 1];
  let s = '';
  s += text(4, st.label * 0.7, d.variant === 'fixes' ? 'Back to the chip' : `${stg.n} · ${stg.title}`, { cls: 'strong' });
  if (c.stage <= 3) s += text(w - 4, st.label * 0.7, 'simplified, not to scale', { anchor: 'end', cls: 'muted' });
  else if (c.stage === 5) s += text(w - (d.variant === 'fixes' ? 52 : 4), st.label * 0.7, `ρ_{c} = ${sci(ph.rhoC, 2, { dropOne: false, compact: true })} Ω·cm²`, { anchor: 'end', cls: 'ink strong' });
  s += `<g transform="translate(0 ${H0})">`;
  if (c.stage === 1) {
    s += drawChipDie(w, H, c.u, st);
    const op = smooth(0.62, 1, c.u);
    if (op > 0) s += `<g opacity="${op.toFixed(3)}">${drawTransistor(w, H, st, [], { flow: false }).s}</g>`;
  } else if (c.stage === 2) {
    const t = drawTransistor(w, H, st, d.tr);
    if (d.geomRef) d.geomRef.g = t.g;
    s += t.s;
  } else {
    const bandOp = c.stage === 3 ? smooth(0.45, 0.9, c.u) : 1;
    if (c.stage === 3 && c.u < 0.75) {
      const g = trGeom(w, H);
      const zu = ease(clamp(c.u / 0.65, 0, 1));
      const k = 1 + 5 * zu;
      const qx = g.dcx + (w / 2 - g.dcx) * zu;
      const qy = g.ys + (H / 2 - g.ys) * zu;
      const op = 1 - smooth(0.35, 0.7, c.u);
      s += `<g opacity="${op.toFixed(3)}" transform="translate(${qx} ${qy}) scale(${k}) translate(${-g.dcx} ${-g.ys})">${drawTransistor(w, H, st, [], { flow: true }).s}</g>`;
    }
    if (bandOp > 0) {
      const sub = { w, h: H, st, uid: ctx.uid };
      const band = drawBand(sub, {
        p: ph.pe,
        res: ph.res,
        opts: { vac: false, bare: true, W: false, arrows: false, xMax: c.stage === 5 ? XMAX5 : XMAX, overlay: (gm) => bandParticles(gm, d.band) },
      });
      s += `<g opacity="${bandOp.toFixed(3)}">${band}</g>`;
      if (c.stage === 5 && ph.t > 0) s += text(w * 0.32, st.label * 0.8, `+ ${num(ph.t, 2)} nm interlayer (toy model)`, { cls: 'ink strong halo' });
    }
  }
  s += '</g>';
  if (meter) s += drawMeter(w, h - mH + 2, st, c, ph);
  return s;
}

// ------------------------------------------------------------------ scripts
function stageSteps(F) {
  const live = (s) => {
    const ph = chipPhysics(s.chip);
    return `φ<sub>Bn</sub> = ${num(ph.phiBn, 2)} eV`;
  };
  const set = (patch) => (u, s) => ({ chip: { ...s.chip, ...patch(u, s) } });
  const gaSeq = ['Al', 'Ti', 'Cr', 'Au', 'Pt'].map((id) => metalById(id).phiM);
  const ratioLive = (s) => {
    const ph = chipPhysics(s.chip);
    return `${metalAt(ph.phiM)}: φ<sub>Bn</sub> = ${num(ph.phiBn, 2)} eV · current ${ratioStr(ph.vsIdeal)} vs ideal`;
  };
  const rhoLive = (s) => {
    const ph = chipPhysics(s.chip);
    return `N<sub>d</sub> = ${sci(ph.Nd, 1)} cm⁻³ · ρ<sub>c</sub> = ${sci(ph.rhoC, 2, { dropOne: false, compact: true })} Ω·cm² (${ratioStr(ph.vsStart)} vs start)`;
  };
  return [
    { stage: 1, dur: 4000, caption: 'Chip → transistor (simplified, not to scale)', live: () => 'zooming into one transistor', update: set((u) => ({ stage: 1, u })) },
    { stage: 2, dur: 4000, caption: 'Electrons flow source → channel → drain', live: () => 'they bunch up at each metal contact and trickle through', update: set((u) => ({ stage: 2, u })) },
    {
      stage: 3,
      dur: 3500,
      caption: 'Zoom into one contact: metal | n-Si',
      live: (s) => `the barrier they were hitting: ${live(s)}`,
      update: set((u) => ({ stage: 3, u })),
    },
    {
      stage: 4,
      dur: 1600,
      caption: 'Ideal contact (δ = 0, D<sub>it</sub> = 0), Al',
      live: (s) => `${live(s)} · electrons pour through`,
      update: set(() => ({ stage: 4, u: 1, mode: 'ideal', phiM: AL })),
    },
    {
      stage: 4,
      dur: 1900,
      caption: `Real Si: no Table 9.1 metal gets below ${num(F.floor, 2)} eV`,
      live: ratioLive,
      update: set(() => ({ stage: 4, u: 1, mode: 'si', phiM: AL })),
    },
    {
      stage: 4,
      dur: 1700,
      caption: `Real GaAs: every metal lands at ${num(F.gaMin, 2)}–${num(F.gaMax, 2)} eV`,
      live: ratioLive,
      update: set((u) => ({ stage: 4, u: 1, mode: 'gaas', phiM: gaSeq[Math.min(gaSeq.length - 1, Math.floor(u * gaSeq.length))] })),
    },
    {
      stage: 5,
      dur: 2200,
      caption: 'Fix 1, heavy doping: the barrier thins, electrons tunnel',
      live: rhoLive,
      update: set((u) => ({ stage: 5, u: 1, Nd: 10 ** (Math.log10(CHIP.NdStart) + u * (Math.log10(CHIP.NdHeavy) - Math.log10(CHIP.NdStart))), t: 0 })),
    },
    {
      stage: 5,
      dur: 2200,
      caption: `Fix 2: + ${num(CHIP.tInterlayer, 2)} nm interlayer`,
      live: rhoLive,
      update: set((u) => ({ stage: 5, u: 1, Nd: CHIP.NdHeavy, t: u * CHIP.tInterlayer })),
    },
  ];
}
const metalAt = (phiM) => (METALS.find((m) => Math.abs(m.phiM - phiM) < 0.005) || { id: 'metal' }).id;

const END_MAIN = 'Pinning puts a floor under the barrier.';
const END_LIVE = 'Industry works around it with doping and interface engineering.';

export function chipScript(F, fromStage = 1, label = 'Play') {
  const steps = stageSteps(F).filter((st) => st.stage >= fromStage);
  return {
    label,
    setup: (s) => ({ chip: { ...chipStart(fromStage), ...(fromStage >= 4 ? { u: 1 } : {}) } }),
    steps,
    doneCaption: END_MAIN,
    doneLive: END_LIVE,
  };
}

// ------------------------------------------------------------------ component
/**
 * createChipAnim(root, ctx, { variant: 'full' | 'fixes' })
 * ctx: { mode, store, player, caption }. The store holds { chip: {...} }.
 * Returns { update(state), demos, leftEl, onShow, onHide }.
 */
export function createChipAnim(root, ctx, { variant = 'full' } = {}) {
  const { store, player, mode } = ctx;
  const present = mode === 'present';
  const F = chipFacts();
  const reduced = prefersReducedMotion();
  root.classList.add('chip-anim');

  // stage dots (left column in presentation, top row in detailed)
  const dots = h('div', { class: 'stage-dots', role: 'group', 'aria-label': 'Animation stages' });
  if (variant === 'full') {
    for (const stg of STAGES) {
      dots.append(
        h(
          'button',
          { type: 'button', class: 'btn stage-dot', 'aria-label': `Stage ${stg.n}: ${stg.title}`, onclick: () => player.play(chipScript(F, stg.n, `Stage ${stg.n}`)), dataset: { n: String(stg.n) } },
          h('span', { class: 'sd-n' }, String(stg.n)),
          h('span', { class: 'sd-t' }, stg.short),
        ),
      );
    }
  }

  const sceneHost = h('div', { class: 'chip-scene' });
  const capSlot = h('div', { class: 'sim-caption chip-caption' });
  if (present) capSlot.append(ctx.caption.el);
  const controls = h('div', { class: 'chip-controls' });
  root.append(...(present || variant !== 'full' ? [] : [dots]), sceneHost, capSlot, controls);
  const plot = createPlot(sceneHost, drawScene, { className: 'chip-plot', label: 'Animation: from a chip to the band diagram of one contact' });

  const setChip = (patch) => store.set({ chip: { ...store.get().chip, ...patch } }, { source: 'user' });
  // stage 4 controls
  const modeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Contact type' });
  const modes = [
    ['ideal', 'Ideal'],
    ['si', 'Real Si'],
    ['gaas', 'Real GaAs'],
  ];
  for (const [v, l] of modes) modeSeg.append(h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', dataset: { v }, onclick: () => setChip({ stage: 4, u: 1, mode: v }) }, l));
  const metalRow = h('div', { class: 'metals', role: 'group', 'aria-label': 'Metal (Table 9.1)' });
  for (const m of METALS) metalRow.append(h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', dataset: { id: m.id }, onclick: () => setChip({ stage: 4, u: 1, phiM: m.phiM }) }, m.id));
  // stage 5 controls
  const bDope = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => {
    const c = store.get().chip;
    const on = c.stage === 5 && c.Nd >= CHIP.NdHeavy * 0.999;
    setChip({ stage: 5, u: 1, Nd: on ? CHIP.NdStart : CHIP.NdHeavy, t: c.stage === 5 ? c.t : 0 });
  } }, 'Heavy doping');
  const bInter = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => {
    const c = store.get().chip;
    const on = c.stage === 5 && c.t >= CHIP.tInterlayer * 0.999;
    setChip({ stage: 5, u: 1, t: on ? 0 : CHIP.tInterlayer, Nd: c.stage === 5 ? c.Nd : CHIP.NdStart });
  } }, `+ ${num(CHIP.tInterlayer, 2)} nm interlayer`);
  const fixRow = h('div', { class: 'ctl-row fix-row' }, h('span', { class: 'ctl-label' }, 'Fixes (Real Si, Al):'), bDope, bInter);
  if (variant === 'full') controls.append(h('div', { class: 'ctl-row' }, h('span', { class: 'ctl-label' }, 'Contact:'), modeSeg), metalRow, fixRow);
  else controls.append(fixRow);

  // ---- particles
  let tr = [];
  let band = [];
  let trCredit = 0;
  let bandCredit = 0;
  let k = 0;
  const geomRef = { g: null };
  let phKey = '';
  let ph = null;
  const physics = (c) => {
    const key = `${c.stage}|${c.mode}|${c.phiM}|${c.Nd}|${c.t}`;
    if (key !== phKey) {
      phKey = key;
      ph = chipPhysics(c);
    }
    return ph;
  };
  const hash = (i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  function step(dt) {
    const c = store.get().chip;
    const P = physics(c);
    const g = geomRef.g || trGeom(plot.ctx.w || 800, (plot.ctx.h || 460) - 40);
    if (c.stage === 2 || (c.stage === 1 && c.u > 0.9)) {
      if (!tr.length) {
        // start in steady state: pre-run the flow so electrons fill the whole path
        tr.push({ s: 0 });
        for (let i = 0; i < 120; i++) {
          for (const p of tr) p.s += trSpeed(g, p.s) * 0.1;
          trCredit += TR_RATE * 0.1;
          while (trCredit >= 1) {
            trCredit -= 1;
            tr.push({ s: 0 });
          }
        }
        tr = tr.filter((p) => p.s < 1);
      }
      trCredit += TR_RATE * dt;
      while (trCredit >= 1) {
        trCredit -= 1;
        tr.push({ s: 0 });
      }
      for (const p of tr) p.s += trSpeed(g, p.s) * dt;
      tr = tr.filter((p) => p.s < 1);
    }
    if (c.stage >= 4 || (c.stage === 3 && c.u > 0.8)) {
      bandCredit += P.rate * dt;
      while (bandCredit >= 1) {
        bandCredit -= 1;
        k++;
        band.push({ s: 0, tun: hash(k) < P.tunnel, eps: 0.03 + 0.07 * hash(k + 7) });
      }
      for (const p of band) p.s += 0.3 * dt;
      band = band.filter((p) => p.s < 1);
    } else band = [];
  }
  function staticParticles(c, P) {
    // reduced motion: evenly spaced, no movement; density follows the same rate
    const n = Math.max(1, Math.round(P.rate * 1.2));
    return {
      tr: c.stage === 2 ? Array.from({ length: 10 }, (_, i) => ({ s: (i + 0.5) / 10 })) : [],
      band: c.stage >= 4 ? Array.from({ length: n }, (_, i) => ({ s: (i + 0.5) / n, tun: hash(i + 1) < P.tunnel, eps: 0.03 + 0.07 * hash(i + 8) })) : [],
    };
  }
  function draw() {
    const c = store.get().chip;
    if (!c) return;
    const P = physics(c);
    const parts = reduced ? staticParticles(c, P) : { tr, band };
    plot.update({ c, ph: P, tr: parts.tr, band: parts.band, variant, geomRef });
  }

  let raf = 0;
  let last = 0;
  let running = false;
  function loop(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!reduced && !player.paused) step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function sync(s) {
    const c = s.chip;
    if (!c) return;
    for (const b of dots.querySelectorAll('.stage-dot')) b.setAttribute('aria-current', b.dataset.n === String(c.stage) ? 'step' : 'false');
    for (const b of modeSeg.children) b.setAttribute('aria-pressed', String(c.stage === 4 && b.dataset.v === c.mode));
    for (const b of metalRow.children) b.setAttribute('aria-pressed', String(c.stage === 4 && Math.abs(metalById(b.dataset.id).phiM - c.phiM) < 0.005));
    bDope.setAttribute('aria-pressed', String(c.stage === 5 && c.Nd >= CHIP.NdHeavy * 0.999));
    bInter.setAttribute('aria-pressed', String(c.stage === 5 && c.t >= CHIP.tInterlayer * 0.999));
  }

  const demo =
    variant === 'full'
      ? { id: 'A', label: 'Play', key: 'A', title: 'the 20-second tour, stages 1–5', script: chipScript(F, 1, 'Play') }
      : { id: 'A', label: 'Play', key: 'A', title: 'heavy doping, then an interlayer', script: chipScript(F, 5, 'Fixes') };

  return {
    update(s) {
      sync(s);
      if (!running) draw();
    },
    demos: [demo],
    leftEl: variant === 'full' ? dots : null,
    facts: F,
    onShow() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    onHide() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
