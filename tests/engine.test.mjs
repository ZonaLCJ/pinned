// Engine tests (spec §5.7). Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as E from '../js/engine.js';
import { METALS, SEMICONDUCTORS, PRESET_TABLE, DEFAULTS } from '../data/materials.js';

const TOL = 0.005; // eV unless stated

function near(actual, expected, tol, msg) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`,
  );
}
function rel(actual, expected, frac, msg) {
  assert.ok(
    Math.abs(actual - expected) <= frac * Math.abs(expected),
    `${msg ?? ''} expected ${expected} ± ${frac * 100}%, got ${actual}`,
  );
}

/** Params for a preset + metal (+ overrides). Defaults: N_d = 1e16, T = 300 K, delta = 0.5 nm. */
function P(presetId, semi, metalOrPhiM, over = {}) {
  const iface = E.presetInterface(presetId, semi);
  const phiM = typeof metalOrPhiM === 'number' ? metalOrPhiM : METALS.find((m) => m.id === metalOrPhiM).phiM;
  return E.makeParams({ ...iface, semi: iface.semi, phiM, Nd: DEFAULTS.Nd, T: DEFAULTS.T, ...over });
}
const solve = (p) => E.solveBarrier(p);

test('0. presets: D_it derived from S matches the table, pivots and pinned levels', () => {
  rel(E.presetInterface('si').Dit, PRESET_TABLE.si.Dit, 0.005, 'Si D_it');
  rel(E.presetInterface('gaas').Dit, PRESET_TABLE.gaas.Dit, 0.005, 'GaAs D_it');
  near(E.pivotWorkFunction(P('si', 'Si', 'Au')), PRESET_TABLE.si.pivot, 1e-9, 'Si pivot');
  near(E.pivotWorkFunction(P('gaas', 'GaAs', 'Au')), PRESET_TABLE.gaas.pivot, 1e-9, 'GaAs pivot');
  near(E.pinnedBarrier(P('si', 'Si', 'Au')), PRESET_TABLE.si.pinned, 1e-9, 'Si pinned');
  near(E.pinnedBarrier(P('gaas', 'GaAs', 'Au')), PRESET_TABLE.gaas.pinned, 1e-9, 'GaAs pinned');
});

test('1. ideal preset: phiBn = phiM - chi exactly; Au/Si 1.09, Al/Si 0.27, Pt/GaAs inversion', () => {
  for (const semi of ['Si', 'GaAs']) {
    for (const m of METALS) {
      const p = P('ideal', semi, m.id);
      const r = solve(p);
      assert.equal(r.phiBn, m.phiM - SEMICONDUCTORS[semi].chi, `${m.id}/${semi} exact`);
      assert.equal(r.dVox, 0);
      assert.equal(r.flags.ideal, true);
    }
  }
  near(solve(P('ideal', 'Si', 'Au')).phiBn, 1.09, 1e-9, 'Au/n-Si');
  near(solve(P('ideal', 'Si', 'Al')).phiBn, 0.27, 1e-9, 'Al/n-Si');
  const pt = solve(P('ideal', 'GaAs', 'Pt'));
  assert.equal(pt.flags.inversion, true, 'Pt/n-GaAs inversion flag');
  assert.equal(pt.regime, 'inversion');
  assert.equal(solve(P('ideal', 'Si', 'Au')).regime, 'depletion');
});

test('2. Si preset barriers', () => {
  const expected = { Ag: 0.556, Al: 0.561, Ti: 0.574, Cr: 0.618, W: 0.631, Mo: 0.644, Au: 0.773, Pd: 0.778, Ni: 0.786, Pt: 0.915 };
  for (const [id, v] of Object.entries(expected)) near(solve(P('si', 'Si', id)).phiBn, v, TOL, `${id}/Si`);
});

test('3. slopes: GaAs metals 0.79-0.85 and slope 0.040; Si slope 0.258', () => {
  for (const m of METALS) {
    const b = solve(P('gaas', 'GaAs', m.id)).phiBn;
    assert.ok(b >= 0.79 && b <= 0.85, `${m.id}/GaAs ${b}`);
  }
  near(E.numericSlope(P('gaas', 'GaAs', 4), 4, 5), 0.04, 0.005, 'GaAs slope');
  near(E.numericSlope(P('si', 'Si', 4), 4, 5), 0.258, 0.005, 'Si slope');
});

test('4. gamma values', () => {
  const base = { delta: 0.5, epsRi: 1 };
  near(E.gamma({ ...base, Dit: 1e13 }), 0.525, 0.005, 'gamma(1e13)');
  near(E.gamma({ ...base, Dit: 1e14 }), 0.1, 0.005, 'gamma(1e14)');
});

test('5a. limit D_it = 1e17 gives the pinned barrier E_g - phi0', () => {
  for (const [pid, semi] of [['si', 'Si'], ['gaas', 'GaAs']]) {
    for (const m of METALS) {
      const p = P(pid, semi, m.id, { Dit: 1e17 });
      near(solve(p).phiBn, p.Eg - p.phi0, 0.01, `${m.id}/${semi}`);
    }
  }
});

test('5b. pivot invariance: analytic exact, numeric spread < 0.03 eV', () => {
  const dits = E.logRange(1e11, 1e15, 41);
  const spreads = {};
  for (const [pid, semi] of [['si', 'Si'], ['gaas', 'GaAs']]) {
    const p0 = P(pid, semi, 4.5);
    const pivot = E.pivotWorkFunction(p0);
    const analytic = dits.map((Dit) => E.analyticBarrier({ ...p0, phiM: pivot, Dit }));
    for (const a of analytic) near(a, analytic[0], 1e-12, `${semi} analytic`);
    const numeric = dits.map((Dit) => solve({ ...p0, phiM: pivot, Dit }).phiBn);
    const spread = Math.max(...numeric) - Math.min(...numeric);
    spreads[semi] = spread;
    assert.ok(spread < 0.03, `${semi} numeric spread ${spread}`);
  }
  near(spreads.Si, 0.021, 0.003, 'Si spread');
  near(spreads.GaAs, 0.028, 0.003, 'GaAs spread');
});

test('6. charges, Si preset with Au', () => {
  const r = solve(P('si', 'Si', 'Au'));
  rel(r.QscCm, 2.7e11, 0.1, 'Q_sc');
  rel(r.QssCm, 3.2e12, 0.1, 'Q_ss');
  const sum = r.Qm + r.Qss + r.Qsc;
  const scale = Math.max(Math.abs(r.Qm), Math.abs(r.Qss), Math.abs(r.Qsc));
  assert.ok(Math.abs(sum) / scale < 1e-6, `neutrality ${sum / scale}`);
});

test('7. N_d = 1e18: Q_sc exceeds |Q_ss|', () => {
  const r = solve(P('si', 'Si', 'Au', { Nd: 1e18 }));
  rel(r.QscCm, 2.9e12, 0.1, 'Q_sc');
  rel(Math.abs(r.QssCm), 1.3e12, 0.1, '|Q_ss|');
  assert.ok(r.QscCm > Math.abs(r.QssCm));
});

test('8. mission sets (phiBn <= 0.60 eV)', () => {
  const set = (pid, semi) =>
    METALS.filter((m) => solve(P(pid, semi, m.id)).phiBn <= 0.6).map((m) => m.id).sort();
  assert.deepEqual(set('ideal', 'GaAs'), ['Ag', 'Al', 'Cr', 'Mo', 'Ti', 'W']);
  assert.deepEqual(set('si', 'Si'), ['Ag', 'Al', 'Ti']);
  assert.deepEqual(set('gaas', 'GaAs'), []);
});

test('9. toy contact model, Si preset, Al', () => {
  const p18 = P('si', 'Si', 'Al', { Nd: 1e18 });
  const o18 = E.optimumThickness(p18);
  // The rho_c minimum is flat; the exact optimum is ~1.07 nm. The spec's
  // "0.51 -> 0.21 eV" is phiBn at t = 0 and at t = 1.0 nm.
  near(o18.t, 1.0, 0.1, 'optimum t at 1e18 [nm]');
  near(E.contactResistivity(p18, { t: 0 }).phiBn, 0.51, TOL, 'phiBn(t=0) at 1e18');
  near(E.contactResistivity(p18, { t: 1.0 }).phiBn, 0.21, TOL, 'phiBn(t=1.0 nm) at 1e18');
  near(E.contactResistivity(p18, { t: 3 }).phiBn, 0.17, TOL, 'phiBn(t=3) at 1e18 (S4 Demo A)');

  const p19 = P('si', 'Si', 'Al', { Nd: 1e19 });
  const o19 = E.optimumThickness(p19);
  near(o19.t, 0.75, 0.1, 'optimum t at 1e19 [nm]');
  rel(o19.rhoC, 4e-7, 0.3, 'rho_c(t_opt) at 1e19');
  rel(E.contactResistivity(p19, { t: 0 }).rhoC, 8e-5, 0.3, 'rho_c(t=0) at 1e19');
});

// ---------------------------------------------------------------- extra checks
test('extra: bulk Fermi level, degenerate flags, monotonic F, no input mutation', () => {
  const p = P('si', 'Si', 'Au');
  near(E.bulkFermi(p).phiN, 0.2052, 0.001, 'phi_n Si 1e16');
  const gaas19 = P('gaas', 'GaAs', 'Au', { Nd: 1e19 });
  const b = E.bulkFermi(gaas19);
  assert.equal(b.degenerate, true);
  assert.equal(b.phiN, 0);
  assert.equal(b.degenerateBadge, true);
  assert.equal(E.bulkFermi(P('si', 'Si', 'Au', { Nd: 1e19 })).degenerateBadge, true); // 1e19 > 0.3 * 2.8e19
  assert.equal(E.bulkFermi(P('si', 'Si', 'Au', { Nd: 1e18 })).degenerateBadge, false);

  let prev = -Infinity;
  for (const x of E.rangeArray(0.21, 1.12, 200)) {
    const f = E.chargeResidual(p, x);
    assert.ok(f > prev, 'F strictly increasing');
    prev = f;
  }
  const frozen = Object.freeze({ ...p });
  E.solveBarrier(frozen);
  E.contactResistivity(frozen, { t: 1 });
  E.optimumThickness(frozen);
});

test('extra: ohmic regime flag', () => {
  const r = solve(P('si', 'Si', 3.5, { Dit: 1e11 }));
  assert.equal(r.flags.ohmic, true);
  assert.equal(r.phiBn, r.phiN);
});

test('extra: analytic form, numeric solver agree when Q_sc is small', () => {
  const p = P('si', 'Si', 'Au');
  const a = E.analyticBarrier(p);
  const n = solve(p).phiBn;
  assert.ok(a > n && a - n < 0.01, `analytic ${a} vs numeric ${n}`);
});

test('extra: C–V intercept recovers V_bi and phiBn', () => {
  const p = P('si', 'Si', 'Au');
  const { points, truth } = E.simulateCV(p, { noise: 0 });
  const line = E.fitLine(points.map((d) => d.VR), points.map((d) => d.yTrue));
  const out = E.barrierFromCVLine(line, truth.phiN);
  near(out.Vbi, truth.Vbi, 1e-9, 'V_bi');
  near(out.phiBn, truth.phiBn, 1e-9, 'phiBn');
  const noisy = E.simulateCV(p, { noise: 0.01, seed: 7 });
  for (const d of noisy.points) assert.ok(Math.abs(d.y / d.yTrue - 1) <= 0.01 + 1e-12);
});

test('extra: E00 for Si at 1e18 is about 10.6 meV', () => {
  near(E.E00(P('si', 'Si', 'Al', { Nd: 1e18 })), 0.0106, 0.0003, 'E00');
});

// ======================================================================
// Animation 1 ("From chip to band diagram"): Al, N_d = 1e16 unless stated.
import { MOS, MOS_PRESETS, CHIP } from '../data/materials.js';

const rho = (p, t = 0) => E.contactResistivity(p, { t }).rhoC;

test('A1. stage 4: ideal vs real Si (Al); no Table 9.1 metal below ~0.55 eV; GaAs 0.79–0.85', () => {
  const ideal = P('ideal', 'Si', CHIP.metal, { Nd: CHIP.NdStart });
  const real = P('si', 'Si', CHIP.metal, { Nd: CHIP.NdStart });
  assert.equal(solve(ideal).phiBn, ideal.phiM - ideal.chi, 'ideal Al exactly φm − χ');
  near(solve(ideal).phiBn, 0.27, 1e-9, 'ideal Al 0.27 eV');
  near(solve(real).phiBn, 0.56, TOL, 'real Si Al');
  // contact current ∝ 1/ρ_c: real/ideal ≈ 1.3e-5, i.e. a drop of about 8e4 (roughly 1e5)
  const ratio = rho(ideal) / rho(real);
  rel(ratio, 1.3e-5, 0.02, 'current ratio real/ideal');
  assert.ok(1 / ratio > 7e4 && 1 / ratio < 9e4, `drop ${1 / ratio}`);
  const bs = METALS.map((m) => solve(P('si', 'Si', m.id)).phiBn);
  near(Math.min(...bs), 0.556, TOL, 'lowest Si-preset barrier (Ag)');
  assert.ok(Math.min(...bs) > 0.55, 'no metal below 0.55 eV');
  for (const m of METALS) {
    const b = solve(P('gaas', 'GaAs', m.id)).phiBn;
    assert.ok(b >= 0.79 && b <= 0.85, `${m.id}/GaAs ${b}`);
  }
});

test('A1. stage 5: heavy doping, then a 0.75 nm interlayer (Real Si, Al)', () => {
  const start = rho(P('si', 'Si', CHIP.metal, { Nd: CHIP.NdStart }));
  const heavy = rho(P('si', 'Si', CHIP.metal, { Nd: CHIP.NdHeavy }));
  const inter = rho(P('si', 'Si', CHIP.metal, { Nd: CHIP.NdHeavy }), CHIP.tInterlayer);
  rel(start, 6.8, 0.02, 'ρc at 1e16');
  rel(heavy, 7.8e-5, 0.02, 'ρc at 1e19');
  assert.ok(start / heavy > 5e4 && start / heavy < 2e5, `heavy-doping gain ${start / heavy} (roughly 1e5)`);
  rel(inter, 3.9e-7, 0.02, 'ρc at 1e19 + 0.75 nm');
  rel(heavy / inter, 200, 0.02, 'interlayer gain (about 200x)');
});

// ======================================================================
// Animation 2 ("The gate that can't switch"): MOS gate with interface states.
const mos = (Dit) => ({ ...MOS, Dit });

test('A2. MOS basics: C_ox, phi_F, presets', () => {
  rel(E.mosCox(mos(0)), 3.45e-3, 0.005, 'C_ox');
  near(E.mosPhiF(mos(0)), 0.406, 0.001, 'phi_F');
  assert.deepEqual(MOS_PRESETS.map((p) => p.Dit), [1e10, 1e12, 1e14]);
  // V_G increases monotonically with psi_s over the bisection bracket
  let prev = -Infinity;
  for (const psi of E.rangeArray(-0.5, 1.2, 300)) {
    const v = E.mosVG(mos(1e12), psi);
    assert.ok(v > prev, 'V_G(psi) increasing');
    prev = v;
  }
  // inversion of the solver
  for (const VG of [-2, -0.5, 0.7, 1.5, 3]) near(E.mosVG(mos(1e12), E.mosPsi(mos(1e12), VG)), VG, 1e-6, `V_G round trip ${VG}`);
});

test('A2. MOS threshold V_G (psi_s = 2 phi_F = 0.812 V), ±2 %', () => {
  near(2 * E.mosPhiF(mos(0)), 0.812, 0.001, '2 phi_F');
  rel(E.mosThreshold(mos(1e10)), 1.29, 0.02, 'D_it 1e10');
  rel(E.mosThreshold(mos(1e12)), 1.48, 0.02, 'D_it 1e12');
  rel(E.mosThreshold(mos(1e13)), 3.17, 0.02, 'D_it 1e13');
  rel(E.mosThreshold(mos(1e14)), 20.1, 0.02, 'D_it 1e14');
});

test('A2. MOS dpsi_s/dV_G between 1 and 2 V at D_it = 1e14 is 0.021 (±2 %)', () => {
  const m = mos(1e14);
  const slope = E.mosPsi(m, 2) - E.mosPsi(m, 1);
  rel(slope, 0.021, 0.02, 'numeric slope');
  rel(E.mosSolve(m, 1.5).slopeEstimate, slope, 0.02, 'C_ox/(C_ox + C_s + q D_it) agrees');
  // breakdown: 10 MV/cm on 10 nm is about 10 V, so the 1e14 threshold is about twice that
  const VBD = MOS.breakdownMVcm * 1e8 * MOS.tox * 1e-9;
  near(VBD, 10, 1e-9, 'breakdown voltage');
  near(E.mosThreshold(m) / VBD, 2, 0.05, 'about twice breakdown');
});

// ======================================================================
// Partner features: Ge, GaN, p-type, temperature, J–V (T = 300 K, delta = 0.5 nm, 1e16 cm^-3)
const pt = (pr, semi, m, over = {}) => P(pr, semi, m, { doping: 'p', ...over });

test('B1. Si p-type: Al, Au, Pt; slope −0.258; phi_Bn + phi_Bp ≈ E_g', () => {
  near(solve(pt('si', 'Si', 'Al')).phiBp, 0.549, TOL, 'Al');
  near(solve(pt('si', 'Si', 'Au')).phiBp, 0.337, TOL, 'Au');
  near(solve(pt('si', 'Si', 'Pt')).phiBp, 0.197, TOL, 'Pt');
  near(E.numericSlope(pt('si', 'Si', 4), 4, 5), -0.258, 0.005, 'slope');
  near(solve(P('si', 'Si', 'Al')).phiBn + solve(pt('si', 'Si', 'Al')).phiBp, 1.11, 0.01, 'sum for Al');
  const r = solve(pt('si', 'Si', 'Al'));
  const scale = Math.max(Math.abs(r.Qm), Math.abs(r.Qss), Math.abs(r.Qsc));
  assert.ok(Math.abs(r.Qm + r.Qss + r.Qsc) / scale < 1e-6, 'neutrality');
  assert.ok(r.Qsc < 0, 'acceptor depletion charge is negative');
  // ideal p-type: E_g + chi - phi_m exactly
  const id = pt('ideal', 'Si', 'Al');
  assert.equal(solve(id).phiBp, id.Eg + id.chi - id.phiM);
});

test('B2. GaAs p-type: Al 0.623, Pt 0.569', () => {
  near(solve(pt('gaas', 'GaAs', 'Al')).phiBp, 0.623, TOL, 'Al');
  near(solve(pt('gaas', 'GaAs', 'Pt')).phiBp, 0.569, TOL, 'Pt');
});

test('B3. Ge n-type: all metals 0.547–0.616 eV, slope 0.050; Ge p-type: all ohmic', () => {
  rel(E.presetInterface('ge').Dit, 2.1e14, 0.01, 'Ge preset D_it from S = 0.05');
  for (const m of METALS) {
    const b = solve(P('ge', 'Ge', m.id)).phiBn;
    assert.ok(b >= 0.547 - TOL && b <= 0.616 + TOL, `${m.id}/Ge ${b}`);
  }
  const bs = METALS.map((m) => solve(P('ge', 'Ge', m.id)).phiBn);
  near(Math.min(...bs), 0.547, TOL, 'Ge min');
  near(Math.max(...bs), 0.616, TOL, 'Ge max');
  near(E.numericSlope(P('ge', 'Ge', 4), 4, 5), 0.05, 0.005, 'Ge slope');
  for (const m of METALS) assert.equal(solve(pt('ge', 'Ge', m.id)).flags.ohmic, true, `${m.id}/p-Ge ohmic`);
});

test('B4. GaN (D_it = 1e13): n-type Au, Ni, Pt; p-type all above 2.1 eV', () => {
  assert.equal(E.presetInterface('gan').Dit, 1e13);
  near(E.gamma(P('gan', 'GaN', 'Au')), 0.52, 0.01, 'S ≈ 0.52');
  near(solve(P('gan', 'GaN', 'Au')).phiBn, 0.939, TOL, 'Au');
  near(solve(P('gan', 'GaN', 'Ni')).phiBn, 0.965, TOL, 'Ni');
  near(solve(P('gan', 'GaN', 'Pt')).phiBn, 1.226, TOL, 'Pt');
  for (const m of METALS) assert.ok(solve(pt('gan', 'GaN', m.id)).phiBp > 2.1, `${m.id}/p-GaN`);
});

test('B5. temperature, Si preset, Al, n-type: barrier barely moves, J_s changes a lot', () => {
  const at = (T) => P('si', 'Si', 'Al', { T });
  near(solve(at(200)).phiBn, 0.56, TOL, '200 K');
  near(solve(at(300)).phiBn, 0.561, TOL, '300 K');
  near(solve(at(400)).phiBn, 0.562, TOL, '400 K');
  const js = (T) => E.saturationCurrent(solve(at(T)).phiBn, T, at(T).Astar);
  assert.equal(at(300).Astar, 110);
  rel(js(200), 3.3e-8, 0.05, 'J_s 200 K');
  rel(js(300), 3.7e-3, 0.05, 'J_s 300 K');
  rel(js(400), 1.5, 0.05, 'J_s 400 K');
  rel(E.saturationRatioVs300(at(400)).ratio, js(400) / js(300), 1e-9, 'ratio helper');
  assert.equal(pt('si', 'Si', 'Al').Astar, 120, 'p-type A* = 120');
});

test('B6. J–V ratios, Si, Al, n-type, 300 K', () => {
  const p = P('si', 'Si', 'Al');
  const s1 = E.schottkyMott(p);
  const cur = solve(p).phiBn;
  const s0 = E.pinnedBarrier(p);
  near(s1, 0.27, TOL, 'S = 1');
  near(cur, 0.561, TOL, 'current');
  near(s0, 0.67, TOL, 'S = 0');
  rel(E.currentRatio(cur, s1, 300), 1.3e-5, 0.05, 'J_s(current)/J_s(S = 1)');
  rel(E.currentRatio(s0, s1, 300), 1.9e-7, 0.05, 'J_s(S = 0)/J_s(S = 1)');
});
