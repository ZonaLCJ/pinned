// "Given & formulas" content for every quiz question. Pure functions (no DOM), so the tests can
// check the values against the engine and work every answer out from the box alone.
//
// Each function returns
//   { given: [{ sym, html, value? }], formulas: [html], notes: [html], table?, shown }
// `given[].sym` names the quantity (used by the tests to make sure the asked-for quantity is
// never listed), `html` is what the box shows ($…$ is rendered with KaTeX), and `shown` holds
// the numbers exactly as displayed (rounded), which is what a student would calculate with.
import * as E from '../engine.js';
import { PRESETS, PRESET_FOR_SEMI, DEFAULTS } from '../../data/materials.js';
import { MOTT_SCHOTTKY, TUNNEL_DECAY_NM } from '../../data/course-data.js';
import { num, sciTex } from '../ui/format.js';

const round = (x, d) => Number(x.toFixed(d));
const eps = (epsRi) => (epsRi === 1 ? '\\varepsilon_0' : `${epsRi}\\,\\varepsilon_0`);
// 3 significant figures, but a plain power of ten stays 10^{n} (not 1.00 × 10^{n})
const ditTex = (D) => `${sciTex(D, 3).replace(/^1\.00\\times/, '')}\\ \\mathrm{cm^{-2}\\,eV^{-1}}`;

// formulas shared by several quizzes (TeX)
export const F_IDEAL = '$\\phi_{B0} = \\phi_m - \\chi$';
export const F_AVERAGE = '$\\phi_{Bn} \\approx S(\\phi_m - \\chi) + (1 - S)(E_g - \\phi_0)$';
export const F_S = '$S = \\dfrac{\\varepsilon_i}{\\varepsilon_i + e^2\\delta D_{it}}$';

/** D* = ε_i/(e²δ) in cm⁻² eV⁻¹, from the engine's constants. S = 1/(1 + D_it/D*). */
export function dStar(delta = DEFAULTS.delta, epsRi = DEFAULTS.epsRi) {
  return (epsRi * E.EPS0) / (E.Q * E.nmToM(delta)) / 1e4;
}

/** Common block: semiconductor constants and the interface (χ, E_g, φ0, E_g − φ0, S, D_it, δ, ε_i). */
function interfaceItems(p, { withS = true } = {}) {
  const S = E.gamma(p);
  const pinned = p.Eg - p.phi0;
  const items = [
    { sym: 'chi', value: p.chi, html: `$\\chi = ${num(p.chi, 2)}$ eV` },
    { sym: 'Eg', value: p.Eg, html: `$E_g = ${num(p.Eg, 2)}$ eV` },
    { sym: 'phi0', value: p.phi0, html: `$\\phi_0 = ${num(p.phi0, 2)}$ eV, so $E_0 = E_v + e\\phi_0$` },
    { sym: 'EgPhi0', value: pinned, html: `$E_g - \\phi_0 = ${num(pinned, 2)}$ eV` },
  ];
  if (withS)
    items.push({
      sym: 'S',
      value: S,
      html: `$S = ${num(S, 2)}$ (from $D_{it} = ${ditTex(p.Dit)}$, $\\delta = ${num(p.delta, 1)}$ nm, $\\varepsilon_i = ${eps(p.epsRi)}$)`,
    });
  const shown = { chi: round(p.chi, 2), Eg: round(p.Eg, 2), phi0: round(p.phi0, 2), EgPhi0: round(pinned, 2), S: round(S, 2) };
  return { items, shown };
}

// ------------------------------------------------------------------ Sign it!
/** r: a round from sign-it.js buildPool(); zero: the |E_F − E0| threshold for "neutral". */
export function signItGiven(r, zero) {
  const { p } = r;
  const { items, shown } = interfaceItems(p);
  const pv = E.pivotWorkFunction(p);
  const given = [
    { sym: 'semi', html: `n-${r.semi}, ${PRESETS[r.preset].label} preset` },
    ...items,
    { sym: 'phiM', value: r.phiM, html: `${r.metal ? r.metal : 'metal'}: $\\phi_m = ${num(r.phiM, 2)}$ eV` },
  ];
  const formulas = [F_IDEAL, F_AVERAGE];
  if (r.kind === 'sign') {
    formulas.push('$E_F - E_0 = E_g - \\phi_0 - \\phi_{Bn}$', '$Q_{ss} = -eD_{it}\\,(E_F - E_0)$');
  }
  const notes = [];
  if (r.kind === 'sign') notes.push(`If $|E_F - E_0| < ${zero}$ eV, count it as 0 (neutral).`);
  notes.push('Pivot $\\phi_m^* = \\chi + E_g - \\phi_0$: above it the real barrier is lower than ideal, below it higher.');
  return { given, formulas, notes, shown: { ...shown, phiM: round(r.phiM, 2) }, pivot: pv };
}

/** Work a Sign it! round out from the box values only. */
export function signItByHand(r, zero) {
  const g = signItGiven(r, zero).shown;
  const phiBn = g.S * (g.phiM - g.chi) + (1 - g.S) * g.EgPhi0;
  if (r.kind === 'sign') {
    const x = g.EgPhi0 - phiBn; // E_F − E0
    return x > zero ? 'neg' : x < -zero ? 'pos' : 'zero';
  }
  return phiBn < g.phiM - g.chi ? 'lower' : 'higher';
}

// ------------------------------------------------------------------ Predict and lock
export function predictGiven(p, Dit, phi1) {
  const { items, shown } = interfaceItems(p, { withS: false });
  const Ds = dStar(p.delta, p.epsRi);
  const given = [
    { sym: 'semi', html: `n-${p.semi} (${PRESETS[PRESET_FOR_SEMI[p.semi]].label} preset values)` },
    ...items,
    { sym: 'delta', value: p.delta, html: `$\\delta = ${num(p.delta, 1)}$ nm, $\\varepsilon_i = ${eps(p.epsRi)}$` },
    { sym: 'Dit', value: Dit, html: `this round: $D_{it} = ${ditTex(Dit)}$` },
    { sym: 'phiM', value: phi1, html: `$\\phi_m$: ${num(phi1, 2)} → ${num(phi1 + 1, 2)} eV` },
  ];
  const formulas = [
    `$S = \\dfrac{\\varepsilon_i}{\\varepsilon_i + e^2\\delta D_{it}} = \\dfrac{1}{1 + D_{it}/D^*}$, with $D^* = \\dfrac{\\varepsilon_i}{e^2\\delta} \\approx ${sciTex(Ds, 2)}\\ \\mathrm{cm^{-2}\\,eV^{-1}}$`,
    F_AVERAGE,
    `$\\phi_{Bn} \\le E_g$: an electron barrier can’t exceed $E_g$ (the surface inverts), so cap it there.`,
    `$\\Delta\\phi_{Bn} = \\phi_{Bn}(${num(phi1 + 1, 2)}) - \\phi_{Bn}(${num(phi1, 2)})$`,
    '$\\phi_m - \\chi = \\phi_{Bn} + \\Delta V_{ox}$',
  ];
  // D* is shown to 2 significant figures (sciTex(Ds, 2)); a student calculates with that value
  return { given, formulas, notes: [], shown: { ...shown, Dit, phi1: round(phi1, 2), dStar: Number(Ds.toPrecision(2)) } };
}

/** Δφ_Bn worked out from the box: S from D*, weighted average, capped at E_g. */
export function predictByHand(p, Dit, phi1, options) {
  const g = predictGiven(p, Dit, phi1).shown;
  const S = 1 / (1 + Dit / g.dStar);
  const b = (phiM) => Math.min(g.Eg, S * (phiM - g.chi) + (1 - S) * g.EgPhi0);
  const dB = b(g.phi1 + 1) - b(g.phi1);
  return options.reduce((a, c) => (Math.abs(c - dB) < Math.abs(a - dB) ? c : a));
}

// ------------------------------------------------------------------ Mission
export function missionGiven(rd, p, target) {
  const ideal = rd.preset === 'ideal';
  const { items, shown } = interfaceItems(p, { withS: !ideal });
  const given = [
    { sym: 'semi', html: ideal ? `ideal contact with ${p.semi}’s $\\chi$ and $E_g$` : `n-${p.semi}, ${PRESETS[rd.preset].label} preset` },
    ...(ideal ? items.slice(0, 2) : items),
    ...(ideal ? [{ sym: 'S', value: 1, html: '$S = 1$ (no interface states)' }] : []),
    { sym: 'target', value: target, html: `target: $\\phi_{Bn} \\le ${num(target, 2)}$ eV` },
    { sym: 'metals', html: 'the metals’ $\\phi_m$ are on the buttons' },
  ];
  const formulas = ideal ? ['$\\phi_{Bn} = \\phi_m - \\chi$, capped at $E_g$'] : [F_AVERAGE];
  const notes = [`Solve $\\phi_{Bn} \\le ${num(target, 2)}$ eV for $\\phi_m$.`];
  return { given, formulas, notes, shown: ideal ? { ...shown, S: 1 } : shown };
}

/** The metals that reach the target, worked out from the box values. */
export function missionByHand(rd, p, target, metals) {
  const g = missionGiven(rd, p, target).shown;
  const ideal = rd.preset === 'ideal';
  return metals
    .filter((m) => {
      const b = ideal ? Math.min(g.Eg, m.phiM - g.chi) : g.S * (m.phiM - g.chi) + (1 - g.S) * g.EgPhi0;
      return b <= target;
    })
    .map((m) => m.id);
}

// ------------------------------------------------------------------ Build a contact
export const BC_SEMIS = ['Si', 'GaAs'];
export const BC_ND = [1e16, 1e17, 1e18, 1e19];

/** p(semi, extra): params of the quiz's own state for that semiconductor (preset interface). */
export function buildContactGiven(p, target, example) {
  const rows = BC_SEMIS.map((id) => {
    const q = p(id);
    return {
      id,
      chi: q.chi,
      Eg: q.Eg,
      phi0: q.phi0,
      Dit: q.Dit,
      S: E.gamma(q),
      Astar: q.Astar,
      prefactor: E.KB / (q.Astar * q.T),
      mTunnel: q.mTunnel,
      epsRs: q.epsRs,
      e0p: BC_ND.map((Nd) => E.E0prime({ ...q, Nd })),
    };
  });
  const q0 = p('Si');
  const given = [
    { sym: 'consts', html: `$\\delta = ${num(q0.delta, 1)}$ nm, $\\varepsilon_i = ${eps(q0.epsRi)}$, $\\lambda = ${DEFAULTS.lambda}$ nm, $\\kappa = ${DEFAULTS.kappa}$ nm⁻¹, $T = ${q0.T}$ K` },
    { sym: 'target', value: target, html: `target: $\\rho_c < ${sciTex(target, 1)}$ Ω·cm²` },
  ];
  const table = {
    head: ['', ...rows.map((r) => r.id)],
    rows: [
      ['$\\chi$ (eV)', ...rows.map((r) => num(r.chi, 2))],
      ['$E_g$ (eV)', ...rows.map((r) => num(r.Eg, 2))],
      ['$\\phi_0$ (eV)', ...rows.map((r) => num(r.phi0, 2))],
      ['$D_{it}$ (cm⁻² eV⁻¹)', ...rows.map((r) => `$${sciTex(r.Dit, 3)}$`)],
      ['$S$', ...rows.map((r) => num(r.S, 2))],
      ['$A^*$ (A cm⁻² K⁻²)', ...rows.map((r) => String(r.Astar))],
      ['$k_B/(A^*T)$ (Ω·cm²)', ...rows.map((r) => `$${sciTex(r.prefactor, 3)}$`)],
      ['$m^*_t$ ($m_0$)', ...rows.map((r) => String(r.mTunnel))],
      ['$\\varepsilon_{r,s}$', ...rows.map((r) => String(r.epsRs))],
      ...BC_ND.map((Nd, k) => [`$E_0'$ at $N_d = ${sciTex(Nd, 1)}$ (meV)`, ...rows.map((r) => num(r.e0p[k] * 1000, 1))]),
    ],
  };
  const formulas = [
    '$D_{it,\\mathrm{eff}} = D_{it}\\,e^{-t/\\lambda}$',
    '$S_{\\mathrm{eff}} = \\dfrac{\\varepsilon_i}{\\varepsilon_i + e^2\\delta D_{it,\\mathrm{eff}}}$',
    '$\\phi_{Bn} \\approx S_{\\mathrm{eff}}(\\phi_m - \\chi) + (1 - S_{\\mathrm{eff}})(E_g - \\phi_0)$',
    "$E_{00} = \\dfrac{\\hbar}{2}\\sqrt{\\dfrac{N_d}{m^*_t\\,\\varepsilon_s}}$, and $E_0' = E_{00}\\coth(E_{00}/kT)$",
    "$\\rho_c = \\dfrac{k_B}{A^*T}\\,\\exp\\!\\left(\\dfrac{\\phi_{Bn}}{E_0'}\\right) e^{2\\kappa t}$",
  ];
  const notes = [
    `The live readout uses the full solver, which also keeps the depletion charge. At $N_d \\ge 10^{18}$ cm⁻³ its $\\phi_{Bn}$ is noticeably lower than this formula (e.g. ${example.label} at $${sciTex(example.Nd, 1)}$: ${num(example.full, 2)} vs ${num(example.formula, 2)} eV). Use the formula for reasoning and the readout for the score.`,
  ];
  return { given, table, formulas, notes, rows };
}

// ------------------------------------------------------------------ Myth or fact
/** One "Useful relation" per card (by myth id). None of them states the verdict. */
export const MYTH_RELATIONS = {
  1: '$W = \\sqrt{2\\varepsilon_s V_{bi}/(eN_d)}$, and $S = \\varepsilon_i/(\\varepsilon_i + e^2\\delta D_{it})$',
  2: `Metal wavefunctions at gap energies decay as $\\psi \\propto e^{-x/${TUNNEL_DECAY_NM}\\,\\mathrm{nm}}$ into the semiconductor.`,
  3: `$\\phi_{Bn} \\approx S(\\phi_m - \\chi) + (1 - S)(E_g - \\phi_0)$; measured $S \\approx ${MOTT_SCHOTTKY.Si.slope}$ (Si) and $${MOTT_SCHOTTKY.GaAs.slope}$ (GaAs).`,
  4: 'At the interface $E_c - E_F = \\phi_{Bn}$; in the bulk $E_c - E_F = \\phi_n = (kT/e)\\ln(N_c/N_d)$.',
  5: `$D_{it,\\mathrm{eff}} = D_{it}\\,e^{-t/\\lambda}$, $\\lambda = ${DEFAULTS.lambda}$ nm; tunnelling penalty $e^{2\\kappa t}$.`,
};
export const mythGiven = (id) => ({ given: [], formulas: [], notes: [], relation: MYTH_RELATIONS[id] });

